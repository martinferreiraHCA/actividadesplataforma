// Router principal del editor
import { ACTIVITIES, TIPOS_PREGUNTA } from './activities.js';
import { generarPrompt } from './prompt-generator.js';
import { parsear } from './parser.js';
import { renderPreguntas } from './preview.js';
import { GestorImagenes } from './images.js';
import { generarIMSCC } from './export/commoncartridge.js';
import { generarGIFT } from './export/gift.js';
import { generarMoodleXML } from './export/moodlexml.js';
import { generarAppsScript } from './export/appsscript.js';
import { exportarJSON, importarJSON } from './export/json.js';

// Estado global
let preguntas = [];
let tituloQuiz = '';
let nivelQuiz = '';
const gestorImg = new GestorImagenes();

// Leer tipo de actividad de la URL
const params = new URLSearchParams(window.location.search);
const tipoActividad = params.get('tipo') || 'cuestionario';
const actividad = ACTIVITIES[tipoActividad] || ACTIVITIES.cuestionario;

// Configurar título de la página
document.title = `${actividad.nombre} — Generador de Actividades`;

// Poblar checkboxes de tipos de pregunta
const checksTipos = document.getElementById('checksTipos');
actividad.tiposPreguntaPermitidos.forEach(tipo => {
  const label = document.createElement('label');
  label.className = 'campo__check campo__check--activo';
  label.innerHTML = `
    <input type="checkbox" value="${tipo}" checked>
    ${TIPOS_PREGUNTA[tipo] || tipo}
  `;
  checksTipos.appendChild(label);
});

// Listeners para estilo activo en checks
checksTipos.addEventListener('change', (e) => {
  if (e.target.type === 'checkbox') {
    e.target.closest('.campo__check').classList.toggle('campo__check--activo', e.target.checked);
  }
});

// Toast
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('toast--visible');
  setTimeout(() => el.classList.remove('toast--visible'), 2500);
}

// Copiar al portapapeles
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

// Descargar archivo
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

// ====== PASO 1: Generar prompt ======
const formPrompt = document.getElementById('formPrompt');
const cajaPrompt = document.getElementById('cajaPrompt');
const accionesPrompt = document.getElementById('accionesPrompt');
const promptPersonalizado = document.getElementById('promptPersonalizado');
let ultimoPrompt = '';

formPrompt.addEventListener('submit', (e) => {
  e.preventDefault();

  const tiposSeleccionados = Array.from(checksTipos.querySelectorAll('input:checked')).map(i => i.value);
  if (tiposSeleccionados.length === 0) {
    toast('Che, seleccioná al menos un tipo de pregunta.');
    return;
  }

  ultimoPrompt = generarPrompt({
    tema: document.getElementById('tema').value.trim(),
    nivel: document.getElementById('nivel').value.trim(),
    cantidad: document.getElementById('cantidad').value,
    tipos: tiposSeleccionados,
    dificultad: document.getElementById('dificultad').value,
    idioma: document.getElementById('idioma').value,
    contexto: document.getElementById('contexto').value.trim(),
    notas: document.getElementById('notas').value.trim(),
    promptHints: actividad.promptHints
  });

  cajaPrompt.textContent = ultimoPrompt;
  cajaPrompt.classList.add('caja-prompt--visible');
  accionesPrompt.style.display = 'flex';

  document.getElementById('textareaPromptCustom').value = ultimoPrompt;
});

document.getElementById('btnCopiarPrompt').addEventListener('click', () => {
  copiar(ultimoPrompt);
});

document.getElementById('btnModoPersonalizado').addEventListener('click', () => {
  const visible = promptPersonalizado.style.display !== 'none';
  promptPersonalizado.style.display = visible ? 'none' : 'block';
  if (!visible && ultimoPrompt) {
    document.getElementById('textareaPromptCustom').value = ultimoPrompt;
  }
});

document.getElementById('btnCopiarCustom').addEventListener('click', () => {
  copiar(document.getElementById('textareaPromptCustom').value);
});

