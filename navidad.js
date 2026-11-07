// Adornos de Navidad: dos diseñadores en una página.
//  - Globo redondo personalizado: cuerpo de revolución con textura, nombre y
//    motivo, cuello o argolla; sale en dos mitades para imprimir (el cálculo
//    pesado corre en navidad-worker.js con navidad-nucleo.js).
//  - Adorno plano con nombre: silueta con el nombre en relieve, borde, patrón
//    y cinta, pie o imán; se arma acá mismo con capas 2D extruidas.

import * as THREE from 'three';
import { OrbitControls } from './lego/vendor/OrbitControls.js';
import { vectorizarMascara } from './sombras-vector.js';
import { posar, poseDeJunta } from './moldes-nucleo.js';

const $ = id => document.getElementById(id);

const estado = { modo: 'globo', globo: null, plano: null, generando: false };

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove('visible'), 3500);
}

const FUENTES = {
  lobster: '"Lobster", cursive', pacifico: '"Pacifico", cursive', chewy: '"Chewy", cursive', bungee: '"Bungee", sans-serif',
  playfair: '700 "Playfair Display", serif', oswald: '700 "Oswald", sans-serif', caveat: '700 "Caveat", cursive', grotesk: '700 "Space Grotesk", sans-serif'
};
function fuenteCSS(id, px) {
  const f = FUENTES[id] || FUENTES.lobster;
  return f.startsWith('700') ? f.replace('700 ', '700 ' + px + 'px ') : px + 'px ' + f;
}
function conFuentes(hacer) {
  if (!document.fonts || !document.fonts.load) { hacer(); return; }
  Promise.all(Object.keys(FUENTES).map(id => document.fonts.load(fuenteCSS(id, 40)).catch(() => {}))).then(hacer, hacer);
}

// ============================================================
// Siluetas y motivos: se dibujan en un lienzo de 100 × 100
// ============================================================

