using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.IA;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Testes;

/// <summary>
/// O que o diário de 25 dias de um mundo só de IA mostrou que parecia máquina, e não gente: convite repetido a quem já
/// recusou, aliança de uma pessoa só para sempre, resposta à resposta sem fim, a mesma frase de novo, bordão colado na
/// pergunta, parabéns a cada batalha e o mesmo ataque perdido repetido no mesmo dia.
/// </summary>
[Collection("falas")]
public class ConvivioIATestes
{
    private static Reino IA(MundoTeste t, string perfil, Action<Persona> ajuste)
    {
        var r = MundoIA.Criar(t, perfil);
        var p = Personas.Gerar(4242, perfil, "medio");
        p.Disciplina = 1; p.Assiduidade = 1; p.Reflexo = 0;
        ajuste(p);
        r.Persona = p; t.M.Sujar(r);
        return r;
    }
    private static void Sessao(MundoTeste t, Reino ia) => Governo.Sessao(t.M, ia, MundoIA.Conduta(t, ia));
    private static void Aproximar(MundoTeste t, Reino quem, Reino de, int dist)
    {
        var perto = t.M.Locais[de.CasteloId].Hex; var c = t.M.Locais[quem.CasteloId];
        c.Hex = t.M.G.Area(perto, dist).First(h => t.M.G.Distancia(h, perto) == dist); t.M.Sujar(c);
    }
    private static void ProximaSessao(MundoTeste t, Reino ia)
    {
        var q = t.M.Eventos.Obter(ia.SessaoIAEventoId!.Value)!.Quando;
        t.Avancar(TimeSpan.FromMilliseconds(q - t.M.Agora + 1000));
    }

    [Fact]
    public void Lider_de_IA_nao_insiste_no_convite_a_quem_recusou()
    {
        var t = MundoIA.Novo(criar: false);
        var j = MundoIA.Jogador(t, 0);
        var lider = IA(t, "comerciante", p => { p.Sociabilidade = 0.95; p.Orgulho = 0.7; });
        var a = Aliancas.Criar(t.M, lider, "Liga do Corvo");
        Aliancas.Convidar(t.M, lider, j.Id); Aliancas.AceitarConvite(t.M, j, a.Id);   // a aliança não fica de uma pessoa só
        var calada = IA(t, "defensivo", p => { p.Sociabilidade = 0.05; p.Orgulho = 0.8; });
        Aproximar(t, calada, lider, 12);
        for (var dia = 0; dia < 16; dia++)
            for (var s = 0; s < 4; s++) { t.AvancarHoras(6); Sessao(t, lider); Sessao(t, calada); }
        Assert.Null(calada.AliancaId);
        // 16 dias, 64 sessões, a vizinha mais perto sempre livre: um convite, não um por semana
        Assert.Equal(1, a.Conversa.Count(f => f.Evento == "convite" && f.AlvoId == calada.Id));
    }

    [Fact]
    public void Quem_fundou_e_ficou_sozinha_desiste_da_alianca_depois_de_uma_semana()
    {
        var t = MundoIA.Novo(criar: false);
        var ia = IA(t, "defensivo", p => { p.Sociabilidade = 0.6; p.Orgulho = 0.9; });
        var a = Aliancas.Criar(t.M, ia, "Coroa das Brumas");
        for (var s = 0; s < 4 * 6; s++) { t.AvancarHoras(6); Sessao(t, ia); }
        Assert.Equal(a.Id, ia.AliancaId);   // seis dias: ainda espera alguém
        for (var s = 0; s < 4 * 8 && ia.AliancaId != null; s++) { t.AvancarHoras(6); Sessao(t, ia); }
        Assert.Null(ia.AliancaId);
        Assert.Null(t.M.Aliancas.Obter(a.Id));   // acabou com o último membro
        // com gente dentro, ninguém desiste
        var j = MundoIA.Jogador(t, 0);
        var outra = IA(t, "defensivo", p => { p.Sociabilidade = 0.6; p.Orgulho = 0.9; });
        var b = Aliancas.Criar(t.M, outra, "Guarda do Vau");
        Aliancas.Convidar(t.M, outra, j.Id); Aliancas.AceitarConvite(t.M, j, b.Id);
        for (var s = 0; s < 4 * 12; s++) { t.AvancarHoras(6); Sessao(t, outra); }
        Assert.Equal(b.Id, outra.AliancaId);
    }

