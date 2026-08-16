// protocolos-texto.js — El formato de texto de los protocolos.
//
// Un protocolo se puede escribir (o pedirle a una IA) en texto plano, con la
// misma lógica que el formato de cuestionarios de la plataforma: encabezados
// con «#», secciones con «##» y listas con «-». Este módulo traduce en los dos
// sentidos —texto ⇄ objeto— y arma el prompt para pedirlo a una IA.

import { textoAInstrumento, instrumentoATexto } from './instrumentos.js';

// ============================================================
// Un protocolo vacío
// ============================================================
export function protocoloVacio() {
  return {
    meta: { titulo: '', asignatura: '', nivel: '', duracion: '', docente: '', grupo: '', fecha: '' },
    fundamento: '',
    objetivos: [],
    materiales: [],
    instrumentos: [],
    sustancias: [],
    seguridad: [],
    montaje: { texto: '', imagen: '' },
    procedimiento: [],
    tablas: [],
    calculos: [],
    preguntas: [],
    conclusiones: { guia: '', lineas: 8 },
    notasDocente: []
  };
}

// Las referencias de la escena de un paso: «i2» es el instrumento 2 y «s1» la
// sustancia 1, contando desde 1 tal como se ven en el editor.
export function refEscena(txt) {
  const m = String(txt || '').trim().match(/^([is])\s*(\d+)$/i);
  if (!m) return null;
  return { lista: m[1].toLowerCase() === 'i' ? 'instrumentos' : 'sustancias', indice: Number(m[2]) - 1 };
}

// Completa lo que falte: así un JSON viejo o a medio escribir no rompe nada.
export function normalizarProtocolo(p) {
  const base = protocoloVacio();
  if (!p || typeof p !== 'object') return base;
  const r = base;
  Object.keys(base.meta).forEach(k => { if (p.meta && p.meta[k] != null) r.meta[k] = String(p.meta[k]); });
  if (typeof p.fundamento === 'string') r.fundamento = p.fundamento;
  if (Array.isArray(p.objetivos)) r.objetivos = p.objetivos.map(String);
  if (Array.isArray(p.seguridad)) r.seguridad = p.seguridad.map(String);
  if (Array.isArray(p.preguntas)) r.preguntas = p.preguntas.map(String);
  if (Array.isArray(p.materiales)) r.materiales = p.materiales.map(m => ({
    cantidad: String(m.cantidad || ''), nombre: String(m.nombre || ''), detalle: String(m.detalle || '')
  }));
  if (Array.isArray(p.instrumentos)) r.instrumentos = p.instrumentos
    .map(i => (i && i.id ? { id: i.id, params: i.params || {}, nota: String(i.nota || '') } : null))
    .filter(Boolean);
  if (Array.isArray(p.sustancias)) r.sustancias = p.sustancias
    .map(i => (i && i.id ? { id: i.id, params: i.params || {}, nota: String(i.nota || '') } : null))
    .filter(Boolean);
  if (Array.isArray(p.notasDocente)) r.notasDocente = p.notasDocente.map(String);
  if (p.montaje) r.montaje = { texto: String(p.montaje.texto || ''), imagen: String(p.montaje.imagen || '') };
  if (Array.isArray(p.procedimiento)) r.procedimiento = p.procedimiento.map(s => ({
    titulo: String(s.titulo || ''),
    texto: String(s.texto || ''),
    // «instrumento» era un solo índice en la primera versión; ahora la escena
    // es una lista de referencias, y lo viejo se traduce al abrir.
    escena: Array.isArray(s.escena) ? s.escena.map(String).filter(x => refEscena(x))
      : (s.instrumento !== undefined && s.instrumento !== '' ? ['i' + (Number(s.instrumento) + 1)] : []),
    nota: String(s.nota || '')
  }));
  if (Array.isArray(p.tablas)) r.tablas = p.tablas.map(t => ({
    titulo: String(t.titulo || ''),
    filas: Math.max(1, Math.min(40, Number(t.filas) || 5)),
    columnas: (Array.isArray(t.columnas) ? t.columnas : []).map(c => ({
      nombre: String(c.nombre || ''), unidad: String(c.unidad || ''), incertidumbre: String(c.incertidumbre || '')
    }))
  }));
  if (Array.isArray(p.calculos)) r.calculos = p.calculos.map(c => ({
    nombre: String(c.nombre || ''), formula: String(c.formula || ''), unidad: String(c.unidad || ''), descripcion: String(c.descripcion || '')
  }));
  if (p.conclusiones) r.conclusiones = {
    guia: String(p.conclusiones.guia || ''),
    lineas: Math.max(0, Math.min(30, Number(p.conclusiones.lineas) || 8))
  };
  return r;
}

