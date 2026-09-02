// Arenero de realidad aumentada (AR Sandbox): el Kinect mira la arena desde arriba, la página
// convierte la profundidad en un mapa topográfico (colores por altura, curvas de nivel y
// sombreado), simula agua que corre por los valles y llueve cuando se pone la mano encima, y
// manda la imagen a una ventana aparte para el proyector, con calibración de esquinas.
// Inspirado en el AR Sandbox de UC Davis KeckCAVES (Oliver Kreylos), reescrito para el navegador.

import * as N from './escaneo3d-nucleo.js';
import { KinectV1, estadoWebUSB, explicarError, MODELOS } from './kinect-usb.js';
import { PuenteKinect } from './kinect-puente-cliente.js';

const $ = id => document.getElementById(id);
const W = N.INTR.ancho, H = N.INTR.alto;
const GC = 4, GW = W / GC, GH = H / GC; // grilla del agua: celdas de 4×4 píxeles

function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('toast--visible');
  clearTimeout(toast._timer); toast._timer = setTimeout(() => t.classList.remove('toast--visible'), 4000);
}

const estado = {
  fuente: null, tipo: null,
  crudo16: new Uint16Array(W * H),
  ultimoMm: null,
  suave: new Float32Array(W * H),     // profundidad filtrada en el tiempo (mm)
  base: null,                          // profundidad de referencia por píxel (arena plana calibrada)
  plano: null,                         // plano de la arena, si no hay calibración
  altura: new Float32Array(W * H),     // altura sobre la base (mm, positiva hacia arriba)
  mano: new Uint8Array(W * H),
  terreno: new Float32Array(GW * GH),  // altura por celda del agua
  agua: new Float32Array(GW * GH),
  flujo: new Float32Array(GW * GH * 4),
  region: { x0: 40, y0: 30, x1: 600, y1: 450 },
  congelado: false,
  lluviaGlobal: 0,
  proyector: null,
  esquinas: [[0.02, 0.02], [0.98, 0.02], [0.98, 0.98], [0.02, 0.98]],
  esquinaActiva: 0,
  grilla: false,
  ultimoEnvio: 0
};

// ============================================================
// Ajustes (con memoria en el navegador)
// ============================================================

const AJUSTES = ['optEscala', 'optNivelMar', 'optRango', 'optIntervalo', 'optCurvas', 'optSombra', 'optAgua', 'optLluvia', 'optEvaporacion', 'optMano', 'optSuavizado', 'optZmin', 'optZmax'];
function leer(id) { const el = $(id); return el.type === 'checkbox' ? el.checked : +el.value; }
function guardarAjustes() {
  const o = {}; for (const id of AJUSTES) o[id] = leer(id);
  o.region = estado.region; o.esquinas = estado.esquinas;
  try { localStorage.setItem('arenero-ajustes', JSON.stringify(o)); } catch (e) { /* nada */ }
}
function cargarAjustes() {
  try {
    const o = JSON.parse(localStorage.getItem('arenero-ajustes') || 'null'); if (!o) return;
    for (const id of AJUSTES) { const el = $(id); if (!el || o[id] === undefined) continue; if (el.type === 'checkbox') el.checked = !!o[id]; else el.value = o[id]; }
    if (o.region) estado.region = o.region;
    if (o.esquinas) estado.esquinas = o.esquinas;
  } catch (e) { /* nada */ }
}
for (const id of AJUSTES) $(id).addEventListener('input', () => { actualizarEtiquetas(); guardarAjustes(); });
function actualizarEtiquetas() {
  $('valNivelMar').textContent = leer('optNivelMar') + ' mm';
  $('valRango').textContent = leer('optRango') + ' mm';
  $('valIntervalo').textContent = leer('optIntervalo') + ' mm';
  $('valMano').textContent = leer('optMano') + ' mm';
  $('valZmin').textContent = leer('optZmin') + ' mm';
  $('valZmax').textContent = leer('optZmax') + ' mm';
}

