using System.Net;
using System.Text.Json;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Forja;
using ReinoDePedra.Jogo.IA;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Persistencia;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Temporada;
using ReinoDePedra.Jogo.Valiosos;
using PS = ReinoDePedra.Jogo.Pessoas.Pessoas;

namespace ReinoDePedra.Testes;

/// <summary>
/// Filas que aceitam item sem recurso: enfileirar não gasta, o item da vez reserva numa passagem única quando o reino tem o
/// bastante, e o mais antigo tem direito primeiro. Os cenários usam ouro quando precisam de contas exatas: nenhum local o produz.
/// </summary>
public class FilasAguardamTestes
{
    public FilasAguardamTestes() => AjustesTeste.Garantir();

    private static (MundoTeste t, Reino r) Reino()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        Zerar(t, r);
        return (t, r);
    }

    private static void Zerar(MundoTeste t, Reino r)
    {
        Economia.Atualizar(t.M, r);
        foreach (var l in t.M.LocaisDe(r.Id)) { l.Estoque = new(); t.M.Sujar(l); }
    }

    private static Local Castelo(MundoTeste t, Reino r) => t.M.Locais[r.CasteloId];
    private static Local Vila(MundoTeste t, Reino r) => t.M.LocaisDe(r.Id).First(l => l.Tipo == TipoLocal.Vila);
    private static Recursos Custo(params (string k, double v)[] x) => new(x.Select(p => new KeyValuePair<string, double>(p.k, p.v)));
    private static List<Carregadores> Carregadores(MundoTeste t, Reino r) => t.M.Marchas.OfType<Carregadores>().Where(c => c.ReinoId == r.Id).ToList();

    /// <summary>Item de obra com custo escolhido, em qualquer fila.</summary>
    private static ItemFila Item(MundoTeste t, Reino r, string fila, Recursos custo, double seg = 60) =>
        Filas.Enfileirar(t.M, r, fila, new ItemFila
        {
            Tipo = ObraMoradia.Id, LocalId = r.CasteloId, Hex = Castelo(t, r).Hex, Rotulo = "Teste " + fila, Custo = custo, DuracaoSeg = seg,
        });

    /// <summary>Todo o recurso do reino, onde estiver: estoques, carregadores (carga e próximas viagens) e o entregue às filas.</summary>
    private static double Tudo(MundoTeste t, Reino r, string k) =>
        t.M.LocaisDe(r.Id).Sum(l => l.Estoque.Qtd(k))
        + Carregadores(t, r).Sum(c => c.Carga.Qtd(k) + c.Pendente.Qtd(k))
        + r.Filas.Values.Sum(f => f.Itens.Sum(i => i.Entregue.Qtd(k)));

    // ---------------------------------------------------------------- enfileirar sem recurso

    [Fact]
    public void Enfileirar_sem_recurso_nao_gasta_nada_e_fica_aguardando()
    {
        var (t, r) = Reino();
        var c = Castelo(t, r);
        var obra = Obras.Melhorar(t.M, r, c.Id);
        var moradia = Obras.Moradia(t.M, r, c.Id);
        var hex = t.M.G.Area(c.Hex, 3).First(h => t.M.Mapa.Terrenos[h] == Jogo.Mapa.Terreno.Planicie && Obras.MotivoNaoFundar(t.M, r, "vila", h) == null);
        var fundar = Obras.Fundar(t.M, r, "vila", hex);
        var veiculo = Veiculos.Construir(t.M, r, "carrocao", 1);
        var salgadeira = Salgadeiras.Construir(t.M, r, Vila(t, r).Id);
        foreach (var it in new[] { obra, moradia, fundar, veiculo, salgadeira })
        {
            Assert.True(it.Aguardando, it.Rotulo);
            Assert.False(it.Iniciado);
            Assert.Null(it.Fim);
            Assert.Empty(it.Entregue);
        }
        Assert.Equal(5, r.Fila(Obras.Fila).Itens.Count);
        Assert.Empty(Carregadores(t, r));
        Assert.Equal(0, Tudo(t, r, "ouro") + Tudo(t, r, "sal"));
    }

    [Fact]
    public void Recrutar_sem_recurso_nao_tira_ninguem_da_populacao()
    {
        var (t, r) = Reino();
        var popAntes = r.Pop;
        var tropasAntes = Economia.Tropas(t.M, r);
        var item = Recrutamento.Recrutar(t.M, r, r.CasteloId, "lanceiro", 2);
        Assert.True(item.Aguardando);
        Assert.Equal(popAntes, r.Pop);
        Assert.Equal(tropasAntes, Economia.Tropas(t.M, r));   // sem contar duas vezes: quem aguarda ainda é civil
        Assert.Empty(PS.EmTreino(t.M, r, item));
        Assert.Equal(2, Filas.PopAguardando(r));
    }

    [Fact]
    public void As_outras_validacoes_continuam()
    {
        var (t, r) = Reino();
        for (var i = 0; i < Fila.Maximo; i++) Obras.Moradia(t.M, r, r.CasteloId);
        Assert.Contains("10 itens", Assert.Throws<RegraException>(() => Obras.Moradia(t.M, r, r.CasteloId)).Message);
        var (t2, r2) = Reino();
        Assert.Contains("castelo", Assert.Throws<RegraException>(() => Obras.Melhorar(t2.M, r2, Vila(t2, r2).Id)).Message);   // nível do castelo
        Assert.Contains("quartel", Assert.Throws<RegraException>(() => Recrutamento.Recrutar(t2.M, r2, r2.CasteloId, "cavalaria", 1)).Message);
        // a população com que os itens que aguardam contam não serve a outro
        var livres = PS.LivresParaTreino(t2.M, r2);
        Recrutamento.Recrutar(t2.M, r2, r2.CasteloId, "lanceiro", livres);
        Assert.Contains("população", Assert.Throws<RegraException>(() => Recrutamento.Recrutar(t2.M, r2, r2.CasteloId, "lanceiro", 1)).Message);
    }

    // ---------------------------------------------------------------- início sozinho

    [Fact]
    public void Comeca_sozinho_quando_o_recurso_chega()
    {
        var (t, r) = Reino();
        var it = Item(t, r, Obras.Fila, Custo(("ouro", 10)), 120);
        t.AvancarMin(10);
        Assert.True(it.Aguardando);
        Assert.False(it.Iniciado);
        // o ouro aparece longe do castelo, sem nenhum comando de jogador
        var vila = Vila(t, r);
        vila.Estoque.Somar("ouro", 25);
        t.M.Sujar(vila);
        t.AvancarMin(Filas.ReavaliarMaxSeg / 60.0 + 0.1);
        Assert.False(it.Aguardando);
        Assert.Equal(15, vila.Estoque.Qtd("ouro"), 6);
        var mc = Assert.Single(Carregadores(t, r));
        Assert.Equal(it.Id, mc.ItemId);
        Assert.False(it.Iniciado);        // a obra só começa quando o material chega
        t.Avancar(TimeSpan.FromMilliseconds(mc.Chegada - t.M.Agora + 1));
        Assert.True(it.Iniciado);
        var moradias = Economia.Moradias(t.M, r);
        t.AvancarMin(3);
        Assert.Equal(moradias + 1, Economia.Moradias(t.M, r));
        Assert.Equal(15, Tudo(t, r, "ouro"), 6);
        AjustesTeste.FalharSeErro();
    }

    [Fact]
    public void Comeca_sozinho_com_a_producao_normal()
    {
        var (t, r) = Reino();
        var taxa = Economia.TaxaTotal(t.M, r).Qtd("comida");
        var it = Item(t, r, Obras.Fila, Custo(("comida", taxa / 6)));   // 10 min de produção do reino
        t.AvancarMin(5);
        Assert.True(it.Aguardando);
        t.AvancarMin(7);
        Assert.False(it.Aguardando);
        Assert.True(it.Iniciado || !it.MaterialCompleto);
        AjustesTeste.FalharSeErro();
    }

    [Fact]
    public void Soma_do_reino_inteiro_e_o_que_conta()
    {
        var (t, r) = Reino();
        var locais = t.M.LocaisDe(r.Id).ToList();
        foreach (var l in locais) { l.Estoque.Somar("ouro", 10); t.M.Sujar(l); }
        var it = Item(t, r, Obras.Fila, Custo(("ouro", 10.0 * locais.Count)));
        Assert.False(it.Aguardando);   // nenhum local sozinho tinha o bastante
        Assert.Equal(0, locais.Sum(l => l.Estoque.Qtd("ouro")), 6);
        Assert.Equal(10.0 * locais.Count, Tudo(t, r, "ouro"), 6);
    }

    // ---------------------------------------------------------------- prioridade entre filas

    [Fact]
    public void Dois_itens_de_filas_diferentes_o_mais_antigo_vence_e_o_novo_espera()
    {
        var (t, r) = Reino();
        var velho = Item(t, r, Obras.Fila, Custo(("ouro", 20)));
        var novo = Item(t, r, Recrutamento.Fila, Custo(("ouro", 5)));
        t.DarRecursos(r, 10, "ouro");
        Filas.Avaliar(t.M, r);
        // os 10 de ouro pagam o novo, mas o velho tem direito a eles
        Assert.True(velho.Aguardando);
        Assert.True(novo.Aguardando);
        Assert.Equal(10, Castelo(t, r).Estoque.Qtd("ouro"), 6);
        Assert.Equal(10, Filas.Situacoes(t.M, r)[velho.Id].Faltam.Qtd("ouro"), 6);
        Assert.Equal(5, Filas.Situacoes(t.M, r)[novo.Id].Faltam.Qtd("ouro"), 6);
        t.DarRecursos(r, 10, "ouro");
        Filas.Avaliar(t.M, r);
        Assert.False(velho.Aguardando);
        Assert.True(novo.Aguardando);
        Assert.Equal(0, Castelo(t, r).Estoque.Qtd("ouro"), 6);
        t.DarRecursos(r, 5, "ouro");
        Filas.Avaliar(t.M, r);
        Assert.False(novo.Aguardando);
        Assert.Equal(25, Tudo(t, r, "ouro"), 6);
    }

    [Fact]
    public void Item_novo_que_nao_disputa_segue_adiante()
    {
        var (t, r) = Reino();
        var velho = Item(t, r, Obras.Fila, Custo(("ouro", 20), ("prata", 100)));
        t.DarRecursos(r, 300, "prata");
        Filas.Avaliar(t.M, r);
        Assert.True(velho.Aguardando);
        // ferro não é disputado; prata, sim, mas sobram 200 depois do que o velho pede
        var livre = Item(t, r, "ferraria", Custo(("gema", 0)));
        Assert.False(livre.Aguardando);
        var cabe = Item(t, r, Recrutamento.Fila, Custo(("prata", 150)));
        Assert.False(cabe.Aguardando);
        Assert.Equal(150, Castelo(t, r).Estoque.Qtd("prata"), 6);
        // agora só sobram 50 para os mais novos, depois dos 100 do velho
        var naoCabe = Item(t, r, Feridos.Fila, Custo(("prata", 60)));
        Assert.True(naoCabe.Aguardando);
        Assert.Equal(150, Castelo(t, r).Estoque.Qtd("prata"), 6);
    }

    [Fact]
    public void Item_barato_nao_atrasa_um_caro_para_sempre()
    {
        var (t, r) = Reino();
        var caro = Item(t, r, Obras.Fila, Custo(("ouro", 100)));
        // chegam 30 de ouro de cada vez: dava para pagar um item barato por rodada, e o caro nunca juntaria os 100
        for (var i = 0; i < 3; i++)
        {
            var barato = Item(t, r, Recrutamento.Fila, Custo(("ouro", 10)), 1);
            t.DarRecursos(r, 30, "ouro");
            Filas.Avaliar(t.M, r);
            Assert.True(barato.Aguardando);
            Assert.True(caro.Aguardando);
            Filas.Cancelar(t.M, r, Recrutamento.Fila, barato.Id);
        }
        t.DarRecursos(r, 30, "ouro");
        Filas.Avaliar(t.M, r);
        Assert.False(caro.Aguardando);
        Assert.Equal(20, Castelo(t, r).Estoque.Qtd("ouro"), 6);
    }

    [Fact]
    public void So_o_item_da_vez_reserva()
    {
        var (t, r) = Reino();
        t.DarRecursos(r, 1000, "ouro");
        var a = Item(t, r, Obras.Fila, Custo(("ouro", 100)), 60);
        var b = Item(t, r, Obras.Fila, Custo(("ouro", 100)), 60);
        Assert.False(a.Aguardando);
        Assert.True(a.Iniciado);
        Assert.True(b.Aguardando);
        Assert.Equal(900, Castelo(t, r).Estoque.Qtd("ouro"), 6);
        t.AvancarMin(1.01);
        Assert.False(b.Aguardando);
        Assert.True(b.Iniciado);
        Assert.Equal(800, Castelo(t, r).Estoque.Qtd("ouro"), 6);
    }

    [Fact]
    public void Nunca_dois_itens_da_mesma_fila_em_andamento()
    {
        var (t, r) = Reino();
        t.DarRecursos(r, 1000, "ouro");
        for (var i = 0; i < 4; i++) Item(t, r, Obras.Fila, Custo(("ouro", 10)), 30);
        for (var seg = 0; seg < 200; seg++)
        {
            t.Avancar(TimeSpan.FromSeconds(1));
            Filas.Avaliar(t.M, r);
            Assert.True(r.Fila(Obras.Fila).Itens.Count(i => i.Iniciado) <= 1);
        }
        Assert.Empty(r.Fila(Obras.Fila).Itens);
        Assert.Equal(960, Castelo(t, r).Estoque.Qtd("ouro"), 6);
    }

    // ---------------------------------------------------------------- idempotência

    [Fact]
    public void Reprocessar_nao_reserva_duas_vezes()
    {
        var (t, r) = Reino();
        var vila = Vila(t, r);
        vila.Estoque.Somar("ouro", 100);
        t.M.Sujar(vila);
        var it = Item(t, r, Obras.Fila, Custo(("ouro", 20)));
        Assert.False(it.Aguardando);
        var mc = Assert.Single(Carregadores(t, r));
        for (var i = 0; i < 5; i++) Filas.Avaliar(t.M, r);
        Assert.Equal(80, vila.Estoque.Qtd("ouro"), 6);
        Assert.Single(Carregadores(t, r));
        Assert.Equal(100, Tudo(t, r, "ouro"), 6);
        // a mesma avaliação depois da chegada, com a obra em andamento, também não mexe em nada
        t.Avancar(TimeSpan.FromMilliseconds(mc.Chegada - t.M.Agora + 1));
        Assert.True(it.Iniciado);
        var fim = it.Fim;
        var ev = it.EventoId;
        for (var i = 0; i < 5; i++) { Filas.Avaliar(t.M, r); Filas.TentarIniciar(t.M, r, Obras.Fila); }
        Assert.Equal(fim, it.Fim);
        Assert.Equal(ev, it.EventoId);
        Assert.Equal(80, vila.Estoque.Qtd("ouro"), 6);
        Assert.Equal(20, it.Entregue.Qtd("ouro"), 6);
    }

    [Fact]
    public void Item_salvo_com_material_ja_gasto_nao_pede_de_novo()
    {
        // o item da regra antiga: Reservado (o valor padrão de quem não tem o campo), com o material a caminho
        var (t, r) = Reino();
        var vila = Vila(t, r);
        vila.Estoque.Somar("ouro", 100);
        t.M.Sujar(vila);
        var it = Item(t, r, Obras.Fila, Custo(("ouro", 40)));
        var json = JsonSerializer.Serialize(it, Banco.Json);
        Assert.Contains("\"Estado\":\"Reservado\"", json);
        var antigo = JsonSerializer.Deserialize<ItemFila>(json.Replace("\"Estado\":\"Reservado\",", ""), Banco.Json)!;
        Assert.False(antigo.Aguardando);
        Assert.Equal(EstadoItem.Reservado, antigo.Estado);
    }

    [Fact]
    public void Reserva_e_um_evento_so_por_reino()
    {
        var (t, r) = Reino();
        Item(t, r, Obras.Fila, Custo(("ouro", 40)));
        Item(t, r, Recrutamento.Fila, Custo(("ouro", 40)));
        for (var i = 0; i < 5; i++) { Filas.Avaliar(t.M, r); Filas.Acordar(t.M, r); }
        t.AvancarMin(0);
        Assert.Single(t.M.Eventos.OfType<AvaliarFilasEvento>(), e => e.ReinoId == r.Id);
        t.AvancarMin(10);
        Assert.Single(t.M.Eventos.OfType<AvaliarFilasEvento>(), e => e.ReinoId == r.Id);
    }

    [Fact]
    public void Sem_item_parado_nao_fica_evento_rodando()
    {
        var (t, r) = Reino();
        var it = Item(t, r, Obras.Fila, Custo(("ouro", 40)));
        t.AvancarMin(1);
        Filas.Cancelar(t.M, r, Obras.Fila, it.Id);
        t.AvancarMin(2);
        Assert.DoesNotContain(t.M.Eventos.OfType<AvaliarFilasEvento>(), e => e.ReinoId == r.Id);
        Assert.Null(r.FilasEventoId);
    }

    // ---------------------------------------------------------------- cancelar

    [Fact]
    public void Cancelar_antes_da_reserva_nao_devolve_nada()
    {
        var (t, r) = Reino();
        t.DarRecursos(r, 5, "ouro");
        var it = Item(t, r, Obras.Fila, Custo(("ouro", 10)));
        Filas.Cancelar(t.M, r, Obras.Fila, it.Id);
        Assert.Equal(5, Tudo(t, r, "ouro"), 6);
        Assert.Empty(r.Fila(Obras.Fila).Itens);
    }

    [Fact]
    public void Cancelar_recrutamento_que_aguarda_nao_mexe_nas_pessoas()
    {
        var (t, r) = Reino();
        var oficios = t.M.PessoasDe(r.Id).ToDictionary(p => p.Id, p => (p.Oficio, p.Estado));
        var it = Recrutamento.Recrutar(t.M, r, r.CasteloId, "lanceiro", 2);
        Filas.Cancelar(t.M, r, Recrutamento.Fila, it.Id);
        Assert.Equal(oficios, t.M.PessoasDe(r.Id).ToDictionary(p => p.Id, p => (p.Oficio, p.Estado)));
        Assert.Equal(0, Filas.PopAguardando(r));
    }

    [Fact]
    public void Cancelar_depois_da_reserva_devolve_o_reservado()
    {
        var (t, r) = Reino();
        t.DarRecursos(r, 30, "ouro");
        var it = Item(t, r, Obras.Fila, Custo(("ouro", 10)));
        Assert.Equal(20, Castelo(t, r).Estoque.Qtd("ouro"), 6);
        Assert.Equal(10, it.Entregue.Qtd("ouro"), 6);
        Filas.Cancelar(t.M, r, Obras.Fila, it.Id);
        Assert.Equal(30, Castelo(t, r).Estoque.Qtd("ouro"), 6);
    }

    [Fact]
    public void Cancelar_com_material_a_caminho_ele_chega_e_fica_na_obra()
    {
        var (t, r) = Reino();
        var vila = Vila(t, r);
        vila.Estoque.Somar("ouro", 30);
        t.M.Sujar(vila);
        var it = Item(t, r, Obras.Fila, Custo(("ouro", 30)));
        var mc = Assert.Single(Carregadores(t, r));
        Filas.Cancelar(t.M, r, Obras.Fila, it.Id);
        Assert.Null(mc.ItemId);
        Assert.Equal(30, Tudo(t, r, "ouro"), 6);
        t.Avancar(TimeSpan.FromMilliseconds(mc.Chegada - t.M.Agora + 1));
        Assert.Equal(30, Castelo(t, r).Estoque.Qtd("ouro"), 6);
    }

    [Fact]
    public void Cancelar_recrutamento_reservado_devolve_o_civil()
    {
        var (t, r) = Reino();
        t.DarRecursos(r, 1000, "comida", "madeira", "pedra", "ferro", "couro");
        var pop = r.Pop;
        var it = Recrutamento.Recrutar(t.M, r, r.CasteloId, "lanceiro", 1);
        Assert.False(it.Aguardando);
        Assert.Equal(pop - 1, r.Pop);
        Assert.Single(PS.EmTreino(t.M, r, it));
        Filas.Cancelar(t.M, r, Recrutamento.Fila, it.Id);
        Assert.Equal(pop, r.Pop);
    }

    [Fact]
    public void Cancelar_duas_vezes_nao_devolve_duas_vezes()
    {
        var (t, r) = Reino();
        t.DarRecursos(r, 30, "ouro");
        var it = Item(t, r, Obras.Fila, Custo(("ouro", 10)));
        Filas.Cancelar(t.M, r, Obras.Fila, it.Id);
        var ex = Assert.Throws<RegraException>(() => Filas.Cancelar(t.M, r, Obras.Fila, it.Id));
        Assert.Equal(404, ex.Status);
        Assert.Equal(30, Tudo(t, r, "ouro"), 6);
    }

    [Fact]
    public void Cancelar_o_primeiro_da_vez_ao_seguinte()
    {
        var (t, r) = Reino();
        t.DarRecursos(r, 30, "ouro");
        var a = Item(t, r, Obras.Fila, Custo(("ouro", 500)));
        var b = Item(t, r, Obras.Fila, Custo(("ouro", 10)));
        Assert.True(a.Aguardando);
        Assert.True(b.Aguardando);   // não é a vez dele
        Filas.Cancelar(t.M, r, Obras.Fila, a.Id);
        t.AvancarMin(0);
        Assert.False(b.Aguardando);
        Assert.True(b.Iniciado);
    }

    [Fact]
    public void Lendario_que_aguarda_cancelado_devolve_a_vaga_do_reino()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        var f = t.M.AdicionarLocal(new Local
        {
            ReinoId = r.Id, Tipo = TipoLocal.Ferraria, Nivel = t.M.P.FerrariaServ.Lendario.Ferraria, Nome = "Forja",
            Hex = t.M.G.Area(c.Hex, 5).First(h => Obras.HexLivre(t.M, h) && !t.M.Mapa.Rio[h]),
        });
        r.Eras["aco"] = t.M.Agora;
        var it = Ferrarias.ForjarLendario(t.M, r, Ferrarias.Ataque);
        Assert.True(it.Aguardando);
        Assert.Equal(1, r.LendariosForjados);
        Filas.Cancelar(t.M, r, Ferrarias.Fila, it.Id);
        Assert.Equal(0, r.LendariosForjados);
        Assert.Equal(f.Id, Ferrarias.Principal(t.M, r)!.Id);
    }

    // ---------------------------------------------------------------- reinício

    private static void ComBanco(Action<string> acao)
    {
        var dir = Path.Combine(Path.GetTempPath(), "rp-teste-" + Guid.NewGuid().ToString("N"));
        try { acao(Path.Combine(dir, "t.db")); }
        finally { try { Directory.Delete(dir, true); } catch { } }
    }

    private static Mundo Recarregar(string arq, MundoTeste t)
    {
        using var db = new Banco(arq);
        var m = new Mundo(Balanceamento.Padrao, t.Relogio);
        db.Carregar(m);
        m.PrepararMapa();
        foreach (var e in m.Eventos) m.Agenda.Inserir(e);
        return m;
    }

    [Fact]
    public void Reinicio_com_item_aguardando_comeca_sozinho_depois()
    {
        ComBanco(arq =>
        {
            var (t, r) = Reino();
            var it = Item(t, r, Obras.Fila, Custo(("ouro", 10)));
            using (var db = new Banco(arq))
            {
                db.Salvar(t.M);
                Assert.Equal(0, db.SalvarEsquecidos(t.M));
            }
            var m2 = Recarregar(arq, t);
            var r2 = m2.Reinos[r.Id];
            var it2 = Assert.Single(r2.Fila(Obras.Fila).Itens);
            Assert.True(it2.Aguardando);
            Assert.Equal(it.Id, it2.Id);
            var ev = Assert.Single(m2.Eventos.OfType<AvaliarFilasEvento>(), e => e.ReinoId == r.Id);   // o evento volta junto
            Assert.Equal(ev.Id, r2.FilasEventoId);
            var c2 = m2.Locais[r.CasteloId];
            c2.Estoque.Somar("ouro", 15);
            t.Relogio.Agora += T.DeSegundos(Filas.ReavaliarMaxSeg + 1);
            m2.ProcessarAte(t.Relogio.Agora);
            Assert.False(it2.Aguardando);
            Assert.True(it2.Iniciado);
            Assert.Equal(5, c2.Estoque.Qtd("ouro"), 6);
            Assert.Equal(10, it2.Entregue.Qtd("ouro"), 6);
        });
    }

    [Fact]
    public void Mundo_gravado_com_a_IA_governando_um_jogador_volta_ao_dono_ao_carregar()
    {
        // decisão 0039: saves de antes guardam o registro antigo no reino, a verificação dele e sessões de IA marcadas
        ComBanco(arq =>
        {
            var t = MundoIA.Novo(criar: false);
            var j = MundoIA.Jogador(t, 0);
            Zerar(t, j);
            var it = Item(t, j, Obras.Fila, Custo(("ouro", 10)));
            j.SessaoIAEventoId = t.M.Agendar(new SessaoIAEvento { ReinoId = j.Id, Quando = t.M.Agora + T.Hora }).Id;
            j.SessaoIA2EventoId = t.M.Agendar(new SessaoIAEvento { ReinoId = j.Id, Etapa = 1, Quando = t.M.Agora + T.Hora }).Id;
            t.M.Sujar(j);
            using (var db = new Banco(arq))
            {
                db.Salvar(t.M);
                var json = db.Escalar<string>("SELECT dados FROM docs WHERE colecao=$c AND id=$i", ("$c", t.M.Reinos.Nome), ("$i", j.Id))!;
                var antigo = json.TrimEnd('}') + ",\"RegenciaEventoId\":999999,\"Regencia\":{\"AtivaDesde\":1,\"Acoes\":[{\"Chave\":\"moradia\",\"Texto\":\"Moradias\",\"Quando\":1,\"Qtd\":1}],\"Perdas\":[]}}";
                db.Exec("UPDATE docs SET dados=$d WHERE colecao=$c AND id=$i", ("$d", antigo), ("$c", t.M.Reinos.Nome), ("$i", j.Id));
                db.Exec("INSERT INTO docs(colecao,id,tipo,dados) VALUES($c,999999,'VerificarRegenciaEvento',$d)",
                    ("$c", t.M.Eventos.Nome), ("$d", "{\"ReinoId\":" + j.Id + ",\"Quando\":" + (t.M.Agora + T.Hora) + "}"));
            }
            var m2 = Recarregar(arq, t);
            m2.IA.Ativa = true;
            Sistemas.IniciarTodos(m2);
            var j2 = m2.Reinos[j.Id];
            Assert.Null(j2.SessaoIAEventoId);
            Assert.Null(j2.SessaoIA2EventoId);
            Assert.DoesNotContain(m2.Eventos.OfType<SessaoIAEvento>(), e => e.ReinoId == j.Id);
            Assert.Null(Sessoes.De(m2, j2));
            // o mundo segue para ele como para um jogador offline: o item que ele deixou começa sozinho
            var it2 = Assert.Single(j2.Fila(Obras.Fila).Itens);
            Assert.Equal(it.Id, it2.Id);
            m2.Locais[j2.CasteloId].Estoque.Somar("ouro", 10);
            t.Relogio.Agora += T.DeHoras(48);
            m2.ProcessarAte(t.Relogio.Agora);
            Assert.False(it2.Aguardando);
            Assert.Null(j2.SessaoIAEventoId);
            Assert.DoesNotContain(j2.Filas.Values.SelectMany(f => f.Itens), i => i.Id != it.Id);   // ninguém pôs nada na fila por ele
        });
    }

    [Fact]
    public void Queda_do_servidor_depois_da_reserva_nao_gravada_nao_paga_duas_vezes()
    {
        // grava com o item aguardando e o ouro no estoque; reserva na memória e "cai" antes de gravar
        ComBanco(arq =>
        {
            var (t, r) = Reino();
            var vila = Vila(t, r);
            var it = Item(t, r, Obras.Fila, Custo(("ouro", 10)));
            vila.Estoque.Somar("ouro", 25);
            t.M.Sujar(vila);
            using (var db = new Banco(arq)) db.Salvar(t.M);
            Filas.Avaliar(t.M, r);
            Assert.False(it.Aguardando);
            Assert.Single(Carregadores(t, r));
            // a memória se perdeu: volta o que estava gravado, sem a reserva e sem os carregadores
            var m2 = Recarregar(arq, t);
            var r2 = m2.Reinos[r.Id];
            var it2 = Assert.Single(r2.Fila(Obras.Fila).Itens);
            Assert.True(it2.Aguardando);
            Assert.Empty(m2.Marchas.OfType<Carregadores>());
            Assert.Equal(25, m2.Locais[vila.Id].Estoque.Qtd("ouro"), 6);
            Filas.Avaliar(m2, r2);
            Filas.Avaliar(m2, r2);
            Assert.False(it2.Aguardando);
            Assert.Equal(15, m2.Locais[vila.Id].Estoque.Qtd("ouro"), 6);
            Assert.Single(m2.Marchas.OfType<Carregadores>());
        });
    }

    [Fact]
    public void Reinicio_depois_da_reserva_nao_pede_de_novo()
    {
        ComBanco(arq =>
        {
            var (t, r) = Reino();
            var vila = Vila(t, r);
            vila.Estoque.Somar("ouro", 25);
            t.M.Sujar(vila);
            Item(t, r, Obras.Fila, Custo(("ouro", 10)));
            using (var db = new Banco(arq))
            {
                db.Salvar(t.M);
                Assert.Equal(0, db.SalvarEsquecidos(t.M));   // a reserva inteira marcou o que mudou
            }
            var m2 = Recarregar(arq, t);
            var r2 = m2.Reinos[r.Id];
            var it2 = Assert.Single(r2.Fila(Obras.Fila).Itens);
            Assert.False(it2.Aguardando);
            for (var i = 0; i < 3; i++) Filas.Avaliar(m2, r2);
            Assert.Equal(15, m2.Locais[vila.Id].Estoque.Qtd("ouro"), 6);
            Assert.Single(m2.Marchas.OfType<Carregadores>());
        });
    }

    [Fact]
    public void Documento_da_regra_antiga_continua_valendo_e_termina()
    {
        // o banco de uma versão anterior: o item não tem Estado nem PopReserva e o material já saiu do estoque
        ComBanco(arq =>
        {
            var (t, r) = Reino();
            var vila = Vila(t, r);
            vila.Estoque.Somar("ouro", 25);
            t.M.Sujar(vila);
            var it = Item(t, r, Obras.Fila, Custo(("ouro", 10)), 60);
            var id = it.Id;
            using (var db = new Banco(arq))
            {
                db.Salvar(t.M);
                var dados = db.Escalar<string>("SELECT dados FROM docs WHERE colecao='reinos' AND id=$i", ("$i", r.Id))!;
                Assert.Contains("\"Estado\":\"Reservado\"", dados);
                dados = dados.Replace("\"Estado\":\"Reservado\",", "").Replace("\"PopReserva\":0", "\"PopReservaAntiga\":0");
                Assert.DoesNotContain("\"Estado\"", dados);
                db.Exec("UPDATE docs SET dados=$d WHERE colecao='reinos' AND id=$i", ("$d", dados), ("$i", r.Id));
            }
            var m2 = Recarregar(arq, t);
            var r2 = m2.Reinos[r.Id];
            var it2 = Assert.Single(r2.Fila(Obras.Fila).Itens);
            Assert.Equal(id, it2.Id);
            Assert.False(it2.Aguardando);
            var moradias = Economia.Moradias(m2, r2);
            t.Relogio.Agora += T.Hora;
            m2.ProcessarAte(t.Relogio.Agora);
            Assert.Equal(moradias + 1, Economia.Moradias(m2, r2));
            Assert.Equal(15, m2.Locais[vila.Id].Estoque.Qtd("ouro"), 6);
        });
    }

    // ---------------------------------------------------------------- local perdido, sabotagem, queda, exílio

    [Fact]
    public void Local_perdido_com_item_aguardando_sai_da_fila_sem_gastar()
    {
        var (t, r) = Reino();
        var outro = t.NovoReino();
        var vila = Vila(t, r);
        var castelo = Castelo(t, r);
        castelo.Nivel = 3;
        vila.Estoque.Somar("ouro", 7);
        var obra = Obras.Melhorar(t.M, r, vila.Id);
        var moradia = Obras.Moradia(t.M, r, vila.Id);
        Assert.True(obra.Aguardando);
        t.M.MudarDono(vila, outro.Id);
        t.AvancarMin(0);
        Assert.Empty(r.Fila(Obras.Fila).Itens);
        Assert.Equal(7, vila.Estoque.Qtd("ouro"), 6);   // o estoque do local foi com ele, como sempre; a obra não levou nada
        Assert.Contains(t.M.Notificacoes, n => n.ReinoId == r.Id && n.Texto != null && n.Texto.Contains(obra.Rotulo) && n.Texto.Contains("Nada foi gasto"));
        Assert.Contains(t.M.Notificacoes, n => n.ReinoId == r.Id && n.Texto != null && n.Texto.Contains(moradia.Rotulo));
        Assert.Empty(Carregadores(t, r));
    }

    [Fact]
    public void Item_atras_na_fila_tambem_sai_quando_o_local_dele_se_perde()
    {
        var (t, r) = Reino();
        var outro = t.NovoReino();
        var vila = Vila(t, r);
        t.DarRecursos(r, 10, "ouro");
        var primeiro = Item(t, r, Obras.Fila, Custo(("ouro", 10)), 3600);
        Assert.True(primeiro.Iniciado);
        var atras = Obras.Moradia(t.M, r, vila.Id);
        Assert.True(atras.Aguardando);
        t.M.MudarDono(vila, outro.Id);
        t.AvancarMin(0);
        Assert.Equal(primeiro.Id, Assert.Single(r.Fila(Obras.Fila).Itens).Id);
    }

    [Fact]
    public void Material_reservado_de_local_perdido_volta_ao_castelo()
    {
        var (t, r) = Reino();
        var outro = t.NovoReino();
        Castelo(t, r).Nivel = 3;
        var vila = Vila(t, r);
        vila.Estoque.Somar("ouro", 10);
        t.M.Sujar(vila);
        var it = Filas.Enfileirar(t.M, r, Obras.Fila, new ItemFila
        {
            Tipo = ObraNivel.Id, LocalId = vila.Id, Hex = vila.Hex, NivelAlvo = 2, Rotulo = "Vila nível 2", Custo = Custo(("ouro", 10)), DuracaoSeg = 60,
        });
        Assert.True(it.Iniciado);
        t.M.MudarDono(vila, outro.Id);
        t.AvancarMin(2);
        Assert.Empty(r.Fila(Obras.Fila).Itens);
        Assert.Equal(10, Castelo(t, r).Estoque.Qtd("ouro"), 6);
        Assert.Equal(0, vila.Estoque.Qtd("ouro"), 6);
    }

    [Fact]
    public void Reservado_sem_o_resto_do_material_e_sem_local_devolve_o_que_chegou_ao_castelo()
    {
        var (t, r) = Reino();
        var outro = t.NovoReino();
        var ladrao = t.NovoReino();
        var castelo = Castelo(t, r);
        castelo.Nivel = 3;
        var vila = Vila(t, r);
        vila.Estoque.Somar("ouro", 10);
        castelo.Estoque.Somar("ouro", 20);
        t.M.Sujar(vila); t.M.Sujar(castelo);
        var it = Filas.Enfileirar(t.M, r, Obras.Fila, new ItemFila
        {
            Tipo = ObraNivel.Id, LocalId = vila.Id, Hex = vila.Hex, NivelAlvo = 2, Rotulo = "Vila nível 2", Custo = Custo(("ouro", 30)), DuracaoSeg = 60,
        });
        Assert.False(it.Aguardando);
        Assert.Equal(10, it.Entregue.Qtd("ouro"), 6);        // o da vila já está na obra
        var mc = Assert.Single(Carregadores(t, r));            // o do castelo está no caminho, e é roubado
        mc.AoSerVencida(t.M, new Exercito { ReinoId = ladrao.Id, Tropas = new() { ["lanceiro"] = 10 } });
        Assert.Equal(20, Logistica.Faltando(t.M, it).Qtd("ouro"), 6);
        t.M.MudarDono(vila, outro.Id);
        t.AvancarMin(0);
        Assert.Empty(r.Fila(Obras.Fila).Itens);
        Assert.Equal(10, castelo.Estoque.Qtd("ouro"), 6);    // nunca para o estoque de quem tomou o local
        Assert.Equal(0, vila.Estoque.Qtd("ouro"), 6);
        Assert.Contains(t.M.Notificacoes, n => n.ReinoId == r.Id && n.Texto != null && n.Texto.Contains("voltou ao castelo"));
    }

    [Fact]
    public void Sabotagem_que_baixa_o_castelo_desiste_da_melhoria_que_aguarda()
    {
        var (t, r) = Reino();
        var castelo = Castelo(t, r);
        castelo.Nivel = 3;
        var vila = Vila(t, r);
        vila.Nivel = 2;
        var it = Obras.Melhorar(t.M, r, vila.Id);   // alvo 3, o castelo permite
        Assert.True(it.Aguardando);
        castelo.Nivel = 2;                           // uma sabotagem tirou um nível do castelo
        t.DarRecursos(r, 1e6);
        Filas.Avaliar(t.M, r);
        Assert.Empty(r.Fila(Obras.Fila).Itens);
        Assert.Equal(2, vila.Nivel);
        Assert.Contains(t.M.Notificacoes, n => n.ReinoId == r.Id && n.Texto != null && n.Texto.Contains("nenhum local passa"));
    }

    [Fact]
    public void Lugar_ocupado_enquanto_aguarda_cancela_a_fundacao_sem_gastar()
    {
        var (t, r) = Reino();
        var c = Castelo(t, r);
        var hex = t.M.G.Area(c.Hex, 3).First(h => t.M.Mapa.Terrenos[h] == Jogo.Mapa.Terreno.Planicie && Obras.MotivoNaoFundar(t.M, r, "vila", h) == null);
        var it = Obras.Fundar(t.M, r, "vila", hex);
        Assert.True(it.Aguardando);
        var outro = t.NovoReino();
        t.M.AdicionarLocal(new Local { ReinoId = outro.Id, Tipo = TipoLocal.Vila, Nivel = 1, Hex = hex, Nome = "Vila alheia" });
        t.DarRecursos(r, 1e6);
        Filas.Avaliar(t.M, r);
        Assert.Empty(r.Fila(Obras.Fila).Itens);
        Assert.Equal(1e6, c.Estoque.Qtd("madeira"), 0);
    }

    [Fact]
    public void Queda_do_castelo_com_itens_aguardando_nao_consome_nada_e_o_resto_segue()
    {
        var (t, r) = Reino();
        var outro = t.NovoReino();
        var castelo = Castelo(t, r);
        var vila = Vila(t, r);
        castelo.Nivel = 3;
        var noCastelo = Obras.Moradia(t.M, r, castelo.Id);
        var naVila = Recrutamento.Fila;
        var moradiaVila = Filas.Enfileirar(t.M, r, naVila, new ItemFila
        {
            Tipo = ObraMoradia.Id, LocalId = vila.Id, Hex = vila.Hex, Rotulo = "Moradia na vila", Custo = Custo(("ouro", 10)), DuracaoSeg = 60,
        });
        Assert.True(noCastelo.Aguardando);
        Quedas.CairCastelo(t.M, r, new Exercito { ReinoId = outro.Id }, castelo);
        t.AvancarMin(0);
        Assert.NotEqual(castelo.Id, r.CasteloId);
        Assert.DoesNotContain(r.Fila(Obras.Fila).Itens, i => i.Id == noCastelo.Id);
        // a vila virou... o local de maior nível vira o castelo novo; o item que aguarda nele, de moradia, continua válido
        var novo = t.M.Locais[r.CasteloId];
        Assert.False(novo.Ruina);
        Assert.Equal(0, Tudo(t, r, "ouro"), 6);
        Assert.Contains(r.Fila(Recrutamento.Fila).Itens, i => i.Id == moradiaVila.Id && i.Aguardando);
        Assert.Empty(Carregadores(t, r));
        AjustesTeste.FalharSeErro();
    }

    [Fact]
    public void Exilio_cancela_o_que_aguarda_e_nao_toca_no_kit()
    {
        var (t, r) = Reino();
        var outro = t.NovoReino();
        foreach (var l in t.M.LocaisDe(r.Id).Where(l => l.Id != r.CasteloId).ToList()) t.M.RemoverLocal(l);
        var castelo = Castelo(t, r);
        Obras.Moradia(t.M, r, castelo.Id);
        Obras.Melhorar(t.M, r, castelo.Id);
        Recrutamento.Recrutar(t.M, r, castelo.Id, "lanceiro", 1);
        Veiculos.Construir(t.M, r, "carroca", 1);
        Assert.All(r.Filas.Values.SelectMany(f => f.Itens), i => Assert.True(i.Aguardando));
        Quedas.CairCastelo(t.M, r, new Exercito { ReinoId = outro.Id }, castelo);
        Assert.True(r.UltimaQueda!.Exilio);
        t.AvancarMin(0);
        Assert.Empty(r.Filas.Values.SelectMany(f => f.Itens));
        var novo = t.M.Locais[r.CasteloId];
        var kit = t.M.P.Guerra.Exilio.Kit;
        foreach (var (k, v) in kit) Assert.Equal(v, novo.Estoque.Qtd(k), 0);
        Assert.Empty(r.UltimaQueda!.RecursosPerdidos);   // o que aguardava não tinha gastado nada
        Assert.Empty(Carregadores(t, r));
        AjustesTeste.FalharSeErro();
    }

    // ---------------------------------------------------------------- roubo e reposição

    [Fact]
    public void Material_roubado_sem_recurso_no_reino_e_pedido_de_novo_quando_houver()
    {
        var (t, r) = Reino();
        var ladrao = t.NovoReino();
        var vila = Vila(t, r);
        vila.Estoque.Somar("ouro", 10);
        t.M.Sujar(vila);
        var it = Item(t, r, Obras.Fila, Custo(("ouro", 10)));
        var mc = Assert.Single(Carregadores(t, r));
        mc.AoSerVencida(t.M, new Exercito { ReinoId = ladrao.Id, Tropas = new() { ["lanceiro"] = 10 } });
        t.AvancarMin(0);
        Assert.False(it.Aguardando);
        Assert.Equal(10, Logistica.Faltando(t.M, it).Qtd("ouro"), 6);
        Assert.Equal(10, Filas.Situacoes(t.M, r)[it.Id].Faltam.Qtd("ouro"), 6);
        // o ouro aparece: a avaliação pede de novo, uma vez só
        t.DarRecursos(r, 25, "ouro");
        for (var i = 0; i < 4; i++) Filas.Avaliar(t.M, r);
        Assert.Equal(15, Castelo(t, r).Estoque.Qtd("ouro"), 6);
        Assert.Equal(0, Logistica.Faltando(t.M, it).Count);
        Assert.Equal(10, it.Entregue.Qtd("ouro"), 6);
        Assert.True(it.Iniciado);
        AjustesTeste.FalharSeErro();
    }

    [Fact]
    public void Material_a_caminho_nao_conta_como_faltando()
    {
        var (t, r) = Reino();
        var vila = Vila(t, r);
        vila.Estoque.Somar("ouro", 500);   // mais do que uma pessoa carrega numa viagem: fica em Pendente
        t.M.Sujar(vila);
        var it = Item(t, r, Obras.Fila, Custo(("ouro", 500)));
        Assert.Empty(Logistica.Faltando(t.M, it));
        Filas.Avaliar(t.M, r);
        Assert.Equal(500, Tudo(t, r, "ouro"), 6);
        Assert.Equal(0, vila.Estoque.Qtd("ouro"), 6);
    }

    // ---------------------------------------------------------------- feridos

    [Fact]
    public void Entrar_na_fila_de_cura_sem_ervas_nao_salva_ninguem()
    {
        var (t, r) = Reino();
        Feridos.Adicionar(t.M, r, new Dictionary<string, int> { ["lanceiro"] = 3 }, "Teste");
        var it = Feridos.Curar(t.M, r);
        Assert.True(it.Aguardando);
        Assert.Equal(3, it.Qtd);
        Assert.Equal(3 * t.M.P.Feridos.Ervas, it.Custo.Qtd("ervas"));
        Assert.Equal(3, Feridos.Total(r));                     // continuam nos lotes, com o prazo correndo
        Assert.Equal(0, Feridos.SemFila(r));
        Assert.Contains("já estão na fila", Assert.Throws<RegraException>(() => Feridos.Curar(t.M, r)).Message);
        t.AvancarHoras(t.M.P.Feridos.EsperaH + 1);
        Assert.Equal(0, Feridos.Total(r));
        Assert.Empty(r.Fila(Feridos.Fila).Itens);              // sem ninguém para curar, o item sai
        AjustesTeste.FalharSeErro();
    }

    [Fact]
    public void Ervas_que_chegam_a_tempo_curam_os_que_estavam_na_fila()
    {
        var (t, r) = Reino();
        Feridos.Adicionar(t.M, r, new Dictionary<string, int> { ["lanceiro"] = 2 }, "Teste");
        var it = Feridos.Curar(t.M, r);
        var ocupando = Feridos.Ocupando(t.M, r);
        t.AvancarHoras(1);
        t.DarRecursos(r, 2 * t.M.P.Feridos.Ervas, "ervas");
        Filas.Avaliar(t.M, r);
        Assert.False(it.Aguardando);
        Assert.True(it.Iniciado);
        Assert.Equal(0, Feridos.Total(r));
        Assert.Equal(ocupando, Feridos.Ocupando(t.M, r));      // sem contar duas vezes
        t.AvancarHoras(t.M.P.Feridos.CuraH + 0.1);
        Assert.Equal(2, Castelo(t, r).Guarnicao.GetValueOrDefault("lanceiro"));
        AjustesTeste.FalharSeErro();
    }

    [Fact]
    public void Cura_que_aguarda_encolhe_quando_feridos_morrem()
    {
        var (t, r) = Reino();
        Feridos.Adicionar(t.M, r, new Dictionary<string, int> { ["lanceiro"] = 2 }, "Primeiro", t.M.Agora + T.Hora);
        Feridos.Adicionar(t.M, r, new Dictionary<string, int> { ["lanceiro"] = 1 }, "Segundo", t.M.Agora + T.Dia);
        var it = Feridos.Curar(t.M, r);
        Assert.Equal(3, it.Qtd);
        t.AvancarHoras(2);
        Assert.Equal(1, it.Qtd);
        Assert.Equal(t.M.P.Feridos.Ervas, it.Custo.Qtd("ervas"));
        Assert.Equal("Cura de 1 ferido", it.Rotulo);
        t.DarRecursos(r, t.M.P.Feridos.Ervas, "ervas");
        Filas.Avaliar(t.M, r);
        Assert.False(it.Aguardando);
        Assert.Equal(0, Feridos.Total(r));
        AjustesTeste.FalharSeErro();
    }

    // ---------------------------------------------------------------- pessoas na reserva

    [Fact]
    public void Treino_que_aguarda_gente_comeca_quando_ha_civil_livre()
    {
        var (t, r) = Reino();
        t.DarRecursos(r, 1000, "comida", "madeira", "pedra", "ferro", "couro");
        var bloco = Item(t, r, Recrutamento.Fila, Custo(("ouro", 1)));   // segura a fila: chegou a vez dele e não há ouro
        var it = Recrutamento.Recrutar(t.M, r, r.CasteloId, "lanceiro", 1);
        foreach (var p in PS.Civis(t.M, r.Id).ToList()) PS.Remover(t.M, p);
        Filas.Cancelar(t.M, r, Recrutamento.Fila, bloco.Id);
        t.AvancarMin(0);
        Assert.True(it.Aguardando);
        var s = Filas.Situacoes(t.M, r)[it.Id];
        Assert.Contains("população", s.Impedimento);
        Assert.Empty(s.Faltam);
        t.AvancarHoras(2);                                                 // nascem pessoas
        Assert.False(it.Aguardando);
        Assert.Single(PS.EmTreino(t.M, r, it).Concat(t.M.PessoasDe(r.Id).Where(p => p.Oficio == "lanceiro")).DistinctBy(p => p.Id));
        AjustesTeste.FalharSeErro();
    }

    [Fact]
    public void Item_seguinte_so_tira_a_pessoa_na_vez_dele()
    {
        var (t, r) = Reino();
        t.DarRecursos(r, 1000, "comida", "madeira", "pedra", "ferro", "couro");
        var pop = r.Pop;
        var a = Recrutamento.Recrutar(t.M, r, r.CasteloId, "lanceiro", 1);
        var b = Recrutamento.Recrutar(t.M, r, r.CasteloId, "lanceiro", 1);
        Assert.False(a.Aguardando);
        Assert.True(b.Aguardando);
        Assert.Equal(pop - 1, r.Pop);
        Assert.Empty(PS.EmTreino(t.M, r, b));
        t.Avancar(TimeSpan.FromSeconds(a.DuracaoSeg + 1));
        Assert.False(b.Aguardando);
        Assert.Single(PS.EmTreino(t.M, r, b));
        AjustesTeste.FalharSeErro();
    }

    // ---------------------------------------------------------------- atenção

    [Fact]
    public void Fila_parada_aparece_na_tela_de_atencao_com_o_que_falta()
    {
        var (t, r) = Reino();
        var it = Item(t, r, Obras.Fila, Custo(("ouro", 12)));
        var parada = Assert.Single(PrecisaDeVoce.Listar(t.M, r), x => x.Titulo.StartsWith("Fila parada"));
        Assert.Contains(it.Rotulo, parada.Titulo);
        Assert.Contains("12 ouro", parada.Texto);
        Assert.Contains("cancele", parada.Texto);
        Assert.DoesNotContain(PrecisaDeVoce.Listar(t.M, r), x => x.Titulo.Contains("esperando material"));
        t.DarRecursos(r, 12, "ouro");
        Filas.Avaliar(t.M, r);
        Assert.DoesNotContain(PrecisaDeVoce.Listar(t.M, r), x => x.Titulo.StartsWith("Fila parada"));
    }

    // ---------------------------------------------------------------- IA e jogador ausente

    [Fact]
    public void IA_sem_recurso_nao_enche_a_fila()
    {
        var t = MundoIA.Novo(criar: false);
        var ia = MundoIA.Criar(t, "expansionista", "ativo");
        Zerar(t, ia);
        Governo.Sessao(t.M, ia, MundoIA.Conduta(t, ia));
        Assert.Empty(ia.Filas.Values.SelectMany(f => f.Itens));
        Assert.False(t.M.ExigirRecursos);
    }

    [Fact]
    public void IA_em_72h_nao_acumula_item_parado_nem_trava()
    {
        var t = MundoIA.Novo(criar: false);
        var perfis = new[] { "expansionista", "defensivo", "saqueador", "comerciante" }.Select(p => MundoIA.Criar(t, p, "ativo")).ToList();
        var niveis = perfis.ToDictionary(r => r.Id, r => t.M.Locais[r.CasteloId].Nivel);
        var maiorParado = 0;
        for (var h = 0; h < 72; h++)
        {
            t.AvancarHoras(1);
            foreach (var r in perfis)
            {
                Assert.True(r.Filas.Values.All(f => f.Itens.Count <= Fila.Maximo));
                Assert.True(r.Filas.Values.All(f => f.Itens.Count(i => i.Iniciado) <= 1));
                maiorParado = Math.Max(maiorParado, r.Filas.Values.Count(f => f.Itens.Count > 0 && f.Itens[0].Aguardando && m_Antigo(t, f.Itens[0])));
            }
        }
        AjustesTeste.FalharSeErro();
        Assert.Equal(0, maiorParado);
        Assert.All(perfis, r => Assert.True(t.M.Locais[r.CasteloId].Nivel > niveis[r.Id], r.PerfilIA + " não cresceu"));
    }

    private static bool m_Antigo(MundoTeste t, ItemFila i) => t.M.Agora - i.CriadoEm > T.Dia + 7 * T.Hora;

    [Fact]
    public void IA_desiste_do_item_parado_ha_mais_de_um_dia()
    {
        var t = MundoIA.Novo(criar: false);
        var ia = MundoIA.Criar(t, "defensivo");
        var it = Item(t, ia, Obras.Fila, Custo(("ouro", 1e6)));
        Governo.DesistirDoParado(t.M, ia);
        Assert.Contains(ia.Fila(Obras.Fila).Itens, i => i.Id == it.Id);
        t.M.Em(t.M.Agora + T.Dia + T.Min, () => Governo.DesistirDoParado(t.M, ia));
        Assert.DoesNotContain(ia.Fila(Obras.Fila).Itens, i => i.Id == it.Id);
    }

    [Fact]
    public void Jogador_ausente_mantem_a_fila_e_o_item_comeca_sozinho()
    {
        var t = MundoIA.Novo(criar: false);
        var j = MundoIA.Jogador(t, 0);
        Zerar(t, j);
        var it = Item(t, j, Obras.Fila, Custo(("ouro", 10)));
        t.AvancarHoras(96);   // quatro dias sem entrar, com a IA ligada no mundo
        AjustesTeste.FalharSeErro();
        Assert.Null(Sessoes.De(t.M, j));                        // ninguém governa o reino de um jogador
        Assert.Null(j.SessaoIAEventoId);
        var fila = j.Fila(Obras.Fila).Itens;
        Assert.Equal(it.Id, fila[0].Id);                        // o item do jogador continua lá, na frente
        Assert.True(it.Aguardando);
        t.DarRecursos(j, 10, "ouro");
        Filas.Avaliar(t.M, j);
        Assert.False(it.Aguardando);                           // começa sozinho, com o jogador fora
        AjustesTeste.FalharSeErro();
    }

    // ---------------------------------------------------------------- API

    [Fact]
    public async Task Pela_api_entra_na_fila_sem_recurso_mostra_o_que_falta_e_cancela_uma_vez()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var c = s.NovoCliente();
        await c.ContaComReino("filas@exemplo.com", "Pedralva");
        var (sv, item) = await c.Post("veiculos", new { tipo = "carrocao", qtd = 1 });
        Assert.Equal(HttpStatusCode.Created, sv);
        Assert.True(item.GetProperty("aguardando").GetBoolean());
        Assert.Equal(JsonValueKind.Null, item.TryGetProperty("fim", out var fim) ? fim.ValueKind : JsonValueKind.Null);
        var (_, reino) = await c.Get("reino");
        var naFila = reino.GetProperty("filas").GetProperty("obras").EnumerateArray().Single(i => i.GetProperty("id").GetInt64() == item.GetProperty("id").GetInt64());
        Assert.True(naFila.GetProperty("posicao").GetInt32() >= 1);
        if (naFila.GetProperty("posicao").GetInt32() == 1)
        {
            Assert.Equal("recursos", naFila.GetProperty("estado").GetString());
            Assert.True(naFila.GetProperty("faltam").GetProperty("cavalo").GetDouble() > 0);
        }
        var (_, agora) = await c.Get("agora");
        Assert.Contains("Fila parada", agora.ToString());
        var id = item.GetProperty("id").GetInt64();
        Assert.Equal(HttpStatusCode.NoContent, (await c.Del("filas/obras/" + id)).status);
        Assert.Equal(HttpStatusCode.NotFound, (await c.Del("filas/obras/" + id)).status);
    }
}
