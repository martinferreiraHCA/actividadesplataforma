// protocolos.js — El generador de protocolos de práctico.
//
// Mantiene un objeto «protocolo» en memoria (y en localStorage), lo edita con
// los formularios de la izquierda y lo dibuja como documento imprimible a la
// derecha. La versión de estudiante deja los espacios en blanco; la de docente
// muestra todo.

import {
  catalogoInstrumentos, instrumentoPorId, paramsPorDefecto, normalizarParams,
  dibujarInstrumento, fichaTecnica, apreciacionDe, incertidumbreDe, unidadDe,
  instrumentoATexto, textoAInstrumento, decimalesDe, fmt
} from './instrumentos.js';

import {
  protocoloVacio, normalizarProtocolo, protocoloATexto, parsearProtocolo,
  pareceProtocolo, promptProtocolo
} from './protocolos-texto.js';

import { EJEMPLOS } from './protocolos-ejemplos.js';

const $ = id => document.getElementById(id);
const CLAVE_GUARDADO = 'protocolo-practico-borrador';

const estado = {
  p: protocoloVacio(),
  version: 'estudiante'
};

// ============================================================
// Utilidades
// ============================================================
function el(tag, clase, texto) {
  const n = document.createElement(tag);
  if (clase) n.className = clase;
  if (texto != null) n.textContent = texto;
  return n;
}

function toast(msg) {
  const t = $('toast');
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

function nombreBase() {
  const t = estado.p.meta.titulo || 'protocolo';
  return t.replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 70);
}

function guardar() {
  try { localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(estado.p)); } catch (e) { /* sin espacio: se sigue igual */ }
}

function cargarGuardado() {
  try {
    const txt = localStorage.getItem(CLAVE_GUARDADO);
    if (txt) return normalizarProtocolo(JSON.parse(txt));
  } catch (e) { /* borrador corrupto: se ignora */ }
  return null;
}

// Cambió algo: se guarda, se redibuja la vista y se revisa qué falta.
function cambio() {
  guardar();
  pintarVista();
  pintarRevision();
}

// ============================================================
// Editores de lista genéricos
// ============================================================

// Lista de textos sueltos (objetivos, seguridad, preguntas).
function listaDeTextos(contenedorId, arr, marcador, etiquetaAgregar) {
  const cont = $(contenedorId);
  cont.innerHTML = '';
  arr.forEach((valor, i) => {
    const fila = el('div', 'proto-fila');
    fila.appendChild(el('span', 'proto-fila__num', String(i + 1)));
    const ta = el('textarea', 'campo__textarea proto-fila__texto');
    ta.rows = 2;
    ta.value = valor;
    ta.placeholder = marcador;
    ta.addEventListener('input', () => { arr[i] = ta.value; cambio(); });
    fila.appendChild(ta);
    fila.appendChild(botonesFila(arr, i, () => listaDeTextos(contenedorId, arr, marcador, etiquetaAgregar)));
    cont.appendChild(fila);
  });
  const b = el('button', 'btn btn--ghost proto-agregar', etiquetaAgregar);
  b.type = 'button';
  b.addEventListener('click', () => {
    arr.push('');
    listaDeTextos(contenedorId, arr, marcador, etiquetaAgregar);
    cambio();
    const tas = cont.querySelectorAll('textarea');
    if (tas.length) tas[tas.length - 1].focus();
  });
  cont.appendChild(b);
}

// Los tres botoncitos de cada fila: subir, bajar y borrar.
function botonesFila(arr, i, repintar) {
  const caja = el('div', 'proto-fila__acciones');
  const boton = (txt, titulo, accion, deshabilitado) => {
    const b = el('button', 'proto-mini', txt);
    b.type = 'button';
    b.title = titulo;
    b.disabled = !!deshabilitado;
    b.addEventListener('click', () => { accion(); repintar(); cambio(); });
    return b;
  };
  caja.appendChild(boton('↑', 'Subir', () => { const t = arr[i - 1]; arr[i - 1] = arr[i]; arr[i] = t; }, i === 0));
  caja.appendChild(boton('↓', 'Bajar', () => { const t = arr[i + 1]; arr[i + 1] = arr[i]; arr[i] = t; }, i === arr.length - 1));
  caja.appendChild(boton('✕', 'Borrar', () => { arr.splice(i, 1); }));
  return caja;
}

function campoTexto(etiqueta, valor, marcador, alCambiar, ancho) {
  const c = el('label', 'proto-campito');
  c.appendChild(el('span', 'proto-campito__label', etiqueta));
  const i = el('input', 'campo__input');
  i.type = 'text';
  i.value = valor || '';
  i.placeholder = marcador || '';
  if (ancho) c.style.flex = ancho;
  i.addEventListener('input', () => { alCambiar(i.value); cambio(); });
  c.appendChild(i);
  return c;
}

