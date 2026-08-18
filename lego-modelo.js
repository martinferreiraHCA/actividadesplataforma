// Formato de texto plano de las guías de ensamble LEGO: parser y serializador.
//
// El documento es una lista de pasos; cada paso tiene piezas que se agregan
// al modelo. Ejemplo:
//
//   titulo: Mi primer carrito
//   nivel: 3° año
//   descripcion: Vamos a armar un carrito con ruedas.
//
//   === PASO: La base ===
//   consigna: Buscá las piezas y armá la base del carrito.
//   piezas:
//   placa 2x4 gris claro en 0 0
//   ladrillo 2x2 rojo en 0 0 nivel 1
//   ladrillo 2x2 rojo en 2 0 nivel 1 rotar 90
//   notas: Las placas son más finitas que los ladrillos.
//
// Cada línea de pieza: <pieza> <color> en <x> <z> [nivel <n>] [rotar <0|90|180|270>]
//  - x, z: columna y fila en studs (pueden ser negativos). La pieza ocupa desde
//    esa esquina hacia la derecha (+x) y hacia abajo (+z), mirando desde arriba.
//  - nivel: altura de la BASE de la pieza, en placas (3 placas = 1 ladrillo). 0 = suelo.
//  - rotar: gira la pieza. Sin rotar, el lado largo va horizontal (eje x).
// También se aceptan líneas LDraw crudas (empiezan con "1 ") dentro de "piezas:".

import { buscarPieza, buscarColor, piezaPorClave, colorPorCodigoLdraw, normalizarTexto, conectoresDe } from './lego-catalogo.js';

export function nuevoPaso() {
  return { titulo: '', consigna: '', notas: '', piezas: [] };
}

export function nuevaPieza() {
  return { pieza: 'ladrillo 2x4', color: 4, x: 0, z: 0, nivel: 0, rot: 0 };
}

const RE_PASO = /^===\s*(?:PASO|FICHA)(?:\s*\d+)?\s*:?\s*(.*?)\s*===\s*$/i;
const CLAVES = ['consigna', 'notas', 'piezas', 'titulo', 'nivel', 'descripcion'];

// Analiza una línea de pieza. Devuelve {pieza} o {error}.
export function parsearLineaPieza(linea) {
  const cruda = linea.trim();
  if (/^1\s+/.test(cruda)) {
    // línea LDraw cruda (avanzado): se pasa tal cual al motor
    const campos = cruda.split(/\s+/);
    if (campos.length < 15) return { error: 'línea LDraw incompleta (necesita 15 campos)' };
    return { pieza: { raw: cruda } };
  }
  const limpia = cruda.replace(/[(),;]/g, ' ').replace(/\s+/g, ' ');
  // coordenadas y nivel aceptan decimales con punto (ej: 2.5) para ajustes
  // finos: engranar engranajes o centrar un eje en una rueda
  const m = limpia.match(/^(.*?)\s+en\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)(.*)$/i);
  if (!m) return { error: 'no se entiende — el formato es: <pieza> <color> en <x> <z> [nivel <n>] [rotar <90>]' };
  const [, nombreYColor, xs, zs, resto] = m;

  // el color son las últimas 1 o 2 palabras; el resto es el nombre de la pieza
  const palabras = nombreYColor.trim().split(/\s+/);
  let color = null, pieza = null;
  for (const nPalabras of [2, 1]) {
    if (palabras.length <= nPalabras) continue;
    const c = buscarColor(palabras.slice(-nPalabras).join(' '));
    if (c) {
      const p = buscarPieza(palabras.slice(0, -nPalabras).join(' '));
      if (p) { color = c; pieza = p; break; }
    }
  }
  if (!pieza) {
    // ¿pieza sin color? probar el nombre completo y avisar
    const p = buscarPieza(nombreYColor);
    if (p) return { error: `a "${p.nombre}" le falta el color (ej: "${p.clave} rojo en ${xs} ${zs}")` };
    // las piezas importadas de un modelo .ldr solo existen mientras la guía las
    // tenga cargadas: si el texto viene de otra sesión, hay que reimportar
    if (/^ldraw\s+\S+$/i.test(nombreYColor.trim())) {
      return { error: `la pieza importada "${nombreYColor.trim()}" no está cargada: volvé a importar el modelo .ldr o abrí el borrador .json donde la guardaste` };
    }
    return { error: `pieza o color desconocido en "${nombreYColor.trim()}"` };
  }

  const r = { pieza: pieza.clave, color: color.codigo, x: parseFloat(xs), z: parseFloat(zs), nivel: 0, rot: 0 };
  const mNivel = resto.match(/\b(?:nivel|altura)\s+(-?\d+(?:\.\d+)?)/i);
  if (mNivel) r.nivel = parseFloat(mNivel[1]);
  const mRot = resto.match(/\b(?:rotar|rot|girar)\s+(\d+)/i);
  if (mRot) {
    const g = ((parseInt(mRot[1], 10) % 360) + 360) % 360;
    if (g % 90 !== 0) return { error: 'solo se puede rotar 0, 90, 180 o 270 grados' };
    r.rot = g;
  }
  // "parado": la pieza se vuelca 90° hacia arriba (viga de pie a lo largo de X
  // con agujeros hacia Z). "volcado": se vuelca 90° de costado (viga acostada
  // a lo largo de Z con agujeros hacia X — como se montan los pines en los
  // robots reales; un eje volcado queda vertical).
  if (/\b(?:volcado|volcada|de costado|de canto)\b/i.test(resto)) r.volcado = true;
  else if (/\b(?:parado|parada|de pie|vertical)\b/i.test(resto)) r.parado = true;
  const sobra = resto
    .replace(/\b(?:nivel|altura)\s+-?\d+(?:\.\d+)?/i, '')
    .replace(/\b(?:rotar|rot|girar)\s+\d+/i, '')
    .replace(/\b(?:volcado|volcada|de costado|de canto)\b/i, '')
    .replace(/\b(?:parado|parada|de pie|vertical)\b/i, '')
    .trim();
  if (sobra) return { error: `no se entiende "${sobra}" (después de las coordenadas van "nivel N" y/o "rotar N")` };
  return { pieza: r };
}

