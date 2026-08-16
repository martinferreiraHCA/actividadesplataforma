// Diseño 3D con papel: subís un modelo 3D (.stl/.obj/.dxf), elegís el tamaño
// en cm y se genera el patrón de papel (cortes, dobleces y pestañas numeradas)
// listo para imprimir a escala real. Vista 3D con three.js.

import * as THREE from 'three';
import { OrbitControls } from './lego/vendor/OrbitControls.js';
import { leerModelo3D, cajaDelModelo } from './modelo3d-leer.js';
import { desplegarModelo } from './papercraft-desplegar.js';

const $ = id => document.getElementById(id);
const SVGNS = 'http://www.w3.org/2000/svg';

const estado = {
  triangulos: null,
  caja: null,        // {min,max,dim} en unidades del modelo
  nombre: '',
  resultado: null    // salida de desplegarModelo
};

// ============================================================
// Vista 3D
// ============================================================
let vista3d = null;

function iniciarVista3D() {
  const lienzo = $('lienzo3d');
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0xf4f4f0);
  const camara = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
  const controles = new OrbitControls(camara, lienzo);
  controles.enableDamping = true;

  escena.add(new THREE.HemisphereLight(0xffffff, 0x888877, 1.1));
  const sol = new THREE.DirectionalLight(0xffffff, 1.4);
  sol.position.set(1, 2, 1.5);
  escena.add(sol);

  const grupo = new THREE.Group();
  escena.add(grupo);

  function medir() {
    const w = lienzo.clientWidth || 600;
    const h = lienzo.clientHeight || 320;
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

  return {
    mostrar(triangulos) {
      while (grupo.children.length) grupo.remove(grupo.children[0]);
      const pos = new Float32Array(triangulos.length * 9);
      let i = 0;
      for (const t of triangulos) for (const p of t) { pos[i++] = p[0]; pos[i++] = p[1]; pos[i++] = p[2]; }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.computeVertexNormals();
      const malla = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: 0xd3b78a, flatShading: true, side: THREE.DoubleSide, metalness: 0, roughness: 0.85
      }));
      grupo.add(malla);
      grupo.add(new THREE.LineSegments(
        new THREE.EdgesGeometry(geo, 12),
        new THREE.LineBasicMaterial({ color: 0x59452b })
      ));
      // encuadre
      geo.computeBoundingSphere();
      const c = geo.boundingSphere.center, r = geo.boundingSphere.radius || 1;
      controles.target.copy(c);
      camara.position.set(c.x + r * 1.7, c.y + r * 1.3, c.z + r * 1.7);
      camara.near = r / 100; camara.far = r * 20;
      camara.updateProjectionMatrix();
      medir();
    }
  };
}

// ============================================================
// Dimensiones enganchadas (escala uniforme)
// ============================================================
function escalaActual() {
  // mm por unidad del modelo, a partir del ancho pedido
  const cm = parseFloat($('dimX').value);
  if (!(cm > 0) || !estado.caja) return null;
  return (cm * 10) / (estado.caja.dim[0] || 1);
}

function ponerDimensiones(escala) {
  const d = estado.caja.dim;
  $('dimX').value = (d[0] * escala / 10).toFixed(1);
  $('dimY').value = (d[1] * escala / 10).toFixed(1);
  $('dimZ').value = (d[2] * escala / 10).toFixed(1);
}

function alCambiarDimension(eje) {
  if (!estado.caja) return;
  const v = parseFloat($(eje).value);
  const k = { dimX: 0, dimY: 1, dimZ: 2 }[eje];
  const d = estado.caja.dim[k];
  if (!(v > 0) || !(d > 0)) return;
  ponerDimensiones((v * 10) / d);
  regenerar();
}

// ============================================================
// SVG de cada hoja (unidades = mm; viewBox A4)
// ============================================================
const MARGEN_HOJA = 10; // el área útil (190×277) va centrada en la A4

