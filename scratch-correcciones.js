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
  // estilo de rotación: variantes comunes -> redacción oficial
  [/\bfijar\s+(?:el\s+)?estilo\s+de\s+rotaci[oó]n\s+(?:a\s+)?\[?\s*izquierda\s*[\/\-,]?\s*(?:y\s+)?derecha\s*v?\s*\]?/gi, 'fijar estilo de rotación a [izquierda-derecha v]'],
  [/\bfijar\s+(?:el\s+)?estilo\s+de\s+rotaci[oó]n\s+(?:a\s+)?\[?\s*no\s+rotar\s*v?\s*\]?/gi, 'fijar estilo de rotación a [no rotar v]'],
  [/\bfijar\s+(?:el\s+)?estilo\s+de\s+rotaci[oó]n\s+(?:a\s+)?\[?\s*(?:en\s+)?todas(?:\s+las)?\s+direcciones\s*v?\s*\]?/gi, 'fijar estilo de rotación a [en todas direcciones v]'],
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
    'cuando el fondo cambie a [fondo1 v]',
    'cuando [volumen del sonido v] > (10)',
    'al recibir [mensaje1 v]',
    'enviar [mensaje1 v]',
    'enviar [mensaje1 v] y esperar'
  ],
  'Movimiento': [
    'mover (10) pasos',
    'girar a la derecha (15) grados',
    'girar a la izquierda (15) grados',
    'apuntar en dirección (90)',
    'apuntar hacia [puntero del ratón v]',
    'ir a x: (0) y: (0)',
    'ir a [posición aleatoria v]',
    'deslizar en (1) segs a x: (0) y: (0)',
    'deslizar en (1) segs a [posición aleatoria v]',
    'sumar a x (10)',
    'dar a x el valor (0)',
    'sumar a y (10)',
    'dar a y el valor (0)',
    'si toca un borde, rebotar',
    'fijar estilo de rotación a [izquierda-derecha v]',
    'posición en x',
    'posición en y',
    'dirección'
  ],
  'Apariencia': [
    'decir [¡Hola!] durante (2) segundos',
    'decir [¡Hola!]',
    'pensar [Hmm...] durante (2) segundos',
    'pensar [Hmm...]',
    'cambiar disfraz a [disfraz2 v]',
    'siguiente disfraz',
    'cambiar fondo a [fondo1 v]',
    'siguiente fondo',
    'cambiar tamaño por (10)',
    'fijar tamaño al (100) %',
    'sumar al efecto [color v] (25)',
    'dar al efecto [color v] el valor (0)',
    'quitar efectos gráficos',
    'esconder',
    'mostrar',
    'ir a capa [delantera v]',
    'ir (1) capas hacia [adelante v]',
    '[número v] de disfraz',
    '[número v] de fondo',
    'tamaño'
  ],
  'Sonido': [
    'iniciar sonido [Miau v]',
    'tocar sonido [Miau v] hasta que termine',
    'detener todos los sonidos',
    'sumar al efecto [altura v] (10)',
    'dar al efecto [altura v] el valor (100)',
    'quitar efectos de sonido',
    'cambiar volumen por (-10)',
    'fijar volumen al (100)%',
    'volumen'
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
    '¿color [#ff0000] tocando [#0000ff]?',
    'distancia a [puntero del ratón v]',
    'preguntar [¿Cómo te llamás?] y esperar',
    'respuesta',
    '¿tecla [espacio v] presionada?',
    '¿ratón presionado?',
    'posición x del ratón',
    'posición y del ratón',
    'fijar modo de arrastre a [arrastrable v]',
    'volumen del sonido',
    'cronómetro',
    'reiniciar cronómetro',
    '[hora v] actual',
    'días desde el 2000',
    'nombre de usuario'
  ],
  'Operadores': [
    '((6) + (2))',
    '((6) - (2))',
    '((6) * (2))',
    '((6) / (2))',
    'número aleatorio entre (1) y (10)',
    '<(20) > (15)>',
    '<(10) < (15)>',
    '<(10) = (10)>',
    '<<> y <>>',
    '<<> o <>>',
    '<no <>>',
    'unir [manzana ] [banana ]',
    'letra (1) de [mundo]',
    'longitud de [mundo]',
    '((7) módulo (3))',
    'redondear (2.5)',
    '([valor absoluto v] de (-8))',
    '<¿[a] está en [manzana]?>'
  ],
  'Variables y listas': [
    'dar a [variable v] el valor (0)',
    'sumar a [variable v] (1)',
    'mostrar variable [variable v]',
    'esconder variable [variable v]',
    'añadir [cosa] a [lista v]',
    'eliminar (1) de [lista v]',
    'eliminar todos de [lista v]',
    'insertar [cosa] en (1) de [lista v]',
    'reemplazar elemento (1) de [lista v] con [cosa]',
    'elemento (1) de [lista v]',
    '# de elemento de [cosa] en [lista v]',
    'longitud de [lista v]',
    '<¿[cosa] está en [lista v]?>',
    'mostrar lista [lista v]',
    'esconder lista [lista v]'
  ],
  'Lápiz (extensión)': [
    'borrar todo',
    'sellar',
    'bajar lápiz',
    'subir lápiz',
    'fijar color de lápiz a [#ff0000]',
    'cambiar [color v] de lápiz por (10)',
    'fijar [color v] de lápiz a (50)',
    'cambiar tamaño de lápiz por (1)',
    'fijar tamaño de lápiz a (1)'
  ],
  'Música (extensión)': [
    'tocar tambor [(1) Caja v] durante (0.25) tiempos',
    'silencio de (0.25) tiempos',
    'tocar nota (60) durante (0.25) tiempos',
    'fijar instrumento a [(1) Piano v]',
    'cambiar tempo por (20)',
    'dar al tempo el valor (60)',
    'tempo'
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
