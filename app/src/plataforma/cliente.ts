/**
 * Cliente de la plataforma: por ahora, solo pedir el enlace de contraseña.
 * La ruta `POST /editor/olvide/pedir` responde siempre 200 con el mismo mensaje
 * (no revela si el correo existe) y usa los límites de envío del editor.
 */
import { PLAZO_POR_DEFECTO_MS, leerJson, pedirConPlazo, type Resultado } from '../supabase/cliente';
import { normalizarOrigen } from './direcciones';

export interface ClientePlataforma {
  pedirEnlaceContrasena(correo: string): Promise<Resultado<{ mensaje: string }>>;
}

export function crearClientePlataforma(o: { origen: string; fetch?: typeof fetch; plazoMs?: number }): ClientePlataforma {
  const origen = normalizarOrigen(o.origen);
  if (!origen) throw new Error('Origen de la plataforma inválido.');
  const plazoMs = o.plazoMs ?? PLAZO_POR_DEFECTO_MS;
  const f = (...args: Parameters<typeof fetch>) => (o.fetch ?? fetch)(...args);

  return {
    async pedirEnlaceContrasena(correo) {
      const r = await pedirConPlazo(
        f,
        origen + '/editor/olvide/pedir',
        { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ correo }) },
        plazoMs,
      );
      if (r === null || r.estado >= 500) return { ok: false, error: { tipo: 'sin-conexion' } };
      const cuerpo = leerJson(r.texto) as { mensaje?: unknown } | undefined;
      if (r.estado === 429) return { ok: false, error: { tipo: 'muchos-intentos' } };
      if (r.estado === 200 && cuerpo && typeof cuerpo === 'object' && typeof cuerpo.mensaje === 'string') {
        return { ok: true, valor: { mensaje: cuerpo.mensaje } };
      }
      return { ok: false, error: { tipo: 'servidor', estado: r.estado } };
    },
  };
}
