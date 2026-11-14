import type { ReactNode } from 'react';

export interface ColumnaTabla {
  titulo: string;
  ancho: string;
}

/**
 * Tabla en grilla (D1): cada fila es una grilla con los mismos anchos. Semántica de tabla con roles
 * (Decisión 22 del plan 2); los títulos se escriben en minúscula y el CSS los pone en mayúscula.
 */
export function Tabla({
  etiqueta,
  columnas,
  filas,
}: {
  etiqueta: string;
  columnas: ColumnaTabla[];
  filas: { clave: string; celdas: ReactNode[] }[];
}) {
  const grilla = { gridTemplateColumns: columnas.map((c) => c.ancho).join(' ') };
  return (
    <div role="table" aria-label={etiqueta} className="pv-tabla">
      <div role="row" className="pv-tabla-fila pv-tabla-cabecera" style={grilla}>
        {columnas.map((c, i) => (
          <span key={i} role="columnheader">
            {c.titulo}
          </span>
        ))}
      </div>
      {filas.map((f) => (
        <div key={f.clave} role="row" className="pv-tabla-fila" style={grilla}>
          {f.celdas.map((c, i) => (
            <span key={i} role="cell">
              {c}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