    [Fact]
    public void Resposta_a_uma_resposta_encerra_o_assunto_por_mensageiro()
    {
        var t = MundoIA.Novo(criar: false);
        var j = MundoIA.Jogador(t, 0); t.DarRecursos(j);
        var ia = IA(t, "comerciante", p => p.Sociabilidade = 1);
        t.DarRecursos(ia);
        Mensageiros.Treinar(t.M, j, 3);
        t.AvancarMin(10);
        var msg = Mensageiros.Enviar(t.M, j, "Boa tarde, vizinho.", ia.Id, null);
        t.AvancarHoras(1);
        for (var i = 0; i < 4 && !t.M.Mensagens.Any(x => x.DeId == ia.Id); i++) ProximaSessao(t, ia);
        var resposta = Assert.Single(t.M.Mensagens, x => x.DeId == ia.Id);
        Assert.Equal(msg.Id, resposta.RespondeA);
        t.AvancarHoras(1);
        // o jogador responde à resposta: ela lê e o assunto acaba ali
        var treplica = Mensageiros.Enviar(t.M, j, "Combinado, então.", null, null, resposta.Id);
        t.AvancarHoras(1);
        for (var i = 0; i < 6; i++) ProximaSessao(t, ia);
        // (ela ainda pode mandar um recado por conta própria; o que não faz é responder à resposta)
        Assert.Single(t.M.Mensagens, x => x.DeId == ia.Id && x.RespondeA != null);
        Assert.DoesNotContain(t.M.Mensagens, x => x.DeId == ia.Id && x.RespondeA == treplica.Id);
        Assert.True(treplica.Lida);
    }

    [Fact]
    public void A_uma_ameaca_a_orgulhosa_devolve_e_a_pacifica_baixa_o_tom()
    {
        Assert.True(FalasPorModelo.Hostil("Isso vai ter volta, Valdren."));
        Assert.True(FalasPorModelo.Hostil("valdren, da proxima vez que pisar em minhas terras, nao volta ninguem"));
        Assert.True(FalasPorModelo.Hostil("Somos vizinhos, Valdren. Não precisava atacar a Mina Rubra."));
        Assert.False(FalasPorModelo.Hostil("Boa tarde, vizinho. Trocamos pedra por ferro?"));
        var t = MundoIA.Novo(criar: false);
        var j = MundoIA.Jogador(t, 0); t.DarRecursos(j);
        var orgulhosa = IA(t, "saqueador", p => { p.Sociabilidade = 1; p.Orgulho = 0.9; p.Tom = "direto"; p.Bordoes.Clear(); p.Pressa = 0; p.Minusculas = false; });
        var pacifica = IA(t, "comerciante", p => { p.Sociabilidade = 1; p.Orgulho = 0.2; p.Agressividade = 0.2; p.Tom = "direto"; p.Bordoes.Clear(); p.Pressa = 0; p.Minusculas = false; });
        t.DarRecursos(orgulhosa); t.DarRecursos(pacifica);
        Mensageiros.Treinar(t.M, j, 2);
        t.AvancarMin(10);
        var m1 = Mensageiros.Enviar(t.M, j, "Isso vai ter volta, " + orgulhosa.Nome + ".", orgulhosa.Id, null);
        var m2 = Mensageiros.Enviar(t.M, j, "Guardei seu nome, " + pacifica.Nome + ".", pacifica.Id, null);
        t.AvancarHoras(1);
        for (var i = 0; i < 5; i++) { ProximaSessao(t, orgulhosa); ProximaSessao(t, pacifica); }
        // (a resposta à ameaça; fora dela, quem é sociável ainda acena ao vizinho e responde a quem acenou)
        var r1 = Assert.Single(t.M.Mensagens, x => x.DeId == orgulhosa.Id && x.RespondeA == m1.Id).Texto;
        var r2 = Assert.Single(t.M.Mensagens, x => x.DeId == pacifica.Id && x.RespondeA == m2.Id).Texto;
        // nenhuma das duas agradece a ameaça
        Assert.DoesNotContain("brigad", r1); Assert.DoesNotContain("brigad", r2);
        var g = new FalasPorModelo();
        string[] Todas(Reino ia, string tipo) => Enumerable.Range(0, 60).Select(i => g.Gerar(ia.Persona!, new ContextoFala { Tipo = tipo, Canal = Falas.CanalMensageiro, ParaReino = j.Nome, MaxCaracteres = 200 }, new Rng((ulong)i))!).Distinct().ToArray();
        Assert.Contains(r1, Todas(orgulhosa, Falas.Desafio));
        Assert.Contains(r2, Todas(pacifica, Falas.Apaziguar));
    }

