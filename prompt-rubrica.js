// Genera el prompt copiable para que la IA genere una rúbrica

export function generarPromptRubrica({ tema, nivel, cantidadCriterios, cantidadNiveles, idioma, contexto, notas }) {
  let prompt = `Generá una rúbrica de evaluación con las siguientes características:

- **Tema / Actividad a evaluar:** ${tema}
- **Nivel/Grupo:** ${nivel || "No especificado"}
- **Cantidad de criterios (filas):** ${cantidadCriterios || 4}
- **Cantidad de niveles de desempeño (columnas):** ${cantidadNiveles || 4}
- **Idioma:** ${idioma || "español"}`;

  if (contexto) {
    prompt += `\n- **Contexto curricular:** ${contexto}`;
  }
  if (notas) {
    prompt += `\n- **Notas adicionales:** ${notas}`;
  }

  prompt += `

## FORMATO REQUERIDO

Respondé EXACTAMENTE con este formato de texto plano (sin tablas Markdown, sin JSON):

NIVELES: Nombre1 (puntos) | Nombre2 (puntos) | Nombre3 (puntos) | Nombre4 (puntos)

### Nombre del Criterio 1
- Descripción detallada para el nivel más alto
- Descripción detallada para el segundo nivel
- Descripción detallada para el tercer nivel
- Descripción detallada para el nivel más bajo

### Nombre del Criterio 2
- Descripción detallada para el nivel más alto
- Descripción detallada para el segundo nivel
- Descripción detallada para el tercer nivel
- Descripción detallada para el nivel más bajo

(continuar con todos los criterios)

## REGLAS

1. La primera línea DEBE ser "NIVELES:" seguida de los nombres de cada nivel con su puntaje entre paréntesis, separados por |.
2. Cada criterio empieza con "### Nombre del criterio".
3. Debajo de cada criterio van exactamente ${cantidadNiveles || 4} descripciones, una por nivel, cada una precedida por un guion (-).
4. Las descripciones van en orden de mayor a menor puntaje (la primera corresponde al nivel más alto).
5. Cada descripción debe ser específica, observable y medible — evitá generalidades como "bueno" o "malo".
6. Los niveles deben tener puntajes decrecientes (ej: 4, 3, 2, 1).
7. NO uses tablas Markdown ni formato JSON — solo texto plano con el formato indicado.
8. NO agregues texto antes ni después de la rúbrica.

## EJEMPLO

NIVELES: Excelente (4) | Bueno (3) | Suficiente (2) | Insuficiente (1)

### Comprensión del tema
- Demuestra comprensión profunda con ejemplos propios y conexiones relevantes
- Comprende los conceptos principales y los aplica correctamente
- Comprensión parcial, confunde algunos conceptos secundarios
- No demuestra comprensión de los conceptos fundamentales

### Presentación
- Exposición clara, ordenada y dentro del tiempo, con apoyo visual efectivo
- Exposición mayormente clara con apoyo visual adecuado
- Exposición algo desorganizada, apoyo visual mínimo
- Exposición confusa, sin apoyo visual o fuera de tiempo`;

  return prompt;
}
