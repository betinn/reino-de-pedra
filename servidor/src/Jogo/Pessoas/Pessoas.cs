using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.Pessoas;

/// <summary>
/// As pessoas do reino: nascimento e morte com nome, vagas de trabalho por local, atribuição automática e manual,
/// quem é levado para carregar ou treinar. Toda mudança de população civil passa por aqui, que mantém
/// <see cref="Reino.Pop"/> (contagem das pessoas civis) e os índices do <see cref="Mundo"/>.
/// </summary>
[Sistema]
public static partial class Pessoas
{
    public static void AoIniciar(Mundo m) => Sistemas.UmaVez("pessoas", () =>
    {
        Marcha.AoPartir.Add(Reclamar);
        Marcha.AoEncerrar.Add(AoEncerrarMarcha);
    });

    /// <summary>A marcha acabou com gente ainda dentro: quem não desembarcou antes some (morreu, foi capturado, o reino acabou).</summary>
    private static void AoEncerrarMarcha(Mundo m, Marcha mc)
    {
        foreach (var p in DaMarcha(m, mc).Where(p => p.GrupoId == mc.Id).ToList()) Remover(m, p);
        mc.PessoaIds.Clear();
    }

    // ---------------------------------------------------------------- consultas

    public static IEnumerable<Pessoa> Civis(Mundo m, long reinoId) => m.PessoasDe(reinoId).Where(p => p.EhCivil);

    /// <summary>Civis presentes no local (trabalhando ou sem trabalho): a milícia da defesa e quem o massacre mata.</summary>
    public static IEnumerable<Pessoa> Presentes(Mundo m, Local l) => m.PessoasNoLocal(l.Id).Where(p => p.Presente);

    /// <summary>Civis que podem ser recrutados ou levados agora (presentes em algum local do reino).</summary>
    public static IEnumerable<Pessoa> Livres(Mundo m, long reinoId) => Civis(m, reinoId).Where(p => p.Presente);

    /// <summary>Vagas de trabalho do local (só locais de produção; ruína não tem).</summary>
    public static int Vagas(Mundo m, Local l) => l.EhProducao && !l.Ruina ? m.F.Vagas(l.Nivel) : 0;

    /// <summary>Quem está produzindo agora no local (presente, com o ofício do local).</summary>
    public static int Trabalhando(Mundo m, Local l)
    {
        var of = Oficios.DoLocal(l);
        return of == null ? 0 : m.PessoasNoLocal(l.Id).Count(p => p.Estado == Estados.Trabalhando && p.Oficio == of);
    }

    /// <summary>Vagas tomadas: quem trabalha aqui, mesmo que esteja fora carregando ou a caminho (a vaga fica dela).</summary>
    public static int VagasTomadas(Mundo m, Local l)
    {
        var of = Oficios.DoLocal(l);
        return of == null ? 0 : m.PessoasNoLocal(l.Id).Count(p => p.Oficio == of && p.Estado is Estados.Trabalhando or Estados.Andando or Estados.Carregando);
    }

    public static int VagasLivres(Mundo m, Local l) => Math.Max(0, Vagas(m, l) - VagasTomadas(m, l));

    /// <summary>Hexágono onde a pessoa está agora (na marcha, se estiver numa; senão, no local).</summary>
    public static int HexDe(Mundo m, Pessoa p)
    {
        if (p.GrupoId is long g && m.Marchas.Obter(g) is { } mc) return mc.HexEm(m.Agora);
        if (p.LocalId is long l && m.Locais.Obter(l) is { } loc) return loc.Hex;
        return -1;
    }

    /// <summary>"Inês, Pero e Gil".</summary>
    public static string Nomear(IReadOnlyList<string> nomes) => nomes.Count switch
    {
        0 => "", 1 => nomes[0], _ => string.Join(", ", nomes.Take(nomes.Count - 1)) + " e " + nomes[^1],
    };

    // ---------------------------------------------------------------- nascimento e morte

