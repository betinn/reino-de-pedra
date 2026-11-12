using System.Text.Json;
using System.Text.Json.Serialization.Metadata;
using ReinoDePedra.Jogo.Persistencia;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Temporada;

namespace ReinoDePedra.Jogo
{
    public sealed partial class Mundo
    {
        /// <summary>Legado por conta: fica fora das coleções do mundo (o mundo é apagado no fim da temporada).</summary>
        public Legados Legados { get; } = new();
        /// <summary>Banco do processo (null nos testes sem persistência). O reset da temporada e o legado gravam por aqui.</summary>
        public Banco? Banco { get; set; }
        /// <summary>Duração da temporada em ms, só para desenvolvimento e testes (REINO_TEMPORADA_MIN); null = P.temporadaDias.</summary>
        public long? DuracaoTemporadaMs { get; set; }
    }
}

namespace ReinoDePedra.Jogo.Temporada
{
    /// <summary>
    /// O que atravessa as temporadas, por conta (não por reino): linhagem, relíquias da temporada, títulos, brasões e histórico,
    /// e os dias ativos da temporada em curso. Gravado na tabela <c>legado</c> do SQLite (um JSON por conta), fora de <c>docs</c>.
    /// </summary>
    public sealed class LegadoConta
    {
        public long ContaId { get; set; }
        /// <summary>Temporadas jogadas (ativo em pelo menos P.temporadaServ.linhagem.diasAtivos dias).</summary>
        public int TemporadasJogadas { get; set; }
        public List<ReliquiaTemporada> Reliquias { get; set; } = new();
        public List<TituloGanho> Titulos { get; set; } = new();
        public string? TituloAtivo { get; set; }
        public List<BrasaoGuardado> Brasoes { get; set; } = new();
        public List<TemporadaJogada> Historico { get; set; } = new();
        /// <summary>Região escolhida para o exílio (linhagem nível P.temporadaServ.desbloqueios.exilio); null = sorteio.</summary>
        public string? RegiaoExilio { get; set; }
        /// <summary>Temporada a que <see cref="DiasAtivos"/> se refere.</summary>
        public int DiasTemporada { get; set; }
        /// <summary>Dias da temporada (0, 1, 2...) em que a conta abriu o jogo.</summary>
        public HashSet<int> DiasAtivos { get; set; } = new();
        public long UltimoId { get; set; }
    }

    /// <summary>Relíquia da temporada: bônus pequeno (produção, ataque, defesa ou crescimento), equipável até P.legado.equipadas.</summary>
    public sealed class ReliquiaTemporada
    {
        public long Id { get; set; }
        public string Nome { get; set; } = "";
        /// <summary>"producao", "ataque", "defesa" ou "crescimento".</summary>
        public string Tipo { get; set; } = "";
        public double Bonus { get; set; }
        public int Temporada { get; set; }
        /// <summary>Conquista ("baixas", "tropas", "familias", "lendaria", "cerco").</summary>
        public string Conquista { get; set; } = "";
        public string Como { get; set; } = "";
        public bool Equipada { get; set; }
    }

    public sealed class TituloGanho
    {
        public string Nome { get; set; } = "";
        public string Como { get; set; } = "";
        public int Temporada { get; set; }
    }

    public sealed class BrasaoGuardado
    {
        public Brasao Brasao { get; set; } = new();
        public string Nome { get; set; } = "";
        public int Temporada { get; set; }
    }

    public sealed class TemporadaJogada
    {
        public int Temporada { get; set; }
        public string NomeReino { get; set; } = "";
        public string Resumo { get; set; } = "";
        public int DiasAtivos { get; set; }
        /// <summary>Contou para a linhagem.</summary>
        public bool Contou { get; set; }
    }

    /// <summary>
    /// Legados de todas as contas na memória (só a thread do motor mexe). Lido do banco na subida; cada mudança grava a linha
    /// da conta na hora (mudanças são raras: equipar, um dia ativo novo, o fim da temporada).
    /// </summary>
    public sealed class Legados
    {
        private readonly Dictionary<long, LegadoConta> _porConta = new();
        private bool _carregado;

        public IEnumerable<LegadoConta> Todos => _porConta.Values;
        public LegadoConta? Obter(long contaId) => _porConta.GetValueOrDefault(contaId);
        /// <summary>Legado da conta (criado vazio se não existe; só é gravado quando muda).</summary>
        public LegadoConta De(long contaId) => _porConta.TryGetValue(contaId, out var l) ? l : _porConta[contaId] = new LegadoConta { ContaId = contaId };

        public void Carregar(Banco? b)
        {
            if (_carregado || b == null) return;
            _carregado = true;
            b.Exec("CREATE TABLE IF NOT EXISTS legado (conta_id INTEGER PRIMARY KEY, dados TEXT NOT NULL)");
            foreach (var (id, json) in b.Consultar("SELECT conta_id, dados FROM legado", rd => (rd.GetInt64(0), rd.GetString(1))))
            {
                var l = JsonSerializer.Deserialize(json, (JsonTypeInfo<LegadoConta>)Banco.Json.GetTypeInfo(typeof(LegadoConta)));
                if (l != null) { l.ContaId = id; _porConta[id] = l; }
            }
        }

        public void Salvar(Mundo m, LegadoConta l)
        {
            _porConta[l.ContaId] = l;
            if (m.Banco == null) return;
            if (!_carregado) Carregar(m.Banco);
            m.Banco.Exec("INSERT INTO legado(conta_id, dados) VALUES($c, $d) ON CONFLICT(conta_id) DO UPDATE SET dados=excluded.dados",
                ("$c", l.ContaId), ("$d", JsonSerializer.Serialize(l, (JsonTypeInfo<LegadoConta>)Banco.Json.GetTypeInfo(typeof(LegadoConta)))));
        }
    }
}
