// Escaneo 3D con Kinect — núcleo de cálculo (sin DOM, sin three.js).
//
// Todo lo que va del mapa de profundidad del Kinect al .stl vive acá:
//  - desempaquetado de los 11 bits por píxel que manda el sensor y paso a milímetros,
//  - promedio de varios cuadros y filtros del mapa (mediana, huecos, puntos voladores),
//  - detección de la mesa (RANSAC de un plano) y armado del marco de trabajo
//    (origen sobre la mesa, eje vertical = normal del plano),
//  - fusión volumétrica (TSDF) de las tomas hechas girando la pieza sobre una base,
//    o «relieve» (mapa de alturas) para una sola toma,
//  - extracción de la malla con «surface nets» (sin tablas de marching cubes),
//  - purgado: componente mayor, suavizado Taubin, reducción de triángulos,
//  - exportación a STL binario, OBJ y PLY,
//  - y una escena sintética para probar todo el camino sin tener el Kinect.
//
// Unidades: milímetros en todos lados. En los mapas de profundidad, 0 = píxel sin dato.
// Marco de la cámara: X a la derecha, Y hacia abajo en la imagen, Z hacia adelante.
// Marco de trabajo («mundo»): origen en el eje de giro sobre la mesa, Y hacia arriba.

export const INTR = { ancho: 640, alto: 480, fx: 594.21, fy: 591.04, cx: 339.5, cy: 242.7 };

// ============================================================
// Del sensor a milímetros
// ============================================================

// El Kinect v1 manda 11 bits de disparidad por píxel; fórmula de Nicolas Burrus.
const TABLA_MM = new Float32Array(2048);
for (let raw = 0; raw < 2048; raw++) {
  let mm = 0;
  if (raw < 1092) {
    const z = 1000 / (raw * -0.0030711016 + 3.3309495161);
    if (z > 300 && z < 6000) mm = z;
  }
  TABLA_MM[raw] = mm;
}
export function crudoAmm(raw) { return TABLA_MM[raw & 0x7ff]; }
export function mmAcrudo(mm) {
  if (!(mm > 0)) return 2047;
  const raw = Math.round((3.3309495161 - 1000 / mm) / 0.0030711016);
  return Math.max(0, Math.min(2047, raw));
}

// 422400 bytes (640·480·11/8) → 307200 valores de 11 bits (big-endian en el flujo de bits).
export function desempaquetar11(bytes, salida) {
  const n = INTR.ancho * INTR.alto;
  salida = salida || new Uint16Array(n);
  let acum = 0, bits = 0, p = 0;
  for (let i = 0; i < n; i++) {
    while (bits < 11) { acum = ((acum << 8) | bytes[p++]) & 0x3ffff; bits += 8; }
    bits -= 11;
    salida[i] = (acum >>> bits) & 0x7ff;
  }
  return salida;
}

export function crudoAmapa(crudo) {
  const z = new Float32Array(crudo.length);
  for (let i = 0; i < crudo.length; i++) z[i] = TABLA_MM[crudo[i] & 0x7ff];
  return z;
}

// ============================================================
// Promedio de cuadros y filtros del mapa
// ============================================================

// Mediana píxel a píxel de varios cuadros (ignora los sin dato). Un píxel queda
// válido sólo si tuvo dato en al menos la mitad de los cuadros: así se van los
// parpadeos de los bordes, que son puro ruido.
export function medianaDeCuadros(cuadros) {
  const n = cuadros.length;
  if (n === 1) return Float32Array.from(cuadros[0]);
  const len = cuadros[0].length;
  const salida = new Float32Array(len);
  const tmp = new Float32Array(n);
  const minimo = Math.max(1, Math.ceil(n / 2));
  for (let i = 0; i < len; i++) {
    let c = 0;
    for (let k = 0; k < n; k++) { const v = cuadros[k][i]; if (v > 0) tmp[c++] = v; }
    if (c < minimo) continue;
    // ordenamiento por inserción (c es chico)
    for (let a = 1; a < c; a++) { const v = tmp[a]; let b = a - 1; while (b >= 0 && tmp[b] > v) { tmp[b + 1] = tmp[b]; b--; } tmp[b + 1] = v; }
    salida[i] = (c & 1) ? tmp[c >> 1] : 0.5 * (tmp[(c >> 1) - 1] + tmp[c >> 1]);
  }
  return salida;
}

function medianaLocal(z, W, H, x, y, r, incluirCentro) {
  const tmp = medianaLocal._tmp || (medianaLocal._tmp = new Float32Array(121));
  let c = 0;
  for (let dy = -r; dy <= r; dy++) {
    const yy = y + dy; if (yy < 0 || yy >= H) continue;
    for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx; if (xx < 0 || xx >= W) continue;
      if (!incluirCentro && dx === 0 && dy === 0) continue;
      const v = z[yy * W + xx]; if (v > 0) tmp[c++] = v;
    }
  }
  if (!c) return { valor: 0, cantidad: 0 };
  for (let a = 1; a < c; a++) { const v = tmp[a]; let b = a - 1; while (b >= 0 && tmp[b] > v) { tmp[b + 1] = tmp[b]; b--; } tmp[b + 1] = v; }
  return { valor: (c & 1) ? tmp[c >> 1] : 0.5 * (tmp[(c >> 1) - 1] + tmp[c >> 1]), cantidad: c };
}

// opciones: { mediana: 0|3|5, huecos: radio en px (0 = no rellenar), voladores: mm (0 = no) }
export function filtrarMapa(z, opciones = {}, W = INTR.ancho, H = INTR.alto) {
  let actual = z;
  const mediana = opciones.mediana | 0;
  if (mediana >= 3) {
    const r = mediana >> 1;
    const salida = new Float32Array(actual.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!(actual[i] > 0)) continue;
      salida[i] = medianaLocal(actual, W, H, x, y, r, true).valor;
    }
    actual = salida;
  }
  const voladores = +opciones.voladores || 0;
  if (voladores > 0) {
    const salida = Float32Array.from(actual);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const v = actual[i]; if (!(v > 0)) continue;
      let cerca = 0, total = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const u = actual[yy * W + xx]; if (!(u > 0)) continue;
        total++; if (Math.abs(u - v) < voladores) cerca++;
      }
      if (total >= 3 && cerca < 3) salida[i] = 0;
    }
    actual = salida;
  }
  const huecos = opciones.huecos | 0;
  if (huecos > 0) {
    for (let pasada = 0; pasada < huecos; pasada++) {
      const salida = Float32Array.from(actual);
      let cambios = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (actual[i] > 0) continue;
        const m = medianaLocal(actual, W, H, x, y, 1, false);
        if (m.cantidad >= 5) { salida[i] = m.valor; cambios++; }
      }
      actual = salida;
      if (!cambios) break;
    }
  }
  return actual;
}

// ============================================================
// Puntos, plano de la mesa y marco de trabajo
// ============================================================

// Nube de puntos en el marco de la cámara (mm). paso = submuestreo en píxeles.
export function puntosDeMapa(z, opciones = {}) {
  const intr = opciones.intr || INTR;
  const paso = opciones.paso || 1;
  const zmin = opciones.zmin || 0, zmax = opciones.zmax || 1e9;
  const reg = opciones.region || { x0: 0, y0: 0, x1: intr.ancho, y1: intr.alto };
  const salida = [];
  for (let v = reg.y0; v < reg.y1; v += paso) for (let u = reg.x0; u < reg.x1; u += paso) {
    const d = z[v * intr.ancho + u];
    if (!(d > 0) || d < zmin || d > zmax) continue;
    salida.push((u - intr.cx) * d / intr.fx, (v - intr.cy) * d / intr.fy, d);
  }
  return Float32Array.from(salida);
}

function autovectorMenor(cov) {
  // Jacobi para una matriz simétrica 3x3: devuelve el autovector del autovalor más chico
  const a = [cov[0], cov[1], cov[2], cov[3], cov[4], cov[5], cov[6], cov[7], cov[8]];
  const v = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  for (let it = 0; it < 30; it++) {
    let p = 0, q = 1, mayor = Math.abs(a[1]);
    if (Math.abs(a[2]) > mayor) { p = 0; q = 2; mayor = Math.abs(a[2]); }
    if (Math.abs(a[5]) > mayor) { p = 1; q = 2; mayor = Math.abs(a[5]); }
    if (mayor < 1e-12) break;
    const app = a[p * 3 + p], aqq = a[q * 3 + q], apq = a[p * 3 + q];
    const theta = (aqq - app) / (2 * apq);
    const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
    const c = 1 / Math.sqrt(t * t + 1), s = t * c;
    for (let k = 0; k < 3; k++) {
      const akp = a[k * 3 + p], akq = a[k * 3 + q];
      a[k * 3 + p] = c * akp - s * akq; a[k * 3 + q] = s * akp + c * akq;
    }
    for (let k = 0; k < 3; k++) {
      const apk = a[p * 3 + k], aqk = a[q * 3 + k];
      a[p * 3 + k] = c * apk - s * aqk; a[q * 3 + k] = s * apk + c * aqk;
    }
    for (let k = 0; k < 3; k++) {
      const vkp = v[k * 3 + p], vkq = v[k * 3 + q];
      v[k * 3 + p] = c * vkp - s * vkq; v[k * 3 + q] = s * vkp + c * vkq;
    }
  }
  let m = 0;
  if (a[4] < a[m * 3 + m]) m = 1;
  if (a[8] < a[m * 3 + m]) m = 2;
  return [v[m], v[3 + m], v[6 + m]];
}

// Plano n·p + d = 0 con n unitario y d > 0 (la cámara queda del lado positivo).
// Devuelve null si no hay puntos suficientes.
export function detectarPlano(pts, opciones = {}) {
  const n = pts.length / 3;
  if (n < 30) return null;
  const umbral = opciones.umbral || 8;
  const iter = opciones.iteraciones || 150;
  let semilla = opciones.semilla || 12345;
  const rnd = () => { semilla = (semilla * 1103515245 + 12345) & 0x7fffffff; return semilla / 0x7fffffff; };
  let mejor = null, mejorCant = 0;
  for (let it = 0; it < iter; it++) {
    const ia = (rnd() * n) | 0, ib = (rnd() * n) | 0, ic = (rnd() * n) | 0;
    if (ia === ib || ib === ic || ia === ic) continue;
    const ax = pts[ia * 3], ay = pts[ia * 3 + 1], az = pts[ia * 3 + 2];
    const ux = pts[ib * 3] - ax, uy = pts[ib * 3 + 1] - ay, uz = pts[ib * 3 + 2] - az;
    const vx = pts[ic * 3] - ax, vy = pts[ic * 3 + 1] - ay, vz = pts[ic * 3 + 2] - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz); if (len < 1e-6) continue;
    nx /= len; ny /= len; nz /= len;
    const d = -(nx * ax + ny * ay + nz * az);
    let cant = 0;
    for (let i = 0; i < n; i++) {
      if (Math.abs(nx * pts[i * 3] + ny * pts[i * 3 + 1] + nz * pts[i * 3 + 2] + d) < umbral) cant++;
    }
    if (cant > mejorCant) { mejorCant = cant; mejor = [nx, ny, nz, d]; }
  }
  if (!mejor || mejorCant < 30) return null;
  // refinamiento por mínimos cuadrados con los puntos cercanos (dos vueltas)
  let plano = mejor;
  for (let vuelta = 0; vuelta < 2; vuelta++) {
    let cx = 0, cy = 0, cz = 0, c = 0;
    const idx = [];
    for (let i = 0; i < n; i++) {
      if (Math.abs(plano[0] * pts[i * 3] + plano[1] * pts[i * 3 + 1] + plano[2] * pts[i * 3 + 2] + plano[3]) < umbral) {
        idx.push(i); cx += pts[i * 3]; cy += pts[i * 3 + 1]; cz += pts[i * 3 + 2]; c++;
      }
    }
    if (c < 3) break;
    cx /= c; cy /= c; cz /= c;
    const cov = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (const i of idx) {
      const x = pts[i * 3] - cx, y = pts[i * 3 + 1] - cy, z = pts[i * 3 + 2] - cz;
      cov[0] += x * x; cov[1] += x * y; cov[2] += x * z; cov[4] += y * y; cov[5] += y * z; cov[8] += z * z;
    }
    cov[3] = cov[1]; cov[6] = cov[2]; cov[7] = cov[5];
    const nrm = autovectorMenor(cov);
    const len = Math.hypot(nrm[0], nrm[1], nrm[2]); if (len < 1e-9) break;
    const d = -(nrm[0] * cx + nrm[1] * cy + nrm[2] * cz) / len;
    plano = [nrm[0] / len, nrm[1] / len, nrm[2] / len, d];
    mejorCant = c;
  }
  if (plano[3] < 0) plano = [-plano[0], -plano[1], -plano[2], -plano[3]];
  return { n: [plano[0], plano[1], plano[2]], d: plano[3], inliers: mejorCant, total: n };
}

