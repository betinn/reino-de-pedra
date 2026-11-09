using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Valiosos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.IA;

/// <summary>
/// O que a IA faz numa sessão, sempre pelos mesmos serviços que a API usa (Obras, Recrutamento, Exercitos, Exploradores,
/// Extracoes, Comercio...), com os mesmos timers, recursos, população e limites: nada é criado do nada. A economia segue as
/// regras de decisão da simulação de <c>balanceamento/modelo.js</c> (fila de obras até o horizonte, moradia quando faltam
/// trabalhadores, novos locais no ritmo do perfil, castelo quando um local o alcança, melhor retorno entre os locais;
/// recrutamento com uma fração do estoque e do teto). A informação usada é só a que um jogador teria: o mapa que o reino vê
/// (névoa e foto), relatórios de espionagem e o próprio reino.
/// </summary>
public static class Governo
{
    private static readonly Dictionary<string, string> FundarPorRecurso = new()
    {
        ["comida"] = "vila", ["madeira"] = "serraria", ["pedra"] = "pedreira", ["ferro"] = "mina",
    };

    /// <summary>Acerto inicial de um reino de IA recém-criado (posturas do perfil).</summary>
    public static void Preparar(Mundo m, Reino r)
    {
        if (r.PerfilIA == "saqueador")
            foreach (var l in m.LocaisDe(r.Id)) { l.Postura = Postura.AtacarQuemAtacar; m.Sujar(l); }
    }

    public static void Sessao(Mundo m, Reino r, Conduta c)
    {
        var castelo = m.Locais.Obter(r.CasteloId);
        if (castelo == null || castelo.Ruina || castelo.ReinoId != r.Id) return;
        // a fila aceita item sem recurso, mas a IA (e a regência) só pede o que pode pagar: nada de fila cheia de item parado
        var antes = m.ExigirRecursos;
        m.ExigirRecursos = true;
        try { Decidir(m, r, c, castelo); }
        finally { m.ExigirRecursos = antes; }
    }

    private static void Decidir(Mundo m, Reino r, Conduta c, Local castelo)
    {
        Economia.Atualizar(m, r);
        Filas.Avaliar(m, r);
        if (r.EhIA) DesistirDoParado(m, r);
        Nevoas.VisiveisAgora(m, r.Id);   // olha o mapa, como o jogador ao abrir o jogo
        Tentar(() => Defender(m, r, c));
        if (!c.Regencia) Tentar(() => Comerciante.Responder(m, r, c));
        Tentar(() => Construir(m, r, c, castelo));
        Tentar(() => ExploradoresParados(m, r, castelo, c.Regencia));
        Tentar(() => Recrutar(m, r, c, castelo));
        Tentar(() => Curar(m, r));   // a regência também cura: guarda o reino para quem volta
        if (c.Regencia) return;
        Tentar(() => Prisioneiros(m, r));
        Tentar(() => Explorar(m, r, castelo));
        Tentar(() => Cacar(m, r, castelo));
        Tentar(() => Coletar(m, r, castelo));
        if (c.Perfil is { } p)
        {
            if (p.Torres > 0) Tentar(() => Torres(m, r, p, castelo));
            if (p.Prospecta) Tentar(() => Extrair(m, r, castelo));
            if (p.Ocupa) Tentar(() => Ocupar(m, r, castelo));
            if (p.Espiona) Tentar(() => Espionar(m, r, castelo));
            if (p.Ataca) Tentar(() => Atacar(m, r, castelo));
        }
    }

    /// <summary>Uma decisão que esbarra numa regra (fila cheia, falta recurso...) só deixa de acontecer, como para o jogador.</summary>
    private static void Tentar(Action a) { try { a(); } catch (RegraException) { } }

    /// <summary>
    /// Item da vez que perdeu o material (saque, comércio) há mais de um dia: a IA desiste, como um jogador faria, para ele não
    /// segurar a fila e os recursos. Só o reino de IA: a regência não mexe no que o jogador deixou na fila.
    /// </summary>
    public static void DesistirDoParado(Mundo m, Reino r)
    {
        var limite = m.Agora - T.Dia;
        foreach (var (nome, fila) in r.Filas.ToList())
            if (fila.Itens.Count > 0 && fila.Itens[0] is { Aguardando: true } it && it.CriadoEm < limite)
                Filas.Cancelar(m, r, nome, it.Id);
    }

    // ---------------------------------------------------------------- feridos e prisioneiros

    /// <summary>Feridos no castelo: põe na fila de cura os que as ervas pagam (um item por vez, como o jogador faria).</summary>
    public static void Curar(Mundo m, Reino r)
    {
        if (Feridos.Total(r) == 0 || Feridos.EmCura(r) > 0 || Feridos.Podem(m, r) <= 0) return;
        Feridos.Curar(m, r);
    }

