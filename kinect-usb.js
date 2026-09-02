// Kinect v1 (Xbox 360 / Kinect for Windows) por WebUSB, directo desde el navegador.
//
// Habla con la cámara del Kinect con el mismo protocolo que usa libfreenect:
//  - comandos por transferencias de control (cabecera «GM», respuesta «RB»),
//  - escritura de registros para arrancar el flujo de profundidad (11 bits, 640×480, 30 fps),
//  - lectura isócrona del endpoint de profundidad y armado de cada cuadro a partir de los
//    paquetes (cabecera de 12 bytes: 'R','B', flag de inicio/medio/fin y número de secuencia).
//
// Sólo la cámara (product id 0x02AE / 0x02BF). El motor y el audio son otros dispositivos
// USB y no hacen falta para escanear.
//
// Requisitos: Chrome o Edge (WebUSB), página en https:// o localhost, el Kinect enchufado
// a su fuente de 12 V, y —en Windows— el driver WinUSB puesto con Zadig; en Linux, el módulo
// gspca_kinect descargado y una regla udev que dé permiso. Ver GUIAS abajo.

export const KINECT_VENDOR = 0x045e;
export const MODELOS = {
  0x02ae: 'Kinect para Xbox 360 (modelo 1414)',
  0x02bf: 'Kinect para Xbox 360 (modelo 1473) o Kinect for Windows v1'
};
export const FILTROS = Object.keys(MODELOS).map(pid => ({ vendorId: KINECT_VENDOR, productId: +pid }));

export const ANCHO = 640, ALTO = 480;
export const BYTES_CUADRO = ANCHO * ALTO * 11 / 8; // 422400

// ------------------------------------------------------------
// Entorno
// ------------------------------------------------------------

export function estadoWebUSB() {
  const seguro = typeof window !== 'undefined' && (window.isSecureContext || location.hostname === 'localhost');
  const disponible = typeof navigator !== 'undefined' && !!navigator.usb;
  let razon = null;
  if (!disponible) {
    const ua = navigator.userAgent || '';
    if (/Firefox/.test(ua)) razon = 'Firefox no tiene WebUSB. Abrí esta página en Chrome, Edge, Brave u Opera.';
    else if (/Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)) razon = 'Safari no tiene WebUSB. Abrí esta página en Chrome o Edge.';
    else if (/Android|iPhone|iPad/.test(ua)) razon = 'En celulares y tablets no se puede conectar el Kinect. Usá una computadora con Chrome o Edge.';
    else razon = 'Este navegador no tiene WebUSB. Usá Chrome o Edge en una computadora.';
  } else if (!seguro) {
    razon = 'WebUSB sólo funciona en páginas https:// (o en localhost). Abrí la versión publicada de la plataforma.';
  }
  return { disponible: disponible && seguro, razon };
}

export function sistemaOperativo() {
  const p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || '';
  const ua = navigator.userAgent || '';
  if (/CrOS/.test(ua)) return 'chromeos';
  if (/Win/i.test(p)) return 'windows';
  if (/Mac/i.test(p)) return 'mac';
  if (/Android/i.test(ua)) return 'android';
  if (/Linux/i.test(p) || /X11/.test(ua)) return 'linux';
  return 'otro';
}

