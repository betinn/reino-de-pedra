using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Jogo.Reinos
{
    public sealed partial class Reino
    {
        /// <summary>Sistemas já apresentados ao jogador (ver <see cref="Nucleo.Sistemas.Revelar"/>).</summary>
        public HashSet<string> SistemasVistos { get; set; } = new();
    }
}

namespace ReinoDePedra.Jogo.Nucleo
{
    /// <summary>
    /// Sistemas apresentados aos poucos (CLAUDE.md, Experiência do jogador): nada é bloqueado, mas os menus de um sistema
    /// só aparecem depois do gatilho. Cada sistema registra a sua chave com <see cref="Revelavel"/> em AoIniciar e chama
    /// <see cref="Revelar"/> no gatilho. O cliente recebe <see cref="Estado"/> em GET /reino ("sistemas") e lê com RP.sistema(k).
    /// Chaves que ninguém registrou não vão ao cliente (e ele as mostra sempre).
    /// </summary>
    public static partial class Sistemas
    {
        private static readonly Dictionary<string, (string Nome, string? Texto)> _revelaveis = new();

        /// <summary>Registra um sistema que aparece aos poucos: nome e texto curto do aviso "Novo: ...".</summary>
        public static void Revelavel(string chave, string nome, string? texto)
        {
            lock (_revelaveis) _revelaveis[chave] = (nome, texto);
        }

        public static IReadOnlyCollection<string> Revelaveis { get { lock (_revelaveis) return _revelaveis.Keys.ToList(); } }

        public static bool Visto(Reino r, string chave) => r.SistemasVistos.Contains(chave);

        /// <summary>Apresenta o sistema ao reino (uma vez): guarda, notifica "Novo: ..." e avisa o cliente. Devolve se era novo.</summary>
        public static bool Revelar(Mundo m, Reino r, string chave, string? link = null)
        {
            if (!r.SistemasVistos.Add(chave)) return false;
            m.Sujar(r);
            (string Nome, string? Texto) x;
            lock (_revelaveis) x = _revelaveis.TryGetValue(chave, out var v) ? v : (chave, null);
            Registros.Notificar(m, r.Id, "reino", "Novo: " + x.Nome, x.Texto, link);
            m.Avisar(r.Id, "reino");
            return true;
        }

        /// <summary>
        /// Gatilhos conferidos antes de mostrar o estado ao cliente, para o que pode mudar por fora dos eventos do sistema
        /// (ex.: uma ferraria que veio por ocupação). Registre dentro de Sistemas.UmaVez.
        /// </summary>
        public static List<Action<Mundo, Reino>> Gatilhos { get; } = new();

        /// <summary>Chave → já apareceu para o reino (só as chaves registradas), depois de conferir os <see cref="Gatilhos"/>.</summary>
        public static Dictionary<string, bool> Estado(Mundo m, Reino r)
        {
            foreach (var g in Gatilhos) g(m, r);
            return Revelaveis.ToDictionary(k => k, r.SistemasVistos.Contains);
        }
    }
}
