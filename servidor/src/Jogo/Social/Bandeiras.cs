using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Social
{
    /// <summary>
    /// Bandeira num hexágono: sinal social (reivindicação, ameaça, aliança, aviso), sem efeito no jogo. Sempre mostra quem a colocou.
    /// Até <c>P.social.bandeiras.ativas</c> por reino, recado de até <c>P.social.bandeiras.caracteres</c>. Outros reinos a derrubam
    /// com tropas no local (ordem "derrubar-bandeira"); o dono é avisado de quem foi.
    /// </summary>
    public sealed class Bandeira : Documento
    {
        public long ReinoId { get; set; }
        public int Hex { get; set; }
        /// <summary>"reivindicacao", "ameaca", "alianca" ou "aviso".</summary>
        public string Tipo { get; set; } = "aviso";
        public string Recado { get; set; } = "";
        public long Quando { get; set; }
    }

    public static class Bandeiras
    {
        public static readonly string[] Tipos = ["reivindicacao", "ameaca", "alianca", "aviso"];

        public static IEnumerable<Bandeira> De(Mundo m, long reinoId) => m.Bandeiras.Where(b => b.ReinoId == reinoId);

        public static IEnumerable<Bandeira> NoHex(Mundo m, int hex)
        {
            var idx = Indice(m);
            return idx.TryGetValue(hex, out var l) ? l.Select(id => m.Bandeiras.Obter(id)).OfType<Bandeira>().ToList() : [];
        }

        private static Dictionary<int, List<long>> Indice(Mundo m)
        {
            if (m.BandeirasPorHex != null) return m.BandeirasPorHex;
            var d = new Dictionary<int, List<long>>();
            foreach (var b in m.Bandeiras) (d.TryGetValue(b.Hex, out var l) ? l : d[b.Hex] = new()).Add(b.Id);
            return m.BandeirasPorHex = d;
        }

        public static Bandeira Colocar(Mundo m, Reino r, int hex, string? tipo, string? recado)
        {
            if (!m.G.Valido(hex)) throw new RegraException("Hexágono fora do mapa.");
            if (!Nevoas.Explorado(m, r.Id, hex)) throw new RegraException("Explore o lugar antes de pôr uma bandeira.");
            tipo = string.IsNullOrEmpty(tipo) ? "aviso" : tipo;
            if (!Tipos.Contains(tipo)) throw new RegraException("Tipo de bandeira desconhecido.");
            var p = m.P.Social.Bandeiras;
            var txt = Regex.Replace((recado ?? "").Trim(), @"\s+", " ");
            if (txt.Length < p.Minimo || txt.Length > p.Caracteres) throw new RegraException($"O recado precisa ter de {p.Minimo} a {p.Caracteres} caracteres.");
            if (De(m, r.Id).Count() >= p.Ativas) throw new RegraException($"Você já tem {p.Ativas} bandeiras: remova uma antes.");
            if (NoHex(m, hex).Any(b => b.ReinoId == r.Id)) throw new RegraException("Você já tem uma bandeira neste hexágono.");
            var b = m.Bandeiras.Adicionar(new Bandeira { ReinoId = r.Id, Hex = hex, Tipo = tipo, Recado = txt, Quando = m.Agora });
            var idx = Indice(m);
            (idx.TryGetValue(hex, out var l) ? l : idx[hex] = new()).Add(b.Id);
            m.Avisar(r.Id, "mapa");
            return b;
        }

        private static void Tirar(Mundo m, Bandeira b)
        {
            if (Indice(m).TryGetValue(b.Hex, out var l)) l.Remove(b.Id);
            m.Bandeiras.Remover(b);
        }

        public static void Remover(Mundo m, Reino r, long id)
        {
            var b = m.Bandeiras.Obter(id);
            if (b == null || b.ReinoId != r.Id) throw new RegraException("Bandeira não encontrada.", 404);
            Tirar(m, b);
            m.Avisar(r.Id, "mapa");
        }

        /// <summary>Tropas no local derrubam a bandeira; o dono é avisado de quem foi (as marchas têm dono).</summary>
        public static void Derrubar(Mundo m, Exercito ex, Bandeira b)
        {
            var quem = m.Reinos.Obter(ex.ReinoId);
            Tirar(m, b);
            var onde = "hexágono " + m.G.C(b.Hex) + ", " + m.G.L(b.Hex);
            if (m.Reinos.Obter(b.ReinoId) is { } dono)
            {
                var por = quem != null ? "Derrubada por " + quem.Nome + "." : "";
                Registros.Notificar(m, dono.Id, "reino", "Bandeira derrubada", "“" + b.Recado + "” no " + onde + ". " + por, "bandeiras");
                m.Avisar(dono.Id, "mapa");
            }
            m.Avisar(ex.ReinoId, "mapa");
        }

    }

    /// <summary>Ordem "derrubar-bandeira": vai até o hexágono, derruba a bandeira de outro reino (Dados.bandeira, ou todas as alheias) e volta.</summary>
    public sealed class OrdemDerrubarBandeira : IOrdemExercito
    {
        public const string Id = "derrubar-bandeira";
        public string Ordem => Id;

        private static long? Alvo(Exercito ex)
        {
            try { return ex.Dados["bandeira"]?.GetValue<long>(); } catch { return null; }
        }

        public void Validar(Mundo m, Reino r, Exercito ex, int destino)
        {
            var id = Alvo(ex);
            var alheias = Bandeiras.NoHex(m, destino).Where(b => b.ReinoId != r.Id && (id == null || b.Id == id)).ToList();
            if (alheias.Count == 0) throw new RegraException("Não há bandeira de outro reino neste hexágono.");
        }

        public void Chegou(Mundo m, Exercito ex)
        {
            var id = Alvo(ex);
            var alheias = Bandeiras.NoHex(m, ex.Destino).Where(b => b.ReinoId != ex.ReinoId && (id == null || b.Id == id)).ToList();
            foreach (var b in alheias) Bandeiras.Derrubar(m, ex, b);
            Exercitos.Avisar(m, ex, alheias.Count > 0 ? "Bandeira derrubada" : "A bandeira já não estava lá",
                GT.Partes(m, ex.Tropas) + " no hexágono " + m.G.C(ex.Destino) + ", " + m.G.L(ex.Destino) + ". As tropas voltam.");
            ex.Retornar(m);
        }
    }
}

namespace ReinoDePedra.Jogo
{
    using ReinoDePedra.Jogo.Social;
    public sealed partial class Mundo
    {
        public Colecao<Bandeira> Bandeiras { get; } = new("bandeiras");
        /// <summary>Índice das bandeiras por hexágono (montado sob demanda; não é gravado).</summary>
        internal Dictionary<int, List<long>>? BandeirasPorHex { get; set; }
    }
}
