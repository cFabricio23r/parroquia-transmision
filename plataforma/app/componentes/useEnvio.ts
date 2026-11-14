'use client';
import { unstable_rethrow } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { enviarUnaVez, type ResultadoEnvio } from '../../lib/envio';

/**
 * `ocupado` va al Boton como `ocupado` (aria-disabled, no `disabled`: el foco se queda en el botón).
 * `enviar(accion)` ignora un segundo envío mientras espera y devuelve `{ tipo: 'fallo' }` si la acción falla.
 */
export function useEnvio() {
  const cerrojo = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  const enviar = useCallback(<T,>(accion: () => Promise<T>): Promise<ResultadoEnvio<T>> => enviarUnaVez(cerrojo, setOcupado, accion, unstable_rethrow), []);
  return { ocupado, enviar };
}
