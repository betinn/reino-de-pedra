using System.Text.Json.Nodes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Api.Visoes;

/// <summary>
/// Aliança, comércio, mensagens e bandeiras para o cliente. Só o que o reino pode saber: identidades só de quem ele conhece,
/// o destinatário de uma mensagem a local desconhecido só se ele respondeu, bandeiras de outros só onde ele viu.
/// </summary>
public static class VisaoSocial
{
    private static JsonObject? Id(Mundo m, long reinoId) => m.Reinos.Obter(reinoId) is { } r ? Espionagem.Identidade(r) : null;

    private static long? Chegada(IEnumerable<Remessa> l) { var x = l.ToList(); return x.Count > 0 ? x.Max(r => r.Chegada) : null; }

    public static object Proposta(Mundo m, Reino r, Proposta p) => new
    {
        p.Id, p.Tipo, p.Estado, p.Quando, p.Ate, p.Respondida, p.Dias, p.Recado, p.LocalId,
        da = p.Da.Arredondado(), quer = p.Quer.Arredondado(),
        valorDa = Math.Round(Remessas.Valor(m, p.Da)), valorQuer = Math.Round(Remessas.Valor(m, p.Quer)),
        de = Id(m, p.DeId), para = Id(m, p.ParaId), minha = p.DeId == r.Id,
        local = p.LocalId is long lid && m.Locais.Obter(lid) is { } l && (l.ReinoId == r.Id || p.DeId == l.ReinoId) ? l.Nome : null,
        chegada = p.Estado == Comercio.Aceita ? Chegada(Remessas.Do(m, p.Tipo, p.Id)) : null,
    };

    // ---------------------------------------------------------------- aliança

