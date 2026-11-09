using System.Net;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using ReinoDePedra.Api.Contas;
using ReinoDePedra.Api.Publico;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Persistencia;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Testes;

/// <summary>O feed sem login e o que o jogador recebe de outro reino: só o público, nunca o segredo.</summary>
public class MapaPublicoTestes
{
    public MapaPublicoTestes() => AjustesTeste.Garantir();

    /// <summary>Nomes de campo que nunca podem sair no feed público (nem aninhados).</summary>
    private static readonly string[] Proibidos =
    [
        "tropas", "tamanho", "resumo", "pessoas", "pessoaIds", "destino", "destinoNome", "alvo", "alvoId", "ordem", "plano", "objetivos", "carga", "cargaMax", "cargaUsada",
        "estado", "chegada", "retornando", "paraMim", "estoque", "guarnicao", "civis", "milicia", "soldados", "jazida", "recurso", "restante", "esgotada",
        "escudo", "escudoAte", "regencia", "ultimoAcesso", "ehIA", "ia", "perfil", "email", "contaId", "mensagem", "proposta", "conversa", "convites",
        "pagamento", "tiposReliquia", "cargo", "postura", "bonus", "forca",
    ];

    private static void SemCampos(JsonElement e, string[] proibidos, string caminho = "$")
    {
        switch (e.ValueKind)
        {
            case JsonValueKind.Object:
                foreach (var p in e.EnumerateObject())
                {
                    Assert.False(proibidos.Contains(p.Name), "campo proibido " + caminho + "." + p.Name);
                    SemCampos(p.Value, proibidos, caminho + "." + p.Name);
                }
                break;
            case JsonValueKind.Array:
                var i = 0;
                foreach (var x in e.EnumerateArray()) SemCampos(x, proibidos, caminho + "[" + i++ + "]");
                break;
        }
    }

    /// <summary>Dois reinos e uma marcha de ataque longa de A para a mina de B. Devolve os dois clientes e o hexágono do destino.</summary>
    private static async Task<(Cliente a, Cliente d, int destino, long marcha)> Ataque(ServidorTeste s)
    {
        var a = s.NovoCliente();
        var d = s.NovoCliente();
        var ra = await a.ContaComReino("ana@exemplo.com", "Pedralva");
        var rd = await d.ContaComReino("bia@exemplo.com", "Valdren");
        var casteloA = ra.GetProperty("casteloId").GetInt64();
        var alvo = rd.GetProperty("locais").EnumerateArray().First(l => l.GetProperty("tipo").GetString() == "mina").GetProperty("hex").GetInt32();
        await s.Motor.Executar(m =>
        {
            var def = m.Reinos.Single(r => r.Nome == "Valdren");
            def.EscudoAte = 0; m.Sujar(def);
            var c = m.Locais[casteloA];
            c.Guarnicao["cavalaria"] = 20; m.Sujar(c);
        });
        var (se, ex) = await a.Post("ataques", new { deLocalId = casteloA, tropas = new { cavalaria = 20 }, destinoHex = alvo, tipo = "saque", tatica = "media", recuarVazio = false });
        Assert.True(se == HttpStatusCode.Created, ex.ToString());
        return (a, d, alvo, ex.GetProperty("id").GetInt64());
    }

