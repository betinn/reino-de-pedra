using System.Net;
using Microsoft.Extensions.DependencyInjection;
using ReinoDePedra.Jogo.Persistencia;
using ReinoDePedra.Jogo.Temporada;

namespace ReinoDePedra.Testes;

/// <summary>API da temporada, do legado, do ranking e do "precisa de você", e o reset com o banco de verdade.</summary>
public class TemporadaApiTestes
{
    [Fact]
    public async Task Temporada_ranking_e_agora_pela_api()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var c = s.NovoCliente();
        await c.ContaComReino("temp@exemplo.test", "Pedralva");
        var (st, t) = await c.Get("temporada");
        Assert.Equal(HttpStatusCode.OK, st);
        Assert.Equal(1, t.GetProperty("numero").GetInt32());
        Assert.Equal(1, t.GetProperty("linhagem").GetProperty("nivel").GetInt32());
        Assert.Equal(1, t.GetProperty("linhagem").GetProperty("diasAtivos").GetInt32());   // abriu o jogo hoje
        Assert.Equal(3, t.GetProperty("conquistas").GetArrayLength());
        Assert.False(t.GetProperty("brasao").GetProperty("extras").GetBoolean());

        var (sr, rk) = await c.Get("ranking");
        Assert.Equal(HttpStatusCode.OK, sr);
        var baixas = rk.GetProperty("categorias").GetProperty("baixas");
        Assert.True(baixas.GetProperty("eu").GetProperty("meu").GetBoolean());
        Assert.False(baixas.GetProperty("top")[0].TryGetProperty("id", out _));   // sem ids de reino no ranking
        Assert.False(rk.ToString().Contains("contaId", StringComparison.OrdinalIgnoreCase));

        var (sa, ag) = await c.Get("agora");
        Assert.Equal(HttpStatusCode.OK, sa);
        Assert.Contains(ag.GetProperty("itens").EnumerateArray(), x => x.GetProperty("titulo").GetString() == "Nada sendo recrutado");
        var (_, ag3) = await c.Get("agora?n=3");
        Assert.True(ag3.GetProperty("itens").GetArrayLength() <= 3);

        // região inicial só no nível 5
        using var c2 = s.NovoCliente();
        await c2.CriarConta("regiao@exemplo.test");
        var (sx, ex) = await c2.Post("reino", new { nome = "Ventania", regiao = "norte", brasao = new { forma = "portugues", divisao = "cortado", cor1 = "azul", cor2 = "vermelho", simbolo = "torre", corSimbolo = "ouro" } });
        Assert.Equal(HttpStatusCode.BadRequest, sx);
        Assert.Contains("nível 5", ex.GetProperty("erro").GetString());
    }

    [Fact]
    public async Task Reset_apaga_o_mundo_do_banco_e_mantem_contas_e_legado()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var c = s.NovoCliente();
        await c.ContaComReino("reset@exemplo.test", "Pedralva");
        await c.Get("reino");
        await s.Motor.Executar(m => Temporadas.Encerrar(m));
        var banco = s.App.Services.GetRequiredService<Banco>();
        Assert.Equal(0, banco.Escalar<long>("SELECT COUNT(*) FROM docs WHERE colecao='reinos'"));
        Assert.Equal(1, banco.Escalar<long>("SELECT COUNT(*) FROM docs WHERE colecao='estado'"));
        Assert.True(banco.Escalar<long>("SELECT COUNT(*) FROM legado") >= 1);
        Assert.Contains("\"NumeroTemporada\":2", banco.Escalar<string>("SELECT dados FROM docs WHERE colecao='estado'"));
        // a conta segue logada, sem reino; o legado guardou a temporada
        var (sc, _) = await c.Get("conta");
        Assert.Equal(HttpStatusCode.OK, sc);
        var (sr, _) = await c.Get("reino");
        Assert.Equal(HttpStatusCode.NotFound, sr);
        var (_, t) = await c.Get("temporada");
        Assert.Equal(2, t.GetProperty("numero").GetInt32());
        Assert.Equal(1, t.GetProperty("historico")[0].GetProperty("temporada").GetInt32());
        Assert.Equal("Temporada 1", t.GetProperty("brasoes")[0].GetProperty("nome").GetString());
        // funda o reino na temporada nova
        var (sn, _) = await c.Post("reino", new { nome = "Pedralva", brasao = new { forma = "portugues", divisao = "cortado", cor1 = "azul", cor2 = "vermelho", simbolo = "torre", corSimbolo = "ouro" } });
        Assert.Equal(HttpStatusCode.Created, sn);
        var (_, mundo) = await c.Get("mundo");
        Assert.Equal(2, mundo.GetProperty("temporada").GetInt32());
    }
}
