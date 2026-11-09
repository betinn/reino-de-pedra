using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Mapa;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Valiosos;

/// <summary>
/// Escavação de ruínas antigas (ordem "escavar"): o grupo fica na ruína e, ao fim, acha a relíquia (tipo da ruína,
/// nome gerado), a ruína se esgota e o próprio grupo a leva ao local escolhido no envio, numa marcha interceptável.
/// Duração: <c>escavarHoras1 / (n^expTropas × posto)</c>, com n = tropas (até <c>P.extracao.maxTropas</c>), nunca menos que
/// <c>escavarMin</c>. Escavar depende de mãos, não de carga: qualquer unidade conta igual. Mais tropas mandadas depois à mesma
/// ruína se juntam ao grupo que já escava (uma marcha só) e o fim é recalculado com o progresso que já existe: mais gente,
/// menos tempo, nunca recomeça. A intenção é a própria ordem da marcha: o grupo escava ao chegar, com o dono online ou não, mesmo
/// se a ruína não estava explorada no envio (ela é pública e a marcha revela a névoa no caminho). Se não der mais, o relatório diz por quê.
/// </summary>
public static class Escavacoes
{
    public const string OrdemEscavar = "escavar";

    public static Ruina? NoHex(Mundo m, int hex) => m.Ruinas.FirstOrDefault(r => r.Hex == hex);

    /// <summary>Horas de escavação de um grupo (com ou sem posto).</summary>
    public static double Horas(Mundo m, IReadOnlyDictionary<string, int> tropas, bool posto)
    {
        var n = Math.Min(m.P.Extracao.MaxTropas, GT.Total(tropas));
        if (n <= 0) return double.PositiveInfinity;
        var h = m.P.Reliquia.EscavarHoras1 / (Math.Pow(n, m.P.Extracao.ExpTropas) * (posto ? m.P.Extracao.Posto : 1));
        return Math.Max(m.P.Reliquia.EscavarMin, h);
    }

    public static void Comecar(Mundo m, Exercito ex)
    {
        var ru = NoHex(m, ex.Destino);
        if (ru == null || ru.Esgotada)
        {
            Desistir(m, ex, "Ruína já escavada", "Não há mais relíquia aqui. As tropas voltam.");
            return;
        }
        if (Extracoes.OcupadoPorOutro(m, ex.ReinoId, ru.Hex))
        {
            Desistir(m, ex, "Ruína ocupada", "Há um posto de outro reino na ruína. As tropas voltam.");
            return;
        }
        ex.Parar(m);
        // o reino já escava esta ruína: o grupo novo se junta ao que está lá e o fim é recalculado sem perder o progresso
        var lider = Exercitos.De(m, ex.ReinoId).FirstOrDefault(e => e.Id != ex.Id && e.EscavaRuinaId == ru.Id);
        if (lider != null)
        {
            var partes = GT.Partes(m, ex.Tropas);
            Juntar(m, ex, lider);
            Reagendar(m, lider);
            var resta = (lider.EscavaFim!.Value - m.Agora) / (double)T.Hora;
            Registros.Notificar(m, lider.ReinoId, "reliquias", "Mais tropas na escavação",
                partes + " se juntaram. Relíquia em " + Duracao(resta) + " · " + GT.Partes(m, lider.Tropas) + " na ruína antiga.", "reliquias");
            m.Avisar(lider.ReinoId, "marchas");
            return;
        }
        var h = Horas(m, ex.Tropas, Extracoes.TemPosto(m, ex.ReinoId, ru.Hex));
        ex.EscavaRuinaId = ru.Id;
        ex.EscavaInicio = m.Agora;
        ex.EscavaFim = m.Agora + (long)Math.Ceiling(h * T.Hora);
        ex.EscavaEventoId = m.Agendar(new FimEscavacaoEvento { MarchaId = ex.Id, RuinaId = ru.Id, Quando = ex.EscavaFim.Value }).Id;
        m.Sujar(ex);
        Registros.Notificar(m, ex.ReinoId, "reliquias", "Escavação começou",
            "Relíquia em " + Duracao(h) + " · " + GT.Partes(m, ex.Tropas) + " na ruína antiga.", "reliquias");
        m.Avisar(ex.ReinoId, "marchas");
    }

