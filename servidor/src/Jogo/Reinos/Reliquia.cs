using ReinoDePedra.Jogo.Nucleo;

namespace ReinoDePedra.Jogo.Reinos
{
    /// <summary>
    /// Relíquia lendária (uma por reino no mundo, escavada nas ruínas antigas). Fica guardada num local
    /// (<see cref="LocalId"/>) ou é carregada por uma marcha (<see cref="MarchaId"/>, e o id fica em Marcha.Reliquias).
    /// Nunca se move sozinha. Saque, ocupação e cerco vitoriosos a levam; sabotagem e massacre, não.
    /// </summary>
    public sealed partial class Reliquia : Documento
    {
        public string Nome { get; set; } = "";
        /// <summary>"ataque", "producao" ou "resistencia".</summary>
        public string Tipo { get; set; } = "";
        /// <summary>Reino que a tem (0 = ninguém, ex.: largada).</summary>
        public long ReinoId { get; set; }
        public long? LocalId { get; set; }
        public long? MarchaId { get; set; }
        /// <summary>Ruína de onde saiu.</summary>
        public long RuinaId { get; set; }
        public long AchadaEm { get; set; }
    }

    public static class Reliquias
    {
        /// <summary>Relíquias guardadas num local (fortalecem esse local).</summary>
        public static IEnumerable<Reliquia> NoLocal(Mundo m, long localId) => m.Reliquias.Where(r => r.LocalId == localId);
        public static IEnumerable<Reliquia> DoReino(Mundo m, long reinoId) => m.Reliquias.Where(r => r.ReinoId == reinoId);

        /// <summary>Passa a relíquia para uma marcha (deixa o local).</summary>
        public static void Carregar(Mundo m, Reliquia r, Marchas.Marcha mc)
        {
            r.LocalId = null; r.MarchaId = mc.Id; r.ReinoId = mc.ReinoId;
            if (!mc.Reliquias.Contains(r.Id)) mc.Reliquias.Add(r.Id);
            m.Sujar(r); m.Sujar(mc);
        }
        /// <summary>Guarda a relíquia num local (sai da marcha, se estava numa).</summary>
        public static void Guardar(Mundo m, Reliquia r, Local l)
        {
            if (r.MarchaId is long mid && m.Marchas.Obter(mid) is { } mc) { mc.Reliquias.Remove(r.Id); m.Sujar(mc); }
            r.MarchaId = null; r.LocalId = l.Id; r.ReinoId = l.ReinoId;
            m.Sujar(r);
        }
    }
}

namespace ReinoDePedra.Jogo
{
    public sealed partial class Mundo
    {
        public Colecao<Reinos.Reliquia> Reliquias { get; } = new("reliquias");
    }
}
