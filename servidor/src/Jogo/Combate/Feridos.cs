using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Pessoas;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;
using PS = ReinoDePedra.Jogo.Pessoas.Pessoas;

namespace ReinoDePedra.Jogo.Combate
{
    /// <summary>
    /// Feridos de uma batalha (um lote por batalha e lado): pessoas com nome (<see cref="PessoaIds"/>), em
    /// <see cref="Estados.Ferida"/> no castelo. Ocupam o teto de população e morrem todos juntos em <see cref="MorreEm"/>
    /// (P.feridos.esperaH depois da batalha) se não entrarem na fila de cura antes.
    /// </summary>
    public sealed class LoteFeridos
    {
        public long Id { get; set; }
        public Dictionary<string, int> Unidades { get; set; } = new();
        public List<long> PessoaIds { get; set; } = new();
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

        /// <summary>As pessoas de um lote (as que ainda existem).</summary>
        public static IEnumerable<Pessoa> Do(Mundo m, LoteFeridos lote) => lote.PessoaIds.Select(id => m.Pessoas.Obter(id)).OfType<Pessoa>();

        private static void Receber(Mundo m, Reino r, Dictionary<string, int> unidades, Local? local, List<Pessoa> pessoas)
        {
            // a batalha que acabou agora diz de onde vieram (o combate passa o local de origem do atacante, não o alvo)
            var b = m.Batalhas.Where(x => x.EncerradaEm == m.Agora && (x.AtacanteId == r.Id || x.DefensorId == r.Id)).OrderByDescending(x => x.Id).FirstOrDefault();
            var alvo = b != null ? m.Locais.Obter(b.LocalId) : null;
            var origem = local != null && local.ReinoId != r.Id ? "Reforço em " + local.Nome   // reforço num local de aliado
                : b == null || alvo == null ? "Batalha em campo"
                : b.DefensorId == r.Id ? "Defesa de " + (alvo.ReinoId == r.Id ? alvo.Nome : "um local perdido")
                : "Ataque a " + (alvo.ReinoId == r.Id ? alvo.Nome : Ataques.NomeAlvo(alvo).ToLowerInvariant());
            Adicionar(m, r, unidades, origem, null, pessoas);
        }

