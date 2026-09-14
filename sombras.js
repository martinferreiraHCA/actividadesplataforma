// Sombras recortadas — página: entrada, panel del docente, editor y vista
// para cortar. Une sombras-editor.js (el editor), sombras-aula.js (el aula
// por WebRTC + almacenamiento) y sombras-render.js / sombras-vector.js
// (dibujo y SVG).

import { crearEditor } from './sombras-editor.js';
import { almacen, nuevaAula, hospedarAula, entrarAula, normalizarCodigo, claveNombre } from './sombras-aula.js';
import { nuevoProyecto, normalizarProyecto, clonar, prepararProyecto, vectorizarProyecto, miniaturaDeProyecto, pngDeProyecto, nombreArchivo } from './sombras-render.js';
import { pathDePieza, svgTapete, cajaGlobal, escaparXml } from './sombras-vector.js';

const $ = id => document.getElementById(id);
const MAT_MM = 304.8;   // tapete de 12 × 12 pulgadas
const MARGEN_MAT = 6;

const estado = {
  modo: 'entrada',        // entrada | docente | estudiante | solo
  host: null,             // aula hospedada (docente)
  cliente: null,          // conexión al aula (estudiante)
  editor: null,
  claveEditando: null,    // docente: estudiante cuyo diseño está abierto
  seleccion: new Set(),   // docente: estudiantes marcados para el tapete
  corte: null,            // último vectorizado {svg, ...}
  corteTapete: null,      // último tapete {svg, colocados, sinLugar}
  temporizadorCorte: null,
  temporizadorGuardado: null
};

// ------------------------------------------------------------------
// utilidades
// ------------------------------------------------------------------
let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('toast--visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('toast--visible'), 2600);
}
function descargar(contenido, nombre, tipo) {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
}
function dataUrlABlob(dataUrl) {
  const [cab, b64] = dataUrl.split(',');
  const tipo = (cab.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: tipo });
}
function hora(ts) { if (!ts) return '—'; const d = new Date(ts); return d.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' }); }
function fecha(ts) { if (!ts) return '—'; return new Date(ts).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + hora(ts); }
function mostrar(id, si) { $(id).style.display = si ? '' : 'none'; }
function pildora(el, clase, texto) { el.className = 'som-pildora ' + (clase ? 'som-pildora--' + clase : ''); el.textContent = texto; }
function leerJson(archivo) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { try { resolve(JSON.parse(r.result)); } catch (e) { reject(new Error('El archivo no es un .json válido.')); } };
    r.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    r.readAsText(archivo);
  });
}
function enlaceAula(codigo) {
  const u = new URL(location.href); u.search = ''; u.hash = '';
  return `${u.href}?aula=${codigo}`;
}

// ------------------------------------------------------------------
// entrada
// ------------------------------------------------------------------
async function refrescarEntrada() {
  const aulas = await almacen.listarAulas();
  mostrar('misAulas', aulas.length > 0);
  const ul = $('listaAulas');
  ul.innerHTML = '';
  for (const a of aulas) {
    const n = Object.keys(a.estudiantes || {}).length;
    const li = document.createElement('li');
    li.innerHTML = `<code>${a.codigo}</code> <strong>${escapar(a.nombre)}</strong> <span class="som-lista__meta">${n} estudiante${n === 1 ? '' : 's'} · ${fecha(a.actualizada)}</span>
      <button type="button" class="som-btn som-btn--chico" data-abrir="${a.codigo}">Abrir</button>
      <button type="button" class="som-btn som-btn--chico som-btn--peligro" data-borrar="${a.codigo}" title="Borrar el aula y sus diseños de este navegador">🗑</button>`;
    ul.appendChild(li);
  }
  const disenos = (await almacen.listarProyectos()).slice(0, 24);
  mostrar('misDisenos', disenos.length > 0);
  const grid = $('listaDisenos');
  grid.innerHTML = '';
  for (const p of disenos) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'som-diseno'; b.dataset.id = p.id;
    b.innerHTML = `${p.miniatura ? `<img src="${p.miniatura}" alt="">` : '<div class="som-est__mini som-est__mini--vacia">sin vista</div>'}<span>${escapar(p.nombre || 'Sin nombre')}</span><small>${p.aula ? `aula ${p.aula} · ${escapar(p.autor || '')}` : 'sin aula'} · ${fecha(p.modificado)}</small>`;
    grid.appendChild(b);
  }
}
$('listaAulas').addEventListener('click', async e => {
  const abrir = e.target.closest('[data-abrir]'), borrar = e.target.closest('[data-borrar]');
  if (abrir) abrirAula(abrir.dataset.abrir);
  if (borrar) {
    if (!confirm('¿Borrar el aula ' + borrar.dataset.borrar + ' y todos sus diseños de este navegador? No se puede deshacer.')) return;
    await almacen.borrarAula(borrar.dataset.borrar);
    refrescarEntrada();
  }
});
$('listaDisenos').addEventListener('click', async e => {
  const b = e.target.closest('.som-diseno');
  if (!b) return;
  const p = await almacen.obtenerProyecto(b.dataset.id);
  if (!p) return;
  if (p.aula && p.autor) { $('inputCodigo').value = p.aula; $('inputNombre').value = p.autor; entrarComoEstudiante(); }
  else abrirSolo(p);
});
$('btnCrearAula').addEventListener('click', async () => {
  const aula = nuevaAula($('inputNombreAula').value.trim() || 'Mi aula');
  await almacen.guardarAula(aula);
  abrirAula(aula.codigo);
});
$('btnEntrar').addEventListener('click', entrarComoEstudiante);
$('inputNombre').addEventListener('keydown', e => { if (e.key === 'Enter') entrarComoEstudiante(); });
$('inputCodigo').addEventListener('input', e => { e.target.value = normalizarCodigo(e.target.value); });
$('btnSolo').addEventListener('click', () => abrirSolo(null));

