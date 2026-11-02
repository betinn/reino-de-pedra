namespace ReinoDePedra.Jogo.Nucleo;

/// <summary>
/// Ação recusada por uma regra do jogo. A mensagem vai para o jogador (português, curta, sem detalhes internos).
/// A API devolve 400 (ou o <see cref="Status"/> informado) com <c>{ "erro": mensagem }</c>.
/// </summary>
public sealed class RegraException(string mensagem, int status = 400) : Exception(mensagem)
{
    public int Status { get; } = status;
}
