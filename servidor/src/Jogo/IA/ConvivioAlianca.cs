using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.IA;

/// <summary>
/// A IA na aliança, como um jogador: funda, pede para entrar, aceita ou recusa convite, convida, responde pedido de
/// recursos, manda reforço e conversa. Sempre na sessão dela, pelos mesmos serviços dos jogadores, e <b>sem desespero</b>:
/// quem decide é a persona (sociável ou calada, leal ou não, orgulhosa, rancorosa), cada coisa tem um intervalo mínimo e,
/// por sessão, ela diz no máximo duas frases. Há reino de IA que passa a temporada sem aliança, e está certo.
/// </summary>
public static class ConvivioAlianca
{
    /// <summary>Frases por sessão: gente não enche a conversa.</summary>
    public const int FalasPorSessao = 2;

    private static void Tentar(Action a) { try { a(); } catch (RegraException) { } }
    private static Rng Sorte(Mundo m, Reino r, string sal) => Personas.Sorte(m, r, "alianca:" + sal);

    public static void Sessao(Mundo m, Reino r, Conduta c)
    {
        var p = r.Persona;
        if (p == null) return;
        var a = Aliancas.De(m, r);
        if (a == null) { SemAlianca(m, r, p); return; }
        var falas = 0;
        if (a.Membro(r.Id)!.Cargo != Aliancas.Membro) Tentar(() => Gerir(m, r, p, a));
        Tentar(() => Conversar(m, r, p, a, c, ref falas));
        Aliancas.MarcarLida(m, r);
    }

    // ---------------------------------------------------------------- sem aliança: convite, pedido, fundação

    /// <summary>Quanto esta pessoa quer estar com este reino (afinidade menos rancor), de −1 a 1.</summary>
    private static double Simpatia(Reino r, long outroId) => Personas.AfinidadeDe(r, outroId) - Personas.RancorDe(r, outroId);

    /// <summary>
    /// Vontade de entrar nesta aliança (0 a 1): cresce com a sociabilidade e com a afinidade por quem está nela; cai com o
    /// orgulho (prefere mandar a seguir) e some se houver alguém ali que ela não perdoa.
    /// </summary>
    public static double VontadeDeEntrar(Mundo m, Reino r, Alianca a)
    {
        var p = r.Persona!;
        if (a.Membros.Any(x => Personas.RancorDe(r, x.ReinoId) > 0.3)) return 0;
        var afinidade = a.Membros.Count == 0 ? 0 : a.Membros.Max(x => Personas.AfinidadeDe(r, x.ReinoId));
        return Math.Clamp(0.15 + 0.6 * p.Sociabilidade + 0.35 * afinidade - 0.3 * (p.Orgulho - 0.5) + 0.1 * (p.Cautela - 0.5), 0, 1);
    }

