using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

using ReinoDePedra.Jogo.Pessoas;
using PS = ReinoDePedra.Jogo.Pessoas.Pessoas;

namespace ReinoDePedra.Jogo.Combate
{
    /// <summary>
    /// Instante em que a composição da batalha mudou (início, reforço, saída de tropas, outra frente): valores de ataque e
    /// defesa desta frente e as perdas projetadas sem limite de tática. Entre um marco e o seguinte, a força mostrada de cada
    /// lado é <c>valor × (1 − perda × progresso)</c>. O progresso anda mais rápido conforme as tropas caem:
    /// <c>dt = Dur × (1 − M × p) dp</c>, ou seja, com metade das tropas vivas a batalha corre no dobro do ritmo.
    /// </summary>
    public sealed class MarcoBatalha
    {
        public long T { get; set; }
        public double A { get; set; }
        public double D { get; set; }
        public double PerdaA { get; set; }
        public double PerdaD { get; set; }
        /// <summary>Progresso no instante do marco.</summary>
        public double P { get; set; }
        /// <summary>Tempo (ms) que o progresso de 0 a 1 levaria se ninguém caísse.</summary>
        public long Dur { get; set; }
        /// <summary>Fração das tropas da frente que cai até o progresso 1.</summary>
        public double M { get; set; }
        /// <summary>Parte da defesa que enfrenta esta frente (1 = ataque único).</summary>
        public double Parte { get; set; } = 1;
        public string? Txt { get; set; }
        /// <summary>"ataque", "defesa" ou null (os dois).</summary>
        public string? Lado { get; set; }
    }

    /// <summary>
    /// Frente de batalha num local: uma por reino atacante. Começa quando o ataque chega; o tempo sai de
    /// <see cref="Batalhas.Duracao"/> e encurta conforme as tropas caem. Vários reinos atacam o mesmo local ao mesmo tempo, cada
    /// um na sua frente, e a mesma defesa se divide entre elas na proporção da força de cada ataque. Enquanto dura, o defensor
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
        public long Inicio { get; set; }
        /// <summary>Fim pelo ritmo atual (progresso 1).</summary>
        public long Fim { get; set; }
        /// <summary>Quando vai terminar com a composição atual (antes de <see cref="Fim"/> se a tática manda recuar).</summary>
        public long FimPrevisto { get; set; }
        public long? EventoId { get; set; }
        public List<MarcoBatalha> Marcos { get; set; } = new();
        /// <summary>Tropas atacantes vistas pelo defensor (as do início mais as que se juntaram).</summary>
        public Dictionary<string, int> TropasAtaque { get; set; } = new();
        /// <summary>Hexágono de onde veio o primeiro ataque (para a direção de origem).</summary>
        public int OrigemHex { get; set; }
        public bool Encerrada { get; set; }
        /// <summary>Por que as tropas voltaram sem ordem do jogador nem limite da tática (sem o que levar, o local caiu).</summary>
        public string? MotivoRecuo { get; set; }
        /// <summary>"vitoria", "derrota", "recuo" (do atacante) ou "defesa-recuou".</summary>
        public string? Resultado { get; set; }
        public long? EncerradaEm { get; set; }
        public Dictionary<string, int> PerdasAtaque { get; set; } = new();
        public Dictionary<string, int> PerdasDefesa { get; set; } = new();
        public double MiliciaMorta { get; set; }
        /// <summary>Quem lutou pela defesa nesta frente (tropas e milícia, na parte dela), guardado no fim para o placar.</summary>
        public int TotalDefesa { get; set; }
        /// <summary>Nomes dos civis mortos na milícia.</summary>
        public List<string> CivisMortos { get; set; } = new();
        /// <summary>Nomes dos soldados mortos de cada lado.</summary>
        public List<string> MortosAtaque { get; set; } = new();
        public List<string> MortosDefesa { get; set; } = new();
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
        /// <summary>As frentes em andamento no local.</summary>
        public static List<Batalha> Ativas(Mundo m, long localId) => m.Batalhas.Where(b => !b.Encerrada && b.LocalId == localId).OrderBy(b => b.Id).ToList();
        public static IEnumerable<Batalha> DoReino(Mundo m, long reinoId) => m.Batalhas.Where(b => b.AtacanteId == reinoId || b.DefensorId == reinoId);