// Parsea el documento completo. Devuelve { doc, avisos } — doc es null si no hay pasos.
export function parsearTexto(texto) {
  const avisos = [];
  const doc = { titulo: '', subtitulo: '', descripcion: '', pasos: [] };
  let paso = null;          // paso en curso
  let clave = null;         // clave multilinea en curso ('consigna' | 'notas' | 'piezas' | 'descripcion')
  const lineas = String(texto || '').split(/\r?\n/);

  lineas.forEach((lineaCruda, idx) => {
    const nLinea = idx + 1;
    const linea = lineaCruda.trim();
    if (!linea) { if (clave !== 'piezas') return; return; }

    const mPaso = linea.match(RE_PASO);
    if (mPaso) {
      paso = nuevoPaso();
      paso.titulo = mPaso[1] || '';
      doc.pasos.push(paso);
      clave = null;
      return;
    }

    const mClave = linea.match(/^([a-záéíóúñ]+)\s*:\s*(.*)$/i);
    const claveNombre = mClave ? normalizarTexto(mClave[1]) : null;
    if (mClave && CLAVES.includes(claveNombre)) {
      const valor = mClave[2].trim();
      if (!paso) {
        if (claveNombre === 'titulo') { doc.titulo = valor; clave = null; return; }
        if (claveNombre === 'nivel') { doc.subtitulo = valor; clave = null; return; }
        if (claveNombre === 'descripcion') { doc.descripcion = valor; clave = 'descripcion'; return; }
        avisos.push(`Línea ${nLinea}: "${claveNombre}:" va adentro de un paso (falta "=== PASO: ... ===" antes).`);
        return;
      }
      if (claveNombre === 'consigna' || claveNombre === 'notas') {
        paso[claveNombre] = valor;
        clave = claveNombre;
        return;
      }
      if (claveNombre === 'piezas') {
        clave = 'piezas';
        if (valor) avisos.push(`Línea ${nLinea}: las piezas van en las líneas siguientes a "piezas:".`);
        return;
      }
      // titulo:/nivel:/descripcion: dentro de un paso: se toma como texto de la clave activa
    }

    if (clave === 'piezas' && paso) {
      const r = parsearLineaPieza(linea);
      if (r.error) avisos.push(`Línea ${nLinea}: ${r.error}`);
      else paso.piezas.push(r.pieza);
      return;
    }
    if (clave === 'descripcion') { doc.descripcion += (doc.descripcion ? '\n' : '') + linea; return; }
    if ((clave === 'consigna' || clave === 'notas') && paso) {
      paso[clave] += (paso[clave] ? '\n' : '') + linea;
      return;
    }
    avisos.push(`Línea ${nLinea}: no se entiende "${linea.slice(0, 60)}" — ¿faltó "piezas:" o "=== PASO: ... ==="?`);
  });

  doc.pasos.forEach((p, i) => {
    if (!p.piezas.length) avisos.push(`El paso ${i + 1} ("${p.titulo || 'sin título'}") no tiene piezas.`);
  });

  return { doc: doc.pasos.length ? doc : null, avisos };
}

