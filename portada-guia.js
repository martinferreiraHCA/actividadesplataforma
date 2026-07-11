// Portada de preparación para las guías paso a paso: antes del primer paso
// se explica qué personajes agregar, qué fondo elegir, de qué se trata el
// juego, y se muestra una imagen general del escenario con los elementos
// ubicados — todo deducido automáticamente del código de las fichas.

import { separarSecciones } from './scratch-secciones.js';
import { retratoDeNombre, retratoDataUrlDeNombre } from './personaje-retrato.js';
import { FONDOS, buscarFondo } from './scratch-personajes.js';
import { buscarFondoEnTodo, urlMiniatura, descargarAsset } from './scratch-catalogo.js';

const RE_POS = /ir a x:\s*\((-?\d+(?:[.,]\d+)?)\)\s*y:\s*\((-?\d+(?:[.,]\d+)?)\)/i;
const RE_TAM = /fijar tamaño al \((\d+(?:[.,]\d+)?)\)/i;

// analiza todas las fichas Scratch: personajes (con posición y tamaño si el
// código los define) y el fondo del escenario
export function analizarProyecto(fichas) {
  const personajes = [];   // [{ nombre, x, y, tamano }]
  const porClave = new Map();
  let fondo = null;
  (fichas || []).forEach(f => {
    if ((f.tipo && f.tipo !== 'scratch') || !(f.codigo || '').trim()) return;
    const sec = separarSecciones(f.codigo);
    if (sec.fondo && !fondo) fondo = sec.fondo;
    sec.secciones.forEach(s => {
      const nombre = (s.personaje || 'Gato').trim();
      const clave = nombre.toLowerCase();
      let p = porClave.get(clave);
      if (!p) {
        p = { nombre, x: null, y: null, tamano: null };
        porClave.set(clave, p);
        personajes.push(p);
      }
      if (p.x === null) {
        const m = s.codigo.match(RE_POS);
        if (m) { p.x = parseFloat(m[1].replace(',', '.')); p.y = parseFloat(m[2].replace(',', '.')); }
      }
      if (p.tamano === null) {
        const t = s.codigo.match(RE_TAM);
        if (t) p.tamano = parseFloat(t[1].replace(',', '.'));
      }
    });
  });
  return { personajes, fondo };
}

// fondo por nombre → dataURL (embebido sin internet; biblioteca vía CDN)
export async function fondoDataUrlDeNombre(nombre) {
  if (!nombre) return null;
  const clave = buscarFondo(nombre);
  if (clave && FONDOS[clave]) {
    const f = FONDOS[clave];
    return { nombre: f.nombre, dataUrl: 'data:image/' + (f.ext === 'svg' ? 'svg+xml' : f.ext) + ';base64,' + f.b64 };
  }
  const cat = buscarFondoEnTodo(nombre);
  if (!cat) return null;
  try {
    const b64 = await descargarAsset(cat.md5ext);
    const ext = cat.md5ext.slice(cat.md5ext.lastIndexOf('.') + 1);
    return { nombre: cat.nombre, dataUrl: 'data:image/' + (ext === 'svg' ? 'svg+xml' : ext) + ';base64,' + b64 };
  } catch (e) { return null; }
}