// ---- materiales ----
function pintarMateriales() {
  const arr = estado.p.materiales;
  const cont = $('listaMateriales');
  cont.innerHTML = '';
  arr.forEach((m, i) => {
    const fila = el('div', 'proto-fila proto-fila--campos');
    fila.appendChild(campoTexto('Cantidad', m.cantidad, '1', v => m.cantidad = v, '0 0 90px'));
    fila.appendChild(campoTexto('Material', m.nombre, 'probeta de 100 mL', v => m.nombre = v, '2 1 200px'));
    fila.appendChild(campoTexto('Aclaración', m.detalle, 'opcional', v => m.detalle = v, '2 1 200px'));
    fila.appendChild(botonesFila(arr, i, pintarMateriales));
    cont.appendChild(fila);
  });
  const b = el('button', 'btn btn--ghost proto-agregar', '+ Agregar material');
  b.type = 'button';
  b.addEventListener('click', () => { arr.push({ cantidad: '', nombre: '', detalle: '' }); pintarMateriales(); cambio(); });
  cont.appendChild(b);
}

// ---- instrumentos ----
function pintarSelectorInstrumentos() {
  const sel = $('selectorInstrumento');
  sel.innerHTML = '';
  catalogoInstrumentos().forEach(def => {
    const o = el('option', null, def.icono + ' ' + def.nombre);
    o.value = def.id;
    sel.appendChild(o);
  });
}

function pintarInstrumentos() {
  const arr = estado.p.instrumentos;
  const cont = $('listaInstrumentos');
  cont.innerHTML = '';
  if (!arr.length) {
    cont.appendChild(el('p', 'proto-ayuda', 'Todavía no agregaste ninguno. Elegí uno de la lista de arriba y tocá «Agregar».'));
  }
  arr.forEach((it, i) => {
    const def = instrumentoPorId(it.id);
    if (!def) return;
    const caja = el('div', 'proto-instr');

    const cab = el('div', 'proto-instr__cab');
    cab.appendChild(el('span', 'proto-instr__nombre', def.icono + ' ' + def.nombre));
    cab.appendChild(botonesFila(arr, i, pintarInstrumentos));
    caja.appendChild(cab);

    const cuerpo = el('div', 'proto-instr__cuerpo');
    const mini = el('div', 'proto-instr__mini');
    mini.appendChild(dibujarInstrumento(it.id, it.params));
    cuerpo.appendChild(mini);

    const campos = el('div', 'proto-instr__campos');
    // Se editan acá los parámetros que definen la escala; el resto queda como
    // vino del banco (donde se configura con más detalle).
    def.params.filter(par => ['min', 'max', 'division', 'numerarCada', 'unidad', 'lectura'].indexOf(par.clave) >= 0)
      .forEach(par => {
        const c = el('label', 'proto-campito');
        c.appendChild(el('span', 'proto-campito__label', par.etiqueta));
        const inp = el('input', 'campo__input');
        inp.type = par.tipo === 'numero' ? 'number' : 'text';
        if (par.tipo === 'numero') inp.step = 'any';
        inp.value = it.params[par.clave];
        inp.addEventListener('input', () => {
          it.params[par.clave] = par.tipo === 'numero' ? Number(String(inp.value).replace(',', '.')) : inp.value;
          it.params = normalizarParams(it.id, it.params);
          mini.innerHTML = '';
          mini.appendChild(dibujarInstrumento(it.id, it.params));
          ficha.textContent = fichaTecnica(it.id, it.params);
          cambio();
        });
        c.appendChild(inp);
        campos.appendChild(c);
      });
    campos.appendChild(campoTexto('Para qué se usa', it.nota, 'para medir el volumen por desplazamiento', v => it.nota = v, '1 1 100%'));
    cuerpo.appendChild(campos);
    caja.appendChild(cuerpo);

    const ficha = el('p', 'proto-instr__ficha', fichaTecnica(it.id, it.params));
    caja.appendChild(ficha);

    const linea = el('div', 'proto-instr__linea');
    const codigo = el('code', null, instrumentoATexto(it.id, it.params));
    linea.appendChild(codigo);
    const bAjustar = el('button', 'proto-mini proto-mini--ancho', 'Ajustar en el banco ↗');
    bAjustar.type = 'button';
    bAjustar.addEventListener('click', () => window.open('instrumentos.html?instrumento=' + it.id, '_blank'));
    linea.appendChild(bAjustar);
    caja.appendChild(linea);

    cont.appendChild(caja);
  });

  const pegar = el('div', 'proto-pegar');
  const inp = el('input', 'campo__input');
  inp.type = 'text';
  inp.placeholder = 'O pegá acá una línea del banco: probeta :: max=250, division=2…';
  const bp = el('button', 'btn btn--ghost', 'Pegar');
  bp.type = 'button';
  bp.addEventListener('click', () => {
    const r = textoAInstrumento(inp.value);
    if (!r) { toast('No reconocí ese instrumento'); return; }
    arr.push({ id: r.id, params: r.params, nota: '' });
    inp.value = '';
    pintarInstrumentos();
    cambio();
  });
  pegar.appendChild(inp);
  pegar.appendChild(bp);
  cont.appendChild(pegar);
}

