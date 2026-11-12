using System.Text.Json.Nodes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Api.Visoes;

/// <summary>
/// Combate como o reino o vê: prévia do ataque, batalhas e defesas próprias. Quem ataca é sempre conhecido; a defesa exata de
/// um local alheio, só pela espionagem.
/// </summary>
public static class VisaoCombate
{
    public sealed record PedidoObjetivo(string K, string? R, double? Q);
    public sealed record PedidoAtaque(long? DeLocalId, long? MarchaId, Dictionary<string, int>? Tropas, int? DestinoHex, int? C, int? L,
        string? Tipo, List<PedidoObjetivo>? Objetivos, string? Tatica, bool? Completar, bool? Seguro, List<long>? Pessoas = null, string? Divisao = null, bool? RecuarVazio = null);

    public static JsonObject Dados(PedidoAtaque p)
    {
        var arr = new JsonArray();
        foreach (var o in p.Objetivos ?? []) { var j = new JsonObject { ["k"] = o.K }; if (o.R != null) j["r"] = o.R; if (o.Q != null) j["q"] = o.Q; arr.Add((JsonNode?)j); }
        return new JsonObject { ["tipo"] = p.Tipo, ["objetivos"] = arr, ["tatica"] = p.Tatica, ["completar"] = p.Completar == true, ["divisao"] = p.Divisao, ["recuarVazio"] = p.RecuarVazio };
    }

