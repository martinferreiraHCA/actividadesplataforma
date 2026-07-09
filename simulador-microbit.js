// Simulador de micro:bit: embebe el editor oficial de MakeCode
// (makecode.microbit.org) en modo "controller" y le carga el código de la
// ficha por postMessage (API documentada en pxteditor.d.ts de Microsoft/pxt).
// Requiere conexión a internet. El simulador corre dentro del editor.

const ORIGEN = 'https://makecode.microbit.org';
const URL_EDITOR = ORIGEN + '/?controller=1&ws=mem&lang=es#editor';

let overlay = null;
let iframe = null;
let escapeHandler = null;
let escuchando = false;
let pendienteImport = null; // { codigo, timer }
let contador = 0;

function asegurarListener() {
  if (escuchando) return;
  escuchando = true;
  window.addEventListener('message', (ev) => {
    if (ev.origin !== ORIGEN || !iframe) return;
    const msg = ev.data;
    if (!msg || typeof msg !== 'object') return;

    // En modo controller el editor nos pide el workspace: respondemos vacío
    // para que arranque limpio y acepte el importproject.
    if (msg.type === 'pxthost' && msg.action === 'workspacesync') {
      iframe.contentWindow.postMessage({
        type: 'pxthost', id: msg.id, success: true, projects: []
      }, ORIGEN);
      return;
    }
    if (msg.type === 'pxthost' && msg.action === 'workspacesave') {
      // guardado del editor: lo ignoramos (no persistimos nada)
      return;
    }
    // cuando el editor terminó de cargar contenido, mandamos el proyecto
    if (msg.type === 'pxthost' && (msg.action === 'workspaceloaded' || msg.action === 'editorcontentloaded')) {
      importarPendiente();
      return;
    }
  });
}

function importarPendiente() {
  if (!pendienteImport || !iframe) return;
  const { codigo } = pendienteImport;
  const id = 'imp' + (++contador);
  iframe.contentWindow.postMessage({
    type: 'pxteditor',
    id,
    action: 'importproject',
    response: true,
    project: {
      text: {
        'main.ts': codigo,
        'main.blocks': '',
        'README.md': '',
        'pxt.json': JSON.stringify({
          name: 'Ficha micro:bit',
          dependencies: { core: '*' },
          files: ['main.blocks', 'main.ts', 'README.md']
        })
      }
    }
  }, ORIGEN);
  marcarEstado('El código de la ficha se cargó en MakeCode. Apretá ▶ en el simulador (panel izquierdo) para verlo funcionar.');
  clearTimeout(pendienteImport.timer);
  pendienteImport = null;
}

function marcarEstado(texto, esError) {
  const el = overlay && overlay.querySelector('.sim-mb__estado');
  if (!el) return;
  el.textContent = texto;
  el.classList.toggle('sim-mb__estado--error', !!esError);
}

export function abrirSimuladorMicrobit(ficha) {
  asegurarListener();
  cerrarSimuladorMicrobit();

  overlay = document.createElement('div');
  overlay.className = 'sim-overlay';
  overlay.innerHTML = `
    <div class="sim-panel sim-panel--mb" role="dialog" aria-modal="true" aria-label="Simulador micro:bit">
      <div class="sim-panel__top">
        <strong>Simulador micro:bit — MakeCode</strong>
        <span class="sim-panel__sep"></span>
        <button type="button" class="ficha-card__accion" data-sim-copiar>⧉ Copiar código</button>
        <a class="ficha-card__accion" href="${ORIGEN}/#editor" target="_blank" rel="noopener">↗ Abrir MakeCode aparte</a>
        <button type="button" class="ficha-card__accion ficha-card__accion--peligro" data-sim-cerrar>✕ Cerrar</button>
      </div>
      <div class="sim-mb__estado">Cargando el editor de MakeCode… (necesita internet; puede tardar unos segundos)</div>
      <iframe class="sim-mb__iframe" allow="usb; autoplay" title="Editor MakeCode micro:bit"></iframe>
      <div class="sim-panel__ayuda">
        Para la captura: dejá el simulador mostrando lo que te interesa y usá la captura de tu equipo
        (Windows: <code>Win + Shift + S</code> — Mac: <code>Cmd + Shift + 4</code>). Después subila como imagen de la ficha.
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-sim-cerrar]')) cerrarSimuladorMicrobit();
  });
  escapeHandler = (e) => { if (e.key === 'Escape') cerrarSimuladorMicrobit(); };
  document.addEventListener('keydown', escapeHandler);
  overlay.querySelector('[data-sim-copiar]').addEventListener('click', () => {
    navigator.clipboard?.writeText(ficha.codigo).catch(() => {});
  });

  iframe = overlay.querySelector('iframe');
  iframe.src = URL_EDITOR;

  // si el editor nunca avisa que cargó (p.ej. sin internet), avisamos igual
  pendienteImport = {
    codigo: ficha.codigo,
    timer: setTimeout(() => {
      if (pendienteImport) {
        marcarEstado('MakeCode está tardando en responder. Si no aparece el editor, revisá tu conexión o usá "Abrir MakeCode aparte" y pegá el código (ya podés copiarlo con el botón de arriba).', true);
      }
    }, 25000)
  };
}

export function cerrarSimuladorMicrobit() {
  if (pendienteImport) { clearTimeout(pendienteImport.timer); pendienteImport = null; }
  if (escapeHandler) { document.removeEventListener('keydown', escapeHandler); escapeHandler = null; }
  if (overlay) { overlay.remove(); overlay = null; iframe = null; }
  document.body.style.overflow = '';
}
