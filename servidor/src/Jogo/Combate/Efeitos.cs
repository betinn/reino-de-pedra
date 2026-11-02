using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Combate;

/// <summary>Resultado de um objetivo: "cumprido", "parcial" ou "falhou", e o que foi obtido.</summary>
public sealed record ResultadoObjetivo(string Texto, string Estado, string? Obtido);

/// <summary>O que o ataque fez no local (para os relatórios dos dois lados).</summary>
public sealed class ResumoEfeitos
{
    public List<ResultadoObjetivo> Objetivos { get; } = new();
    public Recursos Levaram { get; } = new();
    public List<string> Reliquias { get; } = new();
    public int NiveisPerdidos { get; set; }
    public bool LocalDestruido { get; set; }
    public int TorresDerrubadas { get; set; }
    public int TorresDanificadas { get; set; }
    public int PortoesPerdidos { get; set; }
    public double Mortos { get; set; }
    public bool Ocupou { get; set; }
    public double Rendimento { get; set; } = 1;
    public string PorQue { get; set; } = "";
}

/// <summary>Efeitos por tipo: saque, sabotagem, massacre, ocupação e cerco (objetivos na ordem do plano).</summary>
public static class Efeitos
{
    private static string N(double v) => Combates.Num(Math.Floor(v + 1e-9));

    private static double Livre(Mundo m, List<Exercito> vivos) => vivos.Sum(e => Math.Max(0, e.CargaMax(m) - e.Carga.Total));

    private static void Carregar(Mundo m, List<Exercito> vivos, string k, double v)
    {
        foreach (var e in vivos)
        {
            var cabe = Math.Max(0, e.CargaMax(m) - e.Carga.Total);
            var poe = Math.Min(cabe, v);
            if (poe > 0) { e.Carga.Somar(k, poe); v -= poe; m.Sujar(e); }
            if (v <= 1e-9) break;
        }
    }

