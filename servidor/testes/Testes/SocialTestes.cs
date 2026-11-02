using System.Text.Json.Nodes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Testes;

public class SocialTestes
{
    public SocialTestes() => AjustesTeste.Garantir();

    private static Dictionary<string, int> G(params (string k, int n)[] g) => g.ToDictionary(x => x.k, x => x.n);
    private static Dictionary<string, double> R(params (string k, double n)[] g) => g.ToDictionary(x => x.k, x => x.n);
    private static void Conhecer(Mundo m, Reino a, Reino b) { Conhecimento.Conhecer(m, a, b, "teste"); Conhecimento.Conhecer(m, b, a, "teste"); }
    private static void AvancarAte(MundoTeste t, long instante) { t.Avancar(TimeSpan.FromMilliseconds(Math.Max(0, instante - t.M.Agora))); AjustesTeste.FalharSeErro(); }
    private static void SemEscudo(params Reino[] rs) { foreach (var r in rs) r.EscudoAte = 0; }

    /// <summary>Aliança com o líder e os outros reinos já dentro (todos se conhecem).</summary>
    private static Alianca Alianca(MundoTeste t, Reino lider, params Reino[] outros)
    {
        var a = Aliancas.Criar(t.M, lider, "Liga do Norte " + lider.Id);
        foreach (var o in outros)
        {
            Conhecer(t.M, lider, o);
            Aliancas.Convidar(t.M, lider, o.Id);
            Aliancas.AceitarConvite(t.M, o, a.Id);
        }
        return a;
    }

    // ---------------------------------------------------------------- alianças

    [Fact]
    public void Alianca_tem_limite_de_cinco_reinos()
    {
        var t = new MundoTeste();
        var rs = Enumerable.Range(0, 6).Select(_ => t.NovoReino()).ToList();
        var a = Alianca(t, rs[0], rs[1], rs[2], rs[3], rs[4]);
        Assert.Equal(t.M.P.Alianca, a.Membros.Count);
        Conhecer(t.M, rs[0], rs[5]);
        Assert.Contains("máximo", Assert.Throws<RegraException>(() => Aliancas.Convidar(t.M, rs[0], rs[5].Id)).Message);
        Assert.Throws<RegraException>(() => Aliancas.PedirEntrada(t.M, rs[5], a.Id));
    }

    [Fact]
    public void Convite_so_para_reino_conhecido_e_revela_quem_convida()
    {
        var t = new MundoTeste();
        var a = t.NovoReino(); var b = t.NovoReino();
        var al = Aliancas.Criar(t.M, a, "Liga do Sul");
        Assert.Throws<RegraException>(() => Aliancas.Convidar(t.M, a, b.Id));
        Conhecimento.Conhecer(t.M, a, b, "teste");
        Aliancas.Convidar(t.M, a, b.Id);
        Assert.True(Conhecimento.Conhece(b, a.Id));
        Assert.Single(Aliancas.ConvitesPara(t.M, b.Id));
        Aliancas.AceitarConvite(t.M, b, al.Id);
        Assert.Equal(al.Id, b.AliancaId);
        Assert.True(Aliancas.SaoAliados(t.M, a.Id, b.Id));
        Assert.Contains("alianca", b.SistemasVistos);
    }

    [Fact]
    public void Cargos_lider_conselheiros_e_membros()
    {
        var t = new MundoTeste();
        var rs = Enumerable.Range(0, 5).Select(_ => t.NovoReino()).ToList();
        var a = Alianca(t, rs[0], rs[1], rs[2], rs[3]);
        var novo = rs[4];
        Conhecer(t.M, rs[1], novo);
        // membro não convida nem promove
        Assert.Contains("líder e os conselheiros", Assert.Throws<RegraException>(() => Aliancas.Convidar(t.M, rs[1], novo.Id)).Message);
        Assert.Throws<RegraException>(() => Aliancas.Promover(t.M, rs[1], rs[2].Id));
        // até 2 conselheiros
        Aliancas.Promover(t.M, rs[0], rs[1].Id);
        Aliancas.Promover(t.M, rs[0], rs[2].Id);
        Assert.Contains("máximo", Assert.Throws<RegraException>(() => Aliancas.Promover(t.M, rs[0], rs[3].Id)).Message);
        // conselheiro convida e aceita pedido de entrada, mas não expulsa
        Aliancas.Convidar(t.M, rs[1], novo.Id);
        Aliancas.RecusarConvite(t.M, novo, a.Id);
        Aliancas.PedirEntrada(t.M, novo, a.Id);
        Assert.Throws<RegraException>(() => Aliancas.AceitarPedido(t.M, rs[3], novo.Id));   // membro não aceita
        Aliancas.AceitarPedido(t.M, rs[2], novo.Id);
        Assert.Equal(a.Id, novo.AliancaId);
        Assert.Throws<RegraException>(() => Aliancas.Expulsar(t.M, rs[1], rs[3].Id));
        Aliancas.Rebaixar(t.M, rs[0], rs[2].Id);
        Assert.Equal(Aliancas.Membro, a.Membro(rs[2].Id)!.Cargo);
        Aliancas.Expulsar(t.M, rs[0], rs[3].Id);
        Assert.Null(rs[3].AliancaId);
        Assert.True(Aliancas.EmTregua(t.M, rs[3].Id, rs[0].Id));
    }

