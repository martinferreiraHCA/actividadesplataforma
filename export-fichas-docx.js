// Exporta las fichas Scratch a un documento Word (.docx) usando docx.iife.js (global window.docx)

// ancho útil de una hoja A4 con márgenes de 2 cm, en píxeles a 96 dpi
const ANCHO_CONTENIDO = 630;

// colores del diseño infantil (mismos que PALETA_INFANTIL de la vista)
const PALETA_INFANTIL = ['F6416C', '00B8A9', 'A66CFF', 'FF8C42', '38B000', '3A86FF'];
const FUENTE_INFANTIL = 'Comic Sans MS';

// letra elegida por el usuario y tamaño general del texto
const FUENTES_DOC = { arial: 'Arial', times: 'Times New Roman' };
const FACTOR_TAMANO = { chico: 0.9, normal: 1, grande: 1.15 };

// resume las opciones de diseño en un "tema" para todo el documento
function temaDoc(opciones) {
  const estilo = opciones.estiloDoc || 'clasico';
  const infantil = estilo === 'infantil';
  const k = FACTOR_TAMANO[opciones.tamanoDoc] || 1;
  return {
    estilo,
    infantil,
    // la letra del usuario gana; si no eligió, cada diseño tiene la suya
    fuente: FUENTES_DOC[opciones.fuenteDoc] || (infantil ? FUENTE_INFANTIL : estilo === 'simple' ? 'Times New Roman' : 'Calibri'),
    tz: (s) => Math.round(s * k)   // tamaño de texto escalado (half-points de docx)
  };
}

