using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Jogo.IA;

/// <summary>
/// Reinos de IA e meta de ocupação. Ganchos: vaga para jogador (abdicação), ids sorteados, sessão de cada reino de IA novo,
/// reino de IA que perde tudo abdica (não renasce) e a meta é conferida de novo. A IA nunca governa um reino de jogador:
/// o reino de quem está ausente fica como ele deixou, e o mundo segue para ele como para qualquer jogador offline.
/// Na subida (<see cref="AoIniciar"/>), com <c>m.IA.Ativa</c>, garante os eventos de cada reino (mundos de antes da IA).
/// Mundos gravados antes da decisão 0039: o reino de jogador perde a sessão de IA que sobrou e volta ao dono.
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
                if (r.EhIA && r.SessaoIAEventoId == null && r.PerfilIA != null) Sessoes.Agendar(mm, r);
            };
            Quedas.AoCair += (mm, r, _, q) =>
            {
                // reino de IA que perdeu tudo não renasce em exílio: abdica, e a meta é conferida de novo
                if (mm.IA.Ativa && r.EhIA && q.Exilio) { Ocupacao.Abdicar(mm, r); Ocupacao.Completar(mm); }
            };
            // memória de quem governa: quem ataca, saqueia ou captura fica marcado
            Combates.AoTerminar.Add((mm, rc) =>
            {
                if (mm.Reinos.Obter(rc.DefensorId) is { EhIA: true } def) Personas.Ofensa(mm, def, rc.AtacanteId, rc.AtacanteVenceu ? 0.45 : 0.25);
                // quem atacou e perdeu lembra de quem a venceu: não volta lá tão cedo (Governo.Atacar)
                if (!rc.AtacanteVenceu && rc.DefensorId != 0 && mm.Reinos.Obter(rc.AtacanteId) is { EhIA: true, Persona: not null } atk) Convivio.Marcar(mm, atk, "perdi:" + rc.DefensorId);
            });
            Exploracao.Capturas.AoCapturar += (mm, p) =>
            {
                if (mm.Reinos.Obter(p.DonoId) is { EhIA: true } dono) Personas.Ofensa(mm, dono, p.CaptorId, 0.25);
            };
            // ataque fora da sessão: se a pessoa está acordada e vê a notificação, entra para defender, com o atraso de quem reage
            Batalhas.AoComecar += (mm, b, l) =>
            {
                if (!mm.IA.Ativa || mm.Reinos.Obter(b.DefensorId) is not { EhIA: true, Persona: { Reflexo: > 0 } quem } def) return;
                if (def.ReacaoIAEventoId != null || Sessoes.De(mm, def) is not { } c || !Personas.Acordada(mm, def, c.C)) return;
                if (!Personas.Sorte(mm, def, "viu").Chance(0.25 + 0.5 * quem.Disciplina)) return;
                def.ReacaoIAEventoId = mm.Agendar(new ReacaoIAEvento { ReinoId = def.Id, Quando = mm.Agora + Personas.TempoDeReacao(mm, def, "ataque") }).Id;
                mm.Sujar(def);
            };
            // temporada nova: reserva de ids nova e a leva inicial de IA (o estado da IA foi apagado com o mundo)
            Temporada.Temporadas.AoReiniciar += mm =>
            {
                if (!mm.IA.Ativa) return;
                Ocupacao.ReservarIds(mm);
                Ocupacao.Completar(mm);
            };
        });
        DevolverAosDonos(m);
        if (!m.IA.Ativa) return;
        Ocupacao.ReservarIds(m);
        foreach (var r in m.Reinos.Where(x => x.Ativo && x.EhIA).ToList())
        {
            if (r.PerfilIA == null) continue;   // reino sem dono criado à mão (testes, ferramentas): ninguém governa
            Personas.Garantir(m, r);   // mundo de antes da persona: cada reino de IA ganha a sua
            if (r.SessaoIAEventoId is not long sid || m.Eventos.Obter(sid) is not SessaoIAEvento) Sessoes.Agendar(m, r);
        }
    }

    /// <summary>
    /// Mundo gravado antes da decisão 0039: um reino de jogador que a IA governava ainda tem sessões de IA marcadas.
    /// Elas são canceladas e o reino fica com o dono (o relatório e a verificação antigos já não são lidos ao carregar).
    /// </summary>
    public static void DevolverAosDonos(Mundo m)
    {
        foreach (var r in m.Reinos.Where(x => !x.EhIA).ToList())
        {
            if (r.SessaoIAEventoId == null && r.SessaoIA2EventoId == null && r.ReacaoIAEventoId == null) continue;
            m.Cancelar(r.SessaoIAEventoId); r.SessaoIAEventoId = null;
            m.Cancelar(r.SessaoIA2EventoId); r.SessaoIA2EventoId = null;
            m.Cancelar(r.ReacaoIAEventoId); r.ReacaoIAEventoId = null;
            m.Sujar(r);
        }
    }
}
