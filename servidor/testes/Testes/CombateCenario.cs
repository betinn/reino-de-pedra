using System.Runtime.CompilerServices;
using System.Text.Json.Nodes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Pessoas;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Testes;

/// <summary>
/// Ganchos de teste por mundo (bônus de ataque e defesa, bloqueio antes de enviar, queda do castelo), registrados uma
/// única vez no construtor estático: cada teste mexe só no próprio mundo e as listas estáticas não mudam durante os testes.
/// </summary>
public static class AjustesTeste
{
    public sealed class Ajuste
    {
        public double BonusA;
        public Dictionary<long, double> BonusD = new();
        public string? Bloquear;
        public List<(Reino perdeu, Exercito vencedor, Local castelo)> Quedas = new();
        public List<ResultadoCombate> Fins = new();
        public int? Exilio;
    }
    private static readonly ConditionalWeakTable<Mundo, Ajuste> Tabela = new();

    /// <summary>Erros de eventos nesta thread (o mundo engole e só registra: aqui o teste falha).</summary>
    [ThreadStatic] private static List<Exception>? _erros;
    public static void FalharSeErro()
    {
        if (_erros is { Count: > 0 } e) { var x = e[0]; e.Clear(); throw new Exception("erro num evento: " + x, x); }
    }

    static AjustesTeste()
    {
        Mundo.ErroEvento += (ev, ex) => (_erros ??= new()).Add(ex);
        Bonus.Ataque.Add((m, ex) => Tabela.TryGetValue(m, out var a) ? a.BonusA : 0);
        Bonus.Defesa.Add((m, l) => Tabela.TryGetValue(m, out var a) && a.BonusD.TryGetValue(l.Id, out var v) ? v : 0);
        Permissoes.AntesDeEnviar.Add((m, atk, alvo) => Tabela.TryGetValue(m, out var a) ? a.Bloquear : null);
        Combates.AoCairCastelo.Add((m, r, ex, l) => De(m).Quedas.Add((r, ex, l)));
        Combates.AoTerminar.Add((m, rc) => De(m).Fins.Add(rc));
        Quedas.EscolherExilio.Add((m, r, atk) => Tabela.TryGetValue(m, out var a) ? a.Exilio : null);
    }

    /// <summary>Garante o registro (chame no construtor da classe de teste, antes de qualquer combate).</summary>
    public static void Garantir() { }
    public static Ajuste De(Mundo m) => Tabela.GetValue(m, _ => new Ajuste());
}

/// <summary>Montagem de combates: atacante com tropas no castelo e um alvo do defensor a poucos hexágonos.</summary>
public sealed class CombateCenario
{
    public MundoTeste T { get; } = new();
    public Mundo M => T.M;
    public Reino Atk { get; }
    public Reino Def { get; }
    public Local CasteloAtk => M.Locais[Atk.CasteloId];

    public CombateCenario()
    {
        AjustesTeste.Garantir();
        Atk = T.NovoReino();
        Def = T.NovoReino();
        Atk.EscudoAte = 0; Def.EscudoAte = 0;
    }

    /// <summary>Hexágono livre fora do rio a exatamente <paramref name="dist"/> de <paramref name="centro"/>.</summary>
    public int HexLivre(int centro, int dist, int pular = 0) =>
        M.G.Area(centro, dist).Where(h => M.G.Distancia(h, centro) == dist && Obras.HexLivre(M, h) && !M.Mapa.Rio[h]).Skip(pular).First();

