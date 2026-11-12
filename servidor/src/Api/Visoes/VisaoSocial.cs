using System.Text.Json.Nodes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Api.Visoes;

/// <summary>
/// Aliança, comércio, mensagens e bandeiras para o cliente. Identidades e bandeiras são públicas; escudo só de aliado.
/// </summary>
public static class VisaoSocial
{
    private static JsonObject? Id(Mundo m, long reinoId) => m.Reinos.Obter(reinoId) is { } r ? Espionagem.Identidade(r) : null;

    private static long? Chegada(IEnumerable<Remessa> l) { var x = l.ToList(); return x.Count > 0 ? x.Max(r => r.Chegada) : null; }
    /// <summary>Partida da carga que chega por último (início da barra de tempo de quem espera a carga).</summary>
    private static long? Partida(IEnumerable<Remessa> l) => l.OrderByDescending(r => r.Chegada).Select(r => (long?)r.Partida).FirstOrDefault();

    public static object Proposta(Mundo m, Reino r, Proposta p) => new SocialPropostaJson(
        p.Id, p.Tipo, p.Estado, p.Quando, p.Ate, p.Respondida, p.Dias, p.Recado, p.LocalId,
        da: p.Da.Arredondado(), quer: p.Quer.Arredondado(),
        valorDa: Math.Round(Remessas.Valor(m, p.Da)), valorQuer: Math.Round(Remessas.Valor(m, p.Quer)),
        de: Id(m, p.DeId), para: Id(m, p.ParaId), minha: p.DeId == r.Id,
        local: p.LocalId is long lid && m.Locais.Obter(lid) is { } l && (l.ReinoId == r.Id || p.DeId == l.ReinoId) ? l.Nome : null,
        chegada: p.Estado == Comercio.Aceita ? Chegada(Remessas.Do(m, p.Tipo, p.Id)) : null,
        partida: p.Estado == Comercio.Aceita ? Partida(Remessas.Do(m, p.Tipo, p.Id)) : null
    );

    // ---------------------------------------------------------------- aliança

