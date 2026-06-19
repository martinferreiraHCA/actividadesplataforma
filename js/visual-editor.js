// Editor visual de preguntas — estilo H5P
// Permite crear y editar preguntas de forma interactiva sin escribir código
import { TIPOS_PREGUNTA } from './activities.js';
import { crearPreguntaVacia } from './parser.js';
import { PRESETS_TAMANO, redimensionarDataUrl, medirImagen, pesoKbDataUrl } from './image-resize.js';

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
    // Compatibilidad: borradores viejos no guardan el dataUrl original.
    // Sin él, redimensionar partiría de la versión ya reducida; usamos
    // el dataUrl actual como original para que el selector siga funcionando.
    this.preguntas.forEach(p => {
      if (p.imagen && p.imagen.dataUrl && !p.imagen.original) {
        p.imagen.original = p.imagen.dataUrl;
      }
    });
    this.renumerar();
    this.render();
  }

  render() {
    this.contenedor.innerHTML = '';

    if (this.preguntas.length === 0) {
      this.contenedor.innerHTML = `
        <div class="ve-vacio">
          <div class="ve-vacio__icono">◳</div>
          <p class="ve-vacio__titulo">Sin preguntas todavía</p>
          <p class="ve-vacio__sub">Usá los botones de arriba para agregar tu primera pregunta,<br>o pasá a "Importar Texto" para pegar varias de una.</p>
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

        ${this.renderImagen(p, idx)}

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

  // Redimensiona la imagen de la pregunta a un ancho objetivo (0 = original)
  // re-codificándola desde el dataUrl original para no perder calidad.
  async aplicarTamanoImagen(p, ancho) {
    if (!p.imagen || !p.imagen.original) return;
    try {
      p.imagen.dataUrl = await redimensionarDataUrl(p.imagen.original, ancho, p.imagen.tipo);
      p.imagen.ancho = ancho || 0;
      this.onUpdate(this.preguntas);
      this.render();
    } catch (err) {
      alert('No se pudo redimensionar la imagen: ' + err.message);
    }
  }

  renderImagen(p, idx) {
    if (p.imagen && p.imagen.dataUrl) {
      const img = p.imagen;
      const esSvg = img.tipo === 'image/svg+xml';
      const anchoActual = img.ancho || 0;
      const dims = (img.anchoOriginal && img.altoOriginal)
        ? `${img.anchoOriginal}×${img.altoOriginal}px original`
        : '';
      const pesoTxt = img.dataUrl ? `${pesoKbDataUrl(img.dataUrl)} KB` : '';

      // Detecta si el ancho actual coincide con un preset; si no, es "custom".
      const presetActivo = PRESETS_TAMANO.find(pr => pr.ancho === anchoActual);
      const opciones = PRESETS_TAMANO.map(pr =>
        `<option value="${pr.ancho}" ${pr.ancho === anchoActual ? 'selected' : ''}>${pr.label}</option>`
      ).join('');
      const customSel = presetActivo ? '' : 'selected';

      const selectorTamano = esSvg ? `<span class="ve-imagen-svg-nota">SVG (vectorial, no se redimensiona)</span>` : `
        <div class="ve-imagen-tamano">
          <label class="ve-imagen-tamano__label">Tamaño:</label>
          <select class="ve-imagen-preset">
            ${opciones}
            <option value="custom" ${customSel}>Personalizado…</option>
          </select>
          <span class="ve-imagen-custom" style="${presetActivo ? 'display:none' : ''}">
            <input type="number" class="ve-imagen-ancho" min="50" max="4000" step="10"
              value="${anchoActual || (img.anchoOriginal || '')}" placeholder="ancho"> px
          </span>
        </div>`;

      return `
        <div class="campo ve-imagen-campo" style="margin-top:1rem">
          <label class="campo__etiqueta">Imagen de la pregunta</label>
          <div class="ve-imagen-preview">
            <img src="${img.dataUrl}" alt="${escapeHtml(img.nombre || '')}">
            <div class="ve-imagen-info">
              <span class="ve-imagen-nombre">${escapeHtml(img.nombre || 'imagen')}</span>
              <span class="ve-imagen-meta">${dims}${dims && pesoTxt ? ' · ' : ''}${pesoTxt}</span>
              ${selectorTamano}
              <button class="btn btn--ghost ve-btn-quitar-imagen" type="button" style="padding:0.4em 1em;font-size:0.65rem">Quitar imagen</button>
            </div>
          </div>
        </div>
      `;
    }
    return `
      <div class="campo ve-imagen-campo" style="margin-top:1rem">
        <label class="campo__etiqueta">Imagen (opcional)</label>
        <button class="btn btn--ghost ve-btn-agregar-imagen" type="button" style="padding:0.4em 1em;font-size:0.65rem">+ Agregar imagen</button>
        <input type="file" class="ve-input-imagen" accept="image/*" style="display:none">
      </div>
    `;
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
      case 'ordenamiento':
        return this.renderOrdenamiento(p, idx);
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

  renderOrdenamiento(p, idx) {
    const items = (p.items || []).map((it, ii) => `
      <div class="ve-orden-item" style="display:grid;grid-template-columns:auto 1fr auto;gap:0.5rem;align-items:center;margin-bottom:0.4rem" data-ii="${ii}">
        <span class="ve-orden-num">${ii + 1}</span>
        <input type="text" class="campo__input ve-orden-texto" value="${escapeHtml(it)}" placeholder="Elemento ${ii + 1}...">
        <button class="ve-btn ve-btn-quitar-orden" title="Quitar" ${(p.items || []).length <= 2 ? 'disabled' : ''}>✕</button>
      </div>
    `).join('');

    return `
      <div class="campo">
        <label class="campo__etiqueta">Elementos en el orden correcto (el alumno los recibe mezclados)</label>
        <div class="ve-orden-lista">${items}</div>
        <button class="ve-btn-agregar-orden btn btn--ghost" style="margin-top:0.5rem;padding:0.4em 1em;font-size:0.65rem">
          + Agregar elemento
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

    // Imagen de la pregunta (una por pregunta, opcional)
    const btnAgregarImg = card.querySelector('.ve-btn-agregar-imagen');
    const inputImg = card.querySelector('.ve-input-imagen');
    if (btnAgregarImg && inputImg) {
      btnAgregarImg.addEventListener('click', () => inputImg.click());
      inputImg.addEventListener('change', () => {
        const file = inputImg.files && inputImg.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
          alert('Elegí un archivo de imagen (PNG, JPG, WebP, SVG o GIF).');
          return;
        }
        if (file.size > 10 * 1024 * 1024) {
          alert('La imagen pesa más de 10 MB. Probá con una más liviana.');
          return;
        }
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = reader.result;
          let anchoOriginal = 0, altoOriginal = 0;
          try {
            const dim = await medirImagen(dataUrl);
            anchoOriginal = dim.ancho;
            altoOriginal = dim.alto;
          } catch (_) { /* SVG sin viewBox u otros: seguimos sin dimensiones */ }
          p.imagen = {
            nombre: file.name,
            tipo: file.type,
            original: dataUrl,   // se conserva intacto para redimensionar sin perder calidad
            dataUrl: dataUrl,    // versión mostrada y exportada
            anchoOriginal,
            altoOriginal,
            ancho: 0             // 0 = tamaño original
          };
          this.render();
        };
        reader.readAsDataURL(file);
      });
    }

    // Redimensionado de imagen
    const preset = card.querySelector('.ve-imagen-preset');
    const customWrap = card.querySelector('.ve-imagen-custom');
    const inputAncho = card.querySelector('.ve-imagen-ancho');
    if (preset) {
      preset.addEventListener('change', async () => {
        if (preset.value === 'custom') {
          if (customWrap) customWrap.style.display = '';
          if (inputAncho) inputAncho.focus();
          return;
        }
        if (customWrap) customWrap.style.display = 'none';
        await this.aplicarTamanoImagen(p, parseInt(preset.value, 10) || 0);
      });
    }
    if (inputAncho) {
      inputAncho.addEventListener('change', async () => {
        const v = parseInt(inputAncho.value, 10);
        if (!v || v < 50) return;
        await this.aplicarTamanoImagen(p, v);
      });
    }

    card.querySelector('.ve-btn-quitar-imagen')?.addEventListener('click', () => {
      p.imagen = null;
      this.render();
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

    // Ordenamiento
    card.querySelectorAll('.ve-orden-texto').forEach((input, ii) => {
      input.addEventListener('input', () => { p.items[ii] = input.value; });
    });

    card.querySelectorAll('.ve-btn-quitar-orden').forEach((btn, ii) => {
      btn.addEventListener('click', () => {
        if ((p.items || []).length > 2) {
          p.items.splice(ii, 1);
          this.render();
        }
      });
    });

    card.querySelector('.ve-btn-agregar-orden')?.addEventListener('click', () => {
      if (!p.items) p.items = [];
      p.items.push("");
      this.render();
    });
  }

  abrirOrdenador() {
    if (this.preguntas.length < 2) return;
    const overlay = document.createElement('div');
    overlay.className = 've-ordenar-overlay';

    const modal = document.createElement('div');
    modal.className = 've-ordenar-modal';

    const titulo = document.createElement('div');
    titulo.className = 've-ordenar-titulo';
    titulo.textContent = 'Ordenar preguntas';
    modal.appendChild(titulo);

    const lista = document.createElement('div');
    lista.className = 've-ordenar-lista';

    let dragIdx = null;

    const crearItem = (p, idx) => {
      const item = document.createElement('div');
      item.className = 've-ordenar-item';
      item.draggable = true;
      item.dataset.idx = idx;

      const handle = document.createElement('span');
      handle.className = 've-ordenar-handle';
      handle.textContent = '⠿';

      const label = document.createElement('span');
      label.className = 've-ordenar-label';
      const preview = (p.enunciado || '').trim().substring(0, 45);
      label.textContent = `P${p.numero}: ${preview || '(sin enunciado)'}`;
      if (preview.length < (p.enunciado || '').trim().length) label.textContent += '...';

      const badge = document.createElement('span');
      badge.className = 've-ordenar-badge';
      badge.textContent = (TIPOS_PREGUNTA[p.tipo] || p.tipo);

      item.appendChild(handle);
      item.appendChild(label);
      item.appendChild(badge);

      item.addEventListener('dragstart', (e) => {
        dragIdx = idx;
        item.classList.add('ve-ordenar-item--dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('ve-ordenar-item--dragging');
        dragIdx = null;
        lista.querySelectorAll('.ve-ordenar-item--over').forEach(el =>
          el.classList.remove('ve-ordenar-item--over')
        );
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (parseInt(item.dataset.idx) !== dragIdx) {
          item.classList.add('ve-ordenar-item--over');
        }
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('ve-ordenar-item--over');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('ve-ordenar-item--over');
        const dropIdx = parseInt(item.dataset.idx);
        if (dragIdx === null || dragIdx === dropIdx) return;

        const items = Array.from(lista.children);
        const order = items.map(it => parseInt(it.dataset.idx));
        const moved = order.splice(dragIdx, 1)[0];
        order.splice(dropIdx, 0, moved);

        const reordered = order.map(i => this.preguntas[i]);
        this.preguntas = reordered;
        this.renumerar();

        lista.innerHTML = '';
        this.preguntas.forEach((pr, i) => lista.appendChild(crearItem(pr, i)));
      });

      return item;
    };

    this.preguntas.forEach((p, i) => lista.appendChild(crearItem(p, i)));
    modal.appendChild(lista);

    const acciones = document.createElement('div');
    acciones.className = 've-ordenar-acciones';

    const btnCerrar = document.createElement('button');
    btnCerrar.className = 'btn btn--primary';
    btnCerrar.textContent = 'Listo';
    btnCerrar.addEventListener('click', () => {
      overlay.remove();
      this.render();
    });

    acciones.appendChild(btnCerrar);
    modal.appendChild(acciones);
    overlay.appendChild(modal);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        this.render();
      }
    });

    document.body.appendChild(overlay);
  }
}