    /// <summary>Prévia do envio: chegada, carga, objetivos normalizados, saque decrescente e avisos, sem enviar nada.</summary>
    public static object Previa(Mundo m, Reino r, PedidoAtaque p, int para)
    {
        var vis = Nevoas.VisiveisAgora(m, r.Id);
        var alvo = Ataques.Alvo(m, r, para);
        int de; Dictionary<string, int> grupo; double bonusA;
        if (p.MarchaId is long mid)
        {
            var ex = Exercitos.Do(m, r, mid);
            de = ex.HexEm(m.Agora);
            grupo = GT.Limpo(p.Pessoas is { Count: > 0 } && p.Tropas != null ? p.Tropas : ex.Tropas);   // só parte da tropa vai
            bonusA = Bonus.SomaAtaque(m, ex);
        }
        else
        {
            var l = m.Locais.Obter(p.DeLocalId ?? 0);
            if (l == null || l.ReinoId != r.Id) throw new RegraException("Local não é seu.", 404);
            de = l.Hex;
            grupo = GT.Limpo(p.Tropas);
            if (grupo.Count > 0) grupo = GT.Validar(m, l, grupo);
            bonusA = Reconhecimentos.BonusDoLocal(m, r, l, grupo);
        }
        string? bloqueio = null;
        try { Ataques.ValidarTropas(m, grupo); } catch (RegraException e) { bloqueio = e.Message; }
        if (!Ataques.SemDono(m, alvo) && m.Reinos.Obter(alvo.ReinoId) is { } donoAlvo) bloqueio ??= Permissoes.MotivoEnvio(m, r, donoAlvo);
        var plano = Ataques.Normalizar(m, alvo, PlanoAtaque.Ler(Dados(p)));
        var carga = GT.Carga(m, grupo);
        var vel = GT.Velocidade(m, grupo);
        var forca = GT.ForcaFauna(m, grupo);
        object Op(bool seguro)
        {
            if (grupo.Count == 0) return new global::ReinoDePedra.Api.Endpoints.PostConvitesPedirJson(ok: false);
            var rota = Caminhos.Calcular(m, de, para, vel, new OpcoesCaminho { Seguro = seguro, Forca = forca, ReinoId = r.Id });
            var ok = rota.Hexes[^1] == para;
            return new CombateOpJson(ok, min: ok ? Math.Round(rota.TotalMin, 1) : (double?)null, hexes: ok ? rota.Hexes.Count : 0, caminho: ok ? rota.Hexes : null);
        }
        var levaCarga = Ataques.LevaCarga(plano.Tipo);
        var recentes = levaCarga ? Ataques.SaquesRecentes(m, r, alvo.Id) : 0;
        var rendimento = Ataques.Rendimento(m, recentes);
        var nRecursos = plano.Objetivos.Count(o => o.K == "recurso");
        // o estoque do alvo não é conhecido aqui: a prévia diz só até quanto a carga comporta para cada recurso
        double? Ate(Objetivo o) => o.K != "recurso" || !levaCarga ? null : plano.Divisao == Ataques.DivisaoIgual ? Math.Floor(carga / Math.Max(1, nRecursos)) : carga;
        var torres = Reconhecimentos.TorresConhecidas(m, alvo);
        var avisos = new List<object>();
        if (levaCarga && recentes > 0)
            avisos.Add(new CombatePreviaJson(tipo: "alerta", texto: "Você saqueou este alvo " + recentes + (recentes > 1 ? " vezes" : " vez") + " nas últimas " + m.P.Combate.SaqueJanelaH + " h: rendimento " + Math.Round(rendimento * 100) + "%. Saques repetidos rendem cada vez menos."));
        if (plano.Objetivos.Any(o => o.K is "torre" or "portoes") && grupo.GetValueOrDefault("ariete") + grupo.GetValueOrDefault("trebuchet") == 0)
            avisos.Add(new CombatePreviaJson(tipo: "alerta", texto: "Sem aríetes nem trebuchets, torres e portões não sofrem dano."));
        if (torres.Count > 0)
            avisos.Add(new CombatePreviaJson(tipo: "info", texto: torres.Count + (torres.Count > 1 ? " torres cobrem" : " torre cobre") + " este local: arqueiros no alto atiram protegidos. Aríetes derrubam torres."));
        if (plano.Tipo is Ataques.Sabotagem or Ataques.Massacre)
            avisos.Add(new CombatePreviaJson(tipo: "info", texto: Ataques.NomesTipo[plano.Tipo] + " não leva relíquias. Para tomá-las, use saque, ocupação ou cerco."));
        if (!Ataques.SemDono(m, alvo))
            avisos.Add(new CombatePreviaJson(tipo: "info", texto: "Se o alvo estiver sob escudo de proteção, você só descobre ao chegar: as tropas voltam sem combate."));
        var presentes = plano.Objetivos.Select(o => o.Chave).ToHashSet();
        return new CombatePrevia2Json(
            alvo: new CombatePrevia2AlvoJson(
                hex: alvo.Hex, c: m.G.C(alvo.Hex), l: m.G.L(alvo.Hex), aoVivo: vis.Contains(alvo.Hex),
                nome: Ataques.NomeAlvo(alvo), local: alvo.Tipo.Chave(), produz: alvo.Produz, nivel: alvo.Ruina ? (int?)null : alvo.Nivel,
                dono: Ataques.SemDono(m, alvo) ? "livre" : "outro",
                reino: !Ataques.SemDono(m, alvo) && m.Reinos.Obter(alvo.ReinoId) is { } rd ? Espionagem.Identidade(rd) : null,
                castelo: alvo.Tipo == TipoLocal.Castelo && !alvo.Ruina,
                torres: torres.Select(t => new CombatePrevia2AlvoTorresJson(t.Hex, t.Nivel, t.Alcance))
            ),
            tipos: Ataques.TiposPara(m, alvo), bloqueio,
            plano: new CombatePrevia2PlanoJson(
                plano.Tipo, tipoNome: Ataques.NomesTipo[plano.Tipo], plano.Tatica, limite: Ataques.Limite(m, plano.Tatica), plano.Completar,
                plano.Divisao, plano.RecuarVazio,
                objetivos: plano.Objetivos.Select(o => new CombatePrevia2PlanoObjetivosJson(k: o.K, r: o.R, q: o.Q, ate: Ate(o), texto: Ataques.TextoObjetivo(m, o, alvo)))
            ),
            catalogo: Ataques.Catalogo(m, plano.Tipo).Where(o => !presentes.Contains(o.Chave))
                .Select(o => new CombatePrevia2CatalogoJson(k: o.K, r: o.R, q: o.Q, texto: Ataques.TextoObjetivo(m, o, alvo))),
            taticas: m.P.Combate.Taticas,
            tropas: grupo, total: GT.Total(grupo), carga, vel, forcaFauna: forca,
            curta: Op(false), segura: Op(true),
            forcaInimiga: Reconhecimentos.Estimar(m, r, alvo, grupo, bonusA, plano.Tatica, vis),
            saque: levaCarga ? new CombatePrevia2SaqueJson(recentes, rendimento) : null,
            avisos, quandoParam: Ataques.QuandoParam(m, plano, carga)
        );
    }

    // ---------------------------------------------------------------- batalhas

    public static string Papel(Batalha b, Reino r) => b.AtacanteId == r.Id ? "ataque" : "defesa";

