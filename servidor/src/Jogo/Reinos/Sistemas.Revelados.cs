using System.Collections.Concurrent;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Jogo.Reinos
{
    public sealed partial class Reino
    {
        /// <summary>Sistemas já apresentados ao jogador ("alianca", "comercio"...): ver <see cref="Nucleo.Sistemas.Revelar"/>.</summary>
        public HashSet<string> SistemasVistos { get; set; } = new();
    }
}

namespace ReinoDePedra.Jogo.Nucleo
{
    /// <summary>Um sistema apresentado aos poucos: nome e texto do aviso "Novo: ..." e a tela que ele abre.</summary>
    public sealed record SistemaRevelavel(string Nome, string Texto, string? Link);

    /// <summary>
    /// Sistemas apresentados aos poucos (CLAUDE.md, Experiência do jogador): nada é bloqueado, mas os menus de um sistema
    /// só aparecem depois do gatilho. Cada sistema registra a chave em AoIniciar (<see cref="Registrar"/>) e chama
    /// <see cref="Revelar"/> no gatilho. GET /reino manda <c>"sistemas": { chave: visto }</c> só das chaves registradas
    /// (o cliente mostra o que não estiver na lista).
    /// </summary>
    public static partial class Sistemas
    {
        public static ConcurrentDictionary<string, SistemaRevelavel> Revelaveis { get; } = new();

        public static void Registrar(string chave, string nome, string texto, string? link = null) =>
            Revelaveis[chave] = new SistemaRevelavel(nome, texto, link);

        public static bool Visto(Reino r, string chave) => r.SistemasVistos.Contains(chave);

        /// <summary>Apresenta o sistema ao reino (uma vez): notifica "Novo: ..." e avisa o cliente. Devolve false se já tinha visto.</summary>
        public static bool Revelar(Mundo m, Reino r, string chave)
        {
            if (!r.SistemasVistos.Add(chave)) return false;
            m.Sujar(r);
            if (Revelaveis.TryGetValue(chave, out var s))
                Registros.Notificar(m, r.Id, "reino", "Novo: " + s.Nome, s.Texto, s.Link);
            m.Avisar(r.Id, "reino");
            return true;
        }

        /// <summary>Estado de cada sistema registrado para o reino (chave → já apresentado).</summary>
        public static Dictionary<string, bool> Estado(Reino r) =>
            Revelaveis.Keys.OrderBy(k => k, StringComparer.Ordinal).ToDictionary(k => k, k => r.SistemasVistos.Contains(k));
    }
}
