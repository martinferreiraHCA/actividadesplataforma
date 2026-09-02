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
  media: new Float32Array(W * H), varianza: new Float32Array(W * H), // filtro de estabilidad
  objetivo: null,                      // relieve objetivo (herramienta DEM)
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

const AJUSTES = ['optEscala', 'optNivelMar', 'optRango', 'optIntervalo', 'optCurvas', 'optSombra', 'optAgua', 'optLluvia', 'optEvaporacion', 'optMano', 'optSuavizado', 'optZmin', 'optZmax', 'optEstabilidad', 'optVelocidad', 'optLuzAcimut', 'optLuzElevacion', 'optTolerancia', 'optHerramienta', 'optCPT'];
function leer(id) { const el = $(id); return el.type === 'checkbox' ? el.checked : (el.tagName === 'TEXTAREA' ? el.value : +el.value); }
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
  $('valEstabilidad').textContent = '±' + leer('optEstabilidad') + ' mm';
  $('valLuz').textContent = leer('optLuzAcimut') + '° / ' + leer('optLuzElevacion') + '°';
  $('valTolerancia').textContent = '±' + leer('optTolerancia') + ' mm';
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
  if (leer('optAgua')) { simularAgua(); simularAgua(); simularAgua(); }
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
  estado.agua.fill(0); estado.flujo.fill(0); estado.media.fill(0); estado.suave.fill(0);
  $('estadoBarra').textContent = 'base calibrada con la arena plana';
  $('notaBase').textContent = 'Base: arena plana calibrada píxel a píxel. Lo que agregues sale como montaña; lo que saques, como valle o mar.';
  toast('Arena calibrada: ahora modelá');
}

// ============================================================
// Terreno, manos y agua
// ============================================================

// Filtro de estabilidad por píxel, como en el SARndbox: la superficie sólo se actualiza cuando
// la medición se mantuvo estable (varianza baja) y cambió más que la histéresis. Así una mano
// que pasa, o el ruido del sensor, no dejan bultos ni titilan.
function actualizarTerreno(mm) {
  const { suave, base, altura, mano, terreno, region, media, varianza } = estado;
  if (!base) return;
  const alpha = leer('optSuavizado');
  const umbralMano = leer('optMano');
  const maxVar = leer('optEstabilidad') ** 2, histeresis = 0.8;
  const zmin = leer('optZmin'), zmax = leer('optZmax');
  for (let v = region.y0; v < region.y1; v++) for (let u = region.x0; u < region.x1; u++) {
    const i = v * W + u;
    const z = mm[i];
    if (!(z > 0) || z < zmin || z > zmax) { mano[i] = 0; continue; }
    const h = base[i] - z;
    if (h > umbralMano) { mano[i] = 1; continue; }   // una mano (o un brazo) por encima: no es arena
    mano[i] = 0;
    if (estado.congelado) continue;
    if (!media[i]) { media[i] = z; varianza[i] = 100; }
    const d = z - media[i];
    media[i] += alpha * d;
    varianza[i] += alpha * (d * d - varianza[i]);
    if (varianza[i] < maxVar && Math.abs(media[i] - suave[i]) > histeresis) suave[i] = media[i];
    else if (!suave[i]) suave[i] = z;
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
    if (aguaOn && m > 4) estado.agua[g] += lluvia * 0.12 * m / (GC * GC);
    if (aguaOn && estado.lluviaGlobal > 0) estado.agua[g] += lluvia * 0.05;
  }
  if (estado.lluviaGlobal > 0) estado.lluviaGlobal--;
}