export async function exportarFichasDOCX({ titulo, subtitulo, opciones, fichas }) {
  const d = window.docx;
  if (!d) throw new Error('No se cargó la librería de Word (docx.iife.js)');

  const children = [];
  const tema = temaDoc(opciones);
  const { infantil, tz } = tema;

  // blanco y negro: las imágenes (bloques de colores, capturas) van en escala de grises
  if (tema.estilo === 'bn') {
    fichas = await Promise.all(fichas.map(async (item) => ({
      ...item,
      bloques: item.bloques ? { ...item.bloques, dataUrl: await aEscalaDeGrises(item.bloques.dataUrl) } : item.bloques,
      imagen: item.imagen ? { ...item.imagen, dataUrl: await aEscalaDeGrises(item.imagen.dataUrl) } : item.imagen,
      retratos: item.retratos
        ? await Promise.all(item.retratos.map(async r => ({ ...r, dataUrl: await aEscalaDeGrises(r.dataUrl) })))
        : item.retratos
    })));
  }

  if (titulo && titulo.trim()) {
    children.push(new d.Paragraph({
      alignment: infantil ? d.AlignmentType.CENTER : undefined,
      children: [new d.TextRun({
        text: infantil ? '🌈 ' + titulo.trim() + ' 🚀' : titulo.trim(),
        bold: true, size: tz(infantil ? 48 : 44),
        color: infantil ? PALETA_INFANTIL[0] : tema.estilo === 'colorido' ? '3A86FF' : undefined,
        font: tema.fuente
      })],
      spacing: { after: subtitulo && subtitulo.trim() ? 60 : 240 }
    }));
  }
  if (subtitulo && subtitulo.trim()) {
    children.push(new d.Paragraph({
      alignment: infantil ? d.AlignmentType.CENTER : undefined,
      children: [new d.TextRun({ text: subtitulo.trim(), size: tz(24), color: '666666', font: tema.fuente })],
      spacing: { after: 240 }
    }));
  }

  fichas.forEach((item, idx) => {
    if (idx > 0 && opciones.salto) {
      children.push(new d.Paragraph({ children: [new d.PageBreak()] }));
    }
    const contenido = contenidoFicha(d, item, opciones);
    if (opciones.bordes) {
      const conAcento = infantil || tema.estilo === 'colorido';
      const acento = conAcento ? PALETA_INFANTIL[(item.numero - 1) % PALETA_INFANTIL.length] : null;
      children.push(tablaMarco(d, contenido, acento, tema.estilo));
      children.push(new d.Paragraph({ text: '', spacing: { after: 160 } }));
    } else {
      children.push(...contenido);
      children.push(new d.Paragraph({ text: '', spacing: { after: 240 } }));
    }
  });

  const doc = new d.Document({
    styles: {
      default: {
        document: { run: { font: tema.fuente, size: tz(22) } }
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
function contenidoFicha(d, { ficha, numero, bloques, imagen, retratos }, opciones) {
  const out = [];
  const anchoInterior = opciones.bordes ? ANCHO_CONTENIDO - 30 : ANCHO_CONTENIDO;
  const tema = temaDoc(opciones);
  const { estilo, infantil, tz } = tema;
  const acento = PALETA_INFANTIL[(numero - 1) % PALETA_INFANTIL.length];
  const rotulo = opciones.modo === 'guia' ? 'PASO' : 'FICHA';

  // encabezado: número + título (cada diseño con su forma)
  const runsHead = [];
  if (opciones.numerar) {
    if (infantil) {
      runsHead.push(new d.TextRun({
        text: ` 🌟 ${rotulo} ${numero} `, bold: true, size: tz(24), color: 'FFFFFF',
        shading: { type: d.ShadingType.CLEAR, fill: acento }, font: tema.fuente
      }));
    } else if (estilo === 'simple') {
      runsHead.push(new d.TextRun({ text: `${rotulo} ${numero}.`, bold: true, size: tz(24), font: tema.fuente }));
    } else if (estilo === 'colorido') {
      runsHead.push(new d.TextRun({
        text: ` ${rotulo} ${numero} `, bold: true, size: tz(20), color: 'FFFFFF',
        shading: { type: d.ShadingType.CLEAR, fill: acento }, font: tema.fuente
      }));
    } else {
      runsHead.push(new d.TextRun({ text: ` ${rotulo} ${numero} `, bold: true, size: tz(18), color: 'FFFFFF', highlight: 'black', font: 'Consolas' }));
    }
    if (ficha.titulo.trim()) runsHead.push(new d.TextRun({ text: '   ' }));
  }
  if (ficha.titulo.trim()) {
    runsHead.push(new d.TextRun({
      text: ficha.titulo.trim(), bold: true,
      size: tz(infantil ? 30 : estilo === 'simple' ? 30 : 28),
      color: infantil || estilo === 'colorido' ? acento : undefined,
      font: tema.fuente
    }));
  }
  // encabezado + retratos de los personajes en la esquina superior derecha
  const altoRetrato = infantil ? 52 : 38;
  const runsRetratos = [];
  (retratos || []).forEach((r, j) => {
    if (!r.dataUrl || !r.height) return;
    const kk = altoRetrato / r.height;
    if (runsRetratos.length) runsRetratos.push(new d.TextRun({ text: '  ' }));
    runsRetratos.push(new d.ImageRun({
      type: 'png',
      data: dataUrlABytes(r.dataUrl),
      transformation: { width: Math.round(r.width * kk), height: altoRetrato },
      altText: { title: 'Personaje: ' + (r.nombre || ''), description: 'Personaje: ' + (r.nombre || ''), name: r.nombre || 'personaje' }
    }));
  });
  if (runsHead.length && runsRetratos.length) {
    out.push(new d.Table({
      width: { size: 100, type: d.WidthType.PERCENTAGE },
      borders: bordesInvisibles(d),
      rows: [new d.TableRow({
        children: [
          celdaSinBorde(d, [new d.Paragraph({ children: runsHead })], 78),
          new d.TableCell({
            children: [new d.Paragraph({ alignment: d.AlignmentType.RIGHT, children: runsRetratos })],
            width: { size: 22, type: d.WidthType.PERCENTAGE },
            borders: bordesCelda(d),
            verticalAlign: d.VerticalAlign.TOP
          })
        ]
      })]
    }));
    out.push(new d.Paragraph({ text: '', spacing: { after: 60 } }));
  } else if (runsHead.length) {
    out.push(new d.Paragraph({ children: runsHead, spacing: { after: 120 } }));
  } else if (runsRetratos.length) {
    out.push(new d.Paragraph({ alignment: d.AlignmentType.RIGHT, children: runsRetratos, spacing: { after: 80 } }));
  }

  // teoría (recuadro conceptual previo)
  if ((ficha.teoria || '').trim()) {
    const lineas = ficha.teoria.trim().split(/\n/);
    if (estilo === 'simple') {
      // sin recuadro: "Teoría:" en negrita y el texto a continuación
      lineas.forEach((linea, j) => {
        const runs = [];
        if (j === 0) runs.push(new d.TextRun({ text: 'Teoría: ', bold: true, size: tz(22), font: tema.fuente }));
        runs.push(new d.TextRun({ text: linea || ' ', size: tz(22), font: tema.fuente }));
        out.push(new d.Paragraph({ children: runs, spacing: { after: 40 } }));
      });
      out.push(new d.Paragraph({ text: '', spacing: { after: 60 } }));
    } else {
      const fondoTeoria = infantil ? 'EAF6FF' : estilo === 'colorido' ? 'F4F7FB' : estilo === 'bn' ? undefined : 'F2F7FF';
      const conFondo = fondoTeoria ? { type: d.ShadingType.CLEAR, fill: fondoTeoria } : undefined;
      out.push(new d.Paragraph({
        children: [new d.TextRun({
          text: infantil ? '💡 Para aprender' : 'TEORÍA',
          bold: true, size: tz(infantil ? 20 : 16),
          color: estilo === 'bn' ? '111111' : estilo === 'colorido' ? acento : '2B6CB0',
          font: infantil ? tema.fuente : 'Consolas'
        })],
        shading: conFondo,
        spacing: { before: 40, after: 20 }
      }));
      lineas.forEach(linea => {
        out.push(new d.Paragraph({
          children: [new d.TextRun({ text: linea || ' ', size: tz(infantil ? 22 : 21), font: tema.fuente })],
          shading: conFondo,
          spacing: { after: 40 }
        }));
      });
      out.push(new d.Paragraph({ text: '', spacing: { after: 60 } }));
    }
  }

  // consigna (respetando saltos de línea)
  if (ficha.consigna.trim()) {
    ficha.consigna.trim().split(/\n/).forEach((linea, j) => {
      out.push(new d.Paragraph({
        children: [new d.TextRun({
          text: infantil && j === 0 ? '🎯 ' + linea : linea,
          size: tz(infantil ? 24 : 22),
          font: tema.fuente
        })],
        shading: infantil ? { type: d.ShadingType.CLEAR, fill: 'FFF8DE' } : undefined,
        spacing: { after: 80 }
      }));
    });
  }

  // cuerpo: código + imagen según posición
  const imgLado = imagen && (ficha.imgPos === 'derecha' || ficha.imgPos === 'izquierda');
  if (imgLado) {
    const anchoImg = Math.round(anchoInterior * ficha.imgAncho / 100) - 12;
    const anchoCod = anchoInterior - anchoImg - 24;
    const celdaCodigo = celdaSinBorde(d, zonaCodigoDocx(d, ficha, bloques, anchoCod, tema), 100 - ficha.imgAncho);
    const celdaImagen = celdaSinBorde(d, imagenComoParrafos(d, imagen, anchoImg, ficha.epigrafe, false, tema), ficha.imgAncho);
    const celdas = ficha.imgPos === 'derecha' ? [celdaCodigo, celdaImagen] : [celdaImagen, celdaCodigo];
    out.push(new d.Table({
      width: { size: 100, type: d.WidthType.PERCENTAGE },
      borders: bordesInvisibles(d),
      rows: [new d.TableRow({ children: celdas })]
    }));
  } else {
    const anchoImg = imagen ? Math.round(anchoInterior * Math.min(ficha.imgAncho + 20, 100) / 100) : 0;
    if (imagen && ficha.imgPos === 'arriba') {
      out.push(...imagenComoParrafos(d, imagen, anchoImg, ficha.epigrafe, true, tema));
    }
    out.push(...zonaCodigoDocx(d, ficha, bloques, anchoInterior, tema));
    if (imagen && ficha.imgPos === 'abajo') {
      out.push(...imagenComoParrafos(d, imagen, anchoImg, ficha.epigrafe, true, tema));
    }
  }

  // notas al pie
  if (ficha.notas.trim()) {
    ficha.notas.trim().split(/\n/).forEach((linea, j) => {
      out.push(new d.Paragraph({
        children: [new d.TextRun({
          text: infantil && j === 0 ? '⭐ ' + linea : linea,
          italics: !infantil, size: tz(infantil ? 22 : 20),
          color: infantil ? '2F7D32' : estilo === 'bn' ? '333333' : '444444',
          font: tema.fuente
        })],
        shading: infantil ? { type: d.ShadingType.CLEAR, fill: 'EFFAEC' } : undefined,
        spacing: { before: j === 0 ? 160 : 0, after: 40 }
      }));
    });
  }

  // casilla "¡Lo logré!" para que el niño marque el paso terminado
  if (infantil) {
    out.push(new d.Paragraph({
      alignment: d.AlignmentType.RIGHT,
      children: [
        new d.TextRun({ text: '☐  ', size: tz(32), color: acento }),
        new d.TextRun({ text: '¡Lo logré!', bold: true, size: tz(24), color: acento, font: tema.fuente })
      ],
      spacing: { before: 160, after: 40 }
    }));
  }

  return out;
}

// zona de código de una ficha: bloques (imagen) y/o código como texto
function zonaCodigoDocx(d, ficha, bloques, anchoMax, tema) {
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
    out.push(...codigoComoParrafos(d, ficha.codigo, tema));
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
function codigoComoParrafos(d, codigo, tema) {
  const tz = tema ? tema.tz : (s) => s;
  const conFondo = tema && (tema.estilo === 'simple' || tema.estilo === 'bn') ? undefined : { type: d.ShadingType.CLEAR, fill: 'F2F2F0' };
  const lineas = codigo.replace(/\t/g, '    ').split('\n');
  return lineas.map((linea, i) => new d.Paragraph({
    children: [new d.TextRun({ text: linea || ' ', font: 'Consolas', size: tz(18) })],
    shading: conFondo,
    spacing: { before: i === 0 ? 80 : 0, after: i === lineas.length - 1 ? 120 : 0, line: 240 }
  }));
}

function imagenComoParrafos(d, imagen, anchoMax, epigrafe, centrar, tema) {
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
      children: [new d.TextRun({ text: epigrafe.trim(), italics: true, size: tema ? tema.tz(18) : 18, color: '666666', font: tema ? tema.fuente : undefined })],
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

// tabla 1×1 que hace de marco de la ficha (color/grosor según el diseño)
function tablaMarco(d, contenido, acento, estilo) {
  const linea = acento
    ? { style: d.BorderStyle.SINGLE, size: 28, color: acento }
    : estilo === 'simple'
      ? { style: d.BorderStyle.SINGLE, size: 6, color: '999999' }
      : { style: d.BorderStyle.SINGLE, size: 12, color: '111111' };
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

// convierte una imagen (dataURL) a escala de grises para el diseño blanco y negro
function aEscalaDeGrises(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.filter = 'grayscale(1) contrast(1.15)';
        ctx.drawImage(img, 0, 0);
        resolve(c.toDataURL('image/png'));
      } catch (e) { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function dataUrlABytes(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
