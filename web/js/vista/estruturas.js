/* Reino de Pedra — construções 3D: castelo, locais, torres e ruínas montados com peças de kits CC0 da Kenney (Castle Kit,
   Fantasy Town Kit, Survival Kit e Graveyard Kit; ver web/modelos/LICENCAS.md) e renderizados com three.js num canvas fora da
   tela, como os bonecos (bonecos.js). Cada combinação de tipo, faixa de nível, produto, cor do dono e inclinação da câmera
   vira um sprite uma vez; a Vista desenha o sprite e, enquanto ele não existe (ou sem WebGL), a arte 2D de antes.
     RP.estruturas.local(o)  o = { tipo, nivel, produz, ruina, cor, moinho }  → canvas ou null
     RP.estruturas.ruinaAntiga(esgotada), RP.estruturas.torre(nivel, cor), RP.estruturas.CX[caixa] = { W, ALT, PE }
   Caixas em unidades do mundo (o hexágono tem R = 15): o castelo cobre a pegada de 7 hexágonos; os locais, a de 3. */
import * as THREE from '../../vendor/three/three.module.min.js';
import { GLTFLoader } from '../../vendor/three/GLTFLoader.js';

const RP = window.RP = window.RP || {};
const BASE = new URL('../../modelos/', import.meta.url).href;
const KITS = ['castelo', 'vila', 'sobrevivencia', 'ruinas'];
/* unidades do mundo por unidade de cada kit: o castelo fica com muralha da altura de uma pessoa e meia; casas com um andar um
   pouco acima da cabeça; as peças pequenas do Survival Kit na mesma escala das casas */
const ESC = { castelo: 15, vila: 22, sobrevivencia: 26, ruinas: 24 };
const CX = {
  /* esc: escala do conjunto montado (os locais iniciais ficam a 4 hexágonos do castelo: sem encostar uns nos outros) */
  castelo: { W: 92, ALT: 96, PE: 30, esc: 0.85 }, local: { W: 66, ALT: 56, PE: 22, esc: 0.72 }, torre: { W: 36, ALT: 84, PE: 12, esc: 0.9 },
  ruina: { W: 60, ALT: 42, PE: 20, esc: 0.78 }
};
const RES = (window.devicePixelRatio || 1) >= 1.5 ? 3 : 2.5, SS = 2, MAX = 160, ORCAMENTO_MS = 12;

const E = RP.estruturas = { pronto: false, falhou: false, CX, tamanho: () => cache.size, limpar: () => cache.clear() };
const cache = new Map();
let renderer, cena, camera, grupo, mat;
const pecas = {};
let gasto = 0, quadroAtual = -1;

async function carregar() {
  const L = new GLTFLoader();
  const gs = await Promise.all(KITS.map(k => L.loadAsync(BASE + k + '.glb')));
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  cena = new THREE.Scene();
  cena.add(new THREE.HemisphereLight(0xfff6e6, 0x6a5a44, 1.55));
  const sol = new THREE.DirectionalLight(0xfff1d6, 2.2); sol.position.set(-300, 600, 420); cena.add(sol);
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -5000, 5000);
  grupo = new THREE.Group(); cena.add(grupo);
  gs.forEach((g, i) => {
    const kit = KITS[i];
    const raiz = g.scene.children.length === 1 && /^kit-/.test(g.scene.children[0].name) ? g.scene.children[0] : g.scene;
    raiz.children.forEach(p => {
      /* textura de paleta: sem filtro (cores chapadas); Lambert para casar com a luz dos bonecos */
      p.traverse(o => {
        if (!o.isMesh) return;
        const m0 = o.material, map = m0 && m0.map;
        if (map) { map.magFilter = THREE.NearestFilter; map.minFilter = THREE.NearestFilter; map.generateMipmaps = false; map.colorSpace = THREE.SRGBColorSpace; map.needsUpdate = true; }
        o.material = new THREE.MeshLambertMaterial({ map: map || null, color: map ? 0xffffff : (m0 && m0.color) || 0xcccccc });
      });
      pecas[kit + '/' + p.name] = p;
    });
  });
  E.pronto = true;
  document.dispatchEvent(new CustomEvent('rp:estruturas'));
}

