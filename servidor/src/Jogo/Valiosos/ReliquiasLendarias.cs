using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Valiosos;

/// <summary>
/// Relíquias lendárias (uma por reino no mundo; ficam na temporada e não se confundem com as relíquias da temporada do legado).
/// Bônus no local onde estão guardadas (várias somam; o teto de bônus é do combate): produção (<c>P.reliquia.producao</c>),
/// ataque das tropas que partem do local (<c>ataque</c>) e defesa do local (<c>resistencia</c>).
/// Nunca andam sozinhas: tropas as carregam (escavação, escolta, saque) e quem entra num local com elas as guarda lá.
/// Visibilidade: 1 num local, só espionagem; a partir de <c>reliquiaVis.brilho</c>, brilho para quem explorou a área;
/// a partir de <c>reliquiaVis.farol</c>, farol para todos, até na névoa.
/// </summary>
[Sistema]
public static class ReliquiasLendarias
{
    public const string OrdemBuscar = "buscar-reliquia";

    public static void AoIniciar(Mundo m) => Sistemas.UmaVez("reliquias-lendarias", () =>
    {
        Economia.ModificadoresProducao.Add((mm, l) => 1 + mm.P.Reliquia.Producao * Contar(mm, l.Id, "producao"));
        Combate.Bonus.Ataque.Add((mm, ex) => mm.P.Reliquia.Ataque * Contar(mm, ex.OrigemLocalId, "ataque"));
        Combate.Bonus.Defesa.Add((mm, l) => mm.P.Reliquia.Resistencia * Contar(mm, l.Id, "resistencia"));
        Exercitos.AoEntrarNoLocal += Guardar;
    });

    public static int Contar(Mundo m, long localId, string tipo) => m.Reliquias.Count(r => r.LocalId == localId && r.Tipo == tipo);

    /// <summary>Relíquias guardadas por local (local → quantas).</summary>
    public static Dictionary<long, int> Concentracoes(Mundo m)
    {
        var d = new Dictionary<long, int>();
        foreach (var r in m.Reliquias) if (r.LocalId is long id) d[id] = d.GetValueOrDefault(id) + 1;
        return d;
    }

    /// <summary>"oculta" (1), "brilho" ou "farol", conforme quantas relíquias há no mesmo local.</summary>
    public static string Nivel(Mundo m, int n) => n >= m.P.ReliquiaVis.Farol ? "farol" : n >= m.P.ReliquiaVis.Brilho ? "brilho" : n > 0 ? "oculta" : "nenhuma";

    /// <summary>
    /// O que o reino sabe das relíquias no mapa: as suas (local e marcha), faróis (todos veem, até na névoa), brilhos
    /// (locais alheios com várias relíquias, numa área que o reino já explorou) e marchas alheias à vista que levam relíquia
    /// (baú, sem tipo). Uma relíquia sozinha num local alheio não aparece: só a espionagem revela.
    /// </summary>
    public static List<ReliquiaNoMapa> NoMapa(Mundo m, long reinoId, ISet<int> visiveis)
    {
        var lista = new List<ReliquiaNoMapa>();
        var nevoa = Exploracao.Nevoas.De(m, reinoId);
        foreach (var g in m.Reliquias.Where(r => r.LocalId != null).GroupBy(r => r.LocalId!.Value))
        {
            var l = m.Locais.Obter(g.Key);
            if (l == null) continue;
            var n = g.Count();
            var nivel = Nivel(m, n);
            if (l.ReinoId == reinoId) lista.Add(new("local", l.Id, null, l.Hex, n, nivel, g.Select(r => r.Tipo).ToArray()));
            if (nivel == "farol") lista.Add(new("farol", l.Id, null, l.Hex, n, nivel, []));
            else if (nivel == "brilho" && l.ReinoId != reinoId && nevoa.MinutoVisto(l.Hex) > 0) lista.Add(new("brilho", l.Id, null, l.Hex, n, nivel, []));
        }
        var agora = m.Agora;
        foreach (var mc in m.Marchas)
        {
            if (mc.Reliquias.Count == 0) continue;
            var h = mc.HexEm(agora);
            if (mc.ReinoId == reinoId)
                lista.Add(new("marcha", null, mc.Id, h, mc.Reliquias.Count, "", mc.Reliquias.Select(id => m.Reliquias.Obter(id)?.Tipo ?? "").ToArray()));
            else if (visiveis.Contains(h) && !Oculta(mc))
                lista.Add(new("marcha", null, mc.Id, h, mc.Reliquias.Count, "", []));
        }
        return lista;
    }
    /// <summary>Marchas que outros não veem no mapa (o sistema de exploração define as furtivas).</summary>
    public static Func<Marcha, bool> Oculta { get; set; } = _ => false;

