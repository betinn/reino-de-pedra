using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Forja;
using ReinoDePedra.Jogo.IA;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using ReinoDePedra.Jogo.Temporada;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Testes;

/// <summary>Regras que a revisão encontrou quebradas: criação em vaga ocupada, reforço aliado, filas, reset, população.</summary>
public class RegrasRevisaoTestes
{
    public RegrasRevisaoTestes() => AjustesTeste.Garantir();

    private static Dictionary<string, int> G(params (string k, int n)[] g) => g.ToDictionary(x => x.k, x => x.n);
    private static void Conhecer(Mundo m, Reino a, Reino b) { Conhecimento.Conhecer(m, a, b, "teste"); Conhecimento.Conhecer(m, b, a, "teste"); }
    private static void AvancarAte(MundoTeste t, long instante) { t.Avancar(TimeSpan.FromMilliseconds(Math.Max(0, instante - t.M.Agora))); AjustesTeste.FalharSeErro(); }

    private static void Aliar(MundoTeste t, Reino lider, Reino outro)
    {
        var a = Aliancas.Criar(t.M, lider, "Liga " + lider.Id);
        Conhecer(t.M, lider, outro);
        Aliancas.Convidar(t.M, lider, outro.Id);
        Aliancas.AceitarConvite(t.M, outro, a.Id);
    }

    // ---------------------------------------------------------------- criação de reino

    [Fact]
    public void Reino_novo_nao_apaga_locais_de_outro_reino_nos_hexagonos_da_vaga()
    {
        var t = new MundoTeste();
        var a = t.NovoReino(); var b = t.NovoReino();
        Assert.Equal(0, a.Vaga);
        // b ocupa a vila inicial de a e põe tropas; a sai da vaga (exílio) e deixa os outros locais
        var vila = t.M.LocaisDe(a.Id).First(l => l.Tipo == TipoLocal.Vila);
        Efeitos.Ocupar(t.M, vila, b);
        vila.Guarnicao["lanceiro"] = 20;
        foreach (var l in t.M.LocaisDe(a.Id).Where(l => l.Id != vila.Id).ToList()) { l.Ruina = true; t.M.MudarDono(l, 0); }
        a.Vaga = t.M.Mapa.Vagas.Count - 1;
        // b funda um local num hexágono da vaga 2, ainda vazia
        var v2 = t.M.Mapa.Vagas[2];
        var fundado = t.M.AdicionarLocal(new Local { ReinoId = b.Id, Tipo = TipoLocal.Vila, Produz = "comida", Hex = v2.Comida, Nivel = 1, Nome = "Vila do Vau" });
        // uma ruína sem dono com relíquia guardada na vaga 3 também não pode sumir
        var v3 = t.M.Mapa.Vagas[3];
        var ruina = t.M.AdicionarLocal(new Local { ReinoId = 0, Ruina = true, Tipo = TipoLocal.Vila, Produz = "comida", Hex = v3.Comida, Nivel = 1, Nome = "Ruína" });
        var rel = t.M.Reliquias.Adicionar(new Reliquia { Nome = "Cálice", Tipo = "producao", LocalId = ruina.Id });

        var c = t.NovoReino();
        Assert.NotEqual(0, c.Vaga);
        Assert.NotEqual(2, c.Vaga);
        Assert.NotEqual(3, c.Vaga);
        Assert.Same(vila, t.M.Locais.Obter(vila.Id));
        Assert.Equal(b.Id, vila.ReinoId);
        Assert.Equal(20, vila.Guarnicao["lanceiro"]);
        Assert.Same(fundado, t.M.Locais.Obter(fundado.Id));
        Assert.Same(ruina, t.M.Locais.Obter(ruina.Id));
        Assert.Equal(ruina.Id, rel.LocalId);
        Assert.False(CriacaoReino.VagaUtilizavel(t.M, t.M.Mapa.Vagas[0]));
        Assert.Throws<RegraException>(() => CriacaoReino.Criar(t.M, 9998, "Lumiar", new Brasao(), 0));
        Assert.Same(vila, t.M.Locais.Obter(vila.Id));
        foreach (var regiao in Regioes.Nomes.Keys) Assert.DoesNotContain(CriacaoReino.VagaPerto(t.M, regiao), new[] { 0, 2, 3 });
        // a vaga com só ruínas sem dono (e sem relíquia) volta a servir: as ruínas dão lugar
        vila.Ruina = true; vila.Guarnicao.Clear(); t.M.MudarDono(vila, 0);
        Assert.True(CriacaoReino.VagaUtilizavel(t.M, t.M.Mapa.Vagas[0]));
        var d = CriacaoReino.Criar(t.M, 9999, "Lumiar", new Brasao(), 0);
        Assert.Equal(d.Id, t.M.LocalNoHex(t.M.Mapa.Vagas[0].Comida)!.ReinoId);
    }

