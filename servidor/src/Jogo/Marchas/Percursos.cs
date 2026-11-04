using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Marchas;

/// <summary>
/// Percursos de tropas: a linha exata que o jogador desenhou, hexágono a hexágono. As tropas vão até o primeiro ponto pelo
/// caminho de sempre e depois seguem a linha sem desviar (<see cref="Caminhos.Seguir"/>). O percurso acaba no último ponto; a
/// patrulha repete até nova ordem, em ida e volta numa linha aberta ou em volta de um circuito fechado. Em
/// <see cref="Exercito.Dados"/>: <c>pontos</c> (a linha inteira, vizinhos em sequência), <c>ponto</c> (0 indo ao começo, 1 já
/// na linha), <c>circuito</c> (fecha a linha, do fim ao começo) e <c>sentido</c> (1 ou -1, na ida e volta).
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
        ex.Dados["sentido"] = 1;
    }

    /// <summary>Liga os pontos em linha reta onde houver falha (quem desenha no mapa manda a linha já inteira) e tira repetições seguidas.</summary>
    public static List<int> Ligar(Mundo m, IReadOnlyList<int> pontos)
    {
        var linha = new List<int>();
        foreach (var h in pontos)
        {
            if (linha.Count == 0) { linha.Add(h); continue; }
            if (linha[^1] != h) linha.AddRange(m.G.Reta(linha[^1], h).Skip(1));
        }
        return linha;
    }

    /// <summary>Confere a linha (no mapa, até <c>P.patrulha.maxHexes</c>) e a grava inteira; o destino da ordem é o primeiro ponto.</summary>
    public static void Validar(Mundo m, Exercito ex, int destino, int minimo)
    {
        var ps = Pontos(ex);
        if (ps.Count == 0 || ps[0] != destino) ps.Insert(0, destino);
        if (ps.Any(h => !m.G.Valido(h))) throw new RegraException("Ponto fora do mapa.");
        var circuito = ex.Dados["circuito"]?.GetValue<bool>() == true;
        var linha = Ligar(m, circuito ? ps.Append(ps[0]).ToList() : ps);
        if (linha.Count < minimo) throw new RegraException("Desenhe a linha no mapa: pelo menos dois hexágonos.");
        if (linha.Count > m.P.Patrulha.MaxHexes) throw new RegraException("A linha tem no máximo " + m.P.Patrulha.MaxHexes + " hexágonos.");
        Gravar(ex, linha, circuito && linha.Count > 1);
    }

    /// <summary>Caminho da partida: a própria linha, se as tropas já estão no começo dela; senão, até o começo.</summary>
    public static Rota Trajeto(Mundo m, Exercito ex, int de)
    {
        var ps = Pontos(ex);
        if (ps[0] != de) return Exercitos.Rota(m, ex, de, ps[0]);
        if (ps.Count < 2) throw new RegraException("As tropas já estão aqui.");
        ex.Dados["ponto"] = 1;
        return Caminhos.Seguir(m, ps, ex.Vel, new OpcoesCaminho { ReinoId = ex.ReinoId });
    }

    /// <summary>Chegou ao começo ou ao fim da linha: entra nela, repete (<paramref name="repete"/>) ou para.</summary>
    public static void Proximo(Mundo m, Exercito ex, bool repete, string titulo)
    {
        var ps = Pontos(ex);
        var aqui = ex.HexEm(m.Agora);
        var naLinha = ex.Dados["ponto"]?.GetValue<int>() == 1;
        var sentido = ex.Dados["sentido"]?.GetValue<int>() ?? 1;
        if (ps.Count >= 2 && (!naLinha || repete))
        {
            if (naLinha && ps[0] != ps[^1]) sentido = -sentido;   // linha aberta: dá meia-volta no fim
            var trecho = sentido > 0 ? ps : Enumerable.Reverse(ps).ToList();
            if (trecho[0] == aqui)
            {
                ex.Dados["ponto"] = 1; ex.Dados["sentido"] = sentido;
                ex.Retornando = false;
                ex.Partir(m, Caminhos.Seguir(m, trecho, ex.Vel, new OpcoesCaminho { ReinoId = ex.ReinoId }));
                return;
            }
        }
        ex.Ordem = OrdemMover.Id;
        ex.Parar(m);
        Exercitos.Avisar(m, ex, titulo, GT.Partes(m, ex.Tropas) + " · paradas no hexágono " + m.G.C(aqui) + ", " + m.G.L(aqui));
    }
}

/// <summary>Segue uma vez a linha desenhada (<c>Dados.pontos</c>, o primeiro é o destino) e para no último ponto; com <c>Dados.circuito</c>, fecha a linha e repete.</summary>
public sealed class OrdemPercorrer : IOrdemExercito
{
    public const string Id = "percorrer";
    public string Ordem => Id;
    public bool NoMesmoHex => true;
    public void Validar(Mundo m, Reino r, Exercito ex, int destino) => Percursos.Validar(m, ex, destino, 1);
    public Rota Trajeto(Mundo m, Exercito ex, int destino, int de) => Percursos.Trajeto(m, ex, de);
    public void Chegou(Mundo m, Exercito ex) => Percursos.Proximo(m, ex, ex.Dados["circuito"]?.GetValue<bool>() == true, "Percurso concluído");
}

/// <summary>
/// Patrulha permanente na linha desenhada: as tropas andam por ela até nova ordem, mantendo a área à vista (e, com a postura
/// "atacar qualquer ameaça", saindo contra quem passar). Linha aberta: vão e voltam por ela. Fechada: dão a volta.
/// </summary>
public sealed class OrdemPatrulhar : IOrdemExercito
{
    public const string Id = "patrulhar";
    public string Ordem => Id;
    public bool NoMesmoHex => true;
    public void Validar(Mundo m, Reino r, Exercito ex, int destino) => Percursos.Validar(m, ex, destino, 2);
    public Rota Trajeto(Mundo m, Exercito ex, int destino, int de) => Percursos.Trajeto(m, ex, de);
    public void Chegou(Mundo m, Exercito ex) => Percursos.Proximo(m, ex, true, "Patrulha interrompida");
}
