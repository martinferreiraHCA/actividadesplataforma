// Redimensionado de imágenes vía canvas.
// Re-codifica la imagen a un ancho objetivo manteniendo la proporción,
// de modo que la versión exportada (dentro del .imscc, Moodle XML, etc.)
// también pese menos.

// Presets de tamaño (ancho en px). "" = tamaño original.
export const PRESETS_TAMANO = [
  { id: 'original', label: 'Original', ancho: 0 },
  { id: 'pequena', label: 'Pequeña (320px)', ancho: 320 },
  { id: 'mediana', label: 'Mediana (480px)', ancho: 480 },
  { id: 'grande', label: 'Grande (720px)', ancho: 720 },
  { id: 'extra', label: 'Extra grande (1024px)', ancho: 1024 }
];

// Lee las dimensiones naturales de un dataUrl.
export function medirImagen(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ ancho: img.naturalWidth, alto: img.naturalHeight });
    img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    img.src = dataUrl;
  });
}

// Redimensiona un dataUrl a un ancho objetivo. Devuelve un nuevo dataUrl.
// - Si anchoObjetivo es 0 o mayor/igual al ancho original, devuelve el original.
// - Los SVG no se rasterizan (no tiene sentido): se devuelven tal cual.
export async function redimensionarDataUrl(dataUrl, anchoObjetivo, tipo) {
  if (tipo === 'image/svg+xml') return dataUrl;
  if (!anchoObjetivo || anchoObjetivo <= 0) return dataUrl;

  const { ancho, alto } = await medirImagen(dataUrl);
  if (anchoObjetivo >= ancho) return dataUrl; // no agrandamos, sólo achicamos

  const escala = anchoObjetivo / ancho;
  const nuevoAncho = Math.round(ancho * escala);
  const nuevoAlto = Math.round(alto * escala);

  const canvas = document.createElement('canvas');
  canvas.width = nuevoAncho;
  canvas.height = nuevoAlto;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';

  const img = await cargarImagen(dataUrl);
  // Fondo blanco para imágenes con transparencia que pasan a JPEG.
  if (tipo === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, nuevoAncho, nuevoAlto);
  }
  ctx.drawImage(img, 0, 0, nuevoAncho, nuevoAlto);

  // GIF se aplana a PNG (canvas no exporta GIF animado).
  const tipoSalida = (tipo === 'image/gif') ? 'image/png' : tipo;
  const calidad = (tipoSalida === 'image/jpeg' || tipoSalida === 'image/webp') ? 0.85 : undefined;
  return canvas.toDataURL(tipoSalida, calidad);
}

function cargarImagen(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
    img.src = dataUrl;
  });
}

// Calcula el peso aproximado en KB de un dataUrl.
export function pesoKbDataUrl(dataUrl) {
  const coma = dataUrl.indexOf(',');
  const base64 = coma >= 0 ? dataUrl.slice(coma + 1) : dataUrl;
  return Math.round((base64.length * 3 / 4) / 1024);
}
