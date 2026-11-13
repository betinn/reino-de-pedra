using System.Text.RegularExpressions;
using ReinoDePedra.Jogo.Nucleo;

namespace ReinoDePedra.Jogo.IA;

/// <summary>
/// O jeito de falar de um tipo de pessoa: as palavras que ela troca, as que solta no meio da frase, como chama os amigos e
/// os inimigos, os palavrões que usa (ou não usa) e os vícios de digitação. É a lista que vai para a LLM (para ela escrever
/// naquela voz) e a mesma que os modelos de texto aplicam por cima das frases quando a LLM não está ligada ou falha.
/// <para>Sempre português do Brasil de chat de jogo, nunca texto perfeito. <c>{a}</c> numa troca vira "a" ou "o" pelo
/// gênero de quem fala ("magoad{a}").</para>
/// </summary>
public sealed class Voz
{
    public required string Id { get; init; }
    /// <summary>Como essa pessoa fala, em uma ou duas frases (vai para a LLM).</summary>
    public required string Como { get; init; }
    /// <summary>Palavrão: "pesado" (é vírgula), "leve" (escapa quando irrita) ou "nenhum" (xinga só com a lista dela).</summary>
    public string Palavrao { get; init; } = "leve";
    /// <summary>Trocas de palavra e de expressão, aplicadas na ordem (a mais longa antes).</summary>
    public (string de, string para)[] Trocas { get; init; } = [];
    /// <summary>O que ela solta no começo ou no meio da frase.</summary>
    public string[] Interjeicoes { get; init; } = [];
    /// <summary>Gírias e expressões dela.</summary>
    public string[] Girias { get; init; } = [];
    /// <summary>Como chama aliado e amigo.</summary>
    public string[] ApelidosAmigos { get; init; } = [];
    /// <summary>Como chama inimigo e quem a atacou.</summary>
    public string[] ApelidosHostis { get; init; } = [];
    /// <summary>Os xingamentos que ela usa, do jeito dela (de "biltre" a "filho da puta").</summary>
    public string[] Xingamentos { get; init; } = [];
    /// <summary>Como fecha uma frase às vezes.</summary>
    public string[] Fechos { get; init; } = [];
    /// <summary>Jeito de digitar.</summary>
    public string[] Vicios { get; init; } = [];
    /// <summary>O que ela nunca faz.</summary>
    public string[] Evitar { get; init; } = [];
    /// <summary>Falas de exemplo, para dar o tom (não para copiar).</summary>
    public string[] Exemplos { get; init; } = [];
}

/// <summary>
/// As vozes e qual delas é a de cada persona. A voz sai dos traços e do tom (<see cref="De"/>), então não é gravada: a
/// mesma persona tem sempre a mesma voz, e uma persona antiga ganha a dela sem mudar o save.
/// </summary>
public static class Vozes
{
    public const string BocaSuja = "boca-suja", Fofa = "fofa", Nobre = "nobre", Antiga = "antiga", Seca = "seca",
        Zoeira = "zoeira", Desconfiada = "desconfiada", Calorosa = "calorosa", Comum = "comum";

