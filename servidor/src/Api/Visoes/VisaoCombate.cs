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
/// Combate como o reino o vê: prévia do ataque, batalhas (anônimas para o defensor sem estandarte) e defesas próprias.
/// Nada aqui revela o dono de um local alheio nem a identidade de quem ataca sem estandarte.
/// </summary>
public static class VisaoCombate
{
    public sealed record PedidoObjetivo(string K, string? R, double? Q);
    public sealed record PedidoAtaque(long? DeLocalId, long? MarchaId, Dictionary<string, int>? Tropas, int? DestinoHex, int? C, int? L,
        string? Tipo, List<PedidoObjetivo>? Objetivos, string? Tatica, bool? Completar, bool? Estandarte, bool? Seguro);

    public static JsonObject Dados(PedidoAtaque p)
    {
        var arr = new JsonArray();
        foreach (var o in p.Objetivos ?? []) { var j = new JsonObject { ["k"] = o.K }; if (o.R != null) j["r"] = o.R; if (o.Q != null) j["q"] = o.Q; arr.Add(j); }
        return new JsonObject { ["tipo"] = p.Tipo, ["objetivos"] = arr, ["tatica"] = p.Tatica, ["completar"] = p.Completar == true, ["estandarte"] = p.Estandarte == true };
    }

    /// <summary>Torres que cobrem o local e que o reino conhece (viu ao vivo ou já tinha visto).</summary>
    public static List<Torre> TorresConhecidas(Mundo m, Reino r, Local l, HashSet<int>? vis = null)
    {
        vis ??= Nevoas.VisiveisAgora(m, r.Id);
        return Defesas.NoAlcance(m, l).Where(t => t.ReinoId == r.Id || t.ConhecidaPor.Contains(r.Id) || vis.Contains(t.Hex)).ToList();
    }

