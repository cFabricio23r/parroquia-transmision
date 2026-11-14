'use client';
// Manda el mensaje de la vista previa a un iframe (plan 4, Decisión 25): al cargar y 400 ms después de
// cada cambio del mensaje. Lo usan las miniaturas de F4; el panel de la vista previa tiene su propio
// envío porque además cambia de `src` sin volver a montar el iframe.
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { ESPERA_VISTA_PREVIA_MS, type MensajeVistaPrevia } from '../../../../lib/vista-previa';

/**
 * Devuelve el `onLoad` del iframe. El iframe puede terminar de cargar antes de que React conecte el
 * `onLoad` (la página llega del servidor): por eso al montar se mira si ya está cargado con su `src`.
 */
export function useEnvioAlMarco(ref: RefObject<HTMLIFrameElement | null>, mensaje: MensajeVistaPrevia, src: string): () => void {
  const cargado = useRef(false);
  const ultimo = useRef(mensaje);
  ultimo.current = mensaje;
  const enviar = useCallback(() => {
    if (!cargado.current) return;
    ref.current?.contentWindow?.postMessage(ultimo.current, location.origin);
  }, [ref]);
  const instantanea = JSON.stringify(mensaje);
  useEffect(() => {
    const t = setTimeout(enviar, ESPERA_VISTA_PREVIA_MS);
    return () => clearTimeout(t);
  }, [instantanea, enviar]);
  useEffect(() => {
    let doc: Document | null | undefined;
    try {
      doc = ref.current?.contentDocument;
    } catch {
      doc = null;
    }
    if (doc && doc.readyState === 'complete' && doc.location.href.endsWith(src)) {
      cargado.current = true;
      enviar();
    }
  }, [ref, src, enviar]);
  return useCallback(() => {
    cargado.current = true;
    enviar();
  }, [enviar]);
}
