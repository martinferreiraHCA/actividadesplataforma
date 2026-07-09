// Pictogramas para el diseño infantil: se lee el código de la ficha y se
// deducen dibujitos de lo que va a pasar (se mueve, gira, habla, suena...)
// para que el niño anticipe el resultado antes de programar.

// cada regla: expresión sobre el código (en minúsculas) → { emoji, texto }
const REGLAS_SCRATCH = [
  [/bandera verde|al hacer clic en/, { emoji: '🚩', texto: 'empieza con la bandera' }],
  [/al presionar tecla|tecla \[/, { emoji: '⌨️', texto: 'usá el teclado' }],
  [/al hacer clic en este objeto/, { emoji: '🖱️', texto: 'hacé clic en el personaje' }],
  [/mover \(|deslizar|ir a |cambiar x|cambiar y|fijar x|fijar y|posición/, { emoji: '🏃', texto: 'se mueve' }],
  [/girar|apuntar/, { emoji: '🔄', texto: 'gira' }],
  [/rebotar/, { emoji: '🏓', texto: 'rebota en el borde' }],
  [/decir |pensar /, { emoji: '💬', texto: 'habla' }],
  [/preguntar /, { emoji: '❓', texto: 'te hace una pregunta' }],
  [/tocar sonido|iniciar sonido|tambor|nota/, { emoji: '🔊', texto: 'hace un sonido' }],
  [/por siempre|repetir/, { emoji: '🔁', texto: 'se repite' }],
  [/\bsi <.*entonces/, { emoji: '🤔', texto: 'decide qué hacer' }],
  [/esperar \(/, { emoji: '⏳', texto: 'espera un poquito' }],
  [/disfraz/, { emoji: '🎭', texto: 'cambia de disfraz' }],
  [/cambiar fondo|fondo \[/, { emoji: '🖼️', texto: 'cambia el fondo' }],
  [/tamaño/, { emoji: '📏', texto: 'cambia de tamaño' }],
  [/esconder|mostrar\b/, { emoji: '👻', texto: 'aparece y desaparece' }],
  [/efecto|color/, { emoji: '🌈', texto: 'cambia de color' }],
  [/variable|sumar a \[|puntaje|puntos/, { emoji: '🔢', texto: 'cuenta puntos' }],
  [/clonar|clon/, { emoji: '👯', texto: 'se hacen copias' }],
  [/lápiz|sellar/, { emoji: '✏️', texto: 'dibuja' }]
];

const REGLAS_MICROBIT = [
  [/onbuttonpressed|button\.|on_button|button_a|button_b|boton/, { emoji: '🅰️', texto: 'apretá un botón' }],
  [/showicon|showleds|plot|show_icon|show_leds/, { emoji: '💡', texto: 'prende las lucecitas' }],
  [/showstring|shownumber|show_string|show_number|scroll/, { emoji: '🔤', texto: 'muestra letras o números' }],
  [/forever|while|loops\.|every_interval|for \(/, { emoji: '🔁', texto: 'se repite' }],
  [/\bif\b|si\b/, { emoji: '🤔', texto: 'decide qué hacer' }],
  [/pause|sleep|basic\.pause/, { emoji: '⏳', texto: 'espera un poquito' }],
  [/ongesture|shake|gesture|acceler/, { emoji: '📳', texto: 'sacudí el micro:bit' }],
  [/playtone|music|melody|ringtone/, { emoji: '🎵', texto: 'hace música' }],
  [/temperature|temperatura/, { emoji: '🌡️', texto: 'mide la temperatura' }],
  [/compassheading|compass/, { emoji: '🧭', texto: 'usa la brújula' }],
  [/lightlevel|light_level/, { emoji: '🔆', texto: 'mide la luz' }],
  [/radio\./, { emoji: '📡', texto: 'manda mensajes por radio' }],
  [/pin|servo|motor/, { emoji: '🔌', texto: 'usa los pines' }],
  [/clearscreen|clear_screen/, { emoji: '⬛', texto: 'apaga la pantalla' }],
  [/random|aleatorio/, { emoji: '🎲', texto: 'elige al azar' }]
];

const MAXIMO = 5;

// devuelve [{emoji, texto}] con lo que "va a pasar" según el código
export function pictogramasDeFicha(ficha) {
  const codigo = (ficha.codigo || '').toLowerCase();
  if (!codigo.trim()) return [];
  const reglas = ficha.tipo === 'microbit' ? REGLAS_MICROBIT
    : ficha.tipo === 'codigo' ? [] // código genérico: no se puede adivinar con confianza
    : REGLAS_SCRATCH;
  const out = [];
  const vistos = new Set();
  for (const [re, picto] of reglas) {
    if (out.length >= MAXIMO) break;
    if (vistos.has(picto.emoji)) continue;
    if (re.test(codigo)) { out.push(picto); vistos.add(picto.emoji); }
  }
  return out;
}
