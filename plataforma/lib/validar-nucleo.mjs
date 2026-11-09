// Núcleo de validación: ejecuta los scripts clásicos de vicaria/ (parroquia.js, tipos.js, comun.js)
// dentro de un `vm`, con el mismo esquema que pruebas/vicaria/cargar.js, para reutilizar
// `validarConfig` sin duplicarla. Es JS plano (ESM) para que un script .mjs también pueda importarlo.
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ_VICARIA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'vicaria');
// Orden de las páginas: parroquia.js, tipos.js, comun.js (CLAVES_TEXTOS necesita comun.js).
const ARCHIVOS = ['parroquia.js', 'tipos.js', 'comun.js'];

let fuentes = null;
function leerFuentes() {
  if (fuentes === null) {
    fuentes = ARCHIVOS.map((a) => fs.readFileSync(path.join(RAIZ_VICARIA, a), 'utf8'));
  }
  return fuentes;
}

/** Crea un contexto `vm` nuevo, con la página simulada en /<slug>/pantalla.html. */
function crearContexto(slug) {
  const datos = {};
  const localStorage = {
    getItem: (k) => (k in datos ? datos[k] : null),
    setItem: (k, v) => { datos[k] = String(v); },
    removeItem: (k) => { delete datos[k]; },
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
    getElementById: () => null,
  };
  const ventana = { innerWidth: 1920, innerHeight: 1080, addEventListener() {} };
  ventana.parent = ventana; // sin iframe: el modo vista previa (futuro) queda apagado en el servidor
  const contexto = vm.createContext({
    localStorage, BroadcastChannel, document: documento, window: ventana,
    location: { pathname: '/' + slug + '/pantalla.html', search: '' },
    setInterval: () => 0, clearInterval() {}, setTimeout: () => 0, clearTimeout() {},
    console: { log() {}, info() {}, warn() {}, error() {} },
  });

  const nombres = [];
  for (const f of leerFuentes()) {
    for (const m of f.matchAll(/^(?:const|let|var|function)\s+(\w+)/gm)) nombres.push(m[1]);
  }
  const exportar = nombres.map((n) => `this.${n} = ${n};`).join('\n');
  vm.runInContext(leerFuentes().join('\n') + '\n' + exportar, contexto, { filename: ARCHIVOS.join('+') });
  return contexto;
}

// Un contexto por slug: validarConfig no guarda estado entre llamadas y el SLUG de cada
// contexto es fijo, así que no hay filtración entre parroquias.
const contextos = new Map();
function contextoDe(slug) {
  let c = contextos.get(slug);
  if (!c) {
    if (contextos.size >= 50) contextos.clear(); // los slugs vienen de usuarios: acota la memoria
    c = crearContexto(slug);
    contextos.set(slug, c);
  }
  return c;
}

/** Valida una configuración completa con la misma función que usan las pantallas. */
export function validarConfig(config, slug) {
  const r = contextoDe(slug).validarConfig(config);
  return { ok: r.ok === true, errores: Array.from(r.errores, String) };
}

/** Valida un borrador completándolo con los campos que pone la publicación. */
export function validarBorrador(borrador, slug) {
  const base = borrador !== null && typeof borrador === 'object' && !Array.isArray(borrador) ? borrador : {};
  return validarConfig(
    { ...base, esquema: 1, version: 1, publicado: new Date().toISOString(), slug },
    slug,
  );
}

/** Razón de contraste WCAG entre dos colores #rrggbb, con la función de parroquia.js. */
export function contraste(hexA, hexB) {
  return contextoDe('contraste').contraste(hexA, hexB);
}
