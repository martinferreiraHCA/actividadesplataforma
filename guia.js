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
        <p class="guia-p">Sí, con el selector de temas arriba a la derecha (claro, nocturno, amigable, HCA).</p>
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
    document.querySelectorAll("[data-abrir-guia]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        abrir(btn.getAttribute("data-abrir-guia") || null);
      });
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
