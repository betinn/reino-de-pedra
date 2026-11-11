/* Reino de Pedra — modelo de balanceamento (aprovado; escala "pessoas no mapa", ver docs/plano-pessoas-no-mapa.md).
   Uso: node balanceamento/modelo.js > balanceamento/tabelas.md
   Sem dependências. Todos os números de jogo saem dos parâmetros abaixo; as metas no fim
   são verificadas a cada execução (✓ ou ✗). Mudar um parâmetro e rodar de novo mostra o efeito.

   Escala: cada pessoa do reino é um indivíduo com nome. Em relação à primeira versão do modelo, as pessoas (população,
   tropas, milícia, vagas de trabalho) valem cerca de 25× mais cada; os recursos (produção, custos de obras, estoques,
   carga) foram divididos por 10; o custo de uma unidade ficou em números de 1 ou 2 dígitos por recurso e o tempo de
   treino por pessoa subiu 4×, porque cada pessoa vale mais.

   Ritmo 3× (docs/decisoes/0038): o jogo anda como se estivesse acelerado em 3×, sem a variável REINO_ACELERACAO.
   - Dividido por 3: tempo de obras, recrutamento, ferraria, eras, cura, escavação, caça, rotas, veículos e deslocamento;
     e o que o mundo leva para se refazer (fauna que volta, hexágono de coleta que enche, vida que volta).
   - Multiplicado por 3: produção por hora, nascimentos, extração e coleta.
   - Em tempo real, porque é a vida do jogador: temporada, escudos, tréguas, convites, prazos de 24 h, pactos,
     "visto há X horas", janela do saque repetido. Cada local continua guardando 10 h da própria produção (a noite de
     quem joga), então guarda 3× mais; o armazém cresceu junto.
   - Nível máximo 11 (era 10) e custo ×2,18 por nível (era ×2,15): o jogador ativo fecha a economia perto do dia 20.
   - Batalha sem tempo fixo: dura conforme as tropas de quem perde e a desigualdade das forças. */
'use strict';

