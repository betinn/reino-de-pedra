using System.IO.Compression;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization.Metadata;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Persistencia;

namespace ReinoDePedra.Testes;

/// <summary>
/// O formato do save não muda com o JSON gerado (docs/decisoes/0040-servidor-native-aot.md).
/// <para><c>Amostras/save-antigo.jsonl.gz</c> foi gravado pela versão de antes (System.Text.Json por reflection): uma amostra de
/// cada tipo de documento de um mundo de 30 reinos depois de 10 dias de jogo (o teste de carga) e dos documentos gravados
/// pela suíte de testes inteira. Cada linha traz a coleção, o id, o tipo e o JSON gravado; <c>volta</c>, quando existe, é o
/// que a versão de antes gravava depois de ler esse JSON (na amostra atual nenhuma linha precisou).</para>
/// <para>Se um documento ganhar um campo, a volta passa a escrevê-lo e este teste falha de propósito: confira que a mudança é
/// a esperada e grave a amostra de novo (lendo o save antigo com a versão nova e conferindo o diff).</para>
/// </summary>
public class FormatoSaveTestes
{
    private static IEnumerable<JsonObject> Amostra()
    {
        var arq = Path.Combine(AppContext.BaseDirectory, "Amostras", "save-antigo.jsonl.gz");
        using var z = new GZipStream(File.OpenRead(arq), CompressionMode.Decompress);
        using var l = new StreamReader(z);
        while (l.ReadLine() is { } linha)
            if (linha.Length > 0) yield return JsonNode.Parse(linha)!.AsObject();
    }

    [Fact]
    public void Save_gravado_pela_versao_de_antes_le_e_grava_igual()
    {
        var tipos = new HashSet<string>();
        var n = 0;
        foreach (var o in Amostra())
        {
            var tipo = o["tipo"]!.GetValue<string>();
            var dados = o["dados"]!.GetValue<string>();
            var esperado = o["volta"]?.GetValue<string>() ?? dados;
            var info = Banco.Json.GetTypeInfo(RegistroTipos.Tipo(tipo));
            var doc = (Documento)JsonSerializer.Deserialize(dados, info)!;
            Assert.Equal(tipo, doc.GetType().Name);
            var novo = JsonSerializer.Serialize(doc, info);
            if (novo != esperado)
                Assert.Fail($"{tipo}#{o["id"]}: o JSON gravado mudou\nantes: {esperado}\ndepois: {novo}");
            tipos.Add(tipo);
            n++;
        }
        Assert.True(n > 300, $"amostra pequena: {n}");
        // a amostra cobre a maior parte dos documentos; os outros passam pelo teste abaixo (gerado contra reflection)
        Assert.True(tipos.Count * 10 >= JsonJogo.Documentos.Length * 8, $"tipos na amostra: {tipos.Count} de {JsonJogo.Documentos.Length}");
    }

    /// <summary>Reflection pedida de propósito, só para comparar: as mesmas opções do save, sem os metadados gerados.</summary>
    private static readonly JsonSerializerOptions Reflection = new(Banco.Json) { TypeInfoResolver = new DefaultJsonTypeInfoResolver() };

    [Fact]
    public void Cada_documento_grava_igual_com_metadados_gerados_e_com_reflection()
    {
        foreach (var o in Amostra())
        {
            var t = RegistroTipos.Tipo(o["tipo"]!.GetValue<string>());
            var dados = o["dados"]!.GetValue<string>();
            var gerado = JsonSerializer.Serialize(JsonSerializer.Deserialize(dados, Banco.Json.GetTypeInfo(t)), Banco.Json.GetTypeInfo(t));
            var refl = JsonSerializer.Serialize(JsonSerializer.Deserialize(dados, t, Reflection), t, Reflection);
            Assert.Equal(refl, gerado);
        }
        // tipos fora da amostra: um documento novo (valores padrão) de cada
        foreach (var t in JsonJogo.Documentos)
        {
            var d = (Documento)Activator.CreateInstance(t)!;
            d.Id = 42;
            Assert.Equal(JsonSerializer.Serialize(d, t, Reflection), JsonSerializer.Serialize(d, Banco.Json.GetTypeInfo(t)));
        }
    }

    [Fact]
    public void Balanceamento_le_igual_com_metadados_gerados_e_com_reflection()
    {
        var caminho = Balanceamento.Localizar();
        var gerado = Balanceamento.Carregar(caminho);
        var opRefl = new JsonSerializerOptions(Balanceamento.OpcoesJson) { TypeInfoResolver = new DefaultJsonTypeInfoResolver() };
        Balanceamento refl;
        using (var f = File.OpenRead(caminho)) refl = JsonSerializer.Deserialize<Balanceamento>(f, opRefl)!;
        foreach (var (id, u) in refl.U) u.Id = id;
        var escrever = new JsonSerializerOptions { TypeInfoResolver = new DefaultJsonTypeInfoResolver() };
        Assert.Equal(JsonSerializer.Serialize(refl, escrever), JsonSerializer.Serialize(gerado, escrever));
    }
}