// Traduce el error de WebUSB a qué le pasa a la persona y qué guía mostrarle.
// fase: 'pedir' | 'abrir' | 'reclamar' | 'comando' | 'flujo'
export function explicarError(err, fase) {
  const so = sistemaOperativo();
  const msg = String((err && err.message) || err || '');
  const nombre = (err && err.name) || '';
  if (fase === 'pedir' || nombre === 'NotFoundError') {
    return {
      titulo: 'No apareció ningún Kinect en la lista',
      detalle: 'Si el Kinect está enchufado y no figura, casi siempre es por la fuente de alimentación o por el driver. Revisá la guía de abajo para tu sistema.',
      guia: 'drivers'
    };
  }
  if (nombre === 'SecurityError') {
    return { titulo: 'El navegador bloqueó el acceso al USB', detalle: msg + ' — Fijate que la página esté en https:// y que no haya una política de la organización que bloquee WebUSB.', guia: 'navegador' };
  }
  if (fase === 'abrir' || /open|Access denied|LIBUSB_ERROR_ACCESS|permission/i.test(msg)) {
    if (so === 'windows') return { titulo: 'No se pudo abrir el Kinect', detalle: 'En Windows el navegador sólo puede usar el Kinect si tiene el driver WinUSB. Instalalo con Zadig como explica la guía (si tenés el SDK de Kinect instalado, hay que reemplazar su driver de la cámara).', guia: 'drivers' };
    if (so === 'linux') return { titulo: 'No hay permiso para abrir el Kinect', detalle: 'En Linux hace falta una regla udev que dé permiso al dispositivo, y descargar el módulo gspca_kinect que lo toma como cámara web. Los comandos están en la guía.', guia: 'drivers' };
    return { titulo: 'No se pudo abrir el Kinect', detalle: 'Cerrá cualquier otro programa que lo esté usando (Skanect, Processing, OpenNI…), desenchufalo y volvé a enchufarlo. Detalle técnico: ' + msg, guia: 'drivers' };
  }
  if (fase === 'reclamar' || /claim|interface/i.test(msg)) {
    if (so === 'linux') return { titulo: 'El sistema tiene tomado el Kinect', detalle: 'El módulo del kernel gspca_kinect lo está usando como cámara web. Descargalo (sudo modprobe -r gspca_kinect) y agregalo a la lista negra como muestra la guía.', guia: 'drivers' };
    if (so === 'windows') return { titulo: 'Otro driver tiene tomado el Kinect', detalle: 'Hay que ponerle el driver WinUSB a la «Xbox NUI Camera» con Zadig. Después desenchufá y volvé a enchufar el Kinect.', guia: 'drivers' };
    return { titulo: 'No se pudo reclamar la interfaz de la cámara', detalle: 'Cerrá otros programas que usen el Kinect y reintentá. Detalle técnico: ' + msg, guia: 'drivers' };
  }
  if (fase === 'comando') {
    return { titulo: 'El Kinect no responde a los comandos', detalle: 'Suele ser falta de alimentación: el Kinect necesita su fuente de 12 V enchufada, no alcanza con el USB. Desenchufá todo, conectá primero la fuente y después el USB, y reintentá. Detalle técnico: ' + msg, guia: 'fuente' };
  }
  if (fase === 'flujo') {
    const base = 'El Kinect responde a los comandos pero las lecturas del flujo de profundidad fallan. ';
    if (so === 'windows') return { titulo: 'No llega el flujo de profundidad', detalle: base + 'En Windows esto pasa cuando el driver no es WinUSB (en Zadig elegí WinUSB, no libusbK ni libusb-win32), en Windows 7 (que no soporta este tipo de transferencias) o con el Kinect enchufado a un hub. Probá un puerto USB 2.0 directo de la computadora, desenchufá y volvé a enchufar, y reintentá. Detalle técnico: ' + msg, guia: 'drivers' };
    if (so === 'linux') return { titulo: 'No llega el flujo de profundidad', detalle: base + 'Fijate que el módulo gspca_kinect esté descargado (lsmod | grep gspca) y probá un puerto USB 2.0 directo, sin hub. Detalle técnico: ' + msg, guia: 'drivers' };
    return { titulo: 'No llega el flujo de profundidad', detalle: base + 'Probá otro puerto USB (directo a la computadora, sin hub; mejor USB 2.0), un cable más corto, y desenchufar y volver a enchufar el Kinect. Detalle técnico: ' + msg, guia: null };
  }
  return { titulo: 'Error con el Kinect', detalle: msg, guia: null };
}

// ------------------------------------------------------------
// Guías de instalación de drivers, por sistema
// ------------------------------------------------------------

