using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.IA;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Testes;

/// <summary>Guerra (escudo e porte), regência, IA comerciante e horas de sessão.</summary>
public class IACondutaTestes
{
    public IACondutaTestes() => AjustesTeste.Garantir();

    private static Dictionary<string, double> R(params (string k, double n)[] g) => g.ToDictionary(x => x.k, x => x.n);

    // ---------------------------------------------------------------- guerra: escudo e porte

    private static (MundoTeste t, Reino ia, Reino alvo, Local local) CenarioAtaque()
    {
        var t = MundoIA.Novo(criar: false);
        var alvo = MundoIA.Jogador(t, 0);                 // vaga 0
        var ia = MundoIA.Criar(t, "saqueador", vaga: 1);  // a vizinha
        var castelo = t.M.Locais[ia.CasteloId];
        castelo.Nivel = 4;
        GT.Devolver(t.M, castelo, new Dictionary<string, int> { ["lanceiro"] = 200 });
        var local = t.M.LocaisDe(alvo.Id).First(l => l.Tipo == TipoLocal.Mina);
        return (t, ia, alvo, local);
    }

    private static void Espionado(MundoTeste t, Reino ia, Local l, int nivel, int tropas) =>
        ia.LocaisEspionados[l.Id] = new LocalEspionado { DonoId = l.ReinoId, Nivel = nivel, Quando = t.M.Agora, Tropas = tropas, Torres = 0 };

    private static Exercito? Ataque(MundoTeste t, Reino ia) => Exercitos.De(t.M, ia.Id).FirstOrDefault(e => e.Ordem == OrdemAtacar.Id);

    [Fact]
    public void IA_nao_ataca_reino_sob_escudo()
    {
        var (t, ia, alvo, local) = CenarioAtaque();
        Assert.True(alvo.SobEscudo(t.M.Agora));
        Espionado(t, ia, local, 4, 5);
        Governo.Atacar(t.M, ia, t.M.Locais[ia.CasteloId]);
        Assert.Null(Ataque(t, ia));
    }

    [Fact]
    public void IA_nao_ataca_alvo_muito_menor_nem_bem_defendido_e_ataca_o_que_cabe()
    {
        var (t, ia, alvo, local) = CenarioAtaque();
        alvo.EscudoAte = 0;
        var castelo = t.M.Locais[ia.CasteloId];
        // muito menor: o maior nível que a IA conhece do dono fica abaixo de P.ia.ataque.porte do castelo dela
        Espionado(t, ia, local, 1, 0);
        Assert.True(1 < castelo.Nivel * t.M.P.IA.Ataque.Porte);
        Governo.Atacar(t.M, ia, castelo);
        Assert.Null(Ataque(t, ia));
        // bem defendido: sem a folga de força de P.ia.ataque.forca
        Espionado(t, ia, local, 4, 400);
        Governo.Atacar(t.M, ia, castelo);
        Assert.Null(Ataque(t, ia));
        // do porte dela e pouco defendido: saque com a tática do perfil, ficando a reserva no castelo
        Espionado(t, ia, local, 4, 5);
        Governo.Atacar(t.M, ia, castelo);
        var ex = Ataque(t, ia);
        Assert.NotNull(ex);
        Assert.Equal(local.Id, ex!.AlvoLocalId);
        var plano = PlanoAtaque.Ler(ex.Dados);
        Assert.Equal(Ataques.Saque, plano.Tipo);
        Assert.Equal(t.M.P.IA.Ataque.Tatica, plano.Tatica);
        Assert.False(ex.Estandarte);
        Assert.True(GT.Livres(t.M, castelo, "lanceiro") >= t.M.P.IA.Ataque.Reserva);
        // um ataque por vez
        Governo.Atacar(t.M, ia, castelo);
        Assert.Single(Exercitos.De(t.M, ia.Id), e => e.Ordem == OrdemAtacar.Id);
    }

    [Fact]
    public void IA_so_ataca_o_que_espionou_ha_pouco()
    {
        var (t, ia, alvo, local) = CenarioAtaque();
        alvo.EscudoAte = 0;
        Espionado(t, ia, local, 4, 5);
        ia.LocaisEspionados[local.Id].Quando = t.M.Agora - T.DeHoras(t.M.P.IA.Ataque.EspionagemH) - 1;
        Governo.Atacar(t.M, ia, t.M.Locais[ia.CasteloId]);
        Assert.Null(Ataque(t, ia));
    }