    /// <summary>Recalcula a população civil do reino (contagem das pessoas civis).</summary>
    public static void Recontar(Mundo m, Reino r)
    {
        var n = Civis(m, r.Id).Count();
        if (Math.Abs(r.Pop - n) > 1e-9) { r.Pop = n; m.Sujar(r); }
    }

    /// <summary>Cria uma pessoa com nome sorteado, no local e estado dados.</summary>
    public static Pessoa Criar(Mundo m, Reino r, Local? local, string oficio, string estado)
    {
        var (nome, fem) = NomesDePessoa.Sortear(m, r);
        var p = m.Pessoas.Adicionar(new Pessoa
        {
            ReinoId = r.Id, Nome = nome, Feminina = fem, Oficio = oficio, LocalId = local?.Id, Estado = estado, NasceuEm = m.Agora,
        });
        m.IndexarPessoa(p);
        Recontar(m, r);
        return p;
    }

    /// <summary>
    /// Nascem <paramref name="n"/> pessoas no castelo (ou em <paramref name="onde"/>), cada uma vai para a vaga mais necessária.
    /// <paramref name="andar"/>: caminha até lá, visível no mapa (false: já aparece no local, na fundação do reino).
    /// </summary>
    public static List<Pessoa> Nascer(Mundo m, Reino r, int n, bool andar = true, Local? onde = null)
    {
        var casa = onde ?? m.Locais.Obter(r.CasteloId) ?? m.LocaisDe(r.Id).FirstOrDefault(l => !l.Ruina);
        var lista = new List<Pessoa>();
        for (var i = 0; i < n; i++)
        {
            var p = Criar(m, r, casa, Oficios.Ocioso, Estados.Ociosa);
            Atribuir(m, r, p, andar);
            lista.Add(p);
        }
        if (n > 0) m.Avisar(r.Id, "reino");
        return lista;
    }

    /// <summary>Tira a pessoa do mundo (morte, saída do reino) e mantém as contagens de onde ela estava.</summary>
    public static void Remover(Mundo m, Pessoa p)
    {
        m.DesindexarPessoa(p);
        m.Pessoas.Remover(p);
        var r = m.Reinos.Obter(p.ReinoId);
        if (p.EhCivil) { if (r != null) Recontar(m, r); return; }
        if (p.GrupoId is long g && g > 0 && m.Marchas.Obter(g) is { } mc && mc.PessoaIds.Remove(p.Id)) RecontarTropas(m, mc);
        if (p.Estado == Estados.Guarnecida && p.LocalId is long lid && m.Locais.Obter(lid) is { } l)
        {
            if (EhSoldado(m, p)) RecontarGuarnicao(m, l);
            else if (r != null) RecontarLivres(m, r);
        }
    }

    /// <summary>Mata até <paramref name="n"/> pessoas sorteadas entre as candidatas. Devolve os nomes.</summary>
    public static List<string> Matar(Mundo m, IEnumerable<Pessoa> candidatas, int n)
    {
        var lista = candidatas.ToList();
        if (n <= 0 || lista.Count == 0) return new();
        m.Sorte.Embaralhar(lista);
        var nomes = new List<string>();
        foreach (var p in lista.Take(n)) { nomes.Add(p.Nome); Remover(m, p); }
        return nomes;
    }

    /// <summary>Atalho de teste e de cenário: o reino fica exatamente com <paramref name="n"/> civis, todos presentes em <paramref name="l"/>.</summary>
    public static void Povoar(Mundo m, Reino r, Local l, int n)
    {
        foreach (var p in m.PessoasDe(r.Id).ToList()) Remover(m, p);
        var of = Oficios.DoLocal(l);
        var vagas = Vagas(m, l);
        for (var i = 0; i < n; i++)
            Criar(m, r, l, of != null && i < vagas ? of : Oficios.Ocioso, of != null && i < vagas ? Estados.Trabalhando : Estados.Ociosa);
    }

