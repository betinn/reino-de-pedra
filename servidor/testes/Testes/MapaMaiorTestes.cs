using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Mapa;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Testes;

/// <summary>Mapa com hexágonos menores e construções que ocupam vários hexágonos (decisão 0026).</summary>
public class MapaMaiorTestes
{
    private static Local Castelo(MundoTeste t, Reino r) => t.M.Locais[r.CasteloId];

    [Fact]
    public void Mapa_tem_o_tamanho_do_balanceamento_e_as_vagas_cabem_com_as_pegadas()
    {
        var t = new MundoTeste();
        Assert.Equal(t.B.P.Mapa.Cols, t.M.G.Cols);
        Assert.Equal(t.B.P.Mapa.Lins, t.M.G.Lins);
        Assert.Equal(t.B.P.Reinos, t.M.Mapa.Vagas.Count);
        var usados = new HashSet<int>();
        foreach (var v in t.M.Mapa.Vagas)
        {
            var hs = CriacaoReino.Pegadas(t.M, v);
            Assert.Equal(t.B.P.Ocupa["castelo"] + 4 * t.B.P.Ocupa["vila"], hs.Count);   // nada se sobrepõe dentro da vaga
            Assert.All(hs, h => Assert.False(t.M.Mapa.Rio[h]));
            Assert.All(hs, h => Assert.True(usados.Add(h)));                           // nem entre vagas
        }
        // jazidas e ruínas ficam fora das pegadas iniciais
        Assert.DoesNotContain(t.M.Jazidas, j => usados.Contains(j.Hex));
        Assert.DoesNotContain(t.M.Ruinas, x => usados.Contains(x.Hex));
    }

    [Fact]
    public void Castelo_ocupa_sete_hexagonos_e_os_locais_tres()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        foreach (var h in t.M.G.Area(c.Hex, 1)) Assert.Same(c, t.M.LocalNoHex(h));
        Assert.Null(t.M.LocalNoHex(t.M.G.Area(c.Hex, 2).First(h => t.M.G.Distancia(h, c.Hex) == 2 && Pegada.DoLocal(t.M, c).All(x => x != h)
            && t.M.LocalNoHex(h) == null)));
        var vila = t.M.LocaisDe(r.Id).First(l => l.Tipo == TipoLocal.Vila);
        var pv = Pegada.DoLocal(t.M, vila).ToList();
        Assert.Equal(t.B.P.Ocupa["vila"], pv.Count);
        Assert.All(pv, h => Assert.Same(vila, t.M.LocalNoHex(h)));
        Assert.All(pv, h => Assert.Equal(t.M.G.L(vila.Hex), t.M.G.L(h)));   // leste e oeste, na mesma linha
        Assert.False(Obras.HexLivre(t.M, pv[1]));
    }

    [Fact]
    public void Fundar_exige_a_pegada_inteira_explorada_e_livre()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        // um hexágono de planície cujos vizinhos de leste e oeste estão livres
        var alvo = t.M.G.Area(c.Hex, 12).First(h => t.M.G.Distancia(h, c.Hex) >= 8 && t.M.Mapa.Terrenos[h] == Terreno.Planicie
            && Pegada.Hexes(t.M, TipoLocal.Vila, h).Count() == 3 && Pegada.Hexes(t.M, TipoLocal.Vila, h).All(x => Obras.HexLivre(t.M, x) && !t.M.Mapa.Rio[x]));
        var leste = Pegada.Hexes(t.M, TipoLocal.Vila, alvo).Last();
        Nevoas.Revelar(t.M, r.Id, [alvo]);
        Assert.Equal("Explore a área antes de fundar.", Obras.MotivoNaoFundar(t.M, r, "vila", alvo));
        Nevoas.RevelarArea(t.M, r.Id, alvo, 1);
        Assert.Null(Obras.MotivoNaoFundar(t.M, r, "vila", alvo));
        // um local no hexágono vizinho de leste tira o espaço
        var outro = t.M.AdicionarLocal(new Local { ReinoId = r.Id, Tipo = TipoLocal.Posto, Hex = leste, Nivel = 1, Nome = "Posto" });
        Assert.Equal("Não há espaço livre para o local aqui.", Obras.MotivoNaoFundar(t.M, r, "vila", alvo));
        t.M.RemoverLocal(outro);
        // duas fundações na fila não se sobrepõem
        t.DarRecursos(r);
        Obras.Fundar(t.M, r, "vila", alvo);
        Nevoas.RevelarArea(t.M, r.Id, alvo, 3);
        Assert.Equal("Já há uma fundação na fila neste lugar.", Obras.MotivoNaoFundar(t.M, r, "pasto", alvo));
    }

    [Fact]
    public void Tropas_mandadas_a_pegada_de_um_local_vao_ao_centro_dele()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        var vila = t.M.LocaisDe(r.Id).First(l => l.Tipo == TipoLocal.Vila);
        Economia.Atualizar(t.M, r);
        c.Guarnicao["lanceiro"] = 2; t.M.Sujar(c);
        var borda = Pegada.DoLocal(t.M, vila).First(h => h != vila.Hex);
        var ex = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 2 }, borda, OrdemMover.Id);
        Assert.Equal(vila.Hex, ex.Destino);
        Assert.Equal(vila.Id, ex.AlvoLocalId);
        t.Avancar(TimeSpan.FromMilliseconds(ex.Chegada - t.M.Agora + 1));
        Assert.False(t.M.Marchas.ContemId(ex.Id));          // entrou na vila (reforço)
        Assert.Equal(2, vila.Guarnicao.GetValueOrDefault("lanceiro"));
    }

    [Fact]
    public void Castelo_que_vira_ruina_encolhe_a_pegada()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        var borda = t.M.G.Area(c.Hex, 1).First(h => h != c.Hex && t.M.G.L(h) != t.M.G.L(c.Hex));
        Assert.Same(c, t.M.LocalNoHex(borda));
        c.Tipo = TipoLocal.Vila; c.Ruina = true;
        t.M.Reindexar(c);
        Assert.Null(t.M.LocalNoHex(borda));
        Assert.Same(c, t.M.LocalNoHex(c.Hex));
    }

    [Fact]
    public void Nevoa_e_gravada_comprimida_e_volta_igual()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var n = Nevoas.De(t.M, r.Id);
        Assert.Equal(t.M.G.Total * 4, n.Visto.Length);
        var z = n.VistoZ;
        Assert.True(z.Length < n.Visto.Length / 10, "comprimida: " + z.Length);
        var copia = new Nevoa { VistoZ = z };
        Assert.Equal(n.Visto, copia.Visto);
    }

    [Fact]
    public void Distancias_do_balanceamento_seguem_a_escala_nova()
    {
        var t = new MundoTeste();
        var F = t.M.F; var P = t.B.P;
        Assert.Equal(P.Torre.AlcanceBase + P.Torre.AlcancePorNivel, F.AlcanceTorre(1));
        Assert.True(P.Visao.Castelo > P.Visao.Local && P.Visao.Local > P.Visao.Tropa);
        // o castelo enxerga além da própria pegada e dos locais iniciais
        Assert.True(P.Visao.Castelo > P.MapaGen.AnelLocais);
    }
}
