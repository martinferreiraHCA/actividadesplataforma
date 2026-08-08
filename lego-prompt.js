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

REGLAS DE ESCRITURA EXACTAS (el texto se procesa automáticamente: respetalas TODAS)
1. Todo en minúsculas salvo los textos libres (título, consignas, notas). Los nombres de pieza y color van EXACTOS como en el catálogo: en minúsculas, sin comillas, sin tildes inventadas, sin plural (${infoKit ? '"viga 9", no "Vigas 9"' : '"ladrillo 2x4", no "Ladrillos 2X4"'}).
2. Separá las palabras con UN solo espacio. Sin tabulaciones, sin sangría al inicio de línea, sin espacios al final. Ninguna línea de pieza empieza con guión, viñeta, número ni asterisco: empieza directo con el nombre de la pieza.
3. En los tamaños la letra x va pegada a los números y sin espacios: "2x4" (no "2 x 4", no "2×4").
4. La palabra "en" es obligatoria antes de las coordenadas: <pieza> <color> en <X> <Z>. X y Z separados por espacio (no coma). Decimales con PUNTO: "2.5" (nunca "2,5"). Negativos con guión pegado: "-3".
5. "nivel" y "rotar" van después de las coordenadas, en ese orden si están los dos, en minúsculas y con su número separado por espacio: "nivel 3 rotar 90". No escribas "nivel:3", "Nivel 3" ni "rotado 90".
6. El encabezado de paso es exactamente: === PASO: Título === (tres signos igual, espacio, PASO en mayúsculas, dos puntos, el título, espacio, tres signos igual). Sin numerar: "=== PASO: La base ===", no "=== PASO 1: La base ===".
7. Las claves de cada paso van al comienzo de línea, en minúsculas y con dos puntos: "consigna:", "piezas:", "notas:". Después de "piezas:" NO va nada en esa misma línea: las piezas empiezan en la línea siguiente, una por línea, sin líneas en blanco entre medio.
8. "consigna:" y "notas:" llevan su texto en la misma línea (puede continuar en líneas siguientes sin clave). No agregues claves nuevas ("paso:", "imagen:", "cantidad:") — no existen.
9. Dejá exactamente UNA línea en blanco entre el encabezado del documento y el primer paso, y UNA entre paso y paso. No dejes líneas en blanco dentro de un paso.
10. Respuesta en texto plano puro: sin markdown, sin \`\`\`, sin negritas con asteriscos, sin tablas, sin emojis en las líneas de piezas, sin comentarios entre paréntesis en las líneas de piezas, y sin ningún texto antes de "titulo:" ni después del último paso.

EJEMPLO COMPLETO DE RESPUESTA BIEN ESCRITA (fijate en los espacios y las líneas en blanco; el tuyo debe verse exactamente así, con tu contenido):
titulo: ${infoKit ? 'El auto explorador' : 'La casita del árbol'}
nivel: 5° año
descripcion: Un modelo sencillo para practicar lectura de instrucciones. En cada paso se agregan pocas piezas.

${infoKit ? `=== PASO: El chasis ===
consigna: Buscá las dos vigas largas y ponelas en paralelo.
piezas:
viga 9 gris oscuro en 0 0
viga 9 gris oscuro en 0 4
notas: Las vigas son la columna vertebral del auto.

=== PASO: El motor ===
consigna: Colocá el servomotor entre las dos vigas.
piezas:
motor nxt gris claro en 0 1 nivel 0
pin negro en 1 0
pin negro en 1 4
notas: Los pines de fricción sujetan el motor a las vigas.` : `=== PASO: La base ===
consigna: Buscá la placa grande y los dos ladrillos y armá el piso.
piezas:
placa 4x8 gris claro en 0 0
ladrillo 2x4 rojo en 0 0 nivel 1
ladrillo 2x4 rojo en 4 0 nivel 1
notas: La placa es la pieza finita; los ladrillos van arriba.

