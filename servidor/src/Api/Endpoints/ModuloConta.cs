using ReinoDePedra.Api.Contas;
using ReinoDePedra.Jogo;

namespace ReinoDePedra.Api.Endpoints;

public sealed record PedidoConta(string? Email, string? Senha, bool App = false);
public sealed record PedidoTrocaSenha(string Atual, string Nova);

/// <summary>Entrada, saída e troca de senha. Conta nova só nasce do link de convite (ModuloPublico).</summary>
public sealed class ModuloConta : IModuloApi
{
    public void Mapear(RouteGroupBuilder publico, RouteGroupBuilder conta)
    {
        publico.MapPost("/conta/entrar", async (PedidoConta p, HttpContext ctx, ServicoContas contas, Configuracao cfg) =>
        {
            var (c, erro, esperar) = await contas.Entrar(p.Email, p.Senha);
            if (c == null)
            {
                if (esperar > 0) ctx.Response.Headers.RetryAfter = esperar.ToString();
                return Json.Resposta(new ErroJson(erro), statusCode: esperar > 0 ? 429 : 401);
            }
            return AbrirSessao(ctx, contas, cfg, c, p.App, 200);
        }).RequireRateLimiting("auth");

        publico.MapPost("/conta/sair", (HttpContext ctx, ServicoContas contas, Configuracao cfg) =>
        {
            contas.EncerrarSessao(Sessao.Token(ctx));
            Sessao.ApagarCookie(ctx, cfg.CookieSeguro);
            return Results.NoContent();
        });

        conta.MapGet("/conta", async (HttpContext ctx, ServicoContas contas, Motor motor) =>
        {
            var id = ctx.ContaId();
            var c = contas.Obter(id);
            var reino = await motor.Executar(m => Sessao.ReinoOuNulo(m, id) is { } r ? new ContaReinoJson(r.Id, r.Nome) : null);
            return Json.Resposta(new ContaJson(email: c?.Email, reino), Json.Web);
        });

        conta.MapPost("/conta/senha", async (PedidoTrocaSenha p, HttpContext ctx, ServicoContas contas, Configuracao cfg) =>
        {
            var erro = await contas.TrocarSenha(ctx.ContaId(), p.Atual, p.Nova);
            if (erro != null) return Json.Resposta(new ErroJson(erro), statusCode: 400);
            var token = contas.CriarSessao(ctx.ContaId());
            if (Sessao.PorCookie(ctx)) Sessao.GravarCookie(ctx, token, cfg.CookieSeguro);
            return Json.Resposta(new PostContaSenhaJson(ok: true, token: Sessao.PorCookie(ctx) ? null : token), Json.Web);
        }).RequireRateLimiting("auth");
    }

    public static IResult AbrirSessao(HttpContext ctx, ServicoContas contas, Configuracao cfg, Conta c, bool app, int status)
    {
        var token = contas.CriarSessao(c.Id);
        // web: só cookie HttpOnly (o script não enxerga o token); app: token no corpo, para o cabeçalho Bearer
        if (!app) Sessao.GravarCookie(ctx, token, cfg.CookieSeguro);
        return Json.Resposta(new ContaAbrirSessaoJson(email: c.Email, token: app ? token : null), Json.Web, statusCode: status);
    }
}

// Formato das respostas em JSON: o nome, a ordem e o tipo de cada membro são o contrato com o cliente.
public sealed record ContaReinoJson(long Id, string Nome);
public sealed record ContaJson(string? email, ContaReinoJson? reino);
public sealed record PostContaSenhaJson(bool ok, string? token);
public sealed record ContaAbrirSessaoJson(string email, string? token);
