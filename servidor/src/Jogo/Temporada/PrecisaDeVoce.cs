using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Exploracao;
using Feridos = ReinoDePedra.Jogo.Combate.Feridos;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using ReinoDePedra.Jogo.Valiosos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Temporada
{
    /// <summary>Um item do "precisa de você": grupo ("urgente", "oportunidade", "reino"), texto curto e um botão.</summary>
    public sealed record ItemAgora(string Grupo, string Icone, string Titulo, string Texto, string Href, string Botao, long? Fim = null);

    /// <summary>
    /// "Precisa de você" (CLAUDE.md, Experiência do jogador): o que pede atenção, as oportunidades à vista e como anda o reino.
    /// Sem obrigação nem recompensa. Calculado sob demanda (GET /agora), só com o que o reino pode saber.
    /// Outros sistemas acrescentam itens em <see cref="Extras"/>.
    /// </summary>
    public static class PrecisaDeVoce
    {
        public const string Urgente = "urgente", Oportunidade = "oportunidade", NoReino = "reino";

        /// <summary>Itens de outros sistemas (IA, regência...).</summary>
        public static List<Func<Mundo, Reino, IEnumerable<ItemAgora>>> Extras { get; } = new();

        public static List<ItemAgora> Listar(Mundo m, Reino r)
        {
            Economia.Atualizar(m, r);
            var L = new List<ItemAgora>();
            var A = m.P.AgoraServ;
            var max = Math.Max(1, A.MaxPorTipo);
            var agora = m.Agora;
            var meus = m.LocaisDe(r.Id).ToList();
            var ids = meus.Select(l => l.Id).ToHashSet();

            // ---------------- ameaças
            foreach (var b in Batalhas.DoReino(m, r.Id).Where(b => !b.Encerrada))
            {
                var l = m.Locais.Obter(b.LocalId);
                var nome = l == null ? "um local" : l.ReinoId == r.Id ? l.Nome : "local atacado";
                L.Add(new(Urgente, "espada", "Batalha em " + nome, "Termina em", "#/batalha?id=" + b.Id, "Acompanhar", b.Fim));
            }
            var vis = Nevoas.VisiveisAgora(m, r.Id);
            foreach (var ex in m.Marchas.OfType<Exercito>())
            {
                if (ex.ReinoId == r.Id || ex.Retornando || !Batalhas.EhAtaque(ex) || ex.AlvoLocalId is not long alvo || !ids.Contains(alvo)) continue;
                if (ex.Chegada <= agora || !vis.Contains(ex.HexEm(agora))) continue;   // só o que o reino vê agora
                var l = m.Locais.Obter(alvo)!;
                var quem = ex.Estandarte && m.Reinos.Obter(ex.ReinoId) is { } atk ? "Reino de " + atk.Nome : "Forças desconhecidas";
                L.Add(new(Urgente, "alerta", "Ataque a caminho: " + l.Nome, quem + " · " + Combate.Avistamentos.Aproximado(m, GT.Total(ex.Tropas)) + " tropas · chegam em",
                    "#/mapa?foco=" + l.Hex, "Ver", ex.Chegada));
            }
            if (r.Feridos.Count > 0)
            {
                var n = Feridos.Total(r);
                var morre = r.Feridos.Min(x => x.MorreEm);
                var urg = morre - agora < T.DeHoras(A.FeridosUrgenteH);
                L.Add(new(urg ? Urgente : NoReino, "ferido", n + (n == 1 ? " ferido esperando ervas" : " feridos esperando ervas"),
                    "Os primeiros morrem em", "#/tropas", "Curar", morre));
            }
            if (r.EscudoAte > agora && r.EscudoAte - agora < T.DeHoras(A.EscudoH))
                L.Add(new(Urgente, "escudo", "Escudo acabando", "Seus locais ficam expostos em", "#/construcao?aba=defesas", "Defesas", r.EscudoAte));

            // ---------------- oportunidades
            foreach (var p in Capturas.PresosPor(m, r.Id).Where(p => p.Estado == Capturas.Preso).OrderBy(p => p.Ate).Take(max))
                L.Add(new(Oportunidade, "batedor", "Explorador capturado", "Peça resgate, liberte ou execute. Sem decisão, é libertado em", "#/exploradores", "Decidir", p.Ate));
            foreach (var p in Comercio.Abertas(m, r.Id).OrderBy(p => p.Ate).Take(max))
            {
                var t = p.Tipo == Comercio.Pedido ? "Pedido de recursos de um aliado" : p.Tipo == Comercio.PactoT ? "Proposta de pacto" : "Proposta de troca";
                L.Add(new(Oportunidade, p.Tipo == Comercio.Pedido ? "estandarte" : "troca", t, "Expira em", p.Tipo == Comercio.Pedido ? "#/alianca" : "#/comercio", "Responder", p.Ate));
            }
            foreach (var (a, c) in Aliancas.ConvitesPara(m, r.Id).Take(max))
                L.Add(new(Oportunidade, "estandarte", "Convite da aliança " + a.Nome, "Expira em", "#/alianca", "Responder", c.Ate));
            var trabalhando = m.Marchas.Where(x => x.ReinoId == r.Id).ToList();
            foreach (var j in m.Jazidas.Where(j => j.Restante > 0 && j.DescobertaPor.Contains(r.Id)
                         && !trabalhando.Any(x => x.ExtraiJazidaId == j.Id) && !Extracoes.TemPosto(m, r.Id, j.Hex) && !Extracoes.OcupadoPorOutro(m, r.Id, j.Hex))
                     .OrderBy(j => meus.Count == 0 ? 0 : meus.Min(l => m.G.Distancia(l.Hex, j.Hex))).Take(max))
                L.Add(new(Oportunidade, "picareta", "Jazida de " + NomeRecurso(j.Recurso) + " sem extração", "Descoberta e livre · ninguém seu extraindo",
                    "#/extracao?jazida=" + j.Id, "Extrair"));
            foreach (var ru in m.Ruinas.Where(x => !x.Esgotada && Nevoas.Explorado(m, r.Id, x.Hex) && !trabalhando.Any(t => t.EscavaRuinaId == x.Id)
                         && !Extracoes.OcupadoPorOutro(m, r.Id, x.Hex))
                     .OrderBy(x => meus.Count == 0 ? 0 : meus.Min(l => m.G.Distancia(l.Hex, x.Hex))).Take(max))
                L.Add(new(Oportunidade, "ruina", "Ruína antiga avistada", "Guarda uma relíquia lendária · ninguém seu escavando", "#/mapa?foco=" + ru.Hex, "Ver"));

            // ---------------- no seu reino
            var obras = r.Fila(Obras.Fila).Itens;
            if (obras.Count == 0) L.Add(new(NoReino, "martelo", "Nenhuma obra na fila", "O reino pode crescer enquanto você está fora.", "#/construcao", "Construir"));
            else if (!obras.Any(i => i.Iniciado))
                L.Add(new(NoReino, "carroca", obras.Count == 1 ? "Obra esperando material" : obras.Count + " obras esperando material",
                    "A fila só anda quando o material chega.", "#/construcao", "Ver"));
            var rec = r.Fila(Recrutamento.Fila).Itens;
            if (rec.Count == 0) L.Add(new(NoReino, "tropas", "Nada sendo recrutado", "A fila aceita até " + Fila.Maximo + " itens.", "#/recrutamento", "Recrutar"));
            else if (!rec.Any(i => i.Iniciado))
                L.Add(new(NoReino, "carroca", "Recrutamento esperando material", "A fila só anda quando o material chega.", "#/recrutamento", "Ver"));
            var teto = Economia.Teto(m, r);
            if (teto > 0 && r.Pop + Economia.Tropas(m, r) >= teto * A.PopTeto)
                L.Add(new(NoReino, "populacao", "População no teto", "Sem moradias novas, o reino não cresce.", "#/construcao?aba=populacao", "Moradia"));
            foreach (var l in meus.Where(l => !l.Ruina && l.EhProducao && l.Produz != null
                         && l.Estoque.Qtd(l.Produz) >= Economia.Capacidade(m, l, l.Produz) * A.EstoqueCheio && Economia.Capacidade(m, l, l.Produz) > 0).Take(max))
                L.Add(new(NoReino, l.Produz!, "Estoque cheio: " + l.Nome, "O excedente vai ao armazém; sem espaço, se perde.", "#/caravana?de=" + l.Id, "Transportar"));
            foreach (var l in meus.Where(l => !l.Ruina && l.Tipo == TipoLocal.Armazem).Take(max))
            {
                var cap = Economia.Capacidade(m, l, "madeira");
                var cheio = Config.Formulas.Basicos.Any(k => l.Estoque.Qtd(k) >= cap * A.Armazem);
                if (cheio) L.Add(new(NoReino, "armazem", "Armazém quase cheio: " + l.Nome, "Melhore o armazém ou use os recursos.", "#/reino?local=" + l.Id, "Ver"));
            }
            var paradas = meus.Sum(l => GT.Total(l.Guarnicao));
            if (paradas > 0 && !Exercitos.De(m, r.Id).Any())
                L.Add(new(NoReino, "tropas", paradas + (paradas == 1 ? " tropa nas guarnições" : " tropas nas guarnições"), "Defendem os locais; podem receber outra ordem.", "#/tropas", "Ordens"));
            foreach (var f in Extras) L.AddRange(f(m, r));
            return L;
        }

        /// <summary>Os mais urgentes primeiro (urgente, oportunidade, reino; dentro do grupo, o que vence antes).</summary>
        public static List<ItemAgora> Resumo(List<ItemAgora> l, int n) =>
            l.OrderBy(x => x.Grupo == Urgente ? 0 : x.Grupo == Oportunidade ? 1 : 2).ThenBy(x => x.Fim ?? long.MaxValue).Take(n).ToList();

        public static string NomeRecurso(string k) => k switch
        {
            "aco" => "aço", "ouro" => "ouro", "prata" => "prata", "sal" => "sal", "ervas" => "ervas raras", "gema" => "pedras preciosas",
            "cavalo" => "cavalos de raça", "minerio" => "minério raro", _ => k,
        };
    }
}