/* ---------------------------------------------------------------- montagem */
/* põe uma peça: posição em unidades do mundo (x para a direita da tela, z para a frente), giro em graus, escala extra */
function por(nome, x, z, giro, y, s) {
  const [kit] = nome.split('/'), p = pecas[nome];
  if (!p) return null;
  const c = p.clone(true), k = ESC[kit] * (s || 1);
  c.scale.setScalar(k);
  c.position.set(x, y || 0, z);
  c.rotation.y = (giro || 0) * Math.PI / 180;
  grupo.add(c);
  return c;
}
/* bandeira na cor do dono: mastro e pano feitos aqui (as bandeiras do kit vêm azuis) */
function bandeira(x, z, y, cor, alt) {
  const h = alt || 22;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, h, 6), new THREE.MeshLambertMaterial({ color: 0x5a3b22 }));
  m.position.set(x, y + h / 2, z); grupo.add(m);
  const pano = new THREE.Mesh(new THREE.PlaneGeometry(11, 7), new THREE.MeshLambertMaterial({ color: cor || '#3a6fb0', side: THREE.DoubleSide }));
  pano.position.set(x + 5.5, y + h - 4, z); grupo.add(pano);
}
/* chão batido sob a construção (disco achatado), para assentar no terreno */
function chao(rx, rz, cor) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.4, 28), new THREE.MeshLambertMaterial({ color: cor || 0x9a8461 }));
  m.scale.set(rx, 1, rz); m.position.y = -0.2; grupo.add(m);
}
/* torre quadrada do Castle Kit: base, andares e telhado */
function torreQ(x, z, andares, teto, s) {
  const u = ESC.castelo * (s || 1);
  por('castelo/tower-square-base', x, z, 0, 0, s);
  for (let i = 0; i < andares; i++) por(i === andares - 1 ? 'castelo/tower-square-mid-windows' : 'castelo/tower-square-mid', x, z, 0, u * (1 + i), s);
  por(teto || 'castelo/tower-square-top-roof', x, z, 0, u * (1 + andares), s);
  return u * (1 + andares + 1);
}
/* casa do Fantasy Town Kit: w × d módulos, paredes de pedra ou madeira, telhado de duas águas */
function casa(x, z, w, d, madeira, giro, opc) {
  const g = new THREE.Group(), u = ESC.vila;
  const pre = madeira ? 'vila/wall-wood' : 'vila/wall';
  const pe = (nome, px, pz, rot, py) => { const p = pecas[nome]; if (!p) return; const c = p.clone(true); c.scale.setScalar(u); c.position.set(px * u, (py || 0) * u, pz * u); c.rotation.y = rot * Math.PI / 180; g.add(c); };
  for (let i = 0; i < w; i++) {
    const cx = i - (w - 1) / 2;
    pe(i === Math.floor(w / 2) ? pre + '-door' : pre + '-window-shutters', cx, d / 2, 90);   /* frente: porta e janelas */
    pe(pre, cx, -d / 2, -90);
  }
  for (let j = 0; j < d; j++) { const cz = j - (d - 1) / 2; pe(pre, -w / 2, cz, 180); pe(pre, w / 2, cz, 0); }
  for (let i = 0; i < w; i++) {
    const cx = i - (w - 1) / 2;
    pe(i === 0 || i === w - 1 ? 'vila/roof-gable-end' : 'vila/roof-gable', cx, 0, i === 0 ? 180 : 0, 1);
  }
  if (opc && opc.chamine) pe('vila/chimney', w / 2 - 0.3, -0.2, 0, 1);
  g.position.set(x, 0, z); g.rotation.y = (giro || 0) * Math.PI / 180;
  grupo.add(g);
  return g;
}

