using System.Text.Json;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.IA;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Testes;

/// <summary>O que o cliente recebe: regência no GET /reino e nenhum campo que diferencie um reino de IA.</summary>
public class IAApiTestes
{
    [Fact]
    public async Task Get_reino_traz_a_regencia_e_o_jogador_que_volta_retoma_o_reino()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var a = s.NovoCliente();
        await a.ContaComReino("ana@exemplo.com", "Pedralva");
        var (_, r0) = await a.Get("reino");
        Assert.Equal(JsonValueKind.Null, r0.GetProperty("regencia").ValueKind);
        await s.Avancar(TimeSpan.FromHours(72));   // 48 h sem entrar + um dia de regência
        var emRegencia = await s.Motor.Executar(m => m.Reinos.First(x => x.Ativo && !x.EhIA).EmRegencia);
        Assert.True(emRegencia);
        var (_, r1) = await a.Get("reino");
        var g = r1.GetProperty("regencia");
        Assert.True(g.GetProperty("ativaDesde").GetInt64() > 0);
        Assert.Equal(r1.GetProperty("agora").GetInt64(), g.GetProperty("terminouEm").GetInt64());   // o GET encerrou a regência
        Assert.Equal(JsonValueKind.Array, g.GetProperty("acoes").ValueKind);
        Assert.NotEmpty(g.GetProperty("acoes").EnumerateArray());
        Assert.Equal(JsonValueKind.Array, g.GetProperty("perdas").ValueKind);
        Assert.All(g.GetProperty("acoes").EnumerateArray(), x => Assert.Equal(JsonValueKind.String, x.ValueKind));
        Assert.False(await s.Motor.Executar(m => m.Reinos.First(x => x.Ativo && !x.EhIA).EmRegencia));
    }

    private static readonly string[] Proibidos = ["perfil", "habilidade", "contaid", "ehia", "regencia", "sessao", "\"ia\""];

    private static HashSet<string> Chaves(JsonElement e, string prefixo = "")
    {
        var s = new HashSet<string>();
        if (e.ValueKind == JsonValueKind.Object)
            foreach (var p in e.EnumerateObject()) { s.Add(prefixo + p.Name); s.UnionWith(Chaves(p.Value, prefixo + p.Name + ".")); }
        return s;
    }

    [Fact]
    public async Task Jogador_recebe_os_mesmos_campos_sobre_um_reino_de_IA_e_sobre_um_jogador()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var a = s.NovoCliente(); using var b = s.NovoCliente();
        var ra = await a.ContaComReino("ana@exemplo.com", "Pedralva");
        var rb = await b.ContaComReino("bia@exemplo.com", "Valdren");
        var idA = ra.GetProperty("id").GetInt64(); var idB = rb.GetProperty("id").GetInt64();
        var idIA = await s.Motor.Executar(m =>
        {
            var ia = Ocupacao.CriarUm(m)!;
            var x = m.Reinos[idA];
            foreach (var outro in new[] { m.Reinos[idB], ia })
            {
                Conhecimento.Conhecer(m, x, outro, "teste");
                foreach (var l in m.LocaisDe(outro.Id)) Nevoas.RevelarArea(m, x.Id, l.Hex, 0);   // na foto da névoa de A
            }
            return ia.Id;
        });
        // comércio: a lista de reinos conhecidos
        var (_, com) = await a.Get("comercio");
        var conhecidos = com.GetProperty("conhecidos").EnumerateArray().ToList();
        var deIA = conhecidos.Single(c => c.GetProperty("reino").GetProperty("id").GetInt64() == idIA);
        var deB = conhecidos.Single(c => c.GetProperty("reino").GetProperty("id").GetInt64() == idB);
        Assert.Equal(Chaves(deB).OrderBy(x => x), Chaves(deIA).OrderBy(x => x));
        // o escudo de quem não é aliado não aparece antes da chegada (de nenhum dos dois)
        Assert.False(deB.TryGetProperty("escudo", out _)); Assert.False(deIA.TryGetProperty("escudo", out _));
        // mapa: os locais de um e de outro chegam com os mesmos campos
        var (_, mapa) = await a.Get("mapa");
        var (hexIA, hexB) = await s.Motor.Executar(m => (m.LocaisDe(idIA).Select(l => l.Hex).ToHashSet(), m.LocaisDe(idB).Select(l => l.Hex).ToHashSet()));
        var locais = mapa.GetProperty("objetos").EnumerateArray().Where(o => o.GetProperty("tipo").GetString() == "local").ToList();
        var lIA = locais.Where(o => hexIA.Contains(o.GetProperty("hex").GetInt32())).ToList();
        var lB = locais.Where(o => hexB.Contains(o.GetProperty("hex").GetInt32())).ToList();
        Assert.NotEmpty(lIA); Assert.NotEmpty(lB);
        var chavesIA = lIA.Select(o => string.Join(",", Chaves(o).OrderBy(x => x))).ToHashSet();
        var chavesB = lB.Select(o => string.Join(",", Chaves(o).OrderBy(x => x))).ToHashSet();
        Assert.Equal(chavesB.OrderBy(x => x), chavesIA.OrderBy(x => x));
        Assert.Equal(lB.Select(o => o.GetProperty("dono").GetString()).Distinct(), lIA.Select(o => o.GetProperty("dono").GetString()).Distinct());
        // nada no que A recebe fala de IA (o GET /reino de A pode ter "regencia": é o dele)
        foreach (var url in new[] { "comercio", "mapa", "alianca", "mensagens" })
        {
            var (_, j) = await a.Get(url);
            var txt = j.GetRawText().ToLowerInvariant();
            foreach (var p in Proibidos) Assert.DoesNotContain(p, txt);
        }
    }
}
