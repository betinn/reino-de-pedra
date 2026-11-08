using System.Text.Json.Nodes;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Api.Visoes;

/// <summary>
/// Exploração para o cliente: exploradores (livres, em treino, em campo), prisioneiros, fauna conhecida, prévia de
/// caminho com risco de fauna e o que vai para o mapa (foto envelhecida, fauna, perigo, avistamentos, espionagem).
/// Tudo pelo que o reino sabe: perigo e objetos fora da visão vêm da foto da névoa, nunca do estado real.
/// </summary>
public static class VisaoExploracao
{
    public static object Montar(Mundo m, Reino r)
    {
        Economia.Atualizar(m, r);
        var agora = m.Agora;
        var emTreino = Exploradores.EmTreino(r).ToList();
        var castelo = m.Locais.Obter(r.CasteloId);
        return new
        {
            agora,
            tipos = m.P.Exploradores.Select(kv => new
            {
                id = kv.Key, nome = Exploradores.NomeTipo(m, kv.Key), curto = kv.Value.Nome, kv.Value.Custo, kv.Value.Tempo, kv.Value.Vel,
                kv.Value.Visao, kv.Value.Forca, kv.Value.Jazidas,
                livres = r.ExploradoresLivres.GetValueOrDefault(kv.Key),
                emTreino = emTreino.Where(i => i.Param == kv.Key).Sum(i => i.Restantes),
                emCampo = Exploradores.De(m, r.Id).Count(e => e.TipoExp == kv.Key),
            }).ToList(),
            exploradores = Exploradores.De(m, r.Id).OrderBy(e => e.Id).Select(e => Explorador(m, e)).ToList(),
            emTreino = emTreino.Select(i => VisaoReino.Item(m, r, i)).ToList(),
            castelo = castelo == null ? null : new { castelo.Id, castelo.Hex, castelo.Nome, guarnicao = castelo.Guarnicao },
            presos = Capturas.PresosPor(m, r.Id).OrderBy(p => p.Ate).Select(p => new
            {
                p.Id, p.TipoExp, nome = Exploradores.NomeTipo(m, p.TipoExp), pessoa = p.Nome, p.Hex, c = m.G.C(p.Hex), l = m.G.L(p.Hex), p.Quando, p.Ate, p.Estado,
                resgate = p.Resgate.Arredondado(),
                origem = m.Reinos.Obter(p.DonoId) is { } d ? Espionagem.Identidade(d) : null,
                oferta = p.Oferta.Count > 0 ? p.Oferta.Arredondado() : null, p.OfertaEm,
                ofertaValor = p.Oferta.Count > 0 ? Math.Round(Jogo.Social.Remessas.Valor(m, p.Oferta)) : (double?)null,
                resgateValor = p.Resgate.Count > 0 ? Math.Round(Jogo.Social.Remessas.Valor(m, p.Resgate)) : (double?)null,
                pagamento = Capturas.PagamentoACaminho(m, p),
                cela = Capturas.Onde(m, p) is { } cl ? new { cl.Id, cl.Nome, cl.Hex } : null,
            }).ToList(),
            capturados = Capturas.PresosDe(m, r.Id).OrderBy(p => p.Ate).Select(p => new
            {
                p.Id, p.TipoExp, nome = Exploradores.NomeTipo(m, p.TipoExp), pessoa = p.Nome, p.Hex, c = m.G.C(p.Hex), l = m.G.L(p.Hex), p.Quando, p.Ate, p.Estado,
                resgate = p.Estado == Capturas.ResgatePedido ? p.Resgate.Arredondado() : null,
                // quem capturou só aparece se ele se revelou: pediu resgate, aceitou a oferta ou um batedor o viu com o preso
                captor = (p.CaptorRevelado || p.Estado == Capturas.ResgatePedido) && m.Reinos.Obter(p.CaptorId) is { } c ? Espionagem.Identidade(c) : null,
                oferta = p.Oferta.Count > 0 ? p.Oferta.Arredondado() : null, p.OfertaEm,
                pagamento = Capturas.PagamentoACaminho(m, p),
                // onde está preso: só se o dono sabe (pego espionando aquele local, ou um batedor o viu lá)
                cela = p.LocalConhecido && Capturas.Onde(m, p) is { } cl ? new { cl.Hex, c = m.G.C(cl.Hex), l = m.G.L(cl.Hex), nome = Jogo.Combate.Ataques.NomeAlvo(cl) } : null,
                levado = !p.LocalConhecido && Capturas.Onde(m, p) is { } cl2 && cl2.Hex != p.Hex ? m.G.Direcao(p.Hex, cl2.Hex) : null,
            }).ToList(),
            bandos = Bandos(m, r),
            regras = new
            {
                limites = m.P.Fauna, ataque = m.P.AtaqueFauna, perda = m.P.PerdaFauna, voltaH = m.P.FaunaVoltaH, cacaMin = m.P.CacaMin,
                caca = m.P.Caca, espiao = m.P.Espiao, resgateH = m.P.ResgateH, avistamentoH = m.P.AvistamentoH, maxPontos = m.P.Patrulha.MaxHexes,
                rota = m.P.Rota, ponte = m.P.Ponte, terreno = m.P.Terreno, rotaFator = m.P.RotaFator, valor = m.P.Valor,
            },
        };
    }

