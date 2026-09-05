// Pieza 3D con IA — página: narración (texto o voz) → prompt técnico → IA →
// OpenSCAD paramétrico editable con vista previa 3D y STL.

import * as THREE from 'three';
import { OrbitControls } from './lego/vendor/OrbitControls.js';
import { generarPromptPieza, generarPromptAjuste, analizarNarracion } from './ia3d-prompt.js';
import { parsearVariables, clasificarVariables, aplicarValor, valorATexto, rangoSugerido, extraerCodigo, resumirSalida, aStlBinario, formatearNumero } from './ia3d-scad.js';

const $ = id => document.getElementById(id);
const CLAVE = 'ia3d-proyecto-v1';
const URL_OPENSCAD = new URLSearchParams(location.search).get('openscad') || 'https://cdn.jsdelivr.net/npm/openscad-wasm-prebuilt@1.2.0/dist/openscad.js';
const FUENTES = ['LiberationSans-Regular.ttf', 'LiberationSans-Bold.ttf', 'LiberationMono-Regular.ttf'].map(n => new URL('./ia3d/fuentes/' + n, location.href).href);
const NOMBRES_FUENTES = ['Liberation Sans', 'Liberation Sans:style=Bold', 'Liberation Mono'];
const LIMITE_URL = 7000;

function toast(msg) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('toast--visible');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('toast--visible'), 3200);
}

