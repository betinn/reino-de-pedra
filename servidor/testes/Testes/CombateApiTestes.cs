using System.Net;
using System.Text.Json;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Testes;

public class CombateApiTestes
{
    public CombateApiTestes() => AjustesTeste.Garantir();

    [Fact]
    public async Task Previa_envio_batalha_anonima_recuo_relatorio_e_defesas_pela_api()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var a = s.NovoCliente();
        using var d = s.NovoCliente();
        var ra = await a.ContaComReino("ana@exemplo.com", "Pedralva");
        var rd = await d.ContaComReino("bia@exemplo.com", "Valdren");
        var casteloA = ra.GetProperty("casteloId").GetInt64();
        var minaD = rd.GetProperty("locais").EnumerateArray().First(l => l.GetProperty("tipo").GetString() == "mina");
        var alvoHex = minaD.GetProperty("hex").GetInt32();
        await s.Motor.Executar(m =>
        {
            var def = m.Reinos.Single(r => r.Nome == "Valdren");
            def.EscudoAte = 0;
            var c = m.Locais[casteloA];
            c.Guarnicao["cavalaria"] = 20; c.Guarnicao["milicia"] = 3;
            m.Sujar(c); m.Sujar(def);
            ReinoDePedra.Jogo.Exploracao.Nevoas.RevelarArea(m, m.Locais[casteloA].ReinoId, alvoHex, 0);   // A já viu a mina
        });

        var (sp, previa) = await a.Post("ataques/previa", new { deLocalId = casteloA, tropas = new { cavalaria = 20 }, destinoHex = alvoHex });
        Assert.True(sp == HttpStatusCode.OK, previa.ToString());
        Assert.Equal("saque", previa.GetProperty("plano").GetProperty("tipo").GetString());
        Assert.Equal("desconhecido", previa.GetProperty("alvo").GetProperty("dono").GetString());
        Assert.Equal("Mina", previa.GetProperty("alvo").GetProperty("nome").GetString());
        Assert.DoesNotContain("Valdren", previa.ToString());
        Assert.True(previa.GetProperty("curta").GetProperty("ok").GetBoolean());
        Assert.Equal("Forças desconhecidas", previa.GetProperty("defensorVera").GetProperty("nome").GetString());
        Assert.Contains("ocupacao", previa.GetProperty("tipos").EnumerateArray().Select(x => x.GetString()));
        Assert.DoesNotContain("cerco", previa.GetProperty("tipos").EnumerateArray().Select(x => x.GetString()));
        Assert.True(previa.GetProperty("quandoParam").GetArrayLength() >= 2);
        var (sp2, p2) = await a.Post("ataques/previa", new { deLocalId = casteloA, tropas = new { cavalaria = 20 }, destinoHex = alvoHex, estandarte = true, tipo = "saque", tatica = "agressiva" });
        Assert.Equal(HttpStatusCode.OK, sp2);
        Assert.Equal("Reino de Pedralva", p2.GetProperty("defensorVera").GetProperty("nome").GetString());
        Assert.Equal(0.6, p2.GetProperty("plano").GetProperty("limite").GetDouble(), 6);
        Assert.Equal(HttpStatusCode.BadRequest, (await a.Post("ataques/previa", new { deLocalId = casteloA, tropas = new { cavalaria = 20 }, destinoHex = alvoHex, tipo = "cerco" })).status);
        Assert.Equal(HttpStatusCode.BadRequest, (await a.Post("ataques", new { deLocalId = casteloA, tropas = new { milicia = 3 }, destinoHex = alvoHex })).status);

        var (se, ex) = await a.Post("ataques", new { deLocalId = casteloA, tropas = new { cavalaria = 20 }, destinoHex = alvoHex, tipo = "saque", tatica = "media",
            objetivos = new object[] { new { k = "recurso", r = "pedra", q = 500 } } });
        Assert.True(se == HttpStatusCode.Created, ex.ToString());
        Assert.Equal("atacar", ex.GetProperty("ordem").GetString());
        var chegada = ex.GetProperty("chegada").GetInt64();
        await s.Avancar(TimeSpan.FromMilliseconds(chegada - s.Relogio.Agora + 1));