export const GUIAS = {
  windows: {
    nombre: 'Windows 10 / 11',
    pasos: [
      'Enchufá el Kinect con su <strong>fuente de 12 V</strong> (el adaptador con el cable en Y). Sin la fuente, Windows no lo detecta y no suena nada al conectarlo.',
      'Bajá <strong>Zadig</strong> desde <a href="https://zadig.akeo.ie" target="_blank" rel="noopener">zadig.akeo.ie</a> y abrilo (no se instala, es un solo archivo).',
      'En el menú <em>Options</em> marcá <em>List All Devices</em>.',
      'En la lista desplegable elegí <strong>Xbox NUI Camera</strong>. Si tenés instalado el SDK de Kinect puede figurar como <em>Kinect for Windows Camera</em> o <em>Kinect Camera</em>. No elijas «Xbox NUI Motor» ni «Xbox NUI Audio».',
      'A la derecha de la flecha verde elegí el driver <strong>WinUSB</strong> y hacé clic en <strong>Replace Driver</strong> (o <em>Install Driver</em>). Aceptá las advertencias; tarda un minuto.',
      'Desenchufá y volvé a enchufar el USB del Kinect, recargá esta página y apretá «Conectar Kinect».'
    ],
    nota: 'Zadig reemplaza sólo el driver de la cámara. Si más adelante querés volver a usar el SDK de Kinect, desde el Administrador de dispositivos desinstalá «Xbox NUI Camera» tildando «eliminar el software del controlador» y reconectalo.'
  },
  linux: {
    nombre: 'Linux (Ubuntu, Debian, Mint…)',
    pasos: [
      'Enchufá el Kinect con su fuente de 12 V.',
      'Abrí una terminal y descargá el módulo del kernel que lo toma como cámara web, dale permisos al dispositivo y recargá las reglas:',
      'Desenchufá y volvé a enchufar el USB del Kinect, recargá esta página y apretá «Conectar Kinect».',
      'Si usás el Chromium que viene como <em>snap</em> en Ubuntu, dale acceso al USB con <code>sudo snap connect chromium:raw-usb</code> (o usá Chrome descargado de Google).'
    ],
    comandos: `sudo modprobe -r gspca_kinect
echo "blacklist gspca_kinect" | sudo tee /etc/modprobe.d/blacklist-kinect.conf
sudo tee /etc/udev/rules.d/51-kinect.rules > /dev/null <<'EOF'
SUBSYSTEM=="usb", ATTR{idVendor}=="045e", ATTR{idProduct}=="02ae", MODE="0666"
SUBSYSTEM=="usb", ATTR{idVendor}=="045e", ATTR{idProduct}=="02bf", MODE="0666"
SUBSYSTEM=="usb", ATTR{idVendor}=="045e", ATTR{idProduct}=="02ad", MODE="0666"
SUBSYSTEM=="usb", ATTR{idVendor}=="045e", ATTR{idProduct}=="02b0", MODE="0666"
SUBSYSTEM=="usb", ATTR{idVendor}=="045e", ATTR{idProduct}=="02c2", MODE="0666"
EOF
sudo udevadm control --reload-rules && sudo udevadm trigger`,
    nota: 'No hace falta instalar libfreenect ni ningún otro paquete: el navegador habla con el Kinect directamente.'
  },
  mac: {
    nombre: 'macOS',
    pasos: [
      'Enchufá el Kinect con su fuente de 12 V.',
      'No hace falta instalar ningún driver: Chrome lo puede usar directamente.',
      'Cerrá cualquier programa que use el Kinect (Skanect, Processing, OpenNI, etc.).',
      'Apretá «Conectar Kinect» y elegilo en la lista. Si no aparece, probá otro puerto o un adaptador USB-A distinto.'
    ]
  },
  chromeos: {
    nombre: 'ChromeOS',
    pasos: [
      'Enchufá el Kinect con su fuente de 12 V a un puerto USB del Chromebook (con adaptador si hace falta).',
      'No hace falta instalar nada: apretá «Conectar Kinect» y elegilo en la lista.'
    ]
  }
};

