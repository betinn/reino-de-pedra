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
    /// <summary>Só para desenvolvimento e testes: a temporada dura N minutos de jogo em vez de P.temporadaDias.</summary>
    public double? TemporadaMin { get; init; } = double.TryParse(Env("REINO_TEMPORADA_MIN"), System.Globalization.CultureInfo.InvariantCulture, out var tm) && tm > 0 ? tm : null;
    /// <summary>Cria reinos de IA para completar a meta de ocupação. Padrão: sim.</summary>
    public bool IA { get; init; } = Env("REINO_IA") != "0";

    /// <summary>
    /// Conexões abertas ao mesmo tempo por IP (0 = sem limite). Padrão: 100 servindo direto; atrás de proxy (REINO_PROXY=1)
    /// todas as conexões vêm do proxy, então o limite fica desligado e vai para o proxy.
    /// </summary>
    public int ConexoesPorIp { get; init; } = int.TryParse(Env("REINO_CONEXOES_IP"), out var ci) && ci >= 0 ? ci : Env("REINO_PROXY") == "1" ? 0 : 100;

    /// <summary>Credencial das rotas do administrador (Authorization: Bearer). Vazia ou curta: as rotas não existem (404).</summary>
    public string? AdminToken { get; init; } = Env("REINO_ADMIN_TOKEN");
    /// <summary>Pedidos de convite por IP por hora.</summary>
    public int ConvitesPorHora { get; init; } = int.TryParse(Env("REINO_CONVITES_HORA"), out var ch) && ch > 0 ? ch : 5;
    /// <summary>
    /// Falas dos reinos de IA reescritas por LLM (REINO_FALAS_LLM=1), com a chave em ANTHROPIC_API_KEY. Desligado, ou sem
    /// a chave: as falas saem dos modelos de texto, na voz de cada persona.
    /// </summary>
    public bool FalasLlm { get; init; } = Env("REINO_FALAS_LLM") == "1" && Env("ANTHROPIC_API_KEY") != null;
    /// <summary>Modelo das falas. Padrão: claude-haiku-5-5.</summary>
    public string FalasModelo { get; init; } = Env("REINO_FALAS_MODELO") ?? "claude-haiku-5-5";
    /// <summary>Teto de falas por LLM por hora, no mundo todo (acima disso, modelos de texto). Padrão: 240.</summary>
    public int FalasPorHora { get; init; } = int.TryParse(Env("REINO_FALAS_HORA"), out var fh) && fh > 0 ? fh : 240;
    /// <summary>Só testes: o feed público é montado a cada pedido.</summary>
    public bool FeedSemCache { get; init; }

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