function normalizar(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function cruz(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function punto(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

// Marco de trabajo a partir del plano de la mesa. El origen O va sobre la mesa,
// U (arriba) es la normal, Z apunta «hacia el fondo» y X a la derecha.
// centro: punto (marco cámara) que se proyecta sobre la mesa para ubicar el eje.
export function armarMarco(plano, centro, desplazamiento = [0, 0]) {
  const U = normalizar(plano.n);
  let hacia = [0, 0, 1];
  let Z = [hacia[0] - punto(hacia, U) * U[0], hacia[1] - punto(hacia, U) * U[1], hacia[2] - punto(hacia, U) * U[2]];
  if (Math.hypot(Z[0], Z[1], Z[2]) < 0.2) { // la cámara mira casi de frente a la mesa: usar el «arriba» de la imagen
    hacia = [0, -1, 0];
    Z = [hacia[0] - punto(hacia, U) * U[0], hacia[1] - punto(hacia, U) * U[1], hacia[2] - punto(hacia, U) * U[2]];
  }
  Z = normalizar(Z);
  const X = normalizar(cruz(U, Z));
  const dist = punto(U, centro) + plano.d;
  let O = [centro[0] - dist * U[0], centro[1] - dist * U[1], centro[2] - dist * U[2]];
  O = [O[0] + desplazamiento[0] * X[0] + desplazamiento[1] * Z[0],
       O[1] + desplazamiento[0] * X[1] + desplazamiento[1] * Z[1],
       O[2] + desplazamiento[0] * X[2] + desplazamiento[1] * Z[2]];
  return { O, X, U, Z, plano };
}

// Centroide (marco cámara) de lo que está sobre la mesa dentro del rango de distancia.
export function centroDeLaPieza(z, plano, opciones = {}) {
  const intr = opciones.intr || INTR;
  const corte = opciones.corte ?? 5;
  const paso = opciones.paso || 3;
  const zmin = opciones.zmin || 0, zmax = opciones.zmax || 1e9;
  const maxAltura = opciones.maxAltura || 600;
  let sx = 0, sy = 0, sz = 0, c = 0;
  for (let v = 0; v < intr.alto; v += paso) for (let u = 0; u < intr.ancho; u += paso) {
    const d = z[v * intr.ancho + u];
    if (!(d > 0) || d < zmin || d > zmax) continue;
    const px = (u - intr.cx) * d / intr.fx, py = (v - intr.cy) * d / intr.fy;
    const h = plano.n[0] * px + plano.n[1] * py + plano.n[2] * d + plano.d;
    if (h < corte || h > maxAltura) continue;
    sx += px; sy += py; sz += d; c++;
  }
  if (!c) return null;
  return { centro: [sx / c, sy / c, sz / c], cantidad: c };
}

// Marco automático: la mesa detectada + el eje de giro estimado a partir de lo que hay
// sobre la mesa. El centroide de lo visible cae en el frente de la pieza, así que el eje
// se corre hacia atrás la mitad del ancho visible (la pieza se supone más o menos redonda
// en planta). desplazamiento = [x, z] extra elegido por la persona, en mm.
export function marcoAutomatico(z, plano, opciones = {}) {
  const c = centroDeLaPieza(z, plano, opciones);
  if (!c) return null;
  const marco0 = armarMarco(plano, c.centro);
  const pts = aMarcoPieza(puntosDeMapa(z, { paso: opciones.paso || 3, zmin: opciones.zmin, zmax: opciones.zmax }), marco0, 0, 1);
  const corte = opciones.corte ?? 5, maxAltura = opciones.maxAltura || 600;
  const xs = [], zs = [];
  for (let i = 0; i < pts.length; i += 3) { const y = pts[i + 1]; if (y >= corte && y <= maxAltura) { xs.push(pts[i]); zs.push(pts[i + 2]); } }
  let auto = [0, 0];
  if (xs.length > 20) {
    xs.sort((a, b) => a - b); zs.sort((a, b) => a - b);
    const p = (arr, q) => arr[Math.min(arr.length - 1, Math.floor(q * arr.length))];
    // el eje va al medio del ancho visible y, en profundidad, al medio de lo que se ve
    // desde arriba (si la cámara mira algo inclinada, la cara de arriba se ve entera)
    const fondo = p(zs, 0.95) - p(zs, 0.05);
    auto = [(p(xs, 0.05) + p(xs, 0.95)) / 2, p(zs, 0.05) + fondo / 2];
  }
  const d = opciones.desplazamiento || [0, 0];
  return { marco: armarMarco(plano, c.centro, [auto[0] + d[0], auto[1] + d[1]]), auto, centro: c.centro, cantidad: c.cantidad };
}

// Pasa puntos del marco cámara al marco de trabajo y deshace el giro de la base
// (la pieza giró «angulo» grados; sus puntos se giran al revés para volver al marco de la pieza).
export function aMarcoPieza(pts, marco, anguloGrados = 0, sentido = 1) {
  const a = -sentido * anguloGrados * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const { O, X, U, Z } = marco;
  const salida = new Float32Array(pts.length);
  for (let i = 0; i < pts.length; i += 3) {
    const dx = pts[i] - O[0], dy = pts[i + 1] - O[1], dz = pts[i + 2] - O[2];
    const x = X[0] * dx + X[1] * dy + X[2] * dz;
    const y = U[0] * dx + U[1] * dy + U[2] * dz;
    const zz = Z[0] * dx + Z[1] * dy + Z[2] * dz;
    salida[i] = x * c + zz * s; salida[i + 1] = y; salida[i + 2] = -x * s + zz * c;
  }
  return salida;
}

// Clasifica cada píxel para la vista previa: 0 sin dato, 1 fuera, 2 mesa, 3 dentro de la caja.
// paso: 1 clasifica todos los píxeles; 2 sólo los de filas y columnas pares (el resto queda en 0).
export function clasificarPixeles(z, marco, caja, opciones = {}) {
  const intr = opciones.intr || INTR;
  const corte = opciones.corte ?? 5;
  const zmin = opciones.zmin || 0, zmax = opciones.zmax || 1e9;
  const paso = opciones.paso || 1;
  const { O, X, U, Z } = marco;
  const hx = caja.ancho / 2, hz = caja.profundo / 2, alto = caja.alto;
  const salida = new Uint8Array(z.length);
  for (let v = 0; v < intr.alto; v += paso) for (let u = 0; u < intr.ancho; u += paso) {
    const i = v * intr.ancho + u;
    const d = z[i]; if (!(d > 0)) continue;
    if (d < zmin || d > zmax) { salida[i] = 1; continue; }
    const px = (u - intr.cx) * d / intr.fx, py = (v - intr.cy) * d / intr.fy;
    const dx = px - O[0], dy = py - O[1], dz = d - O[2];
    const y = U[0] * dx + U[1] * dy + U[2] * dz;
    if (Math.abs(y) < corte) { salida[i] = 2; continue; }
    const x = X[0] * dx + X[1] * dy + X[2] * dz;
    const zz = Z[0] * dx + Z[1] * dy + Z[2] * dz;
    salida[i] = (y >= corte && y < alto && Math.abs(x) < hx && Math.abs(zz) < hz) ? 3 : 1;
  }
  return salida;
}

// Proyecta a píxeles las aristas de la caja de escaneo, el eje de giro y el círculo de la base.
export function proyectarCaja(marco, caja, opciones = {}) {
  const intr = opciones.intr || INTR;
  const { O, X, U, Z } = marco;
  const aCam = (x, y, z) => [O[0] + X[0] * x + U[0] * y + Z[0] * z, O[1] + X[1] * x + U[1] * y + Z[1] * z, O[2] + X[2] * x + U[2] * y + Z[2] * z];
  const proy = (p) => p[2] > 50 ? [intr.fx * p[0] / p[2] + intr.cx, intr.fy * p[1] / p[2] + intr.cy] : null;
  const hx = caja.ancho / 2, hz = caja.profundo / 2, h = caja.alto;
  const esquinas = [];
  for (const y of [0, h]) for (const [x, z] of [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]]) esquinas.push(proy(aCam(x, y, z)));
  const segs = [];
  const arista = (a, b) => { if (esquinas[a] && esquinas[b]) segs.push([esquinas[a], esquinas[b]]); };
  for (let i = 0; i < 4; i++) { arista(i, (i + 1) % 4); arista(4 + i, 4 + (i + 1) % 4); arista(i, 4 + i); }
  const eje = [proy(aCam(0, 0, 0)), proy(aCam(0, h, 0))];
  const circulo = [];
  const r = Math.min(hx, hz);
  for (let k = 0; k <= 48; k++) { const a = k / 48 * Math.PI * 2; const p = proy(aCam(r * Math.cos(a), 0, r * Math.sin(a))); if (p) circulo.push(p); }
  return { segmentos: segs, eje: eje[0] && eje[1] ? eje : null, circulo };
}

// ============================================================
// Volumen (TSDF) y campo de relieve
// ============================================================

export function crearVolumen(caja, voxel, corte = 0, maxNodos = 6e6) {
  let vx = voxel;
  let nx, ny, nz;
  for (;;) {
    nx = Math.round(caja.ancho / vx) + 1;
    ny = Math.round((caja.alto - corte) / vx) + 3;
    nz = Math.round(caja.profundo / vx) + 1;
    if (nx * ny * nz <= maxNodos) break;
    vx *= 1.25;
  }
  const n = nx * ny * nz;
  return {
    nx, ny, nz, voxel: vx, corte,
    origen: [-caja.ancho / 2, corte - 2 * vx, -caja.profundo / 2],
    tsdf: new Float32Array(n), peso: new Uint16Array(n),
    oculto: new Uint8Array(n),     // alguna toma lo vio tapado detrás de una superficie
    visto: new Uint8Array(n),      // cayó dentro de la imagen de alguna toma
    superficie: new Uint8Array(n), // en cuántas tomas el nodo cayó cerca de la superficie
    nodos: n
  };
}

// Integra una toma (mapa de profundidad en mm) hecha con la pieza girada «angulo» grados.
// Peso de cada píxel de un mapa de profundidad para la fusión ponderada (KinectFusion mejorado):
// las superficies vistas de frente y de cerca pesan más que las vistas de refilón o de lejos.
// Devuelve un Float32Array W×H con valores en [0, 1] (0 = sin dato).
export function pesosDeMapa(z, intr = INTR, zRef = 600) {
  const { ancho: W, alto: H, fx, fy, cx, cy } = intr;
  const w = new Float32Array(W * H);
  for (let v = 1; v < H - 1; v++) for (let u = 1; u < W - 1; u++) {
    const i = v * W + u;
    const d = z[i]; if (!(d > 0)) continue;
    const dl = z[i - 1], dr = z[i + 1], du = z[i - W], dd = z[i + W];
    if (!(dl > 0 && dr > 0 && du > 0 && dd > 0)) { w[i] = 0.3; continue; }
    // puntos 3D de los vecinos → normal por producto cruz
    const px = (u - cx) / fx, py = (v - cy) / fy;
    const ax = ((u + 1 - cx) / fx) * dr - ((u - 1 - cx) / fx) * dl, ay = py * (dr - dl), az = dr - dl;
    const bx = px * (dd - du), by = ((v + 1 - cy) / fy) * dd - ((v - 1 - cy) / fy) * du, bz = dd - du;
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const l = Math.hypot(nx, ny, nz); if (!(l > 0)) { w[i] = 0.3; continue; }
    nx /= l; ny /= l; nz /= l;
    // coseno entre la normal y el rayo de visión
    const rl = Math.hypot(px, py, 1);
    const cos = Math.abs((nx * px + ny * py + nz) / rl);
    const dist = Math.min(1, (zRef / d) * (zRef / d));
    w[i] = Math.max(0.05, Math.min(1, cos * cos * Math.max(0.15, dist)));
  }
  return w;
}

export function integrarToma(vol, z, marco, anguloGrados = 0, opciones = {}) {
  const intr = opciones.intr || INTR;
  const sentido = opciones.sentido ?? 1;
  const mu = opciones.mu || Math.max(2.5 * vol.voxel, 8);
  const huecosVacios = !!opciones.huecosVacios;
  const zmin = opciones.zmin || 0, zmax = opciones.zmax || 1e9;
  const a = sentido * anguloGrados * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const { O, X, U, Z } = marco;
  const { nx, ny, nz, voxel, origen, tsdf, peso, visto, oculto, superficie } = vol;
  const banda = opciones.banda || null; // Uint8Array opcional: marca los nodos cerca de la superficie de ESTA toma
  const W = intr.ancho, H = intr.alto;
  // fusión ponderada: peso por píxel (ángulo y distancia), en enteros ×16 dentro de peso[]
  const pesos = opciones.ponderar === false ? null : pesosDeMapa(z, intr);
  const PMAX = 30 * 16;
  let idx = 0;
  for (let k = 0; k < nz; k++) {
    const pz = origen[2] + k * voxel;
    for (let j = 0; j < ny; j++) {
      const py = origen[1] + j * voxel;
      for (let i = 0; i < nx; i++, idx++) {
        const px = origen[0] + i * voxel;
        const tx = px * c + pz * s, tz = -px * s + pz * c;
        const cz = O[2] + X[2] * tx + U[2] * py + Z[2] * tz;
        if (cz < 100) continue;
        const cx = O[0] + X[0] * tx + U[0] * py + Z[0] * tz;
        const cy = O[1] + X[1] * tx + U[1] * py + Z[1] * tz;
        const u = Math.round(intr.fx * cx / cz + intr.cx);
        const v = Math.round(intr.fy * cy / cz + intr.cy);
        if (u < 0 || v < 0 || u >= W || v >= H) continue;
        visto[idx] = 1;
        const d = z[v * W + u];
        let sdf;
        if (d > 0) {
          if (d > zmax) sdf = mu;      // el rayo pasó de largo hasta más allá del rango: vacío
          else if (d < zmin) continue; // algo demasiado cerca (una mano, el borde de la mesa): no se sabe
          else sdf = d - cz;
        } else if (huecosVacios) sdf = mu;
        else continue;                 // sin dato: no se sabe
        if (sdf < -mu) { oculto[idx] = 1; continue; } // detrás de la superficie vista
        if (sdf < mu) { if (superficie[idx] < 255) superficie[idx]++; if (banda) banda[idx] = 1; }
        const val = Math.min(sdf, mu) / mu;
        const w = peso[idx];
        const wf = pesos && d > 0 ? Math.max(1, Math.round(16 * pesos[v * W + u])) : 16;
        tsdf[idx] = (tsdf[idx] * w + val * wf) / (w + wf);
        peso[idx] = w + wf < PMAX ? w + wf : PMAX;
      }
    }
  }
}

// Campo escalar final: negativo adentro, positivo afuera.
// relleno: 'solido' (lo que quedó tapado detrás de las superficies vistas es macizo) o
// 'cascara' (sólo lo escaneado). Lo que ninguna toma vio ni tapado ni de frente es aire.
export function campoFinal(vol, opciones = {}) {
  const relleno = opciones.relleno || 'solido';
  const { nx, ny, nz, voxel, origen, tsdf, peso, oculto, corte } = vol;
  const F = new Float32Array(vol.nodos);
  const tapado = relleno === 'solido' ? -1 : 1;
  let idx = 0;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) {
    const y = origen[1] + j * voxel;
    for (let i = 0; i < nx; i++, idx++) {
      if (y < corte) F[idx] = 1;
      else if (peso[idx] > 0) F[idx] = tsdf[idx];
      else F[idx] = oculto[idx] ? tapado : 1;
    }
  }
  return F;
}

// Campo de relieve: mapa de alturas visto desde arriba (una sola toma o varias ya giradas).
// pts: puntos en el marco de la pieza. Todo lo que queda debajo de la superficie vista es macizo.
export function campoRelieve(vol, pts, opciones = {}) {
  const { nx, ny, nz, voxel, origen, corte } = vol;
  const mu = opciones.mu || Math.max(2 * voxel, 6);
  const alturas = new Float32Array(nx * nz).fill(-1e9);
  for (let i = 0; i < pts.length; i += 3) {
    const y = pts[i + 1]; if (y < corte) continue;
    const gi = Math.round((pts[i] - origen[0]) / voxel), gk = Math.round((pts[i + 2] - origen[2]) / voxel);
    if (gi < 0 || gk < 0 || gi >= nx || gk >= nz) continue;
    const a = gk * nx + gi;
    if (y > alturas[a]) alturas[a] = y;
  }
  // tapar celditas sin dato rodeadas de datos (huecos del sensor)
  const pasadas = opciones.pasadas ?? 3;
  for (let p = 0; p < pasadas; p++) {
    const copia = Float32Array.from(alturas);
    let cambios = 0;
    for (let k = 1; k < nz - 1; k++) for (let i = 1; i < nx - 1; i++) {
      const a = k * nx + i; if (alturas[a] > -1e8) continue;
      let suma = 0, c = 0;
      for (let dk = -1; dk <= 1; dk++) for (let di = -1; di <= 1; di++) {
        const v = alturas[(k + dk) * nx + i + di]; if (v > -1e8) { suma += v; c++; }
      }
      if (c >= 5) { copia[a] = suma / c; cambios++; }
    }
    alturas.set(copia);
    if (!cambios) break;
  }
  const F = new Float32Array(vol.nodos);
  let idx = 0;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) {
    const y = origen[1] + j * voxel;
    for (let i = 0; i < nx; i++, idx++) {
      const h = alturas[k * nx + i];
      if (y < corte || h < -1e8) { F[idx] = 1; continue; }
      F[idx] = Math.max(-1, Math.min(1, (y - h) / mu));
    }
  }
  return F;
}