/* ================================================================ parâmetros */
const P = {
  temporadaDias: 70,
  /* produção por local (por hora) e crescimento por nível; nível máximo 10 */
  prodBase: 9, prodCresc: 1.30, nivelMax: 11,
  /* a serraria rende mais que os outros locais: as obras gastam 45% em madeira, e a madeira faltava sempre */
  fatorSerraria: 1.5,
  /* o castelo produz um pouco de cada recurso básico: o reino base sempre consegue recrutar */
  casteloBase: 7.5, casteloCresc: 1.12, casteloCusto: 4, casteloTempo: 2,   /* nenhum local passa do nível do castelo */
  /* custo da melhoria para o nível L (total de recursos) e tempo de obra */
  custoN2: 5, custoCresc: 2.18,
  tempoN2: 40, tempoCresc: 2.0,                         /* segundos */
  receita: { madeira: 0.45, pedra: 0.35, ferro: 0.10, comida: 0.10 },
  /* população (pessoas): teto do castelo e por moradia (uma pessoa nova por vez, com nome). Tropas ocupam o teto (moram
     no reino): cada soldado é um trabalhador a menos. Crescimento enquanto há espaço no teto: de popMinH a popMaxH pessoas
     por hora, mais rápido quanto mais espaço livre (popMinH + (popMaxH − popMinH) × livre/teto livre), +bonusComida com
     sobra de comida, nunca acima de popMaxH. O jogo nunca fica parado com espaço no teto. */
  tetoCastelo: 15, tetoPorMoradia: 3, popInicial: 8, custoMoradia: 40, moradiaPasso: 24,
  /* tempo de obra da moradia: tempoMoradia segundos, +10% a cada moradia já feita */
  tempoMoradia: 200, tempoMoradiaPasso: 0.1,
  popMinH: 3, popMaxH: 6, bonusComida: 0.30,
  /* vagas de trabalho de um local de produção no nível L: max(minimo, round(L × porNivel)). Uma vaga vazia produz menos
     (a produção do local é proporcional às vagas ocupadas). Referência do plano: 1 por nível com mínimo de 2; o modelo
     usa menos para a economia do jogador médio não ficar sem gente (metas M5d e M5g): 1 vaga até o nível 4, 2 do 5 ao 8, 3 do 9 ao 11. */
  vagas: { porNivel: 0.3, minimo: 1 },
  /* estoque inicial (kit) e capacidade de estoque de um local em horas de produção. Pedra 60 (era 40): o castelo 4 pede
     32 de pedra e, com 40, o reino novo travava nele por horas (meta M26) */
  kit: { madeira: 90, pedra: 60, comida: 90, ferro: 90 },
  estoqueHoras: 10,
  /* servidor: estoque mínimo do castelo por recurso (o castelo também guarda o excedente quando não há armazém),
     capacidade do armazém por recurso no nível L = capN1 × capCresc^(L−1), couro inicial do kit */
  estoqueMinimo: 600, armazem: { capN1: 600, capCresc: 1.35 }, kitExtra: { couro: 20 },
  /* reino novo com os primeiros passos já dados: ao fundar, o castelo e os 4 locais já estão no nível do início, com moradias
     prontas, uma guarnição pequena no castelo, exploradores prontos (um de cada tipo básico e um prospector) e o entorno do
     castelo já percorrido (raio em hexágonos). Quem entra tem o que fazer na hora: explorar, caçar, prospectar e enfileirar
     obras, sem passar a primeira hora esperando. Tropas e exploradores são pessoas além das popInicial civis e ocupam o teto. */
  inicio: { castelo: 2, locais: 2, moradias: 2, tropas: { lanceiro: 4, arqueiro: 2 }, exploradores: { pe: 1, cavalo: 1, prospector: 1 }, raioExplorado: 12 },
  /* servidor: carregadores da requisição (pessoas do local de origem, a pé, sem escolta; cada uma leva 30 num carrinho de mão,
     bem mais que os 5 da mochila de um soldado; com menos gente que o necessário o grupo faz mais viagens); rio sem ponte se atravessa pelo vau (× custo do terreno) */
  carregador: { carga: 30, vel: 'Lenta' }, rio: { vau: 2.0 },
  /* servidor: raio de visão (hexágonos) do castelo, dos locais e de marchas sem tropa (carregadores, caravana sem escolta);
     um exército enxerga com a maior U.visao do grupo e revela a névoa por onde passa e onde fica. Avistamentos somem depois de 10 h */
  visao: { castelo: 6, local: 4, tropa: 2 }, avistamentoH: 10,
  /* servidor: a névoa se abre ao vivo enquanto a marcha anda: um evento a cada revelacaoSeg segundos de jogo nos trechos que
     entram em névoa nunca vista, e o cliente busca o mapa a cada aviso. Ver docs/decisoes/0026. Com as marchas 3× mais
     rápidas, o intervalo caiu de 10 s para 4 s: a cavalaria anda 3 hexágonos nesse tempo e enxerga 4 */
  revelacaoSeg: 4,
  /* servidor: a linha que o jogador desenha para um percurso ou uma patrulha tem no máximo maxHexes hexágonos (≈ 30 min de
     tropa lenta por volta). Ver docs/decisoes/0029 */
  patrulha: { maxHexes: 200 },
  /* servidor: tamanho aproximado de uma força vista ("poucas" abaixo de poucas; depois, arredondado ao passo) */
  aproximado: { poucas: 4, passo: 5 },
  /* novos locais: custo e quando o jogador funda (médio) */
  custoNovoLocal: 150, novoLocalCresc: 1.22, tempoNovoLocal: 30 * 60,
  /* deslocamento: minutos por unidade de custo de terreno (tropa lenta ≈ 0,7 min por hexágono médio: 3 hexágonos em 2 min,
     reino vizinho em ≈ 16 min, travessia do mapa em ≈ 70 min). Ver docs/decisoes/0022 */
  /* desde a decisão 0026 (hexágono com metade do lado, mapa com 9× mais hexágonos), as tropas andam o dobro do que andavam:
     tropa lenta ≈ 10 s por hexágono médio, local vizinho (6 hexágonos) em ≈ 1 min, reino vizinho em ≈ 12 min, travessia em ≈ 53 min */
  /* ritmo 3×: um terço disso. Tropa lenta ≈ 3,4 s por hexágono médio, local vizinho em ≈ 20 s, reino vizinho em ≈ 4 min,
     travessia em ≈ 18 min */
  minPor: { Lenta: 0.125 / 3, 'Média': 0.083 / 3, 'Rápida': 0.05 / 3 },
  terreno: { planicie: 1, colina: 1.25, floresta: 1.8, montanha: 2.3, pantano: 2.8 },
  terrenoMedio: 1.35, rotaFator: 0.55,
  /* mundo: ≈ 277 hexágonos por reino; a célula de cada reino tem ≈ 17 de lado, e o castelo vizinho fica a ≈ 17 a 24 hexágonos */
  /* desde a decisão 0026: 312 × 240 hexágonos pequenos (metade do lado; o mundo é 1,5× maior que o de 104 × 80), ≈ 2.500 por
     reino; a célula de cada reino tem ≈ 50 de lado e o castelo vizinho fica a ≈ 50 a 72 hexágonos */
  reinos: 30, mapa: { cols: 312, lins: 240 }, vizinhoHex: 72,
  /* hexágonos que cada construção ocupa: 7 = o hexágono e o anel em volta (castelo); 3 = o hexágono e os vizinhos de leste e
     de oeste; 1 = só o hexágono. Nada se constrói nem se funda em cima de um hexágono ocupado. */
  ocupa: { castelo: 7, vila: 3, pasto: 3, serraria: 3, mina: 3, quartel: 3, armazem: 3, ferraria: 3, posto: 1 },
  /* geração do mapa (em hexágonos): tamanho das manchas de relevo e de umidade, um rio a cada hexPorRio hexágonos (fontes a
     rioLonge de outro rio, até rioPassos passos, no mínimo rioMin), anel dos locais iniciais em volta do castelo, jazidas a
     jazidaLonge e ruínas a ruinaLonge dos castelos, objetos a objLonge uns dos outros e o espaço buscado entre jazidas do
     mesmo tipo e entre ruínas */
  mapaGen: { relevo: 18, umidade: 14, hexPorRio: 2800, rioLonge: 12, rioPassos: 600, rioMin: 16, anelLocais: 4,
    jazidaLonge: 8, ruinaLonge: 10, objLonge: 4, jazidaEspaco: 28, ruinaEspaco: 24 },
  /* combate. Milícia: cada civil presente no local luta (miliciaPorPop = 1: todos), com defMilicia de defesa. Quando a defesa
     perde, só miliciaBaixas dos civis que lutaram morrem na proporção das perdas (os outros fogem para dentro das casas):
     um saque vitorioso não esvazia o local; o massacre é que mata de propósito. */
  expPerdas: 1.5, vantagem: 1.5, miliciaPorPop: 1, defMilicia: 15, miliciaBaixas: 0.25,
  portoes: [0, 1.15, 1.3, 1.45, 1.6, 1.75],               /* multiplicador de defesa do castelo por nível de portões */
  /* torres: 2 arqueiros no alto por nível (uma torre nível 1 defende como 4 lanceiros) */
  torre: { custoN1: 150, custoCresc: 1.8, tempoN1: 800, arqPorNivel: 2, bonusAlto: 3.0, alcance: n => 2 * (n + 1), nivelMax: 3, estrutura: 80 },
  portoesEstrutura: 100,                                   /* pontos de estrutura por nível de portão */
  /* saque */
  saqueQueda: 0.20, saqueMinimo: 0.20,
  /* relíquias */
  reliquia: { ataque: 0.15, producao: 0.15, resistencia: 0.20, escavarHoras1: 4, escavarMin: 4 / 3 },
  /* proteções */
  escudoNovatoH: 72, escudoExilioH: 24,
  /* legado: relíquias da temporada (+1% a +2% cada, até 3 equipadas, teto somado de 5%) */
  legado: { relMin: 0.01, relMax: 0.02, equipadas: 3, teto: 0.05 },
  /* fauna (força = soma de (ataque + defesa) / 2 do grupo): com o dobro do limite, passa ileso; acima do limite, risco um nível menor.
     Bandos de 2 a 6 animais: um explorador sozinho corre risco em qualquer nível; 2 lanceiros passam o perigo baixo; 12 arqueiros, o alto.
     Chance de ataque por região de fauna atravessada; num ataque, o grupo perde 5% (acima do limite) ou 25% (abaixo); explorador sozinho morre. */
  fauna: { baixo: 50, medio: 110, alto: 180 },
  ataqueFauna: { baixo: 0.10, medio: 0.25, alto: 0.50 }, perdaFauna: { acima: 0.05, abaixo: 0.25 }, faunaVoltaH: 8,
  /* caça: rendimento por bando abatido (o bando reaparece em 8 h); 7 min no local */
  caca: { javalis: { comida: 12, couro: 4, peles: 1, nivel: 'baixo' }, lobos: { comida: 5, couro: 3, peles: 4, nivel: 'alto' },
          ursos: { comida: 9, couro: 6, peles: 6, nivel: 'alto' }, crocodilos: { comida: 5, couro: 9, peles: 0, nivel: 'medio' } },
  cacasDia: 1,
  /* exploradores: pessoas do reino (ocupam 1 de população); força só conta contra fauna */
  exploradores: {
    pe:         { nome: 'A pé', custo: { comida: 40 }, tempo: 80, vel: 'Lenta', visao: 4, forca: 10 },
    cavalo:     { nome: 'A cavalo', custo: { comida: 60, couro: 15 }, tempo: 240, vel: 'Rápida', visao: 6, forca: 15 },
    prospector: { nome: 'Prospector', custo: { comida: 80, ferro: 40 }, tempo: 480, vel: 'Lenta', visao: 2, jazidas: 4, forca: 8 },
    batedor:    { nome: 'Batedor de elite', custo: { comida: 90, couro: 30 }, tempo: 640, vel: 'Rápida', visao: 6, forca: 20 }
  },
  /* rotas e pontes: custo por hexágono × fator do terreno; ponte sobre rio */
  rota: { custo: { madeira: 6, pedra: 4 }, tempo: 50 }, ponte: { custo: { madeira: 60, pedra: 40 }, tempo: 600 },
  /* espionagem: chance de o batedor ser visto ao espionar um local; visto: metade das vezes é capturado (sem relatório) */
  espiao: { base: 0.15, porTorre: 0.10, porTropa: 0.025, max: 0.60, capturado: 0.5, tempoNoLocal: 200 },
  /* alianças */
  alianca: 5,

  /* ---------- valiosos, comércio, ferraria e guerra ---------- */
  /* valor de referência em recursos básicos: orienta trocas, a IA comerciante e o limite do novato (não é preço fixo) */
  valor: { comida: 1, madeira: 1, pedra: 1, ferro: 1, couro: 2, peles: 2, sal: 6, ervas: 8, prata: 10, aco: 15, ouro: 20, gema: 30, cavalo: 40, minerio: 60 },
  /* jazidas finitas: cada jazida valiosa guarda 2 mil em valor; 1 de cada valioso para cada 3 reinos; minério raro: 1 para cada 6 */
  jazida: { valor: 2000, porReinos: 3, valorLendaria: 1200, lendariasPorReinos: 6 },
  /* extração (valor por hora): taxa × carga média × tropas^0,8; posto ×1,5; rota no caminho ×1,2; até 6 tropas por jazida */
  extracao: { taxa: 7.5, expTropas: 0.8, posto: 1.5, rota: 1.2, maxTropas: 6 },
  /* comércio: sem mercado global; IA comerciante compra a 85% e vende a 115% do valor, com o próprio estoque */
  comercio: { margemIA: 0.15, novatoDia: 600 },           /* reino sob escudo: diferença máxima por dia entre o que dá e recebe */
  pacto: { diasMin: 1, diasMax: 7, ativosMax: 3 },
  resgateH: 24, treguaSaidaH: 24,
  /* eras: a do ferro é a inicial */
  eras: {
    aco:   { nome: 'Era do Aço', req: 'ferraria nível 7', custo: { ouro: 8, ferro: 150, madeira: 120 }, tempo: 2 * 3600, dia: 4,
             libera: 'armas e armaduras dos níveis 2 e 3, cavaleiro de elite, equipamento lendário' },
    cerco: { nome: 'Era do Cerco Avançado', req: 'Era do Aço e quartel nível 8', custo: { ouro: 15, madeira: 400, pedra: 300, ferro: 150 }, tempo: 4 * 3600, dia: 7,
             libera: 'trebuchet e portões dos níveis 4 e 5' }
  },
  /* ferraria: armas (+ataque) e armaduras (+defesa) por família (infantaria, arqueiros, cavalaria); fila própria de até 10 */
  ferraria: {
    bonusNivel: 0.08, familias: 3, linhas: 2,
    niveis: [
      { custo: { ferro: 100, madeira: 50, couro: 15 }, tempo: 2400, req: 'ferraria nível 3' },
      { custo: { ferro: 350, madeira: 200, aco: 6 }, tempo: 2 * 3600, req: 'Era do Aço' },
      { custo: { ferro: 700, madeira: 350, aco: 15, ouro: 5 }, tempo: 4 * 3600, req: 'Era do Aço e ferraria nível 9' }
    ],
    linhasTipicas: 2                                        /* um reino típico leva 2 linhas ao nível 3 */
  },
  /* veterania (por pessoa): marca por vitória com perdas < 50% contra inimigo com pelo menos 30% da própria força */
  veterania: { marcas: [2, 5, 9], bonus: [0.05, 0.10, 0.15], perdasMax: 0.5, forcaMin: 0.3 },
  /* equipamento lendário: +25% de ataque ou defesa para um exército de até 8 tropas; 1 por reino */
  lendario: { bonus: 0.25, tropas: 8, custo: { minerio: 10, ferro: 150, aco: 10 }, tempo: 8 * 3600, req: 'Era do Aço e ferraria nível 8' },
  /* feridos: 30% das baixas de quem vence ou recua pela tática; 5 ervas curam 1; sem ervas em 24 h, morrem */
  feridos: { frac: 0.30, ervas: 5, esperaH: 24, curaH: 2 / 3 },
  /* teto da soma de bônus de combate (armas e armaduras, veterania, relíquia, lendário, legado) */
  tetoBonus: 0.50,
  /* queda do castelo com outros locais: a sede vai para o local de maior nível */
  queda: { nivel: 0.5, recursos: 0.5, populacao: 0.3, tropas: 0.4 },     /* tropas: suposição da simulação (mortas no cerco), não regra */
  /* mensageiro: leva mensagens a outros reinos; ocupa 1 de população; ninguém o ataca */
  mensageiro: { custo: { comida: 30 }, pop: 1, tempo: 80, vel: 'Rápida', caracteres: 200, recadoProposta: 120 },
  /* salgadeira (sal): o local de comida guarda 20 h em vez de 10 h */
  salgadeira: { custo: { sal: 20, madeira: 30 }, tempo: 1200, horas: 20 },
  /* recrutamento: o castelo treina as unidades básicas; o quartel treina todas */
  recrutaCastelo: ['milicia', 'lanceiro', 'arqueiro'],

  /* ---------- combate (servidor) ---------- */
  combate: {
    /* tática: limite de baixas para recuar (null = sem limite: lutam até cumprir ou cair) */
    taticas: { conservadora: 0.25, media: 0.40, agressiva: 0.60, semLimite: null }, taticaPadrao: 'media',
    /* duração da batalha: não há tempo fixo. Dura o que o lado mais fraco leva para cair:
         minSeg + porTropaSeg × tropas do lado mais fraco × (força menor / força maior)^expRazao, até maxSeg.
       Luta desigual acaba depressa (50 contra 1: o mínimo); forças parecidas e muita gente levam minutos (20 contra 20
       ≈ 4 min; o teto é de 10 min). É o tempo para o defensor mandar reforços e para qualquer lado recuar.
       O tempo real é menor: o ritmo acompanha quem sobra (com metade das tropas vivas, a batalha corre no dobro do ritmo). */
    batalha: { minSeg: 20, porTropaSeg: 12, expRazao: 1.5, maxSeg: 600 },
    saqueJanelaH: 24,                  /* saques ao mesmo local nesta janela contam para o rendimento decrescente (saqueQueda) */
    massacrePorTropa: 1,               /* no massacre, cada tropa que sobrevive mata até 1 pessoa do local */
    sabotagemMaxNiveis: 3,             /* níveis que uma sabotagem pode derrubar de uma vez (o protótipo vai até 3) */
    /* quantidades padrão dos objetivos (ataque rápido e "Adicionar"); o recurso padrão usa a carga das tropas */
    objPadrao: { construcao: 1, populacao: 3, portoes: 1, torre: 1 },
    guardarBatalhaH: 24,               /* a batalha encerrada fica visível por 24 h (tela de batalha, gráfico) */
    /* portões do castelo: custo do nível n = custoN1 × custoCresc^(n−1), dividido pela receita; tempo = tempoN1 × n.
       Nível 1 ≈ 100 (pouco menos que uma torre nível 1, 150): ×1,15 na defesa do castelo inteiro vale mais que 2 arqueiros no alto.
       Acima de nivelSemEra (3) exige a Era do Cerco Avançado. */
    portao: { custoN1: 100, custoCresc: 2.0, tempoN1: 1200, nivelSemEra: 3, receita: { pedra: 0.5, madeira: 0.3, ferro: 0.2 } }
  },
  /* ---------- exploração, fauna, caça, rotas e espionagem (servidor) ---------- */
  /* explorador: a pé não sente floresta nem pântano (fator 1, como planície); a cavalo leva ×1,5 em floresta e montanha.
     Com escolta, o grupo anda como tropa (sem ajuste) na velocidade do mais lento. */
  exploracaoServ: {
    semPenalidade: { pe: ['floresta', 'pantano'] }, penalidade: { cavalo: { floresta: 1.5, montanha: 1.5 } },
    /* captura de explorador SEM escolta que passa no alcance de visão de uma guarnição (ou exército parado) de outro reino:
       chance = base + porTropa × tropas que o veem, até max (4 lanceiros ≈ 25%). Batedor de elite é furtivo (×0 ao passar). */
    captura: { base: 0.05, porTropa: 0.05, max: 0.5, furtivo: 0 }
  },
  /* fauna gerada com o mundo: 2 regiões por reino (raio 1 ou 2, centros a 4+ hexágonos uns dos outros, longe 2+ dos castelos).
     Nível base = o da caça do animal, com 25% de chance de um nível abaixo e 25% acima. A até 3 hexágonos de um castelo
     inicial (o que o castelo vê), sempre baixo. O bando muda de hexágono dentro da região a cada 1 h a 1 h 40. Tamanho do bando (animais desenhados no mapa). */
  faunaServ: {
    regioesPorReino: 2, raio: [2, 4], distanciaMin: 8, longeCastelo: 4, pertoReino: 6, variacao: 0.25, moverH: [1, 5 / 3],
    bando: { lobos: [2, 6], javalis: [2, 5], ursos: [1, 2], crocodilos: [2, 4] },
    /* carregadores sem escolta: força 5 por pessoa (gente sem armas, metade de uma milícia) */
    forcaCarregador: 5,
    /* rota segura: minutos extras por hexágono conforme o risco que o grupo correria ali (desvio vale a pena até ≈ 4 hexágonos) */
    custoSeguro: { baixo: 1 / 3, medio: 1, alto: 10 / 3 }
  },
  cacaMin: 7                                               /* minutos no local da caçada */,

  /* ---------- guerra: exílio, interceptação, posturas e modelos de ataque (servidor) ---------- */
  guerra: {
    /* exílio (o reino perdeu todos os locais): só um castelo nível 1 num ponto novo, com este kit, 2 milicianos
       e 6 pessoas (metade do teto do castelo: recomeça menor que um reino novo, 8). O ponto sai da metade mais
       distante (longe) dos pontos livres, medida a partir dos locais de quem derrubou o reino. */
    exilio: { kit: { madeira: 80, pedra: 50, comida: 100, ferro: 20 }, tropas: { milicia: 2 }, pop: 6, longe: 0.5 },
    /* interceptação: as tropas precisam chegar ao ponto de encontro pelo menos 20 s antes de a marcha passar */
    /* trechoHexes: quantos hexágonos à frente da marcha valem como ponto de encontro (o resto do caminho é segredo) */
    interceptacao: { folgaSeg: 20, trechoHexes: 30 },
    /* posturas automáticas: quem "ataca qualquer ameaça" sai contra forças hostis que passam a até 1 hexágono (a visão de tropa);
       quem "ataca apenas quem atacar" revida contra o reino que atacou nos seus locais ou exércitos na última 1 h (a volta do ataque) */
    postura: { alcance: 2, revidaH: 1 },
    /* modelos de ataque guardados por reino (o mesmo limite da fila) e tamanho do nome */
    modelosMax: 10, modeloNome: 30
  },
  /* ---------- relíquias, extração e caravanas (servidor) ---------- */
  /* veículos: tempo de construção (s) de cada um, na fila de obras do castelo, onde ficam (os do protótipo: 5 e 15 min) */
  veiculo: { tempo: { carroca: 100, carrocao: 300 } },
  /* caravana (e escolta de relíquia) pouco protegida: força da escolta, soma de (ataque + defesa)/2, abaixo do limite do perigo
     médio da fauna (110). 4 lanceiros (130) já bastam; 2 lanceiros (65), não. É só um aviso: ninguém é impedido de enviar. */
  caravana: { escoltaMin: 110 },
  /* posto de extração (ou de escavação): obra opcional no hexágono da jazida ou da ruína */
  posto: { custo: { madeira: 35, pedra: 20 }, tempo: 400 },
  /* "rota no caminho" da extração (×extracao.rota): pelo menos metade dos hexágonos do caminho até o depósito é rota pública */
  extracaoRotaFrac: 0.5,
  /* visibilidade das relíquias guardadas no mesmo local: a partir de 2, brilho para quem já explorou a área;
     a partir de 3, farol para todos, até na névoa (1 relíquia: só a espionagem revela) */
  reliquiaVis: { farol: 3 },
  /* o transporte manual aparece ao fundar o primeiro local a mais de 8 hexágonos do castelo (fora da vista dele, raio 6) */
  logisticaLongeHex: 8,
  /* ---------- ferraria, eras e equipamento lendário (servidor) ---------- */
  /* Os requisitos de eras.req, ferraria.niveis[].req e lendario.req, na forma que o servidor confere:
     era = era já pesquisada; ferraria / quartel = nível mínimo do maior local desse tipo no reino.
     Famílias com armas e armaduras (o cerco não tem); a milícia é infantaria (U.milicia.fam).
     lendarioPorReino: quantos cada reino forja na temporada (capturar o de outro não conta). */
  ferrariaServ: {
    eras: { aco: { ferraria: 7 }, cerco: { era: 'aco', quartel: 8 } },
    niveis: [{ ferraria: 3 }, { era: 'aco' }, { era: 'aco', ferraria: 9 }],
    lendario: { era: 'aco', ferraria: 8 },
    familias: ['infantaria', 'arqueiros', 'cavalaria'],
    lendarioPorReino: 1
  },
  /* ---------- social (servidor) ---------- */
  /* alianças (até P.alianca reinos; P.treguaSaidaH de trégua ao sair), conversa, mensagens, propostas e bandeiras */
  social: {
    conselheiros: 2,                                       /* conselheiros por aliança: convidam e aceitam pedidos de entrada */
    nomeAlianca: { min: 3, max: 24 },                      /* letras do nome da aliança */
    /* conversa da aliança: até 200 caracteres por mensagem; guarda as 200 últimas linhas (falas e eventos da aliança); recado
       fixado do líder com até 120 caracteres; o mesmo pedido de reforço para o mesmo local só se repete depois de 5 min */
    conversa: { caracteres: 200, guardar: 200, recado: 120, repetirPedidoSeg: 300 },
    caixa: 100,                                            /* mensagens por mensageiro guardadas por reino (as mais antigas saem) */
    propostaH: 24,                                         /* convites, pedidos de entrada e de recursos, trocas e pactos sem resposta expiram em 24 h */
    novatoJanelaH: 24,                                     /* o "dia" do limite do novato (P.comercio.novatoDia) é uma janela móvel de 24 h */
    bandeiras: { ativas: 20, minimo: 3, caracteres: 60 }   /* por reino: até 20 ativas; recado de 3 a 60 caracteres */
  },
  /* ---------- temporada, legado, ranking e "precisa de você" (servidor) ---------- */
  temporadaServ: {
    /* linhagem: começa em 1, +1 por temporada jogada (ativo, isto é, abriu o jogo, em pelo menos diasAtivos dias) e +1 por relíquia
       da temporada ganha, até o máximo. Desbloqueios por nível: opções e cosméticos, nunca poder. */
    linhagem: { inicial: 1, max: 10, diasAtivos: 30 },
    desbloqueios: { brasoes: 2, titulos: 3, regiao: 5, exilio: 7, moldura: 10 },
    /* relíquias da temporada (entre P.legado.relMin e relMax): top 3 de baixas, tropas ou famílias (perdas não contam) pela posição;
       terminar com relíquia lendária em seu poder; ter vencido um cerco a um castelo. Uma por conquista. */
    rankingTop: 3,
    bonusPos: [0.02, 0.015, 0.01], bonusLendaria: 0.015, bonusCerco: 0.015,
    /* que bônus cada conquista dá e o título que acompanha */
    conquistas: {
      baixas: { tipo: 'ataque', reliquia: 'Espada Rubra', titulo: 'Flagelo dos Exércitos' },
      tropas: { tipo: 'defesa', reliquia: 'Elmo da Guarda', titulo: 'Senhor das Hostes' },
      familias: { tipo: 'crescimento', reliquia: 'Cálice da Fartura', titulo: 'Pai do Povo' },
      lendaria: { tipo: 'producao', reliquia: 'Selo do Guardião', titulo: 'Guardião de Relíquia' },
      cerco: { tipo: 'ataque', reliquia: 'Aríete de Bronze', titulo: 'Sitiante' }
    },
    /* títulos da linhagem (aparecem ao chegar no nível; só podem ser usados a partir de desbloqueios.titulos) */
    titulosLinhagem: [{ nivel: 3, nome: 'Herdeiro da Pedra' }, { nivel: 5, nome: 'Senhor de Terras' }, { nivel: 7, nome: 'Casa Antiga' }, { nivel: 10, nome: 'Linhagem Lendária' }],
    /* centro de cada região (fração de colunas e linhas do mapa) para escolher a vaga inicial (nível 5) e o exílio (nível 7) */
    regioes: { norte: [0.5, 0.12], sul: [0.5, 0.88], leste: [0.88, 0.5], oeste: [0.12, 0.5], centro: [0.5, 0.5] },
    /* reinos de IA sorteiam o brasão como um jogador veterano às vezes (cores e formas extras, moldura), para não se distinguirem */
    iaExtras: 0.35, iaMoldura: 0.04
  },
  /* "precisa de você": limites para listar (sem tique; calculado a cada GET /agora) */
  agoraServ: {
    escudoH: 12,              /* escudo acabando: menos de 12 h */
    feridosUrgenteH: 6,       /* feridos que morrem em menos de 6 h ficam no grupo "agora" */
    popTeto: 0.95,            /* população (civil + tropas) a 95% do teto */
    estoqueCheio: 0.98,       /* local de produção com o estoque a 98% da capacidade: a produção para */
    armazem: 0.9,             /* armazém a 90% */
    maxPorTipo: 3             /* no máximo 3 itens de cada tipo (jazidas, ruínas, estoques...) */
  },
  /* ---------- reinos de IA, meta de ocupação e IA comerciante (servidor) ---------- */
  /* Meta de ocupação: a temporada começa com 25 reinos de IA (dos P.reinos) e o mundo nunca fica com menos de 20 reinos
     ativos (jogadores + IA); abaixo disso, surge um reino de IA na vaga livre mais longe dos jogadores ativos. Quem entra usa
     uma vaga livre; sem vaga, o reino de IA de menor porte abdica (castelo em ruína, os outros locais viram terra livre).
     Os ids dos reinos e dos 5 locais iniciais saem de um sorteio entre idsPorReino × reservaReinos números reservados na
     primeira subida: a ordem dos ids não revela quem entrou junto com a temporada. */
  ia: {
    inicial: 25, minimo: 20, reservaReinos: 90, idsPorReino: 6,
    /* sessões: hora local (fuso em horas de UTC) com variação sorteada de até ±40 min em cada uma */
    fusoH: -3, variacaoMin: 40,
    /* habilidade = as regras de decisão da simulação (medio e ativo são os PERFIS do modelo; fraco entra menos e escolhe pior).
       Novos locais: até 4 + 1 a cada locaisCadaDias dias, no máximo locaisMax. acerto: chance de escolher a obra de melhor
       retorno (senão, uma qualquer das candidatas). arqueiros: fração do recrutamento em arqueiros (limitada pelo couro). */
    habilidades: {
      fraco: { sessoes: [9, 14, 21], militar: 0.25, mantemTrab: 1.0, fracTropas: 0.30, horizonte: 8, horizonteNoite: 12, locaisCadaDias: 5, locaisMax: 12, acerto: 0.6, arqueiros: 0.2 },
      medio: { sessoes: [8, 13, 19, 23], militar: 0.30, mantemTrab: 1.0, fracTropas: 0.35, horizonte: 6, horizonteNoite: 10, locaisCadaDias: 4, locaisMax: 14, acerto: 0.9, arqueiros: 0.25 },
      ativo: { sessoes: [7, 9, 11, 13, 16, 19, 21, 23], militar: 0.42, mantemTrab: 0.95, fracTropas: 0.5, horizonte: 3, horizonteNoite: 9, locaisCadaDias: 3, locaisMax: 18, acerto: 1.0, arqueiros: 0.3 }
    },
    locaisBase: 4, obrasPorSessao: 12,
    /* moradia quando faltam trabalhadores (população < 1,1 × os necessários) e o teto está cheio (população + tropas > 90%), como na simulação */
    moradia: { trabalhadores: 1.1, teto: 0.9 },
    /* armazém (o modelo não tem limite por recurso; o servidor tem): funda ou melhora um armazém quando a próxima melhoria do
       castelo pede de algum recurso mais que 80% do que o reino consegue guardar dele */
    armazem: { folga: 0.8 },
    pesosHabilidade: { fraco: 0.3, medio: 0.5, ativo: 0.2 },
    /* perfis: multiplicam locais e militar da habilidade; ataca (saques a alvos espionados), ocupa (ruínas e terra livre à
       vista), espiona (batedor de elite), torres (quantas perto do castelo), prospecta (prospector e extração), comercia
       (margem P.comercio.margemIA; os outros perfis exigem margemOutros × essa margem) */
    perfis: {
      expansionista: { peso: 0.3, locais: 1.25, militar: 0.9, ataca: false, ocupa: true, espiona: false, torres: 0, prospecta: true, comercia: false },
      defensivo: { peso: 0.25, locais: 0.9, militar: 1.1, ataca: false, ocupa: false, espiona: false, torres: 2, prospecta: false, comercia: false },
      saqueador: { peso: 0.25, locais: 0.9, militar: 1.25, ataca: true, ocupa: false, espiona: true, torres: 0, prospecta: false, comercia: false },
      comerciante: { peso: 0.2, locais: 1.0, militar: 0.85, ataca: false, ocupa: false, espiona: false, torres: 1, prospecta: true, comercia: true }
    },
    /* ataque: só com castelo 3+, contra local espionado há até 24 h, a até 28 hexágonos (os alcances em hexágonos da IA cresceram
       ×1,75 com o mapa de 104 × 80, a mesma escala linear: ver docs/decisoes/0022), cujo dono não está sob escudo e não é
       muito menor (maior nível conhecido dele ≥ 60% do nosso castelo); vai com 60% das tropas de ataque do castelo (ficam pelo
       menos 3) se a força de ataque passar de 2,5× a defesa estimada (guarnição como lanceiros, torres e milícia); um ataque por vez */
    /* vigiaAlcance: exército de outro reino vindo a até este alcance de um local segura as tropas em casa */
    ataque: { castelo: 3, espionagemH: 24, alcance: 84, porte: 0.6, forca: 2.5, fracTropas: 0.6, reserva: 3, tatica: 'conservadora', vigiaAlcance: 14 },
    /* espionagem: batedor a partir do castelo 4, alvo a até 28 hexágonos, cada local de novo só depois de 24 h */
    espionagem: { castelo: 4, alcance: 84, refazerH: 24 },
    /* ocupação de ruína ou terra livre à vista, a até 14 hexágonos, com 3 lanceiros */
    ocupacao: { alcance: 42, tropas: 3 },
    /* exploração: um explorador a pé, mandado a um hexágono ainda não visto a 4 a 16 hexágonos do castelo (6 tentativas de sorteio) */
    exploracao: { distancia: [8, 48], tentativas: 6 },
    /* caça enquanto o couro guardado está abaixo de 40 (um batedor de elite custa 30; com o teto antigo de 10 a IA nunca juntava couro
       para espionar, e sem espionagem não atacava): 4 lanceiros, região conhecida a até 10 hexágonos, só se passam ilesos */
    caca: { couroMin: 40, alcance: 30, tropas: 4 },
    /* extração: prospector a partir do castelo 5; 4 lanceiros numa jazida conhecida a até 17 hexágonos */
    extracao: { castelo: 5, alcance: 51, tropas: 4 },
    /* defesa durante a sessão: reforça um local em batalha com metade das tropas livres do castelo; a defesa recua se a força
       dela cair abaixo de metade da do ataque */
    defesa: { reforco: 0.5, recuo: 0.5 },
    /* comércio: os perfis não comerciantes pedem margemOutros × P.comercio.margemIA; ninguém troca mais que metade do que guarda */
    comercio: { margemOutros: 2, reserva: 0.5 }
  },
  /* ---------- vida das pessoas e fauna como dano (servidor) ---------- */
  /* Cada pessoa tem vida (máximo por ofício; civis usam "civil", o resto sem entrada usa "padrao") que volta inteira em
     recuperaH horas, sem tique (o servidor guarda o dano e o instante). Um ataque de fauna no caminho não mata mais na hora:
     cada animal do bando ataca uma pessoa diferente do grupo e tira golpe[risco] × (1 ± variacao) de vida (risco = o nível
     efetivo para a força do grupo, a mesma regra de antes); morre só quem chega a zero, e os feridos seguem andando.
     O explorador sozinho e rápido (a cavalo, batedor) foge do bando com a chance de fuga, sem dano. Carregadores e
     remessas (gente desarmada dentro do reino) fogem: perdem carga (perdaFauna), não vida. A caçada continua com a regra de
     perdas (é uma luta até o fim). Numa batalha, quem sobrevive perde vida na proporção das perdas do próprio lado
     (× batalha da vida máxima), sem morrer por isso: quem morre continua saindo da fórmula de perdas. */
  vida: {
    max: { civil: 60, padrao: 100, milicia: 70, lanceiro: 110, arqueiro: 90, cavalaria: 110, elite: 130, ariete: 90, trebuchet: 90,
           'explorador-pe': 80, 'explorador-cavalo': 80, prospector: 70, batedor: 90, mensageiro: 70 },
    recuperaH: 2,
    repousoPorMin: 0.30,   /* soldado no próprio castelo, fora de batalha: 30% da vida máxima por minuto (cheia em pouco mais de 3 min) */
    golpe: { baixo: 20, medio: 40, alto: 70 }, variacao: 0.5,
    fuga: { cavalo: 0.6, batedor: 0.6 },
    batalha: 0.8
  },
  /* ---------- coleta de madeira e pedra no mapa (servidor) ---------- */
  /* Ordem "coletar": tropas e civis sem trabalho cortam árvores (floresta → madeira) ou quebram pedra (colina e montanha →
     pedra) num hexágono explorado sem local. Ritmo do grupo por hora = taxa × pessoas^expPessoas (até maxPessoas por
     hexágono e por reino; rende menos por pessoa quanto mais gente). Um civil leva cargaCivil num feixe ou cesto; um soldado,
     a carga da unidade. Cheia a carga, o grupo leva ao local próprio mais próximo que guarda o recurso (castelo, armazém ou
     o local de produção dele) e, com "repetir", volta (ou vai a um hexágono igual a até vizinhos de distância, se este
     acabou). Cada hexágono guarda estoque e se recupera inteiro em recuperaH horas; abaixo de minimo, não vale a viagem.
     IA: coleta quando falta madeira ou pedra para a próxima obra, num hexágono sem fauna conhecida a até alcance do
     castelo, com os civis sem trabalho (sem eles, até tropas lanceiros). */
  coleta: {
    terrenos: { floresta: 'madeira', colina: 'pedra', montanha: 'pedra' },
    taxa: 12, expPessoas: 0.8, maxPessoas: 6, cargaCivil: 10,
    estoque: 60, recuperaH: 8, vizinhos: 4, minimo: 5,   /* vizinhos e alcance da IA na escala de hexágonos da decisão 0026 */
    ia: { alcance: 12, tropas: 2 }
  }
};