    /// <summary>
    /// Exploradores que o reino capturou: o saqueador executa, o comerciante pede resgate (o custo do explorador, com margem),
    /// os outros libertam. Decide na primeira sessão depois da captura, dentro do prazo de 24 h.
    /// </summary>
    public static void Prisioneiros(Mundo m, Reino r)
    {
        foreach (var p in Capturas.PresosPor(m, r.Id).Where(x => x.Estado == Capturas.Preso).ToList())
        {
            if (r.PerfilIA == "saqueador") { Tentar(() => Capturas.Decidir(m, r, p.Id, "executar")); continue; }
            if (r.PerfilIA == "comerciante" && m.P.Exploradores.TryGetValue(p.TipoExp, out var x))
            {
                var pedido = x.Custo.ToDictionary(kv => kv.Key, kv => Math.Ceiling(kv.Value * (1 + m.P.Comercio.MargemIA)));
                Tentar(() => Capturas.Decidir(m, r, p.Id, "resgate", pedido));
                continue;
            }
            Tentar(() => Capturas.Decidir(m, r, p.Id, "libertar"));
        }
        // oferta do dono (ou contraproposta ao resgate pedido): aceita se paga pelo menos o que o explorador custa
        // (o comerciante, com a margem dele); senão recusa e o pedido de antes continua valendo
        foreach (var p in Capturas.PresosPor(m, r.Id).Where(x => x.Oferta.Count > 0).ToList())
        {
            var custo = m.P.Exploradores.TryGetValue(p.TipoExp, out var x) ? Social.Remessas.Valor(m, x.Custo) : 0;
            var minimo = custo * (r.PerfilIA == "comerciante" ? 1 + m.P.Comercio.MargemIA : 1);
            Tentar(() => Capturas.Decidir(m, r, p.Id, Social.Remessas.Valor(m, p.Oferta) + 1e-6 >= minimo ? "aceitar" : "recusar"));
        }
    }

    // ---------------------------------------------------------------- obras

    /// <summary>Quando a fila de obras termina, se nada atrasar (o material a caminho não entra na conta, como na simulação).</summary>
    public static long FimFila(Mundo m, Reino r)
    {
        var t = m.Agora;
        foreach (var it in r.Fila(Obras.Fila).Itens)
            t = it.Fim is long f ? Math.Max(t, f) : t + T.DeSegundos(it.DuracaoSeg);
        return t;
    }

    /// <summary>Locais de produção que o reino quer ter no dia <paramref name="dia"/> (desde a criação), como <c>locaisAte</c> do modelo.</summary>
    public static int LocaisAte(Mundo m, Conduta c, double dia)
    {
        var p = c.C;
        if (p.LocaisCadaDias <= 0) return 0;
        var mult = c.Perfil?.Locais ?? 1;
        return (int)Math.Min(Math.Round(p.LocaisMax * mult), m.P.IA.LocaisBase + Math.Floor(dia * mult / p.LocaisCadaDias));
    }

    private static IEnumerable<Local> Producao(Mundo m, Reino r) => m.LocaisDe(r.Id).Where(l => l.EhProducao && !l.Ruina);

    private static double Payback(Mundo m, int L) => m.F.Custo(L) / Math.Max(1e-9, m.F.Producao(L) - m.F.Producao(L - 1));