// Ajuste automático del eje de giro y del sentido. Si el eje está corrido, las superficies
// de las distintas tomas no caen una sobre otra. El puntaje de un eje candidato es cuánto
// se solapan las nubes de puntos de las tomas, de a pares, una vez llevadas al marco de la
// pieza (puntos de una toma que caen en la misma celdita de 4 mm que algún punto de la otra).
// Sólo cuentan pares de tomas separados 60° o más: dos tomas vecinas ven casi lo mismo y
// no distinguen un corrimiento del eje hacia la cámara; las que miran de costado, sí.
// Se busca en una grilla de desplazamientos (x, z) alrededor del centro estimado, primero
// grueso y después fino.
// tomas: [{z, angulo}] (dos o más). Devuelve { desplazamiento:[dx,dz], sentido, puntaje } o null.
export function ajustarEje(tomas, plano, centro, opciones = {}, avisar = () => {}) {
  const corte = opciones.corte ?? 3;
  const radio = opciones.radio || 30;
  const base = opciones.desplazamiento || [0, 0];
  const sentidos = opciones.sentido === 1 || opciones.sentido === -1 ? [opciones.sentido] : [1, -1];
  const nT = tomas.length;
  const pares = [];
  for (let a = 0; a < nT; a++) for (let b = a + 1; b < nT; b++) {
    let sep = Math.abs(((tomas[a].angulo - tomas[b].angulo) % 360 + 360) % 360);
    if (sep > 180) sep = 360 - sep;
    if (sep >= 60) pares.push([a, b]);
  }
  if (!pares.length) return null; // hace falta al menos un par de tomas bien separadas
  // Puntos de cada toma sobre la mesa (la altura no depende del corrimiento del eje, así
  // que se filtran una sola vez), en el marco de trabajo sin girar.
  const marco0 = armarMarco(plano, centro, base);
  const minY = corte + 12, maxY = opciones.maxAltura || 600;
  const nubes = tomas.map(t => {
    const pts = aMarcoPieza(puntosDeMapa(t.z, { paso: opciones.paso || 2, zmin: opciones.zmin, zmax: opciones.zmax }), marco0, 0, 1);
    const sel = [];
    for (let i = 0; i < pts.length; i += 3) if (pts[i + 1] >= minY && pts[i + 1] <= maxY) sel.push(pts[i], pts[i + 1], pts[i + 2]);
    return Float32Array.from(sel);
  });
  const celda = opciones.celda || 4;
  const clave = (x, y, z) => ((Math.round(x / celda) + 512) * 1024 + (Math.round(y / celda) + 512)) * 1024 + (Math.round(z / celda) + 512);
  const evaluar = (dx, dz, sentido) => {
    // girar cada nube al marco de la pieza con el eje candidato (corrido dx, dz respecto de marco0)
    const giradas = nubes.map((pts, i) => {
      const a = -sentido * tomas[i].angulo * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      const g = new Float32Array(pts.length);
      for (let k = 0; k < pts.length; k += 3) {
        const x = pts[k] - dx, zz = pts[k + 2] - dz;
        g[k] = x * c + zz * s; g[k + 1] = pts[k + 1]; g[k + 2] = -x * s + zz * c;
      }
      return g;
    });
    const sets = giradas.map(g => { const st = new Set(); for (let k = 0; k < g.length; k += 3) st.add(clave(g[k], g[k + 1], g[k + 2])); return st; });
    let total = 0;
    for (const [a, b] of pares) {
      const ga = giradas[a], gb = giradas[b], sa = sets[a], sb = sets[b];
      for (let k = 0; k < ga.length; k += 3) if (sb.has(clave(ga[k], ga[k + 1], ga[k + 2]))) total++;
      for (let k = 0; k < gb.length; k += 3) if (sa.has(clave(gb[k], gb[k + 1], gb[k + 2]))) total++;
    }
    return total;
  };
  let mejor = { dx: 0, dz: 0, sentido: sentidos[0], puntaje: -1 };
  const pasoGrueso = opciones.pasoBusqueda || 5;
  let evaluadas = 0;
  const totalGrueso = sentidos.length * Math.pow(Math.floor(2 * radio / pasoGrueso) + 1, 2);
  for (const sentido of sentidos) {
    for (let dz = -radio; dz <= radio; dz += pasoGrueso) for (let dx = -radio; dx <= radio; dx += pasoGrueso) {
      const p = evaluar(dx, dz, sentido);
      evaluadas++;
      if (evaluadas % 25 === 0) avisar(`Buscando el eje de giro: ${evaluadas} de ${totalGrueso}`);
      if (p > mejor.puntaje) mejor = { dx, dz, sentido, puntaje: p };
    }
  }
  const pasoFino = Math.max(1, pasoGrueso / 4);
  const c = { ...mejor };
  for (let dz = c.dz - pasoGrueso; dz <= c.dz + pasoGrueso + 1e-6; dz += pasoFino) for (let dx = c.dx - pasoGrueso; dx <= c.dx + pasoGrueso + 1e-6; dx += pasoFino) {
    const p = evaluar(dx, dz, c.sentido);
    if (p > mejor.puntaje) mejor = { dx, dz, sentido: c.sentido, puntaje: p };
  }
  return {
    desplazamiento: [base[0] + mejor.dx, base[1] + mejor.dz], sentido: mejor.sentido, puntaje: mejor.puntaje,
    ajuste: [mejor.dx, mejor.dz],
    enElBorde: Math.abs(mejor.dx) >= radio - pasoFino || Math.abs(mejor.dz) >= radio - pasoFino
  };
}

// ============================================================
// Malla: surface nets
// ============================================================

const ESQUINAS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const ARISTAS = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];

export function extraerMalla(F, vol) {
  const { nx, ny, nz, voxel, origen } = vol;
  const cnx = nx - 1, cny = ny - 1, cnz = nz - 1;
  const celdaVert = new Int32Array(cnx * cny * cnz).fill(-1);
  const pos = [];
  const idx = [];
  const desp = ESQUINAS.map(e => e[0] + e[1] * nx + e[2] * nx * ny);
  const g = new Float32Array(8);
  const R = [1, cnx, cnx * cny]; // pasos en el arreglo de celdas
  for (let k = 0; k < cnz; k++) for (let j = 0; j < cny; j++) for (let i = 0; i < cnx; i++) {
    const base = i + j * nx + k * nx * ny;
    let mask = 0;
    for (let c = 0; c < 8; c++) { g[c] = F[base + desp[c]]; if (g[c] < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, cant = 0;
    for (let e = 0; e < 12; e++) {
      const a = ARISTAS[e][0], b = ARISTAS[e][1];
      if (((mask >> a) & 1) === ((mask >> b) & 1)) continue;
      const ga = g[a], gb = g[b];
      const t = ga / (ga - gb);
      const ea = ESQUINAS[a], eb = ESQUINAS[b];
      sx += ea[0] + t * (eb[0] - ea[0]); sy += ea[1] + t * (eb[1] - ea[1]); sz += ea[2] + t * (eb[2] - ea[2]);
      cant++;
    }
    const celda = i + j * cnx + k * cnx * cny;
    celdaVert[celda] = pos.length / 3;
    pos.push(origen[0] + (i + sx / cant) * voxel, origen[1] + (j + sy / cant) * voxel, origen[2] + (k + sz / cant) * voxel);
    const coord = [i, j, k];
    for (let d = 0; d < 3; d++) {
      const iu = (d + 1) % 3, iv = (d + 2) % 3;
      if (coord[iu] === 0 || coord[iv] === 0) continue;
      if (((mask >> 0) & 1) === ((mask >> (1 << d)) & 1)) continue;
      const du = R[iu], dv = R[iv];
      const v0 = celdaVert[celda], v1 = celdaVert[celda - du], v2 = celdaVert[celda - du - dv], v3 = celdaVert[celda - dv];
      if (v1 < 0 || v2 < 0 || v3 < 0) continue;
      if (mask & 1) idx.push(v0, v1, v2, v0, v2, v3);
      else idx.push(v0, v3, v2, v0, v2, v1);
    }
  }
  const malla = { pos: Float32Array.from(pos), idx: Uint32Array.from(idx) };
  if (volumenMalla(malla) < 0) invertirCaras(malla);
  return malla;
}

export function volumenMalla(m) {
  const { pos, idx } = m;
  let vol = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ax = pos[a], ay = pos[a + 1], az = pos[a + 2];
    const bx = pos[b], by = pos[b + 1], bz = pos[b + 2];
    const cx = pos[c], cy = pos[c + 1], cz = pos[c + 2];
    vol += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
  }
  return vol / 6;
}

function invertirCaras(m) {
  const idx = m.idx;
  for (let t = 0; t < idx.length; t += 3) { const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp; }
}

// ============================================================
// Purgado de la malla
// ============================================================

function compactar(pos, idx) {
  const mapa = new Int32Array(pos.length / 3).fill(-1);
  const nuevaPos = [];
  const nuevoIdx = new Uint32Array(idx.length);
  for (let t = 0; t < idx.length; t++) {
    const v = idx[t];
    if (mapa[v] < 0) { mapa[v] = nuevaPos.length / 3; nuevaPos.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); }
    nuevoIdx[t] = mapa[v];
  }
  return { pos: Float32Array.from(nuevaPos), idx: nuevoIdx };
}

// Se queda con la pieza conectada más grande (por cantidad de triángulos).
export function mayorComponente(m) {
  const { pos, idx } = m;
  const nV = pos.length / 3;
  const padre = new Int32Array(nV);
  for (let i = 0; i < nV; i++) padre[i] = i;
  const raiz = (a) => { while (padre[a] !== a) { padre[a] = padre[padre[a]]; a = padre[a]; } return a; };
  for (let t = 0; t < idx.length; t += 3) {
    const a = raiz(idx[t]), b = raiz(idx[t + 1]), c = raiz(idx[t + 2]);
    if (a !== b) padre[b] = a;
    if (raiz(c) !== raiz(a)) padre[raiz(c)] = raiz(a);
  }
  const cuenta = new Map();
  for (let t = 0; t < idx.length; t += 3) { const r = raiz(idx[t]); cuenta.set(r, (cuenta.get(r) || 0) + 1); }
  let mejor = -1, mejorC = 0;
  for (const [r, c] of cuenta) if (c > mejorC) { mejorC = c; mejor = r; }
  const quedan = [];
  for (let t = 0; t < idx.length; t += 3) if (raiz(idx[t]) === mejor) quedan.push(idx[t], idx[t + 1], idx[t + 2]);
  const res = compactar(pos, Uint32Array.from(quedan));
  res.componentes = cuenta.size;
  return res;
}

function adyacencia(nV, idx) {
  const grado = new Uint32Array(nV + 1);
  for (let t = 0; t < idx.length; t += 3) {
    grado[idx[t]] += 2; grado[idx[t + 1]] += 2; grado[idx[t + 2]] += 2;
  }
  const inicio = new Uint32Array(nV + 1);
  for (let i = 0; i < nV; i++) inicio[i + 1] = inicio[i] + grado[i];
  const vecinos = new Uint32Array(inicio[nV]);
  const relleno = new Uint32Array(nV);
  const meter = (a, b) => { vecinos[inicio[a] + relleno[a]++] = b; };
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    meter(a, b); meter(a, c); meter(b, a); meter(b, c); meter(c, a); meter(c, b);
  }
  return { inicio, vecinos };
}

// Suavizado de Taubin (no encoge la pieza como el laplaciano puro).
export function suavizar(m, iteraciones = 5, lambda = 0.5, mu = -0.53) {
  if (!iteraciones) return m;
  const nV = m.pos.length / 3;
  const { inicio, vecinos } = adyacencia(nV, m.idx);
  let pos = Float32Array.from(m.pos);
  const tmp = new Float32Array(pos.length);
  const paso = (factor) => {
    for (let v = 0; v < nV; v++) {
      const a = inicio[v], b = inicio[v + 1];
      if (b === a) { tmp[v * 3] = pos[v * 3]; tmp[v * 3 + 1] = pos[v * 3 + 1]; tmp[v * 3 + 2] = pos[v * 3 + 2]; continue; }
      let sx = 0, sy = 0, sz = 0;
      for (let k = a; k < b; k++) { const w = vecinos[k] * 3; sx += pos[w]; sy += pos[w + 1]; sz += pos[w + 2]; }
      const n = b - a;
      tmp[v * 3] = pos[v * 3] + factor * (sx / n - pos[v * 3]);
      tmp[v * 3 + 1] = pos[v * 3 + 1] + factor * (sy / n - pos[v * 3 + 1]);
      tmp[v * 3 + 2] = pos[v * 3 + 2] + factor * (sz / n - pos[v * 3 + 2]);
    }
    pos.set(tmp);
  };
  for (let it = 0; it < iteraciones; it++) { paso(lambda); paso(mu); }
  return { pos, idx: m.idx };
}

// Reducción de triángulos por agrupamiento de vértices en una grilla de «celda» mm.
export function reducir(m, celda) {
  if (!(celda > 0)) return m;
  const { pos, idx } = m;
  const nV = pos.length / 3;
  const grupo = new Int32Array(nV);
  const claves = new Map();
  const suma = [];
  for (let v = 0; v < nV; v++) {
    const cx = Math.floor(pos[v * 3] / celda), cy = Math.floor(pos[v * 3 + 1] / celda), cz = Math.floor(pos[v * 3 + 2] / celda);
    const clave = cx + ',' + cy + ',' + cz;
    let g = claves.get(clave);
    if (g === undefined) { g = suma.length; claves.set(clave, g); suma.push([0, 0, 0, 0]); }
    grupo[v] = g;
    const s = suma[g]; s[0] += pos[v * 3]; s[1] += pos[v * 3 + 1]; s[2] += pos[v * 3 + 2]; s[3]++;
  }
  const nuevaPos = new Float32Array(suma.length * 3);
  suma.forEach((s, g) => { nuevaPos[g * 3] = s[0] / s[3]; nuevaPos[g * 3 + 1] = s[1] / s[3]; nuevaPos[g * 3 + 2] = s[2] / s[3]; });
  const nuevoIdx = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = grupo[idx[t]], b = grupo[idx[t + 1]], c = grupo[idx[t + 2]];
    if (a === b || b === c || a === c) continue;
    nuevoIdx.push(a, b, c);
  }
  return compactar(nuevaPos, Uint32Array.from(nuevoIdx));
}

