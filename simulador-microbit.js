// Simulador de micro:bit DENTRO de la tarjeta de la ficha, debajo del código.
// Cómo funciona: el código se publica como enlace compartido anónimo de
// MakeCode (la misma API que usa el botón "Compartir" de makecode.microbit.org)
// y se embebe el simulador oficial con ese proyecto ya cargado
// (endpoint /---run?id=...). Es el método más confiable: no depende de
// handshakes entre ventanas. Requiere conexión a internet.

const API_PUBLICAR = 'https://makecode.com/api/scripts';
const ORIGEN_EDITOR = 'https://makecode.microbit.org';

let panel = null;
let contenedorActual = null;
let escapeHandler = null;
let abortController = null;

// cache: código → shortid ya publicado (evita republicar el mismo código)
const publicados = new Map();

// si la lista de fichas se re-renderiza, el panel muere con ella: limpiamos
if (typeof window !== 'undefined') {
  window.addEventListener('fichas:renderizando', () => cerrarSimuladorMicrobit());
}

async function publicarProyecto(codigo, señal) {
  const clave = codigo.trim();
  if (publicados.has(clave)) return publicados.get(clave);

  const resp = await fetch(API_PUBLICAR, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: señal,
    body: JSON.stringify({
      name: 'Ficha micro:bit',
      target: 'microbit',
      description: 'Ficha didáctica del Generador de Actividades',
      editor: 'tsprj',
      text: {
        'main.ts': codigo,
        'main.blocks': '',
        'README.md': '',
        'pxt.json': JSON.stringify({
          name: 'Ficha micro:bit',
          dependencies: { core: '*' },
          files: ['main.blocks', 'main.ts', 'README.md']
        })
      },
      meta: {}
    })
  });
  if (!resp.ok) throw new Error('MakeCode respondió ' + resp.status);
  const data = await resp.json();
  if (!data.shortid && !data.id) throw new Error('MakeCode no devolvió el enlace del proyecto');
  const id = data.shortid || data.id;
  publicados.set(clave, id);
  return id;
}

function marcarEstado(texto, esError) {
  const el = panel && panel.querySelector('.sim-mb__estado');
  if (!el) return;
  el.innerHTML = texto;
  el.classList.toggle('sim-mb__estado--error', !!esError);
}