    public static void Construir(Mundo m, Reino r, Conduta c, Local castelo)
    {
        var fila = r.Fila(Obras.Fila);
        var noite = Sessoes.UltimaDoDia(m, c.C, m.Agora);
        var horizonte = T.DeHoras(noite ? c.C.HorizonteNoite : c.C.Horizonte);
        var dia = (m.Agora - r.CriadoEm) / (double)T.Dia;
        var pm = m.P.IA.Moradia;
        bool tentouFundar = false, tentouArmazem = false;   // cada um no máximo uma vez por sessão (procurar lugar custa)
        for (var tent = 0; tent < m.P.IA.ObrasPorSessao && fila.Itens.Count < Fila.Maximo && FimFila(m, r) - m.Agora < horizonte; tent++)
        {
            var teto = Economia.Teto(m, r);
            var tropas = Economia.Tropas(m, r);
            var trab = Economia.TrabalhadoresNecessarios(m, r);
            // 1) moradia: faltam trabalhadores e o teto está cheio
            if (r.Pop < trab * pm.Trabalhadores && r.Pop + tropas > teto * pm.Teto && fila.Itens.All(i => i.Tipo != ObraMoradia.Id))
            {
                var it = Talvez(() => Obras.Moradia(m, r, castelo.Id));
                if (it != null) { Regencia.Acao(m, r, "moradia", "Moradias construídas", 1); continue; }
            }
            // 2) novo local no ritmo do perfil (a regência não expande)
            if (!c.Regencia && !tentouFundar && Producao(m, r).Count() < LocaisAte(m, c, dia) && fila.Itens.All(i => i.Tipo != ObraFundar.Id))
            {
                tentouFundar = true;
                if (Fundar(m, r, castelo) != null) continue;
            }
            // 2b) armazém, quando a próxima melhoria do castelo não cabe no que o reino guarda
            if (!tentouArmazem && fila.Itens.All(i => !DeArmazem(m, i)) && PrecisaArmazem(m, r, castelo))
            {
                tentouArmazem = true;
                if (Armazem(m, r, castelo, c) != null) continue;
            }
            // 3) castelo, quando algum local o alcançou
            if (castelo.Nivel < m.P.NivelMax && Producao(m, r).Any(l => l.Nivel >= castelo.Nivel)
                && fila.Itens.All(i => !(i.Tipo == ObraNivel.Id && i.LocalId == castelo.Id)))
            {
                var it = Talvez(() => Obras.Melhorar(m, r, castelo.Id));
                if (it != null) { Regencia.Acao(m, r, "nivel:" + castelo.Id, castelo.Nome + " sobe ao nível " + it.NivelAlvo, 0); continue; }
            }
            // 4) melhor retorno entre os locais (o acerto da habilidade decide se acha o melhor)
            var naFila = fila.Itens.Where(i => i.Tipo == ObraNivel.Id && i.LocalId != null).Select(i => i.LocalId!.Value).ToHashSet();
            var taxa = Economia.TaxaTotal(m, r);
            var cands = Producao(m, r).Where(l => l.Nivel < m.P.NivelMax && l.Nivel < castelo.Nivel && !naFila.Contains(l.Id))
                .OrderBy(l => Payback(m, l.Nivel + 1) * Math.Max(1, taxa.Qtd(l.Produz!))).ThenBy(l => l.Id).ToList();
            if (cands.Count == 0) break;
            var alvo = m.Sorte.Chance(c.C.Acerto) ? cands[0] : cands[m.Sorte.Int(0, cands.Count)];
            var item = Talvez(() => Obras.Melhorar(m, r, alvo.Id));
            if (item == null) break;
            Regencia.Acao(m, r, "nivel:" + alvo.Id, alvo.Nome + " sobe ao nível " + item.NivelAlvo, 0);
        }
    }

    private static ItemFila? Talvez(Func<ItemFila> f) { try { return f(); } catch (RegraException) { return null; } }

    private static bool DeArmazem(Mundo m, ItemFila i) =>
        i.Tipo == ObraFundar.Id && i.Param == "armazem"
        || i.Tipo == ObraNivel.Id && i.LocalId is long id && m.Locais.Obter(id)?.Tipo == TipoLocal.Armazem;

    /// <summary>Algum recurso da próxima melhoria do castelo passa de <c>P.ia.armazem.folga</c> do que o reino consegue guardar.</summary>
    public static bool PrecisaArmazem(Mundo m, Reino r, Local castelo)
    {
        if (castelo.Nivel >= m.P.NivelMax) return false;
        var custo = m.F.CustoNivel(castelo.Nivel + 1, true);
        var locais = m.LocaisDe(r.Id).Where(l => !l.Ruina).ToList();
        return custo.Any(kv => kv.Value > m.P.IA.Armazem.Folga * locais.Sum(l => Economia.Capacidade(m, l, kv.Key)));
    }

    /// <summary>Melhora o armazém de menor nível (abaixo do castelo) ou funda um novo perto do castelo.</summary>
    private static ItemFila? Armazem(Mundo m, Reino r, Local castelo, Conduta c)
    {
        var a = m.LocaisDe(r.Id).Where(l => l.Tipo == TipoLocal.Armazem && !l.Ruina && l.Nivel < castelo.Nivel).OrderBy(l => l.Nivel).ThenBy(l => l.Id).FirstOrDefault();
        if (a != null)
        {
            var it = Talvez(() => Obras.Melhorar(m, r, a.Id));
            if (it != null) Regencia.Acao(m, r, "nivel:" + a.Id, a.Nome + " sobe ao nível " + it.NivelAlvo, 0);
            return it;
        }
        if (c.Regencia) return null;   // a regência não funda locais
        return FundarTipo(m, r, castelo, "armazem");
    }

