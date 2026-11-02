using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;
using VC = ReinoDePedra.Jogo.Valiosos.Veiculos;

namespace ReinoDePedra.Jogo.Valiosos;

/// <summary>Recursos valiosos e lendários (ficam no armazém ou no castelo).</summary>
public static class Valiosos
{
    public static readonly string[] Ids = ["aco", "cavalo", "ouro", "prata", "sal", "ervas", "gema", "minerio"];
    public static bool Eh(string recurso) => Array.IndexOf(Ids, recurso) >= 0;
    /// <summary>Locais que guardam valiosos: armazéns e o castelo.</summary>
    public static bool Deposito(Local l) => !l.Ruina && l.Tipo is TipoLocal.Armazem or TipoLocal.Castelo;
}

/// <summary>
/// Caravana manual: carroças saem do castelo (e/ou tropas de um local, a "base"), buscam a carga na origem e a levam ao
/// destino; depois voltam vazias à base. A carga só é reservada (retirada da origem) quando a caravana chega lá.
/// Visível no mapa e interceptável: quem a vence leva a carga (até a capacidade livre) e as carroças se perdem.
/// </summary>
public sealed class Caravana : Marcha
{
    public const string Buscar = "buscar", Levar = "levar", Voltar = "voltar";
    public override string Tipo => "caravana";
    public Dictionary<string, int> Veiculos { get; set; } = new();
    /// <summary>De onde saíram carroças e escolta, e para onde voltam (o castelo, quando há carroças).</summary>
    public long BaseLocalId { get; set; }
    public long OrigemLocalId { get; set; }
    public long DestinoLocalId { get; set; }
    /// <summary>O que o jogador pediu para levar (a carga real sai da origem na chegada, até a capacidade).</summary>
    public Recursos Pedido { get; set; } = new();
    public string Fase { get; set; } = Buscar;
    public bool Seguro { get; set; }

    public double CargaMax(Mundo m) => Caravanas.Capacidade(m, Veiculos, Tropas);

    public override void Chegou(Mundo m)
    {
        m.Sujar(this);
        var r = m.Reinos.Obter(ReinoId);
        if (r == null || !r.Ativo) { Encerrar(m); return; }
        switch (Fase)
        {
            case Buscar: Carregar(m, r); break;
            case Levar: Entregar(m, r); break;
            default: Finalizar(m, r); break;
        }
    }

    /// <summary>Na origem: retira a carga pedida (até a capacidade) e segue ao destino.</summary>
    internal void Carregar(Mundo m, Reino r)
    {
        var o = m.Locais.Obter(OrigemLocalId);
        if (Exercitos.LocalProprio(o, ReinoId))
        {
            Economia.Atualizar(m, r);
            var livre = CargaMax(m) - Carga.Total;
            foreach (var (k, v) in Pedido.ToList())
            {
                if (livre <= 1e-9) break;
                var tirado = o!.Estoque.Retirar(k, Math.Min(v, livre));
                if (tirado <= 0) continue;
                Carga.Somar(k, tirado); livre -= tirado;
            }
            m.Sujar(o!);
            m.Avisar(ReinoId, "reino");
        }
        if (Carga.Total <= 1e-9)
        {
            Registros.Notificar(m, ReinoId, "recursos", "Caravana sem carga",
                (o != null && o.ReinoId == ReinoId ? "Não havia o pedido em " + o.Nome : "A origem não é mais sua") + ". Ela volta vazia.", "reino");
            IrPara(m, Voltar, BaseLocalId);
            return;
        }
        var d = m.Locais.Obter(DestinoLocalId);
        if (!Exercitos.LocalProprio(d, ReinoId)) { DestinoPerdido(m); return; }
        Fase = Levar;
        Partir(m, Caravanas.Rota(m, this, HexEm(m.Agora), d!.Hex));
    }

    /// <summary>No destino: a carga entra no estoque; carroças e escolta voltam à base.</summary>
    private void Entregar(Mundo m, Reino r)
    {
        var d = m.Locais.Obter(DestinoLocalId);
        if (!Exercitos.LocalProprio(d, ReinoId) || d!.Hex != Destino) { DestinoPerdido(m); return; }
        Economia.Atualizar(m, r);
        var entregue = Carga.Arredondado();
        d.Estoque.Somar(Carga);
        Carga = new();
        m.Sujar(d);
        Registros.Notificar(m, ReinoId, "recursos", "Caravana chegou", d.Nome + " recebeu " + Caravanas.Texto(entregue) + ".", "reino");
        m.Avisar(ReinoId, "reino");
        if (BaseLocalId == d.Id) { Finalizar(m, r); return; }
        IrPara(m, Voltar, BaseLocalId);
    }

