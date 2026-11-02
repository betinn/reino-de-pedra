using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Jogo.IA;

/// <summary>
/// Regência (CLAUDE.md): depois de <c>P.regenciaH</c> sem entrar (<see cref="Reino.UltimoAcesso"/>), o reino do jogador passa a
/// ser governado por uma IA conservadora (<c>P.ia.regencia</c>: defende e produz, sem fundar, atacar, espionar ou ocupar), para
/// que abandonar nunca seja vantajoso. Quando o jogador volta, retoma o que restou e vê o relatório (ações e perdas).
/// A verificação é um evento por reino no último acesso + <c>P.regenciaH</c>; ao vencer, se houve acesso depois, só se reagenda.
/// </summary>
public static class Regencia
{
    public static long Limite(Mundo m, Reino r) => r.UltimoAcesso + T.DeHoras(m.P.RegenciaH);

    /// <summary>Garante a verificação agendada de um reino de jogador.</summary>
    public static void Agendar(Mundo m, Reino r)
    {
        if (!m.IA.Ativa || r.EhIA || !r.Ativo || r.EmRegencia) return;
        if (r.RegenciaEventoId is long id && m.Eventos.Obter(id) is VerificarRegenciaEvento) return;
        r.RegenciaEventoId = m.Agendar(new VerificarRegenciaEvento { ReinoId = r.Id, Quando = Limite(m, r) }).Id;
        m.Sujar(r);
    }

    internal static void Verificar(Mundo m, Reino r)
    {
        r.RegenciaEventoId = null;
        if (r.EhIA || !r.Ativo || r.EmRegencia) { m.Sujar(r); return; }
        if (m.Agora < Limite(m, r)) { Agendar(m, r); return; }   // o jogador entrou depois: conta de novo do último acesso
        Comecar(m, r);
    }

    /// <summary>O reino passa à regência: a IA conservadora governa a partir da próxima sessão; a liderança da aliança passa adiante.</summary>
    public static void Comecar(Mundo m, Reino r)
    {
        r.Regencia = new RegistroRegencia { AtivaDesde = m.Agora };
        m.Sujar(r);
        Aliancas.AoEntrarEmRegencia(m, r);
        Sessoes.Agendar(m, r);
        Registros.Notificar(m, r.Id, "reino", "Regência", "Depois de " + m.P.RegenciaH + " h sem entrar, a regência governa o reino até você voltar.", "regencia");
    }

    /// <summary>O jogador voltou (GET /reino depois do início): retoma o controle; o relatório fica para ele ver.</summary>
    public static bool AoEntrar(Mundo m, Reino r)
    {
        if (!r.EmRegencia || r.UltimoAcesso <= r.Regencia!.AtivaDesde) return false;
        r.Regencia.TerminouEm = m.Agora;
        m.Cancelar(r.SessaoIAEventoId); r.SessaoIAEventoId = null;
        m.Sujar(r);
        Agendar(m, r);
        Registros.Notificar(m, r.Id, "reino", "Fim da regência", "Você retomou o reino. Veja o que a regência fez e o que se perdeu.", "regencia");
        return true;
    }

    // ---------------------------------------------------------------- relatório

    /// <summary>Anota uma ação da regência (só se o reino está em regência). <paramref name="qtd"/> &gt; 0 soma na mesma linha.</summary>
    public static void Acao(Mundo m, Reino r, string chave, string texto, double qtd)
    {
        if (!r.EmRegencia) return;
        Anotar(m, r, r.Regencia!.Acoes, chave, texto, qtd);
    }

    /// <summary>Anota uma perda durante a regência.</summary>
    public static void Perda(Mundo m, Reino r, string chave, string texto, double qtd)
    {
        if (!r.EmRegencia) return;
        Anotar(m, r, r.Regencia!.Perdas, chave, texto, qtd);
    }

    private static void Anotar(Mundo m, Reino r, List<LinhaRegencia> l, string chave, string texto, double qtd)
    {
        var x = l.FirstOrDefault(y => y.Chave == chave);
        if (x == null) { x = new LinhaRegencia { Chave = chave }; l.Add(x); }
        x.Qtd += qtd; x.Texto = texto; x.Quando = m.Agora;
        var max = m.P.IA.Regencia.Linhas;
        if (l.Count > max) l.RemoveRange(0, l.Count - max);
        m.Sujar(r);
    }

    /// <summary>Texto de uma linha ("Lanceiros recrutados: 120" quando soma).</summary>
    public static string Texto(LinhaRegencia x) => x.Qtd > 0 ? x.Texto + ": " + Combates.Num(Math.Round(x.Qtd)) : x.Texto;

    /// <summary>Perdas de uma batalha em que o reino em regência defendeu (ou atacou).</summary>
    internal static void AoTerminarBatalha(Mundo m, ResultadoCombate rc)
    {
        foreach (var (id, perdas) in new[] { (rc.DefensorId, rc.PerdasDefesa), (rc.AtacanteId, rc.PerdasAtaque) })
        {
            var r = m.Reinos.Obter(id);
            if (r == null || !r.EmRegencia) continue;
            var n = GT(perdas);
            if (n > 0) Perda(m, r, "tropas", "Tropas perdidas em batalha", n);
            if (id == rc.DefensorId && rc.AtacanteVenceu && m.Locais.Obter(rc.LocalId) is { } l)
                Perda(m, r, "ataque:" + rc.BatalhaId, "Derrota em " + l.Nome + " (" + Ataques.NomesTipo.GetValueOrDefault(rc.Tipo, rc.Tipo).ToLowerInvariant() + ")", 0);
            if (rc.MiliciaMorta >= 1 && id == rc.DefensorId) Perda(m, r, "milicia", "População morta como milícia", rc.MiliciaMorta);
        }
    }

    private static int GT(IReadOnlyDictionary<string, int> g) => Reinos.Tropas.Total(g);

    internal static void AoCair(Mundo m, Reino r, RegistroQueda q)
    {
        if (!r.EmRegencia) return;
        Perda(m, r, "queda:" + q.Quando, q.Exilio ? "O castelo caiu: exílio" : "O castelo caiu: a sede foi para " + q.NovoCastelo, 0);
    }
}

/// <summary>Verificação de regência de um reino de jogador (último acesso + P.regenciaH).</summary>
public sealed class VerificarRegenciaEvento : Evento
{
    public long ReinoId { get; set; }
    public override void Executar(Mundo m)
    {
        var r = m.Reinos.Obter(ReinoId);
        if (r == null || r.RegenciaEventoId != Id) return;
        if (!m.IA.Ativa) { r.RegenciaEventoId = null; m.Sujar(r); return; }
        Regencia.Verificar(m, r);
    }
}
