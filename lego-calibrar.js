// Banco de calibración de piezas LEGO — herramienta interna, sin enlaces
// públicos. Permite armar combinaciones de piezas con precisión milimétrica
// y libertad total de orientación, marcarlas como válidas y exportar un
// análisis en texto plano (.txt) con posiciones LDU, matrices y la línea
// equivalente del formato de guías cuando la orientación es representable.
// Ese .txt se le pasa a la IA de desarrollo para fijar las reglas de
// encastre (catálogo, recetas del prompt y nuevas capacidades del motor).

import * as THREE from './lego/vendor/three.module.min.js';
import { LDrawLoader } from './lego/vendor/LDrawLoader.js';
import { OrbitControls } from './lego/vendor/OrbitControls.js';
import { PIEZAS, COLORES, CATEGORIAS, piezaPorClave, buscarPieza, buscarColor, colorPorCodigoLdraw } from './lego-catalogo.js';
import { abrirSelectorPieza } from './lego-picker.js';

const STORAGE_KEY = 'gen_lego_calibracion';
const RUTA_LDRAW = 'lego/ldraw/';

// ============================================================
// Matrices (mismas convenciones que lego-render.js)
// ============================================================
const MATRICES_ROT = {
  0: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  90: [0, 0, 1, 0, 1, 0, -1, 0, 0],
  180: [-1, 0, 0, 0, 1, 0, 0, 0, -1],
  270: [0, 0, -1, 0, 1, 0, 1, 0, 0],
};
const MATRICES_PARADO = {
  0: [1, 0, 0, 0, 0, -1, 0, 1, 0],
  90: [0, 0, 1, 1, 0, 0, 0, 1, 0],
  180: [-1, 0, 0, 0, 0, 1, 0, 1, 0],
  270: [0, 0, -1, -1, 0, 0, 0, 1, 0],
};
const MATRICES_VOLCADO = {
  0: [0, -1, 0, 1, 0, 0, 0, 0, 1],
  90: [0, 0, 1, 1, 0, 0, 0, 1, 0],
  180: [0, 1, 0, 1, 0, 0, 0, 0, -1],
  270: [0, 0, -1, 1, 0, 0, 0, -1, 0],
};

function multiplicar(a, b) {
  const r = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
    for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
}

function rotacionEje(eje, grados) {
  const t = grados * Math.PI / 180;
  const c = Math.cos(t), s = Math.sin(t);
  if (eje === 'x') return [1, 0, 0, 0, c, -s, 0, s, c];
  if (eje === 'y') return [c, 0, s, 0, 1, 0, -s, 0, c];
  return [c, -s, 0, s, c, 0, 0, 0, 1]; // z
}

function cajaTransformada(caja, m) {
  const xs = [caja.min.x, caja.max.x], ys = [caja.min.y, caja.max.y], zs = [caja.min.z, caja.max.z];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const x of xs) for (const y of ys) for (const z of zs) {
    const tx = m[0] * x + m[1] * y + m[2] * z;
    const ty = m[3] * x + m[4] * y + m[5] * z;
    const tz = m[6] * x + m[7] * y + m[8] * z;
    minX = Math.min(minX, tx); maxX = Math.max(maxX, tx);
    minY = Math.min(minY, ty); maxY = Math.max(maxY, ty);
    minZ = Math.min(minZ, tz); maxZ = Math.max(maxZ, tz);
  }
  return { minX, maxX, minY, maxY, minZ, maxZ };
}

// ¿Esta matriz equivale a alguna combinación rot × parado/volcado del sistema?
function orientacionSistema(info, mat) {
  const preRot = info.preRot || 0;
  const iguales = (m) => {
    for (let i = 0; i < 9; i++) if (Math.abs(m[i] - mat[i]) > 0.001) return false;
    return true;
  };
  for (const modo of ['normal', 'parado', 'volcado']) {
    for (const rot of [0, 90, 180, 270]) {
      const efectiva = (rot + preRot) % 360;
      const m = modo === 'volcado' ? MATRICES_VOLCADO[rot]
        : modo === 'parado' ? MATRICES_PARADO[efectiva]
        : MATRICES_ROT[efectiva];
      if (iguales(m)) return { rot, parado: modo === 'parado', volcado: modo === 'volcado' };
    }
  }
  return null;
}

