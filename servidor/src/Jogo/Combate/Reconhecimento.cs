using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Combate;

/// <summary>Torre que o reino sabe que cobre um local (como está à vista, ou como a foto da névoa a guardou).</summary>
public sealed record TorreConhecida(int Hex, int Nivel, int Alcance);

/// <summary>
/// Força inimiga antes da batalha: o que o reino sabe da defesa de um local alheio e como ela se compara às tropas que ele
/// mandaria. Presença física revela o que se vê (guarnição por unidade, civis da milícia, torres, portões), sem o dono e sem
/// bônus; a espionagem revela também o bônus de defesa (armaduras, veterania, relíquias, equipamento) e vale, envelhecida,
/// fora da vista. A estimativa usa a mesma fórmula da batalha; escudo, pacto e reforços que cheguem só se descobrem ao lutar.
/// </summary>
public static class Reconhecimentos
{
    /// <summary>Distância máxima do alvo em que a ordem "reconhecer" para (ou a visão do grupo, se menor).</summary>
    public const int DistanciaMax = 3;

    /// <summary>A quantos hexágonos do alvo as tropas param para vê-lo: a visão do grupo, até <see cref="DistanciaMax"/>.</summary>
    public static int Distancia(Mundo m, IReadOnlyDictionary<string, int> tropas) => Math.Clamp(GT.Visao(m, tropas), 1, DistanciaMax);

    /// <summary>
    /// Torres que cobrem o local pelo que o reino sabe: as próprias e as à vista como estão agora; fora da vista, as da foto
    /// da névoa como foram vistas (nível e alcance daquele momento).
    /// </summary>
    public static List<TorreConhecida> TorresConhecidas(Mundo m, Reino r, Local l, HashSet<int>? vis = null)
    {
        vis ??= Nevoas.VisiveisAgora(m, r.Id);
        var lista = Defesas.NoAlcance(m, l).Where(t => t.ReinoId == r.Id || vis.Contains(t.Hex))
            .Select(t => new TorreConhecida(t.Hex, t.Nivel, Defesas.Alcance(m, t))).ToList();
        foreach (var (h, objs) in Fotos.De(m, r.Id).Objetos)
        {
            if (vis.Contains(h)) continue;
            foreach (var o in objs)
                if (o["tipo"]?.GetValue<string>() == "torre" && o["alcance"]?.GetValue<int>() is int alc && m.G.Distancia(h, l.Hex) <= alc)
                    lista.Add(new TorreConhecida(h, o["nivel"]?.GetValue<int>() ?? 1, alc));
        }
        return lista;
    }

    /// <summary>Bônus de ataque de tropas que saem de um local (como teriam no exército: armas, relíquias, linhagem, veterania da guarnição).</summary>
    public static double BonusDoLocal(Mundo m, Reino r, Local origem, IReadOnlyDictionary<string, int> grupo)
    {
        var temp = new Exercito { ReinoId = r.Id, OrigemLocalId = origem.Id, Tropas = new(grupo) };
        return Bonus.SomaAtaque(m, temp) + Veterania.BonusDe(m, Veterania.DoLocal(m, origem));
    }

