using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Pessoas;

namespace ReinoDePedra.Jogo
{
    public sealed partial class Mundo
    {
        public Colecao<Pessoa> Pessoas { get; } = new("pessoas");

        private readonly Dictionary<long, HashSet<long>> _pessoasDoReino = new();
        private readonly Dictionary<long, HashSet<long>> _pessoasNoLocal = new();

        internal void ReindexarPessoas()
        {
            _pessoasDoReino.Clear(); _pessoasNoLocal.Clear();
            foreach (var p in Pessoas) IndexarPessoa(p);
        }

        internal void IndexarPessoa(Pessoa p)
        {
            if (!_pessoasDoReino.TryGetValue(p.ReinoId, out var r)) _pessoasDoReino[p.ReinoId] = r = new();
            r.Add(p.Id);
            if (p.LocalId is long l)
            {
                if (!_pessoasNoLocal.TryGetValue(l, out var s)) _pessoasNoLocal[l] = s = new();
                s.Add(p.Id);
            }
        }

        internal void DesindexarPessoa(Pessoa p)
        {
            if (_pessoasDoReino.TryGetValue(p.ReinoId, out var r)) r.Remove(p.Id);
            if (p.LocalId is long l && _pessoasNoLocal.TryGetValue(l, out var s)) s.Remove(p.Id);
        }

        /// <summary>Pessoas do reino (todas: civis, em treino, soldados...).</summary>
        public IEnumerable<Pessoa> PessoasDe(long reinoId) =>
            _pessoasDoReino.TryGetValue(reinoId, out var s) ? s.Select(id => Pessoas.Obter(id)).OfType<Pessoa>() : [];

        /// <summary>Pessoas cujo local (trabalho, casa ou guarnição) é este, inclusive as que estão fora dele numa marcha.</summary>
        public IEnumerable<Pessoa> PessoasNoLocal(long localId) =>
            _pessoasNoLocal.TryGetValue(localId, out var s) ? s.Select(id => Pessoas.Obter(id)).OfType<Pessoa>() : [];
    }
}

namespace ReinoDePedra.Jogo.Reinos
{
    public sealed partial class Reino
    {
        /// <summary>Parte fracionária do crescimento da população (a pessoa nasce quando fecha 1).</summary>
        public double PopFracao { get; set; }
        /// <summary>Quantos nomes de pessoa o reino já sorteou (semente do próximo).</summary>
        public int NomesSorteados { get; set; }
    }
}
