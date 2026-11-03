using System.Text.RegularExpressions;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.Social
{
    /// <summary>
    /// Mensagem levada por mensageiro. Revela quem a mandou; o destinatário só se revela se responder.
    /// Enviada a um local de dono desconhecido, quem manda não fica sabendo quem recebeu.
    /// </summary>
    public sealed class Mensagem : Documento
    {
        public long DeId { get; set; }
        /// <summary>Quem recebeu (0 enquanto o mensageiro não chega a um local de dono desconhecido).</summary>
        public long ParaId { get; set; }
        /// <summary>Mandada a um reino conhecido (quem manda sabe para quem é); senão, a um local.</summary>
        public bool PorReino { get; set; }
        public long? LocalId { get; set; }
        public int Hex { get; set; }
        public string Texto { get; set; } = "";
        public long Enviada { get; set; }
        public long? Entregue { get; set; }
        /// <summary>"a-caminho", "entregue" ou "sem-destinatario".</summary>
        public string Estado { get; set; } = Mensageiros.ACaminho;
        public bool Lida { get; set; }
        /// <summary>Mensagem que esta responde.</summary>
        public long? RespondeA { get; set; }
        public long? MarchaId { get; set; }
    }

    /// <summary>
    /// Mensageiro em campo: vai a cavalo com bandeira branca, evidente no mapa como não agressivo. Tropas e fauna não o atacam
    /// (não interceptável, fora da fauna). Ocupa <c>P.mensageiro.pop</c>. Entrega e volta para casa.
    /// </summary>
    public sealed class Mensageiro : Marcha
    {
        public override string Tipo => "mensageiro";
        public long MensagemId { get; set; }
        public override bool Interceptavel => false;
        public override bool AlvoDeFauna => false;
        public override int PopOcupada(Mundo m) => m.P.Mensageiro.Pop;
        public override void Chegou(Mundo m) => Mensageiros.Chegou(m, this);
    }

    /// <summary>Item da fila de recrutamento que treina mensageiros no castelo (Qtd).</summary>
    public sealed class ItemMensageiro : ITipoItemPorUnidade
    {
        public const string Id = "mensageiro";
        public string Tipo => Id;
        public void Entregar(Mundo m, Reino r, ItemFila item, int n)
        {
            if (n <= 0) return;
            r.MensageirosLivres += n;
            m.Sujar(r);
        }
        public void Concluir(Mundo m, Reino r, ItemFila item) =>
            Registros.Notificar(m, r.Id, "mensagens", item.Qtd > 1 ? "Mensageiros prontos" : "Mensageiro pronto", item.Rotulo, "mensagens");
        public void Cancelado(Mundo m, Reino r, ItemFila item) { r.Pop += item.Restantes * m.P.Mensageiro.Pop; m.Sujar(r); }
    }

    public static class Mensageiros
    {
        public const string ACaminho = "a-caminho", EntregueE = "entregue", SemDestinatario = "sem-destinatario";

        public static IEnumerable<ItemFila> EmTreino(Reino r) =>
            r.Filas.TryGetValue(Recrutamento.Fila, out var f) ? f.Itens.Where(i => i.Tipo == ItemMensageiro.Id) : [];
        public static IEnumerable<Mensageiro> EmCampo(Mundo m, long reinoId) => m.Marchas.OfType<Mensageiro>().Where(x => x.ReinoId == reinoId);

        /// <summary>Mensageiros livres e em treino ocupam o teto (os em campo contam pela marcha).</summary>
        public static int Ocupantes(Mundo m, Reino r) => (r.MensageirosLivres + EmTreino(r).Sum(i => i.Restantes)) * m.P.Mensageiro.Pop;

        /// <summary>Treina mensageiros no castelo (fila de recrutamento). A população sai na hora; volta se cancelar.</summary>
        public static ItemFila Treinar(Mundo m, Reino r, int qtd)
        {
            if (qtd < 1) throw new RegraException("Escolha pelo menos 1 mensageiro.");
            var c = m.Locais.Obter(r.CasteloId);
            if (c == null || c.ReinoId != r.Id || c.Ruina) throw new RegraException("Mensageiros são treinados no castelo.");
            Economia.Atualizar(m, r);
            var pop = qtd * m.P.Mensageiro.Pop;
            var livre = (long)Math.Floor(r.Pop);
            if (livre < pop) throw new RegraException($"Falta população civil livre: precisa de {pop}, há {livre}.");
            var custo = new Recursos(); custo.Somar(m.P.Mensageiro.Custo, qtd);
            var item = Filas.Enfileirar(m, r, Recrutamento.Fila, new ItemFila
            {
                Tipo = ItemMensageiro.Id, LocalId = c.Id, Hex = c.Hex, Qtd = qtd,
                Rotulo = qtd + (qtd > 1 ? " × mensageiros" : " × mensageiro"), Custo = custo, DuracaoSeg = m.P.Mensageiro.Tempo * qtd,
            });
            r.Pop -= pop;
            m.Sujar(r);
            return item;
        }

        /// <summary>
        /// Manda um mensageiro: a um reino conhecido (vai ao castelo dele) ou a um local de outro reino já explorado,
        /// mesmo de dono desconhecido. <paramref name="respondeA"/>: a mensagem recebida que esta responde.
        /// </summary>
        public static Mensagem Enviar(Mundo m, Reino r, string? texto, long? paraReinoId, long? localId, long? respondeA = null)
        {
            texto = Regex.Replace((texto ?? "").Trim(), @"[ \t]+", " ");
            var max = m.P.Mensageiro.Caracteres;
            if (texto.Length == 0) throw new RegraException("Escreva a mensagem.");
            if (texto.Length > max) throw new RegraException($"A mensagem pode ter até {max} caracteres.");
            Mensagem? original = null;
            if (respondeA is long ra)
            {
                original = m.Mensagens.Obter(ra);
                if (original == null || original.ParaId != r.Id) throw new RegraException("Mensagem não encontrada.", 404);
                paraReinoId = original.DeId; localId = null;
            }
            int hex; long? lid = null; var porReino = false;
            if (paraReinoId is long pid)
            {
                var para = m.Reinos.Obter(pid);
                if (para == null || !para.Ativo || para.Id == r.Id) throw new RegraException("Reino não encontrado.", 404);
                if (original == null && !Conhecimento.Conhece(r, pid)) throw new RegraException("Para um reino que você não conhece, mande o mensageiro a um local dele.");
                var c = m.Locais.Obter(para.CasteloId) ?? throw new RegraException("Esse reino não tem castelo.");
                hex = c.Hex; lid = c.Id; porReino = true;
            }
            else if (localId is long l0)
            {
                var l = m.Locais.Obter(l0);
                if (l == null || !Nevoas.Explorado(m, r.Id, l.Hex)) throw new RegraException("Local não encontrado.", 404);
                if (l.ReinoId == r.Id) throw new RegraException("Esse local é seu.");
                if (l.ReinoId == 0 || l.Ruina) throw new RegraException("Esse local não tem dono para receber a mensagem.");
                hex = l.Hex; lid = l.Id;
            }
            else throw new RegraException("Escolha para quem vai a mensagem.");
            if (r.MensageirosLivres < 1) throw new RegraException("Nenhum mensageiro livre: treine outro ou espere um voltar.");
            var castelo = m.Locais.Obter(r.CasteloId);
            if (castelo == null || castelo.ReinoId != r.Id) throw new RegraException("Mensageiros saem do castelo.");
            var vel = m.P.Mensageiro.Vel;
            var rota = Caminhos.Calcular(m, castelo.Hex, hex, vel, new OpcoesCaminho { ReinoId = r.Id });
            if (rota.Hexes[^1] != hex) throw new RegraException("Não há caminho até o destino.");
            var msg = m.Mensagens.Adicionar(new Mensagem
            {
                DeId = r.Id, ParaId = porReino ? paraReinoId!.Value : 0, PorReino = porReino, LocalId = lid, Hex = hex, Texto = texto,
                Enviada = m.Agora, RespondeA = respondeA,
            });
            r.MensageirosLivres--; m.Sujar(r);
            var mc = new Mensageiro { ReinoId = r.Id, MensagemId = msg.Id, Vel = vel };
            mc.Partir(m, rota);
            msg.MarchaId = mc.Id; m.Sujar(msg);
            Podar(m, r.Id);
            m.Avisar(r.Id, "mensagem"); m.Avisar(r.Id, "reino");
            return msg;
        }

        internal static void Chegou(Mundo m, Mensageiro mc)
        {
            var r = m.Reinos.Obter(mc.ReinoId);
            if (mc.Retornando || r == null || !r.Ativo)
            {
                mc.Encerrar(m);
                if (r != null && r.Ativo) { r.MensageirosLivres++; m.Sujar(r); m.Avisar(r.Id, "reino"); }
                return;
            }
            var msg = m.Mensagens.Obter(mc.MensagemId);
            if (msg != null) Entregar(m, r, msg, mc.Destino);
            // volta para casa
            var castelo = m.Locais.Obter(r.CasteloId);
            var rota = castelo != null ? Caminhos.Calcular(m, mc.Destino, castelo.Hex, mc.Vel, new OpcoesCaminho { ReinoId = r.Id }) : null;
            if (rota == null || rota.Hexes.Count < 2 || rota.Hexes[^1] != castelo!.Hex) { mc.Encerrar(m); r.MensageirosLivres++; m.Sujar(r); return; }
            mc.Retornando = true;
            mc.Partir(m, rota);
        }

        private static void Entregar(Mundo m, Reino de, Mensagem msg, int hex)
        {
            Reino? para;
            if (msg.PorReino) para = m.Reinos.Obter(msg.ParaId);
            else
            {
                var l = m.LocalNoHex(hex);
                para = l != null && !l.Ruina && l.ReinoId != 0 && l.ReinoId != de.Id ? m.Reinos.Obter(l.ReinoId) : null;
            }
            if (para == null || !para.Ativo)
            {
                msg.Estado = SemDestinatario; msg.Entregue = m.Agora; m.Sujar(msg);
                Registros.Notificar(m, de.Id, "mensagens", "Ninguém recebeu a mensagem", "O local não tinha mais dono. O mensageiro volta.", "mensagens");
                m.Avisar(de.Id, "mensagem");
                return;
            }
            msg.ParaId = para.Id; msg.Estado = EntregueE; msg.Entregue = m.Agora; m.Sujar(msg);
            Conhecimento.Conhecer(m, para, de, "mensagem");   // a mensagem revela quem a mandou
            var previa = msg.Texto.Length > 60 ? msg.Texto[..60] + "…" : msg.Texto;
            Registros.Notificar(m, para.Id, "mensagens", "Mensageiro de " + de.Nome, "“" + previa + "”", "mensagens");
            Registros.Notificar(m, de.Id, "mensagens", "Mensagem entregue", "O mensageiro volta para o castelo.", "mensagens");
            Podar(m, para.Id);
            m.Avisar(para.Id, "mensagem"); m.Avisar(de.Id, "mensagem");
        }

        /// <summary>Quem mandou pode saber quem recebeu? Só se mandou a um reino conhecido, ou se o destinatário respondeu.</summary>
        public static bool DestinatarioConhecido(Mundo m, Mensagem msg) =>
            msg.PorReino || (msg.ParaId != 0 && m.Mensagens.Any(x => x.RespondeA == msg.Id && x.DeId == msg.ParaId && x.Estado == EntregueE));

        public static IEnumerable<Mensagem> Recebidas(Mundo m, long reinoId) => m.Mensagens.Where(x => x.ParaId == reinoId && x.Estado == EntregueE);
        public static IEnumerable<Mensagem> Enviadas(Mundo m, long reinoId) => m.Mensagens.Where(x => x.DeId == reinoId);

        public static int LerTodas(Mundo m, Reino r)
        {
            var n = 0;
            foreach (var x in Recebidas(m, r.Id)) if (!x.Lida) { x.Lida = true; m.Sujar(x); n++; }
            return n;
        }

        /// <summary>Guarda até <c>P.social.caixa</c> mensagens por reino (as mais antigas saem; as a caminho ficam).</summary>
        private static void Podar(Mundo m, long reinoId)
        {
            var max = m.P.Social.Caixa;
            var l = m.Mensagens.Where(x => (x.DeId == reinoId || x.ParaId == reinoId) && x.Estado != ACaminho).OrderBy(x => x.Id).ToList();
            foreach (var x in l.Take(Math.Max(0, l.Count - max))) m.Mensagens.Remover(x);
        }
    }
}

namespace ReinoDePedra.Jogo.Reinos
{
    public sealed partial class Reino
    {
        /// <summary>Mensageiros prontos no castelo (ocupam o teto).</summary>
        public int MensageirosLivres { get; set; }
    }
}

namespace ReinoDePedra.Jogo
{
    using ReinoDePedra.Jogo.Social;
    public sealed partial class Mundo
    {
        public Colecao<Mensagem> Mensagens { get; } = new("mensagens");
    }
}
