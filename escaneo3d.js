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
  reemplazar: null,      // índice de la toma que se está repitiendo
  libre: null,           // escaneo a mano alzada: { worker, activo, pausa, ocupado, segmentos, ... }
  ultimoChequeo: 0,
  dibujoPendiente: false
};

// ============================================================
// Simulador (pieza de demostración, sin Kinect)
// ============================================================

class SimuladorKinect {
  constructor() { this.corriendo = false; this.semilla = 1; this.anguloLibre = 0; }
  get modelo() { return 'Pieza de demostración (sin Kinect)'; }
  async iniciarProfundidad(onCuadro) {
    this.corriendo = true;
    const paso = () => {
      if (!this.corriendo) return;
      // en modo libre la «cámara» da la vuelta sola: girar la pieza delante de una cámara fija es lo mismo
      if (estado.libre && estado.libre.activo && !estado.libre.pausa) this.anguloLibre = (this.anguloLibre + 1.2) % 360;
      const angulo = (estado.libre && estado.libre.activo) ? this.anguloLibre : (+$('optAngulo').value || 0);
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
// Puente local (kinect-puente.py): los cuadros llegan por WebSocket desde un programa
// que lee el Kinect con libusb en esta misma computadora.
// ============================================================

class PuenteKinect {
  constructor(url = 'ws://127.0.0.1:9876') { this.url = url; this.ws = null; this.corriendo = false; this.modelo = 'Kinect por el puente local'; this.estadisticas = { cuadros: 0, incompletos: 0, perdidos: 0, errores: 0 }; this.descripcion = url; }
  iniciarProfundidad(onCuadro) {
    return new Promise((resolver, rechazar) => {
      let abierto = false;
      let ws;
      try { ws = new WebSocket(this.url); } catch (e) { rechazar(Object.assign(new Error(e.message), { fase: 'puente' })); return; }
      ws.binaryType = 'arraybuffer';
      this.ws = ws;
      ws.onopen = () => { abierto = true; this.corriendo = true; resolver(); };
      ws.onmessage = (ev) => {
        if (typeof ev.data === 'string') {
          try { const est = JSON.parse(ev.data); if (est.modelo) this.modelo = est.modelo + ' (puente local)'; } catch (e) { /* nada */ }
          return;
        }
        const bytes = new Uint8Array(ev.data);
        if (bytes.length !== 422400) { this.estadisticas.incompletos++; return; }
        this.estadisticas.cuadros++;
        onCuadro({ crudo11: bytes, tiempo: performance.now() });
      };
      ws.onerror = () => { if (!abierto) rechazar(Object.assign(new Error('no responde nadie en ' + this.url), { fase: 'puente' })); };
      ws.onclose = () => {
        if (!abierto) { rechazar(Object.assign(new Error('no responde nadie en ' + this.url), { fase: 'puente' })); return; }
        if (this.corriendo) { this.corriendo = false; if (this.onError) this.onError(Object.assign(new Error('se cerró la conexión con el puente'), { fase: 'puente' })); }
      };
    });
  }
  async detener() { this.corriendo = false; }
  async cerrar() { this.corriendo = false; if (this.ws) { try { this.ws.close(); } catch (e) { /* nada */ } this.ws = null; } }
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
  if ((err.fase || fase) === 'puente') {
    mostrarEstado('error', 'No se pudo conectar con el puente local', err.message + '. Fijate que kinect-puente.py esté corriendo en esta computadora y diga «Puente listo». Los pasos están en la guía de abajo.');
    $('guiaPuente').open = true;
    toast('El puente local no responde');
    return;
  }
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
  $('btnPuente').style.display = tipo === 'puente' ? 'none' : '';
  $('seccionEncuadre').style.display = '';
  actualizarModo();
  if (tipo === 'demo') {
    mostrarEstado('demo', 'Pieza de demostración', 'Una caja con una esfera y una manija, dibujada con el mismo ruido que el sensor real. Sirve para probar todo el flujo sin el Kinect.');
  } else if (tipo === 'puente') {
    mostrarEstado('conectado', 'Puente local conectado', 'Esperando los cuadros de kinect-puente.py…');
  } else {
    mostrarEstado('conectado', 'Kinect conectado: ' + fuente.modelo, 'Esperando el primer cuadro de profundidad… (' + (fuente.descripcion || '') + ')');
    setTimeout(() => {
      if (estado.fuente !== fuente || estado.ultimoMm) return;
      const est = fuente.estadisticas || {};
      $('estadoDetalle').textContent = `Todavía no llegó ningún cuadro (${est.paquetes || 0} paquetes, ${est.errores || 0} errores de transferencia; ${fuente.descripcion}). Si sigue así: desenchufá y volvé a enchufar el Kinect, probá un puerto USB 2.0 directo sin hub, y en Windows confirmá que el driver elegido en Zadig sea WinUSB.`;
    }, 6000);
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
  $('btnPuente').style.display = '';
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
$('btnPuente').addEventListener('click', async () => {
  const puente = new PuenteKinect();
  try { await usarFuente(puente, 'puente'); }
  catch (e) { estado.fuente = null; informarError(e, 'puente'); }
});

$('btnDiagnostico').addEventListener('click', async () => {
  const w = estadoWebUSB();
  if (!w.disponible) { mostrarEstado('error', 'Este navegador no puede conectar el Kinect', w.razon); return; }
  if (estado.fuente) await desconectar();
  let dispositivo;
  try {
    const lista = await KinectV1.autorizados();
    dispositivo = lista[0] || await KinectV1.pedirPermiso();
  } catch (e) { informarError(e, 'pedir'); return; }
  const zona = $('zonaDiagnostico'); zona.style.display = '';
  const texto = $('diagnosticoTexto'); texto.value = '';
  const k = new KinectV1();
  try {
    $('diagnosticoEstado').textContent = 'Abriendo el Kinect…';
    await k.abrir(dispositivo);
    texto.value = await k.diagnosticar(m => { $('diagnosticoEstado').textContent = m; });
    $('diagnosticoEstado').textContent = 'Listo. Copiá el informe y mandalo.';
  } catch (e) {
    texto.value = 'No se pudo completar el diagnóstico (' + (e.fase || '') + '): ' + e.message + '\n' + navigator.userAgent;
    $('diagnosticoEstado').textContent = 'Falló antes de poder probar las lecturas.';
  } finally {
    try { await k.cerrar(); } catch (e) { /* nada */ }
  }
});
$('btnCopiarDiagnostico').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('diagnosticoTexto').value); toast('Informe copiado'); }
  catch (e) { $('diagnosticoTexto').select(); toast('Seleccionado: copialo con Ctrl+C'); }
});
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
    await new Promise(r => setTimeout(r, 2000)); // recién enchufado: darle tiempo a que arranque
    if (!estado.fuente) await conectarKinect(ev.device);
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

// Los cuadros llegan a 15–30 por segundo; la página procesa siempre SÓLO el último que llegó,
// una vez por cuadro de pantalla, y descarta los intermedios. Así nunca se acumula cola ni
// se atrasa la imagen aunque la computadora sea lenta.
let cuadroPendiente = null, procesoProgramado = false, ultimaMesaAuto = 0, dibujados = 0;

function recibirCuadro(cuadro) {
  cuadrosRecibidos++;
  if (cuadro.mm) cuadroPendiente = { mm: cuadro.mm };
  else cuadroPendiente = { crudo11: cuadro.crudo11.slice ? cuadro.crudo11.slice() : Uint8Array.from(cuadro.crudo11) };
  if (!procesoProgramado) { procesoProgramado = true; requestAnimationFrame(procesarCuadroPendiente); }
}

function procesarCuadroPendiente() {
  procesoProgramado = false;
  const cuadro = cuadroPendiente;
  cuadroPendiente = null;
  if (!cuadro) return;
  let mm;
  if (cuadro.mm) mm = cuadro.mm;
  else { N.desempaquetar11(cuadro.crudo11, estado.crudo16); mm = N.crudoAmapa(estado.crudo16); }
  estado.ultimoMm = mm;
  dibujados++;
  const ahora = performance.now();
  if (ahora - tiempoFps > 1000) {
    fps = cuadrosRecibidos * 1000 / (ahora - tiempoFps);
    const fpsDib = dibujados * 1000 / (ahora - tiempoFps);
    cuadrosRecibidos = 0; dibujados = 0; tiempoFps = ahora;
    if (estado.tipo === 'kinect' || estado.tipo === 'puente') {
      const est = estado.fuente.estadisticas || {};
      $('estadoDetalle').textContent = `${fps.toFixed(0)} cuadros/s del sensor · ${fpsDib.toFixed(0)} en pantalla · ${est.cuadros || 0} recibidos · ${est.incompletos || 0} incompletos · ${est.perdidos || 0} con paquetes perdidos · ${est.errores || 0} errores de transferencia`;
    }
  }
  if (estado.libre && estado.libre.activo) { alimentarLibre(mm); }
  else if (!estado.plano && ahora - ultimaMesaAuto > 1500) { ultimaMesaAuto = ahora; detectarMesa(true); }
  if (estado.capturando) {
    const c = estado.capturando;
    c.cuadros.push(Float32Array.from(mm));
    $('estadoCaptura').textContent = `capturando ${c.cuadros.length}/${c.total}…`;
    if (c.cuadros.length >= c.total) { estado.capturando = null; terminarCaptura(c); }
  }
  dibujarVista();
  if (ahora - estado.ultimoChequeo > 1500 && !estado.capturando && !(estado.libre && estado.libre.activo)) { estado.ultimoChequeo = ahora; chequearEscena(); }
}

// ============================================================
// Escaneo libre (a mano alzada): el worker sigue la cámara y funde los cuadros
// ============================================================

function libreSemaforo(clase, texto) {
  $('libreSemaforo').className = 'kin-libre__semaforo' + (clase ? ' kin-libre__semaforo--' + clase : '');
  $('libreEstado').textContent = texto;
}

function libreBotones() {
  const L = estado.libre;
  const activo = !!(L && L.activo);
  $('btnLibreIniciar').disabled = activo;
  $('btnLibrePausar').disabled = !activo;
  $('btnLibrePausar').textContent = L && L.pausa ? '▶ Reanudar' : '⏸ Pausar';
  $('btnLibreReiniciar').disabled = !activo;
  $('btnLibreTerminar').disabled = !activo || !(L.integrados > 0);
}

async function libreIniciar() {
  if (!estado.fuente || !estado.ultimoMm) { toast('Primero conectá el Kinect (o la demostración)'); return; }
  if (estado.libre && estado.libre.worker) estado.libre.worker.terminate();
  let distancia = +$('libDistancia').value;
  if (!distancia) {
    // profundidad mediana alrededor del centro de la imagen
    const z = estado.ultimoMm, W = N.INTR.ancho, vals = [];
    for (let v = 200; v < 280; v += 4) for (let u = 280; u < 360; u += 4) { const d = z[v * W + u]; if (d > 0) vals.push(d); }
    vals.sort((a, b) => a - b);
    distancia = vals.length ? vals[vals.length >> 1] : 800;
    if (distancia < 450) { toast('El centro de la imagen está muy cerca: alejate a 70–90 cm'); return; }
  }
  const worker = new Worker('./escaneo3d-libre.js', { type: 'module' });
  estado.libre = { worker, activo: true, pausa: false, ocupado: false, segmentos: [], integrados: 0, perdidos: 0, cuadros: 0, distancia };
  worker.onmessage = (ev) => {
    const m = ev.data;
    const L = estado.libre;
    if (!L || L.worker !== worker) return;
    if (m.tipo === 'listo') { libreSemaforo('aviso', 'Buscando la primera vista…'); return; }
    if (m.tipo === 'estado') {
      L.ocupado = false;
      L.integrados = m.integrados; L.perdidos = m.perdidos; L.cuadros = m.cuadros; L.segmentos = m.segmentos;
      dibujarLibre(m);
      const c = m.calidad;
      if (c.primero) libreSemaforo('ok', 'Primera vista tomada: empezá a moverte despacio');
      else if (c.ok) libreSemaforo(c.inliers < 1000 ? 'aviso' : 'ok', c.inliers < 1000 ? 'Siguiendo, pero con pocos puntos: acercate o apuntá mejor' : 'Siguiendo · ' + m.integrados + ' vistas fundidas');
      else libreSemaforo('perdido', m.seguidos > 8 ? 'Perdí el seguimiento: volvé despacio a la última posición buena' : 'Se movió muy rápido: frená un momento');
      $('libreContadores').textContent = `${m.integrados} vistas fundidas · ${m.perdidos} cuadros descartados · ${m.cuadros} recibidos · vóxel ${L.voxel || ''} mm`;
      libreBotones();
      return;
    }
    if (m.tipo === 'malla') { libreMostrarMalla(m); return; }
    if (m.tipo === 'error') { L.ocupado = false; toast('Error en el escaneo libre: ' + m.mensaje); libreSemaforo('perdido', m.mensaje); }
  };
  worker.postMessage({ tipo: 'iniciar', opciones: { lado: +$('libLado').value || 500, voxel: +$('libVoxel').value || 5, distancia, esc: +$('libEsc').value === 2 ? 2 : 4, bilateral: $('libBilateral').checked } });
  estado.libre.voxel = +$('libVoxel').value || 5;
  libreSemaforo('aviso', 'Preparando el volumen…');
  libreBotones();
  toast('Escaneo libre en marcha: mové el Kinect despacio alrededor');
}

function alimentarLibre(mm) {
  const L = estado.libre;
  if (!L || !L.activo || L.pausa || L.ocupado) return;
  L.ocupado = true;
  const copia = Float32Array.from(mm);
  L.worker.postMessage({ tipo: 'cuadro', z: copia }, [copia.buffer]);
}

function dibujarLibre(m) {
  const lienzo = $('lienzoLibre');
  const ctx = lienzo.getContext('2d');
  if (!dibujarLibre._tmp) { dibujarLibre._tmp = document.createElement('canvas'); dibujarLibre._tmp.width = m.ancho; dibujarLibre._tmp.height = m.alto; }
  const tmp = dibujarLibre._tmp;
  tmp.getContext('2d').putImageData(new ImageData(m.imagen, m.ancho, m.alto), 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmp, 0, 0, lienzo.width, lienzo.height);
}

function librePausar() {
  const L = estado.libre; if (!L || !L.activo) return;
  L.pausa = !L.pausa;
  libreSemaforo(L.pausa ? 'pausa' : 'aviso', L.pausa ? 'En pausa: el modelo se conserva; reanudá desde la misma posición' : 'Reanudando…');
  libreBotones();
}

function libreReiniciar() {
  const L = estado.libre; if (!L || !L.worker) return;
  L.worker.postMessage({ tipo: 'reiniciar' });
  L.integrados = 0; L.perdidos = 0; L.cuadros = 0; L.pausa = false; L.ocupado = false;
  libreSemaforo('aviso', 'De nuevo: apuntá a la cabeza y quedate quieto un segundo');
  libreBotones();
}

function libreTerminar() {
  const L = estado.libre; if (!L || !L.activo) return;
  L.pausa = true;
  libreSemaforo('pausa', 'Armando el modelo…');
  progreso('Extrayendo la superficie del escaneo libre…');
  $('seccionModelo').style.display = '';
  L.worker.postMessage({ tipo: 'malla', opciones: {
    relleno: $('optRelleno').value, mayorComponente: $('optMayor').checked,
    suavizado: +$('optSuavizado').value || 0, reducir: +$('optReducir').value || 0, escala: (+$('optEscala').value || 100) / 100
  } });
}

function libreMostrarMalla(m) {
  const L = estado.libre;
  const malla = { pos: m.pos, idx: m.idx };
  if (!malla.idx.length) { progreso('No se formó ninguna superficie: el volumen quedó vacío. Empezá de nuevo apuntando a la cabeza a 70–90 cm.'); L.pausa = false; libreBotones(); return; }
  estado.malla = malla;
  estado.puntos = null;
  const med = N.medidasMalla(malla);
  const cierre = N.esCerrada(malla);
  $('statsModelo').innerHTML = [
    `${med.triangulos.toLocaleString('es')} triángulos`,
    `${med.ancho.toFixed(0)} × ${med.profundo.toFixed(0)} × ${med.alto.toFixed(0)} mm (ancho × fondo × alto)`,
    `${med.volumenCm3.toFixed(1)} cm³`,
    cierre.cerrada ? 'malla cerrada ✔' : `${cierre.aristasAbiertas} aristas abiertas`,
    m.info.componentes > 1 ? `${m.info.componentes - 1} pedazos sueltos descartados` : 'una sola pieza',
    `${m.integrados} vistas fundidas · vóxel ${m.voxel.toFixed(1)} mm`
  ].map(s => `<span class="inf-stat">${s}</span>`).join('');
  const consejos = [];
  if (!cierre.cerrada) consejos.push('La malla quedó abierta donde el modelo toca el borde del volumen (por ejemplo, el cuello o los hombros): es normal en una cabeza. Si querés una base plana, dejá que el cuello salga por abajo del volumen.');
  if (L.perdidos > L.integrados * 0.5) consejos.push('Se descartaron muchos cuadros por movimiento rápido: la próxima vez movete más despacio y en un arco continuo.');
  if (m.info.componentes > 3) consejos.push('Quedaron pedazos sueltos (fondo, hombros, pelo): probá con un volumen más chico o «Empezar de nuevo» más cerca de la cabeza.');
  consejos.push('Zonas huecas o rugosas: volvé a escanear pasando dos veces por ahí, o subí el suavizado.');
  $('informeEscaneo').innerHTML = `<p class="kin-bloque__titulo">📋 Informe del escaneo libre</p><ul>${consejos.map(c => `<li>${c}</li>`).join('')}</ul>`;
  progreso('Listo: modelo del escaneo libre.');
  $('zonaResultado').style.display = '';
  if (!vista3d) vista3d = iniciarVista3D();
  vista3d.mostrar(malla, med.min[1]);
  $('zonaResultado').scrollIntoView({ behavior: 'smooth', block: 'start' });
  L.pausa = false;
  libreBotones();
}

function libreDetener() {
  const L = estado.libre;
  if (!L) return;
  if (L.worker) L.worker.terminate();
  estado.libre = null;
  libreSemaforo(null, 'Sin empezar');
  libreBotones();
}

$('btnLibreIniciar').addEventListener('click', libreIniciar);
$('btnLibrePausar').addEventListener('click', librePausar);
$('btnLibreReiniciar').addEventListener('click', libreReiniciar);
$('btnLibreTerminar').addEventListener('click', libreTerminar);

// ============================================================
// Asistente: chequeo de la escena en vivo
// ============================================================

function chequearEscena() {
  const z = estado.ultimoMm;
  if (!z) return;
  const { zmin, zmax } = leerRango();
  const ev = N.evaluarEscena(z, estado.plano, estado.marco, leerCaja(), { corte: leerCorte(), zmin, zmax });
  const lista = $('listaChequeo');
  lista.innerHTML = '';
  const avisos = new Set(['huecos', 'centrado', 'inclinacion', 'mesa']);
  let malos = 0;
  for (const it of ev.items) {
    const li = document.createElement('li');
    let clase = 'kin-chequeo__item';
    if (it.ok === true) clase += ' kin-chequeo__item--ok';
    else if (it.ok === false) { clase += avisos.has(it.clave) && it.clave !== 'mesa' ? ' kin-chequeo__item--aviso' : ' kin-chequeo__item--mal'; malos++; }
    li.className = clase;
    li.innerHTML = `${it.texto}${it.consejo && it.ok === false ? `<span class="kin-chequeo__consejo">${it.consejo}</span>` : ''}`;
    lista.appendChild(li);
  }
  $('chequeoEstado').textContent = ev.listo ? (malos ? '· listo, con mejoras posibles' : '· todo en orden') : '· revisá lo marcado antes de capturar';
  $('chequeoEstado').style.color = ev.listo ? '#2e9e5b' : '#d9534f';
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
  const modo = $('optModo').value;
  const libreActivo = !!(estado.libre && estado.libre.activo);
  const modoLibre = modo === 'libre';
  // la clasificación (mesa / caja / fuera) se calcula a media resolución: 4 veces más rápido
  const clases = estado.marco && !modoLibre ? N.clasificarPixeles(z, estado.marco, caja, { corte, zmin, zmax, paso: 2 }) : null;
  const c = [0, 0, 0];
  for (let i = 0; i < z.length; i++) {
    const d = z[i];
    const o = i * 4;
    if (!(d > 0)) { px[o] = 40; px[o + 1] = 40; px[o + 2] = 40; px[o + 3] = 255; continue; }
    colorProfundidad(d, zmin, zmax, c);
    let cl;
    if (clases) { const fila = (i / W) | 0; cl = clases[(fila & ~1) * W + ((i - fila * W) & ~1)]; }
    else cl = d < zmin || d > zmax ? 1 : (modoLibre ? 4 : 3);
    if (cl === 4) { px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; }
    else if (cl === 2) { px[o] = c[0] * 0.35 + 60; px[o + 1] = c[1] * 0.35 + 160; px[o + 2] = c[2] * 0.35 + 70; }
    else if (cl === 3) { px[o] = Math.min(255, c[0] * 0.3 + 200); px[o + 1] = c[1] * 0.3 + 90; px[o + 2] = c[2] * 0.3 + 20; }
    else { px[o] = c[0] * 0.25 + 30; px[o + 1] = c[1] * 0.25 + 50; px[o + 2] = c[2] * 0.25 + 90; }
    px[o + 3] = 255;
  }
  ctxVista.putImageData(imagenVista, 0, 0);
  if (modoLibre) {
    // a mano: sólo el volumen (cuando ya arrancó) y la mira del centro; nada de mesa, base ni eje
    if (libreActivo) {
      const segs = estado.libre.segmentos || [];
      ctxVista.lineWidth = 2; ctxVista.strokeStyle = 'rgba(255,255,255,0.9)';
      ctxVista.beginPath();
      for (const [a, b] of segs) { ctxVista.moveTo(a[0], a[1]); ctxVista.lineTo(b[0], b[1]); }
      ctxVista.stroke();
    }
    ctxVista.lineWidth = 2; ctxVista.strokeStyle = '#ffdd55';
    ctxVista.beginPath(); ctxVista.arc(W / 2, H / 2, 12, 0, Math.PI * 2); ctxVista.stroke();
    ctxVista.beginPath(); ctxVista.moveTo(W / 2 - 20, H / 2); ctxVista.lineTo(W / 2 + 20, H / 2); ctxVista.moveTo(W / 2, H / 2 - 20); ctxVista.lineTo(W / 2, H / 2 + 20); ctxVista.stroke();
    if (!libreActivo) {
      ctxVista.fillStyle = 'rgba(0,0,0,0.55)'; ctxVista.fillRect(0, H - 34, W, 34);
      ctxVista.fillStyle = '#fff'; ctxVista.font = '15px "Space Grotesk", sans-serif';
      ctxVista.fillText('Apuntá la mira a la cabeza (o al centro del objeto) y apretá «Empezar».', 12, H - 12);
    }
  } else if (estado.marco) {
    const p = N.proyectarCaja(estado.marco, caja);
    ctxVista.lineWidth = 2;
    ctxVista.strokeStyle = 'rgba(255,255,255,0.9)';
    ctxVista.beginPath();
    for (const [a, b] of p.segmentos) { ctxVista.moveTo(a[0], a[1]); ctxVista.lineTo(b[0], b[1]); }
    ctxVista.stroke();
    if (modo === 'volumen' && p.circulo.length > 2) {
      ctxVista.strokeStyle = 'rgba(255,255,255,0.75)';
      ctxVista.setLineDash([6, 4]);
      ctxVista.beginPath();
      p.circulo.forEach((q, i) => i ? ctxVista.lineTo(q[0], q[1]) : ctxVista.moveTo(q[0], q[1]));
      ctxVista.stroke();
      ctxVista.setLineDash([]);
    }
    if (modo === 'volumen' && p.eje) {
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
  const modo = $('optModo').value;
  const relieve = modo === 'relieve', libre = modo === 'libre';
  $('notaModo').style.display = relieve || libre ? 'none' : '';
  $('notaRelieve').style.display = relieve ? '' : 'none';
  $('ayudaLibre').style.display = libre ? '' : 'none';
  $('zonaLibre').style.display = libre ? '' : 'none';
  $('barraLibre').style.display = libre ? '' : 'none';
  $('barraTomas').style.display = libre ? 'none' : '';
  $('chequeoBloque').style.display = libre ? 'none' : '';
  $('opcionesVolumen').style.display = modo === 'volumen' ? '' : 'none';
  $('btnDetectarMesa').style.display = libre ? 'none' : '';
  $('seccionCapturas').style.display = libre ? 'none' : '';
  $('spanAngulo').style.display = modo === 'volumen' ? '' : 'none';
  $('estadoCaptura').textContent = '';
  if (!libre && estado.libre) libreDetener();
  if (estado.ultimoMm) dibujarVista();
  actualizarPlan();
  libreBotones();
}

// ============================================================
// Presets: la mejor configuración para cada tipo de escaneo
// ============================================================

const PRESETS = {
  cara: { modo: 'libre', libLado: 300, libVoxel: 2, libEsc: 2, libBilateral: true, libDistancia: 0, optSuavizado: 1, optRelleno: 'solido', optReducir: 0,
    nota: 'Cara y gestos, máximo detalle: vóxeles de 2 mm, seguimiento nítido y filtro de ruido. El Kinect mide más fino cuanto más cerca: trabajá a 55–65 cm (no menos de 50). La persona sostiene la expresión sin moverse; recorré despacio de oreja a oreja pasando por arriba y por debajo del mentón. Va a unos 3–5 cuadros por segundo: movete lento.' },
  cabeza: { modo: 'libre', libLado: 400, libVoxel: 3, libEsc: 4, libBilateral: true, libDistancia: 0, optSuavizado: 2, optRelleno: 'solido', optReducir: 0,
    nota: 'Cabeza o busto a mano: la persona quieta, vos girás alrededor a 60–80 cm. Volumen de 40 cm, detalle de 3 mm y filtro de ruido; suavizado leve para no perder la nariz y los labios. Para cabeza y hombros subí el volumen a 50 cm.' },
  cuerpo: { modo: 'libre', libLado: 800, libVoxel: 6, libEsc: 4, libBilateral: false, libDistancia: 0, optSuavizado: 5, optRelleno: 'solido', optReducir: 2,
    nota: 'Medio cuerpo a mano: la persona sentada y quieta, vos a 1 m dando la vuelta. Volumen de 80 cm y 6 mm de detalle para que el seguimiento sea ágil.' },
  grande: { modo: 'libre', libLado: 1000, libVoxel: 8, libEsc: 4, libBilateral: false, libDistancia: 0, optSuavizado: 5, optRelleno: 'solido', optReducir: 2,
    nota: 'Objeto grande a mano (silla, escultura, maqueta): volumen de 1 m y 8 mm de detalle. Dá la vuelta completa a 1–1,2 m, despacio.' },
  chica: { modo: 'volumen', optAncho: 160, optProfundo: 160, optAlto: 160, optCorte: 4, optZmin: 450, optZmax: 1000, optPaso: 30, optCuadros: 20, optVoxel: 2, optSuavizado: 5, optRelleno: 'solido', optReducir: 0,
    nota: 'Pieza chica (5–15 cm) sobre base giratoria: acercá el Kinect al mínimo (60 cm), caja de 16 cm, una toma cada 30° con 20 cuadros para bajar el ruido, y detalle de 2 mm.' },
  mediana: { modo: 'volumen', optAncho: 400, optProfundo: 400, optAlto: 350, optCorte: 4, optZmin: 500, optZmax: 1300, optPaso: 45, optCuadros: 10, optVoxel: 3, optSuavizado: 5, optRelleno: 'solido', optReducir: 0,
    nota: 'Pieza mediana (15–40 cm) sobre base giratoria, a 70–100 cm: caja de 40 cm, una toma cada 45° con 10 cuadros, detalle de 3 mm.' },
  relieve: { modo: 'relieve', optAncho: 300, optProfundo: 300, optAlto: 120, optCorte: 3, optZmin: 450, optZmax: 1000, optCuadros: 20, optVoxel: 2, optSuavizado: 2, optRelleno: 'solido', optReducir: 0,
    nota: 'Relieve o placa: el Kinect mirando desde arriba a 60–80 cm, una sola toma de 20 cuadros, detalle de 2 mm y suavizado leve para no perder los bordes.' },
  personalizado: { nota: 'Personalizado: los ajustes quedan como los dejaste (modo, caja, paso, cuadros y resolución).' }
};

function aplicarPreset(nombre) {
  const p = PRESETS[nombre]; if (!p) return;
  for (const [id, valor] of Object.entries(p)) {
    if (id === 'modo' || id === 'nota') continue;
    const el = $(id); if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!valor; else el.value = String(valor);
    if (id === 'optZmin') $('valZmin').textContent = valor + ' mm';
    if (id === 'optZmax') $('valZmax').textContent = valor + ' mm';
  }
  if (p.modo) $('optModo').value = p.modo;
  $('presetNota').textContent = p.nota || '';
  actualizarModo();
  if (estado.plano && estado.ultimoMm && p.modo !== 'libre') { estado.desplazamiento = [0, 0]; recentrar(true); }
  dibujarVista();
}
document.querySelectorAll('input[name="preset"]').forEach(r => r.addEventListener('change', () => aplicarPreset(r.value)));
$('optModo').addEventListener('change', () => { const r = document.querySelector('input[name="preset"][value="personalizado"]'); if (r) r.checked = true; $('presetNota').textContent = PRESETS.personalizado.nota; });
$('btnGenerarBarra').addEventListener('click', () => { $('seccionModelo').style.display = ''; generar(); });
$('btnRepetirUltima').addEventListener('click', () => { if (!estado.tomas.length) { toast('Todavía no hay tomas'); return; } repetirToma(estado.tomas.length - 1); });
$('btnBorrarUltima').addEventListener('click', () => { if (!estado.tomas.length) { toast('No hay tomas para borrar'); return; } estado.tomas.pop(); estado.ajuste = null; dibujarCapturas(); actualizarPlan(); toast('Última toma borrada'); });
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

function evaluarTomaUI(toma, cuadros) {
  const { zmin, zmax } = leerRango();
  toma.calidad = N.evaluarToma(toma.z, estado.marco, leerCaja(), { corte: leerCorte(), zmin, zmax, cuadros });
}

function terminarCaptura(c) {
  const z = N.medianaDeCuadros(c.cuadros);
  const toma = { z, angulo: c.angulo };
  evaluarTomaUI(toma, c.cuadros);
  let numero;
  if (estado.reemplazar !== null && estado.tomas[estado.reemplazar]) {
    estado.tomas[estado.reemplazar] = toma;
    numero = estado.reemplazar + 1;
    estado.reemplazar = null;
  } else {
    estado.tomas.push(toma);
    numero = estado.tomas.length;
  }
  estado.ajuste = null;
  $('estadoCaptura').textContent = `toma ${numero} lista (${c.angulo}°): ${toma.calidad.nivel}`;
  dibujarCapturas();
  $('seccionModelo').style.display = '';
  const plan = actualizarPlan();
  if (toma.calidad.nivel === 'mala') toast(`Toma ${numero} floja: ${toma.calidad.consejos[0]}`);
  else if ($('optModo').value === 'volumen' && plan && plan.siguiente !== null) toast(`Toma ${numero} guardada. Girá la pieza hasta ${plan.siguiente}° y capturá la siguiente.`);
  else if ($('optModo').value === 'volumen') toast(`Toma ${numero} guardada. Ya están todas las del plan: podés generar el modelo.`);
  else toast(`Toma ${numero} guardada.`);
}

function repetirToma(i) {
  const t = estado.tomas[i];
  if (!t) return;
  if (!estado.fuente) { toast('Conectá el Kinect para repetir la toma'); return; }
  estado.reemplazar = i;
  $('optAngulo').value = t.angulo;
  toast(`Girá la pieza hasta ${t.angulo}° y quedate quieto: se repite la toma ${i + 1}`);
  $('lienzoVista').scrollIntoView({ behavior: 'smooth', block: 'center' });
  capturar();
}

// ============================================================
// Asistente: plan de tomas (rosa de ángulos)
// ============================================================

function actualizarPlan() {
  const relieve = $('optModo').value !== 'volumen';
  $('planTomas').style.display = relieve ? 'none' : '';
  if (relieve) return null;
  const paso = +$('optPaso').value || 45;
  const plan = N.planDeTomas(estado.tomas, paso);
  const angulo = +$('optAngulo').value || 0;
  const svg = $('rosaAngulos');
  const R = 78;
  const puntos = plan.plan.map(e => {
    const a = (e.angulo - 90) * Math.PI / 180; // 0° abajo (mirando al Kinect) → lo dibujamos con 0° hacia el ojo
    const x = R * Math.sin(e.angulo * Math.PI / 180), y = R * Math.cos(e.angulo * Math.PI / 180);
    const t = e.toma !== null ? estado.tomas[e.toma] : null;
    const color = !t ? '#c9c9c4' : t.calidad ? ({ buena: '#2e9e5b', regular: '#e6a700', mala: '#d9534f' })[t.calidad.nivel] : '#2e9e5b';
    const actual = ((angulo % 360) + 360) % 360 === e.angulo;
    return `<g class="kin-rosa__punto" data-angulo="${e.angulo}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${actual ? 11 : 8}" fill="${color}" stroke="${actual ? '#ffdd55' : 'rgba(0,0,0,0.25)'}" stroke-width="${actual ? 3 : 1.5}"/><text x="${(x * 1.3).toFixed(1)}" y="${(y * 1.3 + 4).toFixed(1)}" text-anchor="middle" font-size="11" fill="currentColor">${e.angulo}°</text></g>`;
  });
  svg.innerHTML = `
    <circle cx="0" cy="0" r="${R}" fill="none" stroke="rgba(0,0,0,0.2)" stroke-dasharray="4 4"/>
    <rect x="-22" y="-16" width="44" height="26" rx="6" fill="rgba(198,90,53,0.18)" stroke="rgba(0,0,0,0.3)"/>
    <text x="0" y="3" text-anchor="middle" font-size="9" fill="currentColor">PIEZA</text>
    <text x="0" y="16" text-anchor="middle" font-size="7" fill="currentColor" opacity="0.7">vista desde arriba</text>
    <text x="0" y="122" text-anchor="middle" font-size="16">👁</text>
    <text x="0" y="-114" text-anchor="middle" font-size="8" fill="currentColor" opacity="0.6">atrás</text>
    ${puntos.join('')}`;
  svg.querySelectorAll('.kin-rosa__punto').forEach(g => g.addEventListener('click', () => {
    $('optAngulo').value = g.dataset.angulo;
    actualizarPlan();
  }));
  const paso_ = plan.completas + 1;
  if (plan.siguiente === null) {
    $('planPaso').textContent = `${plan.total} de ${plan.total} tomas listas`;
    const flojas = estado.tomas.filter(t => t.calidad && t.calidad.nivel === 'mala').length;
    $('planInstruccion').textContent = flojas ? `Hay ${flojas} toma${flojas > 1 ? 's' : ''} floja${flojas > 1 ? 's' : ''}: repetila${flojas > 1 ? 's' : ''} desde su tarjeta o generá el modelo igual y mirá el informe.` : 'Están todas las tomas del plan. Generá el modelo 3D, y si el informe marca un lado poco visto, sumá una toma ahí.';
  } else {
    $('planPaso').textContent = `Toma ${Math.min(paso_, plan.total)} de ${plan.total} · a ${plan.siguiente}°`;
    if (plan.completas === 0) $('planInstruccion').textContent = 'Apoyá la pieza centrada en la base, con la marca de 0° mirando al Kinect, y capturá. No muevas el Kinect en todo el escaneo.';
    else $('planInstruccion').textContent = `Girá la base hasta la marca de ${plan.siguiente}° (${plan.siguiente / paso} marca${plan.siguiente / paso > 1 ? 's' : ''} de ${paso}° desde el inicio, siempre para el mismo lado), esperá a que la pieza quede quieta y capturá.`;
    if (((angulo % 360) + 360) % 360 !== plan.siguiente && estado.reemplazar === null) $('optAngulo').value = plan.siguiente;
  }
  return plan;
}
$('optPaso').addEventListener('change', actualizarPlan);
$('optAngulo').addEventListener('input', actualizarPlan);
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
    pie.querySelector('input').addEventListener('change', (e) => { t.angulo = +e.target.value || 0; estado.ajuste = null; actualizarPlan(); });
    pie.querySelector('button').addEventListener('click', () => { estado.tomas.splice(i, 1); estado.ajuste = null; dibujarCapturas(); actualizarPlan(); });
    card.appendChild(pie);
    if (!t.calidad && estado.marco) evaluarTomaUI(t);
    if (t.calidad) {
      card.classList.add('kin-captura--' + t.calidad.nivel);
      const cal = document.createElement('div');
      cal.className = 'kin-captura__calidad';
      cal.innerHTML = `<span class="kin-captura__sello"></span><span>${t.calidad.nivel} · ${t.calidad.puntaje}/100</span><button class="kin-captura__repetir" type="button">↻ repetir</button>`;
      cal.querySelector('button').addEventListener('click', () => repetirToma(i));
      card.appendChild(cal);
      if (t.calidad.nivel !== 'buena') {
        const p = document.createElement('p');
        p.className = 'kin-captura__consejos';
        p.textContent = t.calidad.consejos[0];
        card.appendChild(p);
      }
    }
    lista.appendChild(card);
  });
}
dibujarCapturas();
aplicarPreset('mediana');

