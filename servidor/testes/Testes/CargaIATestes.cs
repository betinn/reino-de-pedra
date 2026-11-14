using System.Diagnostics;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using ReinoDePedra.Api;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.IA;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Persistencia;
using ReinoDePedra.Jogo.Reinos;
using Xunit.Abstractions;

namespace ReinoDePedra.Testes;

[CollectionDefinition("carga", DisableParallelization = true)]
public sealed class ColecaoCarga;

/// <summary>
/// Teste de carga: um mundo com P.reinos reinos (5 jogadores simulados + 25 de IA), com fauna, por dias de jogo avançando o
/// relógio falso evento a evento. Mede eventos, tempo de CPU (total, por evento e por dia de jogo), pico de memória
/// gerenciada e o tamanho do banco depois de salvar. REINO_CARGA_DIAS muda a duração (padrão: 10).
/// <para>O relógio falso mede o custo de cada evento, mas não roda o servidor. Por isso o mesmo save sobe depois num servidor
/// de verdade (Kestrel, motor, gravação) com relógio de parede: no ritmo real ele tem de ficar ocioso; 720× mais rápido, em
/// dia e dentro do orçamento (≈ 12,5% de um núcleo); e, com um dia de jogo de atraso (o servidor ficou fora do ar), recuperar
/// o atraso sem deixar os comandos esperando.</para>
/// <para>O que segura o custo é uma medida igual em qualquer máquina: os hexágonos visitados pelas buscas de caminho por dia
/// de jogo. Uma busca que volte a varrer o mapa a cada requisição de fila estoura o limite, em Debug ou em Release.</para>
/// Os números medidos estão em docs/decisoes/0021-ia.md e docs/desempenho.md.
/// </summary>
[Collection("carga")]
[Trait("Categoria", "carga")]
public class CargaIATestes(ITestOutputHelper saida)
{
    /// <summary>Relógio de parede a partir de um instante do jogo, com ritmo ajustável e salto (o servidor que ficou fora do ar).</summary>
    private sealed class RelogioDeParede(long inicio) : IRelogio
    {
        private readonly object _trava = new();
        private long _base = inicio, _t0 = Stopwatch.GetTimestamp();
        private double _ritmo = 1;
        private long Corrido => (long)(Stopwatch.GetElapsedTime(_t0).TotalMilliseconds * _ritmo);
        public long Agora { get { lock (_trava) return _base + Corrido; } }
        public void Ritmo(double ritmo) { lock (_trava) { _base += Corrido; _t0 = Stopwatch.GetTimestamp(); _ritmo = ritmo; } }
        public void Saltar(long ms) { lock (_trava) _base += ms; }
    }

    /// <summary>O que o servidor gastou numa janela de tempo de parede.</summary>
    private sealed record Janela(double Seg, double Cpu, double Ocupado, long Eventos)
    {
        public double FracaoCpu => Cpu / Seg;
        public double FracaoOcupado => Ocupado / Seg;
    }

    private static async Task<Janela> Medir(Motor motor, TimeSpan duracao)
    {
        var proc = Process.GetCurrentProcess();
        var cpu0 = proc.TotalProcessorTime; var ocupado0 = motor.Ocupado; var eventos0 = motor.EventosExecutados;
        var sw = Stopwatch.StartNew();
        await Task.Delay(duracao);
        var seg = sw.Elapsed.TotalSeconds;
        proc.Refresh();
        return new Janela(seg, (proc.TotalProcessorTime - cpu0).TotalSeconds, (motor.Ocupado - ocupado0).TotalSeconds, motor.EventosExecutados - eventos0);
    }

    /// <summary>O motor não tem evento vencido para executar (perguntado na thread dele, depois de uma fatia de eventos).</summary>
    private static Task<bool> EmDia(Motor motor) => motor.Executar(m => !m.Agenda.Proximo(out _, out var q) || q > m.Relogio.Agora);

    /// <summary>Espera o motor ficar em dia, por até <paramref name="segundos"/>. Devolve se ficou.</summary>
    private static async Task<bool> FicouEmDia(Motor motor, double segundos = 5)
    {
        var sw = Stopwatch.StartNew();
        while (!await EmDia(motor))
        {
            if (sw.Elapsed.TotalSeconds > segundos) return false;
            await Task.Delay(50);
        }
        return true;
    }

