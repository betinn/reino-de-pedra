using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Marchas;

/// <summary>
/// Percursos de tropas: rota desenhada pelo jogador (pontos em ordem, opcionalmente em circuito) e patrulha permanente em
/// volta de um lugar (um circuito de pontos num anel em volta do centro). As duas seguem até nova ordem ou, a rota sem
/// circuito, até o último ponto, onde as tropas ficam paradas. Os pontos ficam em <see cref="Exercito.Dados"/>:
/// <c>pontos</c> (hexágonos), <c>ponto</c> (índice do ponto para onde vão) e <c>circuito</c>.
/// </summary>
public static class Percursos
{
    public static List<int> Pontos(Exercito ex) =>
        ex.Dados["pontos"] is JsonArray a ? a.Select(x => x!.GetValue<int>()).ToList() : new();

    public static void Gravar(Exercito ex, List<int> pontos, bool circuito)
    {
        ex.Dados["pontos"] = new JsonArray(pontos.Select(h => (JsonNode)h).ToArray());
        ex.Dados["ponto"] = 0;
        ex.Dados["circuito"] = circuito;
    }

    /// <summary>Confere os pontos (no mapa, até o máximo da fila) e os grava; o primeiro é o destino da ordem.</summary>
    public static void Validar(Mundo m, Exercito ex, int destino, bool circuitoPadrao)
    {
        var ps = Pontos(ex);
        if (ps.Count == 0) ps.Add(destino);
        if (ps[0] != destino) ps.Insert(0, destino);
        if (ps.Count > Fila.Maximo) throw new RegraException("O percurso tem no máximo " + Fila.Maximo + " pontos.");
        if (ps.Any(h => !m.G.Valido(h))) throw new RegraException("Ponto fora do mapa.");
        for (var i = ps.Count - 1; i > 0; i--) if (ps[i] == ps[i - 1]) ps.RemoveAt(i);
        var circuito = ex.Dados["circuito"]?.GetValue<bool>() ?? circuitoPadrao;
        Gravar(ex, ps, circuito && ps.Count > 1);
    }

    /// <summary>Chegou a um ponto: vai ao próximo; no fim, recomeça (circuito) ou para.</summary>
    public static void Proximo(Mundo m, Exercito ex, string titulo)
    {
        var ps = Pontos(ex);
        var i = (ex.Dados["ponto"]?.GetValue<int>() ?? 0) + 1;
        var circuito = ex.Dados["circuito"]?.GetValue<bool>() == true;
        if (i >= ps.Count && circuito) i = 0;
        var aqui = ex.HexEm(m.Agora);
        while (i < ps.Count && ps[i] == aqui) i++;
        if (i < ps.Count)
        {
            try
            {
                var rota = Exercitos.Rota(m, ex, aqui, ps[i]);
                ex.Dados["ponto"] = i;
                ex.Retornando = false;
                ex.Partir(m, rota);
                return;
            }
            catch (RegraException) { /* sem caminho: param no ponto em que estão */ }
        }
        ex.Ordem = OrdemMover.Id;
        ex.Parar(m);
        Exercitos.Avisar(m, ex, titulo, GT.Partes(m, ex.Tropas) + " · paradas no hexágono " + m.G.C(aqui) + ", " + m.G.L(aqui));
    }

    /// <summary>Circuito de patrulha: <c>P.patrulha.pontos</c> pontos no anel de raio <c>P.patrulha.raio</c> em volta do centro, em ordem de ângulo.</summary>
    public static List<int> Anel(Mundo m, int centro, int? raio = null)
    {
        var r = Math.Max(1, raio ?? m.P.Patrulha.Raio);
        var g = m.G;
        (double x, double y) P(int h) => (g.C(h) + 0.5 * (g.L(h) & 1), g.L(h) * 0.866);
        var (cx, cy) = P(centro);
        var anel = g.Area(centro, r).Where(h => g.Distancia(h, centro) == r && !m.Mapa.Rio[h])
            .OrderBy(h => Math.Atan2(P(h).y - cy, P(h).x - cx)).ToList();
        if (anel.Count == 0) return [centro];
        var n = Math.Clamp(m.P.Patrulha.Pontos, 3, anel.Count);
        return Enumerable.Range(0, n).Select(k => anel[k * anel.Count / n]).ToList();
    }
}

/// <summary>Percorre os pontos desenhados pelo jogador (<c>Dados.pontos</c>, o primeiro é o destino); com <c>Dados.circuito</c>, recomeça no fim.</summary>
public sealed class OrdemPercorrer : IOrdemExercito
{
    public const string Id = "percorrer";
    public string Ordem => Id;
    public void Validar(Mundo m, Reino r, Exercito ex, int destino) => Percursos.Validar(m, ex, destino, false);
    public void Chegou(Mundo m, Exercito ex) => Percursos.Proximo(m, ex, "Percurso concluído");
}

/// <summary>
/// Patrulha permanente em volta de um lugar: o destino é o centro; as tropas andam num circuito de pontos em volta dele até
/// nova ordem, mantendo a área à vista (e, com a postura "atacar qualquer ameaça", saindo contra quem passar).
/// </summary>
public sealed class OrdemPatrulhar : IOrdemExercito
{
    public const string Id = "patrulhar";
    public string Ordem => Id;
    public void Validar(Mundo m, Reino r, Exercito ex, int destino)
    {
        var anel = Percursos.Anel(m, destino, ex.Dados["raio"]?.GetValue<int>());
        // começa pelo ponto do anel mais perto de onde as tropas estão; o destino da ordem é trocado por ele em Exercitos
        Percursos.Gravar(ex, anel, true);
        ex.Dados["centro"] = destino;
    }
    /// <summary>Entra no circuito pelo ponto do anel mais perto de onde as tropas estão.</summary>
    public int Primeiro(Mundo m, Exercito ex, int destino, int de)
    {
        var ps = Percursos.Pontos(ex);
        if (ps.Count == 0) return destino;
        var i = Enumerable.Range(0, ps.Count).OrderBy(k => m.G.Distancia(ps[k], de)).First();
        Percursos.Gravar(ex, ps.Skip(i).Concat(ps.Take(i)).ToList(), true);
        return ps[i];
    }
    public void Chegou(Mundo m, Exercito ex) => Percursos.Proximo(m, ex, "Patrulha interrompida");
}
