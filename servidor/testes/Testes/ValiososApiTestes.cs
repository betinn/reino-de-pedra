using System.Net;
using System.Text.Json;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Mapa;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Testes;

public class ValiososApiTestes
{
    private static IEnumerable<JsonElement> Objetos(JsonElement mapa, string tipo) =>
        mapa.GetProperty("objetos").EnumerateArray().Where(o => o.GetProperty("tipo").GetString() == tipo);

    [Fact]
    public async Task Veiculos_caravana_salgadeira_extracao_e_reliquias_pela_api()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var c = s.NovoCliente();
        var reino = await c.ContaComReino("ana@exemplo.com", "Pedralva");
        var castelo = reino.GetProperty("casteloId").GetInt64();
        var sistemas = reino.GetProperty("sistemas");
        Assert.False(sistemas.GetProperty("logistica").GetBoolean());
        Assert.Equal(500, reino.GetProperty("veiculos").GetProperty("carroca").GetProperty("carga").GetDouble());
        var locais = reino.GetProperty("locais").EnumerateArray().ToList();
        var vila = locais.First(l => l.GetProperty("tipo").GetString() == "vila");
        Assert.True(vila.GetProperty("podeSalgadeira").GetBoolean());

        // carroça na fila de obras; carroção sem cavalos é recusado
        var (sv, item) = await c.Post("veiculos", new { tipo = "carroca", qtd = 1 });
        Assert.Equal(HttpStatusCode.Created, sv);
        Assert.Equal("veiculo", item.GetProperty("tipo").GetString());
        var (sc, erro) = await c.Post("veiculos", new { tipo = "carrocao" });
        Assert.Equal(HttpStatusCode.BadRequest, sc);
        Assert.Contains("cavalos", erro.GetProperty("erro").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, (await c.Post("salgadeira", new { localId = vila.GetProperty("id").GetInt64() })).status);   // sem sal
        await s.Avancar(TimeSpan.FromMinutes(10));
        var (_, r) = await c.Get("reino");
        Assert.Equal(1, r.GetProperty("veiculos").GetProperty("carroca").GetProperty("livres").GetInt32());

        // caravana: prévia e envio
        var corpo = new { origemLocalId = castelo, destinoLocalId = vila.GetProperty("id").GetInt64(), carga = new { madeira = 300 }, veiculos = new { carroca = 1 } };
        var (sp, previa) = await c.Post("caravanas/previa", corpo);
        Assert.Equal(HttpStatusCode.OK, sp);
        Assert.True(previa.GetProperty("ok").GetBoolean(), previa.ToString());
        Assert.True(previa.GetProperty("poucoProtegida").GetBoolean());
        Assert.Equal(500, previa.GetProperty("capacidade").GetDouble());
        var (scv, cv) = await c.Post("caravanas", corpo);
        Assert.Equal(HttpStatusCode.Created, scv);
        (_, r) = await c.Get("reino");
        var marcha = r.GetProperty("marchas").EnumerateArray().Single(x => x.GetProperty("tipo").GetString() == "caravana");
        Assert.Equal("levar", marcha.GetProperty("detalhe").GetProperty("fase").GetString());

