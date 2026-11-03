using System.Net;
using System.Text.Json;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Testes;

public class SocialApiTestes
{
    private static IEnumerable<JsonElement> Objetos(JsonElement mapa, string tipo) =>
        mapa.GetProperty("objetos").EnumerateArray().Where(o => o.GetProperty("tipo").GetString() == tipo);

    /// <summary>Duas contas com reino; os reinos se conhecem (como depois de uma espionagem).</summary>
    private static async Task<(Cliente a, Cliente b, long idA, long idB)> DoisReinos(ServidorTeste s)
    {
        var a = s.NovoCliente(); var b = s.NovoCliente();
        var ra = await a.ContaComReino("ana@exemplo.com", "Pedralva");
        var rb = await b.ContaComReino("bia@exemplo.com", "Valdren");
        var idA = ra.GetProperty("id").GetInt64(); var idB = rb.GetProperty("id").GetInt64();
        await s.Motor.Executar(m =>
        {
            var x = m.Reinos[idA]; var y = m.Reinos[idB];
            Conhecimento.Conhecer(m, x, y, "teste"); Conhecimento.Conhecer(m, y, x, "teste");
            x.EscudoAte = 0; y.EscudoAte = 0;
        });
        return (a, b, idA, idB);
    }

    [Fact]
    public async Task Alianca_convite_mapa_conversa_e_saida_pela_api()
    {
        await using var s = await ServidorTeste.Iniciar();
        var (a, b, idA, idB) = await DoisReinos(s);
        using var _a = a; using var _b = b;
        var (_, ra) = await a.Get("reino");
        Assert.True(ra.GetProperty("sistemas").GetProperty("alianca").GetBoolean());   // conhecer o primeiro reino apresentou
        Assert.Equal(HttpStatusCode.BadRequest, (await a.Post("alianca", new { nome = "x" })).status);
        var (sc, al) = await a.Post("alianca", new { nome = "Liga do Vale" });
        Assert.Equal(HttpStatusCode.Created, sc);
        Assert.Equal("lider", al.GetProperty("alianca").GetProperty("meuCargo").GetString());
        Assert.Equal(HttpStatusCode.NoContent, (await a.Post("alianca/convidar", new { reinoId = idB })).status);
        var (_, gb) = await b.Get("alianca");
        var conv = Assert.Single(gb.GetProperty("convitesRecebidos").EnumerateArray());
        var aid = conv.GetProperty("alianca").GetProperty("id").GetInt64();
        Assert.Equal(HttpStatusCode.NoContent, (await b.Post($"aliancas/{aid}/convite/aceitar")).status);
        (_, gb) = await b.Get("alianca");
        Assert.Equal(2, gb.GetProperty("alianca").GetProperty("membros").GetArrayLength());

        // no mapa, o aliado aparece com nome e brasão
        var (_, mapa) = await a.Get("mapa");
        await s.Motor.Executar(m =>
        {
            var l = m.Locais[m.Reinos[idB].CasteloId];
            Nevoas.RevelarArea(m, idA, l.Hex, 0);
        });
        (_, mapa) = await a.Get("mapa");
        var castB = Objetos(mapa, "local").Single(o => o.GetProperty("dono").GetString() == "aliado" && o.GetProperty("local").GetString() == "castelo");
        Assert.Equal("Valdren", castB.GetProperty("reino").GetProperty("nome").GetString());

        // conversa: o único chat do jogo
        Assert.Equal(HttpStatusCode.Created, (await b.Post("alianca/conversa", new { texto = "Bom dia, aliados!" })).status);
        var (_, ga) = await a.Get("alianca");
        Assert.Equal("Bom dia, aliados!", ga.GetProperty("alianca").GetProperty("conversa").EnumerateArray().Last().GetProperty("texto").GetString());

        // b sai: trégua aparece para a; b espera para outra aliança
        Assert.Equal(HttpStatusCode.NoContent, (await b.Post("alianca/sair")).status);
        (_, ga) = await a.Get("alianca");
        Assert.Single(ga.GetProperty("alianca").GetProperty("treguas").EnumerateArray());
        (_, gb) = await b.Get("alianca");
        Assert.True(gb.GetProperty("livreEm").GetInt64() > 0);
        Assert.Equal(HttpStatusCode.BadRequest, (await b.Post("alianca", new { nome = "Outra Liga" })).status);
        (_, mapa) = await a.Get("mapa");
        Assert.DoesNotContain(Objetos(mapa, "local"), o => o.GetProperty("dono").GetString() == "aliado");
    }

