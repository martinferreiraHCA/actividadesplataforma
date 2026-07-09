// Separa el código Scratch de una ficha en secciones por personaje.
// Sintaxis dentro del código:
//
//   fondo: Estrellas          <- opcional, elige el escenario
//
//   personaje: Gato           <- los bloques siguientes son del Gato
//   al presionar bandera verde
//   ...
//
//   personaje: Perro          <- y estos del Perro
//   ...
//
// Sin encabezados, todo el código es del Gato (comportamiento clásico).

const RE_PERSONAJE = /^\s*(?:personaje|objeto|sprite)\s*:\s*(.+?)\s*$/i;
const RE_FONDO = /^\s*(?:fondo|escenario|backdrop)\s*:\s*(.+?)\s*$/i;

export function separarSecciones(codigo) {
  const lineas = String(codigo || '').replace(/\r\n?/g, '\n').split('\n');
  let fondo = null;
  const secciones = [];
  let actual = null; // { personaje, lineas: [] }

  const cerrar = () => {
    if (actual && actual.lineas.join('\n').trim()) {
      secciones.push({ personaje: actual.personaje, codigo: actual.lineas.join('\n').trim() });
    }
    actual = null;
  };

  for (const linea of lineas) {
    const mp = linea.match(RE_PERSONAJE);
    if (mp) {
      cerrar();
      actual = { personaje: mp[1], lineas: [] };
      continue;
    }
    const mf = linea.match(RE_FONDO);
    if (mf) {
      fondo = mf[1];
      continue;
    }
    if (!actual) actual = { personaje: 'Gato', lineas: [] };
    actual.lineas.push(linea);
  }
  cerrar();

  return { fondo, secciones };
}

// ¿el código usa encabezados de personaje/fondo? (para saber si mostrar chips)
export function tieneSecciones(codigo) {
  const { fondo, secciones } = separarSecciones(codigo);
  return !!fondo || secciones.length > 1 || (secciones.length === 1 && !/^gato$/i.test(secciones[0].personaje.trim()));
}
