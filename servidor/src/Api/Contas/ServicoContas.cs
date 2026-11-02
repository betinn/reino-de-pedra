using System.Collections.Concurrent;
using System.Net.Mail;
using System.Security.Cryptography;
using ReinoDePedra.Jogo.Persistencia;

namespace ReinoDePedra.Api.Contas;

public sealed record Conta(long Id, string Email);

/// <summary>Contas (e-mail e senha), sessões e limite de tentativas.</summary>
public sealed class ServicoContas(Banco banco, TimeProvider? relogio = null)
{
    private readonly TimeProvider _t = relogio ?? TimeProvider.System;
    /// <summary>Fila dos hashes de senha deste servidor (um por vez, fila curta, 429 quando cheia).</summary>
    public FilaHash Fila { get; } = FilaHash.Padrao();
    public static readonly TimeSpan DuracaoSessao = TimeSpan.FromDays(30);
    public const int SenhaMinima = 10, SenhaMaxima = 128;

    private long Agora => _t.GetUtcNow().ToUnixTimeMilliseconds();

    public static string? NormalizarEmail(string? email)
    {
        email = (email ?? "").Trim().ToLowerInvariant();
        if (email.Length is < 3 or > 254) return null;
        try { var a = new MailAddress(email); return a.Address == email && email.Contains('.', StringComparison.Ordinal) ? email : null; }
        catch (FormatException) { return null; }
    }

    public static string? MotivoSenhaFraca(string? senha, string email)
    {
        if (senha == null || senha.Length < SenhaMinima) return $"A senha precisa ter pelo menos {SenhaMinima} caracteres.";
        if (senha.Length > SenhaMaxima) return $"A senha pode ter no máximo {SenhaMaxima} caracteres.";
        if (senha.Distinct().Count() < 4) return "Senha muito fácil de adivinhar.";
        if (string.Equals(senha, email, StringComparison.OrdinalIgnoreCase)) return "A senha não pode ser o e-mail.";
        return null;
    }

    // ------------------------------------------------------------ limite de tentativas
    private sealed class Tentativas { public int Falhas; public long JanelaInicio; public long BloqueadoAte; }
    private readonly ConcurrentDictionary<string, Tentativas> _porEmail = new();
    public const int FalhasMax = 5;
    public static readonly TimeSpan Janela = TimeSpan.FromMinutes(15), Bloqueio = TimeSpan.FromMinutes(15);

    /// <summary>Segundos até poder tentar de novo, ou 0.</summary>
    public int Bloqueado(string email)
    {
        if (!_porEmail.TryGetValue(email, out var t)) return 0;
        lock (t) return t.BloqueadoAte > Agora ? (int)Math.Ceiling((t.BloqueadoAte - Agora) / 1000.0) : 0;
    }
    private void RegistrarFalha(string email)
    {
        var t = _porEmail.GetOrAdd(email, _ => new Tentativas());
        lock (t)
        {
            if (Agora - t.JanelaInicio > Janela.TotalMilliseconds) { t.JanelaInicio = Agora; t.Falhas = 0; }
            if (++t.Falhas >= FalhasMax) { t.BloqueadoAte = Agora + (long)Bloqueio.TotalMilliseconds; t.Falhas = 0; t.JanelaInicio = Agora; }
        }
        if (_porEmail.Count > 50_000)   // não deixa a memória crescer sem fim
            foreach (var k in _porEmail.Where(kv => kv.Value.BloqueadoAte < Agora && Agora - kv.Value.JanelaInicio > Janela.TotalMilliseconds).Select(kv => kv.Key).ToList())
                _porEmail.TryRemove(k, out _);
    }

    // ------------------------------------------------------------ contas
    public async Task<(Conta? conta, string? erro)> Registrar(string? emailBruto, string? senha)
    {
        var email = NormalizarEmail(emailBruto);
        if (email == null) return (null, "E-mail inválido.");
        var fraca = MotivoSenhaFraca(senha, email);
        if (fraca != null) return (null, fraca);
        if (banco.Escalar<long>("SELECT COUNT(*) FROM contas WHERE email=$e", ("$e", email)) > 0)
            return (null, "Já existe uma conta com esse e-mail.");
        var hash = await Senhas.Hash(senha!, Fila);
        try
        {
            banco.Exec("INSERT INTO contas(email, senha, criada_em, ultimo_acesso) VALUES($e,$s,$t,$t)", ("$e", email), ("$s", hash), ("$t", Agora));
        }
        catch (Microsoft.Data.Sqlite.SqliteException) { return (null, "Já existe uma conta com esse e-mail."); }
        var id = banco.Escalar<long>("SELECT id FROM contas WHERE email=$e", ("$e", email));
        return (new Conta(id, email), null);
    }

