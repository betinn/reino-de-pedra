using ReinoDePedra.Api.Contas;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Api;

/// <summary>
/// Autenticação das requisições: cookie HttpOnly <c>rp_sessao</c> (web) ou <c>Authorization: Bearer</c> (app).
/// Requisições que mudam estado com cookie precisam do cabeçalho <c>X-Reino: 1</c> (proteção contra CSRF,
/// junto com SameSite=Strict).
/// </summary>
public static class Sessao
{
    public const string Cookie = "rp_sessao";
    public const string CabecalhoCsrf = "X-Reino";

    public static string? Token(HttpContext ctx)
    {
        var auth = ctx.Request.Headers.Authorization.ToString();
        if (auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) return auth[7..].Trim();
        return ctx.Request.Cookies.TryGetValue(Cookie, out var t) ? t : null;
    }
    public static bool PorCookie(HttpContext ctx) => !ctx.Request.Headers.Authorization.ToString().StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase);

    public static void GravarCookie(HttpContext ctx, string token, bool seguro) =>
        ctx.Response.Cookies.Append(Cookie, token, new CookieOptions
        {
            HttpOnly = true, Secure = seguro, SameSite = SameSiteMode.Strict, Path = "/",
            MaxAge = ServicoContas.DuracaoSessao, IsEssential = true,
        });
    public static void ApagarCookie(HttpContext ctx, bool seguro) =>
        ctx.Response.Cookies.Delete(Cookie, new CookieOptions { HttpOnly = true, Secure = seguro, SameSite = SameSiteMode.Strict, Path = "/" });

    public static long ContaId(this HttpContext ctx) => ctx.Items["conta"] is long id ? id : throw new RegraException("Entre na sua conta.", 401);

    /// <summary>Filtro: exige sessão válida (e o cabeçalho anti-CSRF em requisições de escrita por cookie).</summary>
    public static RouteGroupBuilder ExigirConta(this RouteGroupBuilder g)
    {
        g.AddEndpointFilter(async (fctx, next) =>
        {
            var ctx = fctx.HttpContext;
            var contas = ctx.RequestServices.GetRequiredService<ServicoContas>();
            var id = contas.ValidarSessao(Token(ctx));
            if (id == null) return Results.Json(new { erro = "Entre na sua conta." }, statusCode: 401);
            if (!HttpMethods.IsGet(ctx.Request.Method) && !HttpMethods.IsHead(ctx.Request.Method) && PorCookie(ctx)
                && ctx.Request.Headers[CabecalhoCsrf] != "1")
                return Results.Json(new { erro = "Requisição recusada." }, statusCode: 403);
            ctx.Items["conta"] = id.Value;
            return await next(fctx);
        });
        return g;
    }

    /// <summary>Reino ativo da conta, ou erro 404 "crie seu reino".</summary>
    public static Reino ReinoDa(Mundo m, long contaId)
    {
        foreach (var r in m.Reinos) if (r.Ativo && r.ContaId == contaId) return r;
        throw new RegraException("Você ainda não tem um reino.", 404);
    }
    public static Reino? ReinoOuNulo(Mundo m, long contaId)
    {
        foreach (var r in m.Reinos) if (r.Ativo && r.ContaId == contaId) return r;
        return null;
    }
}
