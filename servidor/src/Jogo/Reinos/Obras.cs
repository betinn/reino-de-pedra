using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Mapa;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Jogo.Reinos;

/// <summary>Obras do reino: subir nível de local e do castelo, moradias e fundação de locais.</summary>
public static class Obras
{
    public const string Fila = "obras";

    private static int NivelAlvo(Reino r, Local l) =>
        l.Nivel + r.Fila(Fila).Itens.Count(i => i.Tipo == ObraNivel.Id && i.LocalId == l.Id) + 1;

    public static ItemFila Melhorar(Mundo m, Reino r, long localId)
    {
        var l = m.Locais.Obter(localId);
        if (l == null || l.ReinoId != r.Id) throw new RegraException("Local não é seu.", 404);
        if (l.Ruina) throw new RegraException("O local está em ruínas.");
        var castelo = l.Tipo == TipoLocal.Castelo;
        var alvo = NivelAlvo(r, l);
        if (alvo > m.P.NivelMax) throw new RegraException("O local já está no nível máximo.");
        var c = m.Locais.Obter(r.CasteloId);
        if (!castelo && c != null && alvo > c.Nivel)
            throw new RegraException("Nenhum local passa do nível do castelo. Melhore o castelo primeiro.");
        return Filas.Enfileirar(m, r, Fila, new ItemFila
        {
            Tipo = ObraNivel.Id, LocalId = l.Id, Hex = l.Hex, NivelAlvo = alvo,
            Rotulo = $"{l.Nome} nível {alvo}",
            Custo = Recursos.De(m.F.CustoNivel(alvo, castelo)),
            DuracaoSeg = m.F.TempoNivel(alvo, castelo),
        });
    }

    public static ItemFila Moradia(Mundo m, Reino r, long localId)
    {
        var l = m.Locais.Obter(localId);
        if (l == null || l.ReinoId != r.Id) throw new RegraException("Local não é seu.", 404);
        if (l.Tipo is not (TipoLocal.Castelo or TipoLocal.Vila)) throw new RegraException("Moradias ficam no castelo ou numa vila.");
        var n = Economia.Moradias(m, r) + r.Fila(Fila).Itens.Count(i => i.Tipo == ObraMoradia.Id);
        return Filas.Enfileirar(m, r, Fila, new ItemFila
        {
            Tipo = ObraMoradia.Id, LocalId = l.Id, Hex = l.Hex, Rotulo = $"Moradia em {l.Nome}",
            Custo = Recursos.De(m.F.Receita(m.F.CustoMoradia(n))),
            DuracaoSeg = m.F.TempoMoradia(n),
        });
    }

    /// <summary>Tipos de local que o jogador pode fundar, o recurso que produzem e onde podem ficar.</summary>
    public static readonly Dictionary<string, (TipoLocal tipo, string? produz, Terreno[] terrenos)> Fundaveis = new()
    {
        ["vila"] = (TipoLocal.Vila, "comida", [Terreno.Planicie]),
        ["pasto"] = (TipoLocal.Pasto, "comida", [Terreno.Planicie]),
        ["serraria"] = (TipoLocal.Serraria, "madeira", [Terreno.Floresta]),
        ["pedreira"] = (TipoLocal.Mina, "pedra", [Terreno.Colina, Terreno.Montanha]),
        ["mina"] = (TipoLocal.Mina, "ferro", [Terreno.Colina, Terreno.Montanha]),
        ["quartel"] = (TipoLocal.Quartel, null, [Terreno.Planicie, Terreno.Colina]),
        ["armazem"] = (TipoLocal.Armazem, null, [Terreno.Planicie, Terreno.Colina]),
        ["ferraria"] = (TipoLocal.Ferraria, null, [Terreno.Planicie, Terreno.Colina]),
    };

