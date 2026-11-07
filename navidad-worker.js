// Web Worker de «Adornos de Navidad»: calcula el globo redondo fuera del hilo
// de la página y va avisando el progreso.
import { generarGlobo } from './navidad-nucleo.js';

self.onmessage = (e) => {
  const { op, mascara } = e.data;
  try {
    const res = generarGlobo(op, mascara, (m) => self.postMessage({ tipo: 'progreso', texto: m }));
    const transfer = [];
    for (const p of res.partes) transfer.push(p.pos.buffer, p.idx.buffer);
    self.postMessage({ tipo: 'listo', resultado: res }, transfer);
  } catch (err) {
    self.postMessage({ tipo: 'error', texto: err && err.message ? err.message : String(err) });
  }
};