/* unidades: atk, def, velocidade, carga (recursos; uma pessoa leva ≈ 5), visão (raio de névoa que revela em marcha), custo, tempo (s), população.
   Cada unidade é uma pessoa (máquinas de cerco: a equipe que a opera). O tempo é o treino de uma pessoa. */
/* fam: família para armas, armaduras e vantagens; vence: família que a unidade domina */
const U = {
  milicia:   { nome: 'Milícia',   fam: 'infantaria', atk: 5,  def: 15, vel: 'Lenta',  carga: 3,  visao: 2, custo: { comida: 20, madeira: 10 }, tempo: 40, pop: 1, so: 'defesa' },
  lanceiro:  { nome: 'Lanceiro',  fam: 'infantaria', atk: 25, def: 40, vel: 'Lenta',  carga: 5,  visao: 2, custo: { comida: 30, madeira: 30, ferro: 30 }, tempo: 240, pop: 1, vence: 'cavalaria' },
  arqueiro:  { nome: 'Arqueiro',  fam: 'arqueiros',  atk: 35, def: 25, vel: 'Média',  carga: 5,  visao: 4, custo: { comida: 30, madeira: 50, couro: 10 }, tempo: 280, pop: 1, vence: 'infantaria' },
  cavalaria: { nome: 'Cavalaria', fam: 'cavalaria',  atk: 45, def: 30, vel: 'Rápida', carga: 10, visao: 4, custo: { comida: 60, ferro: 50, couro: 30 }, tempo: 480, pop: 1, vence: 'arqueiros' },
  elite:     { nome: 'Cavaleiro de elite', fam: 'cavalaria', atk: 60, def: 40, vel: 'Rápida', carga: 10, visao: 4, custo: { comida: 70, ferro: 60, couro: 40, cavalo: 1 }, tempo: 640, pop: 1, vence: 'arqueiros', req: 'Era do Aço' },
  ariete:    { nome: 'Aríete',    fam: 'cerco', atk: 10, def: 10, vel: 'Lenta',  carga: 0,  visao: 2, custo: { madeira: 60, ferro: 15 }, tempo: 1200, pop: 1, cerco: 40 },
  trebuchet: { nome: 'Trebuchet', fam: 'cerco', atk: 5,  def: 5,  vel: 'Lenta',  carga: 0,  visao: 2, custo: { madeira: 90, pedra: 40, ferro: 30 }, tempo: 2400, pop: 1, cerco: 90, req: 'Era do Cerco Avançado' }
};
const NOME_FAM = { infantaria: 'Infantaria', arqueiros: 'Arqueiros', cavalaria: 'Cavalaria', cerco: 'Cerco' };
const VEICULOS = { carroca: { carga: 60, vel: 'Lenta', custo: { madeira: 15, ferro: 2 } }, carrocao: { carga: 180, vel: 'Média', custo: { madeira: 40, ferro: 8, cavalo: 2 } } };

/* ================================================================ fórmulas */
const soma = o => Object.values(o).reduce((s, v) => s + v, 0);
const r0 = v => Math.round(v), r1 = v => Math.round(v * 10) / 10;
const prod = L => P.prodBase * Math.pow(P.prodCresc, L - 1);
const castelo = L => P.casteloBase * Math.pow(P.casteloCresc, L - 1);
const custo = L => P.custoN2 * Math.pow(P.custoCresc, L - 2);          /* para subir ao nível L (L ≥ 2) */
const tempoObra = L => P.tempoN2 * Math.pow(P.tempoCresc, L - 2);       /* segundos */
const payback = L => custo(L) / (prod(L) - prod(L - 1));                 /* horas */
const receita = total => Object.fromEntries(Object.entries(P.receita).map(([k, f]) => [k, r0(total * f) ]));
const vagas = L => Math.max(P.vagas.minimo, Math.round(L * P.vagas.porNivel));   /* vagas de trabalho de um local de produção */
const custoMoradia = n => P.custoMoradia + P.moradiaPasso * n;                  /* n = moradias já construídas */
const tempoMoradia = n => P.tempoMoradia * (1 + P.tempoMoradiaPasso * n);
/* duração da batalha (s), sem contar baixas: tropas do lado mais fraco e razão entre a força menor e a maior */
const duracaoBatalha = (tropasFraco, razao) => { const b = P.combate.batalha; return Math.min(b.maxSeg, b.minSeg + b.porTropaSeg * Math.max(0, tropasFraco) * Math.pow(Math.max(0, Math.min(1, razao)), b.expRazao)); };
const viagemMin = (hexes, vel, rota) => hexes * P.terrenoMedio * (rota ? P.rotaFator : 1) * P.minPor[vel];
const forcaFauna = g => Object.entries(g).reduce((s, [k, n]) => s + n * (U[k].atk + U[k].def) / 2, 0);
const valorDe = c => Object.entries(c).reduce((s, [k, v]) => s + v * (P.valor[k] || 1), 0);   /* custo em valor de referência */
const basicosDe = c => Object.entries(c).filter(([k]) => TIPOS_BASICOS.includes(k)).reduce((s, [, v]) => s + v, 0);
const TIPOS_BASICOS = ['comida', 'madeira', 'pedra', 'ferro'];
const qtdFam = (g, fam) => Object.entries(g).reduce((s, [k, n]) => s + (U[k].fam === fam ? n : 0), 0);
/* extração: valor por hora de um grupo numa jazida */
function extracaoH(g, posto, rota) {
  const n = Math.min(P.extracao.maxTropas, soma(g)); if (!n) return 0;
  const carga = Object.entries(g).reduce((s, [k, q]) => s + q * U[k].carga, 0) / soma(g);
  return P.extracao.taxa * carga * Math.pow(n, P.extracao.expTropas) * (posto ? P.extracao.posto : 1) * (rota ? P.extracao.rota : 1);
}
const bonusCom = b => 1 + Math.min(P.tetoBonus, b || 0);                       /* soma de bônus com teto */
/* coleta de básicos no mapa: unidades por hora de um grupo de n pessoas (soldados e civis) */
const coletaH = n => { const k = Math.min(P.coleta.maxPessoas, n); return k > 0 ? P.coleta.taxa * Math.pow(k, P.coleta.expPessoas) : 0; };
/* vida máxima de uma pessoa pelo ofício */
const OFICIOS_CIVIS = ['ocioso', 'agricultor', 'lenhador', 'pedreiro', 'mineiro'];
const vidaMax = oficio => P.vida.max[oficio] != null ? P.vida.max[oficio] : OFICIOS_CIVIS.includes(oficio) ? P.vida.max.civil : P.vida.max.padrao;
/* chance de um golpe de fauna do risco dado tirar pelo menos v de vida (dano uniforme entre golpe × (1 − variação) e × (1 + variação)) */
function chanceGolpeMata(risco, v) {
  const g = P.vida.golpe[risco], a = g * (1 - P.vida.variacao), b = g * (1 + P.vida.variacao);
  return v >= b ? 0 : v <= a ? 1 : (b - v) / (b - a);
}

/* combate: valor de ataque contra valor de defesa; o vencedor perde (menor/maior)^1,5;
   vantagem 1,5× quando a unidade vence o tipo que domina o outro lado */
