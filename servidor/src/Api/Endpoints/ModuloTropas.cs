using System.Text.Json.Nodes;
using ReinoDePedra.Api.Visoes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Api.Endpoints;

public sealed record PedidoRecrutar(long LocalId, string Unidade, int Qtd);
public sealed record PedidoEnviar(long DeLocalId, Dictionary<string, int>? Tropas, int? DestinoHex, int? C, int? L, string? Ordem, bool Seguro, JsonObject? Dados, List<long>? Pessoas = null);
public sealed record PedidoOrdem(string Ordem, int? DestinoHex, int? C, int? L, bool? Seguro, JsonObject? Dados);
public sealed record PedidoPostura(long? LocalId, long? MarchaId, bool? Todas, bool? TodosExercitos, string Postura);
public sealed record PedidoPrevia(long? DeLocalId, long? MarchaId, Dictionary<string, int>? Tropas, int? DestinoHex, int? C, int? L, List<long>? Pessoas = null);

/// <summary>Recrutamento, envio de tropas, ordens a exércitos em campo e posturas.</summary>
public sealed class ModuloTropas : IModuloApi
{
    public static int Hex(Mundo m, int? hex, int? c, int? l) =>
        hex ?? (c is int cc && l is int ll && m.G.Dentro(cc, ll) ? m.G.Indice(cc, ll) : throw new RegraException("Escolha o destino."));

    public static Postura LerPostura(string? s) =>
        Enum.TryParse<Postura>(s, true, out var p) && Enum.IsDefined(p) ? p : throw new RegraException("Postura desconhecida.");

    public void Mapear(RouteGroupBuilder publico, RouteGroupBuilder conta)
    {
        conta.MapGet("/tropas", async (HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m => VisaoTropas.Montar(m, Sessao.ReinoDa(m, id))), Json.Web);
        });

        conta.MapPost("/recrutamento", async (PedidoRecrutar p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                var item = Recrutamento.Recrutar(m, r, p.LocalId, p.Unidade ?? "", p.Qtd);
                return VisaoReino.Item(m, r, item);
            }), Json.Web, statusCode: 201);
        });

        conta.MapPost("/tropas/enviar", async (PedidoEnviar p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                var (tropas, escolha) = EnvioPessoas.Ler(m, r, p.DeLocalId, p.Pessoas, p.Tropas);
                using var _ = escolha;
                var ex = Exercitos.Enviar(m, r, p.DeLocalId, tropas, Hex(m, p.DestinoHex, p.C, p.L), p.Ordem ?? OrdemMover.Id, p.Seguro, p.Dados);
                return VisaoTropas.Exercito(m, ex);
            }), Json.Web, statusCode: 201);
        });

        conta.MapPost("/tropas/previa", async (PedidoPrevia p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                var para = Hex(m, p.DestinoHex, p.C, p.L);
                if (!m.G.Valido(para)) throw new RegraException("Destino fora do mapa.");
                if (p.MarchaId is long mid)
                {
                    var ex = Exercitos.Do(m, r, mid);
                    return VisaoTropas.Previa(m, r, ex.HexEm(m.Agora), para, ex.Tropas);
                }
                var l = m.Locais.Obter(p.DeLocalId ?? 0);
                if (l == null || l.ReinoId != r.Id) throw new RegraException("Local não é seu.", 404);
                var (tropas, escolha) = EnvioPessoas.Ler(m, r, l.Id, p.Pessoas, p.Tropas);
                using var _ = escolha;
                return VisaoTropas.Previa(m, r, l.Hex, para, GT.Validar(m, l, tropas));
            }), Json.Web);
        });

        conta.MapPost("/tropas/{marchaId:long}/ordem", async (long marchaId, PedidoOrdem p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                int? hex = p.DestinoHex ?? (p.C is int c && p.L is int l && m.G.Dentro(c, l) ? m.G.Indice(c, l) : null);
                Exercitos.DarOrdem(m, r, marchaId, p.Ordem ?? "", hex, p.Seguro, p.Dados);
                return m.Marchas.Obter(marchaId) is Exercito ex ? VisaoTropas.Exercito(m, ex) : new { id = marchaId, encerrado = true };
            }), Json.Web);
        });

        conta.MapPut("/tropas/postura", async (PedidoPostura p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            var postura = LerPostura(p.Postura);
            var n = await motor.Executar(m => Exercitos.MudarPostura(m, Sessao.ReinoDa(m, id), postura, p.LocalId, p.MarchaId, p.Todas == true, p.TodosExercitos == true));
            return Results.Json(new { alterados = n, postura }, Json.Web);
        });
    }
}

/// <summary>Dados de tropas acrescentados ao estado do reino, aos locais e às marchas próprias.</summary>
[Sistema]
public static class ExtrasTropas
{
    public static void AoIniciar(Mundo m) => Sistemas.UmaVez("api-tropas", () =>
    {
        VisaoReino.Extras.Add((mm, r, d) =>
        {
            var exs = Exercitos.De(mm, r.Id).ToList();
            d["popLivre"] = Math.Floor(r.Pop);
            d["tropasResumo"] = new
            {
                guarnicoes = mm.LocaisDe(r.Id).Sum(l => GT.Total(l.Guarnicao)),
                emCampo = exs.Sum(e => GT.Total(e.Tropas)), exercitos = exs.Count,
                emTreino = Recrutamento.Itens(r).Sum(i => i.Restantes),
            };
        });
        VisaoReino.ExtrasLocal.Add((mm, r, l, d) => d["recruta"] = Recrutamento.Recruta(l));
        VisaoMarcha.ExtrasPropria.Add((mm, x) => x is Exercito e
            ? new { e.Ordem, e.Postura, e.OrigemLocalId, e.AlvoLocalId, parado = e.Parado, cargaMax = e.CargaMax(mm) }
            : null);
    });
}
