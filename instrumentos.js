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

// ---------- Frascos y recipientes con sustancia ----------

// Pictogramas del sistema armonizado (rombo rojo). Se dibujan simplificados
// pero reconocibles: alcanza para que el estudiante sepa qué tiene enfrente.
export const PELIGROS = [
  { id: '', t: '— sin pictograma —' },
  { id: 'corrosivo', t: 'Corrosivo', simbolo: '🜔' },
  { id: 'inflamable', t: 'Inflamable', simbolo: '🔥' },
  { id: 'toxico', t: 'Tóxico (calavera)', simbolo: '☠' },
  { id: 'irritante', t: 'Irritante / nocivo', simbolo: '!' },
  { id: 'oxidante', t: 'Comburente', simbolo: 'O' },
  { id: 'ambiente', t: 'Peligroso para el ambiente', simbolo: '🐟' },
  { id: 'salud', t: 'Peligro para la salud', simbolo: '☣' }
];

// El rombo rojo del pictograma, con su dibujo adentro. Los símbolos van
// dibujados y no como caracteres: así se ven igual en cualquier navegador y
// no dependen de que la fuente traiga el emoji.
function rombePeligro(g, cx, cy, lado, id) {
  if (!id) return;
  const r = lado / 2;
  g.appendChild(svgEl('polygon', {
    points: `${r2(cx)},${r2(cy - r)} ${r2(cx + r)},${r2(cy)} ${r2(cx)},${r2(cy + r)} ${r2(cx - r)},${r2(cy)}`,
    fill: '#ffffff', stroke: C.rojo, 'stroke-width': lado * 0.1
  }));
  const k = lado / 44;                       // todo se dibuja para un rombo de 44 y se escala
  const s = grupo({ transform: `translate(${r2(cx)} ${r2(cy)}) scale(${r2(k)})` });
  const N = '#111111';
  const llama = (x, y, alto) => svgEl('path', {
    d: `M ${x} ${y} C ${x + alto * 0.42} ${y - alto * 0.42} ${x + alto * 0.2} ${y - alto * 0.72} ${x} ${y - alto}
        C ${x - alto * 0.1} ${y - alto * 0.6} ${x - alto * 0.45} ${y - alto * 0.5} ${x} ${y} Z`, fill: N
  });

  if (id === 'inflamable') {
    s.appendChild(llama(0, 12, 26));
    s.appendChild(svgEl('rect', { x: -13, y: 12, width: 26, height: 3, fill: N }));
  } else if (id === 'oxidante') {
    s.appendChild(svgEl('circle', { cx: 0, cy: 6, r: 9, fill: 'none', stroke: N, 'stroke-width': 3 }));
    s.appendChild(llama(0, -6, 16));
  } else if (id === 'toxico') {
    // calavera con las tibias cruzadas
    s.appendChild(svgEl('path', { d: 'M -9 -8 A 9 10 0 0 1 9 -8 L 9 1 A 9 8 0 0 1 -9 1 Z', fill: N }));
    s.appendChild(svgEl('circle', { cx: -3.6, cy: -6, r: 2.4, fill: '#fff' }));
    s.appendChild(svgEl('circle', { cx: 3.6, cy: -6, r: 2.4, fill: '#fff' }));
    s.appendChild(svgEl('rect', { x: -1, y: -1, width: 2, height: 3, fill: '#fff' }));
    [-38, 38].forEach(a => s.appendChild(svgEl('rect', {
      x: -13, y: 8, width: 26, height: 3.4, fill: N, transform: `rotate(${a} 0 10)`
    })));
  } else if (id === 'irritante') {
    s.appendChild(svgEl('rect', { x: -2.6, y: -13, width: 5.2, height: 17, fill: N }));
    s.appendChild(svgEl('circle', { cx: 0, cy: 10, r: 3, fill: N }));
  } else if (id === 'corrosivo') {
    // dos tubos que vuelcan sobre una superficie que se come
    [-9, 9].forEach((x, i) => {
      s.appendChild(svgEl('rect', { x: x - 3, y: -14, width: 6, height: 11, fill: N, transform: `rotate(${i ? 26 : -26} ${x} -8)` }));
      s.appendChild(svgEl('path', { d: `M ${x} -1 L ${x + 1.6} 5 L ${x - 1.6} 5 Z`, fill: N }));
    });
    s.appendChild(svgEl('path', { d: 'M -14 9 L 14 9 L 14 13 L -14 13 Z M -5 9 L 0 4 L 5 9 Z', fill: N, 'fill-rule': 'evenodd' }));
  } else if (id === 'ambiente') {
    // un pez y un árbol: el pictograma de peligro para el medio ambiente
    s.appendChild(svgEl('path', { d: 'M -14 6 C -8 0 0 0 5 6 C 0 12 -8 12 -14 6 Z M 5 6 L 12 1 L 12 11 Z', fill: N }));
    s.appendChild(svgEl('circle', { cx: -9, cy: 5, r: 1.4, fill: '#fff' }));
    s.appendChild(svgEl('path', { d: 'M -4 -12 L 2 -12 L 2 -3 L -4 -3 Z M -9 -3 L 7 -3 L -1 -15 Z', fill: N }));
  } else if (id === 'salud') {
    s.appendChild(svgEl('path', { d: 'M -10 -13 L 10 -13 L 10 13 L -10 13 Z', fill: 'none', stroke: N, 'stroke-width': 2.4 }));
    s.appendChild(svgEl('path', { d: 'M 0 -9 L 3 -2 L 10 -2 L 4.5 2.5 L 7 9.5 L 0 5 L -7 9.5 L -4.5 2.5 L -10 -2 L -3 -2 Z', fill: N }));
  }
  g.appendChild(s);
}

