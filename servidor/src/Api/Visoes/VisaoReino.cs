using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using PS = ReinoDePedra.Jogo.Pessoas.Pessoas;

namespace ReinoDePedra.Api.Visoes;

/// <summary>Estado do próprio reino para o cliente. O cliente interpola estoques com a taxa até o próximo aviso.</summary>
public static class VisaoReino
{
    public static object Montar(Mundo m, Reino r)
    {
        Economia.Atualizar(m, r);
        var ef = Economia.Eficiencia(m, r);
        var agora = m.Agora;
        var castelo = m.Locais.Obter(r.CasteloId);
        var locais = m.LocaisDe(r.Id).OrderBy(l => l.Tipo).ThenBy(l => l.Id).Select(l => Local(m, r, l, ef)).ToList();
        var filas = r.Filas.ToDictionary(kv => kv.Key, kv => kv.Value.Itens.Select(i => Item(m, r, i)).ToList());
        var n = Economia.Moradias(m, r) + r.Fila(Obras.Fila).Itens.Count(i => i.Tipo == ObraMoradia.Id);
        var f = r.Fundados + r.Fila(Obras.Fila).Itens.Count(i => i.Tipo == ObraFundar.Id);
        var ritmo = Economia.RitmoPopulacao(m, r);
        var dados = new Dictionary<string, object?>
        {
            ["id"] = r.Id, ["nome"] = r.Nome, ["brasao"] = r.Brasao, ["iconeProprio"] = r.IconeProprio, ["iconeVersao"] = r.IconeVersao,
            ["agora"] = agora, ["escudoAte"] = r.EscudoAte > agora ? r.EscudoAte : null,
            ["casteloId"] = r.CasteloId, ["nivelCastelo"] = castelo?.Nivel ?? 0,
            ["pop"] = Math.Floor(r.Pop), ["teto"] = Economia.Teto(m, r), ["tropas"] = Economia.Tropas(m, r),
            // ritmo da população (barra do topo): pessoas por hora agora, quando nasce a próxima e se a comida dá o bônus
            ["popHora"] = Math.Round(ritmo.porHora, 2), ["popProxima"] = ritmo.proxima,
            ["popComidaSobra"] = ritmo.sobra, ["popBonusComida"] = m.P.BonusComida,
            ["trabalhadores"] = Economia.TrabalhadoresNecessarios(m, r), ["trabalhando"] = Economia.Trabalhando(m, r), ["eficiencia"] = Math.Round(ef, 3),
            ["pessoas"] = m.PessoasDe(r.Id).Count(),
            ["moradias"] = Economia.Moradias(m, r),
            ["locais"] = locais, ["filas"] = filas,
            ["marchas"] = m.Marchas.Where(x => x.ReinoId == r.Id).Select(x => VisaoMarcha.Propria(m, x)).ToList(),
            ["custos"] = new
            {
                moradia = m.F.Receita(m.F.CustoMoradia(n)), moradiaSeg = m.F.TempoMoradia(n), tetoPorMoradia = m.P.TetoPorMoradia,
                novoLocal = m.F.CustoNovoLocal(f), novoLocalSeg = m.P.TempoNovoLocal,
            },
            ["fundaveis"] = Obras.Fundaveis.ToDictionary(kv => kv.Key, kv => new { tipo = kv.Value.tipo.Chave(), kv.Value.produz, terrenos = kv.Value.terrenos.Select(t => Jogo.Mapa.TerrenoExt.Chave(t)), ocupa = Jogo.Mapa.Pegada.Tamanho(m, kv.Value.tipo) }),
        };
        foreach (var x in Extras) x(m, r, dados);
        return dados;
    }

    /// <summary>Sistemas acrescentam campos ao estado do reino aqui (relíquias, aliança, ferraria...).</summary>
    public static List<Action<Mundo, Reino, Dictionary<string, object?>>> Extras { get; } = new();