        /// <summary>
        /// Novo lote de feridos no castelo; morrem em P.feridos.esperaH sem cura. Sem <paramref name="pessoas"/> (cenários que só
        /// dizem a contagem), as pessoas feridas nascem agora, no castelo.
        /// </summary>
        public static LoteFeridos? Adicionar(Mundo m, Reino r, IReadOnlyDictionary<string, int> unidades, string origem, long? morreEm = null, IEnumerable<Pessoa>? pessoas = null)
        {
            var g = GT.Limpo(unidades);
            if (g.Count == 0) return null;
            Economia.Atualizar(m, r);
            var castelo = m.Locais.Obter(r.CasteloId);
            var lista = (pessoas ?? []).ToList();
            var tem = PS.Contar(m, lista);
            foreach (var (k, n) in g)
                for (var i = tem.GetValueOrDefault(k); i < n; i++)
                    lista.Add(PS.Criar(m, r, castelo, k, Estados.Ferida));
            foreach (var p in lista) { p.Estado = Estados.Ferida; p.GrupoId = null; p.ItemId = null; m.Sujar(p); }
            var lote = new LoteFeridos
            {
                Id = m.NovoId(), Unidades = g, PessoaIds = lista.Select(p => p.Id).ToList(), Desde = m.Agora, Origem = origem,
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
            var pessoas = new List<Pessoa>();
            var resta = podem;
            long morre = long.MaxValue;
            foreach (var l in r.Feridos.OrderBy(x => x.MorreEm).ThenBy(x => x.Id))
            {
                foreach (var p in Do(m, l).OrderBy(p => p.Oficio, StringComparer.Ordinal).ThenBy(p => p.Id))
                {
                    if (resta <= 0) break;
                    leva[p.Oficio] = leva.GetValueOrDefault(p.Oficio) + 1; resta--;
                    pessoas.Add(p);
                    morre = Math.Min(morre, l.MorreEm);
                }
                if (resta <= 0) break;
            }
            var item = Filas.Enfileirar(m, r, Fila, new ItemFila
            {
                Tipo = ItemCurar.Id, LocalId = c.Id, Hex = c.Hex, Qtd = podem, Param = ItemCurar.Escrever(leva, morre, pessoas.Select(p => p.Id)),
                Rotulo = "Cura de " + podem + (podem == 1 ? " ferido" : " feridos"),
                Custo = Recursos.De(new Dictionary<string, double> { ["ervas"] = podem * porFerido }),
                DuracaoSeg = m.P.Feridos.CuraH * 3600,
            });
            foreach (var p in pessoas)
            {
                p.ItemId = item.Id; m.Sujar(p);
                foreach (var l in r.Feridos.Where(l => l.PessoaIds.Remove(p.Id)))
                {
                    var resto = l.Unidades.GetValueOrDefault(p.Oficio) - 1;
                    if (resto > 0) l.Unidades[p.Oficio] = resto; else l.Unidades.Remove(p.Oficio);
                }
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
            var nomes = new List<string>();
            foreach (var p in Feridos.Do(m, lote).ToList()) { nomes.Add(p.Nome); PS.Remover(m, p); }
            m.Sujar(r);
            if (GT.Total(lote.Unidades) > 0)
                Registros.Notificar(m, r.Id, "tropas", "Feridos morreram", GT.Partes(m, lote.Unidades) + " sem ervas raras em " + m.P.Feridos.EsperaH + " h" +
                    (nomes.Count > 0 ? ": " + PS.Nomear(nomes) : "") + ".", "tropas");
            m.Avisar(r.Id, "reino");
        }
    }

    /// <summary>
    /// Item da fila "cura": Param = "unidade:n,...;morreEm;ids" (os feridos tirados dos lotes, quando o primeiro deles morreria e
    /// quem são). Ao terminar, voltam à guarnição do castelo. Cancelado, voltam a esperar (e morrem no prazo antigo).
    /// </summary>
    public sealed class ItemCurar : ITipoItemFila
    {
        public const string Id = "curar";
        public string Tipo => Id;

        public static string Escrever(IReadOnlyDictionary<string, int> g, long morreEm, IEnumerable<long>? ids = null) =>
            string.Join(",", g.Where(kv => kv.Value > 0).Select(kv => kv.Key + ":" + kv.Value)) + ";" + morreEm + ";" + string.Join(",", ids ?? []);

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

        /// <summary>As pessoas do item (as que ainda existem e ainda estão feridas com ele).</summary>
        public static List<Pessoa> Pessoas(Mundo m, ItemFila i)
        {
            var partes = (i.Param ?? "").Split(';');
            var lista = new List<Pessoa>();
            if (partes.Length > 2)
                foreach (var s in partes[2].Split(',', StringSplitOptions.RemoveEmptyEntries))
                    if (long.TryParse(s, out var id) && m.Pessoas.Obter(id) is { } p && p.Estado == Estados.Ferida) lista.Add(p);
            return lista;
        }

        public void Concluir(Mundo m, Reino r, ItemFila item)
        {
            var (g, _) = Ler(item);
            var pessoas = Pessoas(m, item);
            var l = m.Locais.Obter(r.CasteloId);
            if (l == null || l.ReinoId != r.Id || l.Ruina) l = m.LocaisDe(r.Id).FirstOrDefault(x => !x.Ruina);
            if (l == null) { foreach (var p in pessoas) PS.Remover(m, p); return; }   // sem onde ficar
            // quem falta (cenários sem pessoas) nasce agora; depois todos entram na guarnição
            var tem = PS.Contar(m, pessoas);
            foreach (var (k, n) in g) for (var i = tem.GetValueOrDefault(k); i < n; i++) pessoas.Add(PS.Criar(m, r, l, k, Estados.Ferida));
            PS.Curadas(m, pessoas, l);
            Registros.Notificar(m, r.Id, "tropas", "Feridos curados", GT.Partes(m, g) + " de volta à guarnição de " + l.Nome + ".", "tropas");
        }

        public void Cancelado(Mundo m, Reino r, ItemFila item)
        {
            var (g, morre) = Ler(item);
            Feridos.Adicionar(m, r, g, "Cura cancelada", morre > 0 ? morre : null, Pessoas(m, item));
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
