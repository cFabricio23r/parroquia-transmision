import Link from 'next/link';
import { Fragment } from 'react';

/** Migas de F5 y F8: «Pantallas › Inicio». El último ítem es la página actual. */
export function Migas({ items }: { items: { texto: string; href?: string }[] }) {
  return (
    <nav aria-label="Migas" className="pv-migas">
      {items.map((it, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden="true"> › </span>}
          {it.href && i < items.length - 1 ? (
            <Link href={it.href} className="pv-migas-enlace">
              {it.texto}
            </Link>
          ) : (
            <b className="pv-migas-actual" aria-current="page">
              {it.texto}
            </b>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