// ------------------------------------------------------------
// El dispositivo
// ------------------------------------------------------------

const esperar = (ms) => new Promise(r => setTimeout(r, ms));

export class KinectV1 {
  constructor() {
    this.dispositivo = null;
    this.tag = 1;
    this.corriendo = false;
    this.epProfundidad = 2;
    this.tamPaquete = 1760;
    this.paquetesPorTransferencia = 16;
    this.transferenciasEnVuelo = 8;
    this.onCuadro = null;
    this.onError = null;
    this.crudo = new Uint8Array(BYTES_CUADRO);
    this.pos = 0;
    this.enCurso = false;
    this.seq = 0;
    this.estadisticas = { cuadros: 0, incompletos: 0, perdidos: 0, paquetes: 0, ultimoCuadro: 0 };
  }

  static soportado() { return estadoWebUSB().disponible; }

  // Kinects a los que la persona ya le dio permiso (para reconectar solos al recargar).
  static async autorizados() {
    if (!navigator.usb) return [];
    const lista = await navigator.usb.getDevices();
    return lista.filter(d => d.vendorId === KINECT_VENDOR && MODELOS[d.productId]);
  }

  // Abre el diálogo del navegador para elegir el Kinect (necesita un clic de la persona).
  static async pedirPermiso() {
    return navigator.usb.requestDevice({ filters: FILTROS });
  }

  get modelo() { return this.dispositivo ? (MODELOS[this.dispositivo.productId] || 'Kinect') : null; }

  async abrir(dispositivo) {
    this.dispositivo = dispositivo;
    try { await dispositivo.open(); }
    catch (e) { throw Object.assign(new Error(e.message), { fase: 'abrir', original: e }); }
    try {
      if (dispositivo.configuration === null) await dispositivo.selectConfiguration(1);
      // Buscar la interfaz y el ajuste alternativo que tenga el endpoint isócrono de profundidad (nº 2).
      let elegido = null;
      for (const itf of dispositivo.configuration.interfaces) {
        for (const alt of itf.alternates) {
          for (const ep of alt.endpoints) {
            if (ep.direction === 'in' && ep.type === 'isochronous' && ep.endpointNumber === 2 && ep.packetSize > 0) {
              if (!elegido || ep.packetSize > elegido.ep.packetSize) elegido = { itf, alt, ep };
            }
          }
        }
      }
      if (!elegido) {
        // sin descriptor a la vista: valores del Kinect 1414
        elegido = { itf: dispositivo.configuration.interfaces[0], alt: null, ep: { endpointNumber: 2, packetSize: 1760 } };
      }
      this.interfaz = elegido.itf.interfaceNumber;
      await dispositivo.claimInterface(this.interfaz);
      // Se selecciona el ajuste alternativo aunque sea el 0: en Windows, WinUSB recién
      // reserva el ancho de banda isócrono al hacerlo.
      this.alternativa = elegido.alt ? elegido.alt.alternateSetting : 0;
      try { await dispositivo.selectAlternateInterface(this.interfaz, this.alternativa); } catch (e) { /* algunos sistemas no lo permiten con el 0; seguimos */ }
      this.epProfundidad = elegido.ep.endpointNumber;
      this.tamPaquete = elegido.ep.packetSize;
      this.descripcion = `interfaz ${this.interfaz}, alt ${this.alternativa}, endpoint ${this.epProfundidad}, paquetes de ${this.tamPaquete} bytes`;
    } catch (e) {
      throw Object.assign(new Error(e.message), { fase: 'reclamar', original: e });
    }
  }

