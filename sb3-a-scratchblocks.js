// Conversor inverso: bloques de un project.json de Scratch 3 (.sb3) → texto
// scratchblocks en español (es-419), para dibujarlos con scratchblocks.min.js.
// Es el espejo de scratch-sb3.js (que convierte texto → .sb3).
//
// API principal:
//   scriptsDeTarget(target) → [{ texto, raiz, bloques, avisos }]
//     texto  : código scratchblocks listo para renderBloques()
//     raiz   : AST propio (ver armarNodo) para generar descripciones
//     bloques: cantidad de bloques del script (sin sombras)
//
// Los opcodes que no conoce se dibujan como bloque gris con el nombre del
// opcode y se registran en avisos, para no ocultar código del proyecto.

// ---- redacciones es-419 (mismas que scratchblocks-es419.js dibuja) ----
// %1, %2… se reemplazan por los argumentos en el orden de `args`.
// Descriptores de args: ['i','NOMBRE'] input · ['f','NOMBRE',dicc] field ·
// ['m','NOMBRE',dicc] input-menú (bloque sombra) · ['b','NOMBRE'] input booleano
const T = {
  // EVENTOS
  event_whenflagclicked: { t: 'al presionar bandera verde', hat: true, args: [] },
  event_whenkeypressed: { t: 'al presionar tecla %1', hat: true, args: [['f', 'KEY_OPTION', 'teclas']] },
  event_whenthisspriteclicked: { t: 'al hacer clic en este objeto', hat: true, args: [] },
  event_whenstageclicked: { t: 'al hacer clic en el escenario', hat: true, args: [] },
  event_whenbackdropswitchesto: { t: 'cuando el fondo cambie a %1', hat: true, args: [['f', 'BACKDROP', null]] },
  event_whengreaterthan: { t: 'cuando %1 > %2', hat: true, args: [['f', 'WHENGREATERTHANMENU', 'mayorQue'], ['i', 'VALUE']] },
  event_whenbroadcastreceived: { t: 'al recibir %1', hat: true, args: [['f', 'BROADCAST_OPTION', null]] },
  event_broadcast: { t: 'enviar %1', args: [['i', 'BROADCAST_INPUT']] },
  event_broadcastandwait: { t: 'enviar %1 y esperar', args: [['i', 'BROADCAST_INPUT']] },

  // MOVIMIENTO
  motion_movesteps: { t: 'mover %1 pasos', args: [['i', 'STEPS']] },
  motion_turnright: { t: 'girar a la derecha %1 grados', args: [['i', 'DEGREES']] },
  motion_turnleft: { t: 'girar a la izquierda %1 grados', args: [['i', 'DEGREES']] },
  motion_pointindirection: { t: 'apuntar en dirección %1', args: [['i', 'DIRECTION']] },
  motion_pointtowards: { t: 'apuntar hacia %1', args: [['m', 'TOWARDS', 'destinos']] },
  motion_gotoxy: { t: 'ir a x: %1 y: %2', args: [['i', 'X'], ['i', 'Y']] },
  motion_goto: { t: 'ir a %1', args: [['m', 'TO', 'destinos']] },
  motion_glidesecstoxy: { t: 'desplazar en %1 segs a x: %2 y: %3', args: [['i', 'SECS'], ['i', 'X'], ['i', 'Y']] },
  motion_glideto: { t: 'desplazar en %1 segs a %2', args: [['i', 'SECS'], ['m', 'TO', 'destinos']] },
  motion_changexby: { t: 'cambiar x en %1', args: [['i', 'DX']] },
  motion_setx: { t: 'fijar x a %1', args: [['i', 'X']] },
  motion_changeyby: { t: 'cambiar y en %1', args: [['i', 'DY']] },
  motion_sety: { t: 'fijar y a %1', args: [['i', 'Y']] },
  motion_ifonedgebounce: { t: 'si toca un borde, rebotar', args: [] },
  motion_setrotationstyle: { t: 'fijar estilo de rotación a %1', args: [['f', 'STYLE', 'rotacion']] },
  motion_xposition: { t: 'posición en x', rep: 'num', args: [] },
  motion_yposition: { t: 'posición en y', rep: 'num', args: [] },
  motion_direction: { t: 'dirección', rep: 'num', args: [] },

  // APARIENCIA
  looks_sayforsecs: { t: 'decir %1 durante %2 segundos', args: [['i', 'MESSAGE'], ['i', 'SECS']] },
  looks_say: { t: 'decir %1', args: [['i', 'MESSAGE']] },
  looks_thinkforsecs: { t: 'pensar %1 durante %2 segundos', args: [['i', 'MESSAGE'], ['i', 'SECS']] },
  looks_think: { t: 'pensar %1', args: [['i', 'MESSAGE']] },
  looks_show: { t: 'mostrar', args: [] },
  looks_hide: { t: 'esconder', args: [] },
  looks_switchcostumeto: { t: 'cambiar disfraz a %1', args: [['m', 'COSTUME', null]] },
  looks_nextcostume: { t: 'siguiente disfraz', args: [] },
  looks_switchbackdropto: { t: 'cambiar fondo a %1', args: [['m', 'BACKDROP', null]] },
  looks_switchbackdroptoandwait: { t: 'cambiar fondo a %1 y esperar', args: [['m', 'BACKDROP', null]] },
  looks_nextbackdrop: { t: 'siguiente fondo', args: [] },
  looks_changeeffectby: { t: 'cambiar el efecto %1 en %2', args: [['f', 'EFFECT', 'efectos'], ['i', 'CHANGE']] },
  looks_seteffectto: { t: 'fijar efecto %1 a %2', args: [['f', 'EFFECT', 'efectos'], ['i', 'VALUE']] },
  looks_cleargraphiceffects: { t: 'quitar efectos gráficos', args: [] },
  looks_changesizeby: { t: 'cambiar tamaño en %1', args: [['i', 'CHANGE']] },
  looks_setsizeto: { t: 'fijar tamaño a %1 %', args: [['i', 'SIZE']] },
  looks_gotofrontback: { t: 'ir a la capa %1', args: [['f', 'FRONT_BACK', 'capas']] },
  looks_goforwardbackwardlayers: { t: 'ir %2 capas hacia %1', args: [['f', 'FORWARD_BACKWARD', 'capaDir'], ['i', 'NUM']] },
  looks_size: { t: 'tamaño', rep: 'num', args: [] },
  looks_costumenumbername: { t: 'disfraz %1', rep: 'num', args: [['f', 'NUMBER_NAME', 'numNombre']] },
  looks_backdropnumbername: { t: 'fondo %1', rep: 'num', args: [['f', 'NUMBER_NAME', 'numNombre']] },

  // SONIDO
  sound_play: { t: 'iniciar sonido %1', args: [['m', 'SOUND_MENU', null]] },
  sound_playuntildone: { t: 'tocar sonido %1 hasta que termine', args: [['m', 'SOUND_MENU', null]] },
  sound_stopallsounds: { t: 'detener todos los sonidos', args: [] },
  sound_changeeffectby: { t: 'cambiar efecto %1 en %2', args: [['f', 'EFFECT', 'efectosSonido'], ['i', 'VALUE']] },
  sound_seteffectto: { t: 'fijar efecto %1 a %2', args: [['f', 'EFFECT', 'efectosSonido'], ['i', 'VALUE']] },
  sound_cleareffects: { t: 'quitar efectos de sonido', args: [] },
  sound_changevolumeby: { t: 'cambiar volumen en %1', args: [['i', 'VOLUME']] },
  sound_setvolumeto: { t: 'fijar volumen a %1%', args: [['i', 'VOLUME']] },
  sound_volume: { t: 'volumen', rep: 'num', args: [] },

  // CONTROL
  control_wait: { t: 'esperar %1 segundos', args: [['i', 'DURATION']] },
  control_repeat: { t: 'repetir %1', c: ['SUBSTACK'], args: [['i', 'TIMES']] },
  control_forever: { t: 'por siempre', c: ['SUBSTACK'], args: [] },
  control_if: { t: 'si %1 entonces', c: ['SUBSTACK'], args: [['b', 'CONDITION']] },
  control_if_else: { t: 'si %1 entonces', c: ['SUBSTACK', 'SUBSTACK2'], sino: true, args: [['b', 'CONDITION']] },
  control_wait_until: { t: 'esperar hasta que %1', args: [['b', 'CONDITION']] },
  control_repeat_until: { t: 'repetir hasta que %1', c: ['SUBSTACK'], args: [['b', 'CONDITION']] },
  control_stop: { t: 'detener %1', args: [['f', 'STOP_OPTION', 'detener']] },
  control_start_as_clone: { t: 'al comenzar como clon', hat: true, args: [] },
  control_create_clone_of: { t: 'crear clon de %1', args: [['m', 'CLONE_OPTION', 'clonar']] },
  control_delete_this_clone: { t: 'eliminar este clon', args: [] },

  // SENSORES
  sensing_touchingobject: { t: '¿tocando %1?', rep: 'bool', args: [['m', 'TOUCHINGOBJECTMENU', 'tocando']] },
  sensing_touchingcolor: { t: '¿tocando el color %1?', rep: 'bool', args: [['i', 'COLOR']] },
  sensing_coloristouchingcolor: { t: '¿color %1 está tocando %2?', rep: 'bool', args: [['i', 'COLOR'], ['i', 'COLOR2']] },
  sensing_distanceto: { t: 'distancia a %1', rep: 'num', args: [['m', 'DISTANCETOMENU', 'destinos']] },
  sensing_askandwait: { t: 'preguntar %1 y esperar', args: [['i', 'QUESTION']] },
  sensing_answer: { t: 'respuesta', rep: 'num', args: [] },
  sensing_keypressed: { t: '¿tecla %1 presionada?', rep: 'bool', args: [['m', 'KEY_OPTION', 'teclas']] },
  sensing_mousedown: { t: '¿ratón presionado?', rep: 'bool', args: [] },
  sensing_mousex: { t: 'posición x del ratón', rep: 'num', args: [] },
  sensing_mousey: { t: 'posición y del ratón', rep: 'num', args: [] },
  sensing_setdragmode: { t: 'fijar modo de arrastre a %1', args: [['f', 'DRAG_MODE', 'arrastre']] },
  sensing_loudness: { t: 'volumen del sonido', rep: 'num', args: [] },
  sensing_timer: { t: 'cronómetro', rep: 'num', args: [] },
  sensing_resettimer: { t: 'reiniciar cronómetro', args: [] },
  sensing_of: { t: '%1 de %2', rep: 'num', args: [['f', 'PROPERTY', 'propiedades'], ['m', 'OBJECT', 'objetoDe']] },
  sensing_current: { t: '%1 actual', rep: 'num', args: [['f', 'CURRENTMENU', 'actual']] },
  sensing_dayssince2000: { t: 'días desde el 2000', rep: 'num', args: [] },
  sensing_username: { t: 'nombre de usuario', rep: 'num', args: [] },

  // OPERADORES
  operator_add: { t: '%1 + %2', rep: 'num', args: [['i', 'NUM1'], ['i', 'NUM2']] },
  operator_subtract: { t: '%1 - %2', rep: 'num', args: [['i', 'NUM1'], ['i', 'NUM2']] },
  operator_multiply: { t: '%1 * %2', rep: 'num', args: [['i', 'NUM1'], ['i', 'NUM2']] },
  operator_divide: { t: '%1 / %2', rep: 'num', args: [['i', 'NUM1'], ['i', 'NUM2']] },
  operator_random: { t: 'elegir número al azar entre %1 y %2', rep: 'num', args: [['i', 'FROM'], ['i', 'TO']] },
  operator_lt: { t: '%1 < %2', rep: 'bool', args: [['i', 'OPERAND1'], ['i', 'OPERAND2']] },
  operator_equals: { t: '%1 = %2', rep: 'bool', args: [['i', 'OPERAND1'], ['i', 'OPERAND2']] },
  operator_gt: { t: '%1 > %2', rep: 'bool', args: [['i', 'OPERAND1'], ['i', 'OPERAND2']] },
  operator_and: { t: '%1 y %2', rep: 'bool', args: [['b', 'OPERAND1'], ['b', 'OPERAND2']] },
  operator_or: { t: '%1 o %2', rep: 'bool', args: [['b', 'OPERAND1'], ['b', 'OPERAND2']] },
  operator_not: { t: 'no %1', rep: 'bool', args: [['b', 'OPERAND']] },
  operator_join: { t: 'unir %1 %2', rep: 'num', args: [['i', 'STRING1'], ['i', 'STRING2']] },
  operator_letter_of: { t: 'letra %1 de %2', rep: 'num', args: [['i', 'LETTER'], ['i', 'STRING']] },
  operator_length: { t: 'longitud de %1', rep: 'num', args: [['i', 'STRING']] },
  operator_contains: { t: '¿%1 contiene %2?', rep: 'bool', args: [['i', 'STRING1'], ['i', 'STRING2']] },
  operator_mod: { t: '%1 módulo %2', rep: 'num', args: [['i', 'NUM1'], ['i', 'NUM2']] },
  operator_round: { t: 'redondear %1', rep: 'num', args: [['i', 'NUM']] },
  operator_mathop: { t: '%1 de %2', rep: 'num', args: [['f', 'OPERATOR', 'mathop'], ['i', 'NUM']] },

  // VARIABLES Y LISTAS
  data_setvariableto: { t: 'fijar %1 a %2', args: [['f', 'VARIABLE', null], ['i', 'VALUE']] },
  data_changevariableby: { t: 'cambiar %1 en %2', args: [['f', 'VARIABLE', null], ['i', 'VALUE']] },
  data_showvariable: { t: 'mostrar variable %1', args: [['f', 'VARIABLE', null]] },
  data_hidevariable: { t: 'esconder variable %1', args: [['f', 'VARIABLE', null]] },
  data_addtolist: { t: 'añadir %1 a %2', args: [['i', 'ITEM'], ['f', 'LIST', null]] },
  data_deleteoflist: { t: 'eliminar %1 de %2', args: [['i', 'INDEX'], ['f', 'LIST', null]] },
  data_deletealloflist: { t: 'Eliminar todos de %1', args: [['f', 'LIST', null]] },
  data_insertatlist: { t: 'insertar %1 en %2 de %3', args: [['i', 'ITEM'], ['i', 'INDEX'], ['f', 'LIST', null]] },
  data_replaceitemoflist: { t: 'reemplazar elemento %1 de %2 con %3', args: [['i', 'INDEX'], ['f', 'LIST', null], ['i', 'ITEM']] },
  data_itemoflist: { t: 'elemento %1 de %2', rep: 'num', args: [['i', 'INDEX'], ['f', 'LIST', null]] },
  data_itemnumoflist: { t: '# de elemento de %1 en %2', rep: 'num', args: [['i', 'ITEM'], ['f', 'LIST', null]] },
  data_lengthoflist: { t: 'longitud de %1', rep: 'num', args: [['f', 'LIST', null]] },
  data_listcontainsitem: { t: '¿%2 está en %1?', rep: 'bool', args: [['f', 'LIST', null], ['i', 'ITEM']] },
  data_showlist: { t: 'mostrar lista %1', args: [['f', 'LIST', null]] },
  data_hidelist: { t: 'esconder lista %1', args: [['f', 'LIST', null]] },

  // LÁPIZ
  pen_clear: { t: 'borrar todo', args: [] },
  pen_stamp: { t: 'sellar', args: [] },
  pen_penDown: { t: 'bajar lápiz', args: [] },
  pen_penUp: { t: 'subir lápiz', args: [] },
  pen_setPenColorToColor: { t: 'fijar color de lápiz a %1', args: [['i', 'COLOR']] },
  pen_changePenColorParamBy: { t: 'cambiar %1 de lápiz en %2', args: [['m', 'COLOR_PARAM', 'paramLapiz'], ['i', 'VALUE']] },
  pen_setPenColorParamTo: { t: 'fijar %1 de lápiz a %2', args: [['m', 'COLOR_PARAM', 'paramLapiz'], ['i', 'VALUE']] },
  pen_changePenSizeBy: { t: 'cambiar tamaño de lápiz en %1', args: [['i', 'SIZE']] },
  pen_setPenSizeTo: { t: 'fijar tamaño de lápiz a %1', args: [['i', 'SIZE']] },
  pen_setPenShadeToNumber: { t: 'fijar sombra de lápiz a %1', args: [['i', 'SHADE']] },
  pen_changePenShadeBy: { t: 'cambiar sombra de lápiz en %1', args: [['i', 'SHADE']] },
  pen_setPenHueToNumber: { t: 'fijar color de lápiz a %1', args: [['i', 'HUE']] },
  pen_changePenHueBy: { t: 'cambiar color de lápiz en %1', args: [['i', 'HUE']] },

  // MÚSICA
  music_playDrumForBeats: { t: 'tocar tambor %1 durante %2 tiempos', args: [['m', 'DRUM', null], ['i', 'BEATS']] },
  music_restForBeats: { t: 'silenciar durante %1 tiempos', args: [['i', 'BEATS']] },
  music_playNoteForBeats: { t: 'tocar nota %1 durante %2 tiempos', args: [['i', 'NOTE'], ['i', 'BEATS']] },
  music_setInstrument: { t: 'fijar instrumento a %1', args: [['m', 'INSTRUMENT', null]] },
  music_changeTempo: { t: 'cambiar el tempo en %1', args: [['i', 'TEMPO']] },
  music_setTempo: { t: 'fijar tempo a %1', args: [['i', 'TEMPO']] },
  music_getTempo: { t: 'tempo', rep: 'num', args: [] },

  // TEXTO A VOZ / TRADUCIR (extensiones frecuentes en aula)
  text2speech_speakAndWait: { t: 'decir %1', args: [['i', 'WORDS']] },
  text2speech_setVoice: { t: 'fijar voz a %1', args: [['m', 'VOICE', null]] },
  text2speech_setLanguage: { t: 'fijar idioma a %1', args: [['m', 'LANGUAGE', null]] },
  translate_getTranslate: { t: 'traducir %1 al %2', rep: 'num', args: [['i', 'WORDS'], ['m', 'LANGUAGE', null]] },
  translate_getViewerLanguage: { t: 'idioma', rep: 'num', args: [] }
};

