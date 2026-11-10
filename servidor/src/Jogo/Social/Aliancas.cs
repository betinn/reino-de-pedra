using System.Text.RegularExpressions;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.Social
{
    public sealed class MembroAlianca
    {
        public long ReinoId { get; set; }
        /// <summary>"lider", "conselheiro" ou "membro".</summary>
        public string Cargo { get; set; } = Aliancas.Membro;
        public long Desde { get; set; }
    }

    /// <summary>Convite (de líder ou conselheiro) ou pedido de entrada (do próprio reino), válido até <see cref="Ate"/>.</summary>
    public sealed class ConviteAlianca
    {
        public long ReinoId { get; set; }
        /// <summary>Quem convidou (no pedido de entrada, o próprio reino).</summary>
        public long PorId { get; set; }
        public long Quando { get; set; }
        public long Ate { get; set; }
    }

    /// <summary>Trégua garantida pelo jogo entre a aliança e um reino que saiu ou foi expulso.</summary>
    public sealed class TreguaAlianca
    {
        public long ReinoId { get; set; }
        public long Ate { get; set; }
        /// <summary>"saiu" ou "expulso".</summary>
        public string Como { get; set; } = "saiu";
    }

    /// <summary>
    /// Uma linha da conversa da aliança (o único chat do jogo): a fala de um membro ou um evento da aliança (alguém entrou,
    /// um aliado está sob ataque, um pedido de recursos...), que o jogo escreve na conversa para ela ter vida.
    /// </summary>
    public sealed class FalaAlianca
    {
        public long Id { get; set; }
        /// <summary>Quem falou, ou de quem é o evento (0: a própria aliança).</summary>
        public long ReinoId { get; set; }
        public string Texto { get; set; } = "";
        public long Quando { get; set; }
        /// <summary>"fala" (um membro escreveu) ou "evento" (o jogo registrou).</summary>
        public string Tipo { get; set; } = Aliancas.TipoFala;
        /// <summary>No evento, o que aconteceu: entrou, saiu, expulso, cargo, lider, modo, convite, indicacao, ataque, vitoria, derrota, pedido-recursos, ajuda, reforco, pedido-reforco, reliquia.</summary>
        public string? Evento { get; set; }
        /// <summary>Hexágono do mapa a que a linha se refere ("mostrar à aliança", local atacado): clicar centra o mapa lá.</summary>
        public int? Hex { get; set; }
        public long? LocalId { get; set; }
        /// <summary>Pedido de recursos da linha (o destinatário responde na própria linha).</summary>
        public long? PropostaId { get; set; }
        /// <summary>Outro reino da linha (o indicado, o convidado, a quem se pede).</summary>
        public long? AlvoId { get; set; }
        /// <summary>Reinos mencionados com @.</summary>
        public List<long> Mencoes { get; set; } = new();
        /// <summary>@todos (só líder e conselheiros).</summary>
        public bool Todos { get; set; }
    }

    /// <summary>
    /// Aliança de até <c>P.alianca</c> reinos: líder (convida, expulsa e promove), até <c>P.social.conselheiros</c> conselheiros
    /// (convidam e aceitam pedidos de entrada) e membros. Aliados se reconhecem, veem as marchas uns dos outros, pedem recursos,
    /// reforçam locais uns dos outros e não se atacam. Ao sair ou ser expulso, trégua de <c>P.treguaSaidaH</c> com a aliança.
    /// </summary>
    public sealed class Alianca : Documento
    {
        public string Nome { get; set; } = "";
        public Brasao Brasao { get; set; } = new();
        public long CriadaEm { get; set; }
        public List<MembroAlianca> Membros { get; set; } = new();
        public List<ConviteAlianca> Convites { get; set; } = new();
        public List<ConviteAlianca> Pedidos { get; set; } = new();
        public List<TreguaAlianca> Treguas { get; set; } = new();
        public List<FalaAlianca> Conversa { get; set; } = new();
        public long UltimaFala { get; set; }
        /// <summary>Aberta: quem pede para entrar entra na hora. Por convite (padrão): o pedido espera líder ou conselheiro.</summary>
        public bool Aberta { get; set; }
        /// <summary>Recado fixado pelo líder no topo da conversa.</summary>
        public string Recado { get; set; } = "";
        public long RecadoEm { get; set; }
        /// <summary>Até que linha cada membro já leu (para o contador de não lidas).</summary>
        public Dictionary<long, long> LidaAte { get; set; } = new();

        public MembroAlianca? Membro(long reinoId) => Membros.FirstOrDefault(x => x.ReinoId == reinoId);
        public MembroAlianca? Lider => Membros.FirstOrDefault(x => x.Cargo == Aliancas.Lider);
    }

    public static partial class Aliancas
    {
        public const string Lider = "lider", Conselheiro = "conselheiro", Membro = "membro";
        public const string TipoFala = "fala", TipoEvento = "evento";
        /// <summary>Categoria de notificação da conversa (o jogador liga e desliga o aviso de fala nova; a menção avisa sempre).</summary>
        public const string CategoriaConversa = "conversa";

        [GeneratedRegex(@"^[\p{L}\p{N}][\p{L}\p{M}\p{N} '\-]*[\p{L}\p{M}\p{N}]$")]
        private static partial Regex NomeValido();

        /// <summary>Quem está em regência não assume a liderança (a regência registra aqui).</summary>
        public static Func<Mundo, Reino, bool>? EmRegencia { get; set; }

        public static Alianca? De(Mundo m, Reino? r) => r?.AliancaId is long id ? m.Aliancas.Obter(id) : null;
        public static Alianca? De(Mundo m, long reinoId) => De(m, m.Reinos.Obter(reinoId));

        /// <summary>Os dois reinos estão na mesma aliança.</summary>
        public static bool SaoAliados(Mundo m, long a, long b) =>
            a != b && a != 0 && b != 0 && m.Reinos.Obter(a)?.AliancaId is long x && m.Reinos.Obter(b)?.AliancaId == x;

        /// <summary>Trégua de saída em vigor entre os dois (um saiu ou foi expulso da aliança do outro).</summary>
        public static bool EmTregua(Mundo m, long a, long b)
        {
            var agora = m.Agora;
            return De(m, a) is { } aa && aa.Treguas.Any(t => t.ReinoId == b && t.Ate > agora)
                || De(m, b) is { } ab && ab.Treguas.Any(t => t.ReinoId == a && t.Ate > agora);
        }

        public static IEnumerable<Reino> Membros(Mundo m, Alianca a) => a.Membros.Select(x => m.Reinos.Obter(x.ReinoId)).OfType<Reino>();

        private static Alianca Minha(Mundo m, Reino r) => De(m, r) ?? throw new RegraException("Você não está numa aliança.");

        private static void Podar(Mundo m, Alianca a)
        {
            var agora = m.Agora;
            a.Convites.RemoveAll(c => c.Ate <= agora);
            a.Pedidos.RemoveAll(c => c.Ate <= agora);
            a.Treguas.RemoveAll(t => t.Ate <= agora);
        }

        private static void AvisarMembros(Mundo m, Alianca a, string tipo = "alianca", object? dados = null)
        {
            foreach (var x in a.Membros) m.Avisar(x.ReinoId, tipo, dados);
        }

        private static void NotificarMembros(Mundo m, Alianca a, string titulo, string? texto, long? exceto = null)
        {
            foreach (var x in a.Membros) if (x.ReinoId != exceto) Registros.Notificar(m, x.ReinoId, "alianca", titulo, texto, "alianca");
        }

        private static void PodeEntrar(Mundo m, Reino r)
        {
            if (r.AliancaId != null) throw new RegraException("Você já está numa aliança.");
            if (r.AliancaLivreEm > m.Agora)
                throw new RegraException("Você saiu de uma aliança há pouco: só entra em outra depois de " + m.P.TreguaSaidaH + " h.");
        }

        public static string NormalizarNome(string? nome) => Regex.Replace((nome ?? "").Trim(), @"\s+", " ");

        // ---------------------------------------------------------------- criar, convidar, pedir para entrar

        public static Alianca Criar(Mundo m, Reino r, string? nome, Brasao? brasao = null, bool aberta = false)
        {
            PodeEntrar(m, r);
            nome = NormalizarNome(nome);
            var f = m.P.Social.NomeAlianca;
            if (nome.Length < f.Min || nome.Length > f.Max) throw new RegraException($"O nome da aliança precisa ter de {f.Min} a {f.Max} letras.");
            if (!NomeValido().IsMatch(nome)) throw new RegraException("Use só letras, números, espaços, hífen e apóstrofo.");
            if (m.Aliancas.Any(x => string.Equals(x.Nome, nome, StringComparison.OrdinalIgnoreCase))) throw new RegraException("Já existe uma aliança com esse nome.");
            if (brasao != null && !brasao.Valido()) throw new RegraException("Brasão inválido.");
            var a = m.Aliancas.Adicionar(new Alianca
            {
                Nome = nome, Brasao = brasao ?? Brasao.Aleatorio(m.Sorte), CriadaEm = m.Agora, Aberta = aberta,
                Membros = [new MembroAlianca { ReinoId = r.Id, Cargo = Lider, Desde = m.Agora }],
            });
            r.AliancaId = a.Id; m.Sujar(r);
            TirarPendencias(m, r, a.Id);
            Evento(m, a, "fundou", r.Nome + " fundou a aliança.", r.Id);
            m.Avisar(r.Id, "alianca"); m.Avisar(r.Id, "reino");
            return a;
        }

        /// <summary>Líder ou conselheiro convida um reino que conhece.</summary>
        public static ConviteAlianca Convidar(Mundo m, Reino r, long alvoId)
        {
            var a = Minha(m, r);
            Podar(m, a);
            var eu = a.Membro(r.Id)!;
            if (eu.Cargo == Membro) throw new RegraException("Só o líder e os conselheiros convidam.");
            var alvo = m.Reinos.Obter(alvoId);
            if (alvo == null || !alvo.Ativo || alvo.Id == r.Id) throw new RegraException("Reino não encontrado.", 404);
            if (a.Membro(alvoId) != null) throw new RegraException("Esse reino já é da aliança.");
            if (a.Membros.Count >= m.P.Alianca) throw new RegraException($"A aliança já tem {m.P.Alianca} reinos, o máximo.");
            if (a.Convites.Any(c => c.ReinoId == alvoId)) throw new RegraException("Esse reino já foi convidado.");
            var c = new ConviteAlianca { ReinoId = alvoId, PorId = r.Id, Quando = m.Agora, Ate = m.Agora + T.DeHoras(m.P.Social.PropostaH) };
            a.Convites.Add(c); m.Sujar(a);
            // o convite se responde no próprio aviso (Entrar / Recusar), sem abrir tela
            Registros.Notificar(m, alvo.Id, "alianca", "Convite para a aliança " + a.Nome, r.Nome + " convidou seu reino.", "alianca",
                acao: new System.Text.Json.Nodes.JsonObject { ["tipo"] = "convite-alianca", ["id"] = a.Id });
            m.Avisar(alvo.Id, "alianca");
            Evento(m, a, "convite", r.Nome + " convidou " + alvo.Nome + ".", r.Id, alvoId: alvo.Id);
            return c;
        }

        /// <summary>
        /// Um reino pede para entrar numa aliança. Aliança aberta: entra na hora (devolve null). Por convite: o pedido espera
        /// líder ou conselheiro, que respondem no próprio aviso.
        /// </summary>
        public static ConviteAlianca? PedirEntrada(Mundo m, Reino r, long aliancaId)
        {
            PodeEntrar(m, r);
            var a = m.Aliancas.Obter(aliancaId) ?? throw new RegraException("Aliança não encontrada.", 404);
            Podar(m, a);
            if (a.Membros.Count >= m.P.Alianca) throw new RegraException($"A aliança já tem {m.P.Alianca} reinos, o máximo.");
            if (a.Treguas.Any(t => t.ReinoId == r.Id && t.Como == "expulso")) throw new RegraException("Você foi expulso desta aliança há pouco.");
            if (a.Aberta) { Entrar(m, a, r); return null; }
            if (a.Pedidos.Any(c => c.ReinoId == r.Id)) throw new RegraException("Você já pediu para entrar.");
            var c = new ConviteAlianca { ReinoId = r.Id, PorId = r.Id, Quando = m.Agora, Ate = m.Agora + T.DeHoras(m.P.Social.PropostaH) };
            a.Pedidos.Add(c); m.Sujar(a);
            foreach (var x in a.Membros.Where(x => x.Cargo != Membro))
            {
                Registros.Notificar(m, x.ReinoId, "alianca", r.Nome + " pede para entrar", "Aceite ou recuse aqui mesmo.", "alianca",
                    acao: new System.Text.Json.Nodes.JsonObject { ["tipo"] = "pedido-entrada", ["id"] = r.Id });
            }
            Evento(m, a, "pedido-entrada", r.Nome + " pede para entrar.", r.Id, alvoId: r.Id);
            m.Avisar(r.Id, "alianca");
            return c;
        }

        /// <summary>Convites recebidos e ainda válidos.</summary>
        public static IEnumerable<(Alianca a, ConviteAlianca c)> ConvitesPara(Mundo m, long reinoId)
        {
            var agora = m.Agora;
            foreach (var a in m.Aliancas)
                foreach (var c in a.Convites)
                    if (c.ReinoId == reinoId && c.Ate > agora) yield return (a, c);
        }

        /// <summary>Pedidos de entrada feitos pelo reino e ainda válidos.</summary>
        public static IEnumerable<(Alianca a, ConviteAlianca c)> PedidosDe(Mundo m, long reinoId)
        {
            var agora = m.Agora;
            foreach (var a in m.Aliancas)
                foreach (var c in a.Pedidos)
                    if (c.ReinoId == reinoId && c.Ate > agora) yield return (a, c);
        }

        public static void AceitarConvite(Mundo m, Reino r, long aliancaId)
        {
            var a = m.Aliancas.Obter(aliancaId) ?? throw new RegraException("Aliança não encontrada.", 404);
            Podar(m, a);
            if (!a.Convites.Any(c => c.ReinoId == r.Id)) throw new RegraException("O convite não vale mais.");
            Entrar(m, a, r);
        }

        public static void RecusarConvite(Mundo m, Reino r, long aliancaId)
        {
            var a = m.Aliancas.Obter(aliancaId) ?? throw new RegraException("Aliança não encontrada.", 404);
            var c = a.Convites.FirstOrDefault(x => x.ReinoId == r.Id) ?? throw new RegraException("O convite não vale mais.");
            a.Convites.Remove(c); m.Sujar(a);
            Registros.Notificar(m, c.PorId, "alianca", r.Nome + " recusou o convite", null, "alianca");
            AvisarMembros(m, a); m.Avisar(r.Id, "alianca");
        }

        /// <summary>Líder ou conselheiro aceita o pedido de entrada.</summary>
        public static void AceitarPedido(Mundo m, Reino r, long reinoId)
        {
            var a = Minha(m, r);
            Podar(m, a);
            if (a.Membro(r.Id)!.Cargo == Membro) throw new RegraException("Só o líder e os conselheiros aceitam pedidos de entrada.");
            if (!a.Pedidos.Any(c => c.ReinoId == reinoId)) throw new RegraException("O pedido não vale mais.");
            var novo = m.Reinos.Obter(reinoId);
            if (novo == null || !novo.Ativo) throw new RegraException("Reino não encontrado.", 404);
            Entrar(m, a, novo);
        }

        public static void RecusarPedido(Mundo m, Reino r, long reinoId)
        {
            var a = Minha(m, r);
            if (a.Membro(r.Id)!.Cargo == Membro) throw new RegraException("Só o líder e os conselheiros respondem pedidos de entrada.");
            var c = a.Pedidos.FirstOrDefault(x => x.ReinoId == reinoId) ?? throw new RegraException("O pedido não vale mais.");
            a.Pedidos.Remove(c); m.Sujar(a);
            Registros.Notificar(m, reinoId, "alianca", "Pedido recusado", "A aliança " + a.Nome + " recusou seu pedido de entrada.", "alianca");
            AvisarMembros(m, a); m.Avisar(reinoId, "alianca");
        }

        private static void TirarPendencias(Mundo m, Reino r, long aliancaId)
        {
            foreach (var x in m.Aliancas)
            {
                var n = x.Convites.RemoveAll(c => c.ReinoId == r.Id) + x.Pedidos.RemoveAll(c => c.ReinoId == r.Id);
                if (n > 0) { m.Sujar(x); if (x.Id != aliancaId) AvisarMembros(m, x); }
            }
        }

        private static void Entrar(Mundo m, Alianca a, Reino r)
        {
            PodeEntrar(m, r);
            if (a.Membros.Count >= m.P.Alianca) throw new RegraException($"A aliança já tem {m.P.Alianca} reinos, o máximo.");
            a.Membros.Add(new MembroAlianca { ReinoId = r.Id, Cargo = Membro, Desde = m.Agora });
            r.AliancaId = a.Id; m.Sujar(r); m.Sujar(a);
            a.LidaAte[r.Id] = a.UltimaFala;   // a conversa de antes não conta como não lida
            TirarPendencias(m, r, a.Id);
            Evento(m, a, "entrou", r.Nome + " entrou na aliança.", r.Id);
            NotificarMembros(m, a, r.Nome + " entrou na aliança", a.Membros.Count + " de " + m.P.Alianca + " reinos.", r.Id);
            Registros.Notificar(m, r.Id, "alianca", "Você entrou na aliança " + a.Nome, "Aliados pedem recursos, reforçam uns aos outros e conversam.", "alianca");
            foreach (var x in a.Membros) { m.Avisar(x.ReinoId, "alianca"); m.Avisar(x.ReinoId, "mapa"); m.Avisar(x.ReinoId, "reino"); }
        }

        // ---------------------------------------------------------------- sair, expulsar, cargos

        /// <summary>Sai (ou é expulso): trégua de <c>P.treguaSaidaH</c> com a aliança e espera para entrar em outra. A visão das marchas acaba na hora.</summary>
        public static void Sair(Mundo m, Reino r, string como = "saiu")
        {
            var a = Minha(m, r);
            Podar(m, a);
            var eu = a.Membro(r.Id)!;
            var ate = m.Agora + T.DeHoras(m.P.TreguaSaidaH);
            a.Membros.Remove(eu);
            a.LidaAte.Remove(r.Id);
            r.AliancaId = null; r.AliancaLivreEm = ate; m.Sujar(r);
            foreach (var outro in Membros(m, a)) Reforcos.RetornarEntre(m, r, outro);
            if (a.Membros.Count == 0)
            {
                m.Aliancas.Remover(a);
                Registros.Notificar(m, r.Id, "alianca", "A aliança " + a.Nome + " acabou", "Você era o último membro.", "alianca");
            }
            else
            {
                a.Treguas.Add(new TreguaAlianca { ReinoId = r.Id, Ate = ate, Como = como });
                Evento(m, a, como == "expulso" ? "expulso" : "saiu", r.Nome + (como == "expulso" ? " foi expulso." : " saiu da aliança."), r.Id);
                if (eu.Cargo == Lider) Sucessao(m, a);
                m.Sujar(a);
                var txt = "Trégua de " + m.P.TreguaSaidaH + " h: nenhum lado ataca o outro.";
                NotificarMembros(m, a, r.Nome + (como == "expulso" ? " foi expulso da aliança" : " saiu da aliança"), txt);
                Registros.Notificar(m, r.Id, "alianca", como == "expulso" ? "Você foi expulso da aliança " + a.Nome : "Você saiu da aliança " + a.Nome,
                    txt + " Outra aliança só depois de " + m.P.TreguaSaidaH + " h.", "alianca");
                foreach (var x in a.Membros) { m.Avisar(x.ReinoId, "alianca"); m.Avisar(x.ReinoId, "mapa"); }
            }
            m.Avisar(r.Id, "alianca"); m.Avisar(r.Id, "mapa"); m.Avisar(r.Id, "reino");
        }

        private static MembroAlianca Cargo(Mundo m, Reino r, Alianca a, long alvoId, bool soLider)
        {
            var eu = a.Membro(r.Id)!;
            if (soLider && eu.Cargo != Lider) throw new RegraException("Só o líder faz isso.");
            var alvo = a.Membro(alvoId) ?? throw new RegraException("Esse reino não é da aliança.", 404);
            if (alvo.ReinoId == r.Id) throw new RegraException("Escolha outro membro.");
            return alvo;
        }

        /// <summary>O líder expulsa qualquer membro; o conselheiro, só quem é membro comum.</summary>
        public static void Expulsar(Mundo m, Reino r, long alvoId)
        {
            var a = Minha(m, r);
            var eu = a.Membro(r.Id)!;
            if (eu.Cargo == Membro) throw new RegraException("Só o líder e os conselheiros expulsam.");
            var alvo = Cargo(m, r, a, alvoId, false);
            if (eu.Cargo == Conselheiro && alvo.Cargo != Membro) throw new RegraException("Conselheiro só expulsa membro comum.");
            Sair(m, m.Reinos[alvoId], "expulso");
        }

        /// <summary>O líder passa a liderança a outro membro e vira conselheiro (ou membro, se não há vaga de conselheiro).</summary>
        public static void PassarLideranca(Mundo m, Reino r, long alvoId)
        {
            var a = Minha(m, r);
            var novo = Cargo(m, r, a, alvoId, true);
            var eu = a.Membro(r.Id)!;
            var eraConselheiro = novo.Cargo == Conselheiro;
            novo.Cargo = Lider;
            eu.Cargo = eraConselheiro || a.Membros.Count(y => y.Cargo == Conselheiro) < m.P.Social.Conselheiros ? Conselheiro : Membro;
            m.Sujar(a);
            var nome = m.Reinos.Obter(alvoId)?.Nome ?? "";
            Registros.Notificar(m, alvoId, "alianca", "Você agora lidera a " + a.Nome, r.Nome + " passou a liderança.", "alianca");
            Evento(m, a, "lider", r.Nome + " passou a liderança a " + nome + ".", r.Id, alvoId: alvoId);
        }

        /// <summary>O líder escolhe: aliança aberta (quem pede, entra) ou por convite.</summary>
        public static void DefinirModo(Mundo m, Reino r, bool aberta)
        {
            var a = Minha(m, r);
            if (a.Membro(r.Id)!.Cargo != Lider) throw new RegraException("Só o líder faz isso.");
            if (a.Aberta == aberta) return;
            a.Aberta = aberta; m.Sujar(a);
            Evento(m, a, "modo", aberta ? "A aliança agora é aberta: quem pedir, entra." : "A aliança agora é por convite.", r.Id);
        }

        /// <summary>Recado fixado no topo da conversa (vazio tira o recado). Só o líder.</summary>
        public static void Fixar(Mundo m, Reino r, string? texto)
        {
            var a = Minha(m, r);
            if (a.Membro(r.Id)!.Cargo != Lider) throw new RegraException("Só o líder fixa o recado.");
            texto = Regex.Replace((texto ?? "").Trim(), @"\s+", " ");
            var max = m.P.Social.Conversa.Recado;
            if (texto.Length > max) throw new RegraException($"O recado pode ter até {max} caracteres.");
            a.Recado = texto; a.RecadoEm = m.Agora; m.Sujar(a);
            if (texto.Length > 0) Evento(m, a, "recado", r.Nome + " fixou um recado: " + texto, r.Id);
            else AvisarMembros(m, a);
        }

        /// <summary>
        /// Qualquer membro indica um reino para a aliança: vira uma linha na conversa, com o botão de convidar para líder e
        /// conselheiros. Quem já pode convidar convida direto.
        /// </summary>
        public static void Indicar(Mundo m, Reino r, long alvoId)
        {
            var a = Minha(m, r);
            Podar(m, a);
            var alvo = m.Reinos.Obter(alvoId);
            if (alvo == null || !alvo.Ativo || alvo.Id == r.Id) throw new RegraException("Reino não encontrado.", 404);
            if (a.Membro(alvoId) != null) throw new RegraException("Esse reino já é da aliança.");
            if (a.Convites.Any(c => c.ReinoId == alvoId)) throw new RegraException("Esse reino já foi convidado.");
            var desde = m.Agora - T.DeHoras(m.P.Social.PropostaH);
            if (a.Conversa.Any(f => f.Evento == "indicacao" && f.AlvoId == alvoId && f.Quando > desde)) throw new RegraException("Esse reino já foi indicado há pouco.");
            Evento(m, a, "indicacao", r.Nome + " indica " + alvo.Nome + " para a aliança.", r.Id, alvoId: alvoId);
        }

        /// <summary>Pedido rápido: "preciso de reforço em [local]". Vira uma linha na conversa com o local; clicar leva ao mapa para mandar tropas.</summary>
        public static FalaAlianca PedirReforco(Mundo m, Reino r, long localId)
        {
            var a = Minha(m, r);
            var l = m.Locais.Obter(localId);
            if (l == null || l.ReinoId != r.Id || l.Ruina) throw new RegraException("Escolha um local seu.", 404);
            var desde = m.Agora - T.DeSegundos(m.P.Social.Conversa.RepetirPedidoSeg);
            if (a.Conversa.Any(f => f.Evento == "pedido-reforco" && f.LocalId == l.Id && f.Quando > desde)) throw new RegraException("Você já pediu reforço para " + l.Nome + " há pouco.");
            return Evento(m, a, "pedido-reforco", r.Nome + " precisa de reforço em " + l.Nome + ".", r.Id, hex: l.Hex, localId: l.Id);
        }

        public static void Promover(Mundo m, Reino r, long alvoId)
        {
            var a = Minha(m, r);
            var x = Cargo(m, r, a, alvoId, true);
            if (x.Cargo != Membro) throw new RegraException("Já é conselheiro.");
            if (a.Membros.Count(y => y.Cargo == Conselheiro) >= m.P.Social.Conselheiros)
                throw new RegraException($"A aliança já tem {m.P.Social.Conselheiros} conselheiros, o máximo.");
            x.Cargo = Conselheiro; m.Sujar(a);
            Registros.Notificar(m, alvoId, "alianca", "Você agora é conselheiro", "Convida reinos, aceita pedidos de entrada e expulsa membros na " + a.Nome + ".", "alianca");
            Evento(m, a, "cargo", (m.Reinos.Obter(alvoId)?.Nome ?? "") + " agora é conselheiro.", r.Id, alvoId: alvoId);
        }

        public static void Rebaixar(Mundo m, Reino r, long alvoId)
        {
            var a = Minha(m, r);
            var x = Cargo(m, r, a, alvoId, true);
            if (x.Cargo != Conselheiro) throw new RegraException("Esse reino não é conselheiro.");
            x.Cargo = Membro; m.Sujar(a);
            Evento(m, a, "cargo", (m.Reinos.Obter(alvoId)?.Nome ?? "") + " voltou a ser membro.", r.Id, alvoId: alvoId);
        }

        /// <summary>A liderança passa ao conselheiro mais antigo, ou ao membro mais antigo (quem está em regência fica de fora, se houver outro).</summary>
        private static void Sucessao(Mundo m, Alianca a, long? exceto = null)
        {
            var antigo = a.Lider;
            var cands = a.Membros.Where(x => x.ReinoId != exceto && x.Cargo != Lider)
                .OrderBy(x => x.Cargo == Conselheiro ? 0 : 1).ThenBy(x => x.Desde).ThenBy(x => x.ReinoId).ToList();
            var ativos = cands.Where(x => m.Reinos.Obter(x.ReinoId) is { } q && !(EmRegencia?.Invoke(m, q) ?? false)).ToList();
            var novo = ativos.FirstOrDefault() ?? cands.FirstOrDefault();
            if (novo == null) return;
            if (antigo != null) antigo.Cargo = Membro;
            novo.Cargo = Lider;
            m.Sujar(a);
            var nome = m.Reinos.Obter(novo.ReinoId)?.Nome ?? "";
            NotificarMembros(m, a, nome + " lidera a aliança", null);
            Evento(m, a, "lider", nome + " agora lidera a aliança.", novo.ReinoId);
        }

        /// <summary>Chamado pela regência quando o reino passa a ser governado pela IA: se era o líder, a liderança passa adiante.</summary>
        public static void AoEntrarEmRegencia(Mundo m, Reino r)
        {
            var a = De(m, r);
            if (a?.Membro(r.Id) is not { Cargo: Lider }) return;
            Sucessao(m, a, r.Id);
        }

        // ---------------------------------------------------------------- conversa

        /// <summary>
        /// Conversa da aliança: o único chat do jogo, só para membros. Guarda as últimas <c>P.social.conversa.guardar</c> linhas.
        /// <c>@Nome do Reino</c> menciona um membro (ele é avisado mesmo com a conversa silenciada); <c>@todos</c>, só líder e
        /// conselheiros. <paramref name="hex"/>: um ponto do mapa mostrado à aliança (clicar na fala centra o mapa lá).
        /// </summary>
        public static FalaAlianca Falar(Mundo m, Reino r, string? texto, int? hex = null)
        {
            var a = Minha(m, r);
            texto = Regex.Replace((texto ?? "").Trim(), @"\s+", " ");
            var max = m.P.Social.Conversa.Caracteres;
            if (texto.Length == 0 && hex != null) texto = "Olhem aqui no mapa.";
            if (texto.Length == 0) throw new RegraException("Escreva a mensagem.");
            if (texto.Length > max) throw new RegraException($"A mensagem pode ter até {max} caracteres.");
            if (hex is int h && (h < 0 || h >= m.G.Cols * m.G.Lins)) throw new RegraException("Ponto do mapa inválido.");
            var f = new FalaAlianca { ReinoId = r.Id, Texto = texto, Quando = m.Agora, Hex = hex };
            // menções: o nome mais longo primeiro, para "@Vale Frio" não parar em "@Vale"
            foreach (var x in a.Membros.Where(x => x.ReinoId != r.Id).Select(x => m.Reinos.Obter(x.ReinoId)).OfType<Reino>().OrderByDescending(q => q.Nome.Length))
                if (texto.Contains("@" + x.Nome, StringComparison.OrdinalIgnoreCase) && !f.Mencoes.Contains(x.Id)) f.Mencoes.Add(x.Id);
            if (Regex.IsMatch(texto, @"(^|\s)@todos\b", RegexOptions.IgnoreCase))
            {
                if (a.Membro(r.Id)!.Cargo == Membro) throw new RegraException("Só o líder e os conselheiros chamam @todos.");
                f.Todos = true;
            }
            Registrar(m, a, f);
            // a menção avisa sempre (categoria da aliança, não a da conversa, que o jogador pode silenciar)
            foreach (var id in f.Todos ? a.Membros.Select(x => x.ReinoId).Where(id => id != r.Id).ToList() : f.Mencoes)
                Registros.Notificar(m, id, "alianca", r.Nome + (f.Todos ? " chamou a aliança" : " mencionou você"), Cortar(texto, 90), "alianca");
            return f;
        }

        private static string Cortar(string t, int n) => t.Length <= n ? t : t[..(n - 1)].TrimEnd() + "…";

        /// <summary>Uma linha de evento na conversa: o que aconteceu na aliança, escrito pelo jogo.</summary>
        public static FalaAlianca Evento(Mundo m, Alianca a, string evento, string texto, long reinoId = 0, int? hex = null, long? localId = null, long? propostaId = null, long? alvoId = null)
        {
            var f = new FalaAlianca { ReinoId = reinoId, Texto = texto, Quando = m.Agora, Tipo = TipoEvento, Evento = evento, Hex = hex, LocalId = localId, PropostaId = propostaId, AlvoId = alvoId };
            Registrar(m, a, f);
            return f;
        }

        /// <summary>Guarda a linha, apara a conversa e avisa cada membro (o aviso de fala nova respeita a preferência de cada um).</summary>
        private static void Registrar(Mundo m, Alianca a, FalaAlianca f)
        {
            f.Id = ++a.UltimaFala;
            a.Conversa.Add(f);
            var sobra = a.Conversa.Count - m.P.Social.Conversa.Guardar;
            if (sobra > 0) a.Conversa.RemoveRange(0, sobra);
            if (f.ReinoId != 0 && f.Tipo == TipoFala) a.LidaAte[f.ReinoId] = f.Id;   // quem escreve leu até aqui
            m.Sujar(a);
            var de = f.ReinoId != 0 ? m.Reinos.Obter(f.ReinoId)?.Nome : null;
            foreach (var x in a.Membros)
            {
                var q = m.Reinos.Obter(x.ReinoId);
                // quem foi mencionado já recebe a notificação da menção: não toca duas vezes
                var mencionado = f.Tipo == TipoFala && (f.Todos || f.Mencoes.Contains(x.ReinoId));
                // idem para quem o evento já avisa por notificação (o aliado a quem se pede, quem recebe a ajuda ou o reforço)
                mencionado |= f.Evento is "pedido-recursos" or "ajuda" or "reforco" && f.AlvoId == x.ReinoId;
                var tocar = q != null && x.ReinoId != f.ReinoId && !mencionado &&!q.NotificacoesDesligadas.Contains(CategoriaConversa);
                m.Avisar(x.ReinoId, "alianca", new { fala = f.Id, tipo = f.Tipo, evento = f.Evento, de, texto = f.Texto, hex = f.Hex, tocar, naoLidas = NaoLidas(a, x.ReinoId) });
            }
        }

        /// <summary>Linhas que o membro ainda não leu (as próprias falas não contam).</summary>
        public static int NaoLidas(Alianca a, long reinoId)
        {
            var ate = a.LidaAte.GetValueOrDefault(reinoId);
            return a.Conversa.Count(f => f.Id > ate && !(f.Tipo == TipoFala && f.ReinoId == reinoId));
        }

        /// <summary>O membro abriu a conversa: tudo lido.</summary>
        public static void MarcarLida(Mundo m, Reino r)
        {
            var a = De(m, r);
            if (a == null || a.LidaAte.GetValueOrDefault(r.Id) == a.UltimaFala) return;
            a.LidaAte[r.Id] = a.UltimaFala; m.Sujar(a);
            m.Avisar(r.Id, "alianca", new { naoLidas = 0 });
        }

        /// <summary>Aliança do reino para registrar um evento dele (null se não tem).</summary>
        public static Alianca? DoReino(Mundo m, long reinoId) => m.Reinos.Obter(reinoId) is { } q ? De(m, q) : null;
    }
}

namespace ReinoDePedra.Jogo.Reinos
{
    public sealed partial class Reino
    {
        /// <summary>Aliança do reino (null = nenhuma).</summary>
        public long? AliancaId { get; set; }
        /// <summary>Depois de sair de uma aliança, só entra em outra a partir deste instante.</summary>
        public long AliancaLivreEm { get; set; }
    }
}

namespace ReinoDePedra.Jogo
{
    using ReinoDePedra.Jogo.Social;
    public sealed partial class Mundo
    {
        public Colecao<Alianca> Aliancas { get; } = new("aliancas");
    }
}
