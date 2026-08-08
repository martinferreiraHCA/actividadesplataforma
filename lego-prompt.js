// Generador del prompt para IA de las guías de ensamble LEGO.
// El prompt explica el contexto, la sintaxis completa y las reglas físicas,
// para que la IA devuelva la guía entera de una sola vez, lista para pegar.
// Si hay un kit activo (ej: NXT), el catálogo del prompt se limita a sus
// piezas — y si se indicó cuántos kits hay, también a sus cantidades.

import { COLORES, CATEGORIAS, KITS, piezasDeKit, cantidadEnKit } from './lego-catalogo.js';

function tablaPiezas(kit, cantidadKits) {
  const piezas = piezasDeKit(kit);
  const filas = [];
  for (const cat of CATEGORIAS) {
    const lista = piezas.filter(p => p.cat === cat);
    if (!lista.length) continue;
    filas.push('· ' + cat + ':');
    for (const p of lista) {
      const max = cantidadEnKit(p, kit, cantidadKits);
      const tope = max ? ` — tenés ${max} disponibles como MÁXIMO` : '';
      filas.push(`    "${p.clave}" — ${p.nombre}, ocupa ${p.w}×${p.d} studs sin rotar, alto ${p.alto} placa(s)${tope}`);
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
    titulo = '', nivel = '', kit = 'todas', cantidadKits = 0
  } = datos;

  const cantidad = pasos
    ? `La guía debe tener exactamente ${pasos} pasos.`
    : 'Decidí vos cuántos pasos hacen falta: pocos y claros (entre 4 y 10 suele andar bien), cada paso agrega de 1 a 6 piezas.';

  const infoKit = KITS[kit];
  const bloqueKit = infoKit ? `
RESTRICCIÓN DE KIT (muy importante)
El modelo se arma SOLO con piezas del ${infoKit.nombre}: ${infoKit.descripcion} El catálogo de abajo ya está limitado a ese kit: no uses ninguna pieza que no aparezca en la lista.${cantidadKits ? `
Hay ${cantidadKits} kit(s) disponibles: cada pieza del catálogo indica su cantidad MÁXIMA disponible. No uses más unidades de una pieza que las indicadas — contá las piezas de todos los pasos antes de responder.` : `
No hay límite de cantidad de piezas (hay varios kits), pero mantené el modelo razonable.`}
En este kit las construcciones son al estilo Technic: las vigas se unen entre sí con pines (fricción) por sus agujeros, los ejes atraviesan agujeros-cruz y llevan engranajes y bujes, y el bloque NXT, los motores y los sensores se fijan con pines a las vigas. En esta herramienta igualmente todo se ubica apoyado en la cuadrícula con "en X Z", "nivel" y "rotar": usala como una maqueta visual de dónde va cada pieza, apoyando o adosando las piezas de forma coherente.` : '';

  return `Sos un experto en diseño de modelos LEGO${infoKit ? ' Technic/Mindstorms' : ''} y en didáctica para armar guías de ensamble paso a paso, como las de los manuales oficiales de LEGO. Tu tarea es diseñar UN modelo y su guía de armado completa, usando EXCLUSIVAMENTE el formato de texto plano que te explico abajo. Ese texto se pega en una herramienta que dibuja el modelo en 3D paso a paso, así que la sintaxis tiene que respetarse al pie de la letra: una línea mal escrita no se dibuja.

QUÉ HAY QUE ARMAR
${queArmar.trim()}
${publico ? '\nEs para niños de escuela: pasos chiquitos (2 a 4 piezas por paso), consignas con lenguaje simple y tono lúdico, y notas que animen ("¡Ya casi está!").' : ''}
${piezasDisponibles.trim() ? '\nPIEZAS DISPONIBLES (limitate a estas): ' + piezasDisponibles.trim() : ''}
${extra.trim() ? '\nINDICACIONES EXTRA: ' + extra.trim() : ''}
${bloqueKit}

CÓMO FUNCIONA EL SISTEMA DE COORDENADAS (leelo con atención)
- El modelo se arma sobre una cuadrícula vista desde arriba. Cada celda es un stud (un "botón" de LEGO, 8 mm).
- "en X Z" ubica la ESQUINA de la pieza: X es la columna (crece hacia la derecha) y Z es la fila (crece hacia abajo, o sea hacia adelante del modelo). Se aceptan números negativos y decimales CON PUNTO (ej: 2.5) — los decimales son solo para ajustes finos de mecanismos (engranajes, ejes); las piezas estructurales van siempre en números enteros.
- Sin rotar, el LADO LARGO de la pieza queda a lo largo del eje X. Ejemplo: "ladrillo 2x4 rojo en 0 0" ocupa las columnas 0 a 3 y las filas 0 a 1. Con "rotar 90" el lado largo queda a lo largo de Z: ocupa columnas 0 a 1 y filas 0 a 3.
- "nivel N" es la ALTURA de la base de la pieza, medida en placas. El suelo es nivel 0. Un ladrillo mide 3 placas de alto y una placa/lisa mide 1. O sea: un ladrillo apoyado en el suelo va en "nivel 0", el ladrillo de arriba va en "nivel 3", el siguiente en "nivel 6". Una placa sobre el suelo va en "nivel 0" y lo que apoye sobre ella va en "nivel 1". Si no ponés "nivel", vale 0. Las vigas técnicas miden 2.5 placas: redondeá el nivel de lo que apoye arriba a 3.
- "rotar" acepta solo 0, 90, 180 o 270. Si no lo ponés, vale 0. En piezas con dirección (pendientes, vigas dobladas, sensores) usalo para orientar la pieza hacia donde corresponda.

SINTAXIS DE CADA LÍNEA DE PIEZA (todo en una sola línea, en este orden)
<nombre de pieza> <color> en <X> <Z> [nivel <N>] [rotar <0|90|180|270>]
Ejemplos válidos:
${infoKit ? `viga 9 gris oscuro en 0 0
viga 9 gris oscuro en 0 4
bloque nxt gris claro en 2 -2 nivel 3 rotar 90
motor nxt gris claro en 0 6 nivel 0
engranaje 24 gris claro en 4 2 nivel 3` : `placa 4x8 gris claro en 0 0
ladrillo 2x4 rojo en 2 1 nivel 1
ladrillo 2x2 azul en 0 0 nivel 4 rotar 90
pendiente 2x2 rojo en 2 0 nivel 7 rotar 180`}
Cada línea es UNA pieza. Si van dos iguales, escribí dos líneas.

PIEZAS PERMITIDAS (usá los nombres EXACTOS de la izquierda; no existe ninguna otra pieza)
${tablaPiezas(kit, cantidadKits)}

COLORES PERMITIDOS (nombres exactos): ${listaColores()}
${infoKit ? 'En el kit NXT casi todo es "gris claro", "gris oscuro" y "negro" (con detalles en "amarillo", "azul", "rojo" y "beige"): usá esos colores para que el manual coincida con las piezas reales.' : ''}

REGLAS FÍSICAS OBLIGATORIAS (el modelo tiene que poder armarse de verdad)
1. Ninguna pieza puede flotar: su base tiene que apoyar sobre el suelo (nivel 0) o sobre piezas de pasos anteriores o del mismo paso.
2. Dos piezas no pueden ocupar el mismo lugar: cuidá que no se superpongan ni en la cuadrícula ni en altura (un ladrillo en nivel 0 ocupa los niveles 0, 1 y 2; el siguiente arriba va en nivel 3).
3. Trabá las piezas entre sí para que el modelo quede firme${infoKit ? ' (en Technic: vigas unidas con pines, ejes con bujes)' : ': las piezas de arriba deben cruzar las juntas de las de abajo'}.
4. Sobre una pieza "lisa" (tile) no se puede apoyar nada: no tiene studs.
5. Armá de abajo hacia arriba: los primeros pasos son la base y la estructura, los últimos los detalles${infoKit ? ' (los sensores y cables al final)' : ' de arriba'}.
6. Usá pocas piezas distintas y colores consistentes, como un set real.

MECANISMOS PROLIJOS: EJES, PINES, RUEDAS Y ENGRANAJES (seguí estas recetas al pie de la letra)
La herramienta POSICIONA piezas pero no las "encastra": está PERMITIDO y es CORRECTO superponer un eje o pin con la pieza que atraviesa (el dibujo no choca). Limitación importante: todas las piezas se dibujan ACOSTADAS sobre la cuadrícula y solo giran en horizontal (rotar 90/180/270) — NO existe forma de dibujar un eje o pin parado en vertical, no lo intentes.

· PINES: cuando un pin une dos vigas, dibujalo superpuesto justo donde está la unión (mismo X Z aproximado, mismo nivel que las vigas). Si un pin o eje del mecanismo no se puede dibujar en su posición real (porque iría en vertical), ponelo ACOSTADO en un costado libre del modelo, como "pieza suelta junto al modelo" (los manuales reales hacen esto), y aclará en la consigna dónde se encastra de verdad.

· RUEDAS: llanta y neumático van en la MISMA coordenada y encajan solos, parados como una rueda real, con su eje de giro a lo largo de X. Para dibujar el eje atravesando una "llanta nxt" puesta en X Z: el eje va acostado sin rotar, con nivel 3.5 (el centro de la rueda) y con Z = (Z de la llanta) + 1.5. Ejemplo completo de rueda con eje:
llanta nxt gris claro en 0 0
neumatico nxt negro en 0 0
eje 8 negro en -2 1.5 nivel 3.5

· ENGRANAJES EN SERIE (trenes de engranajes): los engranajes se dibujan planos sobre la cuadrícula (como un reloj visto desde arriba) — un tren se arma poniendo TODOS los engranajes al MISMO nivel, con la separación EXACTA entre centros = (dientes1 + dientes2) / 16 studs. Como "en X Z" es la esquina, usá estas recetas ya calculadas (primer engranaje "en X Z", el siguiente a su derecha):
  - engranaje 8  + engranaje 8  → el segundo en X+1, Z
  - engranaje 16 + engranaje 16 → el segundo en X+2, Z
  - engranaje 24 + engranaje 24 → el segundo en X+3, Z
  - engranaje 40 + engranaje 40 → el segundo en X+5, Z
  - engranaje 8  + engranaje 24 → el 24 en X+1, Z-1
  - engranaje 8  + engranaje 40 → el 40 en X+1, Z-2
  - engranaje 8  + engranaje 16 → el 16 en X+1, Z-0.5
  - engranaje 16 + engranaje 24 → el 24 en X+2, Z-0.5
  - engranaje 16 + engranaje 40 → el 40 en X+2, Z-1.5
  - engranaje 24 + engranaje 40 → el 40 en X+3, Z-1
  Para seguir la serie, encadená las recetas (ej: 8 en 0 0, 24 en 1 -1, 40 en 4 -2). Estas mismas separaciones valen en vertical (sumando en Z y compensando en X). NO acerques ni alejes los engranajes "a ojo": si la separación no es exacta quedan mordidos o sueltos y el manual sale mal. Los ejes de un tren plano irían en vertical: no los dibujes atravesando los engranajes — listalos como piezas sueltas a un costado (regla de PINES) y explicá el armado real en la consigna o las notas.
  Combinaciones que engranan sobre los agujeros estándar de las vigas (separación entera, preferilas): 8+24, 16+16, 24+24, 8+40, 24+40.

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
- Verificá mentalmente el modelo completo antes de responder: recorré paso a paso las coordenadas y niveles y comprobá que nada flote ni se superponga${infoKit && cantidadKits ? ', y que ninguna pieza supere su cantidad máxima disponible' : ''}.
- Las coordenadas tienen que ser coherentes entre pasos: es UN solo modelo que crece.`;
}
