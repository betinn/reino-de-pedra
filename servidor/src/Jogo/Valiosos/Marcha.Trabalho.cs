namespace ReinoDePedra.Jogo.Marchas;

/// <summary>Trabalho de um exército parado no mapa: extração numa jazida ou escavação numa ruína antiga.</summary>
public abstract partial class Marcha
{
    /// <summary>Jazida em que o exército extrai agora (parado no hexágono dela).</summary>
    public long? ExtraiJazidaId { get; set; }
    /// <summary>O caminho até o depósito usa rota pública (bônus de rota da extração).</summary>
    public bool? ExtraiRota { get; set; }
    /// <summary>Evento de fim da extração (carga cheia ou jazida esgotada).</summary>
    public long? ExtraiEventoId { get; set; }

    /// <summary>Ruína antiga que o exército escava agora.</summary>
    public long? EscavaRuinaId { get; set; }
    public long? EscavaInicio { get; set; }
    public long? EscavaFim { get; set; }
    public long? EscavaEventoId { get; set; }
}