// Línea del formato de guías equivalente a esta colocación (o null)
function lineaSistema(p, caja) {
  const info = piezaPorClave(p.pieza);
  if (!info || !caja) return null;
  const o = orientacionSistema(info, p.mat);
  if (!o) return null;
  const efectiva = (o.rot + (info.preRot || 0)) % 360;
  const m = o.volcado ? MATRICES_VOLCADO[o.rot]
    : o.parado ? MATRICES_PARADO[efectiva]
    : MATRICES_ROT[efectiva];
  let x, z, nivel;
  if (o.volcado || o.parado || info.bbox) {
    const r = cajaTransformada(caja, m);
    x = (p.pos[0] + r.minX) / 20;
    z = (p.pos[2] + r.minZ) / 20;
    nivel = (-p.pos[1] - r.maxY) / 8;
  } else {
    let w = info.w, d = info.d;
    if (o.rot === 90 || o.rot === 270) [w, d] = [d, w];
    x = p.pos[0] / 20 - w / 2;
    z = p.pos[2] / 20 - d / 2;
    nivel = (-p.pos[1] - caja.max.y) / 8;
  }
  const num = (v) => {
    const r = Math.round(v * 1000) / 1000;
    return Object.is(r, -0) ? 0 : r;
  };
  const color = colorPorCodigoLdraw(p.color);
  let linea = `${p.pieza} ${color ? color.clave : p.color} en ${num(x)} ${num(z)}`;
  if (num(nivel) !== 0) linea += ` nivel ${num(nivel)}`;
  if (o.rot) linea += ` rotar ${o.rot}`;
  if (o.volcado) linea += ' volcado';
  else if (o.parado) linea += ' parado';
  return linea;
}

// ============================================================
// Estado
// ============================================================
let casos = [];
let iCaso = -1;
let iPieza = -1;
let uid = 1;

function casoActual() { return casos[iCaso] || null; }
function piezaActual() {
  const c = casoActual();
  return c && c.piezas[iPieza] ? c.piezas[iPieza] : null;
}

function guardar() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ casos, iCaso })); } catch (e) { /* sin espacio */ }
}

function cargar() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s && Array.isArray(s.casos)) { casos = s.casos; iCaso = Math.min(s.iCaso ?? 0, casos.length - 1); }
  } catch (e) { /* corrupto */ }
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('toast--visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove('toast--visible'), 3200);
}

