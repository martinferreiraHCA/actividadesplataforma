// Pieza 3D con IA — lectura y edición de las variables de un archivo OpenSCAD.
//
// Lee las asignaciones de nivel superior con el formato del Customizer de
// OpenSCAD (grupos /* [Grupo] */, descripción en la línea anterior, rango o
// lista en el comentario final) y permite reemplazar el valor de una variable
// sin tocar el resto del archivo. Puro (sin DOM), probado en Node.

const RE_ASIGNACION = /^(\s*)(\$?[A-Za-z_][\w]*)(\s*=\s*)(.+?)(\s*;)(\s*(?:\/\/\s*(.*))?)$/;
const RE_GRUPO = /^\s*\/\*\s*\[([^\]]*)\]\s*\*\/\s*$/;
const RE_COMENTARIO = /^\s*\/\/\s?(.*)$/;
const RE_NUMERO = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;

function quitarStringsYComentarios(linea) {
  // deja solo lo estructural de la línea para contar llaves
  let salida = '';
  let enString = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (enString) {
      if (c === '\\') { i++; continue; }
      if (c === '"') enString = false;
      continue;
    }
    if (c === '"') { enString = true; continue; }
    if (c === '/' && linea[i + 1] === '/') break;
    salida += c;
  }
  return salida;
}

function parsearValor(texto) {
  const t = texto.trim();
  if (t === 'true' || t === 'false') return { tipo: 'bool', valor: t === 'true' };
  if (RE_NUMERO.test(t)) return { tipo: 'numero', valor: parseFloat(t) };
  if (/^"(?:[^"\\]|\\.)*"$/.test(t)) {
    let valor;
    try { valor = JSON.parse(t); } catch (e) { valor = t.slice(1, -1).replace(/\\(.)/g, '$1'); }
    return { tipo: 'cadena', valor };
  }
  if (/^\[.*\]$/.test(t)) {
    const interior = t.slice(1, -1).trim();
    if (interior === '') return { tipo: 'expresion', valor: t };
    // lista de puntos [[x, y], [x, y, z], ...] (contornos, perfiles)
    if (/^\[/.test(interior)) {
      const puntos = [...interior.matchAll(/\[([^\[\]]*)\]/g)].map(m => m[1].split(',').map(s => s.trim()));
      const soloPuntos = interior.replace(/\[[^\[\]]*\]/g, '').replace(/[\s,]/g, '') === '';
      if (puntos.length && soloPuntos && puntos.every(p => (p.length === 2 || p.length === 3) && p.every(x => RE_NUMERO.test(x)))) {
        return { tipo: 'puntos', valor: puntos.map(p => p.map(parseFloat)) };
      }
      return { tipo: 'expresion', valor: t };
    }
    const partes = interior.split(',').map(s => s.trim());
    if (partes.length <= 6 && partes.every(p => RE_NUMERO.test(p))) return { tipo: 'vector', valor: partes.map(parseFloat) };
  }
  return { tipo: 'expresion', valor: t };
}

function parsearAnotacion(comentario) {
  // "[0:0.5:100] descripción" · "[a, b, c]" · "[1:Uno, 2:Dos]" · texto libre
  const res = { rango: null, lista: null, descripcion: '' };
  if (!comentario) return res;
  const m = comentario.match(/^\s*\[([^\]]*)\]\s*(.*)$/);
  if (!m) { res.descripcion = comentario.trim(); return res; }
  res.descripcion = m[2].trim();
  const interior = m[1].trim();
  const partesDosPuntos = interior.split(':').map(s => s.trim());
  if (!interior.includes(',') && partesDosPuntos.length >= 2 && partesDosPuntos.length <= 3 && partesDosPuntos.every(p => RE_NUMERO.test(p))) {
    const n = partesDosPuntos.map(parseFloat);
    res.rango = partesDosPuntos.length === 2 ? { min: n[0], max: n[1], paso: null } : { min: n[0], paso: n[1], max: n[2] };
    return res;
  }
  if (!interior.includes(',') && partesDosPuntos.length === 1 && RE_NUMERO.test(interior)) {
    // "[10]" → máximo
    res.rango = { min: 0, max: parseFloat(interior), paso: null };
    return res;
  }
  const opciones = interior.split(',').map(s => s.trim()).filter(Boolean);
  if (opciones.length) {
    res.lista = opciones.map(o => {
      const k = o.indexOf(':');
      if (k > 0) return { valor: o.slice(0, k).trim(), etiqueta: o.slice(k + 1).trim() };
      return { valor: o, etiqueta: o };
    });
  }
  return res;
}