// ============================================================
// Objeto → texto
// ============================================================
export function protocoloATexto(p) {
  const l = [];
  const meta = [
    ['Protocolo', p.meta.titulo], ['Asignatura', p.meta.asignatura], ['Nivel', p.meta.nivel],
    ['Duración', p.meta.duracion], ['Docente', p.meta.docente], ['Grupo', p.meta.grupo]
  ];
  meta.forEach(([k, v]) => { if (v) l.push(`# ${k}: ${v}`); });

  if (p.fundamento) { l.push('', '## Fundamento', p.fundamento.trim()); }

  if (p.objetivos.length) { l.push('', '## Objetivos'); p.objetivos.forEach(o => l.push('- ' + o)); }

  if (p.materiales.length) {
    l.push('', '## Materiales');
    p.materiales.forEach(m => {
      let t = '- ' + [m.cantidad, m.nombre].filter(Boolean).join(' ');
      if (m.detalle) t += ' :: ' + m.detalle;
      l.push(t);
    });
  }

  if (p.instrumentos.length) {
    l.push('', '## Instrumentos');
    p.instrumentos.forEach(i => {
      let t = '- ' + instrumentoATexto(i.id, i.params);
      if (i.nota) t += ' :: ' + i.nota;
      l.push(t);
    });
  }

  if (p.sustancias.length) {
    l.push('', '## Sustancias');
    p.sustancias.forEach(i => {
      let t = '- ' + instrumentoATexto(i.id, i.params);
      if (i.nota) t += ' :: ' + i.nota;
      l.push(t);
    });
  }

  if (p.seguridad.length) { l.push('', '## Seguridad'); p.seguridad.forEach(s => l.push('- ' + s)); }

  if (p.montaje.texto) { l.push('', '## Montaje', p.montaje.texto.trim()); }

  if (p.procedimiento.length) {
    l.push('', '## Procedimiento');
    p.procedimiento.forEach((s, i) => {
      const partes = [];
      if (s.titulo) partes.push(s.titulo);
      partes.push(s.texto);
      let t = (i + 1) + '. ' + partes.join(' :: ');
      if (s.escena && s.escena.length) t += ' :: escena: ' + s.escena.join(' ');
      if (s.nota) t += ' :: nota: ' + s.nota;
      l.push(t);
    });
  }

  if (p.tablas.length) {
    l.push('', '## Tablas');
    p.tablas.forEach(t => {
      l.push('### ' + (t.titulo || 'Tabla de datos'));
      l.push('| ' + t.columnas.map(c => {
        let s = c.nombre;
        if (c.unidad) s += ' (' + c.unidad + ')';
        if (c.incertidumbre) s += ' ± ' + c.incertidumbre;
        return s;
      }).join(' | ') + ' |');
      l.push('filas: ' + t.filas);
    });
  }

  if (p.calculos.length) {
    l.push('', '## Cálculos');
    p.calculos.forEach(c => {
      l.push('- ' + [c.nombre, c.formula, c.unidad, c.descripcion].filter(Boolean).join(' :: '));
    });
  }

  if (p.preguntas.length) { l.push('', '## Preguntas'); p.preguntas.forEach(q => l.push('- ' + q)); }

  l.push('', '## Conclusiones', 'líneas: ' + p.conclusiones.lineas);
  if (p.conclusiones.guia) l.push('Guía: ' + p.conclusiones.guia);

  if (p.notasDocente.length) {
    l.push('', '## Notas para el docente');
    p.notasDocente.forEach(n => l.push('- ' + n));
  }

  return l.join('\n').trim() + '\n';
}

