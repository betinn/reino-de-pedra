using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.Exploracao
{
    /// <summary>
    /// Névoa de um reino: para cada hexágono, quando foi visto pela última vez
    /// (minutos desde o início da temporada + 1; 0 = nunca). A informação de áreas não vistas agora envelhece.
    /// </summary>
    public sealed partial class Nevoa : Documento
    {
        public long ReinoId { get; set; }
        /// <summary>Um int por hexágono (na memória).</summary>
        [System.Text.Json.Serialization.JsonIgnore] public byte[] Visto { get; set; } = [];
        /// <summary>
        /// O vetor <see cref="Visto"/> gravado comprimido (deflate, base64): com o mapa de 312 × 240 são 300 KB por reino, quase
        /// todos zeros no começo da temporada; comprimido, poucos KB.
        /// </summary>
        public string VistoZ { get => Comprimir(Visto); set => Visto = Descomprimir(value); }

        private static string Comprimir(byte[] dados)
        {
            using var ms = new MemoryStream();
            using (var z = new System.IO.Compression.DeflateStream(ms, System.IO.Compression.CompressionLevel.Fastest)) z.Write(dados);
            return Convert.ToBase64String(ms.ToArray());
        }
        private static byte[] Descomprimir(string? b64)
        {
            if (string.IsNullOrEmpty(b64)) return [];
            using var z = new System.IO.Compression.DeflateStream(new MemoryStream(Convert.FromBase64String(b64)), System.IO.Compression.CompressionMode.Decompress);
            using var ms = new MemoryStream();
            z.CopyTo(ms);
            return ms.ToArray();
        }

        public int MinutoVisto(int h) => Visto.Length >= (h + 1) * 4 ? BitConverter.ToInt32(Visto, h * 4) : 0;
        /// <summary>Banco de um mapa menor (tamanho mudou no balanceamento): o vetor cresce em vez de estourar.</summary>
        public void Marcar(int h, int minuto)
        {
            if (Visto.Length < (h + 1) * 4) { var v = Visto; Array.Resize(ref v, (h + 1) * 4); Visto = v; }
            BitConverter.TryWriteBytes(Visto.AsSpan(h * 4, 4), minuto);
        }
    }

    public static class Nevoas
    {
        public static Nevoa De(Mundo m, long reinoId)
        {
            if (m.IndiceNevoa.TryGetValue(reinoId, out var id) && m.NevoasDosReinos.Obter(id) is { } n) return n;
            var nova = m.NevoasDosReinos.Adicionar(new Nevoa { ReinoId = reinoId, Visto = new byte[m.G.Total * 4] });
            m.IndiceNevoa[reinoId] = nova.Id;
            return nova;
        }

        /// <summary>Minuto da temporada (≥ 1) correspondente a um instante.</summary>
        public static int Minuto(Mundo m, long t) => (int)Math.Max(1, (t - m.Estado.InicioTemporada) / T.Min + 1);
        public static long Instante(Mundo m, int minuto) => m.Estado.InicioTemporada + (minuto - 1) * T.Min;

        public static bool Explorado(Mundo m, long reinoId, int h) => De(m, reinoId).MinutoVisto(h) > 0;

        /// <summary>
        /// Marca os hexágonos como vistos no instante <paramref name="quando"/> (padrão: agora) e tira a foto deles
        /// (último estado conhecido: perigo da fauna e objetos). Nunca "desvê": só avança o minuto.
        /// </summary>
        public static void Revelar(Mundo m, long reinoId, IEnumerable<int> hexes, long? quando = null)
        {
            var n = De(m, reinoId);
            var min = Minuto(m, quando ?? m.Agora);
            List<int>? mudados = null;
            foreach (var h in hexes)
                if (n.MinutoVisto(h) < min) { n.Marcar(h, min); (mudados ??= new()).Add(h); }
            if (mudados == null) return;
            m.Sujar(n);
            Fotos.Tirar(m, reinoId, mudados);
        }
        public static void RevelarArea(Mundo m, long reinoId, int centro, int raio, long? quando = null) =>
            Revelar(m, reinoId, m.G.Area(centro, raio), quando);

        /// <summary>Raio de visão de um local do reino.</summary>
        public static int RaioLocal(Mundo m, Local l) => l.Tipo == TipoLocal.Castelo ? m.P.Visao.Castelo : m.P.Visao.Local;

        /// <summary>Fontes extras de visão (torres, exploradores...): (reino, hexes visíveis agora).</summary>
        public static List<Func<Mundo, long, IEnumerable<int>>> FontesDeVisao { get; } = new();

        /// <summary>Hexágonos que o reino vê agora (locais, marchas e fontes extras). Marca-os como vistos.</summary>
        public static HashSet<int> VisiveisAgora(Mundo m, long reinoId)
        {
            var vis = new HashSet<int>();
            foreach (var l in m.LocaisDe(reinoId))
                foreach (var h in m.G.Area(l.Hex, RaioLocal(m, l))) vis.Add(h);
            var agora = m.Agora;
            foreach (var mc in m.Marchas)
            {
                if (mc.ReinoId != reinoId) continue;
                mc.RevelarPercorrido(m, agora);   // o que a marcha viu no caminho desde a última consulta
                foreach (var h in m.G.Area(mc.HexEm(agora), mc.RaioVisao(m))) vis.Add(h);
            }
            foreach (var f in FontesDeVisao)
                foreach (var h in f(m, reinoId)) vis.Add(h);
            Revelar(m, reinoId, vis, agora);
            return vis;
        }
    }
}

namespace ReinoDePedra.Jogo
{
    using ReinoDePedra.Jogo.Exploracao;
    public sealed partial class Mundo
    {
        public Colecao<Nevoa> NevoasDosReinos { get; } = new("nevoas");
        internal Dictionary<long, long> IndiceNevoa { get; } = new();
    }
}

namespace ReinoDePedra.Jogo.Marchas
{
    public abstract partial class Marcha
    {
        /// <summary>Raio de visão da marcha (exploradores enxergam mais).</summary>
        public virtual int RaioVisao(Mundo m) => m.P.Visao.Tropa;
    }
}
