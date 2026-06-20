// App principal — maneja los 3 modos del editor
import { ACTIVITIES, TIPOS_PREGUNTA } from './activities.js';
import { generarPrompt } from './prompt-generator.js';
import { parsear } from './parser.js';
import { renderPreguntas } from './preview.js';
import { EditorVisual } from './visual-editor.js';
import { GestorImagenes } from './images.js';
import { generarIMSCC } from './export/commoncartridge.js';
import { generarGIFT } from './export/gift.js';
import { generarMoodleXML } from './export/moodlexml.js';
import { generarAppsScript } from './export/appsscript.js';
import { exportarJSON, importarJSON } from './export/json.js';
import { generarQTI21Zip } from './export/qti21package.js';
import { abrirVistaPrevia } from './preview-plataforma.js';

// ====== ESTADO GLOBAL ======
let preguntas = [];
let tituloQuiz = '';
let nivelQuiz = '';
const gestorImg = new GestorImagenes();

// Tipo de actividad
const params = new URLSearchParams(window.location.search);
const tipoActividad = params.get('tipo') || 'cuestionario';
const actividad = ACTIVITIES[tipoActividad] || ACTIVITIES.cuestionario;
document.title = `${actividad.nombre} — Generador de Actividades`;

// ====== UTILIDADES ======
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('toast--visible');
  setTimeout(() => el.classList.remove('toast--visible'), 2500);
}

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    toast('¡Copiado al portapapeles!');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = texto;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('¡Copiado!');
  }
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function nombreArchivo() {
  return (tituloQuiz || 'actividad').replace(/\s+/g, '_');
}

// ====== TABS DE MODO ======
const tabs = document.querySelectorAll('.tab-modo');
const paneles = document.querySelectorAll('.panel-modo');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const modo = tab.dataset.modo;
    tabs.forEach(t => t.classList.toggle('active', t === tab));
    paneles.forEach(p => {
      p.style.display = p.id === `panel-${modo}` ? 'block' : 'none';
    });
  });
});

// ====== MODO VISUAL (H5P-style) ======
const editorVisual = new EditorVisual(
  document.getElementById('vePreguntas'),
  (prgs) => {
    preguntas = prgs;
    actualizarDescargas();
  }
);

// Mostrar el estado vacío desde el arranque (evita un área en blanco confusa)
editorVisual.render();

// Botones agregar pregunta
document.querySelectorAll('.ve-agregar-tipo').forEach(btn => {
  btn.addEventListener('click', () => {
    editorVisual.agregarPregunta(btn.dataset.tipo);
  });
});

// Botón ordenar preguntas
document.getElementById('btnOrdenar')?.addEventListener('click', () => {
  editorVisual.abrirOrdenador();
});

// Título y nivel del editor visual
document.getElementById('veTitulo')?.addEventListener('input', (e) => {
  tituloQuiz = e.target.value.trim();
});
document.getElementById('veNivel')?.addEventListener('input', (e) => {
  nivelQuiz = e.target.value.trim();
});

// ====== MODO TEXTO (Aiken / Extendido) ======
document.getElementById('btnProcesarTexto')?.addEventListener('click', () => {
  const texto = document.getElementById('textareaTexto').value.trim();
  if (!texto) {
    toast('Che, pegá o escribí el texto primero.');
    return;
  }

  const resultado = parsear(texto);
  preguntas = resultado.preguntas;
  tituloQuiz = resultado.titulo || document.getElementById('veTitulo')?.value.trim() || 'Cuestionario';
  nivelQuiz = resultado.nivel || '';

  const advDiv = document.getElementById('advertenciasTexto');
  advDiv.innerHTML = '';

  if (resultado.advertencias.length > 0) {
    resultado.advertencias.forEach(adv => {
      const div = document.createElement('div');
      div.className = 'alerta alerta--aviso';
      div.innerHTML = adv.mensaje;
      advDiv.appendChild(div);
    });
  }

  if (preguntas.length === 0) {
    const div = document.createElement('div');
    div.className = 'alerta alerta--error';
    div.textContent = 'No se encontraron preguntas. Revisá que el texto siga el formato Aiken o el formato extendido.';
    advDiv.appendChild(div);
    return;
  }

  const fmt = resultado.formato === 'aiken' ? 'Aiken' : 'extendido';
  const exito = document.createElement('div');
  exito.className = 'alerta alerta--exito';
  exito.textContent = `${preguntas.length} pregunta${preguntas.length > 1 ? 's' : ''} detectadas (formato ${fmt}). Revisalas abajo.`;
  advDiv.insertBefore(exito, advDiv.firstChild);

  // Cargar en editor visual para edición
  editorVisual.cargarPreguntas(preguntas);

  // Cambiar a tab visual
  tabs.forEach(t => t.classList.toggle('active', t.dataset.modo === 'visual'));
  paneles.forEach(p => {
    p.style.display = p.id === 'panel-visual' ? 'block' : 'none';
  });

  actualizarDescargas();
  document.getElementById('seccionDescargas').style.display = 'block';
  document.getElementById('seccionDescargas').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ====== MODO IA ======
// Poblar checkboxes de tipos
const checksTipos = document.getElementById('checksTipos');
if (checksTipos) {
  actividad.tiposPreguntaPermitidos.forEach(tipo => {
    const label = document.createElement('label');
    label.className = 'campo__check campo__check--activo';
    label.innerHTML = `<input type="checkbox" value="${tipo}" checked> ${TIPOS_PREGUNTA[tipo] || tipo}`;
    checksTipos.appendChild(label);
  });

  checksTipos.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox') {
      e.target.closest('.campo__check').classList.toggle('campo__check--activo', e.target.checked);
    }
  });
}