DEF.frasco = {
  nombre: 'Frasco con sustancia',
  icono: '🧴',
  categoria: 'Sustancias',
  magnitud: 'Reactivo',
  resumen: 'El tarrito de la sustancia, con su etiqueta: nombre, fórmula, concentración, cuánto hay y el pictograma de peligro.',
  comoSeLee: 'La etiqueta se lee antes de destapar. El pictograma dice cómo hay que manipularla; la concentración, qué tan fuerte está. Un frasco sin etiqueta se descarta: nunca se prueba ni se huele para averiguar qué es.',
  params: [
    { clave: 'tipo', etiqueta: 'Tipo de recipiente', tipo: 'opcion', def: 'frasco', opciones: [
      { v: 'frasco', t: 'Frasco de reactivo' }, { v: 'botella', t: 'Botella' }, { v: 'gotero', t: 'Frasco gotero' },
      { v: 'vaso', t: 'Vaso de precipitados' }, { v: 'tubo', t: 'Tubo de ensayo' },
      { v: 'matraz', t: 'Erlenmeyer' }, { v: 'placa', t: 'Cápsula de Petri (desde arriba)' },
      { v: 'vidrioReloj', t: 'Vidrio de reloj' }
    ] },
    { clave: 'nombre', etiqueta: 'Nombre de la sustancia', tipo: 'texto', def: 'Ácido clorhídrico' },
    { clave: 'formula', etiqueta: 'Fórmula', tipo: 'texto', def: 'HCl', ayuda: 'Los números van como se escriben: H2SO4, CuSO4·5H2O.' },
    { clave: 'concentracion', etiqueta: 'Concentración o pureza', tipo: 'texto', def: '0,1 mol/L' },
    { clave: 'cantidad', etiqueta: 'Cuánto hay', tipo: 'texto', def: '250 mL' },
    { clave: 'estado', etiqueta: 'Estado', tipo: 'opcion', def: 'liquido', opciones: [
      { v: 'liquido', t: 'Líquido' }, { v: 'solido', t: 'Sólido / polvo' }, { v: 'granulado', t: 'Granulado' }, { v: 'vacio', t: 'Vacío' }
    ] },
    P.color('#d8e64a'),
    { clave: 'nivel', etiqueta: 'Qué tan lleno está (%)', tipo: 'numero', paso: 5, min: 0, max: 100, def: 65 },
    { clave: 'peligro', etiqueta: 'Pictograma de peligro', tipo: 'opcion', def: 'corrosivo', opciones: PELIGROS.map(x => ({ v: x.id, t: x.t })) },
    { clave: 'peligro2', etiqueta: 'Segundo pictograma', tipo: 'opcion', def: '', opciones: PELIGROS.map(x => ({ v: x.id, t: x.t })) },
    { clave: 'mostrarEtiqueta', etiqueta: 'Dibujar la etiqueta', tipo: 'bool', def: true },
    P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const g = grupo();
    const ancho = 300, alto = 400;
    const cx = 150;
    const nivel = acotar(p.nivel, 0, 100) / 100;
    const lleno = p.estado !== 'vacio' && nivel > 0;
    const col = p.color || '#d8e64a';

    // Cada recipiente define su contorno y la caja donde entra el contenido.
    let contorno, caja, yEtiqueta = 210, anchoEtiqueta = 130;
    const yBase = 330;
    if (p.tipo === 'frasco' || p.tipo === 'botella') {
      const w = p.tipo === 'botella' ? 74 : 96;
      const yHombro = p.tipo === 'botella' ? 150 : 175;
      contorno = `M ${cx - 22} 92 L ${cx - 22} ${yHombro - 26} Q ${cx - w / 2} ${yHombro} ${cx - w / 2} ${yHombro + 26}
                  L ${cx - w / 2} ${yBase - 10} Q ${cx - w / 2} ${yBase} ${cx - w / 2 + 12} ${yBase}
                  L ${cx + w / 2 - 12} ${yBase} Q ${cx + w / 2} ${yBase} ${cx + w / 2} ${yBase - 10}
                  L ${cx + w / 2} ${yHombro + 26} Q ${cx + w / 2} ${yHombro} ${cx + 22} ${yHombro - 26} L ${cx + 22} 92 Z`;
      caja = { x: cx - w / 2 + 3, w: w - 6, yTope: yHombro + 20, yFondo: yBase - 4 };
      // la etiqueta deja ver una franja de contenido a cada lado, como en un
      // frasco de verdad: si tapara todo no se sabría cuánto queda
      anchoEtiqueta = w - 36;
      yEtiqueta = yHombro + 34;
      // tapa
      g.appendChild(rect(cx - 30, 68, 60, 30, C.cuerpoOsc, C.trazo, 1.8, { rx: 4 }));
    } else if (p.tipo === 'gotero') {
      contorno = `M ${cx - 34} 120 L ${cx - 34} ${yBase - 8} Q ${cx - 34} ${yBase} ${cx - 22} ${yBase}
                  L ${cx + 22} ${yBase} Q ${cx + 34} ${yBase} ${cx + 34} ${yBase - 8} L ${cx + 34} 120 Z`;
      caja = { x: cx - 31, w: 62, yTope: 130, yFondo: yBase - 4 };
      anchoEtiqueta = 54;
      yEtiqueta = 190;
      g.appendChild(rect(cx - 18, 74, 36, 48, '#3c4147', C.trazo, 1.6, { rx: 6 }));   // pera
      g.appendChild(rect(cx - 26, 118, 52, 12, C.cuerpoOsc, C.trazo, 1.4, { rx: 2 }));
    } else if (p.tipo === 'vaso') {
      contorno = `M ${cx - 78} 150 L ${cx - 78} ${yBase - 12} Q ${cx - 78} ${yBase} ${cx - 62} ${yBase}
                  L ${cx + 62} ${yBase} Q ${cx + 78} ${yBase} ${cx + 78} ${yBase - 12} L ${cx + 78} 150`;
      caja = { x: cx - 75, w: 150, yTope: 160, yFondo: yBase - 4 };
      yEtiqueta = 232; anchoEtiqueta = 120;
    } else if (p.tipo === 'tubo') {
      contorno = `M ${cx - 30} 120 L ${cx - 30} ${yBase - 30} A 30 30 0 0 0 ${cx + 30} ${yBase - 30} L ${cx + 30} 120`;
      caja = { x: cx - 27, w: 54, yTope: 130, yFondo: yBase - 6 };
      yEtiqueta = 180; anchoEtiqueta = 50;
    } else if (p.tipo === 'matraz') {
      contorno = `M ${cx - 26} 120 L ${cx - 26} 176 L ${cx - 86} ${yBase - 12} Q ${cx - 86} ${yBase} ${cx - 70} ${yBase}
                  L ${cx + 70} ${yBase} Q ${cx + 86} ${yBase} ${cx + 86} ${yBase - 12} L ${cx + 26} 176 L ${cx + 26} 120`;
      caja = { x: cx - 83, w: 166, yTope: 250, yFondo: yBase - 4 };
      yEtiqueta = 268; anchoEtiqueta = 110;
    } else if (p.tipo === 'placa') {
      g.appendChild(svgEl('circle', { cx, cy: 236, r: 92, fill: C.vidrio, stroke: C.vidrioBorde, 'stroke-width': 2.4 }));
      if (lleno) g.appendChild(svgEl('circle', { cx, cy: 236, r: 82, fill: col, 'fill-opacity': 0.55 }));
      g.appendChild(svgEl('circle', { cx, cy: 236, r: 82, fill: 'none', stroke: C.vidrioBorde, 'stroke-width': 1 }));
      contorno = null;
      yEtiqueta = 236; anchoEtiqueta = 120;
    } else {   // vidrio de reloj
      g.appendChild(svgEl('path', { d: `M ${cx - 96} 250 Q ${cx} 190 ${cx + 96} 250 Q ${cx} 268 ${cx - 96} 250 Z`, fill: C.vidrio, stroke: C.vidrioBorde, 'stroke-width': 2.2 }));
      if (lleno) g.appendChild(svgEl('ellipse', { cx, cy: 246, rx: 44 * (0.5 + nivel / 2), ry: 12, fill: col, 'fill-opacity': 0.75 }));
      contorno = null;
      yEtiqueta = 300; anchoEtiqueta = 130;
    }

    if (contorno) {
      const clipId = 'clipFrasco' + Math.random().toString(36).slice(2, 8);
      const clip = svgEl('clipPath', { id: clipId });
      clip.appendChild(svgEl('path', { d: contorno + ' Z' }));
      g.appendChild(clip);
      g.appendChild(svgEl('path', { d: contorno + (p.tipo === 'vaso' || p.tipo === 'tubo' || p.tipo === 'matraz' ? '' : ' Z'), fill: C.vidrio, stroke: 'none' }));
      if (lleno) {
        const yl = caja.yFondo - nivel * (caja.yFondo - caja.yTope);
        if (p.estado === 'liquido') {
          g.appendChild(rect(caja.x - 6, yl, caja.w + 12, caja.yFondo - yl + 8, col, null, 0, { 'fill-opacity': 0.62, 'clip-path': `url(#${clipId})` }));
        } else {
          // los sólidos se dibujan como un montoncito granulado
          g.appendChild(rect(caja.x - 6, yl, caja.w + 12, caja.yFondo - yl + 8, col, null, 0, { 'fill-opacity': 0.85, 'clip-path': `url(#${clipId})` }));
          for (let i = 0; i < 26; i++) {
            const gx = caja.x + ((i * 37) % caja.w);
            const gy = yl + ((i * 53) % Math.max(8, caja.yFondo - yl));
            g.appendChild(svgEl('circle', { cx: r2(gx), cy: r2(gy), r: p.estado === 'granulado' ? 3.4 : 2, fill: '#00000022', 'clip-path': `url(#${clipId})` }));
          }
        }
      }
      g.appendChild(svgEl('path', { d: contorno, fill: 'none', stroke: C.vidrioBorde, 'stroke-width': 2.4, 'stroke-linejoin': 'round' }));
    }

    // ---- la etiqueta ----
    if (p.mostrarEtiqueta) {
      const lineas = [];
      if (p.formula) lineas.push({ t: p.formula, tam: 15, peso: 700, mono: true });
      if (p.concentracion) lineas.push({ t: p.concentracion, tam: 11, peso: 400, mono: true });
      if (p.cantidad) lineas.push({ t: p.cantidad, tam: 11, peso: 400, mono: true });
      const alturaEt = 26 + lineas.length * 17;
      g.appendChild(rect(cx - anchoEtiqueta / 2, yEtiqueta, anchoEtiqueta, alturaEt, '#fffdf5', C.trazo, 1.4, { rx: 3 }));
      const nombreCorto = String(p.nombre || '');
      g.appendChild(texto(cx, yEtiqueta + 13, nombreCorto.length > 20 ? nombreCorto.slice(0, 19) + '…' : nombreCorto,
        { tam: nombreCorto.length > 14 ? 9 : 10.5, peso: 700, mono: false }));
      lineas.forEach((l, i) => g.appendChild(texto(cx, yEtiqueta + 30 + i * 17, l.t, { tam: l.tam, peso: l.peso, mono: l.mono })));
    }

    // ---- pictogramas ----
    const cuales = [p.peligro, p.peligro2].filter(Boolean);
    cuales.forEach((id, i) => rombePeligro(g, cx - (cuales.length - 1) * 26 + i * 52, 46, 44, id));

    // el nombre completo, abajo, para que no se pierda si no entra en la etiqueta
    g.appendChild(texto(cx, alto - 22, p.nombre || '', { tam: 12, peso: 700, mono: false }));
    rotulo(g, cx, alto - 6, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ---------- Mechero Bunsen ----------
DEF.mechero = {
  nombre: 'Mechero Bunsen',
  icono: '🔥',
  categoria: 'Química',
  magnitud: 'Fuente de calor',
  resumen: 'La fuente de calor de la mesada. El collar de aire decide si la llama sale azul (caliente) o amarilla (fría y tiznante).',
  comoSeLee: 'Se enciende con el collar de aire cerrado —llama amarilla, visible y segura— y recién ahí se abre el aire hasta que la llama se pone azul con el cono interior bien marcado. Esa llama azul es la que calienta: la parte más caliente es la punta del cono interior.',
  params: [
    { clave: 'llama', etiqueta: 'Llama', tipo: 'opcion', def: 'azul', opciones: [
      { v: 'apagado', t: 'Apagado' }, { v: 'amarilla', t: 'Amarilla (aire cerrado)' }, { v: 'azul', t: 'Azul (aire abierto)' }
    ] },
    { clave: 'altura', etiqueta: 'Altura de la llama', tipo: 'opcion', def: 'media', opciones: [
      { v: 'baja', t: 'Baja' }, { v: 'media', t: 'Media' }, { v: 'alta', t: 'Alta' }
    ] },
    { clave: 'manguera', etiqueta: 'Dibujar la manguera de gas', tipo: 'bool', def: true },
    { clave: 'zonas', etiqueta: 'Señalar las zonas de la llama', tipo: 'bool', def: false, ayuda: 'Marca el cono interior y la zona más caliente.' },
    P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const g = grupo();
    const ancho = 340, alto = 460;
    const cx = 150, yBase = 400;
    const alturas = { baja: 70, media: 120, alta: 170 };
    const h = alturas[p.altura] || 120;
    const yTubo = 190;

    // base, tubo y collar
    g.appendChild(svgEl('ellipse', { cx, cy: yBase, rx: 68, ry: 14, fill: C.metalOsc, stroke: C.trazo, 'stroke-width': 1.8 }));
    g.appendChild(svgEl('path', { d: `M ${cx - 68} ${yBase} L ${cx - 26} ${yBase - 44} L ${cx + 26} ${yBase - 44} L ${cx + 68} ${yBase} Z`, fill: C.metal, stroke: C.trazo, 'stroke-width': 1.8 }));
    g.appendChild(rect(cx - 17, yTubo, 34, yBase - 44 - yTubo, C.metal, C.trazo, 1.8));
    g.appendChild(rect(cx - 22, yTubo + 42, 44, 30, C.metalOsc, C.trazo, 1.8, { rx: 3 }));   // collar de aire
    // ventana del collar: abierta si la llama es azul
    const abierto = p.llama === 'azul';
    g.appendChild(rect(cx - 18, yTubo + 48, abierto ? 14 : 4, 18, abierto ? '#1b1b1b' : C.metal, C.trazo, 1.2));
    g.appendChild(texto(cx + 44, yTubo + 57, abierto ? 'aire abierto' : 'aire cerrado', { tam: 10, ancla: 'start', color: C.suave }));

    if (p.manguera) {
      g.appendChild(svgEl('path', { d: `M ${cx + 24} ${yBase - 58} C ${cx + 90} ${yBase - 58} ${cx + 110} ${yBase - 10} ${ancho - 10} ${yBase - 6}`, fill: 'none', stroke: '#3c4147', 'stroke-width': 7, 'stroke-linecap': 'round' }));
      g.appendChild(texto(ancho - 40, yBase - 20, 'gas', { tam: 10, color: C.suave }));
    }

    // la llama
    if (p.llama !== 'apagado') {
      const yPunta = yTubo - h;
      if (p.llama === 'azul') {
        g.appendChild(svgEl('path', { d: `M ${cx} ${yPunta} C ${cx + 26} ${yTubo - h * 0.45} ${cx + 20} ${yTubo} ${cx} ${yTubo} C ${cx - 20} ${yTubo} ${cx - 26} ${yTubo - h * 0.45} ${cx} ${yPunta} Z`, fill: '#4a90d9', 'fill-opacity': 0.85 }));
        g.appendChild(svgEl('path', { d: `M ${cx} ${yTubo - h * 0.52} C ${cx + 13} ${yTubo - h * 0.24} ${cx + 10} ${yTubo} ${cx} ${yTubo} C ${cx - 10} ${yTubo} ${cx - 13} ${yTubo - h * 0.24} ${cx} ${yTubo - h * 0.52} Z`, fill: '#1c5fa8', 'fill-opacity': 0.9 }));
      } else {
        g.appendChild(svgEl('path', { d: `M ${cx} ${yPunta} C ${cx + 30} ${yTubo - h * 0.42} ${cx + 22} ${yTubo} ${cx} ${yTubo} C ${cx - 22} ${yTubo} ${cx - 30} ${yTubo - h * 0.42} ${cx} ${yPunta} Z`, fill: '#f0a72a', 'fill-opacity': 0.9 }));
        g.appendChild(svgEl('path', { d: `M ${cx} ${yTubo - h * 0.6} C ${cx + 14} ${yTubo - h * 0.25} ${cx + 11} ${yTubo} ${cx} ${yTubo} C ${cx - 11} ${yTubo} ${cx - 14} ${yTubo - h * 0.25} ${cx} ${yTubo - h * 0.6} Z`, fill: '#f5d76e', 'fill-opacity': 0.9 }));
      }
      if (p.zonas && p.llama === 'azul') {
        const yCono = yTubo - h * 0.52;
        g.appendChild(linea(cx + 26, yCono, cx + 96, yCono, C.rojo, 1.2, { 'stroke-dasharray': '4 3' }));
        g.appendChild(texto(cx + 100, yCono - 6, 'punta del cono:', { tam: 10, ancla: 'start', color: C.rojo }));
        g.appendChild(texto(cx + 100, yCono + 6, 'lo más caliente', { tam: 10, ancla: 'start', color: C.rojo }));
        g.appendChild(linea(cx + 20, yTubo - h * 0.2, cx + 96, yTubo - h * 0.2, C.suave, 1.2, { 'stroke-dasharray': '4 3' }));
        g.appendChild(texto(cx + 100, yTubo - h * 0.2, 'cono interior', { tam: 10, ancla: 'start', color: C.suave }));
      }
    }
    rotulo(g, cx, alto - 10, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ---------- Soporte universal armado ----------
DEF.soporte = {
  nombre: 'Soporte universal armado',
  icono: '🧱',
  categoria: 'Química',
  magnitud: 'Montaje',
  resumen: 'La varilla con el aro, la rejilla y lo que se le apoye arriba: el montaje típico para calentar.',
  comoSeLee: 'Sirve para mostrar el montaje. La rejilla reparte el calor para que el vidrio no reciba la llama directa y se raje, y el aro tiene que quedar a unos 5 cm por encima del mechero.',
  params: [
    { clave: 'encima', etiqueta: 'Qué se apoya arriba', tipo: 'opcion', def: 'vaso', opciones: [
      { v: 'nada', t: 'Nada' }, { v: 'vaso', t: 'Vaso de precipitados' }, { v: 'matraz', t: 'Erlenmeyer' },
      { v: 'capsula', t: 'Cápsula de evaporación' }, { v: 'balon', t: 'Balón' }
    ] },
    { clave: 'rejilla', etiqueta: 'Con rejilla de amianto', tipo: 'bool', def: true },
    { clave: 'mechero', etiqueta: 'Con mechero encendido debajo', tipo: 'bool', def: true },
    { clave: 'pinza', etiqueta: 'Con pinza y termómetro', tipo: 'bool', def: false },
    P.color(), { clave: 'nivel', etiqueta: 'Qué tan lleno está (%)', tipo: 'numero', paso: 5, min: 0, max: 100, def: 55 },
    P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const g = grupo();
    const ancho = 420, alto = 520;
    const xVar = 90, yBase = 470;
    const yAro = 250;

    // base y varilla
    g.appendChild(rect(40, yBase, 190, 26, C.cuerpoOsc, C.trazo, 2, { rx: 4 }));
    g.appendChild(rect(xVar - 9, 90, 18, yBase - 90, C.metal, C.trazo, 1.8));

    // aro con rejilla
    g.appendChild(rect(xVar - 4, yAro - 12, 34, 24, C.metalOsc, C.trazo, 1.6, { rx: 3 }));   // nuez
    g.appendChild(linea(xVar + 24, yAro, 300, yAro, C.metalOsc, 6, { 'stroke-linecap': 'round' }));
    g.appendChild(svgEl('ellipse', { cx: 240, cy: yAro, rx: 68, ry: 12, fill: 'none', stroke: C.metalOsc, 'stroke-width': 5 }));
    if (p.rejilla) {
      g.appendChild(rect(240 - 62, yAro - 6, 124, 10, '#b9b2a0', C.trazo, 1.4, { rx: 2 }));
      g.appendChild(rect(240 - 30, yAro - 5, 60, 8, '#8d8577', null, 0));
    }

    // el recipiente de arriba
    const yApoyo = yAro - (p.rejilla ? 8 : 4);
    const nivel = acotar(p.nivel, 0, 100) / 100;
    const dibujarVaso = (w, h, forma) => {
      const x0 = 240 - w / 2, y0 = yApoyo - h;
      let d;
      if (forma === 'matraz') d = `M ${240 - 20} ${y0} L ${240 - 20} ${y0 + h * 0.28} L ${x0} ${yApoyo} L ${x0 + w} ${yApoyo} L ${240 + 20} ${y0 + h * 0.28} L ${240 + 20} ${y0} `;
      else if (forma === 'balon') d = `M ${240 - 16} ${y0} L ${240 - 16} ${y0 + 26} C ${240 - 80} ${y0 + 44} ${240 - 80} ${yApoyo} ${240} ${yApoyo} C ${240 + 80} ${yApoyo} ${240 + 80} ${y0 + 44} ${240 + 16} ${y0 + 26} L ${240 + 16} ${y0}`;
      else if (forma === 'capsula') d = `M ${x0} ${yApoyo - 26} Q ${240} ${yApoyo + 14} ${x0 + w} ${yApoyo - 26}`;
      else d = `M ${x0} ${y0} L ${x0} ${yApoyo} L ${x0 + w} ${yApoyo} L ${x0 + w} ${y0}`;
      const clipId = 'clipSop' + Math.random().toString(36).slice(2, 8);
      const clip = svgEl('clipPath', { id: clipId });
      clip.appendChild(svgEl('path', { d: d + ' Z' }));
      g.appendChild(clip);
      const yl = yApoyo - nivel * h * 0.8;
      if (nivel > 0) g.appendChild(rect(x0 - 10, yl, w + 20, yApoyo - yl, p.color || C.liquido, null, 0, { 'fill-opacity': 0.55, 'clip-path': `url(#${clipId})` }));
      g.appendChild(svgEl('path', { d, fill: 'none', stroke: C.vidrioBorde, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }));
    };
    if (p.encima === 'vaso') dibujarVaso(108, 100, 'vaso');
    else if (p.encima === 'matraz') dibujarVaso(120, 120, 'matraz');
    else if (p.encima === 'balon') dibujarVaso(120, 120, 'balon');
    else if (p.encima === 'capsula') dibujarVaso(110, 30, 'capsula');

    // pinza con termómetro
    if (p.pinza) {
      g.appendChild(rect(xVar - 4, 150, 30, 20, C.metalOsc, C.trazo, 1.6, { rx: 3 }));
      g.appendChild(linea(xVar + 22, 160, 214, 160, C.metalOsc, 5, { 'stroke-linecap': 'round' }));
      g.appendChild(rect(212, 150, 26, 20, C.metalOsc, C.trazo, 1.4, { rx: 3 }));
      g.appendChild(rect(222, 156, 8, yApoyo - 190, C.vidrio, C.vidrioBorde, 1.4, { rx: 4 }));
      g.appendChild(rect(223.5, yApoyo - 60, 5, 60, C.rojo, null, 0));
      g.appendChild(svgEl('circle', { cx: 226, cy: yApoyo - 6, r: 8, fill: C.rojo, stroke: C.vidrioBorde, 'stroke-width': 1.2 }));
    }

    // mechero debajo
    if (p.mechero) {
      const cxm = 240, yBm = yBase;
      g.appendChild(svgEl('ellipse', { cx: cxm, cy: yBm, rx: 52, ry: 11, fill: C.metalOsc, stroke: C.trazo, 'stroke-width': 1.6 }));
      g.appendChild(svgEl('path', { d: `M ${cxm - 52} ${yBm} L ${cxm - 20} ${yBm - 34} L ${cxm + 20} ${yBm - 34} L ${cxm + 52} ${yBm} Z`, fill: C.metal, stroke: C.trazo, 'stroke-width': 1.6 }));
      const yTuboM = yAro + 62;
      g.appendChild(rect(cxm - 13, yTuboM, 26, (yBm - 34) - yTuboM, C.metal, C.trazo, 1.6));
      g.appendChild(svgEl('path', { d: `M ${cxm} ${yAro + 14} C ${cxm + 22} ${yTuboM - 26} ${cxm + 16} ${yTuboM} ${cxm} ${yTuboM} C ${cxm - 16} ${yTuboM} ${cxm - 22} ${yTuboM - 26} ${cxm} ${yAro + 14} Z`, fill: '#4a90d9', 'fill-opacity': 0.85 }));
      g.appendChild(svgEl('path', { d: `M ${cxm} ${yAro + 34} C ${cxm + 11} ${yTuboM - 14} ${cxm + 8} ${yTuboM} ${cxm} ${yTuboM} C ${cxm - 8} ${yTuboM} ${cxm - 11} ${yTuboM - 14} ${cxm} ${yAro + 34} Z`, fill: '#1c5fa8', 'fill-opacity': 0.9 }));
    }
    rotulo(g, ancho / 2, alto - 10, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ---------- Gradilla con tubos de ensayo ----------
DEF.gradilla = {
  nombre: 'Gradilla con tubos de ensayo',
  icono: '🧫',
  categoria: 'Química',
  magnitud: 'Ensayos',
  resumen: 'La serie de tubos, cada uno con su rótulo y su color: sirve para mostrar los ensayos en paralelo y sus resultados.',
  comoSeLee: 'Se compara un tubo con otro, y siempre conviene tener uno de control. Los rótulos y los colores se cargan separados por comas, en el mismo orden que los tubos.',
  params: [
    { clave: 'cantidad', etiqueta: 'Cuántos tubos', tipo: 'numero', paso: 1, min: 1, max: 8, def: 4 },
    { clave: 'rotulos', etiqueta: 'Rótulo de cada tubo', tipo: 'texto', def: '1, 2, 3, control', ayuda: 'Separados por comas, en orden. Ej: agua, HCl, NaOH, control' },
    { clave: 'colores', etiqueta: 'Color de cada tubo', tipo: 'texto', def: '#3aa3d8, #d94f4f, #58b368, #cccccc', ayuda: 'Separados por comas. Aceptan #rrggbb o nombres de color en inglés. Poné «vacio» para dejarlo sin contenido.' },
    { clave: 'nivel', etiqueta: 'Qué tan llenos están (%)', tipo: 'numero', paso: 5, min: 0, max: 100, def: 55 },
    { clave: 'burbujas', etiqueta: 'Con burbujas (hay gas)', tipo: 'texto', def: '', ayuda: 'Números de los tubos donde hubo desprendimiento de gas, separados por comas. Ej: 2, 3' },
    { clave: 'precipitado', etiqueta: 'Con precipitado', tipo: 'texto', def: '', ayuda: 'Números de los tubos donde se formó un sólido. Ej: 3' },
    P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const n = Math.round(acotar(p.cantidad, 1, 8));
    const rotulos = String(p.rotulos || '').split(',').map(s => s.trim());
    const colores = String(p.colores || '').split(',').map(s => s.trim());
    const conGas = String(p.burbujas || '').split(',').map(s => Number(s.trim()));
    const conSolido = String(p.precipitado || '').split(',').map(s => Number(s.trim()));
    const nivel = acotar(p.nivel, 0, 100) / 100;
    const g = grupo();
    const paso = 92;
    const ancho = Math.max(320, n * paso + 60), alto = 470;
    const x0 = (ancho - n * paso) / 2 + paso / 2;
    const yTubo = 90, yFondo = 350, rTubo = 26;
    const yPlaca = 250, yBandeja = 372;   // la placa con los agujeros y la bandeja de abajo

    // los parantes van detrás de los tubos
    g.appendChild(rect(x0 - paso / 2 - 8, yPlaca, 14, yBandeja - yPlaca + 20, '#8f6d3c', C.trazo, 1.6));
    g.appendChild(rect(x0 + n * paso - paso / 2 - 6, yPlaca, 14, yBandeja - yPlaca + 20, '#8f6d3c', C.trazo, 1.6));

    for (let i = 0; i < n; i++) {
      const cx = x0 + i * paso;
      const col = colores[i] && colores[i] !== 'vacio' ? colores[i] : null;
      const d = `M ${cx - rTubo} ${yTubo} L ${cx - rTubo} ${yFondo - rTubo} A ${rTubo} ${rTubo} 0 0 0 ${cx + rTubo} ${yFondo - rTubo} L ${cx + rTubo} ${yTubo}`;
      const clipId = 'clipTubo' + i + Math.random().toString(36).slice(2, 6);
      const clip = svgEl('clipPath', { id: clipId });
      clip.appendChild(svgEl('path', { d: d + ' Z' }));
      g.appendChild(clip);
      g.appendChild(svgEl('path', { d: d + ' Z', fill: C.vidrio, stroke: 'none' }));
      if (col && nivel > 0) {
        const yl = yFondo - nivel * (yFondo - yTubo - 20);
        g.appendChild(rect(cx - rTubo - 4, yl, rTubo * 2 + 8, yFondo - yl, col, null, 0, { 'fill-opacity': 0.7, 'clip-path': `url(#${clipId})` }));
        if (conSolido.indexOf(i + 1) >= 0) {
          g.appendChild(svgEl('path', { d: `M ${cx - rTubo + 3} ${yFondo - 22} A ${rTubo} ${rTubo} 0 0 0 ${cx + rTubo - 3} ${yFondo - 22} Z`, fill: '#6b5b4a', 'clip-path': `url(#${clipId})` }));
        }
        if (conGas.indexOf(i + 1) >= 0) {
          for (let b = 0; b < 7; b++) {
            g.appendChild(svgEl('circle', { cx: r2(cx - 12 + (b * 17) % 24), cy: r2(yl + 14 + (b * 29) % Math.max(20, yFondo - yl - 24)), r: 3.4, fill: '#ffffff', 'fill-opacity': 0.85, 'clip-path': `url(#${clipId})` }));
          }
        }
      }
      g.appendChild(svgEl('path', { d, fill: 'none', stroke: C.vidrioBorde, 'stroke-width': 2 }));
      // rótulo pegado en la parte del tubo que queda por encima de la gradilla
      const rot = rotulos[i] || String(i + 1);
      g.appendChild(rect(cx - 30, 150, 60, 26, '#fffdf5', C.trazo, 1.2, { rx: 2 }));
      g.appendChild(texto(cx, 163, rot.length > 8 ? rot.slice(0, 7) + '…' : rot, { tam: rot.length > 5 ? 8.5 : 10.5, peso: 700, mono: false }));
      g.appendChild(texto(cx, 428, String(i + 1), { tam: 12, peso: 700, color: C.suave }));
    }

    // la placa y la bandeja se dibujan al final para que tapen los tubos: así
    // se ve que los tubos están metidos en la gradilla y no delante de ella
    g.appendChild(rect(x0 - paso / 2 - 8, yPlaca, n * paso + 16, 20, '#b08a52', C.trazo, 1.8, { rx: 3 }));
    g.appendChild(rect(x0 - paso / 2 - 8, yBandeja, n * paso + 16, 20, '#b08a52', C.trazo, 1.8, { rx: 3 }));
    rotulo(g, ancho / 2, alto - 10, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ---------- Filtración ----------
DEF.filtracion = {
  nombre: 'Filtración con embudo',
  icono: '⏳',
  categoria: 'Química',
  magnitud: 'Separación',
  resumen: 'El embudo con papel de filtro sobre un Erlenmeyer: la separación de un sólido de un líquido.',
  comoSeLee: 'El papel se dobla en cuatro y se moja para que quede pegado al embudo. Se vuelca por la varilla, sin pasar nunca del borde del papel. Lo que queda arriba es el residuo y lo que pasa es el filtrado.',
  params: [
    { clave: 'soporte', etiqueta: 'Sobre soporte con aro', tipo: 'bool', def: true },
    { clave: 'varilla', etiqueta: 'Con varilla de vidrio', tipo: 'bool', def: true },
    { clave: 'residuo', etiqueta: 'Con residuo sobre el papel', tipo: 'bool', def: true },
    P.color(), { clave: 'nivel', etiqueta: 'Filtrado recogido (%)', tipo: 'numero', paso: 5, min: 0, max: 100, def: 35 },
    { clave: 'rotulos', etiqueta: 'Rotular las partes', tipo: 'bool', def: true },
    P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const g = grupo();
    const ancho = 420, alto = 500;
    const cx = 200;
    const yEmbudo = 120, yPunta = 250, yBocaMatraz = 300, yBase = 450;

    if (p.soporte) {
      g.appendChild(rect(30, yBase, 130, 22, C.cuerpoOsc, C.trazo, 1.8, { rx: 4 }));
      g.appendChild(rect(86, 80, 16, yBase - 80, C.metal, C.trazo, 1.6));
      g.appendChild(rect(96, yEmbudo + 44, 28, 20, C.metalOsc, C.trazo, 1.4, { rx: 3 }));
      g.appendChild(linea(120, yEmbudo + 54, cx - 46, yEmbudo + 54, C.metalOsc, 5, { 'stroke-linecap': 'round' }));
      g.appendChild(svgEl('ellipse', { cx, cy: yEmbudo + 54, rx: 52, ry: 10, fill: 'none', stroke: C.metalOsc, 'stroke-width': 4.5 }));
    }

    // Erlenmeyer que recibe
    const dMatraz = `M ${cx - 20} ${yBocaMatraz} L ${cx - 20} ${yBocaMatraz + 34} L ${cx - 86} ${yBase - 12} Q ${cx - 86} ${yBase} ${cx - 70} ${yBase} L ${cx + 70} ${yBase} Q ${cx + 86} ${yBase} ${cx + 86} ${yBase - 12} L ${cx + 20} ${yBocaMatraz + 34} L ${cx + 20} ${yBocaMatraz}`;
    const clipId = 'clipFiltro' + Math.random().toString(36).slice(2, 8);
    const clip = svgEl('clipPath', { id: clipId });
    clip.appendChild(svgEl('path', { d: dMatraz + ' Z' }));
    g.appendChild(clip);
    const nivel = acotar(p.nivel, 0, 100) / 100;
    if (nivel > 0) {
      const yl = yBase - nivel * (yBase - yBocaMatraz - 50);
      g.appendChild(rect(cx - 90, yl, 180, yBase - yl, p.color || C.liquido, null, 0, { 'fill-opacity': 0.55, 'clip-path': `url(#${clipId})` }));
    }
    g.appendChild(svgEl('path', { d: dMatraz, fill: 'none', stroke: C.vidrioBorde, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }));

    // embudo
    g.appendChild(svgEl('path', { d: `M ${cx - 66} ${yEmbudo} L ${cx - 7} ${yPunta - 40} L ${cx - 7} ${yPunta} L ${cx + 7} ${yPunta} L ${cx + 7} ${yPunta - 40} L ${cx + 66} ${yEmbudo} Z`, fill: C.vidrio, stroke: C.vidrioBorde, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }));
    // papel de filtro
    g.appendChild(svgEl('path', { d: `M ${cx - 58} ${yEmbudo + 4} L ${cx} ${yPunta - 46} L ${cx + 58} ${yEmbudo + 4} Z`, fill: '#f6f3ea', stroke: '#c9c2ae', 'stroke-width': 1.4 }));
    g.appendChild(linea(cx, yEmbudo + 4, cx, yPunta - 46, '#c9c2ae', 1));
    if (p.residuo) {
      g.appendChild(svgEl('path', { d: `M ${cx - 34} ${yEmbudo + 34} L ${cx} ${yPunta - 52} L ${cx + 34} ${yEmbudo + 34} Z`, fill: '#8d7f6a' }));
    }
    // gota que cae
    g.appendChild(svgEl('ellipse', { cx, cy: yPunta + 18, rx: 4.5, ry: 7, fill: p.color || C.liquido, 'fill-opacity': 0.8 }));

    if (p.varilla) {
      g.appendChild(linea(cx - 96, yEmbudo - 34, cx - 20, yEmbudo + 20, C.vidrioBorde, 6, { 'stroke-linecap': 'round' }));
    }
    if (p.rotulos) {
      g.appendChild(texto(cx + 78, yEmbudo + 20, 'papel de filtro', { tam: 10, ancla: 'start', color: C.suave }));
      if (p.residuo) g.appendChild(texto(cx + 78, yEmbudo + 36, 'residuo', { tam: 10, ancla: 'start', color: C.suave }));
      g.appendChild(texto(cx + 96, yBase - 40, 'filtrado', { tam: 10, ancla: 'start', color: C.suave }));
    }
    rotulo(g, cx, alto - 6, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ---------- Pipeta con propipeta ----------
DEF.pipeta = {
  nombre: 'Pipeta con propipeta',
  icono: '🧪',
  categoria: 'Volumen',
  magnitud: 'Volumen',
  resumen: 'Pipeta aforada o graduada con su propipeta: el instrumento exacto para trasvasar un volumen.',
  comoSeLee: 'La aforada entrega un único volumen, el de su línea de aforo, y es la más exacta. La graduada permite volúmenes intermedios pero aprecia menos. Nunca se pipetea con la boca: siempre con propipeta.',
  params: [
    { clave: 'tipo', etiqueta: 'Tipo de pipeta', tipo: 'opcion', def: 'aforada', opciones: [
      { v: 'aforada', t: 'Aforada (un solo volumen)' }, { v: 'graduada', t: 'Graduada (con escala)' }
    ] },
    P.max(10, 'Capacidad de la pipeta.'), P.division(0.1), P.numerarCada(1), P.unidad('mL'),
    P.lectura(10),
    { clave: 'propipeta', etiqueta: 'Dibujar la propipeta', tipo: 'bool', def: true },
    P.color(), ...P.marca(), P.mostrarValor(true), P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const max = Math.max(0.1, Number(p.max));
    const lect = acotar(p.lectura, 0, max);
    const aforada = p.tipo === 'aforada';
    const g = grupo();
    const ancho = 260, alto = 600;
    const cx = 110;
    const yTop = p.propipeta ? 150 : 60, yPunta = 560;
    const yBulboA = yTop + 120, yBulboB = yTop + 250;   // el ensanchamiento de la aforada
    const yEscalaIni = yTop + 40, yEscalaFin = yPunta - 90;
    const yDe = v => yEscalaFin - (v / max) * (yEscalaFin - yEscalaIni);

    if (p.propipeta) {
      g.appendChild(svgEl('circle', { cx, cy: 92, r: 52, fill: '#c9d4d9', stroke: C.trazo, 'stroke-width': 2 }));
      g.appendChild(texto(cx, 92, 'S', { tam: 20, peso: 700, color: C.suave }));
      g.appendChild(rect(cx - 16, 138, 32, 22, '#c9d4d9', C.trazo, 1.6, { rx: 3 }));
    }

    // cuerpo de la pipeta
    if (aforada) {
      g.appendChild(svgEl('path', {
        d: `M ${cx - 7} ${yTop} L ${cx - 7} ${yBulboA} C ${cx - 34} ${yBulboA + 20} ${cx - 34} ${yBulboB - 20} ${cx - 7} ${yBulboB}
            L ${cx - 7} ${yPunta - 40} L ${cx - 2} ${yPunta} L ${cx + 2} ${yPunta} L ${cx + 7} ${yPunta - 40}
            L ${cx + 7} ${yBulboB} C ${cx + 34} ${yBulboB - 20} ${cx + 34} ${yBulboA + 20} ${cx + 7} ${yBulboA} L ${cx + 7} ${yTop} Z`,
        fill: C.vidrio, stroke: C.vidrioBorde, 'stroke-width': 2
      }));
      // línea de aforo
      const yA = yTop + 70;
      g.appendChild(linea(cx - 14, yA, cx + 14, yA, C.trazo, 1.8));
      g.appendChild(texto(cx + 22, yA, `${fmt(max, decimalesDe(p.division))} ${p.unidad}`, { tam: 12, peso: 700, ancla: 'start' }));
      g.appendChild(texto(cx + 22, yA + 15, 'aforo', { tam: 9, ancla: 'start', color: C.suave }));
      // líquido hasta el aforo
      g.appendChild(svgEl('path', {
        d: `M ${cx - 6} ${yA} L ${cx - 6} ${yBulboA} C ${cx - 32} ${yBulboA + 20} ${cx - 32} ${yBulboB - 20} ${cx - 6} ${yBulboB}
            L ${cx - 6} ${yPunta - 42} L ${cx + 6} ${yPunta - 42} L ${cx + 6} ${yBulboB}
            C ${cx + 32} ${yBulboB - 20} ${cx + 32} ${yBulboA + 20} ${cx + 6} ${yBulboA} L ${cx + 6} ${yA} Z`,
        fill: p.color || C.liquido, 'fill-opacity': 0.5
      }));
    } else {
      g.appendChild(rect(cx - 11, yTop, 22, yPunta - yTop - 40, C.vidrio, C.vidrioBorde, 2));
      g.appendChild(svgEl('path', { d: `M ${cx - 11} ${yPunta - 40} L ${cx - 2} ${yPunta} L ${cx + 2} ${yPunta} L ${cx + 11} ${yPunta - 40} Z`, fill: C.vidrio, stroke: C.vidrioBorde, 'stroke-width': 2 }));
      const yl = yDe(lect);
      g.appendChild(rect(cx - 9, yl, 18, (yPunta - 42) - yl, p.color || C.liquido, null, 0, { 'fill-opacity': 0.5 }));
      marcasLineales(0, max, p.division, p.numerarCada).forEach(m => {
        const y = yDe(m.v);
        const l = m.tipo === 'mayor' ? 16 : m.tipo === 'media' ? 10 : 6;
        g.appendChild(linea(cx - 11, y, cx - 11 + l, y, C.trazo, m.tipo === 'mayor' ? 1.3 : 0.8));
        if (m.tipo === 'mayor') g.appendChild(texto(cx + 18, y, fmt(m.v, decimalesDe(p.numerarCada)), { tam: 10, ancla: 'start' }));
      });
      const M = marcaCfg(p, lect);
      if (M.activa) {
        const ym = yDe(acotar(M.v, 0, max)) + M.correr;
        g.appendChild(linea(cx - 46, ym, cx + 14, ym, C.rojo, 1.4, { 'stroke-dasharray': '5 3' }));
        g.appendChild(flecha(cx - 50, ym, 'der', 9));
        rotuloMarca(g, cx + 52, ym - 6, M.texto);
      }
    }
    if (p.mostrarValor) carteLectura(g, 6, 8, fmt(aforada ? max : lect, decimalesDe(p.division)) + ' ' + p.unidad);
    rotulo(g, cx, alto - 10, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ---------- Papel indicador de pH ----------
DEF.papelPH = {
  nombre: 'Papel indicador de pH',
  icono: '📏',
  categoria: 'Química',
  magnitud: 'Acidez',
  resumen: 'La tirita mojada al lado de la escala de colores: la medida de pH más rápida y más barata.',
  comoSeLee: 'Se moja la tirita con una gota de la muestra (no se mete la tirita en el frasco) y a los pocos segundos se compara con la escala de la caja. El papel universal aprecia una unidad de pH; para más precisión hace falta un pHmetro.',
  params: [
    { clave: 'lectura', etiqueta: 'pH que muestra', tipo: 'numero', paso: 1, min: 0, max: 14, def: 4 },
    { clave: 'mostrarEscala', etiqueta: 'Dibujar la escala de colores', tipo: 'bool', def: true },
    { clave: 'mostrarValor', etiqueta: 'Escribir el número de pH', tipo: 'bool', def: true, ayuda: 'Apagalo para que el estudiante compare colores y lo deduzca.' },
    { clave: 'muestra', etiqueta: 'Qué se midió', tipo: 'texto', def: 'jugo de limón' },
    P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    // Colores del papel universal: rojo en ácido, verde en neutro, azul-violeta en base.
    const COLORES = ['#d0342c', '#e0562c', '#ee7d2b', '#f5a623', '#f7cb2f', '#dbe020', '#a8d02a',
      '#5fbb46', '#3aa76d', '#2e9e9e', '#2a7fbd', '#2f5fb5', '#3f43a8', '#5a2f9c', '#6b2382'];
    const ph = Math.round(acotar(p.lectura, 0, 14));
    const g = grupo();
    const ancho = 560, alto = 300;

    // la tirita
    g.appendChild(rect(50, 60, 46, 170, '#f4f0e2', C.trazo, 1.6, { rx: 3 }));
    g.appendChild(rect(50, 60, 46, 78, COLORES[ph], C.trazo, 1.4, { rx: 3 }));
    g.appendChild(texto(73, 250, 'la tirita', { tam: 11, peso: 700, mono: false }));
    if (p.muestra) g.appendChild(texto(73, 268, p.muestra, { tam: 10, color: C.suave, mono: false }));

    if (p.mostrarEscala) {
      const x0 = 150, w = 26;
      g.appendChild(texto(x0 + 7.5 * w, 46, 'escala de comparación', { tam: 11, peso: 700, mono: false }));
      for (let i = 0; i <= 14; i++) {
        const x = x0 + i * w;
        const activo = i === ph;
        g.appendChild(rect(x, 60, w - 2, 78, COLORES[i], activo ? C.rojo : C.trazo, activo ? 2.6 : 1, { rx: 2 }));
        g.appendChild(texto(x + (w - 2) / 2, 152, String(i), { tam: 11, peso: activo ? 700 : 400, color: activo ? C.rojo : C.trazo }));
      }
      g.appendChild(linea(x0, 172, x0 + 5 * w, 172, '#d0342c', 3));
      g.appendChild(texto(x0 + 2.5 * w, 188, 'ácido', { tam: 11, peso: 700, color: '#d0342c', mono: false }));
      g.appendChild(linea(x0 + 6 * w, 172, x0 + 8 * w, 172, '#3aa76d', 3));
      g.appendChild(texto(x0 + 7 * w, 188, 'neutro', { tam: 11, peso: 700, color: '#3aa76d', mono: false }));
      g.appendChild(linea(x0 + 9 * w, 172, x0 + 15 * w, 172, '#3f43a8', 3));
      g.appendChild(texto(x0 + 12 * w, 188, 'básico', { tam: 11, peso: 700, color: '#3f43a8', mono: false }));
      if (p.mostrarValor) {
        const x = x0 + ph * w + (w - 2) / 2;
        g.appendChild(flecha(x, 214, 'arriba', 10));
        g.appendChild(texto(x, 234, 'pH = ' + ph, { tam: 13, peso: 700, color: C.rojo }));
      }
    } else if (p.mostrarValor) {
      carteLectura(g, 130, 84, 'pH = ' + ph);
    }
    rotulo(g, ancho / 2, alto - 8, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ---------- Agitador magnético con calefacción ----------
DEF.agitador = {
  nombre: 'Agitador magnético',
  icono: '🌀',
  categoria: 'Química',
  magnitud: 'Agitación y temperatura',
  resumen: 'La placa que agita con una barrita magnética y, si hace falta, calienta.',
  comoSeLee: 'La barrita se pone en el vaso antes del líquido y se arranca despacio: si se pone al máximo de golpe, salta y salpica. La temperatura de la placa no es la del líquido: si querés la del líquido, medila con un termómetro adentro.',
  params: [
    { clave: 'rpm', etiqueta: 'Velocidad (rpm)', tipo: 'numero', paso: 50, min: 0, max: 1500, def: 400 },
    { clave: 'calienta', etiqueta: 'Calentando', tipo: 'bool', def: true },
    { clave: 'temperatura', etiqueta: 'Temperatura de la placa (°C)', tipo: 'numero', paso: 5, min: 0, max: 350, def: 60 },
    { clave: 'termometro', etiqueta: 'Con termómetro en el vaso', tipo: 'bool', def: true },
    P.color(), { clave: 'nivel', etiqueta: 'Qué tan lleno está (%)', tipo: 'numero', paso: 5, min: 0, max: 100, def: 60 },
    P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const g = grupo();
    const ancho = 400, alto = 440;
    const cx = 190, yPlaca = 300;

    // cuerpo del agitador
    g.appendChild(rect(50, yPlaca, 300, 96, C.cuerpo, C.trazo, 2.2, { rx: 10 }));
    g.appendChild(svgEl('circle', { cx, cy: yPlaca + 4, r: 84, fill: p.calienta ? '#e7cfc4' : C.metal, stroke: C.trazo, 'stroke-width': 1.8 }));
    if (p.calienta) g.appendChild(svgEl('circle', { cx, cy: yPlaca + 4, r: 84, fill: 'none', stroke: C.rojo, 'stroke-width': 2.4, 'stroke-dasharray': '6 5' }));
    // perillas y pantallitas
    pantallaLCD(g, 250, yPlaca + 20, 88, 30, String(Math.round(acotar(p.rpm, 0, 1500))), 'rpm', { tamNum: 17 });
    pantallaLCD(g, 250, yPlaca + 56, 88, 30, p.calienta ? String(Math.round(acotar(p.temperatura, 0, 350))) : '--', '°C', { tamNum: 17 });
    [{ x: 92, t: 'rpm' }, { x: 156, t: '°C' }].forEach(k => {
      g.appendChild(svgEl('circle', { cx: k.x, cy: yPlaca + 52, r: 22, fill: C.cuerpoOsc, stroke: C.trazo, 'stroke-width': 1.6 }));
      g.appendChild(linea(k.x, yPlaca + 52, k.x + 14, yPlaca + 40, '#ffffff', 3, { 'stroke-linecap': 'round' }));
      g.appendChild(texto(k.x, yPlaca + 84, k.t, { tam: 10, peso: 700 }));
    });

    // el vaso con el vórtice
    const yBocaV = 110, yFondoV = yPlaca - 2, w = 130;
    const nivel = acotar(p.nivel, 0, 100) / 100;
    const yl = yFondoV - nivel * (yFondoV - yBocaV - 16);
    g.appendChild(rect(cx - w / 2, yl, w, yFondoV - yl, p.color || C.liquido, null, 0, { 'fill-opacity': 0.5 }));
    // el vórtice que arma la agitación
    if (Number(p.rpm) > 0) {
      const hondo = Math.min(46, 8 + Number(p.rpm) / 26);
      g.appendChild(svgEl('path', { d: `M ${cx - w / 2 + 3} ${r2(yl)} Q ${cx} ${r2(yl + hondo)} ${cx + w / 2 - 3} ${r2(yl)} L ${cx + w / 2 - 3} ${r2(yl + 4)} Q ${cx} ${r2(yl + hondo + 4)} ${cx - w / 2 + 3} ${r2(yl + 4)} Z`, fill: '#ffffff', 'fill-opacity': 0.85 }));
    }
    g.appendChild(svgEl('path', { d: `M ${cx - w / 2} ${yBocaV} L ${cx - w / 2} ${yFondoV} L ${cx + w / 2} ${yFondoV} L ${cx + w / 2} ${yBocaV}`, fill: 'none', stroke: C.vidrioBorde, 'stroke-width': 2.4 }));
    // la barrita magnética girando
    g.appendChild(svgEl('ellipse', { cx, cy: yFondoV - 10, rx: 30, ry: 8, fill: '#ffffff', stroke: C.trazo, 'stroke-width': 1.4 }));
    if (Number(p.rpm) > 0) {
      g.appendChild(svgEl('path', { d: `M ${cx - 44} ${yFondoV - 22} A 44 14 0 0 1 ${cx + 44} ${yFondoV - 22}`, fill: 'none', stroke: C.suave, 'stroke-width': 1.4, 'stroke-dasharray': '5 4' }));
      g.appendChild(flecha(cx + 44, yFondoV - 20, 'abajo', 7, C.suave));
    }

    if (p.termometro) {
      g.appendChild(rect(cx + 34, 70, 10, yFondoV - 100, C.vidrio, C.vidrioBorde, 1.4, { rx: 5 }));
      g.appendChild(rect(cx + 36, yFondoV - 120, 6, 88, C.rojo, null, 0));
      g.appendChild(svgEl('circle', { cx: cx + 39, cy: yFondoV - 28, r: 9, fill: C.rojo, stroke: C.vidrioBorde, 'stroke-width': 1.2 }));
    }
    rotulo(g, ancho / 2, alto - 8, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ---------- Equipo de destilación simple ----------
DEF.destilacion = {
  nombre: 'Destilación simple',
  icono: '⚗️',
  categoria: 'Química',
  magnitud: 'Separación',
  resumen: 'Balón, termómetro, refrigerante y colector: la separación de líquidos por su punto de ebullición.',
  comoSeLee: 'El bulbo del termómetro va a la altura de la salida lateral, no metido en el líquido: lo que interesa es la temperatura del vapor que sale. El agua del refrigerante entra por abajo y sale por arriba, para que el tubo quede siempre lleno.',
  params: [
    { clave: 'temperatura', etiqueta: 'Temperatura del vapor (°C)', tipo: 'numero', paso: 1, min: 0, max: 200, def: 78 },
    { clave: 'sustancia', etiqueta: 'Qué se destila', tipo: 'texto', def: 'alcohol y agua' },
    P.color('#c9d8e8'),
    { clave: 'recogido', etiqueta: 'Destilado recogido (%)', tipo: 'numero', paso: 5, min: 0, max: 100, def: 25 },
    { clave: 'rotulos', etiqueta: 'Rotular las partes', tipo: 'bool', def: true },
    P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const g = grupo();
    const ancho = 720, alto = 480;
    const yMesa = 430;

    // ---- balón sobre la placa ----
    const cxB = 150, cyB = 300;
    g.appendChild(rect(cxB - 90, yMesa - 40, 180, 40, C.cuerpo, C.trazo, 2, { rx: 8 }));
    g.appendChild(svgEl('circle', { cx: cxB, cy: yMesa - 44, r: 62, fill: '#e7cfc4', stroke: C.trazo, 'stroke-width': 1.4 }));
    g.appendChild(svgEl('circle', { cx: cxB, cy: cyB, r: 62, fill: C.vidrio, stroke: C.vidrioBorde, 'stroke-width': 2.2 }));
    const nivelB = 0.55;
    g.appendChild(svgEl('path', { d: `M ${cxB - 60} ${cyB + 12} A 62 62 0 0 0 ${cxB + 60} ${cyB + 12} Z`, fill: p.color || '#c9d8e8', 'fill-opacity': 0.6 }));
    // burbujas de ebullición
    [0, 1, 2, 3].forEach(i => g.appendChild(svgEl('circle', { cx: cxB - 26 + i * 17, cy: cyB + 30 - (i % 2) * 12, r: 4, fill: '#ffffff', 'fill-opacity': 0.8 })));
    g.appendChild(rect(cxB - 20, cyB - 118, 40, 62, C.vidrio, C.vidrioBorde, 2.2));      // cuello

    // ---- cabeza con termómetro ----
    const yCabeza = cyB - 118;
    g.appendChild(rect(cxB - 26, yCabeza - 30, 52, 34, C.vidrio, C.vidrioBorde, 2.2, { rx: 4 }));
    g.appendChild(rect(cxB - 7, 58, 14, yCabeza - 60, C.vidrio, C.vidrioBorde, 1.6, { rx: 7 }));
    const t = acotar(p.temperatura, 0, 200);
    g.appendChild(rect(cxB - 4.5, yCabeza - 24 - (t / 200) * 100, 9, (t / 200) * 100 + 24, C.rojo, null, 0));
    g.appendChild(svgEl('circle', { cx: cxB, cy: yCabeza - 14, r: 9, fill: C.rojo, stroke: C.vidrioBorde, 'stroke-width': 1.2 }));
    carteLectura(g, cxB + 22, 62, fmt(t, 0) + ' °C');

    // ---- refrigerante inclinado ----
    const x1 = cxB + 26, y1 = yCabeza - 16, x2 = 500, y2 = 250;
    const dx = x2 - x1, dy = y2 - y1;
    const largo = Math.sqrt(dx * dx + dy * dy);
    const ang = Math.atan2(dy, dx) * 180 / Math.PI;
    const tuboG = grupo({ transform: `translate(${r2(x1)} ${r2(y1)}) rotate(${r2(ang)})` });
    tuboG.appendChild(rect(0, -26, largo, 52, C.vidrio, C.vidrioBorde, 2.2, { rx: 6 }));
    tuboG.appendChild(rect(0, -9, largo, 18, '#ffffff', C.vidrioBorde, 1.4));
    // camisa de agua
    tuboG.appendChild(rect(largo * 0.12, -34, 16, 16, C.vidrio, C.vidrioBorde, 1.8));
    tuboG.appendChild(rect(largo * 0.78, 18, 16, 16, C.vidrio, C.vidrioBorde, 1.8));
    for (let i = 1; i < 7; i++) tuboG.appendChild(linea(largo * i / 7, -26, largo * i / 7, -10, '#8fb8cf', 1.2));
    g.appendChild(tuboG);
    if (p.rotulos) {
      g.appendChild(texto(x1 + dx * 0.16, y1 + dy * 0.16 - 48, 'sale el agua', { tam: 10, color: '#2a7fbd' }));
      g.appendChild(texto(x2 - 60, y2 + 56, 'entra el agua', { tam: 10, color: '#2a7fbd' }));
      g.appendChild(texto((x1 + x2) / 2, (y1 + y2) / 2 - 44, 'refrigerante', { tam: 11, peso: 700, mono: false }));
    }

    // ---- colector ----
    const cxC = 590, yBocaC = 300;
    g.appendChild(svgEl('path', { d: `M ${x2} ${y2 + 10} L ${cxC - 8} ${yBocaC - 20} L ${cxC + 8} ${yBocaC - 20} L ${x2 + 14} ${y2 + 26} Z`, fill: C.vidrio, stroke: C.vidrioBorde, 'stroke-width': 2 }));
    const dC = `M ${cxC - 20} ${yBocaC} L ${cxC - 20} ${yBocaC + 30} L ${cxC - 76} ${yMesa - 12} Q ${cxC - 76} ${yMesa} ${cxC - 62} ${yMesa} L ${cxC + 62} ${yMesa} Q ${cxC + 76} ${yMesa} ${cxC + 76} ${yMesa - 12} L ${cxC + 20} ${yBocaC + 30} L ${cxC + 20} ${yBocaC}`;
    const clipId = 'clipDest' + Math.random().toString(36).slice(2, 8);
    const clip = svgEl('clipPath', { id: clipId });
    clip.appendChild(svgEl('path', { d: dC + ' Z' }));
    g.appendChild(clip);
    const nivelC = acotar(p.recogido, 0, 100) / 100;
    if (nivelC > 0) {
      const yl = yMesa - nivelC * (yMesa - yBocaC - 40);
      g.appendChild(rect(cxC - 80, yl, 160, yMesa - yl, C.liquido, null, 0, { 'fill-opacity': 0.5, 'clip-path': `url(#${clipId})` }));
    }
    g.appendChild(svgEl('path', { d: dC, fill: 'none', stroke: C.vidrioBorde, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }));
    if (p.rotulos) {
      g.appendChild(texto(cxC, yMesa + 22, 'destilado', { tam: 11, peso: 700, mono: false }));
      g.appendChild(texto(cxB, yMesa + 22, p.sustancia || '', { tam: 11, mono: false, color: C.suave }));
    }
    rotulo(g, ancho / 2, alto - 6, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ---------- Fuente de tensión regulable ----------
DEF.fuente = {
  nombre: 'Fuente de tensión regulable',
  icono: '🔋',
  categoria: 'Electricidad',
  magnitud: 'Tensión y corriente',
  resumen: 'La fuente de laboratorio con sus dos pantallas: la tensión que entrega y la corriente que está pasando.',
  comoSeLee: 'Se arranca siempre en cero y se sube de a poco. El limitador de corriente se pone antes de conectar: si el circuito pide más, la fuente baja sola la tensión y se enciende el aviso CC, que es la señal de que algo está consumiendo de más.',
  params: [
    { clave: 'tension', etiqueta: 'Tensión que entrega (V)', tipo: 'numero', paso: 0.1, min: 0, max: 60, def: 6 },
    { clave: 'corriente', etiqueta: 'Corriente que pasa (A)', tipo: 'numero', paso: 0.01, min: 0, max: 10, def: 0.35 },
    { clave: 'limitando', etiqueta: 'Está limitando la corriente (CC)', tipo: 'bool', def: false },
    { clave: 'encendida', etiqueta: 'Encendida', tipo: 'bool', def: true },
    { clave: 'cables', etiqueta: 'Dibujar los cables', tipo: 'bool', def: true },
    P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const g = grupo();
    const ancho = 460, alto = 360;
    g.appendChild(rect(30, 30, 400, 250, C.cuerpo, C.trazo, 2.4, { rx: 12 }));
    pantallaLCD(g, 52, 54, 168, 74, p.encendida ? fmt(p.tension, 2) : '', 'V', { tamNum: 34, arriba: 'TENSIÓN' });
    pantallaLCD(g, 240, 54, 168, 74, p.encendida ? fmt(p.corriente, 2) : '', 'A', { tamNum: 34, arriba: 'CORRIENTE' });
    // avisos de modo
    [{ x: 60, t: 'CV', on: p.encendida && !p.limitando }, { x: 118, t: 'CC', on: p.encendida && p.limitando }].forEach(a => {
      g.appendChild(svgEl('circle', { cx: a.x, cy: 152, r: 7, fill: a.on ? (a.t === 'CC' ? C.rojo : '#4caf50') : C.tenue, stroke: C.trazo, 'stroke-width': 1 }));
      g.appendChild(texto(a.x + 20, 152, a.t, { tam: 11, peso: 700 }));
    });
    // perillas de ajuste grueso y fino
    [{ x: 250, t: 'V' }, { x: 350, t: 'A' }].forEach(k => {
      g.appendChild(svgEl('circle', { cx: k.x, cy: 190, r: 34, fill: C.cuerpoOsc, stroke: C.trazo, 'stroke-width': 1.8 }));
      g.appendChild(linea(k.x, 190, k.x + 22, 172, '#ffffff', 4, { 'stroke-linecap': 'round' }));
      g.appendChild(texto(k.x, 238, 'ajuste ' + k.t, { tam: 10, peso: 700 }));
    });
    g.appendChild(rect(52, 176, 60, 30, C.metal, C.trazo, 1.6, { rx: 4 }));
    g.appendChild(texto(82, 191, p.encendida ? 'ON' : 'OFF', { tam: 11, peso: 700 }));
    // bornes
    const bornes = [{ x: 130, t: '+', c: C.rojo }, { x: 190, t: '−', c: '#222' }];
    bornes.forEach(b => {
      g.appendChild(svgEl('circle', { cx: b.x, cy: 252, r: 15, fill: C.metal, stroke: b.c, 'stroke-width': 3.4 }));
      g.appendChild(texto(b.x, 252, b.t, { tam: 15, peso: 700, color: b.c }));
    });
    if (p.cables) {
      g.appendChild(svgEl('path', { d: `M 130 267 C 130 320 90 320 40 340`, fill: 'none', stroke: C.rojo, 'stroke-width': 4.5 }));
      g.appendChild(svgEl('path', { d: `M 190 267 C 190 320 240 320 300 340`, fill: 'none', stroke: '#222', 'stroke-width': 4.5 }));
    }
    rotulo(g, 230, 344, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ---------- Circuito eléctrico ----------
DEF.circuito = {
  nombre: 'Circuito eléctrico',
  icono: '💡',
  categoria: 'Electricidad',
  magnitud: 'Esquema',
  resumen: 'El esquema del circuito con sus símbolos normalizados: fuente, llave, componente y los instrumentos donde van.',
  comoSeLee: 'El amperímetro va SIEMPRE en serie, intercalado en el camino de la corriente; el voltímetro va SIEMPRE en paralelo, tocando los dos extremos del componente. Cambiarlos de lugar es el error más caro del laboratorio.',
  params: [
    { clave: 'fuente', etiqueta: 'Fuente', tipo: 'opcion', def: 'pila', opciones: [
      { v: 'pila', t: 'Pila' }, { v: 'bateria', t: 'Batería (varias pilas)' }, { v: 'fuente', t: 'Fuente regulable' }
    ] },
    { clave: 'componente', etiqueta: 'Componente principal', tipo: 'opcion', def: 'lampara', opciones: [
      { v: 'lampara', t: 'Lámpara' }, { v: 'resistencia', t: 'Resistencia' }, { v: 'led', t: 'LED con resistencia' },
      { v: 'motor', t: 'Motor' }, { v: 'timbre', t: 'Timbre' }
    ] },
    { clave: 'conexion', etiqueta: 'Con un segundo componente', tipo: 'opcion', def: 'no', opciones: [
      { v: 'no', t: 'No, uno solo' }, { v: 'serie', t: 'Otro igual en serie' }, { v: 'paralelo', t: 'Otro igual en paralelo' }
    ] },
    { clave: 'llave', etiqueta: 'Llave', tipo: 'opcion', def: 'cerrada', opciones: [
      { v: 'cerrada', t: 'Cerrada (pasa corriente)' }, { v: 'abierta', t: 'Abierta' }, { v: 'sin', t: 'Sin llave' }
    ] },
    { clave: 'amperimetro', etiqueta: 'Con amperímetro (en serie)', tipo: 'bool', def: true },
    { clave: 'voltimetro', etiqueta: 'Con voltímetro (en paralelo)', tipo: 'bool', def: true },
    // Un campo por valor: si fueran todos en una línea separada por comas, un
    // «0,35 A» se partiría al medio.
    { clave: 'valorFuente', etiqueta: 'Valor de la fuente', tipo: 'texto', def: '6 V' },
    { clave: 'valorCorriente', etiqueta: 'Valor del amperímetro', tipo: 'texto', def: '0,35 A' },
    { clave: 'valorComponente', etiqueta: 'Valor del componente', tipo: 'texto', def: '17 Ω' },
    P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const g = grupo();
    const ancho = 720, alto = 420;
    const xI = 80, xD = 500, yA = 110, yB = 330;    // el rectángulo del circuito
    const vFuente = String(p.valorFuente || '');
    const vCorriente = String(p.valorCorriente || '');
    const vComponente = String(p.valorComponente || '');
    const cable = (x1, y1, x2, y2) => g.appendChild(linea(x1, y1, x2, y2, C.trazo, 2.4));

    // ---- la fuente, sobre el lado izquierdo ----
    const yF = (yA + yB) / 2;
    const pila = (y, alto2) => {
      g.appendChild(linea(xI - 16, y, xI + 16, y, C.trazo, 3));                    // placa larga (+)
      g.appendChild(linea(xI - 8, y + alto2, xI + 8, y + alto2, C.trazo, 6));      // placa corta (−)
    };
    if (p.fuente === 'fuente') {
      g.appendChild(rect(xI - 34, yF - 34, 68, 68, C.cuerpo, C.trazo, 2.4, { rx: 6 }));
      g.appendChild(texto(xI, yF - 8, 'FUENTE', { tam: 9, peso: 700 }));
      g.appendChild(texto(xI, yF + 10, vFuente, { tam: 12, peso: 700 }));
      cable(xI, yA, xI, yF - 34);
      cable(xI, yF + 34, xI, yB);
    } else {
      const n = p.fuente === 'bateria' ? 3 : 1;
      const alto2 = 14, sep = 26;
      const yIni = yF - (n * sep) / 2;
      for (let i = 0; i < n; i++) pila(yIni + i * sep, alto2);
      cable(xI, yA, xI, yIni);
      cable(xI, yIni + (n - 1) * sep + alto2, xI, yB);
      g.appendChild(texto(xI - 30, yF, vFuente, { tam: 12, peso: 700, ancla: 'end' }));
    }

    // ---- lado de arriba: llave y amperímetro ----
    let x = xI;
    const xLlave = 190;
    cable(x, yA, xLlave - 24, yA);
    if (p.llave !== 'sin') {
      g.appendChild(svgEl('circle', { cx: xLlave - 24, cy: yA, r: 4, fill: C.trazo }));
      g.appendChild(svgEl('circle', { cx: xLlave + 24, cy: yA, r: 4, fill: C.trazo }));
      const abierta = p.llave === 'abierta';
      g.appendChild(linea(xLlave - 24, yA, xLlave + (abierta ? 14 : 24), yA + (abierta ? -26 : 0), C.trazo, 2.8, { 'stroke-linecap': 'round' }));
      g.appendChild(texto(xLlave, yA + 24, abierta ? 'llave abierta' : 'llave cerrada', { tam: 10, color: C.suave }));
    } else {
      cable(xLlave - 24, yA, xLlave + 24, yA);
    }
    x = xLlave + 24;
    if (p.amperimetro) {
      const xAm = 340;
      cable(x, yA, xAm - 26, yA);
      g.appendChild(svgEl('circle', { cx: xAm, cy: yA, r: 26, fill: '#ffffff', stroke: C.trazo, 'stroke-width': 2.4 }));
      g.appendChild(texto(xAm, yA, 'A', { tam: 20, peso: 700, mono: false }));
      g.appendChild(texto(xAm, yA - 42, vCorriente, { tam: 12, peso: 700 }));
      g.appendChild(texto(xAm, yA + 44, 'en serie', { tam: 10, color: C.suave }));
      x = xAm + 26;
    }
    cable(x, yA, xD, yA);

    // ---- lado derecho: el componente ----
    const dibujarComponente = (cxc, cyc, tipo) => {
      if (tipo === 'lampara') {
        g.appendChild(svgEl('circle', { cx: cxc, cy: cyc, r: 24, fill: '#fff8d6', stroke: C.trazo, 'stroke-width': 2.4 }));
        g.appendChild(linea(cxc - 17, cyc - 17, cxc + 17, cyc + 17, C.trazo, 2));
        g.appendChild(linea(cxc + 17, cyc - 17, cxc - 17, cyc + 17, C.trazo, 2));
      } else if (tipo === 'resistencia') {
        g.appendChild(rect(cxc - 26, cyc - 14, 52, 28, '#ffffff', C.trazo, 2.4, { rx: 2 }));
      } else if (tipo === 'led') {
        g.appendChild(rect(cxc - 46, cyc - 12, 34, 24, '#ffffff', C.trazo, 2.2, { rx: 2 }));
        g.appendChild(svgEl('polygon', { points: `${cxc + 4},${cyc - 16} ${cxc + 4},${cyc + 16} ${cxc + 26},${cyc}`, fill: '#ffffff', stroke: C.trazo, 'stroke-width': 2.2 }));
        g.appendChild(linea(cxc + 26, cyc - 16, cxc + 26, cyc + 16, C.trazo, 2.8));
        g.appendChild(linea(cxc + 14, cyc - 22, cxc + 26, cyc - 34, C.trazo, 1.8));
        g.appendChild(linea(cxc + 24, cyc - 20, cxc + 36, cyc - 32, C.trazo, 1.8));
      } else if (tipo === 'motor') {
        g.appendChild(svgEl('circle', { cx: cxc, cy: cyc, r: 24, fill: '#ffffff', stroke: C.trazo, 'stroke-width': 2.4 }));
        g.appendChild(texto(cxc, cyc, 'M', { tam: 20, peso: 700, mono: false }));
      } else {
        g.appendChild(svgEl('path', { d: `M ${cxc - 22} ${cyc + 14} L ${cxc - 22} ${cyc - 6} A 22 22 0 0 1 ${cxc + 22} ${cyc - 6} L ${cxc + 22} ${cyc + 14} Z`, fill: '#ffffff', stroke: C.trazo, 'stroke-width': 2.4 }));
      }
    };

    const yC = (yA + yB) / 2;
    if (p.conexion === 'paralelo') {
      const xRama = xD + 0;
      cable(xD, yA, xRama, yA);
      [yC - 46, yC + 46].forEach(yy => {
        cable(xRama, yy, xRama - 60, yy);
        dibujarComponente(xRama - 90, yy, p.componente);
        cable(xRama - 120, yy, xRama - 180, yy);
      });
      cable(xRama, yA, xRama, yC + 46);
      cable(xRama - 180, yC - 46, xRama - 180, yC + 46);
      cable(xRama - 180, yC, xD - 180, yB);
      cable(xD - 180, yB, xI, yB);
      g.appendChild(texto(xRama - 90, yC, 'en paralelo', { tam: 10, color: C.suave }));
    } else if (p.conexion === 'serie') {
      cable(xD, yA, xD, yC - 60);
      dibujarComponente(xD, yC - 30, p.componente);
      cable(xD, yC - 6, xD, yC + 6);
      dibujarComponente(xD, yC + 36, p.componente);
      cable(xD, yC + 60, xD, yB);
      cable(xD, yB, xI, yB);
      g.appendChild(texto(xD - 60, yC, 'en serie', { tam: 10, color: C.suave, ancla: 'end' }));
    } else {
      cable(xD, yA, xD, yC - 26);
      dibujarComponente(xD, yC, p.componente);
      cable(xD, yC + 26, xD, yB);
      cable(xD, yB, xI, yB);
      g.appendChild(texto(xD - 46, yC, vComponente, { tam: 12, peso: 700, ancla: 'end' }));
    }

    // ---- voltímetro: en paralelo, afuera del lazo, para que la conexión se
    // lea de un vistazo y no cruce el resto del circuito ----
    if (p.voltimetro) {
      const xV = xD + 150, yV = yC;
      const yArriba = yC - 46, yAbajo = yC + 46;
      g.appendChild(svgEl('circle', { cx: r2(xD), cy: r2(yArriba), r: 4, fill: C.trazo }));
      g.appendChild(svgEl('circle', { cx: r2(xD), cy: r2(yAbajo), r: 4, fill: C.trazo }));
      g.appendChild(svgEl('path', { d: `M ${xD} ${r2(yArriba)} L ${xV} ${r2(yArriba)} L ${xV} ${r2(yV - 26)}`, fill: 'none', stroke: C.trazo, 'stroke-width': 2.4 }));
      g.appendChild(svgEl('path', { d: `M ${xD} ${r2(yAbajo)} L ${xV} ${r2(yAbajo)} L ${xV} ${r2(yV + 26)}`, fill: 'none', stroke: C.trazo, 'stroke-width': 2.4 }));
      g.appendChild(svgEl('circle', { cx: xV, cy: r2(yV), r: 26, fill: '#ffffff', stroke: C.trazo, 'stroke-width': 2.4 }));
      g.appendChild(texto(xV, yV, 'V', { tam: 20, peso: 700, mono: false }));
      g.appendChild(texto(xV, yV + 62, 'en paralelo', { tam: 10, color: C.suave }));
      g.appendChild(texto(xV + 38, yV - 2, vFuente, { tam: 12, peso: 700, ancla: 'start' }));
    }
    rotulo(g, ancho / 2, alto - 8, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ---------- Plano inclinado ----------
DEF.planoInclinado = {
  nombre: 'Plano inclinado',
  icono: '📐',
  categoria: 'Fuerza',
  magnitud: 'Fuerza y movimiento',
  resumen: 'La rampa con el carrito, el ángulo y —si se piden— las fuerzas descompuestas.',
  comoSeLee: 'El ángulo se mide entre la rampa y la horizontal. El peso siempre apunta hacia abajo; lo que cambia con el ángulo es cuánto de ese peso empuja al carrito rampa abajo y cuánto lo aprieta contra la superficie.',
  params: [
    { clave: 'angulo', etiqueta: 'Ángulo de la rampa (°)', tipo: 'numero', paso: 1, min: 5, max: 60, def: 25 },
    { clave: 'movil', etiqueta: 'Qué se desliza', tipo: 'opcion', def: 'carrito', opciones: [
      { v: 'carrito', t: 'Carrito con ruedas' }, { v: 'bloque', t: 'Bloque (con rozamiento)' }, { v: 'esfera', t: 'Esfera que rueda' }
    ] },
    { clave: 'fuerzas', etiqueta: 'Dibujar las fuerzas', tipo: 'bool', def: true },
    { clave: 'medidas', etiqueta: 'Marcar altura y largo', tipo: 'bool', def: true },
    { clave: 'altura', etiqueta: 'Altura (texto)', tipo: 'texto', def: 'h = 25 cm' },
    { clave: 'largo', etiqueta: 'Largo de la rampa (texto)', tipo: 'texto', def: 'L = 60 cm' },
    { clave: 'posicion', etiqueta: 'Dónde está el móvil (%)', tipo: 'numero', paso: 5, min: 5, max: 95, def: 60 },
    { clave: 'dinamometro', etiqueta: 'Con dinamómetro tirando', tipo: 'bool', def: false },
    P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const ang = acotar(p.angulo, 5, 60);
    const rad = ang * Math.PI / 180;
    const g = grupo();
    const ancho = 640, alto = 420;
    const xA = 70, yBase = 340;                 // vértice del ángulo
    const largo = 440;
    const xB = xA + largo * Math.cos(rad), yB = yBase - largo * Math.sin(rad);

    // mesa y rampa
    g.appendChild(rect(30, yBase, 580, 16, C.cuerpoOsc, C.trazo, 1.6, { rx: 3 }));
    g.appendChild(svgEl('path', { d: `M ${r2(xA)} ${yBase} L ${r2(xB)} ${r2(yB)} L ${r2(xB)} ${yBase} Z`, fill: '#e6e0d2', stroke: C.trazo, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }));

    // arco del ángulo
    const R = 62;
    g.appendChild(svgEl('path', { d: `M ${xA + R} ${yBase} A ${R} ${R} 0 0 0 ${r2(xA + R * Math.cos(rad))} ${r2(yBase - R * Math.sin(rad))}`, fill: 'none', stroke: C.rojo, 'stroke-width': 1.6 }));
    g.appendChild(texto(xA + R + 26, yBase - 16, ang + '°', { tam: 14, peso: 700, color: C.rojo }));

    // el móvil, apoyado sobre la rampa
    const f = acotar(p.posicion, 5, 95) / 100;
    const cxm = xA + largo * f * Math.cos(rad), cym = yBase - largo * f * Math.sin(rad);
    const gm = grupo({ transform: `translate(${r2(cxm)} ${r2(cym)}) rotate(${r2(-ang)})` });
    if (p.movil === 'esfera') {
      gm.appendChild(svgEl('circle', { cx: 0, cy: -20, r: 20, fill: C.metalOsc, stroke: C.trazo, 'stroke-width': 1.8 }));
    } else {
      gm.appendChild(rect(-30, -34, 60, 30, p.movil === 'carrito' ? '#c0562b' : C.metalOsc, C.trazo, 1.8, { rx: 3 }));
      if (p.movil === 'carrito') {
        gm.appendChild(svgEl('circle', { cx: -16, cy: -2, r: 8, fill: '#2b2b2b' }));
        gm.appendChild(svgEl('circle', { cx: 16, cy: -2, r: 8, fill: '#2b2b2b' }));
      }
    }
    g.appendChild(gm);

    // fuerzas
    if (p.fuerzas) {
      const cy0 = cym - 20 * Math.cos(rad), cx0 = cxm + 20 * Math.sin(rad);
      const vector = (dx, dy, color, rot) => {
        const x2 = cx0 + dx, y2 = cy0 + dy;
        g.appendChild(linea(cx0, cy0, x2, y2, color, 2.6));
        const a = Math.atan2(dy, dx) * 180 / Math.PI;
        g.appendChild(svgEl('polygon', { points: '0,0 -11,-5 -11,5', fill: color, transform: `translate(${r2(x2)} ${r2(y2)}) rotate(${r2(a)})` }));
        g.appendChild(texto(x2 + (dx > 0 ? 16 : dx < 0 ? -16 : 0), y2 + (dy > 0 ? 14 : -12), rot, { tam: 12, peso: 700, color }));
      };
      vector(0, 78, '#7a3fbf', 'P');                                                    // peso
      vector(-58 * Math.sin(rad), -58 * Math.cos(rad), '#2a7fbd', 'N');                  // normal
      vector(58 * Math.cos(rad), 58 * Math.sin(rad), C.rojo, 'Px');                      // componente sobre la rampa
    }
    if (p.dinamometro) {
      const dx = -70 * Math.cos(rad), dy = 70 * Math.sin(rad);
      g.appendChild(linea(cxm, cym - 20, cxm + dx, cym + dy - 20, C.trazo, 2.4));
      g.appendChild(rect(cxm + dx - 46, cym + dy - 32, 46, 24, C.vidrio, C.trazo, 1.6, { rx: 3 }));
      g.appendChild(texto(cxm + dx - 23, cym + dy - 20, 'N', { tam: 11, peso: 700 }));
    }

    if (p.medidas) {
      g.appendChild(linea(xB + 22, yB, xB + 22, yBase, C.suave, 1.4, { 'stroke-dasharray': '5 4' }));
      g.appendChild(flecha(xB + 22, yB, 'arriba', 8, C.suave));
      g.appendChild(flecha(xB + 22, yBase, 'abajo', 8, C.suave));
      g.appendChild(texto(xB + 30, (yB + yBase) / 2, p.altura || '', { tam: 12, ancla: 'start', peso: 700, color: C.suave }));
      const mx = (xA + xB) / 2, my = (yBase + yB) / 2;
      g.appendChild(texto(mx - 30 * Math.sin(rad), my - 30 * Math.cos(rad) - 6, p.largo || '', { tam: 12, peso: 700, color: C.suave, transform: `rotate(${r2(-ang)} ${r2(mx)} ${r2(my)})` }));
    }
    rotulo(g, ancho / 2, alto - 8, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ---------- Sistema de poleas ----------
DEF.polea = {
  nombre: 'Sistema de poleas',
  icono: '⚙️',
  categoria: 'Fuerza',
  magnitud: 'Fuerza',
  resumen: 'Poleas fijas y móviles con sus pesos: la máquina simple para hablar de ventaja mecánica.',
  comoSeLee: 'La polea fija sólo cambia la dirección de la fuerza: hay que hacer la misma que el peso. Cada polea móvil reparte el peso entre dos tramos de cuerda, así que la fuerza baja a la mitad… pero hay que tirar el doble de cuerda.',
  params: [
    { clave: 'tipo', etiqueta: 'Montaje', tipo: 'opcion', def: 'fija', opciones: [
      { v: 'fija', t: 'Una polea fija' }, { v: 'movil', t: 'Una polea móvil' }, { v: 'combinada', t: 'Fija + móvil' }
    ] },
    { clave: 'peso', etiqueta: 'Peso colgado (texto)', tipo: 'texto', def: '10 N' },
    { clave: 'fuerza', etiqueta: 'Fuerza aplicada (texto)', tipo: 'texto', def: '10 N' },
    { clave: 'dinamometro', etiqueta: 'Con dinamómetro', tipo: 'bool', def: true },
    P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const g = grupo();
    const ancho = 460, alto = 480;
    const yTecho = 50;
    g.appendChild(rect(40, yTecho - 16, 380, 16, C.cuerpoOsc, C.trazo, 1.8));
    for (let x = 50; x < 420; x += 22) g.appendChild(linea(x, yTecho, x - 10, yTecho + 12, C.suave, 1.4));

    const poleaEn = (cx, cy, r) => {
      g.appendChild(svgEl('circle', { cx, cy, r, fill: C.metal, stroke: C.trazo, 'stroke-width': 2.4 }));
      g.appendChild(svgEl('circle', { cx, cy, r: r * 0.22, fill: C.cuerpoOsc }));
    };
    const pesa = (cx, cy, txt) => {
      g.appendChild(svgEl('path', { d: `M ${cx - 26} ${cy} L ${cx + 26} ${cy} L ${cx + 32} ${cy + 54} L ${cx - 32} ${cy + 54} Z`, fill: C.metalOsc, stroke: C.trazo, 'stroke-width': 1.8 }));
      g.appendChild(texto(cx, cy + 28, txt, { tam: 13, peso: 700, color: '#ffffff' }));
    };
    const dinamo = (cx, cy) => {
      if (!p.dinamometro) return;
      g.appendChild(rect(cx - 20, cy, 40, 74, C.vidrio, C.trazo, 1.8, { rx: 5 }));
      for (let i = 1; i < 5; i++) g.appendChild(linea(cx - 20, cy + i * 14, cx - 8, cy + i * 14, C.trazo, 1));
      g.appendChild(rect(cx - 18, cy + 40, 36, 7, C.rojo, null, 0));
      g.appendChild(texto(cx, cy + 88, p.fuerza || '', { tam: 12, peso: 700, color: C.rojo }));
    };

    if (p.tipo === 'fija') {
      const cx = 220, cy = 120, r = 44;
      g.appendChild(linea(cx, yTecho, cx, cy - r, C.trazo, 3));
      poleaEn(cx, cy, r);
      g.appendChild(linea(cx - r, cy, cx - r, 300, C.trazo, 2.4));
      g.appendChild(linea(cx + r, cy, cx + r, 300, C.trazo, 2.4));
      pesa(cx - r, 300, p.peso || '');
      dinamo(cx + r, 300);
      g.appendChild(texto(cx, cy + r + 22, 'la fuerza es igual al peso', { tam: 11, color: C.suave, mono: false }));
    } else if (p.tipo === 'movil') {
      const cx = 220, cy = 250, r = 44;
      g.appendChild(linea(cx - r, yTecho, cx - r, cy, C.trazo, 2.4));
      poleaEn(cx, cy, r);
      g.appendChild(linea(cx + r, cy, cx + r, 110, C.trazo, 2.4));
      pesa(cx, cy + r, p.peso || '');
      dinamo(cx + r, 110);
      g.appendChild(texto(cx + 110, cy, 'la fuerza es la mitad', { tam: 11, color: C.suave, ancla: 'start', mono: false }));
      g.appendChild(texto(cx + 110, cy + 16, 'del peso', { tam: 11, color: C.suave, ancla: 'start', mono: false }));
    } else {
      const cxF = 300, cyF = 120, cxM = 170, cyM = 260, r = 40;
      g.appendChild(linea(cxF, yTecho, cxF, cyF - r, C.trazo, 3));
      poleaEn(cxF, cyF, r);
      poleaEn(cxM, cyM, r);
      g.appendChild(linea(cxM - r, yTecho, cxM - r, cyM, C.trazo, 2.4));
      g.appendChild(linea(cxM + r, cyM, cxF - r, cyF, C.trazo, 2.4));
      g.appendChild(linea(cxF + r, cyF, cxF + r, 300, C.trazo, 2.4));
      pesa(cxM, cyM + r, p.peso || '');
      dinamo(cxF + r, 300);
      g.appendChild(texto(ancho / 2, 430, 'la polea móvil reparte el peso entre dos tramos de cuerda', { tam: 11, color: C.suave, mono: false }));
    }
    rotulo(g, ancho / 2, alto - 8, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ---------- Banco óptico ----------
DEF.bancoOptico = {
  nombre: 'Banco óptico con lente',
  icono: '🔎',
  categoria: 'Óptica',
  magnitud: 'Distancias e imagen',
  resumen: 'Objeto, lente y pantalla sobre el riel, con los rayos trazados y la imagen donde corresponde.',
  comoSeLee: 'La imagen se busca corriendo la pantalla hasta que se ve nítida. La relación entre las distancias es 1/f = 1/do + 1/di: si el objeto está a más del doble de la focal, la imagen sale más chica e invertida.',
  params: [
    { clave: 'lente', etiqueta: 'Tipo de lente', tipo: 'opcion', def: 'convergente', opciones: [
      { v: 'convergente', t: 'Convergente (biconvexa)' }, { v: 'divergente', t: 'Divergente (bicóncava)' }
    ] },
    { clave: 'focal', etiqueta: 'Distancia focal (cm)', tipo: 'numero', paso: 1, min: 2, max: 40, def: 10 },
    { clave: 'distanciaObjeto', etiqueta: 'Distancia objeto-lente (cm)', tipo: 'numero', paso: 1, min: 2, max: 80, def: 25 },
    { clave: 'alturaObjeto', etiqueta: 'Altura del objeto (cm)', tipo: 'numero', paso: 0.5, min: 0.5, max: 12, def: 4 },
    { clave: 'rayos', etiqueta: 'Trazar los rayos', tipo: 'bool', def: true },
    { clave: 'pantalla', etiqueta: 'Dibujar la pantalla en la imagen', tipo: 'bool', def: true },
    { clave: 'datos', etiqueta: 'Escribir las distancias', tipo: 'bool', def: true },
    P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const conv = p.lente !== 'divergente';
    const f = (conv ? 1 : -1) * Math.abs(Number(p.focal) || 10);
    const dObj = Math.abs(Number(p.distanciaObjeto) || 25);
    const hObj = Math.abs(Number(p.alturaObjeto) || 4);
    // Ecuación de las lentes delgadas. Si el objeto está justo en el foco no
    // hay imagen: se corre un pelín para no dividir entre cero.
    const den = (dObj - f) === 0 ? 1e-6 : (dObj - f);
    const dImg = (dObj * f) / den;
    const aumento = -dImg / dObj;
    const hImg = hObj * aumento;

    const g = grupo();
    const ancho = 760, alto = 440;
    const cxL = 380, eje = 240;
    // escala de dibujo: que entre todo lo que haya que mostrar
    const alcance = Math.max(dObj, Math.abs(dImg), Math.abs(f) * 2) * 1.15;
    const px = Math.min(9, (ancho / 2 - 60) / alcance);
    const pxV = Math.min(14, 120 / Math.max(hObj, Math.abs(hImg)));
    const X = d => cxL + d * px;
    const Y = h => eje - h * pxV;

    // riel y eje óptico
    g.appendChild(rect(30, eje + 110, ancho - 60, 20, C.cuerpoOsc, C.trazo, 1.6, { rx: 3 }));
    for (let x = 50; x < ancho - 50; x += 40) g.appendChild(linea(x, eje + 110, x, eje + 104, C.suave, 1));
    g.appendChild(linea(40, eje, ancho - 40, eje, C.suave, 1.2, { 'stroke-dasharray': '6 5' }));

    // la lente
    const hL = 100;
    if (conv) {
      g.appendChild(svgEl('path', { d: `M ${cxL} ${eje - hL} C ${cxL + 26} ${eje - hL * 0.4} ${cxL + 26} ${eje + hL * 0.4} ${cxL} ${eje + hL} C ${cxL - 26} ${eje + hL * 0.4} ${cxL - 26} ${eje - hL * 0.4} ${cxL} ${eje - hL} Z`, fill: 'rgba(58,163,216,0.28)', stroke: C.vidrioBorde, 'stroke-width': 2.2 }));
    } else {
      g.appendChild(svgEl('path', { d: `M ${cxL - 20} ${eje - hL} L ${cxL + 20} ${eje - hL} C ${cxL - 4} ${eje - hL * 0.4} ${cxL - 4} ${eje + hL * 0.4} ${cxL + 20} ${eje + hL} L ${cxL - 20} ${eje + hL} C ${cxL + 4} ${eje + hL * 0.4} ${cxL + 4} ${eje - hL * 0.4} ${cxL - 20} ${eje - hL} Z`, fill: 'rgba(58,163,216,0.28)', stroke: C.vidrioBorde, 'stroke-width': 2.2 }));
    }
    g.appendChild(rect(cxL - 14, eje + hL, 28, 110 - hL, C.metalOsc, C.trazo, 1.4));

    // focos
    [-1, 1].forEach(s => {
      const x = X(s * Math.abs(f));
      g.appendChild(svgEl('circle', { cx: r2(x), cy: eje, r: 4, fill: C.trazo }));
      g.appendChild(texto(x, eje + 18, s > 0 ? "F'" : 'F', { tam: 11, peso: 700 }));
    });

    // el objeto (una flecha) a la izquierda
    const xO = X(-dObj);
    g.appendChild(linea(xO, eje, xO, Y(hObj), '#c0562b', 3));
    g.appendChild(flecha(xO, Y(hObj), 'arriba', 10, '#c0562b'));
    g.appendChild(rect(xO - 14, eje + hL, 28, 110 - hL, C.metalOsc, C.trazo, 1.4));
    g.appendChild(texto(xO, Y(hObj) - 16, 'objeto', { tam: 11, peso: 700, color: '#c0562b' }));

    // la imagen
    const xI = X(dImg);
    const dentro = Math.abs(xI - cxL) < ancho / 2 - 50;
    if (dentro) {
      const col = dImg > 0 ? '#7a3fbf' : '#9a7fbf';
      g.appendChild(linea(xI, eje, xI, Y(hImg), col, 3, dImg > 0 ? null : { 'stroke-dasharray': '6 4' }));
      g.appendChild(flecha(xI, Y(hImg), hImg > 0 ? 'arriba' : 'abajo', 10, col));
      g.appendChild(texto(xI - 10, Y(hImg) + (hImg > 0 ? -16 : 16), dImg > 0 ? 'imagen real' : 'imagen virtual', { tam: 11, peso: 700, color: col, ancla: 'end' }));
      if (p.pantalla && dImg > 0) {
        g.appendChild(rect(xI + 12, eje - 110, 12, 220, '#f2efe4', C.trazo, 1.6, { rx: 2 }));
        g.appendChild(rect(xI + 12, eje + hL, 28, 110 - hL, C.metalOsc, C.trazo, 1.4));
      }
    }

    // rayos principales: el paralelo al eje y el que pasa por el centro
    if (p.rayos) {
      const rayo = (d, color, guion) => g.appendChild(svgEl('path', { d, fill: 'none', stroke: color, 'stroke-width': 1.8, 'stroke-dasharray': guion || null }));
      const yTopObj = Y(hObj);
      rayo(`M ${r2(xO)} ${r2(yTopObj)} L ${cxL} ${r2(yTopObj)}`, '#e08a2b');
      if (conv) {
        rayo(`M ${cxL} ${r2(yTopObj)} L ${r2(dentro ? xI : ancho - 50)} ${r2(dentro ? Y(hImg) : eje + (eje - yTopObj) * 1.4)}`, '#e08a2b');
      } else {
        rayo(`M ${cxL} ${r2(yTopObj)} L ${ancho - 50} ${r2(yTopObj + (eje - yTopObj) * -0.6)}`, '#e08a2b');
        rayo(`M ${cxL} ${r2(yTopObj)} L ${r2(X(f))} ${r2(eje)}`, '#e08a2b', '5 4');
      }
      rayo(`M ${r2(xO)} ${r2(yTopObj)} L ${r2(dentro ? xI : ancho - 50)} ${r2(dentro ? Y(hImg) : eje + (eje - yTopObj))}`, '#2a9d8f');
    }

    if (p.datos) {
      const caja = [];
      caja.push('f = ' + fmt(Math.abs(f), 0) + ' cm');
      caja.push('do = ' + fmt(dObj, 0) + ' cm');
      caja.push('di = ' + fmt(dImg, 1) + ' cm');
      caja.push('aumento = ' + fmt(aumento, 2));
      g.appendChild(rect(40, 24, 200, 20 + caja.length * 18, '#fbfbf8', C.tenue, 1.4, { rx: 6 }));
      caja.forEach((t, i) => g.appendChild(texto(52, 44 + i * 18, t, { tam: 12, ancla: 'start' })));
    }
    rotulo(g, ancho / 2, alto - 6, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ---------- Calorímetro ----------
DEF.calorimetro = {
  nombre: 'Calorímetro',
  icono: '🥤',
  categoria: 'Temperatura',
  magnitud: 'Temperatura',
  resumen: 'El vaso aislado con su tapa, el termómetro y el agitador: donde se hacen los balances de energía.',
  comoSeLee: 'Se tapa enseguida después de mezclar y se agita suave hasta que la temperatura deje de subir: ésa es la de equilibrio. Ningún calorímetro aísla del todo, así que siempre se pierde algo de calor y la temperatura final queda un poco por debajo de la calculada.',
  params: [
    { clave: 'temperatura', etiqueta: 'Temperatura que marca (°C)', tipo: 'numero', paso: 0.5, min: -10, max: 110, def: 38 },
    { clave: 'agitador', etiqueta: 'Con agitador', tipo: 'bool', def: true },
    { clave: 'doblePared', etiqueta: 'Doble vaso (mejor aislado)', tipo: 'bool', def: true },
    P.color(), { clave: 'nivel', etiqueta: 'Qué tan lleno está (%)', tipo: 'numero', paso: 5, min: 0, max: 100, def: 60 },
    { clave: 'rotulos', etiqueta: 'Rotular las partes', tipo: 'bool', def: true },
    P.etiqueta(''), P.escala()
  ],
  dibujar(p) {
    const g = grupo();
    const ancho = 420, alto = 460;
    const cx = 190, yTapa = 110, yFondo = 400;
    const w = 150;

    // vaso exterior y, si corresponde, el interior
    g.appendChild(svgEl('path', { d: `M ${cx - w / 2 - 14} ${yTapa} L ${cx - w / 2 - 6} ${yFondo} L ${cx + w / 2 + 6} ${yFondo} L ${cx + w / 2 + 14} ${yTapa}`, fill: '#f3f1ea', stroke: C.trazo, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }));
    if (p.doblePared) {
      g.appendChild(svgEl('path', { d: `M ${cx - w / 2} ${yTapa + 12} L ${cx - w / 2 + 6} ${yFondo - 14} L ${cx + w / 2 - 6} ${yFondo - 14} L ${cx + w / 2} ${yTapa + 12}`, fill: '#faf9f4', stroke: C.trazo, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }));
    }
    // el líquido
    const nivel = acotar(p.nivel, 0, 100) / 100;
    const yInt = yTapa + (p.doblePared ? 16 : 6), yFin = yFondo - (p.doblePared ? 18 : 6);
    const yl = yFin - nivel * (yFin - yInt);
    if (nivel > 0) g.appendChild(svgEl('path', { d: `M ${cx - w / 2 + 4} ${r2(yl)} L ${cx - w / 2 + 8} ${yFin} L ${cx + w / 2 - 8} ${yFin} L ${cx + w / 2 - 4} ${r2(yl)} Z`, fill: p.color || C.liquido, 'fill-opacity': 0.5 }));

    // tapa
    g.appendChild(rect(cx - w / 2 - 24, yTapa - 20, w + 48, 24, '#e9e5d8', C.trazo, 2, { rx: 4 }));
    // termómetro pasando por la tapa
    g.appendChild(rect(cx - 6, 30, 12, yFin - 60, C.vidrio, C.vidrioBorde, 1.6, { rx: 6 }));
    const t = acotar(p.temperatura, -10, 110);
    const hCol = ((t + 10) / 120) * (yFin - 110);
    g.appendChild(rect(cx - 3, yFin - 40 - hCol, 6, hCol + 30, C.rojo, null, 0));
    g.appendChild(svgEl('circle', { cx, cy: yFin - 14, r: 10, fill: C.rojo, stroke: C.vidrioBorde, 'stroke-width': 1.2 }));
    carteLectura(g, cx + 26, 34, fmt(t, 1) + ' °C');

    if (p.agitador) {
      g.appendChild(linea(cx - 52, 46, cx - 52, yFin - 40, C.metalOsc, 3.4));
      g.appendChild(svgEl('ellipse', { cx: cx - 52, cy: yFin - 36, rx: 24, ry: 7, fill: 'none', stroke: C.metalOsc, 'stroke-width': 3 }));
      g.appendChild(svgEl('circle', { cx: cx - 52, cy: 40, r: 9, fill: C.metalOsc, stroke: C.trazo, 'stroke-width': 1.2 }));
    }
    if (p.rotulos) {
      g.appendChild(texto(cx + w / 2 + 26, yTapa + 40, 'vaso aislado', { tam: 10, ancla: 'start', color: C.suave }));
      if (p.doblePared) g.appendChild(texto(cx + w / 2 + 26, yTapa + 56, '(doble pared)', { tam: 10, ancla: 'start', color: C.suave }));
      if (p.agitador) g.appendChild(texto(cx - 122, 60, 'agitador', { tam: 10, ancla: 'end', color: C.suave }));
    }
    rotulo(g, cx, alto - 8, p.etiqueta);
    return { g, ancho, alto };
  }
};

// ============================================================
// API pública
// ============================================================

// Orden en el que aparecen en el banco.
const ORDEN = [
  // longitud y ángulo
  'regla', 'calibre', 'micrometro', 'transportador',
  // volumen
  'probeta', 'bureta', 'pipeta', 'jeringa', 'vidrio',
  // masa, temperatura, fuerza y tiempo
  'balanzaDigital', 'granataria', 'termometro', 'dinamometro', 'cronometro',
  // electricidad y electrónica
  'multimetro', 'aguja', 'fuente', 'circuito', 'microbit',
  // mesada de física
  'planoInclinado', 'polea', 'bancoOptico', 'calorimetro',
  // mesada de química
  'frasco', 'mechero', 'soporte', 'gradilla', 'filtracion', 'destilacion', 'agitador', 'papelPH',
  // sensores
  'goDirect', 'sensorDigital'
];

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
    // Los parámetros se separan con comas, pero un valor puede traer comas
    // adentro («0,1 mol/L», «agua, HCl, control»). Por eso el trozo que no
    // tiene «=» no abre un parámetro nuevo: se pega al valor anterior.
    const trozos = corte.slice(1).join('::').split(',');
    const pares = [];
    trozos.forEach(t => {
      if (t.indexOf('=') >= 0 || !pares.length) pares.push(t);
      else pares[pares.length - 1] += ',' + t;
    });
    pares.forEach(par => {
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