// ============================================================
// Texto → objeto
// ============================================================
// Los nombres de sección se comparan sin tildes y en minúsculas, así que
// alcanza con la versión "pelada" de cada sinónimo.
const ALIAS = {
  fundamento: 'fundamento', 'fundamento teorico': 'fundamento',
  marco: 'fundamento', 'marco teorico': 'fundamento', teoria: 'fundamento',
  objetivos: 'objetivos', objetivo: 'objetivos',
  materiales: 'materiales', 'materiales e instrumentos': 'materiales', material: 'materiales',
  instrumentos: 'instrumentos', instrumental: 'instrumentos',
  sustancias: 'sustancias', reactivos: 'sustancias', 'sustancias y reactivos': 'sustancias', frascos: 'sustancias',
  'notas para el docente': 'notasDocente', 'notas del docente': 'notasDocente', 'para el docente': 'notasDocente',
  'notas didacticas': 'notasDocente', 'notas': 'notasDocente',
  seguridad: 'seguridad', 'normas de seguridad': 'seguridad', precauciones: 'seguridad',
  montaje: 'montaje', 'montaje experimental': 'montaje', 'dispositivo experimental': 'montaje', esquema: 'montaje',
  procedimiento: 'procedimiento', 'paso a paso': 'procedimiento', desarrollo: 'procedimiento', metodo: 'procedimiento',
  tablas: 'tablas', tabla: 'tablas', datos: 'tablas', 'toma de datos': 'tablas', 'registro de datos': 'tablas',
  'toma y registro de datos': 'tablas',
  calculos: 'calculos', 'calculos y resultados': 'calculos',
  preguntas: 'preguntas', 'preguntas de analisis': 'preguntas', analisis: 'preguntas',
  conclusiones: 'conclusiones', conclusion: 'conclusiones'
};

const META_ALIAS = {
  protocolo: 'titulo', titulo: 'titulo', practico: 'titulo',
  asignatura: 'asignatura', materia: 'asignatura', area: 'asignatura',
  nivel: 'nivel', curso: 'nivel', grado: 'nivel',
  duracion: 'duracion', tiempo: 'duracion',
  docente: 'docente', profesor: 'docente',
  grupo: 'grupo', clase: 'grupo',
  fecha: 'fecha'
};

function sinAcentos(s) {
  return s.normalize ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s;
}

function clave(s) { return sinAcentos(String(s).toLowerCase().trim()).replace(/\s+/g, ' '); }

// «m (g) ± 0,1» → {nombre:'m', unidad:'g', incertidumbre:'0,1'}
function parsearColumna(txt) {
  let s = String(txt).trim();
  let incertidumbre = '';
  const pm = s.split(/±|\+\/-/);
  if (pm.length > 1) { s = pm[0].trim(); incertidumbre = pm[1].trim(); }
  let unidad = '';
  const par = s.match(/^(.*)\(([^()]*)\)\s*$/);
  if (par) { s = par[1].trim(); unidad = par[2].trim(); }
  return { nombre: s, unidad, incertidumbre };
}

