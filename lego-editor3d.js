// Editor 3D del modelo terminado — se abre desde lego.html.
// Muestra el modelo completo (todas las piezas de todos los pasos) en un
// visor con órbita, y permite corregirlo manualmente pieza por pieza: mover,
// subir/bajar, rotar, parar, cambiar color o tipo, duplicar, borrar o pasar
// una pieza a otro paso. Como cada pieza pertenece a su paso, cada retoque
// modifica automáticamente el paso de armado correspondiente: las fichas
// previas quedan coherentes con el resultado final sin trabajo extra.

import * as THREE from './lego/vendor/three.module.min.js';
import { OrbitControls } from './lego/vendor/OrbitControls.js';
import { PIEZAS, COLORES, CATEGORIAS, piezaPorClave, colorPorCodigoLdraw } from './lego-catalogo.js';
import { motorLego } from './lego-render.js';

let editor = null; // instancia única

export async function abrirEditor3D(opciones) {
  if (editor) {
    editor.opciones = opciones;
    await editor.recargar();
    return editor;
  }
  editor = await crearEditor(opciones);
  return editor;
}

async function crearEditor(opciones) {
  const { contenedorId } = opciones;
  const raiz = document.getElementById(contenedorId);
  const motor = await motorLego();

  raiz.innerHTML = `
    <div class="ed3d__viewport">
      <canvas class="ed3d__lienzo"></canvas>
      <div class="ed3d__hud"></div>
    </div>
    <div class="calib__barra">
      <span class="ficha-card__mini-label" style="margin:0">Ver hasta el paso:</span>
      <input type="range" class="ed3d__hasta" min="1" max="1" value="1" style="width:10rem">
      <span class="ed3d__hasta-rotulo ficha-card__mini-label" style="margin:0"></span>
      <span class="ficha-card__mini-label" style="margin:0 0 0 1rem">Paso XZ:</span>
      <select class="campo__input ed3d__pasoxz" style="width:8.5rem">
        <option value="1">1 stud</option>
        <option value="0.5">½ stud</option>
        <option value="0.25">¼ stud</option>
        <option value="0.125">1 mm</option>
      </select>
      <span class="ficha-card__mini-label" style="margin:0">Paso altura:</span>
      <select class="campo__input ed3d__pasoy" style="width:8.5rem">
        <option value="1">1 placa</option>
        <option value="0.5">½ placa</option>
        <option value="0.25">0.8 mm</option>
      </select>
      <button class="ficha-card__accion ed3d__recargar" title="Vuelve a dibujar el modelo desde los pasos">🔄 Recargar</button>
    </div>
    <div class="calib__barra">
      <span class="ficha-card__mini-label" style="margin:0">Mover:</span>
      <button class="ficha-card__accion" data-ed3d-mover="-x">◀ X−</button>
      <button class="ficha-card__accion" data-ed3d-mover="+x">X+ ▶</button>
      <button class="ficha-card__accion" data-ed3d-mover="-z">▲ Z−</button>
      <button class="ficha-card__accion" data-ed3d-mover="+z">Z+ ▼</button>
      <button class="ficha-card__accion" data-ed3d-mover="+y">⬆ Subir</button>
      <button class="ficha-card__accion" data-ed3d-mover="-y">⬇ Bajar</button>
      <button class="ficha-card__accion ed3d__rotar">↻ Rotar 90°</button>
      <button class="ficha-card__accion ed3d__parado" title="Vuelca la pieza 90° hacia arriba (vigas de pie, etc.)">⤒ Parado</button>
    </div>
    <div class="calib__barra">
      <select class="campo__input ed3d__pieza" style="max-width:13rem" title="Cambiar el tipo de pieza"></select>
      <select class="campo__input ed3d__color" style="width:8rem" title="Cambiar el color"></select>
      <span class="ficha-card__mini-label" style="margin:0">Pertenece al paso:</span>
      <select class="campo__input ed3d__paso" style="width:9rem" title="Mover la pieza a otro paso de la guía"></select>
      <button class="ficha-card__accion ed3d__duplicar">⧉ Duplicar</button>
      <button class="ficha-card__accion ficha-card__accion--peligro ed3d__borrar">✕ Quitar</button>
    </div>
    <p class="calib__ayuda" style="margin-top:0.4rem">
      <strong>Clic en una pieza para seleccionarla</strong> (arrastrar = orbitar, rueda = zoom). Cada retoque modifica el
      <strong>paso de armado al que pertenece la pieza</strong>: las fichas previas se actualizan solas y todo queda coherente.
      Flechas del teclado = mover · RePág/AvPág = subir/bajar · R = rotar · Supr = quitar.
    </p>`;

  const lienzo = raiz.querySelector('.ed3d__lienzo');
  const hud = raiz.querySelector('.ed3d__hud');

  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0xf2f2ee);
  escena.add(new THREE.AmbientLight(0xffffff, 1.15));
  const luz1 = new THREE.DirectionalLight(0xffffff, 1.6);
  luz1.position.set(-160, 260, 220);
  escena.add(luz1);
  const luz2 = new THREE.DirectionalLight(0xffffff, 0.7);
  luz2.position.set(180, 120, -160);
  escena.add(luz2);

  const camara = new THREE.PerspectiveCamera(32, 1, 1, 60000);
  camara.position.set(200, 180, 280);
  const controles = new OrbitControls(camara, lienzo);
  controles.enableDamping = true;

  const contenedor = new THREE.Group();
  contenedor.rotation.x = Math.PI; // convención LDraw
  escena.add(contenedor);
  const grilla = new THREE.GridHelper(400, 20, 0xbbaa66, 0xd8d4c8);
  escena.add(grilla);
  const cajaSel = new THREE.Box3Helper(new THREE.Box3(), 0xd0a000);
  cajaSel.visible = false;
  escena.add(cajaSel);

  // entradas: cada entrada referencia el objeto pieza REAL del estado
  let entradas = []; // { pieza (objeto del estado), pasoIdx, grupo }
  let sel = -1;
  let hastaPaso = Infinity;

  const inst = {
    opciones,
    recargar,
    cerrado: false,
  };

  function pasos() { return inst.opciones.getPasos(); }
  function avisarCambio() { inst.opciones.onCambio(); }

  function sincronizar(entrada) {
    const t = motor.transformacion(entrada.pieza);
    if (!t || !entrada.grupo) return;
    entrada.grupo.position.set(t.pos[0], t.pos[1], t.pos[2]);
    const m = t.mat;
    entrada.grupo.setRotationFromMatrix(new THREE.Matrix4().set(
      m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1));
    entrada.grupo.updateMatrixWorld(true);
  }

  async function recargar() {
    for (const e of entradas) contenedor.remove(e.grupo);
    entradas = [];
    sel = -1;
    const lista = pasos();
    for (let i = 0; i < lista.length; i++) {
      for (const pieza of lista[i].piezas) {
        if (pieza.raw) continue;
        const grupo = await motor.grupoPieza(pieza.pieza, pieza.color);
        if (!grupo) continue;
        const e = { pieza, pasoIdx: i, grupo };
        entradas.push(e);
        contenedor.add(grupo);
        sincronizar(e);
      }
    }
    const rango = raiz.querySelector('.ed3d__hasta');
    rango.max = Math.max(1, lista.length);
    rango.value = lista.length;
    hastaPaso = lista.length;
    aplicarVisibilidad();
    encuadrar();
    refrescarSeleccion();
  }

  function aplicarVisibilidad() {
    for (const e of entradas) e.grupo.visible = e.pasoIdx < hastaPaso;
    raiz.querySelector('.ed3d__hasta-rotulo').textContent = `${hastaPaso} de ${pasos().length}`;
    if (sel >= 0 && !entradas[sel].grupo.visible) { sel = -1; refrescarSeleccion(); }
  }

  function encuadrar() {
    const caja = new THREE.Box3();
    let hay = false;
    for (const e of entradas) if (e.grupo.visible) { caja.expandByObject(e.grupo); hay = true; }
    if (!hay) return;
    const esfera = caja.getBoundingSphere(new THREE.Sphere());
    controles.target.copy(esfera.center);
    const dist = Math.max(140, esfera.radius * 2.6);
    camara.position.copy(esfera.center).add(new THREE.Vector3(0.72, 0.62, 0.9).normalize().multiplyScalar(dist));
  }

  function seleccion() { return sel >= 0 ? entradas[sel] : null; }

  function refrescarSeleccion() {
    const e = seleccion();
    if (e) {
      cajaSel.box.setFromObject(e.grupo);
      cajaSel.visible = true;
      const info = piezaPorClave(e.pieza.pieza);
      const col = colorPorCodigoLdraw(e.pieza.color);
      hud.textContent = `PASO ${e.pasoIdx + 1} · ${info ? info.nombre : e.pieza.pieza} · ${col ? col.nombre : e.pieza.color}\n` +
        `x ${e.pieza.x}  z ${e.pieza.z}  nivel ${e.pieza.nivel || 0}` +
        (e.pieza.rot ? `  rotar ${e.pieza.rot}` : '') + (e.pieza.parado ? '  parado' : '');
      raiz.querySelector('.ed3d__pieza').value = e.pieza.pieza;
      raiz.querySelector('.ed3d__color').value = String(e.pieza.color);
      raiz.querySelector('.ed3d__paso').value = String(e.pasoIdx);
      raiz.querySelector('.ed3d__parado').classList.toggle('lego-colocando', !!e.pieza.parado);
    } else {
      cajaSel.visible = false;
      hud.textContent = 'Clic en una pieza del modelo para editarla';
      raiz.querySelector('.ed3d__parado').classList.remove('lego-colocando');
    }
  }

  // ---- operaciones ----
  function editar(fn) {
    const e = seleccion();
    if (!e) return;
    fn(e);
    sincronizar(e);
    cajaSel.box.setFromObject(e.grupo);
    refrescarSeleccion();
    avisarCambio();
  }

  function mover(eje, signo) {
    const pxz = parseFloat(raiz.querySelector('.ed3d__pasoxz').value);
    const py = parseFloat(raiz.querySelector('.ed3d__pasoy').value);
    editar((e) => {
      if (eje === 'x') e.pieza.x = redondear(e.pieza.x + signo * pxz);
      if (eje === 'z') e.pieza.z = redondear(e.pieza.z + signo * pxz);
      if (eje === 'y') e.pieza.nivel = Math.max(0, redondear((e.pieza.nivel || 0) + signo * py));
    });
  }
  const redondear = (v) => Math.round(v * 1000) / 1000;

  // ---- interfaz ----
  raiz.querySelector('.ed3d__hasta').addEventListener('input', (ev) => {
    hastaPaso = parseInt(ev.target.value, 10);
    aplicarVisibilidad();
  });
  raiz.querySelector('.ed3d__recargar').addEventListener('click', recargar);
  raiz.querySelectorAll('[data-ed3d-mover]').forEach(b => b.addEventListener('click', () => {
    mover(b.dataset.ed3dMover[1], b.dataset.ed3dMover[0] === '+' ? 1 : -1);
  }));
  raiz.querySelector('.ed3d__rotar').addEventListener('click', () => editar((e) => {
    e.pieza.rot = ((e.pieza.rot || 0) + 90) % 360;
  }));
  raiz.querySelector('.ed3d__parado').addEventListener('click', () => editar((e) => {
    e.pieza.parado = !e.pieza.parado;
    if (!e.pieza.parado) delete e.pieza.parado;
  }));

  const selPieza = raiz.querySelector('.ed3d__pieza');
  selPieza.innerHTML = CATEGORIAS.map(cat => {
    const lista = PIEZAS.filter(p => p.cat === cat);
    if (!lista.length) return '';
    return `<optgroup label="${cat}">` + lista.map(p => `<option value="${p.clave}">${p.nombre}</option>`).join('') + '</optgroup>';
  }).join('');
  selPieza.addEventListener('change', async () => {
    const e = seleccion();
    if (!e) return;
    e.pieza.pieza = selPieza.value;
    await reemplazarGrupo(e);
    avisarCambio();
  });

  const selColor = raiz.querySelector('.ed3d__color');
  selColor.innerHTML = COLORES.map(c => `<option value="${c.codigo}">${c.nombre}</option>`).join('');
  selColor.addEventListener('change', async () => {
    const e = seleccion();
    if (!e) return;
    e.pieza.color = Number(selColor.value);
    await reemplazarGrupo(e);
    avisarCambio();
  });

  async function reemplazarGrupo(e) {
    contenedor.remove(e.grupo);
    e.grupo = await motor.grupoPieza(e.pieza.pieza, e.pieza.color);
    contenedor.add(e.grupo);
    sincronizar(e);
    aplicarVisibilidad();
    refrescarSeleccion();
  }

  const selPaso = raiz.querySelector('.ed3d__paso');
  function pintarPasos() {
    selPaso.innerHTML = pasos().map((p, i) =>
      `<option value="${i}">PASO ${i + 1}${p.titulo ? ' · ' + p.titulo.slice(0, 14) : ''}</option>`).join('');
  }
  pintarPasos();
  selPaso.addEventListener('change', () => {
    const e = seleccion();
    if (!e) return;
    const destino = parseInt(selPaso.value, 10);
    if (destino === e.pasoIdx) return;
    const lista = pasos();
    const j = lista[e.pasoIdx].piezas.indexOf(e.pieza);
    if (j >= 0) lista[e.pasoIdx].piezas.splice(j, 1);
    lista[destino].piezas.push(e.pieza);
    e.pasoIdx = destino;
    aplicarVisibilidad();
    refrescarSeleccion();
    avisarCambio();
  });

  raiz.querySelector('.ed3d__duplicar').addEventListener('click', async () => {
    const e = seleccion();
    if (!e) return;
    const copia = JSON.parse(JSON.stringify(e.pieza));
    copia.z = redondear(copia.z + 2);
    pasos()[e.pasoIdx].piezas.push(copia);
    const grupo = await motor.grupoPieza(copia.pieza, copia.color);
    const nueva = { pieza: copia, pasoIdx: e.pasoIdx, grupo };
    entradas.push(nueva);
    contenedor.add(grupo);
    sincronizar(nueva);
    sel = entradas.length - 1;
    refrescarSeleccion();
    avisarCambio();
  });

  raiz.querySelector('.ed3d__borrar').addEventListener('click', () => {
    const e = seleccion();
    if (!e) return;
    const lista = pasos();
    const j = lista[e.pasoIdx].piezas.indexOf(e.pieza);
    if (j >= 0) lista[e.pasoIdx].piezas.splice(j, 1);
    contenedor.remove(e.grupo);
    entradas.splice(sel, 1);
    sel = -1;
    refrescarSeleccion();
    avisarCambio();
  });

  // selección por clic (si no hubo arrastre)
  let clic0 = null;
  lienzo.addEventListener('pointerdown', (e) => { clic0 = [e.clientX, e.clientY]; });
  lienzo.addEventListener('pointerup', (e) => {
    if (!clic0 || Math.hypot(e.clientX - clic0[0], e.clientY - clic0[1]) > 5) return;
    const rect = lienzo.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camara);
    let mejor = -1, mejorDist = Infinity;
    entradas.forEach((en, i) => {
      if (!en.grupo.visible) return;
      const hits = ray.intersectObject(en.grupo, true);
      if (hits.length && hits[0].distance < mejorDist) { mejor = i; mejorDist = hits[0].distance; }
    });
    sel = mejor;
    refrescarSeleccion();
  });

  // teclado (solo cuando el visor tiene el foco cerca)
  lienzo.tabIndex = 0;
  lienzo.addEventListener('keydown', (e) => {
    const mapa = {
      ArrowLeft: () => mover('x', -1), ArrowRight: () => mover('x', 1),
      ArrowUp: () => mover('z', -1), ArrowDown: () => mover('z', 1),
      PageUp: () => mover('y', 1), PageDown: () => mover('y', -1),
      r: () => raiz.querySelector('.ed3d__rotar').click(),
      Delete: () => raiz.querySelector('.ed3d__borrar').click(),
    };
    const fn = mapa[e.key];
    if (fn) { e.preventDefault(); fn(); }
  });

  // bucle de dibujo
  function animar() {
    if (inst.cerrado) return;
    requestAnimationFrame(animar);
    const w = lienzo.clientWidth || raiz.clientWidth;
    const h = 520;
    if (lienzo.width !== Math.floor(w * (window.devicePixelRatio || 1))) {
      renderer.setSize(w, h, false);
      camara.aspect = w / h;
      camara.updateProjectionMatrix();
    }
    controles.update();
    renderer.render(escena, camara);
  }
  animar();

  inst.pintarPasos = pintarPasos;
  await recargar();
  return inst;
}
