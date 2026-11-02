using System.Collections.Concurrent;
using System.Text.Json;
using System.Threading.Channels;
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
    public int Conexoes => _porReino.Values.Sum(d => d.Count);
    public bool Conectado(long reinoId) => _porReino.TryGetValue(reinoId, out var d) && !d.IsEmpty;

    public void Avisar(long reinoId, string tipo, object? dados)
    {
        if (!_porReino.TryGetValue(reinoId, out var d) || d.IsEmpty) return;
        var linha = "event: " + tipo + "\ndata: " + (dados == null ? "{}" : JsonSerializer.Serialize(dados, Json.Web)) + "\n\n";
        foreach (var c in d.Values) c.canal.Writer.TryWrite(linha);
    }
}

public static class Json
{
    public static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web)
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.Create(System.Text.Unicode.UnicodeRanges.All),
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };
}
