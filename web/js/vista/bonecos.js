/* Reino de Pedra — bonecos 3D: pessoas e cavalos de verdade (modelos CC0, ver web/modelos/LICENCAS.md) renderizados com
   three.js num canvas fora da tela e guardados como sprites. A Vista continua em Canvas 2D: cada combinação de roupa, pose,
   direção e quadro de animação é renderizada uma vez, sob demanda, e reaproveitada com drawImage. Enquanto um sprite não
   está pronto (ou se o WebGL não existir), quem chama desenha a figura 2D de antes.
     - Pessoa: o modelo "characterMedium" da Kenney (Animated Characters), com a cabeça reduzida para proporções de gente
       de verdade. A roupa é pintada num canvas por cima do mapa UV do modelo (túnica, calça, botas, cabelo, rosto, barba),
       com a cor do dono nos soldados. Armas, ferramentas, capacete, capuz e carga são peças simples posicionadas pelos ossos.
     - Animação: idle e corrida vêm do modelo; andar mistura as duas; trabalhar (machado, picareta, martelo, enxada, pá),
       cavar, estocar, atirar com arco, carregar, montar e sentar são poses feitas girando os ossos por código.
     - Cavalo: o cavalo animado de Quaternius (andar, galope, parado, pastando), com pelagens variadas e o cavaleiro montado.
   RP.bonecos.pessoa(o, t) e RP.bonecos.montado(o, t) devolvem um canvas (ou null se ainda não há); RP.sprites usa. */
import * as THREE from '../../vendor/three/three.module.min.js';
import { GLTFLoader } from '../../vendor/three/GLTFLoader.js';

const RP = window.RP = window.RP || {};
const BASE = new URL('../../modelos/', import.meta.url).href;

/* caixas dos sprites em unidades do mundo (as mesmas de RP.sprites para a pessoa: largura, altura acima do pé, folga abaixo) */
const CX = { pessoa: { W: 40, ALT: 44, PE: 14 }, montado: { W: 60, ALT: 50, PE: 22 } };
/* pixels por unidade do mundo: 4 em tela densa (celular, retina), 3 nas outras; teto do cache ≈ 30 MB */
const RES = (window.devicePixelRatio || 1) >= 1.5 ? 4 : 3, SS = 2, MAX = RES >= 4 ? 640 : 960, ORCAMENTO_MS = 7, FRAMES = 12;
const ALTURA_MODELO = 376, ALTURA_PESSOA = 22.5, UNID = ALTURA_PESSOA / ALTURA_MODELO;   /* unidades do mundo por unidade do modelo */
const CABECA = 0.74;   /* a cabeça do modelo é de desenho animado; menor, o corpo fica com proporção de gente */
/* duração do ciclo de cada pose (s) */
const CICLO = { parado: 2.4, andando: 0.95, correndo: 0.62, golpe: 1.15, cavar: 1.9, peneirar: 1.5, estocada: 0.9, atirar: 1.7, carregar: 1.0, sentado: 3, montado: 1, ferido: 3,
  olhar: 3.2, apontar: 2.6, conversar: 2.2, 'andando-olhar': 0.95, aparar: 0.9, cair: 0.75, caido: 1 };
/* quadros por ciclo de cada pose: 12 no que se mexe (eram 8 em tudo); menos no que quase não se mexe, para o cache render mais */
const QUADROS = { parado: 6, sentado: 4, ferido: 4, caido: 1, conversar: 10, apontar: 6, olhar: 10 };
/* quantas aparências diferentes (pele, cabelo, barba, calça) saem da semente: poucas, para as mesmas figuras serem
   reaproveitadas por muita gente. A fase e o ritmo de cada pessoa continuam próprios. */
const VARIANTES = 8;

const B = RP.bonecos = { pronto: false, falhou: false, FRAMES, QUADROS, CICLO, CX, tamanho: () => cache.size, limpar: () => { cache.clear(); prontos.clear(); } };
const cache = new Map();
/* quadros prontos de cada figura (chave sem o quadro): enquanto o quadro pedido não existe, vale o pronto mais perto */
const prontos = new Map();
let renderer, cena, camera, luzDir, pessoa, ossos = {}, mixer, acoes = {}, raiz, malha, cavalo, mixerCavalo, acoesCavalo = {}, ossosCavalo = {};
let pecas = {}, texturas = new Map(), gastoQuadro = 0, quadroAtual = -1;

/* ---------------------------------------------------------------- cores */
const PELE = ['#f1c9a5', '#dba77f', '#b97b52', '#8a5636'];
const CABELO = ['#2b1d14', '#5a3a22', '#8a6a3a', '#a8432a', '#1c1a18', '#c9b48a'];
const PELAGEM = [
  { corpo: '#7a4e2d', escuro: '#4a2d1a', claro: '#9a6a42', crina: '#2a1a10' },
  { corpo: '#3b2a1e', escuro: '#22170f', claro: '#59402d', crina: '#140d08' },
  { corpo: '#9d968c', escuro: '#6d675f', claro: '#c4beb4', crina: '#4b4640' },
  { corpo: '#b0773f', escuro: '#7e5229', claro: '#d19a5c', crina: '#f0e2c0' },
  { corpo: '#2a2624', escuro: '#151312', claro: '#45403c', crina: '#0e0c0b' }
];
function hash(n) { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); return (n ^ (n >>> 16)) >>> 0; }
function escurecer(cor, f) { const c = new THREE.Color(cor); c.multiplyScalar(f); return '#' + c.getHexString(); }

