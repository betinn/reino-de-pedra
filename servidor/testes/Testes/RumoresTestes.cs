using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.IA;
using ReinoDePedra.Jogo.Marchas;

namespace ReinoDePedra.Testes;

/// <summary>Rumores (decisão 0035): região de cada reino desde o início e poeira das marchas grandes fora da vista.</summary>
public class RumoresTestes
{
    public RumoresTestes() => AjustesTeste.Garantir();

    [Fact]
    public void Cada_outro_reino_tem_uma_regiao_desde_o_inicio_com_o_castelo_dentro_e_fora_do_centro_fixo()
    {
        var s = new CombateCenario();
        var p = s.M.P.RegiaoReino;
        var regioes = Rumores.Regioes(s.M, s.Atk.Id);
        Assert.Single(regioes);   // só o outro reino: o próprio fica de fora
        var rg = regioes[0];
        var casteloDef = s.M.Locais[s.Def.CasteloId].Hex;
        Assert.InRange(s.M.G.Distancia(rg.Centro, casteloDef), 0, p.Desvio);
        Assert.True(rg.Raio >= p.Desvio);   // o castelo sempre cai dentro da área
        Assert.Equal(rg, Rumores.Regioes(s.M, s.Atk.Id)[0]);   // fixa: não pula a cada consulta
        Assert.NotEqual(s.Def.Id.ToString(), rg.Chave);   // a chave não é o id do reino
        // não depende de ter explorado: nada foi visto ali
        Assert.Equal(0, Nevoas.De(s.M, s.Atk.Id).MinutoVisto(rg.Centro));
    }

    [Fact]
    public void Marcha_grande_fora_da_vista_levanta_poeira_com_posicao_aproximada_e_rumo()
    {
        var s = new CombateCenario();
        var casteloDef = s.M.Locais[s.Def.CasteloId];
        s.Guarnecer(casteloDef, new Dictionary<string, int> { ["lanceiro"] = 15 });
        var destino = s.HexLivre(s.CasteloAtk.Hex, 3);
        var ex = Exercitos.Enviar(s.M, s.Def, casteloDef.Id, new Dictionary<string, int> { ["lanceiro"] = 15 }, destino, OrdemMover.Id);
        Rastro? achado = null; int hexReal = -1;
        for (var i = 0; i < 2000 && achado == null && s.M.Agora < ex.Tempos[^1]; i++)
        {
            s.T.AvancarMin(0.5);
            var h = ex.HexEm(s.M.Agora);
            var vis = Nevoas.VisiveisAgora(s.M, s.Atk.Id);
            var rastros = Rumores.Rastros(s.M, s.Atk.Id, vis);
            if (vis.Contains(h)) { Assert.Empty(rastros); continue; }   // à vista, a marcha aparece inteira, sem poeira
            if (rastros.Count > 0) { achado = rastros[0]; hexReal = h; }
        }
        Assert.NotNull(achado);
        Assert.Equal(Rumores.Aproximar(s.M, hexReal), achado!.Hex);
        Assert.Equal("≈ 15", achado.Tamanho);
        Assert.NotEqual("aqui", achado.Rumo);
        // o dono não vê poeira da própria marcha
        Assert.Empty(Rumores.Rastros(s.M, s.Def.Id, Nevoas.VisiveisAgora(s.M, s.Def.Id)));
    }

    [Fact]
    public void Marcha_pequena_nao_levanta_poeira()
    {
        var s = new CombateCenario();
        var casteloDef = s.M.Locais[s.Def.CasteloId];
        var n = s.M.P.Rastro.Tropas - 1;
        s.Guarnecer(casteloDef, new Dictionary<string, int> { ["lanceiro"] = n });
        var ex = Exercitos.Enviar(s.M, s.Def, casteloDef.Id, new Dictionary<string, int> { ["lanceiro"] = n }, s.HexLivre(s.CasteloAtk.Hex, 3), OrdemMover.Id);
        for (var i = 0; i < 2000 && s.M.Agora < ex.Tempos[^1]; i++)
        {
            s.T.AvancarMin(0.5);
            Assert.Empty(Rumores.Rastros(s.M, s.Atk.Id, Nevoas.VisiveisAgora(s.M, s.Atk.Id)));
        }
    }

    [Fact]
    public void IA_vai_procurar_o_reino_da_regiao_e_para_quando_acha_um_local_dele()
    {
        var s = new CombateCenario();
        var rg = Rumores.Regioes(s.M, s.Atk.Id)[0];
        var alvo = Governo.RegiaoAProcurar(s.M, s.Atk, s.CasteloAtk);
        Assert.NotNull(alvo);
        Assert.InRange(s.M.G.Distancia(alvo!.Value, rg.Centro), 0, rg.Raio);
        Assert.Equal(0, Nevoas.De(s.M, s.Atk.Id).MinutoVisto(alvo.Value));
        // achou o castelo (a foto do hexágono mostra o local): a região deixa de ser procurada
        s.Conhecer(s.Atk, s.M.Locais[s.Def.CasteloId]);
        Assert.Null(Governo.RegiaoAProcurar(s.M, s.Atk, s.CasteloAtk));
    }
}
