using System.Text.Json;
using ReinoDePedra.Api;
using ReinoDePedra.Api.Visoes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Valiosos;

namespace ReinoDePedra.Testes;

/// <summary>Prévias e consultas por id ou hexágono só usam o que o reino pode saber (névoa, foto, fauna conhecida).</summary>
public class VisibilidadeTestes
{
    public VisibilidadeTestes() => AjustesTeste.Garantir();

    private static JsonElement J(object o) => JsonSerializer.SerializeToElement(o, Json.Web);

    private static int HexLonge(MundoTeste t, int de, int dist, int pular = 0) =>
        t.M.G.Area(de, dist).Where(h => t.M.G.Distancia(h, de) == dist && !t.M.Mapa.Rio[h] && Obras.HexLivre(t.M, h)
            && t.M.G.C(h) > 2 && t.M.G.L(h) > 2 && t.M.G.C(h) < t.M.G.Cols - 3 && t.M.G.L(h) < t.M.G.Lins - 3
            && t.M.Mapa.Vagas.All(v => t.M.G.Distancia(v.Castelo, h) > t.M.P.FaunaServ.PertoReino + 1)).Skip(pular).First();

    private static void Guarnecer(MundoTeste t, Reino r, Local l, string unidade, int n)
    {
        Economia.Atualizar(t.M, r);
        l.Guarnicao[unidade] = l.Guarnicao.GetValueOrDefault(unidade) + n;
        r.Pop -= t.B.U[unidade].Pop * n;
        t.M.Sujar(l); t.M.Sujar(r);
    }

    private static List<int> Caminho(JsonElement rota) => rota.GetProperty("caminho").EnumerateArray().Select(x => x.GetInt32()).ToList();

    // ---------------------------------------------------------------- rota segura com a fauna conhecida (achados 5 e 12)

    [Fact]
    public void Previas_e_caravana_seguras_so_desviam_da_fauna_que_o_reino_conhece()
    {
        var t = new MundoTeste();
        var r = t.NovoReino(); r.EscudoAte = 0;
        var c = t.M.Locais[r.CasteloId];
        var alvo = HexLonge(t, c.Hex, 6);
        var curta = Caminhos.Calcular(t.M, c.Hex, alvo, "Lenta");
        var meio = curta.Hexes[curta.Hexes.Count / 2];
        Fauna.Adicionar(t.M, new RegiaoFauna { Centro = meio, Hex = meio, Raio = 1, Animal = "ursos", Nivel = "alto", Qtd = 4 });
        // a fauna real desviaria; o reino não a conhece
        var real = Caminhos.Calcular(t.M, c.Hex, alvo, "Lenta", new OpcoesCaminho { Seguro = true, Forca = 30 });
        Assert.NotEqual(curta.Hexes, real.Hexes);
        Guarnecer(t, r, c, "lanceiro", 4);
        var tropas = new Dictionary<string, int> { ["lanceiro"] = 4 };
        var vel = ReinoDePedra.Jogo.Reinos.Tropas.Velocidade(t.M, tropas);
        var curtaVel = Caminhos.Calcular(t.M, c.Hex, alvo, vel).Hexes;

        // prévia de ataque a uma ruína que o reino já viu
        t.M.AdicionarLocal(new Local { ReinoId = 0, Tipo = TipoLocal.Vila, Ruina = true, Nivel = 1, Hex = alvo, Nome = "Ruína" });
        Nevoas.RevelarArea(t.M, r.Id, alvo, 0);
        var pa = new VisaoCombate.PedidoAtaque(c.Id, null, tropas, alvo, null, null, null, null, null, null, null, true);
        var pv = J(VisaoCombate.Previa(t.M, r, pa, alvo));
        Assert.Equal(curtaVel, Caminho(pv.GetProperty("segura")));

        // viagem das prévias de extração e relíquia
        var vg = J(VisaoValiosos.Viagem(t.M, r.Id, c.Hex, alvo, vel, ReinoDePedra.Jogo.Reinos.Tropas.ForcaFauna(t.M, tropas)));
        Assert.Equal(curtaVel, Caminho(vg.GetProperty("segura")));

        // caravana segura até um local próprio do outro lado
        var dest = t.M.AdicionarLocal(new Local { ReinoId = r.Id, Tipo = TipoLocal.Armazem, Nivel = 1, Hex = HexLonge(t, alvo, 1), Nome = "Armazém" });
        t.DarRecursos(r, 100);
        var plano = Caravanas.Planejar(t.M, r, new PedidoCaravana(c.Id, dest.Id, new Dictionary<string, double> { ["madeira"] = 10 }, null, tropas, c.Id, true));
        Assert.Equal(Caminhos.Calcular(t.M, c.Hex, dest.Hex, plano.Vel).Hexes, plano.Levar!.Hexes);
    }

    // ---------------------------------------------------------------- prévia e envio de ataque na névoa (achado 7)

    [Fact]
    public void Ataque_a_hexagono_que_o_reino_nao_conhece_responde_igual_tenha_ou_nao_local()
    {
        var t = new MundoTeste();
        var a = t.NovoReino(); var b = t.NovoReino();
        a.EscudoAte = 0; b.EscudoAte = 0;
        var ca = t.M.Locais[a.CasteloId];
        var cb = t.M.Locais[b.CasteloId];
        Assert.False(Nevoas.Explorado(t.M, a.Id, cb.Hex));
        Guarnecer(t, a, ca, "lanceiro", 4);
        var tropas = new Dictionary<string, int> { ["lanceiro"] = 4 };
        VisaoCombate.PedidoAtaque P(int h) => new(ca.Id, null, tropas, h, null, null, null, null, null, null, null, false);
        var vazio = t.M.G.Area(cb.Hex, 3).First(h => t.M.LocalNoHex(h) == null && !Nevoas.Explorado(t.M, a.Id, h));
        var comLocal = Assert.Throws<RegraException>(() => VisaoCombate.Previa(t.M, a, P(cb.Hex), cb.Hex)).Message;
        var semLocal = Assert.Throws<RegraException>(() => VisaoCombate.Previa(t.M, a, P(vazio), vazio)).Message;
        Assert.Equal(semLocal, comLocal);
        var envio = Assert.Throws<RegraException>(() => Exercitos.Enviar(t.M, a, ca.Id, tropas, cb.Hex, ReinoDePedra.Jogo.Combate.OrdemAtacar.Id, false, VisaoCombate.Dados(P(cb.Hex)))).Message;
        Assert.Equal(semLocal, envio);

        // explorado e fora da vista: a prévia mostra o último estado conhecido (a foto), não o atual
        var vila = t.M.LocaisDe(b.Id).First(l => l.Id != b.CasteloId);
        Nevoas.RevelarArea(t.M, a.Id, vila.Hex, 0);
        Assert.DoesNotContain(vila.Hex, Nevoas.VisiveisAgora(t.M, a.Id));
        t.M.MudarDono(vila, 0); vila.Ruina = true;
        var pv = J(VisaoCombate.Previa(t.M, a, P(vila.Hex), vila.Hex)).GetProperty("alvo");
        Assert.Equal("desconhecido", pv.GetProperty("dono").GetString());
        Assert.NotEqual("Ruína", pv.GetProperty("nome").GetString());
    }
}
