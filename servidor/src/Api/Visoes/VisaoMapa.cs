using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Publico;
using ReinoDePedra.Jogo.Reinos;
using PS = ReinoDePedra.Jogo.Pessoas.Pessoas;
using ReinoDePedra.Jogo.Valiosos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Api.Visoes;

/// <summary>
/// O mapa do jogador: tudo o que é público (<see cref="RegraPublica"/>, a mesma regra do site), mais o que é dele: seus locais,
/// marchas e pessoas, a riqueza que descobriu, o perigo que conhece e o que a visão de agora mostra. A névoa
/// (<c>idade</c> = -1) cobre a riqueza do chão, não reinos nem marchas.
/// </summary>
public static class VisaoMapa
{
    public static object Montar(Mundo m, Reino r)
    {
        var vis = Nevoas.VisiveisAgora(m, r.Id);
        var nevoa = Nevoas.De(m, r.Id);
        var g = m.G;
        var idade = new int[g.Total];
        var agoraMin = Nevoas.Minuto(m, m.Agora);
        for (var h = 0; h < g.Total; h++)
        {
            var v = nevoa.MinutoVisto(h);
            idade[h] = v == 0 ? -1 : vis.Contains(h) ? 0 : agoraMin - v;
        }
        var agora = m.Agora;
        var objetos = new List<object>();
        var rel = RegraPublica.ReliquiasPorLocal(m);
        foreach (var l in m.Locais)
        {
            if (l.ReinoId == r.Id)
            {
                objetos.Add(new { tipo = "local", id = l.Id, hex = l.Hex, local = l.Tipo.Chave(), ocupa = Jogo.Mapa.Pegada.DoLocal(m, l), nivel = (int?)l.Nivel, nome = l.Nome, dono = "meu", ruina = l.Ruina });
                continue;
            }
            var o = RegraPublica.Local(m, l, rel);
            o["dono"] = Dono(m, r, o["reinoId"]!.GetValue<long>());
            objetos.Add(o);
        }
        foreach (var x in m.Marchas)
        {
            if (x.ReinoId == r.Id) { objetos.Add(MarchaPropria(m, r, x, agora)); continue; }
            if (!RegraPublica.MarchaVisivel(x)) continue;
            var o = RegraPublica.Marcha(m, x, agora);
            o["dono"] = Dono(m, r, x.ReinoId);
            objetos.Add(o);
        }
        foreach (var j in m.Jazidas)
            if (j.DescobertaPor.Contains(r.Id))
                objetos.Add(new { tipo = "jazida", id = j.Id, hex = j.Hex, recurso = j.Recurso, restante = Math.Round(j.Restante / j.Inicial, 3) });
        foreach (var ru in m.Ruinas)
        {
            // onde fica é público; se ainda guarda a relíquia, só para quem a viu (agora, ou como estava da última vez)
            var o = RegraPublica.RuinaAntiga(ru);
            if ((vis.Contains(ru.Hex) ? ru.Esgotada : Fotos.RuinaEsgotada(m, r.Id, ru.Hex, ru.Id)) is bool esgotada) o["esgotada"] = esgotada;
            objetos.Add(o);
        }
        foreach (var f in Extras) objetos.AddRange(f(m, r, vis));
        var vias = m.Vias;
        return new
        {
            cols = g.Cols, lins = g.Lins, agora, terreno = m.Mapa.Compacto(), idade,
            rotas = vias.Rotas, pontes = vias.Pontes,
            reinos = m.Reinos.Where(x => x.Ativo).ToDictionary(x => x.Id.ToString(), x => Espionagem.Identidade(x)),
            aliados = m.Reinos.Where(x => x.Ativo && Aliado(m, r, x.Id)).Select(x => x.Id).ToList(),
            objetos, reliquiaTipos = VisaoValiosos.Tipos(m),   // o que uma ruína antiga pode render (a folha mostra antes de escavar)
            // último reconhecimento de cada local alheio (id do local → estimativa), congelado no instante em que foi feito
            reconhecidos = r.LocaisReconhecidos.Where(kv => m.Locais.Obter(kv.Key) != null).ToDictionary(kv => kv.Key.ToString(), kv => kv.Value),
            pessoas = Pessoas(m, r), pessoasOutras = PessoasOutras(m, r, vis),
        };
    }

    /// <summary>Como um dono aparece para este reino: "meu", "aliado", "outro" ou "livre" (sem dono).</summary>
    public static string Dono(Mundo m, Reino r, long reinoId) =>
        reinoId == 0 ? "livre" : reinoId == r.Id ? "meu" : Aliado(m, r, reinoId) ? "aliado" : "outro";

    /// <summary>
    /// As pessoas do próprio reino, com nome e onde estão: <c>hex</c> do local em que estão (null para quem está numa marcha:
    /// a marcha leva <c>pessoaIds</c>). A Vista desenha cada uma; a folha vem de GET /pessoas/{id}.
    /// </summary>
    public static List<object> Pessoas(Mundo m, Reino r) =>
        m.PessoasDe(r.Id).OrderBy(p => p.Id).Select(p => (object)new
        {
            id = p.Id, nome = p.Nome, feminina = p.Feminina, oficio = p.Oficio, estado = p.Estado, localId = p.LocalId, grupoId = p.GrupoId,
            marcas = Math.Round(p.Marcas, 2),
            vida = Math.Round(ReinoDePedra.Jogo.Pessoas.Vidas.Atual(m, p), 1), vidaMax = ReinoDePedra.Jogo.Pessoas.Vidas.Max(m, p), vidaH = Math.Round(ReinoDePedra.Jogo.Pessoas.Vidas.PorHora(m, p), 2),
            hex = p.GrupoId is long gid && gid > 0 ? (int?)null : p.LocalId is long lid && m.Locais.Obter(lid) is { } l ? l.Hex : (int?)null,
        }).ToList();

