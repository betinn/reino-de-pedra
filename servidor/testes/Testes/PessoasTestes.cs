using System.Text.Json.Nodes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Pessoas;
using ReinoDePedra.Jogo.Reinos;
using static ReinoDePedra.Testes.CombateCenario;

namespace ReinoDePedra.Testes;

/// <summary>Pessoas civis (plano de pessoas no mapa, fase 2): nome, ofício, vagas, atribuição, carregadores, milícia e recrutamento.</summary>
public class PessoasTestes
{
    private static Dictionary<string, int> G(params (string k, int n)[] x) => x.ToDictionary(p => p.k, p => p.n);
    private static Local LocalDe(MundoTeste t, Reino r, TipoLocal tipo, string? produz = null) =>
        t.M.LocaisDe(r.Id).First(l => l.Tipo == tipo && (produz == null || l.Produz == produz));

    [Fact]
    public void Reino_novo_tem_pessoas_com_nome_e_oficio_nas_vagas()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var pessoas = t.M.PessoasDe(r.Id).ToList();
        Assert.Equal(t.B.P.PopInicial, pessoas.Count);
        Assert.Equal(pessoas.Count, r.Pop);
        Assert.Equal(pessoas.Count, pessoas.Select(p => p.Nome).Distinct().Count());
        Assert.All(pessoas, p => Assert.True(p.EhCivil && p.Presente));
        // uma vaga por local de produção no nível 1: 4 trabalhando, o resto sem trabalho no castelo
        foreach (var l in t.M.LocaisDe(r.Id).Where(l => l.EhProducao))
        {
            Assert.Equal(1, Pessoas.Vagas(t.M, l));
            Assert.Equal(1, Pessoas.Trabalhando(t.M, l));
            Assert.Equal(Oficios.DoLocal(l), Pessoas.Presentes(t.M, l).Single().Oficio);
        }
        var castelo = t.M.Locais[r.CasteloId];
        Assert.Equal(t.B.P.PopInicial - 4, Pessoas.Presentes(t.M, castelo).Count(p => p.Oficio == Oficios.Ocioso));
        Assert.Equal(1.0, Economia.Eficiencia(t.M, r));
        Assert.Contains(pessoas, p => Oficios.Nome(p) is "Lenhador" or "Lenhadora");
    }

    [Fact]
    public void Populacao_cresce_uma_pessoa_de_cada_vez_e_a_pessoa_nova_vai_para_a_vaga()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var serraria = LocalDe(t, r, TipoLocal.Serraria);
        // abre uma vaga: a lenhadora deixa de existir (morreu); a próxima pessoa que nasce vai para lá
        Pessoas.Remover(t.M, Pessoas.Presentes(t.M, serraria).Single());
        Pessoas.PreencherVagas(t.M, r);   // um ocioso do castelo já sai andando para a vaga
        Assert.Single(t.M.Marchas.OfType<Deslocamento>());
        var antes = r.Pop;
        for (var h = 0; h < 48 && r.Pop <= antes; h++) t.AvancarHoras(1);
        Assert.True(r.Pop > antes, "ninguém nasceu em 48 h");
        Assert.Equal(r.Pop, t.M.PessoasDe(r.Id).Count(p => p.EhCivil));
        Assert.Equal(Math.Floor(r.Pop), r.Pop);
        Assert.InRange(r.PopFracao, 0, 1);
        t.AvancarHoras(1);
        Assert.Equal(1, Pessoas.Trabalhando(t.M, serraria));
        Assert.Empty(t.M.Marchas.OfType<Deslocamento>());
    }

    [Fact]
    public void Vaga_vazia_produz_menos_e_a_eficiencia_e_por_local()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var serraria = LocalDe(t, r, TipoLocal.Serraria);
        var cheia = Economia.TaxaLocal(t.M, r, serraria).Qtd("madeira");
        Assert.Equal(t.M.F.Producao(1), cheia, 6);
        Pessoas.Remover(t.M, Pessoas.Presentes(t.M, serraria).Single());
        Assert.Equal(0, Economia.TaxaLocal(t.M, r, serraria).Qtd("madeira"), 6);
        Assert.Equal(0, Economia.EficienciaLocal(t.M, serraria));
        Assert.Equal(1, Economia.EficienciaLocal(t.M, LocalDe(t, r, TipoLocal.Vila)));
        Assert.Equal(0.75, Economia.Eficiencia(t.M, r), 6);
    }

    [Fact]
    public void Trocar_trabalho_caminha_ate_o_local_e_respeita_as_vagas()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var castelo = t.M.Locais[r.CasteloId];
        var serraria = LocalDe(t, r, TipoLocal.Serraria);
        var ocioso = Pessoas.Presentes(t.M, castelo).First(p => p.Oficio == Oficios.Ocioso);
        // a serraria já tem a sua única vaga tomada
        Assert.Contains("vaga", Assert.Throws<RegraException>(() => Pessoas.Trabalhar(t.M, r, ocioso.Id, serraria.Id)).Message);
        // a lenhadora vai para o castelo sem trabalho (vaga livre), e o ocioso vai para a serraria andando
        var lenhador = Pessoas.Presentes(t.M, serraria).Single();
        Pessoas.Mover(t.M, r, lenhador.Id, castelo.Id);
        Assert.Equal(Estados.Andando, lenhador.Estado);
        Assert.Equal(1, Pessoas.VagasLivres(t.M, serraria));
        Pessoas.Trabalhar(t.M, r, ocioso.Id, serraria.Id);
        Assert.Equal(Estados.Andando, ocioso.Estado);
        Assert.Equal(Oficios.Lenhador, ocioso.Oficio);
        Assert.Equal(serraria.Id, ocioso.LocalId);
        Assert.Equal(0, Pessoas.VagasLivres(t.M, serraria));   // a vaga é dele enquanto anda
        var mc = t.M.Marchas.OfType<Deslocamento>().Single(d => d.PessoaIds.Contains(ocioso.Id));
        Assert.True(mc.Chegada > t.M.Agora);
        Assert.Equal(0, Pessoas.Trabalhando(t.M, serraria));
        t.AvancarHoras(1);
        Assert.Equal(Estados.Trabalhando, ocioso.Estado);
        Assert.Null(ocioso.GrupoId);
        Assert.Equal(1, Pessoas.Trabalhando(t.M, serraria));
        Assert.Equal(Estados.Ociosa, lenhador.Estado);
        Assert.Equal(castelo.Id, lenhador.LocalId);
        // local de outro reino ou ofício inexistente: recusa
        Assert.Throws<RegraException>(() => Pessoas.Trabalhar(t.M, r, ocioso.Id, castelo.Id, Oficios.Lenhador));
        var outro = t.NovoReino();
        Assert.Throws<RegraException>(() => Pessoas.Trabalhar(t.M, r, ocioso.Id, outro.CasteloId));
        Assert.Throws<RegraException>(() => Pessoas.Trabalhar(t.M, outro, ocioso.Id, outro.CasteloId));
    }

    [Fact]
    public void Carregadores_sao_pessoas_do_local_de_origem_que_fazem_viagens_e_voltam()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var castelo = t.M.Locais[r.CasteloId];
        var vila = LocalDe(t, r, TipoLocal.Vila);
        t.DarRecursos(r, 1000);
        castelo.Nivel = 2;
        var item = Obras.Melhorar(t.M, r, vila.Id);   // o material sai do castelo
        var mc = t.M.Marchas.OfType<Carregadores>().Single();
        Assert.NotEmpty(mc.PessoaIds);
        Assert.Equal(mc.PessoaIds.Count, mc.Pessoas);
        var gente = mc.PessoaIds.Select(id => t.M.Pessoas[id]).ToList();
        Assert.All(gente, p => { Assert.Equal(Estados.Carregando, p.Estado); Assert.Equal(castelo.Id, p.LocalId); Assert.Equal(mc.Id, p.GrupoId); });
        Assert.True(mc.Carga.Total <= mc.CargaMax(t.M) + 1e-9);
        // quem carrega não conta como milícia nem pode ser recrutado
        Assert.Equal(r.Pop - gente.Count, Pessoas.Livres(t.M, r.Id).Count());
        var viagens = mc.Pendente.Total > 0;
        for (var i = 0; i < 20 && t.M.Marchas.ContemId(mc.Id); i++) t.AvancarMin(30);
        Assert.False(t.M.Marchas.ContemId(mc.Id));
        Assert.True(item.MaterialCompleto, "material não chegou inteiro");
        Assert.All(gente, p => { Assert.True(p.Presente, p.Estado); Assert.Null(p.GrupoId); });
        Assert.Equal(r.Pop, Pessoas.Livres(t.M, r.Id).Count());
        if (viagens) Assert.Equal(0, mc.Pendente.Total, 6);
    }

    [Fact]
    public void Carregadores_fazem_mais_viagens_quando_a_carga_nao_cabe()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var castelo = t.M.Locais[r.CasteloId];
        var carga = new Recursos();
        carga.Somar("madeira", t.B.P.Carregador.Carga * (Pessoas.Presentes(t.M, castelo).Count() + 2));   // mais do que todos do castelo levam
        castelo.Estoque.Somar(carga);
        var vila = LocalDe(t, r, TipoLocal.Vila);
        var presentes = Pessoas.Presentes(t.M, castelo).Count();
        var mc = Logistica.Enviar(t.M, r, castelo.Hex, vila.Hex, carga, null, Obras.Fila, vila.Id);
        Assert.Equal(presentes, mc.Pessoas);
        Assert.Equal(presentes, mc.PessoaIds.Count);
        Assert.True(mc.Pendente.Total > 0);
        Assert.Equal(carga.Total, mc.Carga.Total + mc.Pendente.Total, 6);
        for (var i = 0; i < 30 && t.M.Marchas.ContemId(mc.Id); i++) t.AvancarMin(30);
        Assert.False(t.M.Marchas.ContemId(mc.Id));
        Assert.Equal(carga.Qtd("madeira"), vila.Estoque.Qtd("madeira"), 3);
    }

    [Fact]
    public void Sem_ninguem_livre_na_origem_a_carga_vai_com_carregadores_anonimos()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var serraria = LocalDe(t, r, TipoLocal.Serraria);
        Pessoas.Remover(t.M, Pessoas.Presentes(t.M, serraria).Single());
        serraria.Estoque.Somar("madeira", 50);
        var vila = LocalDe(t, r, TipoLocal.Vila);
        var mc = Logistica.Enviar(t.M, r, serraria.Hex, vila.Hex, Recursos.De(new Dictionary<string, double> { ["madeira"] = 50 }), null, Obras.Fila, vila.Id);
        Assert.Empty(mc.PessoaIds);
        Assert.Equal(2, mc.Pessoas);
        t.AvancarHoras(2);
        Assert.False(t.M.Marchas.ContemId(mc.Id));
        Assert.Equal(50, vila.Estoque.Qtd("madeira"), 3);
    }

    [Fact]
    public void Milicia_sao_os_civis_presentes_e_o_massacre_mata_pessoas_com_nome()
    {
        var s = new CombateCenario();
        var alvo = s.Alvo(TipoLocal.Mina, G(), 12);
        Assert.Equal(12, Pessoas.Presentes(s.M, alvo).Count());
        Assert.Equal(12, Jogo.Combate.Combates.PopDoLocal(s.M, s.Def, alvo));
        var nomes = Pessoas.Presentes(s.M, alvo).Select(p => p.Nome).ToHashSet();
        var ex = s.Atacar(alvo, G(("cavalaria", 12)), Plano("massacre", "media", new JsonArray(Obj("populacao", q: 3))));
        var b = s.Chegar(ex);
        s.Terminar(b);
        Assert.Equal("vitoria", b.Resultado);
        var mortos = (int)b.MiliciaMorta + 3;
        Assert.Equal(12 - mortos, s.Def.Pop, 6);
        Assert.Equal(12 - mortos, Pessoas.Presentes(s.M, alvo).Count());
        Assert.Equal((int)b.MiliciaMorta, b.CivisMortos.Count);
        Assert.All(b.CivisMortos, n => Assert.Contains(n, nomes));
        var defesa = s.M.Relatorios.Single(x => x.ReinoId == s.Def.Id && x.Tipo == "defesa");
        var danos = defesa.Dados["danos"]!.AsArray().Select(x => x!.GetValue<string>()).ToList();
        var massacre = Assert.Single(danos, d => d.StartsWith("3 mortos no massacre"));
        Assert.Contains("(", massacre);   // com os nomes
        var perdas = defesa.Dados["linhas"]!.AsArray().Select(x => x!["valor"]!.GetValue<string>()).Single(v => v.Contains("da milícia") || v.Contains("nenhuma tropa"));
        if (b.CivisMortos.Count > 0) Assert.Contains(b.CivisMortos[0], perdas);
    }

    [Fact]
    public void Recrutar_converte_um_ocioso_primeiro_e_cancelar_devolve()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        t.DarRecursos(r);
        var antes = r.Pop;
        var item = Recrutamento.Recrutar(t.M, r, r.CasteloId, "milicia", 1);
        Assert.Equal(antes - 1, r.Pop);
        var p = Pessoas.EmTreino(t.M, r, item).Single();
        Assert.Equal(Oficios.Ocioso, p.OficioAnterior);
        Assert.Equal("milicia", p.Oficio);
        Assert.Equal(Estados.Treinando, p.Estado);
        Assert.False(p.EhCivil);
        Assert.Equal(r.CasteloId, p.LocalId);
        Assert.True(Oficios.Nome(p) is "Miliciano" or "Miliciana");
        Assert.Equal(1, Economia.Tropas(t.M, r));   // em treino ocupa o teto
        Filas.Cancelar(t.M, r, Recrutamento.Fila, item.Id);
        Assert.Equal(antes, r.Pop);
        Assert.True(p.EhCivil && p.Presente);
        // só com trabalhadores: leva um deles, e a vaga fica vazia
        foreach (var o in Pessoas.Presentes(t.M, t.M.Locais[r.CasteloId]).Where(x => x.Oficio == Oficios.Ocioso).ToList()) Pessoas.Remover(t.M, o);
        var item2 = Recrutamento.Recrutar(t.M, r, r.CasteloId, "milicia", 1);
        var q = Pessoas.EmTreino(t.M, r, item2).Single();
        Assert.NotEqual(Oficios.Ocioso, q.OficioAnterior);
        Assert.Equal(3, Economia.Trabalhando(t.M, r));
        t.Avancar(TimeSpan.FromSeconds(t.B.U["milicia"].Tempo + 1));
        Assert.Equal(1, t.M.Locais[r.CasteloId].Guarnicao.GetValueOrDefault("milicia"));
        Assert.False(t.M.Pessoas.ContemId(q.Id));   // virou tropa (pessoa com id na fase seguinte)
        Assert.Equal(3, r.Pop);
    }

    [Fact]
    public void Nomes_nao_repetem_entre_as_pessoas_vivas_do_reino()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        Pessoas.Nascer(t.M, r, 120, andar: false);
        var nomes = t.M.PessoasDe(r.Id).Select(p => p.Nome).ToList();
        Assert.Equal(nomes.Count, nomes.Distinct().Count());
        Assert.Contains(nomes, n => n.EndsWith(" II"));
        Assert.Equal(128, r.Pop);
        // determinístico: outro mundo com a mesma semente sorteia os mesmos nomes
        var t2 = new MundoTeste();
        var r2 = t2.NovoReino();
        Assert.Equal(t.M.PessoasDe(r.Id).OrderBy(p => p.Id).Take(8).Select(p => p.Nome), t2.M.PessoasDe(r2.Id).OrderBy(p => p.Id).Select(p => p.Nome));
    }

    [Fact]
    public void Local_ocupado_ou_destruido_manda_os_trabalhadores_para_casa()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var serraria = LocalDe(t, r, TipoLocal.Serraria);
        var lenhador = Pessoas.Presentes(t.M, serraria).Single();
        var outro = t.NovoReino();
        Jogo.Combate.Efeitos.Ocupar(t.M, serraria, outro);
        Assert.Equal(Estados.Andando, lenhador.Estado);
        Assert.Equal(Oficios.Ocioso, lenhador.Oficio);
        Assert.Equal(r.CasteloId, lenhador.LocalId);
        Assert.Equal(r.Id, lenhador.ReinoId);
        t.AvancarHoras(2);
        Assert.Equal(Estados.Ociosa, lenhador.Estado);
        Assert.Equal(r.CasteloId, lenhador.LocalId);
        Assert.Equal(t.B.P.PopInicial, r.Pop);
    }

    [Fact]
    public void Melhorar_um_local_abre_vaga_e_um_ocioso_vem_trabalhar()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var vila = LocalDe(t, r, TipoLocal.Vila);
        var nivel = 1;
        while (t.M.F.Vagas(nivel) < 2) nivel++;
        var castelo = t.M.Locais[r.CasteloId];
        castelo.Nivel = nivel; vila.Nivel = nivel - 1;
        t.DarRecursos(r, 1e5);
        var item = Obras.Melhorar(t.M, r, vila.Id);
        for (var i = 0; i < 48 && r.Fila(Obras.Fila).Itens.Count > 0; i++) t.AvancarHoras(1);
        Assert.Equal(nivel, vila.Nivel);
        Assert.Equal(2, Pessoas.Vagas(t.M, vila));
        t.AvancarHoras(1);
        Assert.Equal(2, Pessoas.Trabalhando(t.M, vila));
    }
}
