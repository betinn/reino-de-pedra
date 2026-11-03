using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Jogo.IA;

/// <summary>
/// Meta de ocupação (CLAUDE.md, Reinos controlados por IA): a temporada começa com <c>P.ia.inicial</c> reinos de IA e o mundo
/// nunca fica com menos de <c>P.ia.minimo</c> reinos ativos. Quem entra usa uma vaga livre; sem vaga, o reino de IA de menor
/// porte abdica e devolve a vaga (<see cref="CriacaoReino.LiberarVagaDeIA"/>). Reinos de IA destruídos não renascem: se a
/// ocupação cair abaixo do mínimo, surge um reino de IA novo na vaga livre mais longe dos jogadores ativos.
/// </summary>
public static class Ocupacao
{
    public static EstadoIA Estado(Mundo m)
    {
        foreach (var e in m.EstadosIA) return e;
        return m.EstadosIA.Adicionar(new EstadoIA());
    }

    // ---------------------------------------------------------------- ids sorteados

    /// <summary>
    /// Reserva <c>P.ia.reservaReinos × P.ia.idsPorReino</c> ids seguidos e os embaralha: reinos (de IA ou de jogador) e seus
    /// locais iniciais tiram ids dessa reserva, então a ordem dos ids não diz quem entrou junto com a temporada.
    /// </summary>
    public static void ReservarIds(Mundo m)
    {
        var e = Estado(m);
        if (e.IdsLivres.Count > 0 || e.LevaInicial) return;
        var n = m.P.IA.ReservaReinos * m.P.IA.IdsPorReino;
        var ids = new List<long>(n);
        for (var i = 0; i < n; i++) ids.Add(m.NovoId());
        m.Sorte.Embaralhar(ids);
        e.IdsLivres = ids;
        m.Sujar(e);
    }

    /// <summary>Gancho de <see cref="CriacaoReino.IdNovo"/>: um id da reserva (0 se acabou: o próximo id do mundo).</summary>
    public static long IdNovo(Mundo m)
    {
        if (!m.IA.Ativa) return 0;
        var e = Estado(m);
        while (e.IdsLivres.Count > 0)
        {
            var id = e.IdsLivres[^1];
            e.IdsLivres.RemoveAt(e.IdsLivres.Count - 1);
            m.Sujar(e);
            if (!m.Reinos.ContemId(id) && !m.Locais.ContemId(id)) return id;
        }
        return 0;
    }

    // ---------------------------------------------------------------- meta

    public static IEnumerable<Reino> Ativos(Mundo m) => m.Reinos.Where(r => r.Ativo);
    public static IEnumerable<Reino> DeIA(Mundo m) => m.Reinos.Where(r => r.Ativo && r.EhIA);

    /// <summary>
    /// Completa a ocupação: na primeira vez da temporada, até <c>P.ia.inicial</c> reinos de IA; depois, só se os ativos
    /// (jogadores + IA) estiverem abaixo de <c>P.ia.minimo</c>. Nunca passa de <c>P.reinos</c> nem das vagas do mapa.
    /// Devolve quantos reinos de IA surgiram.
    /// </summary>
    public static int Completar(Mundo m)
    {
        if (!m.IA.Ativa || !m.IA.CriarReinos) return 0;
        var e = Estado(m);
        var criados = 0;
        if (!e.LevaInicial)
        {
            e.LevaInicial = true; m.Sujar(e);
            while (DeIA(m).Count() < m.P.IA.Inicial && Ativos(m).Count() < m.P.Reinos && CriarUm(m) != null) criados++;
        }
        while (Ativos(m).Count() < Math.Min(m.P.IA.Minimo, m.P.Reinos) && CriarUm(m) != null) criados++;
        return criados;
    }

    /// <summary>Vaga livre mais longe dos castelos dos jogadores ativos (sem jogadores: a última na ordem de ocupação).</summary>
    public static int VagaLonge(Mundo m)
    {
        var ocupadas = Ativos(m).Select(r => r.Vaga).ToHashSet();
        var livres = m.Mapa.Vagas.Where(v => !ocupadas.Contains(v.Indice) && CriacaoReino.VagaUtilizavel(m, v)).ToList();
        if (livres.Count == 0) return -1;
        var jogadores = Ativos(m).Where(r => !r.EhIA).Select(r => m.Locais.Obter(r.CasteloId)).OfType<Local>().Select(l => l.Hex).ToList();
        if (jogadores.Count == 0) return livres.MaxBy(v => v.Indice)!.Indice;
        return livres.OrderByDescending(v => jogadores.Min(h => m.G.Distancia(h, v.Castelo))).ThenByDescending(v => v.Indice).First().Indice;
    }

