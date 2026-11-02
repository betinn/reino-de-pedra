using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;

namespace ReinoDePedra.Jogo.Reinos;

/// <summary>Fila de até 10 itens executados um por vez (obras, recrutamento, ferraria...).</summary>
public sealed class Fila
{
    public const int Maximo = 10;
    public List<ItemFila> Itens { get; set; } = new();
}

/// <summary>
/// Item de fila. O material é pedido na hora (requisição) e o item só começa quando é o primeiro da fila
/// e todo o material chegou. O efeito ao terminar é dado pelo <see cref="ITipoItemFila"/> de mesmo <see cref="Tipo"/>.
/// </summary>
public sealed class ItemFila
{
    public long Id { get; set; }
    public string Tipo { get; set; } = "";
    public string Rotulo { get; set; } = "";
    /// <summary>Local onde acontece (o material vai para lá); null quando é um hexágono livre (fundação, rota).</summary>
    public long? LocalId { get; set; }
    public int Hex { get; set; }
    public int NivelAlvo { get; set; }
    /// <summary>Parâmetro livre do tipo (tipo de local a fundar, unidade a recrutar, linha da ferraria...).</summary>
    public string? Param { get; set; }
    public int Qtd { get; set; } = 1;
    public Recursos Custo { get; set; } = new();
    public Recursos Entregue { get; set; } = new();
    public double DuracaoSeg { get; set; }
    public long CriadoEm { get; set; }
    public long? Inicio { get; set; }
    public long? Fim { get; set; }
    public long? EventoId { get; set; }

    public bool MaterialCompleto => Entregue.Cobre(Custo);
    public bool Iniciado => Inicio != null;
}

/// <summary>Comportamento de um tipo de item de fila. Implementações são achadas por reflexão (construtor sem parâmetros).</summary>
public interface ITipoItemFila
{
    string Tipo { get; }
    /// <summary>Aplica o efeito do item terminado.</summary>
    void Concluir(Mundo m, Reino r, ItemFila item);
}

public static class Filas
{
    private static Dictionary<string, ITipoItemFila>? _tipos;
    private static Dictionary<string, ITipoItemFila> TiposRegistrados =>
        _tipos ??= RegistroTipos.Implementacoes<ITipoItemFila>().ToDictionary(t => t.Tipo);

    /// <summary>
    /// Põe o item na fila e pede o material. Lança <see cref="RegraException"/> se a fila estiver cheia ou faltar recurso.
    /// </summary>
    public static ItemFila Enfileirar(Mundo m, Reino r, string nomeFila, ItemFila item)
    {
        var fila = r.Fila(nomeFila);
        if (fila.Itens.Count >= Fila.Maximo) throw new RegraException("A fila já tem " + Fila.Maximo + " itens.");
        if (!TiposRegistrados.ContainsKey(item.Tipo)) throw new InvalidOperationException("tipo de item sem implementação: " + item.Tipo);
        Economia.Atualizar(m, r);
        item.Id = m.NovoId();
        item.CriadoEm = m.Agora;
        Logistica.Requisitar(m, r, item, nomeFila);
        fila.Itens.Add(item);
        m.Sujar(r);
        TentarIniciar(m, r, nomeFila);
        m.Avisar(r.Id, "reino");
        return item;
    }

    /// <summary>Começa o primeiro item da fila se ele estiver parado e com o material completo.</summary>
    public static void TentarIniciar(Mundo m, Reino r, string nomeFila)
    {
        var fila = r.Fila(nomeFila);
        if (fila.Itens.Count == 0) return;
        var it = fila.Itens[0];
        if (it.Iniciado || !it.MaterialCompleto) return;
        it.Inicio = m.Agora;
        it.Fim = m.Agora + T.DeSegundos(it.DuracaoSeg);
        var ev = m.Agendar(new FimItemFilaEvento { ReinoId = r.Id, Fila = nomeFila, ItemId = it.Id, Quando = it.Fim.Value });
        it.EventoId = ev.Id;
        m.Sujar(r);
    }

    /// <summary>Material entregue por carregadores ou caravana a um item da fila.</summary>
    public static void MaterialChegou(Mundo m, Reino r, string nomeFila, long itemId, Recursos carga)
    {
        var it = r.Fila(nomeFila).Itens.FirstOrDefault(i => i.Id == itemId);
        if (it == null)
        {
            // item cancelado: a carga fica no destino (ou volta ao castelo)
            return;
        }
        it.Entregue.Somar(carga);
        m.Sujar(r);
        TentarIniciar(m, r, nomeFila);
        m.Avisar(r.Id, "reino");
    }

    public static void Concluir(Mundo m, Reino r, string nomeFila, long itemId)
    {
        var fila = r.Fila(nomeFila);
        var it = fila.Itens.FirstOrDefault(i => i.Id == itemId);
        if (it == null) return;
        fila.Itens.Remove(it);
        Economia.Atualizar(m, r);
        TiposRegistrados[it.Tipo].Concluir(m, r, it);
        m.Sujar(r);
        TentarIniciar(m, r, nomeFila);
        m.Avisar(r.Id, "reino");
        AoConcluir?.Invoke(m, r, it);
    }
    public static event Action<Mundo, Reino, ItemFila>? AoConcluir;

    /// <summary>
    /// Cancela um item. O material já entregue fica no local da obra (ou no castelo, se era um hexágono livre);
    /// o que ainda está a caminho chega e fica lá também.
    /// </summary>
    public static void Cancelar(Mundo m, Reino r, string nomeFila, long itemId)
    {
        var fila = r.Fila(nomeFila);
        var it = fila.Itens.FirstOrDefault(i => i.Id == itemId) ?? throw new RegraException("Item não está na fila.", 404);
        Economia.Atualizar(m, r);
        fila.Itens.Remove(it);
        m.Cancelar(it.EventoId);
        var destino = (it.LocalId is long lid ? m.Locais.Obter(lid) : null) ?? m.Locais.Obter(r.CasteloId);
        if (destino != null) { destino.Estoque.Somar(it.Entregue); m.Sujar(destino); }
        foreach (var mc in m.Marchas.Where(x => x is Carregadores c && c.ItemId == it.Id).Cast<Carregadores>())
        {
            mc.ItemId = null; mc.DestinoLocalId = destino?.Id;
            m.Sujar(mc);
        }
        m.Sujar(r);
        TentarIniciar(m, r, nomeFila);
        m.Avisar(r.Id, "reino");
    }
}

public sealed class FimItemFilaEvento : Evento
{
    public long ReinoId { get; set; }
    public string Fila { get; set; } = "";
    public long ItemId { get; set; }
    public override void Executar(Mundo m)
    {
        var r = m.Reinos.Obter(ReinoId);
        if (r == null || !r.Ativo) return;
        Filas.Concluir(m, r, Fila, ItemId);
    }
}
