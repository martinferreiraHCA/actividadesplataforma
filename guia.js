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

        <h4 class="guia-h">1 · Crear fichas (cuatro formas)</h4>
        <ul class="guia-lista">
          <li><strong>A mano</strong> — "+ Ficha Scratch", "+ Ficha micro:bit" o "+ Ficha Código".</li>
          <li><strong>Con plantilla</strong> — un clic en "Leer y predecir", "Encontrar el error", "Completar" o "Desafío".</li>
          <li><strong>En lote desde texto</strong> — un solo texto crea muchas fichas (pestaña <em>Importar Texto</em>).</li>
          <li><strong>Con IA</strong> — completás tema, cantidad y tipo de actividad; el prompt vuelve como fichas editables.</li>
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
          <li><strong>micro:bit</strong> — botón "▶ Simular en MakeCode": el simulador oficial aparece bajo el código con tu programa corriendo (necesita internet; crea un enlace compartido anónimo de MakeCode). <strong>📸 Capturar y recortar</strong>: compartís la pestaña, recortás el micro:bit y la imagen queda en la ficha.</li>
          <li>Cualquier imagen de una ficha se puede reeditar con <strong>"✂ Recortar / zoom"</strong>.</li>
        </ul>

        <h4 class="guia-h">5 · Teoría y guías paso a paso</h4>
        <ul class="guia-lista">
          <li>Cada ficha tiene el campo <strong>"Teoría"</strong>: un recuadro destacado antes de la consigna para explicar el concepto. Sale en PDF, Word y el formato de texto (<code>teoria:</code>).</li>
          <li>En el Paso 1, <strong>"Tipo de documento → Guía paso a paso"</strong> convierte las fichas en <strong>PASO 1, PASO 2…</strong> de un mismo proyecto: ideal para tutoriales de juegos completos. El Asistente IA tiene la opción <strong>"Guía paso a paso (tutorial de un juego completo)"</strong> que genera todos los pasos de una vez, con teoría y código por personaje.</li>
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
          <li><strong>Cuestionario para CREA</strong> (Paso 4) — cada pregunta lleva la <strong>imagen de los bloques en el enunciado</strong>: automático (una pregunta por ficha) o variado con IA. Se abre en el Editor y de ahí sale el <code>.imscc</code> con las imágenes adentro.</li>
          <li><strong>Borrador .json</strong> — para retomar otro día (además se autoguarda en el navegador).</li>
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
