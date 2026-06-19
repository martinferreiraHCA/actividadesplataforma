// Genera ítems QTI v2.1 (un <assessmentItem> por pregunta).
// QTI 2.1 habilita interacciones más ricas que el 1.2 (orderInteraction,
// gapMatch, inlineChoice). Acá cubrimos los 6 tipos clásicos + ordenamiento.
// Lo importan CREA de Ceibal, Schoology y Moodle.

const QTI21_NS = 'http://www.imsglobal.org/xsd/imsqti_v2p1';

function escapeXml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

let _seq = 0;
function uid(prefix = 'id') {
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${_seq}_${Math.random().toString(36).slice(2, 8)}`;
}

function maxScore(p) {
  const n = Number(p.puntaje);
  return (Number.isFinite(n) && n > 0 ? n : 1);
}

// Construye XHTML real (no escapado) para el cuerpo del ítem: texto + imágenes.
function xhtmlEnunciado(p, gestorImg) {
  let cuerpo = escapeXml(p.enunciado || '');
  // Tokens [IMG: archivo.png] → <img> sólo si la imagen fue subida.
  cuerpo = cuerpo.replace(/\[IMG:\s*([^\]]+)\]/gi, (m, token) => {
    token = token.trim();
    const tiene = gestorImg && typeof gestorImg.obtenerArchivo === 'function' && gestorImg.obtenerArchivo(token);
    if (!tiene) return '';
    return `<br/><img src="../images/${escapeXml(token)}" alt="${escapeXml(token)}"/>`;
  });
  cuerpo = cuerpo.replace(/^(\s|<br\/>)+/, '').replace(/\n/g, '<br/>');
  if (p.imagen && p.imagen.exportName) {
    cuerpo += `<br/><img src="../images/${escapeXml(p.imagen.exportName)}" alt="${escapeXml(p.imagen.nombre || '')}"/>`;
  }
  return `<p>${cuerpo}</p>`;
}

function outcomeDecls(p) {
  return `  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue><value>0</value></defaultValue>
  </outcomeDeclaration>
  <outcomeDeclaration identifier="MAXSCORE" cardinality="single" baseType="float">
    <defaultValue><value>${maxScore(p)}</value></defaultValue>
  </outcomeDeclaration>`;
}

// Plantilla de procesamiento por coincidencia exacta (choice single, V/F, orden).
function rpMatchExacto() {
  return `  <responseProcessing>
    <responseCondition>
      <responseIf>
        <match>
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </match>
        <setOutcomeValue identifier="SCORE"><variable identifier="MAXSCORE"/></setOutcomeValue>
      </responseIf>
    </responseCondition>
  </responseProcessing>`;
}

// Procesamiento por mapeo (multiple, respuesta corta, emparejamiento → crédito parcial).
function rpMapResponse() {
  return `  <responseProcessing>
    <setOutcomeValue identifier="SCORE"><mapResponse identifier="RESPONSE"/></setOutcomeValue>
  </responseProcessing>`;
}

function envoltura(p, body, responseDecl, responseProc, gestorImg) {
  const ident = uid('item');
  return {
    ident,
    title: `Pregunta ${p.numero}`,
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem xmlns="${QTI21_NS}"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${QTI21_NS} http://www.imsglobal.org/xsd/qti/qtiv2p1/imsqti_v2p1.xsd"
  identifier="${ident}" title="Pregunta ${p.numero}" adaptive="false" timeDependent="false">
${responseDecl}
${outcomeDecls(p)}
  <itemBody>
${body}
  </itemBody>
${responseProc}
</assessmentItem>`
  };
}

