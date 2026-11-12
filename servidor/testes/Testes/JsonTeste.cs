using System.Text.Json;
using System.Text.Json.Nodes;
using ReinoDePedra.Api;

namespace ReinoDePedra.Testes;

/// <summary>Serializa o que o servidor devolve como o servidor faz: <see cref="Json.Web"/>, só com os metadados gerados.</summary>
public static class JsonTeste
{
    public static string Texto(object o) => JsonSerializer.Serialize(o, Json.Web.GetTypeInfo(o.GetType()));
    public static JsonNode? No(object o) => JsonSerializer.SerializeToNode(o, Json.Web.GetTypeInfo(o.GetType()));
    public static JsonElement Elemento(object o) => JsonSerializer.SerializeToElement(o, Json.Web.GetTypeInfo(o.GetType()));
}
