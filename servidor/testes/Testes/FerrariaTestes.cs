using System.Text.Json.Nodes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Forja;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Testes;

public class FerrariaTestes
{
    public FerrariaTestes() => AjustesTeste.Garantir();

    private static Dictionary<string, int> G(params (string k, int n)[] x) => x.ToDictionary(p => p.k, p => p.n);
    private static readonly string[] Todos = ["comida", "madeira", "pedra", "ferro", "couro", "aco", "ouro", "minerio"];

    /// <summary>Local do tipo dado, já no nível, num hexágono livre perto do castelo.</summary>
    private static Local Novo(MundoTeste t, Reino r, TipoLocal tipo, int nivel)
    {
        var c = t.M.Locais[r.CasteloId];
        var h = Enumerable.Range(1, 4).SelectMany(d => t.M.G.Area(c.Hex, d).Where(x => t.M.G.Distancia(x, c.Hex) == d))
            .First(x => Obras.HexLivre(t.M, x) && !t.M.Mapa.Rio[x]);
        return t.M.AdicionarLocal(new Local { ReinoId = r.Id, Tipo = tipo, Nivel = nivel, Hex = h, Nome = tipo.NomeGenerico() + " " + nivel });
    }

    private static (MundoTeste t, Reino r) Reino(int ferraria = 0, int quartel = 0)
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        t.DarRecursos(r, 1e6, Todos);
        if (ferraria > 0) Novo(t, r, TipoLocal.Ferraria, ferraria);
        if (quartel > 0) Novo(t, r, TipoLocal.Quartel, quartel);
        return (t, r);
    }

    private static void Terminar(MundoTeste t, Reino r, string fila)
    {
        for (var i = 0; i < 400 && r.Fila(fila).Itens.Count > 0; i++) t.AvancarHoras(1);
        Assert.Empty(r.Fila(fila).Itens);
        AjustesTeste.FalharSeErro();
    }

    // ---------------------------------------------------------------- eras

    [Fact]
    public void Era_do_aco_exige_ferraria_7_e_libera_o_cavaleiro_de_elite()
    {
        var (t, r) = Reino();
        var m = t.M;
        var elite = m.B.U["elite"];
        Assert.Equal(m.P.Eras["aco"].Nome, Recrutamento.Bloqueio(m, r, elite));
        Assert.Contains("ferraria", Assert.Throws<RegraException>(() => Ferrarias.PesquisarEra(m, r, "aco")).Message.ToLowerInvariant());
        var f = Novo(t, r, TipoLocal.Ferraria, m.P.FerrariaServ.Eras["aco"].Ferraria - 1);
        Assert.Contains("Ferraria nível " + m.P.FerrariaServ.Eras["aco"].Ferraria, Ferrarias.MotivoEra(m, r, "aco"));
        f.Nivel++;
        var it = Ferrarias.PesquisarEra(m, r, "aco");
        Assert.Equal(f.Id, it.LocalId);
        Assert.Single(r.Fila(Ferrarias.Fila).Itens);
        Assert.Empty(r.Fila(Obras.Fila).Itens);
        Assert.Equal(m.P.Eras["aco"].Tempo, it.DuracaoSeg);
        Assert.Equal(m.P.Eras["aco"].Custo["ouro"], it.Custo["ouro"]);
        Assert.Contains("já está na fila", Ferrarias.MotivoEra(m, r, "aco"));
        Terminar(t, r, Ferrarias.Fila);
        Assert.True(Ferrarias.EraFeita(r, "aco"));
        Assert.Equal("aco", Ferrarias.EraAtual(m, r));
        Assert.Null(Recrutamento.Bloqueio(m, r, elite));
        Assert.Equal(m.P.Eras["cerco"].Nome, Recrutamento.Bloqueio(m, r, m.B.U["trebuchet"]));
        Assert.Contains("já foi pesquisada", Ferrarias.MotivoEra(m, r, "aco"));
        Assert.Contains(m.Notificacoes, n => n.ReinoId == r.Id && n.Titulo.StartsWith(m.P.Eras["aco"].Nome));
    }

    [Fact]
    public void Era_do_cerco_exige_a_do_aco_e_quartel_8_e_libera_trebuchet_e_portoes()
    {
        var (t, r) = Reino(ferraria: 7);
        var m = t.M;
        var q = Novo(t, r, TipoLocal.Quartel, m.P.FerrariaServ.Eras["cerco"].Quartel);
        Assert.Contains(m.P.Eras["aco"].Nome, Ferrarias.MotivoEra(m, r, "cerco"));
        r.Eras["aco"] = m.Agora;
        q.Nivel--;
        Assert.Contains("Quartel nível " + m.P.FerrariaServ.Eras["cerco"].Quartel, Ferrarias.MotivoEra(m, r, "cerco"));
        var semEra = m.P.Combate.Portao.NivelSemEra + 1;
        Assert.NotNull(Defesas.BloqueioPortoes(m, r, semEra));
        q.Nivel++;
        Ferrarias.PesquisarEra(m, r, "cerco");
        Terminar(t, r, Ferrarias.Fila);
        Assert.Equal("cerco", Ferrarias.EraAtual(m, r));
        Assert.Null(Recrutamento.Bloqueio(m, r, m.B.U["trebuchet"]));
        Assert.Null(Defesas.BloqueioPortoes(m, r, semEra));
        Assert.Null(Recrutamento.Motivo(m, r, q, "trebuchet"));
    }

    // ---------------------------------------------------------------- fila e forja

    [Fact]
    public void Fila_propria_aceita_10_itens_e_forja_um_por_vez()
    {
        var (t, r) = Reino(ferraria: 9);
        var m = t.M;
        r.Eras["aco"] = m.Agora;
        var pedidos = m.P.FerrariaServ.Familias.SelectMany(f => Ferrarias.Linhas.Select(l => (f, l))).ToList();
        var n = 0;
        while (n < Fila.Maximo) foreach (var (f, l) in pedidos) if (n < Fila.Maximo) { Ferrarias.Forjar(m, r, f, l); n++; }
        Assert.Equal(Fila.Maximo, r.Fila(Ferrarias.Fila).Itens.Count);
        Assert.Contains(Fila.Maximo.ToString(), Assert.Throws<RegraException>(() => Ferrarias.Forjar(m, r, "cavalaria", "armas")).Message);
        Assert.Empty(r.Fila(Obras.Fila).Itens);
        t.AvancarMin(30);
        Assert.Single(r.Fila(Ferrarias.Fila).Itens, i => i.Iniciado);
        // a mesma linha entra na fila com o nível seguinte
        Assert.Equal(new[] { 1, 2 }, r.Fila(Ferrarias.Fila).Itens.Where(i => i.Param == "infantaria:armas").Select(i => i.NivelAlvo));
        Terminar(t, r, Ferrarias.Fila);
        Assert.Equal(2, Ferrarias.Nivel(r, "infantaria", "armas"));
        Assert.Equal(1, Ferrarias.Nivel(r, "cavalaria", "armaduras"));
    }

    [Fact]
    public void Cada_nivel_pede_o_seu_requisito_e_o_material_vem_ate_a_ferraria()
    {
        var (t, r) = Reino();
        var m = t.M;
        var f = Novo(t, r, TipoLocal.Ferraria, m.P.FerrariaServ.Niveis[0].Ferraria - 1);
        Assert.Contains("Ferraria nível " + m.P.FerrariaServ.Niveis[0].Ferraria, Ferrarias.MotivoForja(m, r, "arqueiros", "armas"));
        f.Nivel++;
        var it = Ferrarias.Forjar(m, r, "arqueiros", "armas");
        Assert.Equal(f.Id, it.LocalId);
        Assert.False(it.MaterialCompleto);                                   // vem do castelo, levado por carregadores
        Assert.Contains(m.Marchas, x => x is Carregadores c && c.ItemId == it.Id);
        Assert.Contains(m.P.Eras["aco"].Nome, Ferrarias.MotivoForja(m, r, "arqueiros", "armas"));   // nível 2
        Terminar(t, r, Ferrarias.Fila);
        Assert.Equal(1, Ferrarias.Nivel(r, "arqueiros", "armas"));
        r.Eras["aco"] = m.Agora;
        Assert.Null(Ferrarias.MotivoForja(m, r, "arqueiros", "armas"));
        r.Forja["arqueiros:armas"] = 2;
        Assert.Contains("Ferraria nível " + m.P.FerrariaServ.Niveis[2].Ferraria, Ferrarias.MotivoForja(m, r, "arqueiros", "armas"));
        f.Nivel = m.P.FerrariaServ.Niveis[2].Ferraria;
        Assert.Null(Ferrarias.MotivoForja(m, r, "arqueiros", "armas"));
        r.Forja["arqueiros:armas"] = m.P.Ferraria.Niveis.Length;
        Assert.Contains("máximo", Ferrarias.MotivoForja(m, r, "arqueiros", "armas"));
        Assert.NotNull(Ferrarias.MotivoForja(m, r, "cerco", "armas"));
    }

    // ---------------------------------------------------------------- bônus por família

    [Fact]
    public void Armas_valem_para_cada_familia_na_proporcao_da_forca()
    {
        var (t, r) = Reino();
        var m = t.M;
        var b = m.P.Ferraria.BonusNivel;
        r.Forja["arqueiros:armas"] = 3; r.Forja["infantaria:armas"] = 1;
        var g = G(("arqueiro", 10), ("lanceiro", 10), ("cavalaria", 5));
        var ex = new Exercito { ReinoId = r.Id, Tropas = g };
        double fa = 10 * m.B.U["arqueiro"].Atk, fl = 10 * m.B.U["lanceiro"].Atk, fc = 5 * m.B.U["cavalaria"].Atk;
        var esperado = (fa * 3 * b + fl * 1 * b) / (fa + fl + fc);
        Assert.Equal(esperado, BonusFerraria.Armas(m, ex), 9);
        Assert.Equal(esperado, Bonus.SomaAtaque(m, ex), 9);
        // no valor da fórmula, cada família recebe exatamente o próprio bônus
        var vazio = new Dictionary<string, int>();
        Assert.Equal(fa * (1 + 3 * b) + fl * (1 + b) + fc, m.F.ValorAtaque(g, vazio, esperado), 6);
        // só arqueiros: o bônus inteiro; só cavalaria: nada; armaduras não contam no ataque
        Assert.Equal(3 * b, BonusFerraria.Armas(m, new Exercito { ReinoId = r.Id, Tropas = G(("arqueiro", 7)) }), 9);
        Assert.Equal(0, BonusFerraria.Armas(m, new Exercito { ReinoId = r.Id, Tropas = G(("cavalaria", 7)) }));
        r.Forja["cavalaria:armaduras"] = 2;
        Assert.Equal(0, BonusFerraria.Armas(m, new Exercito { ReinoId = r.Id, Tropas = G(("cavalaria", 7)) }));
        Assert.Equal(2 * b, BonusFerraria.ArmadurasExercito(m, new Exercito { ReinoId = r.Id, Tropas = G(("cavalaria", 7)) }), 9);
        Assert.Equal(2 * b, Bonus.SomaDefesaExercito(m, new Exercito { ReinoId = r.Id, Tropas = G(("cavalaria", 7)) }), 9);
    }

    [Fact]
    public void Armaduras_na_defesa_do_local_contam_milicia_como_infantaria_e_arqueiros_no_alto()
    {
        var s = new CombateCenario();
        var m = s.M;
        var b = m.P.Ferraria.BonusNivel;
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 15), ("arqueiro", 10)), 200);
        s.Torre(alvo, 1);
        s.Def.Forja["infantaria:armaduras"] = 2; s.Def.Forja["arqueiros:armaduras"] = 1;
        double inf = 15 * m.B.U["lanceiro"].Def + Combates.PopDoLocal(m, s.Def, alvo) * m.P.MiliciaPorPop * m.P.DefMilicia;
        double arq = 10 * m.B.U["arqueiro"].Def + Defesas.ArqueirosNoAlto(m, alvo) * m.B.U["arqueiro"].Def * m.P.Torre.BonusAlto;
        Assert.Equal("infantaria", m.B.U["milicia"].Fam);
        var esperado = (inf * 2 * b + arq * b) / (inf + arq);
        Assert.Equal(esperado, BonusFerraria.ArmadurasLocal(m, alvo), 9);
        Assert.Equal(esperado, Bonus.SomaDefesa(m, alvo), 9);
        // a batalha usa esse bônus na defesa
        var bt = s.Chegar(s.Atacar(alvo, G(("cavalaria", 5))));
        var c = Batalhas.Compor(m, bt);
        Assert.Equal(esperado, c.Extra.BonusD, 9);
    }

    [Fact]
    public void Teto_de_bonus_vale_no_combate()
    {
        var s = new CombateCenario();
        var m = s.M;
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 15)), 200);
        // armas nível 3 (+24%), lendário (+25%) e outros +30%: passa do teto de +50%
        s.Atk.Forja["arqueiros:armas"] = 3;
        AjustesTeste.De(m).BonusA = 0.30;
        var tropas = G(("arqueiro", 40));
        var ex = s.Atacar(alvo, tropas);
        m.Lendarios.Adicionar(new EquipamentoLendario { DonoId = s.Atk.Id, ForjadoPor = s.Atk.Id, Tipo = Ferrarias.Ataque, Nome = "x", MarchaId = ex.Id });
        var soma = Bonus.SomaAtaque(m, ex);
        Assert.Equal(3 * m.P.Ferraria.BonusNivel + m.P.Lendario.Bonus + 0.30, soma, 9);
        Assert.True(soma > m.P.TetoBonus);
        var bt = s.Chegar(ex);
        var semBonus = m.F.ValorAtaque(tropas, alvo.Guarnicao, 0);
        Assert.Equal(semBonus * (1 + m.P.TetoBonus), bt.Marcos[0].A, 6);
        var x = new ExtraDefesa { Pop = 200, BonusA = soma, BonusD = 0.9 };
        var res = m.F.Batalha(tropas, alvo.Guarnicao, x, null);
        Assert.Equal(semBonus * (1 + m.P.TetoBonus), res.A, 6);
        Assert.Equal(m.F.ValorDefesa(alvo.Guarnicao, tropas, x with { BonusD = 0 }) * (1 + m.P.TetoBonus), res.D, 6);
    }

    // ---------------------------------------------------------------- equipamento lendário

    [Fact]
    public void Lendario_pede_era_do_aco_e_ferraria_8_e_e_um_por_reino()
    {
        var (t, r) = Reino();
        var m = t.M;
        var f = Novo(t, r, TipoLocal.Ferraria, m.P.FerrariaServ.Lendario.Ferraria);
        Assert.Contains(m.P.Eras["aco"].Nome, Ferrarias.MotivoLendario(m, r));
        r.Eras["aco"] = m.Agora;
        f.Nivel--;
        Assert.Contains("Ferraria nível " + m.P.FerrariaServ.Lendario.Ferraria, Ferrarias.MotivoLendario(m, r));
        f.Nivel++;
        Assert.Throws<RegraException>(() => Ferrarias.ForjarLendario(m, r, "magia"));
        var it = Ferrarias.ForjarLendario(m, r, Ferrarias.Defesa);
        Assert.Equal(m.P.Lendario.Tempo, it.DuracaoSeg);
        Assert.Equal(m.P.Lendario.Custo["minerio"], it.Custo["minerio"]);
        Assert.Contains("por temporada", Assert.Throws<RegraException>(() => Ferrarias.ForjarLendario(m, r, Ferrarias.Ataque)).Message);
        // cancelar devolve a vaga
        Filas.Cancelar(m, r, Ferrarias.Fila, it.Id);
        Assert.Null(Ferrarias.MotivoLendario(m, r));
        Ferrarias.ForjarLendario(m, r, Ferrarias.Defesa);
        Terminar(t, r, Ferrarias.Fila);
        var eq = Assert.Single(Lendarios.Do(m, r.Id));
        Assert.Equal(Ferrarias.Defesa, eq.Tipo);
        Assert.Equal(f.Id, eq.LocalId);
        Assert.NotNull(Ferrarias.MotivoLendario(m, r));
        // sem minério raro, não entra na fila
        var (t2, r2) = Reino(ferraria: 8);
        r2.Eras["aco"] = t2.M.Agora;
        foreach (var l in t2.M.LocaisDe(r2.Id)) l.Estoque.Remove("minerio");
        Assert.Contains("minério raro", Assert.Throws<RegraException>(() => Ferrarias.ForjarLendario(t2.M, r2, Ferrarias.Ataque)).Message);
        Assert.Equal(0, r2.LendariosForjados);
    }

    [Fact]
    public void Lendario_da_25_por_cento_ate_50_tropas_e_dilui_acima()
    {
        var (t, r) = Reino();
        var m = t.M;
        var ex = new Exercito { ReinoId = r.Id, Tropas = G(("lanceiro", m.P.Lendario.Tropas)) };
        m.Marchas.Adicionar(ex);
        Assert.Equal(0, Lendarios.Ataque(m, ex));
        m.Lendarios.Adicionar(new EquipamentoLendario { DonoId = r.Id, Tipo = Ferrarias.Ataque, Nome = "x", MarchaId = ex.Id });
        Assert.Equal(m.P.Lendario.Bonus, Lendarios.Ataque(m, ex), 9);
        Assert.Equal(0, Lendarios.DefesaExercito(m, ex));
        ex.Tropas = G(("lanceiro", 2 * m.P.Lendario.Tropas));
        Assert.Equal(m.P.Lendario.Bonus / 2, Lendarios.Ataque(m, ex), 9);
        ex.Tropas = G(("lanceiro", 10));
        Assert.Equal(m.P.Lendario.Bonus, Lendarios.Ataque(m, ex), 9);
        // na guarnição: o de defesa vale para quem defende o local (guarnição, milícia e arqueiros no alto)
        var c = m.Locais[r.CasteloId];
        c.Guarnicao = G(("lanceiro", 100));
        m.Lendarios.Adicionar(new EquipamentoLendario { DonoId = r.Id, Tipo = Ferrarias.Defesa, Nome = "y", LocalId = c.Id });
        var defensores = Lendarios.Defensores(m, c);
        Assert.True(defensores >= 100);
        Assert.Equal(m.P.Lendario.Bonus * m.P.Lendario.Tropas / defensores, Lendarios.DefesaLocal(m, c), 9);
        Assert.Equal(Lendarios.DefesaLocal(m, c), Bonus.SomaDefesa(m, c), 9);
    }

    [Fact]
    public void Lendario_vai_com_o_proximo_envio_e_fica_onde_as_tropas_entram()
    {
        var (t, r) = Reino();
        var m = t.M;
        var c = m.Locais[r.CasteloId];
        var vila = m.LocaisDe(r.Id).First(l => l.Tipo == TipoLocal.Vila);
        c.Guarnicao = G(("lanceiro", 20));
        var eq = m.Lendarios.Adicionar(new EquipamentoLendario { DonoId = r.Id, ForjadoPor = r.Id, Tipo = Ferrarias.Ataque, Nome = "x", LocalId = c.Id });
        // sem a marca, o exército sai sem ele
        var e1 = Exercitos.Enviar(m, r, c.Id, G(("lanceiro", 5)), vila.Hex, OrdemReforcar.Id);
        Assert.Equal(c.Id, eq.LocalId);
        Lendarios.MarcarLevar(m, r, eq.Id, true);
        var e2 = Exercitos.Enviar(m, r, c.Id, G(("lanceiro", 5)), vila.Hex, OrdemReforcar.Id);
        Assert.Equal(e2.Id, eq.MarchaId);
        Assert.Null(eq.LocalId);
        Assert.False(eq.Levar);
        Assert.Throws<RegraException>(() => Lendarios.MarcarLevar(m, r, eq.Id, true));
        t.Avancar(TimeSpan.FromMilliseconds(Math.Max(e1.Chegada, e2.Chegada) - m.Agora + 1));
        Assert.Equal(vila.Id, eq.LocalId);
        Assert.Null(eq.MarchaId);
        var outro = t.NovoReino();
        Assert.Throws<RegraException>(() => Lendarios.MarcarLevar(m, outro, eq.Id, true));
    }

    [Fact]
    public void Exercito_derrotado_deixa_o_lendario_e_a_defesa_vencedora_leva()
    {
        var s = new CombateCenario();
        var m = s.M;
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 15)), 200);
        var ex = s.Atacar(alvo, G(("lanceiro", 10)));
        var eq = m.Lendarios.Adicionar(new EquipamentoLendario { DonoId = s.Atk.Id, ForjadoPor = s.Atk.Id, Tipo = Ferrarias.Ataque, Nome = "x", MarchaId = ex.Id });
        var b = s.Chegar(ex);
        s.Terminar(b);
        Assert.Equal("derrota", b.Resultado);
        Assert.Equal(s.Def.Id, eq.DonoId);
        Assert.Equal(alvo.Id, eq.LocalId);
        Assert.Null(eq.MarchaId);
        Assert.Contains(m.Notificacoes, n => n.ReinoId == s.Def.Id && n.Titulo == "Equipamento lendário capturado");
        Assert.Contains(m.Notificacoes, n => n.ReinoId == s.Atk.Id && n.Titulo == "Equipamento lendário perdido");
    }

    [Fact]
    public void Defesa_derrotada_deixa_o_lendario_e_o_atacante_leva_para_casa()
    {
        var s = new CombateCenario();
        var m = s.M;
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 5)), 100);
        var eq = m.Lendarios.Adicionar(new EquipamentoLendario { DonoId = s.Def.Id, ForjadoPor = s.Def.Id, Tipo = Ferrarias.Defesa, Nome = "x", LocalId = alvo.Id });
        Assert.True(Bonus.SomaDefesa(m, alvo) > 0);
        var ex = s.Atacar(alvo, G(("cavalaria", 40)));
        var b = s.Chegar(ex);
        s.Terminar(b);
        Assert.Equal("vitoria", b.Resultado);
        Assert.Equal(s.Atk.Id, eq.DonoId);
        Assert.Equal(ex.Id, eq.MarchaId);
        Assert.Equal(0, Bonus.SomaDefesa(m, alvo));
        s.AvancarAte(ex.Chegada + 1);
        Assert.Equal(s.CasteloAtk.Id, eq.LocalId);
    }

    [Fact]
    public void Ocupacao_vitoriosa_fica_com_o_lendario_no_local_tomado()
    {
        var s = new CombateCenario();
        var m = s.M;
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 3)), 50);
        var eq = m.Lendarios.Adicionar(new EquipamentoLendario { DonoId = s.Def.Id, ForjadoPor = s.Def.Id, Tipo = Ferrarias.Defesa, Nome = "x", LocalId = alvo.Id });
        var b = s.Chegar(s.Atacar(alvo, G(("lanceiro", 40)), CombateCenario.Plano("ocupacao")));
        s.Terminar(b);
        Assert.Equal("vitoria", b.Resultado);
        Assert.Equal(s.Atk.Id, alvo.ReinoId);
        Assert.Equal(s.Atk.Id, eq.DonoId);
        Assert.Equal(alvo.Id, eq.LocalId);
    }

    [Fact]
    public void Interceptado_entrega_o_lendario_ao_vencedor_e_espionagem_mostra_na_guarnicao()
    {
        var s = new CombateCenario();
        var m = s.M;
        s.Guarnecer(s.CasteloAtk, G(("lanceiro", 10)));
        var perdedor = new Exercito { ReinoId = s.Def.Id, Tropas = G(("lanceiro", 3)) };
        m.Marchas.Adicionar(perdedor);
        var vencedor = new Exercito { ReinoId = s.Atk.Id, Tropas = G(("lanceiro", 8)) };
        m.Marchas.Adicionar(vencedor);
        var eq = m.Lendarios.Adicionar(new EquipamentoLendario { DonoId = s.Def.Id, Tipo = Ferrarias.Ataque, Nome = "Lâmina lendária", MarchaId = perdedor.Id });
        perdedor.AoSerVencida(m, vencedor);
        Assert.Equal(vencedor.Id, eq.MarchaId);
        Assert.Equal(s.Atk.Id, eq.DonoId);

        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 3)), 50);
        m.Lendarios.Adicionar(new EquipamentoLendario { DonoId = s.Def.Id, ForjadoPor = s.Def.Id, Tipo = Ferrarias.Defesa, Nome = "Armadura lendária", LocalId = alvo.Id });
        var rel = Espionagem.Relatar(m, s.Atk, s.Def, alvo, 0, 0, false);
        var arr = Assert.IsType<JsonArray>(rel.Dados["lendario"]);
        Assert.Equal("Armadura lendária", (string?)arr[0]!["nome"]);
        Assert.Equal(Ferrarias.Defesa, (string?)arr[0]!["tipo"]);
        Assert.Null(arr[0]!["forjadoPor"]);
    }

    [Fact]
    public void Exercito_que_some_sem_batalha_perde_o_lendario_e_local_tomado_passa_ao_novo_dono()
    {
        var (t, r) = Reino();
        var m = t.M;
        var ex = new Exercito { ReinoId = r.Id, Tropas = G(("lanceiro", 1)) };
        m.Marchas.Adicionar(ex);
        var eq = m.Lendarios.Adicionar(new EquipamentoLendario { DonoId = r.Id, Tipo = Ferrarias.Ataque, Nome = "x", MarchaId = ex.Id });
        ex.Encerrar(m);
        Lendarios.Conferir(m);
        Assert.Null(m.Lendarios.Obter(eq.Id));
        var outro = t.NovoReino();
        var vila = m.LocaisDe(r.Id).First(l => l.Tipo == TipoLocal.Vila);
        var eq2 = m.Lendarios.Adicionar(new EquipamentoLendario { DonoId = r.Id, Tipo = Ferrarias.Defesa, Nome = "y", LocalId = vila.Id });
        m.MudarDono(vila, outro.Id);
        Lendarios.Conferir(m);
        Assert.Equal(outro.Id, eq2.DonoId);
    }

    // ---------------------------------------------------------------- sistema apresentado aos poucos

    [Fact]
    public void Ferraria_aparece_ao_fundar_a_primeira()
    {
        var (t, r) = Reino();
        var m = t.M;
        Assert.False(Sistemas.Estado(m, r)[SistemaFerraria.ChaveSistema]);
        var c = m.Locais[r.CasteloId];
        var hex = Enumerable.Range(1, 8).SelectMany(d => m.G.Area(c.Hex, d)).First(h => Obras.MotivoNaoFundar(m, r, "ferraria", h) == null);
        Obras.Fundar(m, r, "ferraria", hex);
        Terminar(t, r, Obras.Fila);
        Assert.True(Sistemas.Estado(m, r)[SistemaFerraria.ChaveSistema]);
        Assert.Single(m.Notificacoes, n => n.ReinoId == r.Id && n.Titulo == "Novo: Ferraria e eras");
        Assert.False(Sistemas.Revelar(m, r, SistemaFerraria.ChaveSistema));
    }
}
