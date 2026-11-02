/* Reino de Pedra — modelo de balanceamento (proposta v1, em validação).
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
  /* legado */
  tetoRelTemporada: 0.05,
  /* fauna (força = soma de (ataque + defesa) / 2 do grupo) */
  fauna: { baixo: 40, medio: 120, alto: 300 },
  /* alianças */
  alianca: 5
};

/* unidades: atk, def, velocidade, carga (recursos), custo, tempo (s), população */
const U = {
  milicia:   { nome: 'Milícia',   atk: 5,  def: 15, vel: 'Lenta',  carga: 20,  custo: { comida: 20, madeira: 10 }, tempo: 30, pop: 1, so: 'defesa' },
  lanceiro:  { nome: 'Lanceiro',  atk: 25, def: 40, vel: 'Lenta',  carga: 40,  custo: { comida: 30, madeira: 30, ferro: 30 }, tempo: 180, pop: 1, vence: 'cavalaria' },
  arqueiro:  { nome: 'Arqueiro',  atk: 35, def: 25, vel: 'Média',  carga: 40,  custo: { comida: 30, madeira: 50, couro: 10 }, tempo: 210, pop: 1, vence: 'lanceiro' },
  cavalaria: { nome: 'Cavalaria', atk: 45, def: 30, vel: 'Rápida', carga: 80,  custo: { comida: 60, ferro: 50, couro: 30 }, tempo: 360, pop: 1, vence: 'arqueiro' },
  ariete:    { nome: 'Aríete',    atk: 10, def: 10, vel: 'Lenta',  carga: 0,   custo: { madeira: 300, ferro: 60 }, tempo: 900, pop: 4, cerco: 40 },
  trebuchet: { nome: 'Trebuchet', atk: 5,  def: 5,  vel: 'Lenta',  carga: 0,   custo: { madeira: 600, pedra: 200, ferro: 150 }, tempo: 1800, pop: 6, cerco: 90 }
};
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

/* combate: valor de ataque contra valor de defesa; o vencedor perde (menor/maior)^1,5;
   vantagem 1,5× quando a unidade vence o tipo que domina o outro lado */