let ultimoPrompt = '';

document.getElementById('formPrompt')?.addEventListener('submit', (e) => {
  e.preventDefault();

  const tiposSeleccionados = Array.from(checksTipos.querySelectorAll('input:checked')).map(i => i.value);
  if (tiposSeleccionados.length === 0) {
    toast('Che, seleccioná al menos un tipo de pregunta.');
    return;
  }

  ultimoPrompt = generarPrompt({
    tema: document.getElementById('iaTema').value.trim(),
    nivel: document.getElementById('iaNivel').value.trim(),
    cantidad: document.getElementById('iaCantidad').value,
    tipos: tiposSeleccionados,
    dificultad: document.getElementById('iaDificultad').value,
    idioma: document.getElementById('iaIdioma').value,
    contexto: document.getElementById('iaContexto').value.trim(),
    notas: document.getElementById('iaNotas').value.trim(),
    promptHints: actividad.promptHints
  });

  const caja = document.getElementById('cajaPrompt');
  caja.textContent = ultimoPrompt;
  caja.classList.add('caja-prompt--visible');
  document.getElementById('accionesPrompt').style.display = 'flex';
  document.getElementById('textareaPromptCustom').value = ultimoPrompt;
});

document.getElementById('btnCopiarPrompt')?.addEventListener('click', () => copiar(ultimoPrompt));

document.getElementById('btnModoPersonalizado')?.addEventListener('click', () => {
  const el = document.getElementById('promptPersonalizado');
  const visible = el.style.display !== 'none';
  el.style.display = visible ? 'none' : 'block';
  if (!visible && ultimoPrompt) {
    document.getElementById('textareaPromptCustom').value = ultimoPrompt;
  }
});

document.getElementById('btnCopiarCustom')?.addEventListener('click', () => {
  copiar(document.getElementById('textareaPromptCustom').value);
});