    public static object Alianca(Mundo m, Reino r)
    {
        var agora = m.Agora;
        var a = Aliancas.De(m, r);
        var castelo = m.Locais.Obter(r.CasteloId);
        double[]? tempos = castelo != null ? Caminhos.MinutosAte(m, castelo.Hex, m.P.Carregador.Vel) : null;
        double? Minutos(Reino? q) => q != null && m.Locais.Obter(q.CasteloId) is { } cq && tempos != null && !double.IsInfinity(tempos[cq.Hex]) ? Math.Round(tempos[cq.Hex]) : null;
        object? dados = null;
        if (a != null)
        {
            var eu = a.Membro(r.Id)!;
            var gerencia = eu.Cargo != Aliancas.Membro;
            dados = new SocialDadosJson(
                a.Id, a.Nome, a.Brasao, a.CriadaEm, meuCargo: eu.Cargo, a.Aberta,
                recado: a.Recado.Length > 0 ? new SocialDadosRecadoJson(texto: a.Recado, quando: a.RecadoEm) : null,
                naoLidas: Aliancas.NaoLidas(a, r.Id), lidaAte: a.LidaAte.GetValueOrDefault(r.Id),
                membros: a.Membros.OrderBy(x => x.Cargo == Aliancas.Lider ? 0 : x.Cargo == Aliancas.Conselheiro ? 1 : 2).ThenBy(x => x.Desde).Select(x =>
                {
                    var q = m.Reinos.Obter(x.ReinoId);
                    var c = q != null ? m.Locais.Obter(q.CasteloId) : null;
                    return new SocialDadosMembrosJson(
                        reino: Id(m, x.ReinoId), x.Cargo, x.Desde, eu: x.ReinoId == r.Id,
                        escudo: q != null && q.SobEscudo(agora),
                        novatoRestante: q != null && q.SobEscudo(agora) ? Math.Floor(Comercio.NovatoRestante(m, q)) : (double?)null,
                        minutos: x.ReinoId != r.Id && c != null && tempos != null && !double.IsInfinity(tempos[c.Hex]) ? Math.Round(tempos[c.Hex]) : (double?)null,
                        castelo: c != null ? c.Hex : (int?)null
                    );
                }).ToList(),
                convites: gerencia ? a.Convites.Where(c => c.Ate > agora).Select(c => new SocialDadosConvitesJson(reino: Id(m, c.ReinoId), por: m.Reinos.Obter(c.PorId)?.Nome, c.Quando, c.Ate)).ToList() : null,
                pedidos: gerencia ? a.Pedidos.Where(c => c.Ate > agora).Select(c => new SocialDadosPedidosJson(reino: Id(m, c.ReinoId), c.Quando, c.Ate)).ToList() : null,
                treguas: a.Treguas.Where(t => t.Ate > agora).Select(t => new SocialDadosTreguasJson(reino: Id(m, t.ReinoId), t.Ate, t.Como)).ToList(),
                // cada linha: fala de um membro ou evento da aliança. O que dá para fazer na linha vai dito (o cliente não deduz)
                conversa: a.Conversa.TakeLast(80).Select(f =>
                {
                    var p = f.PropostaId is long pid ? m.Propostas.Obter(pid) : null;
                    var alvo = f.AlvoId is long aid ? m.Reinos.Obter(aid) : null;
                    return new SocialDadosConversaJson(
                        f.Id, reino: f.ReinoId != 0 ? Id(m, f.ReinoId) : null, f.Texto, f.Quando, minha: f.ReinoId == r.Id && f.Tipo == Aliancas.TipoFala,
                        f.Tipo, f.Evento, f.Hex, f.LocalId, mencionaVoce: f.Todos && f.ReinoId != r.Id || f.Mencoes.Contains(r.Id),
                        // pedido de recursos feito a você e ainda aberto: Enviar na própria linha
                        propostaId: p != null && p.ParaId == r.Id && p.Estado == Comercio.Aberta && p.Ate > agora ? p.Id : (long?)null,
                        // indicação ainda sem convite: Convidar na própria linha (líder e conselheiros)
                        convidar: f.Evento == "indicacao" && gerencia && alvo is { Ativo: true, AliancaId: null } && a.Membros.Count < m.P.Alianca && !a.Convites.Any(c => c.ReinoId == alvo.Id && c.Ate > agora) ? alvo.Id : (long?)null,
                        // pedido de entrada ainda aberto: Aceitar na própria linha
                        aceitar: f.Evento == "pedido-entrada" && gerencia && alvo != null && a.Pedidos.Any(c => c.ReinoId == alvo.Id && c.Ate > agora) ? alvo.Id : (long?)null,
                        // pedido de reforço de outro membro: leva ao mapa, no local
                        reforcar: f.Evento is "pedido-reforco" or "ataque" && f.ReinoId != r.Id && f.Hex != null
                    );
                }).ToList()
            );
        }
        var outras = m.Aliancas.Where(x => x.Id != a?.Id)
            .Select(x => new SocialOutrasJson(
                x.Id, x.Nome, x.Brasao, membros: x.Membros.Count, cheia: x.Membros.Count >= m.P.Alianca, x.Aberta,
                // a aliança mais perto primeiro: a distância até o castelo do membro mais próximo
                minutos: x.Membros.Select(y => Minutos(m.Reinos.Obter(y.ReinoId))).Where(v => v != null).DefaultIfEmpty(null).Min(),
                nomes: x.Membros.Select(y => m.Reinos.Obter(y.ReinoId)?.Nome).ToList(),
                pedido: x.Pedidos.Any(c => c.ReinoId == r.Id && c.Ate > agora),
                // quem são os membros (público): o menu do mapa diz de que aliança é o reino clicado
                ids: x.Membros.Select(y => y.ReinoId).ToList()
            )).ToList();
        var pedidos = m.Propostas.Where(p => p.Tipo == Comercio.Pedido && (p.DeId == r.Id || p.ParaId == r.Id)).OrderByDescending(p => p.Id).Select(p => Proposta(m, r, p)).ToList();
        var meusReforcos = new List<object>();
        var recebidos = new List<object>();
        foreach (var l in Reforcos.ComReforco(m))
            foreach (var e in l.ReforcosAliados)
            {
                if (e.ReinoId == r.Id) meusReforcos.Add(new SocialAliancaJson(localId: l.Id, local: l.Nome, hex: l.Hex, aliado: Id(m, l.ReinoId), e.Tropas, e.Desde));
                if (l.ReinoId == r.Id) recebidos.Add(new SocialAlianca2Json(localId: l.Id, local: l.Nome, hex: l.Hex, reino: Id(m, e.ReinoId), e.Tropas, e.Desde));
            }
        return new SocialAlianca3Json(
            agora, limite: m.P.Alianca, conselheirosMax: m.P.Social.Conselheiros, treguaH: m.P.TreguaSaidaH,
            nome: m.P.Social.NomeAlianca, conversaMax: m.P.Social.Conversa.Caracteres, recadoFixadoMax: m.P.Social.Conversa.Recado, recadoMax: m.P.Mensageiro.RecadoProposta,
            livreEm: r.AliancaLivreEm > agora ? r.AliancaLivreEm : (long?)null,
            alianca: dados,
            convitesRecebidos: Aliancas.ConvitesPara(m, r.Id).Select(x => new SocialAlianca3ConvitesRecebidosJson(
                alianca: new SocialAlianca3ConvitesRecebidosAliancaJson(x.a.Id, x.a.Nome, x.a.Brasao, membros: x.a.Membros.Count), por: Id(m, x.c.PorId), x.c.Ate
            )).ToList(),
            aliancas: outras,
            // quem convidar: os vizinhos primeiro (a posição dos castelos é pública)
            reinos: m.Reinos.Where(q => q.Ativo && q.Id != r.Id && a?.Membro(q.Id) == null)
                .Select(q => new SocialAlianca3ReinosJson(reino: Espionagem.Identidade(q), naAlianca: q.AliancaId != null, minutos: Minutos(q), nome: q.Nome))
                .OrderBy(x => x.minutos ?? double.MaxValue).ThenBy(x => x.nome).ToList(),
            pedidosRecursos: pedidos,
            reforcos: new SocialAlianca3ReforcosJson(meus: meusReforcos, recebidos)
        );
    }