// ---- traducciones de valores de menús (valor sb3 en inglés → español) ----
const MENUS = {
  teclas: {
    'space': 'espacio', 'up arrow': 'flecha arriba', 'down arrow': 'flecha abajo',
    'left arrow': 'flecha izquierda', 'right arrow': 'flecha derecha', 'any': 'cualquiera', 'enter': 'intro'
  },
  destinos: { '_random_': 'posición aleatoria', '_mouse_': 'puntero del ratón' },
  tocando: { '_edge_': 'borde', '_mouse_': 'puntero del ratón' },
  clonar: { '_myself_': 'mí mismo' },
  efectos: {
    'COLOR': 'color', 'FISHEYE': 'ojo de pez', 'WHIRL': 'remolino', 'PIXELATE': 'pixelar',
    'MOSAIC': 'mosaico', 'BRIGHTNESS': 'brillo', 'GHOST': 'desvanecer'
  },
  efectosSonido: { 'PITCH': 'altura', 'PAN': 'paneo izquierda/derecha' },
  detener: { 'all': 'todos', 'this script': 'este programa', 'other scripts in sprite': 'otros programas en el objeto' },
  rotacion: { 'left-right': 'izquierda-derecha', "don't rotate": 'no rotar', 'all around': 'en todas direcciones' },
  capas: { 'front': 'frente', 'back': 'atrás' },
  capaDir: { 'forward': 'adelante', 'backward': 'atrás' },
  numNombre: { 'number': 'número', 'name': 'nombre' },
  arrastre: { 'draggable': 'arrastrable', 'not draggable': 'no arrastrable' },
  mayorQue: { 'LOUDNESS': 'volumen del sonido', 'TIMER': 'cronómetro' },
  actual: {
    'YEAR': 'año', 'MONTH': 'mes', 'DATE': 'fecha', 'DAYOFWEEK': 'día de la semana',
    'HOUR': 'hora', 'MINUTE': 'minuto', 'SECOND': 'segundo'
  },
  mathop: {
    'abs': 'valor absoluto', 'floor': 'piso', 'ceiling': 'techo', 'sqrt': 'raíz cuadrada',
    'sin': 'sen', 'cos': 'cos', 'tan': 'tan', 'asin': 'arcsen', 'acos': 'arccos', 'atan': 'arctan',
    'ln': 'ln', 'log': 'log', 'e ^': 'e^', '10 ^': '10^'
  },
  propiedades: {
    'x position': 'posición en x', 'y position': 'posición en y', 'direction': 'dirección',
    'costume #': '# de disfraz', 'costume name': 'nombre de disfraz', 'size': 'tamaño',
    'volume': 'volumen', 'backdrop #': '# de fondo', 'backdrop name': 'nombre de fondo'
  },
  objetoDe: { '_stage_': 'Escenario' },
  paramLapiz: { 'color': 'color', 'saturation': 'saturación', 'brightness': 'brillo', 'transparency': 'transparencia' }
};

