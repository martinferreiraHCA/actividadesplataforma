// AI chat side-panel popups — classic script (no ES module) so it works
// even when opened via file:// where <script type="module"> is blocked.
(function () {
  'use strict';

  var IAS = {
    chatgpt: { nombre: 'ChatGPT', url: 'https://chat.openai.com/', color: '#10a37f' },
    claude:  { nombre: 'Claude',  url: 'https://claude.ai/new', color: '#d97706' },
    gemini:  { nombre: 'Gemini',  url: 'https://gemini.google.com/app', color: '#4285f4' }
  };

  var ventanaIA = null;
  var iaActiva = null;
  var indicador = null;

  function crearIndicador() {
    if (indicador) return indicador;
    indicador = document.createElement('div');
    indicador.className = 'ia-flotante';
    indicador.innerHTML =
      '<span class="ia-flotante__nombre"></span>' +
      '<button class="ia-flotante__btn ia-flotante__btn--focus" title="Enfocar ventana">↗</button>' +
      '<button class="ia-flotante__btn ia-flotante__btn--close" title="Cerrar">✕</button>';
    document.body.appendChild(indicador);
    indicador.querySelector('.ia-flotante__btn--focus').addEventListener('click', function () {
      if (ventanaIA && !ventanaIA.closed) ventanaIA.focus();
    });
    indicador.querySelector('.ia-flotante__btn--close').addEventListener('click', cerrarIA);
    return indicador;
  }

  function mostrarIndicador(nombre, color) {
    var el = crearIndicador();
    el.querySelector('.ia-flotante__nombre').textContent = nombre + ' abierto';
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
    var botones = document.querySelectorAll('[data-ia-abrir]');
    for (var i = 0; i < botones.length; i++) {
      var btn = botones[i];
      var id = btn.getAttribute('data-ia-abrir');
      var activo = iaActiva === id && ventanaIA && !ventanaIA.closed;
      btn.classList.toggle('ia-btn--activo', !!activo);
      var label = (IAS[id] && IAS[id].nombre) || id;
      btn.textContent = activo ? label + ' ●' : label;
    }
  }

  function obtenerPromptActual() {
    var cajaPrompt = document.getElementById('cajaPrompt');
    if (cajaPrompt && cajaPrompt.textContent.trim()) return cajaPrompt.textContent.trim();
    var custom = document.getElementById('textareaPromptCustom');
    if (custom && custom.value.trim()) return custom.value.trim();
    return null;
  }

  function copiarPromptSiDisponible() {
    var prompt = obtenerPromptActual();
    if (!prompt) return Promise.resolve(false);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(prompt).then(function () { return true; })
          .catch(function () { return false; });
      }
    } catch (e) { /* ignore */ }
    return Promise.resolve(false);
  }

  function abrirIA(id) {
    var ia = IAS[id];
    if (!ia) return;

    if (iaActiva === id && ventanaIA && !ventanaIA.closed) {
      ventanaIA.focus();
      return;
    }
    if (ventanaIA && !ventanaIA.closed) ventanaIA.close();

    var ancho = Math.min(520, Math.floor(screen.availWidth * 0.35));
    var alto = Math.floor(screen.availHeight * 0.9);
    var left = screen.availWidth - ancho;
    var top = Math.floor((screen.availHeight - alto) / 2);

    copiarPromptSiDisponible().then(function (copiado) {
      if (copiado) mostrarToast('Prompt copiado — pegalo en la IA con Ctrl+V');
    });

    // Intento 1: ventana lateral tipo "sidebar"
    ventanaIA = window.open(
      ia.url, 'ia_sidebar',
      'width=' + ancho + ',height=' + alto + ',left=' + left + ',top=' + top +
      ',menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes'
    );

    // Intento 2: si el bloqueador lo frenó, pestaña normal
    if (!ventanaIA || ventanaIA.closed || typeof ventanaIA.closed === 'undefined') {
      ventanaIA = window.open(ia.url, '_blank');
    }

    // Si aún así falló, avisamos con enlace manual
    if (!ventanaIA || ventanaIA.closed || typeof ventanaIA.closed === 'undefined') {
      mostrarAvisoBloqueo(ia);
      return;
    }

    iaActiva = id;
    mostrarIndicador(ia.nombre, ia.color);
    actualizarBotones();

    var timer = setInterval(function () {
      if (!ventanaIA || ventanaIA.closed) {
        clearInterval(timer);
        iaActiva = null;
        ventanaIA = null;
        ocultarIndicador();
        actualizarBotones();
      }
    }, 1000);
  }

  function mostrarAvisoBloqueo(ia) {
    var aviso = document.getElementById('iaAvisoBloqueo');
    if (!aviso) {
      aviso = document.createElement('div');
      aviso.id = 'iaAvisoBloqueo';
      aviso.className = 'ia-aviso-bloqueo';
      document.body.appendChild(aviso);
    }
    aviso.innerHTML =
      '<div class="ia-aviso-bloqueo__caja">' +
      '<strong>El navegador bloqueó la ventana</strong>' +
      '<p>Tu bloqueador de popups frenó la apertura. Permití los popups para este sitio, ' +
      'o abrí ' + ia.nombre + ' manualmente:</p>' +
      '<a class="ia-aviso-bloqueo__link" href="' + ia.url + '" target="_blank" rel="noopener">Abrir ' + ia.nombre + ' ↗</a>' +
      '<button class="ia-aviso-bloqueo__cerrar" type="button">Cerrar</button>' +
      '</div>';
    aviso.classList.add('ia-aviso-bloqueo--visible');
    aviso.querySelector('.ia-aviso-bloqueo__cerrar').addEventListener('click', function () {
      aviso.classList.remove('ia-aviso-bloqueo--visible');
    });
    aviso.querySelector('.ia-aviso-bloqueo__link').addEventListener('click', function () {
      aviso.classList.remove('ia-aviso-bloqueo--visible');
    });
  }

  function mostrarToast(mensaje) {
    var toast = document.getElementById('iaToast');
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
    setTimeout(function () { toast.classList.remove('ia-toast--visible'); }, 3500);
  }

  function init() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-ia-abrir]') : null;
      if (btn) {
        e.preventDefault();
        abrirIA(btn.getAttribute('data-ia-abrir'));
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
