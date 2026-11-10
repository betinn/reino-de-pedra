using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Pessoas;
using ReinoDePedra.Jogo.Reinos;
using Xunit;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Testes;

/// <summary>Frentes simultâneas, tempo que encurta, recuo sem o que levar, saque por prioridade e repouso no castelo.</summary>
public class FrentesESaqueTestes
{
    private static Dictionary<string, int> G(params (string k, int n)[] g) => g.ToDictionary(x => x.k, x => x.n);

    /// <summary>Um terceiro reino, com tropas numa base à mesma distância do atacante: as duas frentes começam juntas.</summary>
    private static (Reino r, Exercito ex) Outro(CombateCenario s, Local alvo, Dictionary<string, int> g, JsonObject? plano = null)
    {
        var r = s.T.NovoReino(); r.EscudoAte = 0;
        var c = s.M.AdicionarLocal(new Local { ReinoId = r.Id, Tipo = TipoLocal.Armazem, Hex = s.HexLivre(alvo.Hex, 4), Nome = "Base" });
        s.Guarnecer(c, g);
        return (r, Exercitos.Enviar(s.M, r, c.Id, g, alvo.Hex, OrdemAtacar.Id, false, plano ?? CombateCenario.Plano()));
    }

    /// <summary>Duas frentes já em andamento no alvo: a do reino atacante e a de um terceiro.</summary>
    private static (Batalha b1, Batalha b2, Reino outro) DuasFrentes(CombateCenario s, Local alvo, Dictionary<string, int> g1, Dictionary<string, int> g2, JsonObject? plano1 = null, JsonObject? plano2 = null)
    {
        var e1 = s.Atacar(alvo, g1, plano1);
        var (r, e2) = Outro(s, alvo, g2, plano2);
        s.AvancarAte(Math.Max(e1.Chegada, e2.Chegada));
        var b1 = s.M.Batalhas.Single(b => b.AtacanteId == s.Atk.Id);
        var b2 = s.M.Batalhas.Single(b => b.AtacanteId == r.Id);
        return (b1, b2, r);
    }

