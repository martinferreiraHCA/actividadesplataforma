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
imprimir: **fundamento teórico, objetivos, materiales, normas de seguridad, montaje experimental,
procedimiento paso a paso, tablas de datos en blanco, cálculos, preguntas de análisis y conclusiones**.

- **Dos versiones** del mismo protocolo: la del **estudiante** (espacios en blanco, cabezal para el
  equipo y los instrumentos sin el número de la lectura) y la del **docente** (todo a la vista, más
  cómo se lee cada instrumento).
- **Seis prácticos de ejemplo** completos: densidad de sólidos, ley de Hooke, ley de Ohm, calor
  específico, péndulo simple y titulación ácido-base.
- Se puede arrancar de una plantilla, del **prompt para IA** que arma la página, de **texto plano** o
  de un **.json** guardado. Salidas: PDF, JSON y texto.

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

## Seguridad
- Secá enseguida el agua que se derrame en la mesada.

## Montaje
Sobre la mesada, de izquierda a derecha: la balanza, la probeta y el vaso con agua…

## Procedimiento
1. Medir la masa :: Apoyá el cuerpo en el plato y esperá a que el número se estabilice.

## Tablas
### Masa y volumen de cada cuerpo
| Cuerpo | m (g) ± 0,1 | V (mL) ± 0,5 |
filas: 3

## Cálculos
- Densidad :: d = m / V :: g/mL :: Dividí la masa entre el volumen.

## Preguntas
- ¿Los tres cuerpos tienen la misma densidad?

## Conclusiones
líneas: 8
Guía: ¿Qué medida aportó más incertidumbre al resultado?
```

Secciones reconocidas: `Fundamento`, `Objetivos`, `Materiales`, `Instrumentos`, `Seguridad`,
`Montaje`, `Procedimiento`, `Tablas`, `Cálculos`, `Preguntas`, `Conclusiones` (con sus sinónimos
habituales, con o sin tildes).

## Diseño → Banco de instrumentos

`instrumentos.html` dibuja **16 instrumentos científicos en SVG**, parametrizables en alcance,
menor división, numeración, unidad, lectura y tamaño:

| Magnitud | Instrumentos |
|----------|--------------|
| Longitud | regla, calibre con nonio (0,1 · 0,05 · 0,02 mm), micrómetro |
| Volumen | probeta, bureta, jeringa, vaso / Erlenmeyer / matraz aforado |
| Masa | balanza digital, balanza de tres brazos |
| Temperatura | termómetro |
| Fuerza | dinamómetro |
| Tiempo | cronómetro |
| Electricidad | multímetro digital, instrumento de aguja (voltímetro, amperímetro, manómetro) |
| Ángulo | transportador |
| Otros | sensor digital genérico (pH, lux, dB…) |

Cada instrumento se resume en una línea de texto que entiende el generador de protocolos:

```
probeta :: max=250, division=2, numerarCada=50, unidad=mL, lectura=150
calibre :: nonio=50, lectura=23.42
aguja :: simbolo=A, max=0.5, division=0.01, unidad=A, lectura=0.06
```

La página también genera **hojas de ejercicios de lectura de escalas**: cada instrumento sale con
una lectura al azar y sin el número, con renglones para la medida y su incertidumbre, y con la clave
de corrección aparte.

## Tecnología

- HTML + CSS + Vanilla JS (ES modules)
- Sin backend, sin build step
- JSZip vendorizado localmente
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
/instrumentos.html        ← Banco de instrumentos
/instrumentos.js          ← Motor de dibujo SVG de los 16 instrumentos
/instrumentos-ui.js       ← Catálogo, configurador y hojas de ejercicios
/papel3d.html             ← Diseño 3D con papel (papercraft)
```
