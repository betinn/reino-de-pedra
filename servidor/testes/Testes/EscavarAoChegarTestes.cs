using System.Text.Json;
using System.Text.Json.Nodes;
using ReinoDePedra.Api;
using ReinoDePedra.Api.Visoes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Mapa;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Pessoas;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using ReinoDePedra.Jogo.Valiosos;

namespace ReinoDePedra.Testes;

/// <summary>
/// A tropa mandada escavar ou extrair trabalha ao chegar, sem nova ordem, e diz que está trabalhando. A intenção é a ordem
/// guardada no servidor, então vale com o jogador offline e também para uma ruína que ainda não estava explorada no envio.
/// </summary>
public class EscavarAoChegarTestes
{
    public EscavarAoChegarTestes() => AjustesTeste.Garantir();

    private static Local Castelo(MundoTeste t, Reino r) => t.M.Locais[r.CasteloId];
    private static void AvancarAte(MundoTeste t, long instante) => t.Avancar(TimeSpan.FromMilliseconds(Math.Max(0, instante - t.M.Agora)));
    private static JsonElement J(object o) => JsonSerializer.SerializeToElement(o, Json.Web);
    private static Dictionary<string, int> Lanceiros(int n) => new() { ["lanceiro"] = n };

    private static void Guarnecer(MundoTeste t, Reino r, Local l, string unidade, int n)
    {
        Economia.Atualizar(t.M, r);
        l.Guarnicao[unidade] = l.Guarnicao.GetValueOrDefault(unidade) + n;
        Pessoas.RemoverCivis(t.M, r, t.B.U[unidade].Pop * n);
        t.M.Sujar(l); t.M.Sujar(r);
    }

    private static int HexLivre(MundoTeste t, Reino r, int dist, bool nuncaVisto) =>
        t.M.G.Area(Castelo(t, r).Hex, dist).Where(h => t.M.G.Distancia(h, Castelo(t, r).Hex) == dist && !t.M.Mapa.Rio[h] && Obras.HexLivre(t.M, h)
            && t.M.G.C(h) > 2 && t.M.G.L(h) > 2 && t.M.G.C(h) < t.M.G.Cols - 3 && t.M.G.L(h) < t.M.G.Lins - 3
            && (!nuncaVisto || !Nevoas.Explorado(t.M, r.Id, h))).First();

