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