// ============================================================
// Fuentes: Kinect directo, puente local, demostración
// ============================================================

class SimuladorArenero {
  constructor() { this.corriendo = false; this.t = 0; this.modelo = 'Arenero de demostración (sin Kinect)'; this.estadisticas = {}; }
  async iniciarProfundidad(onCuadro) {
    this.corriendo = true;
    const paso = () => {
      if (!this.corriendo) return;
      this.t += 0.1;
      const mm = new Float32Array(W * H);
      const mx = 320 + 120 * Math.cos(this.t * 0.5), my = 240 + 80 * Math.sin(this.t * 0.5);
      const manoVisible = Math.sin(this.t * 0.25) > 0.3;
      for (let v = 0; v < H; v++) for (let u = 0; u < W; u++) {
        const x = u - 320, y = v - 240;
        let h = 55 * Math.sin(u / 70) * Math.cos(v / 55) + 35 * Math.sin(u / 31 + v / 47) + 90 * Math.exp(-((x - 60) ** 2 + (y + 40) ** 2) / 9000) - 40 * Math.exp(-((x + 120) ** 2 + (y - 60) ** 2) / 12000);
        let z = 950 - h * (1 + 0.15 * (v / H)); // la base queda inclinada como una cámara real
        if (manoVisible) { const d2 = (u - mx) ** 2 + (v - my) ** 2; if (d2 < 2200) z = 950 - 200 - h; }
        mm[v * W + u] = z + (Math.random() - 0.5) * 4;
      }
      onCuadro({ mm });
      this.timer = setTimeout(paso, 100);
    };
    paso();
  }
  async detener() { this.corriendo = false; clearTimeout(this.timer); }
  async cerrar() { await this.detener(); }
}

function mostrarEstado(clase, titulo, detalle) {
  $('estadoKinect').className = 'kin-estado' + (clase ? ' kin-estado--' + clase : '');
  $('estadoTitulo').textContent = titulo; $('estadoDetalle').textContent = detalle || '';
}