/* ---------------------------------------------------------------- roupa (textura no UV do modelo, 1024 de referência) */
function pintarRoupa(r) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const c = cv.getContext('2d'); c.scale(0.5, 0.5);
  const tun = r.tunica, tunE = escurecer(tun, 0.72), tunC = escurecer(tun, 1.12), calca = r.calca, pele = r.pele, cab = r.cabelo, bota = r.bota;
  /* tudo pele (mãos, pescoço) */
  c.fillStyle = pele; c.fillRect(0, 0, 1024, 1024);
  /* cabeça: rosto no centro (x 320, y 230), cabelo no alto e dos lados; atrás (bordas) cabelo */
  c.fillStyle = cab;
  c.fillRect(0, 0, 643, 150);
  if (r.feminina) { c.fillRect(0, 0, 210, 470); c.fillRect(433, 0, 210, 470); c.beginPath(); c.ellipse(321, 140, 150, 70, 0, 0, Math.PI * 2); c.fill(); }
  else { c.fillRect(0, 0, 170, 330); c.fillRect(473, 0, 170, 330); c.beginPath(); c.ellipse(321, 130, 170, 55, 0, 0, Math.PI * 2); c.fill(); }
  if (r.capuz) { c.fillStyle = r.capuz; c.fillRect(0, 0, 643, 120); c.fillRect(0, 0, 200, 490); c.fillRect(443, 0, 200, 490); }
  /* rosto */
  c.fillStyle = escurecer(pele, 0.55);
  c.beginPath(); c.ellipse(291, 223, 11, 13, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(351, 223, 11, 13, 0, 0, 7); c.fill();
  c.fillStyle = escurecer(cab, 1.1); c.fillRect(270, 196, 40, 9); c.fillRect(332, 196, 40, 9);
  c.fillStyle = escurecer(pele, 0.8); c.fillRect(312, 244, 18, 8); c.fillRect(304, 270, 34, 5);
  if (r.barba) { c.fillStyle = cab; c.beginPath(); c.moveTo(240, 250); c.quadraticCurveTo(321, 360, 402, 250); c.lineTo(402, 300); c.quadraticCurveTo(321, 420, 240, 300); c.fill(); c.fillStyle = escurecer(pele, 0.8); c.fillRect(304, 272, 34, 5); }
  /* tronco: costas em cima (490–768), frente embaixo (768–1024); cintura nas pontas */
  const g = c.createLinearGradient(0, 490, 0, 1024); g.addColorStop(0, tunE); g.addColorStop(0.5, tun); g.addColorStop(0.52, tunC); g.addColorStop(1, tun);
  c.fillStyle = g; c.fillRect(150, 490, 340, 534);
  if (r.armadura >= 2) {
    c.fillStyle = r.metal; c.fillRect(170, 790, 300, 200); c.fillRect(170, 520, 300, 220);
    c.fillStyle = escurecer(r.metal, 0.7); for (let i = 0; i < 5; i++) c.fillRect(170, 830 + i * 34, 300, 5);
    if (r.armadura >= 3) { c.fillStyle = '#d4a93c'; c.fillRect(170, 790, 300, 12); c.fillRect(312, 790, 16, 200); }
  }
  /* gola e cinto */
  c.fillStyle = tunE; c.fillRect(270, 766, 100, 16);
  c.fillStyle = r.cinto; c.fillRect(150, 990, 340, 34); c.fillRect(150, 490, 340, 30);
  c.fillStyle = '#c9a645'; c.fillRect(305, 992, 30, 28);
  /* braços: mangas compridas (ponta da manga mais escura) */
  c.fillStyle = tun; c.fillRect(0, 640, 165, 200); c.fillRect(470, 640, 160, 200);
  c.fillStyle = tunE; c.fillRect(0, 640, 30, 200); c.fillRect(600, 640, 30, 200);
  if (r.armadura >= 2) { c.fillStyle = r.metal; c.fillRect(120, 640, 45, 200); c.fillRect(470, 640, 45, 200); }
  /* pernas: calça; botas embaixo (sapatos em 643–824 × 135–525) */
  c.fillStyle = calca; c.fillRect(624, 765, 400, 259);
  c.fillStyle = escurecer(calca, 0.8); for (let i = 0; i < 4; i++) c.fillRect(624 + i * 100 + 48, 765, 4, 259);
  if (r.tunicaLonga) { c.fillStyle = tun; c.fillRect(624, 765, 400, 90); c.fillStyle = tunE; c.fillRect(624, 850, 400, 6); }
  c.fillStyle = bota; c.fillRect(643, 135, 181, 390);
  c.fillStyle = escurecer(bota, 0.75); c.fillRect(643, 135, 181, 40);
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.flipY = true; tx.anisotropy = 2;
  return tx;
}
function textura(r) {
  const k = [r.tunica, r.calca, r.pele, r.cabelo, r.bota, r.cinto, r.feminina ? 1 : 0, r.barba ? 1 : 0, r.capuz || '', r.armadura || 0, r.metal || '', r.tunicaLonga ? 1 : 0].join('|');
  let t = texturas.get(k);
  if (!t) { if (texturas.size > 60) { texturas.forEach(x => x.dispose()); texturas.clear(); } t = pintarRoupa(r); texturas.set(k, t); }
  return t;
}

