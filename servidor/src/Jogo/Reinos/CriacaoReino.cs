using System.Text.RegularExpressions;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Mapa;
using ReinoDePedra.Jogo.Nucleo;

namespace ReinoDePedra.Jogo.Reinos;

/// <summary>
/// Fundação de um reino numa vaga do mapa: castelo, 4 locais iniciais, kit e escudo de novato. Os primeiros passos já
/// foram dados (<c>P.inicio</c>): locais acima do nível 1, moradias, guarnição e exploradores prontos, entorno explorado.
/// </summary>
public static partial class CriacaoReino
{
    [GeneratedRegex(@"^[\p{L}][\p{L}\p{M} '\-]{1,22}[\p{L}\p{M}]$")]
    private static partial Regex NomeValido();

    public static string NormalizarNome(string? nome) => Regex.Replace((nome ?? "").Trim(), @"\s+", " ");

    public static string? MotivoNomeInvalido(Mundo m, string nome)
    {
        if (nome.Length < 3 || nome.Length > 24) return "O nome do reino precisa ter de 3 a 24 letras.";
        if (!NomeValido().IsMatch(nome)) return "Use só letras, espaços, hífen e apóstrofo.";
        if (m.Reinos.Any(r => r.Ativo && string.Equals(r.Nome, nome, StringComparison.OrdinalIgnoreCase)))
            return "Já existe um reino com esse nome.";
        return null;
    }

    /// <summary>Vaga livre de menor índice; -1 se não houver.</summary>
    public static int VagaLivre(Mundo m)
    {
        var ocupadas = m.Reinos.Where(r => r.Ativo).Select(r => r.Vaga).ToHashSet();
        foreach (var v in m.Mapa.Vagas) if (!ocupadas.Contains(v.Indice) && VagaUtilizavel(m, v)) return v.Indice;
        return -1;
    }

    /// <summary>Hexágonos do castelo e dos 4 locais iniciais da vaga.</summary>
    public static int[] Hexes(Vaga v) => [v.Castelo, v.Comida, v.Madeira, v.Pedra, v.Ferro];
    /// <summary>Todos os hexágonos que o reino novo ocupa: a pegada do castelo e a dos 4 locais iniciais (P.ocupa).</summary>
    public static List<int> Pegadas(Mundo m, Vaga v) =>
        Mapa.Pegada.Hexes(m, TipoLocal.Castelo, v.Castelo).Concat(new[] { v.Comida, v.Madeira, v.Pedra, v.Ferro }.SelectMany(h => Mapa.Pegada.Hexes(m, TipoLocal.Vila, h))).Distinct().ToList();

    /// <summary>
    /// Um local inicial só toma o lugar de um local sem dono (ruína ou terra livre) que não guarda relíquia nem equipamento
    /// lendário. Locais de reinos ativos ficam com quem os tem (território é presença física). <paramref name="saindo"/>: reino
    /// que vai deixar o mundo (abdicação) e cujos locais vão ficar sem dono.
    /// </summary>
    public static bool LocalSubstituivel(Mundo m, Local l, long saindo = 0) =>
        (saindo != 0 && l.ReinoId == saindo || Combate.Ataques.SemDono(m, l))
        && !m.Reliquias.Any(x => x.LocalId == l.Id) && !m.Lendarios.Any(e => e.LocalId == l.Id);

    /// <summary>As pegadas da vaga estão livres ou só têm locais que podem dar lugar (ver <see cref="LocalSubstituivel"/>).</summary>
    public static bool VagaUtilizavel(Mundo m, Vaga v, long saindo = 0)
    {
        foreach (var h in Pegadas(m, v))
        {
            if (m.LocalNoHex(h) is { } l) { if (!LocalSubstituivel(m, l, saindo)) return false; }
            else if (!Obras.HexLivre(m, h)) return false;
        }
        return true;
    }

    /// <summary>
    /// Escolhe a vaga para um jogador novo: uma livre, ou a de um reino de IA que abdica para dar lugar
    /// (gancho <see cref="LiberarVagaDeIA"/>). Sem vaga e sem IA, o mundo está cheio até a próxima temporada.
    /// </summary>
    public static int VagaParaJogador(Mundo m)
    {
        var v = VagaLivre(m);
        if (v >= 0) return v;
        if (LiberarVagaDeIA != null) v = LiberarVagaDeIA(m);
        if (v >= 0) return v;
        throw new RegraException("O mundo está cheio. Novas entradas só na próxima temporada.", 409);
    }
    /// <summary>Gancho do sistema de IA: um reino de IA abdica e devolve a vaga (ou -1).</summary>
    public static Func<Mundo, int>? LiberarVagaDeIA { get; set; }
    /// <summary>Gancho do sistema de IA: id do reino e dos locais iniciais (sorteado de uma reserva; 0 = o próximo id).</summary>
    public static Func<Mundo, long>? IdNovo { get; set; }