// ------------------------------------------------------------------
// modos
// ------------------------------------------------------------------
function irA(modo) {
  estado.modo = modo;
  mostrar('seccionIntro', modo === 'entrada');
  mostrar('seccionEntrada', modo === 'entrada');
  mostrar('seccionAula', modo === 'docente' && !estado.claveEditando);
  mostrar('seccionEditor', modo === 'estudiante' || modo === 'solo' || (modo === 'docente' && !!estado.claveEditando));
  mostrar('seccionCorte', modo !== 'entrada');
  mostrar('btnVolverAula', modo === 'docente');
  if (modo === 'entrada') refrescarEntrada();
  window.scrollTo({ top: modo === 'entrada' ? 0 : $('seccionAula').offsetTop - 20, behavior: 'smooth' });
}

function asegurarEditor() {
  if (estado.editor) return estado.editor;
  estado.editor = crearEditor($('editorContenedor'), { toast, alCambiar: alCambiarProyecto });
  return estado.editor;
}

let guardadoPendiente = null; // {proyecto, modo, clave, cliente, host}
function alCambiarProyecto(proyecto) {
  $('editorGuardado').textContent = 'guardando…';
  clearTimeout(estado.temporizadorGuardado);
  // se captura el contexto ahora: si el usuario sale del editor antes de que
  // venza el temporizador, el guardado igual va a donde corresponde
  guardadoPendiente = { proyecto, modo: estado.modo, clave: estado.claveEditando, cliente: estado.cliente, host: estado.host };
  estado.temporizadorGuardado = setTimeout(vaciarGuardado, 400);
  programarCorte();
}
async function vaciarGuardado() {
  clearTimeout(estado.temporizadorGuardado);
  const g = guardadoPendiente;
  if (!g) return;
  guardadoPendiente = null;
  const proyecto = g.proyecto;
  const mini = miniaturaDeProyecto(proyecto, 160);
  const registro = Object.assign(clonar(proyecto), { miniatura: mini });
  await almacen.guardarProyecto(registro);
  let extra = '';
  if (g.modo === 'estudiante' && g.cliente) {
    const ok = g.cliente.enviarProyecto(clonar(proyecto), mini);
    extra = ok ? ' · enviado al aula' : ' · se manda al reconectar';
  }
  if (g.modo === 'docente' && g.host && g.clave) {
    await g.host.actualizarProyecto(g.clave, clonar(proyecto), mini);
    extra = ' · guardado en el aula y enviado al estudiante';
  }
  $('editorGuardado').textContent = `guardado ${hora(Date.now())}${extra}`;
}
// Antes de salir del editor: que no quede ningún cambio sin guardar.
async function cerrarEdicion() {
  if (estado.editor) estado.editor.vaciarCambio();
  await vaciarGuardado();
}

// ---------------- docente ----------------
async function abrirAula(codigo) {
  const guardada = await almacen.obtenerAula(codigo);
  if (!guardada) { toast('No se encontró esa aula'); return; }
  if (estado.host) estado.host.cerrar();
  const aula = Object.assign({ estudiantes: {} }, guardada);
  estado.claveEditando = null;
  estado.seleccion = new Set(Object.keys(aula.estudiantes));
  estado.host = hospedarAula(aula, (tipo, datos) => {
    if (tipo === 'estado') {
      const e = datos.estado;
      const clase = e === 'abierta' ? 'ok' : (e === 'conectando' || e === 'reconectando') ? 'espera' : (e === 'apagada' ? '' : 'mal');
      const texto = { abierta: 'aula abierta', conectando: 'abriendo…', reconectando: 'reconectando…', apagada: 'apagada', error: 'sin conexión', 'codigo-ocupado': 'código en uso', 'sin-peer': 'sólo archivos' }[e] || e;
      pildora($('aulaEstado'), clase, texto);
      $('aulaDetalle').textContent = datos.detalle || (e === 'abierta' ? 'Dejá esta pestaña abierta mientras trabajan. Los diseños se guardan acá aunque se corte la conexión.' : '');
    }
    if (tipo === 'estudiante') {
      if (datos.estudiante && datos.estudiante.proyecto && !estado.seleccion.has(datos.clave) && !datos.estudiante._visto) { estado.seleccion.add(datos.clave); datos.estudiante._visto = true; }
      renderEstudiantes();
      if (!estado.claveEditando) programarCorte(); // el tapete se rearma solo a medida que llegan diseños
    }
  });
  $('aulaCodigo').textContent = aula.codigo;
  $('aulaEnlace').textContent = enlaceAula(aula.codigo);
  $('aulaNombre').value = aula.nombre;
  const u = new URL(location.href); u.searchParams.set('modo', 'docente'); u.searchParams.set('aula', aula.codigo); history.replaceState(null, '', u);
  irA('docente');
  renderEstudiantes();
  estado.host.iniciar();
  programarCorte(true);
}

