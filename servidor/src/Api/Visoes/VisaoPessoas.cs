using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Pessoas;
using ReinoDePedra.Jogo.Reinos;
using PS = ReinoDePedra.Jogo.Pessoas.Pessoas;

namespace ReinoDePedra.Api.Visoes;

/// <summary>As pessoas do reino como o cliente as vê: quem é, onde está, o que faz, e as opções de trabalho.</summary>
public static class VisaoPessoas
{
    /// <summary>Todas as pessoas do reino e as vagas de cada local.</summary>
    public static object Lista(Mundo m, Reino r)
    {
        Economia.Atualizar(m, r);
        return new
        {
            agora = m.Agora, pop = (int)r.Pop, teto = Economia.Teto(m, r), tropas = Economia.Tropas(m, r),
            pessoas = m.PessoasDe(r.Id).OrderBy(p => p.Id).Select(p => Pessoa(m, r, p)).ToList(),
            locais = m.LocaisDe(r.Id).Where(l => !l.Ruina).OrderBy(l => l.Id).Select(l => LocalVagas(m, l)).ToList(),
        };
    }

    public static object LocalVagas(Mundo m, Local l)
    {
        var of = Oficios.DoLocal(l);
        return new
        {
            id = l.Id, nome = l.Nome, tipo = l.Tipo.Chave(), hex = l.Hex, oficio = of, oficioNome = of != null ? NomeOficio(of, false) : null,
            vagas = PS.Vagas(m, l), ocupadas = PS.Trabalhando(m, l), livres = PS.VagasLivres(m, l), presentes = PS.Presentes(m, l).Count(),
        };
    }

    /// <summary>A folha da pessoa: tudo da lista mais as opções de trabalho (da vaga mais necessária à menos) e as ações.</summary>
    public static object Folha(Mundo m, Reino r, Pessoa p)
    {
        Economia.Atualizar(m, r);
        var opcoes = PS.Opcoes(m, r, p).Select(o => new
        {
            localId = o.local.Id, nome = o.local.Nome, hex = o.local.Hex, oficio = o.oficio, oficioNome = NomeOficio(o.oficio, p.Feminina),
            livres = o.livres, vagas = o.vagas, atual = p.LocalId == o.local.Id && p.Oficio == o.oficio,
        }).ToList();
        var podeMudar = p.EhCivil && p.Estado is not (Estados.Carregando or Estados.Treinando);
        return new
        {
            pessoa = Pessoa(m, r, p), trabalhos = opcoes,
            acoes = podeMudar ? new[] { "trabalho", "mover" } : Array.Empty<string>(),
        };
    }

    public static object Pessoa(Mundo m, Reino r, Pessoa p)
    {
        var l = p.LocalId is long id ? m.Locais.Obter(id) : null;
        var mc = p.GrupoId is long g ? m.Marchas.Obter(g) : null;
        var hex = PS.HexDe(m, p);
        long? pronta = null;
        if (p.Estado == Estados.Treinando && p.ItemId is long iid)
        {
            var item = r.Filas.Values.SelectMany(f => f.Itens).FirstOrDefault(i => i.Id == iid);
            if (item != null)
            {
                var pos = PS.EmTreino(m, r, item).TakeWhile(x => x.Id != p.Id).Count();
                pronta = item.FimDaUnidade(item.Prontos + pos + 1);
            }
        }
        return new
        {
            id = p.Id, nome = p.Nome, feminina = p.Feminina, oficio = p.Oficio, oficioNome = Oficios.Nome(p), estado = p.Estado,
            civil = p.EhCivil, localId = p.LocalId, local = l?.Nome, hex, c = hex >= 0 ? m.G.C(hex) : (int?)null, l = hex >= 0 ? m.G.L(hex) : (int?)null,
            grupoId = p.GrupoId, chegada = mc != null && mc.EventoId != null ? mc.Chegada : (long?)null, pronta,
            texto = Texto(m, r, p, l, mc), marcas = Math.Round(p.Marcas, 2), nasceuEm = p.NasceuEm,
        };
    }

    /// <summary>"Cortando madeira na Serraria do Vale · 3 madeira/h". O tempo que falta (chegada, pronta) vai à parte, para o cliente contar.</summary>
    public static string Texto(Mundo m, Reino r, Pessoa p, Local? l, Marcha? mc)
    {
        switch (p.Estado)
        {
            case Estados.Trabalhando when l != null:
            {
                var taxa = Economia.TaxaLocal(m, r, l);
                var n = Math.Max(1, PS.Trabalhando(m, l));
                var porPessoa = l.Produz != null ? taxa.Qtd(l.Produz) / n : 0;
                return Oficios.Verbo(p.Oficio) + " em " + l.Nome + (porPessoa > 0 ? " · " + Math.Round(porPessoa, 1).ToString(System.Globalization.CultureInfo.InvariantCulture).Replace('.', ',') + " " + l.Produz + "/h" : "");
            }
            case Estados.Ociosa: return "Sem trabalho" + (l != null ? ", em " + l.Nome : "");
            case Estados.Andando: return "Andando para " + (mc is Deslocamento d && m.Locais.Obter(d.ParaLocalId) is { } para ? para.Nome : l?.Nome ?? "outro local");
            case Estados.Carregando when mc is Carregadores c:
            {
                if (c.Retornando) return (c.Pendente.Count > 0 ? "Voltando para buscar mais em " : "Voltando para ") + (m.Locais.Obter(c.OrigemLocalId ?? 0)?.Nome ?? "casa");
                var destino = c.DestinoLocalId is long did ? m.Locais.Obter(did)?.Nome : null;
                var carga = string.Join(", ", c.Carga.Arredondado().Where(kv => kv.Value > 0).Select(kv => kv.Value + " " + Logistica.NomeRecurso(kv.Key)));
                return "Carregando " + (carga.Length > 0 ? carga : "material") + (destino != null ? " para " + destino : " para uma obra");
            }
            case Estados.Carregando: return "Carregando material";
            case Estados.Treinando: return "Treinando como " + Oficios.Nome(p).ToLowerInvariant() + (l != null ? " em " + l.Nome : "");
            case Estados.Guarnecida: return "Na guarnição" + (l != null ? " de " + l.Nome : "");
            case Estados.Marchando: return "Em marcha";
            case Estados.Ferida: return "Ferida, esperando ervas";
            case Estados.Capturada: return "Capturada por outro reino";
            default: return Oficios.Nome(p);
        }
    }

    public static string NomeOficio(string oficio, bool feminina) => Oficios.Nome(new Pessoa { Oficio = oficio, Feminina = feminina });
}
