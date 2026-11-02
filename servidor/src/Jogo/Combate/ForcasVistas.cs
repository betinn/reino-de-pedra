using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Combate
{
    /// <summary>
    /// Forças de outro reino vistas pelos locais, torres e tropas de um reino: depois que saem da visão, ficam no mapa como
    /// "visto há X" por P.avistamentoH, no último hexágono em que foram vistas, e somem sozinhas (evento de expiração).
    /// Sem dono, sem id da marcha para o cliente: só tipo, tamanho aproximado e para onde iam.
    /// </summary>
    public sealed class ForcaVista : Documento
    {
        /// <summary>Reino que viu.</summary>
        public long ReinoId { get; set; }
        public long MarchaId { get; set; }
        public int Hex { get; set; }
        /// <summary>Quando foi vista pela última vez.</summary>
        public long Quando { get; set; }
        /// <summary>Some do mapa neste instante.</summary>
        public long Ate { get; set; }
        /// <summary>Tipo da marcha ("exercito", "carregadores"...).</summary>
        public string Marcha { get; set; } = "";
        public int Tropas { get; set; }
        /// <summary>Direção para onde seguia ("norte", "sudeste"...).</summary>
        public string? Rumo { get; set; }
    }

    /// <summary>
    /// Avistamentos de forças desconhecidas. Na partida de cada marcha interceptável, para cada outro reino, procura o trecho do
    /// caminho que passa pela visão dele (locais, torres e outras fontes de visão; tropas dele onde estão na partida) e agenda um
    /// evento no instante em que a marcha sai da visão (ou chega, se o caminho acaba à vista). Nada varre o mundo.
    /// </summary>
    public static class ForcasVistas
    {
        /// <summary>Hexágonos que o reino vê, sem marcar a névoa (para prever o caminho de outra marcha).</summary>
        public static HashSet<int> Visao(Mundo m, long reinoId)
        {
            var vis = new HashSet<int>();
            foreach (var l in m.LocaisDe(reinoId))
                if (!l.Ruina) foreach (var h in m.G.Area(l.Hex, Nevoas.RaioLocal(m, l))) vis.Add(h);
            var agora = m.Agora;
            foreach (var mc in m.Marchas)
                if (mc.ReinoId == reinoId) foreach (var h in m.G.Area(mc.HexEm(agora), mc.RaioVisao(m))) vis.Add(h);
            foreach (var f in Nevoas.FontesDeVisao) foreach (var h in f(m, reinoId)) vis.Add(h);
            return vis;
        }

        internal static void AoPartir(Mundo m, Marcha mc)
        {
            if (!mc.Interceptavel || mc.Caminho.Count < 2) return;
            foreach (var w in m.Reinos)
            {
                if (!w.Ativo || w.Id == mc.ReinoId) continue;
                var vis = Visao(m, w.Id);
                var i = -1;
                for (var k = 0; k < mc.Caminho.Count; k++) if (vis.Contains(mc.Caminho[k])) { i = k; break; }
                if (i < 0) continue;
                var j = i;
                while (j + 1 < mc.Caminho.Count && vis.Contains(mc.Caminho[j + 1])) j++;
                var sai = j + 1 < mc.Caminho.Count ? mc.Tempos[j + 1] : mc.Tempos[j];
                m.Agendar(new ForcaVistaEvento { ReinoId = w.Id, MarchaId = mc.Id, Partida = mc.Partida, Indice = j, Quando = sai });
            }
        }

        public static IEnumerable<ForcaVista> De(Mundo m, long reinoId) => m.ForcasVistas.Where(f => f.ReinoId == reinoId && f.Ate > m.Agora);

        /// <summary>Registra (ou atualiza) que o reino viu a marcha agora no hexágono; some depois de P.avistamentoH.</summary>
        public static ForcaVista Registrar(Mundo m, long reinoId, Marcha mc, int hex, string? rumo)
        {
            var f = m.ForcasVistas.FirstOrDefault(x => x.ReinoId == reinoId && x.MarchaId == mc.Id)
                    ?? m.ForcasVistas.Adicionar(new ForcaVista { ReinoId = reinoId, MarchaId = mc.Id });
            f.Hex = hex; f.Quando = m.Agora; f.Ate = m.Agora + T.DeHoras(m.P.AvistamentoH);
            f.Marcha = mc.Tipo; f.Tropas = GT.Total(mc.Tropas); f.Rumo = rumo;
            m.Sujar(f);
            m.Agendar(new FimForcaVistaEvento { ForcaId = f.Id, Ate = f.Ate, Quando = f.Ate });
            m.Avisar(reinoId, "mapa");
            return f;
        }
    }

    /// <summary>A marcha sai da visão do reino (ou chega ao fim do caminho à vista): fica o "visto há X".</summary>
    public sealed class ForcaVistaEvento : Evento
    {
        public long ReinoId { get; set; }
        public long MarchaId { get; set; }
        public long Partida { get; set; }
        public int Indice { get; set; }
        public override void Executar(Mundo m)
        {
            var mc = m.Marchas.Obter(MarchaId);
            if (mc == null || mc.Partida != Partida || Indice >= mc.Caminho.Count) return;
            var hex = mc.Caminho[Indice];
            var rumo = Indice + 1 < mc.Caminho.Count ? m.G.Direcao(hex, mc.Caminho[Indice + 1]) : null;
            ForcasVistas.Registrar(m, ReinoId, mc, hex, rumo);
        }
    }

    /// <summary>O avistamento some do mapa (se não foi visto de novo depois).</summary>
    public sealed class FimForcaVistaEvento : Evento
    {
        public long ForcaId { get; set; }
        public long Ate { get; set; }
        public override void Executar(Mundo m)
        {
            if (m.ForcasVistas.Obter(ForcaId) is not { } f || f.Ate != Ate) return;
            m.ForcasVistas.Remover(f);
            m.Avisar(f.ReinoId, "mapa");
        }
    }
}

namespace ReinoDePedra.Jogo
{
    public sealed partial class Mundo
    {
        public Colecao<Combate.ForcaVista> ForcasVistas { get; } = new("forcas-vistas");
    }
}
