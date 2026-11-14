'use client';
import { useId } from 'react';

/** Grupo de botones excluyentes (aria-pressed), con su etiqueta visible. */
export function Segmentado<T extends string>({
  etiqueta,
  opciones,
  valor,
  onCambiar,
}: {
  etiqueta: string;
  opciones: { valor: T; texto: string }[];
  valor: T;
  onCambiar: (v: T) => void;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="pv-segmentado">
      <span id={id} className="pv-segmentado-etiqueta">
        {etiqueta}
      </span>
      <div className="pv-segmentado-fila">
        {opciones.map((o) => (
          <button key={o.valor} type="button" className="pv-segmento" aria-pressed={o.valor === valor} onClick={() => onCambiar(o.valor)}>
            {o.texto}
          </button>
        ))}
      </div>
    </div>
  );
}
