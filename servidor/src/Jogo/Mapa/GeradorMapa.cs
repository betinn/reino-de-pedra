using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Nucleo;

namespace ReinoDePedra.Jogo.Mapa;

/// <summary>
/// Gera o terreno, os rios e as vagas dos reinos a partir da semente (determinístico).
/// Jazidas e ruínas são sorteadas uma única vez, na criação do mundo, e depois ficam no banco.
/// </summary>
public static class GeradorMapa
{
    public static MapaMundo Gerar(ParametrosP p, ulong semente)
    {
        var m = new MapaMundo(p.Mapa.Cols, p.Mapa.Lins);
        var g = m.G;
        var umid = new float[g.Total];
        for (var h = 0; h < g.Total; h++)
        {
            var (x, y) = Pos(g, h);
            m.Altura[h] = (float)Fbm(semente, 1, x, y, 9.0);
            umid[h] = (float)Fbm(semente, 2, x, y, 7.0);
        }
        // limiares por quantil: proporções estáveis em qualquer semente
        var alt = m.Altura.OrderBy(v => v).ToArray();
        var um = umid.OrderBy(v => v).ToArray();
        float Q(float[] a, double q) => a[(int)Math.Clamp(q * (a.Length - 1), 0, a.Length - 1)];
        float montanha = Q(alt, 0.90), colina = Q(alt, 0.76), baixo = Q(alt, 0.30);
        float umido = Q(um, 0.62), muitoUmido = Q(um, 0.80);
        for (var h = 0; h < g.Total; h++)
        {
            var a = m.Altura[h]; var u = umid[h];
            m.Terrenos[h] =
                a >= montanha ? Terreno.Montanha :
                a >= colina ? Terreno.Colina :
                a <= baixo && u >= muitoUmido ? Terreno.Pantano :
                u >= umido ? Terreno.Floresta : Terreno.Planicie;
        }
        GerarRios(m, semente);
        GerarVagas(m, p, semente);
        return m;
    }

    private static (double x, double y) Pos(Grade g, int h) => (g.C(h) + 0.5 * (g.L(h) & 1), g.L(h) * 0.866);

    private static double Ruido(ulong semente, ulong canal, int ix, int iy) =>
        (Rng.Hash(semente, canal, (ulong)(uint)ix << 32 | (uint)iy) >> 11) * (1.0 / (1UL << 53));

    private static double Valor(ulong semente, ulong canal, double x, double y)
    {
        int x0 = (int)Math.Floor(x), y0 = (int)Math.Floor(y);
        double fx = x - x0, fy = y - y0;
        double sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        double a = Ruido(semente, canal, x0, y0), b = Ruido(semente, canal, x0 + 1, y0);
        double c = Ruido(semente, canal, x0, y0 + 1), d = Ruido(semente, canal, x0 + 1, y0 + 1);
        return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    }

    private static double Fbm(ulong semente, ulong canal, double x, double y, double escala)
    {
        double s = 0, amp = 1, tot = 0, f = 1 / escala;
        for (var o = 0; o < 4; o++)
        {
            s += amp * Valor(semente, canal * 16 + (ulong)o, x * f, y * f);
            tot += amp; amp *= 0.5; f *= 2;
        }
        return s / tot;
    }

    private static void GerarRios(MapaMundo m, ulong semente)
    {
        var g = m.G;
        var rng = new Rng(semente ^ 0x5249_4F53UL);
        var fontes = Enumerable.Range(0, g.Total).Where(h => m.Terrenos[h] == Terreno.Montanha).ToList();
        rng.Embaralhar(fontes);
        var nRios = Math.Max(3, g.Total / 450);
        var feitos = 0;
        foreach (var fonte in fontes)
        {
            if (feitos >= nRios) break;
            if (m.Rio[fonte] || g.Area(fonte, 6).Any(x => m.Rio[x])) continue;
            var caminho = new List<int> { fonte };
            var visit = new HashSet<int> { fonte };
            var h = fonte;
            for (var passo = 0; passo < 200; passo++)
            {
                int c = g.C(h), l = g.L(h);
                if (c == 0 || l == 0 || c == g.Cols - 1 || l == g.Lins - 1) break;
                var prox = g.Vizinhos(h).Where(v => !visit.Contains(v))
                    .OrderBy(v => m.Altura[v] + 0.02 * rng.Real()).FirstOrDefault(-1);
                if (prox < 0) break;
                if (m.Rio[prox]) { caminho.Add(prox); break; }   // encontra outro rio
                caminho.Add(prox); visit.Add(prox); h = prox;
            }
            if (caminho.Count < 8) continue;
            foreach (var x in caminho) m.Rio[x] = true;
            feitos++;
        }
    }

