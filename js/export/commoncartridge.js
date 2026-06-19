// Arma el imsmanifest.xml + empaqueta el .imscc (Common Cartridge 1.1)
import { generarQTI } from './qti12.js';

function uid() {
  return 'cc_' + Math.random().toString(36).substring(2, 15);
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Nombre de archivo seguro y único para una imagen adjunta a una pregunta.
function nombreSeguroImagen(nombre, numero) {
  const m = String(nombre || '').match(/\.([a-z0-9]+)$/i);
  const ext = m ? '.' + m[1].toLowerCase() : '.png';
  let base = String(nombre || 'imagen').replace(/\.[a-z0-9]+$/i, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  if (!base) base = 'imagen';
  return `q${numero}_${base}${ext}`;
}

// dataURL (base64) → Uint8Array para meter el binario en el ZIP.
function dataUrlABytes(dataUrl) {
  const coma = dataUrl.indexOf(',');
  const base64 = dataUrl.slice(coma + 1);
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function generarIMSCC(preguntas, titulo, gestorImg) {
  // Asignar nombres de export a las imágenes adjuntas (inline) ANTES de generar el QTI,
  // así el enunciado puede referenciarlas con <img src="images/...">.
  const imagenesInline = [];
  const usados = new Set();
  (preguntas || []).forEach((p) => {
    if (p.imagen && p.imagen.dataUrl) {
      let nombre = nombreSeguroImagen(p.imagen.nombre, p.numero);
      while (usados.has(nombre)) nombre = nombreSeguroImagen(p.imagen.nombre, p.numero + '_' + Math.random().toString(36).slice(2, 5));
      usados.add(nombre);
      p.imagen.exportName = nombre;
      imagenesInline.push({ exportName: nombre, dataUrl: p.imagen.dataUrl });
    }
  });

  const { quizId, xml: assessmentXml } = generarQTI(preguntas, titulo, gestorImg);
  const manifestId = uid();
  const resId = uid();
  const quizFolder = `quiz_${quizId}`;

  // Recopilar imágenes por token [IMG: ...] (flujo de importación de texto)
  const imagenesIncluidas = [];
  if (gestorImg) {
    for (const token of gestorImg.tokens) {
      const archivo = gestorImg.obtenerArchivo(token);
      if (archivo) {
        imagenesIncluidas.push({ token, file: archivo.file });
      }
    }
  }

  const fileRefs = [
    ...imagenesIncluidas.map(img => `      <file href="${quizFolder}/images/${escapeXml(img.token)}"/>`),
    ...imagenesInline.map(img => `      <file href="${quizFolder}/images/${escapeXml(img.exportName)}"/>`)
  ].join('\n');

  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${manifestId}"
  xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1"
  xmlns:lomimscc="http://ltsc.ieee.org/xsd/imsccv1p1/LOM/manifest"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1 http://www.imsglobal.org/profile/cc/ccv1p1/ccv1p1_imscp_v1p2_v1p0.xsd">
  <metadata>
    <schema>IMS Common Cartridge</schema>
    <schemaversion>1.1.0</schemaversion>
  </metadata>
  <organizations>
    <organization identifier="org_1" structure="rooted-hierarchy">
      <item identifier="root">
        <item identifier="item_${quizId}" identifierref="${resId}">
          <title>${escapeXml(titulo || 'Cuestionario')}</title>
        </item>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="${resId}"
              type="imsqti_xmlv1p2/imscc_xmlv1p1/assessment"
              href="${quizFolder}/assessment.xml">
      <file href="${quizFolder}/assessment.xml"/>
${fileRefs}
    </resource>
  </resources>
</manifest>`;

  const zip = new JSZip();
  zip.file('imsmanifest.xml', manifest);
  zip.file(`${quizFolder}/assessment.xml`, assessmentXml);

  for (const img of imagenesIncluidas) {
    const buffer = await img.file.arrayBuffer();
    zip.file(`${quizFolder}/images/${img.token}`, buffer);
  }

  for (const img of imagenesInline) {
    zip.file(`${quizFolder}/images/${img.exportName}`, dataUrlABytes(img.dataUrl));
  }

  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
  return blob;
}