    [Fact]
    public void Todas_as_vagas_de_um_mundo_novo_servem()
    {
        foreach (var semente in new ulong[] { 7, 42, 99 })
        {
            var t = new MundoTeste(semente, fauna: true);
            Assert.All(t.M.Mapa.Vagas, v => Assert.True(CriacaoReino.VagaUtilizavel(t.M, v)));
        }
    }

    [Fact]
    public void Abdicacao_para_jogador_nao_escolhe_vaga_que_o_jogador_nao_pode_usar()
    {
        var t = MundoIA.Novo(criar: false);
        var j = MundoIA.Jogador(t, 0);
        var ia = MundoIA.Criar(t, "defensivo");
        // um jogador tem um local num hexágono da vaga da IA: a vaga dela não serve
        var v = t.M.Mapa.Vagas[ia.Vaga];
        var vila = t.M.LocalNoHex(v.Comida)!;
        Efeitos.Ocupar(t.M, vila, j);
        Assert.Equal(-1, Ocupacao.LiberarVaga(t.M));
        Assert.True(ia.Ativo);
    }

    // ---------------------------------------------------------------- reforço aliado

    [Fact]
    public void Reforco_aliado_com_carga_nao_descarrega_no_local_do_aliado()
    {
        var t = new MundoTeste();
        var a = t.NovoReino(); var b = t.NovoReino();
        Aliar(t, a, b);
        var ca = t.M.Locais[a.CasteloId]; var cb = t.M.Locais[b.CasteloId];
        ca.Guarnicao["lanceiro"] = 10;
        var ouroAntes = cb.Estoque.Qtd("ouro");
        // a ordem dada a um exército com carga é recusada
        var ex = Exercitos.Enviar(t.M, a, ca.Id, G(("lanceiro", 6)), t.M.LocaisDe(a.Id).First(l => l.Id != ca.Id).Hex, OrdemMover.Id);
        ex.Carga.Somar("ouro", 500);
        Assert.Throws<RegraException>(() => Exercitos.DarOrdem(t.M, a, ex.Id, OrdemReforcar.Id, cb.Hex));
        // a carga que aparece no caminho (interceptação vencida) também não fica com o aliado: o reforço volta com ela
        ex.Carga = new();
        Exercitos.DarOrdem(t.M, a, ex.Id, OrdemReforcar.Id, cb.Hex);
        ex.Carga.Somar("ouro", 500);
        AvancarAte(t, ex.Chegada);
        Assert.Equal(ouroAntes, cb.Estoque.Qtd("ouro"));
        Assert.Empty(cb.ReforcosAliados);
        Assert.True(t.M.Marchas.ContemId(ex.Id));
        Assert.True(ex.Retornando);
        Assert.Equal(500, ex.Carga.Qtd("ouro"));
    }

