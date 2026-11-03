using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Marchas;

/// <summary>
/// O que um exército faz ao chegar ao destino. Implementações são achadas por reflexão (construtor vazio),
/// uma por <see cref="Ordem"/>: "mover", "reforcar", "retornar" aqui; o combate acrescenta "atacar" etc.
/// </summary>
public interface IOrdemExercito
{
    /// <summary>Nome da ordem na API ("mover", "reforcar"...).</summary>
    string Ordem { get; }
    /// <summary>Pode ser usada ao enviar tropas de um local (false: só para um exército em campo, como "retornar").</summary>
    bool NoEnvio => true;
    /// <summary>Confere o destino antes de partir (ex.AlvoLocalId já aponta o local do hexágono, se houver). Lance <see cref="RegraException"/> se não puder.</summary>
    void Validar(Mundo m, Reino r, Exercito ex, int destino) { }
    /// <summary>Chegou ao fim do caminho. Para ficar no mapa, chame <c>ex.Parar(m)</c>; para entrar num local, <c>ex.EntrarNoLocal(m, l)</c>.</summary>
    void Chegou(Mundo m, Exercito ex);
}

/// <summary>
/// Tropas fora dos locais. Andam na velocidade da unidade mais lenta e levam até a soma de <c>U.carga</c>.
/// Parado no destino (sem evento de chegada), o exército continua no mapa e aceita nova ordem.
/// Ocupa o teto de população do dono (<see cref="Marcha.PopOcupada"/> soma as tropas).
/// </summary>
public sealed class Exercito : Marcha
{
    public override string Tipo => "exercito";
    /// <summary>Local de onde as tropas saíram (para onde voltam).</summary>
    public long OrigemLocalId { get; set; }
    /// <summary>Ordem atual (ver <see cref="IOrdemExercito"/>).</summary>
    public string Ordem { get; set; } = OrdemMover.Id;
    public Postura Postura { get; set; } = Postura.AtacarQuemAtacar;
    /// <summary>Local no hexágono de destino, se havia um ao dar a ordem.</summary>
    public long? AlvoLocalId { get; set; }
    /// <summary>Dados livres da ordem (objetivos e tática do ataque, por exemplo).</summary>
    public JsonObject Dados { get; set; } = new();
    /// <summary>Prefere a rota segura (evita fauna) nas próximas ordens.</summary>
    public bool Seguro { get; set; }

    /// <summary>Parado no destino, sem evento de chegada.</summary>
    [JsonIgnore] public bool Parado => EventoId == null;

    public double CargaMax(Mundo m) => GT.Carga(m, Tropas);

    /// <summary>Enxerga (e revela a névoa) com a maior visão entre as unidades do grupo.</summary>
    public override int RaioVisao(Mundo m) => GT.Visao(m, Tropas);

    public override void Chegou(Mundo m)
    {
        m.Sujar(this);
        var r = m.Reinos.Obter(ReinoId);
        if (r == null || !r.Ativo) { Encerrar(m); return; }
        var ordem = Exercitos.OrdemOuNulo(Ordem);
        if (ordem == null) { Parar(m); return; }
        ordem.Chegou(m, this);
    }

    /// <summary>Para onde está agora: fica no mapa, sem evento, e aceita nova ordem.</summary>
    public void Parar(Mundo m)
    {
        var h = HexEm(m.Agora);
        m.Cancelar(EventoId);
        EventoId = null;
        Caminho = [h]; Tempos = [m.Agora]; Origem = Destino = h;
        Retornando = false;
        m.Sujar(this);
        m.Avisar(ReinoId, "marchas");
    }

    /// <summary>
    /// Ordem "parar aqui": fica onde está, com a ordem "mover" e a postura padrão de campo. É uma nova ordem como qualquer
    /// outra: cancela o caminho antigo e os eventos dele, interrompe caça, extração e escavação (ganchos de <see cref="Marcha.AoPartir"/>),
    /// sem evento de chegada (não entra em local nem avisa "Tropas no destino").
    /// </summary>
    public void PararAqui(Mundo m)
    {
        var h = HexEm(m.Agora);
        m.Cancelar(EventoId);
        EventoId = null;
        Caminho = [h]; Tempos = [m.Agora]; Origem = Destino = h;
        Ordem = OrdemMover.Id; AlvoLocalId = null; Retornando = false; Postura = Postura.AtacarQuemAtacar;
        foreach (var f in AoPartir) f(m, this);
        m.Sujar(this);
        m.Avisar(ReinoId, "marchas");
    }