    private static string ResultadoPara(Batalha b, string papel) => b.Resultado == null ? "" : papel == "ataque" ? b.Resultado
        : b.Resultado switch { "vitoria" => "derrota", "defesa-recuou" => "recuou", _ => "vitoria" };

    public static object Resumo(Mundo m, Reino r, Batalha b)
    {
        var papel = Papel(b, r);
        var l = m.Locais.Obter(b.LocalId);
        var plano = PlanoAtaque.Ler(b.Plano);
        return new CombateResumoJson(
            b.Id, papel, hex: b.Hex, nome: NomeLocal(m, r, b, l), tipo: plano.Tipo, tipoNome: Ataques.NomesTipo.GetValueOrDefault(plano.Tipo, ""),
            b.Inicio, fim: b.FimPrevisto, b.Encerrada, resultado: ResultadoPara(b, papel), b.EncerradaEm, frentes: Batalhas.Ativas(m, b.LocalId).Count
        );
    }

    /// <summary>O placar visto por um lado: "meu" e "eles", com o ritmo para o cliente andar sozinho entre uma busca e outra.</summary>
    public static object Vivo(Batalhas.Placar x, string papel)
    {
        var ataque = papel == "ataque";
        return new CombateVivoJson(
            t0: x.T0, p0: x.P0, dur: x.Dur, m: x.M, progresso: Math.Round(x.Progresso, 4),
            meu: new CombateVivoMeuJson(forca: ataque ? x.A : x.D, perda: ataque ? x.PerdaA : x.PerdaD, total: ataque ? x.TotalA : x.TotalD, baixa: ataque ? x.BaixaA : x.BaixaD, baixas: ataque ? x.BaixasA : x.BaixasD),
            eles: new CombateVivoMeuJson(forca: ataque ? x.D : x.A, perda: ataque ? x.PerdaD : x.PerdaA, total: ataque ? x.TotalD : x.TotalA, baixa: ataque ? x.BaixaD : x.BaixaA, baixas: ataque ? x.BaixasD : x.BaixasA)
        );
    }

    /// <summary>
    /// As frentes do local como este reino as vê: o defensor vê cada ataque e abre cada um; o atacante vê a própria frente e as
    /// outras forças no local, sem acesso a elas.
    /// </summary>
    public static List<object> Frentes(Mundo m, Reino r, Batalha b)
    {
        var agora = m.Agora;
        var lista = Batalhas.Ativas(m, b.LocalId);
        if (!lista.Any(x => x.Id == b.Id)) lista.Insert(0, b);
        return lista.Select(x =>
        {
            var propria = x.AtacanteId == r.Id;
            var defendo = x.DefensorId == r.Id;
            return (object)new CombateFrentesJson(
                id: propria || defendo ? x.Id : (long?)null, atual: x.Id == b.Id, propria,
                nome: propria ? "Suas tropas" : RelatoriosCombate.NomeAtacante(m, x.AtacanteId),
                tipoNome: propria || defendo ? Ataques.NomesTipo.GetValueOrDefault(PlanoAtaque.Ler(x.Plano).Tipo, "") : null,
                fim: x.FimPrevisto, parte: Math.Round((x.Marcos.LastOrDefault()?.Parte ?? 1) * 100),
                vivo: Vivo(Batalhas.PlacarDe(m, x, agora), defendo ? "defesa" : "ataque")
            );
        }).ToList();
    }

    private static string NomeLocal(Mundo m, Reino r, Batalha b, Local? l) =>
        l == null ? "Local" : r.Id == b.DefensorId || l.ReinoId == r.Id ? l.Nome : Ataques.NomeAlvo(l);