    // ---------------------------------------------------------------- regência

    [Fact]
    public void Regencia_comeca_em_48_h_sem_entrar_governa_sem_expandir_e_termina_quando_o_jogador_volta()
    {
        var t = MundoIA.Novo(criar: false);
        var j = MundoIA.Jogador(t, 0); var k = MundoIA.Jogador(t, 1);
        var a = Aliancas.Criar(t.M, j, "Liga do Norte");
        Conhecimento.Conhecer(t.M, j, k, "teste"); Conhecimento.Conhecer(t.M, k, j, "teste");
        Aliancas.Convidar(t.M, j, k.Id); Aliancas.AceitarConvite(t.M, k, a.Id);
        k.UltimoAcesso = t.M.Agora + T.DeHoras(30);   // k entra mais tarde: o evento confere de novo e reagenda
        t.AvancarHoras(t.M.P.RegenciaH - 1);
        Assert.False(j.EmRegencia);
        t.AvancarHoras(2);
        AjustesTeste.FalharSeErro();
        Assert.True(j.EmRegencia);
        Assert.False(k.EmRegencia);
        Assert.Equal(Aliancas.Lider, a.Membro(k.Id)!.Cargo);   // a liderança passou
        var fundadosAntes = j.Fundados;
        t.AvancarHoras(48);
        AjustesTeste.FalharSeErro();
        Assert.True(k.EmRegencia);   // 48 h depois do último acesso dele
        Assert.Equal(fundadosAntes, j.Fundados);
        Assert.DoesNotContain(j.Fila(Obras.Fila).Itens, i => i.Tipo == ObraFundar.Id);
        Assert.DoesNotContain(Exercitos.De(t.M, j.Id), e => e.Ordem is OrdemAtacar.Id or OrdemOcupar.Id);
        Assert.NotEmpty(j.Regencia!.Acoes);   // produziu: obras e recrutamento
        // volta: retoma o controle, a sessão da IA some e o relatório fica
        t.AvancarHoras(1);
        j.UltimoAcesso = t.M.Agora;
        Assert.True(Regencia.AoEntrar(t.M, j));
        Assert.False(j.EmRegencia);
        Assert.Equal(t.M.Agora, j.Regencia!.TerminouEm);
        Assert.Null(j.SessaoIAEventoId);
        Assert.IsType<VerificarRegenciaEvento>(t.M.Eventos.Obter(j.RegenciaEventoId!.Value));
        Assert.False(Regencia.AoEntrar(t.M, j));
    }

    [Fact]
    public void Regencia_e_conservadora_e_nao_rende_mais_que_jogar()
    {
        // a regência recruta com a conduta conservadora: menos tropas que a IA média no mesmo tempo
        var t = MundoIA.Novo(criar: false);
        var j = MundoIA.Jogador(t, 0);
        var ia = MundoIA.Criar(t, "defensivo");
        Regencia.Comecar(t.M, j);
        t.AvancarHoras(72);
        AjustesTeste.FalharSeErro();
        Assert.True(Economia.Tropas(t.M, j) < Economia.Tropas(t.M, ia));
        Assert.True(t.M.P.IA.Regencia.Militar < t.M.P.IA.Habilidades["medio"].Militar);
    }

    // ---------------------------------------------------------------- IA comerciante

    private static (MundoTeste t, Reino ia, Reino j) CenarioComercio(string perfil)
    {
        var t = MundoIA.Novo(criar: false);
        var j = MundoIA.Jogador(t, 0);
        var ia = MundoIA.Criar(t, perfil);
        Conhecimento.Conhecer(t.M, j, ia, "teste"); Conhecimento.Conhecer(t.M, ia, j, "teste");
        t.DarRecursos(j, 2000, "prata", "comida");
        return (t, ia, j);
    }

    private static string Troca(MundoTeste t, Reino ia, Reino j, Dictionary<string, double> da, Dictionary<string, double> quer)
    {
        var p = Comercio.ProporTroca(t.M, j, ia.Id, da, quer, null);
        Comerciante.Responder(t.M, ia, MundoIA.Conduta(t, ia));
        return p.Estado;
    }

