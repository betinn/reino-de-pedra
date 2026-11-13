using System.Text.Json;
using ReinoDePedra.Api.Visoes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.IA;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Testes;

/// <summary>
/// Alianças com menos atrito e conversa com vida: aliança aberta, liderança passada, indicação, eventos na conversa,
/// menções, ponto do mapa, recado fixado, não lidas, pedido de reforço e resposta no próprio aviso. E a IA na aliança,
/// como gente: entra, recusa, convida, ajuda e conversa conforme a persona, sem desespero.
/// </summary>
[Collection("falas")]
public class AliancaVivaTestes
{
    private static Dictionary<string, int> G(params (string k, int n)[] x) => x.ToDictionary(p => p.k, p => p.n);
    private static JsonElement J(object o) => JsonSerializer.SerializeToElement(o, ReinoDePedra.Api.Json.Web);
    private static List<JsonElement> Conversa(MundoTeste t, Reino r) => J(VisaoSocial.Alianca(t.M, r)).GetProperty("alianca").GetProperty("conversa").EnumerateArray().ToList();
    private static bool Sem(JsonElement e, string k) => !e.TryGetProperty(k, out var v) || v.ValueKind == JsonValueKind.Null;
    private static Alianca Com(MundoTeste t, Reino lider, params Reino[] outros)
    {
        var a = Aliancas.Criar(t.M, lider, "Liga " + lider.Id);
        foreach (var o in outros) { Aliancas.Convidar(t.M, lider, o.Id); Aliancas.AceitarConvite(t.M, o, a.Id); }
        return a;
    }
    private static Reino IA(MundoTeste t, string perfil, Action<Persona> ajuste)
    {
        var r = MundoIA.Criar(t, perfil);
        var p = Personas.Gerar(4242, perfil, "medio");
        p.Disciplina = 1; p.Assiduidade = 1; p.Reflexo = 0;
        ajuste(p);
        r.Persona = p; t.M.Sujar(r);
        return r;
    }
    private static void Sessao(MundoTeste t, Reino ia) => Governo.Sessao(t.M, ia, MundoIA.Conduta(t, ia));

    // ---------------------------------------------------------------- criar e entrar

    [Fact]
    public void Alianca_aberta_entra_na_hora_e_por_convite_espera_resposta()
    {
        var t = new MundoTeste();
        var (lider, b, c) = (t.NovoReino(), t.NovoReino(), t.NovoReino());
        var a = Aliancas.Criar(t.M, lider, "Liga do Vale");
        Assert.False(a.Aberta);
        Assert.NotNull(Aliancas.PedirEntrada(t.M, b, a.Id));           // por convite: fica o pedido
        Assert.Null(b.AliancaId);
        Assert.Throws<RegraException>(() => Aliancas.DefinirModo(t.M, b, true));
        Aliancas.DefinirModo(t.M, lider, true);
        Assert.Null(Aliancas.PedirEntrada(t.M, c, a.Id));              // aberta: entrou
        Assert.Equal(a.Id, c.AliancaId);
        Assert.Contains(a.Conversa, f => f.Evento == "modo");
        Assert.Contains(a.Conversa, f => f.Evento == "entrou" && f.ReinoId == c.Id);
        // quem foi expulso não volta pela porta aberta durante a trégua
        Aliancas.Expulsar(t.M, lider, c.Id);
        c.AliancaLivreEm = 0;
        Assert.Throws<RegraException>(() => Aliancas.PedirEntrada(t.M, c, a.Id));
        // a aliança pode nascer aberta, e o mapa das alianças diz qual é qual
        var d = t.NovoReino();
        var outra = Aliancas.Criar(t.M, d, "Porta Aberta", null, aberta: true);
        var vista = J(VisaoSocial.Alianca(t.M, c)).GetProperty("aliancas").EnumerateArray().ToList();
        Assert.True(vista.Single(x => x.GetProperty("id").GetInt64() == outra.Id).GetProperty("aberta").GetBoolean());
        Assert.True(vista.Single(x => x.GetProperty("id").GetInt64() == a.Id).GetProperty("aberta").GetBoolean());
    }

