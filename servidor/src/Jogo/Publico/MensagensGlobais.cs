using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Publico
{
    /// <summary>Mensagem do servidor para o mundo inteiro: só o que já é público (dono, local, perdas de quem lutou, nomes dos mortos).</summary>
    public sealed class MensagemGlobal : Documento
    {
        public long Quando { get; set; }
        /// <summary>"batalha", "fim-batalha", "captura" ou "queda".</summary>
        public string Tipo { get; set; } = "";
        public string Texto { get; set; } = "";
        public int? Hex { get; set; }
        public List<string> Mortos { get; set; } = new();
    }

    /// <summary>
    /// Feed de mensagens globais (jogo e site). Ao começar uma batalha, ao terminar ("Reino X perdeu N tropas na batalha"), numa
    /// captura e na queda de um castelo. Nunca diz o tamanho de uma força, o tipo do ataque, os objetivos ou o que havia no local.
    /// </summary>
    [Sistema]
    public static class MensagensGlobais
    {
        /// <summary>Quantas ficam guardadas: as mais antigas saem.</summary>
        public const int Guardadas = 200;
        /// <summary>Quantos nomes de mortos vão em cada mensagem: o resto só conta como "e mais N".</summary>
        public const int NomesPorMensagem = 12;

        public static void AoIniciar(Mundo m) => Sistemas.UmaVez("mensagens-globais", () =>
        {
            Batalhas.AoComecar += AoComecar;
            Combates.AoTerminar.Add(AoTerminar);
            Capturas.AoCapturar += AoCapturar;
            Quedas.AoCair += AoCair;
        });

        private static string NomeReino(Mundo m, long id) => m.Reinos.Obter(id) is { } r ? "Reino " + r.Nome : "Um reino";

        public static MensagemGlobal Publicar(Mundo m, string tipo, string texto, int? hex = null, IEnumerable<string>? mortos = null)
        {
            var x = m.MensagensGlobais.Adicionar(new MensagemGlobal { Quando = m.Agora, Tipo = tipo, Texto = texto, Hex = hex, Mortos = mortos?.ToList() ?? new() });
            if (m.MensagensGlobais.Count > Guardadas)
                foreach (var velha in m.MensagensGlobais.OrderBy(v => v.Quando).ThenBy(v => v.Id).Take(m.MensagensGlobais.Count - Guardadas).ToList())
                    m.MensagensGlobais.Remover(velha);
            return x;
        }

        private static void AoComecar(Mundo m, Batalha b, Local l) =>
            Publicar(m, "batalha", "Batalha em " + l.Nome + ": " + NomeReino(m, b.AtacanteId) + " ataca " + NomeReino(m, b.DefensorId) + ".", b.Hex);

        private static void AoTerminar(Mundo m, ResultadoCombate rc)
        {
            var b = rc.BatalhaId != 0 ? m.Batalhas.Obter(rc.BatalhaId) : null;
            var l = rc.LocalId != 0 ? m.Locais.Obter(rc.LocalId) : null;
            var onde = l != null ? "na batalha em " + l.Nome : "numa batalha em campo";
            var hex = b?.Hex;
            var a = GT.Total(rc.PerdasAtaque); var d = GT.Total(rc.PerdasDefesa);
            var texto = NomeReino(m, rc.AtacanteId) + " perdeu " + N(a) + " " + onde + ". " + NomeReino(m, rc.DefensorId) + " perdeu " + N(d) + ".";
            var mortos = b == null ? new List<string>() : b.MortosAtaque.Concat(b.MortosDefesa).Concat(b.CivisMortos).ToList();
            Publicar(m, "fim-batalha", texto, hex, mortos);
        }

        private static string N(int n) => n == 1 ? "1 tropa" : n + " tropas";

        private static void AoCapturar(Mundo m, Prisioneiro p)
        {
            var quem = p.Nome.Length > 0 ? p.Nome + ", explorador de " : "Um explorador de ";
            Publicar(m, "captura", quem + NomeReino(m, p.DonoId) + ", foi capturado por " + NomeReino(m, p.CaptorId) + ".", p.Hex);
        }

        private static void AoCair(Mundo m, Reino perdeu, Reino? atacante, RegistroQueda q) =>
            Publicar(m, "queda", "O castelo de " + NomeReino(m, perdeu.Id) + " caiu" + (atacante != null ? " diante de " + NomeReino(m, atacante.Id) : "") + ".", q.HexAntigo);

        /// <summary>As mensagens mais novas primeiro, prontas para o feed.</summary>
        public static JsonArray ParaFeed(Mundo m, int max)
        {
            var l = new JsonArray();
            foreach (var x in m.MensagensGlobais.OrderByDescending(v => v.Quando).ThenByDescending(v => v.Id).Take(max))
            {
                var o = new JsonObject { ["id"] = x.Id, ["quando"] = x.Quando, ["tipo"] = x.Tipo, ["texto"] = x.Texto };
                if (x.Hex is int h) o["hex"] = h;
                if (x.Mortos.Count > 0)
                {
                    o["mortos"] = new JsonArray(x.Mortos.Take(NomesPorMensagem).Select(n => (JsonNode)n).ToArray());
                    if (x.Mortos.Count > NomesPorMensagem) o["maisMortos"] = x.Mortos.Count - NomesPorMensagem;
                }
                l.Add((JsonNode)o);
            }
            return l;
        }
    }
}

namespace ReinoDePedra.Jogo
{
    public sealed partial class Mundo
    {
        public Colecao<Publico.MensagemGlobal> MensagensGlobais { get; } = new("mensagens-globais");
    }
}
