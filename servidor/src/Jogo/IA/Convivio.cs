using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Jogo.IA;

/// <summary>
/// O convívio de um reino de IA com os outros, na sessão dele e pelos mesmos serviços dos jogadores: mensagens por
/// mensageiro (responde a quem escreveu, reclama com quem o atacou, cumprimenta um vizinho) e, na aliança, entrar, convidar
/// e conversar (<see cref="ConvivioAlianca"/>). Tudo o que a IA escreve sai de <see cref="Falas.Gerar"/>.
/// Nada aqui é obrigatório nem imediato: depende de quem governa (sociável ou calado, rancoroso ou não), acontece na
/// sessão seguinte e, por sessão, sai no máximo uma mensagem.
/// </summary>
public static class Convivio
{
    private static void Tentar(Action a) { try { a(); } catch (RegraException) { } }

    /// <summary>Já tratou deste assunto há menos de <paramref name="dias"/> dias?</summary>
    public static bool JaFalou(Persona p, string chave, long agora, double dias) =>
        p.FalouEm.TryGetValue(chave, out var t) && agora - t < dias * T.Dia;

    public static void Marcar(Mundo m, Reino r, string chave)
    {
        var p = r.Persona!;
        p.FalouEm[chave] = m.Agora;
        // a memória de assuntos não cresce sem fim: fica com os 60 mais recentes
        if (p.FalouEm.Count > 80)
            foreach (var k in p.FalouEm.OrderBy(kv => kv.Value).Take(p.FalouEm.Count - 60).Select(kv => kv.Key).ToList()) p.FalouEm.Remove(k);
        m.Sujar(r);
    }

    public static void Sessao(Mundo m, Reino r, Conduta c)
    {
        if (r.Persona == null) return;
        Tentar(() => Mensagens(m, r));
        Tentar(() => ConvivioAlianca.Sessao(m, r, c));
    }

    /// <summary>Tem mensageiro livre? Se não tem nem está treinando, treina um (se a população e a comida derem) para a próxima sessão.</summary>
    private static bool Mensageiro(Mundo m, Reino r)
    {
        if (r.MensageirosLivres > 0) return true;
        if (!Mensageiros.EmTreino(r).Any() && !Mensageiros.EmCampo(m, r.Id).Any()) Tentar(() => Mensageiros.Treinar(m, r, 1));
        return false;
    }

