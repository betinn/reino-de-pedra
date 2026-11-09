using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Mapa;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Mapa
{
    public sealed partial class Jazida
    {
        /// <summary>Exércitos extraindo agora (ids), de qualquer reino.</summary>
        public List<long> Extratores { get; set; } = new();
        /// <summary>Instante até o qual <see cref="Jazida.Restante"/> e as cargas dos extratores estão em dia.</summary>
        public long ExtracaoEm { get; set; }
    }
}

namespace ReinoDePedra.Jogo.Valiosos
{
    /// <summary>
    /// Extração de recursos descobertos. Nada é obrigatório: qualquer tropa coleta (ordem "extrair"). O grupo fica parado
    /// na jazida extraindo ao ritmo <c>F.ExtracaoH</c> (valor por hora ÷ valor de referência do recurso; posto ×1,5; rota no
    /// caminho até o depósito ×1,2; até 50 tropas). Sem tique: a jazida guarda o instante em que está em dia e cada
    /// extrator tem um evento no instante em que a carga enche ou a jazida se esgota (dividida entre todos os que extraem).
    /// Ao encher, o grupo leva a carga ao armazém ou castelo mais próximo (onde ficam os valiosos) e, com "repetir", volta.
    /// </summary>
    [Sistema]
    public static class Extracoes
    {
        public const string OrdemExtrair = "extrair", OrdemEntregar = "entregar";
        private const double Eps = 1e-6;

        public static void AoIniciar(Mundo m) => Sistemas.UmaVez("extracao", () =>
        {
            Marcha.AoPartir.Add(AoPartir);
        });

        public static Jazida? NoHex(Mundo m, int hex) => m.Jazidas.FirstOrDefault(j => j.Hex == hex);
        /// <summary>Jazida do hexágono, se o reino a descobriu.</summary>
        public static Jazida? Conhecida(Mundo m, long reinoId, int hex) => NoHex(m, hex) is { } j && j.DescobertaPor.Contains(reinoId) ? j : null;

        public static Local? PostoNoHex(Mundo m, int hex) => m.LocalNoHex(hex) is { Tipo: TipoLocal.Posto, Ruina: false } l ? l : null;
        public static bool TemPosto(Mundo m, long reinoId, int hex) => PostoNoHex(m, hex)?.ReinoId == reinoId;
        /// <summary>Há um local de outro reino no hexágono (posto alheio): a jazida ou ruína é dele enquanto o posto estiver lá.</summary>
        public static bool OcupadoPorOutro(Mundo m, long reinoId, int hex) => m.LocalNoHex(hex) is { Ruina: false } l && l.ReinoId != 0 && l.ReinoId != reinoId;

        public static double Valor(Mundo m, string recurso) => m.P.Valor.TryGetValue(recurso, out var v) && v > 0 ? v : 1;

        /// <summary>Unidades por hora que o grupo extrai da jazida.</summary>
        public static double Ritmo(Mundo m, IReadOnlyDictionary<string, int> tropas, string recurso, bool posto, bool rota) =>
            m.F.ExtracaoH(GT.Limpo(tropas), posto, rota) / Valor(m, recurso);
        private static double Ritmo(Mundo m, Exercito ex, Jazida j) =>
            Ritmo(m, ex.Tropas, j.Recurso, TemPosto(m, ex.ReinoId, j.Hex), ex.ExtraiRota == true);

        /// <summary>Rota pública em pelo menos <c>P.extracaoRotaFrac</c> dos hexágonos do caminho.</summary>
        public static bool RotaNoCaminho(Mundo m, Rota? rota)
        {
            if (rota == null || rota.Hexes.Count < 2) return false;
            var vias = m.Vias.Rotas;
            var n = rota.Hexes.Skip(1).Count(vias.Contains);
            return n >= m.P.ExtracaoRotaFrac * (rota.Hexes.Count - 1);
        }

        /// <summary>Armazém ou castelo próprio mais próximo em tempo de viagem, com o caminho (null se já está lá).</summary>
        public static (Local local, Rota? rota)? Deposito(Mundo m, long reinoId, int de, string vel, OpcoesCaminho op)
        {
            (Local, Rota?)? melhor = null; var melhorMin = double.PositiveInfinity;
            foreach (var l in m.LocaisDe(reinoId).Where(Valiosos.Deposito))
            {
                if (l.Hex == de) return (l, null);
                var rr = Caminhos.Calcular(m, de, l.Hex, vel, op);
                if (rr.Hexes[^1] != l.Hex || rr.TotalMin >= melhorMin) continue;
                melhor = (l, rr); melhorMin = rr.TotalMin;
            }
            return melhor;
        }
        private static OpcoesCaminho Opcoes(Mundo m, Exercito ex) => new() { Seguro = ex.Seguro, Forca = GT.ForcaFauna(m, ex.Tropas), ReinoId = ex.ReinoId };

