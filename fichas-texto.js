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

const RE_SEPARADOR = /^===\s*FICHA\s*:?\s*(.*?)\s*=*\s*$/i;
const RE_CLAVE = /^(tipo|versi[oó]n|version|lenguaje|muestra|vista|consigna|c[oó]digo|codigo|notas|ep[ií]grafe|epigrafe)\s*:\s*(.*)$/i;
const CLAVES_MULTILINEA = ['consigna', 'codigo', 'notas'];

function normalizarClave(k) {
  const c = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (c === 'version') return 'version';
  if (c === 'codigo') return 'codigo';
  if (c === 'vista') return 'muestra';
  if (c === 'epigrafe') return 'epigrafe';
  return c;
}

export function parsearFichasTexto(texto) {
  const lineas = texto.replace(/\r\n?/g, '\n').split('\n');
  const doc = { titulo: '', subtitulo: '' };
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
      const m = linea.match(/^(t[ií]tulo|titulo|nivel|grupo)\s*:\s*(.*)$/i);
      if (m) {
        const k = normalizarClave(m[1]);
        if (k === 'titulo') doc.titulo = m[2].trim();
        else doc.subtitulo = m[2].trim();
      } else if (linea.trim()) {
        avisos.push(`Se ignoró texto fuera de las fichas: "${linea.trim().slice(0, 50)}"`);
      }
      continue;
    }

    const clave = linea.match(RE_CLAVE);
    // dentro de "codigo:" solo cortan las claves que no pueden ser código
    const esCorte = clave && (claveAbierta !== 'codigo' || /^(notas|consigna|tipo|versi|lenguaje|muestra|vista|ep[ií]grafe)/i.test(clave[1]));

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
    const tipo = /micro/i.test(f.tipo || '') ? 'microbit' : 'scratch';
    const ficha = {
      tipo,
      titulo: (f.titulo || '').trim(),
      consigna: (f.consigna || '').trim(),
      codigo: (f.codigo || '').replace(/\s+$/, ''),
      notas: (f.notas || '').trim(),
      epigrafe: (f.epigrafe || '').trim()
    };
    if (tipo === 'scratch') {
      const v = (f.version || '').toLowerCase();
      ficha.estilo = /2/.test(v) ? 'scratch2' : (/(alto|contrast)/.test(v) ? 'scratch3-high-contrast' : 'scratch3');
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

  return { titulo: doc.titulo, subtitulo: doc.subtitulo, fichas: resultado, avisos };
}

// Exporta el estado actual al mismo formato de texto (ida y vuelta):
// editás el texto donde quieras y lo volvés a importar.
export function fichasComoTexto(state) {
  const out = [];
  if (state.titulo.trim()) out.push('titulo: ' + state.titulo.trim());
  if (state.subtitulo.trim()) out.push('nivel: ' + state.subtitulo.trim());
  if (out.length) out.push('');

  state.fichas.forEach(f => {
    out.push(`=== FICHA: ${f.titulo || ''} ===`.replace(':  =', ' ='));
    if (f.tipo === 'microbit') {
      out.push('tipo: microbit');
      if (f.lenguaje === 'python') out.push('lenguaje: python');
      if (f.vista && f.vista !== 'bloques') out.push('muestra: ' + f.vista);
    } else if (f.estilo && f.estilo !== 'scratch3') {
      out.push('version: ' + (f.estilo === 'scratch2' ? 'scratch2' : 'alto contraste'));
    }
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
export function generarPromptFichas({ tema, nivel, cantidad, plataforma, enfoque, notas }) {
  const plataformaTexto = {
    scratch: 'Scratch (todas las fichas con tipo: scratch)',
    microbit: 'micro:bit con MakeCode (todas las fichas con tipo: microbit)',
    mixto: 'mezclá fichas de Scratch (tipo: scratch) y de micro:bit (tipo: microbit)'
  }[plataforma] || 'Scratch';

  const enfoqueTexto = {
    lectura: 'Lectura de código: mostrar un programa y pedir que el alumno explique o prediga qué hace.',
    error: 'Encontrar el error: el código tiene UN error deliberado; la consigna pide encontrarlo y en "notas:" va la solución para el docente.',
    completar: 'Completar: el programa está incompleto o tiene un valor a ajustar; la consigna dice qué debe lograr.',
    crear: 'Desafío de creación: la consigna pide crear un programa; el código de la ficha es un ejemplo de solución o punto de partida.',
    mixto: 'Variá el enfoque entre las fichas: leer y predecir, encontrar el error, completar y desafíos de creación.'
  }[enfoque] || '';

  let prompt = `Sos docente de programación. Generá ${cantidad} fichas didácticas de trabajo con estas características:

- **Tema:** ${tema}
- **Nivel/Grupo:** ${nivel || 'No especificado'}
- **Plataforma:** ${plataformaTexto}
- **Tipo de actividad:** ${enfoqueTexto}`;
  if (notas) prompt += `\n- **Indicaciones extra:** ${notas}`;

  prompt += `

Respondé SOLO con las fichas en el formato de abajo, sin texto antes ni después, sin bloques de código markdown.

## FORMATO REQUERIDO

titulo: [título del documento]
nivel: ${nivel || '[nivel]'}

=== FICHA: [título corto de la ficha] ===
tipo: scratch
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
Escribí el código en sintaxis "scratchblocks" en español, un bloque por línea, tal como se lee en Scratch:
- Números entre paréntesis: mover (10) pasos. Textos entre corchetes: decir [¡Hola!]. Desplegables con [v]: al presionar tecla [espacio v]
- Condiciones entre ángulos: si <¿tocando [borde v]?> entonces
- Los bloques "si", "repetir", "por siempre" cierran con una línea "fin"
- Usá EXACTAMENTE estas redacciones (un texto distinto se dibuja como bloque rojo inválido):
  al presionar bandera verde / al presionar tecla [espacio v] / al hacer clic en este objeto
  mover (10) pasos / girar a la derecha (15) grados / apuntar en dirección (90) / ir a x: (0) y: (0) / si toca un borde, rebotar
  decir [Hola] durante (2) segundos / pensar [Hmm...] durante (2) segundos / cambiar disfraz a [disfraz2 v] / esconder / mostrar
  iniciar sonido [Miau v] / esperar (1) segundos / repetir (10) / por siempre / si <¿tocando [borde v]?> entonces
  dar a [puntaje v] el valor (0) / sumar a [puntaje v] (1) / número aleatorio entre (1) y (10) / preguntar [...] y esperar / respuesta

## REGLAS DEL CÓDIGO MICRO:BIT (tipo: microbit)
Escribí JavaScript de MakeCode que compile en makecode.microbit.org:
- API típica: basic.showString("..."), basic.showIcon(IconNames.Heart), basic.showNumber(...), basic.pause(500), basic.clearScreen(), input.onButtonPressed(Button.A, function () {...}), basic.forever(function () {...}), input.onGesture(Gesture.Shake, ...), music.playTone(...)
- Podés agregar la línea "muestra: ambos" para que la ficha muestre bloques y código, o "muestra: codigo" para solo código.

## REGLAS GENERALES
- Cada ficha empieza EXACTAMENTE con === FICHA: Título ===
- Programas cortos (4 a 12 bloques/líneas), adecuados al nivel indicado.
- Consignas claras, en español rioplatense (voseo).
- La dificultad debe ir creciendo de la primera ficha a la última.`;

  return prompt;
}
