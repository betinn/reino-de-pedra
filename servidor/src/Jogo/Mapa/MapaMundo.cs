using ReinoDePedra.Jogo.Config;

namespace ReinoDePedra.Jogo.Mapa;

/// <summary>
/// Terreno do mundo: fixo na temporada e regenerado da semente a cada início do processo (não vai para o banco).
/// O que muda no mapa (rotas, pontes, jazidas, ruínas, fauna) vive em documentos.
/// </summary>
public sealed class MapaMundo
{
    public Grade G { get; }
    public Terreno[] Terrenos { get; }
    public bool[] Rio { get; }
    public float[] Altura { get; }
    /// <summary>Vagas de reino (castelo e os 4 locais iniciais), na ordem de ocupação.</summary>
    public List<Vaga> Vagas { get; } = new();

    public MapaMundo(int cols, int lins)
    {
        G = new Grade(cols, lins);
        Terrenos = new Terreno[G.Total];
        Rio = new bool[G.Total];
        Altura = new float[G.Total];
    }

    public Terreno Terreno(int h) => Terrenos[h];

    /// <summary>Fator de custo de terreno para entrar no hexágono (P.terreno), com o vau no rio sem ponte.</summary>
    public double FatorTerreno(ParametrosP p, int h, bool ponte)
    {
        var f = p.Terreno[Terrenos[h].Chave()];
        if (Rio[h] && !ponte) f *= p.Rio.Vau;
        return f;
    }

    /// <summary>Terreno compacto: uma letra por hexágono (p, f, c, m, b = pântano); maiúscula = rio.</summary>
    public string Compacto()
    {
        var ch = new char[G.Total];
        for (var i = 0; i < G.Total; i++)
        {
            var c = Terrenos[i].Letra();
            ch[i] = Rio[i] ? char.ToUpperInvariant(c) : c;
        }
        return new string(ch);
    }
}

/// <summary>Lugar de um reino no mapa: o castelo e os hexágonos dos 4 locais iniciais (comida, madeira, pedra, ferro).</summary>
public sealed record Vaga(int Indice, int Castelo, int Comida, int Madeira, int Pedra, int Ferro);