// ============================================================
// Combinaciones sugeridas (kit NXT)
// ============================================================
const GC = 71, GO = 72, NE = 0, AM = 14, RO = 4, AZ = 1, BE = 19;
const SUGERIDOS = [
  // ejes, pines, bujes
  ['eje 3 + buje', [['eje 3', GC], ['buje', GC]]],
  ['eje 3 + medio buje', [['eje 3', GC], ['medio buje', AM]]],
  ['eje 5 con 2 bujes (tope a cada lado)', [['eje 5', GC], ['buje', GC], ['buje', GC]]],
  ['eje 2 con muesca + engranaje 8', [['eje 2 con muesca', RO], ['engranaje 8', GO]]],
  ['acople de ejes uniendo eje 3 y eje 3', [['eje 3', GC], ['acople de ejes', NE], ['eje 3', GC]]],
  ['pin en el agujero de una viga 3', [['pin', NE], ['viga 3', GO]]],
  ['pin largo uniendo viga 5 + viga 5', [['pin largo', AZ], ['viga 5', GO], ['viga 5', GO]]],
  ['medio pin + viga 3', [['medio pin', GC], ['viga 3', GO]]],
  ['pin eje: pin en viga + engranaje 8 en la punta', [['pin eje', AZ], ['viga 3', GO], ['engranaje 8', GO]]],
  ['pin eje beige + viga 3 + engranaje 16', [['pin eje beige', BE], ['viga 3', GO], ['engranaje 16', GC]]],
  ['pin con tope + viga 5', [['pin con tope', GC], ['viga 5', GO]]],
  ['pin doble con cruz + viga 3 + eje 3', [['pin doble con cruz', NE], ['viga 3', GO], ['eje 3', GC]]],
  // engranajes en eje
  ['eje 3 atravesando engranaje 8', [['eje 3', NE], ['engranaje 8', GO]]],
  ['eje 3 atravesando engranaje 16', [['eje 3', NE], ['engranaje 16', GC]]],
  ['eje 4 atravesando engranaje 24', [['eje 4', NE], ['engranaje 24', GC]]],
  ['eje 4 atravesando engranaje 40', [['eje 4', NE], ['engranaje 40', GO]]],
  ['eje 3 + corona 24', [['eje 3', NE], ['corona 24', GC]]],
  ['eje 3 + engranaje conico 12', [['eje 3', NE], ['engranaje conico 12', BE]]],
  ['eje 3 + engranaje conico 20', [['eje 3', NE], ['engranaje conico 20', GC]]],
  ['eje 4 + engranaje conico 36', [['eje 4', NE], ['engranaje conico 36', NE]]],
  ['eje 3 + rueda de mando (knob)', [['eje 3', NE], ['rueda de mando', NE]]],
  ['eje 3 + tornillo sin fin', [['eje 3', NE], ['tornillo sin fin', GC]]],
  ['eje 3 + polea + neumatico de polea', [['eje 3', NE], ['polea', GC], ['neumatico de polea', NE]]],
  // pares de engranajes
  ['engranaje 8 + engranaje 24 engranados', [['engranaje 8', GO], ['engranaje 24', GC]]],
  ['engranaje 24 + engranaje 24 engranados', [['engranaje 24', GC], ['engranaje 24', GC]]],
  ['engranaje 24 + engranaje 40 engranados', [['engranaje 24', GC], ['engranaje 40', GO]]],
  ['engranaje 8 + engranaje 40 engranados', [['engranaje 8', GO], ['engranaje 40', GO]]],
  ['engranaje 16 + engranaje 16 engranados', [['engranaje 16', GC], ['engranaje 16', GC]]],
  ['conico 12 + conico 12 a 90° (cambio de eje)', [['engranaje conico 12', BE], ['engranaje conico 12', BE]]],
  ['conico 20 + conico 12 a 90°', [['engranaje conico 20', GC], ['engranaje conico 12', BE]]],
  ['tornillo sin fin moviendo engranaje 24', [['tornillo sin fin', GC], ['engranaje 24', GC]]],
  ['corona 24 + engranaje 8 a 90°', [['corona 24', GC], ['engranaje 8', GO]]],
  ['knob + knob a 90°', [['rueda de mando', NE], ['rueda de mando', NE]]],
  // vigas y estructura
  ['viga 5 + viga 5 unidas con 2 pines', [['viga 5', GO], ['viga 5', GO], ['pin', NE], ['pin', NE]]],
  ['viga 9 parada + eje 3 en un agujero', [['viga 9', GO], ['eje 3', NE]]],
  ['viga parada + engranaje 24 + engranaje 8 (reductor)', [['viga 9', GO], ['engranaje 24', GC], ['engranaje 8', GO], ['eje 3', NE], ['eje 3', NE]]],
  ['viga angular 3x5 + viga 5 + pin', [['viga angular 3x5', GO], ['viga 5', GO], ['pin', NE]]],
  ['bloque cruz 1x2 + eje 3 + pin', [['bloque cruz 1x2', GC], ['eje 3', NE], ['pin', NE]]],
  ['bloque cruz doble + eje 5', [['bloque cruz doble', GC], ['eje 5', GC]]],
  ['ladrillo tecnico 1x4 + eje 3 en su agujero', [['tecnico 1x4', GC], ['eje 3', NE]]],
  ['ladrillo tecnico 1x2 + pin', [['tecnico 1x2', GC], ['pin', NE]]],
  ['ladrillo con cruz + eje 3', [['ladrillo con cruz', GC], ['eje 3', NE]]],
  // ruedas
  ['llanta NXT + neumatico', [['llanta nxt', GC], ['neumatico nxt', NE]]],
  ['rueda NXT completa con eje 6', [['llanta nxt', GC], ['neumatico nxt', NE], ['eje 6', NE]]],
  ['rueda chica completa con eje 4', [['llanta chica nxt', GC], ['neumatico chico nxt', NE], ['eje 4', NE]]],
  // electrónica
  ['motor NXT + eje 6 en el eje naranja', [['motor nxt', GC], ['eje 6', NE]]],
  ['motor NXT + rueda completa (motriz)', [['motor nxt', GC], ['llanta nxt', GC], ['neumatico nxt', NE], ['eje 6', NE]]],
  ['motor NXT sujetado a viga 9 con 2 pines', [['motor nxt', GC], ['viga 9', GO], ['pin', NE], ['pin', NE]]],
  ['sensor de contacto + 2 pines + viga 7', [['sensor de contacto', NE], ['viga 7', GO], ['pin', NE], ['pin', NE]]],
  ['sensor ultrasonico + 2 pines + viga 9', [['sensor ultrasonico', GC], ['viga 9', GO], ['pin', NE], ['pin', NE]]],
  ['sensor de luz + viga 5 + pines', [['sensor de luz', GC], ['viga 5', GO], ['pin', NE], ['pin', NE]]],
  ['bloque NXT apoyado sobre 2 vigas 13', [['bloque nxt', GC], ['viga 13', GO], ['viga 13', GO]]],
  ['bloque NXT + motor + motor (layout robot)', [['bloque nxt', GC], ['motor nxt', GC], ['motor nxt', GC]]],
  // ===== RONDA 2: piezas aún sin calibrar y montajes complejos =====
  ['R2: conector recto uniendo eje 3 + eje 3', [['conector recto', NE], ['eje 3', GC], ['eje 3', GC]]],
  ['R2: acople de ejes liso + eje 4 + eje 4', [['acople de ejes liso', GC], ['eje 4', NE], ['eje 4', NE]]],
  ['R2: eje con tope (5.5) + viga 3 + medio buje', [['eje con tope', GO], ['viga 3', GO], ['medio buje', AM]]],
  ['R2: viga 3 con pines clavada en viga 7', [['viga 3 con pines', GC], ['viga 7', GO]]],
  ['R2: viga angular con pines + viga 5', [['viga angular con pines', GC], ['viga 5', GO]]],
  ['R2: brazo de direccion 3 + eje 3', [['brazo de direccion 3', GC], ['eje 3', NE]]],
  ['R2: viga angular 3x5 + viga angular 3x5 (marco en L)', [['viga angular 3x5', GO], ['viga angular 3x5', GO], ['pin', NE], ['pin', NE]]],
  ['R2: viga doble angular 3x7 + pines + viga 9', [['viga doble angular 3x7', GO], ['viga 9', GO], ['pin', NE], ['pin', NE]]],
  ['R2: viga curva 3x5 + pin + viga 5', [['viga curva 3x5', GO], ['viga 5', GO], ['pin', NE]]],
  ['R2: bloque cruz 1x3 + eje 5 + pin', [['bloque cruz 1x3', GC], ['eje 5', GC], ['pin', NE]]],
  ['R2: bloque cruz 2x2 (pin doble) clavado en viga 5', [['bloque cruz 2x2', GC], ['viga 5', GO]]],
  ['R2: pin doble con cruz + viga 3 + eje 3 (de nuevo, con volcado)', [['pin doble con cruz', NE], ['viga 3', GO], ['eje 3', GC]]],
  ['R2: tornillo sin fin + engranaje 24 (verificar distancia exacta)', [['tornillo sin fin', GC], ['engranaje 24', GC], ['eje 3', NE], ['eje 3', NE]]],
  ['R2: conico 20 + conico 12 (verificar distancia exacta)', [['engranaje conico 20', GC], ['engranaje conico 12', BE]]],
  ['R2: sensor de sonido montado en viga 5', [['sensor de sonido', GC], ['viga 5', GO], ['pin', NE], ['pin', NE]]],
  ['R2: sensor de contacto MONTADO (pines en sus agujeros traseros)', [['sensor de contacto', NE], ['viga 7', GO], ['pin', NE], ['pin', NE]]],
  ['R2: sensor ultrasonico MONTADO (pines en sus agujeros)', [['sensor ultrasonico', GC], ['viga 9', GO], ['pin', NE], ['pin', NE]]],
  ['R2: bloque NXT sujetado con pines a 2 vigas volcadas', [['bloque nxt', GC], ['viga 13', GO], ['viga 13', GO], ['pin', NE], ['pin', NE]]],
  ['R2: motor espejado (rotar 180) con su rueda', [['motor nxt', GC], ['llanta nxt', GC], ['neumatico nxt', NE], ['eje 6', NE]]],
  ['R2: reductor completo entre 2 vigas paradas', [['viga 9', GO], ['viga 9', GO], ['eje 6', NE], ['eje 4', NE], ['engranaje 24', GC], ['engranaje 40', GO], ['rueda de mando', NE]]],
  ['R2: tren 8-24-40 cada uno en su eje', [['engranaje 8', GO], ['engranaje 24', GC], ['engranaje 40', GO], ['eje 3', NE], ['eje 3', NE], ['eje 3', NE]]],
  ['R2: llanta mediana clasica + neumatico + placa con pernos', [['placa con ruedas 2x2', GO], ['llanta mediana', GC], ['neumatico mediano', NE]]],
];

