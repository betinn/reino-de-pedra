using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Combate
{
    /// <summary>
    /// Instante em que a composição da batalha mudou (início, reforço, saída de tropas): valores de ataque e defesa
    /// pela fórmula e as perdas projetadas sem limite de tática. Entre um marco e o seguinte, a força mostrada de cada
    /// lado é <c>valor × (1 − perda × progresso)</c>, com progresso = tempo decorrido / duração.
    /// </summary>
    public sealed class MarcoBatalha
    {
        public long T { get; set; }
        public double A { get; set; }
        public double D { get; set; }
        public double PerdaA { get; set; }
        public double PerdaD { get; set; }
        public string? Txt { get; set; }
        /// <summary>"ataque", "defesa" ou null (os dois).</summary>
        public string? Lado { get; set; }
    }

    /// <summary>
    /// Batalha num local: começa quando o ataque chega e dura <see cref="Batalhas.Duracao"/>. Enquanto dura, o defensor
    /// manda reforços (as tropas que entram no local contam) e qualquer lado pode recuar. O resultado sai de
    /// <c>m.F.Batalha</c> com a composição no fim. Fica guardada por P.combate.guardarBatalhaH depois de encerrada.
    /// </summary>
    public sealed class Batalha : Documento
    {
        public long LocalId { get; set; }
        public int Hex { get; set; }
        public long AtacanteId { get; set; }
        public long DefensorId { get; set; }
        /// <summary>Plano do primeiro ataque (os que chegam depois, do mesmo reino, se juntam a ele).</summary>
        public JsonObject Plano { get; set; } = new();
        public List<long> Exercitos { get; set; } = new();
        /// <summary>Ataques de outros reinos esperando esta batalha acabar.</summary>
        public List<long> Espera { get; set; } = new();
        public long Inicio { get; set; }
        /// <summary>Fim pela duração (progresso 1).</summary>
        public long Fim { get; set; }
        /// <summary>Quando vai terminar com a composição atual (antes de <see cref="Fim"/> se a tática manda recuar).</summary>
        public long FimPrevisto { get; set; }
        public long? EventoId { get; set; }
        public List<MarcoBatalha> Marcos { get; set; } = new();
        /// <summary>Tropas atacantes vistas pelo defensor (as do início mais as que se juntaram).</summary>
        public Dictionary<string, int> TropasAtaque { get; set; } = new();
        /// <summary>Hexágono de onde veio o primeiro ataque (para a direção de origem).</summary>
        public int OrigemHex { get; set; }
        public bool Estandarte { get; set; }
        public bool Encerrada { get; set; }
        /// <summary>"vitoria", "derrota", "recuo" (do atacante) ou "defesa-recuou".</summary>
        public string? Resultado { get; set; }
        public long? EncerradaEm { get; set; }
        public Dictionary<string, int> PerdasAtaque { get; set; } = new();
        public Dictionary<string, int> PerdasDefesa { get; set; } = new();
        public double MiliciaMorta { get; set; }
        public long? RelatorioAtaque { get; set; }
        public long? RelatorioDefesa { get; set; }
    }

    public sealed class FimBatalhaEvento : Evento
    {
        public long BatalhaId { get; set; }
        public override void Executar(Mundo m)
        {
            var b = m.Batalhas.Obter(BatalhaId);
            if (b == null || b.Encerrada || b.EventoId != Id) return;
            b.EventoId = null;
            Batalhas.Encerrar(m, b, Batalhas.ModoFim);
        }
    }

    public sealed class LimparBatalhaEvento : Evento
    {
        public long BatalhaId { get; set; }
        public override void Executar(Mundo m)
        {
            if (m.Batalhas.Obter(BatalhaId) is { Encerrada: true } b) m.Batalhas.Remover(b);
        }
    }

    /// <summary>Chegada do ataque, batalha (início, reforços, recuo, fim) e o que acontece depois.</summary>
    public static class Batalhas
    {
        public const string ModoFim = "fim", ModoRecuoAtaque = "recuo-ataque", ModoRecuoDefesa = "recuo-defesa";

        public static Batalha? Ativa(Mundo m, long localId) => m.Batalhas.FirstOrDefault(b => !b.Encerrada && b.LocalId == localId);
        public static IEnumerable<Batalha> DoReino(Mundo m, long reinoId) => m.Batalhas.Where(b => b.AtacanteId == reinoId || b.DefensorId == reinoId);

        /// <summary>Duração: base + por tropa envolvida no início, até o máximo (P.combate.batalha).</summary>
        public static long Duracao(Mundo m, int tropas)
        {
            var p = m.P.Combate.Batalha;
            return T.DeSegundos(Math.Min(p.MaxSeg, p.BaseSeg + p.PorTropaSeg * Math.Max(0, tropas)));
        }

        public static bool EhAtaque(Exercito ex) => ex.Ordem is OrdemAtacar.Id or OrdemOcupar.Id;

        // ---------------------------------------------------------------- chegada

        public static void Chegou(Mundo m, Exercito ex)
        {
            var r = m.Reinos.Obter(ex.ReinoId)!;
            var plano = PlanoAtaque.Ler(ex.Dados);
            var l = ex.AlvoLocalId is long id ? m.Locais.Obter(id) : null;
            if (l == null || l.Hex != ex.Destino)
            {
                RelatoriosCombate.SemCombate(m, ex, null, plano, "O alvo não existe mais.", null);
                ex.Retornar(m); return;
            }
            if (l.ReinoId == ex.ReinoId && !l.Ruina)
            {
                var partes = GT.Partes(m, ex.Tropas);
                ex.EntrarNoLocal(m, l);
                Exercitos.Avisar(m, ex, "Tropas no local", partes + " em " + l.Nome + ": o local já é seu.");
                return;
            }
            var semDono = Ataques.SemDono(m, l);
            var def = semDono ? null : m.Reinos.Obter(l.ReinoId);
            if (def != null)
            {
                var motivo = Permissoes.MotivoEnvio(m, r, def) ?? Permissoes.MotivoChegada(m, r, def);
                if (motivo != null)
                {
                    RelatoriosCombate.SemCombate(m, ex, l, plano, motivo, def);
                    ex.Retornar(m); return;
                }
            }
            if (!Ataques.TiposPara(m, l).Contains(plano.Tipo))
            {
                RelatoriosCombate.SemCombate(m, ex, l, plano, "O local mudou no caminho: este ataque não serve mais para ele.", null);
                ex.Retornar(m); return;
            }
            var b = Ativa(m, l.Id);
            if (b != null)
            {
                if (b.AtacanteId == ex.ReinoId) { Juntar(m, b, ex); return; }
                ex.Parar(m);
                b.Espera.Add(ex.Id); m.Sujar(b);
                Exercitos.Avisar(m, ex, "Tropas esperando", "Há outra batalha em " + Ataques.NomeAlvo(l) + ". Suas tropas atacam quando ela acabar.");
                return;
            }
            if (semDono) { Efeitos.OcuparSemDono(m, ex, l); return; }
            Iniciar(m, ex, l, def!, plano);
        }

        private static void Iniciar(Mundo m, Exercito ex, Local l, Reino def, PlanoAtaque plano)
        {
            var origem = ex.Caminho.Count > 0 ? ex.Caminho[0] : l.Hex;
            ex.Parar(m);
            var agora = m.Agora;
            var b = new Batalha
            {
                LocalId = l.Id, Hex = l.Hex, AtacanteId = ex.ReinoId, DefensorId = def.Id, Plano = plano.ParaJson(),
                Inicio = agora, OrigemHex = origem, Estandarte = ex.Estandarte,
                TropasAtaque = new(ex.Tropas),
            };
            b.Exercitos.Add(ex.Id);
            b.Fim = agora + Duracao(m, GT.Total(ex.Tropas) + GT.Total(l.Guarnicao));
            m.Batalhas.Adicionar(b);
            ex.BatalhaId = b.Id; m.Sujar(ex);
            Recalcular(m, b, "A batalha começou.", null);
            var atk = m.Reinos.Obter(ex.ReinoId)!;
            var quem = ex.Estandarte ? "O exército de " + atk.Nome : "Forças desconhecidas";
            Registros.Notificar(m, def.Id, "ataques", "Batalha em " + l.Nome, quem + " atacam (" + Ataques.NomesTipo[plano.Tipo].ToLowerInvariant() + "). Envie reforços ou recue.", "batalha?id=" + b.Id);
            Registros.Notificar(m, atk.Id, "batalhas", "Batalha começou", "Suas tropas atacam: " + Ataques.NomeAlvo(l) + ".", "batalha?id=" + b.Id);
        }

        private static void Juntar(Mundo m, Batalha b, Exercito ex)
        {
            ex.Parar(m);
            ex.BatalhaId = b.Id; m.Sujar(ex);
            b.Exercitos.Add(ex.Id);
            GT.Somar(b.TropasAtaque, ex.Tropas);
            Recalcular(m, b, "Chegaram mais atacantes: " + GT.Partes(m, ex.Tropas) + ".", "ataque");
        }

        // ---------------------------------------------------------------- composição e fórmula

        public sealed record Composicao(Local? Local, Reino? Defensor, List<Exercito> Exercitos, Dictionary<string, int> Ataque, Dictionary<string, int> Defesa, ExtraDefesa Extra);

        public static Composicao Compor(Mundo m, Batalha b)
        {
            var l = m.Locais.Obter(b.LocalId);
            var def = m.Reinos.Obter(b.DefensorId);
            var exs = b.Exercitos.Select(id => m.Marchas.Obter(id) as Exercito).OfType<Exercito>().Where(e => GT.Total(e.Tropas) > 0).ToList();
            var atk = new Dictionary<string, int>();
            foreach (var e in exs) GT.Somar(atk, e.Tropas);
            var dono = l != null && def != null && l.ReinoId == def.Id && !l.Ruina;
            var defG = dono ? GT.Limpo(l!.Guarnicao) : new Dictionary<string, int>();
            var totA = exs.Sum(e => GT.Total(e.Tropas));
            var bonusA = totA > 0 ? exs.Sum(e => Bonus.SomaAtaque(m, e) * GT.Total(e.Tropas)) / totA : 0;
            var x = new ExtraDefesa
            {
                Pop = dono ? Combates.PopDoLocal(m, def!, l!) : 0,
                ArqTorre = dono ? Defesas.ArqueirosNoAlto(m, l!) : 0,
                BonusD = dono ? Bonus.SomaDefesa(m, l!) : 0,
                BonusA = bonusA,
                Portoes = dono && l!.Tipo == TipoLocal.Castelo ? Math.Clamp(l.Portoes, 0, Defesas.PortoesMax(m)) : 0,
            };
            return new Composicao(l, def, exs, atk, defG, x);
        }

        /// <summary>Progresso (0 a 1) da batalha no instante t.</summary>
        public static double Progresso(Batalha b, long t) => b.Fim > b.Inicio ? Math.Clamp((t - b.Inicio) / (double)(b.Fim - b.Inicio), 0, 1) : 1;

        /// <summary>A composição mudou: novo marco, novo fim previsto (a tática pode mandar recuar antes do fim).</summary>
        public static void Recalcular(Mundo m, Batalha b, string? txt, string? lado)
        {
            if (b.Encerrada) return;
            if (m.Reinos.Obter(b.DefensorId) is { } dr) Economia.Atualizar(m, dr);
            var c = Compor(m, b);
            var full = m.F.Batalha(c.Ataque, c.Defesa, c.Extra, null);
            var agora = m.Agora;
            b.Marcos.Add(new MarcoBatalha { T = agora, A = full.A, D = full.D, PerdaA = full.PerdaA, PerdaD = full.PerdaD, Txt = txt, Lado = lado });
            var alvo = b.Fim;
            var lim = Ataques.Limite(m, PlanoAtaque.Ler(b.Plano).Tatica);
            if (!full.VenceA && lim is double L && L < 1)
                alvo = Math.Max(agora, b.Inicio + (long)Math.Round((b.Fim - b.Inicio) * L));
            if (c.Exercitos.Count == 0) alvo = agora;
            b.FimPrevisto = alvo;
            m.Cancelar(b.EventoId);
            b.EventoId = m.Agendar(new FimBatalhaEvento { BatalhaId = b.Id, Quando = alvo }).Id;
            m.Sujar(b);
            AvisarLados(m, b);
        }

        private static void AvisarLados(Mundo m, Batalha b)
        {
            m.Avisar(b.AtacanteId, "batalha", new { id = b.Id });
            m.Avisar(b.DefensorId, "batalha", new { id = b.Id });
        }

        // ---------------------------------------------------------------- recuo

        /// <summary>Recuo ordenado por um dos lados durante a batalha.</summary>
        public static void Recuar(Mundo m, Reino r, long batalhaId)
        {
            var b = m.Batalhas.Obter(batalhaId);
            if (b == null || (b.AtacanteId != r.Id && b.DefensorId != r.Id)) throw new RegraException("Batalha não encontrada.", 404);
            if (b.Encerrada) throw new RegraException("A batalha já acabou.");
            Encerrar(m, b, b.AtacanteId == r.Id ? ModoRecuoAtaque : ModoRecuoDefesa);
        }

        // ---------------------------------------------------------------- fim

        /// <summary>
        /// Resolve a batalha. No fim (pela duração ou pelo limite da tática) usa exatamente <c>m.F.Batalha</c>; num recuo
        /// ordenado, cada lado perde a parte das perdas projetadas já lutada (perda × progresso).
        /// </summary>
        public static void Encerrar(Mundo m, Batalha b, string modo)
        {
            if (b.Encerrada) return;
            var agora = m.Agora;
            b.Encerrada = true; b.EncerradaEm = agora;
            m.Cancelar(b.EventoId); b.EventoId = null;
            var atkR = m.Reinos.Obter(b.AtacanteId);
            var defR = m.Reinos.Obter(b.DefensorId);
            if (atkR != null) Economia.Atualizar(m, atkR);
            if (defR != null) Economia.Atualizar(m, defR);
            var c = Compor(m, b);
            var l = c.Local;
            var plano = PlanoAtaque.Ler(b.Plano);
            var lim = Ataques.Limite(m, plano.Tatica);
            var p = Progresso(b, agora);
            var full = m.F.Batalha(c.Ataque, c.Defesa, c.Extra, null);
            double perdaA, perdaD; bool venceu; string resultado;
            if (modo == ModoFim)
            {
                var res = m.F.Batalha(c.Ataque, c.Defesa, c.Extra, lim);
                perdaA = res.PerdaA; perdaD = res.PerdaD; venceu = res.VenceA;
                resultado = res.VenceA ? "vitoria" : res.Recuou ? "recuo" : "derrota";
            }
            else
            {
                perdaA = full.PerdaA * p; perdaD = full.PerdaD * p;
                venceu = modo == ModoRecuoDefesa;
                resultado = venceu ? "defesa-recuou" : "recuo";
            }
            b.Resultado = resultado;

            // perdas: proporcionais entre as unidades de cada exército e da guarnição
            var trebuchetsInicio = c.Ataque.GetValueOrDefault("trebuchet");
            var perdasAtk = new Dictionary<string, int>();
            foreach (var ex in c.Exercitos)
            {
                var pe = Combates.Perdas(ex.Tropas, perdaA);
                Combates.Tirar(ex.Tropas, pe);
                GT.Somar(perdasAtk, pe);
                m.Sujar(ex);
            }
            var perdasDef = Combates.Perdas(c.Defesa, perdaD);
            if (l != null && perdasDef.Count > 0) { Combates.Tirar(l.Guarnicao, perdasDef); m.Sujar(l); }
            var miliciaPessoas = c.Extra.Pop * m.P.MiliciaPorPop;
            var miliciaMorta = modo == ModoRecuoDefesa ? 0 : Math.Floor(miliciaPessoas * perdaD + 1e-9);
            if (defR != null && miliciaMorta > 0) { defR.Pop = Math.Max(0, defR.Pop - miliciaMorta); m.Sujar(defR); }
            b.PerdasAtaque = perdasAtk; b.PerdasDefesa = perdasDef; b.MiliciaMorta = miliciaMorta;

            // feridos: de quem vence ou recua (quem perde sem recuar não tem feridos)
            var feridosA = venceu || resultado == "recuo" ? Combates.Feridos(m, perdasAtk) : new();
            var feridosD = !venceu || modo == ModoRecuoDefesa ? Combates.Feridos(m, perdasDef) : new();
            if (atkR != null && feridosA.Count > 0)
            {
                var origem = c.Exercitos.Select(e => m.Locais.Obter(e.OrigemLocalId)).FirstOrDefault(x => x != null && x.ReinoId == atkR.Id);
                foreach (var f in Combates.AoFerir) f(m, atkR, feridosA, origem);
            }
            if (defR != null && feridosD.Count > 0)
                foreach (var f in Combates.AoFerir) f(m, defR, feridosD, l != null && l.ReinoId == defR.Id ? l : null);

            // a defesa que recua sai do local com o que sobrou
            if (modo == ModoRecuoDefesa && l != null && defR != null && l.ReinoId == defR.Id)
            {
                var resto = GT.Limpo(l.Guarnicao);
                l.Guarnicao.Clear(); m.Sujar(l);
                if (resto.Count > 0) Efeitos.Fugir(m, defR, l, resto);
            }

            // efeitos: objetivos (vitória) ou só o dano de trebuchets à distância (derrota e recuo)
            var vivos = c.Exercitos.Where(e => GT.Total(e.Tropas) > 0).ToList();
            var dano = trebuchetsInicio * m.B.U["trebuchet"].Cerco
                       + (venceu ? vivos.Sum(e => e.Tropas.GetValueOrDefault("ariete")) * m.B.U["ariete"].Cerco : 0);
            var efeito = new ResumoEfeitos();
            if (l != null && venceu && vivos.Count > 0)
                Efeitos.Aplicar(m, b, plano, l, defR, vivos, modo == ModoRecuoDefesa, dano, efeito);
            else if (l != null)
                Efeitos.SoDanoDeCerco(m, plano, l, dano, efeito, venceu, resultado, lim, modo != ModoFim);

            // atacantes: ficam no local tomado, voltam para casa ou caem
            foreach (var ex in c.Exercitos)
            {
                ex.BatalhaId = null; m.Sujar(ex);
                if (GT.Total(ex.Tropas) == 0)
                {
                    foreach (var rid in ex.Reliquias.ToList())
                        if (m.Reliquias.Obter(rid) is { } rel && l != null) Reliquias.Guardar(m, rel, l);
                    ex.Encerrar(m);
                }
                else if (efeito.Ocupou && l != null && l.ReinoId == ex.ReinoId) ex.EntrarNoLocal(m, l);
                else ex.Retornar(m);
            }

            var ultimo = b.Marcos.LastOrDefault();
            b.Marcos.Add(new MarcoBatalha
            {
                T = agora, A = ultimo?.A ?? full.A, D = ultimo?.D ?? full.D, PerdaA = ultimo?.PerdaA ?? full.PerdaA, PerdaD = ultimo?.PerdaD ?? full.PerdaD,
                Txt = resultado switch { "vitoria" => "Os atacantes venceram.", "derrota" => "A defesa venceu.", "recuo" => "Os atacantes recuaram.", _ => "A defesa recuou." },
            });
            m.Sujar(b);

            var rc = new ResultadoCombate(b.Id, b.LocalId, b.AtacanteId, b.DefensorId, plano.Tipo, resultado, full.A, full.D,
                c.Ataque, c.Defesa, perdasAtk, perdasDef, miliciaMorta);
            RelatoriosCombate.Batalha(m, b, c, plano, rc, full, feridosA, feridosD, efeito, modo);
            foreach (var f in Combates.AoTerminar) f(m, rc);
            if (venceu && plano.Tipo == Ataques.Cerco && l != null && defR != null && vivos.FirstOrDefault() is { } vencedor)
                foreach (var f in Combates.AoCairCastelo) f(m, defR, vencedor, l);

            m.Agendar(new LimparBatalhaEvento { BatalhaId = b.Id, Quando = agora + T.DeHoras(m.P.Combate.GuardarBatalhaH) });
            AvisarLados(m, b);
            m.Avisar(b.AtacanteId, "reino"); m.Avisar(b.DefensorId, "reino");
            m.Avisar(b.AtacanteId, "mapa"); m.Avisar(b.DefensorId, "mapa");

            // quem esperava a batalha acabar ataca agora
            var espera = b.Espera.ToList(); b.Espera.Clear();
            foreach (var id in espera)
                if (m.Marchas.Obter(id) is Exercito e && e.Parado && EhAtaque(e) && e.HexEm(agora) == b.Hex) Chegou(m, e);
        }

        // ---------------------------------------------------------------- série para a tela e o relatório

        public sealed record PontoSerie(long T, double A, double D, bool Projecao);

        private static (double a, double d) Valor(MarcoBatalha mc, double p) => (mc.A * (1 - mc.PerdaA * p), mc.D * (1 - mc.PerdaD * p));

        /// <summary>
        /// Força dos dois lados ao longo da batalha (ms desde o início): até agora, o que aconteceu; depois, a tendência
        /// com a composição atual até o fim previsto. Nos marcos, dois pontos (antes e depois) para mostrar o salto.
        /// </summary>
        public static List<PontoSerie> Serie(Batalha b, long agora, int pontos = 24)
        {
            var res = new List<PontoSerie>();
            if (b.Marcos.Count == 0) return res;
            var fim = b.Encerrada ? b.EncerradaEm ?? b.FimPrevisto : b.FimPrevisto;
            var ate = b.Encerrada ? fim : Math.Min(Math.Max(agora, b.Inicio), fim);
            var tempos = new SortedSet<long> { b.Inicio, fim, ate };
            for (var i = 1; i < pontos; i++) tempos.Add(b.Inicio + (long)((fim - b.Inicio) * (i / (double)pontos)));
            var marcos = b.Marcos.Where(x => x.T <= fim).ToList();
            foreach (var t in tempos)
            {
                if (t > fim) continue;
                for (var i = 1; i < marcos.Count; i++)
                    if (marcos[i].T == t && marcos[i].T > b.Inicio)
                    {
                        var (a0, d0) = Valor(marcos[i - 1], Progresso(b, t));
                        res.Add(new PontoSerie(t - b.Inicio, Math.Round(a0, 1), Math.Round(d0, 1), t > ate));
                    }
                var mc = marcos.LastOrDefault(x => x.T <= t) ?? marcos[0];
                var (a, d) = Valor(mc, Progresso(b, t));
                res.Add(new PontoSerie(t - b.Inicio, Math.Round(a, 1), Math.Round(d, 1), t > ate));
            }
            foreach (var mc in marcos.Where(x => x.T > b.Inicio && !tempos.Contains(x.T)))
            {
                var antes = marcos.LastOrDefault(x => x.T < mc.T) ?? marcos[0];
                var (a0, d0) = Valor(antes, Progresso(b, mc.T));
                var (a1, d1) = Valor(mc, Progresso(b, mc.T));
                res.Add(new PontoSerie(mc.T - b.Inicio, Math.Round(a0, 1), Math.Round(d0, 1), mc.T > ate));
                res.Add(new PontoSerie(mc.T - b.Inicio, Math.Round(a1, 1), Math.Round(d1, 1), mc.T > ate));
            }
            return res.OrderBy(x => x.T).ToList();
        }

        /// <summary>Força atual dos dois lados (pelo último marco).</summary>
        public static (double a, double d) ForcaAgora(Batalha b, long agora)
        {
            var mc = b.Marcos.LastOrDefault(x => x.T <= agora) ?? b.Marcos.FirstOrDefault();
            if (mc == null) return (0, 0);
            return Valor(mc, Progresso(b, b.Encerrada ? b.EncerradaEm ?? agora : agora));
        }

        // ---------------------------------------------------------------- ganchos

        /// <summary>Tropas entraram num local em batalha (reforço): a composição muda.</summary>
        internal static void AoEntrarNoLocal(Mundo m, Exercito ex, Local l)
        {
            var b = Ativa(m, l.Id);
            if (b == null || l.ReinoId != b.DefensorId || ex.ReinoId != b.DefensorId) return;
            Recalcular(m, b, "Reforços chegaram: " + GT.Partes(m, ex.Tropas) + ".", "defesa");
        }

        /// <summary>Tropas saíram de um local em batalha: a composição muda.</summary>
        internal static void AoPartir(Mundo m, Marcha mc)
        {
            if (mc is not Exercito e || e.Caminho.Count == 0 || e.Partida != m.Agora) return;
            var b = Ativa(m, e.OrigemLocalId);
            if (b == null || e.ReinoId != b.DefensorId || e.Caminho[0] != b.Hex) return;
            Recalcular(m, b, "Tropas deixaram o local: " + GT.Partes(m, e.Tropas) + ".", "defesa");
        }
    }
}

namespace ReinoDePedra.Jogo
{
    public sealed partial class Mundo
    {
        public Colecao<Combate.Batalha> Batalhas { get; } = new("batalhas");
    }
}