    [Fact]
    public async Task Mundo_de_30_reinos_por_dias_de_jogo_custa_pouco_e_a_IA_cresce()
    {
        AjustesTeste.Garantir();
        var dias = int.TryParse(Environment.GetEnvironmentVariable("REINO_CARGA_DIAS"), out var dd) && dd > 0 ? dd : 10;
        var t = new MundoTeste(semente: 7, fauna: true);
        var m = t.M;
        m.Sorte = new Rng(42);
        m.IA.Ativa = true; m.IA.CriarReinos = true;
        SistemaIA.AoIniciar(m);
        Ocupacao.Completar(m);
        var jogadores = Enumerable.Range(0, m.P.Reinos - m.P.IA.Inicial).Select(i => MundoIA.Jogador(t, i)).ToList();
        Assert.Equal(m.P.Reinos, Ocupacao.Ativos(m).Count());
        // jogadores simulados: entram nas horas do jogador médio e jogam pelos mesmos serviços (dois saqueadores, três construtores)
        var med = m.P.IA.Habilidades["medio"];
        var condutas = jogadores.Select((j, i) => new Conduta(med, m.P.IA.Perfis[i < 2 ? "saqueador" : "expansionista"])).ToList();
        var proximaJogada = Sessoes.Proxima(m, med, m.Agora);

        var fim = m.Agora + dias * T.Dia;
        var proc = Process.GetCurrentProcess();
        GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect();
        var cpu0 = proc.TotalProcessorTime;
        var relogio = Stopwatch.StartNew();
        // o processo guarda os mundos de outros testes: conta só o que este mundo acrescenta
        var memoriaAntes = GC.GetTotalMemory(true);
        long eventos = 0, jogadas = 0, sessoesIA = 0, picoMemoria = 0;
        var hexes0 = m.HexesBuscados;
        var tempoSessoes = new Stopwatch();
        var porTipo = new Dictionary<string, (long n, long ticks)>();
        var proximaAmostra = m.Agora + T.Hora;
        // horário da IA: sessões marcadas (etapa 0) e jogadas (a segunda parte, que só existe quando ela veio) por hora local,
        // IAs acordadas (Personas.Acordada) por hora local e, a cada dia, castelo e tropas médios e batalhas acumuladas
        var marcadasPorHora = new long[24]; var jogadasPorHora = new long[24];
        var acordadasPorHora = new double[24]; var amostrasPorHora = new int[24];
        var diario = new List<string>();
        var proximoDia = m.Agora + T.Dia;
        while (true)
        {
            var temEvento = m.Agenda.Proximo(out _, out var q);
            var proximo = Math.Min(temEvento ? q : long.MaxValue, proximaJogada);
            if (proximo > fim) break;
            t.Relogio.Agora = Math.Max(t.Relogio.Agora, proximo);
            if (proximo == proximaJogada && (!temEvento || proximaJogada <= q))
            {
                for (var i = 0; i < jogadores.Count; i++)
                {
                    jogadores[i].UltimoAcesso = m.Agora; m.Sujar(jogadores[i]);
                    Governo.Sessao(m, jogadores[i], condutas[i]);
                    jogadas++;
                }
                proximaJogada = Sessoes.Proxima(m, med, m.Agora);
                continue;
            }
            var tipo = temEvento && m.Agenda.Proximo(out var idEv, out _) ? m.Eventos.Obter(idEv)?.GetType().Name ?? "(cancelado)" : "(nenhum)";
            var ehSessao = tipo == nameof(SessaoIAEvento);
            if (ehSessao) { tempoSessoes.Start(); sessoesIA++; }
            if (ehSessao && m.Agenda.Proximo(out var idSessao, out _) && m.Eventos.Obter(idSessao) is SessaoIAEvento se)
                (se.Etapa == 0 ? marcadasPorHora : jogadasPorHora)[(int)Sessoes.HoraLocal(m, t.Relogio.Agora)]++;
            var t0 = Stopwatch.GetTimestamp();
            eventos += m.ProcessarAte(t.Relogio.Agora, 1);
            var dt = Stopwatch.GetTimestamp() - t0;
            porTipo[tipo] = porTipo.TryGetValue(tipo, out var pt) ? (pt.n + 1, pt.ticks + dt) : (1, dt);
            if (ehSessao) tempoSessoes.Stop();
            if (m.Agora >= proximaAmostra)
            {
                picoMemoria = Math.Max(picoMemoria, GC.GetTotalMemory(false) - memoriaAntes);
                var hAmostra = (int)Sessoes.HoraLocal(m, m.Agora);
                acordadasPorHora[hAmostra] += Ocupacao.DeIA(m).Count(r => Sessoes.De(m, r) is { } c && Personas.Acordada(m, r, c.C));
                amostrasPorHora[hAmostra]++;
                proximaAmostra += T.Hora;
            }
            if (m.Agora >= proximoDia)
            {
                var iaDia = Ocupacao.DeIA(m).ToList();
                diario.Add($"  dia {diario.Count + 1}: castelo médio {iaDia.Average(r => m.Locais[r.CasteloId].Nivel):0.0}, tropas médias {iaDia.Average(r => Economia.Tropas(m, r)):0.0}, batalhas {AjustesTeste.De(m).Fins.Count}");
                proximoDia += T.Dia;
            }
        }
        t.Relogio.Agora = fim;
        relogio.Stop();
        proc.Refresh();
        var cpu = (proc.TotalProcessorTime - cpu0).TotalSeconds;
        var hexesPorDia = (m.HexesBuscados - hexes0) / (double)dias;
        AjustesTeste.FalharSeErro();

        // banco: salvar o mundo inteiro e medir o arquivo
        var dir = Path.Combine(Path.GetTempPath(), "rp-carga-" + Guid.NewGuid().ToString("N"));
        double mb, segSalvar;
        long viva;
        Janela real, rapido;
        double segRecuperar, piorResposta;
        long eventosRecuperados;
        try
        {
            var arq = Path.Combine(dir, "reino.db");
            using (var db = new Banco(arq))
            {
                var sw = Stopwatch.StartNew();
                db.Salvar(m);
                segSalvar = sw.Elapsed.TotalSeconds;
                db.Checkpoint();
            }
            // REINO_CARGA_BANCO guarda uma cópia do banco: um save de 30 reinos para medir o servidor publicado (docs/desempenho.md)
            if (Environment.GetEnvironmentVariable("REINO_CARGA_BANCO") is { Length: > 0 } copia)
                File.Copy(arq, copia, overwrite: true);
            mb = new DirectoryInfo(dir).GetFiles().Sum(f => f.Length) / (1024.0 * 1024);
            viva = GC.GetTotalMemory(true) - memoriaAntes;

            // o servidor de verdade com este save: o relógio de parede continua de onde a simulação parou
            var parede = new RelogioDeParede(fim);
            var app = Servidor.Construir([], new Configuracao { Dados = dir, Urls = "http://127.0.0.1:0", CookieSeguro = false }, parede);
            await app.StartAsync();
            try
            {
                var motor = app.Services.GetRequiredService<Motor>();
                Assert.Equal(m.P.Reinos, await motor.Executar(mm => Ocupacao.Ativos(mm).Count()));
                Assert.True(await FicouEmDia(motor), "o servidor subiu atrasado");
                await Task.Delay(TimeSpan.FromSeconds(2));   // a subida (leitura do save, compilação) não entra na medida
                // no ritmo real, o mundo cheio quase não tem o que fazer
                real = await Medir(motor, TimeSpan.FromSeconds(4));
                Assert.True(await FicouEmDia(motor, 1), "o motor ficou para trás no ritmo real");
                // 720× mais rápido: uma hora de jogo em 5 s
                parede.Ritmo(720);
                rapido = await Medir(motor, TimeSpan.FromSeconds(5));
                parede.Ritmo(1);
                Assert.True(await FicouEmDia(motor), "o motor não acompanhou o jogo 720× mais rápido");
                // o servidor ficou fora do ar por um dia de jogo: recupera o atraso sem deixar os comandos esperando
                var antes = motor.EventosExecutados;
                parede.Saltar(T.Dia);
                var sw = Stopwatch.StartNew();
                piorResposta = 0;
                while (true)
                {
                    var pedido = Stopwatch.StartNew();
                    var emDia = await EmDia(motor);
                    piorResposta = Math.Max(piorResposta, pedido.Elapsed.TotalSeconds);
                    if (emDia || sw.Elapsed.TotalSeconds > 120) break;
                    await Task.Delay(20);
                }
                segRecuperar = sw.Elapsed.TotalSeconds;
                eventosRecuperados = motor.EventosExecutados - antes;
                Assert.True(await FicouEmDia(motor, 1), "o motor não recuperou um dia de jogo de atraso em 2 minutos");
            }
            finally { await app.StopAsync(); await app.DisposeAsync(); }
            AjustesTeste.FalharSeErro();
        }
        finally { try { Directory.Delete(dir, true); } catch { } }

        var ia = Ocupacao.DeIA(m).ToList();
        var nivelCastelo = ia.Average(r => m.Locais[r.CasteloId].Nivel);
        var tropas = ia.Average(r => Economia.Tropas(m, r));
        var fins = AjustesTeste.De(m).Fins;
        var batalhas = fins.Count;
        var atkIA = fins.Count(f => m.Reinos.Obter(f.AtacanteId)?.EhIA == true);
        var porDia = cpu / dias;
        var paredePorDia = relogio.Elapsed.TotalSeconds / dias;
        saida.WriteLine($"{dias} dias de jogo, {Ocupacao.Ativos(m).Count()} reinos ({ia.Count} de IA)");
        saida.WriteLine($"eventos {eventos} ({eventos / (double)dias:0} por dia), sessões de jogador {jogadas}");
        saida.WriteLine($"sessões de IA {sessoesIA}: {tempoSessoes.Elapsed.TotalSeconds:0.00} s ({tempoSessoes.Elapsed.TotalMilliseconds / Math.Max(1, sessoesIA):0.00} ms por sessão)");
        saida.WriteLine($"CPU {cpu:0.00} s ({porDia:0.000} s por dia de jogo; {cpu / Math.Max(1, eventos) * 1e6:0} µs por evento); parede {relogio.Elapsed.TotalSeconds:0.00} s");
        foreach (var (k, v) in porTipo.OrderByDescending(x => x.Value.ticks).Take(6))
            saida.WriteLine($"  {k}: {v.n} × {v.ticks * 1e6 / Stopwatch.Frequency / v.n:0} µs = {v.ticks / (double)Stopwatch.Frequency:0.00} s");
        saida.WriteLine($"buscas de caminho: {hexesPorDia:0} hexágonos visitados por dia de jogo");
        saida.WriteLine($"fração de um núcleo em tempo real: {porDia / 86400 * 100:0.0000}% (orçamento: 12,5%)");
        saida.WriteLine($"servidor no ritmo real, {real.Seg:0.0} s: CPU do processo {real.FracaoCpu * 100:0.00}%, motor ocupado {real.FracaoOcupado * 100:0.000}%, {real.Eventos} eventos");
        saida.WriteLine($"servidor a 720×, {rapido.Seg:0.0} s: CPU do processo {rapido.FracaoCpu * 100:0.00}%, motor ocupado {rapido.FracaoOcupado * 100:0.00}%, {rapido.Eventos} eventos");
        saida.WriteLine($"servidor com um dia de jogo de atraso: {eventosRecuperados} eventos em {segRecuperar:0.00} s; pior resposta a um comando {piorResposta * 1000:0} ms");
        saida.WriteLine($"memória gerenciada: pico {picoMemoria / 1048576.0:0.0} MB, viva no fim {viva / 1048576.0:0.0} MB");
        saida.WriteLine($"banco {mb:0.00} MB, salvo em {segSalvar:0.00} s; documentos {m.Colecoes.Sum(c => c.Count)}");
        saida.WriteLine($"IA: castelo médio {nivelCastelo:0.0}, tropas médias {tropas:0}; batalhas {batalhas} ({atkIA} atacadas por IA)");
        foreach (var linha in diario) saida.WriteLine(linha);
        saida.WriteLine("hora local:            " + string.Concat(Enumerable.Range(0, 24).Select(h => $"{h,5}")));
        saida.WriteLine("sessões marcadas/dia:  " + string.Concat(marcadasPorHora.Select(n => $"{n / (double)dias,5:0.0}")));
        saida.WriteLine("sessões jogadas/dia:   " + string.Concat(jogadasPorHora.Select(n => $"{n / (double)dias,5:0.0}")));
        saida.WriteLine("IAs acordadas (média): " + string.Concat(Enumerable.Range(0, 24).Select(h => $"{acordadasPorHora[h] / Math.Max(1, amostrasPorHora[h]),5:0.0}")));

        // o trabalho das buscas de caminho, igual em qualquer máquina: uma busca que varre o mapa custa 74.880 hexágonos, e
        // uma por requisição de fila dava 16 milhões por dia de jogo (hoje são cerca de 600 mil)
        Assert.True(hexesPorDia < 3_000_000, $"buscas de caminho: {hexesPorDia:0} hexágonos visitados por dia de jogo");
        // CPU: um dia de jogo em poucos segundos (é também o tempo de recuperar um dia de servidor fora do ar)
        Assert.True(porDia < 8, $"CPU por dia de jogo: {porDia:0.00} s");
        Assert.True(paredePorDia < 8, $"tempo de parede por dia de jogo: {paredePorDia:0.00} s");
        // o servidor de verdade: ocioso no ritmo real, dentro do orçamento a 720× e com resposta durante a recuperação
        Assert.True(real.FracaoOcupado < 0.05, $"motor ocupado no ritmo real: {real.FracaoOcupado * 100:0.00}%");
        Assert.True(real.FracaoCpu < 0.125, $"CPU do processo no ritmo real: {real.FracaoCpu * 100:0.0}%");
        Assert.True(rapido.FracaoOcupado < 0.125, $"motor ocupado a 720×: {rapido.FracaoOcupado * 100:0.0}%");
        Assert.True(segRecuperar < 30, $"um dia de jogo de atraso levou {segRecuperar:0.0} s");
        Assert.True(piorResposta < 0.4, $"um comando esperou {piorResposta * 1000:0} ms com o motor recuperando atraso");
        Assert.True(picoMemoria < 400L * 1048576, $"pico de memória: {picoMemoria / 1048576.0:0} MB");
        Assert.True(mb < 64, $"banco: {mb:0.0} MB");
        // a IA cresceu (no dia 10 o médio do modelo tem castelo 7)
        if (dias >= 10) Assert.True(nivelCastelo >= 5, $"castelo médio da IA: {nivelCastelo:0.0}");
    }
}