    /// <summary>Volta ao local de origem (ou ao local próprio mais próximo) e descarrega a carga lá.</summary>
    public void Retornar(Mundo m, bool? seguro = null) => Exercitos.Retornar(m, this, seguro);

    /// <summary>As tropas entram na guarnição do local, a carga vai para o estoque dele e a marcha acaba.</summary>
    public void EntrarNoLocal(Mundo m, Local l)
    {
        var r = m.Reinos.Obter(ReinoId);
        if (r != null) Economia.Atualizar(m, r);
        GT.Devolver(m, l, Tropas);
        if (Carga.Count > 0) { l.Estoque.Somar(Carga); m.Sujar(l); }
        Exercitos.EntrouNoLocal(m, this, l);
        Tropas = new(); Carga = new();
        Encerrar(m);
        m.Avisar(ReinoId, "reino");
    }
}

/// <summary>Envio de tropas, ordens a exércitos em campo e posturas.</summary>
public static class Exercitos
{
    private static Dictionary<string, IOrdemExercito>? _ordens;
    public static IReadOnlyDictionary<string, IOrdemExercito> Ordens =>
        _ordens ??= RegistroTipos.Implementacoes<IOrdemExercito>().ToDictionary(o => o.Ordem);
    public static IOrdemExercito? OrdemOuNulo(string? id) => id != null && Ordens.TryGetValue(id, out var o) ? o : null;

    /// <summary>Motivos que impedem uma nova ordem a um exército (ex.: o combate devolve "Em batalha.").</summary>
    public static List<Func<Mundo, Exercito, string?>> BloqueiosOrdem { get; } = new();

    /// <summary>Primeiro motivo que impede uma nova ordem ao exército agora, ou null se ele aceita ordem (a API mostra no painel).</summary>
    public static string? Bloqueio(Mundo m, Exercito ex)
    {
        foreach (var f in BloqueiosOrdem) { var mo = f(m, ex); if (mo != null) return mo; }
        return null;
    }

    /// <summary>Tropas de um exército entraram num local (relíquias carregadas, por exemplo, ficam lá).</summary>
    public static event Action<Mundo, Exercito, Local>? AoEntrarNoLocal;
    internal static void EntrouNoLocal(Mundo m, Exercito ex, Local l) => AoEntrarNoLocal?.Invoke(m, ex, l);

    public static IEnumerable<Exercito> De(Mundo m, long reinoId) => m.Marchas.OfType<Exercito>().Where(e => e.ReinoId == reinoId);

    public static bool LocalProprio(Local? l, long reinoId) => l != null && l.ReinoId == reinoId && !l.Ruina;

    /// <summary>Caminho do exército (rota curta ou segura, conforme <see cref="Exercito.Seguro"/>).</summary>
    public static Rota Rota(Mundo m, Exercito ex, int de, int para)
    {
        var op = new OpcoesCaminho { Seguro = ex.Seguro, Forca = GT.ForcaFauna(m, ex.Tropas), ReinoId = ex.ReinoId };
        var rota = Caminhos.Calcular(m, de, para, ex.Vel, op);
        if (rota.Hexes[^1] != para) throw new RegraException("Não há caminho até o destino.");
        return rota;
    }

    /// <summary>
    /// Tira tropas da guarnição de um local e as manda ao hexágono <paramref name="destino"/> com a ordem dada.
    /// </summary>
    public static Exercito Enviar(Mundo m, Reino r, long deLocalId, IReadOnlyDictionary<string, int>? tropas, int destino,
        string ordem, bool seguro = false, JsonObject? dados = null)
    {
        var l = m.Locais.Obter(deLocalId);
        if (l == null || l.ReinoId != r.Id) throw new RegraException("Local não é seu.", 404);
        if (l.Ruina) throw new RegraException("O local está em ruínas.");
        if (!m.G.Valido(destino)) throw new RegraException("Destino fora do mapa.");
        if (destino == l.Hex) throw new RegraException("As tropas já estão aqui.");
        var o = OrdemOuNulo(ordem);
        if (o == null || !o.NoEnvio) throw new RegraException("Ordem desconhecida.");
        var grupo = GT.Validar(m, l, tropas);
        var ex = new Exercito
        {
            ReinoId = r.Id, OrigemLocalId = l.Id, Ordem = o.Ordem, Tropas = grupo, Vel = GT.Velocidade(m, grupo),
            Seguro = seguro, Dados = dados ?? new(), AlvoLocalId = m.LocalNoHex(destino)?.Id,
        };
        o.Validar(m, r, ex, destino);
        var rota = Rota(m, ex, l.Hex, destino);
        Economia.Atualizar(m, r);
        GT.Retirar(m, l, grupo);
        ex.Partir(m, rota);
        m.Avisar(r.Id, "reino");
        return ex;
    }

