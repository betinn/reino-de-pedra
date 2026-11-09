using ReinoDePedra.Jogo.Publico;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Testes;

/// <summary>Avisos do centro da tela em dois tamanhos: o servidor classifica cada notícia e dá a ordem da fila.</summary>
public class AvisosTestes
{
    private static Dictionary<string, int> G(params (string k, int n)[] x) => x.ToDictionary(p => p.k, p => p.n);

    [Fact]
    public void Toda_categoria_tem_um_tamanho_e_so_ameaca_batalha_e_temporada_sao_grandes_por_padrao()
    {
        foreach (var c in Registros.Categorias.Keys)
            Assert.True(TamanhoAviso.Valido(TamanhoAviso.DaCategoria(c)), c);
        var grandes = Registros.Categorias.Keys.Where(c => TamanhoAviso.DaCategoria(c) == TamanhoAviso.Grande).OrderBy(c => c).ToArray();
        Assert.Equal(new[] { "ataques", "batalhas", "temporada" }, grandes);
        // as categorias grandes existem de verdade (um erro de digitação deixaria tudo pequeno)
        Assert.All(TamanhoAviso.CategoriasGrandes.Concat(TamanhoAviso.CategoriasDePerigo), c => Assert.Contains(c, Registros.Categorias.Keys));
    }

    [Fact]
    public void Obra_pronta_e_noticia_pequena()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var vila = t.M.LocaisDe(r.Id).First(l => l.Tipo != TipoLocal.Castelo);
        Obras.Melhorar(t.M, r, r.CasteloId);
        t.AvancarHoras(1);
        var n = t.M.Notificacoes.First(x => x.ReinoId == r.Id && x.Titulo == "Obra concluída");
        Assert.Equal(TamanhoAviso.Pequeno, n.Tamanho);
        Assert.Equal(2, TamanhoAviso.Prioridade(n));
        Assert.NotNull(vila);
    }

    [Fact]
    public void Ataque_e_batalha_sao_grandes_e_o_perigo_vem_na_frente()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 4)), 3);
        var ex = s.Atacar(alvo, G(("lanceiro", 12)));
        s.T.Avancar(TimeSpan.FromMilliseconds(ex.Chegada - s.M.Agora + 1000));
        var doDefensor = s.M.Notificacoes.Where(n => n.ReinoId == s.Def.Id && n.Categoria == "ataques").ToList();
        Assert.NotEmpty(doDefensor);
        Assert.All(doDefensor, n => { Assert.Equal(TamanhoAviso.Grande, n.Tamanho); Assert.Equal(0, TamanhoAviso.Prioridade(n)); });
        var doAtacante = s.M.Notificacoes.First(n => n.ReinoId == s.Atk.Id && n.Titulo == "Batalha começou");
        Assert.Equal(TamanhoAviso.Grande, doAtacante.Tamanho);
        Assert.Equal(1, TamanhoAviso.Prioridade(doAtacante));
    }

    [Fact]
    public void Quem_notifica_pode_fugir_do_padrao_da_categoria()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        // morte de feridos é grande numa categoria pequena; forças que voltaram sem combate são pequenas numa categoria grande
        var morte = Registros.Notificar(t.M, r.Id, "tropas", "Feridos morreram", tamanho: TamanhoAviso.Grande)!;
        var volta = Registros.Notificar(t.M, r.Id, "ataques", "Forças voltaram sem combate", tamanho: TamanhoAviso.Pequeno)!;
        var invalido = Registros.Notificar(t.M, r.Id, "obras", "Obra concluída", tamanho: "enorme")!;
        Assert.Equal(TamanhoAviso.Grande, morte.Tamanho);
        Assert.Equal(TamanhoAviso.Pequeno, volta.Tamanho);
        Assert.Equal(TamanhoAviso.Pequeno, invalido.Tamanho);
    }

    [Fact]
    public void Notificacao_antiga_sem_tamanho_usa_o_padrao_da_categoria()
    {
        Assert.Equal(TamanhoAviso.Grande, TamanhoAviso.Da(new Notificacao { Categoria = "batalhas" }));
        Assert.Equal(TamanhoAviso.Pequeno, TamanhoAviso.Da(new Notificacao { Categoria = "obras" }));
        Assert.Equal(TamanhoAviso.Pequeno, TamanhoAviso.Da(new Notificacao { Categoria = "batalhas", Tamanho = TamanhoAviso.Pequeno }));
    }

    [Fact]
    public void Ordem_da_fila_perigo_depois_grandes_depois_pequenos_e_no_empate_o_mais_antigo()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        string[][] chegada =
        [
            ["obras", "Obra concluída"], ["batalhas", "Batalha começou"], ["tropas", "Recrutamento concluído"],
            ["ataques", "Batalha em Mina Rubra"], ["exploracao", "Explorador no destino"], ["ataques", "Exército à vista"], ["temporada", "Fim da temporada"],
        ];
        var notas = chegada.Select(c => Registros.Notificar(t.M, r.Id, c[0], c[1])!).ToList();
        // a fila do cliente: ordena pela prioridade e mantém a ordem de chegada no empate
        var fila = notas.OrderBy(TamanhoAviso.Prioridade).ThenBy(n => n.Id).Select(n => n.Titulo).ToArray();
        Assert.Equal(new[]
        {
            "Batalha em Mina Rubra", "Exército à vista",                                   // perigo
            "Batalha começou", "Fim da temporada",                                          // grandes
            "Obra concluída", "Recrutamento concluído", "Explorador no destino",            // pequenos
        }, fila);
    }

    [Theory]
    [InlineData("queda", 0, "grande")]
    [InlineData("captura", 0, "grande")]
    [InlineData("batalha", 0, "pequeno")]
    [InlineData("fim-batalha", 3, "pequeno")]
    [InlineData("fim-batalha", 10, "grande")]
    [InlineData("fim-batalha", 40, "grande")]
    public void Mensagem_global_importante_e_grande_e_o_resto_pequena(string tipo, int mortos, string esperado) =>
        Assert.Equal(esperado, TamanhoAviso.DaMensagemGlobal(tipo, mortos));

    [Fact]
    public void O_feed_publico_leva_o_tamanho_de_cada_mensagem_global()
    {
        var t = new MundoTeste();
        MensagensGlobais.Publicar(t.M, "batalha", "Batalha em Mina Rubra: Reino A ataca Reino B.");
        MensagensGlobais.Publicar(t.M, "fim-batalha", "Reino A perdeu 12 tropas.", mortos: Enumerable.Range(0, 12).Select(i => "Pessoa " + i));
        MensagensGlobais.Publicar(t.M, "queda", "O castelo de Reino B caiu.");
        var feed = MensagensGlobais.ParaFeed(t.M, 10).Select(x => (tipo: x!["tipo"]!.GetValue<string>(), tam: x["aviso"]!.GetValue<string>())).ToList();
        Assert.Contains(("batalha", "pequeno"), feed);
        Assert.Contains(("fim-batalha", "grande"), feed);
        Assert.Contains(("queda", "grande"), feed);
    }
}