    public static object Alianca(Mundo m, Reino r)
    {
        var agora = m.Agora;
        var a = Aliancas.De(m, r);
        var castelo = m.Locais.Obter(r.CasteloId);
        double[]? tempos = castelo != null && a != null ? Caminhos.MinutosAte(m, castelo.Hex, m.P.Carregador.Vel) : null;
        object? dados = null;
        if (a != null)
        {
            var eu = a.Membro(r.Id)!;
            var gerencia = eu.Cargo != Aliancas.Membro;
            dados = new
            {
                a.Id, a.Nome, a.Brasao, a.CriadaEm, meuCargo = eu.Cargo,
                membros = a.Membros.OrderBy(x => x.Cargo == Aliancas.Lider ? 0 : x.Cargo == Aliancas.Conselheiro ? 1 : 2).ThenBy(x => x.Desde).Select(x =>
                {
                    var q = m.Reinos.Obter(x.ReinoId);
                    var c = q != null ? m.Locais.Obter(q.CasteloId) : null;
                    return new
                    {
                        reino = Id(m, x.ReinoId), x.Cargo, x.Desde, eu = x.ReinoId == r.Id,
                        escudo = q != null && q.SobEscudo(agora),
                        novatoRestante = q != null && q.SobEscudo(agora) ? Math.Floor(Comercio.NovatoRestante(m, q)) : (double?)null,
                        minutos = x.ReinoId != r.Id && c != null && tempos != null && !double.IsInfinity(tempos[c.Hex]) ? Math.Round(tempos[c.Hex]) : (double?)null,
                        castelo = c != null ? c.Hex : (int?)null,
                    };
                }).ToList(),
                convites = gerencia ? a.Convites.Where(c => c.Ate > agora).Select(c => new { reino = Id(m, c.ReinoId), por = m.Reinos.Obter(c.PorId)?.Nome, c.Quando, c.Ate }).ToList() : null,
                pedidos = gerencia ? a.Pedidos.Where(c => c.Ate > agora).Select(c => new { reino = Id(m, c.ReinoId), c.Quando, c.Ate }).ToList() : null,
                treguas = a.Treguas.Where(t => t.Ate > agora).Select(t => new { reino = Id(m, t.ReinoId), t.Ate, t.Como }).ToList(),
                conversa = a.Conversa.TakeLast(50).Select(f => new { f.Id, reino = Id(m, f.ReinoId), f.Texto, f.Quando, minha = f.ReinoId == r.Id }).ToList(),
            };
        }
        var conhecidas = m.Aliancas.Where(x => x.Id != a?.Id && x.Membros.Any(y => Conhecimento.Conhece(r, y.ReinoId)))
            .Select(x => new
            {
                x.Id, x.Nome, x.Brasao, membros = x.Membros.Count, cheia = x.Membros.Count >= m.P.Alianca,
                conhecidos = x.Membros.Where(y => Conhecimento.Conhece(r, y.ReinoId)).Select(y => m.Reinos.Obter(y.ReinoId)?.Nome).ToList(),
                pedido = x.Pedidos.Any(c => c.ReinoId == r.Id && c.Ate > agora),
            }).ToList();
        var pedidos = m.Propostas.Where(p => p.Tipo == Comercio.Pedido && (p.DeId == r.Id || p.ParaId == r.Id)).OrderByDescending(p => p.Id).Select(p => Proposta(m, r, p)).ToList();
        var meusReforcos = new List<object>();
        var recebidos = new List<object>();
        foreach (var l in Reforcos.ComReforco(m))
            foreach (var e in l.ReforcosAliados)
            {
                if (e.ReinoId == r.Id) meusReforcos.Add(new { localId = l.Id, local = l.Nome, hex = l.Hex, aliado = Id(m, l.ReinoId), e.Tropas, e.Desde });
                if (l.ReinoId == r.Id) recebidos.Add(new { localId = l.Id, local = l.Nome, hex = l.Hex, reino = Id(m, e.ReinoId), e.Tropas, e.Desde });
            }
        return new
        {
            agora, limite = m.P.Alianca, conselheirosMax = m.P.Social.Conselheiros, treguaH = m.P.TreguaSaidaH,
            nome = m.P.Social.NomeAlianca, conversaMax = m.P.Social.Conversa.Caracteres, recadoMax = m.P.Mensageiro.RecadoProposta,
            livreEm = r.AliancaLivreEm > agora ? r.AliancaLivreEm : (long?)null,
            alianca = dados,
            convitesRecebidos = Aliancas.ConvitesPara(m, r.Id).Select(x => new
            {
                alianca = new { x.a.Id, x.a.Nome, x.a.Brasao, membros = x.a.Membros.Count }, por = Id(m, x.c.PorId), x.c.Ate,
            }).ToList(),
            aliancasConhecidas = conhecidas,
            conhecidos = r.ReinosConhecidos.Where(id => a?.Membro(id) == null).Select(id => m.Reinos.Obter(id)).OfType<Reino>().Where(q => q.Ativo)
                .OrderBy(q => q.Nome).Select(q => new { reino = Espionagem.Identidade(q), naAlianca = q.AliancaId != null }).ToList(),
            pedidosRecursos = pedidos,
            reforcos = new { meus = meusReforcos, recebidos },
        };
    }

    // ---------------------------------------------------------------- comércio

