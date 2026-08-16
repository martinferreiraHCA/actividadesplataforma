// Motor de "Diseño 3D con papel": despliega una malla 3D en piezas planas
// para imprimir, recortar, doblar y pegar. Mismo enfoque que el programa
// dxf2papercraft (Thomas Haenselmann, GPL): se recorre la malla con un árbol
// de expansión abatiendo cada cara sobre el plano; donde el patrón se corta,
// se generan pestañas de pegado numeradas para saber qué borde va con cuál.
// Implementación propia en JavaScript para correr en el navegador.
//
//   desplegarModelo(triangulos, opciones) → { piezas, paginas, avisos, stats }
//
// opciones:
//   escala        factor unidad-del-modelo → mm (obligatorio)
//   anchoUtilMm   ancho imprimible de la hoja (defecto 190)
//   altoUtilMm    alto imprimible de la hoja (defecto 277)
//   pestanas      true/false (defecto true)
//   altoPestanaMm alto de las pestañas (defecto 8)
//   numerar       numera los bordes que se pegan entre sí (defecto true)

const EPS = 1e-7;
const COPLANAR_RAD = 0.02; // ~1.1°: caras casi coplanares no llevan línea de pliegue

// ---------- vectores ----------
const resta = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const largo = a => Math.sqrt(punto(a, a));
const dist3 = (a, b) => largo(resta(a, b));

// ---------- malla soldada ----------
function soldarMalla(triangulos, escala) {
  const claves = new Map();
  const verts = [];
  const caras = [];
  const indice = p => {
    const k = p.map(v => Math.round(v * 1e5) / 1e5).join(',');
    if (!claves.has(k)) {
      claves.set(k, verts.length);
      verts.push([p[0] * escala, p[1] * escala, p[2] * escala]);
    }
    return claves.get(k);
  };
  for (const t of triangulos) {
    const c = [indice(t[0]), indice(t[1]), indice(t[2])];
    if (c[0] === c[1] || c[1] === c[2] || c[0] === c[2]) continue; // degenerado
    caras.push(c);
  }
  // normales y descarte de triángulos de área ~0
  const normales = [];
  const carasOk = [];
  for (const c of caras) {
    const n = cruz(resta(verts[c[1]], verts[c[0]]), resta(verts[c[2]], verts[c[0]]));
    const l = largo(n);
    if (l < EPS) continue;
    carasOk.push(c);
    normales.push([n[0] / l, n[1] / l, n[2] / l]);
  }
  return { verts, caras: carasOk, normales };
}

// aristas: clave "i_j" (i<j) → [{cara, lado}]
function armarAristas(caras) {
  const aristas = new Map();
  caras.forEach((c, fi) => {
    for (let lado = 0; lado < 3; lado++) {
      const a = c[lado], b = c[(lado + 1) % 3];
      const k = a < b ? a + '_' + b : b + '_' + a;
      if (!aristas.has(k)) aristas.set(k, []);
      aristas.get(k).push({ cara: fi, lado });
    }
  });
  return aristas;
}

// ---------- geometría 2D ----------
const d2 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const ladoDe = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);

function segmentosSeCruzan(p1, p2, p3, p4) {
  const d1 = ladoDe(p3, p4, p1), d2_ = ladoDe(p3, p4, p2);
  const d3 = ladoDe(p1, p2, p3), d4 = ladoDe(p1, p2, p4);
  return ((d1 > EPS && d2_ < -EPS) || (d1 < -EPS && d2_ > EPS)) &&
    ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS));
}

function puntoEnTriangulo(p, t) {
  const s1 = ladoDe(t[0], t[1], p), s2 = ladoDe(t[1], t[2], p), s3 = ladoDe(t[2], t[0], p);
  const neg = s1 < -EPS || s2 < -EPS || s3 < -EPS;
  const pos = s1 > EPS || s2 > EPS || s3 > EPS;
  return !(neg && pos);
}

function encogerTriangulo(t, f) {
  const cx = (t[0][0] + t[1][0] + t[2][0]) / 3;
  const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
  return t.map(p => [cx + (p[0] - cx) * f, cy + (p[1] - cy) * f]);
}

