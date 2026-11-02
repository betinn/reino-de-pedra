using ReinoDePedra.Api.Visoes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Forja;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Api.Endpoints;

public sealed record PedidoEra(string? Era);
public sealed record PedidoForja(string? Familia, string? Linha);
public sealed record PedidoLendario(string? Tipo);
public sealed record PedidoLevar(bool Levar);

/// <summary>Ferraria e eras: ver, pesquisar era, forjar armas e armaduras, forjar e levar o equipamento lendário.</summary>
public sealed class ModuloFerraria : IModuloApi
{
    public void Mapear(RouteGroupBuilder publico, RouteGroupBuilder conta)
    {
        conta.MapGet("/ferraria", async (HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m => VisaoFerraria.Montar(m, Sessao.ReinoDa(m, id))), Json.Web);
        });

        conta.MapPost("/ferraria/eras", async (PedidoEra p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                return VisaoReino.Item(m, r, Ferrarias.PesquisarEra(m, r, p.Era ?? ""));
            }), Json.Web, statusCode: 201);
        });

        conta.MapPost("/ferraria/forjar", async (PedidoForja p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                return VisaoReino.Item(m, r, Ferrarias.Forjar(m, r, p.Familia ?? "", p.Linha ?? ""));
            }), Json.Web, statusCode: 201);
        });

        conta.MapPost("/ferraria/lendario", async (PedidoLendario p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                return VisaoReino.Item(m, r, Ferrarias.ForjarLendario(m, r, p.Tipo ?? ""));
            }), Json.Web, statusCode: 201);
        });

        conta.MapPost("/ferraria/lendario/{eid:long}/levar", async (long eid, PedidoLevar p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                Lendarios.MarcarLevar(m, r, eid, p.Levar);
                return VisaoFerraria.Meus(m, r);
            }), Json.Web);
        });
    }
}

/// <summary>Resumo da ferraria no estado do reino (era, níveis, lendários) e o equipamento lendário na guarnição de cada local.</summary>
[Sistema]
public static class ExtrasFerraria
{
    public static void AoIniciar(Mundo m) => Sistemas.UmaVez("api-ferraria", () =>
    {
        VisaoReino.Extras.Add((mm, r, d) =>
        {
            d["ferraria"] = new
            {
                era = Ferrarias.EraAtual(mm, r),
                eraNome = mm.P.Eras.TryGetValue(Ferrarias.EraAtual(mm, r), out var e) ? e.Nome : null,
                eras = r.Eras.Keys.ToList(),
                forja = r.Forja,
                bonusNivel = mm.P.Ferraria.BonusNivel,
                lendarios = VisaoFerraria.Meus(mm, r),
            };
        });
        VisaoReino.ExtrasLocal.Add((mm, r, l, d) =>
        {
            var eqs = Lendarios.NoLocal(mm, l).Where(e => e.DonoId == r.Id).Select(e => new { e.Id, e.Nome, e.Tipo, e.Levar }).ToList();
            if (eqs.Count > 0) d["lendarios"] = eqs;
        });
    });
}