document.getElementById('btnProcesarIA')?.addEventListener('click', () => {
  const texto = document.getElementById('textareaRespuestaIA').value.trim();
  if (!texto) {
    toast('Che, pegá primero lo que te devolvió la IA.');
    return;
  }

  const resultado = parsear(texto);
  preguntas = resultado.preguntas;
  tituloQuiz = resultado.titulo || document.getElementById('iaTema')?.value.trim() || 'Cuestionario';
  nivelQuiz = resultado.nivel || '';

  const advDiv = document.getElementById('advertenciasIA');
  advDiv.innerHTML = '';

  resultado.advertencias.forEach(adv => {
    const div = document.createElement('div');
    div.className = 'alerta alerta--aviso';
    div.innerHTML = adv.mensaje;
    advDiv.appendChild(div);
  });

  if (preguntas.length === 0) {
    const div = document.createElement('div');
    div.className = 'alerta alerta--error';
    div.textContent = 'No se encontraron preguntas.';
    advDiv.appendChild(div);
    return;
  }

  const exito = document.createElement('div');
  exito.className = 'alerta alerta--exito';
  exito.textContent = `${preguntas.length} pregunta${preguntas.length > 1 ? 's' : ''} importadas. Revisalas en el editor visual.`;
  advDiv.insertBefore(exito, advDiv.firstChild);

  editorVisual.cargarPreguntas(preguntas);
  tabs.forEach(t => t.classList.toggle('active', t.dataset.modo === 'visual'));
  paneles.forEach(p => {
    p.style.display = p.id === 'panel-visual' ? 'block' : 'none';
  });

  actualizarDescargas();
  document.getElementById('seccionDescargas').style.display = 'block';
  document.getElementById('seccionDescargas').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ====== IMÁGENES ======
const dropZone = document.getElementById('dropZone');
const inputImagenes = document.getElementById('inputImagenes');

if (dropZone && inputImagenes) {
  dropZone.addEventListener('click', () => inputImagenes.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('panel-imagenes--activo'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('panel-imagenes--activo'));
  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('panel-imagenes--activo');
    const errores = await gestorImg.cargarArchivos(e.dataTransfer.files);
    errores.forEach(err => toast(err));
    gestorImg.renderPanel(document.getElementById('listaTokensImg'));
  });
  inputImagenes.addEventListener('change', async () => {
    const errores = await gestorImg.cargarArchivos(inputImagenes.files);
    errores.forEach(err => toast(err));
    gestorImg.renderPanel(document.getElementById('listaTokensImg'));
  });
}

// ====== VALIDACIÓN PRE-DESCARGA ======
// Evita que se exporten preguntas incompletas (la causa típica de que
// Schoology "no muestre las opciones": opciones vacías que se filtran).
function validarPreguntas() {
  const problemas = [];
  preguntas.forEach((p, i) => {
    const n = p.numero || (i + 1);
    if (!p.enunciado || !p.enunciado.trim()) {
      problemas.push(`P${n}: falta el enunciado.`);
    }
    if (p.tipo === 'opcion_multiple') {
      const ops = (p.opciones || []).filter(o => (o.texto || '').trim() !== '');
      if (ops.length < 2) {
        problemas.push(`P${n} (opción múltiple): escribí al menos 2 opciones con texto.`);
      } else if (!ops.some(o => o.correcta)) {
        problemas.push(`P${n} (opción múltiple): marcá cuál es la opción correcta.`);
      }
    }
    if (p.tipo === 'respuesta_corta') {
      const rs = (p.respuestasAceptadas || []).filter(r => (r || '').trim() !== '');
      if (rs.length === 0) problemas.push(`P${n} (respuesta corta): agregá al menos una respuesta aceptada.`);
    }
    if (p.tipo === 'numerica' && (p.respuestaCorrecta === null || p.respuestaCorrecta === undefined || p.respuestaCorrecta === '')) {
      problemas.push(`P${n} (numérica): falta la respuesta correcta.`);
    }
    if (p.tipo === 'emparejamiento') {
      const pares = (p.pares || []).filter(par => (par.izquierda || '').trim() && (par.derecha || '').trim());
      if (pares.length < 2) problemas.push(`P${n} (emparejamiento): completá al menos 2 pares.`);
    }
    if (p.tipo === 'ordenamiento') {
      const items = (p.items || []).filter(t => (t || '').trim());
      if (items.length < 2) problemas.push(`P${n} (ordenamiento): cargá al menos 2 elementos.`);
    }
    if (p.tipo === 'completar' || p.tipo === 'seleccion_inline') {
      const huecos = (p.plantilla || '').match(/\[\[[^\]]+\]\]/g) || [];
      if (huecos.length === 0) problemas.push(`P${n} (${p.tipo === 'completar' ? 'completar' : 'selección inline'}): marcá al menos un hueco con [[...]].`);
      if (p.tipo === 'seleccion_inline' && huecos.some(h => !h.includes('|'))) {
        problemas.push(`P${n} (selección inline): cada hueco necesita al menos 2 opciones separadas por |.`);
      }
    }
  });
  return problemas;
}

function confirmarExport() {
  const problemas = validarPreguntas();
  if (problemas.length === 0) return true;
  return confirm('Antes de descargar, revisá estos puntos:\n\n• ' + problemas.join('\n• ') + '\n\n¿Querés descargar igual?');
}

// ====== DESCARGAS ======
function actualizarDescargas() {
  const seccion = document.getElementById('seccionDescargas');
  if (preguntas.length > 0) {
    seccion.style.display = 'block';
    // Panel de tokens [IMG: ...] — sólo aparece si el texto importado los trae.
    // Las imágenes que se suben desde el editor visual se manejan por pregunta.
    gestorImg.setTokens(preguntas);
    const panel = document.getElementById('panelImagenes');
    if (gestorImg.tokens.length > 0) {
      panel.style.display = 'block';
      gestorImg.renderPanel(document.getElementById('listaTokensImg'));
    } else {
      panel.style.display = 'none';
    }
  }
}

// Funciones de exportación reutilizables (las usan tanto el selector de
// plataforma como los botones de "formatos avanzados").
async function exportarImscc() {
  if (!preguntas.length) return;
  if (!confirmarExport()) return;
  try {
    const blob = await generarIMSCC(preguntas, tituloQuiz, gestorImg);
    descargar(blob, `${nombreArchivo()}.imscc`);
    toast('¡Archivo .imscc descargado!');
  } catch (err) {
    toast('Error: ' + err.message);
  }
}