    /// <summary>Pessoas de outros reinos nos locais à vista agora, para a Vista desenhar: contagens arredondadas (o número exato é segredo), sem nome.</summary>
    public static List<object> PessoasOutras(Mundo m, Reino r, HashSet<int> vis)
    {
        var lista = new List<object>();
        foreach (var l in m.Locais)
        {
            if (l.ReinoId == r.Id || l.ReinoId == 0 || !vis.Contains(l.Hex)) continue;
            var civis = Jogo.Combate.Avistamentos.Arredondado(m, PS.Presentes(m, l).Count());
            var soldados = Jogo.Combate.Avistamentos.Arredondado(m, PS.Guarnicao(m, l).Count());
            if (civis + soldados > 0) lista.Add(new { hex = l.Hex, civis, soldados });
        }
        return lista;
    }

    /// <summary>
    /// Marcha do próprio reino no mapa: sempre vai, esteja onde estiver (névoa, parada, caçando, extraindo), com estado, ordem,
    /// carga (o que leva, quanto usa e quanto cabe), tropas e alvo. Parada: <c>parado = true</c> e <c>chegada = null</c>
    /// (os <c>tempos</c> de uma marcha parada são só o instante em que parou; não é uma chegada). <c>trabalho</c>: o que o exército faz
    /// parado (<see cref="VisaoTropas.Trabalho"/>), com início e fim para a barra de tempo. Nada disto vai para marchas alheias.
    /// </summary>
    public static object MarchaPropria(Mundo m, Reino r, Marcha x, long agora)
    {
        var parado = x.EventoId == null && x.Caminho.Count <= 1;
        var trabalho = x is Exercito exTrabalho ? VisaoTropas.Trabalho(m, r, exTrabalho) : null;
        var cargaMax = x switch
        {
            Exercito e => e.CargaMax(m), Caravana c => c.CargaMax(m), Carregadores c => c.Pessoas * m.P.Carregador.Carga,
            _ => GT.Carga(m, x.Tropas),
        };
        long? alvoId = x switch
        {
            Exercito e => e.AlvoLocalId, Carregadores c => c.Retornando ? c.OrigemLocalId : c.DestinoLocalId, ReinoDePedra.Jogo.Pessoas.Deslocamento d => d.ParaLocalId,
            Caravana c => c.Fase == Caravana.Buscar ? c.OrigemLocalId : c.Fase == Caravana.Levar ? c.DestinoLocalId : c.BaseLocalId,
            _ => null,
        };
        return new
        {
            tipo = "marcha", id = x.Id, marcha = x.Tipo, reinoId = r.Id, dono = "meu", hex = x.HexEm(agora), caminho = x.Caminho, tempos = x.Tempos,
            parado, chegada = parado ? (long?)null : x.Chegada, x.Retornando,
            estado = VisaoTropas.Estado(m, x, trabalho), trabalho,
            ordem = x switch { Exercito e => e.Ordem, Explorador ex => ex.Ordem, Caravana c => c.Fase, _ => null },
            carga = x.Carga.Arredondado(), cargaMax, cargaUsada = Math.Floor(x.Carga.Total),
            tropas = x.Tropas, resumo = GT.Partes(m, x.Tropas), pessoas = x is Carregadores cg ? cg.Pessoas : x is ReinoDePedra.Jogo.Pessoas.Deslocamento dp ? dp.PessoaIds.Count : (int?)null,
            pessoaIds = x.PessoaIds,
            alvo = VisaoTropas.NomeLocal(m, r, alvoId), destinoNome = VisaoTropas.NomeLocal(m, r, m.LocalNoHex(x.Destino)?.Id),
            reliquias = x.Reliquias.Count,
            recurso = x is Exercito ec && ec.Ordem is Coletas.OrdemColetarId or Coletas.OrdemEntregarId ? ec.Dados["recurso"]?.GetValue<string>() : null,   // coleta: madeira (machado) ou pedra (picareta)
        };
    }

    /// <summary>
    /// Reinos aliados do reino: (mundo, reino que vê, outro reino) → true. Locais e marchas deles vêm com dono "aliado".
    /// </summary>
    public static List<Func<Mundo, Reino, long, bool>> Aliados { get; } = new();
    public static bool Aliado(Mundo m, Reino r, long outro) => outro != 0 && outro != r.Id && Aliados.Any(f => f(m, r, outro));

    /// <summary>Sistemas acrescentam objetos ao mapa (fauna, torres, bandeiras, avistamentos...).</summary>
    public static List<Func<Mundo, Reino, HashSet<int>, IEnumerable<object>>> Extras { get; } = new();

    public static string Aproximado(Mundo m, int n) => Jogo.Combate.Avistamentos.Aproximado(m, n);
}