function triangulosSeSolapan(a, b) {
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    if (segmentosSeCruzan(a[i], a[(i + 1) % 3], b[j], b[(j + 1) % 3])) return true;
  }
  if (puntoEnTriangulo(a[0], b) || puntoEnTriangulo(b[0], a)) return true;
  return false;
}

// abate el tercer vértice de la cara vecina al plano: A2,B2 son la arista ya
// colocada; el nuevo punto va del lado contrario a `referencia`
function abatirPunto(A2, B2, dA, dB, referencia) {
  const d = d2(A2, B2);
  if (d < EPS) return null;
  const ux = (B2[0] - A2[0]) / d, uy = (B2[1] - A2[1]) / d;
  const x = (dA * dA - dB * dB + d * d) / (2 * d);
  const h2 = dA * dA - x * x;
  const h = h2 > 0 ? Math.sqrt(h2) : 0;
  const bx = A2[0] + ux * x, by = A2[1] + uy * x;
  const c1 = [bx - uy * h, by + ux * h];
  const c2 = [bx + uy * h, by - ux * h];
  if (referencia == null) return c1;
  const ladoRef = ladoDe(A2, B2, referencia);
  return (ladoDe(A2, B2, c1) * ladoRef <= 0) ? c1 : c2;
}

// ============================================================
// Despliegue
// ============================================================
export function desplegarModelo(triangulos, opciones) {
  const op = Object.assign({
    anchoUtilMm: 190, altoUtilMm: 277,
    pestanas: true, altoPestanaMm: 8, numerar: true
  }, opciones || {});
  if (!op.escala || !(op.escala > 0)) throw new Error('Falta la escala del modelo.');

  const avisos = [];
  const { verts, caras, normales } = soldarMalla(triangulos, op.escala);
  if (!caras.length) throw new Error('El modelo no tiene caras con área (¿todas degeneradas?).');
  if (caras.length > 4000) {
    throw new Error(`El modelo tiene ${caras.length} caras: demasiado detalle para armarlo en papel. Simplificalo a menos de 4000 caras (en Tinkercad o Blender con "Decimate").`);
  }
  const aristas = armarAristas(caras);

  // vecinos por cara: [{cara, vecino, arista(k), angulo, convexa}]
  const vecinos = caras.map(() => []);
  aristas.forEach((lista, k) => {
    if (lista.length > 2) avisos.push('El modelo tiene bordes donde se juntan más de 2 caras (no es una superficie simple): esas uniones salen como corte.');
    if (lista.length !== 2) return;
    const [x, y] = lista;
    const cosang = Math.max(-1, Math.min(1, punto(normales[x.cara], normales[y.cara])));
    const angulo = Math.acos(cosang);
    // convexa (montaña): el tercer vértice del vecino queda "debajo" de la cara
    const c2 = caras[y.cara];
    const enArista = new Set(k.split('_').map(Number));
    const tercero = c2.find(v => !enArista.has(v));
    const medio = k.split('_').map(Number).map(i => verts[i]);
    const m = [(medio[0][0] + medio[1][0]) / 2, (medio[0][1] + medio[1][1]) / 2, (medio[0][2] + medio[1][2]) / 2];
    const convexa = punto(normales[x.cara], resta(verts[tercero], m)) < 0;
    vecinos[x.cara].push({ cara: x.cara, vecino: y.cara, arista: k, angulo, convexa });
    vecinos[y.cara].push({ cara: y.cara, vecino: x.cara, arista: k, angulo, convexa });
  });

  // margen alrededor de cada pieza para pestañas y números
  const margenPieza = (op.pestanas ? op.altoPestanaMm : 0) + 4;
  const maxAncho = op.anchoUtilMm - 2 * margenPieza;
  const maxAlto = op.altoUtilMm - 2 * margenPieza;

  // El despliegue se corre con dos criterios para elegir la próxima cara
  // (menor crecimiento de la caja, o menor ángulo de pliegue) y se queda con
  // el que produce menos piezas: ninguna heurística gana siempre.
  function desplegarCon(criterio) {
  const colocadaEn = new Array(caras.length).fill(-1); // cara → pieza
  const piezas = [];

  for (let semilla = 0; semilla < caras.length; semilla++) {
    if (colocadaEn[semilla] !== -1) continue;
    const pieza = {
      caras: new Map(),      // cara → [p0,p1,p2] en 2D (orden de caras[f])
      plegadas: new Set(),   // claves de arista abatidas (pliegues)
      id: piezas.length
    };
    piezas.push(pieza);

    // primera cara: apoyada en el plano
    const c0 = caras[semilla];
    const A = verts[c0[0]], B = verts[c0[1]], C = verts[c0[2]];
    const A2 = [0, 0];
    const B2 = [dist3(A, B), 0];
    const C2 = abatirPunto(A2, B2, dist3(A, C), dist3(B, C), null);
    pieza.caras.set(semilla, [A2, B2, C2]);
    colocadaEn[semilla] = pieza.id;

    let minX = Math.min(A2[0], B2[0], C2[0]), maxX = Math.max(A2[0], B2[0], C2[0]);
    let minY = Math.min(A2[1], B2[1], C2[1]), maxY = Math.max(A2[1], B2[1], C2[1]);

    // frontera: en cada paso se elige el candidato que menos agranda la caja
    // de la pieza (favorece despliegues compactos que entran en la hoja)
    const cola = [];
    const meter = f => {
      for (const v of vecinos[f]) {
        if (colocadaEn[v.vecino] === -1) cola.push(v);
      }
    };
    meter(semilla);

    // abate el tercero del vecino v sobre el plano; null si no se puede
    const colocar = v => {
      const tri2dOrigen = pieza.caras.get(v.cara);
      if (!tri2dOrigen) return null;
      const [ia, ib] = v.arista.split('_').map(Number);
      const cV = caras[v.vecino];
      const tercero = cV.find(x => x !== ia && x !== ib);
      const cO = caras[v.cara];
      const pos2d = i => tri2dOrigen[cO.indexOf(i)];
      const A2v = pos2d(ia), B2v = pos2d(ib);
      if (!A2v || !B2v) return null;
      const refTercero = cO.find(x => x !== ia && x !== ib);
      const T2 = abatirPunto(A2v, B2v, dist3(verts[ia], verts[tercero]), dist3(verts[ib], verts[tercero]), pos2d(refTercero));
      if (!T2) return null;
      return cV.map(x => x === ia ? A2v : (x === ib ? B2v : T2));
    };

    while (cola.length) {
      // candidatos vigentes, ordenados por crecimiento de la caja y ángulo
      const evaluados = [];
      for (const v of cola) {
        if (colocadaEn[v.vecino] !== -1) continue;
        const nuevo2d = colocar(v);
        if (!nuevo2d) continue;
        const nMinX = Math.min(minX, ...nuevo2d.map(p => p[0]));
        const nMaxX = Math.max(maxX, ...nuevo2d.map(p => p[0]));
        const nMinY = Math.min(minY, ...nuevo2d.map(p => p[1]));
        const nMaxY = Math.max(maxY, ...nuevo2d.map(p => p[1]));
        const entra = (nMaxX - nMinX <= maxAncho && nMaxY - nMinY <= maxAlto) ||
          (nMaxX - nMinX <= maxAlto && nMaxY - nMinY <= maxAncho); // se puede girar 90°
        if (!entra) continue;
        const crecimiento = (nMaxX - nMinX) * (nMaxY - nMinY) - (maxX - minX) * (maxY - minY);
        evaluados.push({ v, nuevo2d, bb: [nMinX, nMaxX, nMinY, nMaxY], crecimiento });
      }
      if (!evaluados.length) break; // el resto queda para otras piezas
      evaluados.sort(criterio);

      let colocado = false;
      for (const e of evaluados.slice(0, 15)) { // tope de intentos por paso (costo acotado)
        const candidato = encogerTriangulo(e.nuevo2d, 0.995);
        let choca = false;
        for (const t of pieza.caras.values()) {
          if (triangulosSeSolapan(candidato, encogerTriangulo(t, 0.995))) { choca = true; break; }
        }
        if (choca) continue;
        pieza.caras.set(e.v.vecino, e.nuevo2d);
        pieza.plegadas.add(e.v.arista);
        colocadaEn[e.v.vecino] = pieza.id;
        [minX, maxX, minY, maxY] = e.bb;
        cola.splice(cola.indexOf(e.v), 1);
        meter(e.v.vecino);
        colocado = true;
        break;
      }
      if (!colocado) break; // todos chocan: lo que falta va en otras piezas
    }
  }
  return { piezas, colocadaEn };
  }

  const porCaja = desplegarCon((a, b) => a.crecimiento - b.crecimiento || a.v.angulo - b.v.angulo);
  const porAngulo = desplegarCon((a, b) => a.v.angulo - b.v.angulo || a.crecimiento - b.crecimiento);
  const mejor = porAngulo.piezas.length < porCaja.piezas.length ? porAngulo : porCaja;
  const piezas = mejor.piezas;
  const colocadaEn = mejor.colocadaEn;

  // ---------- bordes de cada pieza: pliegues y cortes ----------
  let siguienteNumero = 1;
  const numeroDeArista = new Map(); // arista → número de unión

  const piezasSalida = piezas.map(pieza => {
    const montanas = [], valles = [], cortes = [], pestanas = [], etiquetas = [];
    const vistos = new Set();

    pieza.caras.forEach((tri2d, f) => {
      const c = caras[f];
      for (let lado = 0; lado < 3; lado++) {
        const a = c[lado], b = c[(lado + 1) % 3];
        const k = a < b ? a + '_' + b : b + '_' + a;
        if (vistos.has(k + '@' + f)) continue;
        const P = tri2d[lado], Q = tri2d[(lado + 1) % 3];
        const info = (vecinos[f] || []).find(v => v.arista === k);

        if (info && pieza.plegadas.has(k) && pieza.caras.has(info.vecino)) {
          // pliegue interno (una sola vez por arista)
          if (!vistos.has(k)) {
            vistos.add(k);
            if (info.angulo > COPLANAR_RAD) (info.convexa ? montanas : valles).push([P, Q]);
          }
          continue;
        }

        // corte
        cortes.push([P, Q]);
        if (info && colocadaEn[info.vecino] !== -1) {
          // esta arista se pega con su gemela en otra pieza (o en esta):
          if (!numeroDeArista.has(k)) {
            numeroDeArista.set(k, { n: siguienteNumero++, conPestana: pieza.id });
          }
          const reg = numeroDeArista.get(k);
          const mx = (P[0] + Q[0]) / 2, my = (P[1] + Q[1]) / 2;
          // normal exterior 2D (opuesta al tercer vértice)
          const otro = tri2d[(lado + 2) % 3];
          let nx = Q[1] - P[1], ny = P[0] - Q[0];
          const ln = Math.hypot(nx, ny) || 1;
          nx /= ln; ny /= ln;
          if ((otro[0] - mx) * nx + (otro[1] - my) * ny > 0) { nx = -nx; ny = -ny; }

          if (op.pestanas && reg.conPestana === pieza.id && reg.pieza === undefined) {
            reg.pieza = pieza.id;
            // pestaña trapezoidal hacia afuera
            const len = Math.hypot(Q[0] - P[0], Q[1] - P[1]);
            const h = Math.min(op.altoPestanaMm, len * 0.45);
            const inset = Math.min(h * 0.6, len * 0.3);
            const ux = (Q[0] - P[0]) / len, uy = (Q[1] - P[1]) / len;
            pestanas.push([
              [P[0], P[1]],
              [P[0] + ux * inset + nx * h, P[1] + uy * inset + ny * h],
              [Q[0] - ux * inset + nx * h, Q[1] - uy * inset + ny * h],
              [Q[0], Q[1]]
            ]);
            if (op.numerar) etiquetas.push({ x: mx + nx * h * 0.55, y: my + ny * h * 0.55, texto: String(reg.n) });
            // el borde con pestaña se dobla, no se corta: lo pasamos a valle
            cortes.pop();
            valles.push([P, Q]);
          } else if (op.numerar) {
            etiquetas.push({ x: mx - nx * 3.2, y: my - ny * 3.2, texto: String(reg.n) });
          }
        }
      }
    });

    return { id: pieza.id, nCaras: pieza.caras.size, montanas, valles, cortes, pestanas, etiquetas };
  });

  // ---------- acomodo en páginas ----------
  const paginas = acomodarEnPaginas(piezasSalida, op, margenPieza);

  const stats = {
    caras: caras.length,
    piezas: piezasSalida.length,
    uniones: siguienteNumero - 1,
    paginas: paginas.length
  };
  if (piezasSalida.length > 40) {
    avisos.push(`El patrón quedó en ${piezasSalida.length} piezas: para un armado más simple, probá con un modelo menos detallado o más grande.`);
  }
  return { piezas: piezasSalida, paginas, avisos: Array.from(new Set(avisos)), stats };
}

