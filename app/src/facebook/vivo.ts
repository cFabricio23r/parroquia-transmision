/**
 * Une el cliente de Facebook con el orquestador (Tarea 9).
 * Nada de este archivo escribe en `console.*` ni deja la clave de transmisión en un error.
 */
import type { TextosVivo } from './textos';
import type { RespuestaVivo, VivoVisible } from '../estado/orquestador';
import { PLAZO_CREAR_MS, type ClienteFacebook, type Destinos, type EstadoVivo } from './cliente';

/**
 * Qué páginas extra salen con la transmisión: la elección del voluntario (`elecciones`, de
 * leerElecciones) o, sin elección (null), las marcadas por defecto. Solo cuentan las que la
 * plataforma todavía asigna, y en su orden.
 */
export function extrasElegidos(d: Destinos, elecciones: readonly string[] | null): string[] {
  if (elecciones === null) return d.extras.filter((e) => e.porDefecto).map((e) => e.id);
  return d.extras.filter((e) => elecciones.includes(e.id)).map((e) => e.id);
}

/** La tira «SALE EN FACEBOOK» de Antes de iniciar; null si no hay Facebook directo. */
export function resumenTira(d: Destinos, elecciones: readonly string[] | null): { principal: string; extras: string | null } | null {
  if (!d.conectado || d.principal === null) return null;
  const nombres = d.extras.filter((e) => extrasElegidos(d, elecciones).includes(e.id)).map((e) => e.nombre);
  return { principal: d.principal.nombre, extras: nombres.length > 0 ? nombres.join(' y ') : null };
}

/** Las chips de En vivo: una verde con dónde sale y una ámbar por cada extra que no salió. */
export function chipsFacebook(v: VivoVisible | null): { verde: string | null; ambar: string[] } {
  if (v === null) return { verde: null, ambar: [] };
  const salieron = v.extras.filter((e) => e.salio === true).map((e) => e.nombre);
  return {
    verde: `En vivo en ${[v.principal, ...salieron].join(' y ')}`,
    ambar: v.extras.filter((e) => e.salio === false).map((e) => `No salió en ${e.nombre}. Avisa al coordinador.`),
  };
}

export function crearVivoFacebook(o: {
  cliente: ClienteFacebook;
  /** Título y descripción de este vivo (textosVivo). */
  textos(): TextosVivo;
  /** Las casillas guardadas de esta parroquia (leerElecciones). Sin esto, o con null, las porDefecto. */
  elecciones?(): Promise<string[] | null>;
}): {
  pedirVivo(): Promise<RespuestaVivo>;
  terminarVivo(id: string): Promise<void>;
  estadoVivo(id: string): Promise<EstadoVivo | null>;
} {
  return {
    // Un solo tope para todo el pedido (destinos + crear): a PLAZO_CREAR_MS se cae a la clave fija. El pedido de
    // crear sigue vivo hasta PLAZO_PEDIDO_CREAR_MS para poder cerrar lo que llegue tarde.
    pedirVivo() {
      return new Promise<RespuestaVivo>((resolver) => {
        let vencido = false;
        const t = setTimeout(() => {
          vencido = true;
          resolver({ error: true });
        }, PLAZO_CREAR_MS);
        const fin = (r: RespuestaVivo) => {
          clearTimeout(t);
          resolver(r);
        };
        void (async () => {
          const destinos = await o.cliente.destinos();
          if (vencido) return;
          if (!destinos.ok) return fin({ error: true });
          // Sin Facebook directo (no conectado o sin página principal): se usa la clave fija como hoy.
          if (!destinos.valor.conectado || destinos.valor.principal === null) return fin(null);
          let guardadas: string[] | null = null;
          try {
            guardadas = (await o.elecciones?.()) ?? null;
          } catch {
            guardadas = null; // sin poder leer las casillas, salen las marcadas por defecto
          }
          if (vencido) return;
          const vivo = await o.cliente.crear(extrasElegidos(destinos.valor, guardadas), o.textos());
          if (!vivo.ok) return fin({ error: true });
          if (vencido) {
            // Llegó tarde: no se usa, y se cierra una vez para no dejar un vivo huérfano (el pedido de crear dura
            // más que este tope justo para poder hacerlo). Un vivo reusado es el de otro celular: ese no se toca.
            if (!vivo.valor.reusado) void Promise.resolve(o.cliente.terminar(vivo.valor.id)).catch(() => undefined);
            return;
          }
          fin({
            servidor: vivo.valor.servidor,
            clave: vivo.valor.clave,
            id: vivo.valor.id,
            principal: vivo.valor.principal.nombre,
            extras: vivo.valor.extras.map((e) => e.nombre),
          });
        })().catch(() => {
          if (!vencido) fin({ error: true });
        });
      });
    },
    async terminarVivo(id) {
      const r = await o.cliente.terminar(id);
      if (!r.ok) throw new Error('no se pudo cerrar el vivo');
    },
    async estadoVivo(id) {
      try {
        const r = await o.cliente.estado(id);
        return r.ok ? r.valor : null;
      } catch {
        return null;
      }
    },
  };
}
