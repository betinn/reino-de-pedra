using System.Text.Json.Nodes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Testes;

/// <summary>Explorador capturado: negociação pelo dono e resgate à força. Força inimiga antes da batalha (reconhecer e prévia).</summary>
public class ResgateReconhecimentoTestes
{
    public ResgateReconhecimentoTestes() => AjustesTeste.Garantir();

    private static Dictionary<string, int> G(params (string k, int n)[] x) => x.ToDictionary(p => p.k, p => p.n);
    private static Dictionary<string, double> R(params (string k, double n)[] x) => x.ToDictionary(p => p.k, p => p.n);

    private static Prisioneiro Preso(CombateCenario s, Reino dono, Local cela) =>
        s.M.Prisioneiros.Adicionar(new Prisioneiro
        {
            CaptorId = cela.ReinoId, DonoId = dono.Id, TipoExp = "pe", Hex = cela.Hex, LocalId = cela.Id, Nome = "Fulano",
            Ate = s.M.Agora + T.DeHoras(s.M.P.ResgateH),
        });

    // ---------------------------------------------------------------- negociar

    [Fact]
    public void Dono_oferece_captor_recusa_contrapropoe_e_aceita_a_nova_oferta()
    {
        var s = new CombateCenario();
        var cela = s.Alvo(TipoLocal.Castelo, G(("lanceiro", 2)), 5);
        var p = Preso(s, s.Atk, cela);
        s.T.DarRecursos(s.Atk, 500, "comida");
        Assert.Throws<RegraException>(() => Comercio.OferecerResgate(s.M, s.Def, p.Id, R(("comida", 50))));   // só o dono oferece
        Assert.Throws<RegraException>(() => Comercio.OferecerResgate(s.M, s.Atk, p.Id, R(("comida", 1e6))));  // precisa ter o que oferece

        // oferecer não revela quem capturou; recusar também não
        Comercio.OferecerResgate(s.M, s.Atk, p.Id, R(("comida", 50)));
        Assert.Equal(50, p.Oferta.Qtd("comida"));
        Assert.Contains(s.M.Notificacoes, n => n.ReinoId == s.Def.Id && n.Titulo == "Oferta pelo prisioneiro");
        Capturas.Decidir(s.M, s.Def, p.Id, "recusar");
        Assert.Empty(p.Oferta);
        Assert.False(Conhecimento.Conhece(s.Atk, s.Def.Id));
        var recusa = Assert.Single(s.M.Notificacoes, n => n.ReinoId == s.Atk.Id && n.Titulo == "Oferta recusada");
        Assert.DoesNotContain(s.Def.Nome, recusa.Texto);

        // contraproposta do captor: o pedido revela quem pede e apaga a oferta
        Comercio.OferecerResgate(s.M, s.Atk, p.Id, R(("comida", 50)));
        Capturas.Decidir(s.M, s.Def, p.Id, "resgate", R(("comida", 120)));
        Assert.Equal(Capturas.ResgatePedido, p.Estado);
        Assert.Empty(p.Oferta);
        Assert.True(Conhecimento.Conhece(s.Atk, s.Def.Id));

        // o dono contrapropõe de novo; o captor aceita: o pagamento sai na hora e, ao chegar, o explorador é solto
        Comercio.OferecerResgate(s.M, s.Atk, p.Id, R(("comida", 80)));
        Capturas.Decidir(s.M, s.Def, p.Id, "aceitar");
        Assert.Equal(80, p.Resgate.Qtd("comida"));
        var rems = Remessas.Do(s.M, Comercio.Resgate, p.Id).ToList();
        Assert.NotEmpty(rems);
        Assert.Throws<RegraException>(() => Comercio.OferecerResgate(s.M, s.Atk, p.Id, R(("comida", 10))));   // já está a caminho
        s.AvancarAte(rems.Max(x => x.Chegada));
        Assert.Null(s.M.Prisioneiros.Obter(p.Id));
        var e = Assert.Single(Exploradores.De(s.M, s.Atk.Id));
        Assert.Equal(cela.Hex, e.Caminho[0]);   // sai do local onde estava preso
    }