    public static object Local(Mundo m, Reino r, Local l, double ef)
    {
        var taxa = Economia.TaxaLocal(m, r, l);
        var castelo = m.Locais.Obter(r.CasteloId);
        var alvo = l.Nivel + 1 + r.Fila(Obras.Fila).Itens.Count(i => i.Tipo == ObraNivel.Id && i.LocalId == l.Id);
        var ehCastelo = l.Tipo == TipoLocal.Castelo;
        object? melhoria = alvo > m.P.NivelMax ? null : new
        {
            nivel = alvo, custo = m.F.CustoNivel(alvo, ehCastelo), seg = m.F.TempoNivel(alvo, ehCastelo),
            bloqueio = !ehCastelo && castelo != null && alvo > castelo.Nivel ? "Nenhum local passa do nível do castelo." : null,
            efeitos = Efeitos(m, r, l, alvo),
        };
        var cap = new Dictionary<string, double>();
        foreach (var k in taxa.Keys) cap[k] = Math.Floor(Economia.Capacidade(m, l, k));
        if (l.Tipo == TipoLocal.Armazem) cap["*"] = Math.Floor(Economia.Capacidade(m, l, "madeira"));
        var d = new Dictionary<string, object?>
        {
            ["id"] = l.Id, ["tipo"] = l.Tipo.Chave(), ["produz"] = l.Produz, ["nivel"] = l.Nivel, ["hex"] = l.Hex,
            ["c"] = m.G.C(l.Hex), ["l"] = m.G.L(l.Hex), ["nome"] = l.Nome, ["terreno"] = Jogo.Mapa.TerrenoExt.Chave(m.Mapa.Terrenos[l.Hex]),
            ["estoque"] = l.Estoque.Where(kv => kv.Value > 0).ToDictionary(kv => kv.Key, kv => Math.Round(kv.Value, 2)),
            ["taxa"] = taxa.ToDictionary(kv => kv.Key, kv => Math.Round(kv.Value, 3)), ["cap"] = cap,
            ["moradias"] = l.Moradias, ["guarnicao"] = l.Guarnicao, ["postura"] = l.Postura, ["ruina"] = l.Ruina,
            ["trabalhadores"] = PS.Vagas(m, l), ["vagas"] = PS.Vagas(m, l), ["ocupadas"] = PS.Trabalhando(m, l),
            ["pessoas"] = PS.Presentes(m, l).Count(), ["eficiencia"] = Math.Round(Economia.EficienciaLocal(m, l), 3),
            ["melhoria"] = melhoria,
        };
        foreach (var x in ExtrasLocal) x(m, r, l, d);
        return d;
    }
    public static List<Action<Mundo, Reino, Local, Dictionary<string, object?>>> ExtrasLocal { get; } = new();

    /// <summary>
    /// O que muda do nível <c>alvo - 1</c> para <c>alvo</c>, em números, para a dica do botão Melhorar.
    /// Cada efeito: <c>tipo</c> (producao, producaoBasicos, guarda, vagas, nivelLocais, libera), <c>rec</c>, <c>de</c>, <c>para</c>, <c>texto</c>.
    /// A produção é a com todas as vagas ocupadas e já com os modificadores do local (relíquia, legado).
    /// </summary>
    public static List<object> Efeitos(Mundo m, Reino r, Local l, int alvo)
    {
        var de = alvo - 1;
        var e = new List<object>();
        void Num(string tipo, string? rec, double a, double b)
        {
            if (Math.Abs(a - b) > 1e-9) e.Add(new { tipo, rec, de = Math.Round(a, 1), para = Math.Round(b, 1) });
        }
        var mult = 1.0;
        foreach (var f in Economia.ModificadoresProducao) mult *= f(m, l);
        if (l.Tipo == TipoLocal.Castelo)
        {
            Num("producaoBasicos", null, m.F.ProducaoCastelo(de) * mult, m.F.ProducaoCastelo(alvo) * mult);
            Num("guarda", "basicos", Economia.CapacidadeNoNivel(m, l, "comida", de), Economia.CapacidadeNoNivel(m, l, "comida", alvo));
            Num("nivelLocais", null, de, alvo);
        }
        else if (l.Tipo == TipoLocal.Armazem)
            Num("guarda", "*", m.F.CapacidadeArmazem(de), m.F.CapacidadeArmazem(alvo));
        else if (l.Produz != null)
        {
            Num("producao", l.Produz, m.F.ProducaoDe(l.Produz, de) * mult, m.F.ProducaoDe(l.Produz, alvo) * mult);
            Num("guarda", l.Produz, Economia.CapacidadeNoNivel(m, l, l.Produz, de), Economia.CapacidadeNoNivel(m, l, l.Produz, alvo));
        }
        if (l.EhProducao) Num("vagas", null, m.F.Vagas(de), m.F.Vagas(alvo));
        // ferraria e quartel liberam eras, armas e armaduras pelo nível do maior local do tipo no reino
        if (l.Tipo is TipoLocal.Ferraria or TipoLocal.Quartel && Jogo.Forja.Ferrarias.MaiorNivel(m, r, l.Tipo) < alvo)
        {
            var fs = m.P.FerrariaServ;
            int Pede(RequisitoP q) => l.Tipo == TipoLocal.Ferraria ? q.Ferraria : q.Quartel;
            string Com(RequisitoP q) => q.Era != null && m.P.Eras.TryGetValue(q.Era, out var x) ? " (com a " + x.Nome + ")" : "";
            foreach (var (id, q) in fs.Eras)
                if (Pede(q) == alvo) e.Add(new { tipo = "libera", texto = "pesquisar a " + (m.P.Eras.TryGetValue(id, out var x) ? x.Nome : id) + Com(q) });
            for (var i = 0; i < fs.Niveis.Length; i++)
                if (Pede(fs.Niveis[i]) == alvo) e.Add(new { tipo = "libera", texto = "armas e armaduras nível " + (i + 1) + Com(fs.Niveis[i]) });
            if (Pede(fs.Lendario) == alvo) e.Add(new { tipo = "libera", texto = "equipamento lendário" + Com(fs.Lendario) });
        }
        return e;
    }

