using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Combate
{
    /// <summary>
    /// Feridos de uma batalha (um lote por batalha e lado). Ficam no castelo, ocupam o teto de população e morrem todos
    /// juntos em <see cref="MorreEm"/> (P.feridos.esperaH depois da batalha) se não entrarem na fila de cura antes.
    /// </summary>
    public sealed class LoteFeridos
    {
        public long Id { get; set; }
        public Dictionary<string, int> Unidades { get; set; } = new();
        public long Desde { get; set; }
        public long MorreEm { get; set; }
        /// <summary>De onde vieram ("Defesa de Mina Rubra", "Ataque a uma vila"...), para o jogador.</summary>
        public string Origem { get; set; } = "";
        public long? EventoId { get; set; }
    }

    /// <summary>
    /// Feridos: P.feridos.frac das baixas de quem vence ou recua (o combate entrega em <see cref="Combates.AoFerir"/>).
    /// Cada um é curado no castelo com P.feridos.ervas ervas raras; a cura é um item da fila "cura" (um lote em
    /// P.feridos.curaH), e as ervas vêm pela requisição automática. Sem cura em P.feridos.esperaH, morrem (evento por lote).
    /// </summary>
    public static class Feridos
    {
        public const string Fila = "cura";

        internal static void Registrar()
        {
            Combates.AoFerir.Add(Receber);
            Economia.OcupantesExtras.Add(Ocupando);
        }

        /// <summary>Pessoas feridas (esperando ou em cura): ocupam o teto.</summary>
        public static int Ocupando(Mundo m, Reino r)
        {
            var n = r.Feridos.Sum(l => Economia.PopDeGrupo(m, l.Unidades));
            if (r.Filas.TryGetValue(Fila, out var f))
                foreach (var i in f.Itens.Where(i => i.Tipo == ItemCurar.Id)) n += Economia.PopDeGrupo(m, ItemCurar.Ler(i).unidades);
            return n;
        }

        public static int Total(Reino r) => r.Feridos.Sum(l => GT.Total(l.Unidades));
        public static int EmCura(Reino r) => r.Filas.TryGetValue(Fila, out var f) ? f.Itens.Where(i => i.Tipo == ItemCurar.Id).Sum(i => i.Qtd) : 0;

        private static void Receber(Mundo m, Reino r, Dictionary<string, int> unidades, Local? local)
        {
            // a batalha que acabou agora diz de onde vieram (o combate passa o local de origem do atacante, não o alvo)
            var b = m.Batalhas.Where(x => x.EncerradaEm == m.Agora && (x.AtacanteId == r.Id || x.DefensorId == r.Id)).OrderByDescending(x => x.Id).FirstOrDefault();
            var alvo = b != null ? m.Locais.Obter(b.LocalId) : null;
            var origem = local != null && local.ReinoId != r.Id ? "Reforço em " + local.Nome   // reforço num local de aliado
                : b == null || alvo == null ? "Batalha em campo"
                : b.DefensorId == r.Id ? "Defesa de " + (alvo.ReinoId == r.Id ? alvo.Nome : "um local perdido")
                : "Ataque a " + (alvo.ReinoId == r.Id ? alvo.Nome : Ataques.NomeAlvo(alvo).ToLowerInvariant());
            Adicionar(m, r, unidades, origem);
        }

        /// <summary>Novo lote de feridos no castelo; morrem em P.feridos.esperaH sem cura.</summary>
        public static LoteFeridos? Adicionar(Mundo m, Reino r, IReadOnlyDictionary<string, int> unidades, string origem, long? morreEm = null)
        {
            var g = GT.Limpo(unidades);
            if (g.Count == 0) return null;
            Economia.Atualizar(m, r);
            var lote = new LoteFeridos
            {
                Id = m.NovoId(), Unidades = g, Desde = m.Agora, Origem = origem,
                MorreEm = morreEm ?? m.Agora + T.DeHoras(m.P.Feridos.EsperaH),
            };
            lote.EventoId = m.Agendar(new MorteFeridosEvento { ReinoId = r.Id, LoteId = lote.Id, Quando = Math.Max(m.Agora, lote.MorreEm) }).Id;
            r.Feridos.Add(lote);
            m.Sujar(r);
            m.Avisar(r.Id, "reino");
            return lote;
        }

        /// <summary>Quantos feridos as ervas raras do reino curam agora.</summary>
        public static int Podem(Mundo m, Reino r)
        {
            var ervas = Economia.TotalGuardado(m, r).Qtd("ervas");
            return (int)Math.Min(Total(r), Math.Floor(ervas / m.P.Feridos.Ervas + 1e-9));
        }

        /// <summary>
        /// Põe na fila de cura do castelo até <paramref name="qtd"/> feridos (todos os que as ervas pagam, se null),
        /// primeiro os que morrem antes. As ervas vêm pela requisição automática.
        /// </summary>
        public static ItemFila Curar(Mundo m, Reino r, int? qtd = null)
        {
            Economia.Atualizar(m, r);
            var total = Total(r);
            if (total == 0) throw new RegraException("Não há feridos para curar.");
            var c = m.Locais.Obter(r.CasteloId);
            if (c == null || c.ReinoId != r.Id || c.Ruina) throw new RegraException("Os feridos são curados no castelo.");
            var porFerido = m.P.Feridos.Ervas;
            var podem = Math.Min(Podem(m, r), qtd ?? total);
            if (qtd is int q && q < 1) throw new RegraException("Escolha pelo menos 1 ferido.");
            if (podem <= 0) throw new RegraException("Sem ervas raras: cada ferido pede " + porFerido + ". Extraia ervas no pântano ou troque com outro reino.");
            // escolhe quem sai dos lotes, sem mexer neles ainda (a fila pode recusar)
            var leva = new Dictionary<string, int>();
            var tirar = new List<(LoteFeridos lote, string u, int n)>();
            var resta = podem;
            long morre = long.MaxValue;
            foreach (var l in r.Feridos.OrderBy(x => x.MorreEm).ThenBy(x => x.Id))
            {
                foreach (var (u, n) in l.Unidades.OrderBy(kv => kv.Key, StringComparer.Ordinal))
                {
                    if (resta <= 0) break;
                    var t = Math.Min(n, resta);
                    leva[u] = leva.GetValueOrDefault(u) + t; resta -= t;
                    tirar.Add((l, u, t));
                    morre = Math.Min(morre, l.MorreEm);
                }
                if (resta <= 0) break;
            }
            var item = Filas.Enfileirar(m, r, Fila, new ItemFila
            {
                Tipo = ItemCurar.Id, LocalId = c.Id, Hex = c.Hex, Qtd = podem, Param = ItemCurar.Escrever(leva, morre),
                Rotulo = "Cura de " + podem + (podem == 1 ? " ferido" : " feridos"),
                Custo = Recursos.De(new Dictionary<string, double> { ["ervas"] = podem * porFerido }),
                DuracaoSeg = m.P.Feridos.CuraH * 3600,
            });
            foreach (var (l, u, n) in tirar)
            {
                var resto = l.Unidades.GetValueOrDefault(u) - n;
                if (resto > 0) l.Unidades[u] = resto; else l.Unidades.Remove(u);
            }
            foreach (var l in r.Feridos.Where(x => x.Unidades.Count == 0).ToList()) { m.Cancelar(l.EventoId); r.Feridos.Remove(l); }
            m.Sujar(r);
            m.Avisar(r.Id, "reino");
            return item;
        }
    }

    /// <summary>Os feridos de um lote morrem (ninguém os pôs na fila de cura a tempo).</summary>
    public sealed class MorteFeridosEvento : Evento
    {
        public long ReinoId { get; set; }
        public long LoteId { get; set; }
        public override void Executar(Mundo m)
        {
            var r = m.Reinos.Obter(ReinoId);
            var lote = r?.Feridos.FirstOrDefault(l => l.Id == LoteId);
            if (r == null || lote == null || lote.EventoId != Id) return;
            Economia.Atualizar(m, r);
            r.Feridos.Remove(lote);
            m.Sujar(r);
            if (GT.Total(lote.Unidades) > 0)
                Registros.Notificar(m, r.Id, "tropas", "Feridos morreram", GT.Partes(m, lote.Unidades) + " sem ervas raras em " + m.P.Feridos.EsperaH + " h.", "tropas");
            m.Avisar(r.Id, "reino");
        }
    }

    /// <summary>
    /// Item da fila "cura": Param = "unidade:n,...;morreEm" (os feridos tirados dos lotes e quando o primeiro deles morreria).
    /// Ao terminar, voltam à guarnição do castelo. Cancelado, voltam a esperar (e morrem no prazo antigo).
    /// </summary>
    public sealed class ItemCurar : ITipoItemFila
    {
        public const string Id = "curar";
        public string Tipo => Id;

        public static string Escrever(IReadOnlyDictionary<string, int> g, long morreEm) =>
            string.Join(",", g.Where(kv => kv.Value > 0).Select(kv => kv.Key + ":" + kv.Value)) + ";" + morreEm;

        public static (Dictionary<string, int> unidades, long morreEm) Ler(ItemFila i)
        {
            var g = new Dictionary<string, int>();
            var partes = (i.Param ?? "").Split(';');
            foreach (var p in partes[0].Split(',', StringSplitOptions.RemoveEmptyEntries))
            {
                var kv = p.Split(':');
                if (kv.Length == 2 && int.TryParse(kv[1], out var n) && n > 0) g[kv[0]] = g.GetValueOrDefault(kv[0]) + n;
            }
            var morre = partes.Length > 1 && long.TryParse(partes[1], out var x) ? x : 0;
            return (g, morre);
        }

        public void Concluir(Mundo m, Reino r, ItemFila item)
        {
            var (g, _) = Ler(item);
            var l = m.Locais.Obter(r.CasteloId);
            if (l == null || l.ReinoId != r.Id || l.Ruina) l = m.LocaisDe(r.Id).FirstOrDefault(x => !x.Ruina);
            if (l == null) { r.Pop += Economia.PopDeGrupo(m, g); m.Sujar(r); return; }   // sem onde ficar: voltam à população
            GT.Devolver(m, l, g);
            Registros.Notificar(m, r.Id, "tropas", "Feridos curados", GT.Partes(m, g) + " de volta à guarnição de " + l.Nome + ".", "tropas");
        }

        public void Cancelado(Mundo m, Reino r, ItemFila item)
        {
            var (g, morre) = Ler(item);
            Feridos.Adicionar(m, r, g, "Cura cancelada", morre > 0 ? morre : null);
        }
    }
}

namespace ReinoDePedra.Jogo.Reinos
{
    public sealed partial class Reino
    {
        /// <summary>Feridos esperando cura no castelo (lotes por batalha).</summary>
        public List<Combate.LoteFeridos> Feridos { get; set; } = new();
    }
}
