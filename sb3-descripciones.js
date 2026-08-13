// Descripciones automáticas en español para el Informe de proyecto:
//  - descripcionDeScript(raiz): prosa de qué hace un programa (AST de sb3-a-scratchblocks)
//  - analizarInteracciones(modelo): mensajes, contactos, clones, variables, fondos
// Las descripciones son heurísticas: cuentan lo que se ve en los bloques, sin
// inventar intención. Para bloques desconocidos se nombra el opcode.

import { traducirMenu } from './sb3-a-scratchblocks.js';

// ---- valor "plano" de un argumento (sin corchetes de scratchblocks) ----
function plano(arg) {
  if (!arg) return '…';
  switch (arg.tipo) {
    case 'num': case 'txt': case 'menu': case 'campo': case 'color': case 'broadcast':
      return String(arg.valor === '' || arg.valor == null ? '…' : arg.valor);
    case 'var': case 'lista': return '«' + arg.valor + '»';
    case 'rep': case 'bool': return fraseReporter(arg.nodo);
    default: return '…';
  }
}

function fraseReporter(nodo) {
  if (!nodo) return '…';
  const a = i => plano((nodo.args || [])[i]);
  switch (nodo.op) {
    case 'operator_add': return `${a(0)} + ${a(1)}`;
    case 'operator_subtract': return `${a(0)} − ${a(1)}`;
    case 'operator_multiply': return `${a(0)} × ${a(1)}`;
    case 'operator_divide': return `${a(0)} ÷ ${a(1)}`;
    case 'operator_random': return `un número al azar entre ${a(0)} y ${a(1)}`;
    case 'operator_join': return `el texto "${a(0)}${a(1)}"`;
    case 'operator_gt': return `${a(0)} es mayor que ${a(1)}`;
    case 'operator_lt': return `${a(0)} es menor que ${a(1)}`;
    case 'operator_equals': return `${a(0)} es igual a ${a(1)}`;
    case 'operator_and': return `${a(0)} y a la vez ${a(1)}`;
    case 'operator_or': return `${a(0)} o bien ${a(1)}`;
    case 'operator_not': return `NO se cumple que ${a(0)}`;
    case 'operator_mod': return `el resto de ${a(0)} ÷ ${a(1)}`;
    case 'operator_round': return `${a(0)} redondeado`;
    case 'operator_length': return `el largo de ${a(0)}`;
    case 'operator_letter_of': return `la letra ${a(0)} de ${a(1)}`;
    case 'operator_contains': return `${a(0)} contiene ${a(1)}`;
    case 'sensing_touchingobject': {
      const v = plano((nodo.args || [])[0]);
      if (v === 'borde') return 'toca el borde';
      if (v === 'puntero del ratón') return 'toca el puntero del ratón';
      return `toca a ${v}`;
    }
    case 'sensing_touchingcolor': return `toca el color ${a(0)}`;
    case 'sensing_keypressed': return `la tecla ${a(0)} está presionada`;
    case 'sensing_mousedown': return 'el ratón está presionado';
    case 'sensing_mousex': return 'la posición x del ratón';
    case 'sensing_mousey': return 'la posición y del ratón';
    case 'sensing_distanceto': return `la distancia hasta ${a(0)}`;
    case 'sensing_answer': return 'la respuesta escrita';
    case 'sensing_timer': return 'el cronómetro';
    case 'sensing_loudness': return 'el volumen del micrófono';
    case 'sensing_of': return `${a(0)} de ${a(1)}`;
    case 'sensing_current': return `${a(0)} actual`;
    case 'sensing_username': return 'el nombre de usuario';
    case 'motion_xposition': return 'su posición x';
    case 'motion_yposition': return 'su posición y';
    case 'motion_direction': return 'su dirección';
    case 'looks_size': return 'su tamaño';
    case 'looks_costumenumbername': return `su disfraz (${a(0)})`;
    case 'looks_backdropnumbername': return `el fondo (${a(0)})`;
    case 'sound_volume': return 'el volumen';
    case 'data_itemoflist': return `el elemento ${a(0)} de ${a(1)}`;
    case 'data_lengthoflist': return `el largo de ${a(0)}`;
    case 'data_listcontainsitem': return `${a(0)} contiene ${a(1)}`;
    case 'argument_reporter_string_number': case 'argument_reporter_boolean':
      return '«' + (nodo.nombreArg || 'arg') + '»';
    case 'music_getTempo': return 'el tempo';
    default: return nodo.spec ? nodo.spec.t.replace(/%\d+/g, (m) => plano((nodo.args || [])[parseInt(m.slice(1), 10) - 1])) : nodo.op;
  }
}

