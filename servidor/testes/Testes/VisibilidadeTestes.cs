using System.Text.Json;
using ReinoDePedra.Api;
using ReinoDePedra.Api.Visoes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Valiosos;

namespace ReinoDePedra.Testes;

/// <summary>Prévias e consultas por id ou hexágono só usam o que o reino pode saber (névoa, foto, fauna conhecida).</summary>
public class VisibilidadeTestes
{
    public VisibilidadeTestes() => AjustesTeste.Garantir();

    /// <summary>Liga também os sistemas da API (visões do mapa), como o servidor faz na subida.</summary>
    private static MundoTeste ComApi()
    {
        var t = new MundoTeste();
        foreach (var ty in typeof(Servidor).Assembly.GetTypes().Where(x => x.IsDefined(typeof(SistemaAttribute), false)))
            ty.GetMethod("AoIniciar", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static)?.Invoke(null, [t.M]);
        return t;
    }

    private static JsonElement J(object o) => JsonSerializer.SerializeToElement(o, Json.Web);

    private static int HexLonge(MundoTeste t, int de, int dist, int pular = 0) =>
        t.M.G.Area(de, dist).Where(h => t.M.G.Distancia(h, de) == dist && !t.M.Mapa.Rio[h] && Obras.HexLivre(t.M, h)
            && t.M.G.C(h) > 2 && t.M.G.L(h) > 2 && t.M.G.C(h) < t.M.G.Cols - 3 && t.M.G.L(h) < t.M.G.Lins - 3
            && t.M.Mapa.Vagas.All(v => t.M.G.Distancia(v.Castelo, h) > t.M.P.FaunaServ.PertoReino + 1)).Skip(pular).First();

    private static void Guarnecer(MundoTeste t, Reino r, Local l, string unidade, int n)
    {
        Economia.Atualizar(t.M, r);
        l.Guarnicao[unidade] = l.Guarnicao.GetValueOrDefault(unidade) + n;
        r.Pop -= t.B.U[unidade].Pop * n;
        t.M.Sujar(l); t.M.Sujar(r);
    }

    private static List<int> Caminho(JsonElement rota) => rota.GetProperty("caminho").EnumerateArray().Select(x => x.GetInt32()).ToList();

    // ---------------------------------------------------------------- rota segura com a fauna conhecida (achados 5 e 12)

    [Fact]
    public void Previas_e_caravana_seguras_so_desviam_da_fauna_que_o_reino_conhece()
    {
        var t = new MundoTeste();
        var r = t.NovoReino(); r.EscudoAte = 0;
        var c = t.M.Locais[r.CasteloId];
        var alvo = HexLonge(t, c.Hex, 6);
        var curta = Caminhos.Calcular(t.M, c.Hex, alvo, "Lenta");
        var meio = curta.Hexes[curta.Hexes.Count / 2];
        Fauna.Adicionar(t.M, new RegiaoFauna { Centro = meio, Hex = meio, Raio = 1, Animal = "ursos", Nivel = "alto", Qtd = 4 });
        // a fauna real desviaria; o reino não a conhece
        var real = Caminhos.Calcular(t.M, c.Hex, alvo, "Lenta", new OpcoesCaminho { Seguro = true, Forca = 30 });
        Assert.NotEqual(curta.Hexes, real.Hexes);
        Guarnecer(t, r, c, "lanceiro", 4);
        var tropas = new Dictionary<string, int> { ["lanceiro"] = 4 };
        var vel = ReinoDePedra.Jogo.Reinos.Tropas.Velocidade(t.M, tropas);
        var curtaVel = Caminhos.Calcular(t.M, c.Hex, alvo, vel).Hexes;

        // prévia de ataque a uma ruína que o reino já viu
        t.M.AdicionarLocal(new Local { ReinoId = 0, Tipo = TipoLocal.Vila, Ruina = true, Nivel = 1, Hex = alvo, Nome = "Ruína" });
        Nevoas.RevelarArea(t.M, r.Id, alvo, 0);
        var pa = new VisaoCombate.PedidoAtaque(c.Id, null, tropas, alvo, null, null, null, null, null, null, null, true);
        var pv = J(VisaoCombate.Previa(t.M, r, pa, alvo));
        Assert.Equal(curtaVel, Caminho(pv.GetProperty("segura")));

        // viagem das prévias de extração e relíquia
        var vg = J(VisaoValiosos.Viagem(t.M, r.Id, c.Hex, alvo, vel, ReinoDePedra.Jogo.Reinos.Tropas.ForcaFauna(t.M, tropas)));
        Assert.Equal(curtaVel, Caminho(vg.GetProperty("segura")));

        // caravana segura até um local próprio do outro lado
        var dest = t.M.AdicionarLocal(new Local { ReinoId = r.Id, Tipo = TipoLocal.Armazem, Nivel = 1, Hex = HexLonge(t, alvo, 1), Nome = "Armazém" });
        t.DarRecursos(r, 100);
        var plano = Caravanas.Planejar(t.M, r, new PedidoCaravana(c.Id, dest.Id, new Dictionary<string, double> { ["madeira"] = 10 }, null, tropas, c.Id, true));
        Assert.Equal(Caminhos.Calcular(t.M, c.Hex, dest.Hex, plano.Vel).Hexes, plano.Levar!.Hexes);
    }