// bbox de una pieza con todo incluido
function bboxPieza(p) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const ver = (x, y) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  };
  for (const grupo of [p.montanas, p.valles, p.cortes]) {
    for (const [a, b] of grupo) { ver(a[0], a[1]); ver(b[0], b[1]); }
  }
  for (const poli of p.pestanas) for (const q of poli) ver(q[0], q[1]);
  for (const e of p.etiquetas) ver(e.x, e.y);
  return { minX, minY, maxX, maxY };
}

function rotarPieza(p) {
  const rot = ([x, y]) => [-y, x];
  ['montanas', 'valles', 'cortes'].forEach(kk => {
    p[kk] = p[kk].map(([a, b]) => [rot(a), rot(b)]);
  });
  p.pestanas = p.pestanas.map(poli => poli.map(rot));
  p.etiquetas = p.etiquetas.map(e => { const [x, y] = rot([e.x, e.y]); return { x, y, texto: e.texto }; });
}

function trasladarPieza(p, dx, dy) {
  const mov = ([x, y]) => [x + dx, y + dy];
  ['montanas', 'valles', 'cortes'].forEach(kk => {
    p[kk] = p[kk].map(([a, b]) => [mov(a), mov(b)]);
  });
  p.pestanas = p.pestanas.map(poli => poli.map(mov));
  p.etiquetas = p.etiquetas.map(e => ({ x: e.x + dx, y: e.y + dy, texto: e.texto }));
}

