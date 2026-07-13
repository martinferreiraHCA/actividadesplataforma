// Navegador del catálogo completo de Scratch: personajes y fondos con
// miniaturas (del CDN oficial, necesita internet para verlas), buscador,
// y un clic para insertar "personaje: X" / "fondo: X" en el código de la ficha.

import { CATALOGO_PERSONAJES_TODOS, CATALOGO_FONDOS_TODOS, urlMiniatura } from './scratch-catalogo.js';
import { CATALOGO_SONIDOS_TODOS, urlSonido } from './scratch-sonidos.js';
import { PERSONAJES, FONDOS, buscarPersonaje, buscarFondo } from './scratch-personajes.js';
import { GATO1_SVG } from './scratch-sb3-assets.js';

let overlay = null;
let escapeHandler = null;

// miniatura embebida (dataURL, funciona sin internet) para los del set offline
function miniaturaLocal(nombre, esPersonaje) {
  if (esPersonaje) {
    const clave = buscarPersonaje(nombre);
    if (clave === 'gato') return 'data:image/svg+xml;base64,' + GATO1_SVG;
    if (clave && PERSONAJES[clave]) {
      const p = PERSONAJES[clave];
      return 'data:image/' + (p.ext === 'svg' ? 'svg+xml' : p.ext) + ';base64,' + p.b64;
    }
  } else {
    const clave = buscarFondo(nombre);
    if (clave && FONDOS[clave]) {
      const f = FONDOS[clave];
      return 'data:image/' + (f.ext === 'svg' ? 'svg+xml' : f.ext) + ';base64,' + f.b64;
    }
  }
  return null;
}

