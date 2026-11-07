using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Nucleo;

namespace ReinoDePedra.Jogo.Reinos;

/// <summary>
/// Produção e população calculadas sob demanda a partir do tempo: <c>estoque += taxa × tempo decorrido</c>.
/// Chame <see cref="Atualizar"/> antes de ler ou mexer em estoques e população de um reino.
/// Um evento por reino a cada hora (<see cref="CheckpointReinoEvento"/>) mantém a população e a eficiência
/// em dia mesmo sem ninguém olhar (o erro da aproximação fica limitado a 1 h).
/// </summary>
public static class Economia
{
    public const string Obras = "obras";

    /// <summary>Teto de população: castelo + moradias.</summary>
    public static int Teto(Mundo m, Reino r) =>
        m.P.TetoCastelo + m.LocaisDe(r.Id).Sum(l => l.Moradias) * m.P.TetoPorMoradia + TetoExtra(m, r);

    /// <summary>Ganchos de teto extra (nenhum hoje). Sistemas podem somar aqui.</summary>
    public static Func<Mundo, Reino, int> TetoExtra { get; set; } = (_, _) => 0;

    public static int Moradias(Mundo m, Reino r) => m.LocaisDe(r.Id).Sum(l => l.Moradias);

    /// <summary>Tropas e pessoas fora da população civil que ocupam o teto (guarnições, marchas, feridos...).</summary>
    public static int Tropas(Mundo m, Reino r)
    {
        var n = m.LocaisDe(r.Id).Sum(l => PopDeGrupo(m, l.Guarnicao));
        foreach (var mc in m.Marchas) if (mc.ReinoId == r.Id) n += mc.PopOcupada(m);
        foreach (var f in OcupantesExtras) n += f(m, r);
        return n;
    }
    /// <summary>Sistemas que mantêm pessoas fora dos locais e marchas (feridos, prisioneiros...) somam aqui.</summary>
    public static List<Func<Mundo, Reino, int>> OcupantesExtras { get; } = new();

    public static int PopDeGrupo(Mundo m, IReadOnlyDictionary<string, int> g) =>
        g.Sum(kv => kv.Value * (m.B.U.TryGetValue(kv.Key, out var u) ? u.Pop : 1));

    /// <summary>Vagas de trabalho do reino inteiro (soma dos locais de produção).</summary>
    public static int TrabalhadoresNecessarios(Mundo m, Reino r) =>
        m.LocaisDe(r.Id).Sum(l => Pessoas.Pessoas.Vagas(m, l));

    /// <summary>Pessoas produzindo agora, no reino inteiro.</summary>
    public static int Trabalhando(Mundo m, Reino r) => m.LocaisDe(r.Id).Sum(l => Pessoas.Pessoas.Trabalhando(m, l));

    /// <summary>Eficiência do reino (vagas ocupadas / vagas), só para mostrar: a produção usa a de cada local.</summary>
    public static double Eficiencia(Mundo m, Reino r)
    {
        var nec = TrabalhadoresNecessarios(m, r);
        return nec == 0 ? 1 : Math.Min(1, Trabalhando(m, r) / (double)nec);
    }

    /// <summary>Eficiência do local: vagas ocupadas por quem está produzindo / vagas (1 para locais sem vagas).</summary>
    public static double EficienciaLocal(Mundo m, Local l)
    {
        var vagas = Pessoas.Pessoas.Vagas(m, l);
        return vagas == 0 ? 1 : Math.Min(1, Pessoas.Pessoas.Trabalhando(m, l) / (double)vagas);
    }

    /// <summary>Taxa por hora de cada recurso produzido pelo local (já com a eficiência do local e os modificadores).</summary>
    public static Recursos TaxaLocal(Mundo m, Reino r, Local l)
    {
        var t = new Recursos();
        if (l.Ruina) return t;
        if (l.Tipo == TipoLocal.Castelo)
        {
            foreach (var k in Formulas.Basicos) t[k] = m.F.ProducaoCastelo(l.Nivel);
        }
        else if (l.Produz != null)
        {
            t[l.Produz] = m.F.ProducaoDe(l.Produz, l.Nivel) * EficienciaLocal(m, l);
        }
        var mult = 1.0;
        foreach (var f in ModificadoresProducao) mult *= f(m, l);
        if (mult != 1) foreach (var k in t.Keys.ToList()) t[k] *= mult;
        return t;
    }
    /// <summary>Multiplicadores de produção por local (relíquia de produção, legado...).</summary>
    public static List<Func<Mundo, Local, double>> ModificadoresProducao { get; } = new();

