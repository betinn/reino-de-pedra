using ReinoDePedra.Api.Visoes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Api.Endpoints;

public sealed record PedidoTreinarExplorador(string Tipo, int Qtd);
/// <summary>Envio de explorador. <c>Seguro</c> vem ligado por padrão: o explorador desvia do perigo que o reino conhece (quem envia pode desligar).</summary>
public sealed record PedidoEnviarExplorador(string Tipo, string? Ordem, int? DestinoHex, int? C, int? L, List<int>? Pontos, bool? Seguro, Dictionary<string, int>? Escolta, bool Circuito = false);
public sealed record PedidoOrdemExplorador(string Ordem, int? DestinoHex, int? C, int? L, List<int>? Pontos, bool? Seguro, bool Circuito = false);
public sealed record PedidoPreviaExploracao(string? Tipo, long? DeLocalId, Dictionary<string, int>? Tropas, Dictionary<string, int>? Escolta, long? MarchaId, int? DestinoHex, int? C, int? L);
public sealed record PedidoPrisioneiro(string Acao, Dictionary<string, double>? Resgate);
public sealed record PedidoRota(int? Hex, int? C, int? L);

/// <summary>Exploradores (treino, envio, ordens, prévia com risco), prisioneiros, fauna conhecida e obras de rota/ponte.</summary>
public sealed class ModuloExploracao : IModuloApi
{
    private static int? HexOuNulo(Mundo m, int? hex, int? c, int? l) =>
        hex ?? (c is int cc && l is int ll && m.G.Dentro(cc, ll) ? m.G.Indice(cc, ll) : null);

    public void Mapear(RouteGroupBuilder publico, RouteGroupBuilder conta)
    {
        conta.MapGet("/exploracao", async (HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m => VisaoExploracao.Montar(m, Sessao.ReinoDa(m, id))), Json.Web);
        });

        conta.MapPost("/exploradores/treinar", async (PedidoTreinarExplorador p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                return VisaoReino.Item(m, r, Exploradores.Treinar(m, r, p.Tipo ?? "", p.Qtd));
            }), Json.Web, statusCode: 201);
        });

        conta.MapPost("/exploradores/enviar", async (PedidoEnviarExplorador p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                var e = Exploradores.Enviar(m, r, p.Tipo ?? "", p.Ordem ?? Exploradores.Explorar, HexOuNulo(m, p.DestinoHex, p.C, p.L), p.Pontos, p.Seguro ?? true, p.Escolta, p.Circuito);
                return VisaoExploracao.Explorador(m, e);
            }), Json.Web, statusCode: 201);
        });

        conta.MapPost("/exploradores/{marchaId:long}/ordem", async (long marchaId, PedidoOrdemExplorador p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                Exploradores.DarOrdem(m, r, marchaId, p.Ordem ?? "", HexOuNulo(m, p.DestinoHex, p.C, p.L), p.Pontos, p.Seguro, p.Circuito);
                return m.Marchas.Obter(marchaId) is Explorador e ? VisaoExploracao.Explorador(m, e) : new { id = marchaId, encerrado = true };
            }), Json.Web);
        });

        conta.MapPost("/exploracao/previa", async (PedidoPreviaExploracao p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                var para = HexOuNulo(m, p.DestinoHex, p.C, p.L) ?? throw new RegraException("Escolha o destino.");
                if (!m.G.Valido(para)) throw new RegraException("Destino fora do mapa.");
                if (p.MarchaId is long mid)
                {
                    if (m.Marchas.Obter(mid) is not { } mc || mc.ReinoId != r.Id) throw new RegraException("Marcha não encontrada.", 404);
                    return VisaoExploracao.Previa(m, r, mc.HexEm(m.Agora), para, mc is Explorador ex ? ex.TipoExp : null, mc.Tropas);
                }
                if (p.Tipo != null)
                {
                    if (!m.P.Exploradores.ContainsKey(p.Tipo)) throw new RegraException("Tipo de explorador desconhecido.");
                    var c = m.Locais.Obter(r.CasteloId) ?? throw new RegraException("Sem castelo.");
                    var esc = GT.Limpo(p.Escolta);
                    if (esc.Count > 0) esc = GT.Validar(m, c, esc);
                    return VisaoExploracao.Previa(m, r, c.Hex, para, p.Tipo, esc);
                }
                var l = m.Locais.Obter(p.DeLocalId ?? r.CasteloId);
                if (l == null || l.ReinoId != r.Id) throw new RegraException("Local não é seu.", 404);
                return VisaoExploracao.Previa(m, r, l.Hex, para, null, GT.Validar(m, l, p.Tropas));
            }), Json.Web);
        });

        conta.MapPost("/prisioneiros/{pid:long}", async (long pid, PedidoPrisioneiro p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            await motor.Executar(m => Capturas.Decidir(m, Sessao.ReinoDa(m, id), pid, p.Acao ?? "", p.Resgate));
            return Results.NoContent();
        });

        conta.MapGet("/rotas/previa", async (int hex, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                if (!m.G.Valido(hex)) throw new RegraException("Hexágono fora do mapa.");
                var motivo = Rotas.Motivo(m, r, hex);
                var conhecido = Nevoas.Explorado(m, r.Id, hex);
                var (custo, seg, ponte) = conhecido ? Rotas.Custo(m, hex) : (new Recursos(), 0, false);
                return new { hex, motivo, ponte, custo, seg, terreno = conhecido ? Jogo.Mapa.TerrenoExt.Chave(m.Mapa.Terrenos[hex]) : null, rio = conhecido && m.Mapa.Rio[hex] };
            }), Json.Web);
        });

        conta.MapPost("/rotas", async (PedidoRota p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                var hex = HexOuNulo(m, p.Hex, p.C, p.L) ?? throw new RegraException("Escolha o hexágono.");
                return VisaoReino.Item(m, r, Rotas.Construir(m, r, hex));
            }), Json.Web, statusCode: 201);
        });
    }
}

/// <summary>Dados de exploração no estado do reino, nas marchas próprias e no mapa.</summary>
[Sistema]
public static class ExtrasExploracao
{
    public static void AoIniciar(Mundo m) => Sistemas.UmaVez("api-exploracao", () =>
    {
        VisaoMapa.Extras.Add(VisaoExploracao.Mapa);
        VisaoMarcha.ExtrasPropria.Add((mm, x) => x is Explorador e
            ? new { e.TipoExp, nome = e.NomeTipo(mm), e.Ordem, e.Alvo, e.Pontos, e.EspionandoAte, escolta = e.Tropas }
            : null);
        VisaoReino.Extras.Add((mm, r, d) =>
        {
            d["exploracao"] = new
            {
                livres = r.ExploradoresLivres.Values.Sum(),
                emCampo = Exploradores.De(mm, r.Id).Count(),
                emTreino = Exploradores.EmTreino(r).Sum(i => i.Restantes),
                presos = Capturas.PresosPor(mm, r.Id).Count(),
                capturados = Capturas.PresosDe(mm, r.Id).Count(),
                conhecidos = r.ReinosConhecidos.Count,
            };
        });
    });
}
