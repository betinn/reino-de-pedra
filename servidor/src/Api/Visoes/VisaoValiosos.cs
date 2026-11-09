using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Valiosos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Api.Visoes;

/// <summary>
/// Transporte, extração, escavação e relíquias como o reino os vê. O servidor esconde o que o reino não sabe:
/// relíquias alheias só aparecem como brilho (área explorada) ou farol; marchas alheias com relíquia, com baú e sem tipo.
/// </summary>
public static class VisaoValiosos
{
    /// <summary>Relíquias de outros reinos conhecidas por espionagem (o sistema de espionagem registra aqui).</summary>
    public static List<Func<Mundo, Reino, IEnumerable<object>>> ReliquiasConhecidas { get; } = new();

    public static object Rota(Rota? r, int destino) =>
        r == null ? new { ok = false, min = (double?)null, hexes = 0, caminho = (IReadOnlyList<int>?)null }
            : new { ok = r.Hexes[^1] == destino, min = (double?)Math.Round(r.TotalMin, 1), hexes = r.Hexes.Count, caminho = (IReadOnlyList<int>?)r.Hexes };

    /// <summary>Caminho curto e seguro de um grupo entre dois hexágonos.</summary>
    public static object Viagem(Mundo m, long reinoId, int de, int para, string vel, double forca)
    {
        object Op(bool seguro) => de == para ? new { ok = true, min = (double?)0, hexes = 1, caminho = (IReadOnlyList<int>?)new[] { de } }
            : Rota(Caminhos.Calcular(m, de, para, vel, new OpcoesCaminho { Seguro = seguro, Forca = forca, ReinoId = reinoId }), para);
        return new { curta = Op(false), segura = Op(true) };
    }

    public static object Tipos(Mundo m) => new[] { "ataque", "producao", "resistencia" }.ToDictionary(k => k, k => new
    {
        nome = ReliquiasLendarias.NomeTipo(k), efeito = ReliquiasLendarias.Efeito(m, k), bonus = ReliquiasLendarias.Bonus(m, k),
    });

    // ---------------------------------------------------------------- relíquias

    public static object Reliquia(Mundo m, Reino r, Reliquia rel)
    {
        var l = rel.LocalId is long lid ? m.Locais.Obter(lid) : null;
        var mc = rel.MarchaId is long mid ? m.Marchas.Obter(mid) : null;
        var escolta = m.Marchas.OfType<Exercito>().FirstOrDefault(e => e.ReinoId == r.Id && e.Ordem == ReliquiasLendarias.OrdemBuscar
            && e.Dados["reliquiaId"]?.GetValue<long>() == rel.Id);
        var destinoEscolta = escolta?.Dados["destinoLocalId"]?.GetValue<long>() is long d ? m.Locais.Obter(d) : null;
        var ruina = m.Ruinas.Obter(rel.RuinaId);
        return new
        {
            rel.Id, rel.Nome, rel.Tipo, efeito = ReliquiasLendarias.Efeito(m, rel.Tipo), bonus = ReliquiasLendarias.Bonus(m, rel.Tipo),
            estado = mc != null ? "levada" : escolta != null ? "buscando" : "guardada",
            local = l == null ? null : new { l.Id, l.Nome, l.Hex, tipo = l.Tipo.Chave(), n = ReliquiasLendarias.Concentracoes(m).GetValueOrDefault(l.Id) },
            marcha = mc == null ? null : new { mc.Id, mc.Partida, mc.Chegada, destinoHex = mc.Destino, destino = VisaoTropas.NomeLocal(m, r, (mc as Exercito)?.AlvoLocalId), tropas = GT.Partes(m, mc.Tropas) },
            escolta = escolta == null ? null : new { escolta.Id, partida = escolta.Partida, coleta = escolta.Chegada, destino = destinoEscolta?.Nome, tropas = GT.Partes(m, escolta.Tropas) },
            origem = ruina != null ? "Escavada numa ruína antiga" : "Tomada de outro reino",
            rel.AchadaEm,
        };
    }