// Aguas someras con inercia (modelo de tuberías virtuales, la versión discreta de Saint-Venant
// que usan los areneros de realidad aumentada): cada celda guarda el caudal que sale por sus
// cuatro caras; el caudal se acelera con la diferencia de nivel, se frena por fricción y no
// puede sacar más agua de la que hay. El agua tiene ondas, se mueve con impulso y se remansa.
function simularAgua() {
  const { terreno, agua, flujo, region } = estado;
  const evap = leer('optEvaporacion') * 0.0012;
  const gx0 = region.x0 / GC | 0, gx1 = region.x1 / GC | 0, gy0 = region.y0 / GC | 0, gy1 = region.y1 / GC | 0;
  const g = leer('optVelocidad') * 0.12, friccion = 0.985;
  for (let gy = gy0; gy < gy1; gy++) for (let gx = gx0; gx < gx1; gx++) {
    const c = gy * GW + gx;
    const w = agua[c];
    const Hc = terreno[c] + w;
    const vec = [gx > gx0 ? c - 1 : -1, gx < gx1 - 1 ? c + 1 : -1, gy > gy0 ? c - GW : -1, gy < gy1 - 1 ? c + GW : -1];
    let total = 0;
    for (let d = 0; d < 4; d++) {
      const n = vec[d];
      let f = 0;
      if (n >= 0) { f = flujo[c * 4 + d] * friccion + g * (Hc - (terreno[n] + agua[n])); if (f < 0) f = 0; }
      flujo[c * 4 + d] = f; total += f;
    }
    if (total > w) { const k = w / total; for (let d = 0; d < 4; d++) flujo[c * 4 + d] *= k; }
  }
  for (let gy = gy0; gy < gy1; gy++) for (let gx = gx0; gx < gx1; gx++) {
    const c = gy * GW + gx;
    let entra = 0;
    if (gx > gx0) entra += flujo[(c - 1) * 4 + 1];
    if (gx < gx1 - 1) entra += flujo[(c + 1) * 4 + 0];
    if (gy > gy0) entra += flujo[(c - GW) * 4 + 3];
    if (gy < gy1 - 1) entra += flujo[(c + GW) * 4 + 2];
    const sale = flujo[c * 4] + flujo[c * 4 + 1] + flujo[c * 4 + 2] + flujo[c * 4 + 3];
    let w = agua[c] - sale + entra - evap;
    if (w < 0.02) w = 0;
    agua[c] = w;
  }
}