    /// <summary>
    /// Estimativa da defesa do local <paramref name="alvo"/> e do combate contra <paramref name="grupo"/>, pelo que o reino
    /// <paramref name="r"/> sabe agora. "fonte": "vista" (à vista agora), "espionagem" (só o relatório, com a idade) ou
    /// "nenhuma" (só as torres conhecidas, sem estimativa).
    /// </summary>
    public static JsonObject Estimar(Mundo m, Reino r, Local alvo, IReadOnlyDictionary<string, int> grupo, double bonusA, string? tatica, HashSet<int>? vis = null)
    {
        vis ??= Nevoas.VisiveisAgora(m, r.Id);
        var torres = TorresConhecidas(m, r, alvo, vis);
        var arqTorre = torres.Sum(t => t.Nivel * m.P.Torre.ArqPorNivel);
        var j = new JsonObject
        {
            ["torres"] = torres.Count, ["arqueirosNoAlto"] = arqTorre,
        };
        if (Ataques.SemDono(m, alvo))
        {
            j["fonte"] = vis.Contains(alvo.Hex) ? "vista" : "nenhuma";
            j["semDefesa"] = true;
            j["texto"] = "Sem dono: as tropas ocupam na chegada, sem batalha.";
            return j;
        }
        var aoVivo = !alvo.Fantasma && vis.Contains(alvo.Hex);
        var esp = r.LocaisEspionados.GetValueOrDefault(alvo.Id);
        Dictionary<string, int> guarnicao; int civis, portoes; string fonte;
        if (aoVivo)
        {
            var dono = m.Reinos.Obter(alvo.ReinoId);
            guarnicao = GT.Limpo(alvo.Guarnicao);
            civis = dono != null ? (int)Combates.PopDoLocal(m, dono, alvo) : 0;
            portoes = alvo.Tipo == TipoLocal.Castelo ? Math.Clamp(alvo.Portoes, 0, Defesas.PortoesMax(m)) : 0;
            fonte = "vista";
        }
        else if (esp != null)
        {
            guarnicao = esp.Guarnicao.Count > 0 || esp.Tropas == 0 ? new(esp.Guarnicao) : new() { ["lanceiro"] = esp.Tropas };   // relatório antigo: só o total
            civis = esp.Civis > 0 || esp.Milicia == 0 ? esp.Civis : (int)Math.Round(esp.Milicia / Math.Max(1e-9, m.P.MiliciaPorPop));
            portoes = Math.Clamp(esp.Portoes, 0, Defesas.PortoesMax(m));
            fonte = "espionagem";
        }
        else
        {
            j["fonte"] = "nenhuma";
            j["texto"] = "Fora da vista e sem espionagem: a guarnição é desconhecida. Leve as tropas até perto (Reconhecer) ou mande um batedor.";
            return j;
        }
        j["fonte"] = fonte;
        if (esp != null) { j["espionadoEm"] = esp.Quando; j["espionadoHaH"] = Math.Round((m.Agora - esp.Quando) / (double)T.Hora, 1); }
        var g = new JsonObject();
        foreach (var (k, v) in guarnicao) g[k] = v;
        j["guarnicao"] = g;
        j["tropas"] = GT.Total(guarnicao);
        j["civis"] = civis;
        j["milicia"] = Math.Floor(civis * m.P.MiliciaPorPop + 1e-9);
        j["portoes"] = portoes;
        var bonusD = esp?.BonusD ?? 0;
        j["bonusDefesa"] = esp != null ? (JsonNode)Math.Round(bonusD, 3) : null;
        if (GT.Total(grupo) == 0) return j;
        var x = new ExtraDefesa { Pop = civis, ArqTorre = arqTorre, BonusD = bonusD, BonusA = bonusA, Portoes = portoes };
        double? lim = null;
        try { lim = Ataques.Limite(m, string.IsNullOrEmpty(tatica) ? m.P.Combate.TaticaPadrao : tatica); } catch (RegraException) { }
        var res = m.F.Batalha(grupo, guarnicao, x, lim);
        var razao = res.D > 0 ? res.A / res.D : double.PositiveInfinity;
        j["ataque"] = Math.Round(res.A);
        j["defesa"] = Math.Round(res.D);
        j["razao"] = double.IsPositiveInfinity(razao) ? null : (JsonNode)Math.Round(razao, 2);
        j["bonusAtaque"] = Math.Round(bonusA, 3);
        j["vence"] = res.VenceA;
        j["recuam"] = res.Recuou;
        j["perdasMinhas"] = Math.Round(res.PerdaA, 3);
        j["perdasDeles"] = Math.Round(res.PerdaD, 3);
        j["baixasMinhas"] = Combates.Perdas(grupo, res.PerdaA).Values.Sum();
        j["veredito"] = !res.VenceA ? "desvantagem" : razao >= 1.5 ? "vantagem" : "apertado";
        j["texto"] = Veredito(m, res, razao, fonte, esp != null);
        return j;
    }

    private static string Veredito(Mundo m, ResultadoBatalha res, double razao, string fonte, bool espionado)
    {
        var base_ = !res.VenceA
            ? (res.Recuou ? "A defesa é mais forte: pela tática, as tropas recuariam com " + Math.Round(res.PerdaA * 100) + "% de baixas." : "A defesa é mais forte: as tropas cairiam todas.")
            : razao >= 1.5 ? "Vantagem clara: perdas estimadas de " + Math.Round(res.PerdaA * 100) + "%."
            : "Vitória apertada: perdas estimadas de " + Math.Round(res.PerdaA * 100) + "%.";
        var ressalva = fonte == "vista"
            ? espionado ? "" : " Sem espionagem, os bônus de defesa (armaduras, veterania, relíquias) não entram."
            : " Pelo relatório de espionagem: a guarnição pode ter mudado.";
        return base_ + ressalva;
    }