// ============================================================
// Escena 3D
// ============================================================
const lienzo = document.getElementById('lienzo');
const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio || 1);

const escena = new THREE.Scene();
escena.background = new THREE.Color(0xf2f2ee);
escena.add(new THREE.AmbientLight(0xffffff, 1.15));
const luz1 = new THREE.DirectionalLight(0xffffff, 1.6);
luz1.position.set(-160, 260, 220);
escena.add(luz1);
const luz2 = new THREE.DirectionalLight(0xffffff, 0.7);
luz2.position.set(180, 120, -160);
escena.add(luz2);

const camara = new THREE.PerspectiveCamera(32, 1, 1, 40000);
camara.position.set(160, 140, 220);
const controles = new OrbitControls(camara, lienzo);
controles.target.set(40, 20, 0);
controles.enableDamping = true;

// contenedor en coordenadas LDraw (y hacia abajo): se da vuelta entero
const contenedor = new THREE.Group();
contenedor.rotation.x = Math.PI;
escena.add(contenedor);

// piso: cuadrícula de studs (20 LDU) + ejes de referencia
const grilla = new THREE.GridHelper(400, 20, 0xbbaa66, 0xd8d4c8);
escena.add(grilla);
escena.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0.5, 0), 90, 0xc04040, 14, 7));   // +X
escena.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0.5, 0), 90, 0x4060c0, 14, 7)); // +Z LDraw
const cajaSel = new THREE.Box3Helper(new THREE.Box3(), 0xd0a000);
cajaSel.visible = false;
escena.add(cajaSel);

const loader = new LDrawLoader();
loader.setPartsLibraryPath(RUTA_LDRAW);
loader.smoothNormals = true;
const listoMateriales = loader.preloadMaterials(RUTA_LDRAW + 'LDConfig.ldr');

const cajas = new Map();   // dat -> Box3 (sin transformar)
const grupos = new Map();  // uid de pieza -> THREE.Group en escena

function parsear(texto) {
  return new Promise((res) => loader.parse(texto, res));
}

async function grupoDePieza(p) {
  await listoMateriales;
  const info = piezaPorClave(p.pieza);
  if (!info) return null;
  const g = await parsear(`1 ${p.color} 0 0 0 1 0 0 0 1 0 0 0 1 ${info.dat}.dat`);
  if (!cajas.has(info.dat)) {
    const limpio = await parsear(`1 16 0 0 0 1 0 0 0 1 0 0 0 1 ${info.dat}.dat`);
    cajas.set(info.dat, new THREE.Box3().setFromObject(limpio));
  }
  return g;
}

