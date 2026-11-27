/**
 * Une el cliente de Facebook con el orquestador (Tarea 9).
 * Nada de este archivo escribe en `console.*` ni deja la clave de transmisión en un error.
 */
import type { RespuestaVivo } from '../estado/orquestador';
import { PLAZO_CREAR_MS, type ClienteFacebook, type Destinos } from './cliente';

/**
 * Qué páginas extra salen con la transmisión. Por ahora las que vienen marcadas por defecto;
 * la Tarea 10 lo cambia por la elección del voluntario en el selector.
 */
export function extrasElegidos(d: Destinos): string[] {
  return d.extras.filter((e) => e.porDefecto).map((e) => e.id);
}

export function crearVivoFacebook(o: { cliente: ClienteFacebook; titulo(): string }): {
  pedirVivo(): Promise<RespuestaVivo>;
  terminarVivo(id: string): Promise<void>;
} {
  return {
    // Un solo tope para todo el pedido (destinos + crear): a PLAZO_CREAR_MS se cae a la clave fija.
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
          const vivo = await o.cliente.crear(extrasElegidos(destinos.valor), o.titulo());
          if (!vivo.ok) return fin({ error: true });
          if (vencido) {
            // Llegó tarde: no se usa, y se cierra una vez para no dejar un vivo huérfano.
            void Promise.resolve(o.cliente.terminar(vivo.valor.id)).catch(() => undefined);
            return;
          }
          fin({ servidor: vivo.valor.servidor, clave: vivo.valor.clave, id: vivo.valor.id });
        })().catch(() => {
          if (!vencido) fin({ error: true });
        });
      });
    },
    async terminarVivo(id) {
      const r = await o.cliente.terminar(id);
      if (!r.ok) throw new Error('no se pudo cerrar el vivo');
    },
  };
}
