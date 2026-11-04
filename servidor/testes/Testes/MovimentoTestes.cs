using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Mapa;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Valiosos;

namespace ReinoDePedra.Testes;

/// <summary>Explorador que espera no destino, rotas e circuitos, patrulha de tropas, escavação somada e névoa ao vivo (decisão 0026).</summary>
public class MovimentoTestes
{
    private static Local Castelo(MundoTeste t, Reino r) => t.M.Locais[r.CasteloId];
    private static void AvancarAte(MundoTeste t, long instante) => t.Avancar(TimeSpan.FromMilliseconds(Math.Max(0, instante - t.M.Agora)));

    private static int Livre(MundoTeste t, int de, int dist, int pular = 0) =>
        t.M.G.Area(de, dist).Where(h => t.M.G.Distancia(h, de) == dist && !t.M.Mapa.Rio[h] && Obras.HexLivre(t.M, h)
            && t.M.G.C(h) > 2 && t.M.G.L(h) > 2 && t.M.G.C(h) < t.M.G.Cols - 3 && t.M.G.L(h) < t.M.G.Lins - 3).Skip(pular).First();

    private static void Guarnecer(MundoTeste t, Reino r, Local l, string unidade, int n)
    {
        Economia.Atualizar(t.M, r);
        l.Guarnicao[unidade] = l.Guarnicao.GetValueOrDefault(unidade) + n;
        ReinoDePedra.Jogo.Pessoas.Pessoas.RemoverCivis(t.M, r, t.B.U[unidade].Pop * n);
        t.M.Sujar(l); t.M.Sujar(r);
    }

