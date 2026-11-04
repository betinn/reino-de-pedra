/* Reino de Pedra — vegetação e relevo 3D: árvores, arbustos, flores, cogumelos, juncos, vitórias-régias, rochas, pedras e
   picos de montanha do Nature Kit da Kenney (CC0; ver web/modelos/LICENCAS.md), recoloridos com as cores do terreno do jogo
   e renderizados com three.js como sprites, uma vez por variante. A Vista desenha a vegetação no cache estático do chão:
   quando os sprites ficam prontos (evento rp:natureza), as cenas refazem o cache; até lá, a arte 2D de antes.
     RP.natureza.desenhar(c, tipo, h, s, antigo) → true se desenhou; tipo: 'con' (conífera), 'fol' (folhosa), 'arb' (arbusto,
     flor, cogumelo), 'mon' (rocha grande de colina), 'roc' (pedra pequena), 'pic' (pico de montanha), 'jun' (pântano);
     h: número em [0, 1) que escolhe a variante; s: escala (tamanhos diferentes). */
import * as THREE from '../../vendor/three/three.module.min.js';
import { GLTFLoader } from '../../vendor/three/GLTFLoader.js';

const RP = window.RP = window.RP || {};
const BASE = new URL('../../modelos/', import.meta.url).href;
const RES = (window.devicePixelRatio || 1) >= 1.5 ? 3 : 2.5;

/* variantes por tipo: [peça, unidades do mundo por unidade do kit, giro em graus] */
const pinheiros = ['tree_pineTallA', 'tree_pineTallB', 'tree_pineTallC', 'tree_pineTallD', 'tree_pineRoundA', 'tree_pineRoundB', 'tree_pineRoundC',
  'tree_pineRoundD', 'tree_pineRoundE', 'tree_pineRoundF', 'tree_pineDefaultA', 'tree_pineDefaultB', 'tree_pineSmallA', 'tree_pineSmallB',
  'tree_pineSmallC', 'tree_pineSmallD', 'tree_cone', 'tree_cone_dark'];
const folhosas = ['tree_oak', 'tree_oak_dark', 'tree_default', 'tree_default_dark', 'tree_detailed', 'tree_detailed_dark', 'tree_fat', 'tree_tall',
  'tree_tall_dark', 'tree_simple', 'tree_small', 'tree_plateau', 'tree_plateau_dark', 'tree_thin'];
