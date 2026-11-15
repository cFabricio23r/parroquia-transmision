/**
 * Estado de la sesión de la app y su reductor puro.
 *
 * Abrir sin red es lo normal: con sesión y parroquia guardadas se entra enseguida en `lista`,
 * y la revisión del acceso llega después (Decisión 10). Lo que llega en vivo (sin acceso,
 * sesión inválida) queda en `pendiente` y se aplica con `termino-transmision`.
 */
import { revisarAcceso } from './parroquias';
import type { Cuenta, ParroquiaApp } from './tipos';

export type FaseSesion = 'cargando' | 'error-almacen' | 'entrar' | 'elegir' | 'sin-parroquias' | 'sin-acceso' | 'lista';

export type EventoSesion =
  | { tipo: 'cargada'; conSesion: boolean; cuenta: Cuenta | null; parroquia: ParroquiaApp | null; parroquias: ParroquiaApp[] }
  | { tipo: 'entro'; cuenta: Cuenta; parroquias: ParroquiaApp[] }
  | { tipo: 'eligio'; parroquia: ParroquiaApp }
  | { tipo: 'cambiar' }
  | { tipo: 'lista-revisada'; parroquias: ParroquiaApp[]; enVivo: boolean }
  | { tipo: 'sesion-invalida'; enVivo: boolean }
  | { tipo: 'termino-transmision' }
  | { tipo: 'salio' }
  | { tipo: 'error-almacen' };

export interface EstadoSesion {
  fase: FaseSesion;
  cuenta: Cuenta | null;
  parroquia: ParroquiaApp | null;
  parroquias: ParroquiaApp[];
  /** La parroquia a la que se le quitó el acceso (pantalla Sin acceso). */
  perdida: ParroquiaApp | null;
  aviso: string | null;
  pendiente: EventoSesion | null;
}

export const ESTADO_SESION_INICIAL: EstadoSesion = Object.freeze({
  fase: 'cargando',
  cuenta: null,
  parroquia: null,
  parroquias: [],
  perdida: null,
  aviso: null,
  pendiente: null,
}) as EstadoSesion;

/** El texto de `plataforma/lib/sesion.ts` (l.18). */
export const AVISO_SESION_VENCIDA = 'Tu sesión venció. Entra de nuevo';

/** Con la lista: la guardada si sigue (con su nombre de la lista), la única si hay una, o ninguna. */
function faseConLista(e: EstadoSesion, parroquias: ParroquiaApp[], guardada: ParroquiaApp | null, vacia: FaseSesion): EstadoSesion {
  const sigue = guardada ? parroquias.find((p) => p.id === guardada.id) ?? null : null;
  if (sigue) return { ...e, fase: 'lista', parroquia: sigue, parroquias };
  if (parroquias.length === 1) return { ...e, fase: 'lista', parroquia: parroquias[0], parroquias };
  if (parroquias.length === 0) return { ...e, fase: vacia, parroquia: null, parroquias };
  return { ...e, fase: 'elegir', parroquia: null, parroquias };
}

export function reducirSesion(e: EstadoSesion, ev: EventoSesion): EstadoSesion {
  switch (ev.tipo) {
    case 'cargada': {
      const base: EstadoSesion = { ...ESTADO_SESION_INICIAL, cuenta: ev.cuenta, parroquia: ev.parroquia, parroquias: ev.parroquias };
      if (!ev.conSesion) return { ...base, fase: 'entrar' };
      if (ev.parroquia) return { ...base, fase: 'lista' };
      // Sin red no se sabe si la lista vacía es real: Elegir muestra «Reintentar».
      return faseConLista(base, ev.parroquias, null, 'elegir');
    }

    case 'entro':
      return faseConLista(
        { ...e, cuenta: ev.cuenta, perdida: null, aviso: null, pendiente: null },
        ev.parroquias,
        e.parroquia,
        'sin-parroquias',
      );

    case 'eligio':
      return { ...e, fase: 'lista', parroquia: ev.parroquia, perdida: null, aviso: null };

    case 'cambiar':
      if (e.fase === 'lista') return { ...e, fase: 'elegir' };
      // «Elegir otra parroquia» en Sin acceso: la limpieza de la perdida ya quedó encolada.
      if (e.fase === 'sin-acceso') return { ...e, fase: 'elegir', parroquia: null, perdida: null };
      return e;

    case 'lista-revisada': {
      if (ev.enVivo) {
        if (e.pendiente?.tipo === 'sesion-invalida') return e;
        return { ...e, pendiente: ev };
      }
      if (e.fase === 'lista' && e.parroquia) {
        const r = revisarAcceso(ev.parroquias, e.parroquia);
        if (r.tipo === 'ok') return { ...e, parroquia: r.parroquia, parroquias: ev.parroquias };
        return { ...e, fase: 'sin-acceso', perdida: e.parroquia, parroquia: null, parroquias: ev.parroquias };
      }
      if (e.fase === 'elegir' && !e.parroquia) return faseConLista(e, ev.parroquias, null, 'sin-parroquias');
      return { ...e, parroquias: ev.parroquias };
    }

    case 'sesion-invalida':
      if (ev.enVivo) return { ...e, pendiente: ev };
      if (e.fase === 'cargando' || e.fase === 'error-almacen') return e;
      return { ...e, fase: 'entrar', cuenta: null, aviso: AVISO_SESION_VENCIDA, pendiente: null };

    case 'termino-transmision': {
      if (!e.pendiente) return e;
      const p = e.pendiente;
      const sin = { ...e, pendiente: null };
      if (p.tipo === 'lista-revisada' || p.tipo === 'sesion-invalida') return reducirSesion(sin, { ...p, enVivo: false });
      return reducirSesion(sin, p);
    }

    case 'salio':
      return { ...ESTADO_SESION_INICIAL, fase: 'entrar' };

    case 'error-almacen':
      return { ...e, fase: 'error-almacen' };
  }
}

export interface TiendaSesion {
  obtener(): EstadoSesion;
  despachar(ev: EventoSesion): void;
  /** Devuelve la función para dejar de escuchar. */
  suscribir(cb: () => void): () => void;
}

/** Como `src/estado/tienda.ts`: fuera de React, para `useSyncExternalStore`. `alCambiar` ve cada paso. */
export function crearTiendaSesion(alCambiar?: (antes: EstadoSesion, despues: EstadoSesion) => void): TiendaSesion {
  let estado = ESTADO_SESION_INICIAL;
  const oyentes = new Set<() => void>();
  return {
    obtener: () => estado,
    despachar(ev) {
      const antes = estado;
      const despues = reducirSesion(antes, ev);
      if (despues === antes) return;
      estado = despues;
      alCambiar?.(antes, despues);
      for (const cb of [...oyentes]) cb();
    },
    suscribir(cb) {
      oyentes.add(cb);
      return () => {
        oyentes.delete(cb);
      };
    },
  };
}
