'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * Diálogo modal nativo (dialog + showModal): atrapa el foco, Esc lo cierra (onCancel llama a onCerrar)
 * y al cerrarse el foco vuelve a donde estaba. Las acciones van en .pv-dialogo-acciones.
 */
export function Dialogo({
  abierto,
  titulo,
  onCerrar,
  ancho,
  children,
}: {
  abierto: boolean;
  titulo: string;
  onCerrar: () => void;
  /** Ancho total en px (con el relleno de 28); sin él, 500. */
  ancho?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const previo = useRef<HTMLElement | null>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) {
      previo.current = document.activeElement as HTMLElement | null;
      d.showModal();
    } else if (!abierto && d.open) {
      d.close();
    }
  }, [abierto]);
  return (
    <dialog
      ref={ref}
      className="pv-dialogo"
      aria-labelledby={id}
      style={ancho ? { width: `min(${ancho}px, 100% - 32px)` } : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onCerrar();
      }}
      onClose={() => {
        previo.current?.focus();
        previo.current = null;
      }}
    >
      <h2 id={id} className="pv-dialogo-titulo">
        {titulo}
      </h2>
      {children}
    </dialog>
  );
}