/* ---------------------------------------------------------------- peças (armas, ferramentas, cabeça, carga) */
function mat(cor, rug) { return new THREE.MeshLambertMaterial({ color: cor }); }
function cil(r1, r2, h, cor, seg) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg || 8), mat(cor)); return m; }
function caixa(w, h, d, cor) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(cor)); }
/* cada peça é um grupo cujo eixo +Y é o cabo (a mão segura em y = 0) e +Z aponta o "fio" (lâmina, ponta) */
function montarPecas() {
  const madeira = 0x7a5534, metal = 0xb9c0c7, metalE = 0x6f777f;
  const P = {};
  let g = new THREE.Group(); let m = cil(4.5, 4.5, 470, madeira); m.position.y = 110; g.add(m);
  m = new THREE.Mesh(new THREE.ConeGeometry(11, 46, 6), mat(metal)); m.position.y = 368; g.add(m); P.lanca = g;
  g = new THREE.Group(); m = cil(5, 5, 170, madeira); m.position.y = 45; g.add(m);
  m = caixa(10, 40, 50, metal); m.position.set(0, 112, 22); g.add(m); m = caixa(6, 46, 8, metalE); m.position.set(0, 112, 48); g.add(m); P.machado = g;
  g = new THREE.Group(); m = cil(5, 5, 170, madeira); m.position.y = 45; g.add(m);
  m = new THREE.Mesh(new THREE.ConeGeometry(7, 60, 5), mat(metalE)); m.rotation.x = Math.PI / 2; m.position.set(0, 122, 30); g.add(m);
  m = new THREE.Mesh(new THREE.ConeGeometry(7, 50, 5), mat(metalE)); m.rotation.x = -Math.PI / 2; m.position.set(0, 122, -25); g.add(m); P.picareta = g;
  g = new THREE.Group(); m = cil(5, 5, 150, madeira); m.position.y = 40; g.add(m); m = caixa(22, 26, 40, metalE); m.position.set(0, 108, 6); g.add(m); P.martelo = g;
  g = new THREE.Group(); m = cil(4.5, 4.5, 260, madeira); m.position.y = 70; g.add(m); m = caixa(36, 6, 30, metalE); m.position.set(0, 196, 14); g.add(m); P.enxada = g;
  g = new THREE.Group(); m = cil(4.5, 4.5, 240, madeira); m.position.y = 60; g.add(m); m = caixa(36, 46, 5, metalE); m.position.set(0, 196, 0); g.add(m); P.pa = g;
  /* arco: arco no plano XY (barriga para +Z), corda reta */
  g = new THREE.Group(); m = new THREE.Mesh(new THREE.TorusGeometry(120, 4.5, 5, 18, Math.PI * 0.75), mat(0x5a3b22)); m.rotation.z = -Math.PI * 0.375; m.rotation.y = -Math.PI / 2; m.position.z = -95; g.add(m);
  m = cil(1.2, 1.2, 222, 0xe8dfcc, 4); m.position.z = -95 + 120 * Math.cos(Math.PI * 0.375); g.add(m); P.arco = g;
  /* escudo redondo: disco com eixo +Z */
  g = new THREE.Group(); m = cil(62, 62, 9, 0xffffff, 14); m.rotation.x = Math.PI / 2; m.name = 'pintura'; g.add(m);
  m = new THREE.Mesh(new THREE.SphereGeometry(13, 8, 6), mat(metal)); m.position.z = 6; g.add(m);
  m = new THREE.Mesh(new THREE.TorusGeometry(62, 4, 4, 18), mat(metalE)); g.add(m); P.escudo = g;
  /* cabeça (centro do crânio em 0) */
  g = new THREE.Group(); m = new THREE.Mesh(new THREE.SphereGeometry(50, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.47), mat(metal)); m.name = 'metal'; g.add(m);
  m = caixa(7, 34, 7, metalE); m.position.set(0, -14, 50); g.add(m); P.capacete = g;
  g = new THREE.Group(); m = new THREE.Mesh(new THREE.SphereGeometry(53, 14, 8, Math.PI * 0.8, Math.PI * 1.4, 0, Math.PI * 0.72), mat(0x3a4a2c)); m.name = 'pano'; g.add(m);
  m = new THREE.Mesh(new THREE.ConeGeometry(30, 60, 8), mat(0x3a4a2c)); m.position.set(0, 4, -50); m.rotation.x = -1.9; m.name = 'pano'; g.add(m); P.capuz = g;
  g = new THREE.Group(); m = cil(78, 78, 5, 0xd8c27a, 16); m.position.y = 12; g.add(m); m = new THREE.Mesh(new THREE.ConeGeometry(40, 40, 12), mat(0xcbb46a)); m.position.y = 32; g.add(m); P.palha = g;
  /* carga no ombro */
  g = new THREE.Group(); m = new THREE.Mesh(new THREE.SphereGeometry(48, 10, 8), mat(0xcdb98f)); m.scale.set(1, 0.8, 1.1); g.add(m); P.saco = g;
  g = new THREE.Group(); m = cil(22, 22, 230, 0x9a6a42, 9); m.rotation.z = Math.PI / 2; g.add(m); P.tronco = g;
  /* peneira: aro de madeira com a tela clara no fundo (eixo +Y para cima) */
  g = new THREE.Group(); m = cil(62, 62, 16, madeira, 14); g.add(m); m = cil(55, 55, 4, 0xd9cfae, 14); m.position.y = 8; g.add(m); P.peneira = g;
  g = new THREE.Group(); m = new THREE.Mesh(new THREE.DodecahedronGeometry(40, 0), mat(0x6b6f78)); g.add(m); P.minerio = g;
  /* bandeira (pano no plano YZ do mastro) */
  g = new THREE.Group(); m = cil(3.5, 3.5, 420, madeira); m.position.y = 150; g.add(m);
  m = new THREE.Mesh(new THREE.PlaneGeometry(130, 90, 4, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide })); m.name = 'pano'; m.position.set(0, 310, -66); m.rotation.y = Math.PI / 2; g.add(m); P.bandeira = g;
  Object.values(P).forEach(p => { p.visible = false; cena.add(p); });
  return P;
}

/* ---------------------------------------------------------------- carga dos modelos */
async function carregar() {
  const L = new GLTFLoader();
  const [gp, gc] = await Promise.all([L.loadAsync(BASE + 'personagem.glb'), L.loadAsync(BASE + 'cavalo.glb')]);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  cena = new THREE.Scene();
  cena.add(new THREE.HemisphereLight(0xfff6e6, 0x6a5a44, 1.7));
  luzDir = new THREE.DirectionalLight(0xfff1d6, 2.3); luzDir.position.set(-300, 600, 420); cena.add(luzDir);
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -5000, 5000);
  /* pessoa */
  pessoa = gp.scene; raiz = new THREE.Group(); raiz.add(pessoa); cena.add(raiz);
  pessoa.traverse(o => { if (o.isSkinnedMesh) { malha = o; o.frustumCulled = false; o.material = new THREE.MeshLambertMaterial({ map: null }); } if (o.isBone) ossos[o.name] = o; });
  if (ossos.Head) ossos.Head.scale.setScalar(CABECA);
  mixer = new THREE.AnimationMixer(pessoa);
  gp.animations.forEach(a => { const ac = mixer.clipAction(a); ac.play(); ac.enabled = true; ac.setEffectiveWeight(0); acoes[a.name] = ac; });
  /* o repouso de cada osso, para toda pose partir do mesmo ponto (ver repousar) */
  repouso = Object.values(ossos).map(o => ({ o, p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }));
  /* cavalo: escala para a altura de um cavalo ao lado da pessoa; olha para +Z como a pessoa */
  cavalo = gc.scene;
  const rc = new THREE.Group(); rc.add(cavalo); cena.add(rc); cavalo.userData.raiz = rc;
  rc.updateMatrixWorld(true);
  const bb = new THREE.Box3().expandByObject(cavalo, true), alt = bb.max.y - bb.min.y;   /* precisa: a malha tem esqueleto */
  cavalo.scale.multiplyScalar(ALTURA_MODELO * 0.86 / alt);
  cavalo.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.material = o.material.clone(); } if (o.isBone) ossosCavalo[o.name] = o; });
  mixerCavalo = new THREE.AnimationMixer(cavalo);
  gc.animations.filter(a => !/\|/.test(a.name)).forEach(a => { const ac = mixerCavalo.clipAction(a); ac.play(); ac.setEffectiveWeight(0); acoesCavalo[a.name] = ac; });
  pecas = montarPecas();
  /* sombra: desenhada em 2D depois, por baixo */
  B.pronto = true;
  document.dispatchEvent(new CustomEvent('rp:bonecos'));
}

/* ---------------------------------------------------------------- poses */
const V3 = THREE.Vector3, Q = THREE.Quaternion;
const _v = new V3(), _w = new V3(), _q = new Q(), _q2 = new Q();
/* Toda pose começa do repouso. O mixer só escreve num osso quando o valor da animação muda de uma amostra para a outra:
   pedir duas vezes a mesma amostra (as poses de trabalho usam sempre o mesmo ponto do idle) não desfazia os giros da pose
   anterior, e eles se somavam de um quadro para o outro (pernas cada vez mais dobradas, tronco cada vez mais curvado).
   Aqui os ossos voltam ao repouso e o mixer passa por uma amostra sem peso antes da amostra pedida, o que o obriga a
   escrever de novo tudo o que a animação mexe. */