    public static readonly IReadOnlyDictionary<string, Voz> Todas = new Voz[]
    {
        new()
        {
            Id = BocaSuja, Palavrao = "pesado",
            Como = "Fala como gente brava de chat: curto, grosso, xinga sem cerimônia. Palavrão é vírgula. Com aliado o palavrão é de camaradagem (\"porra, valeu mano\"); com inimigo é ofensa direta. Não pede desculpa, não enrola, não faz textão.",
            Trocas =
            [
                ("Não consigo agora", "Agora não dá, porra"), ("Não consigo", "Não dá, caralho"), ("Preciso de ajuda", "Preciso de ajuda, caralho"),
                ("Socorro", "Porra, socorro"), ("Paciência", "Foda-se"), ("Que pena", "Que merda"), ("Sinto muito", "Que bosta"),
                ("Não vou esquecer", "Não vou esquecer essa merda"), ("Guardei seu nome", "Guardei teu nome, desgraçado"),
                ("Isso vai ter volta", "Isso vai ter volta, porra"), ("Venha, então", "Vem então, porra"), ("Estou esperando", "Tô te esperando"),
                ("Obrigado", "Valeu"), ("Obrigada", "Valeu"), ("Agradeço", "Valeu demais"), ("Fico devendo", "Tô te devendo uma"),
                ("Entendido", "Tá"), ("Certo", "Beleza"), ("Saudações", "Fala"), ("Olá", "Fala"), ("cuidado", "se liga"), ("Atenção", "Ô"),
                ("Perdi a batalha", "Perdi a porra da batalha"), ("Vou refazer a defesa", "Vou refazer essa merda de defesa"), ("Bem-vindo", "Chegou"),
                ("Estou", "Tô"), ("estou", "tô"), ("Está", "Tá"), ("está", "tá"), ("Estão", "Tão"), ("estão", "tão"), ("você", "tu"),
            ],
            Interjeicoes = ["porra", "caralho", "puta merda", "pqp", "vish", "aff", "eita porra", "carai", "mds"],
            Girias = ["meter o pau", "dar o troco", "cola aqui", "tá de sacanagem", "na moral", "se liga", "deu ruim", "tomar no cu", "se foder"],
            ApelidosAmigos = ["mano", "parça", "irmão", "véi", "seu puto", "maluco"],
            ApelidosHostis = ["seu merda", "seu bosta", "otário", "desgraçado", "arrombado", "corno", "seu verme", "filho da puta"],
            Xingamentos = ["filho da puta", "arrombado", "desgraçado", "otário", "vagabundo", "cuzão", "babaca", "corno", "merda", "bosta", "fdp", "imbecil", "lixo", "verme", "pau no cu", "vsf", "tnc"],
            Fechos = [" porra", " caralho", " pqp", " kkkkk", " tlgd"],
            Vicios = ["frases curtas, sem ponto final", "kkkkk de deboche", "CAIXA ALTA quando irrita", "abrevia palavrão (pqp, vsf, tnc, fdp)", "tu em vez de você"],
            Evitar = ["educação de atendente", "pedir desculpa", "textão", "ponto e vírgula"],
            Exemplos = ["porra, cola em {local} que o {atacante} tá socando", "valeu mano, salvou a porra toda", "vem que tem, otário", "perdi {local} pro arrombado do {atacante}. ele vai ver"],
        },
        new()
        {
            Id = Fofa, Palavrao = "nenhum",
            Como = "Doce, carinhosa, animada. Diminutivo em tudo, chama todo mundo com carinho, agradece demais, coraçãozinho e carinha. Até brava fala fofo: fica chateadinha, magoada, nunca xinga de verdade.",
            Trocas =
            [
                ("Obrigado", "Brigaduuu"), ("Obrigada", "Brigaduuu"), ("Valeu", "Brigadinha"), ("Agradeço", "Muito obrigadinh{a}"),
                ("Olá", "Oiee"), ("Saudações", "Oiii"), ("Bem-vindo", "Bem-vindinho"), ("pessoal", "gente linda"), ("Pessoal", "Gente linda"),
                ("Preciso de ajuda", "Me ajudem, por favorzinho"), ("Socorro", "Socorrinho"), ("rápido", "rapidinho"), ("um pouco", "um pouquinho"),
                ("Que pena", "Ownt, que pena"), ("Sinto muito", "Ain, sinto muito"), ("Entendido", "Tá bom"), ("Certo", "Certinho"),
                ("tropas", "tropinhas"), ("Não vou esquecer", "Fiquei muito magoad{a}"), ("Isso vai ter volta", "Isso não se faz, viu"),
                ("Guardei seu nome", "Anotei seu nome no caderninho"), ("Venha, então", "Vem, mas eu não queria briga não"),
                ("Perdi a batalha", "Buá, perdi a batalha"), ("Paciência", "Fazer o quê, né"), ("Boa,", "Aaaah boa,"), ("Mandou bem", "Arrasou"),
            ],
            Interjeicoes = ["ain", "ownt", "aaah", "eba", "uhuul", "aiai", "yay"],
            Girias = ["que amor", "fofura", "arrasou", "tô chateadinh{a}", "me ajuda vai", "por favorzinho"],
            ApelidosAmigos = ["lindeza", "flor", "meu bem", "coração", "fofura", "docinho", "amore"],
            ApelidosHostis = ["seu chato", "malvado", "seu feioso", "seu bobo"],
            Xingamentos = ["chato", "malvado", "feioso", "bobo", "mal-educado"],
            Fechos = [" ❤", " <3", " :)", " ^^", " hihi", " 🥺", " ✨"],
            Vicios = ["letra repetida no fim (simmm, obrigaduuu)", "diminutivo em tudo", "muitas exclamações!!", "carinha e coração no fim"],
            Evitar = ["palavrão", "ameaça séria", "frieza"],
            Exemplos = ["aiii gente, tão atacando {local}, alguém me ajuda? 🥺", "brigaduuu, vc é um amor ❤", "bem-vindinho!! aqui todo mundo se ajuda ^^"],
        },
        new()
        {
            Id = Nobre, Palavrao = "nenhum",
            Como = "Fala como nobre: educada, solene, meio arrogante, frases inteiras mas no ritmo de quem digita num chat. Ameaça com frieza e desprezo, sem palavrão. 'Por minha honra', 'senhor', 'Vossa'.",
            Trocas =
            [
                ("Oi,", "Saudações,"), ("Valeu", "Agradeço"), ("Obrigado", "Agradeço"), ("Obrigada", "Agradeço"), ("tudo certo", "tudo em ordem"),
                ("Não consigo", "Não me é possível"), ("Venha, então", "Venha, se tiver coragem"), ("Guardei seu nome", "Seu nome não será esquecido"),
                ("Isso vai ter volta", "Isso terá resposta"), ("Boa,", "Muito bem,"), ("Perdi a batalha em", "Fui derrotad{a} em"), ("Socorro", "Peço socorro"),
            ],
            Interjeicoes = ["Ora", "Pois bem", "Hm", "Francamente", "Veja bem"],
            Girias = ["por minha honra", "como convém", "não tolerarei", "a seu tempo", "Vossa Senhoria"],
            ApelidosAmigos = ["caro amigo", "nobre aliado", "meu caro", "estimado"],
            ApelidosHostis = ["plebeu", "verme", "rato de estrebaria", "bastardo", "insolente", "camponês"],
            Xingamentos = ["bastardo", "insolente", "plebeu", "canalha", "covarde", "rato de estrebaria"],
            Fechos = [" Por minha honra.", " Como convém.", " Passar bem."],
            Vicios = ["pontua um pouco mais que os outros, sem capricho", "acento quase nunca", "começa com maiúscula quando lembra", "não abrevia"],
            Evitar = ["gíria de internet", "kkk", "palavrão"],
            Exemplos = ["Seu ataque a {local} terá resposta, plebeu.", "Agradeço o reforço, nobre aliado. Não esquecerei.", "Pois bem. Venha, se tiver coragem."],
        },
        new()
        {
            Id = Antiga, Palavrao = "nenhum",
            Como = "Gente velha que fala à moda antiga, como senhor de castelo de outro século: 'vossa mercê', 'pelos antigos', 'que os ventos'. Inverte a frase, às vezes se perde ou repete. Ameaça com praga e maldição, não com palavrão.",
            Trocas =
            [
                ("você", "vossa mercê"), ("Você", "Vossa mercê"), ("Olá", "Salve"), ("Oi", "Salve"), ("Obrigado", "Grato fico"), ("Obrigada", "Grata fico"),
                ("Valeu", "Grat{o}"), ("muito", "deveras"), ("Muito", "Deveras"), ("agora", "nesta hora"), ("rápido", "ligeiro"), ("Não sei", "Não o sei"),
                ("Socorro", "Acudam"), ("Venha, então", "Venha, pois"), ("Isso vai ter volta", "Há de pagar por isso"), ("Guardei seu nome", "Vosso nome ficou gravado"),
            ],
            Interjeicoes = ["Ora pois", "Valha-me", "Por Deus", "Pelos antigos", "Arre", "Ai de mim"],
            Girias = ["pelos antigos", "que os ventos ajudem", "assim seja", "há de", "em boa hora", "no meu tempo"],
            ApelidosAmigos = ["meu bom", "estimado", "caro vizinho", "jovem", "meu filho"],
            ApelidosHostis = ["biltre", "velhaco", "patife", "cão sarnento", "mequetrefe"],
            Xingamentos = ["biltre", "velhaco", "patife", "sacripanta", "cão sarnento", "cretino", "mequetrefe", "canalha"],
            Fechos = [" Assim seja.", " Que os ventos ajudem.", " Pelos antigos."],
            Vicios = ["frase com inversão", "às vezes repete uma ideia", "não usa gíria nova", "não abrevia"],
            Evitar = ["kkk", "palavrão moderno", "emoji"],
            Exemplos = ["Salve, vossa mercê. Em boa hora chegou.", "Há de pagar por {local}, biltre. Assim seja.", "Acudam em {local}, que o {atacante} lá está!"],
        },
        new()
        {
            Id = Seca, Palavrao = "leve",
            Como = "Monossilábica. O mínimo de palavras, sem cumprimento, sem emoção aparente. Às vezes uma palavra só. Irritada, um palavrão curto e pronto.",
            Trocas =
            [
                ("Obrigado", "Vlw"), ("Obrigada", "Vlw"), ("Agradeço", "Vlw"), ("Entendido", "Ok"), ("Certo", "Ok"), ("Estou aqui", "Aqui"),
                ("Venha, então", "Vem"), ("Estou esperando", "Esperando"), ("Por aqui tudo certo", "Tudo ok"), ("Tudo em ordem", "Ok"),
            ],
            Interjeicoes = ["Hm", "Ok", "Tá"],
            Girias = ["ok", "vlw", "tá", "sim", "não"],
            ApelidosAmigos = [],
            ApelidosHostis = ["otário", "idiota"],
            Xingamentos = ["idiota", "otário", "imbecil", "merda"],
            Fechos = ["."],
            Vicios = ["sem saudação", "uma frase só", "às vezes só 'ok'", "ponto final seco"],
            Evitar = ["emoji", "exclamação", "textão", "carinho"],
            Exemplos = ["Indo.", "Ok.", "Vem.", "Sem tropa."],
        },
        new()
        {
            Id = Zoeira, Palavrao = "leve",
            Como = "Zoeira de chat: ri de tudo, kkkk, faz piada até apanhando, provoca o inimigo tirando sarro em vez de ameaçar sério. Gíria de internet.",
            Trocas =
            [
                ("Obrigado", "Valeuzão"), ("Obrigada", "Valeuzão"), ("Perdi a batalha", "Tomei um pau"), ("Ganhamos", "Amassamos"),
                ("Que pena", "F"), ("Paciência", "Faz parte kkk"), ("Socorro", "SOCORRO"), ("Estão atacando", "Tão me amassando em"), ("Olá", "Salve salve"),
                ("Oi", "Eae"), ("Venha, então", "Vem que tá fácil"), ("Isso vai ter volta", "Vai ter volta e vai ser engraçado"), ("Estou", "Tô"), ("estou", "tô"),
            ],
            Interjeicoes = ["kkkkk", "mano", "slk", "rapaz", "eita", "oxe", "hahaha", "mds", "pô"],
            Girias = ["tankou", "amassou", "passou vergonha", "chorou", "é os guri", "tá de brincadeira", "meu consagrado", "rodou"],
            ApelidosAmigos = ["mano", "brother", "chefia", "campeão", "meu consagrado", "patrão"],
            ApelidosHostis = ["noob", "bagre", "zé ruela", "mané", "trouxa", "pato"],
            Xingamentos = ["otário", "pato", "noob", "bagre", "trouxa", "mané", "zé ruela", "bocó"],
            Fechos = [" kkkkk", " kkk", " rs", " hahaha", " 🤣"],
            Vicios = ["kkkk no meio e no fim", "sem pontuação", "letra repetida (simmm)", "gíria de internet"],
            Evitar = ["seriedade demais", "ameaça pesada"],
            Exemplos = ["tomei um pau em {local} kkkk faz parte", "vem que tá fácil, noob", "valeuzão mano kkk"],
        },
        new()
        {
            Id = Desconfiada, Palavrao = "leve",
            Como = "Ressabiada. Fala pouco, com reticências, desconfia de tudo e de todos, devolve pergunta e nunca entrega informação. 'sei...', 'hm', 'por quê?'.",
            Trocas =
            [
                ("Certo", "Sei..."), ("Entendido", "Hm. Vamos ver"), ("Obrigado", "Obrigado... eu acho"), ("Obrigada", "Obrigada... eu acho"),
                ("Aceito", "Aceito. Por enquanto"), ("Topo", "Tá, mas tô de olho"), ("Tudo calmo", "Calmo até demais"), ("Bem-vindo", "Bem-vindo... vamos ver"),
                ("Vou pensar", "Vou pensar. Muito"), ("Recebi sua mensagem", "Recebi. E por que isso agora?"),
            ],
            Interjeicoes = ["hm", "sei...", "uhum", "olha...", "pois é..."],
            Girias = ["tô de olho", "sei não", "conta outra", "e o que você ganha com isso?", "aqui ninguém é bobo"],
            ApelidosAmigos = ["vizinho", "aliado"],
            ApelidosHostis = ["traíra", "cobra", "seu rato", "falso"],
            Xingamentos = ["traíra", "cobra", "falso", "safado", "rato", "sem-vergonha"],
            Fechos = ["...", " sei lá", " tô de olho"],
            Vicios = ["reticências", "pergunta de volta", "frase curta"],
            Evitar = ["entusiasmo", "contar o que tem", "confiar de cara"],
            Exemplos = ["hm. e por que tá me falando isso?", "sei... vamos ver", "tô de olho em vc, traíra"],
        },
        new()
        {
            Id = Calorosa, Palavrao = "leve",
            Como = "Amigável, acolhedora, animada: chama todo mundo pra perto, oferece ajuda, comemora junto. Solta um 'caramba', 'nossa' de empolgação. Brava, fica indignada, xinga leve.",
            Trocas =
            [
                ("Olá", "Opa, olá"), ("Obrigado", "Muito obrigado, de coração"), ("Obrigada", "Muito obrigada, de coração"), ("pessoal", "galera"),
                ("Pessoal", "Galera"), ("Boa,", "Boaaa,"), ("Que pena", "Poxa, que pena"), ("Sinto muito", "Poxa, sinto muito mesmo"),
                ("Estou", "Tô"), ("estou", "tô"), ("Isso vai ter volta", "Isso não fica assim não"),
            ],
            Interjeicoes = ["opa", "nossa", "caramba", "poxa", "eba", "bora", "eita"],
            Girias = ["tamo junto", "conta comigo", "bora", "que massa", "arrasou"],
            ApelidosAmigos = ["meu amigo", "querido", "irmão", "parceiro", "camarada"],
            ApelidosHostis = ["folgado", "sem noção", "cara de pau"],
            Xingamentos = ["safado", "cara de pau", "sem noção", "folgado", "droga"],
            Fechos = [" Abraço!", " Contem comigo!", " 💪", " Tamo junto!"],
            Vicios = ["exclamação", "chama pelo nome", "oferece ajuda sem ninguém pedir"],
            Evitar = ["frieza", "palavrão pesado"],
            Exemplos = ["opa, bem-vindo! precisando é só gritar", "poxa, sinto muito mesmo. precisa de pedra?", "tamo junto, mandei tropa pra {local}!"],
        },
        new()
        {
            Id = Comum, Palavrao = "leve",
            Como = "Jogador comum de chat: português do dia a dia, sem cerimônia, direto ao ponto, abrevia (vc, pq, tb, blz) e pontua mal. Irritado, solta 'droga', 'merda', 'saco'.",
            Trocas =
            [
                ("Obrigado", "Valeu"), ("Obrigada", "Valeu"), ("Entendido", "Blz"), ("Certo", "Fechou"), ("Olá", "Oi"), ("Saudações", "Oi"),
                ("Estou", "Tô"), ("estou", "tô"), ("Está", "Tá"), ("está", "tá"), ("Estão", "Tão"), ("estão", "tão"),
            ],
            Interjeicoes = ["opa", "ih", "vixe", "droga", "putz", "pô", "eita"],
            Girias = ["de boa", "suave", "fechou", "tranquilo", "deu ruim", "bora"],
            ApelidosAmigos = ["cara", "mano", "brother"],
            ApelidosHostis = ["otário", "babaca", "seu idiota"],
            Xingamentos = ["otário", "idiota", "imbecil", "merda", "babaca", "folgado", "saco"],
            Fechos = [" blz", " flw", " vlw"],
            Vicios = ["abrevia (vc, pq, tb, blz, msm)", "esquece acento", "sem ponto final"],
            Evitar = ["texto formal", "textão"],
            Exemplos = ["alguém tem pedra sobrando? preciso pra obra", "vlw cara, chegou certinho", "putz, perdi {local}"],
        },
    }.ToDictionary(v => v.Id);

