using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.IA;
using ReinoDePedra.Jogo.Nucleo;

namespace ReinoDePedra.Api.Visoes;

/// <summary>
/// Regência no GET /reino: o jogador que volta (o GET já atualizou o último acesso) retoma o reino, e o estado leva
/// <c>"regencia": { ativaDesde, terminouEm, acoes: [texto], perdas: [texto] }</c> da última regência (null se nunca houve).
/// Nada aqui diz se um reino é de IA: só o próprio jogador recebe este campo, e todo reino de jogador o tem.
/// </summary>
[Sistema]
public static class VisaoRegencia
{
    public static void AoIniciar(Mundo m) => Sistemas.UmaVez("api-regencia", () =>
    {
        VisaoReino.Extras.Add((mm, r, d) =>
        {
            Regencia.AoEntrar(mm, r);
            d["regencia"] = Montar(r.Regencia);
        });
    });

    public static object? Montar(RegistroRegencia? g) => g == null ? null : new
    {
        ativaDesde = g.AtivaDesde,
        terminouEm = g.TerminouEm,
        acoes = g.Acoes.Select(Regencia.Texto).ToList(),
        perdas = g.Perdas.Select(Regencia.Texto).ToList(),
    };
}
