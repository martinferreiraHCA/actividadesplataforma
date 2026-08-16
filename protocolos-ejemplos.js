// protocolos-ejemplos.js — Prácticos completos listos para usar o editar.
//
// Están escritos en el mismo formato de texto que entiende el generador: sirven
// de plantilla para el docente y, de paso, de ejemplo del formato que conviene
// pedirle a una IA.

export const EJEMPLOS = [

{
  id: 'densidad',
  nombre: 'Densidad de sólidos irregulares',
  area: 'Física · Química',
  nivel: '3° Ciclo Básico',
  resumen: 'Masa con balanza, volumen por desplazamiento de agua y densidad como cociente. El clásico para estrenar la probeta.',
  texto: `# Protocolo: Determinación de la densidad de sólidos irregulares
# Asignatura: Física
# Nivel: 3° de Ciclo Básico
# Duración: 90 minutos

## Fundamento
La densidad es una propiedad característica de cada material: relaciona cuánta masa hay en cada unidad de volumen. Se calcula como el cociente entre la masa del cuerpo y el volumen que ocupa, d = m / V. Dos cuerpos del mismo material tienen la misma densidad aunque uno sea mucho más grande que el otro, y por eso la densidad sirve para identificar de qué está hecho algo.

Medir la masa es directo: se apoya el cuerpo en la balanza. El volumen es el problema cuando el cuerpo tiene una forma irregular y no hay fórmula geométrica que valga. Ahí se usa el método del desplazamiento, atribuido a Arquímedes: un cuerpo sumergido desaloja un volumen de agua exactamente igual al suyo. Si la probeta tenía V1 de agua y al sumergir el cuerpo el nivel sube hasta V2, el volumen del cuerpo es la diferencia V2 − V1.

Ninguna medida es exacta. La balanza aprecia hasta 0,1 g y la probeta hasta 1 mL, así que cada valor se anota con su incertidumbre y el resultado final se informa con una cantidad de cifras coherente con esas medidas.

## Objetivos
- Determinar experimentalmente la densidad de tres sólidos irregulares.
- Medir volúmenes por desplazamiento de agua usando correctamente la probeta.
- Expresar cada medida con su unidad y su incertidumbre.
- Identificar el material de cada cuerpo comparando con una tabla de densidades.

## Materiales
- 3 cuerpos sólidos irregulares :: tornillos, piedras o trozos de metal que entren por la boca de la probeta
- 1 vaso de precipitados de 250 mL
- agua de la canilla :: unos 300 mL
- 1 hilo fino :: para bajar los cuerpos sin que salpiquen
- 1 paño o papel absorbente
- 1 tabla de densidades de materiales comunes

## Instrumentos
- probeta :: max=100, division=1, numerarCada=10, unidad=mL, lectura=64 :: para medir el volumen por desplazamiento
- balanzaDigital :: max=500, division=0.1, unidad=g, lectura=126.4 :: para medir la masa de cada cuerpo

## Seguridad
- Secá enseguida el agua que se derrame en la mesada: el piso mojado es la causa más común de accidentes en el laboratorio.
- Bajá los cuerpos con el hilo, despacio: si los tirás, la probeta se puede rajar y el agua salpica.
- No apoyes la probeta cerca del borde de la mesa.

## Montaje
Sobre la mesada, de izquierda a derecha: la balanza (nivelada y encendida en cero), la probeta apoyada sobre una superficie plana y el vaso con agua. La probeta tiene que estar apoyada, nunca en la mano, y hay que mirarla a la altura de los ojos para leer el menisco sin error de paralaje. Antes de empezar, verificá que la balanza marque 0,0 g con el plato vacío.

## Procedimiento
1. Preparar la balanza :: Encendé la balanza, esperá a que marque 0,0 g y verificá que esté nivelada. Si no está en cero, apretá TARA.
2. Medir la masa :: Apoyá el primer cuerpo en el plato, esperá a que el número se estabilice y anotá la masa en la tabla, con la unidad.
3. Cargar la probeta :: Llenala con agua hasta unos 50 mL. No importa el valor exacto, pero sí anotarlo bien: ése es V1.
4. Leer el volumen inicial :: Apoyá la probeta en la mesada, agachate hasta que tus ojos queden a la altura del agua y leé la parte de abajo del menisco. Anotá V1.
5. Sumergir el cuerpo :: Atá el cuerpo con el hilo y bajalo despacio hasta el fondo de la probeta, cuidando que quede totalmente cubierto de agua y que no queden burbujas pegadas.
6. Leer el volumen final :: Esperá unos segundos a que el agua se calme y leé de nuevo el menisco. Ése es V2.
7. Repetir con los otros cuerpos :: Sacá el cuerpo, secalo y repetí los pasos 2 a 6 con los otros dos. Si el nivel de agua quedó muy alto, volvé a empezar con 50 mL.
8. Ordenar los datos :: Completá la tabla y revisá que todas las medidas tengan unidad. Recién ahí empezá con los cálculos.

## Tablas
### Masa y volumen de cada cuerpo
| Cuerpo | m (g) ± 0,1 | V1 (mL) ± 0,5 | V2 (mL) ± 0,5 | V = V2 − V1 (mL) | d = m/V (g/mL) |
filas: 3

## Cálculos
- Volumen del cuerpo :: V = V2 − V1 :: mL :: Restá los dos volúmenes leídos en la probeta. Al restar dos medidas, las incertidumbres se suman: ± 1 mL.
- Densidad :: d = m / V :: g/mL :: Dividí la masa entre el volumen que acabás de calcular. Redondeá el resultado a dos cifras decimales.
- Densidad en unidades del SI :: d = (m/V) × 1000 :: kg/m³ :: Multiplicá el resultado anterior por 1000 para expresarlo como pide el Sistema Internacional.

## Preguntas
- ¿Los tres cuerpos tienen la misma densidad? Si dos dieron parecido, ¿podés afirmar que son del mismo material?
- Si hubieras usado un cuerpo del mismo material pero del doble de tamaño, ¿qué habría pasado con la masa, con el volumen y con la densidad?
- ¿Qué error se comete si se lee el menisco desde arriba en lugar de a la altura de los ojos? ¿La densidad calculada saldría mayor o menor que la real?
- Una burbuja de aire pegada al cuerpo, ¿aumenta o disminuye el volumen medido? ¿Y la densidad calculada?
- Compará tus resultados con la tabla de densidades. ¿De qué material sería cada cuerpo? ¿Qué tan lejos estuviste del valor tabulado?

## Conclusiones
líneas: 8
Guía: Escribí qué densidad obtuviste para cada cuerpo y con qué material lo identificaste. ¿Cuál fue la medida que más incertidumbre aportó al resultado: la masa o el volumen? ¿Qué cambiarías del procedimiento para medir con más precisión la próxima vez?`
},

{
  id: 'hooke',
  nombre: 'Ley de Hooke: constante de un resorte',
  area: 'Física',
  nivel: '4° / 1° Bachillerato',
  resumen: 'Se cuelgan pesas, se mide el estiramiento y se busca la relación lineal entre fuerza y alargamiento.',
  texto: `# Protocolo: Ley de Hooke — constante elástica de un resorte
# Asignatura: Física
# Nivel: 4° año
# Duración: 90 minutos

## Fundamento
Cuando se le aplica una fuerza a un resorte, éste se estira. Robert Hooke descubrió en 1660 que, mientras no se pase del límite elástico, el alargamiento es directamente proporcional a la fuerza aplicada: F = k · Δx, donde Δx es lo que se estiró el resorte respecto de su longitud natural y k es la constante elástica, propia de cada resorte.

La constante k se mide en newton sobre metro (N/m) e indica qué tan duro es el resorte: cuanto mayor es k, más fuerza hay que hacer para estirarlo lo mismo. Si se grafica F en función de Δx se obtiene una recta que pasa por el origen, y la pendiente de esa recta es justamente k.

Si se sigue estirando más allá de cierto punto, el resorte se deforma de manera permanente y ya no vuelve a su largo original: ahí la ley deja de valer y la gráfica se curva. Parte del trabajo experimental es reconocer hasta dónde llega la zona en la que la proporcionalidad se cumple.

## Objetivos
- Determinar la constante elástica de un resorte a partir de medidas de fuerza y alargamiento.
- Construir e interpretar una gráfica fuerza-alargamiento.
- Reconocer experimentalmente el rango en que se cumple la proporcionalidad.

## Materiales
- 1 resorte helicoidal de laboratorio
- 1 soporte universal con nuez y varilla
- 6 pesas de ranura :: de 50 g cada una
- 1 portapesas
- 1 hoja de papel milimetrado :: o planilla de cálculo

## Instrumentos
- regla :: orientacion=vertical, max=50, division=0.1, numerarCada=5, unidad=cm, lectura=23.4 :: sujeta al soporte, para medir la posición del extremo del resorte
- dinamometro :: max=5, division=0.1, unidad=N, lectura=2.5 :: para controlar el peso de las pesas

## Seguridad
- No estires el resorte más allá del doble de su longitud natural: se deforma y queda inservible.
- Poné algo blando debajo del soporte: si el resorte se suelta, las pesas caen.
- No te pares con los pies debajo de las pesas colgadas.

## Montaje
Fijá la varilla al soporte universal y colgá el resorte de la nuez, bien vertical. Sujetá la regla al soporte, en paralelo al resorte, con el cero arriba y sin que toque el resorte. Colgá el portapesas vacío del extremo libre: esa posición del extremo es la posición inicial x0, a partir de la cual se miden todos los alargamientos. Verificá que el resorte cuelgue libre y que no roce ni la regla ni el soporte.

## Procedimiento
1. Medir la posición inicial :: Con el portapesas vacío colgado, leé en la regla la posición del extremo inferior del resorte y anotala como x0.
2. Colgar la primera pesa :: Agregá una pesa de 50 g. Esperá a que deje de oscilar antes de leer.
3. Medir la nueva posición :: Leé la posición x del extremo del resorte, mirando perpendicular a la regla para no cometer error de paralaje.
4. Repetir agregando pesas :: Sumá las pesas de a una, hasta las seis, midiendo la posición después de cada una.
5. Controlar la vuelta :: Sacá las pesas de a una y volvé a medir cada posición. Si al quedar vacío el resorte no vuelve a x0, te pasaste del límite elástico y hay que descartar los últimos puntos.
6. Calcular fuerzas y alargamientos :: Para cada fila, calculá el peso colgado (F = m · g, con g = 9,8 m/s²) y el alargamiento Δx = x − x0. Pasá los alargamientos a metros.
7. Graficar :: Dibujá la gráfica de F (eje vertical) en función de Δx (eje horizontal) y trazá la recta que mejor se ajuste a los puntos.
8. Obtener la constante :: Calculá la pendiente de la recta tomando dos puntos bien separados de la recta trazada, no dos puntos experimentales.

## Tablas
### Fuerza aplicada y alargamiento del resorte
| Masa colgada (g) | Peso F (N) | Posición x (cm) ± 0,1 | Alargamiento Δx (cm) | Δx (m) |
filas: 7

## Cálculos
- Peso colgado :: F = m · g :: N :: Pasá la masa a kilogramos y multiplicá por 9,8 m/s².
- Alargamiento :: Δx = x − x0 :: cm :: Restá a cada posición la posición inicial del resorte con el portapesas vacío.
- Constante elástica :: k = ΔF / Δ(Δx) :: N/m :: Es la pendiente de la recta: tomá dos puntos sobre la recta trazada y dividí la diferencia de fuerzas entre la diferencia de alargamientos, en metros.

## Preguntas
- ¿Los puntos de tu gráfica quedaron alineados? ¿Alguno se escapa claramente de la recta? ¿Por qué puede haber pasado?
- ¿La recta pasa por el origen? ¿Qué significaría físicamente que no pasara?
- ¿Qué valor de k obtuviste? ¿Qué fuerza habría que hacer, según ese valor, para estirar el resorte 10 cm?
- Si usaras dos resortes iguales colgados uno abajo del otro, ¿el conjunto se estiraría más, menos o igual con la misma pesa? Justificá.
- ¿Qué diferencia hay entre la masa colgada y el peso? ¿Por qué en la gráfica va el peso y no la masa?

## Conclusiones
líneas: 8
Guía: Informá el valor de k que obtuviste con su unidad. ¿Se cumplió la ley de Hooke en todo el rango que probaste o sólo en una parte? ¿Cuál fue la principal fuente de error de la experiencia y cómo la reducirías?`
},

{
  id: 'ohm',
  nombre: 'Ley de Ohm: resistencia de un conductor',
  area: 'Física',
  nivel: '5° / 2° Bachillerato',
  resumen: 'Circuito con voltímetro y amperímetro, tabla V-I y resistencia como pendiente. Incluye multímetro y medidor de aguja.',
  texto: `# Protocolo: Verificación de la ley de Ohm
# Asignatura: Física
# Nivel: 5° año
# Duración: 90 minutos

## Fundamento
En muchos conductores, la corriente que circula es directamente proporcional a la diferencia de potencial aplicada entre sus extremos. Esa relación, descubierta por Georg Ohm, se escribe V = R · I, donde R es la resistencia eléctrica del conductor y se mide en ohm (Ω).

Un conductor que cumple esta proporcionalidad se llama óhmico, y su gráfica V-I es una recta que pasa por el origen cuya pendiente es la resistencia. No todos los componentes son óhmicos: la resistencia de una lamparita de filamento aumenta bastante al calentarse, así que su gráfica se curva.

Para medir hay que conectar los instrumentos de manera distinta según qué midan: el voltímetro se conecta en paralelo con el elemento (mide la diferencia de potencial entre dos puntos) y el amperímetro en serie (toda la corriente tiene que pasar por él). Conectar un amperímetro en paralelo con la fuente es la manera más rápida de quemarlo.

## Objetivos
- Verificar experimentalmente la proporcionalidad entre tensión y corriente en un resistor.
- Determinar el valor de una resistencia a partir de la pendiente de la gráfica V-I.
- Conectar correctamente voltímetro y amperímetro en un circuito.
- Comparar el comportamiento de un resistor con el de una lamparita.

## Materiales
- 1 fuente de tensión variable de 0 a 12 V :: o 4 pilas con portapilas
- 1 resistor de valor desconocido :: de 100 Ω aproximadamente
- 1 lamparita de linterna con portalámparas
- 5 cables con pinzas cocodrilo
- 1 llave interruptora
- 1 hoja de papel milimetrado

## Instrumentos
- multimetro :: funcion=Vcc, rango=20 V, lectura=6.24, unidad=V, decimales=2 :: como voltímetro, en paralelo con el resistor
- aguja :: simbolo=A, min=0, max=0.5, division=0.01, numerarCada=0.1, unidad=A, lectura=0.06 :: como amperímetro, en serie con el circuito

## Seguridad
- Trabajá siempre con la llave abierta mientras armás o cambiás el circuito. Cerrala recién cuando esté todo conectado y revisado.
- No pases de 12 V ni dejes el circuito cerrado más tiempo del necesario: el resistor se calienta.
- Antes de cerrar la llave, mostrale el circuito al docente.

## Montaje
Armá un circuito en serie: fuente, llave, amperímetro y resistor. El amperímetro va intercalado en el circuito, de modo que toda la corriente pase por él, respetando la polaridad (borne + al lado del + de la fuente). El voltímetro se conecta aparte, en paralelo, con una punta en cada extremo del resistor. Empezá con la fuente en 0 V y el multímetro en el rango de 20 V continuos.

## Procedimiento
1. Armar el circuito :: Conectá fuente, llave abierta, amperímetro y resistor en serie. Dejá el voltímetro para el final.
2. Conectar el voltímetro :: Poné las puntas del multímetro, en función de tensión continua, una en cada extremo del resistor.
3. Revisar antes de encender :: Verificá polaridades y que el amperímetro esté en serie. Recién ahí cerrá la llave.
4. Primera medida :: Subí la fuente hasta 2 V y anotá la lectura del voltímetro y la del amperímetro al mismo tiempo.
5. Barrer el rango :: Repetí subiendo de a 2 V hasta 12 V. Anotá los dos valores en cada paso, sin apagar la fuente entre medida y medida.
6. Cortar :: Bajá la fuente a cero y abrí la llave antes de tocar nada.
7. Cambiar por la lamparita :: Reemplazá el resistor por la lamparita y repetí el barrido completo, anotando en la segunda tabla.
8. Graficar :: Dibujá V en función de I para los dos elementos, en la misma hoja y con los mismos ejes.

## Tablas
### Resistor: tensión y corriente
| Medida | V (V) ± 0,01 | I (A) ± 0,005 | R = V/I (Ω) |
filas: 6

### Lamparita: tensión y corriente
| Medida | V (V) ± 0,01 | I (A) ± 0,005 | R = V/I (Ω) |
filas: 6

## Cálculos
- Resistencia punto a punto :: R = V / I :: Ω :: Calculá el cociente en cada fila de la tabla. En un elemento óhmico tiene que dar siempre parecido.
- Resistencia de la gráfica :: R = ΔV / ΔI :: Ω :: Es la pendiente de la recta ajustada a los puntos del resistor.
- Potencia disipada :: P = V · I :: W :: Calculala para el punto de mayor tensión y compará con lo que aguanta el resistor.

## Preguntas
- ¿El cociente V/I se mantuvo constante en el resistor? ¿Y en la lamparita? ¿Qué te dice eso sobre cada elemento?
- ¿Por qué la gráfica de la lamparita se curva? ¿Qué le pasa al filamento a medida que sube la corriente?
- ¿Qué pasaría si conectaras el amperímetro en paralelo con el resistor? ¿Y el voltímetro en serie?
- ¿Cuál de tus dos maneras de calcular R (punto a punto o por la pendiente) te parece más confiable? ¿Por qué?
- Si duplicaras la tensión de la fuente, ¿qué corriente esperarías en el resistor? Comprobalo con tus datos.

## Conclusiones
líneas: 8
Guía: Informá el valor de la resistencia con su incertidumbre. ¿Se verificó la ley de Ohm en el resistor? ¿Qué diferencia encontraste con la lamparita y cómo la explicás?`
},

{
  id: 'calor',
  nombre: 'Equilibrio térmico y calor específico',
  area: 'Física · Química',
  nivel: '4° / 5° año',
  resumen: 'Se mezcla agua caliente con agua fría en un calorímetro casero y se verifica el balance de energía.',
  texto: `# Protocolo: Equilibrio térmico y calor específico
# Asignatura: Física
# Nivel: 4° año
# Duración: 90 minutos

## Fundamento
Cuando se ponen en contacto dos cuerpos a distinta temperatura, la energía pasa del más caliente al más frío hasta que los dos llegan a la misma temperatura: el equilibrio térmico. Si el sistema está bien aislado, toda la energía que pierde uno la gana el otro, y se cumple que el calor cedido es igual al calor absorbido.

La cantidad de calor que intercambia un cuerpo al cambiar de temperatura es Q = m · c · ΔT, donde m es la masa, ΔT la variación de temperatura y c el calor específico, que dice cuánta energía hace falta para subir un grado a un kilogramo de esa sustancia. El agua tiene un calor específico muy alto (4180 J/kg·°C), y por eso tarda tanto en calentarse y en enfriarse.

En la práctica ningún recipiente aísla perfectamente: parte del calor se va al aire y otra parte la absorbe el propio recipiente. Por eso la temperatura de equilibrio que se mide siempre queda un poco por debajo de la que predice el cálculo, y comparar las dos permite estimar cuánto perdió el sistema.

## Objetivos
- Verificar que en una mezcla de agua caliente y fría el calor cedido es igual al calor absorbido.
- Predecir la temperatura de equilibrio y compararla con la medida.
- Estimar las pérdidas de energía del calorímetro.

## Materiales
- 2 vasos de telgopor con tapa :: uno dentro del otro, hacen de calorímetro
- 1 pava eléctrica o mechero con trípode y rejilla
- 1 vaso de precipitados de 250 mL
- agua :: aproximadamente 1 litro
- 1 varilla de vidrio para agitar
- 1 cronómetro :: o el del celular

## Instrumentos
- termometro :: min=-10, max=110, division=1, numerarCada=10, unidad=°C, lectura=38 :: para las tres temperaturas
- balanzaDigital :: max=2000, division=1, unidad=g, lectura=150 :: para medir las masas de agua
- probeta :: max=250, division=2, numerarCada=50, unidad=mL, lectura=150 :: alternativa a la balanza para medir el agua

## Seguridad
- El agua caliente quema. Trasvasala despacio y con el vaso apoyado, nunca en el aire.
- No pases de 70 °C: alcanza para la experiencia y es mucho más seguro que hervir.
- Si el termómetro es de vidrio, no lo uses para agitar: se rompe.

## Montaje
Armá el calorímetro metiendo un vaso de telgopor dentro del otro y haciendo un agujero chico en la tapa para el termómetro. Sobre la mesada van, de un lado, la fuente de calor con el vaso de precipitados, y del otro, el calorímetro con la balanza al lado. El termómetro tiene que quedar sumergido en el agua pero sin tocar el fondo ni las paredes del vaso.

## Procedimiento
1. Medir el agua fría :: Poné 150 g de agua de la canilla en el calorímetro (medilos con la balanza o con la probeta). Anotá la masa como m1.
2. Medir su temperatura :: Meté el termómetro, esperá un minuto a que se estabilice y anotá la temperatura inicial T1.
3. Calentar la otra porción :: Calentá 150 g de agua en el vaso de precipitados hasta unos 60 o 70 °C. Anotá la masa como m2.
4. Medir la temperatura del agua caliente :: Justo antes de mezclar, medí la temperatura del agua caliente y anotala como T2. Hacelo rápido: se enfría mientras la mirás.
5. Mezclar :: Volcá el agua caliente en el calorímetro de una sola vez y tapá enseguida.
6. Seguir el equilibrio :: Agitá suavemente y leé la temperatura cada 15 segundos hasta que dos lecturas seguidas den lo mismo. Esa es la temperatura de equilibrio Te.
7. Repetir con otras masas :: Hacé una segunda corrida con masas distintas, por ejemplo 100 g de fría y 200 g de caliente.
8. Comparar con la predicción :: Calculá la temperatura de equilibrio teórica y compará con la que mediste.

## Tablas
### Mezclas de agua fría y agua caliente
| Corrida | m1 fría (g) ± 1 | T1 (°C) ± 0,5 | m2 caliente (g) ± 1 | T2 (°C) ± 0,5 | Te medida (°C) ± 0,5 | Te teórica (°C) |
filas: 2

## Cálculos
- Calor absorbido por el agua fría :: Q1 = m1 · c · (Te − T1) :: J :: Usá c = 4180 J/kg·°C y pasá las masas a kilogramos.
- Calor cedido por el agua caliente :: Q2 = m2 · c · (T2 − Te) :: J :: Tiene que dar parecido a Q1, con signo contrario.
- Temperatura de equilibrio teórica :: Te = (m1·T1 + m2·T2) / (m1 + m2) :: °C :: Vale porque las dos porciones son de agua y comparten el calor específico.
- Pérdida de energía :: Q2 − Q1 :: J :: Es la energía que se fue al aire y al propio calorímetro.

## Preguntas
- ¿Qué tan cerca estuvo la temperatura de equilibrio medida de la calculada? ¿Quedó por encima o por debajo? ¿Por qué?
- ¿Coincidieron el calor cedido y el absorbido? ¿A dónde se fue la diferencia?
- Si hubieras usado el doble de agua fría con la misma agua caliente, ¿la temperatura final habría sido mayor o menor? Comprobalo con la fórmula.
- ¿Por qué conviene un vaso de telgopor y no uno de vidrio o de metal?
- El agua tiene un calor específico alto. ¿Qué consecuencia tiene eso en el clima de una ciudad costera como Montevideo?

## Conclusiones
líneas: 8
Guía: ¿Se cumplió el balance de energía dentro de la incertidumbre de tus medidas? ¿Qué porcentaje de la energía se perdió? ¿Cómo mejorarías el calorímetro?`
},

{
  id: 'pendulo',
  nombre: 'Péndulo simple: de qué depende el período',
  area: 'Física',
  nivel: '4° año',
  resumen: 'Se varían longitud, masa y amplitud por separado para descubrir cuál de las tres cambia el período.',
  texto: `# Protocolo: El péndulo simple — de qué depende su período
# Asignatura: Física
# Nivel: 4° año
# Duración: 90 minutos

## Fundamento
Un péndulo simple es una masa colgada de un hilo inextensible que oscila por efecto de la gravedad. El período T es el tiempo que tarda en dar una oscilación completa: ir y volver al mismo punto moviéndose en el mismo sentido.

La intuición dice que el período debería depender de la masa que cuelga, del largo del hilo y de cuánto se lo separa de la vertical. Galileo mostró que, para amplitudes chicas, sólo importa el largo: T = 2π · √(L/g). Ni la masa ni la amplitud cambian el período mientras el ángulo no pase de unos 15°.

Para poner esto a prueba hay que variar una sola cosa por vez y dejar las demás fijas: es lo que se llama controlar las variables. Además, como el error humano al apretar el cronómetro es de unas dos décimas de segundo, conviene cronometrar 10 oscilaciones seguidas y dividir entre 10: así el error se reparte y el período sale mucho más preciso.

## Objetivos
- Determinar de cuáles de las tres variables (longitud, masa y amplitud) depende el período de un péndulo.
- Aplicar la técnica de controlar variables en un diseño experimental.
- Estimar el valor de la aceleración de la gravedad a partir de los datos.

## Materiales
- 1 soporte universal con varilla y nuez
- hilo de coser o tanza :: alrededor de 1,5 m
- 3 masas distintas :: tuercas, arandelas o pesas de 20, 50 y 100 g
- 1 cinta métrica o regla de 1 m
- 1 hoja de papel milimetrado

## Instrumentos
- cronometro :: lectura=14.32, resolucion=0.01 :: para medir 10 oscilaciones
- regla :: orientacion=vertical, max=100, division=0.1, numerarCada=10, unidad=cm, lectura=60 :: para medir la longitud del péndulo
- transportador :: max=180, division=1, numerarCada=10, lectura=15 :: para controlar la amplitud inicial

## Seguridad
- Fijá bien el soporte a la mesa: un péndulo largo lo puede voltear.
- Despejá la zona de oscilación, sobre todo si la masa es pesada.

## Montaje
Colgá el hilo de la varilla horizontal del soporte, lo más alto posible, y atá la masa en el extremo. La longitud L del péndulo se mide desde el punto de suspensión hasta el centro de la masa, no hasta el nudo. Poné el transportador junto al punto de suspensión para controlar el ángulo de partida. El péndulo tiene que oscilar en un solo plano: si empieza a girar en círculos, pará y volvé a soltarlo.

## Procedimiento
1. Armar el péndulo :: Colgá la masa mediana con un hilo de 80 cm y medí la longitud L desde la suspensión hasta el centro de la masa.
2. Practicar la medición :: Separá el péndulo 15° y soltalo sin empujar. Practicá contar oscilaciones completas hasta que te salga parejo.
3. Medir el período :: Cronometrá 10 oscilaciones completas y anotá el tiempo total. Repetí tres veces la misma medida.
4. Variar la longitud :: Repetí el paso 3 con longitudes de 20, 40, 60, 80 y 100 cm, manteniendo siempre la misma masa y los mismos 15°.
5. Variar la masa :: Volvé a 80 cm y 15°, y medí el período con las tres masas distintas.
6. Variar la amplitud :: Con la masa mediana y 80 cm, medí el período soltando desde 5°, 10°, 15° y 30°.
7. Promediar :: Para cada configuración, promediá las tres corridas y dividí entre 10 para obtener el período.
8. Graficar :: Dibujá T en función de L y, además, T² en función de L. Fijate cuál de las dos gráficas da una recta.

## Tablas
### Variando la longitud (masa y amplitud fijas)
| L (cm) ± 0,1 | t de 10 oscilaciones (s) ± 0,2 | T = t/10 (s) | T² (s²) |
filas: 5

### Variando la masa (L y amplitud fijas)
| Masa (g) | t de 10 oscilaciones (s) ± 0,2 | T = t/10 (s) |
filas: 3

### Variando la amplitud (L y masa fijas)
| Ángulo inicial (°) | t de 10 oscilaciones (s) ± 0,2 | T = t/10 (s) |
filas: 4

## Cálculos
- Período :: T = t / 10 :: s :: Dividí entre 10 el tiempo de las diez oscilaciones. El error también se divide entre 10.
- Cuadrado del período :: T² :: s² :: Se calcula para poder linealizar la relación con la longitud.
- Gravedad :: g = 4π² / pendiente :: m/s² :: La gráfica T² en función de L (en metros) da una recta de pendiente 4π²/g. Despejá g y compará con 9,8 m/s².

## Preguntas
- ¿Cuál de las tres variables cambió el período? ¿Cuáles no lo cambiaron?
- ¿Por qué la gráfica de T contra L no da una recta y la de T² contra L sí?
- ¿Por qué se miden 10 oscilaciones en vez de una sola? Estimá cuánto mejora la precisión.
- Con 30° de amplitud, ¿el período se mantuvo igual que con 5°? ¿Qué te dice eso sobre el límite de validez de la fórmula?
- ¿Qué valor de g obtuviste? ¿Cuánto se aparta del valor aceptado y a qué lo atribuís?

## Conclusiones
líneas: 8
Guía: Escribí de qué depende y de qué no depende el período de un péndulo, según tus propios datos. ¿Qué valor de g obtuviste? ¿Qué parte del procedimiento aportó más incertidumbre?`
},

{
  id: 'titulacion',
  nombre: 'Titulación ácido-base con bureta',
  area: 'Química',
  nivel: '5° / 6° año',
  resumen: 'Neutralización con indicador, lectura de bureta y cálculo de la concentración desconocida.',
  texto: `# Protocolo: Titulación ácido-base — concentración de un ácido
# Asignatura: Química
# Nivel: 5° año
# Duración: 90 minutos

## Fundamento
Una titulación o valoración permite averiguar la concentración desconocida de una solución haciéndola reaccionar con otra de concentración conocida, llamada patrón. En una titulación ácido-base se va agregando la base gota a gota sobre el ácido hasta que se neutralizan exactamente: en ese punto, la cantidad de moles de H⁺ aportados por el ácido iguala a la de OH⁻ aportados por la base.

Ese momento se llama punto de equivalencia, y se detecta con un indicador: una sustancia que cambia de color según el pH. La fenolftaleína es incolora en medio ácido y rosada en medio básico, así que la primera gota que deja el líquido rosado —y el color persiste al agitar— marca el final de la titulación.

Del volumen gastado se despeja la concentración con la relación Ca · Va = Cb · Vb, válida cuando el ácido y la base son monopróticos. La bureta es el instrumento clave: aprecia 0,1 mL y se lee al revés que una probeta, porque su cero está arriba y el número que marca el menisco es el volumen ya descargado.

## Objetivos
- Determinar la concentración de una solución de ácido clorhídrico por titulación.
- Manejar correctamente la bureta y reconocer el punto final por el viraje del indicador.
- Evaluar la reproducibilidad de la técnica repitiendo la titulación.

## Materiales
- solución de NaOH de concentración conocida :: 0,100 mol/L, unos 100 mL
- solución de HCl de concentración desconocida :: unos 60 mL
- fenolftaleína :: solución alcohólica, en gotero
- 3 matraces Erlenmeyer de 125 mL
- 1 soporte universal con pinza para bureta
- 1 embudo chico
- agua destilada en piseta
- 1 hoja blanca :: se pone debajo del Erlenmeyer para ver mejor el color

## Instrumentos
- bureta :: max=50, division=0.1, numerarCada=5, unidad=mL, lectura=18.7 :: para agregar la base gota a gota
- jeringa :: max=10, division=0.2, numerarCada=2, unidad=mL, lectura=10 :: para tomar la alícuota de ácido, si no hay pipeta aforada
- sensorDigital :: magnitud=pH, lectura=7.02, decimales=2 :: opcional, para seguir el pH durante el agregado

## Seguridad
- Usá guantes y anteojos de seguridad: el hidróxido de sodio es corrosivo y ataca la piel y los ojos.
- Si te salpicás, lavá con agua abundante durante varios minutos y avisá al docente.
- Cargá la bureta con el embudo y con la bureta a la altura de tus ojos, nunca por encima de tu cara.
- No pipetees con la boca: usá propipeta.

## Montaje
Sujetá la bureta al soporte con la pinza, bien vertical, con la llave a la altura de tu mano y la punta a unos 5 cm por encima de la boca del Erlenmeyer. Poné una hoja blanca debajo del Erlenmeyer para ver con claridad el viraje. La bureta se carga con la solución de NaOH usando el embudo, se purga la punta abriendo la llave un instante para sacar el aire y recién ahí se enrasa en el cero.

## Procedimiento
1. Preparar la bureta :: Enjuagala con un poco de la solución de NaOH, cargala con el embudo, purgá la punta y llevá el nivel al cero. Anotá el volumen inicial exacto.
2. Preparar la muestra :: Con la pipeta, pasá 10,0 mL de la solución de HCl a un Erlenmeyer limpio.
3. Agregar el indicador :: Poné 2 o 3 gotas de fenolftaleína y agitá. La solución tiene que quedar incolora.
4. Titular rápido la primera vez :: Abrí la llave y dejá caer la base agitando el Erlenmeyer con movimientos circulares. Cuando aparezcan destellos rosados que tardan en desaparecer, andá más despacio.
5. Buscar el punto final :: Seguí gota a gota hasta que un rosa pálido persista al menos 30 segundos al agitar. Ahí cerrá la llave.
6. Leer la bureta :: Esperá 15 segundos a que escurran las paredes y leé el menisco a la altura de los ojos. Anotá el volumen final.
7. Repetir dos veces más :: Repetí toda la titulación con alícuotas nuevas de ácido. Los tres volúmenes gastados no deberían diferir en más de 0,2 mL.
8. Promediar y calcular :: Promediá los volúmenes gastados y calculá la concentración del ácido.

## Tablas
### Volúmenes de la titulación
| Titulación | V inicial bureta (mL) ± 0,05 | V final bureta (mL) ± 0,05 | V gastado (mL) | V alícuota HCl (mL) |
filas: 3

## Cálculos
- Volumen gastado :: Vb = V final − V inicial :: mL :: Restá las dos lecturas de la bureta en cada titulación.
- Volumen promedio :: Vb promedio :: mL :: Promediá las tres corridas. Descartá la primera si fue la de tanteo.
- Concentración del ácido :: Ca = (Cb · Vb) / Va :: mol/L :: Con Cb = 0,100 mol/L y Va = 10,0 mL. Vale porque HCl y NaOH son monopróticos.
- Masa de HCl por litro :: m = Ca · 36,5 :: g/L :: Multiplicá la concentración molar por la masa molar del HCl.

## Preguntas
- ¿Cuánto difirieron entre sí tus tres volúmenes gastados? ¿Qué te dice eso sobre la reproducibilidad de la técnica?
- ¿Qué pasa si te pasás de una gota en el punto final? ¿La concentración calculada sale mayor o menor que la real?
- ¿Por qué no importa si al Erlenmeyer le queda un poco de agua destilada, pero sí importa que la bureta esté enjuagada con la solución de NaOH?
- ¿Por qué se usa fenolftaleína y no cualquier otro indicador? ¿Qué habría pasado con un ácido débil?
- Si el NaOH hubiera estado más diluido de lo que dice la etiqueta, ¿en qué sentido se equivocaría tu resultado?

## Conclusiones
líneas: 8
Guía: Informá la concentración del ácido con su incertidumbre y con las cifras significativas que corresponden. ¿Qué paso del procedimiento aporta más error? ¿Qué harías distinto para mejorar la exactitud?`
}

];

export function ejemploPorId(id) {
  for (let i = 0; i < EJEMPLOS.length; i++) if (EJEMPLOS[i].id === id) return EJEMPLOS[i];
  return null;
}
