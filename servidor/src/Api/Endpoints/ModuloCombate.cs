using ReinoDePedra.Api.Visoes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using static ReinoDePedra.Api.Visoes.VisaoCombate;

namespace ReinoDePedra.Api.Endpoints;

public sealed record PedidoTorre(int? Hex, int? C, int? L);

/// <summary>Ataques (prévia e envio), batalhas (ver, recuar) e defesas (torres e portões).</summary>
public sealed class ModuloCombate : IModuloApi
{
    public void Mapear(RouteGroupBuilder publico, RouteGroupBuilder conta)
    {
        conta.MapPost("/ataques/previa", async (PedidoAtaque p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                return VisaoCombate.Previa(m, r, p, ModuloTropas.Hex(m, p.DestinoHex, p.C, p.L));
            }), Json.Web);
        });

        conta.MapPost("/ataques", async (PedidoAtaque p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                var hex = ModuloTropas.Hex(m, p.DestinoHex, p.C, p.L);
                var ordem = Ataques.SemDono(m, Ataques.Alvo(m, r, hex)) ? OrdemOcupar.Id : OrdemAtacar.Id;
                Exercito ex;
                if (p.MarchaId is long mid)
                {
                    ex = p.Pessoas is { Count: > 0 }
                        ? Grupos.Parte(m, r, mid, p.Pessoas, e => { Exercitos.DarOrdem(m, r, e.Id, ordem, hex, p.Seguro, VisaoCombate.Dados(p)); return e; })
                        : Exercitos.Do(m, r, mid);
                    if (p.Pessoas is not { Count: > 0 }) Exercitos.DarOrdem(m, r, mid, ordem, hex, p.Seguro, VisaoCombate.Dados(p));
                }
                else ex = Exercitos.Enviar(m, r, p.DeLocalId ?? 0, p.Tropas, hex, ordem, p.Seguro == true, VisaoCombate.Dados(p));
                return VisaoTropas.Exercito(m, ex);
            }), Json.Web, statusCode: 201);
        });

        conta.MapGet("/batalhas", async (HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                return Batalhas.DoReino(m, r.Id).OrderBy(b => b.Encerrada).ThenByDescending(b => b.Inicio).Select(b => VisaoCombate.Resumo(m, r, b)).ToList();
            }), Json.Web);
        });

        conta.MapGet("/batalhas/{bid:long}", async (long bid, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                var b = m.Batalhas.Obter(bid);
                if (b == null || (b.AtacanteId != r.Id && b.DefensorId != r.Id)) throw new RegraException("Batalha não encontrada.", 404);
                return VisaoCombate.Batalha(m, r, b);
            }), Json.Web);
        });

        conta.MapPost("/batalhas/{bid:long}/recuar", async (long bid, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                Batalhas.Recuar(m, r, bid);
                return VisaoCombate.Batalha(m, r, m.Batalhas[bid]);
            }), Json.Web);
        });

        conta.MapGet("/defesas", async (HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m => VisaoCombate.Defesas_(m, Sessao.ReinoDa(m, id))), Json.Web);
        });

        conta.MapGet("/defesas/torre/motivo", async (int hex, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m => { var r = Sessao.ReinoDa(m, id); Nevoas.VisiveisAgora(m, r.Id); return new { motivo = Defesas.MotivoTorre(m, r, hex) }; }), Json.Web);
        });

        conta.MapPost("/defesas/torres", async (PedidoTorre p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                var hex = p.Hex ?? (p.C is int c && p.L is int l && m.G.Dentro(c, l) ? m.G.Indice(c, l) : -1);
                return VisaoReino.Item(m, r, Defesas.NovaTorre(m, r, hex));
            }), Json.Web, statusCode: 201);
        });

        conta.MapPost("/defesas/torres/{tid:long}/nivel", async (long tid, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                return VisaoReino.Item(m, r, Defesas.SubirTorre(m, r, tid));
            }), Json.Web, statusCode: 201);
        });

        conta.MapPost("/defesas/portoes", async (HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                return VisaoReino.Item(m, r, Defesas.SubirPortoes(m, r));
            }), Json.Web, statusCode: 201);
        });
    }
}

/// <summary>Combate no estado do reino, nos locais e no mapa (torres, batalhas).</summary>
[Sistema]
public static class ExtrasCombate
{
    public static void AoIniciar(Mundo m) => Sistemas.UmaVez("api-combate", () =>
    {
        VisaoReino.Extras.Add((mm, r, d) =>
        {
            d["batalhas"] = Batalhas.DoReino(mm, r.Id).Where(b => !b.Encerrada).Select(b => VisaoCombate.Resumo(mm, r, b)).ToList();
            d["combate"] = new { taticas = mm.P.Combate.Taticas, taticaPadrao = mm.P.Combate.TaticaPadrao };
        });
        VisaoReino.ExtrasLocal.Add((mm, r, l, d) =>
        {
            d["defesa"] = new
            {
                torres = Defesas.NoAlcance(mm, l).Count, arqueirosNoAlto = Defesas.ArqueirosNoAlto(mm, l),
                portoes = l.Tipo == TipoLocal.Castelo ? l.Portoes : (int?)null,
                batalhaId = Batalhas.Ativa(mm, l.Id)?.Id,
            };
        });
        VisaoMapa.Extras.Add((mm, r, vis) =>
        {
            var lista = new List<object>();
            foreach (var t in mm.Torres)
            {
                var meu = t.ReinoId == r.Id;
                var visivel = vis.Contains(t.Hex);
                if (!meu && !visivel) continue;   // fora da vista, a torre alheia vem da foto da névoa (como foi vista)
                lista.Add(new
                {
                    tipo = "torre", id = t.Id, hex = t.Hex, nivel = t.Nivel, alcance = Defesas.Alcance(mm, t),
                    dono = meu ? "meu" : "desconhecido", arqueiros = meu ? Defesas.Arqueiros(mm, t) : (int?)null, aoVivo = meu || visivel,
                });
            }
            foreach (var b in mm.Batalhas)
            {
                if (b.Encerrada) continue;
                var minha = b.AtacanteId == r.Id || b.DefensorId == r.Id;
                if (!minha && !vis.Contains(b.Hex)) continue;
                lista.Add(new { tipo = "batalha", id = minha ? b.Id : (long?)null, hex = b.Hex, inicio = b.Inicio, fim = b.FimPrevisto, papel = minha ? VisaoCombate.Papel(b, r) : null });
            }
            return lista;
        });
    });
}
