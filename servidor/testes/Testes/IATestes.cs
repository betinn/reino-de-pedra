using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.IA;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using Xunit.Abstractions;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Testes;

/// <summary>Mundo de teste com a IA ligada (sessões e, se <c>criar</c>, a meta de ocupação).</summary>
public static class MundoIA
{
    public static MundoTeste Novo(bool criar = true, ulong semente = 7, ulong sorte = 42)
    {
        var t = new MundoTeste(semente);
        t.M.Sorte = new Rng(sorte);
        t.M.IA.Ativa = true; t.M.IA.CriarReinos = criar;
        SistemaIA.AoIniciar(t.M);
        Ocupacao.Completar(t.M);
        return t;
    }

    /// <summary>
    /// Reino de IA com perfil e habilidade escolhidos (na vaga livre mais longe dos jogadores). Quem governa é a persona
    /// neutra (<see cref="Personas.Neutra"/>): não falta, não esquece e não puxa para lado nenhum, para os testes da conduta
    /// medirem só habilidade × perfil. O que a persona muda é testado em PersonaTestes.
    /// </summary>
    public static Reino Criar(MundoTeste t, string perfil, string habilidade = "medio", int vaga = -1)
    {
        var r = Ocupacao.CriarUm(t.M, vaga) ?? throw new Exception("sem vaga");
        r.PerfilIA = perfil; r.HabilidadeIA = habilidade; r.Persona = Personas.Neutra();
        Governo.Preparar(t.M, r);
        Sessoes.Agendar(t.M, r);
        return r;
    }

    public static Conduta Conduta(MundoTeste t, Reino r) => Sessoes.De(t.M, r)!;

    /// <summary>Nome de jogador que o gerador de nomes da IA não produz.</summary>
    public static string Nome(int i) => "Jogador " + (char)('A' + i / 26 % 26) + (char)('a' + i % 26);
    public static Reino Jogador(MundoTeste t, int i) => t.NovoReino(Nome(i));
}

public class IATestes(ITestOutputHelper saida)
{
    private static Dictionary<string, double> R(params (string k, double n)[] g) => g.ToDictionary(x => x.k, x => x.n);
    /// <summary>Nome de jogador que o gerador de nomes da IA não produz.</summary>
    private static string Nome(int i) => "Jogador " + (char)('A' + i / 26 % 26) + (char)('a' + i % 26);
    private static Reino Jogador(MundoTeste t, int i) => t.NovoReino(Nome(i));

    // ---------------------------------------------------------------- meta de ocupação

    [Fact]
    public void Temporada_comeca_com_a_leva_inicial_de_IA_com_nomes_e_brasoes_validos()
    {
        var t = MundoIA.Novo();
        var ia = Ocupacao.DeIA(t.M).ToList();
        Assert.Equal(t.M.P.IA.Inicial, ia.Count);
        Assert.Equal(ia.Count, ia.Select(r => r.Nome.ToLowerInvariant()).Distinct().Count());
        foreach (var r in ia)
        {
            Assert.Null(r.ContaId);
            Assert.True(r.Brasao.Valido(extras: true, moldura: true));   // IA às vezes usa brasão de veterano (não se distingue)
            Assert.Matches(@"^[\p{L}][\p{L}\p{M} '\-]{1,22}[\p{L}\p{M}]$", r.Nome);
            Assert.Contains(r.PerfilIA, t.M.P.IA.Perfis.Keys);
            Assert.Contains(r.HabilidadeIA, t.M.P.IA.Habilidades.Keys);
            Assert.IsType<SessaoIAEvento>(t.M.Eventos.Obter(r.SessaoIAEventoId!.Value));
        }
        // a leva inicial deixa as primeiras vagas (as do meio do mapa) para os jogadores
        Assert.Equal(0, CriacaoReino.VagaLivre(t.M));
        // completar de novo não cria mais ninguém (já está acima do mínimo)
        Assert.Equal(0, Ocupacao.Completar(t.M));
    }

    [Fact]
    public void Jogador_entra_na_vaga_livre_e_depois_um_reino_de_IA_abdica_para_dar_lugar()
    {
        var t = MundoIA.Novo();
        var livres = t.M.P.Reinos - t.M.P.IA.Inicial;
        for (var i = 0; i < livres; i++) Jogador(t, i);
        Assert.Equal(t.M.P.IA.Inicial, Ocupacao.DeIA(t.M).Count());
        var menor = Ocupacao.DeIA(t.M).OrderBy(r => Ocupacao.Porte(t.M, r)).ThenBy(r => r.Vaga).First();
        var locaisIA = t.M.LocaisDe(menor.Id).Select(l => l.Id).ToList();
        var j = Jogador(t, 99);
        Assert.False(menor.Ativo);
        Assert.Equal(menor.Vaga, j.Vaga);
        Assert.Equal(t.M.P.IA.Inicial - 1, Ocupacao.DeIA(t.M).Count());
        Assert.Null(menor.SessaoIAEventoId);
        // os locais dele que não ficaram sob o reino novo viraram ruína ou terra livre, sem guarnição
        foreach (var id in locaisIA)
            if (t.M.Locais.Obter(id) is { } l) { Assert.Equal(0, l.ReinoId); Assert.Empty(l.Guarnicao); }
    }