function svgDeHoja(pagina, numero, total) {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 210 297');
  svg.setAttribute('xmlns', SVGNS);

  const g = document.createElementNS(SVGNS, 'g');
  g.setAttribute('transform', `translate(${MARGEN_HOJA} ${MARGEN_HOJA})`);
  svg.appendChild(g);

  const linea = (seg, color, ancho, guiones) => {
    const el = document.createElementNS(SVGNS, 'line');
    el.setAttribute('x1', seg[0][0].toFixed(2)); el.setAttribute('y1', seg[0][1].toFixed(2));
    el.setAttribute('x2', seg[1][0].toFixed(2)); el.setAttribute('y2', seg[1][1].toFixed(2));
    el.setAttribute('stroke', color);
    el.setAttribute('stroke-width', ancho);
    el.setAttribute('stroke-linecap', 'round');
    if (guiones) el.setAttribute('stroke-dasharray', guiones);
    g.appendChild(el);
  };

  for (const p of pagina.piezas) {
    for (const poli of p.pestanas) {
      const path = document.createElementNS(SVGNS, 'path');
      path.setAttribute('d', 'M ' + poli.map(q => q[0].toFixed(2) + ' ' + q[1].toFixed(2)).join(' L '));
      path.setAttribute('fill', '#ececec');
      path.setAttribute('stroke', '#111');
      path.setAttribute('stroke-width', '0.3');
      g.appendChild(path);
    }
    for (const s of p.cortes) linea(s, '#111', '0.35');
    for (const s of p.montanas) linea(s, '#c0392b', '0.3', '3.5 1.5 0.7 1.5');
    for (const s of p.valles) linea(s, '#2471a3', '0.3', '2.2 1.6');
    for (const e of p.etiquetas) {
      const t = document.createElementNS(SVGNS, 'text');
      t.setAttribute('x', e.x.toFixed(2)); t.setAttribute('y', e.y.toFixed(2));
      t.setAttribute('font-size', '3.2');
      t.setAttribute('font-family', 'Arial, sans-serif');
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('dominant-baseline', 'middle');
      t.setAttribute('fill', '#111');
      t.textContent = e.texto;
      g.appendChild(t);
    }
  }

  // rótulo al pie (dentro del margen)
  const pie = document.createElementNS(SVGNS, 'text');
  pie.setAttribute('x', '105'); pie.setAttribute('y', '292.5');
  pie.setAttribute('font-size', '2.8');
  pie.setAttribute('font-family', 'Arial, sans-serif');
  pie.setAttribute('text-anchor', 'middle');
  pie.setAttribute('fill', '#777');
  pie.textContent = `${estado.nombre} — hoja ${numero} de ${total} — imprimir al 100 % (escala real)`;
  svg.appendChild(pie);
  return svg;
}

// ============================================================
// Generación del patrón
// ============================================================
function chip(cont, n, etiqueta) {
  const s = document.createElement('span');
  s.className = 'inf-stat';
  s.innerHTML = `<strong>${n}</strong> ${etiqueta}`;
  cont.appendChild(s);
}

function regenerar() {
  if (!estado.triangulos) return;
  const escala = escalaActual();
  if (!escala) return;
  const cont = $('hojasPatron');
  const stats = $('statsPatron');
  const avisos = $('avisosPatron');
  cont.innerHTML = ''; stats.innerHTML = ''; avisos.innerHTML = '';

  let res;
  try {
    res = desplegarModelo(estado.triangulos, {
      escala,
      pestanas: $('optPestanas').checked,
      altoPestanaMm: parseFloat($('optAltoPestana').value) || 8,
      numerar: $('optNumerar').checked
    });
  } catch (e) {
    estado.resultado = null;
    const err = document.createElement('div');
    err.className = 'inf-aviso';
    err.textContent = '✗ ' + (e.message || 'No se pudo desplegar el modelo.');
    avisos.appendChild(err);
    return;
  }
  estado.resultado = res;

  chip(stats, res.stats.caras, 'caras');
  chip(stats, res.stats.piezas, res.stats.piezas === 1 ? 'pieza' : 'piezas');
  chip(stats, res.stats.uniones, 'uniones para pegar');
  chip(stats, res.paginas.length, res.paginas.length === 1 ? 'hoja A4' : 'hojas A4');
  res.avisos.forEach(a => {
    const n = document.createElement('div');
    n.className = 'inf-aviso';
    n.textContent = a;
    avisos.appendChild(n);
  });

  res.paginas.forEach((pag, i) => {
    const rotulo = document.createElement('p');
    rotulo.className = 'papel-hoja__rotulo';
    rotulo.textContent = `Hoja ${i + 1} de ${res.paginas.length}`;
    cont.appendChild(rotulo);
    const hoja = document.createElement('div');
    hoja.className = 'papel-hoja';
    hoja.appendChild(svgDeHoja(pag, i + 1, res.paginas.length));
    cont.appendChild(hoja);
  });
}

// ============================================================
// Subida
// ============================================================
function mostrarEstado(msg, esError) {
  const n = $('estadoSubida');
  n.style.display = msg ? 'block' : 'none';
  n.textContent = msg || '';
  n.classList.toggle('inf-estado--error', !!esError);
}