const estrella = (ctx, cx, cy, r, ri, n = 5) => {
  ctx.beginPath();
  for (let i = 0; i < 2 * n; i++) {
    const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? ri : r;
    i ? ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)) : ctx.moveTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
  }
  ctx.closePath(); ctx.fill();
};
const circulo = (ctx, cx, cy, r) => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); };
const linea = (ctx, x0, y0, x1, y1, w) => { ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
const path = (ctx, d) => { ctx.fill(new Path2D(d), 'evenodd'); };

// cada forma: dibujar(ctx) con relleno/trazo ya configurados; arriba: [x, y] donde cuelga
const FORMAS = {
  globo: { nombre: 'Globo', arriba: [50, 4], dibujar(ctx) { circulo(ctx, 50, 58, 40); ctx.fillRect(43, 8, 14, 16); circulo(ctx, 50, 8, 5); } },
  estrella: { nombre: 'Estrella', arriba: [50, 3], dibujar(ctx) { estrella(ctx, 50, 54, 48, 21); } },
  corazon: { nombre: 'Corazón', arriba: [30, 14], dibujar(ctx) { path(ctx, 'M50 92 C14 64 4 42 12 28 C20 14 40 14 50 30 C60 14 80 14 88 28 C96 42 86 64 50 92 Z'); } },
  campana: { nombre: 'Campana', arriba: [50, 8], dibujar(ctx) {
    path(ctx, 'M22 70 Q22 26 50 20 Q78 26 78 70 Z'); ctx.fillRect(14, 68, 72, 11); circulo(ctx, 50, 86, 7); circulo(ctx, 50, 17, 6);
    ctx.fillRect(48, 10, 4, 9);
  } },
  arbol: { nombre: 'Árbol', arriba: [50, 4], dibujar(ctx) { path(ctx, 'M50 3 L72 32 L62 32 L80 56 L68 56 L88 82 L56 82 L56 97 L44 97 L44 82 L12 82 L32 56 L20 56 L38 32 L28 32 Z'); } },
  copo: { nombre: 'Copo de nieve', arriba: [50, 5], dibujar(ctx) {
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3, c = Math.cos(a), s = Math.sin(a);
      linea(ctx, 50, 50, 50 + 45 * c, 50 + 45 * s, 7);
      for (const f of [0.45, 0.72]) {
        const bx = 50 + 45 * f * c, by = 50 + 45 * f * s, L = f < 0.6 ? 16 : 11;
        for (const sg of [1, -1]) { const b = a + sg * Math.PI / 3; linea(ctx, bx, by, bx + L * Math.cos(b), by + L * Math.sin(b), 5); }
      }
    }
    circulo(ctx, 50, 50, 8);
  } },
  jengibre: { nombre: 'Jengibre', arriba: [50, 4], dibujar(ctx) { path(ctx, 'M50 3 C59 3 66 10 66 19 C66 25 63 30 58 33 L80 44 C86 47 86 55 81 58 C77 60 72 59 68 56 L64 54 L64 72 L75 94 C76 98 72 100 68 99 L58 82 L50 79 L42 82 L32 99 C28 100 24 98 25 94 L36 72 L36 54 L32 56 C28 59 23 60 19 58 C14 55 14 47 20 44 L42 33 C37 30 34 25 34 19 C34 10 41 3 50 3 Z'); } },
  muneco: { nombre: 'Muñeco de nieve', arriba: [50, 8], dibujar(ctx) {
    circulo(ctx, 50, 76, 21); circulo(ctx, 50, 47, 15); circulo(ctx, 50, 25, 11);
    ctx.fillRect(40, 8, 20, 12); ctx.fillRect(34, 18, 32, 5);
    linea(ctx, 36, 44, 16, 30, 4); linea(ctx, 64, 44, 84, 30, 4);
  } },
  bota: { nombre: 'Bota', arriba: [47, 6], dibujar(ctx) {
    path(ctx, 'M34 18 H62 V54 Q62 62 70 66 L80 70 Q92 75 90 86 Q88 95 76 95 H48 Q38 95 34 86 Z'); ctx.fillRect(30, 6, 36, 14);
  } },
  reno: { nombre: 'Reno', arriba: [50, 4], dibujar(ctx) {
    circulo(ctx, 50, 58, 21); ctx.beginPath(); ctx.ellipse(50, 74, 14, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(28, 50, 8, 5, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(72, 50, 8, 5, 0.5, 0, Math.PI * 2); ctx.fill();
    for (const sg of [-1, 1]) {
      const x0 = 50 + sg * 10;
      linea(ctx, x0, 42, x0 + sg * 14, 12, 5); linea(ctx, x0 + sg * 7, 27, x0 + sg * 20, 22, 4); linea(ctx, x0 + sg * 4, 34, x0 - sg * 4, 20, 4);
    }
  } },
  hueso: { nombre: 'Hueso', arriba: [50, 30], dibujar(ctx) { ctx.fillRect(24, 42, 52, 16); for (const [x, y] of [[24, 41], [24, 59], [76, 41], [76, 59]]) circulo(ctx, x, y, 11); } },
  huella: { nombre: 'Huella', arriba: [50, 6], dibujar(ctx) { path(ctx, 'M50 92 C36 92 26 84 30 72 C33 63 42 58 50 58 C58 58 67 63 70 72 C74 84 64 92 50 92 Z M22 56 A10 12 0 1 1 22 32 A10 12 0 1 1 22 56 Z M78 56 A10 12 0 1 1 78 32 A10 12 0 1 1 78 56 Z M39 40 A9 12 0 1 1 39 16 A9 12 0 1 1 39 40 Z M61 40 A9 12 0 1 1 61 16 A9 12 0 1 1 61 40 Z'); } }
};
const MOTIVOS = ['reno', 'arbol', 'estrella', 'copo', 'muneco', 'jengibre', 'huella', 'corazon', 'campana'];

// dibuja la forma dentro de un cuadro de «lado» px centrado en (cx, cy) del lienzo
function dibujarForma(ctx, id, cx, cy, lado) {
  ctx.save();
  ctx.translate(cx - lado / 2, cy - lado / 2);
  ctx.scale(lado / 100, lado / 100);
  ctx.fillStyle = '#000'; ctx.strokeStyle = '#000';
  FORMAS[id].dibujar(ctx);
  ctx.restore();
}

// ============================================================
// Lienzo en mm → regiones vectorizadas (como en galletitas.js)
// ============================================================

function crearRaster(caja, esc) {
  const w = Math.ceil((caja.x1 - caja.x0) * esc) + 4, h = Math.ceil((caja.y1 - caja.y0) * esc) + 4;
  const lienzo = document.createElement('canvas');
  lienzo.width = w; lienzo.height = h;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  const X = x => (x - caja.x0) * esc + 2, Y = y => (caja.y1 - y) * esc + 2;
  const rutaDe = (polis) => {
    const r = new Path2D();
    for (const c of polis) {
      c.ext.forEach((p, i) => { i ? r.lineTo(X(p[0]), Y(p[1])) : r.moveTo(X(p[0]), Y(p[1])); }); r.closePath();
      for (const a of c.agujeros) { a.forEach((p, i) => { i ? r.lineTo(X(p[0]), Y(p[1])) : r.moveTo(X(p[0]), Y(p[1])); }); r.closePath(); }
    }
    return r;
  };
  const R = {
    ctx, esc, w, h, X, Y,
    limpiar() { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); },
    rellenar(polis, color) { ctx.fillStyle = color; ctx.fill(rutaDe(polis), 'evenodd'); },
    trazar(polis, ancho, color) { if (!(ancho > 0)) return; ctx.strokeStyle = color; ctx.lineWidth = ancho * esc; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(rutaDe(polis)); },
    recortar(polis, fn) { ctx.save(); ctx.clip(rutaDe(polis), 'evenodd'); fn(); ctx.restore(); },
    mascara() { const d = ctx.getImageData(0, 0, w, h).data; const m = new Uint8Array(w * h); for (let i = 0; i < m.length; i++) m[i] = d[i * 4] < 128 ? 1 : 0; return m; },
    vectorizar(areaMinMM2) {
      const piezas = vectorizarMascara(R.mascara(), w, h, { tolerancia: 0.7, suavizar: 1, areaMinima: Math.max(2, (areaMinMM2 || 0.5) * esc * esc) });
      const aMM = p => [(p[0] - 2) / esc + caja.x0, caja.y1 - (p[1] - 2) / esc];
      return piezas.map(c => ({ ext: c.pts.map(aMM), agujeros: c.agujeros.map(a => a.map(aMM)) }));
    }
  };
  R.region = (dibujar, areaMin) => { R.limpiar(); dibujar(); return R.vectorizar(areaMin); };
  R.limpiar();
  return R;
}

function cajaDePolis(polis) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of polis) for (const p of c.ext) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  return { x0, y0, x1, y1 };
}

function shapesDePolis(polis) {
  return polis.map(c => {
    const s = new THREE.Shape(c.ext.map(p => new THREE.Vector2(p[0], p[1])));
    for (const a of c.agujeros) s.holes.push(new THREE.Path(a.map(p => new THREE.Vector2(p[0], p[1]))));
    return s;
  });
}

// ExtrudeGeometry → {pos, idx} con Z hacia arriba
function mallaDeExtrusion(polis, alto, z) {
  if (!polis.length) return null;
  const g = new THREE.ExtrudeGeometry(shapesDePolis(polis), { depth: alto, bevelEnabled: false });
  g.translate(0, 0, z);
  const pos = g.getAttribute('position').array;
  const idx = new Uint32Array(pos.length / 3);
  for (let i = 0; i < idx.length; i++) idx[i] = i;
  g.dispose();
  return { pos: Float32Array.from(pos), idx };
}

// ============================================================
// Globo redondo
// ============================================================

