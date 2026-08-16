// mate.js — Fórmulas en LaTeX dentro de los textos del protocolo.
//
// El docente escribe la fórmula entre signos de peso, como en cualquier editor
// científico: $v = d/t$ queda en el medio del renglón y $$…$$ queda centrada en
// su propio bloque. Las dibuja KaTeX, que viene vendorizado con sus fuentes
// adentro del CSS: no se descarga nada, así que sale igual en pantalla, en la
// impresión y en el PDF.

const hayKatex = () => typeof window !== 'undefined' && typeof window.katex !== 'undefined';

// ¿El texto trae alguna fórmula? Sirve para no molestar cuando no hace falta.
export function tieneFormulas(texto) {
  return /\$[^$\n]+\$|\$\$[\s\S]+?\$\$/.test(String(texto || ''));
}

// Divide un texto en trozos de prosa y de fórmula.
// Devuelve [{tipo:'texto'|'formula', valor, bloque}]
export function trozos(texto) {
  const salida = [];
  const s = String(texto == null ? '' : texto);
  // $$…$$ primero (bloque) y después $…$ (en línea). El \$ escapado no cuenta.
  const re = /\$\$([\s\S]+?)\$\$|(?<!\\)\$([^$\n]+?)(?<!\\)\$/g;
  let ultimo = 0;
  let m;
  while ((m = re.exec(s)) !== null) {
    if (m.index > ultimo) salida.push({ tipo: 'texto', valor: s.slice(ultimo, m.index) });
    salida.push({ tipo: 'formula', valor: (m[1] != null ? m[1] : m[2]).trim(), bloque: m[1] != null });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < s.length) salida.push({ tipo: 'texto', valor: s.slice(ultimo) });
  return salida;
}

// Dibuja una fórmula suelta. Si KaTeX no cargó o el LaTeX está mal escrito,
// devuelve el código tal cual marcado en rojo: el docente ve dónde está el error
// en vez de encontrarse con un hueco en blanco.
export function formula(latex, bloque) {
  const cont = document.createElement(bloque ? 'div' : 'span');
  cont.className = 'mate' + (bloque ? ' mate--bloque' : '');
  if (!hayKatex()) {
    cont.classList.add('mate--crudo');
    cont.textContent = (bloque ? '$$' : '$') + latex + (bloque ? '$$' : '$');
    return cont;
  }
  try {
    window.katex.render(latex, cont, {
      displayMode: !!bloque,
      throwOnError: true,
      strict: false,
      output: 'html',      // sólo HTML: el MathML de más confunde a html2canvas
      trust: false         // sin \href ni \includegraphics: es texto de terceros
    });
  } catch (e) {
    cont.classList.add('mate--error');
    cont.textContent = (bloque ? '$$' : '$') + latex + (bloque ? '$$' : '$');
    cont.title = 'No se entendió esta fórmula: ' + (e.message || '');
  }
  return cont;
}

// Un texto con fórmulas adentro, listo para meter en el documento.
// Respeta los saltos de línea simples del texto original.
export function conFormulas(texto) {
  const frag = document.createDocumentFragment();
  trozos(texto).forEach(t => {
    if (t.tipo === 'formula') { frag.appendChild(formula(t.valor, t.bloque)); return; }
    t.valor.split('\n').forEach((linea, i) => {
      if (i) frag.appendChild(document.createElement('br'));
      if (linea) frag.appendChild(document.createTextNode(linea));
    });
  });
  return frag;
}

// Igual que conFormulas, pero además parte el texto en párrafos (un renglón en
// blanco separa uno de otro). Una fórmula de bloque sola arma su propio párrafo.
export function parrafosConFormulas(contenedor, texto, clase) {
  String(texto == null ? '' : texto).split(/\n{2,}/).forEach(bloque => {
    const t = bloque.trim();
    if (!t) return;
    // Una fórmula $$…$$ que ocupa todo el párrafo va suelta, sin <p> alrededor:
    // así queda centrada y con su propio aire.
    const soloFormula = t.match(/^\$\$([\s\S]+)\$\$$/);
    if (soloFormula) {
      contenedor.appendChild(formula(soloFormula[1].trim(), true));
      return;
    }
    const p = document.createElement('p');
    p.className = clase || 'pro-parrafo';
    p.appendChild(conFormulas(t));
    contenedor.appendChild(p);
  });
}

