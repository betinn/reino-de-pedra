using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Forja;
using ReinoDePedra.Jogo.IA;
using ReinoDePedra.Jogo.Mapa;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Pessoas;
using ReinoDePedra.Jogo.Publico;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using ReinoDePedra.Jogo.Temporada;
using ReinoDePedra.Jogo.Valiosos;

namespace ReinoDePedra.Jogo.Persistencia;

/// <summary>
/// Metadados de JSON gerados na compilação para o que o jogo grava e lê: os documentos do save, o legado, o balanceamento,
/// a persona da IA e os nós de <see cref="JsonNode"/>. Nada passa por reflection (o servidor publicado é Native AOT, e os
/// testes desligam a reflection do System.Text.Json para que um tipo esquecido aqui quebre o teste, não a produção).
/// As opções de cada uso (nomes, nulos, enums) ficam nos <see cref="JsonSerializerOptions"/> de quem usa
/// (<see cref="Banco.Json"/>, <see cref="Balanceamento.OpcoesJson"/>); este contexto só fornece os metadados.
/// </summary>
[JsonSerializable(typeof(Alianca))]
[JsonSerializable(typeof(AtaqueFaunaEvento))]
[JsonSerializable(typeof(AvaliarFilasEvento))]
[JsonSerializable(typeof(Avistamento))]
[JsonSerializable(typeof(AvistamentoAtaqueEvento))]
[JsonSerializable(typeof(Bandeira))]
[JsonSerializable(typeof(Batalha))]
[JsonSerializable(typeof(CapturaExploradorEvento))]
[JsonSerializable(typeof(Caravana))]
[JsonSerializable(typeof(Carregadores))]
[JsonSerializable(typeof(CheckpointReinoEvento))]
[JsonSerializable(typeof(ChegadaMarchaEvento))]
[JsonSerializable(typeof(Deslocamento))]
[JsonSerializable(typeof(EncontroInterceptacaoEvento))]
[JsonSerializable(typeof(EncontroPosturaEvento))]
[JsonSerializable(typeof(EquipamentoLendario))]
[JsonSerializable(typeof(EstadoIA))]
[JsonSerializable(typeof(EstadoMundo))]
[JsonSerializable(typeof(Exercito))]
[JsonSerializable(typeof(Explorador))]
[JsonSerializable(typeof(FimAvistamentoEvento))]
[JsonSerializable(typeof(FimBatalhaEvento))]
[JsonSerializable(typeof(FimCacaEvento))]
[JsonSerializable(typeof(FimColetaEvento))]
[JsonSerializable(typeof(FimEscavacaoEvento))]
[JsonSerializable(typeof(FimEspionagemEvento))]
[JsonSerializable(typeof(FimExtracaoEvento))]
[JsonSerializable(typeof(FimItemFilaEvento))]
[JsonSerializable(typeof(FimPactoEvento))]
[JsonSerializable(typeof(FimPropostaEvento))]
[JsonSerializable(typeof(FimTemporadaEvento))]
[JsonSerializable(typeof(FotoNevoa))]
[JsonSerializable(typeof(GatilhoDefesasEvento))]
[JsonSerializable(typeof(Jazida))]
[JsonSerializable(typeof(LimparBatalhaEvento))]
[JsonSerializable(typeof(Local))]
[JsonSerializable(typeof(MalhaViaria))]
[JsonSerializable(typeof(Mensageiro))]
[JsonSerializable(typeof(Mensagem))]
[JsonSerializable(typeof(MensagemGlobal))]
[JsonSerializable(typeof(MorteFeridosEvento))]
[JsonSerializable(typeof(MoverFaunaEvento))]
[JsonSerializable(typeof(Nevoa))]
[JsonSerializable(typeof(Notificacao))]
[JsonSerializable(typeof(Pacto))]
[JsonSerializable(typeof(Pessoa))]
[JsonSerializable(typeof(PontoColeta))]
[JsonSerializable(typeof(PrazoPrisioneiroEvento))]
[JsonSerializable(typeof(Prisioneiro))]
[JsonSerializable(typeof(Proposta))]
[JsonSerializable(typeof(ReacaoIAEvento))]
[JsonSerializable(typeof(RegiaoFauna))]
[JsonSerializable(typeof(Reino))]
[JsonSerializable(typeof(Relatorio))]
[JsonSerializable(typeof(Reliquia))]
[JsonSerializable(typeof(Remessa))]
[JsonSerializable(typeof(RevelarCaminhoEvento))]
[JsonSerializable(typeof(Ruina))]
[JsonSerializable(typeof(SessaoIAEvento))]
[JsonSerializable(typeof(Torre))]
[JsonSerializable(typeof(UnidadeProntaEvento))]
[JsonSerializable(typeof(VoltaFaunaEvento))]
// fora da tabela docs
[JsonSerializable(typeof(LegadoConta))]
[JsonSerializable(typeof(Balanceamento))]
[JsonSerializable(typeof(Persona))]
[JsonSerializable(typeof(ContextoFala))]
[JsonSerializable(typeof(Brasao))]
[JsonSerializable(typeof(JsonNode))]
[JsonSerializable(typeof(JsonObject))]
[JsonSerializable(typeof(JsonArray))]
[JsonSerializable(typeof(JsonElement))]
public sealed partial class JsonJogo : JsonSerializerContext
{
    /// <summary>
    /// Os documentos concretos (o que <see cref="Nucleo.RegistroTipos"/> conhece pelo nome gravado na coluna <c>tipo</c>).
    /// Um documento novo entra aqui e num <c>[JsonSerializable]</c> acima; o teste RegistrosTestes confere os dois contra a reflection.
    /// </summary>
    public static readonly Type[] Documentos =
    [
        typeof(Alianca), typeof(AtaqueFaunaEvento), typeof(AvaliarFilasEvento), typeof(Avistamento), typeof(AvistamentoAtaqueEvento),
        typeof(Bandeira), typeof(Batalha), typeof(CapturaExploradorEvento), typeof(Caravana), typeof(Carregadores),
        typeof(CheckpointReinoEvento), typeof(ChegadaMarchaEvento), typeof(Deslocamento), typeof(EncontroInterceptacaoEvento),
        typeof(EncontroPosturaEvento), typeof(EquipamentoLendario), typeof(EstadoIA), typeof(EstadoMundo), typeof(Exercito),
        typeof(Explorador), typeof(FimAvistamentoEvento), typeof(FimBatalhaEvento), typeof(FimCacaEvento), typeof(FimColetaEvento),
        typeof(FimEscavacaoEvento), typeof(FimEspionagemEvento), typeof(FimExtracaoEvento), typeof(FimItemFilaEvento),
        typeof(FimPactoEvento), typeof(FimPropostaEvento), typeof(FimTemporadaEvento), typeof(FotoNevoa), typeof(GatilhoDefesasEvento),
        typeof(Jazida), typeof(LimparBatalhaEvento), typeof(Local), typeof(MalhaViaria), typeof(Mensageiro), typeof(Mensagem),
        typeof(MensagemGlobal), typeof(MorteFeridosEvento), typeof(MoverFaunaEvento), typeof(Nevoa), typeof(Notificacao),
        typeof(Pacto), typeof(Pessoa), typeof(PontoColeta), typeof(PrazoPrisioneiroEvento), typeof(Prisioneiro), typeof(Proposta),
        typeof(ReacaoIAEvento), typeof(RegiaoFauna), typeof(Reino), typeof(Relatorio), typeof(Reliquia), typeof(Remessa),
        typeof(RevelarCaminhoEvento), typeof(Ruina), typeof(SessaoIAEvento), typeof(Torre), typeof(UnidadeProntaEvento),
        typeof(VoltaFaunaEvento),
    ];

