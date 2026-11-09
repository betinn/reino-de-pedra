using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Forja;

/// <summary>
/// Bônus de combate da ferraria. Armas e armaduras valem para as tropas da própria família: o bônus do grupo é a soma
/// dos bônus de cada família ponderada pela parte dela na força do grupo (ataque × tropas para quem ataca, defesa ×
/// tropas para quem defende). Assim, no valor da fórmula, cada família recebe exatamente o próprio bônus.
/// Na defesa de um local entram também a milícia (família da unidade milícia: infantaria) e os arqueiros no alto das
/// torres (família do arqueiro). O combate soma com os outros bônus e aplica o teto.
/// </summary>
public static class BonusFerraria
{
    /// <summary>Soma ponderada: Σ força da família × nível × P.ferraria.bonusNivel / força total.</summary>
    public static double Ponderado(Mundo m, Reino r, IEnumerable<(string fam, double forca)> partes, string linha)
    {
        double tot = 0, b = 0;
        foreach (var (fam, f) in partes)
        {
            if (f <= 0) continue;
            tot += f;
            b += f * Ferrarias.Nivel(r, fam, linha) * m.P.Ferraria.BonusNivel;
        }
        return tot > 0 ? b / tot : 0;
    }

    private static IEnumerable<(string, double)> Partes(Mundo m, IReadOnlyDictionary<string, int> g, bool ataque) =>
        g.Where(kv => kv.Value > 0 && m.B.U.ContainsKey(kv.Key))
            .Select(kv => (m.B.U[kv.Key].Fam, kv.Value * (ataque ? m.B.U[kv.Key].Atk : m.B.U[kv.Key].Def)));

    /// <summary>Armas do exército que ataca.</summary>
    public static double Armas(Mundo m, Exercito ex) =>
        m.Reinos.Obter(ex.ReinoId) is { } r ? Ponderado(m, r, Partes(m, ex.Tropas, true), Ferrarias.Armas) : 0;

    /// <summary>Armaduras do exército em campo (interceptado ou atacado fora de um local).</summary>
    public static double ArmadurasExercito(Mundo m, Exercito ex) =>
        m.Reinos.Obter(ex.ReinoId) is { } r ? Ponderado(m, r, Partes(m, ex.Tropas, false), Ferrarias.Armaduras) : 0;

    /// <summary>Partes da defesa de um local: guarnição, milícia e arqueiros no alto (forças como na fórmula, sem vantagem).</summary>
    public static List<(string fam, double forca)> PartesDefesaLocal(Mundo m, Reino r, Local l)
    {
        var p = Partes(m, l.Guarnicao, false).ToList();
        var mil = m.B.U["milicia"]; var arq = m.B.U["arqueiro"];
        p.Add((mil.Fam, Combates.PopDoLocal(m, r, l) * m.P.MiliciaPorPop * m.P.DefMilicia));
        p.Add((arq.Fam, Defesas.ArqueirosNoAlto(m, l) * arq.Def * m.P.Torre.BonusAlto));
        return p;
    }

    /// <summary>Armaduras de quem defende o local.</summary>
    public static double ArmadurasLocal(Mundo m, Local l)
    {
        if (l.Ruina || l.ReinoId == 0 || m.Reinos.Obter(l.ReinoId) is not { } r) return 0;
        return Ponderado(m, r, PartesDefesaLocal(m, r, l), Ferrarias.Armaduras);
    }
}

/// <summary>
/// Onde está cada equipamento lendário, o bônus que dá e para onde vai: com o próximo exército que sai do local (se
/// marcado), para a guarnição do local onde o exército entra, para o vencedor de uma batalha ou de uma interceptação.
/// </summary>
public static class Lendarios
{
    public static IEnumerable<EquipamentoLendario> Do(Mundo m, long reinoId) => m.Lendarios.Where(e => e.DonoId == reinoId);
    public static IEnumerable<EquipamentoLendario> NoLocal(Mundo m, Local l) => m.Lendarios.Where(e => e.LocalId == l.Id);
    public static IEnumerable<EquipamentoLendario> NaMarcha(Mundo m, long marchaId) => m.Lendarios.Where(e => e.MarchaId == marchaId);

    /// <summary>Fração do bônus que vale para um grupo com essa quantidade de tropas (1 até P.lendario.tropas; acima, dilui).</summary>
    public static double Fator(Mundo m, double tropas) => tropas <= m.P.Lendario.Tropas ? 1 : m.P.Lendario.Tropas / tropas;

