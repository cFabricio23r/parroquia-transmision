'use client';
import { useId } from 'react';

/** Grupo de botones excluyentes (aria-pressed), con su etiqueta visible. */
export function Segmentado<T extends string>({
  etiqueta,
  opciones,
  valor,
  onCambiar,
  deshabilitado,
  nota,
}: {
  etiqueta: string;
  opciones: { valor: T; texto: string }[];
  valor: T;
  onCambiar: (v: T) => void;
  /** Todos los botones quedan deshabilitados (por ejemplo, las esquinas con el diseño Minimal). */
  deshabilitado?: boolean;
  /** Una línea debajo de los botones que explica por qué. */
  nota?: string;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} aria-describedby={nota ? `${id}-nota` : undefined} className="pv-segmentado">
      <span id={id} className="pv-segmentado-etiqueta">
        {etiqueta}
      </span>
      <div className="pv-segmentado-fila">
        {opciones.map((o) => (
          <button
            key={o.valor}
            type="button"
            className="pv-segmento"
            aria-pressed={o.valor === valor}
            disabled={deshabilitado || undefined}
            onClick={() => onCambiar(o.valor)}
          >
            {o.texto}
          </button>
        ))}
      </div>
      {nota && (
        <span id={`${id}-nota`} className="pv-campo-ayuda">
          {nota}
        </span>
      )}
    </div>
  );
}