    /// <summary>Opções padrão do System.Text.Json (nomes como estão, nulos escritos), com os metadados gerados.</summary>
    /// <remarks>Propriedade, não campo: a ordem dos inicializadores estáticos entre as partes geradas não é garantida.</remarks>
    public static JsonSerializerOptions Padrao => _padrao ??= new JsonSerializerOptions { TypeInfoResolver = Default };
    private static JsonSerializerOptions? _padrao;
}

/// <summary>
/// Enums como texto, um conversor por enum (o <c>JsonStringEnumConverter</c> sem tipo precisa de código gerado em tempo de
/// execução, o que o Native AOT não tem). Um enum novo que vá para o JSON entra aqui; o teste RegistrosTestes confere.
/// </summary>
public static class ConversoresEnum
{
    public static JsonConverter[] Todos(JsonNamingPolicy? nomes = null) =>
    [
        new JsonStringEnumConverter<Terreno>(nomes),
        new JsonStringEnumConverter<EstadoItem>(nomes),
        new JsonStringEnumConverter<TipoLocal>(nomes),
        new JsonStringEnumConverter<Postura>(nomes),
    ];

    public static JsonSerializerOptions Com(this JsonSerializerOptions o, JsonNamingPolicy? nomes = null)
    {
        foreach (var c in Todos(nomes)) o.Converters.Add(c);
        return o;
    }
}
