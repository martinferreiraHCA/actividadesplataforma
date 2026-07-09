// Simulador de Scratch autocontenido: corre el código de la ficha en el
// MOTOR OFICIAL de Scratch 3.0 (scratch-vm + scratch-render, del repositorio
// de Scratch) DENTRO de la tarjeta de la ficha, debajo del código, sin
// conexión. El texto scratchblocks se convierte a un proyecto .sb3 real
// (scratch-sb3.js) y se ejecuta en un escenario de 480x360 con bandera
// verde, teclado, mouse y captura PNG.

import { codigoASb3 } from './scratch-sb3.js';

// los bundles del motor pesan ~10 MB: se cargan una sola vez y bajo demanda
const MOTOR_SCRIPTS = ['scratch-vm.js', 'scratch-storage.js', 'scratch-render.min.js', 'scratch-audio.web.js'];
let motorCargado = null;

function cargarScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('No se pudo cargar ' + src));
    document.head.appendChild(s);
  });
}

function cargarMotor(onProgreso) {
  if (motorCargado) return motorCargado;
  motorCargado = (async () => {
    for (let i = 0; i < MOTOR_SCRIPTS.length; i++) {
      onProgreso && onProgreso(`Cargando el motor de Scratch (${i + 1}/${MOTOR_SCRIPTS.length})…`);
      await cargarScript(MOTOR_SCRIPTS[i]);
    }
  })();
  motorCargado.catch(() => { motorCargado = null; }); // permitir reintento si falló
  return motorCargado;
}

// ---- estado del simulador abierto (uno solo a la vez) ----
let sim = null; // { panel, contenedor, vm, canvas, limpiar: [] }

// si la lista de fichas se re-renderiza, el panel muere con ella: apagamos el VM
if (typeof window !== 'undefined') {
  window.addEventListener('fichas:renderizando', () => cerrarSimuladorScratch());
}

const NOMBRES_TECLA = {
  'ArrowUp': 'up arrow', 'ArrowDown': 'down arrow', 'ArrowLeft': 'left arrow', 'ArrowRight': 'right arrow',
  ' ': 'space', 'Enter': 'enter'
};
function teclaScratch(ev) {
  if (NOMBRES_TECLA[ev.key]) return NOMBRES_TECLA[ev.key];
  return ev.key.length === 1 ? ev.key.toLowerCase() : ev.key.toLowerCase();
}

