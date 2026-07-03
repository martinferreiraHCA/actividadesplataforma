// Editor de fichas didácticas con bloques de Scratch (scratchblocks) y micro:bit (MakeCode)
import { exportarFichasDOCX } from './export-fichas-docx.js';
import { obtenerBloquesMicrobit, bloquesMicrobitEnCache } from './makecode-render.js';
import { parsearFichasTexto, fichasComoTexto, generarPromptFichas, EJEMPLO_FICHAS_TEXTO } from './fichas-texto.js';
import { sugerirCorreccion } from './scratch-correcciones.js';
import { parsear } from './parser.js';

const STORAGE_KEY = 'gen_fichas_scratch';
const sb = window.scratchblocks;

const CODIGO_EJEMPLO = `al presionar bandera verde
por siempre
  mover (10) pasos
  si <¿tocando [borde v]?> entonces
    girar a la derecha (180) grados
  fin
fin`;

const CODIGO_EJEMPLO_MICROBIT = `input.onButtonPressed(Button.A, function () {
    basic.showString("Hola")
})
basic.forever(function () {
    basic.showIcon(IconNames.Heart)
    basic.pause(500)
    basic.clearScreen()
})`;

// Estilos de bloques: scratchblocks trae la paleta oficial exacta de cada versión
const ESTILOS_SCRATCH = [
  ['scratch3', 'Scratch 3 (colores actuales)'],
  ['scratch2', 'Scratch 2 (colores clásicos)'],
  ['scratch3-high-contrast', 'Scratch 3 — alto contraste']
];

// Plantillas de ficha listas para usar: un clic y queda una ficha completa para retocar
const PLANTILLAS = [
  {
    id: 'leer', nombre: '📖 Leer y predecir', tipo: 'scratch',
    titulo: '¿Qué hace este programa?',
    consigna: 'Leé el programa con atención y escribí, paso a paso, qué hace el personaje.',
    codigo: 'al presionar bandera verde\ndecir [¡Allá voy!] durante (2) segundos\nrepetir (3)\n  mover (50) pasos\n  esperar (1) segundos\nfin',
    notas: ''
  },
  {
    id: 'error', nombre: '🐞 Encontrar el error', tipo: 'scratch',
    titulo: '¿Dónde está el error?',
    consigna: 'Este programa debería hacer que el personaje dibuje un cuadrado, pero tiene UN error. Encontralo y explicá cómo arreglarlo.',
    codigo: 'al presionar bandera verde\nrepetir (4)\n  mover (100) pasos\n  girar a la derecha (45) grados\nfin',
    notas: 'Para el docente: el giro debe ser de (90) grados, no (45).'
  },
  {
    id: 'completar', nombre: '✏️ Completar', tipo: 'scratch',
    titulo: 'Completá el programa',
    consigna: 'Este programa cuenta de 1 a 10, pero le faltan valores. Copialo en Scratch y completá los espacios para que funcione.',
    codigo: 'al presionar bandera verde\ndar a [contador v] el valor (1)\nrepetir (10)\n  decir (contador) durante (1) segundos\n  sumar a [contador v] (1)\nfin',
    notas: ''
  },
  {
    id: 'desafio', nombre: '🚀 Desafío', tipo: 'scratch',
    titulo: 'Desafío: tu turno',
    consigna: 'Creá un programa donde el personaje salude al hacer clic sobre él. Este es un ejemplo del resultado esperado:',
    codigo: 'al hacer clic en este objeto\ndecir [¡Hola!] durante (2) segundos\niniciar sonido [Miau v]',
    notas: 'Cuando lo logres, probá que salude con tu nombre.'
  },
  {
    id: 'mb-leer', nombre: '📖 Leer micro:bit', tipo: 'microbit',
    titulo: '¿Qué muestra el micro:bit?',
    consigna: 'Leé el programa y explicá qué se ve en la pantalla del micro:bit y cuándo.',
    codigo: 'input.onButtonPressed(Button.A, function () {\n    basic.showString("Hola")\n})\nbasic.forever(function () {\n    basic.showIcon(IconNames.Heart)\n    basic.pause(500)\n    basic.clearScreen()\n    basic.pause(500)\n})',
    notas: ''
  },
  {
    id: 'mb-desafio', nombre: '🚀 Desafío micro:bit', tipo: 'microbit',
    titulo: 'Desafío: contador de saltos',
    consigna: 'Programá el micro:bit para que cuente cuántas veces lo sacudís y muestre el número al apretar el botón B. Punto de partida:',
    codigo: 'let saltos = 0\ninput.onGesture(Gesture.Shake, function () {\n    saltos += 1\n})\ninput.onButtonPressed(Button.B, function () {\n    basic.showNumber(saltos)\n})',
    notas: ''
  }
];

let state = {
  titulo: '',
  subtitulo: '',
  opciones: { numerar: true, bordes: true, salto: false },
  fichas: []
};

let uid = 1;
function nuevaFicha(codigo, tipo) {
  return {
    id: 'f' + (uid++) + '_' + state.fichas.length,
    tipo: tipo || 'scratch', // scratch | microbit
    titulo: '',
    consigna: '',
    codigo: codigo || '',
    escala: 1,
    estilo: 'scratch3',      // versión de Scratch: scratch3 | scratch2 | scratch3-high-contrast
    vista: 'bloques',        // micro:bit: bloques | codigo | ambos
    lenguaje: 'javascript',  // micro:bit: javascript | python
    notas: '',
    imagen: null,            // { data: dataURL, nombre }
    imgPos: 'derecha',       // derecha | izquierda | arriba | abajo
    imgAncho: 40,            // % del ancho de la ficha
    epigrafe: '',
    plegada: false           // tarjeta plegada en el editor (no afecta la exportación)
  };
}

// ============================================================
// Render de bloques
// ============================================================
function renderBloques(codigo, escala, estilo) {
  if (!sb || !codigo.trim()) return null;
  try {
    const doc = sb.parse(codigo, { languages: ['en', 'es'] });
    const view = sb.newView(doc, { style: estilo || 'scratch3', scale: escala || 1 });
    const svg = view.render();
    return { svg, view };
  } catch (e) {
    return { error: e.message || String(e) };
  }
}

function svgStringDeFicha(ficha) {
  const r = renderBloques(ficha.codigo, ficha.escala, ficha.estilo);
  if (!r || r.error || !r.view) return null;
  try {
    return { svg: r.view.exportSVGString(), width: r.svg.width.baseVal.value, height: r.svg.height.baseVal.value };
  } catch (e) {
    return null;
  }
}

