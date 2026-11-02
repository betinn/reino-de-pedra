/* Reino de Pedra — dados fictícios e fixos do protótipo (mock).
   Nenhum valor aqui é balanceamento: números servem só para preencher as telas.
   Tempos ("seg") são contados a partir da abertura da página. */
(function () {
  'use strict';
  var RP = (window.RP = window.RP || {});

  RP.dados = {
    temporada: { numero: 3, nome: 'Temporada do Ferro Frio', diasRestantes: 41, reinos: 12408 },

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

    populacao: {
      atual: 1240, teto: 1500, taxa: 18, bonusComida: 30,
      moradias: [{ local: 'Castelo de Pedralva', qtd: 2 }, { local: 'Vila do Moinho', qtd: 3 }, { local: 'Vila do Vau', qtd: 1 }]
    },

    reinos: {
      meu: { nome: 'Pedralva', cor: 'meu', brasao: null },
      valdren: { nome: 'Casa Valdren', cor: 'rival-1', brasao: { forma: 'classico', divisao: 'partido', cor1: 'vermelho', cor2: 'ouro', simbolo: 'estrela', corSimbolo: 'negro' } },
      corvo: { nome: 'Ordem do Corvo', cor: 'rival-2', brasao: { forma: 'redondo', divisao: 'cortado', cor1: 'negro', cor2: 'purpura', simbolo: 'lua', corSimbolo: 'prata' } },
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
        espionado: { horas: 10, defesa: '≈ 15 lanceiros e muralha baixa' } },
      { id: 'v-vila', reino: 'valdren', tipo: 'vila', nome: 'Vila Alta', c: 30, l: 6, terreno: 'planicie', nivel: '?' },
      { id: 'v-pasto', reino: 'valdren', tipo: 'pasto', nome: 'Pasto Leste', c: 35, l: 9, terreno: 'planicie', nivel: '?' },
      { id: 'v-serraria', reino: 'valdren', tipo: 'serraria', nome: 'Serraria Velha', c: 29, l: 14, terreno: 'floresta', nivel: '?' },
      { id: 'v-quartel', reino: 'valdren', tipo: 'quartel', nome: 'Acampamento', c: 30, l: 10, terreno: 'planicie', nivel: '?' },

      { id: 'c-castelo', reino: 'corvo', tipo: 'castelo', nome: 'Fortaleza do Corvo', c: 35, l: 27, terreno: 'planicie', nivel: '?' },
      { id: 'c-vila', reino: 'corvo', tipo: 'vila', nome: 'Vila Negra', c: 33, l: 29, terreno: 'planicie', nivel: '?' },
      { id: 'c-mina', reino: 'corvo', tipo: 'mina', nome: 'Mina Funda', c: 38, l: 30, terreno: 'colina', nivel: '?' },
      { id: 'c-serraria', reino: 'corvo', tipo: 'serraria', nome: 'Serraria', c: 36, l: 23, terreno: 'floresta', nivel: '?' },
      { id: 'c-armazem', reino: 'corvo', tipo: 'armazem', nome: 'Armazém', c: 33, l: 25, terreno: 'planicie', nivel: '?' },

      { id: 'x-mina', reino: 'desconhecido', tipo: 'mina', nome: 'Mina', c: 7, l: 5, terreno: 'colina', nivel: '?' }
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
      vagasObras: 3,
      recrutamento: [{ unidade: 'arqueiro', qtd: 10, rotulo: '10 arqueiros · Quartel da Guarda', seg: 492, total: 900 }],
      vagasRecrutamento: 4
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
        efeito: 'Rua pública: qualquer jogador usa; reduz animais', custo: { madeira: 120, pedra: 80 }, porHex: true, tempo: 300 }
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
      { id: 'batedor', nome: 'Batedor de elite', icone: 'batedor', velocidade: 'Rápida', visao: 'Alta', custo: 'Caro', carac: 'Furtivo; espiona exércitos e reinos, revela o dono de locais', livres: 1, treino: { comida: 150, couro: 40 } }
    ],

    /* Rendimento ilustrativo da caça por animal */
    caca: {
      lobos: { comida: '30–50', couro: '10–20', peles: '25–40' },
      javalis: { comida: '80–120', couro: '20–30', peles: '0–5' },
      ursos: { comida: '60–90', couro: '30–45', peles: '40–60' },
      crocodilos: { comida: '40–60', couro: '50–70', peles: '0' }
    },

    notificacoesNaoLidas: 3
  };

  RP.TIPOS_LOCAL = {
    castelo: 'Castelo (capital)', vila: 'Vila', mina: 'Mina', serraria: 'Serraria', pasto: 'Pasto',
    armazem: 'Armazém', ferraria: 'Ferraria', quartel: 'Quartel'
  };
  RP.TIPOS_BANDEIRA = {
    reivindicacao: 'Reivindicação', ameaca: 'Ameaça', alianca: 'Aliança', aviso: 'Aviso'
  };
})();
