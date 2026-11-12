using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Mapa;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using ReinoDePedra.Jogo.Valiosos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;
using PS = ReinoDePedra.Jogo.Pessoas.Pessoas;

namespace ReinoDePedra.Jogo.Marchas
{
    /// <summary>Coleta de básicos de um exército parado no mapa.</summary>
    public abstract partial class Marcha
    {
        /// <summary>Ponto de coleta (hexágono) em que o exército coleta agora.</summary>
        public long? ColetaPontoId { get; set; }
        /// <summary>Evento de fim da coleta (carga cheia ou hexágono esgotado).</summary>
        public long? ColetaEventoId { get; set; }
    }
}

namespace ReinoDePedra.Jogo
{
    public sealed partial class Mundo
    {
        /// <summary>Hexágonos em que alguém coletou (estoque que se recupera com o tempo).</summary>
        public Colecao<PontoColeta> PontosColeta { get; } = new("coleta");
    }
}

namespace ReinoDePedra.Jogo.Valiosos
{
    /// <summary>
    /// Um hexágono de floresta, colina ou montanha em que alguém coletou. Guarda <c>P.coleta.estoque</c> do recurso e se
    /// recupera em linha (inteiro em <c>P.coleta.recuperaH</c>), sem tique: <see cref="Tirado"/> é o que faltava em
    /// <see cref="Em"/>. Hexágono que nunca foi tocado está cheio e não tem documento.
    /// </summary>
    public sealed class PontoColeta : Documento
    {
        public int Hex { get; set; }
        public string Recurso { get; set; } = "";
        public double Tirado { get; set; }
        public long Em { get; set; }
        /// <summary>Exércitos coletando agora (ids), de qualquer reino.</summary>
        public List<long> Coletores { get; set; } = new();
    }

    /// <summary>
    /// Coleta de madeira e pedra no mapa (ordem "coletar"). Qualquer tropa e os civis sem trabalho de um local cortam árvores
    /// (floresta) ou quebram pedra (colina, montanha) num hexágono explorado sem local, ao ritmo <c>F.ColetaH</c> (por pessoa,
    /// rendendo menos quanto mais gente, até <c>P.coleta.maxPessoas</c> por reino no hexágono). Sem tique, como a extração:
    /// o ponto guarda o instante em que está em dia e cada grupo tem um evento quando a carga enche ou o hexágono acaba.
    /// Cheia a carga, o grupo leva ao local próprio mais próximo que guarda o recurso (castelo, armazém ou o local que o
    /// produz) e, com "repetir", volta (ou vai a um hexágono igual perto, se este acabou). Os civis voltam para casa quando o
    /// grupo termina (<see cref="Marcha.AoEncerrar"/>).
    /// </summary>
    [Sistema]
    public static class Coletas
    {
        public const string OrdemColetarId = "coletar", OrdemEntregarId = "entregar-coleta";
        private const double Eps = 1e-6;
        /// <summary>Tolerância de arredondamento para "carga cheia" e "hexágono esgotado" (menos de meia unidade).</summary>
        public const double Folga = 0.01;

        public static void AoIniciar(Mundo m) => Sistemas.UmaVez("coleta", () =>
        {
            Marcha.AoPartir.Add(AoPartir);
            Marcha.AoEncerrar.Insert(0, PS.SoltarColetores);   // antes de quem tira do mundo quem ainda está na marcha
        });

        // ---------------------------------------------------------------- consultas

        /// <summary>Recurso que se coleta no hexágono pelo terreno ("madeira", "pedra"), ou null.</summary>
        public static string? Recurso(Mundo m, int hex) =>
            m.G.Valido(hex) && m.P.Coleta.Terrenos.TryGetValue(m.Mapa.Terrenos[hex].Chave(), out var r) ? r : null;

        /// <summary>Motivo para não coletar no hexágono (null se pode).</summary>
        public static string? Motivo(Mundo m, Reino r, int hex)
        {
            if (!m.G.Valido(hex)) return "Hexágono fora do mapa.";
            if (!Nevoas.Explorado(m, r.Id, hex)) return "Explore a área antes de coletar.";
            if (Recurso(m, hex) == null) return "Aqui não há o que coletar: madeira na floresta, pedra na colina e na montanha.";
            if (m.LocalNoHex(hex) is { Ruina: false }) return "Há um local neste hexágono: escolha um hexágono livre.";
            return null;
        }

