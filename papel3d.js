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

  function encuadrar(geo) {
    geo.computeBoundingSphere();
    const c = geo.boundingSphere.center, r = geo.boundingSphere.radius || 1;
    controles.target.copy(c);
    camara.position.set(c.x + r * 1.7, c.y + r * 1.3, c.z + r * 1.7);
    camara.near = r / 100; camara.far = r * 20;
    camara.updateProjectionMatrix();
    medir();
  }

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
      encuadrar(geo);
    },
    // pinta el modelo con un color por pieza del patrón (preview de cómo queda)
    pintar(tri3d) {
      while (grupo.children.length) grupo.remove(grupo.children[0]);
      const geo = geometriaColoreada(tri3d, () => 'hecha');
      const malla = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        vertexColors: true, flatShading: true, side: THREE.DoubleSide, metalness: 0, roughness: 0.85
      }));
      grupo.add(malla);
      grupo.add(new THREE.LineSegments(
        new THREE.EdgesGeometry(geo, 12),
        new THREE.LineBasicMaterial({ color: 0x555555 })
      ));
      encuadrar(geo);
    }
  };
}

// color de cada pieza (mismos tonos en el 3D y en la guía)
export function colorDePieza(id, fuerte) {
  const h = (id * 137.5) % 360;
  return `hsl(${h.toFixed(0)}, ${fuerte ? 72 : 48}%, ${fuerte ? 55 : 70}%)`;
}

