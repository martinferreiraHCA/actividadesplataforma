// Moldes para colar desde un modelo 3D — núcleo de cálculo (sin DOM, corre en
// un Web Worker). Convierte un modelo (triángulos) en moldes imprimibles:
//
//  - molde rígido de dos partes (velas, resina, yeso): el negativo del modelo,
//    partido por un plano de junta, con pernos de alineación, embudo de
//    colada, respiradero y ranuras para gomas;
//  - molde abierto de una pieza (bandejas, posavasos, jabones de cara plana);
//  - caja para silicona: la caja impresa con el modelo adentro, para verter
//    silicona y obtener un molde flexible;
//  - molde de prensa (arcilla, jabón en frío, bombas de baño): matriz con la
//    cavidad y pistón con el relieve de arriba.
//
// Todo se hace con campos de distancia sobre una grilla de vóxeles: el modelo
// se voxeliza (paridad de cruces por columna) y se le calcula una distancia
// con signo (exacta cerca de la superficie, transformada euclídea lejos); las
// cajas, cilindros y planos son fórmulas; unir = mínimo, intersecar = máximo,
// restar = máximo con el opuesto. Cada parte se vuelve malla con surface nets.

import { extraerMalla, reducirQEM, volumenMalla } from './escaneo3d-nucleo.js';

// ============================================================
// Triángulos: orientación, escala y caja
// ============================================================

// tris: Float32Array con 9 números por triángulo. Devuelve una copia con el
// eje «arriba» del modelo llevado a +Z, invertida si se pide, escalada y
// apoyada en z = 0 con el centro XY en el origen.
export function orientar(tris, arriba, invertir, escala) {
  const salida = new Float32Array(tris.length);
  for (let i = 0; i < tris.length; i += 3) {
    let x = tris[i], y = tris[i + 1], z = tris[i + 2];
    let nx, ny, nz;
    if (arriba === 'y') { nx = x; ny = -z; nz = y; }
    else if (arriba === 'x') { nx = -z; ny = y; nz = x; }
    else { nx = x; ny = y; nz = z; }
    if (invertir) { ny = -ny; nz = -nz; }
    salida[i] = nx * escala; salida[i + 1] = ny * escala; salida[i + 2] = nz * escala;
  }
  const c = cajaDeTris(salida);
  const dx = (c.min[0] + c.max[0]) / 2, dy = (c.min[1] + c.max[1]) / 2, dz = c.min[2];
  for (let i = 0; i < salida.length; i += 3) { salida[i] -= dx; salida[i + 1] -= dy; salida[i + 2] -= dz; }
  return salida;
}

export function cajaDeTris(tris) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < tris.length; i += 3) for (let k = 0; k < 3; k++) {
    const v = tris[i + k];
    if (v < min[k]) min[k] = v;
    if (v > max[k]) max[k] = v;
  }
  return { min, max, dim: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
}

// ============================================================
// Grilla
// ============================================================

export function crearGrilla(min, max, maxNodos) {
  const vol = Math.max(1, (max[0] - min[0]) * (max[1] - min[1]) * (max[2] - min[2]));
  let voxel = Math.max(0.12, Math.cbrt(vol / maxNodos));
  voxel = Math.ceil(voxel * 100) / 100;
  // corrimiento irracional para que los nodos no caigan justo sobre vértices
  const origen = [min[0] - 1.0137 * voxel, min[1] - 1.0241 * voxel, min[2] - 1.0193 * voxel];
  const nx = Math.ceil((max[0] - origen[0]) / voxel) + 2;
  const ny = Math.ceil((max[1] - origen[1]) / voxel) + 2;
  const nz = Math.ceil((max[2] - origen[2]) / voxel) + 2;
  return { nx, ny, nz, voxel, origen, nodos: nx * ny * nz };
}

// Recorre todos los nodos llamando fn(indice, x, y, z) y guarda el resultado.
export function evaluar(g, fn, salida) {
  const { nx, ny, nz, voxel, origen } = g;
  const F = salida || new Float32Array(g.nodos);
  let i = 0;
  for (let k = 0; k < nz; k++) {
    const z = origen[2] + k * voxel;
    for (let j = 0; j < ny; j++) {
      const y = origen[1] + j * voxel;
      for (let ii = 0; ii < nx; ii++, i++) F[i] = fn(i, origen[0] + ii * voxel, y, z);
    }
  }
  return F;
}

// ============================================================
// Voxelizado del modelo: paridad de cruces a lo largo de Z
// ============================================================