    [Fact]
    public async Task Troca_e_pacto_pela_api()
    {
        await using var s = await ServidorTeste.Iniciar();
        var (a, b, idA, idB) = await DoisReinos(s);
        using var _a = a; using var _b = b;
        var (st, p) = await a.Post("comercio/troca", new { reinoId = idB, da = new { madeira = 50 }, quer = new { pedra = 30 }, recado = "pela estrada" });
        Assert.True(st == HttpStatusCode.Created, p.ToString());
        var (_, cb) = await b.Get("comercio");
        var prop = Assert.Single(cb.GetProperty("paraMim").EnumerateArray());
        Assert.Equal("Pedralva", prop.GetProperty("de").GetProperty("nome").GetString());
        var (sa, aceita) = await b.Post($"propostas/{prop.GetProperty("id").GetInt64()}/aceitar");
        Assert.True(sa == HttpStatusCode.OK, aceita.ToString());
        Assert.Equal("aceita", aceita.GetProperty("estado").GetString());
        Assert.True(aceita.GetProperty("chegada").GetInt64() > 0);
        var (_, mapa) = await a.Get("mapa");
        Assert.Contains(Objetos(mapa, "marcha"), o => o.GetProperty("marcha").GetString() == "remessa" && o.GetProperty("dono").GetString() == "meu");

        var (sp, pp) = await a.Post("comercio/pacto", new { reinoId = idB, dias = 2 });
        Assert.True(sp == HttpStatusCode.Created, pp.ToString());
        Assert.Equal(HttpStatusCode.BadRequest, (await a.Post("comercio/pacto", new { reinoId = idB, dias = 9 })).status);
        (_, cb) = await b.Get("comercio");
        var pacto = cb.GetProperty("paraMim").EnumerateArray().First(x => x.GetProperty("tipo").GetString() == "pacto");
        Assert.Equal(HttpStatusCode.OK, (await b.Post($"propostas/{pacto.GetProperty("id").GetInt64()}/aceitar")).status);
        var (_, ca) = await a.Get("comercio");
        Assert.Equal("ativo", Assert.Single(ca.GetProperty("pactos").EnumerateArray()).GetProperty("estado").GetString());
        var (_, r) = await a.Get("reino");
        Assert.Equal(1, r.GetProperty("social").GetProperty("pactos").GetInt32());
    }

    [Fact]
    public async Task Mensageiro_e_bandeiras_pela_api()
    {
        await using var s = await ServidorTeste.Iniciar();
        var (a, b, idA, idB) = await DoisReinos(s);
        using var _a = a; using var _b = b;
        Assert.Equal(HttpStatusCode.Created, (await a.Post("mensageiros/treinar", new { qtd = 1 })).status);
        await s.Avancar(TimeSpan.FromMinutes(5));
        var (sm, msg) = await a.Post("mensagens", new { texto = "Saudações de Pedralva.", reinoId = idB });
        Assert.True(sm == HttpStatusCode.Created, msg.ToString());
        var (_, ma) = await a.Get("mensagens");
        Assert.Single(ma.GetProperty("emCampo").EnumerateArray());
        await s.Avancar(TimeSpan.FromHours(2));
        var (_, mb) = await b.Get("mensagens");
        var rec = Assert.Single(mb.GetProperty("recebidas").EnumerateArray());
        Assert.Equal("Pedralva", rec.GetProperty("de").GetProperty("nome").GetString());
        var (_, rb) = await b.Get("reino");
        Assert.Equal(1, rb.GetProperty("social").GetProperty("mensagensNovas").GetInt32());
        await b.Post("mensagens/lidas");
        (_, rb) = await b.Get("reino");
        Assert.Equal(0, rb.GetProperty("social").GetProperty("mensagensNovas").GetInt32());

        // bandeira: no mapa de quem colocou, com o autor
        var (_, ra) = await a.Get("reino");
        var hex = ra.GetProperty("locais").EnumerateArray().First(l => l.GetProperty("tipo").GetString() == "castelo").GetProperty("hex").GetInt32() + 1;
        var (sb, band) = await a.Post("bandeiras", new { hex, tipo = "aviso", recado = "Passagem livre" });
        Assert.True(sb == HttpStatusCode.Created, band.ToString());
        Assert.Equal(HttpStatusCode.BadRequest, (await a.Post("bandeiras", new { hex, tipo = "aviso", recado = "x" })).status);
        var (_, mapa) = await a.Get("mapa");
        var o = Assert.Single(Objetos(mapa, "bandeira"));
        Assert.Equal("meu", o.GetProperty("dono").GetString());
        Assert.Equal("Pedralva", o.GetProperty("autor").GetProperty("nome").GetString());
        var (_, lb) = await a.Get("bandeiras");
        Assert.Single(lb.GetProperty("minhas").EnumerateArray());
        var r = await a.Http.DeleteAsync("bandeiras/" + band.GetProperty("id").GetInt64());
        Assert.Equal(HttpStatusCode.NoContent, r.StatusCode);
    }
}