    [Fact]
    public void Convite_e_pedido_de_entrada_se_respondem_no_proprio_aviso()
    {
        var t = new MundoTeste();
        var (lider, b, c) = (t.NovoReino(), t.NovoReino(), t.NovoReino());
        var a = Aliancas.Criar(t.M, lider, "Liga do Vale");
        Aliancas.Convidar(t.M, lider, b.Id);
        var convite = t.M.Notificacoes.Single(n => n.ReinoId == b.Id && n.Categoria == "alianca");
        Assert.Equal("convite-alianca", convite.Acao!["tipo"]!.GetValue<string>());
        Assert.Equal(a.Id, convite.Acao["id"]!.GetValue<long>());
        Aliancas.PedirEntrada(t.M, c, a.Id);
        var pedido = t.M.Notificacoes.Single(n => n.ReinoId == lider.Id && n.Titulo.Contains("pede para entrar"));
        Assert.Equal("pedido-entrada", pedido.Acao!["tipo"]!.GetValue<string>());
        Assert.Equal(c.Id, pedido.Acao["id"]!.GetValue<long>());
        // e na conversa o pedido aparece com o botão para quem pode aceitar
        Assert.Equal(c.Id, Conversa(t, lider).Single(f => f.GetProperty("evento").GetString() == "pedido-entrada").GetProperty("aceitar").GetInt64());
    }

    [Fact]
    public void Lider_passa_a_lideranca_e_vira_conselheiro()
    {
        var t = new MundoTeste();
        var rs = Enumerable.Range(0, 3).Select(_ => t.NovoReino()).ToList();
        var a = Com(t, rs[0], rs[1], rs[2]);
        Assert.Throws<RegraException>(() => Aliancas.PassarLideranca(t.M, rs[1], rs[2].Id));   // só o líder
        Assert.Throws<RegraException>(() => Aliancas.PassarLideranca(t.M, rs[0], rs[0].Id));   // a outro
        Aliancas.PassarLideranca(t.M, rs[0], rs[2].Id);
        Assert.Equal(Aliancas.Lider, a.Membro(rs[2].Id)!.Cargo);
        Assert.Equal(Aliancas.Conselheiro, a.Membro(rs[0].Id)!.Cargo);
        Assert.Single(a.Membros, x => x.Cargo == Aliancas.Lider);
        Assert.Contains(a.Conversa, f => f.Evento == "lider" && f.AlvoId == rs[2].Id);
        Assert.Contains(t.M.Notificacoes, n => n.ReinoId == rs[2].Id && n.Titulo.StartsWith("Você agora lidera"));
    }

    [Fact]
    public void Membro_comum_indica_e_quem_pode_convida_na_propria_linha()
    {
        var t = new MundoTeste();
        var rs = Enumerable.Range(0, 3).Select(_ => t.NovoReino()).ToList();
        var a = Com(t, rs[0], rs[1]);
        var novo = rs[2];
        Aliancas.Indicar(t.M, rs[1], novo.Id);
        Assert.Throws<RegraException>(() => Aliancas.Indicar(t.M, rs[1], novo.Id));   // já indicado há pouco
        Assert.Throws<RegraException>(() => Aliancas.Indicar(t.M, rs[1], rs[0].Id));  // já é da aliança
        // o líder vê o botão de convidar; o membro, não
        Assert.Equal(novo.Id, Conversa(t, rs[0]).Single(f => f.GetProperty("evento").GetString() == "indicacao").GetProperty("convidar").GetInt64());
        Assert.True(Sem(Conversa(t, rs[1]).Single(f => f.GetProperty("evento").GetString() == "indicacao"), "convidar"));
        Aliancas.Convidar(t.M, rs[0], novo.Id);
        Assert.True(Sem(Conversa(t, rs[0]).Single(f => f.GetProperty("evento").GetString() == "indicacao"), "convidar"));
        Assert.NotNull(a);
    }

