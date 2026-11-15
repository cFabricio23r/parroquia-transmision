/**
 * La copia de la parroquia que se guarda en el celular (decisiones 2 a 4 del plan 3a).
 *
 * La tarea 'paginas' corre en 'abrir' y en 'antes-de-iniciar':
 *   1. baja `<origen>/<slug>/config.json` sin caché y lo valida (que sea el de esta parroquia);
 *   2. se lo pasa a lo nativo con las imágenes que nombra (`descargarCopia`), que baja las
 *      páginas y los medios y cambia la copia, salvo que esté congelada (en vivo);
 *   3. si cambiaron las páginas y no se salió al aire, avisa con `alCambiarPaginas(slug)`.
 * Nunca se baja ni se recarga nada en vivo. Un config que no es el de esta parroquia (una
 * página de error con 200, el de otro slug, `version: 0`, un JSON roto) deja la copia como estaba.
 */
import type { EstadoCopia, ResultadoCopia } from '../../modules/transmisor';
import { esRutaDeMedio, urlDePagina } from '../plataforma/direcciones';
import type { Limpiezas, Sincronizador, TareaSincronizar } from '../sincronizar/sincronizar';
import { leerJson, pedirConPlazo, PLAZO_POR_DEFECTO_MS } from '../supabase/cliente';

/** Las imágenes que nombra el config: los `src` de texto que son `medios/<archivo>`, ordenadas y sin repetir. */
export function rutasDeMedios(config: unknown): string[] {
  const vistas = new Set<string>();
  const recorrer = (v: unknown) => {
    if (Array.isArray(v)) {
      v.forEach(recorrer);
      return;
    }
    if (typeof v !== 'object' || v === null) return;
    for (const [clave, valor] of Object.entries(v as Record<string, unknown>)) {
      if (clave === 'src' && typeof valor === 'string' && esRutaDeMedio(valor)) vistas.add(valor);
      else recorrer(valor);
    }
  };
  recorrer(config);
  return [...vistas].sort();
}

export type ValidacionConfig =
  | { ok: true; version: number }
  | { ok: false; motivo: 'json' | 'esquema' | 'slug' | 'version' };

/** ¿Es el `config.json` de esta parroquia? Lo mínimo para no guardar una página de error o el de otra. */
export function validarConfigBajada(texto: string, slug: string): ValidacionConfig {
  const c = leerJson(texto);
  if (typeof c !== 'object' || c === null || Array.isArray(c)) return { ok: false, motivo: 'json' };
  const { esquema, slug: suSlug, version } = c as Record<string, unknown>;
  if (esquema !== 1) return { ok: false, motivo: 'esquema' };
  if (suSlug !== slug) return { ok: false, motivo: 'slug' };
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return { ok: false, motivo: 'version' };
  return { ok: true, version };
}

export interface DepsCopias {
  /** El origen normalizado de la plataforma. */
  origen: string;
  fetch: typeof fetch;
  nativo: {
    descargarCopia(slug: string, config: string, medios: readonly string[]): Promise<ResultadoCopia>;
    borrarCopia(slug: string): Promise<void>;
    borrarCopias(): Promise<void>;
  };
  /** Cambiaron las páginas de la copia (fuera del vivo): la app recarga el panel y las escenas. */
  alCambiarPaginas(slug: string): void;
  plazoMs?: number;
}

export function crearTareaPaginas(d: DepsCopias): TareaSincronizar {
  return async (c) => {
    // En vivo, todo fijo: no se pide nada.
    if (c.enVivo()) return;
    const slug = c.parroquia.slug;
    const r = await pedirConPlazo(
      d.fetch,
      urlDePagina(d.origen, slug, 'config.json'),
      { method: 'GET', cache: 'no-store' },
      d.plazoMs ?? PLAZO_POR_DEFECTO_MS,
    );
    // Los errores no llevan el cuerpo ni la dirección.
    if (r === null) throw new Error('paginas: sin respuesta');
    if (r.estado !== 200) throw new Error('paginas: estado ' + r.estado);
    const v = validarConfigBajada(r.texto, slug);
    if (!v.ok) throw new Error('paginas: config ' + v.motivo);
    // Si se salió al aire o se cambió de parroquia mientras se bajaba, no se toca la copia.
    if (c.enVivo() || !c.sigueElegida()) return;
    const resultado = await d.nativo.descargarCopia(slug, r.texto, rutasDeMedios(leerJson(r.texto)));
    // Una descarga que termina en vivo no recarga nada (Review Focus 2).
    if (resultado.paginasCambiaron && !c.enVivo() && c.sigueElegida()) d.alCambiarPaginas(slug);
  };
}

/** Registra la tarea 'paginas' (después de 'acceso') y la limpieza 'copias'. */
export function registrarCopias(s: Sincronizador, l: Limpiezas, d: DepsCopias): void {
  s.registrarTarea('paginas', ['abrir', 'antes-de-iniciar'], crearTareaPaginas(d));
  l.registrar('copias', (a) => (a.tipo === 'parroquia' ? d.nativo.borrarCopia(a.parroquia.slug) : d.nativo.borrarCopias()));
}

const oyentes = new Set<(slug: string) => void>();

/** Se entera de que cambiaron las páginas de la copia de una parroquia. Devuelve cómo dejar de escuchar. */
export function alCambiarPaginas(cb: (slug: string) => void): () => void {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}

export function avisarCambioDePaginas(slug: string): void {
  for (const cb of [...oyentes]) cb(slug);
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const SIN_COPIA = 'Sin pantallas guardadas: se usan las de la app.';

const dosCifras = (n: number) => (n < 10 ? '0' : '') + n;
const mismoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** «Pantallas guardadas hoy, 18:42», «ayer, 20:05» o «el 5 nov, 10:12», en hora local y sin Intl. */
export function textoCopia(e: EstadoCopia | null, ahora: Date): string {
  if (!e) return SIN_COPIA;
  const f = new Date(e.guardadaEn);
  if (Number.isNaN(f.getTime())) return SIN_COPIA;
  const hora = dosCifras(f.getHours()) + ':' + dosCifras(f.getMinutes());
  const ayer = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1);
  if (mismoDia(f, ahora)) return 'Pantallas guardadas hoy, ' + hora;
  if (mismoDia(f, ayer)) return 'Pantallas guardadas ayer, ' + hora;
  return 'Pantallas guardadas el ' + f.getDate() + ' ' + MESES[f.getMonth()] + ', ' + hora;
}
