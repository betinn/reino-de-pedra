namespace ReinoDePedra.Jogo.Nucleo;

/// <summary>Relógio do jogo, em milissegundos Unix. Todo timer do jogo é um instante absoluto.</summary>
public interface IRelogio
{
    long Agora { get; }
}

/// <summary>
/// Relógio real. <c>aceleracao</c> &gt; 1 só para desenvolvimento local (REINO_ACELERACAO):
/// o tempo de jogo corre mais rápido que o real a partir do momento em que o processo sobe.
/// </summary>
public sealed class RelogioReal(double aceleracao = 1) : IRelogio
{
    private readonly long _inicioReal = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    private readonly double _acel = aceleracao <= 0 ? 1 : aceleracao;
    public long Agora
    {
        get
        {
            var real = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            return _acel == 1 ? real : _inicioReal + (long)((real - _inicioReal) * _acel);
        }
    }
}

/// <summary>Relógio controlado manualmente (testes e simulação de carga).</summary>
public sealed class RelogioFalso(long inicio) : IRelogio
{
    public long Agora { get; set; } = inicio;
    public void Avancar(TimeSpan t) => Agora += (long)t.TotalMilliseconds;
}

public static class T
{
    public const long Seg = 1000;
    public const long Min = 60 * Seg;
    public const long Hora = 60 * Min;
    public const long Dia = 24 * Hora;
    public static long DeSegundos(double s) => (long)Math.Round(s * 1000);
    public static long DeHoras(double h) => (long)Math.Round(h * Hora);
    public static double EmHoras(long ms) => ms / (double)Hora;
}
