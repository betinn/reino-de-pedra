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
/// <c>viagemMin</c> do modelo. A* sobre a grade (312 × 240 = 74.880 hexágonos).
/// <para>As buscas não alocam por hexágono do mapa: usam o <see cref="Rascunho"/> do mundo (distâncias marcadas por geração,
/// sem zerar a grade a cada busca) e só visitam o que o caminho pede. Uma busca que zerasse a grade custaria 900 KB de
/// memória nova por chamada, e uma que varresse o mapa inteiro, perto de 16 ms.</para>
/// </summary>
public static class Caminhos
{
    /// <summary>Custos extras por hexágono para a rota segura (o sistema de fauna registra aqui).</summary>
    public static List<Func<Mundo, int, OpcoesCaminho, double>> CustosExtras { get; } = new();

    /// <summary>
    /// Memória de trabalho das buscas, uma por mundo (só a thread do motor mexe nele). A distância de um hexágono só vale se a
    /// marca dele é a da busca em curso: começar uma busca é trocar a geração, sem tocar na grade.
    /// </summary>
    internal sealed class Rascunho
    {
        public double[] Dist = [];
        public int[] Ant = [];
        public int[] Marca = [];
        public int Geracao;
        public int Visitados;
        public readonly PriorityQueue<int, double> Fila = new();
        public readonly int[] Viz = new int[6];

        public void Preparar(int n)
        {
            if (Marca.Length != n) { Dist = new double[n]; Ant = new int[n]; Marca = new int[n]; Geracao = 0; }
            if (++Geracao == int.MaxValue) { Array.Clear(Marca); Geracao = 1; }
            Fila.Clear();
        }
    }

    /// <summary>Pega o rascunho do mundo; se outra busca o está usando (busca dentro de busca, outra thread), usa um novo.</summary>
    private static Rascunho Tomar(Mundo m, int n)
    {
        var r = Interlocked.Exchange(ref m.RascunhoDeCaminho, null) ?? new Rascunho();
        r.Preparar(n);
        return r;
    }
    private static void Devolver(Mundo m, Rascunho r)
    {
        m.HexesBuscados += r.Visitados; r.Visitados = 0;
        Volatile.Write(ref m.RascunhoDeCaminho, r);
    }

    /// <summary>O que não muda de um hexágono para outro numa busca: lido uma vez, em vez de a cada hexágono.</summary>
    private readonly struct Custos
    {
        private readonly MapaMundo _mapa;
        private readonly HashSet<int> _rotas, _pontes;
        private readonly double[] _terreno;
        private readonly double _vau, _rotaFator, _minPor;

        public Custos(Mundo m, string vel)
        {
            _mapa = m.Mapa;
            var vias = m.Vias;
            _rotas = vias.Rotas; _pontes = vias.Pontes;
            _terreno = new double[(int)Terreno.Pantano + 1];
            for (var t = 0; t < _terreno.Length; t++) _terreno[t] = m.P.Terreno[((Terreno)t).Chave()];
            _vau = m.P.Rio.Vau; _rotaFator = m.P.RotaFator; _minPor = m.P.MinPor[vel];
        }

        /// <summary>A mesma conta de <see cref="MinutosEntrar"/>, na mesma ordem (o resultado é igual bit a bit; <c>CaminhosTestes</c> confere).</summary>
        public double Entrar(int h, OpcoesCaminho op)
        {
            var ponte = _pontes.Contains(h);
            var rio = _mapa.Rio[h];
            var f = _terreno[(int)_mapa.Terrenos[h]];
            if (rio && !ponte) f *= _vau;
            if (op.AjusteTerreno != null) f = op.AjusteTerreno(_mapa.Terrenos[h], f);
            var rota = _rotas.Contains(h) && (!rio || ponte);
            return f * (rota ? _rotaFator : 1) * _minPor;
        }

        public double Peso(Mundo m, int h, OpcoesCaminho op)
        {
            var c = Entrar(h, op);
            if (op.Seguro) foreach (var f in CustosExtras) c += f(m, h, op);
            return c;
        }
    }

    public static double MinutosEntrar(Mundo m, int h, string vel, OpcoesCaminho op)
    {
        var vias = m.Vias;
        var ponte = vias.Pontes.Contains(h);
        var f = m.Mapa.FatorTerreno(m.P, h, ponte);
        if (op.AjusteTerreno != null) f = op.AjusteTerreno(m.Mapa.Terrenos[h], f);
        var rota = vias.Rotas.Contains(h) && (!m.Mapa.Rio[h] || ponte);
        return f * (rota ? m.P.RotaFator : 1) * m.P.MinPor[vel];
    }

