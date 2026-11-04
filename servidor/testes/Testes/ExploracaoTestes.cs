using System.Text.Json.Nodes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Mapa;
using ReinoDePedra.Jogo.Persistencia;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Pessoas;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Testes;

public class ExploracaoTestes
{
    private static Local Castelo(MundoTeste t, Reino r) => t.M.Locais[r.CasteloId];
    private static void AvancarAte(MundoTeste t, long instante) => t.Avancar(TimeSpan.FromMilliseconds(Math.Max(0, instante - t.M.Agora)));
    private static readonly Dictionary<string, int> Nenhuma = new();

    /// <summary>Sorteios de jogo com resultado conhecido: a primeira semente cujos próximos números satisfazem as condições.</summary>
    private static Rng Sorte(params Func<double, bool>[] condicoes)
    {
        for (ulong s = 1; ; s++)
        {
            var r = new Rng(s);
            if (condicoes.All(c => c(r.Real()))) return new Rng(s);
        }
    }

    /// <summary>Hexágono fora do rio e sem local, a exatamente <paramref name="dist"/> de <paramref name="de"/>, longe da borda.</summary>
    private static int HexA(MundoTeste t, int de, int dist, Func<int, bool>? filtro = null, int pular = 0) =>
        t.M.G.Area(de, dist).Where(h => t.M.G.Distancia(h, de) == dist && !t.M.Mapa.Rio[h] && t.M.LocalNoHex(h) == null
            && t.M.G.C(h) > 2 && t.M.G.L(h) > 2 && t.M.G.C(h) < t.M.G.Cols - 3 && t.M.G.L(h) < t.M.G.Lins - 3
            && !t.M.Jazidas.Any(j => j.Hex == h) && !t.M.Ruinas.Any(x => x.Hex == h) && (filtro == null || filtro(h)))
            .Skip(pular).First();

    private static bool LongeDosReinos(MundoTeste t, int h, int folga) =>
        t.M.Mapa.Vagas.All(v => t.M.G.Distancia(v.Castelo, h) > t.M.P.FaunaServ.PertoReino + folga);

    private static void Guarnecer(MundoTeste t, Reino r, Local l, string unidade, int n)
    {
        Economia.Atualizar(t.M, r);
        l.Guarnicao[unidade] = l.Guarnicao.GetValueOrDefault(unidade) + n;
        Pessoas.RemoverCivis(t.M, r, t.B.U[unidade].Pop * n);
        t.M.Sujar(l); t.M.Sujar(r);
    }

    private static RegiaoFauna Regiao(MundoTeste t, int centro, string animal, string nivel, int raio = 1) =>
        Fauna.Adicionar(t.M, new RegiaoFauna { Centro = centro, Hex = centro, Raio = raio, Animal = animal, Nivel = nivel, Qtd = 4 });

    // ---------------------------------------------------------------- exploradores

