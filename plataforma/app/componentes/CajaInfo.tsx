import type { ReactNode } from 'react';

/** Caja azul clara de información. */
export function CajaInfo({ children }: { children: ReactNode }) {
  return <div className="pv-info">{children}</div>;
}
