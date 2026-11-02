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
    /// <summary>Unidades que o castelo recruta (o quartel recruta todas).</summary>
    public string[] RecrutaCastelo { get; init; } = [];

    // ---------- combate (servidor) ----------
    public CombateP Combate { get; init; } = new();
    // ---------- exploração, fauna, caça, rotas e espionagem (servidor)
    public ExploracaoServP ExploracaoServ { get; init; } = new();
    public FaunaServP FaunaServ { get; init; } = new();
    /// <summary>Minutos no local da caçada.</summary>
    public double CacaMin { get; init; }

    // ---------- guerra: exílio, interceptação, posturas e modelos de ataque (servidor) ----------
    public GuerraP Guerra { get; init; } = new();
    // ---------- relíquias, extração e caravanas (servidor) ----------
    /// <summary>Tempo de construção (s) de cada veículo, por tipo de <c>VEICULOS</c>.</summary>
    public VeiculoP Veiculo { get; init; } = new();
    /// <summary>Caravana e escolta de relíquia: força mínima da escolta para não ser "pouco protegida".</summary>
    public CaravanaP Caravana { get; init; } = new();
    /// <summary>Posto de extração ou de escavação (obra opcional no hexágono da jazida ou ruína).</summary>
    public ObraP Posto { get; init; } = new();
    /// <summary>Fração mínima do caminho até o depósito em rota pública para valer o bônus de rota da extração.</summary>
    public double ExtracaoRotaFrac { get; init; }
    /// <summary>Distância (hexágonos) do castelo a partir da qual um local fundado revela o transporte manual.</summary>
    public int LogisticaLongeHex { get; init; }
    /// <summary>Relíquias no mesmo local a partir das quais o local brilha (quem explorou a área vê) ou vira farol (todos veem).</summary>
    public ReliquiaVisP ReliquiaVis { get; init; } = new();
    // ---------- ferraria, eras e equipamento lendário (servidor) ----------
    public FerrariaServP FerrariaServ { get; init; } = new();
    // ---------- social (servidor): alianças, conversa, mensagens, propostas e bandeiras
    public SocialP Social { get; init; } = new();
    // ---------- temporada, legado, ranking e "precisa de você" (servidor) ----------
    public TemporadaServP TemporadaServ { get; init; } = new();
    public AgoraServP AgoraServ { get; init; } = new();
    // ---------- reinos de IA, meta de ocupação, regência e IA comerciante (servidor) ----------
    public IAP IA { get; init; } = new();
}

// ---------- temporada, legado, ranking e "precisa de você" (servidor) ----------
public sealed class TemporadaServP
{
    public LinhagemP Linhagem { get; init; } = new();
    public DesbloqueiosP Desbloqueios { get; init; } = new();
    /// <summary>Posições do ranking que ganham relíquia da temporada (baixas, tropas e famílias; perdas não contam).</summary>
    public int RankingTop { get; init; }
    public double[] BonusPos { get; init; } = [];
    public double BonusLendaria { get; init; }
    public double BonusCerco { get; init; }
    /// <summary>Conquista ("baixas", "tropas", "familias", "lendaria", "cerco") → tipo do bônus, nome da relíquia e título.</summary>
    public Dictionary<string, ConquistaP> Conquistas { get; init; } = new();
    public TituloLinhagemP[] TitulosLinhagem { get; init; } = [];
    /// <summary>Região → centro (fração de colunas, fração de linhas).</summary>
    public Dictionary<string, double[]> Regioes { get; init; } = new();
    public double IaExtras { get; init; }
    public double IaMoldura { get; init; }
}
public sealed class LinhagemP { public int Inicial { get; init; } public int Max { get; init; } public int DiasAtivos { get; init; } }
public sealed class DesbloqueiosP
{
    public int Brasoes { get; init; }
    public int Titulos { get; init; }
    public int Regiao { get; init; }
    public int Exilio { get; init; }
    public int Moldura { get; init; }
}
public sealed class ConquistaP { public string Tipo { get; init; } = ""; public string Reliquia { get; init; } = ""; public string Titulo { get; init; } = ""; }
public sealed class TituloLinhagemP { public int Nivel { get; init; } public string Nome { get; init; } = ""; }
public sealed class AgoraServP
{
    public double EscudoH { get; init; }
    public double FeridosUrgenteH { get; init; }
    public double PopTeto { get; init; }
    public double EstoqueCheio { get; init; }
    public double Armazem { get; init; }
    public int MaxPorTipo { get; init; }
}

