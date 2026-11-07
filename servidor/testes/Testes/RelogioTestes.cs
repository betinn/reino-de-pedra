using ReinoDePedra.Jogo.Nucleo;

namespace ReinoDePedra.Testes;

public class RelogioTestes
{
    [Fact]
    public void Relogio_acelerado_retoma_de_onde_o_mundo_parou()
    {
        var r = new RelogioReal(6);
        var salvo = r.Agora + T.Dia;
        r.RetomarEm(salvo);
        Assert.True(r.Agora >= salvo);
        Assert.True(r.Agora < salvo + T.Hora);
    }

    [Fact]
    public void Relogio_normal_nunca_sai_da_hora_real()
    {
        var r = new RelogioReal();
        var antes = r.Agora;
        r.RetomarEm(antes + T.Dia);
        Assert.True(r.Agora < antes + T.Hora);
    }
}