    private static void SemAlianca(Mundo m, Reino r, Persona p)
    {
        if (r.AliancaLivreEm > m.Agora) return;
        // convites recebidos: pensa uma sessão (o convite chegou há pouco) e então aceita o melhor ou recusa
        var convites = Aliancas.ConvitesPara(m, r.Id).OrderBy(x => x.c.Quando).ThenBy(x => x.a.Id).ToList();
        if (convites.Count > 0)
        {
            var melhor = convites.OrderByDescending(x => VontadeDeEntrar(m, r, x.a)).ThenBy(x => x.a.Id).First();
            foreach (var (a, cv) in convites)
            {
                if (m.Agora - cv.Quando < Personas.TempoDeReacao(m, r, "convite:" + a.Id, 1200)) continue;   // ainda pensando
                if (a.Id == melhor.a.Id && VontadeDeEntrar(m, r, a) >= 0.5 && a.Membros.Count < m.P.Alianca)
                {
                    Tentar(() => Aliancas.AceitarConvite(m, r, a.Id));
                    if (r.AliancaId == a.Id) { Personas.Favor(m, r, cv.PorId, 0.15); return; }
                }
                else Tentar(() => Aliancas.RecusarConvite(m, r, a.Id));
            }
            return;
        }
        var dias = (m.Agora - r.CriadoEm) / (double)T.Dia;
        var castelo = m.Locais.Obter(r.CasteloId);
        if (castelo == null) return;
        // pedir para entrar: só quem é sociável, depois de uns dias de jogo, e não a cada sessão
        if (p.Sociabilidade >= 0.45 && dias >= 1 + (1 - p.Sociabilidade) * 8 && !Convivio.JaFalou(p, "pedir-alianca", m.Agora, 3))
        {
            if (!Sorte(m, r, "pedir").Chance(0.2)) return;   // hoje não
            var alvo = m.Aliancas.Where(a => a.Membros.Count < m.P.Alianca && !a.Pedidos.Any(x => x.ReinoId == r.Id)
                    && !a.Treguas.Any(t => t.ReinoId == r.Id) && VontadeDeEntrar(m, r, a) >= 0.5)
                .Select(a => (a, perto: Proximidade(m, castelo, a)))
                .Where(x => x.perto <= m.P.VizinhoHex * 2)
                .OrderByDescending(x => VontadeDeEntrar(m, r, x.a)).ThenBy(x => x.perto).ThenBy(x => x.a.Id).Select(x => x.a).FirstOrDefault();
            Convivio.Marcar(m, r, "pedir-alianca");
            if (alvo != null) { Tentar(() => Aliancas.PedirEntrada(m, r, alvo.Id)); return; }
        }
        // fundar: quem é orgulhoso e minimamente sociável, quando ninguém o chamou e há poucas alianças por perto
        if (p.Orgulho >= 0.6 && p.Sociabilidade >= 0.4 && dias >= 2 && !Convivio.JaFalou(p, "fundar", m.Agora, 20)
            && m.Aliancas.Count < Math.Max(2, m.P.Reinos / m.P.Alianca) && Sorte(m, r, "fundar").Chance(0.12))
        {
            Convivio.Marcar(m, r, "fundar");
            var s = Sorte(m, r, "nome");
            for (var i = 0; i < 12 && r.AliancaId == null; i++)
            {
                var nome = Nomes.Alianca(s);
                Tentar(() => Aliancas.Criar(m, r, nome, null, aberta: p.Sociabilidade > 0.7));
            }
        }
    }

    /// <summary>Distância (hexágonos) do castelo ao castelo do membro mais perto da aliança.</summary>
    private static int Proximidade(Mundo m, Local castelo, Alianca a) =>
        a.Membros.Select(x => m.Reinos.Obter(x.ReinoId)).OfType<Reino>().Select(q => m.Locais.Obter(q.CasteloId)).OfType<Local>()
            .Select(l => m.G.Distancia(l.Hex, castelo.Hex)).DefaultIfEmpty(int.MaxValue).Min();

    // ---------------------------------------------------------------- líder e conselheiro: pedidos de entrada e convites

    private static void Gerir(Mundo m, Reino r, Persona p, Alianca a)
    {
        var agora = m.Agora;
        foreach (var ped in a.Pedidos.Where(x => x.Ate > agora).ToList())
        {
            if (m.Agora - ped.Quando < Personas.TempoDeReacao(m, r, "pedido:" + ped.ReinoId, 900)) continue;   // ainda não viu
            // aceita quem não lhe fez mal; o cauteloso e pouco sociável recusa quem não conhece
            var aceita = Personas.RancorDe(r, ped.ReinoId) <= 0.3 && p.Sociabilidade + 0.5 * Personas.AfinidadeDe(r, ped.ReinoId) - 0.4 * (p.Cautela - 0.5) >= 0.35;
            if (aceita) Tentar(() => Aliancas.AceitarPedido(m, r, ped.ReinoId)); else Tentar(() => Aliancas.RecusarPedido(m, r, ped.ReinoId));
        }
        if (a.Membros.Count >= m.P.Alianca) return;
        // indicação de um membro: convida, se não tem nada contra o indicado
        var desde = agora - T.DeHoras(m.P.Social.PropostaH);
        foreach (var f in a.Conversa.Where(f => f.Evento == "indicacao" && f.Quando > desde && f.AlvoId != null).ToList())
        {
            var alvo = m.Reinos.Obter(f.AlvoId!.Value);
            if (alvo is not { Ativo: true, AliancaId: null } || a.Convites.Any(x => x.ReinoId == alvo.Id) || Personas.RancorDe(r, alvo.Id) > 0.3) continue;
            Tentar(() => Aliancas.Convidar(m, r, alvo.Id));
        }
        // convidar por conta própria: de vez em quando, o vizinho mais perto sem aliança, de quem não guarda rancor
        if (Convivio.JaFalou(p, "convidar", agora, 2) || !Sorte(m, r, "convidar").Chance(0.12 + 0.3 * p.Sociabilidade)) return;
        Convivio.Marcar(m, r, "convidar");
        var castelo = m.Locais.Obter(r.CasteloId);
        if (castelo == null) return;
        var vizinho = m.Reinos.Where(q => q.Ativo && q.Id != r.Id && q.AliancaId == null && q.AliancaLivreEm <= agora
                && !a.Convites.Any(x => x.ReinoId == q.Id) && !a.Treguas.Any(t => t.ReinoId == q.Id) && Personas.RancorDe(r, q.Id) <= 0.2)
            .Select(q => (q, l: m.Locais.Obter(q.CasteloId))).Where(x => x.l != null)
            .Select(x => (x.q, d: m.G.Distancia(x.l!.Hex, castelo.Hex))).Where(x => x.d <= m.P.VizinhoHex * 2)
            .OrderBy(x => x.d).ThenBy(x => x.q.Id).Select(x => x.q).FirstOrDefault();
        if (vizinho != null) Tentar(() => Aliancas.Convidar(m, r, vizinho.Id));
    }

