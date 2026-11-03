using System.Net;
using System.Text.Json;

namespace ReinoDePedra.Testes;

public class TropasApiTestes
{
    [Fact]
    public async Task Recrutar_enviar_voltar_e_postura_pela_api()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var c = s.NovoCliente();
        var reino = await c.ContaComReino("eva@exemplo.com", "Fenda");
        var castelo = reino.GetProperty("casteloId").GetInt64();

        var (st, item) = await c.Post("recrutamento", new { localId = castelo, unidade = "lanceiro", qtd = 3 });   // o kit recruta 3
        Assert.Equal(HttpStatusCode.Created, st);
        Assert.Equal("recrutar", item.GetProperty("tipo").GetString());
        var (_, tropas) = await c.Get("tropas");
        Assert.Equal(1, tropas.GetProperty("emTreino").GetArrayLength());
        Assert.Equal(3, tropas.GetProperty("emTreinoPop").GetInt32());
        var elite = tropas.GetProperty("unidades").EnumerateArray().First(u => u.GetProperty("id").GetString() == "elite");
        Assert.False(string.IsNullOrEmpty(elite.GetProperty("bloqueio").GetString()));
        Assert.Equal(HttpStatusCode.BadRequest, (await c.Post("recrutamento", new { localId = castelo, unidade = "cavalaria", qtd = 1 })).status);

        await s.Avancar(TimeSpan.FromMinutes(40));   // 3 × 12 min
        var (_, r) = await c.Get("reino");
        var guarn = r.GetProperty("locais").EnumerateArray().First(l => l.GetProperty("id").GetInt64() == castelo).GetProperty("guarnicao");
        Assert.Equal(3, guarn.GetProperty("lanceiro").GetInt32());
        Assert.Equal(3, r.GetProperty("tropasResumo").GetProperty("guarnicoes").GetInt32());

        var hexCastelo = r.GetProperty("locais").EnumerateArray().First(l => l.GetProperty("id").GetInt64() == castelo).GetProperty("hex").GetInt32();
        var destino = hexCastelo + 3;   // três hexágonos a leste, na mesma linha
        var (stp, previa) = await c.Post("tropas/previa", new { deLocalId = castelo, tropas = new { lanceiro = 2 }, destinoHex = destino });
        Assert.Equal(HttpStatusCode.OK, stp);
        Assert.True(previa.GetProperty("curta").GetProperty("ok").GetBoolean());

        var (ste, ex) = await c.Post("tropas/enviar", new { deLocalId = castelo, tropas = new { lanceiro = 2 }, destinoHex = destino, ordem = "mover", seguro = false });
        Assert.True(ste == HttpStatusCode.Created, ex.ToString());
        var id = ex.GetProperty("id").GetInt64();
        Assert.Equal("marchando", ex.GetProperty("estado").GetString());
        Assert.Equal("atacarQuemAtacar", ex.GetProperty("postura").GetString());

        await s.Avancar(TimeSpan.FromHours(1));
        (_, tropas) = await c.Get("tropas");
        var emCampo = tropas.GetProperty("exercitos").EnumerateArray().Single();
        Assert.Equal("parado", emCampo.GetProperty("estado").GetString());
        Assert.Equal(destino, emCampo.GetProperty("hex").GetInt32());

        var (stpo, _) = await c.Put("tropas/postura", new { marchaId = id, postura = "apenasDefender" });
        Assert.Equal(HttpStatusCode.OK, stpo);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.Put("tropas/postura", new { todas = true, postura = "fugir" })).status);
        Assert.Equal(HttpStatusCode.OK, (await c.Put("tropas/postura", new { todas = true, postura = "atacarQualquer" })).status);

        var (sto, volta) = await c.Post($"tropas/{id}/ordem", new { ordem = "retornar" });
        Assert.Equal(HttpStatusCode.OK, sto);
        Assert.Equal("retornando", volta.GetProperty("estado").GetString());
        await s.Avancar(TimeSpan.FromHours(1));
        (_, tropas) = await c.Get("tropas");
        Assert.Equal(0, tropas.GetProperty("exercitos").GetArrayLength());
        var cast = tropas.GetProperty("locais").EnumerateArray().First(l => l.GetProperty("id").GetInt64() == castelo);
        Assert.Equal(3, cast.GetProperty("guarnicao").GetProperty("lanceiro").GetInt32());
        Assert.Equal("atacarQualquer", cast.GetProperty("postura").GetString());

        // outro reino não manda no exército alheio
        using var c2 = s.NovoCliente();
        await c2.ContaComReino("fil@exemplo.com", "Lumen");
        Assert.Equal(HttpStatusCode.NotFound, (await c2.Post($"tropas/{id}/ordem", new { ordem = "retornar" })).status);
    }
}