function renderEstudiantes() {
  if (!estado.host) return;
  const grid = $('gridEstudiantes');
  const lista = Object.entries(estado.host.aula.estudiantes).sort((a, b) => a[1].nombre.localeCompare(b[1].nombre, 'es'));
  mostrar('aulaVacia', lista.length === 0);
  grid.innerHTML = '';
  for (const [clave, e] of lista) {
    const card = document.createElement('div');
    card.className = 'som-est' + (estado.claveEditando === clave ? ' som-est--sel' : '');
    card.dataset.clave = clave;
    const tienePro = !!e.proyecto;
    card.innerHTML = `
      <input type="checkbox" class="som-est__check" data-sel ${estado.seleccion.has(clave) ? 'checked' : ''} ${tienePro ? '' : 'disabled'} title="Incluir en el tapete y en el .zip">
      ${e.miniatura ? `<img class="som-est__mini" src="${e.miniatura}" alt="">` : `<div class="som-est__mini som-est__mini--vacia">${tienePro ? 'sin vista previa' : 'todavía no diseñó nada'}</div>`}
      <div class="som-est__cab"><span class="som-est__punto ${e.conectado ? 'som-est__punto--on' : ''}" title="${e.conectado ? 'Conectado' : 'Desconectado'}"></span><span class="som-est__nombre" title="${escapar(e.nombre)}">${escapar(e.nombre)}</span></div>
      <div class="som-est__meta">${tienePro ? `${escapar(e.proyecto.nombre || '')} · ${e.proyecto.pieza.anchoMm}×${e.proyecto.pieza.altoMm} mm · ${hora(e.actualizado)}` : (e.conectado ? 'conectado, diseñando…' : 'entró ' + hora(e.ultimaConexion))}${e.editadoPorDocente ? ' · retocado' : ''}</div>
      <div class="som-est__acciones">
        <button type="button" class="som-btn som-btn--chico" data-editar ${tienePro ? '' : 'disabled'}>✎ Abrir</button>
        <button type="button" class="som-btn som-btn--chico" data-svg ${tienePro ? '' : 'disabled'}>⬇ SVG</button>
        <button type="button" class="som-btn som-btn--chico" data-json ${tienePro ? '' : 'disabled'} title="Descargar el proyecto (.json)">💾</button>
        <button type="button" class="som-btn som-btn--chico som-btn--peligro" data-quitar title="Quitar del aula">🗑</button>
      </div>`;
    grid.appendChild(card);
  }
}
$('gridEstudiantes').addEventListener('click', async e => {
  const card = e.target.closest('.som-est');
  if (!card || !estado.host) return;
  const clave = card.dataset.clave;
  const est = estado.host.aula.estudiantes[clave];
  if (!est) return;
  if (e.target.matches('[data-sel]')) { if (e.target.checked) estado.seleccion.add(clave); else estado.seleccion.delete(clave); return; }
  if (e.target.closest('[data-editar]')) { editarEstudiante(clave); return; }
  if (e.target.closest('[data-svg]')) { await descargarSvgDe(est.proyecto); return; }
  if (e.target.closest('[data-json]')) { descargar(JSON.stringify(est.proyecto, null, 1), nombreArchivo(est.proyecto) + '.sombra.json', 'application/json'); return; }
  if (e.target.closest('[data-quitar]')) {
    if (!confirm(`¿Quitar a ${est.nombre} del aula? Su diseño se borra de este navegador.`)) return;
    estado.seleccion.delete(clave);
    await estado.host.quitarEstudiante(clave);
  }
});
$('gridEstudiantes').addEventListener('change', e => {
  if (!e.target.matches('[data-sel]')) return;
  const clave = e.target.closest('.som-est').dataset.clave;
  if (e.target.checked) estado.seleccion.add(clave); else estado.seleccion.delete(clave);
});
$('aulaCodigo').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(enlaceAula($('aulaCodigo').textContent)); toast('Enlace del aula copiado'); } catch (_) { toast('Código: ' + $('aulaCodigo').textContent); }
});
$('aulaNombre').addEventListener('change', () => { if (estado.host) estado.host.renombrar($('aulaNombre').value.trim() || 'Mi aula'); });
$('btnCerrarAula').addEventListener('click', async () => {
  await cerrarEdicion();
  if (estado.host) estado.host.cerrar();
  estado.host = null; estado.claveEditando = null;
  history.replaceState(null, '', location.pathname);
  irA('entrada');
});
$('btnMensaje').addEventListener('click', () => {
  const t = $('inputMensaje').value.trim();
  if (!t || !estado.host) return;
  estado.host.difundir(t); $('inputMensaje').value = '';
  toast(`Enviado a ${estado.host.conectados} conectado${estado.host.conectados === 1 ? '' : 's'}`);
});
$('btnExportarAula').addEventListener('click', () => {
  if (!estado.host) return;
  const a = estado.host.aula;
  descargar(JSON.stringify({ tipo: 'sombras-aula', version: 1, aula: a }, null, 1), `aula-${a.codigo}.json`, 'application/json');
});
$('btnImportarProyecto').addEventListener('click', () => $('inputImportar').click());
$('inputImportar').addEventListener('change', async e => {
  const archivos = Array.from(e.target.files || []);
  e.target.value = '';
  for (const f of archivos) {
    try {
      const datos = await leerJson(f);
      if (datos && datos.tipo === 'sombras-aula' && datos.aula) {
        // un aula entera exportada: se agregan sus estudiantes a esta
        for (const est of Object.values(datos.aula.estudiantes || {})) if (est.proyecto) await estado.host.importarProyecto(est.nombre, normalizarProyecto(est.proyecto), est.miniatura);
        toast('Aula importada');
        continue;
      }
      const p = normalizarProyecto(datos.proyecto || datos);
      await prepararProyecto(p);
      const clave = await estado.host.importarProyecto(p.autor || f.name.replace(/\.(sombra\.)?json$/i, ''), p, miniaturaDeProyecto(p, 160));
      estado.seleccion.add(clave);
      toast(`Importado: ${p.autor || p.nombre}`);
    } catch (err) { toast(err.message || 'No se pudo importar'); }
  }
});