export function ocupacion(tris, g) {
  const { nx, ny, nz, voxel, origen } = g;
  const cruces = new Array(nx * ny);
  const nT = tris.length / 9;
  for (let t = 0; t < nT; t++) {
    const o = t * 9;
    const ax = tris[o], ay = tris[o + 1], az = tris[o + 2];
    const bx = tris[o + 3], by = tris[o + 4], bz = tris[o + 5];
    const cx = tris[o + 6], cy = tris[o + 7], cz = tris[o + 8];
    const det = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    if (Math.abs(det) < 1e-12) continue;            // visto de canto: no cruza columnas
    const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - origen[0]) / voxel));
    const i1 = Math.min(nx - 1, Math.floor((Math.max(ax, bx, cx) - origen[0]) / voxel));
    const j0 = Math.max(0, Math.ceil((Math.min(ay, by, cy) - origen[1]) / voxel));
    const j1 = Math.min(ny - 1, Math.floor((Math.max(ay, by, cy) - origen[1]) / voxel));
    for (let j = j0; j <= j1; j++) {
      const y = origen[1] + j * voxel;
      for (let i = i0; i <= i1; i++) {
        const x = origen[0] + i * voxel;
        // coordenadas baricéntricas en el plano XY
        const l1 = ((bx - x) * (cy - y) - (cx - x) * (by - y)) / det;
        const l2 = ((cx - x) * (ay - y) - (ax - x) * (cy - y)) / det;
        const l3 = 1 - l1 - l2;
        if (l1 < 0 || l2 < 0 || l3 < 0) continue;
        const z = l1 * az + l2 * bz + l3 * cz;
        const c = i + j * nx;
        (cruces[c] || (cruces[c] = [])).push(z);
      }
    }
  }
  const dentro = new Uint8Array(g.nodos);
  let columnasRaras = 0, nodosDentro = 0;
  for (let c = 0; c < nx * ny; c++) {
    const lista = cruces[c];
    if (!lista) continue;
    lista.sort((a, b) => a - b);
    if (lista.length % 2 === 1) { columnasRaras++; lista.pop(); }
    for (let p = 0; p + 1 < lista.length; p += 2) {
      const k0 = Math.max(0, Math.ceil((lista[p] - origen[2]) / voxel));
      const k1 = Math.min(nz - 1, Math.floor((lista[p + 1] - origen[2]) / voxel));
      for (let k = k0; k <= k1; k++) { dentro[c + k * nx * ny] = 1; nodosDentro++; }
    }
  }
  return { dentro, columnasRaras, nodosDentro };
}

// ============================================================
// Distancia exacta cerca de la superficie (banda angosta)
// ============================================================

// Distancia al cuadrado de un punto a un triángulo (Ericson, Real-Time Collision Detection).
function dist2PuntoTriangulo(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz) {
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) return apx * apx + apy * apy + apz * apz;
  const bpx = px - bx, bpy = py - by, bpz = pz - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz;
  const d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) return bpx * bpx + bpy * bpy + bpz * bpz;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    const qx = apx - v * abx, qy = apy - v * aby, qz = apz - v * abz;
    return qx * qx + qy * qy + qz * qz;
  }
  const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz;
  const d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) return cpx * cpx + cpy * cpy + cpz * cpz;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    const qx = apx - w * acx, qy = apy - w * acy, qz = apz - w * acz;
    return qx * qx + qy * qy + qz * qz;
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    const qx = bpx - w * (cx - bx), qy = bpy - w * (cy - by), qz = bpz - w * (cz - bz);
    return qx * qx + qy * qy + qz * qz;
  }
  const den = 1 / (va + vb + vc);
  const v = vb * den, w = vc * den;
  const qx = apx - (abx * v + acx * w), qy = apy - (aby * v + acy * w), qz = apz - (abz * v + acz * w);
  return qx * qx + qy * qy + qz * qz;
}

export function bandaExacta(tris, g) {
  const { nx, ny, nz, voxel, origen } = g;
  const banda = new Float32Array(g.nodos).fill(Infinity);
  const nT = tris.length / 9;
  for (let t = 0; t < nT; t++) {
    const o = t * 9;
    const ax = tris[o], ay = tris[o + 1], az = tris[o + 2];
    const bx = tris[o + 3], by = tris[o + 4], bz = tris[o + 5];
    const cx = tris[o + 6], cy = tris[o + 7], cz = tris[o + 8];
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - origen[0]) / voxel) - 1);
    const i1 = Math.min(nx - 1, Math.ceil((Math.max(ax, bx, cx) - origen[0]) / voxel) + 1);
    const j0 = Math.max(0, Math.floor((Math.min(ay, by, cy) - origen[1]) / voxel) - 1);
    const j1 = Math.min(ny - 1, Math.ceil((Math.max(ay, by, cy) - origen[1]) / voxel) + 1);
    const k0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - origen[2]) / voxel) - 1);
    const k1 = Math.min(nz - 1, Math.ceil((Math.max(az, bz, cz) - origen[2]) / voxel) + 1);
    for (let k = k0; k <= k1; k++) {
      const z = origen[2] + k * voxel;
      for (let j = j0; j <= j1; j++) {
        const y = origen[1] + j * voxel;
        let idx = i0 + j * nx + k * nx * ny;
        for (let i = i0; i <= i1; i++, idx++) {
          const d2 = dist2PuntoTriangulo(origen[0] + i * voxel, y, z, ax, ay, az, bx, by, bz, cx, cy, cz);
          if (d2 < banda[idx]) banda[idx] = d2;
        }
      }
    }
  }
  for (let i = 0; i < banda.length; i++) if (banda[i] < Infinity) banda[i] = Math.sqrt(banda[i]);
  return banda;
}

