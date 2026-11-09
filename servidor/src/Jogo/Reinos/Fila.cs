using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Social;
using PS = ReinoDePedra.Jogo.Pessoas.Pessoas;

namespace ReinoDePedra.Jogo.Reinos;

/// <summary>Fila de até 10 itens executados um por vez (obras, recrutamento, ferraria...).</summary>
public sealed class Fila
{
    public const int Maximo = 10;
    public List<ItemFila> Itens { get; set; } = new();
}

/// <summary>
/// Estado do item quanto ao material. Só anda para a frente: <see cref="Aguardando"/> → <see cref="Reservado"/>, uma vez, no
/// mesmo ponto em que o recurso sai do estoque (<see cref="Filas.Avaliar"/>).
/// </summary>
public enum EstadoItem
{
    /// <summary>Entrou na fila e não gastou nada: nem material, nem pessoas.</summary>
    Aguardando,
    /// <summary>O material já saiu dos estoques (a caminho ou entregue) e as pessoas do item já saíram da população civil.</summary>
    Reservado,
}

/// <summary>
/// Item de fila. O efeito ao terminar é dado pelo <see cref="ITipoItemFila"/> de mesmo <see cref="Tipo"/>. Enfileirar não gasta
/// nada: ao chegar a vez, o item reserva o material (requisição) e só começa quando todo ele chegou.
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
    /// <summary>Unidades já entregues de um item por unidade (tropas, exploradores, mensageiros, veículos).</summary>
    public int Prontos { get; set; }
    /// <summary>Evento da próxima unidade pronta (itens por unidade com mais de uma unidade).</summary>
    public long? EventoUnidadeId { get; set; }
    /// <summary>
    /// O valor inicial é <see cref="EstadoItem.Reservado"/> de propósito: item salvo antes desta regra não tem o campo e já pagou
    /// o material na hora de enfileirar. Item novo passa por <see cref="Filas.Enfileirar"/>, que o põe em Aguardando.
    /// </summary>
    public EstadoItem Estado { get; set; } = EstadoItem.Reservado;
    /// <summary>Pessoas que saem da população civil na reserva (recrutamento, exploradores, mensageiros); 0 nos outros.</summary>
    public int PopReserva { get; set; }

    public bool Aguardando => Estado == EstadoItem.Aguardando;
    public bool MaterialCompleto => Entregue.Cobre(Custo);
    public bool Iniciado => Inicio != null;
    /// <summary>Unidades que ainda não ficaram prontas.</summary>
    public int Restantes => Math.Max(0, Qtd - Prontos);
    /// <summary>Quando fica pronta a unidade de número <paramref name="n"/> (1 = a primeira); a última, em <see cref="Fim"/>. Null se não começou.</summary>
    public long? FimDaUnidade(int n) => Fim is long f ? f - T.DeSegundos(DuracaoSeg * Math.Max(0, Qtd - n) / Math.Max(1, Qtd)) : null;
}

/// <summary>Comportamento de um tipo de item de fila. Implementações são achadas por reflexão (construtor sem parâmetros).</summary>
public interface ITipoItemFila
{
    string Tipo { get; }
    /// <summary>Aplica o efeito do item terminado.</summary>
    void Concluir(Mundo m, Reino r, ItemFila item);
    /// <summary>Desfaz o que o item reservou além do material (ex.: população do recrutamento). Chamado ao cancelar.</summary>
    void Cancelado(Mundo m, Reino r, ItemFila item) { }
    /// <summary>
    /// Revê um item que aguarda: motivo para desistir dele, porque deixou de fazer sentido (o lugar foi ocupado, a torre caiu...),
    /// ou null. Pode ajustar o item ao que ainda existe (a cura encolhe quando feridos morrem). O local perdido já é visto antes.
    /// </summary>
    string? Revisar(Mundo m, Reino r, ItemFila item) => null;
    /// <summary>Toma o que o item usa além do material (pessoas). Chamado uma única vez, na passagem para Reservado.</summary>
    void AoReservar(Mundo m, Reino r, ItemFila item) { }
}

