// Escaneo a mano alzada («libre»): el Kinect se mueve alrededor de la persona o el objeto,
// que se quedan quietos. Es un KinectFusion simplificado:
//  1. con la pose anterior se «raycastea» el volumen TSDF y sale un mapa de puntos y normales
//     del modelo tal como se vería desde ahí (eso también es la vista previa en vivo);
//  2. el cuadro nuevo se alinea contra ese mapa por ICP punto-a-plano con asociación
//     proyectiva (unas pocas iteraciones a 160×120): de ahí sale la pose nueva;
//  3. el cuadro se integra en el volumen con esa pose.
// El marco del mundo es la primera pose de la cámara, con Y hacia arriba; el volumen es un cubo
// centrado a «distancia» milímetros delante de esa primera pose.
//
// Se puede usar como módulo (pruebas en Node) o como Web Worker (mensajes al final del archivo).

import * as N from './escaneo3d-nucleo.js';

const RED_W = 160, RED_H = 120, ESC = 4;

function normalizar3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

// Rotación de Rodrigues a partir de un vector de giro (radianes), 3x3 por filas.
function rodrigues(w) {
  const th = Math.hypot(w[0], w[1], w[2]);
  if (th < 1e-12) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const k = [w[0] / th, w[1] / th, w[2] / th];
  const c = Math.cos(th), s = Math.sin(th), C = 1 - c;
  return [
    c + k[0] * k[0] * C, k[0] * k[1] * C - k[2] * s, k[0] * k[2] * C + k[1] * s,
    k[1] * k[0] * C + k[2] * s, c + k[1] * k[1] * C, k[1] * k[2] * C - k[0] * s,
    k[2] * k[0] * C - k[1] * s, k[2] * k[1] * C + k[0] * s, c + k[2] * k[2] * C
  ];
}
function mulR(a, b) {
  const r = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r;
}
function apR(R, p) { return [R[0] * p[0] + R[1] * p[1] + R[2] * p[2], R[3] * p[0] + R[4] * p[1] + R[5] * p[2], R[6] * p[0] + R[7] * p[1] + R[8] * p[2]]; }
function apRt(R, p) { return [R[0] * p[0] + R[3] * p[1] + R[6] * p[2], R[1] * p[0] + R[4] * p[1] + R[7] * p[2], R[2] * p[0] + R[5] * p[1] + R[8] * p[2]]; }

// Resuelve A x = b (6x6, simétrica) por eliminación de Gauss con pivoteo.
function resolver6(A, b) {
  const n = 6;
  const M = new Float64Array(n * (n + 1));
  for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) M[i * (n + 1) + j] = A[i * n + j]; M[i * (n + 1) + n] = b[i]; }
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r * (n + 1) + c]) > Math.abs(M[p * (n + 1) + c])) p = r;
    if (Math.abs(M[p * (n + 1) + c]) < 1e-12) return null;
    if (p !== c) for (let j = 0; j <= n; j++) { const t = M[c * (n + 1) + j]; M[c * (n + 1) + j] = M[p * (n + 1) + j]; M[p * (n + 1) + j] = t; }
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r * (n + 1) + c] / M[c * (n + 1) + c];
      if (!f) continue;
      for (let j = c; j <= n; j++) M[r * (n + 1) + j] -= f * M[c * (n + 1) + j];
    }
  }
  const x = new Array(n);
  for (let i = 0; i < n; i++) x[i] = M[i * (n + 1) + n] / M[i * (n + 1) + i];
  return x;
}

