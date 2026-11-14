using System.Text.Json;
using System.Text.Json.Nodes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.IA;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Persistencia;
using ReinoDePedra.Jogo.Reinos;
using Xunit.Abstractions;

namespace ReinoDePedra.Testes;

/// <summary>
/// Horário dos reinos de IA (decisão 0044): a faixa de cronotipo sai por cota do balanceamento, a madrugada tem poucas IAs
/// mas nunca nenhuma, o mundo antigo ganha o horário uma vez ao subir, e quem joga de madrugada continua parecendo gente
/// (dorme, e o fim de semana é o do dia dela).
/// </summary>
public class HorarioIATestes(ITestOutputHelper saida)
{
    private static int[] SessoesDe(Mundo m, Reino r) => m.P.IA.Habilidades[r.HabilidadeIA!].Sessoes;

    [Fact]
    public void A_faixa_sai_por_cota_e_a_coruja_joga_ate_tarde()
    {
        var t = MundoIA.Novo();
        var ias = Ocupacao.DeIA(t.M).ToList();
        var faixas = t.M.P.IA.Cronotipos;
        Assert.Contains("coruja", faixas.Keys);
        foreach (var r in ias)
        {
            var p = r.Persona!;
            var f = Assert.Contains(p.Cronotipo, (IDictionary<string, CronotipoIAP>)faixas);
            Assert.InRange(p.DesvioHoras, f.Desvio[0], f.Desvio[1]);
            Assert.True(Cronotipos.Aceita(f, r.HabilidadeIA), $"{p.Cronotipo} não aceita {r.HabilidadeIA}");
        }
        // cota: cada faixa fica a no máximo 1 da conta exata (peso × IAs), e a coruja nunca falta
        var total = faixas.Values.Sum(f => f.Peso);
        foreach (var (k, f) in faixas)
        {
            var n = ias.Count(r => r.Persona!.Cronotipo == k);
            saida.WriteLine($"{k}: {n} (conta exata {f.Peso / total * ias.Count:0.0})");
            Assert.InRange(n, Math.Floor(f.Peso / total * ias.Count) - 1, Math.Ceiling(f.Peso / total * ias.Count) + 1);
        }
        Assert.True(ias.Count(r => r.Persona!.Cronotipo == "coruja") >= 3);
        Assert.All(ias.Where(r => r.Persona!.Cronotipo == "coruja"), r => Assert.Contains(r.HabilidadeIA, new[] { "medio", "ativo" }));
    }

    [Fact]
    public void De_madrugada_ha_poucas_IAs_mas_nunca_nenhuma()
    {
        var t = MundoIA.Novo();
        var m = t.M;
        var ias = Ocupacao.DeIA(m).ToList();
        // acordadas a cada meia hora, pela mesma regra da reação a ataques
        double Acordadas(double h) => ias.Count(r => Cronotipos.AcordadaNaHora(h, r.Persona!.DesvioHoras, SessoesDe(m, r)));
        // sessões marcadas num dia, pela mesma conta que agenda a sessão de verdade (sem a variação de ±40 min)
        var porHora = new int[24];
        var meiaNoite = Sessoes.Proxima(m, new CondutaIAP { Sessoes = [0] }, m.Agora);
        foreach (var r in ias)
            for (var q = Sessoes.Proxima(m, m.P.IA.Habilidades[r.HabilidadeIA!], meiaNoite - 1, r.Persona!.DesvioHoras); q < meiaNoite + T.Dia;
                 q = Sessoes.Proxima(m, m.P.IA.Habilidades[r.HabilidadeIA!], q, r.Persona!.DesvioHoras))
                porHora[(int)Sessoes.HoraLocal(m, q)]++;
        for (var h = 0; h < 24; h++) saida.WriteLine($"{h,2} h: {Acordadas(h + 0.5),4} acordadas, {porHora[h],2} sessões");

        var (de, ate) = ((int)m.P.IA.Madrugada[0], (int)m.P.IA.Madrugada[1]);
        var madrugada = Enumerable.Range(de, ate - de).ToList();
        var dia = Enumerable.Range(9, 13).ToList();
        // nunca nenhuma: a cada meia hora da madrugada há pelo menos 2 acordadas, e a madrugada tem sessões
        for (var h = (double)de; h < ate; h += 0.5) Assert.True(Acordadas(h) >= 2, $"{h} h: {Acordadas(h)} acordadas");
        Assert.True(madrugada.Sum(h => porHora[h]) >= 4, $"sessões de {de} h a {ate} h: {madrugada.Sum(h => porHora[h])}");
        // bem menos que de dia (a meta M33 do modelo confere o esperado, 1/3 das sessões; aqui é um mundo só, e a 1 h ainda
        // tem as últimas sessões dos notívagos)
        Assert.True(madrugada.Average(h => Acordadas(h + 0.5)) < dia.Average(h => Acordadas(h + 0.5)) / 4);
        Assert.True(madrugada.Average(h => porHora[h]) < dia.Average(h => porHora[h]) / 2);
        Assert.True(Acordadas(15.5) >= ias.Count * 0.9);
    }