    /// <summary>Cria um reino de IA (nome, brasão, perfil e habilidade sorteados) na vaga livre mais longe dos jogadores.</summary>
    public static Reino? CriarUm(Mundo m, int vaga = -1)
    {
        if (vaga < 0) vaga = VagaLonge(m);
        if (vaga < 0) return null;
        var nome = Nomes.Novo(m, m.Sorte);
        var r = CriacaoReino.Criar(m, null, nome, Brasao.Aleatorio(m.Sorte), vaga);
        r.PerfilIA = Sortear(m, m.P.IA.Perfis.ToDictionary(kv => kv.Key, kv => kv.Value.Peso));
        r.HabilidadeIA = Sortear(m, m.P.IA.PesosHabilidade);
        m.Sujar(r);
        Governo.Preparar(m, r);
        Sessoes.Agendar(m, r);
        return r;
    }

    private static string Sortear(Mundo m, IReadOnlyDictionary<string, double> pesos)
    {
        var total = pesos.Values.Sum();
        var x = m.Sorte.Real() * total;
        foreach (var (k, p) in pesos.OrderBy(kv => kv.Key, StringComparer.Ordinal)) { x -= p; if (x < 0) return k; }
        return pesos.Keys.OrderBy(k => k, StringComparer.Ordinal).Last();
    }

    // ---------------------------------------------------------------- abdicação

    /// <summary>Porte de um reino: soma dos níveis dos locais e um tanto pelas tropas (para escolher quem abdica).</summary>
    public static double Porte(Mundo m, Reino r) =>
        m.LocaisDe(r.Id).Where(l => !l.Ruina).Sum(l => l.Nivel) + Economia.Tropas(m, r) * m.P.Vagas.PorNivel;

    /// <summary>
    /// Gancho de <see cref="CriacaoReino.LiberarVagaDeIA"/>: o reino de IA de menor porte abdica e devolve a vaga
    /// (a do castelo inicial dele). Só abdica quem deixa uma vaga que o jogador pode usar (sem locais de outros reinos nem
    /// relíquias nos hexágonos dela). -1 se não houver.
    /// </summary>
    public static int LiberarVaga(Mundo m)
    {
        var ia = DeIA(m).Where(r => r.Vaga >= 0 && CriacaoReino.VagaUtilizavel(m, m.Mapa.Vagas[r.Vaga], r.Id)).OrderBy(r => Porte(m, r)).ThenBy(r => r.Vaga).FirstOrDefault();
        if (ia == null) return -1;
        var vaga = ia.Vaga;
        Abdicar(m, ia);
        return vaga;
    }

    /// <summary>
    /// O reino de IA deixa o mundo: o castelo vira ruína, os outros locais viram terra livre (mantêm o nível e o estoque, sem
    /// guarnição), as filas e as marchas acabam, as relíquias ficam nos locais (sem dono) e ele sai da aliança.
    /// </summary>
    public static void Abdicar(Mundo m, Reino r)
    {
        if (!r.Ativo) return;
        Economia.Atualizar(m, r);
        m.Cancelar(r.SessaoIAEventoId); r.SessaoIAEventoId = null;
        if (r.AliancaId != null) { try { Aliancas.Sair(m, r); } catch (RegraException) { r.AliancaId = null; } }
        foreach (var (nome, fila) in r.Filas.ToList())
            foreach (var it in fila.Itens.ToList()) { try { Filas.Cancelar(m, r, nome, it.Id); } catch (RegraException) { } }
        var castelo = m.Locais.Obter(r.CasteloId);
        foreach (var mc in m.Marchas.Where(x => x.ReinoId == r.Id).ToList())
        {
            foreach (var rid in mc.Reliquias.ToList())
                if (m.Reliquias.Obter(rid) is { } rel && castelo != null) Reliquias.Guardar(m, rel, castelo);
            mc.Encerrar(m);
        }
        foreach (var l in m.LocaisDe(r.Id).ToList())
        {
            l.Guarnicao.Clear();
            foreach (var rel in Reliquias.NoLocal(m, l.Id)) { rel.ReinoId = 0; m.Sujar(rel); }
            if (l.Tipo == TipoLocal.Castelo)
            {
                l.Ruina = true; l.Nivel = 1; l.Tipo = TipoLocal.Vila; l.Produz = "comida"; l.Nome = "Ruínas de castelo";
                l.Portoes = 0; l.EstruturaPortoes = 0; l.Moradias = 0; l.Estoque = new();
            }
            else l.Moradias = 0;
            m.MudarDono(l, 0);
        }
        foreach (var t in Defesas.DoReino(m, r.Id).ToList()) m.Torres.Remover(t);
        Pessoas.Pessoas.RemoverTodas(m, r);
        r.Ativo = false;
        m.Sujar(r);
        foreach (var outro in Ativos(m)) m.Avisar(outro.Id, "mapa");
    }
}