    private static (MundoTeste t, Reino r, Local c, Ruina ru) Cenario(bool explorada, int lanceiros = 6)
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        var ru = t.M.Ruinas.Adicionar(new Ruina { Hex = HexLivre(t, r, explorada ? 6 : 25, !explorada), TipoReliquia = "ataque" });
        if (explorada) Nevoas.RevelarArea(t.M, r.Id, ru.Hex, 2);
        Assert.Equal(explorada, Nevoas.Explorado(t.M, r.Id, ru.Hex));
        Guarnecer(t, r, c, "lanceiro", lanceiros);
        return (t, r, c, ru);
    }

    private static Relatorio UltimoRelatorio(MundoTeste t, Reino r, string tipo) =>
        t.M.Relatorios.Where(x => x.ReinoId == r.Id && x.Tipo == tipo).OrderBy(x => x.Id).Last();
    private static string Resumo(Relatorio x) => x.Dados["resumo"]!.GetValue<string>();

    // ---------------------------------------------------------------- escava ao chegar

    [Fact]
    public void Ruina_explorada_escava_ao_chegar_e_diz_que_esta_escavando()
    {
        var (t, r, c, ru) = Cenario(explorada: true);
        var ex = Exercitos.Enviar(t.M, r, c.Id, Lanceiros(2), ru.Hex, Escavacoes.OrdemEscavar);
        Assert.Equal("marchando", VisaoTropas.Estado(t.M, ex));
        AvancarAte(t, ex.Chegada);

        Assert.Equal(ru.Id, ex.EscavaRuinaId);
        Assert.Equal("trabalhando", VisaoTropas.Estado(t.M, ex));
        var mapa = J(VisaoMapa.MarchaPropria(t.M, r, ex, t.M.Agora));
        Assert.Equal("trabalhando", mapa.GetProperty("estado").GetString());
        Assert.Equal("escavacao", mapa.GetProperty("trabalho").GetProperty("tipo").GetString());
        Assert.Equal(ex.EscavaInicio, mapa.GetProperty("trabalho").GetProperty("inicio").GetInt64());
        Assert.Equal(ex.EscavaFim, mapa.GetProperty("trabalho").GetProperty("fim").GetInt64());
    }

    [Fact]
    public void Ruina_nao_explorada_no_envio_escava_ao_chegar_sem_nova_ordem()
    {
        var (t, r, c, ru) = Cenario(explorada: false);
        var ex = Exercitos.Enviar(t.M, r, c.Id, Lanceiros(6), ru.Hex, Escavacoes.OrdemEscavar);
        Assert.Equal(Escavacoes.OrdemEscavar, ex.Ordem);
        AvancarAte(t, ex.Chegada);

        Assert.True(Nevoas.Explorado(t.M, r.Id, ru.Hex));   // a marcha revelou a névoa no caminho
        Assert.Equal(ru.Id, ex.EscavaRuinaId);
        Assert.Equal("trabalhando", VisaoTropas.Estado(t.M, ex));
        t.AvancarHoras(Escavacoes.Horas(t.M, ex.Tropas, false) + 0.01);
        Assert.True(ru.Esgotada);
        Assert.Equal(ex.Id, Assert.Single(t.M.Reliquias).MarchaId);
    }

    [Fact]
    public void Tropa_em_campo_mandada_a_ruina_nao_explorada_escava_ao_chegar()
    {
        var (t, r, c, ru) = Cenario(explorada: false);
        var perto = HexLivre(t, r, 3, nuncaVisto: false);
        var ex = Exercitos.Enviar(t.M, r, c.Id, Lanceiros(6), perto, OrdemMover.Id);
        AvancarAte(t, ex.Chegada);
        Assert.Equal("parado", VisaoTropas.Estado(t.M, ex));

        Exercitos.DarOrdem(t.M, r, ex.Id, Escavacoes.OrdemEscavar, ru.Hex);
        AvancarAte(t, ex.Chegada);
        Assert.Equal(ru.Id, ex.EscavaRuinaId);
    }

    [Fact]
    public void Segundo_grupo_mandado_a_ruina_nao_explorada_se_junta_ao_que_ja_escava()
    {
        var (t, r, c, ru) = Cenario(explorada: false);
        var um = Exercitos.Enviar(t.M, r, c.Id, Lanceiros(3), ru.Hex, Escavacoes.OrdemEscavar);
        var dois = Exercitos.Enviar(t.M, r, c.Id, Lanceiros(3), ru.Hex, Escavacoes.OrdemEscavar);
        AvancarAte(t, Math.Max(um.Chegada, dois.Chegada));

        var quemEscava = t.M.Marchas.OfType<Exercito>().Single(e => e.EscavaRuinaId == ru.Id);
        Assert.Equal(6, quemEscava.Tropas["lanceiro"]);
        Assert.Equal("trabalhando", VisaoTropas.Estado(t.M, quemEscava));
    }

    [Fact]
    public void Tropa_parada_na_ruina_passa_de_parada_para_escavando()
    {
        var (t, r, c, ru) = Cenario(explorada: true);
        var ex = Exercitos.Enviar(t.M, r, c.Id, Lanceiros(2), ru.Hex, OrdemMover.Id);
        AvancarAte(t, ex.Chegada);
        Assert.Equal("parado", VisaoTropas.Estado(t.M, ex));

        Exercitos.DarOrdem(t.M, r, ex.Id, Escavacoes.OrdemEscavar, ru.Hex);
        t.Avancar(TimeSpan.FromSeconds(1));
        Assert.Equal("trabalhando", VisaoTropas.Estado(t.M, ex));
    }

    // ---------------------------------------------------------------- impossível ao chegar: o relatório diz por quê

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void Ruina_esgotada_durante_a_marcha_volta_com_relatorio(bool explorada)
    {
        var (t, r, c, ru) = Cenario(explorada);
        var ex = Exercitos.Enviar(t.M, r, c.Id, Lanceiros(6), ru.Hex, Escavacoes.OrdemEscavar);
        ru.Esgotada = true;
        AvancarAte(t, ex.Chegada);

        Assert.Null(ex.EscavaRuinaId);
        Assert.Equal(OrdemRetornar.Id, ex.Ordem);
        Assert.Equal("retornando", VisaoTropas.Estado(t.M, ex));
        Assert.Contains("Não há mais relíquia", Resumo(UltimoRelatorio(t, r, "reliquia")));
    }

    [Fact]
    public void Ruina_tomada_durante_a_marcha_volta_com_relatorio()
    {
        var (t, r, c, ru) = Cenario(explorada: true);
        var outro = t.NovoReino();
        var ex = Exercitos.Enviar(t.M, r, c.Id, Lanceiros(2), ru.Hex, Escavacoes.OrdemEscavar);
        t.M.AdicionarLocal(new Local { ReinoId = outro.Id, Tipo = TipoLocal.Posto, Hex = ru.Hex, Nivel = 1, Nome = "Posto" });
        AvancarAte(t, ex.Chegada);

        Assert.Null(ex.EscavaRuinaId);
        Assert.Equal(OrdemRetornar.Id, ex.Ordem);
        Assert.Contains("posto de outro reino", Resumo(UltimoRelatorio(t, r, "reliquia")));
    }

    // ---------------------------------------------------------------- o segredo continua: se a ruína ainda guarda relíquia, é preciso ir ver

    [Fact]
    public void Ruina_esgotada_nunca_vista_nao_e_recusada_nem_revelada_antes_de_ir_ver()
    {
        var (t, r, c, ru) = Cenario(explorada: false);
        ru.Esgotada = true;

        var previa = J(VisaoValiosos.PreviaExtracao(t.M, r, c.Id, Lanceiros(2), ru.Hex));
        Assert.Equal("escavacao", previa.GetProperty("tipo").GetString());
        Assert.False(previa.GetProperty("esgotada").GetBoolean());
        var ex = Exercitos.Enviar(t.M, r, c.Id, Lanceiros(6), ru.Hex, Escavacoes.OrdemEscavar);
        Assert.Equal(Escavacoes.OrdemEscavar, ex.Ordem);
    }

    [Fact]
    public void Ruina_explorada_e_esgotada_continua_recusada_no_envio()
    {
        var (t, r, c, ru) = Cenario(explorada: true);
        ru.Esgotada = true;
        Assert.Throws<RegraException>(() => Exercitos.Enviar(t.M, r, c.Id, Lanceiros(2), ru.Hex, Escavacoes.OrdemEscavar));
    }

    [Fact]
    public void Sem_ruina_no_hexagono_a_ordem_e_recusada()
    {
        var (t, r, c, _) = Cenario(explorada: true);
        var vazio = HexLivre(t, r, 8, nuncaVisto: false);
        Assert.Throws<RegraException>(() => Exercitos.Enviar(t.M, r, c.Id, Lanceiros(2), vazio, Escavacoes.OrdemEscavar));
    }

    // ---------------------------------------------------------------- extrair

    private static (MundoTeste t, Reino r, Local c, Jazida j) CenarioJazida()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        var j = t.M.Jazidas.Adicionar(new Jazida { Hex = HexLivre(t, r, 6, nuncaVisto: false), Recurso = "prata", Inicial = 500, Restante = 500 });
        j.DescobertaPor.Add(r.Id);
        Nevoas.RevelarArea(t.M, r.Id, j.Hex, 2);
        Guarnecer(t, r, c, "lanceiro", 2);
        return (t, r, c, j);
    }

    [Fact]
    public void Jazida_extrai_ao_chegar_e_diz_que_esta_extraindo()
    {
        var (t, r, c, j) = CenarioJazida();
        var ex = Exercitos.Enviar(t.M, r, c.Id, Lanceiros(2), j.Hex, Extracoes.OrdemExtrair);
        AvancarAte(t, ex.Chegada);

        Assert.Equal(j.Id, ex.ExtraiJazidaId);
        var mapa = J(VisaoMapa.MarchaPropria(t.M, r, ex, t.M.Agora));
        Assert.Equal("trabalhando", mapa.GetProperty("estado").GetString());
        Assert.Equal("extracao", mapa.GetProperty("trabalho").GetProperty("tipo").GetString());
        Assert.True(mapa.GetProperty("trabalho").GetProperty("fim").GetInt64() > t.M.Agora);
    }

    [Fact]
    public void Jazida_esgotada_durante_a_marcha_volta_com_relatorio()
    {
        var (t, r, c, j) = CenarioJazida();
        var ex = Exercitos.Enviar(t.M, r, c.Id, Lanceiros(2), j.Hex, Extracoes.OrdemExtrair);
        j.Restante = 0;
        AvancarAte(t, ex.Chegada);

        Assert.Null(ex.ExtraiJazidaId);
        Assert.Equal(OrdemRetornar.Id, ex.Ordem);
        Assert.Contains("Não há mais o que extrair", Resumo(UltimoRelatorio(t, r, "extracao")));
    }

    [Fact]
    public void Jazida_tomada_durante_a_marcha_volta_com_relatorio()
    {
        var (t, r, c, j) = CenarioJazida();
        var outro = t.NovoReino();
        var ex = Exercitos.Enviar(t.M, r, c.Id, Lanceiros(2), j.Hex, Extracoes.OrdemExtrair);
        t.M.AdicionarLocal(new Local { ReinoId = outro.Id, Tipo = TipoLocal.Posto, Hex = j.Hex, Nivel = 1, Nome = "Posto" });
        AvancarAte(t, ex.Chegada);

        Assert.Null(ex.ExtraiJazidaId);
        Assert.Equal(OrdemRetornar.Id, ex.Ordem);
        Assert.Contains("posto de outro reino", Resumo(UltimoRelatorio(t, r, "extracao")));
    }
}
