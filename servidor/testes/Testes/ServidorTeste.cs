using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.DependencyInjection;
using ReinoDePedra.Api;
using ReinoDePedra.Api.Contas;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Nucleo;

namespace ReinoDePedra.Testes;

/// <summary>Servidor de verdade numa porta livre, com banco temporário e relógio falso. Use <see cref="Cliente"/> para falar com ele.</summary>
public sealed class ServidorTeste : IAsyncDisposable
{
    public WebApplication App { get; }
    public RelogioFalso Relogio { get; }
    public string Base { get; }
    private readonly string _dir;
    public Motor Motor => App.Services.GetRequiredService<Motor>();
    /// <summary>Credencial fictícia das rotas do administrador nos testes.</summary>
    public const string AdminToken = "token-de-teste-do-administrador-0123456789";

    private ServidorTeste(WebApplication app, string dir, string b, RelogioFalso r) { App = app; _dir = dir; Base = b; Relogio = r; }

    /// <summary>Sobe o servidor. Sem fauna por padrão (ataques de fauna são sorteios); reinos novos sem os primeiros passos, salvo <paramref name="inicioPronto"/>.</summary>
    public static async Task<ServidorTeste> Iniciar(bool fauna = false, int conexoesPorIp = 0, bool inicioPronto = false, int convitesPorHora = 1000, string adminToken = AdminToken)
    {
        var dir = Path.Combine(Path.GetTempPath(), "rp-srv-" + Guid.NewGuid().ToString("N"));
        var relogio = new RelogioFalso(MundoTeste.Inicio);
        var cfg = new Configuracao { Dados = dir, Urls = "http://127.0.0.1:0", CookieSeguro = false, Semente = 7, IA = false, ConexoesPorIp = conexoesPorIp, AdminToken = adminToken, ConvitesPorHora = convitesPorHora, FeedSemCache = true };
        var app = Servidor.Construir([], cfg, relogio);
        await app.StartAsync();
        if (!fauna) await app.Services.GetRequiredService<Motor>().Executar(m => ReinoDePedra.Jogo.Exploracao.Fauna.Limpar(m));
        if (!inicioPronto) await app.Services.GetRequiredService<Motor>().Executar(m => m.InicioReino = InicioP.Vazio);
        var end = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.First();
        return new ServidorTeste(app, dir, end, relogio);
    }

    /// <summary>Avança o relógio do jogo e espera o motor processar.</summary>
    public async Task Avancar(TimeSpan t)
    {
        var fim = Relogio.Agora + (long)t.TotalMilliseconds;
        await Motor.Executar(m =>
        {
            while (m.Agenda.Proximo(out _, out var q) && q <= fim) { Relogio.Agora = Math.Max(Relogio.Agora, q); m.ProcessarAte(Relogio.Agora); }
            Relogio.Agora = fim; m.ProcessarAte(fim);
        });
    }

    public Cliente NovoCliente() => new(Base, App.Services.GetRequiredService<ServicoContas>());

    /// <summary>Cliente HTTP com a credencial do administrador.</summary>
    public Cliente NovoAdmin()
    {
        var c = NovoCliente();
        c.Http.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", AdminToken);
        return c;
    }

    public async ValueTask DisposeAsync()
    {
        await App.StopAsync();
        await App.DisposeAsync();
        try { Directory.Delete(_dir, true); } catch { }
    }
}

/// <summary>Cliente HTTP com cookies, que manda o cabeçalho anti-CSRF como o navegador do jogo.</summary>
public sealed class Cliente : IDisposable
{
    public HttpClient Http { get; }
    public static readonly JsonSerializerOptions J = new(JsonSerializerDefaults.Web);
    private readonly ServicoContas? _contas;
    public Cliente(string b, ServicoContas? contas = null)
    {
        _contas = contas;
        Http = new HttpClient(new HttpClientHandler { CookieContainer = new CookieContainer(), UseCookies = true }) { BaseAddress = new Uri(b + "/api/v1/") };
        Http.DefaultRequestHeaders.Add("X-Reino", "1");
    }
    public async Task<(HttpStatusCode status, JsonElement corpo)> Post(string url, object? corpo = null)
    {
        var r = await Http.PostAsJsonAsync(url, corpo ?? new { }, J);
        return (r.StatusCode, await Ler(r));
    }
    public async Task<(HttpStatusCode status, JsonElement corpo)> Put(string url, object? corpo = null)
    {
        var r = await Http.PutAsJsonAsync(url, corpo ?? new { }, J);
        return (r.StatusCode, await Ler(r));
    }
    public async Task<(HttpStatusCode status, JsonElement corpo)> Get(string url)
    {
        var r = await Http.GetAsync(url);
        return (r.StatusCode, await Ler(r));
    }
    private static async Task<JsonElement> Ler(HttpResponseMessage r)
    {
        var s = await r.Content.ReadAsStringAsync();
        return string.IsNullOrWhiteSpace(s) ? default : JsonDocument.Parse(s).RootElement.Clone();
    }
    /// <summary>Cria a conta direto no serviço (o caminho do convite tem testes próprios) e entra com ela.</summary>
    public async Task<(HttpStatusCode status, JsonElement corpo)> CriarConta(string email, string senha = "senha muito boa 123")
    {
        var (c, erro) = await _contas!.Registrar(email, senha);
        if (c == null) throw new Exception("conta falhou: " + erro);
        return await Post("conta/entrar", new { email, senha });
    }

    /// <summary>Cria uma conta e funda um reino. Devolve o estado do reino.</summary>
    public async Task<JsonElement> ContaComReino(string email, string nome)
    {
        var (s1, _) = await CriarConta(email);
        if (s1 != HttpStatusCode.OK) throw new Exception("entrada falhou: " + s1);
        var (s2, reino) = await Post("reino", new { nome, brasao = new { forma = "portugues", divisao = "cortado", cor1 = "azul", cor2 = "vermelho", simbolo = "torre", corSimbolo = "ouro" } });
        if (s2 != HttpStatusCode.Created) throw new Exception("reino falhou: " + s2 + " " + reino);
        return reino;
    }
    public void Dispose() => Http.Dispose();
}
