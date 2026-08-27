// Sello 3D desde una imagen: subís un .svg (o una imagen png/jpg), la plataforma
// lo convierte en un relieve 3D sobre una base (sello, llavero o figura) y
// descargás el .stl listo para la impresora 3D. Todo en el navegador.
//
// Dos caminos para conseguir los contornos de la figura:
//  - SVG con rellenos → se usan los trazados vectoriales tal cual (SVGLoader).
//  - Imagen de píxeles (o SVG solo de líneas, o modo «invertir») → se calca:
//    umbral de claro/oscuro + marching squares + simplificación Douglas-Peucker.

import * as THREE from 'three';
import { OrbitControls } from './lego/vendor/OrbitControls.js';
import { SVGLoader } from './lego/vendor/SVGLoader.js';

const $ = id => document.getElementById(id);

const estado = {
  nombre: '',        // nombre del archivo sin extensión
  svgTexto: null,    // texto del svg subido (si es svg)
  imagen: null,      // HTMLImageElement ya cargado (svg rasterizado o imagen)
  piezas: null,      // [{geometria, color}] en mm, con Z hacia arriba
  medidas: null      // {ancho, alto, altura} en mm del modelo completo
};

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove('visible'), 3500);
}

// ============================================================
// Subida del archivo
// ============================================================

const zona = $('zonaSubida');
const input = $('inputArchivo');

zona.addEventListener('click', () => input.click());
zona.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
zona.addEventListener('dragover', e => { e.preventDefault(); zona.classList.add('inf-subida--sobre'); });
zona.addEventListener('dragleave', () => zona.classList.remove('inf-subida--sobre'));
zona.addEventListener('drop', e => {
  e.preventDefault();
  zona.classList.remove('inf-subida--sobre');
  if (e.dataTransfer.files.length) cargarArchivo(e.dataTransfer.files[0]);
});
input.addEventListener('change', () => { if (input.files.length) cargarArchivo(input.files[0]); });

async function cargarArchivo(archivo) {
  const ext = (archivo.name.split('.').pop() || '').toLowerCase();
  if (!['svg', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext)) {
    toast('Formato no reconocido: subí un .svg, .png o .jpg');
    return;
  }
  try {
    estado.nombre = archivo.name.replace(/\.[^.]+$/, '');
    if (ext === 'svg') {
      estado.svgTexto = await archivo.text();
      estado.imagen = await rasterizarSVG(estado.svgTexto);
    } else {
      estado.svgTexto = null;
      estado.imagen = await cargarImagen(archivo);
    }
  } catch (err) {
    console.error(err);
    toast('No pude leer el archivo: ' + err.message);
    return;
  }
  const est = $('estadoSubida');
  est.style.display = '';
  est.textContent = `✔ ${archivo.name} — ${estado.svgTexto ? 'vectorial (SVG)' : 'imagen de ' + estado.imagen.naturalWidth + '×' + estado.imagen.naturalHeight + ' px'}`;
  $('seccionOpciones').style.display = '';
  $('seccionResultado').style.display = '';
  ajustarControles();
  regenerar();
  $('seccionOpciones').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cargarImagen(archivo) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolver(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('la imagen no se pudo decodificar')); };
    img.src = url;
  });
}

// Convierte el texto de un SVG en una imagen dibujable (para el calco por píxeles).
// Si el SVG no declara width/height, se los ponemos desde el viewBox.
function rasterizarSVG(texto) {
  return new Promise((resolver, rechazar) => {
    let svg = texto;
    try {
      const doc = new DOMParser().parseFromString(texto, 'image/svg+xml');
      const raiz = doc.documentElement;
      if (raiz.nodeName === 'svg') {
        if (!raiz.getAttribute('width') || !raiz.getAttribute('height')) {
          const vb = (raiz.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
          const w = vb.length === 4 && vb[2] > 0 ? vb[2] : 512;
          const h = vb.length === 4 && vb[3] > 0 ? vb[3] : 512;
          raiz.setAttribute('width', w);
          raiz.setAttribute('height', h);
        }
        svg = new XMLSerializer().serializeToString(raiz);
      }
    } catch (_) { /* si el parseo falla, probamos con el texto tal cual */ }
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolver(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('el SVG no se pudo dibujar')); };
    img.src = url;
  });
}

// ============================================================
// Contornos desde el SVG vectorial
// ============================================================