let repouso = [];
function repousar() {
  for (const r of repouso) { r.o.position.copy(r.p); r.o.quaternion.copy(r.q); r.o.scale.copy(r.s); }
  Object.values(acoes).forEach(a => a.setEffectiveWeight(0));
  mixer.update(0);
}
function amostrar(acs, nomes, pesos, fase) {
  Object.values(acs).forEach(a => a.setEffectiveWeight(0));
  nomes.forEach((n, i) => { const a = acs[n]; if (!a) return; a.setEffectiveWeight(pesos[i]); a.time = fase * a.getClip().duration; });
}
/* gira um osso em torno de um eixo dado no espaço do personagem (X = esquerda dele, Y = cima, Z = frente) */
function girar(nome, eixo, ang) {
  const o = ossos[nome]; if (!o || !ang) return;
  o.parent.updateWorldMatrix(true, false);
  _v.set(eixo[0], eixo[1], eixo[2]).applyQuaternion(raiz.quaternion);
  o.getWorldQuaternion(_q); _q.invert();
  _v.applyQuaternion(_q).normalize();
  o.quaternion.multiply(_q2.setFromAxisAngle(_v, ang));
  o.updateWorldMatrix(false, true);
}
const LADO = [1, 0, 0], CIMA = [0, 1, 0], FRENTE = [0, 0, 1];
/* braço para a frente: o modelo tem X = esquerda; levantar o braço para a frente é girar em torno do eixo lateral */
function braco(lado, frente, abrir, cotovelo) {
  const L = lado === 'E' ? 'Left' : 'Right', s = lado === 'E' ? 1 : -1;
  girar(L + 'Arm', LADO, -frente);
  if (abrir) girar(L + 'Arm', FRENTE, s * abrir);
  if (cotovelo) girar(L + 'ForeArm', LADO, -cotovelo);
}
/* a mão direita em pala sobre os olhos: o braço sobe aberto para o lado e o antebraço dobra para a frente do rosto */
function maoNaTesta() { braco('D', 0.15, 2.1, 0); girar('RightForeArm', CIMA, 2.35); }
function onda(f, a, b) { return a + (b - a) * (0.5 - 0.5 * Math.cos(f * Math.PI * 2)); }
/* entra e sai devagar (0 → 1): o gesto acelera e freia em vez de andar em linha reta */
function suave(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }
/* golpe: sobe devagar, desce depressa (gravidade) */
function queda(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x; }
/* quadros-chave de um ciclo: tabela de [fase, v1, v2, ...] em ordem; devolve os valores na fase f, com a passagem suave
   entre uma chave e a próxima (a última liga de volta à primeira) */
