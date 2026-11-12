using System.Text.Json;
using ReinoDePedra.Api;
using ReinoDePedra.Api.Visoes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Pessoas;
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
        foreach (var s in RegistroApi.Sistemas) s(t.M);
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
        Pessoas.RemoverCivis(t.M, r, t.B.U[unidade].Pop * n);
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
        var alvo = HexLonge(t, c.Hex, 12);
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
        var pa = new VisaoCombate.PedidoAtaque(c.Id, null, tropas, alvo, null, null, null, null, null, null, true);
        var pv = J(VisaoCombate.Previa(t.M, r, pa, alvo));
        Assert.Equal(curtaVel, Caminho(pv.GetProperty("segura")));

        // viagem das prévias de extração e relíquia
        var vg = J(VisaoValiosos.Viagem(t.M, r.Id, c.Hex, alvo, vel, ReinoDePedra.Jogo.Reinos.Tropas.ForcaFauna(t.M, tropas)));
        Assert.Equal(curtaVel, Caminho(vg.GetProperty("segura")));

        // caravana segura até um local próprio do outro lado
        var dest = t.M.AdicionarLocal(new Local { ReinoId = r.Id, Tipo = TipoLocal.Armazem, Nivel = 1, Hex = HexLonge(t, alvo, 2), Nome = "Armazém" });
        t.DarRecursos(r, 100);
        var plano = Caravanas.Planejar(t.M, r, new PedidoCaravana(c.Id, dest.Id, new Dictionary<string, double> { ["madeira"] = 10 }, null, tropas, c.Id, true));
        Assert.Equal(Caminhos.Calcular(t.M, c.Hex, dest.Hex, plano.Vel).Hexes, plano.Levar!.Hexes);
    }

    // ---------------------------------------------------------------- prévia e envio de ataque na névoa

    [Fact]
    public void Previa_e_ataque_valem_na_nevoa_e_mostram_o_dono_mas_nao_a_guarnicao()
    {
        var t = new MundoTeste();
        var a = t.NovoReino(); var b = t.NovoReino();
        a.EscudoAte = 0; b.EscudoAte = 0;
        var ca = t.M.Locais[a.CasteloId];
        var cb = t.M.Locais[b.CasteloId];
        Assert.False(Nevoas.Explorado(t.M, a.Id, cb.Hex));
        Guarnecer(t, a, ca, "lanceiro", 8);
        cb.Guarnicao["arqueiro"] = 3;
        var tropas = new Dictionary<string, int> { ["lanceiro"] = 4 };
        VisaoCombate.PedidoAtaque P(int h) => new(ca.Id, null, tropas, h, null, null, null, null, null, null, false);
        var pv = J(VisaoCombate.Previa(t.M, a, P(cb.Hex), cb.Hex));
        var alvo = pv.GetProperty("alvo");
        Assert.Equal("outro", alvo.GetProperty("dono").GetString());
        Assert.Equal(b.Nome, alvo.GetProperty("reino").GetProperty("nome").GetString());
        Assert.False(alvo.GetProperty("aoVivo").GetBoolean());
        // fora da vista e sem espionagem: a guarnição, o estoque e a milícia não vêm
        var forca = pv.GetProperty("forcaInimiga");
        Assert.Equal("nenhuma", forca.GetProperty("fonte").GetString());
        foreach (var k in new[] { "guarnicao", "tropas", "tropasAprox", "milicia", "civis", "defesa", "estoque" }) Assert.False(forca.TryGetProperty(k, out _), k);
        // hexágono vazio responde que não há local, e o envio vale
        var vazio = t.M.G.Area(cb.Hex, 6).First(h => t.M.LocalNoHex(h) == null);
        Assert.Throws<RegraException>(() => VisaoCombate.Previa(t.M, a, P(vazio), vazio));
        var ex = Exercitos.Enviar(t.M, a, ca.Id, tropas, cb.Hex, ReinoDePedra.Jogo.Combate.OrdemAtacar.Id, false, VisaoCombate.Dados(P(cb.Hex)));
        Assert.Equal(cb.Id, ex.AlvoLocalId);

        // o estado é o atual, em qualquer ponto do mapa: não há foto
        var vila = t.M.LocaisDe(b.Id).First(l => l.Id != b.CasteloId);
        Assert.DoesNotContain(vila.Hex, Nevoas.VisiveisAgora(t.M, a.Id));
        t.M.MudarDono(vila, 0); vila.Ruina = true;
        var ruina = J(VisaoCombate.Previa(t.M, a, P(vila.Hex), vila.Hex)).GetProperty("alvo");
        Assert.Equal("livre", ruina.GetProperty("dono").GetString());
        Assert.Equal("Ruína", ruina.GetProperty("nome").GetString());
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
    public void Motivo_de_torre_e_de_fundacao_nao_revela_jazida_oculta_e_local_fora_da_vista_conta_como_ocupado()
    {
        var t = new MundoTeste();
        var a = t.NovoReino(); var b = t.NovoReino();
        var ca = t.M.Locais[a.CasteloId];
        var vis = Nevoas.VisiveisAgora(t.M, a.Id);
        var h = t.M.G.Area(ca.Hex, 4).First(x => vis.Contains(x) && Obras.HexLivre(t.M, x) && !t.M.Mapa.Rio[x]);
        var j = t.M.Jazidas.Adicionar(new ReinoDePedra.Jogo.Mapa.Jazida { Hex = h, Recurso = "prata", Inicial = 100, Restante = 100 });
        Assert.Null(ReinoDePedra.Jogo.Combate.Defesas.MotivoTorre(t.M, a, h));
        // a torre sobe sobre a jazida que ninguém do reino descobriu (ela segue oculta embaixo)
        new ReinoDePedra.Jogo.Combate.ObraTorre().Concluir(t.M, a, new ItemFila { Hex = h });
        Assert.NotNull(ReinoDePedra.Jogo.Combate.Defesas.NoHex(t.M, h));
        // descoberta, a jazida ocupa o hexágono para quem a conhece
        var h2 = t.M.G.Area(ca.Hex, 4).First(x => vis.Contains(x) && Obras.HexLivre(t.M, x) && !t.M.Mapa.Rio[x]);
        t.M.Jazidas.Adicionar(new ReinoDePedra.Jogo.Mapa.Jazida { Hex = h2, Recurso = "prata", Inicial = 100, Restante = 100, DescobertaPor = [a.Id] });
        Assert.Equal("O hexágono não está livre.", ReinoDePedra.Jogo.Combate.Defesas.MotivoTorre(t.M, a, h2));

        // explorado e fora da vista: local de outro reino é público, e o motivo diz que o hexágono está ocupado
        var (longe, tipo) = Enumerable.Range(0, 60).Select(p => HexLonge(t, ca.Hex, 16, p))
            .SelectMany(x => Obras.Fundaveis.Keys.Select(k => (hex: x, tipo: k)))
            .First(x => { Nevoas.RevelarArea(t.M, a.Id, x.hex, 1); return Obras.MotivoNaoFundar(t.M, a, x.tipo, x.hex) == null; });
        Assert.DoesNotContain(longe, Nevoas.VisiveisAgora(t.M, a.Id));
        Assert.Null(Obras.MotivoNaoFundar(t.M, a, tipo, longe));
        t.M.AdicionarLocal(new Local { ReinoId = b.Id, Tipo = TipoLocal.Vila, Produz = "comida", Nivel = 1, Hex = longe, Nome = "Vila" });
        Assert.NotNull(Obras.MotivoNaoFundar(t.M, a, tipo, longe));
    }

    // ---------------------------------------------------------------- torres alheias são públicas, ao vivo

    [Fact]
    public void Torre_alheia_aparece_ao_vivo_na_nevoa()
    {
        var t = ComApi();
        var a = t.NovoReino(); var b = t.NovoReino();
        var cb = t.M.Locais[b.CasteloId];
        var th = t.M.G.Area(cb.Hex, 2).First(x => x != cb.Hex && Obras.HexLivre(t.M, x) && !t.M.Mapa.Rio[x]);
        var torre = t.M.Torres.Adicionar(new ReinoDePedra.Jogo.Combate.Torre { ReinoId = b.Id, Hex = th, Nivel = 1, Estrutura = ReinoDePedra.Jogo.Combate.Defesas.EstruturaCheia(t.M, 1) });
        Assert.False(Nevoas.Explorado(t.M, a.Id, th));
        IEnumerable<JsonElement> Torres() => J(VisaoMapa.Montar(t.M, a)).GetProperty("objetos").EnumerateArray()
            .Where(o => o.GetProperty("tipo").GetString() == "torre" && o.GetProperty("hex").GetInt32() == th);
        Assert.Equal(1, Assert.Single(Torres()).GetProperty("nivel").GetInt32());
        Assert.Equal(b.Id, Assert.Single(Torres()).GetProperty("reinoId").GetInt64());
        torre.Nivel = 3;
        Assert.Equal(3, Assert.Single(Torres()).GetProperty("nivel").GetInt32());
        t.M.Torres.Remover(torre);
        Assert.Empty(Torres());
    }

    // ---------------------------------------------------------------- marchas alheias: só o passo atual

    [Fact]
    public void Marcha_alheia_vem_so_com_o_passo_atual_sem_tamanho_nem_destino()
    {
        var t = ComApi();
        var a = t.NovoReino(); var b = t.NovoReino();
        var cb = t.M.Locais[b.CasteloId];
        Guarnecer(t, b, cb, "lanceiro", 4);
        var tropas = new Dictionary<string, int> { ["lanceiro"] = 4 };
        var destino = t.M.G.Area(cb.Hex, 8).First(h => t.M.G.Distancia(h, cb.Hex) == 8 && !t.M.Mapa.Rio[h] && t.M.LocalNoHex(h) == null);
        var ex = Exercitos.Enviar(t.M, b, cb.Id, tropas, destino, OrdemMover.Id);
        Assert.True(ex.Caminho.Count > 3);
        var k = ex.Caminho.Count / 2;
        t.Avancar(TimeSpan.FromMilliseconds(ex.Tempos[k] - t.M.Agora + 1));
        // na névoa de A: a marcha vai igual, com o hexágono atual e o próximo
        var hexAgora = ex.HexEm(t.M.Agora);
        Assert.DoesNotContain(hexAgora, Nevoas.VisiveisAgora(t.M, a.Id));
        var o = J(VisaoMapa.Montar(t.M, a)).GetProperty("objetos").EnumerateArray()
            .Single(x => x.GetProperty("tipo").GetString() == "marcha" && x.GetProperty("id").GetInt64() == ex.Id);
        var cm = Caminho(o);
        Assert.Equal(2, cm.Count);
        Assert.Equal(hexAgora, cm[0]);
        Assert.Equal(hexAgora, o.GetProperty("hex").GetInt32());
        Assert.Equal(ex.Caminho[ex.Caminho.IndexOf(hexAgora) + 1], cm[1]);
        Assert.Equal(2, o.GetProperty("tempos").GetArrayLength());
        Assert.Equal(b.Id, o.GetProperty("reinoId").GetInt64());
        Assert.Equal("exercito", o.GetProperty("marcha").GetString());
        Assert.DoesNotContain(cb.Hex, cm);       // a origem não vai
        Assert.DoesNotContain(destino, cm);      // nem o destino
        var chaves = o.EnumerateObject().Select(x => x.Name).ToHashSet();
        foreach (var segredo in new[] { "tamanho", "destino", "paraMim", "tropas", "resumo", "carga", "cargaMax", "cargaUsada", "pessoas", "pessoaIds", "ordem", "alvo", "chegada", "progresso" })
            Assert.DoesNotContain(segredo, chaves);
    }

    [Fact]
    public void Batedor_de_elite_em_marcha_nao_aparece_para_os_outros()
    {
        var t = ComApi();
        var a = t.NovoReino(); var b = t.NovoReino();
        var cb = t.M.Locais[b.CasteloId];
        b.ExploradoresLivres["batedor"] = 1;
        var destino = t.M.G.Area(cb.Hex, 6).First(h => t.M.G.Distancia(h, cb.Hex) == 6 && !t.M.Mapa.Rio[h] && t.M.LocalNoHex(h) == null);
        var e = Exploradores.Enviar(t.M, b, "batedor", Exploradores.Explorar, destino);
        Assert.DoesNotContain(J(VisaoMapa.Montar(t.M, a)).GetProperty("objetos").EnumerateArray(), x => x.GetProperty("tipo").GetString() == "marcha" && x.GetProperty("id").GetInt64() == e.Id);
        Assert.Contains(J(VisaoMapa.Montar(t.M, b)).GetProperty("objetos").EnumerateArray(), x => x.GetProperty("tipo").GetString() == "marcha" && x.GetProperty("id").GetInt64() == e.Id);
    }

    // ---------------------------------------------------------------- ícone do reino (identidade é pública)

    [Fact]
    public async Task Icone_proprio_e_publico()
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
        Assert.Equal(System.Net.HttpStatusCode.OK, (await b.Http.GetAsync($"reinos/{idA}/icone")).StatusCode);    // o de outro jogador
        using var anonimo = s.NovoCliente();
        Assert.Equal(System.Net.HttpStatusCode.OK, (await anonimo.Http.GetAsync($"reinos/{idA}/icone")).StatusCode);   // sem conta também: o mapa ao vivo mostra a imagem
        var mundo = JsonDocument.Parse(await anonimo.Http.GetStringAsync("publico/mundo")).RootElement;
        var reinoA = mundo.GetProperty("reinos").EnumerateArray().Single(r => r.GetProperty("id").GetInt64() == idA);
        Assert.True(reinoA.GetProperty("iconeProprio").GetBoolean());
        Assert.False(mundo.GetProperty("reinos").EnumerateArray().Single(r => r.GetProperty("id").GetInt64() == idB).TryGetProperty("iconeProprio", out _));
        Assert.Equal(System.Net.HttpStatusCode.NotFound, (await b.Http.GetAsync($"reinos/{idB}/icone")).StatusCode);   // sem imagem própria
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
