using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Testes;

public class GuerraApiTestes
{
    public GuerraApiTestes() => AjustesTeste.Garantir();

    private static async Task<(ServidorTeste s, Cliente a, Cliente d, long casteloA)> Dois()
    {
        var s = await ServidorTeste.Iniciar();
        var a = s.NovoCliente();
        var d = s.NovoCliente();
        var ra = await a.ContaComReino("ana@exemplo.com", "Pedralva");
        await d.ContaComReino("bia@exemplo.com", "Valdren");
        return (s, a, d, ra.GetProperty("casteloId").GetInt64());
    }

    [Fact]
    public async Task Feridos_e_cura_pela_api()
    {
        var (s, a, d, casteloA) = await Dois();
        await using var _ = s; using var __ = a; using var ___ = d;
        await s.Motor.Executar(m =>
        {
            var r = m.Reinos.Single(x => x.Nome == "Pedralva");
            Feridos.Adicionar(m, r, new Dictionary<string, int> { ["lanceiro"] = 4 }, "Defesa de Mina");
            var c = m.Locais[casteloA]; c.Estoque["ervas"] = 3 * m.P.Feridos.Ervas; m.Sujar(c);
        });
        var (_, f) = await a.Get("feridos");
        Assert.Equal(4, f.GetProperty("total").GetInt32());
        Assert.Equal(3, f.GetProperty("podem").GetInt32());
        Assert.Equal(5, f.GetProperty("porFerido").GetDouble());
        var (_, reino) = await a.Get("reino");
        Assert.Equal(4, reino.GetProperty("feridos").GetProperty("total").GetInt32());
        var (sc, item) = await a.Post("feridos/curar", new { });
        Assert.True(sc == HttpStatusCode.Created, item.ToString());
        Assert.Equal(3, item.GetProperty("qtd").GetInt32());
        var (_, f2) = await a.Get("feridos");
        Assert.Equal(1, f2.GetProperty("total").GetInt32());
        Assert.Equal(3, f2.GetProperty("emCura").GetInt32());
        Assert.Single(f2.GetProperty("cura").EnumerateArray());
        // sem ervas para o último: entra na fila e aguarda; o próximo pedido já não tem quem pôr
        var (scUltimo, ultimo) = await a.Post("feridos/curar", new { });
        Assert.Equal(HttpStatusCode.Created, scUltimo);
        Assert.True(ultimo.GetProperty("aguardando").GetBoolean());
        Assert.Equal(1, ultimo.GetProperty("qtd").GetInt32());
        Assert.Equal(HttpStatusCode.BadRequest, (await a.Post("feridos/curar", new { })).status);
    }

    [Fact]
    public async Task Sacrificar_feridos_libera_o_teto()
    {
        var (s, a, d, _) = await Dois();
        await using var _s = s; using var _a = a; using var _d = d;
        long loteId = 0; int ocupavam = 0;
        await s.Motor.Executar(m =>
        {
            var r = m.Reinos.Single(x => x.Nome == "Pedralva");
            var lote = Feridos.Adicionar(m, r, new Dictionary<string, int> { ["lanceiro"] = 3 }, "Defesa de Mina")!;
            loteId = lote.Id;
            ocupavam = Feridos.Ocupando(m, r);
        });
        Assert.Equal(3, ocupavam);
        var (sc, res) = await a.Post("feridos/sacrificar", new { loteId });
        Assert.True(sc == HttpStatusCode.OK, res.ToString());
        Assert.Equal(3, res.GetProperty("mortos").GetInt32());
        Assert.Equal(3, res.GetProperty("nomes").GetArrayLength());
        var (_, f) = await a.Get("feridos");
        Assert.Equal(0, f.GetProperty("total").GetInt32());
        await s.Motor.Executar(m =>
        {
            var r = m.Reinos.Single(x => x.Nome == "Pedralva");
            Assert.Equal(0, Feridos.Ocupando(m, r));
            Assert.DoesNotContain(m.PessoasDe(r.Id), p => p.Estado == Jogo.Pessoas.Estados.Ferida);
        });
        Assert.Equal(HttpStatusCode.BadRequest, (await a.Post("feridos/sacrificar", new { loteId })).status);   // o lote já não existe
    }

    [Fact]
    public async Task Modelos_de_ataque_pela_api()
    {
        var (s, a, d, _) = await Dois();
        await using var _s = s; using var _a = a; using var _d = d;
        var (sc, md) = await a.Post("ataques/modelos", new { nome = "Saque rápido", tipo = "saque", tatica = "conservadora", tropas = new { cavalaria = 10 },
            objetivos = new object[] { new { k = "recurso", r = "auto", q = 1000 } } });
        Assert.True(sc == HttpStatusCode.Created, md.ToString());
        var (_, l) = await a.Get("ataques/modelos");
        var item = Assert.Single(l.GetProperty("modelos").EnumerateArray());
        Assert.Equal("Saque rápido", item.GetProperty("nome").GetString());
        Assert.True(item.GetProperty("objetivos")[0].TryGetProperty("r", out var rr), item.ToString());
        Assert.Equal("auto", rr.GetString());
        Assert.False(l.TryGetProperty("ultimo", out var u) && u.ValueKind != JsonValueKind.Null);
        Assert.Equal(HttpStatusCode.BadRequest, (await a.Post("ataques/modelos", new { nome = new string('x', 40) })).status);
        var del = await a.Http.DeleteAsync("ataques/modelos/" + item.GetProperty("id").GetInt64());
        Assert.Equal(HttpStatusCode.NoContent, del.StatusCode);
        var (_, l2) = await a.Get("ataques/modelos");
        Assert.Empty(l2.GetProperty("modelos").EnumerateArray());
    }

