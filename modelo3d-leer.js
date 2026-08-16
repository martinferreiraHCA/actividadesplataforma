// Lector de modelos 3D para "Diseño 3D con papel": convierte STL (binario y
// texto), OBJ y DXF (3DFACE / malla POLYLINE) en una lista de triángulos.
// Todo corre en el navegador, sin servicios externos.
//
//   leerModelo3D(arrayBuffer, nombreArchivo) →
//     { triangulos: [[x,y,z]×3, ...], formato, avisos: [] }

const DEC = new TextDecoder('utf-8');

function esTexto(bytes, n) {
  // heurística: los primeros n bytes son ASCII imprimible
  const m = Math.min(n, bytes.length);
  for (let i = 0; i < m; i++) {
    const b = bytes[i];
    if (b === 9 || b === 10 || b === 13) continue;
    if (b < 32 || b > 126) return false;
  }
  return true;
}

// ---------------- STL ----------------
function leerStlBinario(buf) {
  const dv = new DataView(buf);
  if (buf.byteLength < 84) throw new Error('STL binario truncado.');
  const n = dv.getUint32(80, true);
  if (buf.byteLength < 84 + n * 50) throw new Error('STL binario incompleto (faltan triángulos).');
  const tris = [];
  let p = 84;
  for (let i = 0; i < n; i++) {
    p += 12; // normal (se recalcula después)
    const t = [];
    for (let v = 0; v < 3; v++) {
      t.push([dv.getFloat32(p, true), dv.getFloat32(p + 4, true), dv.getFloat32(p + 8, true)]);
      p += 12;
    }
    p += 2; // attribute byte count
    tris.push(t);
  }
  return tris;
}

function leerStlTexto(texto) {
  const tris = [];
  let actual = [];
  const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
  let m;
  while ((m = re.exec(texto)) !== null) {
    actual.push([parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]);
    if (actual.length === 3) { tris.push(actual); actual = []; }
  }
  return tris;
}

function leerStl(buf, bytes) {
  const cabecera = DEC.decode(bytes.slice(0, 512)).trimStart().toLowerCase();
  // "solid" al inicio no alcanza: hay binarios que también lo ponen; probamos
  // texto solo si además aparece "facet"
  if (cabecera.startsWith('solid') && cabecera.includes('facet') && esTexto(bytes, 256)) {
    const tris = leerStlTexto(DEC.decode(bytes));
    if (tris.length) return tris;
  }
  return leerStlBinario(buf);
}

// ---------------- OBJ ----------------
function leerObj(texto) {
  const vs = [];
  const tris = [];
  for (const lineaCruda of texto.split(/\r?\n/)) {
    const linea = lineaCruda.trim();
    if (linea.startsWith('v ')) {
      const p = linea.slice(2).trim().split(/\s+/).map(Number);
      vs.push([p[0], p[1], p[2]]);
    } else if (linea.startsWith('f ')) {
      // índices "v", "v/vt", "v/vt/vn" o "v//vn"; negativos = relativos
      const idx = linea.slice(2).trim().split(/\s+/).map(tok => {
        const i = parseInt(tok.split('/')[0], 10);
        return i > 0 ? i - 1 : vs.length + i;
      }).filter(i => i >= 0 && i < vs.length);
      // abanico: (0, i, i+1)
      for (let i = 1; i + 1 < idx.length; i++) {
        tris.push([vs[idx[0]], vs[idx[i]], vs[idx[i + 1]]]);
      }
    }
  }
  return tris;
}