function descargar(nombre, datos, tipo) {
  const blob = datos instanceof Blob ? datos : new Blob([datos], { type: tipo || 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = texto;
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    ta.remove();
    return ok;
  }
}

function debounce(fn, ms) {
  let t = null;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------
const estado = {
  textos: [],
  prompt: '',
  promptAjuste: '',
  codigo: '',
  codigoOriginal: '',
  variables: [],
  grupos: [],
  ultimoRender: null, // { posiciones, min, max, triangulos }
  salida: []
};

const EJEMPLO_NARRACION = `Quiero un portacelular de escritorio para un teléfono de 75 × 160 × 9 mm, con funda puesta puede llegar a 11 mm de espesor.
Es una sola pieza. La base es un prisma rectangular de 90 mm de ancho (eje X) por 70 mm de profundidad (eje Y) y 8 mm de alto, con las cuatro esquinas verticales redondeadas con radio 6 mm y un chaflán de 0,8 mm en la arista de apoyo.
Desde el borde trasero de la base sube un respaldo inclinado 70° respecto de la mesa (se recuesta hacia atrás), de 90 mm de ancho, 100 mm de largo y 6 mm de espesor, unido a la base sin escalón.
Adelante, a 30 mm del borde frontal de la base, hay un tope de 12 mm de alto y 8 mm de espesor que forma con el respaldo una ranura de 12 mm donde apoya el teléfono. El tope tiene en el centro un canal pasante de 12 mm de ancho para el cable del cargador, que también atraviesa la base hacia abajo con un agujero de 12 × 8 mm.
En el frente del respaldo, centrado y a 30 mm del borde superior, va el texto "6º A" en relieve de 0,8 mm, letras de 12 mm de alto. En la cara superior de la base, adelante del tope, va grabado el texto "HCA" con letras de 6 mm y 0,6 mm de profundidad.
Se imprime en PLA apoyado sobre la base, sin soportes. Quiero poder cambiar después el ángulo del respaldo, el ancho de la ranura, los textos y su tamaño.`;

const EJEMPLO_SCAD = `// Portacelular de escritorio — base con respaldo inclinado, tope con canal para el cable y textos
// Orientación: apoya en z = 0. Origen: centro de la planta (x = 0, y = 0).
// Módulos: cuerpo(), detalles(), textos(), pieza()

/* [Dimensiones generales] */
// Ancho total de la base (eje X), en mm
ancho_base = 90; // [40:0.5:200]
// Profundidad de la base (eje Y), en mm
profundidad_base = 70; // [40:0.5:200]
// Alto de la base, en mm
alto_base = 8; // [4:0.5:30]
// Radio de las esquinas verticales de la base, en mm
radio_esquinas = 6; // [0:0.5:20]
// Largo del respaldo medido sobre su inclinación, en mm
largo_respaldo = 100; // [30:1:200]
// Espesor del respaldo, en mm
espesor_respaldo = 6; // [3:0.5:15]
// Ángulo del respaldo respecto de la mesa, en grados (90 = vertical)
angulo_respaldo = 70; // [45:1:90]

/* [Detalles] */
// Ancho de la ranura donde apoya el teléfono, en mm
ancho_ranura = 12; // [6:0.5:25]
// Alto del tope frontal, en mm
alto_tope = 12; // [4:0.5:40]
// Espesor del tope frontal, en mm
espesor_tope = 8; // [3:0.5:20]
// Ancho del canal para el cable, en mm
ancho_canal = 12; // [4:0.5:30]
// Profundidad del agujero del cable en la base (eje Y), en mm
largo_agujero_cable = 8; // [4:0.5:30]

/* [Posiciones] */
// Posición del tope frontal desde el origen, en mm [x, y, z]
pos_tope = [0, -5, 0];
// Posición del texto 1 sobre el respaldo (x a lo ancho, y a lo largo del respaldo desde su base), en mm
pos_texto_1 = [0, 70, 0];
// Posición del texto 2 sobre la base, en mm [x, y, z]
pos_texto_2 = [0, -22, 0];

/* [Textos] */
// Mostrar el texto 1
mostrar_texto_1 = true;
// Texto 1 (frente del respaldo)
texto_1 = "6º A";
// Altura de la letra del texto 1, en mm
alto_letra_1 = 12; // [3:0.5:40]
// Relieve del texto 1 en mm (negativo = grabado)
relieve_texto_1 = 0.8; // [-3:0.1:3]
// Fuente del texto 1
fuente_texto_1 = "Liberation Sans:style=Bold";
// Rotación del texto 1 en su plano, en grados
rot_texto_1 = [0, 0, 0];
// Mostrar el texto 2
mostrar_texto_2 = true;
// Texto 2 (cara superior de la base)
texto_2 = "HCA";
// Altura de la letra del texto 2, en mm
alto_letra_2 = 6; // [3:0.5:30]
// Relieve del texto 2 en mm (negativo = grabado)
relieve_texto_2 = -0.6; // [-3:0.1:3]
// Fuente del texto 2
fuente_texto_2 = "Liberation Sans:style=Bold";
// Rotación del texto 2 en su plano, en grados
rot_texto_2 = [0, 0, 0];

/* [Fabricación] */
// Holgura por lado para encastres y agujeros, en mm
holgura = 0.2; // [0:0.05:1]
// Espesor de pared mínimo de referencia, en mm
espesor_pared = 1.6; // [0.8:0.1:6]
// Chaflán de la arista de apoyo, en mm
chaflan_base = 0.8; // [0:0.1:3]

/* [Calidad] */
// Segmentos por círculo (más = más suave, más lento)
calidad = 64; // [16:8:192]

/* [Hidden] */
$fn = calidad;
epsilon = 0.01;
y_trasero = profundidad_base / 2;

assert(ancho_canal < ancho_base - 2 * espesor_pared, "el canal del cable no cabe en el ancho de la base");
assert(radio_esquinas * 2 <= min(ancho_base, profundidad_base), "el radio de las esquinas es demasiado grande");

module base_redondeada(ancho, prof, alto, r) {
    hull() for (sx = [-1, 1], sy = [-1, 1])
        translate([sx * (ancho / 2 - r), sy * (prof / 2 - r), 0]) cylinder(h = alto, r = r);
}

module cuerpo() {
    difference() {
        base_redondeada(ancho_base, profundidad_base, alto_base, radio_esquinas);
        // chaflán de la arista de apoyo
        if (chaflan_base > 0) difference() {
            translate([0, 0, -epsilon]) cube([ancho_base + 2, profundidad_base + 2, chaflan_base * 2], center = true);
            translate([0, 0, -chaflan_base]) base_redondeada(ancho_base - 2 * chaflan_base, profundidad_base - 2 * chaflan_base, chaflan_base * 2, max(radio_esquinas - chaflan_base, 0.1));
            translate([0, 0, chaflan_base]) base_redondeada(ancho_base, profundidad_base, chaflan_base * 2, radio_esquinas);
        }
    }
    // respaldo inclinado, apoyado en el borde trasero
    translate([0, y_trasero - espesor_respaldo, alto_base - epsilon])
        rotate([angulo_respaldo - 90, 0, 0])
            translate([-ancho_base / 2, 0, 0]) cube([ancho_base, espesor_respaldo, largo_respaldo]);
    // tope frontal
    translate(pos_tope) translate([-ancho_base / 2, -espesor_tope / 2, alto_base - epsilon]) cube([ancho_base, espesor_tope, alto_tope]);
}

module detalles() {
    // canal del cable en el tope y agujero en la base
    translate(pos_tope) translate([-ancho_canal / 2, -espesor_tope / 2 - epsilon, alto_base - epsilon]) cube([ancho_canal, espesor_tope + 2 * epsilon, alto_tope + 2 * epsilon]);
    translate(pos_tope) translate([-ancho_canal / 2, -largo_agujero_cable / 2, -epsilon]) cube([ancho_canal, largo_agujero_cable, alto_base + 2 * epsilon]);
}

module texto_plano(t, alto, fuente) {
    text(t, size = alto, font = fuente, halign = "center", valign = "center");
}

module textos_relieve() {
    if (mostrar_texto_1 && relieve_texto_1 > 0)
        translate([0, y_trasero - espesor_respaldo, alto_base]) rotate([angulo_respaldo - 90, 0, 0])
            translate([pos_texto_1[0], -epsilon, pos_texto_1[1]]) rotate([90, 0, 0]) rotate(rot_texto_1)
                linear_extrude(relieve_texto_1 + epsilon) texto_plano(texto_1, alto_letra_1, fuente_texto_1);
    if (mostrar_texto_2 && relieve_texto_2 > 0)
        translate([pos_texto_2[0], pos_texto_2[1], alto_base - epsilon]) rotate(rot_texto_2)
            linear_extrude(relieve_texto_2 + epsilon) texto_plano(texto_2, alto_letra_2, fuente_texto_2);
}

module textos_grabado() {
    if (mostrar_texto_1 && relieve_texto_1 < 0)
        translate([0, y_trasero - espesor_respaldo, alto_base]) rotate([angulo_respaldo - 90, 0, 0])
            translate([pos_texto_1[0], -relieve_texto_1, pos_texto_1[1]]) rotate([90, 0, 0]) rotate(rot_texto_1)
                linear_extrude(-relieve_texto_1 + epsilon) texto_plano(texto_1, alto_letra_1, fuente_texto_1);
    if (mostrar_texto_2 && relieve_texto_2 < 0)
        translate([pos_texto_2[0], pos_texto_2[1], alto_base + relieve_texto_2]) rotate(rot_texto_2)
            linear_extrude(-relieve_texto_2 + epsilon) texto_plano(texto_2, alto_letra_2, fuente_texto_2);
}

module pieza() {
    difference() {
        union() { cuerpo(); textos_relieve(); }
        detalles();
        textos_grabado();
    }
}

pieza();
echo(str("Medidas exteriores aprox.: ", ancho_base, " x ", profundidad_base + cos(angulo_respaldo) * largo_respaldo, " x ", alto_base + sin(angulo_respaldo) * largo_respaldo, " mm"));
`;

// ---------------------------------------------------------------------------
// Ficha: textos dinámicos
// ---------------------------------------------------------------------------
function dibujarTextos() {
  const cont = $('listaTextos');
  cont.innerHTML = '';
  estado.textos.forEach((t, i) => {
    const div = document.createElement('div');
    div.className = 'ia3-texto-item';
    div.innerHTML = `
      <input class="campo__input ia3-texto-item__contenido" data-k="contenido" type="text" placeholder="qué dice exactamente (texto ${i + 1})" value="${(t.contenido || '').replace(/"/g, '&quot;')}">
      <select class="campo__input" data-k="modo"><option value="relieve">en relieve</option><option value="grabado">grabado</option><option value="calado">calado</option></select>
      <input class="campo__input" data-k="tamano" type="number" min="1" step="0.5" placeholder="alto de letra mm" value="${t.tamano || ''}">
      <input class="campo__input" data-k="ubicacion" type="text" placeholder="dónde va (cara, centrado, a N mm de…)" value="${(t.ubicacion || '').replace(/"/g, '&quot;')}">
      <input class="campo__input" data-k="profundidad" type="number" min="0.1" step="0.1" placeholder="relieve / profundidad mm" value="${t.profundidad || ''}">
      <div class="ia3-texto-item__pie"><select class="campo__input" data-k="fuente"><option value="Liberation Sans:style=Bold">Liberation Sans negrita</option><option value="Liberation Sans">Liberation Sans</option><option value="Liberation Mono">Liberation Mono</option></select><button class="btn" type="button" data-quitar>✕</button></div>`;
    div.querySelector('[data-k="modo"]').value = t.modo || 'relieve';
    div.querySelector('[data-k="fuente"]').value = t.fuente || 'Liberation Sans:style=Bold';
    div.addEventListener('input', (e) => { const k = e.target.dataset.k; if (k) { t[k] = e.target.value; analizarDiferido(); guardarDiferido(); } });
    div.querySelector('[data-quitar]').addEventListener('click', () => { estado.textos.splice(i, 1); dibujarTextos(); analizarDiferido(); guardarDiferido(); });
    cont.appendChild(div);
  });
}

function leerFicha() {
  const num = id => { const v = parseFloat($(id).value); return Number.isFinite(v) && v > 0 ? v : null; };
  return {
    nombre: $('fNombre').value,
    funcion: $('fFuncion').value,
    forma: $('fForma').value,
    largo: num('fLargo'), ancho: num('fAncho'), alto: num('fAlto'),
    dimensionesExactas: $('fExactas').checked,
    proceso: $('fProceso').value,
    holgura: num('fHolgura'), pared: num('fPared'),
    calidad: $('fCalidad').value,
    textos: estado.textos,
    elementos: $('fElementos').value,
    ajustables: $('fAjustables').value,
    restricciones: $('fRestricciones').value,
    sinSoportes: $('fSinSoportes').checked,
    aristas: $('fAristas').checked,
    hueca: $('fHueca').checked,
    simetrica: $('fSimetrica').checked
  };
}

function escribirFicha(f) {
  if (!f) return;
  const set = (id, v) => { if (v !== undefined && v !== null) $(id).value = v; };
  set('fNombre', f.nombre); set('fFuncion', f.funcion); set('fForma', f.forma || 'narrada');
  set('fLargo', f.largo || ''); set('fAncho', f.ancho || ''); set('fAlto', f.alto || '');
  $('fExactas').checked = !!f.dimensionesExactas;
  set('fProceso', f.proceso || 'fdm_pla'); set('fHolgura', f.holgura ?? 0.2); set('fPared', f.pared ?? 1.6); set('fCalidad', f.calidad || '64');
  set('fElementos', f.elementos); set('fAjustables', f.ajustables); set('fRestricciones', f.restricciones);
  $('fSinSoportes').checked = f.sinSoportes !== false; $('fAristas').checked = f.aristas !== false;
  $('fHueca').checked = !!f.hueca; $('fSimetrica').checked = !!f.simetrica;
  estado.textos = Array.isArray(f.textos) ? f.textos : [];
  dibujarTextos();
}

// ---------------------------------------------------------------------------
// Análisis de la narración
// ---------------------------------------------------------------------------
function analizar() {
  const texto = $('narracion').value;
  const palabras = texto.trim() ? texto.trim().split(/\s+/).length : 0;
  $('contadorNarracion').textContent = `${palabras} palabras`;
  const ul = $('listaAvisos');
  ul.innerHTML = '';
  if (!texto.trim() && !estado.textos.length) {
    ul.innerHTML = '<li class="ia3-aviso ia3-aviso--ok">Escribí o dictá la narración para revisarla.</li>';
    return;
  }
  const avisos = analizarNarracion(texto, leerFicha());
  if (!avisos.length) {
    ul.innerHTML = '<li class="ia3-aviso ia3-aviso--ok">✔ No se detectaron ambigüedades: medidas, caras, proceso y textos están declarados. Generá el prompt.</li>';
    return;
  }
  for (const a of avisos) {
    const li = document.createElement('li');
    li.className = 'ia3-aviso ia3-aviso--' + a.nivel;
    li.textContent = (a.nivel === 'falta' ? '⛔ ' : '⚠ ') + a.texto;
    ul.appendChild(li);
  }
}
const analizarDiferido = debounce(analizar, 300);

// ---------------------------------------------------------------------------
// Voz
// ---------------------------------------------------------------------------
let reconocimiento = null;
let grabando = false;

function puntuar(t) {
  return (' ' + t + ' ')
    .replace(/\s+punto y aparte\s+/gi, '.\n')
    .replace(/\s+nueva línea\s+/gi, '\n').replace(/\s+nueva linea\s+/gi, '\n')
    .replace(/\s+punto y coma\s+/gi, '; ')
    .replace(/\s+dos puntos\s+/gi, ': ')
    .replace(/\s+punto\s+/gi, '. ')
    .replace(/\s+coma\s+/gi, ', ')
    .replace(/\s+abrir paréntesis\s+/gi, ' (').replace(/\s+cerrar paréntesis\s+/gi, ') ')
    .replace(/\s+por\s+/gi, ' × ')
    .replace(/(\d)\s*(milímetros|milimetros)\b/gi, '$1 mm')
    .replace(/(\d)\s*grados\b/gi, '$1°')
    .replace(/ {2,}/g, ' ').trim();
}

function agregarNarracion(fragmento) {
  const ta = $('narracion');
  const texto = puntuar(fragmento);
  if (!texto) return;
  const sep = ta.value && !/[\s\n]$/.test(ta.value) ? ' ' : '';
  ta.value += sep + texto.charAt(0).toUpperCase() + texto.slice(1);
  ta.scrollTop = ta.scrollHeight;
  analizarDiferido();
  guardarDiferido();
}

function iniciarVoz() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    $('estadoVoz').textContent = 'este navegador no dicta (usá Chrome o Edge)';
    toast('El reconocimiento de voz necesita Chrome o Edge.');
    return;
  }
  reconocimiento = new SR();
  reconocimiento.lang = $('optIdioma').value;
  reconocimiento.continuous = true;
  reconocimiento.interimResults = true;
  reconocimiento.onresult = (ev) => {
    let parcial = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) agregarNarracion(r[0].transcript);
      else parcial += r[0].transcript;
    }
    $('vozParcial').textContent = parcial ? '… ' + parcial : '';
  };
  reconocimiento.onerror = (ev) => {
    const msgs = { 'not-allowed': 'no hay permiso para usar el micrófono', 'no-speech': 'no se escuchó nada', 'audio-capture': 'no se encontró micrófono', network: 'sin conexión (el dictado usa internet)' };
    $('estadoVoz').textContent = msgs[ev.error] || ('error: ' + ev.error);
    if (ev.error === 'not-allowed' || ev.error === 'audio-capture') detenerVoz();
  };
  reconocimiento.onend = () => {
    if (grabando) { try { reconocimiento.start(); } catch (e) { detenerVoz(); } }
  };
  try { reconocimiento.start(); } catch (e) { $('estadoVoz').textContent = 'no se pudo iniciar el micrófono'; return; }
  grabando = true;
  $('btnVoz').textContent = '⏹ Parar';
  $('btnVoz').classList.add('btn--grabando');
  $('estadoVoz').textContent = 'escuchando… hablá con calma y decí las medidas en milímetros';
}

