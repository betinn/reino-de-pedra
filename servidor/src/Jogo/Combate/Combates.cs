using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.Combate;

/// <summary>
/// Ganchos do combate para os sistemas das próximas ondas (queda do castelo, feridos, veterania, ranking, legado)
/// e ajudantes compartilhados: população "do local" (milícia e massacre) e divisão de perdas entre unidades.
/// </summary>
public static class Combates
{
    /// <summary>
    /// Cerco vitorioso: o castelo caiu. (mundo, reino que perdeu o castelo, exército vencedor, castelo).
    /// A parte 2 do combate implementa a queda (sede nova, perdas, exílio).
    /// </summary>
    public static List<Action<Mundo, Reino, Exercito, Local>> AoCairCastelo { get; } = new();

    /// <summary>Batalha encerrada (veterania, ranking da temporada, legado "venceu um cerco").</summary>
    public static List<Action<Mundo, ResultadoCombate>> AoTerminar { get; } = new();

    /// <summary>
    /// Feridos de um lado (P.feridos.frac das baixas de quem vence ou recua): (mundo, reino, unidades, local onde ficam).
    /// O sistema de feridos registra aqui. Sem ninguém registrado, não há feridos: as baixas são todas mortes.
    /// </summary>
    public static List<Action<Mundo, Reino, Dictionary<string, int>, Local?>> AoFerir { get; } = new();

    /// <summary>
    /// Peso de um local na divisão da população civil do reino: onde há moradia (castelo e moradias) e onde há trabalho
    /// (trabalhadores de um local de produção). Ruínas não abrigam ninguém.
    /// </summary>
    public static double PesoPopulacao(Mundo m, Local l)
    {
        if (l.Ruina) return 0;
        double p = l.Moradias * m.P.TetoPorMoradia;
        if (l.Tipo == TipoLocal.Castelo) p += m.P.TetoCastelo;
        if (l.EhProducao) p += m.F.Trabalhadores(l.Nivel);
        return p;
    }

    /// <summary>População civil "do local": a do reino dividida pelos pesos (base da milícia e do massacre).</summary>
    public static double PopDoLocal(Mundo m, Reino r, Local l)
    {
        if (l.ReinoId != r.Id) return 0;
        var total = m.LocaisDe(r.Id).Sum(x => PesoPopulacao(m, x));
        return total > 0 ? Math.Max(0, r.Pop) * PesoPopulacao(m, l) / total : 0;
    }

    /// <summary>
    /// Divide uma fração de perdas entre as unidades do grupo, proporcionalmente (maior resto): o total é a fração do total
    /// arredondada, e ninguém perde mais do que tem. Fração 1 = todos.
    /// </summary>
    public static Dictionary<string, int> Perdas(IReadOnlyDictionary<string, int> g, double fracao)
    {
        var limpo = Reinos.Tropas.Limpo(g);
        var res = limpo.ToDictionary(kv => kv.Key, _ => 0);
        if (fracao <= 0 || limpo.Count == 0) return Reinos.Tropas.Limpo(res);
        fracao = Math.Min(1, fracao);
        var total = (int)Formulas.ArredJs(limpo.Values.Sum() * fracao);
        var restos = new List<(string k, double resto)>();
        var soma = 0;
        foreach (var (k, n) in limpo)
        {
            var exato = n * fracao;
            var b = (int)Math.Floor(exato);
            res[k] = b; soma += b;
            restos.Add((k, exato - b));
        }
        foreach (var (k, _) in restos.OrderByDescending(x => x.resto).ThenBy(x => x.k, StringComparer.Ordinal))
        {
            if (soma >= total) break;
            if (res[k] < limpo[k]) { res[k]++; soma++; }
        }
        return Reinos.Tropas.Limpo(res);
    }

    /// <summary>Tira do grupo as perdas (sem deixar negativo).</summary>
    public static void Tirar(Dictionary<string, int> g, IReadOnlyDictionary<string, int> perdas)
    {
        foreach (var (k, n) in perdas)
        {
            var resto = g.GetValueOrDefault(k) - n;
            if (resto > 0) g[k] = resto; else g.Remove(k);
        }
    }

    /// <summary>Número inteiro com ponto de milhar, como no cliente ("12.500"). Independe da cultura do processo.</summary>
    public static string Num(double v) =>
        ((long)Math.Floor(v)).ToString("N0", System.Globalization.CultureInfo.InvariantCulture).Replace(',', '.');

    /// <summary>Feridos entre as baixas (P.feridos.frac, por unidade). Vazio se nenhum sistema cuida de feridos.</summary>
    public static Dictionary<string, int> Feridos(Mundo m, IReadOnlyDictionary<string, int> perdas) =>
        AoFerir.Count == 0 ? new() : Perdas(perdas, m.P.Feridos.Frac);
}

/// <summary>Resultado de uma batalha para os ganchos (sem identidade para o cliente: isto fica no servidor).</summary>
public sealed record ResultadoCombate(
    long BatalhaId, long LocalId, long AtacanteId, long DefensorId, string Tipo, string Resultado,
    double Ataque, double Defesa,
    IReadOnlyDictionary<string, int> TropasAtaque, IReadOnlyDictionary<string, int> TropasDefesa,
    IReadOnlyDictionary<string, int> PerdasAtaque, IReadOnlyDictionary<string, int> PerdasDefesa,
    double MiliciaMorta)
{
    /// <summary>O atacante venceu (inclui o recuo da defesa).</summary>
    public bool AtacanteVenceu => Resultado is "vitoria" or "defesa-recuou";
}
