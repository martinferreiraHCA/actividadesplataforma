// Sombras recortadas — editor de capas sobre canvas.
//
// crearEditor(contenedor, opciones) arma toda la interfaz adentro del
// contenedor y devuelve un objeto para cargar/obtener el proyecto.
// opciones: { alCambiar(proyecto), toast(msg), soloLectura }

import {
  nuevoProyecto, nuevaCapa, clonar, normalizarProyecto, FUENTES, FORMAS, TIPOS_PIEZA,
  cargarFuente, leerArchivoImagen, asegurarImagen, mascaraDeCapaImagen, colorEnImagen,
  pathDeForma, cajaCapa, componerCapas, componerPieza, prepararProyecto
} from './sombras-render.js';

const PRESETS_PIEZA = [
  { nombre: '10 × 10 cm', w: 100, h: 100 },
  { nombre: '12 × 12 cm', w: 120, h: 120 },
  { nombre: '15 × 15 cm', w: 150, h: 150 },
  { nombre: '20 × 15 cm', w: 200, h: 150 },
  { nombre: '20 × 20 cm', w: 200, h: 200 },
  { nombre: 'A5 (14,8 × 21 cm)', w: 148, h: 210 },
  { nombre: 'Tapete entero (29 × 29 cm)', w: 290, h: 290 }
];

const PLANTILLA = `
<div class="som-editor">
  <div class="som-barra">
    <div class="som-barra__grupo">
      <button type="button" class="som-btn som-btn--primario" data-accion="imagen" title="Subir una foto o dibujo (también podés arrastrarla o pegarla)">🖼 Imagen</button>
      <button type="button" class="som-btn som-btn--primario" data-accion="texto">🔤 Texto</button>
      <div class="som-desplegable">
        <button type="button" class="som-btn som-btn--primario" data-accion="formas">⬟ Forma ▾</button>
        <div class="som-desplegable__panel" data-panel-formas></div>
      </div>
      <input type="file" accept="image/*" data-input-imagen style="display:none">
    </div>
    <div class="som-barra__grupo">
      <button type="button" class="som-btn" data-accion="deshacer" title="Deshacer (Ctrl+Z)">↶</button>
      <button type="button" class="som-btn" data-accion="rehacer" title="Rehacer (Ctrl+Y)">↷</button>
    </div>
    <div class="som-barra__grupo som-vistas" role="tablist" aria-label="Vista">
      <button type="button" class="som-btn som-btn--tab active" data-vista="capas" title="Cada capa con su color: negro suma, rojo resta">Capas</button>
      <button type="button" class="som-btn som-btn--tab" data-vista="pieza" title="Cómo queda la pieza cortada">Pieza</button>
      <button type="button" class="som-btn som-btn--tab" data-vista="sombra" title="La sombra que proyecta con una luz">Sombra</button>
    </div>
  </div>
  <div class="som-cuerpo">
    <aside class="som-capas">
      <div class="som-panel__titulo">Capas <span class="som-capas__ayuda" title="Arriba es adelante. El ojo oculta la capa; ± cambia si suma (figura) o resta (agujero).">?</span></div>
      <ul class="som-capas__lista" data-lista-capas></ul>
      <p class="som-capas__vacio" data-capas-vacio>Todavía no hay capas. Subí una imagen, escribí un texto o agregá una forma.</p>
    </aside>
    <div class="som-lienzo" data-zona-lienzo tabindex="0" aria-label="Lienzo de diseño">
      <canvas data-canvas></canvas>
      <div class="som-lienzo__pie">
        <span data-info-pieza></span>
        <span class="som-lienzo__tip" data-tip>Arrastrá para mover · esquinas para escalar · el manubrio de arriba para girar · Supr para borrar</span>
      </div>
      <div class="som-lienzo__soltar" data-soltar>Soltá la imagen acá</div>
    </div>
    <aside class="som-props" data-props></aside>
  </div>
</div>`;

const ICONO_CAPA = { imagen: '🖼', texto: '🔤', forma: '⬟' };