// ============================================================
// Vista de una ficha (compartida: preview + impresión)
// ============================================================
export function construirFichaView(ficha, numero, opciones) {
  const view = document.createElement('div');
  view.className = 'ficha-view' + (opciones.bordes ? ' ficha-view--borde' : '');

  const head = document.createElement('div');
  head.className = 'ficha-view__head';
  if (opciones.numerar) {
    const num = document.createElement('span');
    num.className = 'ficha-view__num';
    num.textContent = 'FICHA ' + numero;
    head.appendChild(num);
  }
  if (ficha.titulo.trim()) {
    const h = document.createElement('h3');
    h.className = 'ficha-view__titulo';
    h.textContent = ficha.titulo;
    head.appendChild(h);
  }
  if (head.children.length) view.appendChild(head);

  if (ficha.consigna.trim()) {
    const p = document.createElement('p');
    p.className = 'ficha-view__consigna';
    p.textContent = ficha.consigna;
    view.appendChild(p);
  }

  const cuerpo = document.createElement('div');
  cuerpo.className = 'ficha-view__cuerpo ficha-view__cuerpo--' + ficha.imgPos;

  const zonaCodigo = document.createElement('div');
  zonaCodigo.className = 'ficha-view__codigo';
  if (ficha.tipo === 'microbit') {
    llenarZonaMicrobit(zonaCodigo, ficha);
  } else if (!ficha.codigo.trim()) {
    const vacio = document.createElement('span');
    vacio.className = 'ficha-view__vacio';
    vacio.textContent = '(sin código todavía)';
    zonaCodigo.appendChild(vacio);
  } else {
    const r = renderBloques(ficha.codigo, ficha.escala, ficha.estilo);
    if (r && r.svg) {
      zonaCodigo.appendChild(r.svg);
    } else {
      const err = document.createElement('span');
      err.className = 'ficha-view__vacio';
      err.textContent = 'No se pudo dibujar el código' + (r && r.error ? ': ' + r.error : '');
      zonaCodigo.appendChild(err);
    }
  }
  cuerpo.appendChild(zonaCodigo);

  if (ficha.imagen) {
    const fig = document.createElement('figure');
    fig.className = 'ficha-view__figura';
    const horizontal = ficha.imgPos === 'derecha' || ficha.imgPos === 'izquierda';
    fig.style.width = (horizontal ? ficha.imgAncho : Math.min(ficha.imgAncho + 20, 100)) + '%';
    const img = document.createElement('img');
    img.src = ficha.imagen.data;
    img.alt = ficha.epigrafe || ficha.titulo || 'Imagen de la ficha';
    fig.appendChild(img);
    if (ficha.epigrafe.trim()) {
      const cap = document.createElement('figcaption');
      cap.textContent = ficha.epigrafe;
      fig.appendChild(cap);
    }
    cuerpo.appendChild(fig);
  }
  view.appendChild(cuerpo);

  if (ficha.notas.trim()) {
    const n = document.createElement('div');
    n.className = 'ficha-view__notas';
    n.textContent = ficha.notas;
    view.appendChild(n);
  }
  return view;
}

// ¿la ficha micro:bit muestra bloques? (en Python los bloques no se pueden
// dibujar automáticamente: se muestra el código)
function microbitMuestraBloques(ficha) {
  return ficha.lenguaje !== 'python' && ficha.vista !== 'codigo';
}
function microbitMuestraCodigo(ficha) {
  return ficha.lenguaje === 'python' || ficha.vista !== 'bloques';
}

function preCodigo(ficha) {
  const pre = document.createElement('pre');
  pre.className = 'ficha-view__pre';
  pre.textContent = ficha.codigo;
  return pre;
}

function llenarZonaMicrobit(zona, ficha) {
  if (!ficha.codigo.trim()) {
    const vacio = document.createElement('span');
    vacio.className = 'ficha-view__vacio';
    vacio.textContent = '(sin código todavía)';
    zona.appendChild(vacio);
    return;
  }
  const conBloques = microbitMuestraBloques(ficha);
  const conCodigo = microbitMuestraCodigo(ficha);

  if (conBloques) {
    const cont = document.createElement('div');
    cont.className = 'ficha-view__mb';
    zona.appendChild(cont);

    const pintarImg = (info) => {
      cont.innerHTML = '';
      const img = document.createElement('img');
      img.className = 'ficha-view__mbimg';
      img.src = info.uri;
      img.alt = 'Bloques de MakeCode';
      if (info.width) img.style.width = Math.round(info.width * (ficha.escala || 1)) + 'px';
      cont.appendChild(img);
    };
    const pintarError = (err) => {
      cont.innerHTML = '';
      const nota = document.createElement('div');
      nota.className = 'ficha-view__mb-nota';
      nota.textContent = 'No se pudieron dibujar los bloques (' + (err && err.message ? err.message : 'sin conexión') + ').' + (conCodigo ? '' : ' Se muestra el código:');
      cont.appendChild(nota);
      if (!conCodigo) cont.appendChild(preCodigo(ficha));
    };

    const cacheado = bloquesMicrobitEnCache(ficha.codigo);
    if (cacheado && cacheado.estado === 'ok') {
      pintarImg(cacheado.valor);
    } else if (cacheado && cacheado.estado === 'error') {
      pintarError(cacheado.valor instanceof Error ? cacheado.valor : null);
    } else {
      cont.innerHTML = '<div class="ficha-view__mb-cargando">Dibujando bloques con MakeCode…</div>';
      const codigoPedido = ficha.codigo;
      obtenerBloquesMicrobit(codigoPedido).then(
        info => { if (ficha.codigo === codigoPedido) pintarImg(info); },
        err => { if (ficha.codigo === codigoPedido) pintarError(err); }
      );
    }
  }

  if (conCodigo) {
    zona.appendChild(preCodigo(ficha));
  }
}

// ============================================================
// Tarjetas del editor
// ============================================================
const lista = document.getElementById('listaFichas');

function renderLista() {
  lista.innerHTML = '';
  if (!state.fichas.length) {
    const vacio = document.createElement('div');
    vacio.className = 'scratch-vacio';
    vacio.innerHTML = 'Todavía no hay fichas. Agregá la primera con el botón de abajo — ya viene con un código de ejemplo para que veas cómo funciona.';
    lista.appendChild(vacio);
    return;
  }
  state.fichas.forEach((ficha, i) => lista.appendChild(construirTarjeta(ficha, i)));
}