    // ---------------------------------------------------------------- prévia e envio de ataque na névoa (achado 7)

    [Fact]
    public void Ataque_a_hexagono_que_o_reino_nao_conhece_responde_igual_tenha_ou_nao_local()
    {
        var t = new MundoTeste();
        var a = t.NovoReino(); var b = t.NovoReino();
        a.EscudoAte = 0; b.EscudoAte = 0;
        var ca = t.M.Locais[a.CasteloId];
        var cb = t.M.Locais[b.CasteloId];
        Assert.False(Nevoas.Explorado(t.M, a.Id, cb.Hex));
        Guarnecer(t, a, ca, "lanceiro", 4);
        var tropas = new Dictionary<string, int> { ["lanceiro"] = 4 };
        VisaoCombate.PedidoAtaque P(int h) => new(ca.Id, null, tropas, h, null, null, null, null, null, null, null, false);
        var vazio = t.M.G.Area(cb.Hex, 3).First(h => t.M.LocalNoHex(h) == null && !Nevoas.Explorado(t.M, a.Id, h));
        var comLocal = Assert.Throws<RegraException>(() => VisaoCombate.Previa(t.M, a, P(cb.Hex), cb.Hex)).Message;
        var semLocal = Assert.Throws<RegraException>(() => VisaoCombate.Previa(t.M, a, P(vazio), vazio)).Message;
        Assert.Equal(semLocal, comLocal);
        var envio = Assert.Throws<RegraException>(() => Exercitos.Enviar(t.M, a, ca.Id, tropas, cb.Hex, ReinoDePedra.Jogo.Combate.OrdemAtacar.Id, false, VisaoCombate.Dados(P(cb.Hex)))).Message;
        Assert.Equal(semLocal, envio);

        // explorado e fora da vista: a prévia mostra o último estado conhecido (a foto), não o atual
        var vila = t.M.LocaisDe(b.Id).First(l => l.Id != b.CasteloId);
        Nevoas.RevelarArea(t.M, a.Id, vila.Hex, 0);
        Assert.DoesNotContain(vila.Hex, Nevoas.VisiveisAgora(t.M, a.Id));
        t.M.MudarDono(vila, 0); vila.Ruina = true;
        var pv = J(VisaoCombate.Previa(t.M, a, P(vila.Hex), vila.Hex)).GetProperty("alvo");
        Assert.Equal("desconhecido", pv.GetProperty("dono").GetString());
        Assert.NotEqual("Ruína", pv.GetProperty("nome").GetString());
    }

    // ---------------------------------------------------------------- caravana e relíquia para local alheio (achados 8 e 9)