        public static PontoColeta? Ponto(Mundo m, int hex) => m.PontosColeta.FirstOrDefault(p => p.Hex == hex);

        private static PontoColeta PontoOuNovo(Mundo m, int hex)
        {
            var p = Ponto(m, hex);
            if (p != null) return p;
            p = m.PontosColeta.Adicionar(new PontoColeta { Hex = hex, Recurso = Recurso(m, hex) ?? "", Em = m.Agora });
            return p;
        }

        private static double PorHoraRecupera(Mundo m) => m.P.Coleta.RecuperaH > 0 ? m.P.Coleta.Estoque / m.P.Coleta.RecuperaH : 0;

        /// <summary>Quanto o hexágono tem agora (cheio se nunca foi tocado).</summary>
        public static double Disponivel(Mundo m, int hex)
        {
            var p = Ponto(m, hex);
            return p == null ? m.P.Coleta.Estoque : Disponivel(m, p);
        }
        public static double Disponivel(Mundo m, PontoColeta p)
        {
            var h = Math.Max(0, (m.Agora - p.Em) / (double)T.Hora);
            return Math.Max(0, m.P.Coleta.Estoque - Math.Max(0, p.Tirado - PorHoraRecupera(m) * h));
        }

        /// <summary>Pessoas do grupo que coletam: soldados e civis.</summary>
        public static int PessoasDe(Mundo m, Exercito ex) => GT.Total(ex.Tropas) + PS.CivisColetando(m, ex);

        /// <summary>Unidades por hora que o grupo coleta.</summary>
        public static double Ritmo(Mundo m, Exercito ex) => m.F.ColetaH(PessoasDe(m, ex));

        public static IEnumerable<Exercito> Coletores(Mundo m, PontoColeta p) =>
            p.Coletores.Select(id => m.Marchas.Obter(id) as Exercito).OfType<Exercito>().Where(e => e.ColetaPontoId == p.Id);

        /// <summary>Pessoas do reino coletando ou a caminho de coletar neste hexágono (fora o exército <paramref name="exceto"/>).</summary>
        public static int PessoasNoHex(Mundo m, long reinoId, int hex, long exceto) =>
            Exercitos.De(m, reinoId).Where(e => e.Id != exceto && (e.Ordem == OrdemColetarId && e.Destino == hex || e.ColetaPontoId is long pid && m.PontosColeta.Obter(pid)?.Hex == hex))
                .Sum(e => PessoasDe(m, e));

        /// <summary>Local próprio mais próximo (em tempo de viagem) que guarda o recurso: castelo, armazém ou o local que o produz.</summary>
        public static (Local local, Rota? rota)? Deposito(Mundo m, long reinoId, int de, string vel, string recurso, OpcoesCaminho op)
        {
            (Local, Rota?)? melhor = null; var melhorMin = double.PositiveInfinity;
            foreach (var l in m.LocaisDe(reinoId).Where(l => !l.Ruina && (l.Tipo is TipoLocal.Castelo or TipoLocal.Armazem || l.Produz == recurso)))
            {
                if (l.Hex == de) return (l, null);
                var rr = Caminhos.Calcular(m, de, l.Hex, vel, op);
                if (rr.Hexes[^1] != l.Hex || rr.TotalMin >= melhorMin) continue;
                melhor = (l, rr); melhorMin = rr.TotalMin;
            }
            return melhor;
        }
        private static OpcoesCaminho Opcoes(Mundo m, Exercito ex) => new() { Seguro = ex.Seguro, Forca = ex.ForcaContraFauna(m), ReinoId = ex.ReinoId };

        // ---------------------------------------------------------------- andamento (sem tique)

        /// <summary>Põe em dia o hexágono e as cargas de quem coleta nele (do último acerto até agora).</summary>
        public static void Liquidar(Mundo m, PontoColeta p)
        {
            var agora = m.Agora;
            var ativos = Coletores(m, p).ToList();
            if (ativos.Count != p.Coletores.Count) p.Coletores = ativos.Select(e => e.Id).ToList();
            var disp = Disponivel(m, p);
            var dt = (agora - p.Em) / (double)T.Hora;
            var tirado = 0.0;
            if (ativos.Count > 0 && dt > 0)
            {
                var qs = ativos.Select(e => Math.Min(Ritmo(m, e) * dt, Math.Max(0, e.CargaMax(m) - e.Carga.Total))).ToList();
                var tot = qs.Sum();
                var f = tot > disp ? disp / Math.Max(Eps, tot) : 1;
                for (var i = 0; i < ativos.Count; i++)
                {
                    if (qs[i] <= 0) continue;
                    ativos[i].Carga.Somar(p.Recurso, qs[i] * f);
                    m.Sujar(ativos[i]);
                }
                tirado = tot * f;
            }
            p.Tirado = m.P.Coleta.Estoque - disp + tirado;
            p.Em = agora;
            m.Sujar(p);
        }

