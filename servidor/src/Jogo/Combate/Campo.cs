using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

using PS = ReinoDePedra.Jogo.Pessoas.Pessoas;

namespace ReinoDePedra.Jogo.Combate;

/// <summary>Resultado de um combate em campo (interceptação ou postura agressiva).</summary>
public sealed record ResultadoCampo(string Resultado, ResultadoBatalha Formula, Dictionary<string, int> PerdasAtaque, Dictionary<string, int> PerdasDefesa,
    Recursos Levaram, List<string> Reliquias)
{
    public bool AtacanteVenceu => Resultado == "vitoria";
}

/// <summary>
/// Combate em campo: um exército alcança uma marcha no caminho (interceptação, ou uma guarnição/exército em postura
/// agressiva). Resolvido na hora com <c>m.F.Batalha</c>: ataque de quem alcança (Bonus.Ataque) contra a defesa das tropas da
/// marcha (Bonus.DefesaExercito se ela for um exército). Quem alcança recua no limite da tática; a marcha luta até cair.
/// Se a marcha perde, <see cref="Marcha.AoSerVencida"/> entrega a carga e as relíquias. Feridos e veterania valem como
/// numa batalha; o defensor recebe relatório anônimo (sem estandarte).
/// </summary>
public static class Campo
{
    private static string N(double v) => Combates.Num(Math.Round(v));

    /// <param name="atacante">Exército que alcança. Pode ser provisório (não está no mapa: saída de uma guarnição).</param>
    /// <param name="motivo">Texto curto para os relatórios ("Interceptação", "Postura: atacar qualquer ameaça"...).</param>
    public static ResultadoCampo Lutar(Mundo m, Exercito atacante, Marcha alvo, string tatica, string motivo)
    {
        var atkR = m.Reinos.Obter(atacante.ReinoId);
        var defR = m.Reinos.Obter(alvo.ReinoId);
        if (atkR != null) Economia.Atualizar(m, atkR);
        if (defR != null) Economia.Atualizar(m, defR);
        var hex = alvo.HexEm(m.Agora);
        var atkG = GT.Limpo(atacante.Tropas);
        var defG = GT.Limpo(alvo.Tropas);
        var extra = new ExtraDefesa
        {
            BonusA = Bonus.SomaAtaque(m, atacante),
            BonusD = alvo is Exercito ea ? Bonus.SomaDefesaExercito(m, ea) : 0,
        };
        var lim = Ataques.Limite(m, tatica);
        var res = m.F.Batalha(atkG, defG, extra, lim);
        var perdasA = Combates.Perdas(atkG, res.PerdaA);
        var perdasD = Combates.Perdas(defG, res.PerdaD);
        var caidasA = PS.Baixas(m, atacante, perdasA);
        var caidasD = PS.Baixas(m, alvo, perdasD);
        m.Sujar(atacante); m.Sujar(alvo);
        var resultado = res.VenceA ? "vitoria" : res.Recuou ? "recuo" : "derrota";

        // feridos: de quem vence ou recua pela tática (quem perde sem recuar não tem feridos)
        var feridosA = res.VenceA || res.Recuou ? Combates.Feridos(m, perdasA) : new();
        var feridosD = !res.VenceA ? Combates.Feridos(m, perdasD) : new();
        var (_, feridasA) = PS.Enterrar(m, caidasA, feridosA);
        var (_, feridasD) = PS.Enterrar(m, caidasD, feridosD);
        if (atkR != null && feridosA.Count > 0) foreach (var f in Combates.AoFerir) f(m, atkR, feridosA, null, feridasA);
        if (defR != null && feridosD.Count > 0) foreach (var f in Combates.AoFerir) f(m, defR, feridosD, null, feridasD);

        // veterania dos dois lados
        var fracA = GT.Total(atkG) > 0 ? GT.Total(perdasA) / (double)GT.Total(atkG) : 1;
        var fracD = GT.Total(defG) > 0 ? GT.Total(perdasD) / (double)GT.Total(defG) : 1;
        Veterania.Aplicar(m, PS.SoldadosDaMarcha(m, atacante), res.VenceA, fracA, res.A, res.D);
        if (alvo is Exercito && GT.Total(defG) > 0) Veterania.Aplicar(m, PS.SoldadosDaMarcha(m, alvo), !res.VenceA, fracD, res.D, res.A);

        var levaram = new Recursos();
        var rels = new List<string>();
        var tipoAlvo = alvo.Tipo;
        if (res.VenceA)
        {
            var cargaAntes = atacante.Carga.Copia();
            var relsAntes = alvo.Reliquias.ToList();
            alvo.AoSerVencida(m, atacante);
            foreach (var (k, v) in atacante.Carga) { var d = v - cargaAntes.Qtd(k); if (d > 1e-9) levaram.Somar(k, d); }
            foreach (var id in relsAntes)
                if (m.Reliquias.Obter(id) is { } rel)
                {
                    rels.Add(rel.Nome);
                    if (m.Marchas.ContemId(atacante.Id)) Reliquias.Carregar(m, rel, atacante);
                }
        }
        else if (GT.Total(atacante.Tropas) == 0)
        {
            // quem alcançou caiu: o que levava fica com a marcha
            foreach (var id in atacante.Reliquias.ToList())
                if (m.Reliquias.Obter(id) is { } rel && m.Marchas.ContemId(alvo.Id)) Reliquias.Carregar(m, rel, alvo);
            atacante.Reliquias.Clear();
        }

        var rc = new ResultadoCombate(0, 0, atacante.ReinoId, alvo.ReinoId, "interceptacao", resultado, res.A, res.D, atkG, defG, perdasA, perdasD, 0);
        foreach (var f in Combates.AoTerminar) f(m, rc);
        Relatar(m, atacante, alvo, tipoAlvo, hex, motivo, tatica, resultado, res, atkG, defG, perdasA, perdasD, feridosA, feridosD, levaram, rels);
        m.Avisar(atacante.ReinoId, "marchas"); m.Avisar(alvo.ReinoId, "marchas");
        m.Avisar(atacante.ReinoId, "reino"); m.Avisar(alvo.ReinoId, "reino");
        return new ResultadoCampo(resultado, res, perdasA, perdasD, levaram, rels);
    }

