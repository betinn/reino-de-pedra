using System.Text.Json.Nodes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Persistencia;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Testes;

public class TropasTestes
{
    private static Local Castelo(MundoTeste t, Reino r) => t.M.Locais[r.CasteloId];

    /// <summary>Hexágono livre (sem local, jazida ou ruína), fora do rio, a exatamente <paramref name="dist"/> do castelo.</summary>
    private static int HexLivre(MundoTeste t, Reino r, int dist, int pular = 0) =>
        t.M.G.Area(Castelo(t, r).Hex, dist).Where(h => t.M.G.Distancia(h, Castelo(t, r).Hex) == dist && Obras.HexLivre(t.M, h) && !t.M.Mapa.Rio[h]).Skip(pular).First();

    private static Local Quartel(MundoTeste t, Reino r)
    {
        var q = t.M.AdicionarLocal(new Local { ReinoId = r.Id, Tipo = TipoLocal.Quartel, Hex = HexLivre(t, r, 2), Nivel = 1, Nome = "Quartel do Teste" });
        return q;
    }

    /// <summary>Põe tropas na guarnição tirando da população civil (como se tivessem sido recrutadas).</summary>
    private static void Guarnecer(MundoTeste t, Reino r, Local l, string unidade, int n)
    {
        Economia.Atualizar(t.M, r);
        l.Guarnicao[unidade] = l.Guarnicao.GetValueOrDefault(unidade) + n;
        r.Pop -= t.B.U[unidade].Pop * n;
        t.M.Sujar(l); t.M.Sujar(r);
    }

    private static void AvancarAte(MundoTeste t, long instante) => t.Avancar(TimeSpan.FromMilliseconds(Math.Max(0, instante - t.M.Agora)));

    // ---------------------------------------------------------------- recrutamento

