// instrumentos-ui.js — La página del banco: catálogo, configurador en vivo
// y generador de hojas de ejercicios de lectura de escalas.

import {
  catalogoInstrumentos, categoriasInstrumentos, instrumentoPorId,
  paramsPorDefecto, normalizarParams, dibujarInstrumento, svgATexto, svgAPNG,
  fichaTecnica, apreciacionDe, incertidumbreDe, unidadDe, lecturaAlAzar,
  instrumentoATexto, decimalesDe, fmt
} from './instrumentos.js';

const $ = id => document.getElementById(id);

const estado = {
  id: 'regla',
  params: paramsPorDefecto('regla'),
  categoria: 'todas',
  busqueda: '',
  ejercicios: []
};

function toast(msg) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('toast--visible');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('toast--visible'), 3000);
}

function descargar(nombre, contenido, tipo) {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function nombreArchivo(base, ext) {
  return base.replace(/[\\/:*?"<>|]+/g, '-').trim() + '.' + ext;
}

// ============================================================
// Catálogo
// ============================================================
function pintarFiltros() {
  const cont = $('filtros');
  const buscador = $('buscador');
  const cats = ['todas'].concat(categoriasInstrumentos());
  cats.forEach(cat => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'instr-chip' + (cat === estado.categoria ? ' instr-chip--activo' : '');
    b.textContent = cat === 'todas' ? 'Todos' : cat;
    b.dataset.cat = cat;
    b.addEventListener('click', () => {
      estado.categoria = cat;
      cont.querySelectorAll('.instr-chip').forEach(c => c.classList.toggle('instr-chip--activo', c.dataset.cat === cat));
      pintarCatalogo();
    });
    cont.insertBefore(b, buscador);
  });
  buscador.addEventListener('input', () => {
    estado.busqueda = buscador.value.trim().toLowerCase();
    pintarCatalogo();
  });
}

function instrumentosVisibles() {
  return catalogoInstrumentos().filter(def => {
    if (estado.categoria !== 'todas' && def.categoria !== estado.categoria) return false;
    if (!estado.busqueda) return true;
    const heno = (def.nombre + ' ' + def.categoria + ' ' + def.magnitud + ' ' + def.resumen).toLowerCase();
    return heno.indexOf(estado.busqueda) >= 0;
  });
}

function pintarCatalogo() {
  const grid = $('gridInstrumentos');
  grid.innerHTML = '';
  const lista = instrumentosVisibles();
  if (!lista.length) {
    const p = document.createElement('p');
    p.className = 'wiz-explica';
    p.textContent = 'No hay instrumentos que coincidan con esa búsqueda.';
    grid.appendChild(p);
    return;
  }
  lista.forEach(def => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'instr-card' + (def.id === estado.id ? ' instr-card--activa' : '');
    const lienzo = document.createElement('div');
    lienzo.className = 'instr-card__lienzo';
    // miniatura: los valores de fábrica, sin el cartel de la lectura
    const mini = normalizarParams(def.id, Object.assign(paramsPorDefecto(def.id), { mostrarValor: false, escala: 1 }));
    const svg = dibujarInstrumento(def.id, mini);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    lienzo.appendChild(svg);
    card.appendChild(lienzo);
    const nom = document.createElement('span');
    nom.className = 'instr-card__nombre';
    nom.textContent = def.icono + ' ' + def.nombre;
    card.appendChild(nom);
    const cat = document.createElement('span');
    cat.className = 'instr-card__cat';
    cat.textContent = def.categoria;
    card.appendChild(cat);
    const desc = document.createElement('span');
    desc.className = 'instr-card__desc';
    desc.textContent = def.resumen;
    card.appendChild(desc);
    card.addEventListener('click', () => {
      estado.id = def.id;
      estado.params = paramsPorDefecto(def.id);
      pintarCatalogo();
      pintarTaller();
      $('seccionTaller').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    grid.appendChild(card);
  });
}

// ============================================================
// Configurador
// ============================================================
function campoParametro(par) {
  const def = instrumentoPorId(estado.id);
  const valor = estado.params[par.clave];
  const cont = document.createElement('div');
  cont.className = 'instr-param' + (par.tipo === 'bool' ? ' instr-param--check' : '');
  const idCampo = 'par_' + par.clave;

  let control;
  if (par.tipo === 'bool') {
    control = document.createElement('input');
    control.type = 'checkbox';
    control.checked = !!valor;
  } else if (par.tipo === 'opcion') {
    control = document.createElement('select');
    par.opciones.forEach(o => {
      const op = document.createElement('option');
      op.value = o.v;
      op.textContent = o.t;
      if (String(o.v) === String(valor)) op.selected = true;
      control.appendChild(op);
    });
  } else if (par.tipo === 'color') {
    control = document.createElement('input');
    control.type = 'color';
    control.value = valor || '#3aa3d8';
  } else if (par.tipo === 'numero') {
    control = document.createElement('input');
    control.type = 'number';
    control.step = par.paso || 'any';
    if (par.min != null) control.min = par.min;
    if (par.max != null) control.max = par.max;
    control.value = valor;
  } else {
    control = document.createElement('input');
    control.type = 'text';
    control.value = valor == null ? '' : valor;
  }
  control.id = idCampo;

  const etiqueta = document.createElement('label');
  etiqueta.className = 'instr-param__etiqueta';
  etiqueta.setAttribute('for', idCampo);
  etiqueta.textContent = par.etiqueta;

  if (par.tipo === 'bool') {
    cont.appendChild(control);
    cont.appendChild(etiqueta);
  } else {
    cont.appendChild(etiqueta);
    cont.appendChild(control);
  }
  if (par.ayuda) {
    const ay = document.createElement('p');
    ay.className = 'instr-param__ayuda';
    ay.textContent = par.ayuda;
    cont.appendChild(ay);
  }

  const aplicar = () => {
    let v;
    if (par.tipo === 'bool') v = control.checked;
    else if (par.tipo === 'numero') v = Number(String(control.value).replace(',', '.'));
    else v = control.value;
    estado.params[par.clave] = v;
    estado.params = normalizarParams(estado.id, estado.params);
    dibujar();
  };
  control.addEventListener('input', aplicar);
  control.addEventListener('change', aplicar);
  if (def) { /* nada más: el redibujo va por evento */ }
  return cont;
}

function pintarTaller() {
  const def = instrumentoPorId(estado.id);
  if (!def) return;
  $('tallerNombre').textContent = def.icono + ' ' + def.nombre;
  $('tallerResumen').textContent = def.resumen;
  const form = $('formParams');
  form.innerHTML = '';
  def.params.forEach(par => form.appendChild(campoParametro(par)));
  dibujar();
}

function dibujar() {
  const def = instrumentoPorId(estado.id);
  if (!def) return;
  const vista = $('vistaInstrumento');
  vista.innerHTML = '';
  vista.appendChild(dibujarInstrumento(estado.id, estado.params));

  const u = unidadDe(estado.id, estado.params);
  const apr = apreciacionDe(estado.id, estado.params);
  const inc = incertidumbreDe(estado.id, estado.params);
  const dec = decimalesDe(apr || 1);
  const ficha = $('fichaTecnica');
  ficha.innerHTML = '';
  const p1 = document.createElement('p');
  p1.style.margin = '0 0 0.4rem';
  p1.innerHTML = `<strong>${def.nombre}</strong> — ${fichaTecnica(estado.id, estado.params) || 'sin escala graduada'}.` +
    (apr ? ` Una medida se anota como <strong>valor ± ${fmt(inc, Math.max(dec, decimalesDe(inc)))} ${u}</strong>.` : '');
  ficha.appendChild(p1);
  const p2 = document.createElement('p');
  p2.style.margin = '0';
  p2.innerHTML = 'Línea para el protocolo: <code>' + instrumentoATexto(estado.id, estado.params) + '</code>';
  ficha.appendChild(p2);

  $('comoSeLee').innerHTML = '<strong>Cómo se lee:</strong> ' + def.comoSeLee;
}

// ============================================================
// Hoja de ejercicios
// ============================================================
function pintarSelectorEjercicios() {
  const cont = $('selectorEjercicios');
  cont.innerHTML = '';
  catalogoInstrumentos().forEach(def => {
    const lab = document.createElement('label');
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.value = def.id;
    chk.checked = ['regla', 'probeta', 'termometro', 'dinamometro'].indexOf(def.id) >= 0;
    lab.appendChild(chk);
    lab.appendChild(document.createTextNode(def.icono + ' ' + def.nombre));
    cont.appendChild(lab);
  });
}

function generarEjercicios() {
  const elegidos = Array.from($('selectorEjercicios').querySelectorAll('input:checked')).map(c => c.value);
  const nota = $('notaEjercicios');
  if (!elegidos.length) {
    nota.style.display = 'inline';
    nota.textContent = 'Marcá al menos un instrumento.';
    return;
  }
  nota.style.display = 'none';
  const repetir = Math.max(1, Math.min(4, Number($('ejerRepetir').value) || 1));
  const items = [];
  elegidos.forEach(id => {
    for (let i = 0; i < repetir; i++) {
      const params = paramsPorDefecto(id);
      params.lectura = lecturaAlAzar(id, params);
      // En los ejercicios no se regala la respuesta: ni el número ni la línea
      // de medición (que de fábrica ya viene apagada).
      params.mostrarValor = false;
      if ('marcarLectura' in params) params.marcarLectura = false;
      items.push({ id, params: normalizarParams(id, params) });
    }
  });
  // barajado simple para que no queden agrupados por instrumento
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = items[i]; items[i] = items[j]; items[j] = t;
  }
  estado.ejercicios = items;
  pintarEjercicios();
}

function pintarEjercicios() {
  const cont = $('vistaEjercicios');
  cont.innerHTML = '';
  if (!estado.ejercicios.length) return;
  const pedirInc = $('ejerIncertidumbre').checked;
  const conClave = $('ejerClave').checked;
  const conPista = $('ejerPista').checked;

  const hoja = document.createElement('div');
  hoja.className = 'ejer-hoja';

  const cab = document.createElement('header');
  cab.className = 'ejer-hoja__cab';
  const h1 = document.createElement('h1');
  h1.className = 'ejer-hoja__titulo';
  h1.textContent = 'Lectura de instrumentos';
  cab.appendChild(h1);
  const datos = document.createElement('div');
  datos.className = 'ejer-hoja__datos';
  ['Nombre:', 'Grupo:', 'Fecha:'].forEach(t => {
    const s = document.createElement('span');
    s.textContent = t;
    datos.appendChild(s);
  });
  cab.appendChild(datos);
  hoja.appendChild(cab);

  const consigna = document.createElement('p');
  consigna.className = 'ejer-hoja__consigna';
  consigna.innerHTML = '<strong>Consigna:</strong> escribí la medida que marca cada instrumento, con la unidad que corresponde y todas las cifras que el instrumento permite leer' +
    (pedirInc ? ', e indicá la incertidumbre de esa medida.' : '.');
  hoja.appendChild(consigna);

  const clave = [];
  estado.ejercicios.forEach((it, i) => {
    const def = instrumentoPorId(it.id);
    const u = unidadDe(it.id, it.params);
    const apr = apreciacionDe(it.id, it.params);
    const inc = incertidumbreDe(it.id, it.params);
    // El valor se escribe con las cifras que da el instrumento y la
    // incertidumbre con las suyas: 23 mL ± 0,5 mL, no 23,0 mL ± 0,5 mL.
    const decValor = decimalesDe(apr || 1);
    const decInc = decimalesDe(inc || 1);

    const item = document.createElement('div');
    item.className = 'ejer-item';
    const izq = document.createElement('div');
    const num = document.createElement('div');
    num.className = 'ejer-item__num';
    num.textContent = (i + 1) + '. ' + def.nombre;
    izq.appendChild(num);
    const preg = document.createElement('p');
    preg.className = 'ejer-item__pregunta';
    preg.textContent = '¿Qué valor está midiendo?';
    izq.appendChild(preg);
    const l1 = document.createElement('div');
    l1.className = 'ejer-item__linea';
    izq.appendChild(l1);
    if (pedirInc) {
      const p2 = document.createElement('p');
      p2.className = 'ejer-item__pregunta';
      p2.textContent = 'Incertidumbre de la medida:';
      izq.appendChild(p2);
      const l2 = document.createElement('div');
      l2.className = 'ejer-item__linea';
      izq.appendChild(l2);
    }
    if (conPista && apr) {
      const pista = document.createElement('p');
      pista.className = 'ejer-item__pista';
      pista.textContent = 'apreciación: ' + fmt(apr, decValor) + ' ' + u;
      izq.appendChild(pista);
    }
    item.appendChild(izq);

    const der = document.createElement('div');
    der.className = 'ejer-item__dibujo';
    const svg = dibujarInstrumento(it.id, it.params);
    der.appendChild(svg);
    item.appendChild(der);
    // Los instrumentos apaisados (calibre, micrómetro, regla…) no entran
    // legibles en una columna angosta: se les da el ancho de la hoja.
    const caja = (svg.getAttribute('viewBox') || '').split(/\s+/);
    if (Number(caja[2]) / Number(caja[3]) > 1.7) item.classList.add('ejer-item--ancho');
    hoja.appendChild(item);

    clave.push(fmt(it.params.lectura, decValor) + ' ' + u + (inc ? ' ± ' + fmt(inc, decInc) + ' ' + u : ''));
  });

  if (conClave) {
    const caja = document.createElement('div');
    caja.className = 'ejer-clave';
    const h3 = document.createElement('h3');
    h3.textContent = '🔑 Clave de corrección (recortar antes de repartir)';
    caja.appendChild(h3);
    const ol = document.createElement('ol');
    clave.forEach(c => {
      const li = document.createElement('li');
      li.textContent = c;
      ol.appendChild(li);
    });
    caja.appendChild(ol);
    hoja.appendChild(caja);
  }

  cont.appendChild(hoja);
}

// ============================================================
// Descargas
// ============================================================
function descargarSVG() {
  const def = instrumentoPorId(estado.id);
  const svg = dibujarInstrumento(estado.id, estado.params);
  descargar(nombreArchivo(def.nombre, 'svg'), svgATexto(svg), 'image/svg+xml;charset=utf-8');
  toast('SVG descargado');
}

async function descargarPNG() {
  const def = instrumentoPorId(estado.id);
  const svg = dibujarInstrumento(estado.id, estado.params);
  try {
    const url = await svgAPNG(svg, 2);
    const bin = atob(url.split(',')[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    descargar(nombreArchivo(def.nombre, 'png'), new Blob([bytes], { type: 'image/png' }));
    toast('PNG descargado');
  } catch (e) {
    toast('No se pudo generar el PNG');
  }
}

async function copiarCodigo() {
  const linea = instrumentoATexto(estado.id, estado.params);
  try {
    await navigator.clipboard.writeText(linea);
    toast('Línea copiada: pegala en el protocolo');
  } catch (e) {
    window.prompt('Copiá esta línea y pegala en el generador de protocolos:', linea);
  }
}

function imprimirEjercicios() {
  if (!estado.ejercicios.length) generarEjercicios();
  const hoja = $('vistaEjercicios').firstElementChild;
  if (!hoja) return;
  const area = $('areaImpresion');
  area.innerHTML = '';
  area.appendChild(hoja.cloneNode(true));
  window.print();
}

// ============================================================
// Arranque
// ============================================================
function init() {
  pintarFiltros();
  pintarCatalogo();
  pintarTaller();
  pintarSelectorEjercicios();

  $('btnAzar').addEventListener('click', () => {
    estado.params.lectura = lecturaAlAzar(estado.id, estado.params);
    estado.params = normalizarParams(estado.id, estado.params);
    pintarTaller();
  });
  $('btnReset').addEventListener('click', () => {
    estado.params = paramsPorDefecto(estado.id);
    pintarTaller();
  });
  $('btnSVG').addEventListener('click', descargarSVG);
  $('btnPNG').addEventListener('click', descargarPNG);
  $('btnCopiarCodigo').addEventListener('click', copiarCodigo);
  $('btnGenerarEjercicios').addEventListener('click', generarEjercicios);
  $('btnImprimirEjercicios').addEventListener('click', imprimirEjercicios);
  ['ejerIncertidumbre', 'ejerClave', 'ejerPista'].forEach(id => {
    $(id).addEventListener('change', () => { if (estado.ejercicios.length) pintarEjercicios(); });
  });

  // Si se llega con ?instrumento=probeta, se abre directo ese.
  const q = new URLSearchParams(location.search).get('instrumento');
  if (q && instrumentoPorId(q)) {
    estado.id = q;
    estado.params = paramsPorDefecto(q);
    pintarCatalogo();
    pintarTaller();
  }
}

init();