// Suavizado bilateral de normales (Zheng et al. 2011): conserva aristas y rasgos finos (nariz, labios,
// bordes de una pieza) mientras baja el ruido. Filtra las normales de las caras con pesos por distancia
// y por parecido de normales, y después mueve los vértices hacia los planos de sus caras.
export function suavizarBilateral(m, iteraciones = 3, sigmaNormal = 0.35) {
  if (!iteraciones) return m;
  const idx = m.idx; const nT = idx.length / 3; const nV = m.pos.length / 3;
  let pos = Float32Array.from(m.pos);
  // caras por vértice
  const gradoV = new Uint32Array(nV + 1);
  for (let t = 0; t < idx.length; t++) gradoV[idx[t]]++;
  const iniV = new Uint32Array(nV + 1);
  for (let v = 0; v < nV; v++) iniV[v + 1] = iniV[v] + gradoV[v];
  const carasV = new Uint32Array(iniV[nV]); const rel = new Uint32Array(nV);
  for (let t = 0; t < nT; t++) for (let e = 0; e < 3; e++) { const v = idx[t * 3 + e]; carasV[iniV[v] + rel[v]++] = t; }
  const nrm = new Float32Array(nT * 3), cen = new Float32Array(nT * 3), area = new Float32Array(nT), nrm2 = new Float32Array(nT * 3);
  const calcular = () => {
    let sumaArista = 0;
    for (let t = 0; t < nT; t++) {
      const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz); area[t] = l / 2;
      if (l > 0) { nx /= l; ny /= l; nz /= l; }
      nrm[t * 3] = nx; nrm[t * 3 + 1] = ny; nrm[t * 3 + 2] = nz;
      cen[t * 3] = (pos[a] + pos[b] + pos[c]) / 3; cen[t * 3 + 1] = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3; cen[t * 3 + 2] = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3;
      sumaArista += Math.hypot(ux, uy, uz);
    }
    return sumaArista / Math.max(1, nT);
  };
  const invSn2 = 1 / (2 * sigmaNormal * sigmaNormal);
  for (let it = 0; it < iteraciones; it++) {
    const arista = calcular();
    const invSs2 = 1 / (2 * arista * arista);
    // 1) normales filtradas: vecinas = caras que comparten un vértice
    for (let t = 0; t < nT; t++) {
      let sx = 0, sy = 0, sz = 0;
      const nx = nrm[t * 3], ny = nrm[t * 3 + 1], nz = nrm[t * 3 + 2];
      for (let e = 0; e < 3; e++) {
        const v = idx[t * 3 + e];
        for (let q = iniV[v]; q < iniV[v + 1]; q++) {
          const g = carasV[q];
          const dx = cen[g * 3] - cen[t * 3], dy = cen[g * 3 + 1] - cen[t * 3 + 1], dz = cen[g * 3 + 2] - cen[t * 3 + 2];
          const dn = 1 - (nx * nrm[g * 3] + ny * nrm[g * 3 + 1] + nz * nrm[g * 3 + 2]);
          const w = area[g] * Math.exp(-(dx * dx + dy * dy + dz * dz) * invSs2) * Math.exp(-dn * dn * invSn2);
          sx += w * nrm[g * 3]; sy += w * nrm[g * 3 + 1]; sz += w * nrm[g * 3 + 2];
        }
      }
      const l = Math.hypot(sx, sy, sz) || 1;
      nrm2[t * 3] = sx / l; nrm2[t * 3 + 1] = sy / l; nrm2[t * 3 + 2] = sz / l;
    }
    // 2) vértices hacia los planos de sus caras (varias pasadas chicas)
    const nuevo = Float32Array.from(pos);
    for (let pasada = 0; pasada < 3; pasada++) {
      for (let v = 0; v < nV; v++) {
        const a = iniV[v], b = iniV[v + 1]; if (b === a) continue;
        let dx = 0, dy = 0, dz = 0;
        const x = nuevo[v * 3], y = nuevo[v * 3 + 1], zz = nuevo[v * 3 + 2];
        for (let q = a; q < b; q++) {
          const t = carasV[q];
          const nx = nrm2[t * 3], ny = nrm2[t * 3 + 1], nz = nrm2[t * 3 + 2];
          const d = nx * (cen[t * 3] - x) + ny * (cen[t * 3 + 1] - y) + nz * (cen[t * 3 + 2] - zz);
          dx += nx * d; dy += ny * d; dz += nz * d;
        }
        const n = b - a;
        nuevo[v * 3] = x + dx / n; nuevo[v * 3 + 1] = y + dy / n; nuevo[v * 3 + 2] = zz + dz / n;
      }
    }
    pos = nuevo;
  }
  return { pos, idx: m.idx };
}

// Reducción de triángulos por colapso de aristas con métrica de error cuadrático (Garland-Heckbert),
// con conservación del borde y rechazo de vueltas de cara. objetivo: cantidad de triángulos final.
export function reducirQEM(m, objetivo) {
  const idx0 = m.idx; const nT0 = idx0.length / 3; const nV = m.pos.length / 3;
  if (!(objetivo > 0) || nT0 <= objetivo) return m;
  const pos = Float32Array.from(m.pos);
  const Q = new Float64Array(nV * 10); // cuádrica simétrica 4×4: 10 coeficientes
  const tris = []; for (let t = 0; t < nT0; t++) tris.push([idx0[t * 3], idx0[t * 3 + 1], idx0[t * 3 + 2]]);
  const vivo = new Uint8Array(nT0).fill(1);
  const carasV = Array.from({ length: nV }, () => []);
  tris.forEach((tr, t) => { for (const v of tr) carasV[v].push(t); });
  const sumarPlano = (v, a, b, c, d, peso = 1) => {
    const o = v * 10;
    Q[o] += a * a * peso; Q[o + 1] += a * b * peso; Q[o + 2] += a * c * peso; Q[o + 3] += a * d * peso;
    Q[o + 4] += b * b * peso; Q[o + 5] += b * c * peso; Q[o + 6] += b * d * peso;
    Q[o + 7] += c * c * peso; Q[o + 8] += c * d * peso; Q[o + 9] += d * d * peso;
  };
  const planoDe = (t) => {
    const [a, b, c] = tris[t];
    const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
    const ux = pos[b * 3] - ax, uy = pos[b * 3 + 1] - ay, uz = pos[b * 3 + 2] - az;
    const vx = pos[c * 3] - ax, vy = pos[c * 3 + 1] - ay, vz = pos[c * 3 + 2] - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz); if (!(l > 0)) return null;
    nx /= l; ny /= l; nz /= l;
    return [nx, ny, nz, -(nx * ax + ny * ay + nz * az), l / 2];
  };
  // aristas y su cantidad de caras (para detectar el borde)
  const claveA = (a, b) => a < b ? a * 4294967296 + b : b * 4294967296 + a;
  const cuentaA = new Map();
  for (let t = 0; t < nT0; t++) { const tr = tris[t]; for (let e = 0; e < 3; e++) { const k = claveA(tr[e], tr[(e + 1) % 3]); cuentaA.set(k, (cuentaA.get(k) || 0) + 1); } }
  for (let t = 0; t < nT0; t++) {
    const p = planoDe(t); if (!p) continue;
    const tr = tris[t];
    for (const v of tr) sumarPlano(v, p[0], p[1], p[2], p[3], p[4]);
    // borde: plano perpendicular a la cara que pasa por la arista, con peso alto (no mover el contorno)
    for (let e = 0; e < 3; e++) {
      const a = tr[e], b = tr[(e + 1) % 3];
      if (cuentaA.get(claveA(a, b)) !== 1) continue;
      const ex = pos[b * 3] - pos[a * 3], ey = pos[b * 3 + 1] - pos[a * 3 + 1], ez = pos[b * 3 + 2] - pos[a * 3 + 2];
      let nx = ey * p[2] - ez * p[1], ny = ez * p[0] - ex * p[2], nz = ex * p[1] - ey * p[0];
      const l = Math.hypot(nx, ny, nz); if (!(l > 0)) continue;
      nx /= l; ny /= l; nz /= l;
      const d = -(nx * pos[a * 3] + ny * pos[a * 3 + 1] + nz * pos[a * 3 + 2]);
      sumarPlano(a, nx, ny, nz, d, 1000 * p[4]); sumarPlano(b, nx, ny, nz, d, 1000 * p[4]);
    }
  }
  const errorEn = (v, x, y, z) => {
    const o = v * 10;
    return Q[o] * x * x + 2 * Q[o + 1] * x * y + 2 * Q[o + 2] * x * z + 2 * Q[o + 3] * x + Q[o + 4] * y * y + 2 * Q[o + 5] * y * z + 2 * Q[o + 6] * y + Q[o + 7] * z * z + 2 * Q[o + 8] * z + Q[o + 9];
  };
  const errorPar = (a, b, x, y, z) => errorEn(a, x, y, z) + errorEn(b, x, y, z);
  // mejor punto para el colapso: el punto medio o uno de los extremos (evita resolver la 3×3: más robusto)
  const mejorPunto = (a, b) => {
    const cand = [[(pos[a * 3] + pos[b * 3]) / 2, (pos[a * 3 + 1] + pos[b * 3 + 1]) / 2, (pos[a * 3 + 2] + pos[b * 3 + 2]) / 2], [pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]], [pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]]];
    let mejor = null, me = Infinity;
    for (const c of cand) { const e = errorPar(a, b, c[0], c[1], c[2]); if (e < me) { me = e; mejor = c; } }
    return { p: mejor, e: me };
  };
  // cola de prioridad (montículo binario) de aristas con marca de versión para invalidar entradas viejas
  const version = new Uint32Array(nV);
  const heap = [];
  const subir = (i) => { const x = heap[i]; while (i > 0) { const p = (i - 1) >> 1; if (heap[p].e <= x.e) break; heap[i] = heap[p]; i = p; } heap[i] = x; };
  const bajar = (i) => { const n = heap.length, x = heap[i]; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && heap[c + 1].e < heap[c].e) c++; if (heap[c].e >= x.e) break; heap[i] = heap[c]; i = c; } heap[i] = x; };
  const meter = (a, b) => { if (a === b) return; const { p, e } = mejorPunto(a, b); heap.push({ a, b, p, e, va: version[a], vb: version[b] }); subir(heap.length - 1); };
  for (const k of cuentaA.keys()) { const a = Math.floor(k / 4294967296), b = k % 4294967296; meter(a, b); }
  let nT = nT0;
  const padre = new Int32Array(nV); for (let v = 0; v < nV; v++) padre[v] = v;
  const raiz = (v) => { while (padre[v] !== v) { padre[v] = padre[padre[v]]; v = padre[v]; } return v; };
  while (nT > objetivo && heap.length) {
    const top = heap[0]; const ult = heap.pop(); if (heap.length) { heap[0] = ult; bajar(0); }
    let { a, b, p, va, vb } = top;
    if (version[a] !== va || version[b] !== vb) continue;
    a = raiz(a); b = raiz(b); if (a === b) continue;
    // validez: sin vuelta de cara en las caras que sobreviven
    let valido = true;
    const afectadas = new Set([...carasV[a], ...carasV[b]].filter(t => vivo[t]));
    for (const t of afectadas) {
      const tr = tris[t].map(raiz);
      const tieneA = tr.includes(a), tieneB = tr.includes(b);
      if (tieneA && tieneB) continue; // desaparece
      const antes = planoDe(t); if (!antes) continue;
      const orig = [pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2], pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]];
      pos[a * 3] = p[0]; pos[a * 3 + 1] = p[1]; pos[a * 3 + 2] = p[2]; pos[b * 3] = p[0]; pos[b * 3 + 1] = p[1]; pos[b * 3 + 2] = p[2];
      const despues = planoDe(t);
      pos[a * 3] = orig[0]; pos[a * 3 + 1] = orig[1]; pos[a * 3 + 2] = orig[2]; pos[b * 3] = orig[3]; pos[b * 3 + 1] = orig[4]; pos[b * 3 + 2] = orig[5];
      if (!despues || antes[0] * despues[0] + antes[1] * despues[1] + antes[2] * despues[2] < 0.2) { valido = false; break; }
    }
    if (!valido) continue;
    // colapsar b en a
    pos[a * 3] = p[0]; pos[a * 3 + 1] = p[1]; pos[a * 3 + 2] = p[2];
    for (let k = 0; k < 10; k++) Q[a * 10 + k] += Q[b * 10 + k];
    padre[b] = a;
    for (const t of carasV[b]) if (vivo[t]) { if (!carasV[a].includes(t)) carasV[a].push(t); }
    for (const t of afectadas) {
      const tr = tris[t].map(raiz);
      if (tr[0] === tr[1] || tr[1] === tr[2] || tr[0] === tr[2]) { if (vivo[t]) { vivo[t] = 0; nT--; } }
      else tris[t] = tr;
    }
    carasV[a] = carasV[a].filter(t => vivo[t]);
    carasV[b] = [];
    version[a]++; version[b]++;
    const vecinos = new Set();
    for (const t of carasV[a]) for (const v of tris[t]) if (v !== a) vecinos.add(v);
    for (const v of vecinos) meter(a, v);
  }
  const nuevoIdx = [];
  for (let t = 0; t < nT0; t++) if (vivo[t]) { const tr = tris[t].map(raiz); if (tr[0] !== tr[1] && tr[1] !== tr[2] && tr[0] !== tr[2]) nuevoIdx.push(tr[0], tr[1], tr[2]); }
  return compactar(pos, Uint32Array.from(nuevoIdx));
}

// Lazos del borde (aristas con una sola cara), como listas de vértices en orden.
export function lazosDelBorde(m) {
  const { idx } = m;
  const cuenta = new Map(), dirigida = new Map();
  for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = idx[t + e], b = idx[t + (e + 1) % 3];
    const k = a < b ? a * 4294967296 + b : b * 4294967296 + a;
    cuenta.set(k, (cuenta.get(k) || 0) + 1); dirigida.set(k, [a, b]);
  }
  const siguiente = new Map();
  for (const [k, c] of cuenta) if (c === 1) { const [a, b] = dirigida.get(k); siguiente.set(b, a); } // el borde se recorre al revés de la cara
  const lazos = []; const usado = new Set();
  for (const ini of siguiente.keys()) {
    if (usado.has(ini)) continue;
    const lazo = []; let v = ini;
    while (v !== undefined && !usado.has(v)) { usado.add(v); lazo.push(v); v = siguiente.get(v); }
    if (lazo.length >= 3 && v === ini) lazos.push(lazo);
  }
  return lazos;
}

// Rellena los agujeros con hasta «maxAristas» aristas: un vértice nuevo en el centro y un abanico de triángulos.
export function rellenarAgujeros(m, maxAristas = 40) {
  const lazos = lazosDelBorde(m).filter(l => l.length <= maxAristas);
  if (!lazos.length) return { malla: m, rellenados: 0 };
  const pos = Array.from(m.pos), idx = Array.from(m.idx);
  for (const lazo of lazos) {
    let cx = 0, cy = 0, cz = 0;
    for (const v of lazo) { cx += pos[v * 3]; cy += pos[v * 3 + 1]; cz += pos[v * 3 + 2]; }
    const c = pos.length / 3; pos.push(cx / lazo.length, cy / lazo.length, cz / lazo.length);
    for (let i = 0; i < lazo.length; i++) idx.push(lazo[i], lazo[(i + 1) % lazo.length], c);
  }
  return { malla: { pos: Float32Array.from(pos), idx: Uint32Array.from(idx) }, rellenados: lazos.length };
}

// Área de la malla en mm².
export function areaMalla(m) {
  const { pos, idx } = m; let a = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const i = idx[t] * 3, j = idx[t + 1] * 3, k = idx[t + 2] * 3;
    const ux = pos[j] - pos[i], uy = pos[j + 1] - pos[i + 1], uz = pos[j + 2] - pos[i + 2];
    const vx = pos[k] - pos[i], vy = pos[k + 1] - pos[i + 1], vz = pos[k + 2] - pos[i + 2];
    a += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
  }
  return a;
}

