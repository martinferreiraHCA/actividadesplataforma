// Arma el imsmanifest.xml + empaqueta el .imscc (Common Cartridge 1.1)
import { generarQTI } from './qti12.js';

function uid() {
  return 'cc_' + Math.random().toString(36).substring(2, 15);
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function generarIMSCC(preguntas, titulo, gestorImg) {
  const { quizId, xml: assessmentXml } = generarQTI(preguntas, titulo, gestorImg);
  const manifestId = uid();
  const resId = uid();
  const quizFolder = `quiz_${quizId}`;

  // Recopilar imágenes
  const imagenesIncluidas = [];
  if (gestorImg) {
    for (const token of gestorImg.tokens) {
      const archivo = gestorImg.obtenerArchivo(token);
      if (archivo) {
        imagenesIncluidas.push({ token, file: archivo.file });
      }
    }
  }

  const fileRefs = imagenesIncluidas.map(img =>
    `      <file href="${quizFolder}/images/${escapeXml(img.token)}"/>`
  ).join('\n');

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

  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
  return blob;
}