    [Fact]
    public void Feridos_do_reforco_aliado_voltam_ao_reino_de_quem_mandou()
    {
        var s = new CombateCenario();
        var t = s.T;
        var aliado = t.NovoReino(); aliado.EscudoAte = 0;
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 20)), 50);
        Aliar(t, s.Def, aliado);
        var cal = t.M.Locais[aliado.CasteloId];
        cal.Guarnicao["lanceiro"] = 20;
        var re = Exercitos.Enviar(t.M, aliado, cal.Id, G(("lanceiro", 20)), alvo.Hex, OrdemReforcar.Id);
        AvancarAte(t, re.Chegada);
        var b = s.Chegar(s.Atacar(alvo, G(("lanceiro", 30))));
        s.Terminar(b);
        var rc = AjustesTeste.De(t.M).Fins.Last();
        Assert.False(rc.AtacanteVenceu);
        var perdas = rc.PerdasDefesa.GetValueOrDefault("lanceiro");
        var perdasAliado = 20 - (alvo.ReforcosAliados.FirstOrDefault()?.Tropas.GetValueOrDefault("lanceiro") ?? 0);
        Assert.True(perdasAliado >= 4);
        var proprias = G(("lanceiro", perdas - perdasAliado));
        Assert.Equal(Combates.Feridos(t.M, proprias).Values.Sum(), Feridos.Total(s.Def));
        Assert.Equal(Combates.Feridos(t.M, G(("lanceiro", perdasAliado))).Values.Sum(), Feridos.Total(aliado));
        Assert.True(Feridos.Total(aliado) > 0);
    }

    // ---------------------------------------------------------------- postura com reforço e lendário

    /// <summary>Exército do defensor que passa a 1 hexágono do castelo atacante, que está em "atacar qualquer ameaça".</summary>
    private static (CombateCenario s, Exercito alvo, int hexEncontro) Passagem()
    {
        var s = new CombateCenario();
        var mina = s.Alvo(TipoLocal.Mina, G(("lanceiro", 10)), 0);
        var c = s.CasteloAtk;
        s.Guarnecer(c, G(("cavalaria", 30)));
        c.Postura = Postura.AtacarQualquer;
        foreach (var d in s.M.G.Area(c.Hex, 4).Where(h => s.M.G.Distancia(h, c.Hex) >= 3 && Obras.HexLivre(s.M, h) && !s.M.Mapa.Rio[h]))
        {
            var rota = Caminhos.Calcular(s.M, mina.Hex, d, "Lenta");
            var i = rota.Hexes.ToList().FindIndex(h => s.M.G.Distancia(h, c.Hex) <= 1);
            if (rota.Hexes[^1] != d || i < 1 || i >= rota.Hexes.Count - 1) continue;
            var alvo = Exercitos.Enviar(s.M, s.Def, mina.Id, G(("lanceiro", 10)), d, OrdemMover.Id);
            return (s, alvo, rota.Hexes[i]);
        }
        throw new Exception("sem caminho de teste");
    }

    [Fact]
    public void Guarnicao_em_postura_nao_sai_com_as_tropas_do_reforco_aliado()
    {
        var (s, alvo, h) = Passagem();
        var c = s.CasteloAtk;
        var aliado = s.T.NovoReino();
        c.Guarnicao["cavalaria"] += 20;
        c.ReforcosAliados.Add(new ReforcoAliado { ReinoId = aliado.Id, OrigemLocalId = aliado.CasteloId, Tropas = G(("cavalaria", 20)), Desde = s.M.Agora });
        s.AvancarAte(alvo.Tempos[alvo.Caminho.IndexOf(h)]);
        var rc = AjustesTeste.De(s.M).Fins.Last();
        Assert.Equal(30, rc.TropasAtaque.GetValueOrDefault("cavalaria"));   // só as tropas do dono saem
        Assert.Equal(20, c.ReforcosAliados.Single().Tropas["cavalaria"]);
        Assert.True(c.Guarnicao["cavalaria"] >= 20);
        Assert.Equal(c.Guarnicao["cavalaria"] - 20, GT.Livres(s.M, c, "cavalaria"));
    }

    [Fact]
    public void Lendario_tomado_pela_guarnicao_em_postura_fica_no_local()
    {
        var (s, alvo, h) = Passagem();
        var eq = s.M.Lendarios.Adicionar(new EquipamentoLendario { DonoId = s.Def.Id, ForjadoPor = s.Def.Id, Tipo = Ferrarias.Defesa, Nome = "Égide", MarchaId = alvo.Id });
        s.AvancarAte(alvo.Tempos[alvo.Caminho.IndexOf(h)]);
        Assert.False(s.M.Marchas.ContemId(alvo.Id));
        Lendarios.Conferir(s.M);
        Assert.Same(eq, s.M.Lendarios.Obter(eq.Id));
        Assert.Equal(s.CasteloAtk.Id, eq.LocalId);
        Assert.Null(eq.MarchaId);
        Assert.Equal(s.Atk.Id, eq.DonoId);
    }

    // ---------------------------------------------------------------- obras

    /// <summary>Castelo no nível 5 e uma vila no 4 com a melhoria para o 5 na fila, já com o material (tirado da vila).</summary>
    private static (MundoTeste t, Reino r, Local castelo, Local vila, ItemFila item) VilaSubindo()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var castelo = t.M.Locais[r.CasteloId];
        var vila = t.M.LocaisDe(r.Id).First(l => l.Tipo == TipoLocal.Vila);
        castelo.Nivel = 5; vila.Nivel = 4;
        Economia.Atualizar(t.M, r);
        foreach (var k in new[] { "madeira", "pedra", "ferro", "comida" }) vila.Estoque.Somar(k, 1e5);
        var it = Obras.Melhorar(t.M, r, vila.Id);
        Assert.Equal(5, it.NivelAlvo);
        Assert.True(it.MaterialCompleto);
        return (t, r, castelo, vila, it);
    }

    [Fact]
    public void Melhoria_na_fila_nao_desfaz_a_sabotagem_nem_passa_do_castelo()
    {
        var (t, r, castelo, vila, it) = VilaSubindo();
        vila.Nivel = 1; castelo.Nivel = 2;   // sabotagem na vila e no castelo
        AvancarAte(t, it.Fim!.Value);
        Assert.Equal(2, vila.Nivel);         // sobe um nível (o item não devolve os níveis sabotados)
        Assert.True(vila.Nivel <= castelo.Nivel);
    }

    [Fact]
    public void Melhoria_que_passaria_do_castelo_sabotado_nao_sobe_e_o_material_fica_no_local()
    {
        var (t, r, castelo, vila, it) = VilaSubindo();
        castelo.Nivel = 2;                   // sabotagem no castelo
        Economia.Atualizar(t.M, r);
        var madeira = vila.Estoque.Qtd("madeira");
        AvancarAte(t, it.Fim!.Value);
        Assert.Equal(4, vila.Nivel);
        Assert.True(vila.Estoque.Qtd("madeira") >= madeira + it.Custo.Qtd("madeira") - 1e-6);
    }

    [Fact]
    public void Material_de_obra_em_local_perdido_volta_ao_castelo_e_nao_ao_novo_dono()
    {
        var (t, r, castelo, vila, it) = VilaSubindo();
        var inimigo = t.NovoReino();
        Efeitos.Ocupar(t.M, vila, inimigo);
        vila.Estoque = new();
        Economia.Atualizar(t.M, r);
        var noCastelo = castelo.Estoque.Qtd("madeira");
        Filas.Cancelar(t.M, r, Obras.Fila, it.Id);
        Assert.Equal(0, vila.Estoque.Qtd("madeira"), 6);
        Assert.Equal(noCastelo + it.Custo.Qtd("madeira"), castelo.Estoque.Qtd("madeira"), 6);

        // sem cancelar: a obra termina sem efeito e o material também volta ao castelo
        var (t2, r2, castelo2, vila2, it2) = VilaSubindo();
        Efeitos.Ocupar(t2.M, vila2, t2.NovoReino());
        vila2.Estoque = new();
        Economia.Atualizar(t2.M, r2);
        var antes = castelo2.Estoque.Qtd("madeira");
        AvancarAte(t2, it2.Fim!.Value);
        Assert.Equal(4, vila2.Nivel);
        Assert.Equal(0, vila2.Estoque.Qtd("madeira"), 6);
        Assert.True(castelo2.Estoque.Qtd("madeira") >= antes + it2.Custo.Qtd("madeira") - 1e-6);
    }

    // ---------------------------------------------------------------- filas

    [Fact]
    public void Cancelar_em_fila_que_nao_existe_nao_cria_a_fila()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var nome = new string('x', 3000);
        var e = Assert.Throws<RegraException>(() => Filas.Cancelar(t.M, r, nome, 1));
        Assert.Equal(404, e.Status);
        Assert.False(r.Filas.ContainsKey(nome));
        Filas.MaterialChegou(t.M, r, "outra", 1, new Recursos());
        Filas.Concluir(t.M, r, "mais-uma", 1);
        Logistica.Repor(t.M, r, "e-outra", 1, new Recursos());
        Assert.Empty(r.Filas);
    }

    // ---------------------------------------------------------------- exílio

    [Fact]
    public void Exilio_nao_devolve_o_material_das_obras_nem_os_veiculos_do_castelo_caido()
    {
        var t = new MundoTeste();
        var r = t.NovoReino(); var atk = t.NovoReino();
        foreach (var l in t.M.LocaisDe(r.Id).Where(l => l.Id != r.CasteloId).ToList()) t.M.RemoverLocal(l);
        var castelo = t.M.Locais[r.CasteloId];
        castelo.Nivel = 6;
        t.DarRecursos(r);
        var it = Obras.Melhorar(t.M, r, castelo.Id);
        Assert.True(it.MaterialCompleto);
        r.Veiculos["carroca"] = 3;
        r.ExploradoresLivres["pe"] = 2;
        r.MensageirosLivres = 1;
        Quedas.CairCastelo(t.M, r, new Exercito { ReinoId = atk.Id }, castelo);
        var q = r.UltimaQueda!;
        Assert.True(q.Exilio);
        var novo = t.M.Locais[r.CasteloId];
        var kit = t.M.P.Guerra.Exilio.Kit;
        foreach (var (k, v) in kit) Assert.Equal(v, novo.Estoque.Qtd(k), 6);
        Assert.Equal(0, novo.Estoque.Qtd("ouro"), 6);
        Assert.Empty(r.Veiculos);
        Assert.Empty(r.ExploradoresLivres);
        Assert.Equal(0, r.MensageirosLivres);
        Assert.True(q.RecursosPerdidos.GetValueOrDefault("madeira") >= it.Custo.Qtd("madeira") - 1e-6);
    }
}