export function parsearProtocolo(texto) {
  const p = protocoloVacio();
  const lineas = String(texto || '').replace(/\r/g, '').split('\n');
  let seccion = null;
  let tablaActual = null;
  const parrafos = { fundamento: [], montaje: [] };

  lineas.forEach(cruda => {
    const linea = cruda.trim();

    // encabezados de metadatos: «# Clave: valor»
    const meta = linea.match(/^#\s+([^:#]+):\s*(.*)$/);
    if (meta && !/^#{2,}/.test(linea)) {
      const k = META_ALIAS[clave(meta[1])];
      if (k) { p.meta[k] = meta[2].trim(); return; }
    }

    // secciones: «## Nombre»
    const sec = linea.match(/^#{2,3}\s+(.+)$/);
    if (sec) {
      const nombre = clave(sec[1].replace(/[:.]$/, ''));
      const destino = ALIAS[nombre];
      if (destino) { seccion = destino; tablaActual = null; return; }
      // «### Título» dentro de Tablas abre una tabla nueva
      if (seccion === 'tablas' && /^#{3}/.test(linea)) {
        tablaActual = { titulo: sec[1].trim(), columnas: [], filas: 5 };
        p.tablas.push(tablaActual);
        return;
      }
      // un «##» desconocido: se ignora el encabezado pero no el contenido
      return;
    }

    if (!seccion || !linea) {
      if (seccion === 'fundamento' || seccion === 'montaje') parrafos[seccion].push('');
      return;
    }

    const item = linea.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '');
    const esItem = /^[-*•]\s+/.test(linea) || /^\d+[.)]\s+/.test(linea);

    switch (seccion) {
      case 'fundamento':
      case 'montaje':
        parrafos[seccion].push(linea);
        break;

      case 'objetivos':
      case 'seguridad':
      case 'preguntas':
      case 'notasDocente':
        if (item) p[seccion].push(item);
        break;

      case 'materiales': {
        if (!item) break;
        const trozos = item.split('::');
        const cabeza = trozos[0].trim();
        const detalle = trozos.slice(1).join('::').trim();
        // «3 cuerpos sólidos» → cantidad 3, nombre «cuerpos sólidos»
        const cant = cabeza.match(/^(\d+(?:[.,]\d+)?\s*[a-zA-ZμµΩ°%]*)\s+(?:x\s+)?(.+)$/);
        if (cant) p.materiales.push({ cantidad: cant[1].trim(), nombre: cant[2].trim(), detalle });
        else p.materiales.push({ cantidad: '', nombre: cabeza, detalle });
        break;
      }

      case 'instrumentos':
      case 'sustancias': {
        if (!item) break;
        // el último «::» puede ser una nota en castellano, no un parámetro
        const trozos = item.split('::');
        let nota = '';
        let crudo = item;
        if (trozos.length > 2 && trozos[trozos.length - 1].indexOf('=') < 0) {
          nota = trozos.pop().trim();
          crudo = trozos.join('::');
        } else if (trozos.length === 2 && trozos[1].indexOf('=') < 0) {
          nota = trozos[1].trim();
          crudo = trozos[0];
        }
        const inst = textoAInstrumento(crudo);
        if (inst) p[seccion].push({ id: inst.id, params: inst.params, nota });
        break;
      }

      case 'procedimiento': {
        if (!esItem && !item) break;
        const trozos = item.split('::').map(t => t.trim());
        let nota = '', escena = [];
        const iNota = trozos.findIndex(t => /^nota\s*:/i.test(t));
        if (iNota >= 0) nota = trozos.splice(iNota, 1)[0].replace(/^nota\s*:\s*/i, '');
        const iEsc = trozos.findIndex(t => /^escena\s*:/i.test(t));
        if (iEsc >= 0) {
          escena = trozos.splice(iEsc, 1)[0].replace(/^escena\s*:\s*/i, '')
            .split(/[\s,]+/).map(x => x.trim()).filter(x => refEscena(x));
        }
        let titulo = '', cuerpo = trozos.join(' — ');
        if (trozos.length > 1) { titulo = trozos[0]; cuerpo = trozos.slice(1).join(' — '); }
        if (!cuerpo && !titulo) break;
        p.procedimiento.push({ titulo, texto: cuerpo, escena, nota });
        break;
      }

      case 'tablas': {
        const filas = linea.match(/^(?:filas|renglones)\s*:\s*(\d+)/i);
        if (filas) { if (tablaActual) tablaActual.filas = Math.max(1, Math.min(40, Number(filas[1]))); break; }
        if (linea.indexOf('|') >= 0) {
          const celdas = linea.split('|').map(c => c.trim()).filter(c => c !== '');
          if (!celdas.length || celdas.every(c => /^[-:\s]+$/.test(c))) break;   // separador de markdown
          if (!tablaActual) {
            tablaActual = { titulo: 'Tabla de datos', columnas: [], filas: 5 };
            p.tablas.push(tablaActual);
          }
          if (!tablaActual.columnas.length) tablaActual.columnas = celdas.map(parsearColumna);
          break;
        }
        if (item && !tablaActual) {
          tablaActual = { titulo: item, columnas: [], filas: 5 };
          p.tablas.push(tablaActual);
        }
        break;
      }

      case 'calculos': {
        if (!item) break;
        const t = item.split('::').map(x => x.trim());
        p.calculos.push({ nombre: t[0] || '', formula: t[1] || '', unidad: t[2] || '', descripcion: t.slice(3).join(' — ') });
        break;
      }

      case 'conclusiones': {
        const n = linea.match(/^(?:l[ií]neas|renglones)\s*:\s*(\d+)/i);
        if (n) { p.conclusiones.lineas = Math.max(0, Math.min(30, Number(n[1]))); break; }
        const g = linea.match(/^(?:gu[ií]a|orientaci[oó]n)\s*:\s*(.+)$/i);
        p.conclusiones.guia += (p.conclusiones.guia ? ' ' : '') + (g ? g[1] : item || linea);
        break;
      }
    }
  });

  p.fundamento = parrafos.fundamento.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  p.montaje.texto = parrafos.montaje.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return normalizarProtocolo(p);
}