    /// <summary>Destino perdido no caminho: a caravana volta à base com a carga e descarrega lá.</summary>
    private void DestinoPerdido(Mundo m)
    {
        Registros.Notificar(m, ReinoId, "recursos", "Destino da caravana perdido", "Ela volta com a carga.", "reino");
        IrPara(m, Voltar, BaseLocalId);
    }

    /// <summary>Vai a um local próprio (ou, se ele não for mais seu, ao local próprio mais próximo). Sem nenhum, sai do mapa.</summary>
    private void IrPara(Mundo m, string fase, long localId)
    {
        Fase = fase;
        var de = HexEm(m.Agora);
        var alvo = m.Locais.Obter(localId);
        Rota? rota = null;
        if (Exercitos.LocalProprio(alvo, ReinoId)) rota = alvo!.Hex == de ? null : Caminhos.Calcular(m, de, alvo.Hex, Vel, Caravanas.Opcoes(m, this));
        else
        {
            alvo = null;
            foreach (var l in m.LocaisDe(ReinoId).Where(l => !l.Ruina))
            {
                if (l.Hex == de) { alvo = l; rota = null; break; }
                var rr = Caminhos.Calcular(m, de, l.Hex, Vel, Caravanas.Opcoes(m, this));
                if (rr.Hexes[^1] != l.Hex) continue;
                if (alvo == null || rota == null || rr.TotalMin < rota.TotalMin) { alvo = l; rota = rr; }
            }
        }
        if (alvo == null) { Encerrar(m); return; }
        BaseLocalId = alvo.Id;
        if (rota == null || rota.Hexes[^1] != alvo.Hex) { var r = m.Reinos.Obter(ReinoId); if (r != null) Finalizar(m, r); else Encerrar(m); return; }
        Retornando = true;
        Partir(m, rota);
    }

    /// <summary>De volta à base: carroças voltam ao castelo, escolta entra na guarnição, o que sobrou de carga fica lá.</summary>
    private void Finalizar(Mundo m, Reino r)
    {
        var b = m.Locais.Obter(BaseLocalId);
        if (!Exercitos.LocalProprio(b, ReinoId)) { IrPara(m, Voltar, BaseLocalId); return; }
        Economia.Atualizar(m, r);
        foreach (var (k, n) in Veiculos) r.Veiculos[k] = r.Veiculos.GetValueOrDefault(k) + n;
        m.Sujar(r);
        GT.Devolver(m, b!, Tropas);
        if (Carga.Count > 0)
        {
            var sobra = Carga.Arredondado();
            b!.Estoque.Somar(Carga);
            if (sobra.Count > 0) Registros.Notificar(m, ReinoId, "recursos", "Caravana de volta", b.Nome + " recebeu " + Caravanas.Texto(sobra) + ".", "reino");
        }
        Veiculos = new(); Tropas = new(); Carga = new();
        Encerrar(m);
        m.Avisar(ReinoId, "reino");
    }

    /// <summary>Roubada no caminho: carga ao vencedor (pelo contrato), carroças perdidas, aviso ao dono.</summary>
    public override void AoSerVencida(Mundo m, Exercito vencedor)
    {
        var levada = Carga.Arredondado();
        var veic = VC.Partes(Veiculos);
        Veiculos = new();
        base.AoSerVencida(m, vencedor);
        Registros.Notificar(m, ReinoId, "recursos", "Caravana roubada",
            (levada.Count > 0 ? "Levaram " + Caravanas.Texto(levada) + ". " : "") + (veic.Length > 0 ? "Perdemos " + veic + "." : ""), "reino");
    }
}

/// <summary>Pedido de caravana: de onde busca, para onde leva, o quê, com quais veículos e escolta.</summary>
public sealed record PedidoCaravana(long OrigemLocalId, long DestinoLocalId, IReadOnlyDictionary<string, double>? Carga,
    IReadOnlyDictionary<string, int>? Veiculos, IReadOnlyDictionary<string, int>? Tropas, long? BaseLocalId = null, bool Seguro = false);

/// <summary>Plano de uma caravana, para a prévia e o envio. <see cref="Problema"/> diz por que não pode sair.</summary>
public sealed class PlanoCaravana
{
    public Local? Base { get; init; }
    public Local? Origem { get; init; }
    public Local? Destino { get; init; }
    public Recursos Carga { get; init; } = new();
    public Dictionary<string, int> Veiculos { get; init; } = new();
    public Dictionary<string, int> Tropas { get; init; } = new();
    public double Capacidade { get; init; }
    public double CapVeiculos { get; init; }
    public double CapTropas { get; init; }
    public string Vel { get; init; } = "";
    public double Forca { get; init; }
    public bool PoucoProtegida { get; init; }
    public Rota? Buscar { get; init; }
    public Rota? Levar { get; init; }
    public string? Problema { get; set; }
}