function exportarGift() {
  if (!preguntas.length) return;
  if (!confirmarExport()) return;
  descargar(new Blob([generarGIFT(preguntas, tituloQuiz)], { type: 'text/plain;charset=utf-8' }), `${nombreArchivo()}.gift.txt`);
  toast('¡Archivo GIFT descargado!');
}

function exportarMoodleXml() {
  if (!preguntas.length) return;
  if (!confirmarExport()) return;
  descargar(new Blob([generarMoodleXML(preguntas, tituloQuiz)], { type: 'application/xml;charset=utf-8' }), `${nombreArchivo()}_moodle.xml`);
  toast('¡Archivo Moodle XML descargado!');
}

function exportarAppsScript() {
  if (!preguntas.length) return;
  if (!confirmarExport()) return;
  descargar(new Blob([generarAppsScript(preguntas, tituloQuiz)], { type: 'text/javascript;charset=utf-8' }), `${nombreArchivo()}_classroom.gs`);
  toast('¡Script descargado!');
}

async function exportarQti21() {
  if (!preguntas.length) return;
  if (!confirmarExport()) return;
  try {
    const blob = await generarQTI21Zip(preguntas, tituloQuiz, gestorImg);
    descargar(blob, `${nombreArchivo()}_qti21.zip`);
    toast('¡Paquete QTI 2.1 descargado!');
  } catch (err) {
    toast('Error: ' + err.message);
  }
}

function exportarBorrador() {
  if (!preguntas.length) return;
  descargar(new Blob([exportarJSON(preguntas, tituloQuiz, nivelQuiz)], { type: 'application/json;charset=utf-8' }), `${nombreArchivo()}_borrador.json`);
  toast('¡Borrador JSON guardado!');
}

// Cada plataforma se mapea al formato correcto.
const EXPORT_POR_PLATAFORMA = {
  crea: { fn: exportarImscc, msg: 'CREA usa el paquete .imscc (Common Cartridge). Importalo desde tu curso → Importar.' },
  schoology: { fn: exportarImscc, msg: 'Schoology usa el paquete .imscc. Importalo desde Course Options → Import.' },
  moodle: { fn: exportarMoodleXml, msg: 'Para Moodle te damos el XML (el más completo). Importalo en Banco de preguntas → Importar.' },
  classroom: { fn: exportarAppsScript, msg: 'Para Google Classroom te damos un script Apps Script que crea el Google Form.' }
};

document.querySelectorAll('[data-plataforma]').forEach(btn => {
  btn.addEventListener('click', () => {
    const cfg = EXPORT_POR_PLATAFORMA[btn.dataset.plataforma];
    if (!cfg) return;
    if (!preguntas.length) { toast('Primero cargá al menos una pregunta.'); return; }
    toast(cfg.msg);
    cfg.fn();
  });
});

// Vista previa por plataforma
document.querySelectorAll('[data-preview]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!preguntas.length) { toast('Primero cargá al menos una pregunta.'); return; }
    const ok = abrirVistaPrevia(btn.dataset.preview, preguntas, tituloQuiz);
    if (ok) {
      toast('Vista previa abierta en una nueva pestaña.');
    } else {
      toast('El navegador bloqueó la pestaña. Permití las ventanas emergentes para este sitio.');
    }
  });
});

// Botones de formatos avanzados (opcionales)
document.getElementById('btnImscc')?.addEventListener('click', exportarImscc);
document.getElementById('btnGift')?.addEventListener('click', exportarGift);
document.getElementById('btnMoodleXml')?.addEventListener('click', exportarMoodleXml);
document.getElementById('btnQti21')?.addEventListener('click', exportarQti21);
document.getElementById('btnAppsScript')?.addEventListener('click', exportarAppsScript);
document.getElementById('btnJson')?.addEventListener('click', exportarBorrador);

// Importar JSON
document.getElementById('btnImportarJson')?.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', async () => {
    try {
      const texto = await input.files[0].text();
      const data = importarJSON(texto);
      preguntas = data.preguntas;
      tituloQuiz = data.titulo;
      nivelQuiz = data.nivel;
      if (document.getElementById('veTitulo')) document.getElementById('veTitulo').value = tituloQuiz;
      if (document.getElementById('veNivel')) document.getElementById('veNivel').value = nivelQuiz;
      editorVisual.cargarPreguntas(preguntas);
      actualizarDescargas();
      toast(`¡Borrador cargado: ${preguntas.length} preguntas!`);
    } catch (err) {
      toast('Error al leer el archivo: ' + err.message);
    }
  });
  input.click();
});
