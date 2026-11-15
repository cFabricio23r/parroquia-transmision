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
  /** 500 de contenido (por defecto, relleno 28) o 520 (relleno 26 y separación 14, como los diálogos de la Galería). */
  ancho?: 500 | 520;
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
      className={ancho === 520 ? 'pv-dialogo pv-dialogo--520' : 'pv-dialogo'}
      aria-labelledby={id}
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
