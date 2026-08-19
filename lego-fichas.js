// Guías de ensamble LEGO — controlador de la página lego.html.
// Editor visual de pasos (con cuadrícula y vista 3D), importación por texto,
// asistente IA, fichas imprimibles con comparador de piezas a escala 1:1,
// y exportación a PDF (impresión), LDraw (.ldr) y borrador .json.

import { PIEZAS, COLORES, CATEGORIAS, KITS, piezaPorClave, colorPorCodigoLdraw, piezaEnKit, piezasDeKit, cantidadEnKit, conectoresDe, registrarPiezaImportada } from './lego-catalogo.js';
import { parsearTexto, serializarDoc, nuevoPaso, nuevaPieza, piezasAgrupadas, validarConexiones, datosLineaCruda } from './lego-modelo.js';
import { motorLego } from './lego-render.js';
import { generarPromptLego } from './lego-prompt.js';
import { PLANTILLAS_LEGO } from './lego-plantillas.js';

const STORAGE_KEY = 'gen_fichas_lego';

let state = {
  titulo: '',
  subtitulo: '',
  descripcion: '',
  pasos: [],
  piezasImportadas: [],   // piezas de un modelo .ldr que no están en el catálogo fijo
  opciones: { estiloDoc: 'clasico', numerar: true, bordes: true, salto: true, comparador: true, vistas3d: true, atenuar: false, kit: 'todas', kitsNxt: '' }
};

const OPCIONES_DEF = { estiloDoc: 'clasico', numerar: true, bordes: true, salto: true, comparador: true, vistas3d: true, atenuar: false, kit: 'todas', kitsNxt: '' };

let uid = 1;
function conId(paso) {
  paso.id = 'p' + (uid++);
  return paso;
}

// ============================================================
// Ejemplo / plantilla
// ============================================================
const TEXTO_EJEMPLO = `titulo: El carrito veloz
nivel: Escuela — 3° en adelante
descripcion: Vamos a armar un carrito de carrera con base, motor y techo. Al final vas a poder decorarlo como quieras.

=== PASO: La base con ruedas ===
consigna: Buscá las dos placas con pernos de rueda y la placa larga. Poné las placas con pernos en el suelo y uní todo con la placa larga arriba.
piezas:
placa con ruedas 2x2 gris oscuro en 0 0
placa con ruedas 2x2 gris oscuro en 4 0
placa 2x6 gris claro en 0 0 nivel 1
notas: Las placas son las piezas finitas: 3 placas apiladas miden lo mismo que 1 ladrillo.

=== PASO: El motor ===
consigna: Colocá el ladrillo rojo grande sobre la base, dejando libre un stud adelante y otro atrás.
piezas:
ladrillo 2x4 rojo en 1 0 nivel 2
notas: Fijate que el ladrillo quede bien centrado: tiene que trabar las dos placas de abajo.

=== PASO: La cabina ===
consigna: Ahora la cabina del piloto: un ladrillo azul chiquito adelante del motor.
piezas:
ladrillo 2x2 azul en 1 0 nivel 5
notas: ¿Ves cómo el carrito va creciendo hacia arriba? Cada pieza suma 3 niveles de altura.

=== PASO: El techo y los detalles ===
consigna: Terminá el carrito: el techo liso arriba de la cabina y el faro adelante.
piezas:
lisa 2x2 blanco en 1 0 nivel 8
placa redonda 1x1 amarillo en 0 0 nivel 2
placa redonda 1x1 amarillo en 0 1 nivel 2
notas: Las piezas lisas no tienen studs: quedan como terminación. ¡Carrito listo!`;

// ============================================================
// Utilidades
// ============================================================
function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) { alert(msg); return; }
  t.textContent = msg;
  t.classList.add('toast--visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove('toast--visible'), 3500);
}

function copiarTexto(texto, msgOk) {
  navigator.clipboard.writeText(texto).then(
    () => toast(msgOk || 'Copiado al portapapeles.'),
    () => {
      const ta = document.createElement('textarea');
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast(msgOk || 'Copiado al portapapeles.');
    }
  );
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

let saveTimer = null;
function guardarLuego() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    state.piezasImportadas = piezasImportadasEnUso();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* sin espacio */ }
  }, 400);
}

// Las piezas importadas (medidas de un .ldr) no viven en el catálogo del
// código: se guardan con el borrador y se vuelven a registrar al abrirlo.
function piezasImportadasEnUso() {
  const usadas = new Map();
  for (const p of state.pasos) {
    for (const z of p.piezas) {
      if (z.raw) continue;
      const info = piezaPorClave(z.pieza);
      if (info && info.importada && !usadas.has(info.clave)) {
        usadas.set(info.clave, { dat: info.dat, nombre: info.nombre, w: info.w, d: info.d, alto: info.alto });
      }
    }
  }
  return [...usadas.values()];
}

function recuperarPiezasImportadas(lista) {
  (lista || []).forEach(p => registrarPiezaImportada(p));
}

function cargar() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s && Array.isArray(s.pasos)) {
      recuperarPiezasImportadas(s.piezasImportadas);
      state = Object.assign(state, s);
      state.opciones = Object.assign({}, OPCIONES_DEF, s.opciones || {});
      state.pasos.forEach(conId);
    }
  } catch (e) { /* borrador corrupto: se arranca vacío */ }
}

function nombreArchivo(ext) {
  const base = (state.titulo || 'guia-lego').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'guia-lego';
  return base + '.' + ext;
}

function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// piezas acumuladas hasta el paso i inclusive
function piezasHasta(i) {
  return state.pasos.slice(0, i + 1).flatMap(p => p.piezas);
}

function hayPiezas() {
  return state.pasos.some(p => p.piezas.length);
}

// ============================================================
// Motor 3D (se inicializa perezosamente)
// ============================================================
let _motorProm = null;
function motor() {
  if (!_motorProm) {
    _motorProm = motorLego().catch(err => {
      console.error('motor LEGO:', err);
      toast('No se pudo iniciar el motor 3D. ¿El navegador tiene WebGL?');
      _motorProm = null;
      throw err;
    });
  }
  return _motorProm;
}

const cacheFotos = new Map(); // clave JSON → dataURL
async function fotoPaso(i, opciones = {}) {
  const piezas = piezasHasta(i);
  if (!piezas.length) return null;
  const atenuarHasta = state.opciones.atenuar ? piezasHasta(i - 1).length : 0;
  const k = JSON.stringify([piezas, atenuarHasta, opciones.ancho || 0, opciones.dir || 0, opciones.margen || 0]);
  if (cacheFotos.has(k)) return cacheFotos.get(k);
  const m = await motor();
  const url = await m.fotoModelo(piezas, { atenuarHasta, ...opciones });
  cacheFotos.set(k, url);
  if (cacheFotos.size > 120) cacheFotos.delete(cacheFotos.keys().next().value);
  return url;
}

// ============================================================
// Editor visual — lista de pasos
// ============================================================
const lista = document.getElementById('listaPasos');
let colocando = null; // {paso, pieza} — fila en modo "colocar con clic"

function renderLista() {
  colocando = null;
  lista.innerHTML = '';
  if (!state.pasos.length) {
    const vacio = document.createElement('div');
    vacio.className = 'scratch-vacio';
    vacio.innerHTML = 'Todavía no hay pasos. Agregá el primero con el botón de abajo, o cargá el <strong>ejemplo del carrito</strong> para ver cómo funciona.';
    lista.appendChild(vacio);
    return;
  }
  state.pasos.forEach((paso, i) => lista.appendChild(construirTarjetaPaso(paso, i)));
}

function opcionesPiezaSelect(valor) {
  const disponibles = piezasDeKit(state.opciones.kit);
  let html = CATEGORIAS.map(cat => {
    const lista = disponibles.filter(p => p.cat === cat);
    if (!lista.length) return '';
    return `<optgroup label="${cat}">` + lista.map(p =>
      `<option value="${p.clave}"${p.clave === valor ? ' selected' : ''}>${p.nombre}</option>`
    ).join('') + '</optgroup>';
  }).join('');
  // la pieza actual no está en el kit activo: se muestra igual, marcada
  if (valor && !disponibles.some(p => p.clave === valor)) {
    const info = piezaPorClave(valor);
    html = `<option value="${valor}" selected>⚠ ${info ? info.nombre : valor} (fuera del kit)</option>` + html;
  }
  return html;
}

// Avisos de restricción de kit sobre una lista de pasos
function avisosDeKit(pasos) {
  const kit = state.opciones.kit;
  if (!kit || kit === 'todas') return [];
  const fuera = new Map();
  pasos.forEach((p, i) => {
    for (const z of p.piezas) {
      if (z.raw) { fuera.set('LDraw crudo', (fuera.get('LDraw crudo') || 0) + 1); continue; }
      const info = piezaPorClave(z.pieza);
      if (!piezaEnKit(info, kit)) {
        const nombre = info ? info.nombre : z.pieza;
        fuera.set(nombre, (fuera.get(nombre) || 0) + 1);
      }
    }
  });
  const avisos = [...fuera.entries()].map(([nombre, n]) =>
    `⚠ "${nombre}" (×${n}) no viene en el ${KITS[kit] ? KITS[kit].nombre : 'kit'} — cambiala o quitala.`);
  return avisos;
}