function cargarImagen(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

// compone la imagen general del juego: fondo + personajes en sus posiciones
// (escenario Scratch de 480x360, dibujado a 2x para que imprima nítido)
export async function imagenEscena(fichas) {
  const { personajes, fondo } = analizarProyecto(fichas);
  if (!personajes.length && !fondo) return null;
  const K = 2, W = 480 * K, H = 360 * K;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const infoFondo = fondo ? await fondoDataUrlDeNombre(fondo) : null;
  if (infoFondo) {
    const img = await cargarImagen(infoFondo.dataUrl);
    if (img) ctx.drawImage(img, 0, 0, W, H);
  }

  // posiciones por defecto para los que no definen "ir a x: y:" en el código
  const sinPos = personajes.filter(p => p.x === null);
  sinPos.forEach((p, i) => {
    p.x = sinPos.length === 1 ? 0 : Math.round(-140 + (280 * i) / (sinPos.length - 1));
    p.y = -30;
  });

  for (const p of personajes.slice(0, 6)) {
    const retrato = await retratoDataUrlDeNombre(p.nombre);
    if (!retrato) continue;
    const img = await cargarImagen(retrato.dataUrl);
    if (!img || !img.naturalHeight) continue;
    // altura de referencia: un personaje al 100% ocupa ~1/4 del alto del escenario
    const alto = Math.max(24, 90 * ((p.tamano || 100) / 100)) * K;
    const ancho = alto * (img.naturalWidth / img.naturalHeight);
    const cx = (240 + p.x) * K;
    const cy = (180 - p.y) * K;
    const px = Math.min(Math.max(cx - ancho / 2, 4), W - ancho - 4);
    const py = Math.min(Math.max(cy - alto / 2, 4), H - alto - 4);
    ctx.drawImage(img, px, py, ancho, alto);
  }
  return { dataUrl: canvas.toDataURL('image/png'), width: 480, height: 360 };
}

// datos completos para exportar (Word): personajes con retrato, fondo y escena
export async function datosPortada(state) {
  if (state.opciones.modo !== 'guia') return null;
  const { personajes, fondo } = analizarProyecto(state.fichas);
  if (!personajes.length) return null;
  const lista = [];
  for (const p of personajes.slice(0, 6)) {
    const r = await retratoDataUrlDeNombre(p.nombre);
    lista.push({ nombre: r ? r.nombre : p.nombre, dataUrl: r ? r.dataUrl : null });
  }
  return {
    personajes: lista,
    fondo: fondo ? await fondoDataUrlDeNombre(fondo) : null,
    escena: await imagenEscena(state.fichas)
  };
}

// portada como DOM (para la vista de impresión / PDF)
export async function construirPortada(state) {
  const datos = await datosPortada(state);
  if (!datos) return null;
  const infantil = state.opciones.estiloDoc === 'infantil';
  const el = document.createElement('div');
  el.className = 'portada-guia' + (infantil ? ' portada-guia--infantil' : '');

  const t = document.createElement('h2');
  t.className = 'portada-guia__titulo';
  t.textContent = infantil ? '🚀 Antes de empezar' : 'Antes de empezar — Preparación del proyecto';
  el.appendChild(t);

  const zona = document.createElement('div');
  zona.className = 'portada-guia__zona';

  const prep = document.createElement('div');
  prep.className = 'portada-guia__prep';

  const bp = document.createElement('div');
  bp.className = 'portada-guia__bloque';
  const ep = document.createElement('strong');
  ep.textContent = infantil ? '1 · Agregá estos personajes:' : 'Agregá estos personajes (botón "Elegir un objeto" en Scratch):';
  bp.appendChild(ep);
  const fila = document.createElement('div');
  fila.className = 'portada-guia__personajes';
  datos.personajes.forEach(p => {
    const item = document.createElement('span');
    item.className = 'portada-guia__personaje';
    if (p.dataUrl) {
      const img = document.createElement('img');
      img.src = p.dataUrl;
      img.alt = p.nombre;
      item.appendChild(img);
    }
    const cap = document.createElement('span');
    cap.textContent = p.nombre;
    item.appendChild(cap);
    fila.appendChild(item);
  });
  bp.appendChild(fila);
  prep.appendChild(bp);

  if (datos.fondo) {
    const bf = document.createElement('div');
    bf.className = 'portada-guia__bloque';
    const ef = document.createElement('strong');
    ef.textContent = infantil ? '2 · Elegí este fondo:' : 'Elegí este fondo para el escenario:';
    bf.appendChild(ef);
    const item = document.createElement('span');
    item.className = 'portada-guia__personaje portada-guia__personaje--fondo';
    const img = document.createElement('img');
    img.src = datos.fondo.dataUrl;
    img.alt = 'Fondo: ' + datos.fondo.nombre;
    const cap = document.createElement('span');
    cap.textContent = datos.fondo.nombre;
    item.append(img, cap);
    bf.appendChild(item);
    prep.appendChild(bf);
  }
  zona.appendChild(prep);

  if (datos.escena) {
    const fig = document.createElement('figure');
    fig.className = 'portada-guia__escena';
    const img = document.createElement('img');
    img.src = datos.escena.dataUrl;
    img.alt = 'Así se va a ver el juego';
    const cap = document.createElement('figcaption');
    cap.textContent = infantil ? '¡Así se va a ver tu juego terminado!' : 'Así queda el escenario del juego (imagen orientativa).';
    fig.append(img, cap);
    zona.appendChild(fig);
  }
  el.appendChild(zona);

  const pie = document.createElement('p');
  pie.className = 'portada-guia__pie';
  pie.textContent = infantil
    ? 'Cuando tengas todo listo, ¡empezá por el PASO 1! Cada paso te dice a qué personaje ponerle el código.'
    : 'Con el proyecto preparado, seguí los pasos en orden: cada uno indica a qué personaje se le agrega el código.';
  el.appendChild(pie);
  return el;
}
