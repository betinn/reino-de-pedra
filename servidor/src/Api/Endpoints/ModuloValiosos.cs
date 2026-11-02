using System.Text.Json.Nodes;
using ReinoDePedra.Api.Visoes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Valiosos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Api.Endpoints;

public sealed record PedidoVeiculo(string Tipo, int? Qtd);
public sealed record PedidoSalgadeira(long LocalId);
public sealed record PedidoPosto(int? Hex, int? C, int? L);
public sealed record PedidoCaravanaApi(long OrigemLocalId, long DestinoLocalId, Dictionary<string, double>? Carga, Dictionary<string, int>? Veiculos,
    Dictionary<string, int>? Tropas, long? BaseLocalId, bool Seguro);
public sealed record PedidoExtracao(long DeLocalId, Dictionary<string, int>? Tropas, int? Hex, int? C, int? L, bool Repetir, bool Seguro, long? DestinoLocalId);
public sealed record PedidoMoverReliquia(long DeLocalId, Dictionary<string, int>? Tropas, long DestinoLocalId, bool Seguro);

/// <summary>Veículos, caravanas, salgadeira, postos, extração, escavação e relíquias.</summary>
public sealed class ModuloValiosos : IModuloApi
{
    private static PedidoCaravana Converter(PedidoCaravanaApi p) =>
        new(p.OrigemLocalId, p.DestinoLocalId, p.Carga, p.Veiculos, p.Tropas, p.BaseLocalId, p.Seguro);

    public void Mapear(RouteGroupBuilder publico, RouteGroupBuilder conta)
    {
        conta.MapPost("/veiculos", async (PedidoVeiculo p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                return VisaoReino.Item(m, r, Veiculos.Construir(m, r, p.Tipo, p.Qtd ?? 1));
            }), Json.Web, statusCode: 201);
        });

        conta.MapPost("/salgadeira", async (PedidoSalgadeira p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                return VisaoReino.Item(m, r, Salgadeiras.Construir(m, r, p.LocalId));
            }), Json.Web, statusCode: 201);
        });

        conta.MapPost("/postos", async (PedidoPosto p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                return VisaoReino.Item(m, r, Postos.Construir(m, r, ModuloTropas.Hex(m, p.Hex, p.C, p.L)));
            }), Json.Web, statusCode: 201);
        });

        conta.MapPost("/caravanas/previa", async (PedidoCaravanaApi p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                return VisaoValiosos.PlanoCaravana(m, Caravanas.Planejar(m, r, Converter(p)));
            }), Json.Web);
        });

        conta.MapPost("/caravanas", async (PedidoCaravanaApi p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                var c = Caravanas.Enviar(m, r, Converter(p));
                return new
                {
                    c.Id, c.Fase, c.Chegada, carga = c.Pedido.Arredondado(), c.Veiculos, tropas = c.Tropas,
                    poucoProtegida = Caravanas.PoucoProtegida(m, c.Tropas),
                };
            }), Json.Web, statusCode: 201);
        });

        conta.MapGet("/extracao", async (HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m => VisaoValiosos.Extracao(m, Sessao.ReinoDa(m, id))), Json.Web);
        });

        conta.MapPost("/extracao/previa", async (PedidoExtracao p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                return VisaoValiosos.PreviaExtracao(m, r, p.DeLocalId, p.Tropas, ModuloTropas.Hex(m, p.Hex, p.C, p.L));
            }), Json.Web);
        });

        // jazida: ordem "extrair" (com "repetir"); ruína antiga: ordem "escavar" (com o local que recebe a relíquia)
        conta.MapPost("/extracao", async (PedidoExtracao p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                var hex = ModuloTropas.Hex(m, p.Hex, p.C, p.L);
                var jazida = Extracoes.Conhecida(m, r.Id, hex) != null;
                var dados = jazida ? new JsonObject { ["repetir"] = p.Repetir } : new JsonObject();
                if (!jazida && p.DestinoLocalId is long d) dados["destinoLocalId"] = d;
                var ex = Extracoes.Enviar(m, r, p.DeLocalId, p.Tropas, hex, jazida ? Extracoes.OrdemExtrair : Escavacoes.OrdemEscavar, p.Seguro, dados);
                return VisaoValiosos.Grupo(m, r, ex);
            }), Json.Web, statusCode: 201);
        });

        conta.MapGet("/reliquias", async (HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m => VisaoValiosos.Reliquias(m, Sessao.ReinoDa(m, id))), Json.Web);
        });

        conta.MapPost("/reliquias/{rel:long}/previa", async (long rel, PedidoMoverReliquia p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m => VisaoValiosos.PreviaMover(m, Sessao.ReinoDa(m, id), rel, p.DeLocalId, p.Tropas, p.DestinoLocalId)), Json.Web);
        });

        conta.MapPost("/reliquias/{rel:long}/mover", async (long rel, PedidoMoverReliquia p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                var ex = ReliquiasLendarias.Mover(m, r, rel, p.DeLocalId, p.Tropas, p.DestinoLocalId, p.Seguro);
                return new { exercito = VisaoTropas.Exercito(m, ex), poucoProtegida = Caravanas.PoucoProtegida(m, ex.Tropas) };
            }), Json.Web, statusCode: 201);
        });
    }
}

