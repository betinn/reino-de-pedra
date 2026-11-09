using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Connections;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Server.Kestrel.Core;

namespace ReinoDePedra.Api;

/// <summary>
/// Limites de operação para caber numa CPU pequena sem barrar o uso normal (ver decisão 0006).
/// Só a API conta (arquivos estáticos ficam de fora). Vários jogadores atrás do mesmo IP (rede móvel, Wi-Fi de casa)
/// têm folga no balde do IP; quem segura a CPU é o balde por sessão e o das rotas pesadas.
/// </summary>
public static class Limites
{
    // por IP (IPv6 agrupado por /64): folga para vários jogadores atrás do mesmo endereço
    public const int IpRajada = 240, IpPorSegundo = 60;
    // por sessão (token do cookie ou Bearer; sem sessão, só o IP vale)
    public const int SessaoRajada = 80, SessaoPorSegundo = 20;
    // rotas que montam a visão inteira do reino (/mapa, /reino, /agora): o cliente recarrega no máximo a cada 300-400 ms
    public const int PesadaRajada = 12, PesadaPorSegundo = 4;
    public const int PesadaIpRajada = 40, PesadaIpPorSegundo = 10;
    // login, cadastro e troca de senha (cada um custa um hash PBKDF2): por IP a cada 15 min
    public const int AuthPorJanela = 20;
    public const int AdminPorJanela = 200;
    /// <summary>Conexões SSE abertas por reino; a mais antiga fecha quando abre outra.</summary>
    public const int SsePorReino = 3;

    private static readonly string[] Pesadas = ["/api/v1/mapa", "/api/v1/reino", "/api/v1/agora"];

    public static bool Api(HttpContext ctx) => ctx.Request.Path.StartsWithSegments("/api");
    public static bool Pesada(HttpContext ctx) => HttpMethods.IsGet(ctx.Request.Method) && Pesadas.Any(p => ctx.Request.Path.Equals(p, StringComparison.OrdinalIgnoreCase));

    /// <summary>Chave do IP: IPv4 inteiro; IPv6 pelo prefixo /64 (um cliente costuma ter o /64 inteiro).</summary>
    public static string Ip(IPAddress? ip)
    {
        if (ip == null) return "?";
        if (ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();
        if (ip.AddressFamily != AddressFamily.InterNetworkV6) return ip.ToString();
        var b = ip.GetAddressBytes();
        Array.Clear(b, 8, 8);
        return new IPAddress(b) + "/64";
    }

    private static TokenBucketRateLimiterOptions Balde(int rajada, int porSegundo) => new()
    { TokenLimit = rajada, TokensPerPeriod = porSegundo, ReplenishmentPeriod = TimeSpan.FromSeconds(1), QueueLimit = 0, AutoReplenishment = true };

    public static void Configurar(RateLimiterOptions o, Configuracao cfg)
    {
        o.RejectionStatusCode = 429;
        o.OnRejected = (c, _) => { c.HttpContext.Response.Headers.RetryAfter = "1"; return ValueTask.CompletedTask; };
        o.AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter(Ip(ctx.Connection.RemoteIpAddress), _ => new FixedWindowRateLimiterOptions
        { PermitLimit = AuthPorJanela, Window = TimeSpan.FromMinutes(15), QueueLimit = 0 }));
        // pedido de convite: pouco por IP (cada um é uma linha no banco); as rotas do administrador contam à parte
        o.AddPolicy("convite", ctx => RateLimitPartition.GetFixedWindowLimiter(Ip(ctx.Connection.RemoteIpAddress), _ => new FixedWindowRateLimiterOptions
        { PermitLimit = cfg.ConvitesPorHora, Window = TimeSpan.FromHours(1), QueueLimit = 0 }));
        o.AddPolicy("admin", ctx => RateLimitPartition.GetFixedWindowLimiter(Ip(ctx.Connection.RemoteIpAddress), _ => new FixedWindowRateLimiterOptions
        { PermitLimit = AdminPorJanela, Window = TimeSpan.FromMinutes(15), QueueLimit = 0 }));
        var porIp = PartitionedRateLimiter.Create<HttpContext, string>(ctx => !Api(ctx) ? RateLimitPartition.GetNoLimiter("") :
            RateLimitPartition.GetTokenBucketLimiter(Ip(ctx.Connection.RemoteIpAddress), _ => Balde(IpRajada, IpPorSegundo)));
        var porSessao = PartitionedRateLimiter.Create<HttpContext, string>(ctx => !Api(ctx) || Sessao.Token(ctx) is not { } t ? RateLimitPartition.GetNoLimiter("") :
            RateLimitPartition.GetTokenBucketLimiter(t, _ => Balde(SessaoRajada, SessaoPorSegundo)));
        var pesadaSessao = PartitionedRateLimiter.Create<HttpContext, string>(ctx => !Pesada(ctx) ? RateLimitPartition.GetNoLimiter("") :
            RateLimitPartition.GetTokenBucketLimiter(Sessao.Token(ctx) ?? Ip(ctx.Connection.RemoteIpAddress), _ => Balde(PesadaRajada, PesadaPorSegundo)));
        var pesadaIp = PartitionedRateLimiter.Create<HttpContext, string>(ctx => !Pesada(ctx) ? RateLimitPartition.GetNoLimiter("") :
            RateLimitPartition.GetTokenBucketLimiter(Ip(ctx.Connection.RemoteIpAddress), _ => Balde(PesadaIpRajada, PesadaIpPorSegundo)));
        o.GlobalLimiter = PartitionedRateLimiter.CreateChained(porIp, porSessao, pesadaSessao, pesadaIp);
    }

    /// <summary>
    /// Teto de conexões abertas por IP (servindo direto, sem proxy): um cliente sozinho não ocupa as vagas do Kestrel
    /// com conexões paradas. A conexão acima do teto é fechada sem resposta.
    /// </summary>
    public static void ConexoesPorIp(ListenOptions lo, int max)
    {
        if (max <= 0) return;
        var abertas = new ConcurrentDictionary<string, int>();
        lo.Use(next => async conn =>
        {
            var ip = Ip((conn.RemoteEndPoint as IPEndPoint)?.Address);
            if (abertas.AddOrUpdate(ip, 1, (_, n) => n + 1) > max)
            {
                Sair(abertas, ip);
                conn.Abort();
                return;
            }
            try { await next(conn); }
            finally { Sair(abertas, ip); }
        });
    }

    private static void Sair(ConcurrentDictionary<string, int> d, string ip)
    {
        while (true)
        {
            var n = d.GetValueOrDefault(ip);
            if (n <= 1) { if (d.TryRemove(new KeyValuePair<string, int>(ip, n))) return; }
            else if (d.TryUpdate(ip, n - 1, n)) return;
            if (!d.ContainsKey(ip)) return;
        }
    }
}
