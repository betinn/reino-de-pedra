namespace ReinoDePedra.Jogo.Config;

/// <summary>
/// Fórmulas do balanceamento, linha a linha iguais às de <c>balanceamento/modelo.js</c>.
/// Os testes conferem cada uma contra <c>referencia</c> do config.json.
/// </summary>
public sealed class Formulas(Balanceamento b)
{
    public Balanceamento B { get; } = b;
    private ParametrosP P => B.P;

    public static readonly string[] Basicos = ["comida", "madeira", "pedra", "ferro"];

    /// <summary>Produção por hora de um local de produção no nível L.</summary>
    public double Producao(int L) => P.ProdBase * Math.Pow(P.ProdCresc, L - 1);
    /// <summary>Produção por hora do castelo, de cada recurso básico, no nível L.</summary>
    public double ProducaoCastelo(int L) => P.CasteloBase * Math.Pow(P.CasteloCresc, L - 1);
    /// <summary>Custo total (recursos) para subir um local ao nível L (L ≥ 2).</summary>
    public double Custo(int L) => P.CustoN2 * Math.Pow(P.CustoCresc, L - 2);
    /// <summary>Tempo de obra, em segundos, para subir um local ao nível L.</summary>
    public double TempoObra(int L) => P.TempoN2 * Math.Pow(P.TempoCresc, L - 2);
    /// <summary>Divide um total pela receita (45% madeira, 35% pedra...), arredondando a dezenas como o modelo.</summary>
    public Dictionary<string, double> Receita(double total) =>
        P.Receita.ToDictionary(kv => kv.Key, kv => ArredJs(total * kv.Value / 10) * 10);
    public int Trabalhadores(int L) => P.TrabPorNivel * L;
    public double CustoMoradia(int n) => P.CustoMoradia + P.MoradiaPasso * n;
    public double TempoMoradia(int n) => 10 * 60 * (1 + 0.1 * n);
    public Dictionary<string, double> CustoNovoLocal(int fundados) => Receita(P.CustoNovoLocal * Math.Pow(P.NovoLocalCresc, fundados));
    public double ViagemMin(double hexes, string vel, bool rota) =>
        hexes * P.TerrenoMedio * (rota ? P.RotaFator : 1) * P.MinPor[vel];

    /// <summary>Custo de construção de um local ao nível L, com o fator do castelo quando for o castelo.</summary>
    public Dictionary<string, double> CustoNivel(int L, bool castelo) => Receita(Custo(L) * (castelo ? P.CasteloCusto : 1));
    public double TempoNivel(int L, bool castelo) => TempoObra(L) * (castelo ? P.CasteloTempo : 1);

    public Dictionary<string, double> CustoTorre(int n)
    {
        var c = P.Torre.CustoN1 * Math.Pow(P.Torre.CustoCresc, n - 1);
        return new() { ["pedra"] = ArredJs(c * 0.7 / 10) * 10, ["madeira"] = ArredJs(c * 0.3 / 10) * 10 };
    }
    public double TempoTorre(int n) => P.Torre.TempoN1 * n;
    public int AlcanceTorre(int n) => n + P.Torre.AlcanceBase;

    public double CapacidadeArmazem(int L) => P.Armazem.CapN1 * Math.Pow(P.Armazem.CapCresc, L - 1);

    public double ValorDe(IReadOnlyDictionary<string, double> c) =>
        c.Sum(kv => kv.Value * (P.Valor.TryGetValue(kv.Key, out var v) ? v : 1));

    public double ForcaFauna(IReadOnlyDictionary<string, int> g) =>
        g.Sum(kv => kv.Value * (B.U[kv.Key].Atk + B.U[kv.Key].Def) / 2);

    /// <summary>"nenhum", "baixo", "medio" ou "alto": risco efetivo de uma região para um grupo com essa força.</summary>
    public string RiscoFauna(string nivel, double forca)
    {
        if (forca >= 2 * P.Fauna[nivel]) return "nenhum";
        if (forca >= P.Fauna[nivel]) return nivel switch { "baixo" => "nenhum", "medio" => "baixo", _ => "medio" };
        return nivel;
    }

    public double ChanceEspiao(int torres, int tropas) =>
        Math.Min(P.Espiao.Max, P.Espiao.Base + torres * P.Espiao.PorTorre + tropas * P.Espiao.PorTropa);