export function abrirCatalogo(opciones) {
  cerrarCatalogo();
  const opts = opciones || {};

  overlay = document.createElement('div');
  overlay.className = 'sim-overlay';
  overlay.innerHTML = `
    <div class="sim-panel catalogo-panel" role="dialog" aria-modal="true" aria-label="Catálogo de Scratch">
      <div class="sim-panel__top">
        <strong>📚 Catálogo de Scratch</strong>
        <span style="font-size:0.75rem;opacity:0.6">un clic inserta la línea en el código de la ficha</span>
        <span class="sim-panel__sep"></span>
        <button type="button" class="ficha-card__accion ficha-card__accion--peligro" data-cat-cerrar>✕ Cerrar</button>
      </div>
      <div class="catalogo-barra">
        <button type="button" class="sim-sc__btn catalogo-tab catalogo-tab--activa" data-cat-tab="personajes">Personajes (${CATALOGO_PERSONAJES_TODOS.length + 1})</button>
        <button type="button" class="sim-sc__btn catalogo-tab" data-cat-tab="fondos">Fondos (${CATALOGO_FONDOS_TODOS.length})</button>
        <button type="button" class="sim-sc__btn catalogo-tab" data-cat-tab="sonidos">Sonidos (${CATALOGO_SONIDOS_TODOS.length})</button>
        <input type="search" class="campo__input catalogo-buscar" placeholder="Buscar por nombre…" aria-label="Buscar">
      </div>
      <p class="catalogo-nota">Los marcados con ✓ están guardados en la página y funcionan <strong>sin internet</strong> (podés nombrarlos en español). El resto de la biblioteca oficial se descarga solo al usarlo — necesita conexión, y se nombra en inglés tal como aparece acá.</p>
      <div class="catalogo-grilla" data-cat-grilla></div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const grilla = overlay.querySelector('[data-cat-grilla]');
  const buscar = overlay.querySelector('.catalogo-buscar');
  let tab = 'personajes';

  function itemsDe() {
    if (tab === 'sonidos') {
      return CATALOGO_SONIDOS_TODOS.map(([nombre, md5ext]) => ({
        nombre, md5ext, linea: 'iniciar sonido [' + nombre + ' v]', sonido: true,
        offline: nombre === 'Meow'
      }));
    }
    if (tab === 'personajes') {
      return CATALOGO_PERSONAJES_TODOS.map(([nombre, disfraces]) => {
        const local = miniaturaLocal(nombre, true);
        return { nombre, md5ext: disfraces[0][1], linea: 'personaje: ' + nombre, local, offline: !!local };
      });
    }
    return CATALOGO_FONDOS_TODOS.map(([nombre, md5ext]) => {
      const local = miniaturaLocal(nombre, false);
      return { nombre, md5ext, linea: 'fondo: ' + nombre, local, offline: !!local };
    });
  }

  function pintar() {
    const q = buscar.value.trim().toLowerCase();
    const items = itemsDe().filter(it => !q || it.nombre.toLowerCase().includes(q));
    grilla.innerHTML = '';
    items.slice(0, 400).forEach(it => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'catalogo-item';
      b.title = 'Insertar "' + it.linea + '"';
      if (it.sonido) {
        // sonidos: sin miniatura — ícono + botón para escucharlo (necesita internet)
        const icono = document.createElement('span');
        icono.className = 'catalogo-item__sonido';
        icono.textContent = '🔊';
        const oir = document.createElement('span');
        oir.className = 'catalogo-item__oir';
        oir.textContent = '▶ escuchar';
        oir.title = 'Escuchar el sonido (necesita internet)';
        oir.addEventListener('click', (e) => {
          e.stopPropagation();
          try {
            const audio = new Audio(urlSonido(it.md5ext));
            audio.play().catch(() => { oir.textContent = '🌐✕ sin conexión'; });
          } catch (err) { /* sin audio */ }
        });
        const nom = document.createElement('span');
        nom.textContent = (it.offline ? '✓ ' : '') + it.nombre;
        b.title = 'Insertar "' + it.linea + '"';
        b.append(icono, nom, oir);
        b.addEventListener('click', () => {
          cerrarCatalogo();
          if (opts.alElegir) opts.alElegir({ tipo: 'sonido', nombre: it.nombre, linea: it.linea });
        });
        grilla.appendChild(b);
        return;
      }
      const img = document.createElement('img');
      img.loading = 'lazy';
      // los embebidos usan su dibujo local (sin internet); el resto viene del CDN
      img.src = it.local || urlMiniatura(it.md5ext);
      img.alt = it.nombre;
      if (!it.local) {
        img.addEventListener('error', () => {
          const ph = document.createElement('span');
          ph.className = 'catalogo-item__sinred';
          ph.textContent = '🌐✕';
          ph.title = 'La miniatura no cargó: la red está bloqueando assets.scratch.mit.edu. Los personajes con ✓ funcionan igual.';
          img.replaceWith(ph);
        }, { once: true });
      }
      const nom = document.createElement('span');
      nom.textContent = (it.offline ? '✓ ' : '') + it.nombre;
      b.append(img, nom);
      b.addEventListener('click', () => {
        cerrarCatalogo();
        if (opts.alElegir) opts.alElegir({ tipo: tab === 'personajes' ? 'personaje' : 'fondo', nombre: it.nombre, linea: it.linea });
      });
      grilla.appendChild(b);
    });
    if (!items.length) {
      grilla.innerHTML = '<p style="opacity:0.6;padding:1rem">No hay resultados para esa búsqueda.</p>';
    }
  }

  overlay.querySelectorAll('.catalogo-tab').forEach(t => {
    t.addEventListener('click', () => {
      tab = t.dataset.catTab;
      overlay.querySelectorAll('.catalogo-tab').forEach(x => x.classList.toggle('catalogo-tab--activa', x === t));
      pintar();
    });
  });
  buscar.addEventListener('input', pintar);
  overlay.querySelector('[data-cat-cerrar]').addEventListener('click', cerrarCatalogo);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrarCatalogo(); });
  escapeHandler = (e) => { if (e.key === 'Escape') cerrarCatalogo(); };
  document.addEventListener('keydown', escapeHandler);

  pintar();
  buscar.focus();
}

export function cerrarCatalogo() {
  if (escapeHandler) { document.removeEventListener('keydown', escapeHandler); escapeHandler = null; }
  if (overlay) { overlay.remove(); overlay = null; }
  document.body.style.overflow = '';
}
