using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Mapa;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Jogo.Exploracao;

/// <summary>
/// Rotas públicas e pontes: obra num hexágono já explorado, na fila de obras, com o material levado até o hexágono.
/// Rota: <c>P.rota</c> × fator do terreno (planície 1 … pântano 2,8). Hexágono de rio: ponte (<c>P.ponte</c>), que serve
/// de rota sobre o rio. Pronta, entra em <c>m.Vias</c> e vale para todos (o caminho fica mais rápido e a fauna, mais fraca).
/// </summary>
public static class Rotas
{
    /// <summary>Custo e tempo (s) da obra no hexágono: ponte se for rio, rota × terreno nos outros.</summary>
    public static (Recursos custo, double seg, bool ponte) Custo(Mundo m, int hex)
    {
        if (m.Mapa.Rio[hex]) return (Recursos.De(m.P.Ponte.Custo), m.P.Ponte.Tempo, true);
        var f = m.P.Terreno[m.Mapa.Terrenos[hex].Chave()];
        var c = new Recursos();
        foreach (var (k, v) in m.P.Rota.Custo) c[k] = Formulas.ArredJs(v * f);
        return (c, m.P.Rota.Tempo * f, false);
    }

    public static bool TemRota(Mundo m, int hex) => m.Mapa.Rio[hex] ? m.Vias.Pontes.Contains(hex) : m.Vias.Rotas.Contains(hex);

    /// <summary>Motivo para não construir aqui, ou null.</summary>
    public static string? Motivo(Mundo m, Reino r, int hex)
    {
        if (!m.G.Valido(hex)) return "Hexágono fora do mapa.";
        if (!Nevoas.Explorado(m, r.Id, hex)) return "Explore a área antes de construir.";
        if (TemRota(m, hex)) return m.Mapa.Rio[hex] ? "Já há uma ponte aqui." : "Já há uma rota aqui.";
        if (r.Fila(Obras.Fila).Itens.Any(i => i.Tipo == ObraRota.Id && i.Hex == hex)) return "Já há uma obra de rota na fila para este hexágono.";
        return null;
    }

    public static ItemFila Construir(Mundo m, Reino r, int hex)
    {
        var motivo = Motivo(m, r, hex);
        if (motivo != null) throw new RegraException(motivo);
        var (custo, seg, ponte) = Custo(m, hex);
        return Filas.Enfileirar(m, r, Obras.Fila, new ItemFila
        {
            Tipo = ObraRota.Id, Hex = hex, Param = ponte ? "ponte" : "rota",
            Rotulo = (ponte ? "Ponte" : "Rota") + " em " + m.G.C(hex) + ", " + m.G.L(hex),
            Custo = custo, DuracaoSeg = seg,
        });
    }
}

/// <summary>Obra de rota ou ponte (LocalId null, Hex = o hexágono). Ao concluir, entra na malha viária pública.</summary>
public sealed class ObraRota : ITipoItemFila
{
    public const string Id = "rota";
    public string Tipo => Id;
    public void Concluir(Mundo m, Reino r, ItemFila item)
    {
        var vias = m.Vias;
        vias.Rotas.Add(item.Hex);
        if (m.Mapa.Rio[item.Hex]) vias.Pontes.Add(item.Hex);
        m.Sujar(vias);
        Registros.Notificar(m, r.Id, "obras", "Obra concluída", item.Rotulo, "mapa?foco=" + item.Hex);
        m.Avisar(r.Id, "mapa");
    }
}
