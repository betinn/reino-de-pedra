using ReinoDePedra.Jogo.Persistencia;

namespace ReinoDePedra.Testes;

/// <summary>Toda mudança de documento passa por m.Sujar: depois de dias de jogo com fauna, IA e combates, a varredura não acha nada esquecido.</summary>
public class SujarTestes
{
    [Fact]
    public void Dias_de_jogo_nao_deixam_documento_alterado_sem_sujar()
    {
        var dir = Path.Combine(Path.GetTempPath(), "rp-sujar-" + Guid.NewGuid().ToString("N"));
        try
        {
            var t = new MundoTeste(fauna: true);
            ReinoDePedra.Jogo.IA.Ocupacao.Completar(t.M);
            var r = t.NovoReino();
            using var db = new Banco(Path.Combine(dir, "t.db"));
            db.Salvar(t.M);
            var avisos = new List<string>();
            for (var h = 0; h < 72; h++)
            {
                t.AvancarHoras(1);
                db.Salvar(t.M);
                var n = db.SalvarEsquecidos(t.M, avisos.Add);
                Assert.True(n == 0, $"hora {h}: {string.Join(" | ", avisos)}");
            }
        }
        finally { try { Directory.Delete(dir, true); } catch { } }
    }
}