// ---------------- DXF ----------------
// Lee pares (código, valor) y junta 3DFACE + mallas POLYLINE/VERTEX (polyface).
function leerDxf(texto) {
  const lineas = texto.split(/\r?\n/);
  const tris = [];

  // --- 3DFACE: esquinas 10/20/30 .. 13/23/33 ---
  let i = 0;
  const pares = [];
  for (; i + 1 < lineas.length; i += 2) {
    pares.push([lineas[i].trim(), lineas[i + 1]]);
  }

  let en3dface = false;
  let esquinas = {};
  let enPolylinea = false;
  let polyVerts = [];
  let polyCaras = [];

  const cerrar3dface = () => {
    const p = [];
    for (let k = 0; k < 4; k++) {
      const x = esquinas['1' + k], y = esquinas['2' + k], z = esquinas['3' + k];
      if (x !== undefined && y !== undefined) p.push([x, y, z || 0]);
    }
    if (p.length >= 3) {
      tris.push([p[0], p[1], p[2]]);
      // cuarta esquina distinta → segundo triángulo del cuadrilátero
      if (p.length === 4 && (p[2][0] !== p[3][0] || p[2][1] !== p[3][1] || p[2][2] !== p[3][2])) {
        tris.push([p[0], p[2], p[3]]);
      }
    }
    esquinas = {};
  };
  const cerrarPolylinea = () => {
    for (const c of polyCaras) {
      const ix = c.map(v => Math.abs(v) - 1).filter(v => v >= 0 && v < polyVerts.length);
      for (let k = 1; k + 1 < ix.length; k++) {
        tris.push([polyVerts[ix[0]], polyVerts[ix[k]], polyVerts[ix[k + 1]]]);
      }
    }
    polyVerts = []; polyCaras = []; enPolylinea = false;
  };

  let vertActual = null; // VERTEX en curso: {x,y,z, caras:[71..74]}
  const cerrarVertex = () => {
    if (!vertActual) return;
    if (vertActual.caras.length) polyCaras.push(vertActual.caras);
    else if (vertActual.x !== undefined) polyVerts.push([vertActual.x, vertActual.y || 0, vertActual.z || 0]);
    vertActual = null;
  };

  for (const [cod, valCrudo] of pares) {
    const val = valCrudo.trim();
    if (cod === '0') {
      cerrarVertex();
      if (en3dface) { cerrar3dface(); en3dface = false; }
      if (val === '3DFACE') { en3dface = true; esquinas = {}; }
      else if (val === 'POLYLINE') { enPolylinea = true; polyVerts = []; polyCaras = []; }
      else if (val === 'VERTEX' && enPolylinea) { vertActual = { caras: [] }; }
      else if (val === 'SEQEND' && enPolylinea) { cerrarPolylinea(); }
      continue;
    }
    const num = parseFloat(val);
    if (en3dface && /^[123][0123]$/.test(cod)) esquinas[cod] = num;
    if (vertActual) {
      if (cod === '10') vertActual.x = num;
      else if (cod === '20') vertActual.y = num;
      else if (cod === '30') vertActual.z = num;
      else if (cod === '71' || cod === '72' || cod === '73' || cod === '74') {
        const ix = Math.trunc(num);
        if (ix !== 0) vertActual.caras.push(ix);
      }
    }
  }
  cerrarVertex();
  if (en3dface) cerrar3dface();
  if (enPolylinea) cerrarPolylinea();
  return tris;
}

// ---------------- API ----------------
function esTrianguloValido(t) {
  return t.every(p => p.every(Number.isFinite));
}

export function leerModelo3D(arrayBuffer, nombreArchivo) {
  const bytes = new Uint8Array(arrayBuffer);
  if (!bytes.length) throw new Error('El archivo está vacío.');
  const ext = String(nombreArchivo || '').toLowerCase().replace(/^.*\./, '');
  const avisos = [];

  let tris = null;
  let formato = ext;
  if (ext === 'stl') {
    tris = leerStl(arrayBuffer, bytes);
  } else if (ext === 'obj') {
    tris = leerObj(DEC.decode(bytes));
  } else if (ext === 'dxf') {
    tris = leerDxf(DEC.decode(bytes));
    if (!tris.length) {
      throw new Error('El DXF no tiene caras 3D (3DFACE o malla POLYLINE). Si el modelo es de líneas o sólidos, exportalo desde Blender como malla, o usá STL/OBJ.');
    }
  } else {
    throw new Error('Formato no soportado: .' + ext + '. Se aceptan .stl (Tinkercad), .obj y .dxf con caras 3D.');
  }

  const antes = tris.length;
  tris = tris.filter(esTrianguloValido);
  if (tris.length < antes) avisos.push(`Se descartaron ${antes - tris.length} caras con datos inválidos.`);
  if (!tris.length) throw new Error('El modelo no tiene triángulos legibles.');
  return { triangulos: tris, formato, avisos };
}

// caja del modelo: { min:[x,y,z], max:[x,y,z], dim:[dx,dy,dz] }
export function cajaDelModelo(triangulos) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const t of triangulos) for (const p of t) {
    for (let k = 0; k < 3; k++) {
      if (p[k] < min[k]) min[k] = p[k];
      if (p[k] > max[k]) max[k] = p[k];
    }
  }
  return { min, max, dim: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
}
