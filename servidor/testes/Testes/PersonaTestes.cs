using System.Text.Json;
using ReinoDePedra.Api.Visoes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.IA;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Persistencia;
using ReinoDePedra.Jogo.Publico;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Testes;

/// <summary>
/// Quem governa um reino de IA: persona gerada, serializável e secreta; presença, atenção e reação de gente; escolhas
/// puxadas pelo temperamento; memória de quem fez mal; e o ponto único de onde sai toda fala.
/// </summary>
[Collection("falas")]   // dois testes trocam Falas.Gerador (estático): não rodam ao mesmo tempo
public class PersonaTestes
{
    private static readonly string[] Tracos = ["Agressividade", "Passividade", "Paciencia", "Ganancia", "Lealdade", "Rancor", "Sociabilidade", "Cautela", "Orgulho", "Curiosidade", "Disciplina"];
    private static double Traco(Persona p, string nome) => (double)typeof(Persona).GetProperty(nome)!.GetValue(p)!;
    private static Dictionary<string, int> G(params (string k, int n)[] x) => x.ToDictionary(p => p.k, p => p.n);

    /// <summary>Reino de IA com uma persona feita à mão por cima da gerada.</summary>
    private static Reino Com(MundoTeste t, string perfil, string habilidade, Action<Persona> ajuste)
    {
        var r = MundoIA.Criar(t, perfil, habilidade);
        var p = Personas.Gerar(99, perfil, habilidade);
        ajuste(p);
        r.Persona = p; t.M.Sujar(r);
        return r;
    }

    // ---------------------------------------------------------------- quem é

    [Fact]
    public void Todo_reino_de_IA_nasce_com_uma_persona_completa_e_variada()
    {
        var t = MundoIA.Novo();
        var ias = Ocupacao.DeIA(t.M).ToList();
        Assert.Equal(t.M.P.IA.Inicial, ias.Count);
        foreach (var r in ias)
        {
            var p = Assert.IsType<Persona>(r.Persona);
            Assert.False(string.IsNullOrWhiteSpace(p.Governante)); Assert.False(string.IsNullOrWhiteSpace(p.Titulo));
            Assert.False(string.IsNullOrWhiteSpace(p.Arquetipo)); Assert.False(string.IsNullOrWhiteSpace(p.Temperamento));
            Assert.False(string.IsNullOrWhiteSpace(p.Historia)); Assert.False(string.IsNullOrWhiteSpace(p.Tom));
            Assert.InRange(p.Objetivos.Count, 1, 3); Assert.NotEmpty(p.Inspiracoes);
            Assert.InRange(p.Idade, 16, 75);
            foreach (var k in Tracos) Assert.InRange(Traco(p, k), 0, 1);
            Assert.InRange(p.Assiduidade, 0.5, 1); Assert.InRange(p.Reflexo, 0.5, 2); Assert.InRange(p.DesvioHoras, -3, 4);
        }
        // gente diferente: vários temperamentos, tons, arquétipos e horários
        Assert.True(ias.Select(r => r.Persona!.Temperamento).Distinct().Count() >= 3);
        Assert.True(ias.Select(r => r.Persona!.Tom).Distinct().Count() >= 3);
        Assert.True(ias.Select(r => r.Persona!.Arquetipo).Distinct().Count() >= 4);
        Assert.True(ias.Select(r => r.Persona!.Governante).Distinct().Count() >= ias.Count * 0.7);
        Assert.True(ias.Max(r => r.Persona!.DesvioHoras) - ias.Min(r => r.Persona!.DesvioHoras) > 2);
        Assert.True(ias.Max(r => r.Persona!.Disciplina) - ias.Min(r => r.Persona!.Disciplina) > 0.2, "uns melhores, outros piores");
    }

    [Fact]
    public void A_mesma_semente_da_a_mesma_pessoa_e_o_perfil_puxa_os_tracos()
    {
        var a = JsonSerializer.Serialize(Personas.Gerar(1234, "saqueador", "medio"));
        var b = JsonSerializer.Serialize(Personas.Gerar(1234, "saqueador", "medio"));
        Assert.Equal(a, b);
        Assert.NotEqual(a, JsonSerializer.Serialize(Personas.Gerar(1235, "saqueador", "medio")));
        // em média, o saqueador é mais agressivo que o defensivo, o comerciante mais ganancioso e sociável, o ativo mais atento
        double Media(string perfil, string hab, Func<Persona, double> f) => Enumerable.Range(1, 200).Average(i => f(Personas.Gerar((ulong)i * 7919, perfil, hab)));
        Assert.True(Media("saqueador", "medio", p => p.Agressividade) > Media("defensivo", "medio", p => p.Agressividade) + 0.3);
        Assert.True(Media("defensivo", "medio", p => p.Cautela) > Media("saqueador", "medio", p => p.Cautela) + 0.25);
        Assert.True(Media("comerciante", "medio", p => p.Ganancia) > Media("defensivo", "medio", p => p.Ganancia) + 0.2);
        Assert.True(Media("comerciante", "medio", p => p.Sociabilidade) > Media("saqueador", "medio", p => p.Sociabilidade) + 0.2);
        Assert.True(Media("defensivo", "ativo", p => p.Disciplina) > Media("defensivo", "fraco", p => p.Disciplina) + 0.25);
        Assert.True(Media("defensivo", "ativo", p => p.Reflexo) < Media("defensivo", "fraco", p => p.Reflexo) - 0.4);
    }

