using System.Net;
using System.Text.Json;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.IA;
using ReinoDePedra.Jogo.Mapa;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Pessoas;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Valiosos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Testes;

/// <summary>Vida das pessoas (recuperação sem tique, batalha) e coleta de madeira e pedra no mapa.</summary>
public class VidaColetaTestes
{
    private static JsonElement Ref(string n) => Balanceamento.Padrao.Referencia.GetProperty(n);
    private static void AvancarAte(MundoTeste t, long instante) => t.Avancar(TimeSpan.FromMilliseconds(Math.Max(0, instante - t.M.Agora)));

    // ---------------------------------------------------------------- vida

    [Fact]
    public void Vida_maxima_e_ritmo_da_coleta_batem_com_o_modelo()
    {
        var f = new Formulas(Balanceamento.Padrao);
        foreach (var x in Ref("coleta").EnumerateArray())
            Assert.Equal(x.GetProperty("porHora").GetDouble(), f.ColetaH(x.GetProperty("pessoas").GetInt32()), 9);
        foreach (var x in Ref("vida").EnumerateArray())
        {
            var of = x.GetProperty("oficio").GetString()!;
            Assert.Equal(x.GetProperty("max").GetDouble(), f.VidaMax(of, Oficios.EhCivil(of)), 9);
        }
    }

