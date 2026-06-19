// Simulador de vista previa — muestra cómo vería el estudiante el cuestionario
// en cada plataforma (CREA/Schoology, Moodle, Google Classroom/Forms).

const TIPOS_LABEL = {
  opcion_multiple: 'Opción múltiple',
  verdadero_falso: 'Verdadero / Falso',
  respuesta_corta: 'Respuesta corta',
  numerica: 'Numérica',
  emparejamiento: 'Emparejamiento',
  ensayo: 'Ensayo / Desarrollo'
};

// ── Renders comunes ──

function renderOpciones(p, platform) {
  if (p.tipo === 'opcion_multiple' || p.tipo === 'verdadero_falso') {
    const ops = p.opciones || [];
    return ops.map((o, i) => {
      const letter = String.fromCharCode(65 + i);
      if (platform === 'classroom') {
        return `<label class="gc-option"><span class="gc-radio"></span><span>${esc(o.texto)}</span></label>`;
      }
      if (platform === 'moodle') {
        return `<div class="mo-option"><input type="radio" name="q${p.numero}" disabled><label>${esc(o.texto)}</label></div>`;
      }
      return `<div class="sc-option"><span class="sc-letter">${letter}</span><span>${esc(o.texto)}</span></div>`;
    }).join('\n');
  }

  if (p.tipo === 'respuesta_corta' || p.tipo === 'numerica') {
    if (platform === 'classroom') return `<div class="gc-input"><input type="text" placeholder="Tu respuesta" disabled></div>`;
    if (platform === 'moodle') return `<div class="mo-input"><label>Respuesta: <input type="text" disabled></label></div>`;
    return `<div class="sc-input"><input type="text" placeholder="Escribe tu respuesta" disabled></div>`;
  }

  if (p.tipo === 'emparejamiento') {
    const pares = p.pares || [];
    const derechas = pares.map(par => esc(par.derecha));
    return `<div class="match-grid">${pares.map(par =>
      `<div class="match-row"><span class="match-left">${esc(par.izquierda)}</span><select disabled>${derechas.map(d => `<option>${d}</option>`).join('')}</select></div>`
    ).join('\n')}</div>`;
  }

  if (p.tipo === 'ensayo') {
    if (platform === 'classroom') return `<div class="gc-input"><textarea rows="4" placeholder="Tu respuesta" disabled></textarea></div>`;
    if (platform === 'moodle') return `<div class="mo-textarea"><textarea rows="5" disabled></textarea></div>`;
    return `<div class="sc-textarea"><textarea rows="4" placeholder="Escribe tu respuesta..." disabled></textarea></div>`;
  }

  return '';
}