    /// <summary>Tira <paramref name="n"/> civis livres do reino (atalho de teste: "viraram tropa").</summary>
    public static void RemoverCivis(Mundo m, Reino r, int n)
    {
        foreach (var p in ParaLevar(m, r).Take(n).ToList()) Remover(m, p);
    }

    /// <summary>Todas as pessoas do reino saem do mundo (abdicação de IA).</summary>
    public static void RemoverTodas(Mundo m, Reino r)
    {
        foreach (var p in m.PessoasDe(r.Id).ToList()) Remover(m, p);
    }

    // ---------------------------------------------------------------- onde fica

    private static void MudarLocal(Mundo m, Pessoa p, long? localId)
    {
        if (p.LocalId == localId) return;
        m.DesindexarPessoa(p);
        p.LocalId = localId;
        m.IndexarPessoa(p);
        m.Sujar(p);
    }

    /// <summary>A pessoa passa a estar no local, com o ofício dado (ocioso = sem trabalho), fora de qualquer marcha.</summary>
    public static void Ficar(Mundo m, Pessoa p, Local l, string oficio)
    {
        MudarLocal(m, p, l.Id);
        p.Oficio = oficio; p.GrupoId = null; p.ItemId = null;
        p.Estado = oficio == Oficios.Ocioso ? Estados.Ociosa : Estados.Trabalhando;
        m.Sujar(p);
    }

    /// <summary>Melhor vaga livre para a pessoa: o ofício anterior, se houver vaga nele; senão o local com mais vagas livres, o mais perto.</summary>
    public static Local? MelhorVaga(Mundo m, Reino r, Pessoa p)
    {
        var de = HexDe(m, p);
        return m.LocaisDe(r.Id).Where(l => VagasLivres(m, l) > 0)
            .OrderByDescending(l => p.OficioAnterior != null && Oficios.DoLocal(l) == p.OficioAnterior ? 1 : 0)
            .ThenByDescending(l => VagasLivres(m, l))
            .ThenBy(l => de < 0 ? 0 : m.G.Distancia(de, l.Hex)).ThenBy(l => l.Id)
            .FirstOrDefault();
    }

    /// <summary>Atribuição automática: a vaga mais necessária, ou sem trabalho no castelo. Caminha se estiver noutro hexágono.</summary>
    public static void Atribuir(Mundo m, Reino r, Pessoa p, bool andar = true)
    {
        var l = MelhorVaga(m, r, p);
        if (l != null) { Ir(m, r, p, l, Oficios.DoLocal(l)!, andar); return; }
        var casa = m.Locais.Obter(r.CasteloId);
        if (casa == null || casa.ReinoId != r.Id) casa = m.LocaisDe(r.Id).FirstOrDefault(x => !x.Ruina);
        if (casa == null) { Remover(m, p); return; }   // reino sem local nenhum: ninguém fica
        Ir(m, r, p, casa, Oficios.Ocioso, andar);
    }

    /// <summary>Manda a pessoa ao local com o ofício dado: na hora se já está lá, senão numa marcha (ou sem andar).</summary>
    private static void Ir(Mundo m, Reino r, Pessoa p, Local l, string oficio, bool andar)
    {
        var de = HexDe(m, p);
        if (!andar || de < 0 || de == l.Hex) { Ficar(m, p, l, oficio); return; }
        if (p.GrupoId is long g && m.Marchas.Obter(g) is Deslocamento d)
        {
            // já estava andando: sai da marcha antiga (a marcha fica para os outros; vazia, some)
            d.PessoaIds.Remove(p.Id); m.Sujar(d);
            if (d.PessoaIds.Count == 0) d.Encerrar(m);
        }
        MudarLocal(m, p, l.Id);
        p.Oficio = oficio; p.ItemId = null;
        m.Sujar(p);
        Deslocamento.Partir(m, r, [p], de, l);
    }

