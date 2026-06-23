// Utilidades compartidas para los tipos "completar" (gap match) y
// "seleccion_inline" (dropdown dentro del texto).
//
// La plantilla usa marcadores [[...]]:
//   - completar:        "La capital es [[Montevideo]]."          → hueco con respuesta
//   - seleccion_inline: "La capital es [[Montevideo|Salto|Paysandú]]." → dropdown (1ª = correcta)

// Parte la plantilla en segmentos de texto y huecos.
// Devuelve: [{ texto }] | [{ hueco: true, partes: ['a','b',...] }]
export function parsearPlantilla(plantilla) {
  const segs = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let last = 0, m;
  while ((m = re.exec(plantilla || ''))) {
    if (m.index > last) segs.push({ texto: plantilla.slice(last, m.index) });
    const partes = m[1].split('|').map(s => s.trim()).filter(Boolean);
    if (partes.length) segs.push({ hueco: true, partes });
    last = m.index + m[0].length;
  }
  if (last < (plantilla || '').length) segs.push({ texto: plantilla.slice(last) });
  return segs;
}

export function huecosDe(plantilla) {
  return parsearPlantilla(plantilla).filter(s => s.hueco);
}

// Para "completar": respuestas correctas (1ª parte de cada hueco).
export function respuestasCompletar(plantilla) {
  return huecosDe(plantilla).map(h => h.partes[0]);
}

// Banco de palabras de "completar": respuestas + distractores (sin repetir).
export function bancoCompletar(plantilla, distractores) {
  const pool = [...respuestasCompletar(plantilla), ...(distractores || [])]
    .map(s => (s || '').trim()).filter(Boolean);
  return [...new Set(pool)];
}

// Texto plano con los huecos como "______" (para degradar a ensayo / mostrar).
export function plantillaConRayas(plantilla) {
  return parsearPlantilla(plantilla)
    .map(s => s.hueco ? '______' : s.texto).join('');
}