// Control de inventario: ¿alcanzan las piezas con los kits disponibles?
function avisosDeInventario() {
  const kit = state.opciones.kit;
  const nKits = kit === 'nxt' ? parseInt(state.opciones.kitsNxt, 10) || 0 : 0;
  if (!nKits) return [];
  const uso = new Map();
  for (const p of state.pasos) for (const z of p.piezas) {
    if (z.raw) continue;
    uso.set(z.pieza, (uso.get(z.pieza) || 0) + 1);
  }
  const avisos = [];
  for (const [clave, usadas] of uso) {
    const info = piezaPorClave(clave);
    const max = cantidadEnKit(info, kit, nKits);
    if (max !== null && usadas > max) {
      avisos.push(`⚠ "${info ? info.nombre : clave}": el modelo usa ${usadas} pero con ${nKits} kit(s) hay ${max}.`);
    }
  }
  return avisos;
}

function opcionesColorSelect(valor) {
  return COLORES.map(c =>
    `<option value="${c.codigo}"${c.codigo === Number(valor) ? ' selected' : ''}>${c.nombre}</option>`
  ).join('');
}

function construirTarjetaPaso(paso, i) {
  const card = document.createElement('article');
  card.className = 'ficha-card lego-paso';
  card.dataset.id = paso.id;

  // ---- barra superior ----
  const top = document.createElement('div');
  top.className = 'ficha-card__top';
  const resumen = paso.titulo.trim() ? `<span class="ficha-card__resumen">${escHtml(paso.titulo)}</span>` : '';
  top.innerHTML = `<span class="ficha-card__num">PASO ${i + 1} / ${state.pasos.length}</span><span class="ficha-card__tipo lego-badge">🧱 ${paso.piezas.length} pieza(s)</span>${resumen}<span class="ficha-card__top-sep"></span>`;
  const acciones = [
    [paso.plegado ? '▸ Desplegar' : '▾ Plegar', () => { paso.plegado = !paso.plegado; renderLista(); guardarLuego(); }, false],
    ['↑ Subir', () => moverPaso(i, -1), i === 0],
    ['↓ Bajar', () => moverPaso(i, 1), i === state.pasos.length - 1],
    ['⧉ Duplicar', () => duplicarPaso(i), false],
    ['✕ Eliminar', () => eliminarPaso(i), false, true]
  ];
  acciones.forEach(([texto, fn, deshabilitado, peligro]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ficha-card__accion' + (peligro ? ' ficha-card__accion--peligro' : '');
    b.textContent = texto;
    b.disabled = deshabilitado;
    if (deshabilitado) b.style.opacity = '0.35';
    b.addEventListener('click', fn);
    top.appendChild(b);
  });
  card.appendChild(top);
  if (paso.plegado) return card;

  const grid = document.createElement('div');
  grid.className = 'lego-paso__grid';

  // ---- columna izquierda: textos + piezas ----
  const form = document.createElement('div');
  form.className = 'ficha-card__form';

  form.appendChild(campoTexto('Título del paso', paso.titulo, 'Ej: La base con ruedas', v => { paso.titulo = v; guardarLuego(); }));
  form.appendChild(campoArea('Consigna (arriba de la guía visual)', paso.consigna, 'Ej: Buscá estas piezas y armá la base...', 2, v => { paso.consigna = v; guardarLuego(); }));

  const zonaPiezas = document.createElement('div');
  zonaPiezas.className = 'lego-piezas';
  const lbl = document.createElement('span');
  lbl.className = 'ficha-card__mini-label';
  lbl.textContent = 'Piezas que se agregan en este paso';
  zonaPiezas.appendChild(lbl);
  paso.piezas.forEach((z, j) => zonaPiezas.appendChild(filaPieza(card, paso, i, z, j)));
  const btnMas = document.createElement('button');
  btnMas.type = 'button';
  btnMas.className = 'ficha-card__accion';
  btnMas.textContent = '+ Agregar pieza';
  btnMas.addEventListener('click', () => {
    const z = nuevaPieza();
    const ultima = paso.piezas[paso.piezas.length - 1];
    if (ultima && !ultima.raw) Object.assign(z, { pieza: ultima.pieza, color: ultima.color, nivel: ultima.nivel, z: ultima.z + 2 });
    paso.piezas.push(z);
    renderLista();
    guardarLuego();
    refrescarVista3D(document.querySelector(`[data-id="${paso.id}"]`), i);
  });
  zonaPiezas.appendChild(btnMas);
  form.appendChild(zonaPiezas);

  form.appendChild(campoArea('Notas / explicación (debajo de la guía visual)', paso.notas, 'Ej: Las placas son más finitas que los ladrillos...', 2, v => { paso.notas = v; guardarLuego(); }));
  grid.appendChild(form);

  // ---- columna derecha: cuadrícula + vista 3D ----
  const visor = document.createElement('div');
  visor.className = 'lego-visor';

  const lblGrid = document.createElement('span');
  lblGrid.className = 'ficha-card__mini-label';
  lblGrid.textContent = 'Vista desde arriba (cuadrícula en studs) — activá 📍 en una pieza y hacé clic para ubicarla';
  visor.appendChild(lblGrid);

  const canvas = document.createElement('canvas');
  canvas.className = 'lego-grid';
  canvas.addEventListener('click', (e) => clicEnGrid(e, canvas, i));
  visor.appendChild(canvas);
  dibujarGrid(canvas, i);

  const lbl3d = document.createElement('span');
  lbl3d.className = 'ficha-card__mini-label';
  lbl3d.textContent = 'Vista 3D del modelo hasta este paso';
  visor.appendChild(lbl3d);

  const img = document.createElement('img');
  img.className = 'lego-vista3d';
  img.alt = 'Vista 3D del paso ' + (i + 1);
  img.dataset.vista3d = '1';
  visor.appendChild(img);

  const btnVer = document.createElement('button');
  btnVer.type = 'button';
  btnVer.className = 'ficha-card__accion';
  btnVer.textContent = '🔄 Actualizar vista 3D';
  btnVer.addEventListener('click', () => refrescarVista3D(card, i));
  visor.appendChild(btnVer);

  grid.appendChild(visor);
  card.appendChild(grid);

  // primera carga de la vista 3D (asíncrona, sin bloquear)
  setTimeout(() => refrescarVista3D(card, i), 60);
  return card;
}

