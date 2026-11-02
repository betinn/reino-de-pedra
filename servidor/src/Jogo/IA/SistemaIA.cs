using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Jogo.IA;

/// <summary>
/// Reinos de IA, meta de ocupação e regência. Ganchos: vaga para jogador (abdicação), ids sorteados, sessão de cada reino
/// de IA novo, verificação de regência de cada reino de jogador, reino de IA que perde tudo abdica (não renasce) e a meta
/// é conferida de novo, perdas da regência e a aliança que não passa a liderança a quem está em regência.
/// Na subida (<see cref="AoIniciar"/>), com <c>m.IA.Ativa</c>, garante os eventos de cada reino (mundos de antes da IA).
/// A leva inicial e a meta são completadas por <see cref="Ocupacao.Completar"/>, chamada pelo servidor depois de todos os sistemas
/// e de novo a cada reset da temporada (<see cref="Temporada.Temporadas.AoReiniciar"/>).
/// </summary>
[Sistema]
public static class SistemaIA
{
    public static void AoIniciar(Mundo m)
    {
        Sistemas.UmaVez("ia", () =>
        {
            CriacaoReino.LiberarVagaDeIA = mm => mm.IA.Ativa && mm.IA.CriarReinos ? Ocupacao.LiberarVaga(mm) : -1;
            CriacaoReino.IdNovo = Ocupacao.IdNovo;
            CriacaoReino.AoCriar += (mm, r) =>
            {
                if (!mm.IA.Ativa) return;
                if (r.EhIA) { if (r.SessaoIAEventoId == null && r.PerfilIA != null) Sessoes.Agendar(mm, r); }
                else Regencia.Agendar(mm, r);
            };
            Quedas.AoCair += (mm, r, _, q) =>
            {
                Regencia.AoCair(mm, r, q);
                // reino de IA que perdeu tudo não renasce em exílio: abdica, e a meta é conferida de novo
                if (mm.IA.Ativa && r.EhIA && q.Exilio) { Ocupacao.Abdicar(mm, r); Ocupacao.Completar(mm); }
            };
            Combates.AoTerminar.Add(Regencia.AoTerminarBatalha);
            Aliancas.EmRegencia = (_, r) => r.EmRegencia;
            // temporada nova: reserva de ids nova e a leva inicial de IA (o estado da IA foi apagado com o mundo)
            Temporada.Temporadas.AoReiniciar += mm =>
            {
                if (!mm.IA.Ativa) return;
                Ocupacao.ReservarIds(mm);
                Ocupacao.Completar(mm);
            };
        });
        if (!m.IA.Ativa) return;
        Ocupacao.ReservarIds(m);
        foreach (var r in m.Reinos.Where(x => x.Ativo).ToList())
        {
            if (r.EhIA || r.EmRegencia)
            {
                if (r.EhIA && r.PerfilIA == null) continue;   // reino sem dono criado à mão (testes, ferramentas): ninguém governa
                if (r.SessaoIAEventoId is not long sid || m.Eventos.Obter(sid) is not SessaoIAEvento) Sessoes.Agendar(m, r);
            }
            else Regencia.Agendar(m, r);
        }
    }
}
