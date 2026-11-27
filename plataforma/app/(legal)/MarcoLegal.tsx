import type { ReactNode } from 'react';
import { Encabezado } from '../componentes/Encabezado';
import { ACTUALIZADO, CONTACTO, PAGINAS_LEGALES } from '../../lib/legal';

/** Marco de las páginas legales: encabezado, título, fecha, contenido, contacto y enlaces a las otras. */
export function MarcoLegal({ ruta, titulo, children }: { ruta: string; titulo: string; children: ReactNode }) {
  return (
    <>
      <Encabezado />
      <main className="pv-legal">
        <h1>{titulo}</h1>
        <p className="pv-legal-fecha">Última actualización: {ACTUALIZADO}</p>
        {children}
        <h2>Contacto</h2>
        <p>
          Para cualquier duda o pedido, envíanos un mensaje a <a href={CONTACTO.href}>{CONTACTO.texto}</a>.
        </p>
        <nav aria-label="Otras páginas legales" className="pv-legal-nav">
          {PAGINAS_LEGALES.filter((p) => p.ruta !== ruta).map((p) => (
            <a key={p.ruta} href={p.ruta}>
              {p.titulo}
            </a>
          ))}
        </nav>
      </main>
    </>
  );
}
