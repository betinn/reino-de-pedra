using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Nucleo;

namespace ReinoDePedra.Api.Visoes;

/// <summary>Sistemas apresentados aos poucos: GET /reino leva "sistemas" ({ chave: já apareceu }) para RP.sistema(k).</summary>
[Sistema]
public static class VisaoSistemas
{
    public static void AoIniciar(Mundo m) => Sistemas.UmaVez("api-sistemas", () =>
    {
        VisaoReino.Extras.Add((mm, r, d) => d["sistemas"] = Sistemas.Estado(mm, r));
    });
}