    public static double Bonus(Mundo m, string tipo) => tipo switch
    {
        "ataque" => m.P.Reliquia.Ataque, "producao" => m.P.Reliquia.Producao, "resistencia" => m.P.Reliquia.Resistencia, _ => 0,
    };
    public static string NomeTipo(string tipo) => tipo switch { "ataque" => "Ataque", "producao" => "Produção", "resistencia" => "Resistência", _ => tipo };
    public static string Efeito(Mundo m, string tipo)
    {
        var p = "+" + Math.Round(Bonus(m, tipo) * 100) + "%";
        return tipo switch
        {
            "ataque" => p + " de ataque das tropas que saem do local",
            "producao" => p + " de produção do local",
            "resistencia" => p + " de defesa do local",
            _ => tipo,
        };
    }

    private static readonly Dictionary<string, string[]> Nomes = new()
    {
        ["ataque"] = ["Lâmina do Rei Antigo", "Elmo do Primeiro Rei", "Olho do Corvo", "Lança dos Mil Cercos", "Machado da Fenda", "Estandarte Rubro", "Punho de Ferro Frio", "Arco da Aurora", "Espada Sem Nome", "Trompa da Carga"],
        ["producao"] = ["Selo das Fornalhas", "Cálice das Colheitas", "Sino de Bronze", "Pedra do Vale", "Roda do Moleiro", "Chave dos Celeiros", "Foice de Prata", "Tear das Estações", "Cornucópia Antiga", "Martelo do Fundador"],
        ["resistencia"] = ["Pedra-Guardiã", "Escudo Vivo", "Coroa de Espinhos", "Manto da Muralha", "Raiz da Montanha", "Sentinela de Pedra", "Égide do Vau", "Âncora dos Reis", "Portão de Osso", "Elmo da Vigília"],
    };

    /// <summary>Nome sorteado do tipo, sem repetir os que já existem no mundo.</summary>
    public static string NomeNovo(Mundo m, string tipo)
    {
        var usados = m.Reliquias.Select(r => r.Nome).ToHashSet();
        var lista = Nomes.GetValueOrDefault(tipo) ?? Nomes["producao"];
        var livres = lista.Where(n => !usados.Contains(n)).ToArray();
        if (livres.Length > 0) return livres[m.Sorte.Int(0, livres.Length)];
        for (var i = 2; ; i++)
            foreach (var n in lista) { var c = n + " " + Romano(i); if (!usados.Contains(c)) return c; }
    }
    private static string Romano(int i) => i switch { 2 => "II", 3 => "III", 4 => "IV", 5 => "V", _ => i.ToString() };

    /// <summary>Tropas que entram num local guardam lá as relíquias que carregam (escavação, escolta, saque).</summary>
    private static void Guardar(Mundo m, Exercito ex, Local l)
    {
        if (ex.Reliquias.Count == 0) return;
        var dono = m.Reinos.Obter(l.ReinoId);
        if (dono != null) Economia.Atualizar(m, dono);
        foreach (var rid in ex.Reliquias.ToList())
        {
            var rel = m.Reliquias.Obter(rid);
            if (rel == null) { ex.Reliquias.Remove(rid); continue; }
            Reliquias.Guardar(m, rel, l);
            Registros.Notificar(m, ex.ReinoId, "reliquias", "Relíquia guardada", rel.Nome + " agora fortalece " + l.Nome + ": " + Efeito(m, rel.Tipo) + ".", "reliquias");
        }
        m.Sujar(ex);
        if (dono != null) Sistemas.Revelar(m, dono, Apresentacao.ReliquiasChave);
        m.Avisar(l.ReinoId, "reino");
        m.Avisar(l.ReinoId, "mapa");
    }

