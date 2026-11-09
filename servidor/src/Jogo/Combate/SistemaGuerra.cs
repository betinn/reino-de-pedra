using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;

namespace ReinoDePedra.Jogo.Combate;

/// <summary>
/// Combate, parte 2: feridos, veterania, queda do castelo e exílio, interceptação, posturas automáticas, modelos de ataque e
/// avistamentos. Registra os ganchos na subida do servidor.
/// </summary>
[Sistema]
public static class SistemaGuerra
{
    public static void AoIniciar(Mundo m) => Sistemas.UmaVez("guerra", () =>
    {
        Feridos.Registrar();
        Veterania.Registrar();
        Quedas.Registrar();
        Marcha.AoPartir.Add(Vigias.AoPartir);
        Marcha.AoPartir.Add(ModelosAtaque.AoPartir);
    });

    /// <summary>Fim de uma batalha num local, antes de as tropas voltarem (chamado por <see cref="Batalhas.Encerrar"/>).</summary>
    internal static void AposBatalha(Mundo m, Batalha b, Batalhas.Composicao c, ResultadoCombate rc, Dictionary<string, int> perdasDef)
    {
        Veterania.AposBatalha(m, c, rc, perdasDef);
        Revide.Registrar(m, b.DefensorId, b.AtacanteId);
    }
}
