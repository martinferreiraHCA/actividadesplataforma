// Moldes de galletitas desde un SVG: subís un dibujo vectorial (o una imagen),
// elegís la forma de la galletita (redonda, cuadrada o libre siguiendo el
// contorno del dibujo) y la plataforma arma el cortante en 3D: la pared de
// corte, la pestaña de apoyo, el refuerzo y —si querés— el dibujo como
// marcador que se estampa en la masa. Descargás el .stl para imprimir.
//
// Toda la geometría 2D (silueta, paredes, pestaña, marcador) se arma con
// operaciones de offset sobre un lienzo en milímetros (rellenar + trazo
// redondeado) y se vuelve a vectorizar con marching squares; después cada
// región se extruye con three.js. El modelo sale apoyado como se imprime:
// la pestaña contra la cama y el filo hacia arriba.

import * as THREE from 'three';
import { OrbitControls } from './lego/vendor/OrbitControls.js';
import { SVGLoader } from './lego/vendor/SVGLoader.js';
import { vectorizarMascara, areaFirmada } from './sombras-vector.js';

const $ = id => document.getElementById(id);

const COLOR_CUERPO = 0x9aa3b2;
const COLOR_FILO = 0x5c6b7f;
const COLOR_MARCA = 0xc65a35;

const estado = {
  nombre: '',        // nombre del archivo sin extensión
  svgTexto: null,    // texto del svg subido (si es svg)
  imagen: null,      // HTMLImageElement ya cargado (svg rasterizado o imagen)
  conRellenos: false,// el svg trae trazados con relleno (se usan tal cual)
  piezas: null,      // [{geometria, color}] en mm, con Z hacia arriba
  medidas: null
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
    toast('Formato no reconocido: subí un .svg (o un .png / .jpg)');
    return;
  }
  try {
    estado.nombre = archivo.name.replace(/\.[^.]+$/, '');
    if (ext === 'svg') {
      estado.svgTexto = await archivo.text();
      estado.imagen = await rasterizarSVG(estado.svgTexto);
      estado.conRellenos = !!contornosDesdeSVG(estado.svgTexto);
    } else {
      estado.svgTexto = null;
      estado.imagen = await cargarImagen(archivo);
      estado.conRellenos = false;
    }
  } catch (err) {
    console.error(err);
    toast('No pude leer el archivo: ' + err.message);
    return;
  }
  let descripcion;
  if (estado.svgTexto) {
    descripcion = estado.conRellenos ? 'vectorial (SVG con rellenos)' : 'vectorial (SVG de líneas: se calca)';
  } else {
    descripcion = 'imagen de ' + estado.imagen.naturalWidth + '×' + estado.imagen.naturalHeight + ' px (se calca)';
  }
  activarSecciones(`✔ ${archivo.name} — ${descripcion}`);
  $('optCalcar').checked = false;
  // un dibujo de líneas se marca mejor tal cual (relleno); uno de rellenos, por sus contornos
  $('optMarcador').value = estado.conRellenos ? 'lineas' : 'relleno';
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

// Convierte el texto de un SVG en una imagen dibujable (para el calco por
// píxeles). Si el SVG no declara width/height, se los ponemos desde el viewBox.
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

function activarSecciones(descripcion) {
  const est = $('estadoSubida');
  est.style.display = '';
  est.textContent = descripcion;
  $('seccionOpciones').style.display = '';
  $('seccionResultado').style.display = '';
}

// ============================================================
// Contornos del dibujo: desde el SVG vectorial o calcando los píxeles.
// Devuelven [{pts: [[x,y],…], agujeros: [[[x,y],…]]}] en unidades del
// dibujo, con Y hacia abajo.
// ============================================================

function contornosDesdeSVG(texto) {
  let datos;
  try { datos = new SVGLoader().parse(texto); } catch (_) { return null; }
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

// Calco: la imagen sobre fondo blanco, umbral de claro/oscuro, marching squares.
function contornosDesdeCalco(img, umbral, invertir) {
  const detalle = 1000;
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const escala = detalle / Math.max(iw, ih, 1);
  const w = Math.max(2, Math.round(iw * escala)), h = Math.max(2, Math.round(ih * escala));
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
    const lum = (0.2126 * datos[p] + 0.7152 * datos[p + 1] + 0.0722 * datos[p + 2]) * a + 255 * (1 - a);
    let dentro = lum < umbral;
    if (invertir) dentro = !dentro;
    mascara[i] = dentro ? 1 : 0;
  }
  return vectorizarMascara(mascara, w, h, { tolerancia: 0.7, suavizar: 1, areaMinima: 6 })
    .map(c => ({ pts: c.pts, agujeros: c.agujeros }));
}