function sincronizarTransformacion(p) {
  const g = grupos.get(p.uid);
  if (!g) return;
  g.position.set(p.pos[0], p.pos[1], p.pos[2]);
  const m = p.mat;
  const m4 = new THREE.Matrix4().set(
    m[0], m[1], m[2], 0,
    m[3], m[4], m[5], 0,
    m[6], m[7], m[8], 0,
    0, 0, 0, 1
  );
  g.setRotationFromMatrix(m4);
  g.updateMatrixWorld(true);
}

async function reconstruirEscena() {
  for (const g of grupos.values()) contenedor.remove(g);
  grupos.clear();
  const c = casoActual();
  if (!c) { refrescarSeleccion(); return; }
  for (const p of c.piezas) {
    const g = await grupoDePieza(p);
    if (!g) continue;
    grupos.set(p.uid, g);
    contenedor.add(g);
    sincronizarTransformacion(p);
  }
  refrescarSeleccion();
}

function refrescarSeleccion() {
  const p = piezaActual();
  const g = p ? grupos.get(p.uid) : null;
  if (g) {
    cajaSel.box.setFromObject(g);
    cajaSel.visible = true;
  } else {
    cajaSel.visible = false;
  }
  actualizarHud();
  pintarListaPiezas();
}

function actualizarHud() {
  const hud = document.getElementById('hud');
  const p = piezaActual();
  if (!p) { hud.textContent = casoActual() ? 'Elegí o agregá una pieza' : 'Creá o elegí un caso'; return; }
  const info = piezaPorClave(p.pieza);
  const caja = info ? cajas.get(info.dat) : null;
  const st = (v) => Math.round(v / 20 * 1000) / 1000;
  const pl = (v) => Math.round(-v / 8 * 1000) / 1000;
  const mm = (v) => Math.round(v * 0.4 * 100) / 100;
  const sist = caja ? lineaSistema(p, caja) : null;
  hud.textContent =
    `${info ? info.nombre : p.pieza}\n` +
    `x ${st(p.pos[0])} st (${mm(p.pos[0])} mm)   z ${st(p.pos[2])} st (${mm(p.pos[2])} mm)   altura ${pl(p.pos[1])} placas (${mm(-p.pos[1])} mm)\n` +
    `matriz ${p.mat.map(v => Math.round(v * 100) / 100).join(' ')}\n` +
    (sist ? `sistema: ${sist}` : '⚠ orientación NO representable en el sistema (rotación fina o eje no soportado)');
}

// bucle de dibujo
function tamano() {
  const w = lienzo.clientWidth || lienzo.parentElement.clientWidth;
  const h = 560;
  if (lienzo.width !== Math.floor(w * (window.devicePixelRatio || 1))) {
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
  }
}
function animar() {
  requestAnimationFrame(animar);
  tamano();
  controles.update();
  renderer.render(escena, camara);
}
animar();

// selección con clic (si no se arrastró)
let clic0 = null;
lienzo.addEventListener('pointerdown', (e) => { clic0 = [e.clientX, e.clientY]; });
lienzo.addEventListener('pointerup', (e) => {
  if (!clic0 || Math.hypot(e.clientX - clic0[0], e.clientY - clic0[1]) > 5) return;
  const rect = lienzo.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, camara);
  const c = casoActual();
  if (!c) return;
  let mejor = null;
  for (const p of c.piezas) {
    const g = grupos.get(p.uid);
    if (!g) continue;
    const hits = ray.intersectObject(g, true);
    if (hits.length && (!mejor || hits[0].distance < mejor.dist)) mejor = { p, dist: hits[0].distance };
  }
  if (mejor) {
    iPieza = c.piezas.indexOf(mejor.p);
    refrescarSeleccion();
  }
});

// ============================================================
// Operaciones sobre la pieza seleccionada
// ============================================================
function mover(eje, signo) {
  const p = piezaActual();
  if (!p) return;
  const paso = eje === 'y'
    ? parseFloat(document.getElementById('pasoY').value)
    : parseFloat(document.getElementById('pasoXZ').value);
  const i = eje === 'x' ? 0 : eje === 'y' ? 1 : 2;
  // en LDraw la altura crece hacia abajo: "subir" resta
  p.pos[i] += (eje === 'y' ? -signo : signo) * paso;
  p.pos[i] = Math.round(p.pos[i] * 1000) / 1000;
  sincronizarTransformacion(p);
  refrescarSeleccion();
  guardar();
}

function girar(eje, signo) {
  const p = piezaActual();
  if (!p) return;
  const g = parseFloat(document.getElementById('pasoGiro').value) * signo;
  // giro en coordenadas de pantalla: Y de LDraw apunta hacia abajo, así que
  // el sentido se invierte para que ↻ se vea horario en pantalla
  const R = rotacionEje(eje, eje === 'y' ? -g : g);
  p.mat = multiplicar(R, p.mat).map(v => Math.round(v * 100000) / 100000);
  sincronizarTransformacion(p);
  refrescarSeleccion();
  guardar();
}

function snapCuadricula() {
  const p = piezaActual();
  if (!p) return;
  p.pos[0] = Math.round(p.pos[0] / 10) * 10;
  p.pos[2] = Math.round(p.pos[2] / 10) * 10;
  p.pos[1] = Math.round(p.pos[1] / 4) * 4;
  sincronizarTransformacion(p);
  refrescarSeleccion();
  guardar();
}

