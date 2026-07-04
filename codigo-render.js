// Fichas de código en texto plano: resaltado de sintaxis con highlight.js,
// detección automática del lenguaje y render a PNG (para Word y para las
// imágenes de las preguntas de CREA). Cada lenguaje tiene su color de acento
// y los tokens se pintan con la paleta clásica de GitHub.

const hljs = window.hljs;

export const LENGUAJES_CODIGO = [
  ['auto', '✨ Detectar automáticamente'],
  ['python', 'Python'],
  ['javascript', 'JavaScript'],
  ['typescript', 'TypeScript'],
  ['java', 'Java'],
  ['c', 'C'],
  ['cpp', 'C++'],
  ['csharp', 'C#'],
  ['xml', 'HTML / XML'],
  ['css', 'CSS'],
  ['sql', 'SQL'],
  ['php', 'PHP'],
  ['bash', 'Bash / Terminal'],
  ['json', 'JSON'],
  ['ruby', 'Ruby'],
  ['go', 'Go'],
  ['lua', 'Lua'],
  ['plaintext', 'Texto plano (sin colores)']
];

// subconjunto que participa de la detección automática (typescript afuera:
// confunde a java; igual se puede elegir a mano)
const SUBSET_AUTO = ['python', 'javascript', 'java', 'c', 'cpp', 'csharp', 'xml', 'css', 'sql', 'php', 'bash', 'json', 'ruby', 'go', 'lua'];

// color de acento por lenguaje (basados en GitHub Linguist, ajustados para contraste)
export const ACENTO_LENGUAJE = {
  python: '#3572A5', javascript: '#a8890a', typescript: '#3178c6', java: '#b07219',
  c: '#555555', cpp: '#f34b7d', csharp: '#178600', xml: '#e34c26', css: '#563d7c',
  sql: '#e38c00', php: '#4F5D95', bash: '#4EAA25', json: '#292929', ruby: '#701516',
  go: '#00ADD8', lua: '#000080', plaintext: '#6a737d'
};

export function nombreLenguaje(id) {
  const par = LENGUAJES_CODIGO.find(([v]) => v === id);
  return par ? par[1].replace('✨ ', '') : id;
}

// paleta de tokens (GitHub light) — la misma para la vista previa (CSS en
// scratch.css) y para el PNG (acá). Si cambiás una, cambiá la otra.
const COLOR_TOKEN = {
  keyword: '#d73a49', literal: '#005cc5', symbol: '#005cc5', number: '#005cc5',
  built_in: '#005cc5', type: '#d73a49', operator: '#d73a49',
  string: '#032f62', regexp: '#032f62', subst: '#24292e',
  comment: '#6a737d', quote: '#6a737d', doctag: '#d73a49',
  title: '#6f42c1', params: '#24292e',
  tag: '#22863a', name: '#22863a', attr: '#005cc5', attribute: '#005cc5',
  variable: '#e36209', 'template-variable': '#e36209', property: '#005cc5',
  meta: '#005cc5', 'meta-keyword': '#d73a49', 'meta-string': '#032f62',
  section: '#005cc5', bullet: '#735c0f',
  addition: '#22863a', deletion: '#b31d28',
  'selector-tag': '#22863a', 'selector-id': '#6f42c1', 'selector-class': '#6f42c1',
  'selector-attr': '#005cc5', 'selector-pseudo': '#005cc5'
};
const COLOR_TEXTO = '#24292e';
const COLOR_FONDO = '#f6f8fa';

export function hayResaltador() {
  return !!hljs;
}

// Detecta el lenguaje. Devuelve id de lenguaje ('python', ...) o 'plaintext'.
export function detectarLenguaje(codigo) {
  if (!hljs || !codigo.trim()) return 'plaintext';
  try {
    const r = hljs.highlightAuto(codigo, SUBSET_AUTO);
    return (r.language && r.relevance >= 2) ? r.language : 'plaintext';
  } catch (e) {
    return 'plaintext';
  }
}

// Resuelve el lenguaje efectivo de una ficha de código
export function lenguajeEfectivo(codigo, lenguaje) {
  if (lenguaje && lenguaje !== 'auto') return lenguaje;
  return detectarLenguaje(codigo);
}