    [Fact]
    public void Explorador_fica_no_destino_esperando_nova_ordem()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        r.ExploradoresLivres["cavalo"] = 1;
        var destino = Livre(t, c.Hex, 20);
        var e = Exploradores.Enviar(t.M, r, "cavalo", Exploradores.Explorar, destino);
        AvancarAte(t, e.Chegada + 1);
        t.AvancarHoras(2);
        Assert.True(t.M.Marchas.ContemId(e.Id));                 // não voltou sozinho
        Assert.Equal(Exploradores.Aguardar, e.Ordem);
        Assert.Equal(destino, e.HexEm(t.M.Agora));
        Assert.Null(e.EventoId);
        Assert.Equal(0, r.ExploradoresLivres.GetValueOrDefault("cavalo"));
        Assert.Contains(destino, Nevoas.VisiveisAgora(t.M, r.Id));   // parado, mantém a área à vista
        // nova ordem a partir dali: outro lugar
        var outro = Livre(t, destino, 12);
        Exploradores.DarOrdem(t.M, r, e.Id, Exploradores.Explorar, outro);
        Assert.Equal(destino, e.Caminho[0]);
        AvancarAte(t, e.Chegada + 1);
        Assert.Equal(outro, e.HexEm(t.M.Agora));
        // e só volta quando mandam
        Exploradores.DarOrdem(t.M, r, e.Id, Exploradores.Retornar, null);
        AvancarAte(t, e.Chegada + 1);
        Assert.False(t.M.Marchas.ContemId(e.Id));
        Assert.Equal(1, r.ExploradoresLivres["cavalo"]);
    }

    [Fact]
    public void Rota_em_circuito_recomeca_e_rota_simples_para_no_ultimo_ponto()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        r.ExploradoresLivres["pe"] = 2;
        var a = Livre(t, c.Hex, 10); var b = Livre(t, c.Hex, 10, pular: 20);
        var simples = Exploradores.Enviar(t.M, r, "pe", Exploradores.SeguirRota, null, [a, b]);
        var circ = Exploradores.Enviar(t.M, r, "pe", Exploradores.SeguirRota, null, [a, b], circuito: true);
        Assert.True(circ.Circuito);
        t.AvancarHoras(3);
        Assert.Equal(Exploradores.Aguardar, simples.Ordem);
        Assert.Equal(b, simples.HexEm(t.M.Agora));
        Assert.Equal(Exploradores.SeguirRota, circ.Ordem);       // segue rodando até nova ordem
        Assert.NotNull(circ.EventoId);
    }

    [Fact]
    public void Tropas_percorrem_os_pontos_e_param_no_ultimo_ou_rodam_em_circuito()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        Guarnecer(t, r, c, "lanceiro", 4);
        var p1 = Livre(t, c.Hex, 8); var p2 = Livre(t, c.Hex, 8, pular: 16); var p3 = Livre(t, c.Hex, 12, pular: 5);
        var ex = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 2 }, p1, OrdemPercorrer.Id, false,
            new JsonObject { ["pontos"] = new JsonArray(p1, p2, p3) });
        var visitados = new HashSet<int>();
        for (var i = 0; i < 4000 && !ex.Parado; i++) { t.AvancarMin(0.05); visitados.Add(ex.HexEm(t.M.Agora)); }
        Assert.True(ex.Parado);
        Assert.Equal(p3, ex.HexEm(t.M.Agora));
        Assert.Contains(p1, visitados); Assert.Contains(p2, visitados);

        var circ = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 2 }, p1, OrdemPercorrer.Id, false,
            new JsonObject { ["pontos"] = new JsonArray(p1, p2), ["circuito"] = true });
        var voltas = 0; var ultimo = -1;
        for (var i = 0; i < 6000; i++)
        {
            t.AvancarMin(0.05);
            var h = circ.HexEm(t.M.Agora);
            if (h == p1 && ultimo != p1) voltas++;
            ultimo = h;
        }
        Assert.True(voltas >= 2, "voltas: " + voltas);
        Assert.False(circ.Parado);
    }

    [Fact]
    public void Patrulha_roda_em_volta_do_lugar_ate_nova_ordem()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        Guarnecer(t, r, c, "arqueiro", 3);
        // patrulha em volta do próprio castelo, saindo dele
        var ex = Exercitos.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["arqueiro"] = 3 }, c.Hex, OrdemPatrulhar.Id);
        var anel = Percursos.Pontos(ex);
        Assert.Equal(t.B.P.Patrulha.Pontos, anel.Count);
        Assert.All(anel, h => Assert.Equal(t.B.P.Patrulha.Raio, t.M.G.Distancia(h, c.Hex)));
        Assert.Equal(anel[0], ex.Destino);
        var vistos = new HashSet<int>();
        for (var i = 0; i < 3000; i++) { t.AvancarMin(0.05); vistos.Add(ex.HexEm(t.M.Agora)); }
        Assert.True(anel.All(vistos.Contains));
        Assert.False(ex.Parado);
        Assert.Equal(OrdemPatrulhar.Id, ex.Ordem);
        // nova ordem interrompe: parar aqui
        Exercitos.DarOrdem(t.M, r, ex.Id, OrdemMover.Id, ex.HexEm(t.M.Agora));
        Assert.True(ex.Parado);
    }

    [Fact]
    public void Mais_tropas_na_mesma_ruina_se_juntam_e_encurtam_a_escavacao_sem_perder_o_progresso()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        var hex = Livre(t, c.Hex, 6);
        var ru = t.M.Ruinas.Adicionar(new Ruina { Hex = hex, TipoReliquia = "ataque" });
        Nevoas.RevelarArea(t.M, r.Id, hex, 2);
        Guarnecer(t, r, c, "lanceiro", 4);
        var um = Extracoes.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 1 }, hex, Escavacoes.OrdemEscavar, false, new JsonObject());
        AvancarAte(t, um.Chegada + 1);
        Assert.Equal(ru.Id, um.EscavaRuinaId);
        var fim1 = um.EscavaFim!.Value;
        t.AvancarHoras(2);
        var feito = (t.M.Agora - um.EscavaInicio!.Value) / (double)(fim1 - um.EscavaInicio.Value);
        // mais três lanceiros: a ordem é aceita e eles se juntam ao grupo que já está lá
        var mais = Extracoes.Enviar(t.M, r, c.Id, new Dictionary<string, int> { ["lanceiro"] = 3 }, hex, Escavacoes.OrdemEscavar, false, new JsonObject());
        AvancarAte(t, mais.Chegada + 1);
        Assert.False(t.M.Marchas.ContemId(mais.Id));
        Assert.Equal(4, um.Tropas["lanceiro"]);
        Assert.Equal(4, um.PessoaIds.Count);
        Assert.True(um.EscavaFim!.Value < fim1, "mais tropas, menos tempo");
        var feitoDepois = (t.M.Agora - um.EscavaInicio!.Value) / (double)(um.EscavaFim.Value - um.EscavaInicio.Value);
        Assert.InRange(feitoDepois, feito - 0.01, 1);               // o progresso não volta ao zero
        var minimo = t.M.P.Reliquia.EscavarMin * T.Hora;
        Assert.True(um.EscavaFim.Value - um.EscavaInicio.Value >= minimo - 1000);   // nunca abaixo do mínimo
        Assert.True(ReinoDePedra.Jogo.Pessoas.Pessoas.Conferir(t.M).Count == 0);
    }

    [Fact]
    public void Nevoa_se_abre_ao_vivo_em_intervalos_curtos()
    {
        var t = new MundoTeste();
        var r = t.NovoReino();
        var c = Castelo(t, r);
        r.ExploradoresLivres["cavalo"] = 1;
        var destino = Livre(t, c.Hex, 40);
        var e = Exploradores.Enviar(t.M, r, "cavalo", Exploradores.Explorar, destino);
        var eventos = t.M.Eventos.OfType<RevelarCaminhoEvento>().Where(x => x.MarchaId == e.Id).Select(x => x.Quando).OrderBy(x => x).ToList();
        Assert.True(eventos.Count >= 3);
        var maiorIntervalo = eventos.Zip(eventos.Skip(1), (a, b) => b - a).Max();
        // nunca mais que o tempo de alguns hexágonos sem abrir névoa (antes: um por minuto de jogo)
        Assert.True(maiorIntervalo <= (long)(t.B.P.RevelacaoSeg * 1000) * 4, "intervalo " + maiorIntervalo);
    }
}
