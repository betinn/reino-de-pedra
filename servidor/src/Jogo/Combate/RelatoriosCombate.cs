using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Combate;

/// <summary>
/// Relatórios de combate. Atacante: cada objetivo (cumprido, parcial, falhou), o que obteve, por que voltou, perdas,
/// feridos. Defensor: ANÔNIMO ("Forças desconhecidas", tropas vistas, tipo, direção de origem); a identidade só aparece
/// com estandarte. Tipos "ataque" e "defesa", categoria de notificação "batalhas".
/// </summary>
public static class RelatoriosCombate
{
    private static string N(double v) => Combates.Num(Math.Round(v));

    public static JsonObject Grupo(IReadOnlyDictionary<string, int> g)
    {
        var o = new JsonObject();
        foreach (var (k, n) in GT.Limpo(g)) o[k] = n;
        return o;
    }
    private static JsonObject Rec(IReadOnlyDictionary<string, double> r)
    {
        var o = new JsonObject();
        foreach (var (k, v) in r) if (v >= 1) o[k] = Math.Floor(v + 1e-9);
        return o;
    }
    private static JsonObject Linha(string r, string v) => new() { ["rotulo"] = r, ["valor"] = v };
    private static string Recursos(IReadOnlyDictionary<string, double> r) =>
        string.Join(", ", r.Where(kv => kv.Value >= 1).Select(kv => N(Math.Floor(kv.Value + 1e-9)) + " de " + Logistica.NomeRecurso(kv.Key)));

    /// <summary>Quem o defensor vê: "Forças desconhecidas", ou o reino quando há estandarte.</summary>
    public static JsonNode? Atacante(Mundo m, long reinoId, bool estandarte)
    {
        if (!estandarte) return null;
        var r = m.Reinos.Obter(reinoId);
        if (r == null) return null;
        return new JsonObject
        {
            ["id"] = r.Id, ["nome"] = r.Nome, ["iconeProprio"] = r.IconeProprio, ["iconeVersao"] = r.IconeVersao,
            ["brasao"] = new JsonObject
            {
                ["forma"] = r.Brasao.Forma, ["divisao"] = r.Brasao.Divisao, ["cor1"] = r.Brasao.Cor1, ["cor2"] = r.Brasao.Cor2,
                ["simbolo"] = r.Brasao.Simbolo, ["corSimbolo"] = r.Brasao.CorSimbolo,
            },
        };
    }
    public static string NomeAtacante(Mundo m, long reinoId, bool estandarte) =>
        estandarte && m.Reinos.Obter(reinoId) is { } r ? "Exército de " + r.Nome : "Forças desconhecidas";

    public static JsonArray Serie(Batalha b, long agora)
    {
        var a = new JsonArray();
        foreach (var p in Batalhas.Serie(b, agora)) a.Add(new JsonObject { ["t"] = p.T, ["a"] = p.A, ["d"] = p.D, ["p"] = p.Projecao });
        return a;
    }

