using System.Text;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;

namespace ReinoDePedra.Jogo.IA;

/// <summary>Uma fala anterior da conversa (histórico curto do contexto).</summary>
public sealed record FalaAnterior(string Quem, string Texto, bool Propria = false);

/// <summary>
/// O que quem escreve a fala precisa saber: quem fala, para quem, onde, sobre o quê e o que foi dito há pouco.
/// É o mesmo contexto para os modelos de texto de hoje e para a LLM de amanhã.
/// </summary>
public sealed class ContextoFala
{
    /// <summary>O assunto (<see cref="Falas"/> tem a lista): "saudacao", "pedido-reforco", "ameaca"...</summary>
    public string Tipo { get; set; } = "";
    /// <summary>Onde a fala sai: "alianca" (conversa da aliança) ou "mensageiro" (mensagem a outro reino).</summary>
    public string Canal { get; set; } = Falas.CanalAlianca;
    /// <summary>Quem fala: o nome do reino (público) e de quem o governa (só para dar voz; não aparece no jogo).</summary>
    public string DeReino { get; set; } = "";
    /// <summary>Para quem (nome do reino), quando a fala tem destinatário.</summary>
    public string? ParaReino { get; set; }
    /// <summary>Fatos da situação, por nome: local, recurso, quantidade, reino, alianca, atacante...</summary>
    public Dictionary<string, string> Situacao { get; set; } = new();
    /// <summary>As últimas falas da conversa, da mais antiga para a mais nova.</summary>
    public List<FalaAnterior> Historico { get; set; } = new();
    /// <summary>Tamanho máximo da fala no canal.</summary>
    public int MaxCaracteres { get; set; } = 200;
}

/// <summary>Quem escreve o rascunho da fala, na hora e sem sair do servidor: os modelos de texto (<see cref="FalasPorModelo"/>).</summary>
public interface IGeradorDeFala
{
    /// <summary>A fala, ou null para ficar calado. <paramref name="sorte"/> dá a variação (a mesma sorte dá a mesma fala).</summary>
    string? Gerar(Persona persona, ContextoFala contexto, Rng sorte);
}

/// <summary>
/// Quem reescreve o rascunho na voz da persona, fora da thread do mundo (uma LLM). <see cref="Escrever"/> é chamado na
/// thread do mundo e volta logo; o texto chega depois por <paramref name="pronto"/>, que roda de novo na thread do mundo
/// (null quando não deu: fora do ar, demorou, limite de uso, recusou). Nunca derruba nada: na falha, vale o rascunho.
/// </summary>
public interface IEscritorDeFala
{
    void Escrever(PromptDeFala pedido, Action<Mundo, string?> pronto);
}

/// <summary>
/// O ponto único de onde sai toda fala de um reino de IA: conversa da aliança e mensagens por mensageiro. Quem quer que a
/// IA diga algo monta o <see cref="ContextoFala"/> e chama <see cref="Pedir"/>; ninguém escreve texto de IA em outro lugar.
/// <para>Em duas etapas: os modelos de texto (<see cref="Gerador"/>) escrevem o rascunho na hora, já na voz da persona
/// (<see cref="Vozes"/>); se há um <see cref="Escritor"/> (a LLM, ligada pela API), ele reescreve o rascunho do jeito
/// daquela pessoa e a fala sai quando ele responde, segundos depois, como gente digitando. Sem escritor, ou se ele falhar,
/// sai o rascunho.</para>
/// </summary>
public static class Falas
{
    public const string CanalAlianca = "alianca", CanalMensageiro = "mensageiro";

    // assuntos
    public const string Saudacao = "saudacao", BoasVindas = "boas-vindas", Despedida = "despedida", ConversaFiada = "conversa-fiada",
        PedidoReforco = "pedido-reforco", AvisoAtaque = "aviso-ataque", VouAjudar = "vou-ajudar", NaoPossoAjudar = "nao-posso-ajudar",
        PedidoRecurso = "pedido-recurso", MandeiRecurso = "mandei-recurso", Agradecimento = "agradecimento",
        Vitoria = "vitoria", Derrota = "derrota", Parabens = "parabens", Consolo = "consolo",
        RespostaMencao = "resposta-mencao", Resposta = "resposta", RespostaConversa = "resposta-conversa", RespostaVaga = "resposta-vaga",
        ConviteAlianca = "convite-alianca", AceitaConvite = "aceita-convite", RecusaConvite = "recusa-convite",
        Ameaca = "ameaca", Queixa = "queixa", PropostaPaz = "proposta-paz", Vizinho = "vizinho", Desafio = "desafio", Apaziguar = "apaziguar";

