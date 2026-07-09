// Convierte el texto scratchblocks de una ficha en un proyecto Scratch 3
// real (.sb3) para poder ejecutarlo en el simulador o abrirlo en Scratch.
// Cubre los bloques más comunes de aula; los que no reconoce se saltean
// y se informan como avisos.

import { GATO1_SVG, GATO2_SVG, FONDO_SVG, MIAU_WAV, b64aBytes } from './scratch-sb3-assets.js';
import { PERSONAJES as CATALOGO_PERSONAJES, FONDOS as CATALOGO_FONDOS, buscarPersonaje, buscarFondo, listaNombresPersonajes, listaNombresFondos } from './scratch-personajes.js';
import { separarSecciones } from './scratch-secciones.js';

const ASSETS = {
  gato1: { md5: 'bcf454acf82e4504149f7ffe07081dbc', ext: 'svg', datos: GATO1_SVG },
  gato2: { md5: '0fb9be3e8397c983338cb71dc84d0b25', ext: 'svg', datos: GATO2_SVG },
  fondo: { md5: 'cd21514d0531fdffb22204e0ec5ed84a', ext: 'svg', datos: FONDO_SVG },
  miau: { md5: '83c36d806dc92327b9e7049a565c6bff', ext: 'wav', datos: MIAU_WAV }
};