// Devuelve loops de puntos [[x,y],...] en coordenadas del SVG (Y hacia abajo):
// { exteriores: [{pts, agujeros:[pts]}] } o null si el SVG no tiene rellenos.
function contornosDesdeSVG(texto) {
  const datos = new SVGLoader().parse(texto);
  const resultados = [];
  for (const camino of datos.paths) {
    const estilo = camino.userData && camino.userData.style || {};
    if (estilo.fill === 'none' || estilo.fillOpacity === 0 || estilo.visibility === 'hidden') continue;
    let shapes;
    try { shapes = SVGLoader.createShapes(camino); } catch (_) { continue; }
    for (const shape of shapes) {
      const p = shape.extractPoints(24);
      if (p.shape.length < 3) continue;
      resultados.push({
        pts: p.shape.map(v => [v.x, v.y]),
        agujeros: p.holes.filter(h => h.length >= 3).map(h => h.map(v => [v.x, v.y]))
      });
    }
  }
  return resultados.length ? resultados : null;
}

// ============================================================
// Calco por píxeles: umbral + marching squares + simplificación
// ============================================================

// Dibuja la imagen sobre fondo blanco y devuelve la máscara binaria
// (1 = zona oscura = figura) más el lienzo usado.
function mascaraDesdeImagen(img, detalle, umbral, invertir) {
  const escala = detalle / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height, 1);
  const w = Math.max(2, Math.round((img.naturalWidth || img.width) * escala));
  const h = Math.max(2, Math.round((img.naturalHeight || img.height) * escala));
  const lienzo = document.createElement('canvas');
  lienzo.width = w; lienzo.height = h;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const datos = ctx.getImageData(0, 0, w, h).data;
  const mascara = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < mascara.length; i++, p += 4) {
    const a = datos[p + 3] / 255;
    // luminancia compuesta sobre blanco: lo transparente cuenta como fondo
    const lum = (0.2126 * datos[p] + 0.7152 * datos[p + 1] + 0.0722 * datos[p + 2]) * a + 255 * (1 - a);
    let dentro = lum < umbral;
    if (invertir) dentro = !dentro;
    mascara[i] = dentro ? 1 : 0;
  }
  return { mascara, w, h };
}

// Marching squares con segmentos dirigidos (la figura queda a la izquierda
// del recorrido), encadenados en loops cerrados.
function trazarContornos(mascara, w, h) {
  // valor con borde de ceros alrededor para cerrar la figura en los bordes
  const v = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : mascara[y * w + x];
  const segmentos = new Map();          // clave del punto de salida → punto de llegada
  const clave = p => p[0] + '|' + p[1]; // coordenadas ×2 para trabajar con enteros
  const agregar = (a, b) => {
    let k = clave(a);
    while (segmentos.has(k + '#')) k += '#'; // por si dos salidas coinciden (raro)
    segmentos.set(k, b);
  };
  for (let y = -1; y < h; y++) {
    for (let x = -1; x < w; x++) {
      const caso = v(x, y) * 8 + v(x + 1, y) * 4 + v(x + 1, y + 1) * 2 + v(x, y + 1);
      if (caso === 0 || caso === 15) continue;
      // puntos medios de los lados de la celda, en coordenadas ×2
      const T = [2 * x + 1, 2 * y], R = [2 * x + 2, 2 * y + 1], B = [2 * x + 1, 2 * y + 2], L = [2 * x, 2 * y + 1];
      switch (caso) {
        case 1: agregar(L, B); break;
        case 2: agregar(B, R); break;
        case 3: agregar(L, R); break;
        case 4: agregar(R, T); break;
        case 5: agregar(R, T); agregar(L, B); break;
        case 6: agregar(B, T); break;
        case 7: agregar(L, T); break;
        case 8: agregar(T, L); break;
        case 9: agregar(T, B); break;
        case 10: agregar(T, L); agregar(B, R); break;
        case 11: agregar(T, R); break;
        case 12: agregar(R, L); break;
        case 13: agregar(R, B); break;
        case 14: agregar(B, L); break;
      }
    }
  }
  // encadenar los segmentos en loops
  const loops = [];
  while (segmentos.size) {
    const [kInicio, primero] = segmentos.entries().next().value;
    segmentos.delete(kInicio);
    const inicio = kInicio.replace(/#+$/, '').split('|').map(Number);
    const loop = [inicio, primero];
    let actual = primero;
    let vueltas = 0;
    while (vueltas++ < 4 * w * h) {
      let k = clave(actual);
      if (!segmentos.has(k)) {
        // salida alternativa de un punto de silla
        let k2 = k + '#';
        while (!segmentos.has(k2) && k2.length < k.length + 5) k2 += '#';
        if (!segmentos.has(k2)) break;
        k = k2;
      }
      const siguiente = segmentos.get(k);
      segmentos.delete(k);
      if (siguiente[0] === inicio[0] && siguiente[1] === inicio[1]) break;
      loop.push(siguiente);
      actual = siguiente;
    }
    if (loop.length >= 3) loops.push(loop.map(p => [p[0] / 2, p[1] / 2]));
  }
  return loops;
}

// Douglas-Peucker sobre un loop cerrado
function simplificarLoop(pts, tolerancia) {
  if (pts.length < 6) return pts;
  const dp = (desde, hasta, salida) => {
    const a = pts[desde], b = pts[hasta];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const largo = Math.hypot(dx, dy) || 1e-9;
    let maxD = -1, maxI = -1;
    for (let i = desde + 1; i < hasta; i++) {
      const d = Math.abs(dx * (a[1] - pts[i][1]) - dy * (a[0] - pts[i][0])) / largo;
      if (d > maxD) { maxD = d; maxI = i; }
    }
    if (maxD > tolerancia) {
      dp(desde, maxI, salida);
      salida.push(pts[maxI]);
      dp(maxI, hasta, salida);
    }
  };
  // partir el loop en dos tramos usando el punto más lejano al primero
  let lejos = 1, maxD = -1;
  for (let i = 1; i < pts.length; i++) {
    const d = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2;
    if (d > maxD) { maxD = d; lejos = i; }
  }
  const salida = [pts[0]];
  dp(0, lejos, salida);
  salida.push(pts[lejos]);
  const cola = [];
  dp(lejos, pts.length - 1, cola);
  salida.push(...cola);
  return salida.length >= 3 ? salida : pts;
}

function areaFirmada(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

function puntoDentro(punto, pts) {
  let dentro = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a[1] > punto[1]) !== (b[1] > punto[1]) &&
        punto[0] < (b[0] - a[0]) * (punto[1] - a[1]) / (b[1] - a[1]) + a[0]) dentro = !dentro;
  }
  return dentro;
}

