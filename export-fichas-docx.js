// Exporta las fichas Scratch a un documento Word (.docx) usando docx.iife.js (global window.docx)

// ancho útil de una hoja A4 con márgenes de 2 cm, en píxeles a 96 dpi
const ANCHO_CONTENIDO = 630;

export async function exportarFichasDOCX({ titulo, subtitulo, opciones, fichas }) {
  const d = window.docx;
  if (!d) throw new Error('No se cargó la librería de Word (docx.iife.js)');

  const children = [];

  if (titulo && titulo.trim()) {
    children.push(new d.Paragraph({
      children: [new d.TextRun({ text: titulo.trim(), bold: true, size: 44, font: 'Calibri' })],
      spacing: { after: subtitulo && subtitulo.trim() ? 60 : 240 }
    }));
  }
  if (subtitulo && subtitulo.trim()) {
    children.push(new d.Paragraph({
      children: [new d.TextRun({ text: subtitulo.trim(), size: 24, color: '666666', font: 'Calibri' })],
      spacing: { after: 240 }
    }));
  }

  fichas.forEach((item, idx) => {
    if (idx > 0 && opciones.salto) {
      children.push(new d.Paragraph({ children: [new d.PageBreak()] }));
    }
    const contenido = contenidoFicha(d, item, opciones);
    if (opciones.bordes) {
      children.push(tablaMarco(d, contenido));
      children.push(new d.Paragraph({ text: '', spacing: { after: 160 } }));
    } else {
      children.push(...contenido);
      children.push(new d.Paragraph({ text: '', spacing: { after: 240 } }));
    }
  });

  const doc = new d.Document({
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22 } }
      }
    },
    sections: [{
      properties: {
        page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } // 2 cm
      },
      children
    }]
  });

  return d.Packer.toBlob(doc);
}

// contenido de una ficha como lista de párrafos/tablas
function contenidoFicha(d, { ficha, numero, bloques, imagen }, opciones) {
  const out = [];
  const anchoInterior = opciones.bordes ? ANCHO_CONTENIDO - 30 : ANCHO_CONTENIDO;

  // encabezado: chip "FICHA N" + título
  const runsHead = [];
  if (opciones.numerar) {
    runsHead.push(new d.TextRun({ text: ` FICHA ${numero} `, bold: true, size: 18, color: 'FFFFFF', highlight: 'black', font: 'Consolas' }));
    if (ficha.titulo.trim()) runsHead.push(new d.TextRun({ text: '   ' }));
  }
  if (ficha.titulo.trim()) {
    runsHead.push(new d.TextRun({ text: ficha.titulo.trim(), bold: true, size: 28 }));
  }
  if (runsHead.length) {
    out.push(new d.Paragraph({ children: runsHead, spacing: { after: 120 } }));
  }

  // consigna (respetando saltos de línea)
  if (ficha.consigna.trim()) {
    ficha.consigna.trim().split(/\n/).forEach(linea => {
      out.push(new d.Paragraph({
        children: [new d.TextRun({ text: linea, size: 22 })],
        spacing: { after: 80 }
      }));
    });
  }

  // cuerpo: código + imagen según posición
  const imgLado = imagen && (ficha.imgPos === 'derecha' || ficha.imgPos === 'izquierda');
  if (imgLado) {
    const anchoImg = Math.round(anchoInterior * ficha.imgAncho / 100) - 12;
    const anchoCod = anchoInterior - anchoImg - 24;
    const celdaCodigo = celdaSinBorde(d, zonaCodigoDocx(d, ficha, bloques, anchoCod), 100 - ficha.imgAncho);
    const celdaImagen = celdaSinBorde(d, imagenComoParrafos(d, imagen, anchoImg, ficha.epigrafe), ficha.imgAncho);
    const celdas = ficha.imgPos === 'derecha' ? [celdaCodigo, celdaImagen] : [celdaImagen, celdaCodigo];
    out.push(new d.Table({
      width: { size: 100, type: d.WidthType.PERCENTAGE },
      borders: bordesInvisibles(d),
      rows: [new d.TableRow({ children: celdas })]
    }));
  } else {
    const anchoImg = imagen ? Math.round(anchoInterior * Math.min(ficha.imgAncho + 20, 100) / 100) : 0;
    if (imagen && ficha.imgPos === 'arriba') {
      out.push(...imagenComoParrafos(d, imagen, anchoImg, ficha.epigrafe, true));
    }
    out.push(...zonaCodigoDocx(d, ficha, bloques, anchoInterior));
    if (imagen && ficha.imgPos === 'abajo') {
      out.push(...imagenComoParrafos(d, imagen, anchoImg, ficha.epigrafe, true));
    }
  }

  // notas al pie
  if (ficha.notas.trim()) {
    ficha.notas.trim().split(/\n/).forEach((linea, j) => {
      out.push(new d.Paragraph({
        children: [new d.TextRun({ text: linea, italics: true, size: 20, color: '444444' })],
        spacing: { before: j === 0 ? 160 : 0, after: 40 }
      }));
    });
  }

  return out;
}

