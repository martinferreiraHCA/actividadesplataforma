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
    seguridad: [],
    montaje: { texto: '', imagen: '' },
    procedimiento: [],
    tablas: [],
    calculos: [],
    preguntas: [],
    conclusiones: { guia: '', lineas: 8 }
  };
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
  if (p.montaje) r.montaje = { texto: String(p.montaje.texto || ''), imagen: String(p.montaje.imagen || '') };
  if (Array.isArray(p.procedimiento)) r.procedimiento = p.procedimiento.map(s => ({
    titulo: String(s.titulo || ''), texto: String(s.texto || ''), instrumento: String(s.instrumento || ''), nota: String(s.nota || '')
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

  if (p.seguridad.length) { l.push('', '## Seguridad'); p.seguridad.forEach(s => l.push('- ' + s)); }

  if (p.montaje.texto) { l.push('', '## Montaje', p.montaje.texto.trim()); }

  if (p.procedimiento.length) {
    l.push('', '## Procedimiento');
    p.procedimiento.forEach((s, i) => {
      const partes = [];
      if (s.titulo) partes.push(s.titulo);
      partes.push(s.texto);
      let t = (i + 1) + '. ' + partes.join(' :: ');
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

      case 'instrumentos': {
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
        if (inst) p.instrumentos.push({ id: inst.id, params: inst.params, nota });
        break;
      }

      case 'procedimiento': {
        if (!esItem && !item) break;
        const trozos = item.split('::').map(t => t.trim());
        let nota = '';
        const iNota = trozos.findIndex(t => /^nota\s*:/i.test(t));
        if (iNota >= 0) nota = trozos.splice(iNota, 1)[0].replace(/^nota\s*:\s*/i, '');
        let titulo = '', cuerpo = trozos.join(' — ');
        if (trozos.length > 1) { titulo = trozos[0]; cuerpo = trozos.slice(1).join(' — '); }
        if (!cuerpo && !titulo) break;
        p.procedimiento.push({ titulo, texto: cuerpo, instrumento: '', nota });
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

  return `Sos docente de ${asignatura} y estás escribiendo el protocolo de una práctica de laboratorio para estudiantes de ${nivel}.

TEMA: ${tema}
DURACIÓN DE LA CLASE: ${duracion}
${enfoque ? 'ENFOQUE / CONSIGNA ESPECIAL: ' + enfoque + '\n' : ''}
Escribí el protocolo COMPLETO respetando exactamente el formato de más abajo. Reglas:

1. Usá materiales baratos y fáciles de conseguir en un liceo (nada de equipamiento de universidad).
2. El procedimiento tiene que tener ${pasos} pasos numerados, concretos y en imperativo ("Medí…", "Anotá…"), como para que un estudiante los siga solo.
3. Toda medida tiene que decir con qué instrumento se toma y en qué unidad.
4. Las tablas de datos van vacías: sólo los encabezados de columna con su unidad y su incertidumbre, y cuántas filas hacen falta.
5. Las preguntas de análisis (${preguntas}) tienen que obligar a pensar sobre los datos obtenidos, no a repetir teoría.
6. Escribí en español rioplatense (voseo), claro y directo. No uses negritas ni markdown adentro de los textos.

En la sección "## Instrumentos" usá SOLO estos identificadores, uno por línea, con sus parámetros:
regla, calibre, micrometro, probeta, bureta, jeringa, vidrio, termometro, dinamometro,
balanzaDigital, granataria, cronometro, multimetro, aguja, transportador, sensorDigital
Parámetros habituales: min, max, division, numerarCada, unidad, lectura.
(La plataforma los dibuja sola, con esa escala y esa lectura.)

FORMATO EXACTO DE LA RESPUESTA (no agregues nada antes ni después):

# Protocolo: [título del práctico]
# Asignatura: ${asignatura}
# Nivel: ${nivel}
# Duración: ${duracion}

## Fundamento
[Dos o tres párrafos con la teoría mínima necesaria para entender qué se va a hacer y por qué. Incluí las fórmulas en texto plano.]

## Objetivos
- [Objetivo general]
- [Objetivo específico]
- [Objetivo específico]

## Materiales
- 1 probeta de 100 mL
- 3 cuerpos sólidos irregulares :: que entren por la boca de la probeta
- [seguir la lista]

## Instrumentos
- probeta :: max=100, division=1, unidad=mL, lectura=64 :: [para qué se usa]
- balanzaDigital :: max=500, division=0.1, unidad=g, lectura=126.4 :: [para qué se usa]

## Seguridad
- [Precaución concreta y realista para esta práctica]

## Montaje
[Cómo se arma el dispositivo sobre la mesada, qué va apoyado dónde y qué hay que verificar antes de empezar.]

## Procedimiento
1. [Título corto del paso] :: [Qué hay que hacer exactamente]
2. [Título corto del paso] :: [Qué hay que hacer exactamente]
[hasta ${pasos}]

## Tablas
### [Título de la tabla]
| Ensayo | m (g) ± 0,1 | V (mL) ± 0,5 |
filas: 5

## Cálculos
- [Nombre de la magnitud] :: [fórmula] :: [unidad] :: [cómo se calcula y con qué datos de la tabla]

## Preguntas
- [Pregunta de análisis sobre los datos]
[hasta ${preguntas}]

## Conclusiones
líneas: 8
Guía: [Dos o tres preguntas orientadoras para que el estudiante redacte su conclusión.]`;
}