    [Fact]
    public void IA_aceita_oferta_que_paga_o_explorador_e_recusa_a_menor()
    {
        var s = new CombateCenario();
        var cela = s.Alvo(TipoLocal.Castelo, G(("lanceiro", 2)), 5);
        s.T.DarRecursos(s.Atk, 1e5, "comida", "madeira", "ferro", "pedra", "prata", "ouro");
        var custo = Remessas.Valor(s.M, s.M.P.Exploradores["pe"].Custo);
        var p1 = Preso(s, s.Atk, cela);
        Capturas.Decidir(s.M, s.Def, p1.Id, "resgate", R(("prata", 500)));   // pedido alto; o dono contrapropõe
        Comercio.OferecerResgate(s.M, s.Atk, p1.Id, R(("comida", Math.Max(1, Math.Floor(custo / 2 / s.M.P.Valor["comida"])))));
        ReinoDePedra.Jogo.IA.Governo.Prisioneiros(s.M, s.Def);
        Assert.Empty(p1.Oferta);                                   // recusada: o pedido de antes continua
        Assert.Equal(Capturas.ResgatePedido, p1.Estado);
        Assert.Empty(Remessas.Do(s.M, Comercio.Resgate, p1.Id));
        Comercio.OferecerResgate(s.M, s.Atk, p1.Id, R(("comida", Math.Ceiling(custo / s.M.P.Valor["comida"]))));
        ReinoDePedra.Jogo.IA.Governo.Prisioneiros(s.M, s.Def);
        Assert.NotEmpty(Remessas.Do(s.M, Comercio.Resgate, p1.Id));   // aceita: o pagamento saiu
    }

    // ---------------------------------------------------------------- resgate à força

    [Fact]
    public void Vencer_no_local_liberta_os_proprios_presos_e_tomar_o_local_solta_todos()
    {
        var s = new CombateCenario();
        var outro = s.T.NovoReino();
        var cela = s.Alvo(TipoLocal.Mina, G(("lanceiro", 1)), 0);
        var meu = Preso(s, s.Atk, cela);
        var deOutro = Preso(s, outro, cela);
        // saque vitorioso: só os exploradores do atacante saem
        var ex = s.Atacar(cela, G(("lanceiro", 20)));
        var b = s.Chegar(ex);
        s.Terminar(b);
        Assert.Equal("vitoria", b.Resultado);
        Assert.Null(s.M.Prisioneiros.Obter(meu.Id));
        Assert.NotNull(s.M.Prisioneiros.Obter(deOutro.Id));
        Assert.Contains(Exploradores.De(s.M, s.Atk.Id), e => e.PessoaId == meu.PessoaId);
        Assert.Contains(s.M.Notificacoes, n => n.ReinoId == s.Def.Id && n.Titulo == "Prisioneiro resgatado");
        // ocupação: o local deixa de ser do captor e todos os presos dali são soltos
        s.AvancarAte(s.M.Agora + T.Hora);
        var ex2 = s.Atacar(cela, G(("lanceiro", 20)), CombateCenario.Plano("ocupacao"));
        s.Terminar(s.Chegar(ex2));
        Assert.Equal(s.Atk.Id, cela.ReinoId);
        Assert.Null(s.M.Prisioneiros.Obter(deOutro.Id));
        Assert.Single(Exploradores.De(s.M, outro.Id));
    }

    [Fact]
    public void Derrota_no_local_nao_liberta()
    {
        var s = new CombateCenario();
        var cela = s.Alvo(TipoLocal.Mina, G(("lanceiro", 30)), 50);
        var p = Preso(s, s.Atk, cela);
        var b = s.Chegar(s.Atacar(cela, G(("lanceiro", 3))));
        s.Terminar(b);
        Assert.NotEqual("vitoria", b.Resultado);
        Assert.NotNull(s.M.Prisioneiros.Obter(p.Id));
    }

    [Fact]
    public void Espionagem_mostra_os_presos_do_local_e_revela_onde_e_quem()
    {
        var s = new CombateCenario();
        var cela = s.Alvo(TipoLocal.Mina, G(("lanceiro", 2)), 5);
        var p = Preso(s, s.Atk, cela);
        var outro = s.T.NovoReino();
        Preso(s, outro, cela);
        Assert.False(p.LocalConhecido);
        var rel = Espionagem.Relatar(s.M, s.Atk, s.Def, cela, 0, 0, false);
        var presos = Assert.IsType<JsonArray>(rel.Dados["presos"]);
        Assert.Single(presos);   // só os do reino que espiona aparecem com nome
        Assert.Contains(rel.Dados["linhas"]!.AsArray(), l => l!["rotulo"]!.GetValue<string>() == "Presos" && l["valor"]!.GetValue<string>().Contains("1 de outro reino"));
        Assert.True(p.LocalConhecido);
        Assert.True(p.CaptorRevelado);
    }