// Documento → texto plano (para "Copiar como texto" y para el prompt de refuerzo)
export function serializarDoc(state) {
  const L = [];
  if (state.titulo) L.push('titulo: ' + state.titulo);
  if (state.subtitulo) L.push('nivel: ' + state.subtitulo);
  if (state.descripcion) L.push('descripcion: ' + state.descripcion);
  if (L.length) L.push('');
  state.pasos.forEach((p) => {
    L.push(`=== PASO: ${p.titulo || ''} ===`);
    if (p.consigna) L.push('consigna: ' + p.consigna);
    if (p.piezas.length) {
      L.push('piezas:');
      p.piezas.forEach(z => L.push(serializarPieza(z)));
    }
    if (p.notas) L.push('notas: ' + p.notas);
    L.push('');
  });
  return L.join('\n').trim() + '\n';
}

export function serializarPieza(z) {
  if (z.raw) return z.raw;
  const color = colorPorCodigoLdraw(z.color);
  let s = `${z.pieza} ${color ? color.clave : z.color} en ${z.x} ${z.z}`;
  if (z.nivel) s += ` nivel ${z.nivel}`;
  if (z.rot) s += ` rotar ${z.rot}`;
  if (z.volcado) s += ' volcado';
  else if (z.parado) s += ' parado';
  return s;
}

// Lista de compras de un paso: agrupa por pieza+color → [{pieza, color, cantidad}]
// Las líneas LDraw crudas que vinieron de un modelo importado (traen "dat", el
// número de la pieza) también se cuentan, marcadas con cruda:true: no están en
// el catálogo pero igual se dibujan y hay que buscarlas en la caja.
export function piezasAgrupadas(piezas) {
  const mapa = new Map();
  for (const z of piezas) {
    if (z.raw) {
      const d = datosLineaCruda(z);
      if (!d) continue;
      const k = 'raw|' + d.dat + '|' + d.color;
      if (!mapa.has(k)) mapa.set(k, { pieza: d.dat, dat: d.dat, color: d.color, cantidad: 0, cruda: true });
      mapa.get(k).cantidad++;
      continue;
    }
    const k = z.pieza + '|' + z.color;
    if (!mapa.has(k)) mapa.set(k, { pieza: z.pieza, color: z.color, cantidad: 0 });
    mapa.get(k).cantidad++;
  }
  return [...mapa.values()].sort((a, b) => b.cantidad - a.cantidad || a.pieza.localeCompare(b.pieza));
}

// Número de pieza y color de una línea LDraw cruda ("1 4 0 0 0 ... parts/3001.dat").
export function datosLineaCruda(z) {
  if (!z || !z.raw) return null;
  if (z.dat) return { dat: String(z.dat).toLowerCase(), color: Number(z.color) };
  const t = String(z.raw).trim().split(/\s+/);
  if (t.length < 15) return null;
  const ref = t.slice(14).join(' ').toLowerCase().replace(/\\/g, '/');
  const dat = ref.slice(ref.lastIndexOf('/') + 1).replace(/\.dat$/, '');
  if (!dat || !isFinite(Number(t[1]))) return null;
  return { dat, color: Number(t[1]) };
}

export function infoPieza(clave) { return piezaPorClave(clave); }

// ============================================================
// Validador de conexiones: detecta piezas flotando, apiladas sin
// conexión real (viga sobre ladrillos, algo sobre una lisa...) y
// engranajes/bujes/llantas sin eje. Usa la base de datos de
// conectores del catálogo y una geometría aproximada (huella en
// studs + alturas en placas), con tolerancias generosas para no
// molestar con falsos positivos.
// ============================================================

function geometriaAproximada(z) {
  const info = piezaPorClave(z.pieza);
  if (!info) return null;
  let w = info.w, d = info.d, alto = info.alto || 1;
  const esBarra = conectoresDe(info).has('ej') || conectoresDe(info).has('pi');
  if (z.volcado) {
    if (esBarra) { alto = w * 2.5; w = d; }        // eje/pin volcado: vertical
    else { [w, d] = [d, w]; }                      // viga volcada: el largo pasa a Z
  } else if (z.parado) {
    alto = d * 2.5;
    d = Math.max(1, (info.alto || 1) * 0.4);
  }
  if (z.rot === 90 || z.rot === 270) [w, d] = [d, w];
  const nivel = z.nivel || 0;
  return {
    info, w, d,
    x0: z.x, x1: z.x + w, z0: z.z, z1: z.z + d,
    bottom: nivel, top: nivel + alto,
    cx: z.x + w / 2, cz: z.z + d / 2, cy: nivel + alto / 2,
  };
}

