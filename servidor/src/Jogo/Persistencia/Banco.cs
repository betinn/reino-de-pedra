using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Data.Sqlite;
using ReinoDePedra.Jogo.Nucleo;

namespace ReinoDePedra.Jogo.Persistencia;

/// <summary>
/// SQLite em modo WAL. O mundo é guardado como documentos JSON (tabela <c>docs</c>), gravados em lote
/// numa transação a cada poucos segundos (só os sujos). Contas e sessões ficam em tabelas próprias.
/// </summary>
public sealed class Banco : IDisposable
{
    public string Caminho { get; }
    private readonly SqliteConnection _con;
    private readonly object _trava = new();

    public static readonly JsonSerializerOptions Json = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter() },
        IncludeFields = false,
        IgnoreReadOnlyProperties = true,
    };

    /// <summary>Hash do último JSON gravado de cada documento (rede de segurança contra Sujar esquecido).</summary>
    private readonly Dictionary<(string, long), ulong> _hashes = new();

    private static ulong Fnv(string s)
    {
        var h = 14695981039346656037UL;
        foreach (var ch in s) { h ^= ch; h *= 1099511628211UL; }
        return h;
    }

    public Banco(string caminho)
    {
        Caminho = caminho;
        var dir = Path.GetDirectoryName(Path.GetFullPath(caminho));
        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
        _con = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = caminho, Cache = SqliteCacheMode.Private, Pooling = false }.ToString());
        _con.Open();
        Exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA cache_size=-4000; PRAGMA temp_store=MEMORY;");
        Migrar();
    }

    private void Migrar()
    {
        Exec("""
            CREATE TABLE IF NOT EXISTS docs (colecao TEXT NOT NULL, id INTEGER NOT NULL, tipo TEXT NOT NULL, dados TEXT NOT NULL, PRIMARY KEY (colecao, id)) WITHOUT ROWID;
            CREATE TABLE IF NOT EXISTS contas (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, senha TEXT NOT NULL, criada_em INTEGER NOT NULL, ultimo_acesso INTEGER NOT NULL DEFAULT 0, notificacoes TEXT);
            CREATE TABLE IF NOT EXISTS sessoes (token_hash BLOB PRIMARY KEY, conta_id INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE, criada_em INTEGER NOT NULL, expira_em INTEGER NOT NULL, ultimo_uso INTEGER NOT NULL) WITHOUT ROWID;
            CREATE INDEX IF NOT EXISTS sessoes_conta ON sessoes(conta_id);
            CREATE TABLE IF NOT EXISTS icones (reino_id INTEGER PRIMARY KEY, tipo TEXT NOT NULL, dados BLOB NOT NULL, versao INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS meta (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
            """);
    }

    public void Exec(string sql, params (string, object?)[] ps)
    {
        lock (_trava)
        {
            using var c = _con.CreateCommand();
            c.CommandText = sql;
            foreach (var (n, v) in ps) c.Parameters.AddWithValue(n, v ?? DBNull.Value);
            c.ExecuteNonQuery();
        }
    }

    public T? Escalar<T>(string sql, params (string, object?)[] ps)
    {
        lock (_trava)
        {
            using var c = _con.CreateCommand();
            c.CommandText = sql;
            foreach (var (n, v) in ps) c.Parameters.AddWithValue(n, v ?? DBNull.Value);
            var r = c.ExecuteScalar();
            if (r == null || r is DBNull) return default;
            return (T)Convert.ChangeType(r, Nullable.GetUnderlyingType(typeof(T)) ?? typeof(T));
        }
    }

    public List<TR> Consultar<TR>(string sql, Func<SqliteDataReader, TR> ler, params (string, object?)[] ps)
    {
        lock (_trava)
        {
            using var c = _con.CreateCommand();
            c.CommandText = sql;
            foreach (var (n, v) in ps) c.Parameters.AddWithValue(n, v ?? DBNull.Value);
            using var rd = c.ExecuteReader();
            var l = new List<TR>();
            while (rd.Read()) l.Add(ler(rd));
            return l;
        }
    }

    public bool MundoExiste() => Escalar<long>("SELECT COUNT(*) FROM docs WHERE colecao='estado'") > 0;

    /// <summary>Carrega todas as coleções do mundo para a memória.</summary>
    public void Carregar(Mundo m)
    {
        RegistroTipos.Garantir();
        var porNome = m.Colecoes.ToDictionary(c => c.Nome);
        var linhas = Consultar("SELECT colecao, id, tipo, dados FROM docs", rd => (rd.GetString(0), rd.GetInt64(1), rd.GetString(2), rd.GetString(3)));
        foreach (var (col, id, tipo, dados) in linhas)
        {
            if (!porNome.TryGetValue(col, out var c)) continue;   // coleção que não existe mais
            var d = (Documento)JsonSerializer.Deserialize(dados, RegistroTipos.Tipo(tipo), Json)!;
            d.Id = id;
            c.AdicionarCarregado(d);
            _hashes[(col, id)] = Fnv(dados);
        }
    }

    /// <summary>Grava os documentos sujos e as remoções numa única transação.</summary>
    public int Salvar(Mundo m)
    {
        if (m.Sujos.Count == 0 && m.Removidos.Count == 0) return 0;
        var sujos = m.Sujos.ToList(); m.Sujos.Clear();
        return Gravar(sujos, m);
    }

    /// <summary>
    /// Serializa todos os documentos e grava os que mudaram sem <c>Sujar</c>. Roda de tempos em tempos.
    /// Devolve quantos estavam esquecidos (deveria ser 0: cada um é um Sujar faltando no código).
    /// </summary>
    public int SalvarEsquecidos(Mundo m, Action<string>? avisar = null)
    {
        Salvar(m);   // o que já está marcado como sujo não é esquecido: grava antes de comparar
        var esquecidos = new List<Documento>();
        foreach (var c in m.Colecoes)
            foreach (var d in c.Todos)
            {
                var j = JsonSerializer.Serialize(d, d.GetType(), Json);
                if (!_hashes.TryGetValue((c.Nome, d.Id), out var h) || h != Fnv(j)) esquecidos.Add(d);
            }
        if (esquecidos.Count > 0)
        {
            avisar?.Invoke("documentos alterados sem Sujar: " + string.Join(", ", esquecidos.Take(10).Select(d => d.GetType().Name + "#" + d.Id)));
            foreach (var d in esquecidos) m.Sujos.Add(d);
        }
        Salvar(m);
        return esquecidos.Count;
    }

    private int Gravar(List<Documento> sujos, Mundo m)
    {
        var removidos = m.Removidos.ToList(); m.Removidos.Clear();
        var linhas = new List<(string col, long id, string tipo, string json)>(sujos.Count);
        foreach (var d in sujos)
        {
            if (d.Dona == null) continue;   // removido depois de sujo
            linhas.Add((d.Dona.Nome, d.Id, RegistroTipos.Nome(d.GetType()), JsonSerializer.Serialize(d, d.GetType(), Json)));
        }
        try { Transacao(removidos, linhas); }
        catch
        {
            // a transação não entrou (disco cheio, E/S): devolve remoções e sujos para a próxima gravação
            m.Removidos.InsertRange(0, removidos);
            foreach (var d in sujos) if (d.Dona != null) m.Sujos.Add(d);
            throw;
        }
        foreach (var (c, i) in removidos) _hashes.Remove((c, i));
        foreach (var (c, i, _, j) in linhas) _hashes[(c, i)] = Fnv(j);
        return linhas.Count + removidos.Count;
    }

    private void Transacao(List<(string colecao, long id)> removidos, List<(string col, long id, string tipo, string json)> linhas)
    {
        lock (_trava)
        {
            using var tx = _con.BeginTransaction();
            using (var del = _con.CreateCommand())
            {
                del.Transaction = tx;
                del.CommandText = "DELETE FROM docs WHERE colecao=$c AND id=$i";
                var pc = del.Parameters.Add("$c", SqliteType.Text); var pi = del.Parameters.Add("$i", SqliteType.Integer);
                foreach (var (c, i) in removidos) { pc.Value = c; pi.Value = i; del.ExecuteNonQuery(); }
            }
            using (var up = _con.CreateCommand())
            {
                up.Transaction = tx;
                up.CommandText = "INSERT INTO docs(colecao,id,tipo,dados) VALUES($c,$i,$t,$d) ON CONFLICT(colecao,id) DO UPDATE SET tipo=excluded.tipo, dados=excluded.dados";
                var pc = up.Parameters.Add("$c", SqliteType.Text); var pi = up.Parameters.Add("$i", SqliteType.Integer);
                var pt = up.Parameters.Add("$t", SqliteType.Text); var pd = up.Parameters.Add("$d", SqliteType.Text);
                foreach (var (c, i, t, j) in linhas) { pc.Value = c; pi.Value = i; pt.Value = t; pd.Value = j; up.ExecuteNonQuery(); }
            }
            tx.Commit();
        }
    }

    /// <summary>Apaga o mundo (fim de temporada). Contas, sessões e meta ficam.</summary>
    public void ApagarMundo()
    {
        Exec("DELETE FROM docs; DELETE FROM icones;");
        _hashes.Clear();
    }

    public void Checkpoint() => Exec("PRAGMA wal_checkpoint(TRUNCATE);");

    public void Dispose()
    {
        try { Checkpoint(); } catch { /* fechando */ }
        _con.Dispose();
    }
}