function leerGlobo() {
  const num = (id, min, max, def) => Math.min(max, Math.max(min, parseFloat($(id).value) || def));
  const detalle = $('gDetalle').value;
  const hueco = $('gRelleno').value === 'hueco';
  const pared = num('gPared', 1.6, 6, 2.4);
  return {
    forma: $('gForma').value, diametro: num('gDiametro', 40, 120, 80),
    textura: $('gTextura').value, texturaN: parseInt($('gTexturaN').value, 10) || 12, texturaProf: num('gTexturaProf', 0.3, 3, 1),
    motivo: $('gMotivo').value, motivoTam: $('gMotivoTam').value,
    nombre: $('gNombre').value.trim().slice(0, 40), fuente: $('gFuente').value, letraTam: $('gLetraTam').value,
    estilo: $('gEstilo').value, relieve: Math.min(hueco ? pared - 0.8 : 3, num('gRelieve', 0.4, 3, 1)),
    tope: $('gTope').value, cuelloDiam: num('gCuello', 10, 20, 14),
    hueco, pared,
    colorCuerpo: parseInt($('gColorCuerpo').value.slice(1), 16), colorNombre: parseInt($('gColorNombre').value.slice(1), 16),
    maxNodos: { rapido: 2e6, normal: 4e6, fino: 8e6 }[detalle] || 4e6,
    maxTriangulos: { rapido: 150000, normal: 250000, fino: 400000 }[detalle] || 250000,
    conMacizo: true
  };
}

// La decoración del frente «desenrollada»: u = arco (mm), v = altura (mm).
function armarMascaraGlobo(op) {
  if (!op.nombre && op.motivo === 'ninguno') return null;
  const R = op.diametro / 2, px = 6;
  const L = Math.PI * R, V = 2 * R;
  const w = Math.round(L * px), h = Math.round(V * px);
  const lienzo = document.createElement('canvas');
  lienzo.width = w; lienzo.height = h;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  const X = u => (u + L / 2) * px, Y = v => (R - v) * px;
  const tamMotivo = { chico: 0.3, medio: 0.42, grande: 0.56 }[op.motivoTam] * R;
  let vNombre = 0, vMotivo = 0;
  if (op.nombre && op.motivo !== 'ninguno') { vNombre = -0.18 * R; vMotivo = 0.3 * R; }
  if (op.nombre) {
    let tam = { chico: 0.2, medio: 0.28, grande: 0.38 }[op.letraTam] * R;
    ctx.font = fuenteCSS(op.fuente, tam * px);
    const maxAncho = 0.62 * L * px;
    const medida = ctx.measureText(op.nombre).width;
    if (medida > maxAncho) { tam *= maxAncho / medida; ctx.font = fuenteCSS(op.fuente, tam * px); }
    ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(op.nombre, X(0), Y(vNombre));
    // trazo fino para que las letras delgadas se impriman
    ctx.strokeStyle = '#000'; ctx.lineWidth = 0.5 * px; ctx.lineJoin = 'round';
    ctx.strokeText(op.nombre, X(0), Y(vNombre));
  }
  if (op.motivo !== 'ninguno') dibujarForma(ctx, op.motivo, X(0), Y(vMotivo), tamMotivo * px);
  const d = ctx.getImageData(0, 0, w, h).data;
  const datos = new Uint8Array(w * h);
  for (let i = 0; i < datos.length; i++) datos[i] = d[i * 4] < 128 ? 1 : 0;
  return { datos, w, h, pxPorMm: px, u0: -L / 2, v0: R, lienzo };
}

let worker = null;

function generarGlobo() {
  if (estado.generando) { toast('Esperá a que termine el globo anterior'); return; }
  const op = leerGlobo();
  const mascara = armarMascaraGlobo(op);
  const vista = $('vistaMascara');
  if (mascara) { vista.style.display = ''; vista.width = mascara.w; vista.height = mascara.h; vista.getContext('2d').drawImage(mascara.lienzo, 0, 0); }
  else vista.style.display = 'none';
  estado.generando = true;
  $('btnGlobo').disabled = true;
  $('progreso').style.display = ''; $('progreso').textContent = '⏳ Preparando…';
  if (worker) worker.terminate();
  worker = new Worker('./navidad-worker.js', { type: 'module' });
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.tipo === 'progreso') { $('progreso').textContent = '⏳ ' + m.texto; return; }
    estado.generando = false; $('btnGlobo').disabled = false;
    if (m.tipo === 'error') { $('progreso').textContent = '⚠ ' + m.texto; return; }
    $('progreso').style.display = 'none';
    estado.globo = { resultado: m.resultado, op };
    mostrarGlobo();
  };
  worker.onerror = (e) => { estado.generando = false; $('btnGlobo').disabled = false; $('progreso').textContent = '⚠ Falló el cálculo: ' + (e.message || 'error'); };
  const envio = mascara ? { datos: mascara.datos, w: mascara.w, h: mascara.h, pxPorMm: mascara.pxPorMm, u0: mascara.u0, v0: mascara.v0 } : null;
  worker.postMessage({ op, mascara: envio }, envio ? [envio.datos.buffer] : []);
}

// partes posadas para imprimir: cada mitad con la cara de corte apoyada
function partesGloboImpresion() {
  const { resultado } = estado.globo;
  const salida = [];
  const corrimientos = {};
  // primero las mitades (posar las centra y apoya); la decoración copia el corrimiento de su mitad
  for (const p of resultado.partes) {
    if (p.lado === 'entero' || p.decoracion) continue;
    const pose = p.lado === 'frente' ? poseDeJunta(0, -1) : poseDeJunta(0, +1);
    // además se gira un cuarto de vuelta sobre Z para que el nombre quede de izquierda a derecha
    const poseGirada = (q) => { const r = pose(q); return [r[1], -r[0], r[2]]; };
    const m = posar({ pos: p.pos, idx: p.idx }, poseGirada);
    const q0 = poseGirada([p.pos[0], p.pos[1], p.pos[2]]);
    corrimientos[p.lado] = { pose: poseGirada, d: [m.pos[0] - q0[0], m.pos[1] - q0[1], m.pos[2] - q0[2]] };
    salida.push({ nombre: p.nombre, pos: m.pos, idx: m.idx, color: p.color, lado: p.lado, decoracion: false, medidas: m.medidas });
  }
  for (const p of resultado.partes) {
    if (!p.decoracion || !corrimientos[p.lado]) continue;
    const { pose, d } = corrimientos[p.lado];
    const pos = new Float32Array(p.pos.length);
    for (let i = 0; i < pos.length; i += 3) {
      const q = pose([p.pos[i], p.pos[i + 1], p.pos[i + 2]]);
      pos[i] = q[0] + d[0]; pos[i + 1] = q[1] + d[1]; pos[i + 2] = q[2] + d[2];
    }
    salida.push({ nombre: p.nombre, pos, idx: p.idx, color: p.color, lado: p.lado, decoracion: true, medidas: { ancho: 0 } });
  }
  return salida;
}