    /// <summary>Melhor caminho de <paramref name="origem"/> a <paramref name="destino"/> (A*).</summary>
    public static Rota Calcular(Mundo m, int origem, int destino, string vel, OpcoesCaminho? op = null)
    {
        op ??= OpcoesCaminho.Padrao;
        if (origem == destino) return Rota.Parada(origem);
        var g = m.G;
        var custos = new Custos(m, vel);
        var minFator = Math.Min(m.P.RotaFator, 1) * m.P.MinPor[vel] * m.P.Terreno.Values.Min();
        var ras = Tomar(m, g.Total);
        try
        {
            double[] dist = ras.Dist; int[] ant = ras.Ant, marca = ras.Marca, viz = ras.Viz;
            var ger = ras.Geracao; var fila = ras.Fila;
            marca[origem] = ger; dist[origem] = 0; ant[origem] = -1; fila.Enqueue(origem, 0);
            while (fila.TryDequeue(out var u, out _))
            {
                ras.Visitados++;
                if (u == destino) break;
                var du = dist[u];
                var k = g.Vizinhos(u, viz);
                for (var i = 0; i < k; i++)
                {
                    var v = viz[i];
                    var d = du + custos.Peso(m, v, op);
                    if (d < (marca[v] == ger ? dist[v] : double.PositiveInfinity))
                    {
                        marca[v] = ger; dist[v] = d; ant[v] = u;
                        fila.Enqueue(v, d + g.Distancia(v, destino) * minFator);
                    }
                }
            }
            if (marca[destino] != ger || ant[destino] < 0) return Rota.Parada(origem);
            var hexes = new List<int>();
            for (var h = destino; h != -1; h = ant[h]) hexes.Add(h);
            hexes.Reverse();
            var mins = new List<double>(hexes.Count) { 0 };
            for (var i = 1; i < hexes.Count; i++) mins.Add(mins[^1] + custos.Entrar(hexes[i], op));
            return new Rota(hexes, mins);
        }
        finally { Devolver(m, ras); }
    }

    /// <summary>O caminho exato pelos hexágonos dados, vizinhos em sequência, sem procurar outro melhor (a linha que o jogador desenhou).</summary>
    public static Rota Seguir(Mundo m, IReadOnlyList<int> hexes, string vel, OpcoesCaminho? op = null)
    {
        op ??= OpcoesCaminho.Padrao;
        var custos = new Custos(m, vel);
        var mins = new List<double>(hexes.Count) { 0 };
        for (var i = 1; i < hexes.Count; i++) mins.Add(mins[^1] + custos.Entrar(hexes[i], op));
        return new Rota(hexes, mins);
    }

    /// <summary>
    /// Minutos de cada um dos <paramref name="alvos"/> até <paramref name="destino"/> (Dijkstra reverso), para escolher origens
    /// próximas. A busca para quando o último alvo é alcançado: custa a área até o alvo mais distante, não o mapa inteiro.
    /// Alvo sem caminho fica com infinito.
    /// </summary>
    public static Dictionary<int, double> MinutosAte(Mundo m, int destino, string vel, IEnumerable<int> alvos, OpcoesCaminho? op = null)
    {
        op ??= OpcoesCaminho.Padrao;
        var res = new Dictionary<int, double>();
        foreach (var a in alvos) res[a] = double.PositiveInfinity;
        var faltam = res.Count;
        if (faltam == 0) return res;
        var g = m.G;
        var custos = new Custos(m, vel);
        var ras = Tomar(m, g.Total);
        try
        {
            double[] dist = ras.Dist; int[] marca = ras.Marca, viz = ras.Viz;
            var ger = ras.Geracao; var fila = ras.Fila;
            marca[destino] = ger; dist[destino] = 0; fila.Enqueue(destino, 0);
            while (fila.TryDequeue(out var v, out var dv))
            {
                if (dv > dist[v]) continue;
                ras.Visitados++;
                if (res.TryGetValue(v, out var ja) && double.IsPositiveInfinity(ja))
                {
                    res[v] = dv;
                    if (--faltam == 0) break;
                }
                var d = dv + custos.Peso(m, v, op);       // u → v custa entrar em v
                var k = g.Vizinhos(v, viz);
                for (var i = 0; i < k; i++)
                {
                    var u = viz[i];
                    if (d < (marca[u] == ger ? dist[u] : double.PositiveInfinity)) { marca[u] = ger; dist[u] = d; fila.Enqueue(u, d); }
                }
            }
            return res;
        }
        finally { Devolver(m, ras); }
    }
}
