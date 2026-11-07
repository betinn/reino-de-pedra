using System.Text.Json.Nodes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Mapa;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Pessoas;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using ReinoDePedra.Jogo.Valiosos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Testes;

/// <summary>Caravanas, veículos, salgadeira, extração, escavação e relíquias lendárias.</summary>
public class ValiososTestes
{
    // ---------------------------------------------------------------- ajudantes

    private static Local Castelo(MundoTeste t, Reino r) => t.M.Locais[r.CasteloId];
    private static Local LocalDe(MundoTeste t, Reino r, TipoLocal tipo, string? produz = null) =>
        t.M.LocaisDe(r.Id).First(l => l.Tipo == tipo && (produz == null || l.Produz == produz));

    /// <summary>Hexágono livre fora do rio a exatamente <paramref name="dist"/> do castelo.</summary>
    private static int HexLivre(MundoTeste t, Reino r, int dist, int pular = 0) =>
        t.M.G.Area(Castelo(t, r).Hex, dist).Where(h => t.M.G.Distancia(h, Castelo(t, r).Hex) == dist && Obras.HexLivre(t.M, h) && !t.M.Mapa.Rio[h]).Skip(pular).First();

    private static void Guarnecer(MundoTeste t, Reino r, Local l, string unidade, int n)
    {
        Economia.Atualizar(t.M, r);
        l.Guarnicao[unidade] = l.Guarnicao.GetValueOrDefault(unidade) + n;
        Pessoas.RemoverCivis(t.M, r, t.B.U[unidade].Pop * n);
        t.M.Sujar(l); t.M.Sujar(r);
    }

    private static void AvancarAte(MundoTeste t, long instante) => t.Avancar(TimeSpan.FromMilliseconds(Math.Max(0, instante - t.M.Agora)));

    private static Jazida NovaJazida(MundoTeste t, Reino r, string recurso, double qtd, int dist = 6, bool descoberta = true)
    {
        var j = t.M.Jazidas.Adicionar(new Jazida { Hex = HexLivre(t, r, dist), Recurso = recurso, Inicial = qtd, Restante = qtd });
        if (descoberta) j.DescobertaPor.Add(r.Id);
        Nevoas.RevelarArea(t.M, r.Id, j.Hex, 2);
        return j;
    }

    private static Ruina NovaRuina(MundoTeste t, Reino r, string tipo, int dist = 6)
    {
        var ru = t.M.Ruinas.Adicionar(new Ruina { Hex = HexLivre(t, r, dist), TipoReliquia = tipo });
        Nevoas.RevelarArea(t.M, r.Id, ru.Hex, 2);
        return ru;
    }

    private static Exercito Exercito(MundoTeste t, long id) => (Exercito)t.M.Marchas[id];

    // ---------------------------------------------------------------- veículos

