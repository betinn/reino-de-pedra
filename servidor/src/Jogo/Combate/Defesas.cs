using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;

namespace ReinoDePedra.Jogo.Combate
{
    /// <summary>
    /// Torre de arqueiros: construção própria num hexágono livre (não é um local: não produz, não tem guarnição e não é
    /// alvo direto). Os arqueiros no alto (nível × P.torre.arqPorNivel, defesa ×3, fora do teto de bônus) defendem os
    /// locais do mesmo dono no alcance (nível + 1). Aríetes e trebuchets derrubam a estrutura (nível × P.torre.estrutura);
    /// o nível cai junto com ela.
    /// </summary>
    public sealed partial class Torre : Documento
    {
        public long ReinoId { get; set; }
        public int Hex { get; set; }
        public int Nivel { get; set; } = 1;
        public double Estrutura { get; set; }
        public long CriadaEm { get; set; }
        /// <summary>Reinos que já viram a torre (outros a enxergam no mapa depois de vê-la uma vez, como última informação).</summary>
        public HashSet<long> ConhecidaPor { get; set; } = new();
    }
}

namespace ReinoDePedra.Jogo
{
    public sealed partial class Mundo
    {
        public Colecao<Combate.Torre> Torres { get; } = new("torres");
    }
}

namespace ReinoDePedra.Jogo.Reinos
{
    public sealed partial class Local
    {
        /// <summary>Nível dos portões (só no castelo). Multiplica a defesa do castelo por P.portoes[nível].</summary>
        public int Portoes { get; set; }
        /// <summary>Estrutura atual dos portões (nível × P.portoesEstrutura quando inteiros).</summary>
        public double EstruturaPortoes { get; set; }
    }
}

namespace ReinoDePedra.Jogo.Combate
{
    /// <summary>Torres de arqueiros e portões do castelo: obras, alcance, quem protegem e dano de cerco.</summary>
    public static class Defesas
    {
        /// <summary>Bloqueios extras para subir os portões a um nível (reino, nível alvo) → motivo ou null.</summary>
        public static List<Func<Mundo, Reino, int, string?>> RequisitosPortao { get; } = new();

        public static int Alcance(Mundo m, Torre t) => m.F.AlcanceTorre(Math.Max(1, t.Nivel));
        public static int Arqueiros(Mundo m, Torre t) => t.Nivel * m.P.Torre.ArqPorNivel;
        public static double EstruturaCheia(Mundo m, int nivel) => nivel * m.P.Torre.Estrutura;
        public static int PortoesMax(Mundo m) => m.P.Portoes.Length - 1;

        public static IEnumerable<Torre> DoReino(Mundo m, long reinoId) => m.Torres.Where(t => t.ReinoId == reinoId);
        public static Torre? NoHex(Mundo m, int hex) => m.Torres.FirstOrDefault(t => t.Hex == hex);

        /// <summary>Torres do dono do local que o cobrem (mais próximas primeiro).</summary>
        public static List<Torre> NoAlcance(Mundo m, Local l) =>
            l.ReinoId == 0 || l.Ruina ? []
                : m.Torres.Where(t => t.ReinoId == l.ReinoId && m.G.Distancia(t.Hex, l.Hex) <= Alcance(m, t))
                    .OrderBy(t => m.G.Distancia(t.Hex, l.Hex)).ThenBy(t => t.Id).ToList();

        /// <summary>Arqueiros no alto que defendem o local.</summary>
        public static int ArqueirosNoAlto(Mundo m, Local l) => NoAlcance(m, l).Sum(t => Arqueiros(m, t));

        /// <summary>Locais do dono que a torre protege.</summary>
        public static List<Local> Protege(Mundo m, Torre t) =>
            m.LocaisDe(t.ReinoId).Where(l => !l.Ruina && m.G.Distancia(t.Hex, l.Hex) <= Alcance(m, t)).ToList();

        // ---------------------------------------------------------------- obras

        /// <summary>Motivo para não erguer uma torre neste hexágono, ou null se pode.</summary>
        public static string? MotivoTorre(Mundo m, Reino r, int hex)
        {
            if (!m.G.Valido(hex)) return "Hexágono fora do mapa.";
            if (!Nevoas.Explorado(m, r.Id, hex)) return "Explore a área antes de construir.";
            if (m.Mapa.Rio[hex]) return "Não dá para erguer a torre sobre o rio.";
            if (!Obras.HexLivrePara(m, r, hex)) return "O hexágono não está livre.";
            if (r.Fila(Obras.Fila).Itens.Any(i => i.Tipo is ObraTorre.Id or ObraFundar.Id && i.Hex == hex)) return "Já há uma obra na fila para este hexágono.";
            var alcance1 = m.F.AlcanceTorre(1);
            if (!m.LocaisDe(r.Id).Any(l => !l.Ruina && m.G.Distancia(l.Hex, hex) <= alcance1))
                return "A torre precisa ficar perto de um local seu (até " + alcance1 + " hexágonos).";
            return null;
        }

