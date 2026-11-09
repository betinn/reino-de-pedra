using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Social;
using PS = ReinoDePedra.Jogo.Pessoas.Pessoas;

namespace ReinoDePedra.Jogo.Reinos;

/// <summary>
/// Recrutamento: fila "recrutamento" do reino (até 10 itens, um por vez). Ao chegar a vez do item, o material vem pela
/// requisição automática até o local e a população civil sai (volta se cancelar): até lá as pessoas seguem trabalhando. As
/// tropas em treino ocupam o teto. Cada unidade fica pronta ao fim do seu próprio tempo e entra na guarnição na hora
/// (<see cref="ITipoItemPorUnidade"/>). O castelo recruta as unidades de <c>P.recrutaCastelo</c>; o quartel, todas.
/// </summary>
[Sistema]
public static class Recrutamento
{
    public const string Fila = "recrutamento";

    /// <summary>
    /// Bloqueios extras por unidade (ex.: nível do quartel): devolvem o motivo, ou null se não bloqueiam.
    /// </summary>
    public static List<Func<Mundo, Reino, Unidade, string?>> Requisitos { get; } = new();

    /// <summary>
    /// Quem cumpre um requisito escrito em <c>U.req</c> (ex.: "Era do Aço"): o sistema de eras registra aqui.
    /// Sem ninguém que o cumpra, a unidade fica bloqueada com o texto do requisito.
    /// </summary>
    public static List<Func<Mundo, Reino, string, bool>> ReqCumprido { get; } = new();

    public static void AoIniciar(Mundo m) => Sistemas.UmaVez("recrutamento", () =>
    {
        Economia.OcupantesExtras.Add(EmTreino);
    });

    /// <summary>Pessoas em treino (já saíram da população civil e ocupam o teto); o item que aguarda ainda não tirou ninguém.</summary>
    public static int EmTreino(Mundo m, Reino r) =>
        r.Filas.TryGetValue(Fila, out var f)
            ? f.Itens.Where(i => !i.Aguardando && i.Tipo == ItemRecrutar.Id && i.Param != null && m.B.U.ContainsKey(i.Param)).Sum(i => m.B.U[i.Param!].Pop * i.Restantes)
            : 0;

    /// <summary>Itens de recrutamento na fila (sem criar a fila se não existir).</summary>
    public static IEnumerable<ItemFila> Itens(Reino r) =>
        r.Filas.TryGetValue(Fila, out var f) ? f.Itens.Where(i => i.Tipo == ItemRecrutar.Id) : [];

    /// <summary>O local recruta alguma unidade? (castelo e quartel do próprio reino, fora de ruína)</summary>
    public static bool Recruta(Local l) => !l.Ruina && l.Tipo is TipoLocal.Castelo or TipoLocal.Quartel;

    /// <summary>A unidade pode ser treinada neste tipo de local (sem olhar requisitos)?</summary>
    public static bool RecrutaNoLocal(Mundo m, Local l, string unidade) =>
        Recruta(l) && (l.Tipo == TipoLocal.Quartel || m.P.RecrutaCastelo.Contains(unidade));

    /// <summary>Motivo que bloqueia a unidade para o reino (requisito não cumprido), ou null.</summary>
    public static string? Bloqueio(Mundo m, Reino r, Unidade u)
    {
        if (!string.IsNullOrEmpty(u.Req) && !ReqCumprido.Any(f => f(m, r, u.Req!))) return u.Req;
        foreach (var f in Requisitos) { var mo = f(m, r, u); if (mo != null) return mo; }
        return null;
    }

    /// <summary>Motivo para não recrutar a unidade neste local, ou null se pode.</summary>
    public static string? Motivo(Mundo m, Reino r, Local l, string unidade)
    {
        if (!m.B.U.TryGetValue(unidade, out var u)) return "Unidade desconhecida.";
        if (l.ReinoId != r.Id) return "Local não é seu.";
        if (l.Ruina) return "O local está em ruínas.";
        if (!Recruta(l)) return "Só o castelo e o quartel recrutam.";
        if (!RecrutaNoLocal(m, l, unidade)) return "Esta unidade só é treinada no quartel.";
        return Bloqueio(m, r, u);
    }

    public static ItemFila Recrutar(Mundo m, Reino r, long localId, string unidade, int qtd)
    {
        var l = m.Locais.Obter(localId);
        if (l == null || l.ReinoId != r.Id) throw new RegraException("Local não é seu.", 404);
        var motivo = Motivo(m, r, l, unidade);
        if (motivo != null) throw new RegraException(motivo);
        if (qtd < 1) throw new RegraException("Escolha pelo menos 1 unidade.");
        var u = m.B.U[unidade];
        Economia.Atualizar(m, r);
        var pop = u.Pop * (long)qtd;
        var livre = PS.LivresParaTreino(m, r) - Filas.PopAguardando(r);   // os itens que aguardam já contam com os deles
        if (livre < pop) throw new RegraException($"Falta população civil livre: precisa de {pop}, há {Math.Max(0, livre)}.");
        var custo = new Recursos();
        custo.Somar(u.Custo, qtd);
        return Filas.Enfileirar(m, r, Fila, new ItemFila
        {
            Tipo = ItemRecrutar.Id, LocalId = l.Id, Hex = l.Hex, Param = u.Id, Qtd = qtd,
            Rotulo = $"{qtd} {Tropas.Nome(u, qtd)} · {l.Nome}",
            Custo = custo, DuracaoSeg = u.Tempo * qtd, PopReserva = (int)pop,
        });
    }
}

/// <summary>
/// Item da fila de recrutamento: Param = unidade, Qtd = quantidade. Cada unidade entra na guarnição ao ficar pronta;
/// o aviso de concluído sai com a última.
/// </summary>
public sealed class ItemRecrutar : ITipoItemPorUnidade
{
    public const string Id = "recrutar";
    public string Tipo => Id;

    public void Entregar(Mundo m, Reino r, ItemFila item, int n)
    {
        if (n <= 0 || item.Param == null || !m.B.U.TryGetValue(item.Param, out var u)) return;
        var l = item.LocalId is long id ? m.Locais.Obter(id) : null;
        if (l == null || l.ReinoId != r.Id || l.Ruina) l = m.Locais.Obter(r.CasteloId);
        if (l == null || l.ReinoId != r.Id) l = m.LocaisDe(r.Id).FirstOrDefault(x => !x.Ruina);
        if (l == null) { PS.DevolverDoTreino(m, r, item, u.Pop * n); return; }   // sem onde morar: voltam à população
        PS.TreinoPronto(m, r, item, u.Pop * n, l);   // a pessoa treinada entra na guarnição com o nome dela
    }

    public void Concluir(Mundo m, Reino r, ItemFila item) =>
        Registros.Notificar(m, r.Id, "tropas", "Recrutamento concluído", item.Rotulo, "tropas");

    public void Cancelado(Mundo m, Reino r, ItemFila item) => PS.TreinoCancelado(m, r, item);

    /// <summary>Chegou a vez: ociosos primeiro vão para o treino; cancelar devolve ao ofício anterior.</summary>
    public void AoReservar(Mundo m, Reino r, ItemFila item)
    {
        if (item.Param != null && item.LocalId is long id && m.Locais.Obter(id) is { } l)
            PS.ParaTreino(m, r, item.PopReserva, item.Param, item, l);
    }
}
