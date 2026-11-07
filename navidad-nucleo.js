// Adornos de Navidad — núcleo del globo redondo (sin DOM; corre en un Web Worker).
//
// El globo es un cuerpo de revolución (bola, gota, cebolla o cono) con una
// textura opcional (costillas, espiral, facetas, hoyuelos), el nombre y un
// motivo en relieve o grabados sobre el frente, y arriba un cuello para el
// capuchón metálico o una argolla para colgar. Sale en dos mitades (frente y
// dorso) partidas por el plano x = 0, con agujeros para pernos de filamento.
//
// Todo son campos de distancia sobre una grilla de vóxeles (ver moldes-nucleo.js):
// el perfil de revolución se precalcula en 2D (ρ, z); la decoración llega como
// una máscara 2D del frente «desenrollado» (u = arco, v = altura) y se
// convierte en distancia 2D para que las letras salgan con bordes limpios.

import { crearGrilla, evaluar, mallaDeCampo, edt3d, sdfCilindroZ } from './moldes-nucleo.js';

// ============================================================
// Perfiles de revolución: [[ρ, z], …] de abajo (z = 0) hacia arriba
// ============================================================

export function perfil(forma, D) {
  const R = D / 2;
  const pts = [];
  const n = 72;
  let H;
  if (forma === 'bola') {
    H = D;
    for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + Math.PI * i / n; pts.push([R * Math.cos(a), R + R * Math.sin(a)]); }
  } else if (forma === 'gota') {
    H = 1.45 * D;                                  // punta abajo, panza arriba
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([R * Math.pow(Math.sin(Math.PI * Math.pow(t, 1.45)), 0.85), t * H]); }
  } else if (forma === 'cebolla') {
    H = 1.3 * D;                                   // panza abajo, punta arriba
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([R * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.9), t * H]); }
  } else {
    H = 1.25 * D;                                  // cono: punta abajo, hombros redondeados arriba
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const r = t < 0.78 ? R * Math.sin(Math.PI / 2 * t / 0.78) : R * Math.cos(Math.PI / 2 * (t - 0.78) / 0.22);
      pts.push([r, t * H]);
    }
  }
  pts[0][0] = 0; pts[n][0] = 0;
  // centro de la decoración: la altura de mayor radio
  let zc = 0, rMax = 0;
  for (const p of pts) if (p[0] > rMax) { rMax = p[0]; zc = p[1]; }
  return { pts, H, R, zc, rMax };
}

// Distancia con signo 2D al polígono cerrado (perfil + eje), sobre una grilla (ρ, z).
function campoPerfil(per, paso, margen) {
  const poly = per.pts.slice();                   // cerrado por el eje ρ = 0 (de arriba a abajo)
  poly.push([0, per.H + 1e-6]); poly.push([0, -1e-6]);
  const nr = Math.ceil((per.rMax + margen) / paso) + 1;
  const nz = Math.ceil((per.H + 2 * margen) / paso) + 1;
  const z0 = -margen;
  const F = new Float32Array(nr * nz);
  const N = poly.length;
  for (let j = 0; j < nz; j++) {
    const z = z0 + j * paso;
    for (let i = 0; i < nr; i++) {
      const r = i * paso;
      let d2 = Infinity, dentro = false;
      for (let k = 0, m = N - 1; k < N; m = k++) {
        const a = poly[k], b = poly[m];
        // distancia al segmento
        const ex = b[0] - a[0], ez = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((r - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez || 1e-12)));
        const dx = r - (a[0] + t * ex), dz = z - (a[1] + t * ez);
        const dd = dx * dx + dz * dz;
        if (dd < d2) d2 = dd;
        // paridad (ρ negativo nunca pasa: el eje cierra el polígono)
        if ((a[1] > z) !== (b[1] > z) && r < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) dentro = !dentro;
      }
      F[i + j * nr] = (dentro ? -1 : 1) * Math.sqrt(d2);
    }
  }
  return { F, nr, nz, paso, z0 };
}

