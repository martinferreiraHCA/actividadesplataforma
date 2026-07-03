// Renderiza código MakeCode (micro:bit) como imagen de bloques usando el
// servicio oficial de embebido de Microsoft MakeCode (makecode.com/blocks-embed).
// Se carga un iframe oculto de makecode.microbit.org y se le manda el código
// por postMessage; devuelve un PNG (data URI) con los bloques dibujados.
// Requiere conexión a internet: si no responde, se rechaza y la ficha
// muestra el código como texto.

const ORIGEN = 'https://makecode.microbit.org';
const URL_RENDER = ORIGEN + '/--docs?render=1';
const TIMEOUT_MS = 30000;

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

export function obtenerBloquesMicrobit(codigo) {
  const clave = codigo.trim();
  if (!clave) return Promise.reject(new Error('sin código'));
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
      iframe.contentWindow.postMessage({ type: 'renderblocks', id, code: clave }, ORIGEN);
    });
  }).then(medir).then(
    info => { entrada.estado = 'ok'; entrada.valor = info; return info; },
    err => { entrada.estado = 'error'; entrada.valor = err; throw err; }
  );
  cache.set(clave, entrada);
  return entrada.promesa;
}

// consulta sincrónica del cache: null si nunca se pidió o sigue pendiente
export function bloquesMicrobitEnCache(codigo) {
  const hit = cache.get((codigo || '').trim());
  if (!hit) return null;
  return { estado: hit.estado, valor: hit.estado === 'ok' ? hit.valor : null };
}