    /// <summary>Nome do que foi alcançado, como o atacante vê (sem dono).</summary>
    public static string NomeMarcha(string tipo) => tipo switch
    {
        "exercito" => "um exército", "carregadores" => "carregadores", "caravana" => "uma caravana", _ => "uma marcha",
    };

    private static void Relatar(Mundo m, Exercito atk, Marcha alvo, string tipoAlvo, int hex, string motivo, string tatica, string resultado, ResultadoBatalha res,
        Dictionary<string, int> atkG, Dictionary<string, int> defG, Dictionary<string, int> perdasA, Dictionary<string, int> perdasD,
        Dictionary<string, int> feridosA, Dictionary<string, int> feridosD, Recursos levaram, List<string> rels)
    {
        static JsonObject L(string r, string v) => new() { ["rotulo"] = r, ["valor"] = v };
        var levTxt = string.Join(", ", levaram.Where(kv => kv.Value >= 1).Select(kv => N(Math.Floor(kv.Value + 1e-9)) + " de " + Logistica.NomeRecurso(kv.Key)));
        var nomeAlvo = NomeMarcha(tipoAlvo);
        var porQue = resultado switch
        {
            "vitoria" => "Venceram " + nomeAlvo + (levTxt.Length > 0 ? " e tomaram a carga." : "."),
            "recuo" => "Recuaram ao chegar ao limite da tática (" + Math.Round((Ataques.Limite(m, tatica) ?? 1) * 100) + "% de baixas).",
            _ => "Foram derrotados.",
        };
        var objs = new JsonArray(new JsonObject
        {
            ["texto"] = "Vencer " + nomeAlvo, ["estado"] = resultado == "vitoria" ? "cumprido" : "falhou",
            ["obtido"] = resultado == "vitoria" ? (levTxt.Length > 0 ? levTxt : "sem carga") + (rels.Count > 0 ? " · relíquia " + string.Join(", ", rels) : "") : porQue,
        });
        var levObj = new JsonObject();
        foreach (var (k, v) in levaram) if (v >= 1) levObj[k] = Math.Floor(v + 1e-9);
        var dA = new JsonObject
        {
            ["resumo"] = motivo + ": " + (resultado == "vitoria" ? "vitória contra " + nomeAlvo + "." + (levTxt.Length > 0 ? " Levaram " + levTxt + "." : "") : resultado == "recuo" ? "recuaram." : "derrota."),
            ["papel"] = "ataque", ["tipo"] = "interceptacao", ["tipoNome"] = motivo, ["resultado"] = resultado, ["alvo"] = nomeAlvo, ["hex"] = hex,
            ["estandarte"] = atk.Estandarte, ["tatica"] = tatica,
            ["forcas"] = new JsonObject { ["ataque"] = Math.Round(res.A), ["defesa"] = Math.Round(res.D) },
            ["tropas"] = new JsonObject { ["enviadas"] = RelatoriosCombate.Grupo(atkG), ["perdas"] = RelatoriosCombate.Grupo(perdasA), ["feridos"] = RelatoriosCombate.Grupo(feridosA) },
            ["defesa"] = new JsonObject { ["tropas"] = RelatoriosCombate.Grupo(defG), ["perdas"] = RelatoriosCombate.Grupo(perdasD), ["milicia"] = 0, ["arqueirosNoAlto"] = 0, ["portoes"] = 0 },
            ["objetivos"] = objs, ["porQueVoltaram"] = porQue, ["levaram"] = levObj,
            ["reliquias"] = new JsonArray(rels.Select(x => (JsonNode)x).ToArray()),
            ["linhas"] = new JsonArray(L("Tropas", GT.Partes(m, atkG)), L("Perdas", perdasA.Count > 0 ? GT.Partes(m, perdasA) : "nenhuma"),
                L("Eles", (defG.Count > 0 ? GT.Partes(m, defG) : "sem tropas") + " · " + nomeAlvo), L("Por que", porQue)),
        };
        if (atk.ReinoId != 0 && m.Reinos.Obter(atk.ReinoId) != null)
            Registros.Relatar(m, atk.ReinoId, "ataque", motivo + ": " + (resultado == "vitoria" ? "vitória" : resultado == "recuo" ? "recuo" : "derrota"), dA, "batalhas");
        if (m.Reinos.Obter(alvo.ReinoId) == null) return;
        var quem = RelatoriosCombate.NomeAtacante(m, atk.ReinoId, atk.Estandarte);
        var resD = resultado == "vitoria" ? "derrota" : "vitoria";
        var seus = tipoAlvo switch { "carregadores" => "Seus carregadores", "caravana" => "Sua caravana", _ => "Suas tropas" };
        var dD = new JsonObject
        {
            ["resumo"] = quem + " alcançaram " + seus.ToLowerInvariant() + " no caminho. " + (resD == "vitoria" ? "Elas venceram e seguiram." : "Perderam" + (levTxt.Length > 0 ? ": levaram " + levTxt : "") + (rels.Count > 0 ? " e a relíquia " + string.Join(", ", rels) : "") + "."),
            ["papel"] = "defesa", ["tipo"] = "interceptacao", ["tipoNome"] = "Interceptação", ["resultado"] = resD, ["local"] = seus + " em campo", ["hex"] = hex,
            ["atacante"] = RelatoriosCombate.Atacante(m, atk.ReinoId, atk.Estandarte), ["tropasVistas"] = RelatoriosCombate.Grupo(atkG),
            ["forcas"] = new JsonObject { ["ataque"] = Math.Round(res.A), ["defesa"] = Math.Round(res.D) },
            ["perdas"] = new JsonObject { ["guarnicao"] = RelatoriosCombate.Grupo(perdasD), ["milicia"] = 0, ["feridos"] = RelatoriosCombate.Grupo(feridosD), ["atacantes"] = RelatoriosCombate.Grupo(perdasA) },
            ["levaram"] = levObj.DeepClone(), ["reliquias"] = new JsonArray(rels.Select(x => (JsonNode)x).ToArray()), ["danos"] = new JsonArray(),
            ["linhas"] = new JsonArray(L("Forças", quem), L("Tropas vistas", GT.Partes(m, atkG)), L("Suas perdas", perdasD.Count > 0 ? GT.Partes(m, perdasD) : "nenhuma")),
        };
        Registros.Relatar(m, alvo.ReinoId, "defesa", seus + " alcançad" + (tipoAlvo switch { "caravana" => "a", "carregadores" => "os", _ => "as" }) + ": " + (resD == "vitoria" ? "vitória" : "derrota"), dD, "ataques");
    }
}