    public static object Explorador(Mundo m, Explorador e) => new
    {
        e.Id, e.TipoExp, nome = e.NomeTipo(m), e.Ordem, e.Alvo, alvoC = m.G.C(e.Alvo), alvoL = m.G.L(e.Alvo), e.Pontos,
        hex = e.HexEm(m.Agora), e.Destino, e.Partida, e.Chegada, e.Caminho, e.Tempos, e.Retornando, e.Seguro, e.Vel,
        escolta = e.Tropas, e.EspionandoAte, e.HexesRevelados, e.JazidasAchadas, e.Circuito,
        // início da espionagem (Espionagem: EspionandoAte = chegada + P.espiao.tempoNoLocal), para a barra de tempo
        espionandoDesde = e.EspionandoAte is long ate ? ate - T.DeSegundos(m.P.Espiao.TempoNoLocal) : (long?)null,
        estado = e.EspionandoAte != null ? "espionando" : e.Ordem == Exploradores.Aguardar ? "parado" : e.Retornando ? "retornando" : "marchando",
    };

    /// <summary>Bandos que o reino conhece: à vista agora (posição real) ou pela foto da névoa (centro da região, com a idade).</summary>
    public static List<object> Bandos(Mundo m, Reino r, HashSet<int>? vis = null)
    {
        vis ??= Nevoas.VisiveisAgora(m, r.Id);
        var nevoa = Nevoas.De(m, r.Id);
        var l = new List<object>();
        foreach (var rg in m.Faunas)
        {
            if (!rg.Abatido && vis.Contains(rg.Hex))
            {
                var n = Fauna.NivelEm(m, rg, rg.Hex);
                l.Add(new { id = rg.Id, rg.Animal, nivel = Fauna.NomeDe(Math.Max(1, n)), hex = rg.Hex, vivo = true, qtd = rg.Qtd, visto = m.Agora, idadeMin = 0 });
                continue;
            }
            var nf = Fotos.PerigoConhecido(m, r.Id, rg.Centro);
            if (nf == 0 || Fotos.AnimalConhecido(m, r.Id, rg.Centro) != rg.Animal) continue;
            var visto = Nevoas.Instante(m, nevoa.MinutoVisto(rg.Centro));
            l.Add(new { id = rg.Id, rg.Animal, nivel = Fauna.NomeDe(nf), hex = rg.Centro, vivo = false, qtd = (int?)null, visto, idadeMin = (m.Agora - visto) / T.Min });
        }
        return l;
    }

    /// <summary>Risco da fauna que o reino conhece ao longo de um caminho, para um grupo com a força dada.</summary>
    public static object Risco(Mundo m, Reino r, IReadOnlyList<int> caminho, double forca)
    {
        var pior = 0; string? animal = null; string piorRisco = "nenhum"; var trechos = 0; var dentro = false;
        var ordem = new[] { "nenhum", "baixo", "medio", "alto" };
        for (var i = 1; i < caminho.Count; i++)
        {
            var n = Fotos.PerigoConhecido(m, r.Id, caminho[i]);
            if (n == 0) { dentro = false; continue; }
            if (!dentro) { trechos++; dentro = true; }
            var risco = m.F.RiscoFauna(Fauna.NomeDe(n)!, forca);
            if (Array.IndexOf(ordem, risco) > Array.IndexOf(ordem, piorRisco) || (risco == piorRisco && n > pior))
            { piorRisco = risco; pior = n; animal = Fotos.AnimalConhecido(m, r.Id, caminho[i]); }
            else if (pior == 0) { pior = n; animal = Fotos.AnimalConhecido(m, r.Id, caminho[i]); }
        }
        return new
        {
            nivel = Fauna.NomeDe(pior), animal, risco = piorRisco, trechos,
            chance = piorRisco == "nenhum" ? 0 : m.P.AtaqueFauna[piorRisco],
            limite = pior > 0 ? m.P.Fauna[Fauna.NomeDe(pior)!] : (double?)null,
        };
    }

