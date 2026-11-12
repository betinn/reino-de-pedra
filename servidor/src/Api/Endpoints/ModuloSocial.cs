using ReinoDePedra.Api.Visoes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Api.Endpoints;

public sealed record PedidoCriarAlianca(string? Nome, Brasao? Brasao, bool Aberta = false);
public sealed record PedidoModoAlianca(bool Aberta);
public sealed record PedidoFalaAlianca(string? Texto, int? Hex);
public sealed record PedidoLocal(long LocalId);
public sealed record PedidoReinoAlvo(long ReinoId);
public sealed record PedidoTexto(string? Texto);
public sealed record PedidoRecursos(long AliadoId, Dictionary<string, double>? Recursos, long? LocalId, string? Recado);
public sealed record PedidoTroca(long ReinoId, Dictionary<string, double>? Da, Dictionary<string, double>? Quer, string? Recado);
public sealed record PedidoPacto(long ReinoId, int Dias, string? Pagador, Dictionary<string, double>? Pagamento, string? Recado);
public sealed record PedidoMensagem(string? Texto, long? ReinoId, long? LocalId, long? RespondeA);
public sealed record PedidoTreinarMensageiro(int Qtd);
public sealed record PedidoBandeira(int? Hex, int? C, int? L, string? Tipo, string? Recado);