    // ---------------------------------------------------------------- comércio

    public static object Comercio_(Mundo m, Reino r)
    {
        var agora = m.Agora;
        var reinos = m.Reinos.Where(q => q.Ativo && q.Id != r.Id).OrderBy(q => q.Nome).Select(q =>
        {
            var pc = Comercio.PactoEntre(m, r.Id, q.Id);
            // o escudo de quem não é aliado só é descoberto ao chegar: nem o campo vai (null some no JSON)
            var aliado = Aliancas.SaoAliados(m, r.Id, q.Id);
            var escudo = aliado && q.SobEscudo(agora);
            return new SocialReinosJson(
                reino: Espionagem.Identidade(q), aliado, escudo: aliado ? escudo : (bool?)null,
                novatoRestante: escudo ? Math.Floor(Comercio.NovatoRestante(m, q)) : (double?)null,
                pacto: pc?.Estado
            );
        }).ToList();
        var propostas = m.Propostas.Where(p => p.Tipo != Comercio.Pedido && (p.DeId == r.Id || p.ParaId == r.Id)).OrderByDescending(p => p.Id).ToList();
        return new SocialComercio_Json(
            agora, valor: m.P.Valor, novatoDia: m.P.Comercio.NovatoDia, pacto: m.P.Pacto, recadoMax: m.P.Mensageiro.RecadoProposta,
            eu: new SocialComercio_EuJson(escudo: r.SobEscudo(agora), novatoRestante: r.SobEscudo(agora) ? Math.Floor(Comercio.NovatoRestante(m, r)) : (double?)null),
            reinos,
            paraMim: propostas.Where(p => p.ParaId == r.Id).Select(p => Proposta(m, r, p)).ToList(),
            minhas: propostas.Where(p => p.DeId == r.Id).Select(p => Proposta(m, r, p)).ToList(),
            pactos: Comercio.PactosDe(m, r.Id).OrderBy(p => p.Id).Select(p => new SocialComercio_PactosJson(
                p.Id, com: Id(m, p.Outro(r.Id)), p.Dias, p.Estado, p.Inicio, p.Fim, p.Aceito,
                pagador: p.PagadorId == null ? null : p.PagadorId == r.Id ? "eu" : "outro", pagamento: p.Pagamento.Arredondado(),
                chegada: p.Estado == Comercio.Aguardando ? Chegada(Remessas.Do(m, Comercio.PactoT, p.Id)) : null,
                partida: p.Estado == Comercio.Aguardando ? Partida(Remessas.Do(m, Comercio.PactoT, p.Id)) : null
            )).ToList(),
            resgates: Capturas.PresosDe(m, r.Id).Where(p => p.Estado == Capturas.ResgatePedido).OrderBy(p => p.Ate).Select(p => new SocialComercio_ResgatesJson(
                prisioneiroId: p.Id, nome: Exploradores.NomeTipo(m, p.TipoExp), captor: Id(m, p.CaptorId), resgate: p.Resgate.Arredondado(), p.Ate,
                valor: Math.Round(Remessas.Valor(m, p.Resgate)),
                chegada: Chegada(Remessas.Do(m, Comercio.Resgate, p.Id)), partida: Partida(Remessas.Do(m, Comercio.Resgate, p.Id)), recusado: r.ResgatesRecusados.Contains(p.Id)
            )).ToList()
        );
    }

