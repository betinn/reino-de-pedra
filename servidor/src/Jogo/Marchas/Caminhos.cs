using ReinoDePedra.Jogo.Mapa;
using ReinoDePedra.Jogo.Nucleo;

namespace ReinoDePedra.Jogo.Marchas;

/// <summary>Caminho calculado: hexágonos e minutos acumulados até cada um (Minutos[0] = 0).</summary>
public sealed record Rota(IReadOnlyList<int> Hexes, IReadOnlyList<double> Minutos)
{
    public double TotalMin => Minutos.Count > 0 ? Minutos[^1] : 0;
    public static Rota Parada(int h) => new([h], [0]);
}

/// <summary>Opções de deslocamento. <see cref="Seguro"/> evita regiões de fauna (rota longa e segura).</summary>
public sealed record OpcoesCaminho
{
    public bool Seguro { get; init; }
    /// <summary>Força do grupo contra fauna (para pesar o risco na rota segura).</summary>
    public double Forca { get; init; }
    /// <summary>Ajuste do fator de terreno por tipo de grupo (ex.: explorador a pé sem penalidade na floresta).</summary>
    public Func<Terreno, double, double>? AjusteTerreno { get; init; }
    /// <summary>Reino que viaja: a rota segura evita a fauna que ESTE reino conhece (0 = a real).</summary>
    public long ReinoId { get; init; }
    public static readonly OpcoesCaminho Padrao = new();
}

/// <summary>
/// Deslocamento: minutos para entrar num hexágono = fator do terreno (vau no rio sem ponte)
/// × fator de rota (0,55) × minutos por velocidade. Com fatores médios (1,35) isso reproduz
/// <c>viagemMin</c> do modelo. Dijkstra sobre a grade (2.880 hexágonos): custa microssegundos.
/// </summary>
public static class Caminhos
{
    /// <summary>Custos extras por hexágono para a rota segura (o sistema de fauna registra aqui).</summary>
    public static List<Func<Mundo, int, OpcoesCaminho, double>> CustosExtras { get; } = new();

    public static double MinutosEntrar(Mundo m, int h, string vel, OpcoesCaminho op)
    {
        var vias = m.Vias;
        var ponte = vias.Pontes.Contains(h);
        var f = m.Mapa.FatorTerreno(m.P, h, ponte);
        if (op.AjusteTerreno != null) f = op.AjusteTerreno(m.Mapa.Terrenos[h], f);
        var rota = vias.Rotas.Contains(h) && (!m.Mapa.Rio[h] || ponte);
        return f * (rota ? m.P.RotaFator : 1) * m.P.MinPor[vel];
    }

    private static double Peso(Mundo m, int h, string vel, OpcoesCaminho op)
    {
        var c = MinutosEntrar(m, h, vel, op);
        if (op.Seguro) foreach (var f in CustosExtras) c += f(m, h, op);
        return c;
    }

    /// <summary>Melhor caminho de <paramref name="origem"/> a <paramref name="destino"/> (A*).</summary>
    public static Rota Calcular(Mundo m, int origem, int destino, string vel, OpcoesCaminho? op = null)
    {
        op ??= OpcoesCaminho.Padrao;
        if (origem == destino) return Rota.Parada(origem);
        var g = m.G;
        var n = g.Total;
        var dist = new double[n]; Array.Fill(dist, double.PositiveInfinity);
        var ant = new int[n]; Array.Fill(ant, -1);
        var fila = new PriorityQueue<int, double>();
        var minFator = Math.Min(m.P.RotaFator, 1) * m.P.MinPor[vel] * m.P.Terreno.Values.Min();
        dist[origem] = 0; fila.Enqueue(origem, 0);
        while (fila.TryDequeue(out var u, out _))
        {
            if (u == destino) break;
            foreach (var v in g.Vizinhos(u))
            {
                var d = dist[u] + Peso(m, v, vel, op);
                if (d < dist[v]) { dist[v] = d; ant[v] = u; fila.Enqueue(v, d + g.Distancia(v, destino) * minFator); }
            }
        }
        if (ant[destino] < 0) return Rota.Parada(origem);
        var hexes = new List<int>();
        for (var h = destino; h != -1; h = ant[h]) hexes.Add(h);
        hexes.Reverse();
        var mins = new List<double>(hexes.Count) { 0 };
        for (var i = 1; i < hexes.Count; i++) mins.Add(mins[^1] + MinutosEntrar(m, hexes[i], vel, op));
        return new Rota(hexes, mins);
    }

    /// <summary>Minutos de cada hexágono até <paramref name="destino"/> (Dijkstra reverso), para escolher origens próximas.</summary>
    public static double[] MinutosAte(Mundo m, int destino, string vel, OpcoesCaminho? op = null)
    {
        op ??= OpcoesCaminho.Padrao;
        var g = m.G;
        var dist = new double[g.Total]; Array.Fill(dist, double.PositiveInfinity);
        var fila = new PriorityQueue<int, double>();
        dist[destino] = 0; fila.Enqueue(destino, 0);
        while (fila.TryDequeue(out var v, out var dv))
        {
            if (dv > dist[v]) continue;
            var custoV = Peso(m, v, vel, op);       // u → v custa entrar em v
            foreach (var u in g.Vizinhos(v))
            {
                var d = dv + custoV;
                if (d < dist[u]) { dist[u] = d; fila.Enqueue(u, d); }
            }
        }
        return dist;
    }
}
