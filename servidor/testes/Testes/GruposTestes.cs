using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using PS = ReinoDePedra.Jogo.Pessoas.Pessoas;

namespace ReinoDePedra.Testes;

/// <summary>Juntar e separar tropas em campo (decisão 0029).</summary>
public class GruposTestes
{
    private static Local Castelo(MundoTeste t, Reino r) => t.M.Locais[r.CasteloId];

    private static int Livre(MundoTeste t, int de, int dist, int pular = 0) =>
        t.M.G.Area(de, dist).Where(h => t.M.G.Distancia(h, de) == dist && !t.M.Mapa.Rio[h] && Obras.HexLivre(t.M, h)
            && t.M.G.C(h) > 2 && t.M.G.L(h) > 2 && t.M.G.C(h) < t.M.G.Cols - 3 && t.M.G.L(h) < t.M.G.Lins - 3).Skip(pular).First();

    private static void Guarnecer(MundoTeste t, Reino r, Local l, string unidade, int n)
    {
        Economia.Atualizar(t.M, r);
        l.Guarnicao[unidade] = l.Guarnicao.GetValueOrDefault(unidade) + n;
        PS.RemoverCivis(t.M, r, t.B.U[unidade].Pop * n);
        t.M.Sujar(l); t.M.Sujar(r);
    }

    /// <summary>Exército parado em <paramref name="hex"/> com as tropas dadas.</summary>
    private static Exercito Parado(MundoTeste t, Reino r, Local c, int hex, Dictionary<string, int> tropas)
    {
        var ex = Exercitos.Enviar(t.M, r, c.Id, tropas, hex, OrdemMover.Id);
        t.Avancar(TimeSpan.FromMilliseconds(ex.Chegada - t.M.Agora + 1));
        Assert.True(ex.Parado);
        return ex;
    }

