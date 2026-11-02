using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Jogo.Valiosos
{
    using ReinoDePedra.Jogo.Nucleo;

    /// <summary>
    /// Gatilhos do transporte manual ("logistica": fundar o primeiro local longe do castelo) e das relíquias
    /// ("reliquias": avistar a primeira ruína antiga ou um farol, ou ter uma relíquia). Sem tique: o gatilho é
    /// conferido quando o fato acontece (fundação) e, de forma preguiçosa, quando o reino olha o próprio estado ou o mapa.
    /// </summary>
    [Sistema]
    public static class Apresentacao
    {
        public const string Logistica = "logistica", ReliquiasChave = "reliquias";

        public static void AoIniciar(Mundo m) => Sistemas.UmaVez("apresentacao-valiosos", () =>
        {
            Sistemas.Apresentavel(Logistica, "Transporte de recursos",
                "Carroças e tropas levam recursos de um local a outro. No caminho, a carga pode ser roubada.", "recursos", "caravana");
            Sistemas.Apresentavel(ReliquiasChave, "Relíquias",
                "Uma por reino no mundo, escavadas nas ruínas antigas. Fortalecem o local onde ficam e atraem confronto.", "reliquias", "reliquias");
            ObraFundar.AoFundar += (mm, r, l) => { if (Longe(mm, r, l)) Sistemas.Revelar(mm, r, Logistica); };
            Sistemas.Gatilhos.Add(Conferir);
        });

        /// <summary>O local está longe do castelo (fora da vista dele)?</summary>
        public static bool Longe(Mundo m, Reino r, Local l)
        {
            var c = m.Locais.Obter(r.CasteloId);
            return c != null && l.Id != c.Id && m.G.Distancia(c.Hex, l.Hex) > m.P.LogisticaLongeHex;
        }

        /// <summary>Confere os gatilhos (barato: poucos locais, poucas ruínas e relíquias).</summary>
        public static void Conferir(Mundo m, Reino r)
        {
            if (!Sistemas.Visto(r, Logistica) && m.LocaisDe(r.Id).Any(l => !l.Ruina && Longe(m, r, l)))
                Sistemas.Revelar(m, r, Logistica);
            if (!Sistemas.Visto(r, ReliquiasChave) && GatilhoReliquias(m, r))
                Sistemas.Revelar(m, r, ReliquiasChave);
        }

        private static bool GatilhoReliquias(Mundo m, Reino r)
        {
            if (m.Reliquias.Any(x => x.ReinoId == r.Id)) return true;
            var n = Nevoas.De(m, r.Id);
            if (m.Ruinas.Any(x => n.MinutoVisto(x.Hex) > 0)) return true;
            return ReliquiasLendarias.Concentracoes(m).Any(c => c.Value >= m.P.ReliquiaVis.Farol);
        }
    }
}
