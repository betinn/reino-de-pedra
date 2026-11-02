using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Jogo.Forja;

/// <summary>
/// Ferraria e eras: pesquisa das eras, armas e armaduras por família e forja do equipamento lendário. Tudo na fila
/// própria "ferraria" do reino (até 10 itens, um por vez), com a requisição automática do material até a ferraria de
/// maior nível. Requisitos: <c>P.ferrariaServ</c> (o maior local de cada tipo no reino conta).
/// </summary>
public static class Ferrarias
{
    public const string Fila = "ferraria";
    public const string Armas = "armas", Armaduras = "armaduras";
    public const string Ataque = "ataque", Defesa = "defesa";
    public static readonly string[] Linhas = [Armas, Armaduras];

    /// <summary>Linha → efeito ("armas" dão ataque; "armaduras", defesa).</summary>
    public static string Efeito(string linha) => linha == Armas ? Ataque : Defesa;

    public static readonly Dictionary<string, string> NomesFamilia = new()
    {
        ["infantaria"] = "infantaria", ["arqueiros"] = "arqueiros", ["cavalaria"] = "cavalaria",
    };

    // ---------------------------------------------------------------- estado

    public static int MaiorNivel(Mundo m, Reino r, TipoLocal tipo) =>
        m.LocaisDe(r.Id).Where(l => !l.Ruina && l.Tipo == tipo).Select(l => l.Nivel).DefaultIfEmpty(0).Max();

    /// <summary>A ferraria de maior nível do reino (onde as forjas acontecem), ou null.</summary>
    public static Local? Principal(Mundo m, Reino r) =>
        m.LocaisDe(r.Id).Where(l => !l.Ruina && l.Tipo == TipoLocal.Ferraria).OrderByDescending(l => l.Nivel).ThenBy(l => l.Id).FirstOrDefault();

    public static bool EraFeita(Reino r, string era) => r.Eras.ContainsKey(era);

    /// <summary>Era atual: a última de <c>P.eras</c> já pesquisada, ou "ferro".</summary>
    public static string EraAtual(Mundo m, Reino r) => m.P.Eras.Keys.LastOrDefault(r.Eras.ContainsKey) ?? "ferro";

    public static int Nivel(Reino r, string familia, string linha) => r.Forja.GetValueOrDefault(familia + ":" + linha);

    public static IEnumerable<ItemFila> Itens(Reino r) => r.Filas.TryGetValue(Fila, out var f) ? f.Itens : [];

    public static int NaFila(Reino r, string familia, string linha) =>
        Itens(r).Count(i => i.Tipo == ItemForja.Id && i.Param == familia + ":" + linha);

    // ---------------------------------------------------------------- requisitos

    public sealed record Req(string Texto, bool Ok);

    /// <summary>Requisitos com o texto do jogador e se o reino os cumpre.</summary>
    public static List<Req> Requisitos(Mundo m, Reino r, RequisitoP req)
    {
        var l = new List<Req>();
        if (!string.IsNullOrEmpty(req.Era))
            l.Add(new(m.P.Eras.TryGetValue(req.Era, out var e) ? e.Nome : req.Era, EraFeita(r, req.Era)));
        if (req.Ferraria > 0) l.Add(new("Ferraria nível " + req.Ferraria, MaiorNivel(m, r, TipoLocal.Ferraria) >= req.Ferraria));
        if (req.Quartel > 0) l.Add(new("Quartel nível " + req.Quartel, MaiorNivel(m, r, TipoLocal.Quartel) >= req.Quartel));
        return l;
    }

    private static string? Falta(Mundo m, Reino r, RequisitoP req)
    {
        var f = Requisitos(m, r, req).Where(x => !x.Ok).Select(x => x.Texto).ToList();
        return f.Count > 0 ? "Falta: " + string.Join(", ", f) + "." : null;
    }

    private static string? SemFerraria(Mundo m, Reino r) =>
        Principal(m, r) == null ? "Funde uma ferraria primeiro." : null;