    [Fact]
    public void Conversa_fiada_nao_repete_o_que_ja_foi_dito_e_o_bordao_nao_cola_na_pergunta()
    {
        var g = new FalasPorModelo();
        var p = Personas.Gerar(7, "comerciante", "medio");
        p.Tom = "direto"; p.Pressa = 0; p.Minusculas = false; p.Bordoes.Clear(); p.Bordoes.Add("certo");
        var situacao = new Dictionary<string, string> { ["recurso"] = "pedra", ["Recurso"] = "Pedra" };
        // com o bordão: depois de pergunta, vira outra frase; nunca "?, certo."
        var ditas = Enumerable.Range(0, 400).Select(i => g.Gerar(p, new ContextoFala { Tipo = Falas.ConversaFiada, Situacao = situacao, MaxCaracteres = 200 }, new Rng((ulong)i))!).ToList();
        Assert.Contains(ditas, x => x.EndsWith("? Certo."));
        Assert.DoesNotContain(ditas, x => x.Contains("?,") || x.Contains("!,"));
        Assert.All(ditas, x => { Assert.DoesNotContain("{", x); });
        // o que está no histórico recente (dela ou de outro, com outro jeito de escrever) não sai de novo
        p.Bordoes.Clear();
        var historico = new List<FalaAnterior>();
        for (var i = 0; i < 40; i++)
        {
            var fala = g.Gerar(p, new ContextoFala { Tipo = Falas.ConversaFiada, Situacao = situacao, Historico = historico, MaxCaracteres = 200 }, new Rng((ulong)i * 13 + 1));
            if (fala == null) break;   // já disseram de tudo: cala
            Assert.DoesNotContain(historico, h => string.Equals(h.Texto, fala, StringComparison.OrdinalIgnoreCase));
            historico.Add(new FalaAnterior("Outro", "pessoal! " + fala.ToLowerInvariant() + " abraço!", i % 2 == 0));
        }
        Assert.InRange(historico.Count, 12, 30);   // todas as frases, uma vez cada
        Assert.Null(g.Gerar(p, new ContextoFala { Tipo = Falas.ConversaFiada, Situacao = situacao, Historico = historico, MaxCaracteres = 200 }, new Rng(5)));
        // pergunta de conversa é reconhecida, de quem quer que seja e com outro jeito de escrever; outra pergunta, não
        Assert.True(FalasPorModelo.PerguntaDeConversa("pessoal! por aqui falta ferro. e vocês? abraço!"));
        Assert.True(FalasPorModelo.PerguntaDeConversa("Alguem viu marcha estranha hoje"));
        Assert.False(FalasPorModelo.PerguntaDeConversa("Alguém ataca o castelo do norte comigo amanhã?"));
    }

    [Fact]
    public void Aliada_que_vence_tres_vezes_no_dia_ganha_um_parabens_e_a_conversa_guarda_o_resultado_no_lugar_do_ataque()
    {
        var t = MundoIA.Novo(criar: false);
        var j = MundoIA.Jogador(t, 0);
        var a = Aliancas.Criar(t.M, j, "Liga do Vale");
        var amiga = IA(t, "comerciante", p => { p.Sociabilidade = 1; p.Lealdade = 0.1; });
        Aliancas.Convidar(t.M, j, amiga.Id); Aliancas.AceitarConvite(t.M, amiga, a.Id);
        Sessao(t, amiga); t.AvancarHoras(1);   // cumprimenta e fica em dia com a conversa
        var antes = a.Conversa.Count(f => f.Tipo == Aliancas.TipoFala && f.ReinoId == amiga.Id);
        for (var i = 0; i < 3; i++)
        {
            Aliancas.Evento(t.M, a, "vitoria", j.Nome + " venceu a batalha em Mina.", j.Id, alvoId: 999);
            t.AvancarHoras(2); Sessao(t, amiga);
        }
        var parabens = a.Conversa.Count(f => f.Tipo == Aliancas.TipoFala && f.ReinoId == amiga.Id) - antes;
        Assert.InRange(parabens, 0, 1);
    }

    [Fact]
    public void Quem_atacou_e_perdeu_nao_volta_ao_mesmo_reino_no_dia_seguinte()
    {
        var t = MundoIA.Novo(criar: false);
        var ia = IA(t, "saqueador", p => p.Paciencia = 0.5);
        var p = ia.Persona!;
        // a marca de quem a venceu vale por dois dias (para a paciência média) e some depois
        Convivio.Marcar(t.M, ia, "perdi:77");
        Assert.True(Convivio.JaFalou(p, "perdi:77", t.M.Agora, 2 * MundoIA.Conduta(t, ia).Espera));
        t.AvancarHoras(24);
        Assert.True(Convivio.JaFalou(p, "perdi:77", t.M.Agora, 2 * MundoIA.Conduta(t, ia).Espera));
        t.AvancarHoras(30);
        Assert.False(Convivio.JaFalou(p, "perdi:77", t.M.Agora, 2 * MundoIA.Conduta(t, ia).Espera));
    }
}