// ---- frase de un bloque apilable ----
// citar(): comillas solo para textos literales; las expresiones van sin comillas
function citar(arg) {
  if (arg && (arg.tipo === 'rep' || arg.tipo === 'bool' || arg.tipo === 'var')) return plano(arg);
  return '"' + plano(arg) + '"';
}

function fraseBloque(nodo) {
  const a = i => plano((nodo.args || [])[i]);
  const q = i => citar((nodo.args || [])[i]);
  switch (nodo.op) {
    case 'motion_movesteps': return `avanza ${a(0)} pasos`;
    case 'motion_turnright': return `gira ${a(0)}° a la derecha`;
    case 'motion_turnleft': return `gira ${a(0)}° a la izquierda`;
    case 'motion_gotoxy': return `se ubica en (x: ${a(0)}, y: ${a(1)})`;
    case 'motion_goto': return `va hacia ${a(0)}`;
    case 'motion_glidesecstoxy': return `se desliza en ${a(0)} s hasta (x: ${a(1)}, y: ${a(2)})`;
    case 'motion_glideto': return `se desliza en ${a(0)} s hasta ${a(1)}`;
    case 'motion_pointindirection': return `apunta en dirección ${a(0)}°`;
    case 'motion_pointtowards': return `apunta hacia ${a(0)}`;
    case 'motion_changexby': return `cambia su x en ${a(0)}`;
    case 'motion_changeyby': return `cambia su y en ${a(0)}`;
    case 'motion_setx': return `fija su x en ${a(0)}`;
    case 'motion_sety': return `fija su y en ${a(0)}`;
    case 'motion_ifonedgebounce': return 'rebota si toca el borde';
    case 'motion_setrotationstyle': return `fija el estilo de rotación en "${a(0)}"`;
    case 'looks_say': return `dice ${q(0)}`;
    case 'looks_sayforsecs': return `dice ${q(0)} durante ${a(1)} s`;
    case 'looks_think': return `piensa ${q(0)}`;
    case 'looks_thinkforsecs': return `piensa ${q(0)} durante ${a(1)} s`;
    case 'looks_show': return 'se muestra';
    case 'looks_hide': return 'se esconde';
    case 'looks_switchcostumeto': return `cambia al disfraz "${a(0)}"`;
    case 'looks_nextcostume': return 'pasa al siguiente disfraz';
    case 'looks_switchbackdropto': return `cambia el fondo a "${a(0)}"`;
    case 'looks_switchbackdroptoandwait': return `cambia el fondo a "${a(0)}" y espera`;
    case 'looks_nextbackdrop': return 'pasa al siguiente fondo';
    case 'looks_changesizeby': return `cambia su tamaño en ${a(0)}`;
    case 'looks_setsizeto': return `fija su tamaño en ${a(0)} %`;
    case 'looks_changeeffectby': return `cambia el efecto ${a(0)} en ${a(1)}`;
    case 'looks_seteffectto': return `fija el efecto ${a(0)} en ${a(1)}`;
    case 'looks_cleargraphiceffects': return 'quita los efectos gráficos';
    case 'looks_gotofrontback': return `se va a la capa de ${a(0) === 'frente' ? 'adelante' : 'atrás'}`;
    case 'looks_goforwardbackwardlayers': return `se mueve ${a(1)} capas hacia ${a(0)}`;
    case 'sound_play': return `inicia el sonido "${a(0)}"`;
    case 'sound_playuntildone': return `toca el sonido "${a(0)}" completo`;
    case 'sound_stopallsounds': return 'detiene todos los sonidos';
    case 'sound_changevolumeby': return `cambia el volumen en ${a(0)}`;
    case 'sound_setvolumeto': return `fija el volumen en ${a(0)} %`;
    case 'sound_changeeffectby': return `cambia el efecto de sonido ${a(0)} en ${a(1)}`;
    case 'sound_seteffectto': return `fija el efecto de sonido ${a(0)} en ${a(1)}`;
    case 'sound_cleareffects': return 'quita los efectos de sonido';
    case 'event_broadcast': return `envía el mensaje "${a(0)}"`;
    case 'event_broadcastandwait': return `envía el mensaje "${a(0)}" y espera a que lo atiendan`;
    case 'control_wait': return `espera ${a(0)} s`;
    case 'control_wait_until': return `espera hasta que ${a(0)}`;
    case 'control_stop': {
      const v = a(0);
      if (v === 'todos') return 'detiene todo el proyecto';
      if (v === 'este programa') return 'detiene este programa';
      return 'detiene los otros programas del objeto';
    }
    case 'control_create_clone_of': return a(0) === 'mí mismo' ? 'crea un clon de sí mismo' : `crea un clon de ${a(0)}`;
    case 'control_delete_this_clone': return 'elimina este clon';
    case 'sensing_askandwait': return `pregunta ${q(0)} y espera la respuesta`;
    case 'sensing_resettimer': return 'reinicia el cronómetro';
    case 'sensing_setdragmode': return `fija el modo de arrastre en "${a(0)}"`;
    case 'data_setvariableto': return `pone la variable ${a(0)} en ${a(1)}`;
    case 'data_changevariableby': return `suma ${a(1)} a la variable ${a(0)}`;
    case 'data_showvariable': return `muestra la variable ${a(0)}`;
    case 'data_hidevariable': return `esconde la variable ${a(0)}`;
    case 'data_addtolist': return `agrega ${a(0)} a la lista ${a(1)}`;
    case 'data_deleteoflist': return `borra el elemento ${a(0)} de la lista ${a(1)}`;
    case 'data_deletealloflist': return `vacía la lista ${a(0)}`;
    case 'data_insertatlist': return `inserta ${a(0)} en la posición ${a(1)} de la lista ${a(2)}`;
    case 'data_replaceitemoflist': return `reemplaza el elemento ${a(0)} de la lista ${a(1)} por ${a(2)}`;
    case 'data_showlist': return `muestra la lista ${a(0)}`;
    case 'data_hidelist': return `esconde la lista ${a(0)}`;
    case 'pen_clear': return 'borra todo lo dibujado';
    case 'pen_stamp': return 'sella su imagen';
    case 'pen_penDown': return 'baja el lápiz (empieza a dibujar)';
    case 'pen_penUp': return 'sube el lápiz (deja de dibujar)';
    case 'pen_setPenColorToColor': return 'elige un color de lápiz';
    case 'pen_setPenSizeTo': return `fija el grosor del lápiz en ${a(0)}`;
    case 'pen_changePenSizeBy': return `cambia el grosor del lápiz en ${a(0)}`;
    case 'music_playDrumForBeats': return `toca el tambor ${a(0)} por ${a(1)} tiempos`;
    case 'music_playNoteForBeats': return `toca la nota ${a(0)} por ${a(1)} tiempos`;
    case 'music_restForBeats': return `silencio de ${a(0)} tiempos`;
    case 'music_setInstrument': return `elige el instrumento ${a(0)}`;
    case 'music_setTempo': return `fija el tempo en ${a(0)}`;
    case 'music_changeTempo': return `cambia el tempo en ${a(0)}`;
    case 'text2speech_speakAndWait': return `lee en voz alta ${q(0)}`;
    case 'procedures_call': {
      const nombre = String(nodo.proccode || 'bloque').replace(/%[snb]/g, '_').replace(/\s+/g, ' ').trim();
      return `usa su bloque propio "${nombre}"`;
    }
    default:
      if (nodo.spec) return nodo.spec.t.replace(/%\d+/g, (m) => plano((nodo.args || [])[parseInt(m.slice(1), 10) - 1]));
      return `ejecuta el bloque de extensión "${nodo.op}"`;
  }
}

