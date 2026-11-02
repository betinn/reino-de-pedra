using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.Social
{
    /// <summary>
    /// Proposta de um reino a outro, aceita ou recusada pelo destinatário: troca direta ("dou X, quero Y"), pacto de não agressão
    /// ou pedido de recursos a um aliado. A proposta revela quem propõe. Sem resposta, expira em <c>P.social.propostaH</c>.
    /// </summary>
    public sealed class Proposta : Documento
    {
        /// <summary>"troca", "pacto" ou "pedido".</summary>
        public string Tipo { get; set; } = Comercio.Troca;
        public long DeId { get; set; }
        public long ParaId { get; set; }
        /// <summary>O que quem propõe dá (no pacto: o pagamento, se ele paga).</summary>
        public Recursos Da { get; set; } = new();
        /// <summary>O que quem propõe quer (no pacto: o pagamento, se o outro paga; no pedido: a ajuda).</summary>
        public Recursos Quer { get; set; } = new();
        /// <summary>Pedido: local do pedinte que recebe a ajuda.</summary>
        public long? LocalId { get; set; }
        public int Dias { get; set; }
        public string Recado { get; set; } = "";
        public long Quando { get; set; }
        public long Ate { get; set; }
        /// <summary>"aberta", "aceita", "recusada", "cancelada" ou "expirada".</summary>
        public string Estado { get; set; } = Comercio.Aberta;
        public long? Respondida { get; set; }
    }

    /// <summary>Pacto de não agressão entre dois reinos: começa quando o pagamento chega e dura de 1 a 7 dias.</summary>
    public sealed class Pacto : Documento
    {
        public long AId { get; set; }
        public long BId { get; set; }
        public int Dias { get; set; }
        public long? PagadorId { get; set; }
        public Recursos Pagamento { get; set; } = new();
        /// <summary>"aguardando" (pagamento a caminho) ou "ativo".</summary>
        public string Estado { get; set; } = Comercio.Aguardando;
        public long Aceito { get; set; }
        public long Inicio { get; set; }
        public long Fim { get; set; }
        public long? EventoId { get; set; }

        public bool Entre(long a, long b) => (AId == a && BId == b) || (AId == b && BId == a);
        public bool Com(long a) => AId == a || BId == a;
        public long Outro(long a) => AId == a ? BId : AId;
    }

    /// <summary>Diferença entre o que um reino sob escudo de novato deu e recebeu numa transação (para o limite diário).</summary>
    public sealed class RegistroNovato
    {
        public long Quando { get; set; }
        public double Valor { get; set; }
    }

    /// <summary>
    /// Comércio e diplomacia (CLAUDE.md): sem mercado global e sem chat geral. Troca direta só com reinos conhecidos; as duas
    /// cargas saem dos locais mais próximos e viajam visíveis (roubáveis). Pacto de não agressão garantido pelo jogo.
    /// Pedido de recursos a aliados. Pagamento de resgate. Limite do novato por dia, em valor de referência.
    /// Os métodos de aceitar servem também para a IA (mesmas regras dos jogadores).
    /// </summary>
    public static class Comercio
    {
        public const string Troca = "troca", PactoT = "pacto", Pedido = "pedido", Resgate = "resgate";
        public const string Aberta = "aberta", Aceita = "aceita", Recusada = "recusada", Cancelada = "cancelada", Expirada = "expirada";
        public const string Aguardando = "aguardando", Ativo = "ativo";

        // ---------------------------------------------------------------- utilidades

        private static Reino Outro(Mundo m, long id) =>
            m.Reinos.Obter(id) is { Ativo: true } r ? r : throw new RegraException("Reino não encontrado.", 404);

        /// <summary>Troca e propostas só com reinos conhecidos (aliados também se conhecem).</summary>
        public static bool PodeNegociar(Reino r, Reino outro) => outro.Id != r.Id && Conhecimento.Conhece(r, outro.Id);

        private static string Recado(Mundo m, string? recado)
        {
            var t = System.Text.RegularExpressions.Regex.Replace((recado ?? "").Trim(), @"\s+", " ");
            var max = m.P.Mensageiro.RecadoProposta;
            if (t.Length > max) throw new RegraException($"O recado pode ter até {max} caracteres.");
            return t;
        }

        public static IEnumerable<Proposta> Para(Mundo m, long reinoId) => m.Propostas.Where(p => p.ParaId == reinoId);
        public static IEnumerable<Proposta> De(Mundo m, long reinoId) => m.Propostas.Where(p => p.DeId == reinoId);
        /// <summary>Propostas abertas para o reino (a IA lê daqui).</summary>
        public static IEnumerable<Proposta> Abertas(Mundo m, long reinoId) => Para(m, reinoId).Where(p => p.Estado == Aberta && p.Ate > m.Agora);

        private static Proposta Nova(Mundo m, Proposta p)
        {
            p.Quando = m.Agora; p.Ate = m.Agora + T.DeHoras(m.P.Social.PropostaH);
            m.Propostas.Adicionar(p);
            m.Agendar(new FimPropostaEvento { PropostaId = p.Id, Quando = p.Ate });
            m.Avisar(p.DeId, "comercio"); m.Avisar(p.ParaId, "comercio");
            return p;
        }

        private static Proposta Aberta_(Mundo m, Reino r, long id, string tipo)
        {
            var p = m.Propostas.Obter(id);
            if (p == null || p.ParaId != r.Id || p.Tipo != tipo) throw new RegraException("Proposta não encontrada.", 404);
            if (p.Estado != Aberta || p.Ate <= m.Agora) throw new RegraException("Esta proposta não vale mais.");
            return p;
        }

        private static void Responder(Mundo m, Proposta p, string estado)
        {
            p.Estado = estado; p.Respondida = m.Agora; m.Sujar(p);
            m.Avisar(p.DeId, "comercio"); m.Avisar(p.ParaId, "comercio");
            if (p.Tipo == Pedido) { m.Avisar(p.DeId, "alianca"); m.Avisar(p.ParaId, "alianca"); }
        }

        // ---------------------------------------------------------------- limite do novato

        /// <summary>Quanto da diferença diária (em valor) o reino sob escudo já usou na janela de <c>P.social.novatoJanelaH</c>.</summary>
        public static double NovatoUsado(Mundo m, Reino r)
        {
            var desde = m.Agora - T.DeHoras(m.P.Social.NovatoJanelaH);
            return r.Novato.Where(x => x.Quando > desde).Sum(x => x.Valor);
        }
        /// <summary>Quanto ainda cabe hoje; infinito se o reino não está sob escudo.</summary>
        public static double NovatoRestante(Mundo m, Reino r) =>
            r.SobEscudo(m.Agora) ? Math.Max(0, m.P.Comercio.NovatoDia - NovatoUsado(m, r)) : double.PositiveInfinity;

        /// <summary>
        /// Enquanto um reino está sob escudo de novato, a diferença entre o que ele dá e o que recebe (trocas, ajudas, pagamentos),
        /// em valor de referência, fica em até <c>P.comercio.novatoDia</c> por dia. <paramref name="daQuem"/> é o que
        /// <paramref name="quem"/> (quem age) dá a <paramref name="outro"/> e vice-versa.
        /// O escudo só é descoberto ao chegar: o limite de <paramref name="quem"/> (o próprio) e o de um aliado lançam com a explicação;
        /// o de outro reino não é dito a quem age: devolve esse reino para quem chama decidir (conferir no aceite, cancelar sem motivo).
        /// </summary>
        public static Reino? ConferirNovato(Mundo m, Reino quem, Reino outro, IReadOnlyDictionary<string, double> daQuem, IReadOnlyDictionary<string, double> daOutro)
        {
            var dif = Math.Abs(Remessas.Valor(m, daQuem) - Remessas.Valor(m, daOutro));
            if (dif < 1e-6) return null;
            if (dif > NovatoRestante(m, quem) + 1e-6) throw ExcedeNovato(m, quem, dif);
            if (dif <= NovatoRestante(m, outro) + 1e-6) return null;
            if (Aliancas.SaoAliados(m, quem.Id, outro.Id)) throw ExcedeNovato(m, outro, dif);
            return outro;
        }

        private static RegraException ExcedeNovato(Mundo m, Reino x, double dif) =>
            new(x.Nome + " está sob escudo de novato: a diferença entre o que dá e recebe fica em até " +
                Combate.Combates.Num(m.P.Comercio.NovatoDia) + " de valor por dia. Hoje restam " + Combate.Combates.Num(NovatoRestante(m, x)) +
                "; esta tem " + Combate.Combates.Num(Math.Ceiling(dif)) + ".");

        /// <summary>
        /// No aceite, a parte de quem propôs (sob escudo, não aliado) deixou de caber no limite: a proposta é cancelada, quem propôs
        /// fica sabendo por quê, e quem aceita recebe só que ela não vale mais.
        /// </summary>
        private static RegraException CancelarPorNovato(Mundo m, Proposta p, Reino propos)
        {
            Responder(m, p, Cancelada);
            Registros.Notificar(m, propos.Id, "comercio", "Proposta cancelada", "Seu reino está sob escudo de novato e a diferença de valor passaria do limite de hoje.", "comercio");
            return new RegraException("Esta proposta não vale mais.");
        }

        private static void RegistrarNovato(Mundo m, Reino a, Reino b, IReadOnlyDictionary<string, double> daA, IReadOnlyDictionary<string, double> daB)
        {
            var dif = Math.Abs(Remessas.Valor(m, daA) - Remessas.Valor(m, daB));
            if (dif < 1e-6) return;
            var desde = m.Agora - T.DeHoras(m.P.Social.NovatoJanelaH);
            foreach (var x in new[] { a, b })
            {
                if (!x.SobEscudo(m.Agora)) continue;
                x.Novato.RemoveAll(y => y.Quando <= desde);
                x.Novato.Add(new RegistroNovato { Quando = m.Agora, Valor = dif });
                m.Sujar(x);
            }
        }

        // ---------------------------------------------------------------- troca direta

        /// <summary>"Dou X, quero Y" para um reino conhecido. A proposta revela quem propõe.</summary>
        public static Proposta ProporTroca(Mundo m, Reino r, long paraId, IReadOnlyDictionary<string, double>? da, IReadOnlyDictionary<string, double>? quer, string? recado)
        {
            var para = Outro(m, paraId);
            if (!PodeNegociar(r, para)) throw new RegraException("Troca só com reinos que você conhece.");
            var d = Remessas.Ler(m, da); var q = Remessas.Ler(m, quer);
            if (d.Keys.Any(q.ContainsKey)) throw new RegraException("Escolha recursos diferentes para dar e receber.");
            var txt = Recado(m, recado);
            Remessas.Conferir(m, r, d);
            ConferirNovato(m, r, para, d, q);   // o limite do outro (se não for aliado) fica para o aceite
            var p = Nova(m, new Proposta { Tipo = Troca, DeId = r.Id, ParaId = para.Id, Da = d, Quer = q, Recado = txt });
            Conhecimento.Conhecer(m, para, r, "proposta");
            Registros.Notificar(m, para.Id, "comercio", "Proposta de troca de " + r.Nome, "Oferece " + Remessas.Texto(d) + " por " + Remessas.Texto(q) + ".", "comercio");
            return p;
        }

        /// <summary>Aceita a troca: as duas cargas saem na hora dos locais mais próximos de cada lado (a IA comerciante também usa).</summary>
        public static void AceitarTroca(Mundo m, Reino r, long propostaId)
        {
            var p = Aberta_(m, r, propostaId, Troca);
            var de = m.Reinos.Obter(p.DeId);
            if (de == null || !de.Ativo) { Responder(m, p, Cancelada); throw new RegraException("O outro reino não existe mais."); }
            if (ConferirNovato(m, r, de, p.Quer, p.Da) != null) throw CancelarPorNovato(m, p, de);
            Remessas.Conferir(m, r, p.Quer);
            Remessas.Conferir(m, de, p.Da, de.Nome);
            Remessas.Enviar(m, de, r, null, p.Da, Troca, p.Id);
            Remessas.Enviar(m, r, de, null, p.Quer, Troca, p.Id);
            RegistrarNovato(m, de, r, p.Da, p.Quer);
            Responder(m, p, Aceita);
            Registros.Notificar(m, de.Id, "comercio", r.Nome + " aceitou a troca", "Sua parte já saiu: " + Remessas.Texto(p.Da) + ". As duas cargas podem ser roubadas.", "comercio");
        }

        // ---------------------------------------------------------------- pedido de recursos a aliado

        public static Proposta PedirRecursos(Mundo m, Reino r, long aliadoId, IReadOnlyDictionary<string, double>? recursos, long? localId, string? recado)
        {
            var al = Outro(m, aliadoId);
            if (!Aliancas.SaoAliados(m, r.Id, al.Id)) throw new RegraException("Só se pede recursos a aliados.");
            var q = Remessas.Ler(m, recursos);
            var l = m.Locais.Obter(localId ?? r.CasteloId);
            if (l == null || l.ReinoId != r.Id || l.Ruina) throw new RegraException("Escolha um local seu para receber.");
            var txt = Recado(m, recado);
            ConferirNovato(m, r, al, new Recursos(), q);   // aliados: o limite dos dois é dito
            var p = Nova(m, new Proposta { Tipo = Pedido, DeId = r.Id, ParaId = al.Id, Quer = q, LocalId = l.Id, Recado = txt });
            Registros.Notificar(m, al.Id, "alianca", r.Nome + " pede recursos", Remessas.Texto(q) + ". Aceite ou recuse em Aliança.", "alianca");
            m.Avisar(r.Id, "alianca"); m.Avisar(al.Id, "alianca");
            return p;
        }

        /// <summary>O aliado aceita: a ajuda sai dos locais mais próximos dele, viaja visível e pode ser roubada.</summary>
        public static void AceitarPedido(Mundo m, Reino r, long propostaId)
        {
            var p = Aberta_(m, r, propostaId, Pedido);
            var pedinte = m.Reinos.Obter(p.DeId);
            if (pedinte == null || !pedinte.Ativo || !Aliancas.SaoAliados(m, r.Id, pedinte.Id)) { Responder(m, p, Cancelada); throw new RegraException("Vocês não são mais aliados."); }
            ConferirNovato(m, r, pedinte, p.Quer, new Recursos());
            var l = p.LocalId is long id ? m.Locais.Obter(id) : null;
            if (l == null || l.ReinoId != pedinte.Id || l.Ruina) l = null;
            Remessas.Enviar(m, r, pedinte, l, p.Quer, Pedido, p.Id);
            RegistrarNovato(m, r, pedinte, p.Quer, new Recursos());
            Responder(m, p, Aceita);
            Registros.Notificar(m, pedinte.Id, "alianca", r.Nome + " mandou a ajuda", Remessas.Texto(p.Quer) + " a caminho. Pode ser roubada no caminho.", "alianca");
        }

        // ---------------------------------------------------------------- pacto de não agressão

        public static IEnumerable<Pacto> PactosDe(Mundo m, long reinoId) => m.Pactos.Where(p => p.Com(reinoId));
        public static Pacto? PactoEntre(Mundo m, long a, long b) => m.Pactos.FirstOrDefault(p => p.Entre(a, b));
        /// <summary>Pacto em vigor entre os dois: nenhum ataca, saqueia ou intercepta o outro.</summary>
        public static bool PactoAtivo(Mundo m, long a, long b) => m.Pactos.Any(p => p.Entre(a, b) && p.Estado == Ativo && p.Fim > m.Agora);

        private static void ConferirPacto(Mundo m, Reino a, Reino b, int dias, Reino? pagador, Reino quemCobra, Reino quemAge)
        {
            if (Aliancas.SaoAliados(m, a.Id, b.Id)) throw new RegraException("Aliados já não se atacam.");
            if (dias < m.P.Pacto.DiasMin || dias > m.P.Pacto.DiasMax) throw new RegraException($"O pacto dura de {m.P.Pacto.DiasMin} a {m.P.Pacto.DiasMax} dias.");
            if (PactoEntre(m, a.Id, b.Id) != null) throw new RegraException("Já há um pacto com este reino.");
            foreach (var x in new[] { a, b })
                if (PactosDe(m, x.Id).Count() >= m.P.Pacto.AtivosMax)
                    throw new RegraException(x.Nome + $" já tem {m.P.Pacto.AtivosMax} pactos, o máximo.");
            // ninguém cobra pacto de quem tem escudo; quem propõe não fica sabendo do escudo: é recusado a quem paga, no aceite
            if (pagador != null && pagador.Id != quemCobra.Id && pagador.Id == quemAge.Id && pagador.SobEscudo(m.Agora))
                throw new RegraException("Seu reino está sob escudo de novato: ninguém pode cobrar pacto dele.");
        }

        /// <summary>
        /// Propõe um pacto de <paramref name="dias"/> dias. <paramref name="pagador"/>: "eu" (quem propõe paga), "outro" (cobra do outro)
        /// ou null (sem pagamento).
        /// </summary>
        public static Proposta ProporPacto(Mundo m, Reino r, long paraId, int dias, string? pagador, IReadOnlyDictionary<string, double>? pagamento, string? recado)
        {
            var para = Outro(m, paraId);
            if (!PodeNegociar(r, para)) throw new RegraException("Pacto só com reinos que você conhece.");
            if (pagador is not (null or "" or "eu" or "outro")) throw new RegraException("Diga quem paga.");
            var paga = pagador == "eu" ? r : pagador == "outro" ? para : null;
            var carga = paga != null ? Remessas.Ler(m, pagamento) : new Recursos();
            ConferirPacto(m, r, para, dias, paga, r, r);
            if (m.Propostas.Any(x => x.Tipo == PactoT && x.Estado == Aberta && x.Ate > m.Agora && ((x.DeId == r.Id && x.ParaId == para.Id) || (x.DeId == para.Id && x.ParaId == r.Id))))
                throw new RegraException("Já há uma proposta de pacto aberta com este reino.");
            var txt = Recado(m, recado);
            if (paga == r) Remessas.Conferir(m, r, carga);
            ConferirNovato(m, r, para, paga == r ? carga : new Recursos(), paga == para ? carga : new Recursos());   // o do outro, no aceite
            var p = Nova(m, new Proposta
            {
                Tipo = PactoT, DeId = r.Id, ParaId = para.Id, Dias = dias, Recado = txt,
                Da = paga == r ? carga : new Recursos(), Quer = paga == para ? carga : new Recursos(),
            });
            Conhecimento.Conhecer(m, para, r, "proposta");
            Registros.Notificar(m, para.Id, "comercio", r.Nome + " propõe um pacto", dias + (dias > 1 ? " dias" : " dia") + " sem ataques · " +
                (paga == r ? "paga " + Remessas.Texto(carga) : paga == para ? "cobra " + Remessas.Texto(carga) : "sem pagamento") + ".", "comercio");
            return p;
        }

        /// <summary>Aceita o pacto: sem pagamento, começa agora; com pagamento, quando a carga chegar (se for roubada, não começa).</summary>
        public static Pacto AceitarPacto(Mundo m, Reino r, long propostaId)
        {
            var p = Aberta_(m, r, propostaId, PactoT);
            var de = m.Reinos.Obter(p.DeId);
            if (de == null || !de.Ativo) { Responder(m, p, Cancelada); throw new RegraException("O outro reino não existe mais."); }
            var pagador = p.Da.Count > 0 ? de : p.Quer.Count > 0 ? r : null;
            var carga = p.Da.Count > 0 ? p.Da : p.Quer;
            ConferirPacto(m, de, r, p.Dias, pagador, de, r);
            if (pagador != null) Remessas.Conferir(m, pagador, carga, pagador.Id == r.Id ? null : pagador.Nome);
            if (ConferirNovato(m, r, de, p.Quer, p.Da) != null) throw CancelarPorNovato(m, p, de);
            var pc = m.Pactos.Adicionar(new Pacto { AId = de.Id, BId = r.Id, Dias = p.Dias, PagadorId = pagador?.Id, Pagamento = carga.Copia(), Aceito = m.Agora });
            Responder(m, p, Aceita);
            if (pagador == null) { Iniciar(m, pc); return pc; }
            var recebe = pagador.Id == de.Id ? r : de;
            Remessas.Enviar(m, pagador, recebe, null, carga, PactoT, pc.Id);
            RegistrarNovato(m, de, r, p.Da, p.Quer);
            var txt = "Começa quando o pagamento (" + Remessas.Texto(carga) + ") chegar. Se for roubado no caminho, não começa.";
            Registros.Notificar(m, de.Id, "comercio", r.Nome + " aceitou o pacto", txt, "comercio");
            Registros.Notificar(m, r.Id, "comercio", "Pacto aceito com " + de.Nome, txt, "comercio");
            return pc;
        }

        private static void Iniciar(Mundo m, Pacto pc)
        {
            pc.Estado = Ativo; pc.Inicio = m.Agora; pc.Fim = m.Agora + pc.Dias * T.Dia;
            pc.EventoId = m.Agendar(new FimPactoEvento { PactoId = pc.Id, Quando = pc.Fim }).Id;
            m.Sujar(pc);
            foreach (var (a, b) in new[] { (pc.AId, pc.BId), (pc.BId, pc.AId) })
            {
                var outro = m.Reinos.Obter(b)?.Nome ?? "";
                Registros.Notificar(m, a, "comercio", "Pacto em vigor com " + outro, pc.Dias + (pc.Dias > 1 ? " dias" : " dia") + ": o jogo impede ataques, saques e interceptações entre vocês.", "comercio");
                m.Avisar(a, "comercio");
            }
        }

        internal static void PagamentoPacto(Mundo m, Remessa r, bool ok)
        {
            if (m.Pactos.Obter(r.RefId) is not { } pc || pc.Estado != Aguardando) return;
            if (ok) { Iniciar(m, pc); return; }
            m.Pactos.Remover(pc);
            foreach (var id in new[] { pc.AId, pc.BId })
            {
                Registros.Notificar(m, id, "comercio", "Pacto não começou", "O pagamento foi roubado no caminho.", "comercio");
                m.Avisar(id, "comercio");
            }
        }

        internal static void FimPacto(Mundo m, Pacto pc)
        {
            m.Pactos.Remover(pc);
            foreach (var (a, b) in new[] { (pc.AId, pc.BId), (pc.BId, pc.AId) })
            {
                Registros.Notificar(m, a, "comercio", "Pacto terminou", "Acabou o pacto com " + (m.Reinos.Obter(b)?.Nome ?? "") + ": nada mais impede ataques entre vocês.", "comercio");
                m.Avisar(a, "comercio");
            }
        }

        // ---------------------------------------------------------------- resgate de explorador

        /// <summary>O dono paga o resgate pedido: a carga vai ao castelo de quem capturou; quando chega, o explorador é libertado.</summary>
        public static void PagarResgate(Mundo m, Reino r, long prisioneiroId)
        {
            var p = m.Prisioneiros.Obter(prisioneiroId);
            if (p == null || p.DonoId != r.Id) throw new RegraException("Prisioneiro não encontrado.", 404);
            if (p.Estado != Capturas.ResgatePedido) throw new RegraException("Ninguém pediu resgate por este explorador.");
            if (Remessas.Do(m, Resgate, p.Id).Any()) throw new RegraException("O resgate já está a caminho.");
            var captor = Outro(m, p.CaptorId);
            if (ConferirNovato(m, r, captor, p.Resgate, new Recursos()) != null)
                throw new RegraException("O resgate não pode ser pago agora. Tente mais tarde.");   // não diz por quê: o escudo do captor só se descobre ao chegar
            Remessas.Enviar(m, r, captor, null, p.Resgate, Resgate, p.Id);
            RegistrarNovato(m, r, captor, p.Resgate, new Recursos());
            r.ResgatesRecusados.Remove(p.Id); m.Sujar(r);
            Registros.Notificar(m, captor.Id, "comercio", r.Nome + " pagou o resgate", "A carga (" + Remessas.Texto(p.Resgate) + ") está a caminho: quando chegar, o explorador é solto.", "exploradores");
            m.Avisar(r.Id, "comercio"); m.Avisar(captor.Id, "comercio");
        }

        /// <summary>O dono não vai pagar: quem capturou é avisado (decide até o fim do prazo; sem decisão, o explorador é libertado).</summary>
        public static void RecusarResgate(Mundo m, Reino r, long prisioneiroId)
        {
            var p = m.Prisioneiros.Obter(prisioneiroId);
            if (p == null || p.DonoId != r.Id || p.Estado != Capturas.ResgatePedido) throw new RegraException("Prisioneiro não encontrado.", 404);
            r.ResgatesRecusados.RemoveWhere(id => m.Prisioneiros.Obter(id) == null);
            r.ResgatesRecusados.Add(p.Id); m.Sujar(r);
            Registros.Notificar(m, p.CaptorId, "comercio", r.Nome + " não vai pagar o resgate", "Liberte ou execute o explorador; sem decisão, ele é solto no fim do prazo.", "exploradores");
            m.Avisar(r.Id, "comercio");
        }

        internal static void PagamentoResgate(Mundo m, Remessa rem, bool ok)
        {
            var p = m.Prisioneiros.Obter(rem.RefId);
            if (p == null) return;   // já foi libertado ou executado
            if (ok) { Capturas.PagarResgate(m, p); return; }
            Registros.Notificar(m, p.DonoId, "comercio", "Resgate roubado no caminho", "O explorador continua preso.", "comercio");
            Registros.Notificar(m, p.CaptorId, "comercio", "O resgate não chegou", "Foi roubado no caminho.", "exploradores");
        }

        internal static void Entregue(Mundo m, Remessa r, bool ok, string motivo)
        {
            if (!ok) return;
            var de = m.Reinos.Obter(r.ReinoId)?.Nome ?? "";
            Registros.Notificar(m, r.ParaReinoId, motivo == Pedido ? "alianca" : "comercio", "Carga chegou", "De " + de + ".", motivo == Pedido ? "alianca" : "comercio");
        }

        // ---------------------------------------------------------------- recusar, cancelar, expirar

        public static void Recusar(Mundo m, Reino r, long propostaId)
        {
            var p = m.Propostas.Obter(propostaId);
            if (p == null || p.ParaId != r.Id) throw new RegraException("Proposta não encontrada.", 404);
            if (p.Estado != Aberta) throw new RegraException("Esta proposta não vale mais.");
            Responder(m, p, Recusada);
            var nome = p.Tipo == Troca ? "a troca" : p.Tipo == PactoT ? "o pacto" : "o pedido";
            Registros.Notificar(m, p.DeId, p.Tipo == Pedido ? "alianca" : "comercio", r.Nome + " recusou " + nome, null, p.Tipo == Pedido ? "alianca" : "comercio");
        }

        public static void Cancelar(Mundo m, Reino r, long propostaId)
        {
            var p = m.Propostas.Obter(propostaId);
            if (p == null || p.DeId != r.Id) throw new RegraException("Proposta não encontrada.", 404);
            if (p.Estado != Aberta) throw new RegraException("Esta proposta não vale mais.");
            Responder(m, p, Cancelada);
        }

        internal static void FimProposta(Mundo m, Proposta p)
        {
            if (p.Estado == Aberta)
                Registros.Notificar(m, p.DeId, p.Tipo == Pedido ? "alianca" : "comercio", "Proposta sem resposta",
                    (m.Reinos.Obter(p.ParaId)?.Nome ?? "O outro reino") + " não respondeu a tempo.", p.Tipo == Pedido ? "alianca" : "comercio");
            m.Propostas.Remover(p);
            m.Avisar(p.DeId, "comercio"); m.Avisar(p.ParaId, "comercio");
        }
    }

    public sealed class FimPropostaEvento : Evento
    {
        public long PropostaId { get; set; }
        public override void Executar(Mundo m) { if (m.Propostas.Obter(PropostaId) is { } p) Comercio.FimProposta(m, p); }
    }

    public sealed class FimPactoEvento : Evento
    {
        public long PactoId { get; set; }
        public override void Executar(Mundo m) { if (m.Pactos.Obter(PactoId) is { } p && p.EventoId == Id) Comercio.FimPacto(m, p); }
    }
}

namespace ReinoDePedra.Jogo.Reinos
{
    public sealed partial class Reino
    {
        /// <summary>Diferenças de valor das transações sob escudo de novato (janela de <c>P.social.novatoJanelaH</c>).</summary>
        public List<Social.RegistroNovato> Novato { get; set; } = new();
        /// <summary>Resgates que o reino disse que não vai pagar (prisioneiros).</summary>
        public HashSet<long> ResgatesRecusados { get; set; } = new();
    }
}

namespace ReinoDePedra.Jogo
{
    using ReinoDePedra.Jogo.Social;
    public sealed partial class Mundo
    {
        public Colecao<Proposta> Propostas { get; } = new("propostas");
        public Colecao<Pacto> Pactos { get; } = new("pactos");
    }
}