// Anida los loops: profundidad par = contorno exterior, impar = agujero del
// contorno que lo contiene.
function anidarLoops(loops) {
  const info = loops.map(pts => ({ pts, area: Math.abs(areaFirmada(pts)), prof: 0 }));
  for (let i = 0; i < info.length; i++) {
    for (let j = 0; j < info.length; j++) {
      if (i !== j && info[j].area > info[i].area && puntoDentro(info[i].pts[0], info[j].pts)) info[i].prof++;
    }
  }
  const resultado = [];
  for (const it of info) {
    if (it.prof % 2 === 0) resultado.push({ pts: it.pts, agujeros: [], _area: it.area, _prof: it.prof });
  }
  for (const it of info) {
    if (it.prof % 2 === 1) {
      let padre = null;
      for (const ext of resultado) {
        if (ext._prof === it.prof - 1 && ext._area > it.area && puntoDentro(it.pts[0], ext.pts)) {
          if (!padre || ext._area < padre._area) padre = ext;
        }
      }
      (padre || resultado[0] || { agujeros: [] }).agujeros.push(it.pts);
    }
  }
  return resultado.map(r => ({ pts: r.pts, agujeros: r.agujeros }));
}

function contornosDesdeCalco(img, detalle, umbral, invertir) {
  const { mascara, w, h } = mascaraDesdeImagen(img, detalle, umbral, invertir);
  let loops = trazarContornos(mascara, w, h);
  const tolerancia = 0.75;
  loops = loops.map(l => simplificarLoop(l, tolerancia)).filter(l => l.length >= 3 && Math.abs(areaFirmada(l)) > 4);
  return anidarLoops(loops);
}

// ============================================================
// Opciones y armado del modelo en mm
// ============================================================

function leerOpciones() {
  return {
    anchoMM: Math.min(300, Math.max(10, parseFloat($('optAncho').value) || 50)),
    altoRelieve: Math.min(20, Math.max(0.4, parseFloat($('optRelieve').value) || 2)),
    altoBase: Math.min(30, Math.max(1, parseFloat($('optBase').value) || 3)),
    margen: Math.min(30, Math.max(0, parseFloat($('optMargen').value) || 0)),
    forma: $('optForma').value,                 // redondeada | rect | circulo | sin
    espejar: $('optEspejar').checked,
    invertir: $('optInvertir').checked,
    llavero: $('optLlavero').checked,
    molde: $('optMolde').checked,
    bisagra: $('optBisagra').checked,
    umbral: parseInt($('optUmbral').value, 10),
    detalle: parseInt($('optDetalle').value, 10)
  };
}

// muestra u oculta los controles del calco según el modo activo
function ajustarControles() {
  const esVectorial = !!estado.svgTexto && !$('optInvertir').checked;
  $('filaCalco').style.display = esVectorial ? 'none' : '';
  $('notaVectorial').style.display = esVectorial ? '' : 'none';
  const esMolde = $('optMolde').checked;
  $('optBisagra').disabled = !esMolde;
  $('notaMolde').style.display = esMolde ? '' : 'none';
}

