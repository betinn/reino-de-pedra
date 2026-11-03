using System.Text.Json.Nodes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Temporada;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Testes;

/// <summary>Temporada, legado, ranking, "precisa de você" e os gatilhos de espionagem e torres.</summary>
public class TemporadaTestes
{
    public TemporadaTestes() => AjustesTeste.Garantir();

    private static Dictionary<string, int> G(params (string k, int n)[] x) => x.ToDictionary(p => p.k, p => p.n);

    private static LegadoConta Legado(Mundo m, Reino r) => m.Legados.De(r.ContaId!.Value);

    // ---------------------------------------------------------------- fim da temporada e reset

    [Fact]
    public void Fim_da_temporada_e_agendado_para_o_ultimo_dia()
    {
        var t = new MundoTeste();
        var f = t.M.Eventos.OfType<FimTemporadaEvento>().Single();
        Assert.Equal(1, f.Temporada);
        Assert.Equal(t.M.Estado.InicioTemporada + t.M.P.TemporadaDias * T.Dia, f.Quando);
        Assert.Equal(t.M.P.TemporadaDias, Temporadas.DiasRestantes(t.M));
    }

    [Fact]
    public void No_fim_o_mundo_recomeca_e_contas_e_legado_ficam()
    {
        var t = new MundoTeste();
        var a = t.NovoReino();
        var conta = a.ContaId!.Value;
        Temporadas.MarcarAtivo(t.M, conta);
        var semente = t.M.Estado.Semente;
        // temporada acelerada (ponto de testes e desenvolvimento): 70 "dias" em 70 minutos
        t.M.DuracaoTemporadaMs = 70 * T.Min;
        Temporadas.Reagendar(t.M);
        t.AvancarMin(71);
        Assert.Equal(2, t.M.Estado.NumeroTemporada);
        Assert.NotEqual(semente, t.M.Estado.Semente);
        Assert.DoesNotContain(t.M.Reinos, r => r.ContaId == conta);
        Assert.DoesNotContain(t.M.Locais, l => l.ReinoId == a.Id);
        Assert.True(t.M.Jazidas.Count > 0 && t.M.Ruinas.Count > 0);
        // o fim da temporada nova já está agendado
        Assert.Contains(t.M.Eventos, e => e is FimTemporadaEvento { Temporada: 2 });
        // o legado ficou (histórico, brasão), e a conta pode fundar outro reino
        var l = t.M.Legados.Obter(conta)!;
        Assert.Contains(l.Historico, h => h.Temporada == 1 && h.NomeReino == a.Nome);
        Assert.Contains(l.Brasoes, b => b.Temporada == 1);
        var novo = CriacaoReino.Criar(t.M, conta, a.Nome, new Brasao());
        Assert.Equal(2, t.M.Estado.NumeroTemporada);
        Assert.True(novo.Id > 0);
    }

    // ---------------------------------------------------------------- relíquias da temporada

    /// <summary>Reinos parados (economia congelada) com valores de ranking escolhidos.</summary>
    private static Reino Parado(MundoTeste t, long baixas, int pop, int lanceiros, bool ia = false)
    {
        var r = t.NovoReino(ia: ia);
        r.RankBaixas = baixas; r.Pop = pop; r.AtualizadoEm = long.MaxValue / 4;
        var c = t.M.Locais[r.CasteloId];
        c.Guarnicao["lanceiro"] = lanceiros;
        return r;
    }