function muestrear2D(F, nx, ny, fx, fy, fuera) {
  if (fx < 0 || fy < 0 || fx > nx - 1 || fy > ny - 1) return fuera;
  const i = Math.min(nx - 2, Math.floor(fx)), j = Math.min(ny - 2, Math.floor(fy));
  const tx = fx - i, ty = fy - j;
  const a = F[i + j * nx], b = F[i + 1 + j * nx], c = F[i + (j + 1) * nx], d = F[i + 1 + (j + 1) * nx];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

// ============================================================
// Máscara de decoración → distancia 2D en mm
// ============================================================

// mascara: { datos: Uint8Array (1 = tinta), w, h, pxPorMm, u0, v0 } con u hacia la
// derecha y v hacia abajo del lienzo (v0 = v del borde superior).
function campoMascara(mascara) {
  const { datos, w, h, pxPorMm } = mascara;
  const inv = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) inv[i] = datos[i] ? 0 : 1;
  const dIn = edt3d(datos, w, h, 1), dOut = edt3d(inv, w, h, 1);
  const F = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) F[i] = (datos[i] ? -Math.max(0.5, dOut[i] - 0.5) : Math.max(0.5, dIn[i] - 0.5)) / pxPorMm;
  return F;
}

// ============================================================
// Armado del globo
// ============================================================

