namespace ReinoDePedra.Jogo.Nucleo;

/// <summary>
/// Algo que acontece num instante do futuro (fim de obra, chegada de marcha...). Persistido na coleção
/// <c>eventos</c>; o motor executa em ordem de <see cref="Quando"/>. Durante <see cref="Executar"/>,
/// <c>m.Agora</c> vale <see cref="Quando"/> (mesmo se o servidor ficou fora do ar e está recuperando atraso).
/// Para criar: <c>m.Agendar(new MeuEvento { Quando = ..., ... })</c>. Para cancelar: <c>m.Cancelar(id)</c>.
/// </summary>
public abstract class Evento : Documento
{
    public long Quando { get; set; }
    /// <summary>Ordem de criação, para desempatar eventos no mesmo instante.</summary>
    public long Seq { get; set; }
    public abstract void Executar(Mundo m);
}

/// <summary>Fila por horário de término. Só guarda ids; o evento vive na coleção <c>m.Eventos</c>.</summary>
public sealed class Agenda
{
    private readonly PriorityQueue<long, (long quando, long seq)> _fila = new();
    public void Inserir(Evento e) => _fila.Enqueue(e.Id, (e.Quando, e.Seq));
    public bool Proximo(out long id, out long quando)
    {
        if (_fila.TryPeek(out id, out var p)) { quando = p.quando; return true; }
        quando = 0; return false;
    }
    public void Descartar() => _fila.Dequeue();
    public int Count => _fila.Count;
    public void Limpar() => _fila.Clear();
}