    public static object Comercio_(Mundo m, Reino r)
    {
        var agora = m.Agora;
        var conhecidos = r.ReinosConhecidos.Select(id => m.Reinos.Obter(id)).OfType<Reino>().Where(q => q.Ativo).OrderBy(q => q.Nome).Select(q =>
        {
            var pc = Comercio.PactoEntre(m, r.Id, q.Id);
            return new
            {
                reino = Espionagem.Identidade(q), aliado = Aliancas.SaoAliados(m, r.Id, q.Id), escudo = q.SobEscudo(agora),
                novatoRestante = q.SobEscudo(agora) ? Math.Floor(Comercio.NovatoRestante(m, q)) : (double?)null,
                pacto = pc?.Estado,
            };
        }).ToList();
        var propostas = m.Propostas.Where(p => p.Tipo != Comercio.Pedido && (p.DeId == r.Id || p.ParaId == r.Id)).OrderByDescending(p => p.Id).ToList();
        return new
        {
            agora, valor = m.P.Valor, novatoDia = m.P.Comercio.NovatoDia, pacto = m.P.Pacto, recadoMax = m.P.Mensageiro.RecadoProposta,
            eu = new { escudo = r.SobEscudo(agora), novatoRestante = r.SobEscudo(agora) ? Math.Floor(Comercio.NovatoRestante(m, r)) : (double?)null },
            conhecidos,
            paraMim = propostas.Where(p => p.ParaId == r.Id).Select(p => Proposta(m, r, p)).ToList(),
            minhas = propostas.Where(p => p.DeId == r.Id).Select(p => Proposta(m, r, p)).ToList(),
            pactos = Comercio.PactosDe(m, r.Id).OrderBy(p => p.Id).Select(p => new
            {
                p.Id, com = Id(m, p.Outro(r.Id)), p.Dias, p.Estado, p.Inicio, p.Fim, p.Aceito,
                pagador = p.PagadorId == null ? null : p.PagadorId == r.Id ? "eu" : "outro", pagamento = p.Pagamento.Arredondado(),
                chegada = p.Estado == Comercio.Aguardando ? Chegada(Remessas.Do(m, Comercio.PactoT, p.Id)) : null,
            }).ToList(),
            resgates = Capturas.PresosDe(m, r.Id).Where(p => p.Estado == Capturas.ResgatePedido).OrderBy(p => p.Ate).Select(p => new
            {
                prisioneiroId = p.Id, nome = Exploradores.NomeTipo(m, p.TipoExp), captor = Id(m, p.CaptorId), resgate = p.Resgate.Arredondado(), p.Ate,
                valor = Math.Round(Remessas.Valor(m, p.Resgate)),
                chegada = Chegada(Remessas.Do(m, Comercio.Resgate, p.Id)), recusado = r.ResgatesRecusados.Contains(p.Id),
            }).ToList(),
        };
    }

    // ---------------------------------------------------------------- mensagens

    public static object Mensagens(Mundo m, Reino r)
    {
        Economia.Atualizar(m, r);
        var castelo = m.Locais.Obter(r.CasteloId);
        var foto = Fotos.De(m, r.Id);
        var locais = new List<(Local l, int d)>();
        foreach (var (h, objs) in foto.Objetos)
            foreach (var o in objs)
            {
                if (o["tipo"]?.GetValue<string>() != "local" || o["dono"]?.GetValue<string>() != "desconhecido") continue;
                if (m.Locais.Obter(o["id"]!.GetValue<long>()) is not { } l || l.Hex != h || l.ReinoId == r.Id || l.ReinoId == 0 || l.Ruina) continue;
                if (VisaoMapa.Aliado(m, r, l.ReinoId)) continue;
                locais.Add((l, castelo != null ? m.G.Distancia(castelo.Hex, h) : 0));
            }
        return new
        {
            agora = m.Agora, livres = r.MensageirosLivres, emTreino = Mensageiros.EmTreino(r).Sum(i => i.Qtd),
            emCampo = Mensageiros.EmCampo(m, r.Id).Select(x => new { x.Id, x.Chegada, x.Retornando, mensagem = x.MensagemId }).ToList(),
            custo = m.P.Mensageiro.Custo, tempo = m.P.Mensageiro.Tempo, pop = m.P.Mensageiro.Pop, vel = m.P.Mensageiro.Vel, max = m.P.Mensageiro.Caracteres,
            recebidas = Mensageiros.Recebidas(m, r.Id).OrderByDescending(x => x.Entregue).Select(x => new { x.Id, de = Id(m, x.DeId), x.Texto, quando = x.Entregue, x.Lida, x.RespondeA }).ToList(),
            enviadas = Mensageiros.Enviadas(m, r.Id).OrderByDescending(x => x.Id).Select(x =>
            {
                var l = x.LocalId is long lid ? m.Locais.Obter(lid) : null;
                var mc = x.MarchaId is long mid ? m.Marchas.Obter(mid) as Mensageiro : null;
                return new
                {
                    x.Id, x.Texto, x.Enviada, x.Entregue, x.Estado, x.RespondeA,
                    para = Mensageiros.DestinatarioConhecido(m, x) ? Id(m, x.ParaId) : null,
                    local = x.PorReino || l == null ? null : new { l.Id, tipo = l.Tipo.Chave(), nome = l.Tipo.NomeGenerico(), hex = l.Hex },
                    chegada = mc != null && !mc.Retornando ? mc.Chegada : (long?)null, marcha = mc?.Id,
                };
            }).ToList(),
            destinos = new
            {
                reinos = r.ReinosConhecidos.Select(id => m.Reinos.Obter(id)).OfType<Reino>().Where(q => q.Ativo).OrderBy(q => q.Nome)
                    .Select(q => new { reino = Espionagem.Identidade(q), aliado = Aliancas.SaoAliados(m, r.Id, q.Id) }).ToList(),
                locais = locais.OrderBy(x => x.d).Take(8).Select(x => new { x.l.Id, tipo = x.l.Tipo.Chave(), nome = x.l.Tipo.NomeGenerico(), hex = x.l.Hex, c = m.G.C(x.l.Hex), l = m.G.L(x.l.Hex) }).ToList(),
            },
        };
    }