    // ---------------------------------------------------------------- mensagens

    public static object Mensagens(Mundo m, Reino r)
    {
        Economia.Atualizar(m, r);
        return new SocialMensagensJson(
            agora: m.Agora, livres: r.MensageirosLivres, emTreino: Mensageiros.EmTreino(r).Sum(i => i.Restantes),
            emCampo: Mensageiros.EmCampo(m, r.Id).Select(x => new SocialMensagensEmCampoJson(x.Id, x.Partida, x.Chegada, x.Retornando, mensagem: x.MensagemId)).ToList(),
            custo: m.P.Mensageiro.Custo, tempo: m.P.Mensageiro.Tempo, pop: m.P.Mensageiro.Pop, vel: m.P.Mensageiro.Vel, max: m.P.Mensageiro.Caracteres,
            recebidas: Mensageiros.Recebidas(m, r.Id).OrderByDescending(x => x.Entregue).Select(x => new SocialMensagensRecebidasJson(x.Id, de: Id(m, x.DeId), x.Texto, quando: x.Entregue, x.Lida, x.RespondeA)).ToList(),
            enviadas: Mensageiros.Enviadas(m, r.Id).OrderByDescending(x => x.Id).Select(x =>
            {
                var l = x.LocalId is long lid ? m.Locais.Obter(lid) : null;
                var mc = x.MarchaId is long mid ? m.Marchas.Obter(mid) as Mensageiro : null;
                return new SocialMensagensEnviadasJson(
                    x.Id, x.Texto, x.Enviada, x.Entregue, x.Estado, x.RespondeA,
                    para: Id(m, x.ParaId),
                    local: l == null ? null : new SocialMensagensEnviadasLocalJson(l.Id, tipo: l.Tipo.Chave(), nome: l.Nome, hex: l.Hex),
                    chegada: mc != null && !mc.Retornando ? mc.Chegada : (long?)null, marcha: mc?.Id,
                    partida: mc != null && !mc.Retornando ? mc.Partida : (long?)null
                );
            }).ToList(),
            destinos: new SocialMensagensDestinosJson(
                reinos: m.Reinos.Where(q => q.Ativo && q.Id != r.Id).OrderBy(q => q.Nome)
                    .Select(q => new SocialMensagensDestinosReinosJson(reino: Espionagem.Identidade(q), aliado: Aliancas.SaoAliados(m, r.Id, q.Id))).ToList()
            )
        );
    }

