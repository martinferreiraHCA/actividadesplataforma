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
        <p class="guia-p">Esta herramienta arma <strong>cuestionarios y actividades</strong> y te los
        descarga listos para subir a <strong>CREA de Ceibal, Schoology, Moodle o Google Classroom</strong>.
        Todo pasa en tu navegador: no se instala nada y tus datos no salen de tu compu.</p>

        <h4 class="guia-h">Los 3 pasos</h4>
        <ol class="guia-pasos">
          <li><strong>Elegí el tipo de actividad</strong> en la página de inicio (cuestionario, opción múltiple, V/F, etc.).</li>
          <li><strong>Cargá tus preguntas</strong> de una de estas tres formas: a mano con el editor visual, pegando texto, o con ayuda de una IA.</li>
          <li><strong>Descargá</strong> el archivo en el formato de tu plataforma y subilo.</li>
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
        <p class="guia-p">Un cuestionario puede mezclar estos seis tipos:</p>
        <ul class="guia-lista">
          <li><strong>Opción múltiple</strong> — varias opciones, una correcta.</li>
          <li><strong>Verdadero / Falso</strong> — afirmación que se marca V o F.</li>
          <li><strong>Respuesta corta</strong> — el alumno escribe; aceptás varias respuestas válidas separadas con <code>|</code>.</li>
          <li><strong>Numérica</strong> — respuesta con número y tolerancia (± un margen).</li>
          <li><strong>Emparejamiento</strong> — unir elementos de dos columnas.</li>
          <li><strong>Ensayo</strong> — desarrollo libre, se corrige a mano.</li>
        </ul>

        <h4 class="guia-h">Imágenes</h4>
        <p class="guia-p">Desde el editor visual, cada pregunta tiene un botón
        <strong>"+ Agregar imagen"</strong> para subir una figura. Las imágenes viajan dentro del
        archivo <code>.imscc</code>, así que se ven en Schoology y Moodle sin pasos extra.</p>
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
        <p class="guia-p">La página <strong>Fichas Scratch · micro:bit</strong> arma fichas de trabajo
        imprimibles: escribís el código como texto y se dibuja como <strong>bloques de colores</strong>.
        Cada ficha lleva consigna, código, imagen opcional y notas al pie, y el documento sale en
        <strong>PDF o Word</strong>.</p>

        <h4 class="guia-h">4 formas de crear fichas</h4>
        <ul class="guia-lista">
          <li><strong>A mano</strong> — "+ Ficha Scratch" o "+ Ficha micro:bit" y completás los campos.</li>
          <li><strong>Con plantilla</strong> — un clic en "Leer y predecir", "Encontrar el error", "Completar" o "Desafío" y queda una ficha entera para retocar.</li>
          <li><strong>En lote desde texto</strong> — pegás un solo texto con todas las fichas (pestaña <em>Importar Texto</em>). Ideal para crear 5 o 10 fichas de una vez.</li>
          <li><strong>Con IA</strong> — completás tema, cantidad y tipo de actividad; la app genera el prompt, y la respuesta de la IA se convierte en fichas editables.</li>
        </ul>

        <h4 class="guia-h">Cómo se escribe el código Scratch</h4>
        <pre class="guia-pre">al presionar bandera verde
por siempre
  mover (10) pasos
  si &lt;¿tocando [borde v]?&gt; entonces
    girar a la derecha (180) grados
  fin
