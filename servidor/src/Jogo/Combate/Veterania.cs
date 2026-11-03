using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Pessoas;
using ReinoDePedra.Jogo.Reinos;
using PS = ReinoDePedra.Jogo.Pessoas.Pessoas;

namespace ReinoDePedra.Jogo.Combate
{
    /// <summary>
    /// Veterania por pessoa: cada soldado guarda as suas marcas (<see cref="Pessoa.Marcas"/>). Vitória com perdas abaixo de
    /// P.veterania.perdasMax contra inimigo com pelo menos P.veterania.forcaMin da própria força dá +1 marca a cada sobrevivente;
    /// derrota tira 1. O bônus de um grupo (exército ou guarnição) sai da média das marcas dos seus soldados: com P.veterania.marcas
    /// (2, 5, 9), +5/10/15% de ataque e defesa (Combate.Bonus, dentro do teto). Recrutas novos (0 marcas) diluem a média.
    /// Combate com fauna não conta (o sistema de fauna não chama aqui).
    /// </summary>
    public static class Veterania
    {
        internal static void Registrar()
        {
            Bonus.Ataque.Add((m, ex) => BonusDe(m, DaMarcha(m, ex)));
            Bonus.DefesaExercito.Add((m, ex) => BonusDe(m, DaMarcha(m, ex)));
            Bonus.Defesa.Add((m, l) => BonusDe(m, DoLocal(m, l)));
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

        /// <summary>Média das marcas de um grupo (0 sem ninguém).</summary>
        public static double Media(IEnumerable<Pessoa> ps)
        {
            double soma = 0; var n = 0;
            foreach (var p in ps) { soma += p.Marcas; n++; }
            return n > 0 ? soma / n : 0;
        }

        /// <summary>Marcas da guarnição (média dos soldados nela).</summary>
        public static double DoLocal(Mundo m, Local l) => Media(PS.Guarnicao(m, l));

        /// <summary>Marcas de um exército (média dos soldados nele).</summary>
        public static double DaMarcha(Mundo m, Marcha mc) => Media(PS.SoldadosDaMarcha(m, mc));

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

        /// <summary>Aplica o resultado a cada sobrevivente do grupo.</summary>
        public static void Aplicar(Mundo m, IEnumerable<Pessoa> ps, bool venceu, double fracPerdas, double forcaPropria, double forcaInimiga)
        {
            foreach (var p in ps)
            {
                var novo = Aplicar(m, p.Marcas, venceu, fracPerdas, forcaPropria, forcaInimiga);
                if (Math.Abs(novo - p.Marcas) > 1e-9) { p.Marcas = novo; m.Sujar(p); }
            }
        }

        /// <summary>Marcas dos dois lados ao fim de uma batalha num local (antes de as tropas voltarem ou ficarem).</summary>
        internal static void AposBatalha(Mundo m, Batalhas.Composicao c, ResultadoCombate rc, Dictionary<string, int> perdasDef)
        {
            var atkVenceu = rc.AtacanteVenceu;
            var fracA = Reinos.Tropas.Total(rc.TropasAtaque) > 0 ? Reinos.Tropas.Total(rc.PerdasAtaque) / (double)Reinos.Tropas.Total(rc.TropasAtaque) : 1;
            foreach (var ex in c.Exercitos) Aplicar(m, PS.SoldadosDaMarcha(m, ex), atkVenceu, fracA, rc.Ataque, rc.Defesa);
            var l = c.Local;
            var tropasD = Reinos.Tropas.Total(c.Defesa);
            if (l == null || c.Defensor == null || l.ReinoId != c.Defensor.Id || tropasD == 0) return;
            var fracD = Reinos.Tropas.Total(perdasDef) / (double)tropasD;
            Aplicar(m, PS.Guarnicao(m, l), !atkVenceu, fracD, rc.Defesa, rc.Ataque);
        }
    }
}
