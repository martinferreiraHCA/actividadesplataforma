// instrumentos.js — Banco de instrumentos científicos parametrizables.
//
// Cada instrumento se dibuja en SVG a partir de unos pocos parámetros:
//   · alcance   → mínimo y máximo que puede medir
//   · división  → la menor división de la escala (la apreciación)
//   · numeración→ cada cuánto se escribe un número
//   · unidad    → mL, cm, N, °C, g, V…
//   · lectura   → el valor que muestra el instrumento en el dibujo
//   · escala    → el tamaño con el que se dibuja (no cambia lo que mide)
//
// Con eso, la misma probeta sirve para una de 10 mL con divisiones de 0,2 mL
// y para una de 1 L con divisiones de 20 mL. Todo se dibuja en el navegador,
// sin librerías: es SVG generado a mano, así que se imprime nítido a cualquier
// tamaño y se puede descargar como archivo suelto.

const NS = 'http://www.w3.org/2000/svg';

const FUENTE_NUM = "'JetBrains Mono', 'Courier New', monospace";
const FUENTE_TXT = "'Space Grotesk', Arial, Helvetica, sans-serif";

// Paleta pensada para imprimir en blanco y negro sin perder legibilidad.
const C = {
  trazo: '#111111',
  suave: '#5a5a5a',
  tenue: '#9aa3ab',
  vidrio: '#eef5f8',
  vidrioBorde: '#7f9aa8',
  metal: '#dcdfe3',
  metalOsc: '#9aa3ab',
  cuerpo: '#f4f2ec',
  cuerpoOsc: '#3c4147',
  rojo: '#c0392b',
  liquido: '#3aa3d8',
  lcd: '#cfe3c9',
  lcdTexto: '#12301a',
  papel: '#ffffff'
};

// ============================================================
// Utilidades de SVG
// ============================================================
export function svgEl(tag, attrs) {
  const n = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  return n;
}

function linea(x1, y1, x2, y2, color, ancho, extra) {
  return svgEl('line', Object.assign({
    x1: r2(x1), y1: r2(y1), x2: r2(x2), y2: r2(y2),
    stroke: color || C.trazo,
    'stroke-width': ancho == null ? 1 : ancho,
    'stroke-linecap': 'butt'
  }, extra));
}

function rect(x, y, w, h, relleno, borde, ancho, extra) {
  return svgEl('rect', Object.assign({
    x: r2(x), y: r2(y), width: r2(Math.max(0, w)), height: r2(Math.max(0, h)),
    fill: relleno || 'none',
    stroke: borde || 'none',
    'stroke-width': ancho == null ? 1.4 : ancho
  }, extra));
}

function texto(x, y, str, opciones) {
  const o = opciones || {};
  const t = svgEl('text', {
    x: r2(x), y: r2(y),
    'font-family': o.mono === false ? FUENTE_TXT : FUENTE_NUM,
    'font-size': o.tam || 11,
    'font-weight': o.peso || 400,
    fill: o.color || C.trazo,
    'text-anchor': o.ancla || 'middle',
    'dominant-baseline': o.base || 'middle',
    transform: o.transform || null,
    'letter-spacing': o.espaciado || null
  });
  t.textContent = str;
  return t;
}

function grupo(extra) { return svgEl('g', extra); }

function r2(n) { return Math.round(n * 100) / 100; }

// ============================================================
// Números, escalas y lecturas
// ============================================================

// Cuántos decimales hacen falta para escribir un paso de escala.
export function decimalesDe(paso) {
  const s = String(paso);
  if (s.indexOf('e') >= 0) return 4;
  const i = s.indexOf('.');
  return i < 0 ? 0 : Math.min(4, s.length - i - 1);
}

// Formato en español: coma decimal, sin "-0".
export function fmt(v, dec) {
  const d = dec == null ? 2 : dec;
  let n = Number(v);
  if (!isFinite(n)) n = 0;
  if (Math.abs(n) < Math.pow(10, -(d + 2))) n = 0;
  return n.toFixed(d).replace('.', ',');
}

// Marcas de una escala lineal. Devuelve [{v, tipo}] con tipo
// 'mayor' (lleva número), 'media' (mitad de camino) o 'menor'.
export function marcasLineales(min, max, division, numerarCada) {
  const salida = [];
  const div = Math.abs(division) > 0 ? Math.abs(division) : 1;
  const total = Math.round((max - min) / div);
  if (!isFinite(total) || total <= 0) return [{ v: min, tipo: 'mayor' }];
  // Techo de seguridad: nadie imprime 5000 rayitas y sobre todo, no se cuelga.
  const salto = total > 1200 ? Math.ceil(total / 1200) : 1;
  const num = Math.abs(numerarCada) > 0 ? Math.abs(numerarCada) : div * 10;
  const pasosPorNumero = num / div;
  for (let i = 0; i <= total; i += salto) {
    const v = min + i * div;
    const k = i / pasosPorNumero;
    const esMayor = Math.abs(k - Math.round(k)) < 1e-6;
    const esMedia = !esMayor && Math.abs(Math.abs(k - Math.round(k)) - 0.5) < 1e-6;
    salida.push({ v, tipo: esMayor ? 'mayor' : esMedia ? 'media' : 'menor' });
  }
  return salida;
}

function acotar(v, min, max) { return Math.min(max, Math.max(min, Number(v) || 0)); }

// ============================================================
// Parámetros comunes (se reutilizan en casi todos los instrumentos)
// ============================================================
const P = {
  min: (def, ayuda) => ({ clave: 'min', etiqueta: 'Alcance mínimo', tipo: 'numero', paso: 'any', def, ayuda: ayuda || 'El valor más chico de la escala.' }),
  max: (def, ayuda) => ({ clave: 'max', etiqueta: 'Alcance máximo', tipo: 'numero', paso: 'any', def, ayuda: ayuda || 'Hasta cuánto mide el instrumento (fondo de escala).' }),
  division: (def) => ({ clave: 'division', etiqueta: 'Menor división', tipo: 'numero', paso: 'any', min: 0, def, ayuda: 'La rayita más chica. Define la apreciación del instrumento.' }),
  numerarCada: (def) => ({ clave: 'numerarCada', etiqueta: 'Numerar cada', tipo: 'numero', paso: 'any', min: 0, def, ayuda: 'Cada cuánto se escribe un número sobre la escala.' }),
  unidad: (def) => ({ clave: 'unidad', etiqueta: 'Unidad', tipo: 'texto', def, ayuda: 'Se muestra junto a la escala y en la lectura.' }),
  lectura: (def) => ({ clave: 'lectura', etiqueta: 'Lectura que muestra', tipo: 'numero', paso: 'any', def, ayuda: 'El valor que marca el instrumento en el dibujo.' }),
  mostrarValor: (def) => ({ clave: 'mostrarValor', etiqueta: 'Escribir la lectura en números', tipo: 'bool', def: def !== false, ayuda: 'Apagalo para que los estudiantes tengan que leer la escala.' }),
  // La línea de medición NO viene puesta: el instrumento sale limpio y la
  // agrega quien arma la ficha, apuntando adonde quiera.
  marca: () => ([
    { clave: 'marcarLectura', etiqueta: 'Agregar la línea de medición', tipo: 'bool', def: false, ayuda: 'La línea roja que señala dónde hay que leer. Sin ella el instrumento sale limpio, que es lo que conviene para que el estudiante lea la escala solo.' },
    { clave: 'marcaEn', etiqueta: 'Dónde apunta la línea', tipo: 'texto', def: '', ayuda: 'Dejalo vacío y apunta a la lectura del instrumento. Poné un número y apunta a ese punto de la escala, aunque el instrumento marque otra cosa.' },
    { clave: 'marcaTexto', etiqueta: 'Rótulo de la línea', tipo: 'texto', def: '', ayuda: 'Texto corto al lado de la línea: «nivel inicial», «acá se lee», «V₁»…' },
    { clave: 'marcaCorrer', etiqueta: 'Correr la línea (ajuste fino)', tipo: 'numero', paso: 1, def: 0, ayuda: 'Milímetros de dibujo para calzarla exacta. Positivo la baja o la corre a la derecha; negativo, al revés.' }
  ]),
  etiqueta: (def) => ({ clave: 'etiqueta', etiqueta: 'Rótulo del instrumento', tipo: 'texto', def: def || '', ayuda: 'Texto libre: modelo, número de equipo, "Instrumento A"…' }),
  color: (def) => ({ clave: 'color', etiqueta: 'Color del líquido', tipo: 'color', def: def || C.liquido }),
  escala: () => ({ clave: 'escala', etiqueta: 'Tamaño del dibujo', tipo: 'opcion', def: 1, ayuda: 'Sólo cambia el tamaño en la hoja, no lo que mide.', opciones: [
    { v: 0.6, t: 'Chico' }, { v: 0.8, t: 'Mediano' }, { v: 1, t: 'Normal' }, { v: 1.3, t: 'Grande' }, { v: 1.7, t: 'Muy grande' }
  ] })
};

// ============================================================
// Piezas de dibujo compartidas
// ============================================================

// Cartel con la lectura, arriba a la izquierda del dibujo.
function carteLectura(g, x, y, textoLect, ancho) {
  const w = ancho || Math.max(96, textoLect.length * 9.2 + 20);
  g.appendChild(rect(x, y, w, 26, '#fff', C.rojo, 1.6, { rx: 6 }));
  g.appendChild(texto(x + w / 2, y + 13, textoLect, { tam: 13, peso: 700, color: C.rojo }));
  return w;
}

// Configuración de la línea de medición, ya resuelta:
//   activa  → si hay que dibujarla
//   v       → a qué valor de la escala apunta (por defecto, la lectura)
//   texto   → el rótulo que la acompaña
//   correr  → el ajuste fino, en unidades del dibujo
function marcaCfg(p, lectura) {
  const crudo = String(p.marcaEn == null ? '' : p.marcaEn).trim().replace(',', '.');
  const propio = crudo !== '' && isFinite(Number(crudo));
  return {
    activa: !!p.marcarLectura,
    v: propio ? Number(crudo) : Number(lectura),
    texto: String(p.marcaTexto || '').trim(),
    correr: Number(p.marcaCorrer) || 0
  };
}

// El rótulo de la línea de medición, en rojo y en dos renglones si es largo.
function rotuloMarca(g, x, y, txt, ancla) {
  if (!txt) return;
  const palabras = txt.split(/\s+/);
  const renglones = [];
  let actual = '';
  palabras.forEach(w => {
    if ((actual + ' ' + w).trim().length > 14 && actual) { renglones.push(actual); actual = w; }
    else actual = (actual + ' ' + w).trim();
  });
  if (actual) renglones.push(actual);
  renglones.slice(0, 2).forEach((r, i) => {
    g.appendChild(texto(x, y + i * 12, r, { tam: 10, color: C.rojo, ancla: ancla || 'start' }));
  });
}

// Rótulo libre del instrumento.
function rotulo(g, x, y, txt, ancla) {
  if (!txt) return;
  g.appendChild(texto(x, y, txt, { tam: 12, peso: 700, mono: false, ancla: ancla || 'middle', color: C.suave }));
}

// Flecha triangular apuntando a un punto (dirección: 'izq','der','arriba','abajo').
function flecha(x, y, dir, tam, color) {
  const t = tam || 9;
  let pts;
  if (dir === 'izq') pts = `${x},${y} ${x + t},${y - t * 0.6} ${x + t},${y + t * 0.6}`;
  else if (dir === 'der') pts = `${x},${y} ${x - t},${y - t * 0.6} ${x - t},${y + t * 0.6}`;
  else if (dir === 'arriba') pts = `${x},${y} ${x - t * 0.6},${y + t} ${x + t * 0.6},${y + t}`;
  else pts = `${x},${y} ${x - t * 0.6},${y - t} ${x + t * 0.6},${y - t}`;
  return svgEl('polygon', { points: pts, fill: color || C.rojo });
}

// Pantalla de cristal líquido con el valor.
function pantallaLCD(g, x, y, w, h, valor, unidad, opciones) {
  const o = opciones || {};
  g.appendChild(rect(x, y, w, h, C.lcd, C.trazo, 1.6, { rx: 4 }));
  const tamNum = o.tamNum || h * 0.62;
  g.appendChild(texto(x + w - (unidad ? 14 : 10), y + h / 2 + 1, valor, {
    tam: tamNum, peso: 700, color: C.lcdTexto, ancla: 'end'
  }));
  if (unidad) g.appendChild(texto(x + w - 8, y + h - 9, unidad, { tam: h * 0.26, peso: 700, color: C.lcdTexto, ancla: 'end' }));
  if (o.arriba) g.appendChild(texto(x + 8, y + 11, o.arriba, { tam: h * 0.2, color: C.lcdTexto, ancla: 'start' }));
}

// ============================================================
// INSTRUMENTOS
// ============================================================
const DEF = {};

// ---------- Regla graduada ----------
DEF.regla = {
  nombre: 'Regla graduada',
  icono: '📏',
  categoria: 'Longitud',
  magnitud: 'Longitud',
  resumen: 'Escala lineal para medir longitudes. Se lee donde termina el objeto.',
  comoSeLee: 'Se apoya el cero de la regla en un extremo del objeto y se lee la marca donde cae el otro extremo. Si el extremo cae entre dos rayitas, se estima la última cifra.',
  params: [
    { clave: 'orientacion', etiqueta: 'Orientación', tipo: 'opcion', def: 'horizontal', opciones: [{ v: 'horizontal', t: 'Horizontal' }, { v: 'vertical', t: 'Vertical' }] },
    P.min(0), P.max(30), P.division(0.1), P.numerarCada(1), P.unidad('cm'),
    P.lectura(12.7),
    { clave: 'mostrarObjeto', etiqueta: 'Dibujar el objeto medido', tipo: 'bool', def: true },
    { clave: 'desde', etiqueta: 'El objeto empieza en', tipo: 'numero', paso: 'any', def: 0, ayuda: 'Poné un valor distinto de cero para practicar restas de posiciones.' },
    ...P.marca(), P.mostrarValor(true), P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const min = Number(p.min), max = Number(p.max);
    const largo = Math.max(0.0001, max - min);
    const px = acotar(720 / largo, 0.05, 400);           // píxeles por unidad
    const vertical = p.orientacion === 'vertical';
    const cuerpo = 78;                                    // ancho de la regla
    const margen = 42;
    const lect = acotar(p.lectura, min, max);
    const desde = acotar(p.desde, min, max);
    const dec = decimalesDe(p.division);
    const marcas = marcasLineales(min, max, p.division, p.numerarCada);
    const g = grupo();

    const largoPx = largo * px;
    const ancho = vertical ? cuerpo + 150 : largoPx + margen * 2;
    const alto = vertical ? largoPx + margen * 2 : cuerpo + 142;
    // Coordenada del valor v sobre el eje de la regla.
    const pos = v => vertical ? (margen + largoPx - (v - min) * px) : (margen + (v - min) * px);
    const x0 = vertical ? 108 : 0;                        // borde de la regla
    const y0 = vertical ? 0 : 96;

    // cuerpo de la regla (con un margencito para que el 0 y el máximo no
    // queden partidos justo sobre el borde)
    const sobra = 14;
    if (vertical) g.appendChild(rect(x0, margen - sobra, cuerpo, largoPx + sobra * 2, C.cuerpo, C.trazo, 1.8, { rx: 3 }));
    else g.appendChild(rect(margen - sobra, y0, largoPx + sobra * 2, cuerpo, C.cuerpo, C.trazo, 1.8, { rx: 3 }));

    // marcas y números
    marcas.forEach(m => {
      const largoM = m.tipo === 'mayor' ? 26 : m.tipo === 'media' ? 17 : 10;
      const grosor = m.tipo === 'mayor' ? 1.5 : 1;
      const q = pos(m.v);
      if (vertical) {
        g.appendChild(linea(x0, q, x0 + largoM, q, C.trazo, grosor));
        if (m.tipo === 'mayor') g.appendChild(texto(x0 + largoM + 16, q, fmt(m.v, decimalesDe(p.numerarCada)), { tam: 12 }));
      } else {
        g.appendChild(linea(q, y0, q, y0 + largoM, C.trazo, grosor));
        if (m.tipo === 'mayor') g.appendChild(texto(q, y0 + largoM + 12, fmt(m.v, decimalesDe(p.numerarCada)), { tam: 12 }));
      }
    });

    // unidad en la punta
    if (vertical) g.appendChild(texto(x0 + cuerpo - 12, margen + 14, p.unidad, { tam: 12, peso: 700, ancla: 'end' }));
    else g.appendChild(texto(margen + largoPx - 8, y0 + cuerpo - 13, p.unidad, { tam: 12, peso: 700, ancla: 'end' }));

    // el objeto medido
    if (p.mostrarObjeto) {
      const a = pos(Math.min(desde, lect)), b = pos(Math.max(desde, lect));
      if (vertical) g.appendChild(rect(x0 - 56, Math.min(a, b), 42, Math.abs(b - a), 'rgba(58,163,216,0.30)', C.liquido, 1.6, { rx: 4 }));
      else g.appendChild(rect(Math.min(a, b), y0 - 40, Math.abs(b - a), 34, 'rgba(58,163,216,0.30)', C.liquido, 1.6, { rx: 4 }));
    }

    // la línea de medición, si la pidieron
    const M = marcaCfg(p, lect);
    if (M.activa) {
      const q = pos(acotar(M.v, min, max)) + M.correr;
      if (vertical) {
        g.appendChild(linea(x0 - 62, q, x0 + cuerpo, q, C.rojo, 1.5, { 'stroke-dasharray': '5 3' }));
        g.appendChild(flecha(x0 + cuerpo + 4, q, 'der', 9));
        rotuloMarca(g, x0 + cuerpo + 16, q - 6, M.texto);
      } else {
        g.appendChild(linea(q, y0 - 46, q, y0 + cuerpo, C.rojo, 1.5, { 'stroke-dasharray': '5 3' }));
        g.appendChild(flecha(q, y0 - 50, 'abajo', 9));
        rotuloMarca(g, q + 8, y0 - 60, M.texto);
      }
    }

    if (p.mostrarValor) {
      const t = fmt(Math.abs(lect - desde), dec) + ' ' + p.unidad;
      if (vertical) carteLectura(g, 0, 8, t);
      else carteLectura(g, margen, 6, t);
    }
    rotulo(g, vertical ? ancho - 8 : ancho - 8, alto - 12, p.etiqueta, 'end');
    return { g, ancho, alto };
  }
};

