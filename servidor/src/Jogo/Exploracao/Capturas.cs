using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

using PS = ReinoDePedra.Jogo.Pessoas.Pessoas;

namespace ReinoDePedra.Jogo.Exploracao
{
    /// <summary>
    /// Explorador capturado por outro reino. Fica preso num local de quem capturou (<see cref="LocalId"/>). Quem captura vê o
    /// reino de origem e tem <c>P.resgateH</c> para pedir resgate, libertar ou executar; sem decisão, o explorador é libertado e
    /// volta para casa. O dono sabe quem capturou e onde ele está preso; pode oferecer um pagamento (ou contrapropor o resgate
    /// pedido) e pode resgatá-lo à força: vencer uma batalha naquele local o liberta. Preso, não ocupa o teto de ninguém.
    /// </summary>
    public sealed class Prisioneiro : Documento
    {
        public long CaptorId { get; set; }
        public long DonoId { get; set; }
        public string TipoExp { get; set; } = "";
        /// <summary>A pessoa presa (continua do reino de origem, em <c>Estados.Capturada</c>) e o nome dela.</summary>
        public long PessoaId { get; set; }
        public string Nome { get; set; } = "";
        /// <summary>Onde foi pego.</summary>
        public int Hex { get; set; }
        /// <summary>Local de quem capturou onde o explorador fica preso (0: o castelo do captor).</summary>
        public long LocalId { get; set; }
        public long Quando { get; set; }
        /// <summary>Fim do prazo de decisão (libertação automática).</summary>
        public long Ate { get; set; }
        /// <summary>"preso" ou "resgate" (resgate pedido, esperando o pagamento).</summary>
        public string Estado { get; set; } = Capturas.Preso;
        public Recursos Resgate { get; set; } = new();
        /// <summary>Pagamento oferecido pelo dono (vazio: nenhuma oferta aberta). Quem capturou aceita, recusa ou contrapropõe.</summary>
        public Recursos Oferta { get; set; } = new();
        public long? OfertaEm { get; set; }
        public long? EventoId { get; set; }
    }

    public static class Capturas
    {
        public const string Preso = "preso", ResgatePedido = "resgate";

        /// <summary>Reinos que não capturam exploradores um do outro (aliança, pacto): (captor, dono) → true para ignorar.</summary>
        public static List<Func<Mundo, Reino, Reino, bool>> Ignorar { get; } = new();

        /// <summary>Alguém foi capturado (o feed público anuncia: o captor é público).</summary>
        public static event Action<Mundo, Prisioneiro>? AoCapturar;

        /// <summary>Resgate pedido: o comércio leva o pedido ao dono e, pago, chama <see cref="PagarResgate"/>.</summary>
        public static event Action<Mundo, Prisioneiro>? AoPedirResgate;

        public static IEnumerable<Prisioneiro> PresosPor(Mundo m, long reinoId) => m.Prisioneiros.Where(p => p.CaptorId == reinoId);
        public static IEnumerable<Prisioneiro> PresosDe(Mundo m, long reinoId) => m.Prisioneiros.Where(p => p.DonoId == reinoId);
        public static IEnumerable<Prisioneiro> NoLocal(Mundo m, long localId) => m.Prisioneiros.Where(p => p.LocalId == localId);

        /// <summary>Local onde o explorador está preso: o registrado ou, sem registro, o castelo de quem capturou.</summary>
        public static Local? Onde(Mundo m, Prisioneiro p) =>
            p.LocalId != 0 ? m.Locais.Obter(p.LocalId) : m.Reinos.Obter(p.CaptorId) is { } c ? m.Locais.Obter(c.CasteloId) : null;

        /// <summary>O pagamento do resgate já está a caminho: o valor não muda mais.</summary>
        public static bool PagamentoACaminho(Mundo m, Prisioneiro p) => Remessas.Do(m, Comercio.Resgate, p.Id).Any();

        /// <summary>
        /// Onde fica preso: o local que viu o explorador (a guarnição que o pegou, o local espionado) se ainda é do captor; senão,
        /// o local do captor mais perto de onde ele foi pego.
        /// </summary>
        private static Local? Cela(Mundo m, Reino captor, int hex, Local? viu)
        {
            if (viu != null && viu.ReinoId == captor.Id && !viu.Ruina) return viu;
            return m.LocaisDe(captor.Id).Where(l => !l.Ruina).OrderBy(l => m.G.Distancia(l.Hex, hex)).ThenBy(l => l.Id).FirstOrDefault();
        }