    [Fact]
    public void Carrocao_exige_cavalos_de_raca_e_fica_no_castelo()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        t.DarRecursos(r);
        var ex = Assert.Throws<RegraException>(() => Veiculos.Construir(t.M, r, "carrocao", 1));
        Assert.Contains("cavalos de raça", ex.Message);
        Assert.Empty(r.Fila(Obras.Fila).Itens);
        t.DarRecursos(r, 2, "cavalo");
        var item = Veiculos.Construir(t.M, r, "carrocao", 1);
        Assert.Equal(t.M.P.Veiculo.Tempo["carrocao"], item.DuracaoSeg);
        Assert.Equal(0, Castelo(t, r).Estoque.Qtd("cavalo"), 6);
        t.Avancar(TimeSpan.FromSeconds(item.DuracaoSeg + 1));
        Assert.Equal(1, r.Veiculos["carrocao"]);
    }

    [Fact]
    public void Carroca_e_feita_na_fila_de_obras_do_castelo()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        t.DarRecursos(r);
        var item = Veiculos.Construir(t.M, r, "carroca", 3);
        Assert.Equal(Castelo(t, r).Id, item.LocalId);
        Assert.Equal(t.M.P.Veiculo.Tempo["carroca"] * 3, item.DuracaoSeg);
        Assert.Equal(t.B.VEICULOS["carroca"].Custo["madeira"] * 3, item.Custo.Qtd("madeira"));
        t.Avancar(TimeSpan.FromSeconds(item.DuracaoSeg + 1));
        Assert.Equal(3, Veiculos.Livres(r, "carroca"));
        Assert.Throws<RegraException>(() => Veiculos.Construir(t.M, r, "biga", 1));
    }

    // ---------------------------------------------------------------- caravanas

    [Fact]
    public void Caravana_busca_na_origem_reserva_ao_chegar_entrega_e_volta()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        r.Veiculos["carroca"] = 1;
        var serraria = LocalDe(t, r, TipoLocal.Serraria);
        var vila = LocalDe(t, r, TipoLocal.Vila);
        Economia.Atualizar(t.M, r);
        serraria.Estoque["madeira"] = Economia.Capacidade(t.M, serraria, "madeira");   // cheio: não cresce no caminho
        var madeiraVila = vila.Estoque.Qtd("madeira");
        var c = Caravanas.Enviar(t.M, r, new PedidoCaravana(serraria.Id, vila.Id, new Dictionary<string, double> { ["madeira"] = 20 },
            new Dictionary<string, int> { ["carroca"] = 1 }, null));
        Assert.Equal(Caravana.Buscar, c.Fase);
        Assert.Equal(0, Veiculos.Livres(r, "carroca"));
        Assert.Equal(Castelo(t, r).Hex, c.Caminho[0]);
        Assert.Equal(serraria.Hex, c.Destino);
        Assert.Equal(t.B.VEICULOS["carroca"].Vel, c.Vel);
        var cheia = serraria.Estoque.Qtd("madeira");
        // perna 1: a carga ainda não saiu da origem
        AvancarAte(t, c.Chegada - 1000);
        Economia.Atualizar(t.M, r);
        Assert.Equal(cheia, serraria.Estoque.Qtd("madeira"), 3);
        AvancarAte(t, c.Chegada);
        Assert.Equal(Caravana.Levar, c.Fase);
        Assert.Equal(20, c.Carga.Qtd("madeira"), 6);
        Assert.Equal(cheia - 20, serraria.Estoque.Qtd("madeira"), 3);
        Assert.Equal(vila.Hex, c.Destino);
        // perna 2: entrega no destino e volta ao castelo
        AvancarAte(t, c.Chegada);
        Economia.Atualizar(t.M, r);
        Assert.Equal(madeiraVila + 20, vila.Estoque.Qtd("madeira"), 3);
        Assert.Equal(Caravana.Voltar, c.Fase);
        Assert.Equal(Castelo(t, r).Hex, c.Destino);
        AvancarAte(t, c.Chegada);
        Assert.False(t.M.Marchas.ContemId(c.Id));
        Assert.Equal(1, Veiculos.Livres(r, "carroca"));
        Assert.Contains(t.M.Notificacoes, n => n.ReinoId == r.Id && n.Titulo == "Caravana chegou");
    }

    [Fact]
    public void Caravana_valida_capacidade_veiculos_estoque_e_valiosos()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        var vila = LocalDe(t, r, TipoLocal.Vila);
        PedidoCaravana P(double madeira, int carrocas, string rec = "madeira", long? destino = null, Dictionary<string, int>? tropas = null) =>
            new(c.Id, destino ?? vila.Id, new Dictionary<string, double> { [rec] = madeira }, new Dictionary<string, int> { ["carroca"] = carrocas }, tropas);
        Assert.Contains("carroças livres", Assert.Throws<RegraException>(() => Caravanas.Enviar(t.M, r, P(50, 1))).Message);
        r.Veiculos["carroca"] = 1;
        Assert.Contains("não cabe", Assert.Throws<RegraException>(() => Caravanas.Enviar(t.M, r, P(61, 1))).Message);
        Assert.Contains("só tem", Assert.Throws<RegraException>(() => Caravanas.Enviar(t.M, r, new PedidoCaravana(vila.Id, c.Id,
            new Dictionary<string, double> { ["ouro"] = 40 }, new Dictionary<string, int> { ["carroca"] = 1 }, null))).Message);
        t.DarRecursos(r, 100, "ouro");
        Assert.Contains("Valiosos", Assert.Throws<RegraException>(() => Caravanas.Enviar(t.M, r, P(50, 1, "ouro"))).Message);
        Assert.Contains("Escolha carroças ou tropas", Assert.Throws<RegraException>(() =>
            Caravanas.Enviar(t.M, r, new PedidoCaravana(c.Id, vila.Id, new Dictionary<string, double> { ["madeira"] = 10 }, null, null))).Message);
        // pouco protegida: só aviso
        var pl = Caravanas.Planejar(t.M, r, P(50, 1));
        Assert.Null(pl.Problema);
        Assert.True(pl.PoucoProtegida);
        Guarnecer(t, r, c, "lanceiro", 5);
        pl = Caravanas.Planejar(t.M, r, P(50, 1, tropas: new() { ["lanceiro"] = 5 }));
        Assert.False(pl.PoucoProtegida);
        Assert.Equal(t.B.VEICULOS["carroca"].Carga + 5 * t.B.U["lanceiro"].Carga, pl.Capacidade);
    }

    [Fact]
    public void Caravana_sem_veiculo_leva_na_carga_das_tropas()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        var vila = LocalDe(t, r, TipoLocal.Vila);
        Guarnecer(t, r, vila, "lanceiro", 5);
        var carga = 5 * t.B.U["lanceiro"].Carga;
        Assert.Throws<RegraException>(() => Caravanas.Enviar(t.M, r, new PedidoCaravana(c.Id, vila.Id,
            new Dictionary<string, double> { ["pedra"] = carga + 1 }, null, new Dictionary<string, int> { ["lanceiro"] = 5 }, vila.Id)));
        var cv = Caravanas.Enviar(t.M, r, new PedidoCaravana(c.Id, vila.Id, new Dictionary<string, double> { ["pedra"] = carga },
            null, new Dictionary<string, int> { ["lanceiro"] = 5 }, vila.Id));
        Assert.Equal(vila.Hex, cv.Caminho[0]);   // as tropas saem da vila, buscam no castelo e voltam
        Assert.Equal(0, vila.Guarnicao.GetValueOrDefault("lanceiro"));
        Assert.Equal(5, Economia.Tropas(t.M, r));   // a escolta ocupa o teto
        var pedra = vila.Estoque.Qtd("pedra");
        AvancarAte(t, cv.Chegada);
        AvancarAte(t, cv.Chegada);
        Assert.False(t.M.Marchas.ContemId(cv.Id));   // destino = base: entrega e fica
        Assert.Equal(pedra + carga, vila.Estoque.Qtd("pedra"), 3);
        Assert.Equal(5, vila.Guarnicao["lanceiro"]);
    }

    [Fact]
    public void Caravana_roubada_no_caminho_entrega_a_carga_ao_vencedor_e_perde_as_carrocas()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var inimigo = t.NovoReino();
        r.Veiculos["carroca"] = 2;
        var c = Castelo(t, r);
        var vila = LocalDe(t, r, TipoLocal.Vila);
        t.DarRecursos(r, 5000, "madeira");
        var cv = Caravanas.Enviar(t.M, r, new PedidoCaravana(c.Id, vila.Id, new Dictionary<string, double> { ["madeira"] = 100 },
            new Dictionary<string, int> { ["carroca"] = 2 }, null));
        Assert.Equal(Caravana.Levar, cv.Fase);   // saiu da origem (o castelo) já carregada
        Assert.Equal(100, cv.Carga.Qtd("madeira"), 6);
        var ci = Castelo(t, inimigo);
        Guarnecer(t, inimigo, ci, "cavalaria", 20);
        var ladrao = Exercitos.Enviar(t.M, inimigo, ci.Id, new Dictionary<string, int> { ["cavalaria"] = 20 }, HexLivre(t, inimigo, 2), OrdemMover.Id);
        cv.AoSerVencida(t.M, ladrao);
        Assert.Equal(100, ladrao.Carga.Qtd("madeira"), 6);   // 20 cavaleiros levam 200
        Assert.False(t.M.Marchas.ContemId(cv.Id));
        Assert.Equal(0, Veiculos.Livres(r, "carroca"));
        Assert.Contains(t.M.Notificacoes, n => n.ReinoId == r.Id && n.Titulo == "Caravana roubada");
    }

    // ---------------------------------------------------------------- salgadeira

    [Fact]
    public void Salgadeira_dobra_o_estoque_de_comida_do_local()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var vila = LocalDe(t, r, TipoLocal.Vila);
        var antes = Economia.Capacidade(t.M, vila, "comida");
        Assert.Equal(t.M.F.Producao(vila.Nivel) * t.M.P.EstoqueHoras, antes, 6);
        Assert.Contains("sal", Assert.Throws<RegraException>(() => Salgadeiras.Construir(t.M, r, vila.Id)).Message);
        Assert.Throws<RegraException>(() => Salgadeiras.Construir(t.M, r, LocalDe(t, r, TipoLocal.Serraria).Id));
        t.DarRecursos(r, 1000, "sal", "madeira");
        var item = Salgadeiras.Construir(t.M, r, vila.Id);
        Assert.Throws<RegraException>(() => Salgadeiras.Construir(t.M, r, vila.Id));
        Assert.Equal(t.M.P.Salgadeira.Tempo, item.DuracaoSeg);
        t.AvancarHoras(3);   // o material vai a pé até a vila e a obra leva 1 h
        Assert.True(vila.Salgadeira);
        Assert.Equal(t.M.F.Producao(vila.Nivel) * t.M.P.Salgadeira.Horas, Economia.Capacidade(t.M, vila, "comida"), 6);
        Assert.Equal(2 * antes, Economia.Capacidade(t.M, vila, "comida"), 6);
        // o estoque passa das 10 h e para nas 20 h
        Economia.Atualizar(t.M, r);
        vila.Estoque["comida"] = 0;
        t.AvancarHoras(30);
        Economia.Atualizar(t.M, r);
        Assert.InRange(vila.Estoque.Qtd("comida"), antes * 1.5, 2 * antes + 1e-6);
    }

    // ---------------------------------------------------------------- extração

    private static (MundoTeste t, Reino r, Jazida j, Local c) CenarioExtracao(string recurso = "prata", double qtd = 2000, int lanceiros = 6)
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var j = NovaJazida(t, r, recurso, qtd);
        var c = Castelo(t, r);
        Guarnecer(t, r, c, "lanceiro", lanceiros);
        return (t, r, j, c);
    }

    [Fact]
    public void Extracao_rende_no_ritmo_da_formula_e_volta_com_a_carga_cheia()
    {
        var (t, r, j, c) = CenarioExtracao();
        var g = new Dictionary<string, int> { ["lanceiro"] = 6 };
        var ex = Extracoes.Enviar(t.M, r, c.Id, g, j.Hex, Extracoes.OrdemExtrair, false, new JsonObject());
        AvancarAte(t, ex.Chegada);
        Assert.Equal(j.Id, ex.ExtraiJazidaId);
        Assert.True(ex.Parado);
        var ritmo = t.M.F.ExtracaoH(g, false, false) / t.M.P.Valor["prata"];
        t.AvancarHoras(5);
        Extracoes.Liquidar(t.M, j);
        Assert.Equal(ritmo * 5, ex.Carga.Qtd("prata"), 3);
        Assert.Equal(2000 - ritmo * 5, j.Restante, 3);
        // a carga enche (6 lanceiros levam 30) e o grupo leva ao castelo (o depósito mais próximo)
        var cheia = ex.CargaMax(t.M);
        var prata0 = c.Estoque.Qtd("prata");
        t.AvancarHoras(cheia / ritmo - 5 + 0.01);
        Assert.Null(ex.ExtraiJazidaId);
        Assert.Equal(Extracoes.OrdemEntregar, ex.Ordem);
        Assert.Equal(cheia, ex.Carga.Qtd("prata"), 3);
        AvancarAte(t, ex.Chegada);
        Assert.False(t.M.Marchas.ContemId(ex.Id));   // sem "repetir", ficam no castelo
        Assert.Equal(prata0 + cheia, c.Estoque.Qtd("prata"), 3);
        Assert.Equal(6, c.Guarnicao["lanceiro"]);
        Assert.Contains(t.M.Relatorios, x => x.ReinoId == r.Id && x.Tipo == "extracao");
    }

    [Fact]
    public void Extracao_com_repetir_volta_a_jazida_ate_ela_esgotar()
    {
        var (t, r, j, c) = CenarioExtracao("prata", 500);
        var ex = Extracoes.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 6 }, j.Hex, Extracoes.OrdemExtrair, false, new JsonObject { ["repetir"] = true });
        var prata0 = c.Estoque.Qtd("prata");
        t.AvancarHoras(60);   // várias cargas (30 cada) entregues
        Assert.True(t.M.Marchas.ContemId(ex.Id));
        Assert.True(c.Estoque.Qtd("prata") >= prata0 + 200 - 1e-6);
        Assert.True(ex.Ordem == Extracoes.OrdemExtrair);   // voltou à jazida
        t.AvancarHoras(80);   // o resto acaba com a jazida
        Assert.Equal(0, j.Restante, 6);
        Assert.False(t.M.Marchas.ContemId(ex.Id));
        Assert.Equal(prata0 + 500, c.Estoque.Qtd("prata"), 3);
        Assert.Contains(t.M.Notificacoes, n => n.ReinoId == r.Id && n.Titulo == "Jazida esgotada");
    }

    [Fact]
    public void Jazida_finita_esgota_e_dois_grupos_dividem_o_que_resta()
    {
        var (t, r, j, c) = CenarioExtracao("prata", 30, 6);
        var a = Extracoes.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 3 }, j.Hex, Extracoes.OrdemExtrair, false, new JsonObject());
        var b = Extracoes.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 3 }, j.Hex, Extracoes.OrdemExtrair, false, new JsonObject());
        AvancarAte(t, Math.Max(a.Chegada, b.Chegada));
        Assert.Equal(2, j.Extratores.Count);
        var ritmo = t.M.F.ExtracaoH(new Dictionary<string, int> { ["lanceiro"] = 3 }, false, false) / t.M.P.Valor["prata"];
        t.AvancarHoras(30 / (2 * ritmo) + 0.01);
        Assert.Equal(0, j.Restante, 6);
        Assert.Equal(30, a.Carga.Qtd("prata") + b.Carga.Qtd("prata"), 3);
        Assert.Equal(15, a.Carga.Qtd("prata"), 3);
        Assert.Empty(j.Extratores);
        Assert.Throws<RegraException>(() => Extracoes.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 1 }, j.Hex, Extracoes.OrdemExtrair, false, new JsonObject()));
    }

    [Fact]
    public void Extracao_ate_6_tropas_e_so_jazida_descoberta()
    {
        var (t, r, j, c) = CenarioExtracao("ouro", 1000, 12);
        var max = t.M.P.Extracao.MaxTropas;
        Assert.Contains(max.ToString(), Assert.Throws<RegraException>(() =>
            Extracoes.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = max + 1 }, j.Hex, Extracoes.OrdemExtrair, false, new JsonObject())).Message);
        Extracoes.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 4 }, j.Hex, Extracoes.OrdemExtrair, false, new JsonObject());
        Assert.Throws<RegraException>(() => Extracoes.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 3 }, j.Hex, Extracoes.OrdemExtrair, false, new JsonObject()));
        Extracoes.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 2 }, j.Hex, Extracoes.OrdemExtrair, false, new JsonObject());
        var oculta = NovaJazida(t, r, "gema", 500, 4, descoberta: false);
        Assert.Contains("jazida conhecida", Assert.Throws<RegraException>(() =>
            Extracoes.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 1 }, oculta.Hex, Extracoes.OrdemExtrair, false, new JsonObject())).Message);
        // acima do máximo o ritmo não cresce (fórmula com no máximo P.extracao.maxTropas)
        Assert.Equal(t.M.F.ExtracaoH(new Dictionary<string, int> { ["lanceiro"] = max }, false, false),
            t.M.F.ExtracaoH(new Dictionary<string, int> { ["lanceiro"] = max + 3 }, false, false) , 6);
    }

    [Fact]
    public void Posto_acelera_a_extracao_e_rota_no_caminho_tambem()
    {
        var (t, r, j, c) = CenarioExtracao("ouro");   // ouro sai devagar: a carga não enche durante o teste
        t.DarRecursos(r);
        var g = new Dictionary<string, int> { ["lanceiro"] = 4 };
        var ex = Extracoes.Enviar(t.M, r, c.Id, g, j.Hex, Extracoes.OrdemExtrair, false, new JsonObject());
        AvancarAte(t, ex.Chegada);
        var item = Postos.Construir(t.M, r, j.Hex);
        Assert.Throws<RegraException>(() => Postos.Construir(t.M, r, j.Hex));
        t.AvancarHoras(2);
        Assert.DoesNotContain(r.Fila(Obras.Fila).Itens, i => i.Id == item.Id);
        var posto = Extracoes.PostoNoHex(t.M, j.Hex);
        Assert.NotNull(posto);
        Assert.Equal(r.Id, posto!.ReinoId);
        Assert.Equal(0, r.Fundados);   // o posto não encarece o próximo local
        Extracoes.Liquidar(t.M, j);
        var antes = ex.Carga.Qtd("ouro");
        t.AvancarHoras(3);
        Extracoes.Liquidar(t.M, j);
        var valor = t.M.P.Valor["ouro"];
        Assert.Equal(t.M.F.ExtracaoH(g, true, false) / valor * 3, ex.Carga.Qtd("ouro") - antes, 3);
        Assert.Equal(t.M.P.Extracao.Posto, t.M.F.ExtracaoH(g, true, false) / t.M.F.ExtracaoH(g, false, false), 6);
        // rota pública na maior parte do caminho até o depósito: ×1,2
        var rota = Caminhos.Calcular(t.M, j.Hex, c.Hex, "Lenta");
        Assert.False(Extracoes.RotaNoCaminho(t.M, rota));
        foreach (var h in rota.Hexes) t.M.Vias.Rotas.Add(h);
        Assert.True(Extracoes.RotaNoCaminho(t.M, Caminhos.Calcular(t.M, j.Hex, c.Hex, "Lenta")));
        Assert.Equal(t.M.P.Extracao.Rota, Extracoes.Ritmo(t.M, g, "prata", false, true) / Extracoes.Ritmo(t.M, g, "prata", false, false), 6);
        // tropas no próprio posto começam na hora
        Guarnecer(t, r, posto, "lanceiro", 2);
        var dali = Extracoes.Enviar(t.M, r, posto.Id, new Dictionary<string, int> { ["lanceiro"] = 2 }, j.Hex, Extracoes.OrdemExtrair, false, new JsonObject());
        Assert.Equal(j.Id, dali.ExtraiJazidaId);
    }

    [Fact]
    public void Nova_ordem_tira_da_extracao_levando_o_que_ja_tirou()
    {
        var (t, r, j, c) = CenarioExtracao();
        var ex = Extracoes.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 6 }, j.Hex, Extracoes.OrdemExtrair, false, new JsonObject());
        AvancarAte(t, ex.Chegada);
        t.AvancarHoras(4);
        Exercitos.DarOrdem(t.M, r, ex.Id, OrdemRetornar.Id, null);
        Assert.Null(ex.ExtraiJazidaId);
        Assert.Empty(j.Extratores);
        var levam = ex.Carga.Qtd("prata");
        Assert.True(levam > 0);
        Assert.Equal(2000 - levam, j.Restante, 3);
        AvancarAte(t, ex.Chegada);
        Assert.Equal(levam, c.Estoque.Qtd("prata"), 3);
    }

    // ---------------------------------------------------------------- escavação e relíquias

    [Fact]
    public void Escavacao_leva_12_h_com_uma_unidade_e_no_minimo_4_h()
    {
        var t = new MundoTeste();
        var P = t.M.P;
        Assert.Equal(P.Reliquia.EscavarHoras1, Escavacoes.Horas(t.M, new Dictionary<string, int> { ["lanceiro"] = 1 }, false), 6);
        Assert.Equal(P.Reliquia.EscavarHoras1, Escavacoes.Horas(t.M, new Dictionary<string, int> { ["cavalaria"] = 1 }, false), 6);
        Assert.Equal(P.Reliquia.EscavarHoras1 / P.Extracao.Posto, Escavacoes.Horas(t.M, new Dictionary<string, int> { ["lanceiro"] = 1 }, true), 6);
        var dois = Escavacoes.Horas(t.M, new Dictionary<string, int> { ["lanceiro"] = 2 }, false);
        Assert.True(dois < P.Reliquia.EscavarHoras1 && dois > P.Reliquia.EscavarMin);
        Assert.Equal(P.Reliquia.EscavarMin, Escavacoes.Horas(t.M, new Dictionary<string, int> { ["lanceiro"] = 10 }, false), 6);
        Assert.Equal(P.Reliquia.EscavarMin, Escavacoes.Horas(t.M, new Dictionary<string, int> { ["lanceiro"] = 50 }, true), 6);
    }

    [Fact]
    public void Escavar_acha_a_reliquia_do_tipo_da_ruina_esgota_e_o_grupo_a_leva_ao_destino()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        var vila = LocalDe(t, r, TipoLocal.Vila);
        var ru = NovaRuina(t, r, "producao");
        Guarnecer(t, r, c, "lanceiro", 1);
        var ex = Extracoes.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 1 }, ru.Hex, Escavacoes.OrdemEscavar, false,
            new JsonObject { ["destinoLocalId"] = vila.Id });
        AvancarAte(t, ex.Chegada);
        Assert.Equal(ru.Id, ex.EscavaRuinaId);
        Assert.InRange(ex.EscavaFim!.Value - t.M.Agora, (long)(t.M.P.Reliquia.EscavarHoras1 * T.Hora) - 10, (long)(t.M.P.Reliquia.EscavarHoras1 * T.Hora) + 10);
        var fim = ex.EscavaFim.Value;
        AvancarAte(t, fim - T.Min);
        Assert.Empty(t.M.Reliquias);
        Assert.False(ru.Esgotada);
        AvancarAte(t, fim);
        var rel = Assert.Single(t.M.Reliquias);
        Assert.Equal("producao", rel.Tipo);
        Assert.Equal(r.Id, rel.ReinoId);
        Assert.True(ru.Esgotada);
        Assert.False(string.IsNullOrWhiteSpace(rel.Nome));
        Assert.Equal(ex.Id, rel.MarchaId);   // o próprio grupo a carrega
        Assert.Contains(rel.Id, ex.Reliquias);
        Assert.True(ex.Interceptavel);
        Assert.Equal(vila.Hex, ex.Destino);
        AvancarAte(t, ex.Chegada);
        Assert.Equal(vila.Id, rel.LocalId);
        Assert.Null(rel.MarchaId);
        Assert.Equal(1, vila.Guarnicao["lanceiro"]);
        Assert.Contains(t.M.Relatorios, x => x.ReinoId == r.Id && x.Tipo == "reliquia");
        Assert.True(Sistemas.Visto(r, Apresentacao.ReliquiasChave));
        // a ruína esgotada não aceita nova escavação
        Guarnecer(t, r, c, "lanceiro", 1);
        Assert.Throws<RegraException>(() => Extracoes.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 1 }, ru.Hex, Escavacoes.OrdemEscavar, false, new JsonObject()));
    }

    [Fact]
    public void Muitas_tropas_escavam_em_4_h()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        var ru = NovaRuina(t, r, "ataque");
        Guarnecer(t, r, c, "lanceiro", 20);
        var ex = Extracoes.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 20 }, ru.Hex, Escavacoes.OrdemEscavar, false, new JsonObject());
        AvancarAte(t, ex.Chegada);
        var ini = t.M.Agora;
        Assert.InRange(ex.EscavaFim!.Value - ini, (long)(t.M.P.Reliquia.EscavarMin * T.Hora) - 10, (long)(t.M.P.Reliquia.EscavarMin * T.Hora) + 10);
        t.AvancarHoras(t.M.P.Reliquia.EscavarMin + 0.01);
        Assert.Equal("ataque", Assert.Single(t.M.Reliquias).Tipo);
    }

    private static Reliquia DarReliquia(MundoTeste t, Reino r, Local l, string tipo)
    {
        Economia.Atualizar(t.M, r);
        var rel = t.M.Reliquias.Adicionar(new Reliquia { Nome = ReliquiasLendarias.NomeNovo(t.M, tipo), Tipo = tipo, ReinoId = r.Id });
        Reliquias.Guardar(t.M, rel, l);
        return rel;
    }

    [Fact]
    public void Reliquia_de_producao_aumenta_a_producao_do_local_e_varias_somam()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var vila = LocalDe(t, r, TipoLocal.Vila);
        var base0 = Economia.TaxaLocal(t.M, r, vila).Qtd("comida");
        DarReliquia(t, r, vila, "producao");
        Assert.Equal(base0 * (1 + t.M.P.Reliquia.Producao), Economia.TaxaLocal(t.M, r, vila).Qtd("comida"), 6);
        DarReliquia(t, r, vila, "producao");
        Assert.Equal(base0 * (1 + 2 * t.M.P.Reliquia.Producao), Economia.TaxaLocal(t.M, r, vila).Qtd("comida"), 6);
        DarReliquia(t, r, vila, "ataque");   // outro tipo não muda a produção
        Assert.Equal(base0 * (1 + 2 * t.M.P.Reliquia.Producao), Economia.TaxaLocal(t.M, r, vila).Qtd("comida"), 6);
        var serraria = LocalDe(t, r, TipoLocal.Serraria);
        Assert.Equal(t.M.F.ProducaoDe("madeira", serraria.Nivel) * Economia.EficienciaLocal(t.M, serraria), Economia.TaxaLocal(t.M, r, serraria).Qtd("madeira"), 6);
    }

    [Fact]
    public void Reliquias_de_ataque_e_resistencia_dao_bonus_de_combate_pelo_local()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        DarReliquia(t, r, c, "ataque");
        DarReliquia(t, r, c, "resistencia");
        DarReliquia(t, r, c, "resistencia");
        Guarnecer(t, r, c, "lanceiro", 2);
        var ex = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 1 }, HexLivre(t, r, 2), OrdemMover.Id);
        Assert.Equal(t.M.P.Reliquia.Ataque, Jogo.Combate.Bonus.SomaAtaque(t.M, ex), 6);
        Assert.Equal(2 * t.M.P.Reliquia.Resistencia, Jogo.Combate.Bonus.SomaDefesa(t.M, c), 6);
        Assert.Equal(0, Jogo.Combate.Bonus.SomaDefesa(t.M, LocalDe(t, r, TipoLocal.Vila)), 6);
    }

    [Fact]
    public void Visibilidade_uma_so_espionagem_duas_brilho_tres_farol()
    {
        var t = new MundoTeste();
        var dono = t.NovoReino();
        var outro = t.NovoReino();
        var longe = t.NovoReino();
        var mina = LocalDe(t, dono, TipoLocal.Mina, "ferro");
        Nevoas.RevelarArea(t.M, outro.Id, mina.Hex, 2);   // "outro" já explorou a área; "longe", não
        var vazio = new HashSet<int>();
        List<ReliquiaNoMapa> Ve(Reino r) => ReliquiasLendarias.NoMapa(t.M, r.Id, vazio).Where(x => x.LocalId == mina.Id).ToList();
        DarReliquia(t, dono, mina, "ataque");
        Assert.Empty(Ve(outro));
        Assert.Equal("local", Assert.Single(Ve(dono)).Tipo);
        DarReliquia(t, dono, mina, "producao");
        Assert.Equal("brilho", Assert.Single(Ve(outro)).Tipo);
        Assert.Empty(Ve(longe));
        Assert.Empty(Assert.Single(Ve(outro)).Tipos);   // tipos não revelados
        DarReliquia(t, dono, mina, "resistencia");
        Assert.Equal("farol", Assert.Single(Ve(outro)).Tipo);
        Assert.Equal("farol", Assert.Single(Ve(longe)).Tipo);
        Assert.Equal(3, Assert.Single(Ve(longe)).N);
        // ver um farol apresenta o sistema de relíquias
        Assert.False(Sistemas.Visto(longe, Apresentacao.ReliquiasChave));
        Apresentacao.Conferir(t.M, longe);
        Assert.True(Sistemas.Visto(longe, Apresentacao.ReliquiasChave));
    }

    [Fact]
    public void Marcha_com_reliquia_aparece_com_bau_para_quem_a_ve()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var outro = t.NovoReino();
        var c = Castelo(t, r);
        var rel = DarReliquia(t, r, c, "ataque");
        Guarnecer(t, r, c, "lanceiro", 5);
        var ex = ReliquiasLendarias.Mover(t.M, r, rel.Id, c.Id, new Dictionary<string, int> { ["lanceiro"] = 5 }, LocalDe(t, r, TipoLocal.Vila).Id, false);
        var h = ex.HexEm(t.M.Agora);
        Assert.Contains(ReliquiasLendarias.NoMapa(t.M, r.Id, new HashSet<int>()), x => x.Tipo == "marcha" && x.MarchaId == ex.Id && x.Tipos.Single() == "ataque");
        Assert.DoesNotContain(ReliquiasLendarias.NoMapa(t.M, outro.Id, new HashSet<int>()), x => x.MarchaId == ex.Id);
        var vista = Assert.Single(ReliquiasLendarias.NoMapa(t.M, outro.Id, new HashSet<int> { h }), x => x.MarchaId == ex.Id);
        Assert.Empty(vista.Tipos);
    }

    [Fact]
    public void Mover_reliquia_com_escolta_busca_leva_e_guarda_e_ate_ser_pega_fortalece_a_origem()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        var vila = LocalDe(t, r, TipoLocal.Vila);
        var serraria = LocalDe(t, r, TipoLocal.Serraria);
        var rel = DarReliquia(t, r, vila, "producao");
        Guarnecer(t, r, c, "lanceiro", 3);
        Assert.Throws<RegraException>(() => ReliquiasLendarias.Mover(t.M, r, rel.Id, c.Id, new Dictionary<string, int> { ["lanceiro"] = 3 }, vila.Id, false));
        var ex = ReliquiasLendarias.Mover(t.M, r, rel.Id, c.Id, new Dictionary<string, int> { ["lanceiro"] = 3 }, serraria.Id, false);
        Assert.Equal(vila.Hex, ex.Destino);
        Assert.Equal(vila.Id, rel.LocalId);   // ainda fortalece a vila
        Assert.Equal(1, ReliquiasLendarias.Contar(t.M, vila.Id, "producao"));
        Assert.True(Caravanas.PoucoProtegida(t.M, ex.Tropas));
        AvancarAte(t, ex.Chegada);
        Assert.Null(rel.LocalId);
        Assert.Equal(ex.Id, rel.MarchaId);
        Assert.Equal(serraria.Hex, ex.Destino);
        AvancarAte(t, ex.Chegada);
        Assert.Equal(serraria.Id, rel.LocalId);
        Assert.Equal(3, serraria.Guarnicao["lanceiro"]);
    }

    [Fact]
    public void Reliquia_roubada_no_caminho_vai_com_o_vencedor_e_fica_onde_ele_entra()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var inimigo = t.NovoReino();
        var c = Castelo(t, r);
        var rel = DarReliquia(t, r, c, "resistencia");
        Guarnecer(t, r, c, "lanceiro", 2);
        var ex = ReliquiasLendarias.Mover(t.M, r, rel.Id, c.Id, new Dictionary<string, int> { ["lanceiro"] = 2 }, LocalDe(t, r, TipoLocal.Vila).Id, false);
        var ci = Castelo(t, inimigo);
        Guarnecer(t, inimigo, ci, "cavalaria", 10);
        var ladrao = Exercitos.Enviar(t.M, inimigo, ci.Id, new Dictionary<string, int> { ["cavalaria"] = 10 }, HexLivre(t, inimigo, 2), OrdemMover.Id);
        ex.AoSerVencida(t.M, ladrao);
        Assert.Contains(rel.Id, ladrao.Reliquias);
        Exercitos.DarOrdem(t.M, inimigo, ladrao.Id, OrdemRetornar.Id, null);
        AvancarAte(t, ladrao.Chegada);
        Assert.Equal(ci.Id, rel.LocalId);
        Assert.Equal(inimigo.Id, rel.ReinoId);
    }

    // ---------------------------------------------------------------- sistemas apresentados aos poucos

    [Fact]
    public void Transporte_aparece_ao_fundar_o_primeiro_local_longe_do_castelo()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        t.DarRecursos(r);
        Assert.False(Sistemas.Visto(r, Apresentacao.Logistica));
        Assert.False(Sistemas.Estado(r)[Apresentacao.Logistica]);
        var c = Castelo(t, r);
        int Achar(int distMin, int distMax) => t.M.G.Area(c.Hex, distMax).First(h => t.M.G.Distancia(h, c.Hex) >= distMin && Obras.HexLivre(t.M, h)
            && !t.M.Mapa.Rio[h] && t.M.Mapa.Terrenos[h] == Terreno.Planicie);
        var perto = Achar(1, t.M.P.LogisticaLongeHex);
        Nevoas.RevelarArea(t.M, r.Id, perto, 1);   // a pegada inteira do local
        Obras.Fundar(t.M, r, "vila", perto);
        t.AvancarHoras(3);
        Assert.False(Sistemas.Visto(r, Apresentacao.Logistica));
        var longe = Achar(t.M.P.LogisticaLongeHex + 1, t.M.P.LogisticaLongeHex + 4);
        Nevoas.RevelarArea(t.M, r.Id, longe, 1);
        Obras.Fundar(t.M, r, "vila", longe);
        t.AvancarHoras(3);
        Assert.True(Sistemas.Visto(r, Apresentacao.Logistica));
        Assert.Single(t.M.Notificacoes, n => n.ReinoId == r.Id && n.Titulo == "Novo: Transporte de recursos");
        Apresentacao.Conferir(t.M, r);   // uma vez só
        Assert.Single(t.M.Notificacoes, n => n.ReinoId == r.Id && n.Titulo == "Novo: Transporte de recursos");
    }

    [Fact]
    public void Reliquias_aparecem_ao_avistar_a_primeira_ruina_antiga()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var vistas = t.M.Ruinas.Any(ru => Nevoas.Explorado(t.M, r.Id, ru.Hex));
        Apresentacao.Conferir(t.M, r);
        Assert.Equal(vistas, Sistemas.Visto(r, Apresentacao.ReliquiasChave));
        var alvo = t.M.Ruinas.First(ru => !Nevoas.Explorado(t.M, r.Id, ru.Hex));
        Nevoas.RevelarArea(t.M, r.Id, alvo.Hex, 0);
        Apresentacao.Conferir(t.M, r);
        Assert.True(Sistemas.Visto(r, Apresentacao.ReliquiasChave));
        Assert.Contains(t.M.Notificacoes, n => n.ReinoId == r.Id && n.Titulo == "Novo: Relíquias");
    }

    [Fact]
    public void Caravana_e_trabalho_sao_salvos_e_recarregados()
    {
        var dir = Path.Combine(Path.GetTempPath(), "rp-val-" + Guid.NewGuid().ToString("N"));
        var arq = Path.Combine(dir, "t.db");
        try
        {
            var t = new MundoTeste();
            var r = t.NovoReino();
            r.Veiculos["carroca"] = 1;
            var j = NovaJazida(t, r, "prata", 1000);
            var c = Castelo(t, r);
            Guarnecer(t, r, c, "lanceiro", 4);
            var ex = Extracoes.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 4 }, j.Hex, Extracoes.OrdemExtrair, false, new JsonObject { ["repetir"] = true });
            AvancarAte(t, ex.Chegada);
            var cv = Caravanas.Enviar(t.M, r, new PedidoCaravana(c.Id, LocalDe(t, r, TipoLocal.Serraria).Id, new Dictionary<string, double> { ["madeira"] = 10 },
                new Dictionary<string, int> { ["carroca"] = 1 }, null));
            using var db = new Jogo.Persistencia.Banco(arq);
            db.Salvar(t.M);
            Assert.Equal(0, db.SalvarEsquecidos(t.M));   // tudo o que mudou foi marcado com Sujar
            var m2 = new Mundo(Jogo.Config.Balanceamento.Padrao, t.Relogio);
            using (var db2 = new Jogo.Persistencia.Banco(arq)) db2.Carregar(m2);
            m2.PrepararMapa();
            var ex2 = Assert.IsType<Exercito>(m2.Marchas[ex.Id]);
            Assert.Equal(j.Id, ex2.ExtraiJazidaId);
            Assert.True(ex2.Dados["repetir"]!.GetValue<bool>());
            Assert.Contains(ex.Id, m2.Jazidas[j.Id].Extratores);
            Assert.Equal(r.Veiculos.GetValueOrDefault("carroca"), m2.Reinos[r.Id].Veiculos.GetValueOrDefault("carroca"));
            var cv2 = Assert.IsType<Caravana>(m2.Marchas[cv.Id]);
            Assert.Equal(1, cv2.Veiculos["carroca"]);
            Assert.Equal(cv.Fase, cv2.Fase);
            Assert.Equal(10, cv2.Pedido.Qtd("madeira"));
            Assert.Equal(10, cv2.Carga.Qtd("madeira"), 6);
        }
        finally { try { Directory.Delete(dir, true); } catch { } }
    }
}