async function editarEstudiante(clave) {
  const est = estado.host.aula.estudiantes[clave];
  if (!est || !est.proyecto) return;
  estado.claveEditando = clave;
  $('editorQuien').textContent = `Diseño de ${est.nombre} (retocando como docente)`;
  mostrar('editorConexion', false);
  $('editorGuardado').textContent = '';
  irA('docente');
  await asegurarEditor().cargar(est.proyecto);
  programarCorte(true);
}
$('btnVolverAula').addEventListener('click', async () => { await cerrarEdicion(); estado.claveEditando = null; irA('docente'); renderEstudiantes(); estado.corte = null; programarCorte(true); });

// ---------------- estudiante ----------------
async function entrarComoEstudiante() {
  const codigo = normalizarCodigo($('inputCodigo').value);
  const nombre = $('inputNombre').value.trim().replace(/\s+/g, ' ');
  const err = $('entradaError');
  if (codigo.length !== 6) { err.textContent = 'El código tiene 6 letras o números.'; err.style.display = ''; return; }
  if (nombre.length < 2) { err.textContent = 'Escribí tu nombre para que el docente sepa de quién es el diseño.'; err.style.display = ''; return; }
  err.style.display = 'none';
  try { localStorage.setItem('sombras_ultimo', JSON.stringify({ codigo, nombre })); } catch (_) {}
  if (estado.cliente) estado.cliente.cerrar();

  const clave = claveNombre(nombre);
  const idLocal = `a_${codigo}_${clave.replace(/[^a-z0-9]+/g, '_')}`;
  let proyecto = await almacen.obtenerProyecto(idLocal);
  if (!proyecto) proyecto = nuevoProyecto({ id: idLocal, nombre: `Sombra de ${nombre.split(' ')[0]}`, autor: nombre, aula: codigo });
  proyecto = normalizarProyecto(proyecto);
  proyecto.autor = nombre; proyecto.aula = codigo; proyecto.id = idLocal;

  $('editorQuien').textContent = `${nombre} · aula ${codigo}`;
  mostrar('editorConexion', true);
  pildora($('editorConexion'), 'espera', 'conectando…');
  $('editorGuardado').textContent = '';
  irA('estudiante');
  const editor = asegurarEditor();
  await editor.cargar(proyecto);
  programarCorte(true);

  estado.cliente = entrarAula(codigo, nombre, async (tipo, datos) => {
    if (tipo === 'estado') {
      const e = datos.estado;
      const clase = e === 'conectado' ? 'ok' : (e === 'conectando' ? 'espera' : (e === 'apagada' ? '' : 'mal'));
      const texto = { conectado: 'en el aula', conectando: 'conectando…', desconectado: 'reconectando…', 'sin-aula': 'el aula no está abierta', error: 'sin conexión', rechazado: 'sesión cerrada', 'sin-peer': 'sólo archivos', apagada: 'fuera del aula' }[e] || e;
      pildora($('editorConexion'), clase, texto);
      if (datos.detalle) toast(datos.detalle);
    }
    if (tipo === 'bienvenido') {
      const remoto = datos.proyecto;
      const local = editor.obtener();
      if (remoto && (remoto.modificado || 0) > (local.modificado || 0) + 1000) {
        const r = normalizarProyecto(remoto); r.id = idLocal; r.autor = nombre; r.aula = codigo;
        await editor.cargar(r);
        await almacen.guardarProyecto(Object.assign(clonar(r), { miniatura: miniaturaDeProyecto(r, 160) }));
        toast('Recuperamos tu diseño desde el aula');
        programarCorte(true);
      } else {
        estado.cliente.enviarProyecto(clonar(local), miniaturaDeProyecto(local, 160));
      }
    }
    if (tipo === 'proyecto' && datos.proyecto) {
      const r = normalizarProyecto(datos.proyecto); r.id = idLocal; r.autor = nombre; r.aula = codigo;
      await editor.cargar(r);
      await almacen.guardarProyecto(Object.assign(clonar(r), { miniatura: miniaturaDeProyecto(r, 160) }));
      toast('El docente retocó tu diseño: ya lo tenés acá');
      programarCorte(true);
    }
    if (tipo === 'mensaje') { alert('Mensaje del docente:\n\n' + datos.texto); }
  });
  estado.cliente.conectar();
}

