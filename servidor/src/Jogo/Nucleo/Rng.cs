namespace ReinoDePedra.Jogo.Nucleo;

/// <summary>
/// Gerador determinístico (SplitMix64). O mapa sai da semente do mundo e precisa ser
/// igual em qualquer versão do .NET, por isso não usamos System.Random.
/// </summary>
public sealed class Rng(ulong semente)
{
    private ulong _s = semente;
    public ulong Proximo()
    {
        var z = _s += 0x9E3779B97F4A7C15UL;
        z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9UL;
        z = (z ^ (z >> 27)) * 0x94D049BB133111EBUL;
        return z ^ (z >> 31);
    }
    /// <summary>Real em [0, 1).</summary>
    public double Real() => (Proximo() >> 11) * (1.0 / (1UL << 53));
    /// <summary>Inteiro em [min, max).</summary>
    public int Int(int min, int max) => min + (int)(Real() * (max - min));
    public bool Chance(double p) => Real() < p;
    public T Escolher<T>(IReadOnlyList<T> l) => l[Int(0, l.Count)];
    public void Embaralhar<T>(IList<T> l)
    {
        for (var i = l.Count - 1; i > 0; i--) { var j = Int(0, i + 1); (l[i], l[j]) = (l[j], l[i]); }
    }
    /// <summary>Hash estável de inteiros, para ruído e sorteios ligados a uma posição.</summary>
    public static ulong Hash(ulong a, ulong b = 0, ulong c = 0)
    {
        var r = new Rng(a * 0x9E3779B97F4A7C15UL ^ b * 0xC2B2AE3D27D4EB4FUL ^ c * 0x165667B19E3779F9UL);
        return r.Proximo();
    }
}