function filaPieza(card, paso, i, z, j) {
  const fila = document.createElement('div');
  fila.className = 'lego-fila-pieza';

  if (z.raw) {
    const d = datosLineaCruda(z);
    if (d) {
      const et = document.createElement('span');
      et.className = 've-barra-label';
      et.textContent = 'Pieza LDraw ' + d.dat;
      et.title = 'Pieza importada que no está en el catálogo: se dibuja igual, pero se edita como línea LDraw.';
      fila.appendChild(et);
    }
    const inp = document.createElement('input');
    inp.className = 'campo__input lego-fila-pieza__raw';
    inp.value = z.raw;
    inp.title = 'Línea LDraw cruda (modo avanzado)';
    inp.addEventListener('input', () => { z.raw = inp.value; delete z.dat; cambioPieza(card, paso, i); });
    fila.appendChild(inp);
  } else {
    const selP = document.createElement('select');
    selP.className = 'campo__input lego-fila-pieza__pieza';
    selP.innerHTML = opcionesPiezaSelect(z.pieza);
    if (!piezaEnKit(piezaPorClave(z.pieza), state.opciones.kit)) selP.classList.add('lego-fuera-kit');
    selP.addEventListener('change', () => {
      z.pieza = selP.value;
      selP.classList.toggle('lego-fuera-kit', !piezaEnKit(piezaPorClave(z.pieza), state.opciones.kit));
      cambioPieza(card, paso, i);
    });
    fila.appendChild(selP);

    const btnPicker = document.createElement('button');
    btnPicker.type = 'button';
    btnPicker.className = 'ficha-card__accion';
    btnPicker.textContent = '🧩';
    btnPicker.title = 'Elegir la pieza viendo miniaturas';
    btnPicker.addEventListener('click', async () => {
      const mod = await import('./lego-picker.js');
      mod.abrirSelectorPieza({
        kit: state.opciones.kit,
        actual: z.pieza,
        onElegir: (clave) => {
          z.pieza = clave;
          renderLista();
          guardarLuego();
          const c = document.querySelector(`[data-id="${paso.id}"]`);
          if (c) refrescarVista3D(c, i);
        }
      });
    });
    fila.appendChild(btnPicker);

    const selC = document.createElement('select');
    selC.className = 'campo__input lego-fila-pieza__color';
    selC.innerHTML = opcionesColorSelect(z.color);
    const pintar = () => {
      const c = colorPorCodigoLdraw(selC.value);
      selC.style.setProperty('--chip', c ? c.hex : '#888');
    };
    pintar();
    selC.addEventListener('change', () => { z.color = Number(selC.value); pintar(); cambioPieza(card, paso, i); });
    fila.appendChild(selC);

    const num = (etq, valor, min, cb) => {
      const wrap = document.createElement('label');
      wrap.className = 'lego-fila-pieza__num';
      wrap.innerHTML = `<span>${etq}</span>`;
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'campo__input';
      inp.value = valor;
      inp.step = '0.5'; // decimales: engranajes y centrado fino de ejes
      if (min !== null) inp.min = min;
      inp.addEventListener('input', () => { cb(parseFloat(inp.value) || 0); cambioPieza(card, paso, i); });
      wrap.appendChild(inp);
      return wrap;
    };
    fila.appendChild(num('x', z.x, null, v => { z.x = v; }));
    fila.appendChild(num('z', z.z, null, v => { z.z = v; }));
    fila.appendChild(num('nivel', z.nivel, 0, v => { z.nivel = Math.max(0, v); }));

    const selR = document.createElement('select');
    selR.className = 'campo__input lego-fila-pieza__rot';
    selR.title = 'Rotación';
    selR.innerHTML = [0, 90, 180, 270].map(r => `<option value="${r}"${r === (z.rot || 0) ? ' selected' : ''}>${r}°</option>`).join('');
    selR.addEventListener('change', () => { z.rot = Number(selR.value); cambioPieza(card, paso, i); });
    fila.appendChild(selR);

    const btnParado = document.createElement('button');
    btnParado.type = 'button';
    btnParado.className = 'ficha-card__accion';
    btnParado.textContent = '⤒';
    btnParado.title = 'Parado: vuelca la pieza 90° hacia arriba (viga de pie a lo largo de X, agujeros de frente)';
    if (z.parado) btnParado.classList.add('lego-colocando');
    fila.appendChild(btnParado);

    const btnVolcado = document.createElement('button');
    btnVolcado.type = 'button';
    btnVolcado.className = 'ficha-card__accion';
    btnVolcado.textContent = '⤵';
    btnVolcado.title = 'Volcado: vuelca la pieza 90° de costado (viga a lo largo de Z con agujeros hacia X — para clavarle pines; eje vertical)';
    if (z.volcado) btnVolcado.classList.add('lego-colocando');
    fila.appendChild(btnVolcado);

    btnParado.addEventListener('click', () => {
      z.parado = !z.parado;
      if (z.parado) delete z.volcado;
      btnParado.classList.toggle('lego-colocando', !!z.parado);
      btnVolcado.classList.remove('lego-colocando');
      cambioPieza(card, paso, i);
    });
    btnVolcado.addEventListener('click', () => {
      z.volcado = !z.volcado;
      if (z.volcado) delete z.parado;
      btnVolcado.classList.toggle('lego-colocando', !!z.volcado);
      btnParado.classList.remove('lego-colocando');
      cambioPieza(card, paso, i);
    });

    const btnColocar = document.createElement('button');
    btnColocar.type = 'button';
    btnColocar.className = 'ficha-card__accion lego-fila-pieza__colocar';
    btnColocar.textContent = '📍';
    btnColocar.title = 'Colocar con clic en la cuadrícula';
    btnColocar.addEventListener('click', () => {
      const activo = colocando && colocando.pieza === z;
      colocando = activo ? null : { paso: i, pieza: z };
      card.querySelectorAll('.lego-fila-pieza__colocar').forEach(b => b.classList.remove('lego-colocando'));
      if (!activo) btnColocar.classList.add('lego-colocando');
    });
    fila.appendChild(btnColocar);
  }

  const btnDup = document.createElement('button');
  btnDup.type = 'button';
  btnDup.className = 'ficha-card__accion';
  btnDup.textContent = '⧉';
  btnDup.title = 'Duplicar pieza';
  btnDup.addEventListener('click', () => {
    const copia = JSON.parse(JSON.stringify(z));
    if (!copia.raw) copia.z += 2;
    paso.piezas.splice(j + 1, 0, copia);
    renderLista();
    guardarLuego();
  });
  fila.appendChild(btnDup);

  const btnDel = document.createElement('button');
  btnDel.type = 'button';
  btnDel.className = 'ficha-card__accion ficha-card__accion--peligro';
  btnDel.textContent = '✕';
  btnDel.title = 'Quitar pieza';
  btnDel.addEventListener('click', () => {
    paso.piezas.splice(j, 1);
    renderLista();
    guardarLuego();
  });
  fila.appendChild(btnDel);

  return fila;
}

const debouncesPaso = {};
function cambioPieza(card, paso, i) {
  guardarLuego();
  const canvas = card.querySelector('.lego-grid');
  if (canvas) dibujarGrid(canvas, i);
  clearTimeout(debouncesPaso[paso.id]);
  debouncesPaso[paso.id] = setTimeout(() => refrescarVista3D(card, i), 900);
}

async function refrescarVista3D(card, i) {
  if (!card || !card.isConnected) return;
  const img = card.querySelector('[data-vista3d]');
  if (!img) return;
  const piezas = piezasHasta(i);
  if (!piezas.length) { img.removeAttribute('src'); return; }
  try {
    img.classList.add('lego-vista3d--cargando');
    const url = await fotoPaso(i, { ancho: 640, alto: 480 });
    if (url) img.src = url;
  } catch (e) { console.error(e); }
  img.classList.remove('lego-vista3d--cargando');
}

// ---- cuadrícula superior (vista desde arriba) ----
function rangoGrid(i) {
  const previas = piezasHasta(i - 1);
  const actuales = state.pasos[i] ? state.pasos[i].piezas : [];
  let minX = 0, minZ = 0, maxX = 8, maxZ = 8;
  for (const z of previas.concat(actuales)) {
    if (z.raw) continue;
    const info = piezaPorClave(z.pieza);
    if (!info) continue;
    let w = info.w, d = info.d;
    if (z.rot === 90 || z.rot === 270) [w, d] = [d, w];
    minX = Math.min(minX, z.x);
    minZ = Math.min(minZ, z.z);
    maxX = Math.max(maxX, z.x + w);
    maxZ = Math.max(maxZ, z.z + d);
  }
  return { minX: minX - 2, minZ: minZ - 2, maxX: maxX + 2, maxZ: maxZ + 2 };
}

function dibujarGrid(canvas, i) {
  const r = rangoGrid(i);
  const cols = r.maxX - r.minX, filas = r.maxZ - r.minZ;
  const celda = Math.max(10, Math.min(22, Math.floor(340 / cols)));
  canvas.width = cols * celda + 1;
  canvas.height = filas * celda + 1;
  canvas.dataset.rango = JSON.stringify(r);
  canvas.dataset.celda = celda;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // fondo y cuadrícula
  ctx.fillStyle = 'rgba(128,128,128,0.06)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(128,128,128,0.25)';
  ctx.lineWidth = 1;
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath(); ctx.moveTo(c * celda + 0.5, 0); ctx.lineTo(c * celda + 0.5, filas * celda); ctx.stroke();
  }
  for (let f = 0; f <= filas; f++) {
    ctx.beginPath(); ctx.moveTo(0, f * celda + 0.5); ctx.lineTo(cols * celda, f * celda + 0.5); ctx.stroke();
  }
  // ejes en el origen (0,0)
  ctx.strokeStyle = 'rgba(220,80,80,0.7)';
  ctx.lineWidth = 2;
  const ox = (0 - r.minX) * celda, oz = (0 - r.minZ) * celda;
  ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, filas * celda); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, oz); ctx.lineTo(cols * celda, oz); ctx.stroke();

  const pintarPieza = (z, esActual) => {
    if (z.raw) return;
    const info = piezaPorClave(z.pieza);
    if (!info) return;
    let w = info.w, d = info.d;
    if (z.rot === 90 || z.rot === 270) [w, d] = [d, w];
    const px = (z.x - r.minX) * celda, pz = (z.z - r.minZ) * celda;
    const c = colorPorCodigoLdraw(z.color);
    ctx.fillStyle = c ? c.hex : '#999';
    ctx.globalAlpha = esActual ? 0.92 : 0.28;
    ctx.fillRect(px + 1, pz + 1, w * celda - 2, d * celda - 2);
    ctx.globalAlpha = 1;
    if (esActual) {
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, pz + 1, w * celda - 2, d * celda - 2);
      // studs
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      for (let sx = 0; sx < w; sx++) for (let sz = 0; sz < d; sz++) {
        ctx.beginPath();
        ctx.arc(px + (sx + 0.5) * celda, pz + (sz + 0.5) * celda, celda * 0.26, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
  // por nivel, de abajo hacia arriba (lo alto tapa a lo bajo)
  const previas = piezasHasta(i - 1).filter(z => !z.raw).sort((a, b) => (a.nivel || 0) - (b.nivel || 0));
  previas.forEach(z => pintarPieza(z, false));
  const actuales = (state.pasos[i] ? state.pasos[i].piezas : []).filter(z => !z.raw).sort((a, b) => (a.nivel || 0) - (b.nivel || 0));
  actuales.forEach(z => pintarPieza(z, true));
}

function clicEnGrid(e, canvas, i) {
  if (!colocando || colocando.paso !== i) {
    toast('Primero activá 📍 en la pieza que quieras ubicar.');
    return;
  }
  const r = JSON.parse(canvas.dataset.rango);
  const celda = Number(canvas.dataset.celda);
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width) / celda) + r.minX;
  const z = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height) / celda) + r.minZ;
  colocando.pieza.x = x;
  colocando.pieza.z = z;
  guardarLuego();
  renderLista(); // re-dibuja inputs y cuadrícula
  const card = document.querySelector(`[data-id="${state.pasos[i].id}"]`);
  if (card) refrescarVista3D(card, i);
}

function moverPaso(i, delta) {
  const j = i + delta;
  if (j < 0 || j >= state.pasos.length) return;
  [state.pasos[i], state.pasos[j]] = [state.pasos[j], state.pasos[i]];
  renderLista();
  guardarLuego();
}

function duplicarPaso(i) {
  const copia = conId(JSON.parse(JSON.stringify(state.pasos[i])));
  state.pasos.splice(i + 1, 0, copia);
  renderLista();
  guardarLuego();
}

function eliminarPaso(i) {
  if (!confirm('¿Eliminar el paso ' + (i + 1) + '?')) return;
  state.pasos.splice(i, 1);
  renderLista();
  guardarLuego();
}