    [Fact]
    public async Task Feed_publico_nao_leva_segredo_e_marcha_nao_diz_tamanho_nem_destino()
    {
        await using var s = await ServidorTeste.Iniciar();
        var (a, d, destino, marcha) = await Ataque(s);
        using (a) using (d)
        {
            // a marcha no meio do caminho, longe do destino
            var (caminho, fim) = await s.Motor.Executar(m => (m.Marchas[marcha].Caminho.ToList(), m.Marchas[marcha].Chegada));
            Assert.True(caminho.Count > 4, "o caminho de teste é curto demais");
            await s.Avancar(TimeSpan.FromMilliseconds((fim - s.Relogio.Agora) / 3));
            using var v = s.NovoCliente();
            var (s1, vivo) = await v.Get("publico/vivo");
            Assert.Equal(HttpStatusCode.OK, s1);
            SemCampos(vivo, Proibidos);
            var mx = vivo.GetProperty("marchas").EnumerateArray().Single(x => x.GetProperty("id").GetInt64() == marcha);
            var cm = mx.GetProperty("caminho").EnumerateArray().Select(x => x.GetInt32()).ToList();
            Assert.Equal(2, cm.Count);
            Assert.DoesNotContain(destino, cm);
            Assert.Equal(2, mx.GetProperty("tempos").GetArrayLength());
            var (s2, mundo) = await v.Get("publico/mundo");
            Assert.Equal(HttpStatusCode.OK, s2);
            SemCampos(mundo, Proibidos.Where(x => x is not "tropas").ToArray());   // "tropas" é o total do ranking, público
            foreach (var l in mundo.GetProperty("locais").EnumerateArray()) Assert.False(l.TryGetProperty("tropas", out _));
            foreach (var r in mundo.GetProperty("ranking").EnumerateArray())
                Assert.Equal(new[] { "baixas", "familias", "perdas", "reinoId", "tropas" }, r.EnumerateObject().Select(p => p.Name).OrderBy(x => x, StringComparer.Ordinal));
            var (s3, chao) = await v.Get("publico/chao");
            Assert.Equal(HttpStatusCode.OK, s3);
            Assert.Equal(new[] { "cols", "lins", "pontes", "rotas", "terreno" }, chao.EnumerateObject().Select(p => p.Name).OrderBy(x => x, StringComparer.Ordinal));
            // nenhum e-mail e nenhuma jazida no texto inteiro
            foreach (var t in new[] { vivo.ToString(), mundo.ToString() }) { Assert.DoesNotContain("@exemplo.com", t); Assert.DoesNotContain("jazida", t); }
        }
    }