    [Fact]
    public void Mundo_antigo_ganha_o_horario_uma_vez_ao_subir_sem_mexer_nos_jogadores()
    {
        var t = MundoIA.Novo();
        var m = t.M;
        var jogador = MundoIA.Jogador(t, 0);
        var ias = Ocupacao.DeIA(m).ToList();
        // como num mundo gravado antes da decisão 0044: o horário velho (sorteado no código, sem coruja) e nenhuma faixa
        foreach (var r in ias) { r.Persona!.Cronotipo = ""; r.Persona.DesvioHoras = 0.3; m.Sujar(r); }
        var sessaoAntes = ias.ToDictionary(r => r.Id, r => r.SessaoIAEventoId);

        SistemaIA.AoIniciar(m);

        Assert.All(ias, r => Assert.NotEqual("", r.Persona!.Cronotipo));
        Assert.True(ias.Count(r => r.Persona!.Cronotipo == "coruja") >= 3);
        Assert.Contains(ias, r => r.Persona!.DesvioHoras >= 4);
        // a próxima sessão já sai no horário novo: foi reagendada
        Assert.All(ias, r => Assert.NotEqual(sessaoAntes[r.Id], r.SessaoIAEventoId));
        Assert.All(ias, r => Assert.IsType<SessaoIAEvento>(m.Eventos.Obter(r.SessaoIAEventoId!.Value)));
        // reino de jogador: sem persona, sem horário, sem sessão de IA
        Assert.Null(jogador.Persona);
        Assert.Null(jogador.SessaoIAEventoId);

        // uma vez só: subir de novo não sorteia nada nem reagenda
        var depois = ias.ToDictionary(r => r.Id, r => JsonSerializer.Serialize(r.Persona, JsonJogo.Default.Persona));
        var sessaoDepois = ias.ToDictionary(r => r.Id, r => r.SessaoIAEventoId);
        SistemaIA.AoIniciar(m);
        Assert.All(ias, r => Assert.Equal(depois[r.Id], JsonSerializer.Serialize(r.Persona, JsonJogo.Default.Persona)));
        Assert.All(ias, r => Assert.Equal(sessaoDepois[r.Id], r.SessaoIAEventoId));
    }

    [Fact]
    public void A_persona_gravada_antes_do_horario_abre_sem_faixa()
    {
        var p = Personas.Gerar(77, "comerciante", "ativo");
        p.Cronotipo = "coruja"; p.DesvioHoras = 5;
        var json = JsonNode.Parse(JsonSerializer.Serialize(p, JsonJogo.Default.Persona))!.AsObject();
        var chave = json.Select(kv => kv.Key).Single(k => k.Equals("cronotipo", StringComparison.OrdinalIgnoreCase));
        json.Remove(chave);   // o save de antes não tinha o campo
        var velha = JsonSerializer.Deserialize(json.ToJsonString(), JsonJogo.Default.Persona)!;
        Assert.Equal("", velha.Cronotipo);
        Assert.Equal(5, velha.DesvioHoras);
    }