// ============================================================
// Transformada de distancia euclídea (Felzenszwalb & Huttenlocher)
// ============================================================

const INF = 1e20;

function edt1d(f, n, d, v, z) {
  let k = 0;
  v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s;
    for (;;) {
      const p = v[k];
      s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p);
      if (s <= z[k] && k > 0) k--; else break;
    }
    k++;
    v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const p = v[k];
    d[q] = (q - p) * (q - p) + f[p];
  }
}

// Distancia (en vóxeles) de cada nodo al nodo «rasgo» más cercano (rasgo[i] = 1).
export function edt3d(rasgo, nx, ny, nz) {
  const n = nx * ny * nz;
  const D = new Float32Array(n);
  for (let i = 0; i < n; i++) D[i] = rasgo[i] ? 0 : INF;
  const L = Math.max(nx, ny, nz);
  const f = new Float64Array(L), d = new Float64Array(L), v = new Int32Array(L), z = new Float64Array(L + 1);
  // X
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) {
    const base = j * nx + k * nx * ny;
    for (let i = 0; i < nx; i++) f[i] = D[base + i];
    edt1d(f, nx, d, v, z);
    for (let i = 0; i < nx; i++) D[base + i] = d[i];
  }
  // Y
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    const base = i + k * nx * ny;
    for (let j = 0; j < ny; j++) f[j] = D[base + j * nx];
    edt1d(f, ny, d, v, z);
    for (let j = 0; j < ny; j++) D[base + j * nx] = d[j];
  }
  // Z
  if (nz > 1) {
    const paso = nx * ny;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const base = i + j * nx;
      for (let k = 0; k < nz; k++) f[k] = D[base + k * paso];
      edt1d(f, nz, d, v, z);
      for (let k = 0; k < nz; k++) D[base + k * paso] = d[k];
    }
  }
  for (let i = 0; i < n; i++) D[i] = Math.sqrt(D[i]);
  return D;
}

// Campo de distancia con signo del modelo (mm, negativo adentro).
export function campoModelo(tris, g, dentro) {
  const { nx, ny, nz, voxel } = g;
  const n = g.nodos;
  const fuera = new Uint8Array(n);
  for (let i = 0; i < n; i++) fuera[i] = dentro[i] ? 0 : 1;
  const dAlDentro = edt3d(dentro, nx, ny, nz);
  const dAlFuera = edt3d(fuera, nx, ny, nz);
  const phi = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    phi[i] = dentro[i] ? -Math.max(0.25, dAlFuera[i] - 0.5) * voxel : Math.max(0.25, dAlDentro[i] - 0.5) * voxel;
  }
  const banda = bandaExacta(tris, g);
  for (let i = 0; i < n; i++) {
    if (banda[i] <= voxel) phi[i] = dentro[i] ? -banda[i] : banda[i];
  }
  return phi;
}

// Campo 2D con signo (mm) de la huella del modelo vista desde arriba.
export function huella2D(dentro, g) {
  const { nx, ny, nz, voxel } = g;
  const m = new Uint8Array(nx * ny);
  for (let k = 0; k < nz; k++) {
    const base = k * nx * ny;
    for (let c = 0; c < nx * ny; c++) if (dentro[base + c]) m[c] = 1;
  }
  const inv = new Uint8Array(nx * ny);
  for (let c = 0; c < nx * ny; c++) inv[c] = m[c] ? 0 : 1;
  const dIn = edt3d(m, nx, ny, 1), dOut = edt3d(inv, nx, ny, 1);
  const f = new Float32Array(nx * ny);
  for (let c = 0; c < nx * ny; c++) f[c] = m[c] ? -Math.max(0.25, dOut[c] - 0.5) * voxel : Math.max(0.25, dIn[c] - 0.5) * voxel;
  return { campo: f, mascara: m };
}

// ============================================================
// Primitivas (mm, negativo adentro)
// ============================================================