function construirTarjeta(ficha, i) {
  const card = document.createElement('article');
  card.className = 'ficha-card';
  card.dataset.id = ficha.id;

  // ---- barra superior ----
  const top = document.createElement('div');
  top.className = 'ficha-card__top';
  const etiquetaTipo = ficha.tipo === 'microbit' ? 'MICRO:BIT' : 'SCRATCH';
  const tituloResumen = ficha.titulo.trim() ? `<span class="ficha-card__resumen">${escHtml(ficha.titulo)}</span>` : '';
  top.innerHTML = `<span class="ficha-card__num">FICHA ${i + 1} / ${state.fichas.length}</span><span class="ficha-card__tipo ficha-card__tipo--${ficha.tipo}">${etiquetaTipo}</span>${tituloResumen}<span class="ficha-card__top-sep"></span>`;
  const acciones = [
    [ficha.plegada ? '▸ Desplegar' : '▾ Plegar', () => { ficha.plegada = !ficha.plegada; renderLista(); guardarLuego(); }, false],
    ['↑ Subir', () => mover(i, -1), i === 0],
    ['↓ Bajar', () => mover(i, 1), i === state.fichas.length - 1],
    ['⧉ Duplicar', () => duplicar(i), false],
    ['✕ Eliminar', () => eliminar(i), false, true]
  ];
  acciones.forEach(([texto, fn, deshabilitado, peligro]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ficha-card__accion' + (peligro ? ' ficha-card__accion--peligro' : '');
    b.textContent = texto;
    b.disabled = deshabilitado;
    if (deshabilitado) b.style.opacity = '0.35';
    b.addEventListener('click', fn);
    top.appendChild(b);
  });
  card.appendChild(top);

  if (ficha.plegada) return card; // tarjeta plegada: solo la barra superior

  const grid = document.createElement('div');
  grid.className = 'ficha-card__grid';

  // ---- formulario ----
  const form = document.createElement('div');
  form.className = 'ficha-card__form';

  form.appendChild(campoTexto('Título de la ficha (opcional)', ficha.titulo, 'Ej: El gato rebota en los bordes', v => { ficha.titulo = v; refrescar(card, ficha, i); }));
  form.appendChild(campoArea('Consigna / explicación (opcional)', ficha.consigna, 'Ej: Leé el programa y explicá qué hace el gato...', 2, v => { ficha.consigna = v; refrescar(card, ficha, i); }));

  const esMicrobit = ficha.tipo === 'microbit';
  const etiquetaCodigo = esMicrobit
    ? (ficha.lenguaje === 'python' ? 'Código MakeCode — Python' : 'Código MakeCode — JavaScript')
    : 'Código Scratch (texto plano)';
  const campoCod = campoArea(etiquetaCodigo, ficha.codigo, esMicrobit ? CODIGO_EJEMPLO_MICROBIT : CODIGO_EJEMPLO, 7, v => { ficha.codigo = v; refrescar(card, ficha, i); });
  campoCod.querySelector('textarea').classList.add('ficha-card__codigo');
  form.appendChild(campoCod);

  // controles según el tipo de ficha
  const filaEscala = document.createElement('div');
  filaEscala.className = 'ficha-card__fila';

  if (esMicrobit) {
    // lenguaje del código
    filaEscala.appendChild(campoSelect('Lenguaje', ficha.lenguaje, [
      ['javascript', 'JavaScript (bloques automáticos)'],
      ['python', 'Python (solo código)']
    ], v => {
      ficha.lenguaje = v;
      renderLista(); // cambia la etiqueta del código y las vistas disponibles
      guardarLuego();
    }));
    // qué se muestra en la ficha
    if (ficha.lenguaje !== 'python') {
      filaEscala.appendChild(campoSelect('La ficha muestra', ficha.vista, [
        ['bloques', 'Solo bloques'],
        ['codigo', 'Solo código'],
        ['ambos', 'Bloques + código']
      ], v => { ficha.vista = v; refrescar(card, ficha, i); }));
    }
  } else {
    // versión de Scratch (cada una con su paleta oficial de colores)
    filaEscala.appendChild(campoSelect('Versión de Scratch', ficha.estilo, ESTILOS_SCRATCH, v => { ficha.estilo = v; refrescar(card, ficha, i); }));
  }
  filaEscala.appendChild(campoRango('Tamaño de los bloques', ficha.escala, 0.6, 1.6, 0.1, v => `×${v}`, v => { ficha.escala = v; refrescar(card, ficha, i); }));
  form.appendChild(filaEscala);

  // imagen
  form.appendChild(zonaImagen(ficha, card, i));

  form.appendChild(campoArea('Notas al pie (opcional)', ficha.notas, 'Ej: Pista: fijate qué pasa cuando toca el borde...', 2, v => { ficha.notas = v; refrescar(card, ficha, i); }));

  // prompt IA para esta ficha
  const btnIA = document.createElement('button');
  btnIA.type = 'button';
  btnIA.className = 'btn btn--ghost';
  btnIA.style.cssText = 'padding:0.5em 1.2em;font-size:0.85rem;align-self:flex-start';
  btnIA.textContent = '✦ Prompt para IA (que escriba el código por vos)';
  btnIA.addEventListener('click', () => copiarPromptCodigo(ficha));
  form.appendChild(btnIA);

  grid.appendChild(form);

  // ---- vista previa ----
  const prev = document.createElement('div');
  prev.className = 'ficha-card__preview';
  const lbl = document.createElement('div');
  lbl.className = 'ficha-card__preview-label';
  lbl.textContent = '// Así queda la ficha';
  prev.appendChild(lbl);
  prev.appendChild(construirFichaView(ficha, i + 1, state.opciones));
  if (ficha.tipo === 'scratch') avisarBloquesRojos(prev, ficha, card, i);
  grid.appendChild(prev);

  card.appendChild(grid);
  return card;
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ¿esta línea, dibujada sola, tiene bloques rojos (texto no reconocido)?
function lineaEsRoja(linea) {
  const r = renderBloques(linea.trim(), 1, 'scratch3');
  return !!(r && r.svg && r.svg.querySelector('.sb3-obsolete'));
}

// Si algún bloque quedó rojo, avisamos en el editor y proponemos la
// redacción correcta con un botón "Aplicar" por línea. Solo en la vista
// previa: no aparece en el PDF ni en el Word.
function avisarBloquesRojos(prev, ficha, card, i) {
  const viejo = prev.querySelector('.ficha-card__aviso-rojo');
  if (viejo) viejo.remove();
  const hayRojos = prev.querySelector('.ficha-view svg .sb3-obsolete, .ficha-view svg .sb2-obsolete');
  if (!hayRojos) return;

  // detectar qué líneas fallan y buscar una corrección para cada una
  const sugerencias = [];
  ficha.codigo.split('\n').forEach((l, idx) => {
    if (!l.trim() || !lineaEsRoja(l)) return;
    const propuesta = sugerirCorreccion(l);
    sugerencias.push({ idx, original: l.trim(), propuesta: propuesta && propuesta.trim() !== l.trim() ? propuesta : null });
  });

  const nota = document.createElement('div');
  nota.className = 'ficha-card__aviso-rojo';
  const titulo = document.createElement('div');
  titulo.innerHTML = '⚠ Hay bloques <strong>rojos</strong>: ese texto no coincide con ningún bloque real de Scratch.';
  nota.appendChild(titulo);

  const aplicar = (cambios) => {
    const ls = ficha.codigo.split('\n');
    cambios.forEach(({ idx, propuesta }) => { ls[idx] = propuesta; });
    ficha.codigo = ls.join('\n');
    const ta = card.querySelector('textarea.ficha-card__codigo');
    if (ta) ta.value = ficha.codigo;
    refrescar(card, ficha, i);
    toast('Corrección aplicada.');
  };

  const conPropuesta = sugerencias.filter(s => s.propuesta);
  conPropuesta.forEach(s => {
    const fila = document.createElement('div');
    fila.className = 'ficha-card__sugerencia';
    const texto = document.createElement('span');
    texto.innerHTML = `<code>${escHtml(s.original)}</code> → <code>${escHtml(s.propuesta.trim())}</code>`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ficha-card__accion';
    btn.textContent = '✓ Aplicar';
    btn.addEventListener('click', () => aplicar([s]));
    fila.append(texto, btn);
    nota.appendChild(fila);
  });

  if (conPropuesta.length > 1) {
    const todas = document.createElement('button');
    todas.type = 'button';
    todas.className = 'ficha-card__accion';
    todas.style.marginTop = '0.5rem';
    todas.textContent = `✓✓ Aplicar las ${conPropuesta.length} correcciones`;
    todas.addEventListener('click', () => aplicar(conPropuesta));
    nota.appendChild(todas);
  }

  const sinPropuesta = sugerencias.filter(s => !s.propuesta);
  if (sinPropuesta.length) {
    const p = document.createElement('div');
    p.className = 'ficha-card__sugerencia';
    p.innerHTML = 'Sin sugerencia automática para: ' +
      sinPropuesta.map(s => `<code>${escHtml(s.original)}</code>`).join(', ') +
      '. Mirá la redacción exacta en el <a href="#" data-abrir-guia="fichas">chuletario de bloques de la guía</a>.';
    nota.appendChild(p);
  }

  prev.appendChild(nota);
}

// re-dibuja SOLO la vista previa de una tarjeta (con debounce) y guarda
const debounces = {};
function refrescar(card, ficha, i) {
  guardarLuego();
  clearTimeout(debounces[ficha.id]);
  debounces[ficha.id] = setTimeout(() => {
    const resumen = card.querySelector('.ficha-card__resumen');
    if (resumen) resumen.textContent = ficha.titulo;
    const prev = card.querySelector('.ficha-card__preview');
    if (!prev) return;
    const viejo = prev.querySelector('.ficha-view');
    const nuevo = construirFichaView(ficha, i + 1, state.opciones);
    if (viejo) viejo.replaceWith(nuevo); else prev.appendChild(nuevo);
    if (ficha.tipo === 'scratch') avisarBloquesRojos(prev, ficha, card, i);
  }, 350);
}

// ---- helpers de campos ----
function campoTexto(etiqueta, valor, placeholder, onInput) {
  const div = document.createElement('div');
  div.className = 'campo';
  div.style.margin = '0';
  const lbl = document.createElement('label');
  lbl.className = 'campo__etiqueta';
  lbl.textContent = etiqueta;
  const inp = document.createElement('input');
  inp.className = 'campo__input';
  inp.type = 'text';
  inp.value = valor;
  inp.placeholder = placeholder;
  inp.addEventListener('input', () => onInput(inp.value));
  div.append(lbl, inp);
  return div;
}

function campoArea(etiqueta, valor, placeholder, filas, onInput) {
  const div = document.createElement('div');
  div.className = 'campo';
  div.style.margin = '0';
  const lbl = document.createElement('label');
  lbl.className = 'campo__etiqueta';
  lbl.textContent = etiqueta;
  const ta = document.createElement('textarea');
  ta.className = 'campo__textarea';
  ta.rows = filas;
  ta.value = valor;
  ta.placeholder = placeholder;
  ta.addEventListener('input', () => onInput(ta.value));
  div.append(lbl, ta);
  return div;
}

function campoRango(etiqueta, valor, min, max, paso, fmt, onInput) {
  const div = document.createElement('div');
  div.className = 'campo';
  const lbl = document.createElement('span');
  lbl.className = 'ficha-card__mini-label';
  lbl.textContent = etiqueta + ' — ' + fmt(valor);
  const inp = document.createElement('input');
  inp.type = 'range';
  inp.className = 'ficha-card__rango';
  inp.min = min; inp.max = max; inp.step = paso; inp.value = valor;
  inp.addEventListener('input', () => {
    const v = parseFloat(inp.value);
    lbl.textContent = etiqueta + ' — ' + fmt(v);
    onInput(v);
  });
  div.append(lbl, inp);
  return div;
}

function campoSelect(etiqueta, valor, opciones, onChange) {
  const div = document.createElement('div');
  div.className = 'campo';
  const lbl = document.createElement('span');
  lbl.className = 'ficha-card__mini-label';
  lbl.textContent = etiqueta;
  const sel = document.createElement('select');
  sel.className = 'campo__input';
  opciones.forEach(([v, t]) => {
    const o = document.createElement('option');
    o.value = v; o.textContent = t;
    if (valor === v) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener('change', () => onChange(sel.value));
  div.append(lbl, sel);
  return div;
}

function zonaImagen(ficha, card, i) {
  const wrap = document.createElement('div');
  wrap.className = 'campo';
  wrap.style.margin = '0';
  const lbl = document.createElement('span');
  lbl.className = 'ficha-card__mini-label';
  lbl.textContent = 'Imagen (opcional)';
  wrap.appendChild(lbl);

  const zona = document.createElement('div');
  zona.className = 'ficha-card__img-zona';

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';

  function pintar() {
    zona.innerHTML = '';
    if (ficha.imagen) {
      const th = document.createElement('img');
      th.className = 'ficha-card__img-thumb';
      th.src = ficha.imagen.data;
      const nom = document.createElement('span');
      nom.className = 'ficha-card__img-nombre';
      nom.textContent = ficha.imagen.nombre;
      const quitar = document.createElement('button');
      quitar.type = 'button';
      quitar.className = 'ficha-card__accion ficha-card__accion--peligro';
      quitar.textContent = '✕ Quitar';
      quitar.addEventListener('click', () => { ficha.imagen = null; pintar(); refrescar(card, ficha, i); });
      zona.append(th, nom, quitar);
    } else {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ficha-card__accion';
      btn.textContent = '+ Subir imagen';
      btn.addEventListener('click', () => input.click());
      const ayuda = document.createElement('span');
      ayuda.className = 'ficha-card__img-nombre';
      ayuda.textContent = 'PNG, JPG... se muestra junto al código';
      zona.append(btn, ayuda);
    }
  }
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const data = await archivoAImagen(file);
      ficha.imagen = { data, nombre: file.name };
      pintar();
      pintarControlesImg();
      refrescar(card, ficha, i);
    } catch (e) {
      toast('No se pudo cargar la imagen.');
    }
    input.value = '';
  });
  pintar();
  wrap.appendChild(zona);
  wrap.appendChild(input);

  // controles de posición y ancho (solo si hay imagen)
  const controles = document.createElement('div');
  controles.className = 'ficha-card__fila';
  controles.style.marginTop = '0.7rem';
  function pintarControlesImg() {
    controles.innerHTML = '';
    controles.style.display = ficha.imagen ? 'flex' : 'none';
    if (!ficha.imagen) return;

    const posDiv = document.createElement('div');
    posDiv.className = 'campo';
    const posLbl = document.createElement('span');
    posLbl.className = 'ficha-card__mini-label';
    posLbl.textContent = 'Posición de la imagen';
    const sel = document.createElement('select');
    sel.className = 'campo__input';
    [['derecha', 'A la derecha del código'], ['izquierda', 'A la izquierda'], ['arriba', 'Arriba del código'], ['abajo', 'Abajo del código']].forEach(([v, t]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = t;
      if (ficha.imgPos === v) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => { ficha.imgPos = sel.value; refrescar(card, ficha, i); });
    posDiv.append(posLbl, sel);
    controles.appendChild(posDiv);

    controles.appendChild(campoRango('Ancho de la imagen', ficha.imgAncho, 15, 70, 5, v => v + '%', v => { ficha.imgAncho = v; refrescar(card, ficha, i); }));

    const epi = campoTexto('Epígrafe (opcional)', ficha.epigrafe, 'Ej: Escenario esperado', v => { ficha.epigrafe = v; refrescar(card, ficha, i); });
    epi.querySelector('.campo__etiqueta').className = 'ficha-card__mini-label';
    controles.appendChild(epi);
  }
  pintarControlesImg();
  wrap.appendChild(controles);
  return wrap;
}

// redimensiona la imagen a un máximo razonable y la devuelve como dataURL
function archivoAImagen(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const MAX = 1200;
        let { width: w, height: h } = img;
        if (w <= MAX && h <= MAX && !String(reader.result).startsWith('data:image/svg')) {
          resolve(reader.result);
          return;
        }
        const k = Math.min(MAX / w, MAX / h, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * k);
        canvas.height = Math.round(h * k);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// ---- acciones de lista ----
function mover(i, delta) {
  const j = i + delta;
  if (j < 0 || j >= state.fichas.length) return;
  const [f] = state.fichas.splice(i, 1);
  state.fichas.splice(j, 0, f);
  renderLista();
  guardarLuego();
}
function duplicar(i) {
  const copia = JSON.parse(JSON.stringify(state.fichas[i]));
  copia.id = 'f' + (uid++) + '_dup';
  state.fichas.splice(i + 1, 0, copia);
  renderLista();
  guardarLuego();
}
function eliminar(i) {
  if (!confirm('¿Eliminar la ficha ' + (i + 1) + '?')) return;
  state.fichas.splice(i, 1);
  renderLista();
  guardarLuego();
}

// ============================================================
// Persistencia
// ============================================================
let saveTimer = null;
function guardarLuego() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* cuota llena: seguimos sin autosave */ }
  }, 500);
}

