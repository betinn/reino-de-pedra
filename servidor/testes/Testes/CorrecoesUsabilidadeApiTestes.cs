using System.Net;
using System.Text.Json;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Pessoas;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Testes;

/// <summary>
/// Correções de usabilidade pela API (docs/correcoes-usabilidade.md, itens 9, 11, 12 e 13): carga e estado da marcha própria no
/// mapa e em /tropas, ordem no meio do caminho e "parar aqui", fauna conhecida na prévia e estado dos itens de fila.
/// </summary>
public class CorrecoesUsabilidadeApiTestes
{
    private static IEnumerable<JsonElement> Objetos(JsonElement mapa, string tipo) =>
        mapa.GetProperty("objetos").EnumerateArray().Where(o => o.GetProperty("tipo").GetString() == tipo);
    /// <summary>Campo nulo: o JSON da API omite nulos (Json.Web), então vale ausente ou null.</summary>
    private static bool Nulo(JsonElement o, string nome) => !o.TryGetProperty(nome, out var v) || v.ValueKind == JsonValueKind.Null;

    /// <summary>Põe tropas na guarnição do castelo (atalho de teste) e devolve o hexágono do castelo.</summary>
    private static Task<int> Guarnecer(ServidorTeste s, long reinoId, Dictionary<string, int> tropas) => s.Motor.Executar(m =>
    {
        var r = m.Reinos.Obter(reinoId)!;
        var c = m.Locais[r.CasteloId];
        Economia.Atualizar(m, r);
        foreach (var (k, n) in tropas) { c.Guarnicao[k] = c.Guarnicao.GetValueOrDefault(k) + n; Pessoas.RemoverCivis(m, r, m.B.U[k].Pop * n); }
        m.Sujar(c); m.Sujar(r);
        return c.Hex;
    });

    /// <summary>Hexágono livre, fora do rio e longe da borda, a exatamente <paramref name="dist"/> de <paramref name="de"/>.</summary>
    private static Task<int> HexLivre(ServidorTeste s, int de, int dist, int pular = 0, bool longeDosReinos = false) => s.Motor.Executar(m =>
        m.G.Area(de, dist).Where(h => m.G.Distancia(h, de) == dist && !m.Mapa.Rio[h] && Obras.HexLivre(m, h)
            && m.G.C(h) > 2 && m.G.L(h) > 2 && m.G.C(h) < m.G.Cols - 3 && m.G.L(h) < m.G.Lins - 3
            && (!longeDosReinos || m.Mapa.Vagas.All(v => m.G.Distancia(v.Castelo, h) > m.P.FaunaServ.PertoReino + 1))).Skip(pular).First());

    [Fact]
    public async Task Mapa_e_tropas_mostram_carga_estado_e_bloqueio_da_marcha_e_a_ordem_sai_de_onde_ela_esta()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var c = s.NovoCliente();
        var reino = await c.ContaComReino("ivo@exemplo.com", "Mirante");
        var reinoId = reino.GetProperty("id").GetInt64();
        var castelo = await Guarnecer(s, reinoId, new() { ["lanceiro"] = 6 });
        var a = await HexLivre(s, castelo, 20);
        var b = await HexLivre(s, castelo, 20, pular: 8);

        var (st, ex) = await c.Post("tropas/enviar", new { deLocalId = reino.GetProperty("casteloId").GetInt64(), tropas = new { lanceiro = 3 }, destinoHex = a, ordem = "mover" });
        Assert.True(st == HttpStatusCode.Created, ex.ToString());
        var id = ex.GetProperty("id").GetInt64();
        Assert.True(ex.GetProperty("podeOrdem").GetBoolean());
        Assert.True(Nulo(ex, "bloqueio"));
        Assert.True(Nulo(ex, "trabalho"));
        Assert.Equal(0, ex.GetProperty("cargaUsada").GetDouble());
        Assert.Equal(15, ex.GetProperty("cargaMax").GetDouble());   // 3 lanceiros × 5

