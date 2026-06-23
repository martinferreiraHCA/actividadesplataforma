// Editor visual de rúbricas — tabla interactiva de criterios × niveles
export class EditorRubrica {
  constructor(container, onUpdate) {
    this.container = container;
    this.onUpdate = onUpdate;
    this.rubrica = this.crearVacia();
  }

  crearVacia() {
    return {
      niveles: [
        { nombre: 'Excelente', puntos: 4 },
        { nombre: 'Bueno', puntos: 3 },
        { nombre: 'Suficiente', puntos: 2 },
        { nombre: 'Insuficiente', puntos: 1 }
      ],
      criterios: [
        {
          nombre: 'Criterio 1',
          peso: 1,
          descripciones: ['', '', '', '']
        }
      ]
    };
  }

  cargar(rubrica) {
    this.rubrica = rubrica;
    this.render();
  }

  obtener() {
    return this.rubrica;
  }

  agregarCriterio() {
    const n = this.rubrica.niveles.length;
    this.rubrica.criterios.push({
      nombre: `Criterio ${this.rubrica.criterios.length + 1}`,
      peso: 1,
      descripciones: Array(n).fill('')
    });
    this.render();
  }

  eliminarCriterio(idx) {
    if (this.rubrica.criterios.length <= 1) return;
    this.rubrica.criterios.splice(idx, 1);
    this.render();
  }

  agregarNivel() {
    const niveles = this.rubrica.niveles;
    const minPts = niveles.length > 0 ? Math.min(...niveles.map(n => n.puntos)) : 1;
    niveles.push({ nombre: `Nivel ${niveles.length + 1}`, puntos: Math.max(0, minPts - 1) });
    this.rubrica.criterios.forEach(c => c.descripciones.push(''));
    this.render();
  }

  eliminarNivel(idx) {
    if (this.rubrica.niveles.length <= 2) return;
    this.rubrica.niveles.splice(idx, 1);
    this.rubrica.criterios.forEach(c => c.descripciones.splice(idx, 1));
    this.render();
  }

  render() {
    const r = this.rubrica;
    const nNiveles = r.niveles.length;
    const nCriterios = r.criterios.length;

    let html = `
      <div class="rub-controles">
        <button class="tag tag--filled rub-btn" data-action="agregar-criterio">+ Criterio</button>
        <button class="tag tag--filled rub-btn" data-action="agregar-nivel">+ Nivel</button>
      </div>
      <div class="rub-tabla-wrap">
        <table class="rub-tabla">
          <thead>
            <tr>
              <th class="rub-th-criterio">Criterio</th>
              <th class="rub-th-peso">Peso</th>`;

    r.niveles.forEach((niv, ni) => {
      html += `
              <th class="rub-th-nivel">
                <input class="rub-input rub-input--nivel" type="text" value="${esc(niv.nombre)}" data-nivel="${ni}" data-field="nombre" placeholder="Nivel...">
                <div class="rub-pts-wrap">
                  <input class="rub-input rub-input--pts" type="number" value="${niv.puntos}" data-nivel="${ni}" data-field="puntos" min="0" step="1"> pts
                </div>
                ${nNiveles > 2 ? `<button class="rub-btn-x" data-action="eliminar-nivel" data-idx="${ni}" title="Eliminar nivel">×</button>` : ''}
              </th>`;
    });

    html += `
            </tr>
          </thead>
          <tbody>`;

    r.criterios.forEach((crit, ci) => {
      html += `
            <tr>
              <td class="rub-td-criterio">
                <input class="rub-input rub-input--criterio" type="text" value="${esc(crit.nombre)}" data-criterio="${ci}" data-field="nombre" placeholder="Nombre del criterio...">
                ${nCriterios > 1 ? `<button class="rub-btn-x" data-action="eliminar-criterio" data-idx="${ci}" title="Eliminar criterio">×</button>` : ''}
              </td>
              <td class="rub-td-peso">
                <input class="rub-input rub-input--pts" type="number" value="${crit.peso}" data-criterio="${ci}" data-field="peso" min="0" step="0.5">
              </td>`;

      crit.descripciones.forEach((desc, ni) => {
        html += `
              <td class="rub-td-desc">
                <textarea class="rub-textarea" data-criterio="${ci}" data-nivel="${ni}" placeholder="Describí qué se espera...">${esc(desc)}</textarea>
              </td>`;
      });

      html += `</tr>`;
    });

    html += `
          </tbody>
        </table>
      </div>
      <div class="rub-resumen">
        <span class="rub-resumen__texto">${nCriterios} criterio${nCriterios > 1 ? 's' : ''} × ${nNiveles} niveles · Puntaje máximo: <strong>${this.puntajeMax()}</strong></span>
      </div>`;

    this.container.innerHTML = html;
    this.bindEvents();
    this.onUpdate(this.rubrica);
  }

  puntajeMax() {
    const maxPts = Math.max(...this.rubrica.niveles.map(n => n.puntos));
    return this.rubrica.criterios.reduce((sum, c) => sum + c.peso * maxPts, 0);
  }