    /// <summary>Bônus de um tipo para um grupo: no máximo um equipamento de cada tipo conta.</summary>
    public static double Bonus(Mundo m, IEnumerable<EquipamentoLendario> eqs, string tipo, double tropas) =>
        eqs.Any(e => e.Tipo == tipo) ? m.P.Lendario.Bonus * Fator(m, tropas) : 0;

    public static double Ataque(Mundo m, Exercito ex) => Bonus(m, NaMarcha(m, ex.Id), Ferrarias.Ataque, GT.Total(ex.Tropas));
    public static double DefesaExercito(Mundo m, Exercito ex) => Bonus(m, NaMarcha(m, ex.Id), Ferrarias.Defesa, GT.Total(ex.Tropas));

    /// <summary>Quem defende o local com o equipamento: guarnição, milícia e arqueiros no alto (todos contam para diluir).</summary>
    public static double Defensores(Mundo m, Local l) =>
        GT.Total(l.Guarnicao) + (m.Reinos.Obter(l.ReinoId) is { } r ? Math.Floor(Combates.PopDoLocal(m, r, l) * m.P.MiliciaPorPop) : 0) + Defesas.ArqueirosNoAlto(m, l);

    public static double DefesaLocal(Mundo m, Local l)
    {
        if (l.Ruina || l.ReinoId == 0) return 0;
        var eqs = NoLocal(m, l).Where(e => e.DonoId == l.ReinoId).ToList();
        return eqs.Count == 0 ? 0 : Bonus(m, eqs, Ferrarias.Defesa, Defensores(m, l));
    }

    /// <summary>Marca (ou desmarca) para ir com o próximo exército que sair do local onde está.</summary>
    public static void MarcarLevar(Mundo m, Reino r, long id, bool levar)
    {
        Conferir(m);
        var eq = m.Lendarios.Obter(id);
        if (eq == null || eq.DonoId != r.Id) throw new RegraException("Equipamento não encontrado.", 404);
        if (eq.LocalId == null) throw new RegraException("O equipamento está com um exército em campo: ele fica com as tropas até entrarem num local.");
        eq.Levar = levar;
        m.Sujar(eq);
        m.Avisar(r.Id, "reino");
    }

    // ---------------------------------------------------------------- ganchos

    /// <summary>Exército saindo do local onde está o equipamento marcado para ir junto: passa a levá-lo.</summary>
    internal static void AoPartir(Mundo m, Marcha mc)
    {
        if (mc is not Exercito ex || ex.Retornando || ex.Caminho.Count == 0 || ex.Partida != m.Agora) return;
        var l = m.Locais.Obter(ex.OrigemLocalId);
        if (l == null || l.Hex != ex.Caminho[0] || l.ReinoId != ex.ReinoId) return;
        foreach (var eq in NoLocal(m, l).Where(e => e.Levar && e.DonoId == ex.ReinoId).Take(1).ToList())
        {
            eq.LocalId = null; eq.MarchaId = ex.Id; eq.Levar = false;
            m.Sujar(eq);
            if (Batalhas.Ativa(m, l.Id) is { } b && b.DefensorId == ex.ReinoId) Batalhas.RecalcularLocal(m, l.Id, eq.Nome + " deixou o local.", "defesa");
        }
    }

    /// <summary>Exército entrou num local: o equipamento que ele leva fica na guarnição.</summary>
    internal static void AoEntrarNoLocal(Mundo m, Exercito ex, Local l)
    {
        var mudou = false;
        foreach (var eq in NaMarcha(m, ex.Id).ToList())
        {
            eq.MarchaId = null; eq.LocalId = l.Id; eq.DonoId = l.ReinoId; eq.Levar = false;
            m.Sujar(eq); mudou = true;
        }
        if (mudou && Batalhas.Ativa(m, l.Id) is { } b && b.DefensorId == l.ReinoId) Batalhas.RecalcularLocal(m, l.Id, "O equipamento lendário chegou ao local.", "defesa");
    }

