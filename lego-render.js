// Motor de render de las guías LEGO: three.js + LDrawLoader (vendorizados en
// lego/vendor/) con la biblioteca de piezas LDraw local (lego/ldraw/).
// Genera imágenes PNG: el modelo hasta cierto paso, y miniaturas de cada pieza.
//
// Convenciones LDraw: 1 stud = 20 LDU, 1 placa de alto = 8 LDU, Y crece hacia
// abajo. Acá el "suelo" es y=0 y las piezas se apoyan en y negativos.

import * as THREE from './lego/vendor/three.module.min.js';
import { LDrawLoader } from './lego/vendor/LDrawLoader.js';
import { piezaPorClave, piezaPorDat } from './lego-catalogo.js';

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

  // Parseo de un texto LDraw. Se replica lo que hace loader.parse() pero con
  // promesas de verdad: si falta un archivo .dat, la promesa RECHAZA en vez de
  // quedarse colgada para siempre (loader.parse solo tiene callback de éxito).
  async function parsear(texto) {
    const grupo = await loader.partsCache.parseModel(texto);
    loader.applyMaterialsToMesh(grupo, '16', loader.materialLibrary, true);
    loader.computeBuildingSteps(grupo);
    return grupo;
  }

  // ---- Biblioteca de piezas extra (zip oficial de LDraw subido por el usuario) ----
  // Se engancha antes del fetch normal: si la función devuelve el texto de la
  // pieza, se usa esa; si devuelve null, sigue la biblioteca local de lego/ldraw/.
  let resolverExtra = null;
  const cacheParse = loader.partsCache.parseCache;
  const fetchOriginal = cacheParse.fetchData.bind(cacheParse);
  cacheParse.fetchData = async (nombre) => {
    if (resolverExtra) {
      const texto = await resolverExtra(nombre);
      if (texto) return texto;
    }
    return fetchOriginal(nombre);
  };

  function limpiarCacheLdraw() {
    loader.partsCache._cache = {};
    cacheParse._cache = {};
    medidas.clear();
    cacheMiniaturas.clear();
    disponibles.clear();
  }

  function usarBibliotecaExtra(fn) {
    resolverExtra = fn || null;
    limpiarCacheLdraw();
  }

  // ¿Existe el archivo de la pieza (en la biblioteca extra o en la local)?
  const disponibles = new Map(); // dat -> Promise<boolean>
  function existeParte(dat) {
    const clave = String(dat).toLowerCase();
    if (!disponibles.has(clave)) disponibles.set(clave, buscarParte(clave));
    return disponibles.get(clave);
  }

  async function buscarParte(dat) {
    if (resolverExtra) {
      try { if (await resolverExtra(dat + '.dat')) return true; } catch (e) { /* sigue por la local */ }
    }
    for (const carpeta of ['parts/', '', 'p/']) {
      try {
        const r = await fetch(RUTA_LDRAW + carpeta + dat + '.dat', { cache: 'force-cache' });
        if (r.ok) return true;
      } catch (e) { /* probamos la carpeta siguiente */ }
    }
    return false;
  }

  // Mide la caja de una pieza (se cachea). Coordenadas nativas LDraw (y hacia abajo).
  async function medir(dat) {
    if (medidas.has(dat)) return medidas.get(dat);
    const grupo = await parsear(`1 16 0 0 0 1 0 0 0 1 0 0 0 1 ${dat}.dat`);
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
  // "volcado": la pieza se vuelca 90° de costado (M = RotY(rot) · RotZ(90),
  // sin preRot). Una viga volcada queda acostada A LO LARGO DE Z con los
  // agujeros hacia X — la orientación calibrada para clavarle pines. Un eje
  // volcado queda vertical.
  const MATRICES_VOLCADO = {
    0: [0, -1, 0, 1, 0, 0, 0, 0, 1],
    90: [0, 0, 1, 1, 0, 0, 0, 1, 0],
    180: [0, 1, 0, 1, 0, 0, 0, 0, -1],
    270: [0, 0, -1, 1, 0, 0, 0, -1, 0],
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

  // Transformación de una colocación {pieza,color,x,z,nivel,rot,parado}:
  // posición del origen LDraw + matriz de orientación. El origen de las piezas
  // LDraw estándar está centrado en la huella de studs, así que el centro se
  // calcula con el tamaño del catálogo (alinea perfecto en la cuadrícula) y la
  // base con la caja medida de la geometría real.
  // Requiere que la pieza ya esté medida (llamar antes a medirTodas).
  function transformacion(z) {
    if (z.raw) return null;
    const info = piezaPorClave(z.pieza);
    if (!info) return null;
    const caja = medidas.get(info.dat);
    if (!caja) return null;
    const rot = z.rot || 0;
    // preRot: algunas piezas LDraw vienen giradas de fábrica (las vigas rectas
    // corren sobre Z); se compensa acá para que "sin rotar" sea siempre el
    // lado largo sobre X, como dice la documentación
    const efectiva = (rot + (info.preRot || 0)) % 360;
    const m = z.volcado ? MATRICES_VOLCADO[rot]
      : z.parado ? MATRICES_PARADO[efectiva]
      : MATRICES_ROT[efectiva];
    let ox, oz, oy;
    if (z.volcado || z.parado || info.bbox) {
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
    return { pos: [ox, oy, oz], mat: m, dat: info.dat };
  }

  // Una colocación → línea LDraw tipo 1
  function lineaLdraw(z) {
    if (z.raw) return z.raw;
    const t = transformacion(z);
    if (!t) return null;
    const num = (v) => Math.round(v * 100) / 100;
    return `1 ${z.color} ${t.pos.map(num).join(' ')} ${t.mat.join(' ')} ${t.dat}.dat`;
  }

  // Grupo three.js de una sola pieza (para el editor 3D en vivo)
  async function grupoPieza(clave, color) {
    const info = piezaPorClave(clave);
    if (!info) return null;
    await medir(info.dat);
    return parsear(`1 ${color} 0 0 0 1 0 0 0 1 0 0 0 1 ${info.dat}.dat`);
  }

  // Igual, pero para una pieza que no está en el catálogo (importada de un
  // .ldr): se pide directo por su número de archivo LDraw.
  async function grupoDat(dat, color) {
    if (!dat) return null;
    await medir(dat);
    return parsear(`1 ${color} 0 0 0 1 0 0 0 1 0 0 0 1 ${dat}.dat`);
  }

  // Huella en studs de una colocación (para el editor de cuadrícula)
  function huella(z) {
    if (z.raw) return null;
    const info = piezaPorClave(z.pieza);
    if (!info) return null;
    let w = info.w, d = info.d;
    if (z.parado) d = Math.max(1, Math.round((info.alto || 1) * 0.4)); // el fondo pasa a ser el alto original
    if (z.volcado) [w, d] = [d, w]; // el largo pasa al eje Z
    if (z.rot === 90 || z.rot === 270) [w, d] = [d, w];
    return { x: z.x, z: z.z, w, d };
  }

  // ---- Importación de modelos .ldr/.mpd ----------------------------------
  // Redondeo amable: las coordenadas del archivo casi siempre caen justo en la
  // cuadrícula (o en un medio stud), pero traen ruido de coma flotante.
  function ajustar(v, paso = 0.5, tol = 0.03) {
    const s = Math.round(v / paso) * paso;
    const r = Math.abs(v - s) < tol ? s : Math.round(v * 100) / 100;
    return r === 0 ? 0 : r;
  }

  function matricesIguales(a, b) {
    for (let i = 0; i < 9; i++) if (Math.abs(a[i] - b[i]) > 0.002) return false;
    return true;
  }

  // Caja envolvente (coordenadas LDraw del mundo) de una pieza colocada con la
  // matriz y la posición crudas de una línea LDraw. Sirve para recentrar el
  // modelo importado y para saber a qué altura está cada pieza.
  async function cajaColocada(dat, pos, mat) {
    const caja = await medir(dat);
    const r = cajaTransformada(caja, mat);
    return {
      minX: r.minX + pos[0], maxX: r.maxX + pos[0],
      minY: r.minY + pos[1], maxY: r.maxY + pos[1],
      minZ: r.minZ + pos[2], maxZ: r.maxZ + pos[2],
    };
  }

  // Operación inversa de transformacion(): de una línea LDraw ya colocada al
  // formato editable del generador ({pieza, color, x, z, nivel, rot, ...}).
  // Devuelve null si la pieza no está en el catálogo o si su orientación no es
  // una de las que sabe describir el formato de texto (ahí queda como cruda).
  async function reconocerColocacion(dat, color, pos, mat) {
    const info = piezaPorDat(dat);
    if (!info) return null;
    const caja = await medir(info.dat);
    const MODOS = ['normal', 'parado', 'volcado'];
    for (const modo of MODOS) {
      for (const rot of [0, 90, 180, 270]) {
        const efectiva = (rot + (info.preRot || 0)) % 360;
        const m = modo === 'volcado' ? MATRICES_VOLCADO[rot]
          : modo === 'parado' ? MATRICES_PARADO[efectiva]
          : MATRICES_ROT[efectiva];
        if (!matricesIguales(m, mat)) continue;
        const z = { pieza: info.clave, color, x: 0, z: 0, nivel: 0, rot };
        if (modo === 'parado') z.parado = true;
        if (modo === 'volcado') z.volcado = true;
        if (modo !== 'normal' || info.bbox) {
          const r = cajaTransformada(caja, m);
          z.x = ajustar((pos[0] + r.minX) / 20);
          z.z = ajustar((pos[2] + r.minZ) / 20);
          z.nivel = ajustar(-(pos[1] + r.maxY) / 8);
        } else {
          let w = info.w, d = info.d;
          if (rot === 90 || rot === 270) [w, d] = [d, w];
          z.x = ajustar(pos[0] / 20 - w / 2);
          z.z = ajustar(pos[2] / 20 - d / 2);
          z.nivel = ajustar(-(pos[1] + caja.max.y) / 8);
        }
        return z;
      }
    }
    return null;
  }

  // Miniatura de una pieza que NO está en el catálogo (importada de un .ldr):
  // se dibuja directo desde su archivo .dat.
  async function fotoDat(dat, color, px = 200) {
    const k = dat + '|' + color + '|' + px + '|raw';
    if (cacheMiniaturas.has(k)) return cacheMiniaturas.get(k);
    const url = await fotoModelo(
      [{ raw: `1 ${color} 0 0 0 1 0 0 0 1 0 0 0 1 ${dat}.dat` }],
      { ancho: px, alto: px, margen: 1.3 }
    );
    cacheMiniaturas.set(k, url);
    return url;
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
    const { ancho = 1000, alto = 780, atenuarHasta = 0, margen = 1.18, dir = [0.72, 0.62, 0.9] } = opciones;
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
    // (o la dirección que pida "dir": otras esquinas, desde arriba...)
    const vDir = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
    camara.position.copy(esfera.center).addScaledVector(vDir, dist);
    camara.near = Math.max(1, dist - esfera.radius * 4);
    camara.far = dist + esfera.radius * 4;
    camara.lookAt(esfera.center);
    camara.updateProjectionMatrix();

    renderer.setSize(ancho, alto, false);
    renderer.render(escena, camara);
    const url = recortarAlContenido(renderer.domElement);
    escena.remove(contenedor);
    return url;
  }

  // Recorta el lienzo al contenido real (píxeles no transparentes) con un
  // pequeño borde: así el modelo llena la imagen y las fichas aprovechan
  // todo el espacio, sin bandas vacías alrededor.
  function recortarAlContenido(lienzo, borde = 12) {
    const w = lienzo.width, h = lienzo.height;
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const ctx = tmp.getContext('2d');
    ctx.drawImage(lienzo, 0, 0);
    let datos;
    try { datos = ctx.getImageData(0, 0, w, h).data; }
    catch (e) { return lienzo.toDataURL('image/png'); }
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      const fila = y * w * 4;
      for (let x = 0; x < w; x++) {
        if (datos[fila + x * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return lienzo.toDataURL('image/png'); // lienzo vacío
    minX = Math.max(0, minX - borde);
    minY = Math.max(0, minY - borde);
    maxX = Math.min(w - 1, maxX + borde);
    maxY = Math.min(h - 1, maxY + borde);
    const salida = document.createElement('canvas');
    salida.width = maxX - minX + 1;
    salida.height = maxY - minY + 1;
    salida.getContext('2d').drawImage(tmp, minX, minY, salida.width, salida.height, 0, 0, salida.width, salida.height);
    return salida.toDataURL('image/png');
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

  // Triángulos del modelo entero en coordenadas LDraw, para exportar la malla
  // (.stl). Devuelve un array plano: 9 números por triángulo.
  async function trianglesModelo(piezas) {
    await medirTodas(piezas);
    const grupo = await parsear(textoModelo(piezas));
    if (!grupo) return [];
    grupo.updateMatrixWorld(true);
    const salida = [];
    const v = new THREE.Vector3();
    grupo.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
      const pos = o.geometry.attributes.position;
      const indice = o.geometry.index;
      const total = indice ? indice.count : pos.count;
      for (let i = 0; i + 2 < total; i += 3) {
        for (let k = 0; k < 3; k++) {
          const idx = indice ? indice.getX(i + k) : i + k;
          v.fromBufferAttribute(pos, idx).applyMatrix4(o.matrixWorld);
          salida.push(v.x, v.y, v.z);
        }
      }
    });
    return salida;
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

  return {
    medir, medirTodas, huella, fotoModelo, fotoPieza, fotoDat, exportarLdr, lineaLdraw, transformacion, grupoPieza, grupoDat,
    reconocerColocacion, cajaColocada, existeParte, usarBibliotecaExtra, limpiarCacheLdraw, trianglesModelo,
  };
}
