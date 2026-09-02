// Escaneo 3D con Kinect — la página. Conecta el Kinect (o la pieza de demostración),
// muestra la profundidad en vivo con la caja de escaneo dibujada encima, junta las tomas
// girando la pieza y arma el modelo purgado con el núcleo de cálculo.

import * as THREE from 'three';
import { OrbitControls } from './lego/vendor/OrbitControls.js';
import * as N from './escaneo3d-nucleo.js';
import { KinectV1, estadoWebUSB, sistemaOperativo, explicarError, GUIAS, MODELOS } from './kinect-usb.js';

const $ = id => document.getElementById(id);

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('toast--visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove('toast--visible'), 4000);
}
const respirar = () => new Promise(r => setTimeout(r, 0));

const estado = {
  fuente: null,          // KinectV1 o SimuladorKinect
  tipo: null,            // 'kinect' | 'demo'
  ultimoMm: null,        // último mapa en mm
  crudo16: new Uint16Array(N.INTR.ancho * N.INTR.alto),
  plano: null,
  auto: null,            // resultado de marcoAutomatico
  desplazamiento: [0, 0],// corrimiento manual del eje (mm)
  marco: null,
  tomas: [],             // [{ z, angulo, nombre }]
  capturando: null,      // { faltan, cuadros }
  malla: null,
  puntos: null,
  ajuste: null,          // resultado de ajustarEje
  dibujoPendiente: false
};

// ============================================================
// Simulador (pieza de demostración, sin Kinect)
// ============================================================

class SimuladorKinect {
  constructor() { this.corriendo = false; this.semilla = 1; }
  get modelo() { return 'Pieza de demostración (sin Kinect)'; }
  async iniciarProfundidad(onCuadro) {
    this.corriendo = true;
    const paso = () => {
      if (!this.corriendo) return;
      const angulo = +$('optAngulo').value || 0;
      const mm = N.sintetizarToma(angulo, { semilla: this.semilla++ });
      onCuadro({ mm });
      this.timer = setTimeout(paso, 120);
    };
    paso();
  }
  async detener() { this.corriendo = false; clearTimeout(this.timer); }
  async cerrar() { await this.detener(); }
}

// ============================================================
// Estado de conexión y guía de drivers
// ============================================================

function mostrarEstado(clase, titulo, detalle) {
  const caja = $('estadoKinect');
  caja.className = 'kin-estado' + (clase ? ' kin-estado--' + clase : '');
  $('estadoTitulo').textContent = titulo;
  $('estadoDetalle').textContent = detalle || '';
}

function armarGuia(preferido) {
  const tabs = $('guiaTabs');
  tabs.innerHTML = '';
  const claves = Object.keys(GUIAS);
  const so = claves.includes(preferido) ? preferido : 'windows';
  for (const k of claves) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'kin-guia__tab' + (k === so ? ' kin-guia__tab--activa' : '');
    b.textContent = GUIAS[k].nombre;
    b.addEventListener('click', () => { armarGuia(k); });
    tabs.appendChild(b);
  }
  const g = GUIAS[so];
  const cont = $('guiaContenido');
  let html = '<ol class="kin-guia__pasos">';
  g.pasos.forEach((p, i) => {
    html += `<li>${p}`;
    if (g.comandos && i === 1) html += `<pre class="kin-guia__pre">${g.comandos.replace(/</g, '&lt;')}</pre><button class="btn kin-guia__copiar" type="button" id="btnCopiarComandos">📋 Copiar los comandos</button>`;
    html += '</li>';
  });
  html += '</ol>';
  if (g.nota) html += `<p class="kin-nota">${g.nota}</p>`;
  cont.innerHTML = html;
  const copiar = $('btnCopiarComandos');
  if (copiar) copiar.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(g.comandos); toast('Comandos copiados: pegalos en la terminal'); }
    catch (e) { toast('No pude copiar; seleccionalos con el mouse'); }
  });
}

