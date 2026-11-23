// El núcleo compartido de las misas listas (vicaria/guardadas-nucleo.js), con tipos, y lo que la app
// acepta de lo que le manda el panel. src/generado/guardadas-nucleo.js lo escribe
// scripts/copiar-vicaria.js (una copia byte a byte, como semana.js).
import nucleo from '../generado/guardadas-nucleo';

/** Una guardada del panel (localStorage['pev_<slug>_guardadas_v1']). Fechas en ms epoch. */
export type Guardada = {
  id: string;
  nombre: string;
  tipo: string;
  guardadaEn: number;
  usadaEn: number;
  actualizadoEn: number;
  borradaEn?: number | null;
  datos: Record<string, unknown>;
};

export type OpPendiente = 'guardar' | 'borrar' | 'usar';

/** Un cambio del panel que falta subir (localStorage['pev_<slug>_guardadas_pendientes_v1']). */
export type PendienteGuardada = { op: OpPendiente; id: string; cuando: number; rechazado?: boolean };

/** Una fila de public.guardadas. Fechas en ISO. */
export type FilaGuardada = {
  id: string;
  parroquia_id: string;
  nombre: string;
  tipo: string;
  datos: Record<string, unknown>;
  guardada_en: string;
  usada_en: string;
  actualizado_en: string;
  actualizado_desde: 'app' | 'panel';
  actualizado_por?: string | null;
  borrada_en: string | null;
};

export interface NucleoGuardadas {
  readonly LIMITE: number;
  readonly CAMPOS_DE_AIRE: readonly string[];
  idNuevo(ahoraMs: number, azar: () => number): string;
  aFila(g: Guardada, desde: 'app' | 'panel', parroquiaId: string): FilaGuardada;
  deFila(f: FilaGuardada): Guardada;
  anotar(pendientes: PendienteGuardada[], p: PendienteGuardada): PendienteGuardada[];
  fusionar(local: Guardada[], nube: FilaGuardada[], pendientes: PendienteGuardada[]): Guardada[];
  nombreLibre(nombre: string, ocupados: string[]): string;
}

export const GUARDADAS = nucleo as unknown as NucleoGuardadas;

const OPS: readonly string[] = ['guardar', 'borrar', 'usar'];

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Las guardadas que se pueden usar, como `leerGuardadas` de vicaria/guardadas.js: con id y nombre
 * de texto y `datos` objeto. Las de antes de la nube no traen actualizadoEn: se completa con el mayor
 * entre guardadaEn y usadaEn.
 */
export function guardadasValidas(lista: readonly unknown[]): Guardada[] {
  return lista
    .filter((g): g is Record<string, unknown> => esObjeto(g) && typeof g.id === 'string' && typeof g.nombre === 'string' && esObjeto(g.datos))
    .map((g) =>
      (typeof g.actualizadoEn === 'number'
        ? g
        : { ...g, actualizadoEn: Math.max(Number(g.guardadaEn) || 0, Number(g.usadaEn) || 0) }) as unknown as Guardada,
    );
}

/** Los pendientes bien formados, como `leerPendientes` de vicaria/guardadas.js. */
export function pendientesValidos(lista: readonly unknown[]): PendienteGuardada[] {
  return lista.filter(
    (p): p is PendienteGuardada =>
      esObjeto(p) && typeof p.op === 'string' && OPS.includes(p.op) && typeof p.id === 'string' && typeof p.cuando === 'number',
  );
}
