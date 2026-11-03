using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.Pessoas;

/// <summary>
/// Nomes medievais em português, sorteados pela semente do mundo (determinístico por reino e ordem de nascimento),
/// sem repetir entre as pessoas vivas do reino. Esgotada a lista, o nome ganha um numeral ("Inês II").
/// </summary>
public static class NomesDePessoa
{
    public static readonly string[] Masculinos =
    [
        "Afonso", "Álvaro", "Bento", "Bernardo", "Brás", "Diogo", "Domingos", "Duarte", "Egas", "Estêvão", "Fernão", "Garcia", "Gil",
        "Gomes", "Gonçalo", "Henrique", "João", "Lopo", "Lourenço", "Martim", "Mendo", "Nuno", "Paio", "Pedro", "Pero", "Rodrigo",
        "Rui", "Sancho", "Simão", "Soeiro", "Tomé", "Vasco", "Vicente", "Aires", "Antão", "Bartolomeu", "Cristóvão", "Francisco",
        "Gaspar", "Gregório", "Jorge", "Luís", "Manuel", "Mateus", "Miguel", "Rafael", "Sebastião", "Tristão", "Ximeno", "Zacarias",
    ];
    public static readonly string[] Femininos =
    [
        "Aldonça", "Beatriz", "Branca", "Catarina", "Constança", "Dórdia", "Elvira", "Guiomar", "Inês", "Isabel", "Joana", "Leonor",
        "Lúcia", "Margarida", "Maria", "Marinha", "Mécia", "Mor", "Sancha", "Teresa", "Urraca", "Violante", "Aldara", "Brites",
        "Cecília", "Filipa", "Mafalda", "Ouroana", "Senhorinha", "Mariana", "Clara", "Luzia", "Ana", "Antónia", "Bárbara", "Helena",
        "Justa", "Madalena", "Micaela", "Paula", "Rosa", "Susana", "Vitória", "Elena", "Froila", "Gontinha", "Orraca", "Toda", "Ximena",
    ];

    private static readonly string[] Numerais = ["", " II", " III", " IV", " V", " VI", " VII", " VIII", " IX", " X"];

    /// <summary>Sorteia gênero e nome para uma pessoa nova do reino (os nomes das pessoas vivas não se repetem).</summary>
    public static (string nome, bool feminina) Sortear(Mundo m, Reino r)
    {
        var rng = new Rng(Rng.Hash(m.Estado.Semente ^ 0x5045535341UL, (ulong)r.Id, (ulong)(r.NomesSorteados++)));
        m.Sujar(r);
        var feminina = rng.Chance(0.5);
        var lista = feminina ? Femininos : Masculinos;
        var usados = m.PessoasDe(r.Id).Select(p => p.Nome).ToHashSet();
        var inicio = rng.Int(0, lista.Length);
        foreach (var num in Numerais)
            for (var i = 0; i < lista.Length; i++)
            {
                var n = lista[(inicio + i) % lista.Length] + num;
                if (!usados.Contains(n)) return (n, feminina);
            }
        return (lista[inicio] + " " + (usados.Count + 1), feminina);
    }
}
