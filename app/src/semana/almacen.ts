// El almacén de la semana en el celular (plan 3b, Tarea 11): la última semana bajada y los
// cambios hechos en la app que todavía no se subieron. Va en archivos privados (DatosApp.kt),
// `semana-<slug>` y `pendientes-<slug>`. Nunca lanza al leer: un archivo malo es «no hay».
import { esSlugValido } from '../plataforma/direcciones';
import { SEMANA, type Origen } from './nucleo';

export interface CacheSemana {
  version: 1;
  parroquiaId: string;
  desde: string;
  hasta: string;
  bajadaEn: string;
  fijas: unknown[];
  series: unknown[];
  transmisiones: unknown[];
  tipos: unknown;
}

export interface Pendiente {
  clave: string;
  fecha: string;
  hora: string;
  tipo: string;
  origen: Origen;
  fijaId: string | null;
  serieId: string | null;
  datos: Record<string, unknown>;
  editadoEn: string;
  rechazado: boolean;
}

export interface NativoDatos {
  leerDatosApp(nombre: string): Promise<string | null>;
  guardarDatosApp(nombre: string, texto: string): Promise<void>;
  borrarDatosApp(prefijo: string): Promise<void>;
}

export interface AlmacenSemana {
  leerCache(slug: string): Promise<CacheSemana | null>;
  guardarCache(slug: string, c: CacheSemana): Promise<void>;
  leerPendientes(slug: string): Promise<Pendiente[]>;
  guardarPendiente(slug: string, p: Pendiente): Promise<void>;
  quitarPendiente(slug: string, clave: string): Promise<void>;
  marcarRechazado(slug: string, clave: string): Promise<void>;
  borrar(slug: string): Promise<void>;
  borrarTodo(): Promise<void>;
}

const esTexto = (v: unknown): v is string => typeof v === 'string' && v !== '';
const esTextoONulo = (v: unknown) => v === null || esTexto(v);

function nombre(prefijo: 'semana' | 'pendientes', slug: string): string {
  if (!esSlugValido(slug)) throw new Error('Parroquia inválida.');
  return `${prefijo}-${slug}`;
}

function cacheValida(v: unknown): v is CacheSemana {
  if (!v || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  return (
    c.version === 1 &&
    esTexto(c.parroquiaId) &&
    SEMANA.esFecha(c.desde) &&
    SEMANA.esFecha(c.hasta) &&
    esTexto(c.bajadaEn) &&
    Array.isArray(c.fijas) &&
    Array.isArray(c.series) &&
    Array.isArray(c.transmisiones)
  );
}

function pendienteValido(v: unknown): v is Pendiente {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return (
    esTexto(p.clave) &&
    SEMANA.esFecha(p.fecha) &&
    esTexto(p.hora) &&
    esTexto(p.tipo) &&
    (p.origen === 'fija' || p.origen === 'serie' || p.origen === 'unica') &&
    esTextoONulo(p.fijaId) &&
    esTextoONulo(p.serieId) &&
    !!p.datos && typeof p.datos === 'object' &&
    esTexto(p.editadoEn) &&
    typeof p.rechazado === 'boolean'
  );
}

function limpio(p: Pendiente): Pendiente {
  return {
    clave: p.clave,
    fecha: p.fecha,
    hora: p.hora,
    tipo: p.tipo,
    origen: p.origen,
    fijaId: p.fijaId,
    serieId: p.serieId,
    datos: SEMANA.limpiarDatos(p.datos),
    editadoEn: p.editadoEn,
    rechazado: p.rechazado === true,
  };
}

export function crearAlmacenSemana(nativo: NativoDatos): AlmacenSemana {
  async function leerJson(n: string): Promise<unknown> {
    let texto: string | null;
    try {
      texto = await nativo.leerDatosApp(n);
    } catch {
      console.warn('semana: no se pudo leer');
      return null;
    }
    if (texto === null) return null;
    try {
      return JSON.parse(texto);
    } catch {
      return null;
    }
  }

  async function leerPendientes(slug: string): Promise<Pendiente[]> {
    const v = await leerJson(nombre('pendientes', slug));
    return Array.isArray(v) ? v.filter(pendienteValido).map(limpio) : [];
  }

  async function guardarPendientes(slug: string, lista: Pendiente[]): Promise<void> {
    await nativo.guardarDatosApp(nombre('pendientes', slug), JSON.stringify(lista.map(limpio)));
  }

  return {
    async leerCache(slug) {
      const v = await leerJson(nombre('semana', slug));
      return cacheValida(v) ? v : null;
    },
    async guardarCache(slug, c) {
      await nativo.guardarDatosApp(nombre('semana', slug), JSON.stringify(c));
    },
    leerPendientes,
    async guardarPendiente(slug, p) {
      const lista = (await leerPendientes(slug)).filter((x) => x.clave !== p.clave);
      lista.push(limpio(p));
      await guardarPendientes(slug, lista);
    },
    async quitarPendiente(slug, clave) {
      const lista = await leerPendientes(slug);
      await guardarPendientes(slug, lista.filter((x) => x.clave !== clave));
    },
    async marcarRechazado(slug, clave) {
      const lista = await leerPendientes(slug);
      await guardarPendientes(slug, lista.map((x) => (x.clave === clave ? { ...x, rechazado: true } : x)));
    },
    async borrar(slug) {
      // Sin «-» al final, DatosApp borra el nombre exacto.
      await nativo.borrarDatosApp(nombre('semana', slug));
      await nativo.borrarDatosApp(nombre('pendientes', slug));
    },
    async borrarTodo() {
      await nativo.borrarDatosApp('semana-');
      await nativo.borrarDatosApp('pendientes-');
    },
  };
}

// El módulo nativo se pide al usarlo: así importar este archivo en jest no lo carga.
function transmisor(): NativoDatos {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../../modules/transmisor') as NativoDatos;
}

export const almacenSemana = crearAlmacenSemana({
  leerDatosApp: (n) => transmisor().leerDatosApp(n),
  guardarDatosApp: (n, t) => transmisor().guardarDatosApp(n, t),
  borrarDatosApp: (p) => transmisor().borrarDatosApp(p),
});
