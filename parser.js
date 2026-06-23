// Parser multi-formato: Aiken, formato extendido, auto-detección
// Tolerante: acepta variaciones de mayúsculas, espacios extra, acentos.

function normalizar(str) {
  return str.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim().replace(/\s+/g, "_");
}

const TIPOS_VALIDOS = [
  "opcion_multiple", "verdadero_falso", "respuesta_corta",
  "numerica", "emparejamiento", "ordenamiento",
  "completar", "seleccion_inline", "ensayo"
];

function detectarTipo(raw) {
  const n = normalizar(raw);
  const alias = {
    "opcion_multiple": "opcion_multiple",
    "multiple_choice": "opcion_multiple",
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
    "ordenamiento": "ordenamiento",
    "ordering": "ordenamiento",
    "orden": "ordenamiento",
    "secuencia": "ordenamiento",
    "completar": "completar",
    "completar_huecos": "completar",
    "cloze": "completar",
    "gapmatch": "completar",
    "seleccion_inline": "seleccion_inline",
    "inline": "seleccion_inline",
    "inline_choice": "seleccion_inline",
    "desplegable": "seleccion_inline",
    "ensayo": "ensayo",
    "essay": "ensayo"
  };
  if (TIPOS_VALIDOS.includes(n)) return n;
  return alias[n] || null;
}

// ====== PARSER FORMATO EXTENDIDO ======
export function parsearExtendido(texto) {
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
    delete preguntaActual._lineaInicio;
    preguntas.push(preguntaActual);
    preguntaActual = null;
  }

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    const numLinea = i + 1;
    const trimmed = linea.trim();

    const matchTitulo = trimmed.match(/^#\s+(?:Cuestionario|Quiz|Actividad)\s*:\s*(.+)/i);
    if (matchTitulo) { titulo = matchTitulo[1].trim(); continue; }

    const matchNivel = trimmed.match(/^#\s+(?:Nivel|Level|Grado|Grupo)\s*:\s*(.+)/i);
    if (matchNivel) { metaNivel = matchNivel[1].trim(); continue; }

    if (/^#\s+/.test(trimmed) && !trimmed.startsWith("##")) continue;

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
        numero: num, tipo: tipo || "opcion_multiple", puntaje,
        enunciado: "", opciones: [], respuestaCorrecta: null,
        respuestasAceptadas: [], tolerancia: 0, pares: [], items: [],
        plantilla: "", distractores: [],
        retro: "", imagenes: [], imagen: null, _lineaInicio: numLinea
      };
      continue;
    }

    if (!preguntaActual) continue;

    // Opciones: aceptamos viñeta "-" o "*" (las IA usan cualquiera de las dos).
    // Ej: "- [x] texto", "* [ ] texto", "* [x] texto".
    const matchOpcion = trimmed.match(/^[-*]\s*\[([ xX*])\]\s*(.+)/);
    if (matchOpcion) {
      preguntaActual.opciones.push({
        texto: matchOpcion[2].trim(),
        correcta: matchOpcion[1].trim() !== ""
      });
      continue;
    }

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

    const matchRespNum = trimmed.match(/^\*\*Respuesta\*?\*?\s*:\s*\*?\*?\s*([\d.,]+)\s*(?:[±+-]\s*([\d.,]+))?/i);
    if (matchRespNum && preguntaActual.tipo === "numerica") {
      preguntaActual.respuestaCorrecta = parseFloat(matchRespNum[1].replace(",", "."));
      preguntaActual.tolerancia = matchRespNum[2] ? parseFloat(matchRespNum[2].replace(",", ".")) : 0;
      continue;
    }

    const matchRespCorta = trimmed.match(/^\*\*Respuestas?\s*aceptadas?\*?\*?\s*:\s*\*?\*?\s*(.+)/i);
    if (matchRespCorta) {
      preguntaActual.respuestasAceptadas = matchRespCorta[1].split("|").map(r => r.trim()).filter(Boolean);
      continue;
    }

    const matchPar = trimmed.match(/^[-*]\s*(.+?)\s*=\s*(.+)/);
    if (matchPar && preguntaActual.tipo === "emparejamiento") {
      preguntaActual.pares.push({ izquierda: matchPar[1].trim(), derecha: matchPar[2].trim() });
      continue;
    }

    // Ordenamiento: lista numerada en el orden correcto ("1. paso", "2. paso").
    const matchOrden = trimmed.match(/^\d+\s*[.)]\s*(.+)/);
    if (matchOrden && preguntaActual.tipo === "ordenamiento") {
      preguntaActual.items.push(matchOrden[1].trim());
      continue;
    }

    // Completar / Selección inline: distractores y la plantilla con [[...]].
    const esCloze = preguntaActual.tipo === "completar" || preguntaActual.tipo === "seleccion_inline";
    const matchDistr = trimmed.match(/^\*\*Distractores?\*?\*?\s*:\s*\*?\*?\s*(.+)/i);
    if (matchDistr && esCloze) {
      preguntaActual.distractores = matchDistr[1].split("|").map(d => d.trim()).filter(Boolean);
      continue;
    }
    const matchTexto = trimmed.match(/^\*\*Texto\*?\*?\s*:\s*\*?\*?\s*(.+)/i);
    if (matchTexto && esCloze) {
      preguntaActual.plantilla = matchTexto[1].trim();
      continue;
    }
    if (esCloze && trimmed.includes("[[")) {
      // Una línea suelta con huecos también se toma como plantilla.
      preguntaActual.plantilla += (preguntaActual.plantilla ? "\n" : "") + trimmed;
      continue;
    }

    const matchRetro = trimmed.match(/^>\s*(?:Retro|Retroalimentaci[oó]n|Feedback)\s*:\s*(.+)/i);
    if (matchRetro) { preguntaActual.retro = matchRetro[1].trim(); continue; }

    const imgTokens = trimmed.matchAll(/\[IMG:\s*([^\]]+)\]/gi);
    for (const match of imgTokens) {
      preguntaActual.imagenes.push(match[1].trim());
    }

    if (trimmed && !trimmed.startsWith(">")) {
      preguntaActual.enunciado += (preguntaActual.enunciado ? "\n" : "") + trimmed;
    }
  }

  guardarPregunta();

  if (preguntas.length === 0) {
    advertencias.push({ linea: 1, mensaje: "No se encontró ninguna pregunta en formato extendido." });
  }

  return { preguntas, advertencias, titulo, nivel: metaNivel };
}

