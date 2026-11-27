/**
 * Memoria de las casillas «También mostrar en» (Tarea 10): qué páginas extra eligió el voluntario,
 * por parroquia. Va en los archivos privados de la app (DatosApp), como la semana.
 *
 * La llave del plan era `pev_fb_extras_v1:<slug>`, pero ni SecureStore ni DatosApp aceptan «:» en
 * el nombre (verificado en expo-secure-store y en DatosApp.kt), así que el nombre es
 * `fb-extras-v1-<slug>`. Solo guarda ids de páginas: nada secreto.
 * `null` al leer = «sin elegir»: se usan las marcadas por defecto.
 */
import { esSlugValido } from '../plataforma/direcciones';
import type { Limpiezas } from '../sincronizar/sincronizar';

export interface NativoElecciones {
  leerDatosApp(nombre: string): Promise<string | null>;
  guardarDatosApp(nombre: string, texto: string): Promise<void>;
  borrarDatosApp(prefijo: string): Promise<void>;
}

export interface Elecciones {
  leerElecciones(slug: string): Promise<string[] | null>;
  guardarElecciones(slug: string, ids: string[]): Promise<void>;
  borrarElecciones(): Promise<void>;
  borrarEleccionesDe(slug: string): Promise<void>;
}

const PREFIJO = 'fb-extras-v1-';

export function llaveElecciones(slug: string): string {
  if (!esSlugValido(slug)) throw new Error('Parroquia inválida.');
  return PREFIJO + slug;
}

export function crearElecciones(nativo: NativoElecciones): Elecciones {
  return {
    async leerElecciones(slug) {
      if (!esSlugValido(slug)) return null;
      let texto: string | null;
      try {
        texto = await nativo.leerDatosApp(llaveElecciones(slug));
      } catch {
        return null;
      }
      if (texto === null) return null;
      try {
        const v: unknown = JSON.parse(texto);
        return Array.isArray(v) && v.every((x) => typeof x === 'string' && x !== '') ? (v as string[]) : null;
      } catch {
        return null;
      }
    },
    async guardarElecciones(slug, ids) {
      await nativo.guardarDatosApp(llaveElecciones(slug), JSON.stringify([...new Set(ids)]));
    },
    async borrarElecciones() {
      await nativo.borrarDatosApp(PREFIJO);
    },
    async borrarEleccionesDe(slug) {
      // Sin «-» al final, DatosApp borra el nombre exacto.
      await nativo.borrarDatosApp(llaveElecciones(slug));
    },
  };
}

/** La limpieza de cuentas (cerrar sesión, cambiar de dueño o de parroquia) borra las elecciones. */
export function registrarElecciones(l: Limpiezas, e: Pick<Elecciones, 'borrarElecciones' | 'borrarEleccionesDe'>): void {
  l.registrar('elecciones', (a) => (a.tipo === 'parroquia' ? e.borrarEleccionesDe(a.parroquia.slug) : e.borrarElecciones()));
}

// El módulo nativo se pide al usarlo: así importar este archivo en jest no lo carga.
function transmisor(): NativoElecciones {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../../modules/transmisor') as NativoElecciones;
}

const real = crearElecciones({
  leerDatosApp: (n) => transmisor().leerDatosApp(n),
  guardarDatosApp: (n, t) => transmisor().guardarDatosApp(n, t),
  borrarDatosApp: (p) => transmisor().borrarDatosApp(p),
});

export const leerElecciones = real.leerElecciones;
export const guardarElecciones = real.guardarElecciones;
export const borrarElecciones = real.borrarElecciones;
export const borrarEleccionesDe = real.borrarEleccionesDe;