function informarError(err, fase) {
  console.error(err);
  const ex = explicarError(err.original || err, err.fase || fase);
  mostrarEstado('error', ex.titulo, ex.detalle);
  if (ex.guia === 'drivers' || ex.guia === 'fuente') {
    $('guiaDrivers').open = true;
    $('guiaDrivers').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  toast(ex.titulo);
}

// ============================================================
// Conexión
// ============================================================

async function usarFuente(fuente, tipo) {
  if (estado.fuente) await desconectar();
  estado.fuente = fuente;
  estado.tipo = tipo;
  fuente.onError = (e) => { informarError(e, 'flujo'); desconectar(); };
  await fuente.iniciarProfundidad(recibirCuadro);
  $('btnConectar').style.display = tipo === 'kinect' ? 'none' : '';
  $('btnDesconectar').style.display = '';
  $('btnDemo').style.display = tipo === 'demo' ? 'none' : '';
  $('seccionEncuadre').style.display = '';
  $('seccionCapturas').style.display = '';
  actualizarModo();
  if (tipo === 'demo') {
    mostrarEstado('demo', 'Pieza de demostración', 'Una caja con una esfera y una manija, dibujada con el mismo ruido que el sensor real. Sirve para probar todo el flujo sin el Kinect.');
  } else {
    mostrarEstado('conectado', 'Kinect conectado: ' + fuente.modelo, 'Esperando el primer cuadro de profundidad…');
  }
  $('seccionEncuadre').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function conectarKinect(dispositivo) {
  const k = new KinectV1();
  try {
    mostrarEstado(null, 'Conectando…', 'Abriendo el Kinect y arrancando la cámara de profundidad.');
    await k.abrir(dispositivo);
    await usarFuente(k, 'kinect');
  } catch (e) {
    try { await k.cerrar(); } catch (e2) { /* nada */ }
    informarError(e, 'abrir');
  }
}

async function desconectar() {
  const f = estado.fuente;
  estado.fuente = null;
  estado.capturando = null;
  if (f) { try { await f.cerrar(); } catch (e) { /* nada */ } }
  $('btnConectar').style.display = '';
  $('btnDesconectar').style.display = 'none';
  $('btnDemo').style.display = '';
  mostrarEstado(null, 'Sin Kinect conectado', 'Enchufalo y apretá «Conectar Kinect».');
}

$('btnConectar').addEventListener('click', async () => {
  const w = estadoWebUSB();
  if (!w.disponible) { mostrarEstado('error', 'Este navegador no puede conectar el Kinect', w.razon); $('guiaDrivers').open = true; return; }
  let dispositivo;
  try { dispositivo = await KinectV1.pedirPermiso(); }
  catch (e) { informarError(e, 'pedir'); return; }
  await conectarKinect(dispositivo);
});
$('btnDesconectar').addEventListener('click', desconectar);
$('btnDemo').addEventListener('click', async () => {
  $('optAngulo').value = 0;
  await usarFuente(new SimuladorKinect(), 'demo');
});

// Plug and play: si ya se le dio permiso a un Kinect, se conecta solo al cargar y al enchufarlo.
(async function autoConectar() {
  const w = estadoWebUSB();
  armarGuia(sistemaOperativo());
  if (!w.disponible) {
    mostrarEstado(null, 'Este navegador no puede conectar el Kinect', w.razon + ' Podés probar igual con la pieza de demostración.');
    return;
  }
  const lista = await KinectV1.autorizados();
  if (lista.length) await conectarKinect(lista[0]);
  navigator.usb.addEventListener('connect', async (ev) => {
    if (estado.fuente || ev.device.vendorId !== 0x045e || !MODELOS[ev.device.productId]) return;
    toast('Kinect detectado: conectando…');
    await conectarKinect(ev.device);
  });
  navigator.usb.addEventListener('disconnect', async (ev) => {
    if (estado.tipo === 'kinect' && estado.fuente && estado.fuente.dispositivo === ev.device) {
      await desconectar();
      mostrarEstado('error', 'Se desenchufó el Kinect', 'Volvé a enchufarlo: se reconecta solo.');
    }
  });
})();

// ============================================================
// Cuadros en vivo
// ============================================================

let cuadrosRecibidos = 0, tiempoFps = performance.now(), fps = 0;

function recibirCuadro(cuadro) {
  let mm;
  if (cuadro.mm) mm = cuadro.mm;
  else { N.desempaquetar11(cuadro.crudo11, estado.crudo16); mm = N.crudoAmapa(estado.crudo16); }
  estado.ultimoMm = mm;
  cuadrosRecibidos++;
  const ahora = performance.now();
  if (ahora - tiempoFps > 1000) {
    fps = cuadrosRecibidos * 1000 / (ahora - tiempoFps);
    cuadrosRecibidos = 0; tiempoFps = ahora;
    if (estado.tipo === 'kinect') {
      const est = estado.fuente.estadisticas || {};
      $('estadoDetalle').textContent = `${fps.toFixed(0)} cuadros/s · ${est.cuadros || 0} recibidos · ${est.incompletos || 0} incompletos · ${est.perdidos || 0} con paquetes perdidos`;
    }
  }
  if (!estado.plano) detectarMesa(true);
  if (estado.capturando) {
    const c = estado.capturando;
    c.cuadros.push(Float32Array.from(mm));
    $('estadoCaptura').textContent = `capturando ${c.cuadros.length}/${c.total}…`;
    if (c.cuadros.length >= c.total) { estado.capturando = null; terminarCaptura(c); }
  }
  if (!estado.dibujoPendiente) {
    estado.dibujoPendiente = true;
    requestAnimationFrame(() => { estado.dibujoPendiente = false; dibujarVista(); });
  }
}

// ============================================================
// Mesa, marco y caja
// ============================================================

function leerRango() { return { zmin: +$('optZmin').value, zmax: +$('optZmax').value }; }
function leerCaja() { return { ancho: +$('optAncho').value || 240, alto: +$('optAlto').value || 200, profundo: +$('optProfundo').value || 240 }; }
function leerCorte() { return +$('optCorte').value || 0; }

function detectarMesa(silencioso) {
  const z = estado.ultimoMm;
  if (!z) { if (!silencioso) toast('Todavía no llegó ningún cuadro'); return; }
  const { zmin, zmax } = leerRango();
  const W = N.INTR.ancho, H = N.INTR.alto;
  const regiones = {
    abajo: { x0: 0, y0: H / 2, x1: W, y1: H },
    toda: { x0: 0, y0: 0, x1: W, y1: H },
    centro: { x0: W / 4, y0: H / 4, x1: 3 * W / 4, y1: 3 * H / 4 }
  };
  const region = regiones[$('optRegionMesa').value] || regiones.abajo;
  const pts = N.puntosDeMapa(z, { paso: 4, zmin, zmax, region });
  const plano = N.detectarPlano(pts, { umbral: 8 });
  if (!plano) { if (!silencioso) toast('No encontré una superficie plana: acercá el Kinect a la mesa o cambiá el rango'); $('notaMesa').textContent = 'No se encontró la mesa en esa zona.'; return; }
  estado.plano = plano;
  estado.desplazamiento = [0, 0];
  estado.ajuste = null;
  recentrar(silencioso);
  const inclinacion = Math.acos(Math.min(1, Math.abs(plano.n[1]))) * 180 / Math.PI;
  $('notaMesa').textContent = `Mesa detectada: ${Math.round(plano.inliers / plano.total * 100)}% de los puntos de la zona son planos; el Kinect está inclinado ${inclinacion.toFixed(0)}° respecto de la mesa.`;
  if (!silencioso) toast('Mesa detectada');
}

function recentrar(silencioso) {
  if (!estado.plano || !estado.ultimoMm) return;
  const { zmin, zmax } = leerRango();
  const auto = N.marcoAutomatico(estado.ultimoMm, estado.plano, { corte: leerCorte(), zmin, zmax, desplazamiento: estado.desplazamiento });
  if (!auto) { if (!silencioso) toast('No veo nada sobre la mesa dentro del rango: apoyá la pieza o ampliá la distancia'); return; }
  estado.auto = auto;
  actualizarMarco();
}

function actualizarMarco() {
  if (!estado.plano || !estado.auto) return;
  const d = estado.desplazamiento;
  estado.marco = N.armarMarco(estado.plano, estado.auto.centro, [estado.auto.auto[0] + d[0], estado.auto.auto[1] + d[1]]);
  $('valEje').textContent = `${d[0] >= 0 ? '+' : ''}${d[0]} mm, ${d[1] >= 0 ? '+' : ''}${d[1]} mm`;
}

$('btnDetectarMesa').addEventListener('click', () => detectarMesa(false));
$('btnRecentrar').addEventListener('click', () => { estado.desplazamiento = [0, 0]; estado.ajuste = null; recentrar(false); });
document.querySelectorAll('[data-mover]').forEach(b => b.addEventListener('click', () => {
  const [dx, dz] = b.dataset.mover.split(',').map(Number);
  estado.desplazamiento = [estado.desplazamiento[0] + dx, estado.desplazamiento[1] + dz];
  estado.ajuste = null;
  actualizarMarco();
  dibujarVista();
}));
for (const id of ['optZmin', 'optZmax']) {
  $(id).addEventListener('input', () => {
    if (+$('optZmax').value <= +$('optZmin').value + 50) { if (id === 'optZmin') $('optZmax').value = +$('optZmin').value + 50; else $('optZmin').value = +$('optZmax').value - 50; }
    $('valZmin').textContent = $('optZmin').value + ' mm';
    $('valZmax').textContent = $('optZmax').value + ' mm';
    dibujarVista();
  });
}
for (const id of ['optAncho', 'optAlto', 'optProfundo', 'optCorte']) $(id).addEventListener('input', () => { if (id === 'optCorte') actualizarMarco(); dibujarVista(); });

// ============================================================
// Vista en vivo
// ============================================================

const lienzoVista = $('lienzoVista');
const ctxVista = lienzoVista.getContext('2d');
let imagenVista = null;

function colorProfundidad(mm, zmin, zmax, salida) {
  // gradiente cálido→frío según la distancia
  const t = Math.max(0, Math.min(1, (mm - zmin) / (zmax - zmin)));
  salida[0] = 235 - 160 * t; salida[1] = 200 - 120 * t; salida[2] = 90 + 130 * t;
}

function dibujarVista() {
  const z = estado.ultimoMm;
  if (!z) return;
  const W = N.INTR.ancho, H = N.INTR.alto;
  if (!imagenVista) imagenVista = ctxVista.createImageData(W, H);
  const px = imagenVista.data;
  const { zmin, zmax } = leerRango();
  const caja = leerCaja();
  const corte = leerCorte();
  const clases = estado.marco ? N.clasificarPixeles(z, estado.marco, caja, { corte, zmin, zmax }) : null;
  const c = [0, 0, 0];
  for (let i = 0; i < z.length; i++) {
    const d = z[i];
    const o = i * 4;
    if (!(d > 0)) { px[o] = 40; px[o + 1] = 40; px[o + 2] = 40; px[o + 3] = 255; continue; }
    colorProfundidad(d, zmin, zmax, c);
    const cl = clases ? clases[i] : (d < zmin || d > zmax ? 1 : 3);
    if (cl === 2) { px[o] = c[0] * 0.35 + 60; px[o + 1] = c[1] * 0.35 + 160; px[o + 2] = c[2] * 0.35 + 70; }
    else if (cl === 3) { px[o] = Math.min(255, c[0] * 0.3 + 200); px[o + 1] = c[1] * 0.3 + 90; px[o + 2] = c[2] * 0.3 + 20; }
    else { px[o] = c[0] * 0.25 + 30; px[o + 1] = c[1] * 0.25 + 50; px[o + 2] = c[2] * 0.25 + 90; }
    px[o + 3] = 255;
  }
  ctxVista.putImageData(imagenVista, 0, 0);
  if (estado.marco) {
    const p = N.proyectarCaja(estado.marco, caja);
    ctxVista.lineWidth = 2;
    ctxVista.strokeStyle = 'rgba(255,255,255,0.9)';
    ctxVista.beginPath();
    for (const [a, b] of p.segmentos) { ctxVista.moveTo(a[0], a[1]); ctxVista.lineTo(b[0], b[1]); }
    ctxVista.stroke();
    if (p.circulo.length > 2) {
      ctxVista.strokeStyle = 'rgba(255,255,255,0.75)';
      ctxVista.setLineDash([6, 4]);
      ctxVista.beginPath();
      p.circulo.forEach((q, i) => i ? ctxVista.lineTo(q[0], q[1]) : ctxVista.moveTo(q[0], q[1]));
      ctxVista.stroke();
      ctxVista.setLineDash([]);
    }
    if (p.eje) {
      ctxVista.strokeStyle = '#ffdd55';
      ctxVista.beginPath(); ctxVista.moveTo(p.eje[0][0], p.eje[0][1]); ctxVista.lineTo(p.eje[1][0], p.eje[1][1]); ctxVista.stroke();
      ctxVista.fillStyle = '#ffdd55';
      ctxVista.beginPath(); ctxVista.arc(p.eje[0][0], p.eje[0][1], 5, 0, Math.PI * 2); ctxVista.fill();
    }
  } else {
    ctxVista.fillStyle = 'rgba(0,0,0,0.55)';
    ctxVista.fillRect(0, H - 34, W, 34);
    ctxVista.fillStyle = '#fff';
    ctxVista.font = '15px "Space Grotesk", sans-serif';
    ctxVista.fillText('Buscando la mesa… si no aparece, apretá «Detectar la mesa».', 12, H - 12);
  }
}

// ============================================================
// Capturas
// ============================================================

function actualizarModo() {
  const relieve = $('optModo').value === 'relieve';
  $('notaModo').style.display = relieve ? 'none' : '';
  $('notaRelieve').style.display = relieve ? '' : 'none';
}
$('optModo').addEventListener('change', actualizarModo);

async function capturar() {
  if (!estado.fuente || !estado.ultimoMm) { toast('Primero conectá el Kinect o la pieza de demostración'); return; }
  if (!estado.marco) { toast('Antes hay que detectar la mesa'); return; }
  if (estado.capturando) return;
  const total = +$('optCuadros').value || 1;
  if ($('optCuenta').checked) {
    for (let n = 3; n > 0; n--) {
      $('cuentaRegresiva').textContent = n;
      await new Promise(r => setTimeout(r, 1000));
      if (!estado.fuente) { $('cuentaRegresiva').textContent = ''; return; }
    }
    $('cuentaRegresiva').textContent = '';
  }
  estado.capturando = { total, cuadros: [], angulo: +$('optAngulo').value || 0 };
  $('estadoCaptura').textContent = 'capturando…';
}

function terminarCaptura(c) {
  const z = N.medianaDeCuadros(c.cuadros);
  const toma = { z, angulo: c.angulo };
  estado.tomas.push(toma);
  $('estadoCaptura').textContent = `toma ${estado.tomas.length} lista (${c.angulo}°)`;
  const paso = +$('optPaso').value || 45;
  $('optAngulo').value = c.angulo + paso;
  dibujarCapturas();
  $('seccionModelo').style.display = '';
  toast(`Toma ${estado.tomas.length} guardada. Girá la pieza ${paso}° y capturá la siguiente.`);
}
$('btnCapturar').addEventListener('click', capturar);

function miniatura(z, lienzo) {
  const W = N.INTR.ancho, H = N.INTR.alto, w = 160, h = 120;
  lienzo.width = w; lienzo.height = h;
  const ctx = lienzo.getContext('2d');
  const img = ctx.createImageData(w, h);
  const { zmin, zmax } = leerRango();
  const c = [0, 0, 0];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = z[Math.floor(y * H / h) * W + Math.floor(x * W / w)];
    const o = (y * w + x) * 4;
    if (!(d > 0)) { img.data[o] = 40; img.data[o + 1] = 40; img.data[o + 2] = 40; }
    else { colorProfundidad(d, zmin, zmax, c); img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; }
    img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function dibujarCapturas() {
  const lista = $('listaCapturas');
  lista.innerHTML = '';
  if (!estado.tomas.length) {
    lista.innerHTML = '<div class="kin-captura kin-captura--vacia">Todavía no hay tomas. Acomodá la pieza y apretá «Capturar esta toma».</div>';
    return;
  }
  estado.tomas.forEach((t, i) => {
    const card = document.createElement('div');
    card.className = 'kin-captura';
    const cv = document.createElement('canvas');
    miniatura(t.z, cv);
    card.appendChild(cv);
    const pie = document.createElement('div');
    pie.className = 'kin-captura__pie';
    pie.innerHTML = `<span>#${i + 1}</span><input type="number" step="1" value="${t.angulo}" aria-label="Ángulo de la toma ${i + 1}"><span>°</span><button class="kin-captura__borrar" type="button" title="Borrar esta toma">✕</button>`;
    pie.querySelector('input').addEventListener('change', (e) => { t.angulo = +e.target.value || 0; estado.ajuste = null; });
    pie.querySelector('button').addEventListener('click', () => { estado.tomas.splice(i, 1); estado.ajuste = null; dibujarCapturas(); });
    card.appendChild(pie);
    lista.appendChild(card);
  });
}
dibujarCapturas();

$('btnBorrarTomas').addEventListener('click', () => {
  if (!estado.tomas.length) return;
  if (!confirm('¿Borrar todas las tomas?')) return;
  estado.tomas = []; estado.ajuste = null; dibujarCapturas();
});

// Guardar / cargar tomas (mm en enteros de 16 bits, base64)
function aBase64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); }
function deBase64(b64) { const s = atob(b64); const u8 = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i); return u8; }