function esc(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── CSS por plataforma ──

function cssSchoology() {
  return `
    :root { --sc-bg: #f5f5f5; --sc-card: #fff; --sc-accent: #00857c; --sc-text: #333; --sc-border: #ddd; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: var(--sc-bg); color: var(--sc-text); line-height: 1.5; }
    .sc-header { background: #004d49; color: #fff; padding: 14px 24px; font-size: 14px; display: flex; align-items: center; gap: 16px; }
    .sc-header .logo { font-weight: 700; font-size: 18px; letter-spacing: 1px; }
    .sc-header .course { opacity: 0.85; font-size: 13px; }
    .sc-wrap { max-width: 780px; margin: 24px auto; padding: 0 16px; }
    .sc-quiz-title { font-size: 22px; font-weight: 600; margin-bottom: 4px; }
    .sc-quiz-meta { font-size: 13px; color: #777; margin-bottom: 20px; }
    .sc-question { background: var(--sc-card); border: 1px solid var(--sc-border); border-radius: 4px; padding: 20px; margin-bottom: 16px; }
    .sc-question-num { font-size: 12px; font-weight: 700; color: var(--sc-accent); text-transform: uppercase; margin-bottom: 8px; }
    .sc-enunciado { font-size: 15px; margin-bottom: 14px; }
    .sc-option { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border: 1px solid var(--sc-border); border-radius: 4px; margin-bottom: 6px; cursor: pointer; font-size: 14px; }
    .sc-option:hover { background: #f0faf9; border-color: var(--sc-accent); }
    .sc-letter { width: 26px; height: 26px; border-radius: 50%; background: #e8f5f4; color: var(--sc-accent); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0; }
    .sc-input input, .sc-textarea textarea { width: 100%; padding: 8px 12px; border: 1px solid var(--sc-border); border-radius: 4px; font-size: 14px; }
    .match-grid { display: flex; flex-direction: column; gap: 8px; }
    .match-row { display: flex; align-items: center; gap: 12px; }
    .match-left { min-width: 120px; font-size: 14px; }
    .match-row select { padding: 6px 10px; border: 1px solid var(--sc-border); border-radius: 4px; font-size: 14px; }
    .sc-points { font-size: 12px; color: #999; margin-top: 10px; text-align: right; }
    .sc-submit { display: flex; justify-content: flex-end; margin-top: 20px; }
    .sc-submit button { background: var(--sc-accent); color: #fff; border: none; padding: 10px 28px; border-radius: 4px; font-size: 15px; font-weight: 600; cursor: pointer; }
    .sc-footer { text-align: center; padding: 20px; font-size: 12px; color: #aaa; margin-top: 20px; }
    .sc-badge { display: inline-block; background: #e8f5f4; color: var(--sc-accent); font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; margin-left: 8px; }
  `;
}

function cssMoodle() {
  return `
    :root { --mo-bg: #f1f1f1; --mo-card: #fff; --mo-accent: #f98012; --mo-text: #333; --mo-border: #dee2e6; --mo-header: #fff; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Open Sans', sans-serif; background: var(--mo-bg); color: var(--mo-text); line-height: 1.6; }
    .mo-navbar { background: var(--mo-header); border-bottom: 1px solid var(--mo-border); padding: 10px 24px; display: flex; align-items: center; gap: 16px; }
    .mo-navbar .logo { font-weight: 700; font-size: 20px; color: var(--mo-accent); }
    .mo-navbar .breadcrumb { font-size: 13px; color: #666; }
    .mo-wrap { max-width: 820px; margin: 24px auto; padding: 0 16px; }
    .mo-quiz-header { background: var(--mo-card); border: 1px solid var(--mo-border); border-radius: 8px; padding: 20px 24px; margin-bottom: 20px; }
    .mo-quiz-title { font-size: 24px; font-weight: 700; }
    .mo-quiz-meta { font-size: 13px; color: #888; margin-top: 4px; }
    .mo-info-bar { background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #0c5460; margin-bottom: 20px; }
    .mo-question { background: var(--mo-card); border: 1px solid var(--mo-border); border-radius: 8px; padding: 20px 24px; margin-bottom: 16px; display: flex; gap: 16px; }
    .mo-q-sidebar { display: flex; flex-direction: column; align-items: center; min-width: 48px; }
    .mo-q-num { width: 38px; height: 38px; border-radius: 50%; background: #e9ecef; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; }
    .mo-q-flag { font-size: 11px; color: #999; margin-top: 6px; cursor: pointer; }
    .mo-q-body { flex: 1; }
    .mo-enunciado { font-size: 15px; margin-bottom: 12px; }
    .mo-option { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 14px; }
    .mo-option input { accent-color: var(--mo-accent); }
    .mo-input label { font-size: 14px; display: flex; align-items: center; gap: 8px; }
    .mo-input input, .mo-textarea textarea { padding: 6px 10px; border: 1px solid var(--mo-border); border-radius: 4px; font-size: 14px; width: 260px; }
    .mo-textarea textarea { width: 100%; }
    .mo-points { font-size: 12px; color: #888; text-align: right; margin-top: 8px; }
    .match-grid { display: flex; flex-direction: column; gap: 8px; }
    .match-row { display: flex; align-items: center; gap: 12px; }
    .match-left { min-width: 120px; font-size: 14px; }
    .match-row select { padding: 6px 10px; border: 1px solid var(--mo-border); border-radius: 4px; font-size: 14px; }
    .mo-nav { display: flex; justify-content: space-between; align-items: center; margin-top: 24px; }
    .mo-nav button { background: var(--mo-accent); color: #fff; border: none; padding: 8px 24px; border-radius: 4px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .mo-nav button.ghost { background: none; color: var(--mo-accent); border: 1px solid var(--mo-accent); }
    .mo-footer { text-align: center; padding: 24px; font-size: 12px; color: #aaa; }
  `;
}

function cssClassroom() {
  return `
    :root { --gc-bg: #f0ebf8; --gc-card: #fff; --gc-accent: #673ab7; --gc-text: #202124; --gc-border: #dadce0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Google Sans', 'Roboto', Arial, sans-serif; background: var(--gc-bg); color: var(--gc-text); line-height: 1.5; }
    .gc-wrap { max-width: 640px; margin: 0 auto; padding: 20px 16px; }
    .gc-title-card { background: var(--gc-card); border: 1px solid var(--gc-border); border-radius: 8px; border-top: 10px solid var(--gc-accent); padding: 24px; margin-bottom: 12px; }
    .gc-title { font-size: 32px; font-weight: 400; color: var(--gc-text); }
    .gc-desc { font-size: 14px; color: #5f6368; margin-top: 8px; }
    .gc-required { font-size: 14px; color: #d93025; margin-top: 12px; border-top: 1px solid var(--gc-border); padding-top: 12px; }
    .gc-question { background: var(--gc-card); border: 1px solid var(--gc-border); border-radius: 8px; padding: 24px; margin-bottom: 12px; }
    .gc-question:hover { border-color: #b0b0b0; }
    .gc-enunciado { font-size: 16px; margin-bottom: 16px; }
    .gc-enunciado .gc-req-star { color: #d93025; margin-left: 4px; }
    gc-option { display: flex; align-items: center; gap: 12px; padding: 6px 0; font-size: 14px; cursor: pointer; }
    .gc-option { display: flex; align-items: center; gap: 12px; padding: 6px 0; font-size: 14px; cursor: pointer; }
    .gc-radio { width: 20px; height: 20px; border-radius: 50%; border: 2px solid #5f6368; flex-shrink: 0; }
    .gc-option:hover .gc-radio { border-color: var(--gc-accent); }
    .gc-input input, .gc-input textarea { width: 100%; border: none; border-bottom: 1px solid var(--gc-border); padding: 8px 0; font-size: 14px; outline: none; background: transparent; }
    .gc-input input:focus, .gc-input textarea:focus { border-bottom: 2px solid var(--gc-accent); }
    .gc-input textarea { resize: vertical; }
    .match-grid { display: flex; flex-direction: column; gap: 10px; }
    .match-row { display: flex; align-items: center; gap: 12px; }
    .match-left { min-width: 120px; font-size: 14px; }
    .match-row select { padding: 8px 10px; border: 1px solid var(--gc-border); border-radius: 4px; font-size: 14px; background: #fff; }
    .gc-submit { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; }
    .gc-submit button { background: var(--gc-accent); color: #fff; border: none; padding: 10px 24px; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer; letter-spacing: 0.25px; }
    .gc-submit .gc-clear { background: none; color: var(--gc-accent); font-weight: 400; }
    .gc-footer { text-align: center; padding: 16px; font-size: 12px; color: #70757a; margin-top: 8px; }
    .gc-footer a { color: #70757a; }
  `;
}

// ── HTML por plataforma ──

function htmlSchoology(preguntas, titulo) {
  const qs = preguntas.map((p, i) => `
    <div class="sc-question">
      <div class="sc-question-num">Pregunta ${i + 1}<span class="sc-badge">${TIPOS_LABEL[p.tipo] || p.tipo}</span></div>
      <div class="sc-enunciado">${esc(p.enunciado)}</div>
      ${renderOpciones(p, 'schoology')}
      <div class="sc-points">${p.puntaje || 1} punto${(p.puntaje || 1) > 1 ? 's' : ''}</div>
    </div>
  `).join('\n');

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)} — Schoology</title><style>${cssSchoology()}</style></head><body>
<div class="sc-header"><span class="logo">S</span><span class="course">Mis cursos &gt; ${esc(titulo)}</span></div>
<div class="sc-wrap">
  <h1 class="sc-quiz-title">${esc(titulo)}</h1>
  <div class="sc-quiz-meta">${preguntas.length} preguntas · ${preguntas.reduce((s, p) => s + (p.puntaje || 1), 0)} puntos en total</div>
  ${qs}
  <div class="sc-submit"><button>Enviar</button></div>
