'use client';
// Piezas del editor y la administración viejos (los reemplazan los planes 3 y 5).
import { useEffect, useRef } from 'react';

/** Resumen de errores: role="alert" y recibe el foco al aparecer. */
export function Resumen({ mensaje }: { mensaje?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (mensaje) ref.current?.focus();
  }, [mensaje]);
  if (!mensaje) return null;
  return (
    <div ref={ref} role="alert" tabIndex={-1} className="resumen-error">
      {mensaje}
    </div>
  );
}

export function Campo(props: { id: string; etiqueta: string; tipo: string; autoComplete: string; ayuda?: string; error?: string }) {
  const ayudaId = props.ayuda ? `${props.id}-ayuda` : undefined;
  const errorId = props.error ? `${props.id}-error` : undefined;
  return (
    <div className="campo">
      <label htmlFor={props.id}>{props.etiqueta}</label>
      <input
        id={props.id}
        name={props.id}
        type={props.tipo}
        autoComplete={props.autoComplete}
        required
        aria-invalid={props.error ? true : undefined}
        aria-describedby={[ayudaId, errorId].filter(Boolean).join(' ') || undefined}
      />
      {props.ayuda && (
        <p id={ayudaId} className="ayuda">
          {props.ayuda}
        </p>
      )}
      {props.error && (
        <p id={errorId} className="error-campo">
          {props.error}
        </p>
      )}
    </div>
  );
}
