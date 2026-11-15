'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/** El primer control con `aria-invalid="true"` dentro de `raiz`, en el orden del documento. */
export const SELECTOR_INVALIDO = '[aria-invalid="true"]';

/**
 * Le da el foco al primer campo inválido de `raiz`. CampoTexto, CampoClave y CampoSelect atan su error
 * con aria-describedby, así que el lector de pantalla lo lee al llegar. Devuelve si encontró alguno.
 */
export function enfocarPrimerInvalido(raiz: Pick<ParentNode, 'querySelector'> | null): boolean {
  const campo = raiz?.querySelector<HTMLElement>(SELECTOR_INVALIDO);
  if (!campo) return false;
  campo.focus();
  return true;
}

/**
 * Para formularios que validan al enviar (revisión fix2): `ref` va en el <form> (o la sección) y
 * `enfocarInvalido()` se llama junto con el setState de los errores; el foco se mueve después de que
 * React los pinta, cuando los campos ya tienen aria-invalid.
 */
export function useEnfocarInvalido<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [pedido, setPedido] = useState(0);
  useEffect(() => {
    if (pedido) enfocarPrimerInvalido(ref.current);
  }, [pedido]);
  const enfocarInvalido = useCallback(() => setPedido((n) => n + 1), []);
  return { ref, enfocarInvalido };
}
