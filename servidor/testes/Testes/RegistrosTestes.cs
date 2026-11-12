using System.Reflection;
using System.Text.Json;
using ReinoDePedra.Api;
using ReinoDePedra.Api.Endpoints;
using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Persistencia;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Testes;

/// <summary>
/// O servidor publicado é Native AOT: nada de enumerar tipos nem de JSON por reflection. Os registros por convenção viraram
/// listas explícitas (documentos, ordens, itens de fila, sistemas, módulos de rotas, enums, tipos do JSON gerado); estes testes,
/// que rodam com JIT, conferem cada lista contra a reflection para que um tipo novo esquecido quebre aqui e não na produção.
/// </summary>
public class RegistrosTestes
{
    private static readonly Assembly AsmJogo = typeof(Mundo).Assembly;
    private static readonly Assembly AsmApi = typeof(Servidor).Assembly;

    private static void MesmoConjunto(IEnumerable<Type> esperado, IEnumerable<Type> lista, string oque)
    {
        var e = esperado.ToHashSet(); var l = lista.ToList();
        var faltam = e.Except(l).Select(t => t.FullName).ToList();
        var sobram = l.Except(e).Select(t => t.FullName).ToList();
        Assert.True(faltam.Count == 0 && sobram.Count == 0 && l.Count == l.Distinct().Count(),
            $"{oque}: faltam [{string.Join(", ", faltam)}], sobram [{string.Join(", ", sobram)}]");
    }

    [Fact]
    public void Documentos_sao_todos_os_concretos_e_tem_metadados_gerados()
    {
        MesmoConjunto(AsmJogo.GetTypes().Where(t => !t.IsAbstract && typeof(Documento).IsAssignableFrom(t)), JsonJogo.Documentos, "JsonJogo.Documentos");
        foreach (var t in JsonJogo.Documentos)
        {
            Assert.NotNull(JsonJogo.Default.GetTypeInfo(t));
            Assert.Same(t, RegistroTipos.Tipo(t.Name));
        }
    }

    [Fact]
    public void Ordens_e_itens_de_fila_sao_todas_as_implementacoes()
    {
        foreach (var i in new[] { typeof(IOrdemExercito), typeof(ITipoItemFila) })
        {
            var esperado = AsmJogo.GetTypes().Where(t => !t.IsAbstract && !t.IsInterface && i.IsAssignableFrom(t) && t.GetConstructor(Type.EmptyTypes) != null);
            var lista = RegistroTipos.Fabricas.Select(f => f()).Where(i.IsInstanceOfType).Select(o => o.GetType());
            MesmoConjunto(esperado, lista, "RegistroTipos.Fabricas (" + i.Name + ")");
        }
        Assert.All(RegistroTipos.Fabricas.Select(f => f()), o => Assert.True(o is IOrdemExercito or ITipoItemFila, o.GetType().Name));
    }

    private static IEnumerable<Type> ComSistema(Assembly a) => a.GetTypes().Where(t => t.IsDefined(typeof(SistemaAttribute), false));

    [Fact]
    public void Sistemas_sao_todas_as_classes_marcadas_na_mesma_ordem()
    {
        // a ordem é a que a reflection listava (os ganchos se registram nessa ordem)
        Assert.Equal(ComSistema(AsmJogo).Select(t => t.FullName), Sistemas.Todos.Select(s => s.Method.DeclaringType!.FullName));
        Assert.Equal(ComSistema(AsmApi).Select(t => t.FullName), RegistroApi.Sistemas.Select(s => s.Method.DeclaringType!.FullName));
        Assert.All(Sistemas.Todos.Concat(RegistroApi.Sistemas), s => Assert.Equal("AoIniciar", s.Method.Name));
    }

    [Fact]
    public void Modulos_de_rotas_sao_todos()
    {
        MesmoConjunto(AsmApi.GetTypes().Where(t => !t.IsAbstract && typeof(IModuloApi).IsAssignableFrom(t)), RegistroApi.Modulos().Select(m => m.GetType()), "RegistroApi.Modulos");
    }

    [Fact]
    public void Todo_enum_tem_conversor_de_texto()
    {
        var enums = AsmJogo.GetTypes().Concat(AsmApi.GetTypes()).Where(t => t.IsEnum && (t.IsPublic || t.IsNestedPublic));
        var com = ConversoresEnum.Todos().Select(c => c.GetType().GetGenericArguments()[0]);
        MesmoConjunto(enums, com, "ConversoresEnum.Todos");
    }

    [Fact]
    public void Respostas_e_pedidos_da_API_tem_metadados_gerados()
    {
        var tipos = AsmApi.GetTypes().Concat(AsmJogo.GetTypes())
            .Where(t => t.IsPublic || t.IsNestedPublic)
            .Where(t => (t.Name.EndsWith("Json") && t.GetMethod("<Clone>$") != null) || (t.Namespace?.StartsWith("ReinoDePedra.Api") == true && t.Name.StartsWith("Pedido")))
            .ToList();
        Assert.True(tipos.Count > 250, "poucos tipos: " + tipos.Count);
        var faltam = tipos.Where(t => JsonApi.Default.GetTypeInfo(t) == null).Select(t => t.FullName).ToList();
        Assert.True(faltam.Count == 0, "sem [JsonSerializable] em JsonApi: " + string.Join(", ", faltam));
    }

    [Fact]
    public void Sem_metadados_gerados_o_JSON_recusa_em_vez_de_cair_na_reflection()
    {
        // Directory.Build.props desliga a reflection do System.Text.Json (como no Native AOT): um tipo fora dos contextos falha
        Assert.False(JsonSerializer.IsReflectionEnabledByDefault);
        Assert.ThrowsAny<Exception>(() => JsonSerializer.Serialize(new { fora = 1 }, Json.Web));
    }
}