    /// <summary>Quem escreve o rascunho. Padrão: modelos de texto variados pela persona.</summary>
    public static IGeradorDeFala Gerador { get; set; } = new FalasPorModelo();
    /// <summary>Quem reescreve o rascunho (a LLM). Null: sai o rascunho, na hora. A API liga quando configurada.</summary>
    public static IEscritorDeFala? Escritor { get; set; }

    /// <summary>
    /// O rascunho da fala de <paramref name="de"/> para o contexto dado, ou null (reino sem persona, ou quem escreve
    /// preferiu calar). Preenche quem fala, corta no tamanho do canal e nunca devolve texto vazio.
    /// </summary>
    public static string? Gerar(Mundo m, Reino de, ContextoFala c)
    {
        var p = de.Persona;
        if (p == null) return null;
        c.DeReino = de.Nome;
        var sorte = Personas.Sorte(m, de, "fala:" + c.Tipo + ":" + c.ParaReino + ":" + c.Historico.Count);
        string? t;
        try { t = Gerador.Gerar(p, c, sorte); }
        catch (Exception) { t = null; }   // quem escreve falhou: a IA fica calada, o jogo segue
        if (string.IsNullOrWhiteSpace(t)) return null;
        t = PromptsDeFala.Cortar(t.Trim(), c.MaxCaracteres);
        return t.Length == 0 ? null : t;
    }

    /// <summary>
    /// Pede a fala e a entrega por <paramref name="entregar"/>, na thread do mundo: na hora (sem LLM) ou quando a LLM
    /// responder. Devolve false se a pessoa ficou calada (nada será entregue). Quem entrega deve conferir de novo o que
    /// pode ter mudado no meio tempo; uma <see cref="RegraException"/> ali só descarta a fala.
    /// </summary>
    public static bool Pedir(Mundo m, Reino de, ContextoFala c, Action<Mundo, string> entregar)
    {
        var rascunho = Gerar(m, de, c);
        if (rascunho == null) return false;
        var escritor = Escritor;
        if (escritor == null)
        {
            try { entregar(m, rascunho); return true; }
            catch (RegraException) { return false; }
        }
        var para = c.ParaReino is { Length: > 0 } nome ? m.Reinos.FirstOrDefault(x => x.Nome == nome) : null;
        var relacao = para == null ? ((double, double)?)null : (Personas.RancorDe(de, para.Id), Personas.AfinidadeDe(de, para.Id));
        var pedido = PromptsDeFala.Montar(de.Persona!, c, rascunho, relacao);
        var persona = de.Persona!;
        var sorte = Personas.Sorte(m, de, "digitar:" + c.Tipo + ":" + c.Historico.Count);
        void Entregar(Mundo mm, string? texto)
        {
            // a LLM ainda capricha em acento e vírgula: o mesmo jeito de digitar dos modelos passa por cima
            var limpo = PromptsDeFala.Limpar(texto, pedido);
            if (limpo != null)
            {
                limpo = Digitacao.Aplicar(persona, Vozes.De(persona), limpo, sorte);
                if (persona.Minusculas) limpo = limpo.ToLowerInvariant();
                if (limpo.Length == 0) limpo = null;
            }
            try { entregar(mm, limpo ?? rascunho); }
            catch (RegraException) { }   // o mundo mudou enquanto ela digitava (saiu da aliança, sem mensageiro): a fala some
        }
        try { escritor.Escrever(pedido, Entregar); }
        catch (Exception) { Entregar(m, null); }
        return true;
    }
}

