using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Forja;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Valiosos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;
using PS = ReinoDePedra.Jogo.Pessoas.Pessoas;

namespace ReinoDePedra.Jogo.Marchas;

/// <summary>
/// Juntar e separar tropas em campo. Juntar: duas tropas viram uma; no mesmo hexágono, na hora; em hexágonos diferentes, a primeira
/// vai até a outra (ordem <see cref="OrdemJuntar"/>) e se junta ao chegar. Quem fica é a segunda, com a ordem, a postura e o
/// estandarte dela; carga, relíquias e equipamento lendário passam para ela. Separar: as pessoas escolhidas saem e formam uma
/// tropa nova, parada onde estão, com a parte da carga que cabe a elas; relíquias e equipamento ficam com quem fica. Em
/// batalha, ou caçando, extraindo, escavando, coletando ou atacando, a tropa recusa os dois.
/// </summary>
public static class Grupos
{
    private static readonly HashSet<string> OrdensLivres =
        [OrdemMover.Id, OrdemReforcar.Id, OrdemRetornar.Id, OrdemPercorrer.Id, OrdemPatrulhar.Id, OrdemJuntar.Id];

    /// <summary>Motivo que impede a tropa de receber gente ou de se dividir agora, ou null.</summary>
    public static string? Ocupada(Mundo m, Exercito ex) =>
        Exercitos.Bloqueio(m, ex) ?? (OrdensLivres.Contains(ex.Ordem) ? null : "Esta tropa está ocupada: dê outra ordem a ela antes.");

    internal static Exercito? Alvo(Mundo m, Exercito ex) =>
        ex.Dados["marcha"]?.GetValue<long>() is long id && m.Marchas.Obter(id) is Exercito a && a.ReinoId == ex.ReinoId ? a : null;

    private static JsonObject DadosPara(Exercito alvo) => new() { ["marcha"] = alvo.Id };

    /// <summary>A tropa de campo <paramref name="deId"/> se junta a <paramref name="paraId"/>. Devolve quem existe depois: a outra, se foi na hora; senão, a que anda.</summary>
    public static Exercito Juntar(Mundo m, Reino r, long deId, long paraId, bool? seguro = null)
    {
        var de = Exercitos.Do(m, r, deId);
        var para = Exercitos.Do(m, r, paraId);
        if (de.Id == para.Id) throw new RegraException("Escolha outra tropa.");
        if (Exercitos.Bloqueio(m, de) is { } motivo) throw new RegraException(motivo);
        var hex = para.HexEm(m.Agora);
        if (de.HexEm(m.Agora) != hex) { Exercitos.DarOrdem(m, r, deId, OrdemJuntar.Id, hex, seguro, DadosPara(para)); return de; }
        if (Ocupada(m, para) is { } mo) throw new RegraException(mo);
        de.PararAqui(m);   // interrompe o que ela fazia, como qualquer ordem nova
        Unir(m, de, para);
        return para;
    }

    /// <summary>Tropas de uma guarnição saem para se juntar à tropa <paramref name="paraId"/>.</summary>
    public static Exercito Enviar(Mundo m, Reino r, long deLocalId, IReadOnlyDictionary<string, int>? tropas, long paraId, bool seguro = false)
    {
        var para = Exercitos.Do(m, r, paraId);
        return Exercitos.Enviar(m, r, deLocalId, tropas, para.HexEm(m.Agora), OrdemJuntar.Id, seguro, DadosPara(para));
    }

    /// <summary>Todos os soldados, a carga, as relíquias e o equipamento de <paramref name="de"/> passam para <paramref name="para"/>, e <paramref name="de"/> sai do mapa.</summary>
    internal static void Unir(Mundo m, Exercito de, Exercito para)
    {
        foreach (var id in de.Reliquias.ToList())
        {
            de.Reliquias.Remove(id);
            if (m.Reliquias.Obter(id) is { } rel) Reliquias.Carregar(m, rel, para);
        }
        foreach (var eq in Lendarios.NaMarcha(m, de.Id).ToList()) { eq.MarchaId = para.Id; m.Sujar(eq); }
        Escavacoes.Juntar(m, de, para);
        AjustarPasso(m, para);
    }

    /// <summary>As pessoas <paramref name="ids"/> saem da tropa e formam outra, parada no hexágono em que estão.</summary>
    public static Exercito Separar(Mundo m, Reino r, long marchaId, IReadOnlyList<long> ids)
    {
        var ex = Exercitos.Do(m, r, marchaId);
        if (Ocupada(m, ex) is { } motivo) throw new RegraException(motivo);
        PS.Sincronizar(m, ex);
        var saem = Escolhidas(m, ex, ids);
        if (saem.Count == 0) throw new RegraException("Escolha quem sai.");
        if (saem.Count == PS.SoldadosDaMarcha(m, ex).Count()) throw new RegraException("Alguém precisa ficar: escolha menos gente.");
        var h = ex.HexEm(m.Agora);
        var grupo = PS.Contar(m, saem);
        var novo = new Exercito
        {
            ReinoId = r.Id, OrigemLocalId = ex.OrigemLocalId, Vel = GT.Velocidade(m, grupo), Seguro = ex.Seguro,
            Caminho = [h], Tempos = [m.Agora], Origem = h, Destino = h,
        };
        m.Marchas.Adicionar(novo);
        foreach (var p in saem) ex.PessoaIds.Remove(p.Id);
        PS.RecontarTropas(m, ex);
        PS.Embarcar(m, novo, saem);
        if (ex.Carga.Count > 0)
        {
            var toda = ex.Carga.Copia();
            double cSai = GT.Carga(m, novo.Tropas), cFica = GT.Carga(m, ex.Tropas), f = cSai / Math.Max(1e-9, cSai + cFica);
            ex.Carga = new(); ex.Carga.Somar(toda, 1 - f);
            novo.Carga.Somar(toda, f);
        }
        m.Sujar(ex); m.Sujar(novo);
        AjustarPasso(m, ex);
        m.Avisar(r.Id, "marchas");
        return novo;
    }

