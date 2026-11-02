namespace ReinoDePedra.Jogo.Nucleo;

/// <summary>
/// Marca uma classe estática de sistema. Na subida do servidor, o método
/// <c>public static void AoIniciar(Mundo m)</c> dela é chamado (registrar ganchos, garantir eventos recorrentes...).
/// Os testes chamam <see cref="Sistemas.IniciarTodos"/> para o mesmo efeito.
/// </summary>
[AttributeUsage(AttributeTargets.Class)]
public sealed class SistemaAttribute : Attribute { }

public static partial class Sistemas
{
    private static readonly HashSet<string> Feitos = new();
    /// <summary>
    /// Executa <paramref name="registrar"/> uma única vez por processo. Use para pôr ganchos em listas estáticas
    /// (ex.: <c>Economia.ModificadoresProducao</c>) dentro de AoIniciar, que roda a cada mundo criado (testes criam vários).
    /// </summary>
    public static void UmaVez(string chave, Action registrar)
    {
        lock (Feitos) { if (!Feitos.Add(chave)) return; }
        registrar();
    }
    /// <summary>Chama AoIniciar de todos os sistemas do assembly do jogo.</summary>
    public static void IniciarTodos(Mundo m)
    {
        foreach (var t in typeof(Sistemas).Assembly.GetTypes())
        {
            if (!t.IsDefined(typeof(SistemaAttribute), false)) continue;
            t.GetMethod("AoIniciar", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static)?.Invoke(null, [m]);
        }
    }
}