function mostrarGlobo() {
  const { resultado, op } = estado.globo;
  const f = n => n.toFixed(1).replace('.', ',');
  const gramos = resultado.info.volumenCm3 * 1.24 * (op.hueco ? 1 : 0.42);   // PLA; macizo con 20 % de relleno y 4 paredes ≈ 42 %
  $('statsModelo').innerHTML = [
    `🎄 globo ${op.forma} Ø ${f(op.diametro)} mm, ${f(resultado.info.alto)} mm de alto con ${op.tope === 'cuello' ? 'cuello' : op.tope === 'argolla' ? 'argolla' : 'sin tope'}`,
    `🧩 2 mitades${op.hueco ? ' huecas (pared ' + f(op.pared) + ' mm)' : ' macizas'} · ${resultado.info.pernos} pernos de filamento de 5,5 mm`,
    `⚖️ ≈ ${Math.round(gramos)} g de PLA (${f(resultado.info.volumenCm3)} cm³)`,
    `🔺 ${resultado.partes.reduce((s, p) => s + p.triangulos, 0).toLocaleString('es')} triángulos · vóxel ${f(resultado.info.voxel)} mm`
  ].map(t => `<span class="inf-stats__item">${t}</span>`).join('');
  const cont = $('descargas');
  cont.innerHTML = '';
  const nombreBase = (op.nombre || 'globo').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'globo';
  const partes = partesGloboImpresion();
  const boton = (texto, fn) => { const b = document.createElement('button'); b.className = 'btn btn--primary'; b.textContent = texto; b.addEventListener('click', fn); cont.appendChild(b); };
  boton('⬇ STL · mitades (un color)', () => {
    // cada mitad con su decoración unida
    const frente = partes.filter(p => p.lado === 'frente'), dorso = partes.filter(p => p.lado === 'dorso');
    descargarBlob(new Blob([stlDeMallas(frente)], { type: 'model/stl' }), nombreBase + '-globo-frente.stl');
    setTimeout(() => descargarBlob(new Blob([stlDeMallas(dorso)], { type: 'model/stl' }), nombreBase + '-globo-dorso.stl'), 600);
    toast('Dos STL: la mitad del frente y la del dorso, apoyadas para imprimir');
  });
  boton('⬇ 3MF · dos colores', async () => {
    if (typeof JSZip === 'undefined') { toast('No se pudo cargar el empaquetador ZIP'); return; }
    descargarBlob(await generar3MF(partes, 'Globo de Navidad'), nombreBase + '-globo.3mf');
    toast('3MF con el cuerpo y el nombre como colores separados');
  });
  const entero = resultado.partes.find(p => p.lado === 'entero');
  if (entero) boton('⬇ STL · globo macizo (para un molde)', () => {
    const m = posar({ pos: entero.pos, idx: entero.idx }, p => p);
    descargarBlob(new Blob([stlDeMallas([m])], { type: 'model/stl' }), nombreBase + '-globo-macizo.stl');
    toast('Subí este STL en «Moldes para colar» para hacerle un molde de vela o de silicona');
  });
  if (!vista3d) vista3d = iniciarVista3D();
  vista3d.mostrarGlobo(resultado, partes, $('optVistaPartes').checked);
}

// ============================================================
// Adorno plano con nombre
// ============================================================

function leerPlano() {
  const num = (id, min, max, def) => Math.min(max, Math.max(min, parseFloat($(id).value) || def));
  const colgar = $('pColgar').value;
  let grosor = num('pGrosor', 1.6, 6, 2.4);
  if (colgar === 'iman') grosor = Math.max(grosor, 3.4);
  return {
    forma: $('pForma').value,
    lineas: $('pNombre').value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 6),
    nombreGrande: $('pNombreGrande').checked, fuente: $('pFuente').value,
    patron: $('pPatron').value, altura: num('pAltura', 30, 200, 80),
    borde: $('pBorde').checked, colgar,
    grosor, relieve: num('pRelieve', 0.4, 3, 1), anchoBorde: num('pAnchoBorde', 1, 6, 2.4), agujero: num('pAgujero', 0, 10, 5),
    colorAdorno: parseInt($('pColorAdorno').value.slice(1), 16), colorNombre: parseInt($('pColorNombre').value.slice(1), 16), colorBorde: parseInt($('pColorBorde').value.slice(1), 16)
  };
}

