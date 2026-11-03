using System.Text.Json.Serialization;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.Pessoas;

/// <summary>
/// Uma pessoa do reino: nome, ofício, onde está e o que faz. A população civil do reino é a contagem das pessoas civis
/// (<see cref="Reino.Pop"/> é mantido por <see cref="Pessoas"/>); soldados, exploradores e mensageiros são pessoas com
/// o ofício da unidade. Índices por reino e por local ficam no <see cref="Mundo"/>.
/// </summary>
public sealed class Pessoa : Documento
{
    public long ReinoId { get; set; }
    public string Nome { get; set; } = "";
    public bool Feminina { get; set; }
    /// <summary>Ofício (<see cref="Oficios"/>): civil, unidade, explorador ou mensageiro.</summary>
    public string Oficio { get; set; } = Oficios.Ocioso;
    /// <summary>Local onde trabalha, mora ou está guarnecida (null só enquanto não tem casa).</summary>
    public long? LocalId { get; set; }
    /// <summary>Marcha em que está (andando, carregando, em exército...), ou null.</summary>
    public long? GrupoId { get; set; }
    /// <summary>O que está fazendo (<see cref="Estados"/>).</summary>
    public string Estado { get; set; } = Estados.Ociosa;
    /// <summary>Marcas de veterania (soldados).</summary>
    public double Marcas { get; set; }
    public long NasceuEm { get; set; }
    /// <summary>Ofício civil antes do treino: cancelar o recrutamento devolve a pessoa a ele.</summary>
    public string? OficioAnterior { get; set; }
    /// <summary>Item da fila que a treina (recrutamento, explorador, mensageiro), enquanto treina.</summary>
    public long? ItemId { get; set; }

    [JsonIgnore] public bool EhCivil => Oficios.EhCivil(Oficio);
    /// <summary>Civil presente no local (trabalhando ou sem trabalho): conta como milícia e pode ser levada.</summary>
    [JsonIgnore] public bool Presente => EhCivil && Estado is Estados.Trabalhando or Estados.Ociosa;
}

/// <summary>Ofícios. Os civis vêm do tipo de local; os outros são a unidade, o tipo de explorador ou mensageiro.</summary>
public static class Oficios
{
    public const string Ocioso = "ocioso", Agricultor = "agricultor", Lenhador = "lenhador", Pedreiro = "pedreiro", Mineiro = "mineiro";
    public const string Mensageiro = "mensageiro";
    public static readonly string[] Civis = [Ocioso, Agricultor, Lenhador, Pedreiro, Mineiro];
    public static bool EhCivil(string oficio) => Array.IndexOf(Civis, oficio) >= 0;

    /// <summary>Ofício de quem trabalha num local de produção; null para locais sem vagas (castelo, quartel, armazém, ferraria, posto).</summary>
    public static string? DoLocal(Local l) => l.Ruina ? null : l.Tipo switch
    {
        TipoLocal.Vila or TipoLocal.Pasto => Agricultor,
        TipoLocal.Serraria => Lenhador,
        TipoLocal.Mina => l.Produz == "pedra" ? Pedreiro : Mineiro,
        _ => null,
    };

    /// <summary>Ofício de um explorador pelo tipo ("pe", "cavalo", "prospector", "batedor").</summary>
    public static string DeExplorador(string tipo) => tipo is "pe" or "cavalo" ? "explorador-" + tipo : tipo;

    private static readonly Dictionary<string, (string m, string f)> Nomes = new()
    {
        [Ocioso] = ("Sem ofício", "Sem ofício"), [Agricultor] = ("Agricultor", "Agricultora"), [Lenhador] = ("Lenhador", "Lenhadora"),
        [Pedreiro] = ("Pedreiro", "Pedreira"), [Mineiro] = ("Mineiro", "Mineira"), [Mensageiro] = ("Mensageiro", "Mensageira"),
        ["milicia"] = ("Miliciano", "Miliciana"), ["lanceiro"] = ("Lanceiro", "Lanceira"), ["arqueiro"] = ("Arqueiro", "Arqueira"),
        ["cavalaria"] = ("Cavaleiro", "Cavaleira"), ["elite"] = ("Cavaleiro de elite", "Cavaleira de elite"),
        ["ariete"] = ("Operador de cerco", "Operadora de cerco"), ["trebuchet"] = ("Operador de cerco", "Operadora de cerco"),
        ["explorador-pe"] = ("Explorador", "Exploradora"), ["explorador-cavalo"] = ("Explorador a cavalo", "Exploradora a cavalo"),
        ["prospector"] = ("Prospector", "Prospectora"), ["batedor"] = ("Batedor", "Batedora"),
    };

    /// <summary>Nome do ofício no gênero da pessoa ("Lenhadora"). Quem carrega sem ofício é "Carregador".</summary>
    public static string Nome(Pessoa p)
    {
        if (p.Oficio == Ocioso && p.Estado == Estados.Carregando) return p.Feminina ? "Carregadora" : "Carregador";
        return Nomes.TryGetValue(p.Oficio, out var n) ? (p.Feminina ? n.f : n.m) : p.Oficio;
    }

    /// <summary>Verbo do trabalho ("Cortando madeira").</summary>
    public static string Verbo(string oficio) => oficio switch
    {
        Agricultor => "Cultivando comida", Lenhador => "Cortando madeira", Pedreiro => "Lavrando pedra", Mineiro => "Extraindo ferro", _ => "Trabalhando",
    };
}

public static class Estados
{
    public const string Trabalhando = "trabalhando", Ociosa = "ociosa", Andando = "andando", Carregando = "carregando", Treinando = "treinando";
    public const string Guarnecida = "guarnecida", Marchando = "marchando", Ferida = "ferida", Capturada = "capturada";
}