export function traducirMenu(dicc, valor) {
  const v = String(valor == null ? '' : valor);
  if (dicc && MENUS[dicc] && MENUS[dicc][v] !== undefined) return MENUS[dicc][v];
  return v;
}

// texto seguro adentro de [..] (..) <..>: sin corchetes/paréntesis que rompan el parser
function sano(v) {
  return String(v == null ? '' : v)
    .replace(/[\[\]]/g, '❙').replace(/[()]/g, ' ').replace(/[<>]/g, ' ')
    .replace(/\r?\n/g, ' ');
}
// número: si no parece número lo tratamos como texto igual (scratchblocks acepta (hola))
function comoNum(v) { return '(' + sano(v) + ')'; }
function comoTxt(v) { return '[' + sano(v) + ']'; }
function comoMenu(v) { return '[' + sano(v) + ' v]'; }

// nombre "humano" para un opcode desconocido: "boost_motorOnFor" → "boost motor On For"
function nombreOpcode(op) {
  return String(op).replace(/[_\.]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
}

// ============================================================
// AST propio: armarNodo() convierte el diccionario plano de bloques sb3
// en un árbol fácil de recorrer (texto y descripciones lo comparten)
// ============================================================
// nodo = { op, spec, args: [{tipo:'num'|'txt'|'menu'|'campo'|'color'|'var'|'lista'|'broadcast'|'rep'|'bool'|'vacio',
//                            valor, nodo?}], sub: [[nodos]], mutation? }

function valorPrimitivo(prim) {
  // [4..8, "n"] número · [9, "#rrggbb"] color · [10, "txt"] · [11, nombre, id] · [12/13, nombre, id]
  const t = prim[0];
  if (t === 9) return { tipo: 'color', valor: String(prim[1] || '#000000') };
  if (t === 10) return { tipo: 'txt', valor: prim[1] };
  if (t === 11) return { tipo: 'broadcast', valor: prim[1] };
  if (t === 12) return { tipo: 'var', valor: prim[1] };
  if (t === 13) return { tipo: 'lista', valor: prim[1] };
  return { tipo: 'num', valor: prim[1] };
}

function resolverInput(ctx, val, esBool, dicc) {
  // val: [estado, x, (y)] — x puede ser id de bloque o primitivo array
  if (!val || !Array.isArray(val)) return { tipo: 'vacio', valor: '' };
  const x = val[1];
  if (typeof x === 'string') {
    const b = ctx.blocks[x];
    if (!b) return { tipo: 'vacio', valor: '' };
    if (b.shadow && !esShadowConCuerpo(b)) {
      // bloque-menú sombra: un solo field con el valor elegido
      const campos = Object.keys(b.fields || {});
      if (campos.length) {
        const crudo = b.fields[campos[0]][0];
        return { tipo: 'menu', valor: traducirMenu(dicc, crudo), crudo };
      }
      return { tipo: 'vacio', valor: '' };
    }
    // reporter o booleano real anidado
    const nodo = armarNodo(ctx, x);
    return { tipo: esBool ? 'bool' : 'rep', nodo };
  }
  if (Array.isArray(x)) {
    const v = valorPrimitivo(x);
    if (v.tipo === 'menu' || !dicc) return v;
    // primitivo dentro de un slot de menú (raro): traducir igual
    return v;
  }
  return { tipo: 'vacio', valor: '' };
}

// las definiciones de bloques propios son "shadow" pero tienen mutation (prototipo)
function esShadowConCuerpo(b) {
  return b.opcode === 'procedures_prototype';
}

export function armarNodo(ctx, id) {
  const b = ctx.blocks[id];
  if (!b) return null;
  const op = b.opcode;
  const nodo = { op, args: [], sub: [], mutation: b.mutation || null, campos: b.fields || {} };

  // --- bloques propios (Mis bloques) ---
  if (op === 'procedures_definition') {
    const protoId = b.inputs && b.inputs.custom_block && b.inputs.custom_block[1];
    const proto = protoId && ctx.blocks[protoId];
    nodo.proccode = (proto && proto.mutation && proto.mutation.proccode) || 'bloque';
    try {
      nodo.argumentos = JSON.parse((proto.mutation.argumentnames || '[]'));
    } catch (e) { nodo.argumentos = []; }
    return nodo;
  }
  if (op === 'procedures_call') {
    nodo.proccode = (b.mutation && b.mutation.proccode) || 'bloque';
    let ids = [];
    try { ids = JSON.parse(b.mutation.argumentids || '[]'); } catch (e) { /* sin args */ }
    nodo.llamadas = ids.map(aid => resolverInput(ctx, b.inputs && b.inputs[aid], false, null));
    return nodo;
  }
  if (op === 'argument_reporter_string_number' || op === 'argument_reporter_boolean') {
    nodo.nombreArg = (b.fields && b.fields.VALUE && b.fields.VALUE[0]) || 'arg';
    return nodo;
  }

  const spec = T[op];
  nodo.spec = spec || null;
  if (spec) {
    for (const [clase, nombre, dicc] of spec.args) {
      if (clase === 'f') {
        const f = b.fields && b.fields[nombre];
        nodo.args.push({ tipo: 'campo', valor: traducirMenu(dicc, f ? f[0] : ''), crudo: f ? f[0] : '' });
      } else if (clase === 'b') {
        nodo.args.push(resolverInput(ctx, b.inputs && b.inputs[nombre], true, null));
      } else {
        nodo.args.push(resolverInput(ctx, b.inputs && b.inputs[nombre], false, clase === 'm' ? dicc : null));
      }
    }
    (spec.c || []).forEach(nombreSub => {
      const val = b.inputs && b.inputs[nombreSub];
      const subId = val && typeof val[1] === 'string' ? val[1] : null;
      nodo.sub.push(subId ? armarPila(ctx, subId) : []);
    });
  } else {
    // opcode desconocido: igual recorremos las bocas C por si tienen código adentro
    for (const [nombre, val] of Object.entries(b.inputs || {})) {
      if (/^SUBSTACK/.test(nombre) && val && typeof val[1] === 'string') {
        nodo.sub.push(armarPila(ctx, val[1]));
      }
    }
    ctx.avisos.push(op);
  }
  return nodo;
}

export function armarPila(ctx, id) {
  const pila = [];
  let cur = id;
  const vistos = new Set();
  while (cur && !vistos.has(cur)) {
    vistos.add(cur);
    const nodo = armarNodo(ctx, cur);
    if (nodo) pila.push(nodo);
    const b = ctx.blocks[cur];
    cur = b ? b.next : null;
  }
  return pila;
}

// ============================================================
// AST → texto scratchblocks
// ============================================================

function textoArg(arg, tipoEsperado) {
  switch (arg.tipo) {
    case 'num': return comoNum(arg.valor);
    case 'txt': return comoTxt(arg.valor);
    case 'color': return '[' + sano(arg.valor) + ']';
    case 'menu': case 'campo': return comoMenu(arg.valor);
    case 'broadcast': return comoMenu(arg.valor);
    case 'var': return '(' + sano(arg.valor) + ')';
    case 'lista': return '(' + sano(arg.valor) + ' :: list)';
    case 'rep': return '(' + lineaDe(arg.nodo) + ')';
    case 'bool': return '<' + lineaDe(arg.nodo) + '>';
    case 'vacio': return tipoEsperado === 'bool' ? '<>' : '()';
    default: return '()';
  }
}

// la línea de texto de un solo bloque (sin subpilas)
function lineaDe(nodo) {
  if (!nodo) return '';
  if (nodo.op === 'procedures_definition') {
    let i = 0;
    const args = nodo.argumentos || [];
    // el proccode trae %s %n %b donde van los argumentos
    const cuerpo = String(nodo.proccode).replace(/%[snb]/g, m => {
      const nombre = sano(args[i++] || 'arg');
      return m === '%b' ? '<' + nombre + '>' : '(' + nombre + ')';
    });
    return 'definir ' + cuerpo.replace(/\s+/g, ' ').trim();
  }
  if (nodo.op === 'procedures_call') {
    let i = 0;
    const texto = String(nodo.proccode).replace(/%[snb]/g, m => {
      const arg = (nodo.llamadas || [])[i++] || { tipo: 'vacio' };
      return textoArg(arg, m === '%b' ? 'bool' : 'num');
    });
    return texto.replace(/\s+/g, ' ').trim();
  }
  if (nodo.op === 'argument_reporter_string_number') return '(' + sano(nodo.nombreArg) + ')';
  if (nodo.op === 'argument_reporter_boolean') return '<' + sano(nodo.nombreArg) + '>';

  const spec = nodo.spec;
  if (!spec) {
    // bloque desconocido → bloque gris con el nombre del opcode
    return sano(nombreOpcode(nodo.op)) + ' :: grey';
  }
  let i = 0;
  const linea = spec.t.replace(/%(\d+)/g, (m, n) => {
    const arg = nodo.args[parseInt(n, 10) - 1];
    if (!arg) return '()';
    const clase = spec.args[parseInt(n, 10) - 1];
    return textoArg(arg, clase && clase[0] === 'b' ? 'bool' : 'num');
  });
  return linea;
}

function textoPila(pila, sangria) {
  const pre = '  '.repeat(sangria);
  const lineas = [];
  for (const nodo of pila) {
    lineas.push(pre + lineaDe(nodo));
    const spec = nodo.spec;
    if (spec && spec.c) {
      lineas.push(textoPila(nodo.sub[0] || [], sangria + 1));
      if (spec.sino) {
        lineas.push(pre + 'si no');
        lineas.push(textoPila(nodo.sub[1] || [], sangria + 1));
      }
      lineas.push(pre + 'fin');
    } else if (!spec && nodo.sub.length) {
      // desconocido con boca C: mostramos el contenido igual
      nodo.sub.forEach(sub => lineas.push(textoPila(sub, sangria + 1)));
    }
  }
  return lineas.filter(l => l !== '').join('\n');
}

// ============================================================
// API
// ============================================================

// Cantidad de bloques reales (sin sombras/menús) de un nodo con sus hijos
function contarNodos(pila) {
  let n = 0;
  for (const nodo of pila) {
    n++;
    for (const arg of nodo.args || []) {
      if (arg.nodo) n += contarNodos([arg.nodo]);
    }
    for (const sub of nodo.sub || []) n += contarNodos(sub);
  }
  return n;
}

// target.blocks → [{texto, raiz, bloques, avisos, x, y}] (un elemento por pila top-level)
export function scriptsDeTarget(target) {
  const blocks = target.blocks || {};
  const tops = Object.entries(blocks)
    .filter(([id, b]) => b && b.topLevel && !b.shadow)
    .sort((a, b2) => (a[1].y || 0) - (b2[1].y || 0) || (a[1].x || 0) - (b2[1].x || 0));

  const out = [];
  for (const [id, b] of tops) {
    // reporters sueltos en el lienzo: los salteamos (no son un programa)
    const spec = T[b.opcode];
    if (spec && spec.rep && !b.next) continue;
    const ctx = { blocks, avisos: [] };
    const pila = armarPila(ctx, id);
    if (!pila.length) continue;
    out.push({
      texto: textoPila(pila, 0),
      raiz: pila,
      bloques: contarNodos(pila),
      avisos: Array.from(new Set(ctx.avisos)),
      x: b.x || 0, y: b.y || 0
    });
  }
  return out;
}

export const PLANTILLAS_SB3 = T;
