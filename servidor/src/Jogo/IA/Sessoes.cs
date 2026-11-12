using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.IA;

/// <summary>
/// Sessões da IA: cada reino de IA tem um único evento agendado, na próxima hora de sessão da sua conduta
/// (hora local do fuso <c>P.ia.fusoH</c>, com variação sorteada de até <c>P.ia.variacaoMin</c>). Nada varre o mundo:
/// a sessão decide, age pelos mesmos serviços da API e agenda a seguinte.
/// <para>A <see cref="Persona"/> de quem governa dá o jeito de gente: as horas se deslocam pelo cronotipo dela, às vezes
/// ela falta a uma sessão, e a sessão acontece em duas partes (o que faz ao entrar e o que faz minutos depois). Entre
/// sessões, se está acordada, pode reagir a um ataque com o atraso de quem vê a notificação (<see cref="ReacaoIAEvento"/>).</para>
/// </summary>
public static class Sessoes
{
    /// <summary>Conduta do reino agora: habilidade × perfil do reino de IA. Null: ninguém governa (reino de jogador).</summary>
    public static Conduta? De(Mundo m, Reino r)
    {
        if (!r.Ativo) return null;
        if (!r.EhIA) return null;
        var hab = m.P.IA.Habilidades.GetValueOrDefault(r.HabilidadeIA ?? "") ?? m.P.IA.Habilidades.Values.First();
        var perfil = m.P.IA.Perfis.GetValueOrDefault(r.PerfilIA ?? "") ?? m.P.IA.Perfis.Values.First();
        return new Conduta(hab, perfil) { Persona = r.Persona };
    }

    /// <summary>Hora local (0 a 23,99) de um instante.</summary>
    public static double HoraLocal(Mundo m, long t)
    {
        var h = (t / (double)T.Hora + m.P.IA.FusoH) % 24;
        return h < 0 ? h + 24 : h;
    }

    /// <summary>Próxima hora de sessão depois de <paramref name="depois"/> (sem variação). <paramref name="desvioH"/>: o cronotipo da persona desloca todas as horas.</summary>
    public static long Proxima(Mundo m, CondutaIAP c, long depois, double desvioH = 0)
    {
        if (c.Sessoes.Length == 0) return depois + T.Dia;
        var horas = c.Sessoes.Select(h => desvioH == 0 ? (double)h : ((h + desvioH) % 24 + 24) % 24).ToArray();
        var hl = HoraLocal(m, depois);
        var inicioDia = depois - (long)Math.Round(hl * T.Hora);   // meia-noite local do dia de "depois"
        for (var dia = 0; dia < 3; dia++)
            foreach (var h in horas.OrderBy(x => x))
            {
                var t = inicioDia + dia * T.Dia + (long)Math.Round(h * T.Hora);
                if (t > depois) return t;
            }
        return depois + T.Dia;
    }

    /// <summary>Agenda (ou reagenda) a próxima sessão do reino, cancelando a anterior.</summary>
    public static void Agendar(Mundo m, Reino r)
    {
        m.Cancelar(r.SessaoIAEventoId);
        r.SessaoIAEventoId = null;
        var c = De(m, r);
        if (c == null || !m.IA.Ativa) { m.Sujar(r); return; }
        var variacao = T.Min * m.P.IA.VariacaoMin;
        // a variação pode adiantar a sessão: a base é calculada a partir de agora + a variação máxima, para nunca repetir a mesma hora
        var baseT = Proxima(m, c.C, m.Agora + (long)variacao, c.Persona?.DesvioHoras ?? 0);
        var quando = baseT + (long)((m.Sorte.Real() * 2 - 1) * variacao);
        var ev = m.Agendar(new SessaoIAEvento { ReinoId = r.Id, Quando = Math.Max(m.Agora + T.Min, quando) });
        r.SessaoIAEventoId = ev.Id;
        m.Sujar(r);
    }

    /// <summary>Esta é a última sessão do dia (a fila de obras cobre a noite)?</summary>
    public static bool UltimaDoDia(Mundo m, CondutaIAP c, long agora)
    {
        if (c.Sessoes.Length == 0) return true;
        var hl = HoraLocal(m, agora);
        var ultima = c.Sessoes.Max();
        // perto (dentro da variação) da última hora, ou depois dela
        return hl >= ultima - m.P.IA.VariacaoMin / 60.0 || hl < c.Sessoes.Min() - m.P.IA.VariacaoMin / 60.0;
    }
}

