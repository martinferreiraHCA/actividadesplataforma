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
    nombre: '⚙️ Banco de engranajes (reductor 24→40)',
    descripcion: 'Dos vigas paradas con ejes en sus agujeros, engranajes engranados y manivela. Para estudiar transmisiones.',
    texto: `titulo: Banco de engranajes
nivel: Robótica — kit NXT
descripcion: Un banco de pruebas de transmisiones: dos vigas sostienen dos ejes con un engranaje chico y uno grande engranados. Girando la manivela se ve la reducción de velocidad y el aumento de fuerza.

=== PASO: Las torres de apoyo ===
consigna: Armá dos torres de dos ladrillos técnicos cada una: son las patas que van a sostener las vigas del banco.
piezas:
tecnico 1x2 gris claro en 0 0.5 rotar 90
tecnico 1x2 gris claro en 0 0.5 nivel 3 rotar 90
tecnico 1x2 gris claro en 8 0.5 rotar 90
tecnico 1x2 gris claro en 8 0.5 nivel 3 rotar 90
notas: Dos ladrillos técnicos apilados miden 6 placas: la altura justa para que el engranaje grande no toque la mesa.

=== PASO: Las paredes del banco ===
consigna: Pará las dos vigas de 9 sobre las torres, una delante de la otra, y unilas con los dos pines largos por los agujeros 1 y 7.
piezas:
viga 9 gris oscuro en 0 0 nivel 6 parado
viga 9 gris oscuro en 0 2 nivel 6 parado
pin largo azul en 1 0 nivel 6.5 rotar 90
pin largo azul en 7 0 nivel 6.5 rotar 90
notas: Las vigas van de pie, con los agujeros mirando hacia vos. Los pines largos las dejan firmes y paralelas.

=== PASO: El eje de entrada con su engranaje ===
consigna: Pasá el primer eje por el agujero 2 de las dos vigas y montale el engranaje de 24 dientes en el espacio que queda entre ellas.
piezas:
eje 6 negro en 2 -1.5 nivel 6.5 rotar 90
engranaje 24 gris claro en 1 1 nivel 3.25
notas: El engranaje queda "preso" entre las dos vigas, centrado en su eje.

=== PASO: El eje de salida con el engranaje grande ===
consigna: Ahora el segundo eje por el agujero 6, con el engranaje de 40 dientes: tiene que engranar justo con el de 24.
piezas:
eje 4 negro en 6 -0.5 nivel 6.5 rotar 90
engranaje 40 gris oscuro en 4 1 nivel 0.75
notas: 24 + 40 dientes = 4 studs justos entre centros: por eso usamos los agujeros 2 y 6. Girá un eje con la mano y mirá el otro.

=== PASO: La manivela ===
consigna: En la punta del eje de entrada, adelante de todo, poné la rueda de mando como manivela.
piezas:
rueda de mando negro en 1 -1.5 nivel 3.5
notas: Una vuelta de manivela = 24/40 de vuelta en el eje grande: gira más despacio, pero con más fuerza. ¡Eso es una reducción!`
  },
];