</div>
<div class="sc-footer">Vista previa simulada — No es una evaluación real de Schoology/CREA</div>
</body></html>`;
}

function htmlMoodle(preguntas, titulo) {
  const qs = preguntas.map((p, i) => `
    <div class="mo-question">
      <div class="mo-q-sidebar">
        <div class="mo-q-num">${i + 1}</div>
        <span class="mo-q-flag">Marcar</span>
      </div>
      <div class="mo-q-body">
        <div class="mo-enunciado">${esc(p.enunciado)}</div>
        ${renderOpciones(p, 'moodle')}
        <div class="mo-points">Puntaje: ${p.puntaje || 1}</div>
      </div>
    </div>
  `).join('\n');

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)} — Moodle</title><style>${cssMoodle()}</style></head><body>
<div class="mo-navbar"><span class="logo">M</span><span class="breadcrumb">Inicio / Mis cursos / ${esc(titulo)} / Cuestionario</span></div>
<div class="mo-wrap">
  <div class="mo-quiz-header">
    <h1 class="mo-quiz-title">${esc(titulo)}</h1>
    <div class="mo-quiz-meta">${preguntas.length} preguntas</div>
  </div>
  <div class="mo-info-bar">Este cuestionario tiene ${preguntas.length} preguntas y un puntaje máximo de ${preguntas.reduce((s, p) => s + (p.puntaje || 1), 0)} puntos.</div>
  ${qs}
  <div class="mo-nav">
    <button class="ghost">Anterior</button>
    <button>Siguiente</button>
  </div>
</div>
<div class="mo-footer">Vista previa simulada — No es un cuestionario real de Moodle</div>
</body></html>`;
}

