// Moldes para colar desde un modelo 3D: subís un .stl (u .obj), elegís el tipo
// de molde y las medidas, y la página arma las partes imprimibles en 3D
// (el cálculo pesado corre en un Web Worker con moldes-nucleo.js).

import * as THREE from 'three';
import { OrbitControls } from './lego/vendor/OrbitControls.js';
import { leerModelo3D } from './modelo3d-leer.js';
import { cajaDeTris, orientar } from './moldes-nucleo.js';
import { tomarModelo } from './modelo-puente.js';

const $ = id => document.getElementById(id);

const estado = {
  nombre: '',
  tris: null,        // Float32Array, 9 números por triángulo, tal como vino el archivo
  resultado: null,   // lo que devolvió el worker
  generando: false
};

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove('visible'), 3500);
}

// ============================================================
// Subida del modelo
// ============================================================

const zona = $('zonaSubida');
const input = $('inputArchivo');

zona.addEventListener('click', () => input.click());
zona.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
zona.addEventListener('dragover', e => { e.preventDefault(); zona.classList.add('inf-subida--sobre'); });
zona.addEventListener('dragleave', () => zona.classList.remove('inf-subida--sobre'));
zona.addEventListener('drop', e => {
  e.preventDefault();
  zona.classList.remove('inf-subida--sobre');
  if (e.dataTransfer.files.length) cargarArchivo(e.dataTransfer.files[0]);
});
input.addEventListener('change', () => { if (input.files.length) cargarArchivo(input.files[0]); });

async function cargarArchivo(archivo) {
  let leido;
  try {
    leido = leerModelo3D(await archivo.arrayBuffer(), archivo.name);
  } catch (err) {
    toast('No pude leer el modelo: ' + err.message);
    return;
  }
  const tris = new Float32Array(leido.triangulos.length * 9);
  let o = 0;
  for (const t of leido.triangulos) for (const p of t) { tris[o++] = p[0]; tris[o++] = p[1]; tris[o++] = p[2]; }
  usarModelo(tris, archivo.name.replace(/\.[^.]+$/, ''), `✔ ${archivo.name} — ${leido.triangulos.length.toLocaleString('es')} triángulos` + (leido.avisos.length ? ' · ' + leido.avisos.join(' ') : ''));
}

function usarModelo(tris, nombre, descripcion) {
  estado.tris = tris;
  estado.nombre = nombre;
  const est = $('estadoSubida');
  est.style.display = '';
  est.textContent = descripcion;
  $('seccionOpciones').style.display = '';
  $('seccionResultado').style.display = '';
  mostrarMedidasModelo();
  ajustarControles();
  generar();
  $('seccionOpciones').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================================
// Modelos de ejemplo (hechos acá mismo con three.js)
// ============================================================

function trisDeGeometria(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.getAttribute('position');
  const tris = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    // three usa Y hacia arriba; acá Z hacia arriba
    tris[i * 3] = pos.getX(i); tris[i * 3 + 1] = -pos.getZ(i); tris[i * 3 + 2] = pos.getY(i);
  }
  return tris;
}

const EJEMPLOS = {
  gota() {
    // vela con forma de gota (torneada): perfil de radio según la altura
    const pts = [];
    const n = 40, alto = 70, r = 22;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const radio = r * Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 0.75 * (1 - 0.35 * t);
      pts.push(new THREE.Vector2(Math.max(0.01, radio), t * alto));
    }
    pts[0].x = 0; pts[n].x = 0;
    return trisDeGeometria(new THREE.LatheGeometry(pts, 48));
  },
  corazon() {
    // jabón corazón: contorno extruido con bordes redondeados
    const s = new THREE.Shape();
    s.moveTo(0, -30);
    s.bezierCurveTo(-36, -2, -36, 20, -18, 24);
    s.bezierCurveTo(-8, 26, -2, 20, 0, 12);
    s.bezierCurveTo(2, 20, 8, 26, 18, 24);
    s.bezierCurveTo(36, 20, 36, -2, 0, -30);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 16, bevelEnabled: true, bevelThickness: 4, bevelSize: 4, bevelSegments: 6, curveSegments: 24 });
    geo.rotateX(-Math.PI / 2);   // la extrusión va en Y (arriba en three)
    return trisDeGeometria(geo);
  },
  estrella() {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 14 : 32;
      const x = r * Math.cos(a), y = r * Math.sin(a);
      i ? s.lineTo(x, y) : s.moveTo(x, y);
    }
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 14, bevelEnabled: true, bevelThickness: 3, bevelSize: 3, bevelSegments: 4 });
    geo.rotateX(-Math.PI / 2);
    return trisDeGeometria(geo);
  }
};