// ---------------- solo ----------------
async function abrirSolo(proyectoGuardado) {
  if (estado.cliente) { estado.cliente.cerrar(); estado.cliente = null; }
  const p = proyectoGuardado ? normalizarProyecto(proyectoGuardado) : nuevoProyecto();
  $('editorQuien').textContent = proyectoGuardado ? `Diseño: ${p.nombre}` : 'Diseño sin aula (se guarda en este navegador)';
  mostrar('editorConexion', false);
  $('editorGuardado').textContent = '';
  irA('solo');
  await asegurarEditor().cargar(p);
  programarCorte(true);
}

// ---------------- editor: botones comunes ----------------
$('btnSalir').addEventListener('click', async () => {
  await cerrarEdicion();
  if (estado.cliente) { estado.cliente.cerrar(); estado.cliente = null; }
  if (estado.modo === 'docente') { estado.claveEditando = null; irA('docente'); renderEstudiantes(); return; }
  irA('entrada');
});
$('btnGuardarJson').addEventListener('click', () => {
  if (!estado.editor) return;
  const p = estado.editor.obtener();
  descargar(JSON.stringify({ tipo: 'sombras-proyecto', version: 1, proyecto: p }, null, 1), nombreArchivo(p) + '.sombra.json', 'application/json');
});
$('btnAbrirJson').addEventListener('click', () => $('inputAbrirJson').click());
$('inputAbrirJson').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f || !estado.editor) return;
  try {
    const datos = await leerJson(f);
    const actual = estado.editor.obtener();
    const p = normalizarProyecto(datos.proyecto || datos);
    // conserva la identidad de la sesión actual (aula, autor, id)
    p.id = actual.id; p.autor = actual.autor || p.autor; p.aula = actual.aula || p.aula;
    await estado.editor.cargar(p);
    alCambiarProyecto(p);
    toast('Proyecto abierto');
  } catch (err) { toast(err.message); }
});

// ------------------------------------------------------------------
// vista para cortar
// ------------------------------------------------------------------
function programarCorte(ya) {
  clearTimeout(estado.temporizadorCorte);
  estado.temporizadorCorte = setTimeout(actualizarCorte, ya ? 50 : 1200);
}
$('btnActualizarCorte').addEventListener('click', () => programarCorte(true));
['corteEspejo', 'corteRecortar', 'corteDetalle'].forEach(id => $(id).addEventListener('change', () => programarCorte(true)));

function opcionesCorte() {
  return { espejo: $('corteEspejo').checked, recortarCaja: $('corteRecortar').checked, detalleMinMm: parseFloat($('corteDetalle').value) || 1.5 };
}

