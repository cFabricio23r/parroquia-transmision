// Puente de las misas listas entre la app y su panel (Tarea 6). El panel guarda la lista y la cola
// en su localStorage, con las mismas claves que en la PC (claveDe de vicaria/parroquia.js, decisión R4):
//   - scriptGuardadas(slug) las lee cada 300 ms y, si cambiaron, manda {tipo:'guardadas', lista, pendientes};
//   - scriptPonerGuardadas(slug, nube, cambios) le devuelve lo que pasó en la nube.
// El panel nunca recibe tokens, la sesión ni otra clave que estas dos: lo nativo sube y baja.
import { esSlugValido } from '../plataforma/direcciones';
import type { FilaGuardada, Guardada, PendienteGuardada } from './nucleo';

export type MensajeGuardadas = { tipo: 'guardadas'; lista: Guardada[]; pendientes: PendienteGuardada[] };

/** Lo que pasó con los pendientes que se mandaron: cada uno con el `cuando` que se subió. */
export type CambiosPendientes = { hechos: PendienteGuardada[]; rechazados: PendienteGuardada[] };

function validar(slug: string): void {
  // Igual que claveEstado: en un script nunca entra un texto armado con otra cosa.
  if (!esSlugValido(slug)) throw new Error('slug inválido');
}

/** La lista de misas listas del panel de esa parroquia. Lanza si el slug no es válido. */
export function claveGuardadas(slug: string): string {
  validar(slug);
  return 'pev_' + slug + '_guardadas_v1';
}

/** La cola de cambios pendientes del panel de esa parroquia. Lanza si el slug no es válido. */
export function claveGuardadasPendientes(slug: string): string {
  validar(slug);
  return 'pev_' + slug + '_guardadas_pendientes_v1';
}

