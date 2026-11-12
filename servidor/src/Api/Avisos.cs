using System.Collections.Concurrent;
using System.Text.Json;
using System.Threading.Channels;
using ReinoDePedra.Jogo.Persistencia;
using ReinoDePedra.Jogo;

namespace ReinoDePedra.Api;

/// <summary>
/// Avisos em tempo real (Server-Sent Events). Cada conexão aberta tem um canal; o motor publica
/// avisos curtos ("reino", "marchas", "relatorio"...) e o cliente busca só o que mudou.
/// </summary>
public sealed class CanalSse : ICanalAvisos
{
    private readonly ConcurrentDictionary<long, ConcurrentDictionary<Guid, (long ordem, Channel<string> canal)>> _porReino = new();
    private long _ordem;
    /// <summary>Conexões por reino; a mais antiga fecha quando abre outra (o cliente usa uma; abas e aparelhos somam).</summary>
    public int MaxPorReino { get; init; } = Limites.SsePorReino;

    public (Guid id, ChannelReader<string> leitor) Abrir(long reinoId)
    {
        var c = Channel.CreateBounded<string>(new BoundedChannelOptions(64) { FullMode = BoundedChannelFullMode.DropOldest, SingleReader = true });
        var id = Guid.NewGuid();
        var d = _porReino.GetOrAdd(reinoId, _ => new());
        lock (d)
        {
            while (d.Count >= MaxPorReino && d.MinBy(kv => kv.Value.ordem) is var velha && d.TryRemove(velha.Key, out var v))
            {
                v.canal.Writer.TryWrite("event: substituida\ndata: {}\n\n");   // o cliente não reconecta sozinho (volta quando a aba aparecer)
                v.canal.Writer.TryComplete();
            }
            d[id] = (Interlocked.Increment(ref _ordem), c);
        }
        return (id, c.Reader);
    }
    public void Fechar(long reinoId, Guid id)
    {
        if (_porReino.TryGetValue(reinoId, out var d) && d.TryRemove(id, out var c)) c.canal.Writer.TryComplete();
    }
    /// <summary>Fecha todas as conexões (parada do servidor: o laço de cada uma termina na hora).</summary>
    public void FecharTodas()
    {
        foreach (var d in _porReino.Values)
            foreach (var k in d.Keys.ToList())
                if (d.TryRemove(k, out var c)) c.canal.Writer.TryComplete();
    }
    /// <summary>Reset da temporada: fecha todas as conexões (o cliente reconecta e acha o reino da temporada nova).</summary>
    public void Reiniciar()
    {
        foreach (var (reinoId, d) in _porReino)
            foreach (var id in d.Keys) Fechar(reinoId, id);
    }
    public int Conexoes => _porReino.Values.Sum(d => d.Count);
    public bool Conectado(long reinoId) => _porReino.TryGetValue(reinoId, out var d) && !d.IsEmpty;

    public void Avisar(long reinoId, string tipo, object? dados)
    {
        if (!_porReino.TryGetValue(reinoId, out var d) || d.IsEmpty) return;
        var linha = "event: " + tipo + "\ndata: " + (dados == null ? "{}" : JsonSerializer.Serialize(dados, Json.Web.GetTypeInfo(dados.GetType()))) + "\n\n";
        foreach (var c in d.Values) c.canal.Writer.TryWrite(linha);
    }
}

/// <summary>
/// Opções de JSON da API. Os metadados vêm só do código gerado (<see cref="JsonApi"/> e <see cref="JsonJogo"/>): sem reflection.
/// </summary>
public static class Json
{
    /// <summary>Respostas da API e avisos do SSE: camelCase, acentos sem escape, nulos omitidos, enums em camelCase.</summary>
    public static readonly JsonSerializerOptions Web = Configurar(new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    });

    /// <summary>
    /// As do ASP.NET (pedidos e respostas sem opções explícitas): as mesmas, mas nulos escritos. <see cref="Servidor"/>
    /// aplica o mesmo <see cref="Configurar"/> em <c>ConfigureHttpJsonOptions</c>.
    /// </summary>
    public static readonly JsonSerializerOptions Http = Configurar(new(JsonSerializerDefaults.Web));

    public static JsonSerializerOptions Configurar(JsonSerializerOptions o)
    {
        o.PropertyNameCaseInsensitive = true;
        o.Encoder = System.Text.Encodings.Web.JavaScriptEncoder.Create(System.Text.Unicode.UnicodeRanges.All);
        o.Com(JsonNamingPolicy.CamelCase);
        o.TypeInfoResolverChain.Clear();
        o.TypeInfoResolverChain.Add(JsonApi.Default);
        o.TypeInfoResolverChain.Add(JsonJogo.Default);
        return o;
    }

    /// <summary>
    /// <c>Results.Json</c> pelo tipo de verdade do valor, com os metadados gerados (o <c>Results.Json</c> com opções usa
    /// reflection). Sem opções, valem as do ASP.NET (<see cref="Http"/>), como antes.
    /// </summary>
    public static IResult Resposta(object? dados, JsonSerializerOptions? opcoes = null, string? contentType = null, int? statusCode = null) =>
        Results.Json(dados, (opcoes ?? Http).GetTypeInfo(dados?.GetType() ?? typeof(object)), contentType, statusCode);

    /// <summary>Escreve o valor na resposta, pelo tipo de verdade, com as opções do ASP.NET.</summary>
    public static Task Escrever(HttpResponse r, object dados) => r.WriteAsJsonAsync(dados, Http.GetTypeInfo(dados.GetType()));
}
