using ReinoDePedra.Api.Visoes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Publico;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using static ReinoDePedra.Api.Visoes.VisaoCombate;

namespace ReinoDePedra.Api.Endpoints;

public sealed record PedidoTorre(int? Hex, int? C, int? L);

/// <summary>Ataques (prévia e envio), batalhas (ver, recuar) e defesas (torres e portões).</summary>
public sealed class ModuloCombate : IModuloApi
{
    public void Mapear(RouteGroupBuilder publico, RouteGroupBuilder conta)
    {
        conta.MapPost("/ataques/previa", async (PedidoAtaque p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Json.Resposta(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                return VisaoCombate.Previa(m, r, p, ModuloTropas.Hex(m, p.DestinoHex, p.C, p.L));
            }), Json.Web);
        });

        conta.MapPost("/ataques", async (PedidoAtaque p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Json.Resposta(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                var hex = ModuloTropas.Hex(m, p.DestinoHex, p.C, p.L);
                var ordem = Ataques.SemDono(m, Ataques.Alvo(m, r, hex)) ? OrdemOcupar.Id : OrdemAtacar.Id;
                Exercito ex;
                if (p.MarchaId is long mid)
                {
                    ex = p.Pessoas is { Count: > 0 }
                        ? Grupos.Parte(m, r, mid, p.Pessoas, e => { Exercitos.DarOrdem(m, r, e.Id, ordem, hex, p.Seguro, VisaoCombate.Dados(p)); return e; })
                        : Exercitos.Do(m, r, mid);
                    if (p.Pessoas is not { Count: > 0 }) Exercitos.DarOrdem(m, r, mid, ordem, hex, p.Seguro, VisaoCombate.Dados(p));
                }
                else ex = Exercitos.Enviar(m, r, p.DeLocalId ?? 0, p.Tropas, hex, ordem, p.Seguro == true, VisaoCombate.Dados(p));
                return VisaoTropas.Exercito(m, ex);
            }), Json.Web, statusCode: 201);
        });

        conta.MapGet("/batalhas", async (HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Json.Resposta(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                return Batalhas.DoReino(m, r.Id).OrderBy(b => b.Encerrada).ThenByDescending(b => b.Inicio).Select(b => VisaoCombate.Resumo(m, r, b)).ToList();
            }), Json.Web);
        });

        conta.MapGet("/batalhas/{bid:long}", async (long bid, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Json.Resposta(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                var b = m.Batalhas.Obter(bid);
                if (b == null || (b.AtacanteId != r.Id && b.DefensorId != r.Id)) throw new RegraException("Batalha não encontrada.", 404);
                return VisaoCombate.Batalha(m, r, b);
            }), Json.Web);
        });

        conta.MapPost("/batalhas/{bid:long}/recuar", async (long bid, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Json.Resposta(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                Batalhas.Recuar(m, r, bid);
                return VisaoCombate.Batalha(m, r, m.Batalhas[bid]);
            }), Json.Web);
        });

        conta.MapGet("/defesas", async (HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Json.Resposta(await motor.Executar(m => VisaoCombate.Defesas_(m, Sessao.ReinoDa(m, id))), Json.Web);
        });

        conta.MapGet("/defesas/torre/motivo", async (int hex, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Json.Resposta(await motor.Executar(m => { var r = Sessao.ReinoDa(m, id); Nevoas.VisiveisAgora(m, r.Id); return new DefesasTorreMotivoJson(motivo: Defesas.MotivoTorre(m, r, hex)); }), Json.Web);
        });

        conta.MapPost("/defesas/torres", async (PedidoTorre p, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Json.Resposta(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                var hex = p.Hex ?? (p.C is int c && p.L is int l && m.G.Dentro(c, l) ? m.G.Indice(c, l) : -1);
                return VisaoReino.Item(m, r, Defesas.NovaTorre(m, r, hex));
            }), Json.Web, statusCode: 201);
        });

        conta.MapPost("/defesas/torres/{tid:long}/nivel", async (long tid, HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Json.Resposta(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                return VisaoReino.Item(m, r, Defesas.SubirTorre(m, r, tid));
            }), Json.Web, statusCode: 201);
        });

        conta.MapPost("/defesas/portoes", async (HttpContext ctx, Motor motor) =>
        {
            var id = ctx.ContaId();
            return Json.Resposta(await motor.Executar(m =>
            {
                var r = Sessao.ReinoDa(m, id);
                return VisaoReino.Item(m, r, Defesas.SubirPortoes(m, r));
            }), Json.Web, statusCode: 201);
        });
    }
}