        /// <summary>Agenda, para cada grupo, o fim: carga cheia ou hexágono esgotado (o que vier antes).</summary>
        public static void Reagendar(Mundo m, PontoColeta p)
        {
            var ativos = Coletores(m, p).ToList();
            var ritmos = ativos.Select(e => Ritmo(m, e)).ToList();
            var liquido = ritmos.Sum() - PorHoraRecupera(m);
            var disp = Disponivel(m, p);
            for (var i = 0; i < ativos.Count; i++)
            {
                var e = ativos[i];
                m.Cancelar(e.ColetaEventoId);
                var livre = Math.Max(0, e.CargaMax(m) - e.Carga.Total);
                var h = ritmos[i] > 0 ? livre / ritmos[i] : double.PositiveInfinity;
                if (liquido > 0) h = Math.Min(h, disp / liquido);
                if (double.IsInfinity(h)) { e.ColetaEventoId = null; m.Sujar(e); continue; }   // ninguém coleta: fica parado até nova ordem
                e.ColetaEventoId = m.Agendar(new FimColetaEvento { MarchaId = e.Id, PontoId = p.Id, Quando = m.Agora + (long)Math.Ceiling(h * T.Hora) }).Id;
                m.Sujar(e);
            }
        }

        /// <summary>O grupo chegou ao hexágono: começa a coletar (ou procura outro perto, ou leva o que tem, ou volta).</summary>
        public static void Comecar(Mundo m, Exercito ex)
        {
            var r = m.Reinos.Obter(ex.ReinoId);
            var hex = ex.Destino;
            var motivo = r == null ? "O reino não existe mais." : Motivo(m, r, hex);
            if (r == null || motivo != null)
            {
                Exercitos.Avisar(m, ex, "Coleta impossível", motivo);
                Terminar(m, ex);
                return;
            }
            if (Disponivel(m, hex) < m.P.Coleta.Minimo)
            {
                if (Vizinho(m, r, ex, hex) is int outro && TentarIr(m, ex, outro)) return;
                Exercitos.Avisar(m, ex, "Nada para coletar", "O hexágono está esgotado e não há outro igual por perto. As tropas voltam.");
                Terminar(m, ex);
                return;
            }
            ex.Parar(m);
            var p = PontoOuNovo(m, hex);
            Liquidar(m, p);
            ex.ColetaPontoId = p.Id;
            ex.Dados["coletaHex"] = hex;
            ex.Dados["recurso"] = p.Recurso;
            if (!p.Coletores.Contains(ex.Id)) p.Coletores.Add(ex.Id);
            m.Sujar(p); m.Sujar(ex);
            Reagendar(m, p);
            m.Avisar(ex.ReinoId, "marchas");
        }

        /// <summary>Hexágono igual (mesmo recurso, explorado, sem local, com estoque) mais perto, a até <c>P.coleta.vizinhos</c>.</summary>
        public static int? Vizinho(Mundo m, Reino r, Exercito ex, int hex)
        {
            var rec = Recurso(m, hex);
            if (rec == null) return null;
            return m.G.Area(hex, m.P.Coleta.Vizinhos).Where(h => h != hex && Recurso(m, h) == rec && Motivo(m, r, h) == null && Disponivel(m, h) >= m.P.Coleta.Minimo
                    && PessoasNoHex(m, r.Id, h, ex.Id) + PessoasDe(m, ex) <= m.P.Coleta.MaxPessoas)
                .OrderBy(h => m.G.Distancia(h, hex)).ThenByDescending(h => Disponivel(m, h)).ThenBy(h => h)
                .Select(h => (int?)h).FirstOrDefault();
        }

        private static bool TentarIr(Mundo m, Exercito ex, int hex)
        {
            try
            {
                var rota = Exercitos.Rota(m, ex, ex.HexEm(m.Agora), hex);
                ex.Ordem = OrdemColetarId; ex.AlvoLocalId = null; ex.Retornando = false;
                ex.Partir(m, rota);
                return true;
            }
            catch (RegraException) { return false; }
        }

