import type { ReactNode } from 'react';
import { Encabezado } from './Encabezado';

/** Pantallas de acceso (A1–A5): encabezado sin usuario y la tarjeta centrada. */
export function MarcoAcceso({ children }: { children: ReactNode }) {
  return (
    <>
      <Encabezado />
      <main className="pv-acceso">{children}</main>
    </>
  );
}