$('btnGuardarTomas').addEventListener('click', () => {
  if (!estado.tomas.length) { toast('No hay tomas para guardar'); return; }
  const tomas = estado.tomas.map(t => {
    const u16 = new Uint16Array(t.z.length);
    for (let i = 0; i < u16.length; i++) u16[i] = Math.round(t.z[i]);
    return { angulo: t.angulo, z: aBase64(new Uint8Array(u16.buffer)) };
  });
  const datos = {
    formato: 'escaneo-kinect', version: 1, fecha: new Date().toISOString(),
    ancho: N.INTR.ancho, alto: N.INTR.alto, unidad: 'mm',
    plano: estado.plano, centro: estado.auto ? estado.auto.centro : null, auto: estado.auto ? estado.auto.auto : null,
    desplazamiento: estado.desplazamiento, rango: leerRango(), caja: leerCaja(), corte: leerCorte(), modo: $('optModo').value,
    tomas
  };
  descargar(new Blob([JSON.stringify(datos)], { type: 'application/json' }), 'escaneo-kinect-tomas.json');
  toast('Tomas guardadas');
});
$('btnCargarTomas').addEventListener('click', () => $('inputTomas').click());
$('inputTomas').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const datos = JSON.parse(await f.text());
    if (datos.formato !== 'escaneo-kinect') throw new Error('no es un archivo de tomas de esta página');
    estado.tomas = datos.tomas.map(t => {
      const u8 = deBase64(t.z);
      const u16 = new Uint16Array(u8.buffer, u8.byteOffset, u8.byteLength / 2);
      return { z: Float32Array.from(u16), angulo: +t.angulo || 0 };
    });
    if (datos.rango) { $('optZmin').value = datos.rango.zmin; $('optZmax').value = datos.rango.zmax; $('valZmin').textContent = datos.rango.zmin + ' mm'; $('valZmax').textContent = datos.rango.zmax + ' mm'; }
    if (datos.caja) { $('optAncho').value = datos.caja.ancho; $('optAlto').value = datos.caja.alto; $('optProfundo').value = datos.caja.profundo; }
    if (datos.corte !== undefined) $('optCorte').value = datos.corte;
    if (datos.modo) { $('optModo').value = datos.modo; actualizarModo(); }
    if (datos.plano && datos.centro && datos.auto) {
      estado.plano = datos.plano;
      estado.auto = { centro: datos.centro, auto: datos.auto };
      estado.desplazamiento = datos.desplazamiento || [0, 0];
      actualizarMarco();
    }
    estado.ajuste = null;
    if (!estado.ultimoMm && estado.tomas.length) { estado.ultimoMm = estado.tomas[0].z; $('seccionEncuadre').style.display = ''; dibujarVista(); }
    $('seccionCapturas').style.display = '';
    $('seccionModelo').style.display = '';
    dibujarCapturas();
    toast(`${estado.tomas.length} tomas cargadas`);
  } catch (err) {
    toast('No pude leer el archivo: ' + err.message);
  }
  e.target.value = '';
});