    // ---------------------------------------------------------------- conversa

    [Fact]
    public void Mencao_avisa_o_mencionado_e_todos_e_so_para_lider_e_conselheiros()
    {
        var t = new MundoTeste();
        var rs = new[] { t.NovoReino("Pedralva"), t.NovoReino("Vale"), t.NovoReino("Vale Frio") };
        var a = Com(t, rs[0], rs[1], rs[2]);
        t.M.Notificacoes.ToList().ForEach(n => t.M.Notificacoes.Remover(n.Id));
        var f = Aliancas.Falar(t.M, rs[0], "@Vale Frio consegue mandar pedra?");
        // o nome mais longo ganha: "@Vale Frio" menciona Vale Frio (e Vale também está contido: os dois são avisados)
        Assert.Contains(rs[2].Id, f.Mencoes);
        var n = Assert.Single(t.M.Notificacoes, x => x.ReinoId == rs[2].Id);
        Assert.Equal("alianca", n.Categoria);   // a menção não usa a categoria da conversa, que pode estar silenciada
        Assert.Equal("Pedralva mencionou você", n.Titulo);
        Assert.True(Conversa(t, rs[2]).Last().GetProperty("mencionaVoce").GetBoolean());
        Assert.False(Conversa(t, rs[0]).Last().GetProperty("mencionaVoce").GetBoolean());
        // @todos: só líder e conselheiros
        Assert.Throws<RegraException>(() => Aliancas.Falar(t.M, rs[1], "@todos ataque amanhã"));
        t.M.Notificacoes.ToList().ForEach(x => t.M.Notificacoes.Remover(x.Id));
        var todos = Aliancas.Falar(t.M, rs[0], "@todos reunião na conversa");
        Assert.True(todos.Todos);
        Assert.Equal(2, t.M.Notificacoes.Count(x => x.Titulo == "Pedralva chamou a aliança"));
        Assert.DoesNotContain(t.M.Notificacoes, x => x.ReinoId == rs[0].Id);
        Assert.NotNull(a);
    }

    [Fact]
    public void Fala_nova_nao_vira_notificacao_e_a_categoria_da_conversa_existe_para_silenciar()
    {
        var t = new MundoTeste();
        var (x, y) = (t.NovoReino(), t.NovoReino());
        Com(t, x, y);
        var antes = t.M.Notificacoes.Count;
        Aliancas.Falar(t.M, x, "bom dia");
        Assert.Equal(antes, t.M.Notificacoes.Count);   // fala comum não enche a lista de notificações: é aviso pequeno, ao vivo
        Assert.Contains(Aliancas.CategoriaConversa, Registros.Categorias.Keys);
        Assert.Equal(TamanhoAviso.Pequeno, TamanhoAviso.DaCategoria(Aliancas.CategoriaConversa));
    }

    [Fact]
    public void Nao_lidas_contam_o_que_os_outros_disseram_e_zeram_ao_abrir()
    {
        var t = new MundoTeste();
        var (x, y) = (t.NovoReino(), t.NovoReino());
        var a = Com(t, x, y);
        Aliancas.MarcarLida(t.M, x); Aliancas.MarcarLida(t.M, y);
        Aliancas.Falar(t.M, x, "um"); Aliancas.Falar(t.M, x, "dois");
        Assert.Equal(0, Aliancas.NaoLidas(a, x.Id));   // as próprias não contam
        Assert.Equal(2, Aliancas.NaoLidas(a, y.Id));
        Assert.Equal(2, J(VisaoSocial.Alianca(t.M, y)).GetProperty("alianca").GetProperty("naoLidas").GetInt32());
        Aliancas.MarcarLida(t.M, y);
        Assert.Equal(0, Aliancas.NaoLidas(a, y.Id));
        // quem entra não recebe a conversa antiga como não lida
        var z = t.NovoReino();
        Aliancas.Convidar(t.M, x, z.Id); Aliancas.AceitarConvite(t.M, z, a.Id);
        Assert.InRange(Aliancas.NaoLidas(a, z.Id), 0, 1);   // no máximo a própria entrada
    }

