using System.Net;
using System.Text.Json;
using ReinoDePedra.Jogo.Forja;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Testes;

public class FerrariaApiTestes
{
    private static bool Nulo(JsonElement e, string p) => !e.TryGetProperty(p, out var v) || v.ValueKind == JsonValueKind.Null;

    [Fact]
    public async Task Ferraria_pela_api_eras_forja_lendario_e_sistemas()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var c = s.NovoCliente();
        var reino = await c.ContaComReino("ferreiro@exemplo.com", "Bigorna");
        var rid = reino.GetProperty("id").GetInt64();
        // antes da primeira ferraria, o sistema ainda não apareceu
        Assert.False(reino.GetProperty("sistemas").GetProperty("ferraria").GetBoolean());
        var (st0, f0) = await c.Get("ferraria");
        Assert.Equal(HttpStatusCode.OK, st0);
        Assert.True(Nulo(f0, "ferraria"));
        Assert.Equal("ferro", f0.GetProperty("era").GetString());
        var (ste, erro) = await c.Post("ferraria/eras", new { era = "aco" });
        Assert.Equal(HttpStatusCode.BadRequest, ste);
        Assert.Contains("ferraria", erro.GetProperty("erro").GetString()!.ToLowerInvariant());

        // uma ferraria nível 7 e recursos (atalho de teste)
        long fid = 0;
        await s.Motor.Executar(m =>
        {
            var r = m.Reinos[rid];
            var castelo = m.Locais[r.CasteloId];
            var h = m.G.Area(castelo.Hex, 3).First(x => Obras.HexLivre(m, x) && !m.Mapa.Rio[x]);
            fid = m.AdicionarLocal(new Local { ReinoId = r.Id, Tipo = TipoLocal.Ferraria, Nivel = 7, Hex = h, Nome = "Ferraria do Vale" }).Id;
            foreach (var k in new[] { "comida", "madeira", "pedra", "ferro", "couro", "aco", "ouro", "minerio" }) castelo.Estoque.Somar(k, 50000);
            m.Sujar(castelo);
        });
        var (_, r1) = await c.Get("reino");
        Assert.True(r1.GetProperty("sistemas").GetProperty("ferraria").GetBoolean());

        var (st1, f1) = await c.Get("ferraria");
        Assert.Equal(fid, f1.GetProperty("ferraria").GetProperty("id").GetInt64());
        var aco = f1.GetProperty("eras").EnumerateArray().First(e => e.GetProperty("id").GetString() == "aco");
        Assert.True(aco.GetProperty("req").EnumerateArray().All(x => x.GetProperty("ok").GetBoolean()));
        Assert.True(Nulo(aco, "bloqueio"));
        var cerco = f1.GetProperty("eras").EnumerateArray().First(e => e.GetProperty("id").GetString() == "cerco");
        Assert.False(string.IsNullOrEmpty(cerco.GetProperty("bloqueio").GetString()));
        Assert.Equal(3, f1.GetProperty("familias").GetArrayLength());
        var inf = f1.GetProperty("familias")[0];
        Assert.Equal("infantaria", inf.GetProperty("id").GetString());
        Assert.Contains("milicia", inf.GetProperty("unidades").EnumerateArray().Select(x => x.GetString()));
        Assert.Equal(1, inf.GetProperty("linhas")[0].GetProperty("proximo").GetProperty("nivel").GetInt32());

        var (sta, item) = await c.Post("ferraria/eras", new { era = "aco" });
        Assert.Equal(HttpStatusCode.Created, sta);
        Assert.Equal("era", item.GetProperty("tipo").GetString());
        Assert.Equal(HttpStatusCode.Created, (await c.Post("ferraria/forjar", new { familia = "arqueiros", linha = "armas" })).status);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.Post("ferraria/forjar", new { familia = "cerco", linha = "armas" })).status);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.Post("ferraria/lendario", new { tipo = "ataque" })).status);
        var (_, r2) = await c.Get("reino");
        Assert.Equal(2, r2.GetProperty("filas").GetProperty("ferraria").GetArrayLength());

        await s.Avancar(TimeSpan.FromHours(12));
        var (_, f2) = await c.Get("ferraria");
        Assert.Equal("aco", f2.GetProperty("era").GetString());
        var arq = f2.GetProperty("familias").EnumerateArray().First(x => x.GetProperty("id").GetString() == "arqueiros");
        Assert.Equal(1, arq.GetProperty("linhas")[0].GetProperty("nivel").GetInt32());
        var (_, tropas) = await c.Get("tropas");
        var elite = tropas.GetProperty("unidades").EnumerateArray().First(u => u.GetProperty("id").GetString() == "elite");
        Assert.True(Nulo(elite, "bloqueio"));

        // lendário: ferraria 8 e era do aço
        await s.Motor.Executar(m => { m.Locais[fid].Nivel = 8; m.Sujar(m.Locais[fid]); });
        var (stl, il) = await c.Post("ferraria/lendario", new { tipo = "defesa" });
        Assert.True(stl == HttpStatusCode.Created, il.ToString());
        Assert.Equal(HttpStatusCode.BadRequest, (await c.Post("ferraria/lendario", new { tipo = "ataque" })).status);
        await s.Avancar(TimeSpan.FromHours(30));
        var (_, f3) = await c.Get("ferraria");
        var meu = f3.GetProperty("lendario").GetProperty("meus").EnumerateArray().Single();
        Assert.Equal("defesa", meu.GetProperty("tipo").GetString());
        Assert.Equal("local", meu.GetProperty("onde").GetProperty("tipo").GetString());
        Assert.Equal(fid, meu.GetProperty("onde").GetProperty("id").GetInt64());
        var eid = meu.GetProperty("id").GetInt64();
        var (stv, lista) = await c.Post($"ferraria/lendario/{eid}/levar", new { levar = true });
        Assert.Equal(HttpStatusCode.OK, stv);
        Assert.True(lista[0].GetProperty("levar").GetBoolean());
        Assert.Equal(HttpStatusCode.NotFound, (await c.Post("ferraria/lendario/999999/levar", new { levar = true })).status);
        var (_, r3) = await c.Get("reino");
        var local = r3.GetProperty("locais").EnumerateArray().First(l => l.GetProperty("id").GetInt64() == fid);
        Assert.Equal(eid, local.GetProperty("lendarios")[0].GetProperty("id").GetInt64());
        Assert.Equal("aco", r3.GetProperty("ferraria").GetProperty("era").GetString());
        Assert.True(f3.GetProperty("teto").GetDouble() > 0);
    }
}
