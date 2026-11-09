using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Jogo.Temporada
{
    /// <summary>
    /// Gatilhos dos sistemas apresentados aos poucos que faltavam (CLAUDE.md, Experiência do jogador):
    /// espionagem, ao ver o primeiro espião ou sofrer o primeiro ataque; torres de arqueiros ("defesas"), ao ver forças
    /// de outro reino perto (uma marcha de outro reino, não aliado, entrando na visão dos seus locais e tropas).
    /// </summary>
    public static class GatilhosRestantes
    {
        public const string Espionagem = "espionagem", Defesas = "defesas";

        internal static void Registrar()
        {
            Sistemas.Revelavel(Espionagem, "Espionagem", "Batedores de elite revelam o estoque, a guarnição e as relíquias de um local.", "reino", "exploradores?tipo=batedor");
            Sistemas.Revelavel(Defesas, "Torres de arqueiros", "Arqueiros no alto protegem os locais em volta. O invasor precisa derrubar a torre.", "reino", "construcao?aba=defesas");
            Exploracao.Avistamentos.AoRegistrar += (m, a) =>
            {
                if (a.Tipo == "espiao" && m.Reinos.Obter(a.ReinoId) is { } r) Sistemas.Revelar(m, r, Espionagem);
            };
            Combates.AoTerminar.Add((m, rc) =>
            {
                if (rc.DefensorId != 0 && rc.DefensorId != rc.AtacanteId && m.Reinos.Obter(rc.DefensorId) is { } d) Sistemas.Revelar(m, d, Espionagem);
            });
            Marcha.AoPartir.Add(AoPartir);
            // reinos de antes destes gatilhos: quem já tem torre ou já espionou viu o sistema
            Sistemas.Gatilhos.Add((m, r) =>
            {
                if (!Sistemas.Visto(r, Defesas) && Combate.Defesas.DoReino(m, r.Id).Any()) Sistemas.Revelar(m, r, Defesas);
                if (!Sistemas.Visto(r, Espionagem) && r.LocaisEspionados.Count > 0) Sistemas.Revelar(m, r, Espionagem);
            });
        }

        /// <summary>Forças de outro reino que vão passar pela visão de quem ainda não viu as torres: agenda o gatilho no instante.</summary>
        private static void AoPartir(Mundo m, Marcha mc)
        {
            if (!mc.Interceptavel || mc.Caminho.Count < 1 || mc.Retornando) return;
            foreach (var w in m.Reinos)
            {
                if (!w.Ativo || w.Id == mc.ReinoId || Sistemas.Visto(w, Defesas) || Aliancas.SaoAliados(m, w.Id, mc.ReinoId)) continue;
                var vis = Combate.Avistamentos.Visao(m, w.Id);
                var i = mc.Caminho.FindIndex(vis.Contains);
                if (i < 0) continue;
                m.Agendar(new GatilhoDefesasEvento { ReinoId = w.Id, MarchaId = mc.Id, Partida = mc.Partida, Quando = mc.Tempos[i] });
            }
        }
    }

    /// <summary>Forças de outro reino entram na visão do reino: as torres de arqueiros aparecem.</summary>
    public sealed class GatilhoDefesasEvento : Evento
    {
        public long ReinoId { get; set; }
        public long MarchaId { get; set; }
        public long Partida { get; set; }
        public override void Executar(Mundo m)
        {
            if (m.Marchas.Obter(MarchaId) is not { } mc || mc.Partida != Partida) return;
            if (m.Reinos.Obter(ReinoId) is { Ativo: true } r) Sistemas.Revelar(m, r, GatilhosRestantes.Defesas);
        }
    }
}
