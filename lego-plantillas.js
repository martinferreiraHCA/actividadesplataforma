// Proyectos precargados de las guías LEGO. Sirven como base editable (se
// cargan y se retocan en el editor visual o el 3D) y como "campo de
// calibración": son modelos con conexiones complejas armados con las recetas
// calibradas — si algo se ve mal acá, se corrige en el editor 3D o el banco
// de calibración, se exporta como texto y esa corrección vuelve al sistema.

export const PLANTILLAS_LEGO = [
  {
    id: 'carrito',
    nombre: '🏎 El carrito veloz (clásico, 4 pasos)',
    descripcion: 'Carrito con ladrillos clásicos: base con ruedas, motor, cabina y techo.',
    texto: `titulo: El carrito veloz
nivel: Escuela — 3° en adelante
descripcion: Vamos a armar un carrito de carrera con base, motor y techo. Al final vas a poder decorarlo como quieras.

=== PASO: La base con ruedas ===
consigna: Buscá las dos placas con pernos de rueda y la placa larga. Poné las placas con pernos en el suelo y uní todo con la placa larga arriba.
piezas:
placa con ruedas 2x2 gris oscuro en 0 0
placa con ruedas 2x2 gris oscuro en 4 0
placa 2x6 gris claro en 0 0 nivel 1
notas: Las placas son las piezas finitas: 3 placas apiladas miden lo mismo que 1 ladrillo.

=== PASO: El motor ===
consigna: Colocá el ladrillo rojo grande sobre la base, dejando libre un stud adelante y otro atrás.
piezas:
ladrillo 2x4 rojo en 1 0 nivel 2
notas: Fijate que el ladrillo quede bien centrado: tiene que trabar las dos placas de abajo.

=== PASO: La cabina ===
consigna: Ahora la cabina del piloto: un ladrillo azul chiquito adelante del motor.
piezas:
ladrillo 2x2 azul en 1 0 nivel 5
notas: ¿Ves cómo el carrito va creciendo hacia arriba? Cada pieza suma 3 niveles de altura.

=== PASO: El techo y los detalles ===
consigna: Terminá el carrito: el techo liso arriba de la cabina y el faro adelante.
piezas:
lisa 2x2 blanco en 1 0 nivel 8
placa redonda 1x1 amarillo en 0 0 nivel 2
placa redonda 1x1 amarillo en 0 1 nivel 2
notas: Las piezas lisas no tienen studs: quedan como terminación. ¡Carrito listo!`
  },
  {
    id: 'robot-nxt',
    nombre: '🤖 Robot explorador NXT (base motriz)',
    descripcion: 'Dos motores con ruedas motrices, el bloque NXT arriba y sensor de contacto al frente. Todo con recetas calibradas.',
    texto: `titulo: Robot explorador NXT
nivel: Robótica — kit NXT
descripcion: La base motriz clásica del NXT: dos servomotores enfrentados con sus ruedas, el bloque inteligente arriba y un sensor de contacto de paragolpes. Es la base de casi todos los robots del kit.

=== PASO: El primer motor ===
consigna: Apoyá un servomotor en la mesa con el eje naranja apuntando a la derecha, y montale la rueda: el eje entra en el cubo naranja y la llanta con su neumático quedan enganchados en el eje.
piezas:
motor nxt gris claro en 8 0
eje 6 negro en 9 11.55 nivel 9.625
llanta nxt gris claro en 11.25 10.15 nivel 5.625 rotar 270
neumatico nxt negro en 10.9 8.5 nivel 1.5 rotar 270
notas: El eje naranja del motor es el que gira: todo lo que enganches ahí, gira con él.

=== PASO: El segundo motor, espejado ===
consigna: El otro motor va dado vuelta (girado 180°), con su eje naranja hacia la izquierda, para que las dos ruedas queden una a cada lado del robot.
piezas:
motor nxt gris claro en 0 10.6 rotar 180
eje 6 negro en -2 11.55 nivel 9.625
llanta nxt gris claro en -1.25 9.95 nivel 5.625 rotar 90
neumatico nxt negro en -0.9 8.6 nivel 1.5 rotar 90
notas: Fijate que las dos ruedas quedan alineadas: esa línea es el eje de giro del robot.

=== PASO: El cerebro ===
consigna: El bloque NXT va apoyado arriba, cruzado sobre los dos motores, y se sujeta con dos pines de fricción a los agujeros laterales.
piezas:
bloque nxt gris claro en 2 5 nivel 14
pin negro en 1.5 8 nivel 14.5
pin negro en 1.5 15 nivel 14.5
notas: La pantalla queda mirando hacia arriba y los puertos de sensores hacia el frente del robot.

=== PASO: El paragolpes ===
consigna: Al frente va el sensor de contacto, sujetado con un pin al cuerpo del motor: cuando el robot choque, el botón naranja se hunde y el programa lo sabe.
piezas:
sensor de contacto negro en 9.5 -6
pin negro en 10 -1 nivel 5 rotar 90
notas: ¡Robot listo! Conectá los cables: motores en B y C, sensor de contacto en el puerto 1.`
  },
  {
    id: 'reductor-nxt',
    nombre: '⚙️ Banco de engranajes (24→40→8)',
    descripcion: 'Base técnica con torres, puente de viga parada pineado y tren de tres engranajes con manivela. Diseño calibrado con piezas reales.',
    texto: `titulo: Banco de engranajes
nivel: Robótica — kit NXT
descripcion: Un banco de pruebas de transmisiones sobre una base firme: un puente de viga sostiene tres ejes con un tren de engranajes 24→40→8. Girando la manivela se ve cómo cambian la velocidad y la fuerza en cada engranaje.

=== PASO: La base firme ===
consigna: Empezá por la base: el ladrillo técnico largo apoyado en la mesa, y un ladrillo corto arriba en cada punta.
piezas:
tecnico 1x16 gris oscuro en 0 4
tecnico 1x2 gris claro en 1 4 nivel 3
tecnico 1x2 gris claro en 10 4 nivel 3
notas: La base larga hace de cimiento: cuanto más abajo esté el peso, más firme queda el banco.

=== PASO: Subimos las torres ===
consigna: Un ladrillo técnico más sobre cada torre: necesitamos altura para que el engranaje grande gire sin tocar la mesa.
piezas:
tecnico 1x2 gris claro en 1 4 nivel 6
tecnico 1x2 gris claro en 10 4 nivel 6
notas: Cada ladrillo suma 3 placas de altura. Las torres quedan de 9 placas.

=== PASO: El puente ===
consigna: La viga de 11 va parada, delante de las torres, con sus agujeros alineados con los de los ladrillos. Sujetala con los pines: entran por la viga y llegan al agujero del ladrillo de atrás.
piezas:
viga 11 gris oscuro en 0.5 3 nivel 6.75 parado
pin negro en 1.5 3.5 nivel 6.7 rotar 90
pin negro en 10.5 3.5 nivel 6.7 rotar 90
notas: Truco calibrado: la viga parada a nivel del ladrillo + 0.75 deja sus agujeros justo a la altura de los agujeros del técnico.

=== PASO: Los tres ejes ===
consigna: Tres ejes por los agujeros 2, 6 y 9 del puente. Adelante van a ir los engranajes; atrás, la manivela y los topes.
piezas:
eje 6 negro en 1.5 0 nivel 7 rotar 90
eje 6 negro en 5.5 -1 nivel 7 rotar 90
eje 6 negro en 8.5 -1 nivel 7 rotar 90
notas: Los agujeros 2→6 son 4 studs (justo para 24+40) y 6→9 son 3 studs (justo para 40+8).

=== PASO: El engranaje de entrada ===
consigna: En el primer eje: el engranaje de 24 dientes adelante y la rueda de mando atrás, como manivela.
piezas:
engranaje 24 gris claro en 0.5 2 nivel 3.75
rueda de mando negro en 0.5 5 nivel 4
notas: Todo lo que gira en este eje, gira junto: la manivela mueve el 24.

=== PASO: El engranaje gigante ===
consigna: En el eje del medio va el engranaje de 40 dientes, engranado con el de 24. El buje de atrás evita que el eje se salga.
piezas:
engranaje 40 gris oscuro en 3.5 2 nivel 1.5
buje gris claro en 5.5 4 nivel 6.5
notas: 24→40: el grande gira más despacio pero con más fuerza. Eso es una reducción.

=== PASO: El engranaje veloz ===
consigna: En el tercer eje, el piñón de 8 dientes engranado con el gigante, con su buje de tope. ¡A girar la manivela!
piezas:
engranaje 8 gris oscuro en 8.5 2 nivel 6.25
buje gris claro en 8.5 4 nivel 6.5
notas: 40→8: ahora al revés, ¡el chico gira 5 veces por cada vuelta del grande! Multiplicaste la velocidad.`
  },
];