        // o mapa leva a marcha própria com carga, tropas, estado e ordem (nada disso vai para marchas alheias)
        var (_, mapa) = await c.Get("mapa");
        var mm = Assert.Single(Objetos(mapa, "marcha"), o => o.GetProperty("dono").GetString() == "meu");
        Assert.Equal(id, mm.GetProperty("id").GetInt64());
        Assert.Equal("marchando", mm.GetProperty("estado").GetString());
        Assert.Equal("mover", mm.GetProperty("ordem").GetString());
        Assert.False(mm.GetProperty("parado").GetBoolean());
        Assert.True(mm.GetProperty("chegada").GetInt64() > mapa.GetProperty("agora").GetInt64());
        Assert.Empty(mm.GetProperty("carga").EnumerateObject());
        Assert.Equal(15, mm.GetProperty("cargaMax").GetDouble());
        Assert.Equal(0, mm.GetProperty("cargaUsada").GetDouble());
        Assert.Equal(3, mm.GetProperty("tropas").GetProperty("lanceiro").GetInt32());
        Assert.Equal("3 lanceiros", mm.GetProperty("resumo").GetString());
        Assert.True(Nulo(mm, "alvo"));
        Assert.True(Nulo(mm, "pessoas"));

        // outro reino não recebe esses campos nas marchas que vê
        using var c2 = s.NovoCliente();
        await c2.ContaComReino("jo@exemplo.com", "Rocha Alta");
        var (_, mapa2) = await c2.Get("mapa");
        Assert.All(Objetos(mapa2, "marcha").Where(o => o.GetProperty("dono").GetString() != "meu"), o => Assert.False(o.TryGetProperty("carga", out _)));

        // prévia a partir da marcha: visão do grupo e fauna (nenhuma conhecida no destino)
        var (sp, previa) = await c.Post("tropas/previa", new { marchaId = id, destinoHex = b });
        Assert.Equal(HttpStatusCode.OK, sp);
        Assert.Equal(2, previa.GetProperty("visao").GetInt32());   // U.lanceiro.visao
        Assert.True(Nulo(previa, "fauna"));

        // no meio do caminho, a nova ordem sai de onde a tropa está
        await s.Avancar(TimeSpan.FromMinutes(3));
        var (_, antes) = await c.Get("tropas");
        var onde = Assert.Single(antes.GetProperty("exercitos").EnumerateArray()).GetProperty("hex").GetInt32();
        Assert.NotEqual(castelo, onde);
        var (so, nova) = await c.Post($"tropas/{id}/ordem", new { ordem = "mover", destinoHex = b });
        Assert.True(so == HttpStatusCode.OK, nova.ToString());
        Assert.Equal(onde, nova.GetProperty("caminho")[0].GetInt32());
        Assert.Equal(b, nova.GetProperty("destino").GetInt32());
        Assert.Equal("marchando", nova.GetProperty("estado").GetString());