async function actualizarCorte() {
  const enTapete = estado.modo === 'docente' && !estado.claveEditando;
  $('corteExplica').style.display = enTapete ? 'none' : '';
  $('corteRecortar').parentElement.style.display = enTapete ? 'none' : '';
  if (enTapete) { await actualizarTapete(); return; }
  if (!estado.editor) return;
  const p = estado.editor.obtener();
  const op = opcionesCorte();
  await prepararProyecto(p);
  let r;
  try { r = vectorizarProyecto(p, { espejo: op.espejo || p.pieza.espejo, recortarCaja: op.recortarCaja, margenMm: 0, detalleMinMm: op.detalleMinMm }); }
  catch (e) { console.error(e); $('corteAvisos').innerHTML = `<div class="som-aviso som-aviso--error">No se pudo vectorizar: ${escapar(e.message)}</div>`; return; }
  estado.corte = r; estado.corteTapete = null;
  const caja = cajaGlobal(r.piezas);
  const wMm = caja.w / r.pxPorMm, hMm = caja.h / r.pxPorMm;
  $('tapete').innerHTML = svgMat([{ piezas: r.piezas, pxPorMm: r.pxPorMm, caja, x: MARGEN_MAT, y: MARGEN_MAT, nombre: p.nombre, espejo: r.espejo, anchoMm: wMm, altoMm: hMm }]);
  $('tapetePie').textContent = `Tapete de 12 × 12" (${MAT_MM} mm). La pieza se apoya en la esquina superior izquierda con ${MARGEN_MAT} mm de margen.`;
  $('corteMedidas').innerHTML = `<span>Pieza: <strong>${p.pieza.anchoMm} × ${p.pieza.altoMm} mm</strong></span><span>Dibujo: <strong>${wMm.toFixed(1)} × ${hMm.toFixed(1)} mm</strong></span><span>Piezas de vinilo: <strong>${r.piezas.length}</strong></span><span>Agujeros: <strong>${r.piezas.reduce((s, q) => s + q.agujeros.length, 0)}</strong></span>${r.espejo ? '<span>⇋ espejada</span>' : ''}`;
  const avisos = r.avisos.length ? r.avisos : [{ tipo: 'ok', texto: 'Sin problemas detectados: una sola pieza y sin detalles finos.' }];
  if (wMm > MAT_MM - 2 * MARGEN_MAT || hMm > MAT_MM - 2 * MARGEN_MAT) avisos.unshift({ tipo: 'error', texto: 'El dibujo es más grande que el tapete de 12 × 12". Achicá la pieza.' });
  if (wMm > 292 || hMm > 292) avisos.unshift({ tipo: 'aviso', texto: 'La Explore Air 2 corta hasta 11,5" (292 mm) por lado.' });
  $('corteAvisos').innerHTML = avisos.map(a => `<div class="som-aviso ${a.tipo === 'error' ? 'som-aviso--error' : a.tipo === 'ok' ? 'som-aviso--ok' : ''}">${escapar(a.texto)}</div>`).join('');
  $('btnSVG').textContent = '⬇ Descargar SVG';
  $('btnPNG').disabled = false;
}

async function vectorizarEstudiantes() {
  const op = opcionesCorte();
  const lista = [];
  for (const clave of estado.seleccion) {
    const e = estado.host.aula.estudiantes[clave];
    if (!e || !e.proyecto) continue;
    const p = normalizarProyecto(e.proyecto);
    await prepararProyecto(p);
    const r = vectorizarProyecto(p, { espejo: false, detalleMinMm: op.detalleMinMm });
    lista.push({ id: nombreArchivo(p) + '-' + clave.replace(/[^a-z0-9]+/g, '_'), nombre: e.nombre, clave, proyecto: p, r });
  }
  return lista;
}

async function actualizarTapete() {
  if (!estado.host) return;
  const op = opcionesCorte();
  const lista = await vectorizarEstudiantes();
  if (!lista.length) {
    $('tapete').innerHTML = svgMat([]);
    $('tapetePie').textContent = 'Marcá los estudiantes que querés incluir (casilla en cada tarjeta).';
    $('corteMedidas').innerHTML = ''; $('corteAvisos').innerHTML = '<div class="som-aviso">Todavía no hay diseños para acomodar en el tapete.</div>';
    estado.corteTapete = null; return;
  }
  const tap = svgTapete(lista.map(it => ({ id: it.id, nombre: it.nombre, piezas: it.r.piezas, pxPorMm: it.r.pxPorMm })), { anchoMat: MAT_MM, altoMat: MAT_MM, sepMm: 4, margenMm: MARGEN_MAT, espejo: op.espejo });
  estado.corteTapete = Object.assign(tap, { lista });
  estado.corte = null;
  const porId = new Map(lista.map(it => [it.id, it]));
  $('tapete').innerHTML = svgMat(tap.colocados.map(c => { const it = porId.get(c.id); return { piezas: it.r.piezas, pxPorMm: it.r.pxPorMm, caja: cajaGlobal(it.r.piezas), x: c.x, y: c.y, rotado: c.rotado, nombre: it.nombre, anchoMm: c.anchoMm, altoMm: c.altoMm }; }), op.espejo);
  $('tapetePie').textContent = `${tap.colocados.length} diseño${tap.colocados.length === 1 ? '' : 's'} en un tapete de 12 × 12". Separación 4 mm.`;
  $('corteMedidas').innerHTML = tap.colocados.map(c => `<span>${escapar(c.nombre)}: ${c.anchoMm.toFixed(0)} × ${c.altoMm.toFixed(0)} mm${c.rotado ? ' (girado)' : ''}</span>`).join('');
  const avisos = [];
  if (tap.sinLugar.length) avisos.push({ tipo: 'error', texto: `No entraron en el tapete: ${tap.sinLugar.map(s => s.nombre).join(', ')}. Desmarcá algunos y armá un segundo tapete, o descargá el .zip con los SVG sueltos.` });
  for (const it of lista) for (const a of it.r.avisos) avisos.push({ tipo: a.tipo, texto: `${it.nombre}: ${a.texto}` });
  if (!avisos.length) avisos.push({ tipo: 'ok', texto: 'Todos los diseños entran y no tienen detalles finos.' });
  $('corteAvisos').innerHTML = avisos.map(a => `<div class="som-aviso ${a.tipo === 'error' ? 'som-aviso--error' : a.tipo === 'ok' ? 'som-aviso--ok' : ''}">${escapar(a.texto)}</div>`).join('');
  $('btnSVG').textContent = '⬇ Descargar el tapete (SVG)';
  $('btnPNG').disabled = false;
}