    /// <summary>Vitória do atacante: cumpre os objetivos na ordem; depois, se pedido, completa a carga.</summary>
    public static void Aplicar(Mundo m, Batalha b, PlanoAtaque p, Local l, Reino? def, List<Exercito> vivos, bool defesaRecuou, double dano, ResumoEfeitos r)
    {
        var atk = m.Reinos.Obter(b.AtacanteId)!;
        var levaCarga = Ataques.LevaCarga(p.Tipo);
        r.Rendimento = levaCarga ? Ataques.Rendimento(m, Ataques.SaquesRecentes(m, atk, l.Id)) : 1;
        var danoResta = dano;
        var cargaCheia = false;
        var dono = l.ReinoId;
        foreach (var o in p.Objetivos)
        {
            var txt = Ataques.TextoObjetivo(m, o, l);
            switch (o.K)
            {
                case "recurso":
                {
                    var k = o.R!;
                    var tem = l.Estoque.Qtd(k) * r.Rendimento;
                    var livre = Livre(m, vivos);
                    var leva = Math.Floor(Math.Min(o.Q, Math.Min(tem, livre)) + 1e-9);
                    if (leva > 0) { l.Estoque.Retirar(k, leva); Carregar(m, vivos, k, leva); r.Levaram.Somar(k, leva); m.Sujar(l); }
                    if (livre - leva < 1) cargaCheia = true;
                    r.Objetivos.Add(new(txt, leva >= o.Q - 0.5 ? "cumprido" : leva > 0 ? "parcial" : "falhou",
                        leva > 0 ? N(leva) + " de " + Logistica.NomeRecurso(k) + (leva < o.Q - 0.5 ? (livre - leva < 1 ? " · a carga encheu" : " · era o que havia") : "")
                            : livre < 1 ? "a carga já estava cheia" : "não havia no local"));
                    break;
                }
                case "reliquia":
                {
                    var rels = Reliquias.NoLocal(m, l.Id).ToList();
                    if (rels.Count == 0) { r.Objetivos.Add(new(txt, "falhou", "não havia relíquia no local")); break; }
                    var nomes = string.Join(", ", rels.Select(x => x.Nome));
                    if (p.Tipo == Ataques.Ocupacao) { r.Objetivos.Add(new(txt, "cumprido", nomes + " · fica no local tomado")); r.Reliquias.AddRange(rels.Select(x => x.Nome)); break; }
                    foreach (var rel in rels) Reliquias.Carregar(m, rel, vivos[0]);
                    r.Reliquias.AddRange(rels.Select(x => x.Nome));
                    r.Objetivos.Add(new(txt, "cumprido", nomes + " · volta com as tropas"));
                    break;
                }
                case "construcao":
                {
                    var q = (int)o.Q;
                    int perdeu;
                    if (l.Tipo == TipoLocal.Castelo) { var antes = l.Nivel; l.Nivel = Math.Max(1, l.Nivel - q); perdeu = antes - l.Nivel; }
                    else
                    {
                        perdeu = Math.Min(q, l.Nivel);
                        l.Nivel -= perdeu;
                        if (l.Nivel <= 0) Destruir(m, l, r);
                    }
                    m.Sujar(l);
                    r.NiveisPerdidos += perdeu;
                    r.Objetivos.Add(new(txt, perdeu >= q ? "cumprido" : perdeu > 0 ? "parcial" : "falhou",
                        r.LocalDestruido ? "o local foi destruído" : perdeu > 0 ? "−" + perdeu + (perdeu > 1 ? " níveis" : " nível") : "o castelo não desce do nível 1"));
                    break;
                }
                case "torre":
                {
                    var q = (int)o.Q;
                    var torres = m.Torres.Where(t => t.ReinoId == dono && dono != 0 && m.G.Distancia(t.Hex, l.Hex) <= Defesas.Alcance(m, t))
                        .OrderBy(t => m.G.Distancia(t.Hex, l.Hex)).ThenBy(t => t.Id).ToList();
                    int caiu = 0, danificou = 0;
                    foreach (var t in torres)
                    {
                        if (caiu >= q || danoResta <= 1e-9) break;
                        var usa = Math.Min(t.Estrutura, danoResta);
                        danoResta -= usa;
                        if (Defesas.DanificarTorre(m, t, usa)) caiu++; else danificou++;
                    }
                    r.TorresDerrubadas += caiu; r.TorresDanificadas += danificou;
                    r.Objetivos.Add(new(txt, torres.Count == 0 ? "falhou" : caiu >= q ? "cumprido" : caiu + danificou > 0 ? "parcial" : "falhou",
                        torres.Count == 0 ? "nenhuma torre no alcance" : dano <= 0 ? "sem aríetes nem trebuchets, as torres não sofrem dano"
                        : caiu > 0 ? caiu + (caiu > 1 ? " torres derrubadas" : " torre derrubada") + (danificou > 0 ? ", " + danificou + " danificada" + (danificou > 1 ? "s" : "") : "")
                        : danificou > 0 ? "torre danificada" : "o dano acabou antes"));
                    break;
                }
                case "portoes":
                {
                    var q = (int)o.Q;
                    if (l.Tipo != TipoLocal.Castelo || l.Portoes <= 0) { r.Objetivos.Add(new(txt, "falhou", "o castelo não tem portões")); break; }
                    var alvo = Math.Max(0, l.Portoes - q);
                    var precisa = Math.Max(0, l.EstruturaPortoes - alvo * m.P.PortoesEstrutura);
                    var usa = Math.Min(precisa, danoResta);
                    danoResta -= usa;
                    var caiu = Defesas.DanificarPortoes(m, l, usa);
                    r.PortoesPerdidos += caiu;
                    r.Objetivos.Add(new(txt, caiu >= q ? "cumprido" : usa > 0 ? "parcial" : "falhou",
                        dano <= 0 ? "sem aríetes nem trebuchets, os portões não sofrem dano" : caiu > 0 ? "−" + caiu + (caiu > 1 ? " níveis" : " nível") : "portões danificados"));
                    break;
                }
                case "populacao":
                {
                    if (defesaRecuou || def == null) { r.Objetivos.Add(new(txt, "falhou", "a população se protegeu")); break; }
                    var popL = Combates.PopDoLocal(m, def, l);
                    var tropas = vivos.Sum(e => GT.Total(e.Tropas));
                    var mata = Math.Floor(Math.Min(o.Q, Math.Min(popL, tropas * m.P.Combate.MassacrePorTropa)) + 1e-9);
                    if (mata > 0) { def.Pop = Math.Max(0, def.Pop - mata); m.Sujar(def); r.Mortos += mata; }
                    r.Objetivos.Add(new(txt, mata >= o.Q - 0.5 ? "cumprido" : mata > 0 ? "parcial" : "falhou", mata > 0 ? N(mata) + " mortos" : "não havia ninguém"));
                    break;
                }
                case "tomar":
                    break;   // depois dos outros objetivos
            }
        }
        if (levaCarga && p.Completar)
        {
            var disp = l.Estoque.Where(kv => kv.Value * r.Rendimento >= 1).ToDictionary(kv => kv.Key, kv => kv.Value * r.Rendimento);
            var total = disp.Values.Sum();
            var livre = Livre(m, vivos);
            if (total > 0 && livre >= 1)
            {
                var f = Math.Min(1, livre / total);
                foreach (var (k, v) in disp)
                {
                    var leva = Math.Floor(v * f + 1e-9);
                    if (leva <= 0) continue;
                    l.Estoque.Retirar(k, leva); Carregar(m, vivos, k, leva); r.Levaram.Somar(k, leva);
                }
                m.Sujar(l);
                if (f < 1) cargaCheia = true;
            }
        }
        if (p.Objetivos.Any(o => o.K == "tomar") && !r.LocalDestruido)
        {
            Ocupar(m, l, atk);
            r.Ocupou = true;
            r.Objetivos.Insert(0, new("Tomar o local", "cumprido", "o local é seu até alguém retomar"));
        }
        if (levaCarga) Ataques.RegistrarSaque(m, atk, l.Id);
        r.PorQue = r.Ocupou ? "Tomaram o local e ficaram nele como guarnição."
            : r.Objetivos.All(o => o.Estado == "cumprido") ? "Cumpriram os objetivos."
            : cargaCheia ? "A carga encheu."
            : "Fizeram o que havia para fazer no local.";
    }