function solapeXZ(a, b, margen = 0) {
  const sx = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + margen;
  const sz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) + margen;
  return sx > 0 && sz > 0;
}

function seTocan3D(a, b) {
  // cajas con tolerancia: 0.6 studs en planta, 1 placa en altura
  return solapeXZ(a, b, 0.6) && (Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom) + 1) > 0;
}

// ¿la barra q (eje o pin) pasa cerca del centro de la pieza a?
function barraPasaPorCentro(a, q) {
  return Math.abs(a.cy - q.cy) <= 1.6 && solapeXZ(a, q, 1.2);
}

export function validarConexiones(pasos) {
  const avisos = [];
  const todas = [];
  pasos.forEach((p, i) => p.piezas.forEach(z => {
    if (z.raw) return;
    const g = geometriaAproximada(z);
    if (g) todas.push({ g, z, paso: i, con: conectoresDe(g.info) });
  }));

  for (const a of todas) {
    if (avisos.length >= 12) { avisos.push('… (hay más avisos de conexión: corregí estos primero)'); break; }
    const otras = todas.filter(b => b !== a && b.paso <= a.paso);
    const nombre = `"${a.g.info.nombre}" (paso ${a.paso + 1})`;
    const esBarra = a.con.has('ej') || a.con.has('pi');
    const soloCruz = a.con.has('ac') && !a.con.has('st') && !a.con.has('ap') && !a.con.has('pi');
    const esNeumatico = a.con.has('nl');

    // 1) neumático: necesita su llanta concéntrica
    if (esNeumatico) {
      const llanta = otras.find(b => b.con.has('ac') || b.con.has('ap'));
      if (!llanta || !todas.some(b => b !== a && b.paso <= a.paso && seTocan3D(a.g, b.g))) {
        avisos.push(`🔩 ${nombre}: un neumático va montado sobre su llanta (receta de rueda calibrada).`);
      }
      continue;
    }

    // 2) engranajes / bujes / llantas / poleas: solo existen montados en un eje o pin-eje
    if (soloCruz) {
      const eje = otras.find(b => (b.con.has('ej') || b.con.has('pi')) && barraPasaPorCentro(a.g, b.g));
      if (!eje) avisos.push(`🔩 ${nombre}: no está montada en ningún eje/pin — agregá el eje con la regla de montaje (o ajustá su posición para que el eje pase por su centro).`);
      continue;
    }

    // 3) barras (ejes/pines): tienen que atravesar algún agujero compatible
    if (esBarra && a.g.info.suelta) {
      const destino = otras.find(b => {
        const compatible = (a.con.has('pi') && b.con.has('ap')) || (a.con.has('ej') && (b.con.has('ac') || b.con.has('ap')));
        return compatible && seTocan3D(a.g, b.g);
      });
      if (!destino && otras.length) avisos.push(`🔩 ${nombre}: no atraviesa ningún agujero compatible (pin → agujero de pin de una viga volcada; eje → agujero en cruz).`);
      continue;
    }

    // 4) apoyo: ¿flota? ¿o está apoyada sin conexión real?
    const enElPiso = a.g.bottom <= 0.8;
    const debajo = otras.filter(b => solapeXZ(a.g, b.g) && Math.abs(a.g.bottom - b.g.top) <= 0.8);
    const tocaAlgo = otras.some(b => seTocan3D(a.g, b.g));

    if (!enElPiso && !debajo.length && !tocaAlgo) {
      avisos.push(`🔩 ${nombre}: parece estar flotando — no toca el piso ni ninguna otra pieza.`);
      continue;
    }
    // pieza con agujeros de pin que tiene un pin tocándola: se considera sujetada
    const sujetadaConPin = a.con.has('ap') && otras.some(b => b.con.has('pi') && seTocan3D(a.g, b.g));
    if (debajo.length && !sujetadaConPin) {
      const conStuds = debajo.some(b => b.con.has('st'));
      if (a.con.has('tu') && !conStuds) {
        avisos.push(`🔩 ${nombre}: está apoyada sobre piezas SIN studs (lisa, viga...) — ahí no queda agarrada.`);
      } else if (!a.con.has('tu') && !esBarra) {
        avisos.push(`🔩 ${nombre}: está apilada sin conexión — las vigas y la electrónica se sujetan con pines (viga volcado + pin), no apoyadas.`);
      }
    }
  }
  return avisos;
}