// ¿El texto pegado se parece a un protocolo? Sirve para avisar antes de pisar todo.
export function pareceProtocolo(texto) {
  const t = clave(texto || '');
  let puntos = 0;
  ['## fundamento', '## objetivos', '## materiales', '## procedimiento', '## preguntas', '## conclusiones']
    .forEach(m => { if (t.indexOf(m) >= 0) puntos++; });
  return puntos >= 2;
}

// ============================================================
// La referencia del formato, completa
// ============================================================
// Es la misma que se muestra en la página, se copia al portapapeles y se
// puede pegar en una IA. Está escrita para que no quede nada librado a la
// interpretación: cada sección con su sintaxis exacta y un ejemplo.
export const REFERENCIA_FORMATO = `FORMATO DE UN PROTOCOLO DE PRÁCTICO
===================================

REGLAS GENERALES
  1. Una línea que empieza con «# Clave: valor» es un dato de cabecera.
  2. Una línea que empieza con «## » abre una sección. El orden no importa.
  3. Adentro de una sección, cada ítem va en su propia línea y empieza con
     «- » (o con «1. », «2. »… en el procedimiento).
  4. El separador entre los campos de un ítem son DOS PUNTOS DOBLES: « :: ».
  5. Los renglones en blanco separan párrafos. Los acentos y las mayúsculas
     de los nombres de sección no importan.
  6. Todo lo que va entre signos de peso se dibuja como fórmula matemática
     en LaTeX: $d = \\frac{m}{V}$ en el renglón, $$…$$ centrada aparte.

CABECERA
  # Protocolo: Determinación de la densidad de sólidos irregulares
  # Asignatura: Física
  # Nivel: 3° de Ciclo Básico
  # Duración: 90 minutos
  # Docente: (opcional)
  # Grupo: (opcional)

## Fundamento
  Párrafos de texto corrido. Un renglón en blanco separa un párrafo del otro.
  Las fórmulas van en LaTeX entre signos de peso.

## Objetivos
  - Un objetivo por línea, empezando con un verbo en infinitivo.

## Materiales
  - 1 probeta de 100 mL
  - 3 cuerpos sólidos irregulares :: aclaración opcional después de « :: »
  La cantidad se detecta sola si el ítem empieza con un número.

## Instrumentos
  Un instrumento por línea:   - identificador :: parámetros :: para qué se usa
  - probeta :: max=100, division=1, unidad=mL, lectura=64 :: mide el volumen
  Los parámetros van separados por comas, con la forma clave=valor. Los que no
  pongas quedan en su valor de fábrica. Los booleanos se escriben si/no.

  IDENTIFICADORES DISPONIBLES
    Longitud y ángulo : regla · calibre · micrometro · transportador
    Volumen           : probeta · bureta · pipeta · jeringa · vidrio
    Masa              : balanzaDigital · granataria
    Temperatura       : termometro · calorimetro
    Fuerza            : dinamometro · planoInclinado · polea
    Tiempo            : cronometro
    Electricidad      : multimetro · aguja · fuente · circuito · microbit
    Óptica            : bancoOptico
    Química           : frasco · mechero · soporte · gradilla · filtracion ·
                        destilacion · agitador · papelPH
    Sensores          : goDirect · sensorDigital

  PARÁMETROS COMUNES
    min, max        alcance de la escala
    division        cuánto vale la rayita más chica
    numerarCada     cada cuánto se escribe un número
    unidad          mL, cm, N, °C, g, V…
    lectura         el valor que muestra el instrumento
    etiqueta        un rótulo libre para el dibujo

  LA LÍNEA DE MEDICIÓN (no viene puesta, se agrega a propósito)
    marcarLectura=si        dibuja la línea roja que señala dónde leer
    marcaEn=30              a qué punto de la escala apunta (si no, a la lectura)
    marcaTexto=nivel inicial  el rótulo que la acompaña
    marcaCorrer=-2          ajuste fino, en milímetros de dibujo

  CASOS ESPECIALES
    multimetro :: funcion=Vcc20, lectura=9.06
      funcion es la posición de la llave: Vcc200m Vcc2 Vcc20 Vcc200 Vcc600 ·
      Vca200 Vca600 · Acc200u Acc2m Acc20m Acc200m Acc10 · Aca200m ·
      ohm200 ohm2k ohm20k ohm200k ohm2M · cont diodo hfe · cap capu frec temp · off
    circuito :: componente=lampara, conexion=serie, llave=cerrada, valorFuente=6 V
      componente: lampara resistencia led motor timbre · conexion: no serie paralelo
    microbit :: pin0=ultrasonido, magnitud=Distancia, unidad=cm, lectura=34
      pines: ldr ntc pot humedad ultrasonido dht11 sonido llama hall infra boton
      lluvia led zumbador servo motor rele · interno: acel brujula temp luz micro tacto
    goDirect :: modelo=pressure, lectura=101.3
      modelos: force accel temp ph orp motion light pressure co2 o2 cond volt
      current energy ekg resp hr bp spiro magnetic sound rotary drop colorim do
      turb charge radiation melt weather
    bancoOptico :: lente=convergente, focal=10, distanciaObjeto=25
    planoInclinado :: angulo=25, movil=carrito, fuerzas=si
    gradilla :: cantidad=4, rotulos=agua, HCl, NaOH, control
    mechero :: llama=azul, altura=media, zonas=si
    soporte :: encima=vaso, rejilla=si, mechero=si

## Sustancias
  Los frascos con lo que se va a usar. Mismo formato que los instrumentos:
  - frasco :: nombre=Ácido clorhídrico, formula=HCl, concentracion=0,1 mol/L, cantidad=250 mL, peligro=corrosivo :: para la titulación
  tipo: frasco botella gotero vaso tubo matraz placa vidrioReloj
  estado: liquido solido granulado vacio
  peligro: corrosivo inflamable toxico irritante oxidante ambiente salud

## Seguridad
  - Una precaución concreta por línea.

## Montaje
  Texto corrido, igual que el fundamento.

## Procedimiento
  Un paso por línea, numerado:
  1. Título corto :: Qué hay que hacer :: escena: i1 s2 :: nota: al margen
  El «escena:» dice qué se dibuja al lado del paso: i1 es el primer
  instrumento, s2 la segunda sustancia. Se pueden poner varios, con espacios.
  El «nota:» es opcional y sale en bastardilla debajo del paso.

## Tablas
  ### Título de la tabla
  | Ensayo | m (g) ± 0,1 | V (mL) ± 0,5 |
  filas: 5
  De cada columna, el nombre; entre paréntesis la unidad y después de ± la
  incertidumbre. Las tablas salen VACÍAS, con esa cantidad de filas.

## Cálculos
  - Nombre :: $fórmula$ :: unidad :: cómo se calcula y con qué datos

## Preguntas
  - Una pregunta de análisis por línea.

## Conclusiones
  líneas: 8
  Guía: preguntas orientadoras para que el estudiante redacte.

## Notas para el docente
  - Sólo salen en la versión del docente, nunca en la del estudiante.
  - Qué preparar antes, en qué se traban, cómo adaptar si falta material,
    cuánto tiempo lleva cada tramo, qué mirar al corregir.
`;

