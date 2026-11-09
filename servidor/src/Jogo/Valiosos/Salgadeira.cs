using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Jogo.Reinos
{
    public sealed partial class Local
    {
        /// <summary>Salgadeira (obra com sal): o local de comida guarda <c>P.salgadeira.horas</c> de produção em vez de <c>P.estoqueHoras</c>.</summary>
        public bool Salgadeira { get; set; }
    }
}

namespace ReinoDePedra.Jogo.Valiosos
{
    /// <summary>Salgadeira: obra num local de comida (vila ou pasto) que dobra o estoque de comida (gancho <see cref="Economia.HorasDeEstoque"/>).</summary>
    [Sistema]
    public static class Salgadeiras
    {
        public static void AoIniciar(Mundo m) => Sistemas.UmaVez("salgadeira", () =>
        {
            Economia.HorasDeEstoque.Add(Horas);
        });

        /// <summary>Horas de estoque que a salgadeira dá ao local (0 sem ela).</summary>
        public static double Horas(Mundo m, Local l) => l.Salgadeira && l.Produz == "comida" ? m.P.Salgadeira.Horas : 0;

        public static bool Serve(Local l) => !l.Ruina && l.Produz == "comida" && l.Tipo is TipoLocal.Vila or TipoLocal.Pasto;

        /// <summary>Motivo para não construir a salgadeira neste local, ou null.</summary>
        public static string? Motivo(Mundo m, Reino r, Local l)
        {
            if (l.ReinoId != r.Id) return "Local não é seu.";
            if (!Serve(l)) return "A salgadeira fica num local de comida (vila ou pasto).";
            if (l.Salgadeira) return "Este local já tem salgadeira.";
            if (r.Fila(Obras.Fila).Itens.Any(i => i.Tipo == ObraSalgadeira.Id && i.LocalId == l.Id)) return "Já há uma salgadeira na fila para este local.";
            return null;
        }

        public static ItemFila Construir(Mundo m, Reino r, long localId)
        {
            var l = m.Locais.Obter(localId);
            if (l == null || l.ReinoId != r.Id) throw new RegraException("Local não é seu.", 404);
            var motivo = Motivo(m, r, l);
            if (motivo != null) throw new RegraException(motivo);
            return Filas.Enfileirar(m, r, Obras.Fila, new ItemFila
            {
                Tipo = ObraSalgadeira.Id, LocalId = l.Id, Hex = l.Hex, Rotulo = "Salgadeira em " + l.Nome,
                Custo = Recursos.De(m.P.Salgadeira.Custo), DuracaoSeg = m.P.Salgadeira.Tempo,
            });
        }
    }

    public sealed class ObraSalgadeira : ITipoItemFila
    {
        public const string Id = "salgadeira";
        public string Tipo => Id;
        public string? Revisar(Mundo m, Reino r, ItemFila item) =>
            item.LocalId is long id && m.Locais.Obter(id) is { } l && Salgadeiras.Serve(l) ? null : "o local não serve mais para a salgadeira.";
        public void Concluir(Mundo m, Reino r, ItemFila item)
        {
            var l = item.LocalId is long id ? m.Locais.Obter(id) : null;
            if (l == null || l.ReinoId != r.Id || !Salgadeiras.Serve(l))
            {
                // o local caiu antes: o material volta ao castelo
                var c = m.Locais.Obter(r.CasteloId);
                if (c != null) { c.Estoque.Somar(item.Entregue); m.Sujar(c); }
                return;
            }
            l.Salgadeira = true;
            m.Sujar(l);
            Registros.Notificar(m, r.Id, "obras", "Obra concluída", item.Rotulo + ": guarda " + m.P.Salgadeira.Horas + " h de comida.", "reino");
        }
    }
}
