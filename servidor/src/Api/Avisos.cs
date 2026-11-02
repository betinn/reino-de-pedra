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
    private readonly ConcurrentDictionary<long, ConcurrentDictionary<Guid, Channel<string>>> _porReino = new();

    public (Guid id, ChannelReader<string> leitor) Abrir(long reinoId)
    {
        var c = Channel.CreateBounded<string>(new BoundedChannelOptions(64) { FullMode = BoundedChannelFullMode.DropOldest, SingleReader = true });
        var id = Guid.NewGuid();
        _porReino.GetOrAdd(reinoId, _ => new())[id] = c;
        return (id, c.Reader);
    }
    public void Fechar(long reinoId, Guid id)
    {
        if (_porReino.TryGetValue(reinoId, out var d) && d.TryRemove(id, out var c)) c.Writer.TryComplete();
    }
    public int Conexoes => _porReino.Values.Sum(d => d.Count);
    public bool Conectado(long reinoId) => _porReino.TryGetValue(reinoId, out var d) && !d.IsEmpty;

    public void Avisar(long reinoId, string tipo, object? dados)
    {
        if (!_porReino.TryGetValue(reinoId, out var d) || d.IsEmpty) return;
        var linha = "event: " + tipo + "\ndata: " + (dados == null ? "{}" : JsonSerializer.Serialize(dados, Json.Web)) + "\n\n";
        foreach (var c in d.Values) c.Writer.TryWrite(linha);
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