export function generarGlobo(op, mascara, progreso = () => {}) {
  const per = perfil(op.forma, op.diametro);
  const { R, H, zc } = per;
  progreso('Perfil…');
  const PP = campoPerfil(per, 0.1, 6);
  const alturaTope = H + (op.tope === 'cuello' ? 9 : op.tope === 'argolla' ? 11 : 0);
  const margen = 3;
  const g = crearGrilla([-R - margen, -R - margen, -margen], [R + margen, R + margen, alturaTope + margen], op.maxNodos);
  progreso(`Vóxeles ${g.nx}×${g.ny}×${g.nz} (${g.voxel.toFixed(2)} mm)…`);

  const M = mascara && mascara.w ? campoMascara(mascara) : null;
  const decor = (x, y, z) => {
    if (!M) return 10;
    const th = Math.atan2(y, x);
    const u = R * th;
    const v = op.forma === 'bola' ? R * Math.asin(Math.max(-1, Math.min(1, (z - zc) / R))) : z - zc;
    const fx = (u - mascara.u0) * mascara.pxPorMm, fy = (mascara.v0 - v) * mascara.pxPorMm;
    return muestrear2D(M, mascara.w, mascara.h, fx, fy, 10);
  };

  const n = op.texturaN || 12, prof = op.texturaProf || 1;
  const cuerpoLiso = (x, y, z) => {
    const rho = Math.hypot(x, y);
    let r = rho;
    if (op.textura === 'facetas') {
      const th = Math.atan2(y, x), paso = 2 * Math.PI / n;
      const t = ((th % paso) + paso) % paso;
      r = rho * Math.cos(t - paso / 2) / Math.cos(paso / 2);
    }
    let d = muestrear2D(PP.F, PP.nr, PP.nz, r / PP.paso, (z - PP.z0) / PP.paso, 10);
    const th = Math.atan2(y, x);
    const peso = Math.min(1, rho / (0.35 * R));                       // la textura se apaga en los polos
    if (op.textura === 'costillas') d += prof * 0.5 * (1 - Math.cos(n * th)) * peso;
    else if (op.textura === 'espiral') d += prof * 0.5 * (1 - Math.cos(n * th + 2 * Math.PI * 2 * (z - zc) / H)) * peso;
    else if (op.textura === 'hoyuelos') {
      const v = z - zc;
      d += prof * Math.max(0, Math.cos(n * th)) * Math.max(0, Math.cos(n * v / R)) * peso;
    }
    return d;
  };

  const rCuello = op.cuelloDiam / 2;
  const zTope = H;
  const cuerpo = (x, y, z) => {
    let d = cuerpoLiso(x, y, z);
    if (op.hueco) d = Math.max(d, -(d + op.pared));                   // cáscara
    if (op.tope === 'cuello') {
      const tubo = sdfCilindroZ(x, y, z, 0, 0, rCuello + 1.6, zTope - 4, zTope + 8);
      d = Math.min(d, tubo);
    } else if (op.tope === 'argolla') {
      const zl = zTope + 5;
      const anillo = Math.hypot(Math.hypot(y, z - zl) - 5, x) - 1.7;
      d = Math.min(d, anillo);
    }
    // nombre y motivo
    if (M) {
      const m = decor(x, y, z);
      if (op.estilo === 'grabado') {
        const base = cuerpoLiso(x, y, z);
        d = Math.max(d, -Math.max(m, -(base + op.relieve)));
      } else {
        const base = cuerpoLiso(x, y, z);
        d = Math.min(d, Math.max(m, base - op.relieve, -(base + 0.6)));
      }
    }
    if (op.tope === 'cuello') {
      const taladro = sdfCilindroZ(x, y, z, 0, 0, rCuello, zTope - 10, zTope + 9);
      d = Math.max(d, -taladro);
    }
    return d;
  };

  progreso('Cuerpo…');
  const campo = evaluar(g, (i, x, y, z) => cuerpo(x, y, z));

  // posiciones de los pernos en el plano x = 0: (y, z) sobre el perfil, metidos «inset»
  const rhoEn = (t) => per.pts[Math.round(t * (per.pts.length - 1))];
  const inset = op.hueco ? op.pared / 2 : 3.5;
  const pernos = [];
  if (op.hueco) {
    for (const t of [0.4, 0.75]) { const p = rhoEn(t); pernos.push([p[0] - inset, p[1]], [-(p[0] - inset), p[1]]); }
  } else {
    const p = rhoEn(0.5);
    pernos.push([p[0] - inset, p[1]], [-(p[0] - inset), p[1]], [0, inset + 1.5]);
  }
  const rPerno = 0.95;
  const conAgujeros = (x, y, z, d) => {
    for (const p of pernos) {
      const hueco = Math.max(Math.hypot(y - p[0], z - p[1]) - rPerno, Math.abs(x) - 3);
      d = Math.max(d, -hueco);
    }
    return d;
  };
  progreso('Mitades…');
  const frente = evaluar(g, (i, x, y, z) => conAgujeros(x, y, z, Math.max(campo[i], -x)));
  const dorso = evaluar(g, (i, x, y, z) => conAgujeros(x, y, z, Math.max(campo[i], x)));

  const partes = [];
  const extraer = (F, nombre, color, extra) => {
    progreso(`Malla: ${nombre}…`);
    const m = mallaDeCampo(F, g, op.maxTriangulos);
    if (!m.idx.length) return;
    partes.push(Object.assign({ nombre, pos: m.pos, idx: m.idx, color, triangulos: m.idx.length / 3 }, extra || {}));
  };
  extraer(frente, 'Mitad del frente', op.colorCuerpo, { lado: 'frente' });
  extraer(dorso, 'Mitad del dorso', op.colorCuerpo, { lado: 'dorso' });
  // el nombre y el motivo en relieve como pieza aparte (para el 3MF de dos colores)
  if (M && op.estilo !== 'grabado') {
    const nombreF = evaluar(g, (i, x, y, z) => {
      const base = cuerpoLiso(x, y, z);
      return Math.max(decor(x, y, z), base - op.relieve, -(base + 0.6), -x);
    });
    extraer(nombreF, 'Nombre y motivo (frente)', op.colorNombre, { lado: 'frente', decoracion: true });
  }
  // el globo macizo entero, para llevarlo a la página de moldes (sin pernos ni argolla)
  if (op.conMacizo) {
    const macizo = evaluar(g, (i, x, y, z) => {
      let d = cuerpoLiso(x, y, z);
      if (M) {
        const m = decor(x, y, z);
        if (op.estilo === 'grabado') d = Math.max(d, -Math.max(m, -(d + op.relieve)));
        else d = Math.min(d, Math.max(m, d - op.relieve, -(d + 0.6)));
      }
      if (op.tope === 'cuello') d = Math.min(d, sdfCilindroZ(x, y, z, 0, 0, rCuello + 1.6, zTope - 4, zTope + 8));
      return d;
    });
    extraer(macizo, 'Globo macizo entero', op.colorCuerpo, { lado: 'entero' });
  }
  // volumen (mm³) de las mitades, para estimar el filamento
  let volumen = 0;
  for (let i = 0; i < g.nodos; i++) if (campo[i] < 0) volumen++;
  volumen *= g.voxel ** 3;
  return { partes, info: { voxel: g.voxel, alto: alturaTope, diametro: op.diametro, volumenCm3: volumen / 1000, pernos: pernos.length } };
}
