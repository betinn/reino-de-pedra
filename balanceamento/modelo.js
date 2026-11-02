/* Reino de Pedra — modelo de balanceamento (aprovado).
   Uso: node balanceamento/modelo.js > balanceamento/tabelas.md
   Sem dependências. Todos os números de jogo saem dos parâmetros abaixo; as metas no fim
   são verificadas a cada execução (✓ ou ✗). Mudar um parâmetro e rodar de novo mostra o efeito. */
'use strict';

/* ================================================================ parâmetros */
const P = {
  temporadaDias: 70,
  /* produção por local (por hora) e crescimento por nível; nível máximo 10 */
  prodBase: 30, prodCresc: 1.30, nivelMax: 10,
  /* o castelo produz um pouco de cada recurso básico: o reino base sempre consegue recrutar */
  casteloBase: 25, casteloCresc: 1.12, casteloCusto: 4, casteloTempo: 2,   /* nenhum local passa do nível do castelo */
  /* custo da melhoria para o nível L (total de recursos) e tempo de obra */
  custoN2: 50, custoCresc: 2.15,
  tempoN2: 2 * 60, tempoCresc: 2.0,                     /* segundos */
  receita: { madeira: 0.45, pedra: 0.35, ferro: 0.10, comida: 0.10 },
  /* população: teto por moradia, crescimento logístico, trabalhadores por nível de local.
     Tropas ocupam o teto (moram no reino): cada soldado é um trabalhador a menos. */
  tetoCastelo: 300, tetoPorMoradia: 60, popInicial: 220, custoMoradia: 400, moradiaPasso: 120,
  crescPop: 0.05, bonusComida: 0.30, trabPorNivel: 10,
  /* estoque inicial (kit) e capacidade de estoque de um local em horas de produção */
  kit: { madeira: 600, pedra: 400, comida: 800, ferro: 300 },
  estoqueHoras: 10,
  /* servidor: estoque mínimo do castelo por recurso (o castelo também guarda o excedente quando não há armazém),
     capacidade do armazém por recurso no nível L = capN1 × capCresc^(L−1), couro inicial do kit */
  estoqueMinimo: 2000, armazem: { capN1: 2000, capCresc: 1.35 }, kitExtra: { couro: 200 },
  /* servidor: carregadores da requisição (a pé, sem escolta); rio sem ponte se atravessa pelo vau (× custo do terreno) */
  carregador: { carga: 50, vel: 'Lenta' }, rio: { vau: 2.0 },
  /* servidor: raio de visão (hexágonos) do castelo, dos locais e de tropas em campo; avistamentos somem depois de 10 h */
  visao: { castelo: 3, local: 2, tropa: 1 }, avistamentoH: 10,
  /* novos locais: custo e quando o jogador funda (médio) */
  custoNovoLocal: 1500, novoLocalCresc: 1.22, tempoNovoLocal: 90 * 60,
  /* deslocamento: minutos por unidade de custo de terreno */
  minPor: { Lenta: 2.4, 'Média': 1.6, 'Rápida': 1.0 },
  terreno: { planicie: 1, colina: 1.25, floresta: 1.8, montanha: 2.3, pantano: 2.8 },
  terrenoMedio: 1.35, rotaFator: 0.55,
  /* mundo */
  reinos: 30, mapa: { cols: 60, lins: 48 },
  /* combate */
  expPerdas: 1.5, vantagem: 1.5, miliciaPorPop: 0.05, defMilicia: 15,
  portoes: [0, 1.15, 1.3, 1.45, 1.6, 1.75],               /* multiplicador de defesa do castelo por nível de portões */
  /* torres */
  torre: { custoN1: 600, custoCresc: 1.8, tempoN1: 40 * 60, arqPorNivel: 6, bonusAlto: 3.0, alcance: n => n + 1, nivelMax: 3, estrutura: 300 },
  portoesEstrutura: 500,                                   /* pontos de estrutura por nível de portão */
  /* saque */
  saqueQueda: 0.20, saqueMinimo: 0.20,
  /* relíquias */
  reliquia: { ataque: 0.15, producao: 0.15, resistencia: 0.20, escavarHoras1: 12, escavarMin: 4 },
  /* proteções */
  escudoNovatoH: 72, escudoExilioH: 24, regenciaH: 48,
  /* legado: relíquias da temporada (+1% a +2% cada, até 3 equipadas, teto somado de 5%) */
  legado: { relMin: 0.01, relMax: 0.02, equipadas: 3, teto: 0.05 },
  /* fauna (força = soma de (ataque + defesa) / 2 do grupo): com o dobro do limite, passa ileso; acima do limite, risco um nível menor.
     Chance de ataque por região de fauna atravessada; num ataque, o grupo perde 5% (acima do limite) ou 25% (abaixo); explorador sozinho morre. */
  fauna: { baixo: 40, medio: 120, alto: 300 },
  ataqueFauna: { baixo: 0.10, medio: 0.25, alto: 0.50 }, perdaFauna: { acima: 0.05, abaixo: 0.25 }, faunaVoltaH: 24,
  /* caça: rendimento por bando abatido (o bando reaparece em 24 h); 20 min no local */
  caca: { javalis: { comida: 120, couro: 40, peles: 5, nivel: 'baixo' }, lobos: { comida: 50, couro: 30, peles: 40, nivel: 'alto' },
          ursos: { comida: 90, couro: 60, peles: 60, nivel: 'alto' }, crocodilos: { comida: 50, couro: 90, peles: 0, nivel: 'medio' } },
  cacasDia: 3,
  /* exploradores: ocupam 1 de população; força só conta contra fauna */
  exploradores: {
    pe:         { nome: 'A pé', custo: { comida: 40 }, tempo: 60, vel: 'Lenta', visao: 2, forca: 10 },
    cavalo:     { nome: 'A cavalo', custo: { comida: 80, couro: 20 }, tempo: 180, vel: 'Rápida', visao: 3, forca: 15 },
    prospector: { nome: 'Prospector', custo: { comida: 120, ferro: 60 }, tempo: 360, vel: 'Lenta', visao: 1, jazidas: 2, forca: 8 },
    batedor:    { nome: 'Batedor de elite', custo: { comida: 150, couro: 40 }, tempo: 480, vel: 'Rápida', visao: 3, forca: 20 }
  },
  /* rotas e pontes: custo por hexágono × fator do terreno; ponte sobre rio */
  rota: { custo: { madeira: 120, pedra: 80 }, tempo: 300 }, ponte: { custo: { madeira: 600, pedra: 400 }, tempo: 1800 },
  /* espionagem: chance de o batedor ser visto ao espionar um local; visto: metade das vezes é capturado (sem relatório) */
  espiao: { base: 0.15, porTorre: 0.10, porTropa: 0.005, max: 0.60, capturado: 0.5, tempoNoLocal: 600 },
  /* alianças */
  alianca: 5,

  /* ---------- valiosos, comércio, ferraria e guerra ---------- */
  /* valor de referência em recursos básicos: orienta trocas, a IA comerciante e o limite do novato (não é preço fixo) */
  valor: { comida: 1, madeira: 1, pedra: 1, ferro: 1, couro: 2, peles: 2, sal: 6, ervas: 8, prata: 10, aco: 15, ouro: 20, gema: 30, cavalo: 40, minerio: 60 },
  /* jazidas finitas: cada jazida valiosa guarda 20 mil em valor; 1 de cada valioso para cada 3 reinos; minério raro: 1 para cada 6 */
  jazida: { valor: 20000, porReinos: 3, valorLendaria: 12000, lendariasPorReinos: 6 },
  /* extração (valor por hora): taxa × carga média × tropas^0,8; posto ×1,5; rota no caminho ×1,2; até 50 tropas por jazida */
  extracao: { taxa: 0.158, expTropas: 0.8, posto: 1.5, rota: 1.2, maxTropas: 50 },
  /* comércio: sem mercado global; IA comerciante compra a 85% e vende a 115% do valor, com o próprio estoque */
  comercio: { margemIA: 0.15, novatoDia: 2000 },          /* reino sob escudo: diferença máxima por dia entre o que dá e recebe */
  pacto: { diasMin: 1, diasMax: 7, ativosMax: 3 },
  resgateH: 24, treguaSaidaH: 24,
  /* eras: a do ferro é a inicial */
  eras: {
    aco:   { nome: 'Era do Aço', req: 'ferraria nível 7', custo: { ouro: 80, ferro: 1500, madeira: 1000 }, tempo: 6 * 3600, dia: 10,
             libera: 'armas e armaduras dos níveis 2 e 3, cavaleiro de elite, equipamento lendário' },
    cerco: { nome: 'Era do Cerco Avançado', req: 'Era do Aço e quartel nível 8', custo: { ouro: 150, madeira: 4000, pedra: 3000, ferro: 1500 }, tempo: 12 * 3600, dia: 21,
             libera: 'trebuchet e portões dos níveis 4 e 5' }
  },
  /* ferraria: armas (+ataque) e armaduras (+defesa) por família (infantaria, arqueiros, cavalaria); fila própria de até 10 */
  ferraria: {
    bonusNivel: 0.08, familias: 3, linhas: 2,
    niveis: [
      { custo: { ferro: 1500, madeira: 800, couro: 200 }, tempo: 2 * 3600, req: 'ferraria nível 3' },
      { custo: { ferro: 3000, madeira: 1500, aco: 60 }, tempo: 6 * 3600, req: 'Era do Aço' },
      { custo: { ferro: 6000, madeira: 3000, aco: 150, ouro: 50 }, tempo: 12 * 3600, req: 'Era do Aço e ferraria nível 9' }
    ],
    linhasTipicas: 2                                        /* um reino típico leva 2 linhas ao nível 3 */
  },
  /* veterania: marca por vitória com perdas < 50% contra inimigo com pelo menos 30% da própria força */
  veterania: { marcas: [2, 5, 9], bonus: [0.05, 0.10, 0.15], perdasMax: 0.5, forcaMin: 0.3 },
  /* equipamento lendário: +25% de ataque ou defesa para um exército de até 50 tropas; 1 por reino */
  lendario: { bonus: 0.25, tropas: 50, custo: { minerio: 100, ferro: 1500, aco: 100 }, tempo: 24 * 3600, req: 'Era do Aço e ferraria nível 8' },
  /* feridos: 30% das baixas de quem vence ou recua pela tática; 5 ervas curam 1; sem ervas em 24 h, morrem */
  feridos: { frac: 0.30, ervas: 5, esperaH: 24, curaH: 2 },
  /* teto da soma de bônus de combate (armas e armaduras, veterania, relíquia, lendário, legado) */
  tetoBonus: 0.50,
  /* queda do castelo com outros locais: a sede vai para o local de maior nível */
  queda: { nivel: 0.5, recursos: 0.5, populacao: 0.3, tropas: 0.4 },     /* tropas: suposição da simulação (mortas no cerco), não regra */
  /* mensageiro: leva mensagens a outros reinos; ocupa 1 de população; ninguém o ataca */
  mensageiro: { custo: { comida: 30 }, pop: 1, tempo: 60, vel: 'Rápida', caracteres: 200, recadoProposta: 120 },
  /* salgadeira (sal): o local de comida guarda 20 h em vez de 10 h */
  salgadeira: { custo: { sal: 200, madeira: 300 }, tempo: 3600, horas: 20 },
  /* recrutamento: o castelo treina as unidades básicas; o quartel treina todas */
  recrutaCastelo: ['milicia', 'lanceiro', 'arqueiro'],

  /* ---------- relíquias, extração e caravanas (servidor) ---------- */
  /* veículos: tempo de construção (s) de cada um, na fila de obras do castelo, onde ficam (os do protótipo: 5 e 15 min) */
  veiculo: { tempo: { carroca: 300, carrocao: 900 } },
  /* caravana (e escolta de relíquia) pouco protegida: força da escolta, soma de (ataque + defesa)/2, abaixo do limite do perigo
     médio da fauna (120). 5 lanceiros (162) já bastam; 2 lanceiros (65), não. É só um aviso: ninguém é impedido de enviar. */
  caravana: { escoltaMin: 120 },
  /* posto de extração (ou de escavação): obra opcional no hexágono da jazida ou da ruína (os números do protótipo) */
  posto: { custo: { madeira: 350, pedra: 200 }, tempo: 1200 },
  /* "rota no caminho" da extração (×extracao.rota): pelo menos metade dos hexágonos do caminho até o depósito é rota pública */
  extracaoRotaFrac: 0.5,
  /* visibilidade das relíquias guardadas no mesmo local: a partir de 2, brilho para quem já explorou a área;
     a partir de 3, farol para todos, até na névoa (1 relíquia: só a espionagem revela) */
  reliquiaVis: { brilho: 2, farol: 3 },
  /* o transporte manual aparece ao fundar o primeiro local a mais de 4 hexágonos do castelo (fora da vista dele, raio 3) */
  logisticaLongeHex: 4
};