    [Fact]
    public void Mostrar_a_alianca_leva_um_ponto_do_mapa_e_recado_fixado_e_do_lider()
    {
        var t = new MundoTeste();
        var (x, y) = (t.NovoReino(), t.NovoReino());
        var a = Com(t, x, y);
        var hex = t.M.Locais[x.CasteloId].Hex + 3;
        var f = Aliancas.Falar(t.M, y, "jazida aqui", hex);
        Assert.Equal(hex, f.Hex);
        Assert.Equal(hex, Conversa(t, x).Last().GetProperty("hex").GetInt32());
        Assert.Equal(hex, Aliancas.Falar(t.M, y, "", hex).Hex);   // só o ponto: o jogo põe uma frase
        Assert.Throws<RegraException>(() => Aliancas.Falar(t.M, y, "fora do mapa", -5));
        Assert.Throws<RegraException>(() => Aliancas.Falar(t.M, y, "fora do mapa", t.M.G.Cols * t.M.G.Lins));
        // recado fixado
        Assert.Throws<RegraException>(() => Aliancas.Fixar(t.M, y, "meu recado"));
        Assert.Throws<RegraException>(() => Aliancas.Fixar(t.M, x, new string('a', t.M.P.Social.Conversa.Recado + 1)));
        Aliancas.Fixar(t.M, x, "Esta semana: torres no vale.");
        Assert.Equal("Esta semana: torres no vale.", J(VisaoSocial.Alianca(t.M, y)).GetProperty("alianca").GetProperty("recado").GetProperty("texto").GetString());
        Aliancas.Fixar(t.M, x, "");
        Assert.True(Sem(J(VisaoSocial.Alianca(t.M, y)).GetProperty("alianca"), "recado"));
        Assert.NotNull(a);
    }

    [Fact]
    public void Conversa_guarda_as_ultimas_200_linhas()
    {
        var t = new MundoTeste();
        var (x, y) = (t.NovoReino(), t.NovoReino());
        var a = Com(t, x, y);
        Assert.Equal(200, t.M.P.Social.Conversa.Guardar);
        for (var i = 0; i < 230; i++) Aliancas.Falar(t.M, i % 2 == 0 ? x : y, "linha " + i);
        Assert.Equal(200, a.Conversa.Count);
        Assert.Equal("linha 229", a.Conversa[^1].Texto);
    }

    [Fact]
    public void Pedido_de_reforco_vira_linha_com_o_local_e_nao_se_repete_em_seguida()
    {
        var t = new MundoTeste();
        var (x, y) = (t.NovoReino(), t.NovoReino());
        Com(t, x, y);
        var castelo = t.M.Locais[x.CasteloId];
        var f = Aliancas.PedirReforco(t.M, x, castelo.Id);
        Assert.Equal("pedido-reforco", f.Evento); Assert.Equal(castelo.Hex, f.Hex); Assert.Equal(castelo.Id, f.LocalId);
        Assert.Throws<RegraException>(() => Aliancas.PedirReforco(t.M, x, castelo.Id));          // já pediu há pouco
        Assert.Throws<RegraException>(() => Aliancas.PedirReforco(t.M, x, t.M.Locais[y.CasteloId].Id));   // só local seu
        // o outro membro vê o botão de reforçar; quem pediu, não
        Assert.True(Conversa(t, y).Last().GetProperty("reforcar").GetBoolean());
        Assert.False(Conversa(t, x).Last().GetProperty("reforcar").GetBoolean());
        t.AvancarMin(t.M.P.Social.Conversa.RepetirPedidoSeg / 60 + 1);
        Aliancas.PedirReforco(t.M, x, castelo.Id);
    }