export function sdfCaja(x, y, z, min, max, r) {
  const qx = Math.abs(x - (min[0] + max[0]) / 2) - (max[0] - min[0]) / 2 + r;
  const qy = Math.abs(y - (min[1] + max[1]) / 2) - (max[1] - min[1]) / 2 + r;
  const qz = Math.abs(z - (min[2] + max[2]) / 2) - (max[2] - min[2]) / 2 + r;
  const ex = Math.max(qx, 0), ey = Math.max(qy, 0), ez = Math.max(qz, 0);
  return Math.sqrt(ex * ex + ey * ey + ez * ez) + Math.min(Math.max(qx, qy, qz), 0) - r;
}

// cilindro vertical (eje Z) entre z0 y z1
export function sdfCilindroZ(x, y, z, cx, cy, r, z0, z1) {
  const d = Math.hypot(x - cx, y - cy) - r;
  const h = Math.max(z0 - z, z - z1);
  const ex = Math.max(d, 0), eh = Math.max(h, 0);
  return Math.sqrt(ex * ex + eh * eh) + Math.min(Math.max(d, h), 0);
}

// rectángulo redondeado en 2D
export function sdfRect2D(x, y, min, max, r) {
  const qx = Math.abs(x - (min[0] + max[0]) / 2) - (max[0] - min[0]) / 2 + r;
  const qy = Math.abs(y - (min[1] + max[1]) / 2) - (max[1] - min[1]) / 2 + r;
  const ex = Math.max(qx, 0), ey = Math.max(qy, 0);
  return Math.sqrt(ex * ex + ey * ey) + Math.min(Math.max(qx, qy), 0) - r;
}

// ============================================================
// Ubicación del embudo y de los pernos
// ============================================================

// Columna más alta del modelo (para el embudo) y otra alta y alejada (para el
// respiradero). Devuelve coordenadas en mm.
export function puntosAltos(dentro, g, separacionMin) {
  const { nx, ny, nz, voxel, origen } = g;
  const topes = new Int16Array(nx * ny).fill(-1);
  let kMax = -1;
  for (let k = nz - 1; k >= 0; k--) {
    const base = k * nx * ny;
    for (let c = 0; c < nx * ny; c++) if (topes[c] < 0 && dentro[base + c]) { topes[c] = k; if (k > kMax) kMax = k; }
  }
  if (kMax < 0) return null;
  const cxI = (nx - 1) / 2, cyI = (ny - 1) / 2;
  let mejor = -1, mejorD = Infinity;
  for (let c = 0; c < nx * ny; c++) {
    if (topes[c] !== kMax) continue;
    const d = Math.hypot(c % nx - cxI, Math.floor(c / nx) - cyI);
    if (d < mejorD) { mejorD = d; mejor = c; }
  }
  const embudo = [origen[0] + (mejor % nx) * voxel, origen[1] + Math.floor(mejor / nx) * voxel, origen[2] + kMax * voxel];
  // respiradero: alto (a menos de 3 mm del tope) y lo más lejos posible del embudo
  let resp = null, respD = separacionMin;
  const tol = Math.ceil(3 / voxel);
  for (let c = 0; c < nx * ny; c++) {
    if (topes[c] < kMax - tol) continue;
    const x = origen[0] + (c % nx) * voxel, y = origen[1] + Math.floor(c / nx) * voxel;
    const d = Math.hypot(x - embudo[0], y - embudo[1]);
    if (d > respD) { respD = d; resp = [x, y, origen[2] + topes[c] * voxel]; }
  }
  return { embudo, respiradero: resp };
}