    /// <summary>Funda um local do recurso com menos locais, no hexágono livre e explorado mais perto do castelo.</summary>
    private static ItemFila? Fundar(Mundo m, Reino r, Local castelo)
    {
        var contagem = Formulas.Basicos.ToDictionary(k => k, k => Producao(m, r).Count(l => l.Produz == k));
        var raio = m.P.IA.Exploracao.Distancia[1];
        var area = m.G.Area(castelo.Hex, raio).Where(h => Nevoas.Explorado(m, r.Id, h)).OrderBy(h => m.G.Distancia(h, castelo.Hex)).ThenBy(h => h).ToList();
        foreach (var rec in contagem.OrderBy(kv => kv.Value).ThenBy(kv => Array.IndexOf(Formulas.Basicos, kv.Key)).Select(kv => kv.Key))
        {
            var tipo = FundarPorRecurso[rec];
            var terrenos = Obras.Fundaveis[tipo].terrenos;
            var lugar = area.Where(h => terrenos.Contains(m.Mapa.Terrenos[h])).ToList();   // filtro barato antes das regras
            if (!lugar.Any(h => Obras.MotivoNaoFundar(m, r, tipo, h) == null)) continue;
            return FundarTipo(m, r, castelo, tipo, lugar);   // achou o lugar: se faltou material, tenta na próxima sessão
        }
        return null;
    }

    private static ItemFila? FundarTipo(Mundo m, Reino r, Local castelo, string tipo, List<int>? area = null)
    {
        area ??= m.G.Area(castelo.Hex, m.P.IA.Exploracao.Distancia[1]).Where(h => Nevoas.Explorado(m, r.Id, h))
            .OrderBy(h => m.G.Distancia(h, castelo.Hex)).ThenBy(h => h).ToList();
        foreach (var h in area)
        {
            if (Obras.MotivoNaoFundar(m, r, tipo, h) != null) continue;
            var it = Talvez(() => Obras.Fundar(m, r, tipo, h));
            if (it != null) Regencia.Acao(m, r, "fundar:" + h, "Fundou " + Obras.Fundaveis[tipo].tipo.NomeGenerico().ToLowerInvariant(), 0);
            return it;
        }
        return null;
    }

    // ---------------------------------------------------------------- tropas

    /// <summary>
    /// Recrutamento da simulação: uma parte do estoque (militar) vira tropas, sem tirar trabalhadores (mantemTrab) e até a
    /// fração do teto (fracTropas). Lanceiros e uma parte de arqueiros (se houver couro), no castelo.
    /// </summary>
    public static void Recrutar(Mundo m, Reino r, Conduta c, Local castelo)
    {
        var lote = m.B.U["lanceiro"].Custo;
        var total = Filas.LivreParaNovos(m, r);   // o que está guardado, menos o que os itens que aguardam vão pedir
        var verba = Formulas.Basicos.Sum(k => total.Qtd(k)) * c.Militar;
        var teto = Economia.Teto(m, r);
        var trab = Economia.TrabalhadoresNecessarios(m, r);
        var aguardam = Filas.PopAguardando(r);    // ainda são civis, mas já têm destino
        var tropas = Economia.Tropas(m, r) + aguardam;
        var limites = new List<double>
        {
            verba / Math.Max(1, lote.Values.Sum()), r.Pop - aguardam - trab * c.C.MantemTrab, c.FracTropas * teto - tropas,
        };
        limites.AddRange(lote.Select(kv => kv.Value > 0 ? total.Qtd(kv.Key) / kv.Value : double.MaxValue));
        var n = (int)Math.Floor(limites.Min());
        if (n < 1) return;
        var arq = m.B.U["arqueiro"];
        var couroArq = arq.Custo.GetValueOrDefault("couro");
        var nArq = (int)Math.Floor(n * c.C.Arqueiros);
        if (couroArq > 0) nArq = Math.Min(nArq, (int)Math.Floor(total.Qtd("couro") / couroArq));
        foreach (var k in arq.Custo.Keys) if (arq.Custo[k] > 0) nArq = Math.Min(nArq, (int)Math.Floor(total.Qtd(k) / arq.Custo[k]));
        nArq = Math.Max(0, nArq);
        if (nArq > 0 && Talvez(() => Recrutamento.Recrutar(m, r, castelo.Id, "arqueiro", nArq)) != null)
            Regencia.Acao(m, r, "recrutar:arqueiro", "Arqueiros recrutados", nArq);
        else nArq = 0;
        var nLan = n - nArq;
        if (nLan > 0 && Talvez(() => Recrutamento.Recrutar(m, r, castelo.Id, "lanceiro", nLan)) != null)
            Regencia.Acao(m, r, "recrutar:lanceiro", "Lanceiros recrutados", nLan);
    }

    /// <summary>Tropas de ataque (sem milícia) que o castelo pode usar.</summary>
    private static Dictionary<string, int> TropasDeAtaque(Mundo m, Local l) =>
        GT.GuarnicaoLivre(m, l).Where(kv => m.B.U.TryGetValue(kv.Key, out var u) && u.So != "defesa" && u.Fam != "cerco")
            .ToDictionary(kv => kv.Key, kv => kv.Value);

    /// <summary>Tira <paramref name="n"/> tropas do grupo, das mais numerosas para as menos.</summary>
    private static Dictionary<string, int> Parte(IReadOnlyDictionary<string, int> g, int n)
    {
        var total = GT.Total(g);
        if (total <= 0 || n <= 0) return new();
        var frac = Math.Min(1, n / (double)total);
        return GT.Limpo(Combates.Perdas(g, frac));
    }

