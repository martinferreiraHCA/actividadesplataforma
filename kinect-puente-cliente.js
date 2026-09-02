// Cliente del puente local (kinect-puente.py): los cuadros del Kinect llegan por WebSocket desde
// un programa en Python que lee el sensor con libusb en esta misma computadora. Mismo contrato
// que KinectV1: iniciarProfundidad(onCuadro) entrega { crudo11: Uint8Array(422400), tiempo }.

export class PuenteKinect {
  constructor(url = 'ws://127.0.0.1:9876') {
    this.url = url; this.ws = null; this.corriendo = false;
    this.modelo = 'Kinect por el puente local';
    this.estadisticas = { cuadros: 0, incompletos: 0, perdidos: 0, errores: 0 };
    this.descripcion = url;
    this.onError = null;
  }
  iniciarProfundidad(onCuadro) {
    return new Promise((resolver, rechazar) => {
      let abierto = false;
      let ws;
      try { ws = new WebSocket(this.url); } catch (e) { rechazar(Object.assign(new Error(e.message), { fase: 'puente' })); return; }
      ws.binaryType = 'arraybuffer';
      this.ws = ws;
      ws.onopen = () => { abierto = true; this.corriendo = true; resolver(); };
      ws.onmessage = (ev) => {
        if (typeof ev.data === 'string') {
          try { const est = JSON.parse(ev.data); if (est.modelo) this.modelo = est.modelo + ' (puente local)'; } catch (e) { /* nada */ }
          return;
        }
        const bytes = new Uint8Array(ev.data);
        if (bytes.length !== 422400) { this.estadisticas.incompletos++; return; }
        this.estadisticas.cuadros++;
        onCuadro({ crudo11: bytes, tiempo: performance.now() });
      };
      ws.onerror = () => { if (!abierto) rechazar(Object.assign(new Error('no responde nadie en ' + this.url), { fase: 'puente' })); };
      ws.onclose = () => {
        if (!abierto) { rechazar(Object.assign(new Error('no responde nadie en ' + this.url), { fase: 'puente' })); return; }
        if (this.corriendo) { this.corriendo = false; if (this.onError) this.onError(Object.assign(new Error('se cerró la conexión con el puente'), { fase: 'puente' })); }
      };
    });
  }
  async detener() { this.corriendo = false; }
  async cerrar() { this.corriendo = false; if (this.ws) { try { this.ws.close(); } catch (e) { /* nada */ } this.ws = null; } }
}