// Pernos en el plano de junta: dentro de la pared del molde, lejos de la
// cavidad y del borde, en los cuatro extremos de la junta.
export function ubicarPernos(campoMolde, g, eje, s, radio) {
  const { nx, ny, nz, voxel, origen } = g;
  const dims = [nx, ny, nz];
  const ks = Math.round((s - origen[eje]) / voxel);
  if (ks < 0 || ks >= dims[eje]) return [];
  const eu = (eje + 1) % 3, ev = (eje + 2) % 3;
  const nu = dims[eu], nv = dims[ev];
  const paso = [1, nx, nx * ny];
  const pared = new Uint8Array(nu * nv), libre = new Uint8Array(nu * nv);
  for (let v = 0; v < nv; v++) for (let u = 0; u < nu; u++) {
    const i = ks * paso[eje] + u * paso[eu] + v * paso[ev];
    const p = campoMolde[i] < 0 ? 1 : 0;
    pared[u + v * nu] = p; libre[u + v * nu] = p ? 0 : 1;
  }
  const d = edt3d(libre, nu, nv, 1);       // distancia al no-molde (cavidad o exterior)
  const minimo = (radio + 1.0) / voxel;
  const extremos = [null, null, null, null], valor = [-Infinity, -Infinity, -Infinity, -Infinity];
  for (let v = 0; v < nv; v++) for (let u = 0; u < nu; u++) {
    const c = u + v * nu;
    if (!pared[c] || d[c] < minimo) continue;
    const claves = [u, -u, v, -v];               // +U, −U, +V, −V
    for (let e = 0; e < 4; e++) {
      // desempate: el más centrado en el otro eje
      const centrado = e < 2 ? -Math.abs(v - (nv - 1) / 2) * 1e-3 : -Math.abs(u - (nu - 1) / 2) * 1e-3;
      const val = claves[e] + centrado;
      if (val > valor[e]) { valor[e] = val; extremos[e] = [u, v]; }
    }
  }
  const pernos = [];
  for (const e of extremos) {
    if (!e) continue;
    const p = [0, 0, 0];
    p[eje] = s;
    p[eu] = origen[eu] + e[0] * voxel;
    p[ev] = origen[ev] + e[1] * voxel;
    // sin duplicados demasiado cerca
    if (pernos.some(q => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < 3 * radio)) continue;
    pernos.push(p);
  }
  return pernos;
}

// ============================================================
// Mallas: extracción, reducción y poses de impresión
// ============================================================

export function mallaDeCampo(F, g, maxTriangulos) {
  let m = extraerMalla(F, { nx: g.nx, ny: g.ny, nz: g.nz, voxel: g.voxel, origen: g.origen });
  if (maxTriangulos && m.idx.length / 3 > maxTriangulos * 1.2) m = reducirQEM(m, maxTriangulos);
  return m;
}

// Aplica fn([x,y,z]) → [x,y,z] a cada vértice y apoya la malla en z = 0 centrada en XY.
export function posar(m, fn) {
  const pos = new Float32Array(m.pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    const p = fn([m.pos[i], m.pos[i + 1], m.pos[i + 2]]);
    pos[i] = p[0]; pos[i + 1] = p[1]; pos[i + 2] = p[2];
  }
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) {
    if (pos[i + k] < min[k]) min[k] = pos[i + k];
    if (pos[i + k] > max[k]) max[k] = pos[i + k];
  }
  const dx = (min[0] + max[0]) / 2, dy = (min[1] + max[1]) / 2, dz = min[2];
  for (let i = 0; i < pos.length; i += 3) { pos[i] -= dx; pos[i + 1] -= dy; pos[i + 2] -= dz; }
  const malla = { pos, idx: m.idx };
  // una reflexión o un giro impropio invertiría las caras: se corrige por el volumen
  if (volumenMalla(malla) < 0) {
    const idx = Uint32Array.from(m.idx);
    for (let t = 0; t < idx.length; t += 3) { const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp; }
    malla.idx = idx;
  }
  malla.medidas = { ancho: max[0] - min[0], profundo: max[1] - min[1], alto: max[2] - min[2] };
  return malla;
}

// Giro que lleva la cara de junta (normal +eje o −eje) a apoyarse en la cama (−Z).
export function poseDeJunta(eje, sentido) {
  if (eje === 2) return sentido > 0 ? p => [p[0], -p[1], -p[2]] : p => p;
  if (eje === 1) return sentido > 0 ? p => [p[0], p[2], -p[1]] : p => [p[0], -p[2], p[1]];
  return sentido > 0 ? p => [p[2], p[1], -p[0]] : p => [-p[2], p[1], p[0]];
}

export const darVuelta = p => [p[0], -p[1], -p[2]];
export const identidad = p => p;

// ============================================================
// Armado de los moldes
// ============================================================

const COLORES = { molde: 0x9aa3b2, moldeB: 0x7f8a9c, modelo: 0xc65a35, piston: 0xd0b16b };

// Datos comunes: campo del modelo y cajas. Devuelve [{nombre, campo, pose, color}].
function cajaMolde(min, max, m, abajo, arriba) {
  return { min: [min[0] - m, min[1] - m, min[2] - abajo], max: [max[0] + m, max[1] + m, max[2] + arriba] };
}

