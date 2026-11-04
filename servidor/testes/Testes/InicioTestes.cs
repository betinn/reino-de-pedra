using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Pessoas;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Temporada;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Testes;

/// <summary>Reino novo com os primeiros passos já dados (P.inicio): quem entra tem o que fazer sem esperar.</summary>
public class InicioTestes
{
    private static int HexA(MundoTeste t, int de, int dist) =>
        t.M.G.Area(de, dist).Where(h => t.M.G.Distancia(h, de) == dist && !t.M.Mapa.Rio[h] && t.M.LocalNoHex(h) == null
            && t.M.G.C(h) > 2 && t.M.G.L(h) > 2 && t.M.G.C(h) < t.M.G.Cols - 3 && t.M.G.L(h) < t.M.G.Lins - 3).First();

    [Fact]
    public void Reino_novo_ja_tem_niveis_moradias_tropas_e_exploradores_prontos()
    {
        var t = new MundoTeste(inicioPronto: true);
        var ini = t.B.P.Inicio;
        var r = t.NovoReino();
        var castelo = t.M.Locais[r.CasteloId];
        Assert.Equal(ini.Castelo, castelo.Nivel);
        Assert.Equal(ini.Moradias, castelo.Moradias);
        Assert.All(t.M.LocaisDe(r.Id).Where(l => l.Id != castelo.Id), l => Assert.Equal(ini.Locais, l.Nivel));
        // a guarnição do castelo são pessoas com nome, prontas para sair
        Assert.Equal(ini.Tropas, castelo.Guarnicao.Where(kv => kv.Value > 0).ToDictionary());
        var soldados = Pessoas.Guarnicao(t.M, castelo).ToList();
        Assert.Equal(ini.Tropas.Values.Sum(), soldados.Count);
        Assert.All(soldados, p => Assert.False(string.IsNullOrWhiteSpace(p.Nome)));
        Assert.Equal(ini.Exploradores, r.ExploradoresLivres);
        // os civis continuam todos lá; tropas e exploradores são gente a mais e cabem no teto
        Assert.Equal(t.B.P.PopInicial, r.Pop);
        Assert.Equal(ini.Tropas.Values.Sum() + ini.Exploradores.Values.Sum(), Economia.Tropas(t.M, r));   // exploradores livres contam junto
        Assert.True(r.Pop + Economia.Tropas(t.M, r) < Economia.Teto(t.M, r));   // e ainda sobra lugar para crescer
        Assert.Empty(Pessoas.Conferir(t.M));
        // o entorno do castelo já foi percorrido
        Assert.All(t.M.G.Area(castelo.Hex, ini.RaioExplorado), h => Assert.True(Nevoas.Explorado(t.M, r.Id, h)));
        // a tela "precisa de você" aponta os exploradores parados
        Assert.Contains(PrecisaDeVoce.Listar(t.M, r), x => x.Grupo == PrecisaDeVoce.Oportunidade && x.Href == "#/exploradores");
    }

    [Fact]
    public void Primeira_sessao_manda_explorador_e_tropas_na_hora()
    {
        var t = new MundoTeste(inicioPronto: true);
        var r = t.NovoReino();
        var castelo = t.M.Locais[r.CasteloId];
        var e = Exploradores.Enviar(t.M, r, Exploradores.Pe, Exploradores.Explorar, HexA(t, castelo.Hex, 9));
        Assert.Equal(r.Id, e.ReinoId);
        var ex = Exercitos.Enviar(t.M, r, castelo.Id, new Dictionary<string, int> { ["lanceiro"] = 2 }, HexA(t, castelo.Hex, 4), OrdemMover.Id);
        Assert.Equal(2, GT.Total(ex.Tropas));
        Assert.Equal(t.B.P.Inicio.Tropas["lanceiro"] - 2, castelo.Guarnicao["lanceiro"]);
        t.AvancarHoras(1);
        Exploradores.DarOrdem(t.M, r, e.Id, Exploradores.Retornar, null);   // o explorador espera no destino até mandarem voltar
        t.AvancarHoras(6);
        Assert.Contains(t.M.Relatorios, x => x.ReinoId == r.Id && x.Tipo == "exploracao");
        Assert.Empty(Pessoas.Conferir(t.M));
    }

    [Fact]
    public void Inicio_vazio_dos_cenarios_e_o_reino_de_antes()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        Assert.All(t.M.LocaisDe(r.Id), l => Assert.Equal(1, l.Nivel));
        Assert.Equal(0, Economia.Tropas(t.M, r));
        Assert.Empty(r.ExploradoresLivres);
    }
}
