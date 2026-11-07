using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.Pessoas
{
    public sealed partial class Pessoa
    {
        /// <summary>Vida que faltava (dano) no instante <see cref="DanoEm"/>; 0 = vida cheia. A de agora sai de <see cref="Vidas.Atual"/>.</summary>
        public double Dano { get; set; }
        public long DanoEm { get; set; }
        /// <summary>Soldado descansando no castelo: a vida volta no ritmo de <c>P.vida.repousoPorMin</c> desde <see cref="DanoEm"/>.</summary>
        public bool Repouso { get; set; }
    }

    /// <summary>
    /// Vida das pessoas, sem tique: guarda o dano e o instante, e a vida de agora sai da recuperação (a vida inteira volta em
    /// <c>P.vida.recuperaH</c> horas, em linha; soldado no próprio castelo, fora de batalha, recupera <c>P.vida.repousoPorMin</c>
    /// da vida por minuto). O máximo vem do ofício (<c>P.vida.max</c>). Fauna no caminho e batalhas tiram
    /// vida por aqui; quem chega a zero morre, e quem chama tira a pessoa do mundo (<see cref="Pessoas.Remover"/>) com o nome
    /// no relatório.
    /// </summary>
    public static class Vidas
    {
        /// <summary>Vida mínima de quem não pode morrer pelo dano (sobrevivente de batalha, último que leva relíquia).</summary>
        private const double Viva = 1;

        public static double Max(Mundo m, Pessoa p) => m.F.VidaMax(p.Oficio, p.EhCivil);

        /// <summary>Quanto de vida volta por hora.</summary>
        public static double PorHora(Mundo m, Pessoa p) =>
            p.Repouso ? Max(m, p) * m.P.Vida.RepousoPorMin * 60 : m.P.Vida.RecuperaH > 0 ? Max(m, p) / m.P.Vida.RecuperaH : 0;

        private static bool EmRepouso(Mundo m, Pessoa p) =>
            p.Estado == Estados.Guarnecida && p.GrupoId == null && Pessoas.EhSoldado(m, p) && p.LocalId is long id
            && m.Locais.Obter(id) is { Tipo: TipoLocal.Castelo, Ruina: false } l && l.ReinoId == p.ReinoId && Batalhas.Ativa(m, l.Id) == null;

        /// <summary>
        /// A situação da pessoa mudou (entrou, saiu, começou ou acabou uma batalha): fecha a conta no ritmo antigo e passa ao novo.
        /// Sem tique: o ritmo vale de <see cref="Pessoa.DanoEm"/> até a próxima mudança.
        /// </summary>
        public static void Reavaliar(Mundo m, Pessoa p)
        {
            var novo = EmRepouso(m, p);
            if (novo == p.Repouso) return;
            p.Dano = DanoEm(m, p); p.DanoEm = m.Agora;
            p.Repouso = novo;
            m.Sujar(p);
        }

        public static void ReavaliarLocal(Mundo m, Local l)
        {
            foreach (var p in m.PessoasNoLocal(l.Id).ToList()) Reavaliar(m, p);
        }

        /// <summary>Vida que falta no instante <paramref name="t"/> (agora, por padrão).</summary>
        public static double DanoEm(Mundo m, Pessoa p, long? t = null)
        {
            if (p.Dano <= 0) return 0;
            var porHora = PorHora(m, p);
            if (porHora <= 0) return p.Dano;
            var h = Math.Max(0, ((t ?? m.Agora) - p.DanoEm) / (double)T.Hora);
            return Math.Max(0, p.Dano - porHora * h);
        }

        public static double Atual(Mundo m, Pessoa p) => Math.Max(0, Max(m, p) - DanoEm(m, p));

        /// <summary>Está abaixo da vida máxima.</summary>
        public static bool Ferida(Mundo m, Pessoa p) => DanoEm(m, p) > 1e-6;

        /// <summary>Instante em que a vida volta inteira (ou null se já está cheia).</summary>
        public static long? CheiaEm(Mundo m, Pessoa p)
        {
            var d = DanoEm(m, p);
            var porHora = PorHora(m, p);
            if (d <= 1e-6 || porHora <= 0) return null;
            return m.Agora + (long)Math.Ceiling(d / porHora * T.Hora);
        }

        /// <summary>
        /// Tira <paramref name="dano"/> de vida (a recuperação até agora entra antes). Devolve true se a vida chegou a zero:
        /// a pessoa morre e quem chama a tira do mundo. <paramref name="semMorrer"/>: fica com pelo menos um pouco de vida.
        /// </summary>
        public static bool Ferir(Mundo m, Pessoa p, double dano, bool semMorrer = false)
        {
            if (dano <= 0) return false;
            var max = Max(m, p);
            var agora = DanoEm(m, p);
            var novo = Math.Min(max, agora + dano);
            if (semMorrer) novo = Math.Max(agora, Math.Min(novo, max - Viva));
            p.Dano = novo; p.DanoEm = m.Agora;
            m.Sujar(p);
            return novo >= max - 1e-9;
        }

        /// <summary>
        /// Fim de uma batalha: cada sobrevivente perde <c>P.vida.batalha</c> × <paramref name="fracPerdas"/> da vida máxima, sem
        /// morrer por isso (quem morre continua saindo da fórmula de perdas).
        /// </summary>
        public static void AposBatalha(Mundo m, IEnumerable<Pessoa> sobreviventes, double fracPerdas)
        {
            var f = Math.Clamp(fracPerdas, 0, 1) * m.P.Vida.Batalha;
            if (f <= 0) return;
            foreach (var p in sobreviventes) Ferir(m, p, f * Max(m, p), semMorrer: true);
        }

        /// <summary>"Inês (30 de 80)".</summary>
        public static string Rotulo(Mundo m, Pessoa p) => p.Nome + " (" + Math.Ceiling(Atual(m, p)) + " de " + Max(m, p) + ")";
    }
}