    /// <summary>Motivo para não fundar aqui, ou null se pode.</summary>
    public static string? MotivoNaoFundar(Mundo m, Reino r, string tipo, int hex)
    {
        if (!Fundaveis.TryGetValue(tipo, out var f)) return "Tipo de local desconhecido.";
        if (!m.G.Valido(hex)) return "Hexágono fora do mapa.";
        if (!Nevoas.Explorado(m, r.Id, hex)) return "Explore a área antes de fundar.";
        if (m.Mapa.Rio[hex]) return "Não dá para fundar sobre o rio.";
        if (!f.terrenos.Contains(m.Mapa.Terrenos[hex])) return "Este terreno não serve para esse local.";
        if (!HexLivrePara(m, r, hex)) return "O hexágono não está livre.";
        if (r.Fila(Fila).Itens.Any(i => i.Tipo == ObraFundar.Id && i.Hex == hex)) return "Já há uma fundação na fila para este hexágono.";
        return null;
    }

    /// <summary>Ganchos de outros sistemas que ocupam hexágonos (torres, jazidas, ruínas...).</summary>
    public static List<Func<Mundo, int, bool>> HexOcupado { get; } = new();

    public static bool HexLivre(Mundo m, int hex) =>
        m.LocalNoHex(hex) == null && !m.Ruinas.Any(x => x.Hex == hex) && !m.Jazidas.Any(j => j.Hex == hex)
        && !HexOcupado.Any(f => f(m, hex));

    /// <summary>Objetos próprios do reino que ocupam o hexágono (torres...): (mundo, reino, hexágono) → ocupado.</summary>
    public static List<Func<Mundo, Reino, int, bool>> HexOcupadoPara { get; } = new();
    private static readonly HashSet<string> OcupamNaFoto = ["local", "ruina-antiga", "torre"];

    /// <summary>
    /// Livre pelo que o reino sabe (motivo de fundar e de erguer torre): os próprios locais e objetos, o que a foto da névoa
    /// guarda e as jazidas que ele descobriu. Jazida oculta não ocupa; o resto se resolve na conclusão da obra.
    /// </summary>
    public static bool HexLivrePara(Mundo m, Reino r, int hex)
    {
        if (m.LocalNoHex(hex) is { } l && l.ReinoId == r.Id) return false;
        if (m.Jazidas.Any(j => j.Hex == hex && j.DescobertaPor.Contains(r.Id))) return false;
        if (Fotos.De(m, r.Id).Objetos.TryGetValue(hex, out var objs) && objs.Any(o => o["tipo"]?.GetValue<string>() is { } k && OcupamNaFoto.Contains(k))) return false;
        return !HexOcupadoPara.Any(f => f(m, r, hex));
    }

    /// <summary>Na conclusão da obra: o estado real, sem contar jazidas que o reino não descobriu (a obra fica sobre ela, que segue oculta).</summary>
    public static bool HexLivreParaObra(Mundo m, Reino r, int hex) =>
        m.LocalNoHex(hex) == null && !m.Ruinas.Any(x => x.Hex == hex) && !m.Jazidas.Any(j => j.Hex == hex && j.DescobertaPor.Contains(r.Id))
        && !HexOcupado.Any(f => f(m, hex));

    public static ItemFila Fundar(Mundo m, Reino r, string tipo, int hex)
    {
        var motivo = MotivoNaoFundar(m, r, tipo, hex);
        if (motivo != null) throw new RegraException(motivo);
        var n = r.Fundados + r.Fila(Fila).Itens.Count(i => i.Tipo == ObraFundar.Id);
        return Filas.Enfileirar(m, r, Fila, new ItemFila
        {
            Tipo = ObraFundar.Id, Hex = hex, Param = tipo,
            Rotulo = $"Fundar {Fundaveis[tipo].tipo.NomeGenerico().ToLowerInvariant()}",
            Custo = Recursos.De(m.F.CustoNovoLocal(n)),
            DuracaoSeg = m.P.TempoNovoLocal,
        });
    }

    private static readonly string[] Sufixos =
        ["do Vale", "da Ponte", "Alta", "Velha", "do Bosque", "do Norte", "do Sul", "do Moinho", "do Vau", "da Colina",
         "Nova", "do Poente", "do Nascente", "da Pedra", "do Rio", "das Éguas", "do Corvo", "da Fonte", "do Carvalho", "da Serra"];

