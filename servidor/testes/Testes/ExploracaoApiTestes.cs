using System.Net;
using System.Text.Json;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Nucleo;

namespace ReinoDePedra.Testes;

public class ExploracaoApiTestes
{
    private static IEnumerable<JsonElement> Objetos(JsonElement mapa, string tipo) =>
        mapa.GetProperty("objetos").EnumerateArray().Where(o => o.GetProperty("tipo").GetString() == tipo);

    [Fact]
    public async Task Treinar_enviar_e_dar_ordem_a_explorador_pela_api()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var c = s.NovoCliente();
        var reino = await c.ContaComReino("ana@exemplo.com", "Pedralva");
        var castelo = reino.GetProperty("locais").EnumerateArray().First(l => l.GetProperty("tipo").GetString() == "castelo");
        var hex = castelo.GetProperty("hex").GetInt32();

        var (st, item) = await c.Post("exploradores/treinar", new { tipo = "cavalo", qtd = 1 });
        Assert.Equal(HttpStatusCode.Created, st);
        Assert.Equal("explorador", item.GetProperty("tipo").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, (await c.Post("exploradores/treinar", new { tipo = "dragao", qtd = 1 })).status);
        await s.Avancar(TimeSpan.FromMinutes(13));   // o treino a cavalo leva 12 min
        var (_, ex) = await c.Get("exploracao");
        var cav = ex.GetProperty("tipos").EnumerateArray().First(x => x.GetProperty("id").GetString() == "cavalo");
        Assert.Equal(1, cav.GetProperty("livres").GetInt32());

        var destino = hex + 6;
        var (sp, previa) = await c.Post("exploracao/previa", new { tipo = "cavalo", destinoHex = destino });
        Assert.Equal(HttpStatusCode.OK, sp);
        Assert.True(previa.GetProperty("curta").GetProperty("ok").GetBoolean());
        Assert.Equal("nenhum", previa.GetProperty("curta").GetProperty("risco").GetProperty("risco").GetString());

        var (se, e) = await c.Post("exploradores/enviar", new { tipo = "cavalo", ordem = "patrulhar", destinoHex = destino });
        Assert.True(se == HttpStatusCode.Created, e.ToString());
        var id = e.GetProperty("id").GetInt64();
        Assert.Equal("marchando", e.GetProperty("estado").GetString());
        var (_, mapa) = await c.Get("mapa");
        Assert.Single(Objetos(mapa, "camada-perigo"));
        Assert.Contains(Objetos(mapa, "marcha"), o => o.GetProperty("marcha").GetString() == "explorador" && o.GetProperty("dono").GetString() == "meu");
        var (_, r) = await c.Get("reino");
        Assert.Equal(1, r.GetProperty("exploracao").GetProperty("emCampo").GetInt32());

