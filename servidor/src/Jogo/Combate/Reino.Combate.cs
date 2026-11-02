namespace ReinoDePedra.Jogo.Reinos
{
    public sealed partial class Reino
    {
        /// <summary>Saques vitoriosos recentes deste reino (para o rendimento decrescente ao mesmo alvo).</summary>
        public List<Combate.RegistroSaque> Saques { get; set; } = new();
    }
}

namespace ReinoDePedra.Jogo.Marchas
{
    public abstract partial class Marcha
    {
        /// <summary>Evento de avistamento agendado para esta marcha (ataque visto pelo defensor no caminho).</summary>
        public long? AvistamentoId { get; set; }
        /// <summary>Batalha em que a marcha está (exército parado no alvo).</summary>
        public long? BatalhaId { get; set; }
    }
}

namespace ReinoDePedra.Jogo.Combate
{
    public sealed class RegistroSaque
    {
        public long LocalId { get; set; }
        public long Quando { get; set; }
    }
}
