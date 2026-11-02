using ReinoDePedra.Jogo;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Persistencia;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Testes;

public class PersistenciaTestes
{
    [Fact]
    public void Mundo_salvo_e_recarregado_continua_igual()
    {
        var dir = Path.Combine(Path.GetTempPath(), "rp-teste-" + Guid.NewGuid().ToString("N"));
        var arq = Path.Combine(dir, "t.db");
        try
        {
            var t = new MundoTeste();
            var r = t.NovoReino();
            Obras.Melhorar(t.M, r, r.CasteloId);
            using (var db = new Banco(arq))
            {
                db.Salvar(t.M);
                Assert.Equal(0, db.SalvarEsquecidos(t.M));   // nada mudou sem Sujar
            }
            using var db2 = new Banco(arq);
            var m2 = new Mundo(Balanceamento.Padrao, t.Relogio);
            db2.Carregar(m2);
            m2.PrepararMapa();
            foreach (var e in m2.Eventos) m2.Agenda.Inserir(e);
            var r2 = m2.Reinos[r.Id];
            Assert.Equal(r.Nome, r2.Nome);
            Assert.Single(r2.Fila(Obras.Fila).Itens);
            Assert.Equal(5, m2.LocaisDe(r.Id).Count());
            Assert.Equal(t.M.Mapa.Compacto(), m2.Mapa.Compacto());
            t.Relogio.Agora += 5 * T.Min;
            m2.ProcessarAte(t.Relogio.Agora);
            Assert.Equal(2, m2.Locais[r.CasteloId].Nivel);
        }
        finally { try { Directory.Delete(dir, true); } catch { } }
    }
}