fin</pre>
        <ul class="guia-lista">
          <li><code>(10)</code> — números entre paréntesis; <code>[hola]</code> — textos entre corchetes; <code>[v]</code> marca un desplegable.</li>
          <li><code>&lt;condición&gt;</code> — los bloques hexagonales van entre <code>&lt; &gt;</code>.</li>
          <li><code>fin</code> — cierra "si", "repetir" y "por siempre". Una línea en blanco separa dos pilas.</li>
          <li>Se puede escribir en español o inglés, y elegir la <strong>versión de Scratch</strong> (3, 2 o alto contraste): cada una se dibuja con su paleta oficial de colores.</li>
        </ul>

        <h4 class="guia-h">¿Un bloque quedó rojo?</h4>
        <p class="guia-p">Si un bloque se dibuja <strong>rojo</strong>, el texto no coincide con ningún bloque
        real de Scratch. El editor lo detecta y te <strong>sugiere la corrección con un botón "Aplicar"</strong>.
        Los errores más comunes:</p>
        <table class="guia-tabla">
          <thead><tr><th>Se suele escribir…</th><th>El bloque real es…</th></tr></thead>
          <tbody>
            <tr><td><code>girar (90) grados</code></td><td><code>girar a la derecha (90) grados</code></td></tr>
            <tr><td><code>decir [Hola] por (2) segundos</code></td><td><code>decir [Hola] durante (2) segundos</code></td></tr>
            <tr><td><code>cambiar [puntos v] por (1)</code></td><td><code>sumar a [puntos v] (1)</code></td></tr>
            <tr><td><code>fijar [puntos v] a (0)</code></td><td><code>dar a [puntos v] el valor (0)</code></td></tr>
            <tr><td><code>tocar sonido [Miau v]</code></td><td><code>iniciar sonido [Miau v]</code></td></tr>
            <tr><td><code>¿tocando un borde?</code></td><td><code>¿tocando [borde v]?</code></td></tr>
            <tr><td><code>rebotar si toca un borde</code></td><td><code>si toca un borde, rebotar</code></td></tr>
          </tbody>
        </table>

        <h4 class="guia-h">Chuletario: bloques frecuentes (redacción exacta)</h4>
        <p class="guia-p"><strong>Eventos</strong> (amarillo #FFBF00)</p>
        <pre class="guia-pre">al presionar bandera verde
al presionar tecla [espacio v]
al hacer clic en este objeto
al recibir [mensaje1 v]
enviar [mensaje1 v]</pre>
        <p class="guia-p"><strong>Movimiento</strong> (azul #4C97FF)</p>
        <pre class="guia-pre">mover (10) pasos
girar a la derecha (15) grados
girar a la izquierda (15) grados
apuntar en dirección (90)
ir a x: (0) y: (0)
ir a [posición aleatoria v]
deslizar en (1) segs a x: (0) y: (0)
si toca un borde, rebotar</pre>
        <p class="guia-p"><strong>Apariencia</strong> (violeta #9966FF)</p>
        <pre class="guia-pre">decir [¡Hola!] durante (2) segundos
decir [¡Hola!]
pensar [Hmm...] durante (2) segundos
cambiar disfraz a [disfraz2 v]
siguiente disfraz
cambiar fondo a [fondo1 v]
fijar tamaño al (100) %
sumar al efecto [color v] (25)
esconder
mostrar</pre>
        <p class="guia-p"><strong>Sonido</strong> (fucsia #CF63CF)</p>
        <pre class="guia-pre">iniciar sonido [Miau v]
tocar sonido [Miau v] hasta que termine</pre>
        <p class="guia-p"><strong>Control</strong> (naranja #FFAB19)</p>
        <pre class="guia-pre">esperar (1) segundos
repetir (10)
por siempre
si &lt;&gt; entonces
si no
esperar hasta que &lt;&gt;
repetir hasta que &lt;&gt;
detener [todos v]
crear clon de [mí mismo v]
al comenzar como clon
eliminar este clon
fin</pre>
        <p class="guia-p"><strong>Sensores</strong> (celeste #5CB1D6)</p>
        <pre class="guia-pre">¿tocando [borde v]?
¿tocando el color [#ff0000]?
¿tecla [espacio v] presionada?
preguntar [¿Cómo te llamás?] y esperar
respuesta</pre>
        <p class="guia-p"><strong>Operadores</strong> (verde #59C059) · <strong>Variables</strong> (naranja #FF8C1A) · <strong>Listas</strong> (#FF661A) · <strong>Lápiz</strong> (extensión)</p>
        <pre class="guia-pre">número aleatorio entre (1) y (10)
unir [manzana ] [banana ]
dar a [variable v] el valor (0)
sumar a [variable v] (1)
mostrar variable [variable v]
añadir [cosa] a [lista v]
bajar lápiz
subir lápiz
borrar todo
sellar</pre>

        <h4 class="guia-h">Fichas de micro:bit</h4>
        <p class="guia-p">Escribí el <strong>JavaScript de MakeCode</strong> (el de la pestaña JavaScript de
        makecode.microbit.org) y los bloques se dibujan solos con el servicio oficial de MakeCode
        (necesita internet). Elegís si la ficha muestra <strong>bloques, código o ambos</strong>.
        En Python se muestra el código tal cual.</p>

        <h4 class="guia-h">Fichas de código (Python, JavaScript, Java...)</h4>
        <p class="guia-p">Con <strong>"+ Ficha Código"</strong> pegás código de cualquier lenguaje de texto
        —Python, JavaScript, Java, C/C++, C#, HTML, CSS, SQL, PHP, Bash y más— y se colorea con
        <strong>resaltado de sintaxis</strong>: cada lenguaje con sus colores. El lenguaje se
        <strong>detecta automáticamente</strong> (o lo elegís a mano) y aparece etiquetado en la ficha.
        En el Word y en las preguntas para CREA el código va como imagen coloreada, igual que los bloques.</p>

        <h4 class="guia-h">Formato de texto para el lote</h4>
        <pre class="guia-pre">titulo: Práctico — Bucles
nivel: 6° año

=== FICHA: El gato rebota ===
consigna: Explicá qué hace el gato.
codigo:
al presionar bandera verde
mover (10) pasos
notas: Pista para el alumno.

=== FICHA: Corazón ===
tipo: microbit
muestra: ambos
codigo:
basic.showIcon(IconNames.Heart)</pre>
        <div class="guia-aviso">Consejo: el botón <strong>"Copiar como texto"</strong> (en Descargar) baja
        tus fichas actuales en este mismo formato — las editás en cualquier editor y las volvés a pegar.
        Con eso podés mantener bancos de fichas reutilizables.</div>

        <h4 class="guia-h">Probar el código y capturar el escenario</h4>
        <p class="guia-p">Cada ficha de Scratch tiene el botón <strong>"▶ Probar en el escenario"</strong>:
        el código se convierte en un proyecto real y corre en el <strong>motor oficial de Scratch 3.0</strong>,
        con el escenario apareciendo <strong>ahí mismo, debajo del código de la ficha</strong>, sin conexión. Ves al gato ejecutar el programa, con bandera verde, teclado,
        mouse y preguntas/respuestas. Con <strong>📸</strong> capturás el escenario en ese momento y la
        captura queda como <strong>imagen de la ficha</strong> (sale en el PDF, el Word y las preguntas de
        CREA). También podés descargar la captura o el <strong>.sb3</strong> para abrirlo en scratch.mit.edu.</p>
        <p class="guia-p">Las fichas de micro:bit tienen <strong>"▶ Simular en MakeCode"</strong>: debajo del código se abre el
        simulador oficial con tu programa ya corriendo (necesita internet). Con <strong>📸 Capturar y recortar</strong>
        el navegador te pide compartir la pestaña, saca la foto y te deja recortar el micro:bit — la imagen
        queda directamente en la ficha, igual que con Scratch.</p>
        <p class="guia-p">En el <strong>Asistente IA</strong> también podés apretar <strong>"📚 Elegir del catálogo"</strong>
        y marcar con qué personajes y fondo querés las fichas: el prompt sale con esos nombres como obligatorios,
        así la IA arma las actividades exactamente con los personajes que elegiste.</p>
        <div class="guia-aviso">El simulador de Scratch cubre los bloques más comunes de aula (movimiento,
        apariencia, control, sensores, operadores, variables, lápiz, sonido). Si un bloque no se puede
        simular, te lo avisa y sigue con el resto.</div>

        <h4 class="guia-h">Varios personajes y fondo del escenario</h4>
        <p class="guia-p">Dentro del código de una ficha Scratch podés programar <strong>varios
        personajes</strong> y elegir el <strong>fondo</strong>, con estas líneas:</p>
        <pre class="guia-pre">fondo: Estrellas

personaje: Gato
al presionar bandera verde
por siempre
  mover (10) pasos
fin

personaje: Perro
al presionar bandera verde
decir [¡Guau!] durante (2) segundos</pre>
        <ul class="guia-lista">
          <li><strong>Personajes disponibles:</strong> Gato, Perro, Oso, Rana, Pelota, Mariposa, Dinosaurio, Cangrejo, Pingüino, Ratón, Murciélago, Pez, Erizo.</li>
          <li><strong>Fondos disponibles:</strong> Cielo, Fondo de mar, Estrellas, Ciudad de noche, Cancha de fútbol, Granja.</li>
          <li>Esos 13 personajes y 6 fondos están guardados en la página y andan <strong>sin internet</strong>.</li>
          <li>Además, con conexión podés usar <strong>toda la biblioteca oficial de Scratch</strong> (339 personajes y 85 fondos): abrí el botón <strong>"📚 Catálogo de Scratch"</strong> de la ficha, buscá por nombre (en inglés, como en Scratch: Abby, Dragon, Shark 2…) y un clic inserta la línea en tu código. El dibujo se descarga solo al simular o exportar.</li>
          <li>Sin encabezados "personaje:", todo el código es del Gato, como siempre.</li>
          <li>En la ficha impresa cada personaje aparece con su nombre arriba de sus bloques, y el simulador crea todos los personajes en el escenario con el fondo elegido.</li>
        </ul>

        <h4 class="guia-h">Guías paso a paso (tutoriales de juegos)</h4>
        <p class="guia-p">En el Paso 1, cambiá <strong>"Tipo de documento"</strong> a
        <strong>"Guía paso a paso"</strong>: las fichas pasan a numerarse como <strong>PASO 1, PASO 2…</strong>
        y el documento se vuelve un tutorial donde cada paso construye una parte de un mismo juego.
        Cada paso puede llevar un recuadro de <strong>Teoría</strong> (el concepto que se aprende),
        la consigna, el código nuevo del paso (con sus personajes) y una captura del escenario.</p>
        <p class="guia-p">El <strong>Asistente IA</strong> tiene la opción de actividad
        <strong>"Guía paso a paso (tutorial de un juego completo)"</strong>: describís el juego
        (ej: "atrapar a la mariposa con el gato") y la IA genera todos los pasos de una vez, con teoría,
        código por personaje y dificultad creciente. Pegás la respuesta y queda el tutorial armado.</p>

        <h4 class="guia-h">Apartado teórico en las fichas</h4>
        <p class="guia-p">Toda ficha tiene el campo <strong>"Teoría / explicación previa"</strong>: un
        recuadro destacado que aparece antes de la consigna, para explicar el concepto antes de
        ejercitar. Sale en el PDF, el Word y se puede combinar con las capturas del simulador.
        En el formato de texto en lote es la clave <code>teoria:</code>.</p>

        <h4 class="guia-h">Convertir las fichas en cuestionario para CREA</h4>
        <p class="guia-p">En el <strong>Paso 4</strong> de la página de fichas, tus fichas se convierten en un
        cuestionario donde <strong>la imagen de los bloques es parte del enunciado</strong> de cada pregunta:</p>
        <ul class="guia-lista">
          <li><strong>Cuestionario automático</strong> — una pregunta de comprensión por ficha (imagen + consigna), se abre directo en el Editor.</li>
          <li><strong>Preguntas variadas con IA</strong> — la IA arma opción múltiple, V/F, respuesta corta y ensayo citando las imágenes; pegás la respuesta y se abre en el Editor con todo asociado.</li>
        </ul>
        <p class="guia-p">En el Editor podés mezclar esas preguntas con otras tuyas, y al descargar el
        <code>.imscc</code> las imágenes de bloques viajan adentro del paquete: en CREA, Schoology o Moodle
        el alumno ve los bloques dentro de la pregunta.</p>
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