function detenerVoz() {
  grabando = false;
  if (reconocimiento) { try { reconocimiento.stop(); } catch (e) { /* nada */ } }
  reconocimiento = null;
  $('btnVoz').textContent = '🎙 Dictar';
  $('btnVoz').classList.remove('btn--grabando');
  $('vozParcial').textContent = '';
  if (!/no hay permiso|no se encontró|no dicta/.test($('estadoVoz').textContent)) $('estadoVoz').textContent = 'micrófono listo';
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------
function generarPrompt() {
  const narracion = $('narracion').value;
  const ficha = leerFicha();
  if (!narracion.trim() && !ficha.nombre.trim()) {
    toast('Primero narrá la pieza o completá la ficha.');
    $('narracion').focus();
    return;
  }
  estado.prompt = generarPromptPieza({ narracion, ficha });
  $('cajaPrompt').textContent = estado.prompt;
  $('btnCopiarPrompt').disabled = false;
  const avisos = analizarNarracion(narracion, ficha);
  const faltan = avisos.filter(a => a.nivel === 'falta').length;
  $('estadoPrompt').textContent = `Prompt de ${estado.prompt.length.toLocaleString('es')} caracteres` + (faltan ? ` · ⛔ ${faltan} punto(s) ambiguo(s) en la narración: la IA los va a suponer.` : ' · sin ambigüedades detectadas.');
  actualizarEnlaces(estado.prompt);
  guardarDiferido();
  $('cajaPrompt').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function actualizarEnlaces(prompt) {
  const q = encodeURIComponent(prompt);
  const cabe = q.length < LIMITE_URL;
  const a1 = $('lnkClaudeQ'), a2 = $('lnkChatGPTQ');
  a1.style.display = a2.style.display = cabe ? '' : 'none';
  if (cabe) {
    a1.href = 'https://claude.ai/new?q=' + q;
    a2.href = 'https://chatgpt.com/?q=' + q;
  }
}

// ---------------------------------------------------------------------------
// Código y variables
// ---------------------------------------------------------------------------
function establecerCodigo(codigo, { original = false, desdeTextarea = false } = {}) {
  estado.codigo = codigo;
  if (original) estado.codigoOriginal = codigo;
  if (!desdeTextarea) $('codigo').value = codigo;
  const p = parsearVariables(codigo);
  estado.variables = clasificarVariables(codigo, p.variables);
  estado.grupos = p.grupos;
  dibujarVariables();
  guardarDiferido();
  if ($('optAutoRender').checked && codigo.trim()) renderizarDiferido();
}

function valoresOriginales() {
  if (!estado.codigoOriginal) return new Map();
  const p = parsearVariables(estado.codigoOriginal);
  return new Map(p.variables.map(v => [v.nombre, v.textoValor.trim()]));
}

function cambiarVariable(v, tipo, valor) {
  const texto = valorATexto(tipo, valor);
  const nuevo = aplicarValor(estado.codigo, v, texto);
  estado.codigo = nuevo;
  $('codigo').value = nuevo;
  // actualizar la variable en memoria sin rearmar el panel
  v.textoValor = texto; v.fin = v.inicio + texto.length; v.valor = valor; v.tipo = tipo;
  guardarDiferido();
  if ($('optAutoRender').checked) renderizarDiferido();
}

const ROLES = { numero: 'medida', vector: 'vector', puntos: 'contorno (puntos)', posicion: 'posición', rotacion: 'rotación', texto: 'texto', fuente: 'fuente', cadena: 'texto', bool: 'sí / no', calidad: 'calidad', expresion: 'expresión' };

function controlNumero(v) {
  const wrap = document.createElement('div');
  wrap.className = 'ia3-var__ctrl';
  const r = rangoSugerido(v);
  const rango = document.createElement('input');
  rango.type = 'range'; rango.min = r.min; rango.max = r.max; rango.step = r.paso; rango.value = v.valor;
  const num = document.createElement('input');
  num.type = 'number'; num.className = 'campo__input'; num.step = r.paso; num.value = formatearNumero(v.valor);
  const nudge = document.createElement('span');
  nudge.className = 'ia3-nudge';
  for (const d of [-1, 1]) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = d < 0 ? '−' : '+'; b.title = (d < 0 ? 'restar ' : 'sumar ') + r.paso;
    b.addEventListener('click', () => { const nv = Math.round((parseFloat(num.value || 0) + d * r.paso) * 10000) / 10000; num.value = nv; rango.value = nv; cambiarVariable(v, 'numero', nv); marcar(wrap); });
    nudge.appendChild(b);
  }
  rango.addEventListener('input', () => { num.value = rango.value; cambiarVariable(v, 'numero', parseFloat(rango.value)); marcar(wrap); });
  num.addEventListener('input', () => { const nv = parseFloat(num.value); if (Number.isFinite(nv)) { rango.value = nv; cambiarVariable(v, 'numero', nv); marcar(wrap); } });
  wrap.append(rango, num, nudge);
  return wrap;
}

function controlLista(v) {
  const wrap = document.createElement('div');
  wrap.className = 'ia3-var__ctrl';
  const sel = document.createElement('select');
  sel.className = 'campo__input';
  for (const o of v.lista) {
    const op = document.createElement('option');
    op.value = o.valor; op.textContent = o.etiqueta + (o.etiqueta !== o.valor ? ` (${o.valor})` : '');
    sel.appendChild(op);
  }
  sel.value = v.textoValor.trim().replace(/^"|"$/g, '');
  if (sel.selectedIndex < 0) sel.value = v.textoValor.trim();
  sel.addEventListener('change', () => {
    const texto = sel.value;
    if (v.tipo === 'cadena') cambiarVariable(v, 'cadena', texto);
    else if (RE_NUM.test(texto)) cambiarVariable(v, 'numero', parseFloat(texto));
    else cambiarVariable(v, 'expresion', texto);
    marcar(wrap);
  });
  wrap.appendChild(sel);
  return wrap;
}
const RE_NUM = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;

function controlVector(v) {
  const wrap = document.createElement('div');
  wrap.className = 'ia3-var__ctrl';
  const ejes = ['x', 'y', 'z', 'w'];
  const valores = v.valor.slice();
  const inputs = [];
  const paso = document.createElement('select');
  paso.className = 'campo__input ia3-paso';
  for (const p of [0.1, 0.5, 1, 5, 10]) { const op = document.createElement('option'); op.value = p; op.textContent = 'paso ' + p; paso.appendChild(op); }
  paso.value = v.rol === 'rotacion' ? 5 : 1;
  valores.forEach((val, k) => {
    const et = document.createElement('span'); et.className = 'ia3-eje'; et.textContent = v.rol === 'rotacion' ? ['rx', 'ry', 'rz', 'rw'][k] : ejes[k];
    const inp = document.createElement('input'); inp.type = 'number'; inp.className = 'campo__input'; inp.step = 0.1; inp.value = formatearNumero(val);
    inp.addEventListener('input', () => { const nv = parseFloat(inp.value); if (Number.isFinite(nv)) { valores[k] = nv; cambiarVariable(v, 'vector', valores.slice()); marcar(wrap); } });
    const nudge = document.createElement('span'); nudge.className = 'ia3-nudge';
    for (const d of [-1, 1]) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = d < 0 ? '−' : '+';
      b.addEventListener('click', () => { valores[k] = Math.round((valores[k] + d * parseFloat(paso.value)) * 10000) / 10000; inp.value = formatearNumero(valores[k]); cambiarVariable(v, 'vector', valores.slice()); marcar(wrap); });
      nudge.appendChild(b);
    }
    inputs.push(inp);
    wrap.append(et, inp, nudge);
  });
  wrap.appendChild(paso);
  return wrap;
}