    public static object Reliquias(Mundo m, Reino r)
    {
        Economia.Atualizar(m, r);
        Apresentacao.Conferir(m, r);
        var vis = Nevoas.VisiveisAgora(m, r.Id);
        var nevoa = Nevoas.De(m, r.Id);
        var noMapa = ReliquiasLendarias.NoMapa(m, r.Id);
        var aVista = noMapa.Where(x => x.Tipo is "farol" or "brilho" && m.Locais.Obter(x.LocalId ?? 0)?.ReinoId != r.Id).Select(x =>
        {
            var l = m.Locais.Obter(x.LocalId!.Value)!;
            return new { localId = l.Id, x.Hex, c = m.G.C(x.Hex), l = m.G.L(x.Hex), x.N, x.Nivel, nome = Jogo.Combate.Ataques.NomeAlvo(l) };
        }).ToList();
        var minhasMarchas = noMapa.Where(x => x.Tipo == "marcha" && x.MarchaId is long id && m.Marchas.Obter(id)?.ReinoId != r.Id)
            .Select(x => new { marchaId = x.MarchaId, x.Hex, x.N }).ToList();
        var escav = Exercitos.De(m, r.Id).Where(e => e.EscavaRuinaId != null || e.Ordem == Escavacoes.OrdemEscavar).ToList();
        var ruinas = m.Ruinas.Where(ru => nevoa.MinutoVisto(ru.Hex) > 0).Select(ru =>
        {
            var g = escav.FirstOrDefault(e => e.EscavaRuinaId == ru.Id || (e.Ordem == Escavacoes.OrdemEscavar && e.Destino == ru.Hex));
            var idade = vis.Contains(ru.Hex) ? 0 : Nevoas.Minuto(m, m.Agora) - nevoa.MinutoVisto(ru.Hex);
            return new
            {
                ru.Id, ru.Hex, c = m.G.C(ru.Hex), l = m.G.L(ru.Hex), ru.Esgotada, idadeMin = idade,
                posto = Extracoes.PostoNoHex(m, ru.Hex) is { } p ? (p.ReinoId == r.Id ? "meu" : "outro") : null,
                escavando = g == null ? null : new
                {
                    g.Id, tropas = GT.Partes(m, g.Tropas), chegada = g.EscavaRuinaId == null ? g.Chegada : (long?)null, fim = g.EscavaFim,
                    partida = g.EscavaRuinaId == null ? g.Partida : (long?)null, inicio = g.EscavaInicio,
                    destino = VisaoTropas.NomeLocal(m, r, g.Dados["destinoLocalId"]?.GetValue<long>()),
                },
            };
        }).OrderBy(x => x.Esgotada).ThenBy(x => x.Id).ToList();
        return new
        {
            agora = m.Agora,
            minhas = global::ReinoDePedra.Jogo.Reinos.Reliquias.DoReino(m, r.Id).OrderBy(x => x.Id).Select(x => Reliquia(m, r, x)).ToList(),
            aVista, marchasAVista = minhasMarchas,
            conhecidas = ReliquiasConhecidas.SelectMany(f => f(m, r)).ToList(),
            ruinas, tipos = Tipos(m), noMundo = m.P.Reinos,
            farol = m.P.ReliquiaVis.Farol, escoltaMin = m.P.Caravana.EscoltaMin,
        };
    }

    /// <summary>Prévia de mover uma relíquia: buscar (de onde saem as tropas até ela) e levar (até o destino).</summary>
    public static object PreviaMover(Mundo m, Reino r, long reliquiaId, long deLocalId, IReadOnlyDictionary<string, int>? tropas, long destinoLocalId)
    {
        var rel = m.Reliquias.Obter(reliquiaId);
        if (rel == null || rel.ReinoId != r.Id) throw new RegraException("Relíquia não encontrada.", 404);
        var orig = rel.LocalId is long lid ? m.Locais.Obter(lid) : null;
        if (!Exercitos.LocalProprio(orig, r.Id)) throw new RegraException("A relíquia não está guardada num local seu.");
        var de = m.Locais.Obter(deLocalId);
        if (de == null || de.ReinoId != r.Id) throw new RegraException("Local não é seu.", 404);
        var dest = m.Locais.Obter(destinoLocalId);
        // como em ReliquiasLendarias.Mover: só para local próprio (o caminho e a concentração de um local alheio não vazam)
        if (dest != null && !Exercitos.LocalProprio(dest, r.Id)) throw new RegraException("Local não é seu.", 404);
        var g = GT.Limpo(tropas);
        var vel = GT.Velocidade(m, g);
        var forca = GT.ForcaFauna(m, g);
        var conc = ReliquiasLendarias.Concentracoes(m);
        var depois = dest != null ? conc.GetValueOrDefault(dest.Id) + 1 : 0;
        return new
        {
            vel, forca, poucoProtegida = Caravanas.PoucoProtegida(m, g), escoltaMin = m.P.Caravana.EscoltaMin,
            buscar = Viagem(m, r.Id, de.Hex, orig!.Hex, vel, forca),
            levar = dest == null ? null : Viagem(m, r.Id, orig.Hex, dest.Hex, vel, forca),
            depois, nivelDepois = ReliquiasLendarias.Nivel(m, depois),
        };
    }

    // ---------------------------------------------------------------- extração e escavação