export class EscanerLibre {
  // opciones: { lado (mm), voxel (mm), distancia (mm), intr }
  constructor(opciones = {}) {
    this.intr = opciones.intr || N.INTR;
    this.lado = opciones.lado || 500;
    this.distancia = opciones.distancia || 800;
    const lado = this.lado;
    this.vol = N.crearVolumen({ ancho: lado, alto: lado / 2, profundo: lado }, opciones.voxel || 5, -lado / 2, opciones.maxNodos || 2.5e6);
    this.mu = Math.max(2.5 * this.vol.voxel, 10);
    // primera cámara: mundo = cámara girada 180° alrededor de Z (así Y queda hacia arriba),
    // corrida para que el centro del volumen quede «distancia» adelante
    this.R = [-1, 0, 0, 0, -1, 0, 0, 0, 1];
    this.t = [0, 0, -this.distancia];
    this.Rprev = this.R.slice(); this.tprev = this.t.slice();
    this.Rant = null; this.tant = null; // pose anterior a la anterior (para predecir)
    const n = RED_W * RED_H;
    this.Vm = new Float32Array(n * 3); this.Nm = new Float32Array(n * 3); this.Mm = new Uint8Array(n);
    this.Vf = new Float32Array(n * 3); this.Nf = new Float32Array(n * 3); this.Mf = new Uint8Array(n);
    this.imagen = new Uint8ClampedArray(n * 4);
    this.cuadros = 0; this.integrados = 0; this.perdidos = 0; this.seguidos = 0;
    this.calidad = { inliers: 0, validos: 0, residuo: 0, ok: false };
    this.hayModelo = false;
  }

  // ---------- mapa de puntos y normales del cuadro (160×120) ----------
  _mapaCuadro(z) {
    const { ancho: W, fx, fy, cx, cy } = this.intr;
    const Vf = this.Vf, Mf = this.Mf, Nf = this.Nf;
    for (let j = 0; j < RED_H; j++) for (let i = 0; i < RED_W; i++) {
      let s = 0, c = 0;
      const u0 = i * ESC, v0 = j * ESC;
      for (let dv = 0; dv < ESC; dv++) { const fila = (v0 + dv) * W + u0; for (let du = 0; du < ESC; du++) { const d = z[fila + du]; if (d > 0) { s += d; c++; } } }
      const k = j * RED_W + i;
      if (c < 6) { Mf[k] = 0; continue; }
      const d = s / c;
      const u = u0 + (ESC - 1) / 2, v = v0 + (ESC - 1) / 2;
      Vf[k * 3] = (u - cx) * d / fx; Vf[k * 3 + 1] = (v - cy) * d / fy; Vf[k * 3 + 2] = d;
      Mf[k] = 1;
    }
    for (let j = 0; j < RED_H - 1; j++) for (let i = 0; i < RED_W - 1; i++) {
      const k = j * RED_W + i, kr = k + 1, kd = k + RED_W;
      if (!Mf[k] || !Mf[kr] || !Mf[kd]) { if (Mf[k]) Mf[k] = 0; continue; }
      const ax = Vf[kr * 3] - Vf[k * 3], ay = Vf[kr * 3 + 1] - Vf[k * 3 + 1], az = Vf[kr * 3 + 2] - Vf[k * 3 + 2];
      const bx = Vf[kd * 3] - Vf[k * 3], by = Vf[kd * 3 + 1] - Vf[k * 3 + 1], bz = Vf[kd * 3 + 2] - Vf[k * 3 + 2];
      if (Math.hypot(ax, ay, az) > 60 || Math.hypot(bx, by, bz) > 60) { Mf[k] = 0; continue; } // borde de profundidad
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      const l = Math.hypot(nx, ny, nz); if (l < 1e-9) { Mf[k] = 0; continue; }
      nx /= l; ny /= l; nz /= l;
      if (nx * Vf[k * 3] + ny * Vf[k * 3 + 1] + nz * Vf[k * 3 + 2] > 0) { nx = -nx; ny = -ny; nz = -nz; } // mirando a la cámara
      Nf[k * 3] = nx; Nf[k * 3 + 1] = ny; Nf[k * 3 + 2] = nz;
    }
    for (let i = 0; i < RED_W; i++) Mf[(RED_H - 1) * RED_W + i] = 0;
    for (let j = 0; j < RED_H; j++) Mf[j * RED_W + RED_W - 1] = 0;
  }