        public static IEnumerable<Exercito> Extratores(Mundo m, Jazida j) =>
            j.Extratores.Select(id => m.Marchas.Obter(id) as Exercito).OfType<Exercito>().Where(e => e.ExtraiJazidaId == j.Id);

        /// <summary>Tropas do reino extraindo ou a caminho desta jazida (fora o exército <paramref name="exceto"/>).</summary>
        public static int TropasNaJazida(Mundo m, Jazida j, long reinoId, long exceto) =>
            Exercitos.De(m, reinoId).Where(e => e.Id != exceto && (e.ExtraiJazidaId == j.Id || (e.Ordem == OrdemExtrair && e.Destino == j.Hex)))
                .Sum(e => GT.Total(e.Tropas));

        // ---------------------------------------------------------------- andamento

        /// <summary>Põe em dia a jazida e as cargas de quem extrai (desde <see cref="Jazida.ExtracaoEm"/> até agora).</summary>
        public static void Liquidar(Mundo m, Jazida j)
        {
            var agora = m.Agora;
            var ativos = Extratores(m, j).ToList();
            if (ativos.Count != j.Extratores.Count) j.Extratores = ativos.Select(e => e.Id).ToList();
            var dt = (agora - j.ExtracaoEm) / (double)T.Hora;
            if (ativos.Count > 0 && j.ExtracaoEm > 0 && dt > 0)
            {
                var qs = ativos.Select(e => Math.Min(Ritmo(m, e, j) * dt, Math.Max(0, e.CargaMax(m) - e.Carga.Total))).ToList();
                var tot = qs.Sum();
                var f = tot > j.Restante ? j.Restante / tot : 1;
                for (var i = 0; i < ativos.Count; i++)
                {
                    if (qs[i] <= 0) continue;
                    ativos[i].Carga.Somar(j.Recurso, qs[i] * f);
                    m.Sujar(ativos[i]);
                }
                j.Restante = Math.Max(0, j.Restante - tot * f);
            }
            j.ExtracaoEm = agora;
            m.Sujar(j);
        }

        /// <summary>Agenda, para cada extrator, o fim: carga cheia ou jazida esgotada (o que vier antes).</summary>
        public static void Reagendar(Mundo m, Jazida j)
        {
            var ativos = Extratores(m, j).ToList();
            var ritmos = ativos.Select(e => Ritmo(m, e, j)).ToList();
            var tot = ritmos.Sum();
            for (var i = 0; i < ativos.Count; i++)
            {
                var e = ativos[i];
                m.Cancelar(e.ExtraiEventoId);
                var livre = Math.Max(0, e.CargaMax(m) - e.Carga.Total);
                var h = ritmos[i] > 0 ? livre / ritmos[i] : 0;
                if (tot > 0) h = Math.Min(h, j.Restante / tot);
                e.ExtraiEventoId = m.Agendar(new FimExtracaoEvento { MarchaId = e.Id, JazidaId = j.Id, Quando = m.Agora + (long)Math.Ceiling(h * T.Hora) }).Id;
                m.Sujar(e);
            }
        }

        /// <summary>O exército chegou à jazida: começa a extrair.</summary>
        public static void Comecar(Mundo m, Exercito ex)
        {
            var j = Conhecida(m, ex.ReinoId, ex.Destino);
            if (j == null || j.Restante <= Eps)
            {
                Exercitos.Avisar(m, ex, "Jazida esgotada", "Não há mais o que extrair. As tropas voltam.");
                if (ex.Carga.Total > Eps) Entregar(m, ex); else ex.Retornar(m);
                return;
            }
            if (OcupadoPorOutro(m, ex.ReinoId, j.Hex))
            {
                Exercitos.Avisar(m, ex, "Jazida ocupada", "Há um posto de outro reino na jazida. As tropas voltam.");
                ex.Retornar(m);
                return;
            }
            ex.Parar(m);
            Liquidar(m, j);
            var dep = Deposito(m, ex.ReinoId, j.Hex, ex.Vel, Opcoes(m, ex));
            ex.ExtraiRota = dep is { } d && RotaNoCaminho(m, d.rota);
            ex.ExtraiJazidaId = j.Id;
            ex.Dados["jazidaId"] = j.Id;
            if (!j.Extratores.Contains(ex.Id)) j.Extratores.Add(ex.Id);
            m.Sujar(j); m.Sujar(ex);
            Reagendar(m, j);
            m.Avisar(ex.ReinoId, "marchas");
        }