    /// <summary>
    /// Batalha encerrada: o lado que perdeu (inclusive recuando) deixa o equipamento no campo e o vencedor leva. Na vitória do
    /// atacante, vai com o primeiro exército vivo dele (ou fica no local, se ele ocupou o local); na da defesa, fica na guarnição.
    /// </summary>
    internal static void AoTerminar(Mundo m, ResultadoCombate rc)
    {
        var b = m.Batalhas.Obter(rc.BatalhaId);
        var l = m.Locais.Obter(rc.LocalId);
        if (b == null) return;
        if (rc.AtacanteVenceu)
        {
            if (l == null) return;
            var perdidos = NoLocal(m, l).Where(e => e.DonoId == rc.DefensorId).ToList();
            if (perdidos.Count == 0) return;
            var vencedor = b.Exercitos.Select(id => m.Marchas.Obter(id) as Exercito).FirstOrDefault(e => e != null && GT.Total(e.Tropas) > 0);
            foreach (var eq in perdidos)
            {
                eq.DonoId = rc.AtacanteId; eq.Levar = false;
                if (l.ReinoId != rc.AtacanteId && vencedor != null) { eq.LocalId = null; eq.MarchaId = vencedor.Id; }
                m.Sujar(eq);
                Avisar(m, rc.DefensorId, eq, "Equipamento lendário perdido", eq.Nome + " ficou no campo em " + l.Nome + " e o vencedor levou.");
                Avisar(m, rc.AtacanteId, eq, "Equipamento lendário capturado", eq.Nome + " (+" + Math.Round(m.P.Lendario.Bonus * 100) + "% de " + eq.Tipo + ") ficou no campo e suas tropas levaram.");
            }
        }
        else
        {
            var perdidos = b.Exercitos.SelectMany(id => m.Lendarios.Where(e => e.MarchaId == id)).ToList();
            if (perdidos.Count == 0) return;
            var dono = l != null && l.ReinoId == rc.DefensorId && !l.Ruina;
            foreach (var eq in perdidos)
            {
                eq.MarchaId = null; eq.Levar = false;
                if (dono) { eq.DonoId = rc.DefensorId; eq.LocalId = l!.Id; }
                else { eq.DonoId = 0; eq.LocalId = l?.Id; }
                m.Sujar(eq);
                Avisar(m, rc.AtacanteId, eq, "Equipamento lendário perdido", eq.Nome + " ficou no campo depois da derrota.");
                if (dono) Avisar(m, rc.DefensorId, eq, "Equipamento lendário capturado", eq.Nome + " (+" + Math.Round(m.P.Lendario.Bonus * 100) + "% de " + eq.Tipo + ") ficou no campo e agora está em " + l!.Nome + ".");
            }
        }
        Conferir(m);
    }

    /// <summary>
    /// Marcha vencida no caminho: o equipamento vai com o vencedor. Um vencedor que não está no mapa (a saída provisória de
    /// uma guarnição em postura) volta ao local de onde saiu, e o equipamento fica na guarnição dele.
    /// </summary>
    internal static void AoPerderNoCaminho(Mundo m, Marcha perdedor, Exercito vencedor)
    {
        var guarnicao = m.Marchas.ContemId(vencedor.Id) ? null : m.Locais.Obter(vencedor.OrigemLocalId) is { } o && o.ReinoId == vencedor.ReinoId && !o.Ruina ? o : null;
        foreach (var eq in NaMarcha(m, perdedor.Id).ToList())
        {
            var antigo = eq.DonoId;
            eq.DonoId = vencedor.ReinoId; eq.Levar = false;
            if (guarnicao != null) { eq.MarchaId = null; eq.LocalId = guarnicao.Id; }
            else eq.MarchaId = vencedor.Id;
            m.Sujar(eq);
            Avisar(m, antigo, eq, "Equipamento lendário perdido", eq.Nome + " ficou no campo e o vencedor levou.");
            Avisar(m, vencedor.ReinoId, eq, "Equipamento lendário capturado", eq.Nome + " (+" + Math.Round(m.P.Lendario.Bonus * 100) + "% de " + eq.Tipo + ") " + (guarnicao != null ? "agora está em " + guarnicao.Nome + "." : "agora vai com suas tropas."));
        }
    }

    /// <summary>
    /// Arruma o que mudou por fora dos ganchos: equipamento num local que trocou de dono passa ao novo dono (ou fica sem dono na
    /// ruína); o de um exército que sumiu do mapa sem batalha (fauna) ou de um local que deixou de existir volta à guarnição do
    /// castelo do dono (só se perde quando não há castelo).
    /// </summary>
    public static void Conferir(Mundo m)
    {
        foreach (var eq in m.Lendarios.ToList())
        {
            if (eq.MarchaId is long mid)
            {
                if (m.Marchas.Obter(mid) is Exercito ex) { if (ex.ReinoId != eq.DonoId) { eq.DonoId = ex.ReinoId; m.Sujar(eq); } continue; }
                Recolher(m, eq); continue;
            }
            var l = eq.LocalId is long lid ? m.Locais.Obter(lid) : null;
            if (l == null) { Recolher(m, eq); continue; }
            var novo = l.Ruina ? 0 : l.ReinoId;
            if (novo == eq.DonoId) continue;
            var antigo = eq.DonoId;
            eq.DonoId = novo; eq.Levar = false; m.Sujar(eq);
            if (antigo != 0) Avisar(m, antigo, eq, "Equipamento lendário perdido", eq.Nome + " ficou em " + l.Nome + ", que não é mais seu.");
            if (novo != 0) Avisar(m, novo, eq, "Equipamento lendário encontrado", eq.Nome + " (+" + Math.Round(m.P.Lendario.Bonus * 100) + "% de " + eq.Tipo + ") estava em " + l.Nome + ".");
        }
    }

