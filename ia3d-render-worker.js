// Pieza 3D con IA — worker que renderiza OpenSCAD a STL con OpenSCAD compilado a
// WebAssembly (paquete openscad-wasm-prebuilt, cargado desde jsDelivr la primera
// vez; ~11 MB, después queda en la caché del navegador).
//
// Mensajes de entrada:  { id, codigo, url, fuentes: [urls .ttf] }
// Mensajes de salida:   { id, ok, posiciones (Float32Array), triangulos, min, max, salida: [líneas], ms }
//                       { id, ok: false, error, salida }
//                       { tipo: 'estado', texto }
//
// Cada render usa una instancia nueva: cuando OpenSCAD encuentra un error de
// sintaxis termina el proceso y la instancia queda inutilizable.

import { leerStlAscii } from './ia3d-scad.js';

let modulo = null;
let fuentes = null; // [{nombre, bytes}]

const FONTS_CONF = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>/fonts</dir>
  <cachedir>/fonts/cache</cachedir>
  <alias><family>sans-serif</family><prefer><family>Liberation Sans</family></prefer></alias>
  <alias><family>serif</family><prefer><family>Liberation Sans</family></prefer></alias>
  <alias><family>monospace</family><prefer><family>Liberation Mono</family></prefer></alias>
  <alias><family>Arial</family><prefer><family>Liberation Sans</family></prefer></alias>
  <alias><family>Helvetica</family><prefer><family>Liberation Sans</family></prefer></alias>
  <alias><family>DejaVu Sans</family><prefer><family>Liberation Sans</family></prefer></alias>
  <alias><family>Courier New</family><prefer><family>Liberation Mono</family></prefer></alias>
</fontconfig>`;

async function cargarFuentes(urls) {
  if (fuentes) return fuentes;
  const lista = [];
  for (const u of urls || []) {
    try {
      const r = await fetch(u);
      if (!r.ok) continue;
      lista.push({ nombre: u.split('/').pop(), bytes: new Uint8Array(await r.arrayBuffer()) });
    } catch (e) { /* sin esa fuente */ }
  }
  fuentes = lista;
  return fuentes;
}

self.onmessage = async (ev) => {
  const { id, codigo, url, fuentes: urlsFuentes } = ev.data;
  const salida = [];
  const t0 = performance.now();
  try {
    if (!modulo) {
      self.postMessage({ tipo: 'estado', texto: 'Descargando OpenSCAD (≈11 MB, solo la primera vez)…' });
      modulo = await import(url);
    }
    const fts = await cargarFuentes(urlsFuentes);
    self.postMessage({ tipo: 'estado', texto: 'Renderizando…' });
    const osc = await modulo.createOpenSCAD({ print: t => salida.push(t), printErr: t => salida.push(t) });
    const inst = osc.getInstance();
    try { inst.FS.mkdir('/fonts'); } catch (e) { /* ya existe */ }
    inst.FS.writeFile('/fonts/fonts.conf', FONTS_CONF);
    for (const f of fts) inst.FS.writeFile('/fonts/' + f.nombre, f.bytes);
    const stl = await osc.renderToStl(codigo);
    const m = leerStlAscii(stl);
    self.postMessage({ id, ok: true, posiciones: m.posiciones, triangulos: m.triangulos, min: m.min, max: m.max, salida, ms: Math.round(performance.now() - t0) }, [m.posiciones.buffer]);
  } catch (e) {
    const hayError = salida.some(s => /^ERROR/.test(s));
    self.postMessage({ id, ok: false, error: hayError ? 'OpenSCAD no pudo renderizar el código.' : ('No se pudo renderizar: ' + (e && e.message ? e.message : String(e))), salida, ms: Math.round(performance.now() - t0) });
  }
};
