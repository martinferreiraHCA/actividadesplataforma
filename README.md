# Generador de Actividades Educativas — HCA

Aplicación web estática que permite a docentes crear cuestionarios y actividades, y descargar los archivos listos para importar en **Schoology**, **Moodle** y **Google Classroom**.

Funciona 100% en el navegador, sin backend, sin instalación.

## ¿Cómo se usa?

### Los 3 pasos

1. **Elegí el tipo de actividad** en la landing page.
2. **Generá un prompt** con los parámetros de tu evaluación (tema, nivel, cantidad, tipos de pregunta). Copiá ese prompt y pegalo en ChatGPT, Claude, Gemini o la IA que uses.
3. **Pegá la respuesta de la IA** en el editor, revisá las preguntas, sumá imágenes si querés, y **descargá** el archivo en el formato que necesites.

### Formatos de descarga

| Formato | Destino | Extensión |
|---------|---------|-----------|
| Common Cartridge + QTI 1.2 | Schoology, Moodle | `.imscc` |
| GIFT | Moodle | `.gift.txt` |
| Moodle XML | Moodle | `.xml` |
| Apps Script | Google Classroom (via Google Forms) | `.gs` |
| JSON | Borrador para reeditar | `.json` |

## Formato estándar de preguntas

El formato que usa la app como intermediario entre la IA y el generador:

```markdown
# Cuestionario: Título
# Nivel: 9° EBI

## P1 :: opcion_multiple :: 1pt
¿Texto de la pregunta?
- [ ] Opción incorrecta
- [x] Opción correcta
- [ ] Otra incorrecta
- [ ] Otra incorrecta
> Retro: Retroalimentación opcional.

## P2 :: verdadero_falso :: 1pt
Afirmación.
**Respuesta:** Verdadero
> Retro: Explicación.

## P3 :: respuesta_corta :: 1pt
¿Pregunta?
**Respuestas aceptadas:** Respuesta 1 | Respuesta 2

## P4 :: numerica :: 1pt
¿Problema numérico?
**Respuesta:** 42 ± 0.5

## P5 :: emparejamiento :: 2pt
Asociá:
- Elemento A = Par A
- Elemento B = Par B

## P6 :: ensayo
Pregunta abierta.
```

### Tipos soportados

- `opcion_multiple` — una o varias correctas
- `verdadero_falso`
- `respuesta_corta`
- `numerica` (con tolerancia)
- `emparejamiento`
- `ensayo` (corrección manual)

## Cómo importar

### Schoology
1. Entrá a tu curso → **Add Materials** → **Import from File**.
2. Subí el archivo `.imscc`.
3. Las preguntas aparecen como un Assessment listo para asignar.

### Moodle
**Opción A (Common Cartridge):**
1. Administración del curso → **Restaurar** → subí el `.imscc`.

**Opción B (Moodle XML — recomendado):**
1. Banco de preguntas → **Importar** → formato **Moodle XML** → subí el `.xml`.

**Opción C (GIFT):**
1. Banco de preguntas → **Importar** → formato **GIFT** → subí el `.gift.txt`.