    private static (MundoTeste t, Reino r, Local c) Cenario()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        Guarnecer(t, r, c, "lanceiro", 6);
        Guarnecer(t, r, c, "arqueiro", 4);
        return (t, r, c);
    }

    [Fact]
    public void Duas_tropas_no_mesmo_hexagono_viram_uma_na_hora()
    {
        var (t, r, c) = Cenario();
        var h = Livre(t, c.Hex, 6);
        var x = Parado(t, r, c, h, new() { ["lanceiro"] = 1, ["arqueiro"] = 1 });
        var y = Parado(t, r, c, h, new() { ["lanceiro"] = 1 });
        x.Carga.Somar("madeira", 3);
        var pessoasX = x.PessoaIds.ToList();

        var z = Grupos.Juntar(t.M, r, x.Id, y.Id);

        Assert.Equal(y.Id, z.Id);
        Assert.False(t.M.Marchas.ContemId(x.Id));
        Assert.Equal(2, z.Tropas["lanceiro"]); Assert.Equal(1, z.Tropas["arqueiro"]);
        Assert.Equal(3, z.PessoaIds.Count);
        Assert.All(pessoasX, id => Assert.Equal(z.Id, t.M.Pessoas.Obter(id)!.GrupoId));
        Assert.Equal(3, z.Carga["madeira"]);
        Assert.Empty(PS.Conferir(t.M));
    }

    [Fact]
    public void Em_hexagonos_diferentes_a_primeira_vai_ate_a_outra_e_se_junta_ao_chegar()
    {
        var (t, r, c) = Cenario();
        var hx = Livre(t, c.Hex, 6); var hy = Livre(t, c.Hex, 10);
        var x = Parado(t, r, c, hx, new() { ["lanceiro"] = 2 });
        var y = Parado(t, r, c, hy, new() { ["arqueiro"] = 2 });

        var anda = Grupos.Juntar(t.M, r, x.Id, y.Id);

        Assert.Equal(x.Id, anda.Id);
        Assert.Equal(OrdemJuntar.Id, x.Ordem);
        Assert.Equal(hy, x.Destino);
        t.Avancar(TimeSpan.FromMilliseconds(x.Chegada - t.M.Agora + 1));
        Assert.False(t.M.Marchas.ContemId(x.Id));
        Assert.Equal(2, y.Tropas["lanceiro"]); Assert.Equal(2, y.Tropas["arqueiro"]);
        Assert.Equal(hy, y.HexEm(t.M.Agora));
        Assert.Empty(PS.Conferir(t.M));
    }

    [Fact]
    public void Se_a_outra_andou_segue_atras_dela_e_se_ela_entrou_num_local_para()
    {
        var (t, r, c) = Cenario();
        var hx = Livre(t, c.Hex, 6); var hy = Livre(t, c.Hex, 8, pular: 20); var hz = Livre(t, hy, 8);
        var x = Parado(t, r, c, hx, new() { ["lanceiro"] = 2 });
        var y = Parado(t, r, c, hy, new() { ["lanceiro"] = 1 });
        Grupos.Juntar(t.M, r, x.Id, y.Id);
        Exercitos.DarOrdem(t.M, r, y.Id, OrdemMover.Id, hz);
        for (var i = 0; i < 4000 && t.M.Marchas.ContemId(x.Id); i++) t.AvancarMin(0.05);
        Assert.False(t.M.Marchas.ContemId(x.Id));
        Assert.Equal(3, y.Tropas["lanceiro"]);

        var w = Parado(t, r, c, hx, new() { ["arqueiro"] = 1 });
        Grupos.Juntar(t.M, r, w.Id, y.Id);
        Exercitos.DarOrdem(t.M, r, y.Id, OrdemMover.Id, c.Hex);   // entra no castelo
        for (var i = 0; i < 8000 && !(w.Parado && !t.M.Marchas.ContemId(y.Id)); i++) t.AvancarMin(0.05);
        Assert.False(t.M.Marchas.ContemId(y.Id));
        Assert.True(w.Parado);
        Assert.Equal(OrdemMover.Id, w.Ordem);
    }

    [Fact]
    public void Soldados_da_guarnicao_saem_para_se_juntar_a_uma_tropa()
    {
        var (t, r, c) = Cenario();
        var y = Parado(t, r, c, Livre(t, c.Hex, 6), new() { ["lanceiro"] = 1 });
        var ex = Grupos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["arqueiro"] = 2 }, y.Id);
        t.Avancar(TimeSpan.FromMilliseconds(ex.Chegada - t.M.Agora + 1));
        Assert.False(t.M.Marchas.ContemId(ex.Id));
        Assert.Equal(2, y.Tropas["arqueiro"]);
        Assert.Empty(PS.Conferir(t.M));
    }

    [Fact]
    public void Juntar_passa_o_passo_para_o_da_unidade_mais_lenta()
    {
        var (t, r, c) = Cenario();
        Guarnecer(t, r, c, "cavalaria", 1);
        var h = Livre(t, c.Hex, 6); var longe = Livre(t, h, 20);
        var lenta = Parado(t, r, c, h, new() { ["lanceiro"] = 1 });
        var rapida = Parado(t, r, c, h, new() { ["cavalaria"] = 1 });
        Exercitos.DarOrdem(t.M, r, rapida.Id, OrdemMover.Id, longe);
        var antes = rapida.Chegada;
        Grupos.Juntar(t.M, r, lenta.Id, rapida.Id);
        Assert.NotEqual("Rápida", rapida.Vel);
        Assert.True(rapida.Chegada > antes);
        Assert.Equal(longe, rapida.Destino);
    }

    [Fact]
    public void Separar_forma_uma_tropa_nova_parada_com_a_parte_da_carga()
    {
        var (t, r, c) = Cenario();
        var h = Livre(t, c.Hex, 6);
        var z = Parado(t, r, c, h, new() { ["lanceiro"] = 2, ["arqueiro"] = 1 });
        z.Carga.Somar("madeira", 12);
        var arqueiro = PS.SoldadosDaMarcha(t.M, z).First(p => p.Oficio == "arqueiro");
        var total = z.Carga.Total;

        var novo = Grupos.Separar(t.M, r, z.Id, [arqueiro.Id]);

        Assert.NotEqual(z.Id, novo.Id);
        Assert.True(novo.Parado);
        Assert.Equal(h, novo.HexEm(t.M.Agora));
        Assert.Equal(1, novo.Tropas["arqueiro"]); Assert.False(z.Tropas.ContainsKey("arqueiro"));
        Assert.Equal(2, z.Tropas["lanceiro"]);
        Assert.Equal(novo.Id, arqueiro.GrupoId);
        Assert.Equal(total, novo.Carga.Total + z.Carga.Total, 6);
        Assert.Equal(z.OrigemLocalId, novo.OrigemLocalId);
        Assert.Empty(PS.Conferir(t.M));
        // a nova aceita ordem como qualquer tropa
        Exercitos.DarOrdem(t.M, r, novo.Id, OrdemMover.Id, c.Hex);
        Assert.False(novo.Parado);
    }

    [Fact]
    public void Separar_recusa_ninguem_todo_mundo_e_quem_nao_esta_na_tropa()
    {
        var (t, r, c) = Cenario();
        var h = Livre(t, c.Hex, 6);
        var z = Parado(t, r, c, h, new() { ["lanceiro"] = 2 });
        var outra = Parado(t, r, c, h, new() { ["lanceiro"] = 1 });
        Assert.Throws<RegraException>(() => Grupos.Separar(t.M, r, z.Id, []));
        Assert.Throws<RegraException>(() => Grupos.Separar(t.M, r, z.Id, z.PessoaIds.ToList()));
        Assert.Throws<RegraException>(() => Grupos.Separar(t.M, r, z.Id, [outra.PessoaIds[0]]));
        Assert.Equal(2, z.Tropas["lanceiro"]);
    }

    [Fact]
    public void Separar_andando_o_grupo_que_fica_segue_e_quem_sai_para_ali()
    {
        var (t, r, c) = Cenario();
        Guarnecer(t, r, c, "cavalaria", 1);
        var longe = Livre(t, c.Hex, 30);
        var z = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 1, ["cavalaria"] = 1 }, longe, OrdemMover.Id);
        t.AvancarMin(1);
        var aqui = z.HexEm(t.M.Agora);
        var chegada = z.Chegada;
        var lanceiro = PS.SoldadosDaMarcha(t.M, z).First(p => p.Oficio == "lanceiro");

        var novo = Grupos.Separar(t.M, r, z.Id, [lanceiro.Id]);

        Assert.True(novo.Parado);
        Assert.Equal(aqui, novo.HexEm(t.M.Agora));
        Assert.Equal(longe, z.Destino);
        Assert.True(z.Chegada < chegada, "sem o lanceiro, a cavalaria anda mais rápido");
    }

    [Fact]
    public void Ordem_a_parte_da_tropa_separa_e_recusada_a_parte_volta()
    {
        var (t, r, c) = Cenario();
        var h = Livre(t, c.Hex, 6);
        var z = Parado(t, r, c, h, new() { ["lanceiro"] = 3 });
        var um = z.PessoaIds[0];
        var destino = Livre(t, h, 6);

        var parte = Grupos.Parte(t.M, r, z.Id, [um], e => { Exercitos.DarOrdem(t.M, r, e.Id, OrdemMover.Id, destino); return e; });
        Assert.NotEqual(z.Id, parte.Id);
        Assert.Equal(destino, parte.Destino);
        Assert.Equal(2, z.Tropas["lanceiro"]);

        var outro = z.PessoaIds[0];
        Assert.Throws<RegraException>(() => Grupos.Parte(t.M, r, z.Id, [outro], e => { Exercitos.DarOrdem(t.M, r, e.Id, "nada", destino); return e; }));
        Assert.Equal(2, z.Tropas["lanceiro"]);
        Assert.Empty(PS.Conferir(t.M));

        // com todas as pessoas, a ordem vai para a tropa inteira
        var inteira = Grupos.Parte(t.M, r, z.Id, z.PessoaIds.ToList(), e => { Exercitos.DarOrdem(t.M, r, e.Id, OrdemMover.Id, destino); return e; });
        Assert.Equal(z.Id, inteira.Id);
    }

    [Fact]
    public void Tropa_ocupada_nao_recebe_gente_nem_se_separa()
    {
        var (t, r, c) = Cenario();
        var h = Livre(t, c.Hex, 6);
        var x = Parado(t, r, c, h, new() { ["lanceiro"] = 2 });
        var y = Parado(t, r, c, h, new() { ["lanceiro"] = 1 });
        y.Ordem = "cacar";
        Assert.Throws<RegraException>(() => Grupos.Juntar(t.M, r, x.Id, y.Id));
        x.Ordem = "cacar";
        Assert.Throws<RegraException>(() => Grupos.Separar(t.M, r, x.Id, [x.PessoaIds[0]]));
    }
}
