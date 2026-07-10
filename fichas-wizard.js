// Modo guiado de las fichas: divide la página en pasos con una barra de
// progreso, botones Continuar/Volver y explicaciones, para que armar una
// ficha o una guía sea seguir un camino y no enfrentar todo junto.
// No toca la lógica de scratch-fichas.js: muestra/oculta las secciones
// (data-wiz="N") y sincroniza las tarjetas grandes con los selects reales.

const KEY = 'gen_fichas_wizard';

const PASOS = [
  { n: 1, titulo: 'El documento', texto: 'Título y tipo' },
  { n: 2, titulo: 'El contenido', texto: 'Creá las fichas' },
  { n: 3, titulo: 'El diseño', texto: 'Cómo se ve' },
  { n: 4, titulo: 'Descargar', texto: 'PDF o Word' },
  { n: 5, titulo: 'Para CREA', texto: 'Opcional' }
];

let pref = { guiado: true, paso: 1 };
try {
  const raw = localStorage.getItem(KEY);
  if (raw) pref = Object.assign(pref, JSON.parse(raw));
} catch (e) { /* preferencia corrupta: valores por defecto */ }
if (pref.paso < 1 || pref.paso > PASOS.length) pref.paso = 1;

function guardar() {
  try { localStorage.setItem(KEY, JSON.stringify(pref)); } catch (e) { /* sin espacio */ }
}

const barra = document.getElementById('wizBarra');
const nav = document.getElementById('wizNav');
if (barra && nav) init();

function init() {
  construirBarra();
  construirNav();
  conectarCardsModo();
  conectarPreviewDiseno();
  aplicar(false);
}

// ---- barra de progreso + botón de modo ----
function construirBarra() {
  barra.className = 'wiz-barra';
  barra.innerHTML = '';
  const pasos = document.createElement('div');
  pasos.className = 'wiz-barra__pasos';
  PASOS.forEach(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'wiz-paso';
    b.dataset.paso = p.n;
    b.innerHTML = '<span class="wiz-paso__num"></span><span class="wiz-paso__rotulo"><strong></strong><small></small></span>';
    b.querySelector('.wiz-paso__num').textContent = p.n;
    b.querySelector('strong').textContent = p.titulo;
    b.querySelector('small').textContent = p.texto;
    b.addEventListener('click', () => irA(p.n));
    pasos.appendChild(b);
  });
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'wiz-toggle';
  toggle.id = 'wizToggle';
  toggle.addEventListener('click', () => {
    pref.guiado = !pref.guiado;
    guardar();
    aplicar(false);
  });
  barra.append(pasos, toggle);
}

// ---- botones Volver / Continuar ----
function construirNav() {
  nav.className = 'wiz-nav';
  nav.innerHTML = `
    <button type="button" class="btn btn--ghost" id="wizVolver">← Volver</button>
    <span class="wiz-nav__aviso" id="wizAviso"></span>
    <button type="button" class="btn btn--primary" id="wizContinuar"></button>`;
  nav.querySelector('#wizVolver').addEventListener('click', () => irA(pref.paso - 1));
  nav.querySelector('#wizContinuar').addEventListener('click', () => irA(pref.paso + 1));
}

function irA(n) {
  if (n < 1 || n > PASOS.length) return;
  pref.paso = n;
  guardar();
  aplicar(true);
}

function contarFichas() {
  return document.querySelectorAll('#listaFichas .ficha-card').length;
}

