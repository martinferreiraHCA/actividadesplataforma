// Generador del prompt para IA de las guías de ensamble LEGO.
// El prompt explica el contexto, la sintaxis completa y las reglas físicas,
// para que la IA devuelva la guía entera de una sola vez, lista para pegar.

import { PIEZAS, COLORES, CATEGORIAS } from './lego-catalogo.js';

function tablaPiezas() {
  const filas = [];
  for (const cat of CATEGORIAS) {
    const lista = PIEZAS.filter(p => p.cat === cat);
    if (!lista.length) continue;
    filas.push('· ' + cat + ':');
    for (const p of lista) {
      filas.push(`    "${p.clave}" — ${p.nombre}, ocupa ${p.w}×${p.d} studs sin rotar, alto ${p.alto} placa(s)`);
    }
  }
  return filas.join('\n');
}

function listaColores() {
  return COLORES.map(c => `"${c.clave}"`).join(', ');
}

export function generarPromptLego(datos) {
  const {
    queArmar = '', pasos = '', publico = false, piezasDisponibles = '', extra = '',
    titulo = '', nivel = ''
  } = datos;

  const cantidad = pasos
    ? `La guía debe tener exactamente ${pasos} pasos.`
    : 'Decidí vos cuántos pasos hacen falta: pocos y claros (entre 4 y 10 suele andar bien), cada paso agrega de 1 a 6 piezas.';

  return `Sos un experto en diseño de modelos LEGO y en didáctica para armar guías de ensamble paso a paso, como las de los manuales oficiales de LEGO. Tu tarea es diseñar UN modelo y su guía de armado completa, usando EXCLUSIVAMENTE el formato de texto plano que te explico abajo. Ese texto se pega en una herramienta que dibuja el modelo en 3D paso a paso, así que la sintaxis tiene que respetarse al pie de la letra: una línea mal escrita no se dibuja.

QUÉ HAY QUE ARMAR
${queArmar.trim()}
${publico ? '\nEs para niños de escuela: pasos chiquitos (2 a 4 piezas por paso), consignas con lenguaje simple y tono lúdico, y notas que animen ("¡Ya casi está!").' : ''}
${piezasDisponibles.trim() ? '\nPIEZAS DISPONIBLES (limitate a estas): ' + piezasDisponibles.trim() : ''}
${extra.trim() ? '\nINDICACIONES EXTRA: ' + extra.trim() : ''}

CÓMO FUNCIONA EL SISTEMA DE COORDENADAS (leelo con atención)
- El modelo se arma sobre una cuadrícula vista desde arriba. Cada celda es un stud (un "botón" de LEGO).
- "en X Z" ubica la ESQUINA de la pieza: X es la columna (crece hacia la derecha) y Z es la fila (crece hacia abajo, o sea hacia adelante del modelo). Se aceptan números negativos. Desde esa esquina la pieza se extiende hacia +X y hacia +Z.
- Sin rotar, el LADO LARGO de la pieza queda a lo largo del eje X. Ejemplo: "ladrillo 2x4 rojo en 0 0" ocupa las columnas 0 a 3 y las filas 0 a 1. Con "rotar 90" el lado largo queda a lo largo de Z: ocupa columnas 0 a 1 y filas 0 a 3.
- "nivel N" es la ALTURA de la base de la pieza, medida en placas. El suelo es nivel 0. Un ladrillo mide 3 placas de alto y una placa/lisa mide 1. O sea: un ladrillo apoyado en el suelo va en "nivel 0", el ladrillo de arriba va en "nivel 3", el siguiente en "nivel 6". Una placa sobre el suelo va en "nivel 0" y lo que apoye sobre ella va en "nivel 1". Si no ponés "nivel", vale 0.
- "rotar" acepta solo 0, 90, 180 o 270. Si no lo ponés, vale 0. En piezas con dirección (pendientes, paneles, arcos) usalo para orientar la cara inclinada hacia donde corresponda.

SINTAXIS DE CADA LÍNEA DE PIEZA (todo en una sola línea, en este orden)
<nombre de pieza> <color> en <X> <Z> [nivel <N>] [rotar <0|90|180|270>]
Ejemplos válidos:
placa 4x8 gris claro en 0 0
ladrillo 2x4 rojo en 2 1 nivel 1
ladrillo 2x2 azul en 0 0 nivel 4 rotar 90
pendiente 2x2 rojo en 2 0 nivel 7 rotar 180
Cada línea es UNA pieza. Si van dos ladrillos iguales, escribí dos líneas.

PIEZAS PERMITIDAS (usá los nombres EXACTOS de la izquierda; no existe ninguna otra pieza)
${tablaPiezas()}

COLORES PERMITIDOS (nombres exactos): ${listaColores()}

REGLAS FÍSICAS OBLIGATORIAS (el modelo tiene que poder armarse de verdad)
1. Ninguna pieza puede flotar: su base tiene que apoyar sobre el suelo (nivel 0) o sobre studs de piezas de pasos anteriores o del mismo paso.
2. Dos piezas no pueden ocupar el mismo lugar: cuidá que no se superpongan ni en la cuadrícula ni en altura (un ladrillo en nivel 0 ocupa los niveles 0, 1 y 2; el siguiente arriba va en nivel 3).
3. Trabá las piezas como un muro de verdad: las piezas de arriba deben cruzar las juntas de las de abajo para que el modelo quede firme.
4. Sobre una pieza "lisa" (tile) no se puede apoyar nada: no tiene studs.
5. Armá de abajo hacia arriba: los primeros pasos son la base, los últimos los detalles de arriba.
6. Usá pocas piezas distintas y colores consistentes, como un set real.

FORMATO DE LA RESPUESTA (exactamente así, sin nada fuera de este formato)
titulo: ${titulo.trim() || '<un título corto y atractivo para la guía>'}
nivel: ${nivel.trim() || '<grupo o edad sugerida>'}
descripcion: <2 o 3 frases contando qué se va a armar y qué se aprende>

=== PASO: <nombre corto del paso> ===
consigna: <qué tiene que hacer el estudiante en este paso, en 1 o 2 frases>
piezas:
<una línea por pieza, con la sintaxis de arriba>
notas: <pista, control o dato curioso del paso (opcional pero recomendable)>

(repetí el bloque "=== PASO: ... ===" por cada paso)

${cantidad}

IMPORTANTE
- Respondé SOLO con el texto en ese formato, sin explicaciones antes ni después, sin markdown, sin numerar los pasos en el título (la herramienta los numera sola).
- Verificá mentalmente el modelo completo antes de responder: recorré paso a paso las coordenadas y niveles y comprobá que nada flote ni se superponga.
- Las coordenadas tienen que ser coherentes entre pasos: es UN solo modelo que crece.`;
}