// Dibuja el tapete con grilla en pulgadas y los diseños encima (vista previa).
function svgMat(disenos, espejoGlobal) {
  const f = n => (Math.round(n * 100) / 100);
  let grilla = '';
  for (let i = 0; i <= 12; i++) {
    const v = f(i * 25.4);
    grilla += `<line x1="${v}" y1="0" x2="${v}" y2="${MAT_MM}" stroke="rgba(0,0,0,${i % 12 === 0 ? 0.35 : 0.18})" stroke-width="0.4"/><line x1="0" y1="${v}" x2="${MAT_MM}" y2="${v}" stroke="rgba(0,0,0,${i % 12 === 0 ? 0.35 : 0.18})" stroke-width="0.4"/>`;
    if (i < 12) grilla += `<text x="${v + 1.5}" y="4.5" font-size="3.6" fill="rgba(0,0,0,0.5)" font-family="JetBrains Mono, monospace">${i + 1}</text><text x="1" y="${v + 4.5}" font-size="3.6" fill="rgba(0,0,0,0.5)" font-family="JetBrains Mono, monospace">${i + 1}</text>`;
  }
  let cuerpo = '';
  for (const d of disenos) {
    const escala = 1 / d.pxPorMm;
    const paths = d.piezas.map(p => `<path fill-rule="evenodd" d="${pathDePieza(p, escala, 0, 0)}"/>`).join('');
    let transform;
    if (d.rotado) transform = `translate(${f(d.x + d.altoMm)} ${f(d.y)}) rotate(90) translate(${f(-d.caja.x0 * escala)} ${f(-d.caja.y0 * escala)})`;
    else if (d.espejo) transform = `translate(${f(d.x + d.anchoMm)} ${f(d.y)}) scale(-1 1) translate(${f(-d.caja.x0 * escala)} ${f(-d.caja.y0 * escala)})`;
    else transform = `translate(${f(d.x - d.caja.x0 * escala)} ${f(d.y - d.caja.y0 * escala)})`;
    cuerpo += `<g transform="${transform}" fill="#111">${paths}</g>`;
    cuerpo += `<rect x="${f(d.x)}" y="${f(d.y)}" width="${f(d.anchoMm)}" height="${f(d.altoMm)}" fill="none" stroke="#2F5E8C" stroke-width="0.5" stroke-dasharray="2 1.5"/>`;
    if (disenos.length > 1) cuerpo += `<text x="${f(d.x + 1)}" y="${f(d.y + d.altoMm - 1.5)}" font-size="4" fill="#2F5E8C" font-family="Space Grotesk, sans-serif">${escaparXml(d.nombre || '')}</text>`;
  }
  if (espejoGlobal) cuerpo = `<g transform="translate(${MAT_MM} 0) scale(-1 1)">${cuerpo}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MAT_MM} ${MAT_MM}" role="img" aria-label="Vista previa del tapete de corte"><rect width="${MAT_MM}" height="${MAT_MM}" fill="#cfe4c8"/>${grilla}${cuerpo}</svg>`;
}

async function descargarSvgDe(proyecto) {
  const p = normalizarProyecto(proyecto);
  await prepararProyecto(p);
  const op = opcionesCorte();
  const r = vectorizarProyecto(p, { espejo: op.espejo || p.pieza.espejo, recortarCaja: op.recortarCaja, detalleMinMm: op.detalleMinMm });
  descargar(r.svg, nombreArchivo(p) + '.svg', 'image/svg+xml');
}