// aplica el estado actual (guiado + paso) a toda la página
function aplicar(conScroll) {
  document.body.classList.toggle('modo-guiado', pref.guiado);

  // secciones: en modo guiado solo se ve el paso actual
  document.querySelectorAll('[data-wiz]').forEach(sec => {
    const visible = !pref.guiado || Number(sec.dataset.wiz) === pref.paso;
    sec.classList.toggle('wiz-oculto', !visible);
  });
  document.getElementById('seccionWizNav').classList.toggle('wiz-oculto', !pref.guiado);

  // barra: estados hecho / actual / pendiente
  barra.querySelectorAll('.wiz-paso').forEach(b => {
    const n = Number(b.dataset.paso);
    b.classList.toggle('wiz-paso--actual', pref.guiado && n === pref.paso);
    b.classList.toggle('wiz-paso--hecho', pref.guiado && n < pref.paso);
  });
  barra.classList.toggle('wiz-barra--completa', !pref.guiado);
  const toggle = document.getElementById('wizToggle');
  toggle.textContent = pref.guiado ? 'Ver todo junto (modo completo)' : '🧭 Volver al modo guiado';

  if (pref.guiado) {
    actualizarNav();
    refrescarCardsModo();
    if (pref.paso === 3) refrescarPreviewDiseno();
  }

  if (conScroll) {
    const destino = document.getElementById('seccionWizBarra');
    if (pref.guiado && destino) destino.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!pref.guiado) {
      const sec = document.querySelector('[data-wiz="' + pref.paso + '"]');
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

function actualizarNav() {
  const volver = document.getElementById('wizVolver');
  const continuar = document.getElementById('wizContinuar');
  const aviso = document.getElementById('wizAviso');
  volver.style.visibility = pref.paso > 1 ? 'visible' : 'hidden';

  const rotulos = {
    1: 'Continuar: creá el contenido →',
    2: 'Continuar: elegí el diseño →',
    3: 'Continuar: descargá el documento →',
    4: '¿Y para CREA? (opcional) →'
  };
  if (pref.paso < PASOS.length) {
    continuar.style.display = '';
    continuar.textContent = rotulos[pref.paso] || 'Continuar →';
  } else {
    continuar.style.display = 'none';
  }

  const n = contarFichas();
  if (pref.paso >= 3 && n === 0) {
    aviso.textContent = 'Ojo: todavía no creaste ninguna ficha — podés volver al paso 2.';
  } else if (pref.paso === 2 && n > 0) {
    aviso.textContent = 'Llevás ' + n + ' ficha(s). Podés seguir agregando o continuar.';
  } else {
    aviso.textContent = '';
  }
}

// ---- tarjetas grandes "¿Qué querés armar?" (sincronizadas con #fdModo) ----
function conectarCardsModo() {
  const sel = document.getElementById('fdModo');
  const cont = document.getElementById('wizCardsModo');
  if (!sel || !cont) return;
  cont.querySelectorAll('.wiz-card').forEach(card => {
    card.addEventListener('click', () => {
      sel.value = card.dataset.valor;
      sel.dispatchEvent(new Event('change'));
      refrescarCardsModo();
    });
  });
  sel.addEventListener('change', refrescarCardsModo);
  refrescarCardsModo();
}

function refrescarCardsModo() {
  const sel = document.getElementById('fdModo');
  const cont = document.getElementById('wizCardsModo');
  if (!sel || !cont) return;
  cont.querySelectorAll('.wiz-card').forEach(card => {
    card.classList.toggle('wiz-card--activa', card.dataset.valor === sel.value);
  });
}

// ---- vista previa del diseño (paso 3): clona la primera ficha ya dibujada ----
function conectarPreviewDiseno() {
  ['fdEstiloDoc', 'fdFuenteDoc', 'fdTamanoDoc', 'fdNumerar', 'fdBordes'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      // esperar a que scratch-fichas re-dibuje la lista con el diseño nuevo
      if (pref.guiado && pref.paso === 3) setTimeout(refrescarPreviewDiseno, 60);
    });
  });
}

function refrescarPreviewDiseno() {
  const cont = document.getElementById('wizVistaDiseno');
  if (!cont) return;
  const primera = document.querySelector('#listaFichas .ficha-view');
  cont.innerHTML = '';
  const rotulo = document.createElement('div');
  rotulo.className = 'wiz-preview__rotulo';
  cont.appendChild(rotulo);
  if (primera) {
    rotulo.textContent = 'Así se va a ver tu primera ficha:';
    cont.appendChild(primera.cloneNode(true));
  } else {
    rotulo.textContent = 'Cuando crees fichas en el paso 2, acá vas a ver cómo quedan con el diseño elegido.';
  }
}