    /// <summary>Linhas do relatório de reconhecimento (rótulo e valor).</summary>
    public static JsonArray Linhas(Mundo m, JsonObject e)
    {
        var l = new JsonArray();
        if (e["guarnicao"] is JsonObject g)
        {
            var d = g.ToDictionary(kv => kv.Key, kv => kv.Value!.GetValue<int>());
            l.Add(Fauna.Linha("Guarnição", d.Count > 0 ? GT.Partes(m, d) : "nenhuma à vista"));
        }
        if (e["milicia"] is JsonNode mil) l.Add(Fauna.Linha("Milícia", "≈ " + mil.GetValue<double>() + " (" + e["civis"]!.GetValue<int>() + " civis)"));
        l.Add(Fauna.Linha("Torres no alcance", e["torres"]!.GetValue<int>() + (e["arqueirosNoAlto"]!.GetValue<int>() > 0 ? " · " + e["arqueirosNoAlto"]!.GetValue<int>() + " arqueiros no alto" : "")));
        if (e["portoes"] is JsonNode po && po.GetValue<int>() > 0) l.Add(Fauna.Linha("Portões", "nível " + po.GetValue<int>()));
        if (e["ataque"] is JsonNode a) l.Add(Fauna.Linha("Força", a.GetValue<double>() + " das suas tropas contra " + e["defesa"]!.GetValue<double>() + " da defesa"));
        return l;
    }

    /// <summary>As tropas chegaram à vista do alvo: param ali e o reino recebe o relatório com a força inimiga à vista.</summary>
    public static void Chegou(Mundo m, Exercito ex)
    {
        ex.Parar(m);
        var r = m.Reinos.Obter(ex.ReinoId);
        var alvoHex = ex.Dados["alvoHex"] is JsonValue v && v.TryGetValue<int>(out var h) ? h : ex.Destino;
        var l = ex.AlvoLocalId is long id ? m.Locais.Obter(id) : null;
        if (r == null) return;
        if (l == null || l.Hex != alvoHex || (l.ReinoId == r.Id && !l.Ruina))
        {
            Exercitos.Avisar(m, ex, "Nada para reconhecer", "Não há mais local de outro reino no hexágono " + m.G.C(alvoHex) + ", " + m.G.L(alvoHex) + ". As tropas ficam paradas.");
            return;
        }
        var vis = Nevoas.VisiveisAgora(m, r.Id);
        var est = Estimar(m, r, l, ex.Tropas, Bonus.SomaAtaque(m, ex), m.P.Combate.TaticaPadrao, vis);
        var nome = Ataques.NomeAlvo(l);
        var dados = new JsonObject
        {
            ["resumo"] = (est["texto"]?.GetValue<string>() ?? "") + " As tropas esperam aqui: ataque ou mande voltar.",
            ["alvo"] = nome, ["alvoHex"] = alvoHex, ["hex"] = ex.Destino, ["marchaId"] = ex.Id,
            ["tropasEnviadas"] = RelatoriosCombate.Grupo(ex.Tropas), ["estimativa"] = est,
            ["linhas"] = Linhas(m, est),
        };
        Registros.Relatar(m, r.Id, "reconhecimento", "Reconhecimento: " + nome, dados, "tropas");
        m.Avisar(r.Id, "mapa");
    }
}

/// <summary>
/// Ordem "reconhecer": as tropas vão em direção a um local de outro reino e param à vista dele, a até
/// <see cref="Reconhecimentos.DistanciaMax"/> hexágonos (ou a visão do grupo), sem atacar. Na chegada, o relatório mostra a
/// guarnição, a milícia, as torres e a força estimada contra a delas; dali, o jogador ataca (ataque de tropa em campo) ou manda voltar.
/// </summary>
public sealed class OrdemReconhecer : IOrdemExercito
{
    public const string Id = "reconhecer";
    public string Ordem => Id;

    public void Validar(Mundo m, Reino r, Exercito ex, int destino)
    {
        var alvo = Ataques.Alvo(m, r, destino);
        ex.AlvoLocalId = alvo.Id;
        ex.Dados = new JsonObject { ["alvoHex"] = destino };
        ex.Estandarte = false;
    }

    public Rota Trajeto(Mundo m, Exercito ex, int destino, int de)
    {
        var d = Reconhecimentos.Distancia(m, ex.Tropas);
        if (m.G.Distancia(de, destino) <= d) throw new RegraException("As tropas já estão à vista do alvo: a força inimiga aparece na prévia do ataque.");
        var rota = Exercitos.Rota(m, ex, de, destino);
        var i = 0;
        while (i < rota.Hexes.Count - 1 && m.G.Distancia(rota.Hexes[i], destino) > d) i++;
        // não para dentro do próprio local
        while (i > 0 && m.LocalNoHex(rota.Hexes[i]) is { } l && l.Id == ex.AlvoLocalId) i--;
        if (i == 0) throw new RegraException("As tropas já estão à vista do alvo: a força inimiga aparece na prévia do ataque.");
        return new Rota(rota.Hexes.Take(i + 1).ToList(), rota.Minutos.Take(i + 1).ToList());
    }

    public void Chegou(Mundo m, Exercito ex) => Reconhecimentos.Chegou(m, ex);
}
