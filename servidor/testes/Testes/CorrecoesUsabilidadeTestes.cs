using System.Text.Json;
using System.Text.Json.Nodes;
using ReinoDePedra.Api;
using ReinoDePedra.Api.Visoes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Mapa;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Valiosos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Testes;

/// <summary>
/// Correções de usabilidade (docs/correcoes-usabilidade.md, itens 10, 11 e 13): toda tropa revela a névoa por onde passa e
/// onde fica, com a visão da unidade; a marcha própria nunca sai da lista do dono; nova ordem parte da posição atual;
/// "mover" para o próprio hexágono é "parar aqui"; o relatório da caça diz o que trouxe.
/// </summary>
public class CorrecoesUsabilidadeTestes
{
    public CorrecoesUsabilidadeTestes() => AjustesTeste.Garantir();

    /// <summary>Liga também os sistemas da API (visões do mapa), como o servidor faz na subida.</summary>
    private static MundoTeste ComApi()
    {
        var t = new MundoTeste();
        foreach (var ty in typeof(Servidor).Assembly.GetTypes().Where(x => x.IsDefined(typeof(SistemaAttribute), false)))
            ty.GetMethod("AoIniciar", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static)?.Invoke(null, [t.M]);
        return t;
    }

    private static Local Castelo(MundoTeste t, Reino r) => t.M.Locais[r.CasteloId];
    private static void AvancarAte(MundoTeste t, long instante) => t.Avancar(TimeSpan.FromMilliseconds(Math.Max(0, instante - t.M.Agora)));
    private static JsonElement J(object o) => JsonSerializer.SerializeToElement(o, Json.Web);
    /// <summary>Campo nulo: o JSON da API omite nulos (Json.Web), então vale ausente ou null.</summary>
    private static bool Nulo(JsonElement o, string nome) => !o.TryGetProperty(nome, out var v) || v.ValueKind == JsonValueKind.Null;

    /// <summary>Hexágono livre, fora do rio e longe da borda, a exatamente <paramref name="dist"/> de <paramref name="de"/>.</summary>
    private static int HexLivre(MundoTeste t, int de, int dist, int pular = 0) =>
        t.M.G.Area(de, dist).Where(h => t.M.G.Distancia(h, de) == dist && !t.M.Mapa.Rio[h] && Obras.HexLivre(t.M, h)
            && t.M.G.C(h) > 2 && t.M.G.L(h) > 2 && t.M.G.C(h) < t.M.G.Cols - 3 && t.M.G.L(h) < t.M.G.Lins - 3).Skip(pular).First();

    private static void Guarnecer(MundoTeste t, Reino r, Local l, string unidade, int n)
    {
        Economia.Atualizar(t.M, r);
        l.Guarnicao[unidade] = l.Guarnicao.GetValueOrDefault(unidade) + n;
        r.Pop -= t.B.U[unidade].Pop * n;
        t.M.Sujar(l); t.M.Sujar(r);
    }

    private static IEnumerable<JsonElement> MarchasMinhas(JsonElement mapa) =>
        mapa.GetProperty("objetos").EnumerateArray().Where(o => o.GetProperty("tipo").GetString() == "marcha" && o.GetProperty("dono").GetString() == "meu");

    // ---------------------------------------------------------------- item 10

