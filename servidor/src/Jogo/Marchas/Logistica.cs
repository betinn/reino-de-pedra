using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.Marchas;

/// <summary>
/// Requisição automática: o material de um item da fila sai do próprio local e, o que faltar, dos locais mais próximos (em
/// tempo de viagem a pé), levado por carregadores. O recurso é retirado da origem na hora do pedido. Quem decide o pedido é
/// <see cref="Filas.Avaliar"/>, quando chega a vez do item e o reino tem o bastante.
/// </summary>
public static class Logistica
{
    /// <summary>Tira dos estoques <paramref name="pedido"/> (o custo inteiro do item, se null) e manda para o item.</summary>
    public static void Requisitar(Mundo m, Reino r, ItemFila item, string nomeFila, Recursos? pedido = null)
    {
        Economia.Atualizar(m, r);
        var faltam = (pedido ?? item.Custo).Where(kv => kv.Value > 0).ToDictionary(kv => kv.Key, kv => kv.Value);
        Buscar(m, r, item, nomeFila, faltam);
    }

    /// <summary>
    /// Material de um item roubado no caminho: pede de novo aos locais mais próximos o que se perdeu. O que o reino não tiver fica
    /// faltando: o item espera e a avaliação das filas pede o resto quando houver (<see cref="Faltando"/>).
    /// </summary>
    public static void Repor(Mundo m, Reino r, string nomeFila, long itemId, Recursos perdido)
    {
        var item = r.FilaSe(nomeFila)?.Itens.FirstOrDefault(i => i.Id == itemId);
        if (item == null || perdido.Count == 0) return;
        Economia.Atualizar(m, r);
        Buscar(m, r, item, nomeFila, perdido.Where(kv => kv.Value > 0).ToDictionary(kv => kv.Key, kv => kv.Value));
        m.Sujar(r);
        Filas.TentarIniciar(m, r, nomeFila);
        Filas.Acordar(m, r);
    }

    /// <summary>
    /// O que falta a um item Reservado, contando o que já chegou e o que está nos carregadores (na carga e nas próximas viagens).
    /// Vem do estado real, sem campo próprio: pedir o que falta não pede duas vezes, nem depois de reiniciar o servidor.
    /// </summary>
    public static Recursos Faltando(Mundo m, ItemFila item)
    {
        var f = new Recursos();
        foreach (var (k, v) in item.Custo)
            if (v - item.Entregue.Qtd(k) > 1e-6) f[k] = v - item.Entregue.Qtd(k);
        if (f.Count == 0) return f;
        foreach (var c in m.Marchas.OfType<Carregadores>().Where(c => c.ItemId == item.Id))
        {
            foreach (var (k, v) in c.Carga) f.Retirar(k, v);
            foreach (var (k, v) in c.Pendente) f.Retirar(k, v);
        }
        foreach (var k in f.Keys.ToList()) if (f[k] <= 1e-6) f.Remove(k);
        return f;
    }

    /// <summary>O que já está no local da obra, se ele ainda é do reino; depois, um grupo de carregadores por origem, dos mais próximos.</summary>
    private static void Buscar(Mundo m, Reino r, ItemFila item, string nomeFila, Dictionary<string, double> faltam)
    {
        var destinoLocal = item.LocalId is long lid ? m.Locais.Obter(lid) : null;
        if (destinoLocal != null && destinoLocal.ReinoId == r.Id && !destinoLocal.Ruina) TirarDoLocal(m, destinoLocal, item, faltam);
        if (faltam.Count > 0) EnviarDosProximos(m, r, item, nomeFila, faltam, destinoLocal);
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
        // só entra na conta quem tem o que falta: com uma origem só não há o que ordenar, e a busca para na mais distante delas
        var origens = m.LocaisDe(r.Id).Where(l => l.Id != destinoLocal?.Id && !l.Ruina && faltam.Keys.Any(k => l.Estoque.Qtd(k) > 0)).ToList();
        if (origens.Count > 1)
        {
            var tempos = Caminhos.MinutosAte(m, item.Hex, m.P.Carregador.Vel, origens.Select(l => l.Hex));
            origens = origens.OrderBy(l => tempos[l.Hex]).ToList();
        }
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

    /// <summary>
    /// Despacha carregadores com uma carga: pessoas do local de origem (sem trabalho primeiro), <c>P.carregador.carga</c> por
    /// pessoa, a pé e sem escolta. Com menos gente que o necessário, o grupo faz mais viagens; sem ninguém livre, a carga vai
    /// com carregadores anônimos.
    /// </summary>
    public static Carregadores Enviar(Mundo m, Reino r, int de, int para, Recursos carga, long? itemId, string fila, long? destinoLocalId)
    {
        var vel = m.P.Carregador.Vel;
        var rota = Caminhos.Calcular(m, de, para, vel);
        var precisa = (int)Math.Max(1, Math.Ceiling(carga.Total / m.P.Carregador.Carga - 1e-9));
        var origem = m.LocalNoHex(de);
        var mc = new Carregadores
        {
            ReinoId = r.Id, Vel = vel, ItemId = itemId, Fila = fila, DestinoLocalId = destinoLocalId,
            OrigemLocalId = origem?.Id, OrigemHex = de, ParaHex = para,
        };
        m.Marchas.Adicionar(mc);
        var pessoas = origem != null && origem.ReinoId == r.Id ? Pessoas.Pessoas.Tomar(m, r, origem, precisa, mc.Id) : new();
        mc.PessoaIds = pessoas.Select(p => p.Id).ToList();
        mc.Pessoas = pessoas.Count > 0 ? pessoas.Count : precisa;
        var cap = mc.CargaMax(m);
        if (pessoas.Count > 0 && carga.Total > cap + 1e-9)
        {
            mc.Carga = Carregadores.Dividir(carga, cap);
            var resto = carga.Copia();
            foreach (var (k, v) in mc.Carga) resto.Retirar(k, v);
            mc.Pendente = resto;
        }
        else mc.Carga = carga;
        mc.Partir(m, rota);
        return mc;
    }

    public static string NomeRecurso(string k) => k switch
    {
        "aco" => "aço", "minerio" => "minério raro", "cavalo" => "cavalos de raça", "gema" => "pedras preciosas",
        "ervas" => "ervas raras", _ => k,
    };
}
