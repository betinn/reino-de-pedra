using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Marchas;

/// <summary>
/// Caça: o exército vai até um bando de fauna conhecido e luta com ele (força do grupo × força do bando, a regra das
/// perdas da fauna: com o dobro passa ileso, acima do limite perde 5%, abaixo 25%). Se sobra alguém, fica
/// <c>P.cacaMin</c> no local, traz o rendimento do bando (<c>P.caca</c>) como carga e volta; o bando reaparece em 24 h.
/// Caça não conta para a veterania (não passa pelo combate).
/// </summary>
public sealed class OrdemCacar : IOrdemExercito
{
    public const string Id = "cacar";
    public string Ordem => Id;

    public void Validar(Mundo m, Reino r, Exercito ex, int destino)
    {
        var rg = Caca.RegiaoConhecida(m, r, destino) ?? throw new RegraException("Não há fauna conhecida aqui.");
        ex.Dados["regiao"] = rg.Id;
    }

    public void Chegou(Mundo m, Exercito ex)
    {
        var rid = Fauna.RegiaoDaCaca(ex);
        var rg = rid is long id ? m.Faunas.Obter(id) : null;
        var hex = ex.Destino;
        if (rg == null || rg.Abatido || m.G.Distancia(rg.Centro, hex) > rg.Raio)
        {
            Registros.Relatar(m, ex.ReinoId, "caca", "Caçada sem presa", new JsonObject
            {
                ["resumo"] = "Os caçadores não acharam o bando: ele já tinha sido abatido ou saiu da área. Não trouxeram nada e voltam.", ["hex"] = hex,
                ["linhas"] = new JsonArray { (JsonNode?)Fauna.Linha("Trazem", "nada (o bando sumiu)") }, ["ganho"] = Capturas.Json(new Recursos()),
            }, "exploracao");
            ex.Retornar(m);
            return;
        }
        Caca.Lutar(m, ex, rg);
    }
}

/// <summary>Caçada. Nova ordem durante os minutos no local cancela a caçada (o grupo sai sem a presa).</summary>
public static class Caca
{
    /// <summary>Região de fauna viva que o reino conhece no hexágono (o bando à vista ou o perigo na foto da névoa).</summary>
    public static RegiaoFauna? RegiaoConhecida(Mundo m, Reino r, int hex)
    {
        if (!m.G.Valido(hex)) return null;
        var vis = Nevoas.VisiveisAgora(m, r.Id);
        foreach (var rg in Fauna.RegioesEm(m, hex))
        {
            if (rg.Abatido) continue;
            if (vis.Contains(rg.Hex) && rg.Hex == hex) return rg;
        }
        if (Fotos.PerigoConhecido(m, r.Id, hex) == 0) return null;
        var animal = Fotos.AnimalConhecido(m, r.Id, hex);
        return Fauna.RegioesEm(m, hex).Where(x => !x.Abatido).OrderByDescending(x => x.Animal == animal).ThenBy(x => m.G.Distancia(x.Centro, hex)).FirstOrDefault();
    }

    /// <summary>Luta com o bando. Se sobra alguém, a caçada termina em <c>P.cacaMin</c> e o bando é abatido.</summary>
    public static void Lutar(Mundo m, Exercito ex, RegiaoFauna rg)
    {
        var nivel = Fauna.NomeDe(Math.Max(1, Fauna.NivelEm(m, rg, rg.Hex)))!;
        var forca = ex.ForcaContraFauna(m);
        var limite = m.P.Fauna[nivel];
        var perda = forca >= 2 * limite ? 0 : forca >= limite ? m.P.PerdaFauna.Acima : m.P.PerdaFauna.Abaixo;
        var mortos = new Dictionary<string, int>();
        if (perda > 0) mortos = ex.SofrerFauna(m, perda).Mortos;
        var animal = Fauna.NomeAnimal.GetValueOrDefault(rg.Animal, rg.Animal).ToLowerInvariant();
        if (GT.Total(ex.Tropas) == 0)
        {
            Registros.Relatar(m, ex.ReinoId, "caca", "Caçada perdida", new JsonObject
            {
                ["resumo"] = "Os " + animal + " venceram o grupo de caça: ninguém sobrou e nada foi trazido. Tropas mortas não voltam.", ["hex"] = ex.Destino,
                ["linhas"] = new JsonArray { (JsonNode?)Fauna.Linha("Baixas", GT.Partes(m, mortos)), (JsonNode?)Fauna.Linha("Trazem", "nada (o grupo perdeu a luta)"), (JsonNode?)Fauna.Linha("Força do grupo", Math.Round(forca) + " de " + 2 * limite) },
                ["ganho"] = Capturas.Json(new Recursos()),
            }, "exploracao");
            ex.Encerrar(m);
            return;
        }
        ex.Parar(m);
        ex.Dados["mortos"] = Grupo(mortos);
        ex.Dados["cacaAte"] = m.Agora + T.DeHoras(m.P.CacaMin / 60);
        m.Agendar(new FimCacaEvento { MarchaId = ex.Id, RegiaoId = rg.Id, Hex = ex.Destino, Quando = m.Agora + T.DeHoras(m.P.CacaMin / 60) });
        Fauna.Abater(m, rg);
        m.Sujar(ex);
        m.Avisar(ex.ReinoId, "mapa");
    }