    /// <summary>Valor por hora extraído por um grupo numa jazida.</summary>
    public double ExtracaoH(IReadOnlyDictionary<string, int> g, bool posto, bool rota)
    {
        var total = g.Values.Sum();
        var n = Math.Min(P.Extracao.MaxTropas, total);
        if (n == 0) return 0;
        var carga = g.Sum(kv => kv.Value * B.U[kv.Key].Carga) / (double)total;
        return P.Extracao.Taxa * carga * Math.Pow(n, P.Extracao.ExpTropas) * (posto ? P.Extracao.Posto : 1) * (rota ? P.Extracao.Rota : 1);
    }

    /// <summary>Multiplicador de uma soma de bônus de combate, limitada ao teto.</summary>
    public double BonusCom(double b) => 1 + Math.Min(P.TetoBonus, b);

    private int QtdFam(IReadOnlyDictionary<string, int> g, string fam) =>
        g.Where(kv => B.U[kv.Key].Fam == fam).Sum(kv => kv.Value);

    public double ValorAtaque(IReadOnlyDictionary<string, int> grupo, IReadOnlyDictionary<string, int> defesa, double bonus)
    {
        double totDef = defesa.Values.Sum(); if (totDef == 0) totDef = 1;
        double s = 0;
        foreach (var (k, n) in grupo)
        {
            var u = B.U[k];
            var frac = u.Vence != null ? QtdFam(defesa, u.Vence) / totDef : 0;
            s += n * u.Atk * (1 + (P.Vantagem - 1) * frac);
        }
        return s * BonusCom(bonus);
    }

    public double ValorDefesa(IReadOnlyDictionary<string, int> grupo, IReadOnlyDictionary<string, int> ataque, ExtraDefesa x)
    {
        double totAtk = ataque.Values.Sum(); if (totAtk == 0) totAtk = 1;
        double v = 0;
        foreach (var (k, n) in grupo)
        {
            var u = B.U[k];
            var frac = u.Vence != null ? QtdFam(ataque, u.Vence) / totAtk : 0;
            v += n * u.Def * (1 + (P.Vantagem - 1) * frac);
        }
        v += x.Pop * P.MiliciaPorPop * P.DefMilicia;
        v += x.ArqTorre * B.U["arqueiro"].Def * P.Torre.BonusAlto;
        v *= BonusCom(x.Reliquia + x.BonusD) * (x.Portoes > 0 ? P.Portoes[x.Portoes] : 1);
        return v;
    }

    /// <summary>Resolve um combate. <paramref name="limiteBaixas"/> é o limite da tática (null = sem limite).</summary>
    public ResultadoBatalha Batalha(IReadOnlyDictionary<string, int> atk, IReadOnlyDictionary<string, int> def, ExtraDefesa x, double? limiteBaixas)
    {
        var A = ValorAtaque(atk, def, x.BonusA);
        var D = ValorDefesa(def, atk, x);
        var venceA = A > D;
        var menor = Math.Min(A, D); var maior = Math.Max(A, D);
        var razaoPerda = maior > 0 ? Math.Pow(menor / maior, P.ExpPerdas) : 0;
        double perdaA = venceA ? razaoPerda : 1, perdaD = venceA ? 1 : razaoPerda;
        var recuou = false;
        if (!venceA && limiteBaixas != null)
        {
            recuou = true; perdaD *= limiteBaixas.Value; perdaA = limiteBaixas.Value;
        }
        return new ResultadoBatalha(A, D, venceA, perdaA, perdaD, recuou, D > 0 ? A / D : double.PositiveInfinity);
    }

    /// <summary>Math.round do JavaScript (meio arredonda para +∞), para bater com o modelo.</summary>
    public static double ArredJs(double v) => Math.Floor(v + 0.5);
}

public sealed record ExtraDefesa
{
    public double Pop { get; init; }
    public double ArqTorre { get; init; }
    public double Reliquia { get; init; }
    public double BonusD { get; init; }
    public double BonusA { get; init; }
    public int Portoes { get; init; }
}

public sealed record ResultadoBatalha(double A, double D, bool VenceA, double PerdaA, double PerdaD, bool Recuou, double Razao);