/// <summary>
/// Tipo de item em que cada unidade fica pronta ao fim do seu próprio tempo (a 1ª em DuracaoSeg/Qtd, a 2ª no dobro...)
/// e já pode ser usada antes das seguintes. O item continua único na fila. <see cref="ITipoItemFila.Concluir"/> é
/// chamado depois que a última unidade foi entregue (só avisa); cancelar devolve material e população só das que faltam.
/// </summary>
public interface ITipoItemPorUnidade : ITipoItemFila
{
    /// <summary>Entrega <paramref name="n"/> unidades prontas (entram na guarnição, ficam livres no castelo...).</summary>
    void Entregar(Mundo m, Reino r, ItemFila item, int n);
}

/// <summary>O que segura um item da vez: os recursos que faltam nesta avaliação e, se houver, o impedimento além do material.</summary>
public sealed record SituacaoItem(Recursos Faltam, string? Impedimento);

public static class Filas
{
    /// <summary>Limites da espera até reavaliar um reino com item parado (a previsão pela produção fica entre eles).</summary>
    public const int ReavaliarMinSeg = 5, ReavaliarMaxSeg = 60;

    private static Dictionary<string, ITipoItemFila>? _tipos;
    private static Dictionary<string, ITipoItemFila> TiposRegistrados =>
        _tipos ??= RegistroTipos.Implementacoes<ITipoItemFila>().ToDictionary(t => t.Tipo);

    /// <summary>
    /// Põe o item na fila sem gastar nada; o material sai quando chegar a vez dele e houver o bastante (<see cref="Avaliar"/>).
    /// Lança <see cref="RegraException"/> se a fila estiver cheia ou, nas decisões da IA (<see cref="Mundo.ExigirRecursos"/>), se o
    /// reino não puder pagar.
    /// </summary>
    public static ItemFila Enfileirar(Mundo m, Reino r, string nomeFila, ItemFila item)
    {
        var fila = r.Fila(nomeFila);
        if (fila.Itens.Count >= Fila.Maximo) throw new RegraException("A fila já tem " + Fila.Maximo + " itens.");
        if (!TiposRegistrados.ContainsKey(item.Tipo)) throw new InvalidOperationException("tipo de item sem implementação: " + item.Tipo);
        Economia.Atualizar(m, r);
        if (m.ExigirRecursos)
        {
            var livre = LivreParaNovos(m, r);
            var falta = item.Custo.Where(kv => livre.Qtd(kv.Key) + 1e-6 < kv.Value)
                .Select(kv => $"{Math.Ceiling(kv.Value - livre.Qtd(kv.Key))} {Logistica.NomeRecurso(kv.Key)}").ToList();
            if (falta.Count > 0) throw new RegraException("Faltam recursos: " + string.Join(", ", falta) + ".");
        }
        item.Id = m.NovoId();
        item.CriadoEm = m.Agora;
        item.Estado = EstadoItem.Aguardando;
        item.Entregue = new();
        fila.Itens.Add(item);
        m.Sujar(r);
        Avaliar(m, r);
        m.Avisar(r.Id, "reino");
        return item;
    }

    // ---------------------------------------------------------------- avaliação

