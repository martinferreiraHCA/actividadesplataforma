// Catálogo de piezas LEGO disponibles para las guías de ensamble.
// Cada pieza referencia un archivo .dat de la biblioteca LDraw local (lego/ldraw/).
// "w" y "d" son el tamaño en studs según la orientación nativa del archivo LDraw
// (el lado largo va sobre el eje X sin rotar); "alto" está en placas (3 placas = 1 ladrillo).
// "studs": cuántas filas de studs tiene arriba ('todas', 'ninguna' o un número de filas).

export const CATEGORIAS = ['Ladrillos', 'Placas', 'Lisas', 'Pendientes', 'Redondas', 'Técnicas', 'Ruedas', 'Especiales'];

export const PIEZAS = [
  // --- Ladrillos ---
  { clave: 'ladrillo 1x1', dat: '3005', nombre: 'Ladrillo 1×1', w: 1, d: 1, alto: 3, studs: 'todas', cat: 'Ladrillos' },
  { clave: 'ladrillo 1x2', dat: '3004', nombre: 'Ladrillo 1×2', w: 2, d: 1, alto: 3, studs: 'todas', cat: 'Ladrillos' },
  { clave: 'ladrillo 1x3', dat: '3622', nombre: 'Ladrillo 1×3', w: 3, d: 1, alto: 3, studs: 'todas', cat: 'Ladrillos' },
  { clave: 'ladrillo 1x4', dat: '3010', nombre: 'Ladrillo 1×4', w: 4, d: 1, alto: 3, studs: 'todas', cat: 'Ladrillos' },
  { clave: 'ladrillo 1x6', dat: '3009', nombre: 'Ladrillo 1×6', w: 6, d: 1, alto: 3, studs: 'todas', cat: 'Ladrillos' },
  { clave: 'ladrillo 1x8', dat: '3008', nombre: 'Ladrillo 1×8', w: 8, d: 1, alto: 3, studs: 'todas', cat: 'Ladrillos' },
  { clave: 'ladrillo 2x2', dat: '3003', nombre: 'Ladrillo 2×2', w: 2, d: 2, alto: 3, studs: 'todas', cat: 'Ladrillos' },
  { clave: 'ladrillo 2x3', dat: '3002', nombre: 'Ladrillo 2×3', w: 3, d: 2, alto: 3, studs: 'todas', cat: 'Ladrillos' },
  { clave: 'ladrillo 2x4', dat: '3001', nombre: 'Ladrillo 2×4', w: 4, d: 2, alto: 3, studs: 'todas', cat: 'Ladrillos' },
  { clave: 'ladrillo 2x6', dat: '2456', nombre: 'Ladrillo 2×6', w: 6, d: 2, alto: 3, studs: 'todas', cat: 'Ladrillos' },
  { clave: 'ladrillo 2x8', dat: '3007', nombre: 'Ladrillo 2×8', w: 8, d: 2, alto: 3, studs: 'todas', cat: 'Ladrillos' },
  // --- Placas ---
  { clave: 'placa 1x1', dat: '3024', nombre: 'Placa 1×1', w: 1, d: 1, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 1x2', dat: '3023', nombre: 'Placa 1×2', w: 2, d: 1, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 1x3', dat: '3623', nombre: 'Placa 1×3', w: 3, d: 1, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 1x4', dat: '3710', nombre: 'Placa 1×4', w: 4, d: 1, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 1x6', dat: '3666', nombre: 'Placa 1×6', w: 6, d: 1, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 1x8', dat: '3460', nombre: 'Placa 1×8', w: 8, d: 1, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 2x2', dat: '3022', nombre: 'Placa 2×2', w: 2, d: 2, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 2x3', dat: '3021', nombre: 'Placa 2×3', w: 3, d: 2, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 2x4', dat: '3020', nombre: 'Placa 2×4', w: 4, d: 2, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 2x6', dat: '3795', nombre: 'Placa 2×6', w: 6, d: 2, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 2x8', dat: '3034', nombre: 'Placa 2×8', w: 8, d: 2, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 4x4', dat: '3031', nombre: 'Placa 4×4', w: 4, d: 4, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 4x6', dat: '3032', nombre: 'Placa 4×6', w: 6, d: 4, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 4x8', dat: '3035', nombre: 'Placa 4×8', w: 8, d: 4, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 4x10', dat: '3030', nombre: 'Placa 4×10', w: 10, d: 4, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 6x6', dat: '3958', nombre: 'Placa 6×6', w: 6, d: 6, alto: 1, studs: 'todas', cat: 'Placas' },
  { clave: 'placa 6x8', dat: '3036', nombre: 'Placa 6×8', w: 8, d: 6, alto: 1, studs: 'todas', cat: 'Placas' },
  // --- Lisas (tiles, sin studs arriba) ---
  { clave: 'lisa 1x1', dat: '3070b', nombre: 'Lisa 1×1 (tile)', w: 1, d: 1, alto: 1, studs: 'ninguna', cat: 'Lisas' },
  { clave: 'lisa 1x2', dat: '3069b', nombre: 'Lisa 1×2 (tile)', w: 2, d: 1, alto: 1, studs: 'ninguna', cat: 'Lisas' },
  { clave: 'lisa 1x4', dat: '2431', nombre: 'Lisa 1×4 (tile)', w: 4, d: 1, alto: 1, studs: 'ninguna', cat: 'Lisas' },
  { clave: 'lisa 1x6', dat: '6636', nombre: 'Lisa 1×6 (tile)', w: 6, d: 1, alto: 1, studs: 'ninguna', cat: 'Lisas' },
  { clave: 'lisa 2x2', dat: '3068b', nombre: 'Lisa 2×2 (tile)', w: 2, d: 2, alto: 1, studs: 'ninguna', cat: 'Lisas' },
  { clave: 'lisa 2x4', dat: '87079', nombre: 'Lisa 2×4 (tile)', w: 4, d: 2, alto: 1, studs: 'ninguna', cat: 'Lisas' },
  // --- Pendientes (techos) ---
  { clave: 'cuna 1x1', dat: '54200', nombre: 'Cuña 1×1 (mini pendiente)', w: 1, d: 1, alto: 2, studs: 'ninguna', cat: 'Pendientes' },
  { clave: 'pendiente 1x2', dat: '3040b', nombre: 'Pendiente 45° 1×2', w: 2, d: 1, alto: 3, studs: 1, cat: 'Pendientes' },
  { clave: 'pendiente 2x2', dat: '3039', nombre: 'Pendiente 45° 2×2', w: 2, d: 2, alto: 3, studs: 1, cat: 'Pendientes' },
  { clave: 'pendiente 2x3', dat: '3038', nombre: 'Pendiente 45° 2×3', w: 3, d: 2, alto: 3, studs: 1, cat: 'Pendientes' },
  { clave: 'pendiente 2x4', dat: '3037', nombre: 'Pendiente 45° 2×4', w: 4, d: 2, alto: 3, studs: 1, cat: 'Pendientes' },
  { clave: 'pendiente invertida 1x2', dat: '3665', nombre: 'Pendiente invertida 45° 1×2', w: 2, d: 1, alto: 3, studs: 'todas', cat: 'Pendientes' },
  { clave: 'pendiente invertida 2x2', dat: '3660', nombre: 'Pendiente invertida 45° 2×2', w: 2, d: 2, alto: 3, studs: 'todas', cat: 'Pendientes' },
  // --- Redondas ---
  { clave: 'placa redonda 1x1', dat: '4073', nombre: 'Placa redonda 1×1', w: 1, d: 1, alto: 1, studs: 'todas', cat: 'Redondas', redonda: true },
  { clave: 'ladrillo redondo 1x1', dat: '3062b', nombre: 'Ladrillo redondo 1×1', w: 1, d: 1, alto: 3, studs: 'todas', cat: 'Redondas', redonda: true },
  { clave: 'cono 1x1', dat: '4589', nombre: 'Cono 1×1', w: 1, d: 1, alto: 3, studs: 'todas', cat: 'Redondas', redonda: true },
  { clave: 'placa redonda 2x2', dat: '4032a', nombre: 'Placa redonda 2×2', w: 2, d: 2, alto: 1, studs: 'todas', cat: 'Redondas', redonda: true },
  { clave: 'ladrillo redondo 2x2', dat: '3941', nombre: 'Ladrillo redondo 2×2', w: 2, d: 2, alto: 3, studs: 'todas', cat: 'Redondas', redonda: true },
  // --- Técnicas ---
  { clave: 'tecnico 1x2', dat: '3700', nombre: 'Ladrillo técnico 1×2 (1 agujero)', w: 2, d: 1, alto: 3, studs: 'todas', cat: 'Técnicas' },
  { clave: 'tecnico 1x4', dat: '3701', nombre: 'Ladrillo técnico 1×4 (3 agujeros)', w: 4, d: 1, alto: 3, studs: 'todas', cat: 'Técnicas' },
  { clave: 'tecnico 1x6', dat: '3894', nombre: 'Ladrillo técnico 1×6 (5 agujeros)', w: 6, d: 1, alto: 3, studs: 'todas', cat: 'Técnicas' },
  { clave: 'tecnico 1x8', dat: '3702', nombre: 'Ladrillo técnico 1×8 (7 agujeros)', w: 8, d: 1, alto: 3, studs: 'todas', cat: 'Técnicas' },
  { clave: 'eje 2', dat: '3704', nombre: 'Eje técnico 2', w: 2, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', suelta: true },
  { clave: 'eje 4', dat: '3705', nombre: 'Eje técnico 4', w: 4, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', suelta: true },
  { clave: 'eje 5', dat: '32073', nombre: 'Eje técnico 5', w: 5, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', suelta: true },
  { clave: 'eje 12', dat: '3708', nombre: 'Eje técnico 12', w: 12, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', suelta: true },
  { clave: 'pin', dat: '2780', nombre: 'Pin técnico (con fricción)', w: 1, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', suelta: true },
  { clave: 'pin liso', dat: '3673', nombre: 'Pin técnico liso', w: 1, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', suelta: true },
  { clave: 'pin largo', dat: '6558', nombre: 'Pin técnico largo (3L)', w: 2, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', suelta: true },
  { clave: 'pin eje', dat: '43093', nombre: 'Pin-eje técnico', w: 1, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', suelta: true },
  { clave: 'medio pin', dat: '4274', nombre: 'Medio pin técnico', w: 1, d: 1, alto: 1, studs: 'ninguna', cat: 'Técnicas', suelta: true },
  // --- Ruedas ---
  { clave: 'placa con ruedas 2x2', dat: '4600', nombre: 'Placa 2×2 con pernos de rueda', w: 2, d: 2, alto: 1, studs: 'todas', cat: 'Ruedas' },
  { clave: 'placa con ruedas 1x4', dat: '2926', nombre: 'Placa 1×4 con pernos de rueda', w: 4, d: 1, alto: 1, studs: 'todas', cat: 'Ruedas' },
  { clave: 'llanta chica', dat: '4624', nombre: 'Llanta chica (8mm)', w: 1, d: 1, alto: 2, studs: 'ninguna', cat: 'Ruedas', suelta: true },
  { clave: 'neumatico chico', dat: '3641', nombre: 'Neumático chico', w: 1, d: 1, alto: 2, studs: 'ninguna', cat: 'Ruedas', suelta: true },
  { clave: 'llanta mediana', dat: '6014', nombre: 'Llanta mediana (11mm)', w: 1, d: 1, alto: 2, studs: 'ninguna', cat: 'Ruedas', suelta: true },
  { clave: 'neumatico mediano', dat: '6015', nombre: 'Neumático mediano', w: 1, d: 1, alto: 2, studs: 'ninguna', cat: 'Ruedas', suelta: true },
  // --- Especiales ---
  { clave: 'faro 1x1', dat: '4070', nombre: 'Ladrillo faro 1×1 (headlight)', w: 1, d: 1, alto: 3, studs: 'todas', cat: 'Especiales' },
  { clave: 'ladrillo stud lateral', dat: '87087', nombre: 'Ladrillo 1×1 con stud lateral', w: 1, d: 1, alto: 3, studs: 'todas', cat: 'Especiales' },
  { clave: 'rejilla 1x2', dat: '2877', nombre: 'Ladrillo rejilla 1×2', w: 2, d: 1, alto: 3, studs: 'todas', cat: 'Especiales' },
  { clave: 'techo curvo 1x2', dat: '6091', nombre: 'Ladrillo techo curvo 1×2', w: 2, d: 1, alto: 4, studs: 1, cat: 'Especiales' },
  { clave: 'soporte 1x2', dat: '99780', nombre: 'Soporte (bracket) 1×2 – 1×2', w: 2, d: 1, alto: 1, studs: 'ninguna', cat: 'Especiales' },
  { clave: 'soporte 1x2 arriba', dat: '99207', nombre: 'Soporte invertido 1×2 – 2×2', w: 2, d: 1, alto: 1, studs: 'ninguna', cat: 'Especiales' },
  { clave: 'arco 1x4', dat: '3659', nombre: 'Arco 1×4', w: 4, d: 1, alto: 3, studs: 'todas', cat: 'Especiales' },
  { clave: 'antena', dat: '3957a', nombre: 'Antena 1×1×4', w: 1, d: 1, alto: 12, studs: 'ninguna', cat: 'Especiales' },
  { clave: 'panel 1x2', dat: '4865b', nombre: 'Panel 1×2×1', w: 2, d: 1, alto: 3, studs: 'ninguna', cat: 'Especiales' },
  { clave: 'panel 1x4', dat: '30413', nombre: 'Panel 1×4×1', w: 4, d: 1, alto: 3, studs: 'ninguna', cat: 'Especiales' },
  { clave: 'panel esquina 1x1', dat: '6231', nombre: 'Panel esquina 1×1×1', w: 1, d: 1, alto: 3, studs: 'ninguna', cat: 'Especiales' },
];

// Colores (códigos oficiales de LDraw / LDConfig.ldr + hex aproximado para la interfaz)
export const COLORES = [
  { clave: 'rojo', codigo: 4, nombre: 'Rojo', hex: '#C91A09' },
  { clave: 'azul', codigo: 1, nombre: 'Azul', hex: '#0055BF' },
  { clave: 'amarillo', codigo: 14, nombre: 'Amarillo', hex: '#F2CD37' },
  { clave: 'verde', codigo: 2, nombre: 'Verde', hex: '#237841' },
  { clave: 'verde claro', codigo: 10, nombre: 'Verde claro', hex: '#4B9F4A' },
  { clave: 'lima', codigo: 27, nombre: 'Lima', hex: '#BBE90B' },
  { clave: 'naranja', codigo: 25, nombre: 'Naranja', hex: '#FE8A18' },
  { clave: 'celeste', codigo: 9, nombre: 'Celeste', hex: '#B4D2E3' },
  { clave: 'rosa', codigo: 13, nombre: 'Rosa', hex: '#FC97AC' },
  { clave: 'violeta', codigo: 22, nombre: 'Violeta', hex: '#81007B' },
  { clave: 'blanco', codigo: 15, nombre: 'Blanco', hex: '#F4F4F4' },
  { clave: 'negro', codigo: 0, nombre: 'Negro', hex: '#1B2A34' },
  { clave: 'gris claro', codigo: 71, nombre: 'Gris claro', hex: '#A0A5A9' },
  { clave: 'gris oscuro', codigo: 72, nombre: 'Gris oscuro', hex: '#6C6E68' },
  { clave: 'marron', codigo: 70, nombre: 'Marrón', hex: '#582A12' },
  { clave: 'beige', codigo: 19, nombre: 'Beige', hex: '#E4CD9E' },
];

// --- Búsquedas ---

export function normalizarTexto(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/×/g, 'x')
    .trim();
}

// Sinónimos de la primera palabra (acepta inglés y variantes)
const SINONIMOS = {
  brick: 'ladrillo', bloque: 'ladrillo',
  plate: 'placa', plato: 'placa', chata: 'placa',
  tile: 'lisa', baldosa: 'lisa', azulejo: 'lisa',
  slope: 'pendiente', techo: 'pendiente', rampa: 'pendiente',
  wedge: 'cuna', 'cuña': 'cuna',
  axle: 'eje', technic: 'tecnico', 'técnico': 'tecnico', 'tecnica': 'tecnico',
  wheel: 'llanta', rueda: 'llanta', tire: 'neumatico', 'neumático': 'neumatico', goma: 'neumatico',
  cone: 'cono', round: 'redonda', bracket: 'soporte', arch: 'arco', panel: 'panel',
  grille: 'rejilla', headlight: 'faro', antenna: 'antena',
};

const porClave = new Map(PIEZAS.map(p => [p.clave, p]));
const porDat = new Map(PIEZAS.map(p => [p.dat, p]));

export function buscarPieza(nombre) {
  let n = normalizarTexto(nombre);
  if (porClave.has(n)) return porClave.get(n);
  // probar sinónimo en la primera palabra
  const palabras = n.split(' ');
  if (SINONIMOS[palabras[0]]) {
    palabras[0] = SINONIMOS[palabras[0]];
    n = palabras.join(' ');
    if (porClave.has(n)) return porClave.get(n);
  }
  // "2x4 ladrillo" → "ladrillo 2x4"
  if (palabras.length === 2 && /^\d+x\d+$/.test(palabras[0])) {
    const alReves = palabras[1] + ' ' + palabras[0];
    if (porClave.has(alReves)) return porClave.get(alReves);
  }
  // por número de pieza LDraw
  if (porDat.has(n)) return porDat.get(n);
  return null;
}

const colorPorClave = new Map(COLORES.map(c => [c.clave, c]));
const colorPorCodigo = new Map(COLORES.map(c => [c.codigo, c]));
const SINONIMOS_COLOR = {
  red: 'rojo', blue: 'azul', yellow: 'amarillo', green: 'verde', orange: 'naranja',
  white: 'blanco', black: 'negro', pink: 'rosa', purple: 'violeta', morado: 'violeta',
  lila: 'violeta', brown: 'marron', 'marrón': 'marron', tan: 'beige', crema: 'beige',
  gris: 'gris claro', gray: 'gris claro', grey: 'gris claro', lime: 'lima',
  'azul claro': 'celeste', cian: 'celeste',
};

export function buscarColor(nombre) {
  let n = normalizarTexto(nombre);
  if (colorPorClave.has(n)) return colorPorClave.get(n);
  if (SINONIMOS_COLOR[n]) return colorPorClave.get(SINONIMOS_COLOR[n]);
  if (/^\d+$/.test(n) && colorPorCodigo.has(Number(n))) return colorPorCodigo.get(Number(n));
  return null;
}

export function piezaPorClave(clave) { return porClave.get(clave) || null; }
export function colorPorCodigoLdraw(codigo) { return colorPorCodigo.get(Number(codigo)) || null; }
