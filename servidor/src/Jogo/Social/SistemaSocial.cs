using ReinoDePedra.Jogo.Combate;
using ReinoDePedra.Jogo.Exploracao;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

namespace ReinoDePedra.Jogo.Social
{
    /// <summary>
    /// Ganchos do social: quem não pode atacar quem (aliança, trégua de saída, pacto), capturas entre aliados e pactuados,
    /// reforço entre aliados, teto de população e cargas entre reinos.
    /// </summary>
    [Sistema]
    public static class SistemaSocial
    {
        public const string MotivoAliado = "Este local é de um aliado.";
        public const string MotivoTregua = "Trégua de saída da aliança: o dono deste local está em trégua com vocês.";
        public const string MotivoPacto = "Há um pacto de não agressão com o dono deste local.";

        public static void AoIniciar(Mundo m) => Sistemas.UmaVez("social", () =>
        {
            // alianças e comércio ficam abertos desde o início (nenhum gatilho: chave não registrada aparece sempre)

            // quem pode atacar quem: aliados nunca; trégua e pacto são públicos, recusados já no envio. Ao chegar, vale de novo
            // para o pacto que começou com as tropas a caminho
            Permissoes.AntesDeEnviar.Add((mm, a, b) => Aliancas.SaoAliados(mm, a.Id, b.Id) ? MotivoAliado : Bloqueio(mm, a, b));
            Permissoes.AoChegar.Add(Bloqueio);
            Capturas.Ignorar.Add((mm, captor, dono) => Aliancas.SaoAliados(mm, captor.Id, dono.Id) || Comercio.PactoAtivo(mm, captor.Id, dono.Id));

            // reforço entre aliados: estende a ordem "reforcar"
            OrdemReforcar.Aceita.Add(Reforcos.Aceita);
            OrdemReforcar.Chegada.Add(Reforcos.Chegou);
            GT.Reservadas.Add(Reforcos.Reservadas);
            Economia.OcupantesExtras.Add(Reforcos.Ocupantes);
            Economia.OcupantesExtras.Add(Mensageiros.Ocupantes);
            Combates.AoTerminar.Add(Reforcos.AoTerminar);

            // cargas entre reinos: o que acontece quando chegam (ou são roubadas)
            Remessas.AoTerminar[Comercio.Troca] = (mm, r, ok) => Comercio.Entregue(mm, r, ok, Comercio.Troca);
            Remessas.AoTerminar[Comercio.Pedido] = (mm, r, ok) => Comercio.Entregue(mm, r, ok, Comercio.Pedido);
            Remessas.AoTerminar[Comercio.PactoT] = Comercio.PagamentoPacto;
            Remessas.AoTerminar[Comercio.Resgate] = Comercio.PagamentoResgate;
            Capturas.AoPedirResgate += (mm, p) => mm.Avisar(p.DonoId, "comercio");
        });

        private static string? Bloqueio(Mundo m, Reino a, Reino b) =>
            Aliancas.EmTregua(m, a.Id, b.Id) ? MotivoTregua : Comercio.PactoAtivo(m, a.Id, b.Id) ? MotivoPacto : null;
    }
}