function valorAtaque(grupo, defesaGrupo, bonus) {
  const totDef = soma(defesaGrupo) || 1;
  return Object.entries(grupo).reduce((s, [k, n]) => {
    const u = U[k], frac = u.vence ? qtdFam(defesaGrupo, u.vence) / totDef : 0;
    return s + n * u.atk * (1 + (P.vantagem - 1) * frac);
  }, 0) * bonusCom(bonus);
}
function valorDefesa(grupo, ataqueGrupo, extra) {
  const totAtk = soma(ataqueGrupo) || 1;
  let v = Object.entries(grupo).reduce((s, [k, n]) => {
    const u = U[k], frac = u.vence ? qtdFam(ataqueGrupo, u.vence) / totAtk : 0;
    return s + n * u.def * (1 + (P.vantagem - 1) * frac);
  }, 0);
  v += (extra.pop || 0) * P.miliciaPorPop * P.defMilicia;                     /* civis presentes como milícia */
  v += (extra.arqTorre || 0) * U.arqueiro.def * P.torre.bonusAlto;             /* arqueiros no alto */
  v *= bonusCom((extra.reliquia || 0) + (extra.bonusD || 0)) * (extra.portoes ? P.portoes[extra.portoes] : 1);
  return v;
}
function batalha(atk, def, extra, limiteBaixas) {
  const A = valorAtaque(atk, def, extra.bonusA), Dv = valorDefesa(def, atk, extra);
  const venceA = A > Dv, menor = Math.min(A, Dv), maior = Math.max(A, Dv);
  let perdaA = venceA ? Math.pow(menor / maior, P.expPerdas) : 1, perdaD = venceA ? 1 : Math.pow(menor / maior, P.expPerdas);
  let recuou = false;
  if (!venceA && limiteBaixas != null) {            /* recua ao atingir o limite da tática; a defesa sofre na mesma proporção do tempo lutado */
    recuou = true; perdaD = perdaD * limiteBaixas; perdaA = limiteBaixas;
  }
  return { A: r0(A), D: r0(Dv), venceA, perdaA, perdaD, recuou, razao: A / Dv };
}

/* ================================================================ simulação de 70 dias */
const TIPOS = ['comida', 'madeira', 'pedra', 'ferro'];
const somaQtd = o => Object.values(o || {}).reduce((s, v) => s + v, 0);
function simular(perfil, opc) {
  opc = opc || {};
  const S = {
    h: 0, est: Object.assign({}, P.kit), couro: P.kitExtra.couro, prodAcum: 0,
    locais: TIPOS.map(t => ({ t, L: P.inicio.locais })),
    casteloL: P.inicio.castelo, moradias: P.inicio.moradias, pop: P.popInicial, tropas: somaQtd(P.inicio.tropas),
    outros: somaQtd(P.inicio.exploradores),          /* exploradores do início: ocupam o teto, não são soldados */
    fila: [], gastoMil: 0, gastoObra: 0, obras: 0, filaHorasNoite: [], fundados: 0,
    log: {}
  };
  const sessoes = perfil.sessoes;                     /* horas do dia em que o jogador entra */
  const teto = () => P.tetoCastelo + S.moradias * P.tetoPorMoradia;
  const trabNec = () => S.locais.reduce((s, x) => s + vagas(x.L), 0);
  const eficiencia = () => Math.min(1, S.pop / Math.max(1, trabNec()));
  const producaoH = () => {
    const e = eficiencia(), out = { comida: 0, madeira: 0, pedra: 0, ferro: 0 };
    S.locais.forEach(x => { out[x.t] += prod(x.L) * (x.t === 'madeira' ? P.fatorSerraria : 1) * e; });
    TIPOS.forEach(k => { out[k] += castelo(S.casteloL); });
    return out;
  };
  const pode = c => Object.entries(c).every(([k, v]) => (k === 'couro' ? S.couro : S.est[k] || 0) >= v);
  const paga = c => Object.entries(c).forEach(([k, v]) => { if (k === 'couro') S.couro -= v; else S.est[k] -= v; });
  const fimFila = () => S.fila.length ? S.fila[S.fila.length - 1].fim : S.h;
  function enfileirar(rot, c, seg, aplicar) {
    if (S.fila.length >= 10 || !pode(c)) return false;
    paga(c); S.gastoObra += soma(c); S.obras++;
    S.fila.push({ rot, fim: Math.max(fimFila(), S.h) + seg / 3600, aplicar });
    return true;
  }
  function sessao() {
    const pr = producaoH();
    /* 1) obras: melhor retorno entre locais; moradia se a população encosta no teto; castelo e novos locais no ritmo do perfil */
    const noite = S.h % 24 === perfil.sessoes[perfil.sessoes.length - 1];
    const horizonte = noite ? perfil.horizonteNoite : perfil.horizonte;    /* a fila cobre até a próxima sessão (ou a noite) */
    for (let tent = 0; tent < 12 && S.fila.length < 10 && fimFila() - S.h < horizonte; tent++) {
      const dia = S.h / 24, alvoTropas = perfil.fracTropas * teto();
      const precisaMoradia = S.pop < trabNec() * 1.1 && S.pop + S.tropas + S.outros > teto() * 0.9;   /* faltam trabalhadores e o teto está cheio */
      if (precisaMoradia && S.fila.every(q => q.rot !== 'moradia')) {
        const c = receita(custoMoradia(S.moradias)); if (enfileirar('moradia', c, tempoMoradia(S.moradias), () => S.moradias++)) continue;
      }
      if (S.locais.length < perfil.locaisAte(dia) && S.fila.every(q => q.rot !== 'novo')) {
        const menos = TIPOS.slice().sort((a, b) => S.locais.filter(x => x.t === a).length - S.locais.filter(x => x.t === b).length)[0];
        if (enfileirar('novo', receita(P.custoNovoLocal * Math.pow(P.novoLocalCresc, S.fundados)), P.tempoNovoLocal, () => { S.locais.push({ t: menos, L: 1 }); S.fundados++; })) continue;
      }
      if (S.casteloL < P.nivelMax && S.locais.some(x => x.L >= S.casteloL) && S.fila.every(q => q.rot !== 'castelo')) {
        const L = S.casteloL + 1; if (enfileirar('castelo', receita(custo(L) * P.casteloCusto), tempoObra(L) * P.casteloTempo, () => S.casteloL++)) continue;
      }
      const emFila = new Set(S.fila.map(q => q.alvo));
      const cand = S.locais.filter(x => x.L < P.nivelMax && x.L < S.casteloL && !emFila.has(x)).sort((a, b) => (payback(a.L + 1) * (pr[a.t] || 1)) - (payback(b.L + 1) * (pr[b.t] || 1)))[0];
      if (!cand) break;
      const L = cand.L + 1;
      const ok = enfileirar('local', receita(custo(L)), tempoObra(L), () => { cand.L++; });
      if (ok) S.fila[S.fila.length - 1].alvo = cand; else break;
    }
    /* 2) tropas: parte do estoque vira exército; o perfil define quanto */
    const lote = U.lanceiro.custo, cLote = soma(lote);
    const verba = TIPOS.reduce((s, k) => s + S.est[k], 0) * perfil.militar;
    let n = Math.floor(Math.min(verba / cLote, S.pop - trabNec() * perfil.mantemTrab, perfil.fracTropas * teto() - S.tropas, ...Object.entries(lote).map(([k, v]) => S.est[k] / v)));
    if (n > 0) { paga(Object.fromEntries(Object.entries(lote).map(([k, v]) => [k, v * n]))); S.tropas += n; S.pop -= n; S.gastoMil += cLote * n; }
  }
  for (S.h = 0; S.h < P.temporadaDias * 24; S.h++) {
    const hd = S.h % 24;
    if (opc.quedaDia && S.h === opc.quedaDia * 24) {        /* o castelo cai: a sede vai para o local de maior nível */
      S.casteloAntes = S.casteloL; S.prodAntes = soma(producaoH());
      S.casteloL = Math.max(1, Math.floor(S.casteloL * P.queda.nivel));
      S.locais.sort((a, b) => b.L - a.L); S.locais.shift();
      TIPOS.forEach(k => { S.est[k] *= 1 - P.queda.recursos; });
      S.pop *= 1 - P.queda.populacao; S.tropas *= 1 - P.queda.tropas; S.fila = []; S.caiu = true;
    }
    if (sessoes.includes(hd)) {
      sessao();
      if (hd === sessoes[sessoes.length - 1]) S.filaHorasNoite.push(Math.max(0, fimFila() - S.h));
    }
    while (S.fila.length && S.fila[0].fim <= S.h + 1) { S.fila.shift().aplicar(); }
    const pr = producaoH(), cap = Math.max(P.estoqueMinimo, soma(pr) * P.estoqueHoras);
    TIPOS.forEach(k => { S.est[k] = Math.min(cap, S.est[k] + pr[k]); });
    S.prodAcum += soma(pr); if (S.h + 1 === P.escudoNovatoH) S.prodEscudo = S.prodAcum;
    S.couro += P.cacasDia * couroMedioCaca() / 24;    /* caça (cacasDia caçadas por dia, rendimento médio por bando) */
    const sobra = pr.comida > castelo(S.casteloL) * 2;
    const livre = Math.max(1, teto() - S.tropas - S.outros);     /* tropas e exploradores ocupam o teto */
    const ritmoPop = Math.min(P.popMaxH, (P.popMinH + (P.popMaxH - P.popMinH) * Math.max(0, livre - S.pop) / livre) * (sobra ? 1 + P.bonusComida : 1));
    if (S.pop < livre) S.pop = Math.min(livre, S.pop + ritmoPop);
    S.tropas *= (1 - perfil.perdasDia / 24);          /* desgaste por combate */
    const dia = (S.h + 1) / 24;
    if (!S.diaMax && S.locais.length >= 8 && S.locais.reduce((s, x) => s + x.L, 0) / S.locais.length >= P.nivelMax - 0.5) S.diaMax = Math.ceil(dia);
    if (S.caiu && !S.recupCastelo && S.casteloL >= S.casteloAntes) S.recupCastelo = r1(dia - opc.quedaDia);
    if (S.caiu && !S.recupProd && soma(producaoH()) >= 0.95 * S.prodAntes) S.recupProd = r1(dia - opc.quedaDia);
    if ([1, 3, 4, 7, 10, 14, 21, 35, 50, 70].includes(dia)) {
      S.log[dia] = { prod: r0(soma(producaoH())), locais: S.locais.length, nivelMedio: r1(S.locais.reduce((s, x) => s + x.L, 0) / S.locais.length),
        castelo: S.casteloL, pop: r0(S.pop + S.tropas + S.outros), civis: r0(S.pop), outros: S.outros, teto: teto(), trab: trabNec(), tropas: r0(S.tropas), efic: r0(eficiencia() * 100), obras: S.obras };
    }
  }
  S.noiteMedia = S.filaHorasNoite.slice(7).reduce((s, v) => s + v, 0) / Math.max(1, S.filaHorasNoite.length - 7);
  return S;
}
const couroMedioCaca = () => Object.values(P.caca).reduce((s, c) => s + c.couro, 0) / Object.keys(P.caca).length;
const PERFIS = {
  medio: { nome: 'Médio (4 sessões/dia)', sessoes: [8, 13, 19, 23], militar: 0.30, mantemTrab: 1.0, perdasDia: 0.004, fracTropas: 0.35, horizonte: 6, horizonteNoite: 10,
    locaisAte: d => Math.min(14, 4 + Math.floor(d / 4)) },
  ativo: { nome: 'Ativo (8 sessões/dia)', sessoes: [7, 9, 11, 13, 16, 19, 21, 23], militar: 0.42, mantemTrab: 0.95, perdasDia: 0.008, fracTropas: 0.5, horizonte: 3, horizonteNoite: 9,
    locaisAte: d => Math.min(18, 4 + Math.floor(d / 3)) }
};

/* ================================================================ começo (primeiras horas, minuto a minuto)
   O reino novo (P.inicio, P.kit) com um jogador de olho no jogo: sempre que a fila de obras (uma por vez) fica livre, começa
   a melhoria mais barata que consegue pagar (o castelo quando algum local já o alcançou). Com coleta, os civis sem trabalho
   cortam madeira e a guarnição inicial quebra pedra a COMECO.distHex hexágonos do castelo, indo e voltando com a carga.
   Sem carregadores nem crescimento da população (são as primeiras horas). Os marcos são em minutos de jogo, que agora são
   minutos reais: o ritmo 3× dispensa a aceleração de teste. */
const COMECO = { horas: 4, tabela: [20, 40, 60, 120, 240], distHex: 3 };
function simularComeco(comColeta) {
  const est = Object.assign({}, P.kit);
  const loc = TIPOS.map(t => ({ t, L: P.inicio.locais }));
  let casteloL = P.inicio.castelo, niveis = 0, obra = null, castelo5 = null;
  const marcos = {}, coletado = { madeira: 0, pedra: 0 };
  const civis = P.popInicial, tropas = P.inicio.tropas;
  const viagemH = 2 * COMECO.distHex * P.terrenoMedio * P.minPor.Lenta / 60;   /* ida e volta, em horas */
  const efetivo = (n, carga) => n > 0 ? carga / (carga / coletaH(n) + viagemH) : 0;   /* por hora, contando a viagem */
  const nTropas = somaQtd(tropas), cargaTropas = Object.entries(tropas).reduce((s, [k, n]) => s + n * U[k].carga, 0);
  for (let min = 0; min < COMECO.horas * 60; min++) {
    const vagasTot = loc.reduce((s, x) => s + vagas(x.L), 0), efic = Math.min(1, civis / vagasTot), ociosos = Math.max(0, civis - vagasTot);
    TIPOS.forEach(k => { est[k] += castelo(casteloL) / 60; });
    loc.forEach(x => { est[x.t] += prod(x.L) * efic / 60; });
    if (comColeta) {
      const m = efetivo(ociosos, ociosos * P.coleta.cargaCivil) / 60, p = efetivo(nTropas, cargaTropas) / 60;
      est.madeira += m; est.pedra += p; coletado.madeira += m; coletado.pedra += p;
    }
    if (obra && min >= obra.fim) { obra.f(); niveis++; obra = null; if (casteloL >= 5 && castelo5 == null) castelo5 = (min + 1) / 60; }
    if (!obra) {
      const cands = [];
      if (casteloL < P.nivelMax && loc.some(x => x.L >= casteloL)) cands.push({ c: receita(custo(casteloL + 1) * P.casteloCusto), seg: tempoObra(casteloL + 1) * P.casteloTempo, f: () => casteloL++ });
      loc.filter(x => x.L < casteloL).forEach(x => cands.push({ c: receita(custo(x.L + 1)), seg: tempoObra(x.L + 1), f: () => x.L++ }));
      cands.sort((a, b) => soma(a.c) - soma(b.c));
      const ok = cands.find(o => Object.entries(o.c).every(([k, v]) => est[k] >= v));
      if (ok) { Object.entries(ok.c).forEach(([k, v]) => { est[k] -= v; }); obra = { fim: min + ok.seg / 60, f: ok.f }; }
    }
    if ((min + 1) % 20 === 0) marcos[min + 1] = { niveis, castelo: casteloL, nivelMedio: r1(loc.reduce((s, x) => s + x.L, 0) / loc.length), coletado: r0(coletado.madeira + coletado.pedra) };
  }
  return { marcos, coletado, castelo5 };
}
const comecoSem = simularComeco(false), comecoCom = simularComeco(true);

/* ================================================================ saída */
const L = [];
const out = s => L.push(s);
const fmtT = seg => seg < 120 ? fmtS(seg) : seg < 3600 ? r0(seg / 60) + ' min' : (Math.floor(seg / 3600) + ' h' + (r0((seg % 3600) / 60) ? ' ' + r0((seg % 3600) / 60) + ' min' : ''));
/* tempos curtos com os segundos: 40 s, 1 min 20 s, 13 min 20 s */
const fmtS = seg => { seg = r0(seg); if (seg >= 3600) return fmtT(seg); const m = Math.floor(seg / 60), x = seg % 60; return (m ? m + ' min' : '') + (m && x ? ' ' : '') + (x || !m ? x + ' s' : ''); };
const NOME_REC = { aco: 'aço', minerio: 'minério raro', cavalo: 'cavalo de raça', cavalos: 'cavalos de raça' };
const fmtC = c => Object.entries(c).map(([k, v]) => v + ' ' + (NOME_REC[k === 'cavalo' && v > 1 ? 'cavalos' : k] || k)).join(', ');
out('# Tabelas do balanceamento (geradas)\n');
out('Geradas por `node balanceamento/modelo.js`. Não edite à mão: mude os parâmetros no modelo e rode de novo.\n');

