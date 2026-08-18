// Importador de modelos LDraw (.ldr / .mpd / .dat) para las guías de ensamble.
//
// Toma un archivo de modelo hecho en LeoCAD, BrickLink Studio, LDCad, LPub3D,
// MLCad… y lo convierte en la guía paso a paso del generador:
//
//   1. separa el .mpd en sus submodelos y aplana todo a una sola lista de
//      piezas colocadas (componiendo las matrices de cada submodelo);
//   2. reconoce cada pieza contra el catálogo del generador — así queda
//      editable, con miniatura, inventario y comparador 1:1 — y las que no
//      están en el catálogo quedan como línea LDraw cruda (se dibujan igual);
//   3. arma los pasos: los del propio archivo ("0 STEP") o, si no trae, los
//      genera solo, de abajo hacia arriba y capa por capa.
//
// La biblioteca local de piezas (lego/ldraw/) es un subconjunto chico: si el
// modelo usa piezas que no están, se avisa cuáles y se puede cargar la
// biblioteca oficial completa de LDraw (complete.zip) para esta sesión.

import { COLORES, colorPorCodigoLdraw, piezaPorDat } from './lego-catalogo.js';
import { motorLego } from './lego-render.js';

const RUTA_LDRAW = 'lego/ldraw/';

// ============================================================
// Lectura del archivo (texto plano o zip con un modelo adentro)
// ============================================================

export const EXTENSIONES = '.ldr,.mpd,.dat,.txt,.io,.zip';

let _jszip = null;
function cargarJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (!_jszip) {
    _jszip = new Promise((resolver, rechazar) => {
      const s = document.createElement('script');
      s.src = 'jszip.min.js';
      s.onload = () => (window.JSZip ? resolver(window.JSZip) : rechazar(new Error('jszip no se cargó')));
      s.onerror = () => rechazar(new Error('No se pudo cargar jszip.min.js'));
      document.head.appendChild(s);
    });
  }
  return _jszip;
}

async function esZip(archivo) {
  const cabecera = new Uint8Array(await archivo.slice(0, 4).arrayBuffer());
  return cabecera[0] === 0x50 && cabecera[1] === 0x4b; // "PK"
}

// Devuelve el texto LDraw del archivo elegido. Si es un zip (o un .io de
// BrickLink Studio, que es un zip), busca adentro un .ldr/.mpd legible.
export async function leerArchivoModelo(archivo) {
  if (!(await esZip(archivo))) return await archivo.text();

  let zip;
  try {
    const JSZip = await cargarJSZip();
    zip = await JSZip.loadAsync(archivo);
  } catch (e) {
    throw new Error('El archivo parece comprimido pero no se pudo abrir. Exportalo como .ldr desde tu programa (en Studio: Archivo → Exportar → Exportar como LDraw).');
  }
  const candidatos = [];
  zip.forEach((ruta, entrada) => {
    if (entrada.dir) return;
    if (/\.(ldr|mpd|dat)$/i.test(ruta) || /(^|\/)model$/i.test(ruta)) candidatos.push({ ruta, entrada });
  });
  candidatos.sort((a, b) => (/\.mpd$/i.test(b.ruta) ? 1 : 0) - (/\.mpd$/i.test(a.ruta) ? 1 : 0));
  for (const c of candidatos) {
    try {
      const texto = await c.entrada.async('string');
      if (/^\s*[01]\s/m.test(texto)) return texto;
    } catch (e) { /* entrada cifrada o ilegible: probamos la siguiente */ }
  }
  throw new Error('No se encontró un modelo LDraw legible adentro del archivo. Si es un .io de Studio, exportalo como .ldr (Archivo → Exportar → Exportar como LDraw).');
}

// ============================================================
// Biblioteca de piezas extra: el complete.zip oficial de LDraw
// ============================================================

