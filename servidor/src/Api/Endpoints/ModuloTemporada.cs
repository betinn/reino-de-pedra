using ReinoDePedra.Api.Visoes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Temporada;

namespace ReinoDePedra.Api.Endpoints;

public sealed record PedidoEquipar(bool Equipada);
public sealed record PedidoTitulo(string? Nome);
public sealed record PedidoRegiao(string? Regiao);

/// <summary>
/// Temporada e legado (GET /temporada, equipar relíquias da temporada, título, região do exílio), ranking (GET /ranking) e
/// "precisa de você" (GET /agora). O legado é da conta: GET /temporada funciona sem reino (tela de criação).
/// </summary>
public sealed class ModuloTemporada : IModuloApi
{
    public void Mapear(RouteGroupBuilder publico, RouteGroupBuilder conta)
    {
        conta.MapGet("/temporada", async (HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Json.Resposta(await motor.Executar(m => VisaoTemporada.Montar(m, id, Sessao.ReinoOuNulo(m, id))), Json.Web);
        });
        conta.MapPost("/temporada/reliquias/{rel:long}", async (long rel, PedidoEquipar p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Json.Resposta(await motor.Executar(m => { Linhagem.Equipar(m, id, rel, p.Equipada); return VisaoTemporada.Montar(m, id, Sessao.ReinoOuNulo(m, id)); }), Json.Web);
        });
        conta.MapPost("/temporada/titulo", async (PedidoTitulo p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Json.Resposta(await motor.Executar(m => { Linhagem.UsarTitulo(m, id, p.Nome); return VisaoTemporada.Montar(m, id, Sessao.ReinoOuNulo(m, id)); }), Json.Web);
        });
        conta.MapPost("/temporada/exilio", async (PedidoRegiao p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Json.Resposta(await motor.Executar(m =>
            {
                Linhagem.EscolherRegiaoExilio(m, id, string.IsNullOrWhiteSpace(p.Regiao) ? null : p.Regiao);
                return VisaoTemporada.Montar(m, id, Sessao.ReinoOuNulo(m, id));
            }), Json.Web);
        });
        conta.MapGet("/ranking", async (HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Json.Resposta(await motor.Executar(m => VisaoTemporada.Ranking(m, Sessao.ReinoOuNulo(m, id))), Json.Web);
        });
        conta.MapGet("/agora", async (int? n, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Json.Resposta(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                var l = PrecisaDeVoce.Listar(m, r);
                var itens = n is int k && k > 0 ? PrecisaDeVoce.Resumo(l, k) : l;
                return new AgoraJson(total: l.Count, urgentes: l.Count(x => x.Grupo == PrecisaDeVoce.Urgente), itens, agora: m.Agora);
            }), Json.Web);
        });
    }
}

/// <summary>Registra o resumo do legado no GET /reino e marca o dia ativo da conta.</summary>
[Sistema]
public static class SistemaTemporadaApi
{
    public static void AoIniciar(Mundo m) => Sistemas.UmaVez("api-temporada", () =>
    {
        VisaoReino.Extras.Add((mm, r, d) =>
        {
            if (r.ContaId is not long c) return;
            Temporadas.MarcarAtivo(mm, c);
            d["legado"] = new SistemaTemporadaApiLegadoJson(
                linhagem: Linhagem.NivelDaConta(mm, c),
                titulo: Linhagem.TituloEmUso(mm, c),
                regiaoExilio: Linhagem.RegiaoExilio(mm, c) ? mm.Legados.Obter(c)?.RegiaoExilio : null
            );
        });
    });
}

// Formato das respostas em JSON: o nome, a ordem e o tipo de cada membro são o contrato com o cliente.
public sealed record AgoraJson(int total, int urgentes, List<ItemAgora> itens, long agora);
public sealed record SistemaTemporadaApiLegadoJson(int linhagem, string? titulo, string? regiaoExilio);