function controlPuntos(v) {
  const wrap = document.createElement('div');
  wrap.className = 'ia3-var__ctrl ia3-puntos';
  const puntos = v.valor.map(p => p.slice());
  const dim = puntos[0] ? puntos[0].length : 2;
  const paso = document.createElement('select');
  paso.className = 'campo__input ia3-paso';
  for (const p of [0.1, 0.5, 1, 5]) { const op = document.createElement('option'); op.value = p; op.textContent = 'paso ' + p; paso.appendChild(op); }
  paso.value = 1;
  const tabla = document.createElement('div');
  tabla.className = 'ia3-puntos__tabla';
  const aplicar = () => { cambiarVariable(v, 'puntos', puntos.map(p => p.slice())); marcar(wrap); };
  const dibujar = () => {
    tabla.innerHTML = '';
    puntos.forEach((p, i) => {
      const fila = document.createElement('div');
      fila.className = 'ia3-puntos__fila';
      const num = document.createElement('span'); num.className = 'ia3-eje'; num.textContent = String(i + 1); fila.appendChild(num);
      p.forEach((val, k) => {
        const inp = document.createElement('input'); inp.type = 'number'; inp.className = 'campo__input'; inp.step = 0.1; inp.value = formatearNumero(val); inp.title = ['x', 'y', 'z'][k];
        inp.addEventListener('input', () => { const nv = parseFloat(inp.value); if (Number.isFinite(nv)) { p[k] = nv; aplicar(); } });
        const nudge = document.createElement('span'); nudge.className = 'ia3-nudge';
        for (const d of [-1, 1]) {
          const b = document.createElement('button'); b.type = 'button'; b.textContent = d < 0 ? '−' : '+';
          b.addEventListener('click', () => { p[k] = Math.round((p[k] + d * parseFloat(paso.value)) * 10000) / 10000; inp.value = formatearNumero(p[k]); aplicar(); });
          nudge.appendChild(b);
        }
        fila.append(inp, nudge);
      });
      const acciones = document.createElement('span'); acciones.className = 'ia3-nudge';
      const mas = document.createElement('button'); mas.type = 'button'; mas.textContent = '＋'; mas.title = 'insertar un punto después de este (en el medio hacia el siguiente)';
      mas.addEventListener('click', () => { const q = puntos[(i + 1) % puntos.length]; puntos.splice(i + 1, 0, p.map((x, k) => Math.round((x + q[k]) / 2 * 100) / 100)); dibujar(); aplicar(); });
      const menos = document.createElement('button'); menos.type = 'button'; menos.textContent = '✕'; menos.title = 'quitar este punto';
      menos.addEventListener('click', () => { if (puntos.length <= 3) { toast('Un contorno necesita al menos 3 puntos.'); return; } puntos.splice(i, 1); dibujar(); aplicar(); });
      acciones.append(mas, menos);
      fila.appendChild(acciones);
      tabla.appendChild(fila);
    });
  };
  dibujar();
  const pie = document.createElement('div'); pie.className = 'ia3-puntos__pie';
  const info = document.createElement('span'); info.className = 'kin-valor'; info.textContent = `${puntos.length} puntos · ${dim === 2 ? 'x, y' : 'x, y, z'} en mm`;
  pie.append(info, paso);
  wrap.append(tabla, pie);
  return wrap;
}

