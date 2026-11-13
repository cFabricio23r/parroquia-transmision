/* Carga archivos de vicaria/ en un contexto `vm` con localStorage, BroadcastChannel, document y window falsos.
   Los archivos de vicaria/ son scripts clásicos: sus `const`/`function` de nivel superior no quedan como
   propiedades del contexto, así que se copian al contexto para poder leerlos desde las pruebas. */
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..', '..', 'vicaria');

/* cargar(['tipos.js', 'comun.js'], almacen) -> contexto con los globales de esos archivos.
   `almacen` es el contenido inicial de localStorage ({ clave: texto }); lo guardado después se lee
   en contexto.__almacen.
   `extras` (opcional) es un objeto cuyas propiedades se agregan al contexto (location, fetch, Date…);
   si trae `Date`, reemplaza al del contexto. */
function cargar(archivos, almacen = {}, extras = {}) {
  const datos = Object.assign({}, almacen);
  const localStorage = {
    getItem: (k) => (k in datos ? datos[k] : null),
    setItem: (k, v) => { datos[k] = String(v); },
    removeItem: (k) => { delete datos[k]; }
  };
  class BroadcastChannel {
    constructor(nombre) { this.nombre = nombre; this.onmessage = null; }
    postMessage() {}
    close() {}
  }
  const documento = {
    addEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null
  };
  const ventana = { innerWidth: 1920, innerHeight: 1080, addEventListener() {} };
  const contexto = vm.createContext({
    localStorage, BroadcastChannel, document: documento, window: ventana,
    setInterval: () => 0, clearInterval() {}, setTimeout: () => 0, clearTimeout() {},
    console
  });
  Object.assign(contexto, extras);
  contexto.__almacen = datos;

  const fuentes = archivos.map((a) => fs.readFileSync(path.join(RAIZ, a), 'utf8'));
  // Nombres de nivel superior (const/let/var/function) declarados en los archivos.
  const nombres = [];
  for (const f of fuentes) {
    for (const m of f.matchAll(/^(?:const|let|var|function)\s+(\w+)/gm)) nombres.push(m[1]);
  }
  // Un solo script (como <script> seguidos) + copia de esos nombres al objeto global del contexto.
  const exportar = nombres.map((n) => `this.${n} = ${n};`).join('\n');
  vm.runInContext(fuentes.join('\n') + '\n' + exportar, contexto, { filename: archivos.join('+') });
  return contexto;
}

module.exports = { cargar };
