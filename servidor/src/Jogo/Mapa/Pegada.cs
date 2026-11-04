using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.Mapa;

/// <summary>
/// Hexágonos que uma construção ocupa (<c>P.ocupa</c>): 7 = o hexágono e o anel em volta (castelo); 3 = o hexágono e os
/// vizinhos de leste e de oeste (os locais); 1 = só o hexágono (posto). O hexágono do local (<see cref="Local.Hex"/>) é o centro:
/// distâncias, caminhos e visão continuam medidos dele; a pegada só reserva o chão (fundar, torres, fauna) e responde ao toque.
/// </summary>
public static class Pegada
{
    public static IEnumerable<int> Hexes(Grade g, int tamanho, int centro)
    {
        if (tamanho >= 7) { foreach (var h in g.Area(centro, 1)) yield return h; yield break; }
        yield return centro;
        if (tamanho < 3) yield break;
        int c = g.C(centro), l = g.L(centro);
        if (g.Dentro(c - 1, l)) yield return g.Indice(c - 1, l);
        if (g.Dentro(c + 1, l)) yield return g.Indice(c + 1, l);
    }

    public static int Tamanho(Mundo m, TipoLocal tipo) => m.P.Ocupa.TryGetValue(tipo.Chave(), out var n) ? n : 1;
    public static IEnumerable<int> Hexes(Mundo m, TipoLocal tipo, int centro) => Hexes(m.G, Tamanho(m, tipo), centro);
    public static IEnumerable<int> DoLocal(Mundo m, Local l) => Hexes(m, l.Tipo, l.Hex);
}