    // ---------------------------------------------------------------- defesa

    /// <summary>Local em batalha: manda reforço do castelo (se der tempo) ou recua se a defesa está perdida.</summary>
    public static void Defender(Mundo m, Reino r, Conduta c)
    {
        var d = m.P.IA.Defesa;
        foreach (var b in Batalhas.DoReino(m, r.Id).Where(b => !b.Encerrada && b.DefensorId == r.Id).ToList())
        {
            var (fa, fd) = Batalhas.ForcaAgora(b, m.Agora);
            if (fa > 0 && fd < fa * d.Recuo) { Batalhas.Recuar(m, r, b.Id); Regencia.Acao(m, r, "recuo:" + b.Id, "Recuou de uma batalha perdida", 0); continue; }
            var castelo = m.Locais.Obter(r.CasteloId);
            var l = m.Locais.Obter(b.LocalId);
            if (castelo == null || l == null || l.Id == castelo.Id) continue;
            var livres = TropasDeAtaque(m, castelo);
            var grupo = Parte(livres, (int)Math.Floor(GT.Total(livres) * d.Reforco));
            if (GT.Total(grupo) == 0) continue;
            var rota = Caminhos.Calcular(m, castelo.Hex, l.Hex, GT.Velocidade(m, grupo));
            if (m.Agora + (long)Math.Round(rota.TotalMin * T.Min) >= b.Fim) continue;   // não chegaria a tempo
            Exercitos.Enviar(m, r, castelo.Id, grupo, l.Hex, OrdemReforcar.Id);
            Regencia.Acao(m, r, "reforco:" + b.Id, "Mandou reforço para " + l.Nome, 0);
        }
    }

    // ---------------------------------------------------------------- exploração, caça e extração

    private static int Ocupados(Mundo m, Reino r, string tipo) =>
        r.ExploradoresLivres.GetValueOrDefault(tipo) + Exploradores.De(m, r.Id).Count(e => e.TipoExp == tipo)
        + Exploradores.EmTreino(r).Where(i => i.Param == tipo).Sum(i => i.Restantes);

    /// <summary>Hexágono ainda não visto a uma distância sorteada do castelo (ou null).</summary>
    private static int? NaoVisto(Mundo m, Reino r, Local castelo)
    {
        var p = m.P.IA.Exploracao;
        var nevoa = Nevoas.De(m, r.Id);
        for (var i = 0; i < p.Tentativas; i++)
        {
            var d = m.Sorte.Int(p.Distancia[0], p.Distancia[1] + 1 + i);
            var anel = m.G.Area(castelo.Hex, d).Where(h => m.G.Distancia(h, castelo.Hex) == d && nevoa.MinutoVisto(h) == 0).ToList();
            if (anel.Count > 0) return anel[m.Sorte.Int(0, anel.Count)];
        }
        return null;
    }

    /// <summary>Um explorador a pé: treina se não tem; se está livre, explora um hexágono ainda não visto.</summary>
    /// <summary>
    /// Exploradores parados no destino (eles esperam nova ordem): a IA manda o explorador a pé a outro lugar ainda não visto
    /// e traz os outros para casa; a regência só os traz para casa.
    /// </summary>
    public static void ExploradoresParados(Mundo m, Reino r, Local castelo, bool regencia)
    {
        foreach (var e in Exploradores.De(m, r.Id).Where(x => x.Ordem == Exploradores.Aguardar).ToList())
        {
            try
            {
                if (!regencia && e.TipoExp == Exploradores.Pe && AlvoExploracao(m, r, castelo) is int alvo && alvo != e.HexEm(m.Agora))
                    Exploradores.DarOrdem(m, r, e.Id, Exploradores.Explorar, alvo, null, true);
                else Exploradores.DarOrdem(m, r, e.Id, Exploradores.Retornar, null);
            }
            catch (RegraException) { Exploradores.DarOrdem(m, r, e.Id, Exploradores.Retornar, null); }
        }
    }

    public static void Explorar(Mundo m, Reino r, Local castelo)
    {
        if (Ocupados(m, r, Exploradores.Pe) == 0) { Exploradores.Treinar(m, r, Exploradores.Pe, 1); return; }
        if (r.ExploradoresLivres.GetValueOrDefault(Exploradores.Pe) < 1) return;
        if (AlvoExploracao(m, r, castelo) is int h) Exploradores.Enviar(m, r, Exploradores.Pe, Exploradores.Explorar, h, seguro: true);
    }

    /// <summary>Onde explorar: um hexágono ainda não visto. Exploração agora serve para achar riqueza: os reinos já estão no mapa.</summary>
    public static int? AlvoExploracao(Mundo m, Reino r, Local castelo) => NaoVisto(m, r, castelo);