/// <summary>Alianças, conversa, reforço entre aliados, comércio e diplomacia, mensageiros e bandeiras.</summary>
public sealed class ModuloSocial : IModuloApi
{
    public void Mapear(RouteGroupBuilder publico, RouteGroupBuilder conta)
    {
        // executa no motor com o reino da conta; devolve JSON (ou 204)
        static async Task<IResult> Com(HttpContext ctx, Motor motor, Func<Mundo, Reino, object?> f, int status = 200)
        {
            var id = ctx.ContaId();
            var r = await motor.Executar(m => f(m, Sessao.ReinoDa(m, id)));
            return r == null ? Results.NoContent() : Json.Resposta(r, Json.Web, statusCode: status);
        }

        // ---------------------------------------------------------------- aliança
        conta.MapGet("/alianca", (HttpContext ctx, Motor motor) => Com(ctx, motor, VisaoSocial.Alianca));
        conta.MapPost("/alianca", (PedidoCriarAlianca p, HttpContext ctx, Motor motor) =>
            Com(ctx, motor, (m, r) => { Aliancas.Criar(m, r, p.Nome, p.Brasao, p.Aberta); return VisaoSocial.Alianca(m, r); }, 201));
        conta.MapPost("/alianca/modo", (PedidoModoAlianca p, HttpContext ctx, Motor motor) =>
            Com(ctx, motor, (m, r) => { Aliancas.DefinirModo(m, r, p.Aberta); return null; }));
        conta.MapPost("/alianca/recado", (PedidoTexto p, HttpContext ctx, Motor motor) =>
            Com(ctx, motor, (m, r) => { Aliancas.Fixar(m, r, p.Texto); return null; }));
        conta.MapPost("/alianca/indicar", (PedidoReinoAlvo p, HttpContext ctx, Motor motor) =>
            Com(ctx, motor, (m, r) => { Aliancas.Indicar(m, r, p.ReinoId); return null; }));
        conta.MapPost("/alianca/reforco", (PedidoLocal p, HttpContext ctx, Motor motor) =>
            Com(ctx, motor, (m, r) => { var f = Aliancas.PedirReforco(m, r, p.LocalId); return new PostAliancaReforcoJson(f.Id); }, 201));
        conta.MapPost("/alianca/conversa/lida", (HttpContext ctx, Motor motor) =>
            Com(ctx, motor, (m, r) => { Aliancas.MarcarLida(m, r); return null; }));
        conta.MapPost("/alianca/convidar", (PedidoReinoAlvo p, HttpContext ctx, Motor motor) =>
            Com(ctx, motor, (m, r) => { Aliancas.Convidar(m, r, p.ReinoId); return null; }));
        conta.MapPost("/aliancas/{aid:long}/convite/{acao}", (long aid, string acao, HttpContext ctx, Motor motor) =>
            Com(ctx, motor, (m, r) =>
            {
                if (acao == "aceitar") Aliancas.AceitarConvite(m, r, aid);
                else if (acao == "recusar") Aliancas.RecusarConvite(m, r, aid);
                else throw new RegraException("Ação desconhecida.");
                return null;
            }));
        conta.MapPost("/aliancas/{aid:long}/entrar", (long aid, HttpContext ctx, Motor motor) =>
            Com(ctx, motor, (m, r) => { Aliancas.PedirEntrada(m, r, aid); return null; }));
        conta.MapPost("/alianca/pedidos-entrada/{rid:long}/{acao}", (long rid, string acao, HttpContext ctx, Motor motor) =>
            Com(ctx, motor, (m, r) =>
            {
                if (acao == "aceitar") Aliancas.AceitarPedido(m, r, rid);
                else if (acao == "recusar") Aliancas.RecusarPedido(m, r, rid);
                else throw new RegraException("Ação desconhecida.");
                return null;
            }));
        conta.MapPost("/alianca/membros/{rid:long}/{acao}", (long rid, string acao, HttpContext ctx, Motor motor) =>
            Com(ctx, motor, (m, r) =>
            {
                switch (acao)
                {
                    case "promover": Aliancas.Promover(m, r, rid); break;
                    case "rebaixar": Aliancas.Rebaixar(m, r, rid); break;
                    case "expulsar": Aliancas.Expulsar(m, r, rid); break;
                    case "lider": Aliancas.PassarLideranca(m, r, rid); break;
                    default: throw new RegraException("Ação desconhecida.");
                }
                return null;
            }));
        conta.MapPost("/alianca/sair", (HttpContext ctx, Motor motor) => Com(ctx, motor, (m, r) => { Aliancas.Sair(m, r); return null; }));
        conta.MapPost("/alianca/conversa", (PedidoFalaAlianca p, HttpContext ctx, Motor motor) =>
            Com(ctx, motor, (m, r) => { var f = Aliancas.Falar(m, r, p.Texto, p.Hex); return new PostAliancaConversaJson(f.Id, f.Texto, f.Quando); }, 201));
        conta.MapPost("/alianca/pedidos", (PedidoRecursos p, HttpContext ctx, Motor motor) =>
            Com(ctx, motor, (m, r) => VisaoSocial.Proposta(m, r, Comercio.PedirRecursos(m, r, p.AliadoId, p.Recursos, p.LocalId, p.Recado)), 201));
        conta.MapPost("/alianca/reforcos/{localId:long}/retornar", (long localId, HttpContext ctx, Motor motor) =>
            Com(ctx, motor, (m, r) => { var ex = Reforcos.Retornar(m, r, localId); return new PostAliancaReforcosRetornarJson(ex.Id, ex.Chegada, ex.Tropas); }));

        // ---------------------------------------------------------------- propostas (troca, pacto, pedido de recursos)
        conta.MapPost("/propostas/{pid:long}/{acao}", (long pid, string acao, HttpContext ctx, Motor motor) =>
            Com(ctx, motor, (m, r) =>
            {
                var p = m.Propostas.Obter(pid) ?? throw new RegraException("Proposta não encontrada.", 404);
                switch (acao)
                {
                    case "aceitar":
                        if (p.Tipo == Comercio.Troca) Comercio.AceitarTroca(m, r, pid);
                        else if (p.Tipo == Comercio.PactoT) Comercio.AceitarPacto(m, r, pid);
                        else Comercio.AceitarPedido(m, r, pid);
                        break;
                    case "recusar": Comercio.Recusar(m, r, pid); break;
                    case "cancelar": Comercio.Cancelar(m, r, pid); break;
                    default: throw new RegraException("Ação desconhecida.");
                }
                return VisaoSocial.Proposta(m, r, p);
            }));

        // ---------------------------------------------------------------- comércio e diplomacia
        conta.MapGet("/comercio", (HttpContext ctx, Motor motor) => Com(ctx, motor, VisaoSocial.Comercio_));
        conta.MapPost("/comercio/troca", (PedidoTroca p, HttpContext ctx, Motor motor) =>
            Com(ctx, motor, (m, r) => VisaoSocial.Proposta(m, r, Comercio.ProporTroca(m, r, p.ReinoId, p.Da, p.Quer, p.Recado)), 201));
        conta.MapPost("/comercio/pacto", (PedidoPacto p, HttpContext ctx, Motor motor) =>
            Com(ctx, motor, (m, r) => VisaoSocial.Proposta(m, r, Comercio.ProporPacto(m, r, p.ReinoId, p.Dias, p.Pagador, p.Pagamento, p.Recado)), 201));
        conta.MapPost("/comercio/resgates/{pid:long}/{acao}", (long pid, string acao, HttpContext ctx, Motor motor) =>
            Com(ctx, motor, (m, r) =>
            {
                if (acao == "pagar") Comercio.PagarResgate(m, r, pid);
                else if (acao == "recusar") Comercio.RecusarResgate(m, r, pid);
                else throw new RegraException("Ação desconhecida.");
                return null;
            }));

        // ---------------------------------------------------------------- mensageiros
        conta.MapGet("/mensagens", (HttpContext ctx, Motor motor) => Com(ctx, motor, VisaoSocial.Mensagens));
        conta.MapPost("/mensagens", (PedidoMensagem p, HttpContext ctx, Motor motor) =>
            Com(ctx, motor, (m, r) =>
            {
                var x = Mensageiros.Enviar(m, r, p.Texto, p.ReinoId, p.LocalId, p.RespondeA);
                return new PostMensagensJson(x.Id, chegada: x.MarchaId is long mid ? m.Marchas.Obter(mid)?.Chegada : null);
            }, 201));
        conta.MapPost("/mensagens/lidas", (HttpContext ctx, Motor motor) => Com(ctx, motor, (m, r) => new PostMensagensLidasJson(lidas: Mensageiros.LerTodas(m, r))));
        conta.MapPost("/mensageiros/treinar", (PedidoTreinarMensageiro p, HttpContext ctx, Motor motor) =>
            Com(ctx, motor, (m, r) => VisaoReino.Item(m, r, Mensageiros.Treinar(m, r, p.Qtd)), 201));

        // ---------------------------------------------------------------- bandeiras
        conta.MapGet("/bandeiras", (HttpContext ctx, Motor motor) => Com(ctx, motor, VisaoSocial.Bandeiras_));
        conta.MapPost("/bandeiras", (PedidoBandeira p, HttpContext ctx, Motor motor) =>
            Com(ctx, motor, (m, r) =>
            {
                var hex = p.Hex ?? (p.C is int c && p.L is int l && m.G.Dentro(c, l) ? m.G.Indice(c, l) : throw new RegraException("Escolha o hexágono."));
                var b = Bandeiras.Colocar(m, r, hex, p.Tipo, p.Recado);
                return new PostBandeirasJson(b.Id, b.Hex, b.Tipo, b.Recado, b.Quando);
            }, 201));
        conta.MapDelete("/bandeiras/{bid:long}", (long bid, HttpContext ctx, Motor motor) =>
            Com(ctx, motor, (m, r) => { Bandeiras.Remover(m, r, bid); return null; }));
    }
}