function montarCastelo(o) {
  const nv = o.nivel || 1, u = ESC.castelo, L = 1.5 * u;
  chao(58, 44, 0xa38c66);
  /* muralha: anel de 3 × 3 módulos com torres nos cantos e o portão na frente */
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) torreQ(sx * L, sz * L, nv >= 6 ? 2 : 1, nv >= 4 ? 'castelo/tower-square-top-roof-high' : 'castelo/tower-square-top-roof');
  for (const i of [-0.5, 0.5]) {
    por('castelo/wall', i * u, -L, 0); por('castelo/wall', -L, i * u, 90); por('castelo/wall', L, i * u, 90);
    por(i < 0 ? 'castelo/wall' : 'castelo/wall', i * u * 2 * 0.75 + (i < 0 ? -0.25 : 0.25) * u, L, 0);
  }
  por('castelo/gate', 0, L + 0.1 * u, 90);
  /* torre de menagem no fundo; cresce com o nível */
  const andares = Math.min(4, 1 + Math.floor(nv / 3));
  const topo = torreQ(0, -0.25 * u, andares, 'castelo/tower-square-roof', 1.25);
  bandeira(0, -0.25 * u, topo - 6, o.cor, 20);
  bandeira(-L, L, u * 2.6, o.cor, 14); bandeira(L, L, u * 2.6, o.cor, 14);
  if (nv >= 7) { por('castelo/tower-hexagon-base', -0.6 * u, 0.5 * u, 0); por('castelo/tower-hexagon-roof', -0.6 * u, 0.5 * u, 0, 1.31 * u); }
}
function montarLocal(o) {
  const nv = o.nivel || 1, tipo = o.tipo, u = ESC.vila;
  switch (tipo) {
    case 'vila': {
      chao(40, 22, 0x9a8461);
      casa(-12, -4, 2, 1, false, 0, { chamine: true });
      casa(14, 4, 1, 1, true, 0);
      if (nv >= 4) casa(26, -10, 1, 1, false, 0);
      if (nv >= 7) casa(-30, 8, 1, 1, true, 0);
      if (o.moinho) casa(-30, 10, 1, 1, false, 0);
      for (let i = -2; i <= 2; i++) por('vila/fence', i * u * 0.9, 16, 90, 0, 0.9);
      por('ruinas/hay-bale', 30, 14, 20);
      break;
    }
    case 'pasto': {
      chao(40, 22, 0x86a35a);
      casa(-18, -6, 2, 1, true, 0);
      for (let i = -1; i <= 2; i++) { por('vila/fence', i * u * 0.9 + 4, -16, 90, 0, 0.9); por('vila/fence', i * u * 0.9 + 4, 18, 90, 0, 0.9); }
      por('vila/fence', 36, 0, 0, 0, 0.9); por('vila/fence', 36, 22 - u, 0, 0, 0.9);
      por('ruinas/hay-bale-bundled', 18, 4, 30); por('ruinas/hay-bale', 26, -6, -10);
      break;
    }
    case 'serraria': {
      chao(40, 22, 0x8a7350);
      por('sobrevivencia/structure', -6, -2, 0, 0, 2.3); por('sobrevivencia/structure-roof', -6, -2, 0, 0, 2.3);
      por('sobrevivencia/workbench', -6, 4, 0, 0, 1.6);
      for (let i = 0; i < 3; i++) por('sobrevivencia/tree-log', 18, -8 + i * 7, 90, 0, 1.3);
      por('sobrevivencia/tree-log', 18, -4, 90, 7, 1.3);
      if (nv >= 4) por('sobrevivencia/resource-planks', -28, 8, 20, 0, 1.5);
      por('sobrevivencia/tree-trunk', 30, 10, 0, 0, 1.4); por('sobrevivencia/tool-axe', 30, 10, 0, 6, 1.4);
      break;
    }
    case 'mina': {
      const pedra = o.produz === 'pedra';
      chao(40, 22, 0x8d8578);
      por('vila/rock-large', -4, -10, 0, 0, 1.15); por('vila/rock-wide', 18, -12, 30, 0, 1); por('vila/rock-small', -26, -6, -20, 0, 0.9);
      /* boca da mina: dois esteios e uma viga */
      por('vila/pillar-wood', -12, 4, 0); por('vila/pillar-wood', 4, 4, 0);
      por('vila/planks', -4, 4, 0, u * 1, 0.7);
      por('vila/cart', 18, 12, 70, 0, 0.8);
      por(pedra ? 'sobrevivencia/resource-stone-large' : 'sobrevivencia/resource-stone', -24, 12, 0, 0, 2);
      if (nv >= 5) por('sobrevivencia/resource-stone-large', 26, 0, 40, 0, 1.6);
      por('sobrevivencia/tool-pickaxe', 6, 14, 30, 0, 1.6);
      break;
    }
    case 'quartel': {
      chao(42, 24, 0x9a8461);
      torreQ(-20, -6, 1, 'castelo/tower-square-top', 1);
      por('sobrevivencia/tent', 4, -4, 0, 0, 2.2); por('sobrevivencia/tent-canvas', 24, 4, -20, 0, 2);
      for (let i = -1; i <= 1; i++) por('sobrevivencia/fence-fortified', i * 13 + 6, 16, 0, 0, 1);
      if (nv >= 5) por('castelo/siege-catapult', 28, -12, -30, 0, 0.5);
      bandeira(-20, -6, ESC.castelo * 2.3, o.cor, 14);
      break;
    }
    case 'armazem': {
      chao(40, 22, 0x9a8461);
      casa(-6, -4, 2, 1, true, 0);
      por('sobrevivencia/barrel', 22, 6, 0, 0, 1.4); por('sobrevivencia/barrel', 26, 0, 0, 0, 1.4);
      por('sobrevivencia/box-large', 16, 12, 20, 0, 1.4); por('sobrevivencia/chest', -26, 10, 10, 0, 1.4);
      if (nv >= 4) por('vila/cart-high', -30, -6, 60, 0, 0.8);
      break;
    }
    case 'ferraria': {
      chao(40, 22, 0x8d8578);
      casa(-8, -4, 1, 1, false, 0, { chamine: true });
      por('vila/overhang', 10, -4, 0);
      por('sobrevivencia/workbench-anvil', 12, 8, -20, 0, 1.6); por('sobrevivencia/workbench-grind', 24, 0, 0, 0, 1.4);
      por('sobrevivencia/barrel-open', -26, 10, 0, 0, 1.4); por('sobrevivencia/bucket', 22, 12, 0, 0, 1.4);
      break;
    }
    case 'posto': {
      chao(26, 16, 0x8a7350);
      por('sobrevivencia/tent-canvas', -4, -4, 10, 0, 2.4); por('sobrevivencia/campfire-pit', 12, 8, 0, 0, 1.8);
      por('sobrevivencia/resource-stone', -14, 8, 0, 0, 1.6); por('sobrevivencia/tool-shovel', 14, -6, 0, 0, 1.6);
      bandeira(-4, -12, 0, o.cor, 16);
      break;
    }
    default: return false;
  }
  return true;
}
function montarRuina(o) {
  chao(34, 20, 0x7e7462);
  if (o.tipo === 'castelo') {
    por('castelo/tower-square-base', -26, -12, 0, 0, 1); por('castelo/tower-square-base', 24, -10, 0, 0, 0.8);
    por('castelo/rocks-large', -4, -6, 0, 0, 0.9);
  }
  por('ruinas/stone-wall-damaged', -10, -10, 0); por('ruinas/stone-wall-damaged', 14, -2, 70);
  por('ruinas/brick-wall-end', -20, 6, 90); por('ruinas/pillar-small', 6, 10, 0);
  por('ruinas/debris', 0, 4, 0, 0, 1.2); por('ruinas/gravestone-debris', 20, 12, 30); por('ruinas/rocks', -28, 12, 0, 0, 0.6);
}
function montarRuinaAntiga(o) {
  chao(30, 18, 0x7e7462);
  por('ruinas/column-large', -18, -10, 0); por('ruinas/column-large', 18, -10, 0, 0, 1);
  por('ruinas/pillar-large', -12, 8, 0, 0, 0.7);
  por('ruinas/stone-wall-column', 0, -14, 0);
  por('ruinas/altar-stone', 0, 2, 0, 0, 0.8);
  por('ruinas/debris', 14, 10, 40); por('ruinas/rocks-tall', 26, 6, 0, 0, 0.5);
  if (!o.esgotada) {
    const g = new THREE.Mesh(new THREE.OctahedronGeometry(3.5), new THREE.MeshLambertMaterial({ color: 0xc98cf0, emissive: 0x6a3a90 }));
    g.position.set(0, 18, 2); grupo.add(g);
  }
}
function montarTorre(o) {
  const nv = Math.max(1, o.nivel || 1);
  chao(12, 8, 0x8d8578);
  const topo = torreQ(0, 0, nv, 'castelo/tower-square-top', 1.1);
  bandeira(0, -4, topo - 4, o.cor, 12);
}

