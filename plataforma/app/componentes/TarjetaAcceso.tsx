import type { ReactNode } from 'react';

/** Tarjeta blanca de las pantallas de acceso: 440 o 480 px, separación entre bloques de 12, 14 o 18 px. */
export function TarjetaAcceso({ ancho = 440, separacion = 18, children }: { ancho?: 440 | 480; separacion?: 12 | 14 | 18; children: ReactNode }) {
  return <div className={`pv-tarjeta-acceso pv-tarjeta-acceso--${ancho} pv-tarjeta-acceso--sep-${separacion}`}>{children}</div>;
}
