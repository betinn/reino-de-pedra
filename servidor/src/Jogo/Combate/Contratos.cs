using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.Combate;

/// <summary>
/// Contratos compartilhados entre combate e os sistemas que mexem nele (ferraria, veterania, relíquias,
/// lendário, legado, alianças, pactos). Cada sistema registra seus ganchos em AoIniciar (dentro de Sistemas.UmaVez).
/// O combate soma os bônus e aplica o teto (P.tetoBonus) com <c>m.F.BonusCom</c>; torres e portões ficam fora do teto.
/// </summary>
public static class Bonus
{
    /// <summary>Bônus de ataque (fração, ex.: 0,08) de um exército que ataca. Somados e limitados ao teto.</summary>
    public static List<Func<Mundo, Exercito, double>> Ataque { get; } = new();
    /// <summary>Bônus de defesa (fração) de quem defende um local (guarnição + milícia). Somados e limitados ao teto.</summary>
    public static List<Func<Mundo, Local, double>> Defesa { get; } = new();
    /// <summary>Bônus de defesa de um exército em campo (interceptado ou atacado fora de um local).</summary>
    public static List<Func<Mundo, Exercito, double>> DefesaExercito { get; } = new();

    public static double SomaAtaque(Mundo m, Exercito ex) => Ataque.Sum(f => f(m, ex));
    public static double SomaDefesa(Mundo m, Local l) => Defesa.Sum(f => f(m, l));
    public static double SomaDefesaExercito(Mundo m, Exercito ex) => DefesaExercito.Sum(f => f(m, ex));
}

/// <summary>Quem pode atacar quem. Cada gancho devolve o motivo do bloqueio, ou null.</summary>
public static class Permissoes
{
    /// <summary>
    /// Bloqueios conhecidos ANTES de enviar (aliança, pacto, trégua): o jogo recusa o envio.
    /// (atacante, reino alvo) → motivo ou null. O escudo de novato NÃO entra aqui: só é descoberto ao chegar.
    /// </summary>
    public static List<Func<Mundo, Reino, Reino, string?>> AntesDeEnviar { get; } = new();

    /// <summary>Bloqueios descobertos AO CHEGAR (escudo de novato, de exílio, pacto que começou no caminho): as tropas voltam sem combate.</summary>
    public static List<Func<Mundo, Reino, Reino, string?>> AoChegar { get; } = new();

    public static string? MotivoEnvio(Mundo m, Reino atacante, Reino alvo)
    {
        if (atacante.Id == alvo.Id) return "Esse local é seu.";
        foreach (var f in AntesDeEnviar) { var x = f(m, atacante, alvo); if (x != null) return x; }
        return null;
    }
    public static string? MotivoChegada(Mundo m, Reino atacante, Reino alvo)
    {
        foreach (var f in AoChegar) { var x = f(m, atacante, alvo); if (x != null) return x; }
        return null;
    }
}