// ---------- Calibre (pie de rey) con nonio ----------
DEF.calibre = {
  nombre: 'Calibre / pie de rey',
  icono: '🧰',
  categoria: 'Longitud',
  magnitud: 'Longitud',
  resumen: 'Regla principal en milímetros más un nonio que agrega décimas o centésimas.',
  comoSeLee: 'Primero se leen los milímetros enteros a la izquierda del cero del nonio. Después se busca qué rayita del nonio coincide exactamente con una de la regla principal: ese número da la parte decimal.',
  params: [
    P.max(150, 'Largo de la regla principal, en mm.'),
    { clave: 'nonio', etiqueta: 'Divisiones del nonio', tipo: 'opcion', def: 10, ayuda: 'Define la apreciación: 10 → 0,1 mm · 20 → 0,05 mm · 50 → 0,02 mm.', opciones: [
      { v: 10, t: '10 divisiones (0,1 mm)' }, { v: 20, t: '20 divisiones (0,05 mm)' }, { v: 50, t: '50 divisiones (0,02 mm)' }
    ] },
    P.lectura(23.4),
    { clave: 'mostrarObjeto', etiqueta: 'Dibujar la pieza medida', tipo: 'bool', def: true },
    ...P.marca(), P.mostrarValor(true), P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const n = Math.round(Number(p.nonio)) || 10;
    const apr = 1 / n;
    const dec = n === 10 ? 1 : 2;
    const max = acotar(p.max, 20, 300);
    const lect = acotar(Math.round(p.lectura / apr) * apr, 0, max);
    const g = grupo();
    const ancho = 880, alto = 430;

    // ---------- arriba: el calibre entero ----------
    const px = (ancho - 200) / max;                       // píxeles por mm
    const xr = 110, yr = 130, altoRegla = 34;
    g.appendChild(rect(xr - 24, yr, max * px + 48, altoRegla, C.metal, C.trazo, 1.8));
    const mordaza = (x, signo) => svgEl('path', {
      d: `M ${r2(x)} ${yr} L ${r2(x)} ${yr - 58} L ${r2(x + 18 * signo)} ${yr - 58} L ${r2(x + 18 * signo)} ${yr - 4} L ${r2(x + 24 * signo)} ${yr - 4} L ${r2(x + 24 * signo)} ${yr} Z`,
      fill: C.metal, stroke: C.trazo, 'stroke-width': 1.8
    });
    g.appendChild(mordaza(xr, -1));
    marcasLineales(0, max, 1, 10).forEach(m => {
      const x = xr + m.v * px;
      const l = m.tipo === 'mayor' ? 14 : m.tipo === 'media' ? 9 : 5;
      g.appendChild(linea(x, yr, x, yr + l, C.trazo, m.tipo === 'mayor' ? 1.3 : 0.7));
      if (m.tipo === 'mayor') g.appendChild(texto(x, yr + l + 10, String(Math.round(m.v / 10)), { tam: 10 }));
    });
    g.appendChild(texto(xr + max * px + 36, yr + altoRegla / 2, 'cm', { tam: 11, peso: 700 }));

    const xc = xr + lect * px;                            // posición del cursor
    g.appendChild(rect(xc - 8, yr - 8, 74, altoRegla + 34, 'rgba(154,163,171,0.30)', C.trazo, 1.6, { rx: 3 }));
    g.appendChild(mordaza(xc, 1));
    if (p.mostrarObjeto) g.appendChild(rect(xr, yr - 52, lect * px, 40, 'rgba(58,163,216,0.28)', C.liquido, 1.6, { rx: 3 }));
    // En el calibre la línea de medición señala dónde hay que mirar: el cero
    // del nonio y la rayita que coincide. No se despega de la lectura, porque
    // la coincidencia es un hecho de la escala, no una marca libre.
    const M = marcaCfg(p, lect);
    if (M.activa) {
      g.appendChild(linea(xc + M.correr, yr - 66, xc + M.correr, yr + altoRegla + 28, C.rojo, 1.3, { 'stroke-dasharray': '5 3' }));
      g.appendChild(texto(xc + M.correr + 30, yr + altoRegla + 40, M.texto || 'cero del nonio', { tam: 10, color: C.rojo }));
    }

    // ---------- abajo: la lupa sobre el nonio ----------
    // A tamaño real las rayitas del nonio quedan pegadas y no se puede leer
    // nada. Por eso, igual que en cualquier libro de laboratorio, se dibuja
    // aparte la zona de la escala ampliada.
    const yL = 250, altoL = 150;
    const ventana = (n - 1) + 5;                          // mm que entran en la lupa
    const pxZ = (ancho - 120) / ventana;
    const mmIni = Math.max(0, Math.min(Math.floor(lect) - 2, max - ventana));
    const xL = 60;
    const zx = mm => xL + (mm - mmIni) * pxZ;

    g.appendChild(rect(xL - 16, yL - 30, ancho - 88, altoL + 40, '#fbfbf8', C.tenue, 1.4, { rx: 10 }));
    g.appendChild(texto(xL - 4, yL - 14, '🔍 la escala ampliada', { tam: 11, peso: 700, ancla: 'start', color: C.suave, mono: false }));

    // regla principal (arriba de la lupa): 1 mm
    const yEje = yL + 66;
    g.appendChild(rect(xL - 10, yL + 14, ancho - 100, 52, C.metal, C.trazo, 1.4));
    for (let mm = mmIni; mm <= mmIni + ventana; mm++) {
      const x = zx(mm);
      const grande = mm % 10 === 0;
      g.appendChild(linea(x, yEje, x, yEje - (grande ? 26 : mm % 5 === 0 ? 20 : 14), C.trazo, grande ? 1.8 : 1));
      if (mm % 5 === 0) g.appendChild(texto(x, yEje - 36, String(mm), { tam: 12, peso: grande ? 700 : 400 }));
    }

    // nonio: n divisiones que ocupan (n-1) mm, así cada una mide 1 − 1/n mm
    const pasoN = pxZ * (n - 1) / n;
    const coincid = Math.round((lect - Math.floor(lect)) * n) % n;
    const cadaNum = n === 50 ? 10 : n === 20 ? 5 : 2;
    g.appendChild(rect(zx(lect) - 12, yEje, (n - 1) * pxZ + 34, 56, 'rgba(154,163,171,0.35)', C.trazo, 1.4, { rx: 3 }));
    for (let i = 0; i <= n; i++) {
      const x = zx(lect) + i * pasoN;
      const marcada = i === coincid && M.activa;
      g.appendChild(linea(x, yEje, x, yEje + (i % cadaNum === 0 ? 30 : 22), marcada ? C.rojo : C.trazo, marcada ? 2.4 : 1));
      if (i % cadaNum === 0) g.appendChild(texto(x, yEje + 42, String(i), { tam: 11, peso: marcada ? 700 : 400, color: marcada ? C.rojo : C.trazo }));
    }
    // la rayita que coincide, señalada de punta a punta
    if (M.activa) {
      const xco = zx(lect) + coincid * pasoN;
      g.appendChild(linea(xco, yEje - 30, xco, yEje + 34, C.rojo, 1.2, { 'stroke-dasharray': '4 3' }));
      g.appendChild(texto(xco, yEje + 60, 'la que coincide', { tam: 10, color: C.rojo }));
      g.appendChild(linea(zx(lect), yEje - 34, zx(lect), yEje + 34, C.rojo, 1.6));
    }
    g.appendChild(texto(ancho - 60, yEje + 18, 'nonio', { tam: 11, peso: 700, ancla: 'end' }));

    if (p.mostrarValor) {
      carteLectura(g, 24, 20, fmt(lect, dec) + ' mm');
      g.appendChild(texto(24, 60, `${Math.floor(lect)} mm (regla) + ${coincid} × ${fmt(apr, dec)} mm (nonio)`, { tam: 11, ancla: 'start', color: C.suave }));
    } else {
      g.appendChild(texto(24, 30, `nonio de ${n} divisiones — apreciación ${fmt(apr, dec)} mm`, { tam: 11, ancla: 'start', color: C.suave }));
    }
    rotulo(g, ancho - 20, alto - 12, p.etiqueta, 'end');
    return { g, ancho, alto };
  }
};

// ---------- Micrómetro (Palmer) ----------
DEF.micrometro = {
  nombre: 'Micrómetro (Palmer)',
  icono: '🔩',
  categoria: 'Longitud',
  magnitud: 'Longitud',
  resumen: 'Tornillo micrométrico: la escala fija da los medios milímetros y el tambor las centésimas.',
  comoSeLee: 'Se leen los milímetros y medios milímetros visibles en el cilindro fijo, y se les suma el número del tambor que queda alineado con la línea de referencia.',
  params: [
    P.max(25, 'Alcance del micrómetro, en mm (25, 50, 75…).'),
    { clave: 'divisionesTambor', etiqueta: 'Divisiones del tambor', tipo: 'opcion', def: 50, opciones: [{ v: 50, t: '50 (0,01 mm)' }, { v: 100, t: '100 (0,005 mm)' }] },
    P.lectura(7.32),
    ...P.marca(), P.mostrarValor(true), P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const divT = Number(p.divisionesTambor) || 50;
    const apr = 0.5 / divT;
    const dec = decimalesDe(apr);
    const max = acotar(p.max, 5, 300);
    const lect = acotar(Math.round(p.lectura / apr) * apr, 0, max);
    const tope = Math.min(max, 25);                       // mm que muestra el cilindro
    const M = marcaCfg(p, lect);
    const g = grupo();
    const px = 16;                                        // px por mm sobre el cilindro
    const xc = 250, yc = 150;                             // arranque del cilindro fijo
    const yLinea = yc + 60;                               // línea de referencia
    const anchoT = 200;                                   // largo del tambor
    // El micrómetro se alarga a medida que se abre: el ancho del dibujo se
    // reserva para la apertura máxima, así todas las lecturas quedan a escala.
    const ancho = xc + 20 + tope * px + anchoT + 80, alto = 400;

    // arco (cuerpo en C), yunque y espiga
    g.appendChild(svgEl('path', {
      d: `M ${xc - 30} ${yc + 26} L ${xc - 70} ${yc + 26} C ${xc - 190} ${yc + 18} ${xc - 200} ${yc + 190} ${xc - 70} ${yc + 180} L ${xc - 24} ${yc + 180} L ${xc - 24} ${yc + 150} L ${xc - 60} ${yc + 150} C ${xc - 140} ${yc + 156} ${xc - 134} ${yc + 52} ${xc - 60} ${yc + 58} L ${xc - 30} ${yc + 58} Z`,
      fill: C.cuerpoOsc, stroke: C.trazo, 'stroke-width': 1.8
    }));
    g.appendChild(rect(xc - 34, yc + 44, 18, 46, C.metal, C.trazo, 1.6));   // yunque
    g.appendChild(rect(xc - 16, yc + 54, 30, 26, C.metal, C.trazo, 1.6));   // pieza medida
    g.appendChild(texto(xc - 1, yc + 100, 'pieza', { tam: 10, color: C.suave, mono: false }));

    // cilindro fijo: sólo se ve la parte que el tambor todavía no tapó
    const xt = xc + 20 + lect * px;                       // borde del tambor
    g.appendChild(rect(xc, yc + 40, (xt - xc) + 10, 40, C.metal, C.trazo, 1.8, { rx: 4 }));
    g.appendChild(linea(xc + 6, yLinea, xt + 8, yLinea, C.trazo, 1.6));
    for (let mm = 0; mm <= tope; mm++) {
      const x = xc + 20 + mm * px;
      if (x > xt + 2) break;                              // lo tapa el tambor
      g.appendChild(linea(x, yLinea, x, yLinea - (mm % 5 === 0 ? 16 : 10), C.trazo, mm % 5 === 0 ? 1.6 : 1));
      if (mm % 5 === 0) g.appendChild(texto(x, yLinea - 26, String(mm), { tam: 11, peso: 700 }));
      const xMedio = x + px / 2;                          // las marcas de medio milímetro van abajo
      if (mm < tope && xMedio <= xt + 2) g.appendChild(linea(xMedio, yLinea, xMedio, yLinea + 11, C.trazo, 1));
    }

    // tambor: da una vuelta entera cada 0,5 mm de avance
    g.appendChild(svgEl('path', {
      d: `M ${r2(xt)} ${yc + 16} L ${r2(xt + anchoT)} ${yc + 6} L ${r2(xt + anchoT)} ${yc + 116} L ${r2(xt)} ${yc + 106} Z`,
      fill: C.cuerpoOsc, stroke: C.trazo, 'stroke-width': 1.8
    }));
    const cent = Math.round((lect - Math.floor(lect * 2) / 2) / apr) % divT;
    const pasoT = 12;
    for (let d = -4; d <= 4; d++) {
      const val = ((cent - d) % divT + divT) % divT;      // los números crecen hacia abajo
      const y = yLinea + d * pasoT;
      if (y < yc + 12 || y > yc + 112) continue;
      const enLinea = d === 0;
      const color = enLinea && M.activa ? C.rojo : '#ffffff';
      g.appendChild(linea(xt + 8, y, xt + (val % 5 === 0 ? 46 : 30), y, color, enLinea ? 2.4 : 1.2));
      if (val % 5 === 0) g.appendChild(texto(xt + 66, y, String(val), { tam: 12, peso: enLinea ? 700 : 400, color }));
    }
    // la línea de referencia sigue sobre el tambor: ahí se lee la centésima
    g.appendChild(linea(xt, yLinea, xt + anchoT, yLinea, M.activa ? C.rojo : '#ffffff', 1.6));
    g.appendChild(rect(xt + anchoT, yc + 22, 46, 74, C.metal, C.trazo, 1.6, { rx: 10 }));   // trinquete
    g.appendChild(texto(xt + anchoT + 23, yc + 132, 'trinquete', { tam: 10, color: C.suave, mono: false }));

    if (p.mostrarValor) {
      carteLectura(g, 26, 26, fmt(lect, dec) + ' mm');
      const mmEnteros = Math.floor(lect * 2) / 2;
      g.appendChild(texto(26, 66, `${fmt(mmEnteros, 1)} mm en el cilindro + ${cent} × ${fmt(apr, dec)} mm en el tambor`, { tam: 12, ancla: 'start', color: C.suave }));
    } else {
      g.appendChild(texto(26, 30, `tambor de ${divT} divisiones — apreciación ${fmt(apr, dec)} mm`, { tam: 11, ancla: 'start', color: C.suave }));
    }
    rotulo(g, ancho - 16, alto - 14, p.etiqueta, 'end');
    return { g, ancho, alto };
  }
};

