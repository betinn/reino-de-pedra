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
        foreach (var s in Todos) s(m);
    }

    /// <summary>
    /// O AoIniciar de cada classe marcada com [Sistema] no jogo, na ordem em que a reflection as listava. A lista é explícita
    /// (o Native AOT não enumera tipos); o teste RegistrosTestes confere contra a reflection.
    /// </summary>
    public static readonly Action<Mundo>[] Todos =
    [
        Valiosos.Apresentacao.AoIniciar, Valiosos.Coletas.AoIniciar, Valiosos.Extracoes.AoIniciar, Valiosos.ReliquiasLendarias.AoIniciar,
        Valiosos.Salgadeiras.AoIniciar, Temporada.Temporadas.AoIniciar, Social.NotificacoesDoReino.AoIniciar, Social.SistemaSocial.AoIniciar,
        Publico.MensagensGlobais.AoIniciar, Pessoas.Pessoas.AoIniciar, IA.SistemaIA.AoIniciar, Forja.SistemaFerraria.AoIniciar,
        Exploracao.Exploradores.AoIniciar, Exploracao.Fauna.AoIniciar, Reinos.Recrutamento.AoIniciar, Combate.SistemaCombate.AoIniciar,
        Combate.SistemaGuerra.AoIniciar,
    ];
}