// contornos → polígonos en mm ([[x,y],...]), centrados, con Y hacia arriba
function poligonosCentrados(contornos, op, yHaciaAbajo) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of contornos) {
    for (const p of c.pts) {
      if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
    }
  }
  const anchoOrig = maxX - minX, altoOrig = maxY - minY;
  if (!(anchoOrig > 0) || !(altoOrig > 0)) return null;
  const escala = op.anchoMM / anchoOrig;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const sx = op.espejar ? -escala : escala;
  const sy = yHaciaAbajo ? -escala : escala;
  const transformar = p => [(p[0] - cx) * sx, (p[1] - cy) * sy];
  const polis = [];
  for (const c of contornos) {
    polis.push({ ext: c.pts.map(transformar), agujeros: c.agujeros.map(a => a.map(transformar)) });
  }
  return { polis, anchoMM: op.anchoMM, altoMM: altoOrig * escala };
}

// polígonos → THREE.Shape (con espejo horizontal opcional, para el negativo del molde)
function shapesDePolis(polis, espejo) {
  const t = p => new THREE.Vector2(espejo ? -p[0] : p[0], p[1]);
  return polis.map(c => {
    const s = new THREE.Shape(c.ext.map(t));
    for (const a of c.agujeros) s.holes.push(new THREE.Path(a.map(t)));
    return s;
  });
}

// ¿el punto cae sobre la figura? (dentro de un exterior y fuera de sus agujeros)
function dentroDeFigura(p, polis) {
  for (const c of polis) {
    if (puntoDentro(p, c.ext) && !c.agujeros.some(a => puntoDentro(p, a))) return true;
  }
  return false;
}

function shapeRect(x0, y0, x1, y1) {
  const s = new THREE.Shape();
  s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.closePath();
  return s;
}