// geometría con color por vértice según el estado de cada pieza
// estadoDe(piezaId) → 'hecha' (color pleno) | 'actual' (resaltada) | 'futura'
function geometriaColoreada(tri3d, estadoDe) {
  const visibles = tri3d.filter(t => estadoDe(t.pieza) !== 'futura');
  const pos = new Float32Array(visibles.length * 9);
  const col = new Float32Array(visibles.length * 9);
  let i = 0;
  const tmp = new THREE.Color();
  for (const t of visibles) {
    const estado = estadoDe(t.pieza);
    tmp.set(colorDePieza(t.pieza, estado === 'actual'));
    for (const p of t.v) {
      pos[i] = p[0]; pos[i + 1] = p[1]; pos[i + 2] = p[2];
      col[i] = tmp.r; col[i + 1] = tmp.g; col[i + 2] = tmp.b;
      i += 3;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

// ============================================================
// Fotógrafo: renders 3D fuera de pantalla para la guía de armado
// ============================================================
let fotografo = null;

function crearFotografo() {
  const canvas = document.createElement('canvas');
  canvas.width = 560; canvas.height = 420;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0xf7f7f4);
  const camara = new THREE.PerspectiveCamera(40, canvas.width / canvas.height, 1, 10000);
  escena.add(new THREE.HemisphereLight(0xffffff, 0x888877, 1.1));
  const sol = new THREE.DirectionalLight(0xffffff, 1.4);
  sol.position.set(1, 2, 1.5);
  escena.add(sol);
  const grupo = new THREE.Group();
  escena.add(grupo);

  return {
    foto(tri3d, estadoDe) {
      while (grupo.children.length) grupo.remove(grupo.children[0]);
      const geo = geometriaColoreada(tri3d, estadoDe);
      if (geo.getAttribute('position').count) {
        grupo.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
          vertexColors: true, flatShading: true, side: THREE.DoubleSide, metalness: 0, roughness: 0.85
        })));
        grupo.add(new THREE.LineSegments(
          new THREE.EdgesGeometry(geo, 12),
          new THREE.LineBasicMaterial({ color: 0x555555 })
        ));
      }
      // fantasma de lo que falta, para ubicar la pieza en el conjunto
      const futuras = tri3d.filter(t => estadoDe(t.pieza) === 'futura');
      if (futuras.length) {
        const pos = new Float32Array(futuras.length * 9);
        let i = 0;
        for (const t of futuras) for (const p of t.v) { pos[i++] = p[0]; pos[i++] = p[1]; pos[i++] = p[2]; }
        const geoF = new THREE.BufferGeometry();
        geoF.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geoF.computeVertexNormals();
        grupo.add(new THREE.Mesh(geoF, new THREE.MeshStandardMaterial({
          color: 0xbbbbbb, transparent: true, opacity: 0.15, depthWrite: false, side: THREE.DoubleSide
        })));
      }
      // encuadre fijo sobre el modelo COMPLETO (así todos los pasos coinciden)
      const todo = new Float32Array(tri3d.length * 9);
      let j = 0;
      for (const t of tri3d) for (const p of t.v) { todo[j++] = p[0]; todo[j++] = p[1]; todo[j++] = p[2]; }
      const geoTodo = new THREE.BufferGeometry();
      geoTodo.setAttribute('position', new THREE.BufferAttribute(todo, 3));
      geoTodo.computeBoundingSphere();
      const c = geoTodo.boundingSphere.center, r = geoTodo.boundingSphere.radius || 1;
      camara.position.set(c.x + r * 1.9, c.y + r * 1.4, c.z + r * 1.9);
      camara.lookAt(c);
      camara.near = r / 100; camara.far = r * 20;
      camara.updateProjectionMatrix();
      renderer.render(escena, camara);
      return canvas.toDataURL('image/jpeg', 0.88);
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

// dibuja una pieza (líneas, pestañas y números) dentro de un <g>
function dibujarPieza(g, p) {
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
  // números de unión: chicos y grises para no ensuciar el patrón
  for (const e of p.etiquetas) {
    const t = document.createElementNS(SVGNS, 'text');
    t.setAttribute('x', e.x.toFixed(2)); t.setAttribute('y', e.y.toFixed(2));
    t.setAttribute('font-size', '2');
    t.setAttribute('font-family', 'Arial, sans-serif');
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('dominant-baseline', 'middle');
    t.setAttribute('fill', '#666');
    t.textContent = e.texto;
    g.appendChild(t);
  }
}

function svgDeHoja(pagina, numero, total) {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 210 297');
  svg.setAttribute('xmlns', SVGNS);

  const g = document.createElementNS(SVGNS, 'g');
  g.setAttribute('transform', `translate(${MARGEN_HOJA} ${MARGEN_HOJA})`);
  svg.appendChild(g);

  for (const p of pagina.piezas) dibujarPieza(g, p);

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

// diagrama suelto de una pieza (para la guía): SVG recortado a su caja
function svgDePieza(p) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const ver = (x, y) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  };
  for (const grupo of [p.montanas, p.valles, p.cortes]) for (const [a, b] of grupo) { ver(a[0], a[1]); ver(b[0], b[1]); }
  for (const poli of p.pestanas) for (const q of poli) ver(q[0], q[1]);
  const pad = 3;
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('xmlns', SVGNS);
  svg.setAttribute('viewBox', `${(minX - pad).toFixed(1)} ${(minY - pad).toFixed(1)} ${(maxX - minX + 2 * pad).toFixed(1)} ${(maxY - minY + 2 * pad).toFixed(1)}`);
  const g = document.createElementNS(SVGNS, 'g');
  svg.appendChild(g);
  dibujarPieza(g, p);
  return { svg, ancho: maxX - minX + 2 * pad, alto: maxY - minY + 2 * pad };
}