function controlCadena(v) {
  const wrap = document.createElement('div');
  wrap.className = 'ia3-var__ctrl';
  if (v.rol === 'fuente') {
    const sel = document.createElement('select');
    sel.className = 'campo__input';
    const actual = String(v.valor);
    const opciones = NOMBRES_FUENTES.includes(actual) ? NOMBRES_FUENTES : [actual, ...NOMBRES_FUENTES];
    for (const f of opciones) { const op = document.createElement('option'); op.value = f; op.textContent = f + (NOMBRES_FUENTES.includes(f) ? '' : ' (no disponible en la vista previa)'); sel.appendChild(op); }
    sel.value = actual;
    sel.addEventListener('change', () => { cambiarVariable(v, 'cadena', sel.value); marcar(wrap); });
    wrap.appendChild(sel);
    return wrap;
  }
  const inp = document.createElement('input');
  inp.type = 'text'; inp.className = 'campo__input'; inp.value = String(v.valor);
  inp.addEventListener('input', () => { cambiarVariable(v, 'cadena', inp.value); marcar(wrap); });
  wrap.appendChild(inp);
  return wrap;
}

function controlBool(v) {
  const wrap = document.createElement('div');
  wrap.className = 'ia3-var__ctrl';
  const lab = document.createElement('label'); lab.className = 'scratch-check';
  const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = !!v.valor;
  chk.addEventListener('change', () => { cambiarVariable(v, 'bool', chk.checked); marcar(wrap); });
  lab.append(chk, document.createTextNode(' ' + (chk.checked ? 'sí' : 'no')));
  chk.addEventListener('change', () => { lab.lastChild.textContent = ' ' + (chk.checked ? 'sí' : 'no'); });
  wrap.appendChild(lab);
  return wrap;
}

function controlExpresion(v) {
  const wrap = document.createElement('div');
  wrap.className = 'ia3-var__ctrl';
  const inp = document.createElement('input');
  inp.type = 'text'; inp.className = 'campo__input'; inp.value = v.textoValor.trim(); inp.title = 'expresión OpenSCAD (se escribe tal cual)';
  inp.addEventListener('change', () => { cambiarVariable(v, 'expresion', inp.value.trim() || '0'); marcar(wrap); });
  wrap.appendChild(inp);
  return wrap;
}

function marcar(wrap) {
  const item = wrap.closest('.ia3-var');
  if (item) item.classList.add('ia3-var--cambiada');
}

