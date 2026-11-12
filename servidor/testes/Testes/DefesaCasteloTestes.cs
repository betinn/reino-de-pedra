using System.Text.Json.Nodes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.IA;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Reinos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Testes;

/// <summary>
/// Defesa própria do castelo pelo nível (torre de menagem, portões básicos, portões fechados sem máquinas de cerco) e a IA que
/// guarda o reino (reserva em casa, obras de defesa, tropas que voltam ao ver um exército). Decisão 0042.
/// </summary>
public class DefesaCasteloTestes
{
    public DefesaCasteloTestes() => AjustesTeste.Garantir();

    private static Dictionary<string, int> G(params (string k, int n)[] x) => x.ToDictionary(p => p.k, p => p.n);

    /// <summary>Castelo nível 8 do defensor sem guarnição, só com os 3 civis sem trabalho (os outros trabalham nos locais).</summary>
    private static (CombateCenario s, Local castelo) CasteloVazio(int nivel = 8, int dist = 4)
    {
        var s = new CombateCenario();
        var c = s.Alvo(TipoLocal.Castelo, new Dictionary<string, int>(), 3, dist: dist, nivel: nivel);
        return (s, c);
    }

    // ---------------------------------------------------------------- defesa própria

    [Fact]
    public void Defesa_propria_cresce_com_o_nivel_e_e_publica()
    {
        var (s, c) = CasteloVazio();
        Assert.Equal(4, Defesas.ArqueirosMenagem(s.M, c));        // floor(8 × 0,5)
        Assert.Equal(2, Defesas.PortoesBasicos(s.M, c));          // floor(8 / 4)
        Assert.Equal(2, Defesas.PortoesEfetivos(s.M, c));
        Assert.Equal(4, Defesas.ArqueirosNoAlto(s.M, c));         // sem torres: só a menagem
        c.Portoes = 3; c.EstruturaPortoes = 300;
        Assert.Equal(3, Defesas.PortoesEfetivos(s.M, c));         // o construído acima do básico vale
        c.Portoes = 1;
        Assert.Equal(2, Defesas.PortoesEfetivos(s.M, c));         // abaixo do básico, vale o básico
        c.Nivel = 3;
        Assert.Equal(1, Defesas.ArqueirosMenagem(s.M, c));
        Assert.Equal(1, Defesas.PortoesEfetivos(s.M, c));         // o construído
        // outros locais não têm defesa própria
        var mina = s.Alvo(TipoLocal.Mina, new Dictionary<string, int>(), 0, nivel: 8);
        Assert.Equal(0, Defesas.ArqueirosMenagem(s.M, mina));
        Assert.Equal(0, Defesas.PortoesEfetivos(s.M, mina));
    }

    [Fact]
    public void Castelo_nivel_8_vazio_aguenta_6_tropas_de_reino_novo()
    {
        var (s, c) = CasteloVazio();
        var ex = s.Atacar(c, G(("lanceiro", 4), ("arqueiro", 2)), CombateCenario.Plano("cerco"));
        var b = s.Chegar(ex);
        s.Terminar(b);
        Assert.Equal("derrota", b.Resultado);
        Assert.Empty(AjustesTeste.De(s.M).Quedas);
        Assert.False(c.Ruina);
        Assert.Equal(s.Def.Id, c.ReinoId);
        Assert.Empty(b.MortosDefesa);   // os arqueiros da menagem não são pessoas: ninguém da defesa morre por eles
    }

    [Theory]
    [InlineData(10, 0, "derrota")]   // 10 arqueiros de reino novo, sem máquinas
    [InlineData(0, 20, "derrota")]   // 20 tropas sem máquinas: os portões fechados seguram
    public void Castelo_nivel_8_vazio_aguenta_forca_sem_maquinas(int arqueiros, int mistas, string resultado)
    {
        var (s, c) = CasteloVazio();
        var g = arqueiros > 0 ? G(("arqueiro", arqueiros)) : G(("lanceiro", mistas / 2), ("arqueiro", mistas / 2));
        var b = s.Chegar(s.Atacar(c, g, CombateCenario.Plano("cerco")));
        s.Terminar(b);
        Assert.Equal(resultado, b.Resultado);
    }

