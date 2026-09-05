// Pieza 3D con IA — generador del prompt técnico para pedir un OpenSCAD paramétrico.
//
// La idea: el docente narra la pieza (escrito o por voz) y completa una ficha
// técnica; esta página convierte eso en un prompt largo, preciso y sin
// ambigüedades que le exige a la IA (Claude, ChatGPT, Gemini) devolver un
// archivo .scad con formato Customizer, para que después el editor de esta
// misma página pueda tocar variables, posiciones y textos sin reescribir código.
//
// Todo puro (sin DOM) para poder probarlo en Node.

export const PROCESOS = {
  fdm_pla: {
    nombre: 'Impresión 3D FDM en PLA (boquilla 0,4 mm, capa 0,2 mm)',
    reglas: [
      'Espesor mínimo de pared: 1,2 mm (3 perímetros); recomendado 1,6–2,0 mm en paredes portantes.',
      'Detalles en relieve: mínimo 0,8 mm de ancho y 0,4 mm de alto; grabados: mínimo 0,6 mm de ancho y 0,4 mm de profundidad.',
      'Agujeros: sumar 0,2–0,3 mm al diámetro nominal (el FDM cierra los agujeros); para tornillos M3 pasante usar 3,4 mm, M4 4,5 mm, M5 5,5 mm.',
      'Encastres: holgura de 0,2 mm por lado para ajuste firme, 0,3–0,4 mm para deslizante.',
      'Evitar voladizos mayores a 45° sin soporte; puentes de hasta 30 mm; preferir chaflanes de 45° a arcos invertidos.',
      'La cara de apoyo en la cama tiene que ser plana y estar en z = 0; agregar un chaflán de 0,5–0,8 mm en la arista de apoyo para compensar la "pata de elefante".',
      'Textos: letra de altura ≥ 5 mm para relieve y ≥ 6 mm para grabado; profundidad 0,6–1,0 mm; fuentes sans-serif gruesas.'
    ]
  },
  fdm_petg: {
    nombre: 'Impresión 3D FDM en PETG (boquilla 0,4 mm, capa 0,2 mm)',
    reglas: [
      'Espesor mínimo de pared: 1,2 mm; recomendado 1,6–2,4 mm (el PETG flexiona más que el PLA).',
      'Agujeros: sumar 0,3 mm al diámetro nominal; encastres con holgura de 0,25–0,35 mm por lado.',
      'Evitar voladizos mayores a 45° sin soporte; puentes de hasta 25 mm.',
      'Cara de apoyo plana en z = 0 con chaflán de 0,6 mm en la arista de apoyo.',
      'Textos: altura ≥ 5 mm; relieve/grabado de 0,6–1,0 mm.'
    ]
  },
  resina: {
    nombre: 'Impresión 3D en resina (SLA/MSLA, píxel ~50 µm)',
    reglas: [
      'Espesor mínimo de pared: 1,0 mm (1,5 mm si la pieza es grande); huecos cerrados necesitan al menos dos orificios de drenaje de 2 mm.',
      'Detalles mínimos de 0,3 mm; textos de altura ≥ 3 mm con relieve/grabado de 0,3–0,5 mm.',
      'Agujeros: sumar 0,1–0,15 mm al diámetro nominal; encastres con holgura de 0,1–0,15 mm por lado.',
      'Evitar grandes superficies planas paralelas a la base (ventosa); si es inevitable, indicarlo en un comentario.'
    ]
  },
  laser: {
    nombre: 'Corte láser 2D en MDF/acrílico (la pieza es un perfil extruido al espesor de la plancha)',
    reglas: [
      'Toda la geometría debe salir de perfiles 2D extruidos con linear_extrude(altura = espesor_plancha); sin voladizos ni curvas en Z.',
      'Definir la variable espesor_plancha (3 mm por defecto) y usarla para todos los encastres tipo pestaña/ranura, con holgura_corte (0,1 mm) para el ancho del haz.',
      'Radios interiores ≥ 1 mm; no dejar piezas sueltas menores a 5 mm.',
      'Incluir un módulo plano_de_corte() que disponga todas las piezas en 2D (projection o directamente los perfiles) para exportar a DXF/SVG.'
    ]
  },
  cnc: {
    nombre: 'Mecanizado CNC de 3 ejes (madera, plástico, aluminio blando)',
    reglas: [
      'Toda la geometría debe ser alcanzable desde arriba (+Z) con una fresa de 3 mm; radios interiores ≥ 1,6 mm; sin socavados.',
      'Definir diametro_fresa como variable y usarlo para dimensionar radios interiores y ranuras.',
      'Profundidades de bolsillo ≤ 3 × diámetro de fresa por pasada indicada en comentario.'
    ]
  },
  generico: {
    nombre: 'Fabricación no especificada (modelo geométrico general)',
    reglas: [
      'Espesor mínimo de pared: 1,5 mm; evitar caras de espesor cero y aristas coincidentes.',
      'Agujeros y encastres con la holgura declarada en la variable holgura.'
    ]
  }
};

