using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using ReinoDePedra.Jogo;

namespace ReinoDePedra.Api.Publico;

/// <summary>
/// O feed sem login, feito para muitos visitantes não pesarem na simulação: cada parte é montada no máximo uma vez por
/// intervalo, só se alguém pediu, e os bytes já comprimidos são os mesmos para todos. Quem pede nunca entra na fila do motor,
/// a não ser o primeiro depois do intervalo, e mesmo esse recebe a última foto na hora.
/// </summary>
public sealed class FeedPublico(Motor motor, Configuracao cfg)
{
    public sealed record Foto(byte[] Json, byte[] Br, byte[] Gz, string Etag, long Em);

    public sealed class Parte(string nome, TimeSpan validade, int maxAge, Func<Mundo, JsonNode> montar)
    {
        public string Nome { get; } = nome;
        public TimeSpan Validade { get; } = validade;
        public int MaxAge { get; } = maxAge;
        internal Func<Mundo, JsonNode> Montar { get; } = montar;
        internal volatile Foto? Atual;
        internal readonly SemaphoreSlim Vez = new(1, 1);
    }

    /// <summary>Terreno, rotas e pontes.</summary>
    public Parte Chao { get; } = new("chao", TimeSpan.FromSeconds(60), 60, Jogo.Publico.RegraPublica.ChaoDoMapa);
    /// <summary>Reinos, construções, bandeiras, diplomacia e ranking.</summary>
    public Parte Mundo { get; } = new("mundo", TimeSpan.FromSeconds(10), 10, Jogo.Publico.RegraPublica.Mundo);
    /// <summary>Marchas, batalhas e mensagens.</summary>
    public Parte Vivo { get; } = new("vivo", TimeSpan.FromSeconds(2), 2, Jogo.Publico.RegraPublica.Vivo);

    /// <summary>Temporada e tamanho do mapa (GET /mundo).</summary>
    public Parte Info { get; } = new("info", TimeSpan.FromSeconds(5), 5, m => new JsonObject
    {
        ["temporada"] = m.Estado.NumeroTemporada, ["inicio"] = m.Estado.InicioTemporada, ["dias"] = m.P.TemporadaDias,
        ["dia"] = Jogo.Temporada.Temporadas.DiaIndice(m) + 1, ["fim"] = Jogo.Temporada.Temporadas.Fim(m),
        ["diasRestantes"] = Jogo.Temporada.Temporadas.DiasRestantes(m), ["reinos"] = m.Reinos.Count(r => r.Ativo), ["limite"] = m.P.Reinos,
        ["agora"] = m.Agora, ["cols"] = m.G.Cols, ["lins"] = m.G.Lins, ["reinoNovo"] = Jogo.Reinos.CriacaoReino.TextoInicio(m),
        ["aceleracao"] = cfg.Aceleracao,   // > 1 só no teste local (REINO_ACELERACAO): o relógio do cliente anda junto
    });

    /// <summary>A foto da parte. Vencida, sai a última e a nova é montada por trás; sem nenhuma, espera a primeira.</summary>
    public async ValueTask<Foto> Obter(Parte p)
    {
        var f = p.Atual;
        if (f == null || cfg.FeedSemCache) return await Renovar(p);
        if (Environment.TickCount64 - f.Em >= p.Validade.TotalMilliseconds && p.Vez.Wait(0))
            _ = Task.Run(async () =>
            {
                try { await Montar(p); }
                catch (Exception) { /* motor parando: a última foto continua valendo */ }
                finally { p.Vez.Release(); }
            });
        return f;
    }

    /// <summary>Monta a parte agora (primeira foto, testes), um de cada vez.</summary>
    public async Task<Foto> Renovar(Parte p)
    {
        await p.Vez.WaitAsync();
        try { return await Montar(p); }
        finally { p.Vez.Release(); }
    }

    private async Task<Foto> Montar(Parte p)
    {
        var no = await motor.Executar(p.Montar);
        var json = JsonSerializer.SerializeToUtf8Bytes(no);
        var etag = "\"" + Convert.ToHexString(SHA256.HashData(json).AsSpan(0, 12)) + "\"";
        var velha = p.Atual;
        var f = velha != null && velha.Etag == etag
            ? velha with { Em = Environment.TickCount64 }
            : new Foto(json, Comprimir(json, s => new BrotliStream(s, CompressionLevel.Fastest, true)), Comprimir(json, s => new GZipStream(s, CompressionLevel.Fastest, true)), etag, Environment.TickCount64);
        p.Atual = f;
        return f;
    }

    private static byte[] Comprimir(byte[] dados, Func<Stream, Stream> abrir)
    {
        using var ms = new MemoryStream();
        using (var z = abrir(ms)) z.Write(dados);
        return ms.ToArray();
    }

    /// <summary>Responde com a foto: 304 se o cliente já a tem; senão, os bytes comprimidos prontos (o middleware não recomprime).</summary>
    public static async Task Responder(HttpContext ctx, Foto f, int maxAge)
    {
        var h = ctx.Response.Headers;
        h.CacheControl = "public, max-age=" + maxAge;
        h.ETag = f.Etag;
        h.Vary = "Accept-Encoding";
        if (ctx.Request.Headers.IfNoneMatch == f.Etag) { ctx.Response.StatusCode = 304; return; }
        ctx.Response.ContentType = "application/json; charset=utf-8";
        var aceita = ctx.Request.Headers.AcceptEncoding.ToString();
        byte[] corpo;
        if (aceita.Contains("br", StringComparison.OrdinalIgnoreCase)) { h.ContentEncoding = "br"; corpo = f.Br; }
        else if (aceita.Contains("gzip", StringComparison.OrdinalIgnoreCase)) { h.ContentEncoding = "gzip"; corpo = f.Gz; }
        else corpo = f.Json;
        ctx.Response.ContentLength = corpo.Length;
        await ctx.Response.Body.WriteAsync(corpo);
    }
}