        /// <summary>Tira o grupo do hexágono (pondo-o em dia antes, se <paramref name="liquidar"/>).</summary>
        public static void Sair(Mundo m, Exercito ex, PontoColeta p, bool liquidar)
        {
            if (liquidar) Liquidar(m, p);
            p.Coletores.Remove(ex.Id);
            m.Cancelar(ex.ColetaEventoId);
            ex.ColetaPontoId = null; ex.ColetaEventoId = null;
            m.Sujar(p); m.Sujar(ex);
            Reagendar(m, p);
            if (p.Coletores.Count == 0 && Disponivel(m, p) >= m.P.Coleta.Estoque - Eps) m.PontosColeta.Remover(p);   // voltou a ficar cheio: some
        }

        /// <summary>
        /// Nova ordem a um grupo que coletava: leva o que já tirou. Os civis só seguem o grupo para coletar, entregar, voltar ou
        /// mover; outra ordem (atacar, caçar...) os manda para casa.
        /// </summary>
        private static void AoPartir(Mundo m, Marcha mc)
        {
            if (mc is not Exercito ex) return;
            if (ex.ColetaPontoId is long pid)
            {
                var p = m.PontosColeta.Obter(pid);
                if (p != null) Sair(m, ex, p, true);
                else { ex.ColetaPontoId = null; m.Cancelar(ex.ColetaEventoId); ex.ColetaEventoId = null; }
            }
            if (ex.Ordem is not (OrdemColetarId or OrdemEntregarId or OrdemRetornar.Id or OrdemMover.Id) && PS.CivisColetando(m, ex) > 0)
                PS.SoltarColetores(m, ex);
        }

        /// <summary>Leva a carga ao local mais próximo que guarda o recurso (ordem "entregar-coleta"); sem carga, volta.</summary>
        public static void Entregar(Mundo m, Exercito ex)
        {
            var rec = ex.Dados["recurso"]?.GetValue<string>() ?? Recurso(m, ex.HexEm(m.Agora)) ?? "";
            var dep = Deposito(m, ex.ReinoId, ex.HexEm(m.Agora), ex.Vel, rec, Opcoes(m, ex));
            if (dep == null) { ex.Retornar(m); return; }
            ex.Ordem = OrdemEntregarId; ex.AlvoLocalId = dep.Value.local.Id;
            m.Sujar(ex);
            if (dep.Value.rota == null) { new OrdemEntregarColeta().Chegou(m, ex); return; }
            ex.Retornando = true;
            ex.Partir(m, dep.Value.rota);
        }

        /// <summary>Acabou a coleta: leva o que tem ou volta para casa.</summary>
        private static void Terminar(Mundo m, Exercito ex)
        {
            ex.Dados["repetir"] = false;
            if (ex.Carga.Total > Eps) Entregar(m, ex); else ex.Retornar(m);
        }

        /// <summary>Relatório do fim da coleta (uma vez, quando o grupo para de repetir).</summary>
        internal static void Relatar(Mundo m, Exercito ex, Local l)
        {
            var total = ex.Dados["coletado"]?.GetValue<double>() ?? 0;
            if (total < 0.5) return;
            var rec = ex.Dados["recurso"]?.GetValue<string>() ?? "";
            var txt = Math.Floor(total) + " de " + Logistica.NomeRecurso(rec);
            var quem = new List<string>();
            if (GT.Total(ex.Tropas) > 0) quem.Add(GT.Partes(m, ex.Tropas));
            var civis = PS.CivisColetando(m, ex);
            if (civis > 0) quem.Add(civis + (civis == 1 ? " civil" : " civis"));
            Registros.Relatar(m, ex.ReinoId, "coleta", "Coleta: " + txt, new JsonObject
            {
                ["resumo"] = string.Join(" e ", quem) + " trouxeram " + txt + " no total.",
                ["linhas"] = new JsonArray
                {
                    (JsonNode?)new JsonObject { ["rotulo"] = "Coletado", ["valor"] = txt },
                    (JsonNode?)new JsonObject { ["rotulo"] = "Última entrega", ["valor"] = l.Nome },
                },
                ["hex"] = ex.Dados["coletaHex"]?.GetValue<int>() ?? l.Hex,
            }, "recursos");
        }