    /// <summary>Prévia de caminho (curto e seguro) para um explorador (com escolta opcional) ou um grupo de tropas.</summary>
    public static object Previa(Mundo m, Reino r, int de, int para, string? tipo, IReadOnlyDictionary<string, int> grupo, IReadOnlyList<int>? pontos = null)
    {
        OpcoesCaminho Op(bool seguro) => tipo != null
            ? Exploradores.Opcoes(m, r.Id, tipo, grupo, seguro)
            : new OpcoesCaminho { Seguro = seguro, Forca = GT.ForcaFauna(m, grupo), ReinoId = r.Id };
        var vel = tipo != null ? Exploradores.Velocidade(m, tipo, grupo) : GT.Velocidade(m, grupo);
        var forca = Op(false).Forca;
        object Rota(bool seguro)
        {
            // com pontos, é o caminho que a marcha fará: de ponto em ponto, emendado
            var hexes = new List<int> { de };
            var total = 0.0;
            var ok = true;
            foreach (var p in pontos ?? [para])
            {
                if (p == hexes[^1]) continue;
                var rota = Caminhos.Calcular(m, hexes[^1], p, vel, Op(seguro));
                if (rota.Hexes[^1] != p) { ok = false; break; }
                hexes.AddRange(rota.Hexes.Skip(1));
                total += rota.TotalMin;
            }
            return new
            {
                ok, min = ok ? Math.Round(total, 1) : (double?)null, hexes = ok ? hexes.Count : 0, caminho = ok ? hexes : null,
                rotas = ok ? hexes.Count(h => m.Vias.Rotas.Contains(h)) : 0,
                risco = ok ? Risco(m, r, hexes, forca) : null,
            };
        }
        object? espiao = null;
        var l = m.LocalNoHex(para);
        if (tipo == Exploradores.Batedor && l != null && l.ReinoId != r.Id && l.ReinoId != 0 && Nevoas.Explorado(m, r.Id, para))
        {
            var antigo = r.LocaisEspionados.GetValueOrDefault(l.Id);
            espiao = new
            {
                localId = l.Id, nome = l.Tipo.NomeGenerico(),
                estimativa = antigo != null ? Math.Round(m.F.ChanceEspiao(antigo.Torres, antigo.Tropas), 3) : (double?)null,
                antigo = antigo == null ? null : new { antigo.Tropas, antigo.Torres, antigo.Quando },
            };
        }
        return new { vel, forca, pop = (tipo != null ? 1 : 0) + GT.Pop(m, grupo), carga = GT.Carga(m, grupo), curta = Rota(false), segura = Rota(true), espiao };
    }

    // ---------------------------------------------------------------- mapa

    private static readonly string[] NiveisChar = ["0", "1", "2", "3"];