function dibujarVariables() {
  const panel = $('panelVariables');
  panel.innerHTML = '';
  const filtro = $('filtroVariables').value.trim().toLowerCase();
  const verOcultas = $('optVerOcultas').checked;
  const originales = valoresOriginales();
  const visibles = estado.variables.filter(v => (verOcultas || !v.oculta) && (!filtro || v.nombre.toLowerCase().includes(filtro) || (v.descripcion || '').toLowerCase().includes(filtro)));
  if (!estado.variables.length) {
    panel.innerHTML = estado.codigo.trim()
      ? '<p class="kin-nota">El código no tiene variables de nivel superior con el formato <code>nombre = valor;</code>. Pedile a la IA que lo devuelva con formato Customizer (el prompt de esta página lo exige) o escribí las variables arriba de los módulos.</p>'
      : '<p class="kin-nota">Cuando haya código, acá aparecen sus variables agrupadas: medidas, detalles, posiciones, textos, fabricación y calidad.</p>';
    return;
  }
  if (!visibles.length) { panel.innerHTML = '<p class="kin-nota">Ninguna variable coincide con el filtro.</p>'; return; }
  const porGrupo = new Map();
  for (const v of visibles) { if (!porGrupo.has(v.grupo)) porGrupo.set(v.grupo, []); porGrupo.get(v.grupo).push(v); }
  let idx = 0;
  for (const [grupo, lista] of porGrupo) {
    const det = document.createElement('details');
    det.className = 'ia3-grupo';
    det.open = !/^hidden$/i.test(grupo) && (idx < 6 || !!filtro);
    const sum = document.createElement('summary');
    sum.textContent = (/^hidden$/i.test(grupo) ? 'Derivadas (Hidden)' : grupo) + ` · ${lista.length}`;
    det.appendChild(sum);
    const cuerpo = document.createElement('div');
    cuerpo.className = 'ia3-grupo__cuerpo';
    for (const v of lista) {
      const item = document.createElement('div');
      item.className = 'ia3-var' + (v.oculta ? ' ia3-var--oculta' : '');
      const orig = originales.get(v.nombre);
      if (orig !== undefined && orig !== v.textoValor.trim()) item.classList.add('ia3-var--cambiada');
      const cab = document.createElement('div'); cab.className = 'ia3-var__cab';
      const nom = document.createElement('span'); nom.className = 'ia3-var__nombre'; nom.textContent = v.nombre;
      const rol = document.createElement('span'); rol.className = 'ia3-var__rol'; rol.textContent = ROLES[v.rol] || v.rol;
      cab.append(nom, rol);
      item.appendChild(cab);
      if (v.descripcion) { const d = document.createElement('div'); d.className = 'ia3-var__desc'; d.textContent = v.descripcion; item.appendChild(d); }
      let ctrl;
      if (v.lista && (v.tipo === 'numero' || v.tipo === 'cadena' || v.tipo === 'expresion')) ctrl = controlLista(v);
      else if (v.tipo === 'numero') ctrl = controlNumero(v);
      else if (v.tipo === 'vector') ctrl = controlVector(v);
      else if (v.tipo === 'puntos') ctrl = controlPuntos(v);
      else if (v.tipo === 'cadena') ctrl = controlCadena(v);
      else if (v.tipo === 'bool') ctrl = controlBool(v);
      else ctrl = controlExpresion(v);
      item.appendChild(ctrl);
      cuerpo.appendChild(item);
    }
    det.appendChild(cuerpo);
    panel.appendChild(det);
    idx++;
  }
}

// ---------------------------------------------------------------------------
// Render (worker) y vista 3D
// ---------------------------------------------------------------------------
let worker = null;
let renderId = 0;
let renderEnCurso = false;
let renderPendiente = false;

function obtenerWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./ia3d-render-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (ev) => {
    const m = ev.data;
    if (m.tipo === 'estado') { ponerEstadoRender(m.texto, 'ocupado'); return; }
    if (m.id !== renderId) return;
    renderEnCurso = false;
    estado.salida = m.salida || [];
    mostrarConsola(estado.salida);
    if (m.ok) {
      estado.ultimoRender = { posiciones: m.posiciones, min: m.min, max: m.max, triangulos: m.triangulos };
      mostrarMalla(estado.ultimoRender, !vista.tieneMalla);
      const d = [0, 1, 2].map(k => formatearNumero(Math.round((m.max[k] - m.min[k]) * 100) / 100));
      $('medidas3d').textContent = `${d[0]} × ${d[1]} × ${d[2]} mm\n${m.triangulos.toLocaleString('es')} triángulos`;
      ponerEstadoRender(`Render listo en ${(m.ms / 1000).toFixed(1)} s.`, 'ok');
      $('btnDescargarStl').disabled = false;
    } else {
      const errores = resumirSalida(estado.salida).filter(f => f.nivel === 'error');
      ponerEstadoRender(m.error + (errores.length ? ' ' + errores[0].texto : ''), 'error');
      $('detConsola').open = true;
    }
    if (renderPendiente) { renderPendiente = false; renderizar(); }
  };
  worker.onerror = (e) => {
    renderEnCurso = false;
    ponerEstadoRender('No se pudo cargar OpenSCAD en el navegador (¿sin internet o bloqueado cdn.jsdelivr.net?). Podés seguir editando y descargar el .scad para abrirlo en OpenSCAD.', 'error');
    console.error(e);
  };
  return worker;
}

function ponerEstadoRender(texto, clase) {
  const el = $('estadoRender');
  el.textContent = texto;
  el.className = 'ia3-vista3d__estado' + (clase === 'error' ? ' ia3-vista3d__estado--error' : '') + (clase === 'ocupado' ? ' ia3-vista3d__estado--ocupado' : '');
}

function renderizar() {
  const codigo = $('codigo').value;
  if (!codigo.trim()) { ponerEstadoRender('Pegá un código para ver la pieza.'); return; }
  if (renderEnCurso) { renderPendiente = true; return; }
  renderEnCurso = true;
  renderId++;
  ponerEstadoRender('Renderizando…', 'ocupado');
  obtenerWorker().postMessage({ id: renderId, codigo, url: URL_OPENSCAD, fuentes: FUENTES });
}
const renderizarDiferido = debounce(renderizar, 700);

function mostrarConsola(salida) {
  const filas = resumirSalida(salida);
  const ul = $('consolaScad');
  ul.innerHTML = '';
  const nErr = filas.filter(f => f.nivel === 'error').length, nAv = filas.filter(f => f.nivel === 'aviso').length;
  $('resumenConsola').textContent = (nErr ? `${nErr} error(es)` : '') + (nErr && nAv ? ' · ' : '') + (nAv ? `${nAv} aviso(s)` : '') || (filas.length ? 'sin errores' : '');
  if (!filas.length) { ul.innerHTML = '<li>Sin mensajes.</li>'; return; }
  for (const f of filas) {
    const li = document.createElement('li');
    li.className = f.nivel;
    li.textContent = (f.nivel === 'echo' ? 'echo: ' : '') + f.texto;
    if (f.linea) {
      const b = document.createElement('button'); b.className = 'btn'; b.type = 'button'; b.textContent = `ir a la línea ${f.linea}`;
      b.addEventListener('click', () => irALinea(f.linea));
      li.appendChild(b);
    }
    ul.appendChild(li);
  }
}

function irALinea(n) {
  const ta = $('codigo');
  const lineas = ta.value.split('\n');
  let pos = 0;
  for (let i = 0; i < n - 1 && i < lineas.length; i++) pos += lineas[i].length + 1;
  ta.closest('details').open = true;
  ta.focus();
  ta.setSelectionRange(pos, pos + (lineas[n - 1] || '').length);
  const alturaLinea = parseFloat(getComputedStyle(ta).lineHeight) || 16;
  ta.scrollTop = Math.max(0, (n - 4) * alturaLinea);
}

const vista = { tieneMalla: false };

