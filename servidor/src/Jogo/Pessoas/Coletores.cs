using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.Pessoas;

/// <summary>
/// Civis sem trabalho que vão coletar madeira ou pedra no mapa dentro de um exército (ordem "coletar"): saem do local no estado
/// <see cref="Estados.Coletando"/> (não são milícia nem podem ser recrutados), continuam civis (contam na população, não nas
/// tropas) e, quando a marcha acaba, voltam andando para a vaga mais necessária ou para o castelo.
/// </summary>
public static partial class Pessoas
{
    /// <summary>Civis sem trabalho presentes no local (quem pode ir coletar).</summary>
    public static IEnumerable<Pessoa> OciososPresentes(Mundo m, Local l) =>
        m.PessoasNoLocal(l.Id).Where(p => p.EhCivil && p.Oficio == Oficios.Ocioso && p.Estado == Estados.Ociosa).OrderBy(p => p.Id);

    /// <summary>Civis da marcha que estão coletando.</summary>
    public static IEnumerable<Pessoa> Coletores(Mundo m, Marcha mc) => DaMarcha(m, mc).Where(p => p.EhCivil && p.Estado == Estados.Coletando && p.GrupoId == mc.Id);

    public static int CivisColetando(Mundo m, Marcha mc) => mc.PessoaIds.Count == 0 ? 0 : Coletores(m, mc).Count();

    /// <summary>Põe os civis na marcha de coleta (continuam morando onde moravam).</summary>
    public static void LevarParaColeta(Mundo m, Marcha mc, IEnumerable<Pessoa> civis)
    {
        foreach (var p in civis)
        {
            p.Estado = Estados.Coletando; p.GrupoId = mc.Id; p.ItemId = null; m.Sujar(p);
            if (!mc.PessoaIds.Contains(p.Id)) mc.PessoaIds.Add(p.Id);
        }
        m.Sujar(mc);
    }

    /// <summary>
    /// O civil sai da coleta no hexágono <paramref name="deHex"/>: vai andando para a vaga mais necessária (ou sem trabalho para o
    /// castelo), como uma pessoa nova. Sem reino ou sem local nenhum, sai do mundo.
    /// </summary>
    public static void VoltarDaColeta(Mundo m, Marcha mc, Pessoa p, int deHex)
    {
        mc.PessoaIds.Remove(p.Id); m.Sujar(mc);
        var r = m.Reinos.Obter(p.ReinoId);
        if (r == null || !r.Ativo) { Remover(m, p); return; }
        p.GrupoId = null; p.Estado = Estados.Ociosa; p.Oficio = Oficios.Ocioso;
        m.Sujar(p);
        var l = MelhorVaga(m, r, p);
        var oficio = l != null ? Oficios.DoLocal(l)! : Oficios.Ocioso;
        if (l == null)
        {
            l = m.Locais.Obter(r.CasteloId);
            if (l == null || l.ReinoId != r.Id || l.Ruina) l = m.LocaisDe(r.Id).FirstOrDefault(x => !x.Ruina);
        }
        if (l == null) { Remover(m, p); return; }
        if (deHex < 0 || deHex == l.Hex) { Ficar(m, p, l, oficio); return; }
        MudarLocal(m, p, l.Id);
        p.Oficio = oficio;
        m.Sujar(p);
        Deslocamento.Partir(m, r, [p], deHex, l);
    }

    /// <summary>Todos os civis da marcha deixam a coleta onde ela está agora.</summary>
    public static void SoltarColetores(Mundo m, Marcha mc)
    {
        var lista = Coletores(m, mc).ToList();
        if (lista.Count == 0) return;
        var h = mc.HexEm(m.Agora);
        foreach (var p in lista) VoltarDaColeta(m, mc, p, h);
        m.Avisar(mc.ReinoId, "reino");
    }
}