// ---- utilidades de estado del conversor ----
function nuevoContexto() {
  return {
    bloques: {},          // id → bloque sb3
    variables: new Map(), // nombre → id
    broadcasts: new Map(),// nombre → id
    avisos: [],
    usaPen: false,
    n: 0
  };
}
function nuevoId(ctx, pref) {
  return (pref || 'b') + (++ctx.n).toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---- diccionarios de valores de menús (es/en → valores sb3) ----
const TECLAS = {
  'espacio': 'space', 'space': 'space',
  'flecha arriba': 'up arrow', 'up arrow': 'up arrow',
  'flecha abajo': 'down arrow', 'down arrow': 'down arrow',
  'flecha izquierda': 'left arrow', 'left arrow': 'left arrow',
  'flecha derecha': 'right arrow', 'right arrow': 'right arrow',
  'cualquiera': 'any', 'any': 'any'
};
const TOCANDO = {
  'borde': '_edge_', 'edge': '_edge_',
  'puntero del ratón': '_mouse_', 'puntero del raton': '_mouse_', 'mouse-pointer': '_mouse_'
};
const IR_A = {
  'posición aleatoria': '_random_', 'posicion aleatoria': '_random_', 'random position': '_random_',
  'puntero del ratón': '_mouse_', 'puntero del raton': '_mouse_', 'mouse-pointer': '_mouse_'
};
const EFECTOS = {
  'color': 'COLOR', 'ojo de pez': 'FISHEYE', 'fisheye': 'FISHEYE', 'remolino': 'WHIRL', 'whirl': 'WHIRL',
  'pixelar': 'PIXELATE', 'pixelate': 'PIXELATE', 'mosaico': 'MOSAIC', 'mosaic': 'MOSAIC',
  'brillo': 'BRIGHTNESS', 'brightness': 'BRIGHTNESS', 'desvanecer': 'GHOST', 'ghost': 'GHOST'
};
const DETENER = {
  'todos': 'all', 'all': 'all',
  'este programa': 'this script', 'this script': 'this script',
  'otros programas en este objeto': 'other scripts in sprite', 'other scripts in sprite': 'other scripts in sprite'
};
const DISFRACES = { 'costume1': 'disfraz1', 'costume2': 'disfraz2', 'disfraz1': 'disfraz1', 'disfraz2': 'disfraz2' };
const FONDOS = { 'backdrop1': 'fondo1', 'fondo1': 'fondo1', 'fondo2': 'fondo1', 'siguiente fondo': 'next backdrop', 'next backdrop': 'next backdrop' };
const SONIDOS = { 'miau': 'Miau', 'meow': 'Miau', 'pop': 'Miau' };

function trad(mapa, v, def) {
  const k = String(v == null ? '' : v).trim().toLowerCase();
  return mapa[k] !== undefined ? mapa[k] : (def !== undefined ? def : String(v));
}

// ---- tabla de bloques: id de scratchblocks (claves l10n) → emisor sb3 ----
// tipos de arg: num | txt | drop | bool | stack
// inputs: [nombreInput, tipoPrimitivo] — se consumen en orden de los args del AST
const BLOQUES = {
  // EVENTOS (hats)
  EVENT_WHENFLAGCLICKED: { op: 'event_whenflagclicked', hat: true },
  EVENT_WHENKEYPRESSED: { op: 'event_whenkeypressed', hat: true, fields: [['KEY_OPTION', v => trad(TECLAS, v)]] },
  EVENT_WHENTHISSPRITECLICKED: { op: 'event_whenthisspriteclicked', hat: true },
  EVENT_WHENBROADCASTRECEIVED: { op: 'event_whenbroadcastreceived', hat: true, fieldsBroadcast: 'BROADCAST_OPTION' },
  EVENT_BROADCAST: { op: 'event_broadcast', inputBroadcast: 'BROADCAST_INPUT' },
  EVENT_BROADCASTANDWAIT: { op: 'event_broadcastandwait', inputBroadcast: 'BROADCAST_INPUT' },

  // MOVIMIENTO
  MOTION_MOVESTEPS: { op: 'motion_movesteps', inputs: [['STEPS', 'num']] },
  MOTION_TURNRIGHT: { op: 'motion_turnright', inputs: [['DEGREES', 'num']] },
  MOTION_TURNLEFT: { op: 'motion_turnleft', inputs: [['DEGREES', 'num']] },
  MOTION_GOTOXY: { op: 'motion_gotoxy', inputs: [['X', 'num'], ['Y', 'num']] },
  MOTION_GOTO: { op: 'motion_goto', menuInput: ['TO', 'motion_goto_menu', 'TO', v => trad(IR_A, v, '_random_')] },
  MOTION_POINTINDIRECTION: { op: 'motion_pointindirection', inputs: [['DIRECTION', 'num']] },
  MOTION_POINTTOWARDS: { op: 'motion_pointtowards', menuInput: ['TOWARDS', 'motion_pointtowards_menu', 'TOWARDS', v => trad(IR_A, v, '_mouse_')] },
  MOTION_CHANGEXBY: { op: 'motion_changexby', inputs: [['DX', 'num']] },
  MOTION_CHANGEYBY: { op: 'motion_changeyby', inputs: [['DY', 'num']] },
  MOTION_SETX: { op: 'motion_setx', inputs: [['X', 'num']] },
  MOTION_SETY: { op: 'motion_sety', inputs: [['Y', 'num']] },
  MOTION_GLIDESECSTOXY: { op: 'motion_glidesecstoxy', inputs: [['SECS', 'num'], ['X', 'num'], ['Y', 'num']] },
  MOTION_IFONEDGEBOUNCE: { op: 'motion_ifonedgebounce' },
  MOTION_SETROTATIONSTYLE: { op: 'motion_setrotationstyle', fields: [['STYLE', v => trad({ 'izquierda-derecha': 'left-right', 'left-right': 'left-right', 'no rotar': "don't rotate", "don't rotate": "don't rotate", 'en todas direcciones': 'all around', 'all around': 'all around' }, v, 'all around')]] },
  MOTION_XPOSITION: { op: 'motion_xposition', reporter: true },
  MOTION_YPOSITION: { op: 'motion_yposition', reporter: true },
  MOTION_DIRECTION: { op: 'motion_direction', reporter: true },

  // APARIENCIA
  LOOKS_SAYFORSECS: { op: 'looks_sayforsecs', inputs: [['MESSAGE', 'txt'], ['SECS', 'num']] },
  LOOKS_SAY: { op: 'looks_say', inputs: [['MESSAGE', 'txt']] },
  LOOKS_THINKFORSECS: { op: 'looks_thinkforsecs', inputs: [['MESSAGE', 'txt'], ['SECS', 'num']] },
  LOOKS_THINK: { op: 'looks_think', inputs: [['MESSAGE', 'txt']] },
  LOOKS_SHOW: { op: 'looks_show' },
  LOOKS_HIDE: { op: 'looks_hide' },
  LOOKS_SWITCHCOSTUMETO: { op: 'looks_switchcostumeto', menuInput: ['COSTUME', 'looks_costume', 'COSTUME', v => trad(DISFRACES, v)] },
  LOOKS_NEXTCOSTUME: { op: 'looks_nextcostume' },
  LOOKS_SWITCHBACKDROPTO: { op: 'looks_switchbackdropto', menuInput: ['BACKDROP', 'looks_backdrops', 'BACKDROP', v => trad(FONDOS, v)] },
  LOOKS_NEXTBACKDROP: { op: 'looks_nextbackdrop' },
  LOOKS_CHANGESIZEBY: { op: 'looks_changesizeby', inputs: [['CHANGE', 'num']] },
  LOOKS_SETSIZETO: { op: 'looks_setsizeto', inputs: [['SIZE', 'num']] },
  LOOKS_CHANGEEFFECTBY: { op: 'looks_changeeffectby', fields: [['EFFECT', v => trad(EFECTOS, v, 'COLOR')]], inputs: [['CHANGE', 'num']] },
  LOOKS_SETEFFECTTO: { op: 'looks_seteffectto', fields: [['EFFECT', v => trad(EFECTOS, v, 'COLOR')]], inputs: [['VALUE', 'num']] },
  LOOKS_CLEARGRAPHICEFFECTS: { op: 'looks_cleargraphiceffects' },
  LOOKS_GOTOFRONTBACK: { op: 'looks_gotofrontback', fields: [['FRONT_BACK', v => trad({ 'frente': 'front', 'front': 'front', 'atrás': 'back', 'atras': 'back', 'back': 'back' }, v, 'front')]] },
  LOOKS_SIZE: { op: 'looks_size', reporter: true },
  LOOKS_COSTUMENUMBERNAME: { op: 'looks_costumenumbername', reporter: true, fields: [['NUMBER_NAME', v => trad({ 'número': 'number', 'numero': 'number', 'number': 'number', 'nombre': 'name', 'name': 'name' }, v, 'number')]] },

  // SONIDO
  SOUND_PLAY: { op: 'sound_play', menuInput: ['SOUND_MENU', 'sound_sounds_menu', 'SOUND_MENU', v => trad(SONIDOS, v, String(v))] },
  SOUND_PLAYUNTILDONE: { op: 'sound_playuntildone', menuInput: ['SOUND_MENU', 'sound_sounds_menu', 'SOUND_MENU', v => trad(SONIDOS, v, String(v))] },
  SOUND_STOPALLSOUNDS: { op: 'sound_stopallsounds' },
  SOUND_CHANGEVOLUMEBY: { op: 'sound_changevolumeby', inputs: [['VOLUME', 'num']] },
  SOUND_SETVOLUMETO: { op: 'sound_setvolumeto', inputs: [['VOLUME', 'num']] },

  // CONTROL
  CONTROL_WAIT: { op: 'control_wait', inputs: [['DURATION', 'num']] },
  CONTROL_REPEAT: { op: 'control_repeat', inputs: [['TIMES', 'num']], sub: ['SUBSTACK'] },
  CONTROL_FOREVER: { op: 'control_forever', sub: ['SUBSTACK'] },
  // "si … entonces" y "si … si no" comparten id CONTROL_IF en scratchblocks:
  // con 2 Scripts hijos se emite control_if_else (ver emitirPila)
  CONTROL_IF: { op: 'control_if', boolInput: 'CONDITION', sub: ['SUBSTACK'] },
  CONTROL_IF_ELSE: { op: 'control_if_else', boolInput: 'CONDITION', sub: ['SUBSTACK', 'SUBSTACK2'] },
  CONTROL_WAITUNTIL: { op: 'control_wait_until', boolInput: 'CONDITION' },
  CONTROL_REPEATUNTIL: { op: 'control_repeat_until', boolInput: 'CONDITION', sub: ['SUBSTACK'] },
  CONTROL_STOP: { op: 'control_stop', fields: [['STOP_OPTION', v => trad(DETENER, v, 'all')]], mutacionStop: true },
  CONTROL_CREATECLONEOF: { op: 'control_create_clone_of', menuInput: ['CLONE_OPTION', 'control_create_clone_of_menu', 'CLONE_OPTION', v => trad({ 'mí mismo': '_myself_', 'mi mismo': '_myself_', 'myself': '_myself_' }, v, '_myself_')] },
  CONTROL_STARTASCLONE: { op: 'control_start_as_clone', hat: true },
  CONTROL_DELETETHISCLONE: { op: 'control_delete_this_clone' },

  // SENSORES
  SENSING_TOUCHINGOBJECT: { op: 'sensing_touchingobject', reporter: true, menuInput: ['TOUCHINGOBJECTMENU', 'sensing_touchingobjectmenu', 'TOUCHINGOBJECTMENU', v => trad(TOCANDO, v, '_edge_')] },
  SENSING_KEYPRESSED: { op: 'sensing_keypressed', reporter: true, menuInput: ['KEY_OPTION', 'sensing_keyoptions', 'KEY_OPTION', v => trad(TECLAS, v)] },
  SENSING_MOUSEDOWN: { op: 'sensing_mousedown', reporter: true },
  SENSING_MOUSEX: { op: 'sensing_mousex', reporter: true },
  SENSING_MOUSEY: { op: 'sensing_mousey', reporter: true },
  SENSING_ASKANDWAIT: { op: 'sensing_askandwait', inputs: [['QUESTION', 'txt']] },
  SENSING_ANSWER: { op: 'sensing_answer', reporter: true },
  SENSING_TIMER: { op: 'sensing_timer', reporter: true },
  SENSING_RESETTIMER: { op: 'sensing_resettimer' },

  // OPERADORES
  OPERATORS_ADD: { op: 'operator_add', reporter: true, inputs: [['NUM1', 'num'], ['NUM2', 'num']] },
  OPERATORS_SUBTRACT: { op: 'operator_subtract', reporter: true, inputs: [['NUM1', 'num'], ['NUM2', 'num']] },
  OPERATORS_MULTIPLY: { op: 'operator_multiply', reporter: true, inputs: [['NUM1', 'num'], ['NUM2', 'num']] },
  OPERATORS_DIVIDE: { op: 'operator_divide', reporter: true, inputs: [['NUM1', 'num'], ['NUM2', 'num']] },
  OPERATORS_RANDOM: { op: 'operator_random', reporter: true, inputs: [['FROM', 'num'], ['TO', 'num']] },
  OPERATORS_GT: { op: 'operator_gt', reporter: true, inputs: [['OPERAND1', 'txt'], ['OPERAND2', 'txt']] },
  OPERATORS_LT: { op: 'operator_lt', reporter: true, inputs: [['OPERAND1', 'txt'], ['OPERAND2', 'txt']] },
  OPERATORS_EQUALS: { op: 'operator_equals', reporter: true, inputs: [['OPERAND1', 'txt'], ['OPERAND2', 'txt']] },
  OPERATORS_AND: { op: 'operator_and', reporter: true, boolInputs: ['OPERAND1', 'OPERAND2'] },
  OPERATORS_OR: { op: 'operator_or', reporter: true, boolInputs: ['OPERAND1', 'OPERAND2'] },
  OPERATORS_NOT: { op: 'operator_not', reporter: true, boolInputs: ['OPERAND'] },
  OPERATORS_JOIN: { op: 'operator_join', reporter: true, inputs: [['STRING1', 'txt'], ['STRING2', 'txt']] },
  OPERATORS_LETTEROF: { op: 'operator_letter_of', reporter: true, inputs: [['LETTER', 'num'], ['STRING', 'txt']] },
  OPERATORS_LENGTH: { op: 'operator_length', reporter: true, inputs: [['STRING', 'txt']] },
  OPERATORS_MOD: { op: 'operator_mod', reporter: true, inputs: [['NUM1', 'num'], ['NUM2', 'num']] },
  OPERATORS_ROUND: { op: 'operator_round', reporter: true, inputs: [['NUM', 'num']] },

  // VARIABLES
  DATA_SETVARIABLETO: { op: 'data_setvariableto', fieldsVariable: 'VARIABLE', inputs: [['VALUE', 'txt']] },
  DATA_CHANGEVARIABLEBY: { op: 'data_changevariableby', fieldsVariable: 'VARIABLE', inputs: [['VALUE', 'num']] },
  DATA_SHOWVARIABLE: { op: 'data_showvariable', fieldsVariable: 'VARIABLE' },
  DATA_HIDEVARIABLE: { op: 'data_hidevariable', fieldsVariable: 'VARIABLE' },

  // LÁPIZ (extensión pen)
  'pen.clear': { op: 'pen_clear', pen: true },
  'pen.penDown': { op: 'pen_penDown', pen: true },
  'pen.penUp': { op: 'pen_penUp', pen: true },
  'pen.stamp': { op: 'pen_stamp', pen: true },
  'pen.setSize': { op: 'pen_setPenSizeTo', pen: true, inputs: [['SIZE', 'num']] },
  'pen.changeSize': { op: 'pen_changePenSizeBy', pen: true, inputs: [['SIZE', 'num']] }
};

// alias frecuentes (ids alternativos que aparecen según versión/idioma)
const ALIAS = {
  MOTION_TURNCW: 'MOTION_TURNRIGHT',
  MOTION_TURNCCW: 'MOTION_TURNLEFT',
  MOTION_BOUNCEOFFEDGE: 'MOTION_IFONEDGEBOUNCE',
  CONTROL_WAIT_UNTIL: 'CONTROL_WAITUNTIL',
  CONTROL_REPEAT_UNTIL: 'CONTROL_REPEATUNTIL'
};

export const BLOQUES_SOPORTADOS = BLOQUES;

// ============================================================
// Recorrido del AST de scratchblocks
// ============================================================

// args útiles de un bloque: inputs, bloques anidados (reporters/booleanos) y
// scripts (bocas C). Los Label e Icon quedan afuera.
function argsDe(block) {
  return (block.children || []).filter(ch => ch.isInput || ch.isBlock || ch.isScript);
}

function idDe(block) {
  const id = block.info && block.info.id;
  return ALIAS[id] || id;
}

function esDesconocido(block) {
  const info = block.info || {};
  return info.category === 'obsolete' || (!info.id && !info.selector);
}

function textoDe(block) {
  // reconstruye un texto legible del bloque para los avisos
  try {
    if (typeof block.stringify === 'function') return block.stringify().split('\n')[0].slice(0, 60);
  } catch (e) { /* seguimos con el hash */ }
  return (block.info && block.info.hash) || 'bloque';
}

// valor primitivo sb3 para un input
function prim(tipo, valor) {
  if (tipo === 'num') {
    const v = String(valor == null ? '' : valor).trim();
    return [4, v === '' ? '0' : v];
  }
  return [10, String(valor == null ? '' : valor)];
}

// emite un argumento como input sb3: primitivo, reporter anidado o vacío
function emitirInput(ctx, arg, tipo, parentId) {
  if (arg && arg.isBlock) {
    const r = emitirReporter(ctx, arg, parentId);
    if (r && r.primitivo) return [3, r.primitivo, prim(tipo, tipo === 'num' ? '0' : '')];
    if (r) return [3, r, prim(tipo, tipo === 'num' ? '0' : '')];
    return [1, prim(tipo, tipo === 'num' ? '0' : '')];
  }
  const valor = arg && arg.isInput ? arg.value : '';
  return [1, prim(tipo, valor)];
}

function emitirBool(ctx, arg, parentId) {
  if (arg && arg.isBlock) {
    const r = emitirReporter(ctx, arg, parentId);
    if (r && !r.primitivo) return [2, r];
  }
  return null; // input booleano vacío: se omite
}

function idVariable(ctx, nombre) {
  const n = String(nombre).trim();
  if (!ctx.variables.has(n)) ctx.variables.set(n, 'var_' + nuevoId(ctx, 'v'));
  return ctx.variables.get(n);
}
function idBroadcast(ctx, nombre) {
  const n = String(nombre).trim() || 'mensaje1';
  if (!ctx.broadcasts.has(n)) ctx.broadcasts.set(n, 'bc_' + nuevoId(ctx, 'm'));
  return ctx.broadcasts.get(n);
}

// crea un bloque menú (shadow) y devuelve su id
function emitirMenu(ctx, opMenu, campo, valor, parentId) {
  const id = nuevoId(ctx, 'm');
  ctx.bloques[id] = {
    opcode: opMenu,
    next: null,
    parent: parentId,
    inputs: {},
    fields: { [campo]: [valor, null] },
    shadow: true,
    topLevel: false
  };
  return id;
}

// emite un bloque reporter/booleano; devuelve id, {primitivo} para variables,
// o null si no se soporta
function emitirReporter(ctx, block, parentId) {
  const id = idDe(block);

  // variable como reporter: (puntaje) — va como primitivo [12, nombre, id]
  if (block.info && block.info.selector === 'readVariable') {
    const nombre = (block.info.hash || '').trim() ||
      (block.children || []).filter(c => c.isLabel).map(c => c.value).join(' ').trim() || 'variable';
    return { primitivo: [12, nombre, idVariable(ctx, nombre)] };
  }

  const spec = BLOQUES[id];
  if (!spec || !spec.reporter) {
    ctx.avisos.push(`No se pudo simular el bloque "${textoDe(block)}" (se ignora).`);
    return null;
  }
  const bid = nuevoId(ctx);
  const b = { opcode: spec.op, next: null, parent: parentId, inputs: {}, fields: {}, shadow: false, topLevel: false };
  ctx.bloques[bid] = b;
  llenarArgs(ctx, block, spec, b, bid);
  return bid;
}

// llena inputs y fields de un bloque según su spec, consumiendo argsDe(block) en orden
function llenarArgs(ctx, block, spec, b, bid) {
  const args = argsDe(block).filter(a => !a.isScript);
  let i = 0;

  if (spec.menuInput) {
    const [inputName, opMenu, campo, mapear] = spec.menuInput;
    const arg = args[i++];
    const crudo = arg && arg.isInput ? arg.value : '';
    b.inputs[inputName] = [1, emitirMenu(ctx, opMenu, campo, mapear(crudo), bid)];
  }
  if (spec.inputBroadcast) {
    const arg = args[i++];
    const nombre = arg && arg.isInput ? String(arg.value).trim() : 'mensaje1';
    b.inputs[spec.inputBroadcast] = [1, [11, nombre, idBroadcast(ctx, nombre)]];
  }
  if (spec.boolInput) {
    const arg = args[i++];
    const r = emitirBool(ctx, arg, bid);
    if (r) b.inputs[spec.boolInput] = r;
  }
  if (spec.boolInputs) {
    spec.boolInputs.forEach(nombre => {
      const arg = args[i++];
      const r = emitirBool(ctx, arg, bid);
      if (r) b.inputs[nombre] = r;
    });
  }
  // los campos (dropdowns) van ANTES que los inputs: es el orden visual de
  // todos los bloques soportados (ej: "sumar a [variable v] (1)")
  if (spec.fields) {
    spec.fields.forEach(([nombre, mapear]) => {
      const arg = args[i++];
      const crudo = arg && arg.isInput ? arg.value : '';
      b.fields[nombre] = [mapear(crudo), null];
    });
  }
  if (spec.fieldsVariable) {
    const arg = args[i++];
    const nombre = arg && arg.isInput ? String(arg.value).trim() : 'variable';
    b.fields[spec.fieldsVariable] = [nombre, idVariable(ctx, nombre)];
  }
  if (spec.fieldsBroadcast) {
    const arg = args[i++];
    const nombre = arg && arg.isInput ? String(arg.value).trim() : 'mensaje1';
    b.fields[spec.fieldsBroadcast] = [nombre, idBroadcast(ctx, nombre)];
  }
  if (spec.inputs) {
    spec.inputs.forEach(([nombre, tipo]) => {
      const arg = args[i++];
      b.inputs[nombre] = emitirInput(ctx, arg, tipo, bid);
    });
  }
  if (spec.mutacionStop) {
    const hasNext = b.fields.STOP_OPTION && b.fields.STOP_OPTION[0] !== 'all';
    b.mutation = { tagName: 'mutation', children: [], hasnext: hasNext ? 'true' : 'false' };
  }
  if (spec.pen) ctx.usaPen = true;
}

// emite una pila de bloques (array de bloques del AST); devuelve id del primero
function emitirPila(ctx, bloquesAst, parentId) {
  let primero = null;
  let anterior = null;
  for (const block of bloquesAst) {
    const id = idDe(block);
    if (id === 'scratchblocks:end') continue; // "fin" suelto: se ignora
    let spec = BLOQUES[id];
    // "si … si no": mismo id CONTROL_IF con dos Scripts hijos
    if (id === 'CONTROL_IF' && (block.children || []).filter(c => c.isScript).length >= 2) {
      spec = BLOQUES.CONTROL_IF_ELSE;
    }
    if (!spec || spec.reporter) {
      if (esDesconocido(block)) {
        ctx.avisos.push(`"${textoDe(block)}" no coincide con ningún bloque real de Scratch (bloque rojo): se salteó.`);
      } else {
        ctx.avisos.push(`El bloque "${textoDe(block)}" todavía no está soportado por el simulador: se salteó.`);
      }
      continue;
    }
    const bid = nuevoId(ctx);
    const b = { opcode: spec.op, next: null, parent: anterior || parentId || null, inputs: {}, fields: {}, shadow: false, topLevel: false };
    ctx.bloques[bid] = b;
    llenarArgs(ctx, block, spec, b, bid);

    // bocas C (si / repetir / por siempre): scripts hijos en orden
    if (spec.sub) {
      const scripts = (block.children || []).filter(ch => ch.isScript);
      spec.sub.forEach((nombreSub, k) => {
        const script = scripts[k];
        if (script && script.blocks && script.blocks.length) {
          const subId = emitirPila(ctx, script.blocks, bid);
          if (subId) {
            b.inputs[nombreSub] = [2, subId];
            ctx.bloques[subId].parent = bid;
          }
        }
      });
    }

    if (anterior) ctx.bloques[anterior].next = bid;
    if (!primero) primero = bid;
    anterior = bid;
  }
  return primero;
}

// ============================================================
// API principal
// ============================================================

// emite todas las pilas de un código en ctx.bloques; devuelve cuántas emitió
function emitirScriptsDeCodigo(ctx, codigo) {
  const sb = window.scratchblocks;
  const doc = sb.parse(codigo, { languages: ['en', 'es'] });
  const scripts = (doc.scripts || []).filter(s => s.blocks && s.blocks.length);

  let x = 60;
  let emitidos = 0;
  for (const script of scripts) {
    const bloquesAst = script.blocks;
    const primeroSpec = BLOQUES[idDe(bloquesAst[0])];
    const hatExtra = !primeroSpec || !primeroSpec.hat;

    const topId = (() => {
      if (!hatExtra) return emitirPila(ctx, bloquesAst, null);
      const hatId = nuevoId(ctx);
      ctx.bloques[hatId] = {
        opcode: 'event_whenflagclicked', next: null, parent: null,
        inputs: {}, fields: {}, shadow: false, topLevel: true, x, y: 40
      };
      const cuerpoId = emitirPila(ctx, bloquesAst, hatId);
      if (cuerpoId) {
        ctx.bloques[hatId].next = cuerpoId;
        ctx.bloques[cuerpoId].parent = hatId;
      }
      return hatId;
    })();

    if (topId) {
      ctx.bloques[topId].topLevel = true;
      ctx.bloques[topId].x = x;
      ctx.bloques[topId].y = 40;
      x += 320;
      emitidos++;
      if (hatExtra) {
        ctx.avisos.push('Una pila no empezaba con un bloque sombrero: se le agregó "al presionar bandera verde" para poder ejecutarla.');
      }
    }
  }
  return emitidos;
}

const SONIDO_MIAU = { name: 'Miau', assetId: ASSETS.miau.md5, md5ext: ASSETS.miau.md5 + '.wav', dataFormat: 'wav', format: '', rate: 22050, sampleCount: 18688 };

// Convierte código scratchblocks → { proyecto, avisos, assets }
// El código puede tener secciones "personaje: Nombre" y una línea "fondo: Nombre".
export function convertirAProyecto(codigo) {
  const sb = window.scratchblocks;
  if (!sb) throw new Error('scratchblocks no está cargado');
  const ctx = nuevoContexto();
  const assets = new Map(); // nombreArchivo → base64
  assets.set(ASSETS.miau.md5 + '.wav', MIAU_WAV);

  const { fondo, secciones } = separarSecciones(codigo);
  if (!secciones.length) throw new Error('El código no tiene bloques para simular.');

  // ---- fondo del escenario ----
  let costumeFondo = {
    name: 'fondo1', assetId: ASSETS.fondo.md5, md5ext: ASSETS.fondo.md5 + '.svg',
    dataFormat: 'svg', rotationCenterX: 240, rotationCenterY: 180
  };
  assets.set(ASSETS.fondo.md5 + '.svg', FONDO_SVG);
  if (fondo) {
    const claveFondo = buscarFondo(fondo);
    if (claveFondo) {
      const f = CATALOGO_FONDOS[claveFondo];
      costumeFondo = {
        name: f.nombre, assetId: f.md5, md5ext: f.md5 + '.' + f.ext,
        dataFormat: f.ext, rotationCenterX: f.rc[0], rotationCenterY: f.rc[1]
      };
      assets.set(f.md5 + '.' + f.ext, f.b64);
    } else {
      ctx.avisos.push(`No conozco el fondo "${fondo}". Los disponibles: ${listaNombresFondos().join(', ')}.`);
    }
  }

  // ---- agrupar secciones por personaje (dos secciones "Perro" = un sprite) ----
  const grupos = [];
  const porNombre = new Map();
  for (const sec of secciones) {
    const clave = buscarPersonaje(sec.personaje);
    if (!clave) {
      ctx.avisos.push(`No conozco el personaje "${sec.personaje}": se usa el Gato. Los disponibles: ${listaNombresPersonajes().join(', ')}.`);
    }
    const claveOk = clave || 'gato';
    const nombre = claveOk === 'gato' ? 'Gato' : CATALOGO_PERSONAJES[claveOk].nombre;
    if (porNombre.has(nombre)) {
      porNombre.get(nombre).codigos.push(sec.codigo);
    } else {
      const g = { clave: claveOk, nombre, codigos: [sec.codigo] };
      porNombre.set(nombre, g);
      grupos.push(g);
    }
  }

  // ---- un target por personaje ----
  const targets = [];
  let totalEmitidos = 0;
  grupos.forEach((g, i) => {
    ctx.bloques = {};
    let emitidos = 0;
    for (const cod of g.codigos) emitidos += emitirScriptsDeCodigo(ctx, cod);
    totalEmitidos += emitidos;

    let costumes;
    if (g.clave === 'gato') {
      costumes = [
        { name: 'disfraz1', assetId: ASSETS.gato1.md5, md5ext: ASSETS.gato1.md5 + '.svg', dataFormat: 'svg', rotationCenterX: 48, rotationCenterY: 50 },
        { name: 'disfraz2', assetId: ASSETS.gato2.md5, md5ext: ASSETS.gato2.md5 + '.svg', dataFormat: 'svg', rotationCenterX: 46, rotationCenterY: 53 }
      ];
      assets.set(ASSETS.gato1.md5 + '.svg', GATO1_SVG);
      assets.set(ASSETS.gato2.md5 + '.svg', GATO2_SVG);
    } else {
      const p = CATALOGO_PERSONAJES[g.clave];
      costumes = [{ name: 'disfraz1', assetId: p.md5, md5ext: p.md5 + '.' + p.ext, dataFormat: p.ext, rotationCenterX: p.rc[0], rotationCenterY: p.rc[1] }];
      assets.set(p.md5 + '.' + p.ext, p.b64);
    }

    // repartir los personajes por el escenario para que no queden encimados
    const n = grupos.length;
    const xPos = n === 1 ? 0 : Math.round(-150 + (300 / (n - 1)) * i);

    targets.push({
      isStage: false, name: g.nombre,
      variables: {}, lists: {}, broadcasts: {},
      blocks: ctx.bloques, comments: {},
      currentCostume: 0, costumes,
      sounds: [Object.assign({}, SONIDO_MIAU)],
      volume: 100, layerOrder: i + 1,
      visible: true, x: xPos, y: 0, size: 100, direction: 90,
      draggable: false, rotationStyle: 'all around'
    });
  });
  if (!totalEmitidos) throw new Error('Ningún bloque del código se pudo convertir para el simulador.');

  const variables = {};
  ctx.variables.forEach((id, nombre) => { variables[id] = [nombre, 0]; });
  const broadcasts = {};
  ctx.broadcasts.forEach((id, nombre) => { broadcasts[id] = nombre; });

  const stage = {
    isStage: true, name: 'Stage',
    variables, lists: {}, broadcasts,
    blocks: {}, comments: {},
    currentCostume: 0,
    costumes: [costumeFondo],
    sounds: [], volume: 100, layerOrder: 0,
    tempo: 60, videoTransparency: 50, videoState: 'on', textToSpeechLanguage: null
  };

  const proyecto = {
    targets: [stage].concat(targets),
    monitors: [],
    extensions: ctx.usaPen ? ['pen'] : [],
    meta: { semver: '3.0.0', vm: '0.2.0', agent: 'Generador de Actividades' }
  };

  return { proyecto, avisos: ctx.avisos, assets };
}

// Empaqueta el proyecto como .sb3 (zip) y devuelve un Blob
export async function proyectoASb3(proyecto, assets) {
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify(proyecto));
  (assets || new Map()).forEach((b64, archivo) => {
    zip.file(archivo, b64aBytes(b64));
  });
  return zip.generateAsync({ type: 'blob', mimeType: 'application/x.scratch.sb3' });
}

// Atajo: código scratchblocks → { blob (.sb3), avisos }
export async function codigoASb3(codigo) {
  const { proyecto, avisos, assets } = convertirAProyecto(codigo);
  const blob = await proyectoASb3(proyecto, assets);
  return { blob, avisos, proyecto };
}