/* unidades: atk, def, velocidade, carga (recursos), custo, tempo (s), população */
/* fam: família para armas, armaduras e vantagens; vence: família que a unidade domina */
const U = {
  milicia:   { nome: 'Milícia',   fam: 'infantaria', atk: 5,  def: 15, vel: 'Lenta',  carga: 20,  custo: { comida: 20, madeira: 10 }, tempo: 30, pop: 1, so: 'defesa' },
  lanceiro:  { nome: 'Lanceiro',  fam: 'infantaria', atk: 25, def: 40, vel: 'Lenta',  carga: 40,  custo: { comida: 30, madeira: 30, ferro: 30 }, tempo: 180, pop: 1, vence: 'cavalaria' },
  arqueiro:  { nome: 'Arqueiro',  fam: 'arqueiros',  atk: 35, def: 25, vel: 'Média',  carga: 40,  custo: { comida: 30, madeira: 50, couro: 10 }, tempo: 210, pop: 1, vence: 'infantaria' },
  cavalaria: { nome: 'Cavalaria', fam: 'cavalaria',  atk: 45, def: 30, vel: 'Rápida', carga: 80,  custo: { comida: 60, ferro: 50, couro: 30 }, tempo: 360, pop: 1, vence: 'arqueiros' },
  elite:     { nome: 'Cavaleiro de elite', fam: 'cavalaria', atk: 60, def: 40, vel: 'Rápida', carga: 80, custo: { comida: 70, ferro: 60, couro: 40, cavalo: 1 }, tempo: 480, pop: 1, vence: 'arqueiros', req: 'Era do Aço' },
  ariete:    { nome: 'Aríete',    fam: 'cerco', atk: 10, def: 10, vel: 'Lenta',  carga: 0,   custo: { madeira: 300, ferro: 60 }, tempo: 900, pop: 4, cerco: 40 },
  trebuchet: { nome: 'Trebuchet', fam: 'cerco', atk: 5,  def: 5,  vel: 'Lenta',  carga: 0,   custo: { madeira: 600, pedra: 200, ferro: 150 }, tempo: 1800, pop: 6, cerco: 90, req: 'Era do Cerco Avançado' }
};
const NOME_FAM = { infantaria: 'Infantaria', arqueiros: 'Arqueiros', cavalaria: 'Cavalaria', cerco: 'Cerco' };
const VEICULOS = { carroca: { carga: 500, vel: 'Lenta', custo: { madeira: 150, ferro: 20 } }, carrocao: { carga: 1500, vel: 'Média', custo: { madeira: 400, ferro: 80, cavalo: 2 } } };