        /// <summary>O explorador sai do mapa e vira prisioneiro de <paramref name="captor"/>, preso em <paramref name="viu"/> (ou no local mais perto).</summary>
        public static Prisioneiro Capturar(Mundo m, Explorador e, Reino captor, int hex, Local? viu = null)
        {
            var dono = m.Reinos.Obter(e.ReinoId);
            var nome = e.NomeTipo(m);
            var pessoa = m.Pessoas.Obter(e.PessoaId);
            if (pessoa != null) PS.Capturada(m, e, pessoa);
            e.Encerrar(m);
            var cela = Cela(m, captor, hex, viu);
            var p = m.Prisioneiros.Adicionar(new Prisioneiro
            {
                CaptorId = captor.Id, DonoId = e.ReinoId, TipoExp = e.TipoExp, Hex = hex, Quando = m.Agora,
                PessoaId = pessoa?.Id ?? 0, Nome = pessoa?.Nome ?? "", LocalId = cela?.Id ?? 0,
                Ate = m.Agora + T.DeHoras(m.P.ResgateH),
            });
            p.EventoId = m.Agendar(new PrazoPrisioneiroEvento { PrisioneiroId = p.Id, Quando = p.Ate }).Id;
            var onde = "hexágono " + m.G.C(hex) + ", " + m.G.L(hex);
            Registros.Relatar(m, captor.Id, "captura", nome + " capturado", new JsonObject
            {
                ["resumo"] = "Suas tropas pegaram " + (p.Nome.Length > 0 ? p.Nome + ", " + nome.ToLowerInvariant() + "," : "um explorador") + " perto do " + onde +
                             (cela != null ? ". Fica preso em " + cela.Nome : "") + ". Decida em " + m.P.ResgateH + " h: pedir resgate, libertar ou executar. Sem decisão, ele é libertado.",
                ["nome"] = p.Nome,
                ["origem"] = dono != null ? Espionagem.Identidade(dono) : null,
                ["prisioneiro"] = p.Id, ["ate"] = p.Ate, ["hex"] = hex,
                ["linhas"] = new JsonArray
                {
                    Fauna.Linha("Reino de origem", dono?.Nome ?? "desconhecido"), Fauna.Linha("Onde", onde),
                    Fauna.Linha("Preso em", cela?.Nome ?? "—"),
                },
            }, "exploracao", "Explorador capturado · " + (dono?.Nome ?? ""));
            if (dono != null)
            {
                Registros.Relatar(m, dono.Id, "captura", nome + " capturado", new JsonObject
                {
                    ["resumo"] = "Perdemos " + (p.Nome.Length > 0 ? p.Nome : "o explorador") + " perto do " + onde + ": " + captor.Nome + " o capturou" + (cela != null ? " e o prende em " + cela.Nome : "") + ". " +
                                 captor.Nome + " tem " + m.P.ResgateH + " h para decidir; sem decisão, volta. Você pode oferecer um pagamento ou resgatá-lo à força: vencer uma batalha no local onde ele está o liberta.",
                    ["hex"] = hex, ["nome"] = p.Nome, ["prisioneiro"] = p.Id, ["ate"] = p.Ate, ["dono"] = true, ["origem"] = Espionagem.Identidade(captor),
                    ["linhas"] = new JsonArray { Fauna.Linha("Onde", onde), Fauna.Linha("Capturado por", captor.Nome), Fauna.Linha("Preso em", cela?.Nome ?? "—") },
                }, "exploracao");
            }
            m.Avisar(captor.Id, "reino");
            AoCapturar?.Invoke(m, p);
            return p;
        }

        public static Prisioneiro DoCaptor(Mundo m, Reino r, long id) =>
            m.Prisioneiros.Obter(id) is { } p && p.CaptorId == r.Id ? p : throw new RegraException("Prisioneiro não encontrado.", 404);