/// <summary>Social no estado do reino (sistemas apresentados, resumo), nos locais (reforço de aliados), nas marchas e no mapa.</summary>
[Sistema]
public static class ExtrasSocial
{
    public static void AoIniciar(Mundo m) => Sistemas.UmaVez("api-social", () =>
    {
        VisaoMapa.Aliados.Add((mm, r, outro) => Aliancas.SaoAliados(mm, r.Id, outro));
        VisaoMapa.Extras.Add(VisaoSocial.Mapa);
        VisaoReino.Extras.Add((mm, r, d) =>
        {
            // "sistemas" vem de VisaoSistemas
            var a = Aliancas.De(mm, r);
            var cargo = a?.Membro(r.Id)?.Cargo;
            var agora = mm.Agora;
            d["social"] = new ExtrasSocialSocialJson(
                alianca: a == null ? null : new ExtrasSocialSocialAliancaJson(a.Id, a.Nome, a.Brasao, cargo, membros: a.Membros.Count, naoLidas: Aliancas.NaoLidas(a, r.Id), a.Aberta),
                convites: Aliancas.ConvitesPara(mm, r.Id).Count(),
                pedidosEntrada: a != null && cargo != Aliancas.Membro ? a.Pedidos.Count(c => c.Ate > agora) : 0,
                pedidosRecursos: Comercio.Abertas(mm, r.Id).Count(p => p.Tipo == Comercio.Pedido),
                propostas: Comercio.Abertas(mm, r.Id).Count(p => p.Tipo != Comercio.Pedido),
                pactos: Comercio.PactosDe(mm, r.Id).Count(),
                resgates: Capturas.PresosDe(mm, r.Id).Count(p => p.Estado == Capturas.ResgatePedido && !r.ResgatesRecusados.Contains(p.Id)),
                mensagensNovas: Mensageiros.Recebidas(mm, r.Id).Count(x => !x.Lida),
                mensageiros: new ExtrasSocialSocialMensageirosJson(livres: r.MensageirosLivres, emCampo: Mensageiros.EmCampo(mm, r.Id).Count(), emTreino: Mensageiros.EmTreino(r).Sum(i => i.Restantes)),
                bandeiras: Bandeiras.De(mm, r.Id).Count()
            );
        });
        VisaoReino.ExtrasLocal.Add((mm, r, l, d) =>
        {
            if (l.ReforcosAliados.Count == 0) return;
            d["reforcosAliados"] = l.ReforcosAliados.Select(e => new ExtrasSocialReforcosAliadosJson(reino: mm.Reinos.Obter(e.ReinoId) is { } q ? Espionagem.Identidade(q) : null, e.Tropas, e.Desde)).ToList();
        });
        VisaoMarcha.ExtrasPropria.Add((mm, x) => x switch
        {
            Mensageiro mc => new ExtrasSocialAoIniciarJson(
                para: mm.Mensagens.Obter(mc.MensagemId) is { } msg && msg.PorReino ? mm.Reinos.Obter(msg.ParaId)?.Nome : null,
                retornando: mc.Retornando
            ),
            Remessa rm => new ExtrasSocialAoIniciar2Json(para: mm.Reinos.Obter(rm.ParaReinoId)?.Nome, motivo: rm.Motivo, pessoas: rm.Pessoas),
            _ => null,
        });
    });
}