/* ================================================================ fórmulas */
const soma = o => Object.values(o).reduce((s, v) => s + v, 0);
const r0 = v => Math.round(v), r1 = v => Math.round(v * 10) / 10;
const prod = L => P.prodBase * Math.pow(P.prodCresc, L - 1);
const castelo = L => P.casteloBase * Math.pow(P.casteloCresc, L - 1);
const custo = L => P.custoN2 * Math.pow(P.custoCresc, L - 2);          /* para subir ao nível L (L ≥ 2) */
const tempoObra = L => P.tempoN2 * Math.pow(P.tempoCresc, L - 2);       /* segundos */
const payback = L => custo(L) / (prod(L) - prod(L - 1));                 /* horas */
const receita = total => Object.fromEntries(Object.entries(P.receita).map(([k, f]) => [k, r0(total * f / 10) * 10]));
const trabalhadores = L => P.trabPorNivel * L;
const custoMoradia = n => P.custoMoradia + P.moradiaPasso * n;                  /* n = moradias já construídas */
const tempoMoradia = n => 10 * 60 * (1 + 0.1 * n);
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
  v += (extra.pop || 0) * P.miliciaPorPop * P.defMilicia;                     /* população como milícia */
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
function simular(perfil, opc) {
  opc = opc || {};
  const S = {
    h: 0, est: Object.assign({}, P.kit), couro: 200, prodAcum: 0,
    locais: [{ t: 'comida', L: 1 }, { t: 'madeira', L: 1 }, { t: 'pedra', L: 1 }, { t: 'ferro', L: 1 }],
    casteloL: 1, moradias: 0, pop: P.popInicial, tropas: 0, fila: [], gastoMil: 0, gastoObra: 0, obras: 0, filaHorasNoite: [], fundados: 0,
    log: {}
  };
  const sessoes = perfil.sessoes;                     /* horas do dia em que o jogador entra */
  const teto = () => P.tetoCastelo + S.moradias * P.tetoPorMoradia;
  const trabNec = () => S.locais.reduce((s, x) => s + trabalhadores(x.L), 0);
  const eficiencia = () => Math.min(1, S.pop / Math.max(1, trabNec()));
  const producaoH = () => {
    const e = eficiencia(), out = { comida: 0, madeira: 0, pedra: 0, ferro: 0 };
    S.locais.forEach(x => { out[x.t] += prod(x.L) * e; });
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
      const precisaMoradia = S.pop < trabNec() * 1.1 && S.pop + S.tropas > teto() * 0.9;   /* faltam trabalhadores e o teto está cheio */
      if (precisaMoradia && S.fila.every(q => q.rot !== 'moradia')) {
        const c = receita(custoMoradia(S.moradias)); if (enfileirar('moradia', c, tempoMoradia(S.moradias), () => S.moradias++)) continue;
      }
      if (S.locais.length < perfil.locaisAte(dia) && S.fila.every(q => q.rot !== 'novo')) {
        const menos = TIPOS.slice().sort((a, b) => S.locais.filter(x => x.t === a).length - S.locais.filter(x => x.t === b).length)[0];
        if (enfileirar('novo', receita(P.custoNovoLocal * Math.pow(P.novoLocalCresc, S.fundados)), P.tempoNovoLocal, () => { S.locais.push({ t: menos, L: 1 }); S.fundados++; })) continue;
      }
      if (S.casteloL < 10 && S.locais.some(x => x.L >= S.casteloL) && S.fila.every(q => q.rot !== 'castelo')) {
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
    S.couro += 4;                                    /* caça ocasional */
    const sobra = pr.comida > castelo(S.casteloL) * 2;
    const livre = Math.max(1, teto() - S.tropas);     /* tropas ocupam o teto */
    S.pop = Math.max(0, Math.min(livre, S.pop + P.crescPop * S.pop * (1 - S.pop / livre) * (sobra ? 1 + P.bonusComida : 1)));
    S.tropas *= (1 - perfil.perdasDia / 24);          /* desgaste por combate */
    const dia = (S.h + 1) / 24;
    if (!S.diaMax && S.locais.length >= 8 && S.locais.reduce((s, x) => s + x.L, 0) / S.locais.length >= 9.5) S.diaMax = Math.ceil(dia);
    if (S.caiu && !S.recupCastelo && S.casteloL >= S.casteloAntes) S.recupCastelo = r1(dia - opc.quedaDia);
    if (S.caiu && !S.recupProd && soma(producaoH()) >= 0.95 * S.prodAntes) S.recupProd = r1(dia - opc.quedaDia);
    if ([1, 3, 7, 10, 14, 21, 35, 50, 70].includes(dia)) {
      S.log[dia] = { prod: r0(soma(producaoH())), locais: S.locais.length, nivelMedio: r1(S.locais.reduce((s, x) => s + x.L, 0) / S.locais.length),
        castelo: S.casteloL, pop: r0(S.pop + S.tropas), teto: teto(), trab: trabNec(), tropas: r0(S.tropas), efic: r0(eficiencia() * 100), obras: S.obras };
    }
  }
  S.noiteMedia = S.filaHorasNoite.slice(7).reduce((s, v) => s + v, 0) / Math.max(1, S.filaHorasNoite.length - 7);
  return S;
}
const PERFIS = {
  medio: { nome: 'Médio (4 sessões/dia)', sessoes: [8, 13, 19, 23], militar: 0.30, mantemTrab: 1.0, perdasDia: 0.004, fracTropas: 0.35, horizonte: 6, horizonteNoite: 10,
    locaisAte: d => Math.min(14, 4 + Math.floor(d / 4)) },
  ativo: { nome: 'Ativo (8 sessões/dia)', sessoes: [7, 9, 11, 13, 16, 19, 21, 23], militar: 0.42, mantemTrab: 0.95, perdasDia: 0.008, fracTropas: 0.55, horizonte: 3, horizonteNoite: 9,
    locaisAte: d => Math.min(18, 4 + Math.floor(d / 3)) }
};

/* ================================================================ saída */
const L = [];
const out = s => L.push(s);
const fmtT = seg => seg < 3600 ? r0(seg / 60) + ' min' : (Math.floor(seg / 3600) + ' h' + (r0((seg % 3600) / 60) ? ' ' + r0((seg % 3600) / 60) + ' min' : ''));
const NOME_REC = { aco: 'aço', minerio: 'minério raro', cavalo: 'cavalo de raça', cavalos: 'cavalos de raça' };
const fmtC = c => Object.entries(c).map(([k, v]) => v + ' ' + (NOME_REC[k === 'cavalo' && v > 1 ? 'cavalos' : k] || k)).join(', ');
out('# Tabelas do balanceamento (geradas)\n');
out('Geradas por `node balanceamento/modelo.js`. Não edite à mão: mude os parâmetros no modelo e rode de novo.\n');

out('## Locais de produção por nível\n');
out('| Nível | Produção/h | Trabalhadores | Custo para subir | Receita | Tempo de obra | Retorno do custo |');
out('|---|---|---|---|---|---|---|');
for (let n = 1; n <= P.nivelMax; n++) {
  out('| ' + n + ' | ' + r0(prod(n)) + ' | ' + trabalhadores(n) + ' | ' + (n > 1 ? r0(custo(n)) : '—') + ' | ' + (n > 1 ? fmtC(receita(custo(n))) : '—') + ' | ' +
    (n > 1 ? fmtT(tempoObra(n)) : '—') + ' | ' + (n > 1 ? r1(payback(n)) + ' h' : '—') + ' |');
}
out('\nEstoque de cada local: até ' + P.estoqueHoras + ' h da própria produção; o excedente vai para o armazém, que também guarda os valiosos.\n');
out('Castelo: produz ' + r0(castelo(1)) + '/h de cada recurso básico no nível 1 e ' + r0(castelo(10)) + '/h no nível 10. Nenhum local passa do nível do castelo. Melhorar o castelo custa ' + P.casteloCusto + '× e leva ' + P.casteloTempo + '× o tempo de um local do mesmo nível (nível 10: ' + fmtT(tempoObra(10) * P.casteloTempo) + ').\n');

out('## Unidades\n');
out('Valor: custo em valor de referência (couro vale 2, cavalo de raça 40). Por 100: ataque e defesa por 100 de valor.\n');
out('| Unidade | Família | Ataque | Defesa | Vence | Velocidade | Carga | Custo | Valor | Tempo | Pop. | Ataque/100 | Defesa/100 | Requisito |');
out('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
Object.values(U).forEach(u => {
  const t = valorDe(u.custo);
  out('| ' + u.nome + ' | ' + NOME_FAM[u.fam] + ' | ' + u.atk + ' | ' + u.def + ' | ' + (u.vence ? NOME_FAM[u.vence] : u.cerco ? 'torres e portões (' + u.cerco + ')' : '—') + ' | ' + u.vel + ' | ' + u.carga + ' | ' + fmtC(u.custo) + ' | ' + t + ' | ' + fmtT(u.tempo) + ' | ' + u.pop + ' | ' +
    r1(100 * u.atk / t) + ' | ' + r1(100 * u.def / t) + ' | ' + (u.req || '—') + ' |');
});
out('\nMensageiro: ' + fmtC(P.mensageiro.custo) + ', ' + P.mensageiro.pop + ' de população, ' + fmtT(P.mensageiro.tempo) + ', velocidade ' + P.mensageiro.vel.toLowerCase() + ' (reino vizinho em ' + fmtT(viagemMin(14, P.mensageiro.vel) * 60) + '). Mensagem de até ' + P.mensageiro.caracteres + ' caracteres; recado de proposta, até ' + P.mensageiro.recadoProposta + '.\n');
out('Veículos: carroça ' + VEICULOS.carroca.carga + ' (lenta, ' + fmtC(VEICULOS.carroca.custo) + '); carroção ' + VEICULOS.carrocao.carga + ' (média, ' + fmtC(VEICULOS.carrocao.custo) + '). Carregador da requisição: 50, a pé.\n');

out('## Deslocamento\n');
out('| Distância | Exemplo | Lenta | Média | Rápida | Lenta em rota |');
out('|---|---|---|---|---|---|');
[[3, 'local vizinho do próprio reino'], [6, 'outro lado do próprio reino'], [14, 'reino vizinho'], [30, 'meio mapa'], [P.mapa.cols, 'travessia do mapa']].forEach(([h, ex]) => {
  out('| ' + h + ' hex. | ' + ex + ' | ' + fmtT(viagemMin(h, 'Lenta') * 60) + ' | ' + fmtT(viagemMin(h, 'Média') * 60) + ' | ' + fmtT(viagemMin(h, 'Rápida') * 60) + ' | ' + fmtT(viagemMin(h, 'Lenta', true) * 60) + ' |');
});
out('\nMapa para ' + P.reinos + ' reinos: ' + P.mapa.cols + ' × ' + P.mapa.lins + ' hexágonos (≈ ' + r0(P.mapa.cols * P.mapa.lins / P.reinos) + ' por reino). Terreno médio ' + P.terrenoMedio + '; rota pública multiplica por ' + P.rotaFator + '.\n');

/* bônus de combate possíveis, antes do teto */
const BONUS = { armas: P.ferraria.bonusNivel * P.ferraria.niveis.length, vet: P.veterania.bonus[P.veterania.bonus.length - 1], lend: P.lendario.bonus, leg: P.legado.teto };
BONUS.maxAtk = BONUS.armas + BONUS.vet + P.reliquia.ataque + BONUS.lend + BONUS.leg;
BONUS.maxDef = BONUS.armas + BONUS.vet + P.reliquia.resistencia + BONUS.lend + BONUS.leg;
out('## Combates de referência\n');
out('Valor de ataque contra valor de defesa; o vencedor perde (menor/maior)^' + P.expPerdas + ' das tropas. Milícia: ' + (P.miliciaPorPop * 100) + '% da população do local, defesa ' + P.defMilicia + '. Arqueiros no alto de torres: defesa ×' + P.torre.bonusAlto + '.\n');
out('| Situação | Ataque | Defesa | Razão | Resultado | Perdas do atacante | Perdas da defesa |');
out('|---|---|---|---|---|---|---|');
const casos = [
  ['20 lanceiros contra mina com 15 lanceiros e 200 de população', { lanceiro: 20 }, { lanceiro: 15 }, { pop: 200 }],
  ['30 arqueiros contra a mesma mina', { arqueiro: 30 }, { lanceiro: 15 }, { pop: 200 }],
  ['30 arqueiros contra a mina com torre nível 2 (' + 2 * P.torre.arqPorNivel + ' arqueiros no alto)', { arqueiro: 30 }, { lanceiro: 15 }, { pop: 200, arqTorre: 2 * P.torre.arqPorNivel }],
  ['30 cavaleiros (saque) contra vila com 10 lanceiros', { cavalaria: 30 }, { lanceiro: 10 }, { pop: 300 }],
  ['30 cavaleiros contra vila com 15 arqueiros', { cavalaria: 30 }, { arqueiro: 15 }, { pop: 300 }],
  ['Mina Rubra (15 lanceiros, torre 1, relíquia de resistência) contra 40 arqueiros', { arqueiro: 40 }, { lanceiro: 15 }, { pop: 150, arqTorre: P.torre.arqPorNivel, reliquia: 0.20 }],
  ['Cerco: 150 tropas mistas contra castelo médio (60 tropas, 4 torres nível 1, portões 3, 1.500 de população)', { lanceiro: 60, arqueiro: 60, cavalaria: 30 }, { lanceiro: 35, arqueiro: 25 }, { pop: 1500, arqTorre: 4 * P.torre.arqPorNivel, portoes: 3 }],
  ['Mesmo cerco com 320 tropas', { lanceiro: 130, arqueiro: 130, cavalaria: 60 }, { lanceiro: 35, arqueiro: 25 }, { pop: 1500, arqTorre: 4 * P.torre.arqPorNivel, portoes: 3 }],
  ['Ataque perdido com tática média (recua com 40%)', { lanceiro: 10 }, { lanceiro: 15 }, { pop: 200 }, 0.40],
  ['40 arqueiros contra mina com 15 lanceiros, torre 1 e 200 de população, sem bônus', { arqueiro: 40 }, { lanceiro: 15 }, { pop: 200, arqTorre: P.torre.arqPorNivel }],
  ['Os mesmos 40 arqueiros com armas nível 3 (+' + r0(BONUS.armas * 100) + '%)', { arqueiro: 40 }, { lanceiro: 15 }, { pop: 200, arqTorre: P.torre.arqPorNivel, bonusA: BONUS.armas }],
  ['Os mesmos 40 arqueiros com todos os bônus de ataque (+' + r0(BONUS.maxAtk * 100) + '%, limitado a +' + P.tetoBonus * 100 + '%)', { arqueiro: 40 }, { lanceiro: 15 }, { pop: 200, arqTorre: P.torre.arqPorNivel, bonusA: BONUS.maxAtk }],
  ['A mesma mina com todos os bônus de defesa (+' + r0(BONUS.maxDef * 100) + '%, limitado a +' + P.tetoBonus * 100 + '%) contra os 40 arqueiros sem bônus', { arqueiro: 40 }, { lanceiro: 15 }, { pop: 200, arqTorre: P.torre.arqPorNivel, reliquia: P.reliquia.resistencia, bonusD: BONUS.maxDef - P.reliquia.resistencia }]
];
const resCasos = casos.map(([rot, a, d, x, lim]) => {
  const b = batalha(a, d, x, lim);
  out('| ' + rot + ' | ' + b.A + ' | ' + b.D + ' | ' + r1(b.razao) + ' | ' + (b.recuou ? 'recuou' : b.venceA ? 'atacante vence' : 'defesa vence') + ' | ' + r0(b.perdaA * 100) + '% | ' + r0(b.perdaD * 100) + '% |');
  return b;
});
out('');

out('## Torres de arqueiros\n');
out('| Nível | Alcance | Arqueiros no alto | Defesa somada | Custo | Tempo | Estrutura |');
out('|---|---|---|---|---|---|---|');
for (let n = 1; n <= P.torre.nivelMax; n++) {
  const c = P.torre.custoN1 * Math.pow(P.torre.custoCresc, n - 1);
  out('| ' + n + ' | ' + P.torre.alcance(n) + ' hex. | ' + n * P.torre.arqPorNivel + ' | ' + r0(n * P.torre.arqPorNivel * U.arqueiro.def * P.torre.bonusAlto) + ' | ' + fmtC({ pedra: r0(c * 0.7 / 10) * 10, madeira: r0(c * 0.3 / 10) * 10 }) + ' | ' + fmtT(P.torre.tempoN1 * n) + ' | ' +
    n * P.torre.estrutura + ' (' + Math.ceil(n * P.torre.estrutura / U.ariete.cerco) + ' aríetes) |');
}
out('\nPortões do castelo: ' + P.portoesEstrutura + ' de estrutura por nível (nível 3: ' + 3 * P.portoesEstrutura + ', ' + Math.ceil(3 * P.portoesEstrutura / U.ariete.cerco) + ' aríetes ou ' + Math.ceil(3 * P.portoesEstrutura / U.trebuchet.cerco) + ' trebuchets). Aríetes batem por combate; o trebuchet bate à distância, sem entrar no alcance dos arqueiros.\n');

out('## Fauna, saque, relíquias e proteções\n');
out('- Fauna (força = soma de (ataque + defesa)/2): baixo ' + P.fauna.baixo + ', médio ' + P.fauna.medio + ', alto ' + P.fauna.alto + '. Com o dobro do limite, o grupo passa ileso. 20 lanceiros = ' + forcaFauna({ lanceiro: 20 }) + ' (ileso em qualquer nível); 1 explorador a cavalo = ' + P.exploradores.cavalo.forca + '.');
out('- Saque repetido ao mesmo alvo em 24 h: −' + P.saqueQueda * 100 + '% por saque, até restar ' + P.saqueMinimo * 100 + '%.');
out('- Relíquias: ataque +' + P.reliquia.ataque * 100 + '%, produção +' + P.reliquia.producao * 100 + '%, resistência +' + P.reliquia.resistencia * 100 + '%. Produção +15% num local de nível 6 = +' + r0(prod(6) * 0.15) + '/h, perto de meio nível (' + r0(prod(7) - prod(6)) + '/h). Escavação: ' + P.reliquia.escavarHoras1 + ' h com 1 unidade, mínimo ' + P.reliquia.escavarMin + ' h.');
out('- Escudo de novato ' + P.escudoNovatoH + ' h; escudo de exílio ' + P.escudoExilioH + ' h; regência após ' + P.regenciaH + ' h sem entrar. Relíquias da temporada (legado): +' + P.legado.relMin * 100 + '% a +' + P.legado.relMax * 100 + '% cada, até ' + P.legado.equipadas + ' equipadas, teto somado de ' + P.legado.teto * 100 + '%. Aliança: até ' + P.alianca + ' reinos.\n');

out('## Simulação de uma temporada (' + P.temporadaDias + ' dias)\n');
const sims = {};
Object.entries(PERFIS).forEach(([k, pf]) => {
  const S = simular(pf); sims[k] = S;
  out('### ' + pf.nome + '\n');
  out('| Dia | Produção/h (total) | Locais | Nível médio | Castelo | População / teto | Trabalhadores | Eficiência | Tropas |');
  out('|---|---|---|---|---|---|---|---|---|');
  Object.entries(S.log).forEach(([d, v]) => out('| ' + d + ' | ' + v.prod + ' | ' + v.locais + ' | ' + v.nivelMedio + ' | ' + v.castelo + ' | ' + v.pop + ' / ' + v.teto + ' | ' + v.trab + ' | ' + v.efic + '% | ' + v.tropas + ' |'));
  out('\nGasto em obras ' + r0(S.gastoObra / 1000) + ' mil · em tropas ' + r0(S.gastoMil / 1000) + ' mil · economia no máximo (nível médio ≥ 9,5), sem guerra: ' + (S.diaMax ? 'dia ' + S.diaMax : 'não chega') + '.\n');
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
const tamJazida = k => Math.round((VAL[k].lend ? P.jazida.valorLendaria : P.jazida.valor) / P.valor[k] / 100) * 100;
const nJazidas = k => Math.round(P.reinos / (VAL[k].lend ? P.jazida.lendariasPorReinos : P.jazida.porReinos));
const ext10 = extracaoH({ lanceiro: 10 }), ext20 = extracaoH({ lanceiro: 20 }), ext40p = extracaoH({ lanceiro: 40 }, true);
out('## Recursos valiosos e lendários\n');
out('Valor de referência em recursos básicos (1). Orienta trocas, a IA comerciante e o limite do novato; os jogadores trocam pelo valor que combinarem. Couro e peles valem ' + P.valor.couro + '.\n');
out('| Recurso | Valor | Onde | Para que serve | Jazida guarda | Jazidas no mapa | 10 lanceiros | 40 lanceiros + posto |');
out('|---|---|---|---|---|---|---|---|');
Object.entries(VAL).forEach(([k, v]) => {
  out('| ' + v.nome + ' | ' + P.valor[k] + ' | ' + v.onde + ' | ' + v.uso + ' | ' + tamJazida(k) + ' | ' + nJazidas(k) + ' | ' + r1(ext10 / P.valor[k]) + '/h | ' + r1(ext40p / P.valor[k]) + '/h |');
});
out('\nExtração (valor por hora) = ' + P.extracao.taxa + ' × carga média × tropas^' + P.extracao.expTropas + '; posto ×' + P.extracao.posto + '; rota no caminho ×' + P.extracao.rota + '; até ' + P.extracao.maxTropas + ' tropas por jazida. Quanto mais valioso, mais devagar sai.\n');
out('| Grupo | Valor/h | Por população | Jazida de 20 mil dura |');
out('|---|---|---|---|');
[['1 lanceiro', { lanceiro: 1 }], ['10 lanceiros', { lanceiro: 10 }], ['10 cavaleiros', { cavalaria: 10 }], ['20 lanceiros', { lanceiro: 20 }], ['40 lanceiros + posto', { lanceiro: 40 }, true], ['40 lanceiros + posto + rota', { lanceiro: 40 }, true, true]].forEach(([rot, g, po, ro]) => {
  const v = extracaoH(g, po, ro);
  out('| ' + rot + ' | ' + r1(v) + ' | ' + r1(v / soma(g)) + ' | ' + fmtT(P.jazida.valor / v * 3600) + ' |');
});
out('\nUm trabalhador de um local nível 6 rende ' + r1(prod(6) / trabalhadores(6)) + '/h. Extrair rende mais por pessoa, mas a tropa fica longe de casa, exposta, e a jazida acaba.\n');
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
out('- **IA comerciante**: compra a ' + r0((1 - P.comercio.margemIA) * 100) + '% e vende a ' + r0((1 + P.comercio.margemIA) * 100) + '% do valor, só com o próprio estoque (mesmas regras dos jogadores). Ex.: 100 de ouro custam ' + r0(100 * P.valor.ouro * (1 + P.comercio.margemIA)) + ' em básicos; vender 100 de ouro rende ' + r0(100 * P.valor.ouro * (1 - P.comercio.margemIA)) + '.');
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
out('\n- Uma linha completa: ' + valorLinha + ' de valor e ' + fmtT(tempoLinha) + '. As ' + nLinhas + ' linhas: ' + r0(valorLinha * nLinhas / 1000) + ' mil e ' + r0(tempoLinha * nLinhas / 3600) + ' h de ferraria, ' + r0(100 * valorLinha * nLinhas / sims.medio.gastoObra) + '% do que o médio gasta em obras na temporada.');
out('- O nível 1 rende mais que recrutar com o mesmo valor a partir de ' + equilibrio('infantaria') + ' lanceiros, ' + equilibrio('arqueiros') + ' arqueiros ou ' + equilibrio('cavalaria') + ' cavaleiros. Antes disso, recrutar compensa mais: a ferraria é para exércitos grandes.\n');

/* ---------- lendário, elite, veterania, feridos e teto ---------- */
const lendTropas = P.lendario.bonus * P.lendario.tropas;
out('## Equipamento lendário e cavaleiro de elite\n');
out('- **Equipamento lendário**: ' + fmtC(P.lendario.custo) + ' (valor ' + valorDe(P.lendario.custo) + '), ' + fmtT(P.lendario.tempo) + ', ' + P.lendario.req + '. +' + P.lendario.bonus * 100 + '% de ataque ou defesa para um exército de até ' + P.lendario.tropas + ' tropas (num exército maior, o bônus se dilui). Vale no máximo ' + r1(lendTropas) + ' tropas. Um por reino; se o exército for derrotado, fica no campo e o vencedor leva.');
out('- **Cavaleiro de elite**: ataque ' + U.elite.atk + ', defesa ' + U.elite.def + ', rápida, carga ' + U.elite.carga + ', ' + fmtC(U.elite.custo) + ' (valor ' + valorDe(U.elite.custo) + '), ' + fmtT(U.elite.tempo) + '. Por população: ' + U.elite.atk + ' de ataque contra ' + U.cavalaria.atk + ' da cavalaria. Por 100 de valor: ' + r1(100 * U.elite.atk / valorDe(U.elite.custo)) + ' contra ' + r1(100 * U.cavalaria.atk / valorDe(U.cavalaria.custo)) + '. Mais forte por pessoa, mais caro por força.\n');
out('## Veterania, feridos e teto de bônus\n');
out('- **Veterania**: cada vitória com perdas abaixo de ' + P.veterania.perdasMax * 100 + '%, contra um inimigo com pelo menos ' + P.veterania.forcaMin * 100 + '% da própria força, dá 1 marca ao exército. ' + P.veterania.marcas.map((m, i) => m + ' marcas: +' + P.veterania.bonus[i] * 100 + '%').join('; ') + ' (ataque e defesa). Recrutas novos diluem as marcas na proporção; cada derrota tira 1. Fauna não conta.');
out('- **Feridos**: ' + P.feridos.frac * 100 + '% das baixas de quem vence, ou recua pela tática, voltam feridos. ' + P.feridos.ervas + ' ervas curam 1 em ' + P.feridos.curaH + ' h, no castelo; sem ervas em ' + P.feridos.esperaH + ' h, morrem. Curar custa ' + P.feridos.ervas * P.valor.ervas + ' de valor, ' + r0(100 * P.feridos.ervas * P.valor.ervas / valorDe(U.lanceiro.custo)) + '% de um lanceiro, e devolve a população. No caso dos 40 arqueiros sem bônus, as perdas caem de ' + r0(resCasos[9].perdaA * 100) + '% para ' + r0(resCasos[9].perdaA * (1 - P.feridos.frac) * 100) + '%.');
out('- **Teto de bônus**: a soma de armas ou armaduras (+' + r0(BONUS.armas * 100) + '%), veterania (+' + r0(BONUS.vet * 100) + '%), relíquia (+' + P.reliquia.ataque * 100 + '% ataque, +' + P.reliquia.resistencia * 100 + '% resistência), lendário (+' + r0(BONUS.lend * 100) + '%) e legado (+' + r0(BONUS.leg * 100) + '%) chega a +' + r0(BONUS.maxAtk * 100) + '% no ataque e +' + r0(BONUS.maxDef * 100) + '% na defesa; vale até +' + P.tetoBonus * 100 + '%. Torres e portões ficam fora do teto. Com o teto, um exército no máximo vence uma defesa até ' + (1 + P.tetoBonus) + '× maior e perde para 2×.\n');

/* ---------- fauna, caça, exploradores, rotas e espionagem ---------- */
const chanceEspiao = (torres, tropas) => Math.min(P.espiao.max, P.espiao.base + torres * P.espiao.porTorre + tropas * P.espiao.porTropa);
const riscoFauna = (nivel, forca) => forca >= 2 * P.fauna[nivel] ? 'nenhum' : forca >= P.fauna[nivel] ? ['nenhum', 'baixo', 'medio'][['baixo', 'medio', 'alto'].indexOf(nivel)] : nivel;
const NIVEL_NOME = { nenhum: 'nenhum', baixo: 'baixo', medio: 'médio', alto: 'alto' };
out('## Fauna, caça, exploradores, rotas e espionagem\n');
out('Fauna: força ' + P.fauna.baixo + ' / ' + P.fauna.medio + ' / ' + P.fauna.alto + ' (baixo, médio, alto). Chance de ataque por região atravessada: ' + Object.entries(P.ataqueFauna).map(([k, v]) => NIVEL_NOME[k] + ' ' + r0(v * 100) + '%').join(', ') + '. Num ataque, o grupo perde ' + r0(P.perdaFauna.acima * 100) + '% se tiver força acima do limite e ' + r0(P.perdaFauna.abaixo * 100) + '% se abaixo; um explorador sozinho morre. O bando abatido volta em ' + P.faunaVoltaH + ' h.\n');
out('| Grupo | Força | Perigo baixo | Perigo médio | Perigo alto |');
out('|---|---|---|---|---|');
[['Explorador a pé', P.exploradores.pe.forca], ['Explorador a cavalo', P.exploradores.cavalo.forca], ['Explorador + 5 lanceiros de escolta', P.exploradores.cavalo.forca + 5 * (U.lanceiro.atk + U.lanceiro.def) / 2],
 ['4 arqueiros', forcaFauna({ arqueiro: 4 })], ['10 lanceiros (extração)', forcaFauna({ lanceiro: 10 })], ['20 arqueiros', forcaFauna({ arqueiro: 20 })]].forEach(([rot, f]) => {
  out('| ' + rot + ' | ' + r0(f) + ' | ' + ['baixo', 'medio', 'alto'].map(n => { const r = riscoFauna(n, f); return r === 'nenhum' ? 'ileso' : 'risco ' + NIVEL_NOME[r]; }).join(' | ') + ' |');
});
out('\n**Caça** (por bando abatido; 20 min no local):\n');
out('| Animal | Perigo | Comida | Couro | Peles | Valor | Grupo para ir ileso |');
out('|---|---|---|---|---|---|---|');
Object.entries(P.caca).forEach(([k, c]) => {
  out('| ' + k[0].toUpperCase() + k.slice(1) + ' | ' + NIVEL_NOME[c.nivel] + ' | ' + c.comida + ' | ' + c.couro + ' | ' + c.peles + ' | ' + valorDe({ comida: c.comida, couro: c.couro, peles: c.peles }) + ' | ' + Math.ceil(2 * P.fauna[c.nivel] / 30) + ' arqueiros |');
});
const couroMedioCaca = Object.values(P.caca).reduce((s, c) => s + c.couro, 0) / Object.keys(P.caca).length;
const couroDemanda = sims.medio.log[35].tropas * (U.arqueiro.custo.couro / 3 + U.cavalaria.custo.couro / 6) / 35;
out('\nCouro: ' + P.cacasDia + ' caçadas por dia rendem ≈ ' + r0(P.cacasDia * couroMedioCaca) + '; o médio usa ≈ ' + r0(couroDemanda) + ' por dia para recrutar (1/3 arqueiros, 1/6 cavalaria).\n');
out('**Exploradores** (1 de população cada):\n');
out('| Tipo | Custo | Valor | Treino | Velocidade | Visão | Força contra fauna |');
out('|---|---|---|---|---|---|---|');
Object.values(P.exploradores).forEach(x => out('| ' + x.nome + ' | ' + fmtC(x.custo) + ' | ' + valorDe(x.custo) + ' | ' + fmtT(x.tempo) + ' | ' + x.vel + ' | ' + x.visao + (x.jazidas ? ' (jazidas a ' + x.jazidas + ')' : '') + ' | ' + x.forca + ' |'));
const rota10 = 10 * soma(P.rota.custo);
out('\n**Rotas**: ' + fmtC(P.rota.custo) + ' e ' + fmtT(P.rota.tempo) + ' por hexágono, multiplicados pelo terreno (' + Object.entries(P.terreno).map(([k, v]) => ({ planicie: 'planície', pantano: 'pântano' }[k] || k) + ' ×' + v).join(', ') + '). **Ponte** (hexágono de rio): ' + fmtC(P.ponte.custo) + ', ' + fmtT(P.ponte.tempo) + '. Vau: grátis e mais lento. 10 hexágonos de rota em planície: ' + rota10 + ' (' + r1(rota10 / prodDia(14)) + ' h de produção do médio no dia 14).\n');
out('**Espionagem**: chance de o batedor ser visto ao espionar = ' + r0(P.espiao.base * 100) + '% + ' + r0(P.espiao.porTorre * 100) + '% por torre no alcance + ' + r1(P.espiao.porTropa * 100) + '% por tropa da guarnição, até ' + r0(P.espiao.max * 100) + '%. Visto, metade das vezes é capturado (sem relatório); na outra, foge com o relatório. Em ambos os casos, o alvo vê o espião por 10 h. ' + fmtT(P.espiao.tempoNoLocal) + ' no local.\n');
out('| Alvo | Chance de ser visto |');
out('|---|---|');
[['Local sem torre e sem tropas', 0, 0], ['Mina com 15 lanceiros e 1 torre', 1, 15], ['Castelo médio (60 tropas, 4 torres)', 4, 60]].forEach(([rot, t, n]) => out('| ' + rot + ' | ' + r0(chanceEspiao(t, n) * 100) + '% |'));
out('');

/* ================================================================ metas */
const metas = [
  ['M1', 'Kit inicial recruta 10 lanceiros na primeira sessão', 'pode', Object.keys(U.lanceiro.custo).every(k => P.kit[k] >= U.lanceiro.custo[k] * 10)],
  ['M2a', 'Primeira melhoria se paga em até 6 h', r1(payback(2)) + ' h', payback(2) <= 6],
  ['M2b', 'Melhoria para o nível 10 se paga em 1 a 2 semanas (investimento de fim de temporada)', r1(payback(10) / 24) + ' dias', payback(10) >= 168 && payback(10) <= 336],
  ['M3a', 'Obra para o nível 2 leva até 2 min', fmtT(tempoObra(2)), tempoObra(2) <= 120],
  ['M3b', 'Obra para o nível 10 leva de 6 a 10 h', fmtT(tempoObra(10)), tempoObra(10) >= 6 * 3600 && tempoObra(10) <= 10 * 3600],
  ['M3c', '10 obras de nível 6 a 8 cobrem a noite (7 a 14 h)', fmtT((tempoObra(6) + tempoObra(7) + tempoObra(8)) / 3 * 10), (tempoObra(6) + tempoObra(7) + tempoObra(8)) / 3 * 10 >= 7 * 3600 && (tempoObra(6) + tempoObra(7) + tempoObra(8)) / 3 * 10 <= 14 * 3600],
  ['M4a', 'Vizinho do próprio reino (3 hex.) em até 15 min, tropa lenta', fmtT(viagemMin(3, 'Lenta') * 60), viagemMin(3, 'Lenta') <= 15],
  ['M4b', 'Reino vizinho (14 hex.) entre 30 e 60 min, tropa lenta', fmtT(viagemMin(14, 'Lenta') * 60), viagemMin(14, 'Lenta') >= 30 && viagemMin(14, 'Lenta') <= 60],
  ['M4c', 'Travessia do mapa em até 3 h 30 min, tropa lenta', fmtT(viagemMin(P.mapa.cols, 'Lenta') * 60), viagemMin(P.mapa.cols, 'Lenta') <= 210],
  ['M5a', 'Jogador médio com 60 a 150 tropas no fim do escudo (dia 3)', sims.medio.log[3].tropas, sims.medio.log[3].tropas >= 60 && sims.medio.log[3].tropas <= 150],
  ['M5b', 'Jogador médio com 400 a 900 tropas no dia 35', sims.medio.log[35].tropas, sims.medio.log[35].tropas >= 400 && sims.medio.log[35].tropas <= 900],
  ['M5c', 'Jogador ativo com 2 a 3× as tropas do médio no dia 35', r1(sims.ativo.log[35].tropas / sims.medio.log[35].tropas) + '×', sims.ativo.log[35].tropas / sims.medio.log[35].tropas >= 1.5 && sims.ativo.log[35].tropas / sims.medio.log[35].tropas <= 3],
  ['M5d', 'Recrutar não derruba a economia do médio (eficiência ≥ 90% no dia 35)', sims.medio.log[35].efic + '%', sims.medio.log[35].efic >= 90],
  ['M5e', 'Sem guerra, o ativo chega ao máximo da economia entre os dias 30 e 50', sims.ativo.diaMax ? 'dia ' + sims.ativo.diaMax : 'não chega', sims.ativo.diaMax >= 30 && sims.ativo.diaMax <= 50],
  ['M5f', 'Sem guerra, o médio só chega ao máximo depois do dia 40 (ou não chega)', sims.medio.diaMax ? 'dia ' + sims.medio.diaMax : 'não chega', !sims.medio.diaMax || sims.medio.diaMax > 40],
  ['M6', '30 cavaleiros levam pelo menos 2 h de produção de um local nível 6', r0(30 * U.cavalaria.carga / prod(6)) + ' h', 30 * U.cavalaria.carga / prod(6) >= 2],
  ['M7a', 'Local defendido cai com cerca de 1,5× a força (arqueiros contra lanceiros)', r1(resCasos[1].razao) + '×', resCasos[1].venceA && resCasos[1].perdaA <= 0.6],
  ['M7b', 'Torre muda o resultado do mesmo ataque', resCasos[2].venceA ? 'não muda' : 'defesa vence', !resCasos[2].venceA],
  ['M7c', 'Castelo médio resiste a 150 tropas e cai com cerca de 2× isso', (resCasos[6].venceA ? 'cai' : 'resiste') + ' / ' + (resCasos[7].venceA ? 'cai' : 'resiste'), !resCasos[6].venceA && resCasos[7].venceA],
  ['M8', 'Relíquia de produção vale menos que 1 nível do local (nível 6)', r0(prod(6) * 0.15) + ' < ' + r0(prod(7) - prod(6)), prod(6) * 0.15 < prod(7) - prod(6)],
  ['M9', 'Tática média recua com 40% e ainda causa perdas na defesa', r0(resCasos[8].perdaD * 100) + '% na defesa', resCasos[8].recuou && resCasos[8].perdaD > 0.05],
  ['M10', 'Bônus somados ficam no teto de +' + P.tetoBonus * 100 + '% (sem teto: +' + r0(BONUS.maxAtk * 100) + '% / +' + r0(BONUS.maxDef * 100) + '%)', r0(100 * (resCasos[11].A / resCasos[9].A - 1)) + '%', BONUS.maxAtk > P.tetoBonus && Math.abs(resCasos[11].A / resCasos[9].A - (1 + P.tetoBonus)) < 0.01],
  ['M11', 'Armas ou armaduras nível 1 só compensam a partir de 150 a 600 tropas da família', equilibrio('cavalaria') + ' a ' + equilibrio('infantaria'), ['infantaria', 'arqueiros', 'cavalaria'].every(f => equilibrio(f) >= 150 && equilibrio(f) <= 600)],
  ['M12', 'Ferraria completa custa 25% a 50% do gasto em obras do médio na temporada', r0(100 * valorLinha * nLinhas / sims.medio.gastoObra) + '%', valorLinha * nLinhas / sims.medio.gastoObra >= 0.25 && valorLinha * nLinhas / sims.medio.gastoObra <= 0.5],
  ['M13', 'Extrair valiosos rende por pessoa 1,5 a 3× um trabalhador de local nível 6 (10 lanceiros)', r1(ext10 / 10 / (prod(6) / trabalhadores(6))) + '×', ext10 / 10 / (prod(6) / trabalhadores(6)) >= 1.5 && ext10 / 10 / (prod(6) / trabalhadores(6)) <= 3],
  ['M14', 'O ouro da Era do Aço sai em 6 a 36 h com 20 lanceiros, sem posto', fmtT(P.eras.aco.custo.ouro * P.valor.ouro / ext20 * 3600), P.eras.aco.custo.ouro * P.valor.ouro / ext20 >= 6 && P.eras.aco.custo.ouro * P.valor.ouro / ext20 <= 36],
  ['M15', 'Ouro e aço no mapa cobrem 90% a 150% da demanda típica (escassos, motivo de disputa)', r0(100 * ofOuro / (demOuro * P.reinos)) + '% / ' + r0(100 * ofAco / (demAco * P.reinos)) + '%', [ofOuro / (demOuro * P.reinos), ofAco / (demAco * P.reinos)].every(x => x >= 0.9 && x <= 1.5)],
  ['M16', 'Era do Aço custa 2 a 4 h de produção do médio no dia 10; Era do Cerco, 4 a 8 h no dia 21 (sem o ouro)', Object.values(P.eras).map(e => r1((valorDe(e.custo) - e.custo.ouro * P.valor.ouro) / prodDia(e.dia)) + ' h').join(' / '),
    (x => x >= 2 && x <= 4)((valorDe(P.eras.aco.custo) - P.eras.aco.custo.ouro * P.valor.ouro) / prodDia(10)) && (x => x >= 4 && x <= 8)((valorDe(P.eras.cerco.custo) - P.eras.cerco.custo.ouro * P.valor.ouro) / prodDia(21))],
  ['M17', 'Curar um ferido custa 25% a 60% de recrutar um lanceiro', r0(100 * P.feridos.ervas * P.valor.ervas / valorDe(U.lanceiro.custo)) + '%', (x => x >= 0.25 && x <= 0.6)(P.feridos.ervas * P.valor.ervas / valorDe(U.lanceiro.custo))],
  ['M18', 'Equipamento lendário vale no máximo 15 tropas', r1(lendTropas) + ' tropas', lendTropas <= 15],
  ['M19', 'Cavaleiro de elite: mais ataque por pessoa e menos por valor que a cavalaria', U.elite.atk + ' > ' + U.cavalaria.atk + ' · ' + r1(100 * U.elite.atk / valorDe(U.elite.custo)) + ' < ' + r1(100 * U.cavalaria.atk / valorDe(U.cavalaria.custo)),
    U.elite.atk > U.cavalaria.atk && U.elite.atk / valorDe(U.elite.custo) < U.cavalaria.atk / valorDe(U.cavalaria.custo)],
  ['M20', 'Reino sob escudo recebe no máximo 30% do que ele mesmo produz no escudo', r0(100 * recebivelNovato / sims.medio.prodEscudo) + '%', recebivelNovato / sims.medio.prodEscudo <= 0.3],
  ['M21', 'Depois de perder o castelo no dia 35, o médio volta ao nível anterior em 2 a 6 dias', quedaS.recupCastelo != null ? quedaS.recupCastelo + ' dias' : 'não volta', quedaS.recupCastelo >= 2 && quedaS.recupCastelo <= 6],
  ['M22', 'Explorador sozinho corre risco em qualquer perigo; 20 arqueiros passam ilesos até no alto', ['baixo', 'medio', 'alto'].every(n => riscoFauna(n, P.exploradores.cavalo.forca) !== 'nenhum') && riscoFauna('alto', forcaFauna({ arqueiro: 20 })) === 'nenhum' ? 'sim' : 'não',
    ['baixo', 'medio', 'alto'].every(n => riscoFauna(n, P.exploradores.cavalo.forca) !== 'nenhum') && riscoFauna('alto', forcaFauna({ arqueiro: 20 })) === 'nenhum'],
  ['M23', P.cacasDia + ' caçadas por dia cobrem 70% a 150% do couro que o médio usa para recrutar', r0(100 * P.cacasDia * couroMedioCaca / couroDemanda) + '%', (x => x >= 0.7 && x <= 1.5)(P.cacasDia * couroMedioCaca / couroDemanda)],
  ['M24', '10 hexágonos de rota em planície custam 1 a 3 h de produção do médio no dia 14', r1(rota10 / prodDia(14)) + ' h', (x => x >= 1 && x <= 3)(rota10 / prodDia(14))],
  ['M25', 'Espionar um local defendido: 25% a 40% de ser visto; um castelo médio chega ao máximo', r0(chanceEspiao(1, 15) * 100) + '% / ' + r0(chanceEspiao(4, 60) * 100) + '%', chanceEspiao(1, 15) >= 0.25 && chanceEspiao(1, 15) <= 0.4 && chanceEspiao(4, 60) >= P.espiao.max]
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
  Pj.torre.alcanceBase = P.torre.alcance(0);                 /* alcance = nível + alcanceBase */
  const niveis = Array.from({ length: P.nivelMax }, (_, i) => i + 1);
  const ref = {
    producao: niveis.map(prod), castelo: niveis.map(castelo),
    custo: niveis.map(n => n > 1 ? custo(n) : 0), receita: niveis.map(n => n > 1 ? receita(custo(n)) : null),
    tempoObra: niveis.map(n => n > 1 ? tempoObra(n) : 0),
    moradia: [0, 1, 2, 5, 10].map(n => ({ n, custo: custoMoradia(n), tempo: tempoMoradia(n) })),
    novoLocal: [0, 1, 2, 5].map(n => ({ n, custo: receita(P.custoNovoLocal * Math.pow(P.novoLocalCresc, n)) })),
    viagem: [[4, 'Lenta', false], [14, 'Lenta', false], [60, 'Lenta', false], [10, 'Rápida', true], [10, 'Média', false]]
      .map(([h, v, r]) => ({ hexes: h, vel: v, rota: r, min: viagemMin(h, v, r) })),
    batalhas: casos.map(([rot, a, d, x, lim], i) => ({ rot, atk: a, def: d, extra: x, limite: lim == null ? null : lim, res: resCasos[i] })),
    extracao: [[{ lanceiro: 1 }, false, false], [{ lanceiro: 10 }, false, false], [{ lanceiro: 20 }, false, false], [{ lanceiro: 40 }, true, false],
      [{ cavalaria: 10 }, true, true], [{ lanceiro: 60 }, false, false]].map(([g, p, r]) => ({ grupo: g, posto: p, rota: r, valorH: extracaoH(g, p, r) })),
    espiao: [[0, 0], [1, 15], [4, 60], [10, 100]].map(([t, n]) => ({ torres: t, tropas: n, chance: chanceEspiao(t, n) })),
    fauna: [['baixo', 38], ['baixo', 80], ['medio', 130], ['alto', 650], ['alto', 300], ['medio', 239]].map(([nv, f]) => ({ nivel: nv, forca: f, risco: riscoFauna(nv, f) })),
    forcaFauna: [{ lanceiro: 20 }, { arqueiro: 20 }, { lanceiro: 5 }].map(g => ({ grupo: g, forca: forcaFauna(g) })),
    torres: Array.from({ length: P.torre.nivelMax }, (_, i) => i + 1).map(n => { const c = P.torre.custoN1 * Math.pow(P.torre.custoCresc, n - 1);
      return { nivel: n, alcance: P.torre.alcance(n), arqueiros: n * P.torre.arqPorNivel, custo: { pedra: r0(c * 0.7 / 10) * 10, madeira: r0(c * 0.3 / 10) * 10 }, tempo: P.torre.tempoN1 * n, estrutura: n * P.torre.estrutura }; }),
    jazidas: Object.keys(VAL).map(k => ({ recurso: k, tamanho: tamJazida(k), quantidade: nJazidas(k) })),
    metasOk: falhas === 0
  };
  process.stdout.write(JSON.stringify({ gerado: 'node balanceamento/modelo.js --json', P: Pj, U, VEICULOS, referencia: ref }, null, 1) + '\n');
} else {
  process.stdout.write(L.join('\n') + '\n');
}
if (falhas) process.exitCode = 1;