/// <summary>Combate no estado do reino, nos locais e no mapa (torres, batalhas).</summary>
[Sistema]
public static class ExtrasCombate
{
    public static void AoIniciar(Mundo m) => Sistemas.UmaVez("api-combate", () =>
    {
        VisaoReino.Extras.Add((mm, r, d) =>
        {
            d["batalhas"] = Batalhas.DoReino(mm, r.Id).Where(b => !b.Encerrada).Select(b => VisaoCombate.Resumo(mm, r, b)).ToList();
            d["combate"] = new ExtrasCombateCombateJson(taticas: mm.P.Combate.Taticas, taticaPadrao: mm.P.Combate.TaticaPadrao);
        });
        VisaoReino.ExtrasLocal.Add((mm, r, l, d) =>
        {
            d["defesa"] = new ExtrasCombateDefesaJson(
                torres: Defesas.NoAlcance(mm, l).Count, arqueirosNoAlto: Defesas.ArqueirosNoAlto(mm, l) - Defesas.ArqueirosMenagem(mm, l),
                portoes: l.Tipo == TipoLocal.Castelo ? Defesas.PortoesEfetivos(mm, l) : (int?)null,
                menagem: Defesas.ArqueirosMenagem(mm, l),
                batalhaId: Batalhas.Ativa(mm, l.Id)?.Id
            );
        });
        VisaoMapa.Extras.Add((mm, r, vis) =>
        {
            var lista = new List<object>();
            foreach (var t in mm.Torres)
            {
                var o = RegraPublica.Torre(mm, t);
                o["dono"] = VisaoMapa.Dono(mm, r, t.ReinoId);
                o["aoVivo"] = true;
                if (t.ReinoId == r.Id) o["arqueiros"] = Defesas.Arqueiros(mm, t);
                lista.Add(o);
            }
            // um objeto por local, de qualquer reino: as frentes que o reino disputa vão juntas, para o mapa mostrar um placar só
            foreach (var g in mm.Batalhas.Where(b => !b.Encerrada).GroupBy(b => b.LocalId))
            {
                var minhas = g.Where(b => b.AtacanteId == r.Id || b.DefensorId == r.Id).OrderBy(b => b.Id).ToList();
                var b0 = minhas.FirstOrDefault() ?? g.First();
                var papel = minhas.Count > 0 ? VisaoCombate.Papel(b0, r) : null;
                lista.Add(new ExtrasCombateAoIniciarJson(
                    tipo: "batalha", id: minhas.Count > 0 ? b0.Id : (long?)null, hex: b0.Hex, inicio: g.Min(b => b.Inicio), fim: g.Max(b => b.FimPrevisto), papel, frentes: g.Count(),
                    vivos: minhas.Select(b => VisaoCombate.Vivo(Batalhas.PlacarDe(mm, b, mm.Agora), papel!)).ToList()
                ));
            }
            return lista;
        });
    });
}

// Formato das respostas em JSON: o nome, a ordem e o tipo de cada membro são o contrato com o cliente.
public sealed record DefesasTorreMotivoJson(string? motivo);
public sealed record ExtrasCombateCombateJson(Dictionary<string, double?> taticas, string taticaPadrao);
/// <summary>Defesa de um local seu: <c>arqueirosNoAlto</c> só das torres; <c>menagem</c>, os da torre de menagem do castelo; <c>portoes</c>, o nível efetivo.</summary>
public sealed record ExtrasCombateDefesaJson(int torres, int arqueirosNoAlto, int? portoes, int menagem, long? batalhaId);
public sealed record ExtrasCombateAoIniciarJson(string tipo, long? id, int hex, long inicio, long fim, string? papel, int frentes, List<object> vivos);