    /// <summary>
    /// Passa os itens da vez para Reservado quando dá. Percorre o primeiro item de cada fila do reino em ordem de entrada: quem cabe
    /// no disponível reserva; quem não cabe abate o que pede do disponível só nesta conta, sem gastar nada, para os mais novos não
    /// passarem à frente nos recursos que ele disputa. A reserva roda na thread do motor, numa passagem só: troca o estado e tira o
    /// material no mesmo passo, e os documentos sujos vão juntos para a mesma transação. Reavaliar não tem efeito duplo: quem já está
    /// Reservado não pede de novo (só o que comprovadamente falta, ver <see cref="Logistica.Faltando"/>).
    /// </summary>
    public static void Avaliar(Mundo m, Reino r)
    {
        if (!r.Ativo || !TemPendencia(r)) return;
        Economia.Atualizar(m, r);
        Revisar(m, r);
        var disp = Disponivel(m, r);
        var mudou = false;
        var espera = -1.0;
        foreach (var (nome, it) in DaVez(r))
        {
            var pede = Pedido(m, it);
            if (pede == null) continue;
            if (disp.Cobre(pede) && (!it.Aguardando || Impedimento(m, r, it) == null))
            {
                if (it.Aguardando) Reservar(m, r, nome, it);
                else Logistica.Requisitar(m, r, it, nome, pede);
                mudou = true;
            }
            else espera = Math.Max(espera, EsperaSeg(m, r, pede, disp));
            foreach (var (k, v) in pede) disp.Retirar(k, v);
        }
        foreach (var nome in r.Filas.Keys.ToList()) mudou |= TentarIniciar(m, r, nome);
        if (espera >= 0) Agendar(m, r, m.Agora + T.DeSegundos(espera));
        if (mudou) { m.Sujar(r); m.Avisar(r.Id, "reino"); }
    }

    /// <summary>A passagem única: o estado muda antes de tudo e nada neste caminho volta a Aguardando.</summary>
    private static void Reservar(Mundo m, Reino r, string nomeFila, ItemFila it)
    {
        it.Estado = EstadoItem.Reservado;
        m.Sujar(r);
        if (TiposRegistrados.TryGetValue(it.Tipo, out var tipo)) tipo.AoReservar(m, r, it);
        Logistica.Requisitar(m, r, it, nomeFila);
    }

    /// <summary>Tira da fila o que aguarda e deixou de fazer sentido (nada foi gasto); e o que foi reservado, ficou sem local e nunca vai completar.</summary>
    private static void Revisar(Mundo m, Reino r)
    {
        foreach (var (nome, fila) in r.Filas.ToList())
            foreach (var it in fila.Itens.ToList())
            {
                var motivo = it.Aguardando ? MotivoDesistir(m, r, it)
                    : !it.Iniciado && !it.MaterialCompleto && LocalPerdido(m, r, it) && Logistica.Faltando(m, it).Count > 0 ? "o local não é mais seu." : null;
                if (motivo == null) continue;
                var gasto = !it.Aguardando;
                Retirar(m, r, fila, it);
                m.Sujar(r);
                Registros.Notificar(m, r.Id, nome == Recrutamento.Fila ? "tropas" : "obras", "Item cancelado",
                    it.Rotulo + ": " + motivo + (gasto ? " O material voltou ao castelo." : " Nada foi gasto."), "reino");
            }
    }

    private static string? MotivoDesistir(Mundo m, Reino r, ItemFila it) =>
        LocalPerdido(m, r, it) ? "o local não é mais seu." : TiposRegistrados.GetValueOrDefault(it.Tipo)?.Revisar(m, r, it);

    private static bool LocalPerdido(Mundo m, Reino r, ItemFila it) =>
        it.LocalId is long id && !(m.Locais.Obter(id) is { } l && l.ReinoId == r.Id && !l.Ruina);

    /// <summary>Tem item que ainda não começou: a avaliação pode ter o que fazer.</summary>
    private static bool TemPendencia(Reino r) => r.Filas.Values.Any(f => f.Itens.Any(i => !i.Iniciado));

    /// <summary>O primeiro item de cada fila, do mais antigo ao mais novo (o id só cresce: é a ordem de entrada).</summary>
    private static List<(string nome, ItemFila item)> DaVez(Reino r) =>
        r.Filas.Where(kv => kv.Value.Itens.Count > 0).Select(kv => (kv.Key, kv.Value.Itens[0])).OrderBy(x => x.Item2.Id).ToList();

