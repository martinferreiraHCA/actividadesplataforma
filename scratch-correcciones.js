// Correcciones inteligentes para código Scratch en texto plano.
// Cuando un bloque queda rojo (texto que no coincide con ningún bloque real),
// estas reglas proponen la redacción correcta verificada en español.

// Reglas directas: [patrón, reemplazo]. Se aplican sobre la línea completa.
const REGLAS = [
  // giros: falta "a la derecha / a la izquierda"
  [/\bgirar\s+(\([^)]*\))\s*grados/gi, 'girar a la derecha $1 grados'],
  [/\bgirar\s+derecha\s+(\([^)]*\))\s*grados/gi, 'girar a la derecha $1 grados'],
  [/\bgirar\s+izquierda\s+(\([^)]*\))\s*grados/gi, 'girar a la izquierda $1 grados'],
  // decir/pensar: "por (N) segundos" -> "durante (N) segundos"
  [/\b(decir|pensar)\s+(\[[^\]]*\]|\([^)]*\))\s+por\s+(\([^)]*\))\s*segundos?/gi, '$1 $2 durante $3 segundos'],
  // variables: "cambiar [x] por (n)" -> "sumar a [x] (n)"
  [/\bcambiar\s+(\[[^\]]*v\s*\])\s+por\s+(\([^)]*\))/gi, 'sumar a $1 $2'],
  // variables: "fijar [x] a (n)" -> "dar a [x] el valor (n)"
  [/\bfijar\s+(\[[^\]]*v\s*\])\s+a\s+(\([^)]*\))/gi, 'dar a $1 el valor $2'],
  // tamaño: "fijar tamaño a (n) %" -> "fijar tamaño al (n) %"
  [/\bfijar\s+(?:el\s+)?tamaño\s+a\s+(\([^)]*\))\s*%?/gi, 'fijar tamaño al $1 %'],
  // efectos: "cambiar (el) efecto [x] por (n)" -> "sumar al efecto [x] (n)"
  [/\bcambiar\s+(?:el\s+)?efecto\s+(\[[^\]]*v\s*\])\s+por\s+(\([^)]*\))/gi, 'sumar al efecto $1 $2'],
  // sonido: "tocar sonido [x]" (sin "hasta que termine") -> "iniciar sonido [x]"
  [/\btocar\s+sonido\s+(\[[^\]]*v\s*\])\s*$/gi, 'iniciar sonido $1'],
  // esperar: "segundo" -> "segundos"
  [/\besperar\s+(\([^)]*\))\s*segundo\b(?!s)/gi, 'esperar $1 segundos'],
  // sensores: "¿tocando un/el borde?" -> "¿tocando [borde v]?"
  [/¿?\s*tocando\s+(?:un|el)\s+borde\s*\??/gi, '¿tocando [borde v]?'],
  [/¿?\s*tocando\s+(?:el\s+)?puntero(?:\s+del\s+(?:ratón|raton|mouse))?\s*\??/gi, '¿tocando [puntero del ratón v]?'],
  // eventos: variantes de la bandera verde
  [/\bal\s+hacer\s+clic\s+en\s+(?:la\s+)?bandera(?:\s+verde)?\b/gi, 'al presionar bandera verde'],
  [/\bal\s+presionar\s+(?:la\s+)?bandera\b(?!\s+verde)/gi, 'al presionar bandera verde'],
  // eventos: "al presionar (la) tecla espacio" sin corchetes
  [/\bal\s+presionar\s+(?:la\s+)?tecla\s+([a-zA-Z0-9áéíóúñ]+)\s*$/gi, 'al presionar tecla [$1 v]'],
  // rebotar: todas las variantes -> redacción oficial
  [/.*\brebotar\b.*\bborde\b.*|.*\bborde\b.*\brebotar\b.*/gi, 'si toca un borde, rebotar'],
  // apariencia
  [/^\s*ocultar\s*$/gi, 'esconder'],
  // listas: "agregar X a [lista]" -> "añadir X a [lista]"
  [/\bagregar\s+(\[[^\]]*\]|\([^)]*\))\s+a\s+(\[[^\]]*v\s*\])/gi, 'añadir $1 a $2'],
  // reporteros de posición
  [/^\s*posición\s+x\s*$/gi, 'posición en x'],
  [/^\s*posición\s+y\s*$/gi, 'posición en y'],
  // control
  [/\brepetir\s+(\([^)]*\))\s*veces\b/gi, 'repetir $1'],
  [/^\s*para\s+siempre\s*$/gi, 'por siempre']
];

