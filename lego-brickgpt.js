// Formato BrickGPT: texto → guía de ensamble.
//
// BrickGPT (Pun, Deng, Liu, Ramanan, Liu y Zhu — Carnegie Mellon University,
// ICCV 2025 · https://github.com/AvaLovelace1/BrickGPT · licencia MIT) genera
// modelos LEGO a partir de una descripción en palabras, usando un modelo de
// lenguaje entrenado para que lo que sale se pueda armar de verdad.
//
// El modelo en sí es un LLM que corre con Python y GPU: no puede vivir dentro
// de esta página. Lo que sí vive acá es TODO lo que rodea al modelo:
//
//   · su formato de texto — una línea por ladrillo, "hxw (x,y,z)" — que se
//     convierte en la guía paso a paso, con piezas editables;
//   · su instrucción para el modelo, adaptada al español, para pedirle el
//     modelo a cualquier IA (ChatGPT, Claude, Gemini) o al demo oficial;
//   · sus chequeos de armabilidad, portados tal cual: fuera de la caja,
//     colisiones, ladrillos flotando y conexión al suelo. Son los mismos que
//     usa BrickGPT cuando corre sin el optimizador Gurobi.
//
// Convenciones del formato (de brick_structure.py del proyecto original):
//   · "hxw (x,y,z)": h ocupa el eje X, w ocupa el eje Y, z es el piso.
//   · Todos los ladrillos son de 1 unidad de alto (= 1 ladrillo = 3 placas).
//   · El mundo es una caja de 20×20×20 y el primer piso es z=0.

import { COLORES, piezaPorClave } from './lego-catalogo.js';

export const MUNDO = 20;

// Los 8 ladrillos de la biblioteca de BrickGPT (brick_library.json), todos en
// el catálogo del generador: [menor, mayor] → clave de la pieza.
export const LADRILLOS = [
  { h: 1, w: 1, clave: 'ladrillo 1x1' },
  { h: 1, w: 2, clave: 'ladrillo 1x2' },
  { h: 1, w: 4, clave: 'ladrillo 1x4' },
  { h: 1, w: 6, clave: 'ladrillo 1x6' },
  { h: 1, w: 8, clave: 'ladrillo 1x8' },
  { h: 2, w: 2, clave: 'ladrillo 2x2' },
  { h: 2, w: 4, clave: 'ladrillo 2x4' },
  { h: 2, w: 6, clave: 'ladrillo 2x6' },
];

export const DIMENSIONES_TEXTO = LADRILLOS
  .map(l => (l.h === l.w ? `${l.h}x${l.w}` : `${l.h}x${l.w}, ${l.w}x${l.h}`))
  .join(', ');

function claveDeMedidas(h, w) {
  const menor = Math.min(h, w), mayor = Math.max(h, w);
  const l = LADRILLOS.find(x => x.h === menor && x.w === mayor);
  return l ? l.clave : null;
}

// ============================================================
// Parseo del texto
// ============================================================