        var (_, lista) = await d.Get("batalhas");
        var bat = lista.EnumerateArray().Single();
        Assert.Equal("defesa", bat.GetProperty("papel").GetString());
        var id = bat.GetProperty("id").GetInt64();
        var (sb, bd) = await d.Get("batalhas/" + id);
        Assert.Equal(HttpStatusCode.OK, sb);
        Assert.Equal("Forças desconhecidas", bd.GetProperty("eles").GetProperty("nome").GetString());
        Assert.DoesNotContain("Pedralva", bd.ToString());
        Assert.True(bd.GetProperty("serie").GetArrayLength() > 2);
        Assert.False(bd.GetProperty("encerrada").GetBoolean());
        var (_, ba) = await a.Get("batalhas/" + id);
        Assert.Equal("ataque", ba.GetProperty("papel").GetString());
        Assert.DoesNotContain("Valdren", ba.ToString());
        Assert.Equal("Mina", ba.GetProperty("nome").GetString());
        var (_, reinoD) = await d.Get("reino");
        Assert.Single(reinoD.GetProperty("batalhas").EnumerateArray());
        using var c3 = s.NovoCliente();
        await c3.ContaComReino("cai@exemplo.com", "Lumen");
        Assert.Equal(HttpStatusCode.NotFound, (await c3.Get("batalhas/" + id)).status);

        var (sr, depois) = await a.Post("batalhas/" + id + "/recuar");
        Assert.Equal(HttpStatusCode.OK, sr);
        Assert.True(depois.GetProperty("encerrada").GetBoolean());
        Assert.Equal("recuo", depois.GetProperty("resultado").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, (await a.Post("batalhas/" + id + "/recuar")).status);

        var (_, rels) = await d.Get("relatorios?tipo=defesa");
        var relId = rels.EnumerateArray().First().GetProperty("id").GetInt64();
        var (_, rel) = await d.Get("relatorios/" + relId);
        Assert.DoesNotContain("Pedralva", rel.ToString());
        Assert.Equal("vitoria", rel.GetProperty("dados").GetProperty("resultado").GetString());
        var (_, relsA) = await a.Get("relatorios?tipo=ataque");
        Assert.Single(relsA.EnumerateArray());

        // defesas: portões e torre
        var (sdf, df) = await d.Get("defesas");
        Assert.Equal(HttpStatusCode.OK, sdf);
        Assert.Equal(0, df.GetProperty("castelo").GetProperty("portoes").GetInt32());
        Assert.Equal(1, df.GetProperty("castelo").GetProperty("proximo").GetProperty("nivel").GetInt32());
        await s.Motor.Executar(m =>
        {
            var r = m.Reinos.Single(x => x.Nome == "Valdren");
            ReinoDePedra.Jogo.Reinos.Economia.Atualizar(m, r);
            var c = m.Locais[r.CasteloId];
            foreach (var k in new[] { "madeira", "pedra", "ferro", "comida" }) c.Estoque.Somar(k, 5000);
            m.Sujar(c);
        });
        var (spo, po) = await d.Post("defesas/portoes");
        Assert.True(spo == HttpStatusCode.Created, po.ToString());
        var hexTorre = await s.Motor.Executar(m =>
        {
            var r = m.Reinos.Single(x => x.Nome == "Valdren");
            var c = m.Locais[r.CasteloId];
            return m.G.Area(c.Hex, 2).First(h => Defesas.MotivoTorre(m, r, h) == null);
        });
        var (smo, mot) = await d.Get("defesas/torre/motivo?hex=" + hexTorre);
        Assert.False(mot.TryGetProperty("motivo", out var mv) && mv.ValueKind == JsonValueKind.String, mot.ToString());
        var (st, item) = await d.Post("defesas/torres", new { hex = hexTorre });
        Assert.True(st == HttpStatusCode.Created, item.ToString());
        Assert.Equal("torre", item.GetProperty("tipo").GetString());
        await s.Avancar(TimeSpan.FromHours(4));
        var (_, df2) = await d.Get("defesas");
        Assert.Single(df2.GetProperty("torres").EnumerateArray());
        Assert.Equal(1, df2.GetProperty("castelo").GetProperty("portoes").GetInt32());
        var (_, mapa) = await d.Get("mapa");
        Assert.Contains(mapa.GetProperty("objetos").EnumerateArray(), o => o.GetProperty("tipo").GetString() == "torre" && o.GetProperty("dono").GetString() == "meu");
        // o atacante não vê a torre de longe (área nunca vista)
        var (_, mapaA) = await a.Get("mapa");
        Assert.DoesNotContain(mapaA.GetProperty("objetos").EnumerateArray(), o => o.GetProperty("tipo").GetString() == "torre" && o.GetProperty("hex").GetInt32() == hexTorre);
    }
}
