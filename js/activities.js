// Catálogo declarativo de tipos de actividad
export const ACTIVITIES = {
  cuestionario: {
    nombre: "Cuestionario",
    descripcion: "Mezclá tipos de pregunta en una sola evaluación.",
    tiposPreguntaPermitidos: [
      "opcion_multiple",
      "verdadero_falso",
      "respuesta_corta",
      "numerica",
      "emparejamiento",
      "ordenamiento",
      "ensayo"
    ],
    promptHints: "Incluí una mezcla variada de tipos de pregunta."
  },
  verdadero_falso: {
    nombre: "Verdadero / Falso",
    descripcion: "Preguntas rápidas de verdadero o falso.",
    tiposPreguntaPermitidos: ["verdadero_falso"],
    promptHints: "Todas las preguntas deben ser de tipo verdadero_falso."
  },
  opcion_multiple: {
    nombre: "Opción múltiple",
    descripcion: "Preguntas con opciones para elegir la correcta.",
    tiposPreguntaPermitidos: ["opcion_multiple"],
    promptHints: "Todas las preguntas deben ser de tipo opcion_multiple con 4 opciones cada una."
  },
  respuesta_corta: {
    nombre: "Respuestas cortas / Glosario",
    descripcion: "El alumno escribe la respuesta en pocas palabras.",
    tiposPreguntaPermitidos: ["respuesta_corta"],
    promptHints: "Todas las preguntas deben ser de tipo respuesta_corta. Incluí al menos 2 respuestas aceptadas por pregunta."
  },
  con_imagenes: {
    nombre: "Actividad con imágenes",
    descripcion: "Ítems que incluyen figuras o diagramas.",
    tiposPreguntaPermitidos: [
      "opcion_multiple",
      "verdadero_falso",
      "respuesta_corta"
    ],
    promptHints: "Cada pregunta DEBE incluir un token [IMG: descripcion_relevante.png] en el enunciado. Usá nombres descriptivos para las imágenes."
  }
};

export const TIPOS_PREGUNTA = {
  opcion_multiple: "Opción múltiple",
  verdadero_falso: "Verdadero / Falso",
  respuesta_corta: "Respuesta corta",
  numerica: "Numérica",
  emparejamiento: "Emparejamiento",
  ordenamiento: "Ordenamiento",
  ensayo: "Ensayo"
};