  bindEvents() {
    this.container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const idx = parseInt(btn.dataset.idx);
        if (action === 'agregar-criterio') this.agregarCriterio();
        else if (action === 'agregar-nivel') this.agregarNivel();
        else if (action === 'eliminar-criterio') this.eliminarCriterio(idx);
        else if (action === 'eliminar-nivel') this.eliminarNivel(idx);
      });
    });

    this.container.querySelectorAll('input[data-nivel]').forEach(input => {
      input.addEventListener('input', () => {
        const ni = parseInt(input.dataset.nivel);
        const field = input.dataset.field;
        if (field === 'puntos') {
          this.rubrica.niveles[ni].puntos = parseFloat(input.value) || 0;
          this.actualizarResumen();
        } else {
          this.rubrica.niveles[ni][field] = input.value;
        }
        this.onUpdate(this.rubrica);
      });
    });

    this.container.querySelectorAll('input[data-criterio]').forEach(input => {
      input.addEventListener('input', () => {
        const ci = parseInt(input.dataset.criterio);
        const field = input.dataset.field;
        if (field === 'peso') {
          this.rubrica.criterios[ci].peso = parseFloat(input.value) || 0;
          this.actualizarResumen();
        } else {
          this.rubrica.criterios[ci][field] = input.value;
        }
        this.onUpdate(this.rubrica);
      });
    });

    this.container.querySelectorAll('textarea[data-criterio]').forEach(ta => {
      ta.addEventListener('input', () => {
        const ci = parseInt(ta.dataset.criterio);
        const ni = parseInt(ta.dataset.nivel);
        this.rubrica.criterios[ci].descripciones[ni] = ta.value;
        this.onUpdate(this.rubrica);
      });
    });
  }

  actualizarResumen() {
    const el = this.container.querySelector('.rub-resumen__texto');
    if (el) {
      const nc = this.rubrica.criterios.length;
      const nn = this.rubrica.niveles.length;
      el.innerHTML = `${nc} criterio${nc > 1 ? 's' : ''} × ${nn} niveles · Puntaje máximo: <strong>${this.puntajeMax()}</strong>`;
    }
  }
}

function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function parsearRubricaTexto(texto) {
  const lineas = texto.split('\n');
  const rubrica = { niveles: [], criterios: [] };
  const advertencias = [];

  let nivelesLinea = lineas.find(l => /^NIVELES?\s*:/i.test(l.trim()));
  if (nivelesLinea) {
    const partes = nivelesLinea.replace(/^NIVELES?\s*:\s*/i, '').split('|').map(s => s.trim()).filter(Boolean);
    partes.forEach(p => {
      const match = p.match(/^(.+?)\s*\((\d+(?:\.\d+)?)\)\s*$/);
      if (match) {
        rubrica.niveles.push({ nombre: match[1].trim(), puntos: parseFloat(match[2]) });
      } else {
        rubrica.niveles.push({ nombre: p, puntos: 0 });
        advertencias.push({ mensaje: `Nivel "${p}": no se detectó puntaje, se asignó 0.` });
      }
    });
  }

  if (rubrica.niveles.length < 2) {
    rubrica.niveles = [
      { nombre: 'Excelente', puntos: 4 },
      { nombre: 'Bueno', puntos: 3 },
      { nombre: 'Suficiente', puntos: 2 },
      { nombre: 'Insuficiente', puntos: 1 }
    ];
    if (nivelesLinea) {
      advertencias.push({ mensaje: 'No se pudieron detectar los niveles. Se usaron los predeterminados (Excelente/Bueno/Suficiente/Insuficiente).' });
    }
  }

  const nNiveles = rubrica.niveles.length;
  let criterioActual = null;

  for (const linea of lineas) {
    const trimmed = linea.trim();
    if (!trimmed || /^NIVELES?\s*:/i.test(trimmed) || /^##\s*Rúbrica/i.test(trimmed)) continue;

    const headerMatch = trimmed.match(/^###?\s+(.+)$/) || trimmed.match(/^(.+?):\s*$/);
    if (headerMatch && !trimmed.startsWith('- ')) {
      if (criterioActual && criterioActual.descripciones.filter(d => d).length > 0) {
        rubrica.criterios.push(criterioActual);
      }
      const nombrePeso = headerMatch[1].replace(/:$/, '').trim();
      const pesoMatch = nombrePeso.match(/^(.+?)\s*\((?:peso\s*)?(\d+(?:\.\d+)?)\)\s*$/i);
      criterioActual = {
        nombre: pesoMatch ? pesoMatch[1].trim() : nombrePeso,
        peso: pesoMatch ? parseFloat(pesoMatch[2]) : 1,
        descripciones: Array(nNiveles).fill('')
      };
      continue;
    }

    if (criterioActual && /^[-•*]\s+/.test(trimmed)) {
      const desc = trimmed.replace(/^[-•*]\s+/, '');
      const idx = criterioActual.descripciones.findIndex(d => d === '');
      if (idx !== -1 && idx < nNiveles) {
        criterioActual.descripciones[idx] = desc;
      }
    }
  }

  if (criterioActual && criterioActual.descripciones.filter(d => d).length > 0) {
    rubrica.criterios.push(criterioActual);
  }

  if (rubrica.criterios.length === 0) {
    advertencias.push({ mensaje: 'No se detectaron criterios. Usá encabezados con ### o "Criterio:" seguidos de descripciones con guiones (-).' });
  }

  return { rubrica, advertencias };
}