    /// <summary>O que o item da vez ainda precisa tirar dos estoques; null se não precisa de nada.</summary>
    private static Recursos? Pedido(Mundo m, ItemFila it)
    {
        if (it.Aguardando) return it.Custo;
        if (it.Iniciado || it.MaterialCompleto) return null;
        var f = Logistica.Faltando(m, it);
        return f.Count > 0 ? f : null;
    }

    private static string? Impedimento(Mundo m, Reino r, ItemFila it) =>
        it.PopReserva > 0 && PS.LivresParaTreino(m, r) < it.PopReserva ? "Falta população civil livre: precisa de " + it.PopReserva + "." : null;

    /// <summary>Quanto esperar por um item parado, pela produção atual do que falta (o que chega de outro jeito é visto no limite máximo).</summary>
    private static double EsperaSeg(Mundo m, Reino r, Recursos pede, Recursos disp)
    {
        var taxa = Economia.TaxaTotal(m, r);
        var pior = 0.0;
        foreach (var (k, v) in pede)
        {
            var falta = v - disp.Qtd(k);
            if (falta <= 0) continue;
            pior = Math.Max(pior, taxa.Qtd(k) > 0 ? falta / taxa.Qtd(k) * 3600 : double.MaxValue);
        }
        return Math.Clamp(pior, ReavaliarMinSeg, ReavaliarMaxSeg);
    }

    /// <summary>Recursos que a requisição alcança: os estoques dos locais do reino, fora de ruína.</summary>
    public static Recursos Disponivel(Mundo m, Reino r)
    {
        var t = new Recursos();
        foreach (var l in m.LocaisDe(r.Id)) if (!l.Ruina) t.Somar(l.Estoque);
        return t;
    }

    /// <summary>O disponível menos o que todos os itens aguardando (de qualquer fila, da vez ou não) vão pedir.</summary>
    public static Recursos LivreParaNovos(Mundo m, Reino r)
    {
        var t = Disponivel(m, r);
        foreach (var f in r.Filas.Values)
            foreach (var i in f.Itens.Where(i => i.Aguardando))
                foreach (var (k, v) in i.Custo) t.Retirar(k, v);
        return t;
    }

    /// <summary>Pessoas que os itens aguardando vão tirar da população civil quando chegar a vez deles.</summary>
    public static int PopAguardando(Reino r) => r.Filas.Values.Sum(f => f.Itens.Where(i => i.Aguardando).Sum(i => i.PopReserva));

    /// <summary>
    /// Por item da vez parado: o que falta nesta avaliação. Só lê (a mesma conta de <see cref="Avaliar"/>, sem reservar): serve à tela
    /// do item e à de atenção. Um item pode faltar recurso que o reino tem, porque um item mais antigo tem direito a ele.
    /// </summary>
    public static Dictionary<long, SituacaoItem> Situacoes(Mundo m, Reino r)
    {
        var res = new Dictionary<long, SituacaoItem>();
        var disp = Disponivel(m, r);
        foreach (var (_, it) in DaVez(r))
        {
            var pede = Pedido(m, it);
            if (pede == null) continue;
            var faltam = new Recursos();
            foreach (var (k, v) in pede) if (v - disp.Qtd(k) > 1e-6) faltam[k] = v - disp.Qtd(k);
            var imp = it.Aguardando ? Impedimento(m, r, it) : null;
            if (faltam.Count > 0 || imp != null) res[it.Id] = new SituacaoItem(faltam, imp);
            foreach (var (k, v) in pede) disp.Retirar(k, v);
        }
        return res;
    }

    /// <summary>Pede uma avaliação agora, depois do comando ou do evento em curso (sair de uma queda, de um cancelamento em lote...).</summary>
    public static void Acordar(Mundo m, Reino r)
    {
        if (r.Ativo && TemPendencia(r)) Agendar(m, r, m.Agora);
    }

    /// <summary>Um evento por reino: se já há um para antes, ele serve.</summary>
    private static void Agendar(Mundo m, Reino r, long quando)
    {
        if (r.FilasEventoId is long id && m.Eventos.Obter(id) is { } ev && ev.Quando <= quando) return;
        m.Cancelar(r.FilasEventoId);
        r.FilasEventoId = m.Agendar(new AvaliarFilasEvento { ReinoId = r.Id, Quando = quando }).Id;
        m.Sujar(r);
    }