    [Fact]
    public void Castelo_nivel_8_vazio_cai_para_um_exercito_de_cerco()
    {
        var (s, c) = CasteloVazio();
        var g = G(("lanceiro", 8), ("arqueiro", 8), ("ariete", 4));
        var ex = s.Atacar(c, g, CombateCenario.Plano("cerco"));
        var b = s.Chegar(ex);
        // as máquinas arrombam 160 de 200 da estrutura dos portões básicos: eles contam só em parte
        Assert.Equal(0.8, s.M.F.PortoesAbertos(2, g), 6);
        s.Terminar(b);
        Assert.Equal("vitoria", b.Resultado);
        var q = Assert.Single(AjustesTeste.De(s.M).Quedas);
        Assert.Equal(c.Id, q.castelo.Id);
    }

    [Fact]
    public void Maquinas_de_cerco_arrombam_os_portoes_na_formula()
    {
        var (s, _) = CasteloVazio();
        var f = s.M.F;
        var semMaquinas = G(("lanceiro", 10));
        var fechado = s.M.P.Portoes[2] * s.M.P.DefesaCastelo.Fechado;
        Assert.Equal(fechado, f.MultPortoes(2, semMaquinas), 9);
        Assert.Equal(1, f.MultPortoes(2, G(("lanceiro", 10), ("ariete", 5))), 9);            // 200 de estrutura, 5 × 40
        Assert.Equal(1, f.MultPortoes(2, G(("trebuchet", 3))), 9);
        Assert.Equal(1 + (fechado - 1) * 0.6, f.MultPortoes(2, G(("ariete", 2), ("lanceiro", 8))), 9);   // 80 de 200: 40% arrombados
        Assert.Equal(1, f.MultPortoes(0, semMaquinas), 9);
    }

    [Fact]
    public void Obra_de_portoes_sobe_a_partir_dos_basicos_e_os_basicos_nao_caem()
    {
        var (s, c) = CasteloVazio();
        s.T.DarRecursos(s.Def);
        Assert.Equal(3, Defesas.NivelAlvoPortoes(s.M, s.Def, c));
        var it = Defesas.SubirPortoes(s.M, s.Def);
        Assert.Equal(3, it.NivelAlvo);
        // dano de cerco só derruba portões construídos
        Assert.Equal(0, Defesas.DanificarPortoes(s.M, c, 1000));
        Assert.Equal(2, Defesas.PortoesEfetivos(s.M, c));
    }

    [Fact]
    public void Previa_e_reconhecimento_mostram_a_defesa_propria_e_os_portoes_fechados()
    {
        var (s, c) = CasteloVazio();
        var vis = new HashSet<int> { c.Hex };
        var pequena = Reconhecimentos.Estimar(s.M, s.Atk, c, G(("lanceiro", 4), ("arqueiro", 2)), 0, null, vis);
        Assert.Equal("vista", pequena["fonte"]!.GetValue<string>());
        Assert.Equal(4, pequena["menagem"]!.GetValue<int>());
        Assert.Equal(4, pequena["arqueirosNoAlto"]!.GetValue<int>());
        Assert.Equal(2, pequena["portoes"]!.GetValue<int>());
        Assert.Equal(0, pequena["portoesAbertos"]!.GetValue<double>());
        Assert.False(pequena["vence"]!.GetValue<bool>());
        Assert.Contains("portões fechados", pequena["texto"]!.GetValue<string>());
        var cerco = Reconhecimentos.Estimar(s.M, s.Atk, c, G(("lanceiro", 8), ("arqueiro", 8), ("ariete", 5)), 0, null, vis);
        Assert.Equal(1, cerco["portoesAbertos"]!.GetValue<double>());
        Assert.True(cerco["vence"]!.GetValue<bool>());
        var linhas = Reconhecimentos.Linhas(s.M, pequena).Select(x => x!.ToJsonString()).ToList();
        Assert.Contains(linhas, x => x.Contains("Torre de menagem"));
    }