// ---------- Probeta graduada ----------
DEF.probeta = {
  nombre: 'Probeta graduada',
  icono: '🧪',
  categoria: 'Volumen',
  magnitud: 'Volumen',
  resumen: 'Cilindro graduado para medir volúmenes de líquido.',
  comoSeLee: 'Se apoya en una superficie plana y se mira a la altura de los ojos. Se lee la parte de abajo del menisco (la curva que forma el líquido).',
  params: [
    P.min(0), P.max(100), P.division(1), P.numerarCada(10), P.unidad('mL'),
    P.lectura(64),
    { clave: 'mostrarMenisco', etiqueta: 'Dibujar el menisco', tipo: 'bool', def: true },
    P.color(), ...P.marca(), P.mostrarValor(true), P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const min = Number(p.min), max = Number(p.max);
    const rango = Math.max(0.0001, max - min);
    const lect = acotar(p.lectura, min, max);
    const g = grupo();
    const ancho = 360, alto = 560;
    const cx = 150, anchoTubo = 108;
    const yTop = 60, yBase = 470;                          // interior del vidrio
    const alturaUtil = yBase - yTop - 16;
    const yDe = v => yBase - 8 - ((v - min) / rango) * alturaUtil;
    const xIzq = cx - anchoTubo / 2, xDer = cx + anchoTubo / 2;

    // pie y vidrio
    g.appendChild(svgEl('path', {
      d: `M ${cx - 58} ${alto - 34} L ${cx - 40} ${yBase} L ${cx + 40} ${yBase} L ${cx + 58} ${alto - 34} Z`,
      fill: C.vidrio, stroke: C.vidrioBorde, 'stroke-width': 2, 'stroke-linejoin': 'round'
    }));
    g.appendChild(svgEl('ellipse', { cx, cy: alto - 34, rx: 58, ry: 9, fill: C.vidrio, stroke: C.vidrioBorde, 'stroke-width': 2 }));
    g.appendChild(rect(xIzq, yTop, anchoTubo, yBase - yTop, C.vidrio, C.vidrioBorde, 2, { rx: 4 }));
    // pico de vertido
    g.appendChild(svgEl('path', {
      d: `M ${xIzq + 2} ${yTop + 10} Q ${xIzq - 14} ${yTop - 2} ${xIzq - 6} ${yTop - 14}`,
      fill: 'none', stroke: C.vidrioBorde, 'stroke-width': 2, 'stroke-linecap': 'round'
    }));

    // líquido con menisco cóncavo
    const yl = yDe(lect);
    if (lect > min) {
      const d = p.mostrarMenisco
        ? `M ${xIzq + 2} ${r2(yl)} Q ${cx} ${r2(yl + 13)} ${xDer - 2} ${r2(yl)} L ${xDer - 2} ${yBase - 3} L ${xIzq + 2} ${yBase - 3} Z`
        : `M ${xIzq + 2} ${r2(yl)} L ${xDer - 2} ${r2(yl)} L ${xDer - 2} ${yBase - 3} L ${xIzq + 2} ${yBase - 3} Z`;
      g.appendChild(svgEl('path', { d, fill: p.color || C.liquido, 'fill-opacity': 0.55, stroke: p.color || C.liquido, 'stroke-width': 1.4 }));
    }

    // escala grabada en el vidrio
    const decNum = decimalesDe(p.numerarCada);
    marcasLineales(min, max, p.division, p.numerarCada).forEach(m => {
      const y = yDe(m.v);
      const l = m.tipo === 'mayor' ? 34 : m.tipo === 'media' ? 22 : 13;
      g.appendChild(linea(xIzq + 2, y, xIzq + 2 + l, y, C.trazo, m.tipo === 'mayor' ? 1.5 : 0.9));
      if (m.tipo === 'mayor') g.appendChild(texto(xIzq + 40, y, fmt(m.v, decNum), { tam: 11, ancla: 'start' }));
    });
    g.appendChild(texto(xDer - 8, yTop + 22, p.unidad, { tam: 13, peso: 700, ancla: 'end' }));

    const M = marcaCfg(p, lect);
    if (M.activa) {
      const ym = yDe(acotar(M.v, min, max)) + M.correr;
      g.appendChild(linea(xIzq - 46, ym, xDer + 26, ym, C.rojo, 1.5, { 'stroke-dasharray': '5 3' }));
      g.appendChild(flecha(xDer + 30, ym, 'izq', 9));
      rotuloMarca(g, xDer + 46, ym - 6, M.texto || 'línea de lectura');
    }
    if (p.mostrarValor) carteLectura(g, 10, 8, fmt(lect, decimalesDe(p.division)) + ' ' + p.unidad);
    rotulo(g, cx, alto - 8, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ---------- Bureta ----------
DEF.bureta = {
  nombre: 'Bureta',
  icono: '💧',
  categoria: 'Volumen',
  magnitud: 'Volumen',
  resumen: 'Tubo graduado al revés (el cero arriba) con llave para dosificar gota a gota.',
  comoSeLee: 'La escala crece hacia abajo: el número que marca el menisco es el volumen ya descargado. En una titulación se anota el valor inicial y el final, y se restan.',
  params: [
    P.min(0), P.max(50), P.division(0.1), P.numerarCada(5), P.unidad('mL'),
    P.lectura(18.7),
    P.color('#c94f7c'), ...P.marca(), P.mostrarValor(true), P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const min = Number(p.min), max = Number(p.max);
    const rango = Math.max(0.0001, max - min);
    const lect = acotar(p.lectura, min, max);
    const g = grupo();
    const ancho = 260, alto = 620;
    const cx = 120, anchoTubo = 56;
    const yTop = 46, yFin = 470;
    const yDe = v => yTop + ((v - min) / rango) * (yFin - yTop);   // crece hacia abajo
    const xIzq = cx - anchoTubo / 2, xDer = cx + anchoTubo / 2;

    g.appendChild(rect(xIzq, yTop - 22, anchoTubo, (yFin - yTop) + 44, C.vidrio, C.vidrioBorde, 2, { rx: 4 }));
    // llave (robinete) y pico
    g.appendChild(rect(xIzq + 4, yFin + 22, anchoTubo - 8, 26, C.vidrio, C.vidrioBorde, 2));
    g.appendChild(svgEl('circle', { cx, cy: yFin + 35, r: 15, fill: C.metal, stroke: C.trazo, 'stroke-width': 1.8 }));
    g.appendChild(rect(cx + 12, yFin + 30, 40, 10, C.metal, C.trazo, 1.6, { rx: 4 }));
    g.appendChild(svgEl('path', { d: `M ${cx - 7} ${yFin + 50} L ${cx + 7} ${yFin + 50} L ${cx + 3} ${yFin + 96} L ${cx - 3} ${yFin + 96} Z`, fill: C.vidrio, stroke: C.vidrioBorde, 'stroke-width': 1.8 }));
    g.appendChild(svgEl('ellipse', { cx, cy: yFin + 108, rx: 5, ry: 7, fill: p.color || C.liquido, 'fill-opacity': 0.8 }));

    // líquido: desde el tope hasta el nivel leído
    const yl = yDe(lect);
    g.appendChild(rect(xIzq + 2, yl, anchoTubo - 4, (yFin + 48) - yl, p.color || C.liquido, null, 0, { 'fill-opacity': 0.5 }));
    g.appendChild(svgEl('path', { d: `M ${xIzq + 2} ${r2(yl)} Q ${cx} ${r2(yl + 9)} ${xDer - 2} ${r2(yl)}`, fill: 'none', stroke: p.color || C.liquido, 'stroke-width': 1.6 }));

    const decNum = decimalesDe(p.numerarCada);
    marcasLineales(min, max, p.division, p.numerarCada).forEach(m => {
      const y = yDe(m.v);
      const l = m.tipo === 'mayor' ? 24 : m.tipo === 'media' ? 16 : 9;
      g.appendChild(linea(xIzq + 2, y, xIzq + 2 + l, y, C.trazo, m.tipo === 'mayor' ? 1.4 : 0.8));
      if (m.tipo === 'mayor') g.appendChild(texto(xDer + 8, y, fmt(m.v, decNum), { tam: 11, ancla: 'start' }));
    });
    g.appendChild(texto(cx, yTop - 32, p.unidad, { tam: 12, peso: 700 }));

    const M = marcaCfg(p, lect);
    if (M.activa) {
      const ym = yDe(acotar(M.v, min, max)) + M.correr;
      g.appendChild(linea(xIzq - 34, ym, xDer + 6, ym, C.rojo, 1.4, { 'stroke-dasharray': '5 3' }));
      g.appendChild(flecha(xIzq - 38, ym, 'der', 9));
      rotuloMarca(g, xDer + 40, ym - 6, M.texto);
    }
    if (p.mostrarValor) carteLectura(g, 6, 6, fmt(lect, decimalesDe(p.division)) + ' ' + p.unidad);
    rotulo(g, cx, alto - 8, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ---------- Jeringa ----------
DEF.jeringa = {
  nombre: 'Jeringa graduada',
  icono: '💉',
  categoria: 'Volumen',
  magnitud: 'Volumen',
  resumen: 'Cilindro con émbolo: sirve para medir y trasvasar volúmenes chicos, y como pistón en experiencias de gases.',
  comoSeLee: 'Se lee sobre la escala del cilindro, en el borde del émbolo (el anillo de goma que está del lado del líquido).',
  params: [
    P.min(0), P.max(20), P.division(1), P.numerarCada(5), P.unidad('mL'),
    P.lectura(12),
    P.color(), ...P.marca(), P.mostrarValor(true), P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const min = Number(p.min), max = Number(p.max);
    const rango = Math.max(0.0001, max - min);
    const lect = acotar(p.lectura, min, max);
    const g = grupo();
    const ancho = 640, alto = 220;
    const x0 = 110, x1 = 500, yc = 110, altoTubo = 84;
    const yT = yc - altoTubo / 2;
    const xDe = v => x0 + ((v - min) / rango) * (x1 - x0);

    // aguja / pico y cuerpo
    g.appendChild(rect(x0 - 62, yc - 4, 62, 8, C.metal, C.trazo, 1.4));
    g.appendChild(rect(x0, yT, x1 - x0, altoTubo, C.vidrio, C.vidrioBorde, 2, { rx: 4 }));
    g.appendChild(rect(x1, yT - 12, 12, altoTubo + 24, C.vidrio, C.vidrioBorde, 2, { rx: 3 }));  // alas

    // líquido y émbolo
    const xl = xDe(lect);
    g.appendChild(rect(x0 + 2, yT + 2, xl - x0 - 2, altoTubo - 4, p.color || C.liquido, null, 0, { 'fill-opacity': 0.5 }));
    g.appendChild(rect(xl, yT + 2, 14, altoTubo - 4, '#4b4f55', C.trazo, 1.5, { rx: 2 }));
    g.appendChild(rect(xl + 14, yc - 7, (x1 + 20) - (xl + 14), 14, C.metal, C.trazo, 1.4));
    g.appendChild(rect(x1 + 20, yc - 26, 12, 52, C.metal, C.trazo, 1.6, { rx: 3 }));

    const decNum = decimalesDe(p.numerarCada);
    marcasLineales(min, max, p.division, p.numerarCada).forEach(m => {
      const x = xDe(m.v);
      const l = m.tipo === 'mayor' ? 22 : m.tipo === 'media' ? 14 : 8;
      g.appendChild(linea(x, yT, x, yT + l, C.trazo, m.tipo === 'mayor' ? 1.4 : 0.8));
      if (m.tipo === 'mayor') g.appendChild(texto(x, yT - 11, fmt(m.v, decNum), { tam: 11 }));
    });
    g.appendChild(texto(x0 + 6, yc + 30, p.unidad, { tam: 12, peso: 700, ancla: 'start' }));

    const M = marcaCfg(p, lect);
    if (M.activa) {
      const xm = xDe(acotar(M.v, min, max)) + M.correr;
      g.appendChild(linea(xm, yT - 30, xm, yT + altoTubo + 10, C.rojo, 1.5, { 'stroke-dasharray': '5 3' }));
      g.appendChild(flecha(xm, yT + altoTubo + 14, 'arriba', 9));
      rotuloMarca(g, xm + 8, yT - 42, M.texto);
    }
    if (p.mostrarValor) carteLectura(g, 8, 8, fmt(lect, decimalesDe(p.division)) + ' ' + p.unidad);
    rotulo(g, ancho - 8, alto - 12, p.etiqueta, 'end');
    return { g, ancho, alto };
  }
};

// ---------- Material de vidrio (vaso, erlenmeyer, matraz) ----------
DEF.vidrio = {
  nombre: 'Vaso, Erlenmeyer o matraz',
  icono: '⚗️',
  categoria: 'Volumen',
  magnitud: 'Volumen',
  resumen: 'Material de vidrio de laboratorio. El vaso y el Erlenmeyer traen graduaciones aproximadas; el matraz aforado, una sola línea exacta.',
  comoSeLee: 'Ojo: las marcas del vaso y del Erlenmeyer son orientativas (±5 %). Cuando el volumen tiene que ser exacto se usa probeta, pipeta o matraz aforado.',
  params: [
    { clave: 'forma', etiqueta: 'Tipo', tipo: 'opcion', def: 'vaso', opciones: [
      { v: 'vaso', t: 'Vaso de precipitados' }, { v: 'erlenmeyer', t: 'Erlenmeyer' }, { v: 'matraz', t: 'Matraz aforado' }
    ] },
    P.max(250, 'Capacidad nominal.'), P.division(25), P.numerarCada(50), P.unidad('mL'),
    P.lectura(150),
    P.color(), P.mostrarValor(true), P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const max = Math.max(1, Number(p.max));
    const lect = acotar(p.lectura, 0, max);
    const forma = p.forma || 'vaso';
    const g = grupo();
    const ancho = 320, alto = 420;
    const cx = 160;
    const yBase = 360, yTope = 90;
    const fr = lect / max;

    // Cada forma define su contorno y, para cada altura relativa, su medio ancho.
    let medioAncho, contorno;
    if (forma === 'vaso') {
      medioAncho = () => 92;
      contorno = `M ${cx - 92} ${yTope} L ${cx - 92} ${yBase} Q ${cx - 92} ${yBase + 14} ${cx - 74} ${yBase + 14} L ${cx + 74} ${yBase + 14} Q ${cx + 92} ${yBase + 14} ${cx + 92} ${yBase} L ${cx + 92} ${yTope}`;
    } else if (forma === 'erlenmeyer') {
      medioAncho = f => 30 + (1 - f) * 72;
      contorno = `M ${cx - 30} ${yTope} L ${cx - 30} ${yTope + 46} L ${cx - 102} ${yBase} Q ${cx - 102} ${yBase + 14} ${cx - 84} ${yBase + 14} L ${cx + 84} ${yBase + 14} Q ${cx + 102} ${yBase + 14} ${cx + 102} ${yBase} L ${cx + 30} ${yTope + 46} L ${cx + 30} ${yTope}`;
    } else {
      // El matraz aforado no lleva escala: sólo su línea de aforo.
      medioAncho = () => 86;
      contorno = `M ${cx - 18} ${yTope - 40} L ${cx - 18} ${yTope + 60} C ${cx - 110} ${yTope + 96} ${cx - 110} ${yBase} ${cx} ${yBase + 10} C ${cx + 110} ${yBase} ${cx + 110} ${yTope + 96} ${cx + 18} ${yTope + 60} L ${cx + 18} ${yTope - 40}`;
    }

    // líquido (recortado con el contorno del vidrio)
    const yNivel = yBase - fr * (yBase - (forma === 'matraz' ? yTope + 40 : yTope + 20));
    const clipId = 'clipVidrio' + Math.random().toString(36).slice(2, 8);
    const clip = svgEl('clipPath', { id: clipId });
    clip.appendChild(svgEl('path', { d: contorno + ' Z' }));
    g.appendChild(clip);
    g.appendChild(rect(cx - 120, yNivel, 240, yBase + 16 - yNivel, p.color || C.liquido, null, 0, { 'fill-opacity': 0.5, 'clip-path': `url(#${clipId})` }));

    g.appendChild(svgEl('path', { d: contorno, fill: 'none', stroke: C.vidrioBorde, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }));

    if (forma === 'matraz') {
      // línea de aforo única
      const yA = yTope + 30;
      g.appendChild(linea(cx - 22, yA, cx + 22, yA, C.trazo, 1.8));
      g.appendChild(texto(cx + 30, yA, `${fmt(max, 0)} ${p.unidad}`, { tam: 12, peso: 700, ancla: 'start' }));
      g.appendChild(texto(cx + 30, yA + 16, 'aforo', { tam: 10, ancla: 'start', color: C.suave }));
    } else {
      const decNum = decimalesDe(p.numerarCada);
      marcasLineales(0, max, p.division, p.numerarCada).forEach(m => {
        if (m.v === 0) return;
        const f = m.v / max;
        const y = yBase - f * (yBase - yTope - 20);
        const w = medioAncho(f);
        const l = m.tipo === 'mayor' ? 26 : 14;
        g.appendChild(linea(cx - w + 4, y, cx - w + 4 + l, y, C.trazo, m.tipo === 'mayor' ? 1.3 : 0.8));
        if (m.tipo === 'mayor') g.appendChild(texto(cx - w + 4 + l + 6, y, fmt(m.v, decNum), { tam: 10, ancla: 'start' }));
      });
      g.appendChild(texto(cx + 60, yTope + 14, p.unidad, { tam: 12, peso: 700 }));
    }

    if (p.mostrarValor) carteLectura(g, 8, 8, fmt(lect, decimalesDe(p.division)) + ' ' + p.unidad + (forma === 'matraz' ? '' : ' (aprox.)'));
    rotulo(g, cx, alto - 8, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ---------- Termómetro ----------
DEF.termometro = {
  nombre: 'Termómetro',
  icono: '🌡️',
  categoria: 'Temperatura',
  magnitud: 'Temperatura',
  resumen: 'Columna de líquido en un capilar: sube o baja con la temperatura.',
  comoSeLee: 'Se espera a que la columna se estabilice (medio minuto) sin sacar el bulbo del medio que se está midiendo, y se lee a la altura del tope de la columna.',
  params: [
    P.min(-10), P.max(110), P.division(1), P.numerarCada(10), P.unidad('°C'),
    P.lectura(37.5),
    P.color('#c0392b'), ...P.marca(), P.mostrarValor(true), P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const min = Number(p.min), max = Number(p.max);
    const rango = Math.max(0.0001, max - min);
    const lect = acotar(p.lectura, min, max);
    const g = grupo();
    const ancho = 250, alto = 600;
    const cx = 96;
    const yTop = 50, yBulbo = 500;
    const yDe = v => yBulbo - 24 - ((v - min) / rango) * (yBulbo - 24 - yTop - 14);

    // vidrio, capilar y bulbo
    g.appendChild(rect(cx - 24, yTop, 48, yBulbo - yTop, C.vidrio, C.vidrioBorde, 2, { rx: 24 }));
    g.appendChild(svgEl('circle', { cx, cy: yBulbo + 22, r: 30, fill: C.vidrio, stroke: C.vidrioBorde, 'stroke-width': 2 }));
    g.appendChild(rect(cx - 7, yTop + 10, 14, yBulbo - yTop, '#ffffff', C.tenue, 0.8, { rx: 7 }));

    // columna
    const yl = yDe(lect);
    g.appendChild(svgEl('circle', { cx, cy: yBulbo + 22, r: 24, fill: p.color || C.rojo }));
    g.appendChild(rect(cx - 6, yl, 12, (yBulbo + 22) - yl, p.color || C.rojo, null, 0, { rx: 6 }));

    // escala a ambos lados: rayitas a la izquierda, números a la derecha
    const decNum = decimalesDe(p.numerarCada);
    marcasLineales(min, max, p.division, p.numerarCada).forEach(m => {
      const y = yDe(m.v);
      const l = m.tipo === 'mayor' ? 15 : m.tipo === 'media' ? 10 : 6;
      g.appendChild(linea(cx - 8 - l, y, cx - 8, y, C.trazo, m.tipo === 'mayor' ? 1.4 : 0.8));
      if (m.tipo === 'mayor') {
        g.appendChild(linea(cx + 8, y, cx + 8 + l, y, C.trazo, 1.4));
        g.appendChild(texto(cx + 30, y, fmt(m.v, decNum), { tam: 11, ancla: 'start' }));
      }
    });
    g.appendChild(texto(cx, yTop - 18, p.unidad, { tam: 13, peso: 700 }));

    const M = marcaCfg(p, lect);
    if (M.activa) {
      const ym = yDe(acotar(M.v, min, max)) + M.correr;
      g.appendChild(linea(cx - 56, ym, cx + 90, ym, C.rojo, 1.4, { 'stroke-dasharray': '5 3' }));
      g.appendChild(flecha(cx - 60, ym, 'der', 9));
      rotuloMarca(g, cx + 96, ym - 6, M.texto);
    }
    if (p.mostrarValor) carteLectura(g, 4, 4, fmt(lect, decimalesDe(p.division)) + ' ' + p.unidad);
    rotulo(g, cx + 20, alto - 8, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ---------- Dinamómetro ----------
DEF.dinamometro = {
  nombre: 'Dinamómetro',
  icono: '🪝',
  categoria: 'Fuerza',
  magnitud: 'Fuerza',
  resumen: 'Resorte calibrado: se estira en proporción a la fuerza aplicada (ley de Hooke).',
  comoSeLee: 'Antes de medir se pone el cero con el dinamómetro colgando en la posición en que se va a usar. Después se lee sobre el índice, con la mirada perpendicular a la escala.',
  params: [
    P.min(0), P.max(10), P.division(0.1), P.numerarCada(1), P.unidad('N'),
    P.lectura(4.6),
    { clave: 'mostrarResorte', etiqueta: 'Mostrar el resorte por dentro', tipo: 'bool', def: true },
    { clave: 'mostrarMasa', etiqueta: 'Colgar una pesa', tipo: 'bool', def: true },
    ...P.marca(), P.mostrarValor(true), P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const min = Number(p.min), max = Number(p.max);
    const rango = Math.max(0.0001, max - min);
    const lect = acotar(p.lectura, min, max);
    const g = grupo();
    const ancho = 280, alto = 620;
    const cx = 130, anchoTubo = 88;
    const yTop = 96, yFin = 440;
    const yDe = v => yTop + 16 + ((v - min) / rango) * (yFin - yTop - 32);
    const M = marcaCfg(p, lect);

    // argolla y gancho superior
    g.appendChild(svgEl('circle', { cx, cy: 34, r: 18, fill: 'none', stroke: C.trazo, 'stroke-width': 4 }));
    g.appendChild(linea(cx, 52, cx, yTop, C.trazo, 4));

    // cuerpo
    g.appendChild(rect(cx - anchoTubo / 2, yTop, anchoTubo, yFin - yTop, C.vidrio, C.trazo, 2, { rx: 8 }));

    // resorte: se estira con la lectura
    const yIndice = yDe(lect);
    if (p.mostrarResorte) {
      const vueltas = 12;
      let d = `M ${cx} ${yTop + 6}`;
      const paso = (yIndice - yTop - 10) / vueltas;
      for (let i = 0; i < vueltas; i++) {
        const y = yTop + 6 + i * paso;
        d += ` C ${cx - 30} ${r2(y + paso * 0.3)} ${cx + 30} ${r2(y + paso * 0.7)} ${cx} ${r2(y + paso)}`;
      }
      g.appendChild(svgEl('path', { d, fill: 'none', stroke: C.metalOsc, 'stroke-width': 3, 'stroke-linecap': 'round' }));
    }

    // escala
    const decNum = decimalesDe(p.numerarCada);
    marcasLineales(min, max, p.division, p.numerarCada).forEach(m => {
      const y = yDe(m.v);
      const l = m.tipo === 'mayor' ? 20 : m.tipo === 'media' ? 13 : 8;
      const xi = cx + anchoTubo / 2;
      g.appendChild(linea(xi - l, y, xi - 2, y, C.trazo, m.tipo === 'mayor' ? 1.4 : 0.8));
      if (m.tipo === 'mayor') g.appendChild(texto(xi - l - 6, y, fmt(m.v, decNum), { tam: 11, ancla: 'end' }));
    });
    g.appendChild(texto(cx, yTop + 14, p.unidad, { tam: 13, peso: 700 }));

    // índice y vástago inferior
    g.appendChild(rect(cx - anchoTubo / 2 + 3, yIndice - 5, anchoTubo - 6, 10, M.activa ? C.rojo : C.metalOsc, C.trazo, 1.2, { rx: 2 }));
    g.appendChild(linea(cx, yIndice, cx, yFin + 60, C.trazo, 4));
    g.appendChild(svgEl('path', { d: `M ${cx} ${yFin + 60} q -16 8 -16 22 q 0 16 16 16 q 12 0 14 -10`, fill: 'none', stroke: C.trazo, 'stroke-width': 4 }));

    if (p.mostrarMasa) {
      g.appendChild(rect(cx - 34, yFin + 104, 68, 54, C.metalOsc, C.trazo, 1.8, { rx: 5 }));
      g.appendChild(texto(cx, yFin + 131, 'pesa', { tam: 11, peso: 700, color: '#fff', mono: false }));
    }
    if (M.activa) {
      const ym = yDe(acotar(M.v, min, max)) + M.correr;
      g.appendChild(flecha(cx + anchoTubo / 2 + 6, ym, 'izq', 9));
      if (M.texto) {
        g.appendChild(linea(cx - anchoTubo / 2 - 30, ym, cx + anchoTubo / 2 + 4, ym, C.rojo, 1.3, { 'stroke-dasharray': '5 3' }));
        rotuloMarca(g, cx + anchoTubo / 2 + 18, ym - 6, M.texto);
      }
    }
    if (p.mostrarValor) carteLectura(g, 4, 4, fmt(lect, decimalesDe(p.division)) + ' ' + p.unidad);
    rotulo(g, cx, alto - 6, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ---------- Balanza digital ----------
DEF.balanzaDigital = {
  nombre: 'Balanza digital',
  icono: '⚖️',
  categoria: 'Masa',
  magnitud: 'Masa',
  resumen: 'Muestra la masa en una pantalla. Su apreciación es la última cifra que puede mostrar.',
  comoSeLee: 'Se enciende en cero, se apoya el recipiente vacío, se pulsa TARA y recién ahí se agrega la muestra: lo que se lee es la masa de la muestra sola.',
  params: [
    P.max(500, 'Capacidad máxima de la balanza.'),
    P.division(0.1),
    P.unidad('g'),
    P.lectura(126.4),
    { clave: 'tara', etiqueta: 'Mostrar aviso de TARA', tipo: 'bool', def: false },
    P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const dec = decimalesDe(p.division);
    const lect = acotar(Math.round(p.lectura / (Number(p.division) || 0.1)) * (Number(p.division) || 0.1), -Number(p.max), Number(p.max));
    const g = grupo();
    const ancho = 460, alto = 300;

    g.appendChild(rect(40, 118, 380, 128, C.cuerpo, C.trazo, 2, { rx: 12 }));
    g.appendChild(rect(60, 92, 340, 30, C.metal, C.trazo, 1.8, { rx: 6 }));        // plato
    g.appendChild(rect(150, 74, 160, 20, C.metal, C.trazo, 1.4, { rx: 4 }));       // muestra
    pantallaLCD(g, 74, 140, 210, 62, fmt(lect, dec), p.unidad, { arriba: p.tara ? 'TARA' : null });
    // teclas
    ['ON', 'TARA', 'UNID'].forEach((t, i) => {
      g.appendChild(rect(304, 142 + i * 34, 92, 26, C.metal, C.trazo, 1.4, { rx: 5 }));
      g.appendChild(texto(350, 155 + i * 34, t, { tam: 10, peso: 700 }));
    });
    // patas
    g.appendChild(rect(66, 246, 26, 14, C.cuerpoOsc, C.trazo, 1.2, { rx: 3 }));
    g.appendChild(rect(368, 246, 26, 14, C.cuerpoOsc, C.trazo, 1.2, { rx: 3 }));

    g.appendChild(texto(230, 274, `Máx. ${fmt(p.max, 0)} ${p.unidad} · d = ${fmt(p.division, dec)} ${p.unidad}`, { tam: 11, color: C.suave }));
    rotulo(g, 230, 30, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ---------- Balanza granataria (tres brazos) ----------
DEF.granataria = {
  rangoAzar: [0, 610],
  nombre: 'Balanza de tres brazos',
  icono: '🏋️',
  categoria: 'Masa',
  magnitud: 'Masa',
  resumen: 'Balanza mecánica: se corren las pesas de los tres brazos hasta equilibrar el fiel.',
  comoSeLee: 'Se suman los tres brazos: centenas + decenas + el brazo delantero (con su parte decimal). El fiel tiene que quedar frente a la marca de cero.',
  params: [
    P.lectura(347.2),
    P.division(0.1),
    P.unidad('g'),
    ...P.marca(), P.mostrarValor(true), P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const div = Number(p.division) || 0.1;
    const dec = decimalesDe(div);
    const total = acotar(Math.round(p.lectura / div) * div, 0, 610);
    // Reparto entre brazos, como se hace de verdad: primero el de a 100.
    const b1 = Math.min(500, Math.floor(total / 100) * 100);
    const resto1 = total - b1;
    const b2 = Math.min(100, Math.floor(resto1 / 10) * 10);
    const b3 = Math.max(0, Math.min(10, resto1 - b2));
    const M = marcaCfg(p, total);
    const g = grupo();
    const ancho = 760, alto = 360;
    const xIni = 250, xFin = 620;

    // base, columna y platillo
    g.appendChild(svgEl('path', { d: 'M 40 330 L 220 330 L 205 306 L 55 306 Z', fill: C.metal, stroke: C.trazo, 'stroke-width': 1.8 }));
    g.appendChild(rect(120, 150, 30, 158, C.metalOsc, C.trazo, 1.8, { rx: 4 }));
    g.appendChild(svgEl('ellipse', { cx: 135, cy: 138, rx: 76, ry: 14, fill: C.metal, stroke: C.trazo, 'stroke-width': 1.8 }));
    g.appendChild(rect(120, 118, 30, 20, C.metalOsc, C.trazo, 1.4));
    g.appendChild(rect(96, 96, 78, 24, C.metal, C.trazo, 1.4, { rx: 4 }));   // muestra sobre el platillo

    // los tres brazos
    const brazos = [
      { y: 168, max: 500, paso: 100, valor: b1, etiqueta: '×100 g' },
      { y: 206, max: 100, paso: 10, valor: b2, etiqueta: '×10 g' },
      { y: 244, max: 10, paso: 1, valor: b3, etiqueta: '×1 g' }
    ];
    brazos.forEach(b => {
      g.appendChild(rect(xIni - 40, b.y - 9, (xFin - xIni) + 60, 18, C.metal, C.trazo, 1.5, { rx: 3 }));
      const xDe = v => xIni + (v / b.max) * (xFin - xIni);
      for (let v = 0; v <= b.max + 1e-9; v += b.paso) {
        const x = xDe(v);
        g.appendChild(linea(x, b.y - 9, x, b.y - 2, C.trazo, 1));
        g.appendChild(texto(x, b.y - 15, String(Math.round(v)), { tam: 9 }));
      }
      if (b.max === 10) {  // el brazo fino tiene rayitas de 0,1 g
        for (let v = 0; v <= 10; v += 0.1) {
          const x = xDe(v);
          g.appendChild(linea(x, b.y + 9, x, b.y + (Math.abs(v * 10 % 5) < 1e-6 ? 5 : 7) - 2, C.trazo, 0.6));
        }
      }
      // la pesa corrediza
      const xp = xDe(b.valor);
      g.appendChild(svgEl('path', {
        d: `M ${r2(xp - 13)} ${b.y - 16} L ${r2(xp + 13)} ${b.y - 16} L ${r2(xp + 9)} ${b.y + 14} L ${r2(xp - 9)} ${b.y + 14} Z`,
        fill: M.activa ? C.rojo : C.cuerpoOsc, stroke: C.trazo, 'stroke-width': 1.4
      }));
      g.appendChild(texto(xFin + 34, b.y, b.etiqueta, { tam: 10, peso: 700, ancla: 'start' }));
    });

    // fiel: cuelga del extremo de los brazos y tiene que quedar frente al cero
    const xf = xFin + 30;
    g.appendChild(linea(xf, 168, xf, 300, C.metalOsc, 2.5));
    g.appendChild(rect(xf + 4, 274, 22, 42, C.metal, C.trazo, 1.4, { rx: 3 }));
    [280, 294, 308].forEach((y, i) => g.appendChild(linea(xf + 4, y, xf + 26, y, C.trazo, i === 1 ? 1.6 : 0.8)));
    g.appendChild(texto(xf + 38, 294, '0', { tam: 11, peso: 700, ancla: 'start' }));
    g.appendChild(texto(xf + 15, 330, 'fiel', { tam: 10, color: C.suave, mono: false }));

    if (p.mostrarValor) {
      carteLectura(g, 20, 20, fmt(total, dec) + ' ' + p.unidad);
      g.appendChild(texto(20, 58, `${b1} + ${b2} + ${fmt(b3, dec)}`, { tam: 11, ancla: 'start', color: C.suave }));
    }
    rotulo(g, ancho - 10, alto - 12, p.etiqueta, 'end');
    return { g, ancho, alto };
  }
};

// ---------- Cronómetro ----------
DEF.cronometro = {
  rangoAzar: [1, 180],
  nombre: 'Cronómetro digital',
  icono: '⏱️',
  categoria: 'Tiempo',
  magnitud: 'Tiempo',
  resumen: 'Mide intervalos de tiempo. Su resolución suele ser la centésima de segundo.',
  comoSeLee: 'Aunque muestre centésimas, el tiempo de reacción de quien lo aprieta ronda las 2 décimas: por eso conviene cronometrar varias veces y promediar.',
  params: [
    P.lectura(12.47),
    { clave: 'resolucion', etiqueta: 'Resolución', tipo: 'opcion', def: 0.01, opciones: [{ v: 0.01, t: 'Centésimas (0,01 s)' }, { v: 0.1, t: 'Décimas (0,1 s)' }, { v: 1, t: 'Segundos' }] },
    { clave: 'formato', etiqueta: 'Formato', tipo: 'opcion', def: 'reloj', opciones: [{ v: 'reloj', t: 'mm:ss,cc' }, { v: 'segundos', t: 'Sólo segundos' }] },
    { clave: 'vuelta', etiqueta: 'Mostrar aviso de VUELTA', tipo: 'bool', def: false },
    P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const res = Number(p.resolucion) || 0.01;
    const t = Math.max(0, Math.round(Number(p.lectura) / res) * res);
    const dec = decimalesDe(res);
    let valor;
    if (p.formato === 'segundos') {
      valor = fmt(t, dec) + ' s';
    } else {
      const min = Math.floor(t / 60);
      const seg = t - min * 60;
      valor = String(min).padStart(2, '0') + ':' + (seg < 10 ? '0' : '') + fmt(seg, dec);
    }
    const g = grupo();
    const ancho = 380, alto = 340;

    g.appendChild(rect(70, 60, 240, 230, C.cuerpoOsc, C.trazo, 2, { rx: 26 }));
    g.appendChild(rect(120, 34, 40, 30, C.metal, C.trazo, 1.6, { rx: 6 }));    // pulsador
    g.appendChild(rect(220, 34, 40, 30, C.metal, C.trazo, 1.6, { rx: 6 }));
    pantallaLCD(g, 96, 100, 188, 78, valor, null, { tamNum: 34, arriba: p.vuelta ? 'VUELTA' : null });
    ['START', 'STOP', 'RESET'].forEach((txt, i) => {
      g.appendChild(rect(96 + i * 64, 208, 56, 34, C.metal, C.trazo, 1.4, { rx: 6 }));
      g.appendChild(texto(124 + i * 64, 225, txt, { tam: 9, peso: 700 }));
    });
    g.appendChild(texto(190, 312, `Resolución ${fmt(res, dec)} s`, { tam: 11, color: C.suave }));
    rotulo(g, 190, 20, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ---------- Multímetro digital ----------
// Las posiciones de la llave selectora, en el orden en que aparecen en el
// aparato. Cada una define qué mide, en qué unidad, con cuántos dígitos y por
// qué borne tiene que entrar la punta roja: es la información que hace falta
// para que el dibujo muestre el instrumento realmente configurado.
export const FUNCIONES_MULTIMETRO = [
  { id: 'off', t: 'Apagado (OFF)', rotulo: 'OFF', grupo: '', unidad: '', dec: 0, borne: 'VmA' },

  { id: 'Vcc200m', t: 'Tensión continua · 200 mV', rotulo: '200m', grupo: 'V⎓', unidad: 'mV', dec: 1, modo: 'DC', borne: 'VmA' },
  { id: 'Vcc2', t: 'Tensión continua · 2 V', rotulo: '2', grupo: 'V⎓', unidad: 'V', dec: 3, modo: 'DC', borne: 'VmA' },
  { id: 'Vcc20', t: 'Tensión continua · 20 V', rotulo: '20', grupo: 'V⎓', unidad: 'V', dec: 2, modo: 'DC', borne: 'VmA' },
  { id: 'Vcc200', t: 'Tensión continua · 200 V', rotulo: '200', grupo: 'V⎓', unidad: 'V', dec: 1, modo: 'DC', borne: 'VmA' },
  { id: 'Vcc600', t: 'Tensión continua · 600 V', rotulo: '600', grupo: 'V⎓', unidad: 'V', dec: 0, modo: 'DC', borne: 'VmA' },

  { id: 'Vca200', t: 'Tensión alterna · 200 V', rotulo: '200', grupo: 'V∼', unidad: 'V', dec: 1, modo: 'AC', borne: 'VmA' },
  { id: 'Vca600', t: 'Tensión alterna · 600 V', rotulo: '600', grupo: 'V∼', unidad: 'V', dec: 0, modo: 'AC', borne: 'VmA' },

  { id: 'ohm200', t: 'Resistencia · 200 Ω', rotulo: '200', grupo: 'Ω', unidad: 'Ω', dec: 1, borne: 'VmA' },
  { id: 'ohm2k', t: 'Resistencia · 2 kΩ', rotulo: '2k', grupo: 'Ω', unidad: 'kΩ', dec: 3, borne: 'VmA' },
  { id: 'ohm20k', t: 'Resistencia · 20 kΩ', rotulo: '20k', grupo: 'Ω', unidad: 'kΩ', dec: 2, borne: 'VmA' },
  { id: 'ohm200k', t: 'Resistencia · 200 kΩ', rotulo: '200k', grupo: 'Ω', unidad: 'kΩ', dec: 1, borne: 'VmA' },
  { id: 'ohm2M', t: 'Resistencia · 2 MΩ', rotulo: '2M', grupo: 'Ω', unidad: 'MΩ', dec: 3, borne: 'VmA' },

  { id: 'cont', t: 'Continuidad (pitido)', rotulo: '•)))', grupo: 'prueba', unidad: 'Ω', dec: 1, borne: 'VmA' },
  { id: 'diodo', t: 'Prueba de diodo', rotulo: '▶⊦', grupo: 'prueba', unidad: 'V', dec: 3, borne: 'VmA' },
  { id: 'hfe', t: 'Ganancia de transistor (hFE)', rotulo: 'hFE', grupo: 'prueba', unidad: '', dec: 0, borne: 'VmA' },

  { id: 'cap', t: 'Capacidad · nF', rotulo: 'nF', grupo: 'C · f · °', unidad: 'nF', dec: 1, borne: 'VmA' },
  { id: 'capu', t: 'Capacidad · µF', rotulo: 'µF', grupo: 'C · f · °', unidad: 'µF', dec: 2, borne: 'VmA' },
  { id: 'frec', t: 'Frecuencia', rotulo: 'Hz', grupo: 'C · f · °', unidad: 'Hz', dec: 1, borne: 'VmA' },
  { id: 'temp', t: 'Temperatura (termopar)', rotulo: '°C', grupo: 'C · f · °', unidad: '°C', dec: 0, borne: 'VmA' },

  { id: 'Aca200m', t: 'Corriente alterna · 200 mA', rotulo: '200m', grupo: 'A∼', unidad: 'mA', dec: 1, modo: 'AC', borne: 'VmA' },
  { id: 'Acc200u', t: 'Corriente continua · 200 µA', rotulo: '200µ', grupo: 'A⎓', unidad: 'µA', dec: 1, modo: 'DC', borne: 'VmA' },
  { id: 'Acc2m', t: 'Corriente continua · 2 mA', rotulo: '2m', grupo: 'A⎓', unidad: 'mA', dec: 3, modo: 'DC', borne: 'VmA' },
  { id: 'Acc20m', t: 'Corriente continua · 20 mA', rotulo: '20m', grupo: 'A⎓', unidad: 'mA', dec: 2, modo: 'DC', borne: 'VmA' },
  { id: 'Acc200m', t: 'Corriente continua · 200 mA', rotulo: '200m', grupo: 'A⎓', unidad: 'mA', dec: 1, modo: 'DC', borne: 'VmA' },
  { id: 'Acc10', t: 'Corriente continua · 10 A', rotulo: '10A', grupo: 'A⎓', unidad: 'A', dec: 2, modo: 'DC', borne: '10A' }
];

// Nombres cortos de la versión anterior, para que un protocolo ya guardado
// siga abriendo en la posición que le corresponde.
const ALIAS_MULTIMETRO = {
  Vcc: 'Vcc20', Vca: 'Vca200', Acc: 'Acc10', mA: 'Acc200m', ohm: 'ohm2k', cap: 'cap'
};

export function funcionMultimetro(id) {
  for (let i = 0; i < FUNCIONES_MULTIMETRO.length; i++) {
    if (FUNCIONES_MULTIMETRO[i].id === id) return FUNCIONES_MULTIMETRO[i];
  }
  return FUNCIONES_MULTIMETRO[3];   // 20 V continua, el que más se usa en clase
}

DEF.multimetro = {
  rangoAzar: [0, 12],
  nombre: 'Multímetro digital',
  icono: '🔌',
  categoria: 'Electricidad',
  magnitud: 'Tensión, corriente, resistencia y más',
  resumen: 'La llave selectora decide qué mide y en qué rango: tensión y corriente continua o alterna, resistencia, continuidad, diodo, capacidad, frecuencia, hFE y temperatura.',
  comoSeLee: 'Primero se elige la función y un rango mayor al valor esperado, y se va bajando de rango hasta que la pantalla dé la mayor cantidad de cifras sin marcar sobrerango (un 1 solo a la izquierda). Para medir corriente el multímetro va en serie y la punta roja cambia de borne; para tensión y resistencia va en paralelo.',
  params: [
    { clave: 'funcion', etiqueta: 'Posición de la llave', tipo: 'opcion', def: 'Vcc20',
      ayuda: 'Es la función y el rango juntos, igual que en el aparato. La pantalla toma de acá la unidad y la cantidad de decimales.',
      alias: ALIAS_MULTIMETRO,
      opciones: FUNCIONES_MULTIMETRO.map(f => ({ v: f.id, t: (f.grupo ? f.grupo + ' — ' : '') + f.t })) },
    P.lectura(9.06),
    { clave: 'unidad', etiqueta: 'Unidad (vacío = la del rango)', tipo: 'texto', def: '', ayuda: 'Normalmente dejalo vacío: la toma de la posición de la llave.' },
    { clave: 'decimales', etiqueta: 'Decimales', tipo: 'opcion', def: -1, ayuda: '«Automático» usa los que corresponden al rango elegido.', opciones: [
      { v: -1, t: 'Automático (según el rango)' }, { v: 0, t: '0' }, { v: 1, t: '1' }, { v: 2, t: '2' }, { v: 3, t: '3' }
    ] },
    { clave: 'sobrerango', etiqueta: 'Mostrar sobrerango (fuera de escala)', tipo: 'bool', def: false, ayuda: 'La pantalla muestra sólo un 1 a la izquierda: hay que subir de rango.' },
    { clave: 'hold', etiqueta: 'Aviso de HOLD (valor congelado)', tipo: 'bool', def: false },
    { clave: 'puntas', etiqueta: 'Dibujar las puntas de prueba', tipo: 'bool', def: true, ayuda: 'La punta roja se dibuja en el borne que corresponde a la función elegida.' },
    P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const f = funcionMultimetro(p.funcion);
    const dec = Number(p.decimales) >= 0 ? Number(p.decimales) : f.dec;
    const unidad = String(p.unidad || '').trim() || f.unidad;
    const apagado = f.id === 'off';
    const g = grupo();
    const ancho = 460, alto = 660;

    g.appendChild(rect(40, 30, 380, 580, C.cuerpo, C.trazo, 2.4, { rx: 24 }));
    g.appendChild(rect(52, 42, 356, 556, 'none', C.tenue, 1, { rx: 18 }));

    // pantalla: lo que muestra depende de la posición de la llave
    let valor = '';
    if (apagado) valor = '';
    else if (p.sobrerango) valor = '1';
    else if (f.id === 'cont') valor = fmt(p.lectura, dec) + '  •)))';
    else valor = fmt(p.lectura, dec);
    const arriba = [f.grupo && f.grupo !== 'prueba' ? f.grupo + ' ' + f.rotulo : f.t, f.modo || '', p.hold ? 'HOLD' : '']
      .filter(Boolean).join('   ');
    pantallaLCD(g, 78, 72, 304, 100, valor, apagado ? '' : unidad, { tamNum: 46, arriba: apagado ? '' : arriba });

    // ---- llave selectora ----
    const cx = 230, cy = 372, R = 118;
    g.appendChild(svgEl('circle', { cx, cy, r: R + 34, fill: 'none', stroke: C.tenue, 'stroke-width': 1 }));
    g.appendChild(svgEl('circle', { cx, cy, r: 54, fill: C.cuerpoOsc, stroke: C.trazo, 'stroke-width': 2 }));
    const n = FUNCIONES_MULTIMETRO.length;
    const paso = 360 / n;
    const rad = a => (a - 90) * Math.PI / 180;
    const punto = (a, r) => ({ x: cx + Math.cos(rad(a)) * r, y: cy + Math.sin(rad(a)) * r });

    // el rótulo del grupo (V⎓, Ω, A⎓…) se pone en el medio de sus posiciones
    const gruposVistos = {};
    FUNCIONES_MULTIMETRO.forEach((fn, i) => {
      if (!fn.grupo) return;
      (gruposVistos[fn.grupo] = gruposVistos[fn.grupo] || []).push(i);
    });
    Object.keys(gruposVistos).forEach(nombre => {
      const idx = gruposVistos[nombre];
      const a = (idx[0] + idx[idx.length - 1]) / 2 * paso;
      const q = punto(a, R + 22);
      const activo = f.grupo === nombre;
      g.appendChild(texto(q.x, q.y, nombre, { tam: 14, peso: 700, color: activo ? C.rojo : C.trazo, mono: false }));
    });

    FUNCIONES_MULTIMETRO.forEach((fn, i) => {
      const a = i * paso;
      const activa = fn.id === f.id;
      const marca = punto(a, R - 26);
      g.appendChild(svgEl('circle', { cx: r2(marca.x), cy: r2(marca.y), r: activa ? 4.5 : 3, fill: activa ? C.rojo : C.trazo }));
      const rot = punto(a, R - 6);
      g.appendChild(texto(rot.x, rot.y, fn.rotulo, { tam: fn.rotulo.length > 3 ? 8 : 9.5, peso: activa ? 700 : 400, color: activa ? C.rojo : C.trazo }));
      if (activa) {
        const p1 = punto(a, 52);
        g.appendChild(linea(cx, cy, p1.x, p1.y, C.rojo, 7, { 'stroke-linecap': 'round' }));
      }
    });
    g.appendChild(svgEl('circle', { cx, cy, r: 10, fill: C.metal, stroke: C.trazo, 'stroke-width': 1.4 }));

    // ---- bornes ----
    const yB = 546;
    const bornes = [
      { id: 'COM', x: 120, t: 'COM', c: '#222' },
      { id: 'VmA', x: 230, t: 'VΩmA', c: C.rojo },
      { id: '10A', x: 340, t: '10A', c: '#c98b2b' }
    ];
    bornes.forEach(b => {
      const usado = !apagado && (b.id === 'COM' || b.id === f.borne);
      g.appendChild(svgEl('circle', { cx: b.x, cy: yB, r: 17, fill: C.metal, stroke: b.c, 'stroke-width': usado ? 4 : 2.4 }));
      g.appendChild(svgEl('circle', { cx: b.x, cy: yB, r: 6, fill: C.cuerpoOsc }));
      g.appendChild(texto(b.x, yB + 32, b.t, { tam: 10, peso: usado ? 700 : 400 }));
    });
    if (p.puntas) {
      // la punta roja sale del borne que pide la función elegida
      const xRojo = f.borne === '10A' ? 340 : 230;
      g.appendChild(svgEl('path', { d: `M 120 ${yB + 17} C 90 ${alto - 50} 46 ${alto - 40} 26 ${alto - 8}`, fill: 'none', stroke: '#222', 'stroke-width': 4 }));
      g.appendChild(svgEl('path', { d: `M ${xRojo} ${yB + 17} C ${xRojo + 40} ${alto - 50} ${ancho - 84} ${alto - 40} ${ancho - 26} ${alto - 8}`, fill: 'none', stroke: C.rojo, 'stroke-width': 4 }));
    }
    rotulo(g, 230, 606, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ---------- Instrumento analógico de aguja (voltímetro, amperímetro, manómetro…) ----------
DEF.aguja = {
  nombre: 'Instrumento de aguja',
  icono: '🎛️',
  categoria: 'Electricidad',
  magnitud: 'Configurable',
  resumen: 'Escala en arco con aguja: sirve de voltímetro, amperímetro, galvanómetro, manómetro o barómetro.',
  comoSeLee: 'Se mira de frente (si tiene espejo, tapando el reflejo de la aguja con la aguja misma) y se lee la marca donde cae la punta. Entre dos rayitas se estima la última cifra.',
  params: [
    { clave: 'forma', etiqueta: 'Forma del instrumento', tipo: 'opcion', def: 'rect', opciones: [{ v: 'rect', t: 'Cuadro de laboratorio' }, { v: 'redondo', t: 'Esfera redonda (manómetro)' }] },
    { clave: 'simbolo', etiqueta: 'Símbolo grande', tipo: 'texto', def: 'V', ayuda: 'V, A, mA, Ω, bar, kPa… Es el cartel que va debajo de la escala.' },
    P.min(0), P.max(15), P.division(0.25), P.numerarCada(5), P.unidad('V'),
    P.lectura(9.4),
    { clave: 'espejo', etiqueta: 'Escala con espejo antiparalaje', tipo: 'bool', def: true },
    { clave: 'cero', etiqueta: 'Cero en el centro', tipo: 'bool', def: false, ayuda: 'Para galvanómetros que miden en los dos sentidos.' },
    ...P.marca(), P.mostrarValor(true), P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const redondo = p.forma === 'redondo';
    const min = p.cero ? -Math.abs(Number(p.max)) : Number(p.min);
    const max = Number(p.max);
    const rango = Math.max(0.0001, max - min);
    const lect = acotar(p.lectura, min, max);
    const apertura = redondo ? 270 : 108;                 // grados que abarca la escala
    const g = grupo();
    const ancho = redondo ? 420 : 460, alto = redondo ? 430 : 410;
    const cx = ancho / 2;
    const cy = redondo ? 210 : 320;                       // pivote de la aguja
    const R = redondo ? 150 : 210;

    const ang = v => (-apertura / 2 + ((v - min) / rango) * apertura) * Math.PI / 180;
    const pt = (v, r) => ({ x: cx + Math.sin(ang(v)) * r, y: cy - Math.cos(ang(v)) * r });
    const M = marcaCfg(p, lect);

    // caja
    if (redondo) {
      g.appendChild(svgEl('circle', { cx, cy: 210, r: 196, fill: C.cuerpo, stroke: C.trazo, 'stroke-width': 3 }));
      g.appendChild(svgEl('circle', { cx, cy: 210, r: 178, fill: '#ffffff', stroke: C.tenue, 'stroke-width': 1.4 }));
    } else {
      g.appendChild(rect(20, 20, ancho - 40, alto - 40, C.cuerpo, C.trazo, 3, { rx: 14 }));
      g.appendChild(rect(38, 38, ancho - 76, alto - 116, '#ffffff', C.tenue, 1.4, { rx: 8 }));
    }

    // arco de la escala
    const a0 = pt(min, R), a1 = pt(max, R);
    g.appendChild(svgEl('path', {
      d: `M ${r2(a0.x)} ${r2(a0.y)} A ${R} ${R} 0 ${apertura > 180 ? 1 : 0} 1 ${r2(a1.x)} ${r2(a1.y)}`,
      fill: 'none', stroke: C.trazo, 'stroke-width': 1.6
    }));
    if (p.espejo) {
      const b0 = pt(min, R - 16), b1 = pt(max, R - 16);
      g.appendChild(svgEl('path', {
        d: `M ${r2(b0.x)} ${r2(b0.y)} A ${R - 16} ${R - 16} 0 ${apertura > 180 ? 1 : 0} 1 ${r2(b1.x)} ${r2(b1.y)}`,
        fill: 'none', stroke: '#b9c9d1', 'stroke-width': 8
      }));
    }

    const decNum = decimalesDe(p.numerarCada);
    marcasLineales(min, max, p.division, p.numerarCada).forEach(m => {
      const l = m.tipo === 'mayor' ? 20 : m.tipo === 'media' ? 13 : 8;
      const a = pt(m.v, R), b = pt(m.v, R - l);
      g.appendChild(linea(a.x, a.y, b.x, b.y, C.trazo, m.tipo === 'mayor' ? 1.8 : 1));
      if (m.tipo === 'mayor') {
        const t = pt(m.v, R - l - 16);
        g.appendChild(texto(t.x, t.y, fmt(m.v, decNum), { tam: 13, peso: 500 }));
      }
    });

    // símbolo, unidad y aguja
    const yTexto = redondo ? cy + 62 : cy - 92;
    g.appendChild(texto(cx, yTexto, p.simbolo, { tam: 30, peso: 700, mono: false }));
    g.appendChild(texto(cx, yTexto + 26, p.unidad, { tam: 13, color: C.suave }));

    const punta = pt(lect, R - 6);
    const cola = pt(lect, -12);
    g.appendChild(linea(cola.x, cola.y, punta.x, punta.y, M.activa ? C.rojo : C.trazo, 2.6, { 'stroke-linecap': 'round' }));
    g.appendChild(svgEl('circle', { cx, cy, r: 12, fill: C.cuerpoOsc, stroke: C.trazo, 'stroke-width': 1.6 }));

    if (!redondo) {
      // bornes del cuadro
      g.appendChild(svgEl('circle', { cx: 74, cy: alto - 62, r: 13, fill: C.metal, stroke: '#222', 'stroke-width': 2.5 }));
      g.appendChild(texto(74, alto - 38, '−', { tam: 15, peso: 700 }));
      g.appendChild(svgEl('circle', { cx: ancho - 74, cy: alto - 62, r: 13, fill: C.metal, stroke: C.rojo, 'stroke-width': 2.5 }));
      g.appendChild(texto(ancho - 74, alto - 38, '+', { tam: 15, peso: 700 }));
    }
    if (p.mostrarValor) carteLectura(g, redondo ? 12 : 30, redondo ? 12 : 30, fmt(lect, decimalesDe(p.division)) + ' ' + p.unidad);
    rotulo(g, cx, alto - 8, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ---------- Transportador / goniómetro ----------
DEF.transportador = {
  nombre: 'Transportador',
  icono: '📐',
  categoria: 'Ángulo',
  magnitud: 'Ángulo',
  resumen: 'Semicírculo graduado en grados, con doble numeración.',
  comoSeLee: 'El centro va en el vértice del ángulo y la base sobre uno de sus lados. Se lee la escala que empieza en cero sobre ese lado.',
  params: [
    P.max(180, 'Suele ser 180° (semicírculo) o 360°.'),
    P.division(1), P.numerarCada(10), P.unidad('°'),
    P.lectura(52),
    { clave: 'dobleEscala', etiqueta: 'Doble numeración (0→180 y 180→0)', tipo: 'bool', def: true },
    { clave: 'brazo', etiqueta: 'Dibujar el brazo del ángulo', tipo: 'bool', def: true },
    ...P.marca(), P.mostrarValor(true), P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const max = acotar(p.max, 10, 360);
    const lect = acotar(p.lectura, 0, max);
    const g = grupo();
    const R = 230;
    const completo = max > 200;
    const ancho = 2 * R + 80, alto = completo ? 2 * R + 80 : R + 110;
    const cx = ancho / 2, cy = completo ? alto / 2 : R + 40;
    const rad = a => Math.PI * (180 - a) / 180;
    const pt = (a, r) => ({ x: cx + Math.cos(rad(a)) * r, y: cy - Math.sin(rad(a)) * r });
    const M = marcaCfg(p, lect);

    // cuerpo translúcido
    if (completo) {
      g.appendChild(svgEl('circle', { cx, cy, r: R, fill: 'rgba(58,163,216,0.10)', stroke: C.trazo, 'stroke-width': 2 }));
    } else {
      g.appendChild(svgEl('path', { d: `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy} Z`, fill: 'rgba(58,163,216,0.10)', stroke: C.trazo, 'stroke-width': 2 }));
    }
    g.appendChild(linea(cx - R, cy, cx + R, cy, C.trazo, 1.6));

    marcasLineales(0, max, p.division, p.numerarCada).forEach(m => {
      const l = m.tipo === 'mayor' ? 24 : m.tipo === 'media' ? 15 : 9;
      const a = pt(m.v, R), b = pt(m.v, R - l);
      g.appendChild(linea(a.x, a.y, b.x, b.y, C.trazo, m.tipo === 'mayor' ? 1.5 : 0.8));
      if (m.tipo === 'mayor') {
        const t = pt(m.v, R - l - 14);
        g.appendChild(texto(t.x, t.y, String(Math.round(m.v)), { tam: 12 }));
        if (p.dobleEscala && !completo) {
          const t2 = pt(m.v, R - l - 36);
          g.appendChild(texto(t2.x, t2.y, String(Math.round(max - m.v)), { tam: 10, color: C.suave }));
        }
      }
    });

    if (p.brazo) {
      // El lado fijo apoya sobre el cero de la escala principal (a la izquierda)
      // y el móvil marca la lectura: el ángulo que se ve es el que dice el cartel.
      const b = pt(lect, R - 6);
      g.appendChild(linea(cx, cy, cx - R + 6, cy, C.trazo, 3));
      g.appendChild(linea(cx, cy, b.x, b.y, M.activa ? C.rojo : C.trazo, 3));
      const a1 = pt(0, 56), a2 = pt(lect, 56);
      g.appendChild(svgEl('path', { d: `M ${r2(a1.x)} ${r2(a1.y)} A 56 56 0 ${lect > 180 ? 1 : 0} 1 ${r2(a2.x)} ${r2(a2.y)}`, fill: 'none', stroke: C.rojo, 'stroke-width': 1.4, 'stroke-dasharray': '4 3' }));
    }
    g.appendChild(svgEl('circle', { cx, cy, r: 5, fill: C.trazo }));
    if (p.mostrarValor) carteLectura(g, 10, 10, fmt(lect, decimalesDe(p.division)) + p.unidad);
    rotulo(g, cx, alto - 8, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ---------- Sensor digital genérico ----------
DEF.sensorDigital = {
  rangoAzar: [0, 14],
  nombre: 'Sensor digital (pH, lux, dB…)',
  icono: '📟',
  categoria: 'Otros',
  magnitud: 'Configurable',
  resumen: 'Pantalla digital genérica: se le pone la magnitud, la unidad y los decimales que haga falta.',
  comoSeLee: 'Se anota la lectura con todos los dígitos que muestra la pantalla; la incertidumbre es la última cifra (o la que indique el fabricante).',
  params: [
    { clave: 'magnitud', etiqueta: 'Qué mide', tipo: 'texto', def: 'pH' },
    P.unidad(''),
    P.lectura(7.42),
    { clave: 'decimales', etiqueta: 'Decimales', tipo: 'opcion', def: 2, opciones: [{ v: 0, t: '0' }, { v: 1, t: '1' }, { v: 2, t: '2' }, { v: 3, t: '3' }] },
    { clave: 'sonda', etiqueta: 'Dibujar la sonda', tipo: 'bool', def: true },
    P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const g = grupo();
    const ancho = 360, alto = 420;
    g.appendChild(rect(60, 40, 240, 260, C.cuerpo, C.trazo, 2.2, { rx: 18 }));
    g.appendChild(texto(180, 72, p.magnitud || '', { tam: 15, peso: 700, mono: false }));
    pantallaLCD(g, 86, 92, 188, 86, fmt(p.lectura, Number(p.decimales)), p.unidad, { tamNum: 42 });
    ['ON', 'HOLD', 'CAL'].forEach((t, i) => {
      g.appendChild(rect(88 + i * 64, 210, 56, 30, C.metal, C.trazo, 1.4, { rx: 6 }));
      g.appendChild(texto(116 + i * 64, 225, t, { tam: 10, peso: 700 }));
    });
    if (p.sonda) {
      g.appendChild(svgEl('path', { d: 'M 180 300 C 180 340 120 340 116 372', fill: 'none', stroke: '#222', 'stroke-width': 4 }));
      g.appendChild(rect(100, 372, 32, 40, C.metalOsc, C.trazo, 1.6, { rx: 5 }));
      g.appendChild(svgEl('circle', { cx: 116, cy: 412, r: 7, fill: C.vidrio, stroke: C.vidrioBorde, 'stroke-width': 1.6 }));
    }
    rotulo(g, 180, 322, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ---------- micro:bit con sensores conectados ----------

// Lo que se puede colgar de los pines de cocodrilo. Cada entrada dice si
// entrega una medida (sensor) o si recibe una orden (actuador), porque eso
// cambia lo que el estudiante tiene que anotar.
export const CONEXIONES_MICROBIT = [
  { id: '', t: '— sin conectar —' },
  { id: 'ldr', t: 'LDR (fotorresistencia)', clase: 'sensor', magnitud: 'Luz', unidad: '' },
  { id: 'ntc', t: 'Termistor NTC', clase: 'sensor', magnitud: 'Temperatura', unidad: '°C' },
  { id: 'pot', t: 'Potenciómetro', clase: 'sensor', magnitud: 'Posición', unidad: '' },
  { id: 'humedad', t: 'Sensor de humedad de suelo', clase: 'sensor', magnitud: 'Humedad', unidad: '' },
  { id: 'ultrasonido', t: 'Ultrasonido HC-SR04', clase: 'sensor', magnitud: 'Distancia', unidad: 'cm' },
  { id: 'dht11', t: 'DHT11 (temperatura y humedad)', clase: 'sensor', magnitud: 'Temperatura', unidad: '°C' },
  { id: 'sonido', t: 'Micrófono / sensor de sonido', clase: 'sensor', magnitud: 'Sonido', unidad: '' },
  { id: 'llama', t: 'Sensor de llama', clase: 'sensor', magnitud: 'Llama', unidad: '' },
  { id: 'hall', t: 'Sensor Hall (campo magnético)', clase: 'sensor', magnitud: 'Campo', unidad: '' },
  { id: 'infra', t: 'Sensor infrarrojo de obstáculo', clase: 'sensor', magnitud: 'Obstáculo', unidad: '' },
  { id: 'boton', t: 'Pulsador externo', clase: 'sensor', magnitud: 'Estado', unidad: '' },
  { id: 'lluvia', t: 'Sensor de lluvia', clase: 'sensor', magnitud: 'Agua', unidad: '' },
  { id: 'led', t: 'LED', clase: 'actuador' },
  { id: 'zumbador', t: 'Zumbador (buzzer)', clase: 'actuador' },
  { id: 'servo', t: 'Servomotor', clase: 'actuador' },
  { id: 'motor', t: 'Motor con driver', clase: 'actuador' },
  { id: 'rele', t: 'Relé', clase: 'actuador' }
];

export const SENSORES_INTERNOS_MICROBIT = [
  { id: '', t: '— ninguno —', unidad: '' },
  { id: 'acel', t: 'Acelerómetro', magnitud: 'Aceleración', unidad: 'mg' },
  { id: 'brujula', t: 'Brújula (magnetómetro)', magnitud: 'Rumbo', unidad: '°' },
  { id: 'temp', t: 'Temperatura del chip', magnitud: 'Temperatura', unidad: '°C' },
  { id: 'luz', t: 'Nivel de luz (matriz de LED)', magnitud: 'Luz', unidad: '' },
  { id: 'micro', t: 'Micrófono (v2)', magnitud: 'Sonido', unidad: 'dB' },
  { id: 'tacto', t: 'Logo táctil (v2)', magnitud: 'Contacto', unidad: '' }
];

function conexionMicrobit(id) {
  for (let i = 0; i < CONEXIONES_MICROBIT.length; i++) if (CONEXIONES_MICROBIT[i].id === id) return CONEXIONES_MICROBIT[i];
  return CONEXIONES_MICROBIT[0];
}

// Dibujos de la matriz de 5×5, como cadenas de 25 unos y ceros.
const MATRICES = {
  vacia: '0000000000000000000000000',
  corazon: '0101011111111110111000100',
  si: '0000000001000101010000000',
  no: '1000101010001000101010001',
  flecha: '0010001110101010010000100',
  cuadro: '1111110001100011000111111',
  numero: null      // se arma con el dígito de la lectura
};

// Dígitos de 3×5 para poder escribir un número en la matriz.
const DIGITOS_MATRIZ = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111',
  4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001001001',
  8: '111101111101111', 9: '111101111001111'
};

DEF.microbit = {
  rangoAzar: [0, 100],
  nombre: 'micro:bit con sensores',
  icono: '🔬',
  categoria: 'Electrónica',
  magnitud: 'Configurable',
  resumen: 'La placa micro:bit con lo que se le conecta a los pines 0, 1 y 2, y el valor que muestra.',
  comoSeLee: 'La placa no tiene escala: el valor sale de lo que programaste. Conviene anotar siempre qué sensor está en qué pin y qué unidad devuelve, porque muchos sensores entregan un número sin unidad (0 a 1023) que hay que calibrar contra un instrumento de verdad antes de usarlo como medida.',
  params: [
    { clave: 'pin0', etiqueta: 'Conectado al pin 0', tipo: 'opcion', def: 'ldr', opciones: CONEXIONES_MICROBIT.map(c => ({ v: c.id, t: c.t })) },
    { clave: 'pin1', etiqueta: 'Conectado al pin 1', tipo: 'opcion', def: '', opciones: CONEXIONES_MICROBIT.map(c => ({ v: c.id, t: c.t })) },
    { clave: 'pin2', etiqueta: 'Conectado al pin 2', tipo: 'opcion', def: '', opciones: CONEXIONES_MICROBIT.map(c => ({ v: c.id, t: c.t })) },
    { clave: 'interno', etiqueta: 'Sensor interno que se usa', tipo: 'opcion', def: '', opciones: SENSORES_INTERNOS_MICROBIT.map(s => ({ v: s.id, t: s.t })) },
    { clave: 'matriz', etiqueta: 'Qué muestra la matriz de LED', tipo: 'opcion', def: 'numero', opciones: [
      { v: 'numero', t: 'El número de la lectura' }, { v: 'corazon', t: 'Corazón' }, { v: 'si', t: 'Tilde (correcto)' },
      { v: 'no', t: 'Cruz (incorrecto)' }, { v: 'flecha', t: 'Flecha' }, { v: 'cuadro', t: 'Cuadro' }, { v: 'vacia', t: 'Apagada' }
    ] },
    { clave: 'magnitud', etiqueta: 'Qué se está midiendo', tipo: 'texto', def: 'Luz', ayuda: 'Aparece debajo del valor: Luz, Distancia, Temperatura…' },
    P.lectura(742),
    P.unidad(''),
    { clave: 'decimales', etiqueta: 'Decimales', tipo: 'opcion', def: 0, opciones: [{ v: 0, t: '0' }, { v: 1, t: '1' }, { v: 2, t: '2' }, { v: 3, t: '3' }] },
    { clave: 'mostrarCables', etiqueta: 'Dibujar los cables y los sensores', tipo: 'bool', def: true },
    { clave: 'alimentacion', etiqueta: 'Alimentación', tipo: 'opcion', def: 'pilas', opciones: [
      { v: 'pilas', t: 'Porta-pilas' }, { v: 'usb', t: 'Cable USB' }, { v: 'nada', t: 'Sin dibujar' }
    ] },
    P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const g = grupo();
    const conectados = ['pin0', 'pin1', 'pin2']
      .map((k, i) => ({ pin: i, c: conexionMicrobit(p[k]) }))
      .filter(x => x.c.id);
    const conCables = p.mostrarCables && conectados.length;
    const ancho = 760, alto = conCables ? 560 : 430;

    // ---- la placa ----
    const px = 60, py = 60, pw = 400, ph = 250;
    g.appendChild(svgEl('path', {
      // contorno con las "orejas" del conector de borde abajo
      d: `M ${px + 16} ${py} L ${px + pw - 16} ${py} Q ${px + pw} ${py} ${px + pw} ${py + 16}
          L ${px + pw} ${py + ph - 40} L ${px + pw - 40} ${py + ph} L ${px + 40} ${py + ph}
          L ${px} ${py + ph - 40} L ${px} ${py + 16} Q ${px} ${py} ${px + 16} ${py} Z`,
      fill: '#1c8f6b', stroke: C.trazo, 'stroke-width': 2, 'stroke-linejoin': 'round'
    }));

    // matriz de 5×5
    let patron = MATRICES[p.matriz] || MATRICES.vacia;
    if (p.matriz === 'numero') {
      // La micro:bit hace desfilar el número dígito por dígito: el dibujo
      // congela el primero, que es el que se ve al empezar.
      const d = String(Math.abs(Math.round(Number(p.lectura))))[0] || '0';
      const dig = DIGITOS_MATRIZ[d] || DIGITOS_MATRIZ[0];
      let fila = '';
      for (let f = 0; f < 5; f++) fila += '0' + dig.slice(f * 3, f * 3 + 3) + '0';
      patron = fila;
    }
    const mx = px + 128, my = py + 42, paso = 30;
    for (let f = 0; f < 5; f++) {
      for (let c = 0; c < 5; c++) {
        const on = patron[f * 5 + c] === '1';
        g.appendChild(rect(mx + c * paso, my + f * paso, 13, 20,
          on ? '#ff2d2d' : '#5c2020', on ? '#ff8a8a' : null, on ? 1 : 0, { rx: 2 }));
      }
    }

    // botones A y B
    [{ x: px + 34, t: 'A' }, { x: px + pw - 66, t: 'B' }].forEach(b => {
      g.appendChild(rect(b.x, py + 92, 32, 32, '#2b2b2b', C.trazo, 1.6, { rx: 4 }));
      g.appendChild(svgEl('circle', { cx: b.x + 16, cy: py + 108, r: 9, fill: '#e8e8e8' }));
      g.appendChild(texto(b.x + 16, py + 140, b.t, { tam: 13, peso: 700, color: '#ffffff' }));
    });
    // logo táctil y reset
    g.appendChild(svgEl('circle', { cx: px + pw / 2 - 16, cy: py + 20, r: 7, fill: '#c8c8c8' }));
    g.appendChild(svgEl('circle', { cx: px + pw / 2 + 16, cy: py + 20, r: 7, fill: '#c8c8c8' }));
    g.appendChild(texto(px + 16, py + ph - 78, 'micro:bit', { tam: 12, peso: 700, color: '#ffffff', ancla: 'start', mono: false }));

    // conector de borde: los pines grandes son los de cocodrilo
    const pines = [
      { t: '0', x: px + 46 }, { t: '1', x: px + 128 }, { t: '2', x: px + 210 },
      { t: '3V', x: px + 292 }, { t: 'GND', x: px + 352 }
    ];
    pines.forEach(pin => {
      g.appendChild(rect(pin.x - 20, py + ph - 34, 40, 34, '#d4af37', null, 0));
      g.appendChild(texto(pin.x, py + ph - 46, pin.t, { tam: 12, peso: 700, color: '#ffffff' }));
    });

    // alimentación
    if (p.alimentacion === 'pilas') {
      g.appendChild(rect(px + pw + 20, py + 150, 96, 54, C.cuerpoOsc, C.trazo, 1.6, { rx: 6 }));
      g.appendChild(texto(px + pw + 68, py + 177, '2×AAA', { tam: 11, peso: 700, color: '#fff' }));
      g.appendChild(svgEl('path', { d: `M ${px + pw} ${py + 168} C ${px + pw + 8} ${py + 168} ${px + pw + 12} ${py + 172} ${px + pw + 20} ${py + 172}`, fill: 'none', stroke: '#222', 'stroke-width': 3 }));
    } else if (p.alimentacion === 'usb') {
      g.appendChild(rect(px + pw / 2 - 22, py - 18, 44, 20, C.metal, C.trazo, 1.6, { rx: 3 }));
      g.appendChild(linea(px + pw / 2, py - 18, px + pw / 2, 12, '#222', 4));
    }

    // ---- pantalla con el valor ----
    const interno = SENSORES_INTERNOS_MICROBIT.filter(s => s.id === p.interno)[0];
    const unidad = String(p.unidad || '').trim() || (interno && interno.unidad) || '';
    pantallaLCD(g, px + pw + 20, py + 6, 240, 96, fmt(p.lectura, Number(p.decimales)), unidad,
      { tamNum: 42, arriba: p.magnitud || (interno ? interno.magnitud : '') });
    if (interno && interno.id) {
      g.appendChild(texto(px + pw + 140, py + 118, 'sensor interno: ' + interno.t, { tam: 10, color: C.suave }));
    }

    // ---- cables a los sensores ----
    if (conCables) {
      const yFila = 400;
      const anchoCaja = 210;
      conectados.forEach((x, i) => {
        const pin = pines[x.pin];
        const cx0 = 70 + i * (anchoCaja + 30);
        const esSensor = x.c.clase === 'sensor';
        const col = esSensor ? C.liquido : '#c98b2b';
        g.appendChild(svgEl('path', {
          d: `M ${pin.x} ${py + ph} C ${pin.x} ${py + ph + 60} ${cx0 + anchoCaja / 2} ${yFila - 70} ${cx0 + anchoCaja / 2} ${yFila}`,
          fill: 'none', stroke: col, 'stroke-width': 3.5
        }));
        g.appendChild(rect(cx0, yFila, anchoCaja, 78, '#ffffff', col, 2, { rx: 8 }));
        g.appendChild(texto(cx0 + anchoCaja / 2, yFila + 22, 'pin ' + x.pin, { tam: 11, peso: 700, color: col }));
        const palabras = x.c.t.split(/\s+/);
        let r1 = '', r2t = '';
        palabras.forEach(w => { if ((r1 + ' ' + w).trim().length <= 22) r1 = (r1 + ' ' + w).trim(); else r2t = (r2t + ' ' + w).trim(); });
        g.appendChild(texto(cx0 + anchoCaja / 2, yFila + 44, r1, { tam: 11, mono: false }));
        if (r2t) g.appendChild(texto(cx0 + anchoCaja / 2, yFila + 60, r2t, { tam: 11, mono: false }));
        g.appendChild(texto(cx0 + anchoCaja / 2, yFila + (r2t ? 72 : 62), esSensor ? 'entrada' : 'salida', { tam: 9, color: C.suave }));
      });
      // el negativo siempre va a GND: es el error más común al cablear
      g.appendChild(svgEl('path', {
        d: `M ${pines[4].x} ${py + ph} C ${pines[4].x + 60} ${py + ph + 70} ${ancho - 60} ${yFila - 40} ${ancho - 60} ${yFila + 30}`,
        fill: 'none', stroke: '#222', 'stroke-width': 3, 'stroke-dasharray': '6 4'
      }));
      g.appendChild(rect(ancho - 96, yFila + 30, 72, 40, '#ffffff', '#222', 1.6, { rx: 6 }));
      g.appendChild(texto(ancho - 60, yFila + 46, 'GND', { tam: 11, peso: 700 }));
      g.appendChild(texto(ancho - 60, yFila + 60, 'común', { tam: 9, color: C.suave }));
    }

    rotulo(g, 260, alto - 10, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ---------- Sensores Vernier Go Direct ----------

// Catálogo de sensores de la línea Go Direct de Vernier, con la magnitud que
// mide cada uno, su unidad habitual y el rango que da el fabricante. Los
// nombres van en inglés porque así figuran en el equipo y en el software.
export const SENSORES_GO_DIRECT = [
  { id: 'force', t: 'Go Direct Force and Acceleration', magnitud: 'Fuerza', unidad: 'N', rango: '±50 N', dec: 2, lectura: 4.85 },
  { id: 'accel', t: 'Go Direct Acceleration', magnitud: 'Aceleración', unidad: 'm/s²', rango: '±157 m/s²', dec: 2, lectura: 9.81 },
  { id: 'temp', t: 'Go Direct Temperature', magnitud: 'Temperatura', unidad: '°C', rango: '−40 a 125 °C', dec: 1, lectura: 24.6 },
  { id: 'ph', t: 'Go Direct pH', magnitud: 'pH', unidad: '', rango: '0 a 14', dec: 2, lectura: 7.02 },
  { id: 'orp', t: 'Go Direct ORP', magnitud: 'Potencial redox', unidad: 'mV', rango: '±1000 mV', dec: 0, lectura: 218 },
  { id: 'motion', t: 'Go Direct Motion Detector', magnitud: 'Posición', unidad: 'm', rango: '0,15 a 6 m', dec: 3, lectura: 1.245 },
  { id: 'light', t: 'Go Direct Light and Color', magnitud: 'Iluminancia', unidad: 'lx', rango: '0 a 150 000 lx', dec: 0, lectura: 412 },
  { id: 'pressure', t: 'Go Direct Gas Pressure', magnitud: 'Presión', unidad: 'kPa', rango: '0 a 400 kPa', dec: 1, lectura: 101.3 },
  { id: 'co2', t: 'Go Direct CO₂ Gas', magnitud: 'Dióxido de carbono', unidad: 'ppm', rango: '0 a 100 000 ppm', dec: 0, lectura: 640 },
  { id: 'o2', t: 'Go Direct O₂ Gas', magnitud: 'Oxígeno', unidad: '%', rango: '0 a 27 %', dec: 1, lectura: 20.9 },
  { id: 'cond', t: 'Go Direct Conductivity', magnitud: 'Conductividad', unidad: 'µS/cm', rango: '0 a 20 000 µS/cm', dec: 0, lectura: 1450 },
  { id: 'volt', t: 'Go Direct Voltage', magnitud: 'Tensión', unidad: 'V', rango: '±30 V', dec: 3, lectura: 4.512 },
  { id: 'current', t: 'Go Direct Current', magnitud: 'Corriente', unidad: 'A', rango: '±1 A', dec: 3, lectura: 0.126 },
  { id: 'energy', t: 'Go Direct Energy', magnitud: 'Tensión, corriente y potencia', unidad: 'W', rango: '±15 V · ±1 A', dec: 3, lectura: 0.568 },
  { id: 'ekg', t: 'Go Direct EKG', magnitud: 'Actividad eléctrica', unidad: 'mV', rango: '±3 mV', dec: 2, lectura: 0.85 },
  { id: 'resp', t: 'Go Direct Respiration Belt', magnitud: 'Fuerza de respiración', unidad: 'N', rango: '0 a 50 N', dec: 1, lectura: 12.4 },
  { id: 'hr', t: 'Go Direct Hand-Grip Heart Rate', magnitud: 'Frecuencia cardíaca', unidad: 'lpm', rango: '0 a 200 lpm', dec: 0, lectura: 78 },
  { id: 'bp', t: 'Go Direct Blood Pressure', magnitud: 'Presión arterial', unidad: 'mmHg', rango: '0 a 250 mmHg', dec: 0, lectura: 118 },
  { id: 'spiro', t: 'Go Direct Spirometer', magnitud: 'Caudal de aire', unidad: 'L/s', rango: '±10 L/s', dec: 2, lectura: 1.35 },
  { id: 'magnetic', t: 'Go Direct Magnetic Field', magnitud: 'Campo magnético', unidad: 'mT', rango: '±130 mT', dec: 2, lectura: 3.42 },
  { id: 'sound', t: 'Go Direct Sound', magnitud: 'Nivel sonoro', unidad: 'dB', rango: '35 a 110 dB', dec: 1, lectura: 62.4 },
  { id: 'rotary', t: 'Go Direct Rotary Motion', magnitud: 'Ángulo girado', unidad: '°', rango: '0,25° de resolución', dec: 1, lectura: 145.5 },
  { id: 'drop', t: 'Go Direct Drop Counter', magnitud: 'Volumen agregado', unidad: 'mL', rango: 'gota a gota', dec: 2, lectura: 12.35 },
  { id: 'colorim', t: 'Go Direct Colorimeter', magnitud: 'Absorbancia', unidad: '', rango: '0 a 3 abs', dec: 3, lectura: 0.482 },
  { id: 'do', t: 'Go Direct Optical Dissolved Oxygen', magnitud: 'Oxígeno disuelto', unidad: 'mg/L', rango: '0 a 20 mg/L', dec: 2, lectura: 8.15 },
  { id: 'turb', t: 'Go Direct Turbidity', magnitud: 'Turbidez', unidad: 'NTU', rango: '0 a 200 NTU', dec: 1, lectura: 14.5 },
  { id: 'charge', t: 'Go Direct Charge', magnitud: 'Carga eléctrica', unidad: 'nC', rango: '±100 nC', dec: 1, lectura: 23.4 },
  { id: 'radiation', t: 'Go Direct Radiation Monitor', magnitud: 'Radiación', unidad: 'cpm', rango: 'cuentas por minuto', dec: 0, lectura: 34 },
  { id: 'melt', t: 'Go Direct Melt Station', magnitud: 'Punto de fusión', unidad: '°C', rango: 'ambiente a 260 °C', dec: 1, lectura: 132.5 },
  { id: 'weather', t: 'Go Direct Weather', magnitud: 'Estación meteorológica', unidad: '°C', rango: 'temperatura, humedad, viento', dec: 1, lectura: 18.7 }
];

export function sensorGoDirect(id) {
  for (let i = 0; i < SENSORES_GO_DIRECT.length; i++) if (SENSORES_GO_DIRECT[i].id === id) return SENSORES_GO_DIRECT[i];
  return SENSORES_GO_DIRECT[0];
}

DEF.goDirect = {
  nombre: 'Sensor Vernier Go Direct',
  icono: '📡',
  categoria: 'Sensores',
  magnitud: 'Configurable',
  resumen: 'Los sensores inalámbricos de la línea Go Direct, con su magnitud, su unidad y su rango.',
  comoSeLee: 'El sensor manda el dato al celular o a la computadora por Bluetooth (o por USB si está enchufado), y el programa lo grafica en vivo. Antes de medir en serio conviene calibrarlo y fijar la frecuencia de muestreo: no es lo mismo una muestra por segundo que cien.',
  params: [
    { clave: 'modelo', etiqueta: 'Modelo del sensor', tipo: 'opcion', def: 'force',
      opciones: SENSORES_GO_DIRECT.map(s => ({ v: s.id, t: s.t })) },
    { clave: 'lectura', etiqueta: 'Lectura que muestra', tipo: 'numero', paso: 'any', def: 4.85, ayuda: 'Al cambiar de modelo conviene ajustarlo al rango de ese sensor.' },
    { clave: 'unidad', etiqueta: 'Unidad (vacío = la del modelo)', tipo: 'texto', def: '' },
    { clave: 'decimales', etiqueta: 'Decimales', tipo: 'opcion', def: 2, opciones: [{ v: 0, t: '0' }, { v: 1, t: '1' }, { v: 2, t: '2' }, { v: 3, t: '3' }] },
    { clave: 'conexion', etiqueta: 'Cómo está conectado', tipo: 'opcion', def: 'bluetooth', opciones: [
      { v: 'bluetooth', t: 'Bluetooth (inalámbrico)' }, { v: 'usb', t: 'Cable USB' }
    ] },
    { clave: 'frecuencia', etiqueta: 'Frecuencia de muestreo', tipo: 'texto', def: '10 muestras/s', ayuda: 'Se anota en el protocolo porque cambia lo que se puede ver del fenómeno.' },
    { clave: 'grafica', etiqueta: 'Mostrar la gráfica en vivo', tipo: 'bool', def: true },
    { clave: 'bateria', etiqueta: 'Batería', tipo: 'opcion', def: 'llena', opciones: [
      { v: 'llena', t: 'Cargada' }, { v: 'media', t: 'Por la mitad' }, { v: 'baja', t: 'Baja' }
    ] },
    P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const s = sensorGoDirect(p.modelo);
    const unidad = String(p.unidad || '').trim() || s.unidad;
    const dec = Number(p.decimales);
    const g = grupo();
    const ancho = 560, alto = 440;

    // ---- el sensor ----
    const sx = 40, sy = 60, sw = 200, sh = 250;
    g.appendChild(rect(sx, sy, sw, sh, '#2f5f8f', C.trazo, 2.4, { rx: 18 }));
    g.appendChild(rect(sx + 12, sy + 12, sw - 24, 64, '#e9eef3', C.trazo, 1.4, { rx: 8 }));
    g.appendChild(texto(sx + sw / 2, sy + 34, 'Go Direct', { tam: 15, peso: 700, mono: false }));
    g.appendChild(texto(sx + sw / 2, sy + 56, s.magnitud, { tam: 11, color: C.suave, mono: false }));

    // LED de estado y botón
    const colorLed = p.conexion === 'bluetooth' ? '#3aa3d8' : '#4caf50';
    g.appendChild(svgEl('circle', { cx: sx + 34, cy: sy + 110, r: 9, fill: colorLed, stroke: C.trazo, 'stroke-width': 1.2 }));
    g.appendChild(texto(sx + 34, sy + 132, p.conexion === 'bluetooth' ? 'BT' : 'USB', { tam: 9, color: '#ffffff' }));
    g.appendChild(svgEl('circle', { cx: sx + sw - 34, cy: sy + 110, r: 13, fill: '#1d3f61', stroke: '#ffffff', 'stroke-width': 1.6 }));
    g.appendChild(texto(sx + sw - 34, sy + 132, 'ON', { tam: 9, color: '#ffffff' }));

    // batería
    const niveles = { llena: 3, media: 2, baja: 1 };
    const barras = niveles[p.bateria] || 3;
    g.appendChild(rect(sx + sw / 2 - 26, sy + 100, 52, 22, 'none', '#ffffff', 1.6, { rx: 3 }));
    g.appendChild(rect(sx + sw / 2 + 26, sy + 107, 4, 8, '#ffffff', null, 0));
    for (let i = 0; i < barras; i++) {
      g.appendChild(rect(sx + sw / 2 - 23 + i * 16, sy + 103, 13, 16, barras === 1 ? C.rojo : '#ffffff', null, 0));
    }

    // sonda / conector según el modelo
    g.appendChild(rect(sx + sw / 2 - 16, sy + sh, 32, 26, C.metal, C.trazo, 1.6, { rx: 4 }));
    g.appendChild(svgEl('path', {
      d: `M ${sx + sw / 2} ${sy + sh + 26} C ${sx + sw / 2} ${alto - 60} ${sx + 20} ${alto - 50} ${sx + 6} ${alto - 20}`,
      fill: 'none', stroke: '#222', 'stroke-width': 4
    }));
    g.appendChild(rect(sx - 12, alto - 22, 36, 18, C.metalOsc, C.trazo, 1.4, { rx: 4 }));
    g.appendChild(texto(sx + sw / 2 + 40, alto - 30, 'sonda / accesorio', { tam: 10, color: C.suave, mono: false }));

    // ---- panel de lectura (como se ve en la app) ----
    const bx = sx + sw + 40, bw = ancho - bx - 30;
    g.appendChild(rect(bx, sy, bw, 250, '#ffffff', C.trazo, 1.8, { rx: 10 }));
    g.appendChild(rect(bx, sy, bw, 30, '#eef2f5', C.trazo, 1.2, { rx: 10 }));
    g.appendChild(texto(bx + bw / 2, sy + 15, 'Lectura en vivo', { tam: 11, peso: 700, mono: false }));
    g.appendChild(texto(bx + bw - 14, sy + 62, fmt(p.lectura, dec), { tam: 40, peso: 700, ancla: 'end' }));
    if (unidad) g.appendChild(texto(bx + bw - 14, sy + 88, unidad, { tam: 14, ancla: 'end', color: C.suave }));
    g.appendChild(texto(bx + 12, sy + 110, s.magnitud, { tam: 11, ancla: 'start', color: C.suave, mono: false }));
    g.appendChild(texto(bx + 12, sy + 126, 'rango: ' + s.rango, { tam: 10, ancla: 'start', color: C.suave }));
    g.appendChild(texto(bx + 12, sy + 142, p.frecuencia || '', { tam: 10, ancla: 'start', color: C.suave }));

    if (p.grafica) {
      // una curva de ejemplo, sólo para que se entienda que el dato se registra
      const gx = bx + 12, gy = sy + 156, gw = bw - 24, gh = 68;
      g.appendChild(rect(gx, gy, gw, gh, '#fbfcfd', C.tenue, 1, { rx: 4 }));
      let d = '';
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const y = gy + gh * (0.72 - 0.45 * Math.sin(t * Math.PI * 1.6) * Math.exp(-t * 0.7));
        d += (i ? ' L ' : 'M ') + r2(gx + t * gw) + ' ' + r2(y);
      }
      g.appendChild(svgEl('path', { d, fill: 'none', stroke: C.liquido, 'stroke-width': 2 }));
      g.appendChild(linea(gx, gy + gh, gx + gw, gy + gh, C.tenue, 1));
      g.appendChild(texto(gx + gw / 2, gy + gh + 12, 'tiempo', { tam: 9, color: C.suave }));
    }

    rotulo(g, ancho / 2, alto - 6, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ============================================================
// API pública
// ============================================================

// Orden en el que aparecen en el banco.
const ORDEN = ['regla', 'calibre', 'micrometro', 'probeta', 'bureta', 'jeringa', 'vidrio',
  'termometro', 'dinamometro', 'balanzaDigital', 'granataria', 'cronometro',
  'multimetro', 'aguja', 'transportador', 'sensorDigital', 'microbit', 'goDirect'];

ORDEN.forEach(id => { if (DEF[id]) DEF[id].id = id; });

export const INSTRUMENTOS = DEF;

export function catalogoInstrumentos() {
  return ORDEN.filter(id => DEF[id]).map(id => DEF[id]);
}

export function categoriasInstrumentos() {
  const vistas = [];
  catalogoInstrumentos().forEach(i => { if (vistas.indexOf(i.categoria) < 0) vistas.push(i.categoria); });
  return vistas;
}

export function instrumentoPorId(id) { return DEF[id] || null; }

// Valores por defecto de un instrumento, listos para editar.
export function paramsPorDefecto(id) {
  const def = DEF[id];
  if (!def) return {};
  const p = {};
  def.params.forEach(par => { p[par.clave] = par.def; });
  return p;
}

// Completa los parámetros que falten y convierte los numéricos a número.
export function normalizarParams(id, params) {
  const def = DEF[id];
  if (!def) return {};
  const p = {};
  def.params.forEach(par => {
    let v = params && params[par.clave] !== undefined ? params[par.clave] : par.def;
    if (par.tipo === 'numero') { v = Number(v); if (!isFinite(v)) v = Number(par.def) || 0; }
    if (par.tipo === 'bool') v = v === true || v === 'true' || v === 1 || v === '1';
    if (par.tipo === 'opcion') {
      const numerica = par.opciones.every(o => typeof o.v === 'number');
      if (numerica) v = Number(v);
      // los nombres viejos de una opción se traducen al actual, así un
      // protocolo guardado hace meses sigue abriendo donde corresponde
      if (par.alias && par.alias[v] !== undefined) v = par.alias[v];
      if (!par.opciones.some(o => String(o.v) === String(v))) v = par.def;
    }
    p[par.clave] = v;
  });
  return p;
}

// La apreciación: la menor división que el instrumento puede distinguir.
export function apreciacionDe(id, params) {
  const p = normalizarParams(id, params);
  if (id === 'calibre') return 1 / (Number(p.nonio) || 10);
  if (id === 'micrometro') return 0.5 / (Number(p.divisionesTambor) || 50);
  if (id === 'cronometro') return Number(p.resolucion) || 0.01;
  if (id === 'multimetro') {
    const f = funcionMultimetro(p.funcion);
    return Math.pow(10, -(Number(p.decimales) >= 0 ? Number(p.decimales) : f.dec));
  }
  if (id === 'sensorDigital' || id === 'microbit' || id === 'goDirect') return Math.pow(10, -Number(p.decimales || 0));
  if (p.division != null) return Math.abs(Number(p.division)) || 0;
  return 0;
}

// Unidad "oficial" del instrumento tal como está configurado.
export function unidadDe(id, params) {
  const p = normalizarParams(id, params);
  if (id === 'calibre' || id === 'micrometro') return 'mm';
  if (id === 'cronometro') return 's';
  if (id === 'transportador') return '°';
  if (id === 'multimetro') return String(p.unidad || '').trim() || funcionMultimetro(p.funcion).unidad;
  if (id === 'goDirect') return String(p.unidad || '').trim() || sensorGoDirect(p.modelo).unidad;
  return p.unidad != null ? String(p.unidad) : '';
}

// Frase lista para pegar en un protocolo: qué mide, hasta cuánto y con qué apreciación.
export function fichaTecnica(id, params) {
  const def = DEF[id];
  if (!def) return '';
  const p = normalizarParams(id, params);
  const u = unidadDe(id, params);
  const apr = apreciacionDe(id, params);
  const dec = decimalesDe(apr || 1);
  const partes = [];
  if (id === 'multimetro') {
    const f = funcionMultimetro(p.funcion);
    if (f.id === 'off') return 'apagado';
    partes.push(f.t.toLowerCase());
  } else if (id === 'goDirect') {
    const s = sensorGoDirect(p.modelo);
    partes.push(s.magnitud.toLowerCase());
    if (s.rango) partes.push('rango ' + s.rango);
  } else if (id === 'microbit') {
    partes.push('placa programable con sensores');
  } else if (id === 'calibre' || id === 'micrometro') partes.push(`alcance ${fmt(p.max, 0)} mm`);
  else if (p.max != null && p.min != null) partes.push(`alcance ${fmt(p.min, decimalesDe(p.division || 1))} a ${fmt(p.max, decimalesDe(p.division || 1))} ${u}`.trim());
  else if (p.max != null) partes.push(`alcance ${fmt(p.max, 0)} ${u}`.trim());
  if (apr) partes.push(`apreciación ${fmt(apr, dec)} ${u}`.trim());
  return partes.join(' · ');
}

// Incertidumbre típica de una medida: media división en los analógicos,
// una unidad de la última cifra en los digitales.
export function incertidumbreDe(id, params) {
  const apr = apreciacionDe(id, params);
  const digitales = ['balanzaDigital', 'cronometro', 'multimetro', 'sensorDigital'];
  return digitales.indexOf(id) >= 0 ? apr : apr / 2;
}

// Dibuja el instrumento. Devuelve el <svg> completo.
export function dibujarInstrumento(id, params) {
  const def = DEF[id];
  if (!def) {
    const s = svgEl('svg', { xmlns: NS, viewBox: '0 0 200 60', width: 200, height: 60 });
    s.appendChild(texto(100, 30, 'instrumento desconocido', { tam: 12, color: C.rojo }));
    return s;
  }
  const p = normalizarParams(id, params);
  const { g, ancho, alto } = def.dibujar(p);
  const esc = Number(p.escala) || 1;
  const svg = svgEl('svg', {
    xmlns: NS,
    viewBox: `0 0 ${Math.round(ancho)} ${Math.round(alto)}`,
    width: Math.round(ancho * esc),
    height: Math.round(alto * esc),
    class: 'instr-svg',
    role: 'img'
  });
  const titulo = svgEl('title');
  titulo.textContent = def.nombre + (p.etiqueta ? ' — ' + p.etiqueta : '');
  svg.appendChild(titulo);
  svg.appendChild(g);
  return svg;
}

// Serializa el SVG para descargarlo como archivo suelto.
export function svgATexto(svg) {
  const copia = svg.cloneNode(true);
  copia.setAttribute('xmlns', NS);
  copia.removeAttribute('class');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(copia);
}

// Convierte el SVG a PNG (para pegar en Word, Docs o una presentación).
export function svgAPNG(svg, escala) {
  return new Promise((resolve, reject) => {
    const esc = escala || 2;
    const w = Number(svg.getAttribute('width')) || 400;
    const h = Number(svg.getAttribute('height')) || 400;
    const texto = svgATexto(svg);
    const img = new Image();
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(texto);
    img.onload = () => {
      const lienzo = document.createElement('canvas');
      lienzo.width = Math.round(w * esc);
      lienzo.height = Math.round(h * esc);
      const ctx = lienzo.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, lienzo.width, lienzo.height);
      ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
      resolve(lienzo.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('No se pudo convertir el dibujo a PNG.'));
    img.src = url;
  });
}

// ---- Formato de texto: una línea por instrumento ----
// probeta :: max=100, division=1, numerarCada=10, unidad=mL, lectura=64
// Es el mismo formato que entiende el generador de protocolos y el que
// conviene pedirle a una IA cuando arma un práctico.
export function instrumentoATexto(id, params) {
  const def = DEF[id];
  if (!def) return '';
  const p = normalizarParams(id, params);
  const trozos = [];
  def.params.forEach(par => {
    const v = p[par.clave];
    if (v === par.def) return;                 // sólo lo que se apartó de fábrica
    if (par.tipo === 'bool') trozos.push(par.clave + '=' + (v ? 'si' : 'no'));
    else if (String(v) !== '') trozos.push(par.clave + '=' + v);
  });
  return id + (trozos.length ? ' :: ' + trozos.join(', ') : '');
}

export function textoAInstrumento(linea) {
  const txt = String(linea || '').trim();
  if (!txt) return null;
  const corte = txt.split('::');
  const id = corte[0].trim();
  if (!DEF[id]) return null;
  const params = paramsPorDefecto(id);
  if (corte[1]) {
    corte.slice(1).join('::').split(',').forEach(par => {
      const i = par.indexOf('=');
      if (i < 0) return;
      const clave = par.slice(0, i).trim();
      let valor = par.slice(i + 1).trim();
      const def = DEF[id].params.filter(x => x.clave === clave)[0];
      if (!def) return;
      if (def.tipo === 'bool') valor = /^(si|sí|s|true|1)$/i.test(valor);
      else if (def.tipo === 'numero') valor = Number(String(valor).replace(',', '.'));
      params[clave] = valor;
    });
  }
  return { id, params: normalizarParams(id, params) };
}

// Una lectura "linda" al azar, alineada a la división del instrumento.
// Sirve para armar fichas de ejercicios distintas cada vez.
export function lecturaAlAzar(id, params) {
  const def = DEF[id];
  const p = normalizarParams(id, params);
  const apr = apreciacionDe(id, params) || 1;
  let min = 0, max = 10;
  if (id === 'calibre' || id === 'micrometro') { min = Number(p.max) * 0.1; max = Number(p.max) * 0.8; }
  else if (def && def.rangoAzar) { min = def.rangoAzar[0]; max = def.rangoAzar[1]; }
  else if (p.min != null && p.max != null) { min = Number(p.min); max = Number(p.max); }
  else if (p.max != null) { min = 0; max = Number(p.max); }
  const bruto = min + (max - min) * (0.04 + Math.random() * 0.92);
  return Math.min(max, Math.max(min, Math.round(bruto / apr) * apr));
}