function iniciarVista3D() {
  const lienzo = $('lienzo3d');
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0x2b2f36);
  const camara = new THREE.PerspectiveCamera(38, 4 / 3, 0.5, 5000);
  camara.up.set(0, 0, 1);
  camara.position.set(120, -160, 110);
  const controles = new OrbitControls(camara, lienzo);
  controles.enableDamping = true;
  escena.add(new THREE.HemisphereLight(0xffffff, 0x556677, 1.0));
  const sol = new THREE.DirectionalLight(0xffffff, 1.4); sol.position.set(150, -100, 220); escena.add(sol);
  const contra = new THREE.DirectionalLight(0xffffff, 0.45); contra.position.set(-120, 140, 60); escena.add(contra);
  const grilla = new THREE.GridHelper(300, 30, 0x777777, 0x4a4f57);
  grilla.rotation.x = Math.PI / 2;
  escena.add(grilla);
  const ejes = new THREE.AxesHelper(20);
  escena.add(ejes);
  const material = new THREE.MeshStandardMaterial({ color: 0xe8a04a, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide });
  const materialAristas = new THREE.LineBasicMaterial({ color: 0x222222 });
  let malla = null, aristas = null;

  function ajustarTamano() {
    const w = lienzo.clientWidth || 640, h = lienzo.clientHeight || 480;
    if (lienzo.width !== Math.floor(w * renderer.getPixelRatio()) || lienzo.height !== Math.floor(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camara.aspect = w / h;
      camara.updateProjectionMatrix();
    }
  }
  function animar() {
    ajustarTamano();
    controles.update();
    grilla.visible = $('optGrilla3d').checked;
    renderer.render(escena, camara);
    requestAnimationFrame(animar);
  }
  animar();

  vista.mostrar = (m, encuadrar) => {
    if (malla) { escena.remove(malla); malla.geometry.dispose(); malla = null; }
    if (aristas) { escena.remove(aristas); aristas.geometry.dispose(); aristas = null; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(m.posiciones, 3));
    geo.computeVertexNormals();
    malla = new THREE.Mesh(geo, material);
    escena.add(malla);
    if ($('optAristas3d').checked) { aristas = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), materialAristas); escena.add(aristas); }
    vista.tieneMalla = true;
    vista.caja = m;
    if (encuadrar) vista.encuadrar();
  };
  vista.encuadrar = () => {
    const m = vista.caja;
    if (!m) return;
    const c = [0, 1, 2].map(k => (m.min[k] + m.max[k]) / 2);
    const d = Math.max(m.max[0] - m.min[0], m.max[1] - m.min[1], m.max[2] - m.min[2], 10);
    controles.target.set(c[0], c[1], c[2]);
    const dist = d * 1.9;
    camara.position.set(c[0] + dist * 0.6, c[1] - dist * 0.8, c[2] + dist * 0.55);
    camara.near = Math.max(0.1, dist / 200); camara.far = dist * 20; camara.updateProjectionMatrix();
    const tam = Math.ceil(d * 2 / 100) * 100;
    grilla.scale.setScalar(tam / 300);
    ejes.scale.setScalar(Math.max(1, d / 40));
  };
  vista.actualizarAristas = () => { if (vista.caja) vista.mostrar(vista.caja, false); };
}

function mostrarMalla(m, encuadrar) { vista.mostrar(m, encuadrar); }

// ---------------------------------------------------------------------------
// Prompt de ajuste
// ---------------------------------------------------------------------------
function generarAjuste() {
  const codigo = $('codigo').value;
  if (!codigo.trim()) { toast('Primero pegá el código de la pieza.'); return; }
  const pedido = $('pedidoAjuste').value;
  if (!pedido.trim()) { toast('Describí qué cambio necesitás.'); $('pedidoAjuste').focus(); return; }
  const errores = resumirSalida(estado.salida).filter(f => f.nivel !== 'echo').map(f => f.texto).join('\n');
  estado.promptAjuste = generarPromptAjuste(codigo, pedido, { errores });
  const caja = $('cajaPromptAjuste');
  caja.textContent = estado.promptAjuste;
  caja.style.display = '';
  $('btnCopiarAjuste').disabled = false;
  copiar(estado.promptAjuste).then(ok => toast(ok ? 'Prompt de ajuste generado y copiado.' : 'Prompt de ajuste generado.'));
  guardarDiferido();
}

// Los botones de IA del bloque de ajuste tienen que copiar ese prompt y no el
// principal: ia-panel.js lee #cajaPrompt al hacer clic, así que se lo prestamos.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.ia3-ajuste [data-ia-abrir]');
  if (!btn) return;
  if (!estado.promptAjuste) { e.stopPropagation(); e.preventDefault(); toast('Generá primero el prompt de ajuste.'); return; }
  const caja = $('cajaPrompt');
  const original = caja.textContent;
  caja.textContent = estado.promptAjuste;
  setTimeout(() => { caja.textContent = original; }, 0);
}, true);

// ---------------------------------------------------------------------------
// Proyecto: guardar / cargar
// ---------------------------------------------------------------------------
function serializar() {
  return {
    version: 1,
    fecha: new Date().toISOString(),
    narracion: $('narracion').value,
    ficha: leerFicha(),
    prompt: estado.prompt,
    codigo: $('codigo').value,
    codigoOriginal: estado.codigoOriginal,
    pedidoAjuste: $('pedidoAjuste').value
  };
}

function guardarLocal() {
  try { localStorage.setItem(CLAVE, JSON.stringify(serializar())); $('estadoProyecto').textContent = 'guardado en este navegador ' + new Date().toLocaleTimeString('es'); } catch (e) { /* sin espacio */ }
}
const guardarDiferido = debounce(guardarLocal, 800);

function cargarProyecto(p) {
  if (!p || typeof p !== 'object') return;
  $('narracion').value = p.narracion || '';
  escribirFicha(p.ficha);
  estado.prompt = p.prompt || '';
  $('cajaPrompt').textContent = estado.prompt;
  $('btnCopiarPrompt').disabled = !estado.prompt;
  if (estado.prompt) { actualizarEnlaces(estado.prompt); $('estadoPrompt').textContent = `Prompt de ${estado.prompt.length.toLocaleString('es')} caracteres (recuperado).`; }
  $('pedidoAjuste').value = p.pedidoAjuste || '';
  estado.codigoOriginal = p.codigoOriginal || p.codigo || '';
  analizar();
  if (p.codigo) establecerCodigo(p.codigo);
}