// ============================================================
// Generar el modelo
// ============================================================

function progreso(msg) { const p = $('progreso'); p.style.display = ''; p.textContent = msg; }

async function generar() {
  if (!estado.tomas.length) { toast('Primero capturá al menos una toma'); return; }
  if (!estado.marco) { toast('Falta detectar la mesa (o cargar un archivo de tomas con la mesa guardada)'); return; }
  const btn = $('btnGenerar');
  btn.disabled = true;
  try {
    const { zmin, zmax } = leerRango();
    const caja = leerCaja();
    const corte = leerCorte();
    const modo = $('optModo').value;
    const filtros = { mediana: $('optMediana').checked ? 3 : 0, huecos: $('optHuecos').checked ? 2 : 0, voladores: $('optVoladores').checked ? 30 : 0 };
    progreso('Purgando los mapas de profundidad…');
    await respirar();
    const tomas = estado.tomas.map(t => ({ z: N.filtrarMapa(t.z, filtros), angulo: t.angulo }));
    let marco = estado.marco;
    let sentido = 1;
    if ($('optAjustarEje').checked && tomas.length >= 2 && estado.auto) {
      progreso('Afinando el eje de giro con las tomas…');
      await respirar();
      const d = estado.desplazamiento;
      const aj = N.ajustarEje(tomas, estado.plano, estado.auto.centro, {
        caja, corte, zmin, zmax, desplazamiento: [estado.auto.auto[0] + d[0], estado.auto.auto[1] + d[1]]
      }, progreso);
      if (aj) {
        estado.ajuste = aj;
        marco = N.armarMarco(estado.plano, estado.auto.centro, aj.desplazamiento);
        sentido = aj.sentido;
        progreso(`Eje afinado: ${aj.ajuste[0] >= 0 ? '+' : ''}${aj.ajuste[0].toFixed(1)} mm, ${aj.ajuste[1] >= 0 ? '+' : ''}${aj.ajuste[1].toFixed(1)} mm · giro ${aj.sentido === 1 ? 'antihorario' : 'horario'} visto desde arriba${aj.enElBorde ? ' (llegó al límite de la búsqueda: revisá el eje a mano)' : ''}`);
        await respirar();
      } else {
        progreso('Para afinar el eje hacen falta dos tomas separadas al menos 60°; se usa el eje tal como está.');
        await respirar();
      }
    }
    const opciones = {
      modo, caja, corte, sentido, zmin, zmax,
      voxel: +$('optVoxel').value || 3,
      huecosVacios: $('optHuecosVacios').checked,
      relleno: $('optRelleno').value,
      mayorComponente: $('optMayor').checked,
      suavizado: +$('optSuavizado').value || 0,
      reducir: +$('optReducir').value || 0,
      escala: (+$('optEscala').value || 100) / 100
    };
    const t0 = performance.now();
    const res = N.reconstruir(tomas, marco, opciones, progreso);
    if (!res.malla.idx.length) {
      progreso('No quedó nada dentro de la caja de escaneo. Revisá que la pieza esté dentro de la caja (naranja en la vista) y por encima del corte.');
      return;
    }
    estado.malla = res.malla;
    // nube de puntos de todas las tomas, ya en el marco de la pieza (para el PLY)
    const partes = tomas.map(t => N.aMarcoPieza(N.puntosDeMapa(t.z, { paso: 2, zmin, zmax }), marco, t.angulo, sentido));
    let total = 0; for (const p of partes) total += p.length;
    const hx = caja.ancho / 2, hz = caja.profundo / 2;
    const sel = [];
    for (const p of partes) for (let i = 0; i < p.length; i += 3) {
      if (p[i + 1] >= corte && p[i + 1] <= caja.alto && Math.abs(p[i]) <= hx && Math.abs(p[i + 2]) <= hz) sel.push(p[i] * opciones.escala, p[i + 1] * opciones.escala, p[i + 2] * opciones.escala);
    }
    estado.puntos = Float32Array.from(sel);
    const med = N.medidasMalla(res.malla);
    const cierre = N.esCerrada(res.malla);
    $('statsModelo').innerHTML = [
      `${med.triangulos.toLocaleString('es')} triángulos`,
      `${med.ancho.toFixed(0)} × ${med.profundo.toFixed(0)} × ${med.alto.toFixed(0)} mm (ancho × fondo × alto)`,
      `${med.volumenCm3.toFixed(1)} cm³`,
      cierre.cerrada ? 'malla cerrada ✔' : `${cierre.aristasAbiertas} aristas abiertas`,
      res.info.componentes > 1 ? `${res.info.componentes - 1} pedazos sueltos descartados` : 'una sola pieza',
      `${tomas.length} toma${tomas.length > 1 ? 's' : ''} · vóxel ${res.vol.voxel.toFixed(1)} mm`
    ].map(s => `<span class="inf-stat">${s}</span>`).join('');
    progreso(`Listo en ${((performance.now() - t0) / 1000).toFixed(1)} s.`);
    $('zonaResultado').style.display = '';
    if (!vista3d) vista3d = iniciarVista3D();
    vista3d.mostrar(res.malla, corte * opciones.escala);
    $('zonaResultado').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    console.error(e);
    progreso('Falló la generación: ' + e.message);
    toast('No pude generar el modelo');
  } finally {
    btn.disabled = false;
  }
}
$('btnGenerar').addEventListener('click', generar);