        await s.Avancar(TimeSpan.FromMinutes(4));
        var (so, volta) = await c.Post($"exploradores/{id}/ordem", new { ordem = "retornar" });
        Assert.Equal(HttpStatusCode.OK, so);
        Assert.Equal("retornando", volta.GetProperty("estado").GetString());
        await s.Avancar(TimeSpan.FromHours(2));
        (_, ex) = await c.Get("exploracao");
        Assert.Empty(ex.GetProperty("exploradores").EnumerateArray());
        cav = ex.GetProperty("tipos").EnumerateArray().First(x => x.GetProperty("id").GetString() == "cavalo");
        Assert.Equal(1, cav.GetProperty("livres").GetInt32());
    }

    [Fact]
    public async Task Rota_caca_e_foto_do_mapa_pela_api()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var c = s.NovoCliente();
        var reino = await c.ContaComReino("bia@exemplo.com", "Valdren");
        var castelo = reino.GetProperty("locais").EnumerateArray().First(l => l.GetProperty("tipo").GetString() == "castelo");
        var hex = castelo.GetProperty("hex").GetInt32();
        var rid = reino.GetProperty("id").GetInt64();

        // rota: prévia e obra na fila (o material vai a pé até o hexágono)
        var alvo = await s.Motor.Executar(m => m.G.Area(hex, 2).First(h => m.G.Distancia(h, hex) == 2 && !m.Mapa.Rio[h] && m.LocalNoHex(h) == null));
        var (_, pr) = await c.Get("rotas/previa?hex=" + alvo);
        Assert.Equal(JsonValueKind.Undefined, pr.TryGetProperty("motivo", out var mo) ? mo.ValueKind : JsonValueKind.Undefined);
        Assert.True(pr.GetProperty("custo").GetProperty("madeira").GetDouble() > 0);
        var (sr, obra) = await c.Post("rotas", new { hex = alvo });
        Assert.True(sr == HttpStatusCode.Created, obra.ToString());
        Assert.Equal("rota", obra.GetProperty("tipo").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, (await c.Post("rotas", new { hex = alvo })).status);

        // caça: sem fauna conhecida, recusa; com um bando à vista, sai
        var bando = await s.Motor.Executar(m =>
        {
            m.Locais[castelo.GetProperty("id").GetInt64()].Guarnicao["arqueiro"] = 10;
            var h = m.G.Area(hex, 3).First(x => m.G.Distancia(x, hex) == 3 && !m.Mapa.Rio[x] && m.LocalNoHex(x) == null);
            return Fauna.Adicionar(m, new RegiaoFauna { Centro = h, Hex = h, Raio = 1, Animal = "javalis", Nivel = "baixo", Qtd = 3 }).Hex;
        });
        var semFauna = hex + 5;
        var (s1, _) = await c.Post("tropas/enviar", new { deLocalId = castelo.GetProperty("id").GetInt64(), tropas = new { arqueiro = 4 }, destinoHex = semFauna, ordem = "cacar" });
        Assert.Equal(HttpStatusCode.BadRequest, s1);
        var (_, ex) = await c.Get("exploracao");
        Assert.Contains(ex.GetProperty("bandos").EnumerateArray(), b => b.GetProperty("hex").GetInt32() == bando && b.GetProperty("vivo").GetBoolean());
        var (_, mapa) = await c.Get("mapa");
        Assert.Contains(Objetos(mapa, "fauna"), o => o.GetProperty("hex").GetInt32() == bando && o.GetProperty("animal").GetString() == "javalis");
        var (s2, caca) = await c.Post("tropas/enviar", new { deLocalId = castelo.GetProperty("id").GetInt64(), tropas = new { arqueiro = 4 }, destinoHex = bando, ordem = "cacar" });
        Assert.True(s2 == HttpStatusCode.Created, caca.ToString());

        // um local de outro reino nunca visto: público, ao vivo, com dono, sem nada do que há dentro; a névoa só cobre a riqueza do chão
        using var c2 = s.NovoCliente();
        var outro = await c2.ContaComReino("caio@exemplo.com", "Lumen");
        var hexOutro = outro.GetProperty("locais").EnumerateArray().First(l => l.GetProperty("tipo").GetString() == "castelo").GetProperty("hex").GetInt32();
        (_, mapa) = await c.Get("mapa");
        Assert.Equal(-1, mapa.GetProperty("idade")[hexOutro].GetInt32());
        var loc = Assert.Single(Objetos(mapa, "local"), o => o.GetProperty("hex").GetInt32() == hexOutro);
        Assert.Equal("outro", loc.GetProperty("dono").GetString());
        Assert.Equal(outro.GetProperty("id").GetInt64(), loc.GetProperty("reinoId").GetInt64());
        Assert.Equal(outro.GetProperty("nivelCastelo").GetInt32(), loc.GetProperty("nivel").GetInt32());
        foreach (var segredo in new[] { "foto", "visto", "guarnicao", "tropas", "civis", "estoque" }) Assert.False(loc.TryGetProperty(segredo, out _), segredo);
        // jazidas de outro reino não vão
        Assert.Empty(Objetos(mapa, "jazida"));
    }
}