function obtenerDibujo(op) {
  if (estado.svgTexto && !op.calcar && !op.invertir) {
    const c = contornosDesdeSVG(estado.svgTexto);
    if (c) return { contornos: c, vectorial: true };
  }
  if (!estado.imagen) return null;
  const c = contornosDesdeCalco(estado.imagen, op.umbral, op.invertir);
  return c.length ? { contornos: c, vectorial: false } : null;
}

// ============================================================
// Opciones
// ============================================================

function leerOpciones() {
  const num = (id, min, max, def) => Math.min(max, Math.max(min, parseFloat($(id).value) || def));
  return {
    forma: (document.querySelector('input[name="forma"]:checked') || {}).value || 'libre', // redonda | cuadrada | libre
    tamano: num('optTamano', 20, 200, 70),
    altura: num('optAltura', 6, 40, 15),
    pared: num('optPared', 0.6, 3, 1),
    pestana: num('optPestana', 0, 15, 4),
    grosorPestana: num('optGrosorPestana', 0.8, 5, 1.6),
    refuerzo: $('optRefuerzo').checked,
    marcador: $('optMarcador').value,       // lineas | relleno | sin
    anchoLinea: num('optAnchoLinea', 0.6, 4, 1.2),
    masa: num('optMasa', 1, 20, 5),
    marca: num('optMarca', 0.3, 6, 1.5),
    engrosar: num('optEngrosar', 0, 3, 0),
    margen: num('optMargen', 0, 40, 6),
    esquinas: num('optEsquinas', 0, 60, 6),
    suavizar: Math.min(5, Math.max(0, parseFloat($('optSuavizar').value) || 0)),
    espejar: $('optEspejar').checked,
    rotar: parseInt($('optRotar').value, 10) || 0,
    calcar: $('optCalcar').checked,
    invertir: $('optInvertir').checked,
    umbral: parseInt($('optUmbral').value, 10) || 128
  };
}

function ajustarControles() {
  const forma = (document.querySelector('input[name="forma"]:checked') || {}).value || 'libre';
  $('filaRedCuad').style.display = forma === 'libre' ? 'none' : '';
  $('grupoEsquinas').style.display = forma === 'cuadrada' ? '' : 'none';
  $('filaLibre').style.display = forma === 'libre' ? '' : 'none';
  const marc = $('optMarcador').value;
  $('grupoLinea').style.display = marc === 'lineas' ? '' : 'none';
  $('grupoEngrosar').style.display = marc === 'relleno' ? '' : 'none';
  $('grupoMarca').style.display = marc === 'sin' ? 'none' : '';
  const esCalco = !estado.svgTexto || !estado.conRellenos || $('optCalcar').checked || $('optInvertir').checked;
  $('filaCalco').style.display = esCalco ? '' : 'none';
  $('grupoCalcar').style.display = estado.svgTexto ? '' : 'none';
  $('valUmbral').textContent = $('optUmbral').value;
}

// ============================================================
// Geometría 2D: polígonos en mm ([{ext, agujeros}]) y offsets por raster
// ============================================================

function rotarPunto(p, rot) {
  if (rot === 90) return [p[1], -p[0]];
  if (rot === 180) return [-p[0], -p[1]];
  if (rot === 270) return [-p[1], p[0]];
  return p;
}

