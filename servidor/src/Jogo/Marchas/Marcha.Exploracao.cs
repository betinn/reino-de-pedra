using System.Text.Json.Serialization;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Nucleo;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Marchas;

/// <summary>
/// Exploração e fauna na marcha: revelação da névoa ao longo do caminho (sem tique), ataques de fauna e
/// capturas agendados para o caminho atual, força contra fauna e o que a marcha perde num ataque.
/// </summary>
public abstract partial class Marcha
{
    /// <summary>Eventos de fauna, captura e revelação agendados para o caminho atual (cancelados quando ele muda).</summary>
    public List<long> EventosCaminho { get; set; } = new();
    /// <summary>Cópia do caminho que está sendo revelado (o <see cref="Partir"/> troca o Caminho; a cópia guarda o anterior até revelá-lo).</summary>
    public List<int> CaminhoVisto { get; set; } = new();
    public List<long> TemposVisto { get; set; } = new();
    /// <summary>Último índice de <see cref="CaminhoVisto"/> já revelado.</summary>
    public int RevelouAte { get; set; } = -1;
    /// <summary>Hexágonos nunca vistos que esta marcha revelou (para o relatório de exploração).</summary>
    public int HexesRevelados { get; set; }

    /// <summary>A fauna ataca esta marcha (mensageiros com bandeira branca devolvem false).</summary>
    [JsonIgnore] public virtual bool AlvoDeFauna => true;
    /// <summary>Marcha furtiva: outros reinos não a veem no mapa (batedor de elite).</summary>
    [JsonIgnore] public virtual bool Furtiva => false;

    /// <summary>Força contra fauna: soma de (ataque + defesa)/2 das tropas; carregadores contam por pessoa.</summary>
    public virtual double ForcaContraFauna(Mundo m) =>
        this is Carregadores c ? c.Pessoas * m.P.FaunaServ.ForcaCarregador : GT.ForcaFauna(m, Tropas);

    /// <summary>Chamado ao revelar cada hexágono do caminho (o prospector descobre jazidas aqui).</summary>
    public virtual void AoPassar(Mundo m, int hex, long quando) { }

    /// <summary>
    /// A fauna atacou: perde <paramref name="perda"/> das tropas (ao menos 1) e a mesma fração da carga.
    /// Devolve o que se perdeu. Se não sobrar ninguém, a marcha sai do mapa (quem chama encerra).
    /// </summary>
    public virtual PerdaFauna SofrerFauna(Mundo m, double perda)
    {
        var total = GT.Total(Tropas);
        var mortos = new Dictionary<string, int>();
        if (total > 0)
        {
            var n = Math.Min(total, Math.Max(1, (int)Math.Round(total * perda, MidpointRounding.AwayFromZero)));
            if (Reliquias.Count > 0) n = Math.Min(n, total - 1);   // quem leva relíquia não some inteiro na mata
            mortos = Fauna.Distribuir(Tropas, n);
            foreach (var (k, v) in mortos)
            {
                var resto = Tropas.GetValueOrDefault(k) - v;
                if (resto > 0) Tropas[k] = resto; else Tropas.Remove(k);
            }
        }
        var carga = new Recursos();
        foreach (var (k, v) in Carga.ToList()) carga.Somar(k, Carga.Retirar(k, v * perda));
        m.Sujar(this);
        return new PerdaFauna(mortos, carga, total > 0 && GT.Total(Tropas) == 0);
    }

    /// <summary>Revela na névoa do dono os hexágonos do caminho já percorridos até <paramref name="ate"/>, cada um no minuto da passagem.</summary>
    public void RevelarPercorrido(Mundo m, long ate)
    {
        if (ReinoId == 0 || CaminhoVisto.Count == 0 || TemposVisto.Count != CaminhoVisto.Count) return;
        var inicio = Math.Max(0, RevelouAte + 1);
        if (inicio >= CaminhoVisto.Count || TemposVisto[inicio] > ate) return;
        var nevoa = Nevoas.De(m, ReinoId);
        var raio = RaioVisao(m);
        for (var i = inicio; i < CaminhoVisto.Count && TemposVisto[i] <= ate; i++)
        {
            var h = CaminhoVisto[i];
            var area = m.G.Area(h, raio).ToList();
            HexesRevelados += area.Count(x => nevoa.MinutoVisto(x) == 0);
            Nevoas.Revelar(m, ReinoId, area, TemposVisto[i]);
            AoPassar(m, h, TemposVisto[i]);
            RevelouAte = i;
        }
        m.Sujar(this);
    }

    /// <summary>Guarda o caminho novo para revelar (depois de revelar o que faltava do anterior).</summary>
    internal void TrocarCaminhoVisto(Mundo m, long agoraAnterior)
    {
        RevelarPercorrido(m, agoraAnterior);
        CaminhoVisto = Caminho.ToList();
        TemposVisto = Tempos.ToList();
        RevelouAte = -1;
        RevelarPercorrido(m, m.Agora);
    }
}

/// <summary>O que uma marcha perdeu num ataque de fauna. <see cref="Acabou"/>: não sobrou ninguém.</summary>
public sealed record PerdaFauna(Dictionary<string, int> Mortos, Recursos Carga, bool Acabou);

/// <summary>Revela o caminho de uma marcha logo antes de ela chegar (o caminho pode ser trocado na chegada).</summary>
public sealed class RevelarCaminhoEvento : Evento
{
    public long MarchaId { get; set; }
    public long Partida { get; set; }
    public override void Executar(Mundo m)
    {
        if (m.Marchas.Obter(MarchaId) is not { } mc || mc.Partida != Partida) return;
        mc.RevelarPercorrido(m, mc.Chegada);
    }
}