    /// <summary>As tropas chegaram e voltaram sem combate (escudo, pacto, aliança, alvo sumiu).</summary>
    public static void SemCombate(Mundo m, Exercito ex, Local? l, PlanoAtaque plano, string motivo, Reino? def)
    {
        var tipoNome = Ataques.NomesTipo.GetValueOrDefault(plano.Tipo, "Ataque");
        var nome = l != null ? Ataques.NomeAlvo(l) : "alvo";
        var dados = new JsonObject
        {
            ["resumo"] = motivo + " As tropas voltaram sem combate.",
            ["papel"] = "ataque", ["tipo"] = plano.Tipo, ["tipoNome"] = tipoNome, ["resultado"] = "sem-combate", ["alvo"] = nome,
            ["tropas"] = new JsonObject { ["enviadas"] = Grupo(ex.Tropas), ["perdas"] = new JsonObject() },
            ["porQueVoltaram"] = motivo,
            ["linhas"] = new JsonArray(Linha("Tropas", GT.Partes(m, ex.Tropas)), Linha("Por que voltaram", motivo)),
        };
        if (l != null) dados["hex"] = l.Hex;
        Registros.Relatar(m, ex.ReinoId, "ataque", tipoNome + " a " + nome + ": sem combate", dados, "batalhas");
        if (def == null || l == null || l.ReinoId != def.Id) return;
        var quem = NomeAtacante(m, ex.ReinoId, ex.Estandarte);
        var dd = new JsonObject
        {
            ["resumo"] = quem + " chegaram a " + l.Nome + " e voltaram sem combate.",
            ["papel"] = "defesa", ["tipo"] = plano.Tipo, ["tipoNome"] = tipoNome, ["resultado"] = "sem-combate", ["local"] = l.Nome, ["hex"] = l.Hex,
            ["atacante"] = Atacante(m, ex.ReinoId, ex.Estandarte),
            ["tropasVistas"] = Grupo(ex.Tropas), ["direcao"] = m.G.Direcao(l.Hex, ex.Origem),
            ["linhas"] = new JsonArray(Linha("Forças", quem), Linha("Tropas vistas", GT.Partes(m, ex.Tropas)), Linha("Vindas do", m.G.Direcao(l.Hex, ex.Origem))),
        };
        Registros.Relatar(m, def.Id, "defesa", l.Nome + ": forças voltaram sem combate", dd, "ataques");
    }

    /// <summary>Ocupação de ruína ou terra livre (sem batalha).</summary>
    public static void Ocupacao(Mundo m, Reino r, Local l, string nomeAntes, string partes, List<string> reliquias)
    {
        var dados = new JsonObject
        {
            ["resumo"] = "Suas tropas tomaram " + nomeAntes.ToLowerInvariant() + ". O local agora é seu." + (reliquias.Count > 0 ? " Relíquias no local: " + string.Join(", ", reliquias) + "." : ""),
            ["papel"] = "ataque", ["tipo"] = Ataques.Ocupacao, ["tipoNome"] = "Ocupação", ["resultado"] = "vitoria", ["alvo"] = nomeAntes, ["hex"] = l.Hex,
            ["objetivos"] = new JsonArray(new JsonObject { ["texto"] = "Tomar o local", ["estado"] = "cumprido", ["obtido"] = "sem defesa" }),
            ["porQueVoltaram"] = "Tomaram o local e ficaram nele como guarnição.",
            ["linhas"] = new JsonArray(Linha("Tropas", partes), Linha("Local", l.Nome)),
        };
        Registros.Relatar(m, r.Id, "ataque", "Ocupação: " + nomeAntes + " tomada", dados, "batalhas");
    }