    public async Task<(Conta? conta, string? erro, int esperar)> Entrar(string? emailBruto, string? senha)
    {
        var email = NormalizarEmail(emailBruto) ?? (emailBruto ?? "").Trim().ToLowerInvariant();
        var bloq = Bloqueado(email);
        if (bloq > 0) return (null, "Muitas tentativas. Tente de novo em alguns minutos.", bloq);
        var linha = banco.Consultar("SELECT id, senha FROM contas WHERE email=$e", rd => (rd.GetInt64(0), rd.GetString(1)), ("$e", email)).FirstOrDefault();
        if (linha.Item2 == null)
        {
            await Senhas.Verificar(senha ?? "", await Senhas.HashFalso.Value, Fila);
            RegistrarFalha(email);
            return (null, "E-mail ou senha incorretos.", 0);
        }
        var (ok, refazer) = await Senhas.Verificar(senha ?? "", linha.Item2, Fila);
        if (!ok) { RegistrarFalha(email); return (null, "E-mail ou senha incorretos.", 0); }
        _porEmail.TryRemove(email, out _);
        if (refazer) banco.Exec("UPDATE contas SET senha=$s WHERE id=$i", ("$s", await Senhas.Hash(senha!, Fila)), ("$i", linha.Item1));
        banco.Exec("UPDATE contas SET ultimo_acesso=$t WHERE id=$i", ("$t", Agora), ("$i", linha.Item1));
        return (new Conta(linha.Item1, email), null, 0);
    }

    public Conta? Obter(long id) =>
        banco.Consultar("SELECT id, email FROM contas WHERE id=$i", rd => new Conta(rd.GetInt64(0), rd.GetString(1)), ("$i", id)).FirstOrDefault();

    public async Task<string?> TrocarSenha(long contaId, string atual, string nova)
    {
        var linha = banco.Consultar("SELECT email, senha FROM contas WHERE id=$i", rd => (rd.GetString(0), rd.GetString(1)), ("$i", contaId)).FirstOrDefault();
        if (linha.Item1 == null) return "Conta não encontrada.";
        var (ok, _) = await Senhas.Verificar(atual, linha.Item2, Fila);
        if (!ok) { RegistrarFalha(linha.Item1); return "Senha atual incorreta."; }
        var fraca = MotivoSenhaFraca(nova, linha.Item1);
        if (fraca != null) return fraca;
        banco.Exec("UPDATE contas SET senha=$s WHERE id=$i", ("$s", await Senhas.Hash(nova, Fila)), ("$i", contaId));
        banco.Exec("DELETE FROM sessoes WHERE conta_id=$i", ("$i", contaId));
        foreach (var k in _cache.Where(kv => kv.Value.conta == contaId).Select(kv => kv.Key).ToList()) _cache.TryRemove(k, out _);
        return null;
    }

    // ------------------------------------------------------------ sessões
    // token aleatório de 256 bits; o banco guarda só o SHA-256 (vazamento do banco não dá acesso)
    private readonly ConcurrentDictionary<string, (long conta, long expira, long usado)> _cache = new();

    private static byte[] HashToken(string token) => SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token));

    public string CriarSessao(long contaId)
    {
        var token = Base64Url(RandomNumberGenerator.GetBytes(32));
        var exp = Agora + (long)DuracaoSessao.TotalMilliseconds;
        banco.Exec("INSERT INTO sessoes(token_hash, conta_id, criada_em, expira_em, ultimo_uso) VALUES($h,$c,$t,$x,$t)",
            ("$h", HashToken(token)), ("$c", contaId), ("$t", Agora), ("$x", exp));
        _cache[Convert.ToHexString(HashToken(token))] = (contaId, exp, Agora);
        return token;
    }

    /// <summary>Conta da sessão, ou null. Renova a validade (sessão deslizante) no máximo a cada 10 min.</summary>
    public long? ValidarSessao(string? token)
    {
        if (string.IsNullOrEmpty(token) || token.Length > 100) return null;
        var h = HashToken(token);
        var chave = Convert.ToHexString(h);
        if (!_cache.TryGetValue(chave, out var s))
        {
            var l = banco.Consultar("SELECT conta_id, expira_em, ultimo_uso FROM sessoes WHERE token_hash=$h", rd => (rd.GetInt64(0), rd.GetInt64(1), rd.GetInt64(2)), ("$h", h)).FirstOrDefault();
            if (l.Item1 == 0) return null;
            s = l; _cache[chave] = s;
        }
        if (s.expira < Agora) { EncerrarSessao(token); return null; }
        if (Agora - s.usado > 10 * 60_000)
        {
            var exp = Agora + (long)DuracaoSessao.TotalMilliseconds;
            banco.Exec("UPDATE sessoes SET ultimo_uso=$t, expira_em=$x WHERE token_hash=$h", ("$t", Agora), ("$x", exp), ("$h", h));
            _cache[chave] = (s.conta, exp, Agora);
        }
        return s.conta;
    }

    public void EncerrarSessao(string? token)
    {
        if (string.IsNullOrEmpty(token)) return;
        var h = HashToken(token);
        _cache.TryRemove(Convert.ToHexString(h), out _);
        banco.Exec("DELETE FROM sessoes WHERE token_hash=$h", ("$h", h));
    }

    public void LimparSessoesVencidas() => banco.Exec("DELETE FROM sessoes WHERE expira_em < $t", ("$t", Agora));

    private static string Base64Url(byte[] b) => Convert.ToBase64String(b).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
