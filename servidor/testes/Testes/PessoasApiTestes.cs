using System.Net;
using System.Text.Json;

namespace ReinoDePedra.Testes;

public class PessoasApiTestes
{
    [Fact]
    public async Task Lista_folha_trocar_trabalho_e_levar_pela_api()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var c = s.NovoCliente();
        var reino = await c.ContaComReino("pessoas@exemplo.com", "Pedralva");
        var castelo = reino.GetProperty("casteloId").GetInt64();
        Assert.Equal(8, reino.GetProperty("pessoas").GetInt32());
        Assert.Equal(4, reino.GetProperty("trabalhando").GetInt32());

        var (st, lista) = await c.Get("reino/pessoas");
        Assert.Equal(HttpStatusCode.OK, st);
        var pessoas = lista.GetProperty("pessoas").EnumerateArray().ToList();
        Assert.Equal(8, pessoas.Count);
        Assert.All(pessoas, p => Assert.False(string.IsNullOrEmpty(p.GetProperty("nome").GetString())));
        var ocioso = pessoas.First(p => p.GetProperty("oficio").GetString() == "ocioso");
        Assert.Equal("Sem ofício", ocioso.GetProperty("oficioNome").GetString());
        Assert.StartsWith("Sem trabalho", ocioso.GetProperty("texto").GetString());
        var lenhador = pessoas.First(p => p.GetProperty("oficio").GetString() == "lenhador");
        Assert.StartsWith("Cortando madeira em ", lenhador.GetProperty("texto").GetString());
        var serraria = lista.GetProperty("locais").EnumerateArray().First(l => l.GetProperty("tipo").GetString() == "serraria");
        Assert.Equal(1, serraria.GetProperty("vagas").GetInt32());
        Assert.Equal(0, serraria.GetProperty("livres").GetInt32());

        var id = ocioso.GetProperty("id").GetInt64();
        var (stf, folha) = await c.Get("pessoas/" + id);
        Assert.Equal(HttpStatusCode.OK, stf);
        Assert.Equal(id, folha.GetProperty("pessoa").GetProperty("id").GetInt64());
        Assert.Contains("trabalho", folha.GetProperty("acoes").EnumerateArray().Select(a => a.GetString()));
        // sem vaga livre em lugar nenhum: só o castelo (sem trabalho) aparece como opção
        Assert.All(folha.GetProperty("trabalhos").EnumerateArray(), t => Assert.True(t.GetProperty("livres").GetInt32() > 0 || t.GetProperty("oficio").GetString() == "ocioso"));
        Assert.Equal(HttpStatusCode.NotFound, (await c.Get("pessoas/999999")).status);

        // a lenhadora vai para o castelo; o ocioso toma a vaga dela e caminha até a serraria
        var sid = serraria.GetProperty("id").GetInt64();
        var (stm, _) = await c.Post("pessoas/" + lenhador.GetProperty("id").GetInt64() + "/mover", new { localId = castelo });
        Assert.Equal(HttpStatusCode.OK, stm);
        var (stt, depois) = await c.Post("pessoas/" + id + "/trabalho", new { localId = sid });
        Assert.Equal(HttpStatusCode.OK, stt);
        var p2 = depois.GetProperty("pessoa");
        Assert.Equal("andando", p2.GetProperty("estado").GetString());
        Assert.Equal("lenhador", p2.GetProperty("oficio").GetString());
        Assert.True(p2.GetProperty("chegada").GetInt64() > 0);
        Assert.StartsWith("Andando para ", p2.GetProperty("texto").GetString());
        var (_, r2) = await c.Get("reino");
        Assert.Contains(r2.GetProperty("marchas").EnumerateArray(), x => x.GetProperty("tipo").GetString() == "pessoas" && x.GetProperty("pessoas").GetInt32() == 1);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.Post("pessoas/" + id + "/trabalho", new { localId = castelo, oficio = "lenhador" })).status);

        await s.Avancar(TimeSpan.FromHours(1));
        var (_, f3) = await c.Get("pessoas/" + id);
        Assert.Equal("trabalhando", f3.GetProperty("pessoa").GetProperty("estado").GetString());
        Assert.Equal(sid, f3.GetProperty("pessoa").GetProperty("localId").GetInt64());
    }
}