$('btnSVG').addEventListener('click', () => {
  if (estado.corteTapete) { descargar(estado.corteTapete.svg, `tapete-${estado.host.aula.codigo}.svg`, 'image/svg+xml'); return; }
  if (estado.corte && estado.editor) { descargar(estado.corte.svg, nombreArchivo(estado.editor.obtener()) + '.svg', 'image/svg+xml'); return; }
  toast('Todavía no hay nada para descargar');
});
$('btnCopiarSVG').addEventListener('click', async () => {
  const svg = estado.corteTapete ? estado.corteTapete.svg : estado.corte && estado.corte.svg;
  if (!svg) return;
  try { await navigator.clipboard.writeText(svg); toast('SVG copiado al portapapeles'); } catch (_) { toast('No se pudo copiar'); }
});
$('btnPNG').addEventListener('click', async () => {
  if (estado.corteTapete) {
    const png = await pngDeSvg(estado.corteTapete.svg, 4);
    descargar(dataUrlABlob(png), `tapete-${estado.host.aula.codigo}.png`);
    return;
  }
  if (!estado.editor) return;
  const p = estado.editor.obtener();
  const espejo = $('corteEspejo').checked;
  const copia = clonar(p); copia.pieza.espejo = espejo || p.pieza.espejo;
  descargar(dataUrlABlob(pngDeProyecto(copia, 8, false)), nombreArchivo(p) + '.png');
});
function pngDeSvg(svgTexto, pxPorMm) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svgTexto], { type: 'image/svg+xml' }));
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = Math.round(MAT_MM * pxPorMm); cv.height = Math.round(MAT_MM * pxPorMm);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo dibujar el SVG')); };
    img.src = url;
  });
}

$('btnTapete').addEventListener('click', () => { programarCorte(true); $('seccionCorte').scrollIntoView({ behavior: 'smooth' }); });
$('btnZip').addEventListener('click', async () => {
  if (!estado.host || typeof JSZip === 'undefined') return;
  const lista = await vectorizarEstudiantes();
  if (!lista.length) { toast('No hay diseños marcados'); return; }
  const op = opcionesCorte();
  const zip = new JSZip();
  const carpeta = zip.folder(`sombras-${estado.host.aula.codigo}`);
  for (const it of lista) {
    const r = vectorizarProyecto(it.proyecto, { espejo: op.espejo || it.proyecto.pieza.espejo, recortarCaja: true, detalleMinMm: op.detalleMinMm });
    carpeta.file(`${it.id}.svg`, r.svg);
    carpeta.file(`${it.id}.sombra.json`, JSON.stringify({ tipo: 'sombras-proyecto', version: 1, proyecto: it.proyecto }));
  }
  const tap = svgTapete(lista.map(it => ({ id: it.id, nombre: it.nombre, piezas: it.r.piezas, pxPorMm: it.r.pxPorMm })), { anchoMat: MAT_MM, altoMat: MAT_MM, sepMm: 4, margenMm: MARGEN_MAT, espejo: op.espejo });
  carpeta.file('tapete-12x12.svg', tap.svg);
  carpeta.file('LEEME.txt', `Sombras recortadas — aula ${estado.host.aula.codigo} (${estado.host.aula.nombre})\n\nUn .svg por estudiante (en milímetros, un path por pieza, listo para Cricut Design Space → Upload).\ntapete-12x12.svg: ${tap.colocados.length} diseños acomodados en un tapete de 12 × 12".${tap.sinLugar.length ? ` No entraron: ${tap.sinLugar.map(s => s.nombre).join(', ')}.` : ''}\nLos .sombra.json se pueden volver a abrir en la página para seguir editando.\n`);
  const blob = await zip.generateAsync({ type: 'blob' });
  descargar(blob, `sombras-${estado.host.aula.codigo}.zip`);
});

// ------------------------------------------------------------------
// arranque
// ------------------------------------------------------------------
function escapar(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

window.addEventListener('beforeunload', e => {
  if (estado.host && estado.host.conectados > 0) { e.preventDefault(); e.returnValue = ''; }
});

window.__sombras = estado; // para pruebas automáticas

(async function arrancar() {
  const params = new URLSearchParams(location.search);
  try {
    const ultimo = JSON.parse(localStorage.getItem('sombras_ultimo') || 'null');
    if (ultimo) { $('inputCodigo').value = ultimo.codigo || ''; $('inputNombre').value = ultimo.nombre || ''; }
  } catch (_) {}
  if (params.get('aula')) $('inputCodigo').value = normalizarCodigo(params.get('aula'));
  await refrescarEntrada();
  if (params.get('modo') === 'docente' && params.get('aula')) {
    const a = await almacen.obtenerAula(normalizarCodigo(params.get('aula')));
    if (a) abrirAula(a.codigo);
  } else if (params.get('modo') === 'solo') abrirSolo(null);
  else if (params.get('aula')) { $('seccionEntrada').scrollIntoView(); $('inputNombre').focus(); }
})();
