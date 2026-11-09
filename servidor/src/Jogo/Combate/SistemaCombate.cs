using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Combate;

/// <summary>Registra os ganchos do combate na subida do servidor.</summary>
[Sistema]
public static class SistemaCombate
{
    public const string MotivoEscudo = "O alvo estava sob escudo de proteção.";

    public static void AoIniciar(Mundo m) => Sistemas.UmaVez("combate", () =>
    {
        // escudo de novato e de exílio (Reino.EscudoAte): só descoberto ao chegar
        Permissoes.AoChegar.Add((mm, atk, alvo) => alvo.SobEscudo(mm.Agora) ? MotivoEscudo : null);
        Exercitos.BloqueiosOrdem.Add((mm, ex) => ex.BatalhaId is long id && mm.Batalhas.Obter(id) is { Encerrada: false }
            ? "Em batalha: para sair, use Recuar na tela da batalha." : null);
        // relíquias carregadas ficam no local onde as tropas entram (idempotente: o sistema de relíquias pode fazer o mesmo)
        Exercitos.AoEntrarNoLocal += (mm, ex, l) =>
        {
            foreach (var id in ex.Reliquias.ToList())
                if (mm.Reliquias.Obter(id) is { } rel && rel.MarchaId == ex.Id) Reliquias.Guardar(mm, rel, l);
            Batalhas.AoEntrarNoLocal(mm, ex, l);
        };
        Marcha.AoPartir.Add(Avistamentos.AoPartir);
        Marcha.AoPartir.Add(Batalhas.AoPartir);
        Obras.HexOcupado.Add((mm, hex) => Defesas.NoHex(mm, hex) != null);
        Obras.HexOcupadoPara.Add((mm, r, hex) => Defesas.NoHex(mm, hex) != null);   // torres são públicas
        // os arqueiros no alto enxergam o alcance da torre
        Nevoas.FontesDeVisao.Add((mm, reinoId) => Defesas.DoReino(mm, reinoId).SelectMany(t => mm.G.Area(t.Hex, Defesas.Alcance(mm, t))).ToList());
        // resgate à força: vencer no local onde estão presos liberta os exploradores do atacante; local perdido solta os presos
        Combates.AoTerminar.Add(Capturas.AoTerminarBatalha);
        Quedas.AoCair += (mm, _, _, _) => Capturas.Conferir(mm);
    });
}

/// <summary>
/// Avistamento: na partida de um exército, para cada reino cuja visão o caminho cruza (e que ainda não o via), um evento no
/// instante em que ele entra na visão notifica o reino (categoria "ataques"). O aviso diz de quem é e onde está. Nunca o
/// tamanho, e nunca para onde vai: quem vê a marcha não sabe se é com ele.
/// </summary>
public static class Avistamentos
{
    /// <summary>Hexágonos que o reino vê, sem marcar a névoa (para prever o caminho de outra marcha).</summary>
    public static HashSet<int> Visao(Mundo m, long reinoId)
    {
        var vis = new HashSet<int>();
        foreach (var l in m.LocaisDe(reinoId))
            if (!l.Ruina) foreach (var h in m.G.Area(l.Hex, Nevoas.RaioLocal(m, l))) vis.Add(h);
        var agora = m.Agora;
        foreach (var mc in m.Marchas)
            if (mc.ReinoId == reinoId) foreach (var h in m.G.Area(mc.HexEm(agora), mc.RaioVisao(m))) vis.Add(h);
        foreach (var f in Nevoas.FontesDeVisao) foreach (var h in f(m, reinoId)) vis.Add(h);
        return vis;
    }

    internal static void AoPartir(Mundo m, Marcha mc)
    {
        if (mc is not Exercito ex || ex.Retornando || ex.Caminho.Count < 2) return;
        foreach (var w in m.Reinos)
        {
            if (!w.Ativo || w.Id == ex.ReinoId || Aliancas.SaoAliados(m, w.Id, ex.ReinoId) || Comercio.PactoAtivo(m, w.Id, ex.ReinoId)) continue;
            var vis = Visao(m, w.Id);
            if (vis.Contains(ex.Caminho[0])) continue;
            var i = ex.Caminho.FindIndex(vis.Contains);
            if (i < 0) continue;
            m.Agendar(new AvistamentoAtaqueEvento { MarchaId = ex.Id, DefensorId = w.Id, Partida = ex.Partida, Hex = ex.Caminho[i], Quando = ex.Tempos[i] });
        }
    }

    /// <summary>Tamanho aproximado de uma força (P.aproximado): "nenhuma", "poucas" ou "≈ n" arredondado ao passo.</summary>
    public static int Arredondado(Mundo m, int n)
    {
        var p = m.P.Aproximado;
        if (n <= 0) return 0;
        if (n < p.Poucas) return Math.Max(1, p.Poucas - 1);
        var passo = Math.Max(1, p.Passo);
        return Math.Max(passo, (int)Math.Round(n / (double)passo) * passo);
    }

    public static string Aproximado(Mundo m, int n)
    {
        var p = m.P.Aproximado;
        if (n <= 0) return "nenhuma";
        if (n < p.Poucas) return "poucas";
        var passo = Math.Max(1, p.Passo);
        return "≈ " + Math.Max(passo, (int)Math.Round(n / (double)passo) * passo);
    }
}

public sealed class AvistamentoAtaqueEvento : Evento
{
    public long MarchaId { get; set; }
    public long DefensorId { get; set; }
    public long Partida { get; set; }
    public int Hex { get; set; }

    public override void Executar(Mundo m)
    {
        if (m.Marchas.Obter(MarchaId) is not Exercito ex || ex.Partida != Partida) return;
        if (m.Reinos.Obter(DefensorId) is not { Ativo: true } w || m.Reinos.Obter(ex.ReinoId) is not { } dono) return;
        var perto = m.LocaisDe(w.Id).Where(l => !l.Ruina).OrderBy(l => m.G.Distancia(l.Hex, Hex)).ThenBy(l => l.Id).FirstOrDefault();
        Registros.Notificar(m, w.Id, "ataques", "Exército de " + dono.Nome + " à vista", perto != null ? "Perto de " + perto.Nome + "." : "", "mapa?foco=" + Hex);
        m.Avisar(w.Id, "mapa");
    }
}