    [Fact]
    public void Top_3_de_baixas_tropas_e_familias_ganha_reliquia_e_perdas_nao_contam()
    {
        var t = new MundoTeste();
        var a = Parado(t, 500, 100, 5);     // 1º em baixas
        var ia = Parado(t, 400, 90, 4, ia: true);   // IA ocupa o 2º lugar (sem prêmio, sem distinção no ranking)
        var b = Parado(t, 300, 900, 1);     // 3º em baixas, 1º em famílias
        var c = Parado(t, 10, 80, 300);     // 1º em tropas
        var d = Parado(t, 0, 10, 0);        // último em tudo (e 1º em perdas: não conta)
        Temporadas.Apurar(t.M);
        var la = Legado(t.M, a);
        var rel = Assert.Single(la.Reliquias, x => x.Conquista == "baixas");
        Assert.Equal(t.M.P.TemporadaServ.BonusPos[0], rel.Bonus, 6);
        Assert.Equal(t.M.P.TemporadaServ.Conquistas["baixas"].Tipo, rel.Tipo);
        Assert.Contains(la.Titulos, x => x.Nome == t.M.P.TemporadaServ.Conquistas["baixas"].Titulo);
        Assert.Equal(t.M.P.TemporadaServ.BonusPos[2], Legado(t.M, b).Reliquias.Single(x => x.Conquista == "baixas").Bonus, 6);
        Assert.Equal(t.M.P.TemporadaServ.BonusPos[0], Legado(t.M, b).Reliquias.Single(x => x.Conquista == "familias").Bonus, 6);
        Assert.Contains(Legado(t.M, c).Reliquias, x => x.Conquista == "tropas");
        Assert.Empty(Legado(t.M, d).Reliquias);
        Assert.All(t.M.Legados.Todos.SelectMany(x => x.Reliquias), x => Assert.InRange(x.Bonus, t.M.P.Legado.RelMin, t.M.P.Legado.RelMax));
        Assert.DoesNotContain(t.M.Legados.Todos.SelectMany(x => x.Reliquias), x => x.Conquista == "perdas");
    }

    [Fact]
    public void Terminar_com_reliquia_lendaria_e_vencer_um_cerco_ganham_reliquias()
    {
        var s = new CombateCenario();
        var castelo = s.Alvo(TipoLocal.Castelo, G(("lanceiro", 5)), 100);
        castelo.Nivel = 2;
        var ex = s.Atacar(castelo, G(("arqueiro", 100)), CombateCenario.Plano("cerco", "media", new JsonArray(CombateCenario.Obj("portoes", q: 1))));
        s.Terminar(s.Chegar(ex));
        Assert.True(s.Atk.VenceuCerco);
        Assert.False(s.Def.VenceuCerco);
        var guardiao = s.T.NovoReino();
        s.M.Reliquias.Adicionar(new Reliquia { Nome = "Coroa de Ferro", Tipo = "ataque", ReinoId = guardiao.Id, LocalId = guardiao.CasteloId });
        Temporadas.Apurar(s.M);
        Assert.Contains(Legado(s.M, s.Atk).Reliquias, x => x.Conquista == "cerco" && x.Bonus == s.M.P.TemporadaServ.BonusCerco);
        Assert.Contains(Legado(s.M, guardiao).Reliquias, x => x.Conquista == "lendaria" && x.Bonus == s.M.P.TemporadaServ.BonusLendaria);
        Assert.DoesNotContain(Legado(s.M, s.Def).Reliquias, x => x.Conquista is "cerco" or "lendaria");
    }

    // ---------------------------------------------------------------- teto do legado e do combate

    private static ReliquiaTemporada Rel(LegadoConta l, string tipo, double bonus) =>
        new() { Id = ++l.UltimoId, Nome = "R" + l.UltimoId, Tipo = tipo, Bonus = bonus, Temporada = 1 };

