using ReinoDePedra.Api.Visoes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Valiosos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;
using PS = ReinoDePedra.Jogo.Pessoas.Pessoas;

namespace ReinoDePedra.Api.Endpoints;

public sealed record PedidoColeta(long DeLocalId, Dictionary<string, int>? Tropas, int? Civis, int? Hex, int? C, int? L, bool? Repetir, bool? Seguro, List<long>? Pessoas = null);

/// <summary>
/// Coleta de madeira e pedra no mapa: GET /coleta (grupos coletando, locais com quem pode ir, regras), POST /coleta/previa
/// (recurso, estoque do hexágono, ritmo, carga, depósito e caminhos) e POST /coleta (tropas e civis sem trabalho).
/// O envio pelo mapa também aceita a ordem "coletar" em POST /tropas/enviar (só tropas).
/// </summary>
public sealed class ModuloColeta : IModuloApi
{
    public void Mapear(RouteGroupBuilder publico, RouteGroupBuilder conta)
    {
        conta.MapGet("/coleta", async (HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m => Montar(m, Sessao.ReinoDa(m, id))), Json.Web);
        });

        conta.MapPost("/coleta/previa", async (PedidoColeta p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                var hex = ModuloTropas.Hex(m, p.Hex, p.C, p.L);
                var l = m.Locais.Obter(p.DeLocalId);
                if (l == null || l.ReinoId != r.Id) throw new RegraException("Local não é seu.", 404);
                var tropas = GT.Limpo(p.Tropas);
                if (tropas.Count > 0) tropas = GT.Validar(m, l, tropas);
                var civis = Math.Max(0, p.Civis ?? 0);
                var pv = Coletas.Previa(m, r, l, tropas, civis, hex);
                return new
                {
                    hex, motivo = Coletas.Motivo(m, r, hex), pv.recurso, disponivel = Math.Floor(pv.disponivel), estoque = m.P.Coleta.Estoque,
                    ritmo = Math.Round(pv.ritmo, 2), cargaMax = pv.cargaMax, pessoas = pv.pessoas, maxPessoas = m.P.Coleta.MaxPessoas, jaNoHex = pv.jaNoHex,
                    deposito = pv.deposito, horasCarga = pv.ritmo > 0 ? Math.Round(pv.cargaMax / pv.ritmo, 2) : (double?)null,
                    ociosos = PS.OciososPresentes(m, l).Count(),
                    viagem = pv.pessoas > 0 ? VisaoTropas.Previa(m, r, l.Hex, hex, tropas) : null,
                };
            }), Json.Web);
        });

        conta.MapPost("/coleta", async (PedidoColeta p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Results.Json(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                var hex = ModuloTropas.Hex(m, p.Hex, p.C, p.L);
                var (tropas, escolha) = EnvioPessoas.Ler(m, r, p.DeLocalId, p.Pessoas, p.Tropas);
                using var _ = escolha;
                var ex = Coletas.Enviar(m, r, p.DeLocalId, tropas, Math.Max(0, p.Civis ?? 0), hex, p.Repetir ?? true, p.Seguro ?? false);
                return VisaoTropas.Exercito(m, ex);
            }), Json.Web, statusCode: 201);
        });
    }

    /// <summary>Grupos do reino coletando (ou a caminho, ou levando a carga), locais com tropas ou civis sem trabalho e as regras.</summary>
    public static object Montar(Mundo m, Reino r)
    {
        Economia.Atualizar(m, r);
        var grupos = Exercitos.De(m, r.Id).Where(e => e.Ordem is Coletas.OrdemColetarId or Coletas.OrdemEntregarId || e.ColetaPontoId != null)
            .OrderBy(e => e.Id).Select(e => VisaoTropas.Exercito(m, e)).ToList();
        var locais = m.LocaisDe(r.Id).Where(l => !l.Ruina).OrderBy(l => l.Tipo).ThenBy(l => l.Id).Select(l => new
        {
            l.Id, l.Nome, tipo = l.Tipo.Chave(), l.Hex, guarnicao = GT.GuarnicaoLivre(m, l), ociosos = PS.OciososPresentes(m, l).Count(),
        }).Where(x => x.ociosos > 0 || x.guarnicao.Count > 0).ToList();
        var c = m.P.Coleta;
        return new
        {
            agora = m.Agora, grupos, locais,
            regras = new { c.Terrenos, c.Taxa, c.ExpPessoas, c.MaxPessoas, c.CargaCivil, c.Estoque, c.RecuperaH, c.Vizinhos, c.Minimo },
        };
    }
}
