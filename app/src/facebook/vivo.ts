/**
 * Une el cliente de Facebook con el orquestador (Tarea 9).
 * Nada de este archivo escribe en `console.*` ni deja la clave de transmisión en un error.
 */
import type { RespuestaVivo } from '../estado/orquestador';
import type { ClienteFacebook, Destinos } from './cliente';

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
    async pedirVivo() {
      const destinos = await o.cliente.destinos();
      if (!destinos.ok) return { error: true };
      // Sin Facebook directo (no conectado o sin página principal): se usa la clave fija como hoy.
      if (!destinos.valor.conectado || destinos.valor.principal === null) return null;
      const vivo = await o.cliente.crear(extrasElegidos(destinos.valor), o.titulo());
      if (!vivo.ok) return { error: true };
      return { servidor: vivo.valor.servidor, clave: vivo.valor.clave, id: vivo.valor.id };
    },
    async terminarVivo(id) {
      const r = await o.cliente.terminar(id);
      if (!r.ok) throw new Error('no se pudo cerrar el vivo');
    },
  };
}