    [Fact]
    public void Mundo_cheio_e_sem_IA_nao_aceita_mais_ninguem()
    {
        var t = MundoIA.Novo();
        for (var i = 0; i < t.M.P.Reinos; i++) Jogador(t, i);
        Assert.Empty(Ocupacao.DeIA(t.M));
        var e = Assert.Throws<RegraException>(() => Jogador(t, 99));
        Assert.Equal(409, e.Status);
        Assert.Contains("cheio", e.Message);
    }

    [Fact]
    public void Sem_criar_reinos_REINO_IA_0_ninguem_abdica_e_o_mundo_enche()
    {
        var t = MundoIA.Novo(criar: false);
        Assert.Empty(Ocupacao.DeIA(t.M));
        for (var i = 0; i < t.M.P.Reinos; i++) Jogador(t, i);
        Assert.Throws<RegraException>(() => Jogador(t, 99));
    }

    [Fact]
    public void IA_destruida_nao_renasce_e_abaixo_do_minimo_surge_outra_longe_dos_jogadores()
    {
        var t = MundoIA.Novo();
        var j = Jogador(t, 0);
        var jHex = t.M.Locais[j.CasteloId].Hex;
        var abaixo = Ocupacao.Ativos(t.M).Count() - t.M.P.IA.Minimo + 1;
        var mortos = Ocupacao.DeIA(t.M).Take(abaixo).ToList();
        foreach (var r in mortos) Ocupacao.Abdicar(t.M, r);
        Assert.Equal(t.M.P.IA.Minimo - 1, Ocupacao.Ativos(t.M).Count());
        var livresAntes = t.M.Mapa.Vagas.Where(v => !Ocupacao.Ativos(t.M).Any(r => r.Vaga == v.Indice)).ToList();
        var maisLonge = livresAntes.Max(v => t.M.G.Distancia(v.Castelo, jHex));
        Assert.Equal(1, Ocupacao.Completar(t.M));
        Assert.All(mortos, r => Assert.False(r.Ativo));   // os destruídos não voltam
        var novo = Ocupacao.DeIA(t.M).OrderByDescending(r => r.CriadoEm).ThenByDescending(r => r.Id).First(r => !mortos.Contains(r) && r.CriadoEm == t.M.Agora && r.Vaga >= 0 && livresAntes.Any(v => v.Indice == r.Vaga));
        Assert.Equal(maisLonge, t.M.G.Distancia(t.M.Locais[novo.CasteloId].Hex, jHex));
    }

    [Fact]
    public void IA_que_perde_o_ultimo_local_abdica_em_vez_de_ir_para_o_exilio()
    {
        var t = MundoIA.Novo();
        var ia = Ocupacao.DeIA(t.M).First();
        var j = Jogador(t, 0);
        foreach (var l in t.M.LocaisDe(ia.Id).Where(l => l.Id != ia.CasteloId).ToList()) t.M.MudarDono(l, 0);
        var castelo = t.M.Locais[ia.CasteloId];
        Quedas.CairCastelo(t.M, ia, new Exercito { ReinoId = j.Id }, castelo);
        Assert.False(ia.Ativo);
        Assert.Empty(t.M.LocaisDe(ia.Id));
        Assert.True(Ocupacao.Ativos(t.M).Count() >= t.M.P.IA.Minimo);
    }

    [Fact]
    public void Ids_de_reinos_saem_sorteados_e_nao_revelam_quem_entrou_com_a_temporada()
    {
        var t = MundoIA.Novo();
        var ia = Ocupacao.DeIA(t.M).Select(r => r.Id).ToList();
        var jogadores = Enumerable.Range(0, 5).Select(i => Jogador(t, i).Id).ToList();
        // algum jogador que entrou depois tem id menor que algum reino de IA da leva inicial
        Assert.Contains(jogadores, j => ia.Any(i => i > j));
        // e os locais iniciais também
        var castelosIA = Ocupacao.DeIA(t.M).Select(r => r.CasteloId).ToList();
        var castelosJ = jogadores.Select(id => t.M.Reinos[id].CasteloId).ToList();
        Assert.Contains(castelosJ, c => castelosIA.Any(i => i > c));
    }

    // ---------------------------------------------------------------- mesmas regras

    private static Recursos Tudo(MundoTeste t, Reino r)
    {
        var tot = Economia.TotalGuardado(t.M, r);
        foreach (var c in t.M.Marchas.OfType<Carregadores>().Where(c => c.ReinoId == r.Id)) tot.Somar(c.Carga);
        foreach (var f in r.Filas.Values) foreach (var i in f.Itens) tot.Somar(i.Entregue);
        return tot;
    }