// Molde rígido (dos partes o abierto)
export function armarRigido(ctx, op, avisar) {
  const { g, phi, dentro, caja } = ctx;
  const pared = op.pared, holg = op.holgura;
  const contorneado = op.paredTipo === 'forma';
  const abierto = op.tipo === 'abierto';
  const zTope = caja.max[2];
  const ext = cajaMolde(caja.min, caja.max, holg + pared, pared, abierto ? 0 : holg + pared);
  if (abierto) ext.max[2] = zTope;
  const altoMolde = ext.max[2] - ext.min[2];
  // exterior
  const exterior = (i, x, y, z) => {
    if (!contorneado) return sdfCaja(x, y, z, ext.min, ext.max, Math.min(1.5, pared / 2));
    let d = phi[i] - (holg + pared);
    d = Math.max(d, ext.min[2] - z);               // piso plano
    if (abierto) d = Math.max(d, z - zTope);         // boca abierta
    return d;
  };
  // embudo y respiradero
  let embudo = null, resp = null;
  if (!abierto) {
    const alto = puntosAltos(dentro, g, 2 * op.diamEmbudo + 4);
    if (alto) { embudo = alto.embudo; resp = op.diamResp > 0 ? alto.respiradero : null; }
    if (op.diamResp > 0 && !resp) avisar('No hay lugar para el respiradero lejos del embudo: se omite.');
  }
  const rEmb = op.diamEmbudo / 2, rResp = op.diamResp / 2;
  const zTopeMolde = ext.max[2];
  const campoMolde = evaluar(g, (i, x, y, z) => {
    let d = Math.max(exterior(i, x, y, z), -(phi[i] - op.holguraPieza));
    if (embudo) {
      // cilindro desde arriba hasta un poco adentro del modelo, con boca cónica
      const r = rEmb + Math.max(0, z - (zTopeMolde - 5)) * 0.8;
      const c = sdfCilindroZ(x, y, z, embudo[0], embudo[1], r, embudo[2] - 1.5, zTopeMolde + 2);
      d = Math.max(d, -c);
    }
    if (resp) {
      const c = sdfCilindroZ(x, y, z, resp[0], resp[1], rResp, resp[2] - 1, zTopeMolde + 2);
      d = Math.max(d, -c);
    }
    if (op.gomas && !abierto) {
      for (const f of [1 / 3, 2 / 3]) {
        const zg = ext.min[2] + altoMolde * f;
        // ranura: a menos de 1,5 mm de la cara exterior y a menos de 1,5 mm de la altura zg
        const ranura = Math.max(-(exterior(i, x, y, z) + 1.5), Math.abs(z - zg) - 1.5);
        d = Math.max(d, -ranura);
      }
    }
    return d;
  });
  if (abierto) {
    return { partes: [{ nombre: 'Molde abierto', campo: campoMolde, pose: identidad, color: COLORES.molde }], embudo, altoMolde };
  }
  // partido por el plano de junta
  const eje = op.juntaEje;                 // 0 = X, 1 = Y, 2 = Z
  const centro = [(caja.min[0] + caja.max[0]) / 2, (caja.min[1] + caja.max[1]) / 2, (caja.min[2] + caja.max[2]) / 2];
  const s = centro[eje] + op.juntaPos;
  const rk = Math.min(3, Math.max(1.5, pared * 0.4));
  const hk = rk * 1.6;
  const pernos = ubicarPernos(campoMolde, g, eje, s, rk);
  if (pernos.length < 2) avisar('La pared es muy fina para los pernos de alineación: engrosá la pared o usá pared tipo caja.');
  const clr = op.holguraEncastre;
  const coord = [0, 0, 0];
  const dist2D = (x, y, z, p) => {
    coord[0] = x; coord[1] = y; coord[2] = z;
    let d2 = 0;
    for (let a = 0; a < 3; a++) if (a !== eje) d2 += (coord[a] - p[a]) ** 2;
    return Math.sqrt(d2);
  };
  const campoA = evaluar(g, (i, x, y, z) => {
    const pa = eje === 0 ? x : eje === 1 ? y : z;
    let d = Math.max(campoMolde[i], pa - s);                       // se queda con pa ≤ s
    for (const p of pernos) {                                        // bolsillos
      const hueco = Math.max(dist2D(x, y, z, p) - (rk + clr), Math.max(pa - s - 0.5, (s - hk - clr) - pa));
      d = Math.max(d, -hueco);
    }
    return d;
  });
  const campoB = evaluar(g, (i, x, y, z) => {
    const pa = eje === 0 ? x : eje === 1 ? y : z;
    let d = Math.max(campoMolde[i], s - pa);                       // se queda con pa ≥ s
    for (const p of pernos) {                                        // pernos
      const perno = Math.max(dist2D(x, y, z, p) - rk, Math.max(pa - s, (s - hk) - pa));
      d = Math.min(d, perno);
    }
    return d;
  });
  return {
    partes: [
      { nombre: 'Mitad A (con bolsillos)', campo: campoA, pose: poseDeJunta(eje, +1), color: COLORES.molde, verDadoVuelta: true },
      { nombre: 'Mitad B (con pernos)', campo: campoB, pose: poseDeJunta(eje, -1), color: COLORES.moldeB, verDadoVuelta: true }
    ],
    embudo, pernos: pernos.length, altoMolde
  };
}

