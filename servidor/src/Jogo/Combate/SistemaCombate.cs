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
        Obras.HexOcupadoPara.Add((mm, r, hex) => Defesas.NoHex(mm, hex) is { } t && t.ReinoId == r.Id);
        // torres de outros reinos ficam na foto da névoa como foram vistas (nível e alcance daquele momento)
        Fotos.Fotografos.Add((mm, reinoId, hex) => Defesas.NoHex(mm, hex) is { } t && t.ReinoId != reinoId
            ? [new JsonObject { ["tipo"] = "torre", ["id"] = t.Id, ["nivel"] = t.Nivel, ["alcance"] = Defesas.Alcance(mm, t), ["dono"] = "desconhecido", ["aoVivo"] = false }]
            : []);
        // os arqueiros no alto enxergam o alcance da torre
        Nevoas.FontesDeVisao.Add((mm, reinoId) => Defesas.DoReino(mm, reinoId).SelectMany(t => mm.G.Area(t.Hex, Defesas.Alcance(mm, t))).ToList());
    });
}

/// <summary>
/// Avistamento: na partida de um ataque, se o caminho passa pela visão do defensor, um evento no instante em que as
/// tropas entram na visão notifica o defensor (categoria "ataques"). Sem estandarte, "Forças desconhecidas".
/// </summary>
public static class Avistamentos
{
    internal static void AoPartir(Mundo m, Marcha mc)
    {
        if (mc is not Exercito ex) return;
        m.Cancelar(ex.AvistamentoId); ex.AvistamentoId = null;
        if (ex.Retornando || !Batalhas.EhAtaque(ex) || ex.Caminho.Count < 2) return;
        var l = ex.AlvoLocalId is long id ? m.Locais.Obter(id) : null;
        if (l == null || Ataques.SemDono(m, l) || l.ReinoId == ex.ReinoId) return;
        var vis = Nevoas.VisiveisAgora(m, l.ReinoId);
        var i = ex.Caminho.FindIndex(vis.Contains);
        if (i < 0) i = ex.Caminho.Count - 1;
        ex.AvistamentoId = m.Agendar(new AvistamentoAtaqueEvento
        {
            MarchaId = ex.Id, LocalId = l.Id, DefensorId = l.ReinoId, Partida = ex.Partida, Quando = ex.Tempos[i],
        }).Id;
        m.Sujar(ex);
    }

    /// <summary>Tamanho aproximado de uma força (P.aproximado): "nenhuma", "poucas" ou "≈ n" arredondado ao passo.</summary>
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
    public long LocalId { get; set; }
    public long DefensorId { get; set; }
    public long Partida { get; set; }

    public override void Executar(Mundo m)
    {
        if (m.Marchas.Obter(MarchaId) is not Exercito ex || ex.Partida != Partida || ex.AlvoLocalId != LocalId || ex.AvistamentoId != Id) return;
        ex.AvistamentoId = null; m.Sujar(ex);
        var l = m.Locais.Obter(LocalId);
        if (l == null || l.ReinoId != DefensorId) return;
        var quem = RelatoriosCombate.NomeAtacante(m, ex.ReinoId, ex.Estandarte);
        var n = GT.Total(ex.Tropas);
        Registros.Notificar(m, DefensorId, "ataques", quem + " a caminho de " + l.Nome,
            Avistamentos.Aproximado(m, n) + " tropas vindas do " + m.G.Direcao(l.Hex, ex.Origem) + ".", "mapa?foco=" + l.Hex);
        m.Avisar(DefensorId, "mapa");
    }
}