    public static string NomeNovo(Mundo m, Reino r, TipoLocal tipo, string? produz)
    {
        var baseNome = tipo switch
        {
            TipoLocal.Mina => produz == "pedra" ? "Pedreira" : "Mina",
            TipoLocal.Quartel => "Quartel",
            _ => tipo.NomeGenerico(),
        };
        var usados = m.LocaisDe(r.Id).Select(l => l.Nome).ToHashSet();
        foreach (var s in Sufixos)
        {
            var n = baseNome + " " + s;
            if (!usados.Contains(n)) return n;
        }
        return baseNome + " " + (usados.Count + 1);
    }
}

public sealed class ObraNivel : ITipoItemFila
{
    public const string Id = "nivel";
    public string Tipo => Id;
    /// <summary>
    /// Sobe um nível (no máximo até o alvo): um item na fila não devolve os níveis tirados por uma sabotagem. Nenhum local
    /// passa do castelo: se o castelo caiu abaixo do novo nível (sabotagem), o local não sobe e o material fica nele.
    /// Se o local não é mais do reino, o material volta ao castelo.
    /// </summary>
    public void Concluir(Mundo m, Reino r, ItemFila item)
    {
        var l = item.LocalId is long id ? m.Locais.Obter(id) : null;
        if (l == null || l.ReinoId != r.Id || l.Ruina)
        {
            Filas.DevolverMaterial(m, r, item, null);
            Registros.Notificar(m, r.Id, "obras", "Obra perdida", item.Rotulo + ": o local não é mais seu. O material voltou ao castelo.", "reino");
            return;
        }
        var alvo = Math.Min(item.NivelAlvo, l.Nivel + 1);
        var castelo = m.Locais.Obter(r.CasteloId);
        if (l.Tipo != TipoLocal.Castelo && castelo != null && alvo > castelo.Nivel)
        {
            Filas.DevolverMaterial(m, r, item, l);
            Registros.Notificar(m, r.Id, "obras", "Obra parada", item.Rotulo + ": nenhum local passa do nível do castelo. O material ficou no local.", "reino");
            return;
        }
        l.Nivel = Math.Max(l.Nivel, alvo);
        m.Sujar(l);
        Pessoas.Pessoas.PreencherVagas(m, r);   // o nível novo abre vagas: ociosos vêm trabalhar
    }
}

public sealed class ObraMoradia : ITipoItemFila
{
    public const string Id = "moradia";
    public string Tipo => Id;
    public void Concluir(Mundo m, Reino r, ItemFila item)
    {
        var l = item.LocalId is long id ? m.Locais.Obter(id) : null;
        if (l == null || l.ReinoId != r.Id) l = m.Locais.Obter(r.CasteloId);
        if (l == null) return;
        l.Moradias++;
        m.Sujar(l);
    }
}

public sealed class ObraFundar : ITipoItemFila
{
    public const string Id = "fundar";
    public string Tipo => Id;
    public void Concluir(Mundo m, Reino r, ItemFila item)
    {
        var (tipo, produz, _) = Obras.Fundaveis[item.Param!];
        if (!Obras.HexLivreParaObra(m, r, item.Hex))
        {
            // alguém ocupou o hexágono antes: o material volta ao castelo
            var c = m.Locais.Obter(r.CasteloId);
            if (c != null) { c.Estoque.Somar(item.Entregue); m.Sujar(c); }
            return;
        }
        var l = m.AdicionarLocal(new Local
        {
            ReinoId = r.Id, Tipo = tipo, Produz = produz, Nivel = 1, Hex = item.Hex,
            Nome = Obras.NomeNovo(m, r, tipo, produz),
        });
        r.Fundados++;
        Nevoas.RevelarArea(m, r.Id, l.Hex, m.P.Visao.Local);
        Pessoas.Pessoas.PreencherVagas(m, r);
        AoFundar?.Invoke(m, r, l);
    }
    public static event Action<Mundo, Reino, Local>? AoFundar;
}