function cargar() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data && Array.isArray(data.fichas)) {
      state = Object.assign(state, data);
      state.opciones = Object.assign({ numerar: true, bordes: true, salto: false }, data.opciones);
      // borradores viejos: completar campos que no existían (tipo, estilo, vista...)
      state.fichas = state.fichas.map(f => Object.assign(nuevaFicha(), f));
    }
  } catch (e) { /* borrador corrupto: arrancamos de cero */ }
}

// ============================================================
// Exportaciones
// ============================================================
function nombreArchivo(ext) {
  const base = (state.titulo.trim() || 'fichas-scratch')
    .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'fichas-scratch';
  return base + '.' + ext;
}

function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function hayFichasConContenido() {
  const ok = state.fichas.some(f => f.codigo.trim() || f.consigna.trim() || f.imagen);
  if (!ok) toast('Agregá al menos una ficha con contenido antes de exportar.');
  return ok;
}

// espera a que estén dibujados los bloques micro:bit que se van a mostrar
function esperarBloquesMicrobit() {
  const pedidos = state.fichas
    .filter(f => f.tipo === 'microbit' && f.codigo.trim() && microbitMuestraBloques(f))
    .map(f => obtenerBloquesMicrobit(f.codigo).catch(() => null));
  return Promise.all(pedidos);
}