// Caja para silicona: paredes + base con el modelo fundido adentro
export function armarCajaSilicona(ctx, op) {
  const { g, phi, caja } = ctx;
  const s = op.silLados, piso = op.silPiso, techo = op.silTecho, pared = op.pared;
  const hund = Math.min(op.hundir, op.pared);
  // el modelo se apoya en el piso interior (hundido «hund» mm en la base)
  const zPiso = caja.min[2] + hund;
  const interior = { min: [caja.min[0] - s, caja.min[1] - s, zPiso], max: [caja.max[0] + s, caja.max[1] + s, caja.max[2] + techo + 20] };
  const exterior = { min: [interior.min[0] - pared, interior.min[1] - pared, zPiso - pared], max: [interior.max[0] + pared, interior.max[1] + pared, caja.max[2] + techo + 3] };
  const campo = evaluar(g, (i, x, y, z) => {
    const cajaExt = sdfCaja(x, y, z, exterior.min, exterior.max, 1);
    const hueco = sdfCaja(x, y, z, interior.min, interior.max, 0);
    let d = Math.max(cajaExt, -hueco);                 // la caja hueca, abierta arriba
    d = Math.min(d, Math.max(phi[i], zPiso - pared - z)); // + el modelo (pegado a la base)
    return d;
  });
  const volInterior = (interior.max[0] - interior.min[0]) * (interior.max[1] - interior.min[1]) * (caja.max[2] + techo - zPiso);
  return {
    partes: [{ nombre: 'Caja con el modelo', campo, pose: identidad, color: COLORES.molde, transparente: true }],
    volumenSiliconaMm3: volInterior - ctx.volumenModeloMm3 * (1 - hund / Math.max(caja.dim[2], 1e-6)),
    exterior
  };
}

// Molde de prensa: matriz (cavidad con piso) + pistón (con el relieve de arriba)
export function armarPrensa(ctx, op, avisar) {
  const { g, phi, dentro, caja } = ctx;
  const { nx, voxel, origen } = g;
  const pad = op.padding, pared = op.pared, clr = op.holguraEncastre;
  const zSeam = caja.min[2] + caja.dim[2] * 0.5 + op.juntaPos;
  const zTopeMatriz = caja.max[2] + 6;
  const zTapa = zTopeMatriz + 4;
  // contorno de la boca
  const huella = huella2D(dentro, g);
  let contorno;
  if (op.contorno === 'rect') {
    const r = Math.min(6, pad + 2);
    contorno = (x, y) => sdfRect2D(x, y, [caja.min[0] - pad, caja.min[1] - pad], [caja.max[0] + pad, caja.max[1] + pad], r);
  } else if (op.contorno === 'redondo') {
    const cx = (caja.min[0] + caja.max[0]) / 2, cy = (caja.min[1] + caja.max[1]) / 2;
    let rMax = 0;
    for (let c = 0; c < huella.mascara.length; c++) {
      if (!huella.mascara[c]) continue;
      rMax = Math.max(rMax, Math.hypot(origen[0] + (c % nx) * voxel - cx, origen[1] + Math.floor(c / nx) * voxel - cy));
    }
    const R = rMax + pad;
    contorno = (x, y) => Math.hypot(x - cx, y - cy) - R;
  } else {
    contorno = (x, y) => {
      const i = Math.min(nx - 1, Math.max(0, Math.round((x - origen[0]) / voxel)));
      const j = Math.min(g.ny - 1, Math.max(0, Math.round((y - origen[1]) / voxel)));
      return huella.campo[i + j * nx] - pad;
    };
  }
  const bloque = { min: [caja.min[0] - pad - pared, caja.min[1] - pad - pared, caja.min[2] - pared], max: [caja.max[0] + pad + pared, caja.max[1] + pad + pared, zTopeMatriz] };
  const cxE = (caja.min[0] + caja.max[0]) / 2, cyE = (caja.min[1] + caja.max[1]) / 2;
  const campoMatriz = evaluar(g, (i, x, y, z) => {
    const o = contorno(x, y);
    const prisma = Math.max(o, zSeam - z);                       // la boca, de la junta hacia arriba
    const bajo = Math.max(phi[i], z - zSeam);                    // el modelo por debajo de la junta
    let d = Math.max(sdfCaja(x, y, z, bloque.min, bloque.max, 1.5), -Math.min(prisma, bajo));
    if (op.eyector) d = Math.max(d, -sdfCilindroZ(x, y, z, cxE, cyE, 2, bloque.min[2] - 1, zSeam + 1));
    return d;
  });
  const tapa = { min: [bloque.min[0], bloque.min[1], zTopeMatriz], max: [bloque.max[0], bloque.max[1], zTapa] };
  const campoPiston = evaluar(g, (i, x, y, z) => {
    const o = contorno(x, y) + clr;
    const vastago = Math.max(o, Math.max(zSeam - z, z - zTopeMatriz - 0.5));
    let d = Math.min(vastago, sdfCaja(x, y, z, tapa.min, tapa.max, 1.5));
    const alto = Math.max(phi[i], zSeam - z);                    // el modelo por encima de la junta
    return Math.max(d, -alto);
  });
  if (caja.dim[2] * 0.5 + op.juntaPos < 1) avisar('La junta está muy abajo: casi todo el modelo queda en el pistón.');
  return {
    partes: [
      { nombre: 'Matriz (cavidad)', campo: campoMatriz, pose: identidad, color: COLORES.molde },
      { nombre: 'Pistón (relieve de arriba)', campo: campoPiston, pose: darVuelta, color: COLORES.piston }
    ],
    zSeam
  };
}