    // ---------------------------------------------------------------- pedidos de recursos

    /// <summary>
    /// Pedido de recursos de um aliado (chamado junto com as outras propostas): atende quem é leal e tem de sobra; o
    /// ganancioso segura. Quem atende ganha a afinidade de quem pediu... e quem pediu fica um pouco mais próximo dela.
    /// </summary>
    public static void ResponderPedido(Mundo m, Reino r, Proposta ped)
    {
        var p = r.Persona;
        var vontade = 0.5 + ((p?.Lealdade ?? 0.5) - 0.5) * 0.8 + Personas.AfinidadeDe(r, ped.DeId) * 0.4 - ((p?.Ganancia ?? 0.5) - 0.5) * 0.5 - Personas.RancorDe(r, ped.DeId);
        var pedinte = m.Reinos.Obter(ped.DeId);
        if (vontade >= 0.5 && Comerciante.TemEstoque(m, r, ped.Quer))
        {
            Comercio.AceitarPedido(m, r, ped.Id);
            if (p != null && pedinte != null && Aliancas.De(m, r) != null && Sorte(m, r, "mandei").Chance(0.3 + 0.5 * p.Sociabilidade))
                Dizer(m, r, Falas.MandeiRecurso, pedinte.Nome, new() { ["recurso"] = Remessas.Texto(ped.Quer), ["quantidade"] = "" });
            return;
        }
        Comercio.Recusar(m, r, ped.Id);
        if (p != null && pedinte != null && Aliancas.De(m, r) != null && Sorte(m, r, "naoposso").Chance(0.5 * p.Sociabilidade))
            Dizer(m, r, Falas.NaoPossoAjudar, pedinte.Nome, new());
    }

    // ---------------------------------------------------------------- conversa e reforço

    /// <summary>Uma fala dela na conversa da aliança, pelo ponto único (<see cref="Falas.Gerar"/>), com as últimas linhas como histórico.</summary>
    public static bool Dizer(Mundo m, Reino r, string tipo, string? para, Dictionary<string, string> situacao)
    {
        var a = Aliancas.De(m, r);
        if (a == null || r.Persona == null) return false;
        situacao.TryAdd("alianca", a.Nome);
        var historico = a.Conversa.TakeLast(6).Select(f => new FalaAnterior(f.ReinoId != 0 ? m.Reinos.Obter(f.ReinoId)?.Nome ?? "" : a.Nome, f.Texto, f.ReinoId == r.Id && f.Tipo == Aliancas.TipoFala)).ToList();
        var texto = Falas.Gerar(m, r, new ContextoFala
        {
            Tipo = tipo, Canal = Falas.CanalAlianca, ParaReino = para, Situacao = situacao, Historico = historico, MaxCaracteres = m.P.Social.Conversa.Caracteres,
        });
        if (texto == null) return false;
        // @todos e menções só valem para quem tem o cargo: o texto dela nunca começa uma dessas por acidente
        try { Aliancas.Falar(m, r, texto.Replace("@", "")); return true; }
        catch (RegraException) { return false; }
    }

    /// <summary>Atacada e na aliança: pede socorro na conversa (uma vez por batalha).</summary>
    public static void AoSerAtacada(Mundo m, Reino r)
    {
        var p = r.Persona; var a = Aliancas.De(m, r);
        if (p == null || a == null || a.Membros.Count < 2) return;
        var b = Batalhas.DoReino(m, r.Id).Where(x => !x.Encerrada && x.DefensorId == r.Id).OrderBy(x => x.Id).FirstOrDefault();
        if (b == null || Convivio.JaFalou(p, "socorro:" + b.Id, m.Agora, 1)) return;
        Convivio.Marcar(m, r, "socorro:" + b.Id);
        if (!Sorte(m, r, "socorro").Chance(0.35 + 0.5 * p.Sociabilidade - 0.4 * (p.Orgulho - 0.5))) return;   // o orgulhoso não pede
        var l = m.Locais.Obter(b.LocalId);
        Dizer(m, r, Falas.PedidoReforco, null, new() { ["local"] = l?.Nome ?? "meu local", ["atacante"] = m.Reinos.Obter(b.AtacanteId)?.Nome ?? "alguém" });
    }