    // ---------------------------------------------------------------- bandeiras

    public static object Bandeiras_(Mundo m, Reino r)
    {
        var vistas = new List<object>();
        foreach (var b in m.Bandeiras)
            if (b.ReinoId != r.Id)
                vistas.Add(new SocialBandeiras_Json(b.Id, b.Hex, c: m.G.C(b.Hex), l: m.G.L(b.Hex), b.Tipo, b.Recado, b.Quando, autor: Id(m, b.ReinoId), aliado: Aliancas.SaoAliados(m, r.Id, b.ReinoId)));
        var p = m.P.Social.Bandeiras;
        return new SocialBandeiras_2Json(
            agora: m.Agora, max: p.Ativas, minimo: p.Minimo, caracteres: p.Caracteres, tipos: Jogo.Social.Bandeiras.Tipos,
            minhas: Jogo.Social.Bandeiras.De(m, r.Id).OrderByDescending(b => b.Id).Select(b => new SocialBandeiras_2MinhasJson(b.Id, b.Hex, c: m.G.C(b.Hex), l: m.G.L(b.Hex), b.Tipo, b.Recado, b.Quando)).ToList(),
            vistas
        );
    }

    /// <summary>Bandeiras no mapa: públicas, de todos, com quem as colocou.</summary>
    public static IEnumerable<object> Mapa(Mundo m, Reino r, HashSet<int> vis)
    {
        var l = new List<object>();
        foreach (var b in m.Bandeiras)
        {
            var o = Jogo.Publico.RegraPublica.Bandeira(b);
            o["dono"] = VisaoMapa.Dono(m, r, b.ReinoId);
            o["autor"] = Id(m, b.ReinoId);
            l.Add(o);
        }
        return l;
    }
}