    /// <summary>Prévia do envio: chegada, carga, objetivos normalizados, saque decrescente e avisos, sem enviar nada.</summary>
    public static object Previa(Mundo m, Reino r, PedidoAtaque p, int para)
    {
        var vis = Nevoas.VisiveisAgora(m, r.Id);
        var alvo = Ataques.Alvo(m, r, para, vis);
        // fora da vista, o alvo aparece como a foto da névoa o guarda (último estado conhecido)
        var foto = vis.Contains(para) ? null : Ataques.FotoDoLocal(m, r, para);
        int de; Dictionary<string, int> grupo;
        if (p.MarchaId is long mid)
        {
            var ex = Exercitos.Do(m, r, mid);
            de = ex.HexEm(m.Agora); grupo = GT.Limpo(ex.Tropas);
        }
        else
        {
            var l = m.Locais.Obter(p.DeLocalId ?? 0);
            if (l == null || l.ReinoId != r.Id) throw new RegraException("Local não é seu.", 404);
            de = l.Hex;
            grupo = GT.Limpo(p.Tropas);
            if (grupo.Count > 0) grupo = GT.Validar(m, l, grupo);
        }
        string? bloqueio = null;
        try { Ataques.ValidarTropas(m, grupo); } catch (RegraException e) { bloqueio = e.Message; }
        if (!Ataques.SemDono(m, alvo)) bloqueio ??= Permissoes.MotivoEnvio(m, r, m.Reinos.Obter(alvo.ReinoId)!);
        var plano = Ataques.Normalizar(m, alvo, grupo, PlanoAtaque.Ler(Dados(p)));
        var carga = GT.Carga(m, grupo);
        var vel = GT.Velocidade(m, grupo);
        var forca = GT.ForcaFauna(m, grupo);
        object Op(bool seguro)
        {
            if (grupo.Count == 0) return new { ok = false };
            var rota = Caminhos.Calcular(m, de, para, vel, new OpcoesCaminho { Seguro = seguro, Forca = forca, ReinoId = r.Id });
            var ok = rota.Hexes[^1] == para;
            return new { ok, min = ok ? Math.Round(rota.TotalMin, 1) : (double?)null, hexes = ok ? rota.Hexes.Count : 0, caminho = ok ? rota.Hexes : null };
        }
        var levaCarga = Ataques.LevaCarga(plano.Tipo);
        var recentes = levaCarga ? Ataques.SaquesRecentes(m, r, alvo.Id) : 0;
        var rendimento = Ataques.Rendimento(m, recentes);
        var cargaObj = plano.Objetivos.Where(o => o.K == "recurso").Sum(o => o.Q);
        var torres = TorresConhecidas(m, r, alvo, vis);
        var avisos = new List<object>();
        if (levaCarga && recentes > 0)
            avisos.Add(new { tipo = "alerta", texto = "Você saqueou este alvo " + recentes + (recentes > 1 ? " vezes" : " vez") + " nas últimas " + m.P.Combate.SaqueJanelaH + " h: rendimento " + Math.Round(rendimento * 100) + "%. Saques repetidos rendem cada vez menos." });
        if (levaCarga && cargaObj > carga && grupo.Count > 0)
            avisos.Add(new { tipo = "alerta", texto = "Os objetivos passam da carga. As tropas param quando a carga encher: leve mais tropas (a cavalaria carrega mais) ou reduza." });
        if (plano.Objetivos.Any(o => o.K is "torre" or "portoes") && grupo.GetValueOrDefault("ariete") + grupo.GetValueOrDefault("trebuchet") == 0)
            avisos.Add(new { tipo = "alerta", texto = "Sem aríetes nem trebuchets, torres e portões não sofrem dano." });
        if (torres.Count > 0)
            avisos.Add(new { tipo = "info", texto = torres.Count + (torres.Count > 1 ? " torres cobrem" : " torre cobre") + " este local: arqueiros no alto atiram protegidos. Aríetes derrubam torres." });
        if (plano.Tipo is Ataques.Sabotagem or Ataques.Massacre)
            avisos.Add(new { tipo = "info", texto = Ataques.NomesTipo[plano.Tipo] + " não leva relíquias. Para tomá-las, use saque, ocupação ou cerco." });
        if (!Ataques.SemDono(m, alvo))
            avisos.Add(new { tipo = "info", texto = "Se o alvo estiver sob escudo de proteção, você só descobre ao chegar: as tropas voltam sem combate." });
        var presentes = plano.Objetivos.Select(o => o.Chave).ToHashSet();
        return new
        {
            alvo = new
            {
                hex = alvo.Hex, c = m.G.C(alvo.Hex), l = m.G.L(alvo.Hex), aoVivo = foto == null,
                nome = foto != null ? (string?)foto["nome"] : Ataques.NomeAlvo(alvo),
                local = foto != null ? (string?)foto["local"] : alvo.Tipo.Chave(), produz = foto != null ? null : alvo.Produz,
                dono = foto != null ? (string?)foto["dono"] : Ataques.SemDono(m, alvo) ? "livre" : "desconhecido",
                castelo = foto != null ? (string?)foto["local"] == TipoLocal.Castelo.Chave() && foto["ruina"]?.GetValue<bool>() != true : alvo.Tipo == TipoLocal.Castelo && !alvo.Ruina,
                torres = torres.Select(t => new { t.Hex, t.Nivel, alcance = Defesas.Alcance(m, t) }),
            },
            tipos = Ataques.TiposPara(m, alvo), bloqueio,
            plano = new
            {
                plano.Tipo, tipoNome = Ataques.NomesTipo[plano.Tipo], plano.Tatica, limite = Ataques.Limite(m, plano.Tatica), plano.Completar, plano.Estandarte,
                objetivos = plano.Objetivos.Select(o => new { k = o.K, r = o.R, q = o.Q, texto = Ataques.TextoObjetivo(m, o, alvo) }),
            },
            catalogo = Ataques.Catalogo(m, plano.Tipo, carga).Where(o => !presentes.Contains(o.Chave))
                .Select(o => new { k = o.K, r = o.R, q = o.Q, texto = Ataques.TextoObjetivo(m, o, alvo) }),
            taticas = m.P.Combate.Taticas,
            tropas = grupo, total = GT.Total(grupo), carga, cargaObjetivos = cargaObj, vel, forcaFauna = forca,
            curta = Op(false), segura = Op(true),
            saque = levaCarga ? new { recentes, rendimento } : null,
            avisos, quandoParam = Ataques.QuandoParam(m, plano, carga),
            defensorVera = plano.Estandarte ? new { nome = "Reino de " + r.Nome, brasao = r.Brasao, identificado = true } : new { nome = "Forças desconhecidas", brasao = (Brasao?)null, identificado = false },
        };
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
        return new
        {
            b.Id, papel, hex = b.Hex, nome = NomeLocal(m, r, b, l), tipo = plano.Tipo, tipoNome = Ataques.NomesTipo.GetValueOrDefault(plano.Tipo, ""),
            b.Inicio, fim = b.FimPrevisto, b.Encerrada, resultado = ResultadoPara(b, papel), b.EncerradaEm,
        };
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
                reforcos.Add(new { localId = x.Id, x.Nome, tropas = GT.Limpo(x.Guarnicao), vel, min = Math.Round(rota.TotalMin, 1), chega, aTempo = chega < b.FimPrevisto });
            }
        var defR = m.Reinos.Obter(b.DefensorId);
        return new
        {
            b.Id, papel, hex = b.Hex, c = m.G.C(b.Hex), lin = m.G.L(b.Hex), nome = NomeLocal(m, r, b, l), localId = papel == "defesa" ? b.LocalId : (long?)null,
            tipo = plano.Tipo, tipoNome = Ataques.NomesTipo.GetValueOrDefault(plano.Tipo, ""), tatica = papel == "ataque" ? plano.Tatica : null,
            agora, b.Inicio, fim = b.FimPrevisto, fimMax = b.Fim, b.Encerrada, resultado = ResultadoPara(b, papel), b.EncerradaEm,
            relatorioId = papel == "ataque" ? b.RelatorioAtaque : b.RelatorioDefesa,
            forca = new { meu = Math.Round(papel == "ataque" ? a : d), eles = Math.Round(papel == "ataque" ? d : a) },
            tendencia,
            meu = new
            {
                tropas = minhaTropa,
                milicia = papel == "defesa" ? Math.Round(c.Extra.Pop * m.P.MiliciaPorPop) : 0,
                arqueirosNoAlto = papel == "defesa" ? c.Extra.ArqTorre : 0, portoes = papel == "defesa" ? c.Extra.Portoes : 0,
            },
            eles = new
            {
                nome = papel == "defesa" ? RelatoriosCombate.NomeAtacante(m, b.AtacanteId, b.Estandarte) : "Defesa do local",
                atacante = papel == "defesa" ? RelatoriosCombate.Atacante(m, b.AtacanteId, b.Estandarte) : null,
                tropas = delesTropa,
                milicia = papel == "ataque" ? Math.Round(c.Extra.Pop * m.P.MiliciaPorPop) : 0,
                arqueirosNoAlto = papel == "ataque" ? c.Extra.ArqTorre : 0, portoes = papel == "ataque" ? c.Extra.Portoes : 0,
                direcao = papel == "defesa" ? m.G.Direcao(b.Hex, b.OrigemHex) : null,
            },
            serie = Batalhas.Serie(b, agora).Select(p => new { t = p.T, meu = papel == "ataque" ? p.A : p.D, eles = papel == "ataque" ? p.D : p.A, proj = p.Projecao }),
            diario = b.Marcos.Where(x => x.Txt != null).Select(x => new
            {
                t = x.T - b.Inicio, txt = x.Txt, lado = x.Lado == null ? null : x.Lado == papel ? "meu" : "eles",
            }),
            podeRecuar = !b.Encerrada,
            reforcos,
            ordemReforco = papel == "ataque" ? OrdemAtacar.Id : OrdemReforcar.Id,
            defensorTemReino = defR != null,
        };
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
            castelo = new
            {
                c.Id, c.Nome, c.Hex, portoes = c.Portoes, estrutura = c.EstruturaPortoes, estruturaMax = c.Portoes * m.P.PortoesEstrutura,
                max = Defesas.PortoesMax(m), multiplicador = c.Portoes > 0 ? m.P.Portoes[Math.Min(c.Portoes, Defesas.PortoesMax(m))] : 1,
                torres = Defesas.NoAlcance(m, c).Count, arqueirosNoAlto = Defesas.ArqueirosNoAlto(m, c),
                proximo = alvo > Defesas.PortoesMax(m) ? null : new
                {
                    nivel = alvo, custo = Defesas.CustoPortoes(m, alvo), seg = Defesas.TempoPortoes(m, alvo),
                    multiplicador = m.P.Portoes[alvo], bloqueio = Defesas.BloqueioPortoes(m, r, alvo),
                },
            };
        }
        var torres = Defesas.DoReino(m, r.Id).OrderBy(t => t.Id).Select(t =>
        {
            var alvo = Defesas.NivelAlvoTorre(r, t);
            return new
            {
                t.Id, t.Hex, c = m.G.C(t.Hex), l = m.G.L(t.Hex), t.Nivel, alcance = Defesas.Alcance(m, t), arqueiros = Defesas.Arqueiros(m, t),
                t.Estrutura, estruturaMax = Defesas.EstruturaCheia(m, t.Nivel),
                protege = Defesas.Protege(m, t).Select(l => new { l.Id, l.Nome }),
                proximo = alvo > m.P.Torre.NivelMax ? null : new
                {
                    nivel = alvo, custo = m.F.CustoTorre(alvo), seg = m.F.TempoTorre(alvo), alcance = m.F.AlcanceTorre(alvo), arqueiros = alvo * m.P.Torre.ArqPorNivel,
                },
            };
        }).ToList();
        var emObra = r.Fila(Obras.Fila).Itens.Where(i => i.Tipo is ObraTorre.Id or ObraTorreNivel.Id or ObraPortoes.Id)
            .Select(i => VisaoReino.Item(m, r, i)).ToList();
        return new
        {
            castelo, torres, emObra,
            novaTorre = new
            {
                custo = m.F.CustoTorre(1), seg = m.F.TempoTorre(1), alcance = m.F.AlcanceTorre(1), arqueiros = m.P.Torre.ArqPorNivel,
                distanciaMax = m.F.AlcanceTorre(1), estrutura = Defesas.EstruturaCheia(m, 1), bonusAlto = m.P.Torre.BonusAlto,
            },
            nivelMax = m.P.Torre.NivelMax,
        };
    }
}