out('## Locais de produção por nível\n');
out('| Nível | Produção/h | Vagas de trabalho | Custo para subir | Receita | Tempo de obra | Retorno do custo |');
out('|---|---|---|---|---|---|---|');
for (let n = 1; n <= P.nivelMax; n++) {
  out('| ' + n + ' | ' + r1(prod(n)) + ' | ' + vagas(n) + ' | ' + (n > 1 ? r0(custo(n)) : '—') + ' | ' + (n > 1 ? fmtC(receita(custo(n))) : '—') + ' | ' +
    (n > 1 ? fmtT(tempoObra(n)) : '—') + ' | ' + (n > 1 ? r1(payback(n)) + ' h' : '—') + ' |');
}
out('\nA serraria rende ' + P.fatorSerraria + '× o valor da tabela: as obras gastam 45% em madeira.');
out('\nEstoque de cada local: até ' + P.estoqueHoras + ' h da própria produção; o excedente vai para o armazém, que também guarda os valiosos. Uma vaga vazia produz menos: a produção do local é proporcional às vagas ocupadas.\n');
out('Castelo: produz ' + r1(castelo(1)) + '/h de cada recurso básico no nível 1 e ' + r1(castelo(P.nivelMax)) + '/h no nível ' + P.nivelMax + '. Nenhum local passa do nível do castelo. Melhorar o castelo custa ' + P.casteloCusto + '× e leva ' + P.casteloTempo + '× o tempo de um local do mesmo nível (nível ' + P.nivelMax + ': ' + fmtT(tempoObra(P.nivelMax) * P.casteloTempo) + ').\n');
out('População: o castelo abriga ' + P.tetoCastelo + ' pessoas e cada moradia mais ' + P.tetoPorMoradia + ' (a primeira custa ' + fmtC(receita(custoMoradia(0))) + ', cada uma ' + P.moradiaPasso + ' a mais). Reino novo: ' + P.popInicial + ' pessoas. Crescimento de ' + P.popMinH + ' a ' + P.popMaxH + ' pessoas por hora enquanto há espaço no teto (mais rápido com mais espaço livre), +' + P.bonusComida * 100 + '% com sobra de comida, até ' + P.popMaxH + '/h.\n');
out('Reino novo com os primeiros passos já dados: castelo e locais no nível ' + P.inicio.castelo + ', ' + P.inicio.moradias + ' moradias, ' +
  Object.entries(P.inicio.tropas).map(([k, n]) => n + ' ' + U[k].nome.toLowerCase() + (n > 1 ? 's' : '')).join(' e ') + ' no castelo, ' +
  Object.entries(P.inicio.exploradores).map(([k, n]) => n + ' ' + P.exploradores[k].nome.toLowerCase()).join(', ') + ' (exploradores prontos) e o entorno explorado até ' + P.inicio.raioExplorado + ' hexágonos do castelo.\n');