$('btnBorrarTomas').addEventListener('click', () => {
  if (!estado.tomas.length) return;
  if (!confirm('¿Borrar todas las tomas?')) return;
  estado.tomas = []; estado.ajuste = null; dibujarCapturas(); actualizarPlan();
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
    actualizarPlan();
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
  if ($('optModo').value === 'libre') { if (estado.libre && estado.libre.activo) libreTerminar(); else toast('En el modo a mano alzada, primero «Empezar el escaneo libre»'); return; }
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
    armarInforme(res, tomas, med, cierre, modo);
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
// Asistente: informe del escaneo
// ============================================================

function armarInforme(res, tomas, med, cierre, modo) {
  const consejos = [];
  let cobertura = null;
  if (modo === 'volumen') {
    cobertura = N.analizarCobertura(res.vol, res.campo, { altoPieza: med.max[1] });
    consejos.push(...cobertura.consejos);
  }
  const flojas = estado.tomas.map((t, i) => ({ t, i })).filter(x => x.t.calidad && x.t.calidad.nivel !== 'buena');
  for (const { t, i } of flojas) consejos.push(`Toma ${i + 1} (${t.angulo}°) salió ${t.calidad.nivel}: ${t.calidad.consejos[0]} Podés repetirla desde su tarjeta.`);
  if (estado.ajuste && estado.ajuste.enElBorde) consejos.push('El afinado del eje llegó al límite de la búsqueda: el eje inicial estaba muy corrido. Centrá la pieza en la base y ajustá el eje con las flechas antes de volver a capturar.');
  if (res.info.componentes > 3) consejos.push(`Se descartaron ${res.info.componentes - 1} pedazos sueltos: suele ser ruido o la base giratoria asomando por encima del corte. Subí el «corte» unos milímetros o activá «Quitar puntos voladores».`);
  if (!cierre.cerrada) consejos.push(`La malla tiene ${cierre.aristasAbiertas} aristas abiertas: la pieza toca el borde de la caja. Agrandá la caja y volvé a generar.`);
  if (modo === 'volumen' && tomas.length < 6) consejos.push(`Con ${tomas.length} toma${tomas.length > 1 ? 's' : ''} el modelo se rellena a ciegas por los lados que no se vieron: para una pieza completa hacé 8 tomas cada 45° (o 12 cada 30°).`);
  if (modo === 'relieve' && tomas.length === 1) consejos.push('En modo relieve todo lo que quedó detrás de la superficie vista se rellenó hasta la mesa. Si la pieza tiene partes que sobresalen hacia los lados, pasá al modo «Girando la pieza».');
  if (res.vol.voxel > 3.5 && med.ancho < 120) consejos.push('La pieza es chica para esta resolución: probá «Fina (2 mm)» para recuperar detalle.');
  const vista = cobertura ? Math.round((1 - cobertura.fraccionNoVista) * 100) : null;
  let html = `<p class="kin-bloque__titulo">📋 Informe del escaneo</p>`;
  if (vista !== null) html += `<p style="margin:0;font-size:0.88rem">Superficie vista por el sensor: <strong>${vista}%</strong>${vista < 100 ? ' (el resto se rellenó a ciegas)' : ''}.</p><div class="kin-barra"><span style="width:${vista}%"></span></div>`;
  if (consejos.length) html += `<p style="margin:0.4rem 0 0;font-size:0.88rem"><strong>Para mejorar el modelo:</strong></p><ul>${consejos.map(c => `<li>${c}</li>`).join('')}</ul>`;
  else html += `<p class="kin-informe__ok" style="margin:0.4rem 0 0">Buen escaneo: todas las tomas en verde y la pieza cubierta desde todos los lados.</p>`;
  $('informeEscaneo').innerHTML = html;
}

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
  if (!estado.puntos) { toast('El escaneo libre no guarda nube de puntos: usá el STL o el OBJ'); return; }
  descargar(new Blob([N.aPLY(estado.puntos)], { type: 'application/octet-stream' }), 'escaneo-kinect-puntos.ply');
  toast('Nube de puntos descargada (abrila en MeshLab o CloudCompare)');
});

window.addEventListener('beforeunload', () => { if (estado.fuente) estado.fuente.cerrar(); });