    [Fact]
    public void Previa_de_caravana_nao_calcula_caminho_ate_local_alheio()
    {
        var t = new MundoTeste();
        var a = t.NovoReino(); var b = t.NovoReino();
        var ca = t.M.Locais[a.CasteloId];
        var alheio = t.M.LocaisDe(b.Id).First(l => l.Id != b.CasteloId);
        Guarnecer(t, a, ca, "lanceiro", 4);
        t.DarRecursos(a, 100);
        var tropas = new Dictionary<string, int> { ["lanceiro"] = 4 };
        var pl = Caravanas.Planejar(t.M, a, new PedidoCaravana(ca.Id, alheio.Id, new Dictionary<string, double> { ["madeira"] = 10 }, null, tropas));
        Assert.NotNull(pl.Problema);
        Assert.Null(pl.Levar);
        Assert.False(J(VisaoValiosos.PlanoCaravana(t.M, pl)).TryGetProperty("levar", out _));
        // base alheia (de onde saem as tropas) também não
        var meu = t.M.LocaisDe(a.Id).First(l => l.Id != a.CasteloId);
        var pb = Caravanas.Planejar(t.M, a, new PedidoCaravana(ca.Id, meu.Id, new Dictionary<string, double> { ["madeira"] = 10 }, null, tropas, alheio.Id));
        Assert.Null(pb.Buscar);
        // origem alheia
        var po = Caravanas.Planejar(t.M, a, new PedidoCaravana(alheio.Id, meu.Id, new Dictionary<string, double> { ["madeira"] = 10 }, null, tropas));
        Assert.Null(po.Buscar); Assert.Null(po.Levar);
    }

    [Fact]
    public void Previa_de_mover_reliquia_recusa_destino_alheio()
    {
        var t = new MundoTeste();
        var a = t.NovoReino(); var b = t.NovoReino();
        var ca = t.M.Locais[a.CasteloId];
        var alheio = t.M.LocaisDe(b.Id).First(l => l.Id != b.CasteloId);
        var rel = t.M.Reliquias.Adicionar(new Reliquia { Nome = "Cálice", Tipo = "producao", ReinoId = a.Id, LocalId = ca.Id });
        t.M.Reliquias.Adicionar(new Reliquia { Nome = "Pedra", Tipo = "resistencia", ReinoId = b.Id, LocalId = alheio.Id });
        var tropas = new Dictionary<string, int> { ["lanceiro"] = 2 };
        var e = Assert.Throws<RegraException>(() => VisaoValiosos.PreviaMover(t.M, a, rel.Id, ca.Id, tropas, alheio.Id));
        Assert.Equal(404, e.Status);
        var meu = t.M.LocaisDe(a.Id).First(l => l.Id != a.CasteloId);
        Assert.Equal(1, J(VisaoValiosos.PreviaMover(t.M, a, rel.Id, ca.Id, tropas, meu.Id)).GetProperty("depois").GetInt32());
    }

    // ---------------------------------------------------------------- hexágono livre pelo que o reino sabe (achado 10)

    [Fact]
    public void Motivo_de_torre_e_de_fundacao_nao_revela_jazida_oculta_nem_local_fora_da_vista()
    {
        var t = new MundoTeste();
        var a = t.NovoReino(); var b = t.NovoReino();
        var ca = t.M.Locais[a.CasteloId];
        var vis = Nevoas.VisiveisAgora(t.M, a.Id);
        var h = t.M.G.Area(ca.Hex, 2).First(x => vis.Contains(x) && Obras.HexLivre(t.M, x) && !t.M.Mapa.Rio[x]);
        var j = t.M.Jazidas.Adicionar(new ReinoDePedra.Jogo.Mapa.Jazida { Hex = h, Recurso = "prata", Inicial = 100, Restante = 100 });
        Assert.Null(ReinoDePedra.Jogo.Combate.Defesas.MotivoTorre(t.M, a, h));
        // a torre sobe sobre a jazida que ninguém do reino descobriu (ela segue oculta embaixo)
        new ReinoDePedra.Jogo.Combate.ObraTorre().Concluir(t.M, a, new ItemFila { Hex = h });
        Assert.NotNull(ReinoDePedra.Jogo.Combate.Defesas.NoHex(t.M, h));
        // descoberta, a jazida ocupa o hexágono para quem a conhece
        var h2 = t.M.G.Area(ca.Hex, 2).First(x => vis.Contains(x) && Obras.HexLivre(t.M, x) && !t.M.Mapa.Rio[x]);
        t.M.Jazidas.Adicionar(new ReinoDePedra.Jogo.Mapa.Jazida { Hex = h2, Recurso = "prata", Inicial = 100, Restante = 100, DescobertaPor = [a.Id] });
        Assert.Equal("O hexágono não está livre.", ReinoDePedra.Jogo.Combate.Defesas.MotivoTorre(t.M, a, h2));

        // explorado e fora da vista: um local novo de outro reino não aparece no motivo
        var longe = HexLonge(t, ca.Hex, 8);
        Nevoas.RevelarArea(t.M, a.Id, longe, 0);
        Assert.DoesNotContain(longe, Nevoas.VisiveisAgora(t.M, a.Id));
        var tipo = Obras.Fundaveis.First(kv => kv.Value.terrenos.Contains(t.M.Mapa.Terrenos[longe])).Key;
        var antes = Obras.MotivoNaoFundar(t.M, a, tipo, longe);
        t.M.AdicionarLocal(new Local { ReinoId = b.Id, Tipo = TipoLocal.Vila, Produz = "comida", Nivel = 1, Hex = longe, Nome = "Vila" });
        Assert.Equal(antes, Obras.MotivoNaoFundar(t.M, a, tipo, longe));
    }

