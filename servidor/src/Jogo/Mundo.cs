using System.Reflection;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Mapa;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo;

/// <summary>
/// Estado autoritativo do mundo, inteiro na memória. Só a thread do <see cref="Motor"/> mexe nele.
/// É <c>partial</c>: cada sistema pode acrescentar coleções e índices em arquivo próprio
/// (toda propriedade pública do tipo <see cref="Colecao{T}"/> é registrada e persistida sozinha).
/// </summary>
public sealed partial class Mundo
{
    public Balanceamento B { get; }
    public Formulas F { get; }
    public IRelogio Relogio { get; }
    public MapaMundo Mapa { get; private set; } = null!;
    public Grade G => Mapa.G;
    public ParametrosP P => B.P;

    /// <summary>Sorteios de jogo (combate, fauna, espionagem). Não determinístico entre execuções.</summary>
    public Rng Sorte { get; set; } = new((ulong)DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() ^ 0xA5A5_5A5AUL);

    /// <summary>Como nasce um reino novo (níveis, guarnição, exploradores). Padrão: <c>P.inicio</c>; cenários de teste trocam.</summary>
    public InicioP? InicioReino { get; set; }

    /// <summary>Canal para avisar clientes conectados (SSE). Padrão: não faz nada.</summary>
    public ICanalAvisos Avisos { get; set; } = new CanalNulo();

    public Colecao<EstadoMundo> Estados { get; } = new("estado");
    public Colecao<Evento> Eventos { get; } = new("eventos");
    public Colecao<Reino> Reinos { get; } = new("reinos");
    public Colecao<Local> Locais { get; } = new("locais");
    public Colecao<Marcha> Marchas { get; } = new("marchas");
    public Colecao<Jazida> Jazidas { get; } = new("jazidas");
    public Colecao<Ruina> Ruinas { get; } = new("ruinas");

    public EstadoMundo Estado => Estados.Obter(1) ?? throw new InvalidOperationException("mundo sem estado");
    public Agenda Agenda { get; } = new();

    public IReadOnlyList<IColecao> Colecoes { get; }

    private long? _agoraFixo;
    /// <summary>Instante atual do jogo. Dentro de um evento, é o instante do evento.</summary>
    public long Agora => _agoraFixo ?? Relogio.Agora;

    internal readonly HashSet<Documento> Sujos = new(ReferenceEqualityComparer.Instance);
    internal readonly List<(string colecao, long id)> Removidos = new();

    public Mundo(Balanceamento b, IRelogio relogio)
    {
        B = b; F = new Formulas(b); Relogio = relogio;
        Colecoes = GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Where(pr => typeof(IColecao).IsAssignableFrom(pr.PropertyType))
            .Select(pr => (IColecao)pr.GetValue(this)!)
            .ToList();
        foreach (var c in Colecoes)
            c.GetType().GetProperty("Mundo", BindingFlags.NonPublic | BindingFlags.Instance)!.SetValue(c, this);
    }

    public long NovoId() { Sujar(Estado); return ++Estado.UltimoId; }
    public void Sujar(Documento d) { if (d.Dona != null) Sujos.Add(d); }
    internal void MarcarRemovido(string colecao, long id) => Removidos.Add((colecao, id));

    /// <summary>Monta o mapa a partir da semente (no início do processo e na criação do mundo).</summary>
    public void PrepararMapa()
    {
        Mapa = GeradorMapa.Gerar(P, Estado.Semente);
        ReconstruirIndices();
    }

    /// <summary>Cria um mundo novo: terreno, jazidas, ruínas e início da temporada.</summary>
    /// <param name="ultimoId">Último id já usado (no reset da temporada os ids continuam: um id nunca volta a outro documento).</param>
    public void CriarNovo(ulong semente, int numeroTemporada = 1, long ultimoId = 1)
    {
        Estados.AdicionarCarregado(new EstadoMundo { Id = 1 });
        var e = Estado;
        e.Semente = semente; e.InicioTemporada = Relogio.Agora; e.NumeroTemporada = numeroTemporada;
        e.UltimoId = Math.Max(1, ultimoId);
        Sujar(e);
        PrepararMapa();
        var (jaz, ruinas) = GeradorMapa.SortearObjetos(Mapa, B, semente);
        foreach (var (hex, rec, tam) in jaz)
            Jazidas.Adicionar(new Jazida { Hex = hex, Recurso = rec, Inicial = tam, Restante = tam });
        var tipos = new[] { "ataque", "producao", "resistencia" };
        var rng = new Rng(semente ^ 0x52454C49UL);
        foreach (var h in ruinas)
            Ruinas.Adicionar(new Ruina { Hex = h, TipoReliquia = tipos[rng.Int(0, 3)] });
        AoCriarMundo?.Invoke(this, semente);
        ReconstruirIndices();
    }

    /// <summary>Ganchos para sistemas que geram objetos na criação do mundo (fauna, IA...).</summary>
    public static event Action<Mundo, ulong>? AoCriarMundo;

    // ---------------------------------------------------------------- agenda

