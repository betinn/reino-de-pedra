using System.Text.Json.Nodes;
using ReinoDePedra.Api.Visoes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;
using PS = ReinoDePedra.Jogo.Pessoas.Pessoas;

namespace ReinoDePedra.Api.Endpoints;

public sealed record PedidoCurar(int? Qtd);
public sealed record PedidoInterceptar(long MarchaId, long? DeLocalId, long? ExercitoId, Dictionary<string, int>? Tropas, string? Tatica, bool? Estandarte, List<long>? Pessoas = null);
public sealed record PedidoModelo(string? Nome, string? Tipo, string? Tatica, bool? Estandarte, bool? Completar, Dictionary<string, int>? Tropas,
    List<VisaoCombate.PedidoObjetivo>? Objetivos);

/// <summary>Feridos e cura, interceptação, modelos de ataque e exílio (combate, parte 2).</summary>
public sealed class ModuloGuerra : IModuloApi
{
    public void Mapear(RouteGroupBuilder publico, RouteGroupBuilder conta)
    {
        conta.MapGet("/feridos", async (HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m => VisaoGuerra.Feridos(m, Sessao.ReinoDa(m, id))), Json.Web);
        });

        conta.MapPost("/feridos/curar", async (PedidoCurar p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                return VisaoReino.Item(m, r, Jogo.Combate.Feridos.Curar(m, r, p.Qtd));
            }), Json.Web, statusCode: 201);
        });

        conta.MapPost("/interceptacao/previa", async (PedidoInterceptar p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m => VisaoGuerra.PreviaInterceptar(m, Sessao.ReinoDa(m, id), p)), Json.Web);
        });

        conta.MapPost("/interceptacao", async (PedidoInterceptar p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                var alvo = Interceptacoes.Alvo(m, r, p.MarchaId);
                var dados = new JsonObject { ["marchaId"] = p.MarchaId, ["tatica"] = p.Tatica, ["estandarte"] = p.Estandarte == true };
                int de; IReadOnlyDictionary<string, int> grupo; Dictionary<string, int>? tropas = p.Tropas;
                PS.Escolha? escolha = null;
                if (p.ExercitoId is long eid) { var ex0 = Exercitos.Do(m, r, eid); de = ex0.HexEm(m.Agora); grupo = ex0.Tropas; }
                else
                {
                    var l = m.Locais.Obter(p.DeLocalId ?? 0);
                    if (l == null || l.ReinoId != r.Id) throw new RegraException("Local não é seu.", 404);
                    (tropas, escolha) = EnvioPessoas.Ler(m, r, l.Id, p.Pessoas, p.Tropas);
                    de = l.Hex; grupo = GT.Validar(m, l, tropas);
                }
                using var _ = escolha;
                var e = Interceptacoes.Calcular(m, de, grupo, alvo) ?? throw new RegraException("Não alcançam a tempo: use tropas mais rápidas.");
                Exercito ex;
                if (p.ExercitoId is long mid) { Exercitos.DarOrdem(m, r, mid, OrdemInterceptar.Id, e.Hex, false, dados); ex = Exercitos.Do(m, r, mid); }
                else ex = Exercitos.Enviar(m, r, p.DeLocalId ?? 0, tropas, e.Hex, OrdemInterceptar.Id, false, dados);
                return VisaoTropas.Exercito(m, ex);
            }), Json.Web, statusCode: 201);
        });

        conta.MapGet("/ataques/modelos", async (HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m => VisaoGuerra.Modelos(m, Sessao.ReinoDa(m, id))), Json.Web);
        });

        conta.MapPost("/ataques/modelos", async (PedidoModelo p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                var objs = (p.Objetivos ?? []).Select(o => new Objetivo(o.K ?? "", o.R, o.Q ?? 0));
                return ModelosAtaque.ParaJson(ModelosAtaque.Salvar(m, r, p.Nome, p.Tipo, p.Tatica, p.Estandarte == true, p.Completar == true, p.Tropas, objs));
            }), Json.Web, statusCode: 201);
        });

        conta.MapDelete("/ataques/modelos/{mid:long}", async (long mid, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            await motor.Executar(m => ModelosAtaque.Apagar(m, Sessao.ReinoDa(m, id), mid));
            return Results.NoContent();
        });

        conta.MapGet("/exilio", async (HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m => VisaoGuerra.Queda(m, Sessao.ReinoDa(m, id))), Json.Web);
        });

        conta.MapPost("/exilio/visto", async (HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                if (r.UltimaQueda is { Vista: false } q) { q.Vista = true; m.Sujar(r); m.Avisar(r.Id, "reino"); }
            });
            return Results.NoContent();
        });
    }
}