// → { variables: [...], grupos: [nombres en orden], lineas: n }
// Cada variable: { nombre, linea, tipo, valor, textoValor, inicio, fin, grupo,
//                  descripcion, rango, lista, oculta, despuesDeModulos }
export function parsearVariables(codigo) {
  const lineas = String(codigo || '').replace(/\r/g, '').split('\n');
  const variables = [];
  const grupos = [];
  let profundidad = 0;
  let enBloque = false; // dentro de /* ... */ multilínea
  let grupo = 'General';
  let hayModulos = false;
  let comentarioPrevio = '';

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    if (enBloque) {
      if (linea.includes('*/')) enBloque = false;
      continue;
    }
    const g = linea.match(RE_GRUPO);
    if (g && profundidad === 0) {
      grupo = g[1].trim() || 'General';
      if (!grupos.includes(grupo)) grupos.push(grupo);
      comentarioPrevio = '';
      continue;
    }
    const c = linea.match(RE_COMENTARIO);
    if (c) { comentarioPrevio = c[1].trim(); continue; }
    if (/^\s*\/\*/.test(linea) && !linea.includes('*/')) { enBloque = true; comentarioPrevio = ''; continue; }
    if (/^\s*$/.test(linea)) { comentarioPrevio = ''; continue; }

    if (profundidad === 0) {
      if (/^\s*(module|function)\b/.test(linea)) hayModulos = true;
      const m = linea.match(RE_ASIGNACION);
      if (m && !/^\s*(module|function|include|use)\b/.test(linea)) {
        const textoValor = m[4];
        const inicio = m[1].length + m[2].length + m[3].length;
        const v = parsearValor(textoValor);
        const an = parsearAnotacion(m[7]);
        const oculta = /^hidden$/i.test(grupo);
        variables.push({
          nombre: m[2],
          linea: i,
          tipo: v.tipo,
          valor: v.valor,
          textoValor,
          inicio,
          fin: inicio + textoValor.length,
          grupo,
          descripcion: an.descripcion || comentarioPrevio,
          rango: an.rango,
          lista: an.lista,
          oculta,
          despuesDeModulos: hayModulos
        });
        if (!grupos.includes(grupo)) grupos.push(grupo);
      }
    }
    const estructural = quitarStringsYComentarios(linea);
    for (const ch of estructural) {
      if (ch === '{') profundidad++;
      else if (ch === '}') profundidad = Math.max(0, profundidad - 1);
    }
    comentarioPrevio = '';
  }
  return { variables, grupos, lineas: lineas.length };
}

// Rol de cada variable según cómo se usa en el código (para armar los controles).
export function clasificarVariables(codigo, variables) {
  const cod = String(codigo || '');
  const escapar = n => n.replace(/[$]/g, '\\$&');
  for (const v of variables) {
    const n = escapar(v.nombre);
    const usoTexto = new RegExp(`text\\s*\\([^;]*\\b${n}\\b`, 's').test(cod);
    const usoFuente = new RegExp(`font\\s*=\\s*${n}\\b`).test(cod);
    const usoTranslate = new RegExp(`translate\\s*\\(\\s*${n}\\b`).test(cod);
    const usoRotate = new RegExp(`rotate\\s*\\(\\s*${n}\\b`).test(cod);
    const nombre = v.nombre.toLowerCase();
    let rol = v.tipo;
    if (v.nombre === '$fn' || /^(calidad|resolucion|segmentos|fn)$/.test(nombre)) rol = 'calidad';
    else if (v.tipo === 'cadena' && (usoFuente || /fuente|font|tipografia/.test(nombre))) rol = 'fuente';
    else if (v.tipo === 'cadena' && (usoTexto || /texto|text|leyenda|label|inscripcion|frase|palabra/.test(nombre))) rol = 'texto';
    else if (v.tipo === 'vector' && (usoRotate || /^rot|rotacion|giro|angulos?_/.test(nombre))) rol = 'rotacion';
    else if (v.tipo === 'vector' && (usoTranslate || /^pos|posicion|ubicacion|centro|offset|desplaz/.test(nombre))) rol = 'posicion';
    else if (v.tipo === 'puntos') rol = 'puntos';
    else if (v.tipo === 'bool') rol = 'bool';
    v.rol = rol;
  }
  return variables;
}

// Da formato a un número sin colas de ceros.
export function formatearNumero(n) {
  if (!Number.isFinite(n)) return '0';
  const r = Math.round(n * 10000) / 10000;
  return String(r);
}

// Texto OpenSCAD para un valor según su tipo.
export function valorATexto(tipo, valor) {
  if (tipo === 'bool') return valor ? 'true' : 'false';
  if (tipo === 'numero') return formatearNumero(valor);
  if (tipo === 'cadena') return JSON.stringify(String(valor));
  if (tipo === 'vector') return '[' + valor.map(formatearNumero).join(', ') + ']';
  if (tipo === 'puntos') return '[' + valor.map(p => '[' + p.map(formatearNumero).join(', ') + ']').join(', ') + ']';
  return String(valor);
}

