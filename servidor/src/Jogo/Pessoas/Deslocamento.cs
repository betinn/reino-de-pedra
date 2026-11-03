using System.Text.Json.Serialization;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.Pessoas;

/// <summary>
/// Pessoas civis andando de um local do reino para outro (troca de trabalho, mudança de casa, volta para casa).
/// Usa o mecanismo de marcha que já existe: nenhum evento por pessoa, a posição é interpolada pelo cliente.
/// Não ocupa o teto, não leva carga, não é alvo de fauna nem de interceptação (gente desarmada dentro do reino foge).
/// </summary>
public sealed class Deslocamento : Marcha
{
    public override string Tipo => "pessoas";
    public List<long> PessoaIds { get; set; } = new();
    /// <summary>Local de destino (trabalho ou casa).</summary>
    public long ParaLocalId { get; set; }

    public override int PopOcupada(Mundo m) => 0;
    [JsonIgnore] public override bool AlvoDeFauna => false;
    [JsonIgnore] public override bool Interceptavel => false;

    public override void Chegou(Mundo m)
    {
        Encerrar(m);
        var l = m.Locais.Obter(ParaLocalId);
        foreach (var id in PessoaIds)
            if (m.Pessoas.Obter(id) is { } p && p.GrupoId == Id) Pessoas.Chegou(m, p, l);
        m.Avisar(ReinoId, "reino");
    }

    /// <summary>Põe as pessoas a caminho de <paramref name="para"/>, saindo do hexágono <paramref name="de"/>.</summary>
    public static Deslocamento Partir(Mundo m, Reino r, List<Pessoa> pessoas, int de, Local para)
    {
        var vel = m.P.Carregador.Vel;
        var mc = new Deslocamento { ReinoId = r.Id, Vel = vel, ParaLocalId = para.Id, PessoaIds = pessoas.Select(p => p.Id).ToList() };
        m.Marchas.Adicionar(mc);
        foreach (var p in pessoas) { p.GrupoId = mc.Id; p.Estado = Estados.Andando; m.Sujar(p); }
        mc.Partir(m, Caminhos.Calcular(m, de, para.Hex, vel, new OpcoesCaminho { ReinoId = r.Id }));
        return mc;
    }
}