document.querySelectorAll('[data-ejemplo]').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-ejemplo');
    const tris = EJEMPLOS[id]();
    usarModelo(tris, id, `✔ Ejemplo «${btn.textContent.trim()}» — ${(tris.length / 9).toLocaleString('es')} triángulos`);
  });
});

// ============================================================
// Opciones
// ============================================================

function leerOpciones() {
  const num = (id, min, max, def) => Math.min(max, Math.max(min, parseFloat($(id).value) || def));
  const detalle = $('optDetalle').value;
  return {
    tipo: (document.querySelector('input[name="tipo"]:checked') || {}).value || 'rigido',
    arriba: $('optArriba').value,
    invertir: $('optInvertir').checked,
    escala: num('optEscala', 5, 2000, 100) / 100,
    maxNodos: { rapido: 1.2e6, normal: 2.5e6, fino: 5e6 }[detalle] || 2.5e6,
    maxTriangulos: { rapido: 150000, normal: 250000, fino: 400000 }[detalle] || 250000,
    paredTipo: $('optParedTipo').value,
    pared: num('optPared', 1.5, 15, 4),
    holgura: num('optHolgura', 0, 30, 3),
    holguraPieza: num('optHolguraPieza', 0, 2, 0),
    juntaEje: parseInt($('optJuntaEje').value, 10) || 0,
    juntaPos: num('optJuntaPos', -60, 60, 0),
    diamEmbudo: num('optEmbudo', 3, 30, 8),
    diamResp: num('optResp', 0, 8, 0),
    gomas: $('optGomas').checked,
    holguraEncastre: num('optEncastre', 0, 1, 0.2),
    silLados: num('optSilLados', 4, 40, 10),
    silPiso: 0,
    silTecho: num('optSilTecho', 4, 40, 10),
    hundir: num('optHundir', 0, 5, 1),
    padding: num('optPadding', 0, 30, 4),
    contorno: $('optContorno').value,
    eyector: $('optEyector').checked
  };
}

function ajustarControles() {
  const tipo = (document.querySelector('input[name="tipo"]:checked') || {}).value || 'rigido';
  const rigido = tipo === 'rigido' || tipo === 'abierto';
  $('filaRigido').style.display = rigido ? '' : 'none';
  $('filaJunta').style.display = (tipo === 'rigido' || tipo === 'prensa') ? '' : 'none';
  $('grupoJuntaEje').style.display = tipo === 'rigido' ? '' : 'none';
  $('filaColada').style.display = tipo === 'rigido' ? '' : 'none';
  $('filaSilicona').style.display = tipo === 'silicona' ? '' : 'none';
  $('filaPrensa').style.display = tipo === 'prensa' ? '' : 'none';
  $('grupoHolgura').style.display = (rigido && $('optParedTipo').value === 'caja') ? '' : 'none';
  $('grupoEncastre').style.display = (tipo === 'rigido' || tipo === 'prensa') ? '' : 'none';
  $('valJuntaPos').textContent = $('optJuntaPos').value + ' mm';
  const notas = {
    rigido: 'Dos mitades rígidas con el negativo del modelo: se cierran con los pernos, se sujetan con gomas o pinzas y se cuela cera, resina o yeso por el embudo. Las mitades se imprimen con la cara de junta apoyada en la cama. La pieza sale derecha solo si cada mitad se puede sacar sin trabarse: sin partes que se ensanchen hacia adentro (para formas con «contrasalidas», hacé un molde de silicona).',
    abierto: 'Una sola pieza con la cavidad abierta por arriba: para modelos con una cara plana (posavasos, bandejas, jabones con relieve, placas de yeso). Orientá el modelo con la cara plana hacia arriba. Se imprime tal cual, con la boca hacia arriba.',
    silicona: 'La impresora no imprime silicona: imprime la caja con el modelo adentro, pegado a la base. Se vierte silicona de dos componentes, se deja curar, se rompe o despega la caja y queda el molde flexible, que sí tolera contrasalidas. El volumen de silicona se calcula abajo.',
    prensa: 'Para materiales que se prensan, no se cuelan: arcilla, jabón en frío, bombas de baño, polvos compactados. La matriz tiene la cavidad con la mitad de abajo del modelo; el pistón lleva la mitad de arriba en relieve. Se carga la matriz, se aprieta el pistón hasta que la tapa asienta y se desmolda.'
  };
  $('notaTipo').textContent = notas[tipo];
}