    public static Exercito Do(Mundo m, Reino r, long marchaId) =>
        m.Marchas.Obter(marchaId) is Exercito ex && ex.ReinoId == r.Id ? ex : throw new RegraException("Exército não encontrado.", 404);

    /// <summary>Nova ordem a um exército em campo (andando ou parado): "retornar", ou outra ordem com destino.</summary>
    public static void DarOrdem(Mundo m, Reino r, long marchaId, string ordem, int? destino, bool? seguro = null, JsonObject? dados = null)
    {
        var ex = Do(m, r, marchaId);
        if (Bloqueio(m, ex) is { } motivo) throw new RegraException(motivo);
        if (ordem == OrdemRetornar.Id) { Retornar(m, ex, seguro); return; }
        var o = OrdemOuNulo(ordem) ?? throw new RegraException("Ordem desconhecida.");
        if (destino is not int d || !m.G.Valido(d)) throw new RegraException("Escolha o destino.");
        var de = ex.HexEm(m.Agora);   // a nova rota sai de onde as tropas estão agora, não da origem
        if (d == de)
        {
            // "mover" para o próprio hexágono é "parar aqui" (andando, caçando ou trabalhando); outra ordem não tem o que fazer
            if (o.Ordem != OrdemMover.Id) throw new RegraException("As tropas já estão aqui.");
            if (seguro != null) ex.Seguro = seguro.Value;
            ex.PararAqui(m);
            return;
        }
        var antes = (ex.Ordem, ex.AlvoLocalId, ex.Dados, ex.Seguro);
        ex.Ordem = o.Ordem; ex.AlvoLocalId = m.LocalNoHex(d)?.Id;
        if (dados != null) ex.Dados = dados;
        if (seguro != null) ex.Seguro = seguro.Value;
        Rota rota;
        try { o.Validar(m, r, ex, d); rota = Rota(m, ex, de, d); }
        catch { (ex.Ordem, ex.AlvoLocalId, ex.Dados, ex.Seguro) = antes; throw; }
        ex.Retornando = false;
        ex.Partir(m, rota);
    }

    /// <summary>Volta ao local de origem; se ele não existir mais ou não for mais seu, ao local próprio mais próximo.</summary>
    public static void Retornar(Mundo m, Exercito ex, bool? seguro = null)
    {
        if (seguro != null) ex.Seguro = seguro.Value;
        var de = ex.HexEm(m.Agora);
        Local? alvo = null; Rota? rota = null;
        var origem = m.Locais.Obter(ex.OrigemLocalId);
        if (LocalProprio(origem, ex.ReinoId)) { alvo = origem; rota = origem!.Hex == de ? null : Rota(m, ex, de, origem.Hex); }
        else
        {
            foreach (var l in m.LocaisDe(ex.ReinoId).Where(l => !l.Ruina))
            {
                if (l.Hex == de) { alvo = l; rota = null; break; }
                var rr = Caminhos.Calcular(m, de, l.Hex, ex.Vel, new OpcoesCaminho { Seguro = ex.Seguro, Forca = GT.ForcaFauna(m, ex.Tropas), ReinoId = ex.ReinoId });
                if (rr.Hexes[^1] != l.Hex) continue;
                if (rota == null || rr.TotalMin < rota.TotalMin) { alvo = l; rota = rr; }
            }
        }
        if (alvo == null) { ex.Ordem = OrdemMover.Id; ex.AlvoLocalId = null; ex.Parar(m); return; }   // sem para onde voltar
        ex.Ordem = OrdemRetornar.Id; ex.AlvoLocalId = alvo.Id;
        if (rota == null) { ex.EntrarNoLocal(m, alvo); return; }
        ex.Retornando = true;
        ex.Partir(m, rota);
    }

    /// <summary>Muda a postura de uma guarnição, de um exército em campo, de todas as guarnições ou de todos os exércitos.</summary>
    public static int MudarPostura(Mundo m, Reino r, Postura postura, long? localId = null, long? marchaId = null, bool todas = false, bool todosExercitos = false)
    {
        var n = 0;
        if (localId is long lid)
        {
            var l = m.Locais.Obter(lid);
            if (l == null || l.ReinoId != r.Id) throw new RegraException("Local não é seu.", 404);
            l.Postura = postura; m.Sujar(l); n++;
        }
        if (marchaId is long mid) { var ex = Do(m, r, mid); ex.Postura = postura; m.Sujar(ex); n++; }
        if (todas) foreach (var l in m.LocaisDe(r.Id)) { l.Postura = postura; m.Sujar(l); n++; }
        if (todosExercitos) foreach (var ex in De(m, r.Id)) { ex.Postura = postura; m.Sujar(ex); n++; }
        if (n == 0) throw new RegraException("Escolha um local, um exército ou todas.");
        m.Avisar(r.Id, "reino");
        return n;
    }

