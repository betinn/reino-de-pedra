using System.Diagnostics;
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
/// gerenciada e o tamanho do banco depois de salvar. Os limites têm folga larga para o orçamento de projeto (≈ 12% de um núcleo):
/// o mundo inteiro precisa custar muito menos que isso em tempo real. REINO_CARGA_DIAS muda a duração (padrão: 10).
/// Os números medidos estão em docs/decisoes/0021-ia.md e docs/desempenho.md.
/// </summary>
[Collection("carga")]
[Trait("Categoria", "carga")]
public class CargaIATestes(ITestOutputHelper saida)
{
    [Fact]
    public void Mundo_de_30_reinos_por_dias_de_jogo_custa_pouco_e_a_IA_cresce()
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
        var tempoSessoes = new Stopwatch();
        var proximaAmostra = m.Agora + T.Hora;
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
            var ehSessao = temEvento && m.Agenda.Proximo(out var idEv, out _) && m.Eventos.Obter(idEv) is SessaoIAEvento;
            if (ehSessao) { tempoSessoes.Start(); sessoesIA++; }
            eventos += m.ProcessarAte(t.Relogio.Agora, 1);
            if (ehSessao) tempoSessoes.Stop();
            if (m.Agora >= proximaAmostra)
            {
                picoMemoria = Math.Max(picoMemoria, GC.GetTotalMemory(false) - memoriaAntes);
                proximaAmostra += T.Hora;
            }
        }
        t.Relogio.Agora = fim;
        relogio.Stop();
        proc.Refresh();
        var cpu = (proc.TotalProcessorTime - cpu0).TotalSeconds;
        AjustesTeste.FalharSeErro();

        // banco: salvar o mundo inteiro e medir o arquivo
        var dir = Path.Combine(Path.GetTempPath(), "rp-carga-" + Guid.NewGuid().ToString("N"));
        double mb, segSalvar;
        try
        {
            var arq = Path.Combine(dir, "carga.db");
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
        }
        finally { try { Directory.Delete(dir, true); } catch { } }
        var viva = GC.GetTotalMemory(true) - memoriaAntes;

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
        saida.WriteLine($"fração de um núcleo em tempo real: {porDia / 86400 * 100:0.0000}% (orçamento: 12,5%)");
        saida.WriteLine($"memória gerenciada: pico {picoMemoria / 1048576.0:0.0} MB, viva no fim {viva / 1048576.0:0.0} MB");
        saida.WriteLine($"banco {mb:0.00} MB, salvo em {segSalvar:0.00} s; documentos {m.Colecoes.Sum(c => c.Count)}");
        saida.WriteLine($"IA: castelo médio {nivelCastelo:0.0}, tropas médias {tropas:0}; batalhas {batalhas} ({atkIA} atacadas por IA)");

        // limites com folga: menos de 0,05% de um núcleo por dia de jogo (o orçamento é 12,5%), memória e banco pequenos
        Assert.True(porDia < 43, $"CPU por dia de jogo: {porDia:0.00} s");
        Assert.True(paredePorDia < 43, $"tempo de parede por dia de jogo: {paredePorDia:0.00} s");
        Assert.True(picoMemoria < 400L * 1048576, $"pico de memória: {picoMemoria / 1048576.0:0} MB");
        Assert.True(mb < 64, $"banco: {mb:0.0} MB");
        // a IA cresceu (no dia 10 o médio do modelo tem castelo 7)
        if (dias >= 10) Assert.True(nivelCastelo >= 5, $"castelo médio da IA: {nivelCastelo:0.0}");
    }
}