    /// <summary>
    /// Exército de outro reino (não aliado) a até <c>ia.ataque.vigiaAlcance</c> de um local dela, com o próximo passo chegando
    /// mais perto: a IA segura as tropas em casa. A mesma informação que o jogador vê: dono e passo, sem tamanho nem destino.
    /// </summary>
    public static bool MarchaVindo(Mundo m, Reino r)
    {
        var locais = m.LocaisDe(r.Id).Where(l => !l.Ruina).Select(l => l.Hex).ToList();
        if (locais.Count == 0) return false;
        var alcance = m.P.IA.Ataque.VigiaAlcance;
        int Perto(int h) => locais.Min(l => m.G.Distancia(l, h));
        foreach (var x in m.Marchas.OfType<Exercito>())
        {
            if (x.ReinoId == r.Id || !Publico.RegraPublica.MarchaVisivel(x) || Social.Aliancas.SaoAliados(m, r.Id, x.ReinoId)) continue;
            var (caminho, _) = Publico.RegraPublica.Passo(x, m.Agora);
            if (caminho.Count < 2) continue;
            var d = Perto(caminho[0]);
            if (d <= alcance && Perto(caminho[1]) < d) return true;
        }
        return false;
    }

    /// <summary>Caça quando falta couro: lanceiros numa região de fauna conhecida perto do castelo, só se passam ilesos.</summary>
    public static void Cacar(Mundo m, Reino r, Local castelo)
    {
        var p = m.P.IA.Caca;
        if (Economia.TotalGuardado(m, r).Qtd("couro") >= p.CouroMin) return;
        if (Exercitos.De(m, r.Id).Any(e => e.Ordem == OrdemCacar.Id)) return;
        var n = Math.Min(p.Tropas, GT.Livres(m, castelo, "lanceiro"));
        if (n < 1) return;
        var grupo = new Dictionary<string, int> { ["lanceiro"] = n };
        var forca = GT.ForcaFauna(m, grupo);
        foreach (var h in m.G.Area(castelo.Hex, p.Alcance).OrderBy(h => m.G.Distancia(h, castelo.Hex)).ThenBy(h => h))
        {
            var nivel = Fauna.NomeDe(Fotos.PerigoConhecido(m, r.Id, h));
            if (nivel == null || m.F.RiscoFauna(nivel, forca) != "nenhum") continue;
            if (Caca.RegiaoConhecida(m, r, h) == null) continue;
            Exercitos.Enviar(m, r, castelo.Id, grupo, h, OrdemCacar.Id, seguro: true);
            return;
        }
    }

    /// <summary>Custo da próxima obra que a IA faria: o castelo, se algum local já o alcançou; senão a melhoria de local mais barata.</summary>
    public static Dictionary<string, double>? ProximaObra(Mundo m, Reino r, Local castelo)
    {
        if (castelo.Nivel < m.P.NivelMax && Producao(m, r).Any(l => l.Nivel >= castelo.Nivel)) return m.F.CustoNivel(castelo.Nivel + 1, true);
        var l = Producao(m, r).Where(x => x.Nivel < m.P.NivelMax && x.Nivel < castelo.Nivel).OrderBy(x => x.Nivel).ThenBy(x => x.Id).FirstOrDefault();
        return l == null ? null : m.F.CustoNivel(l.Nivel + 1, false);
    }

    /// <summary>
    /// Coleta quando falta madeira ou pedra para a próxima obra: os civis sem trabalho do castelo (sem eles, alguns lanceiros)
    /// vão a um hexágono do recurso sem fauna conhecida perto do castelo e trazem uma carga (sem repetir: na próxima sessão a IA
    /// decide de novo, e os civis voltam a ficar livres para as vagas).
    /// </summary>
    public static void Coletar(Mundo m, Reino r, Local castelo)
    {
        var p = m.P.Coleta;
        if (Exercitos.De(m, r.Id).Any(e => e.Ordem is Coletas.OrdemColetarId or Coletas.OrdemEntregarId || e.ColetaPontoId != null)) return;
        var custo = ProximaObra(m, r, castelo);
        if (custo == null) return;
        var total = Economia.TotalGuardado(m, r);
        var falta = p.Terrenos.Values.Distinct().Where(k => custo.GetValueOrDefault(k) > total.Qtd(k))
            .OrderByDescending(k => custo[k] - total.Qtd(k)).ThenBy(k => k).FirstOrDefault();
        if (falta == null) return;
        var civis = Math.Min(p.MaxPessoas, Pessoas.Pessoas.OciososPresentes(m, castelo).Count());
        var tropas = new Dictionary<string, int>();
        if (civis == 0)
        {
            var n = Math.Min(p.Ia.Tropas, GT.Livres(m, castelo, "lanceiro"));
            if (n < 1) return;
            tropas["lanceiro"] = n;
        }
        var pessoas = civis + GT.Total(tropas);
        var alvo = m.G.Area(castelo.Hex, p.Ia.Alcance)
            .Where(h => Coletas.Recurso(m, h) == falta && Coletas.Motivo(m, r, h) == null && Fotos.PerigoConhecido(m, r.Id, h) == 0
                        && Coletas.Disponivel(m, h) >= p.Minimo && Coletas.PessoasNoHex(m, r.Id, h, 0) + pessoas <= p.MaxPessoas)
            .OrderBy(h => m.G.Distancia(h, castelo.Hex)).ThenBy(h => h).Select(h => (int?)h).FirstOrDefault();
        if (alvo is not int hex) return;
        Coletas.Enviar(m, r, castelo.Id, tropas, civis, hex, repetir: false, seguro: true);
    }