function snapPiso() {
  const p = piezaActual();
  if (!p) return;
  const info = piezaPorClave(p.pieza);
  const caja = info ? cajas.get(info.dat) : null;
  if (!caja) return;
  const r = cajaTransformada(caja, p.mat);
  p.pos[1] = -r.maxY;
  sincronizarTransformacion(p);
  refrescarSeleccion();
  guardar();
}

function snapCentro() {
  const c = casoActual();
  const p = piezaActual();
  if (!c || !p || iPieza < 1) { toast('Centrar necesita una pieza anterior en la lista.'); return; }
  const ref = c.piezas[iPieza - 1];
  p.pos = [...ref.pos];
  sincronizarTransformacion(p);
  refrescarSeleccion();
  guardar();
  toast('Origen centrado con la pieza anterior — ajustá desde ahí.');
}

function resetOrientacion() {
  const p = piezaActual();
  if (!p) return;
  p.mat = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  sincronizarTransformacion(p);
  refrescarSeleccion();
  guardar();
}

// ============================================================
// Interfaz: casos y piezas
// ============================================================
function pintarListaCasos() {
  const cont = document.getElementById('listaCasos');
  cont.innerHTML = '';
  casos.forEach((c, i) => {
    const div = document.createElement('div');
    div.className = 'calib__caso' + (i === iCaso ? ' calib__caso--actual' : '');
    const est = document.createElement('span');
    est.className = 'calib__estado calib__estado--' + c.estado;
    est.textContent = c.estado;
    const tit = document.createElement('span');
    tit.textContent = (i + 1) + '. ' + (c.titulo || '(sin título)');
    tit.style.flex = '1';
    div.append(tit, est);
    div.addEventListener('click', () => elegirCaso(i));
    cont.appendChild(div);
  });
}

function pintarCasoActual() {
  const c = casoActual();
  document.getElementById('casoTitulo').value = c ? c.titulo : '';
  document.getElementById('casoEstado').value = c ? c.estado : 'pendiente';
  document.getElementById('casoNotas').value = c ? c.notas : '';
}

function pintarListaPiezas() {
  const cont = document.getElementById('listaPiezas');
  cont.innerHTML = '';
  const c = casoActual();
  if (!c) return;
  c.piezas.forEach((p, j) => {
    const info = piezaPorClave(p.pieza);
    const col = colorPorCodigoLdraw(p.color);
    const div = document.createElement('div');
    div.className = 'calib__pieza' + (j === iPieza ? ' calib__pieza--sel' : '');
    div.innerHTML = `<span class="calib__chip" style="background:${col ? col.hex : '#888'}"></span>` +
      `<span>${j + 1}. ${info ? info.nombre : p.pieza}</span>`;
    div.addEventListener('click', () => { iPieza = j; refrescarSeleccion(); });
    cont.appendChild(div);
  });
}

function elegirCaso(i) {
  iCaso = i;
  iPieza = casoActual() && casoActual().piezas.length ? 0 : -1;
  pintarListaCasos();
  pintarCasoActual();
  reconstruirEscena();
  guardar();
}

function nuevaPiezaColocada(clave, color, offsetX) {
  return { uid: 'c' + (uid++), pieza: clave, color, pos: [offsetX, 0, 0], mat: [1, 0, 0, 0, 1, 0, 0, 0, 1] };
}

async function agregarCaso(titulo, listaPiezas) {
  const c = { titulo, estado: 'pendiente', notas: '', piezas: [] };
  let x = 0;
  for (const [clave, color] of listaPiezas) {
    const p = nuevaPiezaColocada(clave, color, x);
    c.piezas.push(p);
    x += 70;
  }
  casos.push(c);
  return c;
}

async function apoyarTodasEnElPiso(c) {
  // al crear un caso las piezas caen al piso para que ninguna quede enterrada
  for (const p of c.piezas) {
    const info = piezaPorClave(p.pieza);
    if (!info) continue;
    if (!cajas.has(info.dat)) await grupoDePieza(p).then(g => { /* medida al cargar */ });
    const caja = cajas.get(info.dat);
    if (caja) p.pos[1] = -cajaTransformada(caja, p.mat).maxY;
  }
}

// ============================================================
// Exportación / importación del análisis
// ============================================================
function numero(v) {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}