    /// <summary>O grupo que levava o equipamento sumiu sem batalha: ele volta à guarnição do castelo do dono.</summary>
    private static void Recolher(Mundo m, EquipamentoLendario eq)
    {
        var dono = eq.DonoId != 0 ? m.Reinos.Obter(eq.DonoId) : null;
        var castelo = dono is { Ativo: true } ? m.Locais.Obter(dono.CasteloId) : null;
        if (castelo == null || castelo.ReinoId != dono!.Id || castelo.Ruina) { Perder(m, eq); return; }
        eq.MarchaId = null; eq.LocalId = castelo.Id; eq.Levar = false;
        m.Sujar(eq);
        Avisar(m, dono.Id, eq, "Equipamento lendário de volta", eq.Nome + " voltou à guarnição de " + castelo.Nome + ": as tropas que o levavam não existem mais.");
    }

    private static void Perder(Mundo m, EquipamentoLendario eq)
    {
        m.Lendarios.Remover(eq);
        if (eq.DonoId != 0) Avisar(m, eq.DonoId, eq, "Equipamento lendário perdido", eq.Nome + " se perdeu no campo.");
    }

    private static void Avisar(Mundo m, long reinoId, EquipamentoLendario eq, string titulo, string texto)
    {
        if (reinoId == 0 || m.Reinos.Obter(reinoId) == null) return;
        Registros.Notificar(m, reinoId, "batalhas", titulo, texto, "ferraria");
        m.Avisar(reinoId, "reino");
    }

    /// <summary>Espionagem de um local: o equipamento na guarnição aparece no relatório (nome e tipo, sem a origem).</summary>
}

/// <summary>Registra os ganchos da ferraria, das eras e do equipamento lendário na subida do servidor.</summary>
[Sistema]
public static class SistemaFerraria
{
    public const string ChaveSistema = "ferraria";

    public static void AoIniciar(Mundo m) => Sistemas.UmaVez("ferraria", () =>
    {
        Sistemas.Revelavel(ChaveSistema, "Ferraria e eras", "Eras, armas e armaduras por família e o equipamento lendário.");
        // eras liberam unidades (U.req) e os portões dos níveis acima de P.combate.portao.nivelSemEra
        Recrutamento.ReqCumprido.Add((mm, r, req) => mm.P.Eras.Any(kv => kv.Value.Nome == req && Ferrarias.EraFeita(r, kv.Key)));
        Bonus.Ataque.Add(BonusFerraria.Armas);
        Bonus.Ataque.Add(Lendarios.Ataque);
        Bonus.Defesa.Add(BonusFerraria.ArmadurasLocal);
        Bonus.Defesa.Add(Lendarios.DefesaLocal);
        Bonus.DefesaExercito.Add(BonusFerraria.ArmadurasExercito);
        Bonus.DefesaExercito.Add(Lendarios.DefesaExercito);
        Marcha.AoPartir.Add(Lendarios.AoPartir);
        Marcha.AoPerderNoCaminho.Add(Lendarios.AoPerderNoCaminho);
        Exercitos.AoEntrarNoLocal += Lendarios.AoEntrarNoLocal;
        Combates.AoTerminar.Add(Lendarios.AoTerminar);
        CheckpointReinoEvento.AoCheckpoint.Add((mm, r) => Lendarios.Conferir(mm));
        // a ferraria aparece quando o reino tem a primeira
        ObraFundar.AoFundar += (mm, r, l) => { if (l.Tipo == TipoLocal.Ferraria) Revelar(mm, r); };
        Sistemas.Gatilhos.Add(ConferirGatilho);
    });

    /// <summary>Apresenta a ferraria ao reino (gatilho: ter a primeira ferraria).</summary>
    public static void Revelar(Mundo m, Reino r) => Sistemas.Revelar(m, r, ChaveSistema, "ferraria");

    /// <summary>Confere o gatilho (uma ferraria que veio por ocupação também conta).</summary>
    public static void ConferirGatilho(Mundo m, Reino r)
    {
        if (!Sistemas.Visto(r, ChaveSistema) && Ferrarias.Principal(m, r) != null) Revelar(m, r);
    }
}