    [Fact]
    public async Task Interceptacao_previa_e_envio_pela_api_sem_revelar_tamanho_nem_destino()
    {
        var (s, a, d, casteloA) = await Dois();
        await using var _s = s; using var _a = a; using var _d = d;
        var marchaId = await s.Motor.Executar(m =>
        {
            var def = m.Reinos.Single(x => x.Nome == "Valdren");
            var c = m.Locais[casteloA];
            c.Guarnicao["cavalaria"] = 30; m.Sujar(c);
            var h = m.G.Area(c.Hex, 4).First(x => m.G.Distancia(x, c.Hex) == 4 && Obras.HexLivre(m, x) && !m.Mapa.Rio[x]);
            var mina = m.AdicionarLocal(new Local { ReinoId = def.Id, Tipo = TipoLocal.Mina, Produz = "ferro", Hex = h, Nome = "Mina Rubra", Guarnicao = new() { ["lanceiro"] = 10 } });
            var destino = CombateCenario.DestinoInterceptavel(m, h, c.Hex, 20);
            return Exercitos.Enviar(m, def, mina.Id, new Dictionary<string, int> { ["lanceiro"] = 10 }, destino, OrdemMover.Id).Id;
        });
        var (sp, p) = await a.Post("interceptacao/previa", new { marchaId, deLocalId = casteloA, tropas = new { cavalaria = 30 } });
        Assert.True(sp == HttpStatusCode.OK, p.ToString());
        Assert.Equal(JsonValueKind.Object, p.GetProperty("encontro").ValueKind);
        Assert.True(p.GetProperty("encontro").GetProperty("folga").GetInt64() >= 60_000);
        var alvoP = p.GetProperty("alvo");
        Assert.Equal("exercito", alvoP.GetProperty("marcha").GetString());
        Assert.Equal("Valdren", alvoP.GetProperty("reino").GetProperty("nome").GetString());
        Assert.Equal(JsonValueKind.String, alvoP.GetProperty("rumo").ValueKind);
        foreach (var segredo in new[] { "tamanho", "some", "chegada", "destino", "tropas", "caminho", "paraMim" }) Assert.False(alvoP.TryGetProperty(segredo, out _), segredo);
        var (se, ex) = await a.Post("interceptacao", new { marchaId, deLocalId = casteloA, tropas = new { cavalaria = 30 } });
        Assert.True(se == HttpStatusCode.Created, ex.ToString());
        Assert.Equal("interceptar", ex.GetProperty("ordem").GetString());
        Assert.Equal(p.GetProperty("encontro").GetProperty("hex").GetInt32(), ex.GetProperty("destino").GetInt32());
        // a própria marcha não se intercepta
        Assert.Equal(HttpStatusCode.NotFound, (await d.Post("interceptacao/previa", new { marchaId, deLocalId = casteloA, tropas = new { cavalaria = 1 } })).status);
    }

    [Fact]
    public async Task Exilio_e_avistamentos_pela_api()
    {
        var (s, a, d, casteloA) = await Dois();
        await using var _s = s; using var _a = a; using var _d = d;
        await s.Motor.Executar(m =>
        {
            var atk = m.Reinos.Single(x => x.Nome == "Pedralva");
            var def = m.Reinos.Single(x => x.Nome == "Valdren");
            foreach (var l in m.LocaisDe(def.Id).Where(l => l.Id != def.CasteloId).ToList()) m.RemoverLocal(l);
            var c = m.Locais[casteloA];
            var vencedor = (Exercito)m.Marchas.Adicionar(new Exercito { ReinoId = atk.Id, Tropas = new() { ["arqueiro"] = 10 }, Caminho = [c.Hex], Tempos = [m.Agora], OrigemLocalId = c.Id });
            Quedas.CairCastelo(m, def, vencedor, m.Locais[def.CasteloId]);
            // um espião visto por Pedralva
            ReinoDePedra.Jogo.Exploracao.Avistamentos.Registrar(m, atk.Id, c.Hex + 2, "espiao", "Espião visto");
        });
        var (_, rd) = await d.Get("reino");
        Assert.True(rd.GetProperty("queda").GetProperty("exilio").GetBoolean());
        var (_, x) = await d.Get("exilio");
        Assert.True(x.GetProperty("exilio").GetBoolean());
        Assert.Equal("Pedralva", x.GetProperty("atacanteReino").GetProperty("nome").GetString());
        Assert.Equal(2, x.GetProperty("kitTropas").GetProperty("milicia").GetInt32());
        Assert.Equal(HttpStatusCode.NoContent, (await d.Post("exilio/visto")).status);
        var (_, rd2) = await d.Get("reino");
        Assert.False(rd2.TryGetProperty("queda", out var q2) && q2.ValueKind != JsonValueKind.Null);

        var (_, mapa) = await a.Get("mapa");
        var av = mapa.GetProperty("objetos").EnumerateArray().Single(o => o.GetProperty("tipo").GetString() == "avistamento");
        Assert.Equal("espiao", av.GetProperty("avistado").GetString());
        Assert.False(av.TryGetProperty("tamanho", out _));
    }
}
