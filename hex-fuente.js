// Extrae el código fuente que MakeCode incrusta dentro de los .hex de micro:bit
// (formato de pxt: registros Intel HEX con la magia 41140E2FB82FA2BB, metadatos
// JSON y el proyecto comprimido con LZMA). Sigue la misma lógica que
// pxt.cpp.unpackSourceFromHexAsync de Microsoft MakeCode (MIT).
// Necesita lzma-d.min.js cargado (global LZMA).

// bytes UTF-8 → string (mismo truco que pxt para decodificar UTF-8)
function deBytesUTF8(bytes) {
  let esc = '';
  for (let i = 0; i < bytes.length; i++) {
    const k = bytes[i] & 0xff;
    esc += (k === 37 || k > 0x7f) ? '%' + k.toString(16).padStart(2, '0') : String.fromCharCode(k);
  }
  try { return decodeURIComponent(esc); } catch (e) { return esc; }
}

function swapPares(str) {
  let r = '';
  for (let i = 0; i < str.length; i += 2) r = str[i] + str[i + 1] + r;
  return r;
}

// Busca la magia en el texto del .hex y junta metadatos + fuente comprimida.
// Funciona también con los "universal hex" (V1+V2): la primera aparición alcanza.
function extraerCrudo(textoHex) {
  let metaLen = 0, textLen = 0, faltan = 0, ptr = 0;
  let buf = null;
  for (const ln of textoHex.split(/\r?\n/)) {
    let m = /^:10....0[0ED]41140E2FB82FA2BB(....)(....)(....)(....)(..)/.exec(ln);
    if (m) {
      metaLen = parseInt(swapPares(m[1]), 16);
      textLen = parseInt(swapPares(m[2]), 16);
      faltan = metaLen + textLen;
      buf = new Uint8Array(faltan);
      ptr = 0;
      continue;
    }
    if (faltan > 0 && buf) {
      m = /^:10....0[0ED](.*)(..)$/.exec(ln);
      if (!m) continue;
      let k = m[1];
      while (faltan > 0 && k.length >= 2) {
        buf[ptr++] = parseInt(k.slice(0, 2), 16);
        k = k.slice(2);
        faltan--;
      }
      if (faltan === 0) break;
    }
  }
  if (!buf || faltan !== 0) return null;
  return {
    meta: deBytesUTF8(buf.slice(0, metaLen)),
    texto: buf.slice(metaLen)
  };
}

function lzmaDescomprimir(bytes) {
  return new Promise((resolve, reject) => {
    if (typeof LZMA === 'undefined' || !LZMA.decompress) {
      reject(new Error('El descompresor LZMA no está cargado.'));
      return;
    }
    try {
      LZMA.decompress(bytes, (res, err) => {
        if (err) reject(new Error(String(err)));
        else if (typeof res === 'string') resolve(res);
        else resolve(deBytesUTF8(res || []));
      });
    } catch (e) { reject(e); }
  });
}

