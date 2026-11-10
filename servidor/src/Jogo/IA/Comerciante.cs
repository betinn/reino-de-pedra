using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Jogo.IA;

/// <summary>
/// Respostas da IA às propostas que chegam (na sessão, como um jogador que entra e lê). Troca direta: o reino de IA
/// comerciante compra a <c>1 − P.comercio.margemIA</c> e vende a <c>1 + margemIA</c> do valor de referência (prata é a
/// moeda: vale o valor cheio), só com o próprio estoque e pelo mesmo <see cref="Comercio.AceitarTroca"/> dos jogadores;
/// os outros perfis pedem <c>P.ia.comercio.margemOutros</c> vezes essa margem. Ninguém dá mais que
/// <c>P.ia.comercio.reserva</c> do que guarda de um recurso. Pactos: aceita sem pagar (o saqueador só se receber);
/// pactos cobrados, recusa. Pedido de recursos de aliado: atende conforme a lealdade de quem governa, com o próprio estoque.
/// </summary>
public static class Comerciante
{
    public const string Moeda = "prata";

    /// <summary>Margem que o reino pede: a da IA comerciante, ou a dos outros perfis.</summary>
    public static double Margem(Mundo m, Conduta c) =>
        m.P.Comercio.MargemIA * (c.Perfil?.Comercia == true ? 1 : m.P.IA.Comercio.MargemOutros) * c.Margem;

    /// <summary>Valor para a IA do que ela recebe (compra: abaixo da referência) ou dá (venda: acima). Prata vale o valor cheio.</summary>
    public static double Valor(Mundo m, IReadOnlyDictionary<string, double> c, double fator) =>
        c.Sum(kv => kv.Value * m.P.Valor.GetValueOrDefault(kv.Key, 1) * (kv.Key == Moeda ? 1 : fator));

    /// <summary>A troca vale para a IA: o que recebe, a preço de compra, cobre o que dá, a preço de venda.</summary>
    public static bool Vale(Mundo m, Conduta c, IReadOnlyDictionary<string, double> recebe, IReadOnlyDictionary<string, double> da)
    {
        var mg = Margem(m, c);
        return Valor(m, recebe, 1 - mg) + 1e-6 >= Valor(m, da, 1 + mg);
    }

    /// <summary>A IA tem o que daria, sem passar da reserva (só o próprio estoque).</summary>
    public static bool TemEstoque(Mundo m, Reino r, IReadOnlyDictionary<string, double> da)
    {
        Economia.Atualizar(m, r);
        var total = Economia.TotalGuardado(m, r);
        return da.All(kv => total.Qtd(kv.Key) * m.P.IA.Comercio.Reserva + 1e-6 >= kv.Value);
    }

    public static void Responder(Mundo m, Reino r, Conduta c)
    {
        foreach (var p in Comercio.Abertas(m, r.Id).OrderBy(p => p.Quando).ThenBy(p => p.Id).ToList())
        {
            try
            {
                switch (p.Tipo)
                {
                    case Comercio.Troca:
                        // quem propõe dá "Da" e quer "Quer": a IA recebe Da e dá Quer
                        if (Vale(m, c, p.Da, p.Quer) && TemEstoque(m, r, p.Quer)) Comercio.AceitarTroca(m, r, p.Id);
                        else Comercio.Recusar(m, r, p.Id);
                        break;
                    case Comercio.PactoT:
                        var cobrado = p.Quer.Count > 0;   // o outro quer que a IA pague
                        var pago = p.Da.Count > 0;
                        var aceita = !cobrado && (pago || c.Perfil?.Ataca != true);
                        if (aceita) Comercio.AceitarPacto(m, r, p.Id); else Comercio.Recusar(m, r, p.Id);
                        break;
                    case Comercio.Pedido:
                        // pedido de recursos de um aliado: quem é leal e tem de sobra manda; o ganancioso segura
                        ConvivioAlianca.ResponderPedido(m, r, p);
                        break;
                    default:
                        Comercio.Recusar(m, r, p.Id);
                        break;
                }
            }
            catch (RegraException)
            {
                // a regra do jogo barrou (estoque, limite do novato, pactos demais...): recusa, como um jogador faria
                try { if (m.Propostas.Obter(p.Id) is { Estado: Comercio.Aberta }) Comercio.Recusar(m, r, p.Id); } catch (RegraException) { }
            }
        }
    }
}