    [Fact]
    public void Exploradores_em_lote_ficam_prontos_um_por_vez()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        t.DarRecursos(r);
        var x = t.B.P.Exploradores["pe"];
        var item = Exploradores.Treinar(t.M, r, "pe", 3);
        Assert.Equal(3, Exploradores.Ocupantes(t.M, r));
        t.Avancar(TimeSpan.FromSeconds(x.Tempo + 1));
        Assert.Equal(1, r.ExploradoresLivres.GetValueOrDefault("pe"));   // o primeiro já pode sair
        Assert.Equal(3, Exploradores.Ocupantes(t.M, r));
        Economia.Atualizar(t.M, r);
        var pop = r.Pop;
        Filas.Cancelar(t.M, r, Recrutamento.Fila, item.Id);
        Assert.Equal(1, r.ExploradoresLivres["pe"]);
        Assert.Equal(pop + 2, r.Pop, 6);   // só os 2 que faltavam voltam à população
        Assert.Equal(1, Exploradores.Ocupantes(t.M, r));
    }

    [Theory]
    [InlineData("pe")]
    [InlineData("cavalo")]
    [InlineData("prospector")]
    [InlineData("batedor")]
    public void Explorador_tem_a_visao_a_velocidade_e_o_tempo_do_tipo(string tipo)
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        t.DarRecursos(r, 1e6, "comida", "ferro", "couro");
        var x = t.B.P.Exploradores[tipo];
        var pop0 = r.Pop;
        var item = Exploradores.Treinar(t.M, r, tipo, 1);
        Assert.Equal(x.Tempo, item.DuracaoSeg);
        Assert.Equal(pop0 - 1, r.Pop, 6);
        Assert.Equal(1, Exploradores.Ocupantes(t.M, r));   // em treino ocupa o teto
        t.Avancar(TimeSpan.FromSeconds(x.Tempo + 1));
        Assert.Equal(1, r.ExploradoresLivres[tipo]);

        var destino = HexA(t, c.Hex, 16);
        var e = Exploradores.Enviar(t.M, r, tipo, Exploradores.Explorar, destino);
        Assert.Equal(x.Visao, e.RaioVisao(t.M));
        Assert.Equal(x.Vel, e.Vel);
        Assert.Equal(1, e.PopOcupada(t.M));
        Assert.False(e.Interceptavel);
        Assert.Equal(tipo == "batedor", e.Furtiva);
        var esperado = Caminhos.Calcular(t.M, c.Hex, destino, x.Vel, Exploradores.Opcoes(t.M, r.Id, tipo, Nenhuma, false));
        Assert.Equal(esperado.TotalMin * T.Min, e.Chegada - e.Partida, 1000.0);
        Assert.False(r.ExploradoresLivres.ContainsKey(tipo));
        // vai, revela e fica no destino esperando; volta quando mandam
        t.AvancarHoras(1);
        Assert.Equal(Exploradores.Aguardar, e.Ordem);
        Exploradores.DarOrdem(t.M, r, e.Id, Exploradores.Retornar, null);
        t.AvancarHoras(12);
        Assert.Empty(Exploradores.De(t.M, r.Id));
        Assert.Equal(1, r.ExploradoresLivres[tipo]);
        Assert.Contains(t.M.Relatorios, x2 => x2.ReinoId == r.Id && x2.Tipo == "exploracao");
    }

    [Fact]
    public void Penalidade_de_terreno_dos_exploradores()
    {
        var t = new MundoTeste();
        var P = t.B.P;
        int Achar(Terreno ter) => Enumerable.Range(0, t.M.G.Total).First(h => t.M.Mapa.Terrenos[h] == ter && !t.M.Mapa.Rio[h] && !t.M.Vias.Rotas.Contains(h));
        double Min(int h, string vel, Func<Terreno, double, double>? aj) => Caminhos.MinutosEntrar(t.M, h, vel, new OpcoesCaminho { AjusteTerreno = aj });
        var pe = Exploradores.Ajuste(t.M, "pe"); var cav = Exploradores.Ajuste(t.M, "cavalo");
        var fl = Achar(Terreno.Floresta); var pa = Achar(Terreno.Pantano); var mo = Achar(Terreno.Montanha); var pl = Achar(Terreno.Planicie);
        // a pé: floresta e pântano custam como planície
        Assert.Equal(P.MinPor["Lenta"], Min(fl, "Lenta", pe), 6);
        Assert.Equal(P.MinPor["Lenta"], Min(pa, "Lenta", pe), 6);
        Assert.Equal(P.Terreno["floresta"] * P.MinPor["Lenta"], Min(fl, "Lenta", null), 6);
        Assert.Equal(P.Terreno["montanha"] * P.MinPor["Lenta"], Min(mo, "Lenta", pe), 6);
        // a cavalo: floresta e montanha penalizadas
        Assert.Equal(P.Terreno["floresta"] * P.ExploracaoServ.Penalidade["cavalo"]["floresta"] * P.MinPor["Rápida"], Min(fl, "Rápida", cav), 6);
        Assert.Equal(P.Terreno["montanha"] * P.ExploracaoServ.Penalidade["cavalo"]["montanha"] * P.MinPor["Rápida"], Min(mo, "Rápida", cav), 6);
        Assert.Equal(P.MinPor["Rápida"], Min(pl, "Rápida", cav), 6);
        Assert.Null(Exploradores.Ajuste(t.M, "prospector"));
        // com escolta, anda como tropa e no passo do mais lento
        Assert.Null(Exploradores.Opcoes(t.M, 1, "pe", new Dictionary<string, int> { ["lanceiro"] = 2 }, false).AjusteTerreno);
        Assert.Equal("Lenta", Exploradores.Velocidade(t.M, "cavalo", new Dictionary<string, int> { ["lanceiro"] = 2 }));
    }

    [Fact]
    public void Explorador_revela_a_nevoa_ao_longo_do_caminho_no_instante_da_passagem()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        r.ExploradoresLivres["pe"] = 1;
        var destino = HexA(t, c.Hex, 24);
        var nevoa = Nevoas.De(t.M, r.Id);
        Assert.Equal(0, nevoa.MinutoVisto(destino));
        var e = Exploradores.Enviar(t.M, r, "pe", Exploradores.Explorar, destino);
        var chegadaIda = e.Chegada;
        var meio = e.Caminho.Count / 2;
        var hexMeio = e.Caminho[meio];
        AvancarAte(t, e.Tempos[meio] + 1);
        // sem ninguém olhar, nada é marcado (sem tique); ao consultar, o que já passou aparece
        Assert.Equal(0, nevoa.MinutoVisto(destino));
        Nevoas.VisiveisAgora(t.M, r.Id);
        Assert.True(nevoa.MinutoVisto(hexMeio) > 0);
        Assert.Equal(0, nevoa.MinutoVisto(destino));
        // depois de voltar, o destino ficou marcado no minuto da última passagem por perto, não no de agora
        AvancarAte(t, chegadaIda + 1);
        var raio = e.RaioVisao(t.M);
        Exploradores.DarOrdem(t.M, r, e.Id, Exploradores.Retornar, null);   // espera no destino até mandarem voltar
        // a última vez que viu o destino foi na volta, quando saiu de perto dele
        var ultimaPassagem = e.Caminho.Select((h, i) => (h, i)).Where(x => t.M.G.Distancia(x.h, destino) <= raio).Max(x => e.Tempos[x.i]);
        t.AvancarHoras(24);
        Assert.Equal(1, r.ExploradoresLivres["pe"]);
        Assert.Equal(Nevoas.Minuto(t.M, ultimaPassagem), nevoa.MinutoVisto(destino));
        Assert.True(Nevoas.Minuto(t.M, t.M.Agora) > nevoa.MinutoVisto(destino) + 60);
    }

    [Fact]
    public void So_o_prospector_revela_jazidas()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        var alvo = HexA(t, c.Hex, 12);
        var j = t.M.Jazidas.Adicionar(new Jazida { Hex = alvo, Recurso = "ouro", Inicial = 1000, Restante = 1000 });
        var longe = t.M.Jazidas.Adicionar(new Jazida { Hex = HexA(t, c.Hex, 32), Recurso = "prata", Inicial = 1000, Restante = 1000 });
        r.ExploradoresLivres["pe"] = 1; r.ExploradoresLivres["prospector"] = 1;
        Exploradores.Enviar(t.M, r, "pe", Exploradores.Explorar, alvo);
        t.AvancarHoras(12);
        Assert.True(Nevoas.Explorado(t.M, r.Id, alvo));
        Assert.DoesNotContain(r.Id, j.DescobertaPor);
        Exploradores.Enviar(t.M, r, "prospector", Exploradores.Explorar, alvo);
        t.AvancarHoras(12);
        Assert.Contains(r.Id, j.DescobertaPor);
        Assert.DoesNotContain(r.Id, longe.DescobertaPor);
        Assert.Contains(t.M.Notificacoes, n => n.ReinoId == r.Id && n.Titulo.StartsWith("Jazida descoberta"));
    }

    [Fact]
    public void Seguir_rota_e_patrulhar_vao_de_ponto_em_ponto_ate_nova_ordem()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        r.ExploradoresLivres["cavalo"] = 2;
        var a = HexA(t, c.Hex, 10); var b = HexA(t, c.Hex, 14);
        var e = Exploradores.Enviar(t.M, r, "cavalo", Exploradores.SeguirRota, null, [a, b]);
        Assert.Equal(a, e.Destino);
        AvancarAte(t, e.Chegada + 1);
        Assert.Equal(b, e.Destino);
        AvancarAte(t, e.Chegada + 1);
        Assert.Equal(Exploradores.Aguardar, e.Ordem);   // no fim da rota, espera nova ordem
        Assert.Equal(b, e.HexEm(t.M.Agora));
        var p = Exploradores.Enviar(t.M, r, "cavalo", Exploradores.Patrulhar, b);
        for (var i = 0; i < 4; i++)
        {
            var dest = p.Destino;
            Assert.Equal(i % 2 == 0 ? b : c.Hex, dest);
            AvancarAte(t, p.Chegada + 1);
            Assert.Contains(p, t.M.Marchas);   // a patrulha não entra no castelo: segue até nova ordem
        }
        Exploradores.DarOrdem(t.M, r, p.Id, Exploradores.Retornar, null);
        Exploradores.DarOrdem(t.M, r, e.Id, Exploradores.Retornar, null);
        t.AvancarHoras(6);
        Assert.Equal(2, r.ExploradoresLivres["cavalo"]);
    }

    // ---------------------------------------------------------------- fauna

    private static (MundoTeste t, Reino r, Local c, int alvo) MundoComRegiaoLonge()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        var alvo = HexA(t, c.Hex, 12, h => LongeDosReinos(t, h, 1));
        return (t, r, c, alvo);
    }

    [Fact]
    public void Grupo_pequeno_atacado_pela_fauna_perde_25_por_cento()
    {
        var (t, r, c, alvo) = MundoComRegiaoLonge();
        Regiao(t, alvo, "ursos", "alto");
        Guarnecer(t, r, c, "lanceiro", 4);   // força 130 < 300
        t.M.Sorte = Sorte(x => x < t.B.P.AtaqueFauna["alto"]);
        var ex = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 4 }, alvo, OrdemMover.Id);
        Assert.Contains(t.M.Eventos, ev => ev is AtaqueFaunaEvento a && a.MarchaId == ex.Id);
        AvancarAte(t, ex.Chegada + 1);
        Assert.Equal(3, ex.Tropas["lanceiro"]);
        var rel = Assert.Single(t.M.Relatorios, x => x.ReinoId == r.Id && x.Tipo == "fauna");
        Assert.Contains("ursos", rel.Titulo);
    }

    [Fact]
    public void Grupo_acima_do_limite_perde_5_por_cento_e_com_o_dobro_passa_ileso()
    {
        var (t, r, c, alvo) = MundoComRegiaoLonge();
        Regiao(t, alvo, "lobos", "alto");
        Guarnecer(t, r, c, "lanceiro", 40);
        // 10 lanceiros = 325: acima do limite (300), risco cai para médio
        t.M.Sorte = Sorte(x => x < t.B.P.AtaqueFauna["medio"]);
        var ex = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 10 }, alvo, OrdemMover.Id);
        AvancarAte(t, ex.Chegada + 1);
        Assert.Equal(9, ex.Tropas["lanceiro"]);
        // 20 lanceiros = 650 ≥ 600: nem sorteia
        t.M.Sorte = Sorte(x => x < 0.001);
        var forte = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 20 }, alvo, OrdemMover.Id);
        Assert.DoesNotContain(t.M.Eventos, ev => ev is AtaqueFaunaEvento a && a.MarchaId == forte.Id);
        AvancarAte(t, forte.Chegada + 1);
        Assert.Equal(20, forte.Tropas["lanceiro"]);
    }

    [Fact]
    public void Explorador_sozinho_atacado_pela_fauna_morre()
    {
        var (t, r, c, alvo) = MundoComRegiaoLonge();
        Regiao(t, alvo, "lobos", "medio");
        r.ExploradoresLivres["cavalo"] = 1;
        t.M.Sorte = Sorte(x => x < t.B.P.AtaqueFauna["medio"]);
        var e = Exploradores.Enviar(t.M, r, "cavalo", Exploradores.Explorar, alvo);
        t.AvancarHoras(6);
        Assert.DoesNotContain(e, t.M.Marchas);
        Assert.False(r.ExploradoresLivres.ContainsKey("cavalo"));
        Assert.Contains(t.M.Relatorios, x => x.ReinoId == r.Id && x.Tipo == "fauna" && x.Titulo.Contains("morto"));
        Assert.Equal(0, Economia.Tropas(t.M, r));   // ninguém mais ocupa o teto
    }

    [Fact]
    public void Carregadores_atacados_perdem_parte_da_carga()
    {
        var (t, r, c, alvo) = MundoComRegiaoLonge();
        var rg = Regiao(t, alvo, "javalis", "medio");
        var mc = Logistica.Enviar(t.M, r, c.Hex, alvo, Recursos.De(new Dictionary<string, double> { ["madeira"] = 10 }), null, "obras", null);
        Assert.Equal(5, mc.ForcaContraFauna(t.M));   // 1 pessoa (30 de carga) × 5
        Fauna.Atacar(t.M, mc, rg, alvo, 2);
        Assert.Equal(7.5, mc.Carga.Qtd("madeira"), 6);
        Assert.Contains(mc, t.M.Marchas);
    }

    [Fact]
    public void Bando_abatido_volta_em_24_horas_e_rota_reduz_o_perigo()
    {
        var (t, _, _, alvo) = MundoComRegiaoLonge();
        var rg = Regiao(t, alvo, "ursos", "alto");
        Assert.Equal(3, Fauna.PerigoEm(t.M, alvo).nivel);
        t.M.Vias.Rotas.Add(alvo);
        Assert.Equal(2, Fauna.NivelEm(t.M, rg, alvo));
        t.M.Vias.Rotas.Remove(alvo);
        Fauna.Abater(t.M, rg);
        Assert.Equal(0, Fauna.PerigoEm(t.M, alvo).nivel);
        t.AvancarHoras(t.B.P.FaunaVoltaH - 0.1);
        Assert.True(rg.Abatido);
        t.AvancarHoras(0.2);
        Assert.False(rg.Abatido);
        Assert.Equal(3, Fauna.PerigoEm(t.M, alvo).nivel);
        // o bando anda dentro da região por evento, não por tique
        var antes = t.M.Eventos.OfType<MoverFaunaEvento>().Count(x => x.RegiaoId == rg.Id);
        Assert.Equal(1, antes);
        t.AvancarHoras(12);
        Assert.True(t.M.G.Distancia(rg.Hex, rg.Centro) <= rg.Raio);
    }

    [Fact]
    public void Fauna_gerada_com_o_mundo_e_mais_fraca_perto_dos_reinos_iniciais()
    {
        var t = new MundoTeste(fauna: true);
        var P = t.B.P;
        Assert.True(t.M.Faunas.Count() >= P.Reinos);
        var castelos = t.M.Mapa.Vagas.Select(v => v.Castelo).ToList();
        foreach (var rg in t.M.Faunas)
        {
            Assert.True(castelos.All(c => t.M.G.Distancia(c, rg.Centro) > P.FaunaServ.LongeCastelo));
            if (castelos.Any(c => t.M.G.Distancia(c, rg.Centro) <= P.FaunaServ.PertoReino)) Assert.Equal("baixo", rg.Nivel);
            Assert.Contains(rg.Animal, Fauna.Animais);
            Assert.Single(t.M.Eventos.OfType<MoverFaunaEvento>(), e => e.RegiaoId == rg.Id);
        }
        Assert.Contains(t.M.Faunas, rg => rg.Nivel == "alto");
        // mesmo uma região forte fica fraca ao lado do castelo
        var perto = t.M.G.Area(castelos[0], 4).First(h => h != castelos[0]);
        var forte = Regiao(t, perto, "ursos", "alto");
        Assert.Equal(1, Fauna.NivelEm(t.M, forte, perto));
        // mundo que sobe sem fauna ganha fauna
        Fauna.Limpar(t.M);
        Fauna.AoIniciar(t.M);
        Assert.NotEmpty(t.M.Faunas);
    }

    [Fact]
    public void Rota_segura_desvia_da_fauna_conhecida_que_seria_risco()
    {
        var (t, r, c, alvo) = MundoComRegiaoLonge();
        var curta = Caminhos.Calcular(t.M, c.Hex, alvo, "Lenta");
        var meio = curta.Hexes[curta.Hexes.Count / 2];
        Regiao(t, meio, "ursos", "alto");
        var op = new OpcoesCaminho { Seguro = true, Forca = 30, ReinoId = r.Id };
        // o reino ainda não viu a fauna: a rota segura não sabe dela
        Assert.Equal(curta.Hexes, Caminhos.Calcular(t.M, c.Hex, alvo, "Lenta", op).Hexes);
        Nevoas.RevelarArea(t.M, r.Id, meio, 4, t.M.Agora + T.Min);
        var segura = Caminhos.Calcular(t.M, c.Hex, alvo, "Lenta", op);
        Assert.DoesNotContain(meio, segura.Hexes);
        Assert.True(segura.TotalMin >= curta.TotalMin);
        // um grupo com o dobro da força não desvia
        Assert.Equal(curta.TotalMin, Caminhos.Calcular(t.M, c.Hex, alvo, "Lenta", op with { Forca = 700 }).TotalMin, 6);
    }

    // ---------------------------------------------------------------- caça

    [Fact]
    public void Caca_rende_o_do_balanceamento_e_o_bando_volta_em_24_h()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        var alvo = HexA(t, c.Hex, 6);
        var rg = Regiao(t, alvo, "javalis", "baixo");
        Guarnecer(t, r, c, "arqueiro", 10);   // força 300 ≥ 80: ilesos
        Assert.Throws<RegraException>(() => Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["arqueiro"] = 10 }, HexA(t, c.Hex, 18), OrdemCacar.Id));
        var ex = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["arqueiro"] = 10 }, alvo, OrdemCacar.Id);
        AvancarAte(t, ex.Chegada + 1);
        Assert.True(rg.Abatido);
        Assert.True(ex.Parado);
        var fimCaca = t.M.Agora + T.DeHoras(t.B.P.CacaMin / 60);
        t.AvancarHoras(3);
        Assert.DoesNotContain(ex, t.M.Marchas);
        Assert.Equal(10, c.Guarnicao["arqueiro"]);
        var rel = Assert.Single(t.M.Relatorios, x => x.ReinoId == r.Id && x.Tipo == "caca");
        var ganho = (JsonObject)rel.Dados["ganho"]!;
        var P = t.B.P.Caca["javalis"];
        Assert.Equal(P.Comida, ganho["comida"]!.GetValue<long>());
        Assert.Equal(P.Couro, ganho["couro"]!.GetValue<long>());
        Assert.Equal(P.Peles, ganho["peles"]!.GetValue<long>());
        Assert.Equal(t.B.P.FaunaVoltaH, T.EmHoras(rg.VoltaEm - fimCaca + T.DeHoras(t.B.P.CacaMin / 60)), 2);
        t.AvancarHoras(t.B.P.FaunaVoltaH);
        Assert.False(rg.Abatido);
    }

    [Fact]
    public void Grupo_de_caca_fraco_perde_para_o_bando()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        var alvo = HexA(t, c.Hex, 6);
        var rg = Regiao(t, alvo, "javalis", "baixo");
        Guarnecer(t, r, c, "arqueiro", 1);   // 30 < 40: perde 25% (1 unidade)
        var ex = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["arqueiro"] = 1 }, alvo, OrdemCacar.Id);
        AvancarAte(t, ex.Chegada + 1);
        Assert.DoesNotContain(ex, t.M.Marchas);
        Assert.False(rg.Abatido);
        Assert.Contains(t.M.Relatorios, x => x.ReinoId == r.Id && x.Tipo == "caca" && x.Titulo == "Caçada perdida");
    }

    // ---------------------------------------------------------------- rotas e pontes

    [Fact]
    public void Rota_custa_conforme_o_terreno_e_deixa_o_caminho_mais_rapido()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        t.DarRecursos(r);
        var P = t.B.P;
        var fl = t.M.G.Area(c.Hex, 6).FirstOrDefault(h => t.M.Mapa.Terrenos[h] == Terreno.Floresta && !t.M.Mapa.Rio[h], -1);
        if (fl < 0) { fl = HexA(t, c.Hex, 4); t.M.Mapa.Terrenos[fl] = Terreno.Floresta; }
        var (custo, seg, ponte) = Rotas.Custo(t.M, fl);
        Assert.False(ponte);
        Assert.Equal(Math.Round(P.Rota.Custo["madeira"] * P.Terreno["floresta"]), custo["madeira"]);
        Assert.Equal(Math.Round(P.Rota.Custo["pedra"] * P.Terreno["floresta"]), custo["pedra"]);
        Assert.Equal(P.Rota.Tempo * P.Terreno["floresta"], seg, 6);
        var antes = Caminhos.MinutosEntrar(t.M, fl, "Lenta", OpcoesCaminho.Padrao);
        var item = Rotas.Construir(t.M, r, fl);
        Assert.Null(item.LocalId);
        Assert.Equal(fl, item.Hex);
        Assert.Throws<RegraException>(() => Rotas.Construir(t.M, r, fl));   // já na fila
        Assert.Throws<RegraException>(() => Rotas.Construir(t.M, r, HexA(t, c.Hex, 30)));   // não explorado
        t.AvancarHoras(2);
        Assert.Contains(fl, t.M.Vias.Rotas);
        Assert.Equal(antes * P.RotaFator, Caminhos.MinutosEntrar(t.M, fl, "Lenta", OpcoesCaminho.Padrao), 6);
        Assert.Throws<RegraException>(() => Rotas.Construir(t.M, r, fl));   // já tem rota
    }

    [Fact]
    public void Rio_precisa_de_ponte()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        t.DarRecursos(r);
        var P = t.B.P;
        var rio = Enumerable.Range(0, t.M.G.Total).Where(h => t.M.Mapa.Rio[h]).OrderBy(h => t.M.G.Distancia(h, c.Hex)).First();
        Nevoas.RevelarArea(t.M, r.Id, rio, 0);
        var (custo, seg, ponte) = Rotas.Custo(t.M, rio);
        Assert.True(ponte);
        Assert.Equal(P.Ponte.Custo["madeira"], custo["madeira"]);
        Assert.Equal(P.Ponte.Tempo, seg);
        var antes = Caminhos.MinutosEntrar(t.M, rio, "Lenta", OpcoesCaminho.Padrao);
        Rotas.Construir(t.M, r, rio);
        t.AvancarHoras(8);
        Assert.Contains(rio, t.M.Vias.Pontes);
        Assert.Equal(antes / P.Rio.Vau * P.RotaFator, Caminhos.MinutosEntrar(t.M, rio, "Lenta", OpcoesCaminho.Padrao), 6);
    }

    // ---------------------------------------------------------------- captura

    private static (MundoTeste t, Reino a, Reino b, Local cb, int perto) DoisReinos(int tropasB)
    {
        var t = new MundoTeste();
        var a = t.NovoReino(); var b = t.NovoReino();
        var cb = Castelo(t, b);
        if (tropasB > 0) Guarnecer(t, b, cb, "lanceiro", tropasB);
        var perto = HexA(t, cb.Hex, 2);
        return (t, a, b, cb, perto);
    }

    [Fact]
    public void Explorador_sozinho_capturado_e_libertado_sem_decisao_em_24_h()
    {
        var (t, a, b, _, perto) = DoisReinos(45);
        var p = t.B.P.ExploracaoServ.Captura;
        Assert.Equal(p.Max, Math.Min(p.Max, p.Base + p.PorTropa * 45));
        a.ExploradoresLivres["pe"] = 1;
        t.M.Sorte = Sorte(x => x < p.Max);
        var e = Exploradores.Enviar(t.M, a, "pe", Exploradores.Explorar, perto);
        Assert.Contains(t.M.Eventos, ev => ev is CapturaExploradorEvento c && c.MarchaId == e.Id);
        t.AvancarHoras(10);
        var preso = Assert.Single(t.M.Prisioneiros);
        Assert.Equal(b.Id, preso.CaptorId);
        Assert.Equal(a.Id, preso.DonoId);
        Assert.DoesNotContain(e, t.M.Marchas);
        Assert.Contains(a.Id, b.ReinosConhecidos);        // quem captura vê o reino de origem
        Assert.DoesNotContain(b.Id, a.ReinosConhecidos);  // o dono não sabe quem pegou
        Assert.Contains(t.M.Relatorios, x => x.ReinoId == b.Id && x.Tipo == "captura" && x.Dados["origem"]!["nome"]!.GetValue<string>() == a.Nome);
        Assert.Contains(t.M.Relatorios, x => x.ReinoId == a.Id && x.Tipo == "captura" && x.Dados["origem"] == null);
        AvancarAte(t, preso.Ate + 1);
        Assert.Empty(t.M.Prisioneiros);
        var volta = Assert.Single(Exploradores.De(t.M, a.Id));
        Assert.True(volta.Retornando);
        t.AvancarHoras(12);
        Assert.Equal(1, a.ExploradoresLivres["pe"]);
    }

    [Fact]
    public void Batedor_de_elite_e_furtivo_e_escolta_protege_da_captura()
    {
        var (t, a, _, cb, perto) = DoisReinos(45);
        a.ExploradoresLivres["batedor"] = 1; a.ExploradoresLivres["pe"] = 1;
        Guarnecer(t, a, Castelo(t, a), "lanceiro", 2);
        t.M.Sorte = Sorte(x => x < 0.01, x => x < 0.01);
        var bat = Exploradores.Enviar(t.M, a, "batedor", Exploradores.Explorar, perto);
        var esc = Exploradores.Enviar(t.M, a, "pe", Exploradores.Explorar, perto, null, false, new Dictionary<string, int> { ["lanceiro"] = 2 });
        Assert.DoesNotContain(t.M.Eventos, ev => ev is CapturaExploradorEvento);
        Assert.Equal(1 + 2, esc.PopOcupada(t.M));
        t.AvancarHoras(1);
        Exploradores.DarOrdem(t.M, a, bat.Id, Exploradores.Retornar, null);
        Exploradores.DarOrdem(t.M, a, esc.Id, Exploradores.Retornar, null);
        t.AvancarHoras(12);
        Assert.Empty(t.M.Prisioneiros);
        Assert.Equal(2, Castelo(t, a).Guarnicao["lanceiro"]);
    }

    [Fact]
    public void Quem_captura_pode_executar_ou_pedir_resgate()
    {
        var (t, a, b, _, perto) = DoisReinos(45);
        a.ExploradoresLivres["pe"] = 2;
        t.M.Sorte = Sorte(x => x < 0.5);
        Exploradores.Enviar(t.M, a, "pe", Exploradores.Explorar, perto);
        t.AvancarHoras(10);
        var p1 = Assert.Single(t.M.Prisioneiros);
        Assert.Throws<RegraException>(() => Capturas.Decidir(t.M, a, p1.Id, "libertar"));   // só quem capturou decide
        Capturas.Decidir(t.M, b, p1.Id, "resgate", new Dictionary<string, double> { ["prata"] = 20 });
        Assert.Equal(Capturas.ResgatePedido, p1.Estado);
        Assert.Contains(b.Id, a.ReinosConhecidos);   // o pedido revela quem pede
        Capturas.Decidir(t.M, b, p1.Id, "executar");
        Assert.Empty(t.M.Prisioneiros);
        Assert.Contains(t.M.Relatorios, x => x.ReinoId == a.Id && x.Titulo.Contains("executado"));
        t.AvancarHoras(30);
        Assert.Equal(1, a.ExploradoresLivres["pe"]);   // o executado não volta
        Assert.Empty(Exploradores.De(t.M, a.Id));
    }

    // ---------------------------------------------------------------- espionagem

    [Fact]
    public void Espionagem_nao_vista_revela_dono_defesa_estoque_e_reliquias()
    {
        var (t, a, b, cb, _) = DoisReinos(4);
        Assert.Equal(t.M.F.ChanceEspiao(0, 4), Espionagem.Chance(t.M, cb), 9);   // 25%: o sorteio abaixo (≥ 0,25) não vê o batedor
        var rel = t.M.Reliquias.Adicionar(new Reliquia { Nome = "Pedra do Vale", Tipo = "producao", ReinoId = b.Id, LocalId = cb.Id });
        Nevoas.RevelarArea(t.M, a.Id, cb.Hex, 2);
        a.ExploradoresLivres["batedor"] = 1;
        var conhecidos = new List<long>();
        void Ao(Mundo m, Reino quem, Reino outro, string como) { if (m == t.M) conhecidos.Add(outro.Id); }
        Conhecimento.AoConhecer += Ao;
        try
        {
            Assert.Throws<RegraException>(() => Exploradores.Enviar(t.M, a, "pe", Exploradores.Espionar, cb.Hex));
            t.M.Sorte = Sorte(x => x >= 0.25);
            var e = Exploradores.Enviar(t.M, a, "batedor", Exploradores.Espionar, cb.Hex);
            AvancarAte(t, e.Chegada + 1);
            Assert.NotNull(e.EspionandoAte);
            Assert.Equal(T.DeSegundos(t.B.P.Espiao.TempoNoLocal), e.EspionandoAte!.Value - e.Partida);
            t.AvancarMin(t.B.P.Espiao.TempoNoLocal / 60 + 1);
            var r = Assert.Single(t.M.Relatorios, x => x.ReinoId == a.Id && x.Tipo == "espionagem");
            Assert.Equal(b.Nome, r.Dados["dono"]!["nome"]!.GetValue<string>());
            Assert.Equal(4, r.Dados["defesa"]!["guarnicao"]!["lanceiro"]!.GetValue<int>());
            Assert.True(r.Dados["estoque"]!.AsObject().Count > 0);
            Assert.Equal("Pedra do Vale", r.Dados["reliquias"]![0]!["nome"]!.GetValue<string>());
            Assert.False(r.Dados["visto"]!.GetValue<bool>());
            Assert.Equal(cb.Nivel, a.LocaisEspionados[cb.Id].Nivel);
            Assert.Contains(b.Id, a.ReinosConhecidos);
            Assert.Contains(b.Id, conhecidos);
            Assert.Empty(t.M.Avistamentos);
            Assert.True(e.Retornando);
        }
        finally { Conhecimento.AoConhecer -= Ao; }
        _ = rel;
    }

    [Fact]
    public void Espiao_visto_vira_avistamento_e_metade_das_vezes_e_capturado()
    {
        var (t, a, b, cb, _) = DoisReinos(20);
        Nevoas.RevelarArea(t.M, a.Id, cb.Hex, 2);
        a.ExploradoresLivres["batedor"] = 2;
        // visto e capturado: sem relatório
        t.M.Sorte = Sorte(x => x < 0.25, x => x < t.B.P.Espiao.Capturado);
        var e = Exploradores.Enviar(t.M, a, "batedor", Exploradores.Espionar, cb.Hex);
        t.AvancarHoras(3);
        Assert.DoesNotContain(e, t.M.Marchas);
        var preso = Assert.Single(t.M.Prisioneiros);
        Assert.Equal(b.Id, preso.CaptorId);
        Assert.DoesNotContain(t.M.Relatorios, x => x.ReinoId == a.Id && x.Tipo == "espionagem");
        var av = Assert.Single(Avistamentos.De(t.M, b.Id));
        Assert.Equal("espiao", av.Tipo);
        Assert.Equal(T.DeHoras(t.B.P.AvistamentoH), av.Ate - av.Quando);
        // visto e não capturado: foge com o relatório
        t.M.Sorte = Sorte(x => x < 0.25, x => x >= t.B.P.Espiao.Capturado);
        Exploradores.Enviar(t.M, a, "batedor", Exploradores.Espionar, cb.Hex);
        t.AvancarHoras(3);
        var r = Assert.Single(t.M.Relatorios, x => x.ReinoId == a.Id && x.Tipo == "espionagem");
        Assert.True(r.Dados["visto"]!.GetValue<bool>());
        Assert.Equal(2, Avistamentos.De(t.M, b.Id).Count());
        // o avistamento some sozinho em 10 h
        t.AvancarHoras(t.B.P.AvistamentoH + 1);
        Assert.Empty(t.M.Avistamentos);
    }

    // ---------------------------------------------------------------- névoa com foto

    [Fact]
    public void Foto_da_nevoa_guarda_o_ultimo_estado_conhecido()
    {
        var (t, a, b, cb, _) = DoisReinos(0);
        var mina = t.M.LocaisDe(b.Id).First(l => l.Tipo == TipoLocal.Mina);
        var rg = Regiao(t, HexA(t, mina.Hex, 2), "lobos", "alto");
        Nevoas.RevelarArea(t.M, a.Id, mina.Hex, 4, t.M.Agora + T.Min);
        var foto = Fotos.De(t.M, a.Id);
        var obj = Assert.Single(foto.Objetos[mina.Hex]);
        Assert.Equal("local", obj["tipo"]!.GetValue<string>());
        Assert.Equal("desconhecido", obj["dono"]!.GetValue<string>());
        Assert.Equal("Mina", obj["nome"]!.GetValue<string>());
        Assert.Null(obj["nivel"]);
        Assert.True(Fotos.PerigoConhecido(t.M, a.Id, rg.Centro) > 0);
        Assert.Equal("lobos", Fotos.AnimalConhecido(t.M, a.Id, rg.Centro));
        // o mundo muda; a foto não, até o reino ver de novo
        Fauna.Abater(t.M, rg);
        t.M.MudarDono(mina, 0); mina.Ruina = true;
        Assert.Equal("desconhecido", foto.Objetos[mina.Hex][0]["dono"]!.GetValue<string>());
        Assert.True(Fotos.PerigoConhecido(t.M, a.Id, rg.Centro) > 0);
        Nevoas.RevelarArea(t.M, a.Id, mina.Hex, 4, t.M.Agora + 2 * T.Min);
        Assert.Equal("livre", foto.Objetos[mina.Hex][0]["dono"]!.GetValue<string>());
        Assert.Equal(0, Fotos.PerigoConhecido(t.M, a.Id, rg.Centro));
    }
}

