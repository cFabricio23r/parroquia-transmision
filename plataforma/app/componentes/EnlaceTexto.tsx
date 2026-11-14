import Link from 'next/link';
import type { ReactNode } from 'react';

/** Enlace de texto en azul, 700, subrayado. La clase pv-enlace también sirve para un <button>. */
export function EnlaceTexto({ href, children, tamano = 14 }: { href: string; children: ReactNode; tamano?: 12 | 14 }) {
  return (
    <Link href={href} className={tamano === 12 ? 'pv-enlace pv-enlace--12' : 'pv-enlace'}>
      {children}
    </Link>
  );
}