/// <summary>Combate parte 2 no estado do reino, nos locais e no mapa (feridos, veterania, avistamentos, queda).</summary>
[Sistema]
public static class ExtrasGuerra
{
    public static void AoIniciar(Mundo m) => Sistemas.UmaVez("api-guerra", () =>
    {
        VisaoReino.Extras.Add((mm, r, d) =>
        {
            d["feridos"] = new
            {
                total = Jogo.Combate.Feridos.Total(r), emCura = Jogo.Combate.Feridos.EmCura(r),
                morreEm = r.Feridos.Count > 0 ? r.Feridos.Min(l => l.MorreEm) : (long?)null,
            };
            d["veterania"] = new
            {
                marcas = mm.P.Veterania.Marcas, bonus = mm.P.Veterania.Bonus,
                locais = mm.LocaisDe(r.Id).ToDictionary(l => l.Id.ToString(), l => Math.Round(Veterania.DoLocal(mm, l), 2)),
                exercitos = Exercitos.De(mm, r.Id).ToDictionary(e => e.Id.ToString(), e => Math.Round(Veterania.DaMarcha(mm, e), 2)),
            };
            var vistas = ForcasVistas.De(mm, r.Id).OrderByDescending(f => f.Quando).ToList();
            d["avistamentos"] = new { n = vistas.Count, hex = vistas.FirstOrDefault()?.Hex, quando = vistas.FirstOrDefault()?.Quando };
            d["queda"] = r.UltimaQueda is { Vista: false } q ? new { q.Exilio, q.Quando } : null;
            d["escudoExilio"] = r.UltimaQueda is { Exilio: true } qe && qe.EscudoAte == r.EscudoAte && r.EscudoAte > mm.Agora;
            d["ultimoAtaque"] = r.UltimoAtaque is { } u ? VisaoGuerra.ResumoModelo(mm, r, u) : null;
        });
        VisaoMapa.Extras.Add((mm, r, vis) =>
        {
            var vivas = mm.Marchas.Where(x => x.ReinoId != r.Id && vis.Contains(x.HexEm(mm.Agora))).Select(x => x.Id).ToHashSet();
            return ForcasVistas.De(mm, r.Id).Where(f => !vivas.Contains(f.MarchaId)).Select(f => (object)new
            {
                tipo = "avistamento", id = f.Id, hex = f.Hex, avistado = "tropas", marcha = f.Marcha, quando = f.Quando, ate = f.Ate,
                tamanho = VisaoMapa.Aproximado(m, f.Tropas), rumo = f.Rumo,
            }).ToList();
        });
    });
}

/// <summary>Visões da parte 2 do combate. Nada aqui revela dono de marcha alheia nem identidade sem estandarte.</summary>
public static class VisaoGuerra
{
    public static object Feridos(Mundo m, Reino r)
    {
        Economia.Atualizar(m, r);
        var p = m.P.Feridos;
        return new
        {
            agora = m.Agora,
            lotes = r.Feridos.OrderBy(l => l.MorreEm).Select(l => new { l.Id, unidades = l.Unidades, l.Origem, l.Desde, l.MorreEm, total = GT.Total(l.Unidades) }),
            total = Jogo.Combate.Feridos.Total(r), emCura = Jogo.Combate.Feridos.EmCura(r),
            cura = r.Filas.TryGetValue(Jogo.Combate.Feridos.Fila, out var f) ? f.Itens.Select(i => VisaoReino.Item(m, r, i)).ToList() : [],
            ervas = Math.Floor(Economia.TotalGuardado(m, r).Qtd("ervas")), porFerido = p.Ervas, curaSeg = p.CuraH * 3600, esperaH = p.EsperaH, frac = p.Frac,
            podem = Jogo.Combate.Feridos.Podem(m, r),
        };
    }

