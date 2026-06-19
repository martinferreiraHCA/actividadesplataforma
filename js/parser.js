// Parser del formato estándar intermedio → objetos pregunta
// Tolerante: acepta variaciones de mayúsculas, espacios extra, acentos.

function normalizar(str) {
  return str.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim().replace(/\s+/g, "_");
}

const TIPOS_VALIDOS = [
  "opcion_multiple", "verdadero_falso", "respuesta_corta",
  "numerica", "emparejamiento", "ensayo"
];

function detectarTipo(raw) {
  const n = normalizar(raw);
  const alias = {
    "opcion_multiple": "opcion_multiple",
    "multiple_choice": "opcion_multiple",
    "multiple_opcion": "opcion_multiple",
    "opcion multiple": "opcion_multiple",
    "verdadero_falso": "verdadero_falso",
    "v_f": "verdadero_falso",
    "true_false": "verdadero_falso",
    "verdadero/falso": "verdadero_falso",
    "respuesta_corta": "respuesta_corta",
    "short_answer": "respuesta_corta",
    "numerica": "numerica",
    "numerical": "numerica",
    "emparejamiento": "emparejamiento",
    "matching": "emparejamiento",
    "ensayo": "ensayo",
    "essay": "ensayo"
  };
  if (TIPOS_VALIDOS.includes(n)) return n;
  return alias[n] || null;
}

