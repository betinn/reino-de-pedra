using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Combate;

/// <summary>Um objetivo do ataque: K = "reliquia", "recurso" (R = recurso), "construcao", "torre", "portoes", "populacao", "tomar".</summary>
public sealed record Objetivo(string K, string? R, double Q)
{
    public string Chave => K + (R != null ? ":" + R : "");
}

/// <summary>
/// Plano de um ataque: tipo, objetivos em ordem de prioridade, tática, completar a carga e estandarte.
/// Vive em <c>Exercito.Dados</c> (normalizado pelo servidor ao dar a ordem).
/// </summary>
public sealed class PlanoAtaque
{
    public string Tipo { get; set; } = Ataques.Saque;
    public List<Objetivo> Objetivos { get; set; } = new();
    public string Tatica { get; set; } = "";
    public bool Completar { get; set; }
    public bool Estandarte { get; set; }

    public static PlanoAtaque Ler(JsonObject? d)
    {
        var p = new PlanoAtaque();
        if (d == null) return p;
        p.Tipo = Str(d["tipo"]) ?? "";   // sem tipo: o Normalizar usa o padrão do alvo (ocupação para ruína)
        p.Tatica = Str(d["tatica"]) ?? "";
        p.Completar = Bool(d["completar"]);
        p.Estandarte = Bool(d["estandarte"]);
        if (d["objetivos"] is JsonArray arr)
            foreach (var x in arr.OfType<JsonObject>())
            {
                var k = Str(x["k"]); if (k == null) continue;
                double q = 0;
                try { q = x["q"]?.GetValue<double>() ?? 0; } catch { q = 0; }
                p.Objetivos.Add(new Objetivo(k, Str(x["r"]), q));
            }
        return p;
    }

    public JsonObject ParaJson()
    {
        var arr = new JsonArray();
        foreach (var o in Objetivos)
        {
            var j = new JsonObject { ["k"] = o.K };
            if (o.R != null) j["r"] = o.R;
            if (o.Q > 0) j["q"] = o.Q;
            arr.Add(j);
        }
        return new JsonObject { ["tipo"] = Tipo, ["objetivos"] = arr, ["tatica"] = Tatica, ["completar"] = Completar, ["estandarte"] = Estandarte };
    }

    private static string? Str(JsonNode? n) { try { return n?.GetValue<string>(); } catch { return null; } }
    private static bool Bool(JsonNode? n) { try { return n?.GetValue<bool>() ?? false; } catch { return false; } }
}

/// <summary>Regras do envio de ataque: alvos, tipos, objetivos por tipo, tática, saque decrescente e prévia.</summary>
public static class Ataques
{
    public const string Saque = "saque", Sabotagem = "sabotagem", Massacre = "massacre", Ocupacao = "ocupacao", Cerco = "cerco";
    public static readonly string[] Tipos = [Saque, Sabotagem, Massacre, Ocupacao, Cerco];

    public static readonly Dictionary<string, string> NomesTipo = new()
    {
        [Saque] = "Saque", [Sabotagem] = "Sabotagem", [Massacre] = "Massacre", [Ocupacao] = "Ocupação", [Cerco] = "Cerco",
    };

    /// <summary>Objetivos válidos por tipo (CLAUDE.md, Tipos de ataque).</summary>
    public static readonly Dictionary<string, string[]> ObjetivosPorTipo = new()
    {
        [Saque] = ["reliquia", "recurso"],
        [Sabotagem] = ["construcao", "torre"],
        [Massacre] = ["populacao"],
        [Ocupacao] = ["tomar", "reliquia"],
        [Cerco] = ["portoes", "torre", "reliquia", "recurso"],
    };

    /// <summary>Tipos que levam carga (recursos) de volta.</summary>
    public static bool LevaCarga(string tipo) => tipo is Saque or Cerco;

    /// <summary>Local é alvo sem dono (ruína ou terra livre): só pode ser ocupado.</summary>
    public static bool SemDono(Mundo m, Local l) => l.Ruina || l.ReinoId == 0 || m.Reinos.Obter(l.ReinoId) is not { Ativo: true };

