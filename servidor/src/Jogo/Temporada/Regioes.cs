using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Mapa;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Temporada;

namespace ReinoDePedra.Jogo.Temporada
{
    /// <summary>Regiões do mapa (norte, sul, leste, oeste, centro) para a região inicial (linhagem 5) e a do exílio (linhagem 7).</summary>
    public static class Regioes
    {
        public static readonly Dictionary<string, string> Nomes = new()
        {
            ["norte"] = "Norte", ["sul"] = "Sul", ["leste"] = "Leste", ["oeste"] = "Oeste", ["centro"] = "Centro",
        };

        public static bool Existe(Mundo m, string? regiao) => regiao != null && m.P.TemporadaServ.Regioes.ContainsKey(regiao);

        /// <summary>Hexágono do centro da região.</summary>
        public static int Centro(Mundo m, string regiao)
        {
            if (!m.P.TemporadaServ.Regioes.TryGetValue(regiao, out var f) || f.Length < 2) throw new RegraException("Região desconhecida.");
            var c = (int)Math.Round(f[0] * (m.G.Cols - 1));
            var l = (int)Math.Round(f[1] * (m.G.Lins - 1));
            return m.G.Indice(Math.Clamp(c, 0, m.G.Cols - 1), Math.Clamp(l, 0, m.G.Lins - 1));
        }

        /// <summary>Gancho do exílio (<see cref="Quedas.EscolherExilio"/>): a vaga (ou ponto livre) mais perto da região escolhida.</summary>
        internal static int? Exilio(Mundo m, Reinos.Reino r, Reinos.Reino? atk)
        {
            if (r.ContaId is not long conta || !Linhagem.RegiaoExilio(m, conta)) return null;
            var regiao = m.Legados.Obter(conta)?.RegiaoExilio;
            if (!Existe(m, regiao)) return null;
            var centro = Centro(m, regiao!);
            var ocupadas = m.Reinos.Where(x => x.Ativo && x.Id != r.Id).Select(x => x.Vaga).ToHashSet();
            var vaga = m.Mapa.Vagas.Where(v => !ocupadas.Contains(v.Indice) && v.Indice != r.Vaga && Quedas.PontoLivre(m, v.Castelo))
                .OrderBy(v => m.G.Distancia(v.Castelo, centro)).Select(v => (int?)v.Castelo).FirstOrDefault();
            if (vaga != null) return vaga;
            return Enumerable.Range(0, m.G.Total)
                .Where(h => m.Mapa.Terrenos[h] is Terreno.Planicie or Terreno.Colina && Quedas.PontoLivre(m, h))
                .OrderBy(h => m.G.Distancia(h, centro)).Select(h => (int?)h).FirstOrDefault();
        }
    }
}

namespace ReinoDePedra.Jogo.Reinos
{
    public static partial class CriacaoReino
    {
        /// <summary>Vaga livre mais perto do centro da região (linhagem nível P.temporadaServ.desbloqueios.regiao); -1 se não houver.</summary>
        public static int VagaPerto(Mundo m, string regiao)
        {
            var centro = Regioes.Centro(m, regiao);
            var ocupadas = m.Reinos.Where(r => r.Ativo).Select(r => r.Vaga).ToHashSet();
            return m.Mapa.Vagas.Where(v => !ocupadas.Contains(v.Indice) && VagaUtilizavel(m, v))
                .OrderBy(v => m.G.Distancia(v.Castelo, centro)).ThenBy(v => v.Indice)
                .Select(v => v.Indice).DefaultIfEmpty(-1).First();
        }

        /// <summary>
        /// Funda o reino de um jogador escolhendo a região (se a linhagem libera; sem vaga livre na escolha, segue a regra normal).
        /// </summary>
        public static Reino CriarNaRegiao(Mundo m, long contaId, string nome, Brasao brasao, string? regiao)
        {
            var vaga = -1;
            if (regiao != null)
            {
                if (!Regioes.Existe(m, regiao)) throw new RegraException("Região desconhecida.");
                if (!Linhagem.RegiaoInicial(m, contaId))
                    throw new RegraException("A escolha da região libera no nível " + m.P.TemporadaServ.Desbloqueios.Regiao + " da linhagem.");
                vaga = VagaPerto(m, regiao);
            }
            return Criar(m, contaId, nome, brasao, vaga);
        }
    }
}