// ---- estructuras de control: componen frases anidadas ----
const MAX_FRASES = 10;

function frasesDePila(pila, presupuesto) {
  const frases = [];
  for (const nodo of pila) {
    if (frases.length >= presupuesto) { frases.push('…'); break; }
    const a = i => plano((nodo.args || [])[i]);
    switch (nodo.op) {
      case 'control_forever':
        frases.push('repite sin parar: ' + unir(frasesDePila(nodo.sub[0] || [], 5)));
        break;
      case 'control_repeat':
        frases.push(`repite ${a(0)} veces: ` + unir(frasesDePila(nodo.sub[0] || [], 5)));
        break;
      case 'control_repeat_until':
        frases.push(`repite hasta que ${a(0)}: ` + unir(frasesDePila(nodo.sub[0] || [], 5)));
        break;
      case 'control_if':
        frases.push(`si ${a(0)}, ` + unir(frasesDePila(nodo.sub[0] || [], 4)));
        break;
      case 'control_if_else':
        frases.push(`si ${a(0)}, ` + unir(frasesDePila(nodo.sub[0] || [], 3)) +
          '; si no, ' + unir(frasesDePila(nodo.sub[1] || [], 3)));
        break;
      default:
        frases.push(fraseBloque(nodo));
    }
  }
  return frases;
}