// SVG → PNG (para que la guía use solo imágenes y el PDF directo funcione)
function svgAPng(svgEl, wPx, hPx) {
  return new Promise((resolve, reject) => {
    const svg = svgEl.cloneNode(true);
    svg.setAttribute('width', wPx);
    svg.setAttribute('height', hPx);
    const xml = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = wPx; canvas.height = hPx;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, wPx, hPx);
      ctx.drawImage(img, 0, 0, wPx, hPx);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo dibujar la pieza.')); };
    img.src = url;
  });
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
  // si nada cambió (ej: el "change" al salir del campo tras ya regenerar por
  // "input"), no rehacemos el patrón ni la guía: evita trabajo y saltos de página
  const clave = JSON.stringify([escala, $('optPestanas').checked, $('optAltoPestana').value,
    $('optNumerar').checked, $('optPiezas').value]);
  if (clave === estado.ultimaClave) return;
  estado.ultimaClave = clave;
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
      numerar: $('optNumerar').checked,
      piezasObjetivo: parseInt($('optPiezas').value, 10) || 0
    });
  } catch (e) {
    estado.resultado = null;
    $('seccionGuia').style.display = 'none';
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

  // si el docente pidió una cantidad de piezas, contarle qué pasó con el pedido
  const pedido = parseInt($('optPiezas').value, 10) || 0;
  if (pedido && res.stats.piezas !== pedido) {
    const n = document.createElement('div');
    n.className = 'inf-aviso';
    if (res.stats.piezas > pedido) {
      n.textContent = `Pediste ${pedido} piezas pero salieron ${res.stats.piezas}: a este tamaño no se puede con menos, porque cada pieza tiene que entrar en una hoja A4. Probá con un modelo más chico (menos cm) o dejá el campo vacío.`;
    } else {
      n.textContent = `Pediste ${pedido} piezas y salieron ${res.stats.piezas}: la cantidad es un objetivo aproximado — el reparto exacto depende de la forma del modelo. Probá con un número mayor si querés piezas aún más chicas.`;
    }
    avisos.appendChild(n);
  }
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

  // preview general: el modelo pintado con un color por pieza
  if (vista3d) vista3d.pintar(res.tri3d);

  // guía de armado (asincrónica: rasteriza fotos y diagramas); los botones
  // de la guía esperan esta promesa para no imprimir una guía a medio armar
  $('seccionGuia').style.display = 'block';
  estado.promesaGuia = construirGuia(res).catch(e => console.error('guía:', e));
}

// ============================================================
// Guía de armado paso a paso
// ============================================================

// orden de armado: se empieza por la pieza más grande y se sigue por las
// que se pegan con lo ya armado (recorrido por las uniones)
function ordenDeArmado(res) {
  const porId = new Map(res.piezas.map(p => [p.id, p]));
  const pendientes = new Set(res.piezas.map(p => p.id));
  const orden = [];
  while (pendientes.size) {
    // arranque: la más grande de las que quedan
    let semilla = null;
    for (const id of pendientes) {
      if (semilla === null || porId.get(id).nCaras > porId.get(semilla).nCaras) semilla = id;
    }
    const cola = [semilla];
    pendientes.delete(semilla);
    while (cola.length) {
      const id = cola.shift();
      orden.push(porId.get(id));
      for (const u of porId.get(id).uniones || []) {
        if (pendientes.has(u.otra)) { pendientes.delete(u.otra); cola.push(u.otra); }
      }
    }
  }
  return orden;
}

let generacionGuia = 0;

