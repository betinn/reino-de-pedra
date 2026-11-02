using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.Marchas;

/// <summary>
/// Carregadores da requisição automática: vão a pé, sem escolta, levando material de um local até uma obra.
/// Visíveis no mapa e roubáveis no caminho. Não ocupam o teto (são abstração do trabalho da população).
/// </summary>
public sealed class Carregadores : Marcha
{
    public override string Tipo => "carregadores";
    public int Pessoas { get; set; }
    /// <summary>Item de fila que recebe o material; null se a obra foi cancelada.</summary>
    public long? ItemId { get; set; }
    public string Fila { get; set; } = "";
    /// <summary>Local onde a carga fica se a obra não existir mais.</summary>
    public long? DestinoLocalId { get; set; }

    public override int PopOcupada(Mundo m) => 0;

    public override void Chegou(Mundo m)
    {
        var r = m.Reinos.Obter(ReinoId);
        Encerrar(m);
        if (r == null) return;
        if (ItemId is long item && r.Fila(Fila).Itens.Any(i => i.Id == item))
        {
            Filas.MaterialChegou(m, r, Fila, item, Carga);
            return;
        }
        var destino = (DestinoLocalId is long id ? m.Locais.Obter(id) : null);
        if (destino == null || destino.ReinoId != ReinoId) destino = m.Locais.Obter(r.CasteloId);
        if (destino != null)
        {
            Economia.Atualizar(m, r);
            destino.Estoque.Somar(Carga);
            m.Sujar(destino);
            m.Avisar(ReinoId, "reino");
        }
    }
}