    /// <summary>A voz da persona, pelos traços e pelo tom. A raiva vence o resto; depois o jeito de falar.</summary>
    public static Voz De(Persona p)
    {
        var id = p.Agressividade >= 0.7 || p.Temperamento == "colérico" ? BocaSuja
            : p.Tom == "arcaico" ? Antiga
            : p.Tom == "formal" || p.Temperamento == "altivo" ? Nobre
            : p.Sociabilidade >= 0.62 && p.Agressividade <= 0.42 && (p.Tom == "caloroso" || p.Temperamento == "jovial") ? Fofa
            : p.Temperamento == "desconfiado" ? Desconfiada
            : p.Tom == "brincalhão" ? Zoeira
            : p.Tom == "seco" ? Seca
            : p.Tom == "caloroso" ? Calorosa
            : Comum;
        return Todas[id];
    }

    /// <summary>Assuntos de briga: neles a voz xinga do jeito dela.</summary>
    public static bool AssuntoHostil(string tipo) => tipo is Falas.Ameaca or Falas.Desafio or Falas.Queixa;
    /// <summary>Assuntos de amizade: neles a voz pode chamar o outro pelo apelido.</summary>
    public static bool AssuntoAmigo(string tipo) => tipo is Falas.Agradecimento or Falas.BoasVindas or Falas.Parabens or Falas.Consolo or Falas.VouAjudar
        or Falas.RespostaMencao or Falas.NaoPossoAjudar or Falas.MandeiRecurso;