        /// <summary>
        /// Duração sem nenhuma baixa (P.combate.batalha): não há tempo fixo. Sai das tropas do lado mais fraco e de quão
        /// desigual é a luta (<see cref="Config.Formulas.DuracaoBatalha"/>): 50 contra 1 acaba em segundos.
        /// </summary>
        public static long Duracao(Mundo m, double tropasAtaque, double tropasDefesa, double forcaAtaque, double forcaDefesa)
        {
            var maior = Math.Max(forcaAtaque, forcaDefesa);
            var razao = maior > 0 ? Math.Min(forcaAtaque, forcaDefesa) / maior : 1;
            var fraco = forcaAtaque <= forcaDefesa ? tropasAtaque : tropasDefesa;
            return T.DeSegundos(m.F.DuracaoBatalha(fraco, razao));
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
                var motivo = Permissoes.MotivoEnvio(m, r, def, l) ?? Permissoes.MotivoChegada(m, r, def);
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
            if (Ativas(m, l.Id).FirstOrDefault(x => x.AtacanteId == ex.ReinoId) is { } b) { Juntar(m, b, ex); return; }
            if (semDono) { Efeitos.OcuparSemDono(m, ex, l); return; }
            Economia.Atualizar(m, def!);
            if (Ataques.SemOQueLevar(m, r, plano, l) is { } vazio)
            {
                RelatoriosCombate.SemCombate(m, ex, l, plano, vazio, def);
                ex.Retornar(m); return;
            }
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
                Inicio = agora, OrigemHex = origem,
                TropasAtaque = new(ex.Tropas),
            };
            b.Exercitos.Add(ex.Id);
            var outras = Ativas(m, l.Id);
            m.Batalhas.Adicionar(b);
            ex.BatalhaId = b.Id; m.Sujar(ex);
            Revide.Registrar(m, def.Id, ex.ReinoId);
            Vidas.ReavaliarLocal(m, l);
            Recalcular(m, b, outras.Count > 0 ? "A batalha começou. A defesa já luta em outra frente." : "A batalha começou.", null);
            foreach (var o in outras) Recalcular(m, o, "Outra força atacou o local: a defesa se divide.", "defesa");
            var atk = m.Reinos.Obter(ex.ReinoId)!;
            Registros.Notificar(m, def.Id, "ataques", "Batalha em " + l.Nome, "O exército de " + atk.Nome + " ataca (" + Ataques.NomesTipo[plano.Tipo].ToLowerInvariant() + "). Envie reforços ou recue.", "batalha?id=" + b.Id);
            Registros.Notificar(m, atk.Id, "batalhas", "Batalha começou", "Suas tropas atacam: " + Ataques.NomeAlvo(l) + ".", "batalha?id=" + b.Id);
            AoComecar?.Invoke(m, b, l);
        }

        /// <summary>Uma frente nova começou neste local (o feed público anuncia).</summary>
        public static event Action<Mundo, Batalha, Local>? AoComecar;

        private static void Juntar(Mundo m, Batalha b, Exercito ex)
        {
            ex.Parar(m);
            ex.BatalhaId = b.Id; m.Sujar(ex);
            b.Exercitos.Add(ex.Id);
            GT.Somar(b.TropasAtaque, ex.Tropas);
            RecalcularLocal(m, b.LocalId, "Chegaram mais atacantes: " + GT.Partes(m, ex.Tropas) + ".", "ataque", b.Id, "Outra frente recebeu mais tropas.");
        }

        // ---------------------------------------------------------------- composição e fórmula

        /// <summary>
        /// Uma frente como ela está: <c>Ataque</c> e <c>Exercitos</c> são desta frente; <c>Defesa</c> e <c>Extra</c>, a defesa
        /// inteira do local; <c>AtaqueTotal</c>, a soma das frentes (é ela que a defesa enfrenta); <c>Parte</c>, a fração da
        /// defesa que luta nesta frente (a força desta frente sobre a soma).
        /// </summary>
        public sealed record Composicao(Local? Local, Reino? Defensor, List<Exercito> Exercitos, Dictionary<string, int> Ataque, Dictionary<string, int> Defesa, ExtraDefesa Extra,
            Dictionary<string, int> AtaqueTotal, double Parte);

        public static Composicao Compor(Mundo m, Batalha b)
        {
            var l = m.Locais.Obter(b.LocalId);
            var def = m.Reinos.Obter(b.DefensorId);
            var exs = ExercitosDe(m, b);
            var atk = new Dictionary<string, int>();
            foreach (var e in exs) GT.Somar(atk, e.Tropas);
            var dono = l != null && def != null && l.ReinoId == def.Id && !l.Ruina;
            var defG = dono ? GT.Limpo(l!.Guarnicao) : new Dictionary<string, int>();
            // todas as frentes do local (esta inclusive, mesmo já encerrando): a defesa enfrenta a soma delas
            var todos = new List<Exercito>(exs);
            foreach (var o in Ativas(m, b.LocalId)) if (o.Id != b.Id) todos.AddRange(ExercitosDe(m, o));
            var atkTotal = new Dictionary<string, int>();
            foreach (var e in todos) GT.Somar(atkTotal, e.Tropas);
            var totA = todos.Sum(e => GT.Total(e.Tropas));
            var bonusA = totA > 0 ? todos.Sum(e => Bonus.SomaAtaque(m, e) * GT.Total(e.Tropas)) / totA : 0;
            var x = new ExtraDefesa
            {
                Pop = dono ? Combates.PopDoLocal(m, def!, l!) : 0,
                ArqTorre = dono ? Defesas.ArqueirosNoAlto(m, l!) : 0,
                BonusD = dono ? Bonus.SomaDefesa(m, l!) : 0,
                BonusA = bonusA,
                Portoes = dono && l!.Tipo == TipoLocal.Castelo ? Math.Clamp(l.Portoes, 0, Defesas.PortoesMax(m)) : 0,
            };
            var parte = 1.0;
            if (todos.Count > exs.Count)
            {
                var meu = atk.Count > 0 ? m.F.ValorAtaque(atk, defG, bonusA) : 0;
                var soma = m.F.ValorAtaque(atkTotal, defG, bonusA);
                parte = soma > 0 ? Math.Clamp(meu / soma, 0, 1) : 1;
            }
            return new Composicao(l, def, exs, atk, defG, x, atkTotal, parte);
        }

        private static List<Exercito> ExercitosDe(Mundo m, Batalha b) =>
            b.Exercitos.Select(id => m.Marchas.Obter(id) as Exercito).OfType<Exercito>().Where(e => GT.Total(e.Tropas) > 0).ToList();

        /// <summary>A fórmula para esta frente: a soma dos ataques contra a defesa inteira, com a força mostrada na parte da frente.</summary>
        public static ResultadoBatalha Formula(Mundo m, Composicao c, double? limite)
        {
            var r = m.F.Batalha(c.AtaqueTotal, c.Defesa, c.Extra, limite);
            return r with { A = r.A * c.Parte, D = r.D * c.Parte };
        }

        /// <summary>Progresso (0 a 1) da frente no instante t: o tempo dt = Dur × (1 − M × p) dp, resolvido a partir do último marco.</summary>
        public static double Progresso(Batalha b, long t)
        {
            var mc = b.Marcos.LastOrDefault(x => x.T <= t) ?? b.Marcos.FirstOrDefault();
            if (mc == null) return 0;
            if (mc.Dur <= 0) return 1;
            var c = mc.P - mc.M * mc.P * mc.P / 2 + Math.Max(0, t - mc.T) / (double)mc.Dur;
            var p = mc.M < 1e-9 ? c : (1 - Math.Sqrt(Math.Max(0, 1 - 2 * mc.M * c))) / mc.M;
            return Math.Clamp(p, 0, 1);
        }

        /// <summary>Instante em que o progresso chega a <paramref name="p"/>, pelo ritmo do marco.</summary>
        public static long TempoAte(MarcoBatalha mc, double p) =>
            mc.T + (long)Math.Round(mc.Dur * (p - mc.P - mc.M * (p * p - mc.P * mc.P) / 2));

        /// <summary>Todas as frentes do local mudam (reforço, tropas que saem, equipamento). A frente <paramref name="id"/> recebe o texto principal.</summary>
        public static void RecalcularLocal(Mundo m, long localId, string? txt, string? lado, long? id = null, string? txtOutras = null)
        {
            foreach (var b in Ativas(m, localId))
                Recalcular(m, b, id == null || b.Id == id ? txt : txtOutras ?? txt, id == null || b.Id == id ? lado : null);
        }

        /// <summary>A composição mudou: novo marco, novo fim previsto (a tática pode mandar recuar antes do fim).</summary>
        public static void Recalcular(Mundo m, Batalha b, string? txt, string? lado)
        {
            if (b.Encerrada) return;
            if (m.Reinos.Obter(b.DefensorId) is { } dr) Economia.Atualizar(m, dr);
            var plano = PlanoAtaque.Ler(b.Plano);
            // o estoque pode ter acabado (outra frente levou, o dono gastou): sem o que levar, as tropas voltam
            if (m.Locais.Obter(b.LocalId) is { } lv && m.Reinos.Obter(b.AtacanteId) is { } ar && Ataques.SemOQueLevar(m, ar, plano, lv) is { } vazio)
            {
                b.MotivoRecuo = vazio;
                Encerrar(m, b, ModoRecuoAtaque);
                return;
            }
            var c = Compor(m, b);
            var full = Formula(m, c, null);
            var agora = m.Agora;
            var p0 = Progresso(b, agora);
            var defesa = (GT.Total(c.Defesa) + c.Extra.Pop * m.P.MiliciaPorPop) * c.Parte;
            var nA = GT.Total(c.Ataque);
            var mc = new MarcoBatalha
            {
                T = agora, A = full.A, D = full.D, PerdaA = full.PerdaA, PerdaD = full.PerdaD, Txt = txt, Lado = lado, P = p0, Parte = c.Parte,
                Dur = Duracao(m, nA, defesa, full.A, full.D),
                M = nA + defesa > 0 ? Math.Clamp((nA * full.PerdaA + defesa * full.PerdaD) / (nA + defesa), 0, 1) : 0,
            };
            b.Marcos.Add(mc);
            b.Fim = TempoAte(mc, 1);
            var alvo = b.Fim;
            var lim = Ataques.Limite(m, plano.Tatica);
            if (!full.VenceA && lim is double L && L < 1)
                alvo = p0 >= L ? agora : TempoAte(mc, L);
            if (c.Exercitos.Count == 0) alvo = agora;
            b.FimPrevisto = alvo;
            m.Cancelar(b.EventoId);
            b.EventoId = m.Agendar(new FimBatalhaEvento { BatalhaId = b.Id, Quando = alvo }).Id;
            m.Sujar(b);
            AvisarLados(m, b);
        }

        private static void AvisarLados(Mundo m, Batalha b)
        {
            m.Avisar(b.AtacanteId, "batalha", new AvisoBatalhaJson(id: b.Id));
            m.Avisar(b.DefensorId, "batalha", new AvisoBatalhaJson(id: b.Id));
        }

        // ---------------------------------------------------------------- recuo

        /// <summary>Recuo ordenado por um dos lados durante a batalha.</summary>
        public static void Recuar(Mundo m, Reino r, long batalhaId)
        {
            var b = m.Batalhas.Obter(batalhaId);
            if (b == null || (b.AtacanteId != r.Id && b.DefensorId != r.Id)) throw new RegraException("Batalha não encontrada.", 404);
            if (b.Encerrada) throw new RegraException("A batalha já acabou.");
            if (b.AtacanteId == r.Id) { Encerrar(m, b, ModoRecuoAtaque); return; }
            // a defesa é uma só: deixa o local de uma vez, em todas as frentes
            Encerrar(m, b, ModoRecuoDefesa);
            foreach (var o in Ativas(m, b.LocalId)) Encerrar(m, o, ModoRecuoDefesa);
        }

        // ---------------------------------------------------------------- fim

        /// <summary>
        /// Resolve a frente. No fim (pelo tempo ou pelo limite da tática) usa exatamente <c>m.F.Batalha</c> com a soma das frentes;
        /// a defesa perde a parte desta frente. Num recuo ordenado, cada lado perde a parte das perdas projetadas já lutada
        /// (perda × progresso); a defesa que recua perde de uma vez, porque sai de todas as frentes.
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
            var full = Formula(m, c, null);
            double perdaA, perdaD; bool venceu; string resultado;
            if (modo == ModoFim)
            {
                var res = Formula(m, c, lim);
                perdaA = res.PerdaA; perdaD = res.PerdaD * c.Parte; venceu = res.VenceA;
                resultado = res.VenceA ? "vitoria" : res.Recuou ? "recuo" : "derrota";
            }
            else
            {
                perdaA = full.PerdaA * p; perdaD = full.PerdaD * p * (modo == ModoRecuoDefesa ? 1 : c.Parte);
                venceu = modo == ModoRecuoDefesa;
                resultado = venceu ? "defesa-recuou" : "recuo";
            }
            b.Resultado = resultado;

            // perdas: proporcionais entre as unidades de cada exército e da guarnição; dentro de cada unidade, quem cai é sorteado
            var trebuchetsInicio = c.Ataque.GetValueOrDefault("trebuchet");
            var perdasAtk = new Dictionary<string, int>();
            var caidasA = new List<Pessoa>();
            foreach (var ex in c.Exercitos)
            {
                var pe = Combates.Perdas(ex.Tropas, perdaA);
                caidasA.AddRange(PS.Baixas(m, ex, pe));
                GT.Somar(perdasAtk, pe);
                m.Sujar(ex);
            }
            var perdasDef = Combates.Perdas(c.Defesa, perdaD);
            var caidasD = l != null && perdasDef.Count > 0 ? PS.Baixas(m, l, perdasDef) : new List<Pessoa>();
            var miliciaPessoas = c.Extra.Pop * m.P.MiliciaPorPop;
            var miliciaMorta = modo == ModoRecuoDefesa ? 0 : Math.Floor(miliciaPessoas * perdaD * m.P.MiliciaBaixas + 1e-9);   // os outros civis fogem
            if (defR != null && l != null && miliciaMorta > 0) b.CivisMortos = PS.Matar(m, PS.Presentes(m, l), (int)miliciaMorta);
            b.PerdasAtaque = perdasAtk; b.PerdasDefesa = perdasDef; b.MiliciaMorta = miliciaMorta;
            b.TotalDefesa = (int)Math.Round((GT.Total(c.Defesa) + miliciaPessoas) * c.Parte);

            // feridos: de quem vence ou recua (quem perde sem recuar não tem feridos); os outros caídos morrem
            var feridosA = venceu || resultado == "recuo" ? Combates.Feridos(m, perdasAtk) : new();
            var (mortosA, feridasA) = PS.Enterrar(m, caidasA, feridosA);
            // os feridos de um reforço aliado são do reino que o mandou (o dono do local fica só com os dele)
            var feridosD = new Dictionary<string, int>();
            var feridosAliados = new List<(Reino reino, Dictionary<string, int> feridos, List<Pessoa> pessoas)>();
            var mortosD = new List<string>(); var feridasD = new List<Pessoa>();
            if (!venceu || modo == ModoRecuoDefesa)
            {
                var proprias = new Dictionary<string, int>(perdasDef);
                if (l != null)
                    foreach (var (e, pe) in Reforcos.PartesDasPerdas(l, c.Defesa, perdasDef))
                    {
                        Combates.Tirar(proprias, pe);
                        var fa = Combates.Feridos(m, pe);
                        var (ma, fp) = PS.Enterrar(m, caidasD.Where(p => p.ReinoId == e.ReinoId).ToList(), fa);
                        mortosD.AddRange(ma);
                        if (m.Reinos.Obter(e.ReinoId) is { Ativo: true } ar) feridosAliados.Add((ar, fa, fp));
                    }
                feridosD = Combates.Feridos(m, proprias);
                var (md, fd) = PS.Enterrar(m, caidasD.Where(p => defR == null || p.ReinoId == defR.Id).ToList(), feridosD);
                mortosD.AddRange(md); feridasD = fd;
            }
            else mortosD.AddRange(PS.Enterrar(m, caidasD, null).mortos);
            b.MortosAtaque = mortosA; b.MortosDefesa = mortosD;
            if (atkR != null && feridosA.Count > 0)
            {
                var origem = c.Exercitos.Select(e => m.Locais.Obter(e.OrigemLocalId)).FirstOrDefault(x => x != null && x.ReinoId == atkR.Id);
                foreach (var f in Combates.AoFerir) f(m, atkR, feridosA, origem, feridasA);
            }
            if (defR != null && feridosD.Count > 0)
                foreach (var f in Combates.AoFerir) f(m, defR, feridosD, l != null && l.ReinoId == defR.Id ? l : null, feridasD);
            foreach (var (ar, fa, fp) in feridosAliados)
                if (fa.Count > 0) foreach (var f in Combates.AoFerir) f(m, ar, fa, l, fp);

            var rc = new ResultadoCombate(b.Id, b.LocalId, b.AtacanteId, b.DefensorId, plano.Tipo, resultado, full.A, full.D,
                c.Ataque, c.Defesa, perdasAtk, perdasDef, miliciaMorta);
            SistemaGuerra.AposBatalha(m, b, c, rc, perdasDef);   // veterania e revide, antes de as tropas saírem

            // a defesa que recua sai do local com o que sobrou
            if (modo == ModoRecuoDefesa && l != null && defR != null && l.ReinoId == defR.Id)
            {
                var resto = GT.Limpo(l.Guarnicao);
                if (resto.Count > 0) { PS.Sair(m, l, resto, null, todosOsReinos: true); Efeitos.Fugir(m, defR, l, resto); }
            }

            // efeitos: objetivos (vitória) ou só o dano de trebuchets à distância (derrota e recuo)
            var vivos = c.Exercitos.Where(e => GT.Total(e.Tropas) > 0).ToList();
            var mesmoDono = l != null && l.ReinoId == b.DefensorId;   // o local caiu em outra frente: ninguém bate no novo dono
            var dano = !mesmoDono ? 0 : trebuchetsInicio * m.B.U["trebuchet"].Cerco
                       + (venceu ? vivos.Sum(e => e.Tropas.GetValueOrDefault("ariete")) * m.B.U["ariete"].Cerco : 0);
            var efeito = new ResumoEfeitos();
            if (l != null && venceu && vivos.Count > 0)
                Efeitos.Aplicar(m, b, plano, l, defR, vivos, modo == ModoRecuoDefesa, dano, efeito);
            else if (l != null)
                Efeitos.SoDanoDeCerco(m, plano, l, dano, efeito, venceu, resultado, lim, modo != ModoFim, b.MotivoRecuo);

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
                P = p, Dur = ultimo?.Dur ?? 0, M = ultimo?.M ?? 0, Parte = ultimo?.Parte ?? 1,
                Txt = resultado switch { "vitoria" => "Os atacantes venceram.", "derrota" => "A defesa venceu.", "recuo" => b.MotivoRecuo ?? "Os atacantes recuaram.", _ => "A defesa recuou." },
            });
            m.Sujar(b);

            RelatoriosCombate.Batalha(m, b, c, plano, rc, full, feridosA, feridosD, efeito, modo);
            foreach (var f in Combates.AoTerminar) f(m, rc);
            if (venceu && plano.Tipo == Ataques.Cerco && l != null && defR != null && vivos.FirstOrDefault() is { } vencedor)
                foreach (var f in Combates.AoCairCastelo) f(m, defR, vencedor, l);

            m.Agendar(new LimparBatalhaEvento { BatalhaId = b.Id, Quando = agora + T.DeHoras(m.P.Combate.GuardarBatalhaH) });
            AvisarLados(m, b);
            m.Avisar(b.AtacanteId, "reino"); m.Avisar(b.DefensorId, "reino");
            m.Avisar(b.AtacanteId, "mapa"); m.Avisar(b.DefensorId, "mapa");

            // as outras frentes: se o local caiu, não há mais o que atacar; senão, a defesa que sobrou se redivide
            foreach (var o in Ativas(m, b.LocalId))
            {
                if (o.Encerrada) continue;
                if (l == null || l.Ruina || l.ReinoId != o.DefensorId)
                {
                    o.MotivoRecuo = "O local caiu nas mãos de outra força antes do fim da batalha.";
                    Encerrar(m, o, ModoRecuoAtaque);
                }
                else Recalcular(m, o, "Uma frente terminou: a defesa se redivide.", null);
            }
            if (l != null) Vidas.ReavaliarLocal(m, l);
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

        /// <summary>
        /// Placar de uma frente para a tela e o mapa: valores do último marco e o ritmo, para o cliente andar sozinho entre uma
        /// busca e outra. Baixas ao vivo são a projeção da fórmula (total × perda × progresso); um reforço muda a projeção.
        /// </summary>
        public sealed record Placar(long T0, double P0, long Dur, double M, double A, double D, double PerdaA, double PerdaD,
            int TotalA, int TotalD, double BaixaA, double BaixaD, double Parte, double Progresso, int BaixasA, int BaixasD);

        public static Placar PlacarDe(Mundo m, Batalha b, long agora)
        {
            var mc = b.Marcos.LastOrDefault() ?? new MarcoBatalha();
            var c = Compor(m, b);
            var (a, d) = (mc.A, mc.D);
            if (b.Encerrada)
            {
                var baixasD = GT.Total(b.PerdasDefesa) + (int)b.MiliciaMorta;
                return new Placar(mc.T, mc.P, 0, 0, a, d, mc.PerdaA, mc.PerdaD, GT.Total(b.TropasAtaque), b.TotalDefesa, GT.Total(b.TropasAtaque), b.TotalDefesa, mc.Parte, mc.P,
                    GT.Total(b.PerdasAtaque), baixasD);
            }
            var milicia = c.Extra.Pop * m.P.MiliciaPorPop;
            var totalA = GT.Total(c.Ataque);
            var totalD = (int)Math.Round((GT.Total(c.Defesa) + milicia) * c.Parte);
            var baixaD = (GT.Total(c.Defesa) + milicia * m.P.MiliciaBaixas) * c.Parte;   // da milícia, só uma parte morre
            var p = Progresso(b, agora);
            return new Placar(mc.T, mc.P, mc.Dur, mc.M, a, d, mc.PerdaA, mc.PerdaD, totalA, totalD, totalA, baixaD, c.Parte, p,
                (int)Math.Round(totalA * mc.PerdaA * p), (int)Math.Round(baixaD * mc.PerdaD * p));
        }

        // ---------------------------------------------------------------- ganchos

        /// <summary>Tropas entraram num local em batalha (reforço): a composição muda.</summary>
        internal static void AoEntrarNoLocal(Mundo m, Exercito ex, Local l)
        {
            if (l.ReinoId != ex.ReinoId || Ativa(m, l.Id) is not { } b || b.DefensorId != ex.ReinoId) return;
            RecalcularLocal(m, l.Id, "Reforços chegaram: " + GT.Partes(m, ex.Tropas) + ".", "defesa");
        }

        /// <summary>Tropas saíram de um local em batalha: a composição muda.</summary>
        internal static void AoPartir(Mundo m, Marcha mc)
        {
            if (mc is not Exercito e || e.Caminho.Count == 0) return;   // AoPartir só roda na partida (o relógio real anda entre Partir e o gancho)
            var b = Ativa(m, e.OrigemLocalId);
            if (b == null || e.ReinoId != b.DefensorId || e.Caminho[0] != b.Hex) return;
            RecalcularLocal(m, b.LocalId, "Tropas deixaram o local: " + GT.Partes(m, e.Tropas) + ".", "defesa");
        }
    }
}

namespace ReinoDePedra.Jogo
{
    public sealed partial class Mundo
    {
        public Colecao<Combate.Batalha> Batalhas { get; } = new("batalhas");
    }
    // Formato das respostas em JSON: o nome, a ordem e o tipo de cada membro são o contrato com o cliente.
    public sealed record AvisoBatalhaJson(long id);
}
