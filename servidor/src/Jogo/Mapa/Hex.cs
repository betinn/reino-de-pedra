namespace ReinoDePedra.Jogo.Mapa;

/// <summary>
/// Geometria hexagonal "pointy-top", coordenadas offset odd-r (col, lin), igual a <c>prototipo/js/hex.js</c>.
/// Um hexágono é identificado por um índice inteiro <c>lin * cols + col</c>.
/// </summary>
public sealed class Grade(int cols, int lins)
{
    public int Cols { get; } = cols;
    public int Lins { get; } = lins;
    public int Total => Cols * Lins;

    public int Indice(int c, int l) => l * Cols + c;
    public int C(int h) => h % Cols;
    public int L(int h) => h / Cols;
    public bool Dentro(int c, int l) => c >= 0 && l >= 0 && c < Cols && l < Lins;
    public bool Valido(int h) => h >= 0 && h < Total;

    private static readonly (int dc, int dl)[] ParPar = [(1, 0), (0, -1), (-1, -1), (-1, 0), (-1, 1), (0, 1)];
    private static readonly (int dc, int dl)[] ParImpar = [(1, 0), (1, -1), (0, -1), (-1, 0), (0, 1), (1, 1)];

    public IEnumerable<int> Vizinhos(int h)
    {
        int c = C(h), l = L(h);
        var d = (l & 1) == 0 ? ParPar : ParImpar;
        foreach (var (dc, dl) in d)
        {
            int nc = c + dc, nl = l + dl;
            if (Dentro(nc, nl)) yield return Indice(nc, nl);
        }
    }

    public static (int x, int y, int z) Cubo(int c, int l)
    {
        var x = c - (l - (l & 1)) / 2;
        return (x, -x - l, l);
    }
    public int Distancia(int a, int b)
    {
        var (ax, ay, az) = Cubo(C(a), L(a));
        var (bx, by, bz) = Cubo(C(b), L(b));
        return Math.Max(Math.Abs(ax - bx), Math.Max(Math.Abs(ay - by), Math.Abs(az - bz)));
    }
    /// <summary>Todos os hexágonos a até <paramref name="raio"/> de <paramref name="h"/> (inclui h).</summary>
    public IEnumerable<int> Area(int h, int raio)
    {
        int c = C(h), l = L(h);
        for (var nl = Math.Max(0, l - raio); nl <= Math.Min(Lins - 1, l + raio); nl++)
            for (var nc = Math.Max(0, c - raio - 1); nc <= Math.Min(Cols - 1, c + raio + 1); nc++)
            {
                var i = Indice(nc, nl);
                if (Distancia(h, i) <= raio) yield return i;
            }
    }
    /// <summary>Direção aproximada de <paramref name="de"/> para <paramref name="para"/>: "norte", "nordeste"...</summary>
    public string Direcao(int de, int para)
    {
        double dx = (C(para) + 0.5 * (L(para) & 1)) - (C(de) + 0.5 * (L(de) & 1));
        double dy = (L(para) - L(de)) * 0.866;
        if (Math.Abs(dx) < 1e-9 && Math.Abs(dy) < 1e-9) return "aqui";
        var ang = Math.Atan2(-dy, dx) * 180 / Math.PI; // 0 = leste, 90 = norte
        string[] nomes = ["leste", "nordeste", "norte", "noroeste", "oeste", "sudoeste", "sul", "sudeste"];
        var i = (int)Math.Round(((ang + 360) % 360) / 45) % 8;
        return nomes[i];
    }
}

public enum Terreno : byte { Planicie, Floresta, Colina, Montanha, Pantano }

public static class TerrenoExt
{
    /// <summary>Chave usada em <c>P.terreno</c> e na API.</summary>
    public static string Chave(this Terreno t) => t switch
    {
        Terreno.Planicie => "planicie", Terreno.Floresta => "floresta", Terreno.Colina => "colina",
        Terreno.Montanha => "montanha", _ => "pantano",
    };
    /// <summary>Letra usada no mapa compacto enviado ao cliente.</summary>
    public static char Letra(this Terreno t) => t switch
    {
        Terreno.Planicie => 'p', Terreno.Floresta => 'f', Terreno.Colina => 'c', Terreno.Montanha => 'm', _ => 'b',
    };
}
