// Genera ítems QTI 1.2 por tipo de pregunta (perfil Common Cartridge / Canvas)
// Este es el dialecto que Schoology, Canvas, Moodle y Blackboard importan de forma fiable.

function escapeXml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

let _seq = 0;
function uid(prefix = 'id') {
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${_seq}_${Math.random().toString(36).slice(2, 8)}`;
}

// Puntaje siempre como decimal (Canvas usa "1.0", "2.0", etc.)
function puntos(p) {
  const n = Number(p.puntaje);
  return (Number.isFinite(n) ? n : 1).toFixed(1);
}

// Construye el contenido HTML escapado para texttype="text/html".
// Canvas envuelve el enunciado en <div> — varios importadores lo necesitan.
function htmlMaterial(texto) {
  let cuerpo = escapeXml(texto || '');
  cuerpo = cuerpo.replace(/\n/g, '&lt;br/&gt;');
  return `&lt;div&gt;&lt;p&gt;${cuerpo}&lt;/p&gt;&lt;/div&gt;`;
}

// Enunciado de una pregunta: texto + tokens [IMG:] + imagen adjunta (inline).
function materialEnunciado(p, gestorImg) {
  let cuerpo = escapeXml(p.enunciado || '');
  // Tokens [IMG: archivo.png] dentro del texto → <img> SÓLO si se subió la imagen.
  // Si no hay archivo asociado, sacamos el token para no mostrar el nombre crudo.
  cuerpo = cuerpo.replace(/\[IMG:\s*([^\]]+)\]/gi, (match, token) => {
    token = token.trim();
    const tieneArchivo = gestorImg && typeof gestorImg.obtenerArchivo === 'function' && gestorImg.obtenerArchivo(token);
    if (!tieneArchivo) return '';
    const src = `images/${token}`;
    return `&lt;br/&gt;&lt;img src="${escapeXml(src)}" alt="${escapeXml(token)}"/&gt;`;
  });
  // Espacios sobrantes que pudo dejar un token quitado al inicio.
  cuerpo = cuerpo.replace(/^(\s|&lt;br\/&gt;)+/, '').replace(/\n/g, '&lt;br/&gt;');
  // Imagen adjunta desde el editor visual (una por pregunta).
  if (p.imagen && p.imagen.exportName) {
    const src = `images/${p.imagen.exportName}`;
    cuerpo += `&lt;br/&gt;&lt;img src="${escapeXml(src)}" alt="${escapeXml(p.imagen.nombre || '')}"/&gt;`;
  }
  return `&lt;div&gt;&lt;p&gt;${cuerpo}&lt;/p&gt;&lt;/div&gt;`;
}

function bloqueMetadata(tipo, p) {
  return `      <itemmetadata>
        <qtimetadata>
          <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>${tipo}</fieldentry></qtimetadatafield>
          <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${puntos(p)}</fieldentry></qtimetadatafield>
          <qtimetadatafield><fieldlabel>assessment_question_identifierref</fieldlabel><fieldentry>${uid('aq')}</fieldentry></qtimetadatafield>
        </qtimetadata>
      </itemmetadata>`;
}

function feedbackBloque(p) {
  if (!p.retro) return '';
  return `
      <itemfeedback ident="general_fb">
        <flow_mat><material><mattext texttype="text/html">${htmlMaterial(p.retro)}</mattext></material></flow_mat>
      </itemfeedback>`;
}

function feedbackLink(p) {
  return p.retro ? `
          <displayfeedback feedbacktype="Response" linkrefid="general_fb"/>` : '';
}

// ====== OPCIÓN MÚLTIPLE (una o varias correctas) ======
function generarItemOpcionMultiple(p, gestorImg) {
  const ident = uid('q');
  const respIdent = 'response1';

  // Filtrar opciones vacías para que no entren respuestas en blanco.
  const opciones = (p.opciones || []).filter(o => (o.texto ?? '').trim() !== '');
  const conCorrecta = opciones.some(o => o.correcta);
  // Si por algún motivo no hay correcta marcada, marcamos la primera.
  if (!conCorrecta && opciones.length) opciones[0].correcta = true;

  const correctas = opciones.filter(o => o.correcta);
  const esMultiple = correctas.length > 1;
  const tipo = esMultiple ? 'multiple_answers_question' : 'multiple_choice_question';
  const rcardinality = esMultiple ? 'Multiple' : 'Single';

  const labels = opciones.map((op) => ({ id: uid('a'), texto: op.texto, correcta: op.correcta }));

  const choicesXml = labels.map(l =>
    `            <response_label ident="${l.id}">
              <material><mattext texttype="text/plain">${escapeXml(l.texto)}</mattext></material>
            </response_label>`
  ).join('\n');

  let conditionvar;
  if (esMultiple) {
    const partes = labels.map(l => l.correcta
      ? `              <varequal respident="${respIdent}">${l.id}</varequal>`
      : `              <not><varequal respident="${respIdent}">${l.id}</varequal></not>`
    ).join('\n');
    conditionvar = `            <and>
${partes}
            </and>`;
  } else {
    const correctaId = labels.find(l => l.correcta)?.id;
    conditionvar = `            <varequal respident="${respIdent}">${correctaId}</varequal>`;
  }

  return `    <item ident="${ident}" title="Pregunta ${p.numero}">
${bloqueMetadata(tipo, p)}
      <presentation>
        <material><mattext texttype="text/html">${materialEnunciado(p, gestorImg)}</mattext></material>
        <response_lid ident="${respIdent}" rcardinality="${rcardinality}">
          <render_choice>
${choicesXml}
          </render_choice>
        </response_lid>
      </presentation>
      <resprocessing>
        <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
        <respcondition continue="No">
          <conditionvar>
${conditionvar}
          </conditionvar>
          <setvar action="Set" varname="SCORE">100</setvar>${feedbackLink(p)}
        </respcondition>
      </resprocessing>${feedbackBloque(p)}
    </item>`;
}

// ====== VERDADERO / FALSO ======
function generarItemVF(p, gestorImg) {
  const ident = uid('q');
  const respIdent = 'response1';
  const trueId = uid('a');
  const falseId = uid('a');
  const correctaId = p.respuestaCorrecta ? trueId : falseId;

  return `    <item ident="${ident}" title="Pregunta ${p.numero}">
${bloqueMetadata('true_false_question', p)}
      <presentation>
        <material><mattext texttype="text/html">${materialEnunciado(p, gestorImg)}</mattext></material>
        <response_lid ident="${respIdent}" rcardinality="Single">
          <render_choice>
            <response_label ident="${trueId}">
              <material><mattext texttype="text/plain">Verdadero</mattext></material>
            </response_label>
            <response_label ident="${falseId}">
              <material><mattext texttype="text/plain">Falso</mattext></material>
            </response_label>
          </render_choice>
        </response_lid>
      </presentation>
      <resprocessing>
        <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
        <respcondition continue="No">
          <conditionvar>
            <varequal respident="${respIdent}">${correctaId}</varequal>
          </conditionvar>
          <setvar action="Set" varname="SCORE">100</setvar>${feedbackLink(p)}
        </respcondition>
      </resprocessing>${feedbackBloque(p)}
    </item>`;
}

// ====== RESPUESTA CORTA ======
function generarItemRespuestaCorta(p, gestorImg) {
  const ident = uid('q');
  const respIdent = 'response1';

  const respuestas = (p.respuestasAceptadas || []).filter(r => (r ?? '').trim() !== '');
  const condiciones = respuestas.map(r =>
    `        <respcondition continue="No">
          <conditionvar>
            <varequal respident="${respIdent}" case="No">${escapeXml(r)}</varequal>
          </conditionvar>
          <setvar action="Set" varname="SCORE">100</setvar>
        </respcondition>`
  ).join('\n');

  return `    <item ident="${ident}" title="Pregunta ${p.numero}">
${bloqueMetadata('short_answer_question', p)}
      <presentation>
        <material><mattext texttype="text/html">${materialEnunciado(p, gestorImg)}</mattext></material>
        <response_str ident="${respIdent}" rcardinality="Single">
          <render_fib>
            <response_label ident="${uid('ans')}"/>
          </render_fib>
        </response_str>
      </presentation>
      <resprocessing>
        <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
${condiciones}
      </resprocessing>${feedbackBloque(p)}
    </item>`;
}

// ====== NUMÉRICA ======
function generarItemNumerica(p, gestorImg) {
  const ident = uid('q');
  const respIdent = 'response1';
  const valor = Number(p.respuestaCorrecta) || 0;
  const tol = Number(p.tolerancia) || 0;
  const min = valor - tol;
  const max = valor + tol;

  return `    <item ident="${ident}" title="Pregunta ${p.numero}">
${bloqueMetadata('numerical_question', p)}
      <presentation>
        <material><mattext texttype="text/html">${materialEnunciado(p, gestorImg)}</mattext></material>
        <response_str ident="${respIdent}" rcardinality="Single">
          <render_fib fibtype="Decimal">
            <response_label ident="${uid('ans')}"/>
          </render_fib>
        </response_str>
      </presentation>
      <resprocessing>
        <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
        <respcondition continue="No">
          <conditionvar>
            <or>
              <varequal respident="${respIdent}">${valor}</varequal>
              <and>
                <vargte respident="${respIdent}">${min}</vargte>
                <varlte respident="${respIdent}">${max}</varlte>
              </and>
            </or>
          </conditionvar>
          <setvar action="Set" varname="SCORE">100</setvar>
        </respcondition>
      </resprocessing>${feedbackBloque(p)}
    </item>`;
}

// ====== EMPAREJAMIENTO (formato Canvas: crédito parcial por par) ======
function generarItemEmparejamiento(p, gestorImg) {
  const ident = uid('q');
  const pares = (p.pares || []).filter(par => (par.izquierda ?? '').trim() !== '' && (par.derecha ?? '').trim() !== '');

  // Cada par: un lado izquierdo (response_lid) y su respuesta correcta del pool.
  const filas = pares.map((par) => ({
    leftId: uid('l'),
    rightId: uid('r'),
    izq: par.izquierda,
    der: par.derecha
  }));

  // Pool de respuestas = todas las opciones de la derecha (cada response_lid las lista todas).
  const poolXml = filas.map(f => `            <response_label ident="${f.rightId}">
              <material><mattext texttype="text/plain">${escapeXml(f.der)}</mattext></material>
            </response_label>`).join('\n');

  const responsesXml = filas.map(f => `        <response_lid ident="${f.leftId}">
          <material><mattext texttype="text/plain">${escapeXml(f.izq)}</mattext></material>
          <render_choice>
${poolXml}
          </render_choice>
        </response_lid>`).join('\n');

  // Crédito parcial: cada par correcto suma 100/n.
  const credito = filas.length ? (100 / filas.length).toFixed(2) : '100';
  const condiciones = filas.map(f => `        <respcondition continue="Yes">
          <conditionvar>
            <varequal respident="${f.leftId}">${f.rightId}</varequal>
          </conditionvar>
          <setvar action="Add" varname="SCORE">${credito}</setvar>
        </respcondition>`).join('\n');

  return `    <item ident="${ident}" title="Pregunta ${p.numero}">
${bloqueMetadata('matching_question', p)}
      <presentation>
        <material><mattext texttype="text/html">${materialEnunciado(p, gestorImg)}</mattext></material>
${responsesXml}
      </presentation>
      <resprocessing>
        <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
${condiciones}
      </resprocessing>${feedbackBloque(p)}
    </item>`;
}

// ====== ENSAYO (corrección manual) ======
function generarItemEnsayo(p, gestorImg) {
  const ident = uid('q');
  const respIdent = 'response1';

  return `    <item ident="${ident}" title="Pregunta ${p.numero}">
${bloqueMetadata('essay_question', p)}
      <presentation>
        <material><mattext texttype="text/html">${materialEnunciado(p, gestorImg)}</mattext></material>
        <response_str ident="${respIdent}" rcardinality="Single">
          <render_fib>
            <response_label ident="${uid('ans')}" rshuffle="No"/>
          </render_fib>
        </response_str>
      </presentation>
      <resprocessing>
        <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
        <respcondition continue="No">
          <conditionvar><other/></conditionvar>
        </respcondition>
      </resprocessing>${feedbackBloque(p)}
    </item>`;
}

export function generarQTI(preguntas, titulo, gestorImg) {
  const items = preguntas.map(p => {
    switch (p.tipo) {
      case 'opcion_multiple': return generarItemOpcionMultiple(p, gestorImg);
      case 'verdadero_falso': return generarItemVF(p, gestorImg);
      case 'respuesta_corta': return generarItemRespuestaCorta(p, gestorImg);
      case 'numerica': return generarItemNumerica(p, gestorImg);
      case 'emparejamiento': return generarItemEmparejamiento(p, gestorImg);
      case 'ensayo': return generarItemEnsayo(p, gestorImg);
      default: return generarItemOpcionMultiple(p, gestorImg);
    }
  }).join('\n');

  const quizId = uid('quiz');
  return {
    quizId,
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/profile/cc/ccv1p1/ccv1p1_qtiasiv1p2p1_v1p0.xsd">
  <assessment ident="${quizId}" title="${escapeXml(titulo || 'Cuestionario')}">
    <qtimetadata>
      <qtimetadatafield><fieldlabel>cc_maxattempts</fieldlabel><fieldentry>1</fieldentry></qtimetadatafield>
    </qtimetadata>
    <section ident="root_section">
${items}
    </section>
  </assessment>
</questestinterop>`
  };
}