function shapeBase(forma, ancho, alto, margen) {
  const w = ancho / 2 + margen, h = alto / 2 + margen;
  const s = new THREE.Shape();
  if (forma === 'circulo') {
    s.absarc(0, 0, Math.hypot(w, h) * 0.86 + 1, 0, Math.PI * 2, false);
  } else if (forma === 'rect') {
    s.moveTo(-w, -h); s.lineTo(w, -h); s.lineTo(w, h); s.lineTo(-w, h); s.closePath();
  } else { // redondeada
    const r = Math.min(Math.max(2, margen), w, h);
    s.moveTo(-w + r, -h);
    s.lineTo(w - r, -h); s.absarc(w - r, -h + r, r, -Math.PI / 2, 0, false);
    s.lineTo(w, h - r); s.absarc(w - r, h - r, r, 0, Math.PI / 2, false);
    s.lineTo(-w + r, h); s.absarc(-w + r, h - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(-w, -h + r); s.absarc(-w + r, -h + r, r, Math.PI, Math.PI * 1.5, false);
    s.closePath();
  }
  return s;
}

// aro con agujero para colgar el llavero, pegado al borde superior de la base
function shapeAro(yBorde) {
  const rExt = 6, rInt = 2.75;
  const cy = yBorde + rExt - 2.5; // se solapa 2.5 mm con la base
  const s = new THREE.Shape();
  s.absarc(0, cy, rExt, 0, Math.PI * 2, false);
  const agujero = new THREE.Path();
  agujero.absarc(0, cy, rInt, 0, Math.PI * 2, true);
  s.holes.push(agujero);
  return { shape: s, topeY: cy + rExt };
}

// Construye las piezas (geometrías en mm, Z hacia arriba, apoyadas en z=0)
function construirModelo(op) {
  let contornos, yHaciaAbajo;
  if (estado.svgTexto && !op.invertir) {
    contornos = contornosDesdeSVG(estado.svgTexto);
    yHaciaAbajo = true;
    if (!contornos) {
      // svg solo con trazos (sin rellenos): se calca desde los píxeles
      contornos = contornosDesdeCalco(estado.imagen, op.detalle, op.umbral, false);
      $('filaCalco').style.display = '';
      $('notaVectorial').style.display = 'none';
    }
  } else {
    contornos = contornosDesdeCalco(estado.imagen, op.detalle, op.umbral, op.invertir);
    yHaciaAbajo = true;
  }
  if (!contornos || !contornos.length) return null;

  const fig = poligonosCentrados(contornos, op, yHaciaAbajo);
  if (!fig) return null;
  if (op.molde) return construirMolde(fig, op);

  const piezas = [], planta = [];
  const shapesFig = shapesDePolis(fig.polis);
  let alturaTotal = op.altoRelieve;
  let anchoTotal = fig.anchoMM, altoTotal = fig.altoMM;

  // relieve
  const geoRelieve = new THREE.ExtrudeGeometry(shapesFig, { depth: op.altoRelieve, bevelEnabled: false, curveSegments: 12 });
  piezas.push({ geometria: geoRelieve, color: 0xc65a35 });

  // base
  if (op.forma !== 'sin') {
    const base = shapeBase(op.forma, fig.anchoMM, fig.altoMM, op.margen);
    const cajaBase = new THREE.Box2().setFromPoints(base.getPoints(48));
    anchoTotal = cajaBase.max.x - cajaBase.min.x;
    altoTotal = cajaBase.max.y - cajaBase.min.y;
    const geoBase = new THREE.ExtrudeGeometry(base, { depth: op.altoBase, bevelEnabled: false, curveSegments: 48 });
    geoBase.translate(0, 0, -op.altoBase);
    piezas.push({ geometria: geoBase, color: 0x9aa3b2 });
    planta.push({ shapes: base, color: 'rgba(150,158,172,0.45)' });
    alturaTotal += op.altoBase;

    if (op.llavero) {
      const aro = shapeAro(cajaBase.max.y);
      const geoAro = new THREE.ExtrudeGeometry(aro.shape, { depth: op.altoBase, bevelEnabled: false, curveSegments: 48 });
      geoAro.translate(0, 0, -op.altoBase);
      piezas.push({ geometria: geoAro, color: 0x9aa3b2 });
      planta.push({ shapes: aro.shape, color: 'rgba(150,158,172,0.45)' });
      altoTotal = aro.topeY - cajaBase.min.y;
    }
  } else if (op.llavero) {
    const aro = shapeAro(fig.altoMM / 2);
    const geoAro = new THREE.ExtrudeGeometry(aro.shape, { depth: op.altoRelieve, bevelEnabled: false, curveSegments: 48 });
    piezas.push({ geometria: geoAro, color: 0x9aa3b2 });
    planta.push({ shapes: aro.shape, color: 'rgba(150,158,172,0.45)' });
    altoTotal = aro.topeY + fig.altoMM / 2;
  }

  planta.push({ shapes: shapesFig, color: '#c65a35' });

  // todas las piezas apoyadas sobre z = 0 (la cama de la impresora)
  const zMin = op.forma !== 'sin' ? -op.altoBase : 0;
  for (const p of piezas) p.geometria.translate(0, 0, -zMin);

  return { piezas, planta, medidas: { ancho: anchoTotal, alto: altoTotal, altura: alturaTotal } };
}

// ============================================================
// Molde de dos partes: placa positiva (relieve) + placa negativa (bolsillo
// espejado). Con bisagra impresa se pliega y cierra como un libro (el eje es
// un trozo de filamento); sin bisagra son dos placas que alinean con tetones.
// ============================================================

function construirMolde(fig, op) {
  const d = op.altoRelieve;
  const dp = d + 0.3;                              // el bolsillo queda 0,3 mm más hondo para que cierre
  const Hb = Math.max(op.altoBase, dp + 1.2);      // la placa tiene que contener al bolsillo
  const margen = Math.max(op.margen, op.bisagra ? 4 : 7);
  const forma = op.forma === 'sin' ? 'redondeada' : op.forma;
  const base = shapeBase(forma, fig.anchoMM, fig.altoMM, margen);
  const caja = new THREE.Box2().setFromPoints(base.getPoints(48));
  const wB = caja.max.x - caja.min.x, hB = caja.max.y - caja.min.y;
  const g = op.bisagra ? 3.8 : 2.5;                // media separación entre placas (deja lugar al barril)
  const xA = -(wB / 2 + g), xB = wB / 2 + g;
  const piezas = [], planta = [];
  const extruir = (shapes, alto) => new THREE.ExtrudeGeometry(shapes, { depth: alto, bevelEnabled: false, curveSegments: 32 });
  const espejoV2 = p => new THREE.Vector2(-p[0], p[1]);

  // tetones de alineación (solo sin bisagra): en las diagonales del margen,
  // salteando los que caerían sobre la figura
  const tetones = [];
  if (!op.bisagra) {
    let px, py;
    if (forma === 'circulo') {
      px = py = (wB / 2 - 4.2) * 0.707;
    } else {
      const r = forma === 'redondeada' ? Math.min(Math.max(2, margen), wB / 2, hB / 2) : 0;
      const inset = Math.max(4.2, 0.293 * r + 1.75);
      px = wB / 2 - inset; py = hB / 2 - inset;
    }
    for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const p = [sx * px, sy * py];
      if (!dentroDeFigura(p, fig.polis)) tetones.push(p);
    }
  }

  // ---- placa A (positivo): base + relieve + tetones ----
  const geoBaseA = extruir(base, Hb);
  geoBaseA.translate(xA, 0, 0);
  piezas.push({ geometria: geoBaseA, color: 0x9aa3b2 });
  const shapesFig = shapesDePolis(fig.polis);
  const geoRelieve = extruir(shapesFig, d);
  geoRelieve.translate(xA, 0, Hb);
  piezas.push({ geometria: geoRelieve, color: 0xc65a35 });
  planta.push({ shapes: base, dx: xA, color: 'rgba(150,158,172,0.45)' });
  planta.push({ shapes: shapesFig, dx: xA, color: '#c65a35' });
  for (const p of tetones) {
    const geo = new THREE.CylinderGeometry(1.7, 1.7, dp - 0.4, 24);
    geo.rotateX(Math.PI / 2);
    geo.translate(xA + p[0], p[1], Hb + (dp - 0.4) / 2);
    piezas.push({ geometria: geo, color: 0xc65a35 });
    const c = new THREE.Shape();
    c.absarc(p[0], p[1], 1.7, 0, Math.PI * 2, false);
    planta.push({ shapes: c, dx: xA, color: '#c65a35' });
  }

  // ---- placa B (negativo espejado): losa + capa superior con el bolsillo ----
  const geoLosa = extruir(base, Hb - dp);
  geoLosa.translate(xB, 0, 0);
  piezas.push({ geometria: geoLosa, color: 0x9aa3b2 });
  planta.push({ shapes: base, dx: xB, color: 'rgba(150,158,172,0.45)' });
  const tapa = shapeBase(forma, fig.anchoMM, fig.altoMM, margen);
  // islas: los agujeros de la figura quedan a nivel dentro del bolsillo;
  // si otra figura vive dentro de un agujero, su bolsillo se recorta en la isla
  const islas = [];
  const extAnidados = new Set();
  for (const c of fig.polis) {
    for (const a of c.agujeros) {
      const isla = new THREE.Shape(a.map(espejoV2));
      for (const otro of fig.polis) {
        if (otro !== c && puntoDentro(otro.ext[0], a)) {
          isla.holes.push(new THREE.Path(otro.ext.map(espejoV2)));
          extAnidados.add(otro);
        }
      }
      islas.push(isla);
    }
  }
  for (const c of fig.polis) {
    if (!extAnidados.has(c)) tapa.holes.push(new THREE.Path(c.ext.map(espejoV2)));
  }
  for (const p of tetones) {
    const hueco = new THREE.Path();
    hueco.absarc(-p[0], p[1], 2.15, 0, Math.PI * 2, true);
    tapa.holes.push(hueco);
  }
  const geoTapa = extruir([tapa, ...islas], dp);
  geoTapa.translate(xB, 0, Hb - dp);
  piezas.push({ geometria: geoTapa, color: 0x828a9c });
  planta.push({ shapes: [tapa, ...islas], dx: xB, color: 'rgba(110,118,132,0.55)' });

  // ---- bisagra: nudillos alternados con agujero para un eje de filamento ----
  if (op.bisagra) {
    const n = 5, sep = 0.8;
    const L = Math.min(hB, Math.max(24, hB - 6));
    const wN = (L - (n - 1) * sep) / n;
    for (let i = 0; i < n; i++) {
      const y0 = -L / 2 + i * (wN + sep);
      const lado = i % 2 === 0 ? -1 : 1;           // pares → placa A, impares → placa B
      // pared que une el barril con su placa (llega hasta la cama: imprime sin soportes)
      const pared = shapeRect(Math.min(lado * (g + 2.5), lado * 0.9), 0, Math.max(lado * (g + 2.5), lado * 0.9), Hb - 1.7);
      // barril con el agujero del eje, centrado en el pliegue a la altura de la cara
      const barril = new THREE.Shape();
      barril.absarc(0, Hb, 3.2, 0, Math.PI * 2, false);
      const eje = new THREE.Path();
      eje.absarc(0, Hb, 1.2, 0, Math.PI * 2, true);
      barril.holes.push(eje);
      const geo = extruir([pared, barril], wN);
      geo.rotateX(Math.PI / 2);                    // la extrusión pasa a correr por Y
      geo.translate(0, y0 + wN, 0);
      piezas.push({ geometria: geo, color: 0x9aa3b2 });
      planta.push({ shapes: shapeRect(lado === -1 ? -(g + 2.5) : -3.2, y0, lado === -1 ? 3.2 : g + 2.5, y0 + wN), color: 'rgba(150,158,172,0.7)' });
    }
  }

  return {
    piezas, planta,
    medidas: { ancho: 2 * (wB + g), alto: hB, altura: Hb + d },
    molde: true
  };
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
  const camara = new THREE.PerspectiveCamera(40, 1, 0.1, 5000);
  const controles = new OrbitControls(camara, lienzo);
  controles.enableDamping = true;

  escena.add(new THREE.HemisphereLight(0xffffff, 0x888877, 1.1));
  const sol = new THREE.DirectionalLight(0xffffff, 1.5);
  sol.position.set(1, 2, 1.5);
  escena.add(sol);
  const contra = new THREE.DirectionalLight(0xffffff, 0.5);
  contra.position.set(-1.5, 1, -1);
  escena.add(contra);

  // el modelo se construye con Z hacia arriba (como en la impresora);
  // este grupo lo gira para que en pantalla «arriba» sea arriba
  const grupo = new THREE.Group();
  grupo.rotation.x = -Math.PI / 2;
  escena.add(grupo);

  function medir() {
    const w = lienzo.clientWidth || 600;
    const h = lienzo.clientHeight || 340;
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
  }
  medir();
  window.addEventListener('resize', medir);

  (function animar() {
    requestAnimationFrame(animar);
    controles.update();
    renderer.render(escena, camara);
  })();

  return {
    mostrar(piezas) {
      while (grupo.children.length) grupo.remove(grupo.children[0]);
      const caja = new THREE.Box3();
      for (const p of piezas) {
        const malla = new THREE.Mesh(p.geometria, new THREE.MeshStandardMaterial({
          color: p.color, metalness: 0.05, roughness: 0.6
        }));
        grupo.add(malla);
        p.geometria.computeBoundingBox();
        caja.union(p.geometria.boundingBox);
      }
      const centro = caja.getCenter(new THREE.Vector3());
      const r = caja.getSize(new THREE.Vector3()).length() / 2 || 1;
      const objetivo = new THREE.Vector3(centro.x, centro.z, -centro.y); // por el giro del grupo
      controles.target.copy(objetivo);
      camara.position.set(objetivo.x + r * 1.2, objetivo.y + r * 1.5, objetivo.z + r * 1.6);
      camara.near = r / 100; camara.far = r * 30;
      camara.updateProjectionMatrix();
      medir();
    }
  };
}