  // ---------- raycast del volumen desde la pose (R, t) ----------
  _raycast(R, t) {
    const { vol, mu } = this;
    const { nx, ny, nz, voxel, origen, tsdf, peso } = vol;
    const { fx, fy, cx, cy } = this.intr;
    const Vm = this.Vm, Nm = this.Nm, Mm = this.Mm, img = this.imagen;
    const maxX = origen[0] + (nx - 1) * voxel, maxY = origen[1] + (ny - 1) * voxel, maxZ = origen[2] + (nz - 1) * voxel;
    const paso = voxel * 0.6;
    const capa = nx * ny;
    const muestra = (x, y, z) => { // valor nearest; NaN si no hay dato
      const i = Math.round((x - origen[0]) / voxel), j = Math.round((y - origen[1]) / voxel), k = Math.round((z - origen[2]) / voxel);
      if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) return NaN;
      const idx = k * capa + j * nx + i;
      return peso[idx] > 0 ? tsdf[idx] : NaN;
    };
    const muestraTri = (x, y, z) => { // trilineal; NaN si falta algún vecino
      const fx_ = (x - origen[0]) / voxel, fy_ = (y - origen[1]) / voxel, fz_ = (z - origen[2]) / voxel;
      const i0 = Math.floor(fx_), j0 = Math.floor(fy_), k0 = Math.floor(fz_);
      if (i0 < 0 || j0 < 0 || k0 < 0 || i0 >= nx - 1 || j0 >= ny - 1 || k0 >= nz - 1) return NaN;
      const a = fx_ - i0, b = fy_ - j0, c = fz_ - k0;
      let acc = 0;
      for (let dk = 0; dk < 2; dk++) for (let dj = 0; dj < 2; dj++) for (let di = 0; di < 2; di++) {
        const idx = (k0 + dk) * capa + (j0 + dj) * nx + i0 + di;
        if (peso[idx] === 0) return NaN;
        acc += tsdf[idx] * (di ? a : 1 - a) * (dj ? b : 1 - b) * (dk ? c : 1 - c);
      }
      return acc;
    };
    let visibles = 0;
    for (let j = 0; j < RED_H; j++) for (let i = 0; i < RED_W; i++) {
      const k = j * RED_W + i;
      Mm[k] = 0;
      img[k * 4] = 28; img[k * 4 + 1] = 28; img[k * 4 + 2] = 32; img[k * 4 + 3] = 255;
      const u = i * ESC + (ESC - 1) / 2, v = j * ESC + (ESC - 1) / 2;
      const ddx = (u - cx) / fx, ddy = (v - cy) / fy, dl = Math.hypot(ddx, ddy, 1);
      const cx0 = ddx / dl, cy0 = ddy / dl, cz0 = 1 / dl;
      const d = [R[0] * cx0 + R[1] * cy0 + R[2] * cz0, R[3] * cx0 + R[4] * cy0 + R[5] * cz0, R[6] * cx0 + R[7] * cy0 + R[8] * cz0];
      // entrada y salida del cubo
      let t0 = 0, t1 = Infinity;
      const o = t;
      for (let a = 0; a < 3; a++) {
        const lo = origen[a], hi = a === 0 ? maxX : a === 1 ? maxY : maxZ;
        if (Math.abs(d[a]) < 1e-9) { if (o[a] < lo || o[a] > hi) { t1 = -1; break; } continue; }
        let ta = (lo - o[a]) / d[a], tb = (hi - o[a]) / d[a];
        if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
        if (ta > t0) t0 = ta; if (tb < t1) t1 = tb;
      }
      if (t1 <= t0) continue;
      let prev = NaN, tp = t0;
      let hit = -1;
      for (let s = t0 + paso * 0.5; s < t1; s += paso) {
        const val = muestra(o[0] + d[0] * s, o[1] + d[1] * s, o[2] + d[2] * s);
        if (!isNaN(val)) {
          if (!isNaN(prev) && prev > 0 && val <= 0) {
            // afinar el cruce con interpolación trilineal entre las dos muestras
            const a1 = muestraTri(o[0] + d[0] * tp, o[1] + d[1] * tp, o[2] + d[2] * tp);
            const b1 = muestraTri(o[0] + d[0] * s, o[1] + d[1] * s, o[2] + d[2] * s);
            if (!isNaN(a1) && !isNaN(b1) && a1 > 0 && b1 <= 0) hit = tp + (s - tp) * a1 / (a1 - b1);
            else hit = tp + (s - tp) * prev / (prev - val);
            break;
          }
          if (val < -0.99) { prev = NaN; } else { prev = val; tp = s; }
        } else prev = NaN;
      }
      if (hit < 0) continue;
      const px = o[0] + d[0] * hit, py = o[1] + d[1] * hit, pz = o[2] + d[2] * hit;
      // normal por gradiente del tsdf (trilineal, con paso de medio vóxel)
      const h = voxel * 0.5;
      let gx = muestraTri(px + h, py, pz) - muestraTri(px - h, py, pz);
      let gy = muestraTri(px, py + h, pz) - muestraTri(px, py - h, pz);
      let gz = muestraTri(px, py, pz + h) - muestraTri(px, py, pz - h);
      if (isNaN(gx) || isNaN(gy) || isNaN(gz)) {
        gx = muestra(px + voxel, py, pz) - muestra(px - voxel, py, pz);
        gy = muestra(px, py + voxel, pz) - muestra(px, py - voxel, pz);
        gz = muestra(px, py, pz + voxel) - muestra(px, py, pz - voxel);
      }
      if (isNaN(gx) || isNaN(gy) || isNaN(gz)) continue;
      const gl = Math.hypot(gx, gy, gz); if (gl < 1e-9) continue;
      Vm[k * 3] = px; Vm[k * 3 + 1] = py; Vm[k * 3 + 2] = pz;
      Nm[k * 3] = gx / gl; Nm[k * 3 + 1] = gy / gl; Nm[k * 3 + 2] = gz / gl;
      Mm[k] = 1; visibles++;
      // sombreado para la vista previa: luz desde la cámara
      const lum = Math.max(0, -(Nm[k * 3] * d[0] + Nm[k * 3 + 1] * d[1] + Nm[k * 3 + 2] * d[2]));
      const b = 60 + 195 * lum;
      img[k * 4] = b; img[k * 4 + 1] = b * 0.82; img[k * 4 + 2] = b * 0.55;
    }
    return visibles;
  }

  // ---------- ICP punto-a-plano contra el mapa del modelo (raycast en Rprev, tprev) ----------
  _icp() {
    const { fx, fy, cx, cy } = this.intr;
    const fxr = fx / ESC, fyr = fy / ESC, cxr = (cx + 0.5) / ESC - 0.5, cyr = (cy + 0.5) / ESC - 0.5;
    const Vf = this.Vf, Nf = this.Nf, Mf = this.Mf, Vm = this.Vm, Nm = this.Nm, Mm = this.Mm;
    let R = this.R.slice(), t = this.t.slice();
    const Rp = this.Rprev, tp = this.tprev;
    const A = new Float64Array(36), b = new Float64Array(6);
    const J = new Float64Array(6);
    let inliers = 0, validos = 0, residuo = 0;
    const distMax = Math.max(40, this.vol.voxel * 8), distMax2 = distMax * distMax, cosMin = Math.cos(35 * Math.PI / 180);
    const n = RED_W * RED_H;
    for (let it = 0; it < 10; it++) {
      A.fill(0); b.fill(0); inliers = 0; validos = 0; residuo = 0;
      const r0 = R[0], r1 = R[1], r2 = R[2], r3 = R[3], r4 = R[4], r5 = R[5], r6 = R[6], r7 = R[7], r8 = R[8];
      const tx = t[0], ty = t[1], tz = t[2];
      const p0 = Rp[0], p1 = Rp[1], p2 = Rp[2], p3 = Rp[3], p4 = Rp[4], p5 = Rp[5], p6 = Rp[6], p7 = Rp[7], p8 = Rp[8];
      for (let k = 0; k < n; k++) {
        if (!Mf[k]) continue;
        validos++;
        const k3 = k * 3;
        const vx = Vf[k3], vy = Vf[k3 + 1], vz = Vf[k3 + 2];
        const wx = r0 * vx + r1 * vy + r2 * vz + tx, wy = r3 * vx + r4 * vy + r5 * vz + ty, wz = r6 * vx + r7 * vy + r8 * vz + tz;
        // proyectar en la cámara anterior: pc = Rpᵀ (w − tp)
        const qx = wx - tp[0], qy = wy - tp[1], qz = wz - tp[2];
        const pz = p2 * qx + p5 * qy + p8 * qz;
        if (pz < 100) continue;
        const px = p0 * qx + p3 * qy + p6 * qz, py = p1 * qx + p4 * qy + p7 * qz;
        const u = Math.round(fxr * px / pz + cxr), v = Math.round(fyr * py / pz + cyr);
        if (u < 0 || v < 0 || u >= RED_W || v >= RED_H) continue;
        const m = v * RED_W + u;
        if (!Mm[m]) continue;
        const m3 = m * 3;
        const dx = Vm[m3] - wx, dy = Vm[m3 + 1] - wy, dz = Vm[m3 + 2] - wz;
        if (dx * dx + dy * dy + dz * dz > distMax2) continue;
        const nmx = Nm[m3], nmy = Nm[m3 + 1], nmz = Nm[m3 + 2];
        const nfx = Nf[k3], nfy = Nf[k3 + 1], nfz = Nf[k3 + 2];
        const nwx = r0 * nfx + r1 * nfy + r2 * nfz, nwy = r3 * nfx + r4 * nfy + r5 * nfz, nwz = r6 * nfx + r7 * nfy + r8 * nfz;
        if (nwx * nmx + nwy * nmy + nwz * nmz < cosMin) continue;
        const r = nmx * dx + nmy * dy + nmz * dz;
        J[0] = wy * nmz - wz * nmy; J[1] = wz * nmx - wx * nmz; J[2] = wx * nmy - wy * nmx; J[3] = nmx; J[4] = nmy; J[5] = nmz;
        const ar = Math.abs(r), w = ar < 10 ? 1 : 10 / ar;
        for (let a = 0; a < 6; a++) { const ja = w * J[a]; b[a] += ja * r; for (let c = a; c < 6; c++) A[a * 6 + c] += ja * J[c]; }
        inliers++; residuo += ar;
      }
      if (inliers < 200) break;
      for (let a = 0; a < 6; a++) for (let c = 0; c < a; c++) A[a * 6 + c] = A[c * 6 + a];
      for (let a = 0; a < 6; a++) A[a * 6 + a] += 1e-6;
      const x = resolver6(A, b);
      if (!x) break;
      const w = [x[0], x[1], x[2]], tau = [x[3], x[4], x[5]];
      const Rw = rodrigues(w);
      R = mulR(Rw, R);
      const tr = apR(Rw, t);
      t = [tr[0] + tau[0], tr[1] + tau[1], tr[2] + tau[2]];
      if (Math.hypot(w[0], w[1], w[2]) < 1e-4 && Math.hypot(tau[0], tau[1], tau[2]) < 0.1) break;
    }
    return { R, t, inliers, validos, residuo: inliers ? residuo / inliers : 0 };
  }

  // ---------- integración del cuadro en el volumen ----------
  _integrar(z, R, t) {
    const { vol, mu, intr } = this;
    const { nx, ny, nz, voxel, origen, tsdf, peso, visto, oculto } = vol;
    const { ancho: W, alto: H, fx, fy, cx, cy } = intr;
    // p_cam = Rᵀ (p_w − t)
    const r0 = R[0], r1 = R[3], r2 = R[6], r3 = R[1], r4 = R[4], r5 = R[7], r6 = R[2], r7 = R[5], r8 = R[8];
    let idx = 0;
    for (let k = 0; k < nz; k++) {
      const pz = origen[2] + k * voxel - t[2];
      for (let j = 0; j < ny; j++) {
        const py = origen[1] + j * voxel - t[1];
        for (let i = 0; i < nx; i++, idx++) {
          const px = origen[0] + i * voxel - t[0];
          const cz = r6 * px + r7 * py + r8 * pz;
          if (cz < 300) continue;
          const cxx = r0 * px + r1 * py + r2 * pz;
          const cyy = r3 * px + r4 * py + r5 * pz;
          const u = Math.round(fx * cxx / cz + cx), v = Math.round(fy * cyy / cz + cy);
          if (u < 0 || v < 0 || u >= W || v >= H) continue;
          visto[idx] = 1;
          const d = z[v * W + u];
          if (!(d > 0)) continue;
          const sdf = d - cz;
          if (sdf < -mu) { oculto[idx] = 1; continue; }
          const val = Math.min(sdf, mu) / mu;
          const w = peso[idx];
          tsdf[idx] = (tsdf[idx] * w + val) / (w + 1);
          peso[idx] = w < 40 ? w + 1 : 40;
        }
      }
    }
  }

  // ---------- un cuadro nuevo ----------
  procesar(z) {
    this.cuadros++;
    this._mapaCuadro(z);
    if (!this.hayModelo) {
      this._integrar(z, this.R, this.t);
      this.hayModelo = true;
      this.integrados = 1;
      this.Rprev = this.R.slice(); this.tprev = this.t.slice();
      this._raycast(this.R, this.t);
      this.calidad = { inliers: 0, validos: 0, residuo: 0, ok: true, primero: true };
      return this.estado();
    }
    // el raycast se hace desde la pose anterior; predicción de velocidad constante (amortiguada)
    const visibles = this._raycast(this.Rprev, this.tprev);
    if (this.Rant) {
      const dR = mulR(this.Rprev, [this.Rant[0], this.Rant[3], this.Rant[6], this.Rant[1], this.Rant[4], this.Rant[7], this.Rant[2], this.Rant[5], this.Rant[8]]);
      // media vuelta del giro anterior: interpolación burda por Rodrigues del ángulo
      const ang = Math.acos(Math.max(-1, Math.min(1, (dR[0] + dR[4] + dR[8] - 1) / 2)));
      if (ang < 0.3) {
        const eje = ang > 1e-6 ? [(dR[7] - dR[5]) / (2 * Math.sin(ang)), (dR[2] - dR[6]) / (2 * Math.sin(ang)), (dR[3] - dR[1]) / (2 * Math.sin(ang))] : [0, 0, 0];
        const Rh = rodrigues([eje[0] * ang * 0.5, eje[1] * ang * 0.5, eje[2] * ang * 0.5]);
        this.R = mulR(Rh, this.Rprev);
        const dt = [this.tprev[0] - this.tant[0], this.tprev[1] - this.tant[1], this.tprev[2] - this.tant[2]];
        this.t = [this.tprev[0] + dt[0] * 0.5, this.tprev[1] + dt[1] * 0.5, this.tprev[2] + dt[2] * 0.5];
      } else { this.R = this.Rprev.slice(); this.t = this.tprev.slice(); }
    } else { this.R = this.Rprev.slice(); this.t = this.tprev.slice(); }
    const res = this._icp();
    const ok = visibles > 300 && res.inliers >= 400 && res.inliers >= 0.4 * visibles && res.residuo < Math.max(6, this.vol.voxel * 1.5);
    this.calidad = { inliers: res.inliers, validos: res.validos, residuo: res.residuo, visibles, ok };
    if (ok) {
      this.Rant = this.Rprev; this.tant = this.tprev;
      this.R = res.R; this.t = res.t;
      this._integrar(z, this.R, this.t);
      this.integrados++;
      this.seguidos = 0;
      this.Rprev = this.R.slice(); this.tprev = this.t.slice();
    } else {
      this.perdidos++; this.seguidos++;
      this.R = this.Rprev.slice(); this.t = this.tprev.slice();
      this.Rant = null; this.tant = null;
    }
    return this.estado();
  }

  estado() {
    return { cuadros: this.cuadros, integrados: this.integrados, perdidos: this.perdidos, seguidos: this.seguidos, calidad: this.calidad, R: this.R.slice(), t: this.t.slice(), imagen: this.imagen, ancho: RED_W, alto: RED_H };
  }

  // Esquinas del volumen proyectadas en la imagen completa con la pose actual (para dibujarlo encima).
  proyectarVolumen() {
    const { vol } = this; const { fx, fy, cx, cy } = this.intr;
    const { nx, ny, nz, voxel, origen } = vol;
    const esq = [];
    for (const [a, b, c] of [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1], [0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]]) {
      const pw = [origen[0] + a * (nx - 1) * voxel, origen[1] + b * (ny - 1) * voxel, origen[2] + c * (nz - 1) * voxel];
      const pc = apRt(this.R, [pw[0] - this.t[0], pw[1] - this.t[1], pw[2] - this.t[2]]);
      esq.push(pc[2] > 50 ? [fx * pc[0] / pc[2] + cx, fy * pc[1] / pc[2] + cy] : null);
    }
    const segs = [];
    const ar = (i, j) => { if (esq[i] && esq[j]) segs.push([esq[i], esq[j]]); };
    for (let i = 0; i < 4; i++) { ar(i, (i + 1) % 4); ar(4 + i, 4 + (i + 1) % 4); ar(i, 4 + i); }
    return segs;
  }

  // ---------- malla final ----------
  malla(opciones = {}) {
    const F = N.campoFinal(this.vol, { relleno: opciones.relleno || 'solido' });
    let m = N.extraerMalla(F, this.vol);
    const info = { componentes: 1 };
    if (m.idx.length) {
      if (opciones.mayorComponente !== false) { m = N.mayorComponente(m); info.componentes = m.componentes; }
      if (opciones.suavizado) m = N.suavizar(m, opciones.suavizado);
      if (opciones.reducir) m = N.reducir(m, opciones.reducir * this.vol.voxel);
      if (opciones.escala && opciones.escala !== 1) m = N.escalar(m, opciones.escala);
    }
    return { malla: m, info, voxel: this.vol.voxel };
  }

  reiniciar() {
    const { tsdf, peso, visto, oculto, superficie } = this.vol;
    tsdf.fill(0); peso.fill(0); visto.fill(0); oculto.fill(0); superficie.fill(0);
    this.R = [-1, 0, 0, 0, -1, 0, 0, 0, 1]; this.t = [0, 0, -this.distancia];
    this.Rprev = this.R.slice(); this.tprev = this.t.slice(); this.Rant = null; this.tant = null;
    this.cuadros = 0; this.integrados = 0; this.perdidos = 0; this.seguidos = 0; this.hayModelo = false;
  }
}