        public static Prisioneiro DoDono(Mundo m, Reino r, long id) =>
            m.Prisioneiros.Obter(id) is { } p && p.DonoId == r.Id ? p : throw new RegraException("Prisioneiro não encontrado.", 404);

        /// <summary>
        /// Decisão de quem capturou: "libertar", "executar", "resgate" (pede ou contrapropõe, com o valor), "aceitar" (a oferta do
        /// dono: o pagamento sai na hora) ou "recusar" (a oferta do dono).
        /// </summary>
        public static void Decidir(Mundo m, Reino captor, long id, string acao, IReadOnlyDictionary<string, double>? resgate = null)
        {
            var p = DoCaptor(m, captor, id);
            switch (acao)
            {
                case "libertar": Libertar(m, p, "libertado"); return;
                case "executar": Executar(m, p); return;
                case "resgate": PedirResgate(m, p, resgate); return;
                case "aceitar": Comercio.AceitarOferta(m, captor, p); return;
                case "recusar": RecusarOferta(m, p); return;
                default: throw new RegraException("Escolha libertar, executar ou pedir resgate.");
            }
        }

        private static void PedirResgate(Mundo m, Prisioneiro p, IReadOnlyDictionary<string, double>? resgate)
        {
            if (PagamentoACaminho(m, p)) throw new RegraException("O resgate já está a caminho.");
            var valor = new Recursos();
            foreach (var (k, v) in resgate ?? new Dictionary<string, double>())
            {
                if (!m.P.Valor.ContainsKey(k)) throw new RegraException("Recurso desconhecido.");
                if (v < 0 || double.IsNaN(v)) throw new RegraException("Quantidade inválida.");
                if (v >= 1) valor.Somar(k, Math.Floor(v));
            }
            if (valor.Count == 0) throw new RegraException("Diga quanto pede de resgate.");
            var contra = p.Oferta.Count > 0;
            p.Estado = ResgatePedido; p.Resgate = valor; p.Oferta = new(); p.OfertaEm = null;
            m.Sujar(p);
            var captor = m.Reinos.Obter(p.CaptorId); var dono = m.Reinos.Obter(p.DonoId);
            if (captor != null && dono != null)
            {
                if (dono.ResgatesRecusados.Remove(p.Id)) m.Sujar(dono);
                Registros.Relatar(m, dono.Id, "captura", (contra ? "Contraproposta de " : "Resgate pedido por ") + captor.Nome, new JsonObject
                {
                    ["resumo"] = captor.Nome + " tem seu " + Exploradores.NomeTipo(m, p.TipoExp).ToLowerInvariant() + (contra ? " e responde à sua oferta pedindo outro valor." : " e pede resgate.") +
                                 " Pague, ofereça outro valor ou resgate-o à força. Sem pagamento até o prazo, ele é libertado.",
                    ["origem"] = Espionagem.Identidade(captor), ["resgate"] = Json(valor), ["ate"] = p.Ate, ["hex"] = p.Hex, ["prisioneiro"] = p.Id, ["dono"] = true,
                    ["linhas"] = new JsonArray { Fauna.Linha("Pede", Remessas.Texto(valor)) },
                }, "comercio");
            }
            AoPedirResgate?.Invoke(m, p);
        }

        /// <summary>Quem capturou não aceita a oferta do dono.</summary>
        private static void RecusarOferta(Mundo m, Prisioneiro p)
        {
            if (p.Oferta.Count == 0) throw new RegraException("Não há oferta por este prisioneiro.");
            p.Oferta = new(); p.OfertaEm = null; m.Sujar(p);
            var quem = m.Reinos.Obter(p.CaptorId) is { } c ? c.Nome : "Quem o capturou";
            Registros.Notificar(m, p.DonoId, "exploracao", "Oferta recusada", quem + " não aceitou o pagamento por " + (p.Nome.Length > 0 ? p.Nome : "seu explorador") + ". Ofereça outro valor ou resgate-o à força.", "exploradores");
            m.Avisar(p.DonoId, "reino"); m.Avisar(p.CaptorId, "reino");
        }

        /// <summary>Resgate pago (chamado pelo comércio quando o pagamento chega): o explorador é libertado.</summary>
        public static void PagarResgate(Mundo m, Prisioneiro p) => Libertar(m, p, "resgatado");