        public static ItemFila NovaTorre(Mundo m, Reino r, int hex)
        {
            var motivo = MotivoTorre(m, r, hex);
            if (motivo != null) throw new RegraException(motivo);
            return Filas.Enfileirar(m, r, Obras.Fila, new ItemFila
            {
                Tipo = ObraTorre.Id, Hex = hex, NivelAlvo = 1, Rotulo = "Torre de arqueiros",
                Custo = Recursos.De(m.F.CustoTorre(1)), DuracaoSeg = m.F.TempoTorre(1),
            });
        }

        public static Torre Da(Mundo m, Reino r, long torreId) =>
            m.Torres.Obter(torreId) is { } t && t.ReinoId == r.Id ? t : throw new RegraException("Torre não encontrada.", 404);

        /// <summary>Nível que a torre terá depois das melhorias já na fila, mais uma.</summary>
        public static int NivelAlvoTorre(Reino r, Torre t) =>
            t.Nivel + r.Fila(Obras.Fila).Itens.Count(i => i.Tipo == ObraTorreNivel.Id && i.Param == t.Id.ToString()) + 1;

        public static ItemFila SubirTorre(Mundo m, Reino r, long torreId)
        {
            var t = Da(m, r, torreId);
            var alvo = NivelAlvoTorre(r, t);
            if (alvo > m.P.Torre.NivelMax) throw new RegraException("A torre já está no nível máximo.");
            return Filas.Enfileirar(m, r, Obras.Fila, new ItemFila
            {
                Tipo = ObraTorreNivel.Id, Hex = t.Hex, NivelAlvo = alvo, Param = t.Id.ToString(),
                Rotulo = "Torre de arqueiros nível " + alvo,
                Custo = Recursos.De(m.F.CustoTorre(alvo)), DuracaoSeg = m.F.TempoTorre(alvo),
            });
        }

        public static Dictionary<string, double> CustoPortoes(Mundo m, int nivel)
        {
            var p = m.P.Combate.Portao;
            var total = p.CustoN1 * Math.Pow(p.CustoCresc, nivel - 1);
            return p.Receita.ToDictionary(kv => kv.Key, kv => Config.Formulas.ArredJs(total * kv.Value / 10) * 10);
        }
        public static double TempoPortoes(Mundo m, int nivel) => m.P.Combate.Portao.TempoN1 * nivel;

        public static int NivelAlvoPortoes(Reino r, Local castelo) =>
            castelo.Portoes + r.Fila(Obras.Fila).Itens.Count(i => i.Tipo == ObraPortoes.Id) + 1;

        /// <summary>Motivo que impede subir os portões ao nível, ou null.</summary>
        public static string? BloqueioPortoes(Mundo m, Reino r, int nivel)
        {
            if (nivel > PortoesMax(m)) return "Os portões já estão no nível máximo.";
            if (nivel > m.P.Combate.Portao.NivelSemEra)
            {
                var era = m.P.Eras.TryGetValue("cerco", out var e) ? e.Nome : "";
                if (!Recrutamento.ReqCumprido.Any(f => f(m, r, era))) return "Portões nível " + nivel + " exigem a " + era + ".";
            }
            foreach (var f in RequisitosPortao) { var x = f(m, r, nivel); if (x != null) return x; }
            return null;
        }

        public static ItemFila SubirPortoes(Mundo m, Reino r)
        {
            var c = m.Locais.Obter(r.CasteloId);
            if (c == null || c.ReinoId != r.Id || c.Ruina) throw new RegraException("Seu reino não tem castelo.");
            var alvo = NivelAlvoPortoes(r, c);
            var b = BloqueioPortoes(m, r, alvo);
            if (b != null) throw new RegraException(b);
            return Filas.Enfileirar(m, r, Obras.Fila, new ItemFila
            {
                Tipo = ObraPortoes.Id, LocalId = c.Id, Hex = c.Hex, NivelAlvo = alvo, Rotulo = "Portões nível " + alvo,
                Custo = Recursos.De(CustoPortoes(m, alvo)), DuracaoSeg = TempoPortoes(m, alvo),
            });
        }

        // ---------------------------------------------------------------- dano de cerco

