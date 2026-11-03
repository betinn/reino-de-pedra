using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using ReinoDePedra.Jogo.Valiosos;

namespace ReinoDePedra.Jogo.Pessoas;

/// <summary>
/// Soldados como pessoas (fase 3 do refactor). Cada soldado tem o ofício da unidade e está na guarnição de um local
/// (<see cref="Estados.Guarnecida"/>) ou numa marcha (<see cref="Estados.Marchando"/>, <see cref="Pessoa.GrupoId"/>).
/// <see cref="Local.Guarnicao"/> e <see cref="Marcha.Tropas"/> continuam existindo como contagens por unidade, mantidas
/// por aqui a cada mudança (todo o resto do jogo lê contagens). Rede de segurança: se uma contagem declarada difere das
/// pessoas (testes e cenários que escrevem no dicionário), <see cref="Sincronizar(Mundo, Local)"/> faz as pessoas que
/// faltam nascerem e tira as que sobram; no jogo normal é sempre um não-fazer-nada.
/// </summary>
public static partial class Pessoas
{
    /// <summary>GrupoId de quem saiu da guarnição e ainda não entrou na marcha (a próxima partida daquele local a reclama).</summary>
    public const long Saindo = -1;
    /// <summary>GrupoId de quem o jogador escolheu pelo id para o próximo envio (sai antes dos outros).</summary>
    public const long Escolhida = -2;

    public static bool EhSoldado(Mundo m, Pessoa p) => m.B.U.ContainsKey(p.Oficio);

    /// <summary>Soldados na guarnição do local (de qualquer reino: o reforço de um aliado também está aqui).</summary>
    public static IEnumerable<Pessoa> Guarnicao(Mundo m, Local l) =>
        m.PessoasNoLocal(l.Id).Where(p => p.Estado == Estados.Guarnecida && EhSoldado(m, p));

    /// <summary>Todas as pessoas de uma marcha (soldados, explorador, mensageiro, civis).</summary>
    public static IEnumerable<Pessoa> DaMarcha(Mundo m, Marcha mc) => mc.PessoaIds.Select(id => m.Pessoas.Obter(id)).OfType<Pessoa>();
    public static IEnumerable<Pessoa> SoldadosDaMarcha(Mundo m, Marcha mc) => DaMarcha(m, mc).Where(p => EhSoldado(m, p));

    /// <summary>Contagem por unidade de um grupo de pessoas (só soldados).</summary>
    public static Dictionary<string, int> Contar(Mundo m, IEnumerable<Pessoa> ps)
    {
        var d = new Dictionary<string, int>();
        foreach (var p in ps) if (EhSoldado(m, p)) d[p.Oficio] = d.GetValueOrDefault(p.Oficio) + 1;
        return d;
    }

    private static bool Igual(IReadOnlyDictionary<string, int> a, IReadOnlyDictionary<string, int> b) =>
        Reinos.Tropas.Total(a) == Reinos.Tropas.Total(b) && a.All(kv => kv.Value <= 0 || b.GetValueOrDefault(kv.Key) == kv.Value);

    // ---------------------------------------------------------------- contagens

    public static void RecontarGuarnicao(Mundo m, Local l)
    {
        var d = Contar(m, Guarnicao(m, l));
        if (!Igual(d, l.Guarnicao)) { l.Guarnicao = d; m.Sujar(l); }
    }

    public static void RecontarTropas(Mundo m, Marcha mc)
    {
        var d = Contar(m, SoldadosDaMarcha(m, mc));
        if (!Igual(d, mc.Tropas)) { mc.Tropas = d; m.Sujar(mc); }
    }

    /// <summary>Exploradores e mensageiros livres (no castelo, sem missão) viram as contagens do reino.</summary>
    public static void RecontarLivres(Mundo m, Reino r)
    {
        var ex = new Dictionary<string, int>();
        var men = 0;
        foreach (var p in m.PessoasDe(r.Id))
        {
            if (p.Estado != Estados.Guarnecida) continue;
            if (p.Oficio == Oficios.Mensageiro) men++;
            else if (Oficios.TipoExplorador(p.Oficio) is { } t) ex[t] = ex.GetValueOrDefault(t) + 1;
        }
        if (!Igual(ex, r.ExploradoresLivres) || men != r.MensageirosLivres) { r.ExploradoresLivres = ex; r.MensageirosLivres = men; m.Sujar(r); }
    }

