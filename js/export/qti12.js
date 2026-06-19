// Genera ítems QTI 1.2 por tipo de pregunta (perfil Common Cartridge)

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function uid() {
  return 'id_' + Math.random().toString(36).substring(2, 15);
}

function enunciadoConImagenes(texto, imagenes, gestorImg) {
  let html = escapeXml(texto);
  html = html.replace(/\[IMG:\s*([^\]]+)\]/gi, (match, token) => {
    token = token.trim();
    const archivo = gestorImg?.obtenerArchivo(token);
    const src = archivo ? `images/${token}` : `images/${token}`;
    return `&lt;br/&gt;&lt;img src="${escapeXml(src)}" alt="${escapeXml(token)}"/&gt;&lt;br/&gt;`;
  });
  html = html.replace(/\n/g, '&lt;br/&gt;');
  return html;
}

function generarItemOpcionMultiple(p, gestorImg) {
  const ident = uid();
  const respIdent = uid();
  const correctas = p.opciones.filter(o => o.correcta);
  const esMultiple = correctas.length > 1;
  const rcardinality = esMultiple ? 'Multiple' : 'Single';

  const labels = p.opciones.map((op, i) => {
    const labelId = `opt_${ident}_${i}`;
    return { id: labelId, texto: op.texto, correcta: op.correcta };
  });

  const choicesXml = labels.map(l =>
    `          <response_label ident="${l.id}">
            <material><mattext texttype="text/plain">${escapeXml(l.texto)}</mattext></material>
          </response_label>`
  ).join('\n');

  let respconditions = '';
  if (esMultiple) {
    const condCorrectaXml = labels.filter(l => l.correcta).map(l =>
      `              <varequal respident="${respIdent}">${l.id}</varequal>`
    ).join('\n');
    respconditions = `
        <respcondition continue="No">
          <conditionvar>
            <and>
${condCorrectaXml}
            </and>
          </conditionvar>
          <setvar action="Set" varname="SCORE">100</setvar>${p.retro ? `
          <displayfeedback feedbacktype="Response" linkrefid="feedback_correct"/>` : ''}
        </respcondition>`;
  } else {
    const correctaId = labels.find(l => l.correcta)?.id;
    respconditions = `
        <respcondition continue="No">
          <conditionvar>
            <varequal respident="${respIdent}">${correctaId}</varequal>
          </conditionvar>
          <setvar action="Set" varname="SCORE">100</setvar>${p.retro ? `
          <displayfeedback feedbacktype="Response" linkrefid="feedback_correct"/>` : ''}
        </respcondition>`;
  }

  let feedbackXml = '';
  if (p.retro) {
    feedbackXml = `
      <itemfeedback ident="feedback_correct">
        <material><mattext texttype="text/plain">${escapeXml(p.retro)}</mattext></material>
      </itemfeedback>`;
  }

  return `    <item ident="${ident}" title="Pregunta ${p.numero}">
      <itemmetadata>
        <qtimetadata>
          <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>multiple_choice_question</fieldentry></qtimetadatafield>
          <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${p.puntaje}</fieldentry></qtimetadatafield>
        </qtimetadata>
      </itemmetadata>
      <presentation>
        <material><mattext texttype="text/html">${enunciadoConImagenes(p.enunciado, p.imagenes, gestorImg)}</mattext></material>
        <response_lid ident="${respIdent}" rcardinality="${rcardinality}">
          <render_choice>
${choicesXml}
          </render_choice>
        </response_lid>
      </presentation>
      <resprocessing>
        <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>${respconditions}
      </resprocessing>${feedbackXml}
    </item>`;
}

function generarItemVF(p, gestorImg) {
  const ident = uid();
  const respIdent = uid();
  const trueId = `${ident}_true`;
  const falseId = `${ident}_false`;
  const correctaId = p.respuestaCorrecta ? trueId : falseId;

  let feedbackXml = '';
  if (p.retro) {
    feedbackXml = `
      <itemfeedback ident="feedback_correct">
        <material><mattext texttype="text/plain">${escapeXml(p.retro)}</mattext></material>
      </itemfeedback>`;
  }

  return `    <item ident="${ident}" title="Pregunta ${p.numero}">
      <itemmetadata>
        <qtimetadata>
          <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>true_false_question</fieldentry></qtimetadatafield>
          <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${p.puntaje}</fieldentry></qtimetadatafield>
        </qtimetadata>
      </itemmetadata>
      <presentation>
        <material><mattext texttype="text/html">${enunciadoConImagenes(p.enunciado, p.imagenes, gestorImg)}</mattext></material>
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
          <setvar action="Set" varname="SCORE">100</setvar>${p.retro ? `
          <displayfeedback feedbacktype="Response" linkrefid="feedback_correct"/>` : ''}
        </respcondition>
      </resprocessing>${feedbackXml}
    </item>`;
}