    [Fact]
    public async Task Feed_mostra_reino_nivel_e_relíquia_sem_o_tipo()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var a = s.NovoCliente();
        var ra = await a.ContaComReino("ana@exemplo.com", "Pedralva");
        var castelo = ra.GetProperty("casteloId").GetInt64();
        await s.Motor.Executar(m => { var r = m.Reliquias.Adicionar(new Reliquia { Nome = "Olho do Corvo", Tipo = "ataque", ReinoId = m.Locais[castelo].ReinoId }); Reliquias.Guardar(m, r, m.Locais[castelo]); });
        using var v = s.NovoCliente();
        var (_, mundo) = await v.Get("publico/mundo");
        var r = mundo.GetProperty("reinos").EnumerateArray().Single(x => x.GetProperty("nome").GetString() == "Pedralva");
        var c = mundo.GetProperty("locais").EnumerateArray().Single(l => l.GetProperty("id").GetInt64() == castelo);
        Assert.Equal(r.GetProperty("id").GetInt64(), c.GetProperty("reinoId").GetInt64());
        Assert.True(c.GetProperty("nivel").GetInt32() >= 1);
        Assert.Equal(1, c.GetProperty("reliquias").GetInt32());
        Assert.DoesNotContain("Olho do Corvo", mundo.ToString());
        Assert.DoesNotContain("\"ataque\"", mundo.ToString());
    }

    [Fact]
    public async Task Regencia_escudo_e_ia_nao_mudam_o_feed()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var a = s.NovoCliente();
        await a.ContaComReino("ana@exemplo.com", "Pedralva");
        using var v = s.NovoCliente();
        var (_, antes) = await v.Get("publico/mundo");
        await s.Motor.Executar(m =>
        {
            var r = m.Reinos.Single(x => x.Nome == "Pedralva");
            r.ContaId = null; r.EscudoAte = m.Agora + 999_999; r.UltimoAcesso = 1; m.Sujar(r);
        });
        var (_, depois) = await v.Get("publico/mundo");
        var reino = (JsonElement x) => x.GetProperty("reinos").EnumerateArray().Single(y => y.GetProperty("nome").GetString() == "Pedralva").ToString();
        Assert.Equal(reino(antes), reino(depois));
    }

    [Fact]
    public async Task Jogador_ve_marcha_de_outro_reino_sem_tamanho_nem_destino_mesmo_atacado()
    {
        await using var s = await ServidorTeste.Iniciar();
        var (a, d, destino, marcha) = await Ataque(s);
        using (a) using (d)
        {
            var fim = await s.Motor.Executar(m => m.Marchas[marcha].Chegada);
            await s.Avancar(TimeSpan.FromMilliseconds((fim - s.Relogio.Agora) / 3));
            var (st, mapa) = await d.Get("mapa");
            Assert.Equal(HttpStatusCode.OK, st);
            var mx = mapa.GetProperty("objetos").EnumerateArray().Single(o => o.GetProperty("tipo").GetString() == "marcha" && o.GetProperty("id").GetInt64() == marcha);
            SemCampos(mx, Proibidos);
            Assert.Equal("outro", mx.GetProperty("dono").GetString());
            var cm = mx.GetProperty("caminho").EnumerateArray().Select(x => x.GetInt32()).ToList();
            Assert.Equal(2, cm.Count);
            Assert.DoesNotContain(destino, cm);
            // a dica do que fazer também não pode entregar o destino
            var (_, agora) = await d.Get("agora");
            Assert.DoesNotContain("a caminho", agora.ToString());
            var (_, reino) = await d.Get("notificacoes");
            Assert.DoesNotContain("a caminho", reino.ToString());
        }
    }

    [Fact]
    public async Task Jogador_ve_local_de_outro_reino_na_nevoa_sem_o_que_ha_dentro()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var a = s.NovoCliente();
        using var d = s.NovoCliente();
        await a.ContaComReino("ana@exemplo.com", "Pedralva");
        var rd = await d.ContaComReino("bia@exemplo.com", "Valdren");
        var (_, mapa) = await a.Get("mapa");
        Assert.DoesNotContain('?', mapa.GetProperty("terreno").GetString()!);
        var castelo = rd.GetProperty("casteloId").GetInt64();
        var o = mapa.GetProperty("objetos").EnumerateArray().Single(x => x.GetProperty("tipo").GetString() == "local" && x.GetProperty("id").GetInt64() == castelo);
        Assert.Equal("outro", o.GetProperty("dono").GetString());
        Assert.True(o.GetProperty("nivel").GetInt32() >= 1);
        SemCampos(o, Proibidos);
        var dono = o.GetProperty("reinoId").GetInt64().ToString();
        Assert.Equal("Valdren", mapa.GetProperty("reinos").GetProperty(dono).GetProperty("nome").GetString());
        Assert.DoesNotContain("\"ehIA\"", mapa.ToString(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Pessoas_a_vista_nunca_vem_com_a_contagem_exata()
    {
        await using var s = await ServidorTeste.Iniciar(inicioPronto: true);
        using var a = s.NovoCliente();
        await a.ContaComReino("ana@exemplo.com", "Pedralva");
        using var d = s.NovoCliente();
        var rd = await d.ContaComReino("bia@exemplo.com", "Valdren");
        var c = rd.GetProperty("casteloId").GetInt64();
        await s.Motor.Executar(m =>
        {
            var eu = m.Reinos.Single(r => r.Nome == "Pedralva");
            var castelo = m.Locais[c];
            var linha = JsonSerializer.SerializeToElement(ReinoDePedra.Api.Visoes.VisaoMapa.PessoasOutras(m, eu, new HashSet<int> { castelo.Hex }), Cliente.J).EnumerateArray().Single();
            var civis = ReinoDePedra.Jogo.Pessoas.Pessoas.Presentes(m, castelo).Count();
            var soldados = ReinoDePedra.Jogo.Pessoas.Pessoas.Guarnicao(m, castelo).Count();
            Assert.True(soldados > 0);
            Assert.Equal(Avistamentos.Arredondado(m, civis), linha.GetProperty("civis").GetInt32());
            Assert.Equal(Avistamentos.Arredondado(m, soldados), linha.GetProperty("soldados").GetInt32());
            Assert.Equal(new[] { 3, 5, 10, 15, 20 }.Contains(linha.GetProperty("soldados").GetInt32()), true);
        });
    }

    [Fact]
    public async Task Mensagens_globais_dizem_as_perdas_sem_revelar_o_resto()
    {
        await using var s = await ServidorTeste.Iniciar();
        var (a, d, _, marcha) = await Ataque(s);
        using (a) using (d)
        {
            var fim = await s.Motor.Executar(m => m.Marchas[marcha].Chegada);
            await s.Avancar(TimeSpan.FromMilliseconds(fim - s.Relogio.Agora + 1));
            using var v = s.NovoCliente();
            var (_, vivo) = await v.Get("publico/vivo");
            var msgs = vivo.GetProperty("mensagens").EnumerateArray().ToList();
            Assert.Contains(msgs, x => x.GetProperty("texto").GetString()!.Contains("Reino Pedralva ataca Reino Valdren"));
            var bat = vivo.GetProperty("batalhas").EnumerateArray().Single();
            SemCampos(bat, Proibidos);
            Assert.DoesNotContain("saque", vivo.ToString());
            await s.Avancar(TimeSpan.FromHours(1));
            (_, vivo) = await v.Get("publico/vivo");
            var t = vivo.GetProperty("mensagens").EnumerateArray().First(x => x.GetProperty("tipo").GetString() == "fim-batalha");
            Assert.Matches(@"^Reino Pedralva perdeu \d+ tropas? na batalha em .+\. Reino Valdren perdeu \d+ tropas?\.$", t.GetProperty("texto").GetString()!);
            Assert.DoesNotContain("20", t.GetProperty("texto").GetString()!);
            SemCampos(t, Proibidos);
        }
    }

    [Fact]
    public async Task Feed_nao_passa_pelo_motor_a_cada_visitante()
    {
        await using var s = await ServidorTeste.Iniciar();
        var feed = new FeedPublico(s.Motor, new ReinoDePedra.Api.Configuracao());
        var f1 = await feed.Obter(feed.Vivo);
        var comandos = s.Motor.ComandosExecutados;
        for (var i = 0; i < 200; i++) Assert.Same(f1, await feed.Obter(feed.Vivo));
        Assert.Equal(comandos, s.Motor.ComandosExecutados);
    }

    [Fact]
    public async Task Pacto_publico_recusa_o_envio_e_aparece_no_feed()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var a = s.NovoCliente();
        using var d = s.NovoCliente();
        var ra = await a.ContaComReino("ana@exemplo.com", "Pedralva");
        var rd = await d.ContaComReino("bia@exemplo.com", "Valdren");
        var casteloA = ra.GetProperty("casteloId").GetInt64();
        var alvo = rd.GetProperty("locais").EnumerateArray().First().GetProperty("hex").GetInt32();
        await s.Motor.Executar(m =>
        {
            var x = m.Reinos.Single(r => r.Nome == "Pedralva"); var y = m.Reinos.Single(r => r.Nome == "Valdren");
            y.EscudoAte = 0; m.Sujar(y);
            m.Pactos.Adicionar(new Pacto { AId = x.Id, BId = y.Id, Dias = 3, Estado = Comercio.Ativo, Inicio = m.Agora, Fim = m.Agora + 999_999_999 });
            var c = m.Locais[casteloA]; c.Guarnicao["cavalaria"] = 5; m.Sujar(c);
        });
        var (st, corpo) = await a.Post("ataques", new { deLocalId = casteloA, tropas = new { cavalaria = 5 }, destinoHex = alvo, tipo = "saque" });
        Assert.Equal(HttpStatusCode.BadRequest, st);
        Assert.Contains("pacto", corpo.ToString());
        using var v = s.NovoCliente();
        var (_, mundo) = await v.Get("publico/mundo");
        Assert.Single(mundo.GetProperty("pactos").EnumerateArray());
    }
}

