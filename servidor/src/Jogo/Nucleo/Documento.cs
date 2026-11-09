using System.Collections;
using System.Reflection;
using System.Text.Json.Serialization;

namespace ReinoDePedra.Jogo.Nucleo;

/// <summary>
/// Entidade persistente do mundo. Fica inteira na memória; é gravada no SQLite como JSON
/// (tabela <c>docs</c>: coleção, id, tipo, dados). Propriedades públicas com get/set são gravadas.
/// Use <c>[JsonIgnore]</c> para caches e índices derivados.
/// Depois de mudar um documento, chame <see cref="Mundo.Sujar"/> (ou <c>m.Sujar(this)</c>).
/// </summary>
public abstract class Documento
{
    public long Id { get; set; }
    [JsonIgnore] internal IColecao? Dona { get; set; }
}

public interface IColecao : IEnumerable
{
    string Nome { get; }
    Type TipoBase { get; }
    int Count { get; }
    void AdicionarCarregado(Documento d);
    IEnumerable<Documento> Todos { get; }
    bool ContemId(long id);
    /// <summary>Esvazia a coleção na memória, sem marcar remoções (reset de temporada: o banco é apagado à parte).</summary>
    void Limpar();
}

/// <summary>Coleção de documentos de um tipo (ou de subtipos dele), indexada por id.</summary>
public sealed class Colecao<T>(string nome) : IColecao, IEnumerable<T> where T : Documento
{
    private readonly Dictionary<long, T> _itens = new();
    internal Mundo? Mundo { get; set; }
    public string Nome { get; } = nome;
    public Type TipoBase => typeof(T);
    public int Count => _itens.Count;
    public IEnumerable<Documento> Todos => _itens.Values;

    public T? Obter(long id) => _itens.GetValueOrDefault(id);
    public T this[long id] => _itens.TryGetValue(id, out var v) ? v : throw new RegraException("Não encontrado.", 404);
    public bool ContemId(long id) => _itens.ContainsKey(id);

    /// <summary>Adiciona (atribui id novo se Id == 0) e marca como sujo.</summary>
    public T Adicionar(T d)
    {
        if (d.Id == 0) d.Id = Mundo!.NovoId();
        d.Dona = this;
        _itens[d.Id] = d;
        Mundo?.Sujar(d);
        return d;
    }
    public void AdicionarCarregado(Documento d) { d.Dona = this; _itens[d.Id] = (T)d; }
    public bool Remover(long id)
    {
        if (!_itens.Remove(id, out var d)) return false;
        Mundo?.MarcarRemovido(Nome, id);
        d.Dona = null;
        return true;
    }
    public bool Remover(T d) => Remover(d.Id);
    public void Limpar() { foreach (var d in _itens.Values) d.Dona = null; _itens.Clear(); }
    public IEnumerator<T> GetEnumerator() => _itens.Values.GetEnumerator();
    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}

/// <summary>Mapeia nome do tipo &lt;-&gt; Type para documentos polimórficos (eventos, marchas...).</summary>
public static class RegistroTipos
{
    private static readonly Dictionary<string, Type> _porNome = new();
    private static readonly object _trava = new();
    private static bool _pronto;

    public static void Garantir()
    {
        if (_pronto) return;
        lock (_trava)
        {
            if (_pronto) return;
            foreach (var t in typeof(Documento).Assembly.GetTypes())
                if (!t.IsAbstract && typeof(Documento).IsAssignableFrom(t))
                    _porNome[t.Name] = t;
            _pronto = true;
        }
    }
    public static Type Tipo(string nome)
    {
        Garantir();
        return _porNome.TryGetValue(nome, out var t) ? t : throw new InvalidDataException("tipo de documento desconhecido: " + nome);
    }
    public static Type? TipoOuNulo(string nome)
    {
        Garantir();
        return _porNome.GetValueOrDefault(nome);
    }
    public static string Nome(Type t) => t.Name;

    /// <summary>Instâncias de todas as classes concretas que implementam a interface (registro por convenção).</summary>
    public static List<TI> Implementacoes<TI>()
    {
        return typeof(Documento).Assembly.GetTypes()
            .Where(t => !t.IsAbstract && !t.IsInterface && typeof(TI).IsAssignableFrom(t) && t.GetConstructor(Type.EmptyTypes) != null)
            .Select(t => (TI)Activator.CreateInstance(t)!)
            .ToList();
    }
}