function htmlClassroom(preguntas, titulo) {
  const qs = preguntas.map((p, i) => `
    <div class="gc-question">
      <div class="gc-enunciado">${esc(p.enunciado)}<span class="gc-req-star">*</span></div>
      ${renderOpciones(p, 'classroom')}
    </div>
  `).join('\n');

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)} — Google Forms</title><style>${cssClassroom()}</style></head><body>
<div class="gc-wrap">
  <div class="gc-title-card">
    <div class="gc-title">${esc(titulo)}</div>
    <div class="gc-desc">Cuestionario</div>
    <div class="gc-required">* Indica que la pregunta es obligatoria</div>
  </div>
  ${qs}
  <div class="gc-submit">
    <button>Enviar</button>
    <button class="gc-clear">Borrar formulario</button>
  </div>
</div>
<div class="gc-footer">Vista previa simulada — No es un formulario real de Google<br>Nunca envíes contraseñas a través de Formularios de Google.</div>
</body></html>`;
}

// ── API pública ──

const RENDERERS = {
  crea:      htmlSchoology,
  schoology: htmlSchoology,
  moodle:    htmlMoodle,
  classroom: htmlClassroom
};

const PLATFORM_NAMES = {
  crea: 'CREA de Ceibal',
  schoology: 'Schoology',
  moodle: 'Moodle',
  classroom: 'Google Classroom'
};

export function abrirVistaPrevia(plataforma, preguntas, titulo) {
  const renderer = RENDERERS[plataforma];
  if (!renderer) return;
  const html = renderer(preguntas, titulo || 'Cuestionario sin título');
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export { PLATFORM_NAMES };