        // ---------------------------------------------------------------- envio

        /// <summary>
        /// Manda coletar: tropas da guarnição de <paramref name="deLocalId"/> e <paramref name="civis"/> civis sem trabalho
        /// presentes nele (pode ser só um dos dois). Com <paramref name="repetir"/>, o grupo volta depois de cada entrega.
        /// </summary>
        public static Exercito Enviar(Mundo m, Reino r, long deLocalId, IReadOnlyDictionary<string, int>? tropas, int civis, int hex, bool repetir, bool seguro)
        {
            var l = m.Locais.Obter(deLocalId);
            if (l == null || l.ReinoId != r.Id) throw new RegraException("Local não é seu.", 404);
            if (l.Ruina) throw new RegraException("O local está em ruínas.");
            if (civis < 0) throw new RegraException("Quantidade de civis inválida.");
            var grupo = GT.Limpo(tropas);
            if (grupo.Count > 0) grupo = GT.Validar(m, l, grupo);
            Economia.Atualizar(m, r);
            var ociosos = PS.OciososPresentes(m, l).Take(civis).ToList();
            if (ociosos.Count < civis) throw new RegraException($"{l.Nome} só tem {ociosos.Count} {(ociosos.Count == 1 ? "civil" : "civis")} sem trabalho.");
            if (grupo.Count == 0 && civis == 0) throw new RegraException("Escolha quem vai coletar: tropas ou civis sem trabalho.");
            if (hex == l.Hex) throw new RegraException("Escolha um hexágono fora do local.");
            var vel = grupo.Count > 0 ? GT.Velocidade(m, grupo) : m.P.Carregador.Vel;
            if (civis > 0 && m.P.MinPor[m.P.Carregador.Vel] > m.P.MinPor[vel]) vel = m.P.Carregador.Vel;   // os civis vão a pé
            var ex = new Exercito
            {
                ReinoId = r.Id, OrigemLocalId = l.Id, Ordem = OrdemColetarId, Tropas = grupo, Vel = vel, Seguro = seguro,
                Dados = new JsonObject { ["repetir"] = repetir }, AlvoLocalId = null,
            };
            new OrdemColetar().Validar(m, r, ex, hex, civis);
            var forca = GT.ForcaFauna(m, grupo) + civis * m.P.FaunaServ.ForcaCarregador;
            var rota = Caminhos.Calcular(m, l.Hex, hex, vel, new OpcoesCaminho { Seguro = seguro, Forca = forca, ReinoId = r.Id });
            if (rota.Hexes[^1] != hex) throw new RegraException("Não há caminho até o destino.");
            if (grupo.Count > 0) GT.Retirar(m, l, grupo);
            m.Marchas.Adicionar(ex);
            PS.LevarParaColeta(m, ex, ociosos);
            ex.Partir(m, rota);
            m.Avisar(r.Id, "reino");
            return ex;
        }

        /// <summary>Prévia de uma coleta: recurso, estoque do hexágono, ritmo, carga, depósito e os caminhos.</summary>
        public static (string recurso, double disponivel, double ritmo, double cargaMax, int pessoas, int jaNoHex, string? deposito) Previa(Mundo m, Reino r, Local de, IReadOnlyDictionary<string, int> tropas, int civis, int hex)
        {
            var rec = Recurso(m, hex) ?? "";
            var n = GT.Total(tropas) + civis;
            var carga = GT.Carga(m, tropas) + civis * m.P.Coleta.CargaCivil;
            var vel = n > 0 && GT.Total(tropas) > 0 ? GT.Velocidade(m, tropas) : m.P.Carregador.Vel;
            var dep = Deposito(m, r.Id, hex, vel, rec, new OpcoesCaminho { ReinoId = r.Id });
            return (rec, Disponivel(m, hex), m.F.ColetaH(n), carga, n, PessoasNoHex(m, r.Id, hex, 0), dep?.local.Nome);
        }
    }