// contornos del dibujo → polígonos en mm centrados en el origen, con Y hacia
// arriba y la escala que pide la forma elegida. Devuelve null si está vacío.
function normalizarDibujo(contornos, op) {
  const girar = p => rotarPunto([p[0], -p[1]], op.rotar);   // Y hacia arriba + giro
  const cs = contornos.map(c => ({ ext: c.pts.map(girar), agujeros: c.agujeros.map(a => a.map(girar)) }));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of cs) {
    for (const p of c.ext) {
      if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
    }
  }
  const w = maxX - minX, h = maxY - minY;
  if (!(w > 0) || !(h > 0)) return null;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  let escala;
  if (op.forma === 'libre') {
    escala = op.tamano / w;
  } else if (op.forma === 'cuadrada') {
    const util = Math.max(4, op.tamano - 2 * op.margen);
    escala = Math.min(util / w, util / h);
  } else {
    // redonda: todo el dibujo dentro del círculo, a «margen» de la pared
    let rMax = 0;
    for (const c of cs) for (const p of c.ext) rMax = Math.max(rMax, Math.hypot(p[0] - cx, p[1] - cy));
    escala = Math.max(2, op.tamano / 2 - op.margen) / (rMax || 1);
  }
  const t = p => [(p[0] - cx) * escala, (p[1] - cy) * escala];
  return {
    polis: cs.map(c => ({ ext: c.ext.map(t), agujeros: c.agujeros.map(a => a.map(t)) })),
    ancho: w * escala, alto: h * escala
  };
}

function poligonoCirculo(r, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}

function poligonoCuadrado(lado, radio) {
  const h = lado / 2, r = Math.min(Math.max(0, radio), h);
  if (r <= 0) return [[-h, -h], [h, -h], [h, h], [-h, h]];
  const pts = [];
  const esquina = (cx, cy, a0) => {
    for (let i = 0; i <= 12; i++) {
      const a = a0 + (i / 12) * (Math.PI / 2);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  esquina(h - r, h - r, 0);
  esquina(-h + r, h - r, Math.PI / 2);
  esquina(-h + r, -h + r, Math.PI);
  esquina(h - r, -h + r, Math.PI * 1.5);
  return pts;
}

function cajaDePolis(polis) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of polis) {
    for (const p of c.ext) {
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
    }
  }
  return { x0, y0, x1, y1 };
}

// Lienzo en milímetros: se dibujan regiones (relleno o trazo redondeado =
// offset) y se vuelve a vectorizar. Un trazo negro de ancho 2r sobre el borde
// de una región la engorda r; uno blanco la adelgaza r.
function crearRaster(caja, esc) {
  const w = Math.ceil((caja.x1 - caja.x0) * esc) + 4;
  const h = Math.ceil((caja.y1 - caja.y0) * esc) + 4;
  const lienzo = document.createElement('canvas');
  lienzo.width = w; lienzo.height = h;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  const X = x => (x - caja.x0) * esc + 2;
  const Y = y => (caja.y1 - y) * esc + 2;
  const trazarLoop = (ruta, pts) => {
    pts.forEach((p, i) => { i ? ruta.lineTo(X(p[0]), Y(p[1])) : ruta.moveTo(X(p[0]), Y(p[1])); });
    ruta.closePath();
  };
  const rutaDe = (polis, soloExt) => {
    const ruta = new Path2D();
    for (const c of polis) {
      trazarLoop(ruta, c.ext);
      if (!soloExt) for (const a of c.agujeros) trazarLoop(ruta, a);
    }
    return ruta;
  };
  const R = {
    esc, w, h,
    limpiar() { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); },
    // relleno de las regiones (con sus agujeros); con soloExt se rellena
    // cada contorno exterior por separado, tapando los agujeros
    rellenar(polis, color, soloExt) {
      ctx.fillStyle = color;
      if (soloExt) {
        for (const c of polis) { const r = new Path2D(); trazarLoop(r, c.ext); ctx.fill(r); }
      } else {
        ctx.fill(rutaDe(polis, false), 'evenodd');
      }
    },
    // trazo redondeado sobre los bordes (ancho total en mm)
    trazar(polis, ancho, color, soloExt) {
      if (!(ancho > 0)) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = ancho * esc;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke(rutaDe(polis, soloExt));
    },
    // dibuja solo dentro de las regiones dadas
    recortar(polis, dibujar) {
      ctx.save();
      ctx.clip(rutaDe(polis, false), 'evenodd');
      dibujar();
      ctx.restore();
    },
    // vectoriza lo negro del lienzo → polígonos en mm (areaMin en mm²)
    vectorizar(areaMinMM2) {
      const datos = ctx.getImageData(0, 0, w, h).data;
      const mascara = new Uint8Array(w * h);
      for (let i = 0; i < mascara.length; i++) mascara[i] = datos[i * 4] < 128 ? 1 : 0;
      const piezas = vectorizarMascara(mascara, w, h, {
        tolerancia: 0.7, suavizar: 1, areaMinima: Math.max(2, (areaMinMM2 || 0.5) * esc * esc)
      });
      const aMM = p => [(p[0] - 2) / esc + caja.x0, caja.y1 - (p[1] - 2) / esc];
      return piezas.map(c => ({ ext: c.pts.map(aMM), agujeros: c.agujeros.map(a => a.map(aMM)) }));
    }
  };
  // región = lo que deja `dibujar` sobre un lienzo limpio
  R.region = (dibujar, areaMinMM2) => { R.limpiar(); dibujar(); return R.vectorizar(areaMinMM2); };
  R.limpiar();
  return R;
}