    /// <summary>Manda reforço ao local de um aliado em batalha, se a lealdade pede e as tropas chegam a tempo. Devolve true se mandou.</summary>
    public static bool Reforcar(Mundo m, Reino r, Persona p, Conduta c, Batalha b)
    {
        var l = m.Locais.Obter(b.LocalId);
        var castelo = m.Locais.Obter(r.CasteloId);
        if (l == null || castelo == null || !Aliancas.SaoAliados(m, r.Id, b.DefensorId)) return false;
        if (Exercitos.De(m, r.Id).Any(e => e.Ordem == OrdemReforcar.Id && e.Destino == l.Hex)) return false;   // já mandou
        // quanto ela se importa: lealdade e afinidade por quem está apanhando; o cauteloso guarda mais tropa em casa
        var vontade = 0.5 + (p.Lealdade - 0.5) * 0.9 + Personas.AfinidadeDe(r, b.DefensorId) * 0.4 - (p.Passividade - 0.5) * 0.4;
        if (vontade < 0.5) return false;
        var livres = GT.GuarnicaoLivre(m, castelo).Where(kv => m.B.U.TryGetValue(kv.Key, out var u) && u.So != "defesa" && u.Fam != "cerco").ToDictionary(kv => kv.Key, kv => kv.Value);
        var n = (int)Math.Floor(GT.Total(livres) * Math.Clamp(0.25 + 0.35 * p.Lealdade - 0.2 * (p.Cautela - 0.5), 0.1, 0.6));
        if (n < 1) return false;
        var grupo = GT.Limpo(Combates.Perdas(livres, Math.Min(1, n / (double)GT.Total(livres))));
        if (GT.Total(grupo) == 0) return false;
        var rota = Caminhos.Calcular(m, castelo.Hex, l.Hex, GT.Velocidade(m, grupo));
        if (m.Agora + (long)Math.Round(rota.TotalMin * T.Min) >= b.Fim) return false;   // não chegaria a tempo
        try { Exercitos.Enviar(m, r, castelo.Id, grupo, l.Hex, OrdemReforcar.Id); }
        catch (RegraException) { return false; }
        Personas.Favor(m, r, b.DefensorId, 0.05);
        return true;
    }