    /// <summary>Prospector e extração: descobre jazidas valiosas e manda lanceiros extrair a mais perto conhecida.</summary>
    public static void Extrair(Mundo m, Reino r, Local castelo)
    {
        var p = m.P.IA.Extracao;
        if (castelo.Nivel < p.Castelo) return;
        if (Ocupados(m, r, Exploradores.Prospector) == 0) { Exploradores.Treinar(m, r, Exploradores.Prospector, 1); return; }
        if (r.ExploradoresLivres.GetValueOrDefault(Exploradores.Prospector) >= 1 && NaoVisto(m, r, castelo) is int h)
            Exploradores.Enviar(m, r, Exploradores.Prospector, Exploradores.Explorar, h, seguro: true);
        if (Exercitos.De(m, r.Id).Any(e => e.Ordem is Extracoes.OrdemExtrair or Extracoes.OrdemEntregar || e.ExtraiJazidaId != null)) return;
        var n = Math.Min(p.Tropas, GT.Livres(m, castelo, "lanceiro"));
        if (n < 1) return;
        var j = m.Jazidas.Where(x => x.DescobertaPor.Contains(r.Id) && x.Restante > 1e-6 && m.G.Distancia(x.Hex, castelo.Hex) <= p.Alcance
                                    && !Extracoes.OcupadoPorOutro(m, r.Id, x.Hex))
            .OrderBy(x => m.G.Distancia(x.Hex, castelo.Hex)).ThenBy(x => x.Id).FirstOrDefault();
        if (j == null) return;
        Extracoes.Enviar(m, r, castelo.Id, new Dictionary<string, int> { ["lanceiro"] = n }, j.Hex, Extracoes.OrdemExtrair, true, new JsonObject { ["repetir"] = true });
    }

    /// <summary>Perfil defensivo: torres perto do castelo a partir do castelo 3 (até as do perfil).</summary>
    public static void Torres(Mundo m, Reino r, PerfilIAP p, Local castelo)
    {
        if (castelo.Nivel < m.P.IA.Ataque.Castelo) return;
        var fila = r.Fila(Obras.Fila);
        if (fila.Itens.Count >= Fila.Maximo || fila.Itens.Any(i => i.Tipo == ObraTorre.Id)) return;
        if (Defesas.DoReino(m, r.Id).Count() >= p.Torres) return;
        foreach (var h in m.G.Area(castelo.Hex, m.F.AlcanceTorre(1)).OrderBy(h => m.G.Distancia(h, castelo.Hex)).ThenBy(h => h))
        {
            if (h == castelo.Hex || Defesas.MotivoTorre(m, r, h) != null) continue;
            Defesas.NovaTorre(m, r, h);
            return;
        }
    }

    // ---------------------------------------------------------------- guerra (só a informação que um jogador teria)

    /// <summary>Locais de outros reinos (ou sem dono), com o hexágono: são públicos.</summary>
    private static IEnumerable<(int hex, long id, bool livre)> LocaisConhecidos(Mundo m, Reino r) =>
        m.Locais.Where(l => l.ReinoId != r.Id).Select(l => (l.Hex, l.Id, Ataques.SemDono(m, l)));

    /// <summary>Perfil expansionista: ocupa uma ruína ou terra livre perto do castelo.</summary>
    public static void Ocupar(Mundo m, Reino r, Local castelo)
    {
        var p = m.P.IA.Ocupacao;
        if (Exercitos.De(m, r.Id).Any(e => e.Ordem == OrdemOcupar.Id)) return;
        var n = Math.Min(p.Tropas, GT.Livres(m, castelo, "lanceiro"));
        if (n < p.Tropas) return;
        var alvo = LocaisConhecidos(m, r).Where(x => x.livre && m.G.Distancia(x.hex, castelo.Hex) <= p.Alcance)
            .OrderBy(x => m.G.Distancia(x.hex, castelo.Hex)).ThenBy(x => x.hex).Select(x => (int?)x.hex).FirstOrDefault();
        if (alvo is not int h) return;
        var l = m.LocalNoHex(h);
        if (l == null || !Ataques.SemDono(m, l)) return;
        Exercitos.Enviar(m, r, castelo.Id, new Dictionary<string, int> { ["lanceiro"] = n }, h, OrdemOcupar.Id, seguro: true);
    }