    // ---------------------------------------------------------------- andamento

    /// <summary>Começa o primeiro item da fila se ele já reservou o material e todo ele chegou. Devolve se começou.</summary>
    public static bool TentarIniciar(Mundo m, Reino r, string nomeFila)
    {
        var fila = r.FilaSe(nomeFila);
        if (fila == null || fila.Itens.Count == 0) return false;
        var it = fila.Itens[0];
        if (it.Iniciado || it.Aguardando || !it.MaterialCompleto) return false;
        it.Inicio = m.Agora;
        it.Fim = m.Agora + T.DeSegundos(it.DuracaoSeg);
        var ev = m.Agendar(new FimItemFilaEvento { ReinoId = r.Id, Fila = nomeFila, ItemId = it.Id, Quando = it.Fim.Value });
        it.EventoId = ev.Id;
        AgendarUnidade(m, r, nomeFila, it);
        m.Sujar(r);
        return true;
    }

    /// <summary>Agenda a próxima unidade pronta de um item por unidade; a última sai com o fim do item.</summary>
    private static void AgendarUnidade(Mundo m, Reino r, string nomeFila, ItemFila it)
    {
        it.EventoUnidadeId = null;
        if (!it.Iniciado || TiposRegistrados.GetValueOrDefault(it.Tipo) is not ITipoItemPorUnidade) return;
        var n = it.Prontos + 1;
        if (n >= it.Qtd) return;
        var quando = it.FimDaUnidade(n)!.Value;
        it.EventoUnidadeId = m.Agendar(new UnidadeProntaEvento { ReinoId = r.Id, Fila = nomeFila, ItemId = it.Id, Quando = Math.Max(m.Agora, quando) }).Id;
    }

    /// <summary>Uma unidade do item ficou pronta antes do fim: entra em uso na hora.</summary>
    public static void UnidadePronta(Mundo m, Reino r, string nomeFila, long itemId)
    {
        var it = r.FilaSe(nomeFila)?.Itens.FirstOrDefault(i => i.Id == itemId);
        if (it == null || it.Restantes <= 1 || TiposRegistrados.GetValueOrDefault(it.Tipo) is not ITipoItemPorUnidade tipo) return;
        Economia.Atualizar(m, r);
        it.Prontos++;
        tipo.Entregar(m, r, it, 1);
        AgendarUnidade(m, r, nomeFila, it);
        m.Sujar(r);
        m.Avisar(r.Id, "reino");
    }

    /// <summary>Material entregue por carregadores ou caravana a um item da fila.</summary>
    public static void MaterialChegou(Mundo m, Reino r, string nomeFila, long itemId, Recursos carga)
    {
        var it = r.FilaSe(nomeFila)?.Itens.FirstOrDefault(i => i.Id == itemId);
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
        var fila = r.FilaSe(nomeFila);
        var it = fila?.Itens.FirstOrDefault(i => i.Id == itemId);
        if (fila == null || it == null) return;
        fila.Itens.Remove(it);
        m.Cancelar(it.EventoUnidadeId);
        Economia.Atualizar(m, r);
        if (TiposRegistrados[it.Tipo] is ITipoItemPorUnidade pu && it.Restantes > 0)
        {
            var n = it.Restantes;
            it.Prontos = it.Qtd;
            pu.Entregar(m, r, it, n);
        }
        TiposRegistrados[it.Tipo].Concluir(m, r, it);
        m.Sujar(r);
        Avaliar(m, r);   // chegou a vez do próximo: confere o material dele
        m.Avisar(r.Id, "reino");
        AoConcluir?.Invoke(m, r, it);
    }
    public static event Action<Mundo, Reino, ItemFila>? AoConcluir;

