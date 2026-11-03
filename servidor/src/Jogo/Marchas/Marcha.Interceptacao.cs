using System.Text.Json.Serialization;

namespace ReinoDePedra.Jogo.Marchas;

/// <summary>
/// Contrato de interceptação: o combate decide quem vence; quem perde no caminho entrega carga e relíquias.
/// Exércitos, carregadores e caravanas são interceptáveis; exploradores e mensageiros devem devolver false.
/// </summary>
public abstract partial class Marcha
{
    /// <summary>Pode ser alcançada e atacada no caminho.</summary>
    [JsonIgnore] public virtual bool Interceptavel => true;

    /// <summary>Relíquias lendárias levadas pela marcha (ids). Não ocupam carga.</summary>
    public List<long> Reliquias { get; set; } = new();

    /// <summary>Ganchos de quem perde no caminho, antes de ser esvaziada (perdedor, vencedor): o equipamento lendário vai ao vencedor.</summary>
    public static List<Action<Mundo, Marcha, Exercito>> AoPerderNoCaminho { get; } = new();

    /// <summary>
    /// Chamado pelo combate quando a marcha perde para <paramref name="vencedor"/> no caminho: a carga passa ao
    /// vencedor até a capacidade livre dele (o resto se perde), as relíquias vão todas, e a marcha sai do mapa.
    /// As baixas são do combate; aqui a marcha só é esvaziada e encerrada.
    /// </summary>
    public virtual void AoSerVencida(Mundo m, Exercito vencedor)
    {
        foreach (var f in AoPerderNoCaminho) f(m, this, vencedor);
        var livre = Math.Max(0, vencedor.CargaMax(m) - vencedor.Carga.Total);
        var total = Carga.Total;
        if (total > 0 && livre > 0)
        {
            var f = Math.Min(1, livre / total);
            foreach (var (k, v) in Carga.ToList()) vencedor.Carga.Somar(k, v * f);
        }
        vencedor.Reliquias.AddRange(Reliquias);
        Reliquias = new();
        Carga = new();
        Pessoas.Pessoas.Aniquilar(m, this);
        m.Sujar(vencedor);
        Encerrar(m);
    }
}