    [Fact]
    public void Sessao_sem_recursos_nao_faz_obra_nem_recruta()
    {
        var t = MundoIA.Novo(criar: false);
        var ia = MundoIA.Criar(t, "expansionista");
        foreach (var l in t.M.LocaisDe(ia.Id)) { l.Estoque = new(); t.M.Sujar(l); }
        Governo.Sessao(t.M, ia, MundoIA.Conduta(t, ia));
        Assert.All(ia.Filas.Values, f => Assert.DoesNotContain(f.Itens, i => i.Custo.Total > 0));
        // sem recursos, a IA não gasta: só explora e coleta (coletar madeira e pedra não custa nada)
        Assert.DoesNotContain(t.M.Marchas, x => x.ReinoId == ia.Id && x is not Explorador && !(x is Exercito e && e.Ordem == ReinoDePedra.Jogo.Valiosos.Coletas.OrdemColetarId));
    }

    [Fact]
    public void Sessao_paga_tudo_o_que_poe_na_fila_com_o_proprio_estoque()
    {
        var t = MundoIA.Novo(criar: false);
        var ia = MundoIA.Criar(t, "saqueador", "ativo");
        Economia.Atualizar(t.M, ia);
        var antes = Tudo(t, ia);
        var popAntes = ia.Pop;
        Governo.Sessao(t.M, ia, MundoIA.Conduta(t, ia));
        var depois = Tudo(t, ia);
        var gasto = new Recursos();
        var aguarda = new Recursos();
        foreach (var f in ia.Filas.Values)
            foreach (var i in f.Itens)
                (i.Aguardando ? aguarda : gasto).Somar(i.Custo);
        Assert.True(gasto.Total > 0, "a sessão devia ter enfileirado algo");
        // o que saiu do estoque é exatamente o que as filas reservaram (nada criado, nada sumido)
        foreach (var k in antes.Keys.Union(gasto.Keys))
            Assert.Equal(antes.Qtd(k), depois.Qtd(k) + gasto.Qtd(k) - FilasEntregue(ia, k), 3);
        // e o que aguarda a vez cabe no que ficou: a IA não pede o que não pode pagar
        foreach (var (k, v) in aguarda) Assert.True(depois.Qtd(k) + 1e-6 >= v, k);
        Assert.True(ia.Pop < popAntes);   // quem foi recrutado saiu da população civil
    }

    private static double FilasEntregue(Reino r, string k) => r.Filas.Values.Sum(f => f.Itens.Sum(i => i.Entregue.Qtd(k)));

    // ---------------------------------------------------------------- crescimento (metas do modelo)

    [Fact]
    public void IA_media_cresce_no_ritmo_da_simulacao_e_a_ativa_tem_mais_tropas()
    {
        // metas do modelo no ritmo 3× (balanceamento/tabelas.md, jogador médio): dia 3 = nível 7, castelo 8, 7 tropas;
        // dia 7 = 5 locais, nível 9, castelo 9, 10 tropas. O ativo tem 20 tropas no dia 7.
        var t = MundoIA.Novo(criar: false);
        var medios = new[] { "expansionista", "defensivo", "saqueador", "comerciante" }.Select(p => MundoIA.Criar(t, p)).ToList();
        var ativo = MundoIA.Criar(t, "defensivo", "ativo");
        var fraco = MundoIA.Criar(t, "defensivo", "fraco");
        (double nivel, int castelo, int tropas, int locais) Foto(Reino r)
        {
            Economia.Atualizar(t.M, r);
            var prod = t.M.LocaisDe(r.Id).Where(l => l.EhProducao && !l.Ruina).ToList();
            return (prod.Average(l => l.Nivel), t.M.Locais[r.CasteloId].Nivel, Economia.Tropas(t.M, r), prod.Count);
        }
        for (var d = 1; d <= 7; d++)
        {
            t.AvancarHoras(24);
            AjustesTeste.FalharSeErro();
            foreach (var r in medios.Append(ativo).Append(fraco))
            {
                var f = Foto(r);
                saida.WriteLine($"dia {d} {r.PerfilIA}/{r.HabilidadeIA}: locais {f.locais} nível {f.nivel:0.0} castelo {f.castelo} tropas {f.tropas}");
            }
            if (d == 3)
                foreach (var r in medios)
                {
                    var f = Foto(r);
                    Assert.InRange(f.nivel, 5, 8.5); Assert.InRange(f.castelo, 6, 9); Assert.InRange(f.tropas, 3, 12);
                }
        }
        foreach (var r in medios)
        {
            var f = Foto(r);
            Assert.InRange(f.nivel, 6.5, 10); Assert.InRange(f.castelo, 7, 10); Assert.InRange(f.tropas, 4, 18); Assert.InRange(f.locais, 4, 7);
        }
        Assert.True(Foto(ativo).tropas > medios.Max(r => Foto(r).tropas), "o ativo devia ter mais tropas que os médios");
        Assert.True(Foto(fraco).tropas < medios.Min(r => Foto(r).tropas), "o fraco devia ter menos tropas que os médios");
    }
}
