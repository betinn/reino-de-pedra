using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Testes;

public class DefesasTestes
{
    public DefesasTestes() => AjustesTeste.Garantir();

    private static int HexPerto(MundoTeste t, Reino r, int dist) =>
        t.M.G.Area(t.M.Locais[r.CasteloId].Hex, dist)
            .First(h => t.M.G.Distancia(h, t.M.Locais[r.CasteloId].Hex) == dist && Obras.HexLivre(t.M, h) && !t.M.Mapa.Rio[h] && Nevoas.Explorado(t.M, r.Id, h));

    [Fact]
    public void Torre_nova_perto_de_um_local_sobe_de_nivel_e_ocupa_o_hexagono()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        t.DarRecursos(r);
        var longe = t.M.G.Area(t.M.Locais[r.CasteloId].Hex, 12).First(h => !t.M.LocaisDe(r.Id).Any(l => t.M.G.Distancia(l.Hex, h) <= t.M.F.AlcanceTorre(1)) && !t.M.Mapa.Rio[h] && Obras.HexLivre(t.M, h));
        Nevoas.RevelarArea(t.M, r.Id, longe, 0);
        Assert.Contains("perto", Defesas.MotivoTorre(t.M, r, longe));
        var hex = HexPerto(t, r, 2);
        Assert.Null(Defesas.MotivoTorre(t.M, r, hex));
        var item = Defesas.NovaTorre(t.M, r, hex);
        Assert.Equal(t.M.F.TempoTorre(1), item.DuracaoSeg);
        Assert.Equal(t.M.F.CustoTorre(1).Values.Sum(), item.Custo.Total, 6);
        Assert.NotNull(Defesas.MotivoTorre(t.M, r, hex));   // já há obra na fila para o hexágono
        t.AvancarHoras(3);
        var torre = Assert.Single(Defesas.DoReino(t.M, r.Id));
        Assert.Equal(hex, torre.Hex);
        Assert.Equal(1, torre.Nivel);
        Assert.Equal(t.M.P.Torre.Estrutura, torre.Estrutura);
        Assert.False(Obras.HexLivre(t.M, hex));
        Assert.NotNull(Obras.MotivoNaoFundar(t.M, r, "vila", hex));
        Assert.True(Nevoas.VisiveisAgora(t.M, r.Id).IsSupersetOf(t.M.G.Area(hex, Defesas.Alcance(t.M, torre))));
        Defesas.SubirTorre(t.M, r, torre.Id);
        Defesas.SubirTorre(t.M, r, torre.Id);
        Assert.Throws<RegraException>(() => Defesas.SubirTorre(t.M, r, torre.Id));   // nível máximo na fila
        t.AvancarHoras(8);
        Assert.Equal(t.M.P.Torre.NivelMax, torre.Nivel);
        Assert.Equal(t.M.P.Torre.NivelMax * t.M.P.Torre.Estrutura, torre.Estrutura);
        Assert.Equal(t.M.F.AlcanceTorre(torre.Nivel), Defesas.Alcance(t.M, torre));
        Assert.Equal(torre.Nivel * t.M.P.Torre.ArqPorNivel, Defesas.Arqueiros(t.M, torre));
        Assert.Throws<RegraException>(() => Defesas.SubirTorre(t.M, t.NovoReino(), torre.Id));
    }

    [Fact]
    public void Dano_derruba_o_nivel_da_torre_junto_com_a_estrutura()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var torre = t.M.Torres.Adicionar(new Torre { ReinoId = r.Id, Hex = HexPerto(t, r, 2), Nivel = 3, Estrutura = 3 * t.M.P.Torre.Estrutura });
        Assert.False(Defesas.DanificarTorre(t.M, torre, t.M.P.Torre.Estrutura + 1));
        Assert.Equal(2, torre.Nivel);
        Assert.True(Defesas.DanificarTorre(t.M, torre, 1e6));
        Assert.False(t.M.Torres.ContemId(torre.Id));
    }

    [Fact]
    public void Portoes_sobem_ate_o_nivel_sem_era_e_depois_pedem_a_era()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        t.DarRecursos(r, 1e7);
        var c = t.M.Locais[r.CasteloId];
        var semEra = t.M.P.Combate.Portao.NivelSemEra;
        for (var n = 1; n <= semEra; n++)
        {
            var it = Defesas.SubirPortoes(t.M, r);
            Assert.Equal(n, it.NivelAlvo);
            Assert.Equal(Defesas.TempoPortoes(t.M, n), it.DuracaoSeg);
            Assert.Equal(Defesas.CustoPortoes(t.M, n).Values.Sum(), it.Custo.Total, 6);
        }
        Assert.Contains(t.M.P.Eras["cerco"].Nome, Assert.Throws<RegraException>(() => Defesas.SubirPortoes(t.M, r)).Message);
        t.AvancarHoras(24);
        Assert.Equal(semEra, c.Portoes);
        Assert.Equal(semEra * t.M.P.PortoesEstrutura, c.EstruturaPortoes);
        Assert.Equal(1, Defesas.DanificarPortoes(t.M, c, t.M.P.PortoesEstrutura));
        Assert.Equal(semEra - 1, c.Portoes);
        // o custo cresce por nível
        Assert.True(Defesas.CustoPortoes(t.M, 2).Values.Sum() > Defesas.CustoPortoes(t.M, 1).Values.Sum());
    }
}