function shapesDePolis(polis, espejo) {
  const t = p => new THREE.Vector2(espejo ? -p[0] : p[0], p[1]);
  return polis.map(c => {
    const s = new THREE.Shape(c.ext.map(t));
    for (const a of c.agujeros) s.holes.push(new THREE.Path(a.map(t)));
    return s;
  });
}

function areaDePolis(polis) {
  let a = 0;
  for (const c of polis) {
    a += Math.abs(areaFirmada(c.ext));
    for (const h of c.agujeros) a -= Math.abs(areaFirmada(h));
  }
  return a;
}

// ============================================================
// Armado del cortante
// ============================================================

function construirModelo(op) {
  const dib = obtenerDibujo(op);
  if (!dib) return null;
  const dis = normalizarDibujo(dib.contornos, op);
  if (!dis) return null;

  // ---- silueta de la galletita (S): el borde interior del filo ----
  let S = null;
  let caja;
  const margenRaster = op.pared + op.pestana + 3;
  if (op.forma === 'redonda') {
    S = [{ ext: poligonoCirculo(op.tamano / 2, 128), agujeros: [] }];
  } else if (op.forma === 'cuadrada') {
    S = [{ ext: poligonoCuadrado(op.tamano, op.esquinas), agujeros: [] }];
  }
  if (S) {
    const r = op.tamano / 2 + margenRaster;
    caja = { x0: -r, y0: -r, x1: r, y1: r };
  } else {
    const c = cajaDePolis(dis.polis);
    const m = margenRaster + op.suavizar;
    caja = { x0: c.x0 - m, y0: c.y0 - m, x1: c.x1 + m, y1: c.y1 + m };
  }
  const esc = Math.min(8, 1800 / Math.max(caja.x1 - caja.x0, caja.y1 - caja.y0));
  const R = crearRaster(caja, esc);

  if (!S) {
    // forma libre: unión de todo el dibujo con los agujeros tapados, y un
    // cierre morfológico («suavizado») que une partes cercanas y rellena
    // hendijas finas donde la masa se quedaría pegada
    let union = R.region(() => R.rellenar(dis.polis, '#000', true), 1);
    if (op.suavizar > 0) {
      const dilatada = R.region(() => { R.rellenar(union, '#000', false); R.trazar(union, 2 * op.suavizar, '#000', false); }, 1);
      union = R.region(() => { R.rellenar(dilatada, '#000', false); R.trazar(dilatada, 2 * op.suavizar, '#fff', false); }, 1);
    }
    S = union.map(c => ({ ext: c.ext, agujeros: [] }));
    S = S.filter(c => Math.abs(areaFirmada(c.ext)) > 16);  // manchas de menos de 4×4 mm no son galletita
    if (!S.length) return null;
  }

  const { pared, pestana, altura: H, grosorPestana: tB } = op;

  // ---- pared de corte: anillo entre S y S engordada «pared» ----
  const filo = R.region(() => {
    R.rellenar(S, '#000', false);
    R.trazar(S, 2 * pared, '#000', false);
    R.rellenar(S, '#fff', false);
  }, 0.5);

  // ---- refuerzo: banda más gruesa al pie de la pared ----
  const hRefuerzo = Math.min(4, (H - tB) * 0.35);
  const refuerzo = op.refuerzo ? R.region(() => {
    R.rellenar(S, '#000', false);
    R.trazar(S, 2 * (pared + 0.6), '#000', false);
    R.rellenar(S, '#fff', false);
  }, 0.5) : [];

  // ---- marcador: el dibujo que se estampa en la masa, lejos del filo ----
  // (en forma libre con zonas rellenas se aleja más, para que el contorno
  // exterior de un dibujo de líneas no quede como anillo pegado a la pared)
  const holgura = op.marcador === 'lineas'
    ? Math.max(1.2, op.anchoLinea / 2 + 0.8)
    : (op.forma === 'libre' ? 2.5 : 1.2);
  let marca = [];
  if (op.marcador !== 'sin') {
    const interior = R.region(() => {
      R.rellenar(S, '#000', false);
      R.trazar(S, 2 * holgura, '#fff', false);
    }, 1);
    if (interior.length) {
      marca = R.region(() => R.recortar(interior, () => {
        if (op.marcador === 'lineas') {
          R.trazar(dis.polis, op.anchoLinea, '#000', false);
        } else {
          R.rellenar(dis.polis, '#000', false);
          if (op.engrosar > 0) R.trazar(dis.polis, op.engrosar, '#000', false);
        }
      }), 0.8);
    }
  }
  const conPlaca = marca.length > 0;

  // ---- pestaña de apoyo (y placa que sostiene el marcador) ----
  const labio = 1.5;
  let labioInterior = [];
  if (!conPlaca) {
    labioInterior = R.region(() => {
      R.rellenar(S, '#000', false);
      R.trazar(S, 2 * (labio), '#fff', false);
    }, 1);
  }
  const pestanaRegion = R.region(() => {
    R.rellenar(S, '#000', false);
    R.trazar(S, 2 * (pared + pestana), '#000', false);
    if (!conPlaca && labioInterior.length) R.rellenar(labioInterior, '#fff', false);
  }, 0.5);

  // ---- extrusiones (Z hacia arriba, pestaña apoyada en z = 0) ----
  const piezas = [];
  const extruir = (polis, alto, z, color) => {
    if (!polis.length || !(alto > 0)) return;
    const g = new THREE.ExtrudeGeometry(shapesDePolis(polis, op.espejar), { depth: alto, bevelEnabled: false });
    g.translate(0, 0, z);
    piezas.push({ geometria: g, color });
  };
  extruir(pestanaRegion, tB, 0, COLOR_CUERPO);
  extruir(refuerzo, hRefuerzo, tB, COLOR_CUERPO);
  extruir(filo, H - tB, tB, COLOR_FILO);
  // el marcador llega hasta «marca» mm por debajo de la superficie de una
  // masa de «masa» mm de espesor cuando el filo toca la mesa
  const hMarca = Math.min(H - 0.6, Math.max(tB + 0.8, H - op.masa + op.marca));
  if (conPlaca) extruir(marca, hMarca - tB, tB, COLOR_MARCA);

  // ---- planta: la galletita como va a quedar (sin espejar) ----
  const planta = [
    { polis: pestanaRegion, color: 'rgba(150,158,172,0.45)' },
    { polis: S, color: '#f1d79a' },
    { polis: filo, color: '#5c6b7f' },
    { polis: marca, color: '#a3502b' }
  ];

  const cajaTotal = cajaDePolis(pestanaRegion.length ? pestanaRegion : filo);
  const cajaS = cajaDePolis(S);
  return {
    piezas, planta,
    conPlaca,
    hMarca,
    piezasSueltas: pestanaRegion.length,
    areaMarca: areaDePolis(marca),
    medidas: {
      ancho: cajaTotal.x1 - cajaTotal.x0, alto: cajaTotal.y1 - cajaTotal.y0, altura: H,
      galletitaAncho: cajaS.x1 - cajaS.x0, galletitaAlto: cajaS.y1 - cajaS.y0
    }
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
      camara.position.set(objetivo.x + r * 1.1, objetivo.y + r * 1.4, objetivo.z + r * 1.5);
      camara.near = r / 100; camara.far = r * 30;
      camara.updateProjectionMatrix();
      medir();
    }
  };
}

