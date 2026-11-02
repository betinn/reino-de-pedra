using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.Marchas;

/// <summary>
/// Qualquer coisa que anda pelo mapa: carregadores, caravanas, exércitos, exploradores, mensageiros.
/// O caminho é calculado na partida e a posição em qualquer instante sai de <see cref="Tempos"/> (sem tique).
/// Subclasses dizem o que acontece na chegada (<see cref="Chegou"/>); para voltar, chame
/// <see cref="Partir"/> de novo com o caminho de volta.
/// </summary>
public abstract partial class Marcha : Documento
{
    public long ReinoId { get; set; }
    public int Origem { get; set; }
    public int Destino { get; set; }
    /// <summary>Hexágonos do caminho, do primeiro (origem) ao último (destino).</summary>
    public List<int> Caminho { get; set; } = new();
    /// <summary>Instante (ms) em que a marcha chega a cada hexágono do caminho; Tempos[0] = partida.</summary>
    public List<long> Tempos { get; set; } = new();
    public Dictionary<string, int> Tropas { get; set; } = new();
    public Recursos Carga { get; set; } = new();
    /// <summary>"Lenta", "Média" ou "Rápida" (a da unidade mais lenta).</summary>
    public string Vel { get; set; } = "Lenta";
    public long? EventoId { get; set; }
    public bool Retornando { get; set; }
    /// <summary>Leva o estandarte (identidade revelada a quem vê).</summary>
    public bool Estandarte { get; set; }

    public long Partida => Tempos.Count > 0 ? Tempos[0] : 0;
    public long Chegada => Tempos.Count > 0 ? Tempos[^1] : 0;

    /// <summary>Nome do tipo na API ("carregadores", "exercito"...).</summary>
    public abstract string Tipo { get; }
    /// <summary>O que acontece quando chega ao fim do caminho. A marcha já foi tirada da agenda.</summary>
    public abstract void Chegou(Mundo m);
    /// <summary>Quantas pessoas do teto de população esta marcha ocupa.</summary>
    public virtual int PopOcupada(Mundo m) => Economia.PopDeGrupo(m, Tropas);

    /// <summary>Hexágono em que a marcha está no instante t (o último alcançado).</summary>
    public int HexEm(long t)
    {
        if (Caminho.Count == 0) return Origem;
        var i = Tempos.BinarySearch(t);
        if (i < 0) i = ~i - 1;
        return Caminho[Math.Clamp(i, 0, Caminho.Count - 1)];
    }

    /// <summary>Posição contínua (índice fracionário no caminho) no instante t, para desenhar.</summary>
    public double ProgressoEm(long t)
    {
        if (Tempos.Count < 2 || t <= Tempos[0]) return 0;
        if (t >= Tempos[^1]) return Caminho.Count - 1;
        var i = Tempos.BinarySearch(t);
        if (i >= 0) return i;
        i = ~i - 1;
        var a = Tempos[i]; var b = Tempos[i + 1];
        return i + (t - a) / (double)Math.Max(1, b - a);
    }

    /// <summary>Põe a marcha a caminho e agenda a chegada.</summary>
    public void Partir(Mundo m, Rota rota)
    {
        Caminho = rota.Hexes.ToList();
        Origem = Caminho[0]; Destino = Caminho[^1];
        var t0 = m.Agora;
        Tempos = rota.Minutos.Select(min => t0 + (long)Math.Round(min * T.Min)).ToList();
        m.Cancelar(EventoId);
        if (!m.Marchas.ContemId(Id)) m.Marchas.Adicionar(this);
        EventoId = m.Agendar(new ChegadaMarchaEvento { MarchaId = Id, Quando = Chegada }).Id;
        m.Sujar(this);
        foreach (var f in AoPartir) f(m, this);
        m.Avisar(ReinoId, "marchas");
    }

    /// <summary>
    /// Ganchos chamados a cada partida (inclusive volta e mudança de rota): fauna agenda ataques no caminho,
    /// combate agenda encontros com guarnições em postura agressiva, avistamentos... Cancele seus eventos antigos
    /// da marcha (ex.: guardando ids num campo partial) porque o caminho mudou.
    /// </summary>
    public static List<Action<Mundo, Marcha>> AoPartir { get; } = new();

    /// <summary>Tira a marcha do mapa.</summary>
    public void Encerrar(Mundo m)
    {
        m.Cancelar(EventoId);
        m.Marchas.Remover(this);
        m.Avisar(ReinoId, "marchas");
    }
}

public sealed class ChegadaMarchaEvento : Evento
{
    public long MarchaId { get; set; }
    public override void Executar(Mundo m)
    {
        var mc = m.Marchas.Obter(MarchaId);
        if (mc == null) return;
        mc.EventoId = null;
        mc.Chegou(m);
    }
}
