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
    /// <summary>Produção de um local deste recurso: a serraria rende mais que os outros.</summary>
    public double ProducaoDe(string recurso, int L) => Producao(L) * (recurso == "madeira" ? P.FatorSerraria : 1);
    /// <summary>Produção por hora do castelo, de cada recurso básico, no nível L.</summary>
    public double ProducaoCastelo(int L) => P.CasteloBase * Math.Pow(P.CasteloCresc, L - 1);
    /// <summary>Custo total (recursos) para subir um local ao nível L (L ≥ 2).</summary>
    public double Custo(int L) => P.CustoN2 * Math.Pow(P.CustoCresc, L - 2);
    /// <summary>Tempo de obra, em segundos, para subir um local ao nível L.</summary>
    public double TempoObra(int L) => P.TempoN2 * Math.Pow(P.TempoCresc, L - 2);
    /// <summary>Divide um total pela receita (45% madeira, 35% pedra...), arredondando a inteiros como o modelo.</summary>
    public Dictionary<string, double> Receita(double total) =>
        P.Receita.ToDictionary(kv => kv.Key, kv => ArredJs(total * kv.Value));
    /// <summary>Vagas de trabalho de um local de produção no nível L (uma pessoa por vaga).</summary>
    public int Vagas(int L) => Math.Max(P.Vagas.Minimo, (int)ArredJs(L * P.Vagas.PorNivel));
    /// <summary>Trabalhadores que o local comporta: o mesmo que <see cref="Vagas"/>.</summary>
    public int Trabalhadores(int L) => Vagas(L);
    public double CustoMoradia(int n) => P.CustoMoradia + P.MoradiaPasso * n;
    public double TempoMoradia(int n) => P.TempoMoradia * (1 + P.TempoMoradiaPasso * n);
    /// <summary>
    /// Duração de uma batalha (s), sem contar baixas: não há tempo fixo. Dura o que o lado mais fraco leva para cair: cresce
    /// com as tropas dele e encolhe com a desigualdade (<paramref name="razao"/> = força menor / força maior, de 0 a 1).
    /// 50 contra 1 fica no mínimo; forças parecidas e muita gente levam minutos, até o teto.
    /// </summary>
    public double DuracaoBatalha(double tropasFraco, double razao)
    {
        var b = P.Combate.Batalha;
        return Math.Min(b.MaxSeg, b.MinSeg + b.PorTropaSeg * Math.Max(0, tropasFraco) * Math.Pow(Math.Clamp(razao, 0, 1), b.ExpRazao));
    }
    public Dictionary<string, double> CustoNovoLocal(int fundados) => Receita(P.CustoNovoLocal * Math.Pow(P.NovoLocalCresc, fundados));
    public double ViagemMin(double hexes, string vel, bool rota) =>
        hexes * P.TerrenoMedio * (rota ? P.RotaFator : 1) * P.MinPor[vel];

    /// <summary>Custo de construção de um local ao nível L, com o fator do castelo quando for o castelo.</summary>
    public Dictionary<string, double> CustoNivel(int L, bool castelo) => Receita(Custo(L) * (castelo ? P.CasteloCusto : 1));
    public double TempoNivel(int L, bool castelo) => TempoObra(L) * (castelo ? P.CasteloTempo : 1);

    public Dictionary<string, double> CustoTorre(int n)
    {
        var c = P.Torre.CustoN1 * Math.Pow(P.Torre.CustoCresc, n - 1);
        return new() { ["pedra"] = ArredJs(c * 0.7), ["madeira"] = ArredJs(c * 0.3) };
    }
    public double TempoTorre(int n) => P.Torre.TempoN1 * n;
    public int AlcanceTorre(int n) => n * P.Torre.AlcancePorNivel + P.Torre.AlcanceBase;

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

    /// <summary>Unidades por hora que um grupo de <paramref name="pessoas"/> coleta (madeira ou pedra) num hexágono.</summary>
    public double ColetaH(int pessoas)
    {
        var n = Math.Min(P.Coleta.MaxPessoas, pessoas);
        return n > 0 ? P.Coleta.Taxa * Math.Pow(n, P.Coleta.ExpPessoas) : 0;
    }

    /// <summary>Vida máxima de quem tem o ofício (civis sem entrada própria usam "civil"; os outros, "padrao").</summary>
    public double VidaMax(string oficio, bool civil) =>
        P.Vida.Max.TryGetValue(oficio, out var v) ? v : P.Vida.Max[civil ? "civil" : "padrao"];

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
        v += x.ArqTorre * B.U["arqueiro"].Def * P.Torre.BonusAlto;   // torres e torre de menagem
        v *= BonusCom(x.Reliquia + x.BonusD) * MultPortoes(x.Portoes, ataque);
        return v;
    }

    /// <summary>Arqueiros na torre de menagem do castelo no nível L (decisão 0042).</summary>
    public int Menagem(int L) => (int)Math.Floor(Math.Max(0, L) * P.DefesaCastelo.ArqPorNivel + 1e-9);
    /// <summary>Nível dos portões que o castelo no nível L já tem, sem obra.</summary>
    public int PortoesBasicos(int L) => Math.Min(P.Portoes.Length - 1, Math.Max(0, L) / Math.Max(1, P.DefesaCastelo.PortoesCada));

    /// <summary>Fração dos portões (nível efetivo n) que as máquinas de cerco do ataque arrombam na batalha: Σ cerco / estrutura, até 1.</summary>
    public double PortoesAbertos(int n, IReadOnlyDictionary<string, int> ataque)
    {
        if (n <= 0) return 1;
        var cerco = ataque.Sum(kv => kv.Value * (B.U.TryGetValue(kv.Key, out var u) ? u.Cerco : 0));
        return Math.Min(1, cerco / (n * P.PortoesEstrutura));
    }

    /// <summary>
    /// Multiplicador dos portões contra este ataque. Fechados (sem máquinas de cerco), valem P.portoes[n] × P.defesaCastelo.fechado;
    /// arrombados por inteiro, não contam; em parte, contam em parte.
    /// </summary>
    public double MultPortoes(int n, IReadOnlyDictionary<string, int> ataque)
    {
        if (n <= 0) return 1;
        n = Math.Min(n, P.Portoes.Length - 1);
        return 1 + (P.Portoes[n] * P.DefesaCastelo.Fechado - 1) * (1 - PortoesAbertos(n, ataque));
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
    /// <summary>Arqueiros no alto: das torres no alcance e da torre de menagem do castelo.</summary>
    public double ArqTorre { get; init; }
    public double Reliquia { get; init; }
    public double BonusD { get; init; }
    public double BonusA { get; init; }
    /// <summary>Nível efetivo dos portões (castelo): o maior entre os construídos e os básicos do nível.</summary>
    public int Portoes { get; init; }
}

public sealed record ResultadoBatalha(double A, double D, bool VenceA, double PerdaA, double PerdaD, bool Recuou, double Razao);