// ============================================================
// Prompt para pedirle el protocolo a una IA
// ============================================================
export function promptProtocolo(o) {
  const op = o || {};
  const tema = op.tema || '[TEMA DEL PRÁCTICO]';
  const asignatura = op.asignatura || 'Física';
  const nivel = op.nivel || '3° de Ciclo Básico';
  const duracion = op.duracion || '90 minutos';
  const pasos = op.pasos || 8;
  const preguntas = op.preguntas || 5;
  const enfoque = op.enfoque || '';

  return `Sos docente de ${asignatura} y estás escribiendo el protocolo de una práctica de laboratorio para estudiantes de ${nivel} en Uruguay.

TEMA: ${tema}
DURACIÓN DE LA CLASE: ${duracion}
${enfoque ? 'ENFOQUE / CONSIGNA ESPECIAL: ' + enfoque + '\n' : ''}
QUÉ TENÉS QUE ESCRIBIR
Un protocolo completo, en el formato exacto que se detalla más abajo. Reglas de contenido:

 1. Materiales baratos y conseguibles en un liceo. Nada de equipamiento de universidad.
 2. El procedimiento lleva ${pasos} pasos numerados, concretos y en imperativo ("Medí…",
    "Anotá…"), como para que un estudiante los siga solo.
 3. Toda medida dice con qué instrumento se toma y en qué unidad.
 4. Las tablas van VACÍAS: sólo los encabezados con su unidad y su incertidumbre.
 5. Las ${preguntas} preguntas de análisis obligan a pensar sobre los datos obtenidos,
    no a repetir teoría.
 6. Español rioplatense (voseo), claro y directo. Sin negritas ni markdown adentro
    de los textos.
 7. Ajustá la exigencia al nivel: en 7°, 8° y 9° el foco está en observar, medir y
    describir; en 1°, 2° y 3° de EMS se suman el tratamiento de la incertidumbre,
    las gráficas y el modelo matemático.
 8. Terminá SIEMPRE con la sección "## Notas para el docente": ahí va lo que hace que
    la práctica salga bien y que el estudiante no tiene que ver — qué preparar el día
    anterior, en qué se traban siempre, cómo adaptarla si falta material, cuánto tiempo
    lleva cada tramo y qué mirar al corregir.

${REFERENCIA_FORMATO}
AHORA ESCRIBÍ EL PROTOCOLO
Respondé SÓLO con el protocolo en ese formato, sin texto antes ni después, empezando
por «# Protocolo:» y terminando por la última nota para el docente. Usá los
instrumentos y las sustancias que de verdad haga falta para este tema —no los pongas
de adorno— y acordate de armar la escena de los pasos donde el dibujo ayude a
entender qué hay sobre la mesada.`;
}