    public static Reino Criar(Mundo m, long? contaId, string nome, Brasao brasao, int vaga = -1)
    {
        nome = NormalizarNome(nome);
        var motivo = MotivoNomeInvalido(m, nome);
        if (motivo != null) throw new RegraException(motivo);
        var (extras, moldura) = BrasaoLiberado?.Invoke(m, contaId) ?? (false, false);
        if (!brasao.Valido(extras, moldura)) throw new RegraException("Brasão inválido.");
        if (contaId != null && m.Reinos.Any(r => r.Ativo && r.ContaId == contaId)) throw new RegraException("Você já tem um reino neste mundo.", 409);
        if (vaga < 0) vaga = contaId != null ? VagaParaJogador(m) : VagaLivre(m);
        if (vaga < 0) throw new RegraException("Não há vaga no mapa.", 409);
        var V = m.Mapa.Vagas[vaga];
        if (!VagaUtilizavel(m, V)) throw new RegraException("Esta vaga do mapa está ocupada.", 409);
        foreach (var h in Pegadas(m, V))
        {
            var antigo = m.LocalNoHex(h);
            if (antigo != null) m.RemoverLocal(antigo);   // ruínas sem dono de um reino que ocupou esta vaga antes
        }
        var agora = m.Agora;
        var r = m.Reinos.Adicionar(new Reino
        {
            Id = IdNovo?.Invoke(m) ?? 0, ContaId = contaId, Nome = nome, Brasao = brasao, CriadoEm = agora, UltimoAcesso = agora, Vaga = vaga,
            EscudoAte = agora + T.DeHoras(m.P.EscudoNovatoH), AtualizadoEm = agora,
        });
        var ini = m.InicioReino ?? m.P.Inicio;
        var nivelCastelo = Math.Clamp(ini.Castelo, 1, m.P.NivelMax);
        var castelo = m.AdicionarLocal(new Local
        {
            Id = IdNovo?.Invoke(m) ?? 0, ReinoId = r.Id, Tipo = TipoLocal.Castelo, Hex = V.Castelo, Nivel = nivelCastelo, Nome = "Castelo de " + nome,
            Estoque = Recursos.De(m.P.Kit.Concat(m.P.KitExtra).ToDictionary(kv => kv.Key, kv => kv.Value)), Moradias = Math.Max(0, ini.Moradias),
        });
        r.CasteloId = castelo.Id;
        var nivelLocal = Math.Clamp(ini.Locais, 1, nivelCastelo);   // nenhum local passa do nível do castelo
        void Inicial(TipoLocal t, string produz, int hex) =>
            m.AdicionarLocal(new Local { Id = IdNovo?.Invoke(m) ?? 0, ReinoId = r.Id, Tipo = t, Produz = produz, Hex = hex, Nivel = nivelLocal, Nome = Obras.NomeNovo(m, r, t, produz) });
        Inicial(TipoLocal.Vila, "comida", V.Comida);
        Inicial(TipoLocal.Serraria, "madeira", V.Madeira);
        Inicial(TipoLocal.Mina, "pedra", V.Pedra);
        Inicial(TipoLocal.Mina, "ferro", V.Ferro);
        foreach (var l in m.LocaisDe(r.Id)) Nevoas.RevelarArea(m, r.Id, l.Hex, Nevoas.RaioLocal(m, l));
        if (ini.RaioExplorado > 0) Nevoas.RevelarArea(m, r.Id, castelo.Hex, ini.RaioExplorado);   // o entorno já foi percorrido
        Pessoas.Pessoas.Nascer(m, r, m.P.PopInicial, andar: false);   // as primeiras pessoas já aparecem nas vagas
        // tropas e exploradores prontos no castelo, com nome: a primeira sessão começa com o que fazer, sem esperar o treino
        if (ini.Tropas.Count > 0) Pessoas.Pessoas.CriarSoldados(m, r, castelo, ini.Tropas.Where(kv => m.B.U.ContainsKey(kv.Key)).ToDictionary());
        if (ini.Exploradores.Count > 0)
        {
            r.ExploradoresLivres = ini.Exploradores.Where(kv => kv.Value > 0 && m.P.Exploradores.ContainsKey(kv.Key)).ToDictionary();
            Pessoas.Pessoas.SincronizarLivres(m, r);
        }
        Economia.GarantirCheckpoint(m, r);
        m.Sujar(r);
        AoCriar?.Invoke(m, r);
        return r;
    }
    /// <summary>"4 lanceiros, 2 arqueiros e 3 exploradores esperam ordens no castelo." (null se o reino novo não traz ninguém pronto).</summary>
    public static string? TextoInicio(Mundo m)
    {
        var ini = m.InicioReino ?? m.P.Inicio;
        var partes = ini.Tropas.Where(kv => kv.Value > 0 && m.B.U.ContainsKey(kv.Key))
            .Select(kv => kv.Value + " " + (kv.Value == 1 ? m.B.U[kv.Key].Nome.ToLowerInvariant() : Tropas.Plural(m.B.U[kv.Key]))).ToList();
        var ex = ini.Exploradores.Values.Sum();
        if (ex > 0) partes.Add(ex + (ex == 1 ? " explorador" : " exploradores"));
        if (partes.Count == 0) return null;
        var um = partes.Count == 1 && (ex == 1 || ini.Tropas.Values.Sum() == 1);
        return Pessoas.Pessoas.Nomear(partes) + (um ? " espera" : " esperam") + " ordens no castelo.";
    }

    public static event Action<Mundo, Reino>? AoCriar;
    /// <summary>Gancho do legado: o que a linhagem da conta libera no brasão (cores e formas extras, moldura).</summary>
    public static Func<Mundo, long?, (bool extras, bool moldura)>? BrasaoLiberado { get; set; }
}