function mostrarMedidasModelo() {
  if (!estado.tris) return;
  const op = leerOpciones();
  const c = cajaDeTris(orientar(estado.tris, op.arriba, op.invertir, op.escala));
  const f = n => n.toFixed(1).replace('.', ',');
  $('medidasModelo').textContent = `El modelo mide ${f(c.dim[0])} × ${f(c.dim[1])} × ${f(c.dim[2])} mm (ancho × profundo × alto) con esta escala y orientación.`;
}

// ============================================================
// Generación en el worker
// ============================================================

let worker = null;

function generar() {
  if (!estado.tris) { toast('Primero subí un modelo'); return; }
  if (estado.generando) { toast('Esperá a que termine el molde anterior'); return; }
  const op = leerOpciones();
  estado.generando = true;
  $('btnGenerar').disabled = true;
  $('progreso').style.display = '';
  $('progreso').textContent = 'Preparando…';
  $('avisos').innerHTML = '';
  if (worker) worker.terminate();
  worker = new Worker('./moldes-worker.js', { type: 'module' });
  const avisos = [];
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.tipo === 'progreso') { $('progreso').textContent = '⏳ ' + m.texto; return; }
    if (m.tipo === 'aviso') { avisos.push(m.texto); return; }
    estado.generando = false;
    $('btnGenerar').disabled = false;
    if (m.tipo === 'error') {
      $('progreso').textContent = '⚠ ' + m.texto;
      estado.resultado = null;
      return;
    }
    $('progreso').style.display = 'none';
    estado.resultado = m.resultado;
    mostrarResultado(m.resultado, op);
  };
  worker.onerror = (e) => {
    estado.generando = false;
    $('btnGenerar').disabled = false;
    $('progreso').textContent = '⚠ Falló el cálculo: ' + (e.message || 'error en el worker');
  };
  const copia = Float32Array.from(estado.tris);
  worker.postMessage({ tris: copia, op }, [copia.buffer]);
}

$('btnGenerar').addEventListener('click', generar);

// ============================================================
// Resultado: estadísticas, descargas y vista 3D
// ============================================================

function mostrarResultado(res, op) {
  const f = n => n.toFixed(1).replace('.', ',');
  const info = res.info;
  const nTri = res.partes.reduce((s, p) => s + p.triangulos, 0);
  const items = [
    `🧊 ${res.partes.length} ${res.partes.length === 1 ? 'parte' : 'partes'}`,
    ...res.partes.map(p => `📦 ${p.nombre}: ${f(p.medidas.ancho)} × ${f(p.medidas.profundo)} × ${f(p.medidas.alto)} mm`),
    `🫗 cavidad ≈ ${f(info.volumenModeloMl)} ml (lo que entra de cera, resina o masa)`,
    info.volumenSiliconaMl != null ? `🧪 silicona necesaria ≈ ${f(info.volumenSiliconaMl)} ml (más un 10 % de margen)` : '',
    op.tipo === 'rigido' ? `🔩 ${info.pernos || 0} pernos de alineación${info.embudo ? ' · embudo en el punto más alto' : ''}` : '',
    `🔺 ${Math.round(nTri).toLocaleString('es')} triángulos · vóxel ${f(info.voxel)} mm`
  ].filter(Boolean);
  $('statsModelo').innerHTML = items.map(t => `<span class="inf-stats__item">${t}</span>`).join('');
  $('avisos').innerHTML = res.avisos.map(a => `<p class="moldes-aviso">⚠ ${a}</p>`).join('');

  // botones de descarga
  const cont = $('descargas');
  cont.innerHTML = '';
  res.partes.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'btn btn--primary';
    b.textContent = `⬇ STL · ${p.nombre}`;
    b.addEventListener('click', () => {
      descargarBlob(new Blob([stlDeMalla(p)], { type: 'model/stl' }), nombreArchivo(p, i));
      toast('STL descargado: llevalo al slicer de la impresora 3D');
    });
    cont.appendChild(b);
  });
  if (res.partes.length > 1) {
    const b = document.createElement('button');
    b.className = 'btn btn--primary';
    b.textContent = '⬇ Todas las partes (.zip)';
    b.addEventListener('click', async () => {
      if (typeof JSZip === 'undefined') { toast('No se pudo cargar el empaquetador ZIP; bajá los STL de a uno'); return; }
      const zip = new JSZip();
      res.partes.forEach((p, i) => zip.file(nombreArchivo(p, i), stlDeMalla(p)));
      descargarBlob(await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }), (estado.nombre || 'molde') + '-molde.zip');
      toast('ZIP descargado con todas las partes');
    });
    cont.appendChild(b);
  }

  if (!vista3d) vista3d = iniciarVista3D();
  vista3d.mostrar(res, $('optVerModelo').checked);
}

