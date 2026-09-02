#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Puente local para el Kinect v1 (Xbox 360) → página «Escaneo 3D con Kinect».

Lee la cámara de profundidad del Kinect con libusb (con el mismo driver WinUSB que
instala Zadig en Windows; en Linux y macOS no hace falta driver) y le manda los cuadros
a la página del navegador por un WebSocket en localhost. Sirve cuando el navegador no
puede hacer las transferencias isócronas por su cuenta (Chrome en Windows).

Instalación (una sola vez):
    1. Python 3.8 o más nuevo, de python.org (en Windows, tildá «Add python.exe to PATH»).
    2. En una terminal:   pip install libusb websockets
Uso:
    python kinect-puente.py
    (con el Kinect enchufado a su fuente de 12 V; dejá la ventana abierta y en la página
     apretá «Conectar por el puente local»).
Opciones:
    --puerto 9876   puerto del WebSocket (el de la página)
    --fps 15        cuadros por segundo que se mandan al navegador
    --demo          sin Kinect: manda un cuadro sintético, para probar la conexión
    --detalle       muestra estadísticas del flujo USB cada segundo

Protocolo con la página: al conectarse se manda un texto JSON con el estado; después,
cada cuadro es un mensaje binario de 422400 bytes (640×480 píxeles de 11 bits
empaquetados, tal como salen del sensor). La página los desempaqueta.
"""

import argparse
import asyncio
import ctypes
import json
import math
import struct
import sys
import threading
import time

ANCHO, ALTO = 640, 480
BYTES_CUADRO = ANCHO * ALTO * 11 // 8  # 422400
VENDOR = 0x045E
MODELOS = {0x02AE: "Kinect para Xbox 360 (modelo 1414)", 0x02BF: "Kinect para Xbox 360 (1473) / Kinect for Windows v1"}
EP_PROFUNDIDAD = 0x82
TAM_PAQUETE = 1920
PAQUETES_POR_TRANSFERENCIA = 16
TRANSFERENCIAS = 16


class ErrorKinect(Exception):
    pass


# ------------------------------------------------------------
# El Kinect por libusb
# ------------------------------------------------------------

class Kinect:
    def __init__(self, detalle=False):
        import libusb as usb  # pip install libusb
        self.usb = usb
        self.detalle = detalle
        self.ctx = ctypes.POINTER(usb.context)()
        if usb.init(ctypes.byref(self.ctx)) != 0:
            raise ErrorKinect("no se pudo iniciar libusb")
        self.h = None
        self.tag = 1
        self.corriendo = False
        self.crudo = bytearray(BYTES_CUADRO)
        self.pos = 0
        self.en_curso = False
        self.seq = 0
        self.cuadro_listo = None       # bytes del último cuadro completo
        self.n_cuadro = 0
        self.stats = {"cuadros": 0, "incompletos": 0, "perdidos": 0, "paquetes": 0, "errores": 0}
        self._transfers = []
        self._buffers = []
        self._cb = None
        self._hilo = None
        self.modelo = None

    # --- apertura ---
    def abrir(self):
        usb = self.usb
        for pid, nombre in MODELOS.items():
            h = usb.open_device_with_vid_pid(self.ctx, VENDOR, pid)
            if h:
                self.h = h
                self.modelo = nombre
                break
        if not self.h:
            raise ErrorKinect("no encontré ningún Kinect. ¿Está enchufado con su fuente de 12 V? "
                              "En Windows tiene que tener el driver WinUSB (Zadig); en Linux, permisos udev y gspca_kinect descargado.")
        try:
            usb.set_auto_detach_kernel_driver(self.h, 1)
        except Exception:
            pass
        r = usb.claim_interface(self.h, 0)
        if r != 0:
            raise ErrorKinect("no pude reclamar la interfaz de la cámara (%s). ¿Otro programa usa el Kinect? "
                              "En Linux: sudo modprobe -r gspca_kinect" % self._err(r))
        usb.set_interface_alt_setting(self.h, 0, 0)
        try:
            usb.clear_halt(self.h, EP_PROFUNDIDAD)
        except Exception:
            pass
        print("Kinect abierto:", self.modelo)

    def _err(self, r):
        try:
            return self.usb.error_name(r).decode() if isinstance(self.usb.error_name(r), bytes) else str(self.usb.error_name(r))
        except Exception:
            return str(r)

    # --- comandos de control (protocolo de libfreenect) ---
    def _comando(self, cmd, palabras):
        usb = self.usb
        cuerpo = struct.pack("<HHHH", 0x4D47, len(palabras), cmd, self.tag) + b"".join(struct.pack("<H", w) for w in palabras)
        buf = (ctypes.c_ubyte * len(cuerpo)).from_buffer_copy(cuerpo)
        r = usb.control_transfer(self.h, 0x40, 0, 0, 0, buf, len(cuerpo), 1000)
        if r < 0:
            raise ErrorKinect("el Kinect rechazó un comando (%s). ¿Tiene la fuente de 12 V conectada?" % self._err(r))
        resp = (ctypes.c_ubyte * 0x200)()
        datos = None
        for _ in range(60):
            n = usb.control_transfer(self.h, 0xC0, 0, 0, 0, resp, 0x200, 1000)
            if n < 0:
                raise ErrorKinect("sin respuesta del Kinect (%s)" % self._err(n))
            if 0 < n != 0x200:
                datos = bytes(resp[:n])
                break
            time.sleep(0.002)
        if datos is None or len(datos) < 8:
            raise ErrorKinect("el Kinect no respondió al comando 0x%02x" % cmd)
        magic, largo, rcmd, rtag = struct.unpack("<HHHH", datos[:8])
        if magic != 0x4252 or rcmd != cmd or rtag != self.tag:
            raise ErrorKinect("respuesta inválida del Kinect")
        self.tag = (self.tag + 1) & 0xFFFF
        return [struct.unpack("<H", datos[i:i + 2])[0] for i in range(8, len(datos) - 1, 2)]

    def _registro(self, reg, valor):
        return self._comando(0x03, [reg, valor])

    # --- flujo de profundidad ---
    def iniciar(self):
        usb = self.usb
        self.corriendo = True
        self._cb = usb.transfer_cb_fn(self._callback)
        for _ in range(TRANSFERENCIAS):
            largo = PAQUETES_POR_TRANSFERENCIA * TAM_PAQUETE
            buf = (ctypes.c_ubyte * largo)()
            t = usb.alloc_transfer(PAQUETES_POR_TRANSFERENCIA)
            usb.fill_iso_transfer(t, self.h, EP_PROFUNDIDAD, buf, largo, PAQUETES_POR_TRANSFERENCIA, self._cb, None, 0)
            # largo de cada paquete (set_iso_packet_lengths del paquete de Python no llega al arreglo)
            descs = ctypes.cast(ctypes.addressof(t.contents.iso_packet_desc), ctypes.POINTER(usb.iso_packet_descriptor))
            for i in range(PAQUETES_POR_TRANSFERENCIA):
                descs[i].length = TAM_PAQUETE
            r = usb.submit_transfer(t)
            if r != 0:
                raise ErrorKinect("no pude encolar la lectura isócrona (%s). En Windows hace falta el driver WinUSB y Windows 8.1 o más nuevo." % self._err(r))
            self._transfers.append(t)
            self._buffers.append(buf)
        self._hilo = threading.Thread(target=self._bucle_eventos, daemon=True)
        self._hilo.start()
        time.sleep(0.05)
        self._registro(0x105, 0x00)  # sin ciclado del proyector
        self._registro(0x06, 0x00)   # reiniciar
        self._registro(0x12, 0x03)   # 11 bits empaquetados
        self._registro(0x13, 0x01)   # 640×480
        self._registro(0x14, 0x1E)   # 30 fps
        self._registro(0x16, 0x00)
        self._registro(0x06, 0x02)   # arrancar
        self._registro(0x17, 0x00)
        print("Flujo de profundidad arrancado.")

    def _bucle_eventos(self):
        usb = self.usb
        tv = usb.timeval(0, 100000)
        while self.corriendo:
            usb.handle_events_timeout_completed(self.ctx, ctypes.byref(tv), None)

    def _callback(self, transfer_p):
        usb = self.usb
        t = transfer_p.contents
        if not self.corriendo:
            return
        if t.status == usb.LIBUSB_TRANSFER_COMPLETED:
            descs = ctypes.cast(ctypes.addressof(t.iso_packet_desc), ctypes.POINTER(usb.iso_packet_descriptor))
            base = ctypes.cast(t.buffer, ctypes.POINTER(ctypes.c_ubyte))
            off = 0
            for i in range(t.num_iso_packets):
                d = descs[i]
                if d.status == usb.LIBUSB_TRANSFER_COMPLETED and d.actual_length >= 12:
                    self._paquete(ctypes.string_at(ctypes.addressof(base.contents) + off, d.actual_length))
                off += d.length
        else:
            self.stats["errores"] += 1
        if self.corriendo:
            usb.submit_transfer(transfer_p)

    def _paquete(self, p):
        self.stats["paquetes"] += 1
        if p[0] != 0x52 or p[1] != 0x42:  # 'R','B'
            return
        tipo = p[3] & 0x0F
        seq = p[5]
        datos = p[12:]
        if tipo == 1:
            self.pos = 0
            self.en_curso = True
            self.seq = seq
        elif not self.en_curso:
            return
        elif seq != self.seq:
            self.en_curso = False
            self.stats["perdidos"] += 1
            return
        if self.pos + len(datos) > BYTES_CUADRO:
            self.en_curso = False
            self.stats["incompletos"] += 1
            return
        self.crudo[self.pos:self.pos + len(datos)] = datos
        self.pos += len(datos)
        self.seq = (seq + 1) & 0xFF
        if tipo == 5:
            self.en_curso = False
            if self.pos == BYTES_CUADRO:
                self.cuadro_listo = bytes(self.crudo)
                self.n_cuadro += 1
                self.stats["cuadros"] += 1
            else:
                self.stats["incompletos"] += 1

    def cerrar(self):
        usb = self.usb
        self.corriendo = False
        try:
            if self.h:
                self._registro(0x06, 0x00)
        except Exception:
            pass
        for t in self._transfers:
            try:
                usb.cancel_transfer(t)
            except Exception:
                pass
        if self._hilo:
            self._hilo.join(timeout=1)
        if self.h:
            try:
                usb.release_interface(self.h, 0)
            except Exception:
                pass
            usb.close(self.h)
        usb.exit(self.ctx)


# ------------------------------------------------------------
# Fuente de demostración (sin Kinect)
# ------------------------------------------------------------

class Demo:
    """Manda un plano inclinado con una «pieza» encima, en el mismo formato del sensor."""
    modelo = "Cuadro de demostración del puente (sin Kinect)"
    stats = {"cuadros": 0, "incompletos": 0, "perdidos": 0, "paquetes": 0, "errores": 0}

    def __init__(self):
        self.n_cuadro = 0
        self.cuadro_listo = None
        self._base = self._armar()

    @staticmethod
    def _mm_a_crudo(mm):
        if mm <= 0:
            return 2047
        return max(0, min(2047, int(round((3.3309495161 - 1000.0 / mm) / 0.0030711016))))

    def _armar(self):
        valores = []
        for v in range(ALTO):
            for u in range(ANCHO):
                mm = 700 + (ALTO - v) * 1.2  # mesa inclinada
                if abs(u - 320) < 60 and abs(v - 300) < 50:
                    mm = 780 - (50 - abs(v - 300)) * 0.5  # una caja en el medio
                valores.append(self._mm_a_crudo(mm))
        # empaquetar a 11 bits, big-endian
        salida = bytearray()
        acum, bits = 0, 0
        for x in valores:
            acum = (acum << 11) | x
            bits += 11
            while bits >= 8:
                bits -= 8
                salida.append((acum >> bits) & 0xFF)
            acum &= (1 << bits) - 1
        return bytes(salida)

    def abrir(self):
        print("Modo demostración: sin Kinect.")

    def iniciar(self):
        pass

    def tic(self):
        self.cuadro_listo = self._base
        self.n_cuadro += 1
        self.stats["cuadros"] += 1

    def cerrar(self):
        pass


# ------------------------------------------------------------
# Servidor WebSocket
# ------------------------------------------------------------

async def servir(fuente, puerto, fps, detalle):
    import websockets  # pip install websockets
    clientes = set()

    async def cliente(ws):
        clientes.add(ws)
        try:
            await ws.send(json.dumps({"tipo": "estado", "modelo": fuente.modelo, "ancho": ANCHO, "alto": ALTO, "formato": "11bits"}))
            async for _ in ws:
                pass
        finally:
            clientes.discard(ws)

    async def emitir():
        ultimo = -1
        periodo = 1.0 / max(1, fps)
        t_stats = time.time()
        while True:
            if isinstance(fuente, Demo):
                fuente.tic()
            if fuente.cuadro_listo is not None and fuente.n_cuadro != ultimo and clientes:
                ultimo = fuente.n_cuadro
                datos = fuente.cuadro_listo
                for ws in list(clientes):
                    try:
                        await ws.send(datos)
                    except Exception:
                        clientes.discard(ws)
            if detalle and time.time() - t_stats > 1:
                t_stats = time.time()
                print("estado:", fuente.stats, "clientes:", len(clientes))
            await asyncio.sleep(periodo)

    async with websockets.serve(cliente, "127.0.0.1", puerto, max_size=None):
        print("Puente listo en ws://127.0.0.1:%d — en la página apretá «Conectar por el puente local». Ctrl+C para cerrar." % puerto)
        await emitir()


def main():
    ap = argparse.ArgumentParser(description="Puente local Kinect v1 → navegador")
    ap.add_argument("--puerto", type=int, default=9876)
    ap.add_argument("--fps", type=int, default=15)
    ap.add_argument("--demo", action="store_true")
    ap.add_argument("--detalle", action="store_true")
    a = ap.parse_args()
    fuente = Demo() if a.demo else None
    if fuente is None:
        try:
            fuente = Kinect(detalle=a.detalle)
        except ImportError:
            print("Falta la librería libusb. Instalala con:  pip install libusb websockets")
            sys.exit(1)
    try:
        fuente.abrir()
        fuente.iniciar()
    except ErrorKinect as e:
        print("ERROR:", e)
        sys.exit(2)
    try:
        asyncio.run(servir(fuente, a.puerto, a.fps, a.detalle))
    except KeyboardInterrupt:
        pass
    finally:
        fuente.cerrar()
        print("Puente cerrado.")


if __name__ == "__main__":
    main()