// abre el simulador DENTRO de `opciones.contenedor` (un div dentro de la tarjeta)
export async function abrirSimuladorScratch(ficha, opciones) {
  cerrarSimuladorScratch();
  const opts = opciones || {};
  const contenedor = opts.contenedor;
  if (!contenedor) return;

  const panel = document.createElement('div');
  panel.className = 'sim-panel sim-panel--inline';
  panel.innerHTML = `
    <div class="sim-panel__top">
      <strong>Escenario Scratch</strong>
      <span style="font-size:0.75rem;opacity:0.6">motor oficial scratch-vm · sin conexión</span>
      <span class="sim-panel__sep"></span>
      <button type="button" class="ficha-card__accion ficha-card__accion--peligro" data-sim-cerrar>✕ Cerrar simulador</button>
    </div>
    <div class="sim-sc__cuerpo">
      <div class="sim-sc__escenario-wrap">
        <canvas width="480" height="360" tabindex="0" aria-label="Escenario de Scratch"></canvas>
        <div class="sim-sc__pregunta">
          <input type="text" placeholder="Escribí tu respuesta y apretá Enter…" aria-label="Respuesta">
          <button type="button" class="sim-sc__btn">✓</button>
        </div>
      </div>
      <div class="sim-sc__lateral">
        <div class="sim-sc__controles">
          <button type="button" class="sim-sc__btn sim-sc__btn--bandera" data-sim-bandera>⚑ Bandera verde</button>
          <button type="button" class="sim-sc__btn sim-sc__btn--stop" data-sim-stop>⬣ Detener</button>
        </div>
        <div class="sim-sc__controles">
          <button type="button" class="sim-sc__btn" data-sim-capturar>📸 Usar captura como imagen de la ficha</button>
          <button type="button" class="sim-sc__btn" data-sim-descargar>⬇ Descargar captura</button>
          <button type="button" class="sim-sc__btn" data-sim-sb3>⬇ Descargar .sb3 (abrir en Scratch)</button>
        </div>
        <div class="sim-sc__estado" data-sim-estado>Preparando…</div>
        <div class="sim-sc__avisos" data-sim-avisos style="display:none"></div>
        <p class="sim-sc__mini">
          El escenario responde al teclado (hacé clic sobre él primero) y al mouse, igual que en Scratch.
          La captura muestra el escenario tal como se ve en este momento — pausá la acción con ⬣ si querés
          congelar un instante. El archivo .sb3 se puede abrir en scratch.mit.edu para seguir trabajando.
        </p>
      </div>
    </div>`;
  contenedor.innerHTML = '';
  contenedor.appendChild(panel);
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const canvas = panel.querySelector('canvas');
  const estado = panel.querySelector('[data-sim-estado]');
  const avisosEl = panel.querySelector('[data-sim-avisos]');
  const ponerEstado = (t) => { estado.textContent = t; };

  sim = { panel, contenedor, vm: null, canvas, limpiar: [] };

  panel.querySelector('[data-sim-cerrar]').addEventListener('click', () => cerrarSimuladorScratch());
  const alEscape = (e) => { if (e.key === 'Escape') cerrarSimuladorScratch(); };
  document.addEventListener('keydown', alEscape);
  sim.limpiar.push(() => document.removeEventListener('keydown', alEscape));

  try {
    // 1) motor + proyecto en paralelo
    ponerEstado('Cargando el motor de Scratch…');
    const [, sb3] = await Promise.all([
      cargarMotor(ponerEstado),
      codigoASb3(ficha.codigo)
    ]);
    if (!sim || sim.panel !== panel) return; // lo cerraron mientras cargaba

    if (sb3.avisos.length) {
      avisosEl.style.display = 'block';
      avisosEl.innerHTML = '<strong>Avisos de la conversión:</strong><br>' +
        sb3.avisos.map(a => '• ' + escHtml(a)).join('<br>');
    }

    // 2) armar el VM (receta verificada para scratch-vm 5.x)
    ponerEstado('Armando el escenario…');
    const vm = new window.VirtualMachine();
    const ClaseStorage = window.ScratchStorage.ScratchStorage || window.ScratchStorage;
    vm.attachStorage(new ClaseStorage());
    const renderer = new window.ScratchRender(canvas);
    vm.attachRenderer(renderer);
    if (window.AudioEngine) {
      try { vm.attachAudioEngine(new window.AudioEngine()); } catch (e) { /* sin audio */ }
    }
    vm.setTurboMode(false);
    vm.start();
    sim.vm = vm;

    const buf = await sb3.blob.arrayBuffer();
    await vm.loadProject(buf);
    if (!sim || sim.panel !== panel) { apagarVm(vm); return; }

    // 3) entrada: teclado y mouse como en Scratch
    const alTeclado = (ev, isDown) => {
      if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA') return;
      vm.postIOData('keyboard', { key: teclaScratch(ev), isDown });
      if (ev.key.startsWith('Arrow') || ev.key === ' ') ev.preventDefault();
    };
    const kd = (ev) => alTeclado(ev, true);
    const ku = (ev) => alTeclado(ev, false);
    panel.addEventListener('keydown', kd);
    panel.addEventListener('keyup', ku);

    const alMouse = (ev, extra) => {
      const r = canvas.getBoundingClientRect();
      vm.postIOData('mouse', Object.assign({
        x: ev.clientX - r.left,
        y: ev.clientY - r.top,
        canvasWidth: r.width,
        canvasHeight: r.height
      }, extra || {}));
    };
    const mm = (ev) => alMouse(ev);
    const md = (ev) => { canvas.focus(); alMouse(ev, { isDown: true }); };
    const mu = (ev) => alMouse(ev, { isDown: false });
    canvas.addEventListener('mousemove', mm);
    canvas.addEventListener('mousedown', md);
    canvas.addEventListener('mouseup', mu);

    // 4) "preguntar … y esperar": mini caja de respuesta
    const cajaPregunta = panel.querySelector('.sim-sc__pregunta');
    const inputPregunta = cajaPregunta.querySelector('input');
    const responder = () => {
      vm.runtime.emit('ANSWER', inputPregunta.value);
      inputPregunta.value = '';
      cajaPregunta.classList.remove('sim-sc__pregunta--visible');
    };
    vm.runtime.on('QUESTION', (pregunta) => {
      if (pregunta === null) {
        cajaPregunta.classList.remove('sim-sc__pregunta--visible');
      } else {
        inputPregunta.placeholder = pregunta || 'Escribí tu respuesta y apretá Enter…';
        cajaPregunta.classList.add('sim-sc__pregunta--visible');
        inputPregunta.focus();
      }
    });
    inputPregunta.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') responder(); });
    cajaPregunta.querySelector('button').addEventListener('click', responder);

    // 5) controles
    panel.querySelector('[data-sim-bandera]').addEventListener('click', () => { vm.greenFlag(); canvas.focus(); });
    panel.querySelector('[data-sim-stop]').addEventListener('click', () => vm.stopAll());

    const capturar = () => new Promise((resolve) => {
      if (typeof renderer.requestSnapshot === 'function') {
        renderer.requestSnapshot(resolve);
      } else {
        renderer.draw();
        resolve(canvas.toDataURL('image/png'));
      }
    });
    panel.querySelector('[data-sim-capturar]').addEventListener('click', async () => {
      const dataUrl = await capturar();
      cerrarSimuladorScratch();
      if (opts.alCapturar) opts.alCapturar(dataUrl);
    });
    panel.querySelector('[data-sim-descargar]').addEventListener('click', async () => {
      const dataUrl = await capturar();
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'escenario.png';
      a.click();
    });
    panel.querySelector('[data-sim-sb3]').addEventListener('click', () => {
      const url = URL.createObjectURL(sb3.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (ficha.titulo.trim() || 'ficha-scratch').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '.sb3';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    });

    sim.limpiar.push(() => {
      panel.removeEventListener('keydown', kd);
      panel.removeEventListener('keyup', ku);
      canvas.removeEventListener('mousemove', mm);
      canvas.removeEventListener('mousedown', md);
      canvas.removeEventListener('mouseup', mu);
    });

    // 6) ¡a correr!
    vm.greenFlag();
    canvas.focus();
    ponerEstado('Corriendo. ⚑ reinicia, ⬣ pausa la acción.');
  } catch (e) {
    console.error(e);
    ponerEstado('No se pudo simular: ' + (e.message || e));
  }
}

function apagarVm(vm) {
  try { vm.stopAll(); } catch (e) { /* ya detenido */ }
  try { vm.quit ? vm.quit() : vm.stop(); } catch (e) { /* sin quit en esta versión */ }
}

export function cerrarSimuladorScratch() {
  if (!sim) return;
  const s = sim;
  sim = null;
  s.limpiar.forEach(fn => { try { fn(); } catch (e) { /* ya desmontado */ } });
  if (s.vm) apagarVm(s.vm);
  s.panel.remove();
  // el contenedor vuelve a mostrar el botón "▶ Probar"
  if (s.contenedor && s.contenedor.dataset) delete s.contenedor.dataset.simAbierto;
  if (s.contenedor) s.contenedor.dispatchEvent(new CustomEvent('sim:cerrado'));
}

function escHtml(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