out('## Unidades\n');
out('Cada unidade é uma pessoa do reino (as máquinas de cerco, a equipe que as opera). Valor: custo em valor de referência (couro vale 2, cavalo de raça 40). Por 100: ataque e defesa por 100 de valor.\n');
out('| Unidade | Família | Ataque | Defesa | Vence | Velocidade | Carga | Visão | Custo | Valor | Tempo | Pop. | Ataque/100 | Defesa/100 | Requisito |');
out('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
Object.values(U).forEach(u => {
  const t = valorDe(u.custo);
  out('| ' + u.nome + ' | ' + NOME_FAM[u.fam] + ' | ' + u.atk + ' | ' + u.def + ' | ' + (u.vence ? NOME_FAM[u.vence] : u.cerco ? 'torres e portões (' + u.cerco + ')' : '—') + ' | ' + u.vel + ' | ' + u.carga + ' | ' + u.visao + ' | ' + fmtC(u.custo) + ' | ' + t + ' | ' + fmtT(u.tempo) + ' | ' + u.pop + ' | ' +
    r1(100 * u.atk / t) + ' | ' + r1(100 * u.def / t) + ' | ' + (u.req || '—') + ' |');
});
out('\nMensageiro: ' + fmtC(P.mensageiro.custo) + ', ' + P.mensageiro.pop + ' de população, ' + fmtT(P.mensageiro.tempo) + ', velocidade ' + P.mensageiro.vel.toLowerCase() + ' (reino vizinho em ' + fmtT(viagemMin(P.vizinhoHex, P.mensageiro.vel) * 60) + '). Mensagem de até ' + P.mensageiro.caracteres + ' caracteres; recado de proposta, até ' + P.mensageiro.recadoProposta + '.\n');
out('Veículos: carroça ' + VEICULOS.carroca.carga + ' (lenta, ' + fmtC(VEICULOS.carroca.custo) + '); carroção ' + VEICULOS.carrocao.carga + ' (média, ' + fmtC(VEICULOS.carrocao.custo) + '). Carregador da requisição: ' + P.carregador.carga + ' por pessoa, a pé.\n');

out('## Deslocamento\n');
out('| Distância | Exemplo | Lenta | Média | Rápida | Lenta em rota |');
out('|---|---|---|---|---|---|');
[[6, 'local vizinho do próprio reino'], [20, 'outro lado do próprio reino'], [P.vizinhoHex, 'reino vizinho'], [P.mapa.cols / 2, 'meio mapa'], [P.mapa.cols, 'travessia do mapa']].forEach(([h, ex]) => {
  out('| ' + h + ' hex. | ' + ex + ' | ' + fmtT(viagemMin(h, 'Lenta') * 60) + ' | ' + fmtT(viagemMin(h, 'Média') * 60) + ' | ' + fmtT(viagemMin(h, 'Rápida') * 60) + ' | ' + fmtT(viagemMin(h, 'Lenta', true) * 60) + ' |');
});
out('\nMapa para ' + P.reinos + ' reinos: ' + P.mapa.cols + ' × ' + P.mapa.lins + ' hexágonos (≈ ' + r0(P.mapa.cols * P.mapa.lins / P.reinos) + ' por reino). Terreno médio ' + P.terrenoMedio + '; rota pública multiplica por ' + P.rotaFator + '.\n');

/* bônus de combate possíveis, antes do teto */
const BONUS = { armas: P.ferraria.bonusNivel * P.ferraria.niveis.length, vet: P.veterania.bonus[P.veterania.bonus.length - 1], lend: P.lendario.bonus, leg: P.legado.teto };
BONUS.maxAtk = BONUS.armas + BONUS.vet + P.reliquia.ataque + BONUS.lend + BONUS.leg;
BONUS.maxDef = BONUS.armas + BONUS.vet + P.reliquia.resistencia + BONUS.lend + BONUS.leg;
out('## Combates de referência\n');
out('Valor de ataque contra valor de defesa; o vencedor perde (menor/maior)^' + P.expPerdas + ' das tropas. Milícia: cada civil presente no local luta, com defesa ' + P.defMilicia + '. Arqueiros no alto de torres: defesa ×' + P.torre.bonusAlto + '.\n');
out('| Situação | Ataque | Defesa | Razão | Resultado | Perdas do atacante | Perdas da defesa |');
out('|---|---|---|---|---|---|---|');
const casos = [
  ['6 lanceiros contra mina com 4 lanceiros e 3 civis', { lanceiro: 6 }, { lanceiro: 4 }, { pop: 3 }],
  ['8 arqueiros contra a mesma mina', { arqueiro: 8 }, { lanceiro: 4 }, { pop: 3 }],
  ['8 arqueiros contra a mina com torre nível 2 (' + 2 * P.torre.arqPorNivel + ' arqueiros no alto)', { arqueiro: 8 }, { lanceiro: 4 }, { pop: 3, arqTorre: 2 * P.torre.arqPorNivel }],
  ['6 cavaleiros (saque) contra vila com 2 lanceiros e 4 civis', { cavalaria: 6 }, { lanceiro: 2 }, { pop: 4 }],
  ['6 cavaleiros contra vila com 3 arqueiros e 4 civis', { cavalaria: 6 }, { arqueiro: 3 }, { pop: 4 }],
  ['Mina Rubra (4 lanceiros, torre 1, relíquia de resistência, 2 civis) contra 8 arqueiros', { arqueiro: 8 }, { lanceiro: 4 }, { pop: 2, arqTorre: P.torre.arqPorNivel, reliquia: 0.20 }],
  ['Cerco: 20 tropas mistas contra castelo médio (12 tropas, 2 torres nível 1, portões 3, 10 civis)', { lanceiro: 8, arqueiro: 8, cavalaria: 4 }, { lanceiro: 7, arqueiro: 5 }, { pop: 10, arqTorre: 2 * P.torre.arqPorNivel, portoes: 3 }],
  ['Mesmo cerco com 40 tropas', { lanceiro: 16, arqueiro: 16, cavalaria: 8 }, { lanceiro: 7, arqueiro: 5 }, { pop: 10, arqTorre: 2 * P.torre.arqPorNivel, portoes: 3 }],
  ['Ataque perdido com tática média (recua com 40%)', { lanceiro: 3 }, { lanceiro: 4 }, { pop: 3 }, 0.40],
  ['8 arqueiros contra mina com 4 lanceiros, torre 1 e 3 civis, sem bônus', { arqueiro: 8 }, { lanceiro: 4 }, { pop: 3, arqTorre: P.torre.arqPorNivel }],
  ['Os mesmos 8 arqueiros com armas nível 3 (+' + r0(BONUS.armas * 100) + '%)', { arqueiro: 8 }, { lanceiro: 4 }, { pop: 3, arqTorre: P.torre.arqPorNivel, bonusA: BONUS.armas }],
  ['Os mesmos 8 arqueiros com todos os bônus de ataque (+' + r0(BONUS.maxAtk * 100) + '%, limitado a +' + P.tetoBonus * 100 + '%)', { arqueiro: 8 }, { lanceiro: 4 }, { pop: 3, arqTorre: P.torre.arqPorNivel, bonusA: BONUS.maxAtk }],
  ['A mesma mina com todos os bônus de defesa (+' + r0(BONUS.maxDef * 100) + '%, limitado a +' + P.tetoBonus * 100 + '%) contra os 8 arqueiros sem bônus', { arqueiro: 8 }, { lanceiro: 4 }, { pop: 3, arqTorre: P.torre.arqPorNivel, reliquia: P.reliquia.resistencia, bonusD: BONUS.maxDef - P.reliquia.resistencia }]
];
const resCasos = casos.map(([rot, a, d, x, lim]) => {
  const b = batalha(a, d, x, lim);
  out('| ' + rot + ' | ' + b.A + ' | ' + b.D + ' | ' + r1(b.razao) + ' | ' + (b.recuou ? 'recuou' : b.venceA ? 'atacante vence' : 'defesa vence') + ' | ' + r0(b.perdaA * 100) + '% | ' + r0(b.perdaD * 100) + '% |');
  return b;
});
out('');

out('## Duração da batalha\n');
out('Sem tempo fixo: ' + P.combate.batalha.minSeg + ' s + ' + P.combate.batalha.porTropaSeg + ' s × tropas do lado mais fraco × (força menor / força maior)^' + String(P.combate.batalha.expRazao).replace('.', ',') + ', até ' + fmtT(P.combate.batalha.maxSeg) + '. O tempo real é menor: o ritmo acompanha quem sobra.\n');
out('| Situação | Tropas do lado mais fraco | Força menor / maior | Duração |');
out('|---|---|---|---|');
const DURACOES = [['50 contra 1', 1, 0.02], ['6 contra 4, forças parecidas', 4, 0.9], ['8 arqueiros contra mina com 4 lanceiros e 3 civis', 7, 0.73], ['20 contra 20, forças iguais', 20, 1], ['40 tropas contra castelo médio (12 tropas e 10 civis)', 22, 0.82], ['50 contra 50, forças iguais', 50, 1]];
DURACOES.forEach(([rot, n, r]) => out('| ' + rot + ' | ' + n + ' | ' + String(r).replace('.', ',') + ' | ' + fmtS(duracaoBatalha(n, r)) + ' |'));
out('');

out('## Torres de arqueiros\n');
out('| Nível | Alcance | Arqueiros no alto | Defesa somada | Custo | Tempo | Estrutura |');
out('|---|---|---|---|---|---|---|');
for (let n = 1; n <= P.torre.nivelMax; n++) {
  const c = P.torre.custoN1 * Math.pow(P.torre.custoCresc, n - 1);
  out('| ' + n + ' | ' + P.torre.alcance(n) + ' hex. | ' + n * P.torre.arqPorNivel + ' | ' + r0(n * P.torre.arqPorNivel * U.arqueiro.def * P.torre.bonusAlto) + ' | ' + fmtC({ pedra: r0(c * 0.7), madeira: r0(c * 0.3) }) + ' | ' + fmtT(P.torre.tempoN1 * n) + ' | ' +
    n * P.torre.estrutura + ' (' + Math.ceil(n * P.torre.estrutura / U.ariete.cerco) + ' aríetes) |');
}
out('\nPortões do castelo: ' + P.portoesEstrutura + ' de estrutura por nível (nível 3: ' + 3 * P.portoesEstrutura + ', ' + Math.ceil(3 * P.portoesEstrutura / U.ariete.cerco) + ' aríetes ou ' + Math.ceil(3 * P.portoesEstrutura / U.trebuchet.cerco) + ' trebuchets). Aríetes batem por combate; o trebuchet bate à distância, sem entrar no alcance dos arqueiros.\n');

out('## Fauna, saque, relíquias e proteções\n');
out('- Fauna (força = soma de (ataque + defesa)/2): baixo ' + P.fauna.baixo + ', médio ' + P.fauna.medio + ', alto ' + P.fauna.alto + '. Com o dobro do limite, o grupo passa ileso. 4 lanceiros = ' + forcaFauna({ lanceiro: 4 }) + ' (ilesos no baixo); 12 arqueiros = ' + forcaFauna({ arqueiro: 12 }) + ' (ilesos em qualquer nível); 1 explorador a cavalo = ' + P.exploradores.cavalo.forca + '.');
out('- Saque repetido ao mesmo alvo em 24 h: −' + P.saqueQueda * 100 + '% por saque, até restar ' + P.saqueMinimo * 100 + '%.');
out('- Relíquias: ataque +' + P.reliquia.ataque * 100 + '%, produção +' + P.reliquia.producao * 100 + '%, resistência +' + P.reliquia.resistencia * 100 + '%. Produção +15% num local de nível 6 = +' + r1(prod(6) * 0.15) + '/h, perto de meio nível (' + r1(prod(7) - prod(6)) + '/h). Escavação: ' + fmtT(P.reliquia.escavarHoras1 * 3600) + ' com 1 unidade, mínimo ' + fmtT(P.reliquia.escavarMin * 3600) + '.');
out('- Escudo de novato ' + P.escudoNovatoH + ' h; escudo de exílio ' + P.escudoExilioH + ' h. Relíquias da temporada (legado): +' + P.legado.relMin * 100 + '% a +' + P.legado.relMax * 100 + '% cada, até ' + P.legado.equipadas + ' equipadas, teto somado de ' + P.legado.teto * 100 + '%. Aliança: até ' + P.alianca + ' reinos.\n');

out('## Simulação de uma temporada (' + P.temporadaDias + ' dias)\n');
const sims = {};
Object.entries(PERFIS).forEach(([k, pf]) => {
  const S = simular(pf); sims[k] = S;
  out('### ' + pf.nome + '\n');
  out('| Dia | Produção/h (total) | Locais | Nível médio | Castelo | Pessoas (civis + tropas + exploradores) / teto | Vagas | Eficiência | Tropas |');
  out('|---|---|---|---|---|---|---|---|---|');
  Object.entries(S.log).forEach(([d, v]) => out('| ' + d + ' | ' + v.prod + ' | ' + v.locais + ' | ' + v.nivelMedio + ' | ' + v.castelo + ' | ' + v.pop + ' (' + v.civis + ' + ' + v.tropas + ' + ' + v.outros + ') / ' + v.teto + ' | ' + v.trab + ' | ' + v.efic + '% | ' + v.tropas + ' |'));
  out('\nGasto em obras ' + r0(S.gastoObra) + ' · em tropas ' + r0(S.gastoMil) + ' · economia no máximo (nível médio ≥ ' + String(P.nivelMax - 0.5).replace('.', ',') + '), sem guerra: ' + (S.diaMax ? 'dia ' + S.diaMax : 'não chega') + '.\n');
});

/* ---------- queda do castelo (médio, dia 35) ---------- */
const quedaS = simular(PERFIS.medio, { quedaDia: 35 });
out('### Queda do castelo no dia 35 (médio)\n');
out('O castelo cai com o reino ainda tendo outros locais: a sede vai para o local de maior nível, que vira castelo com ' + P.queda.nivel * 100 + '% do nível antigo; o reino perde ' + P.queda.recursos * 100 + '% dos recursos guardados e ' + P.queda.populacao * 100 + '% da população civil; as relíquias do castelo vão com o atacante. A simulação supõe ainda ' + P.queda.tropas * 100 + '% das tropas mortas no cerco e a fila de obras perdida.\n');
out('- Castelo: nível ' + quedaS.casteloAntes + ' → ' + Math.max(1, Math.floor(quedaS.casteloAntes * P.queda.nivel)) + '. Volta ao nível ' + quedaS.casteloAntes + ' em ' + (quedaS.recupCastelo != null ? quedaS.recupCastelo + ' dias' : 'mais que o resto da temporada') + '.');
out('- Produção: ' + r0(quedaS.prodAntes) + '/h antes da queda; volta a 95% disso em ' + (quedaS.recupProd != null ? quedaS.recupProd + ' dias' : 'mais que o resto da temporada') + '.\n');

/* ---------- valiosos e lendários ---------- */
const VAL = {
  aco:    { nome: 'Aço de qualidade', onde: 'colina (veio puro)', uso: 'armas e armaduras dos níveis 2 e 3; equipamento lendário' },
  cavalo: { nome: 'Cavalos de raça', onde: 'planície (manadas)', uso: 'cavaleiro de elite (1 por unidade) e carroção (2)' },
  ouro:   { nome: 'Ouro', onde: 'montanha', uso: 'eras; armas e armaduras do nível 3' },
  prata:  { nome: 'Prata', onde: 'colina e montanha', uso: 'moeda de troca padrão' },
  sal:    { nome: 'Sal', onde: 'salinas (planície)', uso: 'salgadeira: o local de comida guarda ' + P.salgadeira.horas + ' h em vez de ' + P.estoqueHoras + ' h' },
  ervas:  { nome: 'Ervas raras', onde: 'pântano', uso: 'tratar feridos (' + P.feridos.ervas + ' por ferido)' },
  gema:   { nome: 'Pedras preciosas', onde: 'montanha', uso: 'troca de alto valor; brasões e estandartes (só cosméticos)' },
  minerio: { nome: 'Minério raro (lendário)', onde: 'montanha, só o prospector revela', uso: 'equipamento lendário', lend: true }
};
const tamJazida = k => Math.max(10, Math.round((VAL[k].lend ? P.jazida.valorLendaria : P.jazida.valor) / P.valor[k] / 10) * 10);
const nJazidas = k => Math.round(P.reinos / (VAL[k].lend ? P.jazida.lendariasPorReinos : P.jazida.porReinos));
const ext4 = extracaoH({ lanceiro: 4 }), ext6p = extracaoH({ lanceiro: 6 }, true);
out('## Recursos valiosos e lendários\n');
out('Valor de referência em recursos básicos (1). Orienta trocas, a IA comerciante e o limite do novato; os jogadores trocam pelo valor que combinarem. Couro e peles valem ' + P.valor.couro + '.\n');
out('| Recurso | Valor | Onde | Para que serve | Jazida guarda | Jazidas no mapa | 4 lanceiros | 6 lanceiros + posto |');
out('|---|---|---|---|---|---|---|---|');
Object.entries(VAL).forEach(([k, v]) => {
  out('| ' + v.nome + ' | ' + P.valor[k] + ' | ' + v.onde + ' | ' + v.uso + ' | ' + tamJazida(k) + ' | ' + nJazidas(k) + ' | ' + r1(ext4 / P.valor[k]) + '/h | ' + r1(ext6p / P.valor[k]) + '/h |');
});
out('\nExtração (valor por hora) = ' + P.extracao.taxa + ' × carga média × tropas^' + P.extracao.expTropas + '; posto ×' + P.extracao.posto + '; rota no caminho ×' + P.extracao.rota + '; até ' + P.extracao.maxTropas + ' tropas por jazida. Quanto mais valioso, mais devagar sai.\n');
out('| Grupo | Valor/h | Por pessoa | Jazida de ' + P.jazida.valor + ' dura |');
out('|---|---|---|---|');
[['1 lanceiro', { lanceiro: 1 }], ['4 lanceiros', { lanceiro: 4 }], ['3 cavaleiros', { cavalaria: 3 }], ['6 lanceiros', { lanceiro: 6 }], ['6 lanceiros + posto', { lanceiro: 6 }, true], ['6 lanceiros + posto + rota', { lanceiro: 6 }, true, true]].forEach(([rot, g, po, ro]) => {
  const v = extracaoH(g, po, ro);
  out('| ' + rot + ' | ' + r1(v) + ' | ' + r1(v / soma(g)) + ' | ' + fmtT(P.jazida.valor / v * 3600) + ' |');
});
out('\nUm trabalhador de um local nível 6 rende ' + r1(prod(6) / vagas(6)) + '/h. Extrair rende mais por pessoa, mas a tropa fica longe de casa, exposta, e a jazida acaba.\n');
const demOuro = P.eras.aco.custo.ouro + P.eras.cerco.custo.ouro + P.ferraria.linhasTipicas * P.ferraria.niveis[2].custo.ouro;
const demAco = P.ferraria.linhasTipicas * (P.ferraria.niveis[1].custo.aco + P.ferraria.niveis[2].custo.aco) + P.lendario.custo.aco * nJazidas('minerio') * tamJazida('minerio') / P.lendario.custo.minerio / P.reinos;
const ofOuro = nJazidas('ouro') * tamJazida('ouro'), ofAco = nJazidas('aco') * tamJazida('aco');
out('Oferta e demanda típica (Era do Aço, Era do Cerco Avançado e ' + P.ferraria.linhasTipicas + ' linhas da ferraria no nível 3 por reino):\n');
out('- Ouro: demanda ' + r0(demOuro) + ' por reino, ' + r0(demOuro * P.reinos) + ' no mundo; oferta ' + ofOuro + ' (' + r0(100 * ofOuro / (demOuro * P.reinos)) + '%).');
out('- Aço: demanda ' + r0(demAco) + ' por reino, ' + r0(demAco * P.reinos) + ' no mundo; oferta ' + ofAco + ' (' + r0(100 * ofAco / (demAco * P.reinos)) + '%).');
out('- Minério raro: ' + nJazidas('minerio') * tamJazida('minerio') + ' no mapa, ' + P.lendario.custo.minerio + ' por equipamento: no máximo ' + r0(nJazidas('minerio') * tamJazida('minerio') / P.lendario.custo.minerio) + ' lendários para ' + P.reinos + ' reinos.\n');

/* ---------- comércio e pactos ---------- */
const recebivelNovato = P.comercio.novatoDia * P.escudoNovatoH / 24;
out('## Comércio, pactos e resgate\n');
out('- Sem mercado global. **Troca direta** só com reinos conhecidos; a proposta revela quem propõe. As duas cargas viajam pelo mapa, visíveis e roubáveis.');
out('- **IA comerciante**: compra a ' + r0((1 - P.comercio.margemIA) * 100) + '% e vende a ' + r0((1 + P.comercio.margemIA) * 100) + '% do valor, só com o próprio estoque (mesmas regras dos jogadores). Ex.: 10 de ouro custam ' + r0(10 * P.valor.ouro * (1 + P.comercio.margemIA)) + ' em básicos; vender 10 de ouro rende ' + r0(10 * P.valor.ouro * (1 - P.comercio.margemIA)) + '.');
out('- **Reino sob escudo de novato**: a diferença entre o que dá e o que recebe (trocas, ajuda de aliados, pagamentos) fica em até ' + P.comercio.novatoDia + ' de valor por dia; no escudo inteiro, ' + recebivelNovato + ', ' + r0(100 * recebivelNovato / sims.medio.prodEscudo) + '% do que um jogador médio produz no mesmo período (' + r0(sims.medio.prodEscudo) + '). Não pode ser cobrado por pacto.');
out('- **Pacto de não agressão**: de ' + P.pacto.diasMin + ' a ' + P.pacto.diasMax + ' dias, até ' + P.pacto.ativosMax + ' ativos por reino; pagamento em qualquer direção (ou nenhum). Começa quando o pagamento chega; se a carga for roubada, não começa. O jogo impede ataques, saques e interceptações entre os dois até o fim.');
out('- **Resgate de explorador**: quem captura vê o reino de origem e tem ' + P.resgateH + ' h para pedir resgate, libertar ou executar; sem decisão, o explorador é libertado.\n');

/* ---------- eras ---------- */
const prodDia = d => sims.medio.log[d].prod;
out('## Eras\n');
out('A Era do Ferro é a inicial (armas e armaduras do nível 1).\n');
out('| Era | Requisito | Custo | Valor | Tempo | Libera | Custo sem o ouro, em horas de produção do médio |');
out('|---|---|---|---|---|---|---|');
Object.values(P.eras).forEach(e => {
  const semOuro = valorDe(e.custo) - e.custo.ouro * P.valor.ouro;
  out('| ' + e.nome + ' | ' + e.req + ' | ' + fmtC(e.custo) + ' | ' + valorDe(e.custo) + ' | ' + fmtT(e.tempo) + ' | ' + e.libera + ' | ' + r1(semOuro / prodDia(e.dia)) + ' h (dia ' + e.dia + ') |');
});
out('');

/* ---------- ferraria ---------- */
const nLinhas = P.ferraria.familias * P.ferraria.linhas;
const valorLinha = P.ferraria.niveis.reduce((s, n) => s + valorDe(n.custo), 0), tempoLinha = P.ferraria.niveis.reduce((s, n) => s + n.tempo, 0);
const equilibrio = fam => r0(valorDe(P.ferraria.niveis[0].custo) / (P.ferraria.bonusNivel * valorDe(U[{ infantaria: 'lanceiro', arqueiros: 'arqueiro', cavalaria: 'cavalaria' }[fam]].custo)));
out('## Ferraria: armas e armaduras\n');
out('Duas linhas por família (infantaria, arqueiros, cavalaria): armas dão +' + P.ferraria.bonusNivel * 100 + '% de ataque por nível; armaduras, +' + P.ferraria.bonusNivel * 100 + '% de defesa. Fila própria, até 10, uma por vez.\n');
out('| Nível | Bônus | Custo por linha | Valor | Tempo | Requisito |');
out('|---|---|---|---|---|---|');
P.ferraria.niveis.forEach((n, i) => out('| ' + (i + 1) + ' | +' + r0((i + 1) * P.ferraria.bonusNivel * 100) + '% | ' + fmtC(n.custo) + ' | ' + valorDe(n.custo) + ' | ' + fmtT(n.tempo) + ' | ' + n.req + ' |'));
out('\n- Uma linha completa: ' + valorLinha + ' de valor e ' + fmtT(tempoLinha) + '. As ' + nLinhas + ' linhas: ' + r0(valorLinha * nLinhas) + ' e ' + r0(tempoLinha * nLinhas / 3600) + ' h de ferraria, ' + r0(100 * valorLinha * nLinhas / sims.medio.gastoObra) + '% do que o médio gasta em obras na temporada.');
out('- O nível 1 rende mais que recrutar com o mesmo valor a partir de ' + equilibrio('infantaria') + ' lanceiros, ' + equilibrio('arqueiros') + ' arqueiros ou ' + equilibrio('cavalaria') + ' cavaleiros. Antes disso, recrutar compensa mais: a ferraria é para quem já tem exército.\n');

/* ---------- lendário, elite, veterania, feridos e teto ---------- */
const lendTropas = P.lendario.bonus * P.lendario.tropas;
out('## Equipamento lendário e cavaleiro de elite\n');
out('- **Equipamento lendário**: ' + fmtC(P.lendario.custo) + ' (valor ' + valorDe(P.lendario.custo) + '), ' + fmtT(P.lendario.tempo) + ', ' + P.lendario.req + '. +' + P.lendario.bonus * 100 + '% de ataque ou defesa para um exército de até ' + P.lendario.tropas + ' tropas (num exército maior, o bônus se dilui). Vale no máximo ' + r1(lendTropas) + ' tropas. Um por reino; se o exército for derrotado, fica no campo e o vencedor leva.');
out('- **Cavaleiro de elite**: ataque ' + U.elite.atk + ', defesa ' + U.elite.def + ', rápida, carga ' + U.elite.carga + ', ' + fmtC(U.elite.custo) + ' (valor ' + valorDe(U.elite.custo) + '), ' + fmtT(U.elite.tempo) + '. Por população: ' + U.elite.atk + ' de ataque contra ' + U.cavalaria.atk + ' da cavalaria. Por 100 de valor: ' + r1(100 * U.elite.atk / valorDe(U.elite.custo)) + ' contra ' + r1(100 * U.cavalaria.atk / valorDe(U.cavalaria.custo)) + '. Mais forte por pessoa, mais caro por força.\n');
out('## Veterania, feridos e teto de bônus\n');
out('- **Veterania** (por pessoa): cada vitória com perdas abaixo de ' + P.veterania.perdasMax * 100 + '%, contra um inimigo com pelo menos ' + P.veterania.forcaMin * 100 + '% da própria força, dá 1 marca a cada soldado do grupo. ' + P.veterania.marcas.map((m, i) => m + ' marcas: +' + P.veterania.bonus[i] * 100 + '%').join('; ') + ' (ataque e defesa; o bônus do grupo é a média). Recrutas novos diluem as marcas; cada derrota tira 1. Fauna não conta.');
out('- **Feridos**: ' + P.feridos.frac * 100 + '% das baixas de quem vence, ou recua pela tática, voltam feridos. ' + P.feridos.ervas + ' ervas curam 1 em ' + fmtT(P.feridos.curaH * 3600) + ', no castelo; sem ervas em ' + P.feridos.esperaH + ' h, morrem. Curar custa ' + P.feridos.ervas * P.valor.ervas + ' de valor, ' + r0(100 * P.feridos.ervas * P.valor.ervas / valorDe(U.lanceiro.custo)) + '% de um lanceiro, e devolve a pessoa. No caso dos 8 arqueiros sem bônus, as perdas caem de ' + r0(resCasos[9].perdaA * 100) + '% para ' + r0(resCasos[9].perdaA * (1 - P.feridos.frac) * 100) + '%.');
out('- **Teto de bônus**: a soma de armas ou armaduras (+' + r0(BONUS.armas * 100) + '%), veterania (+' + r0(BONUS.vet * 100) + '%), relíquia (+' + P.reliquia.ataque * 100 + '% ataque, +' + P.reliquia.resistencia * 100 + '% resistência), lendário (+' + r0(BONUS.lend * 100) + '%) e legado (+' + r0(BONUS.leg * 100) + '%) chega a +' + r0(BONUS.maxAtk * 100) + '% no ataque e +' + r0(BONUS.maxDef * 100) + '% na defesa; vale até +' + P.tetoBonus * 100 + '%. Torres e portões ficam fora do teto. Com o teto, um exército no máximo vence uma defesa até ' + (1 + P.tetoBonus) + '× maior e perde para 2×.\n');

/* ---------- fauna, caça, exploradores, rotas e espionagem ---------- */
const chanceEspiao = (torres, tropas) => Math.min(P.espiao.max, P.espiao.base + torres * P.espiao.porTorre + tropas * P.espiao.porTropa);
const riscoFauna = (nivel, forca) => forca >= 2 * P.fauna[nivel] ? 'nenhum' : forca >= P.fauna[nivel] ? ['nenhum', 'baixo', 'medio'][['baixo', 'medio', 'alto'].indexOf(nivel)] : nivel;
const NIVEL_NOME = { nenhum: 'nenhum', baixo: 'baixo', medio: 'médio', alto: 'alto' };
out('## Fauna, caça, exploradores, rotas e espionagem\n');
out('Fauna: força ' + P.fauna.baixo + ' / ' + P.fauna.medio + ' / ' + P.fauna.alto + ' (baixo, médio, alto); bandos de ' + Math.min(...Object.values(P.faunaServ.bando).map(b => b[0])) + ' a ' + Math.max(...Object.values(P.faunaServ.bando).map(b => b[1])) + ' animais. Chance de ataque por região atravessada: ' + Object.entries(P.ataqueFauna).map(([k, v]) => NIVEL_NOME[k] + ' ' + r0(v * 100) + '%').join(', ') + '. Num ataque, o grupo perde ' + r0(P.perdaFauna.acima * 100) + '% se tiver força acima do limite e ' + r0(P.perdaFauna.abaixo * 100) + '% se abaixo; um explorador sozinho morre. O bando abatido volta em ' + P.faunaVoltaH + ' h.\n');
out('| Grupo | Força | Perigo baixo | Perigo médio | Perigo alto |');
out('|---|---|---|---|---|');
[['Explorador a pé', P.exploradores.pe.forca], ['Explorador a cavalo', P.exploradores.cavalo.forca], ['Explorador + 2 lanceiros de escolta', P.exploradores.cavalo.forca + 2 * (U.lanceiro.atk + U.lanceiro.def) / 2],
 ['2 lanceiros', forcaFauna({ lanceiro: 2 })], ['4 lanceiros (extração)', forcaFauna({ lanceiro: 4 })], ['12 arqueiros', forcaFauna({ arqueiro: 12 })]].forEach(([rot, f]) => {
  out('| ' + rot + ' | ' + r0(f) + ' | ' + ['baixo', 'medio', 'alto'].map(n => { const r = riscoFauna(n, f); return r === 'nenhum' ? 'ileso' : 'risco ' + NIVEL_NOME[r]; }).join(' | ') + ' |');
});
out('\n**Caça** (por bando abatido; ' + P.cacaMin + ' min no local):\n');
out('| Animal | Perigo | Comida | Couro | Peles | Valor | Grupo para ir ileso |');
out('|---|---|---|---|---|---|---|');
Object.entries(P.caca).forEach(([k, c]) => {
  out('| ' + k[0].toUpperCase() + k.slice(1) + ' | ' + NIVEL_NOME[c.nivel] + ' | ' + c.comida + ' | ' + c.couro + ' | ' + c.peles + ' | ' + valorDe({ comida: c.comida, couro: c.couro, peles: c.peles }) + ' | ' + Math.ceil(2 * P.fauna[c.nivel] / ((U.arqueiro.atk + U.arqueiro.def) / 2)) + ' arqueiros |');
});
const couroDemanda = sims.medio.log[35].tropas * (U.arqueiro.custo.couro / 3 + U.cavalaria.custo.couro / 6) / 35;
out('\nCouro: ' + P.cacasDia + ' caçada' + (P.cacasDia > 1 ? 's' : '') + ' por dia rende' + (P.cacasDia > 1 ? 'm' : '') + ' ≈ ' + r1(P.cacasDia * couroMedioCaca()) + '; o médio usa ≈ ' + r1(couroDemanda) + ' por dia para recrutar (1/3 arqueiros, 1/6 cavalaria).\n');
out('**Exploradores** (pessoas do reino; 1 de população cada):\n');
out('| Tipo | Custo | Valor | Treino | Velocidade | Visão | Força contra fauna |');
out('|---|---|---|---|---|---|---|');
Object.values(P.exploradores).forEach(x => out('| ' + x.nome + ' | ' + fmtC(x.custo) + ' | ' + valorDe(x.custo) + ' | ' + fmtT(x.tempo) + ' | ' + x.vel + ' | ' + x.visao + (x.jazidas ? ' (jazidas a ' + x.jazidas + ')' : '') + ' | ' + x.forca + ' |'));
const rota10 = 20 * soma(P.rota.custo);
out('\n**Rotas**: ' + fmtC(P.rota.custo) + ' e ' + fmtT(P.rota.tempo) + ' por hexágono, multiplicados pelo terreno (' + Object.entries(P.terreno).map(([k, v]) => ({ planicie: 'planície', pantano: 'pântano' }[k] || k) + ' ×' + v).join(', ') + '). **Ponte** (hexágono de rio): ' + fmtC(P.ponte.custo) + ', ' + fmtT(P.ponte.tempo) + '. Vau: grátis e mais lento. 20 hexágonos de rota em planície (a distância de 10 hexágonos antigos): ' + rota10 + ' (' + r1(rota10 / prodDia(14)) + ' h de produção do médio no dia 14).\n');
out('**Espionagem**: chance de o batedor ser visto ao espionar = ' + r0(P.espiao.base * 100) + '% + ' + r0(P.espiao.porTorre * 100) + '% por torre no alcance + ' + r1(P.espiao.porTropa * 100) + '% por tropa da guarnição, até ' + r0(P.espiao.max * 100) + '%. Visto, metade das vezes é capturado (sem relatório); na outra, foge com o relatório. Em ambos os casos, o alvo vê o espião por 10 h. ' + fmtT(P.espiao.tempoNoLocal) + ' no local.\n');
out('| Alvo | Chance de ser visto |');
out('|---|---|');
[['Local sem torre e sem tropas', 0, 0], ['Mina com 4 lanceiros e 1 torre', 1, 4], ['Castelo médio (12 tropas, 2 torres)', 2, 12]].forEach(([rot, t, n]) => out('| ' + rot + ' | ' + r0(chanceEspiao(t, n) * 100) + '% |'));
out('');

/* ---------- vida e fauna como dano ---------- */
const NIVEIS_F = ['baixo', 'medio', 'alto'];
const golpeMax = n => P.vida.golpe[n] * (1 + P.vida.variacao);
const morteExp = (oficio, n) => chanceGolpeMata(n, vidaMax(oficio));                       /* explorador sozinho: 1 golpe por ataque */
const morteCavalo = n => (1 - P.vida.fuga.cavalo) * morteExp('explorador-cavalo', n);
out('## Vida e fauna como dano\n');
out('Cada pessoa tem vida e a recupera inteira em ' + P.vida.recuperaH + ' h, sem tique. Num ataque de fauna no caminho, cada animal do bando ataca uma pessoa diferente do grupo e tira ' +
  NIVEIS_F.map(n => r0(P.vida.golpe[n] * (1 - P.vida.variacao)) + ' a ' + r0(golpeMax(n)) + ' (' + NIVEL_NOME[n] + ')').join(', ') + ' de vida, pelo risco efetivo do grupo (a força continua reduzindo o risco e, com o dobro, o grupo passa ileso). ' +
  'Morre só quem chega a zero; os feridos seguem andando. O explorador sozinho a cavalo (ou batedor) foge do bando em ' + r0(P.vida.fuga.cavalo * 100) + '% dos ataques. Carregadores perdem carga, não vida. ' +
  'Numa batalha, quem sobrevive perde ' + r0(P.vida.batalha * 100) + '% da vida máxima vezes a fração de perdas do próprio lado, sem morrer por isso.\n');
out('| Ofício | Vida | Recupera por hora |');
out('|---|---|---|');
[['Civil', 'ocioso'], ['Milícia', 'milicia'], ['Lanceiro', 'lanceiro'], ['Arqueiro', 'arqueiro'], ['Cavalaria', 'cavalaria'], ['Cavaleiro de elite', 'elite'], ['Explorador (a pé, a cavalo)', 'explorador-pe'], ['Prospector', 'prospector'], ['Batedor de elite', 'batedor'], ['Mensageiro', 'mensageiro']]
  .forEach(([rot, k]) => out('| ' + rot + ' | ' + vidaMax(k) + ' | ' + r1(vidaMax(k) / P.vida.recuperaH) + ' |'));
out('\n| Explorador sozinho | Morre num ataque do perigo baixo | médio | alto |');
out('|---|---|---|---|');
out('| A pé (vida ' + vidaMax('explorador-pe') + ') | ' + NIVEIS_F.map(n => r0(morteExp('explorador-pe', n) * 100) + '%').join(' | ') + ' |');
out('| A cavalo (foge em ' + r0(P.vida.fuga.cavalo * 100) + '%) | ' + NIVEIS_F.map(n => r0(morteCavalo(n) * 100) + '%').join(' | ') + ' |');
out('\nAntes, o explorador sozinho atacado morria sempre. Agora, um ataque só mata no perigo alto, e a rota segura (padrão dos exploradores) desvia do perigo que o reino conhece. Dois ataques seguidos antes de recuperar a vida podem matar.\n');

/* ---------- coleta e começo ---------- */
const ritmoPorPessoa = coletaH(1), trabN2 = prod(2) / vagas(2);
const esgota4 = P.coleta.estoque / (coletaH(4) - P.coleta.estoque / P.coleta.recuperaH);
out('## Coleta de madeira e pedra no mapa\n');
out('Ordem "coletar": tropas e civis sem trabalho cortam árvores (floresta) ou quebram pedra (colina, montanha) num hexágono explorado sem local. Ritmo do grupo = ' + P.coleta.taxa + ' × pessoas^' + P.coleta.expPessoas +
  ' por hora, até ' + P.coleta.maxPessoas + ' pessoas por hexágono. Um civil leva ' + P.coleta.cargaCivil + ' (um soldado, a carga da unidade). Cada hexágono guarda ' + P.coleta.estoque + ' e se recupera inteiro em ' + P.coleta.recuperaH + ' h.\n');
out('| Grupo | Por hora | Por pessoa | Hexágono de ' + P.coleta.estoque + ' acaba em |');
out('|---|---|---|---|');
[1, 2, 4, 6].forEach(n => { const v = coletaH(n), liq = v - P.coleta.estoque / P.coleta.recuperaH; out('| ' + n + (n === 1 ? ' pessoa' : ' pessoas') + ' | ' + r1(v) + ' | ' + r1(v / n) + ' | ' + (liq > 0 ? fmtT(P.coleta.estoque / liq * 3600) : 'não acaba') + ' |'); });
out('\nUm trabalhador de local nível 2 rende ' + r1(trabN2) + '/h. A coleta vale para quem está sem trabalho (o reino novo tem ' + (P.popInicial - TIPOS.length * vagas(P.inicio.locais)) + ' civis sem vaga) e para tropas paradas; não substitui os locais, que rendem mais por pessoa a partir do nível ' + (Array.from({ length: P.nivelMax }, (_, i) => i + 1).find(L => prod(L) / vagas(L) > ritmoPorPessoa) || '—') + '.\n');
out('### Começo (primeiras ' + COMECO.horas + ' h)\n');
out('Jogador de olho no jogo: sempre que a fila fica livre, começa a melhoria mais barata que pode pagar. Com coleta, os civis sem trabalho cortam madeira e a guarnição inicial quebra pedra a ' + COMECO.distHex + ' hexágonos do castelo. Sem carregadores nem crescimento da população.\n');
out('| Tempo de jogo | Sem coleta: níveis subidos · castelo · nível médio | Com coleta: níveis subidos · castelo · nível médio · coletado |');
out('|---|---|---|');
COMECO.tabela.forEach(h => { const a = comecoSem.marcos[h], b = comecoCom.marcos[h]; out('| ' + fmtT(h * 60) + ' | ' + a.niveis + ' · ' + a.castelo + ' · ' + a.nivelMedio + ' | ' + b.niveis + ' · ' + b.castelo + ' · ' + b.nivelMedio + ' · ' + b.coletado + ' |'); });
const fmtC5 = s => s.castelo5 != null ? 'em ' + fmtT(s.castelo5 * 3600) : 'depois de ' + COMECO.horas + ' h';
out('\nCastelo nível 5: sem coleta ' + fmtC5(comecoSem) + '; com coleta ' + fmtC5(comecoCom) + '. Os primeiros níveis são baratos e rápidos (' + fmtT(tempoObra(2)) + ' a ' + fmtT(tempoObra(5)) + '); o que segura o começo é madeira e pedra, e a coleta resolve.\n');

/* ================================================================ metas */
const kitLanceiros = Math.floor(Math.min(...Object.keys(U.lanceiro.custo).map(k => P.kit[k] / U.lanceiro.custo[k])));
const metas = [
  ['M1a', 'Kit inicial recruta 2 a 3 lanceiros na primeira sessão', kitLanceiros, kitLanceiros >= 2 && kitLanceiros <= 3],
  ['M1b', 'Os lanceiros do kit ficam prontos em até 15 min (a primeira sessão tem o que fazer)', fmtT(kitLanceiros * U.lanceiro.tempo), kitLanceiros * U.lanceiro.tempo <= 15 * 60],
  ['M1c', 'Reino novo começa com tropas que caçam o perigo baixo ilesas e exploradores prontos (nada de esperar a primeira hora)',
    r0(forcaFauna(P.inicio.tropas)) + ' de força · ' + somaQtd(P.inicio.exploradores) + ' exploradores',
    riscoFauna('baixo', forcaFauna(P.inicio.tropas)) === 'nenhum' && somaQtd(P.inicio.exploradores) >= 2],
  ['M2a', 'Primeira melhoria se paga em até 2 h', r1(payback(2)) + ' h', payback(2) <= 2],
  ['M2b', 'Melhoria para o nível ' + P.nivelMax + ' se paga em 1 a 2 semanas (investimento de fim de temporada)', r1(payback(P.nivelMax) / 24) + ' dias', payback(P.nivelMax) >= 168 && payback(P.nivelMax) <= 336],
  ['M3a', 'Obra para o nível 2 leva até 40 s', fmtS(tempoObra(2)), tempoObra(2) <= 40],
  ['M3b', 'Obra para o nível ' + P.nivelMax + ' leva de 2 a 6 h', fmtT(tempoObra(P.nivelMax)), tempoObra(P.nivelMax) >= 2 * 3600 && tempoObra(P.nivelMax) <= 6 * 3600],
  ['M3c', '10 obras de nível 7 a 9 cobrem a noite (7 a 14 h)', fmtT((tempoObra(7) + tempoObra(8) + tempoObra(9)) / 3 * 10), (tempoObra(7) + tempoObra(8) + tempoObra(9)) / 3 * 10 >= 7 * 3600 && (tempoObra(7) + tempoObra(8) + tempoObra(9)) / 3 * 10 <= 14 * 3600],
  ['M4a', 'Vizinho do próprio reino (6 hex.) em até 40 s, tropa lenta', fmtS(viagemMin(6, 'Lenta') * 60), viagemMin(6, 'Lenta') <= 2 / 3],
  ['M4b', 'Reino vizinho (' + P.vizinhoHex + ' hex.) entre 3 e 7 min, tropa lenta', fmtT(viagemMin(P.vizinhoHex, 'Lenta') * 60), viagemMin(P.vizinhoHex, 'Lenta') >= 3 && viagemMin(P.vizinhoHex, 'Lenta') <= 7],
  ['M4c', 'Travessia do mapa (' + P.mapa.cols + ' hex.) em até 30 min, tropa lenta', fmtT(viagemMin(P.mapa.cols, 'Lenta') * 60), viagemMin(P.mapa.cols, 'Lenta') <= 30],
  ['M5a', 'Jogador médio com 4 a 10 soldados e 15 a 25 pessoas no fim do escudo (dia 3)', sims.medio.log[3].tropas + ' · ' + sims.medio.log[3].pop, sims.medio.log[3].tropas >= 4 && sims.medio.log[3].tropas <= 10 && sims.medio.log[3].pop >= 15 && sims.medio.log[3].pop <= 25],
  ['M5b', 'Jogador médio com 20 a 30 soldados e 50 a 80 pessoas no dia 35', sims.medio.log[35].tropas + ' · ' + sims.medio.log[35].pop, sims.medio.log[35].tropas >= 20 && sims.medio.log[35].tropas <= 30 && sims.medio.log[35].pop >= 50 && sims.medio.log[35].pop <= 80],
  ['M5c', 'Jogador ativo com 1,5 a 2,5× as tropas do médio no dia 35', r1(sims.ativo.log[35].tropas / sims.medio.log[35].tropas) + '×', sims.ativo.log[35].tropas / sims.medio.log[35].tropas >= 1.5 && sims.ativo.log[35].tropas / sims.medio.log[35].tropas <= 2.5],
  ['M5d', 'Recrutar não derruba a economia do médio (eficiência ≥ 90% no dia 35)', sims.medio.log[35].efic + '%', sims.medio.log[35].efic >= 90],
  ['M5e', 'Sem guerra, o ativo chega ao máximo da economia perto do dia 20 (entre os dias 17 e 24)', sims.ativo.diaMax ? 'dia ' + sims.ativo.diaMax : 'não chega', sims.ativo.diaMax >= 17 && sims.ativo.diaMax <= 24],
  ['M5f', 'Sem guerra, o médio chega ao máximo depois do ativo, entre os dias 24 e 40', sims.medio.diaMax ? 'dia ' + sims.medio.diaMax : 'não chega', sims.medio.diaMax >= 24 && sims.medio.diaMax <= 40 && sims.medio.diaMax > sims.ativo.diaMax],
  ['M5g', 'Teto prático de um reino: o ativo termina a temporada com 90 a 140 pessoas', sims.ativo.log[70].pop, sims.ativo.log[70].pop >= 90 && sims.ativo.log[70].pop <= 140],
  ['M6', '6 cavaleiros levam pelo menos 40 min de produção de um local nível 6 (o saque vale a viagem de ≈ 2 min)', fmtT(6 * U.cavalaria.carga / prod(6) * 3600), 6 * U.cavalaria.carga / prod(6) >= 2 / 3],
  ['M7a', 'Local defendido cai com cerca de 1,5× a força (arqueiros contra lanceiros)', r1(resCasos[1].razao) + '×', resCasos[1].venceA && resCasos[1].perdaA <= 0.6],
  ['M7b', 'Torre muda o resultado do mesmo ataque', resCasos[2].venceA ? 'não muda' : 'defesa vence', !resCasos[2].venceA],
  ['M7c', 'Castelo médio resiste a 20 tropas e cai com cerca de 2× isso', (resCasos[6].venceA ? 'cai' : 'resiste') + ' / ' + (resCasos[7].venceA ? 'cai' : 'resiste'), !resCasos[6].venceA && resCasos[7].venceA],
  ['M8', 'Relíquia de produção vale menos que 1 nível do local (nível 6)', r1(prod(6) * 0.15) + ' < ' + r1(prod(7) - prod(6)), prod(6) * 0.15 < prod(7) - prod(6)],
  ['M9', 'Tática média recua com 40% e ainda causa perdas na defesa', r0(resCasos[8].perdaD * 100) + '% na defesa', resCasos[8].recuou && resCasos[8].perdaD > 0.05],
  ['M10', 'Bônus somados ficam no teto de +' + P.tetoBonus * 100 + '% (sem teto: +' + r0(BONUS.maxAtk * 100) + '% / +' + r0(BONUS.maxDef * 100) + '%)', r0(100 * (resCasos[11].A / resCasos[9].A - 1)) + '%', BONUS.maxAtk > P.tetoBonus && Math.abs(resCasos[11].A / resCasos[9].A - (1 + P.tetoBonus)) < 0.01],
  ['M11', 'Armas ou armaduras nível 1 só compensam a partir de 10 a 30 tropas da família', equilibrio('cavalaria') + ' a ' + equilibrio('infantaria'), ['infantaria', 'arqueiros', 'cavalaria'].every(f => equilibrio(f) >= 10 && equilibrio(f) <= 30)],
  ['M12', 'Ferraria completa custa 3% a 17% do gasto em obras do médio na temporada (um terço do que pesava antes: a produção triplicou)', r0(100 * valorLinha * nLinhas / sims.medio.gastoObra) + '%', valorLinha * nLinhas / sims.medio.gastoObra >= 0.03 && valorLinha * nLinhas / sims.medio.gastoObra <= 0.17],
  ['M13', 'Extrair valiosos rende por pessoa 1,5 a 3× um trabalhador de local nível 6 (4 lanceiros)', r1(ext4 / 4 / (prod(6) / vagas(6))) + '×', ext4 / 4 / (prod(6) / vagas(6)) >= 1.5 && ext4 / 4 / (prod(6) / vagas(6)) <= 3],
  ['M14', 'O ouro da Era do Aço sai em 1 a 4 h com 4 lanceiros, sem posto', fmtT(P.eras.aco.custo.ouro * P.valor.ouro / ext4 * 3600), P.eras.aco.custo.ouro * P.valor.ouro / ext4 >= 1 && P.eras.aco.custo.ouro * P.valor.ouro / ext4 <= 4],
  ['M15', 'Ouro e aço no mapa cobrem 90% a 150% da demanda típica (escassos, motivo de disputa)', r0(100 * ofOuro / (demOuro * P.reinos)) + '% / ' + r0(100 * ofAco / (demAco * P.reinos)) + '%', [ofOuro / (demOuro * P.reinos), ofAco / (demAco * P.reinos)].every(x => x >= 0.9 && x <= 1.5)],
  ['M16', 'Era do Aço custa 30 min a 1 h 20 de produção do médio no dia ' + P.eras.aco.dia + '; Era do Cerco, 1 h a 2 h 40 no dia ' + P.eras.cerco.dia + ' (sem o ouro)', Object.values(P.eras).map(e => fmtT((valorDe(e.custo) - e.custo.ouro * P.valor.ouro) / prodDia(e.dia) * 3600)).join(' / '),
    (x => x >= 0.5 && x <= 4 / 3)((valorDe(P.eras.aco.custo) - P.eras.aco.custo.ouro * P.valor.ouro) / prodDia(P.eras.aco.dia)) && (x => x >= 1 && x <= 8 / 3)((valorDe(P.eras.cerco.custo) - P.eras.cerco.custo.ouro * P.valor.ouro) / prodDia(P.eras.cerco.dia))],
  ['M17', 'Curar um ferido custa 25% a 60% de recrutar um lanceiro', r0(100 * P.feridos.ervas * P.valor.ervas / valorDe(U.lanceiro.custo)) + '%', (x => x >= 0.25 && x <= 0.6)(P.feridos.ervas * P.valor.ervas / valorDe(U.lanceiro.custo))],
  ['M18', 'Equipamento lendário vale no máximo 3 tropas', r1(lendTropas) + ' tropas', lendTropas <= 3],
  ['M19', 'Cavaleiro de elite: mais ataque por pessoa e menos por valor que a cavalaria', U.elite.atk + ' > ' + U.cavalaria.atk + ' · ' + r1(100 * U.elite.atk / valorDe(U.elite.custo)) + ' < ' + r1(100 * U.cavalaria.atk / valorDe(U.cavalaria.custo)),
    U.elite.atk > U.cavalaria.atk && U.elite.atk / valorDe(U.elite.custo) < U.cavalaria.atk / valorDe(U.cavalaria.custo)],
  ['M20', 'Reino sob escudo recebe no máximo 30% do que ele mesmo produz no escudo', r0(100 * recebivelNovato / sims.medio.prodEscudo) + '%', recebivelNovato / sims.medio.prodEscudo <= 0.3],
  ['M21', 'Depois de perder o castelo no dia 35, o médio volta ao nível anterior em 0,5 a 3 dias', quedaS.recupCastelo != null ? quedaS.recupCastelo + ' dias' : 'não volta', quedaS.recupCastelo >= 0.5 && quedaS.recupCastelo <= 3],
  ['M22', 'Explorador sozinho é atacado em qualquer perigo, mas um ataque só mata no alto: 20% a 50% das vezes a pé, até 25% a cavalo (foge); 2 lanceiros passam ilesos pelo baixo; 12 arqueiros, até pelo alto',
    r0(morteExp('explorador-pe', 'alto') * 100) + '% / ' + r0(morteCavalo('alto') * 100) + '%',
    ['baixo', 'medio', 'alto'].every(n => riscoFauna(n, P.exploradores.pe.forca) !== 'nenhum') && morteExp('explorador-pe', 'baixo') === 0 && morteExp('explorador-pe', 'medio') === 0
      && morteExp('explorador-pe', 'alto') >= 0.2 && morteExp('explorador-pe', 'alto') <= 0.5 && morteCavalo('alto') <= 0.25
      && riscoFauna('baixo', forcaFauna({ lanceiro: 2 })) === 'nenhum' && riscoFauna('alto', forcaFauna({ arqueiro: 12 })) === 'nenhum'],
  ['M23', P.cacasDia + ' caçada' + (P.cacasDia > 1 ? 's' : '') + ' por dia cobre' + (P.cacasDia > 1 ? 'm' : '') + ' 70% a 150% do couro que o médio usa para recrutar', r0(100 * P.cacasDia * couroMedioCaca() / couroDemanda) + '%', (x => x >= 0.7 && x <= 1.5)(P.cacasDia * couroMedioCaca() / couroDemanda)],
  ['M24', '20 hexágonos de rota em planície custam 10 min a 1 h de produção do médio no dia 14', fmtT(rota10 / prodDia(14) * 3600), (x => x >= 1 / 6 && x <= 1)(rota10 / prodDia(14))],
  ['M25', 'Espionar um local defendido: 25% a 40% de ser visto; um castelo médio chega ao máximo', r0(chanceEspiao(1, 4) * 100) + '% / ' + r0(chanceEspiao(2, 12) * 100) + '%', chanceEspiao(1, 4) >= 0.25 && chanceEspiao(1, 4) <= 0.4 && chanceEspiao(2, 12) >= P.espiao.max],
  ['M26', 'Sem coleta, o reino novo sobe pelo menos 6 níveis na primeira hora', comecoSem.marcos[60].niveis + ' níveis', comecoSem.marcos[60].niveis >= 6],
  ['M27', 'Com coleta, sobe pelo menos 8 níveis nos primeiros 40 min e chega ao castelo 5 em até 2 h 40', comecoCom.marcos[40].niveis + ' níveis · ' + (comecoCom.castelo5 != null ? fmtT(comecoCom.castelo5 * 3600) : 'não chega'),
    comecoCom.marcos[40].niveis >= 8 && comecoCom.castelo5 != null && comecoCom.castelo5 <= 8 / 3 && (comecoSem.castelo5 == null || comecoSem.castelo5 > comecoCom.castelo5)],
  ['M28', 'Coleta rende por pessoa 0,8 a 1,5× um trabalhador de local nível 2 (vale para quem está sem trabalho, sem substituir os locais)', r1(ritmoPorPessoa / trabN2) + '×', (x => x >= 0.8 && x <= 1.5)(ritmoPorPessoa / trabN2)],
  ['M29', 'Um hexágono com 4 coletores se esgota em 1 h a 2 h 40 e se recupera inteiro em 4 a 12 h', fmtT(esgota4 * 3600) + ' · ' + P.coleta.recuperaH + ' h', esgota4 >= 1 && esgota4 <= 8 / 3 && P.coleta.recuperaH >= 4 && P.coleta.recuperaH <= 12],
  ['M30', 'A vida volta inteira em 1 h 20 a 2 h 40; um ataque do perigo alto não mata ninguém de um grupo de lanceiros', P.vida.recuperaH + ' h · golpe até ' + r0(golpeMax('alto')) + ' < ' + vidaMax('lanceiro'),
    P.vida.recuperaH >= 4 / 3 && P.vida.recuperaH <= 8 / 3 && golpeMax('alto') < vidaMax('lanceiro')],
  ['M31', 'Batalha sem tempo fixo: 50 contra 1 acaba em até 30 s; 20 contra 20 leva de 3 a 6 min; nenhuma passa de 10 min',
    fmtS(duracaoBatalha(1, 0.02)) + ' · ' + fmtS(duracaoBatalha(20, 1)) + ' · ' + fmtS(duracaoBatalha(500, 1)),
    duracaoBatalha(1, 0.02) <= 30 && duracaoBatalha(20, 1) >= 180 && duracaoBatalha(20, 1) <= 360 && duracaoBatalha(500, 1) <= 600]
];
out('## Metas verificadas\n');
out('| | Meta | Resultado | |');
out('|---|---|---|---|');
metas.forEach(m => out('| ' + m[0] + ' | ' + m[1] + ' | ' + m[2] + ' | ' + (m[3] ? '✓' : '✗') + ' |'));
const falhas = metas.filter(m => !m[3]).length;
out('\n' + (falhas ? falhas + ' meta(s) fora do alvo.' : 'Todas as metas no alvo.'));
/* ================================================================ configuração do servidor
   node balanceamento/modelo.js --json > balanceamento/config.json
   Os mesmos P, U e VEICULOS, mais valores de referência calculados pelas fórmulas do modelo,
   usados pelos testes do servidor para conferir que as fórmulas dele batem com as daqui. */
if (process.argv.includes('--json')) {
  const Pj = JSON.parse(JSON.stringify(P));
  Pj.torre.alcanceBase = P.torre.alcance(0);                 /* alcance = nível × alcancePorNivel + alcanceBase */
  Pj.torre.alcancePorNivel = P.torre.alcance(1) - P.torre.alcance(0);
  const niveis = Array.from({ length: P.nivelMax }, (_, i) => i + 1);
  const ref = {
    producao: niveis.map(prod), castelo: niveis.map(castelo),
    custo: niveis.map(n => n > 1 ? custo(n) : 0), receita: niveis.map(n => n > 1 ? receita(custo(n)) : null),
    tempoObra: niveis.map(n => n > 1 ? tempoObra(n) : 0),
    vagas: niveis.map(vagas),
    moradia: [0, 1, 2, 5, 10].map(n => ({ n, custo: custoMoradia(n), tempo: tempoMoradia(n) })),
    novoLocal: [0, 1, 2, 5].map(n => ({ n, custo: receita(P.custoNovoLocal * Math.pow(P.novoLocalCresc, n)) })),
    viagem: [[4, 'Lenta', false], [P.vizinhoHex, 'Lenta', false], [P.mapa.cols, 'Lenta', false], [10, 'Rápida', true], [10, 'Média', false]]
      .map(([h, v, r]) => ({ hexes: h, vel: v, rota: r, min: viagemMin(h, v, r) })),
    batalhas: casos.map(([rot, a, d, x, lim], i) => ({ rot, atk: a, def: d, extra: x, limite: lim == null ? null : lim, res: resCasos[i] })),
    extracao: [[{ lanceiro: 1 }, false, false], [{ lanceiro: 4 }, false, false], [{ lanceiro: 6 }, false, false], [{ lanceiro: 6 }, true, false],
      [{ cavalaria: 3 }, true, true], [{ lanceiro: 9 }, false, false]].map(([g, p, r]) => ({ grupo: g, posto: p, rota: r, valorH: extracaoH(g, p, r) })),
    espiao: [[0, 0], [1, 4], [2, 12], [10, 100]].map(([t, n]) => ({ torres: t, tropas: n, chance: chanceEspiao(t, n) })),
    fauna: [['baixo', 10], ['baixo', 65], ['medio', 130], ['alto', 360], ['alto', 180], ['medio', 239]].map(([nv, f]) => ({ nivel: nv, forca: f, risco: riscoFauna(nv, f) })),
    forcaFauna: [{ lanceiro: 4 }, { arqueiro: 12 }, { lanceiro: 2 }].map(g => ({ grupo: g, forca: forcaFauna(g) })),
    torres: Array.from({ length: P.torre.nivelMax }, (_, i) => i + 1).map(n => { const c = P.torre.custoN1 * Math.pow(P.torre.custoCresc, n - 1);
      return { nivel: n, alcance: P.torre.alcance(n), arqueiros: n * P.torre.arqPorNivel, custo: { pedra: r0(c * 0.7), madeira: r0(c * 0.3) }, tempo: P.torre.tempoN1 * n, estrutura: n * P.torre.estrutura }; }),
    jazidas: Object.keys(VAL).map(k => ({ recurso: k, tamanho: tamJazida(k), quantidade: nJazidas(k) })),
    coleta: [0, 1, 2, 4, 6, 9].map(n => ({ pessoas: n, porHora: coletaH(n) })),
    vida: ['ocioso', 'agricultor', 'lanceiro', 'elite', 'explorador-pe', 'explorador-cavalo', 'mensageiro', 'desconhecido'].map(o => ({ oficio: o, max: vidaMax(o) })),
    duracaoBatalha: [[1, 0.02], [4, 0.9], [7, 0.73], [20, 1], [22, 0.82], [50, 1], [0, 1], [10, 0], [500, 1]].map(([n, r]) => ({ tropas: n, razao: r, seg: duracaoBatalha(n, r) })),
    metasOk: falhas === 0
  };
  process.stdout.write(JSON.stringify({ gerado: 'node balanceamento/modelo.js --json', P: Pj, U, VEICULOS, referencia: ref }, null, 1) + '\n');
} else {
  process.stdout.write(L.join('\n') + '\n');
}
if (falhas) process.exitCode = 1;