    // ---------------------------------------------------------------- torres alheias no último estado conhecido (achado 18)

    [Fact]
    public void Torre_alheia_fora_da_vista_aparece_como_foi_vista()
    {
        var t = ComApi();
        var a = t.NovoReino(); var b = t.NovoReino();
        var cb = t.M.Locais[b.CasteloId];
        var th = t.M.G.Area(cb.Hex, 1).First(x => x != cb.Hex && Obras.HexLivre(t.M, x) && !t.M.Mapa.Rio[x]);
        var torre = t.M.Torres.Adicionar(new ReinoDePedra.Jogo.Combate.Torre { ReinoId = b.Id, Hex = th, Nivel = 1, Estrutura = ReinoDePedra.Jogo.Combate.Defesas.EstruturaCheia(t.M, 1) });
        Nevoas.RevelarArea(t.M, a.Id, th, 0);   // viu a torre no nível 1
        Assert.DoesNotContain(th, Nevoas.VisiveisAgora(t.M, a.Id));
        torre.Nivel = 3;
        JsonElement TorreNoMapa() => J(VisaoMapa.Montar(t.M, a)).GetProperty("objetos").EnumerateArray()
            .Single(o => o.GetProperty("tipo").GetString() == "torre" && o.GetProperty("hex").GetInt32() == th);
        Assert.Equal(1, TorreNoMapa().GetProperty("nivel").GetInt32());
        // derrubada fora da vista: continua no mapa até ser vista de novo
        t.M.Torres.Remover(torre);
        Assert.Equal(1, TorreNoMapa().GetProperty("nivel").GetInt32());
    }

    // ---------------------------------------------------------------- marchas alheias: só o trecho à vista (achado 11)

    [Fact]
    public void Marcha_alheia_vem_so_com_o_trecho_a_vista_sem_origem_nem_destino_na_nevoa()
    {
        var t = ComApi();
        var a = t.NovoReino(); var b = t.NovoReino();
        var ca = t.M.Locais[a.CasteloId]; var cb = t.M.Locais[b.CasteloId];
        var vis = Nevoas.VisiveisAgora(t.M, a.Id);
        Guarnecer(t, b, cb, "lanceiro", 4);
        var tropas = new Dictionary<string, int> { ["lanceiro"] = 4 };
        var vel = ReinoDePedra.Jogo.Reinos.Tropas.Velocidade(t.M, tropas);
        // um destino na névoa de A cujo caminho a partir de B atravessa a visão de A
        var destino = t.M.G.Area(ca.Hex, 7).Where(h => !vis.Contains(h) && !t.M.Mapa.Rio[h] && t.M.LocalNoHex(h) == null && t.M.G.Distancia(h, ca.Hex) >= 5)
            .First(h => Caminhos.Calcular(t.M, cb.Hex, h, vel) is var rr && rr.Hexes[^1] == h && rr.Hexes.Any(vis.Contains) && !vis.Contains(rr.Hexes[^2]));
        var ex = Exercitos.Enviar(t.M, b, cb.Id, tropas, destino, OrdemMover.Id);
        var k = ex.Caminho.FindIndex(vis.Contains);
        t.Avancar(TimeSpan.FromMilliseconds(ex.Tempos[k] - t.M.Agora + 1));
        var o = J(VisaoMapa.Montar(t.M, a)).GetProperty("objetos").EnumerateArray()
            .Single(x => x.GetProperty("tipo").GetString() == "marcha" && x.GetProperty("id").GetInt64() == ex.Id);
        var cm = Caminho(o);
        Assert.DoesNotContain(cb.Hex, cm);       // a origem (o castelo de B) não vai
        Assert.DoesNotContain(destino, cm);      // nem o destino na névoa
        Assert.Contains(o.GetProperty("hex").GetInt32(), cm);
        Assert.Equal(cm.Count, o.GetProperty("tempos").GetArrayLength());
        Assert.True(cm.Take(cm.Count - 1).All(vis.Contains));   // à vista, mais o próximo hexágono para animar
        Assert.False(o.TryGetProperty("progresso", out _));
    }

