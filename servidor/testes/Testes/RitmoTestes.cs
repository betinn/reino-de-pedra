using System.Text.Json.Nodes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Persistencia;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Testes;

/// <summary>
/// Ritmo 3× (docs/decisoes/0038): o jogo anda como se estivesse acelerado em 3×, pelo balanceamento, sem REINO_ACELERACAO.
/// O que é ação anda 3× mais rápido; o que é a vida de quem joga continua em tempo real; a batalha não tem tempo fixo;
/// e um mundo salvo no ritmo antigo continua carregando.
/// </summary>
public class RitmoTestes
{
    private static Dictionary<string, int> G(params (string k, int n)[] x) => x.ToDictionary(p => p.k, p => p.n);
    private static Balanceamento B => Balanceamento.Padrao;

    [Fact]
    public void O_que_e_acao_anda_3_vezes_mais_rapido()
    {
        var p = B.P; var f = new Formulas(B);
        // produção e nascimentos × 3
        Assert.Equal(9, f.Producao(1), 6);            // eram 3 por hora
        Assert.Equal(7.5, f.ProducaoCastelo(1), 6);   // eram 2,5
        Assert.Equal(3, p.PopMinH); Assert.Equal(6, p.PopMaxH);   // eram 1 e 2
        // obras, treino e deslocamento ÷ 3
        Assert.Equal(40, f.TempoObra(2), 6);          // eram 2 min
        Assert.Equal(240, B.U["lanceiro"].Tempo);     // eram 12 min
        Assert.Equal(280, B.U["arqueiro"].Tempo);
        Assert.Equal(480, B.U["cavalaria"].Tempo);
        Assert.True(f.ViagemMin(6, "Lenta", false) <= 2.0 / 3);                 // local vizinho: era 1 min
        Assert.InRange(f.ViagemMin(p.VizinhoHex, "Lenta", false), 3, 7);          // reino vizinho: eram 12 min
        Assert.True(f.ViagemMin(p.Mapa.Cols, "Lenta", false) <= 30);             // travessia: eram 53 min
        Assert.Equal(4, p.Reliquia.EscavarHoras1);    // eram 12 h
        Assert.Equal(2.0 / 3, p.Feridos.CuraH, 6);    // eram 2 h
        // o mundo se refaz 3× mais depressa
        Assert.Equal(8, p.FaunaVoltaH); Assert.Equal(8, p.Coleta.RecuperaH); Assert.Equal(2, p.Vida.RecuperaH);
    }

    [Fact]
    public void O_que_e_a_vida_de_quem_joga_continua_em_tempo_real()
    {
        var p = B.P;
        Assert.Equal(70, p.TemporadaDias);
        Assert.Equal(72, p.EscudoNovatoH); Assert.Equal(24, p.EscudoExilioH);
        Assert.Equal(24, p.ResgateH); Assert.Equal(24, p.TreguaSaidaH); Assert.Equal(24, p.Feridos.EsperaH);
        Assert.Equal(24, p.Social.PropostaH); Assert.Equal(10, p.AvistamentoH);
        Assert.Equal(1, p.Pacto.DiasMin); Assert.Equal(7, p.Pacto.DiasMax);
        // cada local continua guardando 10 h da própria produção (a noite de quem joga): guarda 3× mais
        Assert.Equal(10, p.EstoqueHoras);
    }

    [Fact]
    public void Nivel_maximo_sobe_para_11_com_3_vagas()
    {
        var f = new Formulas(B);
        Assert.Equal(11, B.P.NivelMax);
        Assert.Equal(3, f.Vagas(9)); Assert.Equal(3, f.Vagas(10)); Assert.Equal(3, f.Vagas(11));
        Assert.InRange(f.TempoObra(11) / 3600, 2, 6);   // a última obra é de horas, não de dias
        var t = new MundoTeste();
        var r = t.NovoReino();
        var castelo = t.M.Locais[r.CasteloId];
        castelo.Nivel = 10; t.M.Sujar(castelo);
        t.DarRecursos(r, 1e7);
        Assert.Equal(11, Obras.Melhorar(t.M, r, castelo.Id).NivelAlvo);
        t.AvancarHoras(f.TempoNivel(11, true) / 3600 + 0.1);
        Assert.Equal(11, castelo.Nivel);
        Assert.Throws<RegraException>(() => Obras.Melhorar(t.M, r, castelo.Id));
    }

    [Fact]
    public void Batalha_desigual_acaba_em_segundos_e_a_parelha_dura_minutos()
    {
        // 50 contra 1: não pode demorar
        var s = new CombateCenario();
        var b = s.Chegar(s.Atacar(s.Alvo(TipoLocal.Mina, G(("lanceiro", 1)), 0), G(("lanceiro", 50))));
        var desigual = (b.Fim - b.Inicio) / 1000.0;
        Assert.InRange(desigual, 1, 30);
        // 20 contra 20: minutos
        var s2 = new CombateCenario();
        var b2 = s2.Chegar(s2.Atacar(s2.Alvo(TipoLocal.Mina, G(("lanceiro", 20)), 0), G(("lanceiro", 20))));
        var parelha = (b2.Fim - b2.Inicio) / 1000.0;
        Assert.InRange(parelha, 60, B.P.Combate.Batalha.MaxSeg);
        Assert.True(parelha > desigual * 3);
        // a mesma defesa contra o dobro do ataque dura menos: a luta ficou mais desigual
        var s3 = new CombateCenario();
        var b3 = s3.Chegar(s3.Atacar(s3.Alvo(TipoLocal.Mina, G(("lanceiro", 5)), 0), G(("arqueiro", 6))));
        var s4 = new CombateCenario();
        var b4 = s4.Chegar(s4.Atacar(s4.Alvo(TipoLocal.Mina, G(("lanceiro", 5)), 0), G(("arqueiro", 40))));
        Assert.True(b4.Fim - b4.Inicio < b3.Fim - b3.Inicio);
    }