// Catálogo de bloques frecuentes con la redacción exacta verificada (es).
// Se usa para sugerencias difusas y para el chuletario de la guía.
export const CATALOGO = {
  'Eventos': [
    'al presionar bandera verde',
    'al presionar tecla [espacio v]',
    'al hacer clic en este objeto',
    'al recibir [mensaje1 v]',
    'enviar [mensaje1 v]'
  ],
  'Movimiento': [
    'mover (10) pasos',
    'girar a la derecha (15) grados',
    'girar a la izquierda (15) grados',
    'apuntar en dirección (90)',
    'ir a x: (0) y: (0)',
    'ir a [posición aleatoria v]',
    'deslizar en (1) segs a x: (0) y: (0)',
    'si toca un borde, rebotar',
    'posición en x',
    'dirección'
  ],
  'Apariencia': [
    'decir [¡Hola!] durante (2) segundos',
    'decir [¡Hola!]',
    'pensar [Hmm...] durante (2) segundos',
    'cambiar disfraz a [disfraz2 v]',
    'siguiente disfraz',
    'cambiar fondo a [fondo1 v]',
    'fijar tamaño al (100) %',
    'cambiar tamaño por (10)',
    'sumar al efecto [color v] (25)',
    'dar al efecto [color v] el valor (0)',
    'esconder',
    'mostrar'
  ],
  'Sonido': [
    'iniciar sonido [Miau v]',
    'tocar sonido [Miau v] hasta que termine'
  ],
  'Control': [
    'esperar (1) segundos',
    'repetir (10)',
    'por siempre',
    'si <> entonces',
    'si no',
    'esperar hasta que <>',
    'repetir hasta que <>',
    'detener [todos v]',
    'al comenzar como clon',
    'crear clon de [mí mismo v]',
    'eliminar este clon',
    'fin'
  ],
  'Sensores': [
    '¿tocando [borde v]?',
    '¿tocando el color [#ff0000]?',
    '¿tecla [espacio v] presionada?',
    'preguntar [¿Cómo te llamás?] y esperar',
    'respuesta'
  ],
  'Operadores': [
    'número aleatorio entre (1) y (10)',
    'unir [manzana ] [banana ]'
  ],
  'Variables y listas': [
    'dar a [variable v] el valor (0)',
    'sumar a [variable v] (1)',
    'mostrar variable [variable v]',
    'añadir [cosa] a [lista v]'
  ],
  'Lápiz (extensión)': [
    'bajar lápiz',
    'subir lápiz',
    'borrar todo',
    'sellar'
  ]
};

const CATALOGO_PLANO = Object.values(CATALOGO).flat();

// enmascara los valores para comparar solo la redacción del bloque
function mascara(linea) {
  return linea.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\[[^\]]*\]/g, '_').replace(/\([^)]*\)/g, '_').replace(/<[^>]*>/g, '_')
    .replace(/[¿?¡!.,]/g, '').replace(/\s+/g, ' ');
}

function similitud(a, b) {
  // distancia de Levenshtein normalizada
  if (a === b) return 1;
  const m = a.length, n = b.length;
  if (!m || !n) return 0;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const fila = [i];
    for (let j = 1; j <= n; j++) {
      fila[j] = Math.min(prev[j] + 1, fila[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = fila;
  }
  return 1 - prev[n] / Math.max(m, n);
}

// Sugerencia para UNA línea roja. Devuelve la línea corregida o null.
// El catálogo completo como texto para prompts de IA: la sintaxis queda
// auto-contenida — el mismo catálogo alimenta el corrector, el chuletario
// de la guía y los prompts, sin listas duplicadas a mano.
export function sintaxisScratchPrompt() {
  return Object.entries(CATALOGO)
    .map(([cat, bloques]) => '  ' + cat + ': ' + bloques.join(' / '))
    .join('\n');
}

export function sugerirCorreccion(linea) {
  const indent = (linea.match(/^\s*/) || [''])[0];
  let texto = linea.trim();
  if (!texto) return null;

  // 1) reglas directas
  let corregida = texto;
  for (const [re, rep] of REGLAS) {
    corregida = corregida.replace(re, rep);
  }
  if (corregida !== texto) return indent + corregida;

  // 2) búsqueda difusa contra el catálogo
  const m = mascara(texto);
  let mejor = null, mejorScore = 0;
  for (const spec of CATALOGO_PLANO) {
    const s = similitud(m, mascara(spec));
    if (s > mejorScore) { mejorScore = s; mejor = spec; }
  }
  if (mejor && mejorScore >= 0.62) {
    // conservar los valores que escribió el docente: se trasplantan en orden
    // a los huecos del mismo tipo del bloque del catálogo
    const valores = texto.match(/\([^)]*\)|\[[^\]]*\]/g) || [];
    let vi = 0;
    const conValores = mejor.replace(/\([^)]*\)|\[[^\]]*\]/g, (hueco) => {
      const v = valores[vi];
      if (v && v[0] === hueco[0]) { vi++; return v; }
      return hueco;
    });
    return indent + conValores;
  }

  return null;
}