    /// <summary>Fim da coleta de um grupo: carga cheia ou hexágono esgotado.</summary>
    public sealed class FimColetaEvento : Evento
    {
        public long MarchaId { get; set; }
        public long PontoId { get; set; }
        public override void Executar(Mundo m)
        {
            if (m.Marchas.Obter(MarchaId) is not Exercito ex || ex.ColetaPontoId != PontoId) return;
            ex.ColetaEventoId = null;
            var p = m.PontosColeta.Obter(PontoId);
            if (p == null) { ex.ColetaPontoId = null; Coletas.Entregar(m, ex); return; }
            Coletas.Liquidar(m, p);
            var cheia = ex.CargaMax(m) - ex.Carga.Total <= Coletas.Folga;
            var esgotado = Coletas.Disponivel(m, p) <= Coletas.Folga;
            if (!cheia && !esgotado) { Coletas.Reagendar(m, p); return; }   // outro grupo entrou ou saiu: o fim mudou
            Coletas.Sair(m, ex, p, false);
            if (ex.Carga.Total <= 1e-6) { ex.Retornar(m); return; }
            Coletas.Entregar(m, ex);
        }
    }

    /// <summary>Vai a um hexágono explorado de floresta, colina ou montanha sem local e coleta até a carga encher.</summary>
    public sealed class OrdemColetar : IOrdemExercito
    {
        public string Ordem => Coletas.OrdemColetarId;
        public void Validar(Mundo m, Reino r, Exercito ex, int destino) => Validar(m, r, ex, destino, PS.CivisColetando(m, ex));

        /// <summary>Confere o destino para o grupo com <paramref name="civis"/> civis (o envio ainda não os embarcou).</summary>
        public void Validar(Mundo m, Reino r, Exercito ex, int destino, int civis)
        {
            if (Coletas.Motivo(m, r, destino) is { } motivo) throw new RegraException(motivo);
            if (Coletas.Disponivel(m, destino) < m.P.Coleta.Minimo) throw new RegraException("Este hexágono está esgotado. Ele se recupera com o tempo; tente um vizinho.");
            if (GT.Carga(m, ex.Tropas) + civis * m.P.Coleta.CargaCivil <= 0) throw new RegraException("Essas tropas não carregam nada.");
            var max = m.P.Coleta.MaxPessoas;
            if (Coletas.PessoasNoHex(m, r.Id, destino, ex.Id) + GT.Total(ex.Tropas) + civis > max) throw new RegraException($"Até {max} pessoas coletando por hexágono.");
            ex.Dados["recurso"] = Coletas.Recurso(m, destino);
            if (ex.Dados["coletado"] == null) ex.Dados["coletado"] = 0.0;
        }

        public void Chegou(Mundo m, Exercito ex) => Coletas.Comecar(m, ex);
    }

    /// <summary>Leva a carga coletada ao local que guarda o recurso; com "repetir", volta ao hexágono (ou a um igual perto).</summary>
    public sealed class OrdemEntregarColeta : IOrdemExercito
    {
        public string Ordem => Coletas.OrdemEntregarId;
        public bool NoEnvio => false;
        public void Chegou(Mundo m, Exercito ex)
        {
            var l = ex.AlvoLocalId is long id ? m.Locais.Obter(id) : null;
            if (!Exercitos.LocalProprio(l, ex.ReinoId) || l!.Hex != ex.HexEm(m.Agora)) { Coletas.Entregar(m, ex); return; }
            var r = m.Reinos.Obter(ex.ReinoId);
            if (r != null) Economia.Atualizar(m, r);
            var entregue = ex.Carga.Total;
            l.Estoque.Somar(ex.Carga);
            ex.Carga = new();
            ex.Dados["coletado"] = (ex.Dados["coletado"]?.GetValue<double>() ?? 0) + entregue;
            m.Sujar(l); m.Sujar(ex);
            m.Avisar(ex.ReinoId, "reino");
            var hex = ex.Dados["coletaHex"]?.GetValue<int>();
            var repetir = ex.Dados["repetir"]?.GetValue<bool>() == true;
            if (repetir && r != null && hex is int h)
            {
                int? alvo = Coletas.Motivo(m, r, h) == null && Coletas.Disponivel(m, h) >= m.P.Coleta.Minimo ? h : Coletas.Vizinho(m, r, ex, h);
                if (alvo is int a)
                {
                    try
                    {
                        var rota = Exercitos.Rota(m, ex, l.Hex, a);
                        ex.Ordem = Coletas.OrdemColetarId; ex.AlvoLocalId = null; ex.Retornando = false;
                        ex.Partir(m, rota);
                        return;
                    }
                    catch (RegraException) { /* sem caminho: ficam no local */ }
                }
            }
            Coletas.Relatar(m, ex, l);
            ex.EntrarNoLocal(m, l);
        }
    }
}