// HTML resaltado (para la vista previa y el PDF)
export function resaltarHTML(codigo, lenguaje) {
  const lang = lenguajeEfectivo(codigo, lenguaje);
  if (!hljs || lang === 'plaintext') {
    return { lang, html: escHtml(codigo) };
  }
  try {
    return { lang, html: hljs.highlight(codigo, { language: lang, ignoreIllegals: true }).value };
  } catch (e) {
    return { lang: 'plaintext', html: escHtml(codigo) };
  }
}

// <pre> coloreado listo para insertar en la ficha
export function elementoCodigo(codigo, lenguaje, escala) {
  const { lang, html } = resaltarHTML(codigo, lenguaje);
  const pre = document.createElement('pre');
  pre.className = 'ficha-view__pre ficha-view__pre--hl';
  pre.style.borderLeft = '4px solid ' + (ACENTO_LENGUAJE[lang] || '#6a737d');
  if (escala && escala !== 1) pre.style.fontSize = (0.78 * escala) + 'rem';
  const code = document.createElement('code');
  code.innerHTML = html;
  pre.appendChild(code);

  const etiqueta = document.createElement('span');
  etiqueta.className = 'ficha-view__pre-lang';
  etiqueta.style.color = ACENTO_LENGUAJE[lang] || '#6a737d';
  etiqueta.textContent = nombreLenguaje(lang);
  pre.appendChild(etiqueta);
  return pre;
}

// ---- render a PNG (canvas): mismo coloreado, para Word y preguntas ----

// aplana el HTML resaltado en corridas [{text, color, italic}]
function corridas(html) {
  const cont = document.createElement('div');
  cont.innerHTML = html;
  const out = [];
  (function walk(node, color, italic) {
    node.childNodes.forEach(ch => {
      if (ch.nodeType === Node.TEXT_NODE) {
        out.push({ text: ch.textContent, color, italic });
      } else if (ch.nodeType === Node.ELEMENT_NODE) {
        let c = color, it = italic;
        (ch.className || '').split(/\s+/).forEach(cls => {
          if (cls.startsWith('hljs-')) {
            const token = cls.slice(5);
            if (COLOR_TOKEN[token]) c = COLOR_TOKEN[token];
            if (token === 'comment' || token === 'quote') it = true;
          }
        });
        walk(ch, c, it);
      }
    });
  })(cont, COLOR_TEXTO, false);
  return out;
}

export function codigoAPng(codigo, lenguaje, escala) {
  const { lang, html } = resaltarHTML(codigo.replace(/\t/g, '    '), lenguaje);
  const runs = corridas(html);

  // separar corridas por línea
  const lineas = [[]];
  runs.forEach(r => {
    const partes = r.text.split('\n');
    partes.forEach((p, i) => {
      if (i > 0) lineas.push([]);
      if (p) lineas[lineas.length - 1].push({ ...r, text: p });
    });
  });
  while (lineas.length && !lineas[lineas.length - 1].length) lineas.pop();

  const fontSize = Math.round(14 * (escala || 1));
  const lineH = Math.round(fontSize * 1.55);
  const pad = Math.round(fontSize * 1.1);
  const barra = 4;
  const K = 2; // nitidez 2x

  const medidor = document.createElement('canvas').getContext('2d');
  const font = (it) => `${it ? 'italic ' : ''}${fontSize}px "JetBrains Mono", Consolas, monospace`;
  let maxW = 120;
  lineas.forEach(l => {
    medidor.font = font(false);
    let w = 0;
    l.forEach(r => { medidor.font = font(r.italic); w += medidor.measureText(r.text).width; });
    if (w > maxW) maxW = w;
  });

  const width = Math.ceil(maxW + pad * 2 + barra);
  const height = Math.ceil(Math.max(lineas.length, 1) * lineH + pad * 2);
  const canvas = document.createElement('canvas');
  canvas.width = width * K;
  canvas.height = height * K;
  const ctx = canvas.getContext('2d');
  ctx.scale(K, K);

  ctx.fillStyle = COLOR_FONDO;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = ACENTO_LENGUAJE[lang] || '#6a737d';
  ctx.fillRect(0, 0, barra, height);

  ctx.textBaseline = 'middle';
  lineas.forEach((l, i) => {
    let x = barra + pad;
    const y = pad + i * lineH + lineH / 2;
    l.forEach(r => {
      ctx.font = font(r.italic);
      ctx.fillStyle = r.color;
      ctx.fillText(r.text, x, y);
      x += ctx.measureText(r.text).width;
    });
  });

  return { dataUrl: canvas.toDataURL('image/png'), width, height, lang };
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
