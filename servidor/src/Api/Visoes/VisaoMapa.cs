using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Api.Visoes;

/// <summary>
/// O mapa como o reino o conhece: terreno só das áreas exploradas, objetos ao vivo só no que vê agora.
/// Locais de outros reinos aparecem sem dono (explorar não revela o dono); forças sem estandarte, sem identidade.
/// </summary>
public static class VisaoMapa
{
    public static object Montar(Mundo m, Reino r)
    {
        var vis = Nevoas.VisiveisAgora(m, r.Id);
        var nevoa = Nevoas.De(m, r.Id);
        var g = m.G;
        var ter = m.Mapa.Compacto().ToCharArray();
        var idade = new int[g.Total];
        var agoraMin = Nevoas.Minuto(m, m.Agora);
        for (var h = 0; h < g.Total; h++)
        {
            var v = nevoa.MinutoVisto(h);
            if (v == 0) ter[h] = '?';
            idade[h] = v == 0 ? -1 : vis.Contains(h) ? 0 : agoraMin - v;
        }
        var agora = m.Agora;
        var objetos = new List<object>();
        foreach (var l in m.Locais)
        {
            var meu = l.ReinoId == r.Id;
            if (!meu && !vis.Contains(l.Hex)) continue;
            objetos.Add(meu
                ? new { tipo = "local", id = l.Id, hex = l.Hex, local = l.Tipo.Chave(), nivel = (int?)l.Nivel, nome = l.Nome, dono = "meu", ruina = l.Ruina }
                : new { tipo = "local", id = l.Id, hex = l.Hex, local = l.Tipo.Chave(), nivel = (int?)null, nome = l.Ruina ? "Ruína" : l.Tipo.NomeGenerico(), dono = l.ReinoId == 0 ? "livre" : "desconhecido", ruina = l.Ruina });
        }
        foreach (var x in m.Marchas)
        {
            if (x.ReinoId == r.Id) { objetos.Add(new { tipo = "marcha", id = x.Id, marcha = x.Tipo, dono = "meu", hex = x.HexEm(agora), caminho = x.Caminho, tempos = x.Tempos }); continue; }
            var h = x.HexEm(agora);
            if (!vis.Contains(h) || x.Furtiva) continue;
            objetos.Add(new { tipo = "marcha", id = x.Id, marcha = x.Tipo, dono = "desconhecido", hex = h, progresso = x.ProgressoEm(agora), caminho = x.Caminho, tempos = x.Tempos, tamanho = Aproximado(x.Tropas.Values.Sum()) });
        }
        foreach (var j in m.Jazidas)
            if (j.DescobertaPor.Contains(r.Id))
                objetos.Add(new { tipo = "jazida", id = j.Id, hex = j.Hex, recurso = j.Recurso, restante = Math.Round(j.Restante / j.Inicial, 3) });
        foreach (var ru in m.Ruinas)
            if (vis.Contains(ru.Hex))   // fora da visão, a ruína vem da foto da névoa (Exploracao/Fotos)
                objetos.Add(new { tipo = "ruina-antiga", id = ru.Id, hex = ru.Hex, esgotada = ru.Esgotada });
        foreach (var f in Extras) objetos.AddRange(f(m, r, vis));
        var vias = m.Vias;
        return new
        {
            cols = g.Cols, lins = g.Lins, agora, terreno = new string(ter), idade,
            rotas = vias.Rotas.Where(h => nevoa.MinutoVisto(h) > 0), pontes = vias.Pontes.Where(h => nevoa.MinutoVisto(h) > 0),
            objetos,
        };
    }

    /// <summary>Sistemas acrescentam objetos ao mapa (fauna, torres, bandeiras, avistamentos...).</summary>
    public static List<Func<Mundo, Reino, HashSet<int>, IEnumerable<object>>> Extras { get; } = new();

    public static string Aproximado(int n) => n switch { 0 => "nenhuma", < 10 => "poucas", < 30 => "≈ " + (n / 5 * 5), < 100 => "≈ " + (n / 10 * 10), _ => "≈ " + (n / 50 * 50) };
}