    private static readonly (string de, string para)[] GeneroFeminino =
        [("Obrigado", "Obrigada"), ("obrigado", "obrigada"), ("sozinho", "sozinha"), ("travado", "travada"), ("cansado", "cansada")];

    /// <summary>"{a}" e "{o}" pelo gênero de quem fala.</summary>
    public static string Genero(string t, bool feminina) => t.Replace("{a}", feminina ? "a" : "o").Replace("{o}", feminina ? "a" : "o");

    /// <summary>As trocas da voz, todas, por palavra inteira (a mesma frase sai sempre igual pela mesma voz).</summary>
    public static string Trocar(Voz v, string t, bool feminina)
    {
        foreach (var (re, para) in Compiladas[v.Id])
            t = re.Replace(t, Genero(para, feminina).Replace("$", "$$"));
        return t;
    }
    /// <summary>As trocas de cada voz já compiladas, da expressão mais longa para a mais curta.</summary>
    private static readonly Dictionary<string, (Regex re, string para)[]> Compiladas = Todas.Values.ToDictionary(v => v.Id,
        v => v.Trocas.OrderByDescending(x => x.de.Length).Select(x => (new Regex(@"(?<![\p{L}])" + Regex.Escape(x.de) + @"(?![\p{L}])", RegexOptions.CultureInvariant), x.para)).ToArray());

