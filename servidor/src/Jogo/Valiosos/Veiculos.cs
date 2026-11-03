using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Jogo.Reinos
{
    public sealed partial class Reino
    {
        /// <summary>Veículos livres no castelo, por tipo de <c>VEICULOS</c> ("carroca", "carrocao"). Os que estão em caravana viajam nela.</summary>
        public Dictionary<string, int> Veiculos { get; set; } = new();
    }
}

namespace ReinoDePedra.Jogo.Valiosos
{
    /// <summary>
    /// Carroças e carroções: construídos com recursos na fila de obras do castelo, onde ficam. Saem com as caravanas
    /// e voltam a ele. O carroção usa cavalos de raça (o custo de <c>VEICULOS</c> já inclui os 2 cavalos).
    /// </summary>
    public static class Veiculos
    {
        public static ItemFila Construir(Mundo m, Reino r, string tipo, int qtd)
        {
            if (tipo == null || !m.B.VEICULOS.TryGetValue(tipo, out var v)) throw new RegraException("Veículo desconhecido.");
            if (qtd < 1) throw new RegraException("Escolha pelo menos 1 veículo.");
            var c = m.Locais.Obter(r.CasteloId);
            if (c == null || c.ReinoId != r.Id || c.Ruina) throw new RegraException("Veículos são feitos no castelo.");
            var custo = new Recursos();
            custo.Somar(v.Custo, qtd);
            return Filas.Enfileirar(m, r, Obras.Fila, new ItemFila
            {
                Tipo = ObraVeiculo.Id, LocalId = c.Id, Hex = c.Hex, Param = tipo, Qtd = qtd,
                Rotulo = $"{qtd} {Nome(tipo, qtd)} · {c.Nome}",
                Custo = custo, DuracaoSeg = m.P.Veiculo.Tempo.GetValueOrDefault(tipo) * qtd,
            });
        }

        public static string Nome(string tipo, int n) => tipo == "carrocao" ? (n == 1 ? "carroção" : "carroções") : (n == 1 ? "carroça" : "carroças");

        public static int Livres(Reino r, string tipo) => r.Veiculos.GetValueOrDefault(tipo);

        /// <summary>Veículos do reino que estão em caravanas agora.</summary>
        public static int EmUso(Mundo m, Reino r, string tipo) =>
            m.Marchas.OfType<Caravana>().Where(c => c.ReinoId == r.Id).Sum(c => c.Veiculos.GetValueOrDefault(tipo));

        /// <summary>"2 carroças, 1 carroção".</summary>
        public static string Partes(IReadOnlyDictionary<string, int> v) =>
            string.Join(", ", v.Where(kv => kv.Value > 0).Select(kv => kv.Value + " " + Nome(kv.Key, kv.Value)));
    }

    /// <summary>Item da fila de obras que faz veículos: Param = tipo, Qtd = quantos. Cada um fica livre no castelo ao ficar pronto.</summary>
    public sealed class ObraVeiculo : ITipoItemPorUnidade
    {
        public const string Id = "veiculo";
        public string Tipo => Id;
        public void Entregar(Mundo m, Reino r, ItemFila item, int n)
        {
            if (n <= 0 || item.Param == null || !m.B.VEICULOS.ContainsKey(item.Param)) return;
            r.Veiculos[item.Param] = r.Veiculos.GetValueOrDefault(item.Param) + n;
            m.Sujar(r);
        }
        public void Concluir(Mundo m, Reino r, ItemFila item) =>
            Registros.Notificar(m, r.Id, "obras", item.Qtd > 1 ? "Veículos prontos" : "Veículo pronto", item.Rotulo, "construcao?aba=transporte");
    }
}