// ====== OPCIÓN MÚLTIPLE ======
function itemOpcionMultiple(p, gestorImg) {
  const opciones = (p.opciones || []).filter(o => (o.texto ?? '').trim() !== '');
  if (!opciones.some(o => o.correcta) && opciones.length) opciones[0].correcta = true;
  const labels = opciones.map(o => ({ id: uid('ch'), texto: o.texto, correcta: !!o.correcta }));
  const correctas = labels.filter(l => l.correcta);
  const multiple = correctas.length > 1;

  const choices = labels.map(l =>
    `      <simpleChoice identifier="${l.id}">${escapeXml(l.texto)}</simpleChoice>`
  ).join('\n');

  let responseDecl, responseProc;
  if (multiple) {
    // Crédito parcial: cada correcta suma MAXSCORE/k, cada error resta lo mismo (piso 0).
    const k = correctas.length;
    const valor = (maxScore(p) / k);
    const mapEntries = labels.map(l =>
      `      <mapEntry mapKey="${l.id}" mappedValue="${l.correcta ? valor : -valor}"/>`
    ).join('\n');
    responseDecl = `  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
    <correctResponse>
${correctas.map(l => `      <value>${l.id}</value>`).join('\n')}
    </correctResponse>
    <mapping defaultValue="0" lowerBound="0" upperBound="${maxScore(p)}">
${mapEntries}
    </mapping>
  </responseDeclaration>`;
    responseProc = rpMapResponse();
  } else {
    responseDecl = `  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>${correctas[0]?.id || labels[0]?.id}</value></correctResponse>
  </responseDeclaration>`;
    responseProc = rpMatchExacto();
  }

  const body = `${xhtmlEnunciado(p, gestorImg)}
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="true" maxChoices="${multiple ? 0 : 1}">
${choices}
    </choiceInteraction>`;
  return envoltura(p, body, responseDecl, responseProc, gestorImg);
}

// ====== VERDADERO / FALSO ======
function itemVF(p, gestorImg) {
  const vId = uid('ch'), fId = uid('ch');
  const correcto = p.respuestaCorrecta ? vId : fId;
  const responseDecl = `  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>${correcto}</value></correctResponse>
  </responseDeclaration>`;
  const body = `${xhtmlEnunciado(p, gestorImg)}
    <choiceInteraction responseIdentifier="RESPONSE" shuffle="false" maxChoices="1">
      <simpleChoice identifier="${vId}">Verdadero</simpleChoice>
      <simpleChoice identifier="${fId}">Falso</simpleChoice>
    </choiceInteraction>`;
  return envoltura(p, body, responseDecl, rpMatchExacto(), gestorImg);
}

// ====== RESPUESTA CORTA ======
function itemRespuestaCorta(p, gestorImg) {
  const respuestas = (p.respuestasAceptadas || []).filter(r => (r ?? '').trim() !== '');
  const principal = respuestas[0] || '';
  const mapEntries = respuestas.map(r =>
    `      <mapEntry mapKey="${escapeXml(r)}" mappedValue="${maxScore(p)}" caseSensitive="false"/>`
  ).join('\n');
  const responseDecl = `  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string">
    <correctResponse><value>${escapeXml(principal)}</value></correctResponse>
    <mapping defaultValue="0" lowerBound="0" upperBound="${maxScore(p)}">
${mapEntries}
    </mapping>
  </responseDeclaration>`;
  const body = `${xhtmlEnunciado(p, gestorImg)}
    <p><textEntryInteraction responseIdentifier="RESPONSE" expectedLength="20"/></p>`;
  return envoltura(p, body, responseDecl, rpMapResponse(), gestorImg);
}

// ====== NUMÉRICA ======
function itemNumerica(p, gestorImg) {
  const valor = Number(p.respuestaCorrecta) || 0;
  const tol = Number(p.tolerancia) || 0;
  const responseDecl = `  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="float">
    <correctResponse><value>${valor}</value></correctResponse>
  </responseDeclaration>`;
  const responseProc = `  <responseProcessing>
    <responseCondition>
      <responseIf>
        <equal toleranceMode="absolute" tolerance="${tol} ${tol}" includeLowerBound="true" includeUpperBound="true">
          <variable identifier="RESPONSE"/>
          <correct identifier="RESPONSE"/>
        </equal>
        <setOutcomeValue identifier="SCORE"><variable identifier="MAXSCORE"/></setOutcomeValue>
      </responseIf>
    </responseCondition>
  </responseProcessing>`;
  const body = `${xhtmlEnunciado(p, gestorImg)}
    <p><textEntryInteraction responseIdentifier="RESPONSE" expectedLength="8"/></p>`;
  return envoltura(p, body, responseDecl, responseProc, gestorImg);
}

