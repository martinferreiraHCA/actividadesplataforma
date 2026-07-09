// Mini editor de imagen para las fichas: recortar y hacer zoom.
// Se usa después de capturar el escenario (o desde "✂ Recortar" en la
// zona de imagen). Arrastrás sobre la imagen para elegir el recuadro y
// aplicás: la imagen queda recortada (= zoom al mostrarse en la ficha).

let overlay = null;
let escapeHandler = null;

export function abrirEditorImagen(dataUrl, opciones) {
  cerrarEditorImagen();
  const opts = opciones || {};

  overlay = document.createElement('div');
  overlay.className = 'sim-overlay';
  overlay.innerHTML = `
    <div class="sim-panel edimg-panel" role="dialog" aria-modal="true" aria-label="Editar imagen">
      <div class="sim-panel__top">
        <strong>✂ Recortar / Zoom</strong>
        <span style="font-size:0.78rem;opacity:0.6">arrastrá sobre la imagen para elegir la zona</span>
        <span class="sim-panel__sep"></span>
        <button type="button" class="ficha-card__accion ficha-card__accion--peligro" data-ed-cancelar>✕ Cancelar</button>
      </div>
      <div class="edimg-zona">
        <canvas class="edimg-canvas"></canvas>
      </div>
      <div class="edimg-barra">
        <button type="button" class="sim-sc__btn" data-ed-aplicar disabled>✓ Aplicar recorte</button>
        <button type="button" class="sim-sc__btn" data-ed-todo>Usar imagen completa</button>
        <button type="button" class="sim-sc__btn" data-ed-reset style="display:none">↺ Deshacer selección</button>
        <span class="edimg-info" data-ed-info></span>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const canvas = overlay.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const btnAplicar = overlay.querySelector('[data-ed-aplicar]');
  const btnReset = overlay.querySelector('[data-ed-reset]');
  const info = overlay.querySelector('[data-ed-info]');

  const img = new Image();
  let escala = 1;          // imagen natural → canvas en pantalla
  let sel = null;          // selección en px del canvas {x, y, w, h}
  let arrastrando = null;  // punto de inicio del drag

  function dibujar() {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (sel && sel.w > 2 && sel.h > 2) {
      // oscurecer lo de afuera y marcar el recuadro
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.rect(sel.x, sel.y, sel.w, sel.h);
      ctx.fill('evenodd');
      ctx.restore();
      ctx.strokeStyle = '#ff3e00';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(sel.x + 1, sel.y + 1, sel.w - 2, sel.h - 2);
      ctx.setLineDash([]);
    }
  }

  function actualizarUI() {
    const hay = sel && sel.w > 8 && sel.h > 8;
    btnAplicar.disabled = !hay;
    btnReset.style.display = hay ? '' : 'none';
    if (hay) {
      const zoom = Math.min(canvas.width / sel.w, canvas.height / sel.h);
      info.textContent = `zoom ×${zoom.toFixed(1)} — ${Math.round(sel.w / escala)}×${Math.round(sel.h / escala)} px`;
    } else {
      info.textContent = '';
    }
  }

  function puntoDe(ev) {
    const r = canvas.getBoundingClientRect();
    const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
    const cy = (ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top;
    // el canvas puede estar escalado por CSS: pasamos a coordenadas internas
    return {
      x: Math.max(0, Math.min(canvas.width, cx * canvas.width / r.width)),
      y: Math.max(0, Math.min(canvas.height, cy * canvas.height / r.height))
    };
  }

  const alBajar = (ev) => {
    arrastrando = puntoDe(ev);
    sel = { x: arrastrando.x, y: arrastrando.y, w: 0, h: 0 };
    ev.preventDefault();
  };
  const alMover = (ev) => {
    if (!arrastrando) return;
    const p = puntoDe(ev);
    sel = {
      x: Math.min(arrastrando.x, p.x),
      y: Math.min(arrastrando.y, p.y),
      w: Math.abs(p.x - arrastrando.x),
      h: Math.abs(p.y - arrastrando.y)
    };
    dibujar();
    actualizarUI();
    ev.preventDefault();
  };
  const alSoltar = () => { arrastrando = null; };

  canvas.addEventListener('mousedown', alBajar);
  canvas.addEventListener('mousemove', alMover);
  window.addEventListener('mouseup', alSoltar);
  canvas.addEventListener('touchstart', alBajar, { passive: false });
  canvas.addEventListener('touchmove', alMover, { passive: false });
  canvas.addEventListener('touchend', alSoltar);
  overlay._limpiar = () => window.removeEventListener('mouseup', alSoltar);

  function recortar(rect) {
    // rect en px del canvas → px naturales de la imagen
    const nx = rect.x / escala, ny = rect.y / escala;
    const nw = rect.w / escala, nh = rect.h / escala;
    const salida = document.createElement('canvas');
    salida.width = Math.max(1, Math.round(nw));
    salida.height = Math.max(1, Math.round(nh));
    const sctx = salida.getContext('2d');
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(img, nx, ny, nw, nh, 0, 0, salida.width, salida.height);
    return salida.toDataURL('image/png');
  }

  btnAplicar.addEventListener('click', () => {
    if (!sel || sel.w < 8 || sel.h < 8) return;
    const resultado = recortar(sel);
    cerrarEditorImagen();
    if (opts.alAplicar) opts.alAplicar(resultado);
  });
  overlay.querySelector('[data-ed-todo]').addEventListener('click', () => {
    cerrarEditorImagen();
    if (opts.alAplicar) opts.alAplicar(dataUrl);
  });
  btnReset.addEventListener('click', () => {
    sel = null;
    dibujar();
    actualizarUI();
  });
  overlay.querySelector('[data-ed-cancelar]').addEventListener('click', () => {
    cerrarEditorImagen();
    if (opts.alCancelar) opts.alCancelar();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      cerrarEditorImagen();
      if (opts.alCancelar) opts.alCancelar();
    }
  });
  escapeHandler = (e) => {
    if (e.key === 'Escape') {
      cerrarEditorImagen();
      if (opts.alCancelar) opts.alCancelar();
    }
  };
  document.addEventListener('keydown', escapeHandler);

  img.onload = () => {
    if (!overlay) return;
    // tamaño en pantalla: que entre cómodo en la ventana
    const maxW = Math.min(760, window.innerWidth - 120);
    const maxH = Math.min(560, window.innerHeight - 240);
    escala = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
    canvas.width = Math.round(img.naturalWidth * escala);
    canvas.height = Math.round(img.naturalHeight * escala);
    dibujar();
    actualizarUI();
  };
  img.onerror = () => {
    cerrarEditorImagen();
    if (opts.alCancelar) opts.alCancelar();
  };
  img.src = dataUrl;
}

export function cerrarEditorImagen() {
  if (escapeHandler) { document.removeEventListener('keydown', escapeHandler); escapeHandler = null; }
  if (overlay) {
    if (overlay._limpiar) overlay._limpiar();
    overlay.remove();
    overlay = null;
  }
  document.body.style.overflow = '';
}