    /// <summary>
    /// O defensor fica só com um local (o alvo), perto do castelo atacante, com a população civil dada e a economia congelada
    /// (a população "do local" é exatamente <paramref name="pop"/>; estoques não andam).
    /// </summary>
    public Local Alvo(TipoLocal tipo, IReadOnlyDictionary<string, int> guarnicao, double pop, int dist = 4, string? produz = "ferro", int nivel = 1)
    {
        foreach (var l in M.LocaisDe(Def.Id).ToList()) M.RemoverLocal(l);
        var alvo = M.AdicionarLocal(new Local
        {
            ReinoId = Def.Id, Tipo = tipo, Produz = tipo == TipoLocal.Castelo ? null : produz, Nivel = nivel,
            Hex = HexLivre(CasteloAtk.Hex, dist), Nome = tipo == TipoLocal.Castelo ? "Castelo de " + Def.Nome : "Mina Rubra",
            Guarnicao = guarnicao.ToDictionary(kv => kv.Key, kv => kv.Value),
        });
        if (tipo == TipoLocal.Castelo) Def.CasteloId = alvo.Id;
        Pessoas.Povoar(M, Def, alvo, (int)pop);   // os civis presentes no local são a milícia
        Congelar(Def);
        return alvo;
    }

    /// <summary>Economia parada: Economia.Atualizar não muda mais estoques nem população deste reino.</summary>
    public void Congelar(Reino r) { r.AtualizadoEm = long.MaxValue / 4; M.Sujar(r); }

    public Torre Torre(Local perto, int nivel, int pular = 0)
    {
        var h = M.G.Area(perto.Hex, 4).Where(x => x != perto.Hex && Obras.HexLivre(M, x) && !M.Mapa.Rio[x]).Skip(pular).First();
        return M.Torres.Adicionar(new Torre { ReinoId = perto.ReinoId, Hex = h, Nivel = nivel, Estrutura = Defesas.EstruturaCheia(M, nivel) });
    }

    /// <summary>Põe tropas na guarnição de um local (tirando da população civil quando ela não está congelada).</summary>
    public void Guarnecer(Local l, IReadOnlyDictionary<string, int> g)
    {
        foreach (var (k, n) in g) l.Guarnicao[k] = l.Guarnicao.GetValueOrDefault(k) + n;
        M.Sujar(l);
    }

    /// <summary>Por padrão as tropas lutam mesmo sem o que levar: o alvo dos cenários nasce com o estoque vazio.</summary>
    public static JsonObject Plano(string tipo = "saque", string tatica = "semLimite", JsonArray? objetivos = null, bool estandarte = false, bool completar = false, bool recuarVazio = false, string divisao = "prioridade") =>
        new() { ["tipo"] = tipo, ["tatica"] = tatica, ["objetivos"] = objetivos ?? new JsonArray(), ["estandarte"] = estandarte, ["completar"] = completar, ["recuarVazio"] = recuarVazio, ["divisao"] = divisao };

    public static JsonObject Obj(string k, string? r = null, double q = 0)
    {
        var o = new JsonObject { ["k"] = k };
        if (r != null) o["r"] = r;
        if (q > 0) o["q"] = q;
        return o;
    }

    /// <summary>Envia do castelo do atacante (as tropas são postas lá antes) para o alvo.</summary>
    public Exercito Atacar(Local alvo, IReadOnlyDictionary<string, int> tropas, JsonObject? plano = null, string ordem = OrdemAtacar.Id)
    {
        Guarnecer(CasteloAtk, tropas);
        Conhecer(Atk, alvo);
        return Exercitos.Enviar(M, Atk, CasteloAtk.Id, tropas, alvo.Hex, ordem, false, plano ?? Plano());
    }

    /// <summary>O reino já viu o local (fica na foto da névoa): só se ataca o que se conhece.</summary>
    public void Conhecer(Reino r, Local l) => ReinoDePedra.Jogo.Exploracao.Nevoas.RevelarArea(M, r.Id, l.Hex, 0);

    public void AvancarAte(long t) { T.Avancar(TimeSpan.FromMilliseconds(Math.Max(0, t - M.Agora))); AjustesTeste.FalharSeErro(); }

    /// <summary>Avança até a chegada do exército (a batalha começa).</summary>
    public Batalha Chegar(Exercito ex)
    {
        AvancarAte(ex.Chegada);
        return M.Batalhas.Single(b => b.Exercitos.Contains(ex.Id));
    }

    /// <summary>Avança até o fim previsto da batalha.</summary>
    public void Terminar(Batalha b) => AvancarAte(b.FimPrevisto);
}