    // ---------------------------------------------------------------- força inimiga antes da batalha

    [Fact]
    public void Reconhecer_para_a_vista_do_alvo_e_relata_a_forca_sem_atacar()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 5), ("arqueiro", 2)), 10, dist: 9);
        s.Guarnecer(s.CasteloAtk, G(("lanceiro", 12)));
        s.Conhecer(s.Atk, alvo);
        var ex = Exercitos.Enviar(s.M, s.Atk, s.CasteloAtk.Id, G(("lanceiro", 12)), alvo.Hex, OrdemReconhecer.Id);
        var d = Reconhecimentos.Distancia(s.M, ex.Tropas);
        Assert.InRange(s.M.G.Distancia(ex.Destino, alvo.Hex), 1, d);
        s.AvancarAte(ex.Chegada);
        Assert.True(ex.Parado);
        Assert.Empty(s.M.Batalhas);
        var rel = Assert.Single(s.M.Relatorios, r => r.ReinoId == s.Atk.Id && r.Tipo == "reconhecimento");
        var est = rel.Dados["estimativa"]!.AsObject();
        Assert.Equal("vista", est["fonte"]!.GetValue<string>());
        Assert.Equal(7, est["tropas"]!.GetValue<int>());
        Assert.Equal(10, est["civis"]!.GetValue<int>());
        Assert.Null(est["bonusDefesa"]);   // sem espionagem, os bônus de defesa não são conhecidos
        var esperado = s.M.F.Batalha(ex.Tropas, alvo.Guarnicao, new ExtraDefesa { Pop = 10 }, s.M.P.Combate.Taticas[s.M.P.Combate.TaticaPadrao]);
        Assert.Equal(Math.Round(esperado.D), est["defesa"]!.GetValue<double>());
        Assert.Equal(esperado.VenceA, est["vence"]!.GetValue<bool>());
        Assert.Equal(rel.Dados["marchaId"]!.GetValue<long>(), ex.Id);
        // o relatório não revela o dono
        Assert.DoesNotContain(s.Def.Nome, rel.Dados.ToJsonString());
        // dali, o ataque de tropa em campo segue normalmente
        Exercitos.DarOrdem(s.M, s.Atk, ex.Id, OrdemAtacar.Id, alvo.Hex, null, CombateCenario.Plano());
        s.AvancarAte(ex.Chegada);
        Assert.Single(s.M.Batalhas);
    }

    [Fact]
    public void Estimativa_so_com_vista_ou_espionagem_e_a_espionagem_traz_o_bonus()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 4)), 6, dist: 14);
        s.Conhecer(s.Atk, alvo);
        Assert.DoesNotContain(alvo.Hex, Nevoas.VisiveisAgora(s.M, s.Atk.Id));
        var grupo = G(("lanceiro", 10));
        var nada = Reconhecimentos.Estimar(s.M, s.Atk, alvo, grupo, 0, null);
        Assert.Equal("nenhuma", nada["fonte"]!.GetValue<string>());
        Assert.Null(nada["defesa"]);
        AjustesTeste.De(s.M).BonusD[alvo.Id] = 0.2;
        Espionagem.Relatar(s.M, s.Atk, s.Def, alvo, 0, 0, false);
        alvo.Guarnicao["lanceiro"] = 40;   // mudou depois da espionagem: a estimativa fora da vista não sabe
        var esp = Reconhecimentos.Estimar(s.M, s.Atk, alvo, grupo, 0, null);
        Assert.Equal("espionagem", esp["fonte"]!.GetValue<string>());
        Assert.Equal(4, esp["tropas"]!.GetValue<int>());
        Assert.Equal(0.2, esp["bonusDefesa"]!.GetValue<double>(), 3);
        Assert.NotNull(esp["espionadoEm"]);
    }

    [Fact]
    public void Reconhecer_ja_a_vista_recusa_sem_tirar_as_tropas()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 1)), 0, dist: 2);
        s.Guarnecer(s.CasteloAtk, G(("lanceiro", 3)));
        s.Conhecer(s.Atk, alvo);
        Assert.Throws<RegraException>(() => Exercitos.Enviar(s.M, s.Atk, s.CasteloAtk.Id, G(("lanceiro", 1)), alvo.Hex, OrdemReconhecer.Id));
        Assert.Equal(3, s.CasteloAtk.Guarnicao["lanceiro"]);
    }
}