    /// <summary>Derrota ou recuo: só os trebuchets, à distância, chegam a bater em torres e portões.</summary>
    public static void SoDanoDeCerco(Mundo m, PlanoAtaque p, Local l, double dano, ResumoEfeitos r, bool venceu, string resultado, double? limite, bool ordenado)
    {
        var danoResta = venceu ? 0 : dano;
        foreach (var o in p.Objetivos)
        {
            var txt = Ataques.TextoObjetivo(m, o, l);
            if (danoResta > 1e-9 && o.K == "torre")
            {
                int caiu = 0, danificou = 0;
                foreach (var t in Defesas.NoAlcance(m, l))
                {
                    if (caiu >= o.Q || danoResta <= 1e-9) break;
                    var usa = Math.Min(t.Estrutura, danoResta); danoResta -= usa;
                    if (Defesas.DanificarTorre(m, t, usa)) caiu++; else danificou++;
                }
                r.TorresDerrubadas += caiu; r.TorresDanificadas += danificou;
                if (caiu + danificou > 0) { r.Objetivos.Add(new(txt, caiu >= o.Q ? "cumprido" : "parcial", "os trebuchets bateram de longe")); continue; }
            }
            else if (danoResta > 1e-9 && o.K == "portoes" && l.Tipo == TipoLocal.Castelo && l.Portoes > 0)
            {
                var alvo = Math.Max(0, l.Portoes - (int)o.Q);
                var usa = Math.Min(Math.Max(0, l.EstruturaPortoes - alvo * m.P.PortoesEstrutura), danoResta); danoResta -= usa;
                var caiu = Defesas.DanificarPortoes(m, l, usa);
                r.PortoesPerdidos += caiu;
                if (usa > 0) { r.Objetivos.Add(new(txt, caiu >= o.Q ? "cumprido" : "parcial", "os trebuchets bateram de longe")); continue; }
            }
            r.Objetivos.Add(new(txt, "falhou", venceu ? "ninguém sobrou para cumprir" : resultado == "recuo" ? "recuaram antes" : "foram derrotados"));
        }
        r.PorQue = venceu ? "Venceram, mas nenhuma tropa sobrou."
            : resultado != "recuo" ? "Foram derrotados."
            : ordenado ? "Recuaram por ordem."
            : "Recuaram ao chegar ao limite da tática (" + Math.Round((limite ?? 1) * 100) + "% de baixas).";
    }