    /// <summary>Chegou ao fim do deslocamento: fica no local se ele ainda é do reino (com a vaga, se a tinha); senão, é reatribuída dali.</summary>
    internal static void Chegou(Mundo m, Pessoa p, Local? l)
    {
        var r = m.Reinos.Obter(p.ReinoId);
        if (r == null || !r.Ativo) { Remover(m, p); return; }
        p.GrupoId = null;
        if (l != null && l.ReinoId == r.Id && !l.Ruina)
        {
            var of = Oficios.DoLocal(l);
            if (p.Oficio == of && of != null) { Ficar(m, p, l, of); return; }
            if (p.Oficio == Oficios.Ocioso) { Ficar(m, p, l, Oficios.Ocioso); return; }   // quem foi levado sem trabalho fica assim (a vaga que deixou é do jogador)
        }
        p.Oficio = Oficios.Ocioso; p.Estado = Estados.Ociosa;
        MudarLocal(m, p, l?.Id);
        Atribuir(m, r, p);
    }

    /// <summary>Ociosos presentes vão para as vagas livres (depois de subir nível, fundar, ocupar, cancelar treino).</summary>
    public static void PreencherVagas(Mundo m, Reino r)
    {
        foreach (var p in Civis(m, r.Id).Where(p => p.Oficio == Oficios.Ocioso && p.Estado == Estados.Ociosa).ToList())
        {
            var l = MelhorVaga(m, r, p);
            if (l == null) return;
            Ir(m, r, p, l, Oficios.DoLocal(l)!, true);
        }
    }

    /// <summary>
    /// O local mudou de dono ou perdeu vagas (ocupação, sabotagem, ruína, queda): quem era de outro reino sai dali para a vaga
    /// mais necessária ou para o castelo; quem sobra sem vaga é reatribuído. Quem está fora (carregando, a caminho) passa a ter
    /// o castelo por casa e é reatribuído quando chegar.
    /// </summary>
    public static void LocalMudou(Mundo m, Local l)
    {
        foreach (var grupo in m.PessoasNoLocal(l.Id).Where(p => p.EhCivil).GroupBy(p => p.ReinoId).ToList())
        {
            var r = m.Reinos.Obter(grupo.Key);
            if (r == null || !r.Ativo) { foreach (var p in grupo) Remover(m, p); continue; }
            var seu = l.ReinoId == r.Id && !l.Ruina;
            List<Pessoa> saem;
            if (!seu) saem = grupo.ToList();
            else
            {
                var of = Oficios.DoLocal(l);
                var excesso = VagasTomadas(m, l) - Vagas(m, l);
                saem = excesso <= 0 ? new() : grupo.Where(p => p.Oficio == of).OrderBy(p => p.Presente ? 0 : 1).Take(excesso).ToList();
            }
            foreach (var p in saem) Sair(m, r, p, l);
        }
    }

    private static void Sair(Mundo m, Reino r, Pessoa p, Local l)
    {
        p.OficioAnterior = p.Oficio; p.Oficio = Oficios.Ocioso; m.Sujar(p);
        if (p.Presente) { p.Estado = Estados.Ociosa; Atribuir(m, r, p); return; }
        var casa = m.Locais.Obter(r.CasteloId);
        if (casa != null && casa.ReinoId == r.Id && casa.Id != l.Id) MudarLocal(m, p, casa.Id);
    }

    // ---------------------------------------------------------------- ordens do jogador

    public static Pessoa Da(Mundo m, Reino r, long pessoaId)
    {
        var p = m.Pessoas.Obter(pessoaId);
        if (p == null || p.ReinoId != r.Id) throw new RegraException("Pessoa não encontrada.", 404);
        return p;
    }