// ---- procedimiento ----
function pintarProcedimiento() {
  const arr = estado.p.procedimiento;
  const cont = $('listaProcedimiento');
  cont.innerHTML = '';
  arr.forEach((s, i) => {
    const caja = el('div', 'proto-paso');
    const cab = el('div', 'proto-paso__cab');
    cab.appendChild(el('span', 'proto-fila__num', 'Paso ' + (i + 1)));
    cab.appendChild(botonesFila(arr, i, pintarProcedimiento));
    caja.appendChild(cab);

    caja.appendChild(campoTexto('Título corto', s.titulo, 'Medir la masa', v => s.titulo = v, '1 1 100%'));

    const ta = el('textarea', 'campo__textarea');
    ta.rows = 3;
    ta.value = s.texto;
    ta.placeholder = 'Qué hay que hacer exactamente, en imperativo: «Apoyá el cuerpo en el plato, esperá a que…»';
    ta.addEventListener('input', () => { s.texto = ta.value; cambio(); });
    caja.appendChild(ta);

    const abajo = el('div', 'proto-paso__abajo');
    const lab = el('label', 'proto-campito');
    lab.appendChild(el('span', 'proto-campito__label', 'Instrumento que se usa en este paso'));
    const sel = el('select', 'campo__input');
    const nada = el('option', null, '— ninguno —');
    nada.value = '';
    sel.appendChild(nada);
    estado.p.instrumentos.forEach((it, k) => {
      const def = instrumentoPorId(it.id);
      const o = el('option', null, def ? def.icono + ' ' + def.nombre : it.id);
      o.value = String(k);
      if (String(k) === s.instrumento) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => { s.instrumento = sel.value; cambio(); });
    lab.appendChild(sel);
    abajo.appendChild(lab);
    abajo.appendChild(campoTexto('Nota al margen (opcional)', s.nota, 'Ojo: no toques el bulbo con los dedos', v => s.nota = v, '1 1 240px'));
    caja.appendChild(abajo);

    cont.appendChild(caja);
  });
  const b = el('button', 'btn btn--ghost proto-agregar', '+ Agregar paso');
  b.type = 'button';
  b.addEventListener('click', () => { arr.push({ titulo: '', texto: '', instrumento: '', nota: '' }); pintarProcedimiento(); cambio(); });
  cont.appendChild(b);
}

// ---- tablas de datos ----
function pintarTablas() {
  const arr = estado.p.tablas;
  const cont = $('listaTablas');
  cont.innerHTML = '';
  arr.forEach((t, i) => {
    const caja = el('div', 'proto-tabla-ed');
    const cab = el('div', 'proto-paso__cab');
    cab.appendChild(el('span', 'proto-fila__num', 'Tabla ' + (i + 1)));
    cab.appendChild(botonesFila(arr, i, pintarTablas));
    caja.appendChild(cab);

    caja.appendChild(campoTexto('Título de la tabla', t.titulo, 'Masa y volumen de cada cuerpo', v => t.titulo = v, '1 1 100%'));

    const cols = el('div', 'proto-cols');
    t.columnas.forEach((c, k) => {
      const fila = el('div', 'proto-fila proto-fila--campos');
      fila.appendChild(campoTexto('Columna', c.nombre, 'm', v => c.nombre = v, '2 1 150px'));
      fila.appendChild(campoTexto('Unidad', c.unidad, 'g', v => c.unidad = v, '1 1 90px'));
      fila.appendChild(campoTexto('± incert.', c.incertidumbre, '0,1', v => c.incertidumbre = v, '1 1 90px'));
      fila.appendChild(botonesFila(t.columnas, k, pintarTablas));
      cols.appendChild(fila);
    });
    caja.appendChild(cols);

    const acciones = el('div', 'proto-paso__abajo');
    const bc = el('button', 'btn btn--ghost proto-agregar', '+ Columna');
    bc.type = 'button';
    bc.addEventListener('click', () => { t.columnas.push({ nombre: '', unidad: '', incertidumbre: '' }); pintarTablas(); cambio(); });
    acciones.appendChild(bc);

    const lab = el('label', 'proto-campito');
    lab.appendChild(el('span', 'proto-campito__label', 'Filas en blanco'));
    const inp = el('input', 'campo__input');
    inp.type = 'number';
    inp.min = 1; inp.max = 40;
    inp.value = t.filas;
    inp.addEventListener('input', () => { t.filas = Math.max(1, Math.min(40, Number(inp.value) || 1)); cambio(); });
    lab.appendChild(inp);
    lab.style.flex = '0 0 130px';
    acciones.appendChild(lab);
    caja.appendChild(acciones);

    cont.appendChild(caja);
  });
  const b = el('button', 'btn btn--ghost proto-agregar', '+ Agregar tabla de datos');
  b.type = 'button';
  b.addEventListener('click', () => {
    arr.push({ titulo: '', filas: 5, columnas: [{ nombre: 'Ensayo', unidad: '', incertidumbre: '' }, { nombre: '', unidad: '', incertidumbre: '' }] });
    pintarTablas();
    cambio();
  });
  cont.appendChild(b);
}

// ---- cálculos ----
function pintarCalculos() {
  const arr = estado.p.calculos;
  const cont = $('listaCalculos');
  cont.innerHTML = '';
  arr.forEach((c, i) => {
    const caja = el('div', 'proto-tabla-ed');
    const cab = el('div', 'proto-paso__cab');
    cab.appendChild(el('span', 'proto-fila__num', 'Cálculo ' + (i + 1)));
    cab.appendChild(botonesFila(arr, i, pintarCalculos));
    caja.appendChild(cab);
    const fila = el('div', 'proto-fila proto-fila--campos');
    fila.appendChild(campoTexto('Qué se calcula', c.nombre, 'Densidad', v => c.nombre = v, '2 1 160px'));
    fila.appendChild(campoTexto('Fórmula', c.formula, 'd = m / V', v => c.formula = v, '2 1 160px'));
    fila.appendChild(campoTexto('Unidad', c.unidad, 'g/mL', v => c.unidad = v, '1 1 90px'));
    caja.appendChild(fila);
    const ta = el('textarea', 'campo__textarea');
    ta.rows = 2;
    ta.value = c.descripcion;
    ta.placeholder = 'Con qué datos de la tabla se calcula y qué hay que tener en cuenta.';
    ta.addEventListener('input', () => { c.descripcion = ta.value; cambio(); });
    caja.appendChild(ta);
    cont.appendChild(caja);
  });
  const b = el('button', 'btn btn--ghost proto-agregar', '+ Agregar cálculo');
  b.type = 'button';
  b.addEventListener('click', () => { arr.push({ nombre: '', formula: '', unidad: '', descripcion: '' }); pintarCalculos(); cambio(); });
  cont.appendChild(b);
}

// ============================================================
// El documento
// ============================================================
function seccion(doc, numero, titulo) {
  const s = el('section', 'pro-seccion');
  const h = el('h2', 'pro-seccion__titulo');
  h.appendChild(el('span', 'pro-seccion__num', numero));
  h.appendChild(document.createTextNode(titulo));
  s.appendChild(h);
  doc.appendChild(s);
  return s;
}

function parrafos(cont, texto) {
  String(texto).split(/\n{2,}/).forEach(p => {
    const t = p.trim();
    if (t) cont.appendChild(el('p', 'pro-parrafo', t));
  });
}

function renglones(cont, cuantos) {
  for (let i = 0; i < cuantos; i++) cont.appendChild(el('div', 'pro-renglon'));
}

function construirDocumento() {
  const p = estado.p;
  const paraEstudiante = estado.version === 'estudiante';
  const doc = el('article', 'pro-doc' + (paraEstudiante ? ' pro-doc--estudiante' : ' pro-doc--docente'));
  let n = 0;
  const num = () => String(++n).padStart(2, '0');

  // ---- portada ----
  const port = el('header', 'pro-portada');
  const tira = el('div', 'pro-portada__tira');
  tira.appendChild(el('span', 'pro-portada__tipo', 'Protocolo de práctico'));
  if (!paraEstudiante) tira.appendChild(el('span', 'pro-portada__sello', 'Versión del docente'));
  port.appendChild(tira);
  port.appendChild(el('h1', 'pro-portada__titulo', p.meta.titulo || 'Práctico sin título'));

  const datos = el('div', 'pro-portada__datos');
  const dato = (k, v) => {
    if (!v) return;
    const d = el('span', 'pro-dato');
    d.appendChild(el('strong', null, k + ': '));
    d.appendChild(document.createTextNode(v));
    datos.appendChild(d);
  };
  dato('Asignatura', p.meta.asignatura);
  dato('Nivel', p.meta.nivel);
  dato('Duración', p.meta.duracion);
  dato('Docente', p.meta.docente);
  dato('Grupo', p.meta.grupo);
  dato('Fecha', p.meta.fecha);
  if (datos.childNodes.length) port.appendChild(datos);

  if (paraEstudiante) {
    const equipo = el('div', 'pro-equipo');
    ['Integrantes del equipo', 'Grupo', 'Fecha'].forEach((t, i) => {
      const c = el('div', 'pro-equipo__campo' + (i === 0 ? ' pro-equipo__campo--ancho' : ''));
      c.appendChild(el('span', 'pro-equipo__label', t));
      c.appendChild(el('div', 'pro-equipo__linea'));
      equipo.appendChild(c);
    });
    port.appendChild(equipo);
  }
  doc.appendChild(port);

  // ---- fundamento ----
  if (p.fundamento.trim()) {
    const s = seccion(doc, num(), 'Fundamento teórico');
    parrafos(s, p.fundamento);
  }

  // ---- objetivos ----
  const objetivos = p.objetivos.filter(o => o.trim());
  if (objetivos.length) {
    const s = seccion(doc, num(), 'Objetivos');
    const ul = el('ul', 'pro-lista');
    objetivos.forEach(o => ul.appendChild(el('li', null, o)));
    s.appendChild(ul);
  }

  // ---- materiales e instrumentos ----
  const materiales = p.materiales.filter(m => m.nombre.trim());
  if (materiales.length || p.instrumentos.length) {
    const s = seccion(doc, num(), 'Materiales e instrumentos');
    if (materiales.length) {
      const ul = el('ul', 'pro-lista pro-lista--materiales');
      materiales.forEach(m => {
        const li = el('li');
        if (m.cantidad) li.appendChild(el('strong', 'pro-cant', m.cantidad + ' '));
        li.appendChild(document.createTextNode(m.nombre));
        if (m.detalle) li.appendChild(el('span', 'pro-detalle', ' — ' + m.detalle));
        ul.appendChild(li);
      });
      s.appendChild(ul);
    }
    if (p.instrumentos.length) {
      const galeria = el('div', 'pro-instrumentos');
      p.instrumentos.forEach(it => {
        const def = instrumentoPorId(it.id);
        if (!def) return;
        const fig = el('figure', 'pro-instrumento');
        const marco = el('div', 'pro-instrumento__dibujo');
        // En la versión del estudiante el instrumento se muestra sin el número:
        // parte del trabajo es leer la escala.
        const params = Object.assign({}, it.params);
        if (paraEstudiante && 'mostrarValor' in params) params.mostrarValor = false;
        marco.appendChild(dibujarInstrumento(it.id, params));
        fig.appendChild(marco);
        const cap = el('figcaption', 'pro-instrumento__pie');
        cap.appendChild(el('strong', null, def.nombre));
        const t = fichaTecnica(it.id, it.params);
        if (t) cap.appendChild(el('span', 'pro-instrumento__ficha', t));
        if (it.nota) cap.appendChild(el('span', 'pro-instrumento__nota', it.nota));
        const inc = incertidumbreDe(it.id, it.params);
        if (inc) cap.appendChild(el('span', 'pro-instrumento__inc',
          'Toda medida con este instrumento se anota como valor ± ' + fmt(inc, decimalesDe(inc)) + ' ' + unidadDe(it.id, it.params)));
        if (!paraEstudiante) cap.appendChild(el('span', 'pro-instrumento__comolee', 'Cómo se lee: ' + def.comoSeLee));
        fig.appendChild(cap);
        galeria.appendChild(fig);
      });
      s.appendChild(galeria);
    }
  }

  // ---- seguridad ----
  const seguridad = p.seguridad.filter(x => x.trim());
  if (seguridad.length) {
    const s = seccion(doc, num(), 'Normas de seguridad');
    const caja = el('div', 'pro-seguridad');
    const ul = el('ul', 'pro-lista');
    seguridad.forEach(x => ul.appendChild(el('li', null, x)));
    caja.appendChild(ul);
    s.appendChild(caja);
  }

  // ---- montaje ----
  if (p.montaje.texto.trim() || p.montaje.imagen) {
    const s = seccion(doc, num(), 'Montaje experimental');
    if (p.montaje.texto.trim()) parrafos(s, p.montaje.texto);
    if (p.montaje.imagen) {
      const fig = el('figure', 'pro-montaje');
      const img = el('img');
      img.src = p.montaje.imagen;
      img.alt = 'Esquema del montaje experimental';
      fig.appendChild(img);
      s.appendChild(fig);
    }
  }

  // ---- procedimiento ----
  const pasos = p.procedimiento.filter(x => x.texto.trim() || x.titulo.trim());
  if (pasos.length) {
    const s = seccion(doc, num(), 'Procedimiento');
    const ol = el('ol', 'pro-pasos');
    pasos.forEach(x => {
      // El <li> queda como list-item para que se vea el número; adentro va un
      // envoltorio flex con el texto y, si corresponde, el instrumento.
      const li = el('li', 'pro-paso-doc');
      const fila = el('div', 'pro-paso-doc__fila');
      const cuerpo = el('div', 'pro-paso-doc__texto');
      if (x.titulo) cuerpo.appendChild(el('strong', 'pro-paso-doc__titulo', x.titulo));
      if (x.texto) cuerpo.appendChild(el('span', null, x.texto));
      if (x.nota) cuerpo.appendChild(el('span', 'pro-paso-doc__nota', '⚠ ' + x.nota));
      fila.appendChild(cuerpo);
      const it = p.instrumentos[Number(x.instrumento)];
      if (x.instrumento !== '' && it) {
        const mini = el('div', 'pro-paso-doc__instr');
        const params = Object.assign({}, it.params);
        if (paraEstudiante && 'mostrarValor' in params) params.mostrarValor = false;
        mini.appendChild(dibujarInstrumento(it.id, params));
        fila.appendChild(mini);
      }
      li.appendChild(fila);
      ol.appendChild(li);
    });
    s.appendChild(ol);
  }

  // ---- tablas de datos ----
  const tablas = p.tablas.filter(t => t.columnas.some(c => c.nombre.trim()));
  if (tablas.length) {
    const s = seccion(doc, num(), 'Toma y registro de datos');
    s.appendChild(el('p', 'pro-parrafo pro-parrafo--nota',
      'Completá las tablas a medida que vas midiendo, con lápiz y sin borrar los datos que parezcan raros: se anotan igual y se discuten después.'));
    tablas.forEach(t => {
      const caja = el('div', 'pro-tabla-caja');
      if (t.titulo) caja.appendChild(el('h3', 'pro-tabla__titulo', t.titulo));
      const tabla = el('table', 'pro-tabla');
      const thead = el('thead');
      const tr = el('tr');
      t.columnas.forEach(c => {
        const th = el('th');
        th.appendChild(el('span', 'pro-th__nombre', c.nombre));
        const sub = [];
        if (c.unidad) sub.push('(' + c.unidad + ')');
        if (c.incertidumbre) sub.push('± ' + c.incertidumbre);
        if (sub.length) th.appendChild(el('span', 'pro-th__unidad', sub.join(' ')));
        tr.appendChild(th);
      });
      thead.appendChild(tr);
      tabla.appendChild(thead);
      const tbody = el('tbody');
      for (let f = 0; f < t.filas; f++) {
        const fila = el('tr');
        t.columnas.forEach(() => fila.appendChild(el('td', null, '')));
        tbody.appendChild(fila);
      }
      tabla.appendChild(tbody);
      caja.appendChild(tabla);
      s.appendChild(caja);
    });
  }

  // ---- cálculos ----
  const calculos = p.calculos.filter(c => c.nombre.trim() || c.formula.trim());
  if (calculos.length) {
    const s = seccion(doc, num(), 'Cálculos');
    calculos.forEach(c => {
      const caja = el('div', 'pro-calculo');
      const cab = el('div', 'pro-calculo__cab');
      cab.appendChild(el('strong', null, c.nombre || 'Cálculo'));
      if (c.formula) cab.appendChild(el('code', 'pro-calculo__formula', c.formula));
      if (c.unidad) cab.appendChild(el('span', 'pro-calculo__unidad', '[' + c.unidad + ']'));
      caja.appendChild(cab);
      if (c.descripcion) caja.appendChild(el('p', 'pro-calculo__desc', c.descripcion));
      if (paraEstudiante) {
        caja.appendChild(el('span', 'pro-calculo__label', 'Desarrollo:'));
        renglones(caja, 3);
      }
      s.appendChild(caja);
    });
  }

  // ---- preguntas ----
  const preguntas = p.preguntas.filter(q => q.trim());
  if (preguntas.length) {
    const s = seccion(doc, num(), 'Preguntas de análisis');
    const ol = el('ol', 'pro-preguntas');
    preguntas.forEach(q => {
      const li = el('li', 'pro-pregunta');
      li.appendChild(el('span', 'pro-pregunta__texto', q));
      if (paraEstudiante) renglones(li, 3);
      ol.appendChild(li);
    });
    s.appendChild(ol);
  }

  // ---- conclusiones ----
  const s = seccion(doc, num(), 'Conclusiones');
  if (p.conclusiones.guia) {
    const guia = el('div', 'pro-guia');
    guia.appendChild(el('strong', null, 'Para orientarte: '));
    guia.appendChild(document.createTextNode(p.conclusiones.guia));
    s.appendChild(guia);
  }
  if (paraEstudiante) renglones(s, p.conclusiones.lineas);
  else s.appendChild(el('p', 'pro-parrafo pro-parrafo--nota',
    'En la versión del estudiante van acá ' + p.conclusiones.lineas + ' renglones en blanco.'));

  return doc;
}

function pintarVista() {
  const cont = $('vistaProtocolo');
  cont.innerHTML = '';
  cont.appendChild(construirDocumento());
}

// ============================================================
// Revisión: qué le falta al protocolo
// ============================================================
function pintarRevision() {
  const p = estado.p;
  const cont = $('revisionProtocolo');
  cont.innerHTML = '';
  const faltan = [];
  if (!p.meta.titulo.trim()) faltan.push('el título del práctico');
  if (!p.fundamento.trim()) faltan.push('el fundamento teórico');
  if (!p.objetivos.filter(o => o.trim()).length) faltan.push('los objetivos');
  if (!p.materiales.filter(m => m.nombre.trim()).length) faltan.push('la lista de materiales');
  if (!p.procedimiento.filter(x => x.texto.trim()).length) faltan.push('el procedimiento paso a paso');
  if (!p.tablas.filter(t => t.columnas.some(c => c.nombre.trim())).length) faltan.push('alguna tabla para registrar los datos');
  if (!p.preguntas.filter(q => q.trim()).length) faltan.push('las preguntas de análisis');

  const caja = el('div', 'proto-revision__caja' + (faltan.length ? '' : ' proto-revision__caja--ok'));
  if (faltan.length) {
    caja.appendChild(el('strong', null, 'Todavía falta: '));
    caja.appendChild(document.createTextNode(faltan.join(', ') + '.'));
    caja.appendChild(el('span', 'proto-revision__nota', 'Lo podés descargar igual: el aviso es sólo para que no se te escape nada.'));
  } else {
    caja.appendChild(el('strong', null, '✓ El protocolo está completo. '));
    const pasos = p.procedimiento.filter(x => x.texto.trim()).length;
    const inst = p.instrumentos.length;
    caja.appendChild(document.createTextNode(
      `${pasos} ${pasos === 1 ? 'paso' : 'pasos'}, ${inst} ${inst === 1 ? 'instrumento' : 'instrumentos'} y ` +
      `${p.preguntas.filter(q => q.trim()).length} preguntas de análisis.`));
  }
  cont.appendChild(caja);
}

// ============================================================
// Cargar / pintar todo
// ============================================================
function pintarTodo() {
  const p = estado.p;
  document.querySelectorAll('[data-meta]').forEach(inp => { inp.value = p.meta[inp.dataset.meta] || ''; });
  $('campoFundamento').value = p.fundamento;
  $('campoMontaje').value = p.montaje.texto;
  $('campoGuia').value = p.conclusiones.guia;
  $('campoLineas').value = p.conclusiones.lineas;
  $('btnQuitarImagen').hidden = !p.montaje.imagen;

  listaDeTextos('listaObjetivos', p.objetivos, 'Determinar la densidad de tres sólidos irregulares.', '+ Agregar objetivo');
  listaDeTextos('listaSeguridad', p.seguridad, 'Secá enseguida el agua que se derrame en la mesada.', '+ Agregar norma');
  listaDeTextos('listaPreguntas', p.preguntas, '¿Los tres cuerpos tienen la misma densidad?', '+ Agregar pregunta');
  pintarMateriales();
  pintarInstrumentos();
  pintarProcedimiento();
  pintarTablas();
  pintarCalculos();
  pintarVista();
  pintarRevision();
}

function cargarProtocolo(p) {
  estado.p = normalizarProtocolo(p);
  pintarTodo();
  guardar();
}

// ============================================================
// Plantillas
// ============================================================
function pintarPlantillas() {
  const grid = $('gridPlantillas');
  EJEMPLOS.forEach(ej => {
    const card = el('button', 'proto-plantilla');
    card.type = 'button';
    card.appendChild(el('span', 'proto-plantilla__area', ej.area + ' · ' + ej.nivel));
    card.appendChild(el('span', 'proto-plantilla__nombre', ej.nombre));
    card.appendChild(el('span', 'proto-plantilla__resumen', ej.resumen));
    card.addEventListener('click', () => {
      if (tieneContenido() && !confirm('Esto reemplaza el protocolo que tenés cargado. ¿Seguimos?')) return;
      cargarProtocolo(parsearProtocolo(ej.texto));
      toast('Cargado: ' + ej.nombre);
      $('vistaProtocolo').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    grid.appendChild(card);
  });
}

function tieneContenido() {
  const p = estado.p;
  return !!(p.meta.titulo.trim() || p.fundamento.trim() || p.objetivos.length || p.procedimiento.length);
}

// ============================================================
// Exportar
// ============================================================
function imprimir() {
  const area = $('areaImpresion');
  area.innerHTML = '';
  area.appendChild(construirDocumento());
  window.print();
}

async function descargarPDF() {
  if (typeof html2pdf === 'undefined') { toast('El generador de PDF no cargó'); return; }
  const btn = $('btnPDFDirecto');
  const nota = $('notaPDF');
  btn.disabled = true;
  nota.style.display = 'inline';
  nota.textContent = 'Generando el PDF…';
  try {
    const doc = construirDocumento();
    doc.style.maxWidth = 'none';
    doc.style.width = '760px';
    doc.style.border = 'none';
    doc.style.boxShadow = 'none';
    const envoltura = document.createElement('div');
    envoltura.style.cssText = 'position:absolute;left:-10000px;top:0;background:#fff';
    envoltura.appendChild(doc);
    document.body.appendChild(envoltura);
    await html2pdf().set({
      margin: [10, 10, 12, 10],
      filename: nombreBase() + (estado.version === 'docente' ? ' — docente' : '') + '.pdf',
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, scrollX: 0, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css'], avoid: ['.pro-seccion__titulo', '.pro-instrumento', '.pro-paso-doc', '.pro-tabla-caja', '.pro-calculo', '.pro-pregunta', '.pro-seguridad'] }
    }).from(doc).save();
    envoltura.remove();
    nota.style.display = 'none';
  } catch (e) {
    console.error(e);
    nota.textContent = 'No se pudo generar el PDF directo. Probá con «PDF — Imprimir el protocolo».';
  } finally {
    btn.disabled = false;
  }
}

// ============================================================
// Arranque
// ============================================================
function refrescarPrompt() {
  $('iaPrompt').value = promptProtocolo({
    tema: $('iaTema').value.trim(),
    asignatura: $('iaAsignatura').value.trim(),
    nivel: $('iaNivel').value.trim(),
    duracion: $('iaDuracion').value.trim(),
    pasos: Number($('iaPasos').value) || 8,
    preguntas: Number($('iaPreguntas').value) || 5,
    enfoque: $('iaEnfoque').value.trim()
  });
}

function init() {
  pintarPlantillas();
  pintarSelectorInstrumentos();

  const guardado = cargarGuardado();
  estado.p = guardado || parsearProtocolo(EJEMPLOS[0].texto);
  pintarTodo();

  // --- campos sueltos ---
  document.querySelectorAll('[data-meta]').forEach(inp => {
    inp.addEventListener('input', () => { estado.p.meta[inp.dataset.meta] = inp.value; cambio(); });
  });
  $('campoFundamento').addEventListener('input', e => { estado.p.fundamento = e.target.value; cambio(); });
  $('campoMontaje').addEventListener('input', e => { estado.p.montaje.texto = e.target.value; cambio(); });
  $('campoGuia').addEventListener('input', e => { estado.p.conclusiones.guia = e.target.value; cambio(); });
  $('campoLineas').addEventListener('input', e => {
    estado.p.conclusiones.lineas = Math.max(0, Math.min(30, Number(e.target.value) || 0));
    cambio();
  });

  // --- instrumentos ---
  $('btnAgregarInstrumento').addEventListener('click', () => {
    const id = $('selectorInstrumento').value;
    estado.p.instrumentos.push({ id, params: paramsPorDefecto(id), nota: '' });
    pintarInstrumentos();
    pintarProcedimiento();
    cambio();
  });

  // --- imagen del montaje ---
  $('btnImagenMontaje').addEventListener('click', () => $('inputImagenMontaje').click());
  $('inputImagenMontaje').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const lector = new FileReader();
    lector.onload = () => {
      estado.p.montaje.imagen = lector.result;
      $('btnQuitarImagen').hidden = false;
      cambio();
    };
    lector.readAsDataURL(f);
    e.target.value = '';
  });
  $('btnQuitarImagen').addEventListener('click', () => {
    estado.p.montaje.imagen = '';
    $('btnQuitarImagen').hidden = true;
    cambio();
  });

  // --- versión estudiante / docente ---
  ['btnVersionEstudiante', 'btnVersionDocente'].forEach(id => {
    $(id).addEventListener('click', () => {
      estado.version = $(id).dataset.version;
      $('btnVersionEstudiante').classList.toggle('instr-chip--activo', estado.version === 'estudiante');
      $('btnVersionDocente').classList.toggle('instr-chip--activo', estado.version === 'docente');
      pintarVista();
    });
  });

  // --- paneles de arranque ---
  $('btnVacio').addEventListener('click', () => {
    if (tieneContenido() && !confirm('Esto borra el protocolo que tenés cargado. ¿Seguimos?')) return;
    cargarProtocolo(protocoloVacio());
    toast('Listo: protocolo en blanco');
  });
  $('btnAbrirIA').addEventListener('click', () => {
    $('panelIA').hidden = !$('panelIA').hidden;
    $('panelTexto').hidden = true;
    if (!$('panelIA').hidden) refrescarPrompt();
  });
  $('btnAbrirTexto').addEventListener('click', () => {
    $('panelTexto').hidden = !$('panelTexto').hidden;
    $('panelIA').hidden = true;
  });
  ['iaTema', 'iaAsignatura', 'iaNivel', 'iaDuracion', 'iaPasos', 'iaPreguntas', 'iaEnfoque']
    .forEach(id => $(id).addEventListener('input', refrescarPrompt));
  $('btnCopiarPrompt').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('iaPrompt').value); toast('Prompt copiado'); }
    catch (e) { $('iaPrompt').select(); document.execCommand('copy'); toast('Prompt copiado'); }
  });
  $('btnVerFormato').addEventListener('click', () => {
    const pre = $('ejemploFormato');
    pre.hidden = !pre.hidden;
    if (!pre.hidden) pre.textContent = protocoloATexto(parsearProtocolo(EJEMPLOS[0].texto));
  });
  $('btnCargarTexto').addEventListener('click', () => {
    const txt = $('areaTexto').value;
    if (!txt.trim()) { toast('Pegá primero el texto'); return; }
    if (!pareceProtocolo(txt) && !confirm('Ese texto no tiene la pinta de un protocolo (no encontré las secciones con ##). ¿Lo intento igual?')) return;
    const p = parsearProtocolo(txt);
    cargarProtocolo(p);
    toast('Protocolo cargado');
    $('vistaProtocolo').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // --- importar / exportar ---
  $('btnImportarJSON').addEventListener('click', () => $('inputJSON').click());
  $('inputJSON').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const lector = new FileReader();
    lector.onload = () => {
      try {
        cargarProtocolo(JSON.parse(lector.result));
        toast('Protocolo abierto');
      } catch (err) {
        toast('Ese archivo no es un protocolo válido');
      }
    };
    lector.readAsText(f);
    e.target.value = '';
  });
  $('btnGuardarJSON').addEventListener('click', () => {
    descargar(nombreBase() + '.json', JSON.stringify(estado.p, null, 2), 'application/json;charset=utf-8');
    toast('Archivo guardado');
  });
  $('btnDescargarTexto').addEventListener('click', () => {
    descargar(nombreBase() + '.txt', protocoloATexto(estado.p));
    toast('Texto descargado');
  });
  $('btnImprimir').addEventListener('click', imprimir);
  $('btnPDFDirecto').addEventListener('click', descargarPDF);
}

init();
