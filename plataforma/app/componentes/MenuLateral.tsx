import Link from 'next/link';
import type { ReactNode } from 'react';
import { PuntoEstado, type Estado } from './PuntoEstado';

export interface ItemMenu {
  href: string;
  texto: string;
  estado?: Estado;
  actual?: boolean;
}

/** Menú lateral del editor (236 px) con el punto de estado de cada sección. */
export function MenuLateral({ etiqueta, items, pie }: { etiqueta?: string; items: ItemMenu[]; pie?: ReactNode }) {
  return (
    <nav aria-label={etiqueta ?? 'Secciones del editor'} className="pv-menu">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className="pv-menu-item" aria-current={i.actual ? 'page' : undefined}>
          {i.texto}
          {i.estado && <PuntoEstado estado={i.estado} />}
        </Link>
      ))}
      {pie && <div className="pv-menu-pie">{pie}</div>}
    </nav>
  );
}