    public static object Batalha(Mundo m, Reino r, Batalha b)
    {
        var papel = Papel(b, r);
        var agora = m.Agora;
        var l = m.Locais.Obter(b.LocalId);
        var plano = PlanoAtaque.Ler(b.Plano);
        var (a, d) = Batalhas.ForcaAgora(b, agora);
        var ultimo = b.Marcos.LastOrDefault(x => x.T <= agora) ?? b.Marcos.LastOrDefault();
        var c = Batalhas.Compor(m, b);
        var minhaTropa = papel == "ataque" ? c.Ataque : c.Defesa;
        var delesTropa = papel == "ataque" ? c.Defesa : (b.Encerrada ? b.TropasAtaque : c.Ataque);
        string tendencia;
        if (b.Encerrada) tendencia = "";
        else if (ultimo == null) tendencia = "equilibrado";
        else
        {
            var venceA = ultimo.PerdaD >= 1 - 1e-9;
            var recua = !venceA && b.FimPrevisto < b.Fim;
            tendencia = papel == "ataque" ? (venceA ? "vencendo" : recua ? "recuo" : "perdendo") : (venceA ? "perdendo" : "vencendo");
        }
        var reforcos = new List<object>();
        if (!b.Encerrada && l != null)
            foreach (var x in m.LocaisDe(r.Id).Where(x => !x.Ruina && x.Id != l.Id && GT.Total(x.Guarnicao) > 0))
            {
                var g = papel == "ataque" ? x.Guarnicao.Where(kv => m.B.U.TryGetValue(kv.Key, out var u) && u.So != "defesa").ToDictionary(kv => kv.Key, kv => kv.Value) : GT.Limpo(x.Guarnicao);
                if (GT.Total(g) == 0) continue;
                var vel = GT.Velocidade(m, g);
                var rota = Caminhos.Calcular(m, x.Hex, l.Hex, vel, new OpcoesCaminho { Forca = GT.ForcaFauna(m, g), ReinoId = r.Id });
                if (rota.Hexes[^1] != l.Hex) continue;
                var chega = agora + (long)Math.Round(rota.TotalMin * T.Min);
                reforcos.Add(new CombateBatalhaJson(localId: x.Id, x.Nome, tropas: GT.Limpo(x.Guarnicao), vel, min: Math.Round(rota.TotalMin, 1), chega, aTempo: chega < b.FimPrevisto));
            }
        var defR = m.Reinos.Obter(b.DefensorId);
        var aRecuar = papel == "ataque" && !b.Encerrada && l != null && (plano.Tipo == Ataques.Saque)
            ? Ataques.SemOQueLevar(m, r, new PlanoAtaque { Tipo = plano.Tipo, Objetivos = plano.Objetivos, Completar = plano.Completar, RecuarVazio = true }, l) : null;
        return new CombateBatalha2Json(
            vivo: Vivo(Batalhas.PlacarDe(m, b, agora), papel), frentes: Frentes(m, r, b), semOQueLevar: aRecuar, motivoRecuo: papel == "ataque" ? b.MotivoRecuo : null,
            b.Id, papel, hex: b.Hex, c: m.G.C(b.Hex), lin: m.G.L(b.Hex), nome: NomeLocal(m, r, b, l), localId: papel == "defesa" ? b.LocalId : (long?)null,
            tipo: plano.Tipo, tipoNome: Ataques.NomesTipo.GetValueOrDefault(plano.Tipo, ""), tatica: papel == "ataque" ? plano.Tatica : null,
            agora, b.Inicio, fim: b.FimPrevisto, fimMax: b.Fim, b.Encerrada, resultado: ResultadoPara(b, papel), b.EncerradaEm,
            relatorioId: papel == "ataque" ? b.RelatorioAtaque : b.RelatorioDefesa,
            forca: new CombateBatalha2ForcaJson(meu: Math.Round(papel == "ataque" ? a : d), eles: Math.Round(papel == "ataque" ? d : a)),
            tendencia,
            meu: new CombateBatalha2MeuJson(
                tropas: minhaTropa,
                milicia: papel == "defesa" ? Math.Round(c.Extra.Pop * m.P.MiliciaPorPop) : 0,
                arqueirosNoAlto: papel == "defesa" ? c.Extra.ArqTorre : 0, portoes: papel == "defesa" ? c.Extra.Portoes : 0
            ),
            eles: new CombateBatalha2ElesJson(
                nome: papel == "defesa" ? RelatoriosCombate.NomeAtacante(m, b.AtacanteId) : "Defesa do local",
                atacante: papel == "defesa" ? RelatoriosCombate.Atacante(m, b.AtacanteId) : null,
                tropas: delesTropa,
                milicia: papel == "ataque" ? Math.Round(c.Extra.Pop * m.P.MiliciaPorPop) : 0,
                arqueirosNoAlto: papel == "ataque" ? c.Extra.ArqTorre : 0, portoes: papel == "ataque" ? c.Extra.Portoes : 0,
                direcao: papel == "defesa" ? m.G.Direcao(b.Hex, b.OrigemHex) : null
            ),
            serie: Batalhas.Serie(b, agora).Select(p => new CombateBatalha2SerieJson(t: p.T, meu: papel == "ataque" ? p.A : p.D, eles: papel == "ataque" ? p.D : p.A, proj: p.Projecao)),
            diario: b.Marcos.Where(x => x.Txt != null).Select(x => new CombateBatalha2DiarioJson(
                t: x.T - b.Inicio, txt: x.Txt, lado: x.Lado == null ? null : x.Lado == papel ? "meu" : "eles"
            )),
            podeRecuar: !b.Encerrada,
            reforcos,
            ordemReforco: papel == "ataque" ? OrdemAtacar.Id : OrdemReforcar.Id,
            defensorTemReino: defR != null
        );
    }