    public T Agendar<T>(T e) where T : Evento
    {
        if (e.Quando < Agora) e.Quando = Agora;
        e.Seq = ++Estado.UltimaSeq;
        Eventos.Adicionar(e);
        Agenda.Inserir(e);
        return e;
    }
    public void Cancelar(long? eventoId)
    {
        if (eventoId is long id) Eventos.Remover(id);   // a agenda pula ids que não existem mais
    }

    /// <summary>Executa, em ordem, os eventos com horário até <paramref name="ate"/>. Devolve quantos executou.</summary>
    public int ProcessarAte(long ate, int limite = int.MaxValue)
    {
        var n = 0;
        while (n < limite && Agenda.Proximo(out var id, out var quando) && quando <= ate)
        {
            Agenda.Descartar();
            var ev = Eventos.Obter(id);
            if (ev == null || ev.Quando != quando) { if (ev != null) Agenda.Inserir(ev); continue; }
            Eventos.Remover(id);
            _agoraFixo = ev.Quando;
            try { ev.Executar(this); }
            catch (Exception ex) { ErroEvento?.Invoke(ev, ex); }
            finally { _agoraFixo = null; }
            n++;
        }
        return n;
    }
    public static event Action<Evento, Exception>? ErroEvento;

    /// <summary>Para testes e ferramentas: fixa o relógio do jogo enquanto <paramref name="acao"/> roda.</summary>
    public void Em(long instante, Action acao)
    {
        var antes = _agoraFixo; _agoraFixo = instante;
        try { acao(); } finally { _agoraFixo = antes; }
    }

    // ---------------------------------------------------------------- índices

    private readonly Dictionary<int, long> _localNoHex = new();
    private readonly Dictionary<long, List<long>> _locaisDoReino = new();

    public void ReconstruirIndices()
    {
        _localNoHex.Clear(); _locaisDoReino.Clear();
        foreach (var l in Locais) Indexar(l);
        IndiceNevoa.Clear();
        foreach (var n in NevoasDosReinos) IndiceNevoa[n.ReinoId] = n.Id;
        IndiceFotos.Clear(); BandeirasPorHex = null;   // remontados sob demanda
        ReindexarPessoas();
        if (Mapa != null) AoReconstruirIndices?.Invoke(this);
    }
    public static event Action<Mundo>? AoReconstruirIndices;

    private void Indexar(Local l)
    {
        _localNoHex[l.Hex] = l.Id;
        if (l.ReinoId != 0)
        {
            if (!_locaisDoReino.TryGetValue(l.ReinoId, out var lst)) _locaisDoReino[l.ReinoId] = lst = new();
            if (!lst.Contains(l.Id)) lst.Add(l.Id);
        }
    }

    public Local? LocalNoHex(int hex) => _localNoHex.TryGetValue(hex, out var id) ? Locais.Obter(id) : null;
    public IEnumerable<Local> LocaisDe(long reinoId) =>
        _locaisDoReino.TryGetValue(reinoId, out var l) ? l.Select(id => Locais.Obter(id)).OfType<Local>() : [];

    public Local AdicionarLocal(Local l)
    {
        if (_localNoHex.ContainsKey(l.Hex)) throw new RegraException("Já existe um local neste hexágono.");
        Locais.Adicionar(l);
        Indexar(l);
        return l;
    }
    public void RemoverLocal(Local l)
    {
        _localNoHex.Remove(l.Hex);
        if (_locaisDoReino.TryGetValue(l.ReinoId, out var lst)) lst.Remove(l.Id);
        Locais.Remover(l);
    }
    /// <summary>Troca o dono de um local (ocupação, queda do castelo...). 0 = sem dono.</summary>
    public void MudarDono(Local l, long novoReino)
    {
        if (_locaisDoReino.TryGetValue(l.ReinoId, out var lst)) lst.Remove(l.Id);
        l.ReinoId = novoReino;
        Indexar(l);
        Sujar(l);
    }

    // ---------------------------------------------------------------- avisos

    /// <summary>Avisa os clientes do reino que algo mudou (tipo curto, ex.: "reino", "mapa", "relatorio").</summary>
    public void Avisar(long reinoId, string tipo, object? dados = null) => Avisos.Avisar(reinoId, tipo, dados);
}

public interface ICanalAvisos
{
    void Avisar(long reinoId, string tipo, object? dados);
    /// <summary>Reset da temporada: fecha as conexões abertas (cada cliente reconecta e acha o reino da temporada nova).</summary>
    void Reiniciar() { }
}
internal sealed class CanalNulo : ICanalAvisos { public void Avisar(long reinoId, string tipo, object? dados) { } }

/// <summary>Dados gerais do mundo e da temporada (documento único, id 1).</summary>
public sealed class EstadoMundo : Documento
{
    public ulong Semente { get; set; }
    public int NumeroTemporada { get; set; } = 1;
    public long InicioTemporada { get; set; }
    public long UltimoId { get; set; }
    public long UltimaSeq { get; set; }
    public Dictionary<string, string> Extras { get; set; } = new();
}