    /// <summary>
    /// Mensagens por mensageiro. Primeiro, o que chegou: quem é sociável responde (com o tom dele; a quem o atacou, responde
    /// atravessado). Depois, por conta própria e raramente: um recado a quem ele não perdoa, ou um aceno ao vizinho.
    /// </summary>
    public static void Mensagens(Mundo m, Reino r)
    {
        var p = r.Persona!;
        var recebidas = Mensageiros.Recebidas(m, r.Id).Where(x => !x.Lida).OrderBy(x => x.Entregue).ThenBy(x => x.Id).ToList();
        Mensagem? responder = null;
        foreach (var x in recebidas)
        {
            var de = m.Reinos.Obter(x.DeId);
            var quer = de is { Ativo: true } && responder == null
                && (JaFalou(p, "vou-responder:" + x.Id, m.Agora, 3) || Personas.Sorte(m, r, "responde:" + x.Id).Chance(0.2 + 0.7 * p.Sociabilidade));
            if (quer) { responder = x; continue; }
            x.Lida = true; m.Sujar(x);   // leu e deixou sem resposta
        }
        if (responder != null)
        {
            if (!Mensageiro(m, r)) { Marcar(m, r, "vou-responder:" + responder.Id); return; }   // responde na próxima, quando o mensageiro estiver pronto
            var de = m.Reinos.Obter(responder.DeId)!;
            var rancor = Personas.RancorDe(r, de.Id);
            var tipo = rancor > 0.45 ? (p.Orgulho > 0.5 ? Falas.Ameaca : Falas.Queixa) : Falas.Resposta;
            var texto = Falas.Gerar(m, r, new ContextoFala
            {
                Tipo = tipo, Canal = Falas.CanalMensageiro, ParaReino = de.Nome, MaxCaracteres = m.P.Mensageiro.Caracteres,
                Historico = [new FalaAnterior(de.Nome, responder.Texto)],
                Situacao = Situacao(m, r, de),
            });
            responder.Lida = true; m.Sujar(responder);
            if (texto != null) { Mensageiros.Enviar(m, r, texto, null, null, responder.Id); Personas.Favor(m, r, de.Id, 0.05); }
            return;
        }

        // por conta própria: a quem não perdoa (uma vez a cada alguns dias)
        if (Personas.Desafeto(r) is long did && m.Reinos.Obter(did) is { Ativo: true } desafeto && !JaFalou(p, "recado:" + did, m.Agora, 4))
        {
            if (!Personas.Sorte(m, r, "recado").Chance(0.15 + 0.5 * p.Orgulho)) { Marcar(m, r, "recado:" + did); return; }   // engoliu calado desta vez
            if (!Mensageiro(m, r)) return;
            var tipo = p.Agressividade < 0.35 && p.Cautela > 0.55 ? Falas.PropostaPaz : p.Orgulho > 0.55 || p.Agressividade > 0.6 ? Falas.Ameaca : Falas.Queixa;
            var texto = Falas.Gerar(m, r, new ContextoFala { Tipo = tipo, Canal = Falas.CanalMensageiro, ParaReino = desafeto.Nome, MaxCaracteres = m.P.Mensageiro.Caracteres, Situacao = Situacao(m, r, desafeto) });
            Marcar(m, r, "recado:" + did);
            if (texto != null) Mensageiros.Enviar(m, r, texto, did, null);
            return;
        }

        // um aceno ao vizinho mais perto: só quem é bem sociável, uma vez na temporada, depois do primeiro dia
        if (p.Sociabilidade > 0.68 && !p.FalouEm.ContainsKey("vizinho") && m.Agora - r.CriadoEm > T.Dia)
        {
            var castelo = m.Locais.Obter(r.CasteloId);
            var vizinho = castelo == null ? null : m.Reinos.Where(x => x.Ativo && x.Id != r.Id && m.Locais.Obter(x.CasteloId) != null)
                .OrderBy(x => m.G.Distancia(m.Locais[x.CasteloId].Hex, castelo.Hex)).ThenBy(x => x.Id).FirstOrDefault();
            if (vizinho == null) { Marcar(m, r, "vizinho"); return; }
            if (!Mensageiro(m, r)) return;
            var texto = Falas.Gerar(m, r, new ContextoFala { Tipo = Falas.Vizinho, Canal = Falas.CanalMensageiro, ParaReino = vizinho.Nome, MaxCaracteres = m.P.Mensageiro.Caracteres });
            Marcar(m, r, "vizinho");
            if (texto != null) Mensageiros.Enviar(m, r, texto, vizinho.Id, null);
        }
    }

    /// <summary>O que a fala pode citar sobre os dois reinos: o local do remetente que o outro atacou por último, se houver.</summary>
    private static Dictionary<string, string> Situacao(Mundo m, Reino r, Reino outro)
    {
        var d = new Dictionary<string, string>();
        var b = Combate.Batalhas.DoReino(m, r.Id).Where(x => x.DefensorId == r.Id && x.AtacanteId == outro.Id).OrderByDescending(x => x.Inicio).FirstOrDefault();
        var l = b != null ? m.Locais.Obter(b.LocalId) : null;
        d["local"] = l is { } && l.ReinoId == r.Id ? l.Nome : "minhas terras";
        return d;
    }
}

/// <summary>A parte da aliança do convívio da IA (preenchida com as alianças).</summary>
public static class ConvivioAlianca
{
    public static void Sessao(Mundo m, Reino r, Conduta c) { }
}