    internal static void Avisar(Mundo m, Exercito ex, string titulo, string? texto) =>
        Registros.Notificar(m, ex.ReinoId, "tropas", titulo, texto, "tropas");
}

/// <summary>Vai a qualquer hexágono e fica lá parado. Se o destino for um local seu, vira reforço (entra na guarnição).</summary>
public sealed class OrdemMover : IOrdemExercito
{
    public const string Id = "mover";
    public string Ordem => Id;
    public void Validar(Mundo m, Reino r, Exercito ex, int destino)
    {
        var l = m.LocalNoHex(destino);
        if (l != null && l.ReinoId != r.Id) throw new RegraException("Este local não é seu: escolha outra ordem.");
    }
    public void Chegou(Mundo m, Exercito ex)
    {
        var l = m.LocalNoHex(ex.Destino);
        var partes = GT.Partes(m, ex.Tropas);
        if (Exercitos.LocalProprio(l, ex.ReinoId))
        {
            ex.EntrarNoLocal(m, l!);
            Exercitos.Avisar(m, ex, "Reforço chegou", partes + " em " + l!.Nome);
            return;
        }
        ex.Parar(m);
        Exercitos.Avisar(m, ex, "Tropas no destino", partes + " · paradas no hexágono " + m.G.C(ex.Destino) + ", " + m.G.L(ex.Destino));
    }
}

/// <summary>Vai a um local seu e entra na guarnição. Locais de outros reinos aceitos por <see cref="Aceita"/> (aliados) ficam com <see cref="Chegada"/>.</summary>
public sealed class OrdemReforcar : IOrdemExercito
{
    public const string Id = "reforcar";
    public string Ordem => Id;

    /// <summary>Reforço a um local que não é seu: (mundo, reino que envia, local) → true se pode ir (a aliança registra aqui).</summary>
    public static List<Func<Mundo, Reino, Local, bool>> Aceita { get; } = new();
    /// <summary>Chegada a um local que não é seu: (mundo, exército, local) → true se algum sistema cuidou (senão, volta).</summary>
    public static List<Func<Mundo, Exercito, Local, bool>> Chegada { get; } = new();

    public void Validar(Mundo m, Reino r, Exercito ex, int destino)
    {
        var l = m.LocalNoHex(destino);
        if (Exercitos.LocalProprio(l, r.Id)) return;
        if (l != null && Aceita.Any(f => f(m, r, l)))
        {
            if (ex.Carga.Count > 0) throw new RegraException("Tropas com carga não reforçam um aliado: entregue a carga num local seu antes.");
            return;
        }
        throw new RegraException("Reforço só vai para um local seu.");
    }
    public void Chegou(Mundo m, Exercito ex)
    {
        var l = m.LocalNoHex(ex.Destino);
        if (!Exercitos.LocalProprio(l, ex.ReinoId) && l != null && Chegada.Any(f => f(m, ex, l))) return;
        if (!Exercitos.LocalProprio(l, ex.ReinoId)) { ex.Retornar(m); return; }   // o local caiu no caminho
        var partes = GT.Partes(m, ex.Tropas);
        ex.EntrarNoLocal(m, l!);
        Exercitos.Avisar(m, ex, "Reforço chegou", partes + " em " + l!.Nome);
    }
}

/// <summary>Volta ao local de origem (ou ao próprio mais próximo) e descarrega a carga no estoque dele.</summary>
public sealed class OrdemRetornar : IOrdemExercito
{
    public const string Id = "retornar";
    public string Ordem => Id;
    public bool NoEnvio => false;
    public void Chegou(Mundo m, Exercito ex)
    {
        var l = ex.AlvoLocalId is long id ? m.Locais.Obter(id) : null;
        if (!Exercitos.LocalProprio(l, ex.ReinoId) || l!.Hex != ex.Destino) { ex.Retornar(m); return; }
        var partes = GT.Partes(m, ex.Tropas);
        var carga = ex.Carga.Arredondado();
        ex.EntrarNoLocal(m, l);
        Exercitos.Avisar(m, ex, "Tropas de volta", partes + " em " + l.Nome +
            (carga.Count > 0 ? " · trouxeram " + string.Join(", ", carga.Select(kv => kv.Value + " " + Logistica.NomeRecurso(kv.Key))) : ""));
    }
}
