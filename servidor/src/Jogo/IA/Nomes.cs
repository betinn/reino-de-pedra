using System.Globalization;
using System.Text;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.IA;

/// <summary>
/// Nomes de reino como os que jogadores escolhem, sem padrão fixo: palavras inventadas por sílabas (não de uma lista de
/// raízes), lugares com qualificativo ou complemento, casas e clãs, substantivos e apelidos, nomes de fantasia em outra
/// língua, às vezes em minúsculas ou sem acento. O código é público: o que impede separar a IA dos jogadores é o espaço
/// de nomes ser grande e cobrir as formas que pessoas usam, não a lista ser secreta. Passam na mesma validação da criação
/// de reino (<see cref="CriacaoReino.MotivoNomeInvalido"/>) e não repetem nomes ativos.
/// </summary>
public static class Nomes
{
    // sílabas: ataque, vogal e, às vezes, coda (fonotática portuguesa simples); no máximo um acento por palavra
    private static readonly string[] Ataques =
        ["b", "c", "d", "f", "g", "l", "m", "n", "p", "r", "s", "t", "v", "z", "br", "cr", "dr", "fr", "gr", "pr", "tr",
         "bl", "cl", "fl", "gl", "pl", "ch", "qu", "gu", "j", "", "", "l", "r", "m", "v", "d", "t"];
    private static readonly string[] Meio = ["lh", "nh", "rr", "ss"];
    private static readonly string[] Vogais = ["a", "e", "i", "o", "u", "a", "e", "o", "a", "e", "ai", "ei", "ou", "ia", "io"];
    private static readonly Dictionary<char, char> Acentos = new() { ['a'] = 'á', ['e'] = 'é', ['i'] = 'í', ['o'] = 'ó', ['u'] = 'ú' };
    private static readonly string[] Codas = ["", "", "", "", "", "r", "l", "s", "n"];
    private static readonly string[] Completar = ["ra", "on", "el", "is"];

    private static readonly string[] Lugares =
        ["Rocha", "Vale", "Monte", "Serra", "Torre", "Ponte", "Campo", "Pedra", "Fonte", "Porto", "Bosque", "Vila", "Penha", "Lagoa", "Colina", "Forte",
         "Ribeira", "Costa", "Ilha", "Cabo", "Planalto", "Várzea", "Gruta", "Mata", "Cidadela", "Muralha", "Fortaleza", "Baía", "Encosta", "Charneca",
         "Atalaia", "Castro", "Quinta", "Vau", "Pico", "Cume", "Terra", "Reino", "Império", "Condado", "Marca", "Domínio", "Principado", "Ducado"];
    private static readonly string[] Qualificativos =
        ["Alta", "Negra", "Velha", "Fria", "Sombria", "Dourada", "Branca", "Funda", "Nova", "Serena", "Antiga", "Real", "Bravia", "Clara",
         "Perdida", "Eterna", "Sagrada", "Escarlate", "Rubra", "Verde", "Gelada", "Ardente", "Oculta", "Livre", "Soberana", "Selvagem", "Profunda", "Distante"];
    private static readonly string[] Complementos =
        ["do Corvo", "dos Lobos", "do Norte", "do Sul", "da Aurora", "do Trovão", "das Brumas", "do Falcão", "da Lua", "dos Reis",
         "de Ferro", "de Prata", "do Carvalho", "das Águas", "do Poente", "da Neve", "do Leste", "do Oeste", "dos Ventos", "da Tempestade",
         "do Sol", "das Estrelas", "do Dragão", "dos Mares", "da Coroa", "do Leão", "das Sombras", "do Abismo", "da Esperança", "do Fim do Mundo",
         "dos Ursos", "das Rosas", "do Javali", "da Serpente", "de Ouro", "de Pedra", "de Cristal", "dos Antigos", "do Silêncio", "da Chama"];
    private static readonly string[] Titulos = ["Casa", "Clã", "Ordem", "Liga", "Irmandade", "Linhagem", "Tribo", "Dinastia", "Legião", "Guarda", "Hoste", "Família"];
    private static readonly string[] Sobrenomes =
        ["Albuquerque", "Almeida", "Andrade", "Barbosa", "Barreto", "Bragança", "Cardoso", "Castro", "Coutinho", "Cunha", "Drummond", "Esteves",
         "Faria", "Ferraz", "Figueira", "Fonseca", "Freitas", "Gama", "Godinho", "Guimarães", "Lacerda", "Leme", "Lobato", "Macedo", "Meireles",
         "Menezes", "Monteiro", "Moraes", "Noronha", "Pacheco", "Paiva", "Peixoto", "Queiroz", "Rangel", "Rezende", "Sampaio", "Siqueira",
         "Soares", "Tavares", "Teixeira", "Valadares", "Varela", "Vasconcelos", "Viana", "Xavier"];
    private static readonly string[] Substantivos =
        ["Aurora", "Tempestade", "Fênix", "Dragão", "Lobo", "Falcão", "Leão", "Corvo", "Serpente", "Trovão", "Relâmpago", "Avalanche",
         "Eclipse", "Horizonte", "Bastião", "Vanguarda", "Sentinela", "Martelo", "Escudo", "Lança", "Espada", "Coroa", "Cetro", "Estandarte",
         "Ventania", "Nevasca", "Brasa", "Cinza", "Granito", "Basalto", "Carvalho", "Cedro", "Urso", "Javali", "Grifo", "Quimera", "Titã",
         "Gigante", "Colosso", "Profecia", "Destino", "Glória", "Honra", "Vingança", "Fúria", "Valor", "Bravura", "Lenda", "Mito", "Saga"];
    private static readonly HashSet<string> Femininos =
        ["Aurora", "Tempestade", "Fênix", "Serpente", "Avalanche", "Ventania", "Nevasca", "Brasa", "Cinza", "Quimera", "Profecia", "Glória",
         "Honra", "Vingança", "Fúria", "Lenda", "Saga", "Coroa", "Lança", "Espada", "Sentinela", "Vanguarda", "Bravura"];
    private static readonly string[] Plurais =
        ["Os Lobos", "Os Corvos", "Os Templários", "Os Bárbaros", "Os Errantes", "Os Filhos do Norte", "As Valquírias", "Os Leões", "Os Imortais", "Os Esquecidos"];
    private static readonly string[] Adjetivos =
        ["Cinzento", "Negro", "Dourado", "Vermelho", "Branco", "Solitário", "Faminto", "Antigo", "Eterno", "Sombrio", "Feroz", "Valente",
         "Bravo", "Real", "Selvagem", "Errante", "Gelado", "Ardente", "Invicto", "Implacável"];
    // fantasia em outra língua (jogadores também escolhem assim)
    private static readonly string[] PrefixosEn = ["Iron", "Black", "Storm", "Stone", "Raven", "Wolf", "Frost", "Shadow", "Silver", "Gold", "Red", "Dragon", "Oak", "Ash", "Winter", "Thorn", "Moon", "Sun"];
    private static readonly string[] SufixosEn = ["hold", "wood", "fall", "gard", "keep", "vale", "crest", "helm", "spire", "moor", "ford", "haven", "rock", "watch", "fell", "mark"];
    private static readonly string[] Latim = ["Aeterna", "Invicta", "Imperium", "Fortis", "Lux", "Nox", "Aquila", "Ignis", "Terra Nova", "Pax", "Gloria", "Fidelis", "Vox", "Regnum"];

