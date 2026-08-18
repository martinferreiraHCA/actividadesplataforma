// Guía de uso centralizada — modal accesible desde cualquier página.
// Se carga como script normal (no módulo) y se autoinicializa.
// Cualquier botón con [data-abrir-guia] abre la guía; opcional data-abrir-guia="formatos"
// para arrancar en una sección puntual.
(function () {
  "use strict";

  const SECCIONES = [
    {
      id: "inicio",
      titulo: "Empezar",
      html: `
        <p class="guia-p">Esta herramienta te ayuda con dos grandes tareas docentes, todo en tu navegador
        (no se instala nada y tus datos no salen de tu compu):</p>
        <ul class="guia-lista">
          <li><strong>Editor</strong> — cuestionarios (9 tipos de pregunta) y rúbricas, exportables a
          <strong>CREA de Ceibal, Schoology, Moodle y Google Classroom</strong>.</li>
          <li><strong>Fichas Scratch · micro:bit</strong> — fichas de trabajo y guías paso a paso de programación,
          con bloques dibujados desde texto, simuladores para ver el resultado en el escenario, y descarga en
          PDF, Word o como cuestionario para CREA.</li>
        </ul>

        <h4 class="guia-h">Los 3 pasos (en cualquiera de las dos)</h4>
        <ol class="guia-pasos">
          <li><strong>Elegí qué crear</strong> desde la página de inicio: un tipo de cuestionario, una rúbrica, o fichas de programación.</li>
          <li><strong>Cargá el contenido</strong> de una de estas tres formas: a mano con el editor visual, pegando texto, o con ayuda de una IA.</li>
          <li><strong>Descargá</strong> en el formato de tu plataforma y subilo.</li>
        </ol>

        <div class="guia-aviso">Consejo: empezá por el <strong>Editor Visual</strong>. Es el modo más simple y no necesitás aprender ningún formato.</div>
      `
    },
    {
      id: "modos",
      titulo: "Formas de crear",
      html: `
        <p class="guia-p">Hay tres maneras de cargar preguntas. Podés combinarlas: lo que importás
        por texto o IA cae igual en el editor visual para que lo revises antes de descargar.</p>

        <h4 class="guia-h">1. Editor Visual <span class="guia-tag">Recomendado</span></h4>
        <p class="guia-p">Agregás preguntas con los botones de arriba ("+ Opción Múltiple", "+ V/F", etc.)
        y completás cada campo. Podés <strong>reordenar</strong> con el botón "Ordenar", duplicar, mover y
        agregar una imagen por pregunta. Ideal si recién empezás.</p>

        <h4 class="guia-h">2. Importar Texto</h4>
        <p class="guia-p">Si ya tenés las preguntas escritas, pegalas en formato <strong>Aiken</strong> o
        <strong>extendido</strong>. La app detecta cuál usaste y las carga solas. Mirá la pestaña
        <em>Formatos</em> acá al lado para ver ejemplos.</p>

        <h4 class="guia-h">3. Asistente IA <span class="guia-tag guia-tag--ghost">Opcional</span></h4>
        <p class="guia-p">Completás un formulario y la app te arma un <strong>prompt</strong>. Lo copiás a
        ChatGPT, Claude o Gemini, traés la respuesta de vuelta, y se convierte en preguntas editables.</p>
        <div class="ia-accesos">
          <span class="ia-accesos__label">Abrí tu IA:</span>
          <a class="ia-acceso" href="https://chat.openai.com/" target="_blank" rel="noopener">ChatGPT ↗</a>
          <a class="ia-acceso" href="https://claude.ai/new" target="_blank" rel="noopener">Claude ↗</a>
          <a class="ia-acceso" href="https://gemini.google.com/app" target="_blank" rel="noopener">Gemini ↗</a>
        </div>
      `
    },
    {
      id: "tipos",
      titulo: "Tipos de pregunta",
      html: `
        <p class="guia-p">Un cuestionario puede mezclar estos nueve tipos:</p>
        <ul class="guia-lista">
          <li><strong>Opción múltiple</strong> — varias opciones, una correcta.</li>
          <li><strong>Verdadero / Falso</strong> — afirmación que se marca V o F.</li>
          <li><strong>Respuesta corta</strong> — el alumno escribe; aceptás varias respuestas válidas separadas con <code>|</code>.</li>
          <li><strong>Numérica</strong> — respuesta con número y tolerancia (± un margen).</li>
          <li><strong>Emparejamiento</strong> — unir elementos de dos columnas.</li>
          <li><strong>Ordenamiento</strong> — el alumno arrastra los elementos hasta la secuencia correcta.</li>
          <li><strong>Completar huecos</strong> — arrastra palabras de un banco a los espacios del texto.</li>
          <li><strong>Selección inline</strong> — desplegables dentro del texto.</li>
          <li><strong>Ensayo</strong> — desarrollo libre, se corrige a mano.</li>
        </ul>

        <h4 class="guia-h">Imágenes</h4>
        <p class="guia-p">Desde el editor visual, cada pregunta tiene un botón
        <strong>"+ Agregar imagen"</strong> para subir una figura. Las imágenes viajan dentro del
        archivo <code>.imscc</code>, así que se ven en Schoology y Moodle sin pasos extra.</p>

        <h4 class="guia-h">Rúbricas</h4>
        <p class="guia-p">Desde la página de inicio también podés crear <strong>rúbricas</strong> (tabla de
        criterios y niveles de desempeño): editor visual, importación por texto, asistente IA, y salida en
        varios formatos — copiar como texto para pegar en tu plataforma, HTML para imprimir, CSV para
        planillas, Moodle y más.</p>
      `
    },
    {
      id: "formatos",
      titulo: "Formatos de texto",
      html: `
        <p class="guia-p">Si vas a usar "Importar Texto", estos son los dos formatos que la app entiende.</p>

        <h4 class="guia-h">Aiken (solo opción múltiple)</h4>
        <pre class="guia-pre">¿Cuál es la capital de Uruguay?
A. Buenos Aires
B. Montevideo
C. Santiago
ANSWER: B</pre>
        <p class="guia-p">Enunciado, opciones <code>A. B. C.</code> y una línea <code>ANSWER:</code> con la
        letra correcta. Separá cada pregunta con una línea en blanco.</p>

        <h4 class="guia-h">Extendido (todos los tipos)</h4>
        <pre class="guia-pre">## P1 :: opcion_multiple :: 1pt
¿Cuál es la unidad de corriente?
- [ ] Voltio
- [x] Amperio
- [ ] Ohmio
&gt; Retro: El amperio (A) es la unidad de corriente.

## P2 :: verdadero_falso :: 1pt
Uruguay tiene costa sobre el Pacífico.
**Respuesta:** Falso

## P3 :: respuesta_corta :: 1pt
Nombrá la ley de Ohm.
**Respuestas aceptadas:** Ley de Ohm | Ohm

## P4 :: numerica :: 1pt
Si V=12 e I=2, ¿cuánto vale R?
**Respuesta:** 6 ± 0.1</pre>
        <p class="guia-p">Cada pregunta arranca con <code>## P[n] :: tipo :: puntaje</code>.
        Para opción múltiple marcá la correcta con <code>[x]</code>.</p>
      `
    },
    {
      id: "exportar",
      titulo: "¿A qué plataforma?",
      html: `
        <p class="guia-p">Cuando tengas tus preguntas listas, bajá el archivo según dónde lo vayas a subir:</p>
        <table class="guia-tabla">
          <thead><tr><th>Descargá</th><th>Para</th></tr></thead>
          <tbody>
            <tr><td><strong>.imscc</strong></td><td>CREA (Ceibal), Schoology y Moodle (Common Cartridge + QTI 1.2). La opción más universal.</td></tr>
            <tr><td><strong>GIFT .txt</strong></td><td>Moodle — formato nativo, rápido de importar.</td></tr>
            <tr><td><strong>Moodle XML</strong></td><td>Moodle — el formato más completo.</td></tr>
            <tr><td><strong>QTI 2.1 .zip</strong></td><td>CREA, Schoology y Moodle — habilita las interacciones ricas (ordenamiento, completar huecos, selección inline).</td></tr>
            <tr><td><strong>Apps Script</strong></td><td>Google Classroom — script que crea un Google Form.</td></tr>
            <tr><td><strong>.json</strong></td><td>Guardar el borrador para seguir editándolo después acá mismo.</td></tr>
          </tbody>
        </table>
        <div class="guia-aviso"><strong>CREA de Ceibal</strong> está basada en Schoology, así que
        importás el mismo archivo <code>.imscc</code> desde "Importar" en tu curso.</div>
        <div class="guia-aviso">Antes de bajar, la app revisa que ninguna pregunta esté incompleta
        (opciones vacías, falta marcar la correcta, etc.) y te avisa.</div>

        <h4 class="guia-h">Entrá a tu plataforma</h4>
        <p class="guia-p">Abrí la plataforma donde vas a importar el archivo (se abre en una pestaña nueva):</p>
        <div class="ia-accesos">
          <span class="ia-accesos__label">Ir a:</span>
          <a class="ia-acceso" href="https://crea2.ceibal.edu.uy/" target="_blank" rel="noopener">CREA Ceibal ↗</a>
          <a class="ia-acceso" href="https://app.schoology.com/" target="_blank" rel="noopener">Schoology ↗</a>
          <a class="ia-acceso" href="https://moodle.org/" target="_blank" rel="noopener">Moodle ↗</a>
          <a class="ia-acceso" href="https://classroom.google.com/" target="_blank" rel="noopener">Google Classroom ↗</a>
        </div>
      `
    },
    {
      id: "fichas",
      titulo: "Fichas Scratch · micro:bit",
      html: `
        <p class="guia-p">La página <strong>Fichas Scratch · micro:bit</strong> arma material didáctico de
        programación: escribís el código como texto y se dibuja con colores. Tres clases de ficha:
        <strong>Scratch</strong> (bloques, en la versión 3, 2 o alto contraste), <strong>micro:bit</strong>
        (el JavaScript de MakeCode se convierte en bloques solo) y <strong>Código</strong> (Python, JavaScript,
        Java, SQL… con resaltado de sintaxis y detección automática del lenguaje).</p>

        <h4 class="guia-h">0 · Modo guiado y modo completo</h4>
        <ul class="guia-lista">
          <li>La página te lleva <strong>paso por paso</strong>: 1 el documento, 2 el contenido, 3 el diseño, 4 descargar y 5 (opcional) convertir para CREA. Avanzás con <strong>"Continuar →"</strong> o tocando los pasos de la barra de arriba.</li>
          <li>Si preferís ver todas las funciones a la vez, tocá <strong>"Ver todo junto (modo completo)"</strong> en la barra. Se puede volver al modo guiado cuando quieras; la preferencia queda guardada.</li>
        </ul>

        <h4 class="guia-h">1 · Crear fichas (cuatro formas)</h4>
        <ul class="guia-lista">
          <li><strong>A mano</strong> — "+ Ficha Scratch", "+ Ficha micro:bit" o "+ Ficha Código".</li>
          <li><strong>Con plantilla</strong> — un clic en "Leer y predecir", "Encontrar el error", "Completar" o "Desafío".</li>
          <li><strong>En lote desde texto</strong> — un solo texto crea muchas fichas (pestaña <em>Importar Texto</em>).</li>
          <li><strong>Con IA</strong> — completás tema, cantidad y tipo de actividad; el prompt vuelve como fichas editables.</li>
          <li><strong>Refuerzo con IA</strong> — con fichas ya cargadas, el botón <strong>"💪 Refuerzo"</strong> del Asistente IA arma un prompt que incluye tus fichas actuales y pide actividades NUEVAS sobre los mismos conceptos: práctica extra, variantes más simples para quien necesita apoyo y desafíos de extensión. La respuesta se agrega al final del documento.</li>
        </ul>

        <h4 class="guia-h">2 · Cómo se escribe el código Scratch</h4>
        <pre class="guia-pre">al presionar bandera verde
por siempre
  mover (10) pasos
  si &lt;¿tocando [borde v]?&gt; entonces
    girar a la derecha (180) grados
  fin
fin</pre>
        <ul class="guia-lista">
          <li><code>(10)</code> números — <code>[hola]</code> textos — <code>[espacio v]</code> desplegables — <code>&lt;condición&gt;</code> bloques hexagonales.</li>
          <li><code>fin</code> cierra "si", "repetir" y "por siempre". Una línea en blanco separa pilas.</li>
          <li>Si un bloque queda <strong>rojo</strong>, el texto no coincide con un bloque real: el editor te sugiere la corrección con un botón "Aplicar".</li>
        </ul>

        <h4 class="guia-h">3 · Personajes y fondos</h4>
        <pre class="guia-pre">fondo: Estrellas

personaje: Gato
al presionar bandera verde
mover (10) pasos

personaje: Perro
al presionar bandera verde
decir [¡Guau!] durante (2) segundos</pre>
        <ul class="guia-lista">
          <li><strong>Sin internet</strong> (guardados en la página): Gato, Perro, Oso, Rana, Pelota, Mariposa, Dinosaurio, Cangrejo, Pingüino, Ratón, Murciélago, Pez, Erizo — fondos Cielo, Fondo de mar, Estrellas, Ciudad de noche, Cancha de fútbol, Granja.</li>
          <li><strong>Con internet</strong>: toda la biblioteca oficial (339 personajes y 85 fondos). Botón <strong>"📚 Catálogo de Scratch"</strong> en la ficha: buscás con miniaturas y un clic inserta la línea. En el <strong>Asistente IA</strong> el mismo botón elige con qué personajes quiere trabajar el docente y el prompt sale con esos nombres como obligatorios.</li>
          <li>Sin encabezados "personaje:", todo el código es del Gato.</li>
        </ul>

        <h4 class="guia-h">4 · Simular y capturar el resultado</h4>
        <ul class="guia-lista">
          <li><strong>Scratch</strong> — botón "▶ Probar en el escenario": el código corre en el <strong>motor oficial de Scratch 3.0</strong> dentro de la ficha, sin internet, con bandera verde, teclado, mouse y preguntas/respuestas. <strong>📸</strong> captura el escenario, lo <strong>recortás/zoomeás</strong> y queda como imagen de la ficha. También podés bajar la captura o el <strong>.sb3</strong> para abrirlo en scratch.mit.edu.</li>
          <li><strong>Sonidos</strong> — el "📚 Catálogo" tiene una pestaña <strong>Sonidos</strong> con los 353 de la biblioteca oficial: podés <strong>escucharlos (▶)</strong> y un clic inserta <code>iniciar sonido [Nombre v]</code> en el código. En el simulador y el .sb3 el sonido se descarga solo (el Miau funciona sin internet). Si un sonido no existe, suena el Miau y te avisa.</li>
          <li><strong>micro:bit</strong> — botón "▶ Simular en MakeCode": el simulador oficial aparece bajo el código con tu programa corriendo (necesita internet; crea un enlace compartido anónimo de MakeCode). <strong>📸 Capturar y recortar</strong>: compartís la pestaña, recortás el micro:bit y la imagen queda en la ficha.</li>
          <li>Cualquier imagen de una ficha se puede reeditar con <strong>"✂ Recortar / zoom"</strong>.</li>
        </ul>

        <h4 class="guia-h">5 · Teoría y guías paso a paso</h4>
        <ul class="guia-lista">
          <li>Las guías arrancan con una <strong>portada de preparación automática</strong>: "🚀 Antes de empezar" muestra los <strong>personajes que hay que agregar</strong> (con sus fotos y nombres), el <strong>fondo a elegir</strong> y una <strong>imagen general del escenario</strong> con los elementos ubicados según las posiciones y tamaños del código ("ir a x: y:", "fijar tamaño al %"). Sale en el PDF y en el Word, y recién después vienen los pasos con el código.</li>
          <li>En el Paso 1 podés escribir una <strong>descripción del proyecto y la dinámica de juego</strong>: aparece al principio del documento, antes de la primera ficha (en Infantil 🎈 sale como "🎮 ¿Cómo es el juego?"). En el formato de texto es la línea <code>descripcion:</code>, y el Asistente IA la escribe por vos en cada prompt.</li>
          <li>Cada ficha tiene el campo <strong>"Teoría"</strong>: un recuadro destacado antes de la consigna para explicar el concepto. Sale en PDF, Word y el formato de texto (<code>teoria:</code>).</li>
          <li>Si el código tiene una condición de contacto entre personajes (<code>&lt;¿tocando [Perro v]?&gt;</code> dentro de la sección de otro personaje), la ficha muestra automáticamente la frase visual <strong>"Si [foto] Gato está tocando a [foto] Perro"</strong> con las fotos y nombres de ambos — así el alumno ve de un vistazo qué interacción está programando. Sale también en PDF y Word.</li>
          <li>El botón <strong>"🐱 Descargar el proyecto Scratch completo (.sb3)"</strong> (arriba del editor visual y en Descargar) junta el código de todas las fichas en un solo proyecto: lo abrís en scratch.mit.edu (Archivo → Cargar desde tu computadora) y lo mostrás funcionando. Las secciones del mismo personaje se combinan en un solo sprite.</li>
          <li><strong>Idioma:</strong> los bloques se aceptan tanto en <strong>español de España</strong> como en <strong>español latinoamericano</strong> ("al presionar bandera" / "al hacer clic en la bandera", "fijar x a" / "dar a x el valor"…): las dos redacciones se dibujan bien, sin bloques rojos.</li>
          <li>Si el código declara el escenario (<code>fondo: Estrellas</code>), la ficha muestra la <strong>miniatura del fondo con su nombre al pie</strong>, junto a los retratos de la esquina. También va al PDF y al Word.</li>
          <li>En el Asistente IA, la <strong>cantidad de fichas/pasos</strong> puede quedar vacía: la IA decide cuántos hacen falta según el tema (también podés fijar un número).</li>
          <li>Si el código Scratch indica sus personajes (<code>personaje: Perro</code>), la ficha muestra <strong>automáticamente el dibujo del personaje en la esquina superior derecha</strong> — en pantalla, en el PDF y en el Word. Sin encabezado, aparece el Gato. En el diseño Infantil 🎈 el retrato sale más grande, en un globito con el nombre. Funciona venga de donde venga la ficha: editor visual, texto en lote o Asistente IA (los prompts ya piden que la IA indique el personaje).</li>
          <li>En el Paso 1, la tarjeta <strong>"🪜 Guía paso a paso"</strong> convierte las fichas en <strong>PASO 1, PASO 2…</strong> de un mismo proyecto: ideal para tutoriales de juegos completos. En el Asistente IA, la tarjeta <strong>"🪜 Guía paso a paso"</strong> (arriba del formulario) genera todos los pasos de una vez — con teoría, código por personaje y numeración PASO 1, 2, 3… — para Scratch, micro:bit o lenguajes de texto según la plataforma elegida.</li>
          <li>Las fichas de <strong>micro:bit</strong> aceptan <strong>extensiones de MakeCode</strong> (campo "Extensiones" de la tarjeta o clave <code>extensiones:</code> en el texto en lote): con <code>cutebot</code>, <code>maqueen</code>, <code>neopixel</code>… — o cualquier repo <code>github:usuario/repo</code> — los bloques de la placa o kit se dibujan bien en la ficha y el simulador carga el proyecto con la extensión incluida.</li>
          <li>En el paso <strong>"El diseño"</strong> elegís el <strong>diseño del documento</strong> (vale para la vista, el PDF y el Word): <strong>Clásico</strong> (marcos negros, sobrio), <strong>Documento simple</strong> (sin recuadros, tipo apunte con serif), <strong>Colorido</strong> (acentos de color prolijos, un color por ficha), <strong>Blanco y negro</strong> (todo monocromo, con los bloques en escala de grises — ideal para fotocopias) e <strong>Infantil 🎈</strong>. Además podés elegir la <strong>letra</strong> (predeterminada, Arial o Times New Roman — la elegida gana sobre la del diseño) y el <strong>tamaño</strong> del texto (chico, normal o grande).</li>
          <li><strong>"Diseño → Infantil 🎈"</strong> transforma todo el documento en una versión colorida para niños de escuela: cada paso con un color distinto, número en un globo, teoría como nube "💡 Para aprender", consigna con 🎯, pistas con ⭐ y una casilla <strong>"¡Lo logré!"</strong> para que el niño marque cada paso terminado. Se aplica a la vista, al PDF y al Word. En el Asistente IA, marcá <strong>"🎈 Para niños de escuela"</strong> para que la IA escriba con lenguaje simple, tono lúdico y pasos chiquitos.</li>
        </ul>

        <h4 class="guia-h">6 · Formato de texto para el lote</h4>
        <pre class="guia-pre">titulo: Práctico — Bucles
nivel: 6° año
modo: guia            (opcional: tutorial paso a paso)

=== FICHA: El gato rebota ===
tipo: scratch         (scratch | microbit | codigo)
teoria: Un bucle repite bloques sin parar.
consigna: Explicá qué hace el gato.
codigo:
al presionar bandera verde
mover (10) pasos
notas: Pista para el alumno.</pre>
        <div class="guia-aviso">El botón <strong>"Copiar como texto"</strong> (en Descargar) baja tus fichas en
        este formato: las editás donde quieras y las volvés a pegar. Así mantenés bancos de fichas reutilizables.</div>

        <h4 class="guia-h">7 · Descargar y convertir</h4>
        <ul class="guia-lista">
          <li><strong>PDF</strong> — vista de impresión del navegador ("Guardar como PDF").</li>
          <li><strong>Word .docx</strong> — editable, con los bloques como imágenes nítidas y la teoría en recuadro.</li>
          <li><strong>Cuestionario para CREA</strong> (Paso 5) — cada pregunta lleva la <strong>imagen de los bloques en el enunciado</strong>: automático (una pregunta por ficha) o variado con IA. Se abre en el Editor y de ahí sale el <code>.imscc</code> con las imágenes adentro.</li>
          <li>Ya en el Editor, si agregás o editás preguntas, no hace falta subir nada: el botón <strong>"🧩 Usar una imagen ya cargada"</strong> abre una galería con las <strong>imágenes de los bloques generadas desde las fichas</strong> (y cualquier otra que hayas subido) para ponerla en la pregunta con un clic.</li>
          <li><strong>Borrador .json</strong> — para retomar otro día (además se autoguarda en el navegador).</li>
        </ul>
      `
    },
    {
      id: "lego",
      titulo: "Ensamble LEGO",
      html: `
        <p class="guia-p">La sección <strong>Ensamble con LEGO</strong> crea manuales de construcción paso a paso,
        como los de las cajas oficiales: el modelo se describe como <strong>texto plano</strong> (o lo genera una IA,
        o se <strong>importa un modelo <code>.ldr</code>/<code>.mpd</code></strong> ya armado) y se dibuja en
        <strong>3D</strong> con el motor LDraw + three.js que vive en la propia página — no depende de servicios
        externos.</p>

        <h4 class="guia-h">1 · Crear la guía (cuatro formas combinables)</h4>
        <ul class="guia-lista">
          <li><strong>Editor Visual</strong> — agregás pasos y piezas con selectores, ubicás cada pieza con clic en la
          cuadrícula (vista desde arriba) y mirás el modelo en 3D mientras armás.</li>
          <li><strong>Importar Texto</strong> — un solo texto carga la guía entera. Ideal para reutilizar y editar en lote.</li>
          <li><strong>Asistente IA</strong> — describís qué querés armar y el prompt sale con el catálogo de piezas, la
          sintaxis y las reglas físicas explicadas; la respuesta de la IA se convierte en la guía completa de una vez.</li>
          <li><strong>Importar modelo 3D</strong> — subís un modelo <code>.ldr</code> o <code>.mpd</code> ya armado en
          BrickLink Studio, LeoCAD, LDCad o MLCad y la página lo <strong>desarma en pasos</strong> sola.</li>
          <li><strong>Editor 3D del modelo terminado</strong> — abrís el modelo completo en 3D, hacés clic en cualquier
          pieza y la movés, girás, cambiás de color o borrás. Como cada pieza pertenece a su paso, <strong>los pasos
          previos se corrigen automáticamente</strong>: ideal para retocar a gusto lo que generó la IA. El deslizador
          "ver hasta el paso" muestra el modelo en cualquier etapa intermedia.</li>
        </ul>

        <h4 class="guia-h">Importar un modelo que ya tenés armado</h4>
        <p class="guia-p">Si el modelo ya está hecho en la computadora, no hace falta escribirlo de nuevo: en la
        pestaña <strong>«Importar modelo 3D»</strong> arrastrás el archivo y la página lo analiza. Reconoce cada pieza
        contra el catálogo (así queda editable, con miniatura, inventario y comparador 1:1), la ubica en la cuadrícula,
        apoya el modelo en el suelo y arma la guía. Las piezas que no están en el catálogo se dibujan igual y también
        salen en la lista «Buscá estas piezas».</p>
        <ul class="guia-lista">
          <li><strong>Los pasos</strong> — si el archivo ya trae pasos marcados (<code>0 STEP</code>, lo que arma
          LPub3D o Studio), se usan esos. Si no, se generan solos: <strong>de abajo hacia arriba, capa por capa</strong>,
          con la cantidad de piezas por paso que vos elijas (menos piezas por paso = pasos más fáciles de seguir).</li>
          <li><strong>Submodelos</strong> — un <code>.mpd</code> con subconjuntos se integra completo, cada pieza en su
          lugar; los pasos internos de cada submodelo se respetan.</li>
          <li><strong>Colores</strong> — los que no están en la paleta del generador se cambian por el más parecido y
          queda avisado cuál se cambió por cuál.</li>
          <li><strong>Formatos</strong> — <code>.ldr</code>, <code>.mpd</code> y <code>.dat</code>. Desde
          <strong>Studio</strong>: <em>Archivo → Exportar → Exportar como LDraw</em>; desde <strong>LeoCAD</strong>:
          <em>Guardar como… → .ldr</em>.</li>
          <li><strong>Si faltan piezas</strong> — la página trae adentro solo las piezas de su catálogo. Cuando el
          modelo usa otras, el análisis avisa cuáles y podés cargar el <code>complete.zip</code> oficial de LDraw
          (library.ldraw.org) para que se dibujen todas. El zip se lee en tu propia computadora, no se sube a ningún
          lado, y queda disponible mientras no cierres la página.</li>
        </ul>
        <div class="guia-aviso">Un modelo importado se edita como cualquier otra guía: podés juntar o partir pasos,
        cambiar las consignas, sacar piezas y escribir las notas para el estudiante.</div>

        <h4 class="guia-h">2 · La sintaxis del texto</h4>
        <p class="guia-p">Cada paso empieza con <code>=== PASO: Título ===</code> y lleva <code>consigna:</code>,
        <code>piezas:</code> y <code>notas:</code>. Cada línea de pieza dice qué pieza, de qué color y dónde va:</p>
        <pre class="guia-pre">=== PASO: La base ===
consigna: Armá la base del carrito.
piezas:
placa 2x6 gris claro en 0 0
ladrillo 2x4 rojo en 1 0 nivel 1
ladrillo 2x2 azul en 1 0 nivel 4 rotar 90
notas: Las placas son las piezas finitas.</pre>
        <ul class="guia-lista">
          <li><code>en x z</code> — la esquina de la pieza en la cuadrícula, en studs (los "botones"). x crece a la
          derecha, z hacia abajo; desde ahí la pieza se extiende hacia +x y +z. Sin rotar, el lado largo va sobre x.
          Se aceptan decimales con punto (ej: <code>2.5</code>) para ajustes finos: engranar engranajes o centrar un
          eje en una rueda (<code>nivel 3.5</code>).</li>
          <li><code>nivel n</code> — la altura de la base de la pieza, en placas: <strong>3 placas = 1 ladrillo</strong>.
          El suelo es 0; un ladrillo apoyado ocupa los niveles 0-2 y lo que va arriba usa <code>nivel 3</code>.</li>
          <li><code>rotar 90</code> — gira la pieza (90, 180 o 270).</li>
          <li><code>parado</code> — al final de la línea, vuelca la pieza 90° hacia arriba: una viga queda de pie
          a lo largo de x con los agujeros de frente.</li>
          <li><code>volcado</code> — vuelca la pieza 90° de costado: una viga queda a lo largo de z con los
          agujeros hacia x (la orientación real para clavarle pines y montar motores) y un eje queda vertical.</li>
          <li>Piezas: <code>ladrillo</code>, <code>placa</code>, <code>lisa</code> (tile) y <code>pendiente</code> en los
          tamaños clásicos (1x1 a 2x8 y placas grandes), redondas, técnicas, ruedas y especiales — los nombres exactos
          están en los selectores del editor visual. Colores: rojo, azul, amarillo, verde, naranja, blanco, negro,
          gris claro, gris oscuro, beige y más.</li>
        </ul>

        <h4 class="guia-h">El kit LEGO Mindstorms NXT</h4>
        <p class="guia-p">El catálogo incluye el <strong>kit NXT completo (Education 9797)</strong>: vigas técnicas
        rectas y angulares, pines, ejes, bujes, bloques cruz, <strong>engranajes</strong> (8, 16, 24, 40 dientes,
        cónicos, corona y tornillo sin fin), ruedas con neumáticos, el <strong>bloque inteligente NXT</strong>, los
        <strong>3 servomotores</strong> y los <strong>sensores</strong> (contacto, luz, sonido y ultrasónico). En el
        <strong>Asistente IA</strong>, el tick <strong>"🧱 Usar solo el kit NXT"</strong> permite <strong>limitar el
        diseño al kit</strong> al generar el prompt:
        los selectores del editor solo muestran esas piezas, las importaciones marcan con ⚠ lo que no viene en el kit,
        y el prompt del Asistente IA sale con el catálogo restringido para que la IA diseñe solo con piezas del kit.
        Si además indicás <strong>cuántos kits tenés</strong>, se controlan las cantidades (ej: con 2 kits hay
        6 motores) — dejá el campo vacío para no limitar el número de piezas.</p>

        <h4 class="guia-h">3 · Las fichas y el comparador 1:1</h4>
        <p class="guia-p">Cada paso se imprime como una ficha: <strong>"Buscá estas piezas"</strong> (miniaturas 3D con
        cantidades y el <strong>comparador a tamaño real</strong>: el dibujo de la huella de cada pieza a escala 1:1,
        para apoyar la pieza encima y verificar que es la correcta), la <strong>guía visual del armado</strong> hasta ese
        paso, y la consigna y notas que escribas. La portada muestra el modelo terminado con el inventario completo.</p>
        <div class="guia-aviso">Para que el comparador salga a tamaño real, imprimí al <strong>100 %</strong> (sin
        "ajustar a la página"). 1 stud = 8 mm.</div>

        <h4 class="guia-h">4 · Descargas</h4>
        <ul class="guia-lista">
          <li><strong>PDF</strong> — desde la impresión del navegador, listo para repartir.</li>
          <li><strong>Modelo LDraw .ldr</strong> — el modelo con sus pasos, compatible con
          <strong>LPub3D</strong>, <strong>LDView</strong> y <strong>BrickLink Studio</strong> para renders y manuales
          profesionales.</li>
          <li><strong>Copiar como texto / borrador .json</strong> — para editar en lote o retomar otro día (también se
          autoguarda en el navegador).</li>
        </ul>
      `
    },
    {
      id: "protocolos",
      titulo: "Protocolos de práctico",
      html: `
        <p class="guia-p">La sección <strong>Diseño → Protocolos de práctico</strong> arma el documento completo de una
        práctica de laboratorio y lo deja listo para repartir. Sirve para <strong>física y química, de 7° a 3° de
        EMS</strong>, y trae dos herramientas que se usan juntas: el <strong>generador de protocolos</strong> y el
        <strong>banco de instrumentos</strong>.</p>

        <h4 class="guia-h">1 · Las secciones del protocolo</h4>
        <p class="guia-p">El protocolo se arma por bloques, y cada uno se edita por separado mientras la vista previa
        de la derecha se actualiza sola:</p>
        <ul class="guia-lista">
          <li><strong>Fundamento teórico</strong> — la teoría mínima para entender qué se va a hacer y por qué.</li>
          <li><strong>Objetivos</strong>, <strong>materiales</strong> y <strong>normas de seguridad</strong>.</li>
          <li><strong>Instrumentos</strong> — se dibujan dentro del protocolo con su alcance, su apreciación y la
          incertidumbre con la que hay que anotar cada medida.</li>
          <li><strong>Sustancias y reactivos</strong> — los tarritos con su etiqueta (nombre, fórmula, concentración,
          cuánto hay) y el pictograma de peligro.</li>
          <li><strong>Montaje experimental</strong> — cómo se arma el dispositivo, con foto o esquema si querés.</li>
          <li><strong>Procedimiento paso a paso</strong> — y la <strong>escena</strong> de cada paso: marcás qué
          instrumentos y qué frascos entran en juego y se dibujan al lado, así se ve cómo queda la mesada en ese
          momento.</li>
          <li><strong>Toma y registro de datos</strong> — tablas <em>en blanco</em>: vos definís las columnas con su
          unidad y su incertidumbre, y cuántas filas van.</li>
          <li><strong>Cálculos</strong>, <strong>preguntas de análisis</strong> y <strong>conclusiones</strong> con
          renglones para escribir a mano.</li>
          <li><strong>Notas para el docente</strong> — lo que hace que la práctica salga bien y que el estudiante no
          tiene que ver: qué preparar el día anterior, en qué se traban siempre, cómo adaptarla si falta material,
          cuánto tiempo lleva cada tramo y qué mirar al corregir.</li>
        </ul>

        <h4 class="guia-h">2 · Dos versiones del mismo protocolo</h4>
        <p class="guia-p">Arriba de la vista previa elegís la versión: la del <strong>estudiante</strong> trae los
        espacios en blanco, el cabezal para los nombres del equipo y los instrumentos <em>sin</em> el número de la
        lectura —leer la escala es parte del trabajo—; la del <strong>docente</strong> muestra todo, suma en cada
        instrumento cómo se lee y agrega al final las notas para el docente. El PDF sale de la versión que tengas
        elegida, así que imprimí la del estudiante para repartir y la del docente para vos.</p>

        <h4 class="guia-h">3 · De dónde arrancar</h4>
        <ul class="guia-lista">
          <li><strong>Un práctico de ejemplo</strong> — hay nueve completos, de 7° a 3° de EMS: separación de mezclas,
          densidad de sólidos, evidencias de reacción química, ley de Hooke, calor específico, péndulo simple, ley de
          Ohm, velocidad de reacción y titulación ácido-base. Abrilos y cambiales lo que haga falta.</li>
          <li><strong>Asistente IA</strong> — la página arma el prompt con el tema, el nivel y la cantidad de pasos, y
          le mete adentro la referencia completa del formato, todos los instrumentos disponibles y la consigna de que
          termine con las notas para el docente. Lo pegás en ChatGPT, Claude o Gemini y traés la respuesta de vuelta
          al recuadro de texto.</li>
          <li><strong>Texto plano</strong> — el mismo formato con <code>##</code> por sección se puede escribir a mano
          y pegar. El botón <strong>«Referencia del formato»</strong> muestra la especificación entera —cada sección
          con su sintaxis exacta, todos los identificadores y todos los parámetros— y se copia con un clic;
          <strong>«Ver un protocolo entero»</strong> muestra un ejemplo real ya escrito en ese formato.</li>
          <li><strong>.json guardado</strong> — para retomar el protocolo del año pasado.</li>
        </ul>

        <h4 class="guia-h">4 · Las fórmulas</h4>
        <p class="guia-p">En el <strong>fundamento</strong>, el <strong>montaje</strong>, las <strong>preguntas</strong>
        y la <strong>fórmula de cada cálculo</strong> podés escribir matemática de verdad, en LaTeX. Lo que ponés entre
        signos de peso se dibuja como fórmula; el resto queda como texto normal:</p>
        <pre class="guia-pre">Se calcula como $d = \\frac{m}{V}$, donde…      ← en el medio del renglón

$$T = 2\\pi\\sqrt{\\frac{L}{g}}$$                 ← centrada, en su propio bloque</pre>
        <p class="guia-p">Abajo del fundamento hay una <strong>barra de símbolos</strong>: fracciones, raíces, Δ, π, ρ,
        Ω, vectores, notación científica y demás, dibujados como se van a ver. Hacés clic y se insertan donde está el
        cursor. El botón <strong>«Fórmulas de ejemplo»</strong> trae ocho armadas (densidad, período del péndulo, ley de
        Ohm, calor, energía cinética…) para insertar de una. Si te equivocás escribiendo el LaTeX, la fórmula aparece en
        rojo con el código a la vista, así ves dónde está el error en vez de encontrarte con un hueco.</p>

        <h4 class="guia-h">5 · El banco de instrumentos</h4>
        <p class="guia-p">Son 33 instrumentos dibujados en vectores. Para <strong>medir</strong>: regla, calibre con
        nonio, micrómetro, transportador, probeta, bureta, pipeta con propipeta, jeringa, material de vidrio,
        termómetro, dinamómetro, balanza digital, balanza de tres brazos y cronómetro. Para <strong>física</strong>:
        multímetro, instrumento de aguja, fuente regulable, circuito eléctrico, plano inclinado, poleas, banco óptico,
        calorímetro y micro:bit. Para <strong>química</strong>: frascos con sustancia, mechero Bunsen, soporte
        universal armado, gradilla con tubos, filtración, destilación, agitador magnético y papel de pH. Y los
        <strong>sensores Vernier Go Direct</strong>. De cada uno configurás <strong>hasta cuánto mide</strong>,
        <strong>cuánto vale la rayita más chica</strong>, <strong>cada cuánto se numera</strong>, <strong>la
        unidad</strong> y <strong>qué lectura muestra</strong>. La misma probeta te sirve para una de 10 mL con
        divisiones de 0,2 mL y para una de 1 L con divisiones de 20 mL.</p>
        <ul class="guia-lista">
          <li><strong>Multímetro</strong> — la llave selectora tiene las 26 posiciones reales: tensión y corriente
          continua y alterna con todos sus rangos, resistencia, continuidad, diodo, hFE, capacidad, frecuencia y
          temperatura. Eligiendo la posición ya salen solas la unidad, los decimales y el borne por el que va la
          punta roja.</li>
          <li><strong>micro:bit</strong> — la placa con lo que le colgás de los pines 0, 1 y 2 (LDR, termistor,
          ultrasonido, DHT11, servo, zumbador, relé y más), el sensor interno que estés usando y lo que muestra la
          matriz de LED. Los cables y los sensores se dibujan.</li>
          <li><strong>Vernier Go Direct</strong> — 30 modelos de la línea, cada uno con su magnitud, su unidad y su
          rango: fuerza y aceleración, temperatura, pH, movimiento, presión de gas, CO₂, O₂, conductividad, tensión,
          corriente, campo magnético, sonido, EKG y demás.</li>
          <li><strong>Frascos con sustancia</strong> — el tarrito con su etiqueta (nombre, fórmula, concentración,
          cuánto hay), lo lleno que está y el <strong>pictograma de peligro</strong>. Hay frasco, botella, gotero,
          vaso, tubo, Erlenmeyer, cápsula de Petri y vidrio de reloj.</li>
          <li><strong>Circuito eléctrico</strong> — el esquema con los símbolos normalizados, con el amperímetro
          siempre en serie y el voltímetro siempre en paralelo, para que se vea de un vistazo dónde va cada uno.</li>
          <li><strong>Banco óptico</strong> — le ponés la focal y la distancia del objeto y calcula solo dónde cae la
          imagen, con qué tamaño y de qué lado, y traza los rayos.</li>
        </ul>
        <div class="guia-aviso">Cada instrumento se resume en una línea de texto como
        <code>probeta :: max=250, division=2, unidad=mL, lectura=150</code>. El botón "Copiar para el protocolo" te la
        da lista para pegar en el generador — y es el mismo formato que le podés pedir a una IA.</div>

        <h4 class="guia-h">6 · La línea de medición</h4>
        <p class="guia-p">Los instrumentos salen <strong>sin</strong> la línea roja que señala dónde hay que leer, a
        propósito: encontrar la medida en la escala es parte del trabajo. Cuando te sirve, la agregás vos y la
        <strong>calibrás como quieras</strong>: podés hacerla apuntar a un punto distinto del que marca el instrumento
        (por ejemplo, al nivel inicial de la probeta y no al final), ponerle su propio rótulo y correrla unos
        milímetros para que calce exacta. Está en los parámetros de cada instrumento, abajo de todo.</p>

        <h4 class="guia-h">7 · Ejercicios de lectura de escalas</h4>
        <p class="guia-p">Abajo del banco hay un generador de <strong>hojas de ejercicios</strong>: marcás los
        instrumentos, y sale una hoja con cada uno dibujado en una lectura <strong>al azar y sin el número</strong>,
        con el renglón para que el estudiante escriba cuánto mide y con qué incertidumbre. Se puede regenerar todas
        las veces que quieras —sale distinta cada vez— y viene con la clave de corrección para recortar.</p>

        <h4 class="guia-h">8 · Descargas</h4>
        <ul class="guia-lista">
          <li><strong>PDF</strong> — imprimiendo desde el navegador o con "Descargar PDF directo".</li>
          <li><strong>.json</strong> — para reeditar el protocolo cuando quieras.</li>
          <li><strong>Texto plano</strong> — para pasarlo a otro lado o corregirlo con una IA.</li>
          <li><strong>SVG y PNG</strong> de cada instrumento, para pegarlo en una prueba, un Word o una presentación.</li>
        </ul>
      `
    },
    {
      id: "video",
      titulo: "Video tutorial",
      html: `
        <p class="guia-p">Mirá el paso a paso de cómo subir los cuestionarios a tu plataforma.</p>
        <div class="guia-video">
          <video controls preload="metadata" playsinline>
            <source src="tutorial-subir-cuestionarios.mp4" type="video/mp4">
            Tu navegador no puede reproducir el video. Podés
            <a href="tutorial-subir-cuestionarios.mp4" target="_blank" rel="noopener">descargarlo acá</a>.
          </video>
        </div>
        <p class="guia-p" style="opacity:0.55">¿No se ve el video? Todavía no fue subido al repositorio.
        Colocá tu archivo <code>.mp4</code> con el nombre
        <code>tutorial-subir-cuestionarios.mp4</code> y va a aparecer acá automáticamente.</p>
      `
    },
    {
      id: "faq",
      titulo: "Preguntas frecuentes",
      html: `
        <h4 class="guia-h">¿Se guardan mis preguntas?</h4>
        <p class="guia-p">No se suben a ningún lado. Si querés conservarlas, usá
        <strong>"Guardar borrador .json"</strong> y después <strong>"Importar borrador"</strong> para retomarlas.</p>

        <h4 class="guia-h">Schoology no me muestra las opciones</h4>
        <p class="guia-p">Suele ser por opciones vacías o sin marcar la correcta. Revisá las advertencias
        que aparecen antes de descargar y completá lo que falte.</p>

        <h4 class="guia-h">¿Necesito pagar una IA?</h4>
        <p class="guia-p">No. El asistente IA es opcional y funciona con la versión gratuita de
        ChatGPT, Claude o Gemini. También podés cargar todo a mano.</p>

        <h4 class="guia-h">¿Los simuladores necesitan internet?</h4>
        <p class="guia-p">El de <strong>Scratch no</strong>: el motor oficial vive en la página (salvo que uses
        personajes del catálogo ampliado, que se descargan la primera vez). El de <strong>micro:bit sí</strong>:
        usa el simulador oficial de MakeCode.</p>

        <h4 class="guia-h">¿Mi código de micro:bit se publica en algún lado?</h4>
        <p class="guia-p">Al simular se crea un <strong>enlace compartido anónimo de MakeCode</strong> (lo mismo
        que el botón "Compartir" de MakeCode). No lleva tu nombre ni datos, solo el código de la ficha.</p>

        <h4 class="guia-h">¿Se guardan mis fichas?</h4>
        <p class="guia-p">Se autoguardan en tu navegador mientras trabajás. Para conservarlas o pasarlas a otra
        compu, usá <strong>"Guardar borrador .json"</strong> o <strong>"Copiar como texto"</strong>.</p>

        <h4 class="guia-h">¿Puedo cambiar los colores?</h4>
        <p class="guia-p">Sí, con el selector de temas arriba a la derecha (crema, claro, nocturno, amigable, azul).</p>
      `
    }
  ];

  let raiz = null;

  function construir() {
    if (raiz) return raiz;
    raiz = document.createElement("div");
    raiz.className = "guia-overlay";
    raiz.setAttribute("role", "dialog");
    raiz.setAttribute("aria-modal", "true");
    raiz.setAttribute("aria-label", "Guía de uso");
    raiz.hidden = true;

    const nav = SECCIONES.map((s, i) =>
      `<button class="guia-tab${i === 0 ? " guia-tab--activa" : ""}" data-sec="${s.id}">${s.titulo}</button>`
    ).join("");

    const panes = SECCIONES.map((s, i) =>
      `<section class="guia-pane${i === 0 ? " guia-pane--activa" : ""}" data-pane="${s.id}">${s.html}</section>`
    ).join("");

    raiz.innerHTML = `
      <div class="guia-modal">
        <header class="guia-cabecera">
          <div>
            <div class="guia-eyebrow">// Ayuda</div>
            <h2 class="guia-titulo">Guía de uso</h2>
          </div>
          <button class="guia-cerrar" aria-label="Cerrar guía">✕</button>
        </header>
        <div class="guia-cuerpo">
          <nav class="guia-nav">${nav}</nav>
          <div class="guia-contenido">${panes}</div>
        </div>
      </div>
    `;

    document.body.appendChild(raiz);

    // Cerrar
    raiz.querySelector(".guia-cerrar").addEventListener("click", cerrar);
    raiz.addEventListener("click", (e) => { if (e.target === raiz) cerrar(); });

    // Navegación entre secciones
    raiz.querySelectorAll(".guia-tab").forEach((tab) => {
      tab.addEventListener("click", () => mostrarSeccion(tab.dataset.sec));
    });

    return raiz;
  }

  function mostrarSeccion(id) {
    if (!raiz) return;
    raiz.querySelectorAll(".guia-tab").forEach((t) =>
      t.classList.toggle("guia-tab--activa", t.dataset.sec === id)
    );
    raiz.querySelectorAll(".guia-pane").forEach((p) =>
      p.classList.toggle("guia-pane--activa", p.dataset.pane === id)
    );
    const cont = raiz.querySelector(".guia-contenido");
    if (cont) cont.scrollTop = 0;
  }

  function abrir(seccion) {
    construir();
    raiz.hidden = false;
    document.body.style.overflow = "hidden";
    if (seccion && SECCIONES.some((s) => s.id === seccion)) mostrarSeccion(seccion);
    raiz.querySelector(".guia-cerrar")?.focus();
  }

  function cerrar() {
    if (!raiz) return;
    raiz.hidden = true;
    document.body.style.overflow = "";
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && raiz && !raiz.hidden) cerrar();
  });

  function init() {
    // Delegación: funciona también para botones/enlaces agregados dinámicamente
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-abrir-guia]");
      if (!btn) return;
      e.preventDefault();
      abrir(btn.getAttribute("data-abrir-guia") || null);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Exponer por si se quiere abrir desde otro script
  window.GuiaUso = { abrir, cerrar };
})();