async function usarFuente(fuente, tipo) {
  if (estado.fuente) await desconectar();
  estado.fuente = fuente; estado.tipo = tipo;
  fuente.onError = (e) => { informarError(e); desconectar(); };
  await fuente.iniciarProfundidad(recibirCuadro);
  $('btnDesconectar').style.display = '';
  $('seccionArenero').style.display = '';
  mostrarEstado(tipo === 'demo' ? 'demo' : 'conectado', tipo === 'demo' ? 'Arenero de demostración' : (tipo === 'puente' ? 'Puente local conectado' : 'Kinect conectado: ' + fuente.modelo), tipo === 'demo' ? 'Un relieve inventado con una mano que pasa por encima de vez en cuando.' : 'Esperando cuadros…');
  $('seccionArenero').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function desconectar() {
  const f = estado.fuente; estado.fuente = null;
  if (f) { try { await f.cerrar(); } catch (e) { /* nada */ } }
  $('btnDesconectar').style.display = 'none';
  mostrarEstado(null, 'Sin Kinect conectado', 'Conectalo, usá el puente local o probá la demostración.');
}
function informarError(err) {
  console.error(err);
  if (err.fase === 'puente') { mostrarEstado('error', 'No se pudo conectar con el puente local', err.message + '. Corré kinect-puente.py en esta computadora (los pasos están en la página de escaneo 3D).'); return; }
  const ex = explicarError(err.original || err, err.fase || 'abrir');
  mostrarEstado('error', ex.titulo, ex.detalle + ' La guía de drivers está en la página «Escaneo 3D con Kinect».');
}
$('btnConectar').addEventListener('click', async () => {
  const w = estadoWebUSB();
  if (!w.disponible) { mostrarEstado('error', 'Este navegador no puede conectar el Kinect', w.razon); return; }
  let dispositivo;
  try { dispositivo = await KinectV1.pedirPermiso(); } catch (e) { informarError(Object.assign(e, { fase: 'pedir' })); return; }
  const k = new KinectV1();
  try { mostrarEstado(null, 'Conectando…', ''); await k.abrir(dispositivo); await usarFuente(k, 'kinect'); }
  catch (e) { try { await k.cerrar(); } catch (e2) { /* nada */ } informarError(e); }
});
$('btnPuente').addEventListener('click', async () => {
  const p = new PuenteKinect();
  try { await usarFuente(p, 'puente'); } catch (e) { estado.fuente = null; informarError(e); }
});
$('btnDemo').addEventListener('click', () => usarFuente(new SimuladorArenero(), 'demo'));
$('btnDesconectar').addEventListener('click', desconectar);
(async () => {
  const w = estadoWebUSB();
  if (!w.disponible) { mostrarEstado(null, 'Este navegador no puede conectar el Kinect', w.razon + ' Podés usar el puente local o la demostración.'); return; }
  const lista = await KinectV1.autorizados();
  if (lista.length) { const k = new KinectV1(); try { await k.abrir(lista[0]); await usarFuente(k, 'kinect'); } catch (e) { informarError(e); } }
  navigator.usb.addEventListener('connect', async (ev) => {
    if (estado.fuente || ev.device.vendorId !== 0x045e || !MODELOS[ev.device.productId]) return;
    await new Promise(r => setTimeout(r, 2000));
    const k = new KinectV1(); try { await k.abrir(ev.device); await usarFuente(k, 'kinect'); } catch (e) { informarError(e); }
  });
})();

// ============================================================
// Cuadros: siempre el último recibido, una vez por cuadro de pantalla
// ============================================================

let pendiente = null, programado = false, recibidos = 0, dibujados = 0, tFps = performance.now();

function recibirCuadro(cuadro) {
  recibidos++;
  pendiente = cuadro.mm ? { mm: cuadro.mm } : { crudo11: cuadro.crudo11.slice ? cuadro.crudo11.slice() : Uint8Array.from(cuadro.crudo11) };
  if (!programado) { programado = true; requestAnimationFrame(procesar); }
}

function procesar() {
  programado = false;
  const c = pendiente; pendiente = null;
  if (!c) return;
  let mm;
  if (c.mm) mm = c.mm; else { N.desempaquetar11(c.crudo11, estado.crudo16); mm = N.crudoAmapa(estado.crudo16); }
  estado.ultimoMm = mm;
  dibujados++;
  const ahora = performance.now();
  if (ahora - tFps > 1000) {
    $('estadoDetalle').textContent = `${(recibidos * 1000 / (ahora - tFps)).toFixed(0)} cuadros/s del sensor · ${(dibujados * 1000 / (ahora - tFps)).toFixed(0)} en pantalla`;
    recibidos = 0; dibujados = 0; tFps = ahora;
  }
  if (estado.calibrando) { estado.calibrando.cuadros.push(Float32Array.from(mm)); $('estadoBarra').textContent = `calibrando ${estado.calibrando.cuadros.length}/${estado.calibrando.total}…`; if (estado.calibrando.cuadros.length >= estado.calibrando.total) terminarCalibracion(); }
  if (!estado.base && !estado.plano && ahora - (estado.ultimoPlano || 0) > 1500) { estado.ultimoPlano = ahora; detectarPlano(mm); }
  actualizarTerreno(mm);
  if (leer('optAgua')) { simularAgua(); simularAgua(); }
  dibujar();
  enviarAlProyector();
}

// ============================================================
// Base: arena plana calibrada o plano automático
// ============================================================

function detectarPlano(mm) {
  const r = estado.region;
  const pts = N.puntosDeMapa(mm, { paso: 4, zmin: leer('optZmin'), zmax: leer('optZmax'), region: { x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 } });
  const plano = N.detectarPlano(pts, { umbral: 10 });
  if (!plano) return;
  estado.plano = plano;
  estado.base = new Float32Array(W * H);
  const { fx, fy, cx, cy } = N.INTR;
  for (let v = 0; v < H; v++) for (let u = 0; u < W; u++) {
    const den = plano.n[0] * (u - cx) / fx + plano.n[1] * (v - cy) / fy + plano.n[2];
    estado.base[v * W + u] = Math.abs(den) > 1e-6 ? -plano.d / den : 0;
  }
  estado.baseTipo = 'plano';
  $('notaBase').textContent = 'Base: plano ajustado automáticamente a la arena. Para más precisión, aplaná la arena y usá «Calibrar arena plana».';
}

function calibrarBase() {
  if (!estado.ultimoMm) { toast('Todavía no llegan cuadros'); return; }
  estado.calibrando = { total: 30, cuadros: [] };
  toast('Calibrando: aplaná la arena y no pongas nada encima durante 3 segundos');
}
function terminarCalibracion() {
  const z = N.medianaDeCuadros(estado.calibrando.cuadros);
  estado.calibrando = null;
  // rellenar píxeles sin dato con el plano
  const pts = N.puntosDeMapa(z, { paso: 4, zmin: leer('optZmin'), zmax: leer('optZmax'), region: estado.region });
  const plano = N.detectarPlano(pts, { umbral: 10 });
  const base = new Float32Array(W * H);
  const { fx, fy, cx, cy } = N.INTR;
  for (let v = 0; v < H; v++) for (let u = 0; u < W; u++) {
    const i = v * W + u;
    if (z[i] > 0) base[i] = z[i];
    else if (plano) { const den = plano.n[0] * (u - cx) / fx + plano.n[1] * (v - cy) / fy + plano.n[2]; base[i] = Math.abs(den) > 1e-6 ? -plano.d / den : 0; }
  }
  estado.base = base; estado.plano = plano; estado.baseTipo = 'arena';
  estado.agua.fill(0);
  $('estadoBarra').textContent = 'base calibrada con la arena plana';
  $('notaBase').textContent = 'Base: arena plana calibrada píxel a píxel. Lo que agregues sale como montaña; lo que saques, como valle o mar.';
  toast('Arena calibrada: ahora modelá');
}

// ============================================================
// Terreno, manos y agua
// ============================================================

function actualizarTerreno(mm) {
  const { suave, base, altura, mano, terreno, region } = estado;
  if (!base) return;
  const alpha = leer('optSuavizado');
  const umbralMano = leer('optMano');
  const zmin = leer('optZmin'), zmax = leer('optZmax');
  for (let v = region.y0; v < region.y1; v++) for (let u = region.x0; u < region.x1; u++) {
    const i = v * W + u;
    const z = mm[i];
    if (!(z > 0) || z < zmin || z > zmax) { mano[i] = 0; continue; }
    const h = base[i] - z;
    if (h > umbralMano) { mano[i] = 1; continue; }   // una mano (o un brazo) por encima: no es arena
    mano[i] = 0;
    if (estado.congelado) continue;
    suave[i] = suave[i] ? suave[i] + alpha * (z - suave[i]) : z;
    altura[i] = base[i] - suave[i];
  }
  // terreno por celda (promedio del bloque) y lluvia bajo las manos
  const lluvia = leer('optLluvia');
  const aguaOn = leer('optAgua');
  const gx0 = region.x0 / GC | 0, gx1 = region.x1 / GC | 0, gy0 = region.y0 / GC | 0, gy1 = region.y1 / GC | 0;
  for (let gy = gy0; gy < gy1; gy++) for (let gx = gx0; gx < gx1; gx++) {
    let s = 0, c = 0, m = 0;
    for (let dv = 0; dv < GC; dv++) for (let du = 0; du < GC; du++) { const i = (gy * GC + dv) * W + gx * GC + du; if (mano[i]) m++; s += altura[i]; c++; }
    const g = gy * GW + gx;
    terreno[g] = s / c;
    if (aguaOn && m > 4) estado.agua[g] += lluvia * 0.15 * m / (GC * GC);
    if (aguaOn && estado.lluviaGlobal > 0) estado.agua[g] += lluvia * 0.05;
  }
  if (estado.lluviaGlobal > 0) estado.lluviaGlobal--;
}

// Modelo de tuberías simplificado: el agua baja hacia las celdas vecinas más bajas.
function simularAgua() {
  const { terreno, agua, flujo, region } = estado;
  const evap = 1 - leer('optEvaporacion') * 0.002;
  const gx0 = region.x0 / GC | 0, gx1 = region.x1 / GC | 0, gy0 = region.y0 / GC | 0, gy1 = region.y1 / GC | 0;
  const k = 0.22;
  for (let gy = gy0; gy < gy1; gy++) for (let gx = gx0; gx < gx1; gx++) {
    const g = gy * GW + gx;
    const w = agua[g];
    if (w <= 0.01) { flujo[g * 4] = flujo[g * 4 + 1] = flujo[g * 4 + 2] = flujo[g * 4 + 3] = 0; continue; }
    const Hc = terreno[g] + w;
    let total = 0;
    const vec = [gx > gx0 ? g - 1 : -1, gx < gx1 - 1 ? g + 1 : -1, gy > gy0 ? g - GW : -1, gy < gy1 - 1 ? g + GW : -1];
    for (let d = 0; d < 4; d++) {
      const n = vec[d];
      let f = 0;
      if (n >= 0) { const dH = Hc - (terreno[n] + agua[n]); if (dH > 0) f = k * dH; }
      flujo[g * 4 + d] = f; total += f;
    }
    if (total > w) { const s = w / total; for (let d = 0; d < 4; d++) flujo[g * 4 + d] *= s; }
  }
  for (let gy = gy0; gy < gy1; gy++) for (let gx = gx0; gx < gx1; gx++) {
    const g = gy * GW + gx;
    const vec = [gx > gx0 ? g - 1 : -1, gx < gx1 - 1 ? g + 1 : -1, gy > gy0 ? g - GW : -1, gy < gy1 - 1 ? g + GW : -1];
    let salida = 0;
    for (let d = 0; d < 4; d++) { const f = flujo[g * 4 + d]; salida += f; if (vec[d] >= 0) agua[vec[d]] += f; }
    agua[g] = Math.max(0, (agua[g] - salida) * evap);
  }
}

// ============================================================
// Dibujo del mapa
// ============================================================

const lienzo = $('lienzoMapa');
const ctx = lienzo.getContext('2d');
const salida = document.createElement('canvas'); salida.width = W; salida.height = H;
const ctxSalida = salida.getContext('2d');
let imagen = ctxSalida.createImageData(W, H);

const ESCALAS = {
  topografico: [[-1, [10, 40, 120]], [-0.35, [30, 110, 190]], [-0.02, [120, 200, 230]], [0, [60, 150, 70]], [0.25, [130, 190, 80]], [0.5, [220, 200, 90]], [0.7, [170, 120, 60]], [0.88, [120, 90, 70]], [1, [255, 255, 255]]],
  gris: [[-1, [30, 30, 30]], [1, [235, 235, 235]]],
  calor: [[-1, [20, 20, 90]], [-0.3, [40, 90, 200]], [0.1, [60, 190, 120]], [0.5, [250, 220, 60]], [1, [220, 40, 30]]]
};
function color(t, escala, out) {
  const e = ESCALAS[escala] || ESCALAS.topografico;
  if (t <= e[0][0]) { out[0] = e[0][1][0]; out[1] = e[0][1][1]; out[2] = e[0][1][2]; return; }
  for (let i = 1; i < e.length; i++) {
    if (t <= e[i][0]) {
      const f = (t - e[i - 1][0]) / (e[i][0] - e[i - 1][0]);
      const a = e[i - 1][1], b = e[i][1];
      out[0] = a[0] + (b[0] - a[0]) * f; out[1] = a[1] + (b[1] - a[1]) * f; out[2] = a[2] + (b[2] - a[2]) * f; return;
    }
  }
  const u = e[e.length - 1][1]; out[0] = u[0]; out[1] = u[1]; out[2] = u[2];
}

function dibujar() {
  const { altura, agua, region, base, mano } = estado;
  const px = imagen.data;
  const escala = $('optEscala').value;
  const nivelMar = leer('optNivelMar'), rango = Math.max(20, leer('optRango'));
  const intervalo = Math.max(2, leer('optIntervalo')), curvas = leer('optCurvas'), sombra = leer('optSombra');
  const c = [0, 0, 0];
  const rw = region.x1 - region.x0, rh = region.y1 - region.y0;
  // la salida cubre sólo la región de la arena, estirada a 640×480
  for (let y = 0; y < H; y++) {
    const v = region.y0 + Math.floor(y * rh / H);
    for (let x = 0; x < W; x++) {
      const u = region.x0 + Math.floor(x * rw / W);
      const i = v * W + u, o = (y * W + x) * 4;
      if (!base) { px[o] = px[o + 1] = px[o + 2] = 30; px[o + 3] = 255; continue; }
      const e = altura[i] - nivelMar;
      const t = Math.max(-1, Math.min(1, e / rango));
      color(t, escala, c);
      let s = 1;
      if (sombra && u > region.x0 && v > region.y0) {
        const dx = altura[i] - altura[i - 1], dy = altura[i] - altura[i - W];
        s = Math.max(0.55, Math.min(1.25, 1 + (dx - dy) * 0.06));
      }
      if (curvas && u > region.x0 && v > region.y0) {
        const n0 = Math.floor(e / intervalo);
        if (n0 !== Math.floor((altura[i - 1] - nivelMar) / intervalo) || n0 !== Math.floor((altura[i - W] - nivelMar) / intervalo)) s *= (n0 % 5 === 0) ? 0.35 : 0.6;
      }
      let r = c[0] * s, g = c[1] * s, b = c[2] * s;
      const w = agua[(v / GC | 0) * GW + (u / GC | 0)];
      if (w > 1.5) {
        const a = Math.min(0.85, 0.35 + w / 60);
        const prof = Math.min(1, w / 80);
        r = r * (1 - a) + (40 - 30 * prof) * a; g = g * (1 - a) + (120 - 60 * prof) * a; b = b * (1 - a) + (220 - 40 * prof) * a;
      }
      if (mano[i]) { r = r * 0.6 + 90; g = g * 0.6 + 90; b = b * 0.6 + 90; }
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
    }
  }
  ctxSalida.putImageData(imagen, 0, 0);
  if (estado.grilla) dibujarGrilla(ctxSalida);
  // vista previa: profundidad cruda con la región marcada, o el mapa
  if ($('optVista').value === 'mapa') {
    ctx.drawImage(salida, 0, 0);
  } else {
    dibujarProfundidad();
  }
}

function dibujarProfundidad() {
  const z = estado.ultimoMm; if (!z) return;
  if (!dibujarProfundidad._img) dibujarProfundidad._img = ctx.createImageData(W, H);
  const px = dibujarProfundidad._img.data;
  const zmin = leer('optZmin'), zmax = leer('optZmax');
  for (let i = 0; i < z.length; i++) {
    const d = z[i], o = i * 4;
    if (!(d > 0)) { px[o] = px[o + 1] = px[o + 2] = 40; px[o + 3] = 255; continue; }
    const t = Math.max(0, Math.min(1, (d - zmin) / (zmax - zmin)));
    px[o] = 235 - 160 * t; px[o + 1] = 200 - 120 * t; px[o + 2] = 90 + 130 * t; px[o + 3] = 255;
  }
  ctx.putImageData(dibujarProfundidad._img, 0, 0);
  const r = estado.region;
  ctx.lineWidth = 2; ctx.strokeStyle = '#ffdd55'; ctx.setLineDash([8, 5]);
  ctx.strokeRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, H - 30, W, 30);
  ctx.fillStyle = '#fff'; ctx.font = '14px "Space Grotesk", sans-serif';
  ctx.fillText('Arrastrá sobre la imagen para marcar el borde de la caja de arena.', 12, H - 10);
}