    [Fact]
    public void Estimativa_da_IA_conta_a_defesa_propria_do_castelo()
    {
        var (s, c) = CasteloVazio();
        var e = new LocalEspionado { DonoId = s.Def.Id, Quando = s.M.Agora, Tropas = 0, Torres = 0, Nivel = c.Nivel };
        var semDefesa = ReinoDePedra.Jogo.Publico.RegraPublica.CivisEstimados(s.M, c) * s.M.P.MiliciaPorPop * s.M.P.DefMilicia;
        var menagem = 4 * s.M.B.U["arqueiro"].Def * s.M.P.Torre.BonusAlto;
        var fechado = s.M.P.Portoes[2] * s.M.P.DefesaCastelo.Fechado;
        Assert.Equal((semDefesa + menagem) * fechado, Governo.DefesaEstimada(s.M, e, c), 6);
        // com aríetes que arrombam os portões, só a menagem e a milícia
        Assert.Equal(semDefesa + menagem, Governo.DefesaEstimada(s.M, e, c, G(("ariete", 5))), 6);
    }

    // ---------------------------------------------------------------- a IA guarda o reino

    [Fact]
    public void Reserva_da_IA_cresce_com_o_nivel_e_muda_com_perfil_e_persona()
    {
        var (s, c) = CasteloVazio(4);
        var hab = s.M.P.IA.Habilidades["medio"];
        Conduta C(string perfil, Persona? p = null) => new(hab, s.M.P.IA.Perfis[perfil]) { Persona = p ?? Personas.Neutra() };
        Assert.Equal(2, Governo.Reserva(s.M, c, C("expansionista")));
        c.Nivel = 8;
        Assert.Equal(4, Governo.Reserva(s.M, c, C("expansionista")));
        Assert.Equal(6, Governo.Reserva(s.M, c, C("defensivo")));
        Assert.Equal(3, Governo.Reserva(s.M, c, C("saqueador")));
        var cauteloso = Personas.Neutra(); cauteloso.Cautela = 1; cauteloso.Agressividade = 0;
        var agressivo = Personas.Neutra(); agressivo.Cautela = 0; agressivo.Agressividade = 1;
        Assert.True(Governo.Reserva(s.M, c, C("expansionista", cauteloso)) > 4);
        Assert.True(Governo.Reserva(s.M, c, C("expansionista", agressivo)) < 4);
        // com 6 lanceiros em casa, só saem 2: os outros 4 guardam o castelo
        s.Guarnecer(c, G(("lanceiro", 6)));
        Assert.Equal(2, Governo.Disponiveis(s.M, c, C("expansionista")));
        Assert.Equal(0, Governo.Disponiveis(s.M, c, C("defensivo")));
    }

    [Fact]
    public void IA_constroi_portoes_e_uma_torre_em_qualquer_perfil()
    {
        var t = MundoIA.Novo(criar: false);
        var r = MundoIA.Criar(t, "expansionista");   // o perfil não pede torres
        var c = t.M.Locais[r.CasteloId];
        c.Nivel = 8; t.M.Sujar(c);
        t.DarRecursos(r);
        Governo.DefesasDoCastelo(t.M, r, MundoIA.Conduta(t, r), c);
        var fila = r.Fila(Obras.Fila).Itens;
        Assert.Contains(fila, i => i.Tipo == ObraPortoes.Id && i.NivelAlvo == 3);
        Assert.Contains(fila, i => i.Tipo == ObraTorre.Id);
        // portões já no nível pedido: não sobe mais
        r.Fila(Obras.Fila).Itens.Clear();
        c.Portoes = t.M.P.IA.Guarda.Portoes;
        Governo.DefesasDoCastelo(t.M, r, MundoIA.Conduta(t, r), c);
        Assert.DoesNotContain(r.Fila(Obras.Fila).Itens, i => i.Tipo == ObraPortoes.Id);
    }