// zona de código de una ficha: bloques (imagen) y/o código como texto
function zonaCodigoDocx(d, ficha, bloques, anchoMax) {
  const out = [];
  if (bloques) {
    // en micro:bit la escala no viene aplicada en la imagen: se aplica acá
    const escalaExtra = ficha.tipo === 'microbit' ? (ficha.escala || 1) : 1;
    out.push(...bloquesComoParrafos(d, bloques, anchoMax, escalaExtra));
  }
  const esMicrobit = ficha.tipo === 'microbit';
  const quiereCodigoTexto = esMicrobit && ficha.codigo.trim() &&
    (ficha.lenguaje === 'python' || ficha.vista !== 'bloques' || !bloques);
  if (quiereCodigoTexto) {
    out.push(...codigoComoParrafos(d, ficha.codigo));
  }
  if (!out.length) {
    out.push(new d.Paragraph({
      children: [new d.TextRun({ text: '(sin código)', italics: true, color: '999999', size: 20 })]
    }));
  }
  return out;
}

function bloquesComoParrafos(d, bloques, anchoMax, escalaExtra) {
  const deseado = bloques.width * (escalaExtra || 1);
  const k = Math.min(deseado, anchoMax) / bloques.width;
  return [new d.Paragraph({
    children: [new d.ImageRun({
      type: 'png',
      data: dataUrlABytes(bloques.dataUrl),
      transformation: {
        width: Math.round(bloques.width * k),
        height: Math.round(bloques.height * k)
      }
    })],
    spacing: { after: 80 }
  })];
}

// código fuente como párrafos monoespaciados con fondo gris
function codigoComoParrafos(d, codigo) {
  const lineas = codigo.replace(/\t/g, '    ').split('\n');
  return lineas.map((linea, i) => new d.Paragraph({
    children: [new d.TextRun({ text: linea || ' ', font: 'Consolas', size: 18 })],
    shading: { type: d.ShadingType.CLEAR, fill: 'F2F2F0' },
    spacing: { before: i === 0 ? 80 : 0, after: i === lineas.length - 1 ? 120 : 0, line: 240 }
  }));
}

function imagenComoParrafos(d, imagen, anchoMax, epigrafe, centrar) {
  const k = Math.min(1, anchoMax / imagen.width);
  const parrafos = [new d.Paragraph({
    alignment: centrar ? d.AlignmentType.CENTER : undefined,
    children: [new d.ImageRun({
      type: 'png',
      data: dataUrlABytes(imagen.dataUrl),
      transformation: {
        width: Math.round(imagen.width * k),
        height: Math.round(imagen.height * k)
      }
    })],
    spacing: { after: 40 }
  })];
  if (epigrafe && epigrafe.trim()) {
    parrafos.push(new d.Paragraph({
      alignment: d.AlignmentType.CENTER,
      children: [new d.TextRun({ text: epigrafe.trim(), italics: true, size: 18, color: '666666' })],
      spacing: { after: 80 }
    }));
  }
  return parrafos;
}

function celdaSinBorde(d, children, pct) {
  return new d.TableCell({
    children,
    width: { size: pct, type: d.WidthType.PERCENTAGE },
    borders: bordesCelda(d),
    margins: { top: 60, bottom: 60, left: 60, right: 60 },
    verticalAlign: d.VerticalAlign.TOP
  });
}

function bordesInvisibles(d) {
  const nada = { style: d.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  return { top: nada, bottom: nada, left: nada, right: nada, insideHorizontal: nada, insideVertical: nada };
}

function bordesCelda(d) {
  const nada = { style: d.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  return { top: nada, bottom: nada, left: nada, right: nada };
}

// tabla 1×1 que hace de marco de la ficha
function tablaMarco(d, contenido) {
  const linea = { style: d.BorderStyle.SINGLE, size: 12, color: '111111' };
  return new d.Table({
    width: { size: 100, type: d.WidthType.PERCENTAGE },
    borders: {
      top: linea, bottom: linea, left: linea, right: linea,
      insideHorizontal: { style: d.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideVertical: { style: d.BorderStyle.NONE, size: 0, color: 'FFFFFF' }
    },
    rows: [new d.TableRow({
      children: [new d.TableCell({
        children: contenido,
        margins: { top: 160, bottom: 160, left: 200, right: 200 }
      })]
    })]
  });
}

function dataUrlABytes(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
