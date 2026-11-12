using System.Diagnostics;
using System.Threading.Channels;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Persistencia;

namespace ReinoDePedra.Jogo;

/// <summary>
/// Dono único do <see cref="Mundo"/>: uma tarefa executa, em série, os eventos vencidos da agenda e os
/// comandos vindos da API. Sem travas no estado do jogo e sem varrer o mundo: o motor só acorda quando
/// chega um comando ou vence o próximo evento (no máximo a cada segundo). Grava os sujos em lote.
/// <para>Com eventos atrasados (o servidor ficou fora do ar, ou subiu com um save antigo), o motor recupera o atraso em
/// fatias curtas (<see cref="Fatia"/>): entre uma fatia e outra atende os comandos, para um pedido não esperar o atraso
/// inteiro. <see cref="AtrasoMs"/> diz quanto falta e <see cref="Ocupado"/>, quanto o motor trabalhou.</para>
/// </summary>
public sealed class Motor : IAsyncDisposable
{
    public Mundo Mundo { get; }
    public Banco? Banco { get; }
    private readonly Channel<Action> _fila = Channel.CreateUnbounded<Action>(new UnboundedChannelOptions { SingleReader = true });
    private readonly CancellationTokenSource _cts = new();
    private Task? _laco;
    public TimeSpan IntervaloGravacao { get; init; } = TimeSpan.FromSeconds(3);
    public TimeSpan IntervaloVarredura { get; init; } = TimeSpan.FromMinutes(5);
    public Action<string>? Log { get; init; }
    /// <summary>Tempo máximo seguido executando eventos vencidos antes de olhar a fila de comandos.</summary>
    public TimeSpan Fatia { get; init; } = TimeSpan.FromMilliseconds(25);
    public long EventosExecutados { get; private set; }
    public long ComandosExecutados { get; private set; }

    private long _atrasoMs, _ocupadoTicks;
    /// <summary>Tempo de jogo entre o evento vencido mais antigo e agora (0 = em dia). Pode ser lido de qualquer thread.</summary>
    public long AtrasoMs => Interlocked.Read(ref _atrasoMs);
    /// <summary>Tempo em que o motor esteve trabalhando (eventos, comandos e gravação), sem as esperas. Pode ser lido de qualquer thread.</summary>
    public TimeSpan Ocupado => Stopwatch.GetElapsedTime(0, Interlocked.Read(ref _ocupadoTicks));
    /// <summary>Depois de quanto tempo recuperando atraso o log avisa (um soluço de segundos não vira aviso).</summary>
    private static readonly TimeSpan AvisarDepoisDe = TimeSpan.FromSeconds(2);

    public Motor(Mundo mundo, Banco? banco) { Mundo = mundo; Banco = banco; }

    public void Iniciar() => _laco ??= Task.Run(Laco);

    /// <summary>Executa <paramref name="f"/> na thread do mundo e devolve o resultado (exceções voltam para quem chamou).</summary>
    public Task<T> Executar<T>(Func<Mundo, T> f)
    {
        var tcs = new TaskCompletionSource<T>(TaskCreationOptions.RunContinuationsAsynchronously);
        if (!_fila.Writer.TryWrite(() =>
            {
                try { tcs.SetResult(f(Mundo)); }
                catch (Exception e) { tcs.SetException(e); }
            }))
            tcs.SetException(new RegraException("O servidor está reiniciando. Tente de novo em instantes.", 503));
        return tcs.Task;
    }
    public Task Executar(Action<Mundo> f) => Executar<bool>(m => { f(m); return true; });

    /// <summary>Executa os eventos vencidos, em ordem, por no máximo uma <see cref="Fatia"/>. O que sobrar fica para a próxima rodada.</summary>
    private void ProcessarVencidos()
    {
        var inicio = Stopwatch.GetTimestamp();
        const int lote = 16;
        int n;
        do { n = Mundo.ProcessarAte(Mundo.Relogio.Agora, lote); EventosExecutados += n; }
        while (n == lote && Stopwatch.GetElapsedTime(inicio) < Fatia);
    }

    private async Task Laco()
    {
        var ultimaGravacao = DateTime.UtcNow;
        var ultimaVarredura = DateTime.UtcNow;
        var leitor = _fila.Reader;
        long atrasadoDesde = 0, eventosAoAtrasar = 0;
        var avisou = false;
        while (!_cts.IsCancellationRequested)
        {
            try
            {
                var comeco = Stopwatch.GetTimestamp();
                ProcessarVencidos();
                while (leitor.TryRead(out var acao))
                {
                    acao(); ComandosExecutados++;
                    ProcessarVencidos();
                }
                var atraso = Mundo.Agenda.Proximo(out _, out var maisAntigo) ? Math.Max(0, Mundo.Relogio.Agora - maisAntigo) : 0;
                Interlocked.Exchange(ref _atrasoMs, atraso);
                if (atraso > 0)
                {
                    if (atrasadoDesde == 0) { atrasadoDesde = Stopwatch.GetTimestamp(); eventosAoAtrasar = EventosExecutados; }
                    if (!avisou && Stopwatch.GetElapsedTime(atrasadoDesde) >= AvisarDepoisDe)
                    {
                        avisou = true;
                        Log?.Invoke($"motor atrasado: {T.EmHoras(atraso):0.0} h de jogo para recuperar (o servidor ficou fora do ar ou o save é antigo)");
                    }
                }
                else if (atrasadoDesde != 0)
                {
                    if (avisou) Log?.Invoke($"motor em dia: {EventosExecutados - eventosAoAtrasar} eventos em {Stopwatch.GetElapsedTime(atrasadoDesde).TotalSeconds:0.0} s");
                    atrasadoDesde = 0; avisou = false;
                }
                var agoraReal = DateTime.UtcNow;
                if (Banco != null && agoraReal - ultimaVarredura >= IntervaloVarredura)
                {
                    Banco.SalvarEsquecidos(Mundo, Log);
                    ultimaVarredura = ultimaGravacao = agoraReal;
                }
                else if (Banco != null && agoraReal - ultimaGravacao >= IntervaloGravacao)
                {
                    Banco.Salvar(Mundo);
                    ultimaGravacao = agoraReal;
                }
                Interlocked.Add(ref _ocupadoTicks, Stopwatch.GetTimestamp() - comeco);
                // espera: próximo evento, próximo comando ou 1 s
                var espera = 1000L;
                if (Mundo.Agenda.Proximo(out _, out var quando))
                    espera = Math.Clamp(quando - Mundo.Relogio.Agora, 0, 1000);
                if (espera > 0)
                {
                    using var t = CancellationTokenSource.CreateLinkedTokenSource(_cts.Token);
                    t.CancelAfter(TimeSpan.FromMilliseconds(espera));
                    try { await leitor.WaitToReadAsync(t.Token); } catch (OperationCanceledException) { }
                }
            }
            catch (Exception e)
            {
                Log?.Invoke("erro no motor: " + e);
                await Task.Delay(200);
            }
        }
    }

    public async ValueTask DisposeAsync()
    {
        _fila.Writer.TryComplete();
        _cts.Cancel();
        if (_laco != null) { try { await _laco; } catch { } }
        // termina comandos pendentes e grava tudo
        while (_fila.Reader.TryRead(out var a)) { try { a(); } catch { } }
        Banco?.SalvarEsquecidos(Mundo, Log);
    }
}