// --- PDF (impresión del navegador) ---
async function exportarPDF() {
  if (!hayFichasConContenido()) return;
  const nota = document.getElementById('notaExportFichas');
  if (state.fichas.some(f => f.tipo === 'microbit' && f.codigo.trim() && microbitMuestraBloques(f))) {
    nota.style.display = 'block';
    nota.textContent = 'Dibujando los bloques de micro:bit con MakeCode…';
    await esperarBloquesMicrobit();
    nota.textContent = '';
    nota.style.display = 'none';
  }
  const area = document.getElementById('areaImpresion');
  area.innerHTML = '';
  if (state.titulo.trim()) {
    const h = document.createElement('h1');
    h.className = 'fichas-impresion__titulo';
    h.textContent = state.titulo;
    area.appendChild(h);
  }
  if (state.subtitulo.trim()) {
    const s = document.createElement('p');
    s.className = 'fichas-impresion__sub';
    s.textContent = state.subtitulo;
    area.appendChild(s);
  }
  state.fichas.forEach((f, i) => {
    const v = construirFichaView(f, i + 1, state.opciones);
    if (state.opciones.salto) v.classList.add('ficha-view--salto');
    area.appendChild(v);
  });
  window.print();
}

// --- DOCX ---
async function exportarDOCX() {
  if (!hayFichasConContenido()) return;
  const btn = document.getElementById('btnFichasDOCX');
  const nota = document.getElementById('notaExportFichas');
  btn.disabled = true;
  nota.style.display = 'block';
  nota.textContent = 'Generando el documento de Word...';
  try {
    const preparadas = [];
    for (let i = 0; i < state.fichas.length; i++) {
      const f = state.fichas[i];
      let bloques = null;
      if (f.tipo === 'microbit') {
        if (f.codigo.trim() && microbitMuestraBloques(f)) {
          nota.textContent = 'Dibujando los bloques de micro:bit con MakeCode…';
          bloques = await obtenerBloquesMicrobit(f.codigo)
            .then(info => ({ dataUrl: info.uri, width: info.width, height: info.height }))
            .catch(() => null); // sin conexión: el Word lleva el código como texto
        }
      } else {
        const svgInfo = svgStringDeFicha(f);
        if (svgInfo) {
          bloques = await svgAPng(svgInfo.svg, svgInfo.width, svgInfo.height);
        }
      }
      let imagen = null;
      if (f.imagen) {
        imagen = await dataUrlAPngInfo(f.imagen.data);
      }
      preparadas.push({ ficha: f, numero: i + 1, bloques, imagen });
    }
    const blob = await exportarFichasDOCX({
      titulo: state.titulo,
      subtitulo: state.subtitulo,
      opciones: state.opciones,
      fichas: preparadas
    });
    descargarBlob(blob, nombreArchivo('docx'));
    nota.textContent = 'Listo: se descargó ' + nombreArchivo('docx');
  } catch (e) {
    console.error(e);
    nota.textContent = 'Hubo un problema generando el Word: ' + (e.message || e);
  } finally {
    btn.disabled = false;
  }
}

// rasteriza un SVG (string) a PNG con nitidez 2x
function svgAPng(svgString, w, h, escala = 2) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const width = w || img.naturalWidth || 400;
      const height = h || img.naturalHeight || 100;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil(width * escala));
      canvas.height = Math.max(1, Math.ceil(height * escala));
      const ctx = canvas.getContext('2d');
      ctx.scale(escala, escala);
      ctx.drawImage(img, 0, 0, width, height);
      resolve({ dataUrl: canvas.toDataURL('image/png'), width, height });
    };
    img.onerror = () => reject(new Error('No se pudo dibujar el SVG de los bloques'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
  });
}

