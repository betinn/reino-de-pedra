namespace ReinoDePedra.Api.Endpoints;

/// <summary>
/// Um grupo de rotas da API. Implementações são achadas por reflexão no início (construtor sem parâmetros):
/// para um sistema novo, crie um arquivo com uma classe que implementa esta interface.
/// Rotas ficam sob <c>/api/v1</c>. <paramref name="publico"/> não exige login; <paramref name="conta"/> exige.
/// Dentro de <c>conta</c>, use <c>ctx.ContaId()</c> e <c>motor.Executar(m =&gt; ...)</c> para tocar no mundo.
/// </summary>
public interface IModuloApi
{
    void Mapear(RouteGroupBuilder publico, RouteGroupBuilder conta);
}
