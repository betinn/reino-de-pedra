using System.Text.Json;
using System.Text.Json.Serialization;

namespace ReinoDePedra.Jogo.Config;

/// <summary>
/// Números do jogo. Espelho fiel de <c>balanceamento/config.json</c>, gerado por
/// <c>node balanceamento/modelo.js --json</c>. Nunca escreva um número de jogo no código:
/// acrescente o parâmetro em <c>modelo.js</c>, rode o modelo e leia daqui.
/// </summary>
public sealed class Balanceamento
{
    public required ParametrosP P { get; init; }
    public required Dictionary<string, Unidade> U { get; init; }
    public required Dictionary<string, Veiculo> VEICULOS { get; init; }
    public JsonElement Referencia { get; init; }

    public static readonly JsonSerializerOptions OpcoesJson = new()
    {
        PropertyNameCaseInsensitive = true,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    public static Balanceamento Carregar(string caminho)
    {
        using var f = File.OpenRead(caminho);
        var b = JsonSerializer.Deserialize<Balanceamento>(f, OpcoesJson)
                ?? throw new InvalidDataException("config de balanceamento vazia");
        foreach (var (id, u) in b.U) u.Id = id;
        return b;
    }

    /// <summary>Procura o arquivo subindo a partir do diretório atual e do diretório do executável.</summary>
    public static string Localizar()
    {
        var env = Environment.GetEnvironmentVariable("REINO_BALANCEAMENTO");
        if (!string.IsNullOrEmpty(env)) return env;
        foreach (var inicio in new[] { AppContext.BaseDirectory, Directory.GetCurrentDirectory() })
        {
            var d = new DirectoryInfo(inicio);
            while (d != null)
            {
                var c1 = Path.Combine(d.FullName, "balanceamento", "config.json");
                if (File.Exists(c1)) return c1;
                d = d.Parent;
            }
        }
        throw new FileNotFoundException("balanceamento/config.json não encontrado (defina REINO_BALANCEAMENTO)");
    }

    private static Balanceamento? _padrao;
    /// <summary>Instância carregada do arquivo localizado (cache por processo).</summary>
    public static Balanceamento Padrao => _padrao ??= Carregar(Localizar());
}

public sealed class ParametrosP
{
    public int TemporadaDias { get; init; }
    public double ProdBase { get; init; }
    public double ProdCresc { get; init; }
    public int NivelMax { get; init; }
    public double CasteloBase { get; init; }
    public double CasteloCresc { get; init; }
    public double CasteloCusto { get; init; }
    public double CasteloTempo { get; init; }
    public double CustoN2 { get; init; }
    public double CustoCresc { get; init; }
    public double TempoN2 { get; init; }
    public double TempoCresc { get; init; }
    public Dictionary<string, double> Receita { get; init; } = new();
    public int TetoCastelo { get; init; }
    public int TetoPorMoradia { get; init; }
    public int PopInicial { get; init; }
    public double CustoMoradia { get; init; }
    public double MoradiaPasso { get; init; }
    public double CrescPop { get; init; }
    public double BonusComida { get; init; }
    public int TrabPorNivel { get; init; }
    public Dictionary<string, double> Kit { get; init; } = new();
    public Dictionary<string, double> KitExtra { get; init; } = new();
    public double EstoqueHoras { get; init; }
    public double EstoqueMinimo { get; init; }
    public ArmazemP Armazem { get; init; } = new();
    public CarregadorP Carregador { get; init; } = new();
    public RioP Rio { get; init; } = new();
    public VisaoP Visao { get; init; } = new();
    public double AvistamentoH { get; init; }
    public double CustoNovoLocal { get; init; }
    public double NovoLocalCresc { get; init; }
    public double TempoNovoLocal { get; init; }
    public Dictionary<string, double> MinPor { get; init; } = new();
    public Dictionary<string, double> Terreno { get; init; } = new();
    public double TerrenoMedio { get; init; }
    public double RotaFator { get; init; }
    public int Reinos { get; init; }
    public MapaP Mapa { get; init; } = new();
    public double ExpPerdas { get; init; }
    public double Vantagem { get; init; }
    public double MiliciaPorPop { get; init; }
    public double DefMilicia { get; init; }
    public double[] Portoes { get; init; } = [];
    public TorreP Torre { get; init; } = new();
    public double PortoesEstrutura { get; init; }
    public double SaqueQueda { get; init; }
    public double SaqueMinimo { get; init; }
    public ReliquiaP Reliquia { get; init; } = new();
    public double EscudoNovatoH { get; init; }
    public double EscudoExilioH { get; init; }
    public double RegenciaH { get; init; }
    public LegadoP Legado { get; init; } = new();
    public Dictionary<string, double> Fauna { get; init; } = new();
    public Dictionary<string, double> AtaqueFauna { get; init; } = new();
    public PerdaFaunaP PerdaFauna { get; init; } = new();
    public double FaunaVoltaH { get; init; }
    public Dictionary<string, CacaP> Caca { get; init; } = new();
    public int CacasDia { get; init; }
    public Dictionary<string, ExploradorP> Exploradores { get; init; } = new();
    public ObraP Rota { get; init; } = new();
    public ObraP Ponte { get; init; } = new();
    public EspiaoP Espiao { get; init; } = new();
    public int Alianca { get; init; }
    public Dictionary<string, double> Valor { get; init; } = new();
    public JazidaP Jazida { get; init; } = new();
    public ExtracaoP Extracao { get; init; } = new();
    public ComercioP Comercio { get; init; } = new();
    public PactoP Pacto { get; init; } = new();
    public double ResgateH { get; init; }
    public double TreguaSaidaH { get; init; }
    public Dictionary<string, EraP> Eras { get; init; } = new();
    public FerrariaP Ferraria { get; init; } = new();
    public VeteraniaP Veterania { get; init; } = new();
    public LendarioP Lendario { get; init; } = new();
    public FeridosP Feridos { get; init; } = new();
    public double TetoBonus { get; init; }
    public QuedaP Queda { get; init; } = new();
    public MensageiroP Mensageiro { get; init; } = new();
    public SalgadeiraP Salgadeira { get; init; } = new();
}

public sealed class ArmazemP { public double CapN1 { get; init; } public double CapCresc { get; init; } }
public sealed class CarregadorP { public double Carga { get; init; } public string Vel { get; init; } = "Lenta"; }
public sealed class RioP { public double Vau { get; init; } }
public sealed class VisaoP { public int Castelo { get; init; } public int Local { get; init; } public int Tropa { get; init; } }
public sealed class MapaP { public int Cols { get; init; } public int Lins { get; init; } }
public sealed class TorreP
{
    public double CustoN1 { get; init; }
    public double CustoCresc { get; init; }
    public double TempoN1 { get; init; }
    public int ArqPorNivel { get; init; }
    public double BonusAlto { get; init; }
    public int NivelMax { get; init; }
    public double Estrutura { get; init; }
    public int AlcanceBase { get; init; }
}
public sealed class ReliquiaP
{
    public double Ataque { get; init; }
    public double Producao { get; init; }
    public double Resistencia { get; init; }
    public double EscavarHoras1 { get; init; }
    public double EscavarMin { get; init; }
}
public sealed class LegadoP { public double RelMin { get; init; } public double RelMax { get; init; } public int Equipadas { get; init; } public double Teto { get; init; } }
public sealed class PerdaFaunaP { public double Acima { get; init; } public double Abaixo { get; init; } }
public sealed class CacaP { public double Comida { get; init; } public double Couro { get; init; } public double Peles { get; init; } public string Nivel { get; init; } = ""; }
public sealed class ExploradorP
{
    public string Nome { get; init; } = "";
    public Dictionary<string, double> Custo { get; init; } = new();
    public double Tempo { get; init; }
    public string Vel { get; init; } = "";
    public int Visao { get; init; }
    public int Jazidas { get; init; }
    public double Forca { get; init; }
}
public sealed class ObraP { public Dictionary<string, double> Custo { get; init; } = new(); public double Tempo { get; init; } }
public sealed class EspiaoP
{
    public double Base { get; init; }
    public double PorTorre { get; init; }
    public double PorTropa { get; init; }
    public double Max { get; init; }
    public double Capturado { get; init; }
    public double TempoNoLocal { get; init; }
}
public sealed class JazidaP { public double Valor { get; init; } public int PorReinos { get; init; } public double ValorLendaria { get; init; } public int LendariasPorReinos { get; init; } }
public sealed class ExtracaoP { public double Taxa { get; init; } public double ExpTropas { get; init; } public double Posto { get; init; } public double Rota { get; init; } public int MaxTropas { get; init; } }
public sealed class ComercioP { public double MargemIA { get; init; } public double NovatoDia { get; init; } }
public sealed class PactoP { public int DiasMin { get; init; } public int DiasMax { get; init; } public int AtivosMax { get; init; } }
public sealed class EraP
{
    public string Nome { get; init; } = "";
    public string Req { get; init; } = "";
    public Dictionary<string, double> Custo { get; init; } = new();
    public double Tempo { get; init; }
    public string Libera { get; init; } = "";
}
public sealed class FerrariaP
{
    public double BonusNivel { get; init; }
    public int Familias { get; init; }
    public int Linhas { get; init; }
    public NivelFerrariaP[] Niveis { get; init; } = [];
}
public sealed class NivelFerrariaP { public Dictionary<string, double> Custo { get; init; } = new(); public double Tempo { get; init; } public string Req { get; init; } = ""; }
public sealed class VeteraniaP { public int[] Marcas { get; init; } = []; public double[] Bonus { get; init; } = []; public double PerdasMax { get; init; } public double ForcaMin { get; init; } }
public sealed class LendarioP { public double Bonus { get; init; } public int Tropas { get; init; } public Dictionary<string, double> Custo { get; init; } = new(); public double Tempo { get; init; } public string Req { get; init; } = ""; }
public sealed class FeridosP { public double Frac { get; init; } public double Ervas { get; init; } public double EsperaH { get; init; } public double CuraH { get; init; } }
public sealed class QuedaP { public double Nivel { get; init; } public double Recursos { get; init; } public double Populacao { get; init; } }
public sealed class MensageiroP
{
    public Dictionary<string, double> Custo { get; init; } = new();
    public int Pop { get; init; }
    public double Tempo { get; init; }
    public string Vel { get; init; } = "";
    public int Caracteres { get; init; }
    public int RecadoProposta { get; init; }
}
public sealed class SalgadeiraP { public Dictionary<string, double> Custo { get; init; } = new(); public double Tempo { get; init; } public double Horas { get; init; } }

public sealed class Unidade
{
    [JsonIgnore] public string Id { get; set; } = "";
    public string Nome { get; init; } = "";
    public string Fam { get; init; } = "";
    public double Atk { get; init; }
    public double Def { get; init; }
    public string Vel { get; init; } = "";
    public double Carga { get; init; }
    public Dictionary<string, double> Custo { get; init; } = new();
    public double Tempo { get; init; }
    public int Pop { get; init; }
    public string? Vence { get; init; }
    public string? So { get; init; }
    public double Cerco { get; init; }
    public string? Req { get; init; }
}

public sealed class Veiculo { public double Carga { get; init; } public string Vel { get; init; } = ""; public Dictionary<string, double> Custo { get; init; } = new(); }
