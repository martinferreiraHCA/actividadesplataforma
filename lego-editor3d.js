// Editor 3D del modelo terminado — se abre desde lego.html.
// Muestra el modelo completo (todas las piezas de todos los pasos) en un
// visor con órbita y permite corregirlo con comodidad:
//  - selección simple (clic), múltiple (Shift+clic), por paso, y GRUPOS
//    persistentes de piezas que se mueven en conjunto;
//  - movimientos con pasos de 1 stud a 1 mm, rotación en ambos sentidos,
//    parado/volcado, cambio de pieza (con selector de miniaturas) y color;
//  - reporte .txt de entrenamiento: la guía completa + los cambios de la
//    sesión + posiciones LDU + control de conexiones, para pasarle a la IA
//    de desarrollo y mejorar recetas, prompt y plantillas.
// Cada retoque modifica el paso de armado dueño de la pieza: las fichas
// previas quedan coherentes con el resultado final.

import * as THREE from './lego/vendor/three.module.min.js';
import { OrbitControls } from './lego/vendor/OrbitControls.js';
import { PIEZAS, COLORES, CATEGORIAS, KITS, piezaPorClave, colorPorCodigoLdraw } from './lego-catalogo.js';
import { motorLego } from './lego-render.js';
import { serializarPieza, validarConexiones } from './lego-modelo.js';
import { abrirSelectorPieza } from './lego-picker.js';

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
      <input type="range" class="ed3d__hasta" min="1" max="1" value="1" style="width:9rem">
      <span class="ed3d__hasta-rotulo ficha-card__mini-label" style="margin:0"></span>
      <span class="ficha-card__mini-label" style="margin:0 0 0 0.8rem">Paso XZ:</span>
      <select class="campo__input ed3d__pasoxz" style="width:8.5rem">
        <option value="1">1 stud</option>
        <option value="0.5">½ stud</option>
        <option value="0.25">¼ stud (2 mm)</option>
        <option value="0.125">1 mm</option>
        <option value="0.025">0.2 mm</option>
      </select>
      <span class="ficha-card__mini-label" style="margin:0">Altura:</span>
      <select class="campo__input ed3d__pasoy" style="width:9rem">
        <option value="1">1 placa</option>
        <option value="0.5">½ placa</option>
        <option value="0.25">0.8 mm</option>
        <option value="0.3125">1 mm</option>
      </select>
      <button class="ficha-card__accion ed3d__recargar" title="Vuelve a dibujar el modelo desde los pasos">🔄 Recargar</button>
      <button class="ficha-card__accion ed3d__reporte" title="Descarga un reporte .txt con la guía, los cambios de esta sesión y el detalle LDU — para pasarle a la IA de desarrollo y mejorar el sistema">📄 Reporte .txt para la IA</button>
    </div>
    <div class="calib__barra">
      <span class="ficha-card__mini-label" style="margin:0">Mover:</span>
      <button class="ficha-card__accion" data-ed3d-mover="-x">◀ X−</button>
      <button class="ficha-card__accion" data-ed3d-mover="+x">X+ ▶</button>
      <button class="ficha-card__accion" data-ed3d-mover="-z">▲ Z−</button>
      <button class="ficha-card__accion" data-ed3d-mover="+z">Z+ ▼</button>
      <button class="ficha-card__accion" data-ed3d-mover="+y">⬆ Subir</button>
      <button class="ficha-card__accion" data-ed3d-mover="-y">⬇ Bajar</button>
      <button class="ficha-card__accion ed3d__rotar">↻ 90°</button>
      <button class="ficha-card__accion ed3d__rotarm">↺ 90°</button>
      <button class="ficha-card__accion ed3d__parado" title="Vuelca la pieza 90° hacia arriba (viga de pie a lo largo de X)">⤒ Parado</button>
      <button class="ficha-card__accion ed3d__volcado" title="Vuelca la pieza 90° de costado (viga a lo largo de Z con agujeros hacia X; eje vertical)">⤵ Volcado</button>
    </div>
    <div class="calib__barra">
      <span class="ficha-card__mini-label" style="margin:0">Selección:</span>
      <button class="ficha-card__accion ed3d__selpaso" title="Selecciona todas las piezas del paso de la pieza elegida">☑ Todo su paso</button>
      <button class="ficha-card__accion ed3d__agrupar" title="Las piezas seleccionadas quedan agrupadas: al hacer clic en una se seleccionan todas y se mueven en conjunto">⛓ Agrupar</button>
      <button class="ficha-card__accion ed3d__desagrupar">⛓✕ Desagrupar</button>
      <span class="ficha-card__mini-label" style="margin:0 0 0 0.8rem">Pieza:</span>
      <button class="ficha-card__accion ed3d__cambiarpieza" title="Cambiar el tipo de pieza (con miniaturas)">🧩 Cambiar pieza…</button>
      <select class="campo__input ed3d__color" style="width:8rem" title="Cambiar el color"></select>
      <span class="ficha-card__mini-label" style="margin:0">Paso:</span>
      <select class="campo__input ed3d__paso" style="width:8.5rem" title="Mover la pieza a otro paso de la guía"></select>
      <button class="ficha-card__accion ed3d__duplicar">⧉ Duplicar</button>
      <button class="ficha-card__accion ficha-card__accion--peligro ed3d__borrar">✕ Quitar</button>
    </div>
    <p class="calib__ayuda" style="margin-top:0.4rem">
      <strong>Clic</strong> = seleccionar (si la pieza está agrupada, se selecciona todo el grupo) ·
      <strong>Shift+clic</strong> = sumar/quitar piezas de la selección · con varias seleccionadas, <em>Mover / Subir / Bajar / Duplicar / Quitar</em> actúan sobre todas.
      Cada retoque modifica el <strong>paso de armado dueño de cada pieza</strong>: las fichas se actualizan solas.
      Teclado: flechas = mover · RePág/AvPág = subir/bajar · R = rotar · Supr = quitar.
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
  escena.add(new THREE.GridHelper(400, 20, 0xbbaa66, 0xd8d4c8));

  // cajas de selección (una por pieza seleccionada)
  let cajasSel = [];
  function limpiarCajas() {
    cajasSel.forEach(c => escena.remove(c));
    cajasSel = [];
  }

  // entradas: cada entrada referencia el objeto pieza REAL del estado
  let entradas = []; // { pieza, pasoIdx, grupo }
  let seleccion = new Set(); // entradas seleccionadas
  let hastaPaso = Infinity;
  let fotoInicial = new Map(); // pieza(objeto) -> { linea, paso } al abrir/recargar

  const inst = { opciones, recargar, cerrado: false };

  function pasos() { return inst.opciones.getPasos(); }
  function estado() { return inst.opciones.getEstado ? inst.opciones.getEstado() : {}; }
  function avisarCambio() { inst.opciones.onCambio(); }
  function principal() { return seleccion.values().next().value || null; }

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
    seleccion.clear();
    fotoInicial = new Map();
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
        fotoInicial.set(pieza, { linea: serializarPieza(pieza), paso: i });
      }
    }
    const rango = raiz.querySelector('.ed3d__hasta');
    rango.max = Math.max(1, lista.length);
    rango.value = lista.length;
    hastaPaso = lista.length;
    pintarPasos();
    aplicarVisibilidad();
    encuadrar();
    refrescarSeleccion();
  }

  function aplicarVisibilidad() {
    for (const e of entradas) e.grupo.visible = e.pasoIdx < hastaPaso;
    raiz.querySelector('.ed3d__hasta-rotulo').textContent = `${hastaPaso} de ${pasos().length}`;
    for (const e of [...seleccion]) if (!e.grupo.visible) seleccion.delete(e);
    refrescarSeleccion();
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

  function refrescarSeleccion() {
    limpiarCajas();
    for (const e of seleccion) {
      const c = new THREE.Box3Helper(new THREE.Box3().setFromObject(e.grupo), 0xd0a000);
      escena.add(c);
      cajasSel.push(c);
    }
    const p = principal();
    if (!p) {
      hud.textContent = 'Clic en una pieza para editarla · Shift+clic para seleccionar varias';
      raiz.querySelector('.ed3d__parado').classList.remove('lego-colocando');
      raiz.querySelector('.ed3d__volcado').classList.remove('lego-colocando');
      return;
    }
    if (seleccion.size > 1) {
      const grupos = new Set([...seleccion].map(e => e.pieza.grupo).filter(Boolean));
      hud.textContent = `${seleccion.size} piezas seleccionadas` +
        (grupos.size === 1 && [...seleccion].every(e => e.pieza.grupo) ? ' (grupo)' : '') +
        `\nMover / Subir / Bajar / Duplicar / Quitar actúan sobre todas`;
    } else {
      const info = piezaPorClave(p.pieza.pieza);
      const col = colorPorCodigoLdraw(p.pieza.color);
      hud.textContent = `PASO ${p.pasoIdx + 1} · ${info ? info.nombre : p.pieza.pieza} · ${col ? col.nombre : p.pieza.color}` +
        (p.pieza.grupo ? ' · ⛓ agrupada' : '') + `\n` +
        `x ${p.pieza.x}  z ${p.pieza.z}  nivel ${p.pieza.nivel || 0}` +
        (p.pieza.rot ? `  rotar ${p.pieza.rot}` : '') +
        (p.pieza.volcado ? '  volcado' : p.pieza.parado ? '  parado' : '');
    }
    raiz.querySelector('.ed3d__color').value = String(p.pieza.color);
    raiz.querySelector('.ed3d__paso').value = String(p.pasoIdx);
    raiz.querySelector('.ed3d__parado').classList.toggle('lego-colocando', !!p.pieza.parado);
    raiz.querySelector('.ed3d__volcado').classList.toggle('lego-colocando', !!p.pieza.volcado);
  }

  // ---- operaciones ----
  const redondear = (v) => Math.round(v * 1000) / 1000;

  function editarSeleccion(fn) {
    if (!seleccion.size) return;
    for (const e of seleccion) fn(e);
    for (const e of seleccion) sincronizar(e);
    refrescarSeleccion();
    avisarCambio();
  }

  function editarPrincipal(fn) {
    const p = principal();
    if (!p) return;
    if (seleccion.size > 1) {
      hud.textContent = 'Esta acción es de a UNA pieza: dejá una sola seleccionada.';
      return;
    }
    fn(p);
    sincronizar(p);
    refrescarSeleccion();
    avisarCambio();
  }

  function mover(eje, signo) {
    const pxz = parseFloat(raiz.querySelector('.ed3d__pasoxz').value);
    const py = parseFloat(raiz.querySelector('.ed3d__pasoy').value);
    editarSeleccion((e) => {
      if (eje === 'x') e.pieza.x = redondear(e.pieza.x + signo * pxz);
      if (eje === 'z') e.pieza.z = redondear(e.pieza.z + signo * pxz);
      if (eje === 'y') e.pieza.nivel = Math.max(0, redondear((e.pieza.nivel || 0) + signo * py));
    });
  }

  // ---- interfaz superior ----
  raiz.querySelector('.ed3d__hasta').addEventListener('input', (ev) => {
    hastaPaso = parseInt(ev.target.value, 10);
    aplicarVisibilidad();
  });
  raiz.querySelector('.ed3d__recargar').addEventListener('click', recargar);
  raiz.querySelector('.ed3d__reporte').addEventListener('click', descargarReporte);
  raiz.querySelectorAll('[data-ed3d-mover]').forEach(b => b.addEventListener('click', () => {
    mover(b.dataset.ed3dMover[1], b.dataset.ed3dMover[0] === '+' ? 1 : -1);
  }));
  raiz.querySelector('.ed3d__rotar').addEventListener('click', () => editarPrincipal((e) => {
    e.pieza.rot = ((e.pieza.rot || 0) + 90) % 360;
  }));
  raiz.querySelector('.ed3d__rotarm').addEventListener('click', () => editarPrincipal((e) => {
    e.pieza.rot = ((e.pieza.rot || 0) + 270) % 360;
  }));
  raiz.querySelector('.ed3d__parado').addEventListener('click', () => editarPrincipal((e) => {
    e.pieza.parado = !e.pieza.parado;
    if (!e.pieza.parado) delete e.pieza.parado;
    else delete e.pieza.volcado;
  }));
  raiz.querySelector('.ed3d__volcado').addEventListener('click', () => editarPrincipal((e) => {
    e.pieza.volcado = !e.pieza.volcado;
    if (!e.pieza.volcado) delete e.pieza.volcado;
    else delete e.pieza.parado;
  }));

  // ---- selección múltiple y grupos ----
  raiz.querySelector('.ed3d__selpaso').addEventListener('click', () => {
    const p = principal();
    if (!p) return;
    seleccion = new Set(entradas.filter(e => e.pasoIdx === p.pasoIdx && e.grupo.visible));
    refrescarSeleccion();
  });
  raiz.querySelector('.ed3d__agrupar').addEventListener('click', () => {
    if (seleccion.size < 2) { hud.textContent = 'Seleccioná 2 o más piezas (Shift+clic) y después agrupá.'; return; }
    const id = 'g' + Date.now().toString(36);
    for (const e of seleccion) e.pieza.grupo = id;
    refrescarSeleccion();
    avisarCambio();
  });
  raiz.querySelector('.ed3d__desagrupar').addEventListener('click', () => {
    for (const e of seleccion) delete e.pieza.grupo;
    refrescarSeleccion();
    avisarCambio();
  });

  // ---- pieza / color / paso ----
  raiz.querySelector('.ed3d__cambiarpieza').addEventListener('click', () => {
    const p = principal();
    if (!p || seleccion.size > 1) { hud.textContent = 'Elegí UNA sola pieza para cambiarla de tipo.'; return; }
    abrirSelectorPieza({
      kit: (estado().opciones || {}).kit || 'todas',
      actual: p.pieza.pieza,
      titulo: 'Cambiar la pieza por…',
      onElegir: async (clave) => {
        p.pieza.pieza = clave;
        await reemplazarGrupo(p);
        avisarCambio();
      }
    });
  });

  const selColor = raiz.querySelector('.ed3d__color');
  selColor.innerHTML = COLORES.map(c => `<option value="${c.codigo}">${c.nombre}</option>`).join('');
  selColor.addEventListener('change', async () => {
    const p = principal();
    if (!p) return;
    for (const e of seleccion) e.pieza.color = Number(selColor.value);
    for (const e of seleccion) await reemplazarGrupo(e);
    avisarCambio();
  });

  async function reemplazarGrupo(e) {
    contenedor.remove(e.grupo);
    e.grupo = await motor.grupoPieza(e.pieza.pieza, e.pieza.color);
    contenedor.add(e.grupo);
    sincronizar(e);
    aplicarVisibilidad();
  }

  const selPaso = raiz.querySelector('.ed3d__paso');
  function pintarPasos() {
    selPaso.innerHTML = pasos().map((p, i) =>
      `<option value="${i}">PASO ${i + 1}${p.titulo ? ' · ' + p.titulo.slice(0, 14) : ''}</option>`).join('');
  }
  selPaso.addEventListener('change', () => {
    if (!seleccion.size) return;
    const destino = parseInt(selPaso.value, 10);
    const lista = pasos();
    for (const e of seleccion) {
      if (destino === e.pasoIdx) continue;
      const j = lista[e.pasoIdx].piezas.indexOf(e.pieza);
      if (j >= 0) lista[e.pasoIdx].piezas.splice(j, 1);
      lista[destino].piezas.push(e.pieza);
      e.pasoIdx = destino;
    }
    aplicarVisibilidad();
    avisarCambio();
  });

  raiz.querySelector('.ed3d__duplicar').addEventListener('click', async () => {
    if (!seleccion.size) return;
    const copias = [];
    const idGrupo = seleccion.size > 1 ? 'g' + Date.now().toString(36) : null;
    for (const e of seleccion) {
      const copia = JSON.parse(JSON.stringify(e.pieza));
      copia.z = redondear(copia.z + 2);
      if (idGrupo) copia.grupo = idGrupo; else delete copia.grupo;
      pasos()[e.pasoIdx].piezas.push(copia);
      const grupo = await motor.grupoPieza(copia.pieza, copia.color);
      const nueva = { pieza: copia, pasoIdx: e.pasoIdx, grupo };
      entradas.push(nueva);
      contenedor.add(grupo);
      sincronizar(nueva);
      copias.push(nueva);
    }
    seleccion = new Set(copias);
    refrescarSeleccion();
    avisarCambio();
  });

  raiz.querySelector('.ed3d__borrar').addEventListener('click', () => {
    if (!seleccion.size) return;
    const lista = pasos();
    for (const e of seleccion) {
      const j = lista[e.pasoIdx].piezas.indexOf(e.pieza);
      if (j >= 0) lista[e.pasoIdx].piezas.splice(j, 1);
      contenedor.remove(e.grupo);
      entradas.splice(entradas.indexOf(e), 1);
    }
    seleccion.clear();
    refrescarSeleccion();
    avisarCambio();
  });

  // ---- selección por clic ----
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
    let mejor = null, mejorDist = Infinity;
    for (const en of entradas) {
      if (!en.grupo.visible) continue;
      const hits = ray.intersectObject(en.grupo, true);
      if (hits.length && hits[0].distance < mejorDist) { mejor = en; mejorDist = hits[0].distance; }
    }
    if (!mejor) {
      if (!e.shiftKey) { seleccion.clear(); refrescarSeleccion(); }
      return;
    }
    if (e.shiftKey) {
      if (seleccion.has(mejor)) seleccion.delete(mejor);
      else seleccion.add(mejor);
    } else if (mejor.pieza.grupo) {
      // pieza agrupada: se selecciona todo el grupo
      seleccion = new Set(entradas.filter(en => en.pieza.grupo === mejor.pieza.grupo && en.grupo.visible));
    } else {
      seleccion = new Set([mejor]);
    }
    refrescarSeleccion();
  });

  // teclado
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

  // ---- reporte .txt de entrenamiento ----
  function numero(v) {
    const r = Math.round(v * 1000) / 1000;
    return Object.is(r, -0) ? 0 : r;
  }

  function textoReporte() {
    const st = estado();
    const lista = pasos();
    const L = [];
    L.push('# REPORTE DE MODELO LEGO v1 (editor 3D)');
    L.push('# exportado: ' + new Date().toISOString());
    L.push('# Para la IA de desarrollo: usar este reporte para mejorar recetas del prompt,');
    L.push('# plantillas precargadas y validaciones. Las secciones son parseables.');
    L.push('titulo: ' + (st.titulo || '(sin título)'));
    L.push('kit: ' + ((st.opciones || {}).kit || 'todas'));
    L.push('');
    L.push('== GUIA COMPLETA (formato del sistema) ==');
    lista.forEach((p, i) => {
      L.push(`=== PASO: ${p.titulo || 'Paso ' + (i + 1)} ===`);
      if (p.piezas.length) {
        L.push('piezas:');
        p.piezas.forEach(z => L.push(z.raw ? z.raw : serializarPieza(z)));
      }
    });
    L.push('');
    L.push('== CAMBIOS DE ESTA SESION DE EDICION 3D ==');
    const actuales = new Set();
    let cambios = 0;
    lista.forEach((p, i) => p.piezas.forEach(z => {
      if (z.raw) return;
      actuales.add(z);
      const antes = fotoInicial.get(z);
      const ahora = serializarPieza(z);
      if (!antes) {
        L.push(`AGREGADA (paso ${i + 1}): ${ahora}`);
        cambios++;
      } else if (antes.linea !== ahora || antes.paso !== i) {
        L.push(`MODIFICADA (paso ${antes.paso + 1}${antes.paso !== i ? ' → paso ' + (i + 1) : ''}):`);
        L.push(`  antes: ${antes.linea}`);
        L.push(`  ahora: ${ahora}`);
        cambios++;
      }
    }));
    for (const [pieza, antes] of fotoInicial) {
      if (!actuales.has(pieza)) {
        L.push(`QUITADA (era del paso ${antes.paso + 1}): ${antes.linea}`);
        cambios++;
      }
    }
    if (!cambios) L.push('(sin cambios: el reporte documenta el modelo tal como está)');
    L.push('');
    L.push('== DETALLE LDU (posicion del origen y matriz de cada pieza) ==');
    lista.forEach((p, i) => p.piezas.forEach(z => {
      if (z.raw) return;
      const t = motor.transformacion(z);
      if (!t) return;
      L.push(`paso ${i + 1} | ${serializarPieza(z)} | pos: ${t.pos.map(numero).join(' ')} | matriz: ${t.mat.join(' ')}`);
    }));
    L.push('');
    L.push('== RELACIONES (origenes de piezas que se tocan, en LDU) ==');
    const conTransf = [];
    lista.forEach((p, i) => p.piezas.forEach(z => {
      if (z.raw) return;
      const t = motor.transformacion(z);
      if (t) conTransf.push({ z, i, t });
    }));
    let rel = 0;
    for (let a = 0; a < conTransf.length && rel < 60; a++) {
      for (let b = a + 1; b < conTransf.length && rel < 60; b++) {
        const A = conTransf[a], B = conTransf[b];
        const d = [B.t.pos[0] - A.t.pos[0], B.t.pos[1] - A.t.pos[1], B.t.pos[2] - A.t.pos[2]];
        if (Math.abs(d[0]) <= 90 && Math.abs(d[1]) <= 90 && Math.abs(d[2]) <= 90) {
          L.push(`"${A.z.pieza}" (paso ${A.i + 1}) ~ "${B.z.pieza}" (paso ${B.i + 1}): dx=${numero(d[0])} dy=${numero(d[1])} dz=${numero(d[2])}`);
          rel++;
        }
      }
    }
    L.push('');
    L.push('== CONTROL DE CONEXIONES ==');
    try {
      const avisos = validarConexiones(lista);
      L.push(avisos.length ? avisos.join('\n') : '(sin avisos: todas las piezas quedan conectadas)');
    } catch (e) { L.push('(no se pudo validar)'); }
    return L.join('\n');
  }

  function descargarReporte() {
    const blob = new Blob([textoReporte()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reporte-modelo-lego.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

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
  inst.reporte = textoReporte;
  await recargar();
  window.Editor3DLego = inst; // para automatización y depuración
  return inst;
}