    /// <summary>A escavação não dá mais ao chegar: o relatório diz por quê e as tropas voltam.</summary>
    private static void Desistir(Mundo m, Exercito ex, string titulo, string motivo)
    {
        Registros.Relatar(m, ex.ReinoId, "reliquia", titulo, new JsonObject
        {
            ["resumo"] = motivo,
            ["linhas"] = new JsonArray { new JsonObject { ["rotulo"] = "Tropas", ["valor"] = GT.Partes(m, ex.Tropas) } },
            ["hex"] = ex.Destino,
        }, "reliquias", titulo);
        ex.Retornar(m);
    }

    /// <summary>As pessoas, as tropas e a carga de <paramref name="de"/> passam para <paramref name="para"/>, e <paramref name="de"/> sai do mapa.</summary>
    public static void Juntar(Mundo m, Exercito de, Exercito para)
    {
        Pessoas.Pessoas.Unir(m, de, para);
        para.Carga.Somar(de.Carga); de.Carga = new();
        m.Sujar(para);
        de.Encerrar(m);
    }

    /// <summary>Recalcula o fim mantendo a fração já escavada (ex.: o posto ficou pronto no meio, ou chegaram mais tropas).</summary>
    public static void Reagendar(Mundo m, Exercito ex)
    {
        if (ex.EscavaRuinaId is not long rid || m.Ruinas.Obter(rid) is not { } ru || ex.EscavaInicio is not long ini || ex.EscavaFim is not long fim) return;
        var frac = Math.Clamp((m.Agora - ini) / (double)Math.Max(1, fim - ini), 0, 1);
        var h = Horas(m, ex.Tropas, Extracoes.TemPosto(m, ex.ReinoId, ru.Hex)) * T.Hora;
        ex.EscavaInicio = m.Agora - (long)(frac * h);
        ex.EscavaFim = ex.EscavaInicio + (long)Math.Ceiling(h);
        m.Cancelar(ex.EscavaEventoId);
        ex.EscavaEventoId = m.Agendar(new FimEscavacaoEvento { MarchaId = ex.Id, RuinaId = rid, Quando = ex.EscavaFim.Value }).Id;
        m.Sujar(ex);
    }

    /// <summary>Para a escavação (o progresso se perde) e avisa o dono.</summary>
    public static void Interromper(Mundo m, Exercito ex, string titulo, string texto)
    {
        m.Cancelar(ex.EscavaEventoId);
        ex.EscavaRuinaId = null; ex.EscavaInicio = null; ex.EscavaFim = null; ex.EscavaEventoId = null;
        m.Sujar(ex);
        Registros.Notificar(m, ex.ReinoId, "reliquias", titulo, texto, "reliquias");
    }

    /// <summary>Fim da escavação: cria a relíquia, esgota a ruína e o grupo a leva ao local escolhido.</summary>
    public static void Achar(Mundo m, Exercito ex, Ruina ru)
    {
        ru.Esgotada = true;
        m.Sujar(ru);
        m.Cancelar(ex.EscavaEventoId);
        ex.EscavaRuinaId = null; ex.EscavaInicio = null; ex.EscavaFim = null; ex.EscavaEventoId = null;
        var rel = m.Reliquias.Adicionar(new Reliquia
        {
            Nome = ReliquiasLendarias.NomeNovo(m, ru.TipoReliquia), Tipo = ru.TipoReliquia, ReinoId = ex.ReinoId,
            RuinaId = ru.Id, AchadaEm = m.Agora,
        });
        Reliquias.Carregar(m, rel, ex);
        // quem também escavava esta ruína chega tarde
        foreach (var outro in m.Marchas.OfType<Exercito>().Where(e => e.Id != ex.Id && e.EscavaRuinaId == ru.Id).ToList())
        {
            Interromper(m, outro, "A relíquia já foi levada", "Outro grupo achou a relíquia antes. As tropas voltam.");
            outro.Retornar(m);
        }
        var r = m.Reinos.Obter(ex.ReinoId);
        if (r != null) Sistemas.Revelar(m, r, Apresentacao.ReliquiasChave);
        var did = ex.Dados["destinoLocalId"]?.GetValue<long>();
        var dest = did is long d ? m.Locais.Obter(d) : null;
        if (!Exercitos.LocalProprio(dest, ex.ReinoId)) dest = r != null ? m.Locais.Obter(r.CasteloId) : null;
        Registros.Relatar(m, ex.ReinoId, "reliquia", "Relíquia encontrada", new JsonObject
        {
            ["resumo"] = rel.Nome + " · " + ReliquiasLendarias.Efeito(m, rel.Tipo) + ". O grupo (" + GT.Partes(m, ex.Tropas) + ") a leva" +
                         (dest != null ? " para " + dest.Nome : "") + "; no caminho, pode ser roubada.",
            ["linhas"] = new JsonArray
            {
                new JsonObject { ["rotulo"] = "Relíquia", ["valor"] = rel.Nome },
                new JsonObject { ["rotulo"] = "Tipo", ["valor"] = ReliquiasLendarias.NomeTipo(rel.Tipo) },
                new JsonObject { ["rotulo"] = "Efeito", ["valor"] = ReliquiasLendarias.Efeito(m, rel.Tipo) },
                new JsonObject { ["rotulo"] = "Destino", ["valor"] = dest?.Nome ?? "—" },
            },
            ["hex"] = ru.Hex,
        }, "reliquias", "Relíquia encontrada: " + rel.Nome);
        if (dest == null) { ex.Retornar(m); return; }
        var aqui = ex.HexEm(m.Agora);
        if (dest.Hex == aqui) { ex.EntrarNoLocal(m, dest); return; }
        try
        {
            var rota = Exercitos.Rota(m, ex, aqui, dest.Hex);
            ex.Ordem = OrdemReforcar.Id; ex.AlvoLocalId = dest.Id; ex.Retornando = false;
            ex.Partir(m, rota);
        }
        catch (RegraException) { ex.Retornar(m); }
    }

