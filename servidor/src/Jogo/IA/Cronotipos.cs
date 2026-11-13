using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.IA;

/// <summary>
/// Horário de quem governa um reino de IA (decisão 0044): a faixa (madrugador, normal, notívago, coruja...) e o desvio, em
/// horas, que ela dá a todas as sessões da habilidade, ao "acordada" da reação e ao dia do fim de semana. Os números ficam
/// em <c>P.ia.cronotipos</c>; aqui só a regra.
/// <para><b>Por cota, não por sorteio solto.</b> A IA entra na faixa mais abaixo do peso dela entre as IAs ativas que já têm
/// faixa. Assim um mundo de 25 IAs tem sempre as mesmas contas por faixa (4 corujas com os números de hoje), e a madrugada
/// nunca fica sem ninguém por azar do sorteio. A faixa pode aceitar só algumas habilidades (a coruja: médio e ativo); quem
/// ela não aceita vai para a próxima faixa mais abaixo do peso.</para>
/// <para><b>Uma vez só.</b> A faixa fica gravada na persona. Persona sem faixa é de um mundo de antes desta regra: ganha a
/// faixa ao subir (<see cref="SistemaIA.AoIniciar"/>) e não muda mais. Reino de jogador nunca tem persona nem faixa.</para>
/// <para>O desvio dentro da faixa e o desempate saem de uma sorte própria do reino (semente do mundo, id e criação): não mexem
/// na sorte do mundo, e o mesmo mundo dá sempre o mesmo horário.</para>
/// </summary>
public static class Cronotipos
{
    /// <summary>Faixa da persona neutra dos testes: sem desvio e fora da cota.</summary>
    public const string Neutro = "neutro";
    private const ulong Sal = 0x43524F4E4F544950UL;   // "CRONOTIP"

    /// <summary>
    /// Dá a faixa e o desvio à persona de um reino de IA que ainda não tem faixa (nascida agora ou de um mundo de antes da
    /// decisão 0044). Devolve se deu. Persona que já tem faixa, reino de jogador e mundo sem faixas no balanceamento: nada muda.
    /// </summary>
    public static bool Atribuir(Mundo m, Reino r)
    {
        var p = r.Persona;
        if (p == null || !r.EhIA || p.Cronotipo.Length > 0) return false;
        var faixas = m.P.IA.Cronotipos;
        if (faixas.Count == 0) return false;
        var s = new Rng(Rng.Hash(m.Estado.Semente ^ Sal, (ulong)r.Id, (ulong)r.CriadoEm));
        var nome = Escolher(m, r, s);
        var f = faixas[nome];
        var (de, ate) = f.Desvio.Length >= 2 ? (f.Desvio[0], f.Desvio[1]) : (0.0, 0.0);
        p.Cronotipo = nome;
        p.DesvioHoras = Math.Round(de + s.Real() * (ate - de), 2);
        m.Sujar(r);
        return true;
    }

    /// <summary>
    /// A faixa mais abaixo do peso entre as IAs ativas que já têm faixa, contando esta: peso × (n + 1) − quantas já estão nela.
    /// Só as faixas que aceitam a habilidade do reino; empate pela sorte do reino.
    /// </summary>
    public static string Escolher(Mundo m, Reino r, Rng s)
    {
        var faixas = m.P.IA.Cronotipos;
        var contagem = faixas.Keys.ToDictionary(k => k, _ => 0);
        var n = 0;
        foreach (var o in Ocupacao.DeIA(m))
            if (o.Id != r.Id && o.Persona?.Cronotipo is { } c && contagem.ContainsKey(c)) { contagem[c]++; n++; }
        var total = faixas.Values.Sum(f => Math.Max(0, f.Peso));
        string? melhor = null;
        double maior = double.NegativeInfinity, desempate = -1;
        foreach (var (k, f) in faixas.OrderBy(kv => kv.Key, StringComparer.Ordinal))
        {
            var sorte = s.Real();   // um número por faixa, sempre: o desvio que vem depois não depende de quais faixas aceitam
            if (f.Peso <= 0 || total <= 0 || !Aceita(f, r.HabilidadeIA)) continue;
            var falta = f.Peso / total * (n + 1) - contagem[k];
            if (falta > maior + 1e-9 || (Math.Abs(falta - maior) <= 1e-9 && sorte > desempate)) { melhor = k; maior = falta; desempate = sorte; }
        }
        return melhor ?? faixas.Keys.OrderBy(k => k, StringComparer.Ordinal).First();
    }

    /// <summary>
    /// A IA é a única ativa da faixa dela (faixa do balanceamento; neutra ou sem faixa: não). Ao abdicar para dar vaga a um
    /// jogador, essa IA fica enquanto houver outra para sair (<see cref="Ocupacao.LiberarVaga"/>): a cota só age em quem nasce,
    /// e sem isso a última coruja podia sair só por ser a menor, deixando a madrugada sem ninguém.
    /// </summary>
    public static bool UltimaDaFaixa(Mundo m, Reino r) =>
        r.Persona?.Cronotipo is { Length: > 0 } c && m.P.IA.Cronotipos.ContainsKey(c)
        && !Ocupacao.DeIA(m).Any(o => o.Id != r.Id && o.Persona?.Cronotipo == c);

    /// <summary>A faixa aceita esta habilidade? Sem lista, aceita todas.</summary>
    public static bool Aceita(CronotipoIAP f, string? habilidade) =>
        f.Habilidades is not { Length: > 0 } || (habilidade != null && f.Habilidades.Contains(habilidade));

    /// <summary>
    /// Acordada numa hora local (0 a 24), pelo dia de quem joga: entre a primeira e a última sessão da habilidade, deslocadas
    /// pelo desvio, com 1 h de folga. É a regra de <see cref="Personas.Acordada"/> sem o relógio do mundo.
    /// </summary>
    public static bool AcordadaNaHora(double horaLocal, double desvioH, int[] sessoes)
    {
        if (sessoes.Length == 0) return false;
        var h = ((horaLocal - desvioH) % 24 + 24) % 24;
        return h >= sessoes.Min() - 1 && h <= sessoes.Max() + 1;
    }
}
