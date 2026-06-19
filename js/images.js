// Carga masiva + auto-match de imágenes a tokens [IMG: ...]

function normalizarNombre(nombre) {
  return nombre.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\s+/g, "_").replace(/\.[^.]+$/, "");
}

const TIPOS_VALIDOS = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export class GestorImagenes {
  constructor() {
    this.archivos = new Map(); // nombre original → { file, dataUrl }
    this.asociaciones = new Map(); // token → nombre archivo
    this.tokens = [];
  }

  setTokens(preguntas) {
    this.tokens = [];
    preguntas.forEach(p => {
      p.imagenes.forEach(token => {
        if (!this.tokens.includes(token)) {
          this.tokens.push(token);
        }
      });
    });
    this.autoMatch();
  }

  async cargarArchivos(fileList) {
    const errores = [];
    for (const file of fileList) {
      if (!TIPOS_VALIDOS.includes(file.type)) {
        errores.push(`"${file.name}" no es una imagen válida (PNG, JPG, WebP, SVG, GIF).`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        errores.push(`"${file.name}" pesa más de 10 MB.`);
        continue;
      }
      const dataUrl = await this.leerArchivo(file);
      this.archivos.set(file.name, { file, dataUrl });
    }
    this.autoMatch();
    return errores;
  }

  leerArchivo(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }

  autoMatch() {
    this.tokens.forEach(token => {
      if (this.asociaciones.has(token)) return;
      const tokenNorm = normalizarNombre(token);
      for (const [nombre] of this.archivos) {
        const archivoNorm = normalizarNombre(nombre);
        if (archivoNorm === tokenNorm) {
          this.asociaciones.set(token, nombre);
          break;
        }
      }
    });
  }

  asignarManual(token, nombreArchivo) {
    this.asociaciones.set(token, nombreArchivo);
  }

  obtenerArchivo(token) {
    const nombre = this.asociaciones.get(token);
    if (!nombre) return null;
    return this.archivos.get(nombre) || null;
  }

  todosResueltos() {
    return this.tokens.every(t => this.asociaciones.has(t));
  }

  renderPanel(contenedor) {
    contenedor.innerHTML = '';
    if (this.tokens.length === 0) return;

    const archivosDisponibles = Array.from(this.archivos.keys());

    this.tokens.forEach(token => {
      const asociado = this.asociaciones.get(token);
      const chip = document.createElement('div');
      chip.className = `chip-imagen ${asociado ? 'chip-imagen--ok' : 'chip-imagen--pendiente'}`;

      let selectHtml = '';
      if (archivosDisponibles.length > 0) {
        selectHtml = `<select data-token="${token}" style="font-size:0.7rem;padding:2px;border-radius:4px;border:1px solid var(--color-borde)">
          <option value="">— Elegí —</option>
          ${archivosDisponibles.map(n => `<option value="${n}" ${n === asociado ? 'selected' : ''}>${n}</option>`).join('')}
        </select>`;
      }

      chip.innerHTML = `🖼️ ${token} ${asociado ? '✅' : '⚠️'} ${selectHtml}`;
      contenedor.appendChild(chip);
    });

    contenedor.addEventListener('change', (e) => {
      if (e.target.tagName === 'SELECT') {
        const token = e.target.dataset.token;
        const val = e.target.value;
        if (val) {
          this.asignarManual(token, val);
        } else {
          this.asociaciones.delete(token);
        }
        this.renderPanel(contenedor);
      }
    });
  }
}
