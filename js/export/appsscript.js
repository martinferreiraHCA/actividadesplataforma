// Genera un Google Apps Script (FormApp) para crear un Google Form como quiz

function escapeJS(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

export function generarAppsScript(preguntas, titulo) {
  let script = `/*
 * ==============================================
 * GENERADOR DE GOOGLE FORM — QUIZ AUTOMÁTICO
 * ==============================================
 *
 * INSTRUCCIONES (3 pasos):
 *
 * 1. Andá a https://script.google.com y creá un nuevo proyecto.
 * 2. Borrá todo el contenido y pegá este script completo.
 * 3. Hacé clic en ▶ Ejecutar (función: crearQuiz).
 *    La primera vez te va a pedir permisos — aceptalos.
 *    Cuando termine, buscá el Form nuevo en tu Google Drive.
 *    Desde ahí lo podés adjuntar a tu clase en Google Classroom.
 *
 * ==============================================
 */

function crearQuiz() {
  var form = FormApp.create('${escapeJS(titulo || "Cuestionario")}');
  form.setIsQuiz(true);
  form.setDescription('Cuestionario generado automáticamente.');

`;

  preguntas.forEach(p => {
    const enunciado = escapeJS(p.enunciado.replace(/\[IMG:\s*[^\]]+\]/gi, '[imagen]'));

    switch (p.tipo) {
      case 'opcion_multiple': {
        const correctas = p.opciones.filter(o => o.correcta);
        if (correctas.length <= 1) {
          script += `  // Pregunta ${p.numero} — Opción múltiple\n`;
          script += `  var item${p.numero} = form.addMultipleChoiceItem();\n`;
          script += `  item${p.numero}.setTitle('${enunciado}');\n`;
          script += `  item${p.numero}.setPoints(${p.puntaje});\n`;
          script += `  item${p.numero}.setChoices([\n`;
          p.opciones.forEach(op => {
            script += `    item${p.numero}.createChoice('${escapeJS(op.texto)}', ${op.correcta}),\n`;
          });
          script += `  ]);\n`;
        } else {
          script += `  // Pregunta ${p.numero} — Casillas (múltiple respuesta)\n`;
          script += `  var item${p.numero} = form.addCheckboxItem();\n`;
          script += `  item${p.numero}.setTitle('${enunciado}');\n`;
          script += `  item${p.numero}.setPoints(${p.puntaje});\n`;
          script += `  item${p.numero}.setChoices([\n`;
          p.opciones.forEach(op => {
            script += `    item${p.numero}.createChoice('${escapeJS(op.texto)}', ${op.correcta}),\n`;
          });
          script += `  ]);\n`;
        }
        if (p.retro) {
          script += `  item${p.numero}.setFeedbackForCorrect(FormApp.createFeedback().setText('${escapeJS(p.retro)}').build());\n`;
          script += `  item${p.numero}.setFeedbackForIncorrect(FormApp.createFeedback().setText('${escapeJS(p.retro)}').build());\n`;
        }
        script += '\n';
        break;
      }

      case 'verdadero_falso': {
        script += `  // Pregunta ${p.numero} — Verdadero/Falso\n`;
        script += `  var item${p.numero} = form.addMultipleChoiceItem();\n`;
        script += `  item${p.numero}.setTitle('${enunciado}');\n`;
        script += `  item${p.numero}.setPoints(${p.puntaje});\n`;
        script += `  item${p.numero}.setChoices([\n`;
        script += `    item${p.numero}.createChoice('Verdadero', ${p.respuestaCorrecta === true}),\n`;
        script += `    item${p.numero}.createChoice('Falso', ${p.respuestaCorrecta === false}),\n`;
        script += `  ]);\n`;
        if (p.retro) {
          script += `  item${p.numero}.setFeedbackForCorrect(FormApp.createFeedback().setText('${escapeJS(p.retro)}').build());\n`;
          script += `  item${p.numero}.setFeedbackForIncorrect(FormApp.createFeedback().setText('${escapeJS(p.retro)}').build());\n`;
        }
        script += '\n';
        break;
      }

      case 'respuesta_corta': {
        script += `  // Pregunta ${p.numero} — Respuesta corta\n`;
        script += `  var item${p.numero} = form.addTextItem();\n`;
        script += `  item${p.numero}.setTitle('${enunciado}');\n`;
        script += `  item${p.numero}.setPoints(${p.puntaje});\n`;
        if (p.respuestasAceptadas.length > 0) {
          script += `  // Nota: Google Forms no soporta auto-corrección de texto libre.\n`;
          script += `  // Respuestas esperadas: ${p.respuestasAceptadas.map(r => escapeJS(r)).join(', ')}\n`;
        }
        script += '\n';
        break;
      }

      case 'numerica': {
        script += `  // Pregunta ${p.numero} — Numérica (como texto)\n`;
        script += `  var item${p.numero} = form.addTextItem();\n`;
        script += `  item${p.numero}.setTitle('${enunciado}');\n`;
        script += `  item${p.numero}.setPoints(${p.puntaje});\n`;
        script += `  // Respuesta esperada: ${p.respuestaCorrecta} ± ${p.tolerancia}\n`;
        script += '\n';
        break;
      }

      case 'emparejamiento': {
        script += `  // Pregunta ${p.numero} — Emparejamiento (como grilla)\n`;
        script += `  var item${p.numero} = form.addGridItem();\n`;
        script += `  item${p.numero}.setTitle('${enunciado}');\n`;
        const filas = p.pares.map(par => `'${escapeJS(par.izquierda)}'`);
        const columnas = [...new Set(p.pares.map(par => par.derecha))].map(d => `'${escapeJS(d)}'`);
        script += `  item${p.numero}.setRows([${filas.join(', ')}]);\n`;
        script += `  item${p.numero}.setColumns([${columnas.join(', ')}]);\n`;
        script += '\n';
        break;
      }

      case 'ensayo': {
        script += `  // Pregunta ${p.numero} — Ensayo\n`;
        script += `  var item${p.numero} = form.addParagraphTextItem();\n`;
        script += `  item${p.numero}.setTitle('${enunciado}');\n`;
        script += `  item${p.numero}.setPoints(${p.puntaje});\n`;
        script += '\n';
        break;
      }
    }
  });

  script += `  Logger.log('¡Quiz creado! URL: ' + form.getEditUrl());
  Logger.log('URL para responder: ' + form.getPublishedUrl());
}
`;

  return script;
}
