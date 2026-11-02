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
    /// reforço entre aliados, teto de população, gatilhos de alianças e comércio, bandeiras na foto da névoa e estandartes.
    /// </summary>
    [Sistema]
    public static class SistemaSocial
    {
        public const string MotivoAliado = "Este local é de um aliado.";
        public const string MotivoTregua = "Trégua de saída da aliança: o dono deste local está em trégua com vocês.";
        public const string MotivoPacto = "Há um pacto de não agressão com o dono deste local.";

        public static void AoIniciar(Mundo m) => Sistemas.UmaVez("social", () =>
        {
            Sistemas.Registrar("alianca", "Alianças", "Reinos aliados se reconhecem, pedem recursos, reforçam uns aos outros e conversam.", "alianca");
            Sistemas.Registrar("comercio", "Comércio e diplomacia", "Trocas diretas, pactos de não agressão e resgates com reinos que você conhece.", "comercio");
            // gatilho de alianças e comércio: conhecer o primeiro reino
            Conhecimento.AoConhecer += (mm, quem, _, _) => { Sistemas.Revelar(mm, quem, "alianca"); Sistemas.Revelar(mm, quem, "comercio"); };

            // quem pode atacar quem: aliados nunca; trégua e pacto, recusados no envio se o atacante sabe de quem é o local,
            // e descobertos ao chegar (ou no encontro) se não sabe
            Permissoes.AntesDeEnviar.Add((mm, a, b) => Aliancas.SaoAliados(mm, a.Id, b.Id) ? MotivoAliado : null);
            Permissoes.AntesDeEnviarNoLocal.Add((mm, a, b, l) => SabeODono(a, l) ? Bloqueio(mm, a, b) : null);
            Permissoes.AoChegar.Add(Bloqueio);
            Capturas.Ignorar.Add((mm, captor, dono) => Aliancas.SaoAliados(mm, captor.Id, dono.Id) || Comercio.PactoAtivo(mm, captor.Id, dono.Id));

            // reforço entre aliados: estende a ordem "reforcar"
            OrdemReforcar.Aceita.Add(Reforcos.Aceita);
            OrdemReforcar.Chegada.Add(Reforcos.Chegou);
            GT.Reservadas.Add(Reforcos.Reservadas);
            Economia.OcupantesExtras.Add(Reforcos.Ocupantes);
            Economia.OcupantesExtras.Add(Mensageiros.Ocupantes);
            Combates.AoTerminar.Add(Reforcos.AoTerminar);

            // estandarte e bandeira tornam o reino conhecido
            Combates.AoTerminar.Add((mm, rc) =>
            {
                if (mm.Batalhas.Obter(rc.BatalhaId) is not { Estandarte: true }) return;
                if (mm.Reinos.Obter(rc.DefensorId) is { } d && mm.Reinos.Obter(rc.AtacanteId) is { } a) Conhecimento.Conhecer(mm, d, a, "estandarte");
            });
            Fotos.Fotografos.Add(Bandeiras.Foto);

            // cargas entre reinos: o que acontece quando chegam (ou são roubadas)
            Remessas.AoTerminar[Comercio.Troca] = (mm, r, ok) => Comercio.Entregue(mm, r, ok, Comercio.Troca);
            Remessas.AoTerminar[Comercio.Pedido] = (mm, r, ok) => Comercio.Entregue(mm, r, ok, Comercio.Pedido);
            Remessas.AoTerminar[Comercio.PactoT] = Comercio.PagamentoPacto;
            Remessas.AoTerminar[Comercio.Resgate] = Comercio.PagamentoResgate;
            Capturas.AoPedirResgate += (mm, p) => mm.Avisar(p.DonoId, "comercio");
        });

        /// <summary>O atacante sabe quem é o dono do local (espionou e o dono não mudou).</summary>
        private static bool SabeODono(Reino a, Local l) => a.LocaisEspionados.TryGetValue(l.Id, out var e) && e.DonoId == l.ReinoId;

        private static string? Bloqueio(Mundo m, Reino a, Reino b) =>
            Aliancas.EmTregua(m, a.Id, b.Id) ? MotivoTregua : Comercio.PactoAtivo(m, a.Id, b.Id) ? MotivoPacto : null;
    }
}