// Corte de la malla con un plano (punto p y normal n): lazos de puntos en orden. Devuelve
// { lazos: [[[x,y,z],...]], perimetros: [mm], mayor: índice del lazo más largo }.
export function cortarConPlano(m, p, n) {
  const { pos, idx } = m;
  const l = Math.hypot(n[0], n[1], n[2]) || 1; const nx = n[0] / l, ny = n[1] / l, nz = n[2] / l;
  const d0 = nx * p[0] + ny * p[1] + nz * p[2];
  const dist = (v) => nx * pos[v * 3] + ny * pos[v * 3 + 1] + nz * pos[v * 3 + 2] - d0;
  const corte = (a, b) => { const da = dist(a), db = dist(b), t = da / (da - db); return [pos[a * 3] + t * (pos[b * 3] - pos[a * 3]), pos[a * 3 + 1] + t * (pos[b * 3 + 1] - pos[a * 3 + 1]), pos[a * 3 + 2] + t * (pos[b * 3 + 2] - pos[a * 3 + 2])]; };
  const claveA = (a, b) => a < b ? a * 4294967296 + b : b * 4294967296 + a;
  const segs = []; // [claveArista1, claveArista2, punto1, punto2]
  for (let t = 0; t < idx.length; t += 3) {
    const v = [idx[t], idx[t + 1], idx[t + 2]]; const s = v.map(dist);
    const cruces = [];
    for (let e = 0; e < 3; e++) { const a = v[e], b = v[(e + 1) % 3]; if ((s[e] < 0) !== (s[(e + 1) % 3] < 0)) cruces.push([claveA(a, b), corte(a, b)]); }
    if (cruces.length === 2) segs.push(cruces);
  }
  // encadenar por arista compartida
  const porArista = new Map();
  segs.forEach((sg, i) => { for (const [k] of sg) { if (!porArista.has(k)) porArista.set(k, []); porArista.get(k).push(i); } });
  const usado = new Uint8Array(segs.length); const lazos = [];
  for (let i = 0; i < segs.length; i++) {
    if (usado[i]) continue;
    const lazo = [segs[i][0][1]]; let actual = i, kSig = segs[i][1][0]; usado[i] = 1; lazo.push(segs[i][1][1]);
    for (;;) {
      const vec = (porArista.get(kSig) || []).find(j => !usado[j]); if (vec === undefined) break;
      usado[vec] = 1; const sg = segs[vec];
      const otro = sg[0][0] === kSig ? sg[1] : sg[0];
      lazo.push(otro[1]); kSig = otro[0]; actual = vec;
    }
    lazos.push(lazo);
  }
  const perimetros = lazos.map(lz => { let per = 0; for (let i = 0; i < lz.length; i++) { const a = lz[i], b = lz[(i + 1) % lz.length]; per += Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); } return per; });
  let mayor = -1, pm = -1; perimetros.forEach((pp, i) => { if (pp > pm) { pm = pp; mayor = i; } });
  return { lazos, perimetros, mayor };
}

// Círculo por tres puntos (radio, centro y normal del plano): para medir agujeros y curvaturas.
export function circuloPorTresPuntos(a, b, c) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = cruz(ab, ac); const nn = punto(n, n); if (nn < 1e-12) return null;
  const ab2 = punto(ab, ab), ac2 = punto(ac, ac);
  const t1 = cruz(n, ab), t2 = cruz(ac, n);
  const k = 1 / (2 * nn);
  const cx = a[0] + (t2[0] * ab2 + t1[0] * ac2) * k, cy = a[1] + (t2[1] * ab2 + t1[1] * ac2) * k, cz = a[2] + (t2[2] * ab2 + t1[2] * ac2) * k;
  const radio = Math.hypot(cx - a[0], cy - a[1], cz - a[2]);
  return { centro: [cx, cy, cz], radio, normal: normalizar(n) };
}

// Ajuste de plano por mínimos cuadrados a puntos de la malla dentro de un radio de un punto (para medir
// planitud y espesores): devuelve { punto, normal, rms }.
export function planoLocal(m, centro, radio) {
  const { pos } = m; const r2 = radio * radio; let n = 0, mx = 0, my = 0, mz = 0; const sel = [];
  for (let v = 0; v < pos.length; v += 3) { const dx = pos[v] - centro[0], dy = pos[v + 1] - centro[1], dz = pos[v + 2] - centro[2]; if (dx * dx + dy * dy + dz * dz <= r2) { sel.push(v); mx += pos[v]; my += pos[v + 1]; mz += pos[v + 2]; n++; } }
  if (n < 6) return null;
  mx /= n; my /= n; mz /= n;
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
  for (const v of sel) { const x = pos[v] - mx, y = pos[v + 1] - my, z = pos[v + 2] - mz; xx += x * x; xy += x * y; xz += x * z; yy += y * y; yz += y * z; zz += z * z; }
  const normal = autovectorMenor([xx, xy, xz, xy, yy, yz, xz, yz, zz]);
  let rms = 0; for (const v of sel) { const d = normal[0] * (pos[v] - mx) + normal[1] * (pos[v + 1] - my) + normal[2] * (pos[v + 2] - mz); rms += d * d; }
  return { punto: [mx, my, mz], normal, rms: Math.sqrt(rms / n), puntos: n };
}

// ============================================================
// Bustos y placas de cara
// ============================================================

// Triangulación por recorte de orejas de un polígono simple 2D (puede ser cóncavo). Devuelve índices.
export function triangularPoligono(pts) {
  const n = pts.length; if (n < 3) return [];
  let area = 0; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const orden = []; for (let i = 0; i < n; i++) orden.push(area >= 0 ? i : n - 1 - i);
  const tris = [];
  const cruz2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const dentro = (p, a, b, c) => cruz2(a, b, p) >= -1e-9 && cruz2(b, c, p) >= -1e-9 && cruz2(c, a, p) >= -1e-9;
  let guardia = 0;
  while (orden.length > 3 && guardia < 20000) {
    guardia++;
    let cortado = false;
    for (let i = 0; i < orden.length; i++) {
      const ia = orden[(i + orden.length - 1) % orden.length], ib = orden[i], ic = orden[(i + 1) % orden.length];
      const a = pts[ia], b = pts[ib], c = pts[ic];
      if (cruz2(a, b, c) <= 1e-9) continue; // reflejo
      let ok = true;
      for (const j of orden) { if (j === ia || j === ib || j === ic) continue; if (dentro(pts[j], a, b, c)) { ok = false; break; } }
      if (!ok) continue;
      tris.push(ia, ib, ic); orden.splice(i, 1); cortado = true; break;
    }
    if (!cortado) { // polígono degenerado: cerrar con abanico
      for (let i = 1; i < orden.length - 1; i++) tris.push(orden[0], orden[i], orden[i + 1]);
      return tris;
    }
  }
  if (orden.length === 3) tris.push(orden[0], orden[1], orden[2]);
  return tris;
}

// Corta la malla con un plano (punto p, normal n) y conserva el lado hacia donde apunta n; cierra el corte
// con una tapa plana triangulada. Devuelve { malla, tapas }.
export function cortarMalla(m, p, n) {
  const { pos, idx } = m;
  const l = Math.hypot(n[0], n[1], n[2]) || 1; const nx = n[0] / l, ny = n[1] / l, nz = n[2] / l;
  const d0 = nx * p[0] + ny * p[1] + nz * p[2];
  const nV = pos.length / 3;
  const dist = new Float32Array(nV);
  for (let v = 0; v < nV; v++) dist[v] = nx * pos[v * 3] + ny * pos[v * 3 + 1] + nz * pos[v * 3 + 2] - d0;
  const nuevaPos = Array.from(pos), nuevoIdx = [];
  const cortes = new Map(); // arista → vértice nuevo sobre el plano
  const claveA = (a, b) => a < b ? a * 4294967296 + b : b * 4294967296 + a;
  const corte = (a, b) => {
    const k = claveA(a, b); let v = cortes.get(k); if (v !== undefined) return v;
    const t = dist[a] / (dist[a] - dist[b]);
    v = nuevaPos.length / 3;
    nuevaPos.push(pos[a * 3] + t * (pos[b * 3] - pos[a * 3]), pos[a * 3 + 1] + t * (pos[b * 3 + 1] - pos[a * 3 + 1]), pos[a * 3 + 2] + t * (pos[b * 3 + 2] - pos[a * 3 + 2]));
    cortes.set(k, v); return v;
  };
  const bordes = []; // segmentos [va, vb] del corte, orientados como el borde del lado conservado
  for (let t = 0; t < idx.length; t += 3) {
    const v = [idx[t], idx[t + 1], idx[t + 2]]; const s = v.map(i => dist[i] >= 0);
    const cuantos = s.filter(Boolean).length;
    if (cuantos === 3) { nuevoIdx.push(v[0], v[1], v[2]); continue; }
    if (cuantos === 0) continue;
    // rotar para que el primer vértice sea el "distinto"
    let r = 0; if (cuantos === 1) { r = s.indexOf(true); } else { r = s.indexOf(false); }
    const a = v[r], b = v[(r + 1) % 3], c = v[(r + 2) % 3];
    if (cuantos === 1) { const ab = corte(a, b), ac = corte(a, c); nuevoIdx.push(a, ab, ac); bordes.push([ac, ab]); }
    else { const ab = corte(a, b), ac = corte(a, c); nuevoIdx.push(ab, b, c, ab, c, ac); bordes.push([ab, ac]); }
  }
  // encadenar los segmentos del corte en lazos y taparlos
  const sig = new Map(); for (const [a, b] of bordes) sig.set(a, b);
  const usados = new Set(); let tapas = 0;
  // base del plano
  let u = Math.abs(nx) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  u = normalizar(cruz(u, [nx, ny, nz])); const w = cruz([nx, ny, nz], u);
  const lazos = [];
  for (const ini of sig.keys()) {
    if (usados.has(ini)) continue;
    const lazo = []; let v = ini;
    while (v !== undefined && !usados.has(v)) { usados.add(v); lazo.push(v); v = sig.get(v); }
    if (lazo.length < 3 || v !== ini) continue;
    const pts2 = lazo.map(i => { const x = nuevaPos[i * 3] - p[0], y = nuevaPos[i * 3 + 1] - p[1], z = nuevaPos[i * 3 + 2] - p[2]; return [x * u[0] + y * u[1] + z * u[2], x * w[0] + y * w[1] + z * w[2]]; });
    lazos.push({ lazo, pts2 });
  }
  // lazos anidados (una pieza hueca): el corte es un anillo y se deja abierto (base abierta para imprimir)
  const dentroDe = (q, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < (b[0] - a[0]) * (q[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const anidado = new Set();
  for (let a = 0; a < lazos.length; a++) for (let b = 0; b < lazos.length; b++) { if (a === b) continue; if (dentroDe(lazos[a].pts2[0], lazos[b].pts2)) { anidado.add(a); anidado.add(b); } }
  for (let q = 0; q < lazos.length; q++) {
    if (anidado.has(q)) continue;
    const { lazo, pts2 } = lazos[q];
    const tris = triangularPoligono(pts2);
    // la tapa mira hacia −n (hacia afuera del lado conservado)
    for (let k = 0; k < tris.length; k += 3) {
      const A = lazo[tris[k]], B = lazo[tris[k + 1]], C = lazo[tris[k + 2]];
      const ax = nuevaPos[A * 3], ay = nuevaPos[A * 3 + 1], az = nuevaPos[A * 3 + 2];
      const e1 = [nuevaPos[B * 3] - ax, nuevaPos[B * 3 + 1] - ay, nuevaPos[B * 3 + 2] - az], e2 = [nuevaPos[C * 3] - ax, nuevaPos[C * 3 + 1] - ay, nuevaPos[C * 3 + 2] - az];
      const nn = cruz(e1, e2);
      if (nn[0] * nx + nn[1] * ny + nn[2] * nz > 0) nuevoIdx.push(A, C, B); else nuevoIdx.push(A, B, C);
    }
    tapas++;
  }
  return { malla: compactar(Float32Array.from(nuevaPos), Uint32Array.from(nuevoIdx)), tapas, abiertos: anidado.size };
}

// Pedestal (cilindro o prisma) debajo del plano y = yBase, centrado en (cx, cz). Se devuelve como malla aparte.
export function pedestal(tipo, cx, cz, yBase, radio, alto, lados = 64) {
  const pos = [], idx = [];
  const n = tipo === 'cubo' ? 4 : lados;
  const desfase = tipo === 'cubo' ? Math.PI / 4 : 0;
  const r = tipo === 'cubo' ? radio * Math.SQRT2 : radio;
  const yTop = yBase + 0.6, yBot = yBase - alto; // 0,6 mm de solape con el busto para que el slicer una las dos piezas
  for (let i = 0; i < n; i++) { const a = desfase + i / n * Math.PI * 2; pos.push(cx + r * Math.cos(a), yBot, cz + r * Math.sin(a)); }
  for (let i = 0; i < n; i++) { const a = desfase + i / n * Math.PI * 2; pos.push(cx + r * Math.cos(a), yTop, cz + r * Math.sin(a)); }
  const cb = pos.length / 3; pos.push(cx, yBot, cz); const ct = cb + 1; pos.push(cx, yTop, cz);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    idx.push(i, j, n + i, j, n + j, n + i);        // lateral
    idx.push(cb, j, i);                             // base (hacia abajo)
    idx.push(ct, n + i, n + j);                     // tapa (hacia arriba)
  }
  const m = { pos: Float32Array.from(pos), idx: Uint32Array.from(idx) };
  if (volumenMalla(m) < 0) invertirCaras(m);
  return m;
}

export function unirMallas(a, b) {
  const pos = new Float32Array(a.pos.length + b.pos.length); pos.set(a.pos); pos.set(b.pos, a.pos.length);
  const idx = new Uint32Array(a.idx.length + b.idx.length); idx.set(a.idx);
  const off = a.pos.length / 3; for (let i = 0; i < b.idx.length; i++) idx[a.idx.length + i] = b.idx[i] + off;
  return { pos, idx };
}

// Rota la malla alrededor del eje Y (grados) respecto de un centro, y la traslada.
export function transformarMalla(m, { giroY = 0, centro = [0, 0, 0], traslacion = [0, 0, 0], escala = 1 } = {}) {
  const a = giroY * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const pos = new Float32Array(m.pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    const x = m.pos[i] - centro[0], y = m.pos[i + 1] - centro[1], z = m.pos[i + 2] - centro[2];
    pos[i] = (x * c + z * s) * escala + centro[0] + traslacion[0];
    pos[i + 1] = y * escala + centro[1] + traslacion[1];
    pos[i + 2] = (-x * s + z * c) * escala + centro[2] + traslacion[2];
  }
  return { pos, idx: m.idx };
}

// Transformada de distancia euclídea 3D (Meijster) del conjunto «adentro» (F < 0): distancia en vóxeles
// desde cada nodo interior hasta el exterior más cercano. Sirve para ahuecar con espesor de pared real.
export function distanciaInterior(F, nx, ny, nz) {
  const INF = 1e9;
  const g = new Float32Array(F.length);
  // 1) a lo largo de X
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) {
    const base = k * nx * ny + j * nx;
    let d = INF;
    for (let i = 0; i < nx; i++) { d = F[base + i] < 0 ? Math.min(d + 1, nx * 4) : 0; g[base + i] = d; }
    d = g[base + nx - 1];
    for (let i = nx - 1; i >= 0; i--) { d = F[base + i] < 0 ? Math.min(d + 1, g[base + i]) : 0; g[base + i] = d; }
  }
  // 2) y 3) en Y y en Z: mínimo de g² + desplazamiento² (búsqueda directa acotada)
  const pasada = (paso, largo, indice) => {
    const f = new Float32Array(largo), res = new Float32Array(largo);
    const total = F.length / largo;
    for (let c = 0; c < total; c++) {
      const idx0 = indice(c);
      let hayInterior = false;
      for (let q = 0; q < largo; q++) { f[q] = g[idx0 + q * paso]; if (f[q] > 0 && f[q] < INF) hayInterior = true; }
      if (!hayInterior) continue;
      for (let q = 0; q < largo; q++) {
        if (f[q] === 0) { res[q] = 0; continue; }
        // el valor «infinito» (fila entera interior) se acota al largo del eje para no desbordar la búsqueda
        let mejor = Math.min(f[q] * f[q], largo * largo * 4);
        const lim = Math.min(largo, Math.ceil(Math.sqrt(mejor)));
        for (let r = 1; r <= lim; r++) {
          if (q - r >= 0) { const v = f[q - r] * f[q - r] + r * r; if (v < mejor) mejor = v; }
          if (q + r < largo) { const v = f[q + r] * f[q + r] + r * r; if (v < mejor) mejor = v; }
        }
        res[q] = Math.sqrt(mejor);
      }
      for (let q = 0; q < largo; q++) g[idx0 + q * paso] = res[q];
    }
  };
  pasada(nx, ny, (c) => { const k = Math.floor(c / nx), i = c % nx; return k * nx * ny + i; });
  pasada(nx * ny, nz, (c) => c);
  return g;
}

// Ahueca el campo: deja una cáscara de «espesor» mm (el interior más profundo pasa a ser exterior).
export function ahuecarCampo(F, vol, espesor) {
  const { nx, ny, nz, voxel } = vol;
  const d = distanciaInterior(F, nx, ny, nz);
  const lim = espesor / voxel;
  const G = Float32Array.from(F);
  for (let i = 0; i < F.length; i++) if (F[i] < 0 && d[i] > lim) G[i] = Math.min(1, (d[i] - lim) / 2);
  return G;
}

// Suavizado adaptativo al ruido: donde las normales vecinas están desordenadas (pelo, bordes ruidosos)
// suaviza fuerte; donde la superficie es limpia (piel, rasgos) casi no toca. Devuelve la malla suavizada.
export function suavizarAdaptativo(m, iteraciones = 3) {
  if (!iteraciones) return m;
  const nV = m.pos.length / 3; const { inicio, vecinos } = adyacencia(nV, m.idx);
  let pos = Float32Array.from(m.pos);
  const nrm = new Float32Array(nV * 3);
  const normales = () => {
    nrm.fill(0);
    const idx = m.idx;
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const o of [a, b, c]) { nrm[o] += nx; nrm[o + 1] += ny; nrm[o + 2] += nz; }
    }
    for (let v = 0; v < nV; v++) { const l = Math.hypot(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]) || 1; nrm[v * 3] /= l; nrm[v * 3 + 1] /= l; nrm[v * 3 + 2] /= l; }
  };
  const tmp = new Float32Array(pos.length);
  for (let it = 0; it < iteraciones; it++) {
    normales();
    for (let v = 0; v < nV; v++) {
      const a = inicio[v], b = inicio[v + 1];
      if (b === a) { tmp[v * 3] = pos[v * 3]; tmp[v * 3 + 1] = pos[v * 3 + 1]; tmp[v * 3 + 2] = pos[v * 3 + 2]; continue; }
      let sx = 0, sy = 0, sz = 0, coh = 0;
      for (let k = a; k < b; k++) { const w = vecinos[k]; sx += pos[w * 3]; sy += pos[w * 3 + 1]; sz += pos[w * 3 + 2]; coh += nrm[v * 3] * nrm[w * 3] + nrm[v * 3 + 1] * nrm[w * 3 + 1] + nrm[v * 3 + 2] * nrm[w * 3 + 2]; }
      const n = b - a; coh /= n; // 1 = normales alineadas (superficie limpia), <0,8 = ruido
      const factor = coh > 0.95 ? 0.08 : coh > 0.85 ? 0.3 : 0.65;
      // movimiento sólo a lo largo de la normal (conserva la forma, no «desliza» los rasgos)
      const dx = sx / n - pos[v * 3], dy = sy / n - pos[v * 3 + 1], dz = sz / n - pos[v * 3 + 2];
      const dn = dx * nrm[v * 3] + dy * nrm[v * 3 + 1] + dz * nrm[v * 3 + 2];
      tmp[v * 3] = pos[v * 3] + factor * dn * nrm[v * 3]; tmp[v * 3 + 1] = pos[v * 3 + 1] + factor * dn * nrm[v * 3 + 1]; tmp[v * 3 + 2] = pos[v * 3 + 2] + factor * dn * nrm[v * 3 + 2];
    }
    pos.set(tmp);
  }
  return { pos, idx: m.idx };
}

