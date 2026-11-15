'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { MENSAJES_ACCESO, type CodigoMensajeAcceso } from '../../lib/mensajes-acceso';

/**
 * Tarjeta de un mensaje de acceso (A5): punto de color, título, texto y una acción opcional.
 * `incrustado` la pone dentro de otra tarjeta (sin borde ni fondo). `enfocar` le da el foco al
 * montarse, para que el lector de pantalla la lea y el teclado siga desde ahí.
 */
export function MensajeEstado({
  codigo,
  accion,
  rol,
  incrustado,
  enfocar,
  id,
}: {
  codigo: CodigoMensajeAcceso;
  accion?: ReactNode;
  rol?: 'alert' | 'status';
  incrustado?: boolean;
  enfocar?: boolean;
  /** Para atarlo a un campo con aria-describedby. */
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (enfocar) ref.current?.focus();
  }, [enfocar, codigo]);
  const m = MENSAJES_ACCESO[codigo];
  return (
    <div ref={ref} id={id} className={incrustado ? 'pv-mensaje pv-mensaje--incrustado' : 'pv-mensaje'} role={rol} tabIndex={-1}>
      <div className="pv-mensaje-cabeza">
        <span className={`pv-mensaje-punto pv-mensaje-punto--${m.tono}`} aria-hidden="true" />
        <h2 className="pv-mensaje-titulo">{m.titulo}</h2>
      </div>
      <p className="pv-mensaje-texto">{m.texto}</p>
      {accion && <div className="pv-mensaje-accion">{accion}</div>}
    </div>
  );
}
