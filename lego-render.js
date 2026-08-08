// Motor de render de las guías LEGO: three.js + LDrawLoader (vendorizados en
// lego/vendor/) con la biblioteca de piezas LDraw local (lego/ldraw/).
// Genera imágenes PNG: el modelo hasta cierto paso, y miniaturas de cada pieza.
//
// Convenciones LDraw: 1 stud = 20 LDU, 1 placa de alto = 8 LDU, Y crece hacia
// abajo. Acá el "suelo" es y=0 y las piezas se apoyan en y negativos.

import * as THREE from './lego/vendor/three.module.min.js';
import { LDrawLoader } from './lego/vendor/LDrawLoader.js';
import { piezaPorClave } from './lego-catalogo.js';

const RUTA_LDRAW = 'lego/ldraw/';

let _motor = null;

export async function motorLego() {
  if (_motor) return _motor;
  _motor = crearMotor();
  return _motor;
}

async function crearMotor() {
  const loader = new LDrawLoader();
  loader.setPartsLibraryPath(RUTA_LDRAW);
  loader.smoothNormals = true;
  await loader.preloadMaterials(RUTA_LDRAW + 'LDConfig.ldr');

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);

  const escena = new THREE.Scene();
  escena.add(new THREE.AmbientLight(0xffffff, 1.2));
  const luz1 = new THREE.DirectionalLight(0xffffff, 1.6);
  luz1.position.set(-160, 260, 220);
  escena.add(luz1);
  const luz2 = new THREE.DirectionalLight(0xffffff, 0.7);
  luz2.position.set(180, 120, -160);
  escena.add(luz2);

  const camara = new THREE.PerspectiveCamera(30, 1, 1, 100000);

  const medidas = new Map();     // dat -> Box3 (en coords LDraw del archivo)
  const cacheMiniaturas = new Map(); // dat|color|px -> dataURL

  function parsear(texto) {
    return new Promise((resolver) => loader.parse(texto, resolver));
  }

  // Mide la caja de una pieza (se cachea). Coordenadas nativas LDraw (y hacia abajo).
  async function medir(dat) {
    if (medidas.has(dat)) return medidas.get(dat);
    const grupo = await parsear(`1 16 0 0 0 1 0 0 0 1 0 0 0 1 parts/${dat}.dat`);
    const caja = new THREE.Box3().setFromObject(grupo);
    medidas.set(dat, caja);
    return caja;
  }

  async function medirTodas(piezas) {
    const dats = new Set();
    for (const z of piezas) {
      if (z.raw) continue;
      const info = piezaPorClave(z.pieza);
      if (info) dats.add(info.dat);
    }
    for (const dat of dats) await medir(dat);
  }

  const MATRICES_ROT = {
    0: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    90: [0, 0, 1, 0, 1, 0, -1, 0, 0],
    180: [-1, 0, 0, 0, 1, 0, 0, 0, -1],
    270: [0, 0, -1, 0, 1, 0, 1, 0, 0],
  };
  // "parado": primero la rotación horizontal y después un vuelco de 90°
  // alrededor de X (M = RotX(90) · RotY(rot)). Así una pieza que quedó a lo
  // largo de X sigue a lo largo de X pero de pie, con su cara superior
  // mirando ahora hacia Z (los agujeros de una viga quedan de frente).
  const MATRICES_PARADO = {
    0: [1, 0, 0, 0, 0, -1, 0, 1, 0],
    90: [0, 0, 1, 1, 0, 0, 0, 1, 0],
    180: [-1, 0, 0, 0, 0, 1, 0, 1, 0],
    270: [0, 0, -1, -1, 0, 0, 0, 1, 0],
  };

  // Caja transformada por una matriz 3x3 (fila-mayor, convención LDraw)
  function cajaTransformada(caja, m) {
    const xs = [caja.min.x, caja.max.x], ys = [caja.min.y, caja.max.y], zs = [caja.min.z, caja.max.z];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const x of xs) for (const y of ys) for (const z of zs) {
      const tx = m[0] * x + m[1] * y + m[2] * z;
      const ty = m[3] * x + m[4] * y + m[5] * z;
      const tz = m[6] * x + m[7] * y + m[8] * z;
      minX = Math.min(minX, tx); maxX = Math.max(maxX, tx);
      minY = Math.min(minY, ty); maxY = Math.max(maxY, ty);
      minZ = Math.min(minZ, tz); maxZ = Math.max(maxZ, tz);
    }
    return { minX, maxX, minY, maxY, minZ, maxZ };
  }

  // Una colocación {pieza,color,x,z,nivel,rot} → línea LDraw tipo 1.
  // El origen de las piezas LDraw estándar está centrado en la huella de studs,
  // así que el centro se calcula con el tamaño del catálogo (alinea perfecto en
  // la cuadrícula) y la base con la caja medida de la geometría real.
  // Requiere que la pieza ya esté medida (llamar antes a medirTodas).
  function lineaLdraw(z) {
    if (z.raw) return z.raw;
    const info = piezaPorClave(z.pieza);
    if (!info) return null;
    const caja = medidas.get(info.dat);
    if (!caja) return null;
    const rot = z.rot || 0;
    // preRot: algunas piezas LDraw vienen giradas de fábrica (las vigas rectas
    // corren sobre Z); se compensa acá para que "sin rotar" sea siempre el
    // lado largo sobre X, como dice la documentación
    const efectiva = (rot + (info.preRot || 0)) % 360;
    const m = z.parado ? MATRICES_PARADO[efectiva] : MATRICES_ROT[efectiva];
    let ox, oz, oy;
    if (z.parado || info.bbox) {
      // piezas paradas u origen no centrado: la esquina de la caja
      // transformada va en (x, z) y su base apoya en el nivel
      const r = cajaTransformada(caja, m);
      ox = z.x * 20 - r.minX;
      oz = z.z * 20 - r.minZ;
      oy = -(z.nivel || 0) * 8 - r.maxY;
    } else {
      let w = info.w, d = info.d;
      if (rot === 90 || rot === 270) [w, d] = [d, w];
      ox = (z.x + w / 2) * 20;
      oz = (z.z + d / 2) * 20;
      oy = -(z.nivel || 0) * 8 - caja.max.y; // la base apoya en el nivel
    }
    const num = (v) => Math.round(v * 100) / 100;
    return `1 ${z.color} ${num(ox)} ${num(oy)} ${num(oz)} ${m.join(' ')} parts/${info.dat}.dat`;
  }

  // Huella en studs de una colocación (para el editor de cuadrícula)
  function huella(z) {
    if (z.raw) return null;
    const info = piezaPorClave(z.pieza);
    if (!info) return null;
    let w = info.w, d = info.d;
    if (z.parado) d = Math.max(1, Math.round((info.alto || 1) * 0.4)); // el fondo pasa a ser el alto original
    if (z.rot === 90 || z.rot === 270) [w, d] = [d, w];
    return { x: z.x, z: z.z, w, d };
  }

  function textoModelo(piezas) {
    const lineas = ['0 Guia de ensamble', '0 Name: modelo.ldr'];
    for (const z of piezas) {
      const l = lineaLdraw(z);
      if (l) lineas.push(l);
    }
    return lineas.join('\n');
  }

  // Vuelve translúcidas las piezas de pasos anteriores (opción "atenuar")
  function atenuarGrupo(objeto) {
    objeto.traverse((o) => {
      if (!o.isMesh && !o.isLineSegments) return;
      const esLista = Array.isArray(o.material);
      const clones = (esLista ? o.material : [o.material]).map((m) => {
        const c = m.clone();
        c.transparent = true;
        c.opacity = o.isMesh ? 0.3 : 0.12;
        c.depthWrite = false;
        return c;
      });
      o.material = esLista ? clones : clones[0];
    });
  }

  // Foto del modelo formado por "piezas"; las primeras `atenuarHasta` piezas
  // salen translúcidas (pasos anteriores) si atenuarHasta > 0.
  async function fotoModelo(piezas, opciones = {}) {
    const { ancho = 1000, alto = 780, atenuarHasta = 0, margen = 1.18 } = opciones;
    await medirTodas(piezas);
    const texto = textoModelo(piezas);
    const grupo = await parsear(texto);
    if (!grupo || !grupo.children.length) return null;

    if (atenuarHasta > 0) {
      grupo.children.slice(0, atenuarHasta).forEach(atenuarGrupo);
    }

    const contenedor = new THREE.Group();
    contenedor.add(grupo);
    contenedor.rotation.x = Math.PI; // LDraw tiene -Y hacia arriba
    contenedor.updateMatrixWorld(true);
    escena.add(contenedor);

    const caja = new THREE.Box3().setFromObject(contenedor);
    const esfera = caja.getBoundingSphere(new THREE.Sphere());
    camara.aspect = ancho / alto;
    const fovV = THREE.MathUtils.degToRad(camara.fov) / 2;
    const fovH = Math.atan(Math.tan(fovV) * camara.aspect);
    const dist = (esfera.radius * margen) / Math.sin(Math.min(fovV, fovH));
    // vista de manual: desde el frente-derecha, un poco desde arriba
    const dir = new THREE.Vector3(0.72, 0.62, 0.9).normalize();
    camara.position.copy(esfera.center).addScaledVector(dir, dist);
    camara.near = Math.max(1, dist - esfera.radius * 4);
    camara.far = dist + esfera.radius * 4;
    camara.lookAt(esfera.center);
    camara.updateProjectionMatrix();

    renderer.setSize(ancho, alto, false);
    renderer.render(escena, camara);
    const url = renderer.domElement.toDataURL('image/png');
    escena.remove(contenedor);
    return url;
  }

  // Miniatura de una sola pieza en un color (cacheada)
  async function fotoPieza(clave, color, px = 220) {
    const info = piezaPorClave(clave);
    if (!info) return null;
    const k = info.dat + '|' + color + '|' + px;
    if (cacheMiniaturas.has(k)) return cacheMiniaturas.get(k);
    const url = await fotoModelo(
      [{ pieza: clave, color, x: 0, z: 0, nivel: 0, rot: 0 }],
      { ancho: px, alto: px, margen: 1.3 }
    );
    cacheMiniaturas.set(k, url);
    return url;
  }

  // Exportación .ldr con pasos (compatible con LPub3D, LDView, Studio…)
  async function exportarLdr(state) {
    const todas = state.pasos.flatMap(p => p.piezas);
    await medirTodas(todas);
    const L = [];
    L.push('0 ' + (state.titulo || 'Guia de ensamble'));
    L.push('0 Name: guia.ldr');
    L.push('0 Author: Generador de Actividades');
    L.push('0 !LDRAW_ORG Model');
    state.pasos.forEach((p, i) => {
      L.push('0 // PASO ' + (i + 1) + (p.titulo ? ': ' + p.titulo : ''));
      p.piezas.forEach(z => {
        const l = lineaLdraw(z);
        if (l) L.push(l);
      });
      L.push('0 STEP');
    });
    return L.join('\r\n') + '\r\n';
  }

  return { medir, medirTodas, huella, fotoModelo, fotoPieza, exportarLdr, lineaLdraw };
}