/// <summary>
/// Falas por modelos de texto: algumas frases por assunto, escolhidas pela sorte, e depois passadas pelo jeito de escrever
/// da persona (tom, minúsculas, pressa, bordão). O mesmo assunto sai diferente de um reino para o outro.
/// </summary>
public sealed class FalasPorModelo : IGeradorDeFala
{
    /// <summary>Frases por assunto. {chave} vem da situação do contexto; {para} é o destinatário.</summary>
    private static readonly Dictionary<string, string[]> Modelos = new()
    {
        [Falas.Saudacao] = ["Cheguei. Contem comigo.", "Olá a todos, feliz de estar aqui.", "Boa, entrei. O que precisam?", "Salve! Vamos fazer essa aliança valer.", "Oi, pessoal. Qualquer coisa, chamem."],
        [Falas.BoasVindas] = ["Bem-vindo, {para}!", "Boa, {para} chegou.", "Seja bem-vindo, {para}. Precisando, é só falar.", "{para}, bem-vindo à {alianca}.", "Mais um! Bem-vindo, {para}."],
        [Falas.Despedida] = ["Vou sair por hoje. Até amanhã.", "Fico por aqui, boa noite.", "Saindo. Volto mais tarde.", "Até mais tarde, pessoal."],
        // {recurso} é o básico que ela tem de menos agora (fato dado pelo servidor); o resto é pergunta ou comentário sem fato
        [Falas.ConversaFiada] = ["Alguém mais sem {recurso}?", "Como estão as coisas por aí?", "{Recurso} nunca chega, não é?", "Tudo calmo do meu lado.", "Alguém viu marcha estranha hoje?",
            "Boa temporada até aqui.", "Quem está precisando de alguma coisa?", "De olho no mapa por aqui.", "Por aqui falta {recurso}. E vocês?", "Alguém já achou ruína antiga?",
            "Os lobos andam soltos na floresta, cuidado com os exploradores.", "Hoje foi só obra e fila.", "Estou juntando {recurso} para a próxima obra.", "Como está a vizinhança de vocês?",
            "Mais alguém demorando para subir o castelo?", "Quem sabe de jazida boa por perto?", "Meus exploradores ainda não acharam nada que preste.", "Semana parada por aqui. Melhor assim."],
        // resposta a uma pergunta de conversa (das de cima): curta, sobre ela mesma
        [Falas.RespostaConversa] = ["Por aqui tudo certo.", "Nada de estranho do meu lado.", "Tudo em ordem. E por aí?", "Aqui falta {recurso}, de resto bem.", "Tranquilo por enquanto.", "Do meu lado, só obra.",
            "Também. {Recurso} some rápido.", "Por aqui nada ainda.", "Mesma coisa aqui.", "Nada de novo. Aviso se mudar."],
        // resposta a uma pergunta que ela não sabe do que trata: não se compromete
        [Falas.RespostaVaga] = ["Vi agora. Deixa eu olhar aqui e te falo.", "Boa pergunta. Vou ver.", "Não sei te dizer agora.", "Deixa comigo, vejo isso mais tarde.", "Preciso olhar o mapa antes de responder."],
        [Falas.PedidoReforco] = ["Estão atacando {local}! Alguém consegue mandar reforço?", "{atacante} em cima de {local}. Preciso de ajuda.", "Socorro em {local}, {atacante} chegou com tudo.", "Reforço em {local}, quem puder!"],
        [Falas.AvisoAtaque] = ["{para}, estão te atacando em {local}.", "Batalha em {local}! {para}, viu?", "Atenção: {atacante} atacando {para} em {local}.", "{para}, olha {local}. {atacante} está lá."],
        [Falas.VouAjudar] = ["Mandei tropas para {local}.", "Indo. Segura aí, {para}.", "Reforço a caminho de {local}.", "Já mandei o que tinha livre.", "Tropas saindo agora para {local}."],
        [Falas.NaoPossoAjudar] = ["Não consigo agora, estou sem tropas livres.", "Queria ajudar, mas não chego a tempo.", "Sem tropa sobrando, desculpe.", "Daqui não dá, {para}. Estou longe demais."],
        [Falas.PedidoRecurso] = ["Alguém tem {recurso} sobrando? Preciso de uns {quantidade}.", "Estou travado sem {recurso}. Quem puder mandar, agradeço.", "Falta {recurso} para a próxima obra. Alguém ajuda?"],
        [Falas.MandeiRecurso] = ["Mandei {quantidade} de {recurso}, {para}.", "{recurso} a caminho, {para}. Cuidado na estrada.", "Enviado. Deve chegar logo.", "Saiu daqui agora, {para}."],
        [Falas.Agradecimento] = ["Valeu, {para}!", "Obrigado, {para}. Fico devendo.", "Chegou certinho, obrigado.", "Salvou, {para}.", "Agradeço, {para}."],
        [Falas.Vitoria] = ["Seguramos {local}!", "Ganhamos em {local}. {atacante} voltou de mãos vazias.", "{local} está de pé. Obrigado a quem ajudou.", "Vitória em {local}."],
        [Falas.Derrota] = ["Perdi a batalha em {local}.", "{atacante} levou o que quis de {local}.", "Não deu em {local}. Vou refazer a defesa.", "Caiu {local}. Paciência."],
        [Falas.Parabens] = ["Boa, {para}!", "Mandou bem, {para}.", "Parabéns pela vitória, {para}.", "Isso aí, {para}."],
        [Falas.Consolo] = ["Sinto muito, {para}. Precisa de algo?", "Que pena, {para}. A gente dá o troco.", "Força, {para}. Se precisar de recurso, fala.", "Acontece, {para}. Vamos reforçar da próxima."],
        [Falas.RespostaMencao] = ["Oi, {para}. Diga.", "Estou aqui, {para}.", "Fala, {para}.", "Vi agora, {para}. O que foi?", "Presente."],
        [Falas.Resposta] = ["Recebi sua mensagem, {para}.", "Entendido, {para}.", "Li o recado. Vou pensar.", "Obrigado pela mensagem, {para}.", "Certo, {para}. Tomei nota."],
        [Falas.ConviteAlianca] = ["{para}, somos vizinhos. Que tal entrar na {alianca}?", "Mandei convite para a {alianca}. Juntos seguramos melhor essa região.", "{para}, a {alianca} tem vaga. Topa?", "Temos lugar na {alianca} para um vizinho como você, {para}."],
        [Falas.AceitaConvite] = ["Aceito. Vamos juntos.", "Topo. Obrigado pelo convite.", "Fechado, entrei.", "Com prazer."],
        [Falas.RecusaConvite] = ["Agradeço o convite, mas por ora sigo sozinho.", "Obrigado, mas não agora.", "Prefiro ficar por conta própria nesta temporada.", "Não desta vez. Sem ressentimentos."],
        [Falas.Ameaca] = ["Você atacou {local}. Não vou esquecer, {para}.", "{para}, da próxima vez que pisar em {local}, não volta ninguém.", "Guardei seu nome, {para}.", "Isso vai ter volta, {para}."],
        [Falas.Queixa] = ["{para}, por que atacar {local}? Não te fiz nada.", "Somos vizinhos, {para}. Não precisava atacar {local}.", "{para}, deixe {local} em paz e eu deixo você em paz."],
        [Falas.PropostaPaz] = ["{para}, proponho paz entre nós. Um pacto serve aos dois.", "Chega de briga, {para}? Um pacto resolve isso.", "{para}, tenho mais a ganhar com você em paz. Vamos conversar."],
        // resposta a uma ameaça ou queixa recebida: quem é orgulhoso devolve; quem não quer briga baixa o tom
        [Falas.Desafio] = ["Venha, então.", "Estou esperando, {para}.", "Ameaça não derruba castelo, {para}.", "Fale menos e venha ver, {para}.", "Sei onde você mora também, {para}."],
        [Falas.Apaziguar] = ["Não quero briga, {para}.", "Recado dado, {para}. Cada um no seu canto.", "Entendido. Não procuro confusão.", "Fica registrado, {para}. Prefiro paz.", "Não era contra você, {para}. Sigo meu caminho."],
        [Falas.Vizinho] = ["Saudações, {para}. Somos vizinhos; prefiro que seja em paz.", "Olá, {para}. Vi seu castelo daqui. Boa sorte na temporada.", "{para}, se quiser trocar recursos, estou por perto.", "Boas, vizinho. Não pretendo te incomodar."],
    };
    private static readonly string[] Genericas = ["Certo.", "Entendido.", "Vamos ver.", "Anotado."];

