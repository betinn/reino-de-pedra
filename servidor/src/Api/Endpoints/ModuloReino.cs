using ReinoDePedra.Api.Visoes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Persistencia;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Api.Endpoints;

public sealed record PedidoCriarReino(string Nome, Brasao Brasao, string? Regiao = null);
public sealed record PedidoObra(string Acao, long? LocalId, string? Tipo, int? Hex, int? C, int? L);

/// <summary>Mundo, criação do reino, ícone, estado do reino e obras.</summary>
public sealed class ModuloReino : IModuloApi
{
    public const int IconeMaxBytes = 200 * 1024;

    public void Mapear(RouteGroupBuilder publico, RouteGroupBuilder conta)
    {
        // visitantes passam por aqui ao abrir a página: a resposta vem do feed, não da fila do motor
        publico.MapGet("/mundo", async (HttpContext ctx, ReinoDePedra.Api.Publico.FeedPublico feed) =>
            await ReinoDePedra.Api.Publico.FeedPublico.Responder(ctx, await feed.Obter(feed.Info), feed.Info.MaxAge));

        publico.MapGet("/reino/brasoes", (int? n) =>
        {
            var rng = new Rng((ulong)System.Security.Cryptography.RandomNumberGenerator.GetInt32(int.MaxValue) * 2654435761UL);
            var lista = Enumerable.Range(0, Math.Clamp(n ?? 8, 1, 24)).Select(_ => Brasao.Aleatorio(rng)).ToList();
            return Results.Json(lista, Json.Web);
        });

        conta.MapPost("/reino", async (PedidoCriarReino p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            var r = await motor.Executar(m => VisaoReino.Montar(m, CriacaoReino.CriarNaRegiao(m, id, p.Nome, p.Brasao ?? new Brasao(), string.IsNullOrWhiteSpace(p.Regiao) ? null : p.Regiao)));
            return Results.Json(r, Json.Web, statusCode: 201);
        });

        conta.MapGet("/reino", async (HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                if (m.Agora - r.UltimoAcesso > T.Min) { r.UltimoAcesso = m.Agora; m.Sujar(r); }
                return VisaoReino.Montar(m, r);
            }), Json.Web);
        });

        conta.MapPut("/reino/brasao", async (Brasao b, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                var (extras, moldura) = CriacaoReino.BrasaoLiberado?.Invoke(m, id) ?? (false, false);
                if (!b.Valido(extras, moldura)) throw new RegraException("Brasão inválido.");
                r.Brasao = b; m.Sujar(r);
            });
            return Results.NoContent();
        });

        // ícone próprio: o cliente reduz a imagem (até 256×256) e envia PNG, JPEG ou WebP
        conta.MapPut("/reino/icone", async (HttpContext ctx, Motor motor, Banco banco) =>
        {
            var id = ctx.ContaId();
            if (ctx.Request.ContentLength is > IconeMaxBytes) throw new RegraException("Imagem grande demais (máximo 200 KB).", 413);
            using var ms = new MemoryStream();
            var buf = new byte[16 * 1024]; int lidos;
            while ((lidos = await ctx.Request.Body.ReadAsync(buf)) > 0)
            {
                ms.Write(buf, 0, lidos);
                if (ms.Length > IconeMaxBytes) throw new RegraException("Imagem grande demais (máximo 200 KB).", 413);
            }
            var dados = ms.ToArray();
            var tipo = Imagens.Tipo(dados) ?? throw new RegraException("Envie uma imagem PNG, JPEG ou WebP.", 415);
            var dim = Imagens.Dimensoes(dados, tipo);
            if (dim is not { } d || d.w < 16 || d.h < 16 || d.w > 512 || d.h > 512)
                throw new RegraException("A imagem precisa ter entre 16 e 512 pixels de lado.", 415);
            var versao = await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                r.IconeProprio = true; r.IconeVersao++; m.Sujar(r);
                return (r.Id, r.IconeVersao);
            });
            banco.Exec("INSERT INTO icones(reino_id, tipo, dados, versao) VALUES($r,$t,$d,$v) ON CONFLICT(reino_id) DO UPDATE SET tipo=excluded.tipo, dados=excluded.dados, versao=excluded.versao",
                ("$r", versao.Id), ("$t", tipo), ("$d", dados), ("$v", versao.IconeVersao));
            return Results.Json(new { versao = versao.IconeVersao }, Json.Web);
        });

        conta.MapDelete("/reino/icone", async (HttpContext ctx, Motor motor, Banco banco) =>
        {
            var id = ctx.ContaId();
            var rid = await motor.Executar(m => { var r = Sessao.ReinoDa(m, id); r.IconeProprio = false; r.IconeVersao++; m.Sujar(r); return r.Id; });
            banco.Exec("DELETE FROM icones WHERE reino_id=$r", ("$r", rid));
            return Results.NoContent();
        });

        // a imagem do reino é pública, como o nome: aparece no jogo e no mapa ao vivo. A versão vai na URL, por isso o cache é longo.
        publico.MapGet("/reinos/{id:long}/icone", (long id, HttpContext ctx, Banco banco) =>
        {
            var l = banco.Consultar("SELECT tipo, dados FROM icones WHERE reino_id=$r", rd => (rd.GetString(0), (byte[])rd[1]), ("$r", id)).FirstOrDefault();
            if (l.Item2 == null) return Results.NotFound();
            ctx.Response.Headers.CacheControl = "public, max-age=86400";
            ctx.Response.Headers["Content-Security-Policy"] = "default-src 'none'; sandbox";
            return Results.Bytes(l.Item2, l.Item1);
        });

        conta.MapPost("/obras", async (PedidoObra p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                var hex = p.Hex ?? (p.C is int c && p.L is int l && m.G.Dentro(c, l) ? m.G.Indice(c, l) : -1);
                var item = p.Acao switch
                {
                    "melhorar" => Obras.Melhorar(m, r, p.LocalId ?? 0),
                    "moradia" => Obras.Moradia(m, r, p.LocalId ?? r.CasteloId),
                    "fundar" => Obras.Fundar(m, r, p.Tipo ?? "", hex),
                    _ => throw new RegraException("Ação de obra desconhecida."),
                };
                return VisaoReino.Item(m, r, item);
            }), Json.Web, statusCode: 201);
        });

        conta.MapDelete("/filas/{fila}/{item:long}", async (string fila, long item, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            await motor.Executar(m => Filas.Cancelar(m, Sessao.ReinoDa(m, id), fila, item));
            return Results.NoContent();
        });

        conta.MapGet("/mapa", async (HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m => VisaoMapa.Montar(m, Sessao.ReinoDa(m, id))), Json.Web);
        });

        conta.MapGet("/fundar/motivo", async (string tipo, int hex, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            // a foto da névoa em dia com o que o reino vê agora (o motivo usa só o que ele sabe)
            return Results.Json(await motor.Executar(m => { var r = Sessao.ReinoDa(m, id); ReinoDePedra.Jogo.Exploracao.Nevoas.VisiveisAgora(m, r.Id); return new { motivo = Obras.MotivoNaoFundar(m, r, tipo, hex) }; }), Json.Web);
        });
    }
}

