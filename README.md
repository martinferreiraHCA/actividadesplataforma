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

## Tecnología

- HTML + CSS + Vanilla JS (ES modules)
- Sin backend, sin build step
- JSZip vendorizado localmente
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
```