// abre el simulador DENTRO de `opciones.contenedor` (un div dentro de la tarjeta)
export async function abrirSimuladorMicrobit(ficha, opciones) {
  cerrarSimuladorMicrobit();
  const contenedor = opciones && opciones.contenedor;
  if (!contenedor) return;

  panel = document.createElement('div');
  panel.className = 'sim-panel sim-panel--inline sim-panel--mb';
  panel.innerHTML = `
    <div class="sim-panel__top">
      <strong>Simulador micro:bit — MakeCode</strong>
      <span class="sim-panel__sep"></span>
      <button type="button" class="ficha-card__accion" data-sim-capturar>📸 Capturar y recortar</button>
      <button type="button" class="ficha-card__accion" data-sim-copiar>⧉ Copiar código</button>
      <a class="ficha-card__accion" data-sim-abrir href="${ORIGEN_EDITOR}/#editor" target="_blank" rel="noopener">↗ Abrir en MakeCode</a>
      <button type="button" class="ficha-card__accion ficha-card__accion--peligro" data-sim-cerrar>✕ Cerrar simulador</button>
    </div>
    <div class="sim-mb__estado">Preparando el simulador… (necesita internet; puede tardar unos segundos)</div>
    <div class="sim-mb__marco">
      <iframe class="sim-mb__iframe" allow="autoplay" title="Simulador micro:bit" style="display:none"></iframe>
    </div>
    <div class="sim-panel__ayuda">
      El código se carga en el simulador oficial de MakeCode mediante un enlace para compartir (anónimo).
      Con "↗ Abrir en MakeCode" ves el proyecto completo con bloques y editor.
      Con <strong>📸 Capturar y recortar</strong>: dejá el simulador mostrando lo que te interesa, apretá el botón,
      aceptá compartir <strong>esta pestaña</strong> y después recortá el micro:bit — la imagen queda en la ficha.
    </div>`;
  contenedor.innerHTML = '';
  contenedor.appendChild(panel);
  contenedorActual = contenedor;
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  panel.querySelector('[data-sim-cerrar]').addEventListener('click', () => cerrarSimuladorMicrobit());
  panel.querySelector('[data-sim-copiar]').addEventListener('click', () => {
    navigator.clipboard?.writeText(ficha.codigo).catch(() => {});
  });
  panel.querySelector('[data-sim-capturar]').addEventListener('click', async () => {
    // el iframe de MakeCode es de otro dominio: no se puede leer directo.
    // Usamos la captura de pestaña del navegador y después se recorta.
    try {
      marcarEstado('Elegí compartir ESTA pestaña en el diálogo del navegador…');
      const dataUrl = await capturarPestana();
      marcarEstado('Captura lista: recortá el simulador en el editor que se abrió.');
      if (opciones && opciones.alCapturar) opciones.alCapturar(dataUrl);
    } catch (e) {
      marcarEstado('No se pudo capturar (' + (e.message || 'permiso denegado') + '). Alternativa: recorte del sistema — Windows: Win + Shift + S, Mac: Cmd + Shift + 4 — y subila como imagen de la ficha.', true);
    }
  });
  escapeHandler = (e) => { if (e.key === 'Escape') cerrarSimuladorMicrobit(); };
  document.addEventListener('keydown', escapeHandler);

  abortController = new AbortController();
  const miPanel = panel;
  const timeout = setTimeout(() => abortController && abortController.abort(), 30000);
  try {
    const id = await publicarProyecto(ficha.codigo, abortController.signal);
    clearTimeout(timeout);
    if (panel !== miPanel) return; // lo cerraron mientras publicaba

    const iframe = panel.querySelector('iframe');
    iframe.src = `${ORIGEN_EDITOR}/---run?id=${encodeURIComponent(id)}`;
    iframe.style.display = 'block';
    const abrir = panel.querySelector('[data-sim-abrir]');
    abrir.href = `${ORIGEN_EDITOR}/#pub:${encodeURIComponent(id)}`;
    marcarEstado('Simulador cargado: el programa ya está corriendo. Tocá los botones A/B del micro:bit virtual para probarlo.');
  } catch (e) {
    clearTimeout(timeout);
    if (panel !== miPanel) return;
    console.error(e);
    marcarEstado(
      'No se pudo cargar el simulador (¿hay conexión a internet?). ' +
      'Podés copiar el código con el botón de arriba, abrir <a href="' + ORIGEN_EDITOR + '/#editor" target="_blank" rel="noopener">MakeCode</a> ' +
      'en otra pestaña y pegarlo en la vista JavaScript.',
      true
    );
  }
}

export function cerrarSimuladorMicrobit() {
  if (abortController) { abortController.abort(); abortController = null; }
  if (escapeHandler) { document.removeEventListener('keydown', escapeHandler); escapeHandler = null; }
  if (panel) { panel.remove(); panel = null; }
  if (contenedorActual) {
    if (contenedorActual.dataset) delete contenedorActual.dataset.simAbierto;
    contenedorActual.dispatchEvent(new CustomEvent('sim:cerrado'));
    contenedorActual = null;
  }
}

// captura un cuadro de la pestaña actual con la API de captura de pantalla
async function capturarPestana() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    throw new Error('tu navegador no soporta captura de pantalla');
  }
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: 'browser' },
    audio: false,
    preferCurrentTab: true,       // Chrome: preselecciona esta pestaña
    selfBrowserSurface: 'include'
  });
  try {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    // dejar que el primer cuadro se estabilice
    await new Promise(r => setTimeout(r, 350));
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    return canvas.toDataURL('image/png');
  } finally {
    stream.getTracks().forEach(t => t.stop());
  }
}