// Formato das respostas em JSON: o nome, a ordem e o tipo de cada membro são o contrato com o cliente.
public sealed record SocialPropostaJson(long Id, string Tipo, string Estado, long Quando, long Ate, long? Respondida, int Dias, string Recado, long? LocalId, Dictionary<string, long> da, Dictionary<string, long> quer, double valorDa, double valorQuer, JsonObject? de, JsonObject? para, bool minha, string? local, long? chegada, long? partida);
public sealed record SocialDadosJson(long Id, string Nome, Brasao Brasao, long CriadaEm, string meuCargo, bool Aberta, SocialDadosRecadoJson? recado, int naoLidas, long lidaAte, List<SocialDadosMembrosJson> membros, List<SocialDadosConvitesJson>? convites, List<SocialDadosPedidosJson>? pedidos, List<SocialDadosTreguasJson> treguas, List<SocialDadosConversaJson> conversa);
public sealed record SocialDadosRecadoJson(string texto, long quando);
public sealed record SocialDadosMembrosJson(JsonObject? reino, string Cargo, long Desde, bool eu, bool escudo, double? novatoRestante, double? minutos, int? castelo);
public sealed record SocialDadosConvitesJson(JsonObject? reino, string? por, long Quando, long Ate);
public sealed record SocialDadosPedidosJson(JsonObject? reino, long Quando, long Ate);
public sealed record SocialDadosTreguasJson(JsonObject? reino, long Ate, string Como);
public sealed record SocialDadosConversaJson(long Id, JsonObject? reino, string Texto, long Quando, bool minha, string Tipo, string? Evento, int? Hex, long? LocalId, bool mencionaVoce, long? propostaId, long? convidar, long? aceitar, bool reforcar);
public sealed record SocialOutrasJson(long Id, string Nome, Brasao Brasao, int membros, bool cheia, bool Aberta, double? minutos, List<string?> nomes, bool pedido, List<long> ids);
public sealed record SocialAliancaJson(long localId, string local, int hex, JsonObject? aliado, Dictionary<string, int> Tropas, long Desde);
public sealed record SocialAlianca2Json(long localId, string local, int hex, JsonObject? reino, Dictionary<string, int> Tropas, long Desde);
public sealed record SocialAlianca3Json(long agora, int limite, int conselheirosMax, double treguaH, ReinoDePedra.Jogo.Config.FaixaP nome, int conversaMax, int recadoFixadoMax, int recadoMax, long? livreEm, object? alianca, List<SocialAlianca3ConvitesRecebidosJson> convitesRecebidos, List<SocialOutrasJson> aliancas, List<SocialAlianca3ReinosJson> reinos, List<object> pedidosRecursos, SocialAlianca3ReforcosJson reforcos);
public sealed record SocialAlianca3ConvitesRecebidosJson(SocialAlianca3ConvitesRecebidosAliancaJson alianca, JsonObject? por, long Ate);
public sealed record SocialAlianca3ConvitesRecebidosAliancaJson(long Id, string Nome, Brasao Brasao, int membros);
public sealed record SocialAlianca3ReinosJson(JsonObject reino, bool naAlianca, double? minutos, string nome);
public sealed record SocialAlianca3ReforcosJson(List<object> meus, List<object> recebidos);
public sealed record SocialReinosJson(JsonObject reino, bool aliado, bool? escudo, double? novatoRestante, string? pacto);
public sealed record SocialComercio_Json(long agora, Dictionary<string, double> valor, double novatoDia, ReinoDePedra.Jogo.Config.PactoP pacto, int recadoMax, SocialComercio_EuJson eu, List<SocialReinosJson> reinos, List<object> paraMim, List<object> minhas, List<SocialComercio_PactosJson> pactos, List<SocialComercio_ResgatesJson> resgates);
public sealed record SocialComercio_EuJson(bool escudo, double? novatoRestante);
public sealed record SocialComercio_PactosJson(long Id, JsonObject? com, int Dias, string Estado, long Inicio, long Fim, long Aceito, string? pagador, Dictionary<string, long> pagamento, long? chegada, long? partida);
public sealed record SocialComercio_ResgatesJson(long prisioneiroId, string nome, JsonObject? captor, Dictionary<string, long> resgate, long Ate, double valor, long? chegada, long? partida, bool recusado);
public sealed record SocialMensagensJson(long agora, int livres, int emTreino, List<SocialMensagensEmCampoJson> emCampo, Dictionary<string, double> custo, double tempo, int pop, string vel, int max, List<SocialMensagensRecebidasJson> recebidas, List<SocialMensagensEnviadasJson> enviadas, SocialMensagensDestinosJson destinos);
public sealed record SocialMensagensEmCampoJson(long Id, long Partida, long Chegada, bool Retornando, long mensagem);
public sealed record SocialMensagensRecebidasJson(long Id, JsonObject? de, string Texto, long? quando, bool Lida, long? RespondeA);
public sealed record SocialMensagensEnviadasJson(long Id, string Texto, long Enviada, long? Entregue, string Estado, long? RespondeA, JsonObject? para, SocialMensagensEnviadasLocalJson? local, long? chegada, long? marcha, long? partida);
public sealed record SocialMensagensEnviadasLocalJson(long Id, string tipo, string nome, int hex);
public sealed record SocialMensagensDestinosJson(List<SocialMensagensDestinosReinosJson> reinos);
public sealed record SocialMensagensDestinosReinosJson(JsonObject reino, bool aliado);
public sealed record SocialBandeiras_Json(long Id, int Hex, int c, int l, string Tipo, string Recado, long Quando, JsonObject? autor, bool aliado);
public sealed record SocialBandeiras_2Json(long agora, int max, int minimo, int caracteres, string[] tipos, List<SocialBandeiras_2MinhasJson> minhas, List<object> vistas);
public sealed record SocialBandeiras_2MinhasJson(long Id, int Hex, int c, int l, string Tipo, string Recado, long Quando);