async function construirGuia(res) {
  const gen = ++generacionGuia;
  const cont = $('guiaArmado');
  cont.innerHTML = '<p class="inf-estado">Armando la guía…</p>';
  if (!fotografo) fotografo = crearFotografo();

  const orden = ordenDeArmado(res);
  const conFotos = orden.length <= 30;
  const doc = document.createElement('div');
  doc.className = 'inf-doc guia-doc';

  // ---- portada ----
  const portada = document.createElement('header');
  portada.className = 'inf-portada';
  portada.innerHTML = `<span class="inf-portada__tipo">📐 Guía de armado</span>
    <h1 class="inf-portada__titulo"></h1>
    <p class="inf-portada__sub">Modelo de papel para recortar, doblar y pegar</p>`;
  portada.querySelector('h1').textContent = estado.nombre;
  const statsG = document.createElement('div');
  statsG.className = 'inf-stats';
  const medidas = ['dimX', 'dimY', 'dimZ'].map(id => $(id).value).join(' × ');
  [[medidas + ' cm', 'tamaño final'], [orden.length, orden.length === 1 ? 'pieza' : 'piezas'],
   [res.stats.uniones, 'uniones'], [res.paginas.length, res.paginas.length === 1 ? 'hoja' : 'hojas']]
    .forEach(([n, e]) => chip(statsG, n, e));
  portada.appendChild(statsG);
  doc.appendChild(portada);

  const foto = document.createElement('div');
  foto.className = 'guia-final';
  const imgFinal = document.createElement('img');
  imgFinal.src = fotografo.foto(res.tri3d, () => 'hecha');
  imgFinal.alt = 'El modelo terminado';
  const capFinal = document.createElement('p');
  capFinal.className = 'guia-final__cap';
  capFinal.textContent = 'Así queda el modelo terminado: cada color es una pieza del patrón.';
  foto.append(imgFinal, capFinal);
  doc.appendChild(foto);

  const antes = document.createElement('div');
  antes.className = 'inf-consigna';
  antes.innerHTML = `<strong>Antes de empezar</strong><p>Vas a necesitar: tijera, pegamento y las hojas del patrón impresas al 100 % (escala real).
Recortá cada pieza por las <b>líneas llenas</b> (las pestañas grises van incluidas). Doblá las líneas <b>raya-punto hacia afuera (montaña)</b> y las <b>rayitas hacia adentro (valle)</b>, marcando bien el doblez con una regla. Cada unión tiene un <b>número</b>: el borde «3» se pega sobre la pestaña «3». Poné el pegamento en la pestaña, apretá unos segundos y seguí.</p>`;
  doc.appendChild(antes);

  // ---- pasos ----
  for (let k = 0; k < orden.length; k++) {
    const p = orden[k];
    const hechas = new Set(orden.slice(0, k).map(x => x.id));
    const paso = document.createElement('section');
    paso.className = 'guia-paso';

    const cab = document.createElement('div');
    cab.className = 'guia-paso__cab';
    cab.innerHTML = `<span class="guia-paso__num">PASO ${k + 1} de ${orden.length}</span>
      <span class="guia-paso__color" style="background:${colorDePieza(p.id, true)}"></span>
      <strong>Pieza ${p.id + 1}</strong><span class="guia-paso__hoja"> — está en la hoja ${p.hoja || 1}</span>`;
    paso.appendChild(cab);

    const cuerpo = document.createElement('div');
    cuerpo.className = 'guia-paso__cuerpo';

    if (conFotos) {
      const img3d = document.createElement('img');
      img3d.className = 'guia-paso__foto';
      img3d.src = fotografo.foto(res.tri3d, id =>
        id === p.id ? 'actual' : (hechas.has(id) ? 'hecha' : 'futura'));
      img3d.alt = `Avance del armado en el paso ${k + 1}`;
      cuerpo.appendChild(img3d);
    }

    const lado = document.createElement('div');
    lado.className = 'guia-paso__lado';
    const { svg, ancho, alto } = svgDePieza(p);
    const escalaPx = Math.min(300 / ancho, 190 / alto, 6);
    const imgPieza = document.createElement('img');
    imgPieza.className = 'guia-paso__pieza';
    imgPieza.alt = 'La pieza desplegada';
    imgPieza.src = await svgAPng(svg, Math.round(ancho * escalaPx), Math.round(alto * escalaPx));
    lado.appendChild(imgPieza);

    const ul = document.createElement('ul');
    ul.className = 'guia-paso__texto';
    const li = t => { const e = document.createElement('li'); e.innerHTML = t; ul.appendChild(e); };
    li(`✂️ Recortá la pieza <b>${p.id + 1}</b> por las líneas llenas.`);
    const nPliegues = p.montanas.length + p.valles.length;
    if (nPliegues) li(`📏 Marcá los dobleces: ${p.montanas.length} montaña (raya-punto) y ${p.valles.length} valle (rayitas).`);
    const propias = (p.uniones || []).filter(u => u.otra === p.id);
    const conHechas = (p.uniones || []).filter(u => u.otra !== p.id && hechas.has(u.otra));
    const futuras = (p.uniones || []).filter(u => u.otra !== p.id && !hechas.has(u.otra));
    if (propias.length) li(`🔒 Cerrá la pieza sobre sí misma pegando ${listaUniones(propias)}.`);
    if (k === 0) {
      li('🏁 Esta es la pieza de partida: dejala armada sobre la mesa.');
    } else if (conHechas.length) {
      li(`🩹 Pegala a lo ya armado por ${listaUniones(conHechas, true)}.`);
    }
    if (futuras.length) li(`⏳ Todavía no pegues los números ${futuras.map(u => u.n).join(', ')}: van con piezas de pasos siguientes.`);
    lado.appendChild(ul);
    cuerpo.appendChild(lado);
    paso.appendChild(cuerpo);
    doc.appendChild(paso);
  }

  const pieG = document.createElement('footer');
  pieG.className = 'inf-pie';
  pieG.innerHTML = '<span>Guía de armado — ' + orden.length + ' pasos</span><span>Diseño 3D con papel</span>';
  doc.appendChild(pieG);

  if (gen !== generacionGuia) return; // el usuario cambió algo mientras se armaba
  cont.innerHTML = '';
  cont.appendChild(doc);
}