public class ExploracaoPersistenciaTestes
{
    [Fact]
    public void Fauna_fotos_exploradores_e_prisioneiros_sobrevivem_a_recarga()
    {
        var dir = Path.Combine(Path.GetTempPath(), "rp-teste-" + Guid.NewGuid().ToString("N"));
        var arq = Path.Combine(dir, "t.db");
        try
        {
            var t = new MundoTeste(fauna: true);
            var a = t.NovoReino(); var b = t.NovoReino();
            a.ExploradoresLivres["cavalo"] = 1;
            var cb = t.M.Locais[b.CasteloId];
            t.M.Locais[a.CasteloId].Guarnicao["lanceiro"] = 20;   // escolta forte: a fauna não ataca
            var e = Exploradores.Enviar(t.M, a, "cavalo", Exploradores.Patrulhar, cb.Hex, null, false, new Dictionary<string, int> { ["lanceiro"] = 20 });
            t.AvancarMin(5);
            Nevoas.VisiveisAgora(t.M, a.Id);
            t.M.Prisioneiros.Adicionar(new Prisioneiro { CaptorId = b.Id, DonoId = a.Id, TipoExp = "pe", Hex = cb.Hex, Ate = t.M.Agora + T.Hora });
            Avistamentos.Registrar(t.M, b.Id, cb.Hex, "espiao", "Espião visto");
            var fotos = Fotos.De(t.M, a.Id).Objetos.Count;
            using (var db = new Banco(arq))
            {
                db.Salvar(t.M);
                Assert.Equal(0, db.SalvarEsquecidos(t.M));   // tudo o que mudou foi sujado
            }
            using var db2 = new Banco(arq);
            var m2 = new Mundo(Balanceamento.Padrao, t.Relogio);
            db2.Carregar(m2);
            m2.PrepararMapa();
            foreach (var ev in m2.Eventos) m2.Agenda.Inserir(ev);
            Sistemas.IniciarTodos(m2);
            Assert.Equal(t.M.Faunas.Count(), m2.Faunas.Count());
            var rg = t.M.Faunas.First();
            Assert.Equal(Fauna.PerigoEm(t.M, rg.Centro).nivel, Fauna.PerigoEm(m2, rg.Centro).nivel);
            var e2 = Assert.IsType<Explorador>(m2.Marchas[e.Id]);
            Assert.Equal(Exploradores.Patrulhar, e2.Ordem);
            Assert.Equal(e.CaminhoVisto, e2.CaminhoVisto);
            Assert.Equal(fotos, Fotos.De(m2, a.Id).Objetos.Count);
            Assert.Single(m2.Prisioneiros);
            Assert.Single(m2.Avistamentos);
            var erros = 0;
            void Erro(Evento ev, Exception ex) => erros++;
            Mundo.ErroEvento += Erro;
            try { t.Relogio.Agora += 2 * T.Hora; m2.ProcessarAte(t.Relogio.Agora); }
            finally { Mundo.ErroEvento -= Erro; }
            Assert.Equal(0, erros);
        }
        finally { try { Directory.Delete(dir, true); } catch { } }
    }
}
