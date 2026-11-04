using System.Text.Json.Nodes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Pessoas;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Testes;

/// <summary>Soldados, exploradores, mensageiros e feridos como pessoas (plano de pessoas no mapa, fase 3).</summary>
public class SoldadosTestes
{
    private static Dictionary<string, int> G(params (string k, int n)[] x) => x.ToDictionary(p => p.k, p => p.n);

    private static int HexLivrePerto(MundoTeste t, Local l) =>
        t.M.G.Area(l.Hex, 4).First(h => h != l.Hex && !t.M.Mapa.Rio[h] && t.M.LocalNoHex(h) == null);

    [Fact]
    public void Exercito_leva_pessoas_os_veteranos_primeiro_e_as_devolve_a_guarnicao()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = t.M.Locais[r.CasteloId];
        var soldados = Pessoas.CriarSoldados(t.M, r, c, G(("lanceiro", 4), ("arqueiro", 2)));
        Assert.Equal(6, GT.Total(c.Guarnicao));
        Assert.Equal(6, Pessoas.Guarnicao(t.M, c).Count());
        soldados[0].Marcas = 3; soldados[1].Marcas = 1;   // dois lanceiros veteranos
        var ex = Exercitos.Enviar(t.M, r, c.Id, G(("lanceiro", 2)), HexLivrePerto(t, c), OrdemMover.Id);
        Assert.Equal(2, ex.PessoaIds.Count);
        Assert.Contains(soldados[0].Id, ex.PessoaIds);
        Assert.Contains(soldados[1].Id, ex.PessoaIds);
        Assert.All(Pessoas.DaMarcha(t.M, ex), p => { Assert.Equal(Estados.Marchando, p.Estado); Assert.Equal(ex.Id, p.GrupoId); });
        Assert.Equal(G(("lanceiro", 2), ("arqueiro", 2)), c.Guarnicao);
        Assert.Equal(2, Veterania.DaMarcha(t.M, ex), 6);
        Assert.Empty(Pessoas.Conferir(t.M));
        t.AvancarHoras(1);
        Exercitos.Retornar(t.M, ex);
        t.AvancarHoras(1);
        Assert.False(t.M.Marchas.ContemId(ex.Id));
        Assert.Equal(6, GT.Total(c.Guarnicao));
        Assert.Equal(Estados.Guarnecida, soldados[0].Estado);
        Assert.Equal(c.Id, soldados[0].LocalId);
        Assert.Empty(Pessoas.Conferir(t.M));
    }

    [Fact]
    public void Envio_por_ids_leva_exatamente_as_pessoas_escolhidas()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = t.M.Locais[r.CasteloId];
        var soldados = Pessoas.CriarSoldados(t.M, r, c, G(("lanceiro", 4)));
        soldados[0].Marcas = 5;   // o veterano ficaria na frente, mas a escolha manda
        var ids = new[] { soldados[2].Id, soldados[3].Id };
        Exercito ex;
        using (var esc = Pessoas.Escolher(t.M, r, c, ids))
        {
            Assert.Equal(G(("lanceiro", 2)), esc.Grupo);
            ex = Exercitos.Enviar(t.M, r, c.Id, esc.Grupo, HexLivrePerto(t, c), OrdemMover.Id);
        }
        Assert.Equal(ids.OrderBy(x => x), ex.PessoaIds.OrderBy(x => x));
        Assert.Equal(Estados.Guarnecida, soldados[0].Estado);
        Assert.Null(soldados[0].GrupoId);
        // ids de outro local, de civil ou de outro reino: recusa
        var civil = Pessoas.Civis(t.M, r.Id).First();
        Assert.Throws<RegraException>(() => Pessoas.Escolher(t.M, r, c, [civil.Id]));
        Assert.Throws<RegraException>(() => Pessoas.Escolher(t.M, r, c, [soldados[2].Id]));   // já saiu
        var outro = t.NovoReino();
        Assert.Throws<RegraException>(() => Pessoas.Escolher(t.M, outro, t.M.Locais[outro.CasteloId], [soldados[0].Id]));
    }

    [Fact]
    public void Batalha_mata_pessoas_com_nome_e_os_feridos_sao_pessoas_que_voltam_curadas()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 8)), 6);
        var ex = s.Atacar(alvo, G(("arqueiro", 16)), CombateCenario.Plano("saque", "semLimite"));
        var nomes = Pessoas.DaMarcha(s.M, ex).Select(p => p.Nome).ToHashSet();
        Assert.Equal(16, nomes.Count);
        var b = s.Chegar(ex);
        s.Terminar(b);
        Assert.Equal("vitoria", b.Resultado);
        var perdas = GT.Total(b.PerdasAtaque);
        var feridos = (int)Jogo.Config.Formulas.ArredJs(perdas * s.M.P.Feridos.Frac);
        Assert.Equal(perdas - feridos, b.MortosAtaque.Count);
        Assert.All(b.MortosAtaque, n => Assert.Contains(n, nomes));
        Assert.Equal(8, b.MortosDefesa.Count);   // a defesa caiu inteira, sem feridos
        Assert.Equal(16 - perdas, ex.PessoaIds.Count);
        Assert.Equal(16 - perdas, GT.Total(ex.Tropas));
        var lote = Assert.Single(s.Atk.Feridos);
        Assert.Equal(feridos, lote.PessoaIds.Count);
        var feridas = Feridos.Do(s.M, lote).ToList();
        Assert.All(feridas, p => { Assert.Equal(Estados.Ferida, p.Estado); Assert.Equal(s.Atk.CasteloId, p.LocalId); Assert.Contains(p.Nome, nomes); });
        Assert.Equal(feridos, Economia.Tropas(s.M, s.Atk) - GT.Total(s.CasteloAtk.Guarnicao) - GT.Total(ex.Tropas));
        Assert.Empty(Pessoas.Conferir(s.M));
        // cura: as mesmas pessoas voltam à guarnição do castelo
        s.T.DarRecursos(s.Atk, 1000, "ervas");
        var item = Feridos.Curar(s.M, s.Atk);
        Assert.All(feridas, p => Assert.Equal(item.Id, p.ItemId));
        s.T.AvancarHoras(s.M.P.Feridos.CuraH + 1);
        Assert.All(feridas, p => { Assert.Equal(Estados.Guarnecida, p.Estado); Assert.Equal(s.Atk.CasteloId, p.LocalId); });
        Assert.Empty(s.Atk.Feridos);
        Assert.Empty(Pessoas.Conferir(s.M));
    }

    [Fact]
    public void Feridos_sem_ervas_morrem_com_nome()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var lote = Feridos.Adicionar(t.M, r, G(("lanceiro", 2)), "teste")!;
        Assert.Equal(2, lote.PessoaIds.Count);
        var nomes = Feridos.Do(t.M, lote).Select(p => p.Nome).ToList();
        t.AvancarHoras(t.B.P.Feridos.EsperaH + 1);
        Assert.Empty(r.Feridos);
        Assert.All(lote.PessoaIds, id => Assert.False(t.M.Pessoas.ContemId(id)));
        var n = t.M.Notificacoes.Single(x => x.ReinoId == r.Id && x.Titulo == "Feridos morreram");
        Assert.Contains(nomes[0], n.Texto);
    }

    [Fact]
    public void Explorador_e_mensageiro_sao_pessoas_que_saem_e_voltam_livres()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = t.M.Locais[r.CasteloId];
        t.DarRecursos(r);
        var pop = r.Pop;
        var item = Exploradores.Treinar(t.M, r, "pe", 1);
        var pessoa = Pessoas.EmTreino(t.M, r, item).Single();
        Assert.Equal("explorador-pe", pessoa.Oficio);
        Assert.Equal(pop - 1, r.Pop);
        t.AvancarMin(item.DuracaoSeg / 60 + 1);
        Assert.Equal(Estados.Guarnecida, pessoa.Estado);
        Assert.Equal(1, r.ExploradoresLivres["pe"]);
        Assert.True(Oficios.Nome(pessoa) is "Explorador" or "Exploradora");
        var e = Exploradores.Enviar(t.M, r, "pe", Exploradores.Explorar, HexLivrePerto(t, c));
        Assert.Equal(pessoa.Id, e.PessoaId);
        Assert.Contains(pessoa.Id, e.PessoaIds);
        Assert.Equal(Estados.Marchando, pessoa.Estado);
        Assert.False(r.ExploradoresLivres.ContainsKey("pe"));
        Assert.Throws<RegraException>(() => Exploradores.Enviar(t.M, r, "pe", Exploradores.Explorar, HexLivrePerto(t, c)));
        t.AvancarHoras(3);
        Assert.False(t.M.Marchas.ContemId(e.Id));
        Assert.Equal(Estados.Guarnecida, pessoa.Estado);
        Assert.Equal(1, r.ExploradoresLivres["pe"]);
        // mensageiro
        var outro = t.NovoReino();
        Nevoas.RevelarArea(t.M, r.Id, t.M.Locais[outro.CasteloId].Hex, 0);
        var im = Mensageiros.Treinar(t.M, r, 1);
        var men = Pessoas.EmTreino(t.M, r, im).Single();
        t.AvancarMin(im.DuracaoSeg / 60 + 1);
        Assert.Equal(1, r.MensageirosLivres);
        var msg = Mensageiros.Enviar(t.M, r, "Olá", null, outro.CasteloId);
        var mc = (Mensageiro)t.M.Marchas[msg.MarchaId!.Value];
        Assert.Equal(men.Id, mc.PessoaId);
        Assert.Equal(0, r.MensageirosLivres);
        t.AvancarHoras(6);
        Assert.Equal(1, r.MensageirosLivres);
        Assert.Equal(Estados.Guarnecida, men.Estado);
        Assert.Empty(Pessoas.Conferir(t.M));
    }

    [Fact]
    public void Explorador_capturado_tem_nome_e_volta_para_casa_ao_ser_libertado()
    {
        var t = new MundoTeste();
        var a = t.NovoReino(); var b = t.NovoReino();
        var cb = t.M.Locais[b.CasteloId];
        Pessoas.CriarSoldados(t.M, b, cb, G(("lanceiro", 45)));
        a.ExploradoresLivres["pe"] = 1;
        Pessoas.SincronizarLivres(t.M, a);
        var pessoa = m_Livre(t, a, "explorador-pe");
        t.M.Sorte = Sorte(x => x < 0.1);
        var perto = t.M.G.Area(cb.Hex, 2).First(h => h != cb.Hex && !t.M.Mapa.Rio[h] && t.M.LocalNoHex(h) == null);
        var e = Exploradores.Enviar(t.M, a, "pe", Exploradores.Explorar, perto);
        Assert.Equal(pessoa.Id, e.PessoaId);
        t.AvancarHoras(10);
        var p1 = Assert.Single(t.M.Prisioneiros);
        Assert.Equal(pessoa.Id, p1.PessoaId);
        Assert.Equal(pessoa.Nome, p1.Nome);
        Assert.Equal(Estados.Capturada, pessoa.Estado);
        Assert.Equal(0, Economia.Tropas(t.M, a) - Exploradores.Ocupantes(t.M, a));
        Assert.Contains(t.M.Relatorios, x => x.ReinoId == b.Id && x.Dados["nome"]?.GetValue<string>() == pessoa.Nome);
        Capturas.Decidir(t.M, b, p1.Id, "libertar");
        Assert.Equal(Estados.Marchando, pessoa.Estado);
        t.AvancarHoras(10);
        Assert.Equal(Estados.Guarnecida, pessoa.Estado);
        Assert.Equal(1, a.ExploradoresLivres["pe"]);
        Assert.Empty(Pessoas.Conferir(t.M));
    }

    private static Pessoa m_Livre(MundoTeste t, Reino r, string oficio) =>
        t.M.PessoasDe(r.Id).Single(p => p.Oficio == oficio && p.Estado == Estados.Guarnecida);

    /// <summary>Semente cujos primeiros sorteios cumprem as condições (captura sorteia "abaixo da chance").</summary>
    private static Rng Sorte(params Func<double, bool>[] condicoes)
    {
        for (ulong s = 1; ; s++)
        {
            var r = new Rng(s);
            if (condicoes.All(c => c(r.Real()))) return new Rng(s);
        }
    }

    [Fact]
    public void Fauna_mata_soldados_com_nome()
    {
        var t = new MundoTeste(fauna: true);
        var r = t.NovoReino();
        var c = t.M.Locais[r.CasteloId];
        var soldados = Pessoas.CriarSoldados(t.M, r, c, G(("lanceiro", 4)));
        var ex = Exercitos.Enviar(t.M, r, c.Id, G(("lanceiro", 4)), HexLivrePerto(t, c), OrdemMover.Id);
        var perda = ex.SofrerFauna(t.M, 0.5);
        Assert.Equal(2, GT.Total(perda.Mortos));
        Assert.Equal(2, perda.Nomes!.Count);
        Assert.All(perda.Nomes, n => Assert.Contains(n, soldados.Select(p => p.Nome)));
        Assert.Equal(2, ex.PessoaIds.Count);
        Assert.Equal(2, GT.Total(ex.Tropas));
        Assert.Equal(2, soldados.Count(p => t.M.Pessoas.ContemId(p.Id)));
    }

    [Fact]
    public void Dias_de_jogo_com_IA_mantem_as_contagens_iguais_as_pessoas()
    {
        var t = new MundoTeste(fauna: true);
        t.M.IA.Ativa = true; t.M.IA.CriarReinos = true;
        ReinoDePedra.Jogo.IA.SistemaIA.AoIniciar(t.M);
        ReinoDePedra.Jogo.IA.Ocupacao.Completar(t.M);
        var r = t.NovoReino();
        t.DarRecursos(r);
        var c = t.M.Locais[r.CasteloId];
        Recrutamento.Recrutar(t.M, r, c.Id, "lanceiro", 3);
        for (var h = 0; h < 48; h++)
        {
            t.AvancarHoras(1);
            var erros = Pessoas.Conferir(t.M);
            Assert.True(erros.Count == 0, "hora " + h + ": " + string.Join(" | ", erros));
        }
        Assert.True(t.M.Pessoas.Count > 100);
        Assert.True(t.M.Reinos.Where(x => x.Ativo).All(x => Pessoas.Civis(t.M, x.Id).Count() == x.Pop));
    }
}