    public static object Grupo(Mundo m, Reino r, Exercito e)
    {
        var j = e.ExtraiJazidaId is long jid ? m.Jazidas.Obter(jid) : null;
        double? ritmo = j != null ? Extracoes.Ritmo(m, e.Tropas, j.Recurso, Extracoes.TemPosto(m, r.Id, j.Hex), e.ExtraiRota == true) : null;
        var cheiaEm = e.ExtraiEventoId is long ev ? m.Eventos.Obter(ev)?.Quando : null;
        var estado = e.ExtraiJazidaId != null ? "extraindo" : e.EscavaRuinaId != null ? "escavando" : e.Ordem == Extracoes.OrdemEntregar ? "entregando" : "a caminho";
        return new
        {
            e.Id, e.Ordem, estado, hex = e.HexEm(m.Agora), e.Destino, tropas = e.Tropas, total = GT.Total(e.Tropas), resumo = GT.Partes(m, e.Tropas),
            carga = e.Carga.Arredondado(), cargaMax = e.CargaMax(m), ritmo, cheiaEm, chegada = e.Parado ? (long?)null : e.Chegada,
            partida = e.Parado ? (long?)null : e.Partida, extraiInicio = VisaoTropas.InicioExtracao(m, e, j),   // inícios das barras de tempo
            jazidaId = e.ExtraiJazidaId ?? e.Dados["jazidaId"]?.GetValue<long>(), ruinaId = e.EscavaRuinaId, escavaFim = e.EscavaFim, escavaInicio = e.EscavaInicio,
            repetir = e.Dados["repetir"]?.GetValue<bool>() == true, deposito = VisaoTropas.NomeLocal(m, r, e.Ordem == Extracoes.OrdemEntregar ? e.AlvoLocalId : null),
        };
    }

    public static object Extracao(Mundo m, Reino r)
    {
        Economia.Atualizar(m, r);
        var vis = Nevoas.VisiveisAgora(m, r.Id);
        var nevoa = Nevoas.De(m, r.Id);
        var agoraMin = Nevoas.Minuto(m, m.Agora);
        foreach (var j in m.Jazidas.Where(j => j.Extratores.Count > 0 && j.DescobertaPor.Contains(r.Id))) Extracoes.Liquidar(m, j);
        var grupos = Exercitos.De(m, r.Id).Where(e => e.ExtraiJazidaId != null || e.EscavaRuinaId != null
            || e.Ordem is Extracoes.OrdemExtrair or Extracoes.OrdemEntregar or Escavacoes.OrdemEscavar).OrderBy(e => e.Id).Select(e => Grupo(m, r, e)).ToList();
        var naFila = r.Fila(Obras.Fila).Itens.Where(i => i.Tipo == ObraPosto.Id).Select(i => i.Hex).ToHashSet();
        string? Posto(int hex) => Extracoes.PostoNoHex(m, hex) is { } p ? (p.ReinoId == r.Id ? "meu" : "outro") : naFila.Contains(hex) ? "fila" : null;
        int Idade(int h) => vis.Contains(h) ? 0 : agoraMin - nevoa.MinutoVisto(h);
        var jazidas = m.Jazidas.Where(j => j.DescobertaPor.Contains(r.Id)).Select(j => new
        {
            j.Id, j.Hex, c = m.G.C(j.Hex), l = m.G.L(j.Hex), j.Recurso, nome = "Jazida de " + Logistica.NomeRecurso(j.Recurso),
            valor = Extracoes.Valor(m, j.Recurso), restante = Math.Floor(j.Restante), inicial = j.Inicial,
            lendaria = j.Recurso == "minerio", posto = Posto(j.Hex), idadeMin = Idade(j.Hex),
            tropas = Extracoes.TropasNaJazida(m, j, r.Id, 0),
        }).OrderBy(x => x.restante <= 0).ThenBy(x => x.Id).ToList();
        var ruinas = m.Ruinas.Where(ru => nevoa.MinutoVisto(ru.Hex) > 0).Select(ru => new
        {
            ru.Id, ru.Hex, c = m.G.C(ru.Hex), l = m.G.L(ru.Hex), ru.Esgotada, posto = Posto(ru.Hex), idadeMin = Idade(ru.Hex),
        }).OrderBy(x => x.Esgotada).ThenBy(x => x.Id).ToList();
        return new
        {
            agora = m.Agora, jazidas, ruinas, grupos, maxTropas = m.P.Extracao.MaxTropas, reliquiaTipos = Tipos(m),
            posto = new { custo = m.P.Posto.Custo, seg = m.P.Posto.Tempo },
            escavar = new { horas1 = m.P.Reliquia.EscavarHoras1, minimo = m.P.Reliquia.EscavarMin },
        };
    }