const outono = ['tree_oak_fall', 'tree_detailed_fall', 'tree_fat_fall', 'tree_thin_fall'];
const TIPOS = {
  con: pinheiros.map(n => [n, 27, 0]),
  fol: folhosas.map(n => [n, 30, 0]),
  outono: outono.map(n => [n, 30, 0]),
  arb: ['plant_bush', 'plant_bushDetailed', 'plant_bushLarge', 'plant_bushSmall', 'plant_bushTriangle', 'grass_large', 'flower_redA', 'flower_yellowA',
    'flower_purpleA', 'mushroom_redGroup', 'mushroom_tanGroup', 'stump_old', 'stump_round', 'log'].map(n => [n, 30, 0]),
  mon: ['rock_largeA', 'rock_largeB', 'rock_largeC', 'rock_largeD', 'rock_largeE', 'rock_largeF', 'stone_largeA', 'stone_largeC', 'stone_largeE']
    .flatMap(n => [[n, 27, 0], [n, 27, 140]]),
  roc: ['rock_smallA', 'rock_smallC', 'rock_smallE', 'rock_smallFlatA', 'stone_smallB', 'stone_smallD', 'stone_smallFlatB'].map(n => [n, 30, 30]),
  /* picos de montanha: só as pedras altas cinzentas, grandes, em giros diferentes (as rock_tall têm terra marrom) */
  pic: ['stone_tallA', 'stone_tallB', 'stone_tallC', 'stone_tallD', 'stone_tallE', 'stone_tallF', 'stone_tallG', 'stone_tallH', 'stone_tallI', 'stone_tallJ',
    'cliff_large_stone'].flatMap((n, i) => [[n, 66, (i * 67) % 360], [n, 66, (i * 67 + 150) % 360]]),
  /* rochas altas de terra: morros menores na montanha */
  mor: ['rock_tallA', 'rock_tallC', 'rock_tallE', 'rock_tallG', 'rock_tallI'].map(n => [n, 40, 20]),
  jun: ['grass_leafs', 'grass_leafsLarge', 'plant_flatTall', 'plant_flatShort', 'lily_large', 'lily_small', 'mushroom_tanGroup'].map(n => [n, 30, 0]),
  /* rios: vitórias-régias na água, pedras no leito, juncos e pedras na margem, canoa em quatro direções */
  agua: ['lily_large', 'lily_small', 'lily_large'].map((n, i) => [n, 52, i * 120]),
  pedraRio: ['stone_smallFlatB', 'rock_smallFlatA', 'stone_smallD'].map((n, i) => [n, 38, i * 70]),
  margem: ['grass_leafs', 'grass_leafsLarge', 'plant_flatTall', 'plant_flatShort', 'rock_smallA', 'stone_smallB'].map((n, i) => [n, 30, i * 50]),
  canoa: [0, 45, 90, 135].map(g => ['canoe', 22, g]),
  /* pontes em arco: a peça gira para o eixo da estrada (0°, 60° e 120° no chão, as direções dos vizinhos do hexágono) */
  ponte: [0, 60, 120].map(g => ['bridge_stoneRound', 27, g])
};
/* cores do kit (verde-azulado) trocadas pelas da paleta do terreno; as folhas variam de tom por variante */
const COR = {
  leafsGreen: ['#4f8a38', '#5b9440', '#46803a'], leafsDark: ['#2f6331', '#336b2e', '#2a5a30'], leafsFall: ['#c7782f', '#b9632b', '#d39a35'],
  grass: ['#65943b', '#6f9d42', '#5d8a36'], woodBark: ['#7a5534'], woodBarkDark: ['#5a3d26'], woodBirch: ['#d8d0c0'], woodInner: ['#c9a676'],
  dirt: ['#7d6346'], stone: ['#9b968d', '#a7a196', '#8e8a83'], _defaultMat: ['#9b968d'], colorTan: ['#c9a676'], corn: ['#d8b84a'],
  stoneDark: ['#77736b'], wood: ['#8a5f3a'], dirtDark: ['#5e4a34'], water: ['#3f78a8']
};

const N = RP.natureza = { pronto: false, falhou: false, tamanho: () => sprites.size };
const sprites = new Map();
let renderer, cena, camera, pecas = {};

async function carregar() {
  const g = await new GLTFLoader().loadAsync(BASE + 'natureza.glb');
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor(0x000000, 0);
  cena = new THREE.Scene();
  cena.add(new THREE.HemisphereLight(0xfff6e6, 0x5a5040, 1.5));
  const sol = new THREE.DirectionalLight(0xfff1d6, 2.3); sol.position.set(-300, 600, 420); cena.add(sol);
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -5000, 5000);
  const raiz = g.scene.children.length === 1 && /^kit-/.test(g.scene.children[0].name) ? g.scene.children[0] : g.scene;
  raiz.children.forEach(p => { pecas[p.name] = p; });
  await gerarTodos();
  N.pronto = true;
  document.dispatchEvent(new CustomEvent('rp:natureza'));
}

/* recolore uma cópia da peça (variante de tom v) */
function copia(nome, v) {
  const c = pecas[nome].clone(true);
  c.traverse(o => {
    if (!o.isMesh) return;
    const lista = Array.isArray(o.material) ? o.material : [o.material];
    const novos = lista.map(m => { const t = COR[m.name] || [null]; return new THREE.MeshLambertMaterial({ color: t[v % t.length] || m.color }); });
    o.material = Array.isArray(o.material) ? novos : novos[0];
  });
  return c;
}

