using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Forja;
using ReinoDePedra.Jogo.IA;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using ReinoDePedra.Jogo.Temporada;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Testes;

/// <summary>Regras que a revisão encontrou quebradas: criação em vaga ocupada, reforço aliado, filas, reset, população.</summary>
public class RegrasRevisaoTestes
{
    public RegrasRevisaoTestes() => AjustesTeste.Garantir();

    private static Dictionary<string, int> G(params (string k, int n)[] g) => g.ToDictionary(x => x.k, x => x.n);
    private static void Conhecer(Mundo m, Reino a, Reino b) { Conhecimento.Conhecer(m, a, b, "teste"); Conhecimento.Conhecer(m, b, a, "teste"); }
    private static void AvancarAte(MundoTeste t, long instante) { t.Avancar(TimeSpan.FromMilliseconds(Math.Max(0, instante - t.M.Agora))); AjustesTeste.FalharSeErro(); }

    private static void Aliar(MundoTeste t, Reino lider, Reino outro)
    {
        var a = Aliancas.Criar(t.M, lider, "Liga " + lider.Id);
        Conhecer(t.M, lider, outro);
        Aliancas.Convidar(t.M, lider, outro.Id);
        Aliancas.AceitarConvite(t.M, outro, a.Id);
    }

    // ---------------------------------------------------------------- criação de reino

    [Fact]
    public void Reino_novo_nao_apaga_locais_de_outro_reino_nos_hexagonos_da_vaga()
    {
        var t = new MundoTeste();
        var a = t.NovoReino(); var b = t.NovoReino();
        Assert.Equal(0, a.Vaga);
        // b ocupa a vila inicial de a e põe tropas; a sai da vaga (exílio) e deixa os outros locais
        var vila = t.M.LocaisDe(a.Id).First(l => l.Tipo == TipoLocal.Vila);
        Efeitos.Ocupar(t.M, vila, b);
        vila.Guarnicao["lanceiro"] = 20;
        foreach (var l in t.M.LocaisDe(a.Id).Where(l => l.Id != vila.Id).ToList()) { l.Ruina = true; t.M.MudarDono(l, 0); }
        a.Vaga = t.M.Mapa.Vagas.Count - 1;
        // b funda um local num hexágono da vaga 2, ainda vazia
        var v2 = t.M.Mapa.Vagas[2];
        var fundado = t.M.AdicionarLocal(new Local { ReinoId = b.Id, Tipo = TipoLocal.Vila, Produz = "comida", Hex = v2.Comida, Nivel = 1, Nome = "Vila do Vau" });
        // uma ruína sem dono com relíquia guardada na vaga 3 também não pode sumir
        var v3 = t.M.Mapa.Vagas[3];
        var ruina = t.M.AdicionarLocal(new Local { ReinoId = 0, Ruina = true, Tipo = TipoLocal.Vila, Produz = "comida", Hex = v3.Comida, Nivel = 1, Nome = "Ruína" });
        var rel = t.M.Reliquias.Adicionar(new Reliquia { Nome = "Cálice", Tipo = "producao", LocalId = ruina.Id });

        var c = t.NovoReino();
        Assert.NotEqual(0, c.Vaga);
        Assert.NotEqual(2, c.Vaga);
        Assert.NotEqual(3, c.Vaga);
        Assert.Same(vila, t.M.Locais.Obter(vila.Id));
        Assert.Equal(b.Id, vila.ReinoId);
        Assert.Equal(20, vila.Guarnicao["lanceiro"]);
        Assert.Same(fundado, t.M.Locais.Obter(fundado.Id));
        Assert.Same(ruina, t.M.Locais.Obter(ruina.Id));
        Assert.Equal(ruina.Id, rel.LocalId);
        Assert.False(CriacaoReino.VagaUtilizavel(t.M, t.M.Mapa.Vagas[0]));
        Assert.Throws<RegraException>(() => CriacaoReino.Criar(t.M, 9998, "Lumiar", new Brasao(), 0));
        Assert.Same(vila, t.M.Locais.Obter(vila.Id));
        foreach (var regiao in Regioes.Nomes.Keys) Assert.DoesNotContain(CriacaoReino.VagaPerto(t.M, regiao), new[] { 0, 2, 3 });
        // a vaga com só ruínas sem dono (e sem relíquia) volta a servir: as ruínas dão lugar
        vila.Ruina = true; vila.Guarnicao.Clear(); t.M.MudarDono(vila, 0);
        Assert.True(CriacaoReino.VagaUtilizavel(t.M, t.M.Mapa.Vagas[0]));
        var d = CriacaoReino.Criar(t.M, 9999, "Lumiar", new Brasao(), 0);
        Assert.Equal(d.Id, t.M.LocalNoHex(t.M.Mapa.Vagas[0].Comida)!.ReinoId);
    }

    [Fact]
    public void Todas_as_vagas_de_um_mundo_novo_servem()
    {
        foreach (var semente in new ulong[] { 7, 42, 99 })
        {
            var t = new MundoTeste(semente, fauna: true);
            Assert.All(t.M.Mapa.Vagas, v => Assert.True(CriacaoReino.VagaUtilizavel(t.M, v)));
        }
    }

    [Fact]
    public void Abdicacao_para_jogador_nao_escolhe_vaga_que_o_jogador_nao_pode_usar()
    {
        var t = MundoIA.Novo(criar: false);
        var j = MundoIA.Jogador(t, 0);
        var ia = MundoIA.Criar(t, "defensivo");
        // um jogador tem um local num hexágono da vaga da IA: a vaga dela não serve
        var v = t.M.Mapa.Vagas[ia.Vaga];
        var vila = t.M.LocalNoHex(v.Comida)!;
        Efeitos.Ocupar(t.M, vila, j);
        Assert.Equal(-1, Ocupacao.LiberarVaga(t.M));
        Assert.True(ia.Ativo);
    }
}