    /// <summary>A contagem declarada manda: nascem os soldados que faltam, saem os que sobram.</summary>
    public static void Sincronizar(Mundo m, Local l)
    {
        var atual = Contar(m, Guarnicao(m, l));
        if (Igual(atual, l.Guarnicao)) return;
        var r = m.Reinos.Obter(l.ReinoId);
        foreach (var k in l.Guarnicao.Keys.Concat(atual.Keys).Distinct().ToList())
        {
            var falta = l.Guarnicao.GetValueOrDefault(k) - atual.GetValueOrDefault(k);
            if (falta > 0 && r != null && m.B.U.ContainsKey(k)) for (var i = 0; i < falta; i++) Criar(m, r, l, k, Estados.Guarnecida);
            else if (falta < 0) foreach (var p in Guarnicao(m, l).Where(p => p.Oficio == k).OrderBy(p => p.ReinoId == l.ReinoId ? 1 : 0).ThenByDescending(p => p.Id).Take(-falta).ToList()) Remover(m, p);
        }
        RecontarGuarnicao(m, l);
    }

    public static void Sincronizar(Mundo m, Marcha mc)
    {
        var atual = Contar(m, SoldadosDaMarcha(m, mc));
        if (Igual(atual, mc.Tropas)) return;
        var r = m.Reinos.Obter(mc.ReinoId);
        var casa = mc is Exercito ex ? m.Locais.Obter(ex.OrigemLocalId) : mc is Caravana cv ? m.Locais.Obter(cv.BaseLocalId) : null;
        casa ??= r != null ? m.Locais.Obter(r.CasteloId) : null;
        foreach (var k in mc.Tropas.Keys.Concat(atual.Keys).Distinct().ToList())
        {
            var falta = mc.Tropas.GetValueOrDefault(k) - atual.GetValueOrDefault(k);
            if (falta > 0 && r != null && m.B.U.ContainsKey(k))
                for (var i = 0; i < falta; i++)
                {
                    var p = Criar(m, r, casa, k, Estados.Marchando);
                    p.GrupoId = mc.Id; mc.PessoaIds.Add(p.Id); m.Sujar(p);
                }
            else if (falta < 0)
                foreach (var p in SoldadosDaMarcha(m, mc).Where(p => p.Oficio == k).OrderByDescending(p => p.Id).Take(-falta).ToList()) { mc.PessoaIds.Remove(p.Id); Remover(m, p); }
        }
        m.Sujar(mc);
        RecontarTropas(m, mc);
    }

    /// <summary>Exploradores e mensageiros livres declarados no reino que ainda não existem como pessoas nascem no castelo.</summary>
    public static void SincronizarLivres(Mundo m, Reino r)
    {
        var casa = m.Locais.Obter(r.CasteloId);
        var livres = m.PessoasDe(r.Id).Where(p => p.Estado == Estados.Guarnecida && !EhSoldado(m, p) && !p.EhCivil).ToList();
        foreach (var (tipo, n) in r.ExploradoresLivres.ToList())
        {
            var of = Oficios.DeExplorador(tipo);
            var tem = livres.Count(p => p.Oficio == of);
            for (var i = tem; i < n; i++) Criar(m, r, casa, of, Estados.Guarnecida);
            foreach (var p in livres.Where(p => p.Oficio == of).Skip(n).ToList()) Remover(m, p);
        }
        foreach (var p in livres.Where(p => Oficios.TipoExplorador(p.Oficio) is { } t && !r.ExploradoresLivres.ContainsKey(t)).ToList()) Remover(m, p);
        var mens = livres.Count(p => p.Oficio == Oficios.Mensageiro);
        for (var i = mens; i < r.MensageirosLivres; i++) Criar(m, r, casa, Oficios.Mensageiro, Estados.Guarnecida);
        foreach (var p in livres.Where(p => p.Oficio == Oficios.Mensageiro).Skip(Math.Max(0, r.MensageirosLivres)).ToList()) Remover(m, p);
        RecontarLivres(m, r);
    }