// ============================================================
// Vista 2D: la galletita como va a quedar
// ============================================================

function dibujarPlanta(resultado) {
  const lienzo = $('lienzoPlanta');
  const ctx = lienzo.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = lienzo.width = (lienzo.clientWidth || 600) * dpr;
  const H = lienzo.height = 300 * dpr;
  ctx.clearRect(0, 0, W, H);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const ent of resultado.planta) {
    if (!ent.polis.length) continue;
    const c = cajaDePolis(ent.polis);
    x0 = Math.min(x0, c.x0); y0 = Math.min(y0, c.y0); x1 = Math.max(x1, c.x1); y1 = Math.max(y1, c.y1);
  }
  const anchoM = x1 - x0 || 1, altoM = y1 - y0 || 1;
  const esc = Math.min((W - 30 * dpr) / anchoM, (H - 30 * dpr) / altoM);
  const ox = W / 2 - (x0 + anchoM / 2) * esc;
  const oy = H / 2 + (y0 + altoM / 2) * esc;
  for (const ent of resultado.planta) {
    if (!ent.polis.length) continue;
    const ruta = new Path2D();
    const pintar = (pts) => {
      pts.forEach((p, i) => {
        const x = ox + p[0] * esc, y = oy - p[1] * esc;
        i ? ruta.lineTo(x, y) : ruta.moveTo(x, y);
      });
      ruta.closePath();
    };
    for (const c of ent.polis) { pintar(c.ext); for (const a of c.agujeros) pintar(a); }
    ctx.fillStyle = ent.color;
    ctx.fill(ruta, 'evenodd');
  }
  // regla de 10 mm
  const px10 = 10 * esc;
  ctx.strokeStyle = '#444'; ctx.lineWidth = 1.5 * dpr;
  ctx.beginPath(); ctx.moveTo(12 * dpr, H - 12 * dpr); ctx.lineTo(12 * dpr + px10, H - 12 * dpr); ctx.stroke();
  ctx.fillStyle = '#444'; ctx.font = (11 * dpr) + 'px "JetBrains Mono", monospace';
  ctx.fillText('10 mm', 12 * dpr + px10 + 5 * dpr, H - 9 * dpr);
}