    /// <summary>
    /// Dá uma ordem a uma parte da tropa: as pessoas <paramref name="ids"/> se separam e recebem a ordem. Com todas elas, a ordem vai
    /// para a tropa inteira. Se a ordem for recusada, a parte volta para a tropa, como se nada tivesse acontecido.
    /// </summary>
    public static Exercito Parte(Mundo m, Reino r, long marchaId, IReadOnlyList<long> ids, Func<Exercito, Exercito> ordem)
    {
        var ex = Exercitos.Do(m, r, marchaId);
        PS.Sincronizar(m, ex);
        if (Escolhidas(m, ex, ids).Count == PS.SoldadosDaMarcha(m, ex).Count()) return ordem(ex);
        var novo = Separar(m, r, marchaId, ids);
        try { return ordem(novo); }
        catch (RegraException) { if (m.Marchas.ContemId(novo.Id)) Unir(m, novo, ex); throw; }
    }

    private static List<Pessoas.Pessoa> Escolhidas(Mundo m, Exercito ex, IReadOnlyList<long> ids)
    {
        var lista = new List<Pessoas.Pessoa>();
        foreach (var id in ids.Distinct())
        {
            var p = m.Pessoas.Obter(id);
            if (p == null || p.ReinoId != ex.ReinoId) throw new RegraException("Pessoa não encontrada.", 404);
            if (p.GrupoId != ex.Id || !PS.EhSoldado(m, p)) throw new RegraException(p.Nome + " não está nesta tropa.");
            lista.Add(p);
        }
        return lista;
    }

    /// <summary>A tropa anda no passo da unidade mais lenta: mudou quem está nela, o que falta do caminho é refeito no passo novo, pelos mesmos hexágonos.</summary>
    private static void AjustarPasso(Mundo m, Exercito ex)
    {
        var vel = GT.Velocidade(m, ex.Tropas);
        if (vel == ex.Vel) return;
        ex.Vel = vel;
        m.Sujar(ex);
        if (ex.Parado || ex.Tempos.Count < 2) return;
        var i = ex.Tempos.BinarySearch(m.Agora);
        if (i < 0) i = ~i - 1;
        var resto = ex.Caminho.Skip(Math.Clamp(i, 0, ex.Caminho.Count - 1)).ToList();
        if (resto.Count >= 2) ex.Partir(m, Caminhos.Seguir(m, resto, vel, new OpcoesCaminho { ReinoId = ex.ReinoId }));
    }
}

/// <summary>
/// Vai até outra tropa do reino (<c>Dados.marcha</c>) e se junta a ela. Se a outra andou, segue atrás; se ela saiu do mapa ou ficou
/// ocupada, para onde está e avisa.
/// </summary>
public sealed class OrdemJuntar : IOrdemExercito
{
    public const string Id = "juntar";
    public string Ordem => Id;

    public void Validar(Mundo m, Reino r, Exercito ex, int destino)
    {
        var alvo = Grupos.Alvo(m, ex) ?? throw new RegraException("Essa tropa não está mais em campo.", 404);
        if (alvo.Id == ex.Id) throw new RegraException("Escolha outra tropa.");
        if (Grupos.Ocupada(m, alvo) is { } motivo) throw new RegraException(motivo);
        if (alvo.Ordem == Id && Grupos.Alvo(m, alvo)?.Id == ex.Id) throw new RegraException("Aquela tropa já está vindo se juntar a esta.");
    }

    public Rota Trajeto(Mundo m, Exercito ex, int destino, int de)
    {
        var hex = Grupos.Alvo(m, ex)!.HexEm(m.Agora);
        if (hex == de) throw new RegraException("As tropas já estão aqui.");
        return Exercitos.Rota(m, ex, de, hex);
    }

    public void Chegou(Mundo m, Exercito ex)
    {
        var alvo = Grupos.Alvo(m, ex);
        if (alvo == null || Grupos.Ocupada(m, alvo) != null) { Desistir(m, ex, "A outra tropa não está mais disponível."); return; }
        var aqui = ex.HexEm(m.Agora);
        var hex = alvo.HexEm(m.Agora);
        if (hex == aqui)
        {
            var partes = GT.Partes(m, ex.Tropas);
            Grupos.Unir(m, ex, alvo);
            Exercitos.Avisar(m, alvo, "Tropas juntas", partes + " entraram na tropa · agora " + GT.Partes(m, alvo.Tropas));
            return;
        }
        try { ex.Partir(m, Exercitos.Rota(m, ex, aqui, hex)); }
        catch (RegraException) { Desistir(m, ex, "Não há caminho até a outra tropa."); }
    }

    private static void Desistir(Mundo m, Exercito ex, string motivo)
    {
        ex.Ordem = OrdemMover.Id;
        ex.Parar(m);
        Exercitos.Avisar(m, ex, "Tropas não se juntaram", motivo + " " + GT.Partes(m, ex.Tropas) + " · paradas onde estão.");
    }
}