/* ---------------------------------------------------------------- render */
/* vista 3/4: o conjunto gira em torno do eixo vertical (de frente, as casas ficam chapadas) */
const GIRO = -32 * Math.PI / 180;
function render(cx, montar, o) {
  while (grupo.children.length) grupo.remove(grupo.children[0]);
  montar(o);
  grupo.rotation.y = o && o.semGiro ? 0 : GIRO;
  grupo.scale.setScalar(cx.esc || 1);
  const k = (RP.arte && RP.arte.K) || 0.62, el = Math.asin(Math.min(0.95, k)), ce = Math.cos(el);
  camera.left = -cx.W / 2; camera.right = cx.W / 2; camera.top = cx.ALT * ce; camera.bottom = -cx.PE * ce; camera.updateProjectionMatrix();
  camera.position.set(0, Math.sin(el) * 2000, Math.cos(el) * 2000); camera.lookAt(0, 0, 0);
  renderer.setSize(Math.round(cx.W * RES * SS), Math.round((cx.ALT + cx.PE) * RES * SS), false);
  renderer.render(cena, camera);
  const w = Math.round(cx.W * RES), h = Math.round((cx.ALT + cx.PE) * RES), out = document.createElement('canvas');
  out.width = w; out.height = h;
  const c = out.getContext('2d');
  /* contorno escuro de 1 px, como os bonecos: a construção se separa do chão */
  const t = document.createElement('canvas'); t.width = w; t.height = h; const tc = t.getContext('2d');
  tc.drawImage(renderer.domElement, 0, 0, w, h); tc.globalCompositeOperation = 'source-in'; tc.fillStyle = 'rgba(28,20,14,0.5)'; tc.fillRect(0, 0, w, h);
  [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(d => c.drawImage(t, d[0], d[1]));
  c.drawImage(renderer.domElement, 0, 0, w, h);
  return out;
}
function obter(chave, cx, montar, o) {
  if (!E.pronto) return null;
  const k = chave + '|' + ((RP.arte && RP.arte.K) || 0).toFixed(2);
  const s = cache.get(k);
  if (s) return s;
  const agora = performance.now(), q = Math.floor(agora / 16);
  if (q !== quadroAtual) { quadroAtual = q; gasto = 0; }
  if (gasto > ORCAMENTO_MS) return null;
  let novo;
  try { novo = render(cx, montar, o); } catch (e) { console.error(e); E.pronto = false; E.falhou = true; return null; }
  gasto += performance.now() - agora;
  if (cache.size >= MAX) cache.delete(cache.keys().next().value);
  cache.set(k, novo);
  return novo;
}
/* faixas de nível: o desenho só muda em alguns níveis (não vale um sprite por nível) */
function faixa(n) { n = n || 1; return n >= 7 ? 7 : n >= 6 ? 6 : n >= 4 ? 4 : n >= 3 ? 3 : 1; }
E.local = function (o) {
  if (o.ruina) return obter(['ruina', o.tipo === 'castelo' ? 'c' : 'l'].join('|'), CX.ruina, montarRuina, o);
  if (o.tipo === 'castelo') return obter(['castelo', faixa(o.nivel), o.cor].join('|'), CX.castelo, montarCastelo, o);
  if (!/^(vila|pasto|serraria|mina|quartel|armazem|ferraria|posto)$/.test(o.tipo)) return null;
  return obter([o.tipo, faixa(o.nivel), o.produz || '', o.cor || '', o.moinho ? 1 : 0].join('|'), CX.local, montarLocal, o);
};
E.caixaLocal = function (o) { return o.ruina ? CX.ruina : o.tipo === 'castelo' ? CX.castelo : CX.local; };
E.ruinaAntiga = function (esgotada) { return obter('antiga|' + (esgotada ? 1 : 0), CX.ruina, montarRuinaAntiga, { esgotada: esgotada }); };
E.torre = function (nivel, cor) { return obter(['torre', Math.min(3, nivel || 1), cor || ''].join('|'), CX.torre, montarTorre, { nivel: nivel, cor: cor }); };
/* altura (unidades do mundo, na tela) do passadiço da torre de nível n, onde ficam os arqueiros */
E.alturaTorre = function (n) { const k = (RP.arte && RP.arte.K) || 0.62, ce = Math.cos(Math.asin(Math.min(0.95, k))); return ESC.castelo * 1.1 * CX.torre.esc * (Math.max(1, Math.min(3, n || 1)) + 1) * ce; };
E.carregar = carregar;
if (RP.arte && RP.arte.aoMudarK) RP.arte.aoMudarK.push(() => cache.clear());

carregar().catch(e => { console.warn('construções 3D indisponíveis; a Vista usa a arte 2D.', e); E.falhou = true; });
