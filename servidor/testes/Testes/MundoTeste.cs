using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Testes;

/// <summary>
/// Mundo de teste: relógio falso, semente fixa, sistemas iniciados. Avance o tempo com <see cref="Avancar"/>.
/// Sem fauna por padrão (ataques de fauna são sorteios); <c>fauna: true</c> mantém a fauna gerada com o mundo.
/// Reinos novos nascem sem os primeiros passos (<see cref="InicioP.Vazio"/>: nível 1, sem tropas nem exploradores), para os
/// cenários partirem de um estado conhecido; <c>inicioPronto: true</c> usa o início do balanceamento.
/// </summary>
public sealed class MundoTeste
{
    public static readonly long Inicio = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero).ToUnixTimeMilliseconds();
    public RelogioFalso Relogio { get; } = new(Inicio);
    public Mundo M { get; }
    public Balanceamento B => M.B;

    public MundoTeste(ulong semente = 7, bool fauna = false, bool inicioPronto = false)
    {
        M = new Mundo(Balanceamento.Padrao, Relogio) { InicioReino = inicioPronto ? null : InicioP.Vazio };
        M.CriarNovo(semente);
        Sistemas.IniciarTodos(M);
        if (!fauna) ReinoDePedra.Jogo.Exploracao.Fauna.Limpar(M);
    }

    /// <summary>Avança o relógio e executa os eventos vencidos, cada um no seu instante.</summary>
    public void Avancar(TimeSpan t)
    {
        var fim = Relogio.Agora + (long)t.TotalMilliseconds;
        while (M.Agenda.Proximo(out _, out var q) && q <= fim)
        {
            Relogio.Agora = Math.Max(Relogio.Agora, q);
            M.ProcessarAte(Relogio.Agora);
        }
        Relogio.Agora = fim;
        M.ProcessarAte(fim);
    }
    public void AvancarMin(double min) => Avancar(TimeSpan.FromMinutes(min));
    public void AvancarHoras(double h) => Avancar(TimeSpan.FromHours(h));

    private int _n;
    /// <summary>Cria um reino (de jogador, salvo <paramref name="ia"/>) na próxima vaga livre.</summary>
    public Reino NovoReino(string? nome = null, bool ia = false)
    {
        _n++;
        string[] nomes = ["Pedralva", "Valdren", "Corvo Negro", "Lumen", "Fenda", "Mirante", "Rocha Alta", "Vale Frio"];
        nome ??= nomes[(_n - 1) % nomes.Length] + (_n > nomes.Length ? " " + "abcdefghijklmnopqrstuvwxyz"[_n % 26] : "");
        return CriacaoReino.Criar(M, ia ? null : 1000 + _n, nome, new Brasao());
    }

    /// <summary>Põe recursos no castelo do reino (atalho de teste).</summary>
    public void DarRecursos(Reino r, double qtd = 1e6, params string[] tipos)
    {
        Economia.Atualizar(M, r);
        var c = M.Locais[r.CasteloId];
        foreach (var k in tipos.Length > 0 ? tipos : Formulas.Basicos) c.Estoque.Somar(k, qtd);
        M.Sujar(c);
    }
}