// ============================================================
// Pipeline completo
// ============================================================

export function generarMoldes(tris, op, avisar = () => {}, progreso = () => {}) {
  const avisos = [];
  const avisarLocal = (m) => { avisos.push(m); avisar(m); };
  progreso('Orientando el modelo…');
  const t0 = orientar(tris, op.arriba, op.invertir, op.escala);
  const caja = cajaDeTris(t0);
  // extensión de la grilla según el tipo de molde
  let margen, abajo, arriba;
  if (op.tipo === 'silicona') {
    margen = op.silLados + op.pared + 2; abajo = op.pared + 2; arriba = op.silTecho + 6;
  } else if (op.tipo === 'prensa') {
    margen = op.padding + op.pared + 2; abajo = op.pared + 2; arriba = 12;
  } else {
    margen = op.holgura + op.pared + 2; abajo = op.pared + 2; arriba = op.tipo === 'abierto' ? 2 : op.holgura + op.pared + 3;
  }
  const gMin = [caja.min[0] - margen, caja.min[1] - margen, caja.min[2] - abajo];
  const gMax = [caja.max[0] + margen, caja.max[1] + margen, caja.max[2] + arriba];
  const g = crearGrilla(gMin, gMax, op.maxNodos);
  progreso(`Voxelizando (${g.nx}×${g.ny}×${g.nz}, vóxel ${g.voxel.toFixed(2)} mm)…`);
  const oc = ocupacion(t0, g);
  if (!oc.nodosDentro) throw new Error('El modelo no encierra volumen: ¿es una malla cerrada?');
  if (oc.columnasRaras > (g.nx * g.ny) * 0.01) avisarLocal(`El modelo no es del todo cerrado (${oc.columnasRaras} columnas con cruces impares): se rellenó lo mejor posible. Si el molde sale con huecos, repará el STL.`);
  progreso('Calculando distancias…');
  const phi = campoModelo(t0, g, oc.dentro);
  const volumenModeloMm3 = oc.nodosDentro * g.voxel ** 3;
  const ctx = { g, phi, dentro: oc.dentro, caja, volumenModeloMm3 };
  progreso('Armando el molde…');
  let res;
  if (op.tipo === 'silicona') res = armarCajaSilicona(ctx, op, avisarLocal);
  else if (op.tipo === 'prensa') res = armarPrensa(ctx, op, avisarLocal);
  else res = armarRigido(ctx, op, avisarLocal);
  const partes = [];
  for (const p of res.partes) {
    progreso(`Extrayendo la malla: ${p.nombre}…`);
    const m0 = mallaDeCampo(p.campo, g, op.maxTriangulos);
    if (!m0.idx.length) { avisarLocal(`La parte «${p.nombre}» quedó vacía.`); continue; }
    const m = posar(m0, p.pose);
    partes.push({
      nombre: p.nombre, pos: m.pos, idx: m.idx, color: p.color, medidas: m.medidas, triangulos: m.idx.length / 3,
      verDadoVuelta: !!p.verDadoVuelta,   // en la vista se muestra con la cavidad hacia arriba (el STL va con la junta abajo)
      transparente: !!p.transparente
    });
  }
  // el modelo orientado, como malla, para mostrarlo de referencia
  const modelo = { pos: t0, triangulos: t0.length / 9 };
  return {
    partes, modelo, avisos,
    info: {
      voxel: g.voxel, nodos: g.nodos, modelo: caja.dim, volumenModeloMl: volumenModeloMm3 / 1000,
      volumenSiliconaMl: res.volumenSiliconaMm3 != null ? res.volumenSiliconaMm3 / 1000 : null,
      pernos: res.pernos, embudo: !!res.embudo
    }
  };
}