function unir(frases) {
  if (!frases.length) return 'no hace nada';
  return frases.join('; ');
}

// ---- sombrero del script ----
function fraseSombrero(nodo) {
  if (!nodo) return null;
  const a = i => plano((nodo.args || [])[i]);
  switch (nodo.op) {
    case 'event_whenflagclicked': return 'Cuando se presiona la bandera verde';
    case 'event_whenkeypressed': return `Cuando se presiona la tecla ${a(0)}`;
    case 'event_whenthisspriteclicked': return 'Cuando se hace clic sobre este objeto';
    case 'event_whenstageclicked': return 'Cuando se hace clic en el escenario';
    case 'event_whenbackdropswitchesto': return `Cuando el fondo cambia a "${a(0)}"`;
    case 'event_whengreaterthan': return `Cuando ${a(0)} supera ${a(1)}`;
    case 'event_whenbroadcastreceived': return `Cuando recibe el mensaje "${a(0)}"`;
    case 'control_start_as_clone': return 'Cuando aparece como clon';
    case 'procedures_definition': {
      const nombre = String(nodo.proccode || 'bloque').replace(/%[snb]/g, '_').replace(/\s+/g, ' ').trim();
      return `Definición del bloque propio "${nombre}"`;
    }
    default: return null;
  }
}

// Descripción en prosa de un script (raiz = pila de nodos de scriptsDeTarget)
export function descripcionDeScript(raiz) {
  if (!raiz || !raiz.length) return '';
  const primero = raiz[0];
  const sombrero = fraseSombrero(primero);
  const cuerpo = sombrero ? raiz.slice(1) : raiz;
  const frases = frasesDePila(cuerpo, MAX_FRASES);
  if (!sombrero) {
    if (!frases.length) return '';
    const texto = unir(frases);
    return 'Este programa (sin evento de inicio) ' + texto + '.';
  }
  if (!frases.length) return sombrero + ' — no tiene más bloques.';
  return sombrero + ', ' + unir(frases) + '.';
}

// ============================================================
// Interacciones entre objetos (a nivel proyecto)
// ============================================================
// modelo: [{ nombre, esEscenario, scripts: [{raiz, ...}] }]
// Devuelve { mensajes, contactos, clones, variablesCompartidas, fondos, teclas }

function recorrer(pila, fn) {
  for (const nodo of pila || []) {
    fn(nodo);
    for (const arg of nodo.args || []) if (arg.nodo) recorrer([arg.nodo], fn);
    for (const arg of nodo.llamadas || []) if (arg.nodo) recorrer([arg.nodo], fn);
    for (const sub of nodo.sub || []) recorrer(sub, fn);
  }
}