    // ---------------------------------------------------------------- defesas próprias

    public static object Defesas_(Mundo m, Reino r)
    {
        Economia.Atualizar(m, r);
        var c = m.Locais.Obter(r.CasteloId);
        object? castelo = null;
        if (c != null && c.ReinoId == r.Id)
        {
            var alvo = Defesas.NivelAlvoPortoes(r, c);
            castelo = new CombateCasteloJson(
                c.Id, c.Nome, c.Hex, portoes: c.Portoes, estrutura: c.EstruturaPortoes, estruturaMax: c.Portoes * m.P.PortoesEstrutura,
                max: Defesas.PortoesMax(m), multiplicador: c.Portoes > 0 ? m.P.Portoes[Math.Min(c.Portoes, Defesas.PortoesMax(m))] : 1,
                torres: Defesas.NoAlcance(m, c).Count, arqueirosNoAlto: Defesas.ArqueirosNoAlto(m, c),
                proximo: alvo > Defesas.PortoesMax(m) ? null : new CombateCasteloProximoJson(
                    nivel: alvo, custo: Defesas.CustoPortoes(m, alvo), seg: Defesas.TempoPortoes(m, alvo),
                    multiplicador: m.P.Portoes[alvo], bloqueio: Defesas.BloqueioPortoes(m, r, alvo)
                )
            );
        }
        var torres = Defesas.DoReino(m, r.Id).OrderBy(t => t.Id).Select(t =>
        {
            var alvo = Defesas.NivelAlvoTorre(r, t);
            return new CombateTorresJson(
                t.Id, t.Hex, c: m.G.C(t.Hex), l: m.G.L(t.Hex), t.Nivel, alcance: Defesas.Alcance(m, t), arqueiros: Defesas.Arqueiros(m, t),
                t.Estrutura, estruturaMax: Defesas.EstruturaCheia(m, t.Nivel),
                protege: Defesas.Protege(m, t).Select(l => new global::ReinoDePedra.Api.Endpoints.ContaReinoJson(l.Id, l.Nome)),
                proximo: alvo > m.P.Torre.NivelMax ? null : new CombateTorresProximoJson(
                    nivel: alvo, custo: m.F.CustoTorre(alvo), seg: m.F.TempoTorre(alvo), alcance: m.F.AlcanceTorre(alvo), arqueiros: alvo * m.P.Torre.ArqPorNivel
                )
            );
        }).ToList();
        var emObra = r.Fila(Obras.Fila).Itens.Where(i => i.Tipo is ObraTorre.Id or ObraTorreNivel.Id or ObraPortoes.Id)
            .Select(i => VisaoReino.Item(m, r, i)).ToList();
        return new CombateDefesas_Json(
            castelo, torres, emObra,
            novaTorre: new CombateDefesas_NovaTorreJson(
                custo: m.F.CustoTorre(1), seg: m.F.TempoTorre(1), alcance: m.F.AlcanceTorre(1), arqueiros: m.P.Torre.ArqPorNivel,
                distanciaMax: m.F.AlcanceTorre(1), estrutura: Defesas.EstruturaCheia(m, 1), bonusAlto: m.P.Torre.BonusAlto
            ),
            nivelMax: m.P.Torre.NivelMax
        );
    }
}