// ====== PARSER FORMATO AIKEN ======
export function parsearAiken(texto) {
  const preguntas = [];
  const advertencias = [];
  const bloques = texto.trim().split(/\n\s*\n/);

  bloques.forEach((bloque, bi) => {
    const lineas = bloque.trim().split("\n").map(l => l.trim()).filter(Boolean);
    if (lineas.length < 3) {
      if (lineas.length > 0 && lineas[0].trim()) {
        advertencias.push({ linea: bi + 1, mensaje: `Bloque ${bi + 1}: muy corto, se necesita pregunta + opciones + ANSWER.` });
      }
      return;
    }

    const opciones = [];
    let enunciado = "";
    let respuestaLetra = null;
    let lineaEnunciado = true;

    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i];

      // ANSWER: X
      const matchAnswer = l.match(/^ANSWER\s*:\s*([A-Za-z])/i);
      if (matchAnswer) {
        respuestaLetra = matchAnswer[1].toUpperCase();
        continue;
      }

      // Opción: A. texto, A) texto, a. texto
      const matchOpcion = l.match(/^([A-Za-z])\s*[.)]\s*(.+)/);
      if (matchOpcion && !lineaEnunciado) {
        opciones.push({
          letra: matchOpcion[1].toUpperCase(),
          texto: matchOpcion[2].trim(),
          correcta: false
        });
        continue;
      }

      // Primera opción detectada marca fin del enunciado
      if (matchOpcion && lineaEnunciado) {
        lineaEnunciado = false;
        opciones.push({
          letra: matchOpcion[1].toUpperCase(),
          texto: matchOpcion[2].trim(),
          correcta: false
        });
        continue;
      }

      // Enunciado (puede ser multi-línea antes de las opciones)
      if (lineaEnunciado) {
        enunciado += (enunciado ? " " : "") + l;
      }
    }

    if (!enunciado) {
      advertencias.push({ linea: bi + 1, mensaje: `Bloque ${bi + 1}: no se encontró el enunciado.` });
      return;
    }

    if (opciones.length < 2) {
      advertencias.push({ linea: bi + 1, mensaje: `Bloque ${bi + 1}: se necesitan al menos 2 opciones.` });
      return;
    }

    if (respuestaLetra) {
      const idx = opciones.findIndex(o => o.letra === respuestaLetra);
      if (idx >= 0) {
        opciones[idx].correcta = true;
      } else {
        advertencias.push({ linea: bi + 1, mensaje: `Bloque ${bi + 1}: ANSWER "${respuestaLetra}" no coincide con ninguna opción.` });
      }
    } else {
      advertencias.push({ linea: bi + 1, mensaje: `Bloque ${bi + 1}: falta la línea ANSWER.` });
    }

    preguntas.push({
      numero: preguntas.length + 1,
      tipo: "opcion_multiple",
      puntaje: 1,
      enunciado,
      opciones: opciones.map(o => ({ texto: o.texto, correcta: o.correcta })),
      respuestaCorrecta: null,
      respuestasAceptadas: [],
      tolerancia: 0,
      pares: [],
      retro: "",
      imagenes: [],
      imagen: null
    });
  });

  if (preguntas.length === 0) {
    advertencias.push({ linea: 1, mensaje: "No se encontraron preguntas en formato Aiken." });
  }

  return { preguntas, advertencias, titulo: "", nivel: "" };
}

