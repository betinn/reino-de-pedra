namespace ReinoDePedra.Jogo.Social
{
    /// <summary>
    /// Os avisos do centro da tela têm dois tamanhos, no mesmo lugar:
    /// <list type="bullet">
    /// <item><b>grande</b>: ataque, ameaça, batalha, captura, castelo caído, morte, relíquia e temporada. É o anúncio de sempre.</item>
    /// <item><b>pequeno</b>: a notícia do dia a dia (obra pronta, treino pronto, explorador no destino, carga entregue,
    /// conversa, comércio). Menor, mais discreto e mais curto.</item>
    /// </list>
    /// O servidor classifica: a categoria dá o padrão e quem notifica pode dizer o tamanho quando a notícia foge dele.
    /// A <see cref="Prioridade"/> é a ordem na fila do cliente: perigo, depois os grandes, depois os pequenos.
    /// </summary>
    public static class TamanhoAviso
    {
        public const string Grande = "grande", Pequeno = "pequeno";

        /// <summary>A partir de quantos mortos uma batalha de outros reinos é "morte em massa" e vira anúncio grande.</summary>
        public const int MorteEmMassa = 10;

        /// <summary>Categorias em que a notícia é grande por padrão; nas outras, pequena.</summary>
        public static readonly HashSet<string> CategoriasGrandes = new() { "ataques", "batalhas", "temporada" };

        /// <summary>Categorias que anunciam perigo (vão na frente de tudo na fila).</summary>
        public static readonly HashSet<string> CategoriasDePerigo = new() { "ataques" };

        public static bool Valido(string? tamanho) => tamanho is Grande or Pequeno;

        /// <summary>Tamanho padrão de uma notificação pela categoria.</summary>
        public static string DaCategoria(string categoria) => CategoriasGrandes.Contains(categoria) ? Grande : Pequeno;

        /// <summary>Tamanho de uma notificação: o que foi dito por quem notificou, ou o padrão da categoria (notificações antigas, sem tamanho gravado).</summary>
        public static string Da(Notificacao n) => Valido(n.Tamanho) ? n.Tamanho! : DaCategoria(n.Categoria);

        /// <summary>
        /// Tamanho de uma mensagem global: castelo caído e captura são grandes; o fim de uma batalha é grande quando morreu muita
        /// gente; o começo de uma batalha entre outros reinos e as perdas pequenas são notícia pequena.
        /// </summary>
        public static string DaMensagemGlobal(string tipo, int mortos) => tipo switch
        {
            "queda" or "captura" => Grande,
            "fim-batalha" => mortos >= MorteEmMassa ? Grande : Pequeno,
            _ => Pequeno,
        };

        /// <summary>Ordem na fila de anúncios: 0 perigo, 1 grande, 2 pequeno. Menor sai primeiro; empate, o mais antigo.</summary>
        public static int Prioridade(string tamanho, bool perigo) => perigo ? 0 : tamanho == Grande ? 1 : 2;

        public static int Prioridade(Notificacao n) => Prioridade(Da(n), CategoriasDePerigo.Contains(n.Categoria));
    }
}