function construirPlano(op) {
  const esc = 8;
  const alto = op.altura;
  const margen = op.agujero + 8;
  const caja = { x0: -alto * 0.75 - margen, y0: -alto / 2 - 12, x1: alto * 0.75 + margen, y1: alto / 2 + margen + 6 };
  const R = crearRaster(caja, esc);
  // silueta: la forma dibujada a «altura» mm de alto (su cuadro de 100 es la altura)
  const lado = alto;
  let S = R.region(() => dibujarForma(R.ctx, op.forma, R.X(0), R.Y(0), lado * esc), 4);
  if (!S.length) return null;
  const cs = cajaDePolis(S);
  // ajustar para que el lado mayor mida «altura»
  const factor = alto / Math.max(cs.y1 - cs.y0, cs.x1 - cs.x0);
  S = S.map(c => ({ ext: c.ext.map(p => [p[0] * factor, (p[1] - (cs.y0 + cs.y1) / 2) * factor]), agujeros: c.agujeros.map(a => a.map(p => [p[0] * factor, (p[1] - (cs.y0 + cs.y1) / 2) * factor])) }));
  const cajaS = cajaDePolis(S);
  // punto más alto de la silueta (si hay varios parecidos, el más centrado): ahí cuelga
  let arriba = [0, cajaS.y1];
  {
    let mejor = Infinity;
    const cx = (cajaS.x0 + cajaS.x1) / 2;
    for (const c of S) for (const p of c.ext) {
      if (p[1] < cajaS.y1 - 2) continue;
      const costo = Math.abs(p[0] - cx) + (cajaS.y1 - p[1]) * 3;
      if (costo < mejor) { mejor = costo; arriba = [p[0], p[1]]; }
    }
  }

  let cuerpo = S;
  const extras = [];
  // pie: fondo plano
  if (op.colgar === 'pie') {
    const corte = cajaS.y0 + alto * 0.06;
    cuerpo = R.region(() => { R.rellenar(S, '#000'); R.ctx.fillStyle = '#fff'; R.ctx.fillRect(0, R.Y(corte), R.w, R.h); }, 2);
  }
  // cinta: argolla arriba
  if (op.colgar === 'cinta' && op.agujero > 0) {
    const r = op.agujero / 2, cy = arriba[1] + r + 0.6;   // la argolla se solapa 1,8 mm con la silueta
    const ani = [{ ext: poligonoCirculo(arriba[0], cy, r + 2.4, 48), agujeros: [poligonoCirculo(arriba[0], cy, r, 40)] }];
    cuerpo = R.region(() => { R.rellenar(cuerpo, '#000'); R.rellenar(ani, '#000'); R.rellenar([{ ext: ani[0].agujeros[0], agujeros: [] }], '#fff'); }, 2);
  }
  // borde realzado: la silueta menos la silueta erosionada
  const erosion = (polis, r) => R.region(() => { R.rellenar(polis, '#000'); R.trazar(polis, 2 * r, '#fff'); }, 1);
  let borde = [];
  if (op.borde) { const E = erosion(S, op.anchoBorde); borde = R.region(() => { R.rellenar(S, '#000'); R.rellenar(E, '#fff'); }, 1); }
  const interior = erosion(S, (op.borde ? op.anchoBorde : 0) + 1.5);

  // nombre: ajustado dentro del interior
  let nombre = [];
  if (op.lineas.length && interior.length) {
    const mascaraInt = (() => { R.limpiar(); R.rellenar(interior, '#000'); return R.mascara(); })();
    // la corrida interior más larga de cada fila: [inicio, fin] en px
    const corridas = new Array(R.h);
    for (let j = 0; j < R.h; j++) {
      let mejor = null, a = -1;
      for (let i = 0; i <= R.w; i++) {
        const dentro = i < R.w && mascaraInt[i + j * R.w];
        if (dentro && a < 0) a = i;
        if (!dentro && a >= 0) { if (!mejor || i - a > mejor[1] - mejor[0]) mejor = [a, i - 1]; a = -1; }
      }
      corridas[j] = mejor;
    }
    const cyBase = R.Y((cajaS.y0 + cajaS.y1) / 2);
    const pesos = op.lineas.map((_, i) => (op.nombreGrande && i === 0 && op.lineas.length > 1) ? 1.7 : 1);
    const medidor = R.ctx;
    const anchos = (tam) => op.lineas.map((l, i) => { medidor.font = fuenteCSS(op.fuente, tam * pesos[i]); return medidor.measureText(l).width + 0.8 * esc; });
    // ¿cabe con este tamaño y este centro vertical? devuelve los centros x de cada línea o null
    const cabe = (tam, cyPx) => {
      const alturas = pesos.map(p => tam * p * 1.12);
      const total = alturas.reduce((s, a) => s + a, 0);
      const an = anchos(tam);
      let y = cyPx - total / 2;
      const centros = [];
      for (let i = 0; i < op.lineas.length; i++) {
        let a = -Infinity, b = Infinity;
        for (let j = Math.floor(y + alturas[i] * 0.12); j <= Math.ceil(y + alturas[i] * 0.95); j++) {
          const c = j >= 0 && j < R.h ? corridas[j] : null;
          if (!c) return null;
          a = Math.max(a, c[0]); b = Math.min(b, c[1]);
        }
        if (b - a < an[i]) return null;
        centros.push((a + b) / 2);
        y += alturas[i];
      }
      return centros;
    };
    let mejor = null;
    for (const desplaz of [0, -0.08, 0.08, -0.16, 0.16, -0.25, 0.25, -0.33, 0.33]) {
      const cyPx = cyBase + desplaz * alto * esc;
      let lo = 1.5 * esc, hi = alto * esc, centros = null;
      for (let k = 0; k < 16; k++) { const mid = (lo + hi) / 2; const c = cabe(mid, cyPx); if (c) { lo = mid; centros = c; } else hi = mid; }
      if (centros && (!mejor || lo > mejor.tam)) mejor = { tam: lo, cyPx, centros };
    }
    if (mejor) nombre = R.region(() => R.recortar(interior, () => {
      const { tam, cyPx, centros } = mejor;
      const alturas = pesos.map(p => tam * p * 1.12);
      const total = alturas.reduce((s, a) => s + a, 0);
      let y = cyPx - total / 2;
      R.ctx.fillStyle = '#000'; R.ctx.strokeStyle = '#000'; R.ctx.textAlign = 'center'; R.ctx.textBaseline = 'middle'; R.ctx.lineJoin = 'round';
      for (let i = 0; i < op.lineas.length; i++) {
        R.ctx.font = fuenteCSS(op.fuente, tam * pesos[i]);
        R.ctx.lineWidth = 0.45 * esc;
        R.ctx.fillText(op.lineas[i], centros[i], y + alturas[i] / 2);
        R.ctx.strokeText(op.lineas[i], centros[i], y + alturas[i] / 2);
        y += alturas[i];
      }
    }), 0.6);
  }
  // patrón de fondo, sin pisar el nombre
  let patron = [];
  if (op.patron !== 'ninguno' && interior.length) {
    const zona = erosion(S, (op.borde ? op.anchoBorde : 0) + 0.8);
    patron = R.region(() => R.recortar(zona, () => {
      R.ctx.fillStyle = '#000'; R.ctx.strokeStyle = '#000';
      const paso = op.patron === 'rayas' ? 6 : op.patron === 'estrellitas' ? 7 : 5;
      if (op.patron === 'rayas') {
        R.ctx.lineWidth = 1.6 * esc;
        for (let d = -3 * alto; d < 3 * alto; d += paso) { R.ctx.beginPath(); R.ctx.moveTo(R.X(cajaS.x0 - alto + d), R.Y(cajaS.y0 - alto)); R.ctx.lineTo(R.X(cajaS.x1 + alto + d), R.Y(cajaS.y1 + alto)); R.ctx.stroke(); }
      } else {
        for (let y = cajaS.y0; y <= cajaS.y1; y += paso) for (let x = cajaS.x0 - paso; x <= cajaS.x1 + paso; x += paso) {
          const dx = ((Math.round((y - cajaS.y0) / paso) % 2) ? paso / 2 : 0);
          if (op.patron === 'puntitos') circulo(R.ctx, R.X(x + dx), R.Y(y), 1 * esc);
          else estrella(R.ctx, R.X(x + dx), R.Y(y), 1.9 * esc, 0.8 * esc);
        }
      }
      if (nombre.length) { R.rellenar(nombre, '#fff'); R.trazar(nombre, 2.4, '#fff'); }
    }), 0.4);
  }
  // imán: bolsillo por atrás
  const piezas = [];
  const z0 = 0;
  if (op.colgar === 'iman') {
    const hueco = [{ ext: poligonoCirculo((cajaS.x0 + cajaS.x1) / 2, (cajaS.y0 + cajaS.y1) / 2, 5.3, 48), agujeros: [] }];
    const capaAbajo = R.region(() => { R.rellenar(cuerpo, '#000'); R.rellenar(hueco, '#fff'); }, 1);
    piezas.push({ nombre: 'Adorno (base con bolsillo)', polis: capaAbajo, alto: 2.2, z: z0, color: op.colorAdorno });
    piezas.push({ nombre: 'Adorno', polis: cuerpo, alto: op.grosor - 2.2, z: 2.2, color: op.colorAdorno, unir: true });
  } else {
    piezas.push({ nombre: 'Adorno', polis: cuerpo, alto: op.grosor, z: z0, color: op.colorAdorno });
  }
  if (borde.length) piezas.push({ nombre: 'Borde', polis: borde, alto: op.relieve, z: op.grosor, color: op.colorBorde });
  if (patron.length) piezas.push({ nombre: 'Patrón', polis: patron, alto: Math.max(0.4, op.relieve * 0.6), z: op.grosor, color: op.colorBorde });
  if (nombre.length) piezas.push({ nombre: 'Nombre', polis: nombre, alto: op.relieve, z: op.grosor, color: op.colorNombre });
  // pie: soporte aparte con ranura
  if (op.colgar === 'pie') {
    const ancho = Math.min(50, Math.max(30, (cajaS.x1 - cajaS.x0) * 0.6));
    const ranura = op.grosor + 0.4;
    const base = [{ ext: [[-ancho / 2, -7], [ancho / 2, -7], [ancho / 2, 7], [-ancho / 2, 7]], agujeros: [] }];
    const conRanura = [{ ext: [[-ancho / 2, -7], [ancho / 2, -7], [ancho / 2, 7], [-ancho / 2, 7]], agujeros: [[[-ancho / 2 + 3, -ranura / 2], [ancho / 2 - 3, -ranura / 2], [ancho / 2 - 3, ranura / 2], [-ancho / 2 + 3, ranura / 2]]] }];
    extras.push({ nombre: 'Pie (base)', polis: base, alto: 3, z: 0, color: op.colorBorde, aparte: true });
    extras.push({ nombre: 'Pie (ranura)', polis: conRanura, alto: 6, z: 3, color: op.colorBorde, aparte: true, unirCon: 'Pie (base)' });
  }
  const mallas = [];
  for (const p of piezas.concat(extras)) {
    const m = mallaDeExtrusion(p.polis, p.alto, p.z);
    if (m) mallas.push(Object.assign({}, p, { pos: m.pos, idx: m.idx, triangulos: m.idx.length / 3 }));
  }
  const nombreFinal = nombre.length ? 'con nombre' : 'sin nombre';
  return { mallas, medidas: { ancho: cajaS.x1 - cajaS.x0, alto: cajaS.y1 - cajaS.y0, grosor: op.grosor + op.relieve }, nombreFinal };
}

