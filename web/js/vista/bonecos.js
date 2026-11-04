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
const CX = { pessoa: { W: 40, ALT: 44, PE: 6 }, montado: { W: 60, ALT: 50, PE: 8 } };
/* pixels por unidade do mundo: 4 em tela densa (celular, retina), 3 nas outras; teto do cache ≈ 30 MB */
const RES = (window.devicePixelRatio || 1) >= 1.5 ? 4 : 3, SS = 2, MAX = 300, ORCAMENTO_MS = 7, FRAMES = 8;
const ALTURA_MODELO = 376, ALTURA_PESSOA = 22.5, UNID = ALTURA_PESSOA / ALTURA_MODELO;   /* unidades do mundo por unidade do modelo */
const CABECA = 0.74;   /* a cabeça do modelo é de desenho animado; menor, o corpo fica com proporção de gente */
/* duração do ciclo de cada pose (s) */
const CICLO = { parado: 2.4, andando: 0.95, correndo: 0.62, golpe: 1.05, cavar: 1.25, estocada: 0.8, atirar: 1.7, carregar: 1.0, sentado: 3, montado: 1, ferido: 3 };

const B = RP.bonecos = { pronto: false, falhou: false, FRAMES, CX, tamanho: () => cache.size, limpar: () => cache.clear() };
const cache = new Map();
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
function onda(f, a, b) { return a + (b - a) * (0.5 - 0.5 * Math.cos(f * Math.PI * 2)); }
function aplicarPose(pose, f, o) {
  ossos.Hips && (ossos.Hips.userData.y0 ??= ossos.Hips.position.y);
  if (pose === 'andando' || pose === 'carregar') amostrar(acoes, ['idle', 'run'], [0.4, 0.6], f);
  else if (pose === 'correndo') amostrar(acoes, ['run'], [1], f);
  else amostrar(acoes, ['idle'], [1], pose === 'parado' ? f : 0.25);
  mixer.update(0);
  raiz.updateMatrixWorld(true);
  /* braços do idle da Kenney vêm meio abertos: junta ao corpo */
  if (pose !== 'andando' && pose !== 'correndo' && pose !== 'carregar') { braco('E', 0, -0.12, 0); braco('D', 0, -0.12, 0); }
  switch (pose) {
    case 'golpe': {   /* machado, picareta, martelo: as duas mãos sobem e descem com força */
      const sobe = f < 0.62 ? f / 0.62 : f < 0.74 ? 1 - (f - 0.62) / 0.12 : 0;
      const a = 0.25 + sobe * 2.55;
      braco('D', a, 0.18, 0.55 - sobe * 0.3); braco('E', a - 0.1, 0.32, 0.5 - sobe * 0.25);
      girar('Spine', LADO, 0.08 + (1 - sobe) * 0.32); girar('Chest', LADO, (1 - sobe) * 0.12);
      break;
    }
    case 'cavar': {   /* pá ou enxada: tronco curvado, as mãos vão e voltam embaixo */
      const v = onda(f, 0, 1);
      girar('Spine', LADO, 0.35 + v * 0.25); girar('Chest', LADO, 0.1);
      braco('D', 0.75 + v * 0.45, 0.1, 0.35); braco('E', 0.95 + v * 0.35, 0.25, 0.6);
      girar('RightUpLeg', LADO, 0.25); girar('RightLeg', LADO, -0.35);
      break;
    }
    case 'estocada': {
      const v = f < 0.3 ? f / 0.3 : 1 - (f - 0.3) / 0.7;
      braco('D', 1.25, 0.05, 1.3 - v * 1.2); braco('E', 0.55, 0.2, 1.2);
      girar('Spine', CIMA, -0.25 + v * 0.25); girar('Spine', LADO, v * 0.15);
      girar('LeftUpLeg', LADO, 0.35); girar('LeftLeg', LADO, -0.3);
      break;
    }
    case 'atirar': {
      const puxa = f < 0.7 ? f / 0.7 : 0;
      girar('Spine', CIMA, 0.55);
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
  if (o.lanca && pose !== 'estocada' && pose !== 'montado' && pose !== 'golpe') braco('D', 0.3, 0.12, 1.25);
  if (o.escudo && pose !== 'estocada' && pose !== 'montado') braco('E', 0.35, 0.1, 1.35);
  if (o.arco && pose !== 'atirar' && pose !== 'montado') braco('E', 0.25, 0.05, 0.4);
  raiz.updateMatrixWorld(true);
}
function pos(nome, alvo) { return ossos[nome].getWorldPosition(alvo || new V3()); }
/* eixos do personagem no mundo */
function eixos() {
  const lado = new V3(1, 0, 0).applyQuaternion(raiz.quaternion), frente = new V3(0, 0, 1).applyQuaternion(raiz.quaternion);
  return { lado, frente, cima: new V3(0, 1, 0) };
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
  const cabeca = pos('Head'), centroCabeca = cabeca.clone().add(new V3(0, 70 * CABECA, 0));
  /* ferramenta de golpe: cabo continua o antebraço dobrado para cima */
  const ferr = o.ferramenta || o.trabalho;
  if (ferr && pecas[ferr] && (pose === 'golpe' || pose === 'cavar')) {
    const cabo = pose === 'cavar' ? antebracoD.clone().multiplyScalar(-1).add(E.frente.clone().multiplyScalar(1.4)).add(new V3(0, -1.2, 0)) : new V3().crossVectors(antebracoD, E.lado).multiplyScalar(-1);
    if (cabo.lengthSq() < 1e-6) cabo.copy(E.cima);
    por(pecas[ferr], mD, cabo, pose === 'cavar' ? new V3(0, -1, 0) : E.frente.clone().negate().add(new V3(0, 1, 0)));
    if (pose === 'cavar') pecas[ferr].position.add(cabo.clone().normalize().multiplyScalar(-90));
  }
  if (o.carga === 'picareta' && !ferr) por(pecas.picareta, mD, antebracoD.clone().add(E.frente.clone().multiplyScalar(0.6)), E.frente);
  if (o.lanca) {
    const y = pose === 'estocada' ? antebracoD.clone() : E.cima.clone().add(E.frente.clone().multiplyScalar(pose === 'montado' ? 0.55 : 0.08));
    por(pecas.lanca, mD, y, E.frente); pecas.lanca.position.add(y.clone().normalize().multiplyScalar(pose === 'estocada' ? -40 : -60));
  }
  if (o.arco) por(pecas.arco, mE, E.cima, pose === 'atirar' ? E.frente : E.frente.clone().add(E.lado.clone().multiplyScalar(-0.6)));
  if (o.escudo) {
    const p = aE.clone().lerp(mE, 0.55).add(E.frente.clone().multiplyScalar(26)).add(E.lado.clone().multiplyScalar(14));
    por(pecas.escudo, p, E.cima, E.frente.clone().add(E.lado.clone().multiplyScalar(0.35)));
    pintar(pecas.escudo, 'pintura', o.escudo);
  }
  if (o.capacete) { por(pecas.capacete, centroCabeca.clone().add(new V3(0, 4, 0)), E.cima, E.frente); pintar(pecas.capacete, 'metal', o.capacete); }
  else if (o.capuz) { por(pecas.capuz, centroCabeca.clone().add(new V3(0, 2, 0)), E.cima, E.frente); pintar(pecas.capuz, 'pano', o.capuz); }
  else if (o.chapeu === 'palha') por(pecas.palha, centroCabeca.clone().add(new V3(0, 28, 0)), E.cima, E.frente);
  if (pose === 'carregar' || (o.carga && o.carga !== 'picareta')) {
    const ombro = pos('RightShoulder').add(new V3(0, 52, 0)).add(E.lado.clone().multiplyScalar(-18));
    const pc = pecas[o.carga === 'tronco' ? 'tronco' : o.carga === 'minerio' ? 'minerio' : 'saco'];
    por(pc, ombro, E.cima, E.frente);
    if (o.carga === 'tronco') pc.quaternion.multiply(new Q().setFromAxisAngle(new V3(0, 1, 0), Math.PI / 2));
  }
  if (o.bandeira) {
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
  const s = hash((o.semente || 0) + 7), fem = o.feminina != null ? !!o.feminina : (s % 5 === 0);
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
  if (o.trabalho === 'pa' || o.ferramenta === 'enxada' || o.ferramenta === 'pa') return o.andando ? 'andando' : 'cavar';
  if (o.trabalho || o.ferramenta) return o.andando ? 'andando' : 'golpe';
  if (o.carga && o.carga !== 'picareta') return o.andando ? 'carregar' : 'parado';
  if (o.correndo) return 'correndo';
  return o.andando ? 'andando' : 'parado';
}
/* 8 direções: 0 = olhando para a direita da tela, no sentido horário (a tela tem y para baixo) */
function direcao(o) {
  if (o.ang != null) return ((Math.round(o.ang / (Math.PI / 4)) % 8) + 8) % 8;
  return (o.dir || 1) > 0 ? 1 : 3;
}
function virar(grupo, d) { const a = d * Math.PI / 4; grupo.rotation.set(0, Math.atan2(Math.cos(a), Math.sin(a)), 0); }

/* ---------------------------------------------------------------- render */
function prepararCamera(cx) {
  const k = (RP.arte && RP.arte.K) || 0.62, el = Math.asin(Math.min(0.95, k)), ce = Math.cos(el);
  const w = cx.W / 2 / UNID, top = cx.ALT / UNID * ce, bot = cx.PE / UNID * ce;
  camera.left = -w; camera.right = w; camera.top = top; camera.bottom = -bot; camera.updateProjectionMatrix();
  camera.position.set(0, Math.sin(el) * 2000, Math.cos(el) * 2000); camera.lookAt(0, 0, 0);
  renderer.setSize(cx.W * RES * SS, (cx.ALT + cx.PE) * RES * SS, false);
}
function contorno(origem, cx, sombra) {
  const w = cx.W * RES, h = (cx.ALT + cx.PE) * RES, out = document.createElement('canvas'); out.width = w; out.height = h;
  const c = out.getContext('2d');
  if (sombra) { c.fillStyle = 'rgba(8,10,14,0.28)'; c.beginPath(); c.ellipse(w / 2, cx.ALT * RES, sombra * RES, sombra * RES * 0.36, 0, 0, 7); c.fill(); }
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
    o.cavaleiro || '', o.galope ? 1 : 0, o.andando ? 1 : 0, o.pastando ? 1 : 0, o.pelagem != null ? o.pelagem : '', o.cor || '', (RP.arte && RP.arte.K || 0).toFixed(2)].join('|');
}
function quadro(o, t, pose) {
  const ciclo = CICLO[pose] || 1, fase = ((t / ciclo + (o.fase || 0) / (Math.PI * 2)) % 1 + 1) % 1;
  return Math.floor(fase * FRAMES) % FRAMES;
}
function obter(tipo, o, t, render) {
  if (!B.pronto) return null;
  const d = direcao(o), pose = tipo === 'pessoa' ? poseDe(o) : (o.galope ? 'correndo' : o.andando ? 'andando' : 'parado');
  const ciclo = tipo === 'montado' ? (o.galope ? 0.6 : o.andando ? 1.05 : 2.6) : CICLO[pose];
  const fase = ((t / ciclo + (o.fase || 0) / (Math.PI * 2)) % 1 + 1) % 1, fr = Math.floor(fase * FRAMES) % FRAMES;
  const k = chave(tipo, o, d, fr);
  const s = cache.get(k);
  if (s) { cache.delete(k); cache.set(k, s); return s; }
  const agora = performance.now(), q = Math.floor(agora / 16);
  if (q !== quadroAtual) { quadroAtual = q; gastoQuadro = 0; }
  if (gastoQuadro > ORCAMENTO_MS) return null;
  let novo;
  try { novo = render(o, d, (fr + 0.5) / FRAMES); }
  catch (e) { console.error(e); B.pronto = false; B.falhou = true; return null; }
  gastoQuadro += performance.now() - agora;
  if (cache.size >= MAX) cache.delete(cache.keys().next().value);
  cache.set(k, novo);
  return novo;
}
B.pessoa = (o, t) => obter('pessoa', o, t, renderPessoa);
B.montado = (o, t) => obter('montado', o, t, renderMontado);
B.renderAgora = (tipo, o, t) => { gastoQuadro = -1e9; const s = obter(tipo, o, t, tipo === 'pessoa' ? renderPessoa : renderMontado); return s; };
B.carregar = carregar;
/* inclinar a câmera muda o achatamento: os sprites são refeitos com a nova elevação */
if (RP.arte && RP.arte.aoMudarK) RP.arte.aoMudarK.push(() => cache.clear());

carregar().catch(e => { console.warn('bonecos 3D indisponíveis; a Vista usa as figuras 2D.', e); B.falhou = true; });
