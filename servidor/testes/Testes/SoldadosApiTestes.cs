using System.Net;
using System.Text.Json;

namespace ReinoDePedra.Testes;

public class SoldadosApiTestes
{
    [Fact]
    public async Task Guarnicao_mostra_pessoas_e_o_envio_aceita_ids()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var c = s.NovoCliente();
        var reino = await c.ContaComReino("soldados@exemplo.com", "Valdren");
        var castelo = reino.GetProperty("casteloId").GetInt64();
        var (st, _) = await c.Post("recrutamento", new { localId = castelo, unidade = "lanceiro", qtd = 3 });
        Assert.Equal(HttpStatusCode.Created, st);
        await s.Avancar(TimeSpan.FromMinutes(40));

        var (_, tropas) = await c.Get("tropas");
        var loc = tropas.GetProperty("locais").EnumerateArray().First(l => l.GetProperty("id").GetInt64() == castelo);
        var pessoas = loc.GetProperty("pessoas").EnumerateArray().ToList();
        Assert.Equal(3, pessoas.Count);
        Assert.All(pessoas, p => { Assert.Equal("lanceiro", p.GetProperty("oficio").GetString()); Assert.False(string.IsNullOrEmpty(p.GetProperty("nome").GetString())); });
        var (_, lista) = await c.Get("reino/pessoas");
        Assert.Equal(3, lista.GetProperty("pessoas").EnumerateArray().Count(p => p.GetProperty("estado").GetString() == "guarnecida"));

        var hexCastelo = loc.GetProperty("hex").GetInt32();
        var ids = pessoas.Take(2).Select(p => p.GetProperty("id").GetInt64()).ToArray();
        var (stp, previa) = await c.Post("tropas/previa", new { deLocalId = castelo, pessoas = ids, destinoHex = hexCastelo + 3 });
        Assert.Equal(HttpStatusCode.OK, stp);
        var (ste, ex) = await c.Post("tropas/enviar", new { deLocalId = castelo, pessoas = ids, destinoHex = hexCastelo + 3, ordem = "mover", seguro = false });
        Assert.True(ste == HttpStatusCode.Created, ex.ToString());
        Assert.Equal(2, ex.GetProperty("total").GetInt32());
        var levadas = ex.GetProperty("pessoas").EnumerateArray().Select(p => p.GetProperty("id").GetInt64()).OrderBy(x => x).ToArray();
        Assert.Equal(ids.OrderBy(x => x), levadas);
        // quem ficou: só a terceira; a folha dela diz "na guarnição"
        var (_, t2) = await c.Get("tropas");
        var resto = t2.GetProperty("locais").EnumerateArray().First(l => l.GetProperty("id").GetInt64() == castelo).GetProperty("pessoas").EnumerateArray().Single();
        Assert.DoesNotContain(resto.GetProperty("id").GetInt64(), ids);
        var (_, folha) = await c.Get("pessoas/" + ids[0]);
        Assert.Equal("marchando", folha.GetProperty("pessoa").GetProperty("estado").GetString());
        Assert.Empty(folha.GetProperty("acoes").EnumerateArray());
        // id de civil não serve
        var civil = lista.GetProperty("pessoas").EnumerateArray().First(p => p.GetProperty("civil").GetBoolean()).GetProperty("id").GetInt64();
        Assert.Equal(HttpStatusCode.BadRequest, (await c.Post("tropas/enviar", new { deLocalId = castelo, pessoas = new[] { civil }, destinoHex = hexCastelo + 3, ordem = "mover" })).status);
    }
}