    /// <summary>Perfil saqueador: um batedor de elite espiona o local de outro reino mais perto ainda não espionado há pouco.</summary>
    public static void Espionar(Mundo m, Reino r, Local castelo)
    {
        var p = m.P.IA.Espionagem;
        if (castelo.Nivel < p.Castelo) return;
        if (Ocupados(m, r, Exploradores.Batedor) == 0) { Exploradores.Treinar(m, r, Exploradores.Batedor, 1); return; }
        if (r.ExploradoresLivres.GetValueOrDefault(Exploradores.Batedor) < 1) return;
        var desde = m.Agora - T.DeHoras(p.RefazerH);
        var alvo = LocaisConhecidos(m, r).Where(x => !x.livre && m.G.Distancia(x.hex, castelo.Hex) <= p.Alcance
                && !(r.LocaisEspionados.TryGetValue(x.id, out var e) && e.Quando > desde))
            .OrderBy(x => m.G.Distancia(x.hex, castelo.Hex)).ThenBy(x => x.hex).Select(x => (int?)x.hex).FirstOrDefault();
        if (alvo is int h) Exploradores.Enviar(m, r, Exploradores.Batedor, Exploradores.Espionar, h, seguro: true);
    }

    /// <summary>Defesa estimada de um local espionado: guarnição (como lanceiros), arqueiros das torres e a milícia estimada pelo que é público (famílias do reino por local).</summary>
    public static double DefesaEstimada(Mundo m, LocalEspionado e, Local l)
    {
        var lan = m.B.U["lanceiro"]; var arq = m.B.U["arqueiro"];
        var milicia = Publico.RegraPublica.CivisEstimados(m, l) * m.P.MiliciaPorPop * m.P.DefMilicia;
        return e.Tropas * lan.Def + e.Torres * m.P.Torre.ArqPorNivel * arq.Def * m.P.Torre.BonusAlto + milicia;
    }

    /// <summary>
    /// Perfil saqueador: saque a um local espionado há pouco. Não ataca reino sob escudo, nem reino muito menor (pelo maior nível
    /// que conhece dele), nem sem folga de força; um ataque por vez, e nunca de novo ao mesmo local com saque recente.
    /// </summary>
    public static void Atacar(Mundo m, Reino r, Local castelo)
    {
        var p = m.P.IA.Ataque;
        if (castelo.Nivel < p.Castelo) return;
        if (Exercitos.De(m, r.Id).Any(e => e.Ordem == OrdemAtacar.Id || e.BatalhaId != null)) return;
        if (MarchaVindo(m, r)) return;   // exército vindo para cá: não esvazia a defesa
        var livres = TropasDeAtaque(m, castelo);
        var envio = Parte(livres, Math.Min((int)Math.Floor(GT.Total(livres) * p.FracTropas), GT.Total(livres) - p.Reserva));
        if (GT.Total(envio) == 0) return;
        var ataque = envio.Sum(kv => kv.Value * m.B.U[kv.Key].Atk);
        var desde = m.Agora - T.DeHoras(p.EspionagemH);
        var porDono = r.LocaisEspionados.Values.GroupBy(e => e.DonoId).ToDictionary(g => g.Key, g => g.Max(e => e.Nivel));
        foreach (var (lid, e) in r.LocaisEspionados.Where(kv => kv.Value.Quando > desde).OrderByDescending(kv => kv.Value.Quando).ThenBy(kv => kv.Key))
        {
            var l = m.Locais.Obter(lid);
            if (l == null || l.Ruina || l.ReinoId != e.DonoId) continue;   // mudou desde a espionagem: espiona de novo antes
            var dono = m.Reinos.Obter(e.DonoId);
            if (dono == null || !dono.Ativo || dono.Id == r.Id) continue;
            if (dono.SobEscudo(m.Agora)) continue;                         // respeita o escudo de novato
            if (porDono[e.DonoId] < castelo.Nivel * p.Porte) continue;     // não ataca quem é muito menor
            if (m.G.Distancia(l.Hex, castelo.Hex) > p.Alcance) continue;
            if (Ataques.SaquesRecentes(m, r, l.Id) > 0) continue;
            if (Permissoes.MotivoEnvio(m, r, dono, l) != null) continue;
            if (ataque < DefesaEstimada(m, e, l) * p.Forca) continue;
            var plano = new PlanoAtaque { Tipo = Ataques.Saque, Tatica = p.Tatica };
            Exercitos.Enviar(m, r, castelo.Id, envio, l.Hex, OrdemAtacar.Id, seguro: true, plano.ParaJson());
            return;
        }
    }
}