    [Fact]
    public void Marcha_de_milicia_revela_o_caminho_ao_vivo_e_nunca_some_da_lista_do_dono()
    {
        var t = ComApi();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        Guarnecer(t, r, c, "milicia", 5);
        var destino = HexLivre(t, c.Hex, 10);
        Assert.False(Nevoas.Explorado(t.M, r.Id, destino));
        var ex = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["milicia"] = 5 }, destino, OrdemMover.Id);
        var caminho = ex.Caminho.ToList();
        Assert.Equal(t.B.U["milicia"].Visao, ex.RaioVisao(t.M));
        // ao entrar em névoa nunca vista, há eventos de revelação antes da chegada (o cliente recebe "mapa" e redesenha a névoa)
        Assert.Contains(t.M.Eventos, ev => ev is RevelarCaminhoEvento rv && rv.MarchaId == ex.Id && rv.Quando < ex.Chegada - 1);

        var meio = (ex.Partida + ex.Chegada) / 2;
        AvancarAte(t, meio);
        // sem ninguém consultar o mapa, os eventos já revelaram o percorrido (com a folga de 1 min entre eventos)
        for (var i = 0; i < caminho.Count && ex.Tempos[i] <= t.M.Agora - T.Min; i++)
            Assert.True(Nevoas.Explorado(t.M, r.Id, caminho[i]), "hexágono " + i + " do caminho ainda na névoa");

        foreach (var q in new[] { meio, ex.Chegada + 1 })
        {
            AvancarAte(t, q);
            var mapa = J(VisaoMapa.Montar(t.M, r));
            var o = Assert.Single(MarchasMinhas(mapa));
            Assert.Equal(ex.Id, o.GetProperty("id").GetInt64());
            var onde = ex.HexEm(t.M.Agora);
            Assert.Equal(onde, o.GetProperty("hex").GetInt32());
            Assert.Equal(0, mapa.GetProperty("idade")[onde].GetInt32());   // onde a tropa está, o reino vê ao vivo
            foreach (var h in caminho.Take(caminho.IndexOf(onde) + 1)) Assert.True(Nevoas.Explorado(t.M, r.Id, h));
            Assert.Contains(Exercitos.De(t.M, r.Id), e => e.Id == ex.Id);
        }
        Assert.True(ex.Parado);
        // parada no destino (em névoa antes): o caminho inteiro e o entorno no raio de visão ficaram revelados
        foreach (var h in caminho) foreach (var x in t.M.G.Area(h, 1)) Assert.True(Nevoas.Explorado(t.M, r.Id, x));
        var mp = Assert.Single(MarchasMinhas(J(VisaoMapa.Montar(t.M, r))));
        Assert.True(mp.GetProperty("parado").GetBoolean());
        Assert.True(Nulo(mp, "chegada"));
        Assert.Equal("parado", mp.GetProperty("estado").GetString());
        var tropas = J(VisaoTropas.Montar(t.M, r));
        Assert.Equal("parado", Assert.Single(tropas.GetProperty("exercitos").EnumerateArray()).GetProperty("estado").GetString());

        // voltando, continua na lista e segue revelando
        ex.Retornar(t.M);
        AvancarAte(t, (t.M.Agora + ex.Chegada) / 2);
        Assert.Single(MarchasMinhas(J(VisaoMapa.Montar(t.M, r))));
        Assert.Equal("retornando", VisaoTropas.Estado(t.M, ex));
        AvancarAte(t, ex.Chegada + 1);
        Assert.DoesNotContain(ex, t.M.Marchas);
        Assert.Equal(5, c.Guarnicao["milicia"]);
    }

    [Fact]
    public void Exercito_enxerga_com_a_maior_visao_do_grupo()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        Guarnecer(t, r, c, "milicia", 4);
        Guarnecer(t, r, c, "arqueiro", 1);
        Assert.Equal(1, GT.Visao(t.M, new Dictionary<string, int> { ["milicia"] = 2 }));
        Assert.Equal(2, GT.Visao(t.M, new Dictionary<string, int> { ["milicia"] = 2, ["arqueiro"] = 1 }));
        Assert.Equal(t.B.P.Visao.Tropa, GT.Visao(t.M, new Dictionary<string, int>()));

        var longe = HexLivre(t, c.Hex, 8);
        var misto = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["milicia"] = 2, ["arqueiro"] = 1 }, longe, OrdemMover.Id);
        Assert.Equal(2, misto.RaioVisao(t.M));
        AvancarAte(t, misto.Chegada + 1);
        foreach (var h in t.M.G.Area(longe, 2)) Assert.True(Nevoas.Explorado(t.M, r.Id, h));

        var outro = HexLivre(t, c.Hex, 8, pular: 6);
        Assert.True(t.M.G.Distancia(outro, longe) > 4);
        var so = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["milicia"] = 2 }, outro, OrdemMover.Id);
        Assert.Equal(1, so.RaioVisao(t.M));
        AvancarAte(t, so.Chegada + 1);
        foreach (var h in t.M.G.Area(outro, 1)) Assert.True(Nevoas.Explorado(t.M, r.Id, h));
        Assert.Contains(t.M.G.Area(outro, 2), h => t.M.G.Distancia(h, outro) == 2 && !Nevoas.Explorado(t.M, r.Id, h));   // a milícia só vê 1
    }

    // ---------------------------------------------------------------- item 13

    [Fact]
    public void Nova_ordem_no_meio_do_caminho_sai_da_posicao_atual_e_mover_para_o_proprio_hexagono_e_parar_aqui()
    {
        var t = ComApi();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        Guarnecer(t, r, c, "lanceiro", 4);
        var a = HexLivre(t, c.Hex, 10);
        var b = HexLivre(t, c.Hex, 10, pular: 8);
        var ex = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 4 }, a, OrdemMover.Id);
        AvancarAte(t, (ex.Partida + ex.Chegada) / 2);
        var onde = ex.HexEm(t.M.Agora);
        Assert.NotEqual(c.Hex, onde);
        Assert.Null(Exercitos.Bloqueio(t.M, ex));

        Exercitos.DarOrdem(t.M, r, ex.Id, OrdemMover.Id, b);
        Assert.Equal(onde, ex.Caminho[0]);          // a rota nova sai de onde as tropas estão
        Assert.Equal(b, ex.Destino);
        Assert.Equal(t.M.Agora, ex.Partida);
        Assert.Contains(Exercitos.De(t.M, r.Id), e => e.Id == ex.Id);
        var v = J(VisaoTropas.Exercito(t.M, ex));
        Assert.True(v.GetProperty("podeOrdem").GetBoolean());
        Assert.True(Nulo(v, "bloqueio"));
        Assert.Equal("marchando", v.GetProperty("estado").GetString());

        t.AvancarMin(1);
        var aqui = ex.HexEm(t.M.Agora);
        ex.Postura = Postura.ApenasDefender;
        Exercitos.DarOrdem(t.M, r, ex.Id, OrdemMover.Id, aqui);   // "parar aqui"
        Assert.True(ex.Parado);
        Assert.Equal(aqui, ex.HexEm(t.M.Agora));
        Assert.Equal(aqui, ex.Destino);
        Assert.Equal(OrdemMover.Id, ex.Ordem);
        Assert.Equal(Postura.AtacarQuemAtacar, ex.Postura);
        Assert.DoesNotContain(t.M.Eventos, ev => ev is ChegadaMarchaEvento ce && ce.MarchaId == ex.Id);
        Assert.Equal("parado", J(VisaoTropas.Exercito(t.M, ex)).GetProperty("estado").GetString());
        t.AvancarHoras(1);
        Assert.Contains(ex, t.M.Marchas);   // ficou lá
        // outra ordem para o próprio hexágono não tem o que fazer
        Assert.Throws<RegraException>(() => Exercitos.DarOrdem(t.M, r, ex.Id, OrdemReforcar.Id, aqui));
        // da parada, uma ordem nova também sai dali
        Exercitos.DarOrdem(t.M, r, ex.Id, OrdemMover.Id, a);
        Assert.Equal(aqui, ex.Caminho[0]);
        Assert.False(ex.Parado);
    }

    // ---------------------------------------------------------------- item 11

    [Fact]
    public void Tropa_cacando_mostra_o_trabalho_e_parar_aqui_interrompe_a_cacada()
    {
        var t = ComApi();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        var alvo = HexLivre(t, c.Hex, 3);
        var rg = Fauna.Adicionar(t.M, new RegiaoFauna { Centro = alvo, Hex = alvo, Raio = 1, Animal = "javalis", Nivel = "baixo", Qtd = 4 });
        Guarnecer(t, r, c, "arqueiro", 10);   // força 300 ≥ 80: ilesos
        var ex = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["arqueiro"] = 10 }, alvo, OrdemCacar.Id);
        var v0 = J(VisaoTropas.Exercito(t.M, ex));
        Assert.True(Nulo(v0, "trabalho"));
        Assert.Equal(0, v0.GetProperty("cargaUsada").GetDouble());
        AvancarAte(t, ex.Chegada + 1);
        Assert.True(rg.Abatido);
        var v = J(VisaoTropas.Exercito(t.M, ex));
        Assert.Equal("trabalhando", v.GetProperty("estado").GetString());
        var tr = v.GetProperty("trabalho");
        Assert.Equal("caca", tr.GetProperty("tipo").GetString());
        Assert.Equal(c.Nome, tr.GetProperty("destino").GetString());
        Assert.True(tr.GetProperty("fim").GetInt64() > t.M.Agora);
        var mp = Assert.Single(MarchasMinhas(J(VisaoMapa.Montar(t.M, r))));
        Assert.Equal("trabalhando", mp.GetProperty("estado").GetString());
        Assert.Equal("cacar", mp.GetProperty("ordem").GetString());
        Assert.Equal(10 * t.B.U["arqueiro"].Carga, mp.GetProperty("cargaMax").GetDouble());

        Exercitos.DarOrdem(t.M, r, ex.Id, OrdemMover.Id, alvo);   // parar aqui: a caçada é interrompida
        Assert.Equal(OrdemMover.Id, ex.Ordem);
        t.AvancarHoras(1);
        Assert.Contains(ex, t.M.Marchas);
        Assert.Equal(0, ex.Carga.Total);
        Assert.DoesNotContain(t.M.Relatorios, x => x.ReinoId == r.Id && x.Tipo == "caca");
    }

    [Fact]
    public void Tropa_extraindo_mostra_o_coletado_e_o_deposito_para_onde_vai()
    {
        var t = ComApi();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        var j = t.M.Jazidas.Adicionar(new Jazida { Hex = HexLivre(t, c.Hex, 3), Recurso = "prata", Inicial = 2000, Restante = 2000 });
        j.DescobertaPor.Add(r.Id);
        Guarnecer(t, r, c, "lanceiro", 5);
        var ex = Extracoes.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 5 }, j.Hex, Extracoes.OrdemExtrair, false, new JsonObject());
        AvancarAte(t, ex.Chegada + 1);
        Assert.Equal(j.Id, ex.ExtraiJazidaId);
        t.AvancarHoras(2);
        var v = J(VisaoTropas.Exercito(t.M, ex));
        Assert.Equal("trabalhando", v.GetProperty("estado").GetString());
        var tr = v.GetProperty("trabalho");
        Assert.Equal("extracao", tr.GetProperty("tipo").GetString());
        Assert.Equal("prata", tr.GetProperty("recurso").GetString());
        Assert.True(tr.GetProperty("coletado").GetProperty("prata").GetInt64() > 0);
        Assert.Equal(c.Nome, tr.GetProperty("destino").GetString());   // sem armazém, leva ao castelo
        Assert.Equal(v.GetProperty("carga").GetProperty("prata").GetInt64(), tr.GetProperty("coletado").GetProperty("prata").GetInt64());
        Assert.True(v.GetProperty("cargaUsada").GetDouble() > 0 && v.GetProperty("cargaUsada").GetDouble() <= v.GetProperty("cargaMax").GetDouble());
        var mp = Assert.Single(MarchasMinhas(J(VisaoMapa.Montar(t.M, r))));
        Assert.Equal("trabalhando", mp.GetProperty("estado").GetString());
        Assert.Equal(mp.GetProperty("cargaUsada").GetDouble(), v.GetProperty("cargaUsada").GetDouble());
    }

    [Fact]
    public void Relatorio_da_caca_diz_o_que_trouxe_ou_por_que_nao_trouxe_nada()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        var alvo = HexLivre(t, c.Hex, 3);
        Fauna.Adicionar(t.M, new RegiaoFauna { Centro = alvo, Hex = alvo, Raio = 1, Animal = "javalis", Nivel = "baixo", Qtd = 4 });
        Guarnecer(t, r, c, "arqueiro", 11);
        var ex = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["arqueiro"] = 10 }, alvo, OrdemCacar.Id);
        AvancarAte(t, ex.Chegada + 1);
        t.AvancarHoras(1);
        var ok = Assert.Single(t.M.Relatorios, x => x.ReinoId == r.Id && x.Tipo == "caca");
        Assert.Contains("traz " + t.B.P.Caca["javalis"].Comida + " comida", ok.Dados["resumo"]!.GetValue<string>());
        // sem presa: o bando acabou de ser abatido
        var alvo2 = HexLivre(t, c.Hex, 3, pular: 3);
        var rg2 = Fauna.Adicionar(t.M, new RegiaoFauna { Centro = alvo2, Hex = alvo2, Raio = 1, Animal = "javalis", Nivel = "baixo", Qtd = 4 });
        t.AvancarHoras(2);
        var ex2 = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["arqueiro"] = 1 }, alvo2, OrdemCacar.Id);
        Fauna.Abater(t.M, rg2);
        AvancarAte(t, ex2.Chegada + 1);
        var sem = Assert.Single(t.M.Relatorios, x => x.ReinoId == r.Id && x.Titulo == "Caçada sem presa");
        Assert.Contains("Não trouxeram nada", sem.Dados["resumo"]!.GetValue<string>());
        Assert.Contains("nada (o bando sumiu)", sem.Dados["linhas"]!.ToJsonString());
        // perdida: ninguém sobra
        t.AvancarHoras(t.B.P.FaunaVoltaH + 1);
        t.AvancarHoras(1);
        Assert.False(rg2.Abatido);
        var ex3 = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["arqueiro"] = 1 }, alvo2, OrdemCacar.Id);
        AvancarAte(t, ex3.Chegada + 1);
        var perdida = Assert.Single(t.M.Relatorios, x => x.ReinoId == r.Id && x.Titulo == "Caçada perdida");
        Assert.Contains("nada foi trazido", perdida.Dados["resumo"]!.GetValue<string>());
        Assert.Contains("o grupo perdeu a luta", perdida.Dados["linhas"]!.ToJsonString());
    }
}
