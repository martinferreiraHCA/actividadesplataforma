// Editor de fichas didácticas con bloques de Scratch (scratchblocks)
import { exportarFichasDOCX } from './export-fichas-docx.js';

const STORAGE_KEY = 'gen_fichas_scratch';
const sb = window.scratchblocks;

const CODIGO_EJEMPLO = `al presionar bandera verde
por siempre
  mover (10) pasos
  si <¿tocando un borde?> entonces
    girar (180) grados
  fin
fin`;

let state = {
  titulo: '',
  subtitulo: '',
  opciones: { numerar: true, bordes: true, salto: false },
  fichas: []
};

let uid = 1;
function nuevaFicha(codigo) {
  return {
    id: 'f' + (uid++) + '_' + state.fichas.length,
    titulo: '',
    consigna: '',
    codigo: codigo || '',
    escala: 1,
    notas: '',
    imagen: null,          // { data: dataURL, nombre }
    imgPos: 'derecha',     // derecha | izquierda | arriba | abajo
    imgAncho: 40,          // % del ancho de la ficha
    epigrafe: ''
  };
}

// ============================================================
// Render de bloques
// ============================================================
function renderBloques(codigo, escala) {
  if (!sb || !codigo.trim()) return null;
  try {
    const doc = sb.parse(codigo, { languages: ['en', 'es'] });
    const view = sb.newView(doc, { style: 'scratch3', scale: escala || 1 });
    const svg = view.render();
    return { svg, view };
  } catch (e) {
    return { error: e.message || String(e) };
  }
}

