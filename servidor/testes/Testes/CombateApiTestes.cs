using System.Net;
using System.Text.Json;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Testes;

public class CombateApiTestes
{
    public CombateApiTestes() => AjustesTeste.Garantir();

    [Fact]
    public async Task Previa_envio_batalha_com_nome_recuo_relatorio_e_defesas_pela_api()
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
        });

        // A nunca viu a mina: os locais são públicos, a prévia diz de quem é e não diz o que há dentro
        var (sp, previa) = await a.Post("ataques/previa", new { deLocalId = casteloA, tropas = new { cavalaria = 20 }, destinoHex = alvoHex });
        Assert.True(sp == HttpStatusCode.OK, previa.ToString());
        Assert.Equal("saque", previa.GetProperty("plano").GetProperty("tipo").GetString());
        Assert.Equal("outro", previa.GetProperty("alvo").GetProperty("dono").GetString());
        Assert.Equal(minaD.GetProperty("nome").GetString(), previa.GetProperty("alvo").GetProperty("nome").GetString());
        Assert.Equal("Valdren", previa.GetProperty("alvo").GetProperty("reino").GetProperty("nome").GetString());
        Assert.Equal("nenhuma", previa.GetProperty("forcaInimiga").GetProperty("fonte").GetString());
        Assert.False(previa.GetProperty("forcaInimiga").TryGetProperty("guarnicao", out _));
        Assert.False(previa.TryGetProperty("defensorVera", out _));
        Assert.False(previa.TryGetProperty("estandarte", out _));
        Assert.True(previa.GetProperty("curta").GetProperty("ok").GetBoolean());
        Assert.Contains("ocupacao", previa.GetProperty("tipos").EnumerateArray().Select(x => x.GetString()));
        Assert.DoesNotContain("cerco", previa.GetProperty("tipos").EnumerateArray().Select(x => x.GetString()));
        Assert.True(previa.GetProperty("quandoParam").GetArrayLength() >= 2);
        var (sp2, p2) = await a.Post("ataques/previa", new { deLocalId = casteloA, tropas = new { cavalaria = 20 }, destinoHex = alvoHex, tipo = "saque", tatica = "agressiva" });
        Assert.Equal(HttpStatusCode.OK, sp2);
        Assert.Equal(0.6, p2.GetProperty("plano").GetProperty("limite").GetDouble(), 6);
        Assert.Equal(HttpStatusCode.BadRequest, (await a.Post("ataques/previa", new { deLocalId = casteloA, tropas = new { cavalaria = 20 }, destinoHex = alvoHex, tipo = "cerco" })).status);
        Assert.Equal(HttpStatusCode.BadRequest, (await a.Post("ataques", new { deLocalId = casteloA, tropas = new { milicia = 3 }, destinoHex = alvoHex })).status);

        var (se, ex) = await a.Post("ataques", new { deLocalId = casteloA, tropas = new { cavalaria = 20 }, destinoHex = alvoHex, tipo = "saque", tatica = "media",
            objetivos = new object[] { new { k = "recurso", r = "pedra" } }, recuarVazio = false });
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
        Assert.Equal("Exército de Pedralva", bd.GetProperty("eles").GetProperty("nome").GetString());
        Assert.Equal("Pedralva", bd.GetProperty("eles").GetProperty("atacante").GetProperty("nome").GetString());
        Assert.True(bd.GetProperty("serie").GetArrayLength() > 2);
        Assert.False(bd.GetProperty("encerrada").GetBoolean());
        var (_, ba) = await a.Get("batalhas/" + id);
        Assert.Equal("ataque", ba.GetProperty("papel").GetString());
        Assert.Equal(minaD.GetProperty("nome").GetString(), ba.GetProperty("nome").GetString());
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
        Assert.Equal("Pedralva", rel.GetProperty("dados").GetProperty("atacante").GetProperty("nome").GetString());
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
        // torres são públicas: o atacante vê a torre de longe, em área nunca vista, com nível e alcance
        var (_, mapaA) = await a.Get("mapa");
        var torreA = Assert.Single(mapaA.GetProperty("objetos").EnumerateArray(), o => o.GetProperty("tipo").GetString() == "torre" && o.GetProperty("hex").GetInt32() == hexTorre);
        Assert.Equal("outro", torreA.GetProperty("dono").GetString());
        Assert.False(torreA.TryGetProperty("arqueiros", out _));
    }
}
