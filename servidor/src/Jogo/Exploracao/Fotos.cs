using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.Exploracao
{
    /// <summary>
    /// Último estado conhecido de cada hexágono que o reino já viu: o perigo da fauna e os objetos (locais de outros
    /// reinos com tipo e nome genérico, ruínas antigas, torres...). A foto é tirada sempre que o hexágono é visto
    /// (<see cref="Nevoas.Revelar"/>); fora da visão, o mapa mostra a foto com a idade da névoa.
    /// </summary>
    public sealed partial class FotoNevoa : Documento
    {
        public long ReinoId { get; set; }
        /// <summary>Um byte por hexágono: bits 0–1 = nível de perigo (0 nada, 1 baixo, 2 médio, 3 alto); bits 2–4 = animal + 1.</summary>
        public byte[] Perigo { get; set; } = [];
        /// <summary>Objetos vistos por hexágono (só hexágonos com algo).</summary>
        public Dictionary<int, List<JsonObject>> Objetos { get; set; } = new();
    }

    public static class Fotos
    {
        /// <summary>
        /// Sistemas que têm objetos no mapa (torres, bandeiras...) acrescentam aqui o que fica na foto de um hexágono:
        /// (mundo, reino que vê, hexágono) → objetos no formato do mapa (<c>{ "tipo": ..., ... }</c>, sem "hex").
        /// </summary>
        public static List<Func<Mundo, long, int, IEnumerable<JsonObject>>> Fotografos { get; } = new();

        public static FotoNevoa De(Mundo m, long reinoId)
        {
            if (m.IndiceFotos.TryGetValue(reinoId, out var id) && m.FotosDosReinos.Obter(id) is { } f)
            {
                if (f.Perigo.Length != m.G.Total) f.Perigo = new byte[m.G.Total];
                return f;
            }
            foreach (var x in m.FotosDosReinos)
                if (x.ReinoId == reinoId) { m.IndiceFotos[reinoId] = x.Id; return x; }
            var nova = m.FotosDosReinos.Adicionar(new FotoNevoa { ReinoId = reinoId, Perigo = new byte[m.G.Total] });
            m.IndiceFotos[reinoId] = nova.Id;
            return nova;
        }

        /// <summary>Tira a foto dos hexágonos (estado real agora) para o reino.</summary>
        public static void Tirar(Mundo m, long reinoId, IEnumerable<int> hexes)
        {
            if (m.Mapa == null) return;
            var f = De(m, reinoId);
            foreach (var h in hexes)
            {
                var (nivel, rg) = Fauna.PerigoEm(m, h);
                f.Perigo[h] = (byte)(nivel == 0 || rg == null ? 0 : nivel | (Array.IndexOf(Fauna.Animais, rg.Animal) + 1) << 2);
                var objs = Objetos(m, reinoId, h);
                if (objs.Count == 0) f.Objetos.Remove(h); else f.Objetos[h] = objs;
            }
            m.Sujar(f);
        }

        private static List<JsonObject> Objetos(Mundo m, long reinoId, int h)
        {
            var l = new List<JsonObject>();
            var local = m.LocalNoHex(h);
            if (local != null && local.ReinoId != reinoId)
                l.Add(new JsonObject
                {
                    ["tipo"] = "local", ["id"] = local.Id, ["local"] = local.Tipo.Chave(),
                    ["nome"] = local.Ruina ? "Ruína" : local.Tipo.NomeGenerico(),
                    ["dono"] = local.ReinoId == 0 ? "livre" : "desconhecido", ["ruina"] = local.Ruina,
                });
            foreach (var ru in m.Ruinas)
                if (ru.Hex == h) l.Add(new JsonObject { ["tipo"] = "ruina-antiga", ["id"] = ru.Id, ["esgotada"] = ru.Esgotada });
            foreach (var f in Fotografos) l.AddRange(f(m, reinoId, h));
            return l;
        }

        /// <summary>Nível de perigo que o reino conhece no hexágono (0 a 3).</summary>
        public static int PerigoConhecido(Mundo m, long reinoId, int h)
        {
            var f = De(m, reinoId);
            return h < f.Perigo.Length ? f.Perigo[h] & 3 : 0;
        }
        /// <summary>Animal que o reino viu no hexágono, ou null.</summary>
        public static string? AnimalConhecido(Mundo m, long reinoId, int h)
        {
            var f = De(m, reinoId);
            var a = h < f.Perigo.Length ? (f.Perigo[h] >> 2) - 1 : -1;
            return a >= 0 && a < Fauna.Animais.Length ? Fauna.Animais[a] : null;
        }
    }
}

namespace ReinoDePedra.Jogo
{
    using ReinoDePedra.Jogo.Exploracao;
    public sealed partial class Mundo
    {
        public Colecao<FotoNevoa> FotosDosReinos { get; } = new("fotos");
        internal Dictionary<long, long> IndiceFotos { get; } = new();
    }
}
