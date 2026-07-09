// Navegador del catálogo completo de Scratch: personajes y fondos con
// miniaturas (del CDN oficial, necesita internet para verlas), buscador,
// y un clic para insertar "personaje: X" / "fondo: X" en el código de la ficha.

import { CATALOGO_PERSONAJES_TODOS, CATALOGO_FONDOS_TODOS, urlMiniatura } from './scratch-catalogo.js';
import { listaNombresPersonajes, listaNombresFondos } from './scratch-personajes.js';

let overlay = null;
let escapeHandler = null;

// nombres del set embebido (funcionan sin internet) para marcarlos
const OFFLINE_P = new Set(listaNombresPersonajes().map(n => n.toLowerCase()));
const OFFLINE_F = new Set(listaNombresFondos().map(n => n.toLowerCase()));
// alias español → nombre del catálogo (para marcar los offline)
const ALIAS_OFFLINE = {
  'cat': 'gato', 'dog2': 'perro', 'bear': 'oso', 'frog': 'rana', 'ball': 'pelota',
  'butterfly 1': 'mariposa', 'dinosaur4': 'dinosaurio', 'crab': 'cangrejo',
  'penguin 2': 'pingüino', 'mouse1': 'ratón', 'bat': 'murciélago', 'fish': 'pez', 'hedgehog': 'erizo',
  'blue sky': 'cielo', 'underwater 1': 'fondo de mar', 'stars': 'estrellas',
  'night city': 'ciudad de noche', 'soccer': 'cancha de fútbol', 'farm': 'granja'
};

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
    if (tab === 'personajes') {
      return CATALOGO_PERSONAJES_TODOS.map(([nombre, disfraces]) => ({
        nombre, md5ext: disfraces[0][1], linea: 'personaje: ' + nombre,
        offline: OFFLINE_P.has((ALIAS_OFFLINE[nombre.toLowerCase()] || '').toLowerCase()) || nombre.toLowerCase() === 'cat'
      }));
    }
    return CATALOGO_FONDOS_TODOS.map(([nombre, md5ext]) => ({
      nombre, md5ext, linea: 'fondo: ' + nombre,
      offline: OFFLINE_F.has((ALIAS_OFFLINE[nombre.toLowerCase()] || '').toLowerCase())
    }));
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
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.src = urlMiniatura(it.md5ext);
      img.alt = it.nombre;
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
