// Export/import del estado completo como JSON

export function exportarJSON(preguntas, titulo, nivel) {
  const data = {
    version: 1,
    titulo,
    nivel,
    fecha: new Date().toISOString(),
    preguntas: preguntas.map(p => ({
      numero: p.numero,
      tipo: p.tipo,
      puntaje: p.puntaje,
      enunciado: p.enunciado,
      opciones: p.opciones,
      respuestaCorrecta: p.respuestaCorrecta,
      respuestasAceptadas: p.respuestasAceptadas,
      tolerancia: p.tolerancia,
      pares: p.pares,
      retro: p.retro,
      imagenes: p.imagenes
    }))
  };
  return JSON.stringify(data, null, 2);
}

export function importarJSON(texto) {
  const data = JSON.parse(texto);
  if (!data.preguntas || !Array.isArray(data.preguntas)) {
    throw new Error('El archivo JSON no tiene el formato esperado.');
  }
  return {
    preguntas: data.preguntas,
    titulo: data.titulo || '',
    nivel: data.nivel || ''
  };
}
