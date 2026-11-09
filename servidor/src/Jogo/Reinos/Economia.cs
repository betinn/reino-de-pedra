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
    public static double Capacidade(Mundo m, Local l, string recurso) => CapacidadeNoNivel(m, l, recurso, l.Nivel);

    /// <summary>Quanto o local guardaria da própria produção num nível (a dica da melhoria compara dois níveis).</summary>
    public static double CapacidadeNoNivel(Mundo m, Local l, string recurso, int nivel)
    {
        if (l.Tipo == TipoLocal.Castelo)
            return Math.Max(m.P.EstoqueMinimo, m.F.ProducaoCastelo(nivel) * m.P.EstoqueHoras);
        if (l.Tipo == TipoLocal.Armazem) return m.F.CapacidadeArmazem(nivel);
        if (l.Produz == recurso)
        {
            var horas = m.P.EstoqueHoras;
            foreach (var f in HorasDeEstoque) horas = Math.Max(horas, f(m, l));
            return m.F.ProducaoDe(recurso, nivel) * horas;
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
        // população: de popMinH a popMaxH pessoas por hora enquanto há espaço no teto livre (teto − tropas), fechada no
        // intervalo. A parte fracionária fica guardada (PopFracao) e cada vez que fecha 1 nasce uma pessoa com nome, que vai
        // para a vaga mais necessária.
        var (livreTeto, mult, _) = Crescimento(m, r, comidaH);
        var atual = r.Pop + r.PopFracao;
        var depois = Crescer(atual, livreTeto, mult, dtH, m.P.PopMinH, m.P.PopMaxH);
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
    /// Parâmetros do crescimento da população: teto livre (teto − tropas), multiplicador do ritmo (bônus de comida de sobra
    /// e modificadores) e se há comida de sobra (produção de comida acima do dobro da do castelo).
    /// </summary>
    public static (double livreTeto, double mult, bool sobra) Crescimento(Mundo m, Reino r, double? comidaH = null)
    {
        var comida = comidaH ?? m.LocaisDe(r.Id).Sum(l => TaxaLocal(m, r, l).Qtd("comida"));
        var castelo = m.Locais.Obter(r.CasteloId);
        var sobra = castelo != null && comida > m.F.ProducaoCastelo(castelo.Nivel) * 2;
        var livreTeto = Math.Max(1, Teto(m, r) - Tropas(m, r));
        var mult = sobra ? 1 + m.P.BonusComida : 1;
        foreach (var f in ModificadoresCrescimento) mult *= f(m, r);
        return (livreTeto, mult, sobra);
    }

    /// <summary>
    /// Ritmo atual da população, para mostrar: pessoas por hora (o que cresce na próxima hora), quando nasce a próxima
    /// pessoa (instante, ou null se não cresce) e se há comida de sobra.
    /// </summary>
    public static (double porHora, long? proxima, bool sobra) RitmoPopulacao(Mundo m, Reino r)
    {
        var (livre, mult, sobra) = Crescimento(m, r);
        var atual = r.Pop + r.PopFracao;
        double Em(double h) => Crescer(atual, livre, mult, h, m.P.PopMinH, m.P.PopMaxH);
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
    /// População depois de <paramref name="dtH"/> horas, abaixo do teto livre <paramref name="K"/>. O ritmo é
    /// <c>min(max, mult × (min + (max − min) × (K − P)/K))</c> pessoas por hora: mais rápido com mais espaço livre, nunca
    /// abaixo de <paramref name="min"/> (com mult ≥ 1) nem acima de <paramref name="max"/>, e para no teto. Solução fechada:
    /// em linha enquanto o ritmo bate no máximo; daí, com u = K − P, du/dt = −mult·(min + c·u/K), exponencial até u = 0.
    /// </summary>
    public static double Crescer(double p0, double K, double mult, double dtH, double min, double max)
    {
        if (p0 >= K || dtH <= 0 || mult <= 0) return p0;   // no teto (ou acima) não cresce nem some
        var p = Math.Max(0, p0);
        var c = Math.Max(0, max - min);
        // fase em linha, no máximo: enquanto mult·(min + c·u/K) ≥ max, isto é, u ≥ uMax
        var uMax = c > 0 ? K * (max / mult - min) / c : (mult * min >= max ? 0 : double.PositiveInfinity);
        var u = K - p;
        if (u > uMax)
        {
            var t = (u - Math.Max(0, uMax)) / max;
            if (t >= dtH) return Math.Min(K, p + max * dtH);
            dtH -= t; u = Math.Max(0, uMax);
        }
        if (u <= 0) return K;
        if (c <= 0) return Math.Min(K, K - u + mult * min * dtH);   // sem faixa: ritmo constante
        // fase exponencial: u(t) = (u0 + a)·e^(−b·t) − a, com a = min·K/c e b = mult·c/K
        var a = min * K / c; var b = mult * c / K;
        var un = (u + a) * Math.Exp(-b * dtH) - a;
        return un <= 0 ? K : K - un;
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
        Filas.Avaliar(m, r);   // rede de segurança: item da vez sem material e sem evento (carregadores perdidos sem repor) volta a pedir
        foreach (var f in AoCheckpoint) f(m, r);
        m.Agendar(new CheckpointReinoEvento { ReinoId = ReinoId, Quando = m.Agora + T.Hora });
    }
    /// <summary>Sistemas que querem rodar de hora em hora por reino (IA, regência...).</summary>
    public static List<Action<Mundo, Reino>> AoCheckpoint { get; } = new();
}
