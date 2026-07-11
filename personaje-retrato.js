// Retratos de personajes para las fichas: a partir del código Scratch de una
// ficha se detectan sus "personaje:" (o el Gato por defecto) y se obtiene el
// dibujo de cada uno, para mostrarlo en la esquina de la ficha, en el Word, etc.
// Los 13 embebidos + el Gato salen de los datos locales (sin internet);
// el resto de la biblioteca oficial se busca en el CDN de Scratch.

import { PERSONAJES, buscarPersonaje } from './scratch-personajes.js';
import { GATO1_SVG } from './scratch-sb3-assets.js';
import { buscarPersonajeEnTodo, urlMiniatura, descargarAsset } from './scratch-catalogo.js';
import { separarSecciones } from './scratch-secciones.js';

const MAX_RETRATOS = 3;

function dataUrlEmbebido(clave) {
  if (clave === 'gato') return 'data:image/svg+xml;base64,' + GATO1_SVG;
  const p = PERSONAJES[clave];
  if (!p) return null;
  return 'data:image/' + (p.ext === 'svg' ? 'svg+xml' : p.ext) + ';base64,' + p.b64;
}

// nombres de personaje que usa el código de una ficha Scratch (en orden, sin repetir)
export function nombresPersonajesDeFicha(ficha) {
  if (ficha.tipo && ficha.tipo !== 'scratch') return [];
  if (!(ficha.codigo || '').trim()) return [];
  const { secciones } = separarSecciones(ficha.codigo);
  const nombres = [];
  secciones.forEach(s => {
    const n = (s.personaje || 'Gato').trim();
    if (n && !nombres.some(x => x.toLowerCase() === n.toLowerCase())) nombres.push(n);
  });
  return nombres;
}

// retrato de UN personaje por su nombre (síncrono): dataURL si es embebido,
// URL del CDN si es de la biblioteca completa, null si no se lo conoce.
export function retratoDeNombre(nombre) {
  const clave = buscarPersonaje(nombre);
  const local = clave ? dataUrlEmbebido(clave) : null;
  if (local) {
    const bonito = clave === 'gato' ? 'Gato' : (PERSONAJES[clave] && PERSONAJES[clave].nombre) || nombre;
    return { nombre: bonito, src: local, local: true };
  }
  const cat = buscarPersonajeEnTodo(nombre);
  if (cat && cat.disfraces && cat.disfraces.length) {
    return { nombre: cat.nombre, src: urlMiniatura(cat.disfraces[0].md5ext), local: false };
  }
  return null;
}

// retratos para la VISTA: síncrono. Los embebidos van como dataURL; los de la
// biblioteca completa, como URL del CDN (el <img> los carga si hay internet).
export function retratosDeFicha(ficha) {
  return nombresPersonajesDeFicha(ficha).slice(0, MAX_RETRATOS)
    .map(retratoDeNombre)
    .filter(Boolean);
}

// interacciones entre personajes: dentro de la sección del personaje A,
// una condición <¿tocando [B v]?> significa "si A está tocando a B".
// Devuelve [{a, b}] con nombres tal como los conoce el catálogo.
export function interaccionesDeFicha(ficha) {
  if (ficha.tipo && ficha.tipo !== 'scratch') return [];
  if (!(ficha.codigo || '').trim()) return [];
  const { secciones } = separarSecciones(ficha.codigo);
  const out = [];
  const vistos = new Set();
  const NO_PERSONAJE = /^(borde|edge|puntero\s+del\s+rat[oó]n|mouse-?pointer|color\s|un\s+color)/i;
  secciones.forEach(s => {
    const a = (s.personaje || 'Gato').trim();
    const re = /¿?\s*tocando\s+\[([^\]]+?)\s*v?\s*\]\s*\??/gi;
    let m;
    while ((m = re.exec(s.codigo))) {
      const b = m[1].trim();
      if (!b || NO_PERSONAJE.test(b)) continue;
      const clave = (a + '→' + b).toLowerCase();
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      out.push({ a, b });
    }
  });
  return out.slice(0, 3);
}

// dataURL (para exportar) del retrato de un nombre; null si no hay o sin internet
export async function retratoDataUrlDeNombre(nombre) {
  const clave = buscarPersonaje(nombre);
  const local = clave ? dataUrlEmbebido(clave) : null;
  if (local) {
    const bonito = clave === 'gato' ? 'Gato' : (PERSONAJES[clave] && PERSONAJES[clave].nombre) || nombre;
    return { nombre: bonito, dataUrl: local };
  }
  const cat = buscarPersonajeEnTodo(nombre);
  if (cat && cat.disfraces && cat.disfraces.length) {
    try {
      const d = cat.disfraces[0];
      const b64 = await descargarAsset(d.md5ext);
      const ext = d.md5ext.slice(d.md5ext.lastIndexOf('.') + 1);
      return { nombre: cat.nombre, dataUrl: 'data:image/' + (ext === 'svg' ? 'svg+xml' : ext) + ';base64,' + b64 };
    } catch (e) { /* sin internet */ }
  }
  return null;
}

// retratos para EXPORTAR (Word): asíncrono, todo como dataURL.
// Los del CDN se descargan (con cache); si no hay internet se omiten.
export async function retratosDeFichaDataUrl(ficha) {
  const out = [];
  for (const nombre of nombresPersonajesDeFicha(ficha).slice(0, MAX_RETRATOS)) {
    const clave = buscarPersonaje(nombre);
    const local = clave ? dataUrlEmbebido(clave) : null;
    if (local) {
      const bonito = clave === 'gato' ? 'Gato' : (PERSONAJES[clave] && PERSONAJES[clave].nombre) || nombre;
      out.push({ nombre: bonito, dataUrl: local });
      continue;
    }
    const cat = buscarPersonajeEnTodo(nombre);
    if (cat && cat.disfraces && cat.disfraces.length) {
      try {
        const d = cat.disfraces[0];
        const b64 = await descargarAsset(d.md5ext);
        const ext = d.md5ext.slice(d.md5ext.lastIndexOf('.') + 1);
        out.push({ nombre: cat.nombre, dataUrl: 'data:image/' + (ext === 'svg' ? 'svg+xml' : ext) + ';base64,' + b64 });
      } catch (e) { /* sin internet: la ficha sale sin retrato */ }
    }
  }
  return out;
}