// Atajos que se ofrecen en el editor. Cada uno es lo que se pega en el textarea.
export const ATAJOS_LATEX = [
  { etiqueta: 'Fracción', latex: '\\frac{a}{b}', muestra: '\\frac{a}{b}' },
  { etiqueta: 'Subíndice', latex: 'V_{1}', muestra: 'V_{1}' },
  { etiqueta: 'Potencia', latex: 'v^{2}', muestra: 'v^{2}' },
  { etiqueta: 'Raíz', latex: '\\sqrt{x}', muestra: '\\sqrt{x}' },
  { etiqueta: 'Raíz n', latex: '\\sqrt[n]{x}', muestra: '\\sqrt[n]{x}' },
  { etiqueta: 'Por', latex: '\\cdot', muestra: 'a \\cdot b' },
  { etiqueta: 'Más/menos', latex: '\\pm', muestra: '\\pm' },
  { etiqueta: 'Grados', latex: '^\\circ', muestra: '90^\\circ' },
  { etiqueta: 'Delta', latex: '\\Delta', muestra: '\\Delta t' },
  { etiqueta: 'Pi', latex: '\\pi', muestra: '\\pi' },
  { etiqueta: 'Ro (densidad)', latex: '\\rho', muestra: '\\rho' },
  { etiqueta: 'Omega', latex: '\\Omega', muestra: '\\Omega' },
  { etiqueta: 'Mu (micro)', latex: '\\mu', muestra: '\\mu' },
  { etiqueta: 'Lambda', latex: '\\lambda', muestra: '\\lambda' },
  { etiqueta: 'Theta', latex: '\\theta', muestra: '\\theta' },
  { etiqueta: 'Aprox.', latex: '\\approx', muestra: '\\approx' },
  { etiqueta: 'Proporcional', latex: '\\propto', muestra: '\\propto' },
  { etiqueta: 'Flecha', latex: '\\rightarrow', muestra: '\\rightarrow' },
  { etiqueta: 'Sumatoria', latex: '\\sum_{i=1}^{n}', muestra: '\\sum_{i=1}^{n}' },
  { etiqueta: 'Integral', latex: '\\int_{a}^{b}', muestra: '\\int_{a}^{b}' },
  { etiqueta: 'Vector', latex: '\\vec{F}', muestra: '\\vec{F}' },
  { etiqueta: 'Promedio', latex: '\\bar{x}', muestra: '\\bar{x}' },
  { etiqueta: 'Notación ×10', latex: '\\times 10^{-3}', muestra: '1{,}5 \\times 10^{-3}' },
  { etiqueta: 'Unidad', latex: '\\ \\mathrm{m/s^2}', muestra: '9{,}8\\ \\mathrm{m/s^2}' }
];

// Ejemplos que se muestran como ayuda rápida.
export const EJEMPLOS_LATEX = [
  { que: 'Densidad', latex: 'd = \\frac{m}{V}' },
  { que: 'Velocidad media', latex: '\\bar{v} = \\frac{\\Delta x}{\\Delta t}' },
  { que: 'Período del péndulo', latex: 'T = 2\\pi\\sqrt{\\frac{L}{g}}' },
  { que: 'Ley de Ohm', latex: 'V = I \\cdot R' },
  { que: 'Calor', latex: 'Q = m \\cdot c \\cdot \\Delta T' },
  { que: 'Energía cinética', latex: 'E_c = \\frac{1}{2}\\,m\\,v^{2}' },
  { que: 'Incertidumbre relativa', latex: '\\frac{\\Delta d}{d} = \\frac{\\Delta m}{m} + \\frac{\\Delta V}{V}' },
  { que: 'Concentración', latex: 'C_a = \\frac{C_b \\cdot V_b}{V_a}' }
];