export function parsear(texto) {
  const preguntas = [];
  const advertencias = [];
  const lineas = texto.split("\n");

  let titulo = "";
  let metaNivel = "";
  let preguntaActual = null;

  function guardarPregunta() {
    if (!preguntaActual) return;
    if (preguntaActual.tipo === "opcion_multiple" || preguntaActual.tipo === "verdadero_falso") {
      const tieneCorrecta = preguntaActual.opciones.some(o => o.correcta);
      if (!tieneCorrecta && preguntaActual.tipo !== "ensayo") {
        advertencias.push({
          linea: preguntaActual._lineaInicio,
          mensaje: `Pregunta ${preguntaActual.numero}: no tiene opción correcta marcada.`
        });
      }
    }
    preguntas.push(preguntaActual);
    preguntaActual = null;
  }

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    const numLinea = i + 1;
    const trimmed = linea.trim();

    // Título del cuestionario
    const matchTitulo = trimmed.match(/^#\s+(?:Cuestionario|Quiz|Actividad)\s*:\s*(.+)/i);
    if (matchTitulo) {
      titulo = matchTitulo[1].trim();
      continue;
    }

    // Nivel
    const matchNivel = trimmed.match(/^#\s+(?:Nivel|Level|Grado|Grupo)\s*:\s*(.+)/i);
    if (matchNivel) {
      metaNivel = matchNivel[1].trim();
      continue;
    }

    // Ignorar otros encabezados simples #
    if (/^#\s+/.test(trimmed) && !trimmed.startsWith("##")) continue;

    // Nueva pregunta: ## P1 :: tipo :: Npt
    const matchPregunta = trimmed.match(
      /^##\s*(?:P|pregunta\s*)?(\d+)\s*::\s*([^:]+?)(?:\s*::\s*(\d+)\s*(?:pt|pts|puntos?)?)?\s*$/i
    );
    if (matchPregunta) {
      guardarPregunta();
      const num = parseInt(matchPregunta[1]);
      const tipoRaw = matchPregunta[2].trim();
      const puntaje = matchPregunta[3] ? parseInt(matchPregunta[3]) : 1;
      const tipo = detectarTipo(tipoRaw);

      if (!tipo) {
        advertencias.push({
          linea: numLinea,
          mensaje: `Tipo "${tipoRaw}" no reconocido en P${num}. Se usará "opcion_multiple".`
        });
      }

      preguntaActual = {
        numero: num,
        tipo: tipo || "opcion_multiple",
        puntaje,
        enunciado: "",
        opciones: [],
        respuestaCorrecta: null,
        respuestasAceptadas: [],
        tolerancia: 0,
        pares: [],
        retro: "",
        imagenes: [],
        _lineaInicio: numLinea
      };
      continue;
    }

    if (!preguntaActual) continue;

    // Opciones: - [x] o - [ ]
    const matchOpcion = trimmed.match(/^-\s*\[([ xX*])\]\s*(.+)/);
    if (matchOpcion) {
      const correcta = matchOpcion[1].trim() !== "";
      preguntaActual.opciones.push({
        texto: matchOpcion[2].trim(),
        correcta
      });
      continue;
    }

    // Respuesta V/F: **Respuesta:** Verdadero/Falso
    const matchRespVF = trimmed.match(/^\*\*Respuesta\*?\*?\s*:\s*\*?\*?\s*(.+)/i);
    if (matchRespVF && preguntaActual.tipo === "verdadero_falso") {
      const val = normalizar(matchRespVF[1]);
      const esVerdadero = val.startsWith("verdadero") || val === "true" || val === "v";
      preguntaActual.respuestaCorrecta = esVerdadero;
      if (preguntaActual.opciones.length === 0) {
        preguntaActual.opciones = [
          { texto: "Verdadero", correcta: esVerdadero },
          { texto: "Falso", correcta: !esVerdadero }
        ];
      }
      continue;
    }

    // Respuesta numérica: **Respuesta:** 6 ± 0.1
    const matchRespNum = trimmed.match(/^\*\*Respuesta\*?\*?\s*:\s*\*?\*?\s*([\d.,]+)\s*(?:[±+-]\s*([\d.,]+))?/i);
    if (matchRespNum && preguntaActual.tipo === "numerica") {
      preguntaActual.respuestaCorrecta = parseFloat(matchRespNum[1].replace(",", "."));
      preguntaActual.tolerancia = matchRespNum[2]
        ? parseFloat(matchRespNum[2].replace(",", "."))
        : 0;
      continue;
    }

    // Respuestas aceptadas (corta): **Respuestas aceptadas:** A | B | C
    const matchRespCorta = trimmed.match(/^\*\*Respuestas?\s*aceptadas?\*?\*?\s*:\s*\*?\*?\s*(.+)/i);
    if (matchRespCorta) {
      preguntaActual.respuestasAceptadas = matchRespCorta[1]
        .split("|")
        .map(r => r.trim())
        .filter(Boolean);
      continue;
    }

    // Pares de emparejamiento: - Izquierda = Derecha
    const matchPar = trimmed.match(/^-\s*(.+?)\s*=\s*(.+)/);
    if (matchPar && preguntaActual.tipo === "emparejamiento") {
      preguntaActual.pares.push({
        izquierda: matchPar[1].trim(),
        derecha: matchPar[2].trim()
      });
      continue;
    }

    // Retroalimentación: > Retro: ...
    const matchRetro = trimmed.match(/^>\s*(?:Retro|Retroalimentaci[oó]n|Feedback)\s*:\s*(.+)/i);
    if (matchRetro) {
      preguntaActual.retro = matchRetro[1].trim();
      continue;
    }

    // Tokens de imagen en el enunciado
    const imgTokens = trimmed.matchAll(/\[IMG:\s*([^\]]+)\]/gi);
    for (const match of imgTokens) {
      preguntaActual.imagenes.push(match[1].trim());
    }

    // Todo lo demás es parte del enunciado
    if (trimmed && !trimmed.startsWith(">")) {
      if (preguntaActual.enunciado) {
        preguntaActual.enunciado += "\n" + trimmed;
      } else {
        preguntaActual.enunciado = trimmed;
      }
    }
  }

  guardarPregunta();

  if (preguntas.length === 0) {
    advertencias.push({
      linea: 1,
      mensaje: "No se encontró ninguna pregunta. Revisá que el formato empiece con ## P1 :: tipo."
    });
  }

  return { preguntas, advertencias, titulo, nivel: metaNivel };
}