// Realce de rasgos (máscara de desenfoque sobre la malla, en dos escalas): separa la forma de baja
// frecuencia (suavizado laplaciano de N pasadas) del detalle (diferencia a lo largo de la normal) y amplifica
// el detalle sólo donde las normales vecinas son coherentes (rasgos reales), no donde hay ruido. El detalle
// fino (1 pasada) realza labios, párpados y arrugas; el medio (8 pasadas) nariz, pómulos y mentón.
export function realzarRasgos(m, { fino = 0.6, medio = 0.35, tope = 1.5, umbral = 0.3 } = {}) {
  if (!fino && !medio) return m;
  const nV = m.pos.length / 3; const { inicio, vecinos } = adyacencia(nV, m.idx);
  const pos = Float32Array.from(m.pos);
  const normalesDe = (P) => {
    const nrm = new Float32Array(nV * 3); const idx = m.idx;
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const o of [a, b, c]) { nrm[o] += nx; nrm[o + 1] += ny; nrm[o + 2] += nz; }
    }
    for (let v = 0; v < nV; v++) { const l = Math.hypot(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]) || 1; nrm[v * 3] /= l; nrm[v * 3 + 1] /= l; nrm[v * 3 + 2] /= l; }
    return nrm;
  };
  const suavizar = (P, pasadas) => {
    let A = Float32Array.from(P); const B = new Float32Array(P.length);
    for (let it = 0; it < pasadas; it++) {
      for (let v = 0; v < nV; v++) {
        const a = inicio[v], b = inicio[v + 1];
        if (b === a) { B[v * 3] = A[v * 3]; B[v * 3 + 1] = A[v * 3 + 1]; B[v * 3 + 2] = A[v * 3 + 2]; continue; }
        let sx = 0, sy = 0, sz = 0; for (let k = a; k < b; k++) { const w = vecinos[k] * 3; sx += A[w]; sy += A[w + 1]; sz += A[w + 2]; }
        const n = b - a; B[v * 3] = sx / n; B[v * 3 + 1] = sy / n; B[v * 3 + 2] = sz / n;
      }
      const t = A; A = B.slice(); B.set(t);
    }
    return A;
  };
  const nrm = normalesDe(pos);
  // coherencia de normales en el vecindario: 1 = superficie limpia, baja = ruido
  const coherencia = new Float32Array(nV);
  for (let v = 0; v < nV; v++) {
    const a = inicio[v], b = inicio[v + 1]; if (b === a) { coherencia[v] = 0; continue; }
    let c = 0; for (let k = a; k < b; k++) { const w = vecinos[k] * 3; c += nrm[v * 3] * nrm[w] + nrm[v * 3 + 1] * nrm[w + 1] + nrm[v * 3 + 2] * nrm[w + 2]; }
    coherencia[v] = c / (b - a);
  }
  const escalas = [[1, fino], [8, medio]].filter(e => e[1] > 0);
  const salida = Float32Array.from(pos);
  for (const [pasadas, ganancia] of escalas) {
    const S = suavizar(pos, pasadas);
    for (let v = 0; v < nV; v++) {
      const coh = coherencia[v];
      const peso = coh > 0.97 ? 1 : coh > 0.9 ? (coh - 0.9) / 0.07 : 0; // sólo rasgos limpios
      if (peso <= 0) continue;
      const dx = pos[v * 3] - S[v * 3], dy = pos[v * 3 + 1] - S[v * 3 + 1], dz = pos[v * 3 + 2] - S[v * 3 + 2];
      let d = dx * nrm[v * 3] + dy * nrm[v * 3 + 1] + dz * nrm[v * 3 + 2];
      // «coring»: el detalle por debajo del umbral es ruido del sensor y no se amplifica
      const ad = Math.abs(d); if (ad <= umbral) continue;
      d = Math.sign(d) * (ad - umbral);
      d = Math.max(-tope, Math.min(tope, d * ganancia * peso));
      salida[v * 3] += d * nrm[v * 3]; salida[v * 3 + 1] += d * nrm[v * 3 + 1]; salida[v * 3 + 2] += d * nrm[v * 3 + 2];
    }
  }
  return { pos: salida, idx: m.idx };
}

// Simetrización de una cara: mezcla cada vértice con el punto más cercano de la malla reflejada respecto del
// plano vertical x = x0 (el plano se busca solo entre -25 y +25 mm del centro). fuerza 0–1 (0,5 = promedio
// exacto con el espejo). Quita el ruido asimétrico del escaneo; con fuerza alta borra la asimetría real.
export function simetrizar(m, { fuerza = 0.5, x0 = null, radioBusqueda = 6 } = {}) {
  if (!(fuerza > 0)) return { malla: m, x0: null, asimetria: 0 };
  const pos = m.pos; const nV = pos.length / 3;
  const med = medidasMalla(m);
  const celda = radioBusqueda;
  // grilla espacial de los vértices
  const grilla = new Map();
  const clave = (x, y, z) => Math.floor(x / celda) + ',' + Math.floor(y / celda) + ',' + Math.floor(z / celda);
  for (let v = 0; v < nV; v++) { const k = clave(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); let l = grilla.get(k); if (!l) { l = []; grilla.set(k, l); } l.push(v); }
  const masCercano = (x, y, z) => {
    let mejor = -1, md = Infinity;
    const cx = Math.floor(x / celda), cy = Math.floor(y / celda), cz = Math.floor(z / celda);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const l = grilla.get((cx + dx) + ',' + (cy + dy) + ',' + (cz + dz)); if (!l) continue;
      for (const w of l) { const d = (pos[w * 3] - x) ** 2 + (pos[w * 3 + 1] - y) ** 2 + (pos[w * 3 + 2] - z) ** 2; if (d < md) { md = d; mejor = w; } }
    }
    return mejor >= 0 && md < radioBusqueda * radioBusqueda ? mejor : -1;
  };
  // 1) buscar el plano de simetría: el desplazamiento x0 que minimiza la distancia media al espejo (muestra)
  const centroX = (med.min[0] + med.max[0]) / 2;
  const muestra = []; for (let v = 0; v < nV; v += Math.max(1, Math.floor(nV / 3000))) muestra.push(v);
  const costo = (x) => { let s = 0, c = 0; for (const v of muestra) { const w = masCercano(2 * x - pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); if (w >= 0) { s += Math.hypot(2 * x - pos[v * 3] - pos[w * 3], pos[v * 3 + 1] - pos[w * 3 + 1], pos[v * 3 + 2] - pos[w * 3 + 2]); c++; } else s += radioBusqueda; } return s / muestra.length + (c < muestra.length * 0.5 ? 100 : 0); };
  let mejorX = x0 !== null ? x0 : centroX, mejorC = Infinity;
  if (x0 === null) {
    for (let d = -25; d <= 25; d += 2.5) { const c = costo(centroX + d); if (c < mejorC) { mejorC = c; mejorX = centroX + d; } }
    for (let d = -2; d <= 2; d += 0.5) { const c = costo(mejorX + d); if (c < mejorC) { mejorC = c; mejorX = mejorX + d; } }
  }
  // 2) mezcla con el espejo
  const salida = Float32Array.from(pos); let asim = 0, n = 0;
  for (let v = 0; v < nV; v++) {
    const mx = 2 * mejorX - pos[v * 3], my = pos[v * 3 + 1], mz = pos[v * 3 + 2];
    const w = masCercano(mx, my, mz); if (w < 0) continue;
    // punto espejado del vecino más cercano → objetivo para v
    const ox = 2 * mejorX - pos[w * 3], oy = pos[w * 3 + 1], oz = pos[w * 3 + 2];
    asim += Math.hypot(ox - pos[v * 3], oy - pos[v * 3 + 1], oz - pos[v * 3 + 2]); n++;
    salida[v * 3] += fuerza * (ox - pos[v * 3]); salida[v * 3 + 1] += fuerza * (oy - pos[v * 3 + 1]); salida[v * 3 + 2] += fuerza * (oz - pos[v * 3 + 2]);
  }
  return { malla: { pos: salida, idx: m.idx }, x0: mejorX, asimetria: n ? asim / n : 0 };
}

// Arma un busto o una placa de cara a partir de la malla (Y hacia arriba, el frente mira a −Z en el marco
// del escaneo libre / +Z-cámara en el de la mesa). opciones: { tipo: 'busto'|'placa', giroY, corte (0–1 de la
// altura, o mm absolutos con corteMm), fondo (placa: 0–1 de la profundidad), pedestal: 'no'|'cilindro'|'cubo',
// pedestalAlto, alturaObjetivo (mm), suavizadoAdaptativo }
export function armarBusto(m, opciones = {}) {
  let malla = m;
  const info = {};
  if (opciones.suavizadoAdaptativo) malla = suavizarAdaptativo(malla, opciones.suavizadoAdaptativo);
  let med = medidasMalla(malla);
  const centro = [(med.min[0] + med.max[0]) / 2, (med.min[1] + med.max[1]) / 2, (med.min[2] + med.max[2]) / 2];
  if (opciones.giroY) { malla = transformarMalla(malla, { giroY: opciones.giroY, centro }); med = medidasMalla(malla); }
  // filtro de rasgos: simetrización (con el frente ya orientado) y realce de detalle
  if (opciones.simetria > 0) { const r = simetrizar(malla, { fuerza: opciones.simetria }); malla = r.malla; info.planoSimetria = r.x0; info.asimetria = r.asimetria; }
  if (opciones.realce > 0) { malla = realzarRasgos(malla, { fino: 0.6 * opciones.realce, medio: 0.35 * opciones.realce }); info.realce = opciones.realce; }
  if (opciones.tipo === 'filtros') {
    info.medidas = medidasMalla(malla); info.escala = 1;
    return { malla, info };
  }
  if (opciones.tipo === 'placa') {
    // fondo plano: se conserva lo que está por delante del plano z = zf (el frente mira a −Z)
    const f = opciones.fondo ?? 0.55;
    const zf = med.min[2] + (med.max[2] - med.min[2]) * f;
    const r = cortarMalla(malla, [0, 0, zf], [0, 0, -1]); malla = r.malla; info.tapas = r.tapas;
  }
  // corte inferior horizontal
  const c = opciones.corteMm !== undefined ? opciones.corteMm : med.min[1] + (med.max[1] - med.min[1]) * (opciones.corte ?? 0.12);
  if (opciones.corte !== null) { const r = cortarMalla(malla, [0, c, 0], [0, 1, 0]); malla = r.malla; info.tapas = (info.tapas || 0) + r.tapas; }
  med = medidasMalla(malla);
  if (!malla.idx.length) return { malla, info };
  // pedestal
  if (opciones.pedestal && opciones.pedestal !== 'no') {
    const radio = Math.max(med.ancho, med.profundo) * 0.42;
    const cx = (med.min[0] + med.max[0]) / 2, cz = (med.min[2] + med.max[2]) / 2;
    const ped = pedestal(opciones.pedestal, cx, cz, med.min[1], radio, opciones.pedestalAlto || Math.max(10, med.alto * 0.12));
    malla = unirMallas(malla, ped); med = medidasMalla(malla); info.pedestal = true;
  }
  // escala a la altura objetivo y apoyo en y = 0, centrado en x/z
  let escala = 1;
  if (opciones.alturaObjetivo > 0) escala = opciones.alturaObjetivo / med.alto;
  malla = transformarMalla(malla, { escala, centro: [0, 0, 0], traslacion: [0, 0, 0] });
  med = medidasMalla(malla);
  malla = transformarMalla(malla, { traslacion: [-(med.min[0] + med.max[0]) / 2, -med.min[1], -(med.min[2] + med.max[2]) / 2] });
  info.escala = escala;
  info.medidas = medidasMalla(malla);
  return { malla, info };
}