// ---- campos reutilizables ----
function campoTexto(etiqueta, valor, placeholder, onInput) {
  const div = document.createElement('div');
  div.className = 'campo';
  const lbl = document.createElement('span');
  lbl.className = 'ficha-card__mini-label';
  lbl.textContent = etiqueta;
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'campo__input';
  inp.value = valor || '';
  inp.placeholder = placeholder || '';
  inp.addEventListener('input', () => onInput(inp.value));
  div.append(lbl, inp);
  return div;
}

function campoArea(etiqueta, valor, placeholder, filas, onInput) {
  const div = document.createElement('div');
  div.className = 'campo';
  const lbl = document.createElement('span');
  lbl.className = 'ficha-card__mini-label';
  lbl.textContent = etiqueta;
  const ta = document.createElement('textarea');
  ta.className = 'campo__textarea';
  ta.rows = filas || 2;
  ta.value = valor || '';
  ta.placeholder = placeholder || '';
  ta.addEventListener('input', () => onInput(ta.value));
  div.append(lbl, ta);
  return div;
}

// ============================================================
// Comparador 1:1 — dibujo SVG a tamaño real (mm) para imprimir.
// Cada tipo de pieza tiene su silueta: las apilables muestran los
// studs, las vigas y técnicos sus AGUJEROS, los engranajes/poleas su
// cara de frente con la cruz del eje, y los ejes/pines su largo real.
// Medidas reales LEGO: 1 stud = 8 mm de paso, stud Ø 4.8 mm,
// agujero Ø 4.9 mm, cruz de eje 4.8 mm, placa 3.2 mm de alto.
// ============================================================
const SVG_NS = 'http://www.w3.org/2000/svg';

function svgBase(wmm, hmm) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', wmm + 'mm');
  svg.setAttribute('height', hmm + 'mm');
  svg.setAttribute('viewBox', `0 0 ${wmm} ${hmm}`);
  svg.setAttribute('class', 'lego-cmp__svg');
  return svg;
}

function svgCirculo(svg, cx, cy, r, grosor = 0.5) {
  const c = document.createElementNS(SVG_NS, 'circle');
  c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r);
  c.setAttribute('fill', 'none');
  c.setAttribute('stroke', '#333');
  c.setAttribute('stroke-width', grosor);
  svg.appendChild(c);
  return c;
}

function svgRect(svg, x, y, w, h, rx = 0.8) {
  const r = document.createElementNS(SVG_NS, 'rect');
  r.setAttribute('x', x); r.setAttribute('y', y);
  r.setAttribute('width', w); r.setAttribute('height', h);
  r.setAttribute('rx', rx);
  r.setAttribute('fill', 'none');
  r.setAttribute('stroke', '#333');
  r.setAttribute('stroke-width', 0.6);
  svg.appendChild(r);
  return r;
}

// cruz de eje (perfil real 4.8 mm) centrada en cx,cy
function svgCruz(svg, cx, cy) {
  const b = 0.9; // medio ancho de las aspas
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d',
    `M ${cx - b} ${cy - 2.4} h ${2 * b} v ${2.4 - b} h ${2.4 - b} v ${2 * b} h ${-(2.4 - b)} v ${2.4 - b} h ${-2 * b} v ${-(2.4 - b)} h ${-(2.4 - b)} v ${-2 * b} h ${2.4 - b} Z`);
  p.setAttribute('fill', 'none');
  p.setAttribute('stroke', '#333');
  p.setAttribute('stroke-width', 0.5);
  svg.appendChild(p);
}

function svgComparador(info) {
  const con = conectoresDe(info);
  const esBarra = con.has('ej') || con.has('pi');
  const esRueda = info.redonda && info.suelta; // engranajes, poleas, bujes, llantas

  // --- engranajes / poleas / bujes / llantas: la CARA de frente, a diámetro real ---
  if (esRueda) {
    const diam = (info.alto || 1) * 3.2; // paran de canto: su alto es el diámetro
    const svg = svgBase(diam, diam);
    svgCirculo(svg, diam / 2, diam / 2, diam / 2 - 0.4, 0.6);
    if (con.has('ac')) svgCruz(svg, diam / 2, diam / 2);
    else svgCirculo(svg, diam / 2, diam / 2, 2.45, 0.5);
    return svg;
  }

  // --- ejes y pines: el largo real (para distinguir eje 3 / 4 / 5 / 6) ---
  if (esBarra) {
    const largo = info.w * 8, altoP = 4.8;
    const svg = svgBase(largo, altoP);
    svgRect(svg, 0.3, 0.3, largo - 0.6, altoP - 0.6, con.has('ej') ? 0.6 : 2.2);
    // marcas cada stud para contar el largo
    for (let c = 1; c < info.w; c++) {
      const l = document.createElementNS(SVG_NS, 'line');
      l.setAttribute('x1', c * 8); l.setAttribute('y1', 1);
      l.setAttribute('x2', c * 8); l.setAttribute('y2', altoP - 1);
      l.setAttribute('stroke', '#999');
      l.setAttribute('stroke-width', 0.35);
      svg.appendChild(l);
    }
    return svg;
  }

  const wmm = info.w * 8, dmm = info.d * 8;
  const svg = svgBase(wmm, dmm);

  // contorno
  if (info.redonda && info.w === info.d) {
    svgCirculo(svg, wmm / 2, dmm / 2, wmm / 2 - 0.4, 0.6);
  } else {
    svgRect(svg, 0.3, 0.3, wmm - 0.6, dmm - 0.6);
  }

  // studs arriba (ladrillos, placas, técnicos...)
  let filasStuds = 0;
  if (info.studs === 'todas') filasStuds = info.d;
  else if (typeof info.studs === 'number') filasStuds = info.studs;
  for (let f = 0; f < filasStuds; f++) {
    for (let c = 0; c < info.w; c++) {
      svgCirculo(svg, c * 8 + 4, f * 8 + 4, 2.4, 0.5);
    }
  }

  // vigas y piezas con agujeros de costado (sin studs): sus AGUJEROS al paso real
  if (!filasStuds && (con.has('ap') || con.has('ac')) && info.d === 1 && info.w >= 2) {
    for (let c = 0; c < info.w; c++) {
      svgCirculo(svg, c * 8 + 4, dmm / 2, 2.45, 0.5);
    }
  }
  return svg;
}