// ArrayBuffer de un .hex → { nombre, editor, archivos: {ruta: contenido}, extensiones: [{nombre, repo}] }
export async function extraerFuenteHex(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes[0] !== 0x3a) {
    throw new Error('El archivo no parece un .hex de micro:bit (no empieza con ":").');
  }
  const crudo = extraerCrudo(deBytesUTF8(bytes));
  if (!crudo) {
    throw new Error('Este .hex no trae el código fuente adentro. Los .hex descargados de MakeCode (makecode.microbit.org) sí lo incluyen; los de Python (python.microbit.org) o los compilados con otras herramientas, no.');
  }

  let cab;
  try { cab = JSON.parse(crudo.meta); } catch (e) {
    throw new Error('Los metadatos del .hex están dañados.');
  }

  let fuente;
  if (cab.compression === 'LZMA') {
    const res = await lzmaDescomprimir(crudo.texto);
    if (!res) throw new Error('No se pudo descomprimir el código del .hex.');
    const tamCab = cab.headerSize || cab.metaSize || 0;
    const metaExtra = res.slice(0, tamCab);
    fuente = res.slice(tamCab);
    try { Object.assign(cab, JSON.parse(metaExtra)); } catch (e) { /* sin metadatos extra */ }
  } else if (cab.compression) {
    throw new Error(`El .hex usa una compresión desconocida (${cab.compression}).`);
  } else {
    fuente = deBytesUTF8(crudo.texto);
  }

  // la fuente es un JSON {archivo: contenido}; si no, es el main.ts pelado
  let archivos;
  try {
    archivos = JSON.parse(fuente);
    if (typeof archivos !== 'object' || archivos === null) throw new Error('x');
  } catch (e) {
    archivos = { 'main.ts': String(fuente) };
  }

  // extensiones desde pxt.json (dependencias github:usuario/repo)
  const extensiones = [];
  try {
    const pxt = JSON.parse(archivos['pxt.json'] || '{}');
    Object.entries(pxt.dependencies || {}).forEach(([nombre, ref]) => {
      const m = /^github:([^#]+)/.exec(String(ref));
      if (m) extensiones.push({ nombre, repo: 'github:' + m[1] });
    });
    if (pxt.name && !cab.name) cab.name = pxt.name;
  } catch (e) { /* pxt.json ilegible: seguimos sin extensiones */ }

  return {
    nombre: cab.name || 'Proyecto micro:bit',
    editor: cab.editor || '',
    objetivo: (cab.target && (cab.target.name || cab.target)) || cab.pxtTarget || '',
    archivos,
    extensiones
  };
}

// ============================================================
// Resumen heurístico del código MakeCode (JavaScript estático)
// ============================================================
// Detecta los manejadores de eventos de primer nivel y resume qué hay adentro.
// Es aproximado a propósito: alcanza para contarle al docente la estructura.

const EVENTOS_MAKECODE = [
  [/input\.onButtonPressed\s*\(\s*Button\.AB/, 'Al presionar los botones A+B juntos'],
  [/input\.onButtonPressed\s*\(\s*Button\.A/, 'Al presionar el botón A'],
  [/input\.onButtonPressed\s*\(\s*Button\.B/, 'Al presionar el botón B'],
  [/input\.onGesture\s*\(\s*Gesture\.Shake/, 'Al agitar el micro:bit'],
  [/input\.onGesture\s*\(\s*Gesture\.(\w+)/, m => `Al detectar el gesto "${m[1]}"`],
  [/input\.onLogoEvent/, 'Al tocar el logo'],
  [/input\.onPinPressed\s*\(\s*TouchPin\.(\w+)/, m => `Al tocar el pin ${m[1]}`],
  [/input\.onSound\s*\(/, 'Al detectar un sonido fuerte'],
  [/radio\.onReceivedNumber/, 'Al recibir un número por radio'],
  [/radio\.onReceivedString/, 'Al recibir un texto por radio'],
  [/radio\.onReceivedValue/, 'Al recibir un valor por radio'],
  [/basic\.forever\s*\(/, 'Por siempre (bucle principal)'],
  [/loops\.everyInterval\s*\(\s*(\d+)/, m => `Cada ${m[1]} ms`],
  [/control\.inBackground/, 'En segundo plano']
];

const ACCIONES_MAKECODE = [
  [/basic\.showString\s*\(\s*"([^"]*)"/g, m => `muestra el texto "${m[1]}"`],
  [/basic\.showString\s*\(/g, () => 'muestra un texto'],
  [/basic\.showNumber\s*\(/g, () => 'muestra un número'],
  [/basic\.showIcon\s*\(\s*IconNames\.(\w+)/g, m => `muestra el ícono ${m[1]}`],
  [/basic\.showLeds\s*\(/g, () => 'dibuja en la pantalla LED'],
  [/basic\.clearScreen\s*\(/g, () => 'borra la pantalla'],
  [/basic\.pause\s*\(\s*(\d+)/g, m => `espera ${m[1]} ms`],
  [/music\.playTone|music\.play\b|music\.startMelody|music\.playMelody/g, () => 'toca música'],
  [/music\.ringTone/g, () => 'hace sonar un tono'],
  [/radio\.sendNumber|radio\.sendString|radio\.sendValue/g, () => 'envía datos por radio'],
  [/radio\.setGroup\s*\(\s*(\d+)/g, m => `usa el grupo de radio ${m[1]}`],
  [/pins\.digitalWritePin/g, () => 'escribe en un pin digital'],
  [/pins\.analogWritePin/g, () => 'escribe en un pin analógico'],
  [/servos?\.|\.setAngle\(/g, () => 'mueve un servo'],
  [/input\.temperature\s*\(/g, () => 'lee la temperatura'],
  [/input\.lightLevel\s*\(/g, () => 'lee el nivel de luz'],
  [/input\.compassHeading\s*\(/g, () => 'lee la brújula'],
  [/input\.acceleration\s*\(/g, () => 'lee el acelerómetro'],
  [/game\.addScore|game\.setScore/g, () => 'cambia el puntaje del juego'],
  [/game\.gameOver/g, () => 'termina el juego'],
  [/\bif\s*\(/g, () => 'toma decisiones (si...)'],
  [/\bfor\s*\(|\bwhile\s*\(/g, () => 'repite con un bucle']
];

// separa el código en trozos de primer nivel (llaves balanceadas)
function trozosPrimerNivel(codigo) {
  const trozos = [];
  let prof = 0, inicio = 0;
  for (let i = 0; i < codigo.length; i++) {
    const ch = codigo[i];
    if (ch === '{' || ch === '(') prof++;
    else if (ch === '}' || ch === ')') {
      prof--;
      if (prof === 0) {
        trozos.push(codigo.slice(inicio, i + 1));
        inicio = i + 1;
      }
    }
  }
  if (inicio < codigo.length) trozos.push(codigo.slice(inicio));
  return trozos;
}

export function resumenMakeCode(codigoJs) {
  const frases = [];
  const cod = String(codigoJs || '');
  for (const trozo of trozosPrimerNivel(cod)) {
    let titulo = null;
    for (const [re, txt] of EVENTOS_MAKECODE) {
      const m = re.exec(trozo);
      if (m) { titulo = typeof txt === 'function' ? txt(m) : txt; break; }
    }
    const acciones = [];
    const vistas = new Set();
    for (const [re, fn] of ACCIONES_MAKECODE) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(trozo)) !== null && acciones.length < 6) {
        const f = fn(m);
        if (!vistas.has(f)) { vistas.add(f); acciones.push(f); }
        if (!re.global) break;
      }
    }
    if (titulo) {
      frases.push(titulo + (acciones.length ? ': ' + acciones.join('; ') + '.' : '.'));
    } else if (acciones.length && /let |const |=/.test(trozo)) {
      frases.push('Al iniciar (código suelto): ' + acciones.join('; ') + '.');
    }
  }
  // variables declaradas de primer nivel
  const vars = [...cod.matchAll(/^let\s+(\w+)\s*=/gm)].map(m => m[1]);
  if (vars.length) frases.push('Variables que usa: ' + vars.join(', ') + '.');
  return frases;
}
