// Exportación de rúbricas a CSV, HTML, JSON, Moodle XML y Apps Script

export function exportarRubricaCSV(rubrica, titulo) {
  const rows = [];
  const header = ['Criterio', 'Peso', ...rubrica.niveles.map(n => `${n.nombre} (${n.puntos} pts)`)];
  rows.push(header.map(csvEsc).join(','));

  rubrica.criterios.forEach(c => {
    const row = [c.nombre, c.peso, ...c.descripciones];
    rows.push(row.map(csvEsc).join(','));
  });

  return '﻿' + rows.join('\r\n');
}

export function exportarRubricaHTML(rubrica, titulo) {
  let html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${esc(titulo || 'Rúbrica')}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 960px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
  h1 { font-size: 1.5rem; margin-bottom: 1rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th, td { border: 1px solid #ccc; padding: 0.6rem 0.8rem; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; font-weight: 600; }
  .criterio { font-weight: 600; min-width: 120px; }
  .peso { text-align: center; min-width: 50px; }
  .pts { font-size: 0.8em; opacity: 0.6; display: block; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
<h1>${esc(titulo || 'Rúbrica')}</h1>
<table>
  <thead>
    <tr>
      <th class="criterio">Criterio</th>
      <th class="peso">Peso</th>`;

  rubrica.niveles.forEach(n => {
    html += `\n      <th>${esc(n.nombre)}<span class="pts">${n.puntos} pts</span></th>`;
  });

  html += `\n    </tr>\n  </thead>\n  <tbody>`;

  rubrica.criterios.forEach(c => {
    html += `\n    <tr>\n      <td class="criterio">${esc(c.nombre)}</td>\n      <td class="peso">${c.peso}</td>`;
    c.descripciones.forEach(d => {
      html += `\n      <td>${esc(d)}</td>`;
    });
    html += `\n    </tr>`;
  });

  const maxPts = Math.max(...rubrica.niveles.map(n => n.puntos));
  const totalMax = rubrica.criterios.reduce((s, c) => s + c.peso * maxPts, 0);

  html += `\n  </tbody>\n</table>
<p style="margin-top:1rem;font-size:0.85rem;opacity:0.6">Puntaje máximo: ${totalMax} puntos</p>
</body>
</html>`;

  return html;
}

export function exportarRubricaJSON(rubrica, titulo) {
  return JSON.stringify({ tipo: 'rubrica', titulo, rubrica }, null, 2);
}

export function importarRubricaJSON(texto) {
  const data = JSON.parse(texto);
  if (!data.rubrica || !data.rubrica.niveles || !data.rubrica.criterios) {
    throw new Error('El archivo no contiene una rúbrica válida.');
  }
  return { rubrica: data.rubrica, titulo: data.titulo || '' };
}

export function exportarRubricaMoodleXML(rubrica, titulo) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<rubric>\n`;
  xml += `  <name>${esc(titulo || 'Rúbrica')}</name>\n`;
  xml += `  <description>Rúbrica generada con el Generador de Actividades</description>\n`;
  xml += `  <criteria>\n`;

  rubrica.criterios.forEach((crit, ci) => {
    xml += `    <criterion>\n`;
    xml += `      <shortname>${esc(crit.nombre)}</shortname>\n`;
    xml += `      <description>${esc(crit.nombre)}</description>\n`;
    xml += `      <sortorder>${ci}</sortorder>\n`;
    xml += `      <levels>\n`;
    rubrica.niveles.forEach((niv, ni) => {
      const desc = crit.descripciones[ni] || '';
      const pts = niv.puntos * (crit.peso || 1);
      xml += `        <level>\n`;
      xml += `          <score>${pts}</score>\n`;
      xml += `          <definition>${esc(desc || niv.nombre)}</definition>\n`;
      xml += `          <sortorder>${ni}</sortorder>\n`;
      xml += `        </level>\n`;
    });
    xml += `      </levels>\n`;
    xml += `    </criterion>\n`;
  });

  xml += `  </criteria>\n`;
  xml += `</rubric>`;
  return xml;
}

export function exportarRubricaAppsScript(rubrica, titulo) {
  const t = escJS(titulo || 'Rúbrica');
  let script = `// Google Apps Script — Crea una rúbrica en Google Classroom
// Instrucciones:
// 1. Abrí script.google.com y creá un nuevo proyecto
// 2. Pegá este código y ejecutá la función crearRubrica()
// 3. Autorizá los permisos cuando te lo pida
// 4. La rúbrica se crea como un Google Sheet con formato de tabla

function crearRubrica() {
  var ss = SpreadsheetApp.create('${t}');
  var sheet = ss.getActiveSheet();
  sheet.setName('Rúbrica');

  // Encabezados
  var headers = ['Criterio', 'Peso'`;

  rubrica.niveles.forEach(n => {
    script += `, '${escJS(n.nombre)} (${n.puntos} pts)'`;
  });

  script += `];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#1a1a1a')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  // Datos
  var datos = [\n`;

  rubrica.criterios.forEach((crit, ci) => {
    script += `    ['${escJS(crit.nombre)}', ${crit.peso}`;
    crit.descripciones.forEach(d => {
      script += `, '${escJS(d)}'`;
    });
    script += `]${ci < rubrica.criterios.length - 1 ? ',' : ''}\n`;
  });

  script += `  ];
  if (datos.length > 0) {
    sheet.getRange(2, 1, datos.length, headers.length).setValues(datos);
  }

  // Formato
  sheet.getRange(2, 1, datos.length, 1).setFontWeight('bold');
  sheet.getRange(2, 2, datos.length, 1).setHorizontalAlignment('center');
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 60);
  for (var i = 3; i <= headers.length; i++) {
    sheet.setColumnWidth(i, 220);
  }
  sheet.getRange(1, 1, datos.length + 1, headers.length)
    .setBorder(true, true, true, true, true, true);
  sheet.getRange(2, 1, datos.length, headers.length).setWrap(true);

  Logger.log('Rúbrica creada: ' + ss.getUrl());
  SpreadsheetApp.getUi().alert('Rúbrica creada.\\nAbrila desde Google Drive o con este link:\\n' + ss.getUrl());
}`;

  return script;
}

function escJS(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

function csvEsc(val) {
  const s = String(val == null ? '' : val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