    private static readonly (string de, string para)[] Abreviacoes =
        [("você", "vc"), ("Você", "vc"), ("para ", "pra "), ("também", "tb"), ("porque", "pq"), ("obrigado", "obg"), ("Obrigado", "obg"), ("estou", "tô"), ("Estou", "tô"), ("beleza", "blz")];

    public string? Gerar(Persona p, ContextoFala c, Rng s)
    {
        var lista = Modelos.GetValueOrDefault(c.Tipo) ?? Genericas;
        var voz = Vozes.De(p);
        // não repete o que já está na conversa recente, dela ou dos outros: sorteia entre as frases que ninguém disse há pouco
        // (crua ou já na voz de quem disse). Se todas já foram ditas, a conversa fiada cala (ninguém repete o mesmo
        // comentário); os outros assuntos repetem.
        var livres = lista.Where(f =>
        {
            var crua = Preencher(f, c); var naVoz = Vozes.Trocar(voz, crua, p.Feminina);
            return !c.Historico.Any(h => Contem(h.Texto, crua) || Contem(h.Texto, naVoz));
        }).ToArray();
        if (livres.Length == 0 && c.Tipo is Falas.ConversaFiada or Falas.RespostaConversa) return null;
        var t = Preencher(s.Escolher(livres.Length > 0 ? livres : lista), c);

        // quem é seco fala só a primeira frase
        if (p.Tom == "seco" || voz.Id == Vozes.Seca) { var i = t.IndexOfAny(['.', '!', '?']); if (i > 0 && i < t.Length - 1) t = t[..(i + 1)]; }
        // a voz da pessoa: trocas de palavra, interjeição, apelido, xingamento na briga, fecho
        t = Vozes.Aplicar(p, c, t, s, out var comFecho);
        // o bordão não se empilha com o fecho da voz: um arremate por fala
        if (!comFecho && p.Bordoes.Count > 0 && s.Chance(0.22) && t.Length + p.Bordoes[0].Length + 2 < c.MaxCaracteres && !t.Contains(p.Bordoes[0], StringComparison.OrdinalIgnoreCase))
            // depois de pergunta ou exclamação o bordão é outra frase ("Tudo bem? Certo."); senão, emenda com vírgula
            t = t.EndsWith('?') || t.EndsWith('!') ? t + " " + char.ToUpperInvariant(p.Bordoes[0][0]) + p.Bordoes[0][1..] + "." : t.TrimEnd('.') + ", " + p.Bordoes[0] + ".";

        // o jeito de digitar: pressa abrevia; quase ninguém acentua nem pontua em chat de jogo, e escapa um erro de vez em quando
        if (p.Pressa > 0.3 && s.Chance(p.Pressa))
            foreach (var (de, para) in Abreviacoes) t = t.Replace(de, para);
        t = Digitacao.Aplicar(p, voz, t, s);
        if (p.Minusculas) t = t.ToLowerInvariant();
        return t;
    }