export const CALIDADES = {
  '32': 'borrador (rápido de renderizar)',
  '64': 'normal',
  '96': 'alta',
  '128': 'máxima (superficies curvas muy suaves)'
};

const FUENTES = 'Liberation Sans, Liberation Sans:style=Bold, Liberation Mono';

function limpiar(t) {
  return String(t || '').replace(/\r/g, '').trim();
}

function coma(n) {
  return String(n).replace('.', ',');
}

function dimensionesTexto(f) {
  const partes = [];
  if (f.largo) partes.push(`largo (eje X) = ${coma(f.largo)} mm`);
  if (f.ancho) partes.push(`ancho (eje Y) = ${coma(f.ancho)} mm`);
  if (f.alto) partes.push(`alto (eje Z) = ${coma(f.alto)} mm`);
  if (!partes.length) return null;
  const tipo = f.dimensionesExactas ? 'EXACTAS (no cambiarlas)' : 'de referencia (la IA puede ajustarlas hasta ±10 % si la geometría lo pide, declarándolo)';
  return `Dimensiones exteriores ${tipo}: ${partes.join(', ')}.`;
}

function textosTexto(textos) {
  const lista = (textos || []).filter(t => limpiar(t.contenido));
  if (!lista.length) return null;
  const filas = lista.map((t, i) => {
    const n = i + 1;
    const modo = { relieve: 'en relieve (sobresale)', grabado: 'grabado (hundido)', calado: 'calado (atraviesa la pared)' }[t.modo] || 'en relieve (sobresale)';
    return `  ${n}. texto_${n} = "${limpiar(t.contenido).replace(/"/g, '\\"')}" · ${modo} · altura de letra ${t.tamano ? coma(t.tamano) + ' mm' : 'a decidir (≥ 5 mm)'} · profundidad/relieve ${t.profundidad ? coma(t.profundidad) + ' mm' : '0,8 mm'} · ubicación: ${limpiar(t.ubicacion) || 'la cara más visible, centrado'} · fuente: ${limpiar(t.fuente) || 'Liberation Sans:style=Bold'}`;
  });
  return `Textos que lleva la pieza (cada uno con sus variables de contenido, tamaño, profundidad, posición, rotación, fuente y modo):\n${filas.join('\n')}`;
}

