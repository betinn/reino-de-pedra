using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Jogo.Valiosos;

/// <summary>
/// Posto de extração (ou de escavação): obra opcional no hexágono de uma jazida descoberta ou de uma ruína antiga.
/// Vira um local do reino (<see cref="TipoLocal.Posto"/>, sem produção): acelera a extração e a escavação
/// (<c>P.extracao.posto</c>), serve de base para as tropas e, enquanto existir, a jazida não pode ser explorada
/// por outro reino. Não conta como local fundado (não encarece o próximo).
/// </summary>
public static class Postos
{
    public static string? Motivo(Mundo m, Reino r, int hex)
    {
        if (!m.G.Valido(hex)) return "Hexágono fora do mapa.";
        var jazida = Extracoes.Conhecida(m, r.Id, hex);
        var ruina = m.Ruinas.FirstOrDefault(x => x.Hex == hex);
        if (jazida == null && (ruina == null || !Nevoas.Explorado(m, r.Id, hex)))
            return "O posto fica numa jazida descoberta ou numa ruína antiga.";
        if (jazida != null && jazida.Restante <= 1e-6) return "A jazida se esgotou.";
        if (ruina != null && jazida == null && ruina.Esgotada) return "A ruína já foi escavada.";
        if (m.LocalNoHex(hex) != null) return "Já há um posto neste hexágono.";
        if (r.Fila(Obras.Fila).Itens.Any(i => i.Tipo == ObraPosto.Id && i.Hex == hex)) return "Já há um posto na fila para este hexágono.";
        return null;
    }

    public static ItemFila Construir(Mundo m, Reino r, int hex)
    {
        var motivo = Motivo(m, r, hex);
        if (motivo != null) throw new RegraException(motivo);
        return Filas.Enfileirar(m, r, Obras.Fila, new ItemFila
        {
            Tipo = ObraPosto.Id, Hex = hex, Rotulo = Nome(m, hex),
            Custo = Recursos.De(m.P.Posto.Custo), DuracaoSeg = m.P.Posto.Tempo,
        });
    }

    public static string Nome(Mundo m, int hex)
    {
        var j = Extracoes.NoHex(m, hex);
        return j != null ? "Posto de extração · " + Logistica.NomeRecurso(j.Recurso) : "Posto de escavação · ruína antiga";
    }
}

public sealed class ObraPosto : ITipoItemFila
{
    public const string Id = "posto";
    public string Tipo => Id;
    public void Concluir(Mundo m, Reino r, ItemFila item)
    {
        if (m.LocalNoHex(item.Hex) != null)
        {
            // alguém chegou antes: o material volta ao castelo
            var c = m.Locais.Obter(r.CasteloId);
            if (c != null) { c.Estoque.Somar(item.Entregue); m.Sujar(c); }
            Registros.Notificar(m, r.Id, "obras", "Posto não construído", "Outro local ocupou o hexágono antes.", "reino");
            return;
        }
        var j = Extracoes.NoHex(m, item.Hex);
        if (j != null) Extracoes.Liquidar(m, j);   // o ritmo muda a partir de agora
        var l = m.AdicionarLocal(new Local
        {
            ReinoId = r.Id, Tipo = TipoLocal.Posto, Hex = item.Hex, Nivel = 1,
            Nome = j != null ? "Posto " + Preposicao(j.Recurso) + Logistica.NomeRecurso(j.Recurso) : "Posto da Ruína",
        });
        Nevoas.RevelarArea(m, r.Id, l.Hex, m.P.Visao.Local);
        if (j != null) Extracoes.Reagendar(m, j);
        foreach (var ex in Exercitos.De(m, r.Id).Where(e => e.EscavaRuinaId != null && e.HexEm(m.Agora) == item.Hex).ToList())
            Escavacoes.Reagendar(m, ex);
        Registros.Notificar(m, r.Id, "obras", "Obra concluída", item.Rotulo, "extracao?hex=" + item.Hex);
    }

    private static string Preposicao(string recurso) => recurso switch
    {
        "prata" => "da ", "ervas" or "gema" => "das ", "cavalo" => "dos ", "sal" or "aco" or "ouro" or "minerio" => "do ", _ => "de ",
    };
}