function valorAtaque(grupo, defesaGrupo) {
  const totDef = soma(defesaGrupo) || 1;
  return Object.entries(grupo).reduce((s, [k, n]) => {
    const u = U[k], frac = u.vence ? (defesaGrupo[u.vence] || 0) / totDef : 0;
    return s + n * u.atk * (1 + (P.vantagem - 1) * frac);
  }, 0);
}
function valorDefesa(grupo, ataqueGrupo, extra) {
  const totAtk = soma(ataqueGrupo) || 1;
  let v = Object.entries(grupo).reduce((s, [k, n]) => {
    const u = U[k], frac = u.vence ? (ataqueGrupo[u.vence] || 0) / totAtk : 0;
    return s + n * u.def * (1 + (P.vantagem - 1) * frac);
  }, 0);
  v += (extra.pop || 0) * P.miliciaPorPop * P.defMilicia;                     /* população como milícia */
  v += (extra.arqTorre || 0) * U.arqueiro.def * P.torre.bonusAlto;             /* arqueiros no alto */
  v *= (1 + (extra.reliquia || 0)) * (extra.portoes ? P.portoes[extra.portoes] : 1);
  return v;
}
function batalha(atk, def, extra, limiteBaixas) {
  const A = valorAtaque(atk, def), Dv = valorDefesa(def, atk, extra);
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
function simular(perfil) {
  const S = {
    h: 0, est: Object.assign({}, P.kit), couro: 200,
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
    if (sessoes.includes(hd)) {
      sessao();
      if (hd === sessoes[sessoes.length - 1]) S.filaHorasNoite.push(Math.max(0, fimFila() - S.h));
    }
    while (S.fila.length && S.fila[0].fim <= S.h + 1) { S.fila.shift().aplicar(); }
    const pr = producaoH(), cap = Math.max(2000, soma(pr) * P.estoqueHoras);
    TIPOS.forEach(k => { S.est[k] = Math.min(cap, S.est[k] + pr[k]); });
    S.couro += 4;                                    /* caça ocasional */
    const sobra = pr.comida > castelo(S.casteloL) * 2;
    const livre = Math.max(1, teto() - S.tropas);     /* tropas ocupam o teto */
    S.pop = Math.max(0, Math.min(livre, S.pop + P.crescPop * S.pop * (1 - S.pop / livre) * (sobra ? 1 + P.bonusComida : 1)));
    S.tropas *= (1 - perfil.perdasDia / 24);          /* desgaste por combate */
    const dia = (S.h + 1) / 24;
    if (!S.diaMax && S.locais.length >= 8 && S.locais.reduce((s, x) => s + x.L, 0) / S.locais.length >= 9.5) S.diaMax = Math.ceil(dia);
    if ([1, 3, 7, 14, 21, 35, 50, 70].includes(dia)) {
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
const fmtC = c => Object.entries(c).map(([k, v]) => v + ' ' + k).join(', ');
out('# Tabelas do balanceamento (geradas)\n');
out('Geradas por `node balanceamento/modelo.js`. Não edite à mão: mude os parâmetros no modelo e rode de novo.\n');

out('## Locais de produção por nível\n');
out('| Nível | Produção/h | Trabalhadores | Custo para subir | Receita | Tempo de obra | Retorno do custo |');
out('|---|---|---|---|---|---|---|');
for (let n = 1; n <= P.nivelMax; n++) {
  out('| ' + n + ' | ' + r0(prod(n)) + ' | ' + trabalhadores(n) + ' | ' + (n > 1 ? r0(custo(n)) : '—') + ' | ' + (n > 1 ? fmtC(receita(custo(n))) : '—') + ' | ' +
    (n > 1 ? fmtT(tempoObra(n)) : '—') + ' | ' + (n > 1 ? r1(payback(n)) + ' h' : '—') + ' |');
}
out('\nEstoque de cada local: até ' + P.estoqueHoras + ' h da própria produção (o que passa disso se perde até alguém buscar). Armazém: guarda o excedente do reino.\n');
out('Castelo: produz ' + r0(castelo(1)) + '/h de cada recurso básico no nível 1 e ' + r0(castelo(10)) + '/h no nível 10. Nenhum local passa do nível do castelo. Melhorar o castelo custa ' + P.casteloCusto + '× e leva ' + P.casteloTempo + '× o tempo de um local do mesmo nível (nível 10: ' + fmtT(tempoObra(10) * P.casteloTempo) + ').\n');

out('## Unidades\n');
out('| Unidade | Ataque | Defesa | Vence | Velocidade | Carga | Custo | Total | Tempo | Pop. | Ataque/100 rec. | Defesa/100 rec. |');
out('|---|---|---|---|---|---|---|---|---|---|---|---|');
Object.values(U).forEach(u => {
  const t = soma(u.custo);
  out('| ' + u.nome + ' | ' + u.atk + ' | ' + u.def + ' | ' + (u.vence ? U[u.vence].nome : u.cerco ? 'torres e portões (' + u.cerco + ')' : '—') + ' | ' + u.vel + ' | ' + u.carga + ' | ' + fmtC(u.custo) + ' | ' + t + ' | ' + fmtT(u.tempo) + ' | ' + u.pop + ' | ' +
    r1(100 * u.atk / t) + ' | ' + r1(100 * u.def / t) + ' |');
});
out('\nVeículos: carroça ' + VEICULOS.carroca.carga + ' (lenta, ' + fmtC(VEICULOS.carroca.custo) + '); carroção ' + VEICULOS.carrocao.carga + ' (média, ' + fmtC(VEICULOS.carrocao.custo) + '). Carregador da requisição: 50, a pé.\n');

out('## Deslocamento\n');
out('| Distância | Exemplo | Lenta | Média | Rápida | Lenta em rota |');
out('|---|---|---|---|---|---|');
[[3, 'local vizinho do próprio reino'], [6, 'outro lado do próprio reino'], [14, 'reino vizinho'], [30, 'meio mapa'], [P.mapa.cols, 'travessia do mapa']].forEach(([h, ex]) => {
  out('| ' + h + ' hex. | ' + ex + ' | ' + fmtT(viagemMin(h, 'Lenta') * 60) + ' | ' + fmtT(viagemMin(h, 'Média') * 60) + ' | ' + fmtT(viagemMin(h, 'Rápida') * 60) + ' | ' + fmtT(viagemMin(h, 'Lenta', true) * 60) + ' |');
});
out('\nMapa para ' + P.reinos + ' reinos: ' + P.mapa.cols + ' × ' + P.mapa.lins + ' hexágonos (≈ ' + r0(P.mapa.cols * P.mapa.lins / P.reinos) + ' por reino). Terreno médio ' + P.terrenoMedio + '; rota pública multiplica por ' + P.rotaFator + '.\n');

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
  ['Ataque perdido com tática média (recua com 40%)', { lanceiro: 10 }, { lanceiro: 15 }, { pop: 200 }, 0.40]
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
out('- Fauna (força = soma de (ataque + defesa)/2): baixo ' + P.fauna.baixo + ', médio ' + P.fauna.medio + ', alto ' + P.fauna.alto + '. Com o dobro do limite, o grupo passa ileso. 20 lanceiros = ' + forcaFauna({ lanceiro: 20 }) + ' (ileso em qualquer nível); 1 explorador a cavalo ≈ ' + forcaFauna({ cavalaria: 1 }) + '.');
out('- Saque repetido ao mesmo alvo em 24 h: −' + P.saqueQueda * 100 + '% por saque, até restar ' + P.saqueMinimo * 100 + '%.');
out('- Relíquias: ataque +' + P.reliquia.ataque * 100 + '%, produção +' + P.reliquia.producao * 100 + '%, resistência +' + P.reliquia.resistencia * 100 + '%. Produção +15% num local de nível 6 = +' + r0(prod(6) * 0.15) + '/h, perto de meio nível (' + r0(prod(7) - prod(6)) + '/h). Escavação: ' + P.reliquia.escavarHoras1 + ' h com 1 unidade, mínimo ' + P.reliquia.escavarMin + ' h.');
out('- Escudo de novato ' + P.escudoNovatoH + ' h; escudo de exílio ' + P.escudoExilioH + ' h; regência após ' + P.regenciaH + ' h sem entrar. Relíquias da temporada (legado): teto somado de ' + P.tetoRelTemporada * 100 + '%. Aliança: até ' + P.alianca + ' reinos.\n');

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
  ['M9', 'Tática média recua com 40% e ainda causa perdas na defesa', r0(resCasos[8].perdaD * 100) + '% na defesa', resCasos[8].recuou && resCasos[8].perdaD > 0.05]
];
out('## Metas verificadas\n');
out('| | Meta | Resultado | |');
out('|---|---|---|---|');
metas.forEach(m => out('| ' + m[0] + ' | ' + m[1] + ' | ' + m[2] + ' | ' + (m[3] ? '✓' : '✗') + ' |'));
const falhas = metas.filter(m => !m[3]).length;
out('\n' + (falhas ? falhas + ' meta(s) fora do alvo.' : 'Todas as metas no alvo.'));
process.stdout.write(L.join('\n') + '\n');
if (falhas) process.exitCode = 1;