    [Fact]
    public void O_jogo_escreve_na_conversa_o_que_acontece_com_os_membros()
    {
        var s = new CombateCenario();
        var t = s.T;
        var amigo = t.NovoReino(); amigo.EscudoAte = 0;
        var a = Com(t, s.Def, amigo);
        Assert.Contains(a.Conversa, f => f.Evento == "fundou");
        Assert.Contains(a.Conversa, f => f.Evento == "convite" && f.AlvoId == amigo.Id);
        Assert.Contains(a.Conversa, f => f.Evento == "entrou" && f.ReinoId == amigo.Id);
        // um membro é atacado: a linha leva o local (clicar centra o mapa) e, depois, o resultado
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 10)), 0);
        var b = s.Chegar(s.Atacar(alvo, G(("lanceiro", 4))));
        var ataque = Assert.Single(a.Conversa, f => f.Evento == "ataque");
        Assert.Equal(alvo.Hex, ataque.Hex); Assert.Equal(s.Def.Id, ataque.ReinoId);
        Assert.Contains(alvo.Nome, ataque.Texto); Assert.Contains(s.Atk.Nome, ataque.Texto);
        s.AvancarAte(b.FimPrevisto + 1000);
        var fim = Assert.Single(a.Conversa, f => f.Evento == "vitoria");
        Assert.DoesNotContain(a.Conversa, f => f.Evento == "ataque");   // o resultado toma o lugar do "está sob ataque"
        Assert.Equal(s.Def.Id, fim.ReinoId);
        // pedido de recursos: aparece para todos; só quem recebeu responde na linha
        t.DarRecursos(amigo, 5000, "pedra");
        var p = Comercio.PedirRecursos(t.M, s.Def, amigo.Id, new Dictionary<string, double> { ["pedra"] = 50 }, alvo.Id, null);
        Assert.Equal(p.Id, Conversa(t, amigo).Single(f => f.GetProperty("evento").GetString() == "pedido-recursos").GetProperty("propostaId").GetInt64());
        Assert.True(Sem(Conversa(t, s.Def).Single(f => f.GetProperty("evento").GetString() == "pedido-recursos"), "propostaId"));
        Comercio.AceitarPedido(t.M, amigo, p.Id);
        Assert.Contains(a.Conversa, f => f.Evento == "ajuda" && f.ReinoId == amigo.Id && f.AlvoId == s.Def.Id);
        Assert.True(Sem(Conversa(t, amigo).Single(f => f.GetProperty("evento").GetString() == "pedido-recursos"), "propostaId"));
        // quem sai também fica registrado
        Aliancas.Sair(t.M, amigo);
        Assert.Contains(a.Conversa, f => f.Evento == "saiu" && f.ReinoId == amigo.Id);
        // nada disso fala de tamanho de força
        Assert.All(a.Conversa, f => Assert.DoesNotContain("lanceiro", f.Texto));
    }

    // ---------------------------------------------------------------- a IA na aliança

    [Fact]
    public void IA_sociavel_aceita_o_convite_de_um_jogador_e_cumprimenta_a_calada_e_a_rancorosa_recusam()
    {
        var t = MundoIA.Novo(criar: false);
        var j = MundoIA.Jogador(t, 0);
        var a = Aliancas.Criar(t.M, j, "Liga do Vale");
        var sociavel = IA(t, "comerciante", p => { p.Sociabilidade = 0.95; p.Orgulho = 0.3; });
        var calada = IA(t, "defensivo", p => { p.Sociabilidade = 0.05; p.Orgulho = 0.8; });
        var rancorosa = IA(t, "saqueador", p => { p.Sociabilidade = 0.9; p.Rancor = 0.9; });
        rancorosa.Persona!.Rancores[j.Id] = 0.7;
        foreach (var ia in new[] { sociavel, calada, rancorosa }) Aliancas.Convidar(t.M, j, ia.Id);
        foreach (var ia in new[] { sociavel, calada, rancorosa }) Sessao(t, ia);
        Assert.Equal(a.Id, sociavel.AliancaId);
        Assert.Null(calada.AliancaId); Assert.Null(rancorosa.AliancaId);
        Assert.DoesNotContain(a.Convites, c => c.ReinoId == calada.Id || c.ReinoId == rancorosa.Id);   // recusaram, não deixaram no ar
        // na sessão seguinte, a que entrou cumprimenta na conversa (pelo ponto único de fala)
        t.AvancarHoras(1);
        Sessao(t, sociavel);
        var fala = Assert.Single(a.Conversa, f => f.Tipo == Aliancas.TipoFala && f.ReinoId == sociavel.Id);
        Assert.InRange(fala.Texto.Length, 2, t.M.P.Social.Conversa.Caracteres);
        // e não repete o cumprimento
        t.AvancarHoras(1); Sessao(t, sociavel);
        Assert.Single(a.Conversa, f => f.Tipo == Aliancas.TipoFala && f.ReinoId == sociavel.Id && f.Id == fala.Id);
    }

    [Fact]
    public void IA_com_tempo_de_reacao_pensa_antes_de_responder_ao_convite()
    {
        var t = MundoIA.Novo(criar: false);
        var j = MundoIA.Jogador(t, 0);
        var a = Aliancas.Criar(t.M, j, "Liga do Vale");
        var ia = IA(t, "comerciante", p => { p.Sociabilidade = 0.95; p.Orgulho = 0.3; p.Reflexo = 1.5; });
        Aliancas.Convidar(t.M, j, ia.Id);
        Sessao(t, ia);   // o convite acabou de chegar: ainda não decidiu
        Assert.Null(ia.AliancaId);
        Assert.Contains(a.Convites, c => c.ReinoId == ia.Id);
        t.AvancarHoras(2);
        Sessao(t, ia);
        Assert.Equal(a.Id, ia.AliancaId);
    }

    [Fact]
    public void IA_nao_e_desesperada_fala_pouco_e_a_calada_nunca_pede_para_entrar()
    {
        var t = MundoIA.Novo(criar: false);
        var j = MundoIA.Jogador(t, 0);
        var a = Aliancas.Criar(t.M, j, "Porta Aberta", null, aberta: true);
        var calada = IA(t, "defensivo", p => { p.Sociabilidade = 0.2; p.Orgulho = 0.3; });
        var sociavel = IA(t, "comerciante", p => { p.Sociabilidade = 0.95; p.Orgulho = 0.2; });
        // as duas são vizinhas do jogador (a IA nasce longe dos jogadores; aliança é coisa de vizinho)
        var perto = t.M.Locais[j.CasteloId].Hex;
        foreach (var (ia, d) in new[] { (calada, 40), (sociavel, 50) }) { var c0 = t.M.Locais[ia.CasteloId]; c0.Hex = t.M.G.Area(perto, d).First(h => t.M.G.Distancia(h, perto) == d); t.M.Sujar(c0); }
        var pedidos = 0;
        for (var dia = 0; dia < 14; dia++)
            for (var s = 0; s < 4; s++)
            {
                // a entrada pode vir na sessão agendada da própria IA (dentro do avanço do relógio) ou na chamada aqui
                var antes = sociavel.AliancaId;
                t.AvancarHoras(6);
                Sessao(t, calada); Sessao(t, sociavel);
                if (antes == null && sociavel.AliancaId != null) pedidos++;
            }
        Assert.Null(calada.AliancaId);                 // 14 dias com a porta aberta ao lado: quem é calada não vem
        Assert.Equal(a.Id, sociavel.AliancaId);        // a sociável acaba entrando
        Assert.Equal(1, pedidos);
        // e não na primeira sessão: levou pelo menos um dia de jogo
        var entrada = a.Conversa.First(f => f.Evento == "entrou" && f.ReinoId == sociavel.Id);
        Assert.True(entrada.Quando - sociavel.CriadoEm >= T.Dia);
        // em 14 dias (56 sessões), ela disse poucas coisas: nunca mais de duas por sessão, e longe de uma por sessão
        var falas = a.Conversa.Where(f => f.Tipo == Aliancas.TipoFala && f.ReinoId == sociavel.Id).ToList();
        Assert.InRange(falas.Count, 1, 25);
        Assert.All(falas.GroupBy(f => f.Quando), g => Assert.True(g.Count() <= ConvivioAlianca.FalasPorSessao));
    }

    [Fact]
    public void IA_leal_manda_reforco_ao_aliado_atacado_e_a_que_nao_e_leal_fica_em_casa()
    {
        (CombateCenario s, Reino ia, Batalha b) Cenario(Action<Persona> ajuste)
        {
            var s = new CombateCenario();
            s.M.IA.Ativa = true; SistemaIA.AoIniciar(s.M);
            var ia = MundoIA.Criar(s.T, "defensivo");
            var p = Personas.Gerar(77, "defensivo", "medio"); p.Disciplina = 1; p.Assiduidade = 1; p.Reflexo = 0; ajuste(p);
            ia.Persona = p; ia.EscudoAte = 0;
            var a = Aliancas.Criar(s.M, s.Def, "Liga do Vale");
            Aliancas.Convidar(s.M, s.Def, ia.Id); Aliancas.AceitarConvite(s.M, ia, a.Id);
            Aliancas.MarcarLida(s.M, ia); ia.Persona.FalouEm["saudacao:" + a.Id] = s.M.Agora;
            // a IA mora ao lado do local atacado, com tropas livres
            var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 30)), 0, dist: 6);
            var casteloIA = s.M.Locais[ia.CasteloId];
            casteloIA.Hex = s.HexLivre(alvo.Hex, 5, 3); s.M.Sujar(casteloIA);
            casteloIA.Guarnicao["cavalaria"] = 20; s.M.Sujar(casteloIA);
            ReinoDePedra.Jogo.Pessoas.Pessoas.Sincronizar(s.M, casteloIA);
            var b = s.Chegar(s.Atacar(alvo, G(("lanceiro", 30))));
            Governo.Sessao(s.M, ia, MundoIA.Conduta(s.T, ia));
            return (s, ia, b);
        }
        var (s1, leal, _) = Cenario(p => { p.Lealdade = 0.95; p.Sociabilidade = 1; p.Passividade = 0.2; p.Cautela = 0.3; });
        var reforco = Assert.Single(s1.M.Marchas.OfType<Exercito>(), e => e.ReinoId == leal.Id && e.Ordem == OrdemReforcar.Id);
        Assert.True(GT(reforco) >= 1);
        // e avisa na conversa que mandou
        Assert.Contains(Aliancas.De(s1.M, leal)!.Conversa, f => f.Tipo == Aliancas.TipoFala && f.ReinoId == leal.Id);
        var (s2, desleal, _) = Cenario(p => { p.Lealdade = 0.05; p.Passividade = 0.9; p.Sociabilidade = 0; });
        Assert.DoesNotContain(s2.M.Marchas.OfType<Exercito>(), e => e.ReinoId == desleal.Id && e.Ordem == OrdemReforcar.Id);
    }
    private static int GT(Exercito e) => e.Tropas.Values.Sum();

    [Fact]
    public void IA_leal_atende_pedido_de_recursos_e_a_gananciosa_segura()
    {
        var t = MundoIA.Novo(criar: false);
        var j = MundoIA.Jogador(t, 0);
        var a = Aliancas.Criar(t.M, j, "Liga do Vale");
        var leal = IA(t, "defensivo", p => { p.Lealdade = 0.9; p.Ganancia = 0.3; p.Sociabilidade = 1; });
        var gananciosa = IA(t, "comerciante", p => { p.Lealdade = 0.1; p.Ganancia = 0.95; p.Sociabilidade = 0; });
        foreach (var ia in new[] { leal, gananciosa })
        {
            Aliancas.Convidar(t.M, j, ia.Id); Aliancas.AceitarConvite(t.M, ia, a.Id);
            t.DarRecursos(ia, 5000, "pedra");
            ia.EscudoAte = 0;
        }
        j.EscudoAte = 0;
        var p1 = Comercio.PedirRecursos(t.M, j, leal.Id, new Dictionary<string, double> { ["pedra"] = 100 }, null, null);
        var p2 = Comercio.PedirRecursos(t.M, j, gananciosa.Id, new Dictionary<string, double> { ["pedra"] = 100 }, null, null);
        Assert.Equal(Comercio.Aberta, p1.Estado);   // não responde na hora: só na sessão
        Sessao(t, leal); Sessao(t, gananciosa);
        Assert.Equal(Comercio.Aceita, p1.Estado);
        Assert.Equal(Comercio.Recusada, p2.Estado);
        Assert.Contains(a.Conversa, f => f.Evento == "ajuda" && f.ReinoId == leal.Id);
    }

    [Fact]
    public void IA_responde_a_mencao_na_sessao_dela()
    {
        var t = MundoIA.Novo(criar: false);
        var j = MundoIA.Jogador(t, 0);
        var a = Aliancas.Criar(t.M, j, "Liga do Vale");
        var ia = IA(t, "comerciante", p => { p.Sociabilidade = 1; });
        Aliancas.Convidar(t.M, j, ia.Id); Aliancas.AceitarConvite(t.M, ia, a.Id);
        ia.Persona!.FalouEm["saudacao:" + a.Id] = t.M.Agora; Aliancas.MarcarLida(t.M, ia);
        Aliancas.Falar(t.M, j, "@" + ia.Nome + " está por aí?");
        Assert.DoesNotContain(a.Conversa, f => f.Tipo == Aliancas.TipoFala && f.ReinoId == ia.Id);   // não na hora
        Sessao(t, ia);
        var resposta = Assert.Single(a.Conversa, f => f.Tipo == Aliancas.TipoFala && f.ReinoId == ia.Id);
        Assert.Empty(resposta.Mencoes);   // a fala dela não menciona por acidente
        Assert.Equal(0, Aliancas.NaoLidas(a, ia.Id));
    }

    [Fact]
    public void IA_lider_aceita_pedido_de_entrada_de_quem_nao_lhe_fez_mal_e_recusa_o_desafeto()
    {
        var t = MundoIA.Novo(criar: false);
        var lider = IA(t, "comerciante", p => { p.Sociabilidade = 0.8; p.Cautela = 0.4; });
        var a = Aliancas.Criar(t.M, lider, "Liga do Vale");
        var (bom, mau) = (MundoIA.Jogador(t, 0), MundoIA.Jogador(t, 1));
        lider.Persona!.Rancores[mau.Id] = 0.8;
        Aliancas.PedirEntrada(t.M, bom, a.Id); Aliancas.PedirEntrada(t.M, mau, a.Id);
        Sessao(t, lider);
        Assert.Equal(a.Id, bom.AliancaId);
        Assert.Null(mau.AliancaId);
        Assert.Empty(a.Pedidos);
    }

    [Fact]
    public void Mundo_com_IA_forma_algumas_aliancas_sem_virar_regra_e_sem_erro()
    {
        var t = MundoIA.Novo();
        for (var d = 0; d < 12; d++) { t.AvancarHoras(24); AjustesTeste.FalharSeErro(); }
        var ias = Ocupacao.DeIA(t.M).ToList();
        var emAlianca = ias.Count(r => r.AliancaId != null);
        // há gente que se junta e gente que fica sozinha
        Assert.True(emAlianca < ias.Count, "todo mundo em aliança seria desespero");
        Assert.All(t.M.Aliancas, a => Assert.InRange(a.Membros.Count, 1, t.M.P.Alianca));
        // ninguém fala sem parar: no máximo duas falas por sessão, por reino
        foreach (var a in t.M.Aliancas)
            Assert.All(a.Conversa.Where(f => f.Tipo == Aliancas.TipoFala).GroupBy(f => (f.ReinoId, f.Quando)), g => Assert.True(g.Count() <= ConvivioAlianca.FalasPorSessao));
        // nomes de aliança válidos
        Assert.All(t.M.Aliancas, a => Assert.InRange(a.Nome.Length, t.M.P.Social.NomeAlianca.Min, t.M.P.Social.NomeAlianca.Max));
    }
}
