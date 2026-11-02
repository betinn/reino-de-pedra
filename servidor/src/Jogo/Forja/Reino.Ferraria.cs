using ReinoDePedra.Jogo.Nucleo;

namespace ReinoDePedra.Jogo.Reinos
{
    public sealed partial class Reino
    {
        /// <summary>Eras pesquisadas: chave de <c>P.eras</c> ("aco", "cerco") → instante. A Era do Ferro é a inicial e não entra aqui.</summary>
        public Dictionary<string, long> Eras { get; set; } = new();
        /// <summary>Nível de armas e armaduras por "familia:linha" (ex.: "arqueiros:armas" → 2). Sem a chave, nível 0.</summary>
        public Dictionary<string, int> Forja { get; set; } = new();
        /// <summary>Equipamentos lendários que o reino forjou ou pôs na fila nesta temporada (o capturado não conta).</summary>
        public int LendariosForjados { get; set; }
    }
}

namespace ReinoDePedra.Jogo.Forja
{
    /// <summary>
    /// Equipamento lendário: +25% de ataque ou de defesa para o grupo que o leva (até 50 tropas; acima, o bônus se dilui).
    /// Fica sempre com um grupo: a guarnição de um local (<see cref="LocalId"/>) ou um exército (<see cref="MarchaId"/>).
    /// Se o grupo perde a batalha, o vencedor leva.
    /// </summary>
    public sealed class EquipamentoLendario : Documento
    {
        /// <summary>Reino que o tem agora (0 = largado numa ruína, sem dono).</summary>
        public long DonoId { get; set; }
        /// <summary>Reino que o forjou (segredo do servidor: o nome não revela a origem).</summary>
        public long ForjadoPor { get; set; }
        /// <summary>"ataque" ou "defesa".</summary>
        public string Tipo { get; set; } = "";
        public string Nome { get; set; } = "";
        public long ForjadoEm { get; set; }
        public long? LocalId { get; set; }
        public long? MarchaId { get; set; }
        /// <summary>Vai com o próximo exército que sair do local onde está.</summary>
        public bool Levar { get; set; }
    }
}

namespace ReinoDePedra.Jogo
{
    public sealed partial class Mundo
    {
        public Colecao<Forja.EquipamentoLendario> Lendarios { get; } = new("lendarios");
    }
}
