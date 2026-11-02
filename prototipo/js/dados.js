/* Reino de Pedra — dados fictícios e fixos do protótipo (mock): um reino no dia 34 da temporada.
   Custos, tempos e rendimentos seguem balanceamento/README.md; o resto é exemplo para preencher as telas.
   Tempos ("seg") são contados a partir da abertura da página. */
(function () {
  'use strict';
  var RP = (window.RP = window.RP || {});

  RP.dados = {
    temporada: { numero: 3, nome: 'Temporada do Ferro Frio', diasRestantes: 36, reinos: 30, limiteReinos: 30 },

    jogador: {
      reino: 'meu',
      nome: 'Pedralva',
      brasao: { forma: 'portugues', divisao: 'pleno', cor1: 'azul', cor2: 'prata', simbolo: 'torre', corSimbolo: 'prata' },
      linhagem: { nivel: 4, titulo: 'Senhor das Pedras' }
    },

    recursos: {
      madeira: { nome: 'Madeira', qtd: 2340, cap: 5000, taxa: 180 },
      pedra: { nome: 'Pedra', qtd: 1120, cap: 5000, taxa: 95 },
      comida: { nome: 'Comida', qtd: 4870, cap: 5000, taxa: 120 },
      ferro: { nome: 'Ferro', qtd: 640, cap: 5000, taxa: 42 },
      couro: { nome: 'Couro', qtd: 120, cap: 2000, taxa: 0, origem: 'Obtido pela caça' },
      peles: { nome: 'Peles', qtd: 45, cap: 2000, taxa: 0, origem: 'Obtidas pela caça' }
    },
    valiosos: [
      { id: 'ouro', nome: 'Ouro', uso: 'Eras; armas e armaduras do nível 3' },
      { id: 'prata', nome: 'Prata', uso: 'Moeda de troca padrão' },
      { id: 'aco', nome: 'Aço de qualidade', uso: 'Armas e armaduras dos níveis 2 e 3; equipamento lendário' },
      { id: 'cavalo', nome: 'Cavalos de raça', uso: 'Cavaleiro de elite (1 por unidade) e carroção (2)' },
      { id: 'sal', nome: 'Sal', uso: 'Salgadeira: o local de comida guarda 20 h de comida em vez de 10 h' },
      { id: 'ervas', nome: 'Ervas raras', uso: 'Curar feridos (5 por ferido)' },
      { id: 'gema', nome: 'Pedras preciosas', uso: 'Troca de alto valor; brasões e estandartes (só cosméticos)' },
      { id: 'minerio', nome: 'Minério raro', uso: 'Equipamento lendário', lendario: true }
    ],
    /* Valor de referência em recursos básicos (balanceamento): orienta trocas e limites; não é preço fixo */
    valorRef: { madeira: 1, pedra: 1, comida: 1, ferro: 1, couro: 2, peles: 2, sal: 6, ervas: 8, prata: 10, aco: 15, ouro: 20, gema: 30, cavalo: 40, minerio: 60 },
    /* Estoques por local (no início da sessão). Recursos só podem ser usados onde estão;
       cada local acumula a própria produção. Valiosos ficam no Armazém Real. */
    estoques: {
      castelo: { madeira: 820, pedra: 410, comida: 1500, ferro: 210, couro: 80, peles: 30 },
      quartel: { madeira: 900, comida: 900, ferro: 300, couro: 120 },
      armazem: { madeira: 600, pedra: 300, comida: 1200, ferro: 160, couro: 40, peles: 15, ouro: 64, prata: 120, aco: 95, cavalo: 6, sal: 40, ervas: 20, gema: 6 },
      ferraria: { ferro: 1400, madeira: 500, couro: 60 },
      'vila-moinho': { comida: 900 },
      pasto: { comida: 300 },
      'mina-vale': { ferro: 180 },
      'mina-pedra': { pedra: 410 },
      serraria: { madeira: 540 },
      'vila-vau': { comida: 120, madeira: 340, pedra: 160 }
    },
    /* Veículos de transporte: ficam no castelo; saem para buscar e levar cargas */
    veiculos: {
      carroca: { nome: 'Carroça', qtd: 3, carga: 500, vel: 'Lenta', txt: 'Puxada a boi. Barata, lenta.' },
      carrocao: { nome: 'Carroção', qtd: 0, carga: 1500, vel: 'Média', txt: 'Puxado a cavalos de raça. Leva três vezes mais.' }
    },
    /* Caravanas em andamento (exemplo): carga reservada na origem, entregue ao chegar */
    caravanas: [],
    /* Torres de arqueiros: construções próprias com alcance; protegem os locais do mesmo dono em volta.
       Alcance = nível + 1 hexágonos; 6 arqueiros por nível. Podem ser derrubadas (aríetes). */
    torres: [
      { id: 'to-vale', nome: 'Torre do Vale', dono: 'meu', c: 13, l: 17, nivel: 2 },
      { id: 'to-moinho', nome: 'Torre do Moinho', dono: 'meu', c: 17, l: 18, nivel: 1 },
      { id: 'to-vmina', nome: 'Torre', dono: 'valdren', c: 33, l: 11, nivel: 1 }
    ],
    /* Avistamentos: o que suas tropas viram passar (espiões, exércitos). Somem do mapa depois de 10 h. */
    avistamentos: [
      { id: 'av-espiao', tipo: 'espiao', c: 15, l: 26, horas: 3, por: 'Guarnição da Vila do Vau', rumo: 'leste' },
      { id: 'av-exercito', tipo: 'exercito', c: 21, l: 22, horas: 7.5, por: 'Prospector', resumo: '≈ 40 tropas, sem estandarte', rumo: 'sul' },
      { id: 'av-antigo', tipo: 'espiao', c: 9, l: 16, horas: 11, por: 'Guarnição do Quartel', rumo: 'norte' }
    ],

    populacao: {
      atual: 1240, teto: 1500, taxa: 18, bonusComida: 30,
      moradias: [{ local: 'Castelo de Pedralva', qtd: 2 }, { local: 'Vila do Moinho', qtd: 3 }, { local: 'Vila do Vau', qtd: 1 }]
    },

    reinos: {
      meu: { nome: 'Pedralva', cor: 'meu', brasao: null },
      valdren: { nome: 'Casa Valdren', cor: 'rival-1', brasao: { forma: 'classico', divisao: 'partido', cor1: 'vermelho', cor2: 'ouro', simbolo: 'estrela', corSimbolo: 'negro' } },
      corvo: { nome: 'Ordem do Corvo', cor: 'rival-2', brasao: { forma: 'redondo', divisao: 'cortado', cor1: 'negro', cor2: 'purpura', simbolo: 'lua', corSimbolo: 'prata' } },
      lumen: { nome: 'Casa Lúmen', cor: 'aliado', brasao: { forma: 'portugues', divisao: 'cortado', cor1: 'verde', cor2: 'prata', simbolo: 'estrela', corSimbolo: 'ouro' } },
      fenda: { nome: 'Baronia da Fenda', cor: 'aliado', novato: { horas: 30 }, brasao: { forma: 'classico', divisao: 'banda', cor1: 'castanho', cor2: 'ouro', simbolo: 'chave', corSimbolo: 'negro' } },
      mirante: { nome: 'Casa Mirante', cor: 'rival-1', brasao: { forma: 'portugues', divisao: 'cortado', cor1: 'verde', cor2: 'ouro', simbolo: 'espada', corSimbolo: 'prata' } },
      desconhecido: { nome: 'Dono desconhecido', cor: 'desconhecido', brasao: null }
    },

    /* Locais: c,l = coluna/linha no mapa. terreno força o tipo do hex. */
    locais: [
      { id: 'castelo', reino: 'meu', tipo: 'castelo', nome: 'Castelo de Pedralva', c: 14, l: 19, terreno: 'planicie', nivel: 8,
        info: ['Portões nível 3', 'Moradias: 2'], guarnicao: '20 lanceiros · 15 arqueiros', postura: 'Apenas defender' },
      { id: 'quartel', reino: 'meu', tipo: 'quartel', nome: 'Quartel da Guarda', c: 12, l: 17, terreno: 'planicie', nivel: 6,
        info: ['Recrutando 10 arqueiros'], fila: { rotulo: '10 arqueiros', seg: 1200, total: 2100 }, guarnicao: '8 milicianos', postura: 'Apenas defender' },
      { id: 'armazem', reino: 'meu', tipo: 'armazem', nome: 'Armazém Real', c: 15, l: 16, terreno: 'planicie', nivel: 7,
        info: ['Guarda até 12.000 por recurso'], guarnicao: '—', postura: 'Apenas defender' },
      { id: 'ferraria', reino: 'meu', tipo: 'ferraria', nome: 'Ferraria do Rei', c: 16, l: 20, terreno: 'planicie', nivel: 7,
        info: ['Era do Aço', 'Forjando armaduras de infantaria'], guarnicao: '4 milicianos', postura: 'Apenas defender' },
      { id: 'vila-moinho', reino: 'meu', tipo: 'vila', nome: 'Vila do Moinho', c: 18, l: 18, terreno: 'planicie', nivel: 8,
        info: ['Moradias: 3', '+188 comida/h'], prod: { r: 'comida', v: 188 }, guarnicao: '12 lanceiros', postura: 'Atacar quem atacar' },
      { id: 'pasto', reino: 'meu', tipo: 'pasto', nome: 'Pasto das Éguas', c: 18, l: 14, terreno: 'planicie', nivel: 6,
        info: ['+111 comida/h', '14 cavalos'], prod: { r: 'comida', v: 111 }, guarnicao: '6 milicianos', postura: 'Apenas defender', ameaca: 'inimigo-desconhecido' },
      { id: 'mina-vale', reino: 'meu', tipo: 'mina', nome: 'Mina do Vale', c: 10, l: 21, terreno: 'colina', nivel: 7,
        info: ['+145 ferro/h', 'Jazida: 68% restante'], prod: { r: 'ferro', v: 145 }, jazida: 0.68, guarnicao: '12 lanceiros', postura: 'Apenas defender' },
      { id: 'mina-pedra', reino: 'meu', tipo: 'mina', nome: 'Mina de Pedra Alta', c: 11, l: 24, terreno: 'colina', nivel: 7,
        info: ['+145 pedra/h', 'Jazida: 81% restante'], prod: { r: 'pedra', v: 145 }, jazida: 0.81, guarnicao: '5 milicianos', postura: 'Apenas defender' },
      { id: 'serraria', reino: 'meu', tipo: 'serraria', nome: 'Serraria do Bosque', c: 15, l: 23, terreno: 'floresta', nivel: 8,
        info: ['+188 madeira/h'], prod: { r: 'madeira', v: 188 }, obra: { rotulo: 'Serraria nível 9', seg: 6000, total: 15360 }, guarnicao: '6 milicianos', postura: 'Apenas defender' },
      { id: 'vila-vau', reino: 'meu', tipo: 'vila', nome: 'Vila do Vau', c: 13, l: 27, terreno: 'planicie', nivel: 4,
        info: ['Moradias: 1'], guarnicao: '4 milicianos', postura: 'Apenas defender' },

      { id: 'v-castelo', reino: 'valdren', tipo: 'castelo', nome: 'Castelo Valdren', c: 32, l: 8, terreno: 'planicie', nivel: '?', info: ['Portões altos'] },
      { id: 'v-mina', reino: 'valdren', tipo: 'mina', nome: 'Mina Rubra', c: 33, l: 12, terreno: 'colina', nivel: '?', info: ['Ferro'],
        espionado: { horas: 10, defesa: '≈ 15 lanceiros e uma torre de arqueiros', estoque: { ferro: 2400, pedra: 600, comida: 300 } } },
      { id: 'v-vila', reino: 'valdren', tipo: 'vila', nome: 'Vila Alta', c: 30, l: 6, terreno: 'planicie', nivel: '?' },
      { id: 'v-pasto', reino: 'valdren', tipo: 'pasto', nome: 'Pasto Leste', c: 35, l: 9, terreno: 'planicie', nivel: '?' },
      { id: 'v-serraria', reino: 'valdren', tipo: 'serraria', nome: 'Serraria Velha', c: 29, l: 14, terreno: 'floresta', nivel: '?' },
      { id: 'v-quartel', reino: 'valdren', tipo: 'quartel', nome: 'Acampamento', c: 30, l: 10, terreno: 'planicie', nivel: '?' },

      { id: 'c-castelo', reino: 'corvo', tipo: 'castelo', nome: 'Fortaleza do Corvo', c: 35, l: 27, terreno: 'planicie', nivel: '?' },
      { id: 'c-vila', reino: 'corvo', tipo: 'vila', nome: 'Vila Negra', c: 33, l: 29, terreno: 'planicie', nivel: '?' },
      { id: 'c-mina', reino: 'corvo', tipo: 'mina', nome: 'Mina Funda', c: 38, l: 30, terreno: 'colina', nivel: '?' },
      { id: 'c-serraria', reino: 'corvo', tipo: 'serraria', nome: 'Serraria', c: 36, l: 23, terreno: 'floresta', nivel: '?' },
      { id: 'c-armazem', reino: 'corvo', tipo: 'armazem', nome: 'Armazém', c: 33, l: 25, terreno: 'planicie', nivel: '?' },

      { id: 'a-castelo', reino: 'lumen', tipo: 'castelo', nome: 'Castelo de Lúmen', c: 10, l: 30, terreno: 'planicie', nivel: 3 },
      { id: 'f-castelo', reino: 'fenda', tipo: 'castelo', nome: 'Forte da Fenda', c: 3, l: 12, terreno: 'planicie', nivel: 4 },
      { id: 'mi-castelo', reino: 'mirante', tipo: 'castelo', nome: 'Castelo Mirante', c: 27, l: 22, terreno: 'planicie', nivel: '?' },
      { id: 'x-mina', reino: 'desconhecido', tipo: 'mina', nome: 'Mina', c: 7, l: 5, terreno: 'colina', nivel: '?', escudo: true }
    ],

    /* Recursos valiosos e lendários descobertos (finitos) */
    jazidas: [
      { id: 'j-ouro', tipo: 'ouro', classe: 'valioso', nome: 'Veio de ouro', c: 25, l: 12, terreno: 'montanha', restante: 0.92 },
      { id: 'j-prata', tipo: 'prata', classe: 'valioso', nome: 'Jazida de prata', c: 23, l: 16, terreno: 'colina', restante: 0.74 },
      { id: 'j-sal', tipo: 'sal', classe: 'valioso', nome: 'Salina', c: 9, l: 29, terreno: 'planicie', restante: 0.55 },
      { id: 'j-cavalos', tipo: 'cavalo', classe: 'valioso', nome: 'Manada de cavalos de raça', c: 21, l: 10, terreno: 'planicie', restante: 0.6 },
      { id: 'j-ervas', tipo: 'ervas', classe: 'valioso', nome: 'Ervas raras', c: 6, l: 27, terreno: 'pantano', restante: 0.8 },
      { id: 'j-gema', tipo: 'gema', classe: 'valioso', nome: 'Pedras preciosas', c: 24, l: 6, terreno: 'montanha', restante: 0.88 },
      { id: 'j-aco', tipo: 'aco', classe: 'valioso', nome: 'Veio de ferro puro (aço)', c: 10, l: 14, terreno: 'colina', restante: 0.66 },
      { id: 'j-minerio', tipo: 'minerio', classe: 'raro', nome: 'Veio de minério raro', c: 21, l: 5, terreno: 'montanha', restante: 1 },
      { id: 'j-ruina', tipo: 'ruina', classe: 'lendario', nome: 'Ruínas antigas', c: 28, l: 20, terreno: 'colina', restante: 1 }
    ],

    /* Rotas públicas (qualquer jogador usa) */
    rotas: [
      { id: 'r-rei', nome: 'Estrada do Rei', por: 'meu', pts: [[14, 19], [17, 18], [20, 17], [23, 16]] },
      { id: 'r-valdren', nome: 'Caminho do Leste', por: 'valdren', pts: [[32, 8], [29, 11], [26, 13], [23, 16]] },
      { id: 'r-sul', nome: 'Trilha do Sul', por: 'meu', pts: [[14, 19], [13, 23], [13, 27]] }
    ],
    vaus: [{ c: 17, l: 26, nome: 'Vau do Salgueiro' }],

    /* Movimentos no mapa. pos = fração (0–1) do caminho já percorrida. */
    marchas: [
      { id: 'm-inimigo', dono: 'desconhecido', tipo: 'exercito', hostil: true, pts: [[25, 8], [21, 11], [18, 14]], pos: 0.62,
        nome: 'Forças desconhecidas', resumo: '≈ 60 tropas · infantaria e cavalaria', origem: 'nordeste', alvo: 'pasto', seg: 2472 },
      { id: 'm-valdren', dono: 'valdren', tipo: 'exercito', estandarte: true, pts: [[29, 11], [26, 13], [23, 16]], pos: 0.96,
        nome: 'Exército de Casa Valdren', resumo: '≈ 35 tropas · lanceiros, pela rota pública', alvo: 'j-prata', seg: 600 },
      { id: 'm-extracao', dono: 'meu', tipo: 'exercito', pts: [[14, 19], [13, 23], [12, 27], [9, 29]], pos: 0.45,
        nome: 'Grupo de extração', resumo: '20 lanceiros → Salina', alvo: 'j-sal', seg: 1080 },
      { id: 'm-cavalo', dono: 'meu', tipo: 'explorador', sub: 'cavalo', pts: [[18, 14], [20, 11], [21, 7], [19, 4]], pos: 0.5,
        nome: 'Explorador a cavalo', resumo: 'Ordem: explorar área', seg: 1520 },
      { id: 'm-prospector', dono: 'meu', tipo: 'explorador', sub: 'prospector', pts: [[20, 17], [22, 17], [24, 18], [25, 20]], pos: 0.4,
        nome: 'Prospector', resumo: 'Ordem: seguir rota · procura jazidas', seg: 2950 }
    ],

    bandeiras: [
      { id: 'b-1', reino: 'valdren', tipo: 'reivindicacao', texto: 'Este ouro é de Valdren.', c: 26, l: 11 },
      { id: 'b-2', reino: 'meu', tipo: 'aviso', texto: 'Estrada do Rei: passagem livre.', c: 20, l: 15 },
      { id: 'b-3', reino: 'corvo', tipo: 'ameaca', texto: 'Daqui ninguém passa.', c: 31, l: 24 },
      { id: 'b-4', reino: 'valdren', tipo: 'alianca', texto: 'Aceitamos tratados.', c: 28, l: 9 },
      { id: 'b-5', reino: 'mirante', tipo: 'aviso', texto: 'Compramos e vendemos. Propostas pelo sino.', c: 24, l: 19 }
    ],

    /* Fauna hostil: grupos por terreno, com território (raio) e nível de perigo.
       Perto dos reinos iniciais a fauna é mais fraca; rotas reduzem a presença. */
    fauna: [
      { id: 'f-lobos-norte', tipo: 'lobos', c: 19, l: 8, raio: 2, qtd: 6, nivel: 'alto' },
      { id: 'f-javalis-bosque', tipo: 'javalis', c: 17, l: 24, raio: 1, qtd: 3, nivel: 'baixo' },
      { id: 'f-crocodilos-rio', tipo: 'crocodilos', c: 18, l: 23, raio: 1, qtd: 2, nivel: 'medio' },
      { id: 'f-ursos-serra', tipo: 'ursos', c: 24, l: 11, raio: 2, qtd: 2, nivel: 'alto' },
      { id: 'f-crocodilos-pantano', tipo: 'crocodilos', c: 6, l: 27, raio: 2, qtd: 4, nivel: 'alto' },
      { id: 'f-lobos-leste', tipo: 'lobos', c: 36, l: 22, raio: 2, qtd: 5, nivel: 'alto' },
      { id: 'f-javalis-oeste', tipo: 'javalis', c: 7, l: 13, raio: 2, qtd: 4, nivel: 'medio' }
    ],

    /* Locais sem dono: ruínas e terra livre (ex.: reino que deixou de existir) */
    ruinas: [
      { id: 'ru-castelo', tipo: 'castelo', nome: 'Ruína de castelo', c: 5, l: 10, terreno: 'planicie' },
      { id: 'ru-vila', tipo: 'vila', nome: 'Ruína de vila', c: 3, l: 12, terreno: 'planicie' },
      { id: 'ru-livre', tipo: 'livre', nome: 'Terra livre', c: 7, l: 9, terreno: 'planicie' }
    ],

    /* Exemplo de retorno após regência (jogador ausente) */
    regencia: {
      diasFora: 12,
      producao: { madeira: 18400, pedra: 9600, comida: 11200, ferro: 4100 },
      ataques: { total: 4, repelidos: 3 },
      perdas: [{ local: 'Mina de Pedra Alta', como: 'Ocupada por forças desconhecidas' }],
      acoes: [
        { dia: 2, txt: 'Recrutou 30 milicianos para reforçar o Pasto das Éguas.' },
        { dia: 4, txt: 'Repeliu um saque na Vila do Moinho.' },
        { dia: 6, txt: 'Construiu uma moradia na Vila do Vau.' },
        { dia: 8, txt: 'Perdeu a Mina de Pedra Alta para uma ocupação.' },
        { dia: 9, txt: 'Repeliu um ataque à Serraria do Bosque.' },
        { dia: 11, txt: 'Reforçou os portões do castelo para o nível 4.' }
      ],
      restou: { locais: '9 de 10', populacao: 1020 }
    },

    /* Áreas já exploradas: informação envelhece ("horas" desde a última visão) */
    explorado: [
      { c: 5, l: 10, raio: 2, horas: 40 },
      { c: 20, l: 10, raio: 3, horas: 20 },
      { c: 22, l: 6, raio: 2, horas: 22 },
      { c: 25, l: 12, raio: 3, horas: 30 },
      { c: 31, l: 9, raio: 5, horas: 6 },
      { c: 27, l: 19, raio: 3, horas: 50 },
      { c: 34, l: 27, raio: 4, horas: 72 },
      { c: 7, l: 27, raio: 3, horas: 96 },
      { c: 10, l: 29, raio: 2, horas: 14 },
      { c: 7, l: 5, raio: 2, horas: 216 },
      { c: 8, l: 14, raio: 3, horas: 120 }
    ],

    /* Visão (raio em hexes) */
    visao: { castelo: 4, local: 3, exercito: 2, explorador: { pe: 2, cavalo: 3, prospector: 1, batedor: 3 } },

    /* Filas: seg = tempo restante ao abrir a página; total = duração da etapa */
    filas: {
      obras: [
        { local: 'serraria', rotulo: 'Serraria do Bosque → nível 9', seg: 6000, total: 15360 },
        { local: 'castelo', rotulo: 'Portões do castelo → nível 4', seg: 6000 + 10800, total: 10800 }
      ],
      vagasObras: 10,
      recrutamento: [{ unidade: 'arqueiro', qtd: 10, rotulo: '10 arqueiros · Quartel da Guarda', seg: 1200, total: 2100 }],
      vagasRecrutamento: 10
    },

    /* Catálogo de construção. Básicas: minutos; fortes/valiosas: mais tempo. */
    construcoes: [
      { id: 'moradia-vau', icone: 'moradia', nome: 'Moradia', onde: 'Vila do Vau', local: 'vila-vau', cat: 'populacao', de: 1, para: 2,
        efeito: '+60 de teto de população', custo: { madeira: 1260, pedra: 980, ferro: 280, comida: 280 }, tempo: 1800 },
      { id: 'pasto', icone: 'pasto', nome: 'Pasto das Éguas', onde: 'Planície', local: 'pasto', cat: 'economia', de: 6, para: 7,
        efeito: '+34 comida/h e mais cavalos', custo: { madeira: 1030, pedra: 800, ferro: 230, comida: 230 }, tempo: 3840 },
      { id: 'mina-vale', icone: 'mina', nome: 'Mina do Vale', onde: 'Colina', local: 'mina-vale', cat: 'economia', de: 7, para: 8,
        efeito: '+43 ferro/h', custo: { madeira: 2220, pedra: 1730, ferro: 490, comida: 490 }, tempo: 7680 },
      { id: 'armazem', icone: 'armazem', nome: 'Armazém Real', onde: 'Planície', local: 'armazem', cat: 'economia', de: 7, para: 8,
        efeito: 'Guarda 12.000 → 16.000 por recurso', custo: { madeira: 2220, pedra: 1730, ferro: 490, comida: 490 }, tempo: 7680 },
      { id: 'quartel', icone: 'quartel', nome: 'Quartel da Guarda', onde: 'Planície', local: 'quartel', cat: 'militar', de: 6, para: 7,
        efeito: 'Libera o aríete; recruta 5% mais rápido', custo: { madeira: 1030, pedra: 800, ferro: 230, comida: 230 }, tempo: 3840 },
      { id: 'salgadeira', icone: 'sal', nome: 'Salgadeira', onde: 'Vila do Moinho', local: 'vila-moinho', cat: 'economia', selo: 'Usa sal',
        efeito: 'O local guarda 20 h de comida em vez de 10 h (mais estoque também atrai saque)', custo: { sal: 200, madeira: 300 }, tempo: 3600 },
      { id: 'posto', icone: 'picareta', nome: 'Posto de extração', onde: 'Escolher jazida no mapa', cat: 'economia', novo: true,
        efeito: 'Opcional: mais velocidade e rendimento na extração', custo: { madeira: 350, pedra: 200 }, tempo: 1200 },
      { id: 'vila-nova', icone: 'vila', nome: 'Nova vila', onde: 'Escolher local no mapa', cat: 'populacao', novo: true,
        efeito: '3 moradias e produção de comida · em qualquer hexágono livre, sem limite de distância', custo: { madeira: 3310, pedra: 2570, ferro: 740, comida: 740 }, tempo: 5400 },
      { id: 'rota', icone: 'rota', nome: 'Rota', onde: 'Traçar no mapa', cat: 'rotas', novo: true,
        efeito: 'Rua pública: qualquer jogador usa; reduz animais. Custo e tempo × terreno (floresta ×1,8, montanha ×2,3, pântano ×2,8)', custo: { madeira: 120, pedra: 80 }, porHex: true, tempo: 300 },
      { id: 'ponte', icone: 'ponte', nome: 'Ponte', onde: 'Escolher trecho de rio no mapa', cat: 'rotas', novo: true,
        efeito: 'Atravessa o rio e vira parte da rota pública. Sem ponte, só pelo vau, mais lento', custo: { madeira: 600, pedra: 400 }, tempo: 1800 },
      { id: 'carroca', icone: 'carroca', nome: 'Carroça', onde: 'Castelo de Pedralva', local: 'castelo', cat: 'transporte', veiculo: 'carroca',
        efeito: 'Leva 500 de carga · lenta', custo: { madeira: 150, ferro: 20 }, tempo: 300 },
      { id: 'carrocao', icone: 'carroca', nome: 'Carroção', onde: 'Castelo de Pedralva', local: 'castelo', cat: 'transporte', veiculo: 'carrocao',
        efeito: 'Leva 1.500 de carga · média · usa 2 cavalos de raça', custo: { madeira: 400, ferro: 80, cavalo: 2 }, tempo: 900 }
    ],

    /* Unidades. atk/def/vel/carga em escala 1–5, só para comparação visual. */
    unidades: [
      { id: 'milicia', nome: 'Milícia', icone: 'populacao', papel: 'Defesa barata, perto de casa', forte: [], fraco: ['Todos em campo aberto'],
        custo: { comida: 20, madeira: 10 }, pop: 1, tempo: 30, atk: 1, def: 2, vel: 3, carga: 1 },
      { id: 'lanceiro', nome: 'Lanceiro', icone: 'tropas', papel: 'Infantaria de linha', forte: ['Cavalaria'], fraco: ['Arqueiros'],
        custo: { comida: 30, madeira: 30, ferro: 30 }, pop: 1, tempo: 180, atk: 3, def: 4, vel: 2, carga: 2 },
      { id: 'arqueiro', nome: 'Arqueiro', icone: 'alvo', papel: 'Ataque à distância', forte: ['Infantaria lenta'], fraco: ['Cavalaria'],
        custo: { comida: 30, madeira: 50, couro: 10 }, pop: 1, tempo: 210, atk: 4, def: 3, vel: 3, carga: 2 },
      { id: 'cavalaria', nome: 'Cavalaria', icone: 'cavalo', papel: 'Rápida, boa para saque', forte: ['Arqueiros'], fraco: ['Lanceiros'],
        custo: { comida: 60, ferro: 50, couro: 30 }, pop: 1, tempo: 360, atk: 5, def: 3, vel: 5, carga: 4 },
      { id: 'elite', nome: 'Cavaleiro de elite', icone: 'cavalo', papel: 'Mais forte por pessoa; usa 1 cavalo de raça', forte: ['Arqueiros'], fraco: ['Lanceiros'], era: 'aco',
        nota: 'Ataque 60 e defesa 40 contra 45 e 30 da cavalaria: mais força por pessoa, mais caro por força.',
        custo: { comida: 70, ferro: 60, couro: 40, cavalo: 1 }, pop: 1, tempo: 480, atk: 5, def: 4, vel: 5, carga: 4 },
      { id: 'ariete', nome: 'Aríete', icone: 'cerco', papel: 'Cerco: derruba portões e torres', forte: ['Portões', 'Torres'], fraco: ['Tropas'],
        custo: { madeira: 300, ferro: 60 }, pop: 4, tempo: 900, atk: 5, def: 1, vel: 1, carga: 0, requisito: 'Quartel nível 7' },
      { id: 'trebuchet', nome: 'Trebuchet', icone: 'cerco', papel: 'Cerco a distância', forte: ['Castelos'], fraco: ['Cavalaria'],
        custo: { madeira: 600, pedra: 200, ferro: 150 }, pop: 6, tempo: 1800, atk: 5, def: 1, vel: 1, carga: 0, era: 'cerco' }
    ],
    disponiveis: { milicia: 0, lanceiro: 20, arqueiro: 15, cavalaria: 0, elite: 0 },

    /* Exploradores (tabela do CLAUDE.md) */
    exploradores: [
      { id: 'pe', nome: 'A pé', icone: 'bota', velocidade: 'Lenta', visao: 'Média', custo: 'Barato', carac: 'Sem penalidade em floresta e pântano · vê 2 hexágonos', livres: 2, treino: { comida: 40 }, tempo: 60, forca: 10 },
      { id: 'cavalo', nome: 'A cavalo', icone: 'cavalo', velocidade: 'Rápida', visao: 'Alta', custo: 'Médio', carac: 'Penalizado em floresta e montanha · vê 3 hexágonos', livres: 1, treino: { comida: 80, couro: 20 }, tempo: 180, forca: 15 },
      { id: 'prospector', nome: 'Prospector', icone: 'picareta', velocidade: 'Lenta', visao: 'Baixa', custo: 'Caro', carac: 'Único que revela jazidas valiosas e lendárias, a até 2 hexágonos · vê 1', livres: 0, treino: { comida: 120, ferro: 60 }, tempo: 360, forca: 8 },
      { id: 'batedor', nome: 'Batedor de elite', icone: 'batedor', velocidade: 'Rápida', visao: 'Alta', custo: 'Caro', carac: 'Furtivo; espiona exércitos e reinos, revela o dono de locais. Pode ser visto ao espionar · vê 3 hexágonos', livres: 1, treino: { comida: 150, couro: 40 }, tempo: 480, forca: 20 }
    ],

    /* Extração em andamento (exemplo): posto já construído na jazida de prata */
    extracoes: [
      { id: 'ex-prata', jazida: 'j-prata', grupo: { lanceiro: 6 }, posto: true, ritmo: 4.8, horas: 6 }
    ],

    /* Tipos de ataque (CLAUDE.md) */
    tiposAtaque: [
      { id: 'saque', nome: 'Saque', icone: 'ouro', txt: 'Leva recursos do local, até a capacidade de carga das tropas.' },
      { id: 'sabotagem', nome: 'Sabotagem', icone: 'martelo', txt: 'Destrói ou danifica construções do local.' },
      { id: 'massacre', nome: 'Massacre', icone: 'populacao', txt: 'Mata população do local. Enfraquece o reino a longo prazo, sem ganho de recurso.' },
      { id: 'ocupacao', nome: 'Ocupação', icone: 'bandeira', txt: 'Toma o local e passa a explorá-lo até alguém retomar. Ele vira seu e mantém o nível; acima do seu castelo, só sobe quando o castelo passar dele.' },
      { id: 'cerco', nome: 'Cerco ao castelo', icone: 'cerco', txt: 'O ataque mais difícil do jogo. Só contra castelos; aríetes derrubam portões e torres.', soCastelo: true }
    ],
    /* Saques recentes por alvo: rendimento decrescente em saques repetidos */
    saquesRecentes: { 'v-mina': 2 },

    /* Batalha em andamento (exemplo). Tempos em segundos a partir da abertura da página. */
    batalha: {
      id: 'b-vau', local: 'vila-vau', inicio: -240, duracao: 900,
      atacante: { nome: 'Forças desconhecidas', resumo: '≈ 40 tropas · lanceiros e arqueiros', origem: 'sudoeste', tipo: 'Saque', forca: 100 },
      defensor: { resumo: '4 milicianos e população como milícia (≈ 180)', forca: 82 },
      eventos: [
        { t: 0, txt: 'Forças desconhecidas chegaram pelo sudoeste.' },
        { t: 50, txt: 'A população pegou em armas como milícia.' },
        { t: 170, txt: 'Arqueiros inimigos incendiaram um celeiro.' },
        { t: 330, txt: 'A milícia perdeu a passagem do vau.' },
        { t: 520, txt: 'Os atacantes começam a carregar comida.' },
        { t: 760, txt: 'A milícia recua para a praça da vila.' }
      ],
      reforcos: [
        { id: 'castelo', nome: '20 lanceiros do castelo', forca: 48, seg: 360 },
        { id: 'extracao', nome: 'Grupo de extração (20 lanceiros)', forca: 44, seg: 240 }
      ]
    },

    /* Relatórios (exemplos) */
    relatorios: [
      { id: 'r-batalha', tipo: 'batalha', titulo: 'Vila do Vau sob ataque', horas: 0.07, lido: false, local: 'vila-vau' },
      { id: 'r-ataque-anon', tipo: 'ataque', titulo: 'Ataque repelido na Vila do Moinho', horas: 5, lido: false, local: 'vila-moinho',
        atacante: null, forcas: '≈ 25 tropas · lanceiros e cavalaria', origem: 'nordeste', tipoAtaque: 'Saque', resultado: 'Repelido',
        perdas: { meu: '5 lanceiros mortos · 18 de população', deles: '≈ 9 tropas' }, feridos: '2 lanceiros', levado: null },
      { id: 'r-ataque-id', tipo: 'ataque', titulo: 'Pasto das Éguas saqueado', horas: 26, lido: true, local: 'pasto',
        atacante: 'valdren', forcas: '32 cavaleiros', origem: 'leste', tipoAtaque: 'Saque', resultado: 'Saqueado',
        perdas: { meu: '6 milicianos', deles: '4 cavaleiros' }, levado: { comida: 420, couro: 30 } },
      { id: 'r-saque', tipo: 'saque', titulo: 'Seu saque à Mina Rubra', horas: 9, lido: true, local: 'v-mina',
        tropas: '24 cavaleiros', resultado: 'Vitória', levado: { ferro: 180 }, decrescente: { vezes: 2, reducao: 40 }, perdas: { meu: '7 cavaleiros mortos', deles: '≈ 6 lanceiros' }, feridos: '3 cavaleiros', estandarte: false,
        tatica: 'Média', retorno: 'O estoque acabou antes de cumprir os objetivos: sem mais o que levar, as tropas voltaram.',
        objetivos: [{ txt: '1.000 de ferro', obtido: '180', estado: 'parcial', nota: 'estoque esgotado por saques repetidos' }, { txt: '500 de pedra', obtido: '0', estado: 'falhou', nota: 'não havia pedra no local' }] },
      { id: 'r-exploracao', tipo: 'exploracao', titulo: 'Exploração ao norte', horas: 2, lido: false,
        quem: 'Explorador a cavalo', revelados: 14, achados: ['Manada de cavalos de raça (valioso)', 'Lobos (perigo alto)', 'Rota pública: Estrada do Rei continua para o leste'] },
      { id: 'r-espionagem', tipo: 'espionagem', titulo: 'Espionagem da Mina Rubra', horas: 10, lido: true, local: 'v-mina',
        quem: 'Batedor de elite', dono: 'valdren', defesa: '≈ 15 lanceiros e uma torre de arqueiros', producao: 'Ferro, ≈ 40/h', estoque: 'Ferro ≈ 2.400 · pedra ≈ 600 · comida ≈ 300', tropasVistas: '≈ 35 lanceiros saindo para o oeste', descoberto: false, reliquia: 'rl-lamina' },
      { id: 'r-roubo', tipo: 'roubo', titulo: 'Relíquia roubada da Vila do Moinho', horas: 0.2, lido: false, local: 'vila-moinho', reliquia: 'rl-calice',
        forcas: '≈ 30 tropas · infantaria e cavalaria', origem: 'leste', tipoAtaque: 'Saque', perdas: { meu: '5 milicianos · 22 de população', deles: '≈ 4 cavaleiros' }, levado: { comida: 260 } },
      { id: 'r-fauna', tipo: 'fauna', titulo: 'Explorador morto no pântano', horas: 30, lido: true,
        quem: 'Explorador a pé', animal: 'crocodilos', onde: 'Pântano a sudoeste', resultado: 'O explorador foi morto. Tropas mortas não retornam.' },
      { id: 'r-caca', tipo: 'caca', titulo: 'Caçada aos javalis', horas: 14, lido: true,
        grupo: '6 arqueiros', animal: 'javalis', ganho: { comida: 120, couro: 40, peles: 5 }, perdas: 'Nenhuma' },
      { id: 'r-extracao', tipo: 'extracao', titulo: 'Prata extraída', horas: 1, lido: true, jazida: 'j-prata', ganho: { prata: 29 }, restante: 0.74 },
      { id: 'r-escudo', tipo: 'bloqueio', titulo: 'Ataque sem combate', horas: 20, lido: true, local: 'x-mina', tropas: '12 lanceiros', tipoAtaque: 'Saque' }
    ],

    /* Notificações (exemplos). horas: há quanto tempo. ir: rota do protótipo. */
    notificacoes: [
      { id: 'n16', cat: 'social', titulo: 'Casa Valdren propõe um pacto', texto: 'Cobra 600 de ferro por 3 dias sem ataques entre vocês. O jogo garante o pacto.', horas: 1, lido: false, ir: 'comercio' },
      { id: 'n15', cat: 'exploracao', titulo: 'Seu explorador a pé foi capturado', texto: 'Casa Valdren pede 25 de prata de resgate. Sem decisão em 24 h, ele é libertado.', horas: 6, lido: false, ir: 'comercio' },
      { id: 'n14', cat: 'social', titulo: 'Casa Mirante oferece ouro', texto: '40 de ouro por 920 de madeira. A troca viaja e pode ser roubada no caminho.', horas: 2, lido: true, ir: 'comercio' },
      { id: 'n13', cat: 'social', titulo: 'Casa Lúmen pede 400 de pedra', texto: 'Para uma torre de arqueiros. A ajuda viaja e pode ser roubada no caminho.', horas: 1.5, lido: false, ir: 'alianca' },
      { id: 'n12', cat: 'exploracao', titulo: 'Espião visto perto da Vila do Vau', texto: 'A guarnição viu um batedor seguindo para o leste. Avistamentos somem do mapa em 10 h.', horas: 3, lido: false, ir: 'mapa?modo=tatico&abrir=avist:av-espiao' },
      { id: 'n11', cat: 'ataque', titulo: 'Relíquia roubada', texto: 'O Cálice das Colheitas foi levado da Vila do Moinho. As tropas que o levam seguem para o leste: ainda dá para interceptar.', horas: 0.2, lido: false, ir: 'relatorio?id=r-roubo' },
      { id: 'n1', cat: 'ataque', titulo: 'Vila do Vau está sendo atacada', texto: 'Forças desconhecidas. Envie reforços ou recue.', horas: 0.07, lido: false, ir: 'batalha' },
      { id: 'n2', cat: 'ataque', titulo: 'Forças desconhecidas a caminho', texto: 'Alvo provável: Pasto das Éguas. Chegada em cerca de 40 min.', horas: 0.1, lido: false, ir: 'mapa?modo=cena&abrir=marcha:m-inimigo' },
      { id: 'n3', cat: 'exploracao', titulo: 'Explorador revelou 14 hexágonos', texto: 'Encontrou uma manada de cavalos de raça e um bando de lobos.', horas: 2, lido: false, ir: 'relatorio?id=r-exploracao' },
      { id: 'n4', cat: 'construcao', titulo: 'Moradia concluída', texto: 'Vila do Moinho, nível 3. Teto de população +60.', horas: 3, lido: true, ir: 'reino' },
      { id: 'n5', cat: 'social', titulo: 'Nova bandeira perto do seu reino', texto: 'Casa Valdren: “Este ouro é de Valdren.”', horas: 4, lido: true, ir: 'mapa?modo=tatico&abrir=bandeira:b-1' },
      { id: 'n6', cat: 'recrutamento', titulo: '15 arqueiros prontos', texto: 'Quartel da Guarda.', horas: 7, lido: true, ir: 'tropas' },
      { id: 'n7', cat: 'fauna', titulo: 'Explorador morto por crocodilos', texto: 'Pântano a sudoeste. Prefira a rota segura ou leve escolta.', horas: 30, lido: true, ir: 'relatorio?id=r-fauna' },
      { id: 'n9', cat: 'social', titulo: 'Sua bandeira foi derrubada', texto: '“Fica longe da Salina.” não está mais no mapa. Quem derrubou não levava estandarte: não se sabe quem foi.', horas: 18, lido: true, ir: 'bandeiras' },
      { id: 'n10', cat: 'ataque', titulo: 'Ataque sem combate', texto: 'O alvo estava protegido por escudo de novato. Suas tropas voltaram.', horas: 20, lido: true, ir: 'relatorio?id=r-escudo' },
      { id: 'n8', cat: 'temporada', titulo: 'Faltam 36 dias para o fim da temporada', texto: 'Relíquias e títulos da temporada ainda podem ser conquistados.', horas: 30, lido: true, ir: 'temporada' }
    ],
    preferenciasPush: { ataque: true, construcao: true, recrutamento: false, exploracao: true, fauna: true, social: false, temporada: true },

    /* Temporada e legado (exemplos) */
    legado: {
      /* Linhagem 1–10: +1 por temporada jogada (ativo em 30 dos 70 dias) e +1 por relíquia da temporada ganha.
         Desbloqueia opções, nunca poder. */
      linhagem: { nivel: 4, diasAtivo: 34, diasPedidos: 30, como: '1 + 2 temporadas jogadas + 1 relíquia da temporada', desbloqueios: [
        { nivel: 2, txt: 'Cores e formas extras de brasão', feito: true },
        { nivel: 3, txt: 'Títulos', feito: true },
        { nivel: 5, txt: 'Escolher a região inicial ao fundar o reino' },
        { nivel: 7, txt: 'Escolher a região do exílio' },
        { nivel: 10, txt: 'Brasão da casa com moldura de linhagem' }
      ] },
      /* Relíquias da temporada: +1% a +2% cada, até 3 equipadas, teto somado de 5% (conta no teto de bônus de combate) */
      reliquias: [
        { id: 'coroa-ferro', nome: 'Coroa de Ferro Frio', tipo: 'producao', bonus: 2, como: 'Temporada 2: 3º lugar em famílias', ganha: true, equipada: true }
      ],
      conquistas: [
        { id: 'ranking', nome: 'Entre os 3 primeiros do ranking', como: 'Em baixas, tropas ou famílias (perdas não contam)', agora: 'Você: 9º em famílias, 14º em baixas', ok: false },
        { id: 'lendaria', nome: 'Guardião de relíquia', como: 'Terminar a temporada com uma relíquia lendária em seu poder', agora: 'Você tem 2 agora', ok: true },
        { id: 'cerco', nome: 'Sitiante', como: 'Vencer um cerco a um castelo', agora: 'Ainda não', ok: false }
      ],
      equipadasMax: 3, tetoReliquias: 5,
      titulos: [
        { nome: 'Senhor das Pedras', como: 'Linhagem nível 4', ativo: true, ganho: true },
        { nome: 'Guardião do Vau', como: 'Temporada 2: defendeu a Vila do Vau 20 vezes', ganho: true },
        { nome: 'Explorador do Norte', como: 'Temporada 1: revelou o norte do mapa', ganho: true },
        { nome: 'Caçador de Lobos', como: 'Caçar 10 bandos de lobos', ganho: false }
      ],
      brasoes: [
        { forma: 'portugues', divisao: 'pleno', cor1: 'azul', cor2: 'prata', simbolo: 'torre', corSimbolo: 'prata', nome: 'Atual' },
        { forma: 'classico', divisao: 'esquartelado', cor1: 'azul', cor2: 'ouro', simbolo: 'torre', corSimbolo: 'negro', nome: 'Temporada 2' },
        { forma: 'redondo', divisao: 'banda', cor1: 'verde', cor2: 'prata', simbolo: 'montes', corSimbolo: 'negro', nome: 'Temporada 1' },
        { forma: 'portugues', divisao: 'chaveirao', cor1: 'negro', cor2: 'ouro', simbolo: 'coroa', corSimbolo: 'ouro', nome: 'Bloqueado: vencer um cerco', bloqueado: true }
      ],
      historico: [
        { temporada: 2, nome: 'Temporada das Cinzas', resumo: 'Caiu no dia 34, recomeçou em exílio e terminou com 6 locais.' },
        { temporada: 1, nome: 'Temporada da Fundação', resumo: 'Sobreviveu até o fim com 12 locais.' }
      ]
    },

    /* Ranking da temporada (exemplo). famílias = população do reino. */
    ranking: {
      reinos: [
        { reino: 'valdren', baixas: 4820, perdas: 2130, tropas: 1860, familias: 3120 },
        { reino: 'corvo', baixas: 3990, perdas: 1410, tropas: 2240, familias: 2780 },
        { nome: 'Clã Ferrugem', brasao: { forma: 'classico', divisao: 'cortado', cor1: 'castanho', cor2: 'negro', simbolo: 'martelo', corSimbolo: 'ouro' }, baixas: 3610, perdas: 2950, tropas: 1310, familias: 2410 },
        { nome: 'Reino de Altamar', brasao: { forma: 'portugues', divisao: 'partido', cor1: 'azul', cor2: 'verde', simbolo: 'lua', corSimbolo: 'prata' }, baixas: 2870, perdas: 980, tropas: 1720, familias: 3460 },
        { nome: 'Senhorio de Brumas', brasao: { forma: 'redondo', divisao: 'pleno', cor1: 'purpura', cor2: 'purpura', simbolo: 'estrela', corSimbolo: 'prata' }, baixas: 2140, perdas: 1660, tropas: 990, familias: 1980 },
        { nome: 'Casa Aranda', brasao: { forma: 'classico', divisao: 'banda', cor1: 'vermelho', cor2: 'prata', simbolo: 'chave', corSimbolo: 'negro' }, baixas: 1930, perdas: 870, tropas: 1450, familias: 2650 },
        { nome: 'Marca do Norte', brasao: { forma: 'portugues', divisao: 'chaveirao', cor1: 'negro', cor2: 'prata', simbolo: 'montes', corSimbolo: 'prata' }, baixas: 1720, perdas: 2210, tropas: 760, familias: 1540 },
        { nome: 'Torre Cinzenta', brasao: { forma: 'classico', divisao: 'pleno', cor1: 'negro', cor2: 'negro', simbolo: 'torre', corSimbolo: 'prata' }, baixas: 1380, perdas: 640, tropas: 1120, familias: 2190 },
        { nome: 'Reino de Solar', brasao: { forma: 'redondo', divisao: 'esquartelado', cor1: 'ouro', cor2: 'vermelho', simbolo: 'coroa', corSimbolo: 'negro' }, baixas: 1210, perdas: 1530, tropas: 840, familias: 1760 },
        { reino: 'mirante', baixas: 990, perdas: 410, tropas: 1030, familias: 2020 },
        { nome: 'Vale do Junco', brasao: { forma: 'classico', divisao: 'partido', cor1: 'verde', cor2: 'prata', simbolo: 'lua', corSimbolo: 'negro' }, baixas: 760, perdas: 1180, tropas: 540, familias: 3010 },
        { reino: 'meu', baixas: 640, perdas: 390, tropas: 420, familias: 1240 }
      ],
      minhaPosicao: { baixas: 14, perdas: 22, tropas: 17, familias: 9 }
    },

    /* Relíquias lendárias: uma por reino no mundo; escavadas em ruínas antigas, guardadas num local
       para melhorar o desempenho dele; podem ser roubadas e só a espionagem revela onde estão.
       bonus em % (ilustrativo). */
    reliquias: [
      { id: 'rl-pedra-vale', nome: 'Pedra do Vale', tipo: 'producao', bonus: 15, dono: 'meu', local: 'mina-vale', origem: 'Escavada numa ruína antiga no dia 9' },
      { id: 'rl-muralha-viva', nome: 'Escudo Vivo', tipo: 'resistencia', bonus: 20, dono: 'meu', local: 'castelo', origem: 'Tomada num saque no dia 21' },
      { id: 'rl-lamina', nome: 'Lâmina do Rei Antigo', tipo: 'ataque', bonus: 15, dono: 'valdren', local: 'v-mina', espionada: 10 },
      { id: 'rl-corvo-1', nome: 'Coroa de Espinhos', tipo: 'resistencia', bonus: 20, dono: 'corvo', local: 'c-mina' },
      { id: 'rl-corvo-2', nome: 'Olho do Corvo', tipo: 'ataque', bonus: 15, dono: 'corvo', local: 'c-mina' },
      { id: 'rl-corvo-3', nome: 'Sino de Bronze', tipo: 'producao', bonus: 15, dono: 'corvo', local: 'c-mina' },
      { id: 'rl-calice', nome: 'Cálice das Colheitas', tipo: 'producao', bonus: 15, dono: null, local: null, roubada: { horas: 0.2, de: 'vila-moinho', origem: 'leste', marcha: 'm-roubo' } }
    ],
    ruinasComReliquia: ['j-ruina'],
    escavacoes: [],
    /* Sistemas já apresentados ao jogador (no exemplo, um jogador no dia 34: todos). false = ainda não apareceu. */
    descobertas: { logistica: true, espionagem: true, defesas: true, reliquias: true, alianca: true, comercio: true },
    /* Aliança: limite de membros para não desequilibrar um mundo de até 30 reinos */
    alianca: {
      nome: 'Pacto da Pedra', limite: 5, desde: 'dia 12',
      brasao: { forma: 'classico', divisao: 'esquartelado', cor1: 'azul', cor2: 'verde', simbolo: 'torre', corSimbolo: 'prata' },
      membros: ['meu', 'lumen', 'fenda'], papeis: { meu: 'Líder', lumen: 'Conselheiro', fenda: 'Membro' }, conselheirosMax: 2,
      castelos: { lumen: 'a-castelo', fenda: 'f-castelo' },
      /* quem sai ou é expulso fica em trégua de 24 h com a aliança, garantida pelo jogo */
      conversa: [
        { de: 'lumen', texto: 'Valdren está juntando lanceiros perto da Mina Rubra.', horas: 3 },
        { de: 'fenda', texto: 'O ferro chegou inteiro. Obrigado!', horas: 2 },
        { de: 'meu', texto: 'Deixei 12 lanceiros na Vila do Moinho. Se precisarem, mando reforço.', horas: 1.5 }
      ],
      tregua: [{ nome: 'Clã Ferrugem', brasao: { forma: 'classico', divisao: 'cortado', cor1: 'castanho', cor2: 'negro', simbolo: 'martelo', corSimbolo: 'ouro' }, como: 'saiu', seg: 18 * 3600 }]
    },

    /* Eras: a do Ferro é a inicial. Era do Aço feita no dia 22. */
    eras: { aco: { feita: true, dia: 22 }, cerco: { feita: false } },
    /* Ferraria: nível de armas e armaduras por família; fila própria (até 10, uma por vez) */
    ferraria: {
      linhas: { infantaria: { armas: 2, armaduras: 1 }, arqueiros: { armas: 1, armaduras: 1 }, cavalaria: { armas: 0, armaduras: 0 } },
      fila: [{ fam: 'infantaria', linha: 'armaduras', para: 2, rotulo: 'Armaduras de infantaria → nível 2', seg: 7200, total: 21600 }],
      vagas: 10
    },
    /* Veterania por exército (marcas de vitória) */
    veterania: { castelo: 3, 'vila-moinho': 6, 'mina-vale': 1 },
    /* Feridos à espera de ervas (horas: há quanto tempo; morrem 24 h depois sem cura) */
    feridos: [
      { id: 'fe-1', origem: 'Defesa da Vila do Moinho', unidade: 'lanceiro', qtd: 2, horas: 5 },
      { id: 'fe-2', origem: 'Saque à Mina Rubra', unidade: 'cavalaria', qtd: 3, horas: 9 }
    ],
    curas: [],
    /* Mensageiros: levam mensagens a outros reinos, com bandeira branca; ocupam 1 de população cada */
    mensageiros: { total: 2, custo: { comida: 30 }, tempo: 60, max: 200 },
    mensagens: [
      { id: 'ms-1', de: 'valdren', texto: 'A Mina do Vale fica no caminho do nosso ouro. Antes que alguém se machuque, aceite o nosso pacto.', horas: 1.2, lida: false },
      { id: 'ms-2', de: 'mirante', texto: 'Temos ouro e prata. Mande dizer do que precisa e fazemos preço.', horas: 26, lida: true },
      { id: 'ms-3', de: 'meu', local: 'x-mina', texto: 'A estrada do norte é livre para quem não atacar. Podemos conversar?', horas: 30, estado: 'entregue' }
    ],
    /* Equipamento lendário: o seu (ainda não forjado) e os vistos em outros reinos */
    lendario: { meu: null, vistos: [{ reino: 'corvo', nome: 'Elmo do Corvo', tipo: 'ataque', exercito: '≈ 40 cavaleiros', horas: 6 }] },

    /* Comércio e diplomacia: só com reinos conhecidos; cargas viajam e podem ser roubadas */
    comercio: {
      conhecidos: { lumen: 'aliado', fenda: 'aliado', valdren: 'estandarte e espionagem', corvo: 'bandeira', mirante: 'bandeira' },
      ofertas: [
        { id: 'tr-1', de: 'mirante', da: { ouro: 40 }, quer: { madeira: 920 }, horas: 2, estado: 'aberta', recado: 'Ouro limpo do leste. Entregamos em carroça própria.' },
        { id: 'tr-2', de: 'lumen', da: { pedra: 300 }, quer: { prata: 25 }, horas: 0.8, estado: 'aberta', recado: 'Sobrou pedra da torre. Precisamos de prata para o resgate de um batedor.' }
      ],
      minhas: [{ id: 'tr-3', para: 'fenda', da: { ferro: 400 }, quer: { ervas: 40 }, horas: 3, estado: 'aguardando' }],
      pactos: [{ id: 'pc-1', com: 'corvo', dias: 3, pagou: 'meu', carga: { prata: 60 }, seg: 53 * 3600, estado: 'ativo' }],
      propostasPacto: [{ id: 'pc-2', de: 'valdren', dias: 3, cobra: { ferro: 600 }, horas: 1, estado: 'aberta', recado: 'Três dias de paz. Depois, conversamos de novo.' }],
      pactosMax: 3,
      novatoDia: 2000, novatoUsado: { fenda: 300 },
      capturados: [
        { id: 'cap-1', meu: true, quem: 'Explorador a pé', por: 'valdren', resgate: { prata: 25 }, horas: 6 },
        { id: 'cap-2', meu: false, quem: 'Batedor de elite', de: 'corvo', onde: 'Mina do Vale', horas: 2 }
      ]
    },
    /* Pedidos de recursos entre aliados. A ajuda viaja: leva tempo e pode ser roubada no caminho. */
    pedidos: [
      { id: 'pd-1', de: 'lumen', para: 'meu', carga: { pedra: 400 }, motivo: 'Torre de arqueiros no Castelo de Lúmen', horas: 1.5, estado: 'aberto' },
      { id: 'pd-2', de: 'meu', para: 'fenda', carga: { ferro: 300 }, local: 'quartel', motivo: 'Lanceiros', horas: 0.6, estado: 'aceito' }
    ],
    /* Modelos de ataque: alvo à parte, o resto vem pronto. recurso 'auto' = recurso principal do alvo. */
    modelos: [
      { id: 'md-saque', nome: 'Saque rápido', tipo: 'saque', tatica: 'conservadora', estandarte: false, grupo: { lanceiro: 10 }, objetivos: [{ k: 'recurso', r: 'auto', q: 1000 }] },
      { id: 'md-reliquia', nome: 'Tomar relíquia', tipo: 'saque', tatica: 'agressiva', estandarte: false, grupo: { lanceiro: 15, arqueiro: 10 }, objetivos: [{ k: 'reliquia' }, { k: 'recurso', r: 'auto', q: 500 }] },
      { id: 'md-sabotar', nome: 'Danificar', tipo: 'sabotagem', tatica: 'media', estandarte: false, grupo: { lanceiro: 12 }, objetivos: [{ k: 'construcao', q: 1 }] }
    ],
    ultimoEnvio: { alvo: 'v-mina', tipo: 'saque', tatica: 'media', estandarte: false, grupo: { lanceiro: 12 }, objetivos: [{ k: 'recurso', r: 'ferro', q: 1000 }, { k: 'recurso', r: 'pedra', q: 500 }], horas: 9 },

    /* Exílio (exemplo) */
    exilio: {
      motivo: 'O Castelo de Pedralva caiu num cerco e os últimos locais foram ocupados.',
      kit: { madeira: 800, pedra: 500, comida: 1000, ferro: 200 },
      kitTropas: '10 milicianos e 1 explorador a pé',
      escudo: '24 h',
      mantido: ['Linhagem nível 4', '1 relíquia da temporada', '3 títulos', 'Brasões e cosméticos']
    },

    /* Rendimento da caça por bando abatido (balanceamento); o bando volta em 24 h */
    caca: {
      lobos: { comida: 50, couro: 30, peles: 40 },
      javalis: { comida: 120, couro: 40, peles: 5 },
      ursos: { comida: 90, couro: 60, peles: 60 },
      crocodilos: { comida: 50, couro: 90, peles: 0 }
    },

    notificacoesNaoLidas: 8
  };

  RP.TIPOS_LOCAL = {
    castelo: 'Castelo (capital)', vila: 'Vila', mina: 'Mina', serraria: 'Serraria', pasto: 'Pasto',
    armazem: 'Armazém', ferraria: 'Ferraria', quartel: 'Quartel'
  };
  RP.TIPOS_BANDEIRA = {
    reivindicacao: 'Reivindicação', ameaca: 'Ameaça', alianca: 'Aliança', aviso: 'Aviso'
  };
})();
