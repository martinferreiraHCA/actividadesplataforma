// Editor visual de preguntas — estilo H5P
// Permite crear y editar preguntas de forma interactiva sin escribir código
import { TIPOS_PREGUNTA } from './activities.js';
import { crearPreguntaVacia } from './parser.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export class EditorVisual {
  constructor(contenedor, onUpdate) {
    this.contenedor = contenedor;
    this.preguntas = [];
    this.onUpdate = onUpdate || (() => {});
  }

  agregarPregunta(tipo) {
    const num = this.preguntas.length + 1;
    const p = crearPreguntaVacia(tipo, num);
    this.preguntas.push(p);
    this.render();
    // Scroll al final y focus en el enunciado
    setTimeout(() => {
      const cards = this.contenedor.querySelectorAll('.ve-card');
      const last = cards[cards.length - 1];
      if (last) {
        last.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const input = last.querySelector('.ve-enunciado');
        if (input) input.focus();
      }
    }, 100);
  }

  eliminarPregunta(idx) {
    this.preguntas.splice(idx, 1);
    this.renumerar();
    this.render();
  }

  duplicarPregunta(idx) {
    const copia = JSON.parse(JSON.stringify(this.preguntas[idx]));
    copia.numero = this.preguntas.length + 1;
    this.preguntas.splice(idx + 1, 0, copia);
    this.renumerar();
    this.render();
  }

  moverPregunta(idx, dir) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= this.preguntas.length) return;
    const temp = this.preguntas[idx];
    this.preguntas[idx] = this.preguntas[newIdx];
    this.preguntas[newIdx] = temp;
    this.renumerar();
    this.render();
  }

  renumerar() {
    this.preguntas.forEach((p, i) => p.numero = i + 1);
  }

  cargarPreguntas(preguntas) {
    this.preguntas = preguntas;
    this.renumerar();
    this.render();
  }

  render() {
    this.contenedor.innerHTML = '';

    if (this.preguntas.length === 0) {
      this.contenedor.innerHTML = `
        <div style="text-align:center;padding:3rem 1rem;opacity:0.4">
          <p style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:var(--fs-h3);text-transform:uppercase;margin-bottom:0.5rem">
            Sin preguntas todavía
          </p>
          <p style="font-size:var(--fs-data)">Usá los botones de arriba para agregar preguntas.</p>
        </div>
      `;
      this.onUpdate(this.preguntas);
      return;
    }

    this.preguntas.forEach((p, idx) => {
      const card = document.createElement('div');
      card.className = 've-card pregunta-card';
      card.dataset.idx = idx;

      const tipoLabel = TIPOS_PREGUNTA[p.tipo] || p.tipo;

      card.innerHTML = `
        <div class="pregunta-card__cabecera">
          <div style="display:flex;align-items:center;gap:0.8rem">
            <span class="pregunta-card__badge">${escapeHtml(tipoLabel)}</span>
            <span class="pregunta-card__num">P${p.numero}</span>
          </div>
          <div style="display:flex;align-items:center;gap:0.5rem">
            <div class="pregunta-card__puntaje">
              <input type="number" class="ve-puntaje" value="${p.puntaje}" min="0" max="100" aria-label="Puntaje"> pt
            </div>
            <div class="ve-acciones">
              <button class="ve-btn ve-btn-mover-arriba" title="Mover arriba" ${idx === 0 ? 'disabled' : ''}>↑</button>
              <button class="ve-btn ve-btn-mover-abajo" title="Mover abajo" ${idx === this.preguntas.length - 1 ? 'disabled' : ''}>↓</button>
              <button class="ve-btn ve-btn-duplicar" title="Duplicar">⧉</button>
              <button class="ve-btn ve-btn-eliminar" title="Eliminar">✕</button>
            </div>
          </div>
        </div>

        <div class="campo" style="margin-bottom:1rem">
          <label class="campo__etiqueta">Enunciado</label>
          <textarea class="campo__textarea ve-enunciado" rows="2" placeholder="Escribí la pregunta acá...">${escapeHtml(p.enunciado)}</textarea>
        </div>

        ${this.renderCuerpoTipo(p, idx)}

        <div class="campo" style="margin-top:1rem;margin-bottom:0">
          <label class="campo__etiqueta">Retroalimentación (opcional)</label>
          <input class="campo__input ve-retro" type="text" value="${escapeHtml(p.retro)}" placeholder="Explicación que ve el alumno después de responder...">
        </div>
      `;

      // Event listeners
      this.bindCardEvents(card, idx);
      this.contenedor.appendChild(card);
    });

    this.onUpdate(this.preguntas);
  }

  renderCuerpoTipo(p, idx) {
    switch (p.tipo) {
      case 'opcion_multiple':
        return this.renderOpcionMultiple(p, idx);
      case 'verdadero_falso':
        return this.renderVF(p, idx);
      case 'respuesta_corta':
        return this.renderRespuestaCorta(p, idx);
      case 'numerica':
        return this.renderNumerica(p, idx);
      case 'emparejamiento':
        return this.renderEmparejamiento(p, idx);
      case 'ensayo':
        return `<div class="alerta alerta--aviso" style="margin:0">Pregunta de desarrollo — corrección manual.</div>`;
      default:
        return '';
    }
  }

  renderOpcionMultiple(p, idx) {
    const opciones = p.opciones.map((op, oi) => `
      <div class="ve-opcion opcion-item ${op.correcta ? 'opcion-item--correcta' : ''}" data-oi="${oi}">
        <input type="radio" name="ve_correcta_${idx}" ${op.correcta ? 'checked' : ''} class="ve-radio-correcta">
        <input type="text" class="campo__input ve-opcion-texto" value="${escapeHtml(op.texto)}" placeholder="Opción ${String.fromCharCode(65 + oi)}..." style="border:none;padding:0.3em 0.5em;flex:1">
        <button class="ve-btn ve-btn-quitar-opcion" title="Quitar opción" ${p.opciones.length <= 2 ? 'disabled' : ''}>✕</button>
      </div>
    `).join('');

    return `
      <div class="campo">
        <label class="campo__etiqueta">Opciones (marcá la correcta)</label>
        <div class="ve-opciones-lista">${opciones}</div>
        <button class="ve-btn-agregar-opcion btn btn--ghost" style="margin-top:0.5rem;padding:0.4em 1em;font-size:0.65rem">
          + Agregar opción
        </button>
      </div>
    `;
  }

  renderVF(p, idx) {
    const esV = p.respuestaCorrecta === true || (p.opciones[0] && p.opciones[0].correcta);
    return `
      <div class="campo">
        <label class="campo__etiqueta">Respuesta correcta</label>
        <div style="display:flex;gap:0.5rem">
          <label class="campo__check ${esV ? 'campo__check--activo' : ''}">
            <input type="radio" name="ve_vf_${idx}" value="true" ${esV ? 'checked' : ''} class="ve-vf-radio"> Verdadero
          </label>
          <label class="campo__check ${!esV ? 'campo__check--activo' : ''}">
            <input type="radio" name="ve_vf_${idx}" value="false" ${!esV ? 'checked' : ''} class="ve-vf-radio"> Falso
          </label>
        </div>
      </div>
    `;
  }

  renderRespuestaCorta(p, idx) {
    const respuestas = (p.respuestasAceptadas.length ? p.respuestasAceptadas : [""]).map((r, ri) => `
      <div class="ve-respuesta-item" style="display:flex;gap:0.5rem;margin-bottom:0.4rem" data-ri="${ri}">
        <input type="text" class="campo__input ve-respuesta-texto" value="${escapeHtml(r)}" placeholder="Respuesta aceptada..." style="flex:1">
        <button class="ve-btn ve-btn-quitar-respuesta" title="Quitar" ${p.respuestasAceptadas.length <= 1 ? 'disabled' : ''}>✕</button>
      </div>
    `).join('');

    return `
      <div class="campo">
        <label class="campo__etiqueta">Respuestas aceptadas</label>
        <div class="ve-respuestas-lista">${respuestas}</div>
        <button class="ve-btn-agregar-respuesta btn btn--ghost" style="margin-top:0.5rem;padding:0.4em 1em;font-size:0.65rem">
          + Agregar variante
        </button>
      </div>
    `;
  }

  renderNumerica(p, idx) {
    return `
      <div class="campo-grid">
        <div class="campo">
          <label class="campo__etiqueta">Respuesta numérica</label>
          <input type="number" class="campo__input ve-num-respuesta" value="${p.respuestaCorrecta || ''}" step="any" placeholder="Ej: 42">
        </div>
        <div class="campo">
          <label class="campo__etiqueta">Tolerancia (±)</label>
          <input type="number" class="campo__input ve-num-tolerancia" value="${p.tolerancia}" step="any" placeholder="Ej: 0.5">
        </div>
      </div>
    `;
  }

  renderEmparejamiento(p, idx) {
    const pares = p.pares.map((par, pi) => `
      <div class="ve-par-item" style="display:grid;grid-template-columns:1fr 1fr auto;gap:0.5rem;margin-bottom:0.4rem" data-pi="${pi}">
        <input type="text" class="campo__input ve-par-izq" value="${escapeHtml(par.izquierda)}" placeholder="Elemento...">
        <input type="text" class="campo__input ve-par-der" value="${escapeHtml(par.derecha)}" placeholder="Par...">
        <button class="ve-btn ve-btn-quitar-par" title="Quitar" ${p.pares.length <= 2 ? 'disabled' : ''}>✕</button>
      </div>
    `).join('');

    return `
      <div class="campo">
        <label class="campo__etiqueta">Pares (elemento = par)</label>
        <div class="ve-pares-lista">${pares}</div>
        <button class="ve-btn-agregar-par btn btn--ghost" style="margin-top:0.5rem;padding:0.4em 1em;font-size:0.65rem">
          + Agregar par
        </button>
      </div>
    `;
  }

  bindCardEvents(card, idx) {
    const p = this.preguntas[idx];

    // Enunciado
    card.querySelector('.ve-enunciado')?.addEventListener('input', (e) => {
      p.enunciado = e.target.value;
    });

    // Puntaje
    card.querySelector('.ve-puntaje')?.addEventListener('change', (e) => {
      p.puntaje = parseInt(e.target.value) || 1;
    });

    // Retro
    card.querySelector('.ve-retro')?.addEventListener('input', (e) => {
      p.retro = e.target.value;
    });

    // Acciones de card
    card.querySelector('.ve-btn-mover-arriba')?.addEventListener('click', () => this.moverPregunta(idx, -1));
    card.querySelector('.ve-btn-mover-abajo')?.addEventListener('click', () => this.moverPregunta(idx, 1));
    card.querySelector('.ve-btn-duplicar')?.addEventListener('click', () => this.duplicarPregunta(idx));
    card.querySelector('.ve-btn-eliminar')?.addEventListener('click', () => {
      if (this.preguntas.length === 1 || confirm('¿Eliminar esta pregunta?')) {
        this.eliminarPregunta(idx);
      }
    });

    // Opción múltiple
    card.querySelectorAll('.ve-radio-correcta').forEach((radio, oi) => {
      radio.addEventListener('change', () => {
        p.opciones.forEach((o, i) => o.correcta = i === oi);
        this.render();
      });
    });

    card.querySelectorAll('.ve-opcion-texto').forEach((input, oi) => {
      input.addEventListener('input', () => {
        p.opciones[oi].texto = input.value;
      });
    });

    card.querySelectorAll('.ve-btn-quitar-opcion').forEach((btn, oi) => {
      btn.addEventListener('click', () => {
        if (p.opciones.length > 2) {
          p.opciones.splice(oi, 1);
          if (!p.opciones.some(o => o.correcta)) p.opciones[0].correcta = true;
          this.render();
        }
      });
    });

    card.querySelector('.ve-btn-agregar-opcion')?.addEventListener('click', () => {
      p.opciones.push({ texto: "", correcta: false });
      this.render();
    });

    // V/F
    card.querySelectorAll('.ve-vf-radio').forEach(radio => {
      radio.addEventListener('change', () => {
        const esV = radio.value === 'true';
        p.respuestaCorrecta = esV;
        p.opciones = [
          { texto: "Verdadero", correcta: esV },
          { texto: "Falso", correcta: !esV }
        ];
        this.render();
      });
    });

    // Respuesta corta
    card.querySelectorAll('.ve-respuesta-texto').forEach((input, ri) => {
      input.addEventListener('input', () => {
        p.respuestasAceptadas[ri] = input.value;
      });
    });

    card.querySelectorAll('.ve-btn-quitar-respuesta').forEach((btn, ri) => {
      btn.addEventListener('click', () => {
        if (p.respuestasAceptadas.length > 1) {
          p.respuestasAceptadas.splice(ri, 1);
          this.render();
        }
      });
    });

    card.querySelector('.ve-btn-agregar-respuesta')?.addEventListener('click', () => {
      p.respuestasAceptadas.push("");
      this.render();
    });

    // Numérica
    card.querySelector('.ve-num-respuesta')?.addEventListener('input', (e) => {
      p.respuestaCorrecta = parseFloat(e.target.value) || 0;
    });

    card.querySelector('.ve-num-tolerancia')?.addEventListener('input', (e) => {
      p.tolerancia = parseFloat(e.target.value) || 0;
    });

    // Emparejamiento
    card.querySelectorAll('.ve-par-izq').forEach((input, pi) => {
      input.addEventListener('input', () => { p.pares[pi].izquierda = input.value; });
    });

    card.querySelectorAll('.ve-par-der').forEach((input, pi) => {
      input.addEventListener('input', () => { p.pares[pi].derecha = input.value; });
    });

    card.querySelectorAll('.ve-btn-quitar-par').forEach((btn, pi) => {
      btn.addEventListener('click', () => {
        if (p.pares.length > 2) {
          p.pares.splice(pi, 1);
          this.render();
        }
      });
    });

    card.querySelector('.ve-btn-agregar-par')?.addEventListener('click', () => {
      p.pares.push({ izquierda: "", derecha: "" });
      this.render();
    });
  }
}