        /// <summary>Tira o exército da extração (pondo a jazida em dia antes, se <paramref name="liquidar"/>).</summary>
        public static void Sair(Mundo m, Exercito ex, Jazida j, bool liquidar)
        {
            if (liquidar) Liquidar(m, j);
            j.Extratores.Remove(ex.Id);
            m.Cancelar(ex.ExtraiEventoId);
            ex.ExtraiJazidaId = null; ex.ExtraiEventoId = null; ex.ExtraiRota = null;
            m.Sujar(j); m.Sujar(ex);
            Reagendar(m, j);
        }

        /// <summary>Nova ordem a um grupo que extraía (ou escavava): ele leva o que já tirou e para o trabalho.</summary>
        private static void AoPartir(Mundo m, Marcha mc)
        {
            if (mc is not Exercito ex) return;
            if (ex.ExtraiJazidaId is long jid)
            {
                var j = m.Jazidas.Obter(jid);
                if (j != null) Sair(m, ex, j, true);
                else { ex.ExtraiJazidaId = null; m.Cancelar(ex.ExtraiEventoId); ex.ExtraiEventoId = null; }
            }
            if (ex.EscavaRuinaId != null) Escavacoes.Interromper(m, ex, "Escavação interrompida", "Uma nova ordem tirou as tropas da ruína.");
        }

        /// <summary>Leva a carga ao armazém ou castelo mais próximo (ordem "entregar").</summary>
        public static void Entregar(Mundo m, Exercito ex)
        {
            var de = ex.HexEm(m.Agora);
            var dep = Deposito(m, ex.ReinoId, de, ex.Vel, Opcoes(m, ex));
            if (dep == null) { ex.Retornar(m); return; }
            ex.Ordem = OrdemEntregar; ex.AlvoLocalId = dep.Value.local.Id;
            m.Sujar(ex);
            if (dep.Value.rota == null) { new OrdemEntregarExtracao().Chegou(m, ex); return; }
            ex.Retornando = true;
            ex.Partir(m, dep.Value.rota);
        }

        /// <summary>
        /// Manda tropas extrair (ou escavar: <paramref name="ordem"/>). Do próprio posto no hexágono, começam na hora;
        /// de outro local, marcham até lá.
        /// </summary>
        public static Exercito Enviar(Mundo m, Reino r, long deLocalId, IReadOnlyDictionary<string, int>? tropas, int hex, string ordem, bool seguro, JsonObject dados)
        {
            var l = m.Locais.Obter(deLocalId);
            if (l == null || l.ReinoId != r.Id) throw new RegraException("Local não é seu.", 404);
            if (l.Hex != hex) return Exercitos.Enviar(m, r, deLocalId, tropas, hex, ordem, seguro, dados);
            if (l.Ruina) throw new RegraException("O local está em ruínas.");
            var o = Exercitos.OrdemOuNulo(ordem) ?? throw new RegraException("Ordem desconhecida.");
            var grupo = GT.Validar(m, l, tropas);
            var ex = new Exercito
            {
                ReinoId = r.Id, OrigemLocalId = l.Id, Ordem = o.Ordem, Tropas = grupo, Vel = GT.Velocidade(m, grupo),
                Seguro = seguro, Dados = dados, AlvoLocalId = l.Id,
            };
            o.Validar(m, r, ex, hex);
            Economia.Atualizar(m, r);
            GT.Retirar(m, l, grupo);
            ex.Caminho = [hex]; ex.Tempos = [m.Agora]; ex.Origem = ex.Destino = hex;
            m.Marchas.Adicionar(ex);
            Pessoas.Pessoas.Reclamar(m, ex);
            o.Chegou(m, ex);
            m.Avisar(r.Id, "reino");
            m.Avisar(r.Id, "marchas");
            return ex;
        }
    }

    /// <summary>Fim da extração de um grupo: carga cheia ou jazida esgotada.</summary>
    public sealed class FimExtracaoEvento : Evento
    {
        public long MarchaId { get; set; }
        public long JazidaId { get; set; }
        public override void Executar(Mundo m)
        {
            if (m.Marchas.Obter(MarchaId) is not Exercito ex || ex.ExtraiJazidaId != JazidaId) return;
            ex.ExtraiEventoId = null;
            var j = m.Jazidas.Obter(JazidaId);
            if (j == null) { ex.ExtraiJazidaId = null; ex.Retornar(m); return; }
            Extracoes.Liquidar(m, j);
            var cheia = ex.CargaMax(m) - ex.Carga.Total <= 1e-6;
            var esgotada = j.Restante <= 1e-6;
            if (!cheia && !esgotada) { Extracoes.Reagendar(m, j); return; }   // outro extrator saiu ou entrou: o fim mudou
            Extracoes.Sair(m, ex, j, false);
            if (esgotada)
            {
                ex.Dados["repetir"] = false;
                Registros.Notificar(m, ex.ReinoId, "recursos", "Jazida esgotada", "A jazida de " + Logistica.NomeRecurso(j.Recurso) + " acabou. As tropas levam a última carga.", "extracao");
            }
            Extracoes.Entregar(m, ex);
        }
    }

