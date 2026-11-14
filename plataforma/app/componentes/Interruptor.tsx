'use client';

/**
 * Interruptor de 48×28 con role="switch"; la zona de toque llega a 44 px. `bloqueado` lo deja con
 * aria-disabled (sigue recibiendo el foco, para leer por qué) y sin acción; `describidoPor` apunta a
 * una ayuda o a esa explicación.
 */
export function Interruptor({
  etiqueta,
  activo,
  onCambiar,
  deshabilitado,
  bloqueado,
  describidoPor,
}: {
  etiqueta: string;
  activo: boolean;
  onCambiar: (v: boolean) => void;
  deshabilitado?: boolean;
  bloqueado?: boolean;
  describidoPor?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      aria-disabled={bloqueado || undefined}
      aria-describedby={describidoPor}
      className="pv-interruptor"
      disabled={deshabilitado}
      onClick={() => {
        if (!bloqueado) onCambiar(!activo);
      }}
    >
      <span className="pv-interruptor-perilla" aria-hidden="true" />
    </button>
  );
}
