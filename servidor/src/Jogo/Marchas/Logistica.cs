using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.Marchas;

/// <summary>
/// Requisição automática: o material de uma obra sai do próprio local e, o que faltar, dos locais
/// mais próximos (em tempo de viagem a pé), levado por carregadores. O recurso é reservado (retirado
/// da origem) na hora do pedido. Recusa sem mexer em nada se o reino inteiro não tiver o material.
/// </summary>
public static class Logistica
{
    public static void Requisitar(Mundo m, Reino r, ItemFila item, string nomeFila)
    {
        Economia.Atualizar(m, r);
        var faltam = item.Custo.Where(kv => kv.Value > 0).ToDictionary(kv => kv.Key, kv => kv.Value);
        var total = Economia.TotalGuardado(m, r);
        var falta = faltam.Where(kv => total.Qtd(kv.Key) + 1e-6 < kv.Value)
            .Select(kv => $"{Math.Ceiling(kv.Value - total.Qtd(kv.Key))} {NomeRecurso(kv.Key)}").ToList();
        if (falta.Count > 0) throw new RegraException("Faltam recursos: " + string.Join(", ", falta) + ".");

        var destinoLocal = item.LocalId is long lid ? m.Locais.Obter(lid) : null;
        // 1) o que já está no local da obra
        if (destinoLocal != null) TirarDoLocal(m, destinoLocal, item, faltam);
        if (faltam.Count == 0) return;
        // 2) dos locais mais próximos, um grupo de carregadores por origem
        EnviarDosProximos(m, r, item, nomeFila, faltam, destinoLocal);
    }

    /// <summary>
    /// Material de um item roubado no caminho: pede de novo aos locais mais próximos o que se perdeu.
    /// O que o reino não tiver fica faltando (o item espera, e o jogador pode cancelar).
    /// </summary>
    public static void Repor(Mundo m, Reino r, string nomeFila, long itemId, Recursos perdido)
    {
        var item = r.Fila(nomeFila).Itens.FirstOrDefault(i => i.Id == itemId);
        if (item == null || perdido.Count == 0) return;
        Economia.Atualizar(m, r);
        var faltam = perdido.Where(kv => kv.Value > 0).ToDictionary(kv => kv.Key, kv => kv.Value);
        var destinoLocal = item.LocalId is long lid ? m.Locais.Obter(lid) : null;
        if (destinoLocal != null && destinoLocal.ReinoId == r.Id) TirarDoLocal(m, destinoLocal, item, faltam);
        if (faltam.Count > 0) EnviarDosProximos(m, r, item, nomeFila, faltam, destinoLocal);
        m.Sujar(r);
        Filas.TentarIniciar(m, r, nomeFila);
    }

    /// <summary>Entrega ao item, direto, o que já está no local da obra.</summary>
    private static void TirarDoLocal(Mundo m, Local l, ItemFila item, Dictionary<string, double> faltam)
    {
        foreach (var k in faltam.Keys.ToList())
        {
            var tirado = l.Estoque.Retirar(k, faltam[k]);
            if (tirado > 0) { item.Entregue.Somar(k, tirado); faltam[k] -= tirado; }
            if (faltam[k] <= 1e-6) faltam.Remove(k);
        }
        m.Sujar(l);
    }

    private static void EnviarDosProximos(Mundo m, Reino r, ItemFila item, string nomeFila, Dictionary<string, double> faltam, Local? destinoLocal)
    {
        var vel = m.P.Carregador.Vel;
        var tempos = Caminhos.MinutosAte(m, item.Hex, vel);
        var origens = m.LocaisDe(r.Id).Where(l => l.Id != destinoLocal?.Id && !l.Ruina)
            .OrderBy(l => tempos[l.Hex]).ToList();
        foreach (var o in origens)
        {
            if (faltam.Count == 0) break;
            var carga = new Recursos();
            foreach (var k in faltam.Keys.ToList())
            {
                var tirado = o.Estoque.Retirar(k, faltam[k]);
                if (tirado <= 0) continue;
                carga.Somar(k, tirado); faltam[k] -= tirado;
                if (faltam[k] <= 1e-6) faltam.Remove(k);
            }
            if (carga.Count == 0) continue;
            m.Sujar(o);
            Enviar(m, r, o.Hex, item.Hex, carga, item.Id, nomeFila, destinoLocal?.Id);
        }
    }

    /// <summary>Despacha carregadores com uma carga. A pé, sem escolta, 50 por pessoa.</summary>
    public static Carregadores Enviar(Mundo m, Reino r, int de, int para, Recursos carga, long? itemId, string fila, long? destinoLocalId)
    {
        var rota = Caminhos.Calcular(m, de, para, m.P.Carregador.Vel);
        var mc = new Carregadores
        {
            ReinoId = r.Id, Carga = carga, Vel = m.P.Carregador.Vel, ItemId = itemId, Fila = fila,
            DestinoLocalId = destinoLocalId,
            Pessoas = (int)Math.Max(1, Math.Ceiling(carga.Total / m.P.Carregador.Carga)),
        };
        mc.Partir(m, rota);
        return mc;
    }

    public static string NomeRecurso(string k) => k switch
    {
        "aco" => "aço", "minerio" => "minério raro", "cavalo" => "cavalos de raça", "gema" => "pedras preciosas",
        "ervas" => "ervas raras", _ => k,
    };
}