    /// <summary>Vai a uma jazida descoberta e extrai até a carga encher (ou a jazida acabar).</summary>
    public sealed class OrdemExtrairJazida : IOrdemExercito
    {
        public string Ordem => Extracoes.OrdemExtrair;
        /// <summary>Quem já está parado na jazida (ou guarnece o posto dela) extrai sem sair do lugar.</summary>
        public bool NoMesmoHex => true;
        public Rota Trajeto(Mundo m, Exercito ex, int destino, int de) => Exercitos.Rota(m, ex, de, destino);
        public void Validar(Mundo m, Reino r, Exercito ex, int destino)
        {
            var j = Extracoes.Conhecida(m, r.Id, destino) ?? throw new RegraException("Não há jazida conhecida neste hexágono.");
            if (j.Restante <= 1e-6) throw new RegraException("A jazida se esgotou.");
            if (Extracoes.OcupadoPorOutro(m, r.Id, destino)) throw new RegraException("Há um posto de outro reino nesta jazida.");
            if (GT.Carga(m, ex.Tropas) <= 0) throw new RegraException("Essas tropas não carregam nada.");
            var max = m.P.Extracao.MaxTropas;
            if (Extracoes.TropasNaJazida(m, j, r.Id, ex.Id) + GT.Total(ex.Tropas) > max) throw new RegraException($"Até {max} tropas por jazida.");
        }
        public void Chegou(Mundo m, Exercito ex) => Extracoes.Comecar(m, ex);
    }

    /// <summary>Leva a carga extraída ao armazém ou castelo; com "repetir", volta à jazida.</summary>
    public sealed class OrdemEntregarExtracao : IOrdemExercito
    {
        public string Ordem => Extracoes.OrdemEntregar;
        public bool NoEnvio => false;
        public void Chegou(Mundo m, Exercito ex)
        {
            var l = ex.AlvoLocalId is long id ? m.Locais.Obter(id) : null;
            if (!Exercitos.LocalProprio(l, ex.ReinoId) || !Valiosos.Deposito(l!) || l!.Hex != ex.HexEm(m.Agora)) { Extracoes.Entregar(m, ex); return; }
            var r = m.Reinos.Obter(ex.ReinoId);
            if (r != null) Economia.Atualizar(m, r);
            var carga = ex.Carga.Arredondado();
            l.Estoque.Somar(ex.Carga);
            ex.Carga = new();
            m.Sujar(l); m.Sujar(ex);
            var jid = ex.Dados["jazidaId"]?.GetValue<long>();
            var j = jid is long x ? m.Jazidas.Obter(x) : null;
            if (carga.Count > 0)
            {
                var txt = Caravanas.Texto(carga);
                Registros.Relatar(m, ex.ReinoId, "extracao", "Extração entregue", new JsonObject
                {
                    ["resumo"] = GT.Partes(m, ex.Tropas) + " trouxeram " + txt + " para " + l.Nome + ".",
                    ["linhas"] = new JsonArray
                    {
                        new JsonObject { ["rotulo"] = "Carga", ["valor"] = txt },
                        new JsonObject { ["rotulo"] = "Entregue em", ["valor"] = l.Nome },
                        new JsonObject { ["rotulo"] = "Jazida", ["valor"] = j == null ? "—" : j.Restante <= 1e-6 ? "esgotada" : Math.Floor(j.Restante) + " restantes" },
                    },
                    ["hex"] = j?.Hex ?? l.Hex,
                }, "recursos", "Extração: " + txt + " em " + l.Nome);
            }
            var repetir = ex.Dados["repetir"]?.GetValue<bool>() == true;
            if (repetir && j != null && j.Restante > 1e-6 && j.DescobertaPor.Contains(ex.ReinoId) && !Extracoes.OcupadoPorOutro(m, ex.ReinoId, j.Hex))
            {
                try
                {
                    var rota = Exercitos.Rota(m, ex, l.Hex, j.Hex);
                    ex.Ordem = Extracoes.OrdemExtrair; ex.AlvoLocalId = m.LocalNoHex(j.Hex)?.Id; ex.Retornando = false;
                    ex.Partir(m, rota);
                    m.Avisar(ex.ReinoId, "reino");
                    return;
                }
                catch (RegraException) { /* sem caminho: ficam no depósito */ }
            }
            ex.EntrarNoLocal(m, l);
        }
    }
}