    /// <summary>
    /// Defensor de IA com o castelo a <paramref name="dist"/> do atacante, às 14 h dela, e um grupo de 2 lanceiros parado perto
    /// do castelo. O atacante manda um exército para o castelo.
    /// </summary>
    private static (CombateCenario s, Local castelo, Exercito fora, Exercito vindo) ExercitoVindo(Action<Persona>? ajuste, int dist = 36)
    {
        var s = new CombateCenario();
        s.M.IA.Ativa = true; SistemaIA.AoIniciar(s.M);
        s.Def.ContaId = null; s.Def.PerfilIA = "expansionista"; s.Def.HabilidadeIA = "ativo";
        s.Def.Persona = Personas.Neutra();
        if (ajuste != null) { s.Def.Persona = Personas.Gerar(5, "expansionista", "ativo"); ajuste(s.Def.Persona); }
        var hl = Sessoes.HoraLocal(s.M, s.M.Agora);
        s.T.AvancarHoras(((14 - hl) % 24 + 24) % 24);
        var c = s.Alvo(TipoLocal.Castelo, G(("lanceiro", 8)), 3, dist: dist, nivel: 8);
        var perto = s.M.G.Area(c.Hex, 3).First(h => s.M.G.Distancia(h, c.Hex) == 3 && Obras.HexLivre(s.M, h) && !s.M.Mapa.Rio[h]);
        var fora = Exercitos.Enviar(s.M, s.Def, c.Id, G(("lanceiro", 2)), perto, OrdemMover.Id, false);
        s.AvancarAte(fora.Chegada + 1000);
        Assert.False(fora.Retornando);
        Assert.Equal(perto, fora.HexEm(s.M.Agora));
        s.Guarnecer(s.CasteloAtk, G(("lanceiro", 6)));
        var vindo = Exercitos.Enviar(s.M, s.Atk, s.CasteloAtk.Id, G(("lanceiro", 6)), c.Hex, OrdemAtacar.Id, false, CombateCenario.Plano("saque"));
        return (s, c, fora, vindo);
    }

    [Fact]
    public void IA_traz_as_tropas_de_volta_ao_ver_um_exercito_vindo()
    {
        var (s, c, fora, vindo) = ExercitoVindo(p => { p.Reflexo = 1; p.Disciplina = 1; p.DesvioHoras = 0; });
        // ainda longe: nada a fazer
        Assert.Equal(0, Governo.Recolher(s.M, s.Def, Sessoes.De(s.M, s.Def)));
        // anda até o exército entrar na visão do reino (o aviso "Exército de ... à vista"), ainda vindo
        var ate = vindo.Chegada;
        while (s.M.Agora < ate && s.Def.ReacaoIAEventoId == null) s.AvancarAte(s.M.Agora + 500);
        Assert.True(s.M.Agora < ate);
        Assert.Contains(s.M.Notificacoes, n => n.ReinoId == s.Def.Id && n.Titulo.Contains("à vista"));
        // ela estava acordada e viu o aviso: a reação está marcada, com o atraso de gente
        var ev = Assert.IsType<ReacaoIAEvento>(s.M.Eventos.Obter(s.Def.ReacaoIAEventoId!.Value));
        Assert.InRange((ev.Quando - s.M.Agora) / 1000.0, 0, 30 * 60);
        Assert.True(Governo.MarchaVindo(s.M, s.Def));
        Assert.Equal(1, Governo.Recolher(s.M, s.Def, Sessoes.De(s.M, s.Def)));
        Assert.True(fora.Retornando);
        Assert.Equal(OrdemRetornar.Id, fora.Ordem);
    }

    [Fact]
    public void IA_neutra_ou_dormindo_nao_reage_ao_exercito_fora_da_sessao()
    {
        var (s, c, _, vindo) = ExercitoVindo(null);
        // até o aviso de exército à vista sair (ela recebe, mas a persona neutra só age na sessão)
        while (s.M.Agora < vindo.Chegada && !s.M.Notificacoes.Any(n => n.ReinoId == s.Def.Id && n.Titulo.Contains("à vista"))) s.AvancarAte(s.M.Agora + 500);
        Assert.True(s.M.Agora < vindo.Chegada);
        Assert.Null(s.Def.ReacaoIAEventoId);
    }
}