function listaUniones(us, conPieza) {
  return us.map(u => `el n.º <b>${u.n}</b>${conPieza ? ' (pieza ' + (u.otra + 1) + ')' : ''}`).join(', ');
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
    estado.ultimaClave = null; // modelo nuevo: siempre regenerar
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

// --- guía: imprimir y PDF directo (la guía es texto + imágenes) ---
async function imprimirGuia() {
  if (estado.promesaGuia) await estado.promesaGuia;
  const doc = $('guiaArmado').firstElementChild;
  if (!doc || !doc.classList.contains('guia-doc')) return;
  const area = $('areaImpresion');
  area.innerHTML = '';
  area.appendChild(doc.cloneNode(true));
  window.print();
}

async function descargarGuiaPDF() {
  if (estado.promesaGuia) await estado.promesaGuia;
  const doc = $('guiaArmado').firstElementChild;
  if (!doc || !doc.classList.contains('guia-doc') || typeof html2pdf === 'undefined') return;
  const btn = $('btnGuiaPDF');
  const nota = $('notaGuia');
  btn.disabled = true;
  nota.style.display = 'inline';
  nota.textContent = 'Generando el PDF de la guía…';
  try {
    const clon = doc.cloneNode(true);
    clon.style.maxWidth = 'none';
    clon.style.width = '760px';
    clon.style.border = 'none';
    clon.style.boxShadow = 'none';
    const envoltura = document.createElement('div');
    envoltura.style.cssText = 'position:absolute;left:-11000px;top:0;background:#fff';
    envoltura.appendChild(clon);
    document.body.appendChild(envoltura);
    await html2pdf().set({
      margin: [10, 10, 12, 10],
      filename: (estado.nombre || 'modelo').replace(/[\\/:*?"<>|]+/g, '-') + ' — guía de armado.pdf',
      image: { type: 'jpeg', quality: 0.93 },
      html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, scrollX: 0, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css'], avoid: ['.guia-paso', '.guia-final', '.inf-consigna', '.inf-stat'] }
    }).from(clon).save();
    envoltura.remove();
    nota.textContent = '';
    nota.style.display = 'none';
  } catch (e) {
    console.error(e);
    nota.textContent = 'No se pudo generar el PDF de la guía. Probá con «PDF — Imprimir la guía».';
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
  ['optPestanas', 'optAltoPestana', 'optNumerar', 'optPiezas'].forEach(id => $(id).addEventListener('change', regenerar));
  // la cantidad de piezas también regenera mientras se tipea (sin esperar el foco)
  let timerPiezas = null;
  $('optPiezas').addEventListener('input', () => {
    clearTimeout(timerPiezas);
    timerPiezas = setTimeout(regenerar, 450);
  });

  $('btnImprimir').addEventListener('click', imprimir);
  $('btnPDFDirecto').addEventListener('click', descargarPDFDirecto);
  $('btnGuiaImprimir').addEventListener('click', imprimirGuia);
  $('btnGuiaPDF').addEventListener('click', descargarGuiaPDF);
}

init();