public static class Caravanas
{
    /// <summary>Capacidade: soma da carga dos veículos e das tropas.</summary>
    public static double Capacidade(Mundo m, IReadOnlyDictionary<string, int> veic, IReadOnlyDictionary<string, int> tropas) =>
        CapVeiculos(m, veic) + GT.Carga(m, tropas);
    public static double CapVeiculos(Mundo m, IReadOnlyDictionary<string, int> veic) =>
        veic.Sum(kv => kv.Value > 0 && m.B.VEICULOS.TryGetValue(kv.Key, out var v) ? kv.Value * v.Carga : 0);

    /// <summary>Velocidade: a do mais lento entre veículos e tropas.</summary>
    public static string Velocidade(Mundo m, IReadOnlyDictionary<string, int> veic, IReadOnlyDictionary<string, int> tropas)
    {
        string? vel = GT.Total(tropas) > 0 ? GT.Velocidade(m, tropas) : null;
        foreach (var (k, n) in veic)
        {
            if (n <= 0 || !m.B.VEICULOS.TryGetValue(k, out var v)) continue;
            if (vel == null || m.P.MinPor[v.Vel] > m.P.MinPor[vel]) vel = v.Vel;
        }
        return vel ?? m.P.MinPor.MaxBy(kv => kv.Value).Key;
    }

    /// <summary>Escolta abaixo da força mínima (o jogador é avisado, não impedido).</summary>
    public static bool PoucoProtegida(Mundo m, IReadOnlyDictionary<string, int> tropas) => GT.ForcaFauna(m, tropas) < m.P.Caravana.EscoltaMin;

    internal static OpcoesCaminho Opcoes(Mundo m, Caravana c) => new() { Seguro = c.Seguro, Forca = GT.ForcaFauna(m, c.Tropas), ReinoId = c.ReinoId };
    internal static Rota Rota(Mundo m, Caravana c, int de, int para)
    {
        var rota = Caminhos.Calcular(m, de, para, c.Vel, Opcoes(m, c));
        if (rota.Hexes[^1] != para) throw new RegraException("Não há caminho até o destino.");
        return rota;
    }

    public static string Texto(IReadOnlyDictionary<string, long> c) =>
        string.Join(", ", c.Select(kv => kv.Value + " de " + Logistica.NomeRecurso(kv.Key)));

