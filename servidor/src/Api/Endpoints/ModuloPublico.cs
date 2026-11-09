using System.Security.Cryptography;
using System.Text;
using ReinoDePedra.Api.Contas;
using ReinoDePedra.Api.Publico;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Temporada;

namespace ReinoDePedra.Api.Endpoints;

public sealed record PedidoDeConvite(string? Email, string? Site);
public sealed record PedidoToken(string? Token);
public sealed record PedidoFundar(string? Token, string? Senha, string? Nome, Brasao? Brasao, string? Regiao = null);

/// <summary>O que não pede login: o feed do mapa ao vivo, o pedido de convite e o link que funda um reino.</summary>
public sealed class ModuloPublico : IModuloApi
{
    public void Mapear(RouteGroupBuilder publico, RouteGroupBuilder conta)
    {
        publico.MapGet("/publico/chao", async (HttpContext ctx, FeedPublico feed) =>
            await FeedPublico.Responder(ctx, await feed.Obter(feed.Chao), feed.Chao.MaxAge));
        publico.MapGet("/publico/mundo", async (HttpContext ctx, FeedPublico feed) =>
            await FeedPublico.Responder(ctx, await feed.Obter(feed.Mundo), feed.Mundo.MaxAge));
        publico.MapGet("/publico/vivo", async (HttpContext ctx, FeedPublico feed) =>
            await FeedPublico.Responder(ctx, await feed.Obter(feed.Vivo), feed.Vivo.MaxAge));

        // sempre a mesma resposta: não diz se o e-mail já está na fila ou se já tem conta
        publico.MapPost("/convites/pedir", (PedidoDeConvite p, ServicoConvites convites) =>
        {
            if (!string.IsNullOrEmpty(p.Site)) return Results.Json(new { ok = true }, Json.Web, statusCode: 202);   // campo que só robô preenche
            if (!convites.Pedir(p.Email)) return Results.Json(new { erro = "E-mail inválido." }, statusCode: 400);
            return Results.Json(new { ok = true }, Json.Web, statusCode: 202);
        }).RequireRateLimiting("convite");

        publico.MapPost("/convites/validar", (PedidoToken p, ServicoConvites convites) =>
        {
            var email = convites.EmailDoLink(p.Token);
            return email == null
                ? Results.Json(new { erro = LinkInvalido }, statusCode: 410)
                : Results.Json(new { email = ServicoConvites.Mascarar(email) }, Json.Web);
        }).RequireRateLimiting("auth");

        publico.MapPost("/convites/fundar", async (PedidoFundar p, HttpContext ctx, ServicoConvites convites, ServicoContas contas, Motor motor, Configuracao cfg) =>
        {
            var email = convites.EmailDoLink(p.Token);
            if (email == null) return Results.Json(new { erro = LinkInvalido }, statusCode: 410);
            var fraca = ServicoContas.MotivoSenhaFraca(p.Senha, email);
            if (fraca != null) return Results.Json(new { erro = fraca }, statusCode: 400);
            var hash = await Senhas.Hash(p.Senha!, contas.Fila);
            // daqui para a frente, só quem consumiu segue: duas aberturas simultâneas não fundam dois reinos
            if (!convites.Consumir(p.Token!)) return Results.Json(new { erro = LinkInvalido }, statusCode: 410);
            var c = contas.Inserir(email, hash);
            if (c == null)
            {
                convites.Devolver(p.Token!);
                return Results.Json(new { erro = "Este e-mail já tem conta. Entre com ela." }, statusCode: 409);
            }
            try
            {
                await motor.Executar(m => CriacaoReino.CriarNaRegiao(m, c.Id, p.Nome ?? "", p.Brasao ?? new Brasao(), string.IsNullOrWhiteSpace(p.Regiao) ? null : p.Regiao).Id);
            }
            catch (Exception)
            {
                contas.Apagar(c.Id);
                convites.Devolver(p.Token!);
                throw;
            }
            return ModuloConta.AbrirSessao(ctx, contas, cfg, c, false, 201);
        }).RequireRateLimiting("auth");
    }

    private const string LinkInvalido = "Este link de convite não vale mais. Peça outro a quem o enviou.";
}

public sealed record PedidoLink(string? Origem);

/// <summary>
/// Operação do administrador: ver a fila, gerar e revogar links. Só existe com REINO_ADMIN_TOKEN configurado; sem ele, 404.
/// O jogo não manda e-mail: o administrador recebe o link e o envia. Nada disto vai para log.
/// </summary>
public static class ModuloAdmin
{
    public const int TokenMinimo = 24;

    public static void Mapear(RouteGroupBuilder api, Configuracao cfg)
    {
        var admin = api.MapGroup("/admin").RequireRateLimiting("admin");
        admin.AddEndpointFilter(async (fctx, next) =>
        {
            if (cfg.AdminToken is not { Length: >= TokenMinimo } certo) return Results.NotFound();
            var auth = fctx.HttpContext.Request.Headers.Authorization.ToString();
            var dado = auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? auth[7..].Trim() : "";
            if (!CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(dado)), SHA256.HashData(Encoding.UTF8.GetBytes(certo))))
                return Results.Json(new { erro = "Credencial inválida." }, statusCode: 401);
            return await next(fctx);
        });
        admin.MapGet("/convites", (string? estado, ServicoConvites convites) => Results.Json(convites.Listar(estado), Json.Web));
        admin.MapPost("/convites/{id:long}/link", (long id, HttpContext ctx, ServicoConvites convites, ServicoContas contas) =>
        {
            var c = convites.Obter(id);
            if (c == null) return Results.Json(new { erro = "Pedido não encontrado." }, statusCode: 404);
            if (contas.TemConta(c.Email)) return Results.Json(new { erro = "Este e-mail já tem conta." }, statusCode: 409);
            if (convites.GerarLink(id) is not { } g) return Results.Json(new { erro = "Este convite já foi usado." }, statusCode: 409);
            var origem = ctx.Request.Scheme + "://" + ctx.Request.Host;
            ctx.Response.Headers.CacheControl = "no-store";
            return Results.Json(new { email = c.Email, link = origem + "/#/convite/" + g.token, token = g.token, expiraEm = g.expira }, Json.Web, statusCode: 201);
        });
        admin.MapPost("/convites/{id:long}/revogar", (long id, ServicoConvites convites) =>
            convites.Revogar(id) ? Results.NoContent() : Results.Json(new { erro = "Pedido não encontrado ou já usado." }, statusCode: 404));
        admin.MapDelete("/convites/{id:long}", (long id, ServicoConvites convites) =>
            convites.Apagar(id) ? Results.NoContent() : Results.Json(new { erro = "Pedido não encontrado." }, statusCode: 404));
    }
}
