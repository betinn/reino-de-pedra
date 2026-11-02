namespace ReinoDePedra.Api;

/// <summary>
/// Configuração do servidor, só por variáveis de ambiente (nada de infraestrutura no repositório).
/// Veja <c>.env.exemplo</c> na raiz para a lista com valores fictícios.
/// </summary>
public sealed class Configuracao
{
    /// <summary>Pasta dos dados (banco SQLite). Padrão: ./dados</summary>
    public string Dados { get; init; } = Env("REINO_DADOS") ?? "dados";
    /// <summary>Endereços de escuta do Kestrel. Padrão: http://localhost:5080</summary>
    public string Urls { get; init; } = Env("REINO_URLS") ?? "http://localhost:5080";
    /// <summary>Pasta do cliente web. Padrão: procura "web" subindo a partir do executável.</summary>
    public string? Web { get; init; } = Env("REINO_WEB");
    /// <summary>Semente do mapa ao criar um mundo novo (vazio = aleatória).</summary>
    public ulong? Semente { get; init; } = ulong.TryParse(Env("REINO_SEMENTE"), out var s) ? s : null;
    /// <summary>Só para desenvolvimento: o tempo do jogo corre N vezes mais rápido.</summary>
    public double Aceleracao { get; init; } = double.TryParse(Env("REINO_ACELERACAO"), System.Globalization.CultureInfo.InvariantCulture, out var a) ? a : 1;
    /// <summary>Atrás de um proxy reverso (aceita X-Forwarded-For/Proto). Padrão: não.</summary>
    public bool AtrasDeProxy { get; init; } = Env("REINO_PROXY") == "1";
    /// <summary>Cookie de sessão só em HTTPS. Padrão: sim, exceto se REINO_COOKIE_INSEGURO=1 (desenvolvimento em http).</summary>
    public bool CookieSeguro { get; init; } = Env("REINO_COOKIE_INSEGURO") != "1";
    /// <summary>Cria reinos de IA para completar a meta de ocupação. Padrão: sim.</summary>
    public bool IA { get; init; } = Env("REINO_IA") != "0";

    private static string? Env(string n) { var v = Environment.GetEnvironmentVariable(n); return string.IsNullOrWhiteSpace(v) ? null : v; }

    public string LocalizarWeb()
    {
        if (Web != null) return Path.GetFullPath(Web);
        foreach (var inicio in new[] { AppContext.BaseDirectory, Directory.GetCurrentDirectory() })
        {
            for (var d = new DirectoryInfo(inicio); d != null; d = d.Parent)
            {
                var c = Path.Combine(d.FullName, "web");
                if (File.Exists(Path.Combine(c, "index.html"))) return c;
            }
        }
        return Path.Combine(AppContext.BaseDirectory, "web");
    }
}