/** Un valor como literal de JS: JSON, sin los separadores de línea que algunos motores no aceptan. */
function literal(v: unknown): string {
  return JSON.stringify(v).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/**
 * Cada 300 ms, si la lista o la cola cambiaron, las manda a la app como {tipo:'guardadas', lista,
 * pendientes}. Lo ilegible va como []. Lo corre lo nativo al terminar de cargar la página, junto a scriptPanel.
 */
export function scriptGuardadas(slug: string): string {
  const cl = claveGuardadas(slug);
  const cp = claveGuardadasPendientes(slug);
  return `(function () {
  var ultimo = null;
  function leer(c) {
    var t = null;
    try { t = window.localStorage.getItem(c); } catch (e) { t = null; }
    return typeof t === 'string' ? t : null;
  }
  function lista(t) {
    if (t === null) return [];
    try { var v = JSON.parse(t); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function revisar() {
    var g = leer('${cl}');
    var p = leer('${cp}');
    var firma = JSON.stringify([g, p]);
    if (firma === ultimo) return;
    ultimo = firma;
    try { window.ReactNativeWebView.postMessage(JSON.stringify({ tipo: 'guardadas', lista: lista(g), pendientes: lista(p) })); } catch (e) {}
  }
  revisar();
  setInterval(revisar, 300);
})();
true;`;
}

/**
 * Le devuelve al panel lo que pasó en la nube, sin pisar lo que el panel hizo mientras tanto:
 *   - relee la cola actual y saca solo lo confirmado (`hechos`), cada uno hasta el `cuando` que se
 *     subió; marca `rechazado` lo rechazado; todo lo demás queda (también las marcas viejas);
 *   - si vino la nube (`nube` no es null) y el panel tiene GUARDADAS, fusiona la lista actual del panel
 *     con la nube y la cola nueva (GUARDADAS.fusionar), conserva las entradas rotas y repinta.
 * Una lista o una cola ilegibles no se pisan. Mismas reglas que vicaria/guardadas-sync.js.
 */
export function scriptPonerGuardadas(slug: string, nube: readonly FilaGuardada[] | null, cambios: CambiosPendientes): string {
  const cl = claveGuardadas(slug);
  const cp = claveGuardadasPendientes(slug);
  // actualizado_por (el usuario) no le hace falta al panel.
  const filas = nube === null ? null : nube.map(({ actualizado_por: _p, ...f }) => f);
  const solo = (ps: readonly PendienteGuardada[]) => ps.map((p) => ({ op: p.op, id: p.id, cuando: p.cuando }));
  return `(function () {
  var nube = ${literal(filas)};
  var hechos = ${literal(solo(cambios.hechos))};
  var rechazados = ${literal(solo(cambios.rechazados))};
  var ls = window.localStorage;
  function esObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function igual(a, b) { return a.op === b.op && a.id === b.id; }
  function hecho(x) { return esObj(x) && hechos.some(function (h) { return igual(x, h) && x.cuando <= h.cuando; }); }
  function viejo(x) { return esObj(x) && rechazados.some(function (r) { return igual(x, r) && x.cuando < r.cuando; }); }
  function rechazar(x) { return esObj(x) && rechazados.some(function (r) { return igual(x, r) && x.cuando === r.cuando; }); }
  function leer(c) { try { return { ok: true, t: ls.getItem(c) }; } catch (e) { return { ok: false }; } }

  var p = leer('${cp}');
  if (!p.ok) return;
  var cola = null;
  try { cola = JSON.parse(p.t || '[]'); } catch (e) { cola = null; }
  if (!Array.isArray(cola)) return;
  var nueva = cola.filter(function (x) { return !hecho(x) && !viejo(x); })
    .map(function (x) { return rechazar(x) && !x.rechazado ? Object.assign({}, x, { rechazado: true }) : x; });
  var texto = JSON.stringify(nueva);
  if (texto !== JSON.stringify(cola)) { try { ls.setItem('${cp}', texto); } catch (e) { return; } }

  if (nube === null || typeof GUARDADAS === 'undefined' || !GUARDADAS || typeof GUARDADAS.fusionar !== 'function') return;
  var g = leer('${cl}');
  if (!g.ok) return;
  var items = [];
  if (g.t !== null && g.t !== '') {
    try { items = JSON.parse(g.t); } catch (e) { return; }
    if (!Array.isArray(items)) return;
  }
  function valida(x) { return !!x && typeof x === 'object' && typeof x.id === 'string' && typeof x.nombre === 'string' && !!x.datos && typeof x.datos === 'object'; }
  var locales = items.filter(valida).map(function (x) {
    return typeof x.actualizadoEn === 'number' ? x : Object.assign({}, x, { actualizadoEn: Math.max(x.guardadaEn || 0, x.usadaEn || 0) });
  });
  var pendientes = nueva.filter(function (x) {
    return esObj(x) && ['guardar', 'borrar', 'usar'].indexOf(x.op) >= 0 && typeof x.id === 'string' && typeof x.cuando === 'number';
  });
  var lista = GUARDADAS.fusionar(locales, nube, pendientes);
  function ordenado(v) {
    if (Array.isArray(v)) return v.map(ordenado);
    if (v && typeof v === 'object') {
      var o = {};
      Object.keys(v).sort().forEach(function (k) { if (v[k] !== undefined) o[k] = ordenado(v[k]); });
      return o;
    }
    return v;
  }
  function firma(l) { return JSON.stringify(ordenado(l.slice().sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }))); }
  if (firma(lista) === firma(locales)) return;
  try { ls.setItem('${cl}', JSON.stringify(items.filter(function (x) { return !valida(x); }).concat(lista))); } catch (e) { return; }
  try { if (typeof window.pintarGuardadas === 'function') window.pintarGuardadas(); } catch (e) {}
})();
true;`;
}

/**
 * Lo que comparten la vista del panel y la tarea 'guardadas': el último mensaje de cada parroquia y la
 * vista conectada, para inyectarle scripts. Vive en memoria: lo que dura es el localStorage del panel.
 */
export interface CanalGuardadas {
  recibir(slug: string, m: MensajeGuardadas): void;
  ultimo(slug: string): MensajeGuardadas | null;
  /** Avisa de cada mensaje que llega. Devuelve cómo dejar de escuchar. */
  alMensaje(cb: (slug: string, m: MensajeGuardadas) => void): () => void;
  /** La vista del panel de esa parroquia. Devuelve cómo desconectarla. */
  conectar(slug: string, inyectar: (script: string) => void): () => void;
  /** true si había una vista conectada para esa parroquia. */
  inyectar(slug: string, script: string): boolean;
  olvidar(slug?: string): void;
}

export function crearCanalGuardadas(): CanalGuardadas {
  const ultimos = new Map<string, MensajeGuardadas>();
  const oyentes = new Set<(slug: string, m: MensajeGuardadas) => void>();
  let vista: { slug: string; inyectar: (script: string) => void } | null = null;

  return {
    recibir(slug, m) {
      ultimos.set(slug, m);
      for (const cb of [...oyentes]) {
        try {
          cb(slug, m);
        } catch {
          // Un oyente que falla no corta a los demás.
        }
      }
    },
    ultimo(slug) {
      return ultimos.get(slug) ?? null;
    },
    alMensaje(cb) {
      oyentes.add(cb);
      return () => {
        oyentes.delete(cb);
      };
    },
    conectar(slug, inyectar) {
      const esta = { slug, inyectar };
      vista = esta;
      return () => {
        if (vista === esta) vista = null;
      };
    },
    inyectar(slug, script) {
      if (!vista || vista.slug !== slug) return false;
      vista.inyectar(script);
      return true;
    },
    olvidar(slug) {
      if (slug === undefined) ultimos.clear();
      else ultimos.delete(slug);
    },
  };
}

/** El de la app. */
export const canalGuardadas: CanalGuardadas = crearCanalGuardadas();