  // Comando de la cámara: cabecera {magic 'GM', largo en palabras, cmd, tag} + palabras de 16 bits.
  async _comando(cmd, palabras) {
    const dev = this.dispositivo;
    const buf = new ArrayBuffer(8 + palabras.length * 2);
    const dv = new DataView(buf);
    dv.setUint16(0, 0x4d47, true);
    dv.setUint16(2, palabras.length, true);
    dv.setUint16(4, cmd, true);
    dv.setUint16(6, this.tag, true);
    palabras.forEach((w, i) => dv.setUint16(8 + i * 2, w & 0xffff, true));
    const setup = { requestType: 'vendor', recipient: 'device', request: 0, value: 0, index: 0 };
    const salida = await dev.controlTransferOut(setup, buf);
    if (salida.status !== 'ok') throw new Error('El Kinect rechazó el comando (' + salida.status + ')');
    let resp = null;
    for (let intento = 0; intento < 60; intento++) {
      const r = await dev.controlTransferIn(setup, 0x200);
      if (r.status !== 'ok') throw new Error('Sin respuesta del Kinect (' + r.status + ')');
      if (r.data && r.data.byteLength > 0 && r.data.byteLength !== 0x200) { resp = r.data; break; }
      await esperar(2);
    }
    if (!resp) throw new Error('El Kinect no respondió al comando 0x' + cmd.toString(16));
    if (resp.byteLength < 8 || resp.getUint16(0, true) !== 0x4252) throw new Error('Respuesta inválida del Kinect');
    if (resp.getUint16(4, true) !== cmd) throw new Error('El Kinect respondió a otro comando');
    if (resp.getUint16(6, true) !== this.tag) throw new Error('Respuesta fuera de orden del Kinect');
    this.tag = (this.tag + 1) & 0xffff;
    const datos = [];
    for (let off = 8; off + 1 < resp.byteLength; off += 2) datos.push(resp.getUint16(off, true));
    return datos;
  }

  async _escribirRegistro(registro, valor) {
    const r = await this._comando(0x03, [registro, valor]);
    return r;
  }

  async _leerRegistro(registro) {
    const r = await this._comando(0x02, [registro]);
    return r.length > 1 ? r[1] : (r[0] ?? 0);
  }

  // Arranca el flujo de profundidad. onCuadro recibe { crudo: Uint16Array(307200), tiempo }.
  async iniciarProfundidad(onCuadro) {
    this.onCuadro = onCuadro;
    try {
      await this._escribirRegistro(0x105, 0x00); // sin ciclado automático del proyector
      await this._escribirRegistro(0x06, 0x00);  // reiniciar el flujo de profundidad
      await this._escribirRegistro(0x12, 0x03);  // formato: 11 bits empaquetados
      await this._escribirRegistro(0x13, 0x01);  // 640×480
      await this._escribirRegistro(0x14, 0x1e);  // 30 cuadros por segundo
      await this._escribirRegistro(0x16, 0x00);  // sin registro con la cámara color
    } catch (e) {
      throw Object.assign(new Error(e.message), { fase: 'comando', original: e });
    }
    this.corriendo = true;
    this.enCurso = false;
    this.erroresSeguidos = 0;
    this.estadisticas = { cuadros: 0, incompletos: 0, perdidos: 0, paquetes: 0, errores: 0, ultimoCuadro: 0 };
    // Las lecturas isócronas se encolan ANTES de dar la orden de arranque, como hace
    // libfreenect: así el primer cuadro ya tiene dónde caer. Un error de transferencia
    // suelto no corta nada (en Windows suelen aparecer algunos al arrancar): se reintenta,
    // se prueba con transferencias más chicas, y sólo si fallan muchas seguidas se avisa.
    const trabajador = async () => {
      while (this.corriendo) {
        const largos = new Array(this.paquetesPorTransferencia).fill(this.tamPaquete);
        let r;
        try { r = await this.dispositivo.isochronousTransferIn(this.epProfundidad, largos); }
        catch (e) {
          if (!this.corriendo) return;
          this.estadisticas.errores++;
          this.erroresSeguidos++;
          if (this.erroresSeguidos === 12) this.paquetesPorTransferencia = 8;
          if (this.erroresSeguidos === 24) this.paquetesPorTransferencia = 32;
          if (this.erroresSeguidos >= 60) {
            this.corriendo = false;
            if (this.onError) this.onError(Object.assign(new Error(e.message + ' (' + this.descripcion + ')'), { fase: 'flujo', original: e }));
            return;
          }
          await esperar(this.erroresSeguidos < 12 ? 20 : 80);
          continue;
        }
        this.erroresSeguidos = 0;
        if (this.corriendo) this._procesar(r);
      }
    };
    for (let i = 0; i < this.transferenciasEnVuelo; i++) trabajador();
    await esperar(30);
    try {
      await this._escribirRegistro(0x06, 0x02);  // arrancar
      await this._escribirRegistro(0x17, 0x00);  // sin espejar
    } catch (e) {
      this.corriendo = false;
      throw Object.assign(new Error(e.message), { fase: 'comando', original: e });
    }
  }

