'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { MENSAJES_ACCESO, type CodigoMensajeAcceso } from '../../lib/mensajes-acceso';

/**
 * Tarjeta de un mensaje de acceso (A5): punto de color, título, texto y una acción opcional.
 * `incrustado` la pone dentro de otra tarjeta (sin borde ni fondo). `enfocar` le da el foco al
 * montarse, para que el lector de pantalla la lea y el teclado siga desde ahí. `nivel={1}` la usa
 * cuando el mensaje es toda la página (invitación vencida, enlace vencido, sin parroquia): el título
 * pasa a ser el único h1, con el mismo estilo.
 */
export function MensajeEstado({
  codigo,
  accion,
  rol,
  incrustado,
  enfocar,
  id,
  nivel = 2,
}: {
  codigo: CodigoMensajeAcceso;
  accion?: ReactNode;
  rol?: 'alert' | 'status';
  incrustado?: boolean;
  enfocar?: boolean;
  /** Para atarlo a un campo con aria-describedby. */
  id?: string;
  /** 1 cuando el mensaje es la página entera (su título es el h1); 2 dentro de otra pantalla. */
  nivel?: 1 | 2;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (enfocar) ref.current?.focus();
  }, [enfocar, codigo]);
  const m = MENSAJES_ACCESO[codigo];
  const Titulo = nivel === 1 ? 'h1' : 'h2';
  return (
    <div ref={ref} id={id} className={incrustado ? 'pv-mensaje pv-mensaje--incrustado' : 'pv-mensaje'} role={rol} tabIndex={-1}>
      <div className="pv-mensaje-cabeza">
        <span className={`pv-mensaje-punto pv-mensaje-punto--${m.tono}`} aria-hidden="true" />
        <Titulo className="pv-mensaje-titulo">{m.titulo}</Titulo>
      </div>
      <p className="pv-mensaje-texto">{m.texto}</p>
      {accion && <div className="pv-mensaje-accion">{accion}</div>}
    </div>
  );
}
