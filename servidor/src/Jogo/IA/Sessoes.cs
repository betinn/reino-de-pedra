using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.IA;

/// <summary>
/// Sessões da IA: cada reino de IA (ou em regência) tem um único evento agendado, na próxima hora de sessão da sua conduta
/// (hora local do fuso <c>P.ia.fusoH</c>, com variação sorteada de até <c>P.ia.variacaoMin</c>). Nada varre o mundo:
/// a sessão decide, age pelos mesmos serviços da API e agenda a seguinte.
/// </summary>
public static class Sessoes
{
    /// <summary>Conduta do reino agora: a da regência, ou habilidade × perfil do reino de IA. Null: ninguém governa.</summary>
    public static Conduta? De(Mundo m, Reino r)
    {
        if (!r.Ativo) return null;
        if (r.EmRegencia) return new Conduta(m.P.IA.Regencia, null, true);
        if (!r.EhIA) return null;
        var hab = m.P.IA.Habilidades.GetValueOrDefault(r.HabilidadeIA ?? "") ?? m.P.IA.Habilidades.Values.First();
        var perfil = m.P.IA.Perfis.GetValueOrDefault(r.PerfilIA ?? "") ?? m.P.IA.Perfis.Values.First();
        return new Conduta(hab, perfil, false);
    }

    /// <summary>Hora local (0 a 23,99) de um instante.</summary>
    public static double HoraLocal(Mundo m, long t)
    {
        var h = (t / (double)T.Hora + m.P.IA.FusoH) % 24;
        return h < 0 ? h + 24 : h;
    }

    /// <summary>Próxima hora de sessão depois de <paramref name="depois"/> (sem variação).</summary>
    public static long Proxima(Mundo m, CondutaIAP c, long depois)
    {
        if (c.Sessoes.Length == 0) return depois + T.Dia;
        var horas = c.Sessoes;
        var hl = HoraLocal(m, depois);
        var inicioDia = depois - (long)Math.Round(hl * T.Hora);   // meia-noite local do dia de "depois"
        for (var dia = 0; dia < 3; dia++)
            foreach (var h in horas.OrderBy(x => x))
            {
                var t = inicioDia + dia * T.Dia + h * T.Hora;
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
        var baseT = Proxima(m, c.C, m.Agora + (long)variacao);
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

/// <summary>Conduta de uma sessão: regras da habilidade (ou da regência) e o perfil do reino de IA (null na regência).</summary>
public sealed record Conduta(CondutaIAP C, PerfilIAP? Perfil, bool Regencia)
{
    public double Militar => C.Militar * (Perfil?.Militar ?? 1);
    public double FracTropas => C.FracTropas;
    public double Locais => Perfil?.Locais ?? 0;
}

/// <summary>Sessão de um reino de IA (ou em regência): decide, age e agenda a próxima.</summary>
public sealed class SessaoIAEvento : Evento
{
    public long ReinoId { get; set; }
    public override void Executar(Mundo m)
    {
        var r = m.Reinos.Obter(ReinoId);
        if (r == null || !r.Ativo || r.SessaoIAEventoId != Id) return;
        r.SessaoIAEventoId = null;
        var c = Sessoes.De(m, r);
        if (c == null) { m.Sujar(r); return; }
        if (m.IA.Ativa) Governo.Sessao(m, r, c);
        Sessoes.Agendar(m, r);
    }
}
