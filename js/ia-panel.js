// Manages AI chat side-panel popups
const IAS = {
  chatgpt: { nombre: 'ChatGPT', url: 'https://chat.openai.com/', color: '#10a37f' },
  claude:  { nombre: 'Claude',   url: 'https://claude.ai/new',     color: '#d97706' },
  gemini:  { nombre: 'Gemini',   url: 'https://gemini.google.com/app', color: '#4285f4' }
};

let ventanaIA = null;
let iaActiva = null;
let indicador = null;

function crearIndicador() {
  if (indicador) return indicador;
  indicador = document.createElement('div');
  indicador.className = 'ia-flotante';
  indicador.innerHTML = `
    <span class="ia-flotante__nombre"></span>
    <button class="ia-flotante__btn ia-flotante__btn--focus" title="Enfocar ventana">↗</button>
    <button class="ia-flotante__btn ia-flotante__btn--close" title="Cerrar">✕</button>
  `;
  document.body.appendChild(indicador);

  indicador.querySelector('.ia-flotante__btn--focus').addEventListener('click', () => {
    if (ventanaIA && !ventanaIA.closed) ventanaIA.focus();
  });
  indicador.querySelector('.ia-flotante__btn--close').addEventListener('click', cerrarIA);

  return indicador;
}

function mostrarIndicador(nombre, color) {
  const el = crearIndicador();
  el.querySelector('.ia-flotante__nombre').textContent = `${nombre} abierto`;
  el.style.setProperty('--ia-color', color);
  el.classList.add('ia-flotante--visible');
}

function ocultarIndicador() {
  if (indicador) indicador.classList.remove('ia-flotante--visible');
}

function cerrarIA() {
  if (ventanaIA && !ventanaIA.closed) ventanaIA.close();
  ventanaIA = null;
  iaActiva = null;
  ocultarIndicador();
  actualizarBotones();
}

function actualizarBotones() {
  document.querySelectorAll('[data-ia-abrir]').forEach(btn => {
    const id = btn.dataset.iaAbrir;
    const activo = iaActiva === id && ventanaIA && !ventanaIA.closed;
    btn.classList.toggle('ia-btn--activo', activo);
    const label = IAS[id]?.nombre || id;
    btn.textContent = activo ? `${label} ●` : label;
  });
}

function obtenerPromptActual() {
  const cajaPrompt = document.getElementById('cajaPrompt');
  if (cajaPrompt && cajaPrompt.textContent.trim()) return cajaPrompt.textContent.trim();
  const custom = document.getElementById('textareaPromptCustom');
  if (custom && custom.value.trim()) return custom.value.trim();
  return null;
}

async function copiarPromptSiDisponible() {
  const prompt = obtenerPromptActual();
  if (!prompt) return false;
  try {
    await navigator.clipboard.writeText(prompt);
    return true;
  } catch {
    return false;
  }
}

export function abrirIA(id) {
  const ia = IAS[id];
  if (!ia) return;

  if (iaActiva === id && ventanaIA && !ventanaIA.closed) {
    ventanaIA.focus();
    return;
  }

  if (ventanaIA && !ventanaIA.closed) ventanaIA.close();

  const ancho = Math.min(520, Math.floor(screen.availWidth * 0.35));
  const alto = Math.floor(screen.availHeight * 0.9);
  const left = screen.availWidth - ancho;
  const top = Math.floor((screen.availHeight - alto) / 2);

  copiarPromptSiDisponible().then(copiado => {
    if (copiado) mostrarToast('Prompt copiado al portapapeles — pegalo en la IA');
  });

  ventanaIA = window.open(
    ia.url,
    'ia_sidebar',
    `width=${ancho},height=${alto},left=${left},top=${top},menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes`
  );

  if (!ventanaIA || ventanaIA.closed) {
    mostrarToast('El navegador bloqueó la ventana — deshabilitá el bloqueador de popups');
    return;
  }

  iaActiva = id;
  mostrarIndicador(ia.nombre, ia.color);
  actualizarBotones();

  const timer = setInterval(() => {
    if (!ventanaIA || ventanaIA.closed) {
      clearInterval(timer);
      iaActiva = null;
      ventanaIA = null;
      ocultarIndicador();
      actualizarBotones();
    }
  }, 1000);
}

function mostrarToast(mensaje) {
  let toast = document.getElementById('iaToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'iaToast';
    toast.className = 'ia-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = mensaje;
  toast.classList.remove('ia-toast--visible');
  void toast.offsetWidth;
  toast.classList.add('ia-toast--visible');
  setTimeout(() => toast.classList.remove('ia-toast--visible'), 3500);
}

export function initIAPanel() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-ia-abrir]');
    if (btn) {
      e.preventDefault();
      abrirIA(btn.dataset.iaAbrir);
    }
  });
}
