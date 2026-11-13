using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.IA
{
    /// <summary>
    /// Quem governa um reino de IA: uma pessoa inventada, com nome, história curta, objetivos, temperamento, traços, nível de
    /// atenção, horário de jogo e jeito de escrever. A persona não cria regra nenhuma: só escolhe, dentro das mesmas regras
    /// dos jogadores, quando o reino joga, o que ele esquece, o que ele prefere e como ele fala.
    /// <para><b>É segredo.</b> Fica só no servidor, gravada com o reino: nunca vai ao cliente, ao feed nem a log. Saber a
    /// persona de um reino é saber que ele é de IA.</para>
    /// <para>Os traços vão de 0 a 1 e <b>0,5 é neutro</b>: uma persona com tudo em 0,5, assiduidade 1, disciplina 1 e reflexo 0
    /// (<see cref="Personas.Neutra"/>) joga exatamente como a conduta de habilidade × perfil, sem variação.</para>
    /// <para>É um documento simples (só propriedades), serializável como está: é o que uma LLM futura recebe, junto com o
    /// contexto da fala (<see cref="ContextoFala"/>), para escrever no lugar dos modelos de texto.</para>
    /// </summary>
    public sealed class Persona
    {
        public int Versao { get; set; } = Personas.VersaoAtual;

        // ---- quem é
        /// <summary>Nome de quem governa (ex.: "Brenda, a Justa").</summary>
        public string Governante { get; set; } = "";
        public bool Feminina { get; set; }
        /// <summary>Como se apresenta: "Rainha", "Duque", "Senhora"...</summary>
        public string Titulo { get; set; } = "";
        public int Idade { get; set; }
        /// <summary>O tipo em uma palavra: conquistador, guardião, mercador, desbravador, diplomata, vingador, soberano, eremita, aliado fiel, estrategista.</summary>
        public string Arquetipo { get; set; } = "";
        /// <summary>colérico, sereno, desconfiado, jovial, altivo ou ponderado.</summary>
        public string Temperamento { get; set; } = "";
        /// <summary>De onde tira as ideias (figuras e imagens que admira).</summary>
        public List<string> Inspiracoes { get; set; } = new();
        /// <summary>O que quer da temporada, do mais para o menos importante: riqueza, territorio, reliquias, seguranca, gloria, amizades, vinganca.</summary>
        public List<string> Objetivos { get; set; } = new();
        /// <summary>Uma frase de história, para dar voz às falas.</summary>
        public string Historia { get; set; } = "";

        // ---- traços (0 a 1; 0,5 é neutro)
        /// <summary>Quer briga: ataca com menos folga, mantém mais tropas, executa prisioneiros.</summary>
        public double Agressividade { get; set; } = 0.5;
        /// <summary>Deixa estar: expande menos, reage menos.</summary>
        public double Passividade { get; set; } = 0.5;
        /// <summary>Espera a hora certa: segura item parado na fila por mais tempo, guarda rancor por mais tempo sem agir.</summary>
        public double Paciencia { get; set; } = 0.5;
        /// <summary>Quer mais: margem maior nas trocas, pede resgate, prefere alvo rico.</summary>
        public double Ganancia { get; set; } = 0.5;
        /// <summary>Fica com os seus: ajuda aliado, não troca de aliança.</summary>
        public double Lealdade { get; set; } = 0.5;
        /// <summary>Não esquece: guarda por mais tempo quem o atacou e vai atrás.</summary>
        public double Rancor { get; set; } = 0.5;
        /// <summary>Gosta de gente: conversa, convida, responde.</summary>
        public double Sociabilidade { get; set; } = 0.5;
        /// <summary>Mede o risco: exige mais folga para atacar, recua mais cedo.</summary>
        public double Cautela { get; set; } = 0.5;
        /// <summary>Não leva desaforo: responde a ameaça, recusa pacto cobrado.</summary>
        public double Orgulho { get; set; } = 0.5;
        /// <summary>Quer ver o mapa: explora mais.</summary>
        public double Curiosidade { get; set; } = 0.5;
        /// <summary>Atenção ao jogo: 1 nunca esquece nada; quanto menor, mais vezes deixa uma fila vazia ou reage tarde.</summary>
        public double Disciplina { get; set; } = 1;

        // ---- quando joga
        /// <summary>
        /// Faixa de horário (uma das chaves de <c>P.ia.cronotipos</c>: madrugador, normal, notívago, coruja). Vazia: ainda sem
        /// faixa (persona de um mundo de antes da decisão 0044), e ela ganha uma ao subir, uma vez só (<see cref="Cronotipos.Atribuir"/>).
        /// </summary>
        public string Cronotipo { get; set; } = "";
        /// <summary>Desloca as horas de sessão da habilidade (horas; negativo é madrugador, positivo é noturno), dentro da faixa do <see cref="Cronotipo"/>.</summary>
        public double DesvioHoras { get; set; }
        /// <summary>Chance de aparecer em cada sessão marcada (1 = nunca falta).</summary>
        public double Assiduidade { get; set; } = 1;
        /// <summary>Como joga no fim de semana: acima de 1 falta menos; abaixo, falta mais.</summary>
        public double FimDeSemana { get; set; } = 1;
        /// <summary>Tempo de reação: 0 não tem atraso nem reage fora da sessão (neutro); perto de 0,6 é rápido, perto de 1,8 é lento.</summary>
        public double Reflexo { get; set; }
        /// <summary>Faltas seguidas (ninguém some por três sessões).</summary>
        public int Faltas { get; set; }

        // ---- como fala
        /// <summary>formal, seco, brincalhão, arcaico, direto ou caloroso.</summary>
        public string Tom { get; set; } = "direto";
        /// <summary>Escreve tudo em minúsculas.</summary>
        public bool Minusculas { get; set; }
        /// <summary>Quanto escreve com pressa (0 a 1): sem acento, abreviado, letra trocada.</summary>
        public double Pressa { get; set; }
        /// <summary>Expressões que repete.</summary>
        public List<string> Bordoes { get; set; } = new();

        // ---- o que lembra dos outros reinos (0 a 1 por reino; apaga com o tempo)
        public Dictionary<long, double> Rancores { get; set; } = new();
        public Dictionary<long, double> Afinidades { get; set; } = new();
        /// <summary>Quando a memória foi envelhecida pela última vez.</summary>
        public long MemoriaEm { get; set; }
        /// <summary>Quando falou pela última vez em cada conversa (chave livre), para não repetir assunto.</summary>
        public Dictionary<string, long> FalouEm { get; set; } = new();
    }

    /// <summary>Geração da persona e o que ela muda no comportamento: presença, atenção, reação, preferências e memória.</summary>
    public static class Personas
    {
        public const int VersaoAtual = 1;
        private const ulong Sal = 0x504552534F4E41UL;   // "PERSONA"

        /// <summary>Peso de cada passo da sessão na chance de ser esquecido (× falta de disciplina × habilidade).</summary>
        public static readonly Dictionary<string, double> PesoEsquecer = new()
        {
            ["defender"] = 0.10, ["comercio"] = 0.20, ["construir"] = 0.16, ["exploradores"] = 0.30, ["recrutar"] = 0.22, ["curar"] = 0.22,
            ["prisioneiros"] = 0.12, ["explorar"] = 0.30, ["cacar"] = 0.30, ["coletar"] = 0.30, ["torres"] = 0.25, ["extrair"] = 0.25,
            ["ocupar"] = 0.25, ["espionar"] = 0.20, ["atacar"] = 0.15, ["social"] = 0.25,
        };
        /// <summary>Quem joga pouco esquece mais; quem joga muito, menos.</summary>
        public static readonly Dictionary<string, double> EsquecePorHabilidade = new() { ["fraco"] = 1.4, ["medio"] = 1.0, ["ativo"] = 0.5 };

        private static readonly Dictionary<string, double[]> BasePorPerfil = new()
        {
            //                        agr   pas   pac   gan   leal  ranc  soc   caut  org   cur
            ["expansionista"] = [0.50, 0.25, 0.50, 0.55, 0.50, 0.45, 0.55, 0.40, 0.65, 0.72],
            ["defensivo"]     = [0.25, 0.62, 0.70, 0.40, 0.70, 0.55, 0.45, 0.80, 0.50, 0.35],
            ["saqueador"]     = [0.80, 0.20, 0.30, 0.70, 0.35, 0.62, 0.40, 0.35, 0.70, 0.50],
            ["comerciante"]   = [0.20, 0.45, 0.65, 0.75, 0.55, 0.30, 0.80, 0.60, 0.45, 0.55],
        };
        private static readonly string[] Epitetos =
            ["o Calvo", "o Justo", "o Velho", "o Moço", "o Ruivo", "o Manso", "o Bravo", "o Quieto", "o Coxo", "o Alto", "o Sábio", "o Teimoso", "Mão de Ferro", "Barba Negra", "o Bom"];
        private static readonly string[] EpitetosF =
            ["a Justa", "a Velha", "a Moça", "a Ruiva", "a Brava", "a Quieta", "a Alta", "a Sábia", "a Teimosa", "Mão de Ferro", "a Serena", "a Boa", "Olhos de Corvo", "a Viúva", "a Andarilha"];
        private static readonly string[] Titulos = ["Rei", "Duque", "Conde", "Senhor", "Barão", "Marquês", "Capitão", "Mestre"];
        private static readonly string[] TitulosF = ["Rainha", "Duquesa", "Condessa", "Senhora", "Baronesa", "Marquesa", "Capitã", "Mestra"];
        private static readonly Dictionary<string, string[]> InspiracoesPorObjetivo = new()
        {
            ["riqueza"] = ["os mercadores das cidades livres", "as feiras de Champagne", "os banqueiros de Florença", "as caravanas do sal"],
            ["territorio"] = ["os reis que alargaram fronteiras", "os colonos da fronteira", "os romanos e suas estradas", "os navegadores"],
            ["reliquias"] = ["os caçadores de relíquias", "as lendas do Graal", "os monges copistas", "os peregrinos"],
            ["seguranca"] = ["os construtores de muralhas", "os castelos da reconquista", "os reis prudentes", "as cidades que nunca caíram"],
            ["gloria"] = ["Aníbal", "Alexandre", "o Cid", "Ricardo Coração de Leão", "as sagas do norte"],
            ["amizades"] = ["as ligas de cidades", "os cavaleiros da távola", "as irmandades de ofício", "os tratados antigos"],
            ["vinganca"] = ["as rixas de clãs", "as sagas de sangue", "o conde de Monte Cristo", "os que nunca esqueceram"],
        };
        private static readonly Dictionary<string, string[]> BordoesPorTom = new()
        {
            ["formal"] = ["por minha honra", "como convém", "saudações"],
            ["seco"] = ["simples assim", "sem conversa", "é isso"],
            ["brincalhão"] = ["haha", "kkk", "quem diria", "rapaz"],
            ["arcaico"] = ["pelos antigos", "que os ventos ajudem", "assim seja"],
            ["direto"] = ["bora", "fechado", "certo"],
            ["caloroso"] = ["meus amigos", "contem comigo", "abraço"],
        };

        /// <summary>
        /// A persona que não muda nada: traços em 0,5, nunca falta, nunca esquece, sem atraso. É a conduta pura de
        /// habilidade × perfil (os testes da conduta usam esta).
        /// </summary>
        public static Persona Neutra() => new()
        {
            Governante = "Governante", Titulo = "Senhor", Idade = 40, Arquetipo = "estrategista", Temperamento = "ponderado",
            Objetivos = ["seguranca"], Tom = "direto", Cronotipo = Cronotipos.Neutro,
        };

        private static double Tri(Rng s) => (s.Real() + s.Real()) / 2;   // triangular em [0, 1], centrada em 0,5
        private static double Lim(double x, double min = 0.03, double max = 0.97) => Math.Clamp(x, min, max);

        /// <summary>
        /// Uma persona inteira a partir de uma semente: a mesma semente dá sempre a mesma pessoa. O horário (cronotipo) não sai
        /// daqui: depende das outras IAs do mundo (cota) e é dado por <see cref="Cronotipos.Atribuir"/>; até lá, desvio 0.
        /// </summary>
        public static Persona Gerar(ulong semente, string? perfil, string? habilidade)
        {
            var s = new Rng(semente ^ Sal);
            var b = BasePorPerfil.GetValueOrDefault(perfil ?? "") ?? [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
            double T(int i) => Lim(b[i] + (Tri(s) - 0.5) * 0.6);
            var p = new Persona
            {
                Agressividade = T(0), Passividade = T(1), Paciencia = T(2), Ganancia = T(3), Lealdade = T(4),
                Rancor = T(5), Sociabilidade = T(6), Cautela = T(7), Orgulho = T(8), Curiosidade = T(9),
            };
            var (disc, assid, refl) = habilidade switch { "fraco" => (0.45, 0.78, 1.5), "ativo" => (0.88, 0.95, 0.7), _ => (0.68, 0.88, 1.0) };
            p.Disciplina = Lim(disc + (Tri(s) - 0.5) * 0.3, 0.15, 0.98);
            p.Assiduidade = Lim(assid + (Tri(s) - 0.5) * 0.14, 0.55, 0.99);
            p.Reflexo = Math.Clamp(refl + (Tri(s) - 0.5) * 0.6, 0.5, 2.0);
            // o horário era sorteado aqui (dois números); hoje sai por cota em Cronotipos.Atribuir. Os dois sorteios ficam,
            // para o resto da pessoa (nome, idade, tom...) continuar o mesmo para a mesma semente
            s.Real(); s.Real();
            p.FimDeSemana = Math.Round(0.7 + s.Real() * 0.7, 2);

            p.Feminina = s.Chance(0.5);
            p.Idade = 16 + (int)(Tri(s) * 56);
            var nomes = p.Feminina ? Pessoas.NomesDePessoa.Femininos : Pessoas.NomesDePessoa.Masculinos;
            p.Governante = s.Escolher(nomes) + (s.Chance(0.35) ? ", " + s.Escolher(p.Feminina ? EpitetosF : Epitetos) : "");
            var nt = p.Orgulho > 0.7 ? 0 : p.Orgulho > 0.5 ? s.Int(0, 4) : s.Int(2, Titulos.Length);
            p.Titulo = (p.Feminina ? TitulosF : Titulos)[nt];

            // objetivos: os três que mais combinam com os traços
            var pesos = new Dictionary<string, double>
            {
                ["riqueza"] = p.Ganancia, ["territorio"] = 1 - p.Passividade, ["reliquias"] = (p.Curiosidade + p.Orgulho) / 2,
                ["seguranca"] = p.Cautela, ["gloria"] = (p.Agressividade + p.Orgulho) / 2, ["amizades"] = (p.Sociabilidade + p.Lealdade) / 2,
                ["vinganca"] = p.Rancor * 0.8,
            };
            p.Objetivos = pesos.OrderByDescending(kv => kv.Value + s.Real() * 0.15).ThenBy(kv => kv.Key).Take(3).Select(kv => kv.Key).ToList();
            p.Inspiracoes = p.Objetivos.Take(2).Select(o => s.Escolher(InspiracoesPorObjetivo[o])).Distinct().ToList();

            var dom = new (string nome, double v)[]
            {
                ("conquistador", p.Agressividade), ("guardião", p.Cautela), ("mercador", p.Ganancia), ("desbravador", p.Curiosidade),
                ("diplomata", p.Sociabilidade), ("vingador", p.Rancor), ("soberano", p.Orgulho), ("eremita", p.Passividade),
                ("aliado fiel", p.Lealdade), ("estrategista", p.Paciencia),
            };
            p.Arquetipo = dom.OrderByDescending(x => x.v).First().nome;
            p.Temperamento = p.Agressividade > 0.65 && p.Paciencia < 0.4 ? "colérico"
                : p.Paciencia > 0.65 && p.Agressividade < 0.4 ? "sereno"
                : p.Cautela > 0.65 && p.Sociabilidade < 0.45 ? "desconfiado"
                : p.Sociabilidade > 0.65 ? "jovial"
                : p.Orgulho > 0.7 ? "altivo" : "ponderado";
            p.Tom = p.Orgulho > 0.72 ? "formal" : p.Sociabilidade > 0.72 ? "caloroso" : p.Agressividade > 0.7 ? "seco" : p.Idade > 58 ? "arcaico"
                : s.Escolher(new[] { "direto", "brincalhão", "direto", "caloroso", "seco", "formal" });
            p.Minusculas = p.Tom is not ("formal" or "arcaico") && s.Chance(p.Idade < 30 ? 0.45 : 0.2);
            p.Pressa = p.Tom is "formal" or "arcaico" ? s.Real() * 0.1 : Math.Round(s.Real() * 0.55, 2);
            var bs = BordoesPorTom[p.Tom];
            if (s.Chance(0.6)) p.Bordoes.Add(s.Escolher(bs));
            var quer = p.Objetivos[0] switch
            {
                "riqueza" => "quer encher os cofres antes do fim da temporada", "territorio" => "quer um reino que não caiba no mapa",
                "reliquias" => "sonha em juntar as relíquias antigas", "seguranca" => "quer atravessar a temporada sem perder o castelo",
                "gloria" => "quer o nome no alto do ranking", "amizades" => "prefere vencer cercado de aliados", _ => "tem contas a acertar",
            };
            p.Historia = "Herdou um reino pequeno, admira " + (p.Inspiracoes.Count > 0 ? p.Inspiracoes[0] : "os antigos") + " e " + quer + ".";
            return p;
        }

        /// <summary>
        /// Todo reino de IA tem persona: o que não tem (mundo de antes desta regra) ganha uma, sempre a mesma para o mesmo reino.
        /// A que ainda não tem horário (nascida agora, ou de um mundo de antes da decisão 0044) ganha a faixa pela cota.
        /// </summary>
        public static Persona? Garantir(Mundo m, Reino r)
        {
            if (!r.EhIA || r.PerfilIA == null) return null;
            if (r.Persona == null)
            {
                r.Persona = Gerar(Rng.Hash(m.Estado.Semente, (ulong)r.Id, (ulong)r.CriadoEm), r.PerfilIA, r.HabilidadeIA);
                m.Sujar(r);
            }
            Cronotipos.Atribuir(m, r);
            return r.Persona;
        }

        /// <summary>Sorte própria da persona, pelo reino e pelo instante: não mexe na sorte do mundo.</summary>
        public static Rng Sorte(Mundo m, Reino r, string sal) => new(Rng.Hash(m.Estado.Semente ^ Sal, (ulong)r.Id, (ulong)m.Agora ^ (ulong)sal.GetHashCode32()));

        /// <summary>Multiplicador de um traço: 0,5 dá 1; 0 dá 1 − amplitude; 1 dá 1 + amplitude.</summary>
        public static double Fator(double traco, double amplitude) => 1 + (traco - 0.5) * 2 * amplitude;

        // ---------------------------------------------------------------- presença e atenção

        /// <summary>
        /// Sábado ou domingo, na hora local da IA e no dia de quem joga: <paramref name="desvioH"/> (o cronotipo) desloca a
        /// virada do dia. A coruja que joga às 3 h de sábado ainda está na noite de sexta dela; às 3 h de segunda, no domingo.
        /// </summary>
        public static bool FimDeSemana(Mundo m, long t, double desvioH = 0)
        {
            var dias = (long)Math.Floor((t / (double)T.Hora + m.P.IA.FusoH - desvioH) / 24);
            var diaDaSemana = ((dias % 7) + 7 + 4) % 7;   // 1º de janeiro de 1970 foi quinta (4); 0 = domingo
            return diaDaSemana is 0 or 6;
        }

        /// <summary>
        /// A pessoa aparece nesta sessão? Gente falta: pela assiduidade, mais ou menos no fim de semana conforme o costume
        /// dela. Nunca três faltas seguidas.
        /// </summary>
        public static bool Aparece(Mundo m, Reino r)
        {
            var p = r.Persona;
            if (p == null || p.Assiduidade >= 1) return true;
            var chance = p.Assiduidade;
            if (FimDeSemana(m, m.Agora, p.DesvioHoras)) chance = 1 - (1 - chance) / Math.Max(0.2, p.FimDeSemana);
            var veio = p.Faltas >= 2 || Sorte(m, r, "sessao").Chance(Math.Clamp(chance, 0.05, 1));
            p.Faltas = veio ? 0 : p.Faltas + 1;
            m.Sujar(r);
            return veio;
        }

        /// <summary>Chance de esquecer um passo da sessão (0 para quem tem disciplina 1).</summary>
        public static double ChanceDeEsquecer(Reino r, string passo)
        {
            var p = r.Persona;
            if (p == null || p.Disciplina >= 1) return 0;
            var hab = EsquecePorHabilidade.GetValueOrDefault(r.HabilidadeIA ?? "", 1.0);
            return Math.Clamp((1 - p.Disciplina) * PesoEsquecer.GetValueOrDefault(passo, 0.2) * hab, 0, 0.6);
        }

        /// <summary>A pessoa lembrou deste passo nesta sessão? Erro de atenção: às vezes a fila fica vazia, o explorador fica parado.</summary>
        public static bool Lembra(Mundo m, Reino r, string passo)
        {
            var c = ChanceDeEsquecer(r, passo);
            return c <= 0 || !Sorte(m, r, "esquece:" + passo).Chance(c);
        }

        /// <summary>
        /// Tempo de reação humano (ms): quanto a pessoa demora entre ver e agir. Varia muito de uma vez para outra (às vezes
        /// 20 s, às vezes vários minutos) e de pessoa para pessoa (<see cref="Persona.Reflexo"/>). 0 para a persona neutra.
        /// </summary>
        public static long TempoDeReacao(Mundo m, Reino r, string sal, double baseSeg = 75)
        {
            var p = r.Persona;
            if (p == null || p.Reflexo <= 0) return 0;
            var s = Sorte(m, r, "reacao:" + sal);
            // log-normal: a mediana é a base × o reflexo; a cauda longa é o "reagiu tarde"
            var z = Math.Sqrt(-2 * Math.Log(Math.Max(1e-9, s.Real()))) * Math.Cos(2 * Math.PI * s.Real());
            var seg = baseSeg * p.Reflexo * Math.Exp(0.75 * z);
            return (long)(Math.Clamp(seg, 15, 30 * 60) * 1000);
        }

        /// <summary>Está acordada e por perto do jogo? Entre a primeira e a última sessão do dia dela, com folga de 1 h.</summary>
        public static bool Acordada(Mundo m, Reino r, Config.CondutaIAP c) =>
            Cronotipos.AcordadaNaHora(Sessoes.HoraLocal(m, m.Agora), r.Persona?.DesvioHoras ?? 0, c.Sessoes);

        // ---------------------------------------------------------------- memória: rancor e afinidade

        /// <summary>Envelhece a memória: rancor e afinidade caem pela metade a cada tantos dias (o rancoroso lembra por mais tempo).</summary>
        public static void Envelhecer(Mundo m, Reino r)
        {
            var p = r.Persona;
            if (p == null) return;
            var dias = p.MemoriaEm == 0 ? 0 : (m.Agora - p.MemoriaEm) / (double)T.Dia;
            p.MemoriaEm = m.Agora;
            if (dias <= 0) { m.Sujar(r); return; }
            var meiaRancor = 1.5 + 10 * p.Rancor;          // de 1,5 a 11,5 dias
            var meiaAfinidade = 3 + 8 * p.Lealdade;        // de 3 a 11 dias
            Decair(p.Rancores, Math.Pow(0.5, dias / meiaRancor));
            Decair(p.Afinidades, Math.Pow(0.5, dias / meiaAfinidade));
            m.Sujar(r);
        }
        private static void Decair(Dictionary<long, double> d, double f)
        {
            foreach (var k in d.Keys.ToList()) { d[k] *= f; if (d[k] < 0.03) d.Remove(k); }
        }

        /// <summary>Alguém fez mal a este reino (atacou, saqueou, capturou): o rancor por ele sobe.</summary>
        public static void Ofensa(Mundo m, Reino r, long deReinoId, double peso)
        {
            var p = r.Persona;
            if (p == null || deReinoId == 0 || deReinoId == r.Id) return;
            p.Rancores[deReinoId] = Math.Min(1, p.Rancores.GetValueOrDefault(deReinoId) + peso * Fator(p.Rancor, 0.5));
            p.Afinidades[deReinoId] = Math.Max(0, p.Afinidades.GetValueOrDefault(deReinoId) - peso);
            if (p.Afinidades[deReinoId] <= 0) p.Afinidades.Remove(deReinoId);
            m.Sujar(r);
        }

        /// <summary>Alguém fez bem a este reino (ajudou, trocou, reforçou, conversou): a afinidade por ele sobe.</summary>
        public static void Favor(Mundo m, Reino r, long deReinoId, double peso)
        {
            var p = r.Persona;
            if (p == null || deReinoId == 0 || deReinoId == r.Id) return;
            p.Afinidades[deReinoId] = Math.Min(1, p.Afinidades.GetValueOrDefault(deReinoId) + peso * Fator(p.Lealdade, 0.4));
            m.Sujar(r);
        }

        public static double RancorDe(Reino r, long reinoId) => r.Persona?.Rancores.GetValueOrDefault(reinoId) ?? 0;
        public static double AfinidadeDe(Reino r, long reinoId) => r.Persona?.Afinidades.GetValueOrDefault(reinoId) ?? 0;

        /// <summary>O reino de quem esta persona mais guarda rancor, se passa do que ela aguenta calada (o paciente aguenta mais).</summary>
        public static long? Desafeto(Reino r)
        {
            var p = r.Persona;
            if (p == null || p.Rancores.Count == 0) return null;
            var (id, v) = p.Rancores.OrderByDescending(kv => kv.Value).ThenBy(kv => kv.Key).Select(kv => (kv.Key, kv.Value)).First();
            var limite = 0.35 + 0.4 * p.Paciencia - 0.25 * (p.Rancor - 0.5);
            return v >= limite ? id : null;
        }
    }

    internal static class TextoHash
    {
        /// <summary>Hash estável de um texto (o GetHashCode de string muda a cada execução).</summary>
        public static uint GetHashCode32(this string s)
        {
            unchecked
            {
                uint h = 2166136261;
                foreach (var ch in s) { h ^= ch; h *= 16777619; }
                return h;
            }
        }
    }
}

namespace ReinoDePedra.Jogo.Reinos
{
    public sealed partial class Reino
    {
        /// <summary>Persona de quem governa o reino de IA. Só do servidor: nunca vai ao cliente nem ao feed (ver <see cref="IA.Persona"/>).</summary>
        public IA.Persona? Persona { get; set; }
    }
}
