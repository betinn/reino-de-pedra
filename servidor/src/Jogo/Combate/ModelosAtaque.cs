using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Combate
{
    /// <summary>
    /// Envio de ataque pronto: tipo, tropas, objetivos e tática, sem alvo. Um recurso "auto" nos objetivos vira o
    /// recurso principal do alvo. O último ataque enviado também fica guardado (com alvo e local de saída) para "Repetir".
    /// </summary>
    public sealed class ModeloAtaque
    {
        public long Id { get; set; }
        public string Nome { get; set; } = "";
        public string Tipo { get; set; } = Ataques.Saque;
        public string Tatica { get; set; } = "";
        public bool Completar { get; set; }
        public string Divisao { get; set; } = Ataques.DivisaoPrioridade;
        public bool RecuarVazio { get; set; } = true;
        public Dictionary<string, int> Tropas { get; set; } = new();
        public List<Objetivo> Objetivos { get; set; } = new();
        /// <summary>Só no último ataque: alvo e de onde saiu.</summary>
        public int? AlvoHex { get; set; }
        public long? DeLocalId { get; set; }
        public long Quando { get; set; }
    }

    /// <summary>Modelos de ataque do reino (até P.guerra.modelosMax) e o último ataque enviado.</summary>
    public static class ModelosAtaque
    {
        public static ModeloAtaque Salvar(Mundo m, Reino r, string? nome, string? tipo, string? tatica, bool completar,
            IReadOnlyDictionary<string, int>? tropas, IEnumerable<Objetivo>? objetivos, string? divisao = null, bool recuarVazio = true)
        {
            var g = m.P.Guerra;
            if (r.ModelosAtaque.Count >= g.ModelosMax) throw new RegraException("Você já tem " + g.ModelosMax + " modelos. Apague um antes.");
            nome = (nome ?? "").Trim();
            if (nome.Length == 0) nome = "Meu modelo " + (r.ModelosAtaque.Count + 1);
            if (nome.Length > g.ModeloNome) throw new RegraException("O nome do modelo tem até " + g.ModeloNome + " letras.");
            tipo = string.IsNullOrEmpty(tipo) ? Ataques.Saque : tipo;
            if (!Ataques.Tipos.Contains(tipo)) throw new RegraException("Tipo de ataque desconhecido.");
            tatica = string.IsNullOrEmpty(tatica) ? m.P.Combate.TaticaPadrao : tatica;
            Ataques.Limite(m, tatica);
            var grupo = GT.Limpo(tropas);
            if (grupo.Keys.Any(k => !m.B.U.ContainsKey(k))) throw new RegraException("Unidade desconhecida.");
            Ataques.ValidarTropas(m, grupo);
            var objs = new List<Objetivo>();
            foreach (var o in objetivos ?? [])
            {
                if (!Ataques.ObjetivosPorTipo[tipo].Contains(o.K)) throw new RegraException("Objetivo que não cabe neste tipo de ataque.");
                if (o.K == "recurso" && o.R != "auto" && !Ataques.RecursoValido(m, o.R)) throw new RegraException("Recurso inválido.");
                objs.Add(o.K == "recurso" ? o with { Q = 0 } : o);
            }
            var md = new ModeloAtaque
            {
                Id = m.NovoId(), Nome = nome, Tipo = tipo, Tatica = tatica, Completar = completar,
                Divisao = divisao == Ataques.DivisaoIgual ? divisao : Ataques.DivisaoPrioridade, RecuarVazio = recuarVazio,
                Tropas = grupo, Objetivos = objs, Quando = m.Agora,
            };
            r.ModelosAtaque.Add(md);
            m.Sujar(r);
            return md;
        }

        public static void Apagar(Mundo m, Reino r, long id)
        {
            if (r.ModelosAtaque.RemoveAll(x => x.Id == id) == 0) throw new RegraException("Modelo não encontrado.", 404);
            m.Sujar(r);
        }

        /// <summary>Objetivos do modelo para um alvo: "auto" vira o recurso principal do local (sem recurso, sai).</summary>
        public static List<Objetivo> ObjetivosPara(ModeloAtaque md, Local? alvo) =>
            md.Objetivos.Select(o => o.K == "recurso" && o.R == "auto" ? (alvo?.Produz != null ? o with { R = alvo.Produz } : null) : o)
                .OfType<Objetivo>().ToList();

        /// <summary>Guarda o último ataque na partida (enviado de um local, ou nova ordem a um exército em campo).</summary>
        internal static void AoPartir(Mundo m, Marcha mc)
        {
            if (mc is not Exercito ex || ex.Retornando || !Batalhas.EhAtaque(ex) || m.Reinos.Obter(ex.ReinoId) is not { } r) return;
            var p = PlanoAtaque.Ler(ex.Dados);
            var alvo = ex.AlvoLocalId is long id ? m.Locais.Obter(id) : null;
            r.UltimoAtaque = new ModeloAtaque
            {
                Nome = "Último ataque", Tipo = p.Tipo, Tatica = p.Tatica, Completar = p.Completar,
                Divisao = p.Divisao, RecuarVazio = p.RecuarVazio, Tropas = GT.Limpo(ex.Tropas),
                Objetivos = p.Objetivos.Select(o => o.K == "recurso" && alvo?.Produz != null && o.R == alvo.Produz ? o with { R = "auto" } : o).ToList(),
                AlvoHex = ex.Destino, DeLocalId = m.Locais.Obter(ex.OrigemLocalId) is { } l && l.Hex == ex.Origem ? l.Id : null, Quando = m.Agora,
            };
            m.Sujar(r);
        }

        public static JsonObject ParaJson(ModeloAtaque md)
        {
            var objs = new JsonArray();
            foreach (var o in md.Objetivos)
            {
                var j = new JsonObject { ["k"] = o.K };
                if (o.R != null) j["r"] = o.R;
                if (o.Q > 0) j["q"] = o.Q;
                objs.Add((JsonNode?)j);
            }
            var tropas = new JsonObject();
            foreach (var (k, n) in md.Tropas) tropas[k] = n;
            return new JsonObject
            {
                ["id"] = md.Id, ["nome"] = md.Nome, ["tipo"] = md.Tipo, ["tatica"] = md.Tatica, ["completar"] = md.Completar,
                ["divisao"] = md.Divisao, ["recuarVazio"] = md.RecuarVazio,
                ["tropas"] = tropas, ["objetivos"] = objs, ["alvoHex"] = md.AlvoHex, ["deLocalId"] = md.DeLocalId, ["quando"] = md.Quando,
            };
        }
    }
}

namespace ReinoDePedra.Jogo.Reinos
{
    public sealed partial class Reino
    {
        /// <summary>Modelos de ataque salvos pelo jogador.</summary>
        public List<Combate.ModeloAtaque> ModelosAtaque { get; set; } = new();
        /// <summary>Último ataque enviado (para "Repetir último ataque" e as tropas padrão da ordem rápida).</summary>
        public Combate.ModeloAtaque? UltimoAtaque { get; set; }
    }
}
