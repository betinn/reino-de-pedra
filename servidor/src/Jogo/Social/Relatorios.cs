using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.Social
{
    /// <summary>
    /// Relatório guardado para um reino (ataque, defesa, exploração, espionagem, caça, extração...).
    /// <see cref="Dados"/> é livre por tipo; o cliente tem um desenho padrão (resumo + linhas) e desenhos próprios por tipo.
    /// Formato padrão de Dados: { "resumo": "...", "linhas": [ { "rotulo": "...", "valor": "..." } ], "hex": 123 }.
    /// </summary>
    public sealed class Relatorio : Documento
    {
        public long ReinoId { get; set; }
        public string Tipo { get; set; } = "";
        public string Titulo { get; set; } = "";
        public long Quando { get; set; }
        public bool Lido { get; set; }
        public JsonObject Dados { get; set; } = new();
    }

    /// <summary>Notificação curta, por categoria (o jogador liga e desliga cada uma; não há horário de silêncio).</summary>
    public sealed class Notificacao : Documento
    {
        public long ReinoId { get; set; }
        public string Categoria { get; set; } = "";
        public string Titulo { get; set; } = "";
        public string? Texto { get; set; }
        /// <summary>Rota do cliente para abrir (ex.: "relatorio?id=12").</summary>
        public string? Link { get; set; }
        public long Quando { get; set; }
        public bool Lida { get; set; }
        /// <summary>"grande" ou "pequeno" (ver <see cref="TamanhoAviso"/>); vazio nas notificações antigas: vale o padrão da categoria.</summary>
        public string? Tamanho { get; set; }
        /// <summary>O que dá para responder no próprio aviso, sem abrir tela: { tipo: "convite-alianca" | "pedido-entrada", id }.</summary>
        public JsonObject? Acao { get; set; }
    }

    public static class Registros
    {
        public const int MaxRelatorios = 300, MaxNotificacoes = 200;

        /// <summary>Categorias de notificação (todas ligadas por padrão).</summary>
        public static readonly Dictionary<string, string> Categorias = new()
        {
            ["ataques"] = "Ataques e ameaças", ["batalhas"] = "Batalhas e relatórios de combate", ["obras"] = "Obras e filas",
            ["tropas"] = "Tropas, recrutamento e marchas", ["exploracao"] = "Exploração, fauna e caça", ["recursos"] = "Recursos, extração e caravanas",
            ["reliquias"] = "Relíquias", ["alianca"] = "Aliança (convites, cargos, menções)", ["conversa"] = "Conversa da aliança (fala nova)",
            ["comercio"] = "Comércio e diplomacia", ["mensagens"] = "Mensagens",
            ["reino"] = "Reino (população, escudo, regência)", ["temporada"] = "Temporada e legado",
        };

        public static Relatorio Relatar(Mundo m, long reinoId, string tipo, string titulo, JsonObject? dados = null, string? categoria = null, string? notificacao = null, string? tamanho = null)
        {
            var r = m.Relatorios.Adicionar(new Relatorio { ReinoId = reinoId, Tipo = tipo, Titulo = titulo, Quando = m.Agora, Dados = dados ?? new() });
            Podar(m, m.Relatorios.Where(x => x.ReinoId == reinoId), MaxRelatorios, d => m.Relatorios.Remover(d.Id));
            m.Avisar(reinoId, "relatorio", new { id = r.Id, tipo, titulo });
            if (categoria != null) Notificar(m, reinoId, categoria, notificacao ?? titulo, null, "relatorio?id=" + r.Id, tamanho);
            return r;
        }

        /// <param name="tamanho">"grande" ou "pequeno" quando a notícia foge do padrão da categoria (ver <see cref="TamanhoAviso"/>).</param>
        public static Notificacao? Notificar(Mundo m, long reinoId, string categoria, string titulo, string? texto = null, string? link = null, string? tamanho = null, JsonObject? acao = null)
        {
            var reino = m.Reinos.Obter(reinoId);
            if (reino == null) return null;
            var tam = TamanhoAviso.Valido(tamanho) ? tamanho! : TamanhoAviso.DaCategoria(categoria);
            var n = m.Notificacoes.Adicionar(new Notificacao { ReinoId = reinoId, Categoria = categoria, Titulo = titulo, Texto = texto, Link = link, Quando = m.Agora, Tamanho = tam, Acao = acao });
            Podar(m, m.Notificacoes.Where(x => x.ReinoId == reinoId), MaxNotificacoes, d => m.Notificacoes.Remover(d.Id));
            // a preferência decide se o aviso "toca" (push/aviso do navegador); a notificação fica na lista de qualquer jeito
            var ligada = !reino.NotificacoesDesligadas.Contains(categoria);
            m.Avisar(reinoId, "notificacao", new { id = n.Id, categoria, titulo, texto, link, tocar = ligada, tamanho = tam, prioridade = TamanhoAviso.Prioridade(n), acao });
            return n;
        }

        private static void Podar<T>(Mundo m, IEnumerable<T> itens, int max, Action<T> remover) where T : Documento
        {
            var l = itens.ToList();
            if (l.Count <= max) return;
            foreach (var x in l.OrderBy(x => x.Id).Take(l.Count - max)) remover(x);
        }
    }
}

namespace ReinoDePedra.Jogo
{
    using ReinoDePedra.Jogo.Social;
    public sealed partial class Mundo
    {
        public Colecao<Relatorio> Relatorios { get; } = new("relatorios");
        public Colecao<Notificacao> Notificacoes { get; } = new("notificacoes");
    }
}

namespace ReinoDePedra.Jogo.Reinos
{
    public sealed partial class Reino
    {
        /// <summary>Categorias de notificação que o jogador desligou.</summary>
        public HashSet<string> NotificacoesDesligadas { get; set; } = new();
    }
}

namespace ReinoDePedra.Jogo.Social
{
    using ReinoDePedra.Jogo.Reinos;

    /// <summary>Notificações gerais do reino (fim de obra...).</summary>
    [Sistema]
    public static class NotificacoesDoReino
    {
        public static void AoIniciar(Mundo m) => Sistemas.UmaVez("notificacoes-obras", () =>
        {
            Filas.AoConcluir += (mm, r, item) =>
            {
                if (item.Tipo is ObraNivel.Id or ObraMoradia.Id or ObraFundar.Id)
                    Registros.Notificar(mm, r.Id, "obras", "Obra concluída", item.Rotulo, "reino");
            };
        });
    }
}