/// <summary>Conduta de uma sessão: regras da habilidade e o perfil do reino de IA.</summary>
public sealed record Conduta(CondutaIAP C, PerfilIAP? Perfil)
{
    /// <summary>Quem governa (null nos reinos sem persona): desvia a conduta para o lado do temperamento dela.</summary>
    public Persona? Persona { get; init; }
    /// <summary>Parte do estoque que vira tropas: o agressivo gasta mais com exército.</summary>
    public double Militar => C.Militar * (Perfil?.Militar ?? 1) * Personas.Fator(Persona?.Agressividade ?? 0.5, 0.15);
    /// <summary>Parte do teto em tropas: sobe com agressividade e cautela (quem ataca e quem se guarda mantêm mais gente em armas).</summary>
    public double FracTropas => C.FracTropas * Personas.Fator(((Persona?.Agressividade ?? 0.5) + (Persona?.Cautela ?? 0.5)) / 2, 0.10);
    /// <summary>Ritmo de fundar locais: o passivo expande menos.</summary>
    public double Locais => (Perfil?.Locais ?? 0) * Personas.Fator(1 - (Persona?.Passividade ?? 0.5), 0.12);
    /// <summary>Margem pedida nas trocas: o ganancioso pede mais.</summary>
    public double Margem => Personas.Fator(Persona?.Ganancia ?? 0.5, 0.3);
    /// <summary>Folga de força exigida para atacar: o agressivo aceita menos, o cauteloso quer mais.</summary>
    public double FolgaDeAtaque => Personas.Fator(1 - (Persona?.Agressividade ?? 0.5), 0.2) * Personas.Fator(Persona?.Cautela ?? 0.5, 0.2);
    /// <summary>Reserva de tropas em casa (multiplica P.ia.guarda): o cauteloso guarda mais, o agressivo menos.</summary>
    public double Guarda => Personas.Fator(Persona?.Cautela ?? 0.5, 0.25) * Personas.Fator(1 - (Persona?.Agressividade ?? 0.5), 0.25);
    /// <summary>Quanto tempo aguenta um item parado na fila antes de desistir: o paciente espera mais.</summary>
    public double Espera => 0.4 + 1.2 * (Persona?.Paciencia ?? 0.5);
}

/// <summary>
/// Sessão de um reino de IA: decide, age e agenda a próxima. Com persona, a pessoa pode faltar à sessão
/// e, quando vem, joga em duas partes: ao entrar cuida do reino (defesa, propostas, obras, tropas); alguns minutos depois
/// (<see cref="Etapa"/> 1) faz o resto (explorar, caçar, espionar, atacar, conversar). Sem persona, ou com a neutra, é tudo
/// de uma vez, como sempre foi.
/// </summary>
public sealed class SessaoIAEvento : Evento
{
    public long ReinoId { get; set; }
    /// <summary>0: a sessão. 1: a segunda parte da mesma sessão, minutos depois.</summary>
    public int Etapa { get; set; }
    public override void Executar(Mundo m)
    {
        var r = m.Reinos.Obter(ReinoId);
        if (r == null || !r.Ativo) return;
        if (Etapa == 1)
        {
            if (r.SessaoIA2EventoId != Id) return;
            r.SessaoIA2EventoId = null; m.Sujar(r);
            if (m.IA.Ativa && Sessoes.De(m, r) is { } c2) Governo.Sessao(m, r, c2, 1);
            return;
        }
        if (r.SessaoIAEventoId != Id) return;
        r.SessaoIAEventoId = null;
        var c = Sessoes.De(m, r);
        if (c == null) { m.Sujar(r); return; }
        if (m.IA.Ativa && Personas.Aparece(m, r))
        {
            var pausa = Personas.TempoDeReacao(m, r, "etapa", 150);
            if (pausa <= 0) Governo.Sessao(m, r, c);
            else
            {
                Governo.Sessao(m, r, c, 0);
                m.Cancelar(r.SessaoIA2EventoId);
                r.SessaoIA2EventoId = m.Agendar(new SessaoIAEvento { ReinoId = r.Id, Etapa = 1, Quando = m.Agora + pausa }).Id;
            }
        }
        Sessoes.Agendar(m, r);
    }
}

/// <summary>
/// Reação fora da sessão: a pessoa viu a notificação do ataque e entrou só para defender. Acontece com o atraso de quem
/// reage (às vezes segundos, às vezes minutos: pode chegar tarde), e só se ela estava acordada e viu.
/// </summary>
public sealed class ReacaoIAEvento : Evento
{
    public long ReinoId { get; set; }
    public override void Executar(Mundo m)
    {
        var r = m.Reinos.Obter(ReinoId);
        if (r == null || !r.Ativo || r.ReacaoIAEventoId != Id) return;
        r.ReacaoIAEventoId = null; m.Sujar(r);
        if (m.IA.Ativa && Sessoes.De(m, r) is { } c) Governo.Reagir(m, r, c);
    }
}