// ============================================================
// Fichas (vista previa + impresión)
// ============================================================
async function construirFichaPaso(paso, numero, indice) {
  const op = state.opciones;
  const estilo = op.estiloDoc || 'clasico';
  const infantil = estilo === 'infantil';
  const view = document.createElement('div');
  view.className = 'ficha-view lego-ficha'
    + (op.bordes ? ' ficha-view--borde' : '')
    + (estilo !== 'clasico' ? ' ficha-view--' + estilo : '');
  const PALETA = ['#F6416C', '#00B8A9', '#A66CFF', '#FF8C42', '#38B000', '#3A86FF'];
  if (infantil || estilo === 'colorido') view.style.setProperty('--acento', PALETA[(numero - 1) % PALETA.length]);

  const head = document.createElement('div');
  head.className = 'ficha-view__head';
  if (op.numerar) {
    const num = document.createElement('span');
    num.className = 'ficha-view__num';
    if (infantil) num.innerHTML = '<span class="ficha-view__num-palabra">Paso</span><span class="ficha-view__num-numero">' + numero + '</span>';
    else num.textContent = 'PASO ' + numero;
    head.appendChild(num);
  }
  if (paso.titulo.trim()) {
    const h = document.createElement('h3');
    h.className = 'ficha-view__titulo';
    h.textContent = paso.titulo;
    head.appendChild(h);
  }
  view.appendChild(head);

  if (paso.consigna.trim()) {
    const p = document.createElement('p');
    p.className = 'ficha-view__consigna';
    p.textContent = paso.consigna;
    view.appendChild(p);
  }

  // --- "Buscá estas piezas": miniaturas + cantidades + comparador 1:1 ---
  const grupos = piezasAgrupadas(paso.piezas);
  if (grupos.length) {
    const zona = document.createElement('div');
    zona.className = 'lego-busca';
    const et = document.createElement('span');
    et.className = 'lego-busca__label';
    et.textContent = infantil ? '🔍 ¡Buscá estas piezas!' : '🔍 Buscá estas piezas';
    zona.appendChild(et);
    const items = document.createElement('div');
    items.className = 'lego-busca__items';
    let hayComparador = false;
    for (const g of grupos) {
      const info = piezaPorClave(g.pieza);
      const nombrePieza = info ? info.nombre : g.cruda ? 'Pieza LDraw ' + g.dat : g.pieza;
      const c = colorPorCodigoLdraw(g.color);
      const item = document.createElement('div');
      item.className = 'lego-busca__item';
      const img = document.createElement('img');
      img.className = 'lego-busca__img';
      img.alt = nombrePieza + ' ' + (c ? c.nombre : '');
      try {
        const m = await motor();
        const url = g.cruda ? await m.fotoDat(g.dat, g.color, 200) : await m.fotoPieza(g.pieza, g.color, 200);
        if (url) img.src = url;
      } catch (e) { /* sin motor: la ficha sale sin miniatura */ }
      const cant = document.createElement('span');
      cant.className = 'lego-busca__cant';
      cant.textContent = g.cantidad + ' ×';
      const nom = document.createElement('span');
      nom.className = 'lego-busca__nombre';
      nom.textContent = nombrePieza + (c ? ' · ' + c.nombre : '');
      item.append(img, cant, nom);

      // la electrónica no lleva comparador: es inconfundible y su huella
      // impresa ocuparía media hoja (el motor mide 40×112 mm). Las piezas
      // importadas que no están en el catálogo tampoco: no sabemos su huella.
      if (op.comparador && info && info.cat !== 'Electrónica NXT') {
        hayComparador = true;
        const cmp = document.createElement('div');
        cmp.className = 'lego-cmp';
        cmp.appendChild(svgComparador(info));
        const capa = document.createElement('span');
        capa.className = 'lego-cmp__label';
        capa.textContent = 'tamaño real';
        cmp.appendChild(capa);
        item.appendChild(cmp);
      }
      items.appendChild(item);
    }
    zona.appendChild(items);
    if (op.comparador && hayComparador) {
      const nota = document.createElement('p');
      nota.className = 'lego-cmp__nota';
      nota.textContent = infantil
        ? 'Apoyá cada pieza sobre su dibujo: si coincide, ¡es la correcta! (imprimir al 100 %)'
        : 'Comparador 1:1 — apoyá la pieza sobre el dibujo para verificarla (imprimir al 100 %, tamaño real).';
      zona.appendChild(nota);
    }
    view.appendChild(zona);
  }

  // --- guía visual: el modelo hasta este paso ---
  const cuerpo = document.createElement('div');
  cuerpo.className = 'ficha-view__cuerpo lego-armado';
  const fig = document.createElement('figure');
  fig.className = 'lego-armado__figura';
  const img = document.createElement('img');
  img.alt = 'Modelo armado hasta el paso ' + numero;
  try {
    const url = await fotoPaso(indice, { ancho: 1400, alto: 1000, margen: 1.05 });
    if (url) img.src = url;
  } catch (e) { /* sin motor */ }
  fig.appendChild(img);
  const cap = document.createElement('figcaption');
  cap.textContent = infantil ? 'Así tiene que quedar 👀' : 'Así queda el modelo al terminar este paso';
  fig.appendChild(cap);
  cuerpo.appendChild(fig);

  // vistas adicionales: desde atrás y desde arriba, para armar sin dudas
  if (op.vistas3d) {
    const extras = document.createElement('div');
    extras.className = 'lego-armado__extras';
    const VISTAS = [
      { dir: [-0.72, 0.62, -0.9], titulo: infantil ? 'Desde atrás 🔄' : 'Visto desde atrás' },
      { dir: [0.08, 1, 0.14], titulo: infantil ? 'Desde arriba 🚁' : 'Visto desde arriba' },
    ];
    for (const v of VISTAS) {
      const f = document.createElement('figure');
      f.className = 'lego-armado__extra';
      const im = document.createElement('img');
      im.alt = v.titulo;
      try {
        const url = await fotoPaso(indice, { ancho: 820, alto: 580, dir: v.dir, margen: 1.05 });
        if (url) im.src = url;
      } catch (e) { /* sin motor */ }
      const c = document.createElement('figcaption');
      c.textContent = v.titulo;
      f.append(im, c);
      extras.appendChild(f);
    }
    cuerpo.appendChild(extras);
  }
  view.appendChild(cuerpo);

  if (paso.notas.trim()) {
    const n = document.createElement('div');
    n.className = 'ficha-view__notas';
    n.textContent = (infantil ? '⭐ ' : '') + paso.notas;
    view.appendChild(n);
  }
  if (infantil) {
    const logro = document.createElement('div');
    logro.className = 'ficha-view__logro';
    logro.innerHTML = '<span class="ficha-view__logro-caja"></span> ¡Lo logré!';
    view.appendChild(logro);
  }
  return view;
}

// Portada: modelo final + inventario completo de piezas
async function construirPortada() {
  const todas = state.pasos.flatMap(p => p.piezas);
  if (!todas.length) return null;
  const op = state.opciones;
  const infantil = op.estiloDoc === 'infantil';
  const view = document.createElement('div');
  view.className = 'ficha-view lego-ficha lego-portada'
    + (op.bordes ? ' ficha-view--borde' : '')
    + (op.estiloDoc !== 'clasico' ? ' ficha-view--' + op.estiloDoc : '');

  const head = document.createElement('div');
  head.className = 'ficha-view__head';
  const num = document.createElement('span');
  num.className = 'ficha-view__num';
  num.textContent = infantil ? '🧱 ¿Qué vamos a armar?' : 'EL MODELO TERMINADO';
  head.appendChild(num);
  view.appendChild(head);

  const cuerpo = document.createElement('div');
  cuerpo.className = 'lego-portada__cuerpo';
  const img = document.createElement('img');
  img.className = 'lego-portada__img';
  img.alt = 'Modelo terminado';
  try {
    const url = await fotoPaso(state.pasos.length - 1, { ancho: 1300, alto: 950, margen: 1.05 });
    if (url) img.src = url;
  } catch (e) { /* sin motor */ }
  cuerpo.appendChild(img);

  const inv = document.createElement('div');
  inv.className = 'lego-portada__inventario';
  const grupos = piezasAgrupadas(todas);
  const et = document.createElement('span');
  et.className = 'lego-busca__label';
  et.textContent = 'Todas las piezas que vas a necesitar (' + grupos.reduce((n, g) => n + g.cantidad, 0) + ')';
  inv.appendChild(et);
  const items = document.createElement('div');
  items.className = 'lego-busca__items lego-busca__items--mini';
  for (const g of grupos) {
    const info = piezaPorClave(g.pieza);
    const nombrePieza = info ? info.nombre : g.cruda ? 'Pieza LDraw ' + g.dat : g.pieza;
    const c = colorPorCodigoLdraw(g.color);
    const item = document.createElement('div');
    item.className = 'lego-busca__item';
    const im = document.createElement('img');
    im.className = 'lego-busca__img lego-busca__img--mini';
    try {
      const m = await motor();
      const url = g.cruda ? await m.fotoDat(g.dat, g.color, 140) : await m.fotoPieza(g.pieza, g.color, 140);
      if (url) im.src = url;
    } catch (e) { /* sin miniatura */ }
    const cant = document.createElement('span');
    cant.className = 'lego-busca__cant';
    cant.textContent = g.cantidad + ' ×';
    const nom = document.createElement('span');
    nom.className = 'lego-busca__nombre';
    nom.textContent = nombrePieza + (c ? ' · ' + c.nombre : '');
    item.append(im, cant, nom);
    items.appendChild(item);
  }
  inv.appendChild(items);
  cuerpo.appendChild(inv);
  view.appendChild(cuerpo);
  return view;
}

let generandoFichas = false;
async function generarFichas(destino, nota) {
  if (generandoFichas) return false;
  generandoFichas = true;
  try {
    destino.innerHTML = '';
    if (state.titulo.trim()) {
      const h = document.createElement('h1');
      h.className = 'fichas-impresion__titulo';
      h.textContent = state.titulo;
      destino.appendChild(h);
    }
    if (state.subtitulo.trim()) {
      const s = document.createElement('p');
      s.className = 'fichas-impresion__sub';
      s.textContent = state.subtitulo;
      destino.appendChild(s);
    }
    if ((state.descripcion || '').trim()) {
      const d = document.createElement('div');
      d.className = 'fichas-impresion__descripcion';
      const et = document.createElement('strong');
      et.className = 'fichas-impresion__descripcion-label';
      et.textContent = state.opciones.estiloDoc === 'infantil' ? '🧱 ¿Qué vamos a armar?' : 'Descripción';
      const p = document.createElement('p');
      p.textContent = state.descripcion;
      d.append(et, p);
      destino.appendChild(d);
    }
    if (nota) nota('Dibujando el modelo terminado…');
    const portada = await construirPortada();
    if (portada) {
      if (state.opciones.salto) portada.classList.add('ficha-view--salto');
      destino.appendChild(portada);
    }
    for (let i = 0; i < state.pasos.length; i++) {
      if (nota) nota(`Dibujando el paso ${i + 1} de ${state.pasos.length}…`);
      const v = await construirFichaPaso(state.pasos[i], i + 1, i);
      if (state.opciones.salto) v.classList.add('ficha-view--salto');
      destino.appendChild(v);
    }
    if (nota) nota('');
    return true;
  } finally {
    generandoFichas = false;
  }
}

async function actualizarVistaPrevia() {
  const cont = document.getElementById('vistaFichasLego');
  const nota = document.getElementById('notaFichasLego');
  if (!hayPiezas()) {
    cont.innerHTML = '<div class="scratch-vacio">Cuando cargues pasos con piezas, acá vas a ver las fichas listas para imprimir.</div>';
    return;
  }
  const setNota = (t) => { nota.style.display = t ? 'block' : 'none'; nota.textContent = t; };
  await generarFichas(cont, setNota);
  // control de kit, inventario y conexiones arriba de la vista previa
  let avisos = avisosDeKit(state.pasos).concat(avisosDeInventario());
  try { avisos = avisos.concat(validarConexiones(state.pasos)); } catch (e) { console.error('validar conexiones:', e); }
  if (avisos.length) {
    const div = document.createElement('div');
    div.className = 'alerta alerta--info';
    div.innerHTML = '<strong>Control del modelo (kit, inventario y conexiones):</strong><br>' + avisos.map(escHtml).join('<br>');
    cont.prepend(div);
  }
}