function nombreArchivo(p, i) {
  const limpio = p.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${estado.nombre || 'molde'}-${i + 1}-${limpio}.stl`;
}

// STL binario desde {pos, idx} (ya con Z hacia arriba y apoyado en z = 0)
function stlDeMalla(m) {
  const { pos, idx } = m;
  const nT = idx.length / 3;
  const buffer = new ArrayBuffer(84 + nT * 50);
  const dv = new DataView(buffer);
  const cabecera = 'Molde para colar - Generador de Actividades';
  for (let i = 0; i < 80; i++) dv.setUint8(i, i < cabecera.length ? cabecera.charCodeAt(i) & 0x7f : 0);
  dv.setUint32(80, nT, true);
  let off = 84;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    dv.setFloat32(off, nx, true); dv.setFloat32(off + 4, ny, true); dv.setFloat32(off + 8, nz, true); off += 12;
    for (const o of [a, b, c]) {
      dv.setFloat32(off, pos[o], true); dv.setFloat32(off + 4, pos[o + 1], true); dv.setFloat32(off + 8, pos[o + 2], true); off += 12;
    }
    dv.setUint16(off, 0, true); off += 2;
  }
  return buffer;
}

function descargarBlob(blob, nombre) {
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 4000);
}

// ============================================================
// Vista 3D: las partes una al lado de la otra, como se imprimen
// ============================================================

let vista3d = null;

function iniciarVista3D() {
  const lienzo = $('lienzo3d');
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0xf4f4f0);
  const camara = new THREE.PerspectiveCamera(40, 1, 0.1, 5000);
  const controles = new OrbitControls(camara, lienzo);
  controles.enableDamping = true;

  escena.add(new THREE.HemisphereLight(0xffffff, 0x888877, 1.1));
  const sol = new THREE.DirectionalLight(0xffffff, 1.5);
  sol.position.set(1, 2, 1.5);
  escena.add(sol);
  const contra = new THREE.DirectionalLight(0xffffff, 0.5);
  contra.position.set(-1.5, 1, -1);
  escena.add(contra);

  // los modelos tienen Z hacia arriba; el grupo los gira para la pantalla
  const grupo = new THREE.Group();
  grupo.rotation.x = -Math.PI / 2;
  escena.add(grupo);

  function medir() {
    const w = lienzo.clientWidth || 600;
    const h = lienzo.clientHeight || 420;
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
  }
  medir();
  window.addEventListener('resize', medir);

  (function animar() {
    requestAnimationFrame(animar);
    controles.update();
    renderer.render(escena, camara);
  })();

  const geometriaDe = (pos, idx) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    if (idx) g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    return g;
  };

  return {
    mostrar(res, conModelo) {
      while (grupo.children.length) {
        const h = grupo.children[0];
        grupo.remove(h);
        if (h.geometry) h.geometry.dispose();
      }
      const caja = new THREE.Box3();
      let x = 0;
      const gap = 10;
      if (conModelo) {
        const g = geometriaDe(res.modelo.pos, null);
        g.computeBoundingBox();
        const ancho = g.boundingBox.max.x - g.boundingBox.min.x;
        const malla = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xc65a35, metalness: 0.05, roughness: 0.6, transparent: true, opacity: 0.85 }));
        malla.position.x = x + ancho / 2 - (g.boundingBox.min.x + ancho / 2);
        grupo.add(malla);
        caja.union(g.boundingBox.clone().translate(new THREE.Vector3(malla.position.x, 0, 0)));
        x += ancho + gap;
      }
      for (const p of res.partes) {
        const g = geometriaDe(p.pos, p.idx);
        if (p.verDadoVuelta) {
          // las mitades se muestran con la cavidad hacia arriba (el STL sale con la junta apoyada)
          g.rotateX(Math.PI);
          g.translate(0, 0, p.medidas.alto);
        }
        g.computeBoundingBox();
        const ancho = g.boundingBox.max.x - g.boundingBox.min.x;
        const material = new THREE.MeshStandardMaterial({ color: p.color, metalness: 0.05, roughness: 0.6 });
        if (p.transparente) { material.transparent = true; material.opacity = 0.55; material.side = THREE.DoubleSide; }
        const malla = new THREE.Mesh(g, material);
        malla.position.x = x - g.boundingBox.min.x;
        grupo.add(malla);
        caja.union(g.boundingBox.clone().translate(new THREE.Vector3(malla.position.x, 0, 0)));
        x += ancho + gap;
      }
      const centro = caja.getCenter(new THREE.Vector3());
      const r = caja.getSize(new THREE.Vector3()).length() / 2 || 1;
      const objetivo = new THREE.Vector3(centro.x, centro.z, -centro.y);
      controles.target.copy(objetivo);
      camara.position.set(objetivo.x + r * 0.9, objetivo.y + r * 1.3, objetivo.z + r * 1.5);
      camara.near = r / 100; camara.far = r * 30;
      camara.updateProjectionMatrix();
      medir();
    }
  };
}

// ============================================================
// Eventos
// ============================================================

document.querySelectorAll('input[name="tipo"]').forEach(radio => {
  radio.addEventListener('change', () => { ajustarControles(); marcarPendiente(); });
});
for (const id of ['optParedTipo', 'optPared', 'optHolgura', 'optHolguraPieza', 'optJuntaEje', 'optEmbudo', 'optResp', 'optGomas',
  'optEncastre', 'optSilLados', 'optSilTecho', 'optHundir', 'optPadding', 'optContorno', 'optEyector', 'optDetalle']) {
  $(id).addEventListener('change', () => { ajustarControles(); marcarPendiente(); });
}
for (const id of ['optArriba', 'optInvertir', 'optEscala']) {
  $(id).addEventListener('change', () => { mostrarMedidasModelo(); marcarPendiente(); });
}
$('optJuntaPos').addEventListener('input', () => { ajustarControles(); marcarPendiente(); });
$('optVerModelo').addEventListener('change', () => { if (estado.resultado && vista3d) vista3d.mostrar(estado.resultado, $('optVerModelo').checked); });

function marcarPendiente() {
  if (!estado.tris) return;
  $('btnGenerar').classList.add('moldes-pendiente');
  $('btnGenerar').textContent = '🧊 Generar el molde (hay cambios sin aplicar)';
}
$('btnGenerar').addEventListener('click', () => {
  $('btnGenerar').classList.remove('moldes-pendiente');
  $('btnGenerar').textContent = '🧊 Generar el molde';
});

ajustarControles();

// Modelo que dejó otra página (Adornos de Navidad): se carga solo al abrir
if (new URLSearchParams(location.search).get('modelo') === 'pendiente') {
  tomarModelo().then(dato => {
    if (!dato || !dato.tris || !dato.tris.length) { toast('No encontré el modelo que venía de la otra página'); return; }
    const meta = dato.meta || {};
    if (meta.tipo) {
      const radio = document.querySelector('input[name="tipo"][value="' + meta.tipo + '"]');
      if (radio) radio.checked = true;
    }
    $('optInvertir').checked = !!meta.invertir;
    $('optArriba').value = 'z';
    $('optEscala').value = 100;
    const origen = meta.origen === 'navidad' ? 'Adornos de Navidad' : 'otra página';
    usarModelo(dato.tris, dato.nombre || 'modelo', `✔ Modelo recibido de «${origen}»: ${dato.nombre || 'modelo'} — ${(dato.tris.length / 9).toLocaleString('es')} triángulos` + (meta.invertir ? ' · dado vuelta para que el relieve quede en el piso del molde' : ''));
    history.replaceState(null, '', location.pathname);
  }).catch(err => { console.error(err); toast('No pude leer el modelo pendiente: ' + err.message); });
}
