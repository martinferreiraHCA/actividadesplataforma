// Export formato Moodle XML

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cdata(str) {
  return `<![CDATA[${str}]]>`;
}

function enunciadoHtml(texto) {
  let html = escapeXml(texto);
  html = html.replace(/\[IMG:\s*([^\]]+)\]/gi, (m, token) =>
    `<br/><img src="@@PLUGINFILE@@/${escapeXml(token.trim())}" alt="${escapeXml(token.trim())}"/><br/>`
  );
  html = html.replace(/\n/g, '<br/>');
  return html;
}

export function generarMoodleXML(preguntas, titulo) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<quiz>\n`;

  if (titulo) {
    xml += `  <question type="category">\n    <category><text>$course$/${escapeXml(titulo)}</text></category>\n  </question>\n\n`;
  }

  preguntas.forEach(p => {
    switch (p.tipo) {
      case 'opcion_multiple': {
        const correctas = p.opciones.filter(o => o.correcta).length;
        const single = correctas <= 1;
        xml += `  <question type="multichoice">\n`;
        xml += `    <name><text>${escapeXml(`P${p.numero}`)}</text></name>\n`;
        xml += `    <questiontext format="html"><text>${cdata(enunciadoHtml(p.enunciado))}</text></questiontext>\n`;
        xml += `    <defaultgrade>${p.puntaje}</defaultgrade>\n`;
        xml += `    <single>${single}</single>\n`;
        xml += `    <shuffleanswers>1</shuffleanswers>\n`;
        if (p.retro) {
          xml += `    <generalfeedback format="html"><text>${cdata(escapeXml(p.retro))}</text></generalfeedback>\n`;
        }
        p.opciones.forEach(op => {
          const fraccion = op.correcta ? (single ? 100 : Math.round(100 / correctas)) : 0;
          xml += `    <answer fraction="${fraccion}" format="html">\n`;
          xml += `      <text>${cdata(escapeXml(op.texto))}</text>\n`;
          xml += `    </answer>\n`;
        });
        xml += `  </question>\n\n`;
        break;
      }

      case 'verdadero_falso': {
        xml += `  <question type="truefalse">\n`;
        xml += `    <name><text>${escapeXml(`P${p.numero}`)}</text></name>\n`;
        xml += `    <questiontext format="html"><text>${cdata(enunciadoHtml(p.enunciado))}</text></questiontext>\n`;
        xml += `    <defaultgrade>${p.puntaje}</defaultgrade>\n`;
        if (p.retro) {
          xml += `    <generalfeedback format="html"><text>${cdata(escapeXml(p.retro))}</text></generalfeedback>\n`;
        }
        xml += `    <answer fraction="${p.respuestaCorrecta ? 100 : 0}" format="moodle_auto_format"><text>true</text></answer>\n`;
        xml += `    <answer fraction="${p.respuestaCorrecta ? 0 : 100}" format="moodle_auto_format"><text>false</text></answer>\n`;
        xml += `  </question>\n\n`;
        break;
      }

      case 'respuesta_corta': {
        xml += `  <question type="shortanswer">\n`;
        xml += `    <name><text>${escapeXml(`P${p.numero}`)}</text></name>\n`;
        xml += `    <questiontext format="html"><text>${cdata(enunciadoHtml(p.enunciado))}</text></questiontext>\n`;
        xml += `    <defaultgrade>${p.puntaje}</defaultgrade>\n`;
        xml += `    <usecase>0</usecase>\n`;
        p.respuestasAceptadas.forEach(r => {
          xml += `    <answer fraction="100" format="moodle_auto_format"><text>${cdata(r)}</text></answer>\n`;
        });
        xml += `  </question>\n\n`;
        break;
      }

      case 'numerica': {
        xml += `  <question type="numerical">\n`;
        xml += `    <name><text>${escapeXml(`P${p.numero}`)}</text></name>\n`;
        xml += `    <questiontext format="html"><text>${cdata(enunciadoHtml(p.enunciado))}</text></questiontext>\n`;
        xml += `    <defaultgrade>${p.puntaje}</defaultgrade>\n`;
        xml += `    <answer fraction="100"><text>${p.respuestaCorrecta}</text><tolerance>${p.tolerancia}</tolerance></answer>\n`;
        xml += `  </question>\n\n`;
        break;
      }

      case 'emparejamiento': {
        xml += `  <question type="matching">\n`;
        xml += `    <name><text>${escapeXml(`P${p.numero}`)}</text></name>\n`;
        xml += `    <questiontext format="html"><text>${cdata(enunciadoHtml(p.enunciado))}</text></questiontext>\n`;
        xml += `    <defaultgrade>${p.puntaje}</defaultgrade>\n`;
        xml += `    <shuffleanswers>1</shuffleanswers>\n`;
        p.pares.forEach(par => {
          xml += `    <subquestion format="html"><text>${cdata(escapeXml(par.izquierda))}</text><answer><text>${cdata(par.derecha)}</text></answer></subquestion>\n`;
        });
        xml += `  </question>\n\n`;
        break;
      }

      case 'ensayo': {
        xml += `  <question type="essay">\n`;
        xml += `    <name><text>${escapeXml(`P${p.numero}`)}</text></name>\n`;
        xml += `    <questiontext format="html"><text>${cdata(enunciadoHtml(p.enunciado))}</text></questiontext>\n`;
        xml += `    <defaultgrade>${p.puntaje}</defaultgrade>\n`;
        xml += `    <responseformat>editor</responseformat>\n`;
        xml += `    <responserequired>1</responserequired>\n`;
        xml += `  </question>\n\n`;
        break;
      }
    }
  });

  xml += `</quiz>`;
  return xml;
}