// Devuelve una lista de {nivel:'falta'|'ojo', texto} con lo que la narración
// deja ambiguo, para que el docente lo complete ANTES de pedirle nada a la IA.
export function analizarNarracion(narracion, ficha = {}) {
  const t = limpiar(narracion);
  const bajo = t.toLowerCase();
  const avisos = [];
  const tieneNumeros = /\d/.test(t);
  const tieneUnidades = /\b(mm|milímetros?|milimetros?|cm|centímetros?|centimetros?|pulgadas?)\b/i.test(t);
  const hayDimsFicha = ficha.largo || ficha.ancho || ficha.alto;

  if (t.length < 120) avisos.push({ nivel: 'falta', texto: 'La narración es muy breve: contá qué es, para qué sirve, cómo se usa, qué forma general tiene y qué tiene cada cara.' });
  if (!tieneNumeros && !hayDimsFicha) avisos.push({ nivel: 'falta', texto: 'No hay ninguna medida. Sin números la IA inventa el tamaño: indicá al menos largo, ancho y alto.' });
  else if (tieneNumeros && !tieneUnidades && !hayDimsFicha) avisos.push({ nivel: 'ojo', texto: 'Hay números pero no unidades: aclará que son milímetros (o completá las dimensiones en la ficha).' });
  if (!hayDimsFicha) avisos.push({ nivel: 'ojo', texto: 'Completá largo, ancho y alto en la ficha: se pasan a la IA como dimensiones exteriores y quedan como variables.' });
  const agujeroSinMedida = [...bajo.matchAll(/(agujeros?|orificios?|perforaci[oó]n(?:es)?|taladros?)([^.\n]{0,90})/g)].some(m => !/di[aá]metro|ø|\bm\d|\d[\d,.]*\s*(mm|×|x\b|milímetros|milimetros)/.test(m[2]));
  if (agujeroSinMedida && !/di[aá]metro|ø|\bM\d/.test(t)) avisos.push({ nivel: 'falta', texto: 'Mencionás agujeros pero no su diámetro. Decí el diámetro (o el tornillo: M3, M4…) y dónde van.' });
  if (/encastr|encaj|ajust|calc[ea]|inserto|tapa|acopl/.test(bajo) && !ficha.holgura && !/holgura|tolerancia|juego/.test(bajo)) avisos.push({ nivel: 'ojo', texto: 'Hay encastres o piezas que encajan: indicá la holgura (por ejemplo 0,2 mm por lado) o completala en la ficha.' });
  if (/pared|hueco|cavidad|caja|recipiente|vaso|estuche/.test(bajo) && !ficha.pared && !/espesor|grosor/.test(bajo)) avisos.push({ nivel: 'ojo', texto: 'Hay paredes o cavidades: indicá el espesor de pared (o dejá el de la ficha).' });
  if (/texto|letra|nombre|inscripci|grabad|logo|palabra/.test(bajo) && !(ficha.textos || []).some(x => limpiar(x.contenido))) avisos.push({ nivel: 'falta', texto: 'Hablás de textos o letras pero no cargaste ninguno en la ficha: escribí exactamente qué dice, su tamaño y dónde va.' });
  if (!/arriba|abajo|frente|adelante|atr[aá]s|lateral|costado|cara|base|tapa|superior|inferior|izquierd|derech/.test(bajo)) avisos.push({ nivel: 'ojo', texto: 'No se nombra ninguna cara (arriba, frente, base, costado…): decí en qué cara va cada detalle para que no haya dudas.' });
  if (/redonde|chafl|filete|radio/.test(bajo) && !/\d\s*(mm|milímetros|milimetros)/.test(bajo) && !hayDimsFicha) avisos.push({ nivel: 'ojo', texto: 'Pedís redondeos o chaflanes: indicá el radio o el tamaño en mm.' });
  if (!/imprim|impres|láser|laser|cnc|cortad|fabric|material|pla|petg|resina|madera|mdf|acr[ií]lico/.test(bajo) && !ficha.proceso) avisos.push({ nivel: 'ojo', texto: 'No decís cómo se va a fabricar: elegí el proceso en la ficha (impresión 3D, láser, CNC).' });
  return avisos;
}