// ============================================================
// Exportar STL binario y 3MF (dos colores: cuerpo y marcador)
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
  const cabecera = 'Molde de galletitas - Generador de Actividades';
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

function generar3MF(piezas) {
  const colores = [];
  const indiceColor = (c) => {
    const hex = '#' + c.toString(16).padStart(6, '0').toUpperCase();
    let i = colores.indexOf(hex);
    if (i < 0) { colores.push(hex); i = colores.length - 1; }
    return i;
  };
  let objetos = '', items = '', id = 2;
  for (const pieza of piezas) {
    const g = pieza.geometria.index ? pieza.geometria.toNonIndexed() : pieza.geometria;
    const pos = g.getAttribute('position');
    const mapa = new Map();
    const verts = [], tris = [];
    const idVert = (x, y, z) => {
      const k = x.toFixed(3) + ',' + y.toFixed(3) + ',' + z.toFixed(3);
      let i = mapa.get(k);
      if (i === undefined) {
        i = verts.length;
        verts.push('<vertex x="' + x.toFixed(3) + '" y="' + y.toFixed(3) + '" z="' + z.toFixed(3) + '"/>');
        mapa.set(k, i);
      }
      return i;
    };
    for (let i = 0; i < pos.count; i += 3) {
      const a = idVert(pos.getX(i), pos.getY(i), pos.getZ(i));
      const b = idVert(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
      const c = idVert(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
      if (a !== b && b !== c && a !== c) tris.push('<triangle v1="' + a + '" v2="' + b + '" v3="' + c + '"/>');
    }
    objetos += '<object id="' + id + '" type="model" pid="1" pindex="' + indiceColor(pieza.color) + '">' +
      '<mesh><vertices>' + verts.join('') + '</vertices><triangles>' + tris.join('') + '</triangles></mesh></object>';
    items += '<item objectid="' + id + '"/>';
    id++;
  }
  const materiales = colores.map((hex, i) => '<base name="Color ' + (i + 1) + '" displaycolor="' + hex + '"/>').join('');
  const modelo = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<model unit="millimeter" xml:lang="es" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">' +
    '<metadata name="Application">Generador de Actividades — Molde de galletitas</metadata>' +
    '<resources><basematerials id="1">' + materiales + '</basematerials>' + objetos + '</resources>' +
    '<build>' + items + '</build></model>';
  const tipos = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>';
  const rels = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Target="/3D/3dmodel.model" Id="rel0" ' +
    'Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>';
  const zip = new JSZip();
  zip.file('[Content_Types].xml', tipos);
  zip.file('_rels/.rels', rels);
  zip.file('3D/3dmodel.model', modelo);
  return zip.generateAsync({ type: 'blob', mimeType: 'model/3mf', compression: 'DEFLATE' });
}

function descargarBlob(blob, nombre) {
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 4000);
}

$('btnSTL').addEventListener('click', () => {
  if (!estado.piezas) { toast('Primero subí un dibujo'); return; }
  const { buffer } = generarSTL(estado.piezas);
  descargarBlob(new Blob([buffer], { type: 'model/stl' }), (estado.nombre || 'galletita') + '-cortante.stl');
  toast('STL descargado: llevalo al slicer de la impresora 3D');
});

$('btn3MF').addEventListener('click', () => {
  if (!estado.piezas) { toast('Primero subí un dibujo'); return; }
  if (typeof JSZip === 'undefined') { toast('No se pudo cargar el empaquetador ZIP; usá el STL'); return; }
  generar3MF(estado.piezas).then(blob => {
    descargarBlob(blob, (estado.nombre || 'galletita') + '-cortante.3mf');
    toast('3MF descargado: el cuerpo y el marcador van como colores separados');
  }).catch(err => {
    console.error(err);
    toast('No pude armar el 3MF: ' + err.message);
  });
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
    $('statsModelo').innerHTML = '<span class="inf-stats__item">⚠ No encontré ninguna figura en el dibujo. Si es una imagen, probá mover el umbral de claro/oscuro o activá «invertir».</span>';
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
  const f = n => n.toFixed(1).replace('.', ',');
  const nombreForma = { redonda: 'redonda', cuadrada: 'cuadrada', libre: 'con la forma del dibujo' }[op.forma];
  let marcador;
  if (op.marcador === 'sin') marcador = '✂ solo cortante (sin marcador)';
  else if (resultado.conPlaca) marcador = `🖋 marcador ${op.marcador === 'lineas' ? 'por líneas' : 'por zonas rellenas'}, marca ${f(op.marca)} mm en masa de ${f(op.masa)} mm`;
  else marcador = '🖋 ⚠ el dibujo no deja nada para marcar adentro (queda solo el cortante)';
  $('statsModelo').innerHTML = `
    <span class="inf-stats__item">🍪 galletita ${nombreForma}: ${f(m.galletitaAncho)} × ${f(m.galletitaAlto)} mm</span>
    <span class="inf-stats__item">📏 cortante ${f(m.ancho)} × ${f(m.alto)} mm, ${f(m.altura)} mm de alto</span>
    <span class="inf-stats__item">${marcador}</span>
    <span class="inf-stats__item">${op.espejar ? '🪞 modelo espejado: el dibujo se lee derecho en la galletita' : '👁 sin espejar: el dibujo saldrá al revés en la galletita'}</span>
    <span class="inf-stats__item">🔺 ${Math.round(nTri).toLocaleString('es')} triángulos</span>
    ${resultado.piezasSueltas > 1 ? `<span class="inf-stats__item">⚠ salen ${resultado.piezasSueltas} piezas separadas: subí el suavizado del contorno, agrandá la pestaña o elegí forma redonda o cuadrada</span>` : ''}`;
}

// ============================================================
// Eventos de los controles
// ============================================================

document.querySelectorAll('input[name="forma"]').forEach(radio => {
  radio.addEventListener('change', () => { ajustarControles(); regenerar(); });
});
for (const id of ['optTamano', 'optAltura', 'optPared', 'optPestana', 'optGrosorPestana', 'optRefuerzo', 'optMarcador',
  'optAnchoLinea', 'optMasa', 'optMarca', 'optEngrosar', 'optMargen', 'optEsquinas', 'optSuavizar', 'optEspejar',
  'optRotar', 'optCalcar', 'optInvertir']) {
  $(id).addEventListener('change', () => { ajustarControles(); regenerarPronto(); });
}
$('optUmbral').addEventListener('input', () => { ajustarControles(); regenerarPronto(); });

// ============================================================
// Dibujos listos para probar sin subir nada
// ============================================================

const ICONOS = [
  ['jengibre', 'M50 3 C59 3 66 10 66 19 C66 25 63 30 58 33 L80 44 C86 47 86 55 81 58 C77 60 72 59 68 56 L64 54 L64 72 L75 94 C76 98 72 100 68 99 L58 82 L50 79 L42 82 L32 99 C28 100 24 98 25 94 L36 72 L36 54 L32 56 C28 59 23 60 19 58 C14 55 14 47 20 44 L42 33 C37 30 34 25 34 19 C34 10 41 3 50 3 Z M44 18 A3 3 0 1 0 44 24 A3 3 0 1 0 44 18 Z M56 18 A3 3 0 1 0 56 24 A3 3 0 1 0 56 18 Z M42 27 Q50 33 58 27 Q50 36 42 27 Z M50 46 A3 3 0 1 0 50 52 A3 3 0 1 0 50 46 Z M50 60 A3 3 0 1 0 50 66 A3 3 0 1 0 50 60 Z'],
  ['estrella', 'M50 4 L61 38 L97 38 L68 60 L79 95 L50 73 L21 95 L32 60 L3 38 L39 38 Z'],
  ['corazon', 'M50 90 C14 62 4 40 12 26 C20 12 40 12 50 28 C60 12 80 12 88 26 C96 40 86 62 50 90 Z'],
  ['arbol', 'M50 3 L72 32 L62 32 L80 56 L68 56 L88 82 L56 82 L56 97 L44 97 L44 82 L12 82 L32 56 L20 56 L38 32 L28 32 Z'],
  ['carita', 'M50 96 A46 46 0 1 1 50 4 A46 46 0 1 1 50 96 Z M34 44 A7 9 0 1 0 34 26 A7 9 0 1 0 34 44 Z M66 44 A7 9 0 1 0 66 26 A7 9 0 1 0 66 44 Z M24 58 C32 74 68 74 76 58 C70 84 30 84 24 58 Z'],
  ['flor', 'M50 34 A14 14 0 1 1 50 6 A14 14 0 1 1 50 34 Z M50 94 A14 14 0 1 1 50 66 A14 14 0 1 1 50 94 Z M34 50 A14 14 0 1 1 6 50 A14 14 0 1 1 34 50 Z M94 50 A14 14 0 1 1 66 50 A14 14 0 1 1 94 50 Z M50 62 A12 12 0 1 1 50 38 A12 12 0 1 1 50 62 Z'],
  ['hoja', 'M50 4 C88 26 92 66 52 96 C48 96 48 96 48 92 L48 40 L40 60 C20 52 16 30 50 4 Z M46 44 L46 92 C14 74 16 40 46 44 Z'],
  ['luna', 'M62 4 A46 46 0 1 0 62 96 A38 38 0 1 1 62 4 Z'],
  ['casa', 'M50 6 L96 46 L84 46 L84 94 L58 94 L58 64 L42 64 L42 94 L16 94 L16 46 L4 46 Z'],
  ['huella', 'M50 92 C36 92 26 84 30 72 C33 63 42 58 50 58 C58 58 67 63 70 72 C74 84 64 92 50 92 Z M22 56 A10 12 0 1 1 22 32 A10 12 0 1 1 22 56 Z M78 56 A10 12 0 1 1 78 32 A10 12 0 1 1 78 56 Z M39 40 A9 12 0 1 1 39 16 A9 12 0 1 1 39 40 Z M61 40 A9 12 0 1 1 61 16 A9 12 0 1 1 61 40 Z'],
  ['rayo', 'M58 4 L22 56 L44 56 L40 96 L78 42 L54 42 Z'],
  ['gota', 'M50 4 C68 36 82 52 82 68 A32 30 0 1 1 18 68 C18 52 32 36 50 4 Z']
];

function svgDeIcono(path) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="' + path + '" fill="black" fill-rule="evenodd"/></svg>';
}

(function armarGrillaIconos() {
  const grid = $('gridIconos');
  for (const [nombre, path] of ICONOS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sello-icono';
    btn.title = nombre;
    btn.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="' + path + '" fill="currentColor" fill-rule="evenodd"/></svg>';
    btn.addEventListener('click', async () => {
      const svg = svgDeIcono(path);
      try {
        estado.svgTexto = svg;
        estado.imagen = await rasterizarSVG(svg);
        estado.conRellenos = true;
        estado.nombre = nombre;
      } catch (err) {
        toast('No pude cargar el dibujo: ' + err.message);
        return;
      }
      activarSecciones('✔ Dibujo «' + nombre + '» — elegí la forma y las medidas en el paso 2');
      $('optCalcar').checked = false;
      $('optMarcador').value = 'lineas';
      ajustarControles();
      regenerar();
      $('seccionOpciones').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    grid.appendChild(btn);
  }
})();

ajustarControles();