const RE_LADRILLO = /^(\d+)x(\d+)\s*\((-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\)$/;

// Devuelve { ladrillos, errores }. Ignora líneas vacías, comentarios y el
// palabrerío que suelen agregar las IA alrededor de la lista.
export function parsearTextoBrickGPT(texto) {
  const ladrillos = [];
  const errores = [];
  String(texto || '').split(/\r?\n/).forEach((cruda, i) => {
    const linea = cruda.trim().replace(/^[-*·•]\s*/, '').replace(/[,;]$/, '');
    if (!linea || /^(#|\/\/|```)/.test(linea)) return;
    const m = linea.match(RE_LADRILLO);
    if (!m) {
      // texto suelto de la IA ("Here is the model:"): solo molesta si parece
      // que quiso ser un ladrillo
      if (/\d+\s*x\s*\d+/.test(linea)) {
        errores.push(`Línea ${i + 1}: no se entiende "${linea.slice(0, 50)}" — el formato es «2x4 (0,0,0)».`);
      }
      return;
    }
    const [, h, w, x, y, z] = m.map(Number);
    const ladrillo = { h, w, x, y, z, nLinea: i + 1 };
    if (!claveDeMedidas(h, w)) {
      errores.push(`Línea ${i + 1}: no existe el ladrillo ${h}×${w}. Los permitidos son ${DIMENSIONES_TEXTO}.`);
      return;
    }
    ladrillos.push(ladrillo);
  });
  return { ladrillos, errores };
}

export function serializarLadrillo(l) {
  return `${l.h}x${l.w} (${l.x},${l.y},${l.z})`;
}

// ============================================================
// Chequeo de armabilidad (el mismo que hace BrickGPT sin Gurobi)
// ============================================================

function seSuperponen(a, b) {
  return a.x < b.x + b.h && a.x + a.h > b.x && a.y < b.y + b.w && a.y + a.w > b.y;
}

// Devuelve { fuera, colisiones, flotantes, sueltos, ok }
export function revisar(ladrillos, mundo = MUNDO) {
  const fuera = ladrillos.filter(l =>
    l.x < 0 || l.y < 0 || l.z < 0 || l.x + l.h > mundo || l.y + l.w > mundo || l.z >= mundo);

  // colisiones: dos ladrillos ocupando el mismo cubito
  const ocupados = new Map();   // "x,y,z" -> [ladrillos]
  const colisiones = new Set();
  for (const l of ladrillos) {
    for (let x = l.x; x < l.x + l.h; x++) {
      for (let y = l.y; y < l.y + l.w; y++) {
        const k = x + ',' + y + ',' + l.z;
        const previos = ocupados.get(k);
        if (previos) { previos.forEach(p => colisiones.add(p)); colisiones.add(l); previos.push(l); }
        else ocupados.set(k, [l]);
      }
    }
  }

  const zMin = ladrillos.reduce((m, l) => Math.min(m, l.z), Infinity);
  const porPiso = new Map();
  for (const l of ladrillos) {
    if (!porPiso.has(l.z)) porPiso.set(l.z, []);
    porPiso.get(l.z).push(l);
  }
  const hayEn = (l, z) => (porPiso.get(z) || []).some(o => seSuperponen(l, o));

  // flotantes: sin nada abajo ni arriba (BrickGPT acepta las dos formas)
  const flotantes = ladrillos.filter(l =>
    l.z !== zMin && !hayEn(l, l.z - 1) && !hayEn(l, l.z + 1));

  // conexión al suelo: grafo de ladrillos que se pisan entre pisos vecinos
  const conectados = new Set(ladrillos.filter(l => l.z === zMin));
  const cola = [...conectados];
  while (cola.length) {
    const l = cola.pop();
    for (const z of [l.z - 1, l.z + 1]) {
      for (const o of porPiso.get(z) || []) {
        if (!conectados.has(o) && seSuperponen(l, o)) { conectados.add(o); cola.push(o); }
      }
    }
  }
  const sueltos = ladrillos.filter(l => !conectados.has(l));

  return {
    fuera,
    colisiones: [...colisiones],
    flotantes,
    sueltos,
    ok: !fuera.length && !colisiones.size && !flotantes.length && !sueltos.length,
  };
}

// Los problemas del chequeo, en frases para mostrar
export function avisosDeRevision(rev, total) {
  const avisos = [];
  const lista = (ls) => ls.slice(0, 6).map(serializarLadrillo).join(' · ') + (ls.length > 6 ? ' …' : '');
  if (rev.fuera.length) {
    avisos.push(`📐 ${rev.fuera.length} ladrillo(s) se salen de la caja de ${MUNDO}×${MUNDO}×${MUNDO}: ${lista(rev.fuera)}`);
  }
  if (rev.colisiones.length) {
    avisos.push(`💥 ${rev.colisiones.length} ladrillo(s) chocan entre sí (ocupan el mismo lugar): ${lista(rev.colisiones)}`);
  }
  if (rev.flotantes.length) {
    avisos.push(`🎈 ${rev.flotantes.length} ladrillo(s) quedan flotando, sin nada abajo ni arriba: ${lista(rev.flotantes)}`);
  }
  if (rev.sueltos.length) {
    avisos.push(`⛓️‍💥 ${rev.sueltos.length} ladrillo(s) no llegan al suelo por ninguna cadena de encastres — el modelo sale en pedazos sueltos: ${lista(rev.sueltos)}`);
  }
  if (rev.ok) avisos.push(`✅ Los ${total} ladrillos pasan el chequeo de BrickGPT: entran en la caja, no chocan, ninguno flota y todos se encadenan hasta el suelo.`);
  return avisos;
}

// ============================================================
// Ladrillos BrickGPT → piezas del generador
// ============================================================

// Paleta para pintar el modelo por pisos (BrickGPT no trae colores)
const PALETA_CAPAS = ['rojo', 'amarillo', 'azul', 'verde', 'naranja', 'violeta', 'celeste', 'lima']
  .map(clave => (COLORES.find(c => c.clave === clave) || COLORES[0]).codigo);

// opciones: { color: 'capas' | <código LDraw> }
export function aPiezas(ladrillos, opciones = {}) {
  const zMin = ladrillos.reduce((m, l) => Math.min(m, l.z), 0);
  const xMin = ladrillos.reduce((m, l) => Math.min(m, l.x), 0);
  const yMin = ladrillos.reduce((m, l) => Math.min(m, l.y), 0);
  const porCapas = !opciones.color || opciones.color === 'capas';
  const fijo = porCapas ? null : Number(opciones.color);
  return ladrillos.map((l) => {
    const clave = claveDeMedidas(l.h, l.w);
    const info = piezaPorClave(clave);
    // el lado largo del catálogo va sobre X sin rotar: si acá el largo va
    // sobre Y (h <= w), la pieza va rotada 90°
    const rot = l.h <= l.w ? 90 : 0;
    const piso = l.z - zMin;
    return {
      pieza: clave,
      color: porCapas ? PALETA_CAPAS[piso % PALETA_CAPAS.length] : fijo,
      x: l.x - xMin,
      z: l.y - yMin,
      nivel: piso * (info ? info.alto : 3),
      rot,
    };
  });
}

// ============================================================
// Piezas del generador → texto BrickGPT
// ============================================================

// Solo se pueden escribir los 8 ladrillos, apoyados en pisos enteros. El resto
// se informa para que el docente sepa qué quedó afuera.
export function aTextoBrickGPT(state) {
  const lineas = [];
  const omitidas = new Map();
  const sumar = (motivo) => omitidas.set(motivo, (omitidas.get(motivo) || 0) + 1);
  const todas = state.pasos.flatMap(p => p.piezas);

  const niveles = todas.filter(z => !z.raw).map(z => z.nivel || 0);
  const nivelMin = niveles.length ? Math.min(...niveles) : 0;

  for (const z of todas) {
    if (z.raw) { sumar('piezas importadas sueltas (líneas LDraw)'); continue; }
    const info = piezaPorClave(z.pieza);
    if (!info) { sumar('piezas desconocidas'); continue; }
    const compatible = LADRILLOS.some(l => l.clave === z.pieza);
    if (!compatible) { sumar(`piezas que no son de los 8 ladrillos (${info.nombre})`); continue; }
    if (z.parado || z.volcado) { sumar('piezas paradas o volcadas'); continue; }
    const piso = ((z.nivel || 0) - nivelMin) / (info.alto || 3);
    if (!Number.isInteger(piso)) { sumar('piezas a media altura (no caen en un piso entero)'); continue; }
    if (!Number.isInteger(z.x) || !Number.isInteger(z.z)) { sumar('piezas en medios studs'); continue; }
    const rot = ((z.rot || 0) % 180 + 180) % 180;   // 0 y 180 son la misma huella; 90 y 270 también
    const h = rot === 90 ? info.d : info.w;
    const w = rot === 90 ? info.w : info.d;
    lineas.push({ h, w, x: z.x, y: z.z, z: piso });
  }

  // BrickGPT ordena de abajo hacia arriba y arranca en el origen
  lineas.sort((a, b) => a.z - b.z || a.x - b.x || a.y - b.y);
  const xMin = lineas.reduce((m, l) => Math.min(m, l.x), 0);
  const yMin = lineas.reduce((m, l) => Math.min(m, l.y), 0);
  const normalizadas = lineas.map(l => ({ ...l, x: l.x - xMin, y: l.y - yMin }));

  return {
    texto: normalizadas.map(serializarLadrillo).join('\n') + (normalizadas.length ? '\n' : ''),
    ladrillos: normalizadas,
    incluidas: normalizadas.length,
    omitidas: [...omitidas.entries()].map(([motivo, n]) => `${n} ${motivo}`),
  };
}

// ============================================================
// El prompt: la instrucción de BrickGPT, en criollo
// ============================================================

export function promptBrickGPT(datos = {}) {
  const { que = '', maxLadrillos = 0, extra = '' } = datos;
  const L = [];
  L.push('Armá un modelo LEGO de lo que te pido, en el formato de BrickGPT.');
  L.push('');
  L.push('REGLAS DEL FORMATO (respetalas al pie de la letra):');
  L.push('· Respondé SOLO con la lista de ladrillos, una línea por ladrillo. Nada de texto alrededor.');
  L.push('· Cada línea es: <alto>x<ancho> (x,y,z)   — por ejemplo:  2x4 (3,1,0)');
  L.push(`· Medidas permitidas (no existe ninguna otra): ${DIMENSIONES_TEXTO}.`);
  L.push('· TODOS los ladrillos son de 1 unidad de alto. "z" no es una altura en studs: es el piso (0 = el primero, 1 = el de arriba, y así).');
  L.push('· El primer número de la medida ocupa el eje x y el segundo ocupa el eje y. El ladrillo va desde (x,y) hacia x+alto y y+ancho.');
  L.push(`· Todo tiene que entrar en una caja de ${MUNDO}×${MUNDO}×${MUNDO}. El primer ladrillo va en z=0.`);
  L.push('');
  L.push('REGLAS FÍSICAS (el modelo tiene que poder armarse de verdad):');
  L.push('· Dos ladrillos NUNCA pueden ocupar el mismo lugar.');
  L.push('· Ningún ladrillo puede quedar flotando: cada uno tiene que apoyar sobre otro del piso de abajo (o sostener a uno del piso de arriba).');
  L.push('· Todo el modelo tiene que quedar de una pieza: desde cualquier ladrillo se tiene que poder bajar hasta el suelo pisando ladrillos que se superponen.');
  L.push('· Para que no se abra, las juntas verticales se traban: los ladrillos de un piso se montan a caballo de los de abajo, como en una pared de ladrillos.');
  L.push('');
  L.push('QUÉ HAY QUE ARMAR:');
  L.push(que || '(escribí acá qué querés construir)');
  if (maxLadrillos) L.push(`Usá como mucho ${maxLadrillos} ladrillos.`);
  if (extra) L.push(extra);
  L.push('');
  L.push('Acordate: la respuesta son SOLO las líneas de ladrillos, ordenadas de abajo hacia arriba.');
  return L.join('\n');
}
