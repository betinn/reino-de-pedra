using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Jogo.Exploracao
{
    /// <summary>O que um reino sabe de um local de outro reino por espionagem (fica na foto da névoa).</summary>
    public sealed class LocalEspionado
    {
        public long DonoId { get; set; }
        public int Nivel { get; set; }
        public long Quando { get; set; }
        public int Tropas { get; set; }
        public int Torres { get; set; }
        /// <summary>Civis presentes no local na hora (a milícia que a IA estima).</summary>
        public int Milicia { get; set; }
    }

    /// <summary>
    /// Espionagem com o batedor de elite: fica <c>P.espiao.tempoNoLocal</c> no local; a chance de ser visto vem de
    /// <c>F.ChanceEspiao</c> (torres no alcance e tropas da guarnição). Visto: o dono vê "espião visto" por 10 h e,
    /// metade das vezes, o batedor é capturado (sem relatório). Não capturado: relatório com dono, defesa, estoque e relíquias.
    /// </summary>
    public static class Espionagem
    {
        /// <summary>Torres de arqueiros com alcance sobre o local (o sistema de torres registra aqui).</summary>
        public static List<Func<Mundo, Local, int>> TorresNoAlcance { get; } = new();
        /// <summary>Milícia estimada do local: os civis presentes × <c>P.miliciaPorPop</c>. O combate pode trocar.</summary>
        public static Func<Mundo, Local, double> Milicia { get; set; } = (m, l) =>
            m.Reinos.Obter(l.ReinoId) is { } r ? Math.Floor(Combate.Combates.PopDoLocal(m, r, l) * m.P.MiliciaPorPop) : 0;
        /// <summary>Sistemas acrescentam dados ao relatório de espionagem (bônus, feridos...).</summary>
        public static List<Action<Mundo, Reino, Local, JsonObject>> ExtrasRelatorio { get; } = new();

        public static int Torres(Mundo m, Local l) => TorresNoAlcance.Sum(f => f(m, l));
        public static double Chance(Mundo m, Local l) => m.F.ChanceEspiao(Torres(m, l), l.TropasNaGuarnicao);

        /// <summary>O batedor chegou ao local: fica parado lá até o fim da espionagem.</summary>
        public static void Comecar(Mundo m, Explorador e)
        {
            var h = e.HexEm(m.Agora);
            var l = m.LocalNoHex(h);
            if (l == null || l.ReinoId == e.ReinoId || l.ReinoId == 0)
            {
                Registros.Notificar(m, e.ReinoId, "exploracao", "Nada para espionar", "Não havia local de outro reino no hexágono " + m.G.C(h) + ", " + m.G.L(h) + ".", "exploradores");
                Exploradores.IrParaCasa(m, e);
                return;
            }
            m.Cancelar(e.EventoId);
            e.EventoId = null;
            e.Caminho = [h]; e.Tempos = [m.Agora]; e.Origem = e.Destino = h;
            e.EspionandoAte = m.Agora + T.DeSegundos(m.P.Espiao.TempoNoLocal);
            e.EspionagemEventoId = m.Agendar(new FimEspionagemEvento { MarchaId = e.Id, LocalId = l.Id, Quando = e.EspionandoAte.Value }).Id;
            m.Sujar(e);
            m.Avisar(e.ReinoId, "marchas");
        }

        public static void Concluir(Mundo m, Explorador e, Local l)
        {
            e.EspionagemEventoId = null; e.EspionandoAte = null;
            var r = m.Reinos.Obter(e.ReinoId);
            var dono = m.Reinos.Obter(l.ReinoId);
            if (r == null || dono == null || l.ReinoId == e.ReinoId || l.Hex != e.HexEm(m.Agora)) { Exploradores.IrParaCasa(m, e); return; }
            var torres = Torres(m, l);
            var chance = m.F.ChanceEspiao(torres, l.TropasNaGuarnicao);
            var visto = m.Sorte.Chance(chance);
            if (visto)
            {
                Avistamentos.Registrar(m, dono.Id, l.Hex, "espiao", "Espião visto perto de " + l.Nome);
                if (m.Sorte.Chance(m.P.Espiao.Capturado)) { Capturas.Capturar(m, e, dono, l.Hex); return; }
            }
            Relatar(m, r, dono, l, torres, chance, visto);
            Exploradores.IrParaCasa(m, e);
        }

        /// <summary>Monta o relatório, guarda o que se soube na foto do reino e marca o dono como conhecido.</summary>
        public static Relatorio Relatar(Mundo m, Reino r, Reino dono, Local l, int torres, double chance, bool visto)
        {
            Economia.Atualizar(m, dono);
            var g = new JsonObject();
            foreach (var (k, v) in l.Guarnicao.Where(kv => kv.Value > 0)) g[k] = v;
            var milicia = Milicia(m, l);
            var reliquias = new JsonArray();
            foreach (var rel in Reliquias.NoLocal(m, l.Id)) reliquias.Add(new JsonObject { ["id"] = rel.Id, ["nome"] = rel.Nome, ["tipo"] = rel.Tipo });
            var estoque = Capturas.Json(l.Estoque);
            var linhas = new JsonArray
            {
                Fauna.Linha("Dono", dono.Nome),
                Fauna.Linha("Local", l.Nome + " · nível " + l.Nivel),
                Fauna.Linha("Guarnição", l.TropasNaGuarnicao > 0 ? Reinos.Tropas.Partes(m, l.Guarnicao) : "nenhuma"),
                Fauna.Linha("Torres no alcance", torres.ToString()),
                Fauna.Linha("Milícia", "≈ " + milicia),
                Fauna.Linha("Estoque", l.Estoque.Arredondado().Count > 0 ? string.Join(", ", l.Estoque.Arredondado().Select(kv => kv.Value + " " + Logistica.NomeRecurso(kv.Key))) : "vazio"),
                Fauna.Linha("Relíquias", reliquias.Count > 0 ? string.Join(", ", Reliquias.NoLocal(m, l.Id).Select(x => x.Nome)) : "nenhuma"),
            };
            var dados = new JsonObject
            {
                ["resumo"] = visto ? "O batedor foi visto, mas fugiu com o relatório." : "O batedor não foi visto.",
                ["dono"] = Identidade(dono),
                ["local"] = new JsonObject { ["id"] = l.Id, ["nome"] = l.Nome, ["tipo"] = l.Tipo.Chave(), ["produz"] = l.Produz, ["nivel"] = l.Nivel },
                ["defesa"] = new JsonObject { ["guarnicao"] = g, ["tropas"] = l.TropasNaGuarnicao, ["torres"] = torres, ["milicia"] = milicia, ["postura"] = l.Postura.ToString() },
                ["estoque"] = estoque, ["reliquias"] = reliquias,
                ["visto"] = visto, ["chance"] = Math.Round(chance, 3), ["hex"] = l.Hex, ["linhas"] = linhas,
            };
            foreach (var f in ExtrasRelatorio) f(m, dono, l, dados);
            r.LocaisEspionados[l.Id] = new LocalEspionado { DonoId = dono.Id, Nivel = l.Nivel, Quando = m.Agora, Tropas = l.TropasNaGuarnicao, Torres = torres, Milicia = (int)Math.Round(milicia) };
            m.Sujar(r);
            Conhecimento.Conhecer(m, r, dono, "espionagem");
            m.Avisar(r.Id, "mapa");
            return Registros.Relatar(m, r.Id, "espionagem", "Espionagem: " + l.Nome, dados, "exploracao");
        }

        /// <summary>Identidade de um reino para quem o conhece (nome e brasão).</summary>
        public static JsonObject Identidade(Reino r) => new()
        {
            ["id"] = r.Id, ["nome"] = r.Nome, ["iconeProprio"] = r.IconeProprio, ["iconeVersao"] = r.IconeVersao,
            ["brasao"] = new JsonObject
            {
                ["forma"] = r.Brasao.Forma, ["divisao"] = r.Brasao.Divisao, ["cor1"] = r.Brasao.Cor1, ["cor2"] = r.Brasao.Cor2,
                ["simbolo"] = r.Brasao.Simbolo, ["corSimbolo"] = r.Brasao.CorSimbolo,
            },
        };
    }

    public sealed class FimEspionagemEvento : Evento
    {
        public long MarchaId { get; set; }
        public long LocalId { get; set; }
        public override void Executar(Mundo m)
        {
            if (m.Marchas.Obter(MarchaId) is not Explorador e || e.EspionagemEventoId != Id) return;
            if (m.Locais.Obter(LocalId) is not { } l) { e.EspionagemEventoId = null; Exploradores.IrParaCasa(m, e); return; }
            Espionagem.Concluir(m, e, l);
        }
    }

    // ---------------------------------------------------------------- reinos conhecidos

    /// <summary>
    /// Reinos que um reino conhece (espionagem, captura, resgate, estandarte, bandeira, aliança...). Troca direta e
    /// propostas só com reinos conhecidos; conhecer o primeiro reino é o gatilho de alianças e comércio.
    /// </summary>
    public static class Conhecimento
    {
        /// <summary>(mundo, quem passou a conhecer, quem foi conhecido, como: "espionagem", "captura"...).</summary>
        public static event Action<Mundo, Reino, Reino, string>? AoConhecer;

        public static bool Conhece(Reino r, long outro) => r.Id == outro || r.ReinosConhecidos.Contains(outro);

        public static bool Conhecer(Mundo m, Reino quem, Reino conhecido, string como)
        {
            if (quem.Id == conhecido.Id || !quem.ReinosConhecidos.Add(conhecido.Id)) return false;
            m.Sujar(quem);
            AoConhecer?.Invoke(m, quem, conhecido, como);
            return true;
        }
    }

    // ---------------------------------------------------------------- avistamentos

    /// <summary>Algo visto por um reino que fica no mapa como "visto há X" por <c>P.avistamentoH</c> (espião, tropas...).</summary>
    public sealed class Avistamento : Documento
    {
        public long ReinoId { get; set; }
        public int Hex { get; set; }
        /// <summary>"espiao" ou "tropas".</summary>
        public string Tipo { get; set; } = "";
        public long Quando { get; set; }
        public long Ate { get; set; }
    }

    public static class Avistamentos
    {
        /// <summary>Registra um avistamento para o reino (some sozinho depois de <c>P.avistamentoH</c>) e avisa.</summary>
        public static Avistamento Registrar(Mundo m, long reinoId, int hex, string tipo, string titulo)
        {
            var a = m.Avistamentos.Adicionar(new Avistamento { ReinoId = reinoId, Hex = hex, Tipo = tipo, Quando = m.Agora, Ate = m.Agora + T.DeHoras(m.P.AvistamentoH) });
            m.Agendar(new FimAvistamentoEvento { AvistamentoId = a.Id, Quando = a.Ate });
            Registros.Notificar(m, reinoId, "ataques", titulo, "Fica no mapa por " + m.P.AvistamentoH + " h.", "mapa?foco=" + hex);
            m.Avisar(reinoId, "mapa");
            AoRegistrar?.Invoke(m, a);
            return a;
        }
        /// <summary>Depois de cada avistamento (gatilho da espionagem: o primeiro espião visto).</summary>
        public static event Action<Mundo, Avistamento>? AoRegistrar;
        public static IEnumerable<Avistamento> De(Mundo m, long reinoId) => m.Avistamentos.Where(a => a.ReinoId == reinoId && a.Ate > m.Agora);
    }

    public sealed class FimAvistamentoEvento : Evento
    {
        public long AvistamentoId { get; set; }
        public override void Executar(Mundo m)
        {
            if (m.Avistamentos.Obter(AvistamentoId) is not { } a) return;
            m.Avistamentos.Remover(a);
            m.Avisar(a.ReinoId, "mapa");
        }
    }
}

namespace ReinoDePedra.Jogo.Reinos
{
    using ReinoDePedra.Jogo.Exploracao;
    public sealed partial class Reino
    {
        /// <summary>Locais de outros reinos espionados por este reino: id do local → o que se soube.</summary>
        public Dictionary<long, LocalEspionado> LocaisEspionados { get; set; } = new();
        /// <summary>Reinos conhecidos (ver <see cref="Conhecimento"/>).</summary>
        public HashSet<long> ReinosConhecidos { get; set; } = new();
    }
}

namespace ReinoDePedra.Jogo
{
    using ReinoDePedra.Jogo.Exploracao;
    public sealed partial class Mundo
    {
        public Colecao<Avistamento> Avistamentos { get; } = new("avistamentos");
    }
}
