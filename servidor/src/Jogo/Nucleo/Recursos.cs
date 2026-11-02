namespace ReinoDePedra.Jogo.Nucleo;

/// <summary>
/// Quantidades de recursos por id ("comida", "madeira", "ouro"...). Ids iguais às chaves de <c>P.valor</c>.
/// Quantidades são reais (produção contínua); a interface arredonda para exibir.
/// </summary>
public sealed class Recursos : Dictionary<string, double>
{
    public Recursos() { }
    public Recursos(IEnumerable<KeyValuePair<string, double>> origem) { foreach (var (k, v) in origem) this[k] = v; }

    public double Qtd(string k) => TryGetValue(k, out var v) ? v : 0;
    public void Somar(string k, double v)
    {
        var n = Qtd(k) + v;
        if (Math.Abs(n) < 1e-9) Remove(k); else this[k] = n;
    }
    public void Somar(IReadOnlyDictionary<string, double> o, double fator = 1) { foreach (var (k, v) in o) Somar(k, v * fator); }
    public bool Cobre(IReadOnlyDictionary<string, double> c) => c.All(kv => Qtd(kv.Key) + 1e-6 >= kv.Value);
    public double Total => Values.Sum();
    public Recursos Copia() => new(this);
    public static Recursos De(IReadOnlyDictionary<string, double> o) => new(o);
    /// <summary>Retira até <paramref name="v"/> de k e devolve quanto retirou.</summary>
    public double Retirar(string k, double v)
    {
        var tem = Qtd(k); var r = Math.Min(tem, Math.Max(0, v));
        Somar(k, -r);
        return r;
    }
    public Dictionary<string, long> Arredondado() => this.Where(kv => kv.Value >= 0.5).ToDictionary(kv => kv.Key, kv => (long)Math.Floor(kv.Value));
}
