using System.IO.Compression;
using System.Reflection;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.AspNetCore.StaticFiles;
using ReinoDePedra.Api;
using ReinoDePedra.Api.Contas;
using ReinoDePedra.Api.Endpoints;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Persistencia;

var cfg = new Configuracao();
var app = Servidor.Construir(args, cfg);
await app.RunAsync();

namespace ReinoDePedra.Api
{
    public static class Servidor
    {
        /// <summary>Ganchos de inicialização dos sistemas do jogo (registram modificadores, visões, IA...).</summary>
        public static List<Action<Mundo>> AoIniciarMundo { get; } = new();

        public static WebApplication Construir(string[] args, Configuracao cfg, IRelogio? relogio = null, Action<WebApplicationBuilder>? ajustar = null)
        {
            var builder = WebApplication.CreateSlimBuilder(new WebApplicationOptions { Args = args, ContentRootPath = AppContext.BaseDirectory });
            builder.WebHost.UseUrls(cfg.Urls);
            builder.WebHost.ConfigureKestrel(k =>
            {
                k.AddServerHeader = false;
                k.Limits.MaxRequestBodySize = 256 * 1024;
                k.Limits.MaxConcurrentConnections = 2000;
            });
            builder.Logging.ClearProviders();
            builder.Logging.AddSimpleConsole(o => { o.SingleLine = true; o.TimestampFormat = "HH:mm:ss "; });
            builder.Logging.SetMinimumLevel(LogLevel.Warning);
            builder.Logging.AddFilter("ReinoDePedra", LogLevel.Information);

            var b = Balanceamento.Carregar(Balanceamento.Localizar());
            var banco = new Banco(Path.Combine(cfg.Dados, "reino.db"));
            var mundo = new Mundo(b, relogio ?? new RelogioReal(cfg.Aceleracao));
            var canal = new CanalSse();
            mundo.Avisos = canal;
            mundo.Banco = banco;   // legado por conta e reset da temporada
            if (cfg.TemporadaMin is double tm) mundo.DuracaoTemporadaMs = (long)(tm * T.Min);
            RegistroTipos.Garantir();
            if (banco.MundoExiste())
            {
                banco.Carregar(mundo);
                mundo.PrepararMapa();
                foreach (var e in mundo.Eventos) mundo.Agenda.Inserir(e);
            }
            else
            {
                var semente = cfg.Semente ?? (ulong)System.Security.Cryptography.RandomNumberGenerator.GetInt32(int.MaxValue) << 20 ^ (ulong)DateTime.UtcNow.Ticks;
                mundo.CriarNovo(semente);
                banco.Salvar(mundo);
            }
            foreach (var t in typeof(Servidor).Assembly.GetTypes().Concat(typeof(Mundo).Assembly.GetTypes()))
            {
                // sistemas com "public static void AoIniciar(Mundo m)" numa classe marcada com [Sistema] se registram aqui
                if (t.GetCustomAttribute<SistemaAttribute>() == null) continue;
                t.GetMethod("AoIniciar", BindingFlags.Public | BindingFlags.Static)?.Invoke(null, [mundo]);
            }
            foreach (var f in AoIniciarMundo) f(mundo);
            var log = LoggerFactory.Create(l => l.AddSimpleConsole(o => o.SingleLine = true)).CreateLogger("ReinoDePedra");
            Mundo.ErroEvento += (ev, ex) => log.LogError(ex, "erro no evento {Tipo}#{Id}", ev.GetType().Name, ev.Id);
            var motor = new Motor(mundo, banco) { Log = s => log.LogWarning("{Msg}", s) };

            builder.Services.AddSingleton(cfg);
            builder.Services.AddSingleton(banco);
            builder.Services.AddSingleton(mundo);
            builder.Services.AddSingleton(motor);
            builder.Services.AddSingleton(canal);
            builder.Services.AddSingleton(new ServicoContas(banco));
            builder.Services.ConfigureHttpJsonOptions(o =>
            {
                o.SerializerOptions.PropertyNameCaseInsensitive = true;
                o.SerializerOptions.Encoder = System.Text.Encodings.Web.JavaScriptEncoder.Create(System.Text.Unicode.UnicodeRanges.All);
                o.SerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter(System.Text.Json.JsonNamingPolicy.CamelCase));
            });
            builder.Services.AddResponseCompression(o =>
            {
                o.EnableForHttps = true;
                o.Providers.Add<BrotliCompressionProvider>();
                o.Providers.Add<GzipCompressionProvider>();
                o.MimeTypes = ["application/json", "text/html", "text/css", "text/javascript", "application/javascript", "image/svg+xml"];
            });
            builder.Services.Configure<BrotliCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);
            builder.Services.Configure<GzipCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);
            builder.Services.AddRateLimiter(o =>
            {
                o.RejectionStatusCode = 429;
                // login e cadastro: 20 tentativas por IP a cada 15 min (o limite por e-mail fica em ServicoContas)
                o.AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter(IpDe(ctx), _ => new FixedWindowRateLimiterOptions
                { PermitLimit = 20, Window = TimeSpan.FromMinutes(15), QueueLimit = 0 }));
                // API em geral: 30 por segundo por IP, com folga para rajadas
                o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx => RateLimitPartition.GetTokenBucketLimiter(IpDe(ctx), _ => new TokenBucketRateLimiterOptions
                { TokenLimit = 60, TokensPerPeriod = 30, ReplenishmentPeriod = TimeSpan.FromSeconds(1), QueueLimit = 0, AutoReplenishment = true }));
            });
            if (cfg.AtrasDeProxy)
                builder.Services.Configure<ForwardedHeadersOptions>(o =>
                {
                    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
                    o.KnownIPNetworks.Clear(); o.KnownProxies.Clear();
                    o.ForwardLimit = 1;
                });
            ajustar?.Invoke(builder);

            var app = builder.Build();
            if (cfg.AtrasDeProxy) app.UseForwardedHeaders();
            app.Use(async (ctx, next) =>
            {
                var h = ctx.Response.Headers;
                h["X-Content-Type-Options"] = "nosniff";
                h["Referrer-Policy"] = "no-referrer";
                h["X-Frame-Options"] = "DENY";
                h["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
                if (!h.ContainsKey("Content-Security-Policy"))
                    h["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'";
                try { await next(); }
                catch (RegraException e) when (!ctx.Response.HasStarted)
                {
                    ctx.Response.StatusCode = e.Status;
                    await ctx.Response.WriteAsJsonAsync(new { erro = e.Message });
                }
                catch (BadHttpRequestException) when (!ctx.Response.HasStarted)
                {
                    ctx.Response.StatusCode = 400;
                    await ctx.Response.WriteAsJsonAsync(new { erro = "Pedido inválido." });
                }
            });
            app.UseResponseCompression();
            app.UseRateLimiter();

            var web = cfg.LocalizarWeb();
            if (Directory.Exists(web))
            {
                var arquivos = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(web);
                app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = arquivos });
                var tipos = new FileExtensionContentTypeProvider();
                tipos.Mappings[".webmanifest"] = "application/manifest+json";
                app.UseStaticFiles(new StaticFileOptions
                {
                    FileProvider = arquivos, ContentTypeProvider = tipos,
                    OnPrepareResponse = c => c.Context.Response.Headers.CacheControl = c.File.Name == "index.html" ? "no-cache" : "public, max-age=300, must-revalidate",
                });
            }

            var api = app.MapGroup("/api/v1");
            var conta = app.MapGroup("/api/v1").ExigirConta();
            foreach (var t in typeof(Servidor).Assembly.GetTypes().Where(t => !t.IsAbstract && typeof(IModuloApi).IsAssignableFrom(t)))
                ((IModuloApi)Activator.CreateInstance(t)!).Mapear(api, conta);
            api.MapGet("/saude", (Motor m, CanalSse c) => Results.Json(new
            {
                ok = true, eventos = m.Mundo.Agenda.Count, conexoes = c.Conexoes,
                memoriaMb = Environment.WorkingSet / (1024 * 1024),
            }));

            app.Lifetime.ApplicationStarted.Register(() => { motor.Iniciar(); log.LogInformation("Reino de Pedra no ar em {Urls} (web: {Web})", cfg.Urls, web); });
            app.Lifetime.ApplicationStopping.Register(() => motor.DisposeAsync().AsTask().GetAwaiter().GetResult());
            app.Lifetime.ApplicationStopped.Register(banco.Dispose);
            return app;
        }

        public static string IpDe(HttpContext ctx) => ctx.Connection.RemoteIpAddress?.ToString() ?? "?";
    }
}