    /// <summary>Quanto o local guarda da própria produção, por recurso.</summary>
    public static double Capacidade(Mundo m, Local l, string recurso)
    {
        if (l.Tipo == TipoLocal.Castelo)
            return Math.Max(m.P.EstoqueMinimo, m.F.ProducaoCastelo(l.Nivel) * m.P.EstoqueHoras);
        if (l.Tipo == TipoLocal.Armazem) return m.F.CapacidadeArmazem(l.Nivel);
        if (l.Produz == recurso)
        {
            var horas = m.P.EstoqueHoras;
            foreach (var f in HorasDeEstoque) horas = Math.Max(horas, f(m, l));
            return m.F.ProducaoDe(recurso, l.Nivel) * horas;
        }
        return 0;
    }
    /// <summary>Ganchos que aumentam as horas de estoque (salgadeira: 20 h no local de comida).</summary>
    public static List<Func<Mundo, Local, double>> HorasDeEstoque { get; } = new();

    /// <summary>Locais que recebem o excedente: armazéns e, por fim, o castelo.</summary>
    private static IEnumerable<Local> Depositos(Mundo m, Reino r) =>
        m.LocaisDe(r.Id).Where(l => !l.Ruina && l.Tipo == TipoLocal.Armazem).OrderByDescending(l => l.Nivel)
            .Concat(m.LocaisDe(r.Id).Where(l => !l.Ruina && l.Tipo == TipoLocal.Castelo));

    /// <summary>Leva produção e população do reino até <c>m.Agora</c>.</summary>
    public static void Atualizar(Mundo m, Reino r)
    {
        var agora = m.Agora;
        if (r.AtualizadoEm == 0) { r.AtualizadoEm = agora; return; }
        var dtMs = agora - r.AtualizadoEm;
        if (dtMs <= 0) return;
        var dtH = dtMs / (double)T.Hora;
        var locais = m.LocaisDe(r.Id).ToList();
        var excedente = new Recursos();
        double comidaH = 0;
        foreach (var l in locais)
        {
            var taxa = TaxaLocal(m, r, l);
            foreach (var (k, v) in taxa)
            {
                if (k == "comida") comidaH += v;
                var cap = Capacidade(m, l, k);
                var tem = l.Estoque.Qtd(k);
                var novo = tem + v * dtH;
                if (novo > cap) { excedente.Somar(k, novo - Math.Max(cap, tem)); novo = Math.Max(cap, tem); }
                l.Estoque[k] = novo;
            }
            if (taxa.Count > 0) m.Sujar(l);
        }
        // excedente vai para o armazém (e depois o castelo), até a capacidade deles
        if (excedente.Count > 0)
            foreach (var d in Depositos(m, r))
            {
                foreach (var k in excedente.Keys.ToList())
                {
                    var livre = Capacidade(m, d, k) - d.Estoque.Qtd(k);
                    if (d.Tipo == TipoLocal.Castelo) livre = Math.Max(livre, 0);
                    if (livre <= 0) continue;
                    var mover = Math.Min(livre, excedente[k]);
                    d.Estoque.Somar(k, mover); excedente.Somar(k, -mover);
                }
                m.Sujar(d);
                if (excedente.Count == 0) break;
            }
        // população: logística, fechada no intervalo; teto livre = teto − tropas. A parte fracionária fica guardada
        // (PopFracao) e cada vez que fecha 1 nasce uma pessoa com nome, que vai para a vaga mais necessária.
        var (livreTeto, taxaPop, _) = Crescimento(m, r, comidaH);
        var atual = r.Pop + r.PopFracao;
        var depois = Logistica(atual, livreTeto, taxaPop, dtH, m.P.PopSemente);
        r.AtualizadoEm = agora;
        m.Sujar(r);
        if (depois > atual)
        {
            var nascem = (int)Math.Floor(depois + 1e-9) - (int)Math.Floor(r.Pop + 1e-9);
            r.PopFracao = Math.Max(0, depois - Math.Floor(depois + 1e-9));
            if (nascem > 0) Pessoas.Pessoas.Nascer(m, r, nascem);
        }
    }

    /// <summary>
    /// Parâmetros do crescimento da população: teto livre (teto − tropas), taxa por hora (com o bônus de comida de sobra e
    /// os modificadores) e se há comida de sobra (produção de comida acima do dobro da do castelo).
    /// </summary>
    public static (double livreTeto, double taxa, bool sobra) Crescimento(Mundo m, Reino r, double? comidaH = null)
    {
        var comida = comidaH ?? m.LocaisDe(r.Id).Sum(l => TaxaLocal(m, r, l).Qtd("comida"));
        var castelo = m.Locais.Obter(r.CasteloId);
        var sobra = castelo != null && comida > m.F.ProducaoCastelo(castelo.Nivel) * 2;
        var livreTeto = Math.Max(1, Teto(m, r) - Tropas(m, r));
        var taxa = m.P.CrescPop * (sobra ? 1 + m.P.BonusComida : 1);
        foreach (var f in ModificadoresCrescimento) taxa *= f(m, r);
        return (livreTeto, taxa, sobra);
    }

