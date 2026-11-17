// Zonas seguras (barras del sistema y recorte de la cámara), en dp. TypeScript puro, con tests (Tarea 9i).
import type { ZonasSeguras } from '../../modules/transmisor/src/TransmisorModule';

// Menos de medio dp es redondeo de la densidad, no un cambio de barra.
const TOLERANCIA = 0.5;

/** true si las dos zonas son iguales en los cuatro lados. */
export function mismasZonas(a: ZonasSeguras, b: ZonasSeguras): boolean {
  return (
    Math.abs(a.top - b.top) < TOLERANCIA &&
    Math.abs(a.bottom - b.bottom) < TOLERANCIA &&
    Math.abs(a.left - b.left) < TOLERANCIA &&
    Math.abs(a.right - b.right) < TOLERANCIA
  );
}

/** true si `z` trae los cuatro lados como números. */
export function zonasValidas(z: unknown): z is ZonasSeguras {
  if (!z || typeof z !== 'object') return false;
  const o = z as Record<string, unknown>;
  return ['top', 'bottom', 'left', 'right'].every((k) => typeof o[k] === 'number' && Number.isFinite(o[k]));
}