function chaves(f, tab) {
  const n = tab.length;
  let i = n - 1;
  for (let k = 0; k < n; k++) if (f < tab[k][0]) { i = (k + n - 1) % n; break; }
  const a = tab[i], b = tab[(i + 1) % n];
  let span = b[0] - a[0], d = f - a[0];
  if (span <= 0) span += 1;
  if (d < 0) d += 1;
  const e = suave(d / span), out = [];
  for (let k = 1; k < a.length; k++) out.push(a[k] + (b[k] - a[k]) * e);
  return out;
}
/* pá: fase, curvar o tronco, torcer o tronco, braço direito, braço esquerdo, cotovelo, joelho */
const CAVAR = [
  [0.00, 0.30, 0.00, 0.95, 1.10, 0.45, 0.20],   /* pá no alto, pronta */
  [0.22, 0.72, 0.05, 0.55, 0.80, 0.25, 0.45],   /* enterra a pá: tronco bem curvado, joelho dobra */
  [0.34, 0.78, 0.05, 0.50, 0.75, 0.30, 0.50],   /* pisa e força */
  [0.56, 0.38, -0.10, 1.05, 1.20, 0.75, 0.25],  /* levanta a terra */
  [0.74, 0.20, -0.75, 1.45, 1.55, 0.55, 0.10],  /* joga a terra para o lado, por cima do ombro */
  [0.88, 0.22, -0.30, 1.10, 1.20, 0.50, 0.12]   /* volta */
];
function aplicarPose(pose, f, o) {
  repousar();
  ossos.Hips && (ossos.Hips.userData.y0 ??= ossos.Hips.position.y);
  if (pose === 'andando' || pose === 'carregar' || pose === 'andando-olhar') amostrar(acoes, ['idle', 'run'], [0.4, 0.6], f);
  else if (pose === 'correndo') amostrar(acoes, ['run'], [1], f);
  else amostrar(acoes, ['idle'], [1], pose === 'parado' || pose === 'conversar' || pose === 'apontar' || pose === 'olhar' ? f : 0.25);
  mixer.update(0);
  raiz.updateMatrixWorld(true);
  /* braços do idle da Kenney vêm meio abertos: junta ao corpo */
  if (pose !== 'andando' && pose !== 'correndo' && pose !== 'carregar' && pose !== 'andando-olhar') { braco('E', 0, -0.12, 0); braco('D', 0, -0.12, 0); }
  switch (pose) {
    case 'golpe': {   /* machado, picareta, martelo: as duas mãos sobem devagar, param um instante no alto e descem com força */
      const sobe = f < 0.5 ? suave(f / 0.5) : f < 0.6 ? 1 : f < 0.74 ? 1 - queda((f - 0.6) / 0.14) : 0;
      const bate = f >= 0.74 && f < 0.86 ? Math.sin((f - 0.74) / 0.12 * Math.PI) : 0;   /* o tranco da batida */
      const a = 0.25 + sobe * 2.55 - bate * 0.12;
      braco('D', a, 0.18, 0.55 - sobe * 0.3); braco('E', a - 0.1, 0.32, 0.5 - sobe * 0.25);
      girar('Spine', LADO, 0.08 + (1 - sobe) * 0.34 + bate * 0.06 - sobe * 0.1); girar('Chest', LADO, (1 - sobe) * 0.12);
      girar('LeftUpLeg', LADO, 0.12 + (1 - sobe) * 0.12); girar('LeftLeg', LADO, -0.2 - (1 - sobe) * 0.16);
      break;
    }
    case 'cavar': {   /* pá ou enxada: enterra, força, levanta a terra e joga para o lado */
      const k = chaves(f, CAVAR);
      girar('Spine', LADO, k[0]); girar('Chest', LADO, 0.1); girar('Spine', CIMA, k[1]);
      braco('D', k[2], 0.1, k[4]); braco('E', k[3], 0.25, k[4] + 0.2);
      girar('RightUpLeg', LADO, 0.15 + k[5] * 0.6); girar('RightLeg', LADO, -0.25 - k[5] * 0.7);
      girar('LeftUpLeg', LADO, k[5] * 0.25); girar('LeftLeg', LADO, -k[5] * 0.4);
      break;
    }
    case 'peneirar': {   /* agachado, peneira nas duas mãos, sacudindo de um lado para o outro */
      const s = Math.sin(f * Math.PI * 6) * (0.6 + 0.4 * Math.sin(f * Math.PI * 2));   /* três sacudidas por ciclo, umas mais fortes */
      girar('LeftUpLeg', LADO, 1.05); girar('RightUpLeg', LADO, 1.2);
      girar('LeftLeg', LADO, -1.75); girar('RightLeg', LADO, -1.9);
      girar('Spine', LADO, 0.42 + Math.abs(s) * 0.04); girar('Spine', CIMA, s * 0.16);
      braco('E', 1.05, 0.12 + s * 0.1, 0.75); braco('D', 1.05, 0.12 - s * 0.1, 0.75);
      ossos.Hips.position.y = ossos.Hips.userData.y0 * 0.62;
      break;
    }
    case 'olhar': {   /* mão na testa, corpo e cabeça varrem o horizonte de um lado ao outro */
      const v = Math.sin(f * Math.PI * 2), para = suave(Math.min(1, Math.abs(v) * 1.6)) * Math.sign(v);
      girar('Spine', CIMA, para * 0.42); girar('Head', CIMA, para * 0.5);
      maoNaTesta(); braco('E', 0.1, 0.25, 0.5);
      girar('Spine', LADO, -0.06);
      break;
    }
    case 'andando-olhar': {   /* andando com a mão na testa, olhando para os lados */
      const v = Math.sin(f * Math.PI * 2);
      girar('Head', CIMA, v * 0.55); maoNaTesta();
      break;
    }
    case 'apontar': {   /* braço estendido para a frente, a outra mão na cintura; o braço sobe, fica e desce */
      const v = f < 0.25 ? suave(f / 0.25) : f < 0.75 ? 1 : 1 - suave((f - 0.75) / 0.25);
      braco('D', 0.1 + v * 1.45, 0.05, 0.25 - v * 0.2); braco('E', 0.15, 0.55, 1.5);
      girar('Spine', CIMA, -v * 0.18); girar('Spine', LADO, v * 0.07); girar('Head', LADO, -v * 0.08);
      break;
    }
    case 'conversar': {   /* fala com as mãos: uma sobe e desce, a cabeça acompanha */
      const v = onda(f, 0, 1), w = Math.sin(f * Math.PI * 4);
      braco('D', 0.55 + v * 0.45, 0.1 + w * 0.08, 1.35 - v * 0.35); braco('E', 0.25 + (1 - v) * 0.2, 0.15, 0.9);
      girar('Head', LADO, w * 0.07); girar('Head', CIMA, (v - 0.5) * 0.25); girar('Spine', CIMA, (v - 0.5) * 0.12);
      break;
    }
    case 'estocada': {   /* recua a lança, estoca depressa e volta devagar */
      const v = f < 0.22 ? -0.25 * suave(f / 0.22) : f < 0.36 ? -0.25 + 1.25 * queda((f - 0.22) / 0.14) : 1 - suave((f - 0.36) / 0.64);
      braco('D', 1.25, 0.05, 1.3 - v * 1.2); braco('E', 0.55, 0.2, 1.2);
      girar('Spine', CIMA, -0.25 + v * 0.3); girar('Spine', LADO, Math.max(0, v) * 0.2);
      girar('LeftUpLeg', LADO, 0.35 + Math.max(0, v) * 0.18); girar('LeftLeg', LADO, -0.3 - Math.max(0, v) * 0.22);
      break;
    }
    case 'aparar': {   /* escudo erguido à frente: apara o golpe e cede meio passo */
      const v = Math.sin(f * Math.PI);
      braco('E', 1.15 + v * 0.25, 0.25, 1.5); braco('D', 0.5, 0.1, 1.2);
      girar('Spine', LADO, -0.08 - v * 0.1); girar('Spine', CIMA, 0.3);
      girar('RightUpLeg', LADO, -0.2 - v * 0.12); girar('LeftUpLeg', LADO, 0.3); girar('LeftLeg', LADO, -0.35);
      break;
    }
    case 'cair': case 'caido': {   /* atingido: os joelhos cedem, os braços abrem e o corpo vai de costas ao chão */
      const v = pose === 'caido' ? 1 : f;
      braco('E', 0.4 + v * 0.9, 0.3 + v * 0.9, 0.4); braco('D', 0.3 + v * 0.8, 0.3 + v * 1.0, 0.5);
      girar('LeftUpLeg', LADO, 0.5 * Math.sin(v * Math.PI) + v * 0.1); girar('LeftLeg', LADO, -0.9 * Math.sin(v * Math.PI) - v * 0.25);
      girar('RightUpLeg', LADO, 0.3 * Math.sin(v * Math.PI)); girar('RightLeg', LADO, -0.6 * Math.sin(v * Math.PI));
      girar('Head', LADO, -v * 0.25);
      break;
    }
    case 'atirar': {   /* puxa a corda devagar, segura um instante e solta */
      const puxa = f < 0.55 ? suave(f / 0.55) : f < 0.72 ? 1 : f < 0.78 ? 1 - (f - 0.72) / 0.06 : 0;
      girar('Spine', CIMA, 0.55); girar('Spine', LADO, -puxa * 0.06);
      braco('E', 1.5, 0.05, 0.05); braco('D', 1.45, -0.15, 0.8 + puxa * 1.4);
      break;
    }
    case 'sentado': case 'ferido': {   /* sentado no chão, joelhos para cima */
      girar('LeftUpLeg', LADO, 1.45); girar('RightUpLeg', LADO, 1.45);
      girar('LeftUpLeg', FRENTE, 0.15); girar('RightUpLeg', FRENTE, -0.15);
      girar('LeftLeg', LADO, -1.9); girar('RightLeg', LADO, -1.9);
      braco('E', 0.7, 0.1, 0.9); braco('D', 0.6, 0.1, 1.0);
      if (pose === 'ferido') girar('Spine', LADO, 0.35);
      ossos.Hips.position.y = ossos.Hips.userData.y0 * 0.32;
      break;
    }
    case 'montado': {   /* pernas abertas em volta do cavalo, mãos nas rédeas */
      girar('LeftUpLeg', LADO, 1.15); girar('RightUpLeg', LADO, 1.15);
      girar('LeftUpLeg', FRENTE, 0.55); girar('RightUpLeg', FRENTE, -0.55);
      girar('LeftLeg', LADO, -1.25); girar('RightLeg', LADO, -1.25);
      braco('E', 0.75, 0.15, 0.9); braco('D', 0.75, 0.15, 0.9);
      girar('Spine', LADO, 0.08 + Math.sin(f * Math.PI * 2) * 0.04);
      break;
    }
    case 'carregar': {   /* carga no ombro direito */
      braco('D', 2.5, 0.25, 2.1); break;
    }
    default: break;
  }
  /* quem leva lança parada segura a haste em pé; o escudo vai à frente do corpo */
  const livre = !SEM_ARMA_NA_MAO[pose];
  if (o.lanca && livre && pose !== 'estocada' && pose !== 'montado' && pose !== 'golpe') braco('D', 0.3, 0.12, 1.25);
  if (o.escudo && livre && pose !== 'estocada' && pose !== 'montado') braco('E', 0.35, 0.1, 1.35);
  if (o.arco && livre && pose !== 'atirar' && pose !== 'montado') braco('E', 0.25, 0.05, 0.4);
  raiz.updateMatrixWorld(true);
}
/* poses em que as mãos estão ocupadas com o gesto: a arma não é segurada do jeito de sempre */
const SEM_ARMA_NA_MAO = { cair: 1, caido: 1, olhar: 1, apontar: 1, 'andando-olhar': 1, peneirar: 1, cavar: 1, aparar: 1, conversar: 1 };
/* quem caiu larga a arma: só o que está na cabeça continua */
const CAIDO = { cair: 1, caido: 1 };
function pos(nome, alvo) { return ossos[nome].getWorldPosition(alvo || new V3()); }
/* eixos do personagem no mundo */
function eixos() {
  const lado = new V3(1, 0, 0).applyQuaternion(raiz.quaternion), frente = new V3(0, 0, 1).applyQuaternion(raiz.quaternion);
  return { lado, frente, cima: new V3(0, 1, 0).applyQuaternion(raiz.quaternion) };
}
/* põe uma peça com o cabo (+Y) em `y` e o fio (+Z) perto de `z`, segurada em `p` */
function por(peca, p, y, z) {
  y = y.clone().normalize(); const x = new V3().crossVectors(y, z).normalize(); z = new V3().crossVectors(x, y).normalize();
  peca.position.copy(p); peca.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); peca.visible = true;
}
function pintar(peca, nome, cor) { peca.traverse(o => { if (o.isMesh && o.name === nome) o.material.color.set(cor); }); }
function aplicarPecas(pose, f, o) {
  Object.values(pecas).forEach(p => { p.visible = false; });
  const E = eixos(), mD = pos('RightHand'), mE = pos('LeftHand'), aD = pos('RightForeArm'), aE = pos('LeftForeArm');
  const antebracoD = mD.clone().sub(aD).normalize();
  const cabeca = pos('Head'), centroCabeca = cabeca.clone().add(E.cima.clone().multiplyScalar(70 * CABECA));
  const caiu = !!CAIDO[pose];
  if (pose === 'peneirar') {
    /* peneira entre as duas mãos, deitada */
    por(pecas.peneira, mD.clone().lerp(mE, 0.5).add(new V3(0, -6, 0)), new V3(0, 1, 0), E.frente);
  }
  /* ferramenta de golpe: cabo continua o antebraço dobrado para cima */
  const ferr = o.ferramenta || o.trabalho;
  if (ferr && pecas[ferr] && (pose === 'golpe' || pose === 'cavar')) {
    const cabo = pose === 'cavar' ? antebracoD.clone().multiplyScalar(-1).add(E.frente.clone().multiplyScalar(1.4)).add(new V3(0, -1.2, 0)) : new V3().crossVectors(antebracoD, E.lado).multiplyScalar(-1);
    if (cabo.lengthSq() < 1e-6) cabo.copy(E.cima);
    por(pecas[ferr], mD, cabo, pose === 'cavar' ? new V3(0, -1, 0) : E.frente.clone().negate().add(new V3(0, 1, 0)));
    if (pose === 'cavar') pecas[ferr].position.add(cabo.clone().normalize().multiplyScalar(-90));
  }
  if (o.carga === 'picareta' && !ferr) por(pecas.picareta, mD, antebracoD.clone().add(E.frente.clone().multiplyScalar(0.6)), E.frente);
  if (o.lanca && !caiu && pose !== 'peneirar' && pose !== 'cavar') {
    const y = pose === 'estocada' ? antebracoD.clone() : E.cima.clone().add(E.frente.clone().multiplyScalar(pose === 'montado' ? 0.55 : 0.08));
    por(pecas.lanca, mD, y, E.frente); pecas.lanca.position.add(y.clone().normalize().multiplyScalar(pose === 'estocada' ? -40 : -60));
  }
  if (o.arco && !caiu) por(pecas.arco, mE, E.cima, pose === 'atirar' ? E.frente : E.frente.clone().add(E.lado.clone().multiplyScalar(-0.6)));
  if (o.escudo && !caiu) {
    const p = aE.clone().lerp(mE, 0.55).add(E.frente.clone().multiplyScalar(26)).add(E.lado.clone().multiplyScalar(14));
    por(pecas.escudo, p, E.cima, E.frente.clone().add(E.lado.clone().multiplyScalar(0.35)));
    pintar(pecas.escudo, 'pintura', o.escudo);
  }
  if (o.capacete) { por(pecas.capacete, centroCabeca.clone().add(new V3(0, 4, 0)), E.cima, E.frente); pintar(pecas.capacete, 'metal', o.capacete); }
  else if (o.capuz) { por(pecas.capuz, centroCabeca.clone().add(new V3(0, 2, 0)), E.cima, E.frente); pintar(pecas.capuz, 'pano', o.capuz); }
  else if (o.chapeu === 'palha') por(pecas.palha, centroCabeca.clone().add(new V3(0, 28, 0)), E.cima, E.frente);
  if (!caiu && (pose === 'carregar' || (o.carga && o.carga !== 'picareta'))) {
    const ombro = pos('RightShoulder').add(new V3(0, 52, 0)).add(E.lado.clone().multiplyScalar(-18));
    const pc = pecas[o.carga === 'tronco' ? 'tronco' : o.carga === 'minerio' ? 'minerio' : 'saco'];
    por(pc, ombro, E.cima, E.frente);
    if (o.carga === 'tronco') pc.quaternion.multiply(new Q().setFromAxisAngle(new V3(0, 1, 0), Math.PI / 2));
  }
  if (o.bandeira && !caiu) {
    por(pecas.bandeira, mE.clone().add(new V3(0, -40, 0)), E.cima.clone().add(E.frente.clone().multiplyScalar(-0.15)), E.lado);
    pintar(pecas.bandeira, 'pano', o.bandeira);
    const pano = pecas.bandeira.children[1], pa = pano.geometry.attributes.position;
    pano.userData.x0 ??= Array.from(pa.array);
    for (let i = 0; i < pa.count; i++) { const x0 = pano.userData.x0[i * 3]; pa.setZ(i, Math.sin(f * Math.PI * 2 + x0 * 0.05) * (x0 + 65) * 0.12); }
    pa.needsUpdate = true;
  }
}

