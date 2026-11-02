using System.Security.Cryptography;

namespace ReinoDePedra.Api.Contas;

/// <summary>
/// Hash de senha com PBKDF2-HMAC-SHA512 (210.000 iterações, sal de 16 bytes), da biblioteca padrão do .NET.
/// Formato versionado: <c>pbkdf2-sha512$iteracoes$sal$hash</c> (base64), para subir o custo no futuro
/// sem invalidar senhas antigas (elas são refeitas no próximo login). O servidor passa a <see cref="FilaHash"/> da conta
/// para não deixar os hashes tomarem a CPU do jogo.
/// </summary>
public static class Senhas
{
    public const int Iteracoes = 210_000;
    private const int TamSal = 16, TamHash = 32;

    /// <summary>Hash novo. Com <paramref name="fila"/>, espera a vez (ou recusa com 429 se a fila estiver cheia).</summary>
    public static Task<string> Hash(string senha, FilaHash? fila = null, int iteracoes = Iteracoes)
    {
        string f()
        {
            var sal = RandomNumberGenerator.GetBytes(TamSal);
            var h = Rfc2898DeriveBytes.Pbkdf2(senha, sal, iteracoes, HashAlgorithmName.SHA512, TamHash);
            return $"pbkdf2-sha512${iteracoes}${Convert.ToBase64String(sal)}${Convert.ToBase64String(h)}";
        }
        return fila != null ? fila.Rodar(f) : Task.FromResult(f());
    }

    /// <summary>Confere a senha em tempo constante. <paramref name="refazer"/> indica parâmetros antigos.</summary>
    public static async Task<(bool ok, bool refazer)> Verificar(string senha, string guardado, FilaHash? fila = null)
    {
        var p = guardado.Split('$');
        if (p.Length != 4 || p[0] != "pbkdf2-sha512" || !int.TryParse(p[1], out var it)) return (false, false);
        byte[] sal, esperado;
        try { sal = Convert.FromBase64String(p[2]); esperado = Convert.FromBase64String(p[3]); }
        catch (FormatException) { return (false, false); }
        (bool, bool) f()
        {
            var h = Rfc2898DeriveBytes.Pbkdf2(senha, sal, it, HashAlgorithmName.SHA512, esperado.Length);
            var ok = CryptographicOperations.FixedTimeEquals(h, esperado);
            return (ok, ok && it < Iteracoes);
        }
        return fila != null ? await fila.Rodar(f) : f();
    }

    /// <summary>Hash fixo para gastar o mesmo tempo quando o e-mail não existe (não revela contas).</summary>
    public static readonly Lazy<Task<string>> HashFalso = new(() => Hash("senha-que-nao-existe-" + Guid.NewGuid()));
}
