using System.Text.Json.Serialization;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using PS = ReinoDePedra.Jogo.Pessoas.Pessoas;

namespace ReinoDePedra.Jogo.Marchas;

/// <summary>
/// Carregadores da requisição automática: pessoas do local de origem (sem trabalho primeiro, depois trabalhadores, que
/// deixam a vaga vazia enquanto carregam) vão a pé, sem escolta, levando material até uma obra. Cada pessoa leva
/// <c>P.carregador.carga</c>; o que não cabe fica em <see cref="Pendente"/> e o grupo faz mais viagens. Depois da última
/// entrega voltam para casa. Visíveis no mapa e roubáveis no caminho (a carga se perde, as pessoas fogem para casa).
/// Sem ninguém livre na origem, a carga ainda viaja, com carregadores anônimos que somem na entrega.
/// </summary>
public sealed class Carregadores : Marcha
{
    public override string Tipo => "carregadores";
    /// <summary>Quantas pessoas carregam (anônimas quando <see cref="PessoaIds"/> está vazio).</summary>
    public int Pessoas { get; set; }
    /// <summary>Item de fila que recebe o material; null se a obra foi cancelada.</summary>
    public long? ItemId { get; set; }
    public string Fila { get; set; } = "";
    /// <summary>Local onde a carga fica se a obra não existir mais.</summary>
    public long? DestinoLocalId { get; set; }
    /// <summary>Local de onde saíram (para onde voltam).</summary>
    public long? OrigemLocalId { get; set; }
    public int OrigemHex { get; set; }
    /// <summary>Hexágono da obra.</summary>
    public int ParaHex { get; set; }
    /// <summary>Material já reservado na origem que ainda não coube numa viagem.</summary>
    public Recursos Pendente { get; set; } = new();

    public override int PopOcupada(Mundo m) => 0;
    public double CargaMax(Mundo m) => Pessoas * m.P.Carregador.Carga;

    /// <summary>Roubados no caminho: a carga vai ao vencedor e a obra pede de novo o que se perdeu; o grupo foge para casa.</summary>
    public override void AoSerVencida(Mundo m, Exercito vencedor)
    {
        var perdido = Carga.Copia();
        var item = ItemId; var fila = Fila;
        foreach (var f in AoPerderNoCaminho) f(m, this, vencedor);
        var livre = Math.Max(0, vencedor.CargaMax(m) - vencedor.Carga.Total);
        var total = Carga.Total;
        if (total > 0 && livre > 0)
        {
            var f = Math.Min(1, livre / total);
            foreach (var (k, v) in Carga.ToList()) vencedor.Carga.Somar(k, v * f);
        }
        vencedor.Reliquias.AddRange(Reliquias);
        Reliquias = new(); Carga = new();
        m.Sujar(vencedor);
        var r = m.Reinos.Obter(ReinoId);
        // o que ainda estava reservado na origem volta ao estoque dela e é pedido de novo junto com o perdido
        if (Pendente.Count > 0)
        {
            var origem = OrigemLocalId is long oid ? m.Locais.Obter(oid) : null;
            if (origem != null && origem.ReinoId == ReinoId && !origem.Ruina) { origem.Estoque.Somar(Pendente); m.Sujar(origem); }
            perdido.Somar(Pendente); Pendente = new();
        }
        if (PessoaIds.Count == 0) Encerrar(m);
        else VoltarParaCasa(m);
        if (r != null && item is long id) Logistica.Repor(m, r, fila, id, perdido);
    }

    public override void Chegou(Mundo m)
    {
        var r = m.Reinos.Obter(ReinoId);
        if (r == null) { Encerrar(m); return; }
        if (Retornando) { ChegouEmCasa(m, r); return; }
        if (ItemId is long item && r.FilaSe(Fila)?.Itens.Any(i => i.Id == item) == true)
            Filas.MaterialChegou(m, r, Fila, item, Carga);
        else
        {
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
        Carga = new();
        if (PessoaIds.Count == 0) { Encerrar(m); return; }   // carregadores anônimos somem na entrega
        VoltarParaCasa(m);
    }

    /// <summary>De volta à origem: carrega a próxima viagem, se ficou material, ou solta as pessoas.</summary>
    private void ChegouEmCasa(Mundo m, Reino r)
    {
        if (Pendente.Total > 1e-9)
        {
            Carga = Dividir(Pendente, CargaMax(m));
            foreach (var (k, v) in Carga) Pendente.Retirar(k, v);
            if (Pendente.Total <= 1e-9) Pendente = new();
            Retornando = false;
            Partir(m, Caminhos.Calcular(m, OrigemHex, ParaHex, Vel, new OpcoesCaminho { ReinoId = ReinoId }));
            return;
        }
        var onde = m.LocalNoHex(OrigemHex);
        foreach (var id in PessoaIds.ToList())
            if (m.Pessoas.Obter(id) is { } p && p.GrupoId == Id) PS.Soltar(m, p, onde);
        PessoaIds.Clear();
        Encerrar(m);
        m.Avisar(ReinoId, "reino");
    }

    private void VoltarParaCasa(Mundo m)
    {
        Retornando = true;
        Partir(m, Caminhos.Calcular(m, HexEm(m.Agora), OrigemHex, Vel, new OpcoesCaminho { ReinoId = ReinoId }));
    }

    /// <summary>A parte de <paramref name="carga"/> que cabe em <paramref name="cap"/>, na mesma proporção entre os recursos.</summary>
    public static Recursos Dividir(Recursos carga, double cap)
    {
        var total = carga.Total;
        if (total <= cap + 1e-9) return carga.Copia();
        var f = cap / total;
        var r = new Recursos();
        foreach (var (k, v) in carga) r.Somar(k, v * f);
        return r;
    }
}
