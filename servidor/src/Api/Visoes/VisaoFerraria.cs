using System.Text.Json.Nodes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Forja;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Api.Visoes;

/// <summary>Ferraria e eras para o cliente: fila própria, eras com requisitos, trilha por família, lendário e teto de bônus.</summary>
public static class VisaoFerraria
{
    private static object Reqs(Mundo m, Reino r, RequisitoP req) =>
        Ferrarias.Requisitos(m, r, req).Select(x => new { texto = x.Texto, ok = x.Ok }).ToList();

    public static object Montar(Mundo m, Reino r)
    {
        Economia.Atualizar(m, r);
        Lendarios.Conferir(m);
        SistemaFerraria.ConferirGatilho(m, r);
        var principal = Ferrarias.Principal(m, r);
        var fila = Ferrarias.Itens(r).Select(i => VisaoReino.Item(m, r, i)).ToList();
        var eras = m.P.Eras.Select(kv => new
        {
            id = kv.Key, kv.Value.Nome, kv.Value.Libera, custo = kv.Value.Custo, tempo = kv.Value.Tempo,
            feita = Ferrarias.EraFeita(r, kv.Key), quando = r.Eras.TryGetValue(kv.Key, out var q) ? q : (long?)null,
            emFila = Ferrarias.Itens(r).Any(i => i.Tipo == ItemEra.Id && i.Param == kv.Key),
            req = m.P.FerrariaServ.Eras.TryGetValue(kv.Key, out var rq) ? Reqs(m, r, rq) : null,
            bloqueio = Ferrarias.MotivoEra(m, r, kv.Key),
        }).ToList();
        var familias = m.P.FerrariaServ.Familias.Select(f => new
        {
            id = f,
            unidades = m.B.U.Values.Where(u => u.Fam == f).Select(u => u.Id).ToList(),
            linhas = Ferrarias.Linhas.Select(l =>
            {
                var prox = Ferrarias.ProximoNivel(m, r, f, l);
                var nv = prox is int n ? m.P.Ferraria.Niveis[n - 1] : null;
                return new
                {
                    id = l, efeito = Ferrarias.Efeito(l), nivel = Ferrarias.Nivel(r, f, l), naFila = Ferrarias.NaFila(r, f, l),
                    bonus = Ferrarias.Nivel(r, f, l) * m.P.Ferraria.BonusNivel,
                    proximo = prox is int p ? new
                    {
                        nivel = p, custo = nv!.Custo, tempo = nv.Tempo, req = Reqs(m, r, m.P.FerrariaServ.Niveis[p - 1]),
                        bloqueio = Ferrarias.MotivoForja(m, r, f, l),
                    } : null,
                };
            }).ToList(),
        }).ToList();
        var total = Economia.TotalGuardado(m, r);
        return new
        {
            agora = m.Agora,
            ferraria = principal == null ? null : new { principal.Id, principal.Nome, principal.Nivel, principal.Hex },
            nivelFerraria = Ferrarias.MaiorNivel(m, r, TipoLocal.Ferraria),
            nivelQuartel = Ferrarias.MaiorNivel(m, r, TipoLocal.Quartel),
            era = Ferrarias.EraAtual(m, r),
            fila, vagas = Fila.Maximo,
            eras, familias,
            bonusNivel = m.P.Ferraria.BonusNivel, niveisMax = m.P.Ferraria.Niveis.Length,
            lendario = new
            {
                custo = m.P.Lendario.Custo, tempo = m.P.Lendario.Tempo, bonus = m.P.Lendario.Bonus, tropas = m.P.Lendario.Tropas,
                req = Reqs(m, r, m.P.FerrariaServ.Lendario),
                bloqueio = Ferrarias.MotivoLendario(m, r),
                forjados = r.LendariosForjados, porReino = m.P.FerrariaServ.LendarioPorReino,
                emFila = Ferrarias.Itens(r).Any(i => i.Tipo == ItemLendario.Id),
                minerio = Math.Floor(total.Qtd("minerio")),
                jazidas = m.Jazidas.Where(j => j.Recurso == "minerio" && j.DescobertaPor.Contains(r.Id) && j.Restante > 0)
                    .Select(j => new { j.Id, j.Hex, restante = Math.Floor(j.Restante) }).ToList(),
                meus = Meus(m, r),
                vistos = Vistos(m, r),
            },
            teto = m.P.TetoBonus,
            exemplos = Exemplos(m, r),
        };
    }

