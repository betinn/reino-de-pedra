using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.Temporada
{
    /// <summary>
    /// Temporada: começa na criação do mundo e termina num evento agendado (<see cref="FimTemporadaEvento"/>) depois de
    /// P.temporadaDias. No fim: apura ranking e conquistas, concede o legado por conta e reinicia o mundo (nova semente,
    /// NumeroTemporada + 1). Contas e legado ficam; cada jogador funda um reino novo na temporada seguinte.
    /// O reset roda dentro de um evento, na thread do motor, e grava tudo de uma vez: apaga o mundo do banco e grava o novo.
    /// </summary>
    [Sistema]
    public static class Temporadas
    {
        public static void AoIniciar(Mundo m)
        {
            Sistemas.UmaVez("temporada", Registrar);
            m.Legados.Carregar(m.Banco);
            Garantir(m);
        }

        private static void Registrar()
        {
            Mundo.AoCriarMundo += (mm, _) => Garantir(mm);
            // ranking e conquistas rastreados durante a temporada
            Combates.AoTerminar.Add(Ranking.AoTerminarBatalha);
            Combates.AoCairCastelo.Add(Ranking.AoCairCastelo);
            // relíquias da temporada equipadas
            Bonus.Ataque.Add((mm, ex) => Linhagem.BonusReino(mm, ex.ReinoId, Linhagem.Ataque));
            Bonus.Defesa.Add((mm, l) => Linhagem.BonusReino(mm, l.ReinoId, Linhagem.Defesa));
            Bonus.DefesaExercito.Add((mm, ex) => Linhagem.BonusReino(mm, ex.ReinoId, Linhagem.Defesa));
            Economia.ModificadoresProducao.Add((mm, l) => 1 + Linhagem.BonusReino(mm, l.ReinoId, Linhagem.Producao));
            Economia.ModificadoresCrescimento.Add((mm, r) => 1 + Linhagem.BonusReino(mm, r.Id, Linhagem.Crescimento));
            // desbloqueios da linhagem
            CriacaoReino.BrasaoLiberado = (mm, conta) => conta == null ? (true, true) : (Linhagem.BrasoesExtras(mm, conta), Linhagem.Moldura(mm, conta));
            Quedas.EscolherExilio.Add(Regioes.Exilio);
            // reinos de IA: o brasão às vezes é de "veterano", como o de qualquer jogador
            CriacaoReino.AoCriar += (mm, r) =>
            {
                if (!r.EhIA) return;
                var p = mm.P.TemporadaServ;
                if (mm.Sorte.Chance(p.IaExtras)) r.Brasao = Brasao.Aleatorio(mm.Sorte, extras: true);
                if (mm.Sorte.Chance(p.IaMoldura)) r.Brasao.Moldura = true;
                mm.Sujar(r);
            };
            GatilhosRestantes.Registrar();
        }

        public static long Duracao(Mundo m) => m.DuracaoTemporadaMs ?? m.P.TemporadaDias * T.Dia;
        public static long Inicio(Mundo m) => m.Estado.InicioTemporada;
        public static long Fim(Mundo m) => Inicio(m) + Duracao(m);
        /// <summary>Duração de um "dia" da temporada (24 h; menor com a temporada acelerada de desenvolvimento).</summary>
        public static long DiaMs(Mundo m) => Math.Max(1, Duracao(m) / Math.Max(1, m.P.TemporadaDias));
        /// <summary>Dia da temporada, a partir de 0.</summary>
        public static int DiaIndice(Mundo m) => (int)Math.Clamp((m.Agora - Inicio(m)) / DiaMs(m), 0, m.P.TemporadaDias - 1);
        public static int DiasRestantes(Mundo m) => (int)Math.Max(0, Math.Ceiling((Fim(m) - m.Agora) / (double)DiaMs(m)));

        /// <summary>Garante o evento de fim da temporada atual.</summary>
        public static void Garantir(Mundo m)
        {
            var n = m.Estado.NumeroTemporada;
            if (m.Eventos.Any(e => e is FimTemporadaEvento f && f.Temporada == n)) return;
            m.Agendar(new FimTemporadaEvento { Temporada = n, Quando = Fim(m) });
        }
        /// <summary>Reagenda o fim (depois de mudar <see cref="Mundo.DuracaoTemporadaMs"/>).</summary>
        public static void Reagendar(Mundo m)
        {
            foreach (var e in m.Eventos.OfType<FimTemporadaEvento>().ToList()) m.Cancelar(e.Id);
            Garantir(m);
        }

        /// <summary>Marca o dia de hoje como ativo para a conta (abriu o jogo). Grava só quando o dia é novo.</summary>
        public static void MarcarAtivo(Mundo m, long contaId)
        {
            var l = m.Legados.De(contaId);
            var n = m.Estado.NumeroTemporada;
            var dia = DiaIndice(m);
            if (l.DiasTemporada == n && l.DiasAtivos.Contains(dia)) return;
            if (l.DiasTemporada != n) { l.DiasTemporada = n; l.DiasAtivos.Clear(); }
            l.DiasAtivos.Add(dia);
            m.Legados.Salvar(m, l);
        }
        public static int DiasAtivos(Mundo m, LegadoConta? l) => l != null && l.DiasTemporada == m.Estado.NumeroTemporada ? l.DiasAtivos.Count : 0;

        /// <summary>Antes do reset (o mundo ainda existe): apuração feita. Para IA, estatísticas, avisos.</summary>
        public static event Action<Mundo, int>? AoTerminar;
        /// <summary>Depois do reset: mundo novo já criado (NumeroTemporada novo).</summary>
        public static event Action<Mundo>? AoReiniciar;

        /// <summary>Fim da temporada: apura, concede o legado e reinicia o mundo.</summary>
        public static void Encerrar(Mundo m)
        {
            var n = m.Estado.NumeroTemporada;
            Apurar(m);
            AoTerminar?.Invoke(m, n);
            foreach (var r in m.Reinos) if (r.Ativo) m.Avisar(r.Id, "temporada", new { fim = n });
            Reiniciar(m);
        }

        /// <summary>Conquistas do fim da temporada (relíquias, títulos, histórico) e a linhagem de quem jogou.</summary>
        public static void Apurar(Mundo m)
        {
            var n = m.Estado.NumeroTemporada;
            var p = m.P.TemporadaServ;
            var linhas = Ranking.Linhas(m);
            var pos = Ranking.Posicoes(linhas);
            var tocados = new HashSet<LegadoConta>();
            foreach (var r in m.Reinos.Where(x => x.Ativo && x.ContaId != null).OrderBy(x => x.Id))
            {
                var l = m.Legados.De(r.ContaId!.Value);
                tocados.Add(l);
                var ganhos = new List<string>();
                foreach (var cat in Ranking.Premiadas)
                {
                    var i = pos[cat][r.Id];
                    if (i <= p.RankingTop && i <= p.BonusPos.Length)
                        ganhos.Add(Conceder(m, l, cat, p.BonusPos[i - 1], "Temporada " + n + ": " + i + "º lugar em " + NomeCategoria(cat)));
                }
                if (Reliquias.DoReino(m, r.Id).Any())
                    ganhos.Add(Conceder(m, l, "lendaria", p.BonusLendaria, "Temporada " + n + ": terminou com relíquia lendária"));
                if (r.VenceuCerco)
                    ganhos.Add(Conceder(m, l, "cerco", p.BonusCerco, "Temporada " + n + ": venceu um cerco a um castelo"));
                var locais = m.LocaisDe(r.Id).Count(x => !x.Ruina);
                var resumo = "Terminou com " + locais + (locais == 1 ? " local" : " locais") + " · " + pos["baixas"][r.Id] + "º em baixas, " + pos["familias"][r.Id] + "º em famílias";
                if (r.UltimaQueda != null) resumo = (r.UltimaQueda.Exilio ? "Caiu e recomeçou em exílio. " : "Perdeu o castelo uma vez. ") + resumo;
                if (ganhos.Count > 0) resumo += ". Ganhou: " + string.Join(", ", ganhos);
                l.Historico.Insert(0, new TemporadaJogada { Temporada = n, NomeReino = r.Nome, Resumo = resumo });
                if (!l.Brasoes.Any(b => b.Temporada == n))
                    l.Brasoes.Insert(0, new BrasaoGuardado { Brasao = r.Brasao, Nome = "Temporada " + n, Temporada = n });
            }
            // temporada jogada: ativo em pelo menos P.temporadaServ.linhagem.diasAtivos dias (mesmo quem perdeu o reino)
            foreach (var l in m.Legados.Todos.Where(x => x.DiasTemporada == n).ToList())
            {
                var dias = l.DiasAtivos.Count;
                var h = l.Historico.FirstOrDefault(x => x.Temporada == n);
                if (h == null) l.Historico.Insert(0, h = new TemporadaJogada { Temporada = n, Resumo = "Sem reino no fim da temporada" });
                h.DiasAtivos = dias;
                if (dias >= p.Linhagem.DiasAtivos) { l.TemporadasJogadas++; h.Contou = true; }
                l.DiasAtivos.Clear(); l.DiasTemporada = 0;
                tocados.Add(l);
            }
            foreach (var l in tocados) m.Legados.Salvar(m, l);
        }

        private static string Conceder(Mundo m, LegadoConta l, string conquista, double bonus, string como)
        {
            var c = m.P.TemporadaServ.Conquistas[conquista];
            var n = m.Estado.NumeroTemporada;
            bonus = Math.Clamp(bonus, m.P.Legado.RelMin, m.P.Legado.RelMax);
            l.Reliquias.Add(new ReliquiaTemporada
            {
                Id = ++l.UltimoId, Nome = c.Reliquia, Tipo = c.Tipo, Bonus = bonus, Temporada = n, Conquista = conquista, Como = como,
                // equipa sozinha enquanto houver espaço
                Equipada = l.Reliquias.Count(r => r.Equipada) < m.P.Legado.Equipadas,
            });
            if (!l.Titulos.Any(t => t.Nome == c.Titulo)) l.Titulos.Add(new TituloGanho { Nome = c.Titulo, Como = como, Temporada = n });
            return c.Reliquia;
        }

        public static string NomeCategoria(string cat) => cat switch { "baixas" => "baixas", "perdas" => "perdas", "tropas" => "tropas", _ => "famílias" };

        /// <summary>
        /// Reinicia o mundo: esvazia as coleções e a agenda, cria o mundo novo (nova semente, temporada + 1, os sistemas geram
        /// fauna, IA...), apaga o mundo do banco e grava o novo. Roda na thread do motor (dentro do evento de fim).
        /// </summary>
        public static void Reiniciar(Mundo m, ulong? semente = null)
        {
            var n = m.Estado.NumeroTemporada + 1;
            var s = semente ?? Rng.Hash(m.Estado.Semente, (ulong)m.Agora, m.Sorte.Proximo());
            foreach (var c in m.Colecoes) c.Limpar();
            m.Agenda.Limpar();
            m.Sujos.Clear(); m.Removidos.Clear();
            m.CriarNovo(s, n);
            Garantir(m);
            if (m.Banco != null)
            {
                m.Banco.ApagarMundo();
                foreach (var c in m.Colecoes) foreach (var d in c.Todos) m.Sujar(d);
                m.Banco.Salvar(m);
            }
            AoReiniciar?.Invoke(m);
        }
    }

    /// <summary>Fim da temporada (um por temporada; ignora se o mundo já é de outra).</summary>
    public sealed class FimTemporadaEvento : Evento
    {
        public int Temporada { get; set; }
        public override void Executar(Mundo m)
        {
            if (m.Estado.NumeroTemporada != Temporada) return;
            Temporadas.Encerrar(m);
        }
    }
}