=== PASO: Las paredes ===
consigna: Levantá la segunda hilera trabando las juntas.
piezas:
ladrillo 2x4 rojo en 2 0 nivel 4
ladrillo 2x2 azul en 0 0 nivel 4
ladrillo 2x2 azul en 6 0 nivel 4
notas: Fijate que cada ladrillo pise la junta de los de abajo.`}

(fin del ejemplo — tu respuesta sigue este mismo formato, con más pasos si hacen falta)

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

ORIENTACIÓN DE LAS PIEZAS DIRECCIONALES (verificado pieza por pieza — memorizalo antes de ubicar nada)
Cada pieza direccional tiene una orientación fija sin rotar; "rotar" la gira en horizontal. Guía:
- pendientes, pendiente invertida, techo curvo y soporte (bracket): la cara inclinada / el voladizo / los studs laterales miran hacia -Z (hacia el fondo). rotar 90 → miran a -X (izquierda) · rotar 180 → +Z (al frente) · rotar 270 → +X (derecha). Para un techo a dos aguas sobre una pared que corre a lo largo de X: la fila de atrás sin rotar y la fila de adelante con rotar 180, enfrentadas.
- faro 1x1: el stud lateral mira a -Z (misma regla de rotación).
- sensores NXT (ultrasónico, contacto, sonido, luz): la "cara" del sensor (ojos, botón naranja) mira a -Z; los agujeros de montaje quedan atrás (+Z). Para que el sensor mire al frente del robot usá rotar 180.
- bloque nxt: pantalla hacia arriba, los 4 puertos de sensores miran a -Z y el puerto USB a +Z. Ocupa 9×14 studs: reservale lugar.
- motor nxt: ocupa 5 studs de ancho (X) por ~14 de largo (Z); el EJE naranja queda en el extremo de MAYOR Z y el conector del cable en el extremo de la esquina X Z. Para dos motores enfrentados (robot con dos ruedas), poné uno sin rotar y el otro rotar 180.
- vigas rectas: a lo largo de X sin rotar. Vigas angulares y curvas: el brazo LARGO corre a lo largo de Z sin rotar (huella según la tabla de piezas).
- ejes y pines: acostados a lo largo de X sin rotar; rotar 90 los pone a lo largo de Z. NO se pueden parar en vertical.

MECANISMOS PROLIJOS: EJES, PINES, RUEDAS Y ENGRANAJES (recetas verificadas — seguilas al pie de la letra)
La herramienta POSICIONA piezas pero no las "encastra": está PERMITIDO y es CORRECTO superponer un eje o pin con la pieza que atraviesa (el dibujo no choca).

· PINES: cuando un pin une dos vigas, dibujalo superpuesto justo donde está la unión (mismo X Z aproximado, mismo nivel que las vigas). Si un pin o eje del mecanismo no se puede dibujar en su posición real (porque iría en vertical), ponelo ACOSTADO en un costado libre del modelo, como "pieza suelta junto al modelo" (los manuales reales hacen esto), y aclará en la consigna dónde se encastra de verdad.

· RUEDAS NXT: quedan paradas con su eje de giro a lo largo de Z. El neumático y la llanta NO van en la misma coordenada (cada una se ubica por su esquina): usá estas recetas exactas, todo a nivel 0:
  Rueda grande (con "neumatico nxt" en X Z):  llanta nxt en X+1.5 Z+0.5  ·  y el eje que la atraviesa: eje 6 negro en X+3 Z-1.5 nivel 3 rotar 90
  Rueda chica (con "neumatico chico nxt" en X Z):  llanta chica nxt en X+0.5 Z+0.5  ·  eje: eje 4 negro en X+1 Z-1 nivel 1.5 rotar 90
  Ejemplo completo de rueda grande con su eje:
  neumatico nxt negro en 10 0
  llanta nxt gris claro en 11.5 0.5
  eje 6 negro en 13 -1.5 nivel 3 rotar 90

· ENGRANAJES: se dibujan PARADOS, de frente al lector (su eje de giro corre a lo largo de Z), apoyados por su borde en su nivel. Un tren de engranajes en serie se arma así:
  1. Todos los engranajes del tren en la MISMA fila Z (mismo valor de Z) — así quedan en el mismo plano y se ven engranados de frente.
  2. La separación horizontal entre CENTROS debe ser EXACTA: (dientes1 + dientes2) / 16 studs. Y como cada engranaje apoya por su borde, los tamaños distintos se compensan con "nivel" para que los centros queden a la misma altura (como si compartieran una viga horizontal).
  3. Recetas ya calculadas (primer engranaje "en X Z nivel N", el siguiente a su derecha, misma Z):
  - engranaje 8  + engranaje 8  → el segundo en X+1, mismo nivel
  - engranaje 16 + engranaje 16 → el segundo en X+2, mismo nivel
  - engranaje 24 + engranaje 24 → el segundo en X+3, mismo nivel
  - engranaje 40 + engranaje 40 → el segundo en X+5, mismo nivel
  - engranaje 24 + engranaje 8  → el 8 en X+3, nivel N+2.5
  - engranaje 24 + engranaje 40 → el 40 en X+3, nivel N-2.5 (el 24 debe estar a nivel 2.5 o más)
  - engranaje 40 + engranaje 8  → el 8 en X+5, nivel N+5
  NO acerques ni alejes los engranajes "a ojo": si la separación no es exacta quedan mordidos o sueltos y el manual sale mal. Preferí 8, 24 y 40 (sus diferencias de nivel son múltiplos exactos de 2.5 placas = 1 agujero de viga).
  4. El eje de un engranaje va a lo largo de Z (rotar 90), pasando por su centro. Para "engranaje 24 en X Z nivel N": su centro está en (X+1.5, Z+0.5) a la altura N+4 placas → eje 4 negro en X+1 Z-1.5 nivel N+3.5 rotar 90. Ejemplo completo de tren 24→40 con eje en el 24:
  engranaje 24 gris claro en 0 0 nivel 2.5
  engranaje 40 gris oscuro en 3 0 nivel 0
  eje 4 negro en 1 -1.5 nivel 6 rotar 90
  5. Los engranajes cónicos y el tornillo sin fin cambian el eje de giro 90°: usalos solo si hace falta y aclaralo en las notas; el tornillo sin fin se dibuja junto al engranaje que mueve, tocándolo.

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
