using System.Text.Json.Nodes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Valiosos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;
using PS = ReinoDePedra.Jogo.Pessoas.Pessoas;

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
            pessoas = PS.Guarnicao(m, l).Where(p => p.ReinoId == r.Id).OrderBy(p => p.Oficio).ThenByDescending(p => p.Marcas).ThenBy(p => p.Id).Select(p => VisaoPessoas.Curta(m, p)).ToList(),
            marcas = Math.Round(Veterania.DoLocal(m, l), 2),
            recruta = Recrutamento.Recruta(l),
            unidades = Recrutamento.Recruta(l) ? m.B.U.Keys.Where(u => Recrutamento.RecrutaNoLocal(m, l, u)).ToList() : [],
        }).ToList();
        var emTreino = Recrutamento.Itens(r).Select(i => new
        {
            i.Id, unidade = i.Param, i.Qtd, i.LocalId, local = i.LocalId is long id ? m.Locais.Obter(id)?.Nome : null,
            i.Rotulo, i.Inicio, i.Fim, duracao = i.DuracaoSeg, materialCompleto = i.MaterialCompleto,
            prontos = i.Prontos, proximoFim = i.Restantes > 0 ? i.FimDaUnidade(i.Prontos + 1) : null,
            materialChegaEm = i.MaterialCompleto ? null : MaterialChegaEm(m, i),
            materialPartida = i.MaterialCompleto ? null : MaterialPartida(m, i),
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

    /// <summary>Partida da leva de carregadores que chega por último (início da barra "material chega").</summary>
    private static long? MaterialPartida(Mundo m, ItemFila i) =>
        m.Marchas.OfType<Carregadores>().Where(x => x.ItemId == i.Id).OrderByDescending(x => x.Chegada).Select(x => (long?)x.Partida).FirstOrDefault();

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
        var trabalho = Trabalho(m, r, e);
        var bloqueio = Exercitos.Bloqueio(m, e);
        return new
        {
            e.Id, e.Ordem, estado = Estado(m, e, trabalho), trabalho,
            podeOrdem = bloqueio == null, bloqueio,   // o painel da marcha mostra o motivo (ex.: em batalha) em vez de deixar a ordem falhar
            tropas = e.Tropas, total = GT.Total(e.Tropas), resumo = GT.Partes(m, e.Tropas), civis = PS.CivisColetando(m, e),   // civis sem trabalho que coletam com o grupo
            pessoas = PS.SoldadosDaMarcha(m, e).OrderBy(p => p.Oficio).ThenBy(p => p.Id).Select(p => VisaoPessoas.Curta(m, p)).ToList(),
            marcas = Math.Round(Veterania.DaMarcha(m, e), 2),
            carga = e.Carga.Arredondado(), cargaMax = e.CargaMax(m), cargaUsada = Math.Floor(e.Carga.Total), e.Vel, e.Postura, e.Seguro,
            e.OrigemLocalId, origem = NomeLocal(m, r, e.OrigemLocalId),
            e.AlvoLocalId, alvo = NomeLocal(m, r, e.AlvoLocalId),
            hex = e.HexEm(agora), e.Destino, destinoC = m.G.C(e.Destino), destinoL = m.G.L(e.Destino),
            e.Partida, e.Chegada, e.Caminho, e.Tempos, reliquias = e.Reliquias.Count,
            dados = e.Dados.Count > 0 ? e.Dados : null,
        };
    }

    /// <summary>"marchando", "parado", "retornando" ou "trabalhando" (caçando, extraindo, escavando ou espionando), para qualquer marcha própria.</summary>
    public static string Estado(Mundo m, Marcha x, object? trabalho = null)
    {
        if (x is Exercito e) return (trabalho ?? Trabalho(m, m.Reinos.Obter(e.ReinoId), e)) != null ? "trabalhando" : e.Parado ? "parado" : e.Retornando ? "retornando" : "marchando";
        if (x is Explorador ex && ex.EspionandoAte != null) return "trabalhando";
        return x.Retornando ? "retornando" : x.EventoId == null && x.Caminho.Count <= 1 ? "parado" : "marchando";
    }

    /// <summary>
    /// O que um exército parado está fazendo: <c>{ tipo: "caca" | "extracao" | "escavacao", recurso, coletado, destino, inicio, fim }</c>, ou null.
    /// <c>coletado</c> é o que já tirou (a carga, posta em dia); <c>destino</c>, o nome do local para onde vai levar.
    /// <c>inicio</c> e <c>fim</c> dão a barra de progresso: na extração, o início é quando a carga estaria vazia no ritmo de agora
    /// (a barra mostra a carga até o fim: cheia ou jazida esgotada); na escavação, o começo dela; na caça, a chegada ao bando.
    /// </summary>
    public static object? Trabalho(Mundo m, Reino? r, Exercito e)
    {
        if (e.ExtraiJazidaId is long jid)
        {
            var j = m.Jazidas.Obter(jid);
            if (j != null) Extracoes.Liquidar(m, j);   // a carga do grupo fica em dia (a extração não tem tique)
            var op = new OpcoesCaminho { Seguro = e.Seguro, Forca = GT.ForcaFauna(m, e.Tropas), ReinoId = e.ReinoId };
            var dep = Extracoes.Deposito(m, e.ReinoId, e.HexEm(m.Agora), e.Vel, op);
            var fim = e.ExtraiEventoId is long ev ? m.Eventos.Obter(ev)?.Quando : null;
            return new { tipo = "extracao", recurso = j?.Recurso, coletado = e.Carga.Arredondado(), destino = dep?.local.Nome, inicio = InicioExtracao(m, e, j), fim };
        }
        if (e.ColetaPontoId is long pid)
        {
            var pc = m.PontosColeta.Obter(pid);
            if (pc != null) Coletas.Liquidar(m, pc);   // a carga do grupo fica em dia (a coleta não tem tique)
            var dep = pc == null ? null : Coletas.Deposito(m, e.ReinoId, pc.Hex, e.Vel, pc.Recurso, new OpcoesCaminho { ReinoId = e.ReinoId });
            var fim = e.ColetaEventoId is long ev ? m.Eventos.Obter(ev)?.Quando : null;
            return new { tipo = "coleta", recurso = pc?.Recurso, coletado = e.Carga.Arredondado(), destino = dep?.local.Nome, fim };
        }
        if (e.EscavaRuinaId != null)
        {
            var did = e.Dados["destinoLocalId"]?.GetValue<long>();
            var dest = did is long d ? m.Locais.Obter(d) : null;
            if (!Exercitos.LocalProprio(dest, e.ReinoId)) dest = r != null ? m.Locais.Obter(r.CasteloId) : null;
            return new { tipo = "escavacao", recurso = (string?)null, coletado = e.Carga.Arredondado(), destino = dest?.Nome, inicio = e.EscavaInicio, fim = e.EscavaFim };
        }
        if (e.Ordem == OrdemCacar.Id && e.Parado && e.Dados["cacaAte"] is JsonValue v && v.TryGetValue<long>(out var ate))
        {
            var origem = m.Locais.Obter(e.OrigemLocalId);
            var inicio = ate - T.DeHoras(m.P.CacaMin / 60);   // Caca.Chegou: cacaAte = chegada + P.cacaMin
            return new { tipo = "caca", recurso = (string?)null, coletado = e.Carga.Arredondado(), destino = Exercitos.LocalProprio(origem, e.ReinoId) ? origem!.Nome : null, inicio = (long?)inicio, fim = (long?)ate };
        }
        return null;
    }

    /// <summary>
    /// Início equivalente da extração: agora menos o tempo que o grupo levaria, no ritmo atual, para tirar o que já tem do recurso.
    /// Assim a barra (agora − início) / (fim − início) é a carga atual sobre a carga no fim. Null sem jazida ou sem ritmo.
    /// </summary>
    public static long? InicioExtracao(Mundo m, Exercito e, Jogo.Mapa.Jazida? j)
    {
        if (j == null) return null;
        var ritmo = Extracoes.Ritmo(m, e.Tropas, j.Recurso, Extracoes.TemPosto(m, e.ReinoId, j.Hex), e.ExtraiRota == true);
        if (ritmo <= 0) return null;
        var tem = e.Carga.GetValueOrDefault(j.Recurso);
        return m.Agora - (long)Math.Round(tem / ritmo * T.Hora);
    }

    /// <summary>
    /// Fauna que o reino conhece no hexágono (bando à vista, ou o último perigo visto na foto da névoa) e o que acontece a um grupo
    /// com a força dada: "ileso" (o dobro do limite), "venceComPerdas" (acima do limite, perde 5%), "perdeParte" (abaixo, perde 25%)
    /// ou "perde" (ninguém sobra: explorador ou tropa sozinha). Null sem fauna conhecida ali.
    /// </summary>
    public static object? FaunaNoDestino(Mundo m, Reino r, int hex, IReadOnlyDictionary<string, int> grupo, double forca)
    {
        if (!m.G.Valido(hex)) return null;
        var vis = Nevoas.VisiveisAgora(m, r.Id);
        string? animal; int nivel; int? qtd = null; var visto = m.Agora;
        var rg = vis.Contains(hex) ? Fauna.RegioesEm(m, hex).FirstOrDefault(x => !x.Abatido && x.Hex == hex) : null;
        if (rg != null) { animal = rg.Animal; nivel = Math.Max(1, Fauna.NivelEm(m, rg, hex)); qtd = rg.Qtd; }
        else
        {
            nivel = Fotos.PerigoConhecido(m, r.Id, hex);
            if (nivel == 0) return null;
            animal = Fotos.AnimalConhecido(m, r.Id, hex);
            visto = vis.Contains(hex) ? m.Agora : Nevoas.Instante(m, Nevoas.De(m, r.Id).MinutoVisto(hex));
        }
        var nome = Fauna.NomeDe(nivel)!;
        var limite = m.P.Fauna[nome];
        var total = GT.Total(grupo);
        var perda = forca >= 2 * limite ? 0 : forca >= limite ? m.P.PerdaFauna.Acima : m.P.PerdaFauna.Abaixo;   // a regra de Fauna.Atacar e Caca.Lutar
        var baixas = perda <= 0 || total == 0 ? 0 : Math.Min(total, Math.Max(1, (int)Math.Round(total * perda, MidpointRounding.AwayFromZero)));
        var veredito = perda <= 0 ? "ileso" : baixas >= total ? "perde" : forca >= limite ? "venceComPerdas" : "perdeParte";
        return new { animal, qtd, nivel = nome, forca = limite, ileso = 2 * limite, vistoHaMin = Math.Max(0, (m.Agora - visto) / T.Min), veredito, perda, baixas };
    }

    /// <summary>Tempos de viagem do grupo pela rota curta e pela segura, sem enviar nada; com a fauna conhecida no destino.</summary>
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
        return new { vel, carga = GT.Carga(m, grupo), forcaFauna = forca, visao = GT.Visao(m, grupo), pop = GT.Pop(m, grupo), curta = Op(false), segura = Op(true), fauna = FaunaNoDestino(m, r, para, grupo, forca) };
    }
}