    [Fact]
    public void Quem_abdica_para_o_jogador_poupa_a_ultima_IA_de_cada_horario()
    {
        var t = MundoIA.Novo();
        var m = t.M;
        var faixas = m.P.IA.Cronotipos.Keys.ToList();
        int Na(string f) => Ocupacao.DeIA(m).Count(r => r.Persona!.Cronotipo == f);
        // as corujas ficam as menores do mundo: pelo porte, seriam as primeiras a sair (as outras ganham tropas)
        foreach (var r in Ocupacao.DeIA(m).Where(r => r.Persona!.Cronotipo != "coruja"))
        {
            var c = m.Locais[r.CasteloId];
            c.Guarnicao["lanceiro"] = c.Guarnicao.GetValueOrDefault("lanceiro") + 5;
            m.Sujar(c);
        }
        var corujas = Na("coruja");
        Assert.True(corujas >= 2);
        Assert.All(Ocupacao.DeIA(m).OrderBy(r => Ocupacao.Porte(m, r)).Take(corujas), r => Assert.Equal("coruja", r.Persona!.Cronotipo));
        var j = 0;
        for (; j < m.P.Reinos - m.P.IA.Inicial; j++) MundoIA.Jogador(t, j);   // as vagas livres
        // o menor porte continua saindo primeiro: a coruja sai enquanto houver outra
        MundoIA.Jogador(t, j++);
        Assert.Equal(corujas - 1, Na("coruja"));
        // jogadores entram até sobrar uma IA por faixa: nenhuma faixa some no caminho, e a última coruja fica
        while (Ocupacao.DeIA(m).Count() > faixas.Count)
        {
            MundoIA.Jogador(t, j++);
            Assert.All(faixas, f => Assert.True(Na(f) >= 1, $"{f} sumiu com {Ocupacao.DeIA(m).Count()} IAs"));
        }
        Assert.All(faixas, f => Assert.Equal(1, Na(f)));
        // a regra nunca barra o jogador: com só as últimas de cada faixa, sai a menor delas (a coruja)
        MundoIA.Jogador(t, j++);
        Assert.Equal(0, Na("coruja"));
        Assert.Equal(faixas.Count - 1, Ocupacao.DeIA(m).Count());
    }

    [Fact]
    public void Quem_joga_de_madrugada_dorme_e_nao_joga_24_horas()
    {
        var m = new MundoTeste().M;
        foreach (var (nome, f) in m.P.IA.Cronotipos)
            foreach (var (hab, c) in m.P.IA.Habilidades.Where(h => Cronotipos.Aceita(f, h.Key)))
                foreach (var d in new[] { f.Desvio[0], f.Desvio[1] })
                {
                    // o maior trecho seguido fora do "acordada", em passos de 15 min, dando a volta no relógio
                    var acordada = Enumerable.Range(0, 96).Select(i => Cronotipos.AcordadaNaHora(i / 4.0, d, c.Sessoes)).ToArray();
                    int maior = 0, seguido = 0;
                    for (var i = 0; i < 2 * 96; i++) { seguido = acordada[i % 96] ? 0 : seguido + 1; maior = Math.Max(maior, Math.Min(seguido, 96)); }
                    Assert.True(maior / 4.0 >= 6 - 0.25, $"{nome} {hab} ({d} h) dorme só {maior / 4.0} h");
                    // e nenhuma sessão cai enquanto ela dorme
                    foreach (var h in c.Sessoes) Assert.True(Cronotipos.AcordadaNaHora(((h + d) % 24 + 24) % 24, d, c.Sessoes));
                }
    }

    [Fact]
    public void Fim_de_semana_e_ultima_sessao_sao_do_dia_de_quem_joga()
    {
        var t = new MundoTeste();
        var m = t.M;
        const double coruja = 5.5;
        bool sabadoDeMadrugada = false, segundaDeMadrugada = false;
        for (var i = 0; i < 8 * 24 * 4; i++)
        {
            var q = m.Agora + i * T.Min * 15;
            var h = Sessoes.HoraLocal(m, q);
            bool oficial = Personas.FimDeSemana(m, q), dela = Personas.FimDeSemana(m, q, coruja);
            if (h >= 3 && h < 4)
            {
                // às 3 h de sábado a coruja ainda está na sexta dela; às 3 h de segunda, ainda no domingo
                if (oficial && !dela) sabadoDeMadrugada = true;
                if (!oficial && dela) segundaDeMadrugada = true;
            }
            if (h >= 7 && h < 22) Assert.Equal(oficial, dela);   // de dia não muda nada
        }
        Assert.True(sabadoDeMadrugada && segundaDeMadrugada);

        // a última sessão do dia (a que enche a fila para a noite) é a da hora de dormir de cada uma
        var ativo = m.P.IA.Habilidades["ativo"];
        long Em(double hora) => m.Agora + (long)Math.Round((hora - Sessoes.HoraLocal(m, m.Agora) + 24) % 24 * T.Hora);
        Assert.True(Sessoes.UltimaDoDia(m, ativo, Em(23), 0));
        Assert.False(Sessoes.UltimaDoDia(m, ativo, Em(21), 0));
        Assert.True(Sessoes.UltimaDoDia(m, ativo, Em(4), 5));    // 23 h + 5 h
        Assert.False(Sessoes.UltimaDoDia(m, ativo, Em(2), 5));   // 21 h + 5 h
        Assert.False(Sessoes.UltimaDoDia(m, ativo, Em(12), 5));  // a primeira do dia dela (7 h + 5 h)
    }
}