// ============================================================
// Vista 2D: cómo quedó el calco (planta del modelo)
// ============================================================

function dibujarPlanta(resultado) {
  const lienzo = $('lienzoPlanta');
  const ctx = lienzo.getContext('2d');
  const W = lienzo.width = lienzo.clientWidth * (window.devicePixelRatio || 1) || 600;
  const H = lienzo.height = 260 * (window.devicePixelRatio || 1);
  ctx.clearRect(0, 0, W, H);
  const caja = new THREE.Box3();
  for (const p of resultado.piezas) { p.geometria.computeBoundingBox(); caja.union(p.geometria.boundingBox); }
  const anchoM = caja.max.x - caja.min.x, altoM = caja.max.y - caja.min.y;
  const esc = Math.min((W - 30) / anchoM, (H - 30) / altoM);
  const ox = W / 2 - (caja.min.x + anchoM / 2) * esc;
  const oy = H / 2 + (caja.min.y + altoM / 2) * esc;
  for (const ent of resultado.planta) {
    const dx = ent.dx || 0;
    const ruta = new Path2D();
    const pintar = (pts) => {
      pts.forEach((p, i) => {
        const x = ox + (p.x + dx) * esc, y = oy - p.y * esc;
        i ? ruta.lineTo(x, y) : ruta.moveTo(x, y);
      });
      ruta.closePath();
    };
    for (const shape of Array.isArray(ent.shapes) ? ent.shapes : [ent.shapes]) {
      const ext = shape.extractPoints(24);
      pintar(ext.shape);
      for (const h of ext.holes) pintar(h);
    }
    ctx.fillStyle = ent.color;
    ctx.fill(ruta, 'evenodd');
  }
}