    /// <summary>Confere o mundo inteiro: toda contagem bate com as pessoas (teste de consistência). Devolve as diferenças.</summary>
    public static List<string> Conferir(Mundo m)
    {
        var erros = new List<string>();
        foreach (var l in m.Locais)
            if (!Igual(Contar(m, Guarnicao(m, l)), l.Guarnicao)) erros.Add("guarnição de " + l.Nome + " #" + l.Id);
        foreach (var mc in m.Marchas)
            if (!Igual(Contar(m, SoldadosDaMarcha(m, mc)), mc.Tropas)) erros.Add("tropas da marcha " + mc.Tipo + " #" + mc.Id);
        foreach (var r in m.Reinos.Where(r => r.Ativo))
        {
            var civis = Civis(m, r.Id).Count();
            if (Math.Abs(civis - r.Pop) > 1e-9) erros.Add("população de " + r.Nome);
            var livres = m.PessoasDe(r.Id).Where(p => p.Estado == Estados.Guarnecida && !EhSoldado(m, p) && !p.EhCivil).ToList();
            var ex = new Dictionary<string, int>();
            foreach (var p in livres) if (Oficios.TipoExplorador(p.Oficio) is { } t) ex[t] = ex.GetValueOrDefault(t) + 1;
            if (!Igual(ex, r.ExploradoresLivres)) erros.Add("exploradores livres de " + r.Nome);
            if (livres.Count(p => p.Oficio == Oficios.Mensageiro) != r.MensageirosLivres) erros.Add("mensageiros livres de " + r.Nome);
        }
        foreach (var p in m.Pessoas)
            if (p.GrupoId is long g && g > 0 && (m.Marchas.Obter(g) is not { } mc || !mc.PessoaIds.Contains(p.Id))) erros.Add("pessoa " + p.Nome + " #" + p.Id + " numa marcha que não a tem");
        return erros;
    }

    // ---------------------------------------------------------------- criar, sair, entrar

    /// <summary>Soldados novos na guarnição (kit do exílio, cenários).</summary>
    public static List<Pessoa> CriarSoldados(Mundo m, Reino r, Local l, IReadOnlyDictionary<string, int> grupo)
    {
        Sincronizar(m, l);
        var lista = new List<Pessoa>();
        foreach (var (k, n) in grupo) for (var i = 0; i < n; i++) lista.Add(Criar(m, r, l, k, Estados.Guarnecida));
        RecontarGuarnicao(m, l);
        return lista;
    }

    /// <summary>
    /// Tira da guarnição <paramref name="grupo"/> (por unidade): as escolhidas pelo jogador primeiro, depois as mais veteranas.
    /// Só pessoas do reino <paramref name="reinoId"/> (o dono do local, por padrão: o reforço de um aliado continua dele);
    /// null = qualquer reino (a defesa inteira recua). Ficam "saindo" até a próxima partida daquele local as reclamar.
    /// </summary>
    public static List<Pessoa> Sair(Mundo m, Local l, IReadOnlyDictionary<string, int> grupo, long? reinoId, bool todosOsReinos = false)
    {
        Sincronizar(m, l);
        var dono = reinoId ?? l.ReinoId;
        var lista = new List<Pessoa>();
        foreach (var (k, n) in grupo)
        {
            if (n <= 0) continue;
            lista.AddRange(Guarnicao(m, l).Where(p => p.Oficio == k && (todosOsReinos || p.ReinoId == dono))
                .OrderByDescending(p => p.GrupoId == Escolhida ? 1 : 0).ThenByDescending(p => p.Marcas).ThenBy(p => p.Id).Take(n));
        }
        foreach (var p in lista) { p.Estado = Estados.Marchando; p.GrupoId = Saindo; m.Sujar(p); }
        RecontarGuarnicao(m, l);
        return lista;
    }

    /// <summary>Põe as pessoas na marcha.</summary>
    public static void Embarcar(Mundo m, Marcha mc, IEnumerable<Pessoa> pessoas)
    {
        var soldado = false;
        foreach (var p in pessoas)
        {
            p.GrupoId = mc.Id; p.Estado = Estados.Marchando; m.Sujar(p);
            if (!mc.PessoaIds.Contains(p.Id)) mc.PessoaIds.Add(p.Id);
            soldado |= EhSoldado(m, p);
        }
        m.Sujar(mc);
        if (soldado) RecontarTropas(m, mc);   // só o explorador ou o mensageiro a bordo: a contagem declarada da escolta fica
    }

    /// <summary>
    /// A marcha reclama quem estava saindo do local de origem dela (gancho de <see cref="Marcha.AoPartir"/>; chame direto
    /// numa marcha criada parada). Depois, a contagem declarada manda (marchas de cenário sem pessoas ganham pessoas).
    /// </summary>
    public static void Reclamar(Mundo m, Marcha mc)
    {
        if (mc is Deslocamento) return;
        var origem = mc.Caminho.Count > 0 ? m.LocalNoHex(mc.Caminho[0]) : null;
        var precisa = new Dictionary<string, int>(mc.Tropas);
        foreach (var p in SoldadosDaMarcha(m, mc)) precisa[p.Oficio] = precisa.GetValueOrDefault(p.Oficio) - 1;
        var saindo = (origem != null ? m.PessoasNoLocal(origem.Id) : m.PessoasDe(mc.ReinoId))
            .Where(p => p.GrupoId == Saindo && (origem != null || p.ReinoId == mc.ReinoId) && precisa.GetValueOrDefault(p.Oficio) > 0)
            .OrderBy(p => p.Id).ToList();
        var leva = new List<Pessoa>();
        foreach (var p in saindo)
        {
            if (precisa[p.Oficio] <= 0) continue;
            precisa[p.Oficio]--; leva.Add(p);
        }
        if (leva.Count > 0) Embarcar(m, mc, leva);
        Sincronizar(m, mc);
    }

