using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Mapa;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;

namespace ReinoDePedra.Testes;

/// <summary>
/// As buscas de caminho usam a memória de trabalho do mundo e param cedo (docs/desempenho.md). O resultado tem de ser o mesmo
/// de uma busca escrita do jeito simples, que zera a grade inteira e varre o mapa todo: os mesmos hexágonos e os mesmos
/// minutos, bit a bit.
/// </summary>
public class CaminhosTestes
{
    private static double Entrar(Mundo m, int h, string vel, OpcoesCaminho op)
    {
        var ponte = m.Vias.Pontes.Contains(h);
        var f = m.Mapa.FatorTerreno(m.P, h, ponte);
        if (op.AjusteTerreno != null) f = op.AjusteTerreno(m.Mapa.Terrenos[h], f);
        var rota = m.Vias.Rotas.Contains(h) && (!m.Mapa.Rio[h] || ponte);
        return f * (rota ? m.P.RotaFator : 1) * m.P.MinPor[vel];
    }

    private static double Peso(Mundo m, int h, string vel, OpcoesCaminho op)
    {
        var c = Entrar(m, h, vel, op);
        if (op.Seguro) foreach (var f in Caminhos.CustosExtras) c += f(m, h, op);
        return c;
    }

    /// <summary>A* de referência: grade inteira zerada a cada busca.</summary>
    private static Rota CalcularSimples(Mundo m, int origem, int destino, string vel, OpcoesCaminho op)
    {
        if (origem == destino) return Rota.Parada(origem);
        var g = m.G;
        var dist = new double[g.Total]; Array.Fill(dist, double.PositiveInfinity);
        var ant = new int[g.Total]; Array.Fill(ant, -1);
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
        for (var i = 1; i < hexes.Count; i++) mins.Add(mins[^1] + Entrar(m, hexes[i], vel, op));
        return new Rota(hexes, mins);
    }

    /// <summary>Dijkstra reverso de referência: o mapa inteiro.</summary>
    private static double[] MinutosAteSimples(Mundo m, int destino, string vel, OpcoesCaminho op)
    {
        var g = m.G;
        var dist = new double[g.Total]; Array.Fill(dist, double.PositiveInfinity);
        var fila = new PriorityQueue<int, double>();
        dist[destino] = 0; fila.Enqueue(destino, 0);
        while (fila.TryDequeue(out var v, out var dv))
        {
            if (dv > dist[v]) continue;
            var custoV = Peso(m, v, vel, op);
            foreach (var u in g.Vizinhos(v))
            {
                var d = dv + custoV;
                if (d < dist[u]) { dist[u] = d; fila.Enqueue(u, d); }
            }
        }
        return dist;
    }

    /// <summary>Um mundo com fauna, uma estrada e uma ponte, para os custos não serem só o terreno.</summary>
    private static (Mundo m, Rng rng) Cenario()
    {
        var t = new MundoTeste(semente: 7, fauna: true);
        var m = t.M;
        var rng = new Rng(2024);
        var vias = m.Vias;
        for (var i = 0; i < 40; i++)
            foreach (var h in m.G.Reta(rng.Int(0, m.G.Total), rng.Int(0, m.G.Total)).Take(60))
            {
                vias.Rotas.Add(h);
                if (m.Mapa.Rio[h] && rng.Int(0, 2) == 0) vias.Pontes.Add(h);
            }
        return (m, rng);
    }

    private static readonly OpcoesCaminho[] Opcoes =
    [
        OpcoesCaminho.Padrao,
        new() { Seguro = true, Forca = 1 },
        new() { AjusteTerreno = (t, f) => t is Terreno.Floresta or Terreno.Pantano ? 1 : f },
    ];

    [Fact]
    public void O_caminho_e_o_mesmo_da_busca_que_zera_a_grade()
    {
        var (m, rng) = Cenario();
        string[] vels = [.. m.P.MinPor.Keys];
        for (var i = 0; i < 120; i++)
        {
            var de = rng.Int(0, m.G.Total);
            // perto e longe: a maior parte das marchas é curta
            var para = i % 3 == 0 ? rng.Int(0, m.G.Total) : m.G.Area(de, 25).ElementAt(rng.Int(0, 400));
            var vel = vels[i % vels.Length];
            var op = Opcoes[i % Opcoes.Length];
            var esperado = CalcularSimples(m, de, para, vel, op);
            var rota = Caminhos.Calcular(m, de, para, vel, op);
            Assert.Equal(esperado.Hexes, rota.Hexes);
            Assert.Equal(esperado.Minutos, rota.Minutos);
            Assert.Equal(Entrar(m, para, vel, op), Caminhos.MinutosEntrar(m, para, vel, op));
        }
    }

    [Fact]
    public void Os_minutos_ate_os_alvos_sao_os_do_mapa_inteiro_e_a_busca_para_no_ultimo_alvo()
    {
        var (m, rng) = Cenario();
        var vel = m.P.Carregador.Vel;
        for (var i = 0; i < 12; i++)
        {
            var destino = rng.Int(0, m.G.Total);
            var op = Opcoes[i % Opcoes.Length];
            var perto = m.G.Area(destino, 12).ToList();
            var alvos = Enumerable.Range(0, 6).Select(_ => perto[rng.Int(0, perto.Count)]).Append(destino).ToList();
            var esperado = MinutosAteSimples(m, destino, vel, op);
            var antes = m.HexesBuscados;
            var tempos = Caminhos.MinutosAte(m, destino, vel, alvos, op);
            var visitados = m.HexesBuscados - antes;
            foreach (var a in alvos) Assert.Equal(esperado[a], tempos[a]);
            // alvos a até 12 hexágonos: a busca fica por perto, longe dos 74.880 hexágonos do mapa
            Assert.True(visitados < m.G.Total / 10, $"hexágonos visitados: {visitados}");
        }
        // sem alvo não há busca
        var h0 = m.HexesBuscados;
        Assert.Empty(Caminhos.MinutosAte(m, 0, vel, []));
        Assert.Equal(h0, m.HexesBuscados);
    }

    [Fact]
    public void Busca_dentro_de_busca_nao_estraga_a_de_fora()
    {
        var (m, rng) = Cenario();
        int de = rng.Int(0, m.G.Total), para = rng.Int(0, m.G.Total);
        var esperado = CalcularSimples(m, de, para, "Lenta", OpcoesCaminho.Padrao);
        // o ajuste de terreno dispara outra busca de tempos em tempos: ela pega um rascunho próprio
        var n = 0;
        var op = new OpcoesCaminho { AjusteTerreno = (_, f) => { if (n++ % 4000 == 0) Caminhos.Calcular(m, para, de, "Rápida"); return f; } };
        var rota = Caminhos.Calcular(m, de, para, "Lenta", op);
        Assert.Equal(esperado.Hexes, rota.Hexes);
        Assert.Equal(esperado.Minutos, rota.Minutos);
        Assert.True(n > 0);
    }
}