export function analizarInteracciones(modelo) {
  const mensajes = new Map();   // nombre → {emisores:Set, receptores:Set}
  const contactos = [];         // {quien, aQuien}
  const clones = [];            // {quien, deQuien, tieneInicioClon:Set global}
  const variables = new Map();  // nombre → {usan:Set, modifican:Set}
  const fondos = [];            // {quien, fondo}
  const oyenFondo = [];         // {quien, fondo}
  const teclas = new Map();     // tecla → Set de objetos que reaccionan
  const conInicioClon = new Set();

  const asegurarMsg = n => {
    if (!mensajes.has(n)) mensajes.set(n, { emisores: new Set(), receptores: new Set() });
    return mensajes.get(n);
  };
  const asegurarVar = n => {
    if (!variables.has(n)) variables.set(n, { usan: new Set(), modifican: new Set() });
    return variables.get(n);
  };

  for (const t of modelo) {
    const yo = t.nombre;
    for (const s of t.scripts || []) {
      recorrer(s.raiz, nodo => {
        const arg0 = (nodo.args || [])[0];
        switch (nodo.op) {
          case 'event_broadcast': case 'event_broadcastandwait':
            asegurarMsg(plano(arg0)).emisores.add(yo); break;
          case 'event_whenbroadcastreceived':
            asegurarMsg(plano(arg0)).receptores.add(yo); break;
          case 'sensing_touchingobject': {
            const v = plano(arg0);
            if (v !== 'borde' && v !== 'puntero del ratón') contactos.push({ quien: yo, aQuien: v });
            break;
          }
          case 'sensing_distanceto': {
            const v = plano(arg0);
            if (v !== 'puntero del ratón' && v !== 'posición aleatoria') contactos.push({ quien: yo, aQuien: v, distancia: true });
            break;
          }
          case 'control_create_clone_of':
            clones.push({ quien: yo, deQuien: plano(arg0) }); break;
          case 'control_start_as_clone':
            conInicioClon.add(yo); break;
          case 'data_setvariableto': case 'data_changevariableby':
            asegurarVar(plano(arg0).replace(/[«»]/g, '')).modifican.add(yo); break;
          case 'looks_switchbackdropto': case 'looks_switchbackdroptoandwait':
            fondos.push({ quien: yo, fondo: plano(arg0) }); break;
          case 'event_whenbackdropswitchesto':
            oyenFondo.push({ quien: yo, fondo: plano(arg0) }); break;
          case 'event_whenkeypressed': case 'sensing_keypressed': {
            const k = plano(arg0);
            if (!teclas.has(k)) teclas.set(k, new Set());
            teclas.get(k).add(yo);
            break;
          }
          default:
            if (nodo.args) {
              nodo.args.forEach(argN => {
                if (argN && argN.tipo === 'var') asegurarVar(String(argN.valor)).usan.add(yo);
              });
            }
        }
        // variables leídas dentro de reporters
        for (const argN of nodo.args || []) {
          if (argN && argN.tipo === 'var') asegurarVar(String(argN.valor)).usan.add(yo);
        }
      });
    }
  }

  // frases listas para mostrar
  const frases = [];
  mensajes.forEach((v, nombre) => {
    const e = [...v.emisores], r = [...v.receptores];
    let f = `📨 Mensaje «${nombre}»: `;
    f += e.length ? `lo envía ${listar(e)}` : 'nadie lo envía';
    f += r.length ? ` y lo ${r.length > 1 ? 'reciben' : 'recibe'} ${listar(r)}.` : ', pero nadie lo recibe.';
    frases.push(f);
  });
  contactos.forEach(c => {
    frases.push(c.distancia
      ? `📏 ${c.quien} mide la distancia hasta ${c.aQuien}.`
      : `💥 ${c.quien} comprueba si está tocando a ${c.aQuien}.`);
  });
  clones.forEach(c => {
    const objetivo = c.deQuien === 'mí mismo' ? c.quien : c.deQuien;
    let f = `👥 ${c.quien} crea clones de ${c.deQuien === 'mí mismo' ? 'sí mismo' : c.deQuien}`;
    f += conInicioClon.has(objetivo) ? ` (y ${objetivo} tiene un programa "al comenzar como clon").` : '.';
    frases.push(f);
  });
  variables.forEach((v, nombre) => {
    const todos = new Set([...v.usan, ...v.modifican]);
    if (todos.size > 1) {
      frases.push(`🔢 La variable «${nombre}» conecta a ${listar([...todos])}: la ${v.modifican.size ? 'modifica' + (v.modifican.size > 1 ? 'n' : '') + ' ' + listar([...v.modifican]) : 'nadie la modifica'}${v.usan.size ? ' y la lee ' + listar([...v.usan]) : ''}.`);
    }
  });
  fondos.forEach(c => {
    const oyentes = oyenFondo.filter(o => o.fondo === c.fondo && o.quien !== c.quien).map(o => o.quien);
    if (oyentes.length) {
      frases.push(`🖼️ ${c.quien} cambia el fondo a "${c.fondo}" y eso hace reaccionar a ${listar(oyentes)}.`);
    } else {
      frases.push(`🖼️ ${c.quien} cambia el fondo a "${c.fondo}".`);
    }
  });
  teclas.forEach((quienes, k) => {
    if (quienes.size > 1) frases.push(`⌨️ La tecla ${k} la usan ${listar([...quienes])}.`);
  });

  return { frases, mensajes, contactos, clones, variables };
}

function listar(arr) {
  if (arr.length <= 1) return arr[0] || '';
  return arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1];
}