        // jazida e ruína conhecidas, relíquia guardada
        int hexJazida = 0, hexRuina = 0;
        long mina = 0;
        await s.Motor.Executar(m =>
        {
            var rr = m.Reinos.First(x => x.ContaId != null);
            var cas = m.Locais[rr.CasteloId];
            var livres = m.G.Area(cas.Hex, 3).Where(h => m.G.Distancia(h, cas.Hex) == 3 && Obras.HexLivre(m, h) && !m.Mapa.Rio[h]).ToList();
            hexJazida = livres[0]; hexRuina = livres[1];
            var j = m.Jazidas.Adicionar(new Jazida { Hex = hexJazida, Recurso = "prata", Inicial = 2000, Restante = 2000 });
            j.DescobertaPor.Add(rr.Id);
            m.Ruinas.Adicionar(new Ruina { Hex = hexRuina, TipoReliquia = "ataque" });
            Nevoas.RevelarArea(m, rr.Id, hexRuina, 0);
            var mn = m.LocaisDe(rr.Id).First(l => l.Tipo == TipoLocal.Mina);
            mina = mn.Id;
            for (var i = 0; i < 2; i++)
            {
                var rel = m.Reliquias.Adicionar(new Reliquia { Nome = "Teste " + i, Tipo = "producao", ReinoId = rr.Id });
                Reliquias.Guardar(m, rel, mn);
            }
            cas.Guarnicao["lanceiro"] = 10;
            cas.Estoque.Somar("madeira", 2000); cas.Estoque.Somar("pedra", 2000);
            m.Sujar(cas);
        });
        var (_, ext) = await c.Get("extracao");
        Assert.Equal(hexJazida, ext.GetProperty("jazidas").EnumerateArray().Single().GetProperty("hex").GetInt32());
        Assert.Contains(ext.GetProperty("ruinas").EnumerateArray(), x => x.GetProperty("hex").GetInt32() == hexRuina);
        var (spe, pe) = await c.Post("extracao/previa", new { deLocalId = castelo, tropas = new { lanceiro = 10 }, hex = hexJazida });
        Assert.Equal(HttpStatusCode.OK, spe);
        Assert.Equal("extracao", pe.GetProperty("tipo").GetString());
        Assert.Equal(3, pe.GetProperty("cenarios").GetArrayLength());
        var (spr, pr) = await c.Post("extracao/previa", new { deLocalId = castelo, tropas = new { lanceiro = 1 }, hex = hexRuina });
        Assert.Equal(HttpStatusCode.OK, spr);
        Assert.Equal(12, pr.GetProperty("horas").GetDouble(), 6);
        var (sx, grupo) = await c.Post("extracao", new { deLocalId = castelo, tropas = new { lanceiro = 5 }, hex = hexJazida, repetir = true });
        Assert.Equal(HttpStatusCode.Created, sx);
        Assert.Equal("extrair", grupo.GetProperty("ordem").GetString());
        var (se, esc) = await c.Post("extracao", new { deLocalId = castelo, tropas = new { lanceiro = 1 }, hex = hexRuina, destinoLocalId = mina });
        Assert.True(se == HttpStatusCode.Created, esc.ToString());
        Assert.Equal("escavar", esc.GetProperty("ordem").GetString());
        var (spo, po) = await c.Post("postos", new { hex = hexJazida });
        Assert.True(spo == HttpStatusCode.Created, po.ToString());

        // relíquias: as suas, com o brilho no mapa de quem explorou; para outro reino, anônimas
        var (srl, rel) = await c.Get("reliquias");
        Assert.True(srl == HttpStatusCode.OK, srl + " " + rel);
        Assert.Equal(2, rel.GetProperty("minhas").GetArrayLength());
        Assert.Equal("guardada", rel.GetProperty("minhas")[0].GetProperty("estado").GetString());
        var (_, mapa) = await c.Get("mapa");
        Assert.Contains(Objetos(mapa, "reliquia-em"), o => o.GetProperty("local").GetInt64() == mina);
        (_, r) = await c.Get("reino");
        Assert.True(r.GetProperty("sistemas").GetProperty("reliquias").GetBoolean());
        var relId = rel.GetProperty("minhas")[0].GetProperty("id").GetInt64();
        var (spm, pm) = await c.Post($"reliquias/{relId}/previa", new { deLocalId = castelo, tropas = new { lanceiro = 2 }, destinoLocalId = castelo });
        Assert.True(spm == HttpStatusCode.OK, pm.ToString());
        Assert.Equal(1, pm.GetProperty("depois").GetInt32());
        var (smv, mv) = await c.Post($"reliquias/{relId}/mover", new { deLocalId = castelo, tropas = new { lanceiro = 2 }, destinoLocalId = castelo });
        Assert.Equal(HttpStatusCode.Created, smv);
        Assert.True(mv.GetProperty("poucoProtegida").GetBoolean());

        using var c2 = s.NovoCliente();
        await c2.ContaComReino("bia@exemplo.com", "Valdren");
        var (_, mapa2) = await c2.Get("mapa");
        Assert.DoesNotContain(Objetos(mapa2, "reliquia-em"), o => o.TryGetProperty("local", out var l) && l.GetInt64() == mina);
        Assert.Empty(Objetos(mapa2, "brilho"));   // não explorou a área
        Assert.Equal(HttpStatusCode.NotFound, (await c2.Post($"reliquias/{relId}/mover", new { deLocalId = castelo, tropas = new { lanceiro = 1 }, destinoLocalId = castelo })).status);
    }
}
