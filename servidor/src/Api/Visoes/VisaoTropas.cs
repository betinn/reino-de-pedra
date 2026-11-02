using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Api.Visoes;

/// <summary>Tropas do próprio reino: guarnições, exércitos em campo, em treino e unidades (com custo e bloqueio).</summary>
public static class VisaoTropas
{
    public static object Montar(Mundo m, Reino r)
    {
        Economia.Atualizar(m, r);
        var agora = m.Agora;
        var locais = m.LocaisDe(r.Id).OrderBy(l => l.Tipo).ThenBy(l => l.Id).Select(l => new
        {
            l.Id, tipo = l.Tipo.Chave(), l.Produz, l.Nome, l.Nivel, l.Hex, c = m.G.C(l.Hex), lin = m.G.L(l.Hex),
            guarnicao = GT.GuarnicaoLivre(m, l), l.Postura, l.Ruina,   // sem o reforço de aliados (é deles)
            recruta = Recrutamento.Recruta(l),
            unidades = Recrutamento.Recruta(l) ? m.B.U.Keys.Where(u => Recrutamento.RecrutaNoLocal(m, l, u)).ToList() : [],
        }).ToList();
        var emTreino = Recrutamento.Itens(r).Select(i => new
        {
            i.Id, unidade = i.Param, i.Qtd, i.LocalId, local = i.LocalId is long id ? m.Locais.Obter(id)?.Nome : null,
            i.Rotulo, i.Inicio, i.Fim, duracao = i.DuracaoSeg, materialCompleto = i.MaterialCompleto,
            materialChegaEm = i.MaterialCompleto ? null : MaterialChegaEm(m, i),
        }).ToList();
        var unidades = m.B.U.Values.Select(u => new
        {
            u.Id, u.Nome, plural = GT.Plural(u), u.Fam, u.Atk, u.Def, u.Vel, u.Carga, u.Custo, u.Tempo, u.Pop, u.Vence, u.So, u.Req,
            forcaFauna = (u.Atk + u.Def) / 2,
            bloqueio = Recrutamento.Bloqueio(m, r, u),
            castelo = m.P.RecrutaCastelo.Contains(u.Id),
        }).ToList();
        return new
        {
            agora, pop = Math.Floor(r.Pop), teto = Economia.Teto(m, r), ocupando = Economia.Tropas(m, r),
            emTreinoPop = Recrutamento.EmTreino(m, r),
            locais, exercitos = Exercitos.De(m, r.Id).OrderBy(e => e.Id).Select(e => Exercito(m, e)).ToList(),
            emTreino, unidades,
            ordens = Exercitos.Ordens.Values.Where(o => o.NoEnvio).Select(o => o.Ordem).ToList(),
        };
    }

    private static long? MaterialChegaEm(Mundo m, ItemFila i)
    {
        var c = m.Marchas.OfType<Carregadores>().Where(x => x.ItemId == i.Id).Select(x => x.Chegada).DefaultIfEmpty(0).Max();
        return c > 0 ? c : null;
    }

    /// <summary>Nome que o reino pode ver de um local: o próprio pelo nome; o de outro reino, só pelo tipo.</summary>
    public static string? NomeLocal(Mundo m, Reino r, long? id)
    {
        var l = id is long x ? m.Locais.Obter(x) : null;
        if (l == null) return null;
        return l.ReinoId == r.Id ? l.Nome : l.Ruina ? "Ruína" : l.Tipo.NomeGenerico();
    }

    public static object Exercito(Mundo m, Exercito e)
    {
        var r = m.Reinos.Obter(e.ReinoId)!;
        var agora = m.Agora;
        return new
        {
            e.Id, e.Ordem, estado = e.Parado ? "parado" : e.Retornando ? "retornando" : "marchando",
            tropas = e.Tropas, total = GT.Total(e.Tropas), resumo = GT.Partes(m, e.Tropas),
            carga = e.Carga.Arredondado(), cargaMax = e.CargaMax(m), e.Vel, e.Postura, e.Seguro,
            e.OrigemLocalId, origem = NomeLocal(m, r, e.OrigemLocalId),
            e.AlvoLocalId, alvo = NomeLocal(m, r, e.AlvoLocalId),
            hex = e.HexEm(agora), e.Destino, destinoC = m.G.C(e.Destino), destinoL = m.G.L(e.Destino),
            e.Partida, e.Chegada, e.Caminho, e.Tempos, reliquias = e.Reliquias.Count,
            dados = e.Dados.Count > 0 ? e.Dados : null,
        };
    }

    /// <summary>Tempos de viagem do grupo pela rota curta e pela segura, sem enviar nada.</summary>
    public static object Previa(Mundo m, Reino r, int de, int para, IReadOnlyDictionary<string, int> grupo)
    {
        var vel = GT.Velocidade(m, grupo);
        var forca = GT.ForcaFauna(m, grupo);
        object Op(bool seguro)
        {
            var rota = Caminhos.Calcular(m, de, para, vel, new OpcoesCaminho { Seguro = seguro, Forca = forca, ReinoId = r.Id });
            var ok = rota.Hexes[^1] == para;
            return new { ok, min = ok ? Math.Round(rota.TotalMin, 1) : (double?)null, hexes = ok ? rota.Hexes.Count : 0, caminho = ok ? rota.Hexes : null };
        }
        return new { vel, carga = GT.Carga(m, grupo), forcaFauna = forca, pop = GT.Pop(m, grupo), curta = Op(false), segura = Op(true) };
    }
}