// normaliza cualquier imagen del usuario a PNG + dimensiones
function dataUrlAPngInfo(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      if (dataUrl.startsWith('data:image/png')) {
        resolve({ dataUrl, width: w, height: h });
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve({ dataUrl: canvas.toDataURL('image/png'), width: w, height: h });
    };
    img.onerror = () => reject(new Error('No se pudo procesar la imagen'));
    img.src = dataUrl;
  });
}

// --- JSON borrador ---
function exportarJSON() {
  const blob = new Blob([JSON.stringify({ tipo: 'fichas_scratch', ...state }, null, 2)], { type: 'application/json' });
  descargarBlob(blob, nombreArchivo('json'));
}

function importarJSON(texto) {
  const data = JSON.parse(texto);
  if (!data || data.tipo !== 'fichas_scratch' || !Array.isArray(data.fichas)) {
    throw new Error('El archivo no es un borrador de fichas Scratch.');
  }
  state.titulo = data.titulo || '';
  state.subtitulo = data.subtitulo || '';
  state.opciones = Object.assign({ numerar: true, bordes: true, salto: false }, data.opciones);
  state.fichas = data.fichas.map(f => Object.assign(nuevaFicha(), f, { id: 'f' + (uid++) + '_imp' }));
  sincronizarCampos();
  renderLista();
  guardarLuego();
  toast('Borrador importado: ' + state.fichas.length + ' ficha(s).');
}

// --- Prompt para que la IA escriba código scratchblocks ---
function copiarPromptCodigo(ficha) {
  const tema = ficha.titulo.trim() || ficha.consigna.trim() || '[describí acá qué tiene que hacer el programa]';
  if (ficha.tipo === 'microbit') {
    const lenguaje = ficha.lenguaje === 'python' ? 'Python de MakeCode (micro:bit)' : 'JavaScript de MakeCode (micro:bit)';
    const prompt = `Escribí un programa en ${lenguaje} para esto:

${tema}

REGLAS:
- Usá SOLO la API de MakeCode para micro:bit (basic, input, music, led, radio, pins...).
- Ejemplos de la API: basic.showString("..."), basic.showIcon(IconNames.Heart), input.onButtonPressed(Button.A, ...), basic.forever(...), basic.pause(500).
- Código completo y que compile en makecode.microbit.org.
- No uses bloques de código markdown ni explicaciones.

Respondé SOLO con el código.`;
    copiarTexto(prompt, 'Prompt copiado. Pegalo en ChatGPT, Claude o Gemini y traé el código.');
    return;
  }
  const prompt = `Escribí un programa de Scratch en sintaxis "scratchblocks" (texto plano) para esto:

${tema}

REGLAS DE LA SINTAXIS:
- Un bloque por línea, escrito en español tal como se lee en Scratch (ej: "al presionar bandera verde", "mover (10) pasos", "decir [¡Hola!] durante (2) segundos").
- Números y valores entre paréntesis: (10). Textos entre corchetes: [hola]. Desplegables con [v] al final: "al presionar tecla [espacio v]".
- Condiciones entre ángulos: <¿tocando [borde v]?>, <(x) > (50)>.
- Los bloques "si ... entonces", "repetir", "por siempre" se cierran con una línea "fin".
- Separá pilas de bloques distintas con una línea en blanco.
- Usá EXACTAMENTE estas redacciones (un texto distinto se dibuja como bloque rojo inválido):
  girar a la derecha (15) grados / decir [Hola] durante (2) segundos / iniciar sonido [Miau v]
  dar a [puntaje v] el valor (0) / sumar a [puntaje v] (1) / si toca un borde, rebotar / ¿tocando [borde v]?
- No uses numeración, viñetas ni bloques de código markdown.

Respondé SOLO con el código scratchblocks, sin explicación.`;
  copiarTexto(prompt, 'Prompt copiado. Pegalo en ChatGPT, Claude o Gemini y traé el código.');
}

// ============================================================
// Cuestionario para CREA: las fichas se convierten en preguntas
// donde la imagen de los bloques es parte del enunciado.
// ============================================================

// Renderiza cada ficha a PNG y devuelve el mapa de imágenes para el cuestionario.
// nombrePorFicha[i] = 'ficha_N.png' o null si la ficha no genera imagen.
async function imagenesDeFichas(nota) {
  const imagenes = {};
  const nombrePorFicha = [];
  for (let i = 0; i < state.fichas.length; i++) {
    const f = state.fichas[i];
    let dataUrl = null;
    if (f.codigo.trim()) {
      if (f.tipo === 'microbit') {
        if (f.lenguaje !== 'python') {
          if (nota) nota.textContent = `Dibujando los bloques de la ficha ${i + 1} con MakeCode…`;
          dataUrl = await obtenerBloquesMicrobit(f.codigo).then(x => x.uri).catch(() => null);
        }
      } else {
        const s = svgStringDeFicha(f);
        if (s) dataUrl = (await svgAPng(s.svg, s.width, s.height)).dataUrl;
      }
    }
    if (!dataUrl && f.imagen) dataUrl = f.imagen.data; // sin bloques: va la imagen subida
    if (dataUrl) {
      const nombre = `ficha_${i + 1}.png`;
      imagenes[nombre] = dataUrl;
      nombrePorFicha.push(nombre);
    } else {
      nombrePorFicha.push(null);
    }
  }
  return { imagenes, nombrePorFicha };
}

// Manda el cuestionario al Editor por localStorage y navega.
function abrirEnEditor(preguntas, imagenes) {
  const payload = {
    titulo: state.titulo.trim() || 'Fichas de programación',
    nivel: state.subtitulo.trim(),
    preguntas,
    imagenes
  };
  try {
    localStorage.setItem('gen_handoff_quiz', JSON.stringify(payload));
  } catch (e) {
    toast('El cuestionario es muy pesado para el traspaso automático (demasiadas imágenes). Probá con menos fichas.');
    return;
  }
  window.location.href = 'editor.html?tipo=cuestionario';
}

function fichasConContenido() {
  return state.fichas
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.codigo.trim() || f.consigna.trim() || f.imagen);
}

// --- Cuestionario automático: 1 pregunta de comprensión por ficha ---
async function generarCuestionarioAuto() {
  if (!hayFichasConContenido()) return;
  const btn = document.getElementById('btnCreaAuto');
  const nota = document.getElementById('notaCrea');
  btn.disabled = true;
  nota.style.display = 'block';
  nota.textContent = 'Preparando las imágenes de los bloques…';
  try {
    const { imagenes, nombrePorFicha } = await imagenesDeFichas(nota);
    const lineas = [
      `# Cuestionario: ${state.titulo.trim() || 'Fichas de programación'}`,
      `# Nivel: ${state.subtitulo.trim() || ''}`,
      ''
    ];
    let n = 0;
    fichasConContenido().forEach(({ f, i }) => {
      n++;
      lineas.push(`## P${n} :: ensayo`);
      if (f.titulo.trim()) lineas.push(f.titulo.trim());
      if (nombrePorFicha[i]) lineas.push(`[IMG: ${nombrePorFicha[i]}]`);
      lineas.push(f.consigna.trim() || 'Observá el programa de la imagen y explicá con tus palabras qué hace, paso a paso.');
      if (!nombrePorFicha[i] && f.codigo.trim()) {
        // sin imagen (ej: micro:bit en Python sin conexión): el código va como texto
        lineas.push('', f.codigo.trim());
      }
      lineas.push('');
    });
    const res = parsear(lineas.join('\n'));
    if (!res.preguntas.length) throw new Error('no se pudo armar ninguna pregunta');
    nota.textContent = 'Abriendo el Editor…';
    abrirEnEditor(res.preguntas, imagenes);
  } catch (e) {
    console.error(e);
    nota.textContent = 'Hubo un problema armando el cuestionario: ' + (e.message || e);
  } finally {
    btn.disabled = false;
  }
}

