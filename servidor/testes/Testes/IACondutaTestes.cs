using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.IA;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Testes;

/// <summary>Guerra (escudo e porte), jogador ausente, IA comerciante e horas de sessão.</summary>
public class IACondutaTestes
{
    public IACondutaTestes() => AjustesTeste.Garantir();

    private static Dictionary<string, double> R(params (string k, double n)[] g) => g.ToDictionary(x => x.k, x => x.n);

    // ---------------------------------------------------------------- feridos e prisioneiros

    [Fact]
    public void IA_cura_feridos_com_as_ervas_que_tem()
    {
        var t = MundoIA.Novo(criar: false);
        var ia = MundoIA.Criar(t, "defensivo", vaga: 1);
        Feridos.Adicionar(t.M, ia, new Dictionary<string, int> { ["lanceiro"] = 4 }, "teste");
        Governo.Curar(t.M, ia);
        Assert.Equal(0, Feridos.EmCura(ia));   // sem ervas, não cura
        t.M.Locais[ia.CasteloId].Estoque.Somar("ervas", t.M.P.Feridos.Ervas * 4);
        Governo.Curar(t.M, ia);
        Assert.Equal(4, Feridos.EmCura(ia));
        Governo.Curar(t.M, ia);   // já curando: não repete
        Assert.Single(ia.Fila(Feridos.Fila).Itens);
    }

    [Theory]
    [InlineData("saqueador", "executado")]
    [InlineData("comerciante", "resgate")]
    [InlineData("defensivo", "libertado")]
    public void IA_decide_o_destino_do_explorador_capturado(string perfil, string esperado)
    {
        var t = MundoIA.Novo(criar: false);
        var dono = MundoIA.Jogador(t, 0);
        var ia = MundoIA.Criar(t, perfil, vaga: 1);
        var cc = t.M.Locais[ia.CasteloId];
        var p = t.M.Prisioneiros.Adicionar(new Prisioneiro { CaptorId = ia.Id, DonoId = dono.Id, TipoExp = "pe", Hex = cc.Hex, Ate = t.M.Agora + T.Hora });
        Governo.Prisioneiros(t.M, ia);
        if (esperado == "resgate")
        {
            Assert.Equal(Capturas.ResgatePedido, p.Estado);
            Assert.NotEmpty(p.Resgate);
        }
        else
        {
            Assert.Null(t.M.Prisioneiros.Obter(p.Id));
            Assert.Equal(esperado == "libertado", Exploradores.De(t.M, dono.Id).Any());
        }
    }

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

    private static void Espionado(MundoTeste t, Reino ia, Local l, int nivel, int tropas)
    {
        ia.LocaisEspionados[l.Id] = new LocalEspionado { DonoId = l.ReinoId, Nivel = nivel, Quando = t.M.Agora, Tropas = tropas, Torres = 0 };
        Nevoas.RevelarArea(t.M, ia.Id, l.Hex, 0);   // o batedor passou por lá: o local fica na foto da névoa
    }

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

    // ---------------------------------------------------------------- jogador ausente

    [Fact]
    public void Jogador_ausente_fica_como_deixou_e_continua_liderando_a_alianca()
    {
        // a IA nunca governa um reino de jogador: dias sem entrar não mudam quem decide nem quem lidera
        var t = MundoIA.Novo(criar: false);
        var j = MundoIA.Jogador(t, 0); var k = MundoIA.Jogador(t, 1);
        var a = Aliancas.Criar(t.M, j, "Liga do Norte");
        Aliancas.Convidar(t.M, j, k.Id); Aliancas.AceitarConvite(t.M, k, a.Id);
        var fundados = j.Fundados;
        var tropas = Economia.Tropas(t.M, j);
        t.AvancarHoras(120);
        AjustesTeste.FalharSeErro();
        Assert.Null(Sessoes.De(t.M, j));
        Assert.Null(j.SessaoIAEventoId);
        Assert.DoesNotContain(t.M.Eventos.OfType<SessaoIAEvento>(), e => e.ReinoId == j.Id || e.ReinoId == k.Id);
        Assert.Equal(Aliancas.Lider, a.Membro(j.Id)!.Cargo);   // a liderança só passa quando o líder sai
        Assert.Equal(fundados, j.Fundados);
        Assert.Empty(j.Filas.Values.SelectMany(f => f.Itens));   // ninguém pôs nada na fila por ele
        Assert.Equal(tropas, Economia.Tropas(t.M, j));
        Assert.Empty(Exercitos.De(t.M, j.Id));
    }

    // ---------------------------------------------------------------- IA comerciante

    private static (MundoTeste t, Reino ia, Reino j) CenarioComercio(string perfil)
    {
        var t = MundoIA.Novo(criar: false);
        var j = MundoIA.Jogador(t, 0);
        var ia = MundoIA.Criar(t, perfil);
        j.EscudoAte = 0; ia.EscudoAte = 0;   // sem o limite do novato: o que se testa aqui é a margem da IA
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