    private static void Conversar(Mundo m, Reino r, Persona p, Alianca a, Conduta c, ref int falas)
    {
        var ate = a.LidaAte.GetValueOrDefault(r.Id);
        var novas = a.Conversa.Where(f => f.Id > ate && !(f.ReinoId == r.Id && f.Tipo == Aliancas.TipoFala)).ToList();
        bool Pode(ref int n) => n < FalasPorSessao;
        string Nome(long id) => m.Reinos.Obter(id)?.Nome ?? "";

        // a primeira vez na conversa: cumprimenta (quem é calado, nem isso)
        if (!p.FalouEm.ContainsKey("saudacao:" + a.Id))
        {
            Convivio.Marcar(m, r, "saudacao:" + a.Id);
            if (a.Membros.Count > 1 && Sorte(m, r, "saudacao").Chance(0.3 + 0.65 * p.Sociabilidade) && Dizer(m, r, Falas.Saudacao, null, new())) falas++;
        }
        // aliados em batalha agora: manda reforço (e avisa) ou explica que não dá
        foreach (var b in m.Batalhas.Where(b => !b.Encerrada && b.DefensorId != r.Id && Aliancas.SaoAliados(m, r.Id, b.DefensorId)).OrderBy(b => b.Id).ToList())
        {
            if (Convivio.JaFalou(p, "batalha:" + b.Id, m.Agora, 1)) continue;
            Convivio.Marcar(m, r, "batalha:" + b.Id);
            var local = m.Locais.Obter(b.LocalId)?.Nome ?? "lá";
            if (Reforcar(m, r, p, c, b))
            {
                if (Pode(ref falas) && Sorte(m, r, "vou:" + b.Id).Chance(0.5 + 0.5 * p.Sociabilidade) && Dizer(m, r, Falas.VouAjudar, Nome(b.DefensorId), new() { ["local"] = local })) falas++;
            }
            else if (Pode(ref falas) && novas.Any(f => f.Evento is "pedido-reforco" or "ataque" && f.ReinoId == b.DefensorId) && Sorte(m, r, "naovou:" + b.Id).Chance(0.35 * p.Sociabilidade)
                     && Dizer(m, r, Falas.NaoPossoAjudar, Nome(b.DefensorId), new() { ["local"] = local })) falas++;
        }
        // menção: responde a quem chamou
        var mencao = novas.LastOrDefault(f => f.Tipo == Aliancas.TipoFala && (f.Mencoes.Contains(r.Id) || f.Todos));
        if (mencao != null && Pode(ref falas) && Sorte(m, r, "mencao:" + mencao.Id).Chance(0.45 + 0.5 * p.Sociabilidade) && Dizer(m, r, Falas.RespostaMencao, Nome(mencao.ReinoId), new()))
        {
            falas++; Personas.Favor(m, r, mencao.ReinoId, 0.03);
        }
        // o que aconteceu desde a última vez, do mais importante para o menos; cada coisa pela sorte e pelo jeito dela
        foreach (var f in novas.Where(f => f.Tipo == Aliancas.TipoEvento).OrderByDescending(f => f.Id))
        {
            if (!Pode(ref falas)) break;
            var s = Sorte(m, r, "evento:" + f.Id);
            var local = f.LocalId is long lid ? m.Locais.Obter(lid)?.Nome ?? "lá" : "lá";
            var outro = f.AlvoId is long oid ? Nome(oid) : "";
            switch (f.Evento)
            {
                case "vitoria" when f.ReinoId == r.Id:
                    if (s.Chance(0.25 + 0.5 * p.Sociabilidade) && Dizer(m, r, Falas.Vitoria, null, new() { ["local"] = local, ["atacante"] = outro })) falas++;
                    break;
                case "derrota" when f.ReinoId == r.Id:
                    if (s.Chance(0.2 + 0.4 * p.Sociabilidade - 0.3 * (p.Orgulho - 0.5)) && Dizer(m, r, Falas.Derrota, null, new() { ["local"] = local, ["atacante"] = outro })) falas++;
                    break;
                case "vitoria" when f.ReinoId != 0:
                    if (s.Chance(0.55 * p.Sociabilidade) && Dizer(m, r, Falas.Parabens, Nome(f.ReinoId), new() { ["local"] = local })) falas++;
                    break;
                case "derrota" when f.ReinoId != 0:
                    if (s.Chance(0.5 * p.Sociabilidade + 0.2 * (p.Lealdade - 0.5)) && Dizer(m, r, Falas.Consolo, Nome(f.ReinoId), new() { ["local"] = local })) falas++;
                    break;
                case "entrou" when f.ReinoId != r.Id && f.ReinoId != 0:
                    if (s.Chance(0.7 * p.Sociabilidade) && Dizer(m, r, Falas.BoasVindas, Nome(f.ReinoId), new())) falas++;
                    break;
                case "ajuda" when f.AlvoId == r.Id:
                    if (s.Chance(0.4 + 0.5 * p.Sociabilidade) && Dizer(m, r, Falas.Agradecimento, Nome(f.ReinoId), new())) falas++;
                    Personas.Favor(m, r, f.ReinoId, 0.2);
                    break;
                case "reforco" when f.AlvoId == r.Id:
                    if (s.Chance(0.4 + 0.5 * p.Sociabilidade) && Dizer(m, r, Falas.Agradecimento, Nome(f.ReinoId), new())) falas++;
                    Personas.Favor(m, r, f.ReinoId, 0.25);
                    break;
            }
        }
        // quem fala com ela na conversa fica um pouco mais próximo
        foreach (var id in novas.Where(f => f.Tipo == Aliancas.TipoFala && f.ReinoId != 0).Select(f => f.ReinoId).Distinct()) Personas.Favor(m, r, id, 0.01);
        // conversa fiada: raramente, no máximo uma vez por dia, e só quem gosta de conversar
        if (falas == 0 && a.Membros.Count > 1 && !Convivio.JaFalou(p, "fiada", m.Agora, 1) && Sorte(m, r, "fiada").Chance(0.14 * p.Sociabilidade))
        {
            Convivio.Marcar(m, r, "fiada");
            if (Dizer(m, r, Falas.ConversaFiada, null, new())) falas++;
        }
    }
}