    public static object PreviaExtracao(Mundo m, Reino r, long deLocalId, IReadOnlyDictionary<string, int>? tropas, int hex)
    {
        var l = m.Locais.Obter(deLocalId);
        if (l == null || l.ReinoId != r.Id) throw new RegraException("Local não é seu.", 404);
        var g = GT.Limpo(tropas);
        var vel = GT.Velocidade(m, g);
        var forca = GT.ForcaFauna(m, g);
        var viagem = Viagem(m, r.Id, l.Hex, hex, vel, forca);
        var um = g.Count > 0 ? new Dictionary<string, int> { [g.Keys.First()] = 1 } : new Dictionary<string, int>();
        var nomeUm = g.Count > 0 && m.B.U.TryGetValue(g.Keys.First(), out var u1) ? "1 " + GT.Nome(u1, 1) : "1 unidade";
        var j = Extracoes.Conhecida(m, r.Id, hex);
        var posto = Extracoes.TemPosto(m, r.Id, hex);
        if (j != null)
        {
            var dep = Extracoes.Deposito(m, r.Id, hex, vel, new OpcoesCaminho { Forca = forca, ReinoId = r.Id });
            var rota = dep is { } d && Extracoes.RotaNoCaminho(m, d.rota);
            double Rit(IReadOnlyDictionary<string, int> gg, bool p) => Extracoes.Ritmo(m, gg, j.Recurso, p, rota);
            var ritmo = Rit(g, posto);
            var cargaMax = GT.Carga(m, g);
            return new
            {
                tipo = "extracao", j.Recurso, valor = Extracoes.Valor(m, j.Recurso), restante = Math.Floor(j.Restante), posto, rota,
                ritmo, ritmoValor = ritmo * Extracoes.Valor(m, j.Recurso), cargaMax,
                horasCarga = ritmo > 0 ? cargaMax / ritmo : (double?)null, duraH = ritmo > 0 ? j.Restante / ritmo : (double?)null,
                cenarios = new[]
                {
                    new { nome = nomeUm + ", sem preparo", v = Rit(um, false), atual = false },
                    new { nome = "Seu grupo", v = Rit(g, false), atual = !posto },
                    new { nome = "Seu grupo + posto", v = Rit(g, true), atual = posto },
                },
                deposito = dep?.local.Nome, viagem, vel, forca, total = GT.Total(g),
                jaNaJazida = Extracoes.TropasNaJazida(m, j, r.Id, 0), maxTropas = m.P.Extracao.MaxTropas,
            };
        }
        var ru = Escavacoes.NoHex(m, hex);
        if (ru == null) throw new RegraException("Não há jazida conhecida nem ruína antiga neste hexágono.");
        var destinos = m.LocaisDe(r.Id).Where(x => !x.Ruina).Select(x =>
        {
            var rr = Caminhos.Calcular(m, hex, x.Hex, vel, new OpcoesCaminho { Forca = forca, ReinoId = r.Id });
            return new { x.Id, x.Nome, tipo = x.Tipo.Chave(), x.Produz, min = rr.Hexes[^1] == x.Hex ? Math.Round(rr.TotalMin, 1) : (double?)null, n = ReliquiasLendarias.Concentracoes(m).GetValueOrDefault(x.Id) };
        }).OrderBy(x => x.min ?? double.MaxValue).ToList();
        return new
        {
            tipo = "escavacao", esgotada = ru.Esgotada && Nevoas.Explorado(m, r.Id, hex), posto, horas = Escavacoes.Horas(m, g, posto),   // só indo ver se sabe se a ruína ainda guarda a relíquia
            cenarios = new[]
            {
                new { nome = nomeUm + ", sem preparo", v = Escavacoes.Horas(m, um, false), atual = false },
                new { nome = "Seu grupo", v = Escavacoes.Horas(m, g, false), atual = !posto },
                new { nome = "Seu grupo + posto", v = Escavacoes.Horas(m, g, true), atual = posto },
            },
            minimo = m.P.Reliquia.EscavarMin, viagem, vel, forca, total = GT.Total(g), destinos,
            poucoProtegida = Caravanas.PoucoProtegida(m, g),
        };
    }

    // ---------------------------------------------------------------- caravanas

    public static object PlanoCaravana(Mundo m, PlanoCaravana p) => new
    {
        ok = p.Problema == null, problema = p.Problema, capacidade = p.Capacidade, capVeiculos = p.CapVeiculos, capTropas = p.CapTropas,
        carga = p.Carga.Total, vel = p.Vel, forca = p.Forca, poucoProtegida = p.PoucoProtegida, escoltaMin = m.P.Caravana.EscoltaMin,
        baseLocalId = p.Base?.Id, buscar = p.Buscar == null ? null : Rota(p.Buscar, p.Origem!.Hex), levar = p.Levar == null ? null : Rota(p.Levar, p.Destino!.Hex),
        totalMin = Math.Round((p.Buscar?.TotalMin ?? 0) + (p.Levar?.TotalMin ?? 0), 1),
    };
}
