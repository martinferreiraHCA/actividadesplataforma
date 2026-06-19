// Empaqueta un Content Package QTI v2.1: imsmanifest.xml + test.xml +
// un archivo por ítem en items/ + imágenes en images/.
import { generarItemsQTI21 } from './qti21.js';

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

function escapeXml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function nombreSeguroImagen(nombre, numero) {
  const m = String(nombre || '').match(/\.([a-z0-9]+)$/i);
  const ext = m ? '.' + m[1].toLowerCase() : '.png';
  let base = String(nombre || 'imagen').replace(/\.[a-z0-9]+$/i, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  if (!base) base = 'imagen';
  return `q${numero}_${base}${ext}`;
}

function dataUrlABytes(dataUrl) {
  const coma = dataUrl.indexOf(',');
  const base64 = dataUrl.slice(coma + 1);
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function generarQTI21Zip(preguntas, titulo, gestorImg) {
  // Nombrar imágenes inline (una por pregunta) antes de generar los ítems.
  const imagenesInline = [];
  const usados = new Set();
  (preguntas || []).forEach(p => {
    if (p.imagen && p.imagen.dataUrl) {
      let nombre = nombreSeguroImagen(p.imagen.nombre, p.numero);
      while (usados.has(nombre)) nombre = nombreSeguroImagen(p.imagen.nombre, p.numero + '_' + Math.random().toString(36).slice(2, 5));
      usados.add(nombre);
      p.imagen.exportName = nombre;
      imagenesInline.push({ exportName: nombre, dataUrl: p.imagen.dataUrl });
    }
  });

  // Imágenes por token [IMG: ...]
  const imagenesToken = [];
  if (gestorImg && gestorImg.tokens) {
    for (const token of gestorImg.tokens) {
      const archivo = gestorImg.obtenerArchivo(token);
      if (archivo) imagenesToken.push({ token, file: archivo.file });
    }
  }

  const items = generarItemsQTI21(preguntas, gestorImg);
  const testId = uid('test');

  // Referencias a imágenes (rutas relativas al item: ../images/...)
  const imageFileRefs = [
    ...imagenesToken.map(i => `      <file href="images/${escapeXml(i.token)}"/>`),
    ...imagenesInline.map(i => `      <file href="images/${escapeXml(i.exportName)}"/>`)
  ].join('\n');

  // assessmentTest que referencia todos los ítems.
  const itemRefs = items.map(it =>
    `        <assessmentItemRef identifier="${it.ident}" href="items/${it.ident}.xml"/>`
  ).join('\n');

  const testXml = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentTest xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p1 http://www.imsglobal.org/xsd/qti/qtiv2p1/imsqti_v2p1.xsd"
  identifier="${testId}" title="${escapeXml(titulo || 'Cuestionario')}">
  <testPart identifier="part1" navigationMode="nonlinear" submissionMode="individual">
    <assessmentSection identifier="section1" title="${escapeXml(titulo || 'Cuestionario')}" visible="true">
${itemRefs}
    </assessmentSection>
  </testPart>
  <outcomeProcessing>
    <setOutcomeValue identifier="SCORE">
      <sum>
        <testVariables variableIdentifier="SCORE"/>
      </sum>
    </setOutcomeValue>
  </outcomeProcessing>
</assessmentTest>`;

  // Recursos del manifest: el test (con dependencias a cada ítem) + un recurso por ítem.
  const itemResources = items.map(it => `    <resource identifier="${it.ident}" type="imsqti_item_xmlv2p1" href="items/${it.ident}.xml">
      <file href="items/${it.ident}.xml"/>
${imageFileRefs}
    </resource>`).join('\n');

  const itemDeps = items.map(it => `      <dependency identifierref="${it.ident}"/>`).join('\n');

  const manifestId = uid('manifest');
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${manifestId}"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:imsqti="http://www.imsglobal.org/xsd/imsqti_metadata_v2p1"
  xmlns:imsmd="http://www.imsglobal.org/xsd/imsmd_v1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 http://www.imsglobal.org/xsd/imscp_v1p1.xsd">
  <metadata>
    <schema>QTIv2.1 Package</schema>
    <schemaversion>1.0.0</schemaversion>
  </metadata>
  <organizations/>
  <resources>
    <resource identifier="${testId}" type="imsqti_test_xmlv2p1" href="test.xml">
      <file href="test.xml"/>
${itemDeps}
    </resource>
${itemResources}
  </resources>
</manifest>`;

  const zip = new JSZip();
  zip.file('imsmanifest.xml', manifest);
  zip.file('test.xml', testXml);
  for (const it of items) {
    zip.file(`items/${it.ident}.xml`, it.xml);
  }
  for (const img of imagenesToken) {
    const buffer = await img.file.arrayBuffer();
    zip.file(`images/${img.token}`, buffer);
  }
  for (const img of imagenesInline) {
    zip.file(`images/${img.exportName}`, dataUrlABytes(img.dataUrl));
  }

  return zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
}
