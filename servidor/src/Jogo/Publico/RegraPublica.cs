using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Mapa;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using ReinoDePedra.Jogo.Temporada;

namespace ReinoDePedra.Jogo.Publico;

/// <summary>
/// A regra única do que é público: o que todo jogador vê é o que o site mostra. O mapa do jogador e o feed sem login montam
/// reinos, locais, torres, ruínas, marchas, batalhas e bandeiras por aqui, campo a campo, em vez de filtrar um objeto maior.
/// Campo novo só entra de propósito, e o teste de segredos falha se um nome da lista proibida aparecer.
/// Nunca entram: tamanho e composição de marcha, destino, objetivos e carga, jazidas, conteúdo de ruínas, estoque, guarnição,
/// civis, mensagens, propostas, conversa de aliança, escudo, regência, última entrada e quem é de IA.
/// </summary>
public static class RegraPublica
{
    /// <summary>Quantas mensagens globais o feed leva.</summary>
    public const int MensagensNoFeed = 40;

    public static JsonObject Brasao(Reino r) => new()
    {
        ["forma"] = r.Brasao.Forma, ["divisao"] = r.Brasao.Divisao, ["cor1"] = r.Brasao.Cor1, ["cor2"] = r.Brasao.Cor2,
        ["simbolo"] = r.Brasao.Simbolo, ["corSimbolo"] = r.Brasao.CorSimbolo,
    };

    /// <summary>Identidade pública: nome, brasão e, se o jogador enviou, a imagem do reino.</summary>
    public static JsonObject Reino(Reino r)
    {
        var o = new JsonObject { ["id"] = r.Id, ["nome"] = r.Nome, ["brasao"] = Brasao(r) };
        if (r.IconeProprio) { o["iconeProprio"] = true; o["iconeVersao"] = r.IconeVersao; }
        return o;
    }

    /// <summary>Relíquias guardadas por local: só a quantidade, nunca o tipo.</summary>
    public static Dictionary<long, int> ReliquiasPorLocal(Mundo m)
    {
        var d = new Dictionary<long, int>();
        foreach (var x in m.Reliquias) if (x.LocalId is long id) d[id] = d.GetValueOrDefault(id) + 1;
        return d;
    }

    /// <summary>Local de qualquer reino: dono, tipo, nível e o que se vê de fora.</summary>
    public static JsonObject Local(Mundo m, Local l, IReadOnlyDictionary<long, int> reliquias)
    {
        var o = new JsonObject
        {
            ["tipo"] = "local", ["id"] = l.Id, ["hex"] = l.Hex, ["local"] = l.Tipo.Chave(),
            ["ocupa"] = new JsonArray(Mapa.Pegada.DoLocal(m, l).Select(h => (JsonNode)h).ToArray()),
            ["nivel"] = l.Ruina ? null : l.Nivel, ["nome"] = l.Ruina ? "Ruína" : l.ReinoId == 0 ? "Terra livre" : l.Nome,
            ["reinoId"] = Ataques.SemDono(m, l) ? 0 : l.ReinoId, ["ruina"] = l.Ruina, ["produz"] = l.Ruina ? null : l.Produz,
        };
        if (reliquias.TryGetValue(l.Id, out var n) && n > 0) o["reliquias"] = n;
        return o;
    }

    public static JsonObject Torre(Mundo m, Torre t) => new()
    {
        ["tipo"] = "torre", ["id"] = t.Id, ["hex"] = t.Hex, ["nivel"] = t.Nivel, ["alcance"] = Defesas.Alcance(m, t), ["reinoId"] = t.ReinoId,
    };

    /// <summary>Ruína antiga: só onde fica. Se ainda guarda a relíquia e de que tipo é, é preciso ir ver.</summary>
    public static JsonObject RuinaAntiga(Ruina r) => new() { ["tipo"] = "ruina-antiga", ["id"] = r.Id, ["hex"] = r.Hex };

    public static JsonObject Bandeira(Bandeira b) => new()
    {
        ["tipo"] = "bandeira", ["id"] = b.Id, ["hex"] = b.Hex, ["tipoBandeira"] = b.Tipo, ["recado"] = b.Recado, ["quando"] = b.Quando, ["reinoId"] = b.ReinoId,
    };