// ============================================================
// Web Worker
// ============================================================

if (typeof self !== 'undefined' && typeof window === 'undefined' && typeof self.postMessage === 'function') {
  let escaner = null;
  self.onmessage = (ev) => {
    const m = ev.data;
    try {
      if (m.tipo === 'iniciar') {
        escaner = new EscanerLibre(m.opciones || {});
        self.postMessage({ tipo: 'listo', voxel: escaner.vol.voxel, nodos: escaner.vol.nodos });
      } else if (m.tipo === 'cuadro' && escaner) {
        const est = escaner.procesar(m.z);
        const segs = escaner.proyectarVolumen();
        const img = new Uint8ClampedArray(est.imagen);
        self.postMessage({ tipo: 'estado', ...est, imagen: img, segmentos: segs }, [img.buffer]);
      } else if (m.tipo === 'malla' && escaner) {
        const r = escaner.malla(m.opciones || {});
        self.postMessage({ tipo: 'malla', pos: r.malla.pos, idx: r.malla.idx, info: r.info, voxel: r.voxel, integrados: escaner.integrados }, [r.malla.pos.buffer, r.malla.idx.buffer]);
      } else if (m.tipo === 'reiniciar' && escaner) {
        escaner.reiniciar();
        self.postMessage({ tipo: 'reiniciado' });
      }
    } catch (e) {
      self.postMessage({ tipo: 'error', mensaje: e.message });
    }
  };
}