    // ---------------------------------------------------------------- bandeiras

    public static object Bandeiras_(Mundo m, Reino r)
    {
        var vis = Nevoas.VisiveisAgora(m, r.Id);
        var nevoa = Nevoas.De(m, r.Id);
        var vistas = new List<object>();
        foreach (var b in m.Bandeiras)
            if (b.ReinoId != r.Id && vis.Contains(b.Hex))
            {
                Bandeiras.Vista(m, r.Id, b);
                vistas.Add(new { b.Id, b.Hex, c = m.G.C(b.Hex), l = m.G.L(b.Hex), b.Tipo, b.Recado, b.Quando, autor = Id(m, b.ReinoId), aliado = Aliancas.SaoAliados(m, r.Id, b.ReinoId), foto = false, visto = m.Agora });
            }
        foreach (var (h, objs) in Fotos.De(m, r.Id).Objetos)
        {
            if (vis.Contains(h)) continue;
            foreach (var o in objs.Where(o => o["tipo"]?.GetValue<string>() == "bandeira"))
                vistas.Add(new
                {
                    Id = o["id"]!.GetValue<long>(), Hex = h, c = m.G.C(h), l = m.G.L(h), Tipo = o["tipoBandeira"]?.GetValue<string>(), Recado = o["recado"]?.GetValue<string>(),
                    Quando = o["quando"]?.GetValue<long>() ?? 0, autor = o["autor"]?.DeepClone(), aliado = o["dono"]?.GetValue<string>() == "aliado", foto = true,
                    visto = Nevoas.Instante(m, nevoa.MinutoVisto(h)),
                });
        }
        var p = m.P.Social.Bandeiras;
        return new
        {
            agora = m.Agora, max = p.Ativas, minimo = p.Minimo, caracteres = p.Caracteres, tipos = Jogo.Social.Bandeiras.Tipos,
            minhas = Jogo.Social.Bandeiras.De(m, r.Id).OrderByDescending(b => b.Id).Select(b => new { b.Id, b.Hex, c = m.G.C(b.Hex), l = m.G.L(b.Hex), b.Tipo, b.Recado, b.Quando }).ToList(),
            vistas,
        };
    }

    /// <summary>Bandeiras no mapa: as suas sempre, as de outros onde o reino vê agora (fora da visão, vêm da foto da névoa).</summary>
    public static IEnumerable<object> Mapa(Mundo m, Reino r, HashSet<int> vis)
    {
        var l = new List<object>();
        foreach (var b in m.Bandeiras)
        {
            if (b.ReinoId != r.Id && !vis.Contains(b.Hex)) continue;
            Jogo.Social.Bandeiras.Vista(m, r.Id, b);
            var o = Jogo.Social.Bandeiras.Objeto(m, r.Id, b);
            o["hex"] = b.Hex;
            l.Add(o);
        }
        return l;
    }
}
