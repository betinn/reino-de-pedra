using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Combate
{
    /// <summary>Ponto do caminho da marcha onde o exército chega antes dela.</summary>
    public sealed record Encontro(int Hex, int Indice, long Nos, long Eles, Rota Rota)
    {
        public long Folga => Eles - Nos;
    }

    /// <summary>
    /// Interceptação: alcançar uma marcha visível (exército, caravana, carregadores, marcha com relíquia) num ponto do caminho
    /// dela, chegando antes (com folga de P.guerra.interceptacao.folgaSeg). As tropas esperam no ponto; quando a marcha passa,
    /// combate em campo (<see cref="Campo.Lutar"/>). Se ela mudou de rota ou já passou, a interceptação falha e as tropas voltam.
    /// </summary>
    public static class Interceptacoes
    {
        /// <summary>Marcha que o reino pode tentar interceptar: alheia, interceptável, à vista agora e sem bloqueio (aliança, pacto).</summary>
        public static Marcha Alvo(Mundo m, Reino r, long marchaId, HashSet<int>? vis = null)
        {
            var mc = m.Marchas.Obter(marchaId);
            if (mc == null || mc.ReinoId == r.Id) throw new RegraException("Marcha não encontrada.", 404);
            vis ??= Nevoas.VisiveisAgora(m, r.Id);
            if (!vis.Contains(mc.HexEm(m.Agora))) throw new RegraException("Essa marcha não está mais à vista.");
            if (!mc.Interceptavel) throw new RegraException("Não dá para interceptar esta marcha.");
            if (mc is Exercito { Parado: true } || mc.Chegada <= m.Agora) throw new RegraException("Essas forças não estão em marcha.");
            if (m.Reinos.Obter(mc.ReinoId) is { } dono)
            {
                var motivo = Permissoes.MotivoEnvio(m, r, dono);
                if (motivo != null) throw new RegraException(motivo);
            }
            return mc;
        }

        /// <summary>
        /// O primeiro ponto do caminho da marcha (antes do destino) aonde as tropas chegam com folga antes dela, pela rota curta.
        /// Dijkstra a partir de <paramref name="de"/> com os mesmos custos de <see cref="Caminhos"/>. Null se não alcançam.
        /// </summary>
        public static Encontro? Calcular(Mundo m, int de, IReadOnlyDictionary<string, int> tropas, Marcha alvo)
        {
            if (GT.Total(tropas) == 0 || alvo.Caminho.Count < 2) return null;
            var vel = GT.Velocidade(m, tropas);
            var agora = m.Agora;
            var folga = T.DeSegundos(m.P.Guerra.Interceptacao.FolgaSeg);
            var restantes = new Dictionary<int, int>();
            for (var i = 1; i < alvo.Caminho.Count - 1; i++)
                if (alvo.Tempos[i] > agora + folga && !restantes.ContainsKey(alvo.Caminho[i])) restantes[alvo.Caminho[i]] = i;
            if (restantes.Count == 0) return null;
            var dist = MinutosDe(m, de, vel, alvo.Tempos[^1] - agora);
            foreach (var (h, i) in restantes.OrderBy(kv => kv.Value))
            {
                var d = dist[h];
                if (double.IsInfinity(d)) continue;
                var nos = agora + (long)Math.Round(d * T.Min);
                if (nos > alvo.Tempos[i] - folga) continue;
                var rota = h == de ? Rota.Parada(de) : Caminhos.Calcular(m, de, h, vel);
                if (rota.Hexes[^1] != h) continue;
                nos = agora + (long)Math.Round(rota.TotalMin * T.Min);
                if (nos > alvo.Tempos[i] - folga) continue;
                return new Encontro(h, i, nos, alvo.Tempos[i], rota);
            }
            return null;
        }

        /// <summary>Minutos de <paramref name="de"/> até cada hexágono (Dijkstra, custo de entrar em cada um), até um limite.</summary>
        private static double[] MinutosDe(Mundo m, int de, string vel, long limiteMs)
        {
            var g = m.G;
            var dist = new double[g.Total]; Array.Fill(dist, double.PositiveInfinity);
            var limite = limiteMs / (double)T.Min + 1;
            var fila = new PriorityQueue<int, double>();
            dist[de] = 0; fila.Enqueue(de, 0);
            while (fila.TryDequeue(out var u, out var du))
            {
                if (du > dist[u] || du > limite) continue;
                foreach (var v in g.Vizinhos(u))
                {
                    var d = du + Caminhos.MinutosEntrar(m, v, vel, OpcoesCaminho.Padrao);
                    if (d < dist[v]) { dist[v] = d; fila.Enqueue(v, d); }
                }
            }
            return dist;
        }

        /// <summary>De onde o exército parte (posição atual, ou o local de origem antes de partir).</summary>
        public static int PontoDe(Mundo m, Exercito ex) =>
            ex.Caminho.Count > 0 ? ex.HexEm(m.Agora) : m.Locais.Obter(ex.OrigemLocalId)?.Hex ?? ex.Origem;

        public static JsonObject Dados(Marcha alvo, Encontro e, string tatica, bool estandarte) => new()
        {
            ["marchaId"] = alvo.Id, ["partida"] = alvo.Partida, ["hex"] = e.Hex, ["quando"] = e.Eles, ["tipoAlvo"] = alvo.Tipo,
            ["tatica"] = tatica, ["estandarte"] = estandarte,
        };

        internal static long L(JsonObject d, string k)
        {
            if (d[k] is not JsonValue v) return 0;
            if (v.TryGetValue<long>(out var l)) return l;
            if (v.TryGetValue<int>(out var i)) return i;
            if (v.TryGetValue<double>(out var x)) return (long)x;
            return long.TryParse(v.ToJsonString(), out var p) ? p : 0;
        }
        internal static string S(JsonObject d, string k, string padrao) { try { return d[k]?.GetValue<string>() ?? padrao; } catch { return padrao; } }

        /// <summary>As tropas chegaram ao ponto de encontro: esperam a marcha passar (evento no instante da passagem).</summary>
        internal static void Chegou(Mundo m, Exercito ex)
        {
            ex.Parar(m);
            var d = ex.Dados;
            var alvo = m.Marchas.Obter(L(d, "marchaId"));
            var quando = L(d, "quando");
            var hex = (int)L(d, "hex");
            if (alvo == null || alvo.Partida != L(d, "partida") || !Passa(alvo, hex, quando)) { Falhou(m, ex, alvo == null ? "As forças sumiram antes do encontro." : "As forças mudaram de rota."); return; }
            if (quando < m.Agora) { Falhou(m, ex, "As forças já tinham passado."); return; }
            var ev = m.Agendar(new EncontroInterceptacaoEvento { ExercitoId = ex.Id, MarchaId = alvo.Id, Partida = alvo.Partida, Hex = hex, Quando = quando });
            d["evento"] = ev.Id;
            m.Sujar(ex);
            Exercitos.Avisar(m, ex, "Tropas no ponto de encontro", GT.Partes(m, ex.Tropas) + " esperam as forças passarem.");
        }

        internal static bool Passa(Marcha alvo, int hex, long quando)
        {
            for (var i = 0; i < alvo.Caminho.Count; i++) if (alvo.Caminho[i] == hex && alvo.Tempos[i] == quando) return true;
            return false;
        }

        /// <summary>A interceptação não aconteceu: relatório e as tropas voltam.</summary>
        internal static void Falhou(Mundo m, Exercito ex, string motivo)
        {
            var d = ex.Dados;
            var nomeAlvo = Campo.NomeMarcha(S(d, "tipoAlvo", ""));
            var dados = new JsonObject
            {
                ["resumo"] = "Interceptação falhou: " + motivo + " As tropas voltaram.", ["papel"] = "ataque", ["tipo"] = "interceptacao", ["tipoNome"] = "Interceptação",
                ["resultado"] = "sem-combate", ["alvo"] = nomeAlvo, ["hex"] = ex.HexEm(m.Agora), ["porQueVoltaram"] = motivo,
                ["tropas"] = new JsonObject { ["enviadas"] = RelatoriosCombate.Grupo(ex.Tropas), ["perdas"] = new JsonObject() },
                ["linhas"] = new JsonArray(new JsonObject { ["rotulo"] = "Tropas", ["valor"] = GT.Partes(m, ex.Tropas) }, new JsonObject { ["rotulo"] = "Por que voltaram", ["valor"] = motivo }),
            };
            Registros.Relatar(m, ex.ReinoId, "ataque", "Interceptação: sem combate", dados, "batalhas");
            ex.Retornar(m);
        }
    }

    /// <summary>Ordem "interceptar": ir ao ponto de encontro (Dados: marchaId, partida, hex, quando) e esperar a marcha passar.</summary>
    public sealed class OrdemInterceptar : IOrdemExercito
    {
        public const string Id = "interceptar";
        public string Ordem => Id;
        public void Validar(Mundo m, Reino r, Exercito ex, int destino)
        {
            Ataques.ValidarTropas(m, ex.Tropas);
            var alvo = Interceptacoes.Alvo(m, r, Interceptacoes.L(ex.Dados, "marchaId"));
            var e = Interceptacoes.Calcular(m, Interceptacoes.PontoDe(m, ex), ex.Tropas, alvo)
                ?? throw new RegraException("Não alcançam a tempo: use tropas mais rápidas.");
            if (e.Hex != destino) throw new RegraException("O ponto de encontro mudou: confira de novo.");
            var tatica = Interceptacoes.S(ex.Dados, "tatica", m.P.Combate.TaticaPadrao);
            Ataques.Limite(m, tatica);
            var estandarte = ex.Dados["estandarte"] is JsonValue v && v.TryGetValue<bool>(out var b) && b;
            ex.Dados = Interceptacoes.Dados(alvo, e, tatica, estandarte);
            ex.Estandarte = estandarte;
            ex.AlvoLocalId = null;
        }
        public void Chegou(Mundo m, Exercito ex) => Interceptacoes.Chegou(m, ex);
    }

    /// <summary>A marcha chega ao ponto de encontro: combate em campo, se tudo ainda vale.</summary>
    public sealed class EncontroInterceptacaoEvento : Evento
    {
        public long ExercitoId { get; set; }
        public long MarchaId { get; set; }
        public long Partida { get; set; }
        public int Hex { get; set; }
        public override void Executar(Mundo m)
        {
            if (m.Marchas.Obter(ExercitoId) is not Exercito ex || ex.Ordem != OrdemInterceptar.Id || !ex.Parado
                || Interceptacoes.L(ex.Dados, "evento") != Id) return;
            ex.Dados.Remove("evento");
            var alvo = m.Marchas.Obter(MarchaId);
            if (alvo == null) { Interceptacoes.Falhou(m, ex, "As forças sumiram antes do encontro."); return; }
            if (alvo.Partida != Partida || alvo.HexEm(m.Agora) != Hex) { Interceptacoes.Falhou(m, ex, "As forças mudaram de rota."); return; }
            if (ex.HexEm(m.Agora) != Hex) { Interceptacoes.Falhou(m, ex, "Suas tropas saíram do ponto de encontro."); return; }
            var r = m.Reinos.Obter(ex.ReinoId);
            var dono = m.Reinos.Obter(alvo.ReinoId);
            if (r != null && dono != null && (Permissoes.MotivoEnvio(m, r, dono) ?? Permissoes.MotivoChegada(m, r, dono)) is { } motivo)
            { Interceptacoes.Falhou(m, ex, motivo); return; }
            Revide.Registrar(m, alvo.ReinoId, ex.ReinoId);
            Campo.Lutar(m, ex, alvo, Interceptacoes.S(ex.Dados, "tatica", m.P.Combate.TaticaPadrao), "Interceptação");
            if (m.Marchas.ContemId(ex.Id) && GT.Total(ex.Tropas) > 0) ex.Retornar(m);
            else if (m.Marchas.ContemId(ex.Id)) ex.Encerrar(m);
        }
    }

    // ================================================================ posturas automáticas

    /// <summary>
    /// "Atacar apenas quem atacar": quem atacou os locais ou exércitos de um reino fica marcado por P.guerra.postura.revidaH.
    /// O atacante não é revelado ao jogador; o servidor só usa isso para o revide automático.
    /// </summary>
    public static class Revide
    {
        public static void Registrar(Mundo m, long vitima, long atacante)
        {
            if (vitima == atacante || m.Reinos.Obter(vitima) is not { } r) return;
            var desde = m.Agora - T.DeHoras(m.P.Guerra.Postura.RevidaH);
            foreach (var k in r.AtacadoPor.Where(kv => kv.Value <= desde).Select(kv => kv.Key).ToList()) r.AtacadoPor.Remove(k);
            r.AtacadoPor[atacante] = m.Agora;
            m.Sujar(r);
        }
        public static bool Atacou(Mundo m, long vitima, long atacante) =>
            m.Reinos.Obter(vitima) is { } r && r.AtacadoPor.TryGetValue(atacante, out var t) && t > m.Agora - T.DeHoras(m.P.Guerra.Postura.RevidaH);
    }

    /// <summary>
    /// Vigias: guarnições e exércitos parados em postura agressiva. Na partida de qualquer marcha interceptável, agenda um
    /// encontro no instante em que ela entra no alcance (P.guerra.postura.alcance) de cada vigia que a atacaria:
    /// "atacar qualquer ameaça" ataca qualquer força hostil; "atacar apenas quem atacar" só o reino que atacou há pouco
    /// (<see cref="Revide"/>); "apenas defender" nunca sai. Aliança e pacto bloqueiam por <see cref="Permissoes"/>.
    /// Postura mudada depois de a marcha partir só vale para as próximas partidas.
    /// </summary>
    public static class Vigias
    {
        private sealed record Vigia(long ReinoId, int Hex, long? LocalId, long? ExercitoId);

        private static bool SemMilicia(Mundo m, IReadOnlyDictionary<string, int> g) =>
            g.Any(kv => kv.Value > 0 && m.B.U.TryGetValue(kv.Key, out var u) && u.So != "defesa");

        /// <summary>Tropas que saem da guarnição para atacar (a milícia só defende).</summary>
        public static Dictionary<string, int> Saida(Mundo m, IReadOnlyDictionary<string, int> g) =>
            GT.Limpo(g).Where(kv => m.B.U.TryGetValue(kv.Key, out var u) && u.So != "defesa").ToDictionary(kv => kv.Key, kv => kv.Value);

        private static bool Hostil(Mundo m, long vigia, long outro, Postura p)
        {
            if (vigia == outro) return false;
            var a = m.Reinos.Obter(vigia); var b = m.Reinos.Obter(outro);
            if (a == null || b == null || !a.Ativo || !b.Ativo) return false;
            if (Permissoes.MotivoEnvio(m, a, b) != null || Permissoes.MotivoChegada(m, a, b) != null) return false;
            return p == Postura.AtacarQualquer || p == Postura.AtacarQuemAtacar && Revide.Atacou(m, vigia, outro);
        }

        private static IEnumerable<Vigia> Todas(Mundo m)
        {
            foreach (var l in m.Locais)
                if (l.ReinoId != 0 && !l.Ruina && l.Postura != Postura.ApenasDefender && SemMilicia(m, l.Guarnicao))
                    yield return new Vigia(l.ReinoId, l.Hex, l.Id, null);
            foreach (var e in m.Marchas.OfType<Exercito>())
                if (e.Parado && e.BatalhaId == null && e.Postura != Postura.ApenasDefender && SemMilicia(m, e.Tropas))
                    yield return new Vigia(e.ReinoId, e.HexEm(m.Agora), null, e.Id);
        }

        internal static void AoPartir(Mundo m, Marcha mc)
        {
            if (!mc.Interceptavel || mc.Caminho.Count < 2 || mc.Partida != m.Agora) return;
            var alcance = m.P.Guerra.Postura.Alcance;
            foreach (var v in Todas(m))
            {
                if (v.ExercitoId == mc.Id || v.ReinoId == mc.ReinoId) continue;
                var postura = v.LocalId is long lid ? m.Locais.Obter(lid)!.Postura : ((Exercito)m.Marchas.Obter(v.ExercitoId!.Value)!).Postura;
                if (!Hostil(m, v.ReinoId, mc.ReinoId, postura)) continue;
                for (var i = 1; i < mc.Caminho.Count - 1; i++)
                {
                    if (mc.Tempos[i] < m.Agora || m.G.Distancia(mc.Caminho[i], v.Hex) > alcance) continue;
                    m.Agendar(new EncontroPosturaEvento
                    {
                        MarchaId = mc.Id, Partida = mc.Partida, Hex = mc.Caminho[i], VigiaLocalId = v.LocalId, VigiaExercitoId = v.ExercitoId, Quando = mc.Tempos[i],
                    });
                    break;
                }
            }
        }

        /// <summary>Uma força hostil entrou no alcance de um vigia: se tudo ainda vale, ele ataca.</summary>
        internal static void Encontrar(Mundo m, EncontroPosturaEvento e)
        {
            var mc = m.Marchas.Obter(e.MarchaId);
            if (mc == null || mc.Partida != e.Partida || mc.HexEm(m.Agora) != e.Hex) return;
            var alcance = m.P.Guerra.Postura.Alcance;
            if (e.VigiaLocalId is long lid)
            {
                var l = m.Locais.Obter(lid);
                if (l == null || l.Ruina || l.ReinoId == 0 || Batalhas.Ativa(m, l.Id) != null || m.G.Distancia(l.Hex, e.Hex) > alcance) return;
                if (!Hostil(m, l.ReinoId, mc.ReinoId, l.Postura)) return;
                var saida = Saida(m, l.Guarnicao);
                if (saida.Count == 0) return;
                var r = m.Reinos.Obter(l.ReinoId)!;
                Economia.Atualizar(m, r);
                Veterania.Normalizar(m, l);
                var prov = new Exercito { ReinoId = l.ReinoId, OrigemLocalId = l.Id, Tropas = new(saida), Marcas = l.Marcas, MarcasIniciadas = true, Postura = l.Postura };
                var antes = GT.Total(saida);
                Revide.Registrar(m, mc.ReinoId, l.ReinoId);
                var res = Campo.Lutar(m, prov, mc, m.P.Combate.TaticaPadrao, l.Postura == Postura.AtacarQualquer ? "Guarnição de " + l.Nome + " atacou" : "Guarnição de " + l.Nome + " revidou");
                // os que saíram voltam ao local (as perdas saem da guarnição) com a carga e as relíquias tomadas
                Combates.Tirar(l.Guarnicao, res.PerdasAtaque);
                if (prov.Carga.Count > 0) { Economia.Atualizar(m, r); l.Estoque.Somar(prov.Carga); }
                foreach (var id in prov.Reliquias) if (m.Reliquias.Obter(id) is { } rel) Reliquias.Guardar(m, rel, l);
                // marcas: a parte que saiu ganhou ou perdeu; a guarnição fica com a média
                var fic = GT.Total(l.Guarnicao);
                var vivos = antes - GT.Total(res.PerdasAtaque);
                var parados = Math.Max(0, fic - vivos);
                l.Marcas = fic > 0 ? (l.Marcas * parados + prov.Marcas * vivos) / fic : 0;
                l.MarcasTropas = fic;
                m.Sujar(l);
                m.Avisar(l.ReinoId, "reino");
                return;
            }
            if (e.VigiaExercitoId is long eid && m.Marchas.Obter(eid) is Exercito ex)
            {
                if (!ex.Parado || ex.BatalhaId != null || m.G.Distancia(ex.HexEm(m.Agora), e.Hex) > alcance || !SemMilicia(m, ex.Tropas)) return;
                if (ex.Tropas.Any(kv => kv.Value > 0 && m.B.U.TryGetValue(kv.Key, out var u) && u.So == "defesa")) return;   // com milícia, não sai
                if (!Hostil(m, ex.ReinoId, mc.ReinoId, ex.Postura)) return;
                Revide.Registrar(m, mc.ReinoId, ex.ReinoId);
                Campo.Lutar(m, ex, mc, m.P.Combate.TaticaPadrao, ex.Postura == Postura.AtacarQualquer ? "Exército em campo atacou" : "Exército em campo revidou");
                if (m.Marchas.ContemId(ex.Id) && GT.Total(ex.Tropas) == 0) ex.Encerrar(m);
            }
        }
    }

    public sealed class EncontroPosturaEvento : Evento
    {
        public long MarchaId { get; set; }
        public long Partida { get; set; }
        public int Hex { get; set; }
        public long? VigiaLocalId { get; set; }
        public long? VigiaExercitoId { get; set; }
        public override void Executar(Mundo m) => Vigias.Encontrar(m, this);
    }
}

namespace ReinoDePedra.Jogo.Reinos
{
    public sealed partial class Reino
    {
        /// <summary>Reinos que atacaram este há pouco (id → quando), para o revide automático. Segredo do servidor.</summary>
        public Dictionary<long, long> AtacadoPor { get; set; } = new();
    }
}
