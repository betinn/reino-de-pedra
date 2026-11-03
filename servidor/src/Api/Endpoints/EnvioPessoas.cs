using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using PS = ReinoDePedra.Jogo.Pessoas.Pessoas;

namespace ReinoDePedra.Api.Endpoints;

/// <summary>
/// Os envios aceitam <c>pessoas: [ids]</c> além de <c>tropas: {unidade: n}</c>. Com ids, as pessoas são conferidas e marcadas
/// como escolhidas (saem antes das outras) e a contagem por unidade segue pelo caminho de sempre; descarte a escolha ao fim
/// (quem não saiu volta ao normal).
/// </summary>
internal static class EnvioPessoas
{
    public static (Dictionary<string, int>? tropas, PS.Escolha? escolha) Ler(Mundo m, Reino r, long localId, IReadOnlyList<long>? pessoas, Dictionary<string, int>? tropas)
    {
        if (pessoas == null || pessoas.Count == 0) return (tropas, null);
        var l = m.Locais.Obter(localId);
        if (l == null || l.ReinoId != r.Id) throw new RegraException("Local não é seu.", 404);
        var esc = PS.Escolher(m, r, l, pessoas);
        var g = new Dictionary<string, int>(esc.Grupo);
        if (tropas != null) foreach (var (k, n) in tropas) if (n > 0) g[k] = g.GetValueOrDefault(k) + n;   // ids e contagens se somam
        return (g, esc);
    }
}
