using System.Net;
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
using ReinoDePedra.Jogo.Valiosos;

namespace ReinoDePedra.Testes;

/// <summary>
/// Barras de tempo no cliente (decisão 0027): tudo que tem tempo leva o instante de início junto do fim, para a barra de progresso.
/// Trabalho de exércitos (caça, extração, escavação), treino de cada pessoa, pessoa andando, material a caminho de uma obra.
/// </summary>
public class BarrasDeTempoTestes
{
    public BarrasDeTempoTestes() => AjustesTeste.Garantir();

    private static Local Castelo(MundoTeste t, Reino r) => t.M.Locais[r.CasteloId];
    private static void AvancarAte(MundoTeste t, long instante) => t.Avancar(TimeSpan.FromMilliseconds(Math.Max(0, instante - t.M.Agora)));
    private static JsonElement J(object o) => JsonSerializer.SerializeToElement(o, Json.Web);
    private static bool Nulo(JsonElement o, string nome) => !o.TryGetProperty(nome, out var v) || v.ValueKind == JsonValueKind.Null;

    private static int HexLivre(MundoTeste t, int de, int dist) =>
        t.M.G.Area(de, dist).Where(h => t.M.G.Distancia(h, de) == dist && !t.M.Mapa.Rio[h] && Obras.HexLivre(t.M, h)
            && t.M.G.C(h) > 2 && t.M.G.L(h) > 2 && t.M.G.C(h) < t.M.G.Cols - 3 && t.M.G.L(h) < t.M.G.Lins - 3).First();

    private static void Guarnecer(MundoTeste t, Reino r, Local l, string unidade, int n)
    {
        Economia.Atualizar(t.M, r);
        l.Guarnicao[unidade] = l.Guarnicao.GetValueOrDefault(unidade) + n;
        Pessoas.RemoverCivis(t.M, r, t.B.U[unidade].Pop * n);
        t.M.Sujar(l); t.M.Sujar(r);
    }

