using ReinoDePedra.Jogo;

namespace ReinoDePedra.Api.Endpoints;

/// <summary>Canal de avisos em tempo real (SSE) do reino logado.</summary>
public sealed class ModuloEventos : IModuloApi
{
    public void Mapear(RouteGroupBuilder publico, RouteGroupBuilder conta)
    {
        conta.MapGet("/eventos", async (HttpContext ctx, Motor motor, CanalSse canal) =>
        {
            var id = ctx.ContaId();
            var reinoId = await motor.Executar(m => Sessao.ReinoDa(m, id).Id);
            ctx.Response.Headers.ContentType = "text/event-stream";
            ctx.Response.Headers.CacheControl = "no-cache";
            ctx.Response.Headers["X-Accel-Buffering"] = "no";
            var (cid, leitor) = canal.Abrir(reinoId);
            try
            {
                await ctx.Response.WriteAsync("retry: 5000\nevent: ola\ndata: {}\n\n", ctx.RequestAborted);
                await ctx.Response.Body.FlushAsync(ctx.RequestAborted);
                while (!ctx.RequestAborted.IsCancellationRequested)
                {
                    using var espera = CancellationTokenSource.CreateLinkedTokenSource(ctx.RequestAborted);
                    espera.CancelAfter(TimeSpan.FromSeconds(25));
                    string linha;
                    try
                    {
                        if (!await leitor.WaitToReadAsync(espera.Token)) break;
                        linha = "";
                        while (leitor.TryRead(out var l)) linha += l;
                    }
                    catch (OperationCanceledException) when (!ctx.RequestAborted.IsCancellationRequested)
                    {
                        linha = ": ping\n\n";   // mantém a conexão viva atrás de proxies
                    }
                    await ctx.Response.WriteAsync(linha, ctx.RequestAborted);
                    await ctx.Response.Body.FlushAsync(ctx.RequestAborted);
                }
            }
            catch (OperationCanceledException) { }
            finally { canal.Fechar(reinoId, cid); }
        });
    }
}
