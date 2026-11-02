/* Reino de Pedra — dados fictícios e fixos do protótipo (mock).
   Nenhum valor aqui é balanceamento: números servem só para preencher as telas.
   Tempos ("seg") são contados a partir da abertura da página. */
(function () {
  'use strict';
  var RP = (window.RP = window.RP || {});

  RP.dados = {
    temporada: { numero: 3, nome: 'Temporada do Ferro Frio', diasRestantes: 41, reinos: 30, limiteReinos: 30 },

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
      { id: 'ouro', nome: 'Ouro', qtd: 85 },
      { id: 'sal', nome: 'Sal', qtd: 40 },
      { id: 'cavalo', nome: 'Cavalos de raça', qtd: 6 }
    ],
    /* Estoques por local (no início da sessão). Recursos só podem ser usados onde estão;
       cada local acumula a própria produção. Valiosos ficam no Armazém Real. */
    estoques: {
      castelo: { madeira: 820, pedra: 410, comida: 1500, ferro: 210, couro: 80, peles: 30 },
      quartel: { madeira: 900, comida: 900, ferro: 300, couro: 120 },
      armazem: { madeira: 600, pedra: 300, comida: 1200, ferro: 160, couro: 40, peles: 15, ouro: 85, sal: 40, cavalo: 6 },
      ferraria: { ferro: 150, madeira: 80 },
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
    /* Muros: envolvem um ou vários locais. Torres põem arqueiros no alto, protegidos até o muro cair. */
    muros: [
      { id: 'mu-vale', nome: 'Muralha do Vale', dono: 'meu', locais: ['quartel', 'armazem'], nivel: 2, torres: 2, arqueiros: 8 },
      { id: 'mu-moinho', nome: 'Paliçada do Moinho', dono: 'meu', locais: ['vila-moinho'], nivel: 1, torres: 0, arqueiros: 0 },
      { id: 'mu-vmina', nome: 'Muralha', dono: 'valdren', locais: ['v-mina'], nivel: 1, torres: 1, arqueiros: null }
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
      fenda: { nome: 'Baronia da Fenda', cor: 'aliado', brasao: { forma: 'classico', divisao: 'banda', cor1: 'castanho', cor2: 'ouro', simbolo: 'chave', corSimbolo: 'negro' } },
      desconhecido: { nome: 'Dono desconhecido', cor: 'desconhecido', brasao: null }
    },

    /* Locais: c,l = coluna/linha no mapa. terreno força o tipo do hex. */
    locais: [
      { id: 'castelo', reino: 'meu', tipo: 'castelo', nome: 'Castelo de Pedralva', c: 14, l: 19, terreno: 'planicie', nivel: 4,
        info: ['Muralha nível 3', 'Moradias: 2'], guarnicao: '20 lanceiros · 15 arqueiros', postura: 'Apenas defender' },
      { id: 'quartel', reino: 'meu', tipo: 'quartel', nome: 'Quartel da Guarda', c: 12, l: 17, terreno: 'planicie', nivel: 2,
        info: ['Recrutando 10 arqueiros'], fila: { rotulo: '10 arqueiros', seg: 492, total: 900 }, guarnicao: '8 milicianos', postura: 'Apenas defender' },
      { id: 'armazem', reino: 'meu', tipo: 'armazem', nome: 'Armazém Real', c: 15, l: 16, terreno: 'planicie', nivel: 3,
        info: ['Capacidade: 5.000 por recurso'], guarnicao: '—', postura: 'Apenas defender' },
      { id: 'ferraria', reino: 'meu', tipo: 'ferraria', nome: 'Ferraria do Rei', c: 16, l: 20, terreno: 'planicie', nivel: 2,
        info: ['Era do Ferro', 'Forja lanças e pontas de flecha'], guarnicao: '4 milicianos', postura: 'Apenas defender' },
      { id: 'vila-moinho', reino: 'meu', tipo: 'vila', nome: 'Vila do Moinho', c: 18, l: 18, terreno: 'planicie', nivel: 3,
        info: ['Moradias: 3', '+60 comida/h'], prod: { r: 'comida', v: 60 }, guarnicao: '12 lanceiros', postura: 'Atacar quem atacar' },
      { id: 'pasto', reino: 'meu', tipo: 'pasto', nome: 'Pasto das Éguas', c: 18, l: 14, terreno: 'planicie', nivel: 1,
        info: ['+60 comida/h', '14 cavalos'], prod: { r: 'comida', v: 60 }, guarnicao: '6 milicianos', postura: 'Apenas defender', ameaca: 'inimigo-desconhecido' },
      { id: 'mina-vale', reino: 'meu', tipo: 'mina', nome: 'Mina do Vale', c: 10, l: 21, terreno: 'colina', nivel: 2,
        info: ['+42 ferro/h', 'Jazida: 68% restante'], prod: { r: 'ferro', v: 42 }, jazida: 0.68, guarnicao: '12 lanceiros', postura: 'Apenas defender' },
      { id: 'mina-pedra', reino: 'meu', tipo: 'mina', nome: 'Mina de Pedra Alta', c: 11, l: 24, terreno: 'colina', nivel: 2,
        info: ['+95 pedra/h', 'Jazida: 81% restante'], prod: { r: 'pedra', v: 95 }, jazida: 0.81, guarnicao: '5 milicianos', postura: 'Apenas defender' },
      { id: 'serraria', reino: 'meu', tipo: 'serraria', nome: 'Serraria do Bosque', c: 15, l: 23, terreno: 'floresta', nivel: 3,
        info: ['+180 madeira/h'], prod: { r: 'madeira', v: 180 }, obra: { rotulo: 'Serraria nível 4', seg: 760, total: 1800 }, guarnicao: '6 milicianos', postura: 'Apenas defender' },
      { id: 'vila-vau', reino: 'meu', tipo: 'vila', nome: 'Vila do Vau', c: 13, l: 27, terreno: 'planicie', nivel: 1,
        info: ['Moradias: 1'], guarnicao: '4 milicianos', postura: 'Apenas defender' },

      { id: 'v-castelo', reino: 'valdren', tipo: 'castelo', nome: 'Castelo Valdren', c: 32, l: 8, terreno: 'planicie', nivel: '?', info: ['Muralhas altas'] },
      { id: 'v-mina', reino: 'valdren', tipo: 'mina', nome: 'Mina Rubra', c: 33, l: 12, terreno: 'colina', nivel: '?', info: ['Ferro'],
        espionado: { horas: 10, defesa: '≈ 15 lanceiros e muralha baixa', estoque: { ferro: 2400, pedra: 600, comida: 300 } } },
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
      { id: 'b-4', reino: 'valdren', tipo: 'alianca', texto: 'Aceitamos tratados.', c: 28, l: 9 }
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
        { dia: 11, txt: 'Melhorou a muralha do castelo para o nível 4.' }
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
        { local: 'serraria', rotulo: 'Serraria do Bosque → nível 4', seg: 760, total: 1800 },
        { local: 'castelo', rotulo: 'Muralha do castelo → nível 4', seg: 760 + 2700, total: 2700 }
      ],
      vagasObras: 10,
      recrutamento: [{ unidade: 'arqueiro', qtd: 10, rotulo: '10 arqueiros · Quartel da Guarda', seg: 492, total: 900 }],
      vagasRecrutamento: 10
    },

    /* Catálogo de construção. Básicas: minutos; fortes/valiosas: mais tempo. */
    construcoes: [
      { id: 'moradia-vau', icone: 'moradia', nome: 'Moradia', onde: 'Vila do Vau', local: 'vila-vau', cat: 'populacao', de: 1, para: 2,
        efeito: '+60 de teto de população', custo: { madeira: 300, pedra: 150 }, tempo: 360 },
      { id: 'pasto', icone: 'pasto', nome: 'Pasto das Éguas', onde: 'Planície', local: 'pasto', cat: 'economia', de: 1, para: 2,
        efeito: '+30 comida/h e mais cavalos', custo: { madeira: 250, pedra: 100 }, tempo: 480 },
      { id: 'mina-vale', icone: 'mina', nome: 'Mina do Vale', onde: 'Colina', local: 'mina-vale', cat: 'economia', de: 2, para: 3,
        efeito: '+18 ferro/h', custo: { madeira: 400, pedra: 300, ferro: 50 }, tempo: 1500 },
      { id: 'armazem', icone: 'armazem', nome: 'Armazém Real', onde: 'Planície', local: 'armazem', cat: 'economia', de: 3, para: 4,
        efeito: 'Capacidade 5.000 → 7.500 por recurso', custo: { madeira: 600, pedra: 500 }, tempo: 2100 },
      { id: 'quartel', icone: 'quartel', nome: 'Quartel da Guarda', onde: 'Planície', local: 'quartel', cat: 'militar', de: 2, para: 3,
        efeito: 'Libera o aríete e uma vaga a mais na fila', custo: { madeira: 500, pedra: 400, ferro: 150 }, tempo: 2700 },
      { id: 'era-aco', icone: 'ferraria', nome: 'Era do Aço', onde: 'Ferraria do Rei', local: 'ferraria', cat: 'militar', tec: true,
        efeito: 'Armas de aço para lanceiros e cavalaria', custo: { ferro: 800, ouro: 60 }, tempo: 6000, requisito: 'Ferraria nível 3' },
      { id: 'posto', icone: 'picareta', nome: 'Posto de extração', onde: 'Escolher jazida no mapa', cat: 'economia', novo: true,
        efeito: 'Opcional: mais velocidade e rendimento na extração', custo: { madeira: 350, pedra: 200 }, tempo: 1200 },
      { id: 'vila-nova', icone: 'vila', nome: 'Nova vila', onde: 'Escolher local no mapa', cat: 'populacao', novo: true,
        efeito: '3 moradias e produção de comida', custo: { madeira: 900, pedra: 600, comida: 400 }, tempo: 4200 },
      { id: 'rota', icone: 'rota', nome: 'Rota', onde: 'Traçar no mapa', cat: 'rotas', novo: true,
        efeito: 'Rua pública: qualquer jogador usa; reduz animais', custo: { madeira: 120, pedra: 80 }, porHex: true, tempo: 300 },
      { id: 'carroca', icone: 'carroca', nome: 'Carroça', onde: 'Castelo de Pedralva', local: 'castelo', cat: 'transporte', veiculo: 'carroca',
        efeito: 'Leva 500 de carga · lenta', custo: { madeira: 150, ferro: 20 }, tempo: 300 },
      { id: 'carrocao', icone: 'carroca', nome: 'Carroção', onde: 'Castelo de Pedralva', local: 'castelo', cat: 'transporte', veiculo: 'carrocao',
        efeito: 'Leva 1.500 de carga · média · usa 2 cavalos de raça', custo: { madeira: 400, ferro: 80, cavalo: 2 }, tempo: 900 }
    ],

    /* Unidades. atk/def/vel/carga em escala 1–5, só para comparação visual. */
    unidades: [
      { id: 'milicia', nome: 'Milícia', icone: 'populacao', papel: 'Defesa barata, perto de casa', forte: [], fraco: ['Todos em campo aberto'],
        custo: { comida: 20, madeira: 10 }, pop: 1, tempo: 20, atk: 1, def: 2, vel: 3, carga: 1 },
      { id: 'lanceiro', nome: 'Lanceiro', icone: 'tropas', papel: 'Infantaria de linha', forte: ['Cavalaria'], fraco: ['Arqueiros'],
        custo: { comida: 30, madeira: 30, ferro: 20 }, pop: 1, tempo: 45, atk: 3, def: 4, vel: 2, carga: 2 },
      { id: 'arqueiro', nome: 'Arqueiro', icone: 'alvo', papel: 'Ataque à distância', forte: ['Infantaria lenta'], fraco: ['Cavalaria'],
        custo: { comida: 30, madeira: 50, couro: 10 }, pop: 1, tempo: 50, atk: 4, def: 2, vel: 3, carga: 2 },
      { id: 'cavalaria', nome: 'Cavalaria', icone: 'cavalo', papel: 'Rápida, boa para saque', forte: ['Arqueiros'], fraco: ['Lanceiros'],
        custo: { comida: 60, ferro: 40, couro: 30 }, pop: 1, tempo: 90, atk: 4, def: 3, vel: 5, carga: 4 },
      { id: 'ariete', nome: 'Aríete', icone: 'cerco', papel: 'Cerco: derruba portões', forte: ['Muralhas'], fraco: ['Tropas'],
        custo: { madeira: 300, ferro: 60 }, pop: 4, tempo: 240, atk: 5, def: 1, vel: 1, carga: 0, requisito: 'Quartel nível 3' },
      { id: 'trebuchet', nome: 'Trebuchet', icone: 'cerco', papel: 'Cerco a distância', forte: ['Castelos'], fraco: ['Cavalaria'],
        custo: { madeira: 600, pedra: 200, ferro: 150 }, pop: 6, tempo: 480, atk: 5, def: 1, vel: 1, carga: 0, requisito: 'Era do cerco avançado' }
    ],
    disponiveis: { milicia: 0, lanceiro: 20, arqueiro: 15, cavalaria: 0 },

    /* Exploradores (tabela do CLAUDE.md) */
    exploradores: [
      { id: 'pe', nome: 'A pé', icone: 'bota', velocidade: 'Lenta', visao: 'Média', custo: 'Barato', carac: 'Sem penalidade em floresta e pântano', livres: 2, treino: { comida: 40 } },
      { id: 'cavalo', nome: 'A cavalo', icone: 'cavalo', velocidade: 'Rápida', visao: 'Alta', custo: 'Médio', carac: 'Penalizado em floresta e montanha', livres: 1, treino: { comida: 80, couro: 20 } },
      { id: 'prospector', nome: 'Prospector', icone: 'picareta', velocidade: 'Lenta', visao: 'Baixa', custo: 'Caro', carac: 'Único que revela jazidas valiosas e lendárias', livres: 0, treino: { comida: 120, ferro: 60 } },
      { id: 'batedor', nome: 'Batedor de elite', icone: 'batedor', velocidade: 'Rápida', visao: 'Alta', custo: 'Caro', carac: 'Furtivo; espiona exércitos e reinos, revela o dono de locais. É descoberto se alguma tropa o vir', livres: 1, treino: { comida: 150, couro: 40 } }
    ],

    /* Extração em andamento (exemplo): posto já construído na jazida de prata */
    extracoes: [
      { id: 'ex-prata', jazida: 'j-prata', grupo: { lanceiro: 6 }, posto: true, ritmo: 34, horas: 6 }
    ],

    /* Tipos de ataque (CLAUDE.md) */
    tiposAtaque: [
      { id: 'saque', nome: 'Saque', icone: 'ouro', txt: 'Leva recursos do local, até a capacidade de carga das tropas.' },
      { id: 'sabotagem', nome: 'Sabotagem', icone: 'martelo', txt: 'Destrói ou danifica construções do local.' },
      { id: 'massacre', nome: 'Massacre', icone: 'populacao', txt: 'Mata população do local. Enfraquece o reino a longo prazo, sem ganho de recurso.' },
      { id: 'ocupacao', nome: 'Ocupação', icone: 'bandeira', txt: 'Toma o local e passa a explorá-lo até alguém retomar.' },
      { id: 'cerco', nome: 'Cerco ao castelo', icone: 'cerco', txt: 'O ataque mais difícil do jogo. Só contra castelos; máquinas de cerco derrubam muralhas.', soCastelo: true }
    ],
    /* Saques recentes por alvo: rendimento decrescente em saques repetidos */
    saquesRecentes: { 'v-mina': 2 },

    /* Batalha em andamento (exemplo). Tempos em segundos a partir da abertura da página. */
    batalha: {
      id: 'b-vau', local: 'vila-vau', inicio: -240, duracao: 900,
      atacante: { nome: 'Forças desconhecidas', resumo: '≈ 40 tropas · lanceiros e arqueiros', origem: 'sudoeste', tipo: 'Saque', forca: 100 },
      defensor: { resumo: '4 milicianos, população como milícia (≈ 180) e paliçada', forca: 82 },
      eventos: [
        { t: 0, txt: 'Forças desconhecidas chegaram pelo sudoeste.' },
        { t: 50, txt: 'A população pegou em armas como milícia.' },
        { t: 170, txt: 'Arqueiros inimigos incendiaram um celeiro.' },
        { t: 330, txt: 'A paliçada cedeu no lado sul.' },
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
        perdas: { meu: '3 milicianos · 18 de população', deles: '≈ 9 tropas' }, levado: null },
      { id: 'r-ataque-id', tipo: 'ataque', titulo: 'Pasto das Éguas saqueado', horas: 26, lido: true, local: 'pasto',
        atacante: 'valdren', forcas: '32 cavaleiros', origem: 'leste', tipoAtaque: 'Saque', resultado: 'Saqueado',
        perdas: { meu: '6 milicianos', deles: '4 cavaleiros' }, levado: { comida: 420, couro: 30 } },
      { id: 'r-saque', tipo: 'saque', titulo: 'Seu saque à Mina Rubra', horas: 9, lido: true, local: 'v-mina',
        tropas: '24 cavaleiros', resultado: 'Vitória', levado: { ferro: 180 }, decrescente: { vezes: 2, reducao: 40 }, perdas: { meu: '2 cavaleiros', deles: '≈ 6 lanceiros' }, estandarte: false,
        tatica: 'Média', retorno: 'O estoque acabou antes de cumprir os objetivos: sem mais o que levar, as tropas voltaram.',
        objetivos: [{ txt: '1.000 de ferro', obtido: '180', estado: 'parcial', nota: 'estoque esgotado por saques repetidos' }, { txt: '500 de pedra', obtido: '0', estado: 'falhou', nota: 'não havia pedra no local' }] },
      { id: 'r-exploracao', tipo: 'exploracao', titulo: 'Exploração ao norte', horas: 2, lido: false,
        quem: 'Explorador a cavalo', revelados: 14, achados: ['Manada de cavalos de raça (valioso)', 'Lobos (perigo alto)', 'Rota pública: Estrada do Rei continua para o leste'] },
      { id: 'r-espionagem', tipo: 'espionagem', titulo: 'Espionagem da Mina Rubra', horas: 10, lido: true, local: 'v-mina',
        quem: 'Batedor de elite', dono: 'valdren', defesa: '≈ 15 lanceiros e muralha baixa', producao: 'Ferro, ≈ 40/h', estoque: 'Ferro ≈ 2.400 · pedra ≈ 600 · comida ≈ 300', tropasVistas: '≈ 35 lanceiros saindo para o oeste', descoberto: false, reliquia: 'rl-lamina' },
      { id: 'r-roubo', tipo: 'roubo', titulo: 'Relíquia roubada da Vila do Moinho', horas: 0.2, lido: false, local: 'vila-moinho', reliquia: 'rl-calice',
        forcas: '≈ 30 tropas · infantaria e cavalaria', origem: 'leste', tipoAtaque: 'Saque', perdas: { meu: '5 milicianos · 22 de população', deles: '≈ 4 cavaleiros' }, levado: { comida: 260 } },
      { id: 'r-fauna', tipo: 'fauna', titulo: 'Explorador morto no pântano', horas: 30, lido: true,
        quem: 'Explorador a pé', animal: 'crocodilos', onde: 'Pântano a sudoeste', resultado: 'O explorador foi morto. Tropas mortas não retornam.' },
      { id: 'r-caca', tipo: 'caca', titulo: 'Caçada aos javalis', horas: 14, lido: true,
        grupo: '6 arqueiros', animal: 'javalis', ganho: { comida: 96, couro: 24, peles: 2 }, perdas: 'Nenhuma' },
      { id: 'r-extracao', tipo: 'extracao', titulo: 'Prata extraída', horas: 1, lido: true, jazida: 'j-prata', ganho: { prata: 34 }, restante: 0.74 },
      { id: 'r-escudo', tipo: 'bloqueio', titulo: 'Ataque sem combate', horas: 20, lido: true, local: 'x-mina', tropas: '12 lanceiros', tipoAtaque: 'Saque' }
    ],

    /* Notificações (exemplos). horas: há quanto tempo. ir: rota do protótipo. */
    notificacoes: [
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
      { id: 'n9', cat: 'social', titulo: 'Sua bandeira foi derrubada', texto: '“Fica longe da Salina.” não está mais no mapa.', horas: 18, lido: true, ir: 'bandeiras' },
      { id: 'n10', cat: 'ataque', titulo: 'Ataque sem combate', texto: 'O alvo estava protegido por escudo de novato. Suas tropas voltaram.', horas: 20, lido: true, ir: 'relatorio?id=r-escudo' },
      { id: 'n8', cat: 'temporada', titulo: 'Faltam 41 dias para o fim da temporada', texto: 'Relíquias e títulos da temporada ainda podem ser conquistados.', horas: 30, lido: true, ir: 'temporada' }
    ],
    preferenciasPush: { ataque: true, construcao: true, recrutamento: false, exploracao: true, fauna: true, social: false, temporada: true },

    /* Temporada e legado (exemplos) */
    legado: {
      linhagem: { nivel: 4, progresso: 0.62, desbloqueios: [
        { nivel: 2, txt: 'Forma de brasão "Rodela"', feito: true },
        { nivel: 3, txt: 'Nome de linhagem exibido no perfil', feito: true },
        { nivel: 5, txt: 'Escolher a região inicial ao fundar o reino' },
        { nivel: 6, txt: 'Estandarte bordado (cosmético)' },
        { nivel: 8, txt: 'Castelo de pedra clara (cosmético)' }
      ] },
      reliquias: [
        { id: 'coroa-ferro', nome: 'Coroa de Ferro Frio', bonus: '+2% produção de ferro', como: 'Defender 10 ataques nesta temporada', ganha: true },
        { id: 'lanterna', nome: 'Lanterna do Explorador', bonus: '+3% visão de exploradores', como: 'Revelar 300 hexágonos', ganha: true },
        { id: 'chave-ruina', nome: 'Chave das Ruínas', bonus: '+2% rendimento de extração', como: 'Ocupar uma ruína antiga', ganha: false, progresso: 0 },
        { id: 'presa', nome: 'Presa do Grande Urso', bonus: '+2% rendimento de caça', como: 'Caçar 5 bandos de ursos', ganha: false, progresso: 0.4 }
      ],
      tetoBonus: '5%',
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
        { nome: 'Casa Mirante', brasao: { forma: 'portugues', divisao: 'cortado', cor1: 'verde', cor2: 'ouro', simbolo: 'espada', corSimbolo: 'prata' }, baixas: 990, perdas: 410, tropas: 1030, familias: 2020 },
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
      { id: 'rl-muralha-viva', nome: 'Muralha Viva', tipo: 'resistencia', bonus: 20, dono: 'meu', local: 'castelo', origem: 'Tomada num saque no dia 21' },
      { id: 'rl-lamina', nome: 'Lâmina do Rei Antigo', tipo: 'ataque', bonus: 15, dono: 'valdren', local: 'v-mina', espionada: 10 },
      { id: 'rl-corvo-1', nome: 'Coroa de Espinhos', tipo: 'resistencia', bonus: 20, dono: 'corvo', local: 'c-mina' },
      { id: 'rl-corvo-2', nome: 'Olho do Corvo', tipo: 'ataque', bonus: 15, dono: 'corvo', local: 'c-mina' },
      { id: 'rl-corvo-3', nome: 'Sino de Bronze', tipo: 'producao', bonus: 15, dono: 'corvo', local: 'c-mina' },
      { id: 'rl-calice', nome: 'Cálice das Colheitas', tipo: 'producao', bonus: 15, dono: null, local: null, roubada: { horas: 0.2, de: 'vila-moinho', origem: 'leste', marcha: 'm-roubo' } }
    ],
    ruinasComReliquia: ['j-ruina'],
    escavacoes: [],
    /* Aliança: limite de membros para não desequilibrar um mundo de até 30 reinos */
    alianca: {
      nome: 'Pacto da Pedra', limite: 5, desde: 'dia 12',
      brasao: { forma: 'classico', divisao: 'esquartelado', cor1: 'azul', cor2: 'verde', simbolo: 'torre', corSimbolo: 'prata' },
      membros: ['meu', 'lumen', 'fenda'], papeis: { meu: 'Líder', lumen: 'Membro', fenda: 'Membro' },
      castelos: { lumen: 'a-castelo', fenda: 'f-castelo' }
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
      escudo: '3 dias',
      mantido: ['Linhagem nível 4', '2 relíquias da temporada', '3 títulos', 'Brasões e cosméticos']
    },

    /* Rendimento ilustrativo da caça por animal */
    caca: {
      lobos: { comida: '30–50', couro: '10–20', peles: '25–40' },
      javalis: { comida: '80–120', couro: '20–30', peles: '0–5' },
      ursos: { comida: '60–90', couro: '30–45', peles: '40–60' },
      crocodilos: { comida: '40–60', couro: '50–70', peles: '0' }
    },

    notificacoesNaoLidas: 6
  };

  RP.TIPOS_LOCAL = {
    castelo: 'Castelo (capital)', vila: 'Vila', mina: 'Mina', serraria: 'Serraria', pasto: 'Pasto',
    armazem: 'Armazém', ferraria: 'Ferraria', quartel: 'Quartel'
  };
  RP.TIPOS_BANDEIRA = {
    reivindicacao: 'Reivindicação', ameaca: 'Ameaça', alianca: 'Aliança', aviso: 'Aviso'
  };
})();