    /// <summary>
    /// Ritmo atual da população, para mostrar: pessoas por hora (o que cresce na próxima hora), quando nasce a próxima
    /// pessoa (instante, ou null se não cresce) e se há comida de sobra.
    /// </summary>
    public static (double porHora, long? proxima, bool sobra) RitmoPopulacao(Mundo m, Reino r)
    {
        var (livre, taxa, sobra) = Crescimento(m, r);
        var atual = r.Pop + r.PopFracao;
        double Em(double h) => Logistica(atual, livre, taxa, h, m.P.PopSemente);
        var porHora = Math.Max(0, Em(1) - atual);
        var alvo = Math.Floor(r.Pop + 1e-9) + 1;
        if (porHora <= 1e-9 || Em(10000) < alvo - 1e-9) return (porHora, null, sobra);
        double lo = 0, hi = 1;
        while (Em(hi) < alvo && hi < 10000) hi *= 2;
        for (var i = 0; i < 50; i++) { var mid = (lo + hi) / 2; if (Em(mid) >= alvo) hi = mid; else lo = mid; }
        return (porHora, r.AtualizadoEm + (long)Math.Ceiling(hi * T.Hora), sobra);
    }

    /// <summary>Multiplicadores da taxa de crescimento da população do reino (legado: relíquia de crescimento).</summary>
    public static List<Func<Mundo, Reino, double>> ModificadoresCrescimento { get; } = new();

    /// <summary>
    /// Solução fechada de dP/dt = k·P·(1 − P/K). Abaixo de <paramref name="semente"/> (P.popSemente) a população cresce em
    /// linha, k × semente pessoas por hora, até chegar à semente (ou ao teto livre) e daí segue a logística: com a população
    /// civil em 0 (todos recrutados) o reino volta a crescer.
    /// </summary>
    public static double Logistica(double p0, double K, double k, double dtH, double semente = 0)
    {
        if (p0 >= K) return K;   // população acima do teto livre não cresce (e não some sozinha)
        if (p0 < semente && k > 0 && dtH > 0)
        {
            var alvo = Math.Min(semente, K);
            var porHora = k * semente;
            var t = (alvo - Math.Max(0, p0)) / porHora;
            if (t >= dtH) return Math.Max(0, p0) + porHora * dtH;
            p0 = alvo; dtH -= t;
            if (p0 >= K) return K;
        }
        if (p0 <= 0) return 0;
        var e = Math.Exp(-k * dtH);
        return K / (1 + (K - p0) / p0 * e);
    }

    /// <summary>Recursos guardados no reino inteiro (após <see cref="Atualizar"/>).</summary>
    public static Recursos TotalGuardado(Mundo m, Reino r)
    {
        var t = new Recursos();
        foreach (var l in m.LocaisDe(r.Id)) t.Somar(l.Estoque);
        return t;
    }

    /// <summary>Taxa total por hora do reino, por recurso.</summary>
    public static Recursos TaxaTotal(Mundo m, Reino r)
    {
        var t = new Recursos();
        foreach (var l in m.LocaisDe(r.Id)) t.Somar(TaxaLocal(m, r, l));
        return t;
    }

    /// <summary>Garante o evento de checkpoint horário do reino.</summary>
    public static void GarantirCheckpoint(Mundo m, Reino r)
    {
        if (m.Eventos.Any(e => e is CheckpointReinoEvento c && c.ReinoId == r.Id)) return;
        m.Agendar(new CheckpointReinoEvento { ReinoId = r.Id, Quando = m.Agora + T.Hora });
    }
}

/// <summary>Checkpoint horário: atualiza produção e população do reino e se reagenda.</summary>
public sealed class CheckpointReinoEvento : Evento
{
    public long ReinoId { get; set; }
    public override void Executar(Mundo m)
    {
        var r = m.Reinos.Obter(ReinoId);
        if (r == null || !r.Ativo) return;
        Economia.Atualizar(m, r);
        foreach (var f in AoCheckpoint) f(m, r);
        m.Agendar(new CheckpointReinoEvento { ReinoId = ReinoId, Quando = m.Agora + T.Hora });
    }
    /// <summary>Sistemas que querem rodar de hora em hora por reino (IA, regência...).</summary>
    public static List<Action<Mundo, Reino>> AoCheckpoint { get; } = new();
}