// Formato das respostas em JSON: o nome, a ordem e o tipo de cada membro são o contrato com o cliente.
public sealed record CombateOpJson(bool ok, double? min, int hexes, IReadOnlyList<int>? caminho);
public sealed record CombatePreviaJson(string tipo, string texto);
public sealed record CombatePrevia2Json(CombatePrevia2AlvoJson alvo, List<string> tipos, string? bloqueio, CombatePrevia2PlanoJson plano, IEnumerable<CombatePrevia2CatalogoJson> catalogo, Dictionary<string, double?> taticas, Dictionary<string, int> tropas, int total, double carga, string vel, double forcaFauna, object curta, object segura, JsonObject forcaInimiga, CombatePrevia2SaqueJson? saque, List<object> avisos, List<string> quandoParam);
public sealed record CombatePrevia2AlvoJson(int hex, int c, int l, bool aoVivo, string nome, string local, string? produz, int? nivel, string dono, JsonObject? reino, bool castelo, IEnumerable<CombatePrevia2AlvoTorresJson> torres);
public sealed record CombatePrevia2AlvoTorresJson(int Hex, int Nivel, int Alcance);
public sealed record CombatePrevia2PlanoJson(string Tipo, string tipoNome, string Tatica, double? limite, bool Completar, string Divisao, bool RecuarVazio, IEnumerable<CombatePrevia2PlanoObjetivosJson> objetivos);
public sealed record CombatePrevia2PlanoObjetivosJson(string k, string? r, double q, double? ate, string texto);
public sealed record CombatePrevia2CatalogoJson(string k, string? r, double q, string texto);
public sealed record CombatePrevia2SaqueJson(int recentes, double rendimento);
public sealed record CombateResumoJson(long Id, string papel, int hex, string nome, string tipo, string tipoNome, long Inicio, long fim, bool Encerrada, string resultado, long? EncerradaEm, int frentes);
public sealed record CombateVivoJson(long t0, double p0, long dur, double m, double progresso, CombateVivoMeuJson meu, CombateVivoMeuJson eles);
public sealed record CombateVivoMeuJson(double forca, double perda, int total, double baixa, int baixas);
public sealed record CombateFrentesJson(long? id, bool atual, bool propria, string nome, string? tipoNome, long fim, double parte, object vivo);
public sealed record CombateBatalhaJson(long localId, string Nome, Dictionary<string, int> tropas, string vel, double min, long chega, bool aTempo);
public sealed record CombateBatalha2Json(object vivo, List<object> frentes, string? semOQueLevar, string? motivoRecuo, long Id, string papel, int hex, int c, int lin, string nome, long? localId, string tipo, string tipoNome, string? tatica, long agora, long Inicio, long fim, long fimMax, bool Encerrada, string resultado, long? EncerradaEm, long? relatorioId, CombateBatalha2ForcaJson forca, string tendencia, CombateBatalha2MeuJson meu, CombateBatalha2ElesJson eles, IEnumerable<CombateBatalha2SerieJson> serie, IEnumerable<CombateBatalha2DiarioJson> diario, bool podeRecuar, List<object> reforcos, string ordemReforco, bool defensorTemReino);
public sealed record CombateBatalha2ForcaJson(double meu, double eles);
public sealed record CombateBatalha2MeuJson(Dictionary<string, int> tropas, double milicia, double arqueirosNoAlto, int portoes);
public sealed record CombateBatalha2ElesJson(string nome, JsonNode? atacante, Dictionary<string, int> tropas, double milicia, double arqueirosNoAlto, int portoes, string? direcao);
public sealed record CombateBatalha2SerieJson(long t, double meu, double eles, bool proj);
public sealed record CombateBatalha2DiarioJson(long t, string? txt, string? lado);
public sealed record CombateCasteloJson(long Id, string Nome, int Hex, int portoes, double estrutura, double estruturaMax, int max, double multiplicador, int torres, int arqueirosNoAlto, CombateCasteloProximoJson? proximo);
public sealed record CombateCasteloProximoJson(int nivel, Dictionary<string, double> custo, double seg, double multiplicador, string? bloqueio);
public sealed record CombateTorresJson(long Id, int Hex, int c, int l, int Nivel, int alcance, int arqueiros, double Estrutura, double estruturaMax, IEnumerable<Endpoints.ContaReinoJson> protege, CombateTorresProximoJson? proximo);
public sealed record CombateTorresProximoJson(int nivel, Dictionary<string, double> custo, double seg, int alcance, int arqueiros);
public sealed record CombateDefesas_Json(object? castelo, List<CombateTorresJson> torres, List<object> emObra, CombateDefesas_NovaTorreJson novaTorre, int nivelMax);
public sealed record CombateDefesas_NovaTorreJson(Dictionary<string, double> custo, double seg, int alcance, int arqueiros, int distanciaMax, double estrutura, double bonusAlto);
