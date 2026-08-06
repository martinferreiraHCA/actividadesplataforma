// Renderiza código MakeCode (micro:bit) como imagen de bloques usando el
// servicio oficial de embebido de Microsoft MakeCode (makecode.com/blocks-embed).
// Se carga un iframe oculto de makecode.microbit.org y se le manda el código
// por postMessage; devuelve un PNG (data URI) con los bloques dibujados.
// Requiere conexión a internet: si no responde, se rechaza y la ficha
// muestra el código como texto.

const ORIGEN = 'https://makecode.microbit.org';
const URL_RENDER = ORIGEN + '/--docs?render=1';
const TIMEOUT_MS = 30000;

// ============================================================
// Extensiones (paquetes) de MakeCode: permiten dibujar los bloques de
// placas y kits como el Cutebot, Maqueen, NeoPixel, etc.
// ============================================================

// alias cortos → repo de GitHub (extensiones verificadas, las más usadas en aula)
export const EXTENSIONES_CONOCIDAS = {
  'cutebot': 'github:elecfreaks/pxt-cutebot',
  'cutebot-pro': 'github:elecfreaks/pxt-cutebot-pro',
  'wukong': 'github:elecfreaks/pxt-wukong',
  'nezha': 'github:elecfreaks/pxt-nezha',
  'ringbitcar': 'github:elecfreaks/pxt-ringbitcar',
  'maqueen': 'github:DFRobot/pxt-maqueen',
  'neopixel': 'github:microsoft/pxt-neopixel',
  'sonar': 'github:microsoft/pxt-sonar',
  'tinybit': 'github:lzty634158/Tiny-bit'
};

// Normaliza lo que escribió el docente a una lista [{nombre, repo}].
// Acepta, separadas por coma / punto y coma / salto de línea:
//   cutebot                                (alias conocido)
//   github:elecfreaks/pxt-cutebot          (repo de MakeCode)
//   https://github.com/elecfreaks/pxt-cutebot
//   cutebot=github:elecfreaks/pxt-cutebot  (nombre=repo, formato MakeCode)
export function normalizarExtensiones(texto) {
  const out = [];
  const vistos = new Set();
  String(texto || '').split(/[,;\n]+/).map(s => s.trim()).filter(Boolean).forEach(item => {
    let nombre = '';
    let repo = '';
    const igual = item.indexOf('=');
    if (igual > 0) {
      nombre = item.slice(0, igual).trim();
      repo = item.slice(igual + 1).trim();
    } else {
      repo = item;
    }
    // URL de GitHub → github:owner/repo
    const url = repo.match(/^https?:\/\/(?:www\.)?github\.com\/([^\/\s]+\/[^\/\s#?]+)/i);
    if (url) repo = 'github:' + url[1].replace(/\.git$/i, '');
    // alias conocido (sin "github:" ni "/")
    if (!/[:\/]/.test(repo)) {
      const alias = repo.toLowerCase().replace(/[\s_]+/g, '-').replace(/:/g, '');
      if (!EXTENSIONES_CONOCIDAS[alias]) return; // alias desconocido: se ignora
      if (!nombre) nombre = alias.replace(/-/g, '');
      repo = EXTENSIONES_CONOCIDAS[alias];
    } else if (!/^github:/i.test(repo)) {
      repo = 'github:' + repo.replace(/^\/+/, '');
    }
    if (!nombre) {
      // nombre a partir del repo: "github:elecfreaks/pxt-cutebot" → "cutebot"
      nombre = repo.split(/[\/#]/).filter(Boolean).pop().replace(/^pxt[-_]/i, '').replace(/[^a-zA-Z0-9_-]/g, '');
    }
    nombre = nombre.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!nombre || vistos.has(nombre)) return;
    vistos.add(nombre);
    out.push({ nombre, repo });
  });
  return out;
}

// cadena para la opción "package" del renderer: "nombre=repo,nombre=repo"
function paqueteRender(extensiones) {
  return normalizarExtensiones(extensiones).map(e => e.nombre + '=' + e.repo).join(',');
}

let iframe = null;
let listo = false;
const esperandoListo = [];
const pendientes = new Map(); // id -> {resolve, reject, timer}
let contador = 0;

// cache por código: { estado: 'pendiente'|'ok'|'error', valor, promesa }
const cache = new Map();

function asegurarIframe() {
  if (iframe) return;
  iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:absolute;width:1px;height:1px;left:-1000px;top:-1000px;border:0';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.tabIndex = -1;
  iframe.src = URL_RENDER;
  window.addEventListener('message', (ev) => {
    if (ev.origin !== ORIGEN) return;
    const msg = ev.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'renderready') {
      listo = true;
      esperandoListo.splice(0).forEach(fn => fn());
    } else if (msg.type === 'renderblocks' && pendientes.has(msg.id)) {
      const p = pendientes.get(msg.id);
      pendientes.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.uri) {
        p.resolve({ uri: msg.uri, width: msg.width || 0, height: msg.height || 0 });
      } else {
        p.reject(new Error(msg.error || 'MakeCode no pudo dibujar ese código'));
      }
    }
  });
  document.body.appendChild(iframe);
}

function cuandoEsteListo() {
  asegurarIframe();
  if (listo) return Promise.resolve();
  return new Promise(r => esperandoListo.push(r));
}

// mide el PNG si el renderer no informó dimensiones
function medir(info) {
  if (info.width && info.height) return Promise.resolve(info);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ ...info, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Imagen de bloques ilegible'));
    img.src = info.uri;
  });
}

export function obtenerBloquesMicrobit(codigo, extensiones) {
  const cod = codigo.trim();
  if (!cod) return Promise.reject(new Error('sin código'));
  const paquete = paqueteRender(extensiones);
  const clave = paquete ? cod + '\u0000' + paquete : cod;
  const hit = cache.get(clave);
  if (hit) return hit.promesa;

  const entrada = { estado: 'pendiente', valor: null, promesa: null };
  entrada.promesa = new Promise((resolve, reject) => {
    const id = 'mb' + (++contador);
    const timer = setTimeout(() => {
      pendientes.delete(id);
      reject(new Error('MakeCode no respondió (¿hay conexión a internet?)'));
    }, TIMEOUT_MS);
    pendientes.set(id, { resolve, reject, timer });
    cuandoEsteListo().then(() => {
      const msg = { type: 'renderblocks', id, code: cod };
      if (paquete) msg.options = { package: paquete };
      iframe.contentWindow.postMessage(msg, ORIGEN);
    });
  }).then(medir).then(
    info => { entrada.estado = 'ok'; entrada.valor = info; return info; },
    err => { entrada.estado = 'error'; entrada.valor = err; throw err; }
  );
  cache.set(clave, entrada);
  return entrada.promesa;
}

// consulta sincrónica del cache: null si nunca se pidió o sigue pendiente
export function bloquesMicrobitEnCache(codigo, extensiones) {
  const cod = (codigo || '').trim();
  const paquete = paqueteRender(extensiones);
  const hit = cache.get(paquete ? cod + '\u0000' + paquete : cod);
  if (!hit) return null;
  return { estado: hit.estado, valor: hit.estado === 'ok' ? hit.valor : null };
}