async function procesarArchivo(archivo) {
  if (!archivo) return;
  mostrarEstado('Leyendo «' + archivo.name + '»…');
  try {
    const buf = await archivo.arrayBuffer();
    const m = leerModelo3D(buf, archivo.name);
    estado.triangulos = m.triangulos;
    estado.caja = cajaDelModelo(m.triangulos);
    estado.nombre = archivo.name.replace(/\.(stl|obj|dxf)$/i, '');
    const d = estado.caja.dim;
    if (!(d[0] > 0) || !(d[1] > 0) || !(d[2] >= 0)) throw new Error('El modelo no tiene volumen (¿está vacío o aplastado?).');

    // tamaño inicial: la dimensión mayor mide 10 cm
    const escala0 = 100 / Math.max(d[0], d[1], d[2]);
    ponerDimensiones(escala0);
    $('dimOriginal').textContent = `El archivo mide ${d.map(x => x.toFixed(1)).join(' × ')} unidades (${m.triangulos.length} caras).`;

    mostrarEstado(`✓ «${archivo.name}» cargado (${m.triangulos.length} caras).` + (m.avisos.length ? ' ' + m.avisos.join(' ') : ''));
    $('seccionOpciones').style.display = 'block';
    $('seccionResultado').style.display = 'block';
    if (!vista3d) vista3d = iniciarVista3D();
    vista3d.mostrar(m.triangulos);
    regenerar();
    $('seccionResultado').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    console.error(e);
    mostrarEstado('✗ ' + (e.message || 'No se pudo leer el modelo.'), true);
  }
}

// ============================================================
// Imprimir y PDF
// ============================================================
function imprimir() {
  if (!estado.resultado) return;
  const area = $('areaImpresion');
  area.innerHTML = '';
  document.querySelectorAll('#hojasPatron .papel-hoja').forEach(h => area.appendChild(h.cloneNode(true)));
  window.print();
}

// una hoja SVG → JPEG a resolución de impresión (~190 dpi)
function hojaAJpeg(svgOriginal) {
  return new Promise((resolve, reject) => {
    const W = 1588, H = 2246; // 210×297mm a 2× (~7.56 px/mm)
    const svg = svgOriginal.cloneNode(true);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    const xml = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo dibujar la hoja.')); };
    img.src = url;
  });
}

async function descargarPDFDirecto() {
  if (!estado.resultado || typeof html2pdf === 'undefined') return;
  const btn = $('btnPDFDirecto');
  const nota = $('notaPDF');
  btn.disabled = true;
  nota.style.display = 'inline';
  nota.textContent = 'Generando el PDF…';
  try {
    // el bundle no expone jsPDF: se obtiene una instancia vacía vía html2pdf
    // y se le agregan las hojas como imágenes A4 completas (escala exacta)
    const pdf = await html2pdf().set({
      margin: 0,
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(document.createElement('div')).toPdf().get('pdf');

    const hojas = Array.from(document.querySelectorAll('#hojasPatron .papel-hoja svg'));
    for (let i = 0; i < hojas.length; i++) {
      const jpeg = await hojaAJpeg(hojas[i]);
      if (i > 0) pdf.addPage('a4', 'portrait');
      pdf.addImage(jpeg, 'JPEG', 0, 0, 210, 297);
    }
    pdf.save((estado.nombre || 'modelo').replace(/[\\/:*?"<>|]+/g, '-') + ' — papel.pdf');
    nota.textContent = '';
    nota.style.display = 'none';
  } catch (e) {
    console.error(e);
    nota.textContent = 'No se pudo generar el PDF directo. Probá con «PDF — Imprimir el patrón».';
  } finally {
    btn.disabled = false;
  }
}

// ============================================================
// Eventos
// ============================================================
function init() {
  const zona = $('zonaSubida');
  const input = $('inputArchivo');
  zona.addEventListener('click', () => input.click());
  zona.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  input.addEventListener('change', () => { procesarArchivo(input.files[0]); input.value = ''; });
  ['dragover', 'dragenter'].forEach(ev => zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.add('inf-subida--sobre'); }));
  ['dragleave', 'drop'].forEach(ev => zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.remove('inf-subida--sobre'); }));
  zona.addEventListener('drop', e => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) procesarArchivo(f);
  });

  let timer = null;
  ['dimX', 'dimY', 'dimZ'].forEach(id => $(id).addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => alCambiarDimension(id), 350);
  }));
  ['optPestanas', 'optAltoPestana', 'optNumerar'].forEach(id => $(id).addEventListener('change', regenerar));

  $('btnImprimir').addEventListener('click', imprimir);
  $('btnPDFDirecto').addEventListener('click', descargarPDFDirecto);
}

init();