    /// <summary>Objetos do mapa: foto das áreas fora da visão, espionagem, fauna à vista, perigo conhecido e avistamentos.</summary>
    public static IEnumerable<object> Mapa(Mundo m, Reino r, HashSet<int> vis)
    {
        var l = new List<object>();
        var nevoa = Nevoas.De(m, r.Id);
        var foto = Fotos.De(m, r.Id);
        // rumores (decisão 0035): a região de cada reino, desde o início, e a poeira das marchas grandes fora da vista
        foreach (var rg in Rumores.Regioes(m, r.Id))
            l.Add(new { tipo = "regiao-reino", id = rg.Chave, hex = rg.Centro, raio = rg.Raio });
        foreach (var ra in Rumores.Rastros(m, r.Id, vis, outro => VisaoMapa.Aliado(m, r, outro)))
            l.Add(new { tipo = "rastro", hex = ra.Hex, tamanho = ra.Tamanho, rumo = ra.Rumo, rumoHex = ra.RumoHex });
        // último estado conhecido: locais de outros reinos, ruínas antigas e o que outros sistemas fotografam
        var locaisVistos = new HashSet<long>();   // a foto guarda o local em cada hexágono da pegada; o desenho é um só, no centro
        foreach (var (h, objs) in foto.Objetos)
        {
            if (vis.Contains(h) || nevoa.MinutoVisto(h) == 0) continue;
            var visto = Nevoas.Instante(m, nevoa.MinutoVisto(h));
            foreach (var o in objs)
            {
                if (o["tipo"]?.GetValue<string>() == "local" && m.LocalNoHex(h) is { } atual && (atual.ReinoId == r.Id || VisaoMapa.Aliado(m, r, atual.ReinoId))) continue;   // virou seu (ou é de aliado: vem ao vivo)
                var c = (JsonObject)o.DeepClone();
                c["hex"] = h; c["foto"] = true; c["visto"] = visto;
                if (o["tipo"]?.GetValue<string>() == "local")
                {
                    var id = o["id"]?.GetValue<long>() ?? 0;
                    var real = m.Locais.Obter(id);
                    if (real != null && vis.Contains(real.Hex)) continue;   // o centro está à vista: o local já vai ao vivo
                    if (!locaisVistos.Add(id)) continue;
                    if (real != null)
                    {
                        c["hex"] = real.Hex;
                        c["ocupa"] = new JsonArray(Jogo.Mapa.Pegada.DoLocal(m, real).Select(x => (JsonNode)x).ToArray());
                    }
                }
                l.Add(c);
            }
        }
        // o que a espionagem revelou (dono e nível), com a data
        foreach (var (lid, info) in r.LocaisEspionados)
        {
            if (m.Locais.Obter(lid) is not { } loc) continue;
            var dono = m.Reinos.Obter(info.DonoId);
            l.Add(new
            {
                tipo = "espionado", hex = loc.Hex, localId = lid, nivel = info.Nivel, quando = info.Quando, tropas = info.Tropas, torres = info.Torres,
                dono = dono != null ? Espionagem.Identidade(dono) : null,
            });
        }
        // fauna à vista, e as placas de perigo das regiões conhecidas
        foreach (var rg in m.Faunas)
        {
            if (!rg.Abatido && vis.Contains(rg.Hex))
            {
                l.Add(new { tipo = "fauna", id = rg.Id, hex = rg.Hex, animal = rg.Animal, nivel = Fauna.NomeDe(Math.Max(1, Fauna.NivelEm(m, rg, rg.Hex))), qtd = rg.Qtd, aoVivo = true });
                continue;
            }
            var nf = Fotos.PerigoConhecido(m, r.Id, rg.Centro);
            if (nf == 0 || Fotos.AnimalConhecido(m, r.Id, rg.Centro) != rg.Animal) continue;
            var mv = nevoa.MinutoVisto(rg.Centro);
            l.Add(new { tipo = "perigo", id = rg.Id, hex = rg.Centro, animal = rg.Animal, nivel = Fauna.NomeDe(nf), visto = Nevoas.Instante(m, mv), foto = !vis.Contains(rg.Centro), aoVivo = false });
        }
        // camada Perigo: um caractere por hexágono (0 a 3; "?" nunca visto) e o animal (l, j, u, c)
        var g = m.G;
        var niveis = new char[g.Total]; var animais = new char[g.Total];
        for (var h = 0; h < g.Total; h++)
        {
            if (nevoa.MinutoVisto(h) == 0) { niveis[h] = '?'; animais[h] = '.'; continue; }
            var b = foto.Perigo.Length > h ? foto.Perigo[h] : (byte)0;
            niveis[h] = NiveisChar[b & 3][0];
            var a = (b >> 2) - 1;
            animais[h] = a >= 0 && a < Fauna.Animais.Length ? Fauna.Animais[a][0] : '.';
        }
        l.Add(new { tipo = "camada-perigo", niveis = new string(niveis), animais = new string(animais) });
        foreach (var a in Avistamentos.De(m, r.Id))
            l.Add(new { tipo = "avistamento", id = a.Id, hex = a.Hex, avistado = a.Tipo, a.Quando, a.Ate });
        return l;
    }
}