/// <summary>A fila de pedidos e o link de uso único: a única forma de nascer uma conta.</summary>
public class ConvitesTestes
{
    public ConvitesTestes() => AjustesTeste.Garantir();

    private static readonly object Brasao = new { forma = "portugues", divisao = "cortado", cor1 = "azul", cor2 = "vermelho", simbolo = "torre", corSimbolo = "ouro" };
    private const string Senha = "senha muito boa 123";

    private static async Task<(long id, string token)> Link(ServidorTeste s, string email)
    {
        using var v = s.NovoCliente();
        Assert.Equal(HttpStatusCode.Accepted, (await v.Post("convites/pedir", new { email })).status);
        using var adm = s.NovoAdmin();
        var (_, fila) = await adm.Get("admin/convites");
        var id = fila.EnumerateArray().Single(x => x.GetProperty("email").GetString() == email).GetProperty("id").GetInt64();
        var (sl, l) = await adm.Post("admin/convites/" + id + "/link");
        Assert.True(sl == HttpStatusCode.Created, l.ToString());
        Assert.Contains("/#/convite/" + l.GetProperty("token").GetString(), l.GetProperty("link").GetString());
        return (id, l.GetProperty("token").GetString()!);
    }

    [Fact]
    public async Task Nao_ha_cadastro_aberto()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var c = s.NovoCliente();
        var (st, _) = await c.Post("conta/registrar", new { email = "x@exemplo.com", senha = Senha });
        Assert.True(st is HttpStatusCode.NotFound or HttpStatusCode.MethodNotAllowed, st.ToString());
        Assert.False(s.App.Services.GetRequiredService<ServicoContas>().TemConta("x@exemplo.com"));
    }

    [Fact]
    public async Task Pedido_vira_link_que_funda_uma_vez_e_falha_na_segunda()
    {
        await using var s = await ServidorTeste.Iniciar();
        var (_, token) = await Link(s, "novo@exemplo.com");
        using var c = s.NovoCliente();
        var (sv, val) = await c.Post("convites/validar", new { token });
        Assert.Equal(HttpStatusCode.OK, sv);
        Assert.Equal("n***@exemplo.com", val.GetProperty("email").GetString());
        var (sf, cf) = await c.Post("convites/fundar", new { token, senha = Senha, nome = "Pedralva", brasao = Brasao });
        Assert.True(sf == HttpStatusCode.Created, cf.ToString());
        var (_, reino) = await c.Get("reino");   // a sessão já vale
        Assert.Equal("Pedralva", reino.GetProperty("nome").GetString());
        using var outro = s.NovoCliente();
        Assert.Equal(HttpStatusCode.Gone, (await outro.Post("convites/fundar", new { token, senha = Senha, nome = "Valdren", brasao = Brasao })).status);
        Assert.Equal(HttpStatusCode.Gone, (await outro.Post("convites/validar", new { token })).status);
        Assert.Equal(1, await s.Motor.Executar(m => m.Reinos.Count(r => r.Ativo)));
        Assert.Equal(HttpStatusCode.OK, (await outro.Post("conta/entrar", new { email = "novo@exemplo.com", senha = Senha })).status);
    }

    [Fact]
    public async Task Duas_aberturas_simultaneas_fundam_um_reino_so()
    {
        await using var s = await ServidorTeste.Iniciar();
        var (_, token) = await Link(s, "gemeos@exemplo.com");
        var clientes = Enumerable.Range(0, 6).Select(_ => s.NovoCliente()).ToList();
        var r = await Task.WhenAll(clientes.Select((c, i) => c.Post("convites/fundar", new { token, senha = Senha, nome = "Reino " + "ABCDEF"[i], brasao = Brasao })));
        Assert.Equal(1, r.Count(x => x.status == HttpStatusCode.Created));
        // os outros recebem "link usado" ou, com a fila de hash cheia, "tente de novo"; nenhum deles funda
        Assert.All(r.Where(x => x.status != HttpStatusCode.Created), x => Assert.True(x.status is HttpStatusCode.Gone or (HttpStatusCode)429, x.status.ToString()));
        Assert.Equal(1, await s.Motor.Executar(m => m.Reinos.Count(x => x.Ativo)));
        clientes.ForEach(c => c.Dispose());
    }

    [Fact]
    public async Task Token_fica_so_como_hash_e_a_listagem_nao_o_mostra()
    {
        await using var s = await ServidorTeste.Iniciar();
        var (id, token) = await Link(s, "hash@exemplo.com");
        var banco = s.App.Services.GetRequiredService<Banco>();
        var guardado = banco.Consultar("SELECT token_hash FROM convites WHERE id=$i", rd => (byte[])rd[0], ("$i", id)).Single();
        Assert.Equal(32, guardado.Length);
        Assert.NotEqual(System.Text.Encoding.UTF8.GetBytes(token), guardado);
        Assert.Equal(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token)), guardado);
        using var adm = s.NovoAdmin();
        var (_, fila) = await adm.Get("admin/convites");
        Assert.DoesNotContain(token, fila.ToString());
    }

    [Fact]
    public async Task Link_revogado_ou_trocado_nao_vale()
    {
        await using var s = await ServidorTeste.Iniciar();
        var (id, token) = await Link(s, "rev@exemplo.com");
        using var adm = s.NovoAdmin();
        var (_, novo) = await adm.Post("admin/convites/" + id + "/link");
        using var c = s.NovoCliente();
        Assert.Equal(HttpStatusCode.Gone, (await c.Post("convites/validar", new { token })).status);   // o anterior caiu
        var token2 = novo.GetProperty("token").GetString();
        Assert.Equal(HttpStatusCode.OK, (await c.Post("convites/validar", new { token = token2 })).status);
        Assert.Equal(HttpStatusCode.NoContent, (await adm.Post("admin/convites/" + id + "/revogar")).status);
        Assert.Equal(HttpStatusCode.Gone, (await c.Post("convites/fundar", new { token = token2, senha = Senha, nome = "Pedralva", brasao = Brasao })).status);
    }

    [Fact]
    public async Task Link_vencido_nao_vale()
    {
        await using var s = await ServidorTeste.Iniciar();
        var (id, token) = await Link(s, "velho@exemplo.com");
        s.App.Services.GetRequiredService<Banco>().Exec("UPDATE convites SET expira_em=1 WHERE id=$i", ("$i", id));
        using var c = s.NovoCliente();
        Assert.Equal(HttpStatusCode.Gone, (await c.Post("convites/fundar", new { token, senha = Senha, nome = "Pedralva", brasao = Brasao })).status);
    }

    [Fact]
    public async Task Falha_na_fundacao_devolve_o_link_e_nao_deixa_conta()
    {
        await using var s = await ServidorTeste.Iniciar();
        var (_, token) = await Link(s, "erro@exemplo.com");
        using var c = s.NovoCliente();
        Assert.Equal(HttpStatusCode.BadRequest, (await c.Post("convites/fundar", new { token, senha = "curta", nome = "Pedralva", brasao = Brasao })).status);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.Post("convites/fundar", new { token, senha = Senha, nome = "x", brasao = Brasao })).status);
        Assert.False(s.App.Services.GetRequiredService<ServicoContas>().TemConta("erro@exemplo.com"));
        Assert.Equal(HttpStatusCode.Created, (await c.Post("convites/fundar", new { token, senha = Senha, nome = "Pedralva", brasao = Brasao })).status);
    }

    [Fact]
    public async Task Pedido_nao_revela_se_ja_esta_na_fila_e_valida_o_email()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var c = s.NovoCliente();
        var (s1, c1) = await c.Post("convites/pedir", new { email = "fila@exemplo.com" });
        var (s2, c2) = await c.Post("convites/pedir", new { email = "FILA@exemplo.com" });
        Assert.Equal(s1, s2);
        Assert.Equal(c1.ToString(), c2.ToString());
        Assert.Equal(HttpStatusCode.BadRequest, (await c.Post("convites/pedir", new { email = "nao-e-email" })).status);
        // o campo escondido que só robô preenche: mesma resposta, nada entra
        Assert.Equal(HttpStatusCode.Accepted, (await c.Post("convites/pedir", new { email = "robo@exemplo.com", site = "x" })).status);
        using var adm = s.NovoAdmin();
        var (_, fila) = await adm.Get("admin/convites");
        Assert.Single(fila.EnumerateArray());
    }

    [Fact]
    public async Task Pedidos_tem_limite_por_origem()
    {
        await using var s = await ServidorTeste.Iniciar(convitesPorHora: 2);
        using var c = s.NovoCliente();
        await c.Post("convites/pedir", new { email = "a@exemplo.com" });
        await c.Post("convites/pedir", new { email = "b@exemplo.com" });
        Assert.Equal((HttpStatusCode)429, (await c.Post("convites/pedir", new { email = "c@exemplo.com" })).status);
    }

    [Fact]
    public async Task Rotas_do_administrador_pedem_a_credencial()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var c = s.NovoCliente();
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.Get("admin/convites")).status);
        c.Http.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", "errada-mas-comprida-o-bastante-000000");
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.Get("admin/convites")).status);
    }

    [Fact]
    public async Task Sem_credencial_configurada_as_rotas_nao_existem()
    {
        await using var s = await ServidorTeste.Iniciar(adminToken: "");
        using var c = s.NovoAdmin();
        Assert.Equal(HttpStatusCode.NotFound, (await c.Get("admin/convites")).status);
    }
}
