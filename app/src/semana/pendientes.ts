// Combina la semana bajada con los cambios de la app que todavía no se subieron (plan 3b,
// Decisión 10): gana lo último que se guardó.
import type { Pendiente } from './almacen';
import type { ItemSemana } from './nucleo';

export type ItemApp = ItemSemana & { pendiente: boolean; rechazado: boolean };

function ms(iso: string | null): number {
  if (!iso) return Number.NaN;
  return Date.parse(iso);
}

/**
 * Cada ítem con su pendiente (por `clave`):
 * - rechazado → los datos del servidor, con `rechazado: true`;
 * - el servidor guardó después (`actualizadoEn` > `editadoEn`) → ganó la web: sale el del
 *   servidor y la clave va a `perdidos`;
 * - si no → la hora, el tipo y los datos del pendiente, con `pendiente: true`.
 */
export function combinarConPendientes(
  items: readonly ItemSemana[],
  pendientes: readonly Pendiente[],
): { items: ItemApp[]; perdidos: string[] } {
  const porClave = new Map(pendientes.map((p) => [p.clave, p] as const));
  const perdidos: string[] = [];
  const salida = items.map((it): ItemApp => {
    const p = porClave.get(it.clave);
    if (!p) return { ...it, pendiente: false, rechazado: false };
    if (p.rechazado) return { ...it, pendiente: false, rechazado: true };
    if (ms(it.actualizadoEn) > ms(p.editadoEn)) {
      perdidos.push(it.clave);
      return { ...it, pendiente: false, rechazado: false };
    }
    return { ...it, hora: p.hora, tipo: p.tipo, datos: { ...p.datos }, editada: true, pendiente: true, rechazado: false };
  });
  return { items: salida, perdidos };
}