    /// <summary>Os soldados da marcha entram na guarnição do local.</summary>
    public static void Desembarcar(Mundo m, Marcha mc, Local l)
    {
        Sincronizar(m, mc);
        Sincronizar(m, l);
        foreach (var p in SoldadosDaMarcha(m, mc).ToList())
        {
            MudarLocal(m, p, l.Id);
            p.Estado = Estados.Guarnecida; p.GrupoId = null; m.Sujar(p);
            mc.PessoaIds.Remove(p.Id);
        }
        m.Sujar(mc);
        RecontarTropas(m, mc);
        RecontarGuarnicao(m, l);
    }

    /// <summary>Passa <paramref name="grupo"/> de uma marcha para "saindo" (um reforço aliado que deixa o exército que recuou).</summary>
    public static List<Pessoa> Transferir(Mundo m, Marcha de, IReadOnlyDictionary<string, int> grupo, long reinoId)
    {
        Sincronizar(m, de);
        var lista = new List<Pessoa>();
        foreach (var (k, n) in grupo)
            lista.AddRange(SoldadosDaMarcha(m, de).Where(p => p.Oficio == k && p.ReinoId == reinoId).OrderBy(p => p.Id).Take(n));
        foreach (var p in lista) { de.PessoaIds.Remove(p.Id); p.GrupoId = Saindo; m.Sujar(p); }
        m.Sujar(de);
        RecontarTropas(m, de);
        return lista;
    }

    /// <summary>Ninguém sobrou: todos os soldados da marcha morrem. Devolve os nomes.</summary>
    public static List<string> Aniquilar(Mundo m, Marcha mc)
    {
        var nomes = new List<string>();
        foreach (var p in SoldadosDaMarcha(m, mc).ToList()) { nomes.Add(p.Nome); mc.PessoaIds.Remove(p.Id); Remover(m, p); }
        mc.Tropas = new(); m.Sujar(mc);
        return nomes;
    }

    /// <summary>Todos os soldados da guarnição morrem (ocupação, ruína, abdicação).</summary>
    public static List<string> LimparGuarnicao(Mundo m, Local l)
    {
        var nomes = new List<string>();
        foreach (var p in Guarnicao(m, l).ToList()) { nomes.Add(p.Nome); Remover(m, p); }
        l.Guarnicao.Clear(); m.Sujar(l);
        return nomes;
    }

    // ---------------------------------------------------------------- baixas

    /// <summary>Sorteia, por unidade, quem cai entre as candidatas.</summary>
    private static List<Pessoa> SortearBaixas(Mundo m, IEnumerable<Pessoa> candidatas, IReadOnlyDictionary<string, int> perdas)
    {
        var lista = new List<Pessoa>();
        var cand = candidatas.ToList();
        foreach (var (k, n) in perdas)
        {
            if (n <= 0) continue;
            var da = cand.Where(p => p.Oficio == k).ToList();
            m.Sorte.Embaralhar(da);
            lista.AddRange(da.Take(n));
        }
        return lista;
    }

    /// <summary>
    /// Baixas de uma marcha: as pessoas caídas saem dela (ainda não morreram: <see cref="Enterrar"/> decide quem fica ferida).
    /// Numa marcha sem pessoas (provisória, sem id) só a contagem muda.
    /// </summary>
    public static List<Pessoa> Baixas(Mundo m, Marcha mc, IReadOnlyDictionary<string, int> perdas)
    {
        if (mc.Id == 0) { Combates.Tirar(mc.Tropas, perdas); return new(); }
        Sincronizar(m, mc);
        var caidas = SortearBaixas(m, SoldadosDaMarcha(m, mc), perdas);
        foreach (var p in caidas) { mc.PessoaIds.Remove(p.Id); p.GrupoId = null; m.Sujar(p); }
        m.Sujar(mc);
        RecontarTropas(m, mc);
        return caidas;
    }

