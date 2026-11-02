using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Reinos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Reinos
{
    public sealed partial class Reino
    {
        /// <summary>Ranking da temporada: tropas inimigas abatidas (inclui a milícia).</summary>
        public long RankBaixas { get; set; }
        /// <summary>Ranking da temporada: tropas próprias perdidas (inclui a milícia).</summary>
        public long RankPerdas { get; set; }
        /// <summary>Venceu um cerco a um castelo nesta temporada (conquista do legado).</summary>
        public bool VenceuCerco { get; set; }
    }
}

namespace ReinoDePedra.Jogo.Temporada
{
    public sealed record LinhaRanking(Reino Reino, long Baixas, long Perdas, long Tropas, long Familias)
    {
        public long Valor(string cat) => cat switch { "baixas" => Baixas, "perdas" => Perdas, "tropas" => Tropas, _ => Familias };
    }

    /// <summary>
    /// Ranking da temporada por reino (jogadores e IA, sem distinção): baixas causadas, perdas (menos é melhor), tropas e famílias
    /// (população civil). Não mede território. Baixas e perdas vêm do fim de cada batalha (<see cref="Combates.AoTerminar"/>);
    /// tropas e famílias são calculadas na hora.
    /// </summary>
    public static class Ranking
    {
        public static readonly string[] Categorias = ["baixas", "perdas", "tropas", "familias"];
        /// <summary>Categorias que dão relíquia da temporada (perdas não contam).</summary>
        public static readonly string[] Premiadas = ["baixas", "tropas", "familias"];

        internal static void AoTerminarBatalha(Mundo m, ResultadoCombate rc)
        {
            var pa = (long)GT.Total(rc.PerdasAtaque);
            var pd = GT.Total(rc.PerdasDefesa) + (long)Math.Round(rc.MiliciaMorta);
            if (m.Reinos.Obter(rc.AtacanteId) is { } a) { a.RankBaixas += pd; a.RankPerdas += pa; m.Sujar(a); }
            if (rc.DefensorId != rc.AtacanteId && m.Reinos.Obter(rc.DefensorId) is { } d) { d.RankBaixas += pa; d.RankPerdas += pd; m.Sujar(d); }
        }

        internal static void AoCairCastelo(Mundo m, Reino perdeu, Exercito vencedor, Local castelo)
        {
            if (m.Reinos.Obter(vencedor.ReinoId) is { } r && !r.VenceuCerco) { r.VenceuCerco = true; m.Sujar(r); }
        }

        /// <summary>Tropas do reino: guarnições e exércitos em campo (sem feridos, exploradores e mensageiros).</summary>
        public static long TropasDe(Mundo m, Reino r) =>
            m.LocaisDe(r.Id).Sum(l => (long)GT.Total(l.Guarnicao)) + m.Marchas.OfType<Exercito>().Where(x => x.ReinoId == r.Id).Sum(x => (long)GT.Total(x.Tropas));

        public static List<LinhaRanking> Linhas(Mundo m)
        {
            var l = new List<LinhaRanking>();
            foreach (var r in m.Reinos)
            {
                if (!r.Ativo) continue;
                Economia.Atualizar(m, r);
                l.Add(new LinhaRanking(r, r.RankBaixas, r.RankPerdas, TropasDe(m, r), (long)Math.Floor(r.Pop)));
            }
            return l;
        }

        /// <summary>Ordem da categoria: perdas do menor para o maior; o resto do maior para o menor. Empate: pelo nome.</summary>
        public static List<LinhaRanking> Ordenar(IEnumerable<LinhaRanking> l, string cat) =>
            (cat == "perdas" ? l.OrderBy(x => x.Perdas) : l.OrderByDescending(x => x.Valor(cat)))
                .ThenBy(x => x.Reino.Nome, StringComparer.OrdinalIgnoreCase).ToList();

        /// <summary>Posição (1 = primeiro) de cada reino em cada categoria.</summary>
        public static Dictionary<string, Dictionary<long, int>> Posicoes(List<LinhaRanking> l) =>
            Categorias.ToDictionary(c => c, c => Ordenar(l, c).Select((x, i) => (x.Reino.Id, i + 1)).ToDictionary(t => t.Id, t => t.Item2));
    }
}