    public static string Duracao(double horas)
    {
        var min = (int)Math.Round(horas * 60);
        return min >= 60 ? min / 60 + " h" + (min % 60 > 0 ? " " + min % 60 + " min" : "") : min + " min";
    }
}

public sealed class FimEscavacaoEvento : Evento
{
    public long MarchaId { get; set; }
    public long RuinaId { get; set; }
    public override void Executar(Mundo m)
    {
        if (m.Marchas.Obter(MarchaId) is not Exercito ex || ex.EscavaRuinaId != RuinaId) return;
        ex.EscavaEventoId = null;
        var ru = m.Ruinas.Obter(RuinaId);
        if (ru == null || ru.Esgotada)
        {
            Escavacoes.Interromper(m, ex, "A relíquia já foi levada", "A ruína já tinha sido escavada. As tropas voltam.");
            ex.Retornar(m);
            return;
        }
        Escavacoes.Achar(m, ex, ru);
    }
}

/// <summary>
/// Vai a uma ruína antiga e escava ao chegar. A ruína é pública, mas se ainda guarda a relíquia só se sabe indo ver: fora da área
/// explorada a ordem não é recusada por isso (a recusa revelaria o segredo). <c>Dados.destinoLocalId</c>: local que recebe a relíquia (padrão: castelo).
/// </summary>
public sealed class OrdemEscavarRuina : IOrdemExercito
{
    public string Ordem => Escavacoes.OrdemEscavar;
    /// <summary>Quem já está parado na ruína (ou guarnece o posto dela) escava sem sair do lugar.</summary>
    public bool NoMesmoHex => true;
    public Rota Trajeto(Mundo m, Exercito ex, int destino, int de) => Exercitos.Rota(m, ex, de, destino);
    public void Validar(Mundo m, Reino r, Exercito ex, int destino)
    {
        var ru = Escavacoes.NoHex(m, destino) ?? throw new RegraException("Não há ruína antiga neste hexágono.");
        if (ru.Esgotada && Nevoas.Explorado(m, r.Id, destino)) throw new RegraException("A ruína já foi escavada.");
        if (Extracoes.OcupadoPorOutro(m, r.Id, destino)) throw new RegraException("Há um posto de outro reino nesta ruína.");
        var did = ex.Dados["destinoLocalId"]?.GetValue<long>() ?? r.CasteloId;
        if (!Exercitos.LocalProprio(m.Locais.Obter(did), r.Id)) throw new RegraException("Escolha um local seu para guardar a relíquia.");
        ex.Dados["destinoLocalId"] = did;
    }
    public void Chegou(Mundo m, Exercito ex) => Escavacoes.Comecar(m, ex);
}