// herramientas de agua con el mouse sobre el mapa
function aguaEn(x, y, cantidad) {
  const r = estado.region;
  const u = r.x0 + x * (r.x1 - r.x0) / W, v = r.y0 + y * (r.y1 - r.y0) / H;
  const gx = u / GC | 0, gy = v / GC | 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const X = gx + dx, Y = gy + dy;
    if (X < r.x0 / GC || Y < r.y0 / GC || X >= r.x1 / GC || Y >= r.y1 / GC) continue;
    const g = Y * GW + X;
    estado.agua[g] = Math.max(0, estado.agua[g] + cantidad * (1 - (dx * dx + dy * dy) / 12));
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

// Escala de colores por defecto del SARndbox (HeightColorMap.cpt), con las alturas en mm
// referidas a un rango de ±400 mm; se estira al «rango» elegido.
const CPT_SARNDBOX = `-400 0 0 80
-300 0 30 100
-200 0 50 120
-125 19 108 160
-7.5 24 140 205
-2.5 135 206 250
-0.5 176 226 255
0 0 97 71
2.5 16 122 47
60 232 215 125
125 161 67 0
200 130 30 30
250 161 161 161
325 206 206 206
400 255 255 255`;
const CPT_CALOR = `-400 20 20 90\n-120 40 90 200\n40 60 190 120\n200 250 220 60\n400 220 40 30`;
const CPT_GRIS = `-400 30 30 30\n400 235 235 235`;

// texto CPT (altura_mm r g b por línea) → [[t normalizado, [r,g,b]], …]
function parsearCPT(texto, rango) {
  const paradas = [];
  for (const linea of texto.split(/\n/)) {
    const t = linea.trim(); if (!t || t.startsWith('#')) continue;
    const p = t.split(/[\s,;]+/).map(Number);
    if (p.length < 4 || p.some(isNaN)) continue;
    paradas.push([p[0], [p[1], p[2], p[3]]]);
  }
  paradas.sort((a, b) => a[0] - b[0]);
  const escalaMax = Math.max(...paradas.map(p => Math.abs(p[0])), 1);
  return paradas.map(p => [p[0] / escalaMax, p[1]]); // normalizado a [-1, 1]: ±rango
}
let escalaActual = parsearCPT(CPT_SARNDBOX);
function elegirEscala() {
  const e = $('optEscala').value;
  const texto = e === 'personalizada' ? $('optCPT').value : e === 'calor' ? CPT_CALOR : e === 'gris' ? CPT_GRIS : CPT_SARNDBOX;
  const parsed = parsearCPT(texto);
  if (parsed.length >= 2) escalaActual = parsed; else toast('La escala necesita al menos dos líneas «altura r g b»');
  dibujarLeyenda();
}
function color(t, out) {
  const e = escalaActual;
  if (t <= e[0][0]) { out[0] = e[0][1][0]; out[1] = e[0][1][1]; out[2] = e[0][1][2]; return; }
  for (let i = 1; i < e.length; i++) {
    if (t <= e[i][0]) {
      const f = (t - e[i - 1][0]) / (e[i][0] - e[i - 1][0] || 1);
      const a = e[i - 1][1], b = e[i][1];
      out[0] = a[0] + (b[0] - a[0]) * f; out[1] = a[1] + (b[1] - a[1]) * f; out[2] = a[2] + (b[2] - a[2]) * f; return;
    }
  }
  const u = e[e.length - 1][1]; out[0] = u[0]; out[1] = u[1]; out[2] = u[2];
}
function dibujarLeyenda() {
  const c = $('lienzoLeyenda'); const cx = c.getContext('2d'); const col = [0, 0, 0];
  for (let x = 0; x < c.width; x++) { color(x / (c.width - 1) * 2 - 1, col); cx.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`; cx.fillRect(x, 0, 1, c.height); }
}

function dibujar() {
  const { altura, agua, region, base, mano, objetivo } = estado;
  const px = imagen.data;
  const nivelMar = leer('optNivelMar'), rango = Math.max(20, leer('optRango'));
  const intervalo = Math.max(2, leer('optIntervalo')), curvas = leer('optCurvas'), sombra = leer('optSombra');
  const modoDif = $('optModoMapa').value === 'diferencia' && objetivo;
  const tol = leer('optTolerancia');
  // luz para el sombreado
  const az = leer('optLuzAcimut') * Math.PI / 180, el = leer('optLuzElevacion') * Math.PI / 180;
  const lx = Math.cos(el) * Math.sin(az), ly = -Math.cos(el) * Math.cos(az), lz = Math.sin(el);
  const rw = region.x1 - region.x0, rh = region.y1 - region.y0;
  const mmPorPx = (leer('optZmin') + leer('optZmax')) / 2 / N.INTR.fx; // tamaño aproximado de un píxel en la arena
  const c = [0, 0, 0];
  const t0 = performance.now();
  for (let y = 0; y < H; y++) {
    const v = region.y0 + Math.floor(y * rh / H);
    for (let x = 0; x < W; x++) {
      const u = region.x0 + Math.floor(x * rw / W);
      const i = v * W + u, o = (y * W + x) * 4;
      if (!base) { px[o] = px[o + 1] = px[o + 2] = 30; px[o + 3] = 255; continue; }
      const e = altura[i] - nivelMar;
      let r, g, b;
      if (modoDif) {
        const d = altura[i] - objetivo[i];
        if (Math.abs(d) <= tol) { r = 80; g = 200; b = 90; }
        else if (d > 0) { const f = Math.min(1, (d - tol) / 60); r = 120 + 135 * f; g = 120 - 90 * f; b = 60; }
        else { const f = Math.min(1, (-d - tol) / 60); r = 60; g = 120 - 60 * f; b = 140 + 115 * f; }
      } else {
        color(Math.max(-1, Math.min(1, e / rango)), c); r = c[0]; g = c[1]; b = c[2];
      }
      let s = 1;
      if (sombra && u > region.x0 && v > region.y0) {
        const dx = (altura[i] - altura[i - 1]) / mmPorPx, dy = (altura[i] - altura[i - W]) / mmPorPx;
        const nl = Math.hypot(dx, dy, 1);
        const dot = (-dx * lx - dy * ly + lz) / nl;
        s = Math.max(0.35, Math.min(1.3, 0.45 + 0.75 * dot));
      }
      if (curvas && u > region.x0 && v > region.y0) {
        const n0 = Math.floor(e / intervalo);
        if (n0 !== Math.floor((altura[i - 1] - nivelMar) / intervalo) || n0 !== Math.floor((altura[i - W] - nivelMar) / intervalo)) s *= (n0 % 5 === 0) ? 0.3 : 0.6;
      }
      r *= s; g *= s; b *= s;
      const gi = (v / GC | 0) * GW + (u / GC | 0);
      const w = agua[gi];
      if (w > 1) {
        const a = Math.min(0.88, 0.3 + w / 50);
        const prof = Math.min(1, w / 90);
        // brillo por la pendiente de la superficie del agua (ondas)
        let ola = 0;
        if (u > region.x0 + GC) { const w2 = agua[gi - 1]; ola = Math.max(-0.25, Math.min(0.25, (w - w2 + terreno_(gi) - terreno_(gi - 1)) * 0.02)); }
        r = r * (1 - a) + (50 - 35 * prof + 90 * ola) * a; g = g * (1 - a) + (140 - 70 * prof + 90 * ola) * a; b = b * (1 - a) + (230 - 50 * prof + 60 * ola) * a;
      }
      if (mano[i]) { // nube de lluvia bajo la mano
        const gota = ((x * 7 + y * 13 + (t0 / 40 | 0) * 5) % 23) === 0;
        r = r * 0.55 + 70; g = g * 0.55 + 75; b = b * 0.55 + 95;
        if (gota) { r = 120; g = 170; b = 255; }
      }
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
    }
  }
  ctxSalida.putImageData(imagen, 0, 0);
  if (estado.grilla) dibujarGrilla(ctxSalida);
  if ($('optVista').value === 'mapa') ctx.drawImage(salida, 0, 0);
  else dibujarProfundidad();
}
function terreno_(g) { return estado.terreno[g]; }

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

// ============================================================
// Relieve objetivo (herramienta DEM del SARndbox): guardar y cargar la superficie
// ============================================================

function guardarRelieve() {
  if (!estado.base) { toast('Todavía no hay relieve'); return; }
  const r = estado.region;
  const datos = new Int16Array((r.x1 - r.x0) * (r.y1 - r.y0));
  let k = 0;
  for (let v = r.y0; v < r.y1; v++) for (let u = r.x0; u < r.x1; u++) datos[k++] = Math.round(estado.altura[v * W + u]);
  const u8 = new Uint8Array(datos.buffer); let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
  const blob = new Blob([JSON.stringify({ formato: 'arenero-relieve', version: 1, region: r, unidad: 'mm', altura: btoa(s) })], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'arenero-relieve.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Relieve guardado');
}
async function cargarRelieve(archivo) {
  try {
    const d = JSON.parse(await archivo.text());
    if (d.formato !== 'arenero-relieve') throw new Error('no es un relieve del arenero');
    const s = atob(d.altura); const u8 = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    const datos = new Int16Array(u8.buffer);
    // se estira a la región actual (si la caja se marcó distinto)
    const r = estado.region, rs = d.region;
    const obj = new Float32Array(W * H);
    const rw = rs.x1 - rs.x0, rh = rs.y1 - rs.y0;
    for (let v = r.y0; v < r.y1; v++) for (let u = r.x0; u < r.x1; u++) {
      const su = Math.min(rw - 1, Math.floor((u - r.x0) * rw / (r.x1 - r.x0))), sv = Math.min(rh - 1, Math.floor((v - r.y0) * rh / (r.y1 - r.y0)));
      obj[v * W + u] = datos[sv * rw + su];
    }
    estado.objetivo = obj;
    $('optModoMapa').value = 'diferencia';
    toast('Relieve objetivo cargado: verde = igual, rojo = sobra arena, azul = falta arena');
  } catch (e) { toast('No pude leer el relieve: ' + e.message); }
}
$('btnGuardarRelieve').addEventListener('click', guardarRelieve);
$('btnCargarRelieve').addEventListener('click', () => $('inputRelieve').click());
$('inputRelieve').addEventListener('change', (e) => { if (e.target.files[0]) cargarRelieve(e.target.files[0]); e.target.value = ''; });
$('btnObjetivoActual').addEventListener('click', () => { if (!estado.base) return; estado.objetivo = Float32Array.from(estado.altura); $('optModoMapa').value = 'diferencia'; toast('El relieve actual es ahora el objetivo: modificá la arena y volvé a igualarlo'); });
$('optEscala').addEventListener('change', () => { $('zonaCPT').style.display = $('optEscala').value === 'personalizada' ? '' : 'none'; elegirEscala(); });
$('btnAplicarCPT').addEventListener('click', elegirEscala);
$('btnCPTDefecto').addEventListener('click', () => { $('optCPT').value = CPT_SARNDBOX; elegirEscala(); });
if (!$('optCPT').value) $('optCPT').value = CPT_SARNDBOX;

// herramientas de agua sobre el mapa
let pintando = false;
lienzo.addEventListener('pointerdown', (e) => {
  if ($('optVista').value !== 'mapa') return;
  const h = $('optHerramienta').value; if (h === 'ninguna') return;
  pintando = true; lienzo.setPointerCapture(e.pointerId);
  const r = lienzo.getBoundingClientRect();
  aguaEn((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height, (h === 'quitar' || e.shiftKey) ? -20 : 8);
});
lienzo.addEventListener('pointermove', (e) => {
  if (!pintando) return;
  const r = lienzo.getBoundingClientRect();
  aguaEn((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height, ($('optHerramienta').value === 'quitar' || e.shiftKey) ? -20 : 4);
});
lienzo.addEventListener('pointerup', () => { pintando = false; });

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
$('zonaCPT').style.display = $('optEscala').value === 'personalizada' ? '' : 'none';
elegirEscala();
window.addEventListener('beforeunload', () => { if (estado.fuente) estado.fuente.cerrar(); if (estado.proyector && !estado.proyector.closed) estado.proyector.close(); });
