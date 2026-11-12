using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Combate
{
    /// <summary>O que aconteceu na última queda do castelo do reino (para a tela de exílio e o relatório).</summary>
    public sealed class RegistroQueda
    {
        public long Quando { get; set; }
        public bool Exilio { get; set; }
        public string CasteloAntigo { get; set; } = "";
        public int NivelAntigo { get; set; }
        public int HexAntigo { get; set; }
        public long NovoCasteloId { get; set; }
        public string NovoCastelo { get; set; } = "";
        public int NivelNovo { get; set; }
        public int HexNovo { get; set; }
        /// <summary>Reino que derrubou o castelo.</summary>
        public long AtacanteVisivel { get; set; }
        public string Atacante { get; set; } = "";
        public Dictionary<string, double> RecursosPerdidos { get; set; } = new();
        public double PopulacaoPerdida { get; set; }
        /// <summary>Nomes dos civis perdidos na queda.</summary>
        public List<string> CivisMortos { get; set; } = new();
        public List<string> ReliquiasLevadas { get; set; } = new();
        public List<string> ReliquiasMantidas { get; set; } = new();
        public Dictionary<string, double> Kit { get; set; } = new();
        public Dictionary<string, int> KitTropas { get; set; } = new();
        public long EscudoAte { get; set; }
        public long? RelatorioId { get; set; }
        /// <summary>O jogador já viu a tela de exílio.</summary>
        public bool Vista { get; set; }
    }

    /// <summary>
    /// Queda do castelo (cerco vitorioso, gancho <see cref="Combates.AoCairCastelo"/>). Com outros locais: o castelo vira
    /// ruína sem dono, a sede vai para o local de maior nível, que vira castelo com P.queda.nivel do nível antigo; o reino perde
    /// P.queda.recursos dos recursos guardados, P.queda.populacao da população civil e as relíquias do castelo (vão com o
    /// atacante). Sem outros locais: exílio num ponto longe de quem derrubou, com o kit de P.guerra.exilio e escudo de
    /// P.escudoExilioH. O reino nunca é extinto.
    /// </summary>
    public static class Quedas
    {
        /// <summary>
        /// Escolha do ponto do exílio (linhagem nível 7 escolhe a região): (mundo, reino caído, quem derrubou) → hexágono do
        /// novo castelo, ou null para o sorteio padrão (aleatório, longe de quem derrubou).
        /// </summary>
        public static List<Func<Mundo, Reino, Reino?, int?>> EscolherExilio { get; } = new();

        /// <summary>Depois de cada queda (ranking, legado, IA): (mundo, reino que caiu, quem derrubou, registro).</summary>
        public static event Action<Mundo, Reino, Reino?, RegistroQueda>? AoCair;

        internal static void Registrar() => Combates.AoCairCastelo.Add(CairCastelo);

        public static void CairCastelo(Mundo m, Reino r, Exercito vencedor, Local castelo)
        {
            if (castelo.ReinoId != r.Id || castelo.Tipo != TipoLocal.Castelo || castelo.Ruina) return;
            Economia.Atualizar(m, r);
            var atk = m.Reinos.Obter(vencedor.ReinoId);
            var agora = m.Agora;
            var q = new RegistroQueda
            {
                Quando = agora, CasteloAntigo = castelo.Nome, NivelAntigo = castelo.Nivel, HexAntigo = castelo.Hex,
                AtacanteVisivel = atk?.Id ?? 0,
                Atacante = RelatoriosCombate.NomeAtacante(m, vencedor.ReinoId),
            };
            // relíquias do castelo vão com o atacante (as que o plano não levou)
            foreach (var rel in Reliquias.NoLocal(m, castelo.Id).ToList())
            {
                Reliquias.Carregar(m, rel, vencedor);
                q.ReliquiasLevadas.Add(rel.Nome);
            }
            // perdas: recursos guardados e população civil
            var fr = m.P.Queda.Recursos;
            foreach (var l in m.LocaisDe(r.Id).ToList())
            {
                foreach (var (k, v) in l.Estoque.ToList())
                {
                    var perde = v * fr;
                    l.Estoque.Somar(k, -perde);
                    q.RecursosPerdidos[k] = q.RecursosPerdidos.GetValueOrDefault(k) + perde;
                }
                m.Sujar(l);
            }
            var popPerdida = Math.Floor(r.Pop * m.P.Queda.Populacao + 1e-9);
            q.CivisMortos = Pessoas.Pessoas.Matar(m, Pessoas.Pessoas.Civis(m, r.Id), (int)popPerdida);
            q.PopulacaoPerdida = q.CivisMortos.Count;
            var restoCastelo = castelo.Estoque.Copia();
            var outros = m.LocaisDe(r.Id).Where(l => !l.Ruina && l.Id != castelo.Id).ToList();
            Arruinar(m, castelo);

            Local novo;
            if (outros.Count > 0)
            {
                novo = outros.OrderByDescending(l => l.Nivel).ThenBy(l => l.Id).First();
                var nivel = Math.Max(1, (int)Math.Floor(q.NivelAntigo * m.P.Queda.Nivel + 1e-9));
                novo.Tipo = TipoLocal.Castelo; novo.Produz = null; novo.Nivel = nivel; m.Reindexar(novo);
                novo.Nome = "Castelo de " + r.Nome;
                novo.Estoque.Somar(restoCastelo);
                m.Sujar(novo);
                r.CasteloId = novo.Id;
                ArrumarFilas(m, r, castelo, novo, false);
                Pessoas.Pessoas.LocalMudou(m, castelo);   // quem morava no castelo caído vai para o novo
                Pessoas.Vidas.ReavaliarLocal(m, novo);
                q.NivelNovo = nivel;
            }
            else
            {
                // exílio: tudo perdido (o resto do castelo também); recomeça longe de quem derrubou
                foreach (var (k, v) in restoCastelo) q.RecursosPerdidos[k] = q.RecursosPerdidos.GetValueOrDefault(k) + v;
                novo = Exilar(m, r, atk, castelo);
                ArrumarFilas(m, r, castelo, novo, true, q);
                Pessoas.Pessoas.Exilar(m, r, novo, (int)m.P.Guerra.Exilio.Pop);   // só a população de recomeço segue o reino
                q.Exilio = true; q.NivelNovo = novo.Nivel;
                q.Kit = new(m.P.Guerra.Exilio.Kit); q.KitTropas = new(m.P.Guerra.Exilio.Tropas);
                q.EscudoAte = r.EscudoAte;
                q.ReliquiasMantidas = Reliquias.DoReino(m, r.Id).Select(x => x.Nome).ToList();
            }
            q.NovoCasteloId = novo.Id; q.NovoCastelo = novo.Nome; q.HexNovo = novo.Hex;
            Nevoas.RevelarArea(m, r.Id, novo.Hex, Nevoas.RaioLocal(m, novo));
            Economia.GarantirCheckpoint(m, r);
            r.UltimaQueda = q;
            m.Sujar(r);
            Relatar(m, r, q);
            if (atk != null)
                Registros.Notificar(m, atk.Id, "batalhas", "Castelo derrubado",
                    (q.Exilio ? "O reino perdeu o último local e recomeça em exílio, longe daqui." : "A sede do reino mudou para outro local.") +
                    (q.ReliquiasLevadas.Count > 0 ? " Relíquias levadas: " + string.Join(", ", q.ReliquiasLevadas) + "." : ""), "tropas");
            AoCair?.Invoke(m, r, atk, q);
            m.Avisar(r.Id, "reino"); m.Avisar(r.Id, "mapa");
            if (atk != null) { m.Avisar(atk.Id, "reino"); m.Avisar(atk.Id, "mapa"); }
        }

        /// <summary>O castelo vira ruína sem dono: sem nível de castelo, sem portões nem moradias; pode ser ocupado ou reconstruído.</summary>
        private static void Arruinar(Mundo m, Local c)
        {
            c.Ruina = true; c.Nivel = 1; c.Tipo = TipoLocal.Vila; c.Produz = "comida"; c.Nome = "Ruínas de castelo"; m.Reindexar(c);
            c.Portoes = 0; c.EstruturaPortoes = 0; c.Moradias = 0; c.Estoque = new();
            Pessoas.Pessoas.LimparGuarnicao(m, c);
            m.MudarDono(c, 0);
        }

        /// <summary>
        /// Filas depois da queda: o que era no castelo antigo (e as melhorias acima do novo castelo) é cancelado, com o material
        /// indo para o castelo novo; a cura dos feridos muda para o castelo novo. No exílio, tudo é cancelado sem devolver o
        /// material (estava no reino perdido: entra nos recursos perdidos) e os carregadores somem.
        /// </summary>
        private static void ArrumarFilas(Mundo m, Reino r, Local antigo, Local novo, bool exilio, RegistroQueda? q = null)
        {
            foreach (var (nome, fila) in r.Filas.ToList())
                foreach (var it in fila.Itens.ToList())
                {
                    if (it.Tipo == ItemCurar.Id) { it.LocalId = novo.Id; it.Hex = novo.Hex; continue; }
                    var cancelar = exilio || it.LocalId == antigo.Id || it.LocalId == novo.Id && it.Tipo == ObraNivel.Id
                        || it.Tipo == ObraNivel.Id && it.NivelAlvo > novo.Nivel;
                    if (!cancelar) continue;
                    if (it.LocalId == antigo.Id || it.LocalId == null || exilio) { it.LocalId = novo.Id; it.Hex = novo.Hex; }
                    if (exilio)
                    {
                        if (q != null) foreach (var (k, v) in it.Entregue) q.RecursosPerdidos[k] = q.RecursosPerdidos.GetValueOrDefault(k) + v;
                        it.Entregue = new();
                    }
                    Filas.Cancelar(m, r, nome, it.Id);
                }
            if (exilio)
                foreach (var c in m.Marchas.OfType<Carregadores>().Where(c => c.ReinoId == r.Id).ToList()) c.Encerrar(m);
            m.Sujar(r);
        }

        // ---------------------------------------------------------------- exílio

        private static Local Exilar(Mundo m, Reino r, Reino? atk, Local antigo)
        {
            var e = m.P.Guerra.Exilio;
            int hex = -1, vaga = -1;
            foreach (var f in EscolherExilio) { var h = f(m, r, atk); if (h is int x && PontoLivre(m, x)) { hex = x; break; } }
            if (hex < 0) (hex, vaga) = Sortear(m, r, atk, antigo.Hex);
            else vaga = m.Mapa.Vagas.FirstOrDefault(v => v.Castelo == hex)?.Indice ?? -1;
            if (m.LocalNoHex(hex) is { } velho) m.RemoverLocal(velho);   // ruína de quem ocupou este ponto antes
            var c = m.AdicionarLocal(new Local
            {
                ReinoId = r.Id, Tipo = TipoLocal.Castelo, Hex = hex, Nivel = 1, Nome = "Castelo de " + r.Nome,
                Estoque = Recursos.De(e.Kit),
            });
            r.CasteloId = c.Id;
            Pessoas.Pessoas.CriarSoldados(m, r, c, e.Tropas);   // o kit de recomeço: soldados novos, com nome
            r.Vaga = vaga;
            // carroças, exploradores e mensageiros parados ficavam no castelo caído: o exílio recomeça só com o kit
            r.Veiculos.Clear(); r.ExploradoresLivres.Clear(); r.MensageirosLivres = 0;
            r.Fundados = 0;
            r.EscudoAte = Math.Max(r.EscudoAte, m.Agora + T.DeHoras(m.P.EscudoExilioH));
            m.Sujar(r);
            return c;
        }

        /// <summary>Hexágono serve para um castelo de exílio (livre, ou só uma ruína sem dono, sem relíquia nem lendário; fora do rio).</summary>
        public static bool PontoLivre(Mundo m, int h)
        {
            if (!m.G.Valido(h) || m.Mapa.Rio[h]) return false;
            var l = m.LocalNoHex(h);
            if (l != null) return CriacaoReino.LocalSubstituivel(m, l) && !m.Ruinas.Any(x => x.Hex == h) && !m.Jazidas.Any(j => j.Hex == h) && !Obras.HexOcupado.Any(f => f(m, h));
            return Obras.HexLivre(m, h);
        }

        /// <summary>
        /// Ponto do exílio: entre as vagas livres do mapa (ou, sem vaga, hexágonos livres de planície e colina sem local perto),
        /// sorteia um da parte mais distante (P.guerra.exilio.longe) dos locais de quem derrubou o reino.
        /// </summary>
        public static (int hex, int vaga) Sortear(Mundo m, Reino r, Reino? atk, int hexQueda)
        {
            var origens = atk != null ? m.LocaisDe(atk.Id).Where(l => !l.Ruina).Select(l => l.Hex).ToList() : new List<int>();
            if (origens.Count == 0) origens.Add(hexQueda);
            int Dist(int h) => origens.Min(o => m.G.Distancia(o, h));
            var ocupadas = m.Reinos.Where(x => x.Ativo && x.Id != r.Id).Select(x => x.Vaga).ToHashSet();
            var vagas = m.Mapa.Vagas.Where(v => !ocupadas.Contains(v.Indice) && v.Indice != r.Vaga && PontoLivre(m, v.Castelo))
                .Select(v => (hex: v.Castelo, vaga: v.Indice)).ToList();
            if (vagas.Count == 0)
            {
                var perto = new HashSet<int>();
                foreach (var l in m.Locais) foreach (var h in m.G.Area(l.Hex, m.P.Visao.Local)) perto.Add(h);
                for (var h = 0; h < m.G.Total; h++)
                    if (!perto.Contains(h) && m.Mapa.Terrenos[h] is Mapa.Terreno.Planicie or Mapa.Terreno.Colina && PontoLivre(m, h)) vagas.Add((h, -1));
            }
            if (vagas.Count == 0) return (hexQueda, -1);   // mapa sem lugar: reconstrói no mesmo ponto
            var ordem = vagas.OrderByDescending(v => Dist(v.hex)).ThenBy(v => v.hex).ToList();
            var n = Math.Max(1, (int)Math.Ceiling(ordem.Count * m.P.Guerra.Exilio.Longe));
            return ordem[m.Sorte.Int(0, n)];
        }

        // ---------------------------------------------------------------- relatório

        private static void Relatar(Mundo m, Reino r, RegistroQueda q)
        {
            static string N(double v) => Combates.Num(Math.Round(v));
            var perdidos = string.Join(", ", q.RecursosPerdidos.Where(kv => kv.Value >= 1).Select(kv => N(kv.Value) + " de " + Logistica.NomeRecurso(kv.Key)));
            var linhas = new JsonArray(
                new JsonObject { ["rotulo"] = "Atacante", ["valor"] = q.Atacante },
                new JsonObject { ["rotulo"] = "Castelo perdido", ["valor"] = q.CasteloAntigo + " · nível " + q.NivelAntigo },
                new JsonObject { ["rotulo"] = q.Exilio ? "Novo castelo (exílio)" : "Nova sede", ["valor"] = q.NovoCastelo + " · nível " + q.NivelNovo },
                new JsonObject { ["rotulo"] = "Recursos perdidos", ["valor"] = perdidos.Length > 0 ? perdidos : "nenhum" },
                new JsonObject { ["rotulo"] = "População perdida", ["valor"] = N(q.PopulacaoPerdida) + (q.CivisMortos.Count > 0 ? ": " + Pessoas.Pessoas.Nomear(q.CivisMortos) : "") });
            if (q.ReliquiasLevadas.Count > 0) linhas.Add((JsonNode?)new JsonObject { ["rotulo"] = "Relíquias levadas", ["valor"] = string.Join(", ", q.ReliquiasLevadas) });
            if (q.Exilio) linhas.Add((JsonNode?)new JsonObject { ["rotulo"] = "Escudo de exílio", ["valor"] = m.P.EscudoExilioH + " h" });
            var resumo = q.Exilio
                ? "O " + q.CasteloAntigo + " caiu e o reino não tinha outros locais. Você recomeça em exílio, longe de quem derrubou, com um kit de recomeço e escudo de " + m.P.EscudoExilioH + " h."
                : "O " + q.CasteloAntigo + " caiu e virou ruína. A sede foi para " + q.NovoCastelo + ", agora castelo nível " + q.NivelNovo + ". Locais acima dele só sobem quando o castelo passar deles.";
            var dados = new JsonObject
            {
                ["resumo"] = resumo, ["exilio"] = q.Exilio, ["hex"] = q.HexNovo, ["hexAntigo"] = q.HexAntigo, ["linhas"] = linhas,
            };
            q.RelatorioId = Registros.Relatar(m, r.Id, "queda", q.Exilio ? "Seu reino caiu: exílio" : "O castelo caiu", dados, "ataques").Id;
        }
    }
}

namespace ReinoDePedra.Jogo.Reinos
{
    public sealed partial class Reino
    {
        /// <summary>Última queda do castelo (tela de exílio).</summary>
        public Combate.RegistroQueda? UltimaQueda { get; set; }
    }
}
