using ReinoDePedra.Jogo.Nucleo;

namespace ReinoDePedra.Jogo.Mapa;

/// <summary>Jazida de recurso valioso ou lendário. Finita; oculta até ser descoberta por um prospector.</summary>
public sealed partial class Jazida : Documento
{
    public int Hex { get; set; }
    public string Recurso { get; set; } = "";
    public double Inicial { get; set; }
    public double Restante { get; set; }
    /// <summary>Reinos que já descobriram esta jazida.</summary>
    public HashSet<long> DescobertaPor { get; set; } = new();
}

/// <summary>Ruína antiga: guarda 1 relíquia lendária, de tipo desconhecido até ser achada.</summary>
public sealed partial class Ruina : Documento
{
    public int Hex { get; set; }
    /// <summary>"ataque", "producao" ou "resistencia" (segredo do servidor até ser achada).</summary>
    public string TipoReliquia { get; set; } = "";
    public bool Esgotada { get; set; }
}