    [Fact]
    public void Lider_que_sai_ou_entra_em_regencia_passa_ao_conselheiro_mais_antigo()
    {
        var t = new MundoTeste();
        var rs = Enumerable.Range(0, 4).Select(_ => t.NovoReino()).ToList();
        var a = Alianca(t, rs[0], rs[1], rs[2], rs[3]);
        foreach (var x in a.Membros) x.Desde = t.M.Agora + x.ReinoId;   // antiguidade na aliança pela ordem de criação
        a.Membro(rs[3].Id)!.Desde = t.M.Agora - 1;                        // rs[3] é o membro mais antigo depois do líder
        Aliancas.Promover(t.M, rs[0], rs[2].Id);
        Aliancas.Promover(t.M, rs[0], rs[1].Id);
        Aliancas.AoEntrarEmRegencia(t.M, rs[0]);
        Assert.Equal(rs[1].Id, a.Lider!.ReinoId);   // o conselheiro mais antigo (rs[3] é mais antigo, mas não é conselheiro)
        Assert.Equal(Aliancas.Membro, a.Membro(rs[0].Id)!.Cargo);
        // sem conselheiros, o membro mais antigo
        Aliancas.Rebaixar(t.M, rs[1], rs[2].Id);
        Aliancas.Sair(t.M, rs[1]);
        Assert.Equal(rs[3].Id, a.Lider!.ReinoId);
    }

