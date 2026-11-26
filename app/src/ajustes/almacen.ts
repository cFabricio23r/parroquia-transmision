// Ajustes guardados por parroquia en expo-secure-store: lo bajado de la web (ajustes y
// clave) y lo cambiado en este celular. La clave es un secreto: nunca se escribe en logs.
import * as SecureStore from 'expo-secure-store';
import { Calidad, estiloFinalValido, limpiarClave, Microfono } from './ajustes';
import { AjustesCelular, AjustesDeParroquia, ClaveDeParroquia } from './origen';
import { esSlugValido } from '../plataforma/direcciones';

export interface GuardadoDeParroquia {
  parroquia: AjustesDeParroquia | null;
  clave: ClaveDeParroquia | null;
  celular: AjustesCelular;
  microfono: Microfono;
}
export interface AlmacenAjustes {
  leer(slug: string): Promise<GuardadoDeParroquia>;
  /** null borra esa llave. */
  guardarDeParroquia(slug: string, p: AjustesDeParroquia | null, k: ClaveDeParroquia | null): Promise<void>;
  /** {} borra la llave. */
  guardarCelular(slug: string, c: AjustesCelular): Promise<void>;
  guardarMicrofono(m: Microfono): Promise<void>;
  /** Las tres llaves de la parroquia, y la saca del índice. */
  borrarParroquia(slug: string): Promise<void>;
  /**
   * Cierre de sesión: de cada slug del índice borra lo bajado, lo del celular y la clave; además el
   * micrófono y el índice. No deja nada de la sesión anterior en el celular.
   */
  borrarTodo(): Promise<void>;
  /** parroquia_ajustes_v1 (spec, decisión 11). */
  borrarViejos(): Promise<void>;
}
type Store = {
  getItemAsync(k: string): Promise<string | null>;
  setItemAsync(k: string, v: string): Promise<void>;
  deleteItemAsync(k: string): Promise<void>;
};

const INDICE = 'pev_app_ajustes_slugs_v1';
const MICROFONO = 'pev_app_microfono_v1';
const VIEJA = 'parroquia_ajustes_v1';

export const llavesDe = (slug: string): { parroquia: string; clave: string; celular: string } => {
  if (!esSlugValido(slug)) throw new Error('Parroquia inválida.');
  const b = 'pev_app_ajustes_' + slug + '_';
  return { parroquia: b + 'parroquia_v1', clave: b + 'clave_v1', celular: b + 'celular_v1' };
};

function json(crudo: string | null): unknown {
  if (!crudo) return null;
  try {
    return JSON.parse(crudo);
  } catch {
    return null;
  }
}
const esObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const esCalidad = (x: unknown): x is Calidad => x === '720p' || x === '1080p';
const claveValida = (x: unknown): x is string => typeof x === 'string' && x !== '' && !/\s/.test(x);

function leerParroquia(x: unknown): AjustesDeParroquia | null {
  if (!esObj(x) || !esCalidad(x.calidad) || typeof x.actualizadoEn !== 'string') return null;
  if (x.estiloFinal !== 'claro' && x.estiloFinal !== 'azul') return null;
  const servidor = typeof x.servidor === 'string' && x.servidor.startsWith('rtmps://') ? x.servidor : null;
  return { servidor, calidad: x.calidad, estiloFinal: estiloFinalValido(x.estiloFinal), actualizadoEn: x.actualizadoEn };
}
function leerClave(x: unknown): ClaveDeParroquia | null {
  if (!esObj(x) || !claveValida(x.clave) || typeof x.guardadaEn !== 'string') return null;
  return { clave: x.clave, guardadaEn: x.guardadaEn };
}
function leerCelular(x: unknown): AjustesCelular {
  const c: AjustesCelular = {};
  if (!esObj(x)) return c;
  if (typeof x.servidor === 'string' && x.servidor.trim() !== '') c.servidor = x.servidor.trim();
  if (typeof x.clave === 'string' && claveValida(limpiarClave(x.clave))) c.clave = limpiarClave(x.clave);
  if (esCalidad(x.calidad)) c.calidad = x.calidad;
  if (c.clave && (x.claveParroquiaVista === null || typeof x.claveParroquiaVista === 'string')) {
    c.claveParroquiaVista = x.claveParroquiaVista;
  }
  return c;
}

export function crearAlmacenAjustes(store: Store): AlmacenAjustes {
  async function indice(): Promise<string[]> {
    const x = json(await store.getItemAsync(INDICE));
    return Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string' && esSlugValido(s)) : [];
  }
  async function anotar(slug: string): Promise<void> {
    const i = await indice();
    if (!i.includes(slug)) await store.setItemAsync(INDICE, JSON.stringify([...i, slug]));
  }
  async function poner(k: string, v: unknown | null): Promise<void> {
    if (v === null) await store.deleteItemAsync(k);
    else await store.setItemAsync(k, JSON.stringify(v));
  }
  return {
    async leer(slug) {
      const l = llavesDe(slug);
      const [p, k, c, m] = await Promise.all([
        store.getItemAsync(l.parroquia),
        store.getItemAsync(l.clave),
        store.getItemAsync(l.celular),
        store.getItemAsync(MICROFONO),
      ]);
      return {
        parroquia: leerParroquia(json(p)),
        clave: leerClave(json(k)),
        celular: leerCelular(json(c)),
        microfono: m === 'externo' ? 'externo' : 'celular',
      };
    },
    async guardarDeParroquia(slug, p, k) {
      const l = llavesDe(slug);
      await anotar(slug);
      await poner(l.parroquia, p);
      await poner(l.clave, k);
    },
    async guardarCelular(slug, c) {
      const l = llavesDe(slug);
      const limpio: AjustesCelular = { ...c };
      if (limpio.servidor !== undefined) limpio.servidor = limpio.servidor.trim();
      if (limpio.clave !== undefined) limpio.clave = limpiarClave(limpio.clave);
      await anotar(slug);
      await poner(l.celular, Object.keys(limpio).length === 0 ? null : limpio);
    },
    async guardarMicrofono(m) {
      await store.setItemAsync(MICROFONO, m);
    },
    async borrarParroquia(slug) {
      const l = llavesDe(slug);
      await store.deleteItemAsync(l.parroquia);
      await store.deleteItemAsync(l.clave);
      await store.deleteItemAsync(l.celular);
      const i = await indice();
      await store.setItemAsync(INDICE, JSON.stringify(i.filter((s) => s !== slug)));
    },
    async borrarTodo() {
      for (const s of await indice()) {
        const l = llavesDe(s);
        await store.deleteItemAsync(l.parroquia);
        await store.deleteItemAsync(l.clave);
        await store.deleteItemAsync(l.celular);
      }
      await store.deleteItemAsync(MICROFONO);
      await store.deleteItemAsync(INDICE);
    },
    async borrarViejos() {
      await store.deleteItemAsync(VIEJA);
    },
  };
}

export const almacenAjustes: AlmacenAjustes = crearAlmacenAjustes(SecureStore);