/// <summary>Validação mínima de imagens por assinatura e cabeçalho (sem decodificar a imagem).</summary>
public static class Imagens
{
    public static string? Tipo(byte[] d)
    {
        if (d.Length > 24 && d[0] == 0x89 && d[1] == 0x50 && d[2] == 0x4E && d[3] == 0x47) return "image/png";
        if (d.Length > 4 && d[0] == 0xFF && d[1] == 0xD8 && d[2] == 0xFF) return "image/jpeg";
        if (d.Length > 30 && d[0] == 'R' && d[1] == 'I' && d[2] == 'F' && d[3] == 'F' && d[8] == 'W' && d[9] == 'E' && d[10] == 'B' && d[11] == 'P') return "image/webp";
        return null;
    }

    public static (int w, int h)? Dimensoes(byte[] d, string tipo)
    {
        try
        {
            switch (tipo)
            {
                case "image/png":
                    return (BE(d, 16), BE(d, 20));
                case "image/jpeg":
                    for (var i = 2; i + 9 < d.Length;)
                    {
                        if (d[i] != 0xFF) return null;
                        var marca = d[i + 1];
                        var tam = (d[i + 2] << 8) | d[i + 3];
                        if (marca is >= 0xC0 and <= 0xCF and not 0xC4 and not 0xC8 and not 0xCC)
                            return ((d[i + 7] << 8) | d[i + 8], (d[i + 5] << 8) | d[i + 6]);
                        i += 2 + tam;
                    }
                    return null;
                case "image/webp":
                    var chunk = System.Text.Encoding.ASCII.GetString(d, 12, 4);
                    if (chunk == "VP8X") return (1 + (d[24] | d[25] << 8 | d[26] << 16), 1 + (d[27] | d[28] << 8 | d[29] << 16));
                    if (chunk == "VP8 ") return ((d[26] | d[27] << 8) & 0x3FFF, (d[28] | d[29] << 8) & 0x3FFF);
                    if (chunk == "VP8L") { var b = d[21] | d[22] << 8 | d[23] << 16 | d[24] << 24; return (1 + (b & 0x3FFF), 1 + ((b >> 14) & 0x3FFF)); }
                    return null;
            }
        }
        catch (IndexOutOfRangeException) { }
        return null;
    }
    private static int BE(byte[] d, int i) => d[i] << 24 | d[i + 1] << 16 | d[i + 2] << 8 | d[i + 3];
}