function generarItemRespuestaCorta(p, gestorImg) {
  const ident = uid();
  const respIdent = uid();

  const condiciones = p.respuestasAceptadas.map(r =>
    `        <respcondition continue="No">
          <conditionvar>
            <varequal respident="${respIdent}" case="No">${escapeXml(r)}</varequal>
          </conditionvar>
          <setvar action="Set" varname="SCORE">100</setvar>
        </respcondition>`
  ).join('\n');

  return `    <item ident="${ident}" title="Pregunta ${p.numero}">
      <itemmetadata>
        <qtimetadata>
          <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>short_answer_question</fieldentry></qtimetadatafield>
          <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${p.puntaje}</fieldentry></qtimetadatafield>
        </qtimetadata>
      </itemmetadata>
      <presentation>
        <material><mattext texttype="text/html">${enunciadoConImagenes(p.enunciado, p.imagenes, gestorImg)}</mattext></material>
        <response_str ident="${respIdent}" rcardinality="Single">
          <render_fib><response_label ident="answer"/></render_fib>
        </response_str>
      </presentation>
      <resprocessing>
        <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
${condiciones}
      </resprocessing>
    </item>`;
}

function generarItemNumerica(p, gestorImg) {
  const ident = uid();
  const respIdent = uid();
  const min = p.respuestaCorrecta - p.tolerancia;
  const max = p.respuestaCorrecta + p.tolerancia;

  return `    <item ident="${ident}" title="Pregunta ${p.numero}">
      <itemmetadata>
        <qtimetadata>
          <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>numerical_question</fieldentry></qtimetadatafield>
          <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${p.puntaje}</fieldentry></qtimetadatafield>
        </qtimetadata>
      </itemmetadata>
      <presentation>
        <material><mattext texttype="text/html">${enunciadoConImagenes(p.enunciado, p.imagenes, gestorImg)}</mattext></material>
        <response_str ident="${respIdent}" rcardinality="Single">
          <render_fib><response_label ident="answer"/></render_fib>
        </response_str>
      </presentation>
      <resprocessing>
        <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
        <respcondition continue="No">
          <conditionvar>
            <and>
              <vargte respident="${respIdent}">${min}</vargte>
              <varlte respident="${respIdent}">${max}</varlte>
            </and>
          </conditionvar>
          <setvar action="Set" varname="SCORE">100</setvar>
        </respcondition>
      </resprocessing>
    </item>`;
}

function generarItemEmparejamiento(p, gestorImg) {
  const ident = uid();
  const items = p.pares.map((par, i) => {
    const grpId = `grp_${i}`;
    const matchId = `match_${i}`;
    return { grpId, matchId, izq: par.izquierda, der: par.derecha };
  });

  const responsesXml = items.map(item => `
        <response_lid ident="${item.grpId}">
          <material><mattext texttype="text/plain">${escapeXml(item.izq)}</mattext></material>
          <render_choice>
${items.map(m => `            <response_label ident="${m.matchId}">
              <material><mattext texttype="text/plain">${escapeXml(m.der)}</mattext></material>
            </response_label>`).join('\n')}
          </render_choice>
        </response_lid>`
  ).join('\n');

  const condiciones = items.map(item =>
    `            <varequal respident="${item.grpId}">${item.matchId}</varequal>`
  ).join('\n');

  return `    <item ident="${ident}" title="Pregunta ${p.numero}">
      <itemmetadata>
        <qtimetadata>
          <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>matching_question</fieldentry></qtimetadatafield>
          <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${p.puntaje}</fieldentry></qtimetadatafield>
        </qtimetadata>
      </itemmetadata>
      <presentation>
        <material><mattext texttype="text/html">${enunciadoConImagenes(p.enunciado, p.imagenes, gestorImg)}</mattext></material>
${responsesXml}
      </presentation>
      <resprocessing>
        <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
        <respcondition continue="No">
          <conditionvar>
            <and>
${condiciones}
            </and>
          </conditionvar>
          <setvar action="Set" varname="SCORE">100</setvar>
        </respcondition>
      </resprocessing>
    </item>`;
}

function generarItemEnsayo(p, gestorImg) {
  const ident = uid();
  const respIdent = uid();

  return `    <item ident="${ident}" title="Pregunta ${p.numero}">
      <itemmetadata>
        <qtimetadata>
          <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>essay_question</fieldentry></qtimetadatafield>
          <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${p.puntaje}</fieldentry></qtimetadatafield>
        </qtimetadata>
      </itemmetadata>
      <presentation>
        <material><mattext texttype="text/html">${enunciadoConImagenes(p.enunciado, p.imagenes, gestorImg)}</mattext></material>
        <response_str ident="${respIdent}" rcardinality="Single">
          <render_fib><response_label ident="answer" rshuffle="No"/></render_fib>
        </response_str>
      </presentation>
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

  const quizId = uid();
  return {
    quizId,
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2">
  <assessment ident="${quizId}" title="${escapeXml(titulo || 'Cuestionario')}">
    <section ident="root_section">
${items}
    </section>
  </assessment>
</questestinterop>`
  };
}
