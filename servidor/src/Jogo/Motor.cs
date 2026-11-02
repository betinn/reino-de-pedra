using System.Threading.Channels;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Persistencia;

namespace ReinoDePedra.Jogo;

/// <summary>
/// Dono único do <see cref="Mundo"/>: uma tarefa executa, em série, os eventos vencidos da agenda e os
/// comandos vindos da API. Sem travas no estado do jogo e sem varrer o mundo: o motor só acorda quando
/// chega um comando ou vence o próximo evento (no máximo a cada segundo). Grava os sujos em lote.
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
    public long EventosExecutados { get; private set; }
    public long ComandosExecutados { get; private set; }

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
            tcs.SetException(new InvalidOperationException("motor parado"));
        return tcs.Task;
    }
    public Task Executar(Action<Mundo> f) => Executar<bool>(m => { f(m); return true; });

    private async Task Laco()
    {
        var ultimaGravacao = DateTime.UtcNow;
        var ultimaVarredura = DateTime.UtcNow;
        var leitor = _fila.Reader;
        while (!_cts.IsCancellationRequested)
        {
            try
            {
                EventosExecutados += Mundo.ProcessarAte(Mundo.Relogio.Agora, 5000);
                while (leitor.TryRead(out var acao))
                {
                    acao(); ComandosExecutados++;
                    EventosExecutados += Mundo.ProcessarAte(Mundo.Relogio.Agora, 5000);
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