/// <summary>
/// Dados de transporte, valiosos e relíquias acrescentados ao estado do reino, aos locais, às marchas e ao mapa.
/// Também confere os gatilhos dos sistemas apresentados aos poucos (o reino está olhando).
/// </summary>
[Sistema]
public static class ExtrasValiosos
{
    public static void AoIniciar(Mundo m) => Sistemas.UmaVez("api-valiosos", () =>
    {
        VisaoReino.Extras.Add((mm, r, d) =>
        {
            Apresentacao.Conferir(mm, r);
            // "sistemas" vem de VisaoSistemas (com os gatilhos de todos os sistemas)
            var naFila = r.Fila(Obras.Fila).Itens.Where(i => i.Tipo == ObraVeiculo.Id).ToList();
            d["veiculos"] = mm.B.VEICULOS.ToDictionary(kv => kv.Key, kv => new
            {
                nome = kv.Key == "carrocao" ? "Carroção" : "Carroça", livres = Veiculos.Livres(r, kv.Key), emUso = Veiculos.EmUso(mm, r, kv.Key),
                naFila = naFila.Where(i => i.Param == kv.Key).Sum(i => i.Qtd), carga = kv.Value.Carga, vel = kv.Value.Vel, custo = kv.Value.Custo,
                seg = mm.P.Veiculo.Tempo.GetValueOrDefault(kv.Key),
            });
            d["valiosos"] = new
            {
                ids = Valiosos.Ids, valor = mm.P.Valor,
                salgadeira = new { custo = mm.P.Salgadeira.Custo, seg = mm.P.Salgadeira.Tempo, horas = mm.P.Salgadeira.Horas, horasBase = mm.P.EstoqueHoras },
                posto = new { custo = mm.P.Posto.Custo, seg = mm.P.Posto.Tempo },
                escoltaMin = mm.P.Caravana.EscoltaMin,
            };
            d["reliquias"] = Reliquias.DoReino(mm, r.Id).OrderBy(x => x.Id).Select(x => new { x.Id, x.Nome, x.Tipo, x.LocalId, x.MarchaId, efeito = ReliquiasLendarias.Efeito(mm, x.Tipo) }).ToList();
        });
        VisaoReino.ExtrasLocal.Add((mm, r, l, d) =>
        {
            d["salgadeira"] = l.Salgadeira;
            d["podeSalgadeira"] = Salgadeiras.Serve(l);
            var rels = Reliquias.NoLocal(mm, l.Id).ToList();
            if (rels.Count > 0)
            {
                d["reliquias"] = rels.Select(x => new { x.Id, x.Nome, x.Tipo, efeito = ReliquiasLendarias.Efeito(mm, x.Tipo) }).ToList();
                d["nivelReliquias"] = ReliquiasLendarias.Nivel(mm, rels.Count);
            }
        });
        VisaoMarcha.ExtrasPropria.Add((mm, x) => x is Caravana c
            ? new
            {
                c.Fase, veiculos = c.Veiculos, pedido = c.Pedido.Arredondado(), c.OrigemLocalId, c.DestinoLocalId, c.BaseLocalId,
                origem = mm.Locais.Obter(c.OrigemLocalId)?.Nome, destino = mm.Locais.Obter(c.DestinoLocalId)?.Nome,
            }
            : null);
        VisaoMapa.Extras.Add((mm, r, vis) =>
        {
            Apresentacao.Conferir(mm, r);
            return ReliquiasLendarias.NoMapa(mm, r.Id, vis).Select<ReliquiaNoMapa, object>(x => x.Tipo switch
            {
                "farol" => new { tipo = "farol", id = x.LocalId, hex = x.Hex, n = x.N },
                "brilho" => new { tipo = "brilho", id = x.LocalId, hex = x.Hex, n = x.N },
                "local" => new { tipo = "reliquia-em", local = x.LocalId, hex = x.Hex, n = x.N, nivel = x.Nivel, tipos = x.Tipos, reliquia = new { tipo = x.Tipos.FirstOrDefault() ?? "desconhecido" } },
                _ => new { tipo = "reliquia-em", marcha = x.MarchaId, hex = x.Hex, n = x.N, nivel = "", tipos = x.Tipos, reliquia = new { tipo = x.Tipos.FirstOrDefault() ?? "desconhecido" } },
            }).ToList();
        });
    });
}
