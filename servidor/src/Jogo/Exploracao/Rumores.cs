using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.Exploracao;

/// <summary>Área onde há um reino: o castelo fica em algum lugar dentro dela, não no centro. Não diz de quem é.</summary>
public sealed record RegiaoReino(string Chave, int Centro, int Raio);

/// <summary>Poeira de uma marcha grande fora da vista: posição aproximada, tamanho aproximado e rumo.</summary>
public sealed record Rastro(int Hex, string Tamanho, string Rumo, int RumoHex);

/// <summary>
/// O que se sabe de longe, sem explorar (decisão 0035): a região de cada reino do mundo, marcada desde o início, e a poeira
/// das marchas grandes, vista de mais longe que a visão normal. Nenhum dos dois diz o dono nem detalhes; servem para
/// apontar onde procurar. Jogadores e IA recebem exatamente isto.
/// </summary>
public static class Rumores
{
    /// <summary>Regiões dos outros reinos ativos (o próprio fica de fora). O desvio do castelo é fixo por reino e castelo.</summary>
    public static List<RegiaoReino> Regioes(Mundo m, long reinoId)
    {
        var p = m.P.RegiaoReino;
        var lista = new List<RegiaoReino>();
        foreach (var r in m.Reinos)
        {
            if (r.Id == reinoId || !r.Ativo) continue;
            var c = m.Locais.Obter(r.CasteloId);
            if (c == null || c.Ruina || c.ReinoId != r.Id) continue;
            lista.Add(new RegiaoReino(Chave(m, r.Id, c.Hex), Centro(m, r.Id, c.Hex), Math.Max(p.Raio, p.Desvio)));
        }
        return lista.OrderBy(x => x.Chave, StringComparer.Ordinal).ToList();
    }

    /// <summary>Centro da região: um hexágono a até <c>desvio</c> do castelo, sorteado de forma fixa (mesmo reino e castelo, mesmo centro).</summary>
    public static int Centro(Mundo m, long reinoId, int casteloHex)
    {
        var area = m.G.Area(casteloHex, Math.Max(0, m.P.RegiaoReino.Desvio)).ToList();
        return area[(int)(Mistura(m, reinoId, casteloHex) % (ulong)area.Count)];
    }

    /// <summary>Identificador da região sem o id do reino (não revela quem é nem a ordem de criação).</summary>
    private static string Chave(Mundo m, long reinoId, int casteloHex) => (Mistura(m, reinoId, casteloHex) >> 20).ToString("x");

    private static ulong Mistura(Mundo m, long reinoId, int casteloHex)
    {
        var x = (ulong)reinoId * 0x9E3779B97F4A7C15UL ^ (ulong)casteloHex * 0xC2B2AE3D27D4EB4FUL ^ (ulong)m.Estado.InicioTemporada;
        x ^= x >> 33; x *= 0xFF51AFD7ED558CCDUL; x ^= x >> 33; x *= 0xC4CEB9FE1A85EC53UL; x ^= x >> 33;
        return x;
    }

    /// <summary>
    /// Poeira das marchas de outros reinos com pelo menos <c>rastro.tropas</c> pessoas, em movimento, fora da vista e a até
    /// <c>rastro.alcance</c> de um local ou de uma marcha do reino. Furtivas (batedor) e aliadas (que já se veem) não entram.
    /// </summary>
    public static List<Rastro> Rastros(Mundo m, long reinoId, HashSet<int> vis, Func<long, bool>? aliado = null)
    {
        var p = m.P.Rastro;
        var agora = m.Agora;
        var olhos = m.LocaisDe(reinoId).Select(l => l.Hex)
            .Concat(m.Marchas.Where(x => x.ReinoId == reinoId).Select(x => x.HexEm(agora))).Distinct().ToList();
        var lista = new List<Rastro>();
        if (olhos.Count == 0) return lista;
        foreach (var x in m.Marchas)
        {
            if (x.ReinoId == reinoId || x.Furtiva || Social.Aliancas.SaoAliados(m, reinoId, x.ReinoId) || (aliado?.Invoke(x.ReinoId) ?? false)) continue;
            if (x.Tempos.Count == 0 || agora >= x.Tempos[^1] || x.Caminho.Count <= 1) continue;   // parada não levanta poeira
            var n = x.Tropas.Values.Sum();
            if (n < p.Tropas) continue;
            var h = x.HexEm(agora);
            if (vis.Contains(h)) continue;   // à vista, a marcha aparece inteira
            if (olhos.All(o => m.G.Distancia(o, h) > p.Alcance)) continue;
            var i = x.Caminho.IndexOf(h);
            var adiante = x.Caminho[Math.Min(x.Caminho.Count - 1, (i < 0 ? 0 : i) + Math.Max(1, p.Adiante))];
            var aprox = Aproximar(m, h);
            lista.Add(new Rastro(aprox, Combate.Avistamentos.Aproximado(m, n), m.G.Direcao(h, adiante), Aproximar(m, adiante)));
        }
        return lista.OrderBy(x => x.Hex).ToList();
    }

    /// <summary>Posição arredondada a uma grade de <c>rastro.grade</c> hexágonos: diz a área, não o hexágono.</summary>
    public static int Aproximar(Mundo m, int h)
    {
        var g = Math.Max(1, m.P.Rastro.Grade);
        int c = Math.Clamp((int)Math.Round(m.G.C(h) / (double)g) * g, 0, m.G.Cols - 1);
        int l = Math.Clamp((int)Math.Round(m.G.L(h) / (double)g) * g, 0, m.G.Lins - 1);
        return m.G.Indice(c, l);
    }
}
