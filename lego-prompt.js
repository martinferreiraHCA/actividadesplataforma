// Generador del prompt para IA de las guías de ensamble LEGO.
// El prompt explica el contexto, la sintaxis completa y las reglas físicas,
// para que la IA devuelva la guía entera de una sola vez, lista para pegar.
// Si hay un kit activo (ej: NXT), el catálogo del prompt se limita a sus
// piezas — y si se indicó cuántos kits hay, también a sus cantidades.

import { COLORES, CATEGORIAS, KITS, CAT_IMPORTADAS, piezasDeKit, cantidadEnKit, conectoresLegibles } from './lego-catalogo.js';

function tablaPiezas(kit, cantidadKits) {
  const piezas = piezasDeKit(kit);
  const filas = [];
  for (const cat of CATEGORIAS) {
    // las piezas importadas de un .ldr no van al prompt: la IA solo puede
    // diseñar con el catálogo estable
    if (cat === CAT_IMPORTADAS) continue;
    const lista = piezas.filter(p => p.cat === cat);
    if (!lista.length) continue;
    filas.push('· ' + cat + ':');
    for (const p of lista) {
      const max = cantidadEnKit(p, kit, cantidadKits);
      const tope = max ? ` — tenés ${max} disponibles como MÁXIMO` : '';
      filas.push(`    "${p.clave}" — ${p.nombre}, ocupa ${p.w}×${p.d} studs sin rotar, alto ${p.alto} placa(s) · conecta por: ${conectoresLegibles(p)}${tope}`);
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

CÓMO SE CONECTAN LAS PIEZAS (tabla de compatibilidad — NADA se sostiene sin una unión de esta lista)
Cada pieza de la tabla dice sus conectores ("conecta por:"). Las ÚNICAS uniones físicas válidas son:
- studs arriba ↔ tubos abajo — ladrillos, placas, pendientes y ladrillos técnicos se apilan entre sí.
- pin macho ↔ agujero de pin — los pines unen vigas, ladrillos técnicos, bloques cruz, motor, sensores y bloque NXT.
- eje macho ↔ agujero en cruz — los ejes atraviesan engranajes, bujes, llantas, poleas y bloques cruz.
- neumático ↔ llanta — con la receta de rueda.
Antes de escribir cada línea de pieza, preguntate: ¿con cuál de estas 4 uniones queda agarrada esta pieza, y a qué pieza? Si no hay respuesta, interponé la pieza que las conecta (un pin, un eje, una placa...). El sistema valida las conexiones y marca las piezas sueltas.
PROHIBICIONES (los errores más comunes — no los cometas):
- Las VIGAS no tienen studs ni tubos: NUNCA apiles una viga sobre ladrillos ni apoyes nada "pegado" sobre una viga. Las vigas se unen SOLO con pines (viga volcado + pin, receta calibrada) o con ejes por sus agujeros.
- Engranajes, bujes, llantas, poleas y neumáticos NUNCA van apoyados en el piso ni sobre otra pieza: solo existen montados en un eje o pin-eje (regla maestra) — y el neumático sobre su llanta.
- Motor, sensores y bloque NXT no se pegan por studs: se sujetan con PINES por sus agujeros a vigas (recetas calibradas). El bloque NXT puede además apoyarse sobre la estructura, pero siempre sujetado con pines.
- Sobre una pieza "lisa" (tile) no se apoya nada: no tiene studs.

REGLAS FÍSICAS OBLIGATORIAS (el modelo tiene que poder armarse de verdad)
1. Ninguna pieza puede flotar: su base apoya en el suelo (nivel 0) o sobre piezas ya puestas — y además debe quedar CONECTADA con una unión de la tabla de arriba.
2. Dos piezas no pueden ocupar el mismo lugar: cuidá que no se superpongan ni en la cuadrícula ni en altura (un ladrillo en nivel 0 ocupa los niveles 0, 1 y 2; el siguiente arriba va en nivel 3). Excepción: los ejes/pines superpuestos con la pieza que atraviesan.
3. Trabá las piezas entre sí para que el modelo quede firme${infoKit ? ' (en Technic: vigas unidas con pines, ejes con bujes de tope)' : ': las piezas de arriba deben cruzar las juntas de las de abajo'}.
4. Armá de abajo hacia arriba: los primeros pasos son la base y la estructura, los últimos los detalles${infoKit ? ' (los sensores y cables al final)' : ' de arriba'}.
5. Usá pocas piezas distintas y colores consistentes, como un set real.
6. En la consigna o las notas de cada paso, decí CON QUÉ y CÓMO se conecta lo nuevo ("los pines entran en los agujeros 2 y 4 de la viga").

ORIENTACIÓN DE LAS PIEZAS DIRECCIONALES (verificado pieza por pieza — memorizalo antes de ubicar nada)
Cada pieza direccional tiene una orientación fija sin rotar; "rotar" la gira en horizontal. Guía:
- pendientes, pendiente invertida, techo curvo y soporte (bracket): la cara inclinada / el voladizo / los studs laterales miran hacia -Z (hacia el fondo). rotar 90 → miran a -X (izquierda) · rotar 180 → +Z (al frente) · rotar 270 → +X (derecha). Para un techo a dos aguas sobre una pared que corre a lo largo de X: la fila de atrás sin rotar y la fila de adelante con rotar 180, enfrentadas.
- faro 1x1: el stud lateral mira a -Z (misma regla de rotación).
- sensores NXT (ultrasónico, contacto, sonido, luz): la "cara" del sensor (ojos, botón naranja) mira a -Z; los agujeros de montaje quedan atrás (+Z). Para que el sensor mire al frente del robot usá rotar 180.
- bloque nxt: pantalla hacia arriba, los 4 puertos de sensores miran a -Z y el puerto USB a +Z. Ocupa 9×14 studs: reservale lugar.
- motor nxt: ocupa 5 studs de ancho (X) por ~14 de largo (Z); su EJE naranja sale hacia +X, a ~9.6 placas de altura, cerca del extremo de mayor Z del cuerpo (medido con piezas reales — las recetas de abajo traen los números exactos). Para dos motores enfrentados (robot con dos ruedas), uno sin rotar y el otro rotar 180.
- vigas rectas: a lo largo de X sin rotar, ACOSTADAS, con sus agujeros mirando hacia arriba. Vigas angulares y curvas: el brazo LARGO corre a lo largo de Z sin rotar (huella según la tabla de piezas).
- ejes y pines: acostados a lo largo de X sin rotar; rotar 90 los pone a lo largo de Z.
- LA PALABRA "parado" (al final de la línea, después de nivel y rotar): vuelca la pieza 90° hacia arriba. Una "viga 9 ... parado" queda de pie a lo largo de X con sus AGUJEROS de frente (hacia Z).
- LA PALABRA "volcado" (misma posición): vuelca la pieza 90° de costado. Una "viga 9 ... volcado" queda acostada A LO LARGO DE Z con sus AGUJEROS de costado (hacia X) — ESTA es la orientación con la que se montan pines, ejes y motores en los robots reales: preferila para el chasis. Un "eje 4 ... volcado" queda VERTICAL.

MECANISMOS PROLIJOS (recetas CALIBRADAS con piezas reales — seguilas al pie de la letra)
La herramienta POSICIONA piezas pero no las "encastra": está PERMITIDO y es CORRECTO superponer un eje o pin con la pieza que atraviesa (el dibujo no choca).

· MONTAR PIEZAS EN UN EJE ACOSTADO (regla maestra, calibrada): con un "eje N (sin rotar) en X Z nivel V", cualquier pieza redonda montada en él (buje, engranaje, polea, knob, cónico, tornillo) va con "rotar 90", su posición a lo largo del eje es LIBRE (elegí cualquier x sobre el eje), y para quedar CENTRADA en el eje usa:
  z = Z + 0.5 - (ancho de la pieza / 2)     ·     nivel = V + 0.75 - (alto de la pieza / 2)
  Ya calculado para cada pieza (relativo al eje en X Z nivel V):
  - buje / medio buje:        z = Z,     nivel V-0.5
  - engranaje 8:              z = Z,     nivel V-0.75
  - engranaje 16:             z = Z-0.5, nivel V-2
  - engranaje 24 / corona 24: z = Z-1,   nivel V-3.25
  - engranaje 40:             z = Z-2,   nivel V-5.75
  - engranaje conico 12:      z = Z-0.5, nivel V-1.5
  - engranaje conico 20:      z = Z-1,   nivel V-2.75
  - engranaje conico 36:      z = Z-2,   nivel V-5.25
  - rueda de mando / polea:   z = Z-1,   nivel V-3
  - neumatico de polea:       z = Z-1.5, nivel V-4
  - tornillo sin fin:         z = Z,     nivel V-0.75
  El eje necesita altura para que la pieza grande no toque el piso: para un engranaje 24 el eje va a nivel 3.25 o más; para un 40, a nivel 5.75 o más. Ejemplo completo calibrado (eje con buje de tope y engranaje 24):
  eje 5 gris claro en 0 0 nivel 4
  buje gris claro en 4 0 nivel 3.5 rotar 90
  engranaje 24 gris claro en 1.5 -1 nivel 0.75 rotar 90

· PINES EN VIGAS (calibrado): la viga que recibe pines va VOLCADA. "viga N en X Z nivel V volcado" ocupa x = X a X+1 y z = Z a Z+N, con sus agujeros hacia X en z = Z+0.5+k (k = 0...N-1) a la altura V+1.25 placas. El pin entra sin rotar (a lo largo de X), centrado en la viga:
  pin negro en X-0.5 Z+k nivel V+0.25
  Para unir DOS vigas volcadas paralelas (pegadas: una en X y otra en X+1, mismo Z y nivel), el pin largo las atraviesa: pin largo azul en X-0.5 Z+k nivel V+0.25. Ejemplo completo calibrado:
  viga 5 gris oscuro en 0 0 volcado
  viga 5 gris oscuro en 1 0 volcado
  pin largo azul en -0.5 1 nivel 0.25
  pin largo azul en -0.5 3 nivel 0.25
  Un "pin eje" o "medio pin" sigue la misma receta; si en la punta del pin eje va un engranaje, montalo con la regla del eje (rotar 90, centrado a la altura del pin: nivel del pin + 0.25 - alto/2 + 0.75... usá: engranaje 8 → nivel V-0.75 respecto del NIVEL DEL AGUJERO menos 1.25).

· RUEDAS NXT (calibrado, concéntrico exacto — el eje de giro queda a lo largo de Z):
  Rueda grande rodando por el piso, con "llanta nxt" en X Z:
  llanta nxt gris claro en X Z nivel 4.125
  neumatico nxt negro en X-1.65 Z-0.35 nivel 0
  eje 6 negro en X+1.4 Z-3.75 nivel 8.125 rotar 270
  Rueda chica rodando por el piso, con "llanta chica nxt" en X Z:
  llanta chica nxt gris claro en X Z nivel 1.125
  neumatico chico nxt negro en X-0.45 Z+0.15 nivel 0
  eje 4 negro en X+0.55 Z-1 nivel 3.125 rotar 90

· MOTOR NXT (calibrado): con "motor nxt en X Z nivel 0", su eje naranja sale hacia +X. Recetas exactas:
  - eje en el motor:  eje 6 negro en X+1 Z+11.55 nivel 9.625
  - rueda motriz completa en ese eje (la rueda queda vertical, mirando a X, sin tocar el piso — el robot apoya en ella al terminar):
    llanta nxt gris claro en X+3.25 Z+10.15 nivel 5.625 rotar 270
    neumatico nxt negro en X+2.9 Z+8.5 nivel 1.5 rotar 270
  - pines para sujetar el motor por su costado (la viga del chasis va volcada, pegada al costado del motor):
    pin negro en X+3.5 Z+11.5 nivel 6.875   y   pin negro en X+3.5 Z+11.5 nivel 12
  Para el robot clásico de dos ruedas: un motor sin rotar (rueda hacia +X) y el otro con rotar 180 (rueda hacia -X), y el bloque nxt apoyado arriba.

· ENGRANAJES ENGRANADOS ENTRE SÍ: se dibujan parados (de frente al lector, eje de giro a lo largo de Z). Misma fila Z, separación horizontal entre CENTROS = (dientes1 + dientes2) / 16 studs, y los tamaños distintos se compensan con "nivel" para que los centros queden a la misma altura. Recetas (primer engranaje "en X Z nivel N", el siguiente a su derecha, misma Z):
  - engranaje 8 + engranaje 8  → el segundo en X+1, mismo nivel  ·  16+16 → X+2  ·  24+24 → X+3  ·  40+40 → X+5
  - engranaje 24 + engranaje 8  → el 8 en X+3, nivel N+2.5
  - engranaje 24 + engranaje 40 → el 40 en X+3, nivel N-2.5 (el 24 a nivel 2.5 o más)
  - engranaje 40 + engranaje 8  → el 8 en X+5, nivel N+5
  - engranaje conico 12 + conico 12 (en el mismo plano) → el segundo en X+1.5, mismo nivel (calibrado)
  NO acerques ni alejes los engranajes "a ojo": si la separación no es exacta quedan mordidos o sueltos. Preferí 8, 24 y 40. Lo más prolijo es que cada engranaje del tren esté además montado en su eje con la regla maestra, y los ejes claven en los agujeros de una viga volcada o parada.
  El eje de un engranaje suelto va a lo largo de Z (rotar 90) por su centro: para "engranaje 24 en X Z nivel N" → eje 4 negro en X+1 Z-1.5 nivel N+3.5 rotar 90.

· PUENTE TÉCNICO (calibrado con un modelo real): para levantar ejes en alto, armá torres de ladrillos técnicos y cruzá una VIGA PARADA por delante:
  - la viga parada con nivel = (nivel del ladrillo técnico de arriba) + 0.75 deja sus agujeros ALINEADOS con los agujeros de los ladrillos;
  - la viga va delante de los ladrillos (su z = z del ladrillo - 1) y se sujeta con un pin por torre: pin negro en X+0.5 Z-0.5 nivel N+0.7 rotar 90 (X, Z, N = posición y nivel del ladrillo técnico superior);
  - después los ejes van por los agujeros de la viga (regla de la viga parada) y los engranajes se montan en los ejes con la regla maestra. Elegí agujeros separados 4 studs para engranar 24+40 y 3 studs para 40+8.
  Ejemplo completo calibrado (torre + puente + eje):
  tecnico 1x2 gris claro en 10 4 nivel 6
  viga 11 gris oscuro en 0.5 3 nivel 6.75 parado
  pin negro en 10.5 3.5 nivel 6.7 rotar 90
  eje 6 negro en 5.5 -1 nivel 7 rotar 90

· AGUJEROS DE BLOQUES Y LADRILLOS TÉCNICOS (calibrado):
  - "bloque cruz 1x2 en X Z nivel V": el eje por su agujero-cruz va: eje 3 negro en (x libre) Z nivel V+2.875 · y un pin en su agujero-pin: pin negro en X Z+0.6 nivel V+0.2 rotar 270
  - "tecnico 1x2 en X Z nivel V rotar 90" (el ladrillo se rota para que el agujero mire a X): pin negro en (x libre) Z+0.5 nivel V+0.75
  - "ladrillo con cruz en X Z nivel V rotar 270": eje 3 negro en (x libre) Z+0.5 nivel V+0.94

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