    /// <summary>Tipos de ataque possíveis contra o local.</summary>
    public static List<string> TiposPara(Mundo m, Local l)
    {
        if (SemDono(m, l)) return [Ocupacao];
        return l.Tipo == TipoLocal.Castelo ? [Saque, Sabotagem, Massacre, Cerco] : [Saque, Sabotagem, Massacre, Ocupacao];
    }

    public static string TipoPadrao(Mundo m, Local l) => SemDono(m, l) ? Ocupacao : Saque;

    /// <summary>Limite de baixas da tática (null = sem limite).</summary>
    public static double? Limite(Mundo m, string tatica) =>
        m.P.Combate.Taticas.TryGetValue(tatica, out var v) ? v : throw new RegraException("Tática desconhecida.");

    /// <summary>Recursos que se pode pedir num saque (os de P.valor).</summary>
    public static bool RecursoValido(Mundo m, string? r) => r != null && m.P.Valor.ContainsKey(r);

    /// <summary>Objetivos automáticos (ataque rápido): a relíquia à vista e o recurso principal do local.</summary>
    public static (List<Objetivo> objetivos, bool completar) Padrao(Mundo m, string tipo, Local l, double carga)
    {
        var op = m.P.Combate.ObjPadrao;
        return tipo switch
        {
            Saque => l.Produz != null ? ([new("reliquia", null, 0), new("recurso", l.Produz, Math.Max(1, carga))], false) : ([new("reliquia", null, 0)], true),
            Sabotagem => ([new("construcao", null, op["construcao"]), new("torre", null, op["torre"])], false),
            Massacre => ([new("populacao", null, op["populacao"])], false),
            Ocupacao => ([new("tomar", null, 0), new("reliquia", null, 0)], false),
            _ => ([new("portoes", null, op["portoes"]), new("reliquia", null, 0)], true),
        };
    }

    /// <summary>Catálogo de objetivos que podem ser acrescentados ao tipo (com a quantidade padrão).</summary>
    public static List<Objetivo> Catalogo(Mundo m, string tipo, double carga)
    {
        var op = m.P.Combate.ObjPadrao;
        var c = new List<Objetivo>();
        foreach (var k in ObjetivosPorTipo[tipo])
        {
            if (k == "recurso") foreach (var r in Config.Formulas.Basicos.Concat(["couro", "peles"])) c.Add(new("recurso", r, Math.Max(1, carga)));
            else if (k is "reliquia" or "tomar") c.Add(new(k, null, 0));
            else c.Add(new(k, null, op.GetValueOrDefault(k, 1)));
        }
        return c;
    }

