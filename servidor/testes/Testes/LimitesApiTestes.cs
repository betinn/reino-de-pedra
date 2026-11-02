using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using ReinoDePedra.Api.Contas;
using ReinoDePedra.Jogo.Nucleo;

namespace ReinoDePedra.Testes;

/// <summary>Limites de operação: requisições, conexões SSE, fila de hash de senha e parada com SSE aberto.</summary>
public class LimitesApiTestes
{
    [Fact]
    public async Task Arquivos_estaticos_nao_gastam_o_limite_da_api()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var http = new HttpClient { BaseAddress = new Uri(s.Base) };
        // vários carregamentos do cliente seguidos (mesmo IP): nenhum arquivo volta 429
        var r = await Task.WhenAll(Enumerable.Range(0, 200).Select(_ => http.GetAsync("/js/api.js")));
        Assert.All(r, x => Assert.Equal(HttpStatusCode.OK, x.StatusCode));
        using var c = s.NovoCliente();
        await c.ContaComReino("ana@exemplo.com", "Pedralva");
        Assert.Equal(HttpStatusCode.OK, (await c.Get("conta")).status);
    }

    [Fact]
    public async Task Varios_jogadores_no_mesmo_ip_usam_a_api_normalmente()
    {
        await using var s = await ServidorTeste.Iniciar();
        var cs = new List<Cliente>();
        for (var i = 0; i < 3; i++) { var c = s.NovoCliente(); await c.ContaComReino($"j{i}@exemplo.com", "Reino " + "ABC"[i]); cs.Add(c); }
        // cada um abre o jogo (rajada de pedidos leves): o IP compartilhado não barra ninguém
        var r = await Task.WhenAll(cs.SelectMany(c => Enumerable.Range(0, 40).Select(_ => c.Get("conta"))));
        Assert.All(r, x => Assert.Equal(HttpStatusCode.OK, x.status));
        foreach (var c in cs) c.Dispose();
    }

    [Fact]
    public async Task Rotas_pesadas_tem_limite_por_sessao_sem_barrar_os_outros()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var a = s.NovoCliente();
        await a.ContaComReino("a@exemplo.com", "Pedralva");
        using var b = s.NovoCliente();
        await b.ContaComReino("b@exemplo.com", "Valdren");
        var r = await Task.WhenAll(Enumerable.Range(0, 60).Select(_ => a.Get("mapa")));
        Assert.Contains(r, x => x.status == HttpStatusCode.TooManyRequests);
        Assert.Contains(r, x => x.status == HttpStatusCode.OK);
        Assert.Equal(HttpStatusCode.OK, (await b.Get("mapa")).status);
    }

    private static async Task<(HttpResponseMessage resp, Stream corpo)> AbrirSse(Cliente c)
    {
        var resp = await c.Http.GetAsync("eventos", HttpCompletionOption.ResponseHeadersRead);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var corpo = await resp.Content.ReadAsStreamAsync();
        var buf = new byte[256];
        _ = await corpo.ReadAsync(buf);   // "ola"
        return (resp, corpo);
    }

    private static async Task<int> Conexoes(ServidorTeste s)
    {
        using var c = s.NovoCliente();
        return (await c.Get("saude")).corpo.GetProperty("conexoes").GetInt32();
    }

    [Fact]
    public async Task Conexoes_sse_por_conta_tem_teto_e_a_mais_antiga_fecha()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var c = s.NovoCliente();
        await c.ContaComReino("ana@exemplo.com", "Pedralva");
        var abertas = new List<(HttpResponseMessage, Stream)>();
        for (var i = 0; i < 5; i++) abertas.Add(await AbrirSse(c));
        Assert.Equal(3, await Conexoes(s));
        // a primeira foi fechada pelo servidor: a leitura termina
        using var t = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        var buf = new byte[256];
        int n;
        while ((n = await abertas[0].Item2.ReadAsync(buf, t.Token)) > 0) { }
        Assert.Equal(0, n);
        foreach (var (r, _) in abertas) r.Dispose();
    }

    [Fact]
    public async Task Parar_o_servidor_com_sse_aberto_fecha_as_conexoes_logo()
    {
        var s = await ServidorTeste.Iniciar();
        using var c = s.NovoCliente();
        await c.ContaComReino("ana@exemplo.com", "Pedralva");
        var (resp, _) = await AbrirSse(c);
        var w = Stopwatch.StartNew();
        await s.DisposeAsync();
        Assert.True(w.Elapsed < TimeSpan.FromSeconds(10), "parada levou " + w.Elapsed);
        resp.Dispose();
    }

    [Fact]
    public async Task Fila_de_hash_cheia_recusa_na_hora_com_429()
    {
        var fila = new FilaHash(simultaneos: 1, espera: 2);
        using var solta = new SemaphoreSlim(0);
        var presos = Enumerable.Range(0, 3).Select(_ => fila.Rodar(() => { solta.Wait(); return 1; })).ToList();   // 1 rodando, 2 esperando
        await Task.Delay(100);
        var w = Stopwatch.StartNew();
        var e = await Assert.ThrowsAsync<RegraException>(() => fila.Rodar(() => 1));
        Assert.Equal(429, e.Status);
        Assert.True(w.Elapsed < TimeSpan.FromSeconds(1));
        solta.Release(3);
        var res = await Task.WhenAll(presos);
        Assert.Equal(new[] { 1, 1, 1 }, res);
        Assert.Equal(1, await fila.Rodar(() => 1));   // vagou: volta a aceitar
    }

    [Fact]
    public async Task Conexoes_por_ip_tem_teto()
    {
        await using var s = await ServidorTeste.Iniciar(conexoesPorIp: 5);
        var u = new Uri(s.Base);
        var abertas = new List<TcpClient>();
        for (var i = 0; i < 5; i++) { var t = new TcpClient(); await t.ConnectAsync(u.Host, u.Port); abertas.Add(t); }
        await Task.Delay(200);
        using var extra = new TcpClient();
        await extra.ConnectAsync(u.Host, u.Port);
        var st = extra.GetStream();
        await st.WriteAsync("GET /api/v1/saude HTTP/1.1\r\nHost: x\r\n\r\n"u8.ToArray());
        using var tempo = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        var buf = new byte[512];
        int n;
        try { n = await st.ReadAsync(buf, tempo.Token); } catch (IOException) { n = 0; }
        Assert.Equal(0, n);   // fechada sem resposta
        foreach (var t in abertas) t.Dispose();
    }
}
