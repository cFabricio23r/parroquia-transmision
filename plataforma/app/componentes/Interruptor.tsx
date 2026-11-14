'use client';

/** Interruptor de 48×28 con role="switch"; la zona de toque llega a 44 px. */
export function Interruptor({
  etiqueta,
  activo,
  onCambiar,
  deshabilitado,
}: {
  etiqueta: string;
  activo: boolean;
  onCambiar: (v: boolean) => void;
  deshabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      className="pv-interruptor"
      disabled={deshabilitado}
      onClick={() => onCambiar(!activo)}
    >
      <span className="pv-interruptor-perilla" aria-hidden="true" />
    </button>
  );
}