// Prompt principal: pieza nueva desde cero.
export function generarPromptPieza(datos) {
  const f = datos.ficha || {};
  const narracion = limpiar(datos.narracion) || '(sin narración: usá SOLO la ficha técnica)';
  const proceso = PROCESOS[f.proceso] || PROCESOS.fdm_pla;
  const holgura = f.holgura ? coma(f.holgura) : '0,2';
  const pared = f.pared ? coma(f.pared) : '1,6';
  const calidad = String(f.calidad || 64);
  const nombre = limpiar(f.nombre) || 'pieza';
  const nombreArchivo = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'pieza';
  const restricciones = [];
  if (f.sinSoportes !== false) restricciones.push('Tiene que imprimirse SIN soportes en la orientación en que está modelada (la cara de apoyo en z = 0, hacia −Z).');
  if (f.aristas) restricciones.push('Todas las aristas exteriores verticales llevan redondeo (variable radio_aristas), las de apoyo un chaflán (variable chaflan_base).');
  if (f.hueca) restricciones.push('La pieza es hueca / aliviada por dentro con espesor de pared uniforme (variable espesor_pared); sin cavidades cerradas sin salida.');
  if (f.simetrica) restricciones.push('La pieza es simétrica respecto del plano YZ (x = 0): modelá una mitad y usá mirror(), o centrá todo en X.');
  if (f.textosLegibles !== false && (f.textos || []).some(t => limpiar(t.contenido))) restricciones.push('Los textos se leen correctamente desde el punto de vista de quien mira la cara donde están (no espejados), con su base paralela a una arista de la pieza.');
  if (limpiar(f.restricciones)) restricciones.push(limpiar(f.restricciones));

  const ficha = [
    `Nombre de la pieza: ${nombre}.`,
    limpiar(f.funcion) ? `Función y contexto de uso: ${limpiar(f.funcion)}` : null,
    dimensionesTexto(f),
    `Proceso de fabricación: ${proceso.nombre}.`,
    `Holgura para encastres y agujeros: ${holgura} mm por lado (variable holgura).`,
    `Espesor de pared por defecto: ${pared} mm (variable espesor_pared).`,
    `Calidad de las curvas: $fn = ${calidad} (${CALIDADES[calidad] || 'personalizada'}); la variable se llama calidad y $fn = calidad.`,
    textosTexto(f.textos),
    limpiar(f.elementos) ? `Elementos y detalles que debe tener (cada uno con posición explícita):\n${limpiar(f.elementos).split('\n').map(l => '  - ' + l.replace(/^\s*[-•*]\s*/, '')).join('\n')}` : null,
    limpiar(f.ajustables) ? `Lo que el docente quiere poder ajustar después SIN tocar el código (tienen que ser variables Customizer con rango):\n${limpiar(f.ajustables).split('\n').map(l => '  - ' + l.replace(/^\s*[-•*]\s*/, '')).join('\n')}` : null,
    restricciones.length ? `Restricciones:\n${restricciones.map(r => '  - ' + r).join('\n')}` : null
  ].filter(Boolean).join('\n');

  return `Actuá como un ingeniero de diseño mecánico y experto en OpenSCAD con años de experiencia preparando piezas para fabricación digital en escuelas. Tu única tarea es entregar UN archivo OpenSCAD completo, paramétrico, listo para renderizar (F6) y exportar a STL, que materialice EXACTAMENTE la pieza descripta abajo. No escribas explicaciones largas, no ofrezcas alternativas, no hagas preguntas: si algo no está definido, decidilo con criterio de ingeniería, dejalo como variable y marcá la decisión en el comentario con la palabra SUPUESTO.

════════════════════════════════════════
1 · DESCRIPCIÓN NARRADA POR EL DISEÑADOR (fuente de verdad; respetá cada detalle)
════════════════════════════════════════
${narracion}

════════════════════════════════════════
2 · FICHA TÉCNICA
════════════════════════════════════════
${ficha}

════════════════════════════════════════
3 · REGLAS DE FABRICACIÓN QUE EL MODELO TIENE QUE CUMPLIR
════════════════════════════════════════
${proceso.reglas.map(r => '- ' + r).join('\n')}
- Verificá cada espesor, diámetro y holgura contra estas reglas y, si la narración pide algo que las viola, cumplí la narración pero avisalo en un comentario "// ATENCIÓN:" junto a la variable.

════════════════════════════════════════
4 · CÓMO RESOLVER LO QUE NO ESTÁ ESPECIFICADO
════════════════════════════════════════
- NO preguntes. Elegí el valor más razonable para la función descripta, ponelo en una variable y comentalo: "// SUPUESTO: ...".
- Unidades: todo en milímetros. Ángulos en grados. Nada de pulgadas.
- Si hay contradicción entre la narración y la ficha, priorizá la ficha para medidas exactas y la narración para forma, función y ubicación de detalles; dejá la duda documentada con "// CONFLICTO:".
- Si un detalle no tiene posición dicha, ubicalo donde la función lo pide (por ejemplo, un agujero de colgar centrado en la parte superior) y declaralo como vector de posición editable.

════════════════════════════════════════
5 · REQUISITOS DEL CÓDIGO (obligatorios; el archivo se abre en un editor que lee este formato)
════════════════════════════════════════
5.1 Formato Customizer de OpenSCAD, al pie de la letra:
    - TODAS las magnitudes son variables declaradas al principio del archivo, antes de cualquier module o function. Ningún número "mágico" dentro de los módulos: si hace falta un valor, es una variable o se deriva de otras.
    - Las variables van agrupadas con encabezados /* [Nombre del grupo] */ en este orden: [Dimensiones generales], [Detalles] (agujeros, ranuras, nervios…), [Posiciones], [Textos], [Fabricación], [Calidad] y al final /* [Hidden] */ para las derivadas.
    - Cada variable ocupa UNA sola línea con este patrón exacto:
        // Descripción breve en español, con la unidad
        nombre_variable = valor; // [minimo:paso:maximo]
      Para números usá el rango [min:paso:max]; para opciones cerradas una lista [valor1:Etiqueta 1, valor2:Etiqueta 2]; para booleanos true/false sin rango; para textos una cadena entre comillas dobles sin rango.
    - Nombres en snake_case, en español, con la unidad o el sentido en el nombre cuando ayude (ej.: largo_total, diametro_agujero, alto_letra, pos_texto_1).
    - Los valores iniciales tienen que ser los de la ficha/narración (no aproximaciones).
5.2 Posiciones y rotaciones editables:
    - Cada elemento que se ubica (agujero, ranura, texto, saliente, logo…) tiene su posición como un vector [x, y, z] en el grupo [Posiciones] (ej.: pos_agujero_1 = [10, 0, 5]; // posición del agujero 1 en mm) y, si aplica, su rotación como rot_… = [rx, ry, rz] en grados.
    - Las posiciones se miden desde el ORIGEN de la pieza, que definís así: la pieza apoya en z = 0, y su centro en planta está en x = 0, y = 0 (usá center = true en la planta). Decilo en el comentario de cabecera.
    - Los elementos repetidos (varios agujeros iguales) se generan con un for() a partir de cantidad, separación y una posición inicial, todas variables.
5.3 Textos:
    - Cada texto tiene sus variables: texto_N (contenido), alto_letra_N (mm), relieve_texto_N (mm, positivo relieve / negativo grabado), fuente_texto_N (cadena), pos_texto_N (vector), rot_texto_N (vector) y un booleano mostrar_texto_N.
    - Usá text(texto_N, size = alto_letra_N, font = fuente_texto_N, halign = "center", valign = "center") dentro de linear_extrude(). Fuentes disponibles en el editor: ${FUENTES}; si no se pide otra, usá "Liberation Sans:style=Bold".
    - Relieve: union() con la pieza, solapando 0,01 mm hacia adentro. Grabado: difference() con profundidad + 0,01 mm para evitar caras coplanares.
5.4 Geometría sana:
    - El resultado tiene que ser un único sólido manifold (una sola pieza conectada, salvo que la narración pida varias, en cuyo caso cada una es un módulo y una variable "mostrar" con opción para imprimir juntas o separadas).
    - Definí epsilon = 0.01; y usalo en toda difference()/union() para evitar caras coplanares y paredes de espesor cero (los cortes atraviesan epsilon de más; los agregados se hunden epsilon).
    - Sin cavidades internas cerradas accidentales; sin sólidos flotantes; sin geometría degenerada (radios 0, alturas 0).
    - Usá hull(), minkowski() y offset() con criterio (minkowski solo con esferas pequeñas y $fn bajo si hace falta redondear; preferí cilindros en las esquinas + hull() para cajas redondeadas: es mucho más rápido).
    - assert() al principio para las restricciones geométricas (ej.: assert(diametro_agujero + 2*espesor_pared < ancho_total, "el agujero no cabe en el ancho")), con mensajes en español.
    - echo() al final con las medidas exteriores reales (largo, ancho, alto) y el volumen aproximado si es fácil, para verificar contra la ficha.
5.5 Estructura y estilo:
    - Un módulo por cada parte lógica (cuerpo(), agujeros(), textos(), etc.) con parámetros explícitos cuando tenga sentido, y un módulo final pieza() que arma todo; la última línea del archivo es la llamada pieza();.
    - Comentario de cabecera (máximo 12 líneas): nombre, qué es, orientación de impresión, origen de coordenadas y lista de los módulos.
    - Solo OpenSCAD estándar (versión 2021.01): nada de librerías externas (no BOSL, no MCAD, no include/use), nada de funciones experimentales.
    - Código indentado con 4 espacios, sin líneas de más de 110 caracteres, sin código muerto.
    - Tiene que renderizar con F6 en menos de un minuto con calidad = ${calidad}: evitá minkowski sobre geometría compleja y bucles con cientos de elementos.

════════════════════════════════════════
6 · ESQUELETO OBLIGATORIO DEL ARCHIVO (rellenalo; no cambies el formato de las variables)
════════════════════════════════════════
// ${nombre} — descripción en una línea
// Orientación: apoya en z = 0. Origen: centro de la planta (x = 0, y = 0).
// Módulos: cuerpo(), detalles(), textos(), pieza()

/* [Dimensiones generales] */
// Largo total de la pieza (eje X), en mm
largo_total = ${f.largo ? coma(f.largo).replace(',', '.') : 60}; // [10:0.5:300]
// ...

/* [Detalles] */
// ...

/* [Posiciones] */
// Posición del elemento 1 desde el origen, en mm [x, y, z]
pos_elemento_1 = [0, 0, 0];
// ...

/* [Textos] */
// Texto 1
texto_1 = "TEXTO";
// Altura de la letra del texto 1, en mm
alto_letra_1 = 6; // [3:0.5:30]
// Relieve del texto 1 en mm (negativo = grabado)
relieve_texto_1 = 0.8; // [-3:0.1:3]
// ...

/* [Fabricación] */
// Holgura por lado para encastres y agujeros, en mm
holgura = ${holgura.replace(',', '.')}; // [0:0.05:1]
// Espesor de pared, en mm
espesor_pared = ${pared.replace(',', '.')}; // [0.8:0.1:6]

/* [Calidad] */
// Segmentos por círculo (más = más suave, más lento)
calidad = ${calidad}; // [16:8:192]

/* [Hidden] */
$fn = calidad;
epsilon = 0.01;
// variables derivadas...

module cuerpo() { ... }
module detalles() { ... }
module textos() { ... }
module pieza() {
    difference() {
        union() { cuerpo(); /* relieves */ }
        detalles(); /* grabados */
    }
}

pieza();
echo(str("Medidas exteriores: ", largo_total, " x ", ..., " mm"));

════════════════════════════════════════
7 · VERIFICÁ ANTES DE RESPONDER (recorré esta lista y corregí lo que falle)
════════════════════════════════════════
[ ] Cada detalle de la narración aparece en el código y en la posición indicada.
[ ] Cada medida de la ficha es el valor inicial de una variable con ese nombre reconocible.
[ ] Ningún número literal dentro de los módulos que no sea 0, 1, 2, 90, 180, 360 o epsilon.
[ ] Cada variable tiene su comentario de descripción en la línea anterior y su rango o lista.
[ ] Las posiciones y rotaciones de todos los elementos y textos son vectores editables.
[ ] Los textos usan las variables de contenido, tamaño, relieve, fuente, posición y rotación.
[ ] difference() y union() usan epsilon; no hay caras coplanares.
[ ] La pieza apoya en z = 0 y se imprime sin soportes (o el comentario ATENCIÓN explica por qué no).
[ ] Los assert() protegen las combinaciones imposibles y los echo() muestran las medidas finales.
[ ] El código compila mentalmente: paréntesis, llaves y punto y coma cerrados; sin variables sin definir; sin include/use.

════════════════════════════════════════
8 · FORMATO DE LA RESPUESTA
════════════════════════════════════════
Primero, entre 3 y 6 líneas de resumen: qué modelaste, qué decidiste por tu cuenta (SUPUESTO) y qué conviene revisar.
Después UN ÚNICO bloque de código \`\`\`openscad con el archivo completo, de principio a fin, sin cortes ni "..." ni "el resto igual". Nombre sugerido del archivo: ${nombreArchivo}.scad.
Al final, una tabla breve (variable · valor · para qué sirve) con las 8 a 15 variables que más conviene ajustar.
Nada más.`;
}