    /// <summary>
    /// A voz por cima de uma frase pronta dos modelos de texto: as trocas, às vezes uma interjeição no começo, o apelido
    /// do amigo no lugar do nome, o xingamento na briga e um fecho. Não mexe em pressa nem minúsculas (isso é da persona).
    /// </summary>
    public static string Aplicar(Persona p, ContextoFala c, string t, Rng s) => Aplicar(p, c, t, s, out _);

    /// <inheritdoc cref="Aplicar(Persona, ContextoFala, string, Rng)"/>
    /// <param name="fechou">A voz já arrematou a frase (xingamento ou fecho): quem chama não empilha bordão.</param>
    public static string Aplicar(Persona p, ContextoFala c, string t, Rng s, out bool fechou)
    {
        fechou = false;
        var v = De(p);
        // as frases dos modelos estão no masculino: quem fala é mulher, concorda
        if (p.Feminina)
            foreach (var (masc, fem) in GeneroFeminino)
                t = Regex.Replace(t, @"(?<![\p{L}])" + masc + @"(?![\p{L}])", fem);
        t = Trocar(v, t, p.Feminina);
        var hostil = AssuntoHostil(c.Tipo);
        // na amizade, às vezes chama pelo apelido em vez do nome (só na conversa: numa mensagem a outro reino, o nome)
        if (c.Canal == Falas.CanalAlianca && AssuntoAmigo(c.Tipo) && c.ParaReino is { Length: > 0 } para && v.ApelidosAmigos.Length > 0
            && t.Contains(para) && s.Chance(0.3))
            t = t.Replace(para, s.Escolher(v.ApelidosAmigos));
        // na briga, quem tem raiva xinga: a boca-suja quase sempre, o resto só se for agressivo
        if (hostil && v.ApelidosHostis.Length > 0 && !v.ApelidosHostis.Concat(v.Xingamentos).Any(x => t.Contains(x, StringComparison.OrdinalIgnoreCase))
            && s.Chance(v.Id == BocaSuja ? 0.8 : p.Agressividade > 0.55 ? 0.45 : 0.15)
            && t.Length + 24 < c.MaxCaracteres)
        {
            var x = s.Escolher(v.ApelidosHostis);
            t = t.EndsWith('?') || t.EndsWith('!') ? t + " " + char.ToUpperInvariant(x[0]) + x[1..] + "." : t.TrimEnd('.') + ", " + x + ".";
            fechou = true;
        }
        // interjeição no começo
        if (v.Interjeicoes.Length > 0 && s.Chance(v.Id is BocaSuja or Zoeira ? 0.4 : 0.22) && t.Length + 14 < c.MaxCaracteres)
        {
            var i = s.Escolher(v.Interjeicoes);
            var pontuada = i.EndsWith('.') || i.EndsWith('…');
            // "Porra, estão atacando": a primeira letra desce, salvo quando a frase começa por um nome ("Porra, Valdren...")
            var nome = (c.ParaReino is { Length: > 0 } pr && t.StartsWith(pr)) || c.Situacao.Values.Any(x => x.Length > 0 && t.StartsWith(x));
            t = pontuada ? i + " " + t : i + ", " + (!nome && t.Length > 1 && char.IsUpper(t[0]) && !char.IsUpper(t[1]) ? char.ToLowerInvariant(t[0]) + t[1..] : t);
            t = char.ToUpperInvariant(t[0]) + t[1..];
        }
        // fecho
        if (!fechou && v.Fechos.Length > 0 && s.Chance(0.25))
        {
            var f = s.Escolher(v.Fechos);
            if (t.Length + f.Length <= c.MaxCaracteres && !t.Contains(f.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                t = f.StartsWith(' ') && (f.Trim().StartsWith('.') || char.IsUpper(f.Trim()[0])) ? t + f : t.TrimEnd('.') + f;
                fechou = true;
            }
        }
        return Genero(t, p.Feminina);
    }

    // ---------------------------------------------------------------- reconhecer briga em texto de qualquer um

    /// <summary>Palavras e expressões que marcam uma mensagem como briga, venha de quem vier (jogador, LLM ou modelo).</summary>
    public static readonly string[] MarcasDeBriga =
    [
        "vou te pegar", "vai pagar", "vai se arrepender", "vou acabar com", "vou te destruir", "vou arrasar", "vou queimar", "cuidado comigo",
        "nao vai sobrar", "vai ter volta", "vou atras", "seus dias", "te esmagar", "vou invadir", "guerra", "vem que tem", "nao esquecerei",
        "nao vou esquecer", "ha de pagar", "tera resposta", "voce atacou", "tu atacou", "guardei seu nome", "guardei teu nome", "nao volta ninguem",
    ];
    private static readonly Regex Briga = new(
        @"(?<![\p{L}])(" + string.Join("|", Todas.Values.SelectMany(v => v.Xingamentos.Concat(v.ApelidosHostis))
            .Concat(MarcasDeBriga).Select(x => FalasPorModelo.SemAcento(x).ToLowerInvariant())
            .Where(x => x.Length >= 4 && x is not ("bobo" or "chato" or "falso" or "saco" or "droga" or "lixo"))   // fofo demais ou comum demais para ser briga
            .Distinct().OrderByDescending(x => x.Length).Select(Regex.Escape)) + @")(?![\p{L}])",
        RegexOptions.CultureInvariant);

    /// <summary>O texto tem xingamento ou ameaça?</summary>
    public static bool TemBriga(string texto) => Briga.IsMatch(FalasPorModelo.SemAcento(texto).ToLowerInvariant());
}

/// <summary>
/// Como gente digita em chat de jogo, com pressa: acento quase nunca, quase sem vírgula e sem ponto final, frases coladas,
/// e um erro de português ou de digitação de vez em quando, em palavra aleatória. A voz nobre e a antiga capricham um pouco
/// mais; quem tem pressa, menos. É o mesmo jeito que o contexto pede à LLM, aplicado aos modelos de texto.
/// </summary>
public static class Digitacao
{
    /// <summary>Erros comuns (palavra inteira): troca, junta ou come letra.</summary>
    public static readonly (string certo, string errado)[] Erros =
    [
        ("mas", "mais"), ("a gente", "agente"), ("de repente", "derrepente"), ("com certeza", "concerteza"), ("menos", "menas"),
        ("que", "q"), ("você", "vc"), ("porque", "pq"), ("também", "tbm"), ("mesmo", "msm"), ("agora", "agr"), ("depois", "dps"),
        ("obrigado", "obg"), ("obrigada", "obg"), ("beleza", "blz"), ("o que", "oq"), ("sei lá", "sla"), ("não", "naoo"), ("sim", "simmm"),
        ("ajuda", "ajudaa"), ("enxergar", "enchergar"), ("trouxe", "trousse"), ("seja", "seje"), ("onde", "aonde"), ("cadê", "cade"),
    ];

