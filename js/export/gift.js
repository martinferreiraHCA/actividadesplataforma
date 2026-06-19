// Export formato GIFT para Moodle

function escapeGift(str) {
  return str.replace(/[~=#{}:]/g, '\\$&');
}

function limpiarEnunciado(texto) {
  return texto.replace(/\[IMG:\s*[^\]]+\]/gi, '').replace(/\n/g, ' ').trim();
}

export function generarGIFT(preguntas, titulo) {
  let gift = '';
  if (titulo) {
    gift += `// ${titulo}\n\n`;
  }

  preguntas.forEach(p => {
    const enunciado = escapeGift(limpiarEnunciado(p.enunciado));

    switch (p.tipo) {
      case 'opcion_multiple': {
        const correctas = p.opciones.filter(o => o.correcta);
        const esMultiple = correctas.length > 1;

        if (esMultiple) {
          const pesoCorrecta = (100 / correctas.length).toFixed(5);
          const pesoIncorrecta = (-100 / (p.opciones.length - correctas.length)).toFixed(5);
          const opciones = p.opciones.map(o => {
            const peso = o.correcta ? `%${pesoCorrecta}%` : `%-${Math.abs(parseFloat(pesoIncorrecta)).toFixed(5)}%`;
            return `  ~${peso}${escapeGift(o.texto)}`;
          }).join('\n');
          gift += `::P${p.numero}::${enunciado} {\n${opciones}\n`;
        } else {
          const opciones = p.opciones.map(o =>
            `  ${o.correcta ? '=' : '~'}${escapeGift(o.texto)}`
          ).join('\n');
          gift += `::P${p.numero}::${enunciado} {\n${opciones}\n`;
        }
        if (p.retro) {
          gift += `  ####${escapeGift(p.retro)}\n`;
        }
        gift += '}\n\n';
        break;
      }

      case 'verdadero_falso': {
        const resp = p.respuestaCorrecta ? 'TRUE' : 'FALSE';
        gift += `::P${p.numero}::${enunciado} {${resp}`;
        if (p.retro) {
          gift += ` ####${escapeGift(p.retro)}`;
        }
        gift += '}\n\n';
        break;
      }

      case 'respuesta_corta': {
        const respuestas = p.respuestasAceptadas.map(r =>
          `  =${escapeGift(r)}`
        ).join('\n');
        gift += `::P${p.numero}::${enunciado} {\n${respuestas}\n}\n\n`;
        break;
      }

      case 'numerica': {
        gift += `::P${p.numero}::${enunciado} {#${p.respuestaCorrecta}:${p.tolerancia}}\n\n`;
        break;
      }

      case 'emparejamiento': {
        const pares = p.pares.map(par =>
          `  =${escapeGift(par.izquierda)} -> ${escapeGift(par.derecha)}`
        ).join('\n');
        gift += `::P${p.numero}::${enunciado} {\n${pares}\n}\n\n`;
        break;
      }

      case 'ensayo': {
        gift += `::P${p.numero}::${enunciado} {}\n\n`;
        break;
      }
    }
  });

  return gift;
}