function exportarTexto() {
  const L = [];
  L.push('# CALIBRACION LEGO NXT v1');
  L.push('# exportado: ' + new Date().toISOString());
  L.push('# unidades: pos en LDU (1 stud = 20 LDU = 8 mm; 1 placa = 8 LDU = 3.2 mm; 1 mm = 2.5 LDU)');
  L.push('# matriz: 9 numeros fila-mayor, convencion LDraw (y crece hacia abajo)');
  L.push('# "sistema:" = linea equivalente del formato de guias (si la orientacion es representable)');
  L.push('# "relacion j-i" = resta de origenes (pieza j menos pieza i), en LDU');
  L.push('');
  for (const c of casos) {
    L.push(`=== CASO: ${c.titulo || '(sin titulo)'} ===`);
    L.push('estado: ' + c.estado);
    if (c.notas.trim()) L.push('notas: ' + c.notas.replace(/\s*\n\s*/g, ' | '));
    c.piezas.forEach((p, j) => {
      const info = piezaPorClave(p.pieza);
      const col = colorPorCodigoLdraw(p.color);
      const caja = info ? cajas.get(info.dat) : null;
      const sist = caja ? lineaSistema(p, caja) : null;
      L.push(
        `pieza ${j + 1}: ${p.pieza} | ${col ? col.clave : p.color}` +
        ` | pos: ${p.pos.map(numero).join(' ')}` +
        ` | matriz: ${p.mat.map(numero).join(' ')}` +
        ` | sistema: ${sist || 'NO REPRESENTABLE'}`
      );
    });
    for (let j = 1; j < c.piezas.length; j++) {
      const a = c.piezas[j - 1], b = c.piezas[j];
      L.push(`relacion ${j + 1}-${j}: dx=${numero(b.pos[0] - a.pos[0])} dy=${numero(b.pos[1] - a.pos[1])} dz=${numero(b.pos[2] - a.pos[2])}`);
    }
    L.push('ldraw:');
    for (const p of c.piezas) {
      const info = piezaPorClave(p.pieza);
      if (!info) continue;
      L.push(`1 ${p.color} ${p.pos.map(numero).join(' ')} ${p.mat.map(numero).join(' ')} ${info.dat}.dat`);
    }
    L.push('');
  }
  return L.join('\n');
}

function importarTexto(texto) {
  const nuevos = [];
  let caso = null;
  let importadas = 0, errores = 0;
  for (const cruda of String(texto || '').split(/\r?\n/)) {
    const linea = cruda.trim();
    const mCaso = linea.match(/^===\s*CASO:\s*(.*?)\s*===$/i);
    if (mCaso) { caso = { titulo: mCaso[1], estado: 'pendiente', notas: '', piezas: [] }; nuevos.push(caso); continue; }
    if (!caso) continue;
    const mEstado = linea.match(/^estado:\s*(\w+)/i);
    if (mEstado) { caso.estado = mEstado[1].toLowerCase(); continue; }
    const mNotas = linea.match(/^notas:\s*(.*)$/i);
    if (mNotas) { caso.notas = mNotas[1]; continue; }
    const mPieza = linea.match(/^pieza\s+\d+:\s*(.*)$/i);
    if (mPieza) {
      const partes = mPieza[1].split('|').map(s => s.trim());
      const info = buscarPieza(partes[0]);
      const col = buscarColor(partes[1] || '');
      const mPos = (partes.find(s => s.startsWith('pos:')) || '').match(/pos:\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/);
      const mMat = (partes.find(s => s.startsWith('matriz:')) || '').match(/matriz:\s*((?:-?[\d.]+\s*){9})/);
      if (info && mPos && mMat) {
        nuevosPieza(caso, info.clave, col ? col.codigo : 71,
          [parseFloat(mPos[1]), parseFloat(mPos[2]), parseFloat(mPos[3])],
          mMat[1].trim().split(/\s+/).map(Number));
        importadas++;
      } else errores++;
    }
  }
  function nuevosPieza(c, clave, color, pos, mat) {
    c.piezas.push({ uid: 'c' + (uid++), pieza: clave, color, pos, mat });
  }
  if (!nuevos.length) { toast('No se encontraron casos en el texto.'); return; }
  casos = casos.concat(nuevos);
  pintarListaCasos();
  guardar();
  toast(`Importados ${nuevos.length} caso(s), ${importadas} pieza(s)` + (errores ? `, ${errores} línea(s) con problemas.` : '.'));
}