function svgStringDeFicha(ficha) {
  const r = renderBloques(ficha.codigo, ficha.escala);
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
  const r = renderBloques(ficha.codigo, ficha.escala);
  if (r && r.svg) {
    zonaCodigo.appendChild(r.svg);
  } else if (r && r.error) {
    const err = document.createElement('span');
    err.className = 'ficha-view__vacio';
    err.textContent = 'No se pudo dibujar el código: ' + r.error;
    zonaCodigo.appendChild(err);
  } else {
    const vacio = document.createElement('span');
    vacio.className = 'ficha-view__vacio';
    vacio.textContent = '(sin código todavía)';
    zonaCodigo.appendChild(vacio);
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
  top.innerHTML = `<span class="ficha-card__num">FICHA ${i + 1} / ${state.fichas.length}</span><span class="ficha-card__top-sep"></span>`;
  const acciones = [
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

  const grid = document.createElement('div');
  grid.className = 'ficha-card__grid';

  // ---- formulario ----
  const form = document.createElement('div');
  form.className = 'ficha-card__form';

  form.appendChild(campoTexto('Título de la ficha (opcional)', ficha.titulo, 'Ej: El gato rebota en los bordes', v => { ficha.titulo = v; refrescar(card, ficha, i); }));
  form.appendChild(campoArea('Consigna / explicación (opcional)', ficha.consigna, 'Ej: Leé el programa y explicá qué hace el gato...', 2, v => { ficha.consigna = v; refrescar(card, ficha, i); }));

  const campoCod = campoArea('Código Scratch (texto plano)', ficha.codigo, CODIGO_EJEMPLO, 7, v => { ficha.codigo = v; refrescar(card, ficha, i); });
  campoCod.querySelector('textarea').classList.add('ficha-card__codigo');
  form.appendChild(campoCod);

  // escala
  const filaEscala = document.createElement('div');
  filaEscala.className = 'ficha-card__fila';
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
  grid.appendChild(prev);

  card.appendChild(grid);
  return card;
}

// re-dibuja SOLO la vista previa de una tarjeta (con debounce) y guarda
const debounces = {};
function refrescar(card, ficha, i) {
  guardarLuego();
  clearTimeout(debounces[ficha.id]);
  debounces[ficha.id] = setTimeout(() => {
    const prev = card.querySelector('.ficha-card__preview');
    if (!prev) return;
    const viejo = prev.querySelector('.ficha-view');
    const nuevo = construirFichaView(ficha, i + 1, state.opciones);
    if (viejo) viejo.replaceWith(nuevo); else prev.appendChild(nuevo);
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

// --- PDF (impresión del navegador) ---
function exportarPDF() {
  if (!hayFichasConContenido()) return;
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
      const svgInfo = svgStringDeFicha(f);
      if (svgInfo) {
        bloques = await svgAPng(svgInfo.svg, svgInfo.width, svgInfo.height);
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
  const prompt = `Escribí un programa de Scratch en sintaxis "scratchblocks" (texto plano) para esto:

${tema}

REGLAS DE LA SINTAXIS:
- Un bloque por línea, escrito en español tal como se lee en Scratch (ej: "al presionar bandera verde", "mover (10) pasos", "decir [¡Hola!] por (2) segundos").
- Números y valores entre paréntesis: (10). Textos entre corchetes: [hola]. Desplegables con [v] al final: "al presionar tecla [espacio v]".
- Condiciones entre ángulos: <¿tocando un borde?>, <(x) > (50)>.
- Los bloques "si ... entonces", "repetir", "por siempre" se cierran con una línea "fin".
- Separá pilas de bloques distintas con una línea en blanco.
- No uses numeración, viñetas ni bloques de código markdown.

Respondé SOLO con el código scratchblocks, sin explicación.`;
  copiarTexto(prompt, 'Prompt copiado. Pegalo en ChatGPT, Claude o Gemini y traé el código.');
}

// --- Prompt de preguntas para CREA ---
function copiarPromptPreguntas() {
  if (!hayFichasConContenido()) return;
  const fichasTxt = state.fichas
    .filter(f => f.codigo.trim() || f.consigna.trim())
    .map((f, i) => {
      let t = `FICHA ${i + 1}${f.titulo.trim() ? ' — ' + f.titulo : ''}`;
      if (f.consigna.trim()) t += `\nConsigna: ${f.consigna}`;
      if (f.codigo.trim()) t += `\nCódigo Scratch:\n${f.codigo}`;
      return t;
    }).join('\n\n---\n\n');

  const prompt = `Sos docente de programación con Scratch. A partir de estas fichas didácticas, generá un cuestionario de comprensión (entre 5 y 10 preguntas) sobre qué hacen los programas, qué bloques se usan y qué pasaría si se cambian valores.

${fichasTxt}

Respondé SOLO con el contenido en el formato indicado abajo, sin texto antes ni después, sin bloques de código.

## FORMATO REQUERIDO

# Cuestionario: ${state.titulo.trim() || 'Fichas de Scratch'}
# Nivel: ${state.subtitulo.trim() || '[nivel]'}

## P1 :: opcion_multiple :: 1pt
¿Texto de la pregunta?
- [ ] Opción incorrecta
- [x] Opción correcta
- [ ] Otra incorrecta
- [ ] Otra incorrecta
> Retro: Explicación breve de por qué es correcta.

## P2 :: verdadero_falso :: 1pt
Afirmación para evaluar.
**Respuesta:** Verdadero
> Retro: Explicación.

## P3 :: respuesta_corta :: 1pt
¿Pregunta donde el alumno escribe la respuesta?
**Respuestas aceptadas:** Respuesta 1 | Respuesta 2

## P4 :: ensayo
Pregunta abierta para que el alumno desarrolle.

## REGLAS
- Numerá las preguntas secuencialmente: P1, P2, P3...
- Usá SOLO los tipos: opcion_multiple, verdadero_falso, respuesta_corta, ensayo.
- Marcá la opción correcta con [x] y las incorrectas con [ ].
- Si citás bloques de Scratch en una pregunta, escribilos entre comillas, ej: "mover (10) pasos".
- Incluí retroalimentación (> Retro:) en todas las preguntas que puedas.`;

  copiarTexto(prompt, 'Prompt copiado. Pegá la respuesta de la IA en el Editor → Importar Texto, y de ahí exportás a CREA.');
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

  document.getElementById('btnAgregarFicha').addEventListener('click', () => {
    state.fichas.push(nuevaFicha(state.fichas.length ? '' : CODIGO_EJEMPLO));
    renderLista();
    guardarLuego();
    const cards = lista.querySelectorAll('.ficha-card');
    cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  document.getElementById('btnFichasPreguntas').addEventListener('click', copiarPromptPreguntas);
}

init();
