using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Testes;

/// <summary>Ritmo da população mostrado na barra do topo: pessoas por hora e quando nasce a próxima.</summary>
public class RitmoPopulacaoTestes
{
    public RitmoPopulacaoTestes() => AjustesTeste.Garantir();

    [Fact]
    public void Com_espaco_no_teto_cresce_e_a_proxima_pessoa_nasce_quando_o_ritmo_diz()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        Economia.Atualizar(t.M, r);
        var pop = (int)Math.Floor(r.Pop);
        var (porHora, proxima, _) = Economia.RitmoPopulacao(t.M, r);
        Assert.True(porHora > 0);
        Assert.NotNull(proxima);
        Assert.True(proxima > t.M.Agora);
        t.Avancar(TimeSpan.FromMilliseconds(proxima!.Value - t.M.Agora + 1000));
        Economia.Atualizar(t.M, r);
        Assert.Equal(pop + 1, (int)Math.Floor(r.Pop));
    }

    [Fact]
    public void Com_o_teto_cheio_nao_cresce()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        Economia.Atualizar(t.M, r);
        r.PopFracao = 0;
        r.Pop = Math.Max(1, Economia.Teto(t.M, r) - Economia.Tropas(t.M, r));
        var (porHora, proxima, _) = Economia.RitmoPopulacao(t.M, r);
        Assert.Equal(0, porHora, 6);
        Assert.Null(proxima);
    }
}
