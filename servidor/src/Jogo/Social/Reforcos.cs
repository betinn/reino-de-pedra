using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Social
{
    /// <summary>Tropas de um aliado defendendo um local: ficam na guarnição (lutam na defesa), mas continuam dele.</summary>
    public sealed class ReforcoAliado
    {
        public long ReinoId { get; set; }
        /// <summary>Local do aliado de onde saíram (para onde voltam).</summary>
        public long OrigemLocalId { get; set; }
        public Dictionary<string, int> Tropas { get; set; } = new();
        public long Desde { get; set; }
    }

    /// <summary>
    /// Reforço entre aliados (ordem "reforcar" a um local de aliado, pelos ganchos de <see cref="OrdemReforcar"/>).
    /// As tropas entram na guarnição do local e defendem com ela, mas: continuam no teto de população de quem mandou
    /// (<see cref="Economia.OcupantesExtras"/>), o dono do local não pode usá-las (<see cref="GT.Reservadas"/>) e só
    /// voltam por ordem de quem mandou (ou quando a aliança se desfaz entre os dois). Perdas da batalha são divididas
    /// na proporção de cada unidade; se a defesa recua, o reforço volta para casa.
    /// </summary>
    public static class Reforcos
    {
        public static IEnumerable<Local> ComReforco(Mundo m) => m.Locais.Where(l => l.ReforcosAliados.Count > 0);

        /// <summary>Pessoas que o reino tem em locais de aliados menos as de aliados nos locais dele (vai para o teto).</summary>
        public static int Ocupantes(Mundo m, Reino r)
        {
            var n = 0;
            foreach (var l in ComReforco(m))
                foreach (var e in l.ReforcosAliados)
                {
                    if (e.ReinoId == r.Id) n += Economia.PopDeGrupo(m, e.Tropas);
                    if (l.ReinoId == r.Id) n -= Economia.PopDeGrupo(m, e.Tropas);
                }
            return n;
        }

        public static int Reservadas(Mundo m, Local l, string unidade) =>
            l.ReforcosAliados.Count == 0 ? 0 : l.ReforcosAliados.Sum(e => e.Tropas.GetValueOrDefault(unidade));

        /// <summary>Gancho de <see cref="OrdemReforcar.Aceita"/>: local de aliado (não em ruína).</summary>
        public static bool Aceita(Mundo m, Reino r, Local l) => !l.Ruina && Aliancas.SaoAliados(m, r.Id, l.ReinoId);

        /// <summary>Gancho de <see cref="OrdemReforcar.Chegada"/>: o reforço entra na defesa do local do aliado.</summary>
        public static bool Chegou(Mundo m, Exercito ex, Local l)
        {
            if (l.Ruina || !Aliancas.SaoAliados(m, ex.ReinoId, l.ReinoId)) return false;   // a aliança acabou no caminho: volta
            if (ex.Reliquias.Count > 0) return false;   // relíquia não fica em local de outro reino
            var r = m.Reinos.Obter(ex.ReinoId)!;
            var dono = m.Reinos.Obter(l.ReinoId)!;
            Economia.Atualizar(m, r); Economia.Atualizar(m, dono);
            var grupo = GT.Limpo(ex.Tropas);
            GT.Devolver(m, l, grupo);
            var e = l.ReforcosAliados.FirstOrDefault(x => x.ReinoId == r.Id);
            if (e == null) l.ReforcosAliados.Add(e = new ReforcoAliado { ReinoId = r.Id, OrigemLocalId = ex.OrigemLocalId, Desde = m.Agora });
            GT.Somar(e.Tropas, grupo);
            if (ex.Carga.Count > 0) l.Estoque.Somar(ex.Carga);
            m.Sujar(l);
            ex.Tropas = new(); ex.Carga = new();
            ex.Encerrar(m);
            var partes = GT.Partes(m, grupo);
            if (Batalhas.Ativa(m, l.Id) is { } b && b.DefensorId == l.ReinoId)
                Batalhas.Recalcular(m, b, "Reforço aliado chegou: " + partes + ".", "defesa");
            Registros.Notificar(m, r.Id, "tropas", "Reforço chegou", partes + " defendem " + l.Nome + ", de " + dono.Nome + ".", "tropas");
            Registros.Notificar(m, dono.Id, "alianca", "Reforço de " + r.Nome, partes + " defendem " + l.Nome + ". Continuam sendo de " + r.Nome + ".", "reino?local=" + l.Id);
            m.Avisar(r.Id, "reino"); m.Avisar(dono.Id, "reino");
            return true;
        }

        /// <summary>Quem mandou ordena a volta: as tropas saem do local do aliado e voltam ao local de origem (ou ao próprio mais próximo).</summary>
        public static Exercito Retornar(Mundo m, Reino r, long localId)
        {
            var l = m.Locais.Obter(localId) ?? throw new RegraException("Local não encontrado.", 404);
            var e = l.ReforcosAliados.FirstOrDefault(x => x.ReinoId == r.Id) ?? throw new RegraException("Você não tem tropas neste local.", 404);
            return Devolver(m, l, e, "As tropas voltam para casa.") ?? throw new RegraException("Não sobrou ninguém do reforço.");
        }

        /// <summary>Tira o reforço do local e o manda para casa. Null se não sobrou ninguém.</summary>
        private static Exercito? Devolver(Mundo m, Local l, ReforcoAliado e, string motivo)
        {
            var r = m.Reinos.Obter(e.ReinoId);
            l.ReforcosAliados.Remove(e); m.Sujar(l);
            var grupo = new Dictionary<string, int>();
            foreach (var (k, n) in e.Tropas)
            {
                var q = Math.Min(n, l.Guarnicao.GetValueOrDefault(k));
                if (q > 0) grupo[k] = q;
            }
            if (grupo.Count == 0 || r == null || !r.Ativo) return null;
            Economia.Atualizar(m, r);
            if (m.Reinos.Obter(l.ReinoId) is { } dono) Economia.Atualizar(m, dono);
            Combates.Tirar(l.Guarnicao, grupo);
            var ex = Sair(m, r, l, grupo, e.OrigemLocalId);
            if (Batalhas.Ativa(m, l.Id) is { } b && b.DefensorId == l.ReinoId)
                Batalhas.Recalcular(m, b, "Reforço aliado saiu: " + GT.Partes(m, grupo) + ".", "defesa");
            Registros.Notificar(m, r.Id, "tropas", "Reforço voltando", GT.Partes(m, grupo) + " deixam " + l.Nome + ". " + motivo, "tropas");
            if (l.ReinoId != 0) Registros.Notificar(m, l.ReinoId, "alianca", "Reforço de " + r.Nome + " saiu", GT.Partes(m, grupo) + " deixaram " + l.Nome + ".", "reino?local=" + l.Id);
            m.Avisar(r.Id, "reino"); m.Avisar(l.ReinoId, "reino");
            return ex;
        }

        /// <summary>Cria o exército de quem mandou no hexágono do local e o põe a caminho de casa.</summary>
        private static Exercito Sair(Mundo m, Reino r, Local l, Dictionary<string, int> grupo, long origemLocalId)
        {
            var ex = new Exercito
            {
                ReinoId = r.Id, OrigemLocalId = origemLocalId, Ordem = OrdemMover.Id, Tropas = grupo, Vel = GT.Velocidade(m, grupo),
                Origem = l.Hex, Destino = l.Hex, Caminho = [l.Hex], Tempos = [m.Agora],
            };
            m.Marchas.Adicionar(ex);
            Exercitos.Retornar(m, ex);
            return ex;
        }

        /// <summary>A aliança entre os dois acabou: os reforços de um nos locais do outro voltam para casa.</summary>
        public static void RetornarEntre(Mundo m, Reino a, Reino b)
        {
            foreach (var l in ComReforco(m).ToList())
                foreach (var e in l.ReforcosAliados.ToList())
                    if ((l.ReinoId == a.Id && e.ReinoId == b.Id) || (l.ReinoId == b.Id && e.ReinoId == a.Id))
                        Devolver(m, l, e, "A aliança entre os reinos acabou.");
        }

        /// <summary>
        /// Batalha encerrada num local com reforço: cada reforço perde a sua parte das perdas da defesa (por unidade). Se a defesa
        /// recuou, o reforço sai do exército que fugiu e volta para casa; se o local mudou de dono, o reforço caiu com a defesa.
        /// </summary>
        public static void AoTerminar(Mundo m, ResultadoCombate rc)
        {
            var l = m.Locais.Obter(rc.LocalId);
            if (l == null || l.ReforcosAliados.Count == 0) return;
            foreach (var e in l.ReforcosAliados)
            {
                var perdas = new Dictionary<string, int>();
                foreach (var (k, n) in e.Tropas)
                {
                    var tot = rc.TropasDefesa.GetValueOrDefault(k);
                    var p = tot > 0 ? (int)Math.Round(n * (double)rc.PerdasDefesa.GetValueOrDefault(k) / tot) : 0;
                    if (p > 0) perdas[k] = Math.Min(n, p);
                }
                Combates.Tirar(e.Tropas, perdas);
                if (perdas.Count > 0 && m.Reinos.Obter(e.ReinoId) is { } q)
                    Registros.Notificar(m, q.Id, "batalhas", "Seu reforço lutou em " + l.Nome, "Perdas: " + GT.Partes(m, perdas) + ".", "tropas");
            }
            l.ReforcosAliados.RemoveAll(e => GT.Total(e.Tropas) == 0);
            m.Sujar(l);
            if (rc.Resultado == "defesa-recuou")
            {
                // a guarnição saiu inteira num exército do defensor: o reforço sai dele e volta para casa
                var fuga = m.Marchas.OfType<Exercito>().FirstOrDefault(x => x.ReinoId == rc.DefensorId && x.Partida == m.Agora && x.Caminho.Count > 0 && x.Caminho[0] == l.Hex);
                foreach (var e in l.ReforcosAliados.ToList())
                {
                    var r = m.Reinos.Obter(e.ReinoId);
                    var grupo = new Dictionary<string, int>();
                    if (fuga != null)
                        foreach (var (k, n) in e.Tropas)
                        {
                            var q = Math.Min(n, fuga.Tropas.GetValueOrDefault(k));
                            if (q > 0) grupo[k] = q;
                        }
                    l.ReforcosAliados.Remove(e);
                    if (r == null || grupo.Count == 0) continue;
                    Combates.Tirar(fuga!.Tropas, grupo);
                    m.Sujar(fuga);
                    Sair(m, r, l, grupo, e.OrigemLocalId);
                    Registros.Notificar(m, r.Id, "tropas", "Reforço recuou", GT.Partes(m, grupo) + " deixaram " + l.Nome + " com a defesa e voltam para casa.", "tropas");
                }
                if (fuga != null && GT.Total(fuga.Tropas) == 0) fuga.Encerrar(m);
                m.Sujar(l);
                return;
            }
            if (!Aliancas.SaoAliados(m, rc.DefensorId, l.ReinoId) && l.ReinoId != rc.DefensorId)
            {
                l.ReforcosAliados.Clear();   // o local mudou de dono: o reforço caiu com a defesa
                m.Sujar(l);
                return;
            }
            // nunca mais reservado do que há na guarnição
            foreach (var e in l.ReforcosAliados)
                foreach (var k in e.Tropas.Keys.ToList())
                {
                    var tem = l.Guarnicao.GetValueOrDefault(k);
                    if (e.Tropas[k] > tem) { if (tem > 0) e.Tropas[k] = tem; else e.Tropas.Remove(k); }
                }
            l.ReforcosAliados.RemoveAll(e => GT.Total(e.Tropas) == 0);
            m.Sujar(l);
        }
    }
}

namespace ReinoDePedra.Jogo.Reinos
{
    public sealed partial class Local
    {
        /// <summary>Reforço de aliados neste local (as tropas também estão na guarnição; ver <see cref="Social.Reforcos"/>).</summary>
        public List<Social.ReforcoAliado> ReforcosAliados { get; set; } = new();
    }
}