// ============================================================
// Exportaciones
// ============================================================
async function exportarPDF() {
  if (!hayPiezas()) { toast('Todavía no hay pasos con piezas.'); return; }
  const nota = document.getElementById('notaExportLego');
  const setNota = (t) => { nota.style.display = t ? 'block' : 'none'; nota.textContent = t; };
  const area = document.getElementById('areaImpresion');
  await generarFichas(area, setNota);
  window.print();
}

async function exportarLdr() {
  if (!hayPiezas()) { toast('Todavía no hay pasos con piezas.'); return; }
  try {
    const m = await motor();
    const texto = await m.exportarLdr(state);
    descargarBlob(new Blob([texto], { type: 'text/plain' }), nombreArchivo('ldr'));
    toast('Modelo LDraw descargado: se abre con LPub3D, LDView o BrickLink Studio.');
  } catch (e) {
    console.error(e);
    toast('No se pudo exportar el modelo.');
  }
}

function exportarJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  descargarBlob(blob, nombreArchivo('json'));
}

function importarJSON(texto) {
  try {
    const s = JSON.parse(texto);
    if (!s || !Array.isArray(s.pasos)) throw new Error('formato');
    recuperarPiezasImportadas(s.piezasImportadas);
    state = Object.assign(state, s);
    state.opciones = Object.assign(state.opciones, s.opciones || {});
    state.pasos.forEach(conId);
    cacheFotos.clear();
    sincronizarCampos();
    renderLista();
    guardarLuego();
    toast('Borrador cargado: ' + state.pasos.length + ' paso(s).');
  } catch (e) {
    toast('Ese archivo no parece un borrador de guía LEGO.');
  }
}

// ============================================================
// Importar texto / IA
// ============================================================
function mostrarAvisos(contId, avisos) {
  const cont = document.getElementById(contId);
  cont.innerHTML = '';
  if (!avisos.length) return;
  const div = document.createElement('div');
  div.className = 'alerta alerta--info';
  div.innerHTML = '<strong>Avisos:</strong><br>' + avisos.map(escHtml).join('<br>');
  cont.appendChild(div);
}

// opciones.validar = false para los modelos importados: el validador de
// conexiones está pensado para las guías escritas a mano y en un modelo
// grande, hecho en otro programa, solo generaría ruido.
function cargarDocParseado(res, reemplazar, avisosId, opciones = {}) {
  const validar = opciones.validar !== false;
  if (res.doc) {
    res.avisos = res.avisos.concat(avisosDeKit(res.doc.pasos));
    if (validar) {
      try { res.avisos = res.avisos.concat(validarConexiones(res.doc.pasos)); } catch (e) { console.error('validar conexiones:', e); }
    }
    // Guías largas (típico al importar un modelo entero): los pasos entran
    // plegados menos el primero. Si no, el editor tiene que dibujar cientos de
    // selectores de pieza de golpe y la página se congela unos segundos.
    const piezasNuevas = res.doc.pasos.reduce((n, p) => n + p.piezas.length, 0);
    if (res.doc.pasos.length > 8 || piezasNuevas > 60) {
      res.doc.pasos.forEach((p, i) => { p.plegado = i > 0; });
      res.avisos.push('Los pasos entraron plegados para que el editor no se ponga lento: abrí el que quieras con «▸ Desplegar».');
    }
  }
  mostrarAvisos(avisosId, res.avisos);
  if (!res.doc) {
    toast('No se encontraron pasos en el texto. ¿Están los "=== PASO: ... ==="?');
    return false;
  }
  res.doc.pasos.forEach(conId);
  if (reemplazar || !state.pasos.length) {
    state.titulo = res.doc.titulo || state.titulo;
    state.subtitulo = res.doc.subtitulo || state.subtitulo;
    state.descripcion = res.doc.descripcion || state.descripcion;
    state.pasos = res.doc.pasos;
  } else {
    state.pasos = state.pasos.concat(res.doc.pasos);
  }
  cacheFotos.clear();
  sincronizarCampos();
  renderLista();
  guardarLuego();
  toast('Se cargaron ' + res.doc.pasos.length + ' paso(s).' + (res.avisos.length ? ' Mirá los avisos.' : ''));
  document.querySelector('.tab-modo[data-modo="visual"]')?.click();
  return true;
}

// ============================================================
// Sincronizar campos del documento
// ============================================================
function sincronizarCampos() {
  document.getElementById('ldTitulo').value = state.titulo || '';
  document.getElementById('ldSubtitulo').value = state.subtitulo || '';
  document.getElementById('ldDescripcion').value = state.descripcion || '';
  document.getElementById('ldEstiloDoc').value = state.opciones.estiloDoc || 'clasico';
  document.getElementById('ldNumerar').checked = !!state.opciones.numerar;
  document.getElementById('ldBordes').checked = !!state.opciones.bordes;
  document.getElementById('ldSalto').checked = !!state.opciones.salto;
  document.getElementById('ldComparador').checked = !!state.opciones.comparador;
  document.getElementById('ldVistas3d').checked = !!state.opciones.vistas3d;
  document.getElementById('ldAtenuar').checked = !!state.opciones.atenuar;
  document.getElementById('iaKitNxt').checked = state.opciones.kit === 'nxt';
  document.getElementById('ldKitsNxt').value = state.opciones.kitsNxt || '';
  refrescarCamposKit();
}

// muestra/oculta el campo "¿cuántos kits?" y la nota del kit en el panel IA
function refrescarCamposKit() {
  const esNxt = state.opciones.kit === 'nxt';
  document.getElementById('campoKitsNxt').style.display = esNxt ? '' : 'none';
  const nota = document.getElementById('iaKitInfo');
  if (nota) {
    if (esNxt) {
      const n = parseInt(state.opciones.kitsNxt, 10) || 0;
      nota.style.display = '';
      nota.innerHTML = '🧱 <strong>Kit activo:</strong> ' + escHtml(KITS.nxt.nombre) +
        (n ? ` × ${n} — el prompt limita las piezas y sus cantidades a lo que traen ${n} kit(s).`
           : ' — el prompt limita el diseño a las piezas de ese kit (sin límite de cantidad).');
    } else {
      nota.style.display = 'none';
    }
  }
}

// ============================================================
// Rearmar los pasos: reparte TODAS las piezas del modelo en pasos
// nuevos, de abajo hacia arriba. Es lo que cierra el círculo del modelo
// importado: se retoca en el editor 3D y las fichas se rehacen solas.
// ============================================================

// Altura de la base de una pieza, en placas (para ordenar el armado)
async function nivelDePieza(z) {
  if (!z.raw) return z.nivel || 0;
  const d = datosLineaCruda(z);
  const t = String(z.raw).trim().split(/\s+/);
  if (!d || t.length < 15) return 0;
  const nums = t.slice(2, 14).map(Number);
  if (nums.some(v => !isFinite(v))) return 0;
  try {
    const m = await motor();
    const caja = await m.cajaColocada(d.dat, nums.slice(0, 3), nums.slice(3));
    return -caja.maxY / 8;
  } catch (e) { return 0; }
}

async function rearmarPasos() {
  const todas = state.pasos.flatMap(p => p.piezas);
  if (!todas.length) { toast('Todavía no hay piezas para repartir en pasos.'); return; }
  const porPaso = Math.max(1, Math.min(40, parseInt(document.getElementById('ldRearmarPorPaso').value, 10) || 6));
  if (!confirm(`Se van a rehacer TODOS los pasos con las ${todas.length} piezas del modelo, de abajo hacia arriba y hasta ${porPaso} pieza(s) por paso.\n\nLas consignas y las notas que hayas escrito en los pasos actuales se pierden. ¿Seguimos?`)) return;
  const btn = document.getElementById('btnRearmarPasos');
  btn.disabled = true;
  try {
    const m = await motor();
    await m.medirTodas(todas);
    const items = [];
    for (const z of todas) {
      items.push({ pieza: z, nivel: Math.round((await nivelDePieza(z)) * 10) / 10, orden: items.length });
    }
    const mod = await import('./lego-importar-ldr.js');
    const nuevos = mod.pasosPorCapas(items, porPaso);
    state.pasos = nuevos.map(conId);
    if (state.pasos.length > 8) state.pasos.forEach((p, i) => { p.plegado = i > 0; });
    cacheFotos.clear();
    renderLista();
    guardarLuego();
    toast('Listo: ' + state.pasos.length + ' paso(s) nuevos. Generá la vista previa para ver las fichas.');
  } catch (e) {
    console.error('rearmar pasos:', e);
    toast('No se pudieron rearmar los pasos.');
  } finally {
    btn.disabled = false;
  }
}

// ============================================================
// Descargas del modelo en otros formatos (.png, .stl, .csv, BrickLink)
// ============================================================
async function exportarPNG() {
  if (!hayPiezas()) { toast('Todavía no hay piezas para dibujar.'); return; }
  notaExport('Dibujando el modelo en alta…');
  try {
    const url = await fotoPaso(state.pasos.length - 1, { ancho: 2400, alto: 1800, margen: 1.06 });
    if (!url) throw new Error('sin imagen');
    const mod = await import('./lego-exportar.js');
    descargarBlob(mod.dataURLaBlob(url), nombreArchivo('png'));
    notaExport('Imagen .png descargada.');
  } catch (e) {
    console.error('png:', e);
    notaExport('No se pudo generar la imagen.');
  }
}

