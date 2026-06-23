// Exportación de rúbricas a CSV, HTML y JSON

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