    /// <summary>
    /// Valida e completa o plano contra o alvo e as tropas: tipo permitido, objetivos do tipo (sem repetir, quantidades válidas),
    /// "tomar" primeiro na ocupação, tática conhecida. Sem objetivos, usa os automáticos. Lança <see cref="RegraException"/>.
    /// </summary>
    public static PlanoAtaque Normalizar(Mundo m, Local alvo, IReadOnlyDictionary<string, int> tropas, PlanoAtaque p)
    {
        var tipos = TiposPara(m, alvo);
        if (string.IsNullOrEmpty(p.Tipo)) p.Tipo = TipoPadrao(m, alvo);
        if (!Tipos.Contains(p.Tipo)) throw new RegraException("Tipo de ataque desconhecido.");
        if (!tipos.Contains(p.Tipo))
            throw new RegraException(p.Tipo == Cerco ? "Cerco só contra um castelo."
                : SemDono(m, alvo) ? "Este local não tem dono: só pode ser ocupado."
                : p.Tipo == Ocupacao ? "Para tomar um castelo, use o cerco." : "Este ataque não serve para este local.");
        if (string.IsNullOrEmpty(p.Tatica)) p.Tatica = m.P.Combate.TaticaPadrao;
        Limite(m, p.Tatica);
        var carga = GT.Carga(m, tropas);
        var validos = ObjetivosPorTipo[p.Tipo];
        var lista = new List<Objetivo>();
        var vistos = new HashSet<string>();
        foreach (var o0 in p.Objetivos)
        {
            var o = o0;
            if (o.K == "recurso" && o.R == "auto")   // modelos de ataque: o recurso principal do alvo
            {
                if (alvo.Produz == null) continue;
                o = o with { R = alvo.Produz };
            }
            if (!validos.Contains(o.K)) throw new RegraException("Objetivo que não cabe neste tipo de ataque.");
            Objetivo n = o.K switch
            {
                "recurso" => RecursoValido(m, o.R) && o.Q >= 1 ? new(o.K, o.R, Math.Min(o.Q, 1e7)) : throw new RegraException("Recurso ou quantidade inválida."),
                "reliquia" or "tomar" => new(o.K, null, 0),
                "construcao" => new(o.K, null, Math.Clamp(Math.Floor(o.Q < 1 ? 1 : o.Q), 1, m.P.Combate.SabotagemMaxNiveis)),
                "portoes" => new(o.K, null, Math.Clamp(Math.Floor(o.Q < 1 ? 1 : o.Q), 1, Defesas.PortoesMax(m))),
                "torre" => new(o.K, null, Math.Clamp(Math.Floor(o.Q < 1 ? 1 : o.Q), 1, 1e4)),
                _ => new(o.K, null, Math.Clamp(Math.Floor(o.Q < 1 ? 1 : o.Q), 1, 1e7)),
            };
            if (vistos.Add(n.Chave)) lista.Add(n);
        }
        if (lista.Count == 0)
        {
            var (obj, comp) = Padrao(m, p.Tipo, alvo, carga);
            lista = obj; p.Completar = p.Completar || comp;
        }
        if (p.Tipo == Ocupacao)
        {
            lista.RemoveAll(o => o.K == "tomar");
            lista.Insert(0, new Objetivo("tomar", null, 0));
        }
        if (!LevaCarga(p.Tipo)) p.Completar = false;
        p.Objetivos = lista;
        return p;
    }

    /// <summary>Confere as tropas de um ataque: milícia só defende.</summary>
    public static void ValidarTropas(Mundo m, IReadOnlyDictionary<string, int> tropas)
    {
        foreach (var (k, n) in tropas)
            if (n > 0 && m.B.U.TryGetValue(k, out var u) && u.So == "defesa")
                throw new RegraException(u.Nome + " só defende: tire-a do ataque.");
    }

    /// <summary>Alvo de um ataque no hexágono, ou erro.</summary>
    public static Local Alvo(Mundo m, Reino r, int hex)
    {
        var l = m.LocalNoHex(hex) ?? throw new RegraException("Não há local neste hexágono para atacar.");
        if (l.ReinoId == r.Id && !l.Ruina) throw new RegraException("Esse local é seu.");
        return l;
    }

    // ---------------------------------------------------------------- saque decrescente

    /// <summary>Saques vitoriosos do reino a este local na janela (P.combate.saqueJanelaH).</summary>
    public static int SaquesRecentes(Mundo m, Reino r, long localId)
    {
        var desde = m.Agora - T.DeHoras(m.P.Combate.SaqueJanelaH);
        return r.Saques.Count(s => s.LocalId == localId && s.Quando > desde);
    }

    /// <summary>Rendimento do próximo saque: −P.saqueQueda por saque recente, até P.saqueMinimo.</summary>
    public static double Rendimento(Mundo m, int recentes) => Math.Max(m.P.SaqueMinimo, 1 - m.P.SaqueQueda * recentes);

    public static void RegistrarSaque(Mundo m, Reino r, long localId)
    {
        var desde = m.Agora - T.DeHoras(m.P.Combate.SaqueJanelaH);
        r.Saques.RemoveAll(s => s.Quando <= desde);
        r.Saques.Add(new RegistroSaque { LocalId = localId, Quando = m.Agora });
        m.Sujar(r);
    }

    // ---------------------------------------------------------------- textos

    public static string NomeAlvo(Local l) => l.Ruina ? "Ruína" : l.ReinoId == 0 ? "Terra livre" : l.Tipo.NomeGenerico();