    // ---------------------------------------------------------------- ícone só para quem conhece o reino (achado 16)

    [Fact]
    public async Task Icone_proprio_so_e_servido_a_quem_conhece_o_reino()
    {
        await using var s = await ServidorTeste.Iniciar();
        using var a = s.NovoCliente(); using var b = s.NovoCliente();
        var ra = await a.ContaComReino("ana@exemplo.com", "Pedralva");
        var rb = await b.ContaComReino("bia@exemplo.com", "Valdren");
        var idA = ra.GetProperty("id").GetInt64(); var idB = rb.GetProperty("id").GetInt64();
        var png = new byte[64];
        new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, (byte)'I', (byte)'H', (byte)'D', (byte)'R', 0, 0, 0, 32, 0, 0, 0, 32 }.CopyTo(png, 0);
        var put = await a.Http.PutAsync("reino/icone", new ByteArrayContent(png) { Headers = { ContentType = new("image/png") } });
        Assert.True(put.IsSuccessStatusCode, put.StatusCode.ToString());
        Assert.Equal(System.Net.HttpStatusCode.OK, (await a.Http.GetAsync($"reinos/{idA}/icone")).StatusCode);    // o próprio
        Assert.Equal(System.Net.HttpStatusCode.NotFound, (await b.Http.GetAsync($"reinos/{idA}/icone")).StatusCode);   // não conhece
        await s.Motor.Executar(m => Conhecimento.Conhecer(m, m.Reinos[idB], m.Reinos[idA], "teste"));
        Assert.Equal(System.Net.HttpStatusCode.OK, (await b.Http.GetAsync($"reinos/{idA}/icone")).StatusCode);
    }

    // ---------------------------------------------------------------- nomes da IA sem padrão fixo (achado 17)

    [Fact]
    public void Nomes_da_IA_variam_de_forma_sem_padrao_fixo()
    {
        var t = new MundoTeste();
        var rng = new Rng(42);
        var nomes = new List<string>();
        for (var i = 0; i < 400; i++)
        {
            var n = ReinoDePedra.Jogo.IA.Nomes.Novo(t.M, rng);
            Assert.Null(CriacaoReino.MotivoNomeInvalido(t.M, n));
            nomes.Add(n);
        }
        var distintos = nomes.Distinct(StringComparer.OrdinalIgnoreCase).Count();
        Assert.True(distintos >= nomes.Count * 0.9, "distintos: " + distintos);   // espaço grande: pouco se repete (os ativos nunca)
        // formas variadas: uma palavra, duas, três ou mais
        var palavras = nomes.GroupBy(n => Math.Min(3, n.Split(' ').Length)).ToDictionary(g => g.Key, g => g.Count() / (double)nomes.Count);
        Assert.All(new[] { 1, 2, 3 }, k => Assert.True(palavras.GetValueOrDefault(k) >= 0.15, $"{k} palavra(s): {palavras.GetValueOrDefault(k):P0}"));
        // nenhum punhado de palavras iniciais domina (antes, 16 "lugares" abriam 60% dos nomes)
        var primeiras = nomes.GroupBy(n => n.Split(' ')[0].ToLowerInvariant()).OrderByDescending(g => g.Count()).Take(16).Sum(g => g.Count());
        Assert.True(primeiras <= nomes.Count * 0.35, $"as 16 primeiras palavras mais comuns abrem {primeiras} de {nomes.Count}");
        // nem todo nome é capitalizado nem acentuado como num gerador
        Assert.Contains(nomes, n => char.IsLower(n[0]));
    }
}