// Reemplaza el valor de la variable (por su línea) y devuelve el código nuevo.
export function aplicarValor(codigo, variable, textoNuevo) {
  const lineas = String(codigo || '').replace(/\r/g, '').split('\n');
  const l = lineas[variable.linea];
  if (l === undefined) return codigo;
  lineas[variable.linea] = l.slice(0, variable.inicio) + textoNuevo + l.slice(variable.fin);
  return lineas.join('\n');
}

// Rango razonable para un deslizador cuando la variable no lo declara.
export function rangoSugerido(v) {
  if (v.rango) {
    const paso = v.rango.paso || (Math.abs(v.rango.max - v.rango.min) > 20 ? 1 : 0.1);
    return { min: v.rango.min, max: v.rango.max, paso };
  }
  const val = v.tipo === 'numero' ? v.valor : 0;
  const a = Math.abs(val);
  if (a === 0) return { min: -10, max: 10, paso: 0.5 };
  const entero = Number.isInteger(val);
  const paso = a >= 50 ? 1 : (a >= 5 ? (entero ? 1 : 0.5) : 0.1);
  const max = Math.ceil((a * 2.5) / paso) * paso;
  return { min: val < 0 ? -max : 0, max, paso };
}

// Saca el código de la respuesta de una IA: si hay bloques ```...```, usa el
// más largo (el archivo completo); si no, devuelve el texto tal cual.
export function extraerCodigo(respuesta) {
  const t = String(respuesta || '').replace(/\r/g, '');
  const bloques = [...t.matchAll(/```[a-zA-Z]*\s*\n([\s\S]*?)```/g)].map(m => m[1]);
  if (bloques.length) return bloques.sort((a, b) => b.length - a.length)[0].trim() + '\n';
  return t.trim() ? t.trim() + '\n' : '';
}

// Lee los "ERROR:" y "WARNING:" de la salida de OpenSCAD para mostrarlos con su línea.
export function resumirSalida(salida) {
  const filas = [];
  for (const s of salida || []) {
    const t = String(s);
    if (/^(ERROR|WARNING|DEPRECATED)/.test(t)) {
      const m = t.match(/line (\d+)/);
      filas.push({ nivel: t.startsWith('ERROR') ? 'error' : 'aviso', texto: t.replace(/ in file [^,]*,?/, '').replace(/ of file[^\n]*/, ''), linea: m ? parseInt(m[1], 10) : null });
    } else if (/^ECHO:/.test(t)) {
      filas.push({ nivel: 'echo', texto: t.replace(/^ECHO:\s*/, ''), linea: null });
    }
  }
  return filas;
}

// STL ASCII → posiciones planas (Float32Array), cantidad de triángulos y caja.
export function leerStlAscii(texto) {
  const re = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g;
  const nums = [];
  let m;
  while ((m = re.exec(texto)) !== null) nums.push(+m[1], +m[2], +m[3]);
  const pos = new Float32Array(nums);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) {
    if (pos[i + k] < min[k]) min[k] = pos[i + k];
    if (pos[i + k] > max[k]) max[k] = pos[i + k];
  }
  return { posiciones: pos, triangulos: pos.length / 9, min, max };
}

// Posiciones planas → STL binario (ArrayBuffer), con normales calculadas.
export function aStlBinario(posiciones, nombre = 'pieza') {
  const n = Math.floor(posiciones.length / 9);
  const buf = new ArrayBuffer(84 + n * 50);
  const dv = new DataView(buf);
  const cab = new TextEncoder().encode(('Pieza 3D con IA — ' + nombre).slice(0, 79));
  new Uint8Array(buf, 0, 80).set(cab);
  dv.setUint32(80, n, true);
  let p = 84;
  for (let i = 0; i < n; i++) {
    const o = i * 9;
    const ax = posiciones[o], ay = posiciones[o + 1], az = posiciones[o + 2];
    const bx = posiciones[o + 3], by = posiciones[o + 4], bz = posiciones[o + 5];
    const cx = posiciones[o + 6], cy = posiciones[o + 7], cz = posiciones[o + 8];
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    dv.setFloat32(p, nx, true); dv.setFloat32(p + 4, ny, true); dv.setFloat32(p + 8, nz, true); p += 12;
    for (let k = 0; k < 9; k++) { dv.setFloat32(p, posiciones[o + k], true); p += 4; }
    dv.setUint16(p, 0, true); p += 2;
  }
  return buf;
}