    /// <summary>Equipamentos lendários do reino e onde estão (guarnição de um local ou exército em campo).</summary>
    public static List<object> Meus(Mundo m, Reino r) => Lendarios.Do(m, r.Id).OrderBy(e => e.Id).Select(e =>
    {
        object? onde = null;
        if (e.LocalId is long lid && m.Locais.Obter(lid) is { } l)
            onde = new { tipo = "local", id = l.Id, nome = l.Nome, hex = l.Hex, tropas = (int)Lendarios.Defensores(m, l), fator = Lendarios.Fator(m, Lendarios.Defensores(m, l)) };
        else if (e.MarchaId is long mid && m.Marchas.Obter(mid) is Exercito ex)
            onde = new { tipo = "exercito", id = ex.Id, nome = GT.Partes(m, ex.Tropas), hex = ex.HexEm(m.Agora), tropas = GT.Total(ex.Tropas), fator = Lendarios.Fator(m, GT.Total(ex.Tropas)) };
        return (object)new { e.Id, e.Nome, e.Tipo, e.Levar, capturado = e.ForjadoPor != r.Id, onde };
    }).ToList();

    /// <summary>Equipamentos de outros reinos vistos nos relatórios de espionagem do próprio reino (o mais recente de cada).</summary>
    private static List<object> Vistos(Mundo m, Reino r) => m.Relatorios
        .Where(x => x.ReinoId == r.Id && x.Tipo == "espionagem" && x.Dados["lendario"] is JsonArray)
        .OrderByDescending(x => x.Quando)
        .SelectMany(x => ((JsonArray)x.Dados["lendario"]!).OfType<JsonObject>().Select(o => new
        {
            id = (long?)o["id"] ?? 0, nome = (string?)o["nome"], tipo = (string?)o["tipo"],
            local = (string?)x.Dados["local"]?["nome"], dono = (string?)x.Dados["dono"]?["nome"], quando = x.Quando, relatorio = x.Id,
        }))
        .GroupBy(v => v.id).Select(g => (object)g.First()).Take(10).ToList();

    /// <summary>
    /// Teto de bônus com exemplos do próprio reino: a guarnição do castelo atacando e a de cada local defendendo. Mostra o que é
    /// da ferraria e do lendário e o resto (relíquias, veterania, legado...) somado pelos ganchos do combate.
    /// </summary>
    private static List<object> Exemplos(Mundo m, Reino r)
    {
        var res = new List<object>();
        var c = m.Locais.Obter(r.CasteloId);
        if (c != null && c.ReinoId == r.Id && GT.Total(c.Guarnicao) > 0)
        {
            var ex = new Exercito { ReinoId = r.Id, OrigemLocalId = c.Id, Tropas = GT.Limpo(c.Guarnicao) };
            var armas = BonusFerraria.Armas(m, ex);
            var tot = Bonus.SomaAtaque(m, ex);
            res.Add(Exemplo(m, "Guarnição de " + c.Nome + ", atacando", GT.Partes(m, ex.Tropas), "ataque",
                [("Armas", armas), ("Outros", tot - armas)], tot));
        }
        foreach (var l in m.LocaisDe(r.Id).Where(l => !l.Ruina).OrderByDescending(l => GT.Total(l.Guarnicao)).ThenBy(l => l.Id).Take(2))
        {
            var arm = BonusFerraria.ArmadurasLocal(m, l);
            var lend = Lendarios.DefesaLocal(m, l);
            var tot = Bonus.SomaDefesa(m, l);
            res.Add(Exemplo(m, l.Nome + ", defendendo", GT.Total(l.Guarnicao) > 0 ? GT.Partes(m, l.Guarnicao) + " e a milícia" : "só a milícia", "defesa",
                [("Armaduras", arm), ("Lendário", lend), ("Outros", tot - arm - lend)], tot));
        }
        return res;
    }

    private static object Exemplo(Mundo m, string titulo, string tropas, string modo, (string nome, double v)[] partes, double soma) => new
    {
        titulo, tropas, modo,
        partes = partes.Where(p => p.v > 1e-9).Select(p => new { p.nome, v = Math.Round(p.v, 4) }).ToList(),
        soma = Math.Round(soma, 4), total = Math.Round(Math.Min(m.P.TetoBonus, soma), 4), noTeto = soma > m.P.TetoBonus,
    };
}