async function exportarSTL() {
  if (!hayPiezas()) { toast('Todavía no hay piezas para exportar.'); return; }
  notaExport('Armando la malla 3D… (en modelos grandes tarda un poco)');
  try {
    const m = await motor();
    const triangulos = await m.trianglesModelo(state.pasos.flatMap(p => p.piezas));
    if (!triangulos.length) throw new Error('sin triángulos');
    const mod = await import('./lego-exportar.js');
    const blob = mod.stlBinario(triangulos);
    descargarBlob(blob, nombreArchivo('stl'));
    const mb = (blob.size / 1048576).toFixed(1);
    notaExport(`Malla .stl descargada: ${(triangulos.length / 9).toLocaleString('es')} triángulos, ${mb} MB. Está a tamaño real (1 stud = 8 mm) y con Z hacia arriba.`);
  } catch (e) {
    console.error('stl:', e);
    notaExport('No se pudo generar la malla 3D.');
  }
}

async function exportarCSV() {
  if (!hayPiezas()) { toast('Todavía no hay piezas para listar.'); return; }
  const mod = await import('./lego-exportar.js');
  descargarBlob(new Blob([mod.inventarioCSV(state)], { type: 'text/csv;charset=utf-8' }), nombreArchivo('csv'));
  notaExport('Lista de piezas .csv descargada (se abre con Excel o LibreOffice).');
}

async function exportarBrickLink() {
  if (!hayPiezas()) { toast('Todavía no hay piezas para listar.'); return; }
  const mod = await import('./lego-exportar.js');
  const { xml, sinColor } = mod.listaBrickLink(state);
  descargarBlob(new Blob([xml], { type: 'application/xml' }), nombreArchivo('bricklink.xml'));
  notaExport('Lista de compra descargada. En BrickLink: Want → Upload → Wanted List XML.'
    + (sinColor ? ` ${sinColor} pieza(s) van sin color: BrickLink las busca en cualquier color.` : ''));
}

function notaExport(texto) {
  const nota = document.getElementById('notaExportLego');
  nota.style.display = '';
  nota.textContent = texto;
}

// ============================================================
// Importar un modelo LDraw (.ldr / .mpd) y desarmarlo en pasos
// ============================================================
let analisisModelo = null;   // resultado de analizar el archivo elegido
let textoModeloLdr = '';     // el texto del archivo (para re-analizar si cambia la biblioteca)
let nombreModeloLdr = '';

function importadorLdr() {
  return import('./lego-importar-ldr.js');
}

function estadoImport(texto) {
  const el = document.getElementById('ldEstadoImport');
  if (el) el.textContent = texto || '';
}

function tituloDesdeArchivo(nombre) {
  return String(nombre || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

function pintarResumenModelo(a) {
  const cont = document.getElementById('ldResumen');
  const datos = [
    { n: a.total, et: a.total === 1 ? 'pieza en el modelo' : 'piezas en el modelo' },
    { n: a.tipos.size, et: 'tipos distintos' },
    { n: a.pasosArchivo, et: a.pasosArchivo === 1 ? 'paso en el archivo' : 'pasos en el archivo' },
  ];
  if (a.submodelos) datos.push({ n: a.submodelos, et: 'submodelos' });
  if (a.faltantes.length) datos.push({ n: a.piezasFaltantes, et: 'piezas sin archivo', falta: true });
  cont.style.display = '';
  cont.innerHTML = '<span class="ld-resumen__titulo">' + escHtml(nombreModeloLdr) + '</span>'
    + '<div class="ld-resumen__datos">'
    + datos.map(d => '<span class="ld-resumen__dato"><span class="ld-resumen__num'
        + (d.falta ? ' ld-resumen__num--falta' : '') + '">' + d.n + '</span>'
        + '<span class="ld-resumen__et">' + escHtml(d.et) + '</span></span>').join('')
    + '</div>'
    + (a.faltantes.length
      ? '<p class="ld-estado" style="margin-top:0.8rem">⚠ No están en la biblioteca local: <strong>'
        + escHtml(a.faltantes.slice(0, 10).join(', ')) + (a.faltantes.length > 10 ? '…' : '')
        + '</strong>. Esas piezas se van a saltear — cargá el <code>complete.zip</code> de LDraw (más abajo) para incluirlas.</p>'
      : '<p class="ld-estado" style="margin-top:0.8rem">✅ Todas las piezas del modelo se pueden dibujar.</p>');
}

function refrescarOpcionesImport() {
  const auto = document.getElementById('ldPasosAuto');
  document.getElementById('ldCampoPorPaso').style.display = auto.checked ? '' : 'none';
}

async function analizarModeloElegido(archivo) {
  if (!archivo) return;
  const resumen = document.getElementById('ldResumen');
  const opciones = document.getElementById('ldOpciones');
  mostrarAvisos('avisosLegoModelo', []);
  analisisModelo = null;
  nombreModeloLdr = archivo.name || 'modelo.ldr';
  opciones.style.display = 'none';
  resumen.style.display = '';
  resumen.innerHTML = '<span class="ld-resumen__titulo">Analizando ' + escHtml(nombreModeloLdr) + '…</span>';
  try {
    const mod = await importadorLdr();
    textoModeloLdr = await mod.leerArchivoModelo(archivo);
    const a = await mod.analizarModelo(textoModeloLdr);
    if (!a.total) {
      resumen.innerHTML = '<span class="ld-resumen__titulo">No se encontraron piezas</span>'
        + '<p class="ld-estado">El archivo no tiene líneas de pieza LDraw. ¿Es un .ldr o .mpd de verdad?</p>';
      return;
    }
    analisisModelo = a;
    pintarResumenModelo(a);
    const conPasos = a.pasosArchivo > 1;
    const radioArchivo = document.getElementById('ldPasosArchivo');
    radioArchivo.disabled = !conPasos;
    radioArchivo.parentElement.style.opacity = conPasos ? '' : '0.5';
    radioArchivo.parentElement.title = conPasos ? '' : 'Este archivo no trae pasos marcados.';
    radioArchivo.checked = conPasos;
    document.getElementById('ldPasosAuto').checked = !conPasos;
    refrescarOpcionesImport();
    opciones.style.display = '';
  } catch (e) {
    console.error('importar modelo:', e);
    resumen.innerHTML = '<span class="ld-resumen__titulo">No se pudo leer el archivo</span>'
      + '<p class="ld-estado">' + escHtml(e.message || String(e)) + '</p>';
  }
}

async function importarModeloLdr() {
  if (!analisisModelo) return;
  const btn = document.getElementById('btnImportarModelo');
  btn.disabled = true;
  estadoImport('Armando la guía…');
  try {
    const mod = await importadorLdr();
    const res = await mod.construirGuia(analisisModelo, {
      usarPasosArchivo: document.getElementById('ldPasosArchivo').checked,
      piezasPorPaso: document.getElementById('ldPiezasPorPaso').value,
      titulo: state.titulo || tituloDesdeArchivo(nombreModeloLdr),
      onProgreso: estadoImport,
    });
    if (!res.doc) {
      mostrarAvisos('avisosLegoModelo', res.avisos);
      toast('No se pudo armar la guía con ese archivo.');
      return;
    }
    res.avisos.push('✏ Para retocarlo: «🧊 Abrir el editor 3D del modelo» (más abajo) — movés, girás, cambiás de color o borrás cualquier pieza. Con «🔁 Rearmar los pasos por capas» las fichas se rehacen solas con el modelo ya editado.');
    const reemplazar = document.getElementById('chkReemplazarLegoModelo').checked;
    cargarDocParseado(res, reemplazar, 'avisosLegoModelo', { validar: false });
  } catch (e) {
    console.error('importar modelo:', e);
    mostrarAvisos('avisosLegoModelo', ['No se pudo importar el modelo: ' + (e.message || e)]);
    toast('No se pudo importar el modelo.');
  } finally {
    btn.disabled = false;
    estadoImport('');
  }
}

async function cargarBibliotecaLdr(archivo) {
  if (!archivo) return;
  const est = document.getElementById('ldEstadoBiblioteca');
  est.textContent = 'Leyendo el zip… (puede tardar unos segundos)';
  try {
    const mod = await importadorLdr();
    const r = await mod.usarBibliotecaZip(archivo);
    est.textContent = '✅ ' + r.piezas.toLocaleString('es') + ' archivos de pieza disponibles en esta sesión.';
    cacheFotos.clear();
    if (textoModeloLdr) {
      est.textContent += ' Revisando el modelo de nuevo…';
      const a = await mod.analizarModelo(textoModeloLdr);
      analisisModelo = a;
      pintarResumenModelo(a);
      est.textContent = '✅ ' + r.piezas.toLocaleString('es') + ' archivos de pieza disponibles en esta sesión.';
    }
  } catch (e) {
    console.error('biblioteca LDraw:', e);
    est.textContent = '⚠ ' + (e.message || 'No se pudo leer el zip.');
  }
}

function initImportarModelo() {
  const input = document.getElementById('inputModeloLdr');
  const zona = document.getElementById('ldDrop');
  document.getElementById('btnElegirModelo').addEventListener('click', () => input.click());
  zona.addEventListener('click', (e) => { if (e.target === zona) input.click(); });
  input.addEventListener('change', () => {
    const f = input.files && input.files[0];
    input.value = '';
    analizarModeloElegido(f);
  });
  ['dragenter', 'dragover'].forEach(ev => zona.addEventListener(ev, (e) => {
    e.preventDefault();
    zona.classList.add('ld-drop--encima');
  }));
  ['dragleave', 'drop'].forEach(ev => zona.addEventListener(ev, (e) => {
    e.preventDefault();
    zona.classList.remove('ld-drop--encima');
  }));
  zona.addEventListener('drop', (e) => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) analizarModeloElegido(f);
  });

  document.querySelectorAll('input[name="ldModoPasos"]').forEach(r =>
    r.addEventListener('change', refrescarOpcionesImport));
  document.getElementById('btnImportarModelo').addEventListener('click', importarModeloLdr);

  const inputBib = document.getElementById('inputBibliotecaLdr');
  document.getElementById('btnBibliotecaLdr').addEventListener('click', () => inputBib.click());
  inputBib.addEventListener('change', () => {
    const f = inputBib.files && inputBib.files[0];
    inputBib.value = '';
    cargarBibliotecaLdr(f);
  });
}

