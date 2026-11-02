using ReinoDePedra.Jogo.Nucleo;

namespace ReinoDePedra.Jogo.Reinos;

/// <summary>
/// Reino (jogador ou IA: os dois são idênticos para as regras). É <c>partial</c>: cada sistema
/// acrescenta seus campos em arquivo próprio (ex.: <c>Reino.Alianca.cs</c>) e eles são persistidos sozinhos.
/// </summary>
public sealed partial class Reino : Documento
{
    /// <summary>Conta dona; null = reino controlado por IA.</summary>
    public long? ContaId { get; set; }
    public string Nome { get; set; } = "";
    public Brasao Brasao { get; set; } = new();
    /// <summary>Se o jogador enviou uma imagem própria (servida em /api/v1/reinos/{id}/icone).</summary>
    public bool IconeProprio { get; set; }
    public int IconeVersao { get; set; }
    public long CriadoEm { get; set; }
    public long EscudoAte { get; set; }
    public long UltimoAcesso { get; set; }
    public int Vaga { get; set; } = -1;
    public long CasteloId { get; set; }
    public bool Ativo { get; set; } = true;

    /// <summary>Instante até o qual produção e população já foram calculadas.</summary>
    public long AtualizadoEm { get; set; }
    /// <summary>População civil (não inclui tropas).</summary>
    public double Pop { get; set; }
    /// <summary>Locais fundados pelo jogador (o custo do próximo cresce com isso).</summary>
    public int Fundados { get; set; }

    /// <summary>Filas do reino por nome ("obras", "recrutamento", "ferraria"...). Até 10 itens, um por vez.</summary>
    public Dictionary<string, Fila> Filas { get; set; } = new();
    public Fila Fila(string nome) => Filas.TryGetValue(nome, out var f) ? f : Filas[nome] = new Fila();

    public bool EhIA => ContaId == null;
    public bool SobEscudo(long agora) => agora < EscudoAte;
}

/// <summary>Brasão procedural (o mesmo gerador do protótipo: <c>web/js/brasao.js</c>).</summary>
public sealed class Brasao
{
    public string Forma { get; set; } = "portugues";
    public string Divisao { get; set; } = "cortado";
    public string Cor1 { get; set; } = "azul";
    public string Cor2 { get; set; } = "vermelho";
    public string Simbolo { get; set; } = "torre";
    public string CorSimbolo { get; set; } = "ouro";
    /// <summary>Moldura de linhagem (brasão da casa, linhagem nível P.temporadaServ.desbloqueios.moldura).</summary>
    public bool Moldura { get; set; }

    public static readonly string[] Formas = ["portugues", "classico", "redondo"];
    public static readonly string[] Divisoes = ["pleno", "partido", "cortado", "esquartelado", "banda", "chaveirao"];
    public static readonly string[] Tinturas = ["ouro", "prata", "vermelho", "azul", "verde", "purpura", "negro", "castanho"];
    public static readonly string[] Simbolos = ["torre", "espada", "estrela", "coroa", "chave", "martelo", "lua", "montes"];
    /// <summary>Formas e cores extras, liberadas pela linhagem (nível P.temporadaServ.desbloqueios.brasoes).</summary>
    public static readonly string[] FormasExtras = ["frances", "losango"];
    public static readonly string[] TinturasExtras = ["celeste", "laranja", "carmesim"];
    private static readonly HashSet<string> Metais = ["ouro", "prata"];

    /// <summary>Brasão válido. <paramref name="extras"/>: formas e cores da linhagem; <paramref name="moldura"/>: moldura de linhagem.</summary>
    public bool Valido(bool extras = false, bool moldura = false)
    {
        bool F(string f) => Formas.Contains(f) || extras && FormasExtras.Contains(f);
        bool C(string c) => Tinturas.Contains(c) || extras && TinturasExtras.Contains(c);
        return F(Forma) && Divisoes.Contains(Divisao) && C(Cor1) && C(Cor2) && Simbolos.Contains(Simbolo) && C(CorSimbolo)
               && Cor1 != Cor2 && (moldura || !Moldura);
    }

    /// <summary>Sorteia um brasão legível (símbolo em metal sobre cores, ou em cor sobre metal).</summary>
    public static Brasao Aleatorio(Rng r, bool extras = false)
    {
        var cores = Tinturas.Where(t => !Metais.Contains(t)).Concat(extras ? TinturasExtras : []).ToArray();
        var metais = Metais.ToArray();
        var b = new Brasao
        {
            Forma = r.Escolher(extras ? Formas.Concat(FormasExtras).ToArray() : Formas), Divisao = r.Escolher(Divisoes), Simbolo = r.Escolher(Simbolos),
        };
        if (r.Chance(0.7))
        {
            b.Cor1 = r.Escolher(cores);
            do b.Cor2 = r.Chance(0.5) ? r.Escolher(cores) : r.Escolher(metais); while (b.Cor2 == b.Cor1);
            b.CorSimbolo = r.Escolher(metais);
        }
        else
        {
            b.Cor1 = r.Escolher(metais);
            do b.Cor2 = r.Escolher(cores); while (b.Cor2 == b.Cor1);
            b.CorSimbolo = r.Escolher(cores.Where(c => c != b.Cor2).ToArray());
        }
        return b;
    }
}