function dibujarGrilla(c) {
  c.save(); c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 2;
  for (let x = 0; x <= W; x += 80) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  for (let y = 0; y <= H; y += 80) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  c.strokeStyle = '#ff3e00'; c.lineWidth = 6; c.strokeRect(3, 3, W - 6, H - 6);
  c.fillStyle = '#fff'; c.font = 'bold 28px sans-serif';
  c.fillText('1', 16, 40); c.fillText('2', W - 34, 40); c.fillText('3', W - 34, H - 16); c.fillText('4', 16, H - 16);
  c.restore();
}

// selección de la región arrastrando sobre la vista de profundidad
let arrastre = null;
lienzo.addEventListener('pointerdown', (e) => {
  if ($('optVista').value !== 'profundidad') return;
  const r = lienzo.getBoundingClientRect();
  arrastre = [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height];
});
lienzo.addEventListener('pointermove', (e) => {
  if (!arrastre) return;
  const r = lienzo.getBoundingClientRect();
  const x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
  estado.region = { x0: Math.max(0, Math.min(arrastre[0], x)) | 0, y0: Math.max(0, Math.min(arrastre[1], y)) | 0, x1: Math.min(W, Math.max(arrastre[0], x)) | 0, y1: Math.min(H, Math.max(arrastre[1], y)) | 0 };
});
lienzo.addEventListener('pointerup', () => {
  if (!arrastre) return; arrastre = null;
  const r = estado.region;
  if (r.x1 - r.x0 < 40 || r.y1 - r.y0 < 40) estado.region = { x0: 40, y0: 30, x1: 600, y1: 450 };
  estado.region.x0 -= estado.region.x0 % GC; estado.region.y0 -= estado.region.y0 % GC;
  estado.plano = null; estado.base = null; estado.agua.fill(0);
  guardarAjustes(); toast('Región marcada: se vuelve a ajustar la base');
});