    /// <summary>Marchas que aparecem para todos: todas, menos o batedor de elite, que é furtivo.</summary>
    public static bool MarchaVisivel(Marcha x) => !x.Furtiva;

    /// <summary>
    /// Marcha de outro reino: dono e posição, com o hexágono em que está e o próximo, o bastante para animar o passo.
    /// Sem caminho, destino, ordem, carga nem tamanho. Baú (<c>reliquia</c>) sem o tipo; o ofício só de quem anda sozinho.
    /// </summary>
    public static JsonObject Marcha(Mundo m, Marcha x, long agora)
    {
        var (caminho, tempos) = Passo(x, agora);
        var o = new JsonObject
        {
            ["tipo"] = "marcha", ["id"] = x.Id, ["marcha"] = x.Tipo, ["reinoId"] = x.ReinoId, ["hex"] = caminho[0],
            ["caminho"] = new JsonArray(caminho.Select(h => (JsonNode)h).ToArray()),
            ["tempos"] = new JsonArray(tempos.Select(t => (JsonNode)t).ToArray()),
        };
        if (x.Reliquias.Count > 0) o["reliquia"] = true;
        if (x is Explorador e) o["oficio"] = Pessoas.Oficios.DeExplorador(e.TipoExp);
        return o;
    }

    /// <summary>O hexágono em que a marcha está agora e o próximo do caminho, com os instantes. Parada, só um.</summary>
    public static (List<int> caminho, List<long> tempos) Passo(Marcha x, long agora)
    {
        var cm = x.Caminho; var tp = x.Tempos;
        if (cm.Count == 0 || tp.Count != cm.Count) return ([x.HexEm(agora)], []);
        var i = tp.BinarySearch(agora);
        if (i < 0) i = ~i - 1;
        i = Math.Clamp(i, 0, cm.Count - 1);
        return i < cm.Count - 1 ? ([cm[i], cm[i + 1]], [tp[i], tp[i + 1]]) : ([cm[i]], [tp[i]]);
    }

    /// <summary>
    /// Batalhas por local: quem ataca quem, o andamento, a parte da força de cada lado e as baixas até agora. Sem força
    /// absoluta, tipo de ataque, objetivos, guarnição ou milícia.
    /// </summary>
    public static JsonArray Batalhas(Mundo m)
    {
        var lista = new JsonArray();
        var agora = m.Agora;
        foreach (var g in m.Batalhas.Where(b => !b.Encerrada).GroupBy(b => b.LocalId))
        {
            var ordem = g.OrderBy(b => b.Id).ToList();
            var b0 = ordem[0];
            var frentes = new JsonArray();
            foreach (var b in ordem)
            {
                var p = Combate.Batalhas.PlacarDe(m, b, agora);
                frentes.Add((JsonNode)new JsonObject
                {
                    ["atacanteId"] = b.AtacanteId, ["defensorId"] = b.DefensorId, ["progresso"] = Math.Round(p.Progresso, 3),
                    ["parteAtaque"] = p.A + p.D > 0 ? Math.Round(p.A / (p.A + p.D), 2) : 0.5,
                    ["baixasAtaque"] = p.BaixasA, ["baixasDefesa"] = p.BaixasD,
                });
            }
            lista.Add((JsonNode)new JsonObject
            {
                ["tipo"] = "batalha", ["hex"] = b0.Hex, ["local"] = m.Locais.Obter(b0.LocalId)?.Nome,
                ["inicio"] = ordem.Min(b => b.Inicio), ["fim"] = ordem.Max(b => b.FimPrevisto), ["frentes"] = frentes,
            });
        }
        return lista;
    }

    /// <summary>Aliança: nome, brasão e membros. Cargos não vão: a troca de líder entregaria quem entrou em regência.</summary>
    public static JsonArray Aliancas(Mundo m)
    {
        var l = new JsonArray();
        foreach (var a in m.Aliancas.OrderBy(a => a.Nome, StringComparer.OrdinalIgnoreCase))
            l.Add((JsonNode)new JsonObject
            {
                ["id"] = a.Id, ["nome"] = a.Nome, ["brasao"] = System.Text.Json.JsonSerializer.SerializeToNode(a.Brasao),
                ["membros"] = new JsonArray(a.Membros.Select(x => x.ReinoId).OrderBy(x => x).Select(x => (JsonNode)x).ToArray()),
            });
        return l;
    }