// ============================================================
// Vista 3D
// ============================================================

let vista3d = null;

function iniciarVista3D() {
  const lienzo = $('lienzo3d');
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0xf4f4f0);
  const camara = new THREE.PerspectiveCamera(40, 1, 1, 10000);
  const controles = new OrbitControls(camara, lienzo);
  controles.enableDamping = true;
  escena.add(new THREE.HemisphereLight(0xffffff, 0x888877, 1.1));
  const sol = new THREE.DirectionalLight(0xffffff, 1.4);
  sol.position.set(1, 2, 1.5);
  escena.add(sol);
  const contra = new THREE.DirectionalLight(0xffffff, 0.5);
  contra.position.set(-1.5, 1, -1);
  escena.add(contra);
  const grupo = new THREE.Group();
  escena.add(grupo);
  function medir() {
    const w = lienzo.clientWidth || 600, h = lienzo.clientHeight || 420;
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
  }
  medir();
  window.addEventListener('resize', medir);
  (function animar() { requestAnimationFrame(animar); controles.update(); renderer.render(escena, camara); })();
  return {
    mostrar(malla, base) {
      while (grupo.children.length) grupo.remove(grupo.children[0]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(malla.pos), 3));
      geo.setIndex(new THREE.BufferAttribute(Uint32Array.from(malla.idx), 1));
      geo.computeVertexNormals();
      grupo.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xd8a24a, metalness: 0.05, roughness: 0.65, side: THREE.DoubleSide })));
      geo.computeBoundingBox();
      const caja = geo.boundingBox;
      const tam = caja.getSize(new THREE.Vector3());
      const r = tam.length() / 2 || 1;
      const grilla = new THREE.GridHelper(Math.ceil(r * 3 / 50) * 50, Math.ceil(r * 3 / 50), 0x999999, 0xcccccc);
      grilla.position.y = base;
      grupo.add(grilla);
      const centro = caja.getCenter(new THREE.Vector3());
      controles.target.copy(centro);
      camara.position.set(centro.x + r * 1.4, centro.y + r * 1.2, centro.z - r * 1.8);
      camara.near = r / 100; camara.far = r * 40;
      camara.updateProjectionMatrix();
      medir();
    }
  };
}

// ============================================================
// Descargas
// ============================================================

function descargar(blob, nombre) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
$('btnSTL').addEventListener('click', () => {
  if (!estado.malla) return;
  descargar(new Blob([N.aSTL(estado.malla)], { type: 'model/stl' }), 'escaneo-kinect.stl');
  toast('STL descargado: llevalo al slicer o a Tinkercad');
});
$('btnOBJ').addEventListener('click', () => {
  if (!estado.malla) return;
  descargar(new Blob([N.aOBJ(estado.malla, 'escaneo-kinect')], { type: 'model/obj' }), 'escaneo-kinect.obj');
  toast('OBJ descargado');
});
$('btnPLY').addEventListener('click', () => {
  if (!estado.puntos) return;
  descargar(new Blob([N.aPLY(estado.puntos)], { type: 'application/octet-stream' }), 'escaneo-kinect-puntos.ply');
  toast('Nube de puntos descargada (abrila en MeshLab o CloudCompare)');
});

window.addEventListener('beforeunload', () => { if (estado.fuente) estado.fuente.cerrar(); });
