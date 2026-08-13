// Informe de proyecto: sube un .sb3 (Scratch) o un .hex (micro:bit MakeCode),
// lo analiza y arma un documento imprimible con los programas por personaje,
// disfraces, fondos, descripciones automáticas e interacciones entre objetos.

import { leerSb3, liberarModelo, estadisticas } from './sb3-leer.js';
import { descripcionDeScript, analizarInteracciones } from './sb3-descripciones.js';
import { extraerFuenteHex, resumenMakeCode } from './hex-fuente.js';
import { obtenerBloquesMicrobit, bloquesMicrobitEnCache } from './makecode-render.js';

const sb = window.scratchblocks;
if (sb && typeof sb.appendStyles === 'function') sb.appendStyles();

const $ = id => document.getElementById(id);

const estado = {
  tipo: null,       // 'sb3' | 'hex'
  modelo: null,     // modelo de leerSb3
  hex: null,        // resultado de extraerFuenteHex
  nombreArchivo: ''
};

// ============================================================
// Utilidades de DOM
// ============================================================
function el(tag, clase, texto) {
  const n = document.createElement(tag);
  if (clase) n.className = clase;
  if (texto != null) n.textContent = texto;
  return n;
}

function toast(msg) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove('visible'), 3500);
}

function mostrarEstado(msg, esError) {
  const n = $('estadoSubida');
  n.style.display = msg ? 'block' : 'none';
  n.textContent = msg || '';
  n.classList.toggle('inf-estado--error', !!esError);
}

function opciones() {
  return {
    estilo: $('optEstilo').value,
    escala: parseFloat($('optEscala').value) || 1,
    descripciones: $('optDescripciones').checked,
    interacciones: $('optInteracciones').checked,
    disfraces: $('optDisfraces').checked,
    sonidos: $('optSonidos').checked,
    salto: $('optSalto').checked,
    comentar: $('optComentar').checked,
    equipo: $('optEquipo').value.trim(),
    grupo: $('optGrupo').value.trim(),
    consigna: $('optConsigna').value.trim()
  };
}

function renderBloques(codigo, escala, estilo) {
  if (!sb || !codigo.trim()) return null;
  try {
    const doc = sb.parse(codigo, { languages: ['en', 'es', 'es-419'] });
    const view = sb.newView(doc, { style: estilo || 'scratch3', scale: escala || 1 });
    return view.render();
  } catch (e) {
    return null;
  }
}