    public static string Aplicar(Persona p, Voz v, string t, Rng s)
    {
        // quanto ela relaxa ao digitar: quase todo mundo muito; nobre e antiga um pouco; a pressa soma
        var relaxo = Math.Clamp((v.Id is Vozes.Nobre or Vozes.Antiga ? 0.35 : 0.8) + p.Pressa * 0.4, 0, 1);
        // um erro de português ou de digitação, em uma palavra só
        if (s.Chance(0.35 * relaxo))
        {
            var cabem = Erros.Where(e => Regex.IsMatch(t, @"(?<![\p{L}])" + Regex.Escape(e.certo) + @"(?![\p{L}])", RegexOptions.IgnoreCase)).ToArray();
            if (cabem.Length > 0)
            {
                var (certo, errado) = s.Escolher(cabem);
                t = new Regex(@"(?<![\p{L}])" + Regex.Escape(certo) + @"(?![\p{L}])", RegexOptions.IgnoreCase).Replace(t, errado, 1);
            }
        }
        // letra trocada de lugar numa palavra comum (nome próprio, com maiúscula, fica)
        if (s.Chance(0.12 * relaxo))
        {
            var palavras = Regex.Matches(t, @"(?<![\p{L}])\p{Ll}{5,}(?![\p{L}])").ToArray();
            if (palavras.Length > 0)
            {
                var w = s.Escolher(palavras);
                var i = s.Int(1, w.Length - 2);
                var trocada = w.Value[..i] + w.Value[i + 1] + w.Value[i] + w.Value[(i + 2)..];
                t = t[..w.Index] + trocada + t[(w.Index + w.Length)..];
            }
        }
        if (s.Chance(0.75 * relaxo)) t = FalasPorModelo.SemAcento(t);
        if (s.Chance(0.6 * relaxo)) t = Regex.Replace(t, @"\s*,\s*", " ");
        // frases coladas: "Indo. Segura aí" vira "indo segura ai"
        if (s.Chance(0.5 * relaxo)) t = Regex.Replace(t, @"\.\s+(\p{Lu})", m => " " + char.ToLowerInvariant(m.Groups[1].Value[0]));
        if (s.Chance(0.85 * relaxo)) t = t.TrimEnd('.', ' ');
        return t.Trim();
    }
}
