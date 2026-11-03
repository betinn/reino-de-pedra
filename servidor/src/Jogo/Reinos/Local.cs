using ReinoDePedra.Jogo.Nucleo;

namespace ReinoDePedra.Jogo.Reinos;

public enum TipoLocal { Castelo, Vila, Pasto, Serraria, Mina, Quartel, Armazem, Ferraria, Posto }

/// <summary>Postura de guarnições e exércitos, que funciona com o jogador offline.</summary>
public enum Postura { ApenasDefender, AtacarQuemAtacar, AtacarQualquer }

/// <summary>
/// Um local do reino (ou ruína/terra sem dono quando ReinoId = 0). Cada local é um alvo com defesa
/// própria e acumula a própria produção. <c>partial</c>: sistemas acrescentam campos em arquivo próprio.
/// </summary>
public sealed partial class Local : Documento
{
    public long ReinoId { get; set; }
    public TipoLocal Tipo { get; set; }
    /// <summary>Recurso produzido ("comida", "madeira", "pedra", "ferro"), ou null.</summary>
    public string? Produz { get; set; }
    public int Nivel { get; set; } = 1;
    public int Hex { get; set; }
    public string Nome { get; set; } = "";
    /// <summary>Recursos guardados no local (no instante <see cref="Reino.AtualizadoEm"/> do dono).</summary>
    public Recursos Estoque { get; set; } = new();
    /// <summary>Moradias neste local (castelo e vilas).</summary>
    public int Moradias { get; set; }
    /// <summary>Tropas paradas no local, por unidade (ids de <c>U</c>).</summary>
    public Dictionary<string, int> Guarnicao { get; set; } = new();
    public Postura Postura { get; set; } = Postura.ApenasDefender;
    /// <summary>Local destruído (castelo caído, abandono): pode ser ocupado ou reconstruído.</summary>
    public bool Ruina { get; set; }
    /// <summary>
    /// Local que só existe na foto da névoa de quem ataca (sumiu de verdade). Nunca entra no mundo: serve para planejar o
    /// ataque como se ainda estivesse lá; as tropas descobrem na chegada. Não é gravado.
    /// </summary>
    [System.Text.Json.Serialization.JsonIgnore] public bool Fantasma { get; init; }

    public bool EhProducao => Produz != null && Tipo != TipoLocal.Castelo;
    public int TropasNaGuarnicao => Guarnicao.Values.Sum();
}

public static class TiposLocal
{
    public static string Chave(this TipoLocal t) => t switch
    {
        TipoLocal.Castelo => "castelo", TipoLocal.Vila => "vila", TipoLocal.Pasto => "pasto", TipoLocal.Serraria => "serraria",
        TipoLocal.Mina => "mina", TipoLocal.Quartel => "quartel", TipoLocal.Armazem => "armazem", TipoLocal.Ferraria => "ferraria",
        _ => "posto",
    };
    public static TipoLocal? DeChave(string? s) => s switch
    {
        "castelo" => TipoLocal.Castelo, "vila" => TipoLocal.Vila, "pasto" => TipoLocal.Pasto, "serraria" => TipoLocal.Serraria,
        "mina" => TipoLocal.Mina, "quartel" => TipoLocal.Quartel, "armazem" => TipoLocal.Armazem, "ferraria" => TipoLocal.Ferraria,
        "posto" => TipoLocal.Posto, _ => null,
    };
    /// <summary>Nome genérico (o que outros reinos veem: explorar não revela o dono).</summary>
    public static string NomeGenerico(this TipoLocal t) => t switch
    {
        TipoLocal.Castelo => "Castelo", TipoLocal.Vila => "Vila", TipoLocal.Pasto => "Pasto", TipoLocal.Serraria => "Serraria",
        TipoLocal.Mina => "Mina", TipoLocal.Quartel => "Quartel", TipoLocal.Armazem => "Armazém", TipoLocal.Ferraria => "Ferraria",
        _ => "Posto",
    };
}