// ============================================================
// Proyector
// ============================================================

function abrirProyector() {
  if (estado.proyector && !estado.proyector.closed) { estado.proyector.focus(); return; }
  const w = window.open('arenero-proyector.html', 'areneroProyector', 'popup,width=1024,height=768');
  if (!w) { toast('El navegador bloqueó la ventana: permití las ventanas emergentes para esta página'); return; }
  estado.proyector = w;
  w.addEventListener('load', () => enviarEsquinas());
  setTimeout(enviarEsquinas, 1500);
  toast('Arrastrá esa ventana a la pantalla del proyector y ponela en pantalla completa (F11)');
}
function enviarEsquinas() {
  if (estado.proyector && !estado.proyector.closed) estado.proyector.postMessage({ tipo: 'esquinas', esquinas: estado.esquinas, activa: estado.esquinaActiva }, '*');
}
async function enviarAlProyector() {
  const p = estado.proyector;
  if (!p || p.closed) return;
  const ahora = performance.now();
  if (ahora - estado.ultimoEnvio < 45) return;
  estado.ultimoEnvio = ahora;
  try {
    const bitmap = await createImageBitmap(salida);
    p.postMessage({ tipo: 'cuadro', bitmap }, '*', [bitmap]);
  } catch (e) { /* la ventana se cerró */ }
}
window.addEventListener('message', (ev) => {
  const m = ev.data || {};
  if (m.tipo === 'esquinas') { estado.esquinas = m.esquinas; guardarAjustes(); mostrarEsquinas(); }
  if (m.tipo === 'listo') enviarEsquinas();
});
function mostrarEsquinas() {
  $('valEsquinas').textContent = estado.esquinas.map((e, i) => `${i + 1}: ${(e[0] * 100).toFixed(0)}%, ${(e[1] * 100).toFixed(0)}%`).join(' · ');
}
function moverEsquina(dx, dy) {
  const e = estado.esquinas[estado.esquinaActiva];
  e[0] = Math.max(-0.5, Math.min(1.5, e[0] + dx)); e[1] = Math.max(-0.5, Math.min(1.5, e[1] + dy));
  guardarAjustes(); mostrarEsquinas(); enviarEsquinas();
}
document.querySelectorAll('[data-esquina]').forEach(b => b.addEventListener('click', () => { estado.esquinaActiva = +b.dataset.esquina; document.querySelectorAll('[data-esquina]').forEach(x => x.classList.toggle('btn--primary', x === b)); enviarEsquinas(); }));
document.querySelectorAll('[data-mover]').forEach(b => b.addEventListener('click', () => { const [dx, dy] = b.dataset.mover.split(',').map(Number); moverEsquina(dx * 0.005, dy * 0.005); }));
$('btnEsquinasReset').addEventListener('click', () => { estado.esquinas = [[0.02, 0.02], [0.98, 0.02], [0.98, 0.98], [0.02, 0.98]]; guardarAjustes(); mostrarEsquinas(); enviarEsquinas(); });
$('btnProyector').addEventListener('click', abrirProyector);
$('btnGrilla').addEventListener('click', () => { estado.grilla = !estado.grilla; $('btnGrilla').classList.toggle('btn--primary', estado.grilla); });