    [Fact]
    public void Cacada_leva_o_inicio_na_chegada_ao_bando()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        var alvo = HexLivre(t, c.Hex, 3);
        Fauna.Adicionar(t.M, new RegiaoFauna { Centro = alvo, Hex = alvo, Raio = 1, Animal = "javalis", Nivel = "baixo", Qtd = 4 });
        Guarnecer(t, r, c, "arqueiro", 10);
        var ex = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["arqueiro"] = 10 }, alvo, OrdemCacar.Id);
        var chegada = ex.Chegada;
        AvancarAte(t, chegada + 1);
        t.Avancar(TimeSpan.FromMinutes(1));
        var tr = J(VisaoTropas.Exercito(t.M, ex)).GetProperty("trabalho");
        Assert.Equal("caca", tr.GetProperty("tipo").GetString());
        var ini = tr.GetProperty("inicio").GetInt64();
        var fim = tr.GetProperty("fim").GetInt64();
        Assert.Equal(T.DeHoras(t.M.P.CacaMin / 60), fim - ini);
        Assert.InRange(ini, chegada, chegada + 1);
        Assert.True(ini < t.M.Agora && t.M.Agora < fim);
    }

    [Fact]
    public void Extracao_leva_um_inicio_que_faz_a_barra_andar_com_a_carga()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        var j = t.M.Jazidas.Adicionar(new Jazida { Hex = HexLivre(t, c.Hex, 3), Recurso = "prata", Inicial = 2000, Restante = 2000 });
        j.DescobertaPor.Add(r.Id);
        Guarnecer(t, r, c, "lanceiro", 5);
        var ex = Extracoes.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 5 }, j.Hex, Extracoes.OrdemExtrair, false, new JsonObject());
        // a caminho: a barra é a marcha (partida → chegada)
        var g0 = J(VisaoValiosos.Grupo(t.M, r, ex));
        Assert.Equal(ex.Partida, g0.GetProperty("partida").GetInt64());
        Assert.Equal(ex.Chegada, g0.GetProperty("chegada").GetInt64());
        AvancarAte(t, ex.Chegada + 1);
        var tr0 = J(VisaoTropas.Exercito(t.M, ex)).GetProperty("trabalho");
        var fim = tr0.GetProperty("fim").GetInt64();
        Assert.InRange(tr0.GetProperty("inicio").GetInt64(), t.M.Agora - 2, t.M.Agora);   // carga vazia: começa agora

        // na metade do tempo, a barra está na metade (a carga cresce no mesmo ritmo)
        AvancarAte(t, t.M.Agora + (fim - t.M.Agora) / 2);
        var tr = J(VisaoTropas.Exercito(t.M, ex)).GetProperty("trabalho");
        var ini = tr.GetProperty("inicio").GetInt64();
        Assert.Equal(fim, tr.GetProperty("fim").GetInt64());
        var pct = (double)(t.M.Agora - ini) / (fim - ini);
        Assert.InRange(pct, 0.45, 0.55);
        var g = J(VisaoValiosos.Grupo(t.M, r, ex));
        Assert.Equal(ini, g.GetProperty("extraiInicio").GetInt64());
        Assert.True(Nulo(g, "partida"));
    }

    [Fact]
    public void Escavacao_leva_o_inicio_da_escavacao()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        var ru = t.M.Ruinas.Adicionar(new Ruina { Hex = HexLivre(t, c.Hex, 3), TipoReliquia = "producao" });
        Nevoas.RevelarArea(t.M, r.Id, ru.Hex, 1);
        Guarnecer(t, r, c, "lanceiro", 1);
        var ex = Extracoes.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 1 }, ru.Hex, Escavacoes.OrdemEscavar, false, new JsonObject());
        AvancarAte(t, ex.Chegada);
        t.Avancar(TimeSpan.FromMinutes(3));
        var tr = J(VisaoTropas.Exercito(t.M, ex)).GetProperty("trabalho");
        Assert.Equal("escavacao", tr.GetProperty("tipo").GetString());
        Assert.Equal(ex.EscavaInicio, tr.GetProperty("inicio").GetInt64());
        Assert.Equal(ex.EscavaFim, tr.GetProperty("fim").GetInt64());
        Assert.True(tr.GetProperty("inicio").GetInt64() < t.M.Agora);
    }

    [Fact]
    public void Cada_pessoa_em_treino_leva_o_inicio_da_propria_unidade()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        t.DarRecursos(r);
        var item = Recrutamento.Recrutar(t.M, r, r.CasteloId, "milicia", 2);
        var ps = Pessoas.EmTreino(t.M, r, item).ToList();
        Assert.Equal(2, ps.Count);
        var a = J(VisaoPessoas.Pessoa(t.M, r, ps[0]));
        var b = J(VisaoPessoas.Pessoa(t.M, r, ps[1]));
        Assert.Equal(item.Inicio, a.GetProperty("treinoInicio").GetInt64());
        Assert.Equal(a.GetProperty("pronta").GetInt64(), b.GetProperty("treinoInicio").GetInt64());   // a segunda começa quando a primeira fica pronta
        Assert.Equal(item.Fim, b.GetProperty("pronta").GetInt64());
        Assert.True(Nulo(a, "partida"));
    }

    [Fact]
    public void Pessoa_andando_leva_a_partida()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var serraria = t.M.LocaisDe(r.Id).First(l => l.Produz == "madeira");
        var p = Pessoas.Presentes(t.M, Castelo(t, r)).First(x => x.EhCivil);
        Pessoas.Mover(t.M, r, p.Id, serraria.Id);
        var v = J(VisaoPessoas.Pessoa(t.M, r, p));
        var mc = t.M.Marchas[p.GrupoId!.Value];
        Assert.Equal(mc.Partida, v.GetProperty("partida").GetInt64());
        Assert.Equal(mc.Chegada, v.GetProperty("chegada").GetInt64());
    }

    [Fact]
    public async Task Obra_esperando_material_leva_a_partida_dos_carregadores()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var c = s.NovoCliente();
        var reino = await c.ContaComReino("bia@exemplo.com", "Ampulheta");
        var casteloId = reino.GetProperty("casteloId").GetInt64();
        var serrariaId = reino.GetProperty("locais").EnumerateArray().First(l => l.GetProperty("produz").GetString() == "madeira").GetProperty("id").GetInt64();
        await s.Motor.Executar(m =>
        {
            var cast = m.Locais[casteloId]; var ser = m.Locais[serrariaId];
            Economia.Atualizar(m, m.Reinos.Obter(cast.ReinoId)!);
            foreach (var k in new[] { "comida", "ferro", "pedra" }) cast.Estoque.Somar(k, 1000);
            ser.Estoque.Somar("madeira", 1000 + cast.Estoque.Retirar("madeira", cast.Estoque.Qtd("madeira")));
            m.Sujar(cast); m.Sujar(ser);
        });
        var (st, obra) = await c.Post("obras", new { acao = "moradia", localId = casteloId });
        Assert.True(st == HttpStatusCode.Created, obra.ToString());
        Assert.Equal("material", obra.GetProperty("estado").GetString());
        var partida = obra.GetProperty("materialPartida").GetInt64();
        var chega = obra.GetProperty("materialChegaEm").GetInt64();
        Assert.True(partida > 0 && partida < chega);
        var (_, r) = await c.Get("reino");
        var ob = Assert.Single(r.GetProperty("filas").GetProperty("obras").EnumerateArray());
        Assert.Equal(partida, ob.GetProperty("materialPartida").GetInt64());
        // quando o material chega, a obra começa e o campo some
        await s.Avancar(TimeSpan.FromMinutes(5));
        var (_, r2) = await c.Get("reino");
        var ob2 = Assert.Single(r2.GetProperty("filas").GetProperty("obras").EnumerateArray());
        Assert.True(Nulo(ob2, "materialPartida"));
        Assert.True(ob2.GetProperty("inicio").GetInt64() > 0);
    }
}
