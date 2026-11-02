using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Reinos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Combate
{
    /// <summary>
    /// Veterania: marcas de vitória por exército em campo e por guarnição. Vitória com perdas abaixo de P.veterania.perdasMax
    /// contra inimigo com pelo menos P.veterania.forcaMin da própria força dá +1 marca; derrota tira 1. Com P.veterania.marcas
    /// (2, 5, 9) marcas, +5/10/15% de ataque e defesa (Combate.Bonus, dentro do teto). Tropas que se juntam fazem a média
    /// ponderada das marcas: recrutas novos (0 marcas) diluem. Combate com fauna não conta (o sistema de fauna não chama aqui).
    ///
    /// Na guarnição, as marcas valem para <see cref="Local.MarcasTropas"/> tropas: se a guarnição tem mais tropas do que isso,
    /// as que chegaram sem passar por aqui (recrutas, curados) entram com 0 marcas; se tem menos, quem saiu levou as marcas junto.
    /// </summary>
    public static class Veterania
    {
        internal static void Registrar()
        {
            Bonus.Ataque.Add((m, ex) => BonusDe(m, ex.Marcas));
            Bonus.DefesaExercito.Add((m, ex) => BonusDe(m, ex.Marcas));
            Bonus.Defesa.Add((m, l) => { Normalizar(m, l); return GT.Total(l.Guarnicao) > 0 ? BonusDe(m, l.Marcas) : 0; });
            Exercitos.AoEntrarNoLocal += Entrou;
            Marcha.AoPartir.Add(Partiu);
            Filas.AoConcluir += (m, r, item) =>
            {
                if (item.Tipo is ItemRecrutar.Id or ItemCurar.Id) foreach (var l in m.LocaisDe(r.Id)) Normalizar(m, l);
            };
        }

        /// <summary>Nível de veterania (0 a 3) com estas marcas.</summary>
        public static int Nivel(Mundo m, double marcas)
        {
            var n = 0;
            var lim = m.P.Veterania.Marcas;
            for (var i = 0; i < lim.Length; i++) if (marcas + 1e-9 >= lim[i]) n = i + 1;
            return n;
        }

        public static double BonusDe(Mundo m, double marcas)
        {
            var n = Nivel(m, marcas);
            return n > 0 ? m.P.Veterania.Bonus[n - 1] : 0;
        }

        /// <summary>Marcas da guarnição com <paramref name="tropas"/> tropas (dilui recrutas que chegaram).</summary>
        private static void NormalizarCom(Mundo m, Local l, int tropas)
        {
            var antes = (l.Marcas, l.MarcasTropas);
            if (tropas <= 0) { l.Marcas = 0; l.MarcasTropas = 0; }
            else if (tropas > l.MarcasTropas) { l.Marcas = l.MarcasTropas > 0 ? l.Marcas * l.MarcasTropas / tropas : 0; l.MarcasTropas = tropas; }
            else if (tropas < l.MarcasTropas) l.MarcasTropas = tropas;
            if (antes != (l.Marcas, l.MarcasTropas)) m.Sujar(l);
        }

        /// <summary>Leva as marcas da guarnição ao tamanho atual dela.</summary>
        public static void Normalizar(Mundo m, Local l) => NormalizarCom(m, l, GT.Total(l.Guarnicao));

        /// <summary>Marcas da guarnição (já com os recrutas diluídos).</summary>
        public static double DoLocal(Mundo m, Local l) { Normalizar(m, l); return l.Marcas; }

        /// <summary>Um exército entrou num local próprio: média ponderada das marcas.</summary>
        private static void Entrou(Mundo m, Exercito ex, Local l)
        {
            if (l.ReinoId != ex.ReinoId) return;
            var n = GT.Total(ex.Tropas);
            var total = GT.Total(l.Guarnicao);
            var antes = Math.Max(0, total - n);
            NormalizarCom(m, l, antes);
            l.Marcas = total > 0 ? (l.Marcas * antes + ex.Marcas * n) / total : 0;
            l.MarcasTropas = total;
            m.Sujar(l);
        }

        /// <summary>Um exército saiu de um local próprio: leva as marcas da guarnição.</summary>
        private static void Partiu(Mundo m, Marcha mc)
        {
            if (mc is not Exercito ex || ex.MarcasIniciadas || ex.Caminho.Count == 0) return;
            ex.MarcasIniciadas = true;
            var l = m.LocalNoHex(ex.Caminho[0]);
            if (l != null && l.ReinoId == ex.ReinoId && !l.Ruina)
            {
                var resta = GT.Total(l.Guarnicao);
                NormalizarCom(m, l, resta + GT.Total(ex.Tropas));
                ex.Marcas = l.Marcas;
                NormalizarCom(m, l, resta);
            }
            m.Sujar(ex);
        }

        /// <summary>
        /// Resultado de um lado num combate: vitória com perdas abaixo do limite contra inimigo forte o bastante dá +1 marca;
        /// derrota tira 1. Devolve as marcas novas.
        /// </summary>
        public static double Aplicar(Mundo m, double marcas, bool venceu, double fracPerdas, double forcaPropria, double forcaInimiga)
        {
            var v = m.P.Veterania;
            if (venceu)
            {
                if (fracPerdas < v.PerdasMax && forcaInimiga >= v.ForcaMin * forcaPropria && forcaPropria > 0) return marcas + 1;
                return marcas;
            }
            return Math.Max(0, marcas - 1);
        }

        /// <summary>Marcas dos dois lados ao fim de uma batalha num local (antes de as tropas voltarem ou ficarem).</summary>
        internal static void AposBatalha(Mundo m, Batalhas.Composicao c, ResultadoCombate rc, Dictionary<string, int> perdasDef)
        {
            var atkVenceu = rc.AtacanteVenceu;
            var fracA = GT.Total(rc.TropasAtaque) > 0 ? GT.Total(rc.PerdasAtaque) / (double)GT.Total(rc.TropasAtaque) : 1;
            foreach (var ex in c.Exercitos)
            {
                ex.Marcas = Aplicar(m, ex.Marcas, atkVenceu, fracA, rc.Ataque, rc.Defesa);
                m.Sujar(ex);
            }
            var l = c.Local;
            var tropasD = GT.Total(c.Defesa);
            if (l == null || c.Defensor == null || l.ReinoId != c.Defensor.Id || tropasD == 0) return;
            Normalizar(m, l);
            var fracD = GT.Total(perdasDef) / (double)tropasD;
            l.Marcas = Aplicar(m, l.Marcas, !atkVenceu, fracD, rc.Defesa, rc.Ataque);
            m.Sujar(l);
        }
    }
}

namespace ReinoDePedra.Jogo.Reinos
{
    public sealed partial class Local
    {
        /// <summary>Marcas de veterania da guarnição (média; ver Combate.Veterania).</summary>
        public double Marcas { get; set; }
        /// <summary>Quantas tropas da guarnição têm essas marcas.</summary>
        public int MarcasTropas { get; set; }
    }
}

namespace ReinoDePedra.Jogo.Marchas
{
    public abstract partial class Marcha
    {
        /// <summary>Marcas de veterania do exército (vêm da guarnição de onde as tropas saíram).</summary>
        public double Marcas { get; set; }
        /// <summary>As marcas já foram tiradas da guarnição de origem (só na primeira partida).</summary>
        public bool MarcasIniciadas { get; set; }
    }
}