export function escalar(m, factor) {
  if (factor === 1) return m;
  const pos = Float32Array.from(m.pos);
  for (let i = 0; i < pos.length; i++) pos[i] *= factor;
  return { pos, idx: m.idx };
}

export function medidasMalla(m) {
  const { pos, idx } = m;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) {
    if (pos[i + k] < min[k]) min[k] = pos[i + k];
    if (pos[i + k] > max[k]) max[k] = pos[i + k];
  }
  return {
    vertices: pos.length / 3, triangulos: idx.length / 3,
    ancho: max[0] - min[0], alto: max[1] - min[1], profundo: max[2] - min[2],
    min, max, volumenCm3: Math.abs(volumenMalla(m)) / 1000, areaCm2: areaMalla(m) / 100
  };
}

// Aristas con un solo triángulo = agujeros (malla abierta). Las que tienen más de dos son
// «no variedad»: dos hojas que se tocan en una arista; a la impresora no le molestan.
export function esCerrada(m) {
  const { idx } = m;
  const cuenta = new Map();
  for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = idx[t + e], b = idx[t + (e + 1) % 3];
    const clave = a < b ? a * 4294967296 + b : b * 4294967296 + a;
    cuenta.set(clave, (cuenta.get(clave) || 0) + 1);
  }
  let abiertas = 0, noVariedad = 0;
  for (const c of cuenta.values()) { if (c === 1) abiertas++; else if (c > 2) noVariedad++; }
  return { cerrada: abiertas === 0, aristasAbiertas: abiertas, aristasNoVariedad: noVariedad, aristas: cuenta.size };
}

// ============================================================
// Pipeline completo
// ============================================================

// tomas: [{ z: Float32Array (mm), angulo: grados }]
// opciones: { modo: 'volumen'|'relieve', caja: {ancho, alto, profundo}, voxel, corte, sentido,
//             zmin, zmax, huecosVacios, relleno, mayorComponente, suavizado, reducir, escala }
export function reconstruir(tomas, marco, opciones = {}, avisar = () => {}) {
  const modo = opciones.modo || 'volumen';
  const caja = opciones.caja || { ancho: 200, alto: 200, profundo: 200 };
  const corte = opciones.corte ?? 3;
  const vol = crearVolumen(caja, opciones.voxel || 3, corte);
  avisar(`Volumen de ${vol.nx}×${vol.ny}×${vol.nz} nodos (vóxel ${vol.voxel.toFixed(1)} mm)`);
  let F;
  if (modo === 'relieve') {
    const partes = tomas.map(t => aMarcoPieza(puntosDeMapa(t.z, { zmin: opciones.zmin, zmax: opciones.zmax }), marco, t.angulo, opciones.sentido));
    let total = 0; for (const p of partes) total += p.length;
    const pts = new Float32Array(total);
    let off = 0; for (const p of partes) { pts.set(p, off); off += p.length; }
    F = campoRelieve(vol, pts);
  } else {
    tomas.forEach((t, i) => {
      avisar(`Fusionando toma ${i + 1} de ${tomas.length} (${t.angulo}°)`);
      integrarToma(vol, t.z, marco, t.angulo, { sentido: opciones.sentido, zmin: opciones.zmin, zmax: opciones.zmax, huecosVacios: opciones.huecosVacios });
    });
    F = campoFinal(vol, { relleno: opciones.relleno });
  }
  avisar('Extrayendo la superficie');
  let malla = extraerMalla(F, vol);
  const info = { componentes: 1 };
  if (!malla.idx.length) return { malla, info, vol, campo: F };
  if (opciones.mayorComponente !== false) { malla = mayorComponente(malla); info.componentes = malla.componentes; }
  malla = posprocesarMalla(malla, opciones, vol.voxel, info, avisar);
  return { malla, info, vol, campo: F };
}

// Posprocesado común (girando la pieza y a mano alzada): agujeros, suavizado, reducción y escala.
//   suavizado: iteraciones; suavizadoTipo: 'bilateral' (conserva rasgos, por defecto) | 'taubin'
//   agujeros: aristas máximas de los agujeros a rellenar (0 = no rellenar)
//   reducir: factor de celda para el agrupamiento (viejo) · objetivoTriangulos: reducción QEM a esa cantidad
export function posprocesarMalla(malla, opciones = {}, voxel = 3, info = {}, avisar = () => {}) {
  if (!malla.idx.length) return malla;
  if (opciones.agujeros) { avisar('Rellenando agujeros chicos'); const r = rellenarAgujeros(malla, opciones.agujeros); malla = r.malla; info.agujerosRellenados = r.rellenados; }
  if (opciones.suavizado) {
    avisar('Suavizando' + (opciones.suavizadoTipo === 'taubin' ? '' : ' (bilateral, conserva los rasgos)'));
    malla = opciones.suavizadoTipo === 'taubin' ? suavizar(malla, opciones.suavizado) : suavizarBilateral(malla, opciones.suavizado);
  }
  if (opciones.objetivoTriangulos) { avisar('Optimizando la malla (QEM)'); malla = reducirQEM(malla, opciones.objetivoTriangulos); }
  else if (opciones.reducir) { avisar('Reduciendo triángulos'); malla = reducir(malla, opciones.reducir * voxel); }
  if (opciones.escala && opciones.escala !== 1) malla = escalar(malla, opciones.escala);
  return malla;
}

// ============================================================
// Exportación
// ============================================================

// STL, OBJ y PLY salen con Z hacia arriba (como los quiere la impresora / Tinkercad).
function aZarriba(pos, i) { return [pos[i], -pos[i + 2], pos[i + 1]]; }

export function aSTL(m, nombre = 'Escaneo 3D con Kinect - Generador de Actividades') {
  const { pos, idx } = m;
  const nT = idx.length / 3;
  const buffer = new ArrayBuffer(84 + nT * 50);
  const dv = new DataView(buffer);
  for (let i = 0; i < 80; i++) dv.setUint8(i, i < nombre.length ? nombre.charCodeAt(i) & 0x7f : 0);
  dv.setUint32(80, nT, true);
  let off = 84;
  for (let t = 0; t < idx.length; t += 3) {
    const a = aZarriba(pos, idx[t] * 3), b = aZarriba(pos, idx[t + 1] * 3), c = aZarriba(pos, idx[t + 2] * 3);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    dv.setFloat32(off, nx, true); dv.setFloat32(off + 4, ny, true); dv.setFloat32(off + 8, nz, true); off += 12;
    for (const p of [a, b, c]) { dv.setFloat32(off, p[0], true); dv.setFloat32(off + 4, p[1], true); dv.setFloat32(off + 8, p[2], true); off += 12; }
    dv.setUint16(off, 0, true); off += 2;
  }
  return buffer;
}

export function aOBJ(m, nombre = 'escaneo') {
  const { pos, idx } = m;
  const lineas = ['# Escaneo 3D con Kinect - Generador de Actividades', `o ${nombre}`];
  for (let i = 0; i < pos.length; i += 3) { const p = aZarriba(pos, i); lineas.push(`v ${p[0].toFixed(3)} ${p[1].toFixed(3)} ${p[2].toFixed(3)}`); }
  for (let t = 0; t < idx.length; t += 3) lineas.push(`f ${idx[t] + 1} ${idx[t + 1] + 1} ${idx[t + 2] + 1}`);
  return lineas.join('\n') + '\n';
}

// Nube de puntos (Float32Array xyz en el marco de la pieza) a PLY binario.
export function aPLY(pts) {
  const n = pts.length / 3;
  const cabecera = `ply\nformat binary_little_endian 1.0\ncomment Escaneo 3D con Kinect - Generador de Actividades\nelement vertex ${n}\nproperty float x\nproperty float y\nproperty float z\nend_header\n`;
  const cab = new TextEncoder().encode(cabecera);
  const buffer = new ArrayBuffer(cab.length + n * 12);
  new Uint8Array(buffer).set(cab);
  const dv = new DataView(buffer, cab.length);
  for (let i = 0; i < n; i++) {
    const p = aZarriba(pts, i * 3);
    dv.setFloat32(i * 12, p[0], true); dv.setFloat32(i * 12 + 4, p[1], true); dv.setFloat32(i * 12 + 8, p[2], true);
  }
  return buffer;
}

// ============================================================
// Escena sintética (para probar sin Kinect)
// ============================================================

