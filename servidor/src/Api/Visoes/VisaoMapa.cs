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
            var aliado = !meu && !l.Ruina && Aliado(m, r, l.ReinoId);
            if (!meu && !vis.Contains(l.Hex) && !(aliado && nevoa.MinutoVisto(l.Hex) > 0)) continue;
            if (aliado && m.Reinos.Obter(l.ReinoId) is { } dl)   // aliados se reconhecem: nome e brasão
                objetos.Add(new { tipo = "local", id = l.Id, hex = l.Hex, local = l.Tipo.Chave(), nivel = (int?)l.Nivel, nome = l.Nome, dono = "aliado", ruina = false, reino = Espionagem.Identidade(dl) });
            else objetos.Add(meu
                ? new { tipo = "local", id = l.Id, hex = l.Hex, local = l.Tipo.Chave(), nivel = (int?)l.Nivel, nome = l.Nome, dono = "meu", ruina = l.Ruina }
                : new { tipo = "local", id = l.Id, hex = l.Hex, local = l.Tipo.Chave(), nivel = (int?)null, nome = l.Ruina ? "Ruína" : l.Tipo.NomeGenerico(), dono = l.ReinoId == 0 ? "livre" : "desconhecido", ruina = l.Ruina });
        }
        foreach (var x in m.Marchas)
        {
            if (x.ReinoId == r.Id) { objetos.Add(new { tipo = "marcha", id = x.Id, marcha = x.Tipo, dono = "meu", hex = x.HexEm(agora), caminho = x.Caminho, tempos = x.Tempos }); continue; }
            var h = x.HexEm(agora);
            var aliada = Aliado(m, r, x.ReinoId);   // aliados veem as marchas uns dos outros
            if (!aliada && (!vis.Contains(h) || x.Furtiva)) continue;
            var dm = aliada || x.Estandarte ? m.Reinos.Obter(x.ReinoId) : null;
            if (dm != null && !aliada) foreach (var f in AoVerEstandarte) f(m, r, x);
            // aliados veem o caminho inteiro; de outro reino, só o trecho à vista (origem e destino na névoa não vão)
            var (caminho, tempos) = aliada ? (x.Caminho, x.Tempos) : Trecho(m, r, x, vis, agora);
            objetos.Add(new
            {
                tipo = "marcha", id = x.Id, marcha = x.Tipo, dono = aliada ? "aliado" : "desconhecido", hex = h, caminho, tempos,
                paraMim = !aliada && ParaMim(m, r, x) ? true : (bool?)null,   // sem isso, o fim dos tempos é quando ela sai da vista
                tamanho = Aproximado(x.Tropas.Values.Sum()), estandarte = x.Estandarte ? true : (bool?)null,
                reino = dm != null ? Espionagem.Identidade(dm) : null, brasao = dm?.Brasao,
            });
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

    /// <summary>
    /// Reinos que o reino reconhece (aliança): (mundo, reino que vê, outro reino) → true. Locais deles vêm com dono "aliado"
    /// e a identidade em "reino" em toda área explorada; as marchas aparecem mesmo fora da visão.
    /// </summary>
    public static List<Func<Mundo, Reino, long, bool>> Aliados { get; } = new();
    public static bool Aliado(Mundo m, Reino r, long outro) => outro != 0 && outro != r.Id && Aliados.Any(f => f(m, r, outro));
    /// <summary>Marcha de outro reino vista com estandarte (a identidade vai junto): o social marca o reino como conhecido.</summary>
    public static List<Action<Mundo, Reino, Marcha>> AoVerEstandarte { get; } = new();

    /// <summary>Sistemas acrescentam objetos ao mapa (fauna, torres, bandeiras, avistamentos...).</summary>
    public static List<Func<Mundo, Reino, HashSet<int>, IEnumerable<object>>> Extras { get; } = new();

    /// <summary>
    /// Trecho do caminho de uma marcha alheia que o reino pode saber: o pedaço contínuo à vista agora em volta da posição
    /// atual, mais o próximo hexágono (para animar a saída da vista). Se ela vai a um local do próprio reino, o resto do
    /// caminho até lá também (o defensor vê o ataque chegando e a hora da chegada).
    /// </summary>
    public static (List<int> caminho, List<long> tempos) Trecho(Mundo m, Reino r, Marcha x, HashSet<int> vis, long agora)
    {
        var cm = x.Caminho; var tp = x.Tempos;
        if (cm.Count == 0 || tp.Count != cm.Count) return ([x.HexEm(agora)], []);
        var i = tp.BinarySearch(agora);
        if (i < 0) i = ~i - 1;
        i = Math.Clamp(i, 0, cm.Count - 1);
        var a = i; while (a > 0 && vis.Contains(cm[a - 1])) a--;
        var b = i; while (b < cm.Count - 1 && vis.Contains(cm[b + 1])) b++;
        if (ParaMim(m, r, x)) b = cm.Count - 1;
        else if (b < cm.Count - 1) b++;
        return (cm.GetRange(a, b - a + 1), tp.GetRange(a, b - a + 1));
    }

    /// <summary>A marcha vai a um local do próprio reino (o defensor sabe para onde e quando).</summary>
    public static bool ParaMim(Mundo m, Reino r, Marcha x) =>
        x.Caminho.Count > 0 && m.LocalNoHex(x.Caminho[^1]) is { } l && l.ReinoId == r.Id && !l.Ruina;

    public static string Aproximado(int n) => n switch { 0 => "nenhuma", < 10 => "poucas", < 30 => "≈ " + (n / 5 * 5), < 100 => "≈ " + (n / 10 * 10), _ => "≈ " + (n / 50 * 50) };
}