    public static object PreviaInterceptar(Mundo m, Reino r, PedidoInterceptar p)
    {
        var vis = Nevoas.VisiveisAgora(m, r.Id);
        var alvo = Interceptacoes.Alvo(m, r, p.MarchaId, vis);
        int de; Dictionary<string, int> grupo;
        if (p.ExercitoId is long eid) { var ex = Exercitos.Do(m, r, eid); de = ex.HexEm(m.Agora); grupo = GT.Limpo(ex.Tropas); }
        else
        {
            var l = m.Locais.Obter(p.DeLocalId ?? 0);
            if (l == null || l.ReinoId != r.Id) throw new RegraException("Local não é seu.", 404);
            de = l.Hex; grupo = GT.Limpo(p.Tropas);
            if (grupo.Count > 0) grupo = GT.Validar(m, l, grupo);
        }
        string? bloqueio = null;
        try { Ataques.ValidarTropas(m, grupo); } catch (RegraException e) { bloqueio = e.Message; }
        var enc = grupo.Count > 0 && bloqueio == null ? Interceptacoes.Calcular(m, de, grupo, alvo) : null;
        // até quando a marcha fica à vista pelo caminho conhecido (depois some na névoa)
        long? some = null;
        var agora = m.Agora;
        for (var i = 0; i < alvo.Caminho.Count; i++)
            if (alvo.Tempos[i] >= agora && !vis.Contains(alvo.Caminho[i])) { some = alvo.Tempos[i]; break; }
        return new
        {
            agora,
            alvo = new
            {
                id = alvo.Id, marcha = alvo.Tipo, nome = Campo.NomeMarcha(alvo.Tipo), hex = alvo.HexEm(agora), tamanho = VisaoMapa.Aproximado(m, GT.Total(alvo.Tropas)),
                some, chegada = VisaoMapa.ParaMim(m, r, alvo) ? alvo.Chegada : (long?)null, rumo = alvo.Caminho.Count > 1 ? m.G.Direcao(alvo.HexEm(agora), alvo.Destino) : null,
                carga = alvo.Carga.Total >= 1, forcasDesconhecidas = true,
            },
            bloqueio, tropas = grupo, total = GT.Total(grupo), vel = GT.Velocidade(m, grupo), forca = Math.Round(m.F.ValorAtaque(grupo, new Dictionary<string, int>(), 0)),
            carga = GT.Carga(m, grupo), folgaSeg = m.P.Guerra.Interceptacao.FolgaSeg,
            encontro = enc == null ? null : new
            {
                hex = enc.Hex, c = m.G.C(enc.Hex), l = m.G.L(enc.Hex), nos = enc.Nos, eles = enc.Eles, folga = enc.Folga,
                min = Math.Round(enc.Rota.TotalMin, 1), hexes = enc.Rota.Hexes.Count, caminho = enc.Rota.Hexes,
            },
            taticas = m.P.Combate.Taticas, taticaPadrao = m.P.Combate.TaticaPadrao,
        };
    }

    public static object ResumoModelo(Mundo m, Reino r, ModeloAtaque md)
    {
        var j = ModelosAtaque.ParaJson(md);
        var alvo = md.AlvoHex is int h ? m.LocalNoHex(h) : null;
        j["alvoNome"] = alvo == null ? null : alvo.ReinoId == r.Id ? alvo.Nome : Ataques.NomeAlvo(alvo);
        j["tipoNome"] = Ataques.NomesTipo.GetValueOrDefault(md.Tipo, "");
        j["resumo"] = GT.Partes(m, md.Tropas);
        return j;
    }

    public static object Modelos(Mundo m, Reino r) => new
    {
        ultimo = r.UltimoAtaque is { } u ? ResumoModelo(m, r, u) : null,
        modelos = r.ModelosAtaque.Select(md => ResumoModelo(m, r, md)).ToList(),
        max = m.P.Guerra.ModelosMax, nomeMax = m.P.Guerra.ModeloNome,
    };

    public static object? Queda(Mundo m, Reino r)
    {
        var q = r.UltimaQueda;
        if (q == null) return null;
        var atk = q.AtacanteVisivel != 0 ? RelatoriosCombate.Atacante(m, q.AtacanteVisivel, true) : null;
        return new
        {
            q.Quando, q.Exilio, q.CasteloAntigo, q.NivelAntigo, q.NovoCastelo, q.NivelNovo, q.HexNovo, q.HexAntigo,
            atacante = q.Atacante, atacanteReino = atk, recursosPerdidos = q.RecursosPerdidos.Where(kv => kv.Value >= 1).ToDictionary(kv => kv.Key, kv => Math.Floor(kv.Value)),
            q.PopulacaoPerdida, q.ReliquiasLevadas, q.ReliquiasMantidas, q.Kit, q.KitTropas, q.EscudoAte, q.RelatorioId, q.Vista,
            escudoH = m.P.EscudoExilioH, dia = (int)((q.Quando - m.Estado.InicioTemporada) / T.Dia) + 1, temporada = m.Estado.NumeroTemporada,
            regras = new { nivel = m.P.Queda.Nivel, recursos = m.P.Queda.Recursos, populacao = m.P.Queda.Populacao },
        };
    }
}