function descargar(nombre, texto) {
  const blob = new Blob([texto], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

// ============================================================
// Init
// ============================================================
function init() {
  // selects de pieza y color
  const selP = document.getElementById('selPieza');
  selP.innerHTML = CATEGORIAS.map(cat => {
    const lista = PIEZAS.filter(p => p.cat === cat);
    if (!lista.length) return '';
    return `<optgroup label="${cat}">` + lista.map(p => `<option value="${p.clave}">${p.nombre}</option>`).join('') + '</optgroup>';
  }).join('');
  selP.value = 'eje 3';
  const selC = document.getElementById('selColor');
  selC.innerHTML = COLORES.map(c => `<option value="${c.codigo}">${c.nombre}</option>`).join('');
  selC.value = '71';

  document.getElementById('btnPickerCalib').addEventListener('click', () => {
    abrirSelectorPieza({
      actual: selP.value,
      onElegir: (clave) => { selP.value = clave; }
    });
  });

  cargar();
  pintarListaCasos();
  pintarCasoActual();
  if (iCaso >= 0) elegirCaso(iCaso);

  document.getElementById('btnCasosSugeridos').addEventListener('click', async () => {
    for (const [titulo, piezas] of SUGERIDOS) {
      if (casos.some(c => c.titulo === titulo)) continue; // sin duplicar
      const c = await agregarCaso(titulo, piezas);
      await apoyarTodasEnElPiso(c);
    }
    pintarListaCasos();
    guardar();
    toast('Combinaciones sugeridas cargadas: ' + casos.length + ' casos en total.');
    if (iCaso < 0 && casos.length) elegirCaso(0);
  });

  document.getElementById('btnCasoNuevo').addEventListener('click', async () => {
    await agregarCaso('Caso nuevo', []);
    elegirCaso(casos.length - 1);
  });

  document.getElementById('btnCasoEliminar').addEventListener('click', () => {
    if (iCaso < 0) return;
    if (!confirm('¿Eliminar este caso?')) return;
    casos.splice(iCaso, 1);
    elegirCaso(Math.min(iCaso, casos.length - 1));
  });

  document.getElementById('casoTitulo').addEventListener('input', e => { const c = casoActual(); if (c) { c.titulo = e.target.value; pintarListaCasos(); guardar(); } });
  document.getElementById('casoEstado').addEventListener('change', e => { const c = casoActual(); if (c) { c.estado = e.target.value; pintarListaCasos(); guardar(); } });
  document.getElementById('casoNotas').addEventListener('input', e => { const c = casoActual(); if (c) { c.notas = e.target.value; guardar(); } });

  document.getElementById('btnAgregarPieza').addEventListener('click', async () => {
    const c = casoActual();
    if (!c) { toast('Primero creá o elegí un caso.'); return; }
    const p = nuevaPiezaColocada(selP.value, Number(selC.value), c.piezas.length * 70);
    c.piezas.push(p);
    const g = await grupoDePieza(p);
    if (g) {
      grupos.set(p.uid, g);
      contenedor.add(g);
      const caja = cajas.get(piezaPorClave(p.pieza).dat);
      if (caja) p.pos[1] = -cajaTransformada(caja, p.mat).maxY;
      sincronizarTransformacion(p);
    }
    iPieza = c.piezas.length - 1;
    refrescarSeleccion();
    guardar();
  });

  document.getElementById('btnDuplicarPieza').addEventListener('click', async () => {
    const c = casoActual(), p = piezaActual();
    if (!c || !p) return;
    const copia = { ...p, uid: 'c' + (uid++), pos: [p.pos[0] + 40, p.pos[1], p.pos[2]], mat: [...p.mat] };
    c.piezas.splice(iPieza + 1, 0, copia);
    const g = await grupoDePieza(copia);
    if (g) { grupos.set(copia.uid, g); contenedor.add(g); sincronizarTransformacion(copia); }
    iPieza++;
    refrescarSeleccion();
    guardar();
  });

  document.getElementById('btnQuitarPieza').addEventListener('click', () => {
    const c = casoActual();
    if (!c || iPieza < 0) return;
    const p = c.piezas.splice(iPieza, 1)[0];
    const g = grupos.get(p.uid);
    if (g) contenedor.remove(g);
    grupos.delete(p.uid);
    iPieza = Math.min(iPieza, c.piezas.length - 1);
    refrescarSeleccion();
    guardar();
  });

  document.querySelectorAll('[data-mover]').forEach(b => b.addEventListener('click', () => {
    const [signo, eje] = [b.dataset.mover[0] === '+' ? 1 : -1, b.dataset.mover[1]];
    mover(eje, signo);
  }));
  document.querySelectorAll('[data-girar]').forEach(b => b.addEventListener('click', () => {
    girar(b.dataset.girar[0], b.dataset.girar[1] === '+' ? 1 : -1);
  }));
  document.getElementById('btnSnapStud').addEventListener('click', snapCuadricula);
  document.getElementById('btnSnapPiso').addEventListener('click', snapPiso);
  document.getElementById('btnSnapCentro').addEventListener('click', snapCentro);
  document.getElementById('btnResetOrientacion').addEventListener('click', resetOrientacion);

  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
    const mapa = {
      ArrowLeft: () => mover('x', -1), ArrowRight: () => mover('x', 1),
      ArrowUp: () => mover('z', -1), ArrowDown: () => mover('z', 1),
      PageUp: () => mover('y', 1), PageDown: () => mover('y', -1),
      q: () => girar('y', 1), e: () => girar('y', -1),
      w: () => girar('x', 1), s: () => girar('x', -1),
      a: () => girar('z', 1), d: () => girar('z', -1),
      Delete: () => document.getElementById('btnQuitarPieza').click(),
    };
    const fn = mapa[e.key];
    if (fn) { e.preventDefault(); fn(); }
  });

  document.getElementById('btnExportar').addEventListener('click', () => {
    descargar('calibracion-lego-nxt.txt', exportarTexto());
  });
  document.getElementById('btnCopiarAnalisis').addEventListener('click', () => {
    navigator.clipboard.writeText(exportarTexto()).then(() => toast('Análisis copiado.'));
  });
  document.getElementById('btnImportar').addEventListener('click', () => {
    importarTexto(document.getElementById('taImportar').value);
  });
}

init();

// API para automatización y depuración (la usa la IA de desarrollo)
window.CalibracionLego = { exportar: exportarTexto, importar: importarTexto };
