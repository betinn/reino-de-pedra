using System.Text.Json.Nodes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Pessoas;
using ReinoDePedra.Jogo.Reinos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Testes;

/// <summary>Combate, parte 2: feridos, veterania, queda do castelo e exílio, interceptação, posturas, avistamentos e modelos.</summary>
public class GuerraTestes
{
    public GuerraTestes() => AjustesTeste.Garantir();

    private static Dictionary<string, int> G(params (string k, int n)[] x) => x.ToDictionary(p => p.k, p => p.n);

    /// <summary>16 arqueiros contra uma mina com 8 lanceiros e 6 civis: o atacante vence com ≈ 34% de baixas (o combate de referência, dobrado).</summary>
    private static (CombateCenario s, Exercito ex, Batalha b) Vitoria()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 8)), 6);
        var ex = s.Atacar(alvo, G(("arqueiro", 16)), CombateCenario.Plano("saque", "semLimite"));
        var b = s.Chegar(ex);
        s.Terminar(b);
        Assert.Equal("vitoria", b.Resultado);
        return (s, ex, b);
    }

    // ---------------------------------------------------------------- feridos

    [Fact]
    public void Feridos_sao_30_por_cento_das_baixas_de_quem_vence_ocupam_o_teto_e_morrem_em_24h()
    {
        var (s, ex, b) = Vitoria();
        var esperado = (int)Formulas.ArredJs(GT.Total(b.PerdasAtaque) * s.M.P.Feridos.Frac);
        Assert.True(esperado > 0);
        Assert.Equal(esperado, Feridos.Total(s.Atk));
        Assert.Empty(s.Def.Feridos);                      // quem perde sem recuar não tem feridos
        var lote = Assert.Single(s.Atk.Feridos);
        Assert.Equal(b.EncerradaEm + T.DeHoras(s.M.P.Feridos.EsperaH), lote.MorreEm);
        Assert.Equal(esperado, Feridos.Ocupando(s.M, s.Atk));
        var ocupando = Economia.Tropas(s.M, s.Atk);
        Assert.True(ocupando >= esperado + GT.Total(ex.Tropas));
        s.AvancarAte(lote.MorreEm - T.Min);
        Assert.Equal(esperado, Feridos.Total(s.Atk));
        s.AvancarAte(lote.MorreEm);
        Assert.Equal(0, Feridos.Total(s.Atk));
        Assert.Contains(s.M.Notificacoes, n => n.ReinoId == s.Atk.Id && n.Titulo == "Feridos morreram");
    }

    [Fact]
    public void Quem_recua_pela_tatica_tambem_tem_feridos()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 15)), 200);
        var ex = s.Atacar(alvo, G(("lanceiro", 20)), CombateCenario.Plano("saque", "media"));
        var b = s.Chegar(ex);
        s.Terminar(b);
        Assert.Equal("recuo", b.Resultado);
        Assert.Equal((int)Formulas.ArredJs(GT.Total(b.PerdasAtaque) * s.M.P.Feridos.Frac), Feridos.Total(s.Atk));
        Assert.Equal((int)Formulas.ArredJs(GT.Total(b.PerdasDefesa) * s.M.P.Feridos.Frac), Feridos.Total(s.Def));
    }

    [Fact]
    public void Cura_usa_5_ervas_por_ferido_na_fila_do_castelo_e_devolve_as_tropas_em_2h()
    {
        var (s, ex, _) = Vitoria();
        var n = Feridos.Total(s.Atk);
        Assert.Throws<RegraException>(() => Feridos.Curar(s.M, s.Atk));   // sem ervas
        s.AvancarAte(ex.Chegada);                                            // as tropas voltam para casa
        s.T.DarRecursos(s.Atk, s.M.P.Feridos.Ervas * (n - 1), "ervas");      // ervas para todos menos um
        Assert.Equal(n - 1, Feridos.Podem(s.M, s.Atk));
        var item = Feridos.Curar(s.M, s.Atk);
        Assert.Equal(n - 1, item.Qtd);
        Assert.Equal(s.M.P.Feridos.Ervas * (n - 1), item.Custo.Qtd("ervas"));
        Assert.True(item.Iniciado);                                          // as ervas já estavam no castelo
        Assert.Equal(1, Feridos.Total(s.Atk));
        Assert.Equal(n, Feridos.Ocupando(s.M, s.Atk));                       // em cura também ocupam o teto
        var arq = s.CasteloAtk.Guarnicao.GetValueOrDefault("arqueiro");
        s.AvancarAte(item.Fim!.Value);
        Assert.Equal(arq + n - 1, s.CasteloAtk.Guarnicao.GetValueOrDefault("arqueiro"));
        Assert.Equal(0, s.M.Locais[s.Atk.CasteloId].Estoque.Qtd("ervas"), 6);
        // o último, sem ervas, morre no prazo
        s.T.AvancarHoras(s.M.P.Feridos.EsperaH);
        AjustesTeste.FalharSeErro();
        Assert.Equal(0, Feridos.Total(s.Atk));
    }

    [Fact]
    public void Cura_cancelada_volta_a_esperar_com_o_prazo_antigo()
    {
        var (s, _, _) = Vitoria();
        var n = Feridos.Total(s.Atk);
        var morre = s.Atk.Feridos[0].MorreEm;
        s.T.DarRecursos(s.Atk, 1000, "ervas");
        var item = Feridos.Curar(s.M, s.Atk);
        Assert.Equal(0, Feridos.Total(s.Atk));
        Filas.Cancelar(s.M, s.Atk, Feridos.Fila, item.Id);
        Assert.Equal(n, Feridos.Total(s.Atk));
        Assert.Equal(morre, s.Atk.Feridos[0].MorreEm);
    }

    // ---------------------------------------------------------------- veterania

    [Fact]
    public void Vitoria_com_poucas_perdas_contra_inimigo_forte_da_uma_marca_que_volta_para_a_guarnicao()
    {
        var (s, ex, b) = Vitoria();
        Assert.Equal(1, Veterania.DaMarcha(s.M, ex));
        Assert.All(Pessoas.SoldadosDaMarcha(s.M, ex), p => Assert.Equal(1, p.Marcas));   // cada sobrevivente guarda a sua marca
        s.AvancarAte(ex.Chegada);
        Assert.False(s.M.Marchas.ContemId(ex.Id));
        Assert.Equal(1, Veterania.DoLocal(s.M, s.CasteloAtk), 6);
        // a defesa perdeu: sem marcas negativas
        Assert.Equal(0, Veterania.DoLocal(s.M, s.M.Locais[b.LocalId]));
    }

    [Fact]
    public void Vitoria_contra_inimigo_fraco_ou_com_muitas_perdas_nao_da_marca()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 2)), 0);
        var ex = s.Atacar(alvo, G(("arqueiro", 60)), CombateCenario.Plano("saque", "semLimite"));
        s.Terminar(s.Chegar(ex));
        Assert.Equal("vitoria", s.M.Batalhas.Single().Resultado);
        Assert.Equal(0, Veterania.DaMarcha(s.M, ex));                 // inimigo com menos de 30% da força
        Assert.Equal(1, Veterania.Aplicar(s.M, 0, true, 0.49, 100, 30));
        Assert.Equal(0, Veterania.Aplicar(s.M, 0, true, 0.5, 100, 30));   // perdas de 50%
        Assert.Equal(0, Veterania.Aplicar(s.M, 0, true, 0.1, 100, 29));   // inimigo com 29%
        Assert.Equal(2, Veterania.Aplicar(s.M, 3, false, 0.1, 100, 100)); // derrota tira 1
        Assert.Equal(0, Veterania.Aplicar(s.M, 0, false, 1, 100, 100));
    }

    [Fact]
    public void Derrota_tira_uma_marca_e_o_bonus_entra_no_ataque()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 15)), 200);
        var tropas = G(("lanceiro", 20));
        s.Guarnecer(s.CasteloAtk, tropas);
        Pessoas.Sincronizar(s.M, s.CasteloAtk);
        foreach (var p in Pessoas.Guarnicao(s.M, s.CasteloAtk)) p.Marcas = 5;
        var ex = Exercitos.Enviar(s.M, s.Atk, s.CasteloAtk.Id, tropas, alvo.Hex, OrdemAtacar.Id, false, CombateCenario.Plano("saque", "media"));
        Assert.Equal(5, Veterania.DaMarcha(s.M, ex));
        Assert.Equal(0.10, Veterania.BonusDe(s.M, Veterania.DaMarcha(s.M, ex)), 6);
        var b = s.Chegar(ex);
        Assert.Equal(s.M.F.ValorAtaque(tropas, alvo.Guarnicao, 0.10), b.Marcos[0].A, 6);
        s.Terminar(b);
        Assert.Equal("recuo", b.Resultado);
        Assert.Equal(4, Veterania.DaMarcha(s.M, ex));
        Assert.Equal(0.05, Veterania.BonusDe(s.M, Veterania.DaMarcha(s.M, ex)), 6);
        Assert.Equal(0, Veterania.BonusDe(s.M, 1.9));
        Assert.Equal(0.15, Veterania.BonusDe(s.M, 9));
    }

    [Fact]
    public void Recrutas_novos_diluem_as_marcas_e_quem_sai_leva_a_media()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = t.M.Locais[r.CasteloId];
        c.Guarnicao["arqueiro"] = 4;
        Pessoas.Sincronizar(t.M, c);
        foreach (var p in Pessoas.Guarnicao(t.M, c)) p.Marcas = 3;
        t.DarRecursos(r);
        t.DarRecursos(r, 1000, "couro");
        var item = Recrutamento.Recrutar(t.M, r, c.Id, "lanceiro", 4);
        t.AvancarMin(item.DuracaoSeg / 60 + 1);
        Assert.Equal(8, GT.Total(c.Guarnicao));
        Assert.Equal(1.5, Veterania.DoLocal(t.M, c), 6);   // 4 veteranos com 3 e 4 recrutas com 0
        // quem sai leva as próprias marcas: os mais veteranos saem primeiro
        var ex = Exercitos.Enviar(t.M, r, c.Id, G(("arqueiro", 2)), t.M.G.Area(c.Hex, 1).First(h => h != c.Hex && !t.M.Mapa.Rio[h] && t.M.LocalNoHex(h) == null), OrdemMover.Id);
        Assert.Equal(3, Veterania.DaMarcha(t.M, ex), 6);
        Assert.Equal(1, Veterania.DoLocal(t.M, c), 6);   // ficaram 2 com 3 e 4 com 0
        // um exército veterano que volta entra na média
        foreach (var p in Pessoas.SoldadosDaMarcha(t.M, ex)) { p.Marcas = 5.5; t.M.Sujar(p); }
        Exercitos.Retornar(t.M, ex);
        t.AvancarMin(30);
        Assert.Equal((3 * 2 + 5.5 * 2) / 8, Veterania.DoLocal(t.M, c), 6);
    }

    // ---------------------------------------------------------------- queda do castelo

    private static (CombateCenario s, Local castelo, Exercito ex) Cerco(int nivel, JsonArray objetivos)
    {
        var s = new CombateCenario();
        var castelo = s.Alvo(TipoLocal.Castelo, G(("lanceiro", 5)), 100);
        castelo.Nivel = nivel;
        var ex = s.Atacar(castelo, G(("arqueiro", 100)), CombateCenario.Plano("cerco", "media", objetivos));
        return (s, castelo, ex);
    }

    [Fact]
    public void Queda_com_outros_locais_muda_a_sede_e_perde_recursos_populacao_e_reliquias()
    {
        var (s, castelo, ex) = Cerco(10, new JsonArray(CombateCenario.Obj("portoes", q: 1)));
        var mina = s.M.AdicionarLocal(new Local { ReinoId = s.Def.Id, Tipo = TipoLocal.Mina, Produz = "ferro", Nivel = 9, Hex = s.HexLivre(castelo.Hex, 3), Nome = "Mina Funda" });
        var vila = s.M.AdicionarLocal(new Local { ReinoId = s.Def.Id, Tipo = TipoLocal.Vila, Produz = "comida", Nivel = 8, Hex = s.HexLivre(castelo.Hex, 3, 1), Nome = "Vila Alta" });
        castelo.Estoque["madeira"] = 1000;
        mina.Estoque["ferro"] = 400;
        var rel = s.M.Reliquias.Adicionar(new Reliquia { Nome = "Coroa de Ferro", Tipo = "ataque", ReinoId = s.Def.Id, LocalId = castelo.Id });
        s.Congelar(s.Def);
        var b = s.Chegar(ex);
        s.Terminar(b);
        Assert.Equal("vitoria", b.Resultado);
        var popAntes = 100 - b.MiliciaMorta;
        // o castelo virou ruína sem dono; a sede foi para o local de maior nível com metade do nível antigo
        Assert.True(castelo.Ruina);
        Assert.Equal(0, castelo.ReinoId);
        Assert.Equal(mina.Id, s.Def.CasteloId);
        Assert.Equal(TipoLocal.Castelo, mina.Tipo);
        Assert.Equal(5, mina.Nivel);
        Assert.Null(mina.Produz);
        // −50% dos recursos guardados (o que sobrou do castelo vai para a nova sede), −30% da população civil
        Assert.Equal(200, mina.Estoque.Qtd("ferro"), 6);
        Assert.Equal(500, mina.Estoque.Qtd("madeira"), 6);
        Assert.Equal(popAntes - Math.Floor(popAntes * s.M.P.Queda.Populacao), s.Def.Pop, 6);
        // a relíquia do castelo vai com o atacante
        Assert.Equal(ex.Id, rel.MarchaId);
        Assert.Equal(s.Atk.Id, rel.ReinoId);
        // a vila acima do novo castelo fica como está, mas só sobe quando o castelo passar dela
        Assert.Equal(8, vila.Nivel);
        Assert.Throws<RegraException>(() => Obras.Melhorar(s.M, s.Def, vila.Id));
        var q = s.Def.UltimaQueda!;
        Assert.False(q.Exilio);
        Assert.Contains("Coroa de Ferro", q.ReliquiasLevadas);
        var relat = s.M.Relatorios.Single(x => x.ReinoId == s.Def.Id && x.Tipo == "queda");
        Assert.DoesNotContain(s.Atk.Nome, relat.Dados.ToJsonString());   // sem estandarte, sem nome
        Assert.Contains(s.M.Notificacoes, n => n.ReinoId == s.Atk.Id && n.Titulo == "Castelo derrubado");
    }

    [Fact]
    public void Sem_outros_locais_o_reino_recomeca_em_exilio_longe_de_quem_derrubou()
    {
        var (s, castelo, ex) = Cerco(3, new JsonArray(CombateCenario.Obj("portoes", q: 1)));
        var hexAntigo = castelo.Hex;
        // uma relíquia que o reino leva num exército em campo fica com ele
        var longe = s.HexLivre(s.CasteloAtk.Hex, 12);
        var campo = (Exercito)s.M.Marchas.Adicionar(new Exercito { ReinoId = s.Def.Id, Tropas = G(("lanceiro", 1)), Caminho = [longe], Tempos = [s.M.Agora], Origem = longe, Destino = longe, Postura = Postura.ApenasDefender });
        var rel = s.M.Reliquias.Adicionar(new Reliquia { Nome = "Cálice", Tipo = "producao", ReinoId = s.Def.Id });
        Reliquias.Carregar(s.M, rel, campo);
        var b = s.Chegar(ex);
        s.Terminar(b);
        Assert.Equal("vitoria", b.Resultado);
        var q = s.Def.UltimaQueda!;
        Assert.True(q.Exilio);
        Assert.True(castelo.Ruina);
        var novo = s.M.Locais[s.Def.CasteloId];
        Assert.NotEqual(hexAntigo, novo.Hex);
        Assert.Equal(TipoLocal.Castelo, novo.Tipo);
        Assert.Equal(1, novo.Nivel);
        Assert.Single(s.M.LocaisDe(s.Def.Id));
        var e = s.M.P.Guerra.Exilio;
        Assert.Equal(e.Kit["madeira"], novo.Estoque.Qtd("madeira"), 6);
        Assert.Equal(e.Tropas["milicia"], novo.Guarnicao.GetValueOrDefault("milicia"));
        Assert.Equal(e.Pop, s.Def.Pop, 6);
        Assert.Equal(s.M.Agora + T.DeHoras(s.M.P.EscudoExilioH), s.Def.EscudoAte);
        Assert.Contains("Cálice", q.ReliquiasMantidas);
        Assert.Equal(s.Def.Id, rel.ReinoId);
        // longe: entre a metade mais distante das vagas livres, medida dos locais do atacante
        int Dist(int h) => s.M.LocaisDe(s.Atk.Id).Min(l => s.M.G.Distancia(l.Hex, h));
        var livres = s.M.Mapa.Vagas.Where(v => !s.M.Reinos.Any(x => x.Ativo && x.Id != s.Def.Id && x.Vaga == v.Indice)).Select(v => Dist(v.Castelo)).OrderBy(x => x).ToList();
        Assert.True(Dist(novo.Hex) >= livres[livres.Count / 2 - 1]);
        Assert.True(Dist(novo.Hex) > Dist(hexAntigo));
        // o escudo de exílio vale: um ataque descobre ao chegar e volta sem combate
        Assert.True(s.Def.SobEscudo(s.M.Agora));
        Assert.Contains(s.M.Relatorios, x => x.ReinoId == s.Def.Id && x.Tipo == "queda" && x.Dados["exilio"]!.GetValue<bool>());
    }

    [Fact]
    public void Gancho_de_linhagem_escolhe_o_ponto_do_exilio()
    {
        var (s, castelo, ex) = Cerco(2, new JsonArray(CombateCenario.Obj("portoes", q: 1)));
        var escolhido = s.HexLivre(s.CasteloAtk.Hex, 6);
        AjustesTeste.De(s.M).Exilio = escolhido;
        s.Terminar(s.Chegar(ex));
        Assert.Equal(escolhido, s.M.Locais[s.Def.CasteloId].Hex);
    }

    // ---------------------------------------------------------------- interceptação

    /// <summary>Exército do defensor saindo de uma mina à vista do atacante rumo a um ponto longe.</summary>
    private static (CombateCenario s, Local mina, Exercito alvo) Marcha(int lanceiros = 10, int dist = 10)
    {
        var s = new CombateCenario();
        var mina = s.Alvo(TipoLocal.Mina, G(("lanceiro", lanceiros)), 0);
        var destino = s.HexLivre(mina.Hex, dist);
        var alvo = Exercitos.Enviar(s.M, s.Def, mina.Id, G(("lanceiro", lanceiros)), destino, OrdemMover.Id);
        alvo.Carga.Somar("ferro", 200);   // cabe na carga dos 30 cavaleiros mesmo depois das baixas
        return (s, mina, alvo);
    }

    [Fact]
    public void Interceptacao_chega_antes_ao_ponto_de_encontro_vence_e_toma_a_carga()
    {
        var (s, _, alvo) = Marcha();
        var tropas = G(("cavalaria", 30));
        s.Guarnecer(s.CasteloAtk, tropas);
        var e = Interceptacoes.Calcular(s.M, s.CasteloAtk.Hex, tropas, alvo);
        Assert.NotNull(e);
        Assert.Contains(e!.Hex, alvo.Caminho);
        Assert.True(e.Nos <= e.Eles - T.DeSegundos(s.M.P.Guerra.Interceptacao.FolgaSeg));
        Assert.True(e.Indice < alvo.Caminho.Count - 1);
        // lentos demais não alcançam
        Assert.Null(Interceptacoes.Calcular(s.M, s.HexLivre(alvo.Origem, 25), G(("ariete", 1)), alvo));
        var ex = Exercitos.Enviar(s.M, s.Atk, s.CasteloAtk.Id, tropas, e.Hex, OrdemInterceptar.Id, false, new JsonObject { ["marchaId"] = alvo.Id });
        Assert.Equal(e.Hex, ex.Destino);
        s.AvancarAte(ex.Chegada);
        Assert.True(ex.Parado);
        s.AvancarAte(e.Eles);
        Assert.False(s.M.Marchas.ContemId(alvo.Id));                 // a marcha perdeu e saiu do mapa
        Assert.Equal(200, ex.Carga.Qtd("ferro"), 6);
        Assert.True(ex.Retornando);
        var rel = s.M.Relatorios.Single(x => x.ReinoId == s.Def.Id && x.Tipo == "defesa");
        Assert.Equal("interceptacao", rel.Dados["tipo"]!.GetValue<string>());
        Assert.Null(rel.Dados["atacante"]);                           // anônimo sem estandarte
        Assert.Contains(s.M.Relatorios, x => x.ReinoId == s.Atk.Id && x.Tipo == "ataque" && x.Dados["resultado"]!.GetValue<string>() == "vitoria");
    }

    [Fact]
    public void Interceptacao_falha_se_o_alvo_muda_de_rota()
    {
        var (s, mina, alvo) = Marcha();
        var tropas = G(("cavalaria", 30));
        s.Guarnecer(s.CasteloAtk, tropas);
        var e = Interceptacoes.Calcular(s.M, s.CasteloAtk.Hex, tropas, alvo)!;
        var ex = Exercitos.Enviar(s.M, s.Atk, s.CasteloAtk.Id, tropas, e.Hex, OrdemInterceptar.Id, false, new JsonObject { ["marchaId"] = alvo.Id });
        Exercitos.DarOrdem(s.M, s.Def, alvo.Id, OrdemRetornar.Id, null);   // o alvo volta para a mina
        s.AvancarAte(Math.Max(ex.Chegada, e.Eles) + T.Min);
        Assert.True(ex.Retornando);
        Assert.Contains(s.M.Relatorios, x => x.ReinoId == s.Atk.Id && x.Tipo == "ataque" && x.Dados["resultado"]!.GetValue<string>() == "sem-combate");
        Assert.DoesNotContain(s.M.Relatorios, x => x.ReinoId == s.Def.Id && x.Tipo == "defesa");
    }

    [Fact]
    public void So_marcha_alheia_a_vista_e_interceptavel()
    {
        var (s, _, alvo) = Marcha();
        Assert.Throws<RegraException>(() => Interceptacoes.Alvo(s.M, s.Def, alvo.Id));          // a própria
        AjustesTeste.De(s.M).Bloquear = "Pacto de não agressão.";
        Assert.Equal("Pacto de não agressão.", Assert.Throws<RegraException>(() => Interceptacoes.Alvo(s.M, s.Atk, alvo.Id)).Message);
        AjustesTeste.De(s.M).Bloquear = null;
        Assert.Same(alvo, Interceptacoes.Alvo(s.M, s.Atk, alvo.Id));
        s.AvancarAte(alvo.Chegada);                                                              // chegou longe, fora da visão
        Assert.Throws<RegraException>(() => Interceptacoes.Alvo(s.M, s.Atk, alvo.Id));
    }

    // ---------------------------------------------------------------- posturas automáticas

    /// <summary>Exército do defensor que passa a 1 hexágono do castelo atacante (sem terminar ali).</summary>
    private static (CombateCenario s, Exercito alvo, int hexEncontro) Passagem(Postura postura, bool atacouAntes = false)
    {
        var s = new CombateCenario();
        var mina = s.Alvo(TipoLocal.Mina, G(("lanceiro", 10)), 0);
        var c = s.CasteloAtk;
        s.Guarnecer(c, G(("cavalaria", 30), ("milicia", 5)));
        c.Postura = postura;
        if (atacouAntes) Revide.Registrar(s.M, s.Atk.Id, s.Def.Id);
        // destino cujo caminho passa a 1 do castelo antes do fim
        foreach (var d in s.M.G.Area(c.Hex, 4).Where(h => s.M.G.Distancia(h, c.Hex) >= 3 && Obras.HexLivre(s.M, h) && !s.M.Mapa.Rio[h]))
        {
            var rota = Caminhos.Calcular(s.M, mina.Hex, d, "Lenta");
            var i = rota.Hexes.ToList().FindIndex(h => s.M.G.Distancia(h, c.Hex) <= 1);
            if (rota.Hexes[^1] != d || i < 1 || i >= rota.Hexes.Count - 1) continue;
            var alvo = Exercitos.Enviar(s.M, s.Def, mina.Id, G(("lanceiro", 10)), d, OrdemMover.Id);
            alvo.Carga.Somar("ferro", 200);
            return (s, alvo, rota.Hexes[i]);
        }
        throw new Exception("sem caminho de teste");
    }

    [Fact]
    public void Guarnicao_que_ataca_qualquer_ameaca_sai_contra_quem_passa_no_alcance()
    {
        var (s, alvo, h) = Passagem(Postura.AtacarQualquer);
        var quando = alvo.Tempos[alvo.Caminho.IndexOf(h)];
        s.AvancarAte(quando);
        Assert.False(s.M.Marchas.ContemId(alvo.Id));
        Assert.Equal(5, s.CasteloAtk.Guarnicao["milicia"]);                    // a milícia não sai
        Assert.True(s.CasteloAtk.Guarnicao["cavalaria"] < 30);                  // as perdas saem da guarnição
        Assert.True(s.CasteloAtk.Estoque.Qtd("ferro") >= 200);                  // a carga tomada fica no local
        Assert.Contains(s.M.Relatorios, x => x.ReinoId == s.Def.Id && x.Tipo == "defesa" && x.Dados["tipo"]!.GetValue<string>() == "interceptacao");
    }

    [Fact]
    public void Apenas_defender_nao_sai_e_atacar_quem_atacar_so_revida()
    {
        var (s, alvo, _) = Passagem(Postura.ApenasDefender);
        s.AvancarAte(alvo.Chegada);
        Assert.True(s.M.Marchas.ContemId(alvo.Id));
        Assert.Equal(30, s.CasteloAtk.Guarnicao["cavalaria"]);

        var (s2, alvo2, _) = Passagem(Postura.AtacarQuemAtacar);
        s2.AvancarAte(alvo2.Chegada);
        Assert.True(s2.M.Marchas.ContemId(alvo2.Id));                         // ninguém atacou: não revida

        var (s3, alvo3, _) = Passagem(Postura.AtacarQuemAtacar, atacouAntes: true);
        s3.AvancarAte(alvo3.Chegada);
        Assert.False(s3.M.Marchas.ContemId(alvo3.Id));                        // revida contra quem atacou
    }

    [Fact]
    public void Exercito_parado_que_ataca_qualquer_ameaca_alcanca_quem_passa()
    {
        var s = new CombateCenario();
        var mina = s.Alvo(TipoLocal.Mina, G(("lanceiro", 10)), 0);
        var destino = s.HexLivre(mina.Hex, 6);
        var rota = Caminhos.Calcular(s.M, mina.Hex, destino, "Lenta");
        var meio = rota.Hexes[rota.Hexes.Count / 2];
        var vig = (Exercito)s.M.Marchas.Adicionar(new Exercito { ReinoId = s.Atk.Id, Tropas = G(("cavalaria", 30)), Caminho = [meio], Tempos = [s.M.Agora], Origem = meio, Destino = meio, OrigemLocalId = s.CasteloAtk.Id, Postura = Postura.AtacarQualquer });
        var alvo = Exercitos.Enviar(s.M, s.Def, mina.Id, G(("lanceiro", 10)), destino, OrdemMover.Id);
        s.AvancarAte(alvo.Chegada);
        Assert.False(s.M.Marchas.ContemId(alvo.Id));
        Assert.True(vig.Parado);
        Assert.True(GT.Total(vig.Tropas) < 30);
    }

    // ---------------------------------------------------------------- avistamentos

    [Fact]
    public void Forcas_vistas_ficam_no_mapa_por_10h_depois_de_sair_da_visao_e_somem()
    {
        var s = new CombateCenario();
        var mina = s.Alvo(TipoLocal.Mina, G(("lanceiro", 10)), 0);
        var visao = ForcasVistas.Visao(s.M, s.Atk.Id);
        var destino = s.M.G.Area(mina.Hex, 12).First(h => s.M.G.Distancia(h, mina.Hex) >= 10 && !visao.Contains(h) && Obras.HexLivre(s.M, h) && !s.M.Mapa.Rio[h]
            && Caminhos.Calcular(s.M, mina.Hex, h, "Lenta").Hexes[^1] == h);
        var alvo = Exercitos.Enviar(s.M, s.Def, mina.Id, G(("lanceiro", 10)), destino, OrdemMover.Id);
        var sai = alvo.Caminho.FindIndex(h => !visao.Contains(h));
        Assert.True(sai > 0);
        s.AvancarAte(alvo.Tempos[sai] - 1);
        Assert.Empty(ForcasVistas.De(s.M, s.Atk.Id));
        s.AvancarAte(alvo.Tempos[sai]);
        var f = Assert.Single(ForcasVistas.De(s.M, s.Atk.Id));
        Assert.Equal(alvo.Caminho[sai - 1], f.Hex);
        Assert.Equal("exercito", f.Marcha);
        Assert.Empty(ForcasVistas.De(s.M, s.Def.Id));                       // a própria marcha não conta
        s.AvancarAte(f.Ate - 1);
        Assert.Single(ForcasVistas.De(s.M, s.Atk.Id));
        s.AvancarAte(f.Ate);
        Assert.DoesNotContain(s.M.ForcasVistas, x => x.ReinoId == s.Atk.Id);
    }

    // ---------------------------------------------------------------- modelos e último ataque

    [Fact]
    public void Ultimo_ataque_e_modelos_ficam_guardados_no_reino()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 5)), 100);
        var ex = s.Atacar(alvo, G(("cavalaria", 12)), CombateCenario.Plano("saque", "conservadora",
            new JsonArray(CombateCenario.Obj("recurso", "ferro", 500), CombateCenario.Obj("recurso", "pedra", 300))));
        var u = s.Atk.UltimoAtaque!;
        Assert.Equal("saque", u.Tipo);
        Assert.Equal("conservadora", u.Tatica);
        Assert.Equal(12, u.Tropas["cavalaria"]);
        Assert.Equal(alvo.Hex, u.AlvoHex);
        Assert.Equal(s.CasteloAtk.Id, u.DeLocalId);
        Assert.Equal("auto", u.Objetivos[0].R);                    // o recurso principal do alvo vira "auto"
        Assert.Equal("pedra", u.Objetivos[1].R);
        var md = ModelosAtaque.Salvar(s.M, s.Atk, "Saque leve", "saque", "media", false, true, G(("cavalaria", 10)), [new Objetivo("recurso", "auto", 800)]);
        Assert.Single(s.Atk.ModelosAtaque);
        Assert.Equal("madeira", ModelosAtaque.ObjetivosPara(md, new Local { Produz = "madeira" })[0].R);
        Assert.Empty(ModelosAtaque.ObjetivosPara(md, new Local { Produz = null }));
        Assert.Throws<RegraException>(() => ModelosAtaque.Salvar(s.M, s.Atk, "x", "saque", "media", false, false, G(("milicia", 3)), null));
        Assert.Throws<RegraException>(() => ModelosAtaque.Salvar(s.M, s.Atk, "x", "massacre", "media", false, false, null, [new Objetivo("recurso", "ferro", 1)]));
        for (var i = 1; i < s.M.P.Guerra.ModelosMax; i++) ModelosAtaque.Salvar(s.M, s.Atk, null, null, null, false, false, null, null);
        Assert.Throws<RegraException>(() => ModelosAtaque.Salvar(s.M, s.Atk, null, null, null, false, false, null, null));
        ModelosAtaque.Apagar(s.M, s.Atk, md.Id);
        Assert.Equal(s.M.P.Guerra.ModelosMax - 1, s.Atk.ModelosAtaque.Count);
    }

    [Fact]
    public void Recurso_auto_vira_o_recurso_principal_do_alvo_e_sem_tipo_vale_o_padrao_do_alvo()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 5)), 100);
        var p = Ataques.Normalizar(s.M, alvo, G(("cavalaria", 10)), PlanoAtaque.Ler(new JsonObject
        {
            ["tipo"] = "saque", ["objetivos"] = new JsonArray(CombateCenario.Obj("recurso", "auto", 500)),
        }));
        Assert.Equal("ferro", p.Objetivos.Single().R);
        var ruina = s.M.AdicionarLocal(new Local { ReinoId = 0, Ruina = true, Tipo = TipoLocal.Vila, Hex = s.HexLivre(s.CasteloAtk.Hex, 4), Nome = "Ruína" });
        Assert.Equal(Ataques.Ocupacao, Ataques.Normalizar(s.M, ruina, G(("cavalaria", 10)), PlanoAtaque.Ler(new JsonObject())).Tipo);
    }

    // ---------------------------------------------------------------- persistência

    [Fact]
    public void Feridos_modelos_avistamentos_e_interceptacao_sao_salvos_e_recarregados()
    {
        var dir = Path.Combine(Path.GetTempPath(), "rp-guerra-" + Guid.NewGuid().ToString("N"));
        try
        {
            var (s, _, alvo) = Marcha();
            var tropas = G(("cavalaria", 30));
            s.Guarnecer(s.CasteloAtk, tropas);
            var e = Interceptacoes.Calcular(s.M, s.CasteloAtk.Hex, tropas, alvo)!;
            var ex = Exercitos.Enviar(s.M, s.Atk, s.CasteloAtk.Id, tropas, e.Hex, OrdemInterceptar.Id, false, new JsonObject { ["marchaId"] = alvo.Id });
            s.AvancarAte(ex.Chegada);
            Feridos.Adicionar(s.M, s.Atk, G(("lanceiro", 3)), "teste");
            ModelosAtaque.Salvar(s.M, s.Atk, "Saque", "saque", "media", false, false, G(("cavalaria", 5)), [new Objetivo("recurso", "auto", 500)]);
            ForcasVistas.Registrar(s.M, s.Atk.Id, alvo, alvo.Origem, "sul");
            Revide.Registrar(s.M, s.Atk.Id, s.Def.Id);
            s.Guarnecer(s.CasteloAtk, G(("lanceiro", 2)));
            Pessoas.Sincronizar(s.M, s.CasteloAtk);
            foreach (var p in Pessoas.Guarnicao(s.M, s.CasteloAtk)) { p.Marcas = 2.5; s.M.Sujar(p); }
            using var db = new ReinoDePedra.Jogo.Persistencia.Banco(Path.Combine(dir, "t.db"));
            db.Salvar(s.M);
            Assert.Equal(0, db.SalvarEsquecidos(s.M));
            var m2 = new Mundo(Balanceamento.Padrao, s.T.Relogio);
            using (var db2 = new ReinoDePedra.Jogo.Persistencia.Banco(Path.Combine(dir, "t.db"))) db2.Carregar(m2);
            m2.PrepararMapa();
            foreach (var ev in m2.Eventos) m2.Agenda.Inserir(ev);
            var r2 = m2.Reinos[s.Atk.Id];
            Assert.Equal(3, Feridos.Total(r2));
            Assert.Equal("auto", r2.ModelosAtaque.Single().Objetivos[0].R);
            Assert.Single(ForcasVistas.De(m2, s.Atk.Id));
            Assert.True(Revide.Atacou(m2, s.Atk.Id, s.Def.Id));
            Assert.Equal(2.5, Veterania.DoLocal(m2, m2.Locais[s.CasteloAtk.Id]), 6);
            // o encontro agendado acontece no mundo recarregado
            s.T.Relogio.Agora = e.Eles;
            m2.ProcessarAte(e.Eles);
            AjustesTeste.FalharSeErro();
            Assert.False(m2.Marchas.ContemId(alvo.Id));
            Assert.Equal(200, m2.Marchas[ex.Id].Carga.Qtd("ferro"), 6);
        }
        finally { try { Directory.Delete(dir, true); } catch { } }
    }
}