// ====== AUTO-DETECCIÓN DE FORMATO ======
export function detectarFormato(texto) {
  const trimmed = texto.trim();
  if (/^##\s*P?\d+\s*::/im.test(trimmed)) return "extendido";
  if (/^ANSWER\s*:/im.test(trimmed)) return "aiken";
  if (/^[A-Z]\s*[.)]\s+/m.test(trimmed)) return "aiken";
  return "extendido";
}

export function parsear(texto) {
  const formato = detectarFormato(texto);
  if (formato === "aiken") {
    return { ...parsearAiken(texto), formato: "aiken" };
  }
  return { ...parsearExtendido(texto), formato: "extendido" };
}

// ====== CREAR PREGUNTA VACÍA (para editor visual) ======
export function crearPreguntaVacia(tipo, numero) {
  return {
    numero,
    tipo,
    puntaje: 1,
    enunciado: "",
    opciones: tipo === "opcion_multiple"
      ? [
          { texto: "", correcta: true },
          { texto: "", correcta: false },
          { texto: "", correcta: false },
          { texto: "", correcta: false }
        ]
      : tipo === "verdadero_falso"
      ? [
          { texto: "Verdadero", correcta: true },
          { texto: "Falso", correcta: false }
        ]
      : [],
    respuestaCorrecta: tipo === "verdadero_falso" ? true : null,
    respuestasAceptadas: tipo === "respuesta_corta" ? [""] : [],
    tolerancia: 0,
    pares: tipo === "emparejamiento"
      ? [{ izquierda: "", derecha: "" }]
      : [],
    items: tipo === "ordenamiento"
      ? ["", ""]
      : [],
    plantilla: tipo === "completar"
      ? "La capital de Uruguay es [[Montevideo]]."
      : tipo === "seleccion_inline"
      ? "La capital de Uruguay es [[Montevideo|Salto|Paysandú]]."
      : "",
    distractores: [],
    retro: "",
    imagenes: [],
    imagen: null
  };
}