function render(nome, esc, giro, v) {
  const obj = copia(nome, v);
  obj.scale.setScalar(esc); obj.rotation.y = giro * Math.PI / 180;
  cena.add(obj); obj.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(obj), tam = bb.getSize(new THREE.Vector3());
  const k = (RP.arte && RP.arte.K) || 0.62, el = Math.asin(Math.min(0.95, k)), ce = Math.cos(el), se = Math.sin(el);
  /* caixa na tela, em unidades do mundo: largura do objeto e altura projetada (pé no chão em y = 0) */
  const meia = Math.max(Math.abs(bb.min.x), Math.abs(bb.max.x)) + 2, prof = Math.max(Math.abs(bb.min.z), Math.abs(bb.max.z));
  const alt = bb.max.y * ce + prof * se + 2, pe = prof * se + 3;
  camera.left = -meia; camera.right = meia; camera.top = alt; camera.bottom = -pe; camera.updateProjectionMatrix();
  camera.position.set(0, se * 2000, ce * 2000); camera.lookAt(0, 0, 0);
  const w = Math.max(8, Math.round(meia * 2 * RES)), h = Math.max(8, Math.round((alt + pe) * RES));
  renderer.setSize(w * 2, h * 2, false);
  renderer.render(cena, camera);
  cena.remove(obj);
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const c = out.getContext('2d');
  /* sombra no chão, para assentar no terreno */
  c.fillStyle = 'rgba(10,14,8,0.22)'; c.beginPath(); c.ellipse(w / 2 + tam.x * 0.08 * RES, alt * RES, Math.max(2, Math.min(tam.x, tam.z) * 0.45 * RES), Math.max(1, Math.min(tam.x, tam.z) * 0.45 * RES * se * 0.9), 0, 0, 7); c.fill();
  c.drawImage(renderer.domElement, 0, 0, w, h);
  return { img: out, W: meia * 2, ALT: alt, PE: pe };
}
/* todas as variantes, em pedaços (sem travar a tela) */
async function gerarTodos() {
  const fila = [];
  Object.entries(TIPOS).forEach(([tipo, lista]) => lista.forEach(([nome, esc, giro], i) => {
    if (!pecas[nome]) return;
    const tons = tipo === 'con' || tipo === 'fol' ? 2 : 1;
    for (let v = 0; v < tons; v++) fila.push([tipo + '|' + i + '|' + v, nome, esc, giro, v]);
  }));
  for (let i = 0; i < fila.length; i++) {
    const [k, nome, esc, giro, v] = fila[i];
    sprites.set(k, render(nome, esc, giro, v));
    if (i % 6 === 5) await new Promise(r => setTimeout(r, 0));
  }
}
function escolher(tipo, h) {
  const lista = TIPOS[tipo]; if (!lista) return null;
  let t = tipo;
  if (tipo === 'fol' && h > 0.96) t = 'outono';   /* algumas árvores já amarelando */
  const L = TIPOS[t], i = Math.floor((h * 7919) % 1 * L.length), tons = t === 'con' || t === 'fol' ? 2 : 1, v = Math.floor(h * 31) % tons;
  return sprites.get(t + '|' + i + '|' + v);
}
N.desenhar = function (c, tipo, h, s, antigo) {
  if (!N.pronto) return false;
  const sp = escolher(tipo, h); if (!sp) return false;
  const k = s || 1;
  if (antigo) c.globalAlpha = 0.78;
  c.drawImage(sp.img, -sp.W / 2 * k, -sp.ALT * k, sp.W * k, (sp.ALT + sp.PE) * k);
  if (antigo) c.globalAlpha = 1;
  return true;
};
/* ponte na direção da estrada: ang em radianos no chão (o mesmo da arte 2D); a peça é simétrica, então vale ang mod 180° */
N.ponte = function (c, ang, antigo) {
  if (!N.pronto) return false;
  const g = ((ang * 180 / Math.PI) % 180 + 180) % 180, i = Math.round(g / 60) % 3, sp = sprites.get('ponte|' + i + '|0');
  if (!sp) return false;
  if (antigo) c.globalAlpha = 0.78;
  c.drawImage(sp.img, -sp.W / 2, -sp.ALT, sp.W, sp.ALT + sp.PE);
  if (antigo) c.globalAlpha = 1;
  return true;
};
/* inclinar a câmera muda a vista de cima: refaz as variantes e avisa as cenas */
if (RP.arte && RP.arte.aoMudarK) RP.arte.aoMudarK.push(() => {
  if (!N.pronto) return;
  clearTimeout(N._k);
  N._k = setTimeout(() => { gerarTodos().then(() => document.dispatchEvent(new CustomEvent('rp:natureza'))); }, 250);
});

carregar().catch(e => { console.warn('vegetação 3D indisponível; a Vista usa a arte 2D.', e); N.falhou = true; });