    [Fact]
    public void IA_comerciante_vende_a_115_e_compra_a_85_por_cento_do_valor()
    {
        var (t, ia, j) = CenarioComercio("comerciante");
        t.DarRecursos(ia, 5000, "comida", "prata");
        var vComida = t.M.P.Valor["comida"]; var vPrata = t.M.P.Valor["prata"]; var mg = t.M.P.Comercio.MargemIA;
        // vende comida: 100 prata compram até 100 × 10 / 1,15 de comida
        var maxComida = 100 * vPrata / ((1 + mg) * vComida);
        Assert.Equal(Comercio.Aceita, Troca(t, ia, j, R(("prata", 100)), R(("comida", Math.Floor(maxComida)))));
        Assert.Equal(Comercio.Recusada, Troca(t, ia, j, R(("prata", 100)), R(("comida", Math.Floor(maxComida) + 2))));
        // compra comida: 1000 de comida valem até 1000 × 0,85 / 10 de prata
        var maxPrata = 1000 * vComida * (1 - mg) / vPrata;
        Assert.Equal(Comercio.Aceita, Troca(t, ia, j, R(("comida", 1000)), R(("prata", Math.Floor(maxPrata)))));
        Assert.Equal(Comercio.Recusada, Troca(t, ia, j, R(("comida", 1000)), R(("prata", Math.Floor(maxPrata) + 1))));
    }

    [Fact]
    public void IA_comerciante_so_troca_com_o_proprio_estoque_e_outros_perfis_pedem_mais()
    {
        var (t, ia, j) = CenarioComercio("comerciante");
        Economia.Atualizar(t.M, ia);
        var comida = Economia.TotalGuardado(t.M, ia).Qtd("comida");
        // pede mais que a reserva do que ela guarda: recusa, mesmo com preço bom
        var pede = Math.Ceiling(comida * t.M.P.IA.Comercio.Reserva) + 10;
        Assert.Equal(Comercio.Recusada, Troca(t, ia, j, R(("prata", 100)), R(("comida", pede))));
        // não tem prata nenhuma: recusa
        Assert.Equal(0, Economia.TotalGuardado(t.M, ia).Qtd("prata"));
        Assert.Equal(Comercio.Recusada, Troca(t, ia, j, R(("comida", 100)), R(("prata", 1))));

        var (t2, def, j2) = CenarioComercio("defensivo");
        t2.DarRecursos(def, 5000, "comida");
        var mg = t2.M.P.Comercio.MargemIA * t2.M.P.IA.Comercio.MargemOutros;
        var limite = 100 * t2.M.P.Valor["prata"] / ((1 + mg) * t2.M.P.Valor["comida"]);
        Assert.Equal(Comercio.Recusada, Troca(t2, def, j2, R(("prata", 100)), R(("comida", Math.Floor(limite) + 2))));
        Assert.Equal(Comercio.Aceita, Troca(t2, def, j2, R(("prata", 100)), R(("comida", Math.Floor(limite)))));
    }

    [Fact]
    public void IA_responde_na_sessao_e_nao_na_hora()
    {
        var (t, ia, j) = CenarioComercio("comerciante");
        t.DarRecursos(ia, 5000, "comida");
        var p = Comercio.ProporTroca(t.M, j, ia.Id, R(("prata", 100)), R(("comida", 500)), null);
        Assert.Equal(Comercio.Aberta, p.Estado);
        var sessao = t.M.Eventos.Obter(ia.SessaoIAEventoId!.Value)!.Quando;
        t.Avancar(TimeSpan.FromMilliseconds(sessao - t.M.Agora - 1));
        Assert.Equal(Comercio.Aberta, p.Estado);
        t.AvancarMin(2);
        Assert.Equal(Comercio.Aceita, p.Estado);
    }

    [Fact]
    public void Sessoes_seguem_as_horas_da_habilidade_com_variacao()
    {
        var t = MundoIA.Novo(criar: false);
        var ia = MundoIA.Criar(t, "defensivo", "medio");
        var horas = t.M.P.IA.Habilidades["medio"].Sessoes;
        var vari = t.M.P.IA.VariacaoMin / 60.0;
        var vistas = new HashSet<int>();
        for (var i = 0; i < 12; i++)
        {
            var q = t.M.Eventos.Obter(ia.SessaoIAEventoId!.Value)!.Quando;
            var hl = Sessoes.HoraLocal(t.M, q);
            var h = horas.First(h => Math.Min(Math.Abs(hl - h), 24 - Math.Abs(hl - h)) <= vari + 1e-6);
            vistas.Add(h);
            t.Avancar(TimeSpan.FromMilliseconds(q - t.M.Agora + 1));
        }
        Assert.Equal(horas.Length, vistas.Count);   // passa por todas as horas, sem pular nem repetir
    }
}
