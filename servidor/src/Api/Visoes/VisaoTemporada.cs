using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Temporada;
using RK = ReinoDePedra.Jogo.Temporada.Ranking;

namespace ReinoDePedra.Api.Visoes;

/// <summary>Temporada, legado da conta e ranking para o cliente. O ranking mostra só nome e brasão (nada de ids nem de IA).</summary>
public static class VisaoTemporada
{
    public static object Montar(Mundo m, long contaId, Reino? r)
    {
        var e = m.Estado;
        var l = m.Legados.Obter(contaId);
        var p = m.P.TemporadaServ;
        var nivel = Linhagem.Nivel(m, l);
        var dsb = p.Desbloqueios;
        var soma = l == null ? 0 : Linhagem.SomaEquipadas(l);
        var tituloAtivo = Linhagem.TituloEmUso(m, contaId);
        return new
        {
            numero = e.NumeroTemporada, inicio = Temporadas.Inicio(m), fim = Temporadas.Fim(m), dias = m.P.TemporadaDias,
            dia = Temporadas.DiaIndice(m) + 1, diasRestantes = Temporadas.DiasRestantes(m), agora = m.Agora, temReino = r != null,
            linhagem = new
            {
                nivel, max = p.Linhagem.Max, temporadasJogadas = l?.TemporadasJogadas ?? 0, reliquiasGanhas = l?.Reliquias.Count ?? 0,
                diasAtivos = Temporadas.DiasAtivos(m, l), diasPedidos = p.Linhagem.DiasAtivos,
                desbloqueios = new[]
                {
                    new { chave = "brasoes", nivel = dsb.Brasoes, txt = "Cores e formas extras de brasão" },
                    new { chave = "titulos", nivel = dsb.Titulos, txt = "Títulos" },
                    new { chave = "regiao", nivel = dsb.Regiao, txt = "Escolher a região inicial ao fundar o reino" },
                    new { chave = "exilio", nivel = dsb.Exilio, txt = "Escolher a região do exílio" },
                    new { chave = "moldura", nivel = dsb.Moldura, txt = "Brasão da casa com moldura de linhagem" },
                }.OrderBy(x => x.nivel).Select(x => new { x.chave, x.nivel, x.txt, feito = nivel >= x.nivel }).ToList(),
            },
            reliquias = (l?.Reliquias ?? []).Select(x => new { x.Id, x.Nome, x.Tipo, bonus = Math.Round(x.Bonus, 4), x.Temporada, x.Como, x.Equipada }).ToList(),
            equipadasMax = m.P.Legado.Equipadas, teto = m.P.Legado.Teto, relMin = m.P.Legado.RelMin, relMax = m.P.Legado.RelMax,
            soma = Math.Round(soma, 4), vale = Math.Round(Math.Min(soma, m.P.Legado.Teto), 4), tetoBonus = m.P.TetoBonus,
            titulos = Linhagem.TodosTitulos(m, l).Select(t => new { t.nome, t.como, t.ganho, ativo = t.nome == tituloAtivo }).ToList(),
            titulosLiberados = Linhagem.Titulos(m, contaId), tituloAtivo,
            brasoes = (l?.Brasoes ?? []).Select(b => new { b.Brasao, b.Nome, b.Temporada }).ToList(),
            historico = (l?.Historico ?? []).Select(h => new { h.Temporada, h.NomeReino, h.Resumo, h.DiasAtivos, h.Contou }).ToList(),
            conquistas = r == null ? null : Conquistas(m, r),
            regioes = Regioes.Nomes.Where(kv => p.Regioes.ContainsKey(kv.Key)).Select(kv => new { id = kv.Key, nome = kv.Value }).ToList(),
            regiaoInicial = Linhagem.RegiaoInicial(m, contaId), regiaoExilioLiberada = Linhagem.RegiaoExilio(m, contaId), regiaoExilio = l?.RegiaoExilio,
            brasao = new
            {
                formas = Brasao.Formas.Concat(Linhagem.BrasoesExtras(m, contaId) ? Brasao.FormasExtras : []).ToList(),
                tinturas = Brasao.Tinturas.Concat(Linhagem.BrasoesExtras(m, contaId) ? Brasao.TinturasExtras : []).ToList(),
                formasExtras = Brasao.FormasExtras, tinturasExtras = Brasao.TinturasExtras,
                extras = Linhagem.BrasoesExtras(m, contaId), moldura = Linhagem.Moldura(m, contaId),
            },
        };
    }

    private static object Conquistas(Mundo m, Reino r)
    {
        var linhas = RK.Linhas(m);
        var pos = RK.Posicoes(linhas);
        var top = m.P.TemporadaServ.RankingTop;
        var melhor = RK.Premiadas.OrderBy(c => pos[c][r.Id]).ToList();
        var lend = Reliquias.DoReino(m, r.Id).Count();
        string Pos(string c) => pos[c][r.Id] + "º em " + Temporadas.NomeCategoria(c);
        return new object[]
        {
            new { id = "ranking", nome = "Entre os " + top + " primeiros do ranking", como = "Em baixas, tropas ou famílias (perdas não contam)",
                  agora = "Você: " + string.Join(", ", melhor.Take(2).Select(Pos)), ok = melhor.Any(c => pos[c][r.Id] <= top) },
            new { id = "lendaria", nome = "Guardião de relíquia", como = "Terminar a temporada com uma relíquia lendária em seu poder",
                  agora = lend == 0 ? "Nenhuma agora" : "Você tem " + lend + " agora", ok = lend > 0 },
            new { id = "cerco", nome = "Sitiante", como = "Vencer um cerco a um castelo", agora = r.VenceuCerco ? "Já venceu um nesta temporada" : "Ainda não", ok = r.VenceuCerco },
        };
    }

    public static object Ranking(Mundo m, Reino? eu)
    {
        var linhas = RK.Linhas(m);
        object Linha(LinhaRanking x, int pos) => new
        {
            pos, nome = x.Reino.Nome, brasao = x.Reino.Brasao, x.Baixas, x.Perdas, x.Tropas, x.Familias, meu = eu != null && x.Reino.Id == eu.Id,
        };
        var cats = RK.Categorias.ToDictionary(c => c, c =>
        {
            var ord = RK.Ordenar(linhas, c);
            var i = eu == null ? -1 : ord.FindIndex(x => x.Reino.Id == eu.Id);
            return (object)new
            {
                top = ord.Take(10).Select((x, k) => Linha(x, k + 1)).ToList(),
                eu = i < 0 ? null : Linha(ord[i], i + 1),
            };
        });
        return new
        {
            temporada = m.Estado.NumeroTemporada, reinos = linhas.Count, premiados = m.P.TemporadaServ.RankingTop,
            premiadas = RK.Premiadas, categorias = cats,
        };
    }
}
