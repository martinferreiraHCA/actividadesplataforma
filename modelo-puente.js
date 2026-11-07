// Puente entre páginas: una página deja un modelo 3D (triángulos) en IndexedDB
// y otra lo levanta al abrirse. Lo usan «Adornos de Navidad» (deja el adorno
// macizo) y «Moldes para colar» (lo recibe para hacerle el molde).

const DB = 'generador-modelos', ALMACEN = 'modelos', CLAVE = 'pendiente';

function abrir() {
  return new Promise((resolver, rechazar) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(ALMACEN);
    req.onsuccess = () => resolver(req.result);
    req.onerror = () => rechazar(req.error);
  });
}

// tris: Float32Array (9 números por triángulo, mm, Z hacia arriba)
export async function dejarModelo(tris, nombre, meta) {
  const db = await abrir();
  await new Promise((resolver, rechazar) => {
    const tx = db.transaction(ALMACEN, 'readwrite');
    tx.objectStore(ALMACEN).put({ tris, nombre, meta: meta || {}, fecha: Date.now() }, CLAVE);
    tx.oncomplete = resolver;
    tx.onerror = () => rechazar(tx.error);
  });
  db.close();
}

export async function tomarModelo() {
  const db = await abrir();
  const dato = await new Promise((resolver, rechazar) => {
    const tx = db.transaction(ALMACEN, 'readwrite');
    const almacen = tx.objectStore(ALMACEN);
    const req = almacen.get(CLAVE);
    req.onsuccess = () => { almacen.delete(CLAVE); resolver(req.result || null); };
    req.onerror = () => rechazar(req.error);
  });
  db.close();
  return dato;
}