// --- Prompt de IA: preguntas variadas que citan las imágenes de las fichas ---
function copiarPromptCuestionarioIA() {
  if (!hayFichasConContenido()) return;
  const fichasTxt = fichasConContenido()
    .map(({ f, i }) => {
      let t = `FICHA ${i + 1}${f.titulo.trim() ? ' — ' + f.titulo : ''} (su imagen es [IMG: ficha_${i + 1}.png])`;
      if (f.consigna.trim()) t += `\nConsigna original: ${f.consigna}`;
      if (f.codigo.trim()) {
        const etiqueta = f.tipo === 'microbit'
          ? `Código MakeCode para micro:bit (${f.lenguaje === 'python' ? 'Python' : 'JavaScript'})`
          : 'Código Scratch';
        t += `\n${etiqueta}:\n${f.codigo}`;
      }
      return t;
    }).join('\n\n---\n\n');

  const prompt = `Sos docente de programación. A partir de estas fichas didácticas (cada una tiene una imagen con los bloques del programa, que el alumno VE en la pregunta), generá un cuestionario de comprensión de entre 6 y 12 preguntas: qué hacen los programas, qué bloques se usan, qué pasaría si se cambian valores, encontrar errores, etc.

${fichasTxt}

Respondé SOLO con el contenido en el formato indicado abajo, sin texto antes ni después, sin bloques de código markdown.

## FORMATO REQUERIDO

# Cuestionario: ${state.titulo.trim() || 'Fichas de programación'}
# Nivel: ${state.subtitulo.trim() || '[nivel]'}

## P1 :: opcion_multiple :: 1pt
[IMG: ficha_1.png]
¿Qué hace este programa cuando el personaje toca un borde?
- [ ] Opción incorrecta
- [x] Opción correcta
- [ ] Otra incorrecta
- [ ] Otra incorrecta
> Retro: Explicación breve de por qué es correcta.

## P2 :: verdadero_falso :: 1pt
[IMG: ficha_1.png]
Afirmación sobre el programa de la imagen.
**Respuesta:** Verdadero
> Retro: Explicación.

## P3 :: respuesta_corta :: 1pt
[IMG: ficha_2.png]
¿Pregunta donde el alumno escribe la respuesta?
**Respuestas aceptadas:** Respuesta 1 | Respuesta 2

## P4 :: ensayo
[IMG: ficha_2.png]
Pregunta abierta para que el alumno desarrolle.

## REGLAS
- Numerá las preguntas secuencialmente: P1, P2, P3...
- Usá SOLO los tipos: opcion_multiple, verdadero_falso, respuesta_corta, ensayo.
- MUY IMPORTANTE: cuando una pregunta refiera a una ficha, incluí su token de imagen en una línea propia al inicio del enunciado, ej: [IMG: ficha_1.png] — así el alumno ve los bloques en la pregunta. Usá SOLO los tokens listados arriba.
- Marcá la opción correcta con [x] y las incorrectas con [ ].
- Para opción múltiple, incluí 4 opciones por pregunta.
- Si citás bloques en el texto, escribilos entre comillas, ej: "mover (10) pasos".
- Incluí retroalimentación (> Retro:) en todas las preguntas que puedas.
- Cubrí todas las fichas, con dificultad creciente.`;

  copiarTexto(prompt, 'Prompt copiado. Pegá la respuesta de la IA acá abajo y se abre en el Editor con las imágenes.');
}

// --- Procesar la respuesta de la IA y abrir en el Editor ---
async function procesarCuestionarioIA() {
  const texto = document.getElementById('textareaRespuestaCreaIA').value;
  if (!texto.trim()) { toast('Pegá primero la respuesta de la IA.'); return; }
  const btn = document.getElementById('btnProcesarCreaIA');
  const nota = document.getElementById('notaCrea');
  const avisosCont = document.getElementById('avisosCreaIA');
  avisosCont.innerHTML = '';
  btn.disabled = true;
  nota.style.display = 'block';
  nota.textContent = 'Procesando las preguntas…';
  try {
    const res = parsear(texto);
    if (!res.preguntas.length) {
      throw new Error('no se encontraron preguntas en el texto. ¿Copiaste la respuesta completa de la IA?');
    }
    if (res.advertencias && res.advertencias.length) {
      const div = document.createElement('div');
      div.className = 'alerta alerta--info';
      div.innerHTML = '<strong>Avisos del formato:</strong><br>' + res.advertencias.map(a => escHtml(typeof a === 'string' ? a : a.mensaje || JSON.stringify(a))).join('<br>');
      avisosCont.appendChild(div);
    }
    nota.textContent = 'Preparando las imágenes de los bloques…';
    const { imagenes } = await imagenesDeFichas(nota);
    nota.textContent = 'Abriendo el Editor…';
    abrirEnEditor(res.preguntas, imagenes);
  } catch (e) {
    console.error(e);
    nota.textContent = 'Hubo un problema: ' + (e.message || e);
  } finally {
    btn.disabled = false;
  }
}

// ============================================================
// Utilidades UI
// ============================================================
function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) { alert(msg); return; }
  t.textContent = msg;
  t.classList.add('toast--visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove('toast--visible'), 3500);
}

function copiarTexto(texto, msgOk) {
  navigator.clipboard.writeText(texto).then(
    () => toast(msgOk || 'Copiado al portapapeles.'),
    () => {
      const ta = document.createElement('textarea');
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast(msgOk || 'Copiado al portapapeles.');
    }
  );
}

function sincronizarCampos() {
  document.getElementById('fdTitulo').value = state.titulo;
  document.getElementById('fdSubtitulo').value = state.subtitulo;
  document.getElementById('fdNumerar').checked = state.opciones.numerar;
  document.getElementById('fdBordes').checked = state.opciones.bordes;
  document.getElementById('fdSalto').checked = state.opciones.salto;
}