function fechaHoy() {
  try {
    return new Date().toLocaleDateString('es-UY', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) { return new Date().toLocaleDateString(); }
}

// ============================================================
// Informe de un .sb3
// ============================================================
function construirInformeSb3(modelo, opt) {
  const doc = el('div', 'inf-doc' + (opt.salto ? ' inf-doc--saltos' : ''));

  // ---- portada ----
  const st = estadisticas(modelo);
  const portada = el('header', 'inf-portada');
  portada.appendChild(el('span', 'inf-portada__tipo', '🐱 Proyecto Scratch'));
  portada.appendChild(el('h1', 'inf-portada__titulo', modelo.nombre));
  agregarDatosPortada(portada, opt);
  const stats = el('div', 'inf-stats');
  const stat = (n, etiqueta) => {
    const s = el('span', 'inf-stat');
    s.innerHTML = `<strong>${n}</strong> ${etiqueta}`;
    stats.appendChild(s);
  };
  stat(st.personajes, st.personajes === 1 ? 'personaje' : 'personajes');
  stat(st.scripts, st.scripts === 1 ? 'programa' : 'programas');
  stat(st.bloques, 'bloques');
  stat(st.fondos, st.fondos === 1 ? 'fondo' : 'fondos');
  if (opt.disfraces) stat(st.disfraces, 'disfraces');
  if (opt.sonidos) { stat(st.variables, 'variables'); if (st.listas) stat(st.listas, 'listas'); }
  portada.appendChild(stats);
  doc.appendChild(portada);
  agregarConsigna(doc, opt);

  // ---- interacciones (van temprano: son el "mapa" del proyecto) ----
  if (opt.interacciones) {
    const inter = analizarInteracciones([modelo.escenario, ...modelo.personajes].filter(Boolean));
    if (inter.frases.length) {
      const sec = el('section', 'inf-seccion');
      sec.appendChild(el('h2', 'inf-seccion__titulo', '🔗 Cómo interactúan los objetos'));
      const ul = el('ul', 'inf-lista');
      inter.frases.forEach(f => ul.appendChild(el('li', null, f)));
      sec.appendChild(ul);
      doc.appendChild(sec);
    }
  }

  // ---- escenario ----
  if (modelo.escenario) {
    const esc = modelo.escenario;
    const sec = el('section', 'inf-seccion');
    sec.appendChild(el('h2', 'inf-seccion__titulo', '🖼️ Escenario' +
      (esc.disfraces.length ? ` — ${esc.disfraces.length} fondo${esc.disfraces.length === 1 ? '' : 's'}` : '')));
    if (opt.disfraces && esc.disfraces.length) {
      sec.appendChild(galeria(esc.disfraces, 'inf-galeria--fondos'));
    }
    agregarExtras(sec, esc, opt);
    agregarScripts(sec, esc, opt);
    doc.appendChild(sec);
  }

  // ---- personajes ----
  modelo.personajes.forEach(p => {
    const sec = el('section', 'inf-seccion inf-objeto');
    const cab = el('div', 'inf-objeto__cab');
    const retrato = p.disfraces[p.disfrazActual] || p.disfraces[0];
    if (retrato && retrato.url) {
      const img = el('img', 'inf-objeto__retrato');
      img.src = retrato.url;
      img.alt = p.nombre;
      cab.appendChild(img);
    }
    cab.appendChild(el('h2', 'inf-objeto__nombre', p.nombre));
    const datos = el('div', 'inf-objeto__datos');
    datos.innerHTML = `x: ${p.x} · y: ${p.y} · tamaño: ${p.tamano}% · dirección: ${p.direccion}°<br>${p.visible ? 'visible' : 'oculto'} al empezar`;
    cab.appendChild(datos);
    sec.appendChild(cab);

    if (opt.disfraces && p.disfraces.length) {
      const sub = el('p', null, '');
      sub.innerHTML = `<strong>Disfraces (${p.disfraces.length}):</strong>`;
      sub.style.marginBottom = '0.4rem';
      sec.appendChild(sub);
      sec.appendChild(galeria(p.disfraces, 'inf-galeria--disfraces'));
    }
    agregarExtras(sec, p, opt);
    agregarScripts(sec, p, opt);
    doc.appendChild(sec);
  });

  // ---- variables ----
  if (opt.sonidos) {
    const filas = [];
    modelo.variablesGlobales.forEach(v => filas.push([v.nombre, v.esLista ? 'lista' : 'variable', 'todo el proyecto', String(v.valor)]));
    modelo.personajes.forEach(p => p.variablesPropias.forEach(v =>
      filas.push([v.nombre, v.esLista ? 'lista' : 'variable', 'solo ' + p.nombre, String(v.valor)])));
    if (filas.length) {
      const sec = el('section', 'inf-seccion');
      sec.appendChild(el('h2', 'inf-seccion__titulo', '🔢 Variables y listas'));
      const tabla = el('table', 'inf-tabla');
      tabla.innerHTML = '<thead><tr><th>Nombre</th><th>Tipo</th><th>Alcance</th><th>Valor inicial</th></tr></thead>';
      const cuerpo = el('tbody');
      filas.forEach(f => {
        const tr = el('tr');
        f.forEach(c => tr.appendChild(el('td', null, c)));
        cuerpo.appendChild(tr);
      });
      tabla.appendChild(cuerpo);
      sec.appendChild(tabla);
      doc.appendChild(sec);
    }
  }

  // ---- avisos ----
  if (modelo.avisos.length) {
    const sec = el('section', 'inf-seccion');
    sec.appendChild(el('h2', 'inf-seccion__titulo', '⚠️ Avisos'));
    modelo.avisos.forEach(a => sec.appendChild(el('div', 'inf-aviso', a)));
    doc.appendChild(sec);
  }

  doc.appendChild(pie());
  return doc;
}

function galeria(disfraces, claseExtra) {
  const g = el('div', 'inf-galeria ' + (claseExtra || ''));
  disfraces.forEach(d => {
    const fig = el('figure');
    if (d.url) {
      const img = el('img');
      img.src = d.url;
      img.alt = d.nombre;
      img.loading = 'lazy';
      fig.appendChild(img);
    }
    fig.appendChild(el('figcaption', null, d.nombre));
    g.appendChild(fig);
  });
  return g;
}

function agregarExtras(sec, t, opt) {
  if (!opt.sonidos) return;
  if (t.sonidos.length) {
    const chips = el('div', 'inf-chips');
    chips.appendChild(el('span', 'inf-chips__label', '🔊 Sonidos:'));
    t.sonidos.forEach(s => chips.appendChild(el('span', 'inf-chip', s)));
    sec.appendChild(chips);
  }
  if (t.comentarios.length) {
    t.comentarios.forEach(c => {
      const n = el('div', 'inf-aviso');
      n.textContent = '📝 Comentario del proyecto: ' + c;
      sec.appendChild(n);
    });
  }
}

function agregarScripts(sec, t, opt) {
  if (!t.scripts.length) {
    sec.appendChild(el('p', 'inf-vacio', t.esEscenario
      ? 'El escenario no tiene programas.'
      : 'Este personaje no tiene programas.'));
    return;
  }
  t.scripts.forEach((s, i) => {
    const caja = el('div', 'inf-programa');
    caja.appendChild(el('div', 'inf-programa__num', `Programa ${i + 1} de ${t.scripts.length}`));
    const zona = el('div', 'inf-programa__bloques');
    const svg = renderBloques(s.texto, opt.escala, opt.estilo);
    if (svg) zona.appendChild(svg);
    else {
      const pre = el('pre', 'inf-codigo', s.texto);
      zona.appendChild(pre);
    }
    caja.appendChild(zona);
    if (opt.descripciones) {
      const d = descripcionDeScript(s.raiz);
      if (d) {
        const p = el('p', 'inf-programa__desc');
        p.innerHTML = '<strong>¿Qué hace?</strong> ';
        p.appendChild(document.createTextNode(d));
        caja.appendChild(p);
      }
    }
    if (opt.comentar) {
      caja.appendChild(cajaComentario('✍️ ¿Qué hace este programa? Explicalo con tus palabras:'));
    }
    sec.appendChild(caja);
  });
}

function pie() {
  const f = el('footer', 'inf-pie');
  f.appendChild(el('span', null, 'Informe de proyecto'));
  f.appendChild(el('span', null, fechaHoy()));
  return f;
}

// equipo / grupo / fecha en la portada (solo lo que se haya completado)
function agregarDatosPortada(portada, opt) {
  const partes = [];
  if (opt.equipo) partes.push(opt.equipo);
  if (opt.grupo) partes.push(opt.grupo);
  if (partes.length) {
    portada.appendChild(el('p', 'inf-portada__equipo', partes.join(' · ')));
  }
  portada.appendChild(el('p', 'inf-portada__sub', fechaHoy()));
}

// consigna del docente al principio de la ficha
function agregarConsigna(doc, opt) {
  if (!opt.consigna) return;
  const caja = el('div', 'inf-consigna');
  const et = el('strong', null, '📌 Consigna');
  const p = el('p', null, opt.consigna);
  caja.append(et, p);
  doc.appendChild(caja);
}

// renglones en blanco para que el estudiante escriba su comentario
function cajaComentario(etiqueta) {
  const caja = el('div', 'inf-comentario');
  caja.appendChild(el('div', 'inf-comentario__label', etiqueta));
  const lineas = el('div', 'inf-comentario__lineas');
  for (let i = 0; i < 3; i++) lineas.appendChild(el('div', 'inf-comentario__linea'));
  caja.appendChild(lineas);
  return caja;
}

// ============================================================
// Informe de un .hex (micro:bit MakeCode)
// ============================================================
function construirInformeHex(hex, opt) {
  const doc = el('div', 'inf-doc');

  const portada = el('header', 'inf-portada');
  portada.appendChild(el('span', 'inf-portada__tipo', '🤖 Proyecto micro:bit (MakeCode)'));
  portada.appendChild(el('h1', 'inf-portada__titulo', hex.nombre));
  if (opt.equipo || opt.grupo) {
    portada.appendChild(el('p', 'inf-portada__equipo', [opt.equipo, opt.grupo].filter(Boolean).join(' · ')));
  }
  portada.appendChild(el('p', 'inf-portada__sub', fechaHoy() +
    (hex.editor ? ' · editor: ' + (hex.editor === 'blocksprj' ? 'bloques' : hex.editor === 'tsprj' ? 'JavaScript' : hex.editor === 'pyprj' ? 'Python' : hex.editor) : '')));
  if (hex.extensiones.length) {
    const stats = el('div', 'inf-stats');
    hex.extensiones.forEach(e => stats.appendChild(el('span', 'inf-stat', '🧩 ' + e.nombre)));
    portada.appendChild(stats);
  }
  doc.appendChild(portada);
  agregarConsigna(doc, opt);

  const codigoJs = hex.archivos['main.ts'] || '';
  const codigoPy = hex.archivos['main.py'] || '';
  const codigo = codigoJs || codigoPy;

  // resumen de la lógica
  if (opt.descripciones && codigoJs) {
    const frases = resumenMakeCode(codigoJs);
    if (frases.length) {
      const sec = el('section', 'inf-seccion');
      sec.appendChild(el('h2', 'inf-seccion__titulo', '💬 ¿Qué hace el programa?'));
      const ul = el('ul', 'inf-lista');
      frases.forEach(f => ul.appendChild(el('li', null, f)));
      sec.appendChild(ul);
      doc.appendChild(sec);
    }
  }

  // bloques dibujados por MakeCode (necesita internet)
  if (codigoJs) {
    const sec = el('section', 'inf-seccion');
    sec.appendChild(el('h2', 'inf-seccion__titulo', '🧱 El programa en bloques'));
    const zona = el('div', 'inf-bloques-mb');
    zona.appendChild(el('p', 'inf-vacio', 'Dibujando los bloques con MakeCode… (necesita internet)'));
    sec.appendChild(zona);
    doc.appendChild(sec);
    const extensiones = hex.extensiones.map(e => e.nombre + '=' + e.repo).join(',');
    obtenerBloquesMicrobit(codigoJs, extensiones).then(info => {
      zona.innerHTML = '';
      const img = el('img');
      img.src = info.uri;
      img.alt = 'Bloques del programa';
      zona.appendChild(img);
    }).catch(() => {
      zona.innerHTML = '';
      zona.appendChild(el('div', 'inf-aviso',
        'No se pudieron dibujar los bloques (MakeCode no respondió: ¿hay internet?). El código de abajo es el programa completo.'));
    });
  }

  // código fuente
  if (codigo) {
    const sec = el('section', 'inf-seccion');
    sec.appendChild(el('h2', 'inf-seccion__titulo', codigoJs ? '⌨️ Código JavaScript' : '🐍 Código Python'));
    const pre = el('pre', 'inf-codigo');
    const code = el('code', codigoJs ? 'language-javascript' : 'language-python', codigo);
    pre.appendChild(code);
    if (window.hljs) { try { window.hljs.highlightElement(code); } catch (e) { /* sin resaltado */ } }
    sec.appendChild(pre);
    if (opt.comentar) {
      sec.appendChild(cajaComentario('✍️ ¿Qué hace este programa? Explicalo con tus palabras:'));
    }
    doc.appendChild(sec);
  } else {
    doc.appendChild(el('div', 'inf-aviso', 'El .hex trae el proyecto pero no se encontró main.ts ni main.py adentro.'));
  }

  // otros archivos del proyecto
  const otros = Object.keys(hex.archivos).filter(a => !/^(main\.(ts|py|blocks)|pxt\.json|README\.md)$/.test(a));
  if (otros.length) {
    const chips = el('div', 'inf-chips');
    chips.appendChild(el('span', 'inf-chips__label', '📁 Otros archivos:'));
    otros.forEach(a => chips.appendChild(el('span', 'inf-chip', a)));
    doc.appendChild(chips);
  }

  doc.appendChild(pie());
  return doc;
}

// ============================================================
// Flujo principal
// ============================================================
function regenerar() {
  const vista = $('vistaInforme');
  vista.innerHTML = '';
  const opt = opciones();
  if (estado.tipo === 'sb3' && estado.modelo) {
    vista.appendChild(construirInformeSb3(estado.modelo, opt));
  } else if (estado.tipo === 'hex' && estado.hex) {
    vista.appendChild(construirInformeHex(estado.hex, opt));
  }
  $('seccionOpciones').style.display = estado.tipo ? 'block' : 'none';
  $('seccionInforme').style.display = estado.tipo ? 'block' : 'none';
}

async function procesarArchivo(archivo) {
  if (!archivo) return;
  const nombre = archivo.name || 'proyecto';
  mostrarEstado('Analizando «' + nombre + '»…');
  try {
    const buf = await archivo.arrayBuffer();
    if (/\.hex$/i.test(nombre)) {
      estado.hex = await extraerFuenteHex(buf);
      estado.tipo = 'hex';
      if (estado.modelo) { liberarModelo(estado.modelo); estado.modelo = null; }
    } else if (/\.sb3$/i.test(nombre)) {
      const modelo = await leerSb3(buf, nombre);
      if (estado.modelo) liberarModelo(estado.modelo);
      estado.modelo = modelo;
      estado.tipo = 'sb3';
      estado.hex = null;
    } else {
      throw new Error('Solo se aceptan archivos .sb3 (Scratch) o .hex (micro:bit de MakeCode).');
    }
    estado.nombreArchivo = nombre;
    mostrarEstado('✓ «' + nombre + '» analizado. El informe está abajo.', false);
    regenerar();
    $('seccionInforme').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    console.error(e);
    estado.tipo = null;
    mostrarEstado('✗ ' + (e.message || 'No se pudo leer el archivo.'), true);
    regenerar();
  }
}

// --- PDF (impresión del navegador) ---
async function exportarPDF() {
  if (!estado.tipo) return;
  const nota = $('notaPDF');
  // micro:bit: esperar la imagen de bloques antes de imprimir
  if (estado.tipo === 'hex' && estado.hex && estado.hex.archivos['main.ts']) {
    const ext = estado.hex.extensiones.map(e => e.nombre + '=' + e.repo).join(',');
    const enCache = bloquesMicrobitEnCache(estado.hex.archivos['main.ts'], ext);
    if (!enCache || enCache.estado === 'pendiente') {
      nota.style.display = 'inline';
      nota.textContent = 'Esperando los bloques de MakeCode…';
      try { await obtenerBloquesMicrobit(estado.hex.archivos['main.ts'], ext); } catch (e) { /* se imprime sin bloques */ }
      nota.style.display = 'none';
      regenerar();
      await new Promise(r => setTimeout(r, 150));
    }
  }
  const area = $('areaImpresion');
  area.innerHTML = '';
  const vista = $('vistaInforme').firstElementChild;
  if (!vista) return;
  area.appendChild(vista.cloneNode(true));
  window.print();
}

// --- eventos de la página ---
function init() {
  const zona = $('zonaSubida');
  const input = $('inputArchivo');
  zona.addEventListener('click', () => input.click());
  zona.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  input.addEventListener('change', () => { procesarArchivo(input.files[0]); input.value = ''; });

  ['dragover', 'dragenter'].forEach(ev => zona.addEventListener(ev, e => {
    e.preventDefault();
    zona.classList.add('inf-subida--sobre');
  }));
  ['dragleave', 'drop'].forEach(ev => zona.addEventListener(ev, e => {
    e.preventDefault();
    zona.classList.remove('inf-subida--sobre');
  }));
  zona.addEventListener('drop', e => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) procesarArchivo(f);
  });

  ['optEstilo', 'optEscala', 'optDescripciones', 'optInteracciones', 'optDisfraces', 'optSonidos', 'optSalto', 'optComentar']
    .forEach(id => $(id).addEventListener('change', regenerar));
  // los campos de texto regeneran al soltar el foco (y con Enter en los inputs)
  ['optEquipo', 'optGrupo', 'optConsigna'].forEach(id => {
    $(id).addEventListener('change', regenerar);
    $(id).addEventListener('keydown', e => { if (e.key === 'Enter' && id !== 'optConsigna') { e.preventDefault(); regenerar(); } });
  });

  $('btnPDF').addEventListener('click', exportarPDF);
}

init();