// estantería simple: piezas ordenadas por alto, filas de izquierda a derecha
function acomodarEnPaginas(piezas, op, sep) {
  const lista = piezas.map(p => ({ p, bb: bboxPieza(p) }));
  for (const it of lista) {
    // girar 90° si la pieza es más alta que ancha (aprovecha mejor la hoja)
    const w = it.bb.maxX - it.bb.minX, h = it.bb.maxY - it.bb.minY;
    if ((h > op.altoUtilMm - 2 * sep || h > w * 1.6) && w <= op.altoUtilMm - 2 * sep && h <= op.anchoUtilMm - 2 * sep && h > w) {
      rotarPieza(it.p);
      it.bb = bboxPieza(it.p);
    }
  }
  lista.sort((a, b) => (b.bb.maxY - b.bb.minY) - (a.bb.maxY - a.bb.minY));

  const paginas = [];
  let pag = null, x = 0, y = 0, altoFila = 0;
  const nueva = () => { pag = { piezas: [] }; paginas.push(pag); x = sep; y = sep; altoFila = 0; };
  nueva();
  for (const it of lista) {
    const w = it.bb.maxX - it.bb.minX, h = it.bb.maxY - it.bb.minY;
    if (x + w > op.anchoUtilMm - sep + EPS && x > sep) { x = sep; y += altoFila + sep; altoFila = 0; }
    if (y + h > op.altoUtilMm - sep + EPS && pag.piezas.length) { nueva(); }
    trasladarPieza(it.p, x - it.bb.minX, y - it.bb.minY);
    pag.piezas.push(it.p);
    x += w + sep;
    if (h > altoFila) altoFila = h;
  }
  return paginas;
}