    [Fact]
    public void Ate_3_equipadas_com_teto_somado_de_5_por_cento_que_vale_no_combate_na_producao_e_no_crescimento()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var l = Legado(t.M, r);
        var a1 = Rel(l, Linhagem.Ataque, 0.02); var a2 = Rel(l, Linhagem.Ataque, 0.02); var p = Rel(l, Linhagem.Producao, 0.02); var c = Rel(l, Linhagem.Crescimento, 0.01);
        l.Reliquias.AddRange([a1, a2, p, c]);
        var serraria = t.M.LocaisDe(r.Id).First(x => x.Produz == "madeira");
        var antes = Economia.TaxaLocal(t.M, r, serraria, 1)["madeira"];
        Linhagem.Equipar(t.M, r.ContaId!.Value, a1.Id, true);
        Linhagem.Equipar(t.M, r.ContaId!.Value, a2.Id, true);
        Linhagem.Equipar(t.M, r.ContaId!.Value, p.Id, true);
        Assert.Throws<RegraException>(() => Linhagem.Equipar(t.M, r.ContaId!.Value, c.Id, true));
        // 6% equipados valem 5%: cada um encolhe na mesma proporção
        var f = t.M.P.Legado.Teto / 0.06;
        Assert.Equal(0.04 * f, Linhagem.BonusReino(t.M, r.Id, Linhagem.Ataque), 9);
        Assert.Equal(0.02 * f, Linhagem.BonusReino(t.M, r.Id, Linhagem.Producao), 9);
        Assert.Equal(antes * (1 + 0.02 * f), Economia.TaxaLocal(t.M, r, serraria, 1)["madeira"], 6);
        // no combate: entra na soma de bônus de ataque, e a soma inteira respeita o teto de combate
        var ex = new Exercito { ReinoId = r.Id, Tropas = G(("lanceiro", 10)) };
        Assert.Equal(0.04 * f, Bonus.SomaAtaque(t.M, ex), 9);
        AjustesTeste.De(t.M).BonusA = t.M.P.TetoBonus;
        Assert.Equal(1 + t.M.P.TetoBonus, t.M.F.BonusCom(Bonus.SomaAtaque(t.M, ex)), 9);
        // crescimento: troca uma de ataque pela de crescimento
        Linhagem.Equipar(t.M, r.ContaId!.Value, a2.Id, false);
        Linhagem.Equipar(t.M, r.ContaId!.Value, c.Id, true);
        var mult = Economia.ModificadoresCrescimento.Aggregate(1.0, (x, g) => x * g(t.M, r));
        Assert.Equal(1.01, mult, 9);
        // reino de IA não tem legado
        var ia = t.NovoReino(ia: true);
        Assert.Equal(0, Linhagem.BonusReino(t.M, ia.Id, Linhagem.Ataque));
    }

    // ---------------------------------------------------------------- linhagem

    [Fact]
    public void Linhagem_sobe_com_30_dias_ativos_e_com_cada_reliquia_ate_10()
    {
        var t = new MundoTeste();
        var a = t.NovoReino(); var b = t.NovoReino();
        a.AtualizadoEm = b.AtualizadoEm = long.MaxValue / 4;
        var dias = t.M.P.TemporadaServ.Linhagem.DiasAtivos;
        for (var d = 0; d < dias; d++)
        {
            Temporadas.MarcarAtivo(t.M, a.ContaId!.Value);
            Temporadas.MarcarAtivo(t.M, a.ContaId!.Value);   // o mesmo dia conta uma vez
            if (d < dias - 1) Temporadas.MarcarAtivo(t.M, b.ContaId!.Value);
            t.Relogio.Avancar(TimeSpan.FromDays(1));
        }
        Assert.Equal(dias, Temporadas.DiasAtivos(t.M, Legado(t.M, a)));
        Assert.Equal(dias - 1, Temporadas.DiasAtivos(t.M, Legado(t.M, b)));
        var la = Legado(t.M, a); var lb = Legado(t.M, b);
        var antesA = Linhagem.Nivel(t.M, la); var antesB = Linhagem.Nivel(t.M, lb);
        Temporadas.Apurar(t.M);
        var ganhasA = la.Reliquias.Count; var ganhasB = lb.Reliquias.Count;
        Assert.Equal(antesA + 1 + ganhasA, Linhagem.Nivel(t.M, la));
        Assert.Equal(antesB + ganhasB, Linhagem.Nivel(t.M, lb));
        Assert.True(la.Historico[0].Contou);
        Assert.False(lb.Historico[0].Contou);
        // +1 por relíquia, no máximo 10
        lb.TemporadasJogadas = 6;
        lb.Reliquias.Clear();
        for (var i = 0; i < 6; i++) lb.Reliquias.Add(Rel(lb, Linhagem.Defesa, 0.01));
        Assert.Equal(t.M.P.TemporadaServ.Linhagem.Max, Linhagem.Nivel(t.M, lb));
    }

    // ---------------------------------------------------------------- desbloqueios

    [Fact]
    public void Regiao_inicial_libera_no_nivel_5_e_escolhe_a_vaga_mais_perto()
    {
        var t = new MundoTeste();
        const long conta = 77;
        Assert.Throws<RegraException>(() => CriacaoReino.CriarNaRegiao(t.M, conta, "Ventania", new Brasao(), "sul"));
        var l = t.M.Legados.De(conta);
        l.TemporadasJogadas = t.M.P.TemporadaServ.Desbloqueios.Regiao - t.M.P.TemporadaServ.Linhagem.Inicial;
        var centro = Regioes.Centro(t.M, "sul");
        var melhor = t.M.Mapa.Vagas.Min(v => t.M.G.Distancia(v.Castelo, centro));
        var r = CriacaoReino.CriarNaRegiao(t.M, conta, "Ventania", new Brasao(), "sul");
        Assert.Equal(melhor, t.M.G.Distancia(t.M.Mapa.Vagas[r.Vaga].Castelo, centro));
        Assert.True(t.M.G.L(t.M.Locais[r.CasteloId].Hex) > t.M.G.Lins / 2);
    }

    [Fact]
    public void Brasao_extra_libera_no_nivel_2_e_moldura_no_10()
    {
        var t = new MundoTeste();
        const long conta = 88;
        var extra = new Brasao { Cor1 = "celeste", Cor2 = "ouro", Forma = "losango" };
        Assert.Throws<RegraException>(() => CriacaoReino.Criar(t.M, conta, "Celeste", extra));
        var l = t.M.Legados.De(conta);
        l.TemporadasJogadas = 1;
        var r = CriacaoReino.Criar(t.M, conta, "Celeste", extra);
        Assert.Equal("celeste", r.Brasao.Cor1);
        var moldura = new Brasao { Moldura = true };
        Assert.False(moldura.Valido(true, Linhagem.Moldura(t.M, conta)));
        l.TemporadasJogadas = 9;
        Assert.True(moldura.Valido(true, Linhagem.Moldura(t.M, conta)));
    }

    [Fact]
    public void Titulos_so_podem_ser_usados_a_partir_do_nivel_3()
    {
        var t = new MundoTeste();
        const long conta = 99;
        var l = t.M.Legados.De(conta);
        l.Titulos.Add(new TituloGanho { Nome = "Sitiante", Como = "teste", Temporada = 1 });
        Assert.Throws<RegraException>(() => Linhagem.UsarTitulo(t.M, conta, "Sitiante"));   // linhagem 1: ainda não
        l.TemporadasJogadas = 2;
        Linhagem.UsarTitulo(t.M, conta, "Sitiante");
        Assert.Equal("Sitiante", Linhagem.TituloEmUso(t.M, conta));
        Assert.Throws<RegraException>(() => Linhagem.UsarTitulo(t.M, conta, "Senhor de Terras"));   // linhagem 5
    }

    [Fact]
    public void Exilio_vai_para_a_regiao_escolhida_no_nivel_7()
    {
        var s = new CombateCenario();
        var castelo = s.Alvo(TipoLocal.Castelo, G(("lanceiro", 5)), 100);
        castelo.Nivel = 2;
        var conta = s.Def.ContaId!.Value;
        Assert.Throws<RegraException>(() => Linhagem.EscolherRegiaoExilio(s.M, conta, "sul"));
        s.M.Legados.De(conta).TemporadasJogadas = s.M.P.TemporadaServ.Desbloqueios.Exilio - 1;
        Linhagem.EscolherRegiaoExilio(s.M, conta, "sul");
        var ex = s.Atacar(castelo, G(("arqueiro", 100)), CombateCenario.Plano("cerco", "media", new JsonArray(CombateCenario.Obj("portoes", q: 1))));
        s.Terminar(s.Chegar(ex));
        Assert.True(s.Def.UltimaQueda!.Exilio);
        var novo = s.M.Locais[s.Def.CasteloId];
        Assert.True(s.M.G.L(novo.Hex) > s.M.G.Lins / 2, "o exílio devia ficar no sul");
    }

    [Fact]
    public void Reino_de_IA_pode_ter_brasao_de_veterano_como_qualquer_jogador()
    {
        var t = new MundoTeste();
        var extras = 0;
        for (var i = 0; i < 20; i++)
        {
            var r = t.NovoReino("Reino " + "abcdefghijklmnopqrstu"[i], ia: true);
            Assert.True(r.Brasao.Valido(true, true));
            if (Brasao.FormasExtras.Contains(r.Brasao.Forma) || Brasao.TinturasExtras.Contains(r.Brasao.Cor1) || Brasao.TinturasExtras.Contains(r.Brasao.Cor2)) extras++;
            if (t.M.Reinos.Count(x => x.Ativo) >= t.M.Mapa.Vagas.Count) break;
        }
        Assert.True(extras > 0);
    }

    // ---------------------------------------------------------------- ranking

    [Fact]
    public void Ranking_conta_baixas_e_perdas_das_batalhas_tropas_e_familias()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 4)), 3);
        var ex = s.Atacar(alvo, G(("arqueiro", 8)));   // o atacante vence (combate de referência)
        s.Terminar(s.Chegar(ex));
        var rc = AjustesTeste.De(s.M).Fins.Single();
        var pa = GT.Total(rc.PerdasAtaque);
        var pd = GT.Total(rc.PerdasDefesa) + (long)Math.Round(rc.MiliciaMorta);
        Assert.True(pd > 0 && pa > 0);
        Assert.Equal(pd, s.Atk.RankBaixas);
        Assert.Equal(pa, s.Atk.RankPerdas);
        Assert.Equal(pa, s.Def.RankBaixas);
        Assert.Equal(pd, s.Def.RankPerdas);
        var linhas = Ranking.Linhas(s.M);
        var la = linhas.Single(x => x.Reino.Id == s.Atk.Id);
        Assert.Equal(Ranking.TropasDe(s.M, s.Atk), la.Tropas);
        Assert.Equal((long)Math.Floor(s.Atk.Pop), la.Familias);
        // perdas: menos é melhor
        var pos = Ranking.Posicoes(linhas);
        Assert.True(pos["baixas"][s.Atk.Id] < pos["baixas"][s.Def.Id] || s.Atk.RankBaixas == s.Def.RankBaixas);
        Assert.Equal(Ranking.Ordenar(linhas, "perdas").First().Perdas, linhas.Min(x => x.Perdas));
    }

    // ---------------------------------------------------------------- precisa de você

    [Fact]
    public void Precisa_de_voce_lista_ameacas_oportunidades_e_o_reino()
    {
        var s = new CombateCenario();
        var t = s.T; var m = s.M;
        var r = s.Def;
        var meu = s.Alvo(TipoLocal.Mina, G(("lanceiro", 2)), 50, dist: 4);
        var l0 = PrecisaDeVoce.Listar(m, r);
        Assert.Contains(l0, x => x.Titulo == "Nenhuma obra na fila");
        Assert.Contains(l0, x => x.Titulo == "Nada sendo recrutado");
        // ameaça: ataque a caminho à vista, feridos e escudo acabando
        var ex = s.Atacar(meu, G(("arqueiro", 10)));
        s.AvancarAte(ex.Partida + (ex.Chegada - ex.Partida) * 3 / 4);
        Assert.Contains(PrecisaDeVoce.Listar(m, r), x => x.Grupo == PrecisaDeVoce.Urgente && x.Titulo.StartsWith("Ataque a caminho") && !x.Texto.Contains(s.Atk.Nome));
        Feridos.Adicionar(m, r, G(("lanceiro", 3)), "teste", m.Agora + T.Hora);
        r.EscudoAte = m.Agora + 2 * T.Hora;
        var l1 = PrecisaDeVoce.Listar(m, r);
        Assert.Contains(l1, x => x.Grupo == PrecisaDeVoce.Urgente && x.Icone == "ferido");
        Assert.Contains(l1, x => x.Titulo == "Escudo acabando");
        // oportunidades: jazida descoberta, ruína avistada, explorador preso, proposta
        var j = m.Jazidas.First();
        j.DescobertaPor.Add(r.Id);
        var ru = m.Ruinas.First();
        Nevoas.RevelarArea(m, r.Id, ru.Hex, 0);
        m.Prisioneiros.Adicionar(new Prisioneiro { CaptorId = r.Id, DonoId = s.Atk.Id, TipoExp = "pe", Hex = meu.Hex, Ate = m.Agora + T.Hora });
        var l2 = PrecisaDeVoce.Listar(m, r);
        Assert.Contains(l2, x => x.Grupo == PrecisaDeVoce.Oportunidade && x.Href == "#/extracao?jazida=" + j.Id);
        Assert.Contains(l2, x => x.Grupo == PrecisaDeVoce.Oportunidade && x.Titulo == "Ruína antiga avistada");
        Assert.Contains(l2, x => x.Titulo == "Explorador capturado");
        // no reino: estoque cheio e população no teto
        meu.Estoque["ferro"] = Economia.Capacidade(m, meu, "ferro");
        r.Pop = Economia.Teto(m, r);
        var l3 = PrecisaDeVoce.Listar(m, r);
        Assert.Contains(l3, x => x.Titulo == "Estoque cheio: " + meu.Nome);
        Assert.Contains(l3, x => x.Titulo == "População no teto");
        // o resumo traz os urgentes primeiro
        Assert.All(PrecisaDeVoce.Resumo(l3, 2), x => Assert.Equal(PrecisaDeVoce.Urgente, x.Grupo));
    }

    // ---------------------------------------------------------------- gatilhos

    [Fact]
    public void Espionagem_aparece_ao_ver_um_espiao_ou_sofrer_o_primeiro_ataque()
    {
        var t = new MundoTeste();
        var a = t.NovoReino(); var b = t.NovoReino();
        var estado = Sistemas.Estado(a);
        Assert.False(estado[GatilhosRestantes.Espionagem]);
        Assert.False(estado[GatilhosRestantes.Defesas]);
        ReinoDePedra.Jogo.Exploracao.Avistamentos.Registrar(t.M, a.Id, t.M.Locais[a.CasteloId].Hex, "espiao", "Espião visto");
        Assert.True(Sistemas.Visto(a, GatilhosRestantes.Espionagem));
        Assert.False(Sistemas.Visto(b, GatilhosRestantes.Espionagem));

        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 15)), 100);
        Assert.False(Sistemas.Visto(s.Def, GatilhosRestantes.Espionagem));
        s.Terminar(s.Chegar(s.Atacar(alvo, G(("arqueiro", 30)))));
        Assert.True(Sistemas.Visto(s.Def, GatilhosRestantes.Espionagem));
    }

    [Fact]
    public void Torres_aparecem_ao_ver_forcas_desconhecidas_perto_do_reino()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 2)), 50, dist: 6);
        Assert.False(Sistemas.Visto(s.Def, GatilhosRestantes.Defesas));
        var ex = s.Atacar(alvo, G(("arqueiro", 10)));
        var ev = s.M.Eventos.OfType<GatilhoDefesasEvento>().Single(e => e.ReinoId == s.Def.Id);
        Assert.True(ev.Quando > ex.Partida);
        s.AvancarAte(ev.Quando - 1);
        Assert.False(Sistemas.Visto(s.Def, GatilhosRestantes.Defesas));
        s.AvancarAte(ev.Quando);
        Assert.True(Sistemas.Visto(s.Def, GatilhosRestantes.Defesas));
        Assert.Contains(s.M.Notificacoes, n => n.ReinoId == s.Def.Id && n.Titulo == "Novo: Torres de arqueiros");
    }
}
