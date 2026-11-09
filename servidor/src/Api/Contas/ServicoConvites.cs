using System.Security.Cryptography;
using System.Text;
using ReinoDePedra.Jogo.Persistencia;

namespace ReinoDePedra.Api.Contas;

public sealed record Convite(long Id, string Email, long PedidoEm, string Estado, long? LinkEm, long? ExpiraEm, long? UsadoEm);

/// <summary>
/// Fila de pedidos de convite e links de uso único. O e-mail é dado pessoal: só o administrador o vê, e nada aqui escreve em
/// log. O token é aleatório (256 bits), só o hash fica guardado, e ele é consumido por um único UPDATE condicional: entre duas
/// aberturas simultâneas, só uma muda a linha.
/// </summary>
public sealed class ServicoConvites(Banco banco, TimeProvider? relogio = null)
{
    public const string Fila = "fila", Enviado = "enviado", Usado = "usado", Revogado = "revogado";
    public static readonly TimeSpan Validade = TimeSpan.FromDays(14);
    /// <summary>Teto de pedidos guardados: acima dele, o pedido é ignorado sem que quem pediu saiba.</summary>
    public const int FilaMaxima = 20_000;

    private readonly TimeProvider _t = relogio ?? TimeProvider.System;
    private long Agora => _t.GetUtcNow().ToUnixTimeMilliseconds();

    private static byte[] Hash(string token) => SHA256.HashData(Encoding.UTF8.GetBytes(token));

    /// <summary>
    /// Põe o e-mail na fila. Devolve false só se o formato é inválido. Já estar na fila, ter conta ou a fila estar cheia
    /// não muda a resposta nem o caminho: a mesma instrução roda de qualquer forma.
    /// </summary>
    public bool Pedir(string? emailBruto)
    {
        var email = ServicoContas.NormalizarEmail(emailBruto);
        if (email == null) return false;
        banco.ExecN("INSERT OR IGNORE INTO convites(email, pedido_em, estado) SELECT $e, $t, $f WHERE (SELECT COUNT(*) FROM convites) < $max",
            ("$e", email), ("$t", Agora), ("$f", Fila), ("$max", FilaMaxima));
        return true;
    }

    private static Convite Ler(Microsoft.Data.Sqlite.SqliteDataReader rd) => new(rd.GetInt64(0), rd.GetString(1), rd.GetInt64(2), rd.GetString(3),
        rd.IsDBNull(4) ? null : rd.GetInt64(4), rd.IsDBNull(5) ? null : rd.GetInt64(5), rd.IsDBNull(6) ? null : rd.GetInt64(6));
    private const string Colunas = "id, email, pedido_em, estado, link_em, expira_em, usado_em";

    public List<Convite> Listar(string? estado = null) => string.IsNullOrEmpty(estado)
        ? banco.Consultar("SELECT " + Colunas + " FROM convites ORDER BY pedido_em, id", Ler)
        : banco.Consultar("SELECT " + Colunas + " FROM convites WHERE estado=$e ORDER BY pedido_em, id", Ler, ("$e", estado));

    public Convite? Obter(long id) => banco.Consultar("SELECT " + Colunas + " FROM convites WHERE id=$i", Ler, ("$i", id)).FirstOrDefault();

    /// <summary>
    /// Gera o link de um pedido (o anterior deixa de valer). O token só existe aqui: quem chamou o entrega à pessoa e ele não
    /// pode ser lido de novo. Null se o pedido não existe ou já foi usado.
    /// </summary>
    public (string token, long expira)? GerarLink(long id)
    {
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var expira = Agora + (long)Validade.TotalMilliseconds;
        var n = banco.ExecN("UPDATE convites SET token_hash=$h, estado=$e, link_em=$t, expira_em=$x WHERE id=$i AND estado<>$u",
            ("$h", Hash(token)), ("$e", Enviado), ("$t", Agora), ("$x", expira), ("$i", id), ("$u", Usado));
        return n == 1 ? (token, expira) : null;
    }

    /// <summary>Revoga: o link deixa de valer e o pedido sai da fila. Quem já fundou continua jogando.</summary>
    public bool Revogar(long id) =>
        banco.ExecN("UPDATE convites SET token_hash=NULL, estado=$r, expira_em=NULL WHERE id=$i AND estado<>$u", ("$r", Revogado), ("$i", id), ("$u", Usado)) == 1;

    /// <summary>Apaga o pedido e o e-mail dele. Pedido já usado não apaga a conta.</summary>
    public bool Apagar(long id) => banco.ExecN("DELETE FROM convites WHERE id=$i", ("$i", id)) == 1;

    /// <summary>O e-mail do link, se ele ainda vale. Não consome nada.</summary>
    public string? EmailDoLink(string? token)
    {
        if (string.IsNullOrEmpty(token) || token.Length > 100) return null;
        return banco.Consultar("SELECT email FROM convites WHERE token_hash=$h AND estado=$e AND expira_em>$t", rd => rd.GetString(0),
            ("$h", Hash(token)), ("$e", Enviado), ("$t", Agora)).FirstOrDefault();
    }

    /// <summary>Consome o link: de todas as tentativas, só uma recebe true.</summary>
    public bool Consumir(string token) =>
        banco.ExecN("UPDATE convites SET estado=$u, usado_em=$t WHERE token_hash=$h AND estado=$e AND expira_em>$t",
            ("$u", Usado), ("$t", Agora), ("$h", Hash(token)), ("$e", Enviado)) == 1;

    /// <summary>A fundação falhou depois de consumir (mundo cheio, nome em uso): o link volta a valer.</summary>
    public void Devolver(string token) =>
        banco.ExecN("UPDATE convites SET estado=$e, usado_em=NULL WHERE token_hash=$h AND estado=$u", ("$e", Enviado), ("$h", Hash(token)), ("$u", Usado));

    /// <summary>"b***@exemplo.com": confirma o endereço sem expor quem recebeu o link repassado.</summary>
    public static string Mascarar(string email)
    {
        var i = email.IndexOf('@');
        return i <= 1 ? "***" + email[Math.Max(i, 0)..] : email[0] + "***" + email[i..];
    }
}
