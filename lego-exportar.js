// Descargas del modelo de una guía de ensamble LEGO, en los formatos que sirven
// afuera del generador:
//
//   · .ldr  — el modelo con sus pasos (lo arma el motor: lego-render.js)
//   · .stl  — la malla 3D del modelo entero, para imprimir en 3D o abrir en
//             Blender / Tinkercad / cualquier programa de 3D
//   · .csv  — el inventario de piezas (cantidad, pieza, número LDraw, color)
//   · .xml  — lista de compra de BrickLink (Wanted List), para conseguir las
//             piezas que falten
//   · .png  — la foto del modelo terminado (la genera lego-fichas con el motor)

import { piezasAgrupadas } from './lego-modelo.js';
import { piezaPorClave, colorPorCodigoLdraw } from './lego-catalogo.js';

// ============================================================
// Inventario común a las dos listas
// ============================================================

// [{ cantidad, dat, nombreLdraw, nombrePieza, color, nombreColor }]
export function inventario(state) {
  const todas = state.pasos.flatMap(p => p.piezas);
  return piezasAgrupadas(todas).map((g) => {
    const info = g.cruda ? null : piezaPorClave(g.pieza);
    const dat = g.cruda ? g.dat : (info ? info.dat : '');
    const color = colorPorCodigoLdraw(g.color);
    return {
      cantidad: g.cantidad,
      dat,
      nombrePieza: info ? info.nombre : (g.cruda ? 'Pieza LDraw ' + g.dat : g.pieza),
      color: Number(g.color),
      nombreColor: color ? color.nombre : 'código ' + g.color,
    };
  });
}

function celdaCSV(v) {
  const s = String(v == null ? '' : v);
  return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// CSV con ";" (lo que espera Excel en español) y BOM para que no rompa la ñ
export function inventarioCSV(state) {
  const filas = [['Cantidad', 'Pieza', 'Numero LDraw', 'Color', 'Codigo de color LDraw']];
  let total = 0;
  for (const it of inventario(state)) {
    filas.push([it.cantidad, it.nombrePieza, it.dat, it.nombreColor, it.color]);
    total += it.cantidad;
  }
  filas.push([]);
  filas.push(['TOTAL', total + ' piezas']);
  return '﻿' + filas.map(f => f.map(celdaCSV).join(';')).join('\r\n') + '\r\n';
}

// ============================================================
// Lista de compra de BrickLink (Wanted List XML)
// ============================================================

// Códigos de color de BrickLink para los colores del generador. Los que no
// están en la tabla salen sin color (BrickLink los pide "en cualquier color").
const COLOR_BRICKLINK = {
  0: 11,    // negro
  1: 7,     // azul
  2: 6,     // verde
  4: 5,     // rojo
  9: 62,    // celeste (light blue)
  10: 36,   // verde claro (bright green)
  13: 23,   // rosa
  14: 3,    // amarillo
  15: 1,    // blanco
  19: 2,    // beige (tan)
  22: 24,   // violeta (purple)
  25: 4,    // naranja
  27: 34,   // lima
  70: 88,   // marrón (reddish brown)
  71: 86,   // gris claro (light bluish gray)
  72: 85,   // gris oscuro (dark bluish gray)
};

function escaparXML(s) {
  return String(s).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

export function listaBrickLink(state) {
  const L = ['<?xml version="1.0" encoding="UTF-8"?>', '<INVENTORY>'];
  let sinColor = 0;
  for (const it of inventario(state)) {
    if (!it.dat) continue;
    L.push('  <ITEM>');
    L.push('    <ITEMTYPE>P</ITEMTYPE>');
    L.push('    <ITEMID>' + escaparXML(it.dat) + '</ITEMID>');
    const bl = COLOR_BRICKLINK[it.color];
    if (bl) L.push('    <COLOR>' + bl + '</COLOR>');
    else sinColor++;
    L.push('    <MINQTY>' + it.cantidad + '</MINQTY>');
    L.push('    <REMARKS>' + escaparXML(it.nombrePieza + ' · ' + it.nombreColor) + '</REMARKS>');
    L.push('  </ITEM>');
  }
  L.push('</INVENTORY>');
  return { xml: L.join('\n') + '\n', sinColor };
}

// ============================================================
// Malla 3D (.stl binario)
// ============================================================

// Convierte los triángulos que devuelve el motor a un STL binario. LDraw
// trabaja con -Y hacia arriba; el .stl sale con Z hacia arriba, que es lo que
// esperan los programas de impresión 3D. Las unidades pasan a milímetros
// (1 LDU = 0,4 mm), así el modelo se imprime a tamaño real.
const LDU_A_MM = 0.4;

export function stlBinario(triangulos) {
  const n = triangulos.length / 9;
  const buffer = new ArrayBuffer(84 + n * 50);
  const vista = new DataView(buffer);
  const cabecera = 'Modelo LEGO exportado por el Generador de Actividades';
  for (let i = 0; i < 80; i++) vista.setUint8(i, i < cabecera.length ? cabecera.charCodeAt(i) : 32);
  vista.setUint32(80, n, true);
  let o = 84;
  for (let t = 0; t < n; t++) {
    const p = t * 9;
    // vértices LDraw → milímetros con Z arriba
    const v = [];
    for (let k = 0; k < 3; k++) {
      v.push([
        triangulos[p + k * 3] * LDU_A_MM,
        triangulos[p + k * 3 + 2] * LDU_A_MM,
        -triangulos[p + k * 3 + 1] * LDU_A_MM,
      ]);
    }
    const a = [v[1][0] - v[0][0], v[1][1] - v[0][1], v[1][2] - v[0][2]];
    const b = [v[2][0] - v[0][0], v[2][1] - v[0][1], v[2][2] - v[0][2]];
    const nx = a[1] * b[2] - a[2] * b[1];
    const ny = a[2] * b[0] - a[0] * b[2];
    const nz = a[0] * b[1] - a[1] * b[0];
    const largo = Math.hypot(nx, ny, nz) || 1;
    vista.setFloat32(o, nx / largo, true);
    vista.setFloat32(o + 4, ny / largo, true);
    vista.setFloat32(o + 8, nz / largo, true);
    o += 12;
    for (const q of v) {
      vista.setFloat32(o, q[0], true);
      vista.setFloat32(o + 4, q[1], true);
      vista.setFloat32(o + 8, q[2], true);
      o += 12;
    }
    vista.setUint16(o, 0, true);
    o += 2;
  }
  return new Blob([buffer], { type: 'model/stl' });
}

// dataURL de una imagen → Blob para descargar
export function dataURLaBlob(url) {
  const [cabecera, datos] = String(url).split(',');
  const tipo = (cabecera.match(/data:([^;]+)/) || [, 'image/png'])[1];
  const binario = atob(datos);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}