    /// <summary>Concordância simples: lugares masculinos levam o qualificativo no masculino.</summary>
    private static readonly HashSet<string> Masculinos =
        ["Vale", "Monte", "Campo", "Porto", "Bosque", "Forte", "Cabo", "Planalto", "Castro", "Vau", "Pico", "Cume", "Reino", "Império",
         "Condado", "Domínio", "Principado", "Ducado"];

    private static readonly string[] TitulosAlianca = ["Liga", "Pacto", "Irmandade", "Ordem", "Círculo", "Coroa", "Guarda", "Concílio", "Aliança", "Mesa", "Juramento"];

    /// <summary>Nome de aliança como os que jogadores dão: "Liga do Corvo", "Pacto de Ferro", "Irmandade Negra". Cabe no limite do nome de aliança.</summary>
    public static string Alianca(Rng rng)
    {
        for (var i = 0; i < 40; i++)
        {
            var t = rng.Escolher(TitulosAlianca);
            var n = rng.Chance(0.75) ? t + " " + rng.Escolher(Complementos) : t + " " + rng.Escolher(Qualificativos);
            if (n.Length <= 24) return n;
        }
        return "Liga do Norte";
    }

    public static string Novo(Mundo m, Rng rng)
    {
        for (var i = 0; i < 200; i++)
        {
            var n = CriacaoReino.NormalizarNome(Variar(Forma(rng), rng));
            if (CriacaoReino.MotivoNomeInvalido(m, n) == null) return n;
        }
        // muito improvável: tudo o que se tentou já existe
        for (var k = 0; k < 10000; k++)
        {
            var alt = CriacaoReino.NormalizarNome(Inventado(rng, 2, 4) + " " + Romano(2 + k % 9));
            if (CriacaoReino.MotivoNomeInvalido(m, alt) == null) return alt;
        }
        throw new InvalidOperationException("sem nome livre para um reino de IA");
    }

