import type { ReactNode } from 'react';

/**
 * Caja ámbar «Revisar» (spec, sección 8): lo que se puede publicar pero conviene mirar. Cada
 * problema con su título y qué hacer. Sin problemas no se dibuja.
 */
export function CajaRevisar({ problemas, etiqueta = 'Para revisar' }: { problemas: { titulo: ReactNode; detalle?: ReactNode }[]; etiqueta?: string }) {
  if (!problemas.length) return null;
  return (
    <section className="pv-revisar" aria-label={etiqueta}>
      <ul className="pv-revisar-lista">
        {problemas.map((p, i) => (
          <li key={i}>
            <strong className="pv-revisar-titulo">{p.titulo}</strong>
            {p.detalle && <span className="pv-revisar-detalle">{p.detalle}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
