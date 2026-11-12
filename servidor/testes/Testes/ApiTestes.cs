using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;

namespace ReinoDePedra.Testes;

public class ApiTestes
{
    [Fact]
    public async Task Cadastro_entrada_e_reino()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var c = s.NovoCliente();
        var reino = await c.ContaComReino("ana@exemplo.com", "Pedralva");
        Assert.Equal("Pedralva", reino.GetProperty("nome").GetString());
        Assert.Equal(5, reino.GetProperty("locais").GetArrayLength());
        var (st, conta) = await c.Get("conta");
        Assert.Equal(HttpStatusCode.OK, st);
        Assert.Equal("ana@exemplo.com", conta.GetProperty("email").GetString());

        using var c2 = s.NovoCliente();
        var (st2, _) = await c2.Post("conta/entrar", new { email = "ANA@exemplo.com", senha = "senha muito boa 123" });
        Assert.Equal(HttpStatusCode.OK, st2);
        var (st3, r2) = await c2.Get("reino");
        Assert.Equal(HttpStatusCode.OK, st3);
        Assert.Equal("Pedralva", r2.GetProperty("nome").GetString());
    }

    [Fact]
    public async Task Sem_sessao_e_sem_cabecalho_csrf_recusa()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var anon = s.NovoCliente();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.Get("reino")).status);
        using var c = s.NovoCliente();
        await c.ContaComReino("bia@exemplo.com", "Valdren");
        c.Http.DefaultRequestHeaders.Remove("X-Reino");
        var r = await c.Http.PostAsJsonAsync("obras", new { acao = "melhorar", localId = 1 }, Cliente.J);
        Assert.Equal(HttpStatusCode.Forbidden, r.StatusCode);
    }

    [Fact]
    public async Task Senha_errada_bloqueia_depois_de_5_tentativas()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var c = s.NovoCliente();
        await c.CriarConta("cid@exemplo.com");
        for (var i = 0; i < 5; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await c.Post("conta/entrar", new { email = "cid@exemplo.com", senha = "errada errada" })).status);
        var (st, _) = await c.Post("conta/entrar", new { email = "cid@exemplo.com", senha = "senha muito boa 123" });
        Assert.Equal(HttpStatusCode.TooManyRequests, st);
    }

    [Fact]
    public async Task Senha_curta_e_email_invalido_recusados()
    {
        await using var s = await ServidorTeste.Iniciar();
        var contas = s.App.Services.GetRequiredService<ReinoDePedra.Api.Contas.ServicoContas>();
        var (c1, e1) = await contas.Registrar("x@exemplo.com", "curta");
        Assert.Null(c1); Assert.NotNull(e1);
        var (c2, e2) = await contas.Registrar("nao-e-email", "senha muito boa 123");
        Assert.Null(c2); Assert.NotNull(e2);
    }

    [Fact]
    public async Task Nao_ha_cadastro_aberto_pela_api()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var c = s.NovoCliente();
        Assert.Equal(HttpStatusCode.NotFound, (await c.Post("conta/registrar", new { email = "x@exemplo.com", senha = "senha muito boa 123" })).status);
    }

    [Fact]
    public async Task Obra_pela_api_termina_com_o_tempo()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var c = s.NovoCliente();
        var reino = await c.ContaComReino("dan@exemplo.com", "Mirante");
        var castelo = reino.GetProperty("casteloId").GetInt64();
        var (st, item) = await c.Post("obras", new { acao = "melhorar", localId = castelo });
        Assert.Equal(HttpStatusCode.Created, st);
        await s.Avancar(TimeSpan.FromMinutes(5));
        var (_, r) = await c.Get("reino");
        Assert.Equal(2, r.GetProperty("nivelCastelo").GetInt32());
        var (_, n) = await c.Get("notificacoes");
        Assert.True(n.GetProperty("naoLidas").GetInt32() >= 1);
    }
}