    [Fact]
    public void Persona_e_serializavel_e_volta_igual_do_banco()
    {
        var p = Personas.Gerar(77, "comerciante", "ativo");
        p.Rancores[42] = 0.6; p.Afinidades[43] = 0.3; p.FalouEm["vizinho"] = 123;
        var json = JsonSerializer.Serialize(p);
        Assert.Equal(json, JsonSerializer.Serialize(JsonSerializer.Deserialize<Persona>(json)));

        var dir = Path.Combine(Path.GetTempPath(), "rp-persona-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        try
        {
            var t = MundoIA.Novo(criar: false);
            var r = Ocupacao.CriarUm(t.M)!;
            r.Persona!.Rancores[5] = 0.5; t.M.Sujar(r);
            var antes = JsonSerializer.Serialize(r.Persona);
            var arq = Path.Combine(dir, "t.db");
            using (var db = new Banco(arq)) db.Salvar(t.M);
            using var db2 = new Banco(arq);
            var m2 = new Mundo(Balanceamento.Padrao, t.Relogio);
            db2.Carregar(m2);
            Assert.Equal(antes, JsonSerializer.Serialize(m2.Reinos[r.Id].Persona));
        }
        finally { try { Directory.Delete(dir, true); } catch { /* arquivo ainda aberto no Windows */ } }
    }

    [Fact]
    public void Mundo_de_antes_ganha_persona_ao_subir_e_ela_nao_muda_de_uma_subida_para_a_outra()
    {
        var t = MundoIA.Novo(criar: false);
        var r = Ocupacao.CriarUm(t.M)!;
        var primeira = JsonSerializer.Serialize(r.Persona);
        r.Persona = null;   // como num mundo gravado antes desta regra
        SistemaIA.AoIniciar(t.M);
        Assert.Equal(primeira, JsonSerializer.Serialize(r.Persona));
        // reino de jogador nunca tem persona
        var j = MundoIA.Jogador(t, 0);
        SistemaIA.AoIniciar(t.M);
        Assert.Null(j.Persona);
    }

    [Fact]
    public void Persona_e_segredo_nada_do_que_o_jogador_ou_o_visitante_recebem_fala_dela()
    {
        var t = MundoIA.Novo();
        var j = MundoIA.Jogador(t, 0);
        var ia = Ocupacao.DeIA(t.M).First();
        ia.Persona!.Governante = "Zzyzx Segredo"; ia.Persona.Historia = "Historia Zzyzx"; ia.Persona.Bordoes = ["bordao-zzyzx"];
        var tudo = string.Join("\n", new[]
        {
            JsonSerializer.Serialize(VisaoMapa.Montar(t.M, j)), RegraPublica.Mundo(t.M).ToJsonString(), RegraPublica.Vivo(t.M).ToJsonString(),
            JsonSerializer.Serialize(VisaoReino.Montar(t.M, j)), JsonSerializer.Serialize(VisaoSocial.Alianca(t.M, j)),
        });
        foreach (var proibido in new[] { "persona", "governante", "Zzyzx", "zzyzx", "temperamento", "arquetipo", "perfilIA", "habilidadeIA", "rancores", "disciplina", "assiduidade" })
            Assert.DoesNotContain(proibido, tudo, StringComparison.OrdinalIgnoreCase);
    }

    // ---------------------------------------------------------------- persona neutra: a conduta pura

    [Fact]
    public void Persona_neutra_nao_muda_nada_na_conduta()
    {
        var t = MundoIA.Novo(criar: false);
        var r = MundoIA.Criar(t, "comerciante", "medio");
        var c = MundoIA.Conduta(t, r);
        var hab = t.M.P.IA.Habilidades["medio"]; var perfil = t.M.P.IA.Perfis["comerciante"];
        Assert.Equal(hab.Militar * perfil.Militar, c.Militar, 9);
        Assert.Equal(hab.FracTropas, c.FracTropas, 9);
        Assert.Equal(perfil.Locais, c.Locais, 9);
        Assert.Equal(1, c.Margem, 9); Assert.Equal(1, c.FolgaDeAtaque, 9); Assert.Equal(1, c.Espera, 9);
        foreach (var passo in Personas.PesoEsquecer.Keys) Assert.Equal(0, Personas.ChanceDeEsquecer(r, passo));
        Assert.Equal(0, Personas.TempoDeReacao(t.M, r, "x"));
        for (var i = 0; i < 50; i++) { t.AvancarHoras(5); Assert.True(Personas.Aparece(t.M, r)); }
    }

    // ---------------------------------------------------------------- escolhas coerentes com o temperamento

    [Fact]
    public void O_temperamento_puxa_a_conduta_para_o_lado_dele()
    {
        var t = MundoIA.Novo(criar: false);
        var neutro = MundoIA.Conduta(t, MundoIA.Criar(t, "saqueador", "medio"));
        var bravo = MundoIA.Conduta(t, Com(t, "saqueador", "medio", p => { p.Agressividade = 0.95; p.Cautela = 0.1; p.Ganancia = 0.9; p.Passividade = 0.1; p.Paciencia = 0.1; }));
        var manso = MundoIA.Conduta(t, Com(t, "saqueador", "medio", p => { p.Agressividade = 0.05; p.Cautela = 0.9; p.Ganancia = 0.1; p.Passividade = 0.9; p.Paciencia = 0.9; }));
        Assert.True(bravo.Militar > neutro.Militar && neutro.Militar > manso.Militar);
        Assert.True(bravo.FolgaDeAtaque < neutro.FolgaDeAtaque && neutro.FolgaDeAtaque < manso.FolgaDeAtaque, "o agressivo ataca com menos folga; o cauteloso quer mais");
        Assert.True(bravo.Margem > neutro.Margem && neutro.Margem > manso.Margem, "o ganancioso pede mais nas trocas");
        Assert.True(bravo.Locais > neutro.Locais && neutro.Locais > manso.Locais, "o passivo expande menos");
        Assert.True(bravo.Espera < neutro.Espera && neutro.Espera < manso.Espera, "o paciente espera mais por um item parado");
        // sem exagero: a persona desvia a conduta, não a troca (a habilidade e o perfil continuam mandando)
        Assert.InRange(bravo.Militar / neutro.Militar, 1.0, 1.2);
        Assert.InRange(manso.Militar / neutro.Militar, 0.8, 1.0);
        Assert.True(Comerciante.Margem(t.M, bravo) > Comerciante.Margem(t.M, manso));
    }

    [Fact]
    public void Quem_guarda_rancor_do_dono_executa_o_explorador_e_o_ganancioso_pede_resgate()
    {
        ReinoDePedra.Jogo.Exploracao.Prisioneiro Capturado(MundoTeste t, Reino captor, Reino dono)
        {
            var c = t.M.Locais[captor.CasteloId];
            var item = ReinoDePedra.Jogo.Exploracao.Exploradores.Treinar(t.M, dono, "pe", 1);
            t.DarRecursos(dono);
            t.AvancarMin(5);
            var e = ReinoDePedra.Jogo.Exploracao.Exploradores.Enviar(t.M, dono, "pe", ReinoDePedra.Jogo.Exploracao.Exploradores.Explorar, c.Hex + 2, seguro: false);
            Assert.NotNull(item);
            return ReinoDePedra.Jogo.Exploracao.Capturas.Capturar(t.M, e, captor, c.Hex + 2, c)!;
        }
        // defensivo (o perfil libertaria): com rancor do dono, executa
        var t1 = MundoIA.Novo(criar: false);
        var dono1 = MundoIA.Jogador(t1, 0); t1.DarRecursos(dono1);
        var rancoroso = Com(t1, "defensivo", "medio", p => { p.Ganancia = 0.3; p.Agressividade = 0.4; p.Disciplina = 1; });
        rancoroso.Persona!.Rancores[dono1.Id] = 0.8;
        var p1 = Capturado(t1, rancoroso, dono1);
        Governo.Prisioneiros(t1.M, rancoroso);
        Assert.Null(t1.M.Prisioneiros.Obter(p1.Id));   // executado
        // defensivo ganancioso, sem rancor: pede resgate em vez de libertar
        var t2 = MundoIA.Novo(criar: false);
        var dono2 = MundoIA.Jogador(t2, 0); t2.DarRecursos(dono2);
        var ganancioso = Com(t2, "defensivo", "medio", p => { p.Ganancia = 0.92; p.Agressividade = 0.3; p.Disciplina = 1; });
        var p2 = Capturado(t2, ganancioso, dono2);
        Governo.Prisioneiros(t2.M, ganancioso);
        Assert.Equal(ReinoDePedra.Jogo.Exploracao.Capturas.ResgatePedido, t2.M.Prisioneiros.Obter(p2.Id)!.Estado);
    }

    // ---------------------------------------------------------------- memória

    [Fact]
    public void Quem_ataca_fica_marcado_o_rancor_apaga_com_o_tempo_e_o_rancoroso_lembra_por_mais_tempo()
    {
        var s = new CombateCenario();
        var t = s.T;
        s.M.IA.Ativa = true; SistemaIA.AoIniciar(s.M);
        // o defensor vira um reino de IA com persona
        s.Def.ContaId = null; s.Def.PerfilIA = "defensivo"; s.Def.HabilidadeIA = "medio";
        s.Def.Persona = Personas.Gerar(5, "defensivo", "medio"); s.Def.Persona.Rancor = 0.9; s.Def.Persona.Paciencia = 0.2;
        var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 2)), 0);
        var b = s.Chegar(s.Atacar(alvo, G(("arqueiro", 12))));
        s.AvancarAte(b.FimPrevisto + 1000);
        var rancor = Personas.RancorDe(s.Def, s.Atk.Id);
        Assert.True(rancor > 0.3, "foi atacado e perdeu: guarda rancor");
        Assert.Equal(s.Atk.Id, Personas.Desafeto(s.Def));
        // apaga com o tempo
        Personas.Envelhecer(s.M, s.Def);
        t.AvancarHoras(24 * 6);
        Personas.Envelhecer(s.M, s.Def);
        var depois = Personas.RancorDe(s.Def, s.Atk.Id);
        Assert.True(depois < rancor && depois > 0);
        // a mesma ofensa numa pessoa que esquece fácil some bem mais depressa
        var esquecido = new Reino { Id = 999001, ContaId = null, PerfilIA = "defensivo", Persona = Personas.Gerar(6, "defensivo", "medio") };
        esquecido.Persona.Rancor = 0.05; esquecido.Persona.Rancores[s.Atk.Id] = rancor; esquecido.Persona.MemoriaEm = s.M.Agora - 6 * T.Dia;
        Personas.Envelhecer(s.M, esquecido);
        Assert.True(Personas.RancorDe(esquecido, s.Atk.Id) < depois * 0.5);
    }

    [Fact]
    public void Quem_nao_perdoa_vai_atras_so_de_quem_o_atacou_mesmo_sem_ser_saqueador()
    {
        var t = MundoIA.Novo(criar: false);
        var ofensor = MundoIA.Jogador(t, 0); ofensor.EscudoAte = 0;
        var outro = MundoIA.Jogador(t, 1); outro.EscudoAte = 0;
        var ia = Com(t, "defensivo", "medio", p => { p.Rancor = 0.9; p.Agressividade = 0.5; p.Paciencia = 0.1; p.Disciplina = 1; p.Assiduidade = 1; });
        var castelo = t.M.Locais[ia.CasteloId];
        castelo.Nivel = t.M.P.IA.Espionagem.Castelo; t.M.Sujar(castelo);
        t.DarRecursos(ia);
        // os dois ficam ao alcance: um local de cada um perto do castelo da IA
        Local Perto(Reino dono, int dist)
        {
            var h = t.M.G.Area(castelo.Hex, dist).First(x => t.M.G.Distancia(x, castelo.Hex) == dist && Obras.HexLivre(t.M, x) && !t.M.Mapa.Rio[x]);
            return t.M.AdicionarLocal(new Local { ReinoId = dono.Id, Tipo = TipoLocal.Mina, Produz = "ferro", Hex = h, Nome = "Mina de " + dono.Nome, Nivel = 3 });
        }
        var doOutro = Perto(outro, 6); var doOfensor = Perto(ofensor, 12);
        // sem rancor, o defensivo não espiona ninguém
        ia.ExploradoresLivres[ReinoDePedra.Jogo.Exploracao.Exploradores.Batedor] = 1;
        ReinoDePedra.Jogo.Pessoas.Pessoas.SincronizarLivres(t.M, ia);
        Governo.Sessao(t.M, ia, MundoIA.Conduta(t, ia));
        Assert.DoesNotContain(t.M.Marchas.OfType<ReinoDePedra.Jogo.Exploracao.Explorador>(), e => e.ReinoId == ia.Id && e.Ordem == ReinoDePedra.Jogo.Exploracao.Exploradores.Espionar);
        // atacado pelo ofensor: o batedor vai ao local dele, não ao do outro, que está mais perto
        Personas.Ofensa(t.M, ia, ofensor.Id, 0.9);
        Governo.Sessao(t.M, ia, MundoIA.Conduta(t, ia));
        var espiao = Assert.Single(t.M.Marchas.OfType<ReinoDePedra.Jogo.Exploracao.Explorador>(), e => e.ReinoId == ia.Id && e.Ordem == ReinoDePedra.Jogo.Exploracao.Exploradores.Espionar);
        Assert.Equal(doOfensor.Hex, espiao.Destino);
        Assert.NotEqual(doOutro.Hex, espiao.Destino);
    }

    // ---------------------------------------------------------------- presença, atenção e reação

    [Fact]
    public void Gente_falta_a_sessoes_mas_nunca_tres_seguidas()
    {
        var t = MundoIA.Novo(criar: false);
        var r = Com(t, "defensivo", "medio", p => { p.Assiduidade = 0.6; p.FimDeSemana = 1; });
        t.M.Cancelar(r.SessaoIAEventoId); r.SessaoIAEventoId = null;   // só as chamadas do teste contam (a sessão de verdade também pergunta se ela veio)
        int faltas = 0, seguidas = 0, maxSeguidas = 0;
        for (var i = 0; i < 300; i++)
        {
            t.AvancarHoras(5.3);
            if (Personas.Aparece(t.M, r)) seguidas = 0; else { faltas++; seguidas++; maxSeguidas = Math.Max(maxSeguidas, seguidas); }
        }
        Assert.InRange(faltas, 60, 150);   // perto de 40%, menos as faltas que a regra das duas seguidas impede
        Assert.Equal(2, maxSeguidas);
    }

    [Fact]
    public void Quem_joga_mais_no_fim_de_semana_falta_menos_nele()
    {
        var t = MundoIA.Novo(criar: false);
        var r = Com(t, "defensivo", "medio", p => { p.Assiduidade = 0.6; p.FimDeSemana = 1.4; });
        t.M.Cancelar(r.SessaoIAEventoId); r.SessaoIAEventoId = null;
        int semana = 0, faltasSemana = 0, fds = 0, faltasFds = 0;
        for (var i = 0; i < 1200; i++)
        {
            t.AvancarHoras(3.1);
            var veio = Personas.Aparece(t.M, r);
            if (Personas.FimDeSemana(t.M, t.M.Agora)) { fds++; if (!veio) faltasFds++; } else { semana++; if (!veio) faltasSemana++; }
        }
        Assert.True(fds > 200 && semana > 600);
        Assert.True(faltasFds / (double)fds < faltasSemana / (double)semana - 0.05);
    }

    [Fact]
    public void O_cronotipo_desloca_as_horas_de_sessao()
    {
        var t = MundoIA.Novo(criar: false);
        var noturno = Com(t, "defensivo", "medio", p => { p.DesvioHoras = 2.5; p.Assiduidade = 1; p.Reflexo = 0; });
        var horas = t.M.P.IA.Habilidades["medio"].Sessoes;
        var vari = t.M.P.IA.VariacaoMin / 60.0;
        Sessoes.Agendar(t.M, noturno);
        for (var i = 0; i < 10; i++)
        {
            var q = t.M.Eventos.Obter(noturno.SessaoIAEventoId!.Value)!.Quando;
            var hl = Sessoes.HoraLocal(t.M, q);
            // cada sessão cai 2 h 30 depois de uma das horas da habilidade (com a variação de sempre)
            Assert.Contains(horas, h => { var d = Math.Abs(hl - ((h + 2.5) % 24)); return Math.Min(d, 24 - d) <= vari + 1e-6; });
            t.Avancar(TimeSpan.FromMilliseconds(q - t.M.Agora + 1));
        }
    }

    [Fact]
    public void Tempo_de_reacao_e_de_gente_varia_muito_e_o_lento_demora_mais()
    {
        var t = MundoIA.Novo(criar: false);
        var rapido = Com(t, "defensivo", "ativo", p => p.Reflexo = 0.6);
        var lento = Com(t, "defensivo", "fraco", p => p.Reflexo = 1.8);
        List<double> Amostras(Reino r)
        {
            var l = new List<double>();
            for (var i = 0; i < 400; i++) { t.AvancarMin(7); l.Add(Personas.TempoDeReacao(t.M, r, "ataque") / 1000.0); }
            l.Sort();
            return l;
        }
        var a = Amostras(rapido); var b = Amostras(lento);
        Assert.All(a.Concat(b), s => Assert.InRange(s, 15, 30 * 60));           // nunca instantâneo, nunca mais de meia hora
        Assert.True(a[200] > 20 && a[200] < 90, "mediana do rápido: " + a[200]);
        Assert.True(b[200] > a[200] * 2, "o lento demora bem mais que o rápido");
        Assert.True(a[380] > a[20] * 4, "varia muito de uma vez para a outra: às vezes reage tarde");
        Assert.True(a.Distinct().Count() > 300);
    }

    [Fact]
    public void Erro_de_atencao_as_vezes_esquece_um_passo_e_quem_tem_disciplina_nunca_esquece()
    {
        var t = MundoIA.Novo(criar: false);
        var distraido = Com(t, "defensivo", "fraco", p => { p.Disciplina = 0.1; p.Assiduidade = 1; p.Reflexo = 0; });
        var atento = Com(t, "defensivo", "ativo", p => { p.Disciplina = 1; p.Assiduidade = 1; p.Reflexo = 0; });
        var esquecidos = new List<(long reino, string passo)>();
        Governo.AoEsquecer = (r, passo) => { lock (esquecidos) esquecidos.Add((r.Id, passo)); };
        try
        {
            for (var i = 0; i < 40; i++)
            {
                t.AvancarHoras(6);
                Governo.Sessao(t.M, distraido, MundoIA.Conduta(t, distraido));
                Governo.Sessao(t.M, atento, MundoIA.Conduta(t, atento));
            }
        }
        finally { Governo.AoEsquecer = null; }
        var doDistraido = esquecidos.Where(x => x.reino == distraido.Id).ToList();
        Assert.DoesNotContain(esquecidos, x => x.reino == atento.Id);
        Assert.True(doDistraido.Count > 15, "esqueceu " + doDistraido.Count);
        Assert.Contains(doDistraido, x => x.passo == "construir");   // esquecer uma fila acontece
        // mas não esquece tudo: a maior parte das vezes ele faz o que tinha de fazer
        Assert.True(doDistraido.Count(x => x.passo == "construir") < 25);
        Assert.True(Personas.ChanceDeEsquecer(distraido, "construir") > Personas.ChanceDeEsquecer(distraido, "defender"), "esquece mais uma fila do que uma defesa");
    }

    [Fact]
    public void Passo_esquecido_nao_acontece_fila_de_obras_fica_vazia_ate_a_proxima_sessao()
    {
        var t = MundoIA.Novo(criar: false);
        var r = Com(t, "defensivo", "fraco", p => { p.Disciplina = 0; p.Assiduidade = 1; p.Reflexo = 0; });
        t.DarRecursos(r);
        var vazias = 0; var cheias = 0;
        for (var i = 0; i < 60; i++)
        {
            foreach (var it in r.Fila(Obras.Fila).Itens.ToList()) Filas.Cancelar(t.M, r, Obras.Fila, it.Id);
            t.AvancarMin(11);
            var esqueceu = false;
            Governo.AoEsquecer = (x, passo) => { if (x.Id == r.Id && passo == "construir") esqueceu = true; };
            try { Governo.Sessao(t.M, r, MundoIA.Conduta(t, r)); } finally { Governo.AoEsquecer = null; }
            if (esqueceu) { vazias++; Assert.Empty(r.Fila(Obras.Fila).Itens); } else { cheias++; Assert.NotEmpty(r.Fila(Obras.Fila).Itens); }
        }
        Assert.True(vazias >= 3 && cheias > vazias, vazias + " esquecidas, " + cheias + " feitas");
    }

    [Fact]
    public void A_sessao_acontece_em_duas_partes_com_minutos_entre_elas()
    {
        var t = MundoIA.Novo(criar: false);
        var r = Com(t, "defensivo", "medio", p => { p.Reflexo = 1; p.Assiduidade = 1; p.Disciplina = 1; });
        t.DarRecursos(r);
        Sessoes.Agendar(t.M, r);
        var quando = t.M.Eventos.Obter(r.SessaoIAEventoId!.Value)!.Quando;
        t.Avancar(TimeSpan.FromMilliseconds(quando - t.M.Agora + 1));
        // ao entrar: obras na fila; a segunda parte está marcada para daqui a pouco
        Assert.NotEmpty(r.Fila(Obras.Fila).Itens);
        var segunda = Assert.IsType<SessaoIAEvento>(t.M.Eventos.Obter(r.SessaoIA2EventoId!.Value));
        Assert.Equal(1, segunda.Etapa);
        Assert.InRange((segunda.Quando - t.M.Agora) / 1000.0, 14, 30 * 60);
        // o que é da segunda parte (mandar o explorador) ainda não aconteceu
        Assert.DoesNotContain(t.M.Marchas.OfType<ReinoDePedra.Jogo.Exploracao.Explorador>(), e => e.ReinoId == r.Id);
        t.Avancar(TimeSpan.FromMilliseconds(segunda.Quando - t.M.Agora + 1));
        Assert.Null(r.SessaoIA2EventoId);
        AjustesTeste.FalharSeErro();
    }

    [Fact]
    public void Atacada_acordada_reage_com_atraso_de_gente_e_a_persona_neutra_so_reage_na_sessao()
    {
        (CombateCenario s, Batalha b) Cenario(Action<Persona>? ajuste)
        {
            var s = new CombateCenario();
            s.M.IA.Ativa = true; SistemaIA.AoIniciar(s.M);
            s.Def.ContaId = null; s.Def.PerfilIA = "defensivo"; s.Def.HabilidadeIA = "ativo";
            s.Def.Persona = Personas.Neutra();
            if (ajuste != null) { s.Def.Persona = Personas.Gerar(5, "defensivo", "ativo"); ajuste(s.Def.Persona); }
            // meio do dia dela: 14 h locais
            var hl = Sessoes.HoraLocal(s.M, s.M.Agora);
            s.T.AvancarHoras(((14 - hl) % 24 + 24) % 24);
            var alvo = s.Alvo(TipoLocal.Mina, G(("lanceiro", 20)), 0);
            return (s, s.Chegar(s.Atacar(alvo, G(("lanceiro", 20)))));
        }
        var (s1, _) = Cenario(p => { p.Reflexo = 1; p.Disciplina = 1; p.DesvioHoras = 0; });
        var ev = Assert.IsType<ReacaoIAEvento>(s1.M.Eventos.Obter(s1.Def.ReacaoIAEventoId!.Value));
        Assert.InRange((ev.Quando - s1.M.Agora) / 1000.0, 15, 30 * 60);
        var (s2, _) = Cenario(null);
        Assert.Null(s2.Def.ReacaoIAEventoId);
        // dormindo (4 h da manhã dela), não vê
        var s3 = new CombateCenario();
        s3.M.IA.Ativa = true; SistemaIA.AoIniciar(s3.M);
        s3.Def.ContaId = null; s3.Def.PerfilIA = "defensivo"; s3.Def.HabilidadeIA = "ativo";
        s3.Def.Persona = Personas.Gerar(5, "defensivo", "ativo"); s3.Def.Persona.Reflexo = 1; s3.Def.Persona.Disciplina = 1; s3.Def.Persona.DesvioHoras = 0;
        var h3 = Sessoes.HoraLocal(s3.M, s3.M.Agora);
        s3.T.AvancarHoras(((4 - h3) % 24 + 24) % 24);
        s3.Chegar(s3.Atacar(s3.Alvo(TipoLocal.Mina, G(("lanceiro", 20)), 0), G(("lanceiro", 20))));
        Assert.Null(s3.Def.ReacaoIAEventoId);
    }

    // ---------------------------------------------------------------- falas: um ponto só

    private sealed class Espia : IGeradorDeFala
    {
        public Persona? Persona; public ContextoFala? Contexto; public int Chamadas;
        public string? Gerar(Persona p, ContextoFala c, Rng s) { Persona = p; Contexto = c; Chamadas++; return "  fala de teste  "; }
    }

    [Fact]
    public void Toda_fala_sai_do_ponto_unico_com_quem_fala_para_quem_a_situacao_e_o_historico()
    {
        var t = MundoIA.Novo(criar: false);
        var ia = Com(t, "comerciante", "medio", p => p.Sociabilidade = 0.9);
        var antes = Falas.Gerador; var espia = new Espia();
        Falas.Gerador = espia;
        try
        {
            var texto = Falas.Gerar(t.M, ia, new ContextoFala
            {
                Tipo = Falas.AvisoAtaque, Canal = Falas.CanalAlianca, ParaReino = "Valdren", MaxCaracteres = 200,
                Situacao = new() { ["local"] = "Mina Rubra", ["atacante"] = "Corvo Negro" },
                Historico = [new FalaAnterior("Valdren", "alguém aí?"), new FalaAnterior(ia.Nome, "aqui", true)],
            });
            Assert.Equal("fala de teste", texto);   // aparada
            Assert.Equal(1, espia.Chamadas);
            Assert.Same(ia.Persona, espia.Persona);
            var c = espia.Contexto!;
            Assert.Equal(ia.Nome, c.DeReino); Assert.Equal("Valdren", c.ParaReino);
            Assert.Equal(Falas.AvisoAtaque, c.Tipo); Assert.Equal(Falas.CanalAlianca, c.Canal);
            Assert.Equal("Mina Rubra", c.Situacao["local"]); Assert.Equal(2, c.Historico.Count);
            // o pedido que uma LLM receberia: persona inteira e contexto, em JSON
            var pedido = Falas.Pedido(ia.Persona!, c);
            Assert.Equal(ia.Persona!.Governante, pedido["persona"]!["Governante"]!.GetValue<string>());
            Assert.Equal("Valdren", pedido["contexto"]!["ParaReino"]!.GetValue<string>());
            Assert.Equal(2, pedido["contexto"]!["Historico"]!.AsArray().Count);
            // corta no tamanho do canal; quem escreve pode calar ou falhar sem derrubar nada
            Assert.InRange(Falas.Gerar(t.M, ia, new ContextoFala { Tipo = Falas.Saudacao, MaxCaracteres = 5 })!.Length, 1, 5);
            Falas.Gerador = new Calado();
            Assert.Null(Falas.Gerar(t.M, ia, new ContextoFala { Tipo = Falas.Saudacao }));
            Falas.Gerador = new Quebrado();
            Assert.Null(Falas.Gerar(t.M, ia, new ContextoFala { Tipo = Falas.Saudacao }));
            // reino sem persona (jogador) não fala por aqui
            Falas.Gerador = espia;
            Assert.Null(Falas.Gerar(t.M, MundoIA.Jogador(t, 0), new ContextoFala { Tipo = Falas.Saudacao }));
        }
        finally { Falas.Gerador = antes; }
    }
    private sealed class Calado : IGeradorDeFala { public string? Gerar(Persona p, ContextoFala c, Rng s) => null; }
    private sealed class Quebrado : IGeradorDeFala { public string? Gerar(Persona p, ContextoFala c, Rng s) => throw new InvalidOperationException("fora do ar"); }

    [Fact]
    public void Modelos_de_texto_escrevem_todo_assunto_dentro_do_limite_e_no_jeito_de_cada_um()
    {
        Assert.IsType<FalasPorModelo>(Falas.Gerador);
        var g = new FalasPorModelo();
        var situacao = new Dictionary<string, string> { ["local"] = "Mina Rubra", ["atacante"] = "Corvo Negro", ["recurso"] = "pedra", ["quantidade"] = "120", ["alianca"] = "Liga do Vale" };
        var personas = Enumerable.Range(1, 40).Select(i => Personas.Gerar((ulong)i * 104729, new[] { "saqueador", "defensivo", "comerciante", "expansionista" }[i % 4], "medio")).ToList();
        foreach (var assunto in FalasPorModelo.Assuntos)
        {
            var textos = new HashSet<string>();
            foreach (var (p, i) in personas.Select((p, i) => (p, i)))
                foreach (var canal in new[] { Falas.CanalAlianca, Falas.CanalMensageiro })
                {
                    var txt = g.Gerar(p, new ContextoFala { Tipo = assunto, Canal = canal, ParaReino = "Valdren", Situacao = situacao, MaxCaracteres = 200 }, new Rng((ulong)i * 31 + 7));
                    Assert.False(string.IsNullOrWhiteSpace(txt), assunto);
                    Assert.True(txt!.Length <= 200, assunto + ": " + txt.Length);
                    Assert.DoesNotContain("{", txt); Assert.DoesNotContain("}", txt);
                    if (p.Minusculas) Assert.Equal(txt.ToLowerInvariant(), txt);
                    textos.Add(txt);
                }
            Assert.True(textos.Count >= 6, assunto + ": só " + textos.Count + " jeitos de dizer");
        }
        // assunto que os modelos não conhecem: sai uma frase genérica, não um erro
        Assert.False(string.IsNullOrWhiteSpace(g.Gerar(personas[0], new ContextoFala { Tipo = "assunto-novo" }, new Rng(1))));
        // sem os fatos da situação, a frase sai sem a chave à mostra
        Assert.DoesNotContain("{", g.Gerar(personas[1], new ContextoFala { Tipo = Falas.PedidoReforco }, new Rng(3))!);
    }

    [Fact]
    public void IA_sociavel_responde_a_mensagem_de_um_jogador_na_sessao_e_por_mensageiro_nunca_na_hora()
    {
        var t = MundoIA.Novo(criar: false);
        var j = MundoIA.Jogador(t, 0); t.DarRecursos(j);
        var ia = Com(t, "comerciante", "medio", p => { p.Sociabilidade = 1; p.Disciplina = 1; p.Assiduidade = 1; p.Reflexo = 0; });
        t.DarRecursos(ia);
        Mensageiros.Treinar(t.M, j, 1);
        t.AvancarMin(5);
        var msg = Mensageiros.Enviar(t.M, j, "Boa tarde, vizinho. Trocamos pedra por ferro?", ia.Id, null);
        t.AvancarHoras(1);
        Assert.Equal(Mensageiros.EntregueE, msg.Estado);
        Assert.DoesNotContain(t.M.Mensagens, x => x.DeId == ia.Id);   // chegou, mas ela não está no jogo agora
        // as sessões seguintes: treina o mensageiro, depois responde
        for (var i = 0; i < 4 && !t.M.Mensagens.Any(x => x.DeId == ia.Id); i++)
        {
            var q = t.M.Eventos.Obter(ia.SessaoIAEventoId!.Value)!.Quando;
            t.Avancar(TimeSpan.FromMilliseconds(q - t.M.Agora + 1000));
        }
        var resposta = Assert.Single(t.M.Mensagens, x => x.DeId == ia.Id);
        Assert.Equal(j.Id, resposta.ParaId);
        Assert.Equal(msg.Id, resposta.RespondeA);
        Assert.InRange(resposta.Texto.Length, 3, t.M.P.Mensageiro.Caracteres);
        Assert.True(msg.Lida);
        AjustesTeste.FalharSeErro();
    }

    [Fact]
    public void IA_calada_le_e_nao_responde()
    {
        var t = MundoIA.Novo(criar: false);
        var j = MundoIA.Jogador(t, 0); t.DarRecursos(j);
        var ia = Com(t, "defensivo", "medio", p => { p.Sociabilidade = 0; p.Disciplina = 1; p.Assiduidade = 1; p.Reflexo = 0; p.Rancor = 0.1; });
        // sociabilidade 0 ainda deixa 20% de chance: com várias mensagens, a maioria fica sem resposta
        Mensageiros.Treinar(t.M, j, 5);
        t.AvancarMin(10);
        for (var i = 0; i < 5; i++) Mensageiros.Enviar(t.M, j, "Mensagem " + i, ia.Id, null);
        t.AvancarHoras(1);
        for (var i = 0; i < 6; i++)
        {
            var q = t.M.Eventos.Obter(ia.SessaoIAEventoId!.Value)!.Quando;
            t.Avancar(TimeSpan.FromMilliseconds(q - t.M.Agora + 1000));
        }
        Assert.True(t.M.Mensagens.Count(x => x.DeId == ia.Id) <= 2);
        Assert.All(Mensageiros.Recebidas(t.M, ia.Id), x => Assert.True(x.Lida || t.M.Mensagens.Any(y => y.RespondeA == x.Id) || ia.Persona!.FalouEm.ContainsKey("vou-responder:" + x.Id)));
    }
}

[CollectionDefinition("falas", DisableParallelization = true)]
public class ColecaoFalas { }