// Indexa el zip SIN descomprimirlo entero: solo se extrae el .dat que el motor
// pide, y cuando lo pide. Queda activo mientras la página siga abierta.
export async function usarBibliotecaZip(archivo) {
  const JSZip = await cargarJSZip();
  const zip = await JSZip.loadAsync(archivo);
  const porRuta = new Map();
  const porNombre = new Map();
  zip.forEach((ruta, entrada) => {
    if (entrada.dir || !/\.dat$/i.test(ruta)) return;
    // "ldraw/parts/3001.dat" → "parts/3001.dat"; lo que ya viene relativo queda igual
    const limpia = ruta.toLowerCase().replace(/\\/g, '/').replace(/^.*?(?=(?:parts|p)\/)/, '');
    porRuta.set(limpia, entrada);
    const base = limpia.slice(limpia.lastIndexOf('/') + 1);
    if (!porNombre.has(base) || limpia.startsWith('parts/')) porNombre.set(base, entrada);
  });
  if (!porRuta.size) throw new Error('El zip no tiene archivos .dat de piezas LDraw.');

  const resolver = async (nombre) => {
    const n = String(nombre || '').toLowerCase().replace(/\\/g, '/').replace(/^\.\//, '');
    const base = n.slice(n.lastIndexOf('/') + 1);
    const entrada = porRuta.get(n) || porRuta.get('parts/' + n) || porRuta.get('p/' + n) || porNombre.get(base);
    if (!entrada) return null;
    try { return await entrada.async('string'); } catch (e) { return null; }
  };

  const m = await motorLego();
  m.usarBibliotecaExtra(resolver);
  return { piezas: porRuta.size };
}

export async function quitarBibliotecaZip() {
  const m = await motorLego();
  m.usarBibliotecaExtra(null);
}

// ============================================================
// Colores: mapa código → hex del LDConfig.ldr, para poder llevar cualquier
// color del archivo al color más parecido de la paleta del generador.
// ============================================================

let _coloresLdraw = null;
async function coloresLdraw() {
  if (_coloresLdraw) return _coloresLdraw;
  const mapa = new Map();
  try {
    const r = await fetch(RUTA_LDRAW + 'LDConfig.ldr');
    const texto = await r.text();
    texto.split(/\r?\n/).forEach((l) => {
      const m = l.match(/^0\s+!COLOUR\s+\S+.*?\bCODE\s+(\d+)\s+VALUE\s+#([0-9A-Fa-f]{6})/);
      if (m) mapa.set(Number(m[1]), m[2]);
    });
  } catch (e) { /* sin LDConfig: se usan solo los colores del catálogo */ }
  _coloresLdraw = mapa;
  return mapa;
}

function rgb(hex) {
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

// Color del catálogo más parecido a un código LDraw cualquiera.
async function colorDelCatalogo(codigo) {
  if (colorPorCodigoLdraw(codigo)) return { codigo: Number(codigo), cambiado: false };
  const mapa = await coloresLdraw();
  let hex = mapa.get(Number(codigo));
  // colores directos 0x2RRGGBB (los usa Studio para tintes propios)
  if (!hex && codigo >= 0x2000000) hex = (codigo & 0xFFFFFF).toString(16).padStart(6, '0');
  if (!hex) return { codigo: 15, cambiado: true, nombre: 'código ' + codigo };
  const [r, g, b] = rgb(hex);
  let mejor = COLORES[0], mejorD = Infinity;
  for (const c of COLORES) {
    const [r2, g2, b2] = rgb(c.hex.replace('#', ''));
    // distancia con pesos perceptuales (el ojo pesa más el verde)
    const d = 2 * (r - r2) ** 2 + 4 * (g - g2) ** 2 + 3 * (b - b2) ** 2;
    if (d < mejorD) { mejorD = d; mejor = c; }
  }
  const nombreLdraw = mapa.has(Number(codigo)) ? 'color LDraw ' + codigo : 'color directo #' + hex;
  return { codigo: mejor.codigo, cambiado: true, nombre: nombreLdraw, reemplazo: mejor.nombre };
}

// ============================================================
// Parseo del archivo: submodelos (.mpd) y aplanado con matrices
// ============================================================

function normalizarNombre(s) {
  return String(s || '').trim().toLowerCase().replace(/\\/g, '/');
}

// Separa un .mpd en sus archivos internos. Un .ldr suelto devuelve un único
// archivo llamado "modelo".
export function separarMPD(texto) {
  const archivos = new Map();
  const lineas = String(texto || '').split(/\r?\n/);
  let actual = null;
  let orden = [];
  for (const linea of lineas) {
    const mFile = linea.match(/^\s*0\s+FILE\s+(.+?)\s*$/i);
    if (mFile) {
      actual = normalizarNombre(mFile[1]);
      if (!archivos.has(actual)) { archivos.set(actual, []); orden.push(actual); }
      continue;
    }
    if (/^\s*0\s+NOFILE\s*$/i.test(linea)) { actual = null; continue; }
    if (actual === null) {
      if (!archivos.has('modelo')) { archivos.set('modelo', []); orden.push('modelo'); }
      archivos.get('modelo').push(linea);
    } else {
      archivos.get(actual).push(linea);
    }
  }
  if (!orden.length) return { archivos: new Map([['modelo', lineas]]), principal: 'modelo', orden: ['modelo'] };
  // el principal es el primer archivo que tenga contenido propio
  const principal = orden.find(n => archivos.get(n).some(l => /^\s*1\s+/.test(l))) || orden[0];
  return { archivos, principal, orden };
}

function multiplicar(a, b) {
  const r = new Array(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    }
  }
  return r;
}

function aplicar(m, v) {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

const IDENTIDAD = [1, 0, 0, 0, 1, 0, 0, 0, 1];

// Aplana el modelo entero: recorre los submodelos componiendo matrices y
// devuelve la lista de piezas colocadas, ya con su paso de origen.
export function aplanar({ archivos, principal }) {
  const colocaciones = [];
  let submodelos = 0;
  let ignoradas = 0;
  let pasoActual = 0;
  let enPasoActual = 0;
  const abiertos = new Set();

  // Un "0 STEP" cierra el paso en curso; los pasos que quedaron vacíos (sin
  // ninguna pieza) no cuentan.
  const cerrarPaso = () => {
    if (!enPasoActual) return;
    pasoActual++;
    enPasoActual = 0;
  };

  const recorrer = (nombre, mat, pos, color, profundidad) => {
    const lineas = archivos.get(nombre);
    if (!lineas || profundidad > 24 || abiertos.has(nombre)) return;
    abiertos.add(nombre);
    for (const cruda of lineas) {
      const linea = cruda.trim();
      if (!linea) continue;
      if (/^0\s+(?:STEP|ROTSTEP)\b/i.test(linea)) { cerrarPaso(); continue; }
      if (linea[0] !== '1') continue;
      const t = linea.split(/\s+/);
      if (t.length < 15) { ignoradas++; continue; }
      const codigo = t[1] === '16' || t[1] === '24' ? color : Number(t[1]);
      const p = [parseFloat(t[2]), parseFloat(t[3]), parseFloat(t[4])];
      const m = t.slice(5, 14).map(Number);
      if (m.some(v => !isFinite(v)) || p.some(v => !isFinite(v))) { ignoradas++; continue; }
      const matGlobal = multiplicar(mat, m);
      const posGlobal = aplicar(mat, p).map((v, i) => v + pos[i]);
      const referencia = normalizarNombre(t.slice(14).join(' '));
      if (archivos.has(referencia)) {
        submodelos++;
        recorrer(referencia, matGlobal, posGlobal, codigo, profundidad + 1);
        continue;
      }
      const dat = referencia.slice(referencia.lastIndexOf('/') + 1).replace(/\.dat$/i, '');
      if (!dat) { ignoradas++; continue; }
      colocaciones.push({ dat, color: codigo, pos: posGlobal, mat: matGlobal, paso: pasoActual, orden: colocaciones.length });
      enPasoActual++;
    }
    abiertos.delete(nombre);
    cerrarPaso();
  };

  recorrer(principal, IDENTIDAD, [0, 0, 0], 16, 0);

  const usados = new Set(colocaciones.map(c => c.paso));
  return { colocaciones, pasosArchivo: usados.size, submodelos, ignoradas };
}

// ============================================================
// Análisis previo: qué trae el archivo y qué piezas faltan
// ============================================================

export async function analizarModelo(texto) {
  const partes = separarMPD(texto);
  const plano = aplanar(partes);
  const tipos = new Map();
  for (const c of plano.colocaciones) tipos.set(c.dat, (tipos.get(c.dat) || 0) + 1);

  // ¿de cuáles hay archivo? Las del catálogo vienen con la página; el resto se
  // consulta (todas a la vez, que si no un modelo grande tarda una eternidad).
  const m = await motorLego();
  const desconocidas = [...tipos.keys()].filter(dat => !piezaPorDat(dat));
  const hay = await Promise.all(desconocidas.map(dat =>
    m.existeParte(dat).catch(() => false)));
  const faltantes = desconocidas.filter((dat, i) => !hay[i]);
  faltantes.sort((a, b) => (tipos.get(b) - tipos.get(a)) || a.localeCompare(b));

  return {
    ...partes,
    ...plano,
    tipos,
    faltantes,
    total: plano.colocaciones.length,
    piezasFaltantes: faltantes.reduce((n, d) => n + tipos.get(d), 0),
  };
}

// ============================================================
// Construcción de la guía paso a paso
// ============================================================

const MAX_PASOS = 60;

// Reparte las piezas en pasos: capa por capa de abajo hacia arriba, juntando
// capas chicas hasta llegar a "piezasPorPaso" y partiendo las capas grandes.
function agruparPorCapas(items, piezasPorPaso) {
  const orden = items.slice().sort((a, b) => (a.nivel - b.nivel) || (a.orden - b.orden));
  const capas = [];
  for (const it of orden) {
    const ultima = capas[capas.length - 1];
    if (ultima && Math.abs(ultima.nivel - it.nivel) < 0.51) ultima.items.push(it);
    else capas.push({ nivel: it.nivel, items: [it] });
  }
  const grupos = [];
  let actual = null;
  capas.forEach((capa, iCapa) => {
    if (capa.items.length > piezasPorPaso) {
      // capa grande: se parte en varios pasos
      actual = null;
      const partes = Math.ceil(capa.items.length / piezasPorPaso);
      for (let i = 0; i < capa.items.length; i += piezasPorPaso) {
        grupos.push({ items: capa.items.slice(i, i + piezasPorPaso), capa: iCapa + 1, parte: i / piezasPorPaso + 1, partes });
      }
      return;
    }
    if (actual && actual.items.length + capa.items.length <= piezasPorPaso) {
      // capa chica: se junta con la anterior para no hacer pasos de una pieza
      actual.items.push(...capa.items);
      actual.hasta = iCapa + 1;
      return;
    }
    actual = { items: capa.items.slice(), capa: iCapa + 1, hasta: iCapa + 1, parte: 0, partes: 1 };
    grupos.push(actual);
  });
  return grupos;
}

function tituloGrupo(g, i) {
  if (i === 0) return 'La base';
  if (g.parte) return `Capa ${g.capa} · parte ${g.parte} de ${g.partes}`;
  if (g.hasta && g.hasta > g.capa) return `Capas ${g.capa} a ${g.hasta}`;
  return `Capa ${g.capa}`;
}

function textoConsigna(n, primero) {
  if (primero) return n === 1 ? 'Buscá esta pieza: es la base del modelo.' : `Buscá estas ${n} piezas y armá la base del modelo.`;
  if (n === 1) return 'Agregá esta pieza al modelo. Mirá bien la imagen para ver dónde va.';
  return `Agregá estas ${n} piezas al modelo. Mirá bien la imagen para ver dónde va cada una.`;
}

// Convierte el análisis en el documento de la guía.
// opciones: { usarPasosArchivo, piezasPorPaso, titulo, onProgreso }
export async function construirGuia(analisis, opciones = {}) {
  const avisos = [];
  const piezasPorPaso = Math.max(1, Math.min(40, parseInt(opciones.piezasPorPaso, 10) || 6));
  const usarPasosArchivo = !!opciones.usarPasosArchivo && analisis.pasosArchivo > 1;
  const progreso = typeof opciones.onProgreso === 'function' ? opciones.onProgreso : () => {};
  const m = await motorLego();

  // 1) fuera las piezas cuyo archivo .dat no está disponible
  const faltantes = new Set(analisis.faltantes);
  const utiles = analisis.colocaciones.filter(c => !faltantes.has(c.dat));
  if (!utiles.length) {
    return { doc: null, avisos: ['Ninguna de las piezas del modelo está en la biblioteca local. Cargá la biblioteca completa de LDraw (complete.zip) y volvé a importar.'] };
  }
  if (faltantes.size) {
    const lista = analisis.faltantes.slice(0, 12).map(d => d + (analisis.tipos.get(d) > 1 ? ` (×${analisis.tipos.get(d)})` : '')).join(', ');
    avisos.push(`⚠ ${analisis.piezasFaltantes} pieza(s) de ${faltantes.size} tipo(s) quedaron afuera porque su archivo no está en la biblioteca local: ${lista}${faltantes.size > 12 ? '…' : ''}. Cargá el complete.zip de LDraw para incluirlas.`);
  }

  // 2) medir cada tipo de pieza (hace falta para ubicarlas y para saber su altura)
  const tipos = [...new Set(utiles.map(c => c.dat))];
  const rotas = new Set();
  for (let i = 0; i < tipos.length; i++) {
    progreso(`Midiendo piezas… ${i + 1}/${tipos.length}`);
    try { await m.medir(tipos[i]); } catch (e) { rotas.add(tipos[i]); }
  }
  const medibles = utiles.filter(c => !rotas.has(c.dat));
  if (rotas.size) {
    avisos.push(`⚠ ${rotas.size} tipo(s) de pieza no se pudieron dibujar (les faltan archivos internos): ${[...rotas].slice(0, 8).join(', ')}.`);
  }
  if (!medibles.length) return { doc: null, avisos: avisos.concat('No quedó ninguna pieza dibujable.') };

  // 3) caja del modelo entero → se apoya en el suelo y arranca en el origen
  progreso('Ubicando el modelo en la cuadrícula…');
  const cajas = new Map();
  let minX = Infinity, minZ = Infinity, maxY = -Infinity;
  for (const c of medibles) {
    const caja = await m.cajaColocada(c.dat, c.pos, c.mat);
    cajas.set(c, caja);
    minX = Math.min(minX, caja.minX);
    minZ = Math.min(minZ, caja.minZ);
    maxY = Math.max(maxY, caja.maxY); // en LDraw +Y es hacia abajo: el máximo es el piso
  }
  const desplazar = [-minX, -maxY, -minZ];

  // 4) cada colocación → pieza editable del catálogo (o línea LDraw cruda)
  progreso('Reconociendo las piezas del catálogo…');
  const cambiosColor = new Map();
  const items = [];
  let fueraCatalogo = 0;    // piezas que el generador no tiene en su catálogo
  let orientacionRara = 0;  // piezas del catálogo puestas en un ángulo que el formato no sabe escribir
  for (const c of medibles) {
    const pos = c.pos.map((v, i) => v + desplazar[i]);
    const caja = cajas.get(c);
    const nivel = -(caja.maxY + desplazar[1]) / 8;   // altura de la base, en placas
    let pieza = null;
    const enCatalogo = !!piezaPorDat(c.dat);
    if (enCatalogo) {
      const col = await colorDelCatalogo(c.color);
      if (col.cambiado && col.reemplazo) cambiosColor.set(col.nombre, col.reemplazo);
      try { pieza = await m.reconocerColocacion(c.dat, col.codigo, pos, c.mat); } catch (e) { pieza = null; }
      if (!pieza) orientacionRara++;
    } else {
      fueraCatalogo++;
    }
    if (!pieza) {
      const num = (v) => Math.round(v * 1000) / 1000;
      pieza = {
        raw: `1 ${c.color} ${pos.map(num).join(' ')} ${c.mat.map(num).join(' ')} parts/${c.dat}.dat`,
        dat: c.dat,
        color: c.color,
      };
    }
    items.push({ pieza, nivel: Math.round(nivel * 10) / 10, orden: c.orden, paso: c.paso });
  }

  if (cambiosColor.size) {
    const lista = [...cambiosColor.entries()].slice(0, 8).map(([de, a]) => `${de} → ${a}`).join(', ');
    avisos.push(`🎨 Colores fuera de la paleta del generador, reemplazados por el más parecido: ${lista}${cambiosColor.size > 8 ? '…' : ''}.`);
  }
  if (fueraCatalogo) {
    avisos.push(`ℹ ${fueraCatalogo} pieza(s) no están en el catálogo del generador: se dibujan igual y salen en la lista «Buscá estas piezas», pero se editan como línea LDraw.`);
  }
  if (orientacionRara) {
    avisos.push(`ℹ ${orientacionRara} pieza(s) están giradas en un ángulo que el editor no sabe describir (no es un giro de 90°): quedan bien puestas, como línea LDraw.`);
  }

  // 5) armar los pasos
  const pasos = [];
  if (usarPasosArchivo) {
    const porPaso = new Map();
    for (const it of items) {
      if (!porPaso.has(it.paso)) porPaso.set(it.paso, []);
      porPaso.get(it.paso).push(it);
    }
    [...porPaso.keys()].sort((a, b) => a - b).forEach((k) => {
      const grupo = porPaso.get(k).sort((a, b) => a.orden - b.orden);
      pasos.push({
        titulo: '',
        consigna: textoConsigna(grupo.length, pasos.length === 0),
        notas: '',
        piezas: grupo.map(g => g.pieza),
      });
    });
    avisos.push(`📄 Se usaron los ${pasos.length} paso(s) que ya traía el archivo.`);
  } else {
    const grupos = agruparPorCapas(items, piezasPorPaso);
    grupos.forEach((g, i) => {
      pasos.push({
        titulo: tituloGrupo(g, i),
        consigna: textoConsigna(g.items.length, i === 0),
        notas: '',
        piezas: g.items.sort((a, b) => a.orden - b.orden).map(x => x.pieza),
      });
    });
    avisos.push(`🧱 Se generaron ${pasos.length} paso(s) automáticamente, de abajo hacia arriba (hasta ${piezasPorPaso} pieza(s) por paso).`);
  }

  if (pasos.length > MAX_PASOS) {
    avisos.push(`⏳ Son ${pasos.length} pasos: generar la vista previa y el PDF va a tardar. Si querés menos pasos, subí las "piezas por paso" y volvé a importar.`);
  }
  if (analisis.submodelos) {
    avisos.push(`🧩 El archivo tenía ${analisis.submodelos} submodelo(s): se integraron al modelo principal en su posición.`);
  }
  if (analisis.ignoradas) {
    avisos.push(`${analisis.ignoradas} línea(s) del archivo no se entendieron y se saltearon.`);
  }

  const doc = {
    titulo: opciones.titulo || '',
    subtitulo: '',
    descripcion: '',
    pasos,
  };
  return { doc, avisos, total: items.length };
}

// Nombre lindo para una pieza importada que no está en el catálogo.
export function nombrePiezaCruda(z) {
  if (!z || !z.raw) return '';
  const info = z.dat ? piezaPorDat(z.dat) : null;
  if (info) return info.nombre;
  return z.dat ? 'Pieza LDraw ' + z.dat : 'Pieza LDraw';
}

// Los datos de una línea cruda importada (para miniaturas e inventario).
export function datosPiezaCruda(z) {
  if (!z || !z.raw) return null;
  if (z.dat) return { dat: z.dat, color: Number(z.color) };
  const t = String(z.raw).trim().split(/\s+/);
  if (t.length < 15) return null;
  const ref = t.slice(14).join(' ').toLowerCase().replace(/\\/g, '/');
  const dat = ref.slice(ref.lastIndexOf('/') + 1).replace(/\.dat$/, '');
  if (!dat) return null;
  return { dat, color: Number(t[1]) };
}

