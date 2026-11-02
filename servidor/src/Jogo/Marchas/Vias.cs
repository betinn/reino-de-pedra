using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;

namespace ReinoDePedra.Jogo.Marchas
{
    /// <summary>Rotas públicas e pontes construídas no mapa (documento único). Qualquer reino usa.</summary>
    public sealed class MalhaViaria : Documento
    {
        public HashSet<int> Rotas { get; set; } = new();
        public HashSet<int> Pontes { get; set; } = new();
    }
}

namespace ReinoDePedra.Jogo
{
    public sealed partial class Mundo
    {
        public Colecao<MalhaViaria> MalhasViarias { get; } = new("vias");
        /// <summary>Rotas e pontes do mundo.</summary>
        public MalhaViaria Vias
        {
            get
            {
                foreach (var v in MalhasViarias) return v;
                return MalhasViarias.Adicionar(new MalhaViaria());
            }
        }
    }
}
