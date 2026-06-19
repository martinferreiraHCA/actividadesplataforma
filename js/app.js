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
      div.innerHTML = `⚠️ ${adv.mensaje}`;
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
  exito.textContent = `✅ ${preguntas.length} pregunta${preguntas.length > 1 ? 's' : ''} detectadas (formato ${fmt}). ¡Revisalas abajo!`;
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
    div.innerHTML = `⚠️ ${adv.mensaje}`;
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
  exito.textContent = `✅ ${preguntas.length} pregunta${preguntas.length > 1 ? 's' : ''} importadas. ¡Revisalas en el editor visual!`;
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

// ====== DESCARGAS ======
function actualizarDescargas() {
  const seccion = document.getElementById('seccionDescargas');
  if (preguntas.length > 0) {
    seccion.style.display = 'block';
    gestorImg.setTokens(preguntas);
    if (gestorImg.tokens.length > 0) {
      document.getElementById('panelImagenes').style.display = 'block';
      gestorImg.renderPanel(document.getElementById('listaTokensImg'));
    }
  }
}

document.getElementById('btnImscc')?.addEventListener('click', async () => {
  if (!preguntas.length) return;
  try {
    const blob = await generarIMSCC(preguntas, tituloQuiz, gestorImg);
    descargar(blob, `${nombreArchivo()}.imscc`);
    toast('¡Archivo .imscc descargado!');
  } catch (err) {
    toast('Error: ' + err.message);
  }
});

document.getElementById('btnGift')?.addEventListener('click', () => {
  if (!preguntas.length) return;
  descargar(new Blob([generarGIFT(preguntas, tituloQuiz)], { type: 'text/plain;charset=utf-8' }), `${nombreArchivo()}.gift.txt`);
  toast('¡Archivo GIFT descargado!');
});

document.getElementById('btnMoodleXml')?.addEventListener('click', () => {
  if (!preguntas.length) return;
  descargar(new Blob([generarMoodleXML(preguntas, tituloQuiz)], { type: 'application/xml;charset=utf-8' }), `${nombreArchivo()}_moodle.xml`);
  toast('¡Archivo Moodle XML descargado!');
});

document.getElementById('btnAppsScript')?.addEventListener('click', () => {
  if (!preguntas.length) return;
  descargar(new Blob([generarAppsScript(preguntas, tituloQuiz)], { type: 'text/javascript;charset=utf-8' }), `${nombreArchivo()}_classroom.gs`);
  toast('¡Script descargado!');
});

document.getElementById('btnJson')?.addEventListener('click', () => {
  if (!preguntas.length) return;
  descargar(new Blob([exportarJSON(preguntas, tituloQuiz, nivelQuiz)], { type: 'application/json;charset=utf-8' }), `${nombreArchivo()}_borrador.json`);
  toast('¡Borrador JSON guardado!');
});

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
