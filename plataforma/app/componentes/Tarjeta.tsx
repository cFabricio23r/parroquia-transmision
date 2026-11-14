import type { ReactNode } from 'react';

/**
 * Tarjeta blanca con borde. `relleno` 22 o 26; sin relleno (0) es para listas: las filas llevan
 * su propio relleno y la tarjeta recorta con overflow:hidden.
 */
export function Tarjeta({
  como = 'div',
  etiqueta,
  relleno = 0,
  className,
  children,
}: {
  como?: 'div' | 'section';
  etiqueta?: string;
  relleno?: 0 | 22 | 26;
  className?: string;
  children: ReactNode;
}) {
  const Elemento = como;
  const clases = ['pv-tarjeta', `pv-tarjeta--${relleno}`, className].filter(Boolean).join(' ');
  return (
    <Elemento aria-label={etiqueta} className={clases}>
      {children}
    </Elemento>
  );
}