    [Fact]
    public void Recrutar_no_castelo_custa_tempo_e_populacao_e_entra_na_guarnicao()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        var u = t.B.U["lanceiro"];
        var antes = c.Estoque.Copia();
        var pop0 = r.Pop;
        var item = Recrutamento.Recrutar(t.M, r, c.Id, "lanceiro", 10);
        Assert.Equal(pop0 - 10, r.Pop, 6);
        Assert.Equal(u.Tempo * 10, item.DuracaoSeg);
        foreach (var (k, v) in u.Custo) Assert.Equal(antes.Qtd(k) - v * 10, c.Estoque.Qtd(k), 6);
        Assert.True(item.Iniciado);   // o castelo já tinha o material
        Assert.Equal(10, Economia.Tropas(t.M, r));   // em treino ocupam o teto
        t.Avancar(TimeSpan.FromSeconds(u.Tempo * 10 - 5));
        Assert.Equal(9, c.Guarnicao.GetValueOrDefault("lanceiro"));   // uma por vez: a 10ª ainda não
        t.Avancar(TimeSpan.FromSeconds(10));
        Assert.Equal(10, c.Guarnicao["lanceiro"]);
        Assert.Empty(r.Fila(Recrutamento.Fila).Itens);
        Assert.Equal(10, Economia.Tropas(t.M, r));
    }

    [Fact]
    public void Cancelar_recrutamento_devolve_a_populacao()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var pop0 = r.Pop;
        var item = Recrutamento.Recrutar(t.M, r, r.CasteloId, "arqueiro", 5);
        Assert.Equal(pop0 - 5, r.Pop, 6);
        Filas.Cancelar(t.M, r, Recrutamento.Fila, item.Id);
        Assert.Equal(pop0, r.Pop, 6);
        Assert.Equal(0, Economia.Tropas(t.M, r));
    }

    [Fact]
    public void Recrutamento_entrega_uma_unidade_por_vez_e_ela_ja_pode_sair()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        t.DarRecursos(r);
        var c = Castelo(t, r);
        var u = t.B.U["lanceiro"];
        var item = Recrutamento.Recrutar(t.M, r, c.Id, "lanceiro", 5);
        Assert.Single(r.Fila(Recrutamento.Fila).Itens);   // o item continua único na fila
        Assert.Equal(item.Inicio + T.DeSegundos(u.Tempo), item.FimDaUnidade(1));
        for (var n = 1; n <= 4; n++)
        {
            AvancarAte(t, item.FimDaUnidade(n)!.Value - 1000);
            Assert.Equal(n - 1, c.Guarnicao.GetValueOrDefault("lanceiro"));
            AvancarAte(t, item.FimDaUnidade(n)!.Value);
            Assert.Equal(n, c.Guarnicao.GetValueOrDefault("lanceiro"));
            Assert.Equal(n, item.Prontos);
            Assert.Equal(5, Economia.Tropas(t.M, r));   // prontas + em treino: o teto não muda
        }
        // as prontas já saem enquanto a última treina
        Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 2 }, HexLivre(t, r, 2), OrdemMover.Id);
        Assert.Equal(2, c.Guarnicao["lanceiro"]);
        AvancarAte(t, item.Fim!.Value);
        Assert.Equal(3, c.Guarnicao["lanceiro"]);
        Assert.Empty(r.Fila(Recrutamento.Fila).Itens);
        Assert.Equal(5, Economia.Tropas(t.M, r));
        Assert.Single(t.M.Notificacoes, x => x.ReinoId == r.Id && x.Titulo == "Recrutamento concluído");
    }

    [Fact]
    public void Cancelar_no_meio_devolve_so_o_que_nao_ficou_pronto()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        t.DarRecursos(r);
        var c = Castelo(t, r);
        var u = t.B.U["lanceiro"];
        var item = Recrutamento.Recrutar(t.M, r, c.Id, "lanceiro", 5);
        AvancarAte(t, item.FimDaUnidade(2)!.Value + 1000);
        Assert.Equal(2, c.Guarnicao["lanceiro"]);
        Economia.Atualizar(t.M, r);
        var popAntes = r.Pop;
        var estoqueAntes = c.Estoque.Copia();
        Filas.Cancelar(t.M, r, Recrutamento.Fila, item.Id);
        Assert.Equal(2, c.Guarnicao["lanceiro"]);   // as prontas ficam
        Assert.Equal(popAntes + 3 * u.Pop, r.Pop, 6);   // só as 3 que faltavam voltam à população
        foreach (var (k, v) in u.Custo) Assert.Equal(estoqueAntes.Qtd(k) + v * 3, c.Estoque.Qtd(k), 3);   // material de 3
        Assert.Equal(2, Economia.Tropas(t.M, r));
        t.AvancarHoras(1);
        Assert.Equal(2, c.Guarnicao["lanceiro"]);   // nada chega depois de cancelar
    }

    [Fact]
    public void Fila_de_recrutamento_aceita_10_itens_um_por_vez()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        t.DarRecursos(r);
        for (var i = 0; i < 10; i++) Recrutamento.Recrutar(t.M, r, r.CasteloId, "milicia", 1);
        Assert.Throws<RegraException>(() => Recrutamento.Recrutar(t.M, r, r.CasteloId, "milicia", 1));
        var itens = r.Fila(Recrutamento.Fila).Itens;
        Assert.True(itens[0].Iniciado);
        Assert.All(itens.Skip(1), i => Assert.False(i.Iniciado));
        t.Avancar(TimeSpan.FromSeconds(t.B.U["milicia"].Tempo * 10 + 1));
        Assert.Equal(10, Castelo(t, r).Guarnicao["milicia"]);
    }

    [Fact]
    public void So_castelo_e_quartel_recrutam_e_o_castelo_so_as_basicas()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        t.DarRecursos(r);
        var vila = t.M.LocaisDe(r.Id).First(l => l.Tipo == TipoLocal.Vila);
        Assert.Contains("castelo e o quartel", Assert.Throws<RegraException>(() => Recrutamento.Recrutar(t.M, r, vila.Id, "lanceiro", 1)).Message);
        Assert.Contains("quartel", Assert.Throws<RegraException>(() => Recrutamento.Recrutar(t.M, r, r.CasteloId, "cavalaria", 1)).Message);
        foreach (var u in t.M.P.RecrutaCastelo) Recrutamento.Recrutar(t.M, r, r.CasteloId, u, 1);
        var q = Quartel(t, r);
        var item = Recrutamento.Recrutar(t.M, r, q.Id, "cavalaria", 2);
        Assert.Equal(q.Id, item.LocalId);
        Assert.False(item.MaterialCompleto);   // o quartel está vazio: o material vem por carregadores
        Assert.Contains(t.M.Marchas.OfType<Carregadores>(), c => c.ItemId == item.Id && c.Destino == q.Hex);
        var outro = t.NovoReino();
        Assert.Throws<RegraException>(() => Recrutamento.Recrutar(t.M, outro, q.Id, "lanceiro", 1));
    }

    [Fact]
    public void Unidade_com_requisito_fica_bloqueada_com_o_texto_do_requisito()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        t.DarRecursos(r, 1e6, "comida", "ferro", "couro", "cavalo", "madeira", "pedra");
        var q = Quartel(t, r);
        var elite = t.B.U["elite"];
        Assert.False(string.IsNullOrEmpty(elite.Req));
        Assert.Equal(elite.Req, Recrutamento.Bloqueio(t.M, r, elite));
        Assert.Equal(elite.Req, Assert.Throws<RegraException>(() => Recrutamento.Recrutar(t.M, r, q.Id, "elite", 1)).Message);
        Assert.Null(Recrutamento.Bloqueio(t.M, r, t.B.U["lanceiro"]));
    }

    [Fact]
    public void Sem_populacao_civil_livre_nao_recruta_e_nao_gasta()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        r.Pop = 3;
        var antes = c.Estoque.Qtd("comida");
        Assert.Contains("população", Assert.Throws<RegraException>(() => Recrutamento.Recrutar(t.M, r, c.Id, "milicia", 5)).Message);
        Assert.Equal(antes, c.Estoque.Qtd("comida"));
        Assert.Throws<RegraException>(() => Recrutamento.Recrutar(t.M, r, c.Id, "milicia", 0));
        Assert.Empty(r.Fila(Recrutamento.Fila).Itens);
    }

    [Fact]
    public void Tropas_em_treino_ocupam_o_teto_pela_populacao_da_unidade()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        t.DarRecursos(r);
        var q = Quartel(t, r);
        var pop0 = r.Pop;
        Recrutamento.Recrutar(t.M, r, q.Id, "ariete", 2);
        var p = t.B.U["ariete"].Pop * 2;
        Assert.Equal(pop0 - p, r.Pop, 6);
        Assert.Equal(p, Recrutamento.EmTreino(t.M, r));
        Assert.Equal(p, Economia.Tropas(t.M, r));
        // população civil + tropas nunca passa do teto: cresce só até o teto livre
        t.AvancarHoras(200);
        Economia.Atualizar(t.M, r);
        Assert.True(r.Pop + Economia.Tropas(t.M, r) <= Economia.Teto(t.M, r) + 1e-6);
    }

    // ---------------------------------------------------------------- exércitos

    [Fact]
    public void Mover_vai_na_velocidade_da_unidade_mais_lenta_e_fica_parado()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        Guarnecer(t, r, c, "lanceiro", 10);
        var destino = HexLivre(t, r, 5);
        var ex = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 6 }, destino, OrdemMover.Id);
        Assert.Equal("Lenta", ex.Vel);
        Assert.Equal(4, c.Guarnicao["lanceiro"]);
        Assert.Equal(Postura.AtacarQuemAtacar, ex.Postura);
        var esperado = Caminhos.Calcular(t.M, c.Hex, destino, "Lenta");
        Assert.Equal((long)Math.Round(esperado.TotalMin * T.Min), ex.Chegada - ex.Partida);
        Assert.Equal(10, Economia.Tropas(t.M, r));   // em marcha também ocupam o teto
        AvancarAte(t, ex.Chegada + 1);
        Assert.True(t.M.Marchas.ContemId(ex.Id));
        Assert.True(ex.Parado);
        Assert.Equal(destino, ex.HexEm(t.M.Agora));
        t.AvancarHoras(5);
        Assert.True(t.M.Marchas.ContemId(ex.Id));   // continua no mapa
        Assert.Equal(10, Economia.Tropas(t.M, r));
    }

    [Fact]
    public void Grupo_misto_anda_no_passo_do_mais_lento()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        Guarnecer(t, r, c, "cavalaria", 5);
        Guarnecer(t, r, c, "arqueiro", 5);
        Guarnecer(t, r, c, "lanceiro", 5);
        var destino = HexLivre(t, r, 6);
        var rapida = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["cavalaria"] = 5 }, destino, OrdemMover.Id);
        Assert.Equal("Rápida", rapida.Vel);
        var media = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["cavalaria"] = 0, ["arqueiro"] = 5 }, destino, OrdemMover.Id);
        Assert.Equal("Média", media.Vel);
        var lenta = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 5 }, destino, OrdemMover.Id);
        Assert.True(rapida.Chegada < media.Chegada && media.Chegada < lenta.Chegada);
        Assert.Equal(Tropas.Carga(t.M, rapida.Tropas), rapida.CargaMax(t.M));
        Assert.Equal(5 * t.B.U["cavalaria"].Carga, rapida.CargaMax(t.M));
    }

    [Fact]
    public void Voltar_leva_o_tempo_do_caminho_de_volta_e_descarrega_a_carga()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        Guarnecer(t, r, c, "lanceiro", 8);
        var destino = HexLivre(t, r, 4);
        var ex = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 8 }, destino, OrdemMover.Id);
        AvancarAte(t, ex.Chegada + 1);
        ex.Carga.Somar("ouro", 7);
        t.M.Sujar(ex);
        Exercitos.DarOrdem(t.M, r, ex.Id, OrdemRetornar.Id, null);
        Assert.True(ex.Retornando);
        var volta = Caminhos.Calcular(t.M, destino, c.Hex, "Lenta");
        Assert.Equal((long)Math.Round(volta.TotalMin * T.Min), ex.Chegada - ex.Partida);
        AvancarAte(t, ex.Chegada + 1);
        Assert.False(t.M.Marchas.ContemId(ex.Id));
        Assert.Equal(8, c.Guarnicao["lanceiro"]);
        Assert.Equal(7, c.Estoque.Qtd("ouro"), 6);
        Assert.Equal(8, Economia.Tropas(t.M, r));
    }

    [Fact]
    public void Voltar_no_meio_do_caminho_parte_de_onde_esta()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        Guarnecer(t, r, c, "lanceiro", 3);
        var ex = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 3 }, HexLivre(t, r, 6), OrdemMover.Id);
        AvancarAte(t, ex.Tempos[3] + 1);
        var aqui = ex.HexEm(t.M.Agora);
        ex.Retornar(t.M);
        Assert.Equal(aqui, ex.Caminho[0]);
        Assert.Equal(c.Hex, ex.Destino);
        AvancarAte(t, ex.Chegada + 1);
        Assert.Equal(3, c.Guarnicao["lanceiro"]);
    }

    [Fact]
    public void Origem_perdida_volta_ao_local_proprio_mais_proximo()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var vila = t.M.LocaisDe(r.Id).First(l => l.Tipo == TipoLocal.Vila);
        Guarnecer(t, r, vila, "lanceiro", 4);
        var ex = Exercitos.Enviar(t.M, r, vila.Id, new Dictionary<string, int> { ["lanceiro"] = 4 }, HexLivre(t, r, 5), OrdemMover.Id);
        AvancarAte(t, ex.Chegada + 1);
        t.M.MudarDono(vila, 0);
        ex.Retornar(t.M);
        Assert.NotEqual(vila.Id, ex.AlvoLocalId);
        var alvo = t.M.Locais[ex.AlvoLocalId!.Value];
        Assert.Equal(r.Id, alvo.ReinoId);
        AvancarAte(t, ex.Chegada + 1);
        Assert.Equal(4, alvo.Guarnicao["lanceiro"]);
        Assert.Equal(0, vila.Guarnicao.GetValueOrDefault("lanceiro"));
    }

    [Fact]
    public void Reforco_entra_na_guarnicao_do_local()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        var mina = t.M.LocaisDe(r.Id).First(l => l.Tipo == TipoLocal.Mina);
        Guarnecer(t, r, c, "arqueiro", 6);
        var ex = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["arqueiro"] = 6 }, mina.Hex, OrdemReforcar.Id);
        Assert.Equal(mina.Id, ex.AlvoLocalId);
        AvancarAte(t, ex.Chegada + 1);
        Assert.False(t.M.Marchas.ContemId(ex.Id));
        Assert.Equal(6, mina.Guarnicao["arqueiro"]);
        Assert.Equal(6, Economia.Tropas(t.M, r));
        // mover para um local seu também vira reforço
        Guarnecer(t, r, c, "lanceiro", 2);
        var ex2 = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 2 }, mina.Hex, OrdemMover.Id);
        AvancarAte(t, ex2.Chegada + 1);
        Assert.Equal(2, mina.Guarnicao["lanceiro"]);
        // reforço só para local seu
        Assert.Throws<RegraException>(() => Exercitos.Enviar(t.M, r, mina.Id, new Dictionary<string, int> { ["arqueiro"] = 1 }, HexLivre(t, r, 3), OrdemReforcar.Id));
    }

    [Fact]
    public void Envio_valida_tropas_destino_e_ordem()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var outro = t.NovoReino();
        var c = Castelo(t, r);
        Guarnecer(t, r, c, "lanceiro", 2);
        var d = HexLivre(t, r, 3);
        Assert.Throws<RegraException>(() => Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 3 }, d, OrdemMover.Id));
        Assert.Throws<RegraException>(() => Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int>(), d, OrdemMover.Id));
        Assert.Throws<RegraException>(() => Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["dragao"] = 1 }, d, OrdemMover.Id));
        Assert.Throws<RegraException>(() => Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = -1 }, d, OrdemMover.Id));
        Assert.Throws<RegraException>(() => Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 1 }, d, OrdemRetornar.Id));
        Assert.Throws<RegraException>(() => Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 1 }, c.Hex, OrdemMover.Id));
        Assert.Throws<RegraException>(() => Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 1 }, t.M.Locais[outro.CasteloId].Hex, OrdemMover.Id));
        Assert.Throws<RegraException>(() => Exercitos.Enviar(t.M, outro, c.Id, new Dictionary<string, int> { ["lanceiro"] = 1 }, d, OrdemMover.Id));
        Assert.Equal(2, c.Guarnicao["lanceiro"]);   // nada saiu
        Assert.Empty(t.M.Marchas.OfType<Exercito>());
    }

    [Fact]
    public void Exercito_parado_aceita_nova_ordem_de_mover()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        Guarnecer(t, r, c, "lanceiro", 5);
        var a = HexLivre(t, r, 4);
        var ex = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 5 }, a, OrdemMover.Id);
        AvancarAte(t, ex.Chegada + 1);
        Assert.True(ex.Parado);
        var b = HexLivre(t, r, 6);
        Exercitos.DarOrdem(t.M, r, ex.Id, OrdemMover.Id, b);
        Assert.False(ex.Parado);
        Assert.Equal(a, ex.Caminho[0]);
        Assert.Equal(b, ex.Destino);
        Assert.Throws<RegraException>(() => Exercitos.DarOrdem(t.M, r, ex.Id, OrdemMover.Id, null));
        Assert.Throws<RegraException>(() => Exercitos.DarOrdem(t.M, r, ex.Id, "voar", b));
        Assert.Throws<RegraException>(() => Exercitos.DarOrdem(t.M, t.NovoReino(), ex.Id, OrdemRetornar.Id, null));
        AvancarAte(t, ex.Chegada + 1);
        Assert.True(ex.Parado);
        Assert.Equal(b, ex.HexEm(t.M.Agora));
    }

    [Fact]
    public void Rota_segura_e_opcao_do_envio()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        Guarnecer(t, r, c, "lanceiro", 2);
        var ex = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 2 }, HexLivre(t, r, 5), OrdemMover.Id, seguro: true);
        Assert.True(ex.Seguro);
        var curta = Caminhos.Calcular(t.M, c.Hex, ex.Destino, "Lenta");
        Assert.True(ex.Chegada - ex.Partida >= (long)Math.Round(curta.TotalMin * T.Min));
    }

    [Fact]
    public void Posturas_padrao_e_mudancas()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        Assert.All(t.M.LocaisDe(r.Id), l => Assert.Equal(Postura.ApenasDefender, l.Postura));
        Guarnecer(t, r, c, "lanceiro", 2);
        var ex = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 2 }, HexLivre(t, r, 3), OrdemMover.Id);
        Assert.Equal(Postura.AtacarQuemAtacar, ex.Postura);
        Exercitos.MudarPostura(t.M, r, Postura.AtacarQualquer, localId: c.Id);
        Assert.Equal(Postura.AtacarQualquer, c.Postura);
        Exercitos.MudarPostura(t.M, r, Postura.ApenasDefender, marchaId: ex.Id);
        Assert.Equal(Postura.ApenasDefender, ex.Postura);
        Assert.Equal(5, Exercitos.MudarPostura(t.M, r, Postura.AtacarQuemAtacar, todas: true));
        Assert.All(t.M.LocaisDe(r.Id), l => Assert.Equal(Postura.AtacarQuemAtacar, l.Postura));
        Assert.Equal(Postura.ApenasDefender, ex.Postura);   // "todas" vale para as guarnições
        Exercitos.MudarPostura(t.M, r, Postura.AtacarQualquer, todosExercitos: true);
        Assert.Equal(Postura.AtacarQualquer, ex.Postura);
        var outro = t.NovoReino();
        Assert.Throws<RegraException>(() => Exercitos.MudarPostura(t.M, outro, Postura.AtacarQualquer, localId: c.Id));
        Assert.Throws<RegraException>(() => Exercitos.MudarPostura(t.M, r, Postura.AtacarQualquer));
    }

    [Fact]
    public void Vencida_no_caminho_entrega_carga_ate_a_capacidade_e_reliquias()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var inimigo = t.NovoReino();
        var c = Castelo(t, r);
        var ci = Castelo(t, inimigo);
        Guarnecer(t, r, c, "lanceiro", 3);
        Guarnecer(t, inimigo, ci, "cavalaria", 1);
        var vitima = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 3 }, HexLivre(t, r, 5), OrdemMover.Id);
        vitima.Carga.Somar("ferro", 500);
        vitima.Reliquias.Add(42);
        var vencedor = Exercitos.Enviar(t.M, inimigo, ci.Id, new Dictionary<string, int> { ["cavalaria"] = 1 }, HexLivre(t, inimigo, 3), OrdemMover.Id);
        Assert.True(vitima.Interceptavel);
        vitima.AoSerVencida(t.M, vencedor);
        Assert.False(t.M.Marchas.ContemId(vitima.Id));
        Assert.Equal(t.B.U["cavalaria"].Carga, vencedor.Carga.Qtd("ferro"), 6);   // só o que cabe
        Assert.Equal([42L], vencedor.Reliquias);
        Assert.Equal(0, Economia.Tropas(t.M, r));
    }

    [Fact]
    public void Carregadores_roubados_pedem_o_material_de_novo()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var inimigo = t.NovoReino();
        Obras.Melhorar(t.M, r, r.CasteloId);
        t.AvancarMin(5);
        t.DarRecursos(r);
        var vila = t.M.LocaisDe(r.Id).First(l => l.Tipo == TipoLocal.Vila);
        var item = Obras.Melhorar(t.M, r, vila.Id);
        var carreg = t.M.Marchas.OfType<Carregadores>().First(x => x.ItemId == item.Id);
        Assert.True(carreg.Interceptavel);
        var ci = Castelo(t, inimigo);
        Guarnecer(t, inimigo, ci, "cavalaria", 10);
        var ladrao = Exercitos.Enviar(t.M, inimigo, ci.Id, new Dictionary<string, int> { ["cavalaria"] = 10 }, HexLivre(t, inimigo, 3), OrdemMover.Id);
        var levava = carreg.Carga.Copia();
        carreg.AoSerVencida(t.M, ladrao);
        Assert.Equal(levava.Total, ladrao.Carga.Total, 6);
        Assert.Contains(t.M.Marchas.OfType<Carregadores>(), x => x.ItemId == item.Id);   // novos carregadores a caminho
        t.AvancarHoras(2);
        Assert.Equal(2, vila.Nivel);
    }

    [Fact]
    public void Exercito_e_salvo_e_recarregado()
    {
        var dir = Path.Combine(Path.GetTempPath(), "rp-teste-" + Guid.NewGuid().ToString("N"));
        var arq = Path.Combine(dir, "t.db");
        try
        {
            var t = new MundoTeste();
            var r = t.NovoReino();
            var c = Castelo(t, r);
            using var db = new Banco(arq);
            db.Salvar(t.M);
            Recrutamento.Recrutar(t.M, r, c.Id, "lanceiro", 4);
            t.Avancar(TimeSpan.FromSeconds(t.B.U["lanceiro"].Tempo * 4 + 1));
            var destino = HexLivre(t, r, 5);
            var ex = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 4 }, destino, OrdemMover.Id, true,
                new JsonObject { ["nota"] = "teste" });
            Exercitos.MudarPostura(t.M, r, Postura.AtacarQualquer, marchaId: ex.Id);
            ex.Carga.Somar("ouro", 3); ex.Reliquias.Add(9); t.M.Sujar(ex);
            db.Salvar(t.M);
            Assert.Equal(0, db.SalvarEsquecidos(t.M));   // nada mudou sem Sujar

            var m2 = new Mundo(Balanceamento.Padrao, t.Relogio);
            using (var db2 = new Banco(arq)) db2.Carregar(m2);
            m2.PrepararMapa();
            foreach (var e in m2.Eventos) m2.Agenda.Inserir(e);
            var ex2 = Assert.IsType<Exercito>(m2.Marchas[ex.Id]);
            Assert.Equal(c.Id, ex2.OrigemLocalId);
            Assert.Equal(OrdemMover.Id, ex2.Ordem);
            Assert.Equal(Postura.AtacarQualquer, ex2.Postura);
            Assert.True(ex2.Seguro);
            Assert.Equal("teste", ex2.Dados["nota"]!.GetValue<string>());
            Assert.Equal(4, ex2.Tropas["lanceiro"]);
            Assert.Equal(3, ex2.Carga.Qtd("ouro"));
            Assert.Equal([9L], ex2.Reliquias);
            Assert.Equal(ex.Chegada, ex2.Chegada);
            t.Relogio.Agora = ex.Chegada + 1;
            m2.ProcessarAte(t.Relogio.Agora);
            Assert.True(ex2.Parado);
            Assert.Equal(destino, ex2.HexEm(t.Relogio.Agora));
        }
        finally { try { Directory.Delete(dir, true); } catch { } }
    }

    [Fact]
    public void Ajudantes_de_grupo()
    {
        var t = new MundoTeste();
        var g = new Dictionary<string, int> { ["lanceiro"] = 10, ["ariete"] = 1, ["arqueiro"] = 0 };
        Assert.Equal(11, Tropas.Total(g));
        Assert.Equal(10 + t.B.U["ariete"].Pop, Tropas.Pop(t.M, g));
        Assert.Equal(10 * t.B.U["lanceiro"].Carga, Tropas.Carga(t.M, g));
        Assert.Equal(t.M.F.ForcaFauna(new Dictionary<string, int> { ["lanceiro"] = 10, ["ariete"] = 1 }), Tropas.ForcaFauna(t.M, g));
        Assert.Equal("Lenta", Tropas.Velocidade(t.M, g));
        Assert.Equal("10 lanceiros, 1 aríete", Tropas.Partes(t.M, g));
        var a = new Dictionary<string, int> { ["lanceiro"] = 1 };
        Tropas.Somar(a, g);
        Assert.Equal(11, a["lanceiro"]);
        Assert.False(a.ContainsKey("arqueiro"));
    }
}