    private static string Preencher(string frase, ContextoFala c)
    {
        var t = frase.Replace("{para}", c.ParaReino ?? "pessoal");
        foreach (var (k, v) in c.Situacao) t = t.Replace("{" + k + "}", v);
        // chave sem valor na situação: a frase sai sem o pedaço, não com a chave à mostra
        while (t.IndexOf('{') is var i && i >= 0 && t.IndexOf('}', i) is var j && j > i) t = t.Remove(i, j - i + 1);
        return t.Replace("  ", " ").Replace(" ,", ",").Replace(" .", ".").Replace(" !", "!").Replace(" ?", "?").Trim();
    }
    /// <summary>A fala <paramref name="dita"/> traz a frase (com abertura, fecho, minúsculas ou sem acento por cima)?</summary>
    private static bool Contem(string dita, string frase) =>
        Normal(dita).Contains(Normal(frase), StringComparison.OrdinalIgnoreCase);
    /// <summary>Sem acento, sem pontuação e com um espaço só: compara o que foi dito com quem digita sem capricho.</summary>
    private static string Normal(string t) =>
        System.Text.RegularExpressions.Regex.Replace(SemAcento(t).Replace(",", " ").Replace(".", " ").Replace(";", " ").Replace("!", " ").Replace("?", " "), @"\s+", " ").Trim();

    /// <summary>A fala é uma das perguntas de conversa que os modelos conhecem? (vale para quem quer que a tenha escrito)</summary>
    public static bool PerguntaDeConversa(string dita) =>
        Modelos[Falas.ConversaFiada].Where(f => f.EndsWith('?')).Select(Fixo).Any(f => f.Length >= 6 && Contem(dita, f));

    /// <summary>A mensagem é uma ameaça ou uma queixa das que os modelos conhecem? (vale para quem quer que a tenha escrito)</summary>
    public static bool Hostil(string dita) =>
        Modelos[Falas.Ameaca].Concat(Modelos[Falas.Queixa]).Select(Fixo).Any(f => f.Length >= 8 && Contem(dita, f)) || Vozes.TemBriga(dita);

    /// <summary>O maior pedaço fixo de um modelo (sem as chaves): "Por aqui falta {recurso}. E vocês?" → "Por aqui falta".</summary>
    private static string Fixo(string modelo) =>
        System.Text.RegularExpressions.Regex.Split(modelo, @"\{[^}]*\}").Select(x => x.Trim(' ', '.', '?', '!', ',')).OrderByDescending(x => x.Length).First();
    private const string ComAcento = "áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ", SemAcentoDe = "aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN";

    /// <summary>
    /// O texto sem os acentos do português. Por tabela: o servidor roda com globalização invariante, em que
    /// <c>string.Normalize</c> não decompõe as letras (o jeito antigo, por decomposição, não tirava acento nenhum).
    /// </summary>
    public static string SemAcento(string t)
    {
        var sb = new StringBuilder(t.Length);
        foreach (var ch in t) { var i = ComAcento.IndexOf(ch); sb.Append(i >= 0 ? SemAcentoDe[i] : ch); }
        return sb.ToString();
    }

    /// <summary>Assuntos que os modelos sabem escrever.</summary>
    public static IEnumerable<string> Assuntos => Modelos.Keys;
}
