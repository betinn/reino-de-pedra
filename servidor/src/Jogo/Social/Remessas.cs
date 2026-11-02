using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.Social
{
    /// <summary>
    /// Carga de um reino para outro (troca, ajuda a aliado, pagamento de pacto ou de resgate): carregadores a pé, sem escolta,
    /// saem dos locais mais próximos do destino. Visível no mapa e roubável no caminho (interceptação). Não ocupa o teto.
    /// </summary>
    public sealed class Remessa : Marcha
    {
        public override string Tipo => "remessa";
        public int Pessoas { get; set; }
        public long ParaReinoId { get; set; }
        /// <summary>Local que recebe; se não for mais do destinatário, a carga vai para o castelo dele.</summary>
        public long? ParaLocalId { get; set; }
        /// <summary>"troca", "pedido", "pacto" ou "resgate".</summary>
        public string Motivo { get; set; } = "";
        /// <summary>Proposta, pacto ou prisioneiro a que a carga pertence.</summary>
        public long RefId { get; set; }
        /// <summary>Outra carga do mesmo envio foi roubada (o pagamento não se completa).</summary>
        public bool Falhou { get; set; }

        public override int PopOcupada(Mundo m) => 0;
        public override double ForcaContraFauna(Mundo m) => Pessoas * m.P.FaunaServ.ForcaCarregador;

        public override void AoSerVencida(Mundo m, Exercito vencedor)
        {
            var perdida = Carga.Copia();
            base.AoSerVencida(m, vencedor);
            Remessas.Roubada(m, this, perdida);
        }

        public override void Chegou(Mundo m)
        {
            Encerrar(m);
            var para = m.Reinos.Obter(ParaReinoId);
            if (para != null && para.Ativo)
            {
                var l = ParaLocalId is long id ? m.Locais.Obter(id) : null;
                if (l == null || l.ReinoId != para.Id || l.Ruina) l = m.Locais.Obter(para.CasteloId);
                if (l != null && l.ReinoId == para.Id)
                {
                    Economia.Atualizar(m, para);
                    l.Estoque.Somar(Carga);
                    m.Sujar(l);
                    m.Avisar(para.Id, "reino");
                }
            }
            Remessas.Entregue(m, this);
        }
    }

    public static class Remessas
    {
        /// <summary>Reação à entrega ou ao roubo por motivo ("pacto": começa ou cancela; "resgate": liberta...).</summary>
        public static Dictionary<string, Action<Mundo, Remessa, bool>> AoTerminar { get; } = new();

        public static IEnumerable<Remessa> Do(Mundo m, string motivo, long refId) =>
            m.Marchas.OfType<Remessa>().Where(x => x.Motivo == motivo && x.RefId == refId);

        /// <summary>Valor de referência de uma carga (P.valor).</summary>
        public static double Valor(Mundo m, IReadOnlyDictionary<string, double> c) => c.Sum(kv => kv.Value * m.P.Valor.GetValueOrDefault(kv.Key, 1));

        public static string Texto(IReadOnlyDictionary<string, double> c) =>
            string.Join(", ", c.Where(kv => kv.Value >= 1).Select(kv => Combate.Combates.Num(kv.Value) + " " + Logistica.NomeRecurso(kv.Key)));

        /// <summary>Lê uma carga pedida pelo jogador: recursos conhecidos, quantidades inteiras de 1 a 10 milhões.</summary>
        public static Recursos Ler(Mundo m, IReadOnlyDictionary<string, double>? c, bool podeVazia = false)
        {
            var r = new Recursos();
            foreach (var (k, v) in c ?? new Dictionary<string, double>())
            {
                if (!m.P.Valor.ContainsKey(k)) throw new RegraException("Recurso desconhecido.");
                if (double.IsNaN(v) || v < 0 || v > 1e7) throw new RegraException("Quantidade inválida.");
                if (v >= 1) r.Somar(k, Math.Floor(v));
            }
            if (r.Count == 0 && !podeVazia) throw new RegraException("Diga quanto de cada recurso.");
            return r;
        }

        /// <summary>Confere que o reino tem a carga (somando todos os locais). Lança "Faltam recursos: ...".</summary>
        public static void Conferir(Mundo m, Reino r, IReadOnlyDictionary<string, double> carga, string? quem = null)
        {
            Economia.Atualizar(m, r);
            var total = Economia.TotalGuardado(m, r);
            var falta = carga.Where(kv => total.Qtd(kv.Key) + 1e-6 < kv.Value)
                .Select(kv => $"{Math.Ceiling(kv.Value - total.Qtd(kv.Key))} {Logistica.NomeRecurso(kv.Key)}").ToList();
            if (falta.Count > 0) throw new RegraException((quem != null ? quem + ": faltam" : "Faltam") + " recursos: " + string.Join(", ", falta) + ".");
        }

        /// <summary>
        /// Manda a carga do reino <paramref name="de"/> para <paramref name="para"/> (no local <paramref name="paraLocal"/>, ou no castelo):
        /// sai dos locais mais próximos do destino, um grupo de carregadores por origem. Lança se faltar recurso.
        /// </summary>
        public static List<Remessa> Enviar(Mundo m, Reino de, Reino para, Local? paraLocal, IReadOnlyDictionary<string, double> carga, string motivo, long refId)
        {
            Conferir(m, de, carga);
            var destino = paraLocal ?? m.Locais.Obter(para.CasteloId) ?? throw new RegraException("O outro reino não tem castelo.");
            var vel = m.P.Carregador.Vel;
            var tempos = Caminhos.MinutosAte(m, destino.Hex, vel);
            var origens = m.LocaisDe(de.Id).Where(l => !l.Ruina && !double.IsInfinity(tempos[l.Hex])).OrderBy(l => tempos[l.Hex]).ToList();
            var faltam = carga.Where(kv => kv.Value > 0).ToDictionary(kv => kv.Key, kv => kv.Value);
            var disponivel = new Recursos();
            foreach (var o in origens) disponivel.Somar(o.Estoque);
            if (faltam.Any(kv => disponivel.Qtd(kv.Key) + 1e-6 < kv.Value)) throw new RegraException("Não há caminho dos seus locais até o destino.");
            var lista = new List<Remessa>();
            foreach (var o in origens)
            {
                if (faltam.Count == 0) break;
                var leva = new Recursos();
                foreach (var k in faltam.Keys.ToList())
                {
                    var tirado = o.Estoque.Retirar(k, faltam[k]);
                    if (tirado <= 0) continue;
                    leva.Somar(k, tirado); faltam[k] -= tirado;
                    if (faltam[k] <= 1e-6) faltam.Remove(k);
                }
                if (leva.Count == 0) continue;
                m.Sujar(o);
                var rem = new Remessa
                {
                    ReinoId = de.Id, Carga = leva, Vel = vel, ParaReinoId = para.Id, ParaLocalId = destino.Id, Motivo = motivo, RefId = refId,
                    Pessoas = (int)Math.Max(1, Math.Ceiling(leva.Total / m.P.Carregador.Carga)),
                };
                rem.Partir(m, Caminhos.Calcular(m, o.Hex, destino.Hex, vel, new OpcoesCaminho { ReinoId = de.Id }));
                lista.Add(rem);
            }
            m.Avisar(de.Id, "reino");
            return lista;
        }

        internal static void Entregue(Mundo m, Remessa r)
        {
            var resto = Do(m, r.Motivo, r.RefId).Any(x => x.Id != r.Id && x.ReinoId == r.ReinoId);
            if (resto || r.Falhou) return;   // o envio só termina com a última carga; se outra foi roubada, já falhou
            if (AoTerminar.TryGetValue(r.Motivo, out var f)) f(m, r, true);
        }

        internal static void Roubada(Mundo m, Remessa r, Recursos perdida)
        {
            var jaFalhou = r.Falhou;
            foreach (var x in Do(m, r.Motivo, r.RefId).Where(x => x.Id != r.Id && x.ReinoId == r.ReinoId)) { x.Falhou = true; m.Sujar(x); }
            Registros.Notificar(m, r.ReinoId, "recursos", "Carga roubada no caminho", Texto(perdida) + " para outro reino.", "comercio");
            Registros.Notificar(m, r.ParaReinoId, "recursos", "Carga roubada no caminho", Texto(perdida) + " não vai chegar.", "comercio");
            if (!jaFalhou && AoTerminar.TryGetValue(r.Motivo, out var f)) f(m, r, false);
        }
    }
}
