using System.Text.Json;
using System.Text.Json.Nodes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Testes;

public class CombateTestes
{
    public CombateTestes() => AjustesTeste.Garantir();

    private static Dictionary<string, int> G(params (string k, int n)[] x) => x.ToDictionary(p => p.k, p => p.n);
    private static Dictionary<string, int> Grupo(JsonElement e) => e.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.GetInt32());

    // ---------------------------------------------------------------- combates de referência pelo caminho completo

    public static IEnumerable<object[]> Referencias() =>
        Enumerable.Range(0, Balanceamento.Padrao.Referencia.GetProperty("batalhas").GetArrayLength()).Select(i => new object[] { i });

    [Theory]
    [MemberData(nameof(Referencias))]
    public void Combate_de_referencia_pela_marcha_batalha_e_resultado(int i)
    {
        var c = Balanceamento.Padrao.Referencia.GetProperty("batalhas")[i];
        var x = c.GetProperty("extra");
        double X(string n) => x.TryGetProperty(n, out var v) ? v.GetDouble() : 0;
        var atk = Grupo(c.GetProperty("atk"));
        var def = Grupo(c.GetProperty("def"));
        double? lim = c.GetProperty("limite").ValueKind == JsonValueKind.Null ? null : c.GetProperty("limite").GetDouble();
        var esperado = c.GetProperty("res");

        var s = new CombateCenario();
        // castelo no nível do caso: a defesa própria (menagem e portões básicos) vem do nível; o caso traz o nível efetivo dos portões
        var castelo = X("nivel") > 0 || X("portoes") > 0;
        var nivel = Math.Max(1, (int)X("nivel"));
        var alvo = s.Alvo(castelo ? TipoLocal.Castelo : TipoLocal.Mina, def, X("pop"), nivel: nivel);
        if (castelo) { alvo.Portoes = (int)X("portoes"); alvo.EstruturaPortoes = alvo.Portoes * s.M.P.PortoesEstrutura; }
        Assert.Equal((int)X("portoes"), castelo ? Defesas.PortoesEfetivos(s.M, alvo) : 0);
        // arqueiros no alto: os da menagem e torres do mesmo dono no alcance (nível 2 = 12; quatro de nível 1 = 24...)
        var arq = (int)X("arqTorre") - Defesas.ArqueirosMenagem(s.M, alvo);
        var porNivel = s.M.P.Torre.ArqPorNivel;
        if (arq == 2 * porNivel) s.Torre(alvo, 2);
        else for (var k = 0; k < arq / porNivel; k++) s.Torre(alvo, 1, k);
        Assert.Equal((int)X("arqTorre"), Defesas.ArqueirosNoAlto(s.M, alvo));
        var aj = AjustesTeste.De(s.M);
        aj.BonusA = X("bonusA");
        aj.BonusD[alvo.Id] = X("reliquia") + X("bonusD");
        var tatica = lim == null ? "semLimite" : s.M.P.Combate.Taticas.Single(kv => kv.Value == lim).Key;

        var ex = s.Atacar(alvo, atk, CombateCenario.Plano("saque", tatica));
        var b = s.Chegar(ex);
        Assert.False(b.Encerrada);
        Assert.Equal(esperado.GetProperty("A").GetDouble(), Formulas.ArredJs(b.Marcos[0].A));
        Assert.Equal(esperado.GetProperty("D").GetDouble(), Formulas.ArredJs(b.Marcos[0].D));
        s.Terminar(b);
        Assert.True(b.Encerrada);
        var venceA = esperado.GetProperty("venceA").GetBoolean();
        var recuou = esperado.GetProperty("recuou").GetBoolean();
        Assert.Equal(venceA ? "vitoria" : recuou ? "recuo" : "derrota", b.Resultado);
        var perdaA = esperado.GetProperty("perdaA").GetDouble();
        var perdaD = esperado.GetProperty("perdaD").GetDouble();
        Assert.Equal((int)Formulas.ArredJs(GT.Total(atk) * perdaA), GT.Total(b.PerdasAtaque));
        Assert.Equal((int)Formulas.ArredJs(GT.Total(def) * perdaD), GT.Total(b.PerdasDefesa));
        // a guarnição perdeu o que o relatório diz; o atacante que sobrou volta para casa
        Assert.Equal(GT.Total(def) - GT.Total(b.PerdasDefesa), GT.Total(alvo.Guarnicao));
        var vivos = GT.Total(atk) - GT.Total(b.PerdasAtaque);
        if (vivos > 0) { Assert.True(s.M.Marchas.ContemId(ex.Id)); Assert.True(ex.Retornando); }
        else Assert.False(s.M.Marchas.ContemId(ex.Id));
        if (recuou) Assert.Equal(Batalhas.TempoAte(b.Marcos[0], lim!.Value), b.EncerradaEm);
    }

    // ---------------------------------------------------------------- tática, recuo e reforço

    [Fact]
    public void Tatica_recua_no_limite_de_baixas_e_antes_do_fim()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 15)), 200);
        var ex = s.Atacar(alvo, G(("lanceiro", 10)), CombateCenario.Plano("saque", "conservadora"));
        var b = s.Chegar(ex);
        Assert.True(b.FimPrevisto < b.Fim);
        s.Terminar(b);
        Assert.Equal("recuo", b.Resultado);
        Assert.Equal((int)Formulas.ArredJs(10 * s.M.P.Combate.Taticas["conservadora"]!.Value), GT.Total(b.PerdasAtaque));
        Assert.True(ex.Retornando);
        // sem limite: luta até cair
        var s2 = new CombateCenario();
        var alvo2 = s2.Alvo(TipoLocal.Mina, G(("lanceiro", 15)), 200);
        var ex2 = s2.Atacar(alvo2, G(("lanceiro", 10)), CombateCenario.Plano("saque", "semLimite"));
        var b2 = s2.Chegar(ex2);
        Assert.Equal(b2.Fim, b2.FimPrevisto);
        s2.Terminar(b2);
        Assert.Equal("derrota", b2.Resultado);
        Assert.False(s2.M.Marchas.ContemId(ex2.Id));
    }

    [Fact]
    public void Recuo_ordenado_perde_a_parte_ja_lutada()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 15)), 200);
        var ex = s.Atacar(alvo, G(("arqueiro", 30)), CombateCenario.Plano("saque", "semLimite"));
        var b = s.Chegar(ex);
        var m0 = b.Marcos[0];
        s.AvancarAte(Batalhas.TempoAte(m0, 0.5));
        Assert.Equal(0.5, Batalhas.Progresso(b, s.M.Agora), 3);
        Assert.Throws<RegraException>(() => Exercitos.DarOrdem(s.M, s.Atk, ex.Id, OrdemRetornar.Id, null));   // em batalha: só recuar
        Batalhas.Recuar(s.M, s.Atk, b.Id);
        Assert.Equal("recuo", b.Resultado);
        Assert.Equal((int)Formulas.ArredJs(30 * m0.PerdaA * 0.5), GT.Total(b.PerdasAtaque));
        Assert.Equal((int)Formulas.ArredJs(15 * m0.PerdaD * 0.5), GT.Total(b.PerdasDefesa));
        Assert.True(ex.Retornando);
        Assert.Throws<RegraException>(() => Batalhas.Recuar(s.M, s.Atk, b.Id));
        Assert.Throws<RegraException>(() => Batalhas.Recuar(s.M, s.T.NovoReino(), b.Id));
    }

    [Fact]
    public void Defesa_que_recua_salva_tropas_e_populacao_mas_o_local_e_saqueado()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 3)), 4);
        var vila = s.M.AdicionarLocal(new Local { ReinoId = s.Def.Id, Tipo = TipoLocal.Vila, Produz = "comida", Hex = s.HexLivre(alvo.Hex, 3), Nome = "Vila Vizinha" });
        alvo.Estoque["ferro"] = 200;
        var ex = s.Atacar(alvo, G(("cavalaria", 6)), CombateCenario.Plano("saque", "media", new JsonArray(CombateCenario.Obj("recurso", "ferro", 50))));
        var b = s.Chegar(ex);
        var pop0 = s.Def.Pop;
        s.AvancarAte(b.Inicio + (b.Fim - b.Inicio) / 4);
        Batalhas.Recuar(s.M, s.Def, b.Id);
        Assert.Equal("defesa-recuou", b.Resultado);
        Assert.Equal(0, b.MiliciaMorta);
        Assert.Equal(pop0, s.Def.Pop);
        Assert.Empty(alvo.Guarnicao);
        var fuga = s.M.Marchas.OfType<Exercito>().Single(e => e.ReinoId == s.Def.Id);
        Assert.Equal(vila.Id, fuga.AlvoLocalId);
        Assert.Equal(3 - GT.Total(b.PerdasDefesa), GT.Total(fuga.Tropas));
        Assert.Equal(50, ex.Carga.Qtd("ferro"), 6);
    }

    [Fact]
    public void Reforco_que_chega_durante_a_batalha_muda_o_resultado()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 4)), 3);
        var quartel = s.M.AdicionarLocal(new Local { ReinoId = s.Def.Id, Tipo = TipoLocal.Quartel, Hex = s.M.G.Vizinhos(alvo.Hex).First(h => Obras.HexLivre(s.M, h) && !s.M.Mapa.Rio[h]), Nome = "Quartel" });
        s.Guarnecer(quartel, G(("cavalaria", 10)));
        var ex = s.Atacar(alvo, G(("arqueiro", 8)));
        var b = s.Chegar(ex);
        Assert.Equal(1, b.Marcos[0].PerdaD);   // sem reforço, o ataque venceria
        var reforco = Exercitos.Enviar(s.M, s.Def, quartel.Id, G(("cavalaria", 10)), alvo.Hex, OrdemReforcar.Id);
        Assert.True(reforco.Chegada < b.FimPrevisto);
        s.AvancarAte(reforco.Chegada);
        Assert.Equal(14, GT.Total(alvo.Guarnicao));
        Assert.Equal(2, b.Marcos.Count);
        Assert.Equal("defesa", b.Marcos[1].Lado);
        s.Terminar(b);
        Assert.Equal("derrota", b.Resultado);
        var esperado = s.M.F.Batalha(G(("arqueiro", 8)), G(("lanceiro", 4), ("cavalaria", 10)), new ExtraDefesa { Pop = 3 }, null);
        Assert.Equal((int)Formulas.ArredJs(14 * esperado.PerdaD), GT.Total(b.PerdasDefesa));
        // a série mostra o salto na chegada do reforço
        var serie = Batalhas.Serie(b, s.M.Agora);
        Assert.Contains(serie, p => p.T == b.Marcos[1].T - b.Inicio && p.D > b.Marcos[0].D);
    }

    [Fact]
    public void Tropas_que_saem_do_local_em_batalha_deixam_de_defender()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 12)), 3);
        s.M.AdicionarLocal(new Local { ReinoId = s.Def.Id, Tipo = TipoLocal.Vila, Produz = "comida", Hex = s.HexLivre(alvo.Hex, 3), Nome = "Vila" });
        var ex = s.Atacar(alvo, G(("arqueiro", 8)));
        var b = s.Chegar(ex);
        Assert.True(b.Marcos[0].PerdaA >= 1);
        Exercitos.Enviar(s.M, s.Def, alvo.Id, G(("lanceiro", 10)), s.HexLivre(alvo.Hex, 2), OrdemMover.Id);
        Assert.Equal(2, b.Marcos.Count);
        s.Terminar(b);
        Assert.Equal("vitoria", b.Resultado);
    }

    [Fact]
    public void Torre_no_alcance_muda_o_resultado_e_fica_fora_do_teto()
    {
        var sem = new CombateCenario();
        var a1 = sem.Alvo(TipoLocal.Mina, G(("lanceiro", 4)), 3);
        var b1 = sem.Chegar(sem.Atacar(a1, G(("arqueiro", 8))));
        sem.Terminar(b1);
        Assert.Equal("vitoria", b1.Resultado);

        var com = new CombateCenario();
        var a2 = com.Alvo(TipoLocal.Mina, G(("lanceiro", 4)), 3);
        var t = com.Torre(a2, 2);
        Assert.Contains(a2, Defesas.Protege(com.M, t));
        var b2 = com.Chegar(com.Atacar(a2, G(("arqueiro", 8))));
        com.Terminar(b2);
        Assert.Equal("derrota", b2.Resultado);
        // fora do teto: com +50% de bônus de defesa, a torre continua somando inteira
        var alto = 2 * com.M.P.Torre.ArqPorNivel;
        var x = new ExtraDefesa { Pop = 3, ArqTorre = alto, BonusD = 0.5 };
        var sTorre = com.M.F.ValorDefesa(G(("lanceiro", 4)), G(("arqueiro", 8)), x) - com.M.F.ValorDefesa(G(("lanceiro", 4)), G(("arqueiro", 8)), x with { ArqTorre = 0 });
        Assert.Equal(alto * com.M.B.U["arqueiro"].Def * com.M.P.Torre.BonusAlto * 1.5, sTorre, 6);
        // torre de outro reino não protege
        var alheia = new CombateCenario();
        var a3 = alheia.Alvo(TipoLocal.Mina, G(("lanceiro", 4)), 3);
        alheia.Torre(a3, 2).ReinoId = alheia.Atk.Id;
        Assert.Equal(0, Defesas.ArqueirosNoAlto(alheia.M, a3));
    }

    // ---------------------------------------------------------------- escudo e permissões

    [Fact]
    public void Escudo_de_novato_so_e_descoberto_ao_chegar()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 5)), 100);
        s.Def.EscudoAte = s.M.Agora + T.DeHoras(s.M.P.EscudoNovatoH);
        var ex = s.Atacar(alvo, G(("cavalaria", 10)));   // o envio não recusa
        s.AvancarAte(ex.Chegada);
        Assert.Empty(s.M.Batalhas);
        Assert.True(ex.Retornando);
        Assert.Equal(10, GT.Total(ex.Tropas));
        Assert.Equal(5, GT.Total(alvo.Guarnicao));
        var rel = s.M.Relatorios.Single(r => r.ReinoId == s.Atk.Id && r.Tipo == "ataque");
        Assert.Equal("sem-combate", rel.Dados["resultado"]!.GetValue<string>());
        Assert.Contains("escudo", rel.Dados["porQueVoltaram"]!.GetValue<string>());
        var relD = s.M.Relatorios.Single(r => r.ReinoId == s.Def.Id && r.Tipo == "defesa");
        Assert.Contains(s.Atk.Nome, relD.Dados["atacante"]!.ToJsonString());   // o defensor sabe quem veio; o escudo continua só descoberto na chegada
        // escudo de exílio é o mesmo campo
        s.Def.EscudoAte = s.M.Agora + T.DeHoras(s.M.P.EscudoExilioH);
        Assert.NotNull(Permissoes.MotivoChegada(s.M, s.Atk, s.Def));
    }

    [Fact]
    public void Local_que_some_com_as_tropas_a_caminho_e_descoberto_na_chegada()
    {
        var s = new CombateCenario();
        var mina = s.Alvo(TipoLocal.Mina, G(), 100, dist: 8);
        Assert.DoesNotContain(mina.Hex, ReinoDePedra.Jogo.Exploracao.Nevoas.VisiveisAgora(s.M, s.Atk.Id));
        var ex = s.Atacar(mina, G(("lanceiro", 5)));   // local público: ataca na névoa, sem ter visto
        s.M.RemoverLocal(mina);
        Assert.Throws<RegraException>(() => Ataques.Alvo(s.M, s.Atk, mina.Hex));   // novo envio já sabe que não há nada ali
        s.T.Avancar(TimeSpan.FromMilliseconds(ex.Chegada - s.M.Agora + 1000));
        var rel = s.M.Relatorios.Where(x => x.ReinoId == s.Atk.Id).OrderByDescending(x => x.Id).First();
        Assert.Contains("não existe mais", rel.Dados["porQueVoltaram"]!.GetValue<string>());
        s.T.AvancarHoras(2);
        Assert.Equal(5, s.CasteloAtk.Guarnicao["lanceiro"]);
    }

    [Fact]
    public void Bloqueio_conhecido_recusa_antes_de_enviar()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(), 100);
        AjustesTeste.De(s.M).Bloquear = "Pacto em vigor.";
        s.Guarnecer(s.CasteloAtk, G(("lanceiro", 5)));
        Assert.Equal("Pacto em vigor.", Assert.Throws<RegraException>(() =>
            Exercitos.Enviar(s.M, s.Atk, s.CasteloAtk.Id, G(("lanceiro", 5)), alvo.Hex, OrdemAtacar.Id, false, CombateCenario.Plano())).Message);
        Assert.Equal(5, s.CasteloAtk.Guarnicao["lanceiro"]);
    }

    [Fact]
    public void Envio_valida_tipo_objetivos_tatica_e_milicia()
    {
        var s = new CombateCenario();
        var mina = s.Alvo(TipoLocal.Mina, G(), 100);
        s.Guarnecer(s.CasteloAtk, G(("lanceiro", 10), ("milicia", 5)));
        Exercito Enviar(JsonObject plano, Dictionary<string, int>? g = null) =>
            Exercitos.Enviar(s.M, s.Atk, s.CasteloAtk.Id, g ?? G(("lanceiro", 1)), mina.Hex, OrdemAtacar.Id, false, plano);
        Assert.Contains("castelo", Assert.Throws<RegraException>(() => Enviar(CombateCenario.Plano("cerco"))).Message);
        Assert.Throws<RegraException>(() => Enviar(CombateCenario.Plano("pilhagem")));
        Assert.Throws<RegraException>(() => Enviar(CombateCenario.Plano("saque", "louca")));
        Assert.Throws<RegraException>(() => Enviar(CombateCenario.Plano("saque", objetivos: new JsonArray(CombateCenario.Obj("populacao", q: 10)))));
        Assert.Throws<RegraException>(() => Enviar(CombateCenario.Plano("saque", objetivos: new JsonArray(CombateCenario.Obj("recurso", "diamante", 10)))));
        Assert.Contains("só defende", Assert.Throws<RegraException>(() => Enviar(CombateCenario.Plano(), G(("milicia", 2)))).Message);
        Assert.Throws<RegraException>(() => Exercitos.Enviar(s.M, s.Atk, s.CasteloAtk.Id, G(("lanceiro", 1)), s.HexLivre(s.CasteloAtk.Hex, 3), OrdemAtacar.Id, false, CombateCenario.Plano()));
        Assert.Throws<RegraException>(() => Exercitos.Enviar(s.M, s.Atk, s.CasteloAtk.Id, G(("lanceiro", 1)), s.M.LocaisDe(s.Atk.Id).First(l => l.Tipo == TipoLocal.Vila).Hex, OrdemAtacar.Id, false, CombateCenario.Plano()));
        Assert.Equal(10, s.CasteloAtk.Guarnicao["lanceiro"]);
        // castelo: ocupação recusada, cerco aceito
        var s2 = new CombateCenario();
        var castelo = s2.Alvo(TipoLocal.Castelo, G(), 100);
        s2.Guarnecer(s2.CasteloAtk, G(("lanceiro", 10)));
        Assert.Throws<RegraException>(() => Exercitos.Enviar(s2.M, s2.Atk, s2.CasteloAtk.Id, G(("lanceiro", 1)), castelo.Hex, OrdemAtacar.Id, false, CombateCenario.Plano("ocupacao")));
        var ex = Exercitos.Enviar(s2.M, s2.Atk, s2.CasteloAtk.Id, G(("lanceiro", 1)), castelo.Hex, OrdemAtacar.Id, false, CombateCenario.Plano("cerco"));
        var p = PlanoAtaque.Ler(ex.Dados);
        Assert.Equal("cerco", p.Tipo);
        Assert.Equal("semLimite", p.Tatica);
        Assert.Contains(p.Objetivos, o => o.K == "portoes");
    }

    [Fact]
    public void Plano_sem_objetivos_usa_os_automaticos_e_ocupacao_comeca_por_tomar()
    {
        var s = new CombateCenario();
        var mina = s.Alvo(TipoLocal.Mina, G(), 100);
        var p = Ataques.Normalizar(s.M, mina, new PlanoAtaque { Tipo = "saque", Tatica = "" });
        Assert.Equal(s.M.P.Combate.TaticaPadrao, p.Tatica);
        Assert.Equal(new[] { "reliquia", "recurso" }, p.Objetivos.Select(o => o.K));
        Assert.Equal("ferro", p.Objetivos[1].R);
        Assert.Equal(0, p.Objetivos[1].Q);   // recurso não tem quantidade: o jogo decide pela carga
        var o = Ataques.Normalizar(s.M, mina, new PlanoAtaque { Tipo = "ocupacao", Objetivos = [new("reliquia", null, 0), new("tomar", null, 0)] });
        Assert.Equal(new[] { "tomar", "reliquia" }, o.Objetivos.Select(x => x.K));
        var rep = Ataques.Normalizar(s.M, mina, new PlanoAtaque { Tipo = "saque", Objetivos = [new("recurso", "ferro", 100), new("recurso", "ferro", 300)] });
        Assert.Single(rep.Objetivos);
    }

    // ---------------------------------------------------------------- efeitos por tipo

    [Fact]
    public void Saque_limitado_pela_carga_e_pelo_estoque_do_local()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(), 0);
        alvo.Estoque["ferro"] = 500; alvo.Estoque["madeira"] = 30;
        var cap = 10 * s.M.B.U["cavalaria"].Carga;
        var ex = s.Atacar(alvo, G(("cavalaria", 10)), CombateCenario.Plano("saque", "media",
            new JsonArray(CombateCenario.Obj("recurso", "madeira", 100), CombateCenario.Obj("recurso", "ferro", 500))));
        var b = s.Chegar(ex);
        s.Terminar(b);
        Assert.Equal("vitoria", b.Resultado);
        Assert.Equal(30, ex.Carga.Qtd("madeira"), 6);            // limitado pelo estoque
        Assert.Equal(cap - 30, ex.Carga.Qtd("ferro"), 6);        // limitado pela carga
        Assert.Equal(500 - (cap - 30), alvo.Estoque.Qtd("ferro"), 6);
        var rel = s.M.Relatorios.Single(r => r.ReinoId == s.Atk.Id && r.Tipo == "ataque");
        var objs = rel.Dados["objetivos"]!.AsArray();
        Assert.Equal("cumprido", objs[0]!["estado"]!.GetValue<string>());   // trouxe tudo o que havia
        Assert.Equal("parcial", objs[1]!["estado"]!.GetValue<string>());    // ficou ferro: a carga encheu
        Assert.Equal("A carga encheu.", rel.Dados["porQueVoltaram"]!.GetValue<string>());
        // a carga chega ao castelo
        s.AvancarAte(ex.Chegada);
        Assert.False(s.M.Marchas.ContemId(ex.Id));
        Assert.True(s.CasteloAtk.Estoque.Qtd("ferro") >= cap - 30);
    }

    [Fact]
    public void Completar_a_carga_leva_o_que_houver()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(), 0);
        alvo.Estoque["ferro"] = 40; alvo.Estoque["couro"] = 20;
        var ex = s.Atacar(alvo, G(("cavalaria", 10)), CombateCenario.Plano("saque", "media", new JsonArray(CombateCenario.Obj("reliquia")), completar: true));
        s.Terminar(s.Chegar(ex));
        Assert.Equal(40, ex.Carga.Qtd("ferro"), 6);
        Assert.Equal(20, ex.Carga.Qtd("couro"), 6);
    }

    [Fact]
    public void Saque_repetido_rende_menos_a_cada_vez_ate_o_minimo()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(), 0);
        var P = s.M.P;
        var levou = new List<double>();
        for (var i = 0; i < 6; i++)
        {
            alvo.Estoque["ferro"] = 100;
            Assert.Equal(Math.Max(P.SaqueMinimo, 1 - P.SaqueQueda * i), Ataques.Rendimento(s.M, Ataques.SaquesRecentes(s.M, s.Atk, alvo.Id)), 9);
            var ex = s.Atacar(alvo, G(("cavalaria", 30)), CombateCenario.Plano("saque", "media", new JsonArray(CombateCenario.Obj("recurso", "ferro", 200))));
            var b = s.Chegar(ex);
            s.Terminar(b);
            levou.Add(ex.Carga.Qtd("ferro"));
            s.AvancarAte(ex.Chegada);
        }
        Assert.Equal(new double[] { 100, 80, 60, 40, 20, 20 }, levou);
        // fora da janela, volta ao rendimento cheio
        s.T.AvancarHoras(P.Combate.SaqueJanelaH + 1);
        Assert.Equal(1, Ataques.Rendimento(s.M, Ataques.SaquesRecentes(s.M, s.Atk, alvo.Id)));
    }

    [Fact]
    public void Saque_leva_a_reliquia_do_local_sem_ocupar_carga()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(), 0);
        alvo.Estoque["ferro"] = 5000;
        var rel = s.M.Reliquias.Adicionar(new Reliquia { Nome = "Lâmina do Rei Antigo", Tipo = "ataque", ReinoId = s.Def.Id, LocalId = alvo.Id });
        var ex = s.Atacar(alvo, G(("cavalaria", 5)), CombateCenario.Plano("saque", "media",
            new JsonArray(CombateCenario.Obj("reliquia"), CombateCenario.Obj("recurso", "ferro", 10000))));
        s.Terminar(s.Chegar(ex));
        Assert.Equal(ex.Id, rel.MarchaId);
        Assert.Contains(rel.Id, ex.Reliquias);
        Assert.Equal(5 * s.M.B.U["cavalaria"].Carga, ex.Carga.Qtd("ferro"), 6);   // a relíquia não ocupou carga
        s.AvancarAte(ex.Chegada);
        Assert.Equal(s.CasteloAtk.Id, rel.LocalId);
        Assert.Equal(s.Atk.Id, rel.ReinoId);
    }

    [Fact]
    public void Ocupacao_toma_o_local_mantem_o_nivel_e_as_reliquias_mudam_de_dono()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 2)), 0, nivel: 5);
        var rel = s.M.Reliquias.Adicionar(new Reliquia { Nome = "Cálice", Tipo = "producao", ReinoId = s.Def.Id, LocalId = alvo.Id });
        var ex = s.Atacar(alvo, G(("arqueiro", 20)), CombateCenario.Plano("ocupacao", "media"));
        s.Terminar(s.Chegar(ex));
        Assert.Equal("vitoria", s.M.Batalhas.Single().Resultado);
        Assert.Equal(s.Atk.Id, alvo.ReinoId);
        Assert.Equal(5, alvo.Nivel);
        Assert.False(s.M.Marchas.ContemId(ex.Id));
        Assert.True(alvo.Guarnicao.GetValueOrDefault("arqueiro") > 0);
        Assert.Equal(alvo.Id, rel.LocalId);
        Assert.Equal(s.Atk.Id, rel.ReinoId);
        Assert.Contains(alvo, s.M.LocaisDe(s.Atk.Id));
        Assert.DoesNotContain(alvo, s.M.LocaisDe(s.Def.Id));
        // acima do castelo do novo dono: não sobe
        Assert.Contains("castelo", Assert.Throws<RegraException>(() => Obras.Melhorar(s.M, s.Atk, alvo.Id)).Message);
    }

    [Fact]
    public void Ruina_sem_dono_e_ocupada_na_chegada_sem_batalha()
    {
        var s = new CombateCenario();
        var ruina = s.M.AdicionarLocal(new Local { ReinoId = 0, Tipo = TipoLocal.Vila, Ruina = true, Nivel = 3, Hex = s.HexLivre(s.CasteloAtk.Hex, 3), Nome = "Ruína" });
        s.Guarnecer(s.CasteloAtk, G(("lanceiro", 3)));
        Assert.Throws<RegraException>(() => Exercitos.Enviar(s.M, s.Atk, s.CasteloAtk.Id, G(("lanceiro", 3)), ruina.Hex, OrdemAtacar.Id, false, CombateCenario.Plano("saque")));
        var ex = Exercitos.Enviar(s.M, s.Atk, s.CasteloAtk.Id, G(("lanceiro", 3)), ruina.Hex, OrdemOcupar.Id, false, new JsonObject());
        s.AvancarAte(ex.Chegada);
        Assert.Empty(s.M.Batalhas);
        Assert.Equal(s.Atk.Id, ruina.ReinoId);
        Assert.False(ruina.Ruina);
        Assert.Equal(3, ruina.Guarnicao["lanceiro"]);
        Assert.Contains(s.M.Relatorios, r => r.ReinoId == s.Atk.Id && r.Tipo == "ataque" && r.Titulo.StartsWith("Ocupação"));
    }

    [Fact]
    public void Sabotagem_derruba_niveis_e_torres_com_arietes()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(), 0, nivel: 3);
        var t = s.Torre(alvo, 1);
        s.M.Reliquias.Adicionar(new Reliquia { Nome = "Pedra", Tipo = "resistencia", ReinoId = s.Def.Id, LocalId = alvo.Id });
        var arietes = (int)Math.Ceiling(s.M.P.Torre.Estrutura / s.M.B.U["ariete"].Cerco) + 6;
        var ex = s.Atacar(alvo, G(("lanceiro", 60), ("ariete", arietes)), CombateCenario.Plano("sabotagem", "media",
            new JsonArray(CombateCenario.Obj("construcao", q: 2), CombateCenario.Obj("torre", q: 1))));
        var b = s.Chegar(ex);
        s.Terminar(b);
        Assert.Equal("vitoria", b.Resultado);
        Assert.Equal(1, alvo.Nivel);
        Assert.False(s.M.Torres.ContemId(t.Id));
        Assert.Empty(ex.Reliquias);   // sabotagem não leva relíquia
        Assert.Equal(s.Def.Id, alvo.ReinoId);
        // sem aríetes, a torre não sofre dano; derrubar o último nível destrói o local
        var s2 = new CombateCenario();
        var a2 = s2.Alvo(TipoLocal.Mina, G(), 0, nivel: 1);
        var t2 = s2.Torre(a2, 1);
        var ex2 = s2.Atacar(a2, G(("lanceiro", 30)), CombateCenario.Plano("sabotagem", "media",
            new JsonArray(CombateCenario.Obj("torre", q: 1), CombateCenario.Obj("construcao", q: 1))));
        s2.Terminar(s2.Chegar(ex2));
        Assert.Equal(t2.Estrutura, Defesas.EstruturaCheia(s2.M, 1));
        Assert.True(a2.Ruina);
        Assert.Equal(0, a2.ReinoId);
    }

    [Fact]
    public void Massacre_mata_populacao_do_local_ate_o_pedido()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(), 40);   // 40 civis lutam como milícia (600 de defesa) contra 30 cavaleiros
        var ex = s.Atacar(alvo, G(("cavalaria", 30)), CombateCenario.Plano("massacre", "media", new JsonArray(CombateCenario.Obj("populacao", q: 10))));
        var b = s.Chegar(ex);
        s.Terminar(b);
        Assert.Equal("vitoria", b.Resultado);
        Assert.Equal(40 - b.MiliciaMorta - 10, s.Def.Pop, 6);
        Assert.Empty(ex.Carga);
        // limitado pela população do local e pelas tropas que sobram (cada tropa mata até P.combate.massacrePorTropa)
        var s2 = new CombateCenario();
        var a2 = s2.Alvo(TipoLocal.Mina, G(), 3);
        var ex2 = s2.Atacar(a2, G(("cavalaria", 2)), CombateCenario.Plano("massacre", "media", new JsonArray(CombateCenario.Obj("populacao", q: 500))));
        s2.Terminar(s2.Chegar(ex2));
        var vivos = GT.Total(ex2.Tropas);
        Assert.Equal(3 - s2.M.Batalhas.Single().MiliciaMorta - Math.Min(3 - s2.M.Batalhas.Single().MiliciaMorta, vivos * s2.M.P.Combate.MassacrePorTropa), s2.Def.Pop, 6);
    }

    [Fact]
    public void Cerco_vitorioso_derruba_portoes_leva_recursos_e_chama_a_queda_do_castelo()
    {
        var s = new CombateCenario();
        var castelo = s.Alvo(TipoLocal.Castelo, G(("lanceiro", 5)), 10);
        castelo.Portoes = 2; castelo.EstruturaPortoes = 2 * s.M.P.PortoesEstrutura;
        castelo.Estoque["madeira"] = 300;
        var arietes = (int)Math.Ceiling(s.M.P.PortoesEstrutura / s.M.B.U["ariete"].Cerco) + 2;
        var ex = s.Atacar(castelo, G(("arqueiro", 30), ("ariete", arietes)), CombateCenario.Plano("cerco", "media",
            new JsonArray(CombateCenario.Obj("portoes", q: 1), CombateCenario.Obj("recurso", "madeira", 100))));
        var b = s.Chegar(ex);
        s.Terminar(b);
        Assert.Equal("vitoria", b.Resultado);
        // os portões caíram um nível (depois a queda do castelo arruína o castelo: ver GuerraTestes)
        var defesa = s.M.Relatorios.Single(r => r.ReinoId == s.Def.Id && r.Tipo == "defesa");
        Assert.Contains("portões −1", defesa.Dados["danos"]!.AsArray().Select(x => x!.GetValue<string>()));
        Assert.Equal(Math.Min(300, ex.CargaMax(s.M)), ex.Carga.Qtd("madeira"), 6);   // sem quantidade: traz até a carga
        Assert.Equal("cerco", PlanoAtaque.Ler(b.Plano).Tipo);
        Assert.Single(AjustesTeste.De(s.M).Fins);
        var q = Assert.Single(AjustesTeste.De(s.M).Quedas);
        Assert.Equal(s.Def.Id, q.perdeu.Id);
        Assert.Equal(castelo.Id, q.castelo.Id);
        Assert.Single(AjustesTeste.De(s.M).Fins);
    }

    [Fact]
    public void Trebuchets_batem_de_longe_mesmo_na_derrota()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 20)), 0);
        var t = s.Torre(alvo, 3);
        var ex = s.Atacar(alvo, G(("trebuchet", 2)), CombateCenario.Plano("sabotagem", "semLimite", new JsonArray(CombateCenario.Obj("torre", q: 1))));
        s.Terminar(s.Chegar(ex));
        Assert.Equal("derrota", s.M.Batalhas.Single().Resultado);
        Assert.Equal(Defesas.EstruturaCheia(s.M, 3) - 2 * s.M.B.U["trebuchet"].Cerco, t.Estrutura, 6);
    }

    // ---------------------------------------------------------------- relatórios

    [Fact]
    public void Relatorio_do_defensor_nomeia_o_atacante()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 5)), 100);
        var ex = s.Atacar(alvo, G(("cavalaria", 20)), CombateCenario.Plano("saque", "media"));
        s.Terminar(s.Chegar(ex));
        var rel = s.M.Relatorios.Single(r => r.ReinoId == s.Def.Id && r.Tipo == "defesa");
        Assert.Equal(s.Atk.Id, rel.Dados["atacante"]!["id"]!.GetValue<long>());
        Assert.Equal(s.Atk.Nome, rel.Dados["atacante"]!["nome"]!.GetValue<string>());
        Assert.Contains(s.Atk.Nome, rel.Dados["resumo"]!.GetValue<string>());
        Assert.Equal(s.M.G.Direcao(alvo.Hex, s.CasteloAtk.Hex), rel.Dados["direcao"]!.GetValue<string>());
        Assert.Equal(20, rel.Dados["tropasVistas"]!["cavalaria"]!.GetValue<int>());
        Assert.Equal("saque", rel.Dados["tipo"]!.GetValue<string>());
        Assert.Contains(s.M.Notificacoes, n => n.ReinoId == s.Def.Id && n.Categoria == "batalhas");
        Assert.Contains(s.M.Notificacoes, n => n.ReinoId == s.Atk.Id && n.Categoria == "batalhas");
    }

    [Fact]
    public void Defensor_e_avisado_quando_o_exercito_entra_na_visao_e_quando_a_batalha_comeca()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(), 100, dist: 6);
        var ex = s.Atacar(alvo, G(("lanceiro", 12)));
        var ev = s.M.Eventos.OfType<AvistamentoAtaqueEvento>().Single(e => e.MarchaId == ex.Id && e.DefensorId == s.Def.Id);
        Assert.True(ev.Quando > ex.Partida && ev.Quando <= ex.Chegada);
        s.AvancarAte(ev.Quando);
        var n = s.M.Notificacoes.Single(x => x.ReinoId == s.Def.Id && x.Categoria == "ataques");
        Assert.Equal("Exército de " + s.Atk.Nome + " à vista", n.Titulo);
        // diz de quem é e por onde anda; nunca o tamanho nem para onde vai
        Assert.DoesNotContain("12", n.Titulo + n.Texto);
        s.AvancarAte(ex.Chegada);
        Assert.Equal(2, s.M.Notificacoes.Count(x => x.ReinoId == s.Def.Id && x.Categoria == "ataques"));
    }

    [Fact]
    public void Segundo_ataque_do_mesmo_reino_se_junta_e_outro_reino_abre_outra_frente()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 30)), 100);
        var e1 = s.Atacar(alvo, G(("arqueiro", 20)));
        var b = s.Chegar(e1);
        var e2 = s.Atacar(alvo, G(("arqueiro", 20)));
        var terceiro = s.T.NovoReino(); terceiro.EscudoAte = 0;
        var ct = s.M.Locais[terceiro.CasteloId];
        s.Guarnecer(ct, G(("cavalaria", 5)));
        var e3 = Exercitos.Enviar(s.M, terceiro, ct.Id, G(("cavalaria", 5)), alvo.Hex, OrdemAtacar.Id, false, CombateCenario.Plano());
        // o segundo ataque muda a duração da batalha (não há tempo fixo): primeiro ele chega, depois se vê se o terceiro alcança
        var antesDoSegundo = b.FimPrevisto;
        s.AvancarAte(e2.Chegada);
        if (e2.Chegada < antesDoSegundo) Assert.Contains(e2.Id, b.Exercitos);
        var fim = b.Encerrada ? s.M.Agora : b.FimPrevisto;
        s.AvancarAte(Math.Max(s.M.Agora, Math.Min(e3.Chegada, fim - 1)));
        if (!b.Encerrada && e3.Chegada < fim) Assert.Contains(s.M.Batalhas, x => x.AtacanteId == terceiro.Id && x.Exercitos.Contains(e3.Id) && x.Id != b.Id);
        s.T.AvancarHoras(3);
        Assert.True(s.M.Batalhas.All(x => x.Encerrada));
    }

    [Fact]
    public void Batalha_em_andamento_e_salva_e_recarregada()
    {
        var dir = Path.Combine(Path.GetTempPath(), "rp-combate-" + Guid.NewGuid().ToString("N"));
        try
        {
            var s = new CombateCenario();
            var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 4)), 3);
            using var db = new ReinoDePedra.Jogo.Persistencia.Banco(Path.Combine(dir, "t.db"));
            var ex = s.Atacar(alvo, G(("arqueiro", 8)));
            var b = s.Chegar(ex);
            db.Salvar(s.M);
            Assert.Equal(0, db.SalvarEsquecidos(s.M));
            var m2 = new Mundo(Balanceamento.Padrao, s.T.Relogio);
            using (var db2 = new ReinoDePedra.Jogo.Persistencia.Banco(Path.Combine(dir, "t.db"))) db2.Carregar(m2);
            m2.PrepararMapa();
            foreach (var e in m2.Eventos) m2.Agenda.Inserir(e);
            var b2 = m2.Batalhas[b.Id];
            Assert.Equal(b.Marcos.Count, b2.Marcos.Count);
            s.T.Relogio.Agora = b.FimPrevisto + 1;
            m2.ProcessarAte(s.T.Relogio.Agora);
            Assert.True(b2.Encerrada);
            Assert.Equal("vitoria", b2.Resultado);
        }
        finally { try { Directory.Delete(dir, true); } catch { } }
    }
}

internal static class CenarioExt
{
    public static Balanceamento B(this CombateCenario s) => s.M.B;
}