    private static string? FilaCheia(Reino r) =>
        Itens(r).Count() >= Reinos.Fila.Maximo ? "A fila da ferraria já tem " + Reinos.Fila.Maximo + " itens." : null;

    // ---------------------------------------------------------------- eras

    public static string? MotivoEra(Mundo m, Reino r, string era)
    {
        if (!m.P.Eras.ContainsKey(era) || !m.P.FerrariaServ.Eras.TryGetValue(era, out var req)) return "Era desconhecida.";
        if (EraFeita(r, era)) return "Esta era já foi pesquisada.";
        if (Itens(r).Any(i => i.Tipo == ItemEra.Id && i.Param == era)) return "Esta era já está na fila.";
        return SemFerraria(m, r) ?? Falta(m, r, req) ?? FilaCheia(r);
    }

    public static ItemFila PesquisarEra(Mundo m, Reino r, string era)
    {
        var motivo = MotivoEra(m, r, era);
        if (motivo != null) throw new RegraException(motivo);
        var e = m.P.Eras[era];
        var f = Principal(m, r)!;
        return Filas.Enfileirar(m, r, Fila, new ItemFila
        {
            Tipo = ItemEra.Id, Param = era, LocalId = f.Id, Hex = f.Hex, Rotulo = e.Nome,
            Custo = Recursos.De(e.Custo), DuracaoSeg = e.Tempo,
        });
    }

    // ---------------------------------------------------------------- armas e armaduras

    /// <summary>Próximo nível da linha (depois do que já está na fila), ou null se já chega ao máximo.</summary>
    public static int? ProximoNivel(Mundo m, Reino r, string familia, string linha)
    {
        var n = Nivel(r, familia, linha) + NaFila(r, familia, linha) + 1;
        return n <= m.P.Ferraria.Niveis.Length ? n : null;
    }

    public static string? MotivoForja(Mundo m, Reino r, string familia, string linha)
    {
        if (!m.P.FerrariaServ.Familias.Contains(familia)) return "Família desconhecida.";
        if (!Linhas.Contains(linha)) return "Escolha armas ou armaduras.";
        if (ProximoNivel(m, r, familia, linha) is not int n) return "Já está no nível máximo.";
        return SemFerraria(m, r) ?? Falta(m, r, m.P.FerrariaServ.Niveis[n - 1]) ?? FilaCheia(r);
    }

    public static string NomeLinha(string familia, string linha, int nivel) =>
        (linha == Armas ? "Armas" : "Armaduras") + " de " + NomesFamilia.GetValueOrDefault(familia, familia) + " nível " + nivel;

    public static ItemFila Forjar(Mundo m, Reino r, string familia, string linha)
    {
        var motivo = MotivoForja(m, r, familia, linha);
        if (motivo != null) throw new RegraException(motivo);
        var n = ProximoNivel(m, r, familia, linha)!.Value;
        var nv = m.P.Ferraria.Niveis[n - 1];
        var f = Principal(m, r)!;
        return Filas.Enfileirar(m, r, Fila, new ItemFila
        {
            Tipo = ItemForja.Id, Param = familia + ":" + linha, NivelAlvo = n, LocalId = f.Id, Hex = f.Hex,
            Rotulo = NomeLinha(familia, linha, n), Custo = Recursos.De(nv.Custo), DuracaoSeg = nv.Tempo,
        });
    }

    // ---------------------------------------------------------------- equipamento lendário

    public static string? MotivoLendario(Mundo m, Reino r)
    {
        if (r.LendariosForjados >= m.P.FerrariaServ.LendarioPorReino)
            return "Cada reino forja " + (m.P.FerrariaServ.LendarioPorReino == 1 ? "um equipamento lendário" : m.P.FerrariaServ.LendarioPorReino + " equipamentos lendários") + " por temporada.";
        return SemFerraria(m, r) ?? Falta(m, r, m.P.FerrariaServ.Lendario) ?? FilaCheia(r);
    }