export function crearEditor(contenedor, opciones) {
  const op = Object.assign({ alCambiar: null, toast: null, soloLectura: false }, opciones || {});
  contenedor.innerHTML = PLANTILLA;
  const $ = sel => contenedor.querySelector(sel);
  const $$ = sel => Array.from(contenedor.querySelectorAll(sel));

  const canvas = $('[data-canvas]');
  const ctx = canvas.getContext('2d');
  const zona = $('[data-zona-lienzo]');
  const propsEl = $('[data-props]');
  const listaEl = $('[data-lista-capas]');

  let proyecto = nuevoProyecto();
  let sel = null;            // id de la capa seleccionada
  let vista = 'capas';
  let pxPorMm = 3;
  let origen = { x: 0, y: 0 };  // esquina de la pieza en píxeles del canvas
  let dpr = 1;
  const historial = [];  // snapshots para deshacer
  const futuro = [];
  let gotero = null;     // {capaId} cuando se está eligiendo un color en el lienzo
  let arrastre = null;
  let temporizadorCambio = null;
  let redibujarPedido = false;
  let silenciarCambio = false;

  // ------------------------------------------------------------
  // utilidades
  // ------------------------------------------------------------
  const toast = msg => { if (op.toast) op.toast(msg); };
  const capaSel = () => proyecto.capas.find(c => c.id === sel) || null;
  const idx = id => proyecto.capas.findIndex(c => c.id === id);

  let cambioPendiente = false;
  function avisarCambio() {
    if (silenciarCambio) return;
    proyecto.modificado = Date.now();
    clearTimeout(temporizadorCambio);
    cambioPendiente = true;
    temporizadorCambio = setTimeout(vaciarCambio, 600);
  }
  // Dispara ya el aviso de cambio que estaba esperando (al salir del editor).
  function vaciarCambio() {
    clearTimeout(temporizadorCambio);
    if (!cambioPendiente) return;
    cambioPendiente = false;
    if (op.alCambiar) op.alCambiar(proyecto);
  }

  // Guarda el estado anterior antes de una modificación.
  function anotar() {
    historial.push(clonar(proyecto));
    if (historial.length > 60) historial.shift();
    futuro.length = 0;
  }
  function confirmar() { avisarCambio(); redibujar(); refrescarLista(); }

  function deshacer() {
    if (!historial.length) return;
    futuro.push(clonar(proyecto));
    proyecto = historial.pop();
    if (sel && !capaSel()) sel = null;
    confirmar(); refrescarProps();
  }
  function rehacer() {
    if (!futuro.length) return;
    historial.push(clonar(proyecto));
    proyecto = futuro.pop();
    if (sel && !capaSel()) sel = null;
    confirmar(); refrescarProps();
  }

  // ------------------------------------------------------------
  // geometría del lienzo
  // ------------------------------------------------------------
  function medirLienzo() {
    const r = zona.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(200, Math.floor(r.width)), H = Math.max(200, Math.floor(r.height) - 34);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const margen = 36;
    pxPorMm = Math.min((W - 2 * margen) / proyecto.pieza.anchoMm, (H - 2 * margen) / proyecto.pieza.altoMm);
    pxPorMm = Math.max(0.2, pxPorMm);
    origen = { x: (W - proyecto.pieza.anchoMm * pxPorMm) / 2, y: (H - proyecto.pieza.altoMm * pxPorMm) / 2 };
  }
  const aMm = (px, py) => ({ x: (px - origen.x) / pxPorMm, y: (py - origen.y) / pxPorMm });
  const aPx = (mx, my) => ({ x: origen.x + mx * pxPorMm, y: origen.y + my * pxPorMm });
  function puntoDeEvento(e) {
    const r = canvas.getBoundingClientRect();
    return aMm(e.clientX - r.left, e.clientY - r.top);
  }
  // punto (mm) → coordenadas locales de la capa (mm, sin espejos)
  function aLocal(capa, p) {
    const a = -(capa.rot || 0) * Math.PI / 180;
    const dx = p.x - capa.x, dy = p.y - capa.y;
    return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
  }
  function deLocal(capa, l) {
    const a = (capa.rot || 0) * Math.PI / 180;
    return { x: capa.x + l.x * Math.cos(a) - l.y * Math.sin(a), y: capa.y + l.x * Math.sin(a) + l.y * Math.cos(a) };
  }
  const ESQUINAS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  function manijas(capa) {
    const c = cajaCapa(capa);
    const lista = ESQUINAS.map(([sx, sy], i) => ({ tipo: 'escalar', i, sx, sy, p: deLocal(capa, { x: sx * c.w / 2, y: sy * c.h / 2 }) }));
    lista.push({ tipo: 'rotar', p: deLocal(capa, { x: 0, y: -c.h / 2 - 22 / pxPorMm }) });
    return lista;
  }
  function manijaEn(capa, p) {
    const rad = 9 / pxPorMm;
    for (const m of manijas(capa)) if (Math.hypot(m.p.x - p.x, m.p.y - p.y) <= rad) return m;
    return null;
  }
  function capaEn(p) {
    for (let i = proyecto.capas.length - 1; i >= 0; i--) {
      const capa = proyecto.capas[i];
      if (!capa.visible) continue;
      const c = cajaCapa(capa), l = aLocal(capa, p);
      if (Math.abs(l.x) <= c.w / 2 && Math.abs(l.y) <= c.h / 2) return capa;
    }
    return null;
  }

  // ------------------------------------------------------------
  // dibujo
  // ------------------------------------------------------------
  function redibujar() {
    if (redibujarPedido) return;
    redibujarPedido = true;
    requestAnimationFrame(() => { redibujarPedido = false; dibujarAhora(); });
  }

  function dibujarAhora() {
    medirLienzo();
    const W = canvas.width / dpr, H = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const pz = proyecto.pieza;
    const wPx = pz.anchoMm * pxPorMm, hPx = pz.altoMm * pxPorMm;

    if (vista === 'sombra') { dibujarSombra(W, H); return; }

    // fondo del lienzo y hoja
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(origen.x, origen.y, wPx, hPx);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(origen.x - 0.5, origen.y - 0.5, wPx + 1, hPx + 1);

    if (vista === 'capas') {
      // fantasma del tipo de pieza
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      if (pz.tipo === 'base') {
        const bw = Math.min(wPx, pz.base.anchoMm * pxPorMm), bh = Math.min(hPx, pz.base.altoMm * pxPorMm);
        ctx.fillRect(origen.x + (wPx - bw) / 2, origen.y + hPx - bh, bw, bh);
      } else if (pz.tipo === 'marco') {
        const g = pz.marco.grosorMm * pxPorMm;
        ctx.beginPath(); ctx.rect(origen.x, origen.y, wPx, hPx); ctx.rect(origen.x + g, origen.y + g, wPx - 2 * g, hPx - 2 * g); ctx.fill('evenodd');
      } else if (pz.tipo === 'ventana') {
        ctx.fillRect(origen.x, origen.y, wPx, hPx);
      }
      ctx.restore();
      const comp = componerCapas(proyecto, pxPorMm * dpr, { colores: true });
      ctx.drawImage(comp, origen.x, origen.y, wPx, hPx);
    } else {
      // pieza: negro definitivo, con espejo si corresponde
      const comp = componerPieza(proyecto, pxPorMm * dpr, { conEspejo: true });
      ctx.drawImage(comp, origen.x, origen.y, wPx, hPx);
      if (pz.espejo) {
        ctx.fillStyle = 'rgba(47,94,140,0.9)';
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.fillText('ESPEJADA (vinilo termoadhesivo)', origen.x + 6, origen.y + hPx - 8);
      }
    }

    // selección
    const capa = capaSel();
    if (capa && vista === 'capas') {
      const c = cajaCapa(capa);
      ctx.save();
      const centro = aPx(capa.x, capa.y);
      ctx.translate(centro.x, centro.y);
      ctx.rotate((capa.rot || 0) * Math.PI / 180);
      ctx.strokeStyle = '#2F5E8C';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(-c.w * pxPorMm / 2, -c.h * pxPorMm / 2, c.w * pxPorMm, c.h * pxPorMm);
      ctx.setLineDash([]);
      // línea al manubrio de giro
      ctx.beginPath(); ctx.moveTo(0, -c.h * pxPorMm / 2); ctx.lineTo(0, -c.h * pxPorMm / 2 - 22); ctx.stroke();
      ctx.restore();
      for (const m of manijas(capa)) {
        const p = aPx(m.p.x, m.p.y);
        ctx.beginPath();
        if (m.tipo === 'rotar') { ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#2F5E8C'; ctx.lineWidth = 2; ctx.stroke(); }
        else { ctx.rect(p.x - 5, p.y - 5, 10, 10); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#2F5E8C'; ctx.lineWidth = 2; ctx.stroke(); }
      }
    }
    $('[data-info-pieza]').textContent = `${pz.anchoMm} × ${pz.altoMm} mm · ${proyecto.capas.length} capa${proyecto.capas.length === 1 ? '' : 's'}` + (capa ? ` · ${capa.nombre}` : '');
  }

  // Vista de sombra: pared cálida, luz y la silueta proyectada más grande.
  function dibujarSombra(W, H) {
    const g = ctx.createRadialGradient(W * 0.5, H * 0.45, 10, W * 0.5, H * 0.45, Math.max(W, H) * 0.75);
    g.addColorStop(0, '#ffe9b0'); g.addColorStop(0.55, '#e3a94f'); g.addColorStop(1, '#3a2410');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const pz = proyecto.pieza;
    const comp = componerPieza(proyecto, pxPorMm * dpr, { conEspejo: false });
    const esc = 1.12;
    const w = pz.anchoMm * pxPorMm * esc, h = pz.altoMm * pxPorMm * esc;
    const x = (W - w) / 2, y = (H - h) / 2 + 6;
    ctx.save();
    ctx.filter = 'blur(3px)';
    ctx.globalAlpha = 0.55;
    ctx.drawImage(comp, x + 6, y + 8, w * 1.03, h * 1.03);
    ctx.filter = 'blur(1px)';
    ctx.globalAlpha = 0.92;
    ctx.drawImage(comp, x, y, w, h);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillText('Así se ve la sombra con una luz detrás de la pieza', 10, H - 10);
    $('[data-info-pieza]').textContent = `${pz.anchoMm} × ${pz.altoMm} mm · vista de sombra`;
  }

  // ------------------------------------------------------------
  // lista de capas
  // ------------------------------------------------------------
  function refrescarLista() {
    listaEl.innerHTML = '';
    $('[data-capas-vacio]').style.display = proyecto.capas.length ? 'none' : '';
    for (let i = proyecto.capas.length - 1; i >= 0; i--) {
      const c = proyecto.capas[i];
      const li = document.createElement('li');
      li.className = 'som-capa' + (c.id === sel ? ' som-capa--sel' : '') + (c.visible ? '' : ' som-capa--oculta') + (c.modo === 'restar' ? ' som-capa--resta' : '');
      li.dataset.id = c.id;
      li.innerHTML = `
        <button type="button" class="som-capa__ojo" data-capa-accion="visible" title="${c.visible ? 'Ocultar' : 'Mostrar'}">${c.visible ? '👁' : '◌'}</button>
        <span class="som-capa__icono">${ICONO_CAPA[c.tipo] || '▪'}</span>
        <span class="som-capa__nombre" title="${escapar(c.nombre)}">${escapar(c.nombre || c.tipo)}</span>
        <button type="button" class="som-capa__modo" data-capa-accion="modo" title="${c.modo === 'restar' ? 'Resta (agujero). Clic para sumar' : 'Suma (figura). Clic para restar'}">${c.modo === 'restar' ? '−' : '+'}</button>
        <button type="button" class="som-capa__mover" data-capa-accion="subir" title="Traer adelante">▲</button>
        <button type="button" class="som-capa__mover" data-capa-accion="bajar" title="Mandar atrás">▼</button>`;
      listaEl.appendChild(li);
    }
  }
  listaEl.addEventListener('click', e => {
    const li = e.target.closest('li.som-capa');
    if (!li) return;
    const capa = proyecto.capas.find(c => c.id === li.dataset.id);
    if (!capa) return;
    const accion = e.target.closest('[data-capa-accion]');
    if (!accion) { seleccionar(capa.id); return; }
    anotar();
    const a = accion.dataset.capaAccion;
    if (a === 'visible') capa.visible = !capa.visible;
    else if (a === 'modo') capa.modo = capa.modo === 'restar' ? 'sumar' : 'restar';
    else if (a === 'subir') mover(capa, 1);
    else if (a === 'bajar') mover(capa, -1);
    seleccionar(capa.id);
    confirmar();
  });
  function mover(capa, d) {
    const i = idx(capa.id), j = i + d;
    if (j < 0 || j >= proyecto.capas.length) return;
    proyecto.capas.splice(i, 1); proyecto.capas.splice(j, 0, capa);
  }
  function seleccionar(id) {
    sel = id;
    if (id && vista !== 'capas') cambiarVista('capas');
    refrescarLista(); refrescarProps(); redibujar();
  }

  // ------------------------------------------------------------
  // panel de propiedades
  // ------------------------------------------------------------
  function campo(etiqueta, inner, ayuda) {
    return `<label class="som-campo"><span class="som-campo__et">${etiqueta}${ayuda ? ` <small>${ayuda}</small>` : ''}</span>${inner}</label>`;
  }
  const num = (k, v, min, max, paso, unidad) => `<span class="som-num"><input type="number" data-prop="${k}" value="${redondear(v)}" min="${min}" max="${max}" step="${paso}">${unidad ? `<em>${unidad}</em>` : ''}</span>`;
  const rango = (k, v, min, max, paso) => `<span class="som-rango"><input type="range" data-prop="${k}" value="${v}" min="${min}" max="${max}" step="${paso}"><output>${v}</output></span>`;
  const check = (k, v, texto) => `<label class="som-check"><input type="checkbox" data-prop="${k}" ${v ? 'checked' : ''}> ${texto}</label>`;
  const select = (k, v, lista) => `<select data-prop="${k}">${lista.map(o => `<option value="${o.id}" ${o.id === v ? 'selected' : ''}>${o.nombre}</option>`).join('')}</select>`;

  function refrescarProps() {
    const capa = capaSel();
    if (!capa) { propsEl.innerHTML = propsPieza(); enlazarProps(null); return; }
    let html = `<div class="som-panel__titulo">${ICONO_CAPA[capa.tipo]} ${capa.tipo === 'imagen' ? 'Imagen' : capa.tipo === 'texto' ? 'Texto' : 'Forma'}</div>`;
    html += campo('Nombre', `<input type="text" data-prop="nombre" value="${escapar(capa.nombre)}">`);
    html += `<div class="som-fila">${campo('Modo', select('modo', capa.modo, [{ id: 'sumar', nombre: '+ Suma (figura)' }, { id: 'restar', nombre: '− Resta (agujero)' }]))}</div>`;
    if (capa.tipo === 'imagen') html += propsImagen(capa);
    if (capa.tipo === 'texto') html += propsTexto(capa);
    if (capa.tipo === 'forma') html += propsForma(capa);
    const c = cajaCapa(capa);
    html += `<details class="som-detalle" open><summary>Posición y tamaño</summary>
      <div class="som-fila som-fila--2">${campo('X', num('x', capa.x, -500, 500, 0.5, 'mm'))}${campo('Y', num('y', capa.y, -500, 500, 0.5, 'mm'))}</div>
      <div class="som-fila som-fila--2">${capa.tipo === 'texto'
        ? campo('Ancho', `<span class="som-num"><input type="number" value="${redondear(c.w)}" disabled><em>mm</em></span>`) + campo('Alto', `<span class="som-num"><input type="number" value="${redondear(c.h)}" disabled><em>mm</em></span>`)
        : campo('Ancho', num('w', capa.w, 1, 600, 0.5, 'mm')) + campo('Alto', num('h', capa.h, 1, 600, 0.5, 'mm'))}</div>
      <div class="som-fila">${campo('Giro', rango('rot', Math.round(capa.rot || 0), -180, 180, 1))}</div>
      <div class="som-fila som-botones">
        <button type="button" class="som-btn som-btn--chico" data-accion="flipX" title="Espejar horizontal">⇋ Espejar</button>
        <button type="button" class="som-btn som-btn--chico" data-accion="flipY" title="Espejar vertical">⇅ Voltear</button>
        <button type="button" class="som-btn som-btn--chico" data-accion="centrar">⌖ Centrar</button>
        <button type="button" class="som-btn som-btn--chico" data-accion="ajustar" title="Que ocupe toda la pieza">⤢ Llenar</button>
      </div>
    </details>
    <div class="som-fila som-botones">
      <button type="button" class="som-btn som-btn--chico" data-accion="duplicar">⧉ Duplicar</button>
      <button type="button" class="som-btn som-btn--chico som-btn--peligro" data-accion="eliminar">🗑 Eliminar</button>
    </div>`;
    propsEl.innerHTML = html;
    enlazarProps(capa);
  }

  function propsPieza() {
    const pz = proyecto.pieza;
    const tipo = TIPOS_PIEZA.find(t => t.id === pz.tipo) || TIPOS_PIEZA[0];
    let html = `<div class="som-panel__titulo">✂ La pieza</div>
      ${campo('Nombre del diseño', `<input type="text" data-pieza="nombre" value="${escapar(proyecto.nombre)}">`)}
      <div class="som-fila">${campo('Tamaño rápido', `<select data-pieza="preset"><option value="">— elegir —</option>${PRESETS_PIEZA.map(p => `<option value="${p.w}x${p.h}">${p.nombre}</option>`).join('')}</select>`)}</div>
      <div class="som-fila som-fila--2">${campo('Ancho', `<span class="som-num"><input type="number" data-pieza="anchoMm" value="${pz.anchoMm}" min="10" max="300" step="1"><em>mm</em></span>`)}${campo('Alto', `<span class="som-num"><input type="number" data-pieza="altoMm" value="${pz.altoMm}" min="10" max="300" step="1"><em>mm</em></span>`)}</div>
      <div class="som-fila">${campo('Tipo de pieza', `<select data-pieza="tipo">${TIPOS_PIEZA.map(t => `<option value="${t.id}" ${t.id === pz.tipo ? 'selected' : ''}>${t.nombre}</option>`).join('')}</select>`)}</div>
      <p class="som-ayuda">${tipo.ayuda}</p>`;
    if (pz.tipo === 'base') html += `<div class="som-fila som-fila--2">${campo('Base: ancho', `<span class="som-num"><input type="number" data-pieza="base.anchoMm" value="${pz.base.anchoMm}" min="5" max="300" step="1"><em>mm</em></span>`)}${campo('Base: alto', `<span class="som-num"><input type="number" data-pieza="base.altoMm" value="${pz.base.altoMm}" min="3" max="100" step="1"><em>mm</em></span>`)}</div>`;
    if (pz.tipo === 'marco') html += `<div class="som-fila">${campo('Grosor del marco', `<span class="som-num"><input type="number" data-pieza="marco.grosorMm" value="${pz.marco.grosorMm}" min="2" max="60" step="0.5"><em>mm</em></span>`)}</div>`;
    if (pz.tipo === 'ventana') html += `<div class="som-fila">${campo('Esquinas redondeadas', `<span class="som-num"><input type="number" data-pieza="ventana.radioMm" value="${pz.ventana.radioMm}" min="0" max="60" step="1"><em>mm</em></span>`)}</div>`;
    html += `<div class="som-fila">${check('pieza.espejo', pz.espejo, 'Espejar para vinilo termoadhesivo (se corta al revés y queda bien al plancharlo)')}</div>
      <p class="som-ayuda">Hacé clic en una capa (en el lienzo o en la lista) para editarla. Las capas negras <strong>suman</strong> figura; las rojas <strong>restan</strong> (hacen agujeros). Al cortar, todo lo negro es una pieza de vinilo.</p>`;
    return html;
  }

  function propsImagen(capa) {
    const p = capa.proc;
    return `<details class="som-detalle" open><summary>Quitar el fondo</summary>
      <div class="som-fila">${campo('Fondo', select('proc.fondo', p.fondo, [{ id: 'auto', nombre: 'Automático (desde los bordes)' }, { id: 'color', nombre: 'Un color que elijo (gotero)' }, { id: 'ninguno', nombre: 'No quitar nada' }]))}</div>
      ${p.fondo !== 'ninguno' ? `<div class="som-fila">${campo('Tolerancia', rango('proc.tolerancia', p.tolerancia, 0, 160, 1), 'cuánto puede variar el color del fondo')}</div>` : ''}
      ${p.fondo === 'color' ? `<div class="som-fila som-botones"><button type="button" class="som-btn som-btn--chico ${gotero ? 'active' : ''}" data-accion="gotero">💧 Elegir color en la imagen</button><span class="som-muestra" style="background:${p.colorClave ? `rgb(${p.colorClave.join(',')})` : 'transparent'}"></span></div>` : ''}
    </details>
    <details class="som-detalle" open><summary>Pasar a silueta</summary>
      <div class="som-fila">${campo('Qué es figura', select('proc.silueta', p.silueta, [{ id: 'alfa', nombre: 'Todo lo que quedó (sin el fondo)' }, { id: 'oscuro', nombre: 'Sólo lo oscuro (dibujo a lápiz / marcador)' }, { id: 'claro', nombre: 'Sólo lo claro' }]))}</div>
      ${p.silueta !== 'alfa' ? `<div class="som-fila">${campo('Umbral', rango('proc.umbral', p.umbral, 0, 255, 1))}</div>` : ''}
      <div class="som-fila">${check('proc.invertir', p.invertir, 'Invertir (negativo)')}</div>
      <div class="som-fila">${campo('Suavizar', rango('proc.suavizarMm', p.suavizarMm, 0, 3, 0.25), 'mm: cierra grietas y redondea')}</div>
      <div class="som-fila">${campo('Engrosar / afinar', rango('proc.engrosarMm', p.engrosarMm, -3, 3, 0.25), 'mm: + engorda, − adelgaza')}</div>
      <div class="som-fila">${campo('Limpiar manchas', rango('proc.limpiarMm', p.limpiarMm, 0, 6, 0.5), 'borra pedacitos más chicos que esto (mm)')}</div>
      <div class="som-fila som-botones"><button type="button" class="som-btn som-btn--chico" data-accion="reemplazar">🖼 Cambiar la imagen</button></div>
    </details>`;
  }

  function propsTexto(capa) {
    return `<details class="som-detalle" open><summary>El texto</summary>
      ${campo('Texto', `<textarea data-prop="texto" rows="2">${escapar(capa.texto)}</textarea>`, 'Enter para otra línea')}
      <div class="som-fila">${campo('Fuente', select('fuente', capa.fuente, FUENTES))}</div>
      <div class="som-fila som-fila--2">${campo('Tamaño', num('tamMm', capa.tamMm, 3, 300, 1, 'mm'))}${campo('Alineación', select('alineacion', capa.alineacion, [{ id: 'left', nombre: 'Izquierda' }, { id: 'center', nombre: 'Centro' }, { id: 'right', nombre: 'Derecha' }]))}</div>
      <div class="som-fila">${check('negrita', capa.negrita, 'Negrita')}</div>
      <div class="som-fila">${campo('Espacio entre letras', rango('interletra', capa.interletra, -10, 40, 1), 'juntarlas hace que queden unidas al cortar')}</div>
      <div class="som-fila">${campo('Espacio entre líneas', rango('interlinea', capa.interlinea, 0.6, 2, 0.05))}</div>
      <p class="som-ayuda">Consejo: para que las letras salgan en una sola pieza, usá una fuente gorda, letras juntas o ponelas sobre un puente o un marco.</p>
    </details>`;
  }

  function propsForma(capa) {
    const p = capa.params;
    let extra = '';
    if (capa.forma === 'estrella') extra = `<div class="som-fila">${campo('Puntas', rango('params.puntas', p.puntas, 3, 12, 1))}</div><div class="som-fila">${campo('Radio interior', rango('params.interior', p.interior, 15, 90, 1), '%')}</div>`;
    if (capa.forma === 'rectRedondo') extra = `<div class="som-fila">${campo('Esquinas', rango('params.radio', p.radio, 0, 50, 1), '%')}</div>`;
    if (capa.forma === 'anillo' || capa.forma === 'flecha' || capa.forma === 'luna') extra = `<div class="som-fila">${campo('Grosor', rango('params.grosor', p.grosor, 5, 90, 1), '%')}</div>`;
    return `<details class="som-detalle" open><summary>La forma</summary>
      <div class="som-fila">${campo('Forma', select('forma', capa.forma, FORMAS))}</div>${extra}
    </details>`;
  }

  function leerValor(input) {
    if (input.type === 'checkbox') return input.checked;
    if (input.type === 'number' || input.type === 'range') return parseFloat(input.value);
    return input.value;
  }
  function asignar(obj, ruta, valor) {
    const partes = ruta.split('.');
    let o = obj;
    for (let i = 0; i < partes.length - 1; i++) { if (!o[partes[i]]) o[partes[i]] = {}; o = o[partes[i]]; }
    o[partes[partes.length - 1]] = valor;
  }

  function enlazarProps(capa) {
    let anotado = false;
    const alEntrar = () => { if (!anotado) { anotar(); anotado = true; } };
    propsEl.querySelectorAll('[data-prop]').forEach(input => {
      const aplicar = (esFinal) => {
        if (!capa) return;
        alEntrar();
        let v = leerValor(input);
        if (input.dataset.prop === 'pieza.espejo') { proyecto.pieza.espejo = v; confirmar(); return; }
        if (Number.isNaN(v)) return;
        asignar(capa, input.dataset.prop, v);
        if (input.type === 'range') { const out = input.parentElement.querySelector('output'); if (out) out.textContent = v; }
        if (input.dataset.prop === 'fuente') cargarFuente(v).then(() => redibujar());
        if (esFinal && (input.dataset.prop === 'proc.fondo' || input.dataset.prop === 'proc.silueta' || input.dataset.prop === 'forma' || input.dataset.prop === 'modo')) { confirmar(); refrescarProps(); return; }
        confirmar();
      };
      input.addEventListener('input', () => aplicar(false));
      input.addEventListener('change', () => { aplicar(true); anotado = false; });
    });
    propsEl.querySelectorAll('[data-pieza]').forEach(input => {
      const aplicar = () => {
        anotar();
        const k = input.dataset.pieza;
        if (k === 'nombre') { proyecto.nombre = input.value; confirmar(); return; }
        if (k === 'preset') {
          if (!input.value) return;
          const [w, h] = input.value.split('x').map(Number);
          proyecto.pieza.anchoMm = w; proyecto.pieza.altoMm = h;
          confirmar(); refrescarProps(); return;
        }
        let v = leerValor(input);
        if (k === 'anchoMm' || k === 'altoMm') v = Math.min(300, Math.max(10, v || 10));
        asignar(proyecto.pieza, k, v);
        confirmar();
        if (k === 'tipo') refrescarProps();
      };
      input.addEventListener('change', aplicar);
      if (input.type === 'text') input.addEventListener('input', () => { proyecto.nombre = input.value; avisarCambio(); });
    });
    propsEl.querySelectorAll('[data-accion]').forEach(btn => btn.addEventListener('click', () => accion(btn.dataset.accion)));
  }

  // ------------------------------------------------------------
  // acciones
  // ------------------------------------------------------------
  function accion(nombre) {
    const capa = capaSel();
    switch (nombre) {
      case 'imagen': $('[data-input-imagen]').dataset.reemplazar = ''; $('[data-input-imagen]').click(); break;
      case 'reemplazar': $('[data-input-imagen]').dataset.reemplazar = capa ? capa.id : ''; $('[data-input-imagen]').click(); break;
      case 'texto': agregarTexto(); break;
      case 'deshacer': deshacer(); break;
      case 'rehacer': rehacer(); break;
      case 'gotero':
        gotero = gotero ? null : { capaId: capa.id };
        zona.classList.toggle('som-lienzo--gotero', !!gotero);
        toast(gotero ? 'Hacé clic sobre el color de fondo que querés quitar' : 'Gotero cancelado');
        refrescarProps();
        break;
      case 'flipX': if (capa) { anotar(); capa.flipX = !capa.flipX; confirmar(); } break;
      case 'flipY': if (capa) { anotar(); capa.flipY = !capa.flipY; confirmar(); } break;
      case 'centrar': if (capa) { anotar(); capa.x = proyecto.pieza.anchoMm / 2; capa.y = proyecto.pieza.altoMm / 2; confirmar(); refrescarProps(); } break;
      case 'ajustar': if (capa) { anotar(); ajustarAPieza(capa); confirmar(); refrescarProps(); } break;
      case 'duplicar': if (capa) duplicar(capa); break;
      case 'eliminar': if (capa) eliminar(capa); break;
    }
  }

  function ajustarAPieza(capa) {
    const pz = proyecto.pieza;
    const c = cajaCapa(capa);
    const s = Math.min((pz.anchoMm * 0.92) / c.w, (pz.altoMm * 0.92) / c.h);
    if (capa.tipo === 'texto') capa.tamMm = Math.max(3, capa.tamMm * s);
    else { capa.w = c.w * s; capa.h = c.h * s; }
    capa.x = pz.anchoMm / 2; capa.y = pz.altoMm / 2; capa.rot = 0;
  }

  function agregarCapa(capa) {
    anotar();
    if (!capa.nombre) capa.nombre = capa.tipo;
    proyecto.capas.push(capa);
    seleccionar(capa.id);
    confirmar();
  }

  function agregarTexto() {
    const n = proyecto.capas.filter(c => c.tipo === 'texto').length + 1;
    const capa = nuevaCapa('texto', { nombre: `Texto ${n}`, x: proyecto.pieza.anchoMm / 2, y: proyecto.pieza.altoMm / 2, tamMm: Math.max(8, Math.round(proyecto.pieza.anchoMm / 6)) });
    cargarFuente(capa.fuente).then(() => redibujar());
    agregarCapa(capa);
    const ta = propsEl.querySelector('textarea[data-prop="texto"]');
    if (ta) { ta.focus(); ta.select(); }
  }

  function agregarForma(forma) {
    const pz = proyecto.pieza;
    const lado = Math.round(Math.min(pz.anchoMm, pz.altoMm) * 0.4);
    const n = proyecto.capas.filter(c => c.tipo === 'forma').length + 1;
    const nombreForma = (FORMAS.find(f => f.id === forma) || {}).nombre || 'Forma';
    const capa = nuevaCapa('forma', { forma, nombre: `${nombreForma} ${n}`, x: pz.anchoMm / 2, y: pz.altoMm / 2, w: lado, h: lado });
    if (forma === 'puente') { capa.w = Math.round(pz.anchoMm * 0.6); capa.h = 4; capa.nombre = `Puente ${n}`; }
    if (forma === 'flecha') capa.h = Math.round(lado * 0.6);
    agregarCapa(capa);
  }

  async function agregarImagen(archivo, reemplazarId) {
    try {
      toast('Leyendo la imagen…');
      const { src, ancho, alto } = await leerArchivoImagen(archivo, 1400);
      await asegurarImagen(src);
      const pz = proyecto.pieza;
      const existente = reemplazarId ? proyecto.capas.find(c => c.id === reemplazarId) : null;
      if (existente) {
        anotar();
        existente.src = src; existente.ancho = ancho; existente.alto = alto;
        const s = Math.min(existente.w / ancho, existente.h / alto);
        existente.w = ancho * s; existente.h = alto * s;
        seleccionar(existente.id); confirmar();
        return;
      }
      const s = Math.min((pz.anchoMm * 0.7) / ancho, (pz.altoMm * 0.7) / alto);
      const n = proyecto.capas.filter(c => c.tipo === 'imagen').length + 1;
      const capa = nuevaCapa('imagen', { nombre: (archivo.name || `Imagen ${n}`).replace(/\.[a-z0-9]+$/i, '').slice(0, 30), src, ancho, alto, x: pz.anchoMm / 2, y: pz.altoMm / 2, w: ancho * s, h: alto * s });
      agregarCapa(capa);
      toast('Imagen agregada: ajustá «Quitar el fondo» a la derecha');
    } catch (e) { toast(e.message || 'No se pudo cargar la imagen'); }
  }

  function duplicar(capa) {
    anotar();
    const copia = clonar(capa);
    copia.id = nuevaCapa(capa.tipo).id;
    copia.nombre = (capa.nombre || capa.tipo) + ' copia';
    copia.x += 5; copia.y += 5;
    proyecto.capas.splice(idx(capa.id) + 1, 0, copia);
    seleccionar(copia.id); confirmar();
  }
  function eliminar(capa) {
    anotar();
    proyecto.capas.splice(idx(capa.id), 1);
    sel = null;
    refrescarProps(); confirmar();
  }

  // ------------------------------------------------------------
  // eventos de la barra
  // ------------------------------------------------------------
  $$('.som-barra [data-accion]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.accion === 'formas') { $('.som-desplegable').classList.toggle('abierto'); return; }
    accion(b.dataset.accion);
  }));
  document.addEventListener('click', e => { if (!e.target.closest('.som-desplegable')) $('.som-desplegable').classList.remove('abierto'); });
  $$('[data-vista]').forEach(b => b.addEventListener('click', () => cambiarVista(b.dataset.vista)));
  function cambiarVista(v) {
    vista = v;
    $$('[data-vista]').forEach(b => b.classList.toggle('active', b.dataset.vista === v));
    redibujar();
  }
  $('[data-input-imagen]').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    const reemplazar = e.target.dataset.reemplazar || '';
    e.target.value = '';
    if (f) agregarImagen(f, reemplazar);
  });

  // menú de formas con iconos
  (function armarFormas() {
    const panel = $('[data-panel-formas]');
    for (const f of FORMAS) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'som-forma'; b.title = f.nombre;
      const cv = document.createElement('canvas'); cv.width = 36; cv.height = 36;
      const c = cv.getContext('2d');
      c.translate(4, 4); c.scale(28, 28);
      c.fillStyle = '#222';
      if (f.id === 'puente') { c.fillRect(0, 0.42, 1, 0.16); }
      else c.fill(pathDeForma(f.id, { radio: 20, puntas: 5, grosor: 30, interior: 50 }), 'evenodd');
      b.appendChild(cv);
      const s = document.createElement('span'); s.textContent = f.nombre; b.appendChild(s);
      b.addEventListener('click', () => { $('.som-desplegable').classList.remove('abierto'); agregarForma(f.id); });
      panel.appendChild(b);
    }
  })();

  // ------------------------------------------------------------
  // puntero sobre el lienzo
  // ------------------------------------------------------------
  canvas.addEventListener('pointerdown', e => {
    if (op.soloLectura) return;
    zona.focus({ preventScroll: true });
    if (vista !== 'capas') { cambiarVista('capas'); }
    const p = puntoDeEvento(e);
    if (gotero) {
      const capa = proyecto.capas.find(c => c.id === gotero.capaId);
      if (capa) {
        const l = aLocal(capa, p);
        const c = cajaCapa(capa);
        let fx = l.x / c.w + 0.5, fy = l.y / c.h + 0.5;
        if (capa.flipX) fx = 1 - fx; if (capa.flipY) fy = 1 - fy;
        if (fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1) {
          anotar();
          capa.proc.colorClave = colorEnImagen(capa, fx, fy);
          capa.proc.fondo = 'color';
          gotero = null; zona.classList.remove('som-lienzo--gotero');
          confirmar(); refrescarProps();
          toast('Color elegido: ajustá la tolerancia si hace falta');
          return;
        }
      }
      toast('Hacé clic dentro de la imagen');
      return;
    }
    const capa = capaSel();
    let manija = capa ? manijaEn(capa, p) : null;
    let objetivo = capa;
    if (!manija) {
      objetivo = capaEn(p);
      if (objetivo && objetivo.id !== sel) seleccionar(objetivo.id);
      if (!objetivo) { if (sel) { sel = null; refrescarLista(); refrescarProps(); redibujar(); } return; }
    }
    canvas.setPointerCapture(e.pointerId);
    anotar();
    const c = cajaCapa(objetivo);
    arrastre = {
      capa: objetivo, tipo: manija ? manija.tipo : 'mover', manija,
      inicio: p, x0: objetivo.x, y0: objetivo.y, w0: c.w, h0: c.h, rot0: objetivo.rot || 0, tam0: objetivo.tamMm,
      movio: false
    };
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', e => {
    if (!arrastre) {
      const capa = capaSel();
      const p = puntoDeEvento(e);
      let cursor = 'default';
      if (gotero) cursor = 'crosshair';
      else if (capa && manijaEn(capa, p)) cursor = manijaEn(capa, p).tipo === 'rotar' ? 'grab' : 'nwse-resize';
      else if (capaEn(p)) cursor = 'move';
      canvas.style.cursor = cursor;
      return;
    }
    const a = arrastre, capa = a.capa, p = puntoDeEvento(e);
    a.movio = true;
    if (a.tipo === 'mover') {
      capa.x = a.x0 + (p.x - a.inicio.x);
      capa.y = a.y0 + (p.y - a.inicio.y);
      if (e.shiftKey) { if (Math.abs(p.x - a.inicio.x) > Math.abs(p.y - a.inicio.y)) capa.y = a.y0; else capa.x = a.x0; }
    } else if (a.tipo === 'rotar') {
      const ang = Math.atan2(p.y - a.y0, p.x - a.x0) * 180 / Math.PI + 90;
      let r = ((ang + 180) % 360 + 360) % 360 - 180;
      if (e.shiftKey) r = Math.round(r / 15) * 15;
      else { const cerca = Math.round(r / 90) * 90; if (Math.abs(r - cerca) < 3) r = cerca; }
      capa.rot = r;
    } else if (a.tipo === 'escalar') {
      const m = a.manija;
      // trabajar en el marco local con la rotación y el centro originales
      const ref = { x: a.x0, y: a.y0, rot: a.rot0 };
      const l = aLocal(ref, p);
      const o = { x: -m.sx * a.w0 / 2, y: -m.sy * a.h0 / 2 }; // esquina opuesta, fija
      let nw = Math.max(1, Math.abs(l.x - o.x)), nh = Math.max(1, Math.abs(l.y - o.y));
      const mantener = capa.tipo === 'texto' || (capa.tipo === 'imagen') !== e.shiftKey;
      if (mantener) { const s = Math.max(nw / a.w0, nh / a.h0); nw = a.w0 * s; nh = a.h0 * s; }
      if (capa.tipo === 'texto') capa.tamMm = Math.max(2, a.tam0 * nh / a.h0);
      else { capa.w = nw; capa.h = nh; }
      const centroLocal = { x: o.x + m.sx * nw / 2, y: o.y + m.sy * nh / 2 };
      const centro = deLocal(ref, centroLocal);
      capa.x = centro.x; capa.y = centro.y;
    }
    redibujar();
  });
  const soltar = e => {
    if (!arrastre) return;
    const a = arrastre; arrastre = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    if (!a.movio) { historial.pop(); return; }
    confirmar(); refrescarProps();
  };
  canvas.addEventListener('pointerup', soltar);
  canvas.addEventListener('pointercancel', soltar);

  // teclado
  zona.addEventListener('keydown', e => {
    if (op.soloLectura) return;
    const capa = capaSel();
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) rehacer(); else deshacer(); return; }
    if (ctrl && e.key.toLowerCase() === 'y') { e.preventDefault(); rehacer(); return; }
    if (!capa) return;
    if (ctrl && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicar(capa); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); eliminar(capa); return; }
    const paso = e.shiftKey ? 10 : 1;
    const flechas = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] };
    if (flechas[e.key]) {
      e.preventDefault();
      anotar();
      capa.x += flechas[e.key][0]; capa.y += flechas[e.key][1];
      confirmar(); refrescarProps();
    }
  });

  // arrastrar y pegar imágenes
  zona.addEventListener('dragover', e => { e.preventDefault(); zona.classList.add('som-lienzo--sobre'); });
  zona.addEventListener('dragleave', () => zona.classList.remove('som-lienzo--sobre'));
  zona.addEventListener('drop', e => {
    e.preventDefault(); zona.classList.remove('som-lienzo--sobre');
    const f = e.dataTransfer.files && Array.from(e.dataTransfer.files).find(x => x.type.startsWith('image/'));
    if (f) agregarImagen(f, '');
  });
  const alPegar = e => {
    if (op.soloLectura) return;
    if (!contenedor.contains(document.activeElement) && document.activeElement !== document.body) return;
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const it of items) if (it.type.startsWith('image/')) { e.preventDefault(); agregarImagen(it.getAsFile(), ''); return; }
  };
  document.addEventListener('paste', alPegar);

  // redibujar al cambiar el tamaño de la ventana o al cargar fuentes
  const alRedimensionar = () => redibujar();
  window.addEventListener('resize', alRedimensionar);
  if (document.fonts) document.fonts.addEventListener('loadingdone', alRedimensionar);
  const observador = ('ResizeObserver' in window) ? new ResizeObserver(alRedimensionar) : null;
  if (observador) observador.observe(zona);

  // ------------------------------------------------------------
  // API
  // ------------------------------------------------------------
  async function cargar(p) {
    silenciarCambio = true;
    proyecto = normalizarProyecto(clonar(p || nuevoProyecto()));
    sel = null; historial.length = 0; futuro.length = 0;
    refrescarLista(); refrescarProps(); redibujar();
    await prepararProyecto(proyecto);
    silenciarCambio = false;
    redibujar();
  }

  refrescarLista(); refrescarProps(); redibujar();

  return {
    cargar,
    obtener: () => proyecto,
    vaciarCambio,
    redibujar,
    seleccionar: id => seleccionar(id),
    agregarImagen: (archivo) => agregarImagen(archivo, ''),
    destruir() {
      window.removeEventListener('resize', alRedimensionar);
      document.removeEventListener('paste', alPegar);
      if (observador) observador.disconnect();
      contenedor.innerHTML = '';
    }
  };
}

function escapar(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function redondear(n) { return Math.round((n || 0) * 10) / 10; }
