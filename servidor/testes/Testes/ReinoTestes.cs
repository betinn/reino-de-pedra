using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Testes;

public class ReinoTestes
{
    [Fact]
    public void Mapa_tem_30_vagas_jazidas_e_ruinas()
    {
        var t = new MundoTeste();
        Assert.Equal(30, t.M.Mapa.Vagas.Count);
        Assert.Equal(t.B.P.Mapa.Cols * t.B.P.Mapa.Lins, t.M.G.Total);   // 104 × 80 (decisão 0022)
        Assert.Equal(30, t.M.Ruinas.Count);
        Assert.Equal(75, t.M.Jazidas.Count);   // 7 valiosos × 10 + minério raro 5
        var vs = t.M.Mapa.Vagas.Select(v => v.Castelo).ToList();
        foreach (var a in vs) Assert.True(vs.Where(b => b != a).Min(b => t.M.G.Distancia(a, b)) >= 5);
    }

    [Fact]
    public void Mapa_e_deterministico() =>
        Assert.Equal(new MundoTeste(99).M.Mapa.Compacto(), new MundoTeste(99).M.Mapa.Compacto());

    [Fact]
    public void Reino_novo_tem_castelo_quatro_locais_kit_e_escudo()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        Assert.Equal(5, t.M.LocaisDe(r.Id).Count());
        var c = t.M.Locais[r.CasteloId];
        Assert.Equal(t.B.P.Kit["madeira"], c.Estoque.Qtd("madeira"));
        Assert.Equal(t.M.Agora + 72 * T.Hora, r.EscudoAte);
        Assert.Equal(t.B.P.PopInicial, r.Pop);   // 8 pessoas (escala do plano de pessoas no mapa)
    }

    [Fact]
    public void Nome_de_reino_e_unico_e_validado()
    {
        var t = new MundoTeste();
        t.NovoReino("Pedralva");
        Assert.Throws<RegraException>(() => t.NovoReino("pedralva"));
        Assert.Throws<RegraException>(() => t.NovoReino("A"));
        Assert.Throws<RegraException>(() => t.NovoReino("<script>"));
    }

    [Fact]
    public void Producao_acumula_ate_10h_e_excedente_vai_ao_castelo()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var serraria = t.M.LocaisDe(r.Id).First(l => l.Tipo == TipoLocal.Serraria);
        var prod = t.M.F.Producao(1);
        t.AvancarHoras(5);
        Economia.Atualizar(t.M, r);
        Assert.Equal(prod * 5, serraria.Estoque.Qtd("madeira"), 3);
        t.AvancarHoras(10);
        Economia.Atualizar(t.M, r);
        var cap = prod * t.B.P.EstoqueHoras;
        Assert.Equal(cap, serraria.Estoque.Qtd("madeira"), 3);   // 10 h × 3/h
        var c = t.M.Locais[r.CasteloId];
        Assert.Equal(t.B.P.Kit["madeira"] + t.M.F.ProducaoCastelo(1) * 15 + (prod * 15 - cap), c.Estoque.Qtd("madeira"), 1);   // kit + castelo 15 h + excedente
    }

    [Fact]
    public void Populacao_cresce_logistica_ate_o_teto()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        t.AvancarHoras(1);
        Economia.Atualizar(t.M, r);
        // comida 5,5/h (castelo 2,5 + vila 3) > 2 × 2,5: sobra de comida, +30%
        var P = t.B.P;
        Assert.Equal(Economia.Logistica(P.PopInicial, P.TetoCastelo, P.CrescPop * (1 + P.BonusComida), 1, P.PopSemente), r.Pop, 6);
        t.AvancarHoras(500);
        Economia.Atualizar(t.M, r);
        Assert.InRange(r.Pop, P.TetoCastelo - 1, P.TetoCastelo);
    }

    [Fact]
    public void Obra_no_castelo_comeca_na_hora_e_termina_no_tempo()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var item = Obras.Melhorar(t.M, r, r.CasteloId);
        Assert.True(item.Iniciado);
        Assert.Equal(240, item.DuracaoSeg);   // nível 2: 2 min × 2 (castelo)
        t.AvancarMin(3.9);
        Assert.Equal(1, t.M.Locais[r.CasteloId].Nivel);
        t.AvancarMin(0.2);
        Assert.Equal(2, t.M.Locais[r.CasteloId].Nivel);
    }

    [Fact]
    public void Nenhum_local_passa_do_castelo()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var vila = t.M.LocaisDe(r.Id).First(l => l.Tipo == TipoLocal.Vila);
        Assert.Throws<RegraException>(() => Obras.Melhorar(t.M, r, vila.Id));
    }

    [Fact]
    public void Requisicao_manda_carregadores_e_obra_espera_o_material()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        Obras.Melhorar(t.M, r, r.CasteloId);
        t.AvancarMin(5);
        var vila = t.M.LocaisDe(r.Id).First(l => l.Tipo == TipoLocal.Vila);
        var item = Obras.Melhorar(t.M, r, vila.Id);
        Assert.False(item.MaterialCompleto);   // a vila não tem madeira nem pedra: vem de outros locais
        var carreg = t.M.Marchas.OfType<Carregadores>().ToList();
        Assert.NotEmpty(carreg);
        Assert.All(carreg, c => Assert.Equal(vila.Hex, c.Destino));
        t.Avancar(TimeSpan.FromMilliseconds(carreg.Max(c => c.Chegada) - t.M.Agora + 1));
        Assert.True(item.MaterialCompleto);
        Assert.True(item.Iniciado);
        t.AvancarMin(3);
        Assert.Equal(2, vila.Nivel);
    }

    [Fact]
    public void Fila_aceita_ate_10_itens()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        t.DarRecursos(r);
        for (var i = 0; i < 10; i++) Obras.Moradia(t.M, r, r.CasteloId);
        Assert.Throws<RegraException>(() => Obras.Moradia(t.M, r, r.CasteloId));
    }

    [Fact]
    public void Falta_recurso_recusa_sem_mexer_no_estoque()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = t.M.Locais[r.CasteloId];
        var antes = c.Estoque.Qtd("madeira");
        // um hexágono explorado e livre, de planície
        var hex = t.M.G.Area(c.Hex, 3).First(h => Obras.HexLivre(t.M, h) && !t.M.Mapa.Rio[h] && t.M.Mapa.Terrenos[h] == Jogo.Mapa.Terreno.Planicie);
        var ex = Assert.Throws<RegraException>(() => Obras.Fundar(t.M, r, "vila", hex));
        Assert.StartsWith("Faltam recursos", ex.Message);
        Assert.Equal(antes, c.Estoque.Qtd("madeira"));
    }

    [Fact]
    public void Fundar_local_novo_em_hexagono_livre()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        t.DarRecursos(r);
        var c = t.M.Locais[r.CasteloId];
        var hex = t.M.G.Area(c.Hex, 3).First(h => Obras.HexLivre(t.M, h) && !t.M.Mapa.Rio[h] && t.M.Mapa.Terrenos[h] == Jogo.Mapa.Terreno.Planicie);
        Obras.Fundar(t.M, r, "vila", hex);
        t.AvancarHoras(3);
        Assert.NotNull(t.M.LocalNoHex(hex));
        Assert.Equal(1, r.Fundados);
    }

    [Fact]
    public void Caminho_lento_bate_com_o_modelo_em_media()
    {
        var t = new MundoTeste();
        var a = t.M.Mapa.Vagas[0].Castelo; var b = t.M.Mapa.Vagas[1].Castelo;
        var rota = Caminhos.Calcular(t.M, a, b, "Lenta");
        var modelo = t.M.F.ViagemMin(t.M.G.Distancia(a, b), "Lenta", false);
        Assert.InRange(rota.TotalMin, modelo * 0.5, modelo * 1.6);
        Assert.Equal(b, rota.Hexes[^1]);
    }
}
