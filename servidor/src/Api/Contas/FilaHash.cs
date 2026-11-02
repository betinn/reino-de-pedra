using ReinoDePedra.Jogo.Nucleo;

namespace ReinoDePedra.Api.Contas;

/// <summary>
/// Fila curta para os hashes de senha (PBKDF2 gasta CPU de propósito): no máximo <paramref name="simultaneos"/> rodando
/// e <paramref name="espera"/> esperando. Fila cheia recusa na hora com 429, sem enfileirar: um ataque de logins não
/// tira a CPU do jogo nem acumula pedidos parados.
/// </summary>
public sealed class FilaHash(int simultaneos, int espera)
{
    /// <summary>Padrão do servidor: um hash por vez e até 4 esperando.</summary>
    public static FilaHash Padrao() => new(1, 4);

    private readonly SemaphoreSlim _vagas = new(simultaneos, simultaneos);
    private int _dentro;

    public async Task<T> Rodar<T>(Func<T> f)
    {
        if (Interlocked.Increment(ref _dentro) > simultaneos + espera)
        {
            Interlocked.Decrement(ref _dentro);
            throw new RegraException("Muitos acessos agora. Tente de novo em instantes.", 429);
        }
        try
        {
            await _vagas.WaitAsync();
            try { return await Task.Run(f); }
            finally { _vagas.Release(); }
        }
        finally { Interlocked.Decrement(ref _dentro); }
    }
}