// ============================================================
// Init
// ============================================================
function init() {
  cargar();
  sincronizarCampos();
  renderLista();

  // Enlace al calibrador, solo para el administrador del sistema:
  // se habilita en ESTE navegador visitando lego.html?admin=1 (y se
  // apaga con ?admin=0). Los estudiantes nunca lo ven.
  try {
    const admin = new URLSearchParams(location.search).get('admin');
    if (admin === '1') localStorage.setItem('gen_lego_admin', '1');
    if (admin === '0') localStorage.removeItem('gen_lego_admin');
    if (localStorage.getItem('gen_lego_admin') === '1') {
      document.getElementById('linkCalibrador').style.display = '';
    }
  } catch (e) { /* sin localStorage: el enlace queda oculto */ }

  document.getElementById('ldTitulo').addEventListener('input', e => { state.titulo = e.target.value; guardarLuego(); });
  document.getElementById('ldSubtitulo').addEventListener('input', e => { state.subtitulo = e.target.value; guardarLuego(); });
  document.getElementById('ldDescripcion').addEventListener('input', e => { state.descripcion = e.target.value; guardarLuego(); });

  document.getElementById('ldEstiloDoc').addEventListener('change', e => { state.opciones.estiloDoc = e.target.value; guardarLuego(); });
  [['ldNumerar', 'numerar'], ['ldBordes', 'bordes'], ['ldSalto', 'salto'], ['ldComparador', 'comparador'], ['ldVistas3d', 'vistas3d']].forEach(([id, key]) => {
    document.getElementById(id).addEventListener('change', e => { state.opciones[key] = e.target.checked; guardarLuego(); });
  });
  document.getElementById('ldAtenuar').addEventListener('change', e => {
    state.opciones.atenuar = e.target.checked;
    cacheFotos.clear();
    guardarLuego();
  });
  document.getElementById('iaKitNxt').addEventListener('change', e => {
    state.opciones.kit = e.target.checked ? 'nxt' : 'todas';
    refrescarCamposKit();
    renderLista(); // los selectores de pieza se filtran por kit
    guardarLuego();
    const avisos = avisosDeKit(state.pasos);
    if (avisos.length) toast(avisos.length + ' tipo(s) de pieza cargados no vienen en el kit — quedan marcados con ⚠ en el editor.');
  });
  document.getElementById('ldKitsNxt').addEventListener('input', e => {
    state.opciones.kitsNxt = e.target.value;
    refrescarCamposKit();
    guardarLuego();
  });

  // ---- pestañas de modo ----
  document.querySelectorAll('.tab-modo').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-modo').forEach(t => t.classList.toggle('active', t === tab));
      const modo = tab.dataset.modo;
      document.getElementById('panel-lego-visual').style.display = modo === 'visual' ? '' : 'none';
      document.getElementById('panel-lego-texto').style.display = modo === 'texto' ? '' : 'none';
      document.getElementById('panel-lego-ia').style.display = modo === 'ia' ? '' : 'none';
      document.getElementById('panel-lego-modelo').style.display = modo === 'modelo' ? '' : 'none';
    });
  });

  // ---- editor visual ----
  function agregarPaso() {
    const p = conId(nuevoPaso());
    if (!state.pasos.length) {
      p.titulo = 'La base';
      p.consigna = 'Buscá estas piezas y armá la base del modelo.';
      p.piezas.push(nuevaPieza());
    }
    state.pasos.push(p);
    renderLista();
    guardarLuego();
    const cards = lista.querySelectorAll('.ficha-card');
    cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  document.getElementById('btnAgregarPaso').addEventListener('click', agregarPaso);
  document.getElementById('btnAgregarPasoAbajo').addEventListener('click', agregarPaso);

  const barraPlantillas = document.getElementById('barraPlantillasLego');
  PLANTILLAS_LEGO.forEach(pl => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tag';
    b.textContent = pl.nombre;
    b.title = pl.descripcion;
    b.addEventListener('click', () => {
      if (state.pasos.length && !confirm(`Se reemplaza lo que tenés cargado por "${pl.nombre}". ¿Seguimos?`)) return;
      const res = parsearTexto(pl.texto);
      state.pasos = [];
      cargarDocParseado(res, true, 'avisosLegoTexto');
    });
    barraPlantillas.appendChild(b);
  });

  document.getElementById('btnImportarLegoJson').addEventListener('click', () => document.getElementById('inputLegoJson').click());
  document.getElementById('inputLegoJson').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importarJSON(reader.result);
    reader.readAsText(file);
    e.target.value = '';
  });

  // ---- importar texto ----
  document.getElementById('btnEjemploLegoTexto').addEventListener('click', () => {
    document.getElementById('textareaLegoTexto').value = TEXTO_EJEMPLO;
  });
  document.getElementById('btnProcesarLegoTexto').addEventListener('click', () => {
    const texto = document.getElementById('textareaLegoTexto').value;
    const res = parsearTexto(texto);
    cargarDocParseado(res, document.getElementById('chkReemplazarLego').checked, 'avisosLegoTexto');
  });

  // ---- asistente IA ----
  document.getElementById('formPromptLego').addEventListener('submit', (e) => {
    e.preventDefault();
    const prompt = generarPromptLego({
      queArmar: document.getElementById('iaLegoQue').value,
      pasos: document.getElementById('iaLegoPasos').value,
      publico: document.getElementById('iaLegoInfantil').checked,
      piezasDisponibles: document.getElementById('iaLegoPiezas').value,
      extra: document.getElementById('iaLegoExtra').value,
      titulo: state.titulo,
      nivel: state.subtitulo,
      kit: state.opciones.kit,
      cantidadKits: state.opciones.kit === 'nxt' ? (parseInt(state.opciones.kitsNxt, 10) || 0) : 0
    });
    const caja = document.getElementById('cajaPrompt');
    caja.textContent = prompt;
    caja.classList.add('caja-prompt--visible');
    document.getElementById('accionesPromptLego').style.display = '';
    copiarTexto(prompt, 'Prompt generado y copiado — pegalo en tu IA.');
  });
  document.getElementById('btnCopiarPromptLego').addEventListener('click', () => {
    copiarTexto(document.getElementById('cajaPrompt').textContent);
  });
  document.getElementById('btnProcesarIALego').addEventListener('click', () => {
    let texto = document.getElementById('textareaRespuestaIALego').value;
    // tolerar respuestas con cerco de código markdown
    texto = texto.replace(/^```[a-z]*\s*$/gmi, '');
    const res = parsearTexto(texto);
    cargarDocParseado(res, document.getElementById('chkReemplazarLegoIA').checked, 'avisosLegoIA');
  });

  // ---- editor 3D del modelo terminado ----
  let recargaEditor = null;
  document.getElementById('btnAbrirEditor3D').addEventListener('click', async () => {
    if (!hayPiezas()) { toast('Todavía no hay pasos con piezas para editar.'); return; }
    const btn = document.getElementById('btnAbrirEditor3D');
    btn.disabled = true;
    btn.textContent = 'Cargando el modelo…';
    try {
      const mod = await import('./lego-editor3d.js');
      await mod.abrirEditor3D({
        contenedorId: 'editor3dLego',
        getPasos: () => state.pasos,
        getEstado: () => state,
        onRearmarPasos: rearmarPasos,
        onCambio: () => {
          // cada retoque en 3D modifica el paso dueño de la pieza:
          // se invalidan las fotos y se refresca el editor de pasos
          cacheFotos.clear();
          guardarLuego();
          clearTimeout(recargaEditor);
          recargaEditor = setTimeout(renderLista, 1200);
        }
      });
      btn.textContent = '🔄 Recargar el editor 3D (si cambiaste pasos a mano)';
    } catch (e) {
      console.error(e);
      toast('No se pudo abrir el editor 3D.');
      btn.textContent = '🧊 Abrir el editor 3D del modelo';
    }
    btn.disabled = false;
  });

  // ---- vista previa ----
  initImportarModelo();

  document.getElementById('btnActualizarFichas').addEventListener('click', actualizarVistaPrevia);

  // ---- descargas ----
  document.getElementById('btnLegoPDF').addEventListener('click', exportarPDF);
  document.getElementById('btnLegoLDR').addEventListener('click', exportarLdr);
  document.getElementById('btnLegoPNG').addEventListener('click', exportarPNG);
  document.getElementById('btnLegoSTL').addEventListener('click', exportarSTL);
  document.getElementById('btnLegoCSV').addEventListener('click', exportarCSV);
  document.getElementById('btnLegoBrickLink').addEventListener('click', exportarBrickLink);
  document.getElementById('btnRearmarPasos').addEventListener('click', rearmarPasos);
  document.getElementById('btnLegoJSON').addEventListener('click', exportarJSON);
  document.getElementById('btnLegoCopiarTexto').addEventListener('click', () => {
    copiarTexto(serializarDoc(state), 'Guía copiada como texto: editala donde quieras y volvé a pegarla en «Importar Texto».');
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
