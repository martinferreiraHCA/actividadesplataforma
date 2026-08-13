// Lector de archivos .sb3 para el Informe de proyecto: abre el zip con JSZip,
// lee project.json y arma un modelo listo para documentar, con URLs de las
// imágenes de disfraces y fondos (object URLs, liberables con liberarModelo).

import { scriptsDeTarget } from './sb3-a-scratchblocks.js';

const MIME = {
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', bmp: 'image/bmp', wav: 'audio/wav', mp3: 'audio/mpeg'
};

// arrayBuffer de un .sb3 → modelo
// modelo = {
//   nombre, escenario: {…target}, personajes: [{…target}],
//   variablesGlobales: [{nombre, valor, esLista}], extensiones: [],
//   avisos: [], urls: [] (para liberar)
// }
// Cada target del modelo: { nombre, esEscenario, scripts: [{texto, raiz, bloques}],
//   disfraces: [{nombre, url, ext}], sonidos: [nombre], x, y, tamano, direccion,
//   visible, variablesPropias: [{nombre, valor, esLista}], comentarios: [texto] }
export async function leerSb3(arrayBuffer, nombreArchivo) {
  if (typeof JSZip === 'undefined') throw new Error('JSZip no está cargado');
  let zip;
  try {
    zip = await JSZip.loadAsync(arrayBuffer);
  } catch (e) {
    throw new Error('El archivo no es un .sb3 válido (no se pudo abrir como zip).');
  }
  const entrada = zip.file('project.json');
  if (!entrada) throw new Error('El .sb3 no tiene project.json adentro. ¿Es un proyecto de Scratch 3? (los .sb2 de Scratch 2 no están soportados)');
  let proyecto;
  try {
    proyecto = JSON.parse(await entrada.async('string'));
  } catch (e) {
    throw new Error('El project.json del .sb3 está dañado y no se pudo leer.');
  }
  if (!Array.isArray(proyecto.targets)) throw new Error('El project.json no tiene objetos (targets): no parece un proyecto de Scratch 3.');

  const urls = [];
  const avisos = [];

  // md5ext → object URL (una sola vez por archivo)
  const cacheUrl = new Map();
  async function urlDe(md5ext) {
    if (!md5ext) return null;
    if (cacheUrl.has(md5ext)) return cacheUrl.get(md5ext);
    const f = zip.file(md5ext);
    if (!f) { cacheUrl.set(md5ext, null); return null; }
    const ext = md5ext.slice(md5ext.lastIndexOf('.') + 1).toLowerCase();
    const blob = new Blob([await f.async('arraybuffer')], { type: MIME[ext] || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    urls.push(url);
    cacheUrl.set(md5ext, url);
    return url;
  }

  async function armarTarget(t) {
    const scripts = scriptsDeTarget(t);
    scripts.forEach(s => s.avisos.forEach(op => avisos.push(
      `Bloque no reconocido en ${t.isStage ? 'el Escenario' : '"' + t.name + '"'}: ${op} (se dibuja en gris).`
    )));

    const disfraces = [];
    for (const c of t.costumes || []) {
      disfraces.push({
        nombre: c.name,
        ext: c.dataFormat || '',
        url: await urlDe(c.md5ext || (c.assetId ? c.assetId + '.' + c.dataFormat : null))
      });
    }

    const propias = [];
    Object.values(t.variables || {}).forEach(v => propias.push({ nombre: v[0], valor: v[1], esLista: false }));
    Object.values(t.lists || {}).forEach(v => propias.push({ nombre: v[0], valor: Array.isArray(v[1]) ? v[1].join(', ') : v[1], esLista: true }));

    return {
      nombre: t.isStage ? 'Escenario' : (t.name || 'Objeto'),
      esEscenario: !!t.isStage,
      scripts,
      disfraces,
      sonidos: (t.sounds || []).map(s => s.name),
      x: Math.round(t.x || 0), y: Math.round(t.y || 0),
      tamano: Math.round(t.size == null ? 100 : t.size),
      direccion: Math.round(t.direction == null ? 90 : t.direction),
      visible: t.visible !== false,
      disfrazActual: t.currentCostume || 0,
      variablesPropias: propias,
      comentarios: Object.values(t.comments || {}).map(c => String(c.text || '').trim()).filter(Boolean)
    };
  }

  const stage = proyecto.targets.find(t => t.isStage) || null;
  const sprites = proyecto.targets.filter(t => !t.isStage)
    .sort((a, b) => (a.layerOrder || 0) - (b.layerOrder || 0));

  const escenario = stage ? await armarTarget(stage) : null;
  const personajes = [];
  for (const t of sprites) personajes.push(await armarTarget(t));

  const variablesGlobales = escenario ? escenario.variablesPropias : [];

  return {
    nombre: (nombreArchivo || 'proyecto').replace(/\.sb3$/i, ''),
    escenario,
    personajes,
    variablesGlobales,
    extensiones: proyecto.extensions || [],
    avisos: Array.from(new Set(avisos)),
    urls
  };
}

export function liberarModelo(modelo) {
  (modelo && modelo.urls || []).forEach(u => { try { URL.revokeObjectURL(u); } catch (e) { /* ya liberada */ } });
}

// estadísticas para la portada del informe
export function estadisticas(modelo) {
  const todos = [modelo.escenario, ...modelo.personajes].filter(Boolean);
  let scripts = 0, bloques = 0;
  todos.forEach(t => t.scripts.forEach(s => { scripts++; bloques += s.bloques; }));
  return {
    personajes: modelo.personajes.length,
    fondos: modelo.escenario ? modelo.escenario.disfraces.length : 0,
    disfraces: modelo.personajes.reduce((n, p) => n + p.disfraces.length, 0),
    sonidos: todos.reduce((n, t) => n + t.sonidos.length, 0),
    scripts,
    bloques,
    variables: modelo.variablesGlobales.filter(v => !v.esLista).length +
      modelo.personajes.reduce((n, p) => n + p.variablesPropias.filter(v => !v.esLista).length, 0),
    listas: modelo.variablesGlobales.filter(v => v.esLista).length +
      modelo.personajes.reduce((n, p) => n + p.variablesPropias.filter(v => v.esLista).length, 0)
  };
}