function nuevoProyecto() {
  if (!confirm('¿Borrar la narración, la ficha, el prompt y el código para empezar de cero?')) return;
  localStorage.removeItem(CLAVE);
  $('narracion').value = '';
  escribirFicha({ textos: [], holgura: 0.2, pared: 1.6, calidad: '64', proceso: 'fdm_pla', forma: 'narrada' });
  estado.prompt = ''; estado.promptAjuste = ''; estado.codigoOriginal = ''; estado.salida = [];
  $('cajaPrompt').textContent = ''; $('btnCopiarPrompt').disabled = true; $('estadoPrompt').textContent = 'Completá la narración y la ficha, y generá el prompt.';
  $('cajaPromptAjuste').textContent = ''; $('cajaPromptAjuste').style.display = 'none'; $('btnCopiarAjuste').disabled = true; $('pedidoAjuste').value = '';
  $('lnkClaudeQ').style.display = $('lnkChatGPTQ').style.display = 'none';
  establecerCodigo('');
  mostrarConsola([]);
  $('medidas3d').textContent = '';
  ponerEstadoRender('Pegá un código para ver la pieza.');
  analizar();
  $('estadoProyecto').textContent = '';
}

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------
function iniciar() {
  iniciarVista3D();
  dibujarTextos();

  $('narracion').addEventListener('input', () => { analizarDiferido(); guardarDiferido(); });
  for (const id of ['fNombre', 'fFuncion', 'fForma', 'fLargo', 'fAncho', 'fAlto', 'fExactas', 'fProceso', 'fHolgura', 'fPared', 'fCalidad', 'fElementos', 'fAjustables', 'fRestricciones', 'fSinSoportes', 'fAristas', 'fHueca', 'fSimetrica']) {
    $(id).addEventListener('input', () => { analizarDiferido(); guardarDiferido(); });
  }
  $('btnAgregarTexto').addEventListener('click', () => { estado.textos.push({ contenido: '', modo: 'relieve', tamano: '', profundidad: '', ubicacion: '', fuente: 'Liberation Sans:style=Bold' }); dibujarTextos(); const ult = $('listaTextos').lastElementChild; if (ult) ult.querySelector('input').focus(); });
  $('btnEjemploNarracion').addEventListener('click', () => {
    $('narracion').value = EJEMPLO_NARRACION;
    escribirFicha({ nombre: 'portacelular de escritorio', funcion: 'sostener un celular inclinado sobre la mesa mientras se carga', forma: 'narrada', largo: 90, ancho: 70, alto: 102, dimensionesExactas: false, proceso: 'fdm_pla', holgura: 0.2, pared: 1.6, calidad: '64',
      textos: [{ contenido: '6º A', modo: 'relieve', tamano: 12, profundidad: 0.8, ubicacion: 'frente del respaldo, centrado, a 30 mm del borde superior', fuente: 'Liberation Sans:style=Bold' }, { contenido: 'HCA', modo: 'grabado', tamano: 6, profundidad: 0.6, ubicacion: 'cara superior de la base, adelante del tope, centrado', fuente: 'Liberation Sans:style=Bold' }],
      elementos: 'respaldo inclinado 70°, 100 mm de largo, 6 mm de espesor, desde el borde trasero\ntope frontal de 12 mm de alto y 8 mm de espesor a 30 mm del borde frontal, ranura de 12 mm\ncanal pasante de 12 mm en el centro del tope y agujero de 12 × 8 mm en la base para el cable', ajustables: 'ángulo del respaldo\nancho de la ranura\ntextos y su tamaño', restricciones: '', sinSoportes: true, aristas: true, hueca: false, simetrica: true });
    analizar(); guardarDiferido();
    toast('Ejemplo cargado: revisá la lista de chequeo y generá el prompt.');
  });
  $('btnLimpiarNarracion').addEventListener('click', () => { $('narracion').value = ''; analizar(); guardarDiferido(); });
  $('btnVoz').addEventListener('click', () => { if (grabando) detenerVoz(); else iniciarVoz(); });
  $('optIdioma').addEventListener('change', () => { if (grabando) { detenerVoz(); iniciarVoz(); } });

  $('btnGenerarPrompt').addEventListener('click', generarPrompt);
  $('btnCopiarPrompt').addEventListener('click', () => copiar(estado.prompt).then(ok => toast(ok ? 'Prompt copiado: pegalo en la IA con Ctrl+V.' : 'No se pudo copiar: seleccioná el texto y copialo a mano.')));

  $('btnPegarCodigo').addEventListener('click', async () => {
    let texto = '';
    try { texto = await navigator.clipboard.readText(); } catch (e) { texto = ''; }
    if (!texto.trim()) { toast('No hay nada para pegar: copiá la respuesta de la IA y volvé a intentar (o pegá en el cuadro de código con Ctrl+V).'); $('codigo').closest('details').open = true; $('codigo').focus(); return; }
    const codigo = extraerCodigo(texto);
    establecerCodigo(codigo, { original: true });
    toast(`Código cargado: ${estado.variables.length} variable(s) detectada(s).`);
    $('zonaEditor').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('inputScad').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    establecerCodigo(extraerCodigo(await f.text()), { original: true });
    toast(`${f.name}: ${estado.variables.length} variable(s).`);
    e.target.value = '';
  });
  $('btnEjemploScad').addEventListener('click', () => { establecerCodigo(EJEMPLO_SCAD, { original: true }); toast('Ejemplo cargado: movés los controles y la pieza se vuelve a renderizar.'); });
  $('codigo').addEventListener('input', debounce(() => {
    const texto = $('codigo').value;
    const codigo = /```/.test(texto) ? extraerCodigo(texto) : texto;
    if (codigo !== texto) $('codigo').value = codigo;
    if (!estado.codigoOriginal) estado.codigoOriginal = codigo;
    establecerCodigo(codigo, { desdeTextarea: true });
  }, 500));
  $('btnCopiarCodigo').addEventListener('click', () => copiar($('codigo').value).then(ok => toast(ok ? 'Código copiado.' : 'No se pudo copiar.')));
  $('btnDescargarScad').addEventListener('click', () => {
    const cod = $('codigo').value; if (!cod.trim()) { toast('No hay código.'); return; }
    descargar((leerFicha().nombre || 'pieza').trim().replace(/[^\w-]+/g, '_') + '.scad', cod, 'text/plain');
  });
  $('btnDescargarStl').addEventListener('click', () => {
    if (!estado.ultimoRender) return;
    const nombre = (leerFicha().nombre || 'pieza').trim().replace(/[^\w-]+/g, '_');
    descargar(nombre + '.stl', new Blob([aStlBinario(estado.ultimoRender.posiciones, nombre)], { type: 'model/stl' }));
  });
  $('btnRenderizar').addEventListener('click', renderizar);
  $('btnEncuadrar').addEventListener('click', () => vista.encuadrar());
  $('optAristas3d').addEventListener('change', () => vista.actualizarAristas());
  $('filtroVariables').addEventListener('input', dibujarVariables);
  $('optVerOcultas').addEventListener('change', dibujarVariables);
  $('btnRestaurar').addEventListener('click', () => { if (!estado.codigoOriginal) return; establecerCodigo(estado.codigoOriginal); toast('Valores originales restaurados.'); });

  $('btnPromptAjuste').addEventListener('click', generarAjuste);
  $('btnCopiarAjuste').addEventListener('click', () => copiar(estado.promptAjuste).then(ok => toast(ok ? 'Prompt de ajuste copiado.' : 'No se pudo copiar.')));

  $('btnGuardarProyecto').addEventListener('click', () => descargar((leerFicha().nombre || 'pieza').trim().replace(/[^\w-]+/g, '_') + '-ia3d.json', JSON.stringify(serializar(), null, 2), 'application/json'));
  $('inputProyecto').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { cargarProyecto(JSON.parse(await f.text())); toast('Proyecto cargado.'); } catch (err) { toast('El archivo no es un proyecto válido.'); }
    e.target.value = '';
  });
  $('btnNuevoProyecto').addEventListener('click', nuevoProyecto);

  // recuperar lo guardado en este navegador
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    if (guardado) { cargarProyecto(guardado); $('estadoProyecto').textContent = 'recuperado de este navegador'; }
  } catch (e) { /* nada */ }
  analizar();
}

document.addEventListener('DOMContentLoaded', iniciar);