        /// <summary>Dano numa torre; devolve true se ela caiu (sai do mapa).</summary>
        public static bool DanificarTorre(Mundo m, Torre t, double dano)
        {
            t.Estrutura = Math.Max(0, t.Estrutura - dano);
            if (t.Estrutura <= 1e-6) { m.Torres.Remover(t); m.Avisar(t.ReinoId, "mapa"); return true; }
            t.Nivel = Math.Max(1, (int)Math.Ceiling(t.Estrutura / m.P.Torre.Estrutura - 1e-9));
            m.Sujar(t);
            return false;
        }

        /// <summary>Dano nos portões do castelo; devolve quantos níveis caíram.</summary>
        public static int DanificarPortoes(Mundo m, Local c, double dano)
        {
            if (c.Portoes <= 0) return 0;
            var antes = c.Portoes;
            c.EstruturaPortoes = Math.Max(0, c.EstruturaPortoes - dano);
            c.Portoes = (int)Math.Ceiling(c.EstruturaPortoes / m.P.PortoesEstrutura - 1e-9);
            m.Sujar(c);
            return antes - c.Portoes;
        }
    }

    /// <summary>Obra: torre nova num hexágono livre (Hex). O material vai até lá a pé.</summary>
    public sealed class ObraTorre : ITipoItemFila
    {
        public const string Id = "torre";
        public string Tipo => Id;
        public string? Revisar(Mundo m, Reino r, ItemFila item) => Obras.HexLivreParaObra(m, r, item.Hex) ? null : "alguém ocupou o hexágono.";
        public void Concluir(Mundo m, Reino r, ItemFila item)
        {
            if (!Obras.HexLivreParaObra(m, r, item.Hex))
            {
                // alguém ocupou o hexágono antes: o material volta ao castelo
                var c = m.Locais.Obter(r.CasteloId);
                if (c != null) { c.Estoque.Somar(item.Entregue); m.Sujar(c); }
                Registros.Notificar(m, r.Id, "obras", "Torre não erguida", "O hexágono foi ocupado antes. O material voltou ao castelo.", "construcao?aba=defesas");
                return;
            }
            var t = m.Torres.Adicionar(new Torre { ReinoId = r.Id, Hex = item.Hex, Nivel = 1, Estrutura = Defesas.EstruturaCheia(m, 1), CriadaEm = m.Agora });
            Nevoas.RevelarArea(m, r.Id, t.Hex, Defesas.Alcance(m, t));
            Registros.Notificar(m, r.Id, "obras", "Torre erguida", "Arqueiros no alto protegem os locais em volta.", "construcao?aba=defesas");
            m.Avisar(r.Id, "mapa");
        }
    }

    /// <summary>Obra: subir uma torre de nível (Param = id da torre). A estrutura fica cheia no nível novo.</summary>
    public sealed class ObraTorreNivel : ITipoItemFila
    {
        public const string Id = "torre-nivel";
        public string Tipo => Id;
        public string? Revisar(Mundo m, Reino r, ItemFila item) =>
            long.TryParse(item.Param, out var id) && m.Torres.Obter(id) is { } t && t.ReinoId == r.Id ? null : "a torre não existe mais.";
        public void Concluir(Mundo m, Reino r, ItemFila item)
        {
            var t = long.TryParse(item.Param, out var id) ? m.Torres.Obter(id) : null;
            if (t == null || t.ReinoId != r.Id)
            {
                var c = m.Locais.Obter(r.CasteloId);
                if (c != null) { c.Estoque.Somar(item.Entregue); m.Sujar(c); }
                return;
            }
            t.Nivel = Math.Min(m.P.Torre.NivelMax, Math.Max(t.Nivel, item.NivelAlvo));
            t.Estrutura = Defesas.EstruturaCheia(m, t.Nivel);
            m.Sujar(t);
            Registros.Notificar(m, r.Id, "obras", "Obra concluída", item.Rotulo, "construcao?aba=defesas");
            m.Avisar(r.Id, "mapa");
        }
    }

    /// <summary>Obra: subir os portões do castelo (LocalId = castelo). A estrutura fica cheia no nível novo.</summary>
    public sealed class ObraPortoes : ITipoItemFila
    {
        public const string Id = "portoes";
        public string Tipo => Id;
        public void Concluir(Mundo m, Reino r, ItemFila item)
        {
            var c = item.LocalId is long id ? m.Locais.Obter(id) : null;
            if (c == null || c.ReinoId != r.Id || c.Tipo != TipoLocal.Castelo) return;
            c.Portoes = Math.Min(Defesas.PortoesMax(m), Math.Max(c.Portoes, item.NivelAlvo));
            c.EstruturaPortoes = c.Portoes * m.P.PortoesEstrutura;
            m.Sujar(c);
            Registros.Notificar(m, r.Id, "obras", "Obra concluída", item.Rotulo, "construcao?aba=defesas");
        }
    }
}