    /// <summary>
    /// Move uma relíquia guardada com escolta: as tropas saem de <paramref name="deLocalId"/>, buscam a relíquia no local
    /// onde ela está (que continua fortalecido até ela ser pega) e a levam ao destino.
    /// </summary>
    public static Exercito Mover(Mundo m, Reino r, long reliquiaId, long deLocalId, IReadOnlyDictionary<string, int>? tropas, long destinoLocalId, bool seguro)
    {
        var rel = m.Reliquias.Obter(reliquiaId);
        if (rel == null || rel.ReinoId != r.Id) throw new RegraException("Relíquia não encontrada.", 404);
        var orig = rel.LocalId is long lid ? m.Locais.Obter(lid) : null;
        if (!Exercitos.LocalProprio(orig, r.Id)) throw new RegraException("A relíquia não está guardada num local seu.");
        var dest = m.Locais.Obter(destinoLocalId);
        if (!Exercitos.LocalProprio(dest, r.Id)) throw new RegraException("Escolha um local seu como destino.");
        if (dest!.Id == orig!.Id) throw new RegraException("A relíquia já está neste local.");
        if (m.Marchas.OfType<Exercito>().Any(e => e.ReinoId == r.Id && e.Ordem == OrdemBuscar && e.Dados["reliquiaId"]?.GetValue<long>() == rel.Id))
            throw new RegraException("Uma escolta já vai buscar esta relíquia.");
        var de = m.Locais.Obter(deLocalId);
        if (de == null || de.ReinoId != r.Id) throw new RegraException("Local não é seu.", 404);
        var dados = new JsonObject { ["reliquiaId"] = rel.Id, ["destinoLocalId"] = dest.Id };
        if (de.Hex == orig.Hex)
        {
            var ex = Exercitos.Enviar(m, r, deLocalId, tropas, dest.Hex, OrdemReforcar.Id, seguro, dados);
            Reliquias.Carregar(m, rel, ex);
            m.Avisar(r.Id, "mapa");
            return ex;
        }
        return Exercitos.Enviar(m, r, deLocalId, tropas, orig.Hex, OrdemBuscar, seguro, dados);
    }
}

/// <summary>Relíquias no mapa como o reino as vê: Tipo = "local" (suas, guardadas), "farol", "brilho" ou "marcha" (com baú); Tipos vazio = desconhecidos.</summary>
public sealed record ReliquiaNoMapa(string Tipo, long? LocalId, long? MarchaId, int Hex, int N, string Nivel, string[] Tipos);

/// <summary>Escolta que vai buscar uma relíquia guardada num local próprio e a leva a outro (<c>Dados.reliquiaId</c>, <c>Dados.destinoLocalId</c>).</summary>
public sealed class OrdemBuscarReliquia : IOrdemExercito
{
    public string Ordem => ReliquiasLendarias.OrdemBuscar;
    public void Validar(Mundo m, Reino r, Exercito ex, int destino)
    {
        var rid = ex.Dados["reliquiaId"]?.GetValue<long>();
        var rel = rid is long x ? m.Reliquias.Obter(x) : null;
        var l = m.LocalNoHex(destino);
        if (rel == null || rel.ReinoId != r.Id || l == null || rel.LocalId != l.Id || !Exercitos.LocalProprio(l, r.Id))
            throw new RegraException("A relíquia não está neste local.");
        var did = ex.Dados["destinoLocalId"]?.GetValue<long>();
        if (did is not long d || !Exercitos.LocalProprio(m.Locais.Obter(d), r.Id)) throw new RegraException("Escolha um local seu como destino.");
    }

    public void Chegou(Mundo m, Exercito ex)
    {
        var rid = ex.Dados["reliquiaId"]?.GetValue<long>();
        var rel = rid is long x ? m.Reliquias.Obter(x) : null;
        var l = m.LocalNoHex(ex.Destino);
        if (rel == null || l == null || rel.LocalId != l.Id || !Exercitos.LocalProprio(l, ex.ReinoId) || rel.ReinoId != ex.ReinoId)
        {
            Exercitos.Avisar(m, ex, "A relíquia não está mais lá", "A escolta volta.");
            ex.Retornar(m);
            return;
        }
        var r = m.Reinos.Obter(ex.ReinoId);
        if (r != null) Economia.Atualizar(m, r);   // até agora, a relíquia fortalecia a origem
        Reliquias.Carregar(m, rel, ex);
        var did = ex.Dados["destinoLocalId"]?.GetValue<long>();
        var dest = did is long d ? m.Locais.Obter(d) : null;
        if (!Exercitos.LocalProprio(dest, ex.ReinoId)) { ex.EntrarNoLocal(m, l); return; }
        Registros.Notificar(m, ex.ReinoId, "reliquias", "Escolta pegou " + rel.Nome, "A caminho de " + dest!.Nome + ". No caminho, pode ser roubada.", "reliquias");
        try
        {
            var rota = Exercitos.Rota(m, ex, l.Hex, dest.Hex);
            ex.Ordem = OrdemReforcar.Id; ex.AlvoLocalId = dest.Id; ex.Retornando = false;
            ex.Partir(m, rota);
            m.Avisar(ex.ReinoId, "mapa");
        }
        catch (RegraException) { ex.EntrarNoLocal(m, l); }
    }
}
