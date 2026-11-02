using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Nucleo;

namespace ReinoDePedra.Jogo.Reinos;

/// <summary>
/// Grupos de tropas (id da unidade em <c>U</c> → quantidade): validar, retirar e devolver de uma guarnição,
/// somar, velocidade (a da unidade mais lenta), carga, força contra fauna e população ocupada.
/// Usado por exércitos, caça, extração, escavação, escolta e combate.
/// Dentro de uma <c>Marcha</c>, a propriedade <c>Tropas</c> esconde esta classe: use <c>Reinos.Tropas</c> ou um alias.
/// </summary>
public static class Tropas
{
    /// <summary>Total de tropas do grupo.</summary>
    public static int Total(IReadOnlyDictionary<string, int> g) => g.Values.Where(v => v > 0).Sum();

    /// <summary>Cópia sem as unidades com quantidade zero.</summary>
    public static Dictionary<string, int> Limpo(IReadOnlyDictionary<string, int>? g) =>
        (g ?? new Dictionary<string, int>()).Where(kv => kv.Value > 0).ToDictionary(kv => kv.Key, kv => kv.Value);

    /// <summary>
    /// Confere que o grupo é válido e que a guarnição de <paramref name="l"/> tem essas tropas.
    /// Devolve o grupo limpo (sem zeros). Lança <see cref="RegraException"/> se não puder.
    /// </summary>
    public static Dictionary<string, int> Validar(Mundo m, Local l, IReadOnlyDictionary<string, int>? grupo)
    {
        if (grupo != null && grupo.Values.Any(v => v < 0)) throw new RegraException("Quantidade de tropas inválida.");
        var g = Limpo(grupo);
        if (g.Count == 0) throw new RegraException("Escolha pelo menos uma tropa.");
        foreach (var (k, n) in g)
        {
            if (!m.B.U.TryGetValue(k, out var u)) throw new RegraException("Unidade desconhecida.");
            var tem = Livres(m, l, k);
            if (tem < n) throw new RegraException($"{l.Nome} só tem {tem} {Nome(u, tem)}.");
        }
        return g;
    }

    /// <summary>
    /// Tropas da guarnição que o dono do local não pode usar: (mundo, local, unidade) → quantidade.
    /// O reforço de um aliado fica na guarnição (defende) mas continua dele (a aliança registra aqui).
    /// </summary>
    public static List<Func<Mundo, Local, string, int>> Reservadas { get; } = new();

    /// <summary>Quantas tropas da unidade o dono do local pode usar (guarnição menos as reservadas).</summary>
    public static int Livres(Mundo m, Local l, string unidade) =>
        Math.Max(0, l.Guarnicao.GetValueOrDefault(unidade) - Reservadas.Sum(f => f(m, l, unidade)));

    /// <summary>Guarnição que o dono do local pode usar.</summary>
    public static Dictionary<string, int> GuarnicaoLivre(Mundo m, Local l) =>
        l.Guarnicao.Select(kv => (kv.Key, n: Livres(m, l, kv.Key))).Where(x => x.n > 0).ToDictionary(x => x.Key, x => x.n);

    /// <summary>Valida e tira o grupo da guarnição do local. Devolve o grupo limpo.</summary>
    public static Dictionary<string, int> Retirar(Mundo m, Local l, IReadOnlyDictionary<string, int>? grupo)
    {
        var g = Validar(m, l, grupo);
        foreach (var (k, n) in g)
        {
            var resto = l.Guarnicao.GetValueOrDefault(k) - n;
            if (resto > 0) l.Guarnicao[k] = resto; else l.Guarnicao.Remove(k);
        }
        m.Sujar(l);
        return g;
    }

    /// <summary>Põe o grupo na guarnição do local.</summary>
    public static void Devolver(Mundo m, Local l, IReadOnlyDictionary<string, int> grupo)
    {
        Somar(l.Guarnicao, grupo);
        m.Sujar(l);
    }

    /// <summary>Soma <paramref name="b"/> em <paramref name="a"/>.</summary>
    public static void Somar(Dictionary<string, int> a, IReadOnlyDictionary<string, int> b)
    {
        foreach (var (k, n) in b) if (n > 0) a[k] = a.GetValueOrDefault(k) + n;
    }

    /// <summary>Velocidade do grupo: a da unidade mais lenta ("Lenta", "Média" ou "Rápida").</summary>
    public static string Velocidade(Mundo m, IReadOnlyDictionary<string, int> g)
    {
        string? vel = null;
        foreach (var (k, n) in g)
        {
            if (n <= 0 || !m.B.U.TryGetValue(k, out var u)) continue;
            if (vel == null || m.P.MinPor[u.Vel] > m.P.MinPor[vel]) vel = u.Vel;
        }
        return vel ?? m.P.MinPor.MaxBy(kv => kv.Value).Key;
    }

    /// <summary>Capacidade de carga do grupo (soma de <c>U.carga</c>).</summary>
    public static double Carga(Mundo m, IReadOnlyDictionary<string, int> g) =>
        g.Sum(kv => kv.Value > 0 && m.B.U.TryGetValue(kv.Key, out var u) ? kv.Value * u.Carga : 0);

    /// <summary>Força contra fauna (soma de (ataque + defesa)/2).</summary>
    public static double ForcaFauna(Mundo m, IReadOnlyDictionary<string, int> g) => m.F.ForcaFauna(Limpo(g));

    /// <summary>População que o grupo ocupa no teto.</summary>
    public static int Pop(Mundo m, IReadOnlyDictionary<string, int> g) => Economia.PopDeGrupo(m, Limpo(g));

    // ---------------------------------------------------------------- nomes

    private static readonly Dictionary<string, string> Plurais = new()
    {
        ["cavalaria"] = "cavaleiros", ["elite"] = "cavaleiros de elite", ["ariete"] = "aríetes", ["milicia"] = "milícias",
    };

    /// <summary>Nome da unidade em minúsculas, no singular ou plural conforme <paramref name="n"/>.</summary>
    public static string Nome(Unidade u, int n) => n == 1 ? (u.Id == "cavalaria" ? "cavaleiro" : u.Nome.ToLowerInvariant()) : Plural(u);
    public static string Plural(Unidade u) => Plurais.TryGetValue(u.Id, out var p) ? p : u.Nome.ToLowerInvariant() + "s";

    /// <summary>"10 lanceiros, 4 arqueiros".</summary>
    public static string Partes(Mundo m, IReadOnlyDictionary<string, int> g) =>
        string.Join(", ", Limpo(g).Select(kv => kv.Value + " " + (m.B.U.TryGetValue(kv.Key, out var u) ? Nome(u, kv.Value) : kv.Key)));
}
