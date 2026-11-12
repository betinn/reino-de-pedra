using ReinoDePedra.Api.Visoes;
using ReinoDePedra.Jogo;
using PS = ReinoDePedra.Jogo.Pessoas.Pessoas;

namespace ReinoDePedra.Api.Endpoints;

public sealed record PedidoTrabalho(long LocalId, string? Oficio);
public sealed record PedidoMoverPessoa(long LocalId);

/// <summary>Pessoas do reino: lista, folha de uma pessoa, trocar trabalho e levar para outro local.</summary>
public sealed class ModuloPessoas : IModuloApi
{
    public void Mapear(RouteGroupBuilder publico, RouteGroupBuilder conta)
    {
        conta.MapGet("/reino/pessoas", async (HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Json.Resposta(await motor.Executar(m => VisaoPessoas.Lista(m, Sessao.ReinoDa(m, id))), Json.Web);
        });

        conta.MapGet("/pessoas/{pessoaId:long}", async (long pessoaId, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Json.Resposta(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                return VisaoPessoas.Folha(m, r, PS.Da(m, r, pessoaId));
            }), Json.Web);
        });

        conta.MapPost("/pessoas/{pessoaId:long}/trabalho", async (long pessoaId, PedidoTrabalho p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Json.Resposta(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                return VisaoPessoas.Folha(m, r, PS.Trabalhar(m, r, pessoaId, p.LocalId, string.IsNullOrWhiteSpace(p.Oficio) ? null : p.Oficio));
            }), Json.Web);
        });

        conta.MapPost("/pessoas/{pessoaId:long}/mover", async (long pessoaId, PedidoMoverPessoa p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Json.Resposta(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                return VisaoPessoas.Folha(m, r, PS.Mover(m, r, pessoaId, p.LocalId));
            }), Json.Web);
        });
    }
}
