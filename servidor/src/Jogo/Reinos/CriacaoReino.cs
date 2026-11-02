using System.Text.RegularExpressions;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Nucleo;

namespace ReinoDePedra.Jogo.Reinos;

/// <summary>Fundação de um reino numa vaga do mapa: castelo, 4 locais iniciais, kit e escudo de novato.</summary>
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
        foreach (var v in m.Mapa.Vagas) if (!ocupadas.Contains(v.Indice)) return v.Indice;
        return -1;
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

    public static Reino Criar(Mundo m, long? contaId, string nome, Brasao brasao, int vaga = -1)
    {
        nome = NormalizarNome(nome);
        var motivo = MotivoNomeInvalido(m, nome);
        if (motivo != null) throw new RegraException(motivo);
        if (!brasao.Valido()) throw new RegraException("Brasão inválido.");
        if (contaId != null && m.Reinos.Any(r => r.Ativo && r.ContaId == contaId)) throw new RegraException("Você já tem um reino neste mundo.", 409);
        if (vaga < 0) vaga = contaId != null ? VagaParaJogador(m) : VagaLivre(m);
        if (vaga < 0) throw new RegraException("Não há vaga no mapa.", 409);
        var V = m.Mapa.Vagas[vaga];
        foreach (var h in new[] { V.Castelo, V.Comida, V.Madeira, V.Pedra, V.Ferro })
        {
            var antigo = m.LocalNoHex(h);
            if (antigo != null) m.RemoverLocal(antigo);   // ruínas de um reino que ocupou esta vaga antes
        }
        var agora = m.Agora;
        var r = m.Reinos.Adicionar(new Reino
        {
            ContaId = contaId, Nome = nome, Brasao = brasao, CriadoEm = agora, UltimoAcesso = agora, Vaga = vaga,
            EscudoAte = agora + T.DeHoras(m.P.EscudoNovatoH), Pop = m.P.PopInicial, AtualizadoEm = agora,
        });
        var castelo = m.AdicionarLocal(new Local
        {
            ReinoId = r.Id, Tipo = TipoLocal.Castelo, Hex = V.Castelo, Nivel = 1, Nome = "Castelo de " + nome,
            Estoque = Recursos.De(m.P.Kit.Concat(m.P.KitExtra).ToDictionary(kv => kv.Key, kv => kv.Value)),
        });
        r.CasteloId = castelo.Id;
        void Inicial(TipoLocal t, string produz, int hex) =>
            m.AdicionarLocal(new Local { ReinoId = r.Id, Tipo = t, Produz = produz, Hex = hex, Nivel = 1, Nome = Obras.NomeNovo(m, r, t, produz) });
        Inicial(TipoLocal.Vila, "comida", V.Comida);
        Inicial(TipoLocal.Serraria, "madeira", V.Madeira);
        Inicial(TipoLocal.Mina, "pedra", V.Pedra);
        Inicial(TipoLocal.Mina, "ferro", V.Ferro);
        foreach (var l in m.LocaisDe(r.Id)) Nevoas.RevelarArea(m, r.Id, l.Hex, Nevoas.RaioLocal(m, l));
        Economia.GarantirCheckpoint(m, r);
        m.Sujar(r);
        AoCriar?.Invoke(m, r);
        return r;
    }
    public static event Action<Mundo, Reino>? AoCriar;
}