    /// <summary>
    /// Item de fila. <c>inicio</c> e <c>fim</c> só existem depois que o item começa; antes disso <c>estado</c> diz por quê:
    /// "andamento" (começou), "material" (espera o material chegar) ou "fila" (espera o item anterior). <c>posicao</c>: 1 = primeiro da fila.
    /// <c>prontos</c>/<c>proximoFim</c>: num item de várias unidades, quantas já ficaram prontas e quando fica a próxima.
    /// </summary>
    public static object Item(Mundo m, Reino r, ItemFila i)
    {
        // a última leva de carregadores a chegar: a barra "material chega" vai da partida dela à chegada
        var leva = m.Marchas.OfType<Carregadores>().Where(c => c.ItemId == i.Id).OrderByDescending(c => c.Chegada).FirstOrDefault();
        var chegada = leva?.Chegada ?? 0;
        var pos = r.Filas.Values.Select(f => f.Itens.IndexOf(i)).FirstOrDefault(p => p >= 0, -1);
        return new
        {
            i.Id, i.Tipo, i.Rotulo, i.LocalId, i.Hex, i.NivelAlvo, i.Param, i.Qtd,
            custo = i.Custo, entregue = i.Entregue.ToDictionary(kv => kv.Key, kv => Math.Floor(kv.Value)),
            duracao = i.DuracaoSeg, i.Inicio, i.Fim, materialCompleto = i.MaterialCompleto,
            materialChegaEm = i.MaterialCompleto ? (long?)null : chegada > 0 ? chegada : null,
            materialPartida = i.MaterialCompleto || leva == null || chegada <= 0 ? (long?)null : leva.Partida,
            estado = i.Iniciado ? "andamento" : !i.MaterialCompleto ? "material" : "fila",
            posicao = pos >= 0 ? pos + 1 : (int?)null,
            // por unidade (tropas, exploradores...): quantas já ficaram prontas e quando fica a próxima
            prontos = i.Prontos, proximoFim = i.Restantes > 0 ? i.FimDaUnidade(i.Prontos + 1) : null,
        };
    }
}

public static class VisaoMarcha
{
    public static object Propria(Mundo m, Marcha x) => new
    {
        x.Id, x.Tipo, x.Caminho, x.Tempos, x.Tropas, carga = x.Carga.Arredondado(), x.Vel, x.Retornando, x.Estandarte,
        pessoas = x is Carregadores c ? c.Pessoas : x is ReinoDePedra.Jogo.Pessoas.Deslocamento d ? d.PessoaIds.Count : (int?)null,
        detalhe = Detalhes(m, x),
    };
    /// <summary>Sistemas acrescentam detalhes por tipo de marcha (objetivo do ataque, ordem do explorador...).</summary>
    public static List<Func<Mundo, Marcha, object?>> ExtrasPropria { get; } = new();
    private static object? Detalhes(Mundo m, Marcha x)
    {
        foreach (var f in ExtrasPropria) { var d = f(m, x); if (d != null) return d; }
        return null;
    }
}