// ============================================================
// Exportar STL binario
// ============================================================

function generarSTL(piezas) {
  let total = 0;
  const geos = piezas.map(p => {
    const g = p.geometria.index ? p.geometria.toNonIndexed() : p.geometria;
    total += g.getAttribute('position').count / 3;
    return g;
  });
  const buffer = new ArrayBuffer(84 + total * 50);
  const vista = new DataView(buffer);
  const cabecera = 'Sello 3D - Generador de Actividades';
  for (let i = 0; i < cabecera.length && i < 80; i++) vista.setUint8(i, cabecera.charCodeAt(i));
  vista.setUint32(80, total, true);
  let off = 84;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const n = new THREE.Vector3(), u = new THREE.Vector3(), v = new THREE.Vector3();
  for (const g of geos) {
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i);
      b.fromBufferAttribute(pos, i + 1);
      c.fromBufferAttribute(pos, i + 2);
      n.copy(u.subVectors(b, a).cross(v.subVectors(c, a))).normalize();
      vista.setFloat32(off, n.x, true); vista.setFloat32(off + 4, n.y, true); vista.setFloat32(off + 8, n.z, true);
      off += 12;
      for (const p of [a, b, c]) {
        vista.setFloat32(off, p.x, true); vista.setFloat32(off + 4, p.y, true); vista.setFloat32(off + 8, p.z, true);
        off += 12;
      }
      vista.setUint16(off, 0, true);
      off += 2;
    }
  }
  return { buffer, triangulos: total };
}