    public static ItemFila ForjarLendario(Mundo m, Reino r, string tipo)
    {
        if (tipo is not (Ataque or Defesa)) throw new RegraException("Escolha ataque ou defesa.");
        var motivo = MotivoLendario(m, r);
        if (motivo != null) throw new RegraException(motivo);
        var f = Principal(m, r)!;
        var item = Filas.Enfileirar(m, r, Fila, new ItemFila
        {
            Tipo = ItemLendario.Id, Param = tipo, LocalId = f.Id, Hex = f.Hex,
            Rotulo = "Equipamento lendário (" + tipo + ")", Custo = Recursos.De(m.P.Lendario.Custo), DuracaoSeg = m.P.Lendario.Tempo,
        });
        r.LendariosForjados++;
        m.Sujar(r);
        return item;
    }

    public static string NomeLendario(string tipo) => tipo == Ataque ? "Lâmina lendária" : "Armadura lendária";

    internal static void Notificar(Mundo m, Reino r, string titulo, string? texto) =>
        Registros.Notificar(m, r.Id, "obras", titulo, texto, "ferraria");
}

/// <summary>Pesquisa de uma era (Param = chave de P.eras). Ao terminar, a era vale para o reino todo.</summary>
public sealed class ItemEra : ITipoItemFila
{
    public const string Id = "era";
    public string Tipo => Id;
    public void Concluir(Mundo m, Reino r, ItemFila item)
    {
        if (item.Param == null || !m.P.Eras.TryGetValue(item.Param, out var e)) return;
        r.Eras[item.Param] = m.Agora;
        m.Sujar(r);
        Ferrarias.Notificar(m, r, e.Nome + " pesquisada", "Libera: " + e.Libera + ".");
    }
}

/// <summary>Armas ou armaduras de uma família (Param = "familia:linha", NivelAlvo = nível).</summary>
public sealed class ItemForja : ITipoItemFila
{
    public const string Id = "forja";
    public string Tipo => Id;
    public void Concluir(Mundo m, Reino r, ItemFila item)
    {
        if (item.Param == null) return;
        r.Forja[item.Param] = Math.Max(r.Forja.GetValueOrDefault(item.Param), item.NivelAlvo);
        m.Sujar(r);
        Ferrarias.Notificar(m, r, "Forja concluída", item.Rotulo + ": +" + Math.Round(item.NivelAlvo * m.P.Ferraria.BonusNivel * 100) + "% de " +
            Ferrarias.Efeito(item.Param.Split(':').Last()) + ".");
    }
}

/// <summary>Forja do equipamento lendário (Param = "ataque" ou "defesa"). Fica na guarnição da ferraria onde foi forjado.</summary>
public sealed class ItemLendario : ITipoItemFila
{
    public const string Id = "lendario";
    public string Tipo => Id;
    public void Concluir(Mundo m, Reino r, ItemFila item)
    {
        var tipo = item.Param == Ferrarias.Defesa ? Ferrarias.Defesa : Ferrarias.Ataque;
        var l = item.LocalId is long id ? m.Locais.Obter(id) : null;
        if (l == null || l.ReinoId != r.Id || l.Ruina) l = m.Locais.Obter(r.CasteloId);
        if (l == null || l.ReinoId != r.Id) l = m.LocaisDe(r.Id).FirstOrDefault(x => !x.Ruina);
        if (l == null) return;
        var eq = m.Lendarios.Adicionar(new EquipamentoLendario
        {
            DonoId = r.Id, ForjadoPor = r.Id, Tipo = tipo, Nome = Ferrarias.NomeLendario(tipo), ForjadoEm = m.Agora, LocalId = l.Id,
        });
        Ferrarias.Notificar(m, r, eq.Nome + " forjada", "+" + Math.Round(m.P.Lendario.Bonus * 100) + "% de " + tipo + " para a guarnição de " + l.Nome + ".");
    }
    public void Cancelado(Mundo m, Reino r, ItemFila item)
    {
        r.LendariosForjados = Math.Max(0, r.LendariosForjados - 1);
        m.Sujar(r);
    }
}