    [Fact]
    public void Vida_se_recupera_com_o_tempo_sem_evento()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var p = t.M.PessoasDe(r.Id).First();
        var max = Vidas.Max(t.M, p);
        var eventos = t.M.Eventos.Count();
        Assert.False(Vidas.Ferir(t.M, p, max / 2));
        Assert.Equal(eventos, t.M.Eventos.Count());   // sem tique: nenhum evento novo
        Assert.Equal(max / 2, Vidas.Atual(t.M, p), 6);
        t.AvancarHoras(t.B.P.Vida.RecuperaH / 4);
        Assert.Equal(max * 0.75, Vidas.Atual(t.M, p), 6);
        Assert.NotNull(Vidas.CheiaEm(t.M, p));
        t.AvancarHoras(t.B.P.Vida.RecuperaH);
        Assert.Equal(max, Vidas.Atual(t.M, p), 6);
        Assert.False(Vidas.Ferida(t.M, p));
        // dano que passa da vida mata (quem chama tira do mundo); "sem morrer" deixa um fio de vida
        Assert.True(Vidas.Ferir(t.M, p, max * 2));
        Assert.False(Vidas.Ferir(t.M, t.M.PessoasDe(r.Id).Skip(1).First(), max * 2, semMorrer: true));
    }

    [Fact]
    public void Batalha_fere_os_sobreviventes_sem_mudar_quem_morre()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, new Dictionary<string, int> { ["lanceiro"] = 4 }, 3);
        var ex = s.Atacar(alvo, new Dictionary<string, int> { ["arqueiro"] = 8 }, CombateCenario.Plano("saque", "semLimite"));
        var b = s.Chegar(ex);
        s.Terminar(b);
        Assert.Equal("vitoria", b.Resultado);
        var esperado = (int)Formulas.ArredJs(8 * b.Marcos[0].PerdaA);
        Assert.Equal(esperado, GT.Total(b.PerdasAtaque));   // a fórmula de perdas continua decidindo quem morre
        var vivos = Pessoas.SoldadosDaMarcha(s.M, ex).ToList();
        Assert.Equal(8 - esperado, vivos.Count);
        var frac = esperado / 8.0;
        Assert.All(vivos, p =>
        {
            Assert.True(Vidas.Ferida(s.M, p));
            Assert.Equal(Vidas.Max(s.M, p) * (1 - frac * s.M.P.Vida.Batalha), Vidas.Atual(s.M, p), 3);
        });
    }

    // ---------------------------------------------------------------- coleta

    private static int HexDe(MundoTeste t, Reino r, string recurso, int pular = 0)
    {
        var c = t.M.Locais[r.CasteloId];
        return t.M.G.Area(c.Hex, 3).Where(h => h != c.Hex && Coletas.Recurso(t.M, h) == recurso && Coletas.Motivo(t.M, r, h) == null)
            .OrderBy(h => t.M.G.Distancia(h, c.Hex)).ThenBy(h => h).Skip(pular).First();
    }

    private static Reino ReinoComFloresta(MundoTeste t, string recurso = "madeira")
    {
        for (var i = 0; i < 8; i++)
        {
            var r = t.NovoReino();
            var c = t.M.Locais[r.CasteloId];
            if (t.M.G.Area(c.Hex, 3).Count(h => Coletas.Recurso(t.M, h) == recurso && Coletas.Motivo(t.M, r, h) == null) >= 2) return r;
        }
        throw new Exception("nenhum reino com " + recurso + " por perto");
    }

    [Fact]
    public void Civis_sem_trabalho_coletam_madeira_e_levam_ao_castelo()
    {
        var t = new MundoTeste();
        var r = ReinoComFloresta(t);
        var c = t.M.Locais[r.CasteloId];
        var ociosos = Pessoas.OciososPresentes(t.M, c).ToList();
        Assert.True(ociosos.Count >= 2);
        var hex = HexDe(t, r, "madeira");
        var livresAntes = Pessoas.LivresParaTreino(t.M, r);
        var ex = Coletas.Enviar(t.M, r, c.Id, null, 2, hex, repetir: false, seguro: false);
        Assert.Equal(2, Pessoas.CivisColetando(t.M, ex));
        Assert.Equal(2 * t.B.P.Coleta.CargaCivil, ex.CargaMax(t.M));
        Assert.Equal(livresAntes - 2, Pessoas.LivresParaTreino(t.M, r));   // fora do local: nem milícia nem recruta
        Assert.All(Pessoas.Coletores(t.M, ex), p => Assert.Equal(Estados.Coletando, p.Estado));
        Assert.Throws<RegraException>(() => Pessoas.Trabalhar(t.M, r, ociosos[0].Id, c.Id));
        AvancarAte(t, ex.Chegada + 1);
        Assert.NotNull(ex.ColetaPontoId);
        var horas = 2 * t.B.P.Coleta.CargaCivil / t.M.F.ColetaH(2);
        t.AvancarHoras(horas + 1);
        Assert.DoesNotContain(ex, t.M.Marchas);
        var rel = Assert.Single(t.M.Relatorios, x => x.ReinoId == r.Id && x.Tipo == "coleta");
        Assert.Contains("madeira", rel.Titulo);
        // os civis voltam a ser civis livres do reino, e as contagens batem
        Assert.All(ociosos.Take(2), p => Assert.NotEqual(Estados.Coletando, t.M.Pessoas.Obter(p.Id)!.Estado));
        t.AvancarHoras(1);
        Assert.Empty(Pessoas.Conferir(t.M));
        // o hexágono perdeu o que foi tirado e já recupera uma parte
        Assert.InRange(Coletas.Disponivel(t.M, hex), t.B.P.Coleta.Estoque - 2 * t.B.P.Coleta.CargaCivil, t.B.P.Coleta.Estoque - 1);
    }

    [Fact]
    public void Coleta_com_repetir_volta_e_o_hexagono_se_esgota_e_se_recupera()
    {
        var t = new MundoTeste();
        var r = ReinoComFloresta(t, "pedra");
        var c = t.M.Locais[r.CasteloId];
        c.Guarnicao["lanceiro"] = 6; t.M.Sujar(c);
        Pessoas.Sincronizar(t.M, c);
        var hex = HexDe(t, r, "pedra");
        Economia.Atualizar(t.M, r);
        var pedraAntes = c.Estoque.Qtd("pedra");
        var ex = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 6 }, hex, Coletas.OrdemColetarId, dados: new System.Text.Json.Nodes.JsonObject { ["repetir"] = true });
        t.AvancarMin(45);   // no ritmo 3×, 6 coletores enchem a carga em ≈ 36 min: uma entrega feita, de volta ao hexágono
        var p = Coletas.Ponto(t.M, hex);
        Assert.NotNull(p);
        Assert.True(Coletas.Disponivel(t.M, hex) < t.B.P.Coleta.Estoque);
        Assert.Contains(ex, t.M.Marchas);   // repete: foi, entregou e voltou
        Assert.True((ex.Dados["coletado"]?.GetValue<double>() ?? 0) > 0);
        // até 6 pessoas por hexágono, por reino
        c.Guarnicao["lanceiro"] = 1; t.M.Sujar(c); Pessoas.Sincronizar(t.M, c);
        Assert.Throws<RegraException>(() => Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 1 }, hex, Coletas.OrdemColetarId));
        // o hexágono se esgota (ou o grupo passa a um vizinho igual); parado o grupo, ele volta a encher
        Exercitos.DarOrdem(t.M, r, ex.Id, OrdemRetornar.Id, null);
        t.AvancarHoras(1);
        Assert.DoesNotContain(ex, t.M.Marchas);
        Assert.True(c.Estoque.Qtd("pedra") > pedraAntes);
        t.AvancarHoras(t.B.P.Coleta.RecuperaH);
        Assert.Equal(t.B.P.Coleta.Estoque, Coletas.Disponivel(t.M, hex), 6);
    }

    [Fact]
    public void Coleta_so_em_floresta_colina_ou_montanha_explorada_sem_local()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = t.M.Locais[r.CasteloId];
        Assert.NotNull(Coletas.Motivo(t.M, r, c.Hex));   // o castelo é um local
        var serraria = t.M.LocaisDe(r.Id).First(l => l.Produz == "madeira");
        Assert.NotNull(Coletas.Motivo(t.M, r, serraria.Hex));
        var planicie = t.M.G.Area(c.Hex, 3).First(h => t.M.Mapa.Terrenos[h] == Terreno.Planicie && t.M.LocalNoHex(h) == null);
        Assert.Contains("floresta", Coletas.Motivo(t.M, r, planicie));
        var longe = Enumerable.Range(0, t.M.G.Total).First(h => !Nevoas.Explorado(t.M, r.Id, h) && Coletas.Recurso(t.M, h) != null);
        Assert.Contains("Explore", Coletas.Motivo(t.M, r, longe));
        Assert.Throws<RegraException>(() => Coletas.Enviar(t.M, r, c.Id, null, 0, planicie, false, false));
    }

    [Fact]
    public void Ia_coleta_quando_falta_madeira_para_a_proxima_obra()
    {
        var t = new MundoTeste();
        var r = ReinoComFloresta(t);
        var c = t.M.Locais[r.CasteloId];
        Economia.Atualizar(t.M, r);
        foreach (var l in t.M.LocaisDe(r.Id)) { l.Estoque["madeira"] = 0; t.M.Sujar(l); }
        Assert.NotNull(Governo.ProximaObra(t.M, r, c));
        Governo.Coletar(t.M, r, c);
        var ex = Assert.Single(Exercitos.De(t.M, r.Id));
        Assert.Equal(Coletas.OrdemColetarId, ex.Ordem);
        Assert.Equal("madeira", Coletas.Recurso(t.M, ex.Destino));
        Assert.True(Pessoas.CivisColetando(t.M, ex) > 0);
        Governo.Coletar(t.M, r, c);   // um grupo por vez
        Assert.Single(Exercitos.De(t.M, r.Id));
    }

    // ---------------------------------------------------------------- API

    [Fact]
    public async Task Api_manda_vida_das_pessoas_e_aceita_coleta()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var cl = s.NovoCliente();
        var reino = await cl.ContaComReino("coleta@exemplo.com", "Pedralva");
        var castelo = reino.GetProperty("casteloId").GetInt64();
        var (_, mapa) = await cl.Get("mapa");
        var pessoa = mapa.GetProperty("pessoas").EnumerateArray().First();
        Assert.Equal(pessoa.GetProperty("vidaMax").GetDouble(), pessoa.GetProperty("vida").GetDouble());
        var id = pessoa.GetProperty("id").GetInt64();
        var (_, folha) = await cl.Get("pessoas/" + id);
        Assert.True(folha.GetProperty("pessoa").GetProperty("vidaMax").GetDouble() > 0);
        Assert.True(folha.GetProperty("pessoa").GetProperty("vida").GetDouble() > 0);

        var hex = await s.Motor.Executar(m =>
        {
            var r = m.Reinos.First(x => x.CasteloId == castelo);
            var c = m.Locais.Obter(castelo)!;
            return m.G.Area(c.Hex, 10).Where(h => Coletas.Motivo(m, r, h) == null).OrderBy(h => m.G.Distancia(h, c.Hex)).ThenBy(h => h).Select(h => (int?)h).FirstOrDefault();
        });
        Assert.NotNull(hex);   // a vaga do primeiro reino tem floresta ou colina por perto
        var (stp, previa) = await cl.Post("coleta/previa", new { deLocalId = castelo, civis = 2, hex });
        Assert.Equal(HttpStatusCode.OK, stp);
        Assert.True(previa.GetProperty("ritmo").GetDouble() > 0);
        Assert.Equal(2, previa.GetProperty("pessoas").GetInt32());
        var (st, ex) = await cl.Post("coleta", new { deLocalId = castelo, civis = 2, hex, repetir = true });
        Assert.Equal(HttpStatusCode.Created, st);
        Assert.Equal("coletar", ex.GetProperty("ordem").GetString());
        await s.Avancar(TimeSpan.FromMinutes(30));
        var (_, mapa2) = await cl.Get("mapa");
        var m2 = mapa2.GetProperty("objetos").EnumerateArray().First(o => o.GetProperty("tipo").GetString() == "marcha" && o.GetProperty("id").GetInt64() == ex.GetProperty("id").GetInt64());
        Assert.Equal("trabalhando", m2.GetProperty("estado").GetString());
        Assert.Equal("coletar", m2.GetProperty("ordem").GetString());
        Assert.False(string.IsNullOrEmpty(m2.GetProperty("recurso").GetString()));
        var (_, lista) = await cl.Get("coleta");
        Assert.Single(lista.GetProperty("grupos").EnumerateArray());
    }
}