$('btnSTL').addEventListener('click', () => {
  if (!estado.piezas) { toast('Primero subí una imagen'); return; }
  const { buffer } = generarSTL(estado.piezas);
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(new Blob([buffer], { type: 'model/stl' }));
  enlace.download = (estado.nombre || 'sello') + '-3d.stl';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 4000);
  toast('STL descargado: llevalo a la impresora 3D o abrilo en Tinkercad');
});

// ============================================================
// Regenerar (con espera corta para no recalcular en cada tecla)
// ============================================================

let temporizador = null;
function regenerarPronto() {
  clearTimeout(temporizador);
  temporizador = setTimeout(regenerar, 180);
}

function regenerar() {
  if (!estado.imagen && !estado.svgTexto) return;
  const op = leerOpciones();
  $('valUmbral').textContent = op.umbral;
  let resultado = null;
  try {
    resultado = construirModelo(op);
  } catch (err) {
    console.error(err);
  }
  if (!resultado) {
    $('statsModelo').innerHTML = '<span class="inf-stats__item">⚠ No encontré ninguna figura. Probá mover el umbral de claro/oscuro, o activá «invertir».</span>';
    estado.piezas = null;
    return;
  }
  estado.piezas = resultado.piezas;
  estado.medidas = resultado.medidas;
  if (!vista3d) vista3d = iniciarVista3D();
  vista3d.mostrar(resultado.piezas);
  dibujarPlanta(resultado);
  const m = resultado.medidas;
  const nTri = resultado.piezas.reduce((s, p) => {
    const g = p.geometria;
    return s + (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  }, 0);
  $('statsModelo').innerHTML = `
    <span class="inf-stats__item">📏 ${m.ancho.toFixed(1)} × ${m.alto.toFixed(1)} mm</span>
    <span class="inf-stats__item">📐 ${m.altura.toFixed(1)} mm de alto total</span>
    <span class="inf-stats__item">🔺 ${Math.round(nTri).toLocaleString('es')} triángulos</span>
    <span class="inf-stats__item">${op.molde ? (op.bisagra ? '🗜️ molde con bisagra (eje: filamento)' : '🗜️ molde en dos placas con tetones') : (op.espejar ? '🪞 espejado (para sellar)' : '👁 sin espejar')}</span>`;
}

// ============================================================
// Presets y eventos de los controles
// ============================================================

const PRESETS = {
  figura: { espejar: false, llavero: false, molde: false, forma: 'redondeada', relieve: 2, base: 3, margen: 4 },
  sello: { espejar: true, llavero: false, molde: false, forma: 'redondeada', relieve: 1.6, base: 5, margen: 4 },
  llavero: { espejar: false, llavero: true, molde: false, forma: 'redondeada', relieve: 1.6, base: 2.4, margen: 3 },
  molde: { espejar: false, llavero: false, molde: true, bisagra: true, forma: 'redondeada', relieve: 2, base: 4, margen: 8 }
};

document.querySelectorAll('input[name="preset"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const p = PRESETS[radio.value];
    if (!p) return;
    $('optEspejar').checked = p.espejar;
    $('optLlavero').checked = p.llavero;
    $('optMolde').checked = p.molde;
    if (p.molde) $('optBisagra').checked = p.bisagra;
    $('optForma').value = p.forma;
    $('optRelieve').value = p.relieve;
    $('optBase').value = p.base;
    $('optMargen').value = p.margen;
    ajustarControles();
    regenerar();
  });
});

for (const id of ['optAncho', 'optRelieve', 'optBase', 'optMargen', 'optForma', 'optEspejar', 'optLlavero', 'optMolde', 'optBisagra', 'optDetalle']) {
  $(id).addEventListener('change', () => { ajustarControles(); regenerarPronto(); });
}
$('optUmbral').addEventListener('input', regenerarPronto);
$('optInvertir').addEventListener('change', () => { ajustarControles(); regenerar(); });
