import type { ReactNode } from 'react';

/** Título (h1 24/800) y texto de ayuda de una sección del editor. */
export function CabezaSeccion({ titulo, texto, children }: { titulo: ReactNode; texto: ReactNode; children?: ReactNode }) {
  return (
    <div className="pv-seccion-cabeza">
      <h1 className="pv-seccion-titulo">{titulo}</h1>
      <p className="pv-seccion-texto">{texto}</p>
      {children}
    </div>
  );
}

export const TEXTO_PROXIMA_ENTREGA = 'Esta sección llega en la próxima entrega del editor.';
