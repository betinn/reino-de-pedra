using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.IA;

/// <summary>
/// Nomes de reino plausíveis em português, como os que jogadores escolhem: uma palavra inventada ("Valdora", "Pedralva"),
/// um lugar com qualificativo ("Rocha Alta", "Vale do Corvo") ou um nome composto ("Monte Sereno"). Passam na mesma
/// validação da criação de reino (<see cref="CriacaoReino.MotivoNomeInvalido"/>) e não repetem nomes ativos.
/// </summary>
public static class Nomes
{
    private static readonly string[] Raizes =
        ["Val", "Pedr", "Alt", "Corv", "Mont", "Serr", "Lum", "Fer", "Brum", "Tor", "Ard", "Cald", "Mir", "Ros", "Vel",
         "Sol", "Ram", "Lob", "Aur", "Gal", "Bel", "Cast", "Font", "Mar", "Ner", "Tav", "Vir", "Zar", "Orl", "Riv"];
    private static readonly string[] Finais =
        ["alva", "dora", "ena", "ântia", "ária", "edo", "ino", "ival", "ora", "unda", "eira", "anha", "ardo", "elha", "ira",
         "ona", "ádia", "ezo", "aria", "andra", "ôr", "ete", "ais", "ério"];
    private static readonly string[] Lugares =
        ["Rocha", "Vale", "Monte", "Serra", "Torre", "Ponte", "Campo", "Pedra", "Fonte", "Porto", "Bosque", "Vila", "Penha", "Lagoa", "Colina", "Forte"];
    private static readonly string[] Qualificativos =
        ["Alta", "Negra", "Velha", "Fria", "Sombria", "Dourada", "Branca", "Funda", "Nova", "Serena", "Antiga", "Real", "Bravia", "Clara"];
    private static readonly string[] Complementos =
        ["do Corvo", "dos Lobos", "do Norte", "do Sul", "da Aurora", "do Trovão", "das Brumas", "do Falcão", "da Lua", "dos Reis",
         "de Ferro", "de Prata", "do Carvalho", "das Águas", "do Poente", "da Neve"];

    /// <summary>Concordância simples: lugares masculinos levam o qualificativo no masculino.</summary>
    private static readonly HashSet<string> Masculinos = ["Vale", "Monte", "Campo", "Porto", "Bosque", "Forte"];

    public static string Novo(Mundo m, Rng rng)
    {
        for (var i = 0; i < 200; i++)
        {
            var n = rng.Int(0, 10) switch
            {
                < 4 => rng.Escolher(Raizes) + rng.Escolher(Finais),
                < 7 => Qualificar(rng.Escolher(Lugares), rng.Escolher(Qualificativos)),
                _ => rng.Escolher(Lugares) + " " + rng.Escolher(Complementos),
            };
            n = CriacaoReino.NormalizarNome(n);
            if (CriacaoReino.MotivoNomeInvalido(m, n) == null) return n;
        }
        // muito improvável: todas as combinações tentadas já existem
        for (var k = 0; k < 10000; k++)
        {
            var n = rng.Escolher(Lugares) + " " + rng.Escolher(Complementos);
            var alt = n.Length <= 20 ? n + " " + Romano(2 + k % 9) : rng.Escolher(Raizes) + rng.Escolher(Finais) + " " + Romano(2 + k % 9);
            if (CriacaoReino.MotivoNomeInvalido(m, alt) == null) return alt;
        }
        throw new InvalidOperationException("sem nome livre para um reino de IA");
    }

    private static string Qualificar(string lugar, string q)
    {
        if (!Masculinos.Contains(lugar)) return lugar + " " + q;
        var masc = q switch
        {
            "Alta" => "Alto", "Negra" => "Negro", "Velha" => "Velho", "Fria" => "Frio", "Sombria" => "Sombrio", "Dourada" => "Dourado",
            "Branca" => "Branco", "Funda" => "Fundo", "Nova" => "Novo", "Serena" => "Sereno", "Antiga" => "Antigo", "Bravia" => "Bravio",
            "Clara" => "Claro", _ => q,
        };
        return lugar + " " + masc;
    }

    private static string Romano(int k) => k switch { 2 => "II", 3 => "III", 4 => "IV", 5 => "V", 6 => "VI", 7 => "VII", 8 => "VIII", 9 => "IX", _ => "X" };
}