    /// <summary>
    /// Troca o trabalho da pessoa: vai para <paramref name="localId"/> com o ofício dado (null = o do local; o castelo e os
    /// locais sem vagas deixam sem trabalho). <paramref name="ouSemTrabalho"/>: sem vaga livre, vai mesmo assim, sem trabalho
    /// ("levar para"). Só civis presentes ou a caminho; quem carrega ou treina termina antes.
    /// </summary>
    public static Pessoa Trabalhar(Mundo m, Reino r, long pessoaId, long localId, string? oficio = null, bool ouSemTrabalho = false)
    {
        var p = Da(m, r, pessoaId);
        if (!p.EhCivil) throw new RegraException("Só civis trocam de trabalho.");
        if (p.Estado is Estados.Carregando or Estados.Treinando or Estados.Coletando) throw new RegraException(p.Nome + " está " + (p.Estado switch { Estados.Carregando => "carregando", Estados.Coletando => "coletando", _ => "em treino" }) + " e termina antes de mudar.");
        var l = m.Locais.Obter(localId);
        if (l == null || l.ReinoId != r.Id) throw new RegraException("Local não é seu.", 404);
        if (l.Ruina) throw new RegraException("O local está em ruínas.");
        Economia.Atualizar(m, r);
        var doLocal = Oficios.DoLocal(l);
        var jaAqui = p.LocalId == l.Id && p.Oficio == doLocal && doLocal != null;
        oficio ??= doLocal == null || ouSemTrabalho && !jaAqui && VagasLivres(m, l) <= 0 ? Oficios.Ocioso : doLocal;
        if (oficio != Oficios.Ocioso)
        {
            if (oficio != doLocal) throw new RegraException("Esse ofício não existe em " + l.Nome + ".");
            if (!jaAqui && VagasLivres(m, l) <= 0) throw new RegraException(l.Nome + " não tem vaga livre.");
        }
        if (jaAqui && oficio == doLocal && p.Estado == Estados.Trabalhando) return p;
        p.OficioAnterior = null;
        Ir(m, r, p, l, oficio, true);
        m.Avisar(r.Id, "reino");
        return p;
    }

    /// <summary>Leva a pessoa para outro local: toma uma vaga lá se houver, senão fica sem trabalho.</summary>
    public static Pessoa Mover(Mundo m, Reino r, long pessoaId, long localId) => Trabalhar(m, r, pessoaId, localId, null, ouSemTrabalho: true);

    /// <summary>Opções de trabalho para a pessoa: locais com vaga livre (do mais necessário ao menos) e o castelo (sem trabalho).</summary>
    public static List<(Local local, string oficio, int livres, int vagas)> Opcoes(Mundo m, Reino r, Pessoa p)
    {
        var de = HexDe(m, p);
        var lista = m.LocaisDe(r.Id).Where(l => !l.Ruina && Oficios.DoLocal(l) != null)
            .Select(l => (local: l, oficio: Oficios.DoLocal(l)!, livres: VagasLivres(m, l) + (p.LocalId == l.Id && p.Oficio == Oficios.DoLocal(l) ? 1 : 0), vagas: Vagas(m, l)))
            .Where(x => x.livres > 0)
            .OrderByDescending(x => x.livres).ThenBy(x => de < 0 ? 0 : m.G.Distancia(de, x.local.Hex)).ToList();
        if (m.Locais.Obter(r.CasteloId) is { } c && c.ReinoId == r.Id) lista.Add((c, Oficios.Ocioso, 0, 0));
        return lista;
    }

    // ---------------------------------------------------------------- levar gente (carregar, treinar)

    /// <summary>Ordem em que as pessoas são levadas: sem trabalho primeiro, depois trabalhadores dos locais de nível mais baixo.</summary>
    private static IEnumerable<Pessoa> ParaLevar(Mundo m, Reino r, Local? origem = null)
    {
        var livres = Livres(m, r.Id);
        if (origem != null) livres = livres.Where(p => p.LocalId == origem.Id);
        return livres.OrderBy(p => p.Oficio == Oficios.Ocioso ? 0 : 1)
            .ThenBy(p => p.LocalId is long id && m.Locais.Obter(id) is { } l ? l.Nivel : 0).ThenBy(p => p.Id);
    }