    /// <summary>O local passa ao atacante: mantém o nível, as relíquias ficam e mudam de dono.</summary>
    public static void Ocupar(Mundo m, Local l, Reino novo)
    {
        Economia.Atualizar(m, novo);
        foreach (var rel in Reliquias.NoLocal(m, l.Id)) { rel.ReinoId = novo.Id; m.Sujar(rel); }
        var antigo = l.ReinoId;
        l.Guarnicao.Clear();
        l.Ruina = false;
        m.MudarDono(l, novo.Id);
        Exploracao.Nevoas.RevelarArea(m, novo.Id, l.Hex, Exploracao.Nevoas.RaioLocal(m, l));
        if (antigo != 0) m.Avisar(antigo, "reino");
        m.Avisar(novo.Id, "reino");
    }

    /// <summary>Ruína ou terra livre, sem defesa: as tropas tomam o local na chegada, sem batalha.</summary>
    public static void OcuparSemDono(Mundo m, Exercito ex, Local l)
    {
        var r = m.Reinos.Obter(ex.ReinoId)!;
        var rels = Reliquias.NoLocal(m, l.Id).Select(x => x.Nome).ToList();
        var partes = GT.Partes(m, ex.Tropas);
        var nome = Ataques.NomeAlvo(l);
        Ocupar(m, l, r);
        ex.EntrarNoLocal(m, l);
        RelatoriosCombate.Ocupacao(m, r, l, nome, partes, rels);
    }

    /// <summary>Sabotagem levou o local ao nível 0: vira ruína sem dono (as relíquias ficam lá, sem dono).</summary>
    private static void Destruir(Mundo m, Local l, ResumoEfeitos r)
    {
        var antigo = l.ReinoId;
        l.Nivel = 1; l.Ruina = true; l.Guarnicao.Clear();
        foreach (var rel in Reliquias.NoLocal(m, l.Id)) { rel.ReinoId = 0; m.Sujar(rel); }
        m.MudarDono(l, 0);
        r.LocalDestruido = true;
        if (antigo != 0) m.Avisar(antigo, "reino");
    }

    /// <summary>A defesa recuou: as tropas que sobraram vão ao local próprio mais próximo (ou ficam no campo).</summary>
    public static Exercito Fugir(Mundo m, Reino r, Local de, Dictionary<string, int> grupo)
    {
        var ex = new Exercito
        {
            ReinoId = r.Id, OrigemLocalId = de.Id, Ordem = OrdemMover.Id, Tropas = grupo, Vel = GT.Velocidade(m, grupo),
            Origem = de.Hex, Destino = de.Hex,
        };
        Local? alvo = null; Rota? rota = null;
        foreach (var l in m.LocaisDe(r.Id).Where(x => !x.Ruina && x.Id != de.Id))
        {
            var rr = Caminhos.Calcular(m, de.Hex, l.Hex, ex.Vel, new OpcoesCaminho { Forca = GT.ForcaFauna(m, grupo), ReinoId = r.Id });
            if (rr.Hexes[^1] != l.Hex) continue;
            if (rota == null || rr.TotalMin < rota.TotalMin) { alvo = l; rota = rr; }
        }
        if (alvo == null || rota == null)
        {
            m.Marchas.Adicionar(ex);
            ex.Parar(m);
            return ex;
        }
        ex.OrigemLocalId = alvo.Id; ex.AlvoLocalId = alvo.Id; ex.Ordem = OrdemRetornar.Id; ex.Retornando = true;
        ex.Partir(m, rota);
        Exercitos.Avisar(m, ex, "Tropas recuaram", GT.Partes(m, grupo) + " deixaram " + de.Nome + " rumo a " + alvo.Nome + ".");
        return ex;
    }
}