// Cámara a 800 mm del eje, 380 mm por encima de la mesa, mirando al centro de la pieza.
// La pieza: una caja con una esfera arriba y una manija cilíndrica a un costado (asimétrica,
// para que se note si el sentido de giro está al revés).
export function sintetizarToma(anguloGrados = 0, opciones = {}) {
  const intr = opciones.intr || INTR;
  const ruido = opciones.ruido ?? 2.5;
  let semilla = (opciones.semilla || 7) + Math.round(anguloGrados * 13);
  const rnd = () => { semilla = (semilla * 1103515245 + 12345) & 0x7fffffff; return semilla / 0x7fffffff; };
  const gauss = () => { const u = rnd() || 1e-6, v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const C = opciones.camara || [0, 380, -800];
  const objetivo = [0, 60, 0];
  const f = normalizar([objetivo[0] - C[0], objetivo[1] - C[1], objetivo[2] - C[2]]);
  // base derecha de la cámara (x, y abajo, z adelante): con Y del mundo hacia arriba,
  // el «derecha» de la imagen cae hacia -X del mundo
  const abajo = normalizar([0 - f[0] * -f[1], -1 - f[1] * -f[1], 0 - f[2] * -f[1]]);
  const der = normalizar(cruz(abajo, f));
  const a = -(opciones.sentido ?? 1) * anguloGrados * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  const z = new Float32Array(intr.ancho * intr.alto);
  // centrada en el eje de giro (de -75 a 75 en X), pero asimétrica
  const caja = [-75, 45, 0, 60, -40, 40];
  const esfera = [-15, 90, 0, 42];
  const cil = { x0: 45, x1: 75, y: 30, z: 0, r: 15 };
  for (let v = 0; v < intr.alto; v++) for (let u = 0; u < intr.ancho; u++) {
    const dx = (u - intr.cx) / intr.fx, dy = (v - intr.cy) / intr.fy;
    const l = Math.hypot(dx, dy, 1);
    const dc = [dx / l, dy / l, 1 / l];
    const dw = [der[0] * dc[0] + abajo[0] * dc[1] + f[0] * dc[2], der[1] * dc[0] + abajo[1] * dc[1] + f[1] * dc[2], der[2] * dc[0] + abajo[2] * dc[1] + f[2] * dc[2]];
    let t = Infinity, nrm = null;
    if (dw[1] < 0) { const tt = -C[1] / dw[1]; if (tt > 0) { t = tt; nrm = [0, 1, 0]; } }
    // rayo en el marco de la pieza (deshacer el giro de la base)
    const Co = [C[0] * ca + C[2] * sa, C[1], -C[0] * sa + C[2] * ca];
    const Do = [dw[0] * ca + dw[2] * sa, dw[1], -dw[0] * sa + dw[2] * ca];
    // caja
    let t0 = -Infinity, t1 = Infinity, eje = -1;
    for (let k = 0; k < 3; k++) {
      const inv = 1 / Do[k];
      let ta = (caja[k * 2] - Co[k]) * inv, tb = (caja[k * 2 + 1] - Co[k]) * inv;
      if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
      if (ta > t0) { t0 = ta; eje = k; }
      if (tb < t1) t1 = tb;
    }
    if (t0 <= t1 && t0 > 0 && t0 < t) { t = t0; nrm = [0, 0, 0]; nrm[eje] = -Math.sign(Do[eje]); }
    // esfera
    {
      const ox = Co[0] - esfera[0], oy = Co[1] - esfera[1], oz = Co[2] - esfera[2];
      const b = ox * Do[0] + oy * Do[1] + oz * Do[2];
      const c = ox * ox + oy * oy + oz * oz - esfera[3] * esfera[3];
      const disc = b * b - c;
      if (disc > 0) { const tt = -b - Math.sqrt(disc); if (tt > 0 && tt < t) { t = tt; const p = [ox + tt * Do[0], oy + tt * Do[1], oz + tt * Do[2]]; nrm = normalizar(p); } }
    }
    // cilindro a lo largo de X
    {
      const oy = Co[1] - cil.y, oz = Co[2] - cil.z;
      const A = Do[1] * Do[1] + Do[2] * Do[2];
      const B = oy * Do[1] + oz * Do[2];
      const Cc = oy * oy + oz * oz - cil.r * cil.r;
      const disc = B * B - A * Cc;
      if (A > 1e-9 && disc > 0) {
        const tt = (-B - Math.sqrt(disc)) / A;
        if (tt > 0 && tt < t) { const x = Co[0] + tt * Do[0]; if (x >= cil.x0 && x <= cil.x1) { t = tt; nrm = normalizar([0, oy + tt * Do[1], oz + tt * Do[2]]); } }
      }
      // tapa del cilindro
      if (Math.abs(Do[0]) > 1e-9) {
        const tt = (cil.x1 - Co[0]) / Do[0];
        if (tt > 0 && tt < t) { const y = Co[1] + tt * Do[1] - cil.y, zz = Co[2] + tt * Do[2] - cil.z; if (y * y + zz * zz <= cil.r * cil.r) { t = tt; nrm = [1, 0, 0]; } }
      }
    }
    if (!isFinite(t)) continue;
    // ángulo rasante → sin dato (como en el sensor real)
    const rasante = Math.abs(nrm[0] * Do[0] + nrm[1] * Do[1] + nrm[2] * Do[2]);
    if (rasante < 0.12 || rnd() < 0.004) continue;
    let prof = t * dc[2];
    if (ruido > 0) prof += gauss() * ruido;
    z[v * intr.ancho + u] = crudoAmm(mmAcrudo(prof));
  }
  return z;
}

// ============================================================
// Asistente: evaluación de la escena, de cada toma y de la cobertura
// ============================================================

// Estado de la escena en vivo, para la lista de chequeo antes de capturar.
// Devuelve { items: [{ clave, ok: true|false|null, texto, consejo }], resumen }.
export function evaluarEscena(z, plano, marco, caja, opciones = {}) {
  const intr = opciones.intr || INTR;
  const corte = opciones.corte ?? 4;
  const zmin = opciones.zmin || 0, zmax = opciones.zmax || 1e9;
  const items = [];
  if (!plano || !marco) {
    items.push({ clave: 'mesa', ok: false, texto: 'No se detectó la mesa', consejo: 'Apuntá el Kinect hacia abajo para que se vea una buena porción de mesa vacía dentro del rango de distancia, y apretá «Detectar la mesa».' });
    return { items, listo: false };
  }
  const inclinacion = Math.acos(Math.min(1, Math.abs(plano.n[1]))) * 180 / Math.PI;
  let okIncl = null, consejoIncl = '';
  if (inclinacion < 15) { okIncl = false; consejoIncl = 'El Kinect está casi horizontal: no va a ver la parte de arriba de la pieza. Incliná el sensor entre 25° y 40° hacia abajo (subilo o apoyalo sobre algo).'; }
  else if (inclinacion > 60) { okIncl = false; consejoIncl = 'El Kinect mira demasiado hacia abajo: los costados de la pieza salen mal. Bajalo hasta unos 25°–40° (salvo que quieras el modo relieve).'; }
  else okIncl = true;
  items.push({ clave: 'inclinacion', ok: okIncl, texto: `Inclinación del Kinect: ${inclinacion.toFixed(0)}°`, consejo: consejoIncl });

  // píxeles por clase, muestreando uno de cada dos en cada eje (alcanza y es 4 veces más rápido)
  const P = 2;
  const clases = clasificarPixeles(z, marco, caja, { corte, zmin, zmax, intr, paso: P });
  let nMesa = 0, nPieza = 0, nSinDato = 0, nFuera = 0;
  const hx = caja.ancho / 2, hz = caja.profundo / 2;
  const xs = [], ys = [], zs = [];
  let sumD = 0;
  let bordeX = 0, bordeZ = 0, bordeTop = 0;
  const { O, X, U, Z } = marco;
  for (let v = 0; v < intr.alto; v += P) for (let u = 0; u < intr.ancho; u += P) {
    const i = v * intr.ancho + u;
    const c = clases[i];
    if (c === 0) { nSinDato++; continue; }
    if (c === 2) { nMesa++; continue; }
    if (c === 1) { nFuera++; continue; }
    nPieza++;
    const d = z[i];
    const px = (u - intr.cx) * d / intr.fx, py = (v - intr.cy) * d / intr.fy;
    const dx = px - O[0], dy = py - O[1], dz = d - O[2];
    const x = X[0] * dx + X[1] * dy + X[2] * dz, y = U[0] * dx + U[1] * dy + U[2] * dz, zz = Z[0] * dx + Z[1] * dy + Z[2] * dz;
    xs.push(x); ys.push(y); zs.push(zz);
    sumD += d;
    if (Math.abs(x) > hx - 8) bordeX++;
    if (Math.abs(zz) > hz - 8) bordeZ++;
    if (y > caja.alto - 8) bordeTop++;
  }
  const total = (intr.ancho / P) * (intr.alto / P);
  const fracMesa = nMesa / total;
  items.push({
    clave: 'mesa', ok: fracMesa > 0.08, texto: `Mesa visible: ${(fracMesa * 100).toFixed(0)}% de la imagen`,
    consejo: fracMesa > 0.08 ? '' : 'Se ve poca mesa alrededor de la pieza. Alejá un poco el Kinect o inclinalo más: la mesa es la referencia para el eje de giro.'
  });
  if (nPieza < 300 / (P * P)) {
    items.push({ clave: 'pieza', ok: false, texto: 'No hay nada dentro de la caja de escaneo', consejo: 'Apoyá la pieza sobre la base giratoria, en el centro del círculo blanco. Si está pero no se pinta de naranja, subí el «corte» si la base es gruesa, o agrandá la caja.' });
    return { items, listo: false };
  }
  const distancia = sumD / nPieza;
  // medidas robustas: percentiles 2 y 98, para que unos pocos píxeles de ruido no las agranden
  xs.sort((a, b) => a - b); ys.sort((a, b) => a - b); zs.sort((a, b) => a - b);
  const pct = (arr, q) => arr[Math.min(arr.length - 1, Math.floor(q * arr.length))];
  const minX = pct(xs, 0.02), maxX = pct(xs, 0.98), maxY = pct(ys, 0.99), minZ = pct(zs, 0.02), maxZ = pct(zs, 0.98);
  let okDist = true, consejoDist = '';
  if (distancia < 600) { okDist = false; consejoDist = 'La pieza está muy cerca: el Kinect v1 no mide bien por debajo de 60 cm. Alejala o alejá el sensor.'; }
  else if (distancia > 1300) { okDist = false; consejoDist = 'La pieza está lejos y cada píxel abarca varios milímetros: acercá el Kinect a 70–100 cm para más detalle.'; }
  items.push({ clave: 'distancia', ok: okDist, texto: `Distancia a la pieza: ${(distancia / 10).toFixed(0)} cm`, consejo: consejoDist });

  const ancho = maxX - minX, alto = maxY - corte, fondo = maxZ - minZ;
  let okTam = true, consejoTam = '';
  if (Math.max(ancho, alto) < 50) { okTam = false; consejoTam = 'La pieza es muy chica para este sensor (menos de 5 cm): va a salir sin detalle. Probá con algo más grande o acercá el Kinect al mínimo (60 cm).'; }
  items.push({ clave: 'tamano', ok: okTam, texto: `Tamaño visible: ${ancho.toFixed(0)} × ${fondo.toFixed(0)} × ${alto.toFixed(0)} mm`, consejo: consejoTam });

  const recorte = (bordeX + bordeZ + bordeTop) / nPieza;
  let consejoRec = '';
  if (recorte > 0.02) {
    const lados = [];
    if (bordeX / nPieza > 0.01) lados.push('los costados (ancho)');
    if (bordeZ / nPieza > 0.01) lados.push('adelante o atrás (fondo)');
    if (bordeTop / nPieza > 0.01) lados.push('arriba (alto)');
    consejoRec = `La pieza toca el borde de la caja por ${lados.join(' y ')}: agrandá la caja o corré el eje con las flechas para que quede toda adentro.`;
  }
  items.push({ clave: 'caja', ok: recorte <= 0.02, texto: recorte <= 0.02 ? 'La pieza entra en la caja' : 'La pieza se sale de la caja', consejo: consejoRec });

  const centroX = (minX + maxX) / 2, centroZ = (minZ + maxZ) / 2;
  const desc = Math.hypot(centroX, centroZ);
  items.push({
    clave: 'centrado', ok: desc < Math.max(15, ancho * 0.15), texto: `Pieza descentrada del eje: ${desc.toFixed(0)} mm`,
    consejo: desc < Math.max(15, ancho * 0.15) ? '' : `La pieza no está sobre el eje de giro: movela hacia el centro de la base o corré el eje ${Math.abs(centroX) > Math.abs(centroZ) ? (centroX > 0 ? 'a la derecha' : 'a la izquierda') : (centroZ > 0 ? 'hacia el fondo' : 'hacia la cámara')} con las flechas. Si gira descentrada, las tomas no encajan.`
  });

  // huecos dentro de la silueta de la pieza: píxeles sin dato rodeados de pieza
  let huecos = 0;
  for (let v = P; v < intr.alto - P; v += P) for (let u = P; u < intr.ancho - P; u += P) {
    const i = v * intr.ancho + u;
    if (clases[i] !== 0 || z[i] > 0) continue;
    let vecinos = 0;
    if (clases[i - P] === 3) vecinos++; if (clases[i + P] === 3) vecinos++; if (clases[i - P * intr.ancho] === 3) vecinos++; if (clases[i + P * intr.ancho] === 3) vecinos++;
    if (vecinos >= 2) huecos++;
  }
  const fracHuecos = huecos / (nPieza + huecos);
  items.push({
    clave: 'huecos', ok: fracHuecos < 0.08, texto: `Huecos sin dato en la pieza: ${(fracHuecos * 100).toFixed(0)}%`,
    consejo: fracHuecos < 0.08 ? '' : 'El sensor no ve partes de la pieza: superficies negras, brillantes, transparentes o muy inclinadas. Cubrilas con cinta de papel o una capa de talco, apagá el sol directo sobre la mesa, y activá «Rellenar huecos chicos».'
  });
  const listo = items.every(it => it.ok !== false || it.clave === 'huecos' || it.clave === 'centrado');
  return { items, listo, medidas: { ancho, alto, fondo, distancia, nPieza } };
}

// Calidad de una toma ya capturada. cuadros (opcional): los cuadros crudos de la toma, para
// medir si algo se movió. Devuelve { puntaje: 0..100, nivel: 'buena'|'regular'|'mala', consejos: [] }.
export function evaluarToma(z, marco, caja, opciones = {}) {
  const intr = opciones.intr || INTR;
  const escena = evaluarEscena(z, marco ? marco.plano : null, marco, caja, opciones);
  const consejos = [];
  let puntaje = 100;
  for (const it of escena.items) {
    if (it.ok === false) {
      const peso = { pieza: 100, caja: 35, huecos: 25, distancia: 20, centrado: 20, tamano: 20, mesa: 10, inclinacion: 10 }[it.clave] || 10;
      puntaje -= peso;
      if (it.consejo) consejos.push(it.consejo);
    }
  }
  // ruido: rugosidad local dentro de la pieza (diferencia con el vecino de la derecha)
  if (escena.medidas) {
    const clases = clasificarPixeles(z, marco, caja, { corte: opciones.corte ?? 4, zmin: opciones.zmin, zmax: opciones.zmax, intr });
    let suma = 0, n = 0;
    for (let i = 0; i < z.length - 1; i++) {
      if (clases[i] !== 3 || clases[i + 1] !== 3) continue;
      const d = Math.abs(z[i] - z[i + 1]);
      if (d < 40) { suma += d; n++; }
    }
    const rugosidad = n ? suma / n : 0;
    if (rugosidad > 6) { puntaje -= 15; consejos.push(`La superficie sale muy rugosa (${rugosidad.toFixed(1)} mm entre píxeles vecinos): subí los «cuadros por toma» a 10 o 20, acercá el Kinect y evitá la luz del sol sobre la pieza.`); }
    else if (rugosidad > 3.5) { puntaje -= 5; }
  }
  // movimiento durante la toma
  if (opciones.cuadros && opciones.cuadros.length > 2) {
    const c = opciones.cuadros;
    let suma = 0, n = 0;
    for (let i = 0; i < z.length; i += 7) {
      const ref = z[i]; if (!(ref > 0)) continue;
      let dev = 0, m = 0;
      for (const cu of c) { const v = cu[i]; if (v > 0) { dev += Math.abs(v - ref); m++; } }
      if (m) { suma += dev / m; n++; }
    }
    const movimiento = n ? suma / n : 0;
    if (movimiento > 6) { puntaje -= 25; consejos.push(`Algo se movió durante la toma (${movimiento.toFixed(1)} mm de variación entre cuadros): no toques la pieza ni el Kinect hasta que termine de capturar, y usá la cuenta regresiva.`); }
  }
  puntaje = Math.max(0, Math.min(100, puntaje));
  const nivel = puntaje >= 75 ? 'buena' : puntaje >= 45 ? 'regular' : 'mala';
  if (!consejos.length) consejos.push('Toma en buen estado.');
  return { puntaje, nivel, consejos, medidas: escena.medidas || null };
}

// Plan de tomas para el modo de giro: qué ángulos hacen falta y cuáles faltan.
export function planDeTomas(tomas, paso = 45) {
  const plan = [];
  for (let a = 0; a < 360; a += paso) plan.push(a);
  const norm = a => ((a % 360) + 360) % 360;
  const estado = plan.map(a => {
    const idx = tomas.findIndex(t => Math.abs(norm(t.angulo) - a) <= paso / 2 - 1e-6 || Math.abs(norm(t.angulo) - a - 360) <= paso / 2 - 1e-6);
    return { angulo: a, toma: idx >= 0 ? idx : null };
  });
  const faltan = estado.filter(e => e.toma === null).map(e => e.angulo);
  const siguiente = faltan.length ? faltan[0] : null;
  return { plan: estado, faltan, siguiente, completas: plan.length - faltan.length, total: plan.length };
}

// Cobertura del modelo: qué parte de la superficie se rellenó sin haberla visto, y de qué lado.
// Devuelve { fraccionNoVista, sectores: [{ desde, hasta, fraccion }], arriba, consejos }.
export function analizarCobertura(vol, F, opciones = {}) {
  const { nx, ny, nz, voxel, origen, peso, corte } = vol;
  const sectores = new Array(8).fill(0);
  const total8 = new Array(8).fill(0);
  let vistos = 0, noVistos = 0, arribaNo = 0, arribaTot = 0;
  let maxY = corte;
  let idx = 0;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++, idx++) {
    const y = origen[1] + j * voxel;
    if (y < corte + voxel || F[idx] >= 0) continue;
    // ¿es superficie? nodo interior con algún vecino exterior
    let sup = false;
    if (i > 0 && F[idx - 1] >= 0) sup = true;
    else if (i < nx - 1 && F[idx + 1] >= 0) sup = true;
    else if (j > 0 && F[idx - nx] >= 0) sup = true;
    else if (j < ny - 1 && F[idx + nx] >= 0) sup = true;
    else if (k > 0 && F[idx - nx * ny] >= 0) sup = true;
    else if (k < nz - 1 && F[idx + nx * ny] >= 0) sup = true;
    if (!sup) continue;
    if (y > maxY) maxY = y;
    const x = origen[0] + i * voxel, z = origen[2] + k * voxel;
    const ang = ((Math.atan2(x, -z) * 180 / Math.PI) + 360) % 360; // 0° = lado que mira a la cámara en la toma 0
    const s = Math.floor(ang / 45) % 8;
    total8[s]++;
    const noVisto = peso[idx] === 0;
    if (noVisto) { noVistos++; sectores[s]++; } else vistos++;
    if (opciones.altoPieza && y > opciones.altoPieza * 0.8) { arribaTot++; if (noVisto) arribaNo++; }
  }
  const totalSup = vistos + noVistos || 1;
  const fraccionNoVista = noVistos / totalSup;
  const porSector = sectores.map((n, s) => ({ desde: s * 45, hasta: s * 45 + 45, fraccion: total8[s] ? n / total8[s] : 0, nodos: n }));
  const consejos = [];
  const peores = porSector.filter(p => p.fraccion > 0.25 && p.nodos > 20).sort((a, b) => b.fraccion - a.fraccion);
  for (const p of peores.slice(0, 3)) consejos.push(`El lado que quedó entre ${p.desde}° y ${p.hasta}° se rellenó sin verse (${(p.fraccion * 100).toFixed(0)}% de esa cara): sumá una toma con la pieza girada a unos ${p.desde + 22}°.`);
  const arriba = arribaTot ? arribaNo / arribaTot : 0;
  if (arriba > 0.3) consejos.push(`La parte de arriba se vio poco (${(arriba * 100).toFixed(0)}% rellenada a ciegas): para la próxima incliná más el Kinect (35°–45°) o apoyá la pieza de costado y hacé un segundo escaneo.`);
  if (fraccionNoVista > 0.35 && !consejos.length) consejos.push('Más de un tercio de la superficie se rellenó sin verse: hacé tomas cada 30° y revisá que la pieza gire centrada en el eje.');
  return { fraccionNoVista, sectores: porSector, arriba, consejos };
}