    /// <summary>Pactos em vigor: entre quem e até quando. O pagamento não vai.</summary>
    public static JsonArray Pactos(Mundo m)
    {
        var l = new JsonArray();
        foreach (var p in m.Pactos.Where(p => p.Estado == Comercio.Ativo && p.Fim > m.Agora))
            l.Add((JsonNode)new JsonObject { ["a"] = p.AId, ["b"] = p.BId, ["fim"] = p.Fim });
        return l;
    }

    public static JsonArray Ranking(Mundo m)
    {
        var l = new JsonArray();
        foreach (var x in Temporada.Ranking.Linhas(m).OrderBy(x => x.Reino.Nome, StringComparer.OrdinalIgnoreCase))
            l.Add((JsonNode)new JsonObject { ["reinoId"] = x.Reino.Id, ["baixas"] = x.Baixas, ["perdas"] = x.Perdas, ["tropas"] = x.Tropas, ["familias"] = x.Familias });
        return l;
    }

    public static JsonArray Reinos(Mundo m)
    {
        var l = new JsonArray();
        foreach (var r in m.Reinos.Where(r => r.Ativo).OrderBy(r => r.Nome, StringComparer.OrdinalIgnoreCase)) l.Add((JsonNode)Reino(r));
        return l;
    }

    /// <summary>
    /// Civis que um local deve ter, pelo que é público: as famílias do reino (ranking) divididas pelos locais dele. É o que o
    /// jogador e a IA têm para estimar a milícia; o número de verdade nunca aparece.
    /// </summary>
    public static int CivisEstimados(Mundo m, Local l)
    {
        var r = m.Reinos.Obter(l.ReinoId);
        if (r == null || l.Ruina) return 0;
        var n = m.LocaisDe(r.Id).Count(x => !x.Ruina);
        return n == 0 ? 0 : (int)Math.Round(Math.Floor(r.Pop) / n);
    }

    // ---------------------------------------------------------------- as partes do feed

    /// <summary>O chão: muda só com rota nova.</summary>
    public static JsonObject ChaoDoMapa(Mundo m) => new()
    {
        ["cols"] = m.G.Cols, ["lins"] = m.G.Lins, ["terreno"] = m.Mapa.Compacto(),
        ["rotas"] = new JsonArray(m.Vias.Rotas.OrderBy(h => h).Select(h => (JsonNode)h).ToArray()),
        ["pontes"] = new JsonArray(m.Vias.Pontes.OrderBy(h => h).Select(h => (JsonNode)h).ToArray()),
    };

    /// <summary>O que muda devagar: reinos, construções, bandeiras, diplomacia e ranking.</summary>
    public static JsonObject Mundo(Mundo m)
    {
        var rel = ReliquiasPorLocal(m);
        var e = m.Estado;
        return new JsonObject
        {
            ["temporada"] = e.NumeroTemporada, ["dia"] = Temporadas.DiaIndice(m) + 1, ["dias"] = m.P.TemporadaDias,
            ["reinos"] = Reinos(m),
            ["locais"] = new JsonArray(m.Locais.Select(l => (JsonNode)Local(m, l, rel)).ToArray()),
            ["torres"] = new JsonArray(m.Torres.Select(t => (JsonNode)Torre(m, t)).ToArray()),
            ["ruinas"] = new JsonArray(m.Ruinas.Select(r => (JsonNode)RuinaAntiga(r)).ToArray()),
            ["bandeiras"] = new JsonArray(m.Bandeiras.Select(b => (JsonNode)Bandeira(b)).ToArray()),
            ["aliancas"] = Aliancas(m), ["pactos"] = Pactos(m), ["ranking"] = Ranking(m), ["farolReliquias"] = m.P.ReliquiaVis.Farol,
        };
    }

    /// <summary>O que anda: marchas, batalhas e mensagens globais.</summary>
    public static JsonObject Vivo(Mundo m)
    {
        var agora = m.Agora;
        return new JsonObject
        {
            ["agora"] = agora,
            ["marchas"] = new JsonArray(m.Marchas.Where(MarchaVisivel).Select(x => (JsonNode)Marcha(m, x, agora)).ToArray()),
            ["batalhas"] = Batalhas(m),
            ["mensagens"] = MensagensGlobais.ParaFeed(m, MensagensNoFeed),
        };
    }
}