    [Fact]
    public void Sair_da_tregua_de_24h_e_espera_para_outra_alianca()
    {
        var s = new CombateCenario();
        var t = s.T;
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 2)), 50);
        Alianca(t, s.Def, s.Atk);
        // aliado não é alvo: recusa no envio
        Assert.Equal(SistemaSocial.MotivoAliado, Assert.Throws<RegraException>(() => s.Atacar(alvo, G(("cavalaria", 5)))).Message);
        Aliancas.Sair(t.M, s.Atk);
        Assert.False(Aliancas.SaoAliados(t.M, s.Atk.Id, s.Def.Id));
        Assert.Contains("24 h", Assert.Throws<RegraException>(() => Aliancas.Criar(t.M, s.Atk, "Outra Liga")).Message);
        // sem saber de quem é o local, a trégua é descoberta ao chegar: as tropas voltam sem combate
        var ex = s.Atacar(alvo, G(("cavalaria", 5)));
        s.AvancarAte(ex.Chegada);
        Assert.Empty(t.M.Batalhas);
        Assert.True(ex.Retornando);
        Assert.Contains(t.M.Relatorios, r => r.ReinoId == s.Atk.Id && r.Dados["porQueVoltaram"]?.GetValue<string>() == SistemaSocial.MotivoTregua);
        // sabendo de quem é (espionado), recusa já no envio
        s.Atk.LocaisEspionados[alvo.Id] = new LocalEspionado { DonoId = s.Def.Id };
        Assert.Equal(SistemaSocial.MotivoTregua, Assert.Throws<RegraException>(() => s.Atacar(alvo, G(("cavalaria", 5)))).Message);
        // depois de 24 h: pode atacar e entrar em outra aliança
        t.AvancarHoras(t.M.P.TreguaSaidaH);
        Assert.False(Aliancas.EmTregua(t.M, s.Atk.Id, s.Def.Id));
        Aliancas.Criar(t.M, s.Atk, "Outra Liga");
        var ex2 = s.Atacar(alvo, G(("cavalaria", 5)));
        s.AvancarAte(ex2.Chegada);
        Assert.Single(t.M.Batalhas);
    }

    [Fact]
    public void Conversa_da_alianca_tem_limite_e_guarda_as_ultimas()
    {
        var t = new MundoTeste();
        var a = t.NovoReino(); var b = t.NovoReino();
        var al = Alianca(t, a, b);
        Assert.Throws<RegraException>(() => Aliancas.Falar(t.M, a, "  "));
        Assert.Throws<RegraException>(() => Aliancas.Falar(t.M, a, new string('x', t.M.P.Social.Conversa.Caracteres + 1)));
        var c = t.NovoReino();
        Assert.Throws<RegraException>(() => Aliancas.Falar(t.M, c, "oi"));   // só membros
        for (var i = 0; i < t.M.P.Social.Conversa.Guardar + 5; i++) Aliancas.Falar(t.M, i % 2 == 0 ? a : b, "mensagem " + i);
        Assert.Equal(t.M.P.Social.Conversa.Guardar, al.Conversa.Count);
        Assert.Equal("mensagem " + (t.M.P.Social.Conversa.Guardar + 4), al.Conversa[^1].Texto);
    }

    // ---------------------------------------------------------------- reforço entre aliados

    [Fact]
    public void Reforco_a_aliado_defende_e_continua_no_teto_de_quem_mandou()
    {
        var t = new MundoTeste();
        var a = t.NovoReino(); var b = t.NovoReino();
        Alianca(t, a, b);
        var ca = t.M.Locais[a.CasteloId]; var cb = t.M.Locais[b.CasteloId];
        ca.Guarnicao["lanceiro"] = 10;
        Economia.Atualizar(t.M, a); Economia.Atualizar(t.M, b);
        var tropasA = Economia.Tropas(t.M, a); var tropasB = Economia.Tropas(t.M, b);
        var ex = Exercitos.Enviar(t.M, a, ca.Id, G(("lanceiro", 6)), cb.Hex, OrdemReforcar.Id);
        AvancarAte(t, ex.Chegada);
        Assert.Null(t.M.Marchas.Obter(ex.Id));
        Assert.Equal(6, cb.Guarnicao.GetValueOrDefault("lanceiro"));   // defende com a guarnição
        var e = Assert.Single(cb.ReforcosAliados);
        Assert.Equal(a.Id, e.ReinoId);
        Assert.Equal(tropasA, Economia.Tropas(t.M, a));   // continua no teto de quem mandou
        Assert.Equal(tropasB, Economia.Tropas(t.M, b));
        // o dono do local não usa as tropas do aliado
        Assert.Throws<RegraException>(() => Exercitos.Enviar(t.M, b, cb.Id, G(("lanceiro", 1)), t.M.Locais.First(l => l.ReinoId == b.Id && l.Id != cb.Id).Hex, OrdemReforcar.Id));
        Assert.Empty(GT.GuarnicaoLivre(t.M, cb));
        // só volta por ordem de quem mandou
        Assert.Throws<RegraException>(() => Reforcos.Retornar(t.M, b, cb.Id));
        var volta = Reforcos.Retornar(t.M, a, cb.Id);
        Assert.Empty(cb.ReforcosAliados);
        Assert.Equal(0, cb.Guarnicao.GetValueOrDefault("lanceiro"));
        AvancarAte(t, volta.Chegada);
        Assert.Equal(10, ca.Guarnicao["lanceiro"]);
    }

    [Fact]
    public void Reforco_so_vai_a_aliado_e_volta_quando_a_alianca_acaba()
    {
        var t = new MundoTeste();
        var a = t.NovoReino(); var b = t.NovoReino();
        var ca = t.M.Locais[a.CasteloId]; var cb = t.M.Locais[b.CasteloId];
        ca.Guarnicao["lanceiro"] = 10;
        Assert.Throws<RegraException>(() => Exercitos.Enviar(t.M, a, ca.Id, G(("lanceiro", 6)), cb.Hex, OrdemReforcar.Id));
        Alianca(t, a, b);
        var ex = Exercitos.Enviar(t.M, a, ca.Id, G(("lanceiro", 6)), cb.Hex, OrdemReforcar.Id);
        AvancarAte(t, ex.Chegada);
        Assert.Single(cb.ReforcosAliados);
        Aliancas.Sair(t.M, a);
        Assert.Empty(cb.ReforcosAliados);
        var volta = Assert.Single(Exercitos.De(t.M, a.Id));
        Assert.True(volta.Retornando);
    }

    [Fact]
    public void Reforco_aliado_divide_as_perdas_da_defesa()
    {
        var s = new CombateCenario();
        var t = s.T;
        var aliado = t.NovoReino(); aliado.EscudoAte = 0;
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 10)), 50);
        Alianca(t, s.Def, aliado);
        var cal = t.M.Locais[aliado.CasteloId];
        cal.Guarnicao["lanceiro"] = 10;
        var re = Exercitos.Enviar(t.M, aliado, cal.Id, G(("lanceiro", 10)), alvo.Hex, OrdemReforcar.Id);
        AvancarAte(t, re.Chegada);
        Assert.Equal(20, alvo.Guarnicao["lanceiro"]);
        var b = s.Chegar(s.Atacar(alvo, G(("arqueiro", 30))));
        s.Terminar(b);
        var rc = AjustesTeste.De(t.M).Fins.Last();
        var perdas = rc.PerdasDefesa.GetValueOrDefault("lanceiro");
        Assert.True(perdas > 0);
        var restoAliado = alvo.ReforcosAliados.FirstOrDefault()?.Tropas.GetValueOrDefault("lanceiro") ?? 0;
        Assert.Equal(10 - (int)Math.Round(10.0 * perdas / 20), restoAliado);
        Assert.True(restoAliado <= alvo.Guarnicao.GetValueOrDefault("lanceiro"));
    }

    // ---------------------------------------------------------------- pedido de recursos

    [Fact]
    public void Pedido_de_recursos_aceito_viaja_e_pode_ser_roubado()
    {
        var t = new MundoTeste();
        var a = t.NovoReino(); var b = t.NovoReino(); var ladrao = t.NovoReino();
        SemEscudo(a, b, ladrao);
        Alianca(t, a, b);
        var conhecido = t.NovoReino();
        Assert.Throws<RegraException>(() => Comercio.PedirRecursos(t.M, a, conhecido.Id, R(("pedra", 300)), null, null));   // só a aliado
        var p = Comercio.PedirRecursos(t.M, a, b.Id, R(("pedra", 300)), null, "para a muralha");
        Assert.Single(Comercio.Abertas(t.M, b.Id));
        Comercio.AceitarPedido(t.M, b, p.Id);
        var rems = Remessas.Do(t.M, Comercio.Pedido, p.Id).ToList();
        Assert.NotEmpty(rems);
        Assert.All(rems, x => { Assert.Equal(b.Id, x.ReinoId); Assert.True(x.Interceptavel); });
        var antes = t.M.Locais[a.CasteloId].Estoque.Qtd("pedra");
        AvancarAte(t, rems.Max(x => x.Chegada));
        Economia.Atualizar(t.M, a);
        Assert.True(t.M.Locais[a.CasteloId].Estoque.Qtd("pedra") >= antes + 300 - 1e-6);

        // de novo, mas roubado no caminho
        var p2 = Comercio.PedirRecursos(t.M, a, b.Id, R(("madeira", 200)), null, null);
        Comercio.AceitarPedido(t.M, b, p2.Id);
        var rems2 = Remessas.Do(t.M, Comercio.Pedido, p2.Id).ToList();
        var cl = t.M.Locais[ladrao.CasteloId];
        cl.Guarnicao["cavalaria"] = 10;
        var lad = Exercitos.Enviar(t.M, ladrao, cl.Id, G(("cavalaria", 10)), t.M.G.Vizinhos(cl.Hex).First(h => !t.M.Mapa.Rio[h] && t.M.LocalNoHex(h) == null), OrdemMover.Id);
        foreach (var x in rems2) x.AoSerVencida(t.M, lad);
        Assert.Empty(Remessas.Do(t.M, Comercio.Pedido, p2.Id));
        Assert.Equal(200, lad.Carga.Qtd("madeira"), 3);
        Assert.Contains(t.M.Notificacoes, n => n.ReinoId == a.Id && n.Titulo == "Carga roubada no caminho");
    }

    // ---------------------------------------------------------------- mensageiros

    [Fact]
    public void Mensageiro_treina_entrega_revela_quem_mandou_e_volta()
    {
        var t = new MundoTeste();
        var a = t.NovoReino(); var b = t.NovoReino();
        t.DarRecursos(a);
        Assert.Throws<RegraException>(() => Mensageiros.Enviar(t.M, a, "olá", null, t.M.Locais[b.CasteloId].Id));   // sem mensageiro
        var item = Mensageiros.Treinar(t.M, a, 1);
        Assert.Equal(t.M.P.Mensageiro.Tempo, item.DuracaoSeg);
        t.AvancarMin(2);
        Assert.Equal(1, a.MensageirosLivres);
        var cb = t.M.Locais[b.CasteloId];
        Nevoas.RevelarArea(t.M, a.Id, cb.Hex, 0);
        Assert.Throws<RegraException>(() => Mensageiros.Enviar(t.M, a, new string('a', t.M.P.Mensageiro.Caracteres + 1), null, cb.Id));
        Assert.Throws<RegraException>(() => Mensageiros.Enviar(t.M, a, "olá", b.Id, null));   // reino desconhecido: só por um local dele
        var msg = Mensageiros.Enviar(t.M, a, "Podemos conversar sobre a estrada?", null, cb.Id);
        var mc = Assert.IsType<Mensageiro>(t.M.Marchas[msg.MarchaId!.Value]);
        Assert.False(mc.Interceptavel);   // tropas não o atacam
        Assert.False(mc.AlvoDeFauna);     // fauna também não
        Assert.Equal(0, a.MensageirosLivres);
        Economia.Atualizar(t.M, a);
        AvancarAte(t, mc.Chegada);
        Assert.Equal(Mensageiros.EntregueE, msg.Estado);
        Assert.Equal(b.Id, msg.ParaId);
        Assert.True(Conhecimento.Conhece(b, a.Id));      // a mensagem revela quem mandou
        Assert.False(Conhecimento.Conhece(a, b.Id));     // o destinatário não se revela
        Assert.False(Mensageiros.DestinatarioConhecido(t.M, msg));
        Assert.True(mc.Retornando);
        AvancarAte(t, mc.Chegada);
        Assert.Equal(1, a.MensageirosLivres);
        // b responde: agora a sabe quem é
        t.DarRecursos(b);
        Mensageiros.Treinar(t.M, b, 1);
        t.AvancarMin(2);
        var resp = Mensageiros.Enviar(t.M, b, "Podemos.", null, null, msg.Id);
        AvancarAte(t, t.M.Marchas[resp.MarchaId!.Value].Chegada);
        Assert.True(Conhecimento.Conhece(a, b.Id));
        Assert.True(Mensageiros.DestinatarioConhecido(t.M, msg));
    }

    [Fact]
    public void Mensageiro_nao_sofre_fauna()
    {
        var t = new MundoTeste(fauna: true);
        var a = t.NovoReino(); var b = t.NovoReino();
        a.MensageirosLivres = 1;
        var cb = t.M.Locais[b.CasteloId];
        Nevoas.RevelarArea(t.M, a.Id, cb.Hex, 0);
        var msg = Mensageiros.Enviar(t.M, a, "Paz.", null, cb.Id);
        var mc = t.M.Marchas[msg.MarchaId!.Value];
        Assert.DoesNotContain(t.M.Eventos.OfType<AtaqueFaunaEvento>(), e => e.MarchaId == mc.Id);   // nenhum ataque de fauna agendado
        AvancarAte(t, mc.Chegada);
        Assert.Equal(Mensageiros.EntregueE, msg.Estado);
    }

    // ---------------------------------------------------------------- troca direta

    [Fact]
    public void Troca_so_com_conhecidos_e_as_duas_cargas_viajam()
    {
        var t = new MundoTeste();
        var a = t.NovoReino(); var b = t.NovoReino();
        SemEscudo(a, b);
        t.DarRecursos(a, 5000); t.DarRecursos(b, 5000);
        t.M.Locais[b.CasteloId].Estoque.Somar("prata", 100);
        Assert.Contains("conhece", Assert.Throws<RegraException>(() => Comercio.ProporTroca(t.M, a, b.Id, R(("madeira", 500)), R(("prata", 40)), null)).Message);
        Conhecimento.Conhecer(t.M, a, b, "espionagem");
        Assert.Throws<RegraException>(() => Comercio.ProporTroca(t.M, a, b.Id, R(("madeira", 500)), R(("prata", 40)), new string('x', t.M.P.Mensageiro.RecadoProposta + 1)));
        var p = Comercio.ProporTroca(t.M, a, b.Id, R(("madeira", 500)), R(("prata", 40)), "pela estrada do rei");
        Assert.True(Conhecimento.Conhece(b, a.Id));   // a proposta revela quem propõe
        Assert.Throws<RegraException>(() => Comercio.AceitarTroca(t.M, a, p.Id));   // só o destinatário aceita
        Comercio.AceitarTroca(t.M, b, p.Id);
        Assert.Equal(Comercio.Aceita, p.Estado);
        var deA = Remessas.Do(t.M, Comercio.Troca, p.Id).Where(x => x.ReinoId == a.Id).ToList();
        var deB = Remessas.Do(t.M, Comercio.Troca, p.Id).Where(x => x.ReinoId == b.Id).ToList();
        Assert.NotEmpty(deA); Assert.NotEmpty(deB);
        Assert.Equal(500, deA.Sum(x => x.Carga.Qtd("madeira")), 3);
        Assert.Equal(40, deB.Sum(x => x.Carga.Qtd("prata")), 3);
        AvancarAte(t, deA.Concat(deB).Max(x => x.Chegada));
        Economia.Atualizar(t.M, a);
        Assert.Equal(40, Economia.TotalGuardado(t.M, a).Qtd("prata"), 3);
        Assert.Throws<RegraException>(() => Comercio.AceitarTroca(t.M, b, p.Id));   // não vale de novo
    }

    [Fact]
    public void Troca_sem_resposta_expira()
    {
        var t = new MundoTeste();
        var a = t.NovoReino(); var b = t.NovoReino();
        SemEscudo(a, b);
        Conhecer(t.M, a, b);
        t.DarRecursos(a, 5000);
        var p = Comercio.ProporTroca(t.M, a, b.Id, R(("madeira", 100)), R(("pedra", 100)), null);
        t.AvancarHoras(t.M.P.Social.PropostaH + 0.1);
        Assert.Null(t.M.Propostas.Obter(p.Id));
    }

    // ---------------------------------------------------------------- pacto

    [Fact]
    public void Pacto_comeca_quando_o_pagamento_chega_e_bloqueia_o_ataque()
    {
        var t = new MundoTeste();
        var a = t.NovoReino(); var b = t.NovoReino();
        SemEscudo(a, b);
        Conhecer(t.M, a, b);
        t.M.Locais[a.CasteloId].Estoque.Somar("prata", 100);
        Assert.Throws<RegraException>(() => Comercio.ProporPacto(t.M, a, b.Id, 0, null, null, null));
        Assert.Throws<RegraException>(() => Comercio.ProporPacto(t.M, a, b.Id, t.M.P.Pacto.DiasMax + 1, null, null, null));
        var p = Comercio.ProporPacto(t.M, a, b.Id, 3, "eu", R(("prata", 50)), "paz no vale");
        var pc = Comercio.AceitarPacto(t.M, b, p.Id);
        Assert.Equal(Comercio.Aguardando, pc.Estado);
        Assert.False(Comercio.PactoAtivo(t.M, a.Id, b.Id));
        var rems = Remessas.Do(t.M, Comercio.PactoT, pc.Id).ToList();
        AvancarAte(t, rems.Max(x => x.Chegada));
        Assert.Equal(Comercio.Ativo, pc.Estado);
        Assert.True(Comercio.PactoAtivo(t.M, a.Id, b.Id));
        Assert.Equal(pc.Inicio + 3 * T.Dia, pc.Fim);
        // ataque: o local espionado recusa no envio
        var ca = t.M.Locais[a.CasteloId]; var cb = t.M.Locais[b.CasteloId];
        ca.Guarnicao["cavalaria"] = 10;
        a.LocaisEspionados[cb.Id] = new LocalEspionado { DonoId = b.Id };
        Nevoas.RevelarArea(t.M, a.Id, cb.Hex, 0);
        Assert.Equal(SistemaSocial.MotivoPacto, Assert.Throws<RegraException>(() =>
            Exercitos.Enviar(t.M, a, ca.Id, G(("cavalaria", 5)), cb.Hex, OrdemAtacar.Id, false, CombateCenario.Plano())).Message);
        // sem saber de quem é, descobre ao chegar e volta sem combate
        var mina = t.M.LocaisDe(b.Id).First(l => l.Tipo == TipoLocal.Mina);
        Nevoas.RevelarArea(t.M, a.Id, mina.Hex, 0);
        var ex = Exercitos.Enviar(t.M, a, ca.Id, G(("cavalaria", 5)), mina.Hex, OrdemAtacar.Id, false, CombateCenario.Plano());
        AvancarAte(t, ex.Chegada);
        Assert.Empty(t.M.Batalhas);
        Assert.True(ex.Retornando);
        // explorador do outro não é capturado durante o pacto
        Assert.Contains(Capturas.Ignorar, f => f(t.M, a, b));
        // termina depois dos dias
        t.AvancarHoras(3 * 24 + 1);
        Assert.False(Comercio.PactoAtivo(t.M, a.Id, b.Id));
        Assert.Null(t.M.Pactos.Obter(pc.Id));
    }

    [Fact]
    public void Pacto_nao_comeca_se_o_pagamento_for_roubado()
    {
        var t = new MundoTeste();
        var a = t.NovoReino(); var b = t.NovoReino(); var c = t.NovoReino();
        SemEscudo(a, b, c);
        Conhecer(t.M, a, b);
        t.M.Locais[b.CasteloId].Estoque.Somar("prata", 100);
        var p = Comercio.ProporPacto(t.M, a, b.Id, 2, "outro", R(("prata", 30)), null);   // a cobra de b
        var pc = Comercio.AceitarPacto(t.M, b, p.Id);
        var rem = Remessas.Do(t.M, Comercio.PactoT, pc.Id).Single();
        Assert.Equal(b.Id, rem.ReinoId);
        var cc = t.M.Locais[c.CasteloId];
        cc.Guarnicao["lanceiro"] = 5;
        var lad = Exercitos.Enviar(t.M, c, cc.Id, G(("lanceiro", 5)), t.M.G.Vizinhos(cc.Hex).First(h => !t.M.Mapa.Rio[h] && t.M.LocalNoHex(h) == null), OrdemMover.Id);
        rem.AoSerVencida(t.M, lad);
        Assert.Null(t.M.Pactos.Obter(pc.Id));
        Assert.False(Comercio.PactoAtivo(t.M, a.Id, b.Id));
    }

    [Fact]
    public void Pacto_ate_tres_ativos_e_nao_se_cobra_de_novato()
    {
        var t = new MundoTeste();
        var rs = Enumerable.Range(0, 5).Select(_ => t.NovoReino()).ToList();
        var a = rs[0];
        foreach (var r in rs) Conhecer(t.M, a, r);
        SemEscudo(rs.ToArray());
        for (var i = 1; i <= t.M.P.Pacto.AtivosMax; i++)
            Comercio.AceitarPacto(t.M, rs[i], Comercio.ProporPacto(t.M, a, rs[i].Id, 1, null, null, null).Id);
        Assert.Equal(t.M.P.Pacto.AtivosMax, Comercio.PactosDe(t.M, a.Id).Count(p => p.Estado == Comercio.Ativo));
        Assert.Contains("máximo", Assert.Throws<RegraException>(() => Comercio.ProporPacto(t.M, a, rs[4].Id, 1, null, null, null)).Message);
        Assert.Throws<RegraException>(() => Comercio.ProporPacto(t.M, a, rs[1].Id, 1, null, null, null));   // já há pacto
        // ninguém cobra pacto de reino sob escudo
        var novato = t.NovoReino();
        var b = rs[4];
        Conhecer(t.M, b, novato);
        t.M.Locais[novato.CasteloId].Estoque.Somar("prata", 100);
        // a proposta não revela o escudo a quem propõe; o novato é que não consegue aceitar
        var cobra = Comercio.ProporPacto(t.M, b, novato.Id, 2, "outro", R(("prata", 10)), null);
        Assert.Contains("escudo", Assert.Throws<RegraException>(() => Comercio.AceitarPacto(t.M, novato, cobra.Id)).Message);
        Assert.Empty(Comercio.PactosDe(t.M, novato.Id));
        Comercio.Recusar(t.M, novato, cobra.Id);
        Comercio.ProporPacto(t.M, b, novato.Id, 2, null, null, null);   // sem pagamento, pode
    }

    [Fact]
    public void Limite_do_novato_nao_revela_o_escudo_a_quem_nao_e_aliado()
    {
        var t = new MundoTeste();
        var veterano = t.NovoReino(); var novato = t.NovoReino();
        veterano.EscudoAte = 0;
        Conhecer(t.M, veterano, novato);
        t.DarRecursos(veterano, 50000); t.DarRecursos(novato, 50000);
        var lim = t.M.P.Comercio.NovatoDia;
        // propor uma troca desequilibrada a quem não é aliado não diz nada sobre o escudo dele
        var p = Comercio.ProporTroca(t.M, veterano, novato.Id, R(("madeira", lim * 2)), R(("pedra", 10)), null);
        // o novato, ao aceitar, vê o próprio limite
        Assert.Contains("escudo de novato", Assert.Throws<RegraException>(() => Comercio.AceitarTroca(t.M, novato, p.Id)).Message);
        Assert.Equal(Comercio.Aberta, p.Estado);
        // o novato propõe acima do próprio limite: é avisado na hora (é o escudo dele)
        Assert.Contains("escudo de novato", Assert.Throws<RegraException>(() => Comercio.ProporTroca(t.M, novato, veterano.Id, R(("pedra", 10)), R(("madeira", lim * 2)), null)).Message);
        // proposta do novato dentro do limite, que deixa de caber antes do aceite: quem aceita não fica sabendo do escudo
        var q = Comercio.ProporTroca(t.M, novato, veterano.Id, R(("pedra", 10)), R(("madeira", lim * 0.8)), null);
        novato.Novato.Add(new RegistroNovato { Quando = t.M.Agora, Valor = lim * 0.5 });
        var e = Assert.Throws<RegraException>(() => Comercio.AceitarTroca(t.M, veterano, q.Id));
        Assert.DoesNotContain("escudo", e.Message);
        Assert.DoesNotContain("novato", e.Message);
        Assert.Equal(Comercio.Cancelada, q.Estado);
    }

    // ---------------------------------------------------------------- limite do novato

    [Fact]
    public void Novato_tem_limite_diario_de_diferenca_de_valor()
    {
        var t = new MundoTeste();
        var veterano = t.NovoReino(); var novato = t.NovoReino();
        veterano.EscudoAte = 0;
        Assert.True(novato.SobEscudo(t.M.Agora));
        Alianca(t, veterano, novato);
        t.DarRecursos(veterano, 50000);
        var lim = t.M.P.Comercio.NovatoDia;
        // ajuda acima do limite: recusada já no pedido
        Assert.Contains("escudo de novato", Assert.Throws<RegraException>(() => Comercio.PedirRecursos(t.M, novato, veterano.Id, R(("madeira", lim + 1)), null, null)).Message);
        var p = Comercio.PedirRecursos(t.M, novato, veterano.Id, R(("madeira", lim * 0.75)), null, null);
        Comercio.AceitarPedido(t.M, veterano, p.Id);
        Assert.Equal(lim * 0.25, Comercio.NovatoRestante(t.M, novato), 3);
        // troca equilibrada não conta; desequilibrada além do que resta, não
        t.M.Locais[novato.CasteloId].Estoque.Somar("pedra", 1000);
        var eq = Comercio.ProporTroca(t.M, veterano, novato.Id, R(("madeira", 300)), R(("pedra", 300)), null);
        Comercio.AceitarTroca(t.M, novato, eq.Id);
        Assert.Equal(lim * 0.25, Comercio.NovatoRestante(t.M, novato), 3);
        Assert.Throws<RegraException>(() => Comercio.ProporTroca(t.M, veterano, novato.Id, R(("madeira", lim)), R(("pedra", 10)), null));
        // no dia seguinte, o limite volta
        t.AvancarHoras(t.M.P.Social.NovatoJanelaH + 0.1);
        Assert.Equal(lim, Comercio.NovatoRestante(t.M, novato), 3);
        // fora do escudo, não há limite
        novato.EscudoAte = 0;
        Assert.True(double.IsPositiveInfinity(Comercio.NovatoRestante(t.M, novato)));
    }

    // ---------------------------------------------------------------- resgate

    [Fact]
    public void Resgate_pago_viaja_e_liberta_o_explorador()
    {
        var t = new MundoTeste();
        var dono = t.NovoReino(); var captor = t.NovoReino();
        SemEscudo(dono, captor);
        var cc = t.M.Locais[captor.CasteloId];
        var p = t.M.Prisioneiros.Adicionar(new Prisioneiro { CaptorId = captor.Id, DonoId = dono.Id, TipoExp = "pe", Hex = cc.Hex, Ate = t.M.Agora + T.DeHoras(t.M.P.ResgateH) });
        Assert.Throws<RegraException>(() => Comercio.PagarResgate(t.M, dono, p.Id));   // ninguém pediu
        Capturas.Decidir(t.M, captor, p.Id, "resgate", R(("comida", 100)));
        Comercio.PagarResgate(t.M, dono, p.Id);
        Assert.Throws<RegraException>(() => Comercio.PagarResgate(t.M, dono, p.Id));   // já está a caminho
        var rems = Remessas.Do(t.M, Comercio.Resgate, p.Id).ToList();
        Assert.NotEmpty(rems);
        AvancarAte(t, rems.Max(x => x.Chegada));
        Assert.Null(t.M.Prisioneiros.Obter(p.Id));
        Assert.Single(Exploradores.De(t.M, dono.Id));   // solto, volta para casa
    }

    // ---------------------------------------------------------------- bandeiras

    [Fact]
    public void Bandeiras_vinte_ativas_sessenta_caracteres_e_em_lugar_explorado()
    {
        var t = new MundoTeste();
        var a = t.NovoReino();
        var c = t.M.Locais[a.CasteloId];
        var area = t.M.G.Area(c.Hex, 3).ToList();
        Assert.Throws<RegraException>(() => Bandeiras.Colocar(t.M, a, area[0], "aviso", "ok"));   // curto demais
        Assert.Throws<RegraException>(() => Bandeiras.Colocar(t.M, a, area[0], "aviso", new string('x', t.M.P.Social.Bandeiras.Caracteres + 1)));
        Assert.Throws<RegraException>(() => Bandeiras.Colocar(t.M, a, area[0], "bobagem", "Passagem livre"));
        var longe = Enumerable.Range(0, t.M.G.Total).First(h => !Nevoas.Explorado(t.M, a.Id, h));
        Assert.Throws<RegraException>(() => Bandeiras.Colocar(t.M, a, longe, "aviso", "Passagem livre"));
        for (var i = 0; i < t.M.P.Social.Bandeiras.Ativas; i++) Bandeiras.Colocar(t.M, a, area[i], "reivindicacao", "Terra de " + a.Nome);
        Assert.Throws<RegraException>(() => Bandeiras.Colocar(t.M, a, area[0], "aviso", "Outra aqui"));
        Assert.Contains("remova", Assert.Throws<RegraException>(() => Bandeiras.Colocar(t.M, a, area[^1], "aviso", "Mais uma")).Message);
        Bandeiras.Remover(t.M, a, Bandeiras.De(t.M, a.Id).First().Id);
        Bandeiras.Colocar(t.M, a, area[^1], "aviso", "Mais uma");
        Assert.Equal(t.M.P.Social.Bandeiras.Ativas, Bandeiras.De(t.M, a.Id).Count());
    }

    [Fact]
    public void Derrubar_bandeira_avisa_o_dono_sem_dizer_quem_e_mostra_o_autor()
    {
        var t = new MundoTeste();
        var a = t.NovoReino(); var b = t.NovoReino();
        var cb = t.M.Locais[b.CasteloId];
        var h = t.M.G.Vizinhos(cb.Hex).First(x => !t.M.Mapa.Rio[x] && t.M.LocalNoHex(x) == null);
        Assert.Throws<RegraException>(() => Bandeiras.Colocar(t.M, a, h, "ameaca", "Esta estrada é nossa"));   // a ainda não explorou ali
        Nevoas.RevelarArea(t.M, a.Id, h, 0);
        var band = Bandeiras.Colocar(t.M, a, h, "ameaca", "Esta estrada é nossa");
        // b vê a bandeira: passa a conhecer a (bandeiras mostram quem colocou)
        t.AvancarMin(1);
        Nevoas.VisiveisAgora(t.M, b.Id);
        Assert.Contains(Fotos.De(t.M, b.Id).Objetos.GetValueOrDefault(h) ?? [], o => o["tipo"]?.GetValue<string>() == "bandeira");
        Assert.True(Conhecimento.Conhece(b, a.Id));
        // b derruba sem estandarte: a é avisado sem saber quem foi
        cb.Guarnicao["lanceiro"] = 3;
        var ex = Exercitos.Enviar(t.M, b, cb.Id, G(("lanceiro", 1)), h, OrdemDerrubarBandeira.Id, false, new JsonObject { ["bandeira"] = band.Id });
        Assert.Throws<RegraException>(() => Exercitos.Enviar(t.M, a, t.M.Locais[a.CasteloId].Id, G(("lanceiro", 1)), h, OrdemDerrubarBandeira.Id));   // a própria não
        AvancarAte(t, ex.Chegada);
        Assert.Null(t.M.Bandeiras.Obter(band.Id));
        var n = t.M.Notificacoes.Where(x => x.ReinoId == a.Id && x.Titulo == "Bandeira derrubada").Single();
        Assert.DoesNotContain(b.Nome, n.Texto);
        Assert.False(Conhecimento.Conhece(a, b.Id));
        // com estandarte: o dono sabe quem foi
        var band2 = Bandeiras.Colocar(t.M, a, h, "ameaca", "De novo aqui");
        AvancarAte(t, ex.Chegada);   // as tropas voltaram
        var ex2 = Exercitos.Enviar(t.M, b, cb.Id, G(("lanceiro", 1)), h, OrdemDerrubarBandeira.Id, false, new JsonObject { ["estandarte"] = true });
        AvancarAte(t, ex2.Chegada);
        Assert.Null(t.M.Bandeiras.Obter(band2.Id));
        Assert.Contains(t.M.Notificacoes, x => x.ReinoId == a.Id && x.Titulo == "Bandeira derrubada" && x.Texto!.Contains(b.Nome));
        Assert.True(Conhecimento.Conhece(a, b.Id));
    }

    // ---------------------------------------------------------------- persistência

    [Fact]
    public void Tudo_do_social_e_gravado_com_Sujar_e_volta_do_banco()
    {
        var dir = Path.Combine(Path.GetTempPath(), "rp-social-" + Guid.NewGuid().ToString("N"));
        var arq = Path.Combine(dir, "t.db");
        try
        {
            var t = new MundoTeste();
            var a = t.NovoReino(); var b = t.NovoReino(); var c = t.NovoReino();
            SemEscudo(a, b, c);
            t.DarRecursos(a, 5000); t.DarRecursos(b, 5000);
            var al = Alianca(t, a, b);
            var ca = t.M.Locais[a.CasteloId]; ca.Guarnicao["lanceiro"] = 4;
            var ex = Exercitos.Enviar(t.M, a, ca.Id, G(("lanceiro", 4)), t.M.Locais[b.CasteloId].Hex, OrdemReforcar.Id);
            AvancarAte(t, ex.Chegada);
            Aliancas.Falar(t.M, a, "Olá");
            Conhecer(t.M, a, c);
            Comercio.ProporTroca(t.M, a, c.Id, R(("madeira", 100)), R(("pedra", 100)), null);
            Comercio.AceitarPacto(t.M, c, Comercio.ProporPacto(t.M, a, c.Id, 2, "eu", R(("madeira", 50)), null).Id);
            Comercio.AceitarPedido(t.M, b, Comercio.PedirRecursos(t.M, a, b.Id, R(("pedra", 100)), null, null).Id);
            a.MensageirosLivres = 1;
            Mensageiros.Enviar(t.M, a, "Oi", c.Id, null);
            Bandeiras.Colocar(t.M, a, t.M.Locais[a.CasteloId].Hex, "aviso", "Terra nossa");
            Directory.CreateDirectory(dir);
            using (var db = new ReinoDePedra.Jogo.Persistencia.Banco(arq))
            {
                db.Salvar(t.M);
                Assert.Equal(0, db.SalvarEsquecidos(t.M));
            }
            using var db2 = new ReinoDePedra.Jogo.Persistencia.Banco(arq);
            var m2 = new Mundo(ReinoDePedra.Jogo.Config.Balanceamento.Padrao, t.Relogio);
            db2.Carregar(m2);
            m2.PrepararMapa();
            Assert.Equal(al.Membros.Count, m2.Aliancas[al.Id].Membros.Count);
            Assert.Single(m2.Aliancas[al.Id].Conversa);
            Assert.Equal(t.M.Propostas.Count, m2.Propostas.Count);
            Assert.Single(m2.Pactos);
            Assert.Single(m2.Mensagens);
            Assert.Single(m2.Bandeiras);
            Assert.Single(m2.Locais[b.CasteloId].ReforcosAliados);
            Assert.Equal(al.Id, m2.Reinos[b.Id].AliancaId);
            Assert.Contains(m2.Marchas, x => x is Remessa);
            Assert.Contains(m2.Marchas, x => x is Mensageiro);
        }
        finally { try { Directory.Delete(dir, true); } catch { } }
    }

    // ---------------------------------------------------------------- sistemas aos poucos

    [Fact]
    public void Conhecer_o_primeiro_reino_apresenta_aliancas_e_comercio()
    {
        var t = new MundoTeste();
        var a = t.NovoReino(); var b = t.NovoReino();
        Assert.DoesNotContain("alianca", a.SistemasVistos);
        Assert.False(Sistemas.Estado(a)["comercio"]);
        Conhecimento.Conhecer(t.M, a, b, "espionagem");
        Assert.Contains("alianca", a.SistemasVistos);
        Assert.True(Sistemas.Estado(a)["comercio"]);
        Assert.Contains(t.M.Notificacoes, n => n.ReinoId == a.Id && n.Titulo == "Novo: Comércio e diplomacia");
        Assert.False(Sistemas.Revelar(t.M, a, "comercio"));   // uma vez só
    }
}