    /// <summary>
    /// O material já entregue a um item vai para <paramref name="local"/>, se ele ainda é do reino (e não está em ruínas), ou
    /// para o castelo: nunca para o estoque de quem tomou o local. Devolve onde ficou (null se o reino não tem castelo).
    /// </summary>
    public static Local? DevolverMaterial(Mundo m, Reino r, ItemFila it, Local? local)
    {
        static bool Proprio(Local? l, Reino r) => l != null && l.ReinoId == r.Id && !l.Ruina;
        var destino = Proprio(local, r) ? local : m.Locais.Obter(r.CasteloId) is var c && Proprio(c, r) ? c : null;
        if (destino != null && it.Entregue.Count > 0) { destino.Estoque.Somar(it.Entregue); m.Sujar(destino); }
        return destino;
    }

    /// <summary>
    /// Cancela um item. Aguardando, não gastou nada e nada volta. Reservado, o material já entregue fica no local da obra (ou no
    /// castelo, se era um hexágono livre ou se o local não é mais do reino); o que ainda está a caminho chega e fica lá também.
    /// Sem o item na fila (cancelado de novo), recusa sem devolver nada. O próximo da fila é avaliado logo depois do comando.
    /// </summary>
    public static void Cancelar(Mundo m, Reino r, string nomeFila, long itemId)
    {
        var fila = r.FilaSe(nomeFila);
        var it = fila?.Itens.FirstOrDefault(i => i.Id == itemId) ?? throw new RegraException("Item não está na fila.", 404);
        Economia.Atualizar(m, r);
        Retirar(m, r, fila, it);
        m.Sujar(r);
        TentarIniciar(m, r, nomeFila);
        Acordar(m, r);
        m.Avisar(r.Id, "reino");
    }

    /// <summary>Tira o item da fila: cancela os eventos dele e devolve só o que ele tinha reservado.</summary>
    private static void Retirar(Mundo m, Reino r, Fila fila, ItemFila it)
    {
        fila.Itens.Remove(it);
        m.Cancelar(it.EventoId);
        m.Cancelar(it.EventoUnidadeId);
        if (TiposRegistrados.TryGetValue(it.Tipo, out var tipo)) tipo.Cancelado(m, r, it);
        if (it.Aguardando) return;
        // item por unidade: o material das unidades já prontas foi usado; só o resto volta
        if (tipo is ITipoItemPorUnidade && it.Prontos > 0 && it.Qtd > 0)
            foreach (var (k, v) in it.Custo) it.Entregue.Retirar(k, v * it.Prontos / it.Qtd);
        var destino = DevolverMaterial(m, r, it, it.LocalId is long lid ? m.Locais.Obter(lid) : null);
        foreach (var mc in m.Marchas.Where(x => x is Carregadores c && c.ItemId == it.Id).Cast<Carregadores>())
        {
            mc.ItemId = null; mc.DestinoLocalId = destino?.Id;
            m.Sujar(mc);
        }
    }
}

/// <summary>Reavalia as filas de um reino com item parado (o único evento dele: <see cref="Reino.FilasEventoId"/>). Grava com o reino e sobrevive a reinícios.</summary>
public sealed class AvaliarFilasEvento : Evento
{
    public long ReinoId { get; set; }
    public override void Executar(Mundo m)
    {
        var r = m.Reinos.Obter(ReinoId);
        if (r == null || r.FilasEventoId != Id) return;
        r.FilasEventoId = null;
        m.Sujar(r);
        Filas.Avaliar(m, r);
    }
}

/// <summary>Uma unidade de um item por unidade ficou pronta (a última sai com <see cref="FimItemFilaEvento"/>).</summary>
public sealed class UnidadeProntaEvento : Evento
{
    public long ReinoId { get; set; }
    public string Fila { get; set; } = "";
    public long ItemId { get; set; }
    public override void Executar(Mundo m)
    {
        var r = m.Reinos.Obter(ReinoId);
        if (r == null || !r.Ativo) return;
        Filas.UnidadePronta(m, r, Fila, ItemId);
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