/* ---------------------------------------------------------------- roupa a partir das opções de RP.sprites */
function roupaDe(o) {
  const s = hash(((o.semente || 0) % VARIANTES) + 7), fem = o.feminina != null ? !!o.feminina : (s % 5 === 0);
  return {
    tunica: o.roupa || '#7a6a4a', calca: o.calca || ['#4a3b2c', '#3f3a33', '#5a4632', '#33302c'][s % 4], pele: PELE[(s >>> 3) % PELE.length],
    cabelo: CABELO[(s >>> 6) % CABELO.length], bota: '#3a2a1c', cinto: o.cinto || '#2b2520', feminina: fem, barba: !fem && (s >>> 9) % 3 === 0,
    capuz: o.capuz && !o.capacete ? o.capuz : null, armadura: o.armadura || 0, metal: o.capacete || '#aeb6be', tunicaLonga: !!o.tunicaLonga
  };
}
function poseDe(o) {
  if (o.pose) return o.pose;
  if (o.sentado) return 'sentado';
  if (o.estocada) return 'estocada';
  if (o.atirando) return 'atirar';
  if (o.trabalho === 'peneira') return o.andando ? 'andando' : 'peneirar';
  if (o.trabalho === 'pa' || o.ferramenta === 'enxada' || o.ferramenta === 'pa') return o.andando ? 'andando' : 'cavar';
  if (o.trabalho || o.ferramenta) return o.andando ? 'andando' : 'golpe';
  if (o.carga && o.carga !== 'picareta') return o.andando ? 'carregar' : 'parado';
  if (o.correndo) return 'correndo';
  return o.andando ? 'andando' : 'parado';
}
/* 8 direções: 0 = olhando para a direita da tela, no sentido horário (a tela tem y para baixo) */
function direcao(o) {
  /* o.ang é a direção no chão do mapa; com a câmera girada, na tela ela vira ang + AZ */
  if (o.ang != null) {
    const a = o.ang + ((RP.arte && RP.arte.AZ) || 0);
    /* dir4: só as quatro diagonais (quem passeia perto de casa): metade dos sprites, e a figura nunca fica de perfil duro */
    if (o.dir4) return (((Math.floor(a / (Math.PI / 2)) * 2 + 1) % 8) + 8) % 8;
    return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  }
  return (o.dir || 1) > 0 ? 1 : 3;
}
function virar(grupo, d) { const a = d * Math.PI / 4; grupo.rotation.set(0, Math.atan2(Math.cos(a), Math.sin(a)), 0); }

