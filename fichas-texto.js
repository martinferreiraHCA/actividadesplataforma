// Formato de texto plano para crear fichas en lote (importar, exportar y prompt de IA).
//
// El formato:
//
//   titulo: Práctico 3 — Bucles          <- opcional, datos del documento
//   nivel: 6° año                        <- opcional
//
//   === FICHA: El gato rebota ===
//   tipo: scratch                        <- scratch (por defecto) | microbit
//   version: scratch3                    <- solo scratch: scratch3 | scratch2 | alto contraste
//   consigna: Leé el programa y explicá qué hace.
//   codigo:
//   al presionar bandera verde
//   por siempre
//     mover (10) pasos
//   fin
//   notas: Pista: mirá qué pasa en el borde.
//
//   === FICHA: Corazón que late ===
//   tipo: microbit
//   lenguaje: javascript                 <- solo microbit: javascript | python
//   muestra: ambos                       <- solo microbit: bloques | codigo | ambos
//   codigo:
//   basic.forever(function () {
//       basic.showIcon(IconNames.Heart)
//   })

const RE_SEPARADOR = /^\s*[=#\-]{2,}\s*(?:FICHA|PASO)\s*\d*\s*:?\s*(.*?)[\s=#\-]*$/i;
const RE_CLAVE = /^(tipo|versi[oó]n|version|lenguaje|muestra|vista|teor[ií]a|teoria|consigna|c[oó]digo|codigo|notas|ep[ií]grafe|epigrafe)\s*:\s*(.*)$/i;
const CLAVES_MULTILINEA = ['teoria', 'consigna', 'codigo', 'notas'];

// mapea nombres comunes de lenguaje al id que usa el resaltador
function normalizarLenguajeCodigo(v) {
  const s = (v || '').toLowerCase().trim();
  if (!s || s === 'auto') return 'auto';
  const mapa = {
    'python': 'python', 'py': 'python',
    'javascript': 'javascript', 'js': 'javascript',
    'typescript': 'typescript', 'ts': 'typescript',
    'java': 'java', 'c': 'c', 'c++': 'cpp', 'cpp': 'cpp', 'c#': 'csharp', 'csharp': 'csharp',
    'html': 'xml', 'xml': 'xml', 'css': 'css', 'sql': 'sql', 'php': 'php',
    'bash': 'bash', 'shell': 'bash', 'terminal': 'bash', 'json': 'json',
    'ruby': 'ruby', 'go': 'go', 'lua': 'lua', 'texto': 'plaintext', 'plaintext': 'plaintext'
  };
  return mapa[s] || 'auto';
}

function normalizarClave(k) {
  const c = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (c === 'version') return 'version';
  if (c === 'codigo') return 'codigo';
  if (c === 'vista') return 'muestra';
  if (c === 'teoria') return 'teoria';
  if (c === 'epigrafe') return 'epigrafe';
  return c;
}

export function parsearFichasTexto(texto) {
  // Robustez ante respuestas de IA: se quitan los cercos de código markdown
  // (```), y si hay charla antes del contenido ("Aquí tienes las fichas..."),
  // se descarta todo lo anterior a la primera línea reconocible.
  let lineas = String(texto || '').replace(/\r\n?/g, '\n').split('\n')
    .filter(l => !/^\s*```/.test(l));
  const primera = lineas.findIndex(l =>
    RE_SEPARADOR.test(l) || /^\s*(t[ií]tulo|nivel|grupo|modo|descripci[oó]n|din[aá]mica)\s*:/i.test(l));
  if (primera > 0) lineas = lineas.slice(primera);
  const doc = { titulo: '', subtitulo: '', modo: null, descripcion: '' };
  let docDescAbierta = false;
  const fichas = [];
  const avisos = [];

  let actual = null;          // ficha en construcción (objeto de campos crudos)
  let claveAbierta = null;    // clave multilínea que sigue acumulando
  let buffer = [];

  const cerrarClave = () => {
    if (actual && claveAbierta) {
      actual[claveAbierta] = ((actual[claveAbierta] || '') + '\n' + buffer.join('\n')).replace(/^\n/, '').replace(/\s+$/, '');
    }
    claveAbierta = null;
    buffer = [];
  };
  const cerrarFicha = () => {
    cerrarClave();
    if (actual) fichas.push(actual);
    actual = null;
  };

  for (const lineaRaw of lineas) {
    const linea = lineaRaw.replace(/\s+$/, '');

    const sep = linea.match(RE_SEPARADOR);
    if (sep) {
      cerrarFicha();
      actual = { titulo: sep[1] || '' };
      continue;
    }

    if (!actual) {
      // antes de la primera ficha: datos del documento
      const m = linea.match(/^(t[ií]tulo|titulo|nivel|grupo|modo|descripci[oó]n|din[aá]mica)\s*:\s*(.*)$/i);
      if (m) {
        const k = normalizarClave(m[1]);
        docDescAbierta = false;
        if (k === 'titulo') doc.titulo = m[2].trim();
        else if (k === 'modo') doc.modo = /gu[ií]a|tutorial|paso/i.test(m[2]) ? 'guia' : 'fichas';
        else if (k === 'descripcion' || k === 'dinamica') { doc.descripcion = m[2].trim(); docDescAbierta = true; }
        else doc.subtitulo = m[2].trim();
      } else if (linea.trim() && docDescAbierta) {
        // la descripción puede seguir en varias líneas, hasta una línea vacía
        doc.descripcion += '\n' + linea.trim();
      } else if (linea.trim()) {
        avisos.push(`Se ignoró texto fuera de las fichas: "${linea.trim().slice(0, 50)}"`);
      } else {
        docDescAbierta = false;
      }
      continue;
    }

    const clave = linea.match(RE_CLAVE);
    // dentro de "codigo:" solo cortan las claves que no pueden ser código
    const esCorte = clave && (claveAbierta !== 'codigo' || /^(notas|consigna|teor|tipo|versi|lenguaje|muestra|vista|ep[ií]grafe)/i.test(clave[1]));

    if (esCorte) {
      cerrarClave();
      const k = normalizarClave(clave[1]);
      const v = clave[2];
      if (CLAVES_MULTILINEA.includes(k)) {
        claveAbierta = k;
        actual[k] = v;
        buffer = [];
      } else {
        actual[k] = v.trim();
      }
    } else if (claveAbierta) {
      buffer.push(lineaRaw.replace(/\r/g, ''));
    } else if (linea.trim()) {
      // texto suelto dentro de la ficha sin clave: lo tratamos como consigna
      claveAbierta = 'consigna';
      actual.consigna = linea.trim();
      buffer = [];
    }
  }
  cerrarFicha();

  // convertir campos crudos al modelo de ficha
  const resultado = fichas.map((f, i) => {
    const tipoRaw = f.tipo || '';
    const tipo = /micro/i.test(tipoRaw) ? 'microbit'
      : (/cod|texto|python|java|lenguaje/i.test(tipoRaw) ? 'codigo' : 'scratch');
    const ficha = {
      tipo,
      titulo: (f.titulo || '').trim(),
      teoria: (f.teoria || '').trim(),
      consigna: (f.consigna || '').trim(),
      codigo: (f.codigo || '').replace(/\s+$/, ''),
      notas: (f.notas || '').trim(),
      epigrafe: (f.epigrafe || '').trim()
    };
    if (tipo === 'scratch') {
      const v = (f.version || '').toLowerCase();
      ficha.estilo = /2/.test(v) ? 'scratch2' : (/(alto|contrast)/.test(v) ? 'scratch3-high-contrast' : 'scratch3');
    } else if (tipo === 'codigo') {
      ficha.lenguaje = normalizarLenguajeCodigo(f.lenguaje);
    } else {
      ficha.lenguaje = /py/i.test(f.lenguaje || '') ? 'python' : 'javascript';
      const m = (f.muestra || '').toLowerCase();
      ficha.vista = /ambos|both/.test(m) ? 'ambos' : (/cod/.test(m) ? 'codigo' : 'bloques');
    }
    if (!ficha.codigo && !ficha.consigna) {
      avisos.push(`La ficha ${i + 1}${ficha.titulo ? ' ("' + ficha.titulo + '")' : ''} quedó vacía (sin código ni consigna).`);
    }
    return ficha;
  });

  if (!resultado.length) {
    avisos.push('No se encontró ninguna ficha. Cada ficha empieza con una línea "=== FICHA: Título ===".');
  }

  return { titulo: doc.titulo, subtitulo: doc.subtitulo, descripcion: doc.descripcion.trim(), modo: doc.modo, fichas: resultado, avisos };
}

// Exporta el estado actual al mismo formato de texto (ida y vuelta):
// editás el texto donde quieras y lo volvés a importar.
export function fichasComoTexto(state) {
  const out = [];
  if (state.titulo.trim()) out.push('titulo: ' + state.titulo.trim());
  if ((state.descripcion || '').trim()) out.push('descripcion: ' + state.descripcion.trim().replace(/\n+/g, ' '));
  if (state.subtitulo.trim()) out.push('nivel: ' + state.subtitulo.trim());
  if (state.opciones && state.opciones.modo === 'guia') out.push('modo: guia');
  if (out.length) out.push('');

  state.fichas.forEach(f => {
    out.push(`=== FICHA: ${f.titulo || ''} ===`.replace(':  =', ' ='));
    if (f.tipo === 'microbit') {
      out.push('tipo: microbit');
      if (f.lenguaje === 'python') out.push('lenguaje: python');
      if (f.vista && f.vista !== 'bloques') out.push('muestra: ' + f.vista);
    } else if (f.tipo === 'codigo') {
      out.push('tipo: codigo');
      if (f.lenguaje && f.lenguaje !== 'auto') out.push('lenguaje: ' + f.lenguaje);
    } else if (f.estilo && f.estilo !== 'scratch3') {
      out.push('version: ' + (f.estilo === 'scratch2' ? 'scratch2' : 'alto contraste'));
    }
    if ((f.teoria || '').trim()) out.push('teoria: ' + f.teoria.trim());
    if (f.consigna.trim()) out.push('consigna: ' + f.consigna.trim());
    if (f.codigo.trim()) {
      out.push('codigo:');
      out.push(f.codigo.replace(/\s+$/, ''));
    }
    if (f.notas.trim()) out.push('notas: ' + f.notas.trim());
    if (f.epigrafe && f.epigrafe.trim()) out.push('epigrafe: ' + f.epigrafe.trim());
    out.push('');
  });
  return out.join('\n').trim() + '\n';
}

export const EJEMPLO_FICHAS_TEXTO = `titulo: Práctico — Bucles y eventos
descripcion: Vamos a explorar cómo los programas repiten acciones. Primero leemos código de Scratch para predecir qué hace, y después probamos lo mismo en la micro:bit.
nivel: 6° año

=== FICHA: El gato rebota ===
tipo: scratch
consigna: Leé el programa y explicá con tus palabras qué hace el gato.
codigo:
al presionar bandera verde
por siempre
  mover (10) pasos
  si <¿tocando [borde v]?> entonces
    girar a la derecha (180) grados
  fin
fin
notas: Pista: fijate qué pasa cuando llega al borde.

=== FICHA: Corazón que late ===
tipo: microbit
muestra: ambos
consigna: ¿Cada cuánto tiempo se prende y se apaga el corazón?
codigo:
basic.forever(function () {
    basic.showIcon(IconNames.Heart)
    basic.pause(500)
    basic.clearScreen()
    basic.pause(500)
})
`;

// ============================================================
// Prompt para que una IA genere fichas en este formato
// ============================================================
export function generarPromptFichas({ tema, nivel, cantidad, plataforma, enfoque, notas, catalogo, infantil }) {
  const plataformaTexto = {
    scratch: 'Scratch (todas las fichas con tipo: scratch)',
    microbit: 'micro:bit con MakeCode (todas las fichas con tipo: microbit)',
    codigo: 'código en texto plano (todas las fichas con tipo: codigo — Python salvo que el tema pida otro lenguaje)',
    mixto: 'mezclá fichas de Scratch (tipo: scratch), de micro:bit (tipo: microbit) y de código en texto plano (tipo: codigo) según convenga al tema'
  }[plataforma] || 'Scratch';

  const enfoqueTexto = {
    guia: 'GUÍA PASO A PASO (tutorial): los ítems NO son ejercicios sueltos sino PASOS ordenados para construir UN MISMO proyecto completo (en Scratch un juego; en micro:bit un proyecto con la placa, ej. un contador, un dado, un juego con los botones; en código de texto un programa que crece paso a paso). Cada paso agrega una parte, con "teoria:" explicando el concepto del paso y "codigo:" con el código NUEVO de ese paso. En Scratch, el código de CADA paso empieza con "personaje: Nombre" para que quede claro A QUIÉN se le ponen los bloques, y la consigna dice DÓNDE va lo nuevo ("agregale al Gato estos bloques, debajo de los que ya tiene", "creá este código nuevo en el Perro"...) y qué debería pasar al probarlo. El último paso deja el proyecto terminado y funcionando.',
    lectura: 'Lectura de código: mostrar un programa y pedir que el alumno explique o prediga qué hace.',
    error: 'Encontrar el error: el código tiene UN error deliberado; la consigna pide encontrarlo y en "notas:" va la solución para el docente.',
    completar: 'Completar: el programa está incompleto o tiene un valor a ajustar; la consigna dice qué debe lograr.',
    crear: 'Desafío de creación: la consigna pide crear un programa; el código de la ficha es un ejemplo de solución o punto de partida.',
    mixto: 'Variá el enfoque entre las fichas: leer y predecir, encontrar el error, completar y desafíos de creación.'
  }[enfoque] || '';

  const cuantas = cantidad
    ? `${cantidad} fichas didácticas de trabajo`
    : (enfoque === 'guia'
      ? 'una guía con LOS PASOS QUE HAGAN FALTA (decidí vos la cantidad: pasos chicos y claros, los necesarios para que el proyecto quede completo, sin relleno)'
      : 'LAS FICHAS QUE HAGAN FALTA (decidí vos la cantidad: las necesarias para cubrir bien el tema, sin relleno)');
  let prompt = `Sos docente de programación. Generá ${cuantas} con estas características:

- **Tema:** ${tema}
- **Nivel/Grupo:** ${nivel || 'No especificado'}
- **Plataforma:** ${plataformaTexto}
- **Tipo de actividad:** ${enfoqueTexto}`;
  if (notas) prompt += `\n- **Indicaciones extra:** ${notas}`;
  if (infantil) {
    prompt += `\n- **Destinatarios: NIÑOS DE ESCUELA PRIMARIA.** Escribí para que un niño pueda seguir la guía SOLO, sin ayuda del docente:
  - Lenguaje MUY simple y directo, frases cortas, vocabulario cotidiano. Hablale al niño con tono alegre y motivador ("¡Vas muy bien!", "¡Ahora viene lo más divertido!").
  - Pasos chiquitos: UNA sola idea o acción por ficha. Mejor muchas fichas cortas que pocas largas.
  - En "teoria:" explicá el concepto con una comparación de la vida diaria (una receta, un semáforo, un juego) en 1 o 2 frases.
  - En "consigna:" decí exactamente qué hacer y qué va a pasar cuando lo logre, para que pueda comprobarlo solo.
  - En "notas:" agregá una pista simpática o un mini desafío extra ("¿Y si probás con otro número?").
  - Evitá tecnicismos; si un término es inevitable (bucle, variable), explicalo la primera vez con palabras de niño.
  - OJO: lo simple es el TEXTO, no el código. Cada ficha lleva IGUAL su bloque "codigo:" con código REAL y válido según las reglas de abajo (el código se dibuja como bloques de colores para el niño; sin "codigo:" la ficha queda vacía).`;
  }
  if (catalogo && catalogo.personajes && catalogo.personajes.length) {
    prompt += `\n- **Personajes elegidos por el docente (usalos, son OBLIGATORIOS):** ${catalogo.personajes.join(', ')}`;
  }
  if (catalogo && catalogo.fondo) {
    prompt += `\n- **Fondo del escenario elegido (usalo en las fichas con "fondo: ${catalogo.fondo}"):** ${catalogo.fondo}`;
  }

  prompt += `

MUY IMPORTANTE: tu respuesta la va a leer un PROGRAMA automático (un parser), no una persona. Cualquier desvío del formato rompe la importación. Respondé SOLO con las fichas en el formato de abajo: sin saludo, sin explicación antes ni después, sin cercos de código markdown (\`\`\`), empezando directo con la línea "titulo:".

## FORMATO REQUERIDO

titulo: [título del documento]
nivel: ${nivel || '[nivel]'}
descripcion: [2 o 3 frases para el alumno: qué se va a construir y cómo es la dinámica de juego — qué hace el jugador, qué pasa al jugar, cómo se gana o qué se logra]${enfoque === 'guia' ? '\nmodo: guia' : ''}

=== FICHA: [título corto de la ficha o del paso] ===
tipo: scratch
teoria: [opcional: explicación teórica breve del concepto, antes de la consigna]
consigna: [la consigna para el alumno, 1 a 3 oraciones]
codigo:
[el código]
notas: [opcional: pista para el alumno o solución para el docente]

=== FICHA: [otra ficha] ===
tipo: microbit
muestra: ambos
consigna: [...]
codigo:
[...]

## REGLAS DEL CÓDIGO SCRATCH (tipo: scratch)
Escribí el código en sintaxis "scratchblocks" en español, un bloque por línea, tal como se lee en Scratch (se aceptan las redacciones de Scratch tanto en español de España como en español latinoamericano, ej: "al presionar bandera" y "al hacer clic en la bandera" valen las dos):
- Números entre paréntesis: mover (10) pasos. Textos entre corchetes: decir [¡Hola!]. Desplegables con [v]: al presionar tecla [espacio v]
- Condiciones entre ángulos: si <¿tocando [borde v]?> entonces
- Los bloques "si", "repetir", "por siempre" cierran con una línea "fin"
- NO inventes redacciones: si un bloque no está en esta lista y no estás seguro de su texto exacto en Scratch, resolvelo con bloques de la lista. Un texto distinto se dibuja como bloque rojo inválido. Redacciones verificadas:
  al presionar bandera verde / al presionar tecla [espacio v] / al hacer clic en este objeto
  mover (10) pasos / girar a la derecha (15) grados / apuntar en dirección (90) / ir a x: (0) y: (0) / si toca un borde, rebotar
  decir [Hola] durante (2) segundos / pensar [Hmm...] durante (2) segundos / cambiar disfraz a [disfraz2 v] / esconder / mostrar
  iniciar sonido [Miau v] / esperar (1) segundos / repetir (10) / por siempre / si <¿tocando [borde v]?> entonces
  dar a [puntaje v] el valor (0) / sumar a [puntaje v] (1) / número aleatorio entre (1) y (10) / preguntar [...] y esperar / respuesta

## PERSONAJES Y FONDO EN SCRATCH (opcional)
Dentro de "codigo:" podés usar varios personajes y elegir el fondo del escenario:
  fondo: Estrellas
  personaje: Gato
  al presionar bandera verde
  ...
  personaje: Perro
  ...
- Personajes recomendados (funcionan siempre, usá EXACTAMENTE estos nombres): Gato, Perro, Oso, Rana, Pelota, Mariposa, Dinosaurio, Cangrejo, Pingüino, Ratón, Murciélago, Pez, Erizo.
- Fondos recomendados: Cielo, Fondo de mar, Estrellas, Ciudad de noche, Cancha de fútbol, Granja.
- También se acepta cualquier personaje o fondo de la biblioteca oficial de Scratch por su nombre EXACTO en inglés (ej: Shark 2, Dragon, Beach Malibu) — preferí los recomendados salvo que el tema pida otro.
- Si el docente eligió personajes y/o fondo (arriba), usá EXACTAMENTE esos, escribiendo "personaje: Nombre" para cada uno y "fondo: Nombre".
- Empezá SIEMPRE el código con su línea "personaje: ..." aunque haya un solo personaje: la ficha muestra automáticamente el dibujo del personaje en la esquina, y así el alumno ve a quién está programando.
- Sin encabezados "personaje:", todo el código es del Gato.

## REGLAS DEL CÓDIGO MICRO:BIT (tipo: microbit)
Escribí JavaScript de MakeCode que compile en makecode.microbit.org:
- API típica: basic.showString("..."), basic.showIcon(IconNames.Heart), basic.showNumber(...), basic.pause(500), basic.clearScreen(), input.onButtonPressed(Button.A, function () {...}), basic.forever(function () {...}), input.onGesture(Gesture.Shake, ...), music.playTone(...)
- El código debe COMPILAR en makecode.microbit.org tal cual: declarar variables con "let", callbacks con "function () { ... }", sin librerías externas ni APIs inventadas.
- Podés agregar la línea "muestra: ambos" para que la ficha muestre bloques y código, o "muestra: codigo" para solo código.

## REGLAS DEL CÓDIGO EN TEXTO PLANO (tipo: codigo)
Para lenguajes de texto (Python, JavaScript, Java, C, C++, C#, HTML, CSS, SQL, PHP, Bash...):
- Agregá la línea "lenguaje: python" (o javascript, java, cpp, sql...) después de "tipo: codigo" — así la ficha se colorea con la sintaxis correcta.
- Código simple y didáctico, con nombres de variables en español, sin librerías raras.

## REGLAS GENERALES
- Cada ficha empieza EXACTAMENTE con === FICHA: Título ===
- Programas cortos (4 a 12 bloques/líneas), adecuados al nivel indicado.
- Consignas claras, en español rioplatense (voseo).
- La dificultad debe ir creciendo de la primera ficha a la última.
- El código debe ser DIDÁCTICO y SECUENCIAL: los bloques aparecen en el orden en que el alumno los construye, y en Scratch cada tanda de bloques va bajo su "personaje: Nombre" para que quede claro a quién pertenece. Si una ficha agrega código a algo ya hecho, la consigna lo dice explícitamente ("agregá esto al código del Gato").

## ANTES DE RESPONDER, VERIFICÁ ESTA LISTA
1. La respuesta empieza directo con "titulo:" — sin saludo, sin \`\`\`, sin comentarios.
2. Cada ficha empieza EXACTAMENTE con: === FICHA: Título ===
3. NINGUNA ficha quedó sin "codigo:" (nunca vacío, nunca "..." ni pseudocódigo).
4. En Scratch: cada línea coincide letra por letra con una redacción de la lista; los números van entre paréntesis (10), los textos entre corchetes [hola], los desplegables terminan en v]; cada "repetir", "por siempre" y "si ... entonces" cierra con su línea "fin"; el código empieza con "personaje: ...".
5. En micro:bit: el código compila tal cual en MakeCode.
6. En tipo codigo: está la línea "lenguaje: ...".
7. Se cumple la cantidad de fichas pedida y la dificultad crece de la primera a la última.`;

  return prompt;
}