        // "mover" para o próprio hexágono é "parar aqui"
        await s.Avancar(TimeSpan.FromMinutes(1));
        (_, antes) = await c.Get("tropas");
        onde = Assert.Single(antes.GetProperty("exercitos").EnumerateArray()).GetProperty("hex").GetInt32();
        var (spa, parada) = await c.Post($"tropas/{id}/ordem", new { ordem = "mover", destinoHex = onde });
        Assert.True(spa == HttpStatusCode.OK, parada.ToString());
        Assert.Equal("parado", parada.GetProperty("estado").GetString());
        Assert.Equal("mover", parada.GetProperty("ordem").GetString());
        Assert.Equal("atacarQuemAtacar", parada.GetProperty("postura").GetString());
        Assert.Equal(onde, parada.GetProperty("hex").GetInt32());
        await s.Avancar(TimeSpan.FromHours(1));
        (_, mapa) = await c.Get("mapa");
        mm = Assert.Single(Objetos(mapa, "marcha"), o => o.GetProperty("dono").GetString() == "meu");
        Assert.True(mm.GetProperty("parado").GetBoolean());
        Assert.True(Nulo(mm, "chegada"));
        Assert.Equal(0, mapa.GetProperty("idade")[onde].GetInt32());   // parada em névoa antes: agora vê ali
        // outra ordem para o mesmo hexágono não tem o que fazer
        Assert.Equal(HttpStatusCode.BadRequest, (await c.Post($"tropas/{id}/ordem", new { ordem = "reforcar", destinoHex = onde })).status);
    }

    [Fact]
    public async Task Previa_mostra_a_fauna_conhecida_no_destino_com_veredito_e_idade()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var c = s.NovoCliente();
        var reino = await c.ContaComReino("lia@exemplo.com", "Vale Frio");
        var reinoId = reino.GetProperty("id").GetInt64();
        var casteloId = reino.GetProperty("casteloId").GetInt64();
        var castelo = await Guarnecer(s, reinoId, new() { ["lanceiro"] = 20, ["milicia"] = 1 });
        var perto = await HexLivre(s, castelo, 4);
        var longe = await HexLivre(s, castelo, 12, longeDosReinos: true);
        await s.Motor.Executar(m =>
        {
            Fauna.Adicionar(m, new RegiaoFauna { Centro = perto, Hex = perto, Raio = 1, Animal = "javalis", Nivel = "baixo", Qtd = 5 });
            Fauna.Adicionar(m, new RegiaoFauna { Centro = longe, Hex = longe, Raio = 1, Animal = "ursos", Nivel = "alto", Qtd = 2 });
            Nevoas.RevelarArea(m, reinoId, longe, 2);   // como se um explorador tivesse passado por lá
        });
        await s.Avancar(TimeSpan.FromMinutes(30));

        async Task<JsonElement> FaunaDe(object tropas, int destino)
        {
            var (st, p) = await c.Post("tropas/previa", new { deLocalId = casteloId, tropas, destinoHex = destino });
            Assert.True(st == HttpStatusCode.OK, p.ToString());
            return p.GetProperty("fauna");
        }
        // bando à vista: espécie, tamanho, nível e idade 0
        var f = await FaunaDe(new { lanceiro = 4 }, perto);
        Assert.Equal("javalis", f.GetProperty("animal").GetString());
        Assert.Equal(5, f.GetProperty("qtd").GetInt32());
        Assert.Equal("baixo", f.GetProperty("nivel").GetString());
        Assert.Equal(50, f.GetProperty("forca").GetDouble());
        Assert.Equal(0, f.GetProperty("vistoHaMin").GetInt64());
        Assert.Equal("ileso", f.GetProperty("veredito").GetString());   // 130 ≥ 100
        // fora da vista: o último estado conhecido, com a idade; os vereditos da regra de perdas
        f = await FaunaDe(new { milicia = 1 }, longe);
        Assert.Equal("ursos", f.GetProperty("animal").GetString());
        Assert.True(Nulo(f, "qtd"));
        Assert.Equal("alto", f.GetProperty("nivel").GetString());
        Assert.Equal(180, f.GetProperty("forca").GetDouble());
        Assert.InRange(f.GetProperty("vistoHaMin").GetInt64(), 29, 31);
        Assert.Equal("perde", f.GetProperty("veredito").GetString());            // 10 < 180: 25%, e 1 de 1 morre
        Assert.Equal("perdeParte", (await FaunaDe(new { lanceiro = 5 }, longe)).GetProperty("veredito").GetString());        // 162 < 180: perde 25% (1 de 5)
        Assert.Equal("venceComPerdas", (await FaunaDe(new { lanceiro = 10 }, longe)).GetProperty("veredito").GetString());   // 325 ≥ 180: perde 5% (1)
        var ileso = await FaunaDe(new { lanceiro = 20 }, longe);                                                             // 650 ≥ 360
        Assert.Equal("ileso", ileso.GetProperty("veredito").GetString());
        Assert.Equal(0, ileso.GetProperty("baixas").GetInt32());
        // GET /tropas continua dando a força de cada unidade para o cliente calcular "mande pelo menos N"
        var (_, tropas) = await c.Get("tropas");
        var lanceiro = tropas.GetProperty("unidades").EnumerateArray().First(u => u.GetProperty("id").GetString() == "lanceiro");
        Assert.Equal(32.5, lanceiro.GetProperty("forcaFauna").GetDouble());
    }

    [Fact]
    public async Task Item_de_fila_diz_estado_e_posicao_com_fila_vazia_ocupada_e_esperando_material()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var c = s.NovoCliente();
        var reino = await c.ContaComReino("nei@exemplo.com", "Corvo Negro");
        var casteloId = reino.GetProperty("casteloId").GetInt64();
        await s.Motor.Executar(m =>
        {
            var cast = m.Locais[casteloId];
            Economia.Atualizar(m, m.Reinos.Obter(cast.ReinoId)!);
            foreach (var k in new[] { "comida", "ferro", "couro" }) cast.Estoque.Somar(k, 1000);   // material para os três treinos
            m.Sujar(cast);
        });

        // fila vazia: começa na hora, com início e fim
        var (s1, i1) = await c.Post("exploradores/treinar", new { tipo = "pe", qtd = 1 });
        Assert.Equal(HttpStatusCode.Created, s1);
        Assert.Equal("andamento", i1.GetProperty("estado").GetString());
        Assert.Equal(1, i1.GetProperty("posicao").GetInt32());
        Assert.True(i1.GetProperty("inicio").GetInt64() > 0);
        Assert.True(i1.GetProperty("fim").GetInt64() > i1.GetProperty("inicio").GetInt64());

        // fila ocupada: espera o anterior, sem início nem fim (era daqui que vinha o "Pronto Invalid Date")
        var (s2, i2) = await c.Post("exploradores/treinar", new { tipo = "cavalo", qtd = 1 });
        Assert.Equal(HttpStatusCode.Created, s2);
        Assert.Equal("fila", i2.GetProperty("estado").GetString());
        Assert.Equal(2, i2.GetProperty("posicao").GetInt32());
        Assert.True(Nulo(i2, "inicio"));
        Assert.True(Nulo(i2, "fim"));
        var (s3, i3) = await c.Post("recrutamento", new { localId = casteloId, unidade = "lanceiro", qtd = 2 });
        Assert.Equal(HttpStatusCode.Created, s3);
        Assert.Equal("fila", i3.GetProperty("estado").GetString());
        Assert.Equal(3, i3.GetProperty("posicao").GetInt32());

        // esperando material: a madeira do reino está toda na serraria, e a moradia do castelo espera os carregadores
        var serraria = reino.GetProperty("locais").EnumerateArray().First(l => l.GetProperty("produz").GetString() == "madeira");
        var serrariaId = serraria.GetProperty("id").GetInt64();
        await s.Motor.Executar(m =>
        {
            var cast = m.Locais[casteloId]; var ser = m.Locais[serrariaId];
            Economia.Atualizar(m, m.Reinos.Obter(cast.ReinoId)!);
            ser.Estoque.Somar("madeira", cast.Estoque.Retirar("madeira", cast.Estoque.Qtd("madeira")));
            m.Sujar(cast); m.Sujar(ser);
        });
        var (s4, obra) = await c.Post("obras", new { acao = "moradia", localId = casteloId });
        Assert.True(s4 == HttpStatusCode.Created, obra.ToString());
        Assert.Equal("material", obra.GetProperty("estado").GetString());
        Assert.Equal(1, obra.GetProperty("posicao").GetInt32());
        Assert.True(Nulo(obra, "fim"));
        Assert.True(obra.GetProperty("materialChegaEm").GetInt64() > 0);

        // quando o material chega, a obra começa; a fila de recrutamento anda (a moradia leva pouco mais de 3 min: olha logo depois da chegada)
        await s.Avancar(TimeSpan.FromMilliseconds(obra.GetProperty("materialChegaEm").GetInt64() - s.Relogio.Agora + 2000));
        var (_, r) = await c.Get("reino");
        var filas = r.GetProperty("filas");
        var ob = Assert.Single(filas.GetProperty("obras").EnumerateArray());
        Assert.Equal("andamento", ob.GetProperty("estado").GetString());
        Assert.True(ob.GetProperty("fim").GetInt64() > 0);
        var rec = filas.GetProperty("recrutamento").EnumerateArray().ToList();
        Assert.Equal("andamento", rec[0].GetProperty("estado").GetString());
        Assert.All(rec.Skip(1), x => Assert.Equal("fila", x.GetProperty("estado").GetString()));
        Assert.Equal(Enumerable.Range(1, rec.Count), rec.Select(x => x.GetProperty("posicao").GetInt32()));
    }
}