  _procesar(resultado) {
    const est = this.estadisticas;
    for (const pk of resultado.packets) {
      if (pk.status !== 'ok' || !pk.data || pk.data.byteLength < 12) continue;
      const dv = pk.data;
      est.paquetes++;
      if (dv.getUint8(0) !== 0x52 || dv.getUint8(1) !== 0x42) continue; // 'R','B'
      const tipo = dv.getUint8(3) & 0x0f; // 1 = inicio de cuadro, 2 = medio, 5 = fin
      const seq = dv.getUint8(5);
      const datos = new Uint8Array(dv.buffer, dv.byteOffset + 12, dv.byteLength - 12);
      if (tipo === 1) { this.pos = 0; this.enCurso = true; this.seq = seq; }
      else if (!this.enCurso) continue;
      else if (seq !== this.seq) { this.enCurso = false; est.perdidos++; continue; }
      if (this.pos + datos.length > this.crudo.length) { this.enCurso = false; est.incompletos++; continue; }
      this.crudo.set(datos, this.pos);
      this.pos += datos.length;
      this.seq = (seq + 1) & 0xff;
      if (tipo === 5) {
        this.enCurso = false;
        if (this.pos === BYTES_CUADRO) {
          est.cuadros++;
          est.ultimoCuadro = performance.now();
          if (this.onCuadro) this.onCuadro({ crudo11: this.crudo, tiempo: est.ultimoCuadro });
        } else {
          est.incompletos++;
        }
      }
    }
  }