// ---------- ferraria, eras e equipamento lendário (servidor) ----------
/// <summary>Requisito conferido pelo servidor: era já pesquisada e nível mínimo do maior local de cada tipo.</summary>
public sealed class RequisitoP
{
    public string? Era { get; init; }
    public int Ferraria { get; init; }
    public int Quartel { get; init; }
}
public sealed class FerrariaServP
{
    /// <summary>Era → requisito (a mesma regra do texto de P.eras[].req).</summary>
    public Dictionary<string, RequisitoP> Eras { get; init; } = new();
    /// <summary>Requisito de cada nível de armas e armaduras (índice 0 = nível 1).</summary>
    public RequisitoP[] Niveis { get; init; } = [];
    public RequisitoP Lendario { get; init; } = new();
    /// <summary>Famílias com armas e armaduras.</summary>
    public string[] Familias { get; init; } = [];
    public int LendarioPorReino { get; init; }
}

public sealed class GuerraP
{
    public ExilioP Exilio { get; init; } = new();
    public InterceptacaoP Interceptacao { get; init; } = new();
    public PosturaP Postura { get; init; } = new();
    public int ModelosMax { get; init; }
    public int ModeloNome { get; init; }
}
public sealed class ExilioP
{
    public Dictionary<string, double> Kit { get; init; } = new();
    public Dictionary<string, int> Tropas { get; init; } = new();
    public double Pop { get; init; }
    /// <summary>Fração dos pontos livres mais distantes de quem derrubou o reino entre os quais o exílio é sorteado.</summary>
    public double Longe { get; init; }
}
public sealed class InterceptacaoP { public double FolgaSeg { get; init; } }
public sealed class PosturaP { public int Alcance { get; init; } public double RevidaH { get; init; } }

public sealed class CombateP
{
    /// <summary>Limite de baixas por tática (null = sem limite).</summary>
    public Dictionary<string, double?> Taticas { get; init; } = new();
    public string TaticaPadrao { get; init; } = "";
    public BatalhaP Batalha { get; init; } = new();
    public double SaqueJanelaH { get; init; }
    public double MassacrePorTropa { get; init; }
    public int SabotagemMaxNiveis { get; init; }
    public Dictionary<string, int> ObjPadrao { get; init; } = new();
    public double GuardarBatalhaH { get; init; }
    public PortaoP Portao { get; init; } = new();
}
public sealed class BatalhaP { public double BaseSeg { get; init; } public double PorTropaSeg { get; init; } public double MaxSeg { get; init; } }
public sealed class PortaoP
{
    public double CustoN1 { get; init; }
    public double CustoCresc { get; init; }
    public double TempoN1 { get; init; }
    public int NivelSemEra { get; init; }
    public Dictionary<string, double> Receita { get; init; } = new();
}

public sealed class ExploracaoServP
{
    /// <summary>Tipo de explorador → terrenos sem penalidade (fator 1).</summary>
    public Dictionary<string, string[]> SemPenalidade { get; init; } = new();
    /// <summary>Tipo de explorador → terreno → multiplicador extra.</summary>
    public Dictionary<string, Dictionary<string, double>> Penalidade { get; init; } = new();
    public CapturaP Captura { get; init; } = new();
}
public sealed class CapturaP { public double Base { get; init; } public double PorTropa { get; init; } public double Max { get; init; } public double Furtivo { get; init; } }
public sealed class FaunaServP
{
    public int RegioesPorReino { get; init; }
    public int[] Raio { get; init; } = [1, 1];
    public int DistanciaMin { get; init; }
    public int LongeCastelo { get; init; }
    public int PertoReino { get; init; }
    public double Variacao { get; init; }
    public double[] MoverH { get; init; } = [4, 4];
    public Dictionary<string, int[]> Bando { get; init; } = new();
    public double ForcaCarregador { get; init; }
    public Dictionary<string, double> CustoSeguro { get; init; } = new();
}

public sealed class ReliquiaVisP { public int Brilho { get; init; } public int Farol { get; init; } }

public sealed class VeiculoP { public Dictionary<string, double> Tempo { get; init; } = new(); }
public sealed class CaravanaP { public double EscoltaMin { get; init; } }

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
// ---------- social (servidor)
public sealed class SocialP
{
    /// <summary>Conselheiros por aliança.</summary>
    public int Conselheiros { get; init; }
    public FaixaP NomeAlianca { get; init; } = new();
    public ConversaP Conversa { get; init; } = new();
    /// <summary>Mensagens por mensageiro guardadas por reino.</summary>
    public int Caixa { get; init; }
    /// <summary>Horas até uma proposta, convite ou pedido sem resposta expirar.</summary>
    public double PropostaH { get; init; }
    /// <summary>Janela (horas) do limite diário do novato.</summary>
    public double NovatoJanelaH { get; init; }
    public BandeirasP Bandeiras { get; init; } = new();
}
public sealed class FaixaP { public int Min { get; init; } public int Max { get; init; } }
public sealed class ConversaP { public int Caracteres { get; init; } public int Guardar { get; init; } }
public sealed class BandeirasP { public int Ativas { get; init; } public int Minimo { get; init; } public int Caracteres { get; init; } }

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