// Formato das respostas em JSON: o nome, a ordem e o tipo de cada membro são o contrato com o cliente.
public sealed record PostAliancaReforcoJson(long Id);
public sealed record PostAliancaConversaJson(long Id, string Texto, long Quando);
public sealed record PostAliancaReforcosRetornarJson(long Id, long Chegada, Dictionary<string, int> Tropas);
public sealed record PostMensagensJson(long Id, long? chegada);
public sealed record PostMensagensLidasJson(int lidas);
public sealed record PostBandeirasJson(long Id, int Hex, string Tipo, string Recado, long Quando);
public sealed record ExtrasSocialSocialJson(ExtrasSocialSocialAliancaJson? alianca, int convites, int pedidosEntrada, int pedidosRecursos, int propostas, int pactos, int resgates, int mensagensNovas, ExtrasSocialSocialMensageirosJson mensageiros, int bandeiras);
public sealed record ExtrasSocialSocialAliancaJson(long Id, string Nome, Brasao Brasao, string? cargo, int membros, int naoLidas, bool Aberta);
public sealed record ExtrasSocialSocialMensageirosJson(int livres, int emCampo, int emTreino);
public sealed record ExtrasSocialReforcosAliadosJson(System.Text.Json.Nodes.JsonObject? reino, Dictionary<string, int> Tropas, long Desde);
public sealed record ExtrasSocialAoIniciarJson(string? para, bool retornando);
public sealed record ExtrasSocialAoIniciar2Json(string? para, string motivo, int pessoas);