    /// <summary>
    /// Baixas de uma guarnição, divididas entre o dono e os reforços aliados na proporção de cada um por unidade
    /// (a mesma conta de <see cref="Reforcos.PartesDasPerdas"/>).
    /// </summary>
    public static List<Pessoa> Baixas(Mundo m, Local l, IReadOnlyDictionary<string, int> perdas)
    {
        Sincronizar(m, l);
        var caidas = new List<Pessoa>();
        var resto = new Dictionary<string, int>(perdas);
        foreach (var (e, pe) in Reforcos.PartesDasPerdas(l, l.Guarnicao, perdas))
        {
            caidas.AddRange(SortearBaixas(m, Guarnicao(m, l).Where(p => p.ReinoId == e.ReinoId), pe));
            foreach (var (k, n) in pe) resto[k] = resto.GetValueOrDefault(k) - n;
        }
        caidas.AddRange(SortearBaixas(m, Guarnicao(m, l).Where(p => p.ReinoId == l.ReinoId).Except(caidas), resto));
        foreach (var p in caidas) { MudarLocal(m, p, null); p.GrupoId = null; m.Sujar(p); }
        RecontarGuarnicao(m, l);
        return caidas;
    }

    /// <summary>
    /// Decide o destino de quem caiu: <paramref name="feridos"/> (por unidade) ficam feridas e vão ao castelo do reino delas;
    /// as outras morrem. Devolve os nomes de quem morreu e as feridas.
    /// </summary>
    public static (List<string> mortos, List<Pessoa> feridas) Enterrar(Mundo m, IEnumerable<Pessoa> caidas, IReadOnlyDictionary<string, int>? feridos)
    {
        var resta = new Dictionary<string, int>(feridos ?? new Dictionary<string, int>());
        var mortos = new List<string>(); var feridas = new List<Pessoa>();
        foreach (var p in caidas)
        {
            if (resta.GetValueOrDefault(p.Oficio) > 0)
            {
                resta[p.Oficio]--;
                p.Estado = Estados.Ferida; p.GrupoId = null; p.ItemId = null;
                if (m.Reinos.Obter(p.ReinoId) is { } r) MudarLocal(m, p, r.CasteloId);
                m.Sujar(p);
                feridas.Add(p);
            }
            else { mortos.Add(p.Nome); Remover(m, p); }
        }
        return (mortos, feridas);
    }

    /// <summary>Feridas curadas voltam à guarnição do local.</summary>
    public static void Curadas(Mundo m, IEnumerable<Pessoa> pessoas, Local l)
    {
        Sincronizar(m, l);
        foreach (var p in pessoas) { MudarLocal(m, p, l.Id); p.Estado = Estados.Guarnecida; p.GrupoId = null; p.ItemId = null; m.Sujar(p); }
        RecontarGuarnicao(m, l);
    }

    // ---------------------------------------------------------------- escolha pelo id

    /// <summary>
    /// O jogador escolheu pessoas pelo id para um envio: confere que são soldados dele, na guarnição de <paramref name="l"/>, e as
    /// marca como escolhidas (saem antes das outras). Devolve a contagem por unidade. Descarte para desfazer o que não saiu.
    /// </summary>
    public static Escolha Escolher(Mundo m, Reino r, Local l, IReadOnlyList<long> ids)
    {
        Sincronizar(m, l);
        var lista = new List<Pessoa>();
        foreach (var id in ids.Distinct())
        {
            var p = m.Pessoas.Obter(id);
            if (p == null || p.ReinoId != r.Id) throw new RegraException("Pessoa não encontrada.", 404);
            if (!EhSoldado(m, p)) throw new RegraException(p.Nome + " não é soldado.");
            if (p.Estado != Estados.Guarnecida || p.LocalId != l.Id) throw new RegraException(p.Nome + " não está em " + l.Nome + ".");
            lista.Add(p);
        }
        if (lista.Count == 0) throw new RegraException("Escolha pelo menos uma pessoa.");
        foreach (var p in lista) { p.GrupoId = Escolhida; m.Sujar(p); }
        return new Escolha(m, lista, Contar(m, lista));
    }

    /// <summary>Pessoas escolhidas pelo id para um envio; ao descartar, quem não saiu volta ao normal.</summary>
    public sealed class Escolha(Mundo m, List<Pessoa> pessoas, Dictionary<string, int> grupo) : IDisposable
    {
        public Dictionary<string, int> Grupo { get; } = grupo;
        public IReadOnlyList<Pessoa> Pessoas { get; } = pessoas;
        public void Dispose()
        {
            foreach (var p in pessoas) if (p.GrupoId == Escolhida) { p.GrupoId = null; m.Sujar(p); }
        }
    }
}