    private static string Forma(Rng rng) => rng.Int(0, 100) switch
    {
        < 24 => Inventado(rng, 2, 4),                                                 // "Taruvel"
        < 30 => Inventado(rng, 1, 3) + " " + Inventado(rng, 2, 3),                    // "Kar Ombrisa"
        < 40 => Qualificar(rng.Escolher(Lugares), rng.Escolher(Qualificativos)),      // "Rocha Alta"
        < 50 => rng.Escolher(Lugares) + " " + rng.Escolher(Complementos),             // "Vale do Corvo"
        < 54 => rng.Escolher(Lugares) + " de " + Inventado(rng, 2, 3),                // "Condado de Mirel"
        < 62 => rng.Escolher(Titulos) + " " + (rng.Chance(0.6) ? rng.Escolher(Sobrenomes) : Inventado(rng, 2, 3)),   // "Casa Varela"
        < 69 => rng.Escolher(Substantivos),                                           // "Aurora"
        < 76 => Adjetivar(rng.Escolher(Substantivos), rng.Escolher(Adjetivos)),       // "Lobo Cinzento"
        < 80 => rng.Escolher(Substantivos) + " " + rng.Escolher(Complementos),        // "Fênix do Norte"
        < 84 => rng.Escolher(Plurais),                                                 // "Os Lobos"
        < 90 => rng.Escolher(PrefixosEn) + rng.Escolher(SufixosEn),                   // "Ironhold"
        < 93 => rng.Escolher(Latim),                                                   // "Aeterna"
        < 97 => rng.Escolher(Sobrenomes) + (rng.Chance(0.5) ? " " + rng.Escolher(Complementos) : ""),   // "Meireles do Sul"
        _ => Inventado(rng, 2, 3) + " " + Romano(2 + rng.Int(0, 4)),                  // "Valdor II"
    };

    /// <summary>Como pessoas digitam: às vezes sem acento, às vezes tudo em minúsculas.</summary>
    private static string Variar(string n, Rng rng)
    {
        if (rng.Chance(0.12)) n = SemAcento(n);
        if (rng.Chance(0.10)) n = n.ToLowerInvariant();
        return n;
    }

    /// <summary>Palavra inventada de <paramref name="min"/> a <paramref name="max"/> sílabas, capitalizada.</summary>
    private static string Inventado(Rng rng, int min, int max)
    {
        var n = rng.Int(min, max + 1);
        var acento = rng.Chance(0.3) ? rng.Int(0, n) : -1;
        var sb = new StringBuilder();
        for (var i = 0; i < n && sb.Length < 7; i++)   // palavras curtas, sem cortar no meio da sílaba
        {
            if (sb.Length >= 5) n = i + 1;
            sb.Append(i > 0 && rng.Chance(0.12) ? rng.Escolher(Meio) : rng.Escolher(Ataques));
            var v = rng.Escolher(Vogais);
            if (i == acento && Acentos.TryGetValue(v[0], out var ac)) v = ac + v[1..];
            sb.Append(v);
            if (i == n - 1 ? rng.Chance(0.6) : rng.Chance(0.2)) sb.Append(rng.Escolher(Codas));
        }
        var s = sb.ToString();
        if (s.Length < 3) s += rng.Escolher(Completar);
        return char.ToUpperInvariant(s[0]) + s[1..];
    }

    private static string Qualificar(string lugar, string q) => lugar + " " + (Masculinos.Contains(lugar) ? Masculino(q) : q);
    private static string Adjetivar(string subst, string adj) => subst + " " + (Femininos.Contains(subst) ? Feminino(adj) : adj);

    private static string Masculino(string q) => q switch
    {
        "Alta" => "Alto", "Negra" => "Negro", "Velha" => "Velho", "Fria" => "Frio", "Sombria" => "Sombrio", "Dourada" => "Dourado",
        "Branca" => "Branco", "Funda" => "Fundo", "Nova" => "Novo", "Serena" => "Sereno", "Antiga" => "Antigo", "Bravia" => "Bravio",
        "Clara" => "Claro", "Perdida" => "Perdido", "Eterna" => "Eterno", "Sagrada" => "Sagrado", "Rubra" => "Rubro", "Gelada" => "Gelado",
        "Oculta" => "Oculto", "Soberana" => "Soberano", "Profunda" => "Profundo", _ => q,
    };

    private static string Feminino(string a) => a switch
    {
        "Cinzento" => "Cinzenta", "Negro" => "Negra", "Dourado" => "Dourada", "Vermelho" => "Vermelha", "Branco" => "Branca",
        "Solitário" => "Solitária", "Faminto" => "Faminta", "Antigo" => "Antiga", "Eterno" => "Eterna", "Sombrio" => "Sombria",
        "Bravo" => "Brava", "Gelado" => "Gelada", "Invicto" => "Invicta", _ => a,
    };

    private static string SemAcento(string s)
    {
        var sb = new StringBuilder(s.Length);
        foreach (var ch in s.Normalize(NormalizationForm.FormD))
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark) sb.Append(ch);
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }

    private static string Romano(int k) => k switch { 2 => "II", 3 => "III", 4 => "IV", 5 => "V", 6 => "VI", 7 => "VII", 8 => "VIII", 9 => "IX", _ => "X" };
}