    /// <summary>Civis presentes no local, para carregar: sem trabalho primeiro, depois trabalhadores. Até <paramref name="n"/>.</summary>
    public static List<Pessoa> Tomar(Mundo m, Reino r, Local origem, int n, long grupoId)
    {
        var lista = ParaLevar(m, r, origem).Take(n).ToList();
        foreach (var p in lista) { p.Estado = Estados.Carregando; p.GrupoId = grupoId; m.Sujar(p); }
        return lista;
    }

    /// <summary>Volta do carregamento: retoma a vaga (se o local ainda é do reino) ou é reatribuída.</summary>
    public static void Soltar(Mundo m, Pessoa p, Local? onde)
    {
        var r = m.Reinos.Obter(p.ReinoId);
        if (r == null || !r.Ativo) { Remover(m, p); return; }
        p.GrupoId = null;
        var casa = p.LocalId is long id ? m.Locais.Obter(id) : null;
        if (casa != null && casa.ReinoId == r.Id && !casa.Ruina && (p.Oficio == Oficios.Ocioso || p.Oficio == Oficios.DoLocal(casa)))
        {
            if (onde != null && onde.Id != casa.Id && onde.Hex != casa.Hex) { p.Estado = Estados.Ociosa; m.Sujar(p); Ir(m, r, p, casa, p.Oficio, true); }
            else Ficar(m, p, casa, p.Oficio);
            if (p.Oficio == Oficios.Ocioso) PreencherVagas(m, r);
            return;
        }
        p.Oficio = Oficios.Ocioso; p.Estado = Estados.Ociosa;
        MudarLocal(m, p, onde?.Id);
        Atribuir(m, r, p);
    }

    /// <summary>Quantos civis podem ser recrutados agora.</summary>
    public static int LivresParaTreino(Mundo m, Reino r) => Livres(m, r.Id).Count();

    /// <summary>
    /// Leva <paramref name="n"/> civis para o treino do item (ociosos primeiro, depois trabalhadores das vagas menos necessárias):
    /// passam ao ofício da unidade, no local do treino. Cancelar devolve ao ofício anterior.
    /// </summary>
    public static List<Pessoa> ParaTreino(Mundo m, Reino r, int n, string oficio, ItemFila item, Local onde)
    {
        var lista = ParaLevar(m, r).Take(n).ToList();
        if (lista.Count < n) throw new RegraException($"Falta população civil livre: precisa de {n}, há {lista.Count}.");
        foreach (var p in lista)
        {
            p.OficioAnterior = p.Oficio; p.Oficio = oficio; p.Estado = Estados.Treinando; p.ItemId = item.Id; p.GrupoId = null;
            MudarLocal(m, p, onde.Id);
            m.Sujar(p);
        }
        Recontar(m, r);
        return lista;
    }

    public static IEnumerable<Pessoa> EmTreino(Mundo m, Reino r, ItemFila item) =>
        m.PessoasDe(r.Id).Where(p => p.ItemId == item.Id && p.Estado == Estados.Treinando).OrderBy(p => p.Id);

    /// <summary>Treino cancelado: quem ainda não ficou pronto volta a ser civil, no ofício anterior se houver vaga.</summary>
    public static void TreinoCancelado(Mundo m, Reino r, ItemFila item)
    {
        var lista = EmTreino(m, r, item).ToList();
        foreach (var p in lista)
        {
            p.Oficio = Oficios.Ocioso; p.Estado = Estados.Ociosa; p.ItemId = null;
            m.Sujar(p);
        }
        Recontar(m, r);
        foreach (var p in lista) Atribuir(m, r, p);
    }