function poligonoCirculo(cx, cy, r, n) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts;
}

let temporizadorPlano = null;
function generarPlanoPronto() { clearTimeout(temporizadorPlano); temporizadorPlano = setTimeout(() => conFuentes(generarPlano), 200); }

function generarPlano() {
  const op = leerPlano();
  let res = null;
  try { res = construirPlano(op); } catch (err) { console.error(err); }
  if (!res) { $('statsModelo').innerHTML = '<span class="inf-stats__item">⚠ No pude armar el adorno.</span>'; return; }
  estado.plano = { resultado: res, op };
  const f = n => n.toFixed(1).replace('.', ',');
  $('statsModelo').innerHTML = [
    `🎄 ${FORMAS[op.forma].nombre} de ${f(res.medidas.ancho)} × ${f(res.medidas.alto)} mm, ${f(res.medidas.grosor)} mm de grosor total`,
    `✍️ ${res.nombreFinal}${op.lineas.length ? ' (' + op.lineas.length + (op.lineas.length === 1 ? ' línea' : ' líneas') + ')' : ''}`,
    `🪝 ${{ cinta: 'argolla para cinta', pie: 'pie para la mesa (pieza aparte)', iman: 'bolsillo para imán de 10 × 2 mm' }[op.colgar]}`,
    `🔺 ${res.mallas.reduce((s, m) => s + m.triangulos, 0).toLocaleString('es')} triángulos`
  ].map(t => `<span class="inf-stats__item">${t}</span>`).join('');
  const cont = $('descargas');
  cont.innerHTML = '';
  const nombreBase = (op.lineas[0] || FORMAS[op.forma].nombre).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'adorno';
  const boton = (texto, fn) => { const b = document.createElement('button'); b.className = 'btn btn--primary'; b.textContent = texto; b.addEventListener('click', fn); cont.appendChild(b); };
  const principales = res.mallas.filter(m => !m.aparte), pie = res.mallas.filter(m => m.aparte);
  boton('⬇ STL · adorno (un color)', () => {
    descargarBlob(new Blob([stlDeMallas(principales)], { type: 'model/stl' }), nombreBase + '-adorno.stl');
    if (pie.length) setTimeout(() => descargarBlob(new Blob([stlDeMallas(pie)], { type: 'model/stl' }), nombreBase + '-pie.stl'), 600);
    toast('STL descargado: se imprime plano, con el nombre hacia arriba');
  });
  boton('⬇ 3MF · colores separados', async () => {
    if (typeof JSZip === 'undefined') { toast('No se pudo cargar el empaquetador ZIP'); return; }
    descargarBlob(await generar3MF(res.mallas, 'Adorno de Navidad'), nombreBase + '-adorno.3mf');
    toast('3MF con el adorno, el nombre y el borde como colores separados');
  });
  if (!vista3d) vista3d = iniciarVista3D();
  vista3d.mostrarPlano(res);
}