// Prompt de ajuste: manda el código actual y pide cambios concretos manteniendo la estructura.
export function generarPromptAjuste(codigo, pedido, opciones = {}) {
  const cod = limpiar(codigo);
  const ped = limpiar(pedido) || '(describí acá el cambio)';
  const errores = limpiar(opciones.errores);
  return `Actuá como el mismo ingeniero experto en OpenSCAD que escribió el archivo de abajo. Tenés que devolver el archivo COMPLETO corregido, manteniendo el formato Customizer, los nombres de las variables existentes (para no romper los ajustes ya hechos por el docente) y la misma estructura de módulos. Solo agregá variables nuevas si el cambio lo exige, con su comentario y su rango como las demás.

CAMBIOS PEDIDOS (aplicalos todos, con precisión, sin inventar otros):
${ped}
${errores ? `
ERRORES O AVISOS QUE DIO OPENSCAD AL RENDERIZAR (arreglalos de raíz):
${errores}
` : ''}
REGLAS
- No preguntes; si falta un dato, elegí con criterio de ingeniería, dejalo como variable y marcalo con "// SUPUESTO:".
- Marcá cada línea que cambies o agregues con un comentario al final "// CAMBIO" para que se pueda revisar.
- Mantené epsilon en las operaciones booleanas, los assert(), los echo() y la orientación (apoya en z = 0, origen en el centro de la planta).
- Solo OpenSCAD 2021.01 estándar, sin librerías externas.
- Verificá que el archivo compile: paréntesis, llaves y punto y coma; ninguna variable sin definir.

FORMATO DE LA RESPUESTA
Dos o tres líneas diciendo qué cambiaste y UN ÚNICO bloque \`\`\`openscad con el archivo completo (sin "..." ni fragmentos). Nada más.

ARCHIVO ACTUAL
\`\`\`openscad
${cod}
\`\`\``;
}