    /// <summary>Monta o plano sem mexer em nada. Problemas de regra ficam em <see cref="PlanoCaravana.Problema"/>.</summary>
    public static PlanoCaravana Planejar(Mundo m, Reino r, PedidoCaravana p)
    {
        Economia.Atualizar(m, r);
        var o = m.Locais.Obter(p.OrigemLocalId);
        var d = m.Locais.Obter(p.DestinoLocalId);
        var carga = new Recursos();
        foreach (var (k, v) in p.Carga ?? new Dictionary<string, double>())
            if (v > 0 && m.P.Valor.ContainsKey(k)) carga.Somar(k, Math.Floor(v));
        var veic = (p.Veiculos ?? new Dictionary<string, int>()).Where(kv => kv.Value > 0).ToDictionary(kv => kv.Key, kv => kv.Value);
        var tropas = GT.Limpo(p.Tropas);
        var castelo = m.Locais.Obter(r.CasteloId);
        var baseL = veic.Count > 0 ? castelo : p.BaseLocalId is long bid ? m.Locais.Obter(bid) : castelo;
        string? problema = null;
        void Falha(string s) { problema ??= s; }

        if (!Exercitos.LocalProprio(o, r.Id)) Falha("Escolha de onde a carga sai.");
        if (!Exercitos.LocalProprio(d, r.Id)) Falha("Escolha para onde a carga vai.");
        if (o != null && d != null && o.Id == d.Id) Falha("Origem e destino são o mesmo local.");
        if (carga.Count == 0) Falha("Escolha a carga.");
        if (d != null && carga.Keys.Any(Valiosos.Eh) && !Valiosos.Deposito(d)) Falha("Valiosos ficam no armazém ou no castelo.");
        if (o != null && Exercitos.LocalProprio(o, r.Id))
            foreach (var (k, v) in carga)
                if (o.Estoque.Qtd(k) + 1e-6 < v) Falha($"{o.Nome} só tem {Math.Floor(o.Estoque.Qtd(k))} de {Logistica.NomeRecurso(k)}.");
        foreach (var (k, n) in veic)
        {
            if (!m.B.VEICULOS.ContainsKey(k)) { Falha("Veículo desconhecido."); continue; }
            if (VC.Livres(r, k) < n) Falha($"Só há {VC.Livres(r, k)} {VC.Nome(k, 2)} livres no castelo.");
        }
        if (veic.Count == 0 && tropas.Count == 0) Falha("Escolha carroças ou tropas para levar.");
        if (!Exercitos.LocalProprio(baseL, r.Id)) Falha(veic.Count > 0 ? "As carroças ficam no castelo." : "Escolha de onde saem as tropas.");
        else if (tropas.Count > 0)
            try { GT.Validar(m, baseL!, tropas); } catch (RegraException e) { Falha(e.Message); }
        var cap = Capacidade(m, veic, tropas);
        if (carga.Total > cap + 1e-6) Falha($"A carga não cabe: leva até {Math.Floor(cap)}.");
        var vel = Velocidade(m, veic, tropas);
        var op = new OpcoesCaminho { Seguro = p.Seguro, Forca = GT.ForcaFauna(m, tropas), ReinoId = r.Id };
        Rota? buscar = null, levar = null;
        // só caminhos entre locais do próprio reino: a prévia não pode dar o hexágono de um local alheio
        var proprios = Exercitos.LocalProprio(o, r.Id) && Exercitos.LocalProprio(d, r.Id) && Exercitos.LocalProprio(baseL, r.Id);
        if (!proprios) { o = Exercitos.LocalProprio(o, r.Id) ? o : null; d = Exercitos.LocalProprio(d, r.Id) ? d : null; baseL = Exercitos.LocalProprio(baseL, r.Id) ? baseL : null; }
        if (proprios && baseL != null && o != null && baseL.Hex != o.Hex)
        {
            buscar = Caminhos.Calcular(m, baseL.Hex, o.Hex, vel, op);
            if (buscar.Hexes[^1] != o.Hex) { Falha("Não há caminho até a origem."); buscar = null; }
        }
        if (proprios && o != null && d != null && o.Hex != d.Hex)
        {
            levar = Caminhos.Calcular(m, o.Hex, d.Hex, vel, op);
            if (levar.Hexes[^1] != d.Hex) { Falha("Não há caminho até o destino."); levar = null; }
        }
        return new PlanoCaravana
        {
            Base = baseL, Origem = o, Destino = d, Carga = carga, Veiculos = veic, Tropas = tropas,
            Capacidade = cap, CapVeiculos = CapVeiculos(m, veic), CapTropas = GT.Carga(m, tropas), Vel = vel,
            Forca = GT.ForcaFauna(m, tropas), PoucoProtegida = PoucoProtegida(m, tropas),
            Buscar = buscar, Levar = levar, Problema = problema,
        };
    }

    /// <summary>Despacha a caravana. Lança <see cref="RegraException"/> se o plano tiver problema.</summary>
    public static Caravana Enviar(Mundo m, Reino r, PedidoCaravana p)
    {
        var pl = Planejar(m, r, p);
        if (pl.Problema != null) throw new RegraException(pl.Problema);
        foreach (var (k, n) in pl.Veiculos)
        {
            var resto = r.Veiculos.GetValueOrDefault(k) - n;
            if (resto > 0) r.Veiculos[k] = resto; else r.Veiculos.Remove(k);
        }
        m.Sujar(r);
        if (pl.Tropas.Count > 0) GT.Retirar(m, pl.Base!, pl.Tropas);
        var c = new Caravana
        {
            ReinoId = r.Id, Veiculos = pl.Veiculos, Tropas = pl.Tropas, Vel = pl.Vel, Seguro = p.Seguro,
            BaseLocalId = pl.Base!.Id, OrigemLocalId = pl.Origem!.Id, DestinoLocalId = pl.Destino!.Id, Pedido = pl.Carga.Copia(),
        };
        if (pl.Buscar != null) c.Partir(m, pl.Buscar);
        else
        {
            // carroças e escolta já estão na origem: carregam e partem para o destino
            c.Caminho = [pl.Origem.Hex]; c.Tempos = [m.Agora]; c.Origem = c.Destino = pl.Origem.Hex;
            m.Marchas.Adicionar(c);
            c.Carregar(m, r);
        }
        m.Avisar(r.Id, "reino");
        return c;
    }
}
