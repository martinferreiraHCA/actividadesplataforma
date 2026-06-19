// Renderiza las preguntas parseadas como cards editables
import { TIPOS_PREGUNTA } from './activities.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderEnunciado(texto) {
  let html = escapeHtml(texto);
  html = html.replace(/\[IMG:\s*([^\]]+)\]/gi, '<span class="chip-imagen chip-imagen--pendiente" data-token="$1">🖼️ $1</span>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

export function renderPreguntas(preguntas, contenedor) {
  contenedor.innerHTML = '';

  preguntas.forEach((p, idx) => {
    const card = document.createElement('div');
    card.className = 'pregunta-card';
    card.dataset.index = idx;

    const tipoLabel = TIPOS_PREGUNTA[p.tipo] || p.tipo;

    let cuerpo = '';

    switch (p.tipo) {
      case 'opcion_multiple':
      case 'verdadero_falso': {
        const esMultiple = p.opciones.filter(o => o.correcta).length > 1;
        const inputType = esMultiple ? 'checkbox' : 'radio';
        const nombre = `pregunta_${idx}`;
        cuerpo = p.opciones.map((op, oi) => `
          <label class="opcion-item ${op.correcta ? 'opcion-item--correcta' : ''}">
            <input type="${inputType}" name="${nombre}" data-idx="${idx}" data-oi="${oi}"
              ${op.correcta ? 'checked' : ''}>
            <span class="opcion-item__texto" contenteditable="true" data-idx="${idx}" data-oi="${oi}">${escapeHtml(op.texto)}</span>
          </label>
        `).join('');
        break;
      }
      case 'respuesta_corta':
        cuerpo = `<div class="alerta alerta--info" style="margin-top:0">
          <strong>Respuestas aceptadas:</strong>
          <span contenteditable="true" data-idx="${idx}" data-campo="respuestasAceptadas">${escapeHtml(p.respuestasAceptadas.join(' | '))}</span>
        </div>`;
        break;
      case 'numerica':
        cuerpo = `<div class="alerta alerta--info" style="margin-top:0">
          <strong>Respuesta:</strong>
          <span contenteditable="true" data-idx="${idx}" data-campo="respuestaNum">${p.respuestaCorrecta}</span>
          ± <span contenteditable="true" data-idx="${idx}" data-campo="tolerancia">${p.tolerancia}</span>
        </div>`;
        break;
      case 'emparejamiento':
        cuerpo = `<table style="width:100%;font-size:var(--texto-sm);border-collapse:collapse">
          <thead><tr><th style="text-align:left;padding:4px 8px;border-bottom:1px solid var(--color-borde)">Elemento</th>
          <th style="text-align:left;padding:4px 8px;border-bottom:1px solid var(--color-borde)">Par</th></tr></thead>
          <tbody>
          ${p.pares.map((par, pi) => `
            <tr>
              <td style="padding:4px 8px;border-bottom:1px solid var(--color-fondo)">
                <span contenteditable="true" data-idx="${idx}" data-pi="${pi}" data-lado="izq">${escapeHtml(par.izquierda)}</span>
              </td>
              <td style="padding:4px 8px;border-bottom:1px solid var(--color-fondo)">
                <span contenteditable="true" data-idx="${idx}" data-pi="${pi}" data-lado="der">${escapeHtml(par.derecha)}</span>
              </td>
            </tr>
          `).join('')}
          </tbody></table>`;
        break;
      case 'ensayo':
        cuerpo = `<div class="alerta alerta--aviso" style="margin-top:0">
          Corrección manual — sin respuesta automática.
        </div>`;
        break;
    }

    card.innerHTML = `
      <div class="pregunta-card__cabecera">
        <div style="display:flex;align-items:center;gap:var(--espacio-sm)">
          <span class="pregunta-card__badge">${tipoLabel}</span>
          <span style="font-size:var(--texto-sm);color:var(--color-texto-secundario)">P${p.numero}</span>
        </div>
        <div class="pregunta-card__puntaje">
          <input type="number" value="${p.puntaje}" min="0" max="100" data-idx="${idx}" data-campo="puntaje" aria-label="Puntaje"> pt
        </div>
      </div>
      <div class="pregunta-card__enunciado" contenteditable="true" data-idx="${idx}" data-campo="enunciado">${renderEnunciado(p.enunciado)}</div>
      ${cuerpo}
      ${p.retro ? `<div class="pregunta-card__retro">💡 <span contenteditable="true" data-idx="${idx}" data-campo="retro">${escapeHtml(p.retro)}</span></div>` : ''}
    `;

    contenedor.appendChild(card);
  });

  // Listeners para edición inline
  contenedor.addEventListener('change', (e) => {
    const el = e.target;
    const idx = parseInt(el.dataset.idx);
    if (isNaN(idx)) return;

    if (el.dataset.campo === 'puntaje') {
      preguntas[idx].puntaje = parseInt(el.value) || 1;
    }
    if (el.type === 'radio' || el.type === 'checkbox') {
      const oi = parseInt(el.dataset.oi);
      if (el.type === 'radio') {
        preguntas[idx].opciones.forEach((o, i) => o.correcta = i === oi);
      } else {
        preguntas[idx].opciones[oi].correcta = el.checked;
      }
      renderPreguntas(preguntas, contenedor);
    }
  });

  contenedor.addEventListener('blur', (e) => {
    const el = e.target;
    const idx = parseInt(el.dataset?.idx);
    if (isNaN(idx)) return;

    if (el.dataset.campo === 'enunciado') {
      preguntas[idx].enunciado = el.textContent.trim();
    }
    if (el.dataset.campo === 'retro') {
      preguntas[idx].retro = el.textContent.trim();
    }
    if (el.dataset.campo === 'respuestasAceptadas') {
      preguntas[idx].respuestasAceptadas = el.textContent.split('|').map(s => s.trim()).filter(Boolean);
    }
    if (el.dataset.campo === 'respuestaNum') {
      preguntas[idx].respuestaCorrecta = parseFloat(el.textContent) || 0;
    }
    if (el.dataset.campo === 'tolerancia') {
      preguntas[idx].tolerancia = parseFloat(el.textContent) || 0;
    }
    if (el.dataset.oi !== undefined) {
      preguntas[idx].opciones[parseInt(el.dataset.oi)].texto = el.textContent.trim();
    }
    if (el.dataset.pi !== undefined) {
      const pi = parseInt(el.dataset.pi);
      if (el.dataset.lado === 'izq') preguntas[idx].pares[pi].izquierda = el.textContent.trim();
      if (el.dataset.lado === 'der') preguntas[idx].pares[pi].derecha = el.textContent.trim();
    }
  }, true);
}