// ============================================================
// Barra de comandos
// ============================================================

$('btnCalibrar').addEventListener('click', calibrarBase);
$('btnPlano').addEventListener('click', () => { estado.base = null; estado.plano = null; toast('Se vuelve a ajustar el plano automáticamente'); });
$('btnLluvia').addEventListener('click', () => { estado.lluviaGlobal = 25; toast('Lluvia sobre toda la caja'); });
$('btnVaciar').addEventListener('click', () => { estado.agua.fill(0); toast('Agua vaciada'); });
$('btnCongelar').addEventListener('click', () => { estado.congelado = !estado.congelado; $('btnCongelar').textContent = estado.congelado ? '▶ Descongelar el relieve' : '❄ Congelar el relieve'; $('btnCongelar').classList.toggle('btn--primary', estado.congelado); });
$('btnNivelMenos').addEventListener('click', () => { $('optNivelMar').value = leer('optNivelMar') - 5; actualizarEtiquetas(); guardarAjustes(); });
$('btnNivelMas').addEventListener('click', () => { $('optNivelMar').value = leer('optNivelMar') + 5; actualizarEtiquetas(); guardarAjustes(); });
$('btnGuardarMapa').addEventListener('click', () => {
  salida.toBlob(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'arenero-mapa.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }, 'image/png');
});
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.key === 'ArrowLeft') moverEsquina(-0.005, 0); else if (e.key === 'ArrowRight') moverEsquina(0.005, 0);
  else if (e.key === 'ArrowUp') moverEsquina(0, -0.005); else if (e.key === 'ArrowDown') moverEsquina(0, 0.005);
  else if (e.key >= '1' && e.key <= '4') { estado.esquinaActiva = +e.key - 1; document.querySelectorAll('[data-esquina]').forEach(x => x.classList.toggle('btn--primary', +x.dataset.esquina === estado.esquinaActiva)); enviarEsquinas(); }
  else return;
  e.preventDefault();
});

cargarAjustes();
actualizarEtiquetas();
mostrarEsquinas();
window.addEventListener('beforeunload', () => { if (estado.fuente) estado.fuente.cerrar(); if (estado.proyector && !estado.proyector.closed) estado.proyector.close(); });
