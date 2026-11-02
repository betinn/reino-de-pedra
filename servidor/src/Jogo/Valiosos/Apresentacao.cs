using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Jogo.Reinos
{
    public sealed partial class Reino
    {
        /// <summary>Sistemas já apresentados ao jogador ("logistica", "reliquias"...). Os outros ficam escondidos no cliente.</summary>
        public HashSet<string> SistemasVistos { get; set; } = new();
    }
}

namespace ReinoDePedra.Jogo.Nucleo
{
    /// <summary>Sistema que o jogo apresenta aos poucos: nome e texto do aviso "Novo: ...", categoria da notificação e rota do cliente.</summary>
    public sealed record SistemaApresentado(string Chave, string Nome, string Texto, string Categoria, string? Link);

    /// <summary>
    /// Sistemas apresentados aos poucos (CLAUDE.md, Experiência do jogador): nada é bloqueado, mas menus e botões de um
    /// sistema só aparecem no cliente depois do gatilho. Cada sistema registra a chave em <see cref="Apresentavel"/>
    /// (no AoIniciar) e chama <see cref="Revelar"/> quando o gatilho acontece. O cliente lê <c>GET /reino → sistemas</c>.
    /// </summary>
    public static partial class Sistemas
    {
        private static readonly Dictionary<string, SistemaApresentado> _apresentaveis = new();

        /// <summary>Sistemas registrados (chave → apresentação). Só eles aparecem em <c>sistemas</c> do reino.</summary>
        public static IReadOnlyDictionary<string, SistemaApresentado> Apresentaveis
        {
            get { lock (_apresentaveis) return new Dictionary<string, SistemaApresentado>(_apresentaveis); }
        }

        /// <summary>Registra um sistema apresentado aos poucos. Chame dentro de <see cref="UmaVez"/>.</summary>
        public static void Apresentavel(string chave, string nome, string texto, string categoria = "reino", string? link = null)
        {
            lock (_apresentaveis) _apresentaveis[chave] = new SistemaApresentado(chave, nome, texto, categoria, link);
        }

        public static bool Visto(Reino r, string chave) => r.SistemasVistos.Contains(chave);

        /// <summary>
        /// Apresenta o sistema ao reino (uma vez): marca como visto e manda a notificação "Novo: nome". Devolve true se era novo.
        /// </summary>
        public static bool Revelar(Mundo m, Reino r, string chave)
        {
            if (!r.SistemasVistos.Add(chave)) return false;
            m.Sujar(r);
            SistemaApresentado? a;
            lock (_apresentaveis) a = _apresentaveis.GetValueOrDefault(chave);
            Registros.Notificar(m, r.Id, a?.Categoria ?? "reino", "Novo: " + (a?.Nome ?? chave), a?.Texto, a?.Link);
            m.Avisar(r.Id, "reino");
            return true;
        }

        /// <summary>Estado de cada sistema registrado para o reino (true = já apareceu).</summary>
        public static Dictionary<string, bool> Estado(Reino r)
        {
            lock (_apresentaveis) return _apresentaveis.Keys.ToDictionary(k => k, r.SistemasVistos.Contains);
        }
    }
}

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
