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
      ferro: { nome: 'Ferro', qtd: 640, cap: 5000, taxa: 42 }
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
      { id: 'v-mina', reino: 'valdren', tipo: 'mina', nome: 'Mina Rubra', c: 33, l: 12, terreno: 'colina', nivel: '?', info: ['Ferro'] },
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
      { id: 'r-valdren', nome: 'Caminho de Valdren', por: 'valdren', pts: [[32, 8], [29, 11], [26, 13], [23, 16]] },
      { id: 'r-sul', nome: 'Trilha do Sul', por: 'meu', pts: [[14, 19], [13, 23], [13, 27]] }
    ],
    vaus: [{ c: 16, l: 26, nome: 'Vau do Salgueiro' }],

    /* Movimentos no mapa. pos = fração (0–1) do caminho já percorrida. */
    marchas: [
      { id: 'm-inimigo', dono: 'desconhecido', tipo: 'exercito', hostil: true, pts: [[25, 8], [21, 11], [18, 14]], pos: 0.62,
        nome: 'Forças desconhecidas', resumo: '≈ 60 tropas · infantaria e cavalaria', origem: 'nordeste', alvo: 'pasto', seg: 2472 },
      { id: 'm-valdren', dono: 'valdren', tipo: 'exercito', estandarte: true, pts: [[27, 13], [25, 15], [23, 16]], pos: 0.5,
        nome: 'Exército de Casa Valdren', resumo: '≈ 35 tropas · lanceiros', alvo: 'j-prata', seg: 1310 },
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

    /* Áreas já exploradas: informação envelhece ("horas" desde a última visão) */
    explorado: [
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

    filas: {
      obras: [
        { rotulo: 'Serraria do Bosque → nível 4', seg: 760, total: 1800 },
        { rotulo: 'Muralha do castelo → nível 4', espera: true }
      ],
      recrutamento: [{ rotulo: '10 arqueiros · Quartel da Guarda', seg: 492, total: 900 }]
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