    /// <summary>O balanceamento de antes do ritmo 3×, refeito a partir do de agora (só o que muda o ritmo).</summary>
    private static Balanceamento RitmoAntigo(string dir)
    {
        var raiz = JsonNode.Parse(File.ReadAllText(Balanceamento.Localizar()))!;
        var p = raiz["P"]!;
        p["prodBase"] = 3; p["casteloBase"] = 2.5; p["tempoN2"] = 120; p["nivelMax"] = 10; p["custoCresc"] = 2.15;
        p["popMinH"] = 1; p["popMaxH"] = 2; p["tempoNovoLocal"] = 5400;
        foreach (var k in new[] { "Lenta", "Média", "Rápida" }) p["minPor"]![k] = p["minPor"]![k]!.GetValue<double>() * 3;
        foreach (var u in raiz["U"]!.AsObject()) u.Value!["tempo"] = u.Value["tempo"]!.GetValue<double>() * 3;
        var arq = Path.Combine(dir, "antigo.json");
        File.WriteAllText(arq, raiz.ToJsonString());
        return Balanceamento.Carregar(arq);
    }

    [Fact]
    public void Mundo_salvo_no_ritmo_antigo_carrega_no_novo_e_segue_andando()
    {
        var dir = Path.Combine(Path.GetTempPath(), "rp-ritmo-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        try
        {
            // mundo no ritmo antigo, com obra, treino e marcha em andamento
            var relogio = new RelogioFalso(MundoTeste.Inicio);
            var antigo = new Mundo(RitmoAntigo(dir), relogio) { InicioReino = InicioP.Vazio };
            antigo.CriarNovo(7);
            Sistemas.IniciarTodos(antigo);
            ReinoDePedra.Jogo.Exploracao.Fauna.Limpar(antigo);
            var r = CriacaoReino.Criar(antigo, 1001, "Pedralva", new Brasao());
            var castelo = antigo.Locais[r.CasteloId];
            foreach (var k in Formulas.Basicos) castelo.Estoque.Somar(k, 5000);
            castelo.Guarnicao["lanceiro"] = 4; antigo.Sujar(castelo);
            ReinoDePedra.Jogo.Pessoas.Pessoas.Sincronizar(antigo, castelo);
            var obra = Obras.Melhorar(antigo, r, castelo.Id);
            Assert.Equal(240, obra.DuracaoSeg);   // o ritmo antigo de verdade: 2 min × 2
            var treino = Recrutamento.Recrutar(antigo, r, castelo.Id, "lanceiro", 1);
            var destino = antigo.G.Area(castelo.Hex, 10).First(h => antigo.G.Distancia(h, castelo.Hex) == 10 && Obras.HexLivre(antigo, h) && !antigo.Mapa.Rio[h]);
            var marcha = Exercitos.Enviar(antigo, r, castelo.Id, G(("lanceiro", 4)), destino, OrdemMover.Id);
            var (fimObra, fimTreino, chegada) = (obra.Fim!.Value, treino.Fim!.Value, marcha.Chegada);
            var arq = Path.Combine(dir, "t.db");
            using (var db = new Banco(arq)) db.Salvar(antigo);

            // o mesmo arquivo, aberto com o balanceamento de agora
            using var db2 = new Banco(arq);
            var novo = new Mundo(Balanceamento.Padrao, relogio) { InicioReino = InicioP.Vazio };
            db2.Carregar(novo);
            novo.PrepararMapa();
            foreach (var e in novo.Eventos) novo.Agenda.Inserir(e);
            Sistemas.IniciarTodos(novo);
            var r2 = novo.Reinos[r.Id];
            var c2 = novo.Locais[r2.CasteloId];
            // o que já estava em andamento termina na hora que tinha: nada é recalculado para trás
            Assert.Equal(fimObra, r2.Fila(Obras.Fila).Itens.Single().Fim);
            Assert.Equal(fimTreino, r2.Fila(Recrutamento.Fila).Itens.Single().Fim);
            Assert.Equal(chegada, novo.Marchas[marcha.Id].Chegada);
            void Avancar(double horas)
            {
                var fim = relogio.Agora + (long)(horas * 3600_000);
                while (novo.Agenda.Proximo(out _, out var q) && q <= fim) { relogio.Agora = Math.Max(relogio.Agora, q); novo.ProcessarAte(relogio.Agora); }
                relogio.Agora = fim; novo.ProcessarAte(fim);
                AjustesTeste.FalharSeErro();
            }
            Avancar(2);
            Assert.Equal(2, c2.Nivel);
            Assert.Empty(r2.Fila(Recrutamento.Fila).Itens);
            // o que começa agora já anda no ritmo novo
            var obra2 = Obras.Melhorar(novo, r2, c2.Id);
            Assert.Equal(new Formulas(Balanceamento.Padrao).TempoNivel(3, true), obra2.DuracaoSeg, 6);
            Assert.True(obra2.DuracaoSeg < 240);
            Avancar(48);   // dois dias de jogo sem erro em evento nenhum
            Assert.True(c2.Nivel >= 3);
        }
        finally { try { Directory.Delete(dir, true); } catch { /* arquivo ainda aberto no Windows */ } }
    }
}