// ---------- reinos de IA, meta de ocupação, regência e IA comerciante (servidor) ----------
public sealed class IAP
{
    /// <summary>Reinos de IA no começo da temporada.</summary>
    public int Inicial { get; init; }
    /// <summary>Mínimo de reinos ativos (jogadores + IA): abaixo disso, surge um reino de IA.</summary>
    public int Minimo { get; init; }
    /// <summary>Reinos cobertos pela reserva de ids sorteados e quantos ids cada um usa (reino + 5 locais).</summary>
    public int ReservaReinos { get; init; }
    public int IdsPorReino { get; init; }
    /// <summary>Fuso (horas de UTC) das horas de sessão e variação sorteada (minutos, para mais ou para menos).</summary>
    public double FusoH { get; init; }
    public double VariacaoMin { get; init; }
    public Dictionary<string, CondutaIAP> Habilidades { get; init; } = new();
    public int LocaisBase { get; init; }
    public int ObrasPorSessao { get; init; }
    public MoradiaIAP Moradia { get; init; } = new();
    public ArmazemIAP Armazem { get; init; } = new();
    public Dictionary<string, double> PesosHabilidade { get; init; } = new();
    public Dictionary<string, PerfilIAP> Perfis { get; init; } = new();
    public AtaqueIAP Ataque { get; init; } = new();
    public EspionagemIAP Espionagem { get; init; } = new();
    public OcupacaoIAP Ocupacao { get; init; } = new();
    public ExploracaoIAP Exploracao { get; init; } = new();
    public CacaIAP Caca { get; init; } = new();
    public ExtracaoIAP Extracao { get; init; } = new();
    public DefesaIAP Defesa { get; init; } = new();
    public ComercioIAP Comercio { get; init; } = new();
    public CondutaIAP Regencia { get; init; } = new();
}
/// <summary>Regras de decisão de uma sessão (as da simulação do modelo).</summary>
public sealed class CondutaIAP
{
    public int[] Sessoes { get; init; } = [];
    public double Militar { get; init; }
    public double MantemTrab { get; init; }
    public double FracTropas { get; init; }
    public double Horizonte { get; init; }
    public double HorizonteNoite { get; init; }
    public double LocaisCadaDias { get; init; }
    public int LocaisMax { get; init; }
    public double Acerto { get; init; }
    public double Arqueiros { get; init; }
    /// <summary>Regência: linhas guardadas no relatório (ações e perdas).</summary>
    public int Linhas { get; init; }
}
public sealed class PerfilIAP
{
    public double Peso { get; init; }
    public double Locais { get; init; }
    public double Militar { get; init; }
    public bool Ataca { get; init; }
    public bool Ocupa { get; init; }
    public bool Espiona { get; init; }
    public int Torres { get; init; }
    public bool Prospecta { get; init; }
    public bool Comercia { get; init; }
}
public sealed class AtaqueIAP
{
    public int Castelo { get; init; }
    public double EspionagemH { get; init; }
    public int Alcance { get; init; }
    public double Porte { get; init; }
    public double Forca { get; init; }
    public double FracTropas { get; init; }
    public int Reserva { get; init; }
    public string Tatica { get; init; } = "";
}
public sealed class EspionagemIAP { public int Castelo { get; init; } public int Alcance { get; init; } public double RefazerH { get; init; } }
public sealed class OcupacaoIAP { public int Alcance { get; init; } public int Tropas { get; init; } }
public sealed class ExploracaoIAP { public int[] Distancia { get; init; } = [1, 1]; public int Tentativas { get; init; } }
public sealed class CacaIAP { public double CouroMin { get; init; } public int Alcance { get; init; } public int Tropas { get; init; } }
public sealed class ExtracaoIAP { public int Castelo { get; init; } public int Alcance { get; init; } public int Tropas { get; init; } }
public sealed class MoradiaIAP { public double Trabalhadores { get; init; } public double Teto { get; init; } }
public sealed class ArmazemIAP { public double Folga { get; init; } }
public sealed class DefesaIAP { public double Reforco { get; init; } public double Recuo { get; init; } }
public sealed class ComercioIAP { public double MargemOutros { get; init; } public double Reserva { get; init; } }
