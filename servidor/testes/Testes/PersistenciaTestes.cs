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
    [Fact]
    public void Recrutamento_por_unidade_continua_depois_de_recarregar()
    {
        var dir = Path.Combine(Path.GetTempPath(), "rp-teste-" + Guid.NewGuid().ToString("N"));
        var arq = Path.Combine(dir, "t.db");
        try
        {
            var t = new MundoTeste();
            var r = t.NovoReino();
            t.DarRecursos(r);
            var item = Recrutamento.Recrutar(t.M, r, r.CasteloId, "milicia", 4);
            t.Avancar(TimeSpan.FromMilliseconds(item.FimDaUnidade(1)!.Value - t.M.Agora + 500));
            Assert.Equal(1, t.M.Locais[r.CasteloId].Guarnicao["milicia"]);
            using (var db = new Banco(arq)) db.Salvar(t.M);
            using var db2 = new Banco(arq);
            var m2 = new Mundo(Balanceamento.Padrao, t.Relogio);
            db2.Carregar(m2);
            m2.PrepararMapa();
            foreach (var e in m2.Eventos) m2.Agenda.Inserir(e);
            Assert.Equal(1, m2.Reinos[r.Id].Fila(Recrutamento.Fila).Itens[0].Prontos);
            t.Relogio.Agora = item.FimDaUnidade(2)!.Value;
            m2.ProcessarAte(t.Relogio.Agora);
            Assert.Equal(2, m2.Locais[r.CasteloId].Guarnicao["milicia"]);
            t.Relogio.Agora = item.Fim!.Value;
            m2.ProcessarAte(t.Relogio.Agora);
            Assert.Equal(4, m2.Locais[r.CasteloId].Guarnicao["milicia"]);
            Assert.Empty(m2.Reinos[r.Id].Fila(Recrutamento.Fila).Itens);
        }
        finally { try { Directory.Delete(dir, true); } catch { } }
    }

    [Fact]
    public void Falha_na_gravacao_nao_perde_remocoes_nem_sujos()
    {
        var dir = Path.Combine(Path.GetTempPath(), "rp-teste-" + Guid.NewGuid().ToString("N"));
        var arq = Path.Combine(dir, "t.db");
        try
        {
            var t = new MundoTeste();
            var r = t.NovoReino();
            var local = t.M.LocaisDe(r.Id).First(l => l.Id != r.CasteloId);
            using (var db = new Banco(arq))
            {
                db.Salvar(t.M);
                // a próxima transação falha (como um disco cheio): a remoção e o sujo não podem se perder
                db.Exec("CREATE TRIGGER falha BEFORE DELETE ON docs BEGIN SELECT RAISE(ABORT, 'disco cheio'); END;");
                t.M.Locais.Remover(local);
                r.Nome = "Outro Nome"; t.M.Sujar(r);
                Assert.ThrowsAny<Exception>(() => db.Salvar(t.M));
                db.Exec("DROP TRIGGER falha;");
                db.Salvar(t.M);
            }
            using var db2 = new Banco(arq);
            var m2 = new Mundo(Balanceamento.Padrao, t.Relogio);
            db2.Carregar(m2);
            Assert.Null(m2.Locais.Obter(local.Id));
            Assert.Equal("Outro Nome", m2.Reinos[r.Id].Nome);
        }
        finally { try { Directory.Delete(dir, true); } catch { } }
    }
}