    [Fact]
    public void Reinos_diferentes_atacam_ao_mesmo_tempo_e_a_defesa_se_divide()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 30)), 0);
        var (b1, b2, _) = DuasFrentes(s, alvo, G(("arqueiro", 30)), G(("arqueiro", 10)));
        Assert.False(b1.Encerrada); Assert.False(b2.Encerrada);
        Assert.Equal(2, Batalhas.Ativas(s.M, alvo.Id).Count);
        var m1 = b1.Marcos[^1]; var m2 = b2.Marcos[^1];
        Assert.Equal(1, m1.Parte + m2.Parte, 6);
        Assert.Equal(0.75, m1.Parte, 6);
        // as frentes enfrentam a mesma razão: a da soma dos ataques contra a defesa inteira
        var soma = s.M.F.Batalha(G(("arqueiro", 40)), G(("lanceiro", 30)), new ReinoDePedra.Jogo.Config.ExtraDefesa(), null);
        Assert.Equal(soma.A / soma.D, m1.A / m1.D, 6);
        Assert.Equal(soma.A / soma.D, m2.A / m2.D, 6);
    }

    [Fact]
    public void Ataques_juntos_vencem_a_defesa_que_cada_um_sozinho_perderia()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 20)), 0);
        var x = new ReinoDePedra.Jogo.Config.ExtraDefesa();
        Assert.False(s.M.F.Batalha(G(("lanceiro", 18)), G(("lanceiro", 20)), x, null).VenceA);
        Assert.True(s.M.F.Batalha(G(("lanceiro", 36)), G(("lanceiro", 20)), x, null).VenceA);
        var (b1, b2, _) = DuasFrentes(s, alvo, G(("lanceiro", 18)), G(("lanceiro", 18)));
        s.AvancarAte(Math.Max(b1.FimPrevisto, b2.FimPrevisto) + 1000);
        s.AvancarAte(Math.Max(b1.FimPrevisto, b2.FimPrevisto) + 1000);
        Assert.Equal("vitoria", b1.Resultado);
        Assert.Equal("vitoria", b2.Resultado);
        Assert.Empty(GT.Limpo(alvo.Guarnicao));
    }

    [Fact]
    public void Local_tomado_numa_frente_manda_a_outra_de_volta_com_o_motivo()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 2)), 0);
        var (b1, b2, outro) = DuasFrentes(s, alvo, G(("arqueiro", 3)), G(("cavalaria", 30)), CombateCenario.Plano("ocupacao"), CombateCenario.Plano("ocupacao"));
        // a batalha não tem tempo fixo: vale a frente que acabar primeiro, seja qual for
        var (primeira, outra) = b1.FimPrevisto <= b2.FimPrevisto ? (b1, b2) : (b2, b1);
        s.AvancarAte(primeira.FimPrevisto);
        Assert.Equal("vitoria", primeira.Resultado);
        Assert.Equal(primeira.AtacanteId, alvo.ReinoId);
        Assert.True(outra.Encerrada);
        Assert.Equal("recuo", outra.Resultado);
        Assert.Contains("outra força", outra.MotivoRecuo);
        Assert.Contains(s.M.Marchas.OfType<Exercito>(), e => e.ReinoId == outra.AtacanteId && e.Retornando);
        Assert.NotEqual(0, outro.Id);
    }

    [Fact]
    public void Defesa_que_recua_sai_de_todas_as_frentes()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 10)), 0);
        var vila = s.M.AdicionarLocal(new Local { ReinoId = s.Def.Id, Tipo = TipoLocal.Vila, Produz = "comida", Hex = s.HexLivre(alvo.Hex, 3), Nome = "Vila Vizinha" });
        var (b1, b2, _) = DuasFrentes(s, alvo, G(("arqueiro", 20)), G(("arqueiro", 20)));
        Batalhas.Recuar(s.M, s.Def, b1.Id);
        Assert.Equal("defesa-recuou", b1.Resultado);
        Assert.Equal("defesa-recuou", b2.Resultado);
        Assert.Empty(GT.Limpo(alvo.Guarnicao));
        Assert.Empty(Batalhas.Ativas(s.M, alvo.Id));
    }

    [Fact]
    public void Batalha_encurta_conforme_as_tropas_caem()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 10)), 0);
        var ex = s.Atacar(alvo, G(("lanceiro", 10), ("arqueiro", 10)));
        var b = s.Chegar(ex);
        var mc = b.Marcos[0];
        Assert.True(mc.M > 0);
        Assert.Equal(mc.T + (long)Math.Round(mc.Dur * (1 - mc.M / 2)), b.Fim);
        Assert.True(b.Fim - b.Inicio < mc.Dur, "mais curta que a duração sem baixas");
        // o ritmo acelera: a segunda metade do progresso leva menos que a primeira
        var meio = Batalhas.TempoAte(mc, 0.5);
        Assert.True(b.Fim - meio < meio - b.Inicio);
        Assert.Equal(0.5, Batalhas.Progresso(b, meio), 3);
        Assert.Equal(1, Batalhas.Progresso(b, b.Fim), 3);
    }

    [Fact]
    public void Placar_mostra_baixas_ao_vivo_e_fecha_com_o_resultado()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 10)), 0);
        var ex = s.Atacar(alvo, G(("arqueiro", 30)));
        var b = s.Chegar(ex);
        Assert.Equal(0, Batalhas.PlacarDe(s.M, b, s.M.Agora).BaixasD);
        s.AvancarAte(Batalhas.TempoAte(b.Marcos[0], 0.5));
        var meio = Batalhas.PlacarDe(s.M, b, s.M.Agora);
        Assert.Equal(5, meio.BaixasD);
        s.Terminar(b);
        var fim = Batalhas.PlacarDe(s.M, b, s.M.Agora);
        Assert.Equal(GT.Total(b.PerdasDefesa), fim.BaixasD);
        Assert.Equal(GT.Total(b.PerdasAtaque), fim.BaixasA);
        Assert.Equal(10, fim.TotalD);
    }

    // ---------------------------------------------------------------- recuo sem o que levar

    private static JsonArray Recursos(params string[] rs) => new(rs.Select(r => (JsonNode)CombateCenario.Obj("recurso", r)).ToArray());

    [Fact]
    public void Saque_sem_o_que_levar_volta_sem_combate_e_diz_por_que()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 5)), 0);
        var ex = s.Atacar(alvo, G(("arqueiro", 10)), CombateCenario.Plano("saque", "media", Recursos("ferro"), recuarVazio: true));
        s.AvancarAte(ex.Chegada);
        Assert.Empty(s.M.Batalhas);
        Assert.True(ex.Retornando);
        var rel = s.M.Relatorios.Last(x => x.ReinoId == s.Atk.Id);
        Assert.Contains("Não havia o que levar", rel.Dados["porQueVoltaram"]!.GetValue<string>());
    }

    [Fact]
    public void Saque_que_manda_lutar_ou_que_tem_o_que_levar_entra_em_batalha()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 5)), 0);
        var lutar = s.Atacar(alvo, G(("arqueiro", 10)), CombateCenario.Plano("saque", "media", Recursos("ferro"), recuarVazio: false));
        Assert.False(s.Chegar(lutar).Encerrada);

        var s2 = new CombateCenario();
        var alvo2 = s2.Alvo(TipoLocal.Mina, G(("lanceiro", 5)), 0);
        alvo2.Estoque["ferro"] = 50;
        var tem = s2.Atacar(alvo2, G(("arqueiro", 10)), CombateCenario.Plano("saque", "media", Recursos("ferro"), recuarVazio: true));
        Assert.False(s2.Chegar(tem).Encerrada);
    }

    [Fact]
    public void Outra_frente_leva_tudo_e_quem_pediu_volta_durante_a_batalha()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 1)), 0);
        alvo.Estoque["ferro"] = 10;
        var plano = CombateCenario.Plano("saque", "media", Recursos("ferro"), recuarVazio: true);
        var (b1, b2, _) = DuasFrentes(s, alvo, G(("cavalaria", 20)), G(("arqueiro", 20)), plano, plano.DeepClone().AsObject());
        var (primeira, segunda) = b1.FimPrevisto <= b2.FimPrevisto ? (b1, b2) : (b2, b1);
        s.AvancarAte(primeira.FimPrevisto);
        Assert.Equal("vitoria", primeira.Resultado);
        Assert.Equal(0, alvo.Estoque.Qtd("ferro"));
        Assert.True(segunda.Encerrada);
        Assert.Equal("recuo", segunda.Resultado);
        Assert.Contains("Não havia o que levar", segunda.MotivoRecuo);
    }

    // ---------------------------------------------------------------- saque por prioridade

    [Fact]
    public void Partilha_por_prioridade_enche_o_primeiro_e_igual_divide()
    {
        var itens = new List<(string, double)> { ("ferro", 100), ("pedra", 100), ("madeira", 10) };
        var p = Ataques.Partilha(itens, 120, Ataques.DivisaoPrioridade);
        Assert.Equal(100, p["ferro"]); Assert.Equal(20, p["pedra"]); Assert.False(p.ContainsKey("madeira"));
        var i = Ataques.Partilha(itens, 120, Ataques.DivisaoIgual);
        Assert.Equal(10, i["madeira"]); Assert.Equal(55, i["ferro"]); Assert.Equal(55, i["pedra"]);   // a sobra de quem tinha pouco vai para os outros
    }

    [Theory]
    [InlineData("prioridade", 75, 0)]
    [InlineData("igual", 38, 37)]
    public void Saque_traz_pela_divisao_escolhida(string divisao, double ferro, double pedra)
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 1)), 0);
        alvo.Estoque["ferro"] = 500; alvo.Estoque["pedra"] = 500;
        var g = G(("cavalaria", 5));
        var ex = s.Atacar(alvo, g, CombateCenario.Plano("saque", "semLimite", Recursos("ferro", "pedra"), divisao: divisao));
        var b = s.Chegar(ex);
        s.Terminar(b);
        Assert.Equal("vitoria", b.Resultado);
        var cap = ex.CargaMax(s.M);
        Assert.InRange(ex.Carga.Total, cap - 2, cap);
        if (divisao == "prioridade") { Assert.Equal(cap, ex.Carga.Qtd("ferro"), 0); Assert.Equal(0, ex.Carga.Qtd("pedra")); }
        else Assert.InRange(ex.Carga.Qtd("ferro") - ex.Carga.Qtd("pedra"), -1, 1);
    }

    [Fact]
    public void Quantidade_de_recurso_e_ignorada_no_plano()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 1)), 0);
        var p = Ataques.Normalizar(s.M, alvo, new PlanoAtaque { Tipo = "saque", Tatica = "media", Objetivos = [new("recurso", "ferro", 777)] });
        Assert.Equal(0, Assert.Single(p.Objetivos).Q);
        Assert.Equal(Ataques.DivisaoPrioridade, p.Divisao);
        Assert.True(p.RecuarVazio);
    }

    // ---------------------------------------------------------------- repouso no castelo

    [Fact]
    public void Soldado_no_castelo_recupera_a_vida_no_ritmo_do_repouso()
    {
        var s = new CombateCenario();
        var ex = s.Atacar(s.Alvo(TipoLocal.Mina, G(("lanceiro", 1)), 0), G(("lanceiro", 3)));
        var p = Pessoas.SoldadosDaMarcha(s.M, ex).First();
        var max = Vidas.Max(s.M, p);
        Vidas.Ferir(s.M, p, max / 2);
        Exercitos.Retornar(s.M, ex);
        s.AvancarAte(ex.Chegada);
        Assert.Equal(Estados.Guarnecida, p.Estado);
        Assert.True(p.Repouso);
        var antes = Vidas.Atual(s.M, p);
        // P.vida.repousoPorMin da vida máxima por minuto (30% no ritmo 3×: eram 10%)
        s.T.AvancarMin(1);
        Assert.Equal(Math.Min(max, antes + max * s.M.P.Vida.RepousoPorMin), Vidas.Atual(s.M, p), 6);
        s.T.AvancarMin(10);
        Assert.False(Vidas.Ferida(s.M, p));
    }

    [Fact]
    public void Fora_do_castelo_ou_em_batalha_a_vida_volta_no_ritmo_normal()
    {
        var s = new CombateCenario();
        var castelo = s.Alvo(TipoLocal.Castelo, G(("lanceiro", 3)), 0);
        Pessoas.Sincronizar(s.M, castelo);
        var p = Pessoas.Guarnicao(s.M, castelo).First();
        Vidas.Reavaliar(s.M, p);
        Assert.True(p.Repouso);
        var ex = s.Atacar(castelo, G(("arqueiro", 3)));
        var b = s.Chegar(ex);
        Assert.False(p.Repouso);
        var max = Vidas.Max(s.M, p);
        Vidas.Ferir(s.M, p, max / 2);
        var antes = Vidas.Atual(s.M, p);
        // 10 s: a batalha não tem mais tempo fixo e esta, pequena, acaba em menos de 1 min
        s.T.Avancar(TimeSpan.FromSeconds(10));
        Assert.Equal(antes + max / s.M.P.Vida.RecuperaH / 360, Vidas.Atual(s.M, p), 6);
        Assert.False(b.Encerrada);
    }
}