// ============================================================
// Exportación: STL binario y 3MF multicolor desde {pos, idx, color}
// ============================================================

function stlDeMallas(mallas) {
  let nT = 0;
  for (const m of mallas) nT += m.idx.length / 3;
  const buffer = new ArrayBuffer(84 + nT * 50);
  const dv = new DataView(buffer);
  const cabecera = 'Adorno de Navidad - Generador de Actividades';
  for (let i = 0; i < 80; i++) dv.setUint8(i, i < cabecera.length ? cabecera.charCodeAt(i) & 0x7f : 0);
  dv.setUint32(80, nT, true);
  let off = 84;
  for (const m of mallas) {
    const { pos, idx } = m;
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      dv.setFloat32(off, nx, true); dv.setFloat32(off + 4, ny, true); dv.setFloat32(off + 8, nz, true); off += 12;
      for (const o of [a, b, c]) { dv.setFloat32(off, pos[o], true); dv.setFloat32(off + 4, pos[o + 1], true); dv.setFloat32(off + 8, pos[o + 2], true); off += 12; }
      dv.setUint16(off, 0, true); off += 2;
    }
  }
  return buffer;
}

function generar3MF(mallas, titulo) {
  const colores = [];
  const indiceColor = (c) => {
    const hex = '#' + c.toString(16).padStart(6, '0').toUpperCase();
    let i = colores.indexOf(hex);
    if (i < 0) { colores.push(hex); i = colores.length - 1; }
    return i;
  };
  let objetos = '', items = '', id = 2;
  for (const m of mallas) {
    const { pos, idx } = m;
    const mapa = new Map(); const verts = [], tris = [];
    const idVert = (o) => {
      const k = pos[o].toFixed(3) + ',' + pos[o + 1].toFixed(3) + ',' + pos[o + 2].toFixed(3);
      let i = mapa.get(k);
      if (i === undefined) { i = verts.length; verts.push('<vertex x="' + pos[o].toFixed(3) + '" y="' + pos[o + 1].toFixed(3) + '" z="' + pos[o + 2].toFixed(3) + '"/>'); mapa.set(k, i); }
      return i;
    };
    for (let t = 0; t < idx.length; t += 3) {
      const a = idVert(idx[t] * 3), b = idVert(idx[t + 1] * 3), c = idVert(idx[t + 2] * 3);
      if (a !== b && b !== c && a !== c) tris.push('<triangle v1="' + a + '" v2="' + b + '" v3="' + c + '"/>');
    }
    objetos += '<object id="' + id + '" name="' + (m.nombre || 'parte').replace(/[<>&"]/g, '') + '" type="model" pid="1" pindex="' + indiceColor(m.color) + '">' +
      '<mesh><vertices>' + verts.join('') + '</vertices><triangles>' + tris.join('') + '</triangles></mesh></object>';
    items += '<item objectid="' + id + '"/>';
    id++;
  }
  const materiales = colores.map((hex, i) => '<base name="Color ' + (i + 1) + '" displaycolor="' + hex + '"/>').join('');
  const modelo = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<model unit="millimeter" xml:lang="es" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">' +
    '<metadata name="Application">Generador de Actividades — ' + titulo + '</metadata>' +
    '<resources><basematerials id="1">' + materiales + '</basematerials>' + objetos + '</resources>' +
    '<build>' + items + '</build></model>';
  const tipos = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>';
  const rels = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>';
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
  const sol = new THREE.DirectionalLight(0xffffff, 1.5); sol.position.set(1, 2, 1.5); escena.add(sol);
  const contra = new THREE.DirectionalLight(0xffffff, 0.5); contra.position.set(-1.5, 1, -1); escena.add(contra);
  const grupo = new THREE.Group();
  grupo.rotation.x = -Math.PI / 2;
  escena.add(grupo);
  function medir() {
    const w = lienzo.clientWidth || 600, h = lienzo.clientHeight || 440;
    renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix();
  }
  medir();
  window.addEventListener('resize', medir);
  (function animar() { requestAnimationFrame(animar); controles.update(); renderer.render(escena, camara); })();

  const limpiar = () => { while (grupo.children.length) { const h = grupo.children[0]; grupo.remove(h); if (h.geometry) h.geometry.dispose(); } };
  const agregar = (pos, idx, color, dx) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    const malla = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, metalness: 0.1, roughness: 0.45 }));
    malla.position.x = dx || 0;
    grupo.add(malla);
    g.computeBoundingBox();
    return g.boundingBox.clone().translate(new THREE.Vector3(dx || 0, 0, 0));
  };
  // dir: 'frente' mira el +X del modelo (donde va el nombre del globo); 'arriba' mira desde arriba
  const encuadrar = (caja, dir) => {
    const centro = caja.getCenter(new THREE.Vector3());
    const r = caja.getSize(new THREE.Vector3()).length() / 2 || 1;
    const objetivo = new THREE.Vector3(centro.x, centro.z, -centro.y);
    controles.target.copy(objetivo);
    if (dir === 'frente') camara.position.set(objetivo.x + r * 1.9, objetivo.y + r * 0.5, objetivo.z + r * 0.7);
    else if (dir === 'arriba') camara.position.set(objetivo.x + r * 0.15, objetivo.y + r * 1.6, objetivo.z + r * 1.0);
    else if (dir === 'partes') camara.position.set(objetivo.x + r * 1.3, objetivo.y + r * 1.5, objetivo.z + r * 0.4);
    else camara.position.set(objetivo.x + r * 0.8, objetivo.y + r * 0.9, objetivo.z + r * 1.7);
    camara.near = r / 100; camara.far = r * 30; camara.updateProjectionMatrix();
    medir();
  };
  return {
    mostrarGlobo(resultado, partesImpresion, verPartes) {
      limpiar();
      const caja = new THREE.Box3();
      if (verPartes) {
        // las mitades una al lado de la otra; la decoración sobre la mitad del frente
        let x = 0;
        const posiciones = {};
        for (const p of partesImpresion) {
          if (p.decoracion) continue;
          posiciones[p.lado] = x;
          caja.union(agregar(p.pos, p.idx, p.color, x));
          x += p.medidas.ancho + 12;
        }
        for (const p of partesImpresion) if (p.decoracion) caja.union(agregar(p.pos, p.idx, p.color, posiciones[p.lado] || 0));
        encuadrar(caja, 'arriba');
      } else {
        for (const p of resultado.partes) if (p.lado !== 'entero') caja.union(agregar(p.pos, p.idx, p.color, 0));
        encuadrar(caja, 'frente');
      }
    },
    mostrarPlano(res) {
      limpiar();
      const caja = new THREE.Box3();
      const anchoAdorno = res.medidas.ancho;
      for (const m of res.mallas) caja.union(agregar(m.pos, m.idx, m.color, m.aparte ? anchoAdorno / 2 + 30 : 0));
      encuadrar(caja, 'arriba');
    }
  };
}