    private static JsonObject Grupo(Dictionary<string, int> g)
    {
        var o = new JsonObject();
        foreach (var (k, v) in g) o[k] = v;
        return o;
    }

    /// <summary>Fim da caçada: o rendimento do bando entra na carga (até a capacidade) e o grupo volta.</summary>
    public static void Terminar(Mundo m, Exercito ex, RegiaoFauna rg)
    {
        var rend = m.P.Caca.TryGetValue(rg.Animal, out var c) ? c : new CacaP();
        var ganho = new Recursos();
        if (rend.Comida > 0) ganho.Somar("comida", rend.Comida);
        if (rend.Couro > 0) ganho.Somar("couro", rend.Couro);
        if (rend.Peles > 0) ganho.Somar("peles", rend.Peles);
        var livre = Math.Max(0, ex.CargaMax(m) - ex.Carga.Total);
        var f = ganho.Total > 0 ? Math.Min(1, livre / ganho.Total) : 0;
        var levado = new Recursos();
        foreach (var (k, v) in ganho) { var q = Math.Floor(v * f); if (q > 0) { levado.Somar(k, q); ex.Carga.Somar(k, q); } }
        var animal = Fauna.NomeAnimal.GetValueOrDefault(rg.Animal, rg.Animal);
        var mortos = ex.Dados["mortos"] as JsonObject;
        var linhas = new JsonArray
        {
            (JsonNode?)Fauna.Linha("Presa", animal + " (≈ " + rg.Qtd + ")"),
            (JsonNode?)Fauna.Linha("Trazem", levado.Count > 0 ? string.Join(", ", levado.Arredondado().Select(kv => kv.Value + " " + kv.Key)) : "nada (sem carga livre)"),
            (JsonNode?)Fauna.Linha("Baixas", mortos is { Count: > 0 } ? string.Join(", ", mortos.Select(kv => kv.Value + " " + kv.Key)) : "nenhuma"),
        };
        if (f < 1) linhas.Add((JsonNode?)Fauna.Linha("Carga", "o grupo só levou o que cabia"));
        ex.Dados.Remove("mortos"); ex.Dados.Remove("cacaAte"); ex.Dados.Remove("regiao");
        var trouxe = levado.Count > 0
            ? "O grupo traz " + string.Join(", ", levado.Arredondado().Select(kv => kv.Value + " " + Logistica.NomeRecurso(kv.Key))) + "."
            : "O grupo não trouxe nada: não havia carga livre.";
        Registros.Relatar(m, ex.ReinoId, "caca", "Caçada: " + animal.ToLowerInvariant(), new JsonObject
        {
            ["resumo"] = "Bando abatido. " + trouxe + " Ele volta à região em " + m.P.FaunaVoltaH + " h.", ["linhas"] = linhas, ["hex"] = ex.Destino,
            ["ganho"] = Capturas.Json(levado),
        }, "exploracao");
        ex.Retornar(m);
    }
}

public sealed class FimCacaEvento : Evento
{
    public long MarchaId { get; set; }
    public long RegiaoId { get; set; }
    public int Hex { get; set; }
    public override void Executar(Mundo m)
    {
        if (m.Marchas.Obter(MarchaId) is not Exercito ex || ex.Ordem != OrdemCacar.Id || !ex.Parado || ex.HexEm(m.Agora) != Hex) return;
        if (m.Faunas.Obter(RegiaoId) is not { } rg) return;
        Caca.Terminar(m, ex, rg);
    }
}