    /// <summary>Relatórios dos dois lados ao fim da batalha.</summary>
    public static void Batalha(Mundo m, Batalha b, Batalhas.Composicao c, PlanoAtaque plano, ResultadoCombate rc, ResultadoBatalha full,
        Dictionary<string, int> feridosA, Dictionary<string, int> feridosD, ResumoEfeitos ef, string modo)
    {
        var l = c.Local;
        var agora = m.Agora;
        var tipoNome = Ataques.NomesTipo.GetValueOrDefault(plano.Tipo, "Ataque");
        var nomeGenerico = l != null ? (ef.Ocupou ? l.Tipo.NomeGenerico() : Ataques.NomeAlvo(l)) : "alvo";
        var res = rc.Resultado;
        var serie = Serie(b, agora);
        var levaram = Recursos(ef.Levaram);
        var defesaTxt = GT.Partes(m, rc.TropasDefesa);
        var milicia = c.Extra.Pop * m.P.MiliciaPorPop;

        // ---------------- atacante
        var titA = tipoNome + " a " + nomeGenerico + ": " + res switch { "vitoria" => "vitória", "defesa-recuou" => "a defesa fugiu", "recuo" => "recuo", _ => "derrota" };
        var resumoA = res switch
        {
            "vitoria" or "defesa-recuou" => (res == "defesa-recuou" ? "A defesa recuou. " : "Vitória. ") +
                (ef.Ocupou ? "O local é seu." : levaram.Length > 0 ? "Levaram " + levaram + "." : ef.Reliquias.Count > 0 ? "" : "Nada para levar."),
            "recuo" => "Recuaram com " + Math.Round(100 * Pct(rc.PerdasAtaque, rc.TropasAtaque)) + "% de baixas.",
            _ => "Derrota: as tropas caíram.",
        };
        if (ef.Reliquias.Count > 0 && !ef.Ocupou) resumoA += " Relíquia: " + string.Join(", ", ef.Reliquias) + ".";
        var objs = new JsonArray();
        foreach (var o in ef.Objetivos) objs.Add(new JsonObject { ["texto"] = o.Texto, ["estado"] = o.Estado, ["obtido"] = o.Obtido });
        var dA = new JsonObject
        {
            ["resumo"] = resumoA, ["papel"] = "ataque", ["tipo"] = plano.Tipo, ["tipoNome"] = tipoNome, ["resultado"] = res,
            ["alvo"] = nomeGenerico, ["batalhaId"] = b.Id, ["estandarte"] = b.Estandarte, ["tatica"] = plano.Tatica,
            ["forcas"] = new JsonObject { ["ataque"] = Math.Round(full.A), ["defesa"] = Math.Round(full.D) },
            ["tropas"] = new JsonObject { ["enviadas"] = Grupo(rc.TropasAtaque), ["perdas"] = Grupo(rc.PerdasAtaque), ["feridos"] = Grupo(feridosA) },
            ["defesa"] = new JsonObject
            {
                ["tropas"] = Grupo(rc.TropasDefesa), ["perdas"] = Grupo(rc.PerdasDefesa), ["milicia"] = Math.Round(milicia),
                ["arqueirosNoAlto"] = c.Extra.ArqTorre, ["portoes"] = c.Extra.Portoes,
            },
            ["objetivos"] = objs, ["porQueVoltaram"] = ef.PorQue,
            ["levaram"] = Rec(ef.Levaram), ["reliquias"] = new JsonArray(ef.Reliquias.Select(x => (JsonNode)x).ToArray()),
            ["rendimento"] = ef.Rendimento, ["serie"] = serie,
            ["linhas"] = new JsonArray(
                Linha("Tropas", GT.Partes(m, rc.TropasAtaque)),
                Linha("Perdas", rc.PerdasAtaque.Count > 0 ? GT.Partes(m, rc.PerdasAtaque) : "nenhuma"),
                Linha("Defesa vista", (defesaTxt.Length > 0 ? defesaTxt : "sem tropas") + " · milícia " + N(milicia) + (c.Extra.ArqTorre > 0 ? " · " + N(c.Extra.ArqTorre) + " arqueiros no alto" : "") + (c.Extra.Portoes > 0 ? " · portões " + c.Extra.Portoes : "")),
                Linha("Por que voltaram", ef.PorQue)),
        };
        if (l != null) dA["hex"] = l.Hex;
        if (feridosA.Count > 0) ((JsonArray)dA["linhas"]!).Add(Linha("Feridos", GT.Partes(m, feridosA)));
        b.RelatorioAtaque = Registros.Relatar(m, b.AtacanteId, "ataque", titA, dA, "batalhas").Id;

        // ---------------- defensor (anônimo sem estandarte)
        if (m.Reinos.Obter(b.DefensorId) == null) return;
        var quem = NomeAtacante(m, b.AtacanteId, b.Estandarte);
        var nomeLocal = l?.ReinoId == b.DefensorId || ef.Ocupou || ef.LocalDestruido ? l?.Nome ?? "local" : l?.Nome ?? "local";
        var direcao = l != null ? m.G.Direcao(l.Hex, b.OrigemHex) : "";
        var resD = res switch { "vitoria" => "derrota", "defesa-recuou" => "recuou", "recuo" => "vitoria", _ => "vitoria" };
        var titD = "Defesa de " + nomeLocal + ": " + resD switch { "vitoria" => "vitória", "recuou" => "recuo", _ => "derrota" };
        var danos = new List<string>();
        if (ef.Ocupou) danos.Add("o local foi tomado");
        if (ef.LocalDestruido) danos.Add("o local foi destruído");
        else if (ef.NiveisPerdidos > 0) danos.Add("−" + ef.NiveisPerdidos + (ef.NiveisPerdidos > 1 ? " níveis" : " nível"));
        if (ef.TorresDerrubadas > 0) danos.Add(ef.TorresDerrubadas + (ef.TorresDerrubadas > 1 ? " torres derrubadas" : " torre derrubada"));
        if (ef.TorresDanificadas > 0) danos.Add(ef.TorresDanificadas + (ef.TorresDanificadas > 1 ? " torres danificadas" : " torre danificada"));
        if (ef.PortoesPerdidos > 0) danos.Add("portões −" + ef.PortoesPerdidos);
        if (ef.Mortos > 0) danos.Add(N(ef.Mortos) + " mortos no massacre");
        var resumoD = quem + " (" + tipoNome.ToLowerInvariant() + ", vindas do " + direcao + "). " + resD switch
        {
            "vitoria" => res == "recuo" ? "Os atacantes recuaram." : "A defesa venceu.",
            "recuou" => "Você recuou: tropas e população salvas, o local foi saqueado.",
            _ => "A defesa caiu.",
        } + (levaram.Length > 0 ? " Levaram " + levaram + "." : "") + (ef.Reliquias.Count > 0 && !ef.Ocupou ? " Levaram a relíquia " + string.Join(", ", ef.Reliquias) + "." : "");
        var dD = new JsonObject
        {
            ["resumo"] = resumoD, ["papel"] = "defesa", ["tipo"] = plano.Tipo, ["tipoNome"] = tipoNome, ["resultado"] = resD,
            ["local"] = nomeLocal, ["batalhaId"] = b.Id, ["atacante"] = Atacante(m, b.AtacanteId, b.Estandarte),
            ["tropasVistas"] = Grupo(b.TropasAtaque), ["direcao"] = direcao,
            ["forcas"] = new JsonObject { ["ataque"] = Math.Round(full.A), ["defesa"] = Math.Round(full.D) },
            ["perdas"] = new JsonObject { ["guarnicao"] = Grupo(rc.PerdasDefesa), ["milicia"] = rc.MiliciaMorta, ["feridos"] = Grupo(feridosD), ["atacantes"] = Grupo(rc.PerdasAtaque) },
            ["levaram"] = Rec(ef.Levaram), ["reliquias"] = new JsonArray(ef.Reliquias.Select(x => (JsonNode)x).ToArray()),
            ["danos"] = new JsonArray(danos.Select(x => (JsonNode)x).ToArray()), ["serie"] = Serie(b, agora),
            ["linhas"] = new JsonArray(
                Linha("Forças", quem),
                Linha("Tropas vistas", GT.Partes(m, b.TropasAtaque)),
                Linha("Vindas do", direcao),
                Linha("Suas perdas", (rc.PerdasDefesa.Count > 0 ? GT.Partes(m, rc.PerdasDefesa) : "nenhuma tropa") + (rc.MiliciaMorta > 0 ? " · " + N(rc.MiliciaMorta) + " da milícia" : "")),
                Linha("Baixas deles", rc.PerdasAtaque.Count > 0 ? GT.Partes(m, rc.PerdasAtaque) : "nenhuma")),
        };
        if (l != null) dD["hex"] = l.Hex;
        if (danos.Count > 0) ((JsonArray)dD["linhas"]!).Add(Linha("Danos", string.Join(", ", danos)));
        if (feridosD.Count > 0) ((JsonArray)dD["linhas"]!).Add(Linha("Feridos", GT.Partes(m, feridosD)));
        b.RelatorioDefesa = Registros.Relatar(m, b.DefensorId, "defesa", titD, dD, "batalhas").Id;
    }

    private static double Pct(IReadOnlyDictionary<string, int> perdas, IReadOnlyDictionary<string, int> total)
    {
        var t = GT.Total(total);
        return t > 0 ? GT.Total(perdas) / (double)t : 0;
    }
}
