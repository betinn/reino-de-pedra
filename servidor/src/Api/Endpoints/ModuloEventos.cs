using ReinoDePedra.Jogo;

namespace ReinoDePedra.Api.Endpoints;

/// <summary>Canal de avisos em tempo real (SSE) do reino logado.</summary>
public sealed class ModuloEventos : IModuloApi
{
    public void Mapear(RouteGroupBuilder publico, RouteGroupBuilder conta)
    {
        conta.MapGet("/eventos", async (HttpContext ctx, Motor motor, CanalSse canal, IHostApplicationLifetime vida) =>
        {
            var id = ctx.ContaId();
            var reinoId = await motor.Executar(m => Sessao.ReinoDa(m, id).Id);
            ctx.Response.Headers.ContentType = "text/event-stream";
            ctx.Response.Headers.CacheControl = "no-cache";
            ctx.Response.Headers["X-Accel-Buffering"] = "no";
            var (cid, leitor) = canal.Abrir(reinoId);
            // termina quando o cliente sai, quando a conexão é trocada por outra mais nova ou quando o servidor para
            using var fim = CancellationTokenSource.CreateLinkedTokenSource(ctx.RequestAborted, vida.ApplicationStopping);
            try
            {
                await ctx.Response.WriteAsync("retry: 5000\nevent: ola\ndata: {}\n\n", fim.Token);
                await ctx.Response.Body.FlushAsync(fim.Token);
                while (!fim.IsCancellationRequested)
                {
                    using var espera = CancellationTokenSource.CreateLinkedTokenSource(fim.Token);
                    espera.CancelAfter(TimeSpan.FromSeconds(25));
                    string linha;
                    try
                    {
                        if (!await leitor.WaitToReadAsync(espera.Token)) break;
                        linha = "";
                        while (leitor.TryRead(out var l)) linha += l;
                    }
                    catch (OperationCanceledException) when (!fim.IsCancellationRequested)
                    {
                        linha = ": ping\n\n";   // mantém a conexão viva atrás de proxies
                    }
                    await ctx.Response.WriteAsync(linha, fim.Token);
                    await ctx.Response.Body.FlushAsync(fim.Token);
                }
            }
            catch (OperationCanceledException) { }
            finally { canal.Fechar(reinoId, cid); }
        });
    }
}