// ====== EMPAREJAMIENTO (matchInteraction con crédito parcial) ======
function itemEmparejamiento(p, gestorImg) {
  const pares = (p.pares || []).filter(par => (par.izquierda ?? '').trim() !== '' && (par.derecha ?? '').trim() !== '');
  const filas = pares.map(par => ({ leftId: uid('L'), rightId: uid('R'), izq: par.izquierda, der: par.derecha }));
  const valor = filas.length ? (maxScore(p) / filas.length) : maxScore(p);

  const correctPairs = filas.map(f => `      <value>${f.leftId} ${f.rightId}</value>`).join('\n');
  const mapEntries = filas.map(f => `      <mapEntry mapKey="${f.leftId} ${f.rightId}" mappedValue="${valor}"/>`).join('\n');

  const responseDecl = `  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="directedPair">
    <correctResponse>
${correctPairs}
    </correctResponse>
    <mapping defaultValue="0" lowerBound="0" upperBound="${maxScore(p)}">
${mapEntries}
    </mapping>
  </responseDeclaration>`;

  const sourceChoices = filas.map(f =>
    `        <simpleAssociableChoice identifier="${f.leftId}" matchMax="1">${escapeXml(f.izq)}</simpleAssociableChoice>`
  ).join('\n');
  const targetChoices = filas.map(f =>
    `        <simpleAssociableChoice identifier="${f.rightId}" matchMax="1">${escapeXml(f.der)}</simpleAssociableChoice>`
  ).join('\n');

  const body = `${xhtmlEnunciado(p, gestorImg)}
    <matchInteraction responseIdentifier="RESPONSE" shuffle="true" maxAssociations="${filas.length}">
      <simpleMatchSet>
${sourceChoices}
      </simpleMatchSet>
      <simpleMatchSet>
${targetChoices}
      </simpleMatchSet>
    </matchInteraction>`;
  return envoltura(p, body, responseDecl, rpMapResponse(), gestorImg);
}

// ====== ORDENAMIENTO (orderInteraction) ======
function itemOrdenamiento(p, gestorImg) {
  const items = (p.items || []).filter(t => (t ?? '').trim() !== '');
  const labels = items.map(t => ({ id: uid('o'), texto: t }));

  const responseDecl = `  <responseDeclaration identifier="RESPONSE" cardinality="ordered" baseType="identifier">
    <correctResponse>
${labels.map(l => `      <value>${l.id}</value>`).join('\n')}
    </correctResponse>
  </responseDeclaration>`;

  const choices = labels.map(l =>
    `      <simpleChoice identifier="${l.id}">${escapeXml(l.texto)}</simpleChoice>`
  ).join('\n');

  const body = `${xhtmlEnunciado(p, gestorImg)}
    <orderInteraction responseIdentifier="RESPONSE" shuffle="true">
${choices}
    </orderInteraction>`;
  return envoltura(p, body, responseDecl, rpMatchExacto(), gestorImg);
}

// ====== ENSAYO (corrección manual, sin responseProcessing automático) ======
function itemEnsayo(p, gestorImg) {
  const responseDecl = `  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="string"/>`;
  const body = `${xhtmlEnunciado(p, gestorImg)}
    <extendedTextInteraction responseIdentifier="RESPONSE" expectedLines="6"/>`;
  const responseProc = `  <responseProcessing/>`;
  return envoltura(p, body, responseDecl, responseProc, gestorImg);
}

export function generarItemsQTI21(preguntas, gestorImg) {
  return (preguntas || []).map(p => {
    switch (p.tipo) {
      case 'opcion_multiple': return itemOpcionMultiple(p, gestorImg);
      case 'verdadero_falso': return itemVF(p, gestorImg);
      case 'respuesta_corta': return itemRespuestaCorta(p, gestorImg);
      case 'numerica': return itemNumerica(p, gestorImg);
      case 'emparejamiento': return itemEmparejamiento(p, gestorImg);
      case 'ordenamiento': return itemOrdenamiento(p, gestorImg);
      case 'ensayo': return itemEnsayo(p, gestorImg);
      default: return itemOpcionMultiple(p, gestorImg);
    }
  });
}
