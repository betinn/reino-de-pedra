using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Mapa;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Exploracao
{
    /// <summary>
    /// Região de fauna hostil: um bando (lobos, javalis, ursos ou crocodilos) com território de raio 1 ou 2.
    /// O perigo vale para todos os hexágonos da região; o bando em si anda dentro dela (evento a cada poucas horas).
    /// Abatido (caça), some e volta em <c>P.faunaVoltaH</c> (evento por bando).
    /// </summary>
    public sealed partial class RegiaoFauna : Documento
    {
        public int Centro { get; set; }
        public int Raio { get; set; } = 1;
        /// <summary>"lobos", "javalis", "ursos" ou "crocodilos".</summary>
        public string Animal { get; set; } = "";
        /// <summary>Nível base: "baixo", "medio" ou "alto".</summary>
        public string Nivel { get; set; } = "baixo";
        /// <summary>Tamanho do bando (contador no mapa).</summary>
        public int Qtd { get; set; }
        /// <summary>Hexágono onde o bando está agora.</summary>
        public int Hex { get; set; }
        public bool Abatido { get; set; }
        public long VoltaEm { get; set; }
        /// <summary>Próximo movimento (ou a volta, se abatido).</summary>
        public long? EventoId { get; set; }
    }

    [Sistema]
    public static class Fauna
    {
        public static readonly string[] Niveis = ["baixo", "medio", "alto"];
        public static readonly string[] Animais = ["lobos", "javalis", "ursos", "crocodilos"];
        public static readonly Dictionary<string, string> NomeAnimal = new()
        {
            ["lobos"] = "Lobos", ["javalis"] = "Javalis", ["ursos"] = "Ursos", ["crocodilos"] = "Crocodilos",
        };
        public static readonly Dictionary<string, string> NomeNivel = new() { ["baixo"] = "baixo", ["medio"] = "médio", ["alto"] = "alto" };

        /// <summary>1 = baixo, 2 = médio, 3 = alto; 0 = sem perigo.</summary>
        public static int Indice(string nivel) => Array.IndexOf(Niveis, nivel) + 1;
        public static string? NomeDe(int nivel) => nivel is >= 1 and <= 3 ? Niveis[nivel - 1] : null;

        public static void AoIniciar(Mundo m)
        {
            Sistemas.UmaVez("fauna", () =>
            {
                Mundo.AoCriarMundo += (mm, semente) => { if (!mm.Faunas.Any()) Gerar(mm, semente); };
                Mundo.AoReconstruirIndices += Reindexar;
                Marcha.AoPartir.Add(AoPartir);
                Caminhos.CustosExtras.Add(CustoSeguro);
            });
            if (m.Mapa == null) return;
            if (!m.Faunas.Any()) Gerar(m, m.Estado.Semente);
            Reindexar(m);
        }

        // ---------------------------------------------------------------- índice

        public static void Reindexar(Mundo m)
        {
            if (m.Mapa == null) return;
            m.RegioesPorHex.Clear();
            foreach (var rg in m.Faunas) Indexar(m, rg);
            var g = m.G;
            m.PertoDeReino = new bool[g.Total];
            foreach (var v in m.Mapa.Vagas)
                foreach (var h in g.Area(v.Castelo, m.P.FaunaServ.PertoReino)) m.PertoDeReino[h] = true;
        }

        private static void Indexar(Mundo m, RegiaoFauna rg)
        {
            foreach (var h in m.G.Area(rg.Centro, rg.Raio))
            {
                if (!m.RegioesPorHex.TryGetValue(h, out var l)) m.RegioesPorHex[h] = l = new();
                if (!l.Contains(rg.Id)) l.Add(rg.Id);
            }
        }

        public static IEnumerable<RegiaoFauna> RegioesEm(Mundo m, int h) =>
            m.RegioesPorHex.TryGetValue(h, out var l) ? l.Select(id => m.Faunas.Obter(id)).OfType<RegiaoFauna>() : [];

        public static IEnumerable<int> Hexes(Mundo m, RegiaoFauna rg) => m.G.Area(rg.Centro, rg.Raio);

        /// <summary>
        /// Nível efetivo da região no hexágono (0 a 3): abatida não tem perigo; rota construída reduz um nível;
        /// perto de um castelo inicial (vaga), no máximo baixo.
        /// </summary>
        public static int NivelEm(Mundo m, RegiaoFauna rg, int h)
        {
            if (rg.Abatido) return 0;
            var n = Indice(rg.Nivel);
            if (m.Vias.Rotas.Contains(h)) n--;
            if (m.PertoDeReino.Length > h && m.PertoDeReino[h]) n = Math.Min(n, 1);
            return Math.Max(0, n);
        }

        /// <summary>Perigo real no hexágono: o maior nível entre as regiões que o cobrem, e o animal dela.</summary>
        public static (int nivel, RegiaoFauna? regiao) PerigoEm(Mundo m, int h)
        {
            var melhor = 0; RegiaoFauna? qual = null;
            foreach (var rg in RegioesEm(m, h))
            {
                var n = NivelEm(m, rg, h);
                if (n > melhor) { melhor = n; qual = rg; }
            }
            return (melhor, qual);
        }

        // ---------------------------------------------------------------- geração

        /// <summary>Gera as regiões de fauna do mundo (na criação, ou ao subir um mundo que ainda não tem fauna).</summary>
        public static void Gerar(Mundo m, ulong semente)
        {
            var g = m.G; var p = m.P.FaunaServ;
            var rng = new Rng(semente ^ 0x4641_554EUL);
            var castelos = m.Mapa.Vagas.Select(v => v.Castelo).ToList();
            var iniciais = m.Mapa.Vagas.SelectMany(v => new[] { v.Castelo, v.Comida, v.Madeira, v.Pedra, v.Ferro }).ToHashSet();
            var cand = Enumerable.Range(0, g.Total)
                .Where(h => m.Mapa.Rio[h] || m.Mapa.Terrenos[h] != Terreno.Planicie)
                .Where(h => !iniciais.Contains(h) && castelos.All(c => g.Distancia(c, h) > p.LongeCastelo))
                .ToList();
            rng.Embaralhar(cand);
            var alvo = p.RegioesPorReino * m.P.Reinos;
            var centros = new List<int>();
            foreach (var h in cand)
            {
                if (centros.Count >= alvo) break;
                if (centros.Any(c => g.Distancia(c, h) < p.DistanciaMin)) continue;
                centros.Add(h);
                var animal = m.Mapa.Rio[h] || m.Mapa.Terrenos[h] == Terreno.Pantano ? "crocodilos"
                    : m.Mapa.Terrenos[h] == Terreno.Floresta ? (rng.Chance(0.5) ? "lobos" : "javalis")
                    : "ursos";
                var n = Indice(m.P.Caca[animal].Nivel);
                var r = rng.Real();
                if (r < p.Variacao) n--; else if (r > 1 - p.Variacao) n++;
                n = Math.Clamp(n, 1, 3);
                if (castelos.Any(c => g.Distancia(c, h) <= p.PertoReino)) n = 1;   // fraca perto dos reinos iniciais
                var faixa = p.Bando.TryGetValue(animal, out var b) ? b : [2, 4];
                Adicionar(m, new RegiaoFauna
                {
                    Centro = h, Hex = h, Animal = animal, Nivel = Niveis[n - 1],
                    Raio = rng.Int(p.Raio[0], p.Raio[^1] + 1), Qtd = rng.Int(faixa[0], faixa[^1] + 1),
                });
            }
        }

        /// <summary>Acrescenta uma região (índice e movimento do bando).</summary>
        public static RegiaoFauna Adicionar(Mundo m, RegiaoFauna rg)
        {
            m.Faunas.Adicionar(rg);
            Indexar(m, rg);
            AgendarMovimento(m, rg);
            return rg;
        }

        /// <summary>Tira toda a fauna do mundo (testes que não querem sorteios de fauna).</summary>
        public static void Limpar(Mundo m)
        {
            foreach (var rg in m.Faunas.ToList()) { m.Cancelar(rg.EventoId); m.Faunas.Remover(rg); }
            m.RegioesPorHex.Clear();
        }

        // ---------------------------------------------------------------- movimento, abate e volta

        private static void AgendarMovimento(Mundo m, RegiaoFauna rg)
        {
            var f = m.P.FaunaServ.MoverH;
            var horas = f[0] + m.Sorte.Real() * (f[^1] - f[0]);
            rg.EventoId = m.Agendar(new MoverFaunaEvento { RegiaoId = rg.Id, Quando = m.Agora + T.DeHoras(horas) }).Id;
            m.Sujar(rg);
        }

        /// <summary>O bando muda de hexágono dentro da região (evita rotas e locais).</summary>
        public static void Mover(Mundo m, RegiaoFauna rg)
        {
            var opcoes = Hexes(m, rg).Where(h => !m.Vias.Rotas.Contains(h) && m.LocalNoHex(h) == null).ToList();
            if (opcoes.Count > 0) rg.Hex = opcoes[m.Sorte.Int(0, opcoes.Count)];
            AgendarMovimento(m, rg);
        }

        /// <summary>Bando abatido: some e volta em <c>P.faunaVoltaH</c>.</summary>
        public static void Abater(Mundo m, RegiaoFauna rg)
        {
            m.Cancelar(rg.EventoId);
            rg.Abatido = true;
            rg.VoltaEm = m.Agora + T.DeHoras(m.P.FaunaVoltaH);
            rg.EventoId = m.Agendar(new VoltaFaunaEvento { RegiaoId = rg.Id, Quando = rg.VoltaEm }).Id;
            m.Sujar(rg);
        }

        public static void Voltar(Mundo m, RegiaoFauna rg)
        {
            rg.Abatido = false; rg.VoltaEm = 0;
            var opcoes = Hexes(m, rg).Where(h => m.LocalNoHex(h) == null).ToList();
            rg.Hex = opcoes.Count > 0 ? opcoes[m.Sorte.Int(0, opcoes.Count)] : rg.Centro;
            AgendarMovimento(m, rg);
        }

        // ---------------------------------------------------------------- ataques às marchas

        /// <summary>Região que uma ordem de caça mira (essa não ataca no caminho: a caçada é a luta).</summary>
        public static long? RegiaoDaCaca(Marcha mc) =>
            mc is Exercito ex && ex.Ordem == OrdemCacar.Id && ex.Dados["regiao"] is JsonValue v && v.TryGetValue<long>(out var id) ? id : null;

        /// <summary>
        /// A cada partida: para cada região atravessada, sorteia o ataque com a chance do risco efetivo
        /// (<c>P.ataqueFauna</c>) e agenda-o no instante da travessia. Eventos do caminho antigo são cancelados.
        /// </summary>
        public static void AoPartir(Mundo m, Marcha mc)
        {
            foreach (var id in mc.EventosCaminho) m.Cancelar(id);
            mc.EventosCaminho.Clear();
            mc.TrocarCaminhoVisto(m, m.Agora);
            mc.AgendarRevelacao(m);   // toda marcha revela a névoa por onde passa (exércitos, exploradores, carregadores, caravanas)
            if (mc.ReinoId != 0 && mc.AlvoDeFauna && mc.Caminho.Count > 1) SortearAtaques(m, mc);
            Exploradores.SortearCaptura(m, mc);
            m.Sujar(mc);
        }

        private static void SortearAtaques(Mundo m, Marcha mc)
        {
            var forca = mc.ForcaContraFauna(m);
            var excluir = RegiaoDaCaca(mc);
            var primeiro = new Dictionary<long, int>();
            var nivel = new Dictionary<long, int>();
            var ordem = new List<long>();
            for (var i = 1; i < mc.Caminho.Count; i++)
            {
                var h = mc.Caminho[i];
                foreach (var rg in RegioesEm(m, h))
                {
                    if (rg.Id == excluir) continue;
                    var n = NivelEm(m, rg, h);
                    if (n == 0) continue;
                    if (!primeiro.ContainsKey(rg.Id)) { primeiro[rg.Id] = i; ordem.Add(rg.Id); nivel[rg.Id] = n; }
                    else nivel[rg.Id] = Math.Max(nivel[rg.Id], n);
                }
            }
            foreach (var id in ordem)
            {
                var nome = NomeDe(nivel[id])!;
                var risco = m.F.RiscoFauna(nome, forca);
                if (risco == "nenhum") continue;
                if (!m.Sorte.Chance(m.P.AtaqueFauna[risco])) continue;
                var i = primeiro[id];
                mc.EventosCaminho.Add(m.Agendar(new AtaqueFaunaEvento
                {
                    MarchaId = mc.Id, RegiaoId = id, Hex = mc.Caminho[i], Nivel = nivel[id], Partida = mc.Partida,
                    Quando = Math.Min(mc.Tempos[i], mc.Chegada - 1),
                }).Id);
            }
        }

        /// <summary>
        /// Ataque de fauna a uma marcha, como dano (<see cref="Marcha.SofrerGolpes"/>): cada animal ataca uma pessoa do grupo e
        /// tira vida pelo risco efetivo; morre só quem chega a zero. A carga perde 5% (força acima do limite) ou 25% (abaixo).
        /// O explorador sozinho e rápido (P.vida.fuga) foge sem dano. Morto o explorador, a escolta que sobra volta para casa.
        /// </summary>
        public static void Atacar(Mundo m, Marcha mc, RegiaoFauna rg, int hex, int nivel)
        {
            var nome = NomeDe(nivel)!;
            var forca = mc.ForcaContraFauna(m);
            var limite = m.P.Fauna[nome];
            if (forca >= 2 * limite) return;
            var risco = m.F.RiscoFauna(nome, forca);
            if (risco == "nenhum") return;
            var perdaCarga = forca >= limite ? m.P.PerdaFauna.Acima : m.P.PerdaFauna.Abaixo;
            mc.RevelarPercorrido(m, m.Agora);
            var r = m.Reinos.Obter(mc.ReinoId);
            var exp = mc as Explorador;
            var quem = exp != null && m.Pessoas.Obter(exp.PessoaId) is { } px ? px.Nome : null;
            var fem = exp != null && m.Pessoas.Obter(exp.PessoaId) is { Feminina: true };
            var animal = NomeAnimal.GetValueOrDefault(rg.Animal, rg.Animal).ToLowerInvariant();
            var linhas = new JsonArray
            {
                Linha("Onde", "hexágono " + m.G.C(hex) + ", " + m.G.L(hex)),
                Linha("Perigo", NomeNivel[nome] + " · " + animal),
            };
            if (exp != null && GT.Total(exp.Tropas) == 0 && m.P.Vida.Fuga.TryGetValue(exp.TipoExp, out var fuga) && m.Sorte.Chance(fuga))
            {
                if (r != null)
                    Registros.Relatar(m, r.Id, "fauna", exp.NomeTipo(m) + (quem != null ? " " + quem : "") + " fugiu de " + animal, new JsonObject
                    {
                        ["resumo"] = "Rápido, escapou do bando sem se ferir e segue a ordem.", ["linhas"] = linhas, ["hex"] = hex,
                    }, "exploracao");
                return;
            }
            var a = mc.SofrerGolpes(m, risco, Math.Max(1, rg.Qtd), perdaCarga);
            var morreuExplorador = exp != null && a.MortosIds.Contains(exp.PessoaId);
            string titulo, resumo;
            if (exp != null && morreuExplorador)
            {
                titulo = exp.NomeTipo(m) + (quem != null ? " " + quem : "") + (fem ? " morta por " : " morto por ") + animal;
                resumo = "Os animais tiraram toda a vida do explorador." + (a.Acabou ? "" : " A escolta que sobrou volta para casa.") + " Prefira a rota segura ou leve escolta.";
            }
            else if (exp != null && GT.Total(exp.Tropas) == 0)
            {
                titulo = exp.NomeTipo(m) + (quem != null ? " " + quem : "") + (fem ? " ferida por " : " ferido por ") + animal;
                resumo = "Sobreviveu ao ataque e segue a ordem, ferido. A vida volta com o tempo; outro ataque antes disso pode matar.";
            }
            else
            {
                titulo = "Ataque de " + animal;
                var partes = new List<string>();
                if (a.Feridos.Count > 0) partes.Add(a.Feridos.Count + (a.Feridos.Count == 1 ? " ferido" : " feridos"));
                if (a.Mortos.Count > 0) partes.Add(a.Mortos.Count + (a.Mortos.Count == 1 ? " morto" : " mortos"));
                var cg = a.Carga.Arredondado();
                if (cg.Count > 0) partes.Add("perdeu " + string.Join(", ", cg.Select(kv => kv.Value + " " + Logistica.NomeRecurso(kv.Key))));
                resumo = (mc is Carregadores ? "Os carregadores fugiram" : "O grupo foi atacado") + (partes.Count > 0 ? ": " + string.Join(", ", partes) : "") + ".";
                if (a.Acabou) resumo += " Ninguém sobrou.";
                else if (a.Feridos.Count > 0) resumo += " Os feridos seguem andando; a vida volta com o tempo.";
            }
            if (a.Mortos.Count > 0) linhas.Add(Linha("Mortos", (a.MortosPorUnidade.Count > 0 ? Reinos.Tropas.Partes(m, a.MortosPorUnidade) + ": " : "") + Pessoas.Pessoas.Nomear(a.Mortos)));
            if (a.Feridos.Count > 0) linhas.Add(Linha("Feridos", string.Join(", ", a.Feridos)));
            if (mc is Carregadores c && r != null && c.ItemId is long item && a.Carga.Count > 0)
                Logistica.Repor(m, r, c.Fila, item, a.Carga);
            if (a.Acabou) mc.Encerrar(m);
            else if (exp != null && morreuExplorador) Exploradores.IrParaCasa(m, exp);
            if (r != null)
                Registros.Relatar(m, r.Id, "fauna", titulo, new JsonObject { ["resumo"] = resumo, ["linhas"] = linhas, ["hex"] = hex }, "exploracao");
            m.Avisar(mc.ReinoId, "reino");
            m.Avisar(mc.ReinoId, "mapa");
        }

        internal static JsonObject Linha(string rotulo, string valor) => new() { ["rotulo"] = rotulo, ["valor"] = valor };

        /// <summary>Divide <paramref name="n"/> baixas entre as unidades do grupo, na proporção (maiores restos).</summary>
        public static Dictionary<string, int> Distribuir(IReadOnlyDictionary<string, int> grupo, int n)
        {
            var total = grupo.Values.Where(v => v > 0).Sum();
            var r = new Dictionary<string, int>();
            if (total == 0 || n <= 0) return r;
            n = Math.Min(n, total);
            var restos = new List<(string k, double resto)>();
            var usados = 0;
            foreach (var (k, v) in grupo.Where(kv => kv.Value > 0).OrderBy(kv => kv.Key))
            {
                var exato = v * (double)n / total;
                var q = (int)Math.Floor(exato);
                if (q > 0) r[k] = q;
                usados += q;
                restos.Add((k, exato - q));
            }
            foreach (var (k, _) in restos.OrderByDescending(x => x.resto).ThenBy(x => x.k))
            {
                if (usados >= n) break;
                if (r.GetValueOrDefault(k) >= grupo[k]) continue;
                r[k] = r.GetValueOrDefault(k) + 1; usados++;
            }
            return r;
        }

        // ---------------------------------------------------------------- rota segura

        /// <summary>Peso extra na rota segura: hexágonos com fauna (a conhecida pelo reino) que seria risco para o grupo.</summary>
        public static double CustoSeguro(Mundo m, int h, OpcoesCaminho op)
        {
            var nivel = op.ReinoId != 0 ? Fotos.PerigoConhecido(m, op.ReinoId, h) : PerigoEm(m, h).nivel;
            if (nivel == 0) return 0;
            var risco = m.F.RiscoFauna(NomeDe(nivel)!, op.Forca);
            return risco == "nenhum" ? 0 : m.P.FaunaServ.CustoSeguro.GetValueOrDefault(risco);
        }
    }

    public sealed class MoverFaunaEvento : Evento
    {
        public long RegiaoId { get; set; }
        public override void Executar(Mundo m)
        {
            if (m.Faunas.Obter(RegiaoId) is not { } rg || rg.Abatido) return;
            rg.EventoId = null;
            Fauna.Mover(m, rg);
        }
    }

    public sealed class VoltaFaunaEvento : Evento
    {
        public long RegiaoId { get; set; }
        public override void Executar(Mundo m)
        {
            if (m.Faunas.Obter(RegiaoId) is not { } rg) return;
            rg.EventoId = null;
            Fauna.Voltar(m, rg);
        }
    }

    /// <summary>Ataque de fauna agendado no instante em que a marcha entra na região.</summary>
    public sealed class AtaqueFaunaEvento : Evento
    {
        public long MarchaId { get; set; }
        public long RegiaoId { get; set; }
        public int Hex { get; set; }
        public int Nivel { get; set; }
        public long Partida { get; set; }
        public override void Executar(Mundo m)
        {
            if (m.Marchas.Obter(MarchaId) is not { } mc || mc.Partida != Partida) return;
            if (m.Faunas.Obter(RegiaoId) is not { } rg || rg.Abatido) return;
            mc.EventosCaminho.Remove(Id);
            Fauna.Atacar(m, mc, rg, Hex, Nivel);
        }
    }
}

namespace ReinoDePedra.Jogo
{
    using ReinoDePedra.Jogo.Exploracao;
    public sealed partial class Mundo
    {
        public Colecao<RegiaoFauna> Faunas { get; } = new("fauna");
        /// <summary>Regiões de fauna que cobrem cada hexágono (índice, refeito na subida).</summary>
        internal Dictionary<int, List<long>> RegioesPorHex { get; } = new();
        /// <summary>Hexágonos perto de um castelo inicial (fauna sempre fraca).</summary>
        internal bool[] PertoDeReino { get; set; } = [];
    }
}