/* ---------------------------------------------------------------- render */
function prepararCamera(cx) {
  /* projeção 1:1: a caixa do sprite é a da câmera, em qualquer inclinação. Visto de cima, o que é alto encurta; nada estica */
  const k = (RP.arte && RP.arte.K3D) || 0.62, el = Math.asin(Math.min(0.95, k));
  const w = cx.W / 2 / UNID, top = cx.ALT / UNID, bot = cx.PE / UNID;
  camera.left = -w; camera.right = w; camera.top = top; camera.bottom = -bot; camera.updateProjectionMatrix();
  camera.position.set(0, Math.sin(el) * 2000, Math.cos(el) * 2000); camera.lookAt(0, 0, 0);
  renderer.setSize(cx.W * RES * SS, (cx.ALT + cx.PE) * RES * SS, false);
}
function contorno(origem, cx, sombra) {
  const w = cx.W * RES, h = (cx.ALT + cx.PE) * RES, out = document.createElement('canvas'); out.width = w; out.height = h;
  const c = out.getContext('2d');
  if (sombra) { c.fillStyle = 'rgba(8,10,14,0.28)'; c.beginPath(); c.ellipse(w / 2, cx.ALT * RES, sombra * RES, sombra * RES * 0.58 * ((RP.arte && RP.arte.K3D) || 0.62), 0, 0, 7); c.fill(); }
  const t = document.createElement('canvas'); t.width = w; t.height = h; const tc = t.getContext('2d');
  tc.drawImage(origem, 0, 0, w, h); tc.globalCompositeOperation = 'source-in'; tc.fillStyle = 'rgba(28,20,14,0.55)'; tc.fillRect(0, 0, w, h);
  [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(d => c.drawImage(t, d[0], d[1]));
  c.drawImage(origem, 0, 0, w, h);
  return out;
}
function renderPessoa(o, d, f) {
  const cx = CX.pessoa, pose = poseDe(o);
  cavalo.userData.raiz.visible = false; raiz.visible = true; raiz.position.set(0, 0, 0);
  virar(raiz, d);
  if (CAIDO[pose]) {
    /* de costas ao chão: a raiz deita para trás em torno dos pés e avança meio corpo, para a figura caber na caixa */
    const v = pose === 'caido' ? 1 : queda(f), fr = new V3(0, 0, 1).applyQuaternion(raiz.quaternion);
    raiz.rotateX(-1.46 * v);
    raiz.position.set(fr.x * 150 * v, 34 * v, fr.z * 150 * v);
  }
  malha.material.map = textura(roupaDe(o)); malha.material.needsUpdate = true;
  aplicarPose(pose, f, o);
  aplicarPecas(pose, f, o);
  prepararCamera(cx);
  renderer.render(cena, camera);
  return contorno(renderer.domElement, cx, 5);
}
function renderMontado(o, d, f) {
  const cx = CX.montado, rc = cavalo.userData.raiz, anda = o.galope ? 'Gallop' : o.andando ? 'Walk' : o.pastando ? 'Eating' : 'Idle';
  rc.visible = true; virar(rc, d); rc.position.set(0, 0, 0);
  const pel = PELAGEM[(o.pelagem != null ? o.pelagem : hash(o.semente || 3)) % PELAGEM.length];
  cavalo.traverse(m => {
    if (!m.isMesh) return;
    const n = m.material.name;
    if (n === 'Main') m.material.color.set(o.cor || pel.corpo); else if (n === 'Main_Dark') m.material.color.set(pel.escuro);
    else if (n === 'Main_Light') m.material.color.set(pel.claro); else if (n === 'Hair') m.material.color.set(pel.crina);
  });
  amostrar(acoesCavalo, [anda], [1], f); mixerCavalo.update(0); rc.updateMatrixWorld(true);
  if (o.cavaleiro) {
    raiz.visible = true; virar(raiz, d);
    const sela = selaDoCavalo();
    const op = Object.assign({}, o, { roupa: o.cavaleiro, pose: 'montado', lanca: o.lanca, andando: false });
    malha.material.map = textura(roupaDe(op)); malha.material.needsUpdate = true;
    raiz.position.set(0, 0, 0); aplicarPose('montado', f, op);
    const quadril = pos('Hips');
    raiz.position.add(sela.sub(quadril)); raiz.updateMatrixWorld(true);
    aplicarPecas('montado', f, op);
  } else { raiz.visible = false; Object.values(pecas).forEach(p => { p.visible = false; }); }
  prepararCamera(cx);
  renderer.render(cena, camera);
  return contorno(renderer.domElement, cx, 11);
}
/* ponto da sela: o osso do corpo do cavalo mais alto perto do meio (o nome muda entre modelos) */
let nomeSela = null;
function selaDoCavalo() {
  if (!nomeSela) {
    const cand = Object.keys(ossosCavalo).filter(n => /spine|body|chest|torso|hips|pelvis/i.test(n));
    nomeSela = ['Torso2', 'Torso', 'Back'].find(n => ossosCavalo[n]) || cand.find(n => /spine/i.test(n)) || cand[0] || Object.keys(ossosCavalo)[0];
  }
  const p = ossosCavalo[nomeSela].getWorldPosition(new V3());
  return p.add(new V3(0, 42, 0));
}

function chave(tipo, o, d, f) {
  const r = roupaDe(o);
  return [tipo, poseDe(o), d, f, r.tunica, r.calca, r.pele, r.cabelo, r.feminina ? 1 : 0, r.barba ? 1 : 0, r.capuz || '', r.armadura, o.capacete || '',
    o.lanca ? 1 : 0, o.escudo || '', o.arco ? 1 : 0, o.ferramenta || '', o.trabalho || '', o.carga || '', o.chapeu || '', o.bandeira || '',
    o.cavaleiro || '', o.galope ? 1 : 0, o.andando ? 1 : 0, o.pastando ? 1 : 0, o.pelagem != null ? o.pelagem : '', o.cor || ''].join('|');
}
function quadro(o, t, pose) {
  const ciclo = CICLO[pose] || 1, fase = ((t / ciclo + (o.fase || 0) / (Math.PI * 2)) % 1 + 1) % 1;
  return Math.floor(fase * FRAMES) % FRAMES;
}
/* ritmo próprio de cada pessoa: o ciclo de cada uma dura um pouco mais ou um pouco menos (±9%), e com a fase própria
   ninguém anda nem trabalha em uníssono. Não custa sprite nenhum: muda só a hora em que cada quadro aparece. */
function ritmoDe(o) { return o.semente == null ? 1 : 0.91 + (hash(o.semente * 31 + 5) % 1000) / 1000 * 0.18; }
function obter(tipo, o, t, render) {
  if (!B.pronto) return null;
  const d = direcao(o), pose = tipo === 'pessoa' ? poseDe(o) : (o.galope ? 'correndo' : o.andando ? 'andando' : 'parado');
  const ciclo = (tipo === 'montado' ? (o.galope ? 0.6 : o.andando ? 1.05 : 2.6) : (CICLO[pose] || 1)) * ritmoDe(o);
  const nq = tipo === 'montado' ? FRAMES : (QUADROS[pose] || FRAMES);
  /* o.quadro (0 a 1): gesto que acontece uma vez (a queda), no ponto pedido; senão, o ciclo pelo relógio */
  const fase = o.quadro != null ? Math.max(0, Math.min(0.9999, o.quadro)) : ((t / ciclo + (o.fase || 0) / (Math.PI * 2)) % 1 + 1) % 1, fr = Math.floor(fase * nq) % nq;
  const sufixo = '|' + ((RP.arte && RP.arte.K3D) || 0).toFixed(2), figura = chave(tipo, o, d, 'q') + sufixo;
  const base = chave(tipo, o, d, fr), k = base + sufixo;
  const s = cache.get(k);
  if (s) { cache.delete(k); cache.set(k, s); return s; }
  const agora = performance.now(), q = Math.floor(agora / 16);
  if (q !== quadroAtual) { quadroAtual = q; gastoQuadro = 0; }
  if (gastoQuadro > ORCAMENTO_MS) {
    /* sem tempo neste quadro: o quadro pronto mais perto da mesma figura (a animação fica um instante mais dura, mas a
       figura não troca de desenho); sem nenhum, a mesma figura na inclinação pronta mais perto */
    const feitos = prontos.get(figura);
    if (feitos) for (let i = 1; i <= nq >> 1; i++) {
      const a = feitos[(fr - i + nq) % nq] || feitos[(fr + i) % nq];
      if (a) { const v = cache.get(a); if (v) return v; }
    }
    for (const kk of RP.arte.kVizinhos()) { const v = cache.get(base + '|' + kk); if (v) return v; }
    return null;
  }
  let novo;
  try { novo = render(o, d, (fr + 0.5) / nq); }
  catch (e) { console.error(e); B.pronto = false; B.falhou = true; return null; }
  gastoQuadro += performance.now() - agora;
  if (cache.size >= MAX) cache.delete(cache.keys().next().value);
  cache.set(k, novo);
  let lista = prontos.get(figura);
  if (!lista) { if (prontos.size > 4000) prontos.clear(); lista = []; prontos.set(figura, lista); }
  lista[fr] = k;
  return novo;
}
B.pessoa = (o, t) => obter('pessoa', o, t, renderPessoa);
/* em que ponto do ciclo (0 a 1) esta pessoa está nesta pose: para o que acompanha o gesto (a terra que a pá joga) */
B.fase = (o, t, pose) => ((t / ((CICLO[pose] || 1) * ritmoDe(o)) + (o.fase || 0) / (Math.PI * 2)) % 1 + 1) % 1;
B.montado = (o, t) => obter('montado', o, t, renderMontado);
B.renderAgora = (tipo, o, t) => { gastoQuadro = -1e9; const s = obter(tipo, o, t, tipo === 'pessoa' ? renderPessoa : renderMontado); return s; };
B.carregar = carregar;
/* inclinar a câmera muda o achatamento: os sprites são refeitos com a nova elevação */

carregar().catch(e => { console.warn('bonecos 3D indisponíveis; a Vista usa as figuras 2D.', e); B.falhou = true; });
