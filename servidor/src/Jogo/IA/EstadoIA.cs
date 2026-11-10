using ReinoDePedra.Jogo.Nucleo;

namespace ReinoDePedra.Jogo.IA
{
    /// <summary>
    /// Liga a IA no processo (não é gravado). O servidor liga tudo; os testes ligam só quando testam a IA.
    /// <see cref="Ativa"/>: sessões dos reinos de IA e regência. <see cref="CriarReinos"/>: completar a meta de ocupação
    /// com reinos de IA (REINO_IA=0 desliga).
    /// </summary>
    public sealed class ConfigIA
    {
        public bool Ativa { get; set; }
        public bool CriarReinos { get; set; }
    }

    /// <summary>Estado da IA no mundo (documento único): reserva de ids sorteados e se a temporada já recebeu a leva inicial.</summary>
    public sealed class EstadoIA : Documento
    {
        /// <summary>Ids reservados ainda não usados (reinos e locais iniciais saem daqui, em ordem sorteada).</summary>
        public List<long> IdsLivres { get; set; } = new();
        /// <summary>A leva inicial de reinos de IA já foi criada nesta temporada.</summary>
        public bool LevaInicial { get; set; }
    }

    /// <summary>Uma linha do relatório da regência; a chave junta linhas do mesmo assunto (ex.: o mesmo local subindo de nível).</summary>
    public sealed class LinhaRegencia
    {
        public string Chave { get; set; } = "";
        public string Texto { get; set; } = "";
        public long Quando { get; set; }
        /// <summary>Quantidade acumulada (tropas recrutadas, perdas...), quando a linha soma.</summary>
        public double Qtd { get; set; }
    }

    /// <summary>Regência do reino de um jogador ausente: quando começou, quando terminou e o que a IA fez e perdeu.</summary>
    public sealed class RegistroRegencia
    {
        public long AtivaDesde { get; set; }
        public long? TerminouEm { get; set; }
        public List<LinhaRegencia> Acoes { get; set; } = new();
        public List<LinhaRegencia> Perdas { get; set; } = new();
        public bool Ativa => TerminouEm == null;
    }
}

namespace ReinoDePedra.Jogo.Reinos
{
    public sealed partial class Reino
    {
        /// <summary>Perfil do reino de IA ("expansionista", "defensivo", "saqueador", "comerciante"); null num reino de jogador. Só do servidor.</summary>
        public string? PerfilIA { get; set; }
        /// <summary>Habilidade do reino de IA ("fraco", "medio", "ativo"). Só do servidor.</summary>
        public string? HabilidadeIA { get; set; }
        /// <summary>Próxima sessão da IA (reino de IA ou em regência).</summary>
        public long? SessaoIAEventoId { get; set; }
        /// <summary>Segunda parte da sessão em curso (o que a pessoa faz minutos depois de entrar).</summary>
        public long? SessaoIA2EventoId { get; set; }
        /// <summary>Reação a um ataque, fora da sessão, já marcada.</summary>
        public long? ReacaoIAEventoId { get; set; }
        /// <summary>Verificação de regência agendada (reino de jogador).</summary>
        public long? RegenciaEventoId { get; set; }
        /// <summary>Regência em curso ou a última que terminou (relatório para o jogador).</summary>
        public IA.RegistroRegencia? Regencia { get; set; }
        /// <summary>Reino de jogador governado agora pela IA (regência).</summary>
        public bool EmRegencia => Regencia is { TerminouEm: null };
    }
}

namespace ReinoDePedra.Jogo
{
    using ReinoDePedra.Jogo.IA;
    public sealed partial class Mundo
    {
        /// <summary>Liga a IA neste processo (não é gravado).</summary>
        public ConfigIA IA { get; } = new();
        public Colecao<EstadoIA> EstadosIA { get; } = new("ia");
    }
}
