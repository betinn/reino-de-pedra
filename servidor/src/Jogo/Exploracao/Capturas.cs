using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Jogo.Exploracao
{
    /// <summary>
    /// Explorador capturado por outro reino. Quem captura vê o reino de origem e tem <c>P.resgateH</c> para pedir resgate,
    /// libertar ou executar; sem decisão, o explorador é libertado e volta para casa. Preso, não ocupa o teto de ninguém.
    /// </summary>
    public sealed class Prisioneiro : Documento
    {
        public long CaptorId { get; set; }
        public long DonoId { get; set; }
        public string TipoExp { get; set; } = "";
        public int Hex { get; set; }
        public long Quando { get; set; }
        /// <summary>Fim do prazo de decisão (libertação automática).</summary>
        public long Ate { get; set; }
        /// <summary>"preso" ou "resgate" (resgate pedido, esperando o pagamento).</summary>
        public string Estado { get; set; } = Capturas.Preso;
        public Recursos Resgate { get; set; } = new();
        public long? EventoId { get; set; }
    }

    public static class Capturas
    {
        public const string Preso = "preso", ResgatePedido = "resgate";

        /// <summary>Reinos que não capturam exploradores um do outro (aliança, pacto): (captor, dono) → true para ignorar.</summary>
        public static List<Func<Mundo, Reino, Reino, bool>> Ignorar { get; } = new();

        /// <summary>Resgate pedido: o comércio leva o pedido ao dono e, pago, chama <see cref="PagarResgate"/>.</summary>
        public static event Action<Mundo, Prisioneiro>? AoPedirResgate;

        public static IEnumerable<Prisioneiro> PresosPor(Mundo m, long reinoId) => m.Prisioneiros.Where(p => p.CaptorId == reinoId);
        public static IEnumerable<Prisioneiro> PresosDe(Mundo m, long reinoId) => m.Prisioneiros.Where(p => p.DonoId == reinoId);

        /// <summary>O explorador sai do mapa e vira prisioneiro de <paramref name="captor"/>.</summary>
        public static Prisioneiro Capturar(Mundo m, Explorador e, Reino captor, int hex)
        {
            var dono = m.Reinos.Obter(e.ReinoId);
            var nome = e.NomeTipo(m);
            e.Encerrar(m);
            var p = m.Prisioneiros.Adicionar(new Prisioneiro
            {
                CaptorId = captor.Id, DonoId = e.ReinoId, TipoExp = e.TipoExp, Hex = hex, Quando = m.Agora,
                Ate = m.Agora + T.DeHoras(m.P.ResgateH),
            });
            p.EventoId = m.Agendar(new PrazoPrisioneiroEvento { PrisioneiroId = p.Id, Quando = p.Ate }).Id;
            if (dono != null) Conhecimento.Conhecer(m, captor, dono, "captura");
            var onde = "hexágono " + m.G.C(hex) + ", " + m.G.L(hex);
            Registros.Relatar(m, captor.Id, "captura", nome + " capturado", new JsonObject
            {
                ["resumo"] = "Suas tropas pegaram um explorador perto do " + onde + ". Decida em " + m.P.ResgateH + " h: pedir resgate, libertar ou executar. Sem decisão, ele é libertado.",
                ["origem"] = dono != null ? Espionagem.Identidade(dono) : null,
                ["prisioneiro"] = p.Id, ["ate"] = p.Ate, ["hex"] = hex,
                ["linhas"] = new JsonArray { Fauna.Linha("Reino de origem", dono?.Nome ?? "desconhecido"), Fauna.Linha("Onde", onde) },
            }, "exploracao", "Explorador capturado · " + (dono?.Nome ?? ""));
            if (dono != null)
                Registros.Relatar(m, dono.Id, "captura", nome + " capturado", new JsonObject
                {
                    ["resumo"] = "Perdemos o explorador perto do " + onde + ". Quem o pegou tem " + m.P.ResgateH + " h para decidir; sem decisão, ele volta.",
                    ["hex"] = hex, ["linhas"] = new JsonArray { Fauna.Linha("Onde", onde) },
                }, "exploracao");
            m.Avisar(captor.Id, "reino");
            return p;
        }

        public static Prisioneiro DoCaptor(Mundo m, Reino r, long id) =>
            m.Prisioneiros.Obter(id) is { } p && p.CaptorId == r.Id ? p : throw new RegraException("Prisioneiro não encontrado.", 404);

        /// <summary>Decisão de quem capturou: "libertar", "executar" ou "resgate" (com o valor pedido).</summary>
        public static void Decidir(Mundo m, Reino captor, long id, string acao, IReadOnlyDictionary<string, double>? resgate = null)
        {
            var p = DoCaptor(m, captor, id);
            switch (acao)
            {
                case "libertar": Libertar(m, p, "libertado"); return;
                case "executar": Executar(m, p); return;
                case "resgate": PedirResgate(m, p, resgate); return;
                default: throw new RegraException("Escolha libertar, executar ou pedir resgate.");
            }
        }

        private static void PedirResgate(Mundo m, Prisioneiro p, IReadOnlyDictionary<string, double>? resgate)
        {
            var valor = new Recursos();
            foreach (var (k, v) in resgate ?? new Dictionary<string, double>())
            {
                if (!m.P.Valor.ContainsKey(k)) throw new RegraException("Recurso desconhecido.");
                if (v < 0 || double.IsNaN(v)) throw new RegraException("Quantidade inválida.");
                if (v >= 1) valor.Somar(k, Math.Floor(v));
            }
            if (valor.Count == 0) throw new RegraException("Diga quanto pede de resgate.");
            p.Estado = ResgatePedido; p.Resgate = valor;
            m.Sujar(p);
            var captor = m.Reinos.Obter(p.CaptorId); var dono = m.Reinos.Obter(p.DonoId);
            if (captor != null && dono != null)
            {
                Conhecimento.Conhecer(m, dono, captor, "resgate");   // o pedido revela quem pede
                Registros.Relatar(m, dono.Id, "captura", "Resgate pedido por " + captor.Nome, new JsonObject
                {
                    ["resumo"] = captor.Nome + " tem seu " + Exploradores.NomeTipo(m, p.TipoExp).ToLowerInvariant() + " e pede resgate. Sem pagamento até o prazo, ele é libertado.",
                    ["origem"] = Espionagem.Identidade(captor), ["resgate"] = Json(valor), ["ate"] = p.Ate, ["hex"] = p.Hex,
                    ["linhas"] = new JsonArray { Fauna.Linha("Pede", string.Join(", ", valor.Arredondado().Select(kv => kv.Value + " " + Logistica.NomeRecurso(kv.Key)))) },
                }, "comercio");
            }
            AoPedirResgate?.Invoke(m, p);
        }

        /// <summary>Resgate pago (chamado pelo comércio quando o pagamento chega): o explorador é libertado.</summary>
        public static void PagarResgate(Mundo m, Prisioneiro p) => Libertar(m, p, "resgatado");

        private static void Executar(Mundo m, Prisioneiro p)
        {
            Remover(m, p);
            Registros.Relatar(m, p.DonoId, "captura", Exploradores.NomeTipo(m, p.TipoExp) + " executado", new JsonObject
            {
                ["resumo"] = "O explorador capturado perto do hexágono " + m.G.C(p.Hex) + ", " + m.G.L(p.Hex) + " não vai voltar.", ["hex"] = p.Hex,
            }, "exploracao");
            m.Avisar(p.CaptorId, "reino");
        }

        /// <summary>Solta o explorador: ele sai do hexágono onde foi pego e volta para casa.</summary>
        public static void Libertar(Mundo m, Prisioneiro p, string motivo)
        {
            Remover(m, p);
            var dono = m.Reinos.Obter(p.DonoId);
            if (dono == null || !dono.Ativo) return;
            var e = new Explorador
            {
                ReinoId = dono.Id, TipoExp = p.TipoExp, CasaLocalId = dono.CasteloId, Base = p.Hex, Ordem = Exploradores.Retornar,
                Origem = p.Hex, Destino = p.Hex, Caminho = [p.Hex], Tempos = [m.Agora],
            };
            e.Vel = Exploradores.Velocidade(m, p.TipoExp, e.Tropas);
            Exploradores.IrParaCasa(m, e);
            Registros.Notificar(m, dono.Id, "exploracao", Exploradores.NomeTipo(m, p.TipoExp) + " " + motivo, "Está voltando para casa.", "exploradores");
            if (motivo == "libertado" && m.Agora >= p.Ate)
                Registros.Notificar(m, p.CaptorId, "exploracao", "Prisioneiro libertado", "Sem decisão em " + m.P.ResgateH + " h, o explorador foi solto.", "exploradores");
            m.Avisar(p.CaptorId, "reino");
        }

        private static void Remover(Mundo m, Prisioneiro p)
        {
            m.Cancelar(p.EventoId);
            m.Prisioneiros.Remover(p);
        }

        internal static JsonObject Json(Recursos r)
        {
            var o = new JsonObject();
            foreach (var (k, v) in r.Arredondado()) o[k] = v;
            return o;
        }
    }

    /// <summary>Fim do prazo: sem decisão (ou sem pagamento do resgate), o explorador é libertado.</summary>
    public sealed class PrazoPrisioneiroEvento : Evento
    {
        public long PrisioneiroId { get; set; }
        public override void Executar(Mundo m)
        {
            if (m.Prisioneiros.Obter(PrisioneiroId) is not { } p) return;
            p.EventoId = null;
            Capturas.Libertar(m, p, "libertado");
        }
    }
}

namespace ReinoDePedra.Jogo
{
    using ReinoDePedra.Jogo.Exploracao;
    public sealed partial class Mundo
    {
        public Colecao<Prisioneiro> Prisioneiros { get; } = new("prisioneiros");
    }
}