    private static void GerarVagas(MapaMundo m, ParametrosP p, ulong semente)
    {
        var g = m.G;
        var rng = new Rng(semente ^ 0x5641_4741UL);
        // grade de células com sorteio dentro de cada uma: espalha os reinos com folga parecida
        var n = p.Reinos;
        var colsC = (int)Math.Round(Math.Sqrt(n * g.Cols / (double)g.Lins));
        var linsC = (int)Math.Ceiling(n / (double)colsC);
        double w = g.Cols / (double)colsC, hgt = g.Lins / (double)linsC;
        var centros = new List<int>();
        for (var lc = 0; lc < linsC; lc++)
            for (var cc = 0; cc < colsC; cc++)
            {
                if (centros.Count >= n) break;
                var c = (int)Math.Clamp(Math.Round((cc + 0.5) * w + (rng.Real() - 0.5) * w * 0.35), 3, g.Cols - 4);
                var l = (int)Math.Clamp(Math.Round((lc + 0.5) * hgt + (rng.Real() - 0.5) * hgt * 0.35), 3, g.Lins - 4);
                centros.Add(g.Indice(c, l));
            }
        // ordem de ocupação: a partir do centro do mapa, cada nova vaga perto das já ocupadas
        var meio = g.Indice(g.Cols / 2, g.Lins / 2);
        var ordem = new List<int>();
        var resto = centros.ToList();
        var atual = resto.OrderBy(x => g.Distancia(x, meio)).First();
        while (resto.Count > 0)
        {
            ordem.Add(atual); resto.Remove(atual);
            if (resto.Count == 0) break;
            atual = resto.OrderBy(x => ordem.Min(o => g.Distancia(o, x)) + 0.25 * g.Distancia(x, meio)).First();
        }
        var idx = 0;
        foreach (var castelo in ordem)
        {
            // o castelo e o entorno imediato ficam em planície, sem rio; os 4 locais iniciais ganham o terreno certo
            foreach (var x in g.Area(castelo, 1)) { if (m.Terrenos[x] is Terreno.Montanha or Terreno.Pantano) m.Terrenos[x] = Terreno.Planicie; }
            m.Terrenos[castelo] = Terreno.Planicie; m.Rio[castelo] = false;
            var anel = g.Area(castelo, 2).Where(x => g.Distancia(x, castelo) == 2).ToList();
            var giro = rng.Int(0, anel.Count);
            int Pegar(int k) => anel[(giro + k * anel.Count / 4) % anel.Count];
            int comida = Pegar(0), madeira = Pegar(1), pedra = Pegar(2), ferro = Pegar(3);
            m.Terrenos[comida] = Terreno.Planicie; m.Terrenos[madeira] = Terreno.Floresta;
            m.Terrenos[pedra] = Terreno.Colina; m.Terrenos[ferro] = Terreno.Colina;
            foreach (var x in new[] { comida, madeira, pedra, ferro }) m.Rio[x] = false;
            m.Vagas.Add(new Vaga(idx++, castelo, comida, madeira, pedra, ferro));
        }
    }

    /// <summary>Onde cada recurso valioso aparece.</summary>
    public static readonly Dictionary<string, Terreno[]> TerrenoDoValioso = new()
    {
        ["aco"] = [Terreno.Colina], ["cavalo"] = [Terreno.Planicie], ["ouro"] = [Terreno.Montanha],
        ["prata"] = [Terreno.Colina, Terreno.Montanha], ["sal"] = [Terreno.Planicie], ["ervas"] = [Terreno.Pantano],
        ["gema"] = [Terreno.Montanha], ["minerio"] = [Terreno.Montanha],
    };

    /// <summary>Sorteia hexágonos para jazidas e ruínas na criação do mundo (resultado vai para o banco).</summary>
    public static (List<(int hex, string recurso, double tamanho)> jazidas, List<int> ruinas) SortearObjetos(
        MapaMundo m, Balanceamento b, ulong semente)
    {
        var g = m.G; var p = b.P;
        var rng = new Rng(semente ^ 0x4A41_5A49UL);
        var castelos = m.Vagas.Select(v => v.Castelo).ToList();
        var iniciais = m.Vagas.SelectMany(v => new[] { v.Castelo, v.Comida, v.Madeira, v.Pedra, v.Ferro }).ToHashSet();
        var ocupados = new List<int>();
        var jaz = new List<(int, string, double)>();
        var refJaz = b.Referencia.GetProperty("jazidas");
        foreach (var j in refJaz.EnumerateArray())
        {
            var rec = j.GetProperty("recurso").GetString()!;
            var tam = j.GetProperty("tamanho").GetDouble();
            var qtd = j.GetProperty("quantidade").GetInt32();
            var terr = TerrenoDoValioso[rec];
            var cand = Enumerable.Range(0, g.Total)
                .Where(h => terr.Contains(m.Terrenos[h]) && !m.Rio[h] && !iniciais.Contains(h) && castelos.All(c => g.Distancia(c, h) >= 4))
                .ToList();
            var mesmos = new List<int>();
            for (var k = 0; k < qtd && cand.Count > 0; k++)
            {
                // melhor de 24 sorteios: longe das do mesmo tipo e de qualquer outro objeto
                int melhor = -1; double nota = double.MinValue;
                for (var t = 0; t < 24; t++)
                {
                    var h = cand[rng.Int(0, cand.Count)];
                    if (ocupados.Any(o => g.Distancia(o, h) < 2)) continue;
                    var dm = mesmos.Count == 0 ? 99 : mesmos.Min(o => g.Distancia(o, h));
                    var s = Math.Min(dm, 14) + rng.Real();
                    if (s > nota) { nota = s; melhor = h; }
                }
                if (melhor < 0) continue;
                mesmos.Add(melhor); ocupados.Add(melhor);
                jaz.Add((melhor, rec, tam));
            }
        }
        var ruinas = new List<int>();
        var candR = Enumerable.Range(0, g.Total)
            .Where(h => !m.Rio[h] && !iniciais.Contains(h) && castelos.All(c => g.Distancia(c, h) >= 5)).ToList();
        for (var k = 0; k < p.Reinos && candR.Count > 0; k++)
        {
            int melhor = -1; double nota = double.MinValue;
            for (var t = 0; t < 32; t++)
            {
                var h = candR[rng.Int(0, candR.Count)];
                if (ocupados.Any(o => g.Distancia(o, h) < 2)) continue;
                var dm = ruinas.Count == 0 ? 99 : ruinas.Min(o => g.Distancia(o, h));
                var s = Math.Min(dm, 12) + rng.Real();
                if (s > nota) { nota = s; melhor = h; }
            }
            if (melhor < 0) continue;
            ruinas.Add(melhor); ocupados.Add(melhor);
        }
        return (jaz, ruinas);
    }
}
