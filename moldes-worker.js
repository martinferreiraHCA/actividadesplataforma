// Web Worker de «Moldes para colar»: corre el núcleo fuera del hilo de la
// página y va avisando el progreso.
import { generarMoldes } from './moldes-nucleo.js';

self.onmessage = (e) => {
  const { tris, op } = e.data;
  try {
    const res = generarMoldes(tris, op,
      (m) => self.postMessage({ tipo: 'aviso', texto: m }),
      (m) => self.postMessage({ tipo: 'progreso', texto: m }));
    const transfer = [];
    for (const p of res.partes) { transfer.push(p.pos.buffer, p.idx.buffer); }
    transfer.push(res.modelo.pos.buffer);
    self.postMessage({ tipo: 'listo', resultado: res }, transfer);
  } catch (err) {
    self.postMessage({ tipo: 'error', texto: err && err.message ? err.message : String(err) });
  }
};
