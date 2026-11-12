using ReinoDePedra.Api.Endpoints;
using ReinoDePedra.Api.Visoes;
using ReinoDePedra.Jogo;

namespace ReinoDePedra.Api;

/// <summary>
/// Os sistemas e os módulos de rotas da API, em listas explícitas: o servidor publicado é Native AOT, que não enumera tipos.
/// Uma classe nova com [Sistema] ou que implementa <see cref="IModuloApi"/> entra aqui; o teste RegistrosTestes confere
/// as listas contra a reflection.
/// </summary>
public static class RegistroApi
{
    /// <summary>AoIniciar das classes [Sistema] da API, na ordem em que a reflection as listava (antes dos do jogo).</summary>
    public static readonly Action<Mundo>[] Sistemas =
    [
        VisaoSistemas.AoIniciar, ExtrasCombate.AoIniciar, ExtrasExploracao.AoIniciar, ExtrasFerraria.AoIniciar,
        ExtrasGuerra.AoIniciar, ExtrasSocial.AoIniciar, SistemaTemporadaApi.AoIniciar, ExtrasTropas.AoIniciar, ExtrasValiosos.AoIniciar,
    ];

    public static IModuloApi[] Modulos() =>
    [
        new ModuloColeta(), new ModuloCombate(), new ModuloConta(), new ModuloEventos(), new ModuloExploracao(), new ModuloFerraria(),
        new ModuloGuerra(), new ModuloPessoas(), new ModuloPublico(), new ModuloRegistros(), new ModuloReino(), new ModuloSocial(),
        new ModuloTemporada(), new ModuloTropas(), new ModuloValiosos(),
    ];
}
