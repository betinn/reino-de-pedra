using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.Temporada
{
    /// <summary>
    /// Regras do legado: nível da linhagem e desbloqueios, relíquias da temporada equipadas (teto somado P.legado.teto, que entra
    /// também no teto de bônus de combate porque o bônus vai pelos ganchos de <c>Combate.Bonus</c>) e títulos.
    /// </summary>
    public static class Linhagem
    {
        public const string Producao = "producao", Ataque = "ataque", Defesa = "defesa", Crescimento = "crescimento";
        public static readonly string[] Tipos = [Producao, Ataque, Defesa, Crescimento];

        public static int Nivel(Mundo m, LegadoConta? l)
        {
            var L = m.P.TemporadaServ.Linhagem;
            if (l == null) return L.Inicial;
            return Math.Min(L.Max, L.Inicial + l.TemporadasJogadas + l.Reliquias.Count);
        }
        public static int NivelDaConta(Mundo m, long? contaId) => contaId is long c ? Nivel(m, m.Legados.Obter(c)) : m.P.TemporadaServ.Linhagem.Inicial;

        public static bool Libera(Mundo m, long? contaId, int nivel) => NivelDaConta(m, contaId) >= nivel;
        public static bool BrasoesExtras(Mundo m, long? contaId) => Libera(m, contaId, m.P.TemporadaServ.Desbloqueios.Brasoes);
        public static bool Moldura(Mundo m, long? contaId) => Libera(m, contaId, m.P.TemporadaServ.Desbloqueios.Moldura);
        public static bool Titulos(Mundo m, long? contaId) => Libera(m, contaId, m.P.TemporadaServ.Desbloqueios.Titulos);
        public static bool RegiaoInicial(Mundo m, long? contaId) => Libera(m, contaId, m.P.TemporadaServ.Desbloqueios.Regiao);
        public static bool RegiaoExilio(Mundo m, long? contaId) => Libera(m, contaId, m.P.TemporadaServ.Desbloqueios.Exilio);

        /// <summary>Soma dos bônus equipados (antes do teto).</summary>
        public static double SomaEquipadas(LegadoConta l) => l.Reliquias.Where(r => r.Equipada).Sum(r => r.Bonus);

        /// <summary>
        /// Bônus efetivo de um tipo: a soma das equipadas daquele tipo; se a soma de todas passa do teto, todas encolhem na mesma
        /// proporção (a soma efetiva fica no teto).
        /// </summary>
        public static double Bonus(Mundo m, LegadoConta? l, string tipo)
        {
            if (l == null || l.Reliquias.Count == 0) return 0;
            var soma = SomaEquipadas(l);
            if (soma <= 0) return 0;
            var fator = Math.Min(1, m.P.Legado.Teto / soma);
            return l.Reliquias.Where(r => r.Equipada && r.Tipo == tipo).Sum(r => r.Bonus) * fator;
        }
        /// <summary>Bônus do legado do dono do reino (IA e reinos sem conta: 0).</summary>
        public static double BonusReino(Mundo m, long reinoId, string tipo) =>
            m.Reinos.Obter(reinoId) is { ContaId: long c } ? Bonus(m, m.Legados.Obter(c), tipo) : 0;

        public static void Equipar(Mundo m, long contaId, long reliquiaId, bool equipar)
        {
            var l = m.Legados.De(contaId);
            var rel = l.Reliquias.FirstOrDefault(r => r.Id == reliquiaId) ?? throw new RegraException("Relíquia da temporada não encontrada.", 404);
            if (rel.Equipada == equipar) return;
            if (equipar && l.Reliquias.Count(r => r.Equipada) >= m.P.Legado.Equipadas)
                throw new RegraException("Até " + m.P.Legado.Equipadas + " equipadas. Tire uma para equipar outra.");
            foreach (var r in m.Reinos) if (r.Ativo && r.ContaId == contaId) Economia.Atualizar(m, r);   // produção em dia antes de mudar o bônus
            rel.Equipada = equipar;
            m.Legados.Salvar(m, l);
            AvisarReino(m, contaId);
        }

        /// <summary>Títulos que a conta tem: os da linhagem (pelo nível) e os ganhos por conquista.</summary>
        public static List<(string nome, string como, bool ganho)> TodosTitulos(Mundo m, LegadoConta? l)
        {
            var nivel = Nivel(m, l);
            var lista = m.P.TemporadaServ.TitulosLinhagem
                .Select(t => (t.Nome, "Linhagem nível " + t.Nivel, nivel >= t.Nivel)).ToList();
            if (l != null) lista.AddRange(l.Titulos.Select(t => (t.Nome, t.Como, true)));
            // conquistas ainda não ganhas aparecem bloqueadas
            foreach (var c in m.P.TemporadaServ.Conquistas.Values)
                if (!lista.Any(x => x.Item1 == c.Titulo)) lista.Add((c.Titulo, "Conquista da temporada", false));
            return lista;
        }

        public static void UsarTitulo(Mundo m, long contaId, string? nome)
        {
            var l = m.Legados.De(contaId);
            if (string.IsNullOrWhiteSpace(nome)) { l.TituloAtivo = null; m.Legados.Salvar(m, l); AvisarReino(m, contaId); return; }
            if (!Titulos(m, contaId)) throw new RegraException("Títulos liberam no nível " + m.P.TemporadaServ.Desbloqueios.Titulos + " da linhagem.");
            if (!TodosTitulos(m, l).Any(t => t.ganho && t.nome == nome)) throw new RegraException("Você ainda não tem esse título.");
            l.TituloAtivo = nome;
            m.Legados.Salvar(m, l);
            AvisarReino(m, contaId);
        }

        /// <summary>Título em uso (só a partir do nível que libera títulos).</summary>
        public static string? TituloEmUso(Mundo m, long? contaId) =>
            contaId is long c && Titulos(m, c) && m.Legados.Obter(c) is { TituloAtivo: { } t } l && TodosTitulos(m, l).Any(x => x.ganho && x.nome == t) ? t : null;

        public static void EscolherRegiaoExilio(Mundo m, long contaId, string? regiao)
        {
            if (regiao != null && !m.P.TemporadaServ.Regioes.ContainsKey(regiao)) throw new RegraException("Região desconhecida.");
            if (regiao != null && !RegiaoExilio(m, contaId)) throw new RegraException("A escolha do exílio libera no nível " + m.P.TemporadaServ.Desbloqueios.Exilio + " da linhagem.");
            var l = m.Legados.De(contaId);
            l.RegiaoExilio = regiao;
            m.Legados.Salvar(m, l);
        }

        private static void AvisarReino(Mundo m, long contaId)
        {
            foreach (var r in m.Reinos) if (r.Ativo && r.ContaId == contaId) m.Avisar(r.Id, "reino");
        }
    }
}