### Google Classroom
1. Descargá el archivo `.gs` (Apps Script).
2. Andá a [script.google.com](https://script.google.com), creá un proyecto nuevo.
3. Pegá el script, ejecutá la función `crearQuiz`.
4. El Google Form aparece en tu Drive — adjuntalo a tu clase.

## Diseño → Protocolos de práctico

`protocolos.html` arma el documento completo de una práctica de laboratorio y lo deja listo para
imprimir: **fundamento teórico, objetivos, materiales, sustancias y reactivos, normas de seguridad,
montaje experimental, procedimiento paso a paso, tablas de datos en blanco, cálculos, preguntas de
análisis, conclusiones y notas para el docente**. Cubre física y química de **7° a 3° de EMS**.

- **Dos versiones** del mismo protocolo: la del **estudiante** (espacios en blanco, cabezal para el
  equipo y los instrumentos sin el número de la lectura) y la del **docente** (todo a la vista, más
  cómo se lee cada instrumento).
- **Fórmulas en LaTeX** en el fundamento, el montaje, las preguntas y los cálculos: lo que va entre
  signos de peso se dibuja como matemática de verdad.
- **La escena de cada paso**: se marca qué instrumentos y qué frascos entran en juego y se dibujan
  al lado del paso, para que se vea cómo queda la mesada en ese momento.
- **Sustancias y reactivos** con su etiqueta —nombre, fórmula, concentración, cantidad— y el
  pictograma de peligro.
- **Notas para el docente** que salen sólo en su versión: qué preparar antes, en qué se traban los
  estudiantes, cómo adaptar la práctica si falta material, tiempos y qué mirar al corregir.
- **Nueve prácticos de ejemplo** completos: separación de mezclas (7°), evidencias de reacción
  química (9°), densidad de sólidos, ley de Hooke, ley de Ohm, calor específico, péndulo simple,
  velocidad de reacción (2° EMS) y titulación ácido-base.
- Se puede arrancar de una plantilla, del **prompt para IA** que arma la página, de **texto plano** o
  de un **.json** guardado. Salidas: PDF, JSON y texto.

### Fórmulas

Se escriben en LaTeX y las dibuja [KaTeX](https://katex.org) (MIT), vendorizado con sus fuentes
embebidas en base64 dentro de `katex.min.css`: la página no descarga nada y las fórmulas salen
igual en pantalla, al imprimir y en el PDF.

```markdown
Se calcula como $d = \frac{m}{V}$, donde…      ← en el medio del renglón

$$T = 2\pi\sqrt{\frac{L}{g}}$$                 ← centrada, en su propio bloque
```

El editor trae una barra con los símbolos que más se usan (fracción, raíz, Δ, π, ρ, Ω, vectores,
notación científica…) y ocho fórmulas de ejemplo listas para insertar. Si el LaTeX está mal escrito
se ve el código en rojo, no un hueco en blanco.

### Formato de texto de un protocolo

```markdown
# Protocolo: Determinación de la densidad de sólidos irregulares
# Asignatura: Física
# Nivel: 3° de Ciclo Básico
# Duración: 90 minutos

## Fundamento
La densidad es una propiedad característica de cada material…

## Objetivos
- Determinar experimentalmente la densidad de tres sólidos irregulares.

## Materiales
- 1 probeta de 100 mL
- 3 cuerpos sólidos irregulares :: que entren por la boca de la probeta

## Instrumentos
- probeta :: max=100, division=1, unidad=mL, lectura=64 :: para medir el volumen
- balanzaDigital :: max=500, division=0.1, unidad=g, lectura=126.4 :: para la masa

## Sustancias
- frasco :: nombre=Agua destilada, formula=H2O, cantidad=500 mL, color=#cfe6f5

## Seguridad
- Secá enseguida el agua que se derrame en la mesada.

## Montaje
Sobre la mesada, de izquierda a derecha: la balanza, la probeta y el vaso con agua…

## Procedimiento
1. Medir la masa :: Apoyá el cuerpo en el plato y esperá a que se estabilice. :: escena: i2
2. Cargar la probeta :: Llenala hasta 50 mL. :: escena: i1 s1 :: nota: apoyada, nunca en la mano.

## Tablas
### Masa y volumen de cada cuerpo
| Cuerpo | m (g) ± 0,1 | V (mL) ± 0,5 |
filas: 3

## Cálculos
- Densidad :: $d = \dfrac{m}{V}$ :: g/mL :: Dividí la masa entre el volumen.

## Preguntas
- ¿Los tres cuerpos tienen la misma densidad?

## Conclusiones
líneas: 8
Guía: ¿Qué medida aportó más incertidumbre al resultado?

## Notas para el docente
- Sólo salen en la versión del docente, nunca en la hoja del estudiante.
- Tiempos, qué preparar antes, en qué se traban y qué mirar al corregir.
```

Secciones reconocidas: `Fundamento`, `Objetivos`, `Materiales`, `Instrumentos`, `Sustancias`,
`Seguridad`, `Montaje`, `Procedimiento`, `Tablas`, `Cálculos`, `Preguntas`, `Conclusiones` y
`Notas para el docente` (con sus sinónimos habituales, con o sin tildes).

La **referencia completa del formato** —cada sección con su sintaxis exacta, todos los
identificadores de instrumento y todos sus parámetros— está dentro de la propia página: botón
«📖 Referencia del formato», que además se copia al portapapeles para pegarla en una IA. En el
código vive en `REFERENCIA_FORMATO`, dentro de `protocolos-texto.js`, y es la misma que se
incrusta en el prompt.

Dos detalles del formato que conviene tener presentes:

- Los parámetros de un instrumento se separan con comas, pero **un valor puede tener comas
  adentro**: el trozo que no trae `=` se pega al valor anterior. Por eso
  `concentracion=0,1 mol/L` y `rotulos=agua, HCl, control` funcionan.
- En el procedimiento, `escena: i1 s2` dice qué se dibuja al lado del paso: `i1` es el primer
  instrumento de la lista y `s2` la segunda sustancia.

## Diseño → Banco de instrumentos

`instrumentos.html` dibuja **33 instrumentos científicos en SVG**, parametrizables en alcance,
menor división, numeración, unidad, lectura y tamaño:

| Magnitud | Instrumentos |
|----------|--------------|
| Longitud y ángulo | regla, calibre con nonio (0,1 · 0,05 · 0,02 mm), micrómetro, transportador |
| Volumen | probeta, bureta, pipeta con propipeta, jeringa, vaso / Erlenmeyer / matraz aforado |
| Masa | balanza digital, balanza de tres brazos |
| Temperatura | termómetro, calorímetro |
| Fuerza | dinamómetro, plano inclinado, sistema de poleas |
| Tiempo | cronómetro |
| Electricidad | multímetro digital, instrumento de aguja, fuente regulable, circuito esquemático |
| Óptica | banco óptico con trazado de rayos |
| Electrónica | micro:bit con sensores conectables a los pines |
| Química | frasco con sustancia, mechero Bunsen, soporte universal armado, gradilla con tubos, filtración, destilación, agitador magnético, papel de pH |
| Sensores | Vernier Go Direct (30 modelos), sensor digital genérico (pH, lux, dB…) |

Cada instrumento se resume en una línea de texto que entiende el generador de protocolos:

```
probeta :: max=250, division=2, numerarCada=50, unidad=mL, lectura=150
calibre :: nonio=50, lectura=23.42
aguja :: simbolo=A, max=0.5, division=0.01, unidad=A, lectura=0.06
multimetro :: funcion=Vcc20, lectura=9.06
microbit :: pin0=ultrasonido, magnitud=Distancia, unidad=cm, lectura=34
goDirect :: modelo=pressure, lectura=101.3
frasco :: nombre=Ácido clorhídrico, formula=HCl, concentracion=0,1 mol/L, peligro=corrosivo
gradilla :: cantidad=4, rotulos=agua, HCl, NaOH, control, burbujas=2
circuito :: componente=lampara, conexion=serie, llave=cerrada, valorFuente=6 V
bancoOptico :: lente=convergente, focal=10, distanciaObjeto=25
```

### La línea de medición

Los instrumentos salen **sin** la línea roja que señala dónde leer: encontrar la medida en la
escala es parte del trabajo del estudiante. Se agrega cuando hace falta y se calibra a gusto —
puede apuntar a un punto distinto del que marca el instrumento, llevar su propio rótulo y correrse
unos milímetros para calzar exacta:

```
probeta :: max=100, division=1, unidad=mL, lectura=64, marcarLectura=si, marcaEn=30, marcaTexto=nivel inicial
```

### El multímetro

La llave selectora tiene las **26 posiciones** de un multímetro de laboratorio, y de ahí salen
solas la unidad, los decimales y el borne por el que entra la punta roja:

| Grupo | Posiciones |
|-------|------------|
| V⎓ | `Vcc200m` `Vcc2` `Vcc20` `Vcc200` `Vcc600` |
| V∼ | `Vca200` `Vca600` |
| A⎓ | `Acc200u` `Acc2m` `Acc20m` `Acc200m` `Acc10` |
| A∼ | `Aca200m` |
| Ω | `ohm200` `ohm2k` `ohm20k` `ohm200k` `ohm2M` |
| Pruebas | `cont` (continuidad) `diodo` `hfe` |
| Otras | `cap` `capu` `frec` `temp` — y `off` |

La página también genera **hojas de ejercicios de lectura de escalas**: cada instrumento sale con
una lectura al azar y sin el número, con renglones para la medida y su incertidumbre, y con la clave
de corrección aparte.

## Diseño → Escaneo 3D con Kinect

`escaneo3d.html` convierte un **Kinect de Xbox 360** (v1: modelos 1414, 1473 y Kinect for Windows v1) en un
escáner 3D de piezas, directo desde el navegador y sin instalar programas: la página habla con el sensor por
**WebUSB** con el mismo protocolo que libfreenect (`kinect-usb.js`), muestra la profundidad en vivo con la caja
de escaneo dibujada encima, y con las tomas que se hacen girando la pieza sobre una base arma un modelo
purgado listo para la impresora 3D.

- **Plug and play**: una vez que se le dio permiso, el Kinect se conecta solo al enchufarlo. Si la conexión
  falla, la página muestra la **guía para instalar el driver** del sistema en uso (Zadig + WinUSB en Windows;
  `gspca_kinect` en lista negra y regla udev en Linux; nada en macOS y ChromeOS).
- **Encuadre**: detección de la mesa (RANSAC de un plano), caja de escaneo, eje de giro y círculo de la base
  proyectados sobre la imagen; corte a la altura de la base giratoria.
- **Tomas**: cada toma promedia varios cuadros (mediana píxel a píxel) y se guarda con su ángulo; se pueden
  guardar y cargar en `.json` para generar el modelo en otra computadora.
- **Fusión y purgado** (`escaneo3d-nucleo.js`, sin dependencias): filtros de mediana, huecos y puntos
  voladores; fusión volumétrica (TSDF) de las tomas giradas o mapa de alturas para un relieve de una sola
  toma; **afinado automático del eje y del sentido de giro** comparando las tomas; extracción con surface
  nets; conservar sólo la pieza más grande, suavizado de Taubin, reducción de triángulos, base plana cerrada.
- **Asistente guiado**: chequeo en vivo de la escena (inclinación, mesa, distancia, tamaño, encaje en la
  caja, centrado, huecos) con el consejo para cada problema; rosa de ángulos con el plan de tomas y la
  instrucción de a qué marca girar; puntaje y consejo por toma con repetición individual; e informe del
  modelo con el porcentaje de superficie vista, el lado que quedó rellenado a ciegas y qué mejorar.
- **Salidas**: STL binario, OBJ y nube de puntos PLY, con Z hacia arriba y en milímetros.
- **Puente local** (`kinect-puente.py`): cuando el navegador puede abrir el Kinect pero no leer el
  flujo isócrono (Chrome en Windows), un programa en Python lee el sensor con libusb, sobre el mismo
  driver WinUSB, y le manda los cuadros a la página por WebSocket en localhost. `pip install libusb
  websockets` y `python kinect-puente.py`; `--demo` para probar sin Kinect.
- **Modo de demostración** con una pieza sintética (con el ruido del sensor) para practicar sin Kinect.

## Tecnología

- HTML + CSS + Vanilla JS (ES modules)
- Sin backend, sin build step
- JSZip y KaTeX vendorizados localmente (KaTeX, con sus fuentes en base64)
- Los instrumentos son SVG generado a mano: sin librerías de dibujo
- Hosteable en GitHub Pages

## Estructura

```
/index.html          ← Landing con menú de actividades
/editor.html         ← Editor de 3 pasos
/css/                ← tokens.css, base.css, components.css
/js/                 ← Módulos: app, activities, parser, preview, images, prompt-generator
/js/export/          ← qti12, commoncartridge, gift, moodlexml, appsscript, json
/vendor/             ← jszip.min.js
/ejemplos/           ← Ejemplo de cuestionario en formato estándar

Sección Diseño:
/protocolos.html          ← Generador de protocolos de práctico
/protocolos.js            ← Editor, documento imprimible y exportaciones
/protocolos-texto.js      ← Formato de texto (parser + serializador) y prompt para IA
/protocolos-ejemplos.js   ← Seis prácticos completos de muestra
/mate.js                  ← Fórmulas en LaTeX dentro de los textos
/katex.min.js /.css       ← KaTeX vendorizado, con las fuentes embebidas
/instrumentos.html        ← Banco de instrumentos
/instrumentos.js          ← Motor de dibujo SVG de los 33 instrumentos
/instrumentos-ui.js       ← Catálogo, configurador y hojas de ejercicios
/papel3d.html             ← Diseño 3D con papel (papercraft)
/escaneo3d.html           ← Escaneo 3D con Kinect
/escaneo3d.js             ← Página: conexión, vista en vivo, tomas, modelo
/escaneo3d-nucleo.js      ← Fusión volumétrica, malla, purgado y exportación (sin DOM)
/kinect-usb.js            ← Driver WebUSB del Kinect v1 y guías de instalación
/kinect-puente.py         ← Puente local Kinect → navegador (libusb + WebSocket)
```