    /// <summary>
    /// <paramref name="n"/> pessoas do item ficaram prontas: entram na guarnição de <paramref name="l"/> com o ofício da unidade
    /// (exploradores e mensageiros ficam livres no castelo). Devolve os nomes.
    /// </summary>
    public static List<string> TreinoPronto(Mundo m, Reino r, ItemFila item, int n, Local l)
    {
        var nomes = new List<string>();
        var soldado = false;
        Sincronizar(m, l);
        foreach (var p in EmTreino(m, r, item).Take(n).ToList())
        {
            nomes.Add(p.Nome);
            MudarLocal(m, p, l.Id);
            p.Estado = Estados.Guarnecida; p.ItemId = null; p.GrupoId = null; m.Sujar(p);
            soldado |= EhSoldado(m, p);
        }
        if (soldado) RecontarGuarnicao(m, l);
        RecontarLivres(m, r);
        return nomes;
    }

    /// <summary>Explorador ou mensageiro livre no castelo com este ofício (o de menor id), ou null.</summary>
    public static Pessoa? Livre(Mundo m, Reino r, string oficio)
    {
        SincronizarLivres(m, r);
        return m.PessoasDe(r.Id).Where(p => p.Oficio == oficio && p.Estado == Estados.Guarnecida).OrderBy(p => p.Id).FirstOrDefault();
    }

    /// <summary>A pessoa sai da marcha e fica livre (guarnecida) no local.</summary>
    public static void Livrar(Mundo m, Marcha mc, long pessoaId, Local l)
    {
        if (m.Pessoas.Obter(pessoaId) is not { } p) return;
        mc.PessoaIds.Remove(p.Id); m.Sujar(mc);
        MudarLocal(m, p, l.Id);
        p.Estado = Estados.Guarnecida; p.GrupoId = null; m.Sujar(p);
    }

    /// <summary>O explorador foi capturado: sai da marcha, fica preso (continua do reino dele, sem ocupar o teto).</summary>
    public static void Capturada(Mundo m, Marcha mc, Pessoa p)
    {
        mc.PessoaIds.Remove(p.Id); m.Sujar(mc);
        if (m.Reinos.Obter(p.ReinoId) is { } r) MudarLocal(m, p, r.CasteloId);
        p.Estado = Estados.Capturada; p.GrupoId = null; m.Sujar(p);
    }

    /// <summary>Volta ao civil sem treinar (não há onde morar): fica sem trabalho e é reatribuída.</summary>
    public static void DevolverDoTreino(Mundo m, Reino r, ItemFila item, int n)
    {
        foreach (var p in EmTreino(m, r, item).Take(n).ToList())
        {
            p.Oficio = Oficios.Ocioso; p.Estado = Estados.Ociosa; p.ItemId = null; m.Sujar(p);
            Recontar(m, r);
            Atribuir(m, r, p);
        }
    }

    // ---------------------------------------------------------------- queda e exílio

    /// <summary>
    /// Exílio: <paramref name="manter"/> pessoas (presentes primeiro) seguem o reino até o castelo novo, sem trabalho; as outras ficam para trás.
    /// </summary>
    public static void Exilar(Mundo m, Reino r, Local novo, int manter)
    {
        var todas = m.PessoasDe(r.Id).Where(p => p.EhCivil).OrderBy(p => p.Presente ? 0 : 1).ThenBy(p => p.Id).ToList();
        // soldados, exploradores e mensageiros parados nos locais perdidos ficam para trás; quem está em marcha, ferido ou preso segue o reino
        foreach (var p in m.PessoasDe(r.Id).Where(p => !p.EhCivil && p.Estado == Estados.Guarnecida && p.LocalId != novo.Id).ToList()) Remover(m, p);
        foreach (var p in m.PessoasDe(r.Id).Where(p => !p.EhCivil && p.Estado == Estados.Ferida).ToList()) MudarLocal(m, p, novo.Id);
        foreach (var p in todas.Skip(manter).ToList()) Remover(m, p);
        foreach (var p in todas.Take(manter)) Ficar(m, p, novo, Oficios.Ocioso);
        Recontar(m, r);
        RecontarLivres(m, r);
    }
}