    public static string TextoObjetivo(Mundo m, Objetivo o, Local? alvo)
    {
        static string N(double q) => Combates.Num(q);
        return o.K switch
        {
            "reliquia" => "Relíquia",
            "recurso" => N(o.Q) + " de " + Logistica.NomeRecurso(o.R ?? ""),
            "torre" => "Derrubar " + N(o.Q) + (o.Q > 1 ? " torres" : " torre"),
            "portoes" => "Portões −" + N(o.Q) + (o.Q > 1 ? " níveis" : " nível"),
            "construcao" => (alvo != null ? NomeAlvo(alvo) : "Construção") + " −" + N(o.Q) + (o.Q > 1 ? " níveis" : " nível"),
            "populacao" => N(o.Q) + " de população",
            "tomar" => "Tomar o local",
            _ => o.K,
        };
    }

    /// <summary>"Quando param": frases curtas com as condições de parada do plano.</summary>
    public static List<string> QuandoParam(Mundo m, PlanoAtaque p, double carga)
    {
        var l = new List<string>();
        var limite = Limite(m, p.Tatica);
        l.Add(p.Tipo == Ocupacao ? "Ao tomar o local, ficam nele como guarnição."
            : "Ao cumprir os objetivos" + (LevaCarga(p.Tipo) && p.Completar ? " e completar a carga com o que houver" : "") + ", voltam.");
        if (LevaCarga(p.Tipo) && (p.Completar || p.Objetivos.Any(o => o.K == "recurso")))
            l.Add("Se a carga encher antes (" + Combates.Num(carga) + "), voltam.");
        l.Add(limite is double x ? "Se tiverem " + Math.Round(x * 100) + "% de baixas, recuam com o que já pegaram." : "Não recuam por baixas: lutam até cumprir ou cair.");
        return l;
    }
}

/// <summary>
/// Ordem "atacar": vai até um local de outro reino (ou sem dono, para ocupar) e ataca ao chegar. O plano (tipo, objetivos,
/// tática, completar a carga, estandarte) vem em Dados e é normalizado aqui. Bloqueios conhecidos (aliança, pacto, trégua)
/// recusam antes de enviar; o escudo só é descoberto ao chegar.
/// </summary>
public sealed class OrdemAtacar : IOrdemExercito
{
    public const string Id = "atacar";
    public string Ordem => Id;
    public void Validar(Mundo m, Reino r, Exercito ex, int destino) => Preparar(m, r, ex, destino, null);
    public void Chegou(Mundo m, Exercito ex) => Batalhas.Chegou(m, ex);

    /// <summary>Validação comum às ordens de ataque; <paramref name="tipoFixo"/> força o tipo (ocupação).</summary>
    internal static void Preparar(Mundo m, Reino r, Exercito ex, int destino, string? tipoFixo)
    {
        Ataques.ValidarTropas(m, ex.Tropas);
        var alvo = Ataques.Alvo(m, r, destino);
        if (!Ataques.SemDono(m, alvo))
        {
            var dono = m.Reinos.Obter(alvo.ReinoId)!;
            var motivo = Permissoes.MotivoEnvio(m, r, dono);
            if (motivo != null) throw new RegraException(motivo);
        }
        var plano = PlanoAtaque.Ler(ex.Dados);
        if (tipoFixo != null) plano.Tipo = tipoFixo;
        plano = Ataques.Normalizar(m, alvo, ex.Tropas, plano);
        ex.Dados = plano.ParaJson();
        ex.AlvoLocalId = alvo.Id;
        ex.Estandarte = plano.Estandarte;
    }
}

/// <summary>Ordem "ocupar": ataque de ocupação (o mesmo de "atacar" com tipo ocupação). Ruínas e terra livre só aceitam esta.</summary>
public sealed class OrdemOcupar : IOrdemExercito
{
    public const string Id = "ocupar";
    public string Ordem => Id;
    public void Validar(Mundo m, Reino r, Exercito ex, int destino) => OrdemAtacar.Preparar(m, r, ex, destino, Ataques.Ocupacao);
    public void Chegou(Mundo m, Exercito ex) => Batalhas.Chegou(m, ex);
}