// ============================================================
// Init
// ============================================================
function init() {
  if (sb && typeof sb.appendStyles === 'function') sb.appendStyles();

  cargar();
  sincronizarCampos();
  renderLista();

  document.getElementById('fdTitulo').addEventListener('input', e => { state.titulo = e.target.value; guardarLuego(); });
  document.getElementById('fdSubtitulo').addEventListener('input', e => { state.subtitulo = e.target.value; guardarLuego(); });
  [['fdNumerar', 'numerar'], ['fdBordes', 'bordes'], ['fdSalto', 'salto']].forEach(([id, key]) => {
    document.getElementById(id).addEventListener('change', e => {
      state.opciones[key] = e.target.checked;
      renderLista();
      guardarLuego();
    });
  });

  function scrollUltimaFicha() {
    const cards = lista.querySelectorAll('.ficha-card');
    cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function agregarFicha(tipo) {
    const primeraDeTipo = !state.fichas.some(f => f.tipo === tipo);
    const ejemplo = tipo === 'microbit' ? CODIGO_EJEMPLO_MICROBIT : CODIGO_EJEMPLO;
    state.fichas.push(nuevaFicha(primeraDeTipo ? ejemplo : '', tipo));
    renderLista();
    guardarLuego();
    scrollUltimaFicha();
  }
  document.getElementById('btnAgregarFicha').addEventListener('click', () => agregarFicha('scratch'));
  document.getElementById('btnAgregarFichaMicrobit').addEventListener('click', () => agregarFicha('microbit'));
  document.getElementById('btnAgregarFichaAbajo')?.addEventListener('click', () => agregarFicha('scratch'));

  // ---- pestañas de modo (visual / texto / ia) ----
  document.querySelectorAll('.tab-modo').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-modo').forEach(t => t.classList.toggle('active', t === tab));
      const modo = tab.dataset.modo;
      document.getElementById('panel-fichas-visual').style.display = modo === 'visual' ? '' : 'none';
      document.getElementById('panel-fichas-texto').style.display = modo === 'texto' ? '' : 'none';
      document.getElementById('panel-fichas-ia').style.display = modo === 'ia' ? '' : 'none';
    });
  });
  function irAlEditorVisual() {
    document.querySelector('.tab-modo[data-modo="visual"]')?.click();
  }

  // ---- plantillas ----
  const barra = document.getElementById('barraPlantillas');
  PLANTILLAS.forEach(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tag';
    b.textContent = p.nombre;
    b.title = p.consigna;
    b.addEventListener('click', () => {
      const f = Object.assign(nuevaFicha('', p.tipo), {
        titulo: p.titulo, consigna: p.consigna, codigo: p.codigo, notas: p.notas
      });
      if (p.tipo === 'microbit') f.vista = 'ambos';
      state.fichas.push(f);
      renderLista();
      guardarLuego();
      scrollUltimaFicha();
      toast('Plantilla agregada: editala a tu gusto.');
    });
    barra.appendChild(b);
  });

  // ---- importar fichas desde texto ----
  function mostrarAvisos(contId, avisos) {
    const cont = document.getElementById(contId);
    cont.innerHTML = '';
    if (!avisos.length) return;
    const div = document.createElement('div');
    div.className = 'alerta alerta--info';
    div.innerHTML = '<strong>Avisos:</strong><br>' + avisos.map(escHtml).join('<br>');
    cont.appendChild(div);
  }

  function cargarFichasParseadas(res, reemplazar, avisosId) {
    mostrarAvisos(avisosId, res.avisos);
    if (!res.fichas.length) {
      toast('No se encontraron fichas en el texto.');
      return;
    }
    if (res.titulo && (reemplazar || !state.titulo.trim())) state.titulo = res.titulo;
    if (res.subtitulo && (reemplazar || !state.subtitulo.trim())) state.subtitulo = res.subtitulo;
    const nuevas = res.fichas.map(f => Object.assign(nuevaFicha(), f));
    state.fichas = reemplazar ? nuevas : state.fichas.concat(nuevas);
    sincronizarCampos();
    renderLista();
    guardarLuego();
    toast(`Se ${reemplazar ? 'cargaron' : 'agregaron'} ${nuevas.length} ficha(s). Revisalas en el Editor Visual.`);
    irAlEditorVisual();
  }

  document.getElementById('btnEjemploFichasTexto').addEventListener('click', () => {
    document.getElementById('textareaFichasTexto').value = EJEMPLO_FICHAS_TEXTO;
  });
  document.getElementById('btnProcesarFichasTexto').addEventListener('click', () => {
    const texto = document.getElementById('textareaFichasTexto').value;
    if (!texto.trim()) { toast('Pegá primero el texto con las fichas.'); return; }
    cargarFichasParseadas(parsearFichasTexto(texto), document.getElementById('chkReemplazarFichas').checked, 'avisosFichasTexto');
  });

  // ---- asistente IA ----
  document.getElementById('formPromptFichas').addEventListener('submit', (e) => {
    e.preventDefault();
    const prompt = generarPromptFichas({
      tema: document.getElementById('iaFichasTema').value.trim(),
      nivel: state.subtitulo,
      cantidad: parseInt(document.getElementById('iaFichasCantidad').value, 10) || 4,
      plataforma: document.getElementById('iaFichasPlataforma').value,
      enfoque: document.getElementById('iaFichasEnfoque').value,
      notas: document.getElementById('iaFichasNotas').value.trim()
    });
    const caja = document.getElementById('cajaPrompt');
    caja.textContent = prompt;
    caja.classList.add('caja-prompt--visible');
    document.getElementById('accionesPromptFichas').style.display = 'flex';
  });
  document.getElementById('btnCopiarPromptFichas').addEventListener('click', () => {
    const t = document.getElementById('cajaPrompt').textContent;
    if (t.trim()) copiarTexto(t, 'Prompt copiado. Pegalo en tu IA y traé la respuesta.');
  });
  document.getElementById('btnProcesarIAFichas').addEventListener('click', () => {
    const texto = document.getElementById('textareaRespuestaIAFichas').value;
    if (!texto.trim()) { toast('Pegá primero la respuesta de la IA.'); return; }
    cargarFichasParseadas(parsearFichasTexto(texto), document.getElementById('chkReemplazarFichasIA').checked, 'avisosFichasIA');
  });

  // ---- copiar fichas como texto (para editar en lote y reimportar) ----
  document.getElementById('btnFichasCopiarTexto').addEventListener('click', () => {
    if (!hayFichasConContenido()) return;
    copiarTexto(fichasComoTexto(state), 'Fichas copiadas como texto. Editalas donde quieras y volvé a pegarlas en «Importar Texto».');
  });

  document.getElementById('btnImportarFichasJson').addEventListener('click', () => document.getElementById('inputFichasJson').click());
  document.getElementById('inputFichasJson').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { importarJSON(reader.result); }
      catch (err) { toast('No se pudo importar: ' + err.message); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('btnFichasPDF').addEventListener('click', exportarPDF);
  document.getElementById('btnFichasDOCX').addEventListener('click', exportarDOCX);
  document.getElementById('btnFichasJSON').addEventListener('click', exportarJSON);
  document.getElementById('btnCreaAuto').addEventListener('click', generarCuestionarioAuto);
  document.getElementById('btnCreaPromptIA').addEventListener('click', copiarPromptCuestionarioIA);
  document.getElementById('btnProcesarCreaIA').addEventListener('click', procesarCuestionarioIA);
}

init();