// ============================================================
// Modo, controles y eventos
// ============================================================

function ajustarModo() {
  const modo = (document.querySelector('input[name="modo"]:checked') || {}).value || 'globo';
  estado.modo = modo;
  $('panelGlobo').style.display = modo === 'globo' ? '' : 'none';
  $('panelPlano').style.display = modo === 'plano' ? '' : 'none';
  $('filaVistaGlobo').style.display = modo === 'globo' ? '' : 'none';
  $('consejosGlobo').style.display = modo === 'globo' ? '' : 'none';
  $('consejosPlano').style.display = modo === 'plano' ? '' : 'none';
  $('descargas').innerHTML = '';
  $('statsModelo').innerHTML = '';
  if (modo === 'globo') { if (estado.globo) mostrarGlobo(); else conFuentes(generarGlobo); }
  else generarPlanoPronto();
}
function ajustarControlesGlobo() {
  const tex = $('gTextura').value;
  $('grupoTextura').style.display = tex === 'lisa' ? 'none' : '';
  $('grupoTexturaProf').style.display = (tex === 'lisa' || tex === 'facetas') ? 'none' : '';
  $('grupoCuello').style.display = $('gTope').value === 'cuello' ? '' : 'none';
  $('grupoPared').style.display = $('gRelleno').value === 'hueco' ? '' : 'none';
  const sinDecor = !$('gNombre').value.trim() && $('gMotivo').value === 'ninguno';
  $('grupoDecor').style.display = sinDecor ? 'none' : '';
}
function ajustarControlesPlano() {
  $('grupoAgujero').style.display = $('pColgar').value === 'cinta' ? '' : 'none';
}

// selectores de forma y motivo con íconos
(function armarSelectores() {
  const sel = $('pForma');
  for (const id of Object.keys(FORMAS)) { const o = document.createElement('option'); o.value = id; o.textContent = FORMAS[id].nombre; sel.appendChild(o); }
  const sm = $('gMotivo');
  const ninguno = document.createElement('option'); ninguno.value = 'ninguno'; ninguno.textContent = 'Ninguno'; sm.appendChild(ninguno);
  for (const id of MOTIVOS) { const o = document.createElement('option'); o.value = id; o.textContent = FORMAS[id].nombre; sm.appendChild(o); }
  sm.value = 'reno';
  // vista previa de las siluetas
  const grid = $('gridFormas');
  for (const id of Object.keys(FORMAS)) {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'sello-icono'; btn.title = FORMAS[id].nombre;
    const c = document.createElement('canvas'); c.width = 60; c.height = 60;
    const ctx = c.getContext('2d'); ctx.fillStyle = 'currentColor';
    ctx.save(); ctx.scale(0.6, 0.6); ctx.fillStyle = '#333'; ctx.strokeStyle = '#333'; FORMAS[id].dibujar(ctx); ctx.restore();
    btn.appendChild(c);
    btn.addEventListener('click', () => { $('pForma').value = id; generarPlanoPronto(); });
    grid.appendChild(btn);
  }
})();

document.querySelectorAll('input[name="modo"]').forEach(r => r.addEventListener('change', ajustarModo));
for (const id of ['gForma', 'gDiametro', 'gTextura', 'gTexturaN', 'gTexturaProf', 'gMotivo', 'gMotivoTam', 'gFuente', 'gLetraTam', 'gEstilo', 'gRelieve', 'gTope', 'gCuello', 'gRelleno', 'gPared', 'gColorCuerpo', 'gColorNombre', 'gDetalle']) {
  $(id).addEventListener('change', () => { ajustarControlesGlobo(); marcarPendiente(); });
}
$('gNombre').addEventListener('input', () => { ajustarControlesGlobo(); marcarPendiente(); });
$('btnGlobo').addEventListener('click', () => { $('btnGlobo').classList.remove('moldes-pendiente'); $('btnGlobo').textContent = '🎄 Generar el globo'; conFuentes(generarGlobo); });
$('optVistaPartes').addEventListener('change', () => { if (estado.globo) mostrarGlobo(); });
function marcarPendiente() { $('btnGlobo').classList.add('moldes-pendiente'); $('btnGlobo').textContent = '🎄 Generar el globo (hay cambios sin aplicar)'; }

for (const id of ['pForma', 'pNombreGrande', 'pFuente', 'pPatron', 'pAltura', 'pBorde', 'pColgar', 'pGrosor', 'pRelieve', 'pAnchoBorde', 'pAgujero', 'pColorAdorno', 'pColorNombre', 'pColorBorde']) {
  $(id).addEventListener('change', () => { ajustarControlesPlano(); generarPlanoPronto(); });
}
$('pNombre').addEventListener('input', generarPlanoPronto);

ajustarControlesGlobo();
ajustarControlesPlano();
ajustarModo();
