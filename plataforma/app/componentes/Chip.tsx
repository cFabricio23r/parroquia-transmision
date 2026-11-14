import type { ReactNode } from 'react';

export type TonoChip = 'verde' | 'ambar' | 'gris' | 'azul';

/** Etiqueta de estado («Publicada · v4», «Borrador», «Coordinador»…). */
export function Chip({ tono, children }: { tono: TonoChip; children: ReactNode }) {
  return <span className={`pv-chip pv-chip--${tono}`}>{children}</span>;
}