  // Diagnóstico: prueba el flujo con distintas configuraciones y arma un informe de texto
  // para mandar cuando algo no anda. No usa las lecturas normales; hay que llamarlo con el
  // dispositivo recién abierto (abrir) y sin haber arrancado la profundidad.
  async diagnosticar(avisar = () => {}) {
    const dev = this.dispositivo;
    const L = [];
    const ua = navigator.userAgent;
    L.push('Informe de diagnóstico del Kinect — ' + new Date().toISOString());
    L.push('Sistema: ' + sistemaOperativo() + ' · ' + ua);
    L.push('Dispositivo: ' + dev.manufacturerName + ' / ' + dev.productName + ' · vid 0x' + dev.vendorId.toString(16) + ' pid 0x' + dev.productId.toString(16) + ' · USB ' + dev.usbVersionMajor + '.' + dev.usbVersionMinor + ' · versión ' + dev.deviceVersionMajor + '.' + dev.deviceVersionMinor);
    L.push('Configuraciones: ' + dev.configurations.length + ' · activa: ' + (dev.configuration ? dev.configuration.configurationValue : 'ninguna'));
    for (const cfg of dev.configurations) for (const itf of cfg.interfaces) for (const alt of itf.alternates) {
      L.push(`  cfg ${cfg.configurationValue} · interfaz ${itf.interfaceNumber} (${itf.claimed ? 'reclamada' : 'libre'}) · alt ${alt.alternateSetting} · clase ${alt.interfaceClass}/${alt.interfaceSubclass}/${alt.interfaceProtocol}`);
      for (const ep of alt.endpoints) L.push(`     endpoint ${ep.endpointNumber} ${ep.direction} ${ep.type} · ${ep.packetSize} bytes`);
    }
    L.push('Elegido: ' + this.descripcion);
    // control
    try { const v = await this._leerRegistro(0x0000); L.push('Comando de lectura de registro: OK (valor ' + v + ')'); }
    catch (e) { L.push('Comando de lectura de registro: FALLÓ · ' + e.message); }
    const probar = async (etiqueta, ep, n, tam) => {
      const largos = new Array(n).fill(tam);
      let ok = 0, err = '', bytes = 0, estados = {};
      for (let i = 0; i < 6; i++) {
        try {
          const r = await dev.isochronousTransferIn(ep, largos);
          ok++;
          for (const pk of r.packets) { bytes += pk.data ? pk.data.byteLength : 0; estados[pk.status] = (estados[pk.status] || 0) + 1; }
        } catch (e) { err = e.name + ': ' + e.message; await esperar(15); }
      }
      L.push(`  ${etiqueta}: ep ${ep} × ${n} paquetes de ${tam} → ${ok}/6 lecturas OK, ${bytes} bytes, estados ${JSON.stringify(estados)}${err ? ' · último error: ' + err : ''}`);
      return ok;
    };
    avisar('Probando lecturas antes de arrancar el flujo…');
    L.push('Lecturas con el flujo detenido:');
    for (const n of [8, 16, 1]) await probar('detenido', this.epProfundidad, n, this.tamPaquete);
    // reseleccionar alt y volver a probar
    try { await dev.selectAlternateInterface(this.interfaz, this.alternativa); L.push('selectAlternateInterface(' + this.interfaz + ', ' + this.alternativa + '): OK'); }
    catch (e) { L.push('selectAlternateInterface: FALLÓ · ' + e.message); }
    avisar('Arrancando el flujo de profundidad…');
    try {
      await this._escribirRegistro(0x105, 0x00); await this._escribirRegistro(0x06, 0x00);
      await this._escribirRegistro(0x12, 0x03); await this._escribirRegistro(0x13, 0x01); await this._escribirRegistro(0x14, 0x1e);
      await this._escribirRegistro(0x16, 0x00); await this._escribirRegistro(0x06, 0x02); await this._escribirRegistro(0x17, 0x00);
      L.push('Arranque del flujo: comandos OK');
    } catch (e) { L.push('Arranque del flujo: FALLÓ · ' + e.message); }
    await esperar(200);
    L.push('Lecturas con el flujo andando:');
    let total = 0;
    for (const n of [8, 16, 32, 64, 1]) total += await probar('andando', this.epProfundidad, n, this.tamPaquete);
    // paquetes más chicos que el máximo y el otro endpoint (video), por si el problema es el tamaño
    total += await probar('andando, paquete de 1024', this.epProfundidad, 8, 1024);
    total += await probar('andando, endpoint de video', 1, 8, 1920);
    try { await this._escribirRegistro(0x06, 0x00); } catch (e) { /* nada */ }
    L.push(total ? 'RESULTADO: alguna configuración lee datos.' : 'RESULTADO: ninguna configuración de lectura isócrona funciona en este sistema/navegador.');
    return L.join('\n');
  }

  async detener() {
    if (!this.corriendo) return;
    this.corriendo = false;
    await esperar(50);
    try { await this._escribirRegistro(0x06, 0x00); } catch (e) { /* ya estaba cortado */ }
  }

  async cerrar() {
    await this.detener();
    const dev = this.dispositivo;
    this.dispositivo = null;
    if (!dev) return;
    try { await dev.releaseInterface(this.interfaz); } catch (e) { /* nada */ }
    try { await dev.close(); } catch (e) { /* nada */ }
  }
}