        private static void Executar(Mundo m, Prisioneiro p)
        {
            Remover(m, p);
            if (m.Pessoas.Obter(p.PessoaId) is { } pessoa) PS.Remover(m, pessoa);
            Registros.Relatar(m, p.DonoId, "captura", Exploradores.NomeTipo(m, p.TipoExp) + " executado", new JsonObject
            {
                ["resumo"] = (p.Nome.Length > 0 ? p.Nome + ", o explorador" : "O explorador") + " capturado perto do hexágono " + m.G.C(p.Hex) + ", " + m.G.L(p.Hex) + ", não vai voltar.", ["hex"] = p.Hex,
            }, "exploracao");
            m.Avisar(p.CaptorId, "reino");
        }

        /// <summary>Solta o explorador: ele sai do local onde estava preso (ou de onde foi pego) e volta para casa.</summary>
        public static void Libertar(Mundo m, Prisioneiro p, string motivo)
        {
            var de = Onde(m, p)?.Hex ?? p.Hex;
            Remover(m, p);
            var dono = m.Reinos.Obter(p.DonoId);
            var pessoa = m.Pessoas.Obter(p.PessoaId);
            if (dono == null || !dono.Ativo) { if (pessoa != null) PS.Remover(m, pessoa); return; }
            var e = new Explorador
            {
                ReinoId = dono.Id, TipoExp = p.TipoExp, CasaLocalId = dono.CasteloId, Base = de, Ordem = Exploradores.Retornar,
                Origem = de, Destino = de, Caminho = [de], Tempos = [m.Agora], PessoaId = p.PessoaId,
            };
            e.Vel = Exploradores.Velocidade(m, p.TipoExp, e.Tropas);
            m.Marchas.Adicionar(e);
            if (pessoa != null) PS.Embarcar(m, e, [pessoa]);
            Exploradores.IrParaCasa(m, e);
            Registros.Notificar(m, dono.Id, "exploracao", Exploradores.NomeTipo(m, p.TipoExp) + " " + motivo, (p.Nome.Length > 0 ? p.Nome + " está" : "Está") + " voltando para casa.", "exploradores");
            if (motivo == "libertado" && m.Agora >= p.Ate)
                Registros.Notificar(m, p.CaptorId, "exploracao", "Prisioneiro libertado", "Sem decisão em " + m.P.ResgateH + " h, o explorador foi solto.", "exploradores");
            m.Avisar(p.CaptorId, "reino");
            m.Avisar(dono.Id, "reino");
        }

        // ---------------------------------------------------------------- resgate à força

        /// <summary>
        /// Fim de uma batalha num local: o atacante que vence liberta os exploradores dele presos ali (o resgate à força). Depois,
        /// quem estava preso num local que deixou de ser do captor (tomado, arruinado) é solto.
        /// </summary>
        public static void AoTerminarBatalha(Mundo m, ResultadoCombate rc)
        {
            if (rc.AtacanteVenceu)
                foreach (var p in NoLocal(m, rc.LocalId).Where(p => p.DonoId == rc.AtacanteId).ToList())
                {
                    var l = m.Locais.Obter(rc.LocalId);
                    Registros.Notificar(m, p.CaptorId, "exploracao", "Prisioneiro resgatado", "Tropas inimigas venceram em " + (l?.Nome ?? "um local seu") + " e levaram " + (p.Nome.Length > 0 ? p.Nome : "o explorador") + ".", "exploradores");
                    Libertar(m, p, "resgatado à força");
                }
            Conferir(m);
        }

        /// <summary>Quem está preso num local que não é mais de quem capturou (tomado, arruinado, perdido na queda) é solto.</summary>
        public static void Conferir(Mundo m)
        {
            foreach (var p in m.Prisioneiros.Where(p => p.LocalId != 0).ToList())
            {
                var l = m.Locais.Obter(p.LocalId);
                if (l != null && l.ReinoId == p.CaptorId && !l.Ruina) continue;
                Registros.Notificar(m, p.CaptorId, "exploracao", "Prisioneiro solto", "O local onde " + (p.Nome.Length > 0 ? p.Nome : "o explorador") + " estava preso não é mais seu.", "exploradores");
                Libertar(m, p, "solto");
            }
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