// ====== PASO 2: Procesar respuesta ======
document.getElementById('btnProcesar').addEventListener('click', () => {
  const texto = document.getElementById('textareaRespuesta').value.trim();
  if (!texto) {
    toast('Che, pegá primero lo que te devolvió la IA.');
    return;
  }

  const resultado = parsear(texto);
  preguntas = resultado.preguntas;
  tituloQuiz = resultado.titulo || document.getElementById('tema').value.trim() || 'Cuestionario';
  nivelQuiz = resultado.nivel || document.getElementById('nivel').value.trim();

  // Mostrar advertencias
  const advDiv = document.getElementById('advertencias');
  advDiv.innerHTML = '';
  if (resultado.advertencias.length > 0) {
    resultado.advertencias.forEach(adv => {
      const div = document.createElement('div');
      div.className = 'alerta alerta--aviso';
      div.textContent = `⚠️ Línea ${adv.linea}: ${adv.mensaje}`;
      advDiv.appendChild(div);
    });
  }

  if (preguntas.length === 0) {
    const div = document.createElement('div');
    div.className = 'alerta alerta--error';
    div.textContent = 'No se encontraron preguntas. Revisá que el texto siga el formato estándar (## P1 :: tipo).';
    advDiv.appendChild(div);
    return;
  }

  // Éxito
  const exito = document.createElement('div');
  exito.className = 'alerta alerta--exito';
  exito.textContent = `✅ Se encontraron ${preguntas.length} pregunta${preguntas.length > 1 ? 's' : ''}. ¡Revisalas abajo!`;
  advDiv.insertBefore(exito, advDiv.firstChild);

  // Mostrar Paso 3
  document.getElementById('paso3').style.display = 'block';
  renderPreguntas(preguntas, document.getElementById('previewPreguntas'));

  // Imágenes
  gestorImg.setTokens(preguntas);
  if (gestorImg.tokens.length > 0) {
    document.getElementById('panelImagenes').style.display = 'block';
    gestorImg.renderPanel(document.getElementById('listaTokensImg'));
  }

  document.getElementById('paso3').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ====== IMÁGENES: drag & drop ======
const dropZone = document.getElementById('dropZone');
const inputImagenes = document.getElementById('inputImagenes');

dropZone.addEventListener('click', () => inputImagenes.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('panel-imagenes--activo');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('panel-imagenes--activo');
});

dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.classList.remove('panel-imagenes--activo');
  const errores = await gestorImg.cargarArchivos(e.dataTransfer.files);
  if (errores.length) errores.forEach(err => toast(err));
  gestorImg.renderPanel(document.getElementById('listaTokensImg'));
});

inputImagenes.addEventListener('change', async () => {
  const errores = await gestorImg.cargarArchivos(inputImagenes.files);
  if (errores.length) errores.forEach(err => toast(err));
  gestorImg.renderPanel(document.getElementById('listaTokensImg'));
});

// ====== PASO 3: Descargas ======
document.getElementById('btnImscc').addEventListener('click', async () => {
  if (!preguntas.length) return;
  try {
    const blob = await generarIMSCC(preguntas, tituloQuiz, gestorImg);
    descargar(blob, `${tituloQuiz.replace(/\s+/g, '_')}.imscc`);
    toast('¡Archivo .imscc descargado!');
  } catch (err) {
    toast('Error al generar el .imscc: ' + err.message);
  }
});

document.getElementById('btnGift').addEventListener('click', () => {
  if (!preguntas.length) return;
  const txt = generarGIFT(preguntas, tituloQuiz);
  descargar(new Blob([txt], { type: 'text/plain;charset=utf-8' }), `${tituloQuiz.replace(/\s+/g, '_')}.gift.txt`);
  toast('¡Archivo GIFT descargado!');
});

document.getElementById('btnMoodleXml').addEventListener('click', () => {
  if (!preguntas.length) return;
  const xml = generarMoodleXML(preguntas, tituloQuiz);
  descargar(new Blob([xml], { type: 'application/xml;charset=utf-8' }), `${tituloQuiz.replace(/\s+/g, '_')}_moodle.xml`);
  toast('¡Archivo Moodle XML descargado!');
});

document.getElementById('btnAppsScript').addEventListener('click', () => {
  if (!preguntas.length) return;
  const script = generarAppsScript(preguntas, tituloQuiz);
  descargar(new Blob([script], { type: 'text/javascript;charset=utf-8' }), `${tituloQuiz.replace(/\s+/g, '_')}_classroom.gs`);
  toast('¡Script de Apps Script descargado!');
});

document.getElementById('btnJson').addEventListener('click', () => {
  if (!preguntas.length) return;
  const json = exportarJSON(preguntas, tituloQuiz, nivelQuiz);
  descargar(new Blob([json], { type: 'application/json;charset=utf-8' }), `${tituloQuiz.replace(/\s+/g, '_')}_borrador.json`);
  toast('¡Borrador JSON guardado!');
});
