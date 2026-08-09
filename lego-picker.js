// Selector visual de piezas con miniaturas 3D. Se usa desde el editor de
// pasos, el editor 3D y el calibrador para elegir piezas viéndolas, no solo
// por nombre. Las miniaturas salen del motor (fotoPieza) y quedan cacheadas.

import { PIEZAS, CATEGORIAS, piezasDeKit } from './lego-catalogo.js';
import { motorLego } from './lego-render.js';

const COLOR_MINIATURA = 71; // gris claro: neutro y visible en todas las piezas
const cache = new Map();    // clave -> dataURL

let overlay = null;

export function abrirSelectorPieza({ kit = 'todas', actual = null, titulo = 'Elegí la pieza', onElegir }) {
  cerrarSelectorPieza();
  overlay = document.createElement('div');
  overlay.className = 'picker-overlay';
  overlay.innerHTML = `
    <div class="picker-modal" role="dialog" aria-label="${titulo}">
      <div class="picker-cabecera">
        <strong>${titulo}</strong>
        <input class="campo__input picker-buscar" type="text" placeholder="Buscar… (ej: viga, engranaje 24)">
        <button class="picker-cerrar" aria-label="Cerrar">✕</button>
      </div>
      <div class="picker-cuerpo"></div>
    </div>`;
  document.body.appendChild(overlay);

  const cuerpo = overlay.querySelector('.picker-cuerpo');
  const disponibles = piezasDeKit(kit);
  const items = [];

  for (const cat of CATEGORIAS) {
    const lista = disponibles.filter(p => p.cat === cat);
    if (!lista.length) continue;
    const h = document.createElement('div');
    h.className = 'picker-categoria';
    h.textContent = cat;
    cuerpo.appendChild(h);
    const grid = document.createElement('div');
    grid.className = 'picker-grid';
    for (const p of lista) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'picker-item' + (p.clave === actual ? ' picker-item--actual' : '');
      b.dataset.busqueda = (p.clave + ' ' + p.nombre).toLowerCase();
      b.innerHTML = `<span class="picker-item__img"><span class="picker-item__espera">🧱</span></span><span class="picker-item__nombre">${p.nombre}</span>`;
      b.addEventListener('click', () => {
        cerrarSelectorPieza();
        onElegir(p.clave);
      });
      grid.appendChild(b);
      items.push({ boton: b, pieza: p, categoria: h, grid });
    }
    cuerpo.appendChild(grid);
  }

  // miniaturas: en orden, sin bloquear la interfaz
  (async () => {
    let motor = null;
    for (const it of items) {
      if (!overlay || !it.boton.isConnected) return;
      try {
        let url = cache.get(it.pieza.clave);
        if (!url) {
          motor = motor || await motorLego();
          url = await motor.fotoPieza(it.pieza.clave, COLOR_MINIATURA, 96);
          cache.set(it.pieza.clave, url);
        }
        if (url && it.boton.isConnected) {
          it.boton.querySelector('.picker-item__img').innerHTML = `<img src="${url}" alt="">`;
        }
      } catch (e) { /* la pieza queda con el emoji */ }
    }
  })();

  // búsqueda
  overlay.querySelector('.picker-buscar').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    for (const it of items) {
      it.boton.style.display = !q || it.boton.dataset.busqueda.includes(q) ? '' : 'none';
    }
    for (const it of items) {
      const visibles = [...it.grid.children].some(c => c.style.display !== 'none');
      it.categoria.style.display = visibles ? '' : 'none';
      it.grid.style.display = visibles ? '' : 'none';
    }
  });

  overlay.querySelector('.picker-cerrar').addEventListener('click', cerrarSelectorPieza);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrarSelectorPieza(); });
  document.addEventListener('keydown', escCerrar);
  overlay.querySelector('.picker-buscar').focus();
}

function escCerrar(e) {
  if (e.key === 'Escape') cerrarSelectorPieza();
}

export function cerrarSelectorPieza() {
  if (overlay) {
    overlay.remove();
    overlay = null;
    document.removeEventListener('keydown', escCerrar);
  }
}
