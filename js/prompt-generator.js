// Genera el prompt copiable para la IA a partir de los parámetros del docente
import { TIPOS_PREGUNTA } from './activities.js';

export function generarPrompt({ tema, nivel, cantidad, tipos, dificultad, idioma, contexto, notas, promptHints }) {
  const tiposTexto = tipos.map(t => TIPOS_PREGUNTA[t] || t).join(", ");
  const dificultadTexto = { facil: "fácil", medio: "medio", dificil: "difícil", mixto: "mixto" }[dificultad] || dificultad;

  let prompt = `Generá un cuestionario con las siguientes características:

- **Tema:** ${tema}
- **Nivel/Grupo:** ${nivel || "No especificado"}
- **Cantidad de preguntas:** ${cantidad}
- **Tipos de pregunta:** ${tiposTexto}
- **Dificultad:** ${dificultadTexto}
- **Idioma:** ${idioma}`;

  if (contexto) {
    prompt += `\n- **Contexto curricular:** ${contexto}`;
  }

  if (notas) {
    prompt += `\n- **Notas adicionales:** ${notas}`;
  }

  if (promptHints) {
    prompt += `\n- **Indicación especial:** ${promptHints}`;
  }

  prompt += `

Respondé SOLO con el contenido en el formato indicado abajo, sin texto antes ni después, sin bloques de código.

## FORMATO REQUERIDO

Usá exactamente este formato (copiá la estructura, no la inventes):

# Cuestionario: ${tema}
# Nivel: ${nivel || "[nivel]"}

## P1 :: opcion_multiple :: 1pt
¿Texto de la pregunta?
- [ ] Opción incorrecta
- [x] Opción correcta
- [ ] Otra incorrecta
- [ ] Otra incorrecta
> Retro: Explicación breve de por qué es correcta.

## P2 :: verdadero_falso :: 1pt
Afirmación para evaluar.
**Respuesta:** Verdadero
> Retro: Explicación.

## P3 :: respuesta_corta :: 1pt
¿Pregunta donde el alumno escribe la respuesta?
**Respuestas aceptadas:** Respuesta 1 | Respuesta 2 | respuesta 3

## P4 :: numerica :: 1pt
¿Problema numérico?
**Respuesta:** 42 ± 0.5

## P5 :: emparejamiento :: 2pt
Asociá cada elemento con su par:
- Elemento A = Par A
- Elemento B = Par B
- Elemento C = Par C

## P6 :: ensayo
Pregunta abierta para que el alumno desarrolle.

## REGLAS
- Numerá las preguntas secuencialmente: P1, P2, P3...
- Usá SOLO los tipos: ${tiposTexto}.
- Marcá la opción correcta con [x] y las incorrectas con [ ].
- Incluí retroalimentación (> Retro:) en todas las preguntas que puedas.
- Para respuesta corta, incluí al menos 2 variantes aceptadas separadas por |.`;

  if (tipos.includes("opcion_multiple")) {
    prompt += `\n- Para opción múltiple, incluí 4 opciones por pregunta.`;
  }

  const tieneImagenes = promptHints && promptHints.toLowerCase().includes("img");
  if (tieneImagenes) {
    prompt += `\n- Incluí tokens de imagen [IMG: nombre_descriptivo.png] donde corresponda en el enunciado.`;
  }

  return prompt;
}
