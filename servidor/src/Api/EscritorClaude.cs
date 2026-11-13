using System.Net.Http.Json;
using System.Text.Json.Serialization;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.IA;

namespace ReinoDePedra.Api;

/// <summary>
/// A LLM que reescreve as falas dos reinos de IA na voz de cada persona (<see cref="IEscritorDeFala"/>), pela API de
/// Mensagens da Anthropic. Ligada só com <c>REINO_FALAS_LLM=1</c> e a chave em <c>ANTHROPIC_API_KEY</c> (nunca no
/// repositório).
/// <para>HTTP direto com JSON gerado na compilação: o SDK oficial de C# não passa no trimming do Native AOT
/// (<c>IL2104</c>), que é erro neste projeto (<c>docs/decisoes/0040-servidor-native-aot.md</c>).</para>
/// <para>O motor não espera: o pedido sai numa tarefa à parte e a fala volta para a thread do mundo quando a resposta
/// chega. Qualquer falha (sem rede, demora, limite de uso, recusa) devolve null e o jogo usa o rascunho dos modelos de
/// texto. Há um teto de falas por hora e de pedidos ao mesmo tempo, para o custo não fugir do controle.</para>
/// </summary>
public sealed class EscritorClaude : IEscritorDeFala
{
    private static readonly Uri Endereco = new("https://api.anthropic.com/v1/messages");
    private const string VersaoApi = "2026-10-21";

    private readonly HttpClient _http;
    private readonly Motor _motor;
    private readonly string _modelo;
    private readonly int _porHora;
    private readonly Action<string>? _log;
    private readonly SemaphoreSlim _vagas = new(MaxAoMesmoTempo);
    private readonly Queue<DateTime> _ultimaHora = new();
    private readonly object _trava = new();
    private int _esperando;

    /// <summary>Pedidos à API ao mesmo tempo; os outros esperam a vez.</summary>
    public const int MaxAoMesmoTempo = 2;
    /// <summary>Pedidos esperando a vez; acima disso a fala sai do rascunho na hora.</summary>
    public const int MaxNaFila = 16;
    /// <summary>Tamanho da resposta: uma fala de chat cabe com folga.</summary>
    private const int MaxTokens = 300;

    public EscritorClaude(Motor motor, Configuracao cfg, Action<string>? log, HttpMessageHandler? handler = null)
    {
        _motor = motor; _modelo = cfg.FalasModelo; _porHora = cfg.FalasPorHora; _log = log;
        // pouco tempo: gente digitando não demora meio minuto, e o rascunho está pronto
        _http = handler == null ? new HttpClient() : new HttpClient(handler);
        _http.Timeout = TimeSpan.FromSeconds(12);
        _http.DefaultRequestHeaders.Add("x-api-key", Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY") ?? "");
        _http.DefaultRequestHeaders.Add("anthropic-version", VersaoApi);
    }

    /// <summary>Ainda cabe uma fala nesta hora? Reserva a vaga se couber.</summary>
    private bool Reservar()
    {
        lock (_trava)
        {
            var agora = DateTime.UtcNow;
            while (_ultimaHora.Count > 0 && agora - _ultimaHora.Peek() > TimeSpan.FromHours(1)) _ultimaHora.Dequeue();
            if (_ultimaHora.Count >= _porHora || _esperando >= MaxNaFila) return false;
            _ultimaHora.Enqueue(agora); _esperando++;
            return true;
        }
    }

    public void Escrever(PromptDeFala pedido, Action<Mundo, string?> pronto)
    {
        // chamado na thread do mundo: sem vaga, a fala sai na hora pelo rascunho
        if (!Reservar()) { pronto(_motor.Mundo, null); return; }
        _ = Task.Run(async () =>
        {
            string? texto = null;
            try
            {
                await _vagas.WaitAsync();
                try { texto = await Chamar(pedido); }
                finally { _vagas.Release(); }
            }
            catch (Exception e) { _log?.Invoke("falas: a LLM não respondeu (" + e.GetType().Name + "); vale o rascunho"); }
            finally { lock (_trava) _esperando--; }
            try { await _motor.Executar(m => pronto(m, texto)); }
            catch (Exception) { }   // o servidor está parando: a fala some
        });
    }

    /// <summary>O corpo do pedido à API. Público para o teste conferir o formato sem rede.</summary>
    public CorpoClaude Corpo(PromptDeFala p) => new(
        Model: _modelo,
        MaxTokens: MaxTokens,
        // fala curta de chat: sem raciocínio estendido e com esforço baixo (resposta rápida e barata)
        Thinking: new PensarClaude("disabled"),
        OutputConfig: new SaidaClaude("low"),
        // do mais estável para o que muda: o jogo (igual para todos) e a pessoa (igual para o mesmo reino) ficam em cache
        System: [new BlocoClaude("text", p.Jogo, CacheClaude.Efemero), new BlocoClaude("text", p.Pessoa, CacheClaude.Efemero)],
        Messages: [new MensagemClaude("user", p.Pedido)]);

    private async Task<string?> Chamar(PromptDeFala p)
    {
        using var resp = await _http.PostAsJsonAsync(Endereco, Corpo(p), JsonClaude.Default.CorpoClaude);
        if (!resp.IsSuccessStatusCode)
        {
            _log?.Invoke($"falas: a LLM respondeu {(int)resp.StatusCode}; vale o rascunho");
            return null;
        }
        var r = await resp.Content.ReadFromJsonAsync(JsonClaude.Default.RespostaClaude);
        var t = Texto(r);
        if (t == null)
            _log?.Invoke("falas: resposta sem texto (stop_reason " + (r?.StopReason ?? "?") + ", blocos " + string.Join("/", (r?.Content ?? []).Select(b => b.Type)) + "); vale o rascunho");
        return t;
    }

    /// <summary>O texto da resposta, ou null se ela recusou ou veio vazia.</summary>
    public static string? Texto(RespostaClaude? r)
    {
        if (r == null || r.StopReason == "refusal") return null;
        var t = string.Concat((r.Content ?? []).Where(b => b.Type == "text").Select(b => b.Text));
        return t.Length == 0 ? null : t;
    }
}

public sealed record CorpoClaude(string Model, int MaxTokens, PensarClaude Thinking, SaidaClaude OutputConfig, List<BlocoClaude> System, List<MensagemClaude> Messages);
public sealed record PensarClaude(string Type);
public sealed record SaidaClaude(string Effort);
public sealed record BlocoClaude(string Type, string Text, CacheClaude? CacheControl = null);
public sealed record CacheClaude(string Type) { public static readonly CacheClaude Efemero = new("ephemeral"); }
public sealed record MensagemClaude(string Role, string Content);
public sealed record RespostaClaude(List<BlocoRespostaClaude>? Content, string? StopReason);
public sealed record BlocoRespostaClaude(string Type, string? Text);

/// <summary>JSON da API de Mensagens: nomes em snake_case, nulos omitidos, metadados gerados (Native AOT).</summary>
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.SnakeCaseLower, DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull)]
[JsonSerializable(typeof(CorpoClaude))]
[JsonSerializable(typeof(RespostaClaude))]
public sealed partial class JsonClaude : JsonSerializerContext;
