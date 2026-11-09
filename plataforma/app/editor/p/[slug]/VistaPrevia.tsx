'use client';
// Vista previa con las pantallas reales: dos iframes de /<slug>/pantalla.html (mismo origen que el editor)
// que reciben el borrador por postMessage. Nada sale a la red: las imágenes van como URLs firmadas.
import { useCallback, useEffect, useRef } from 'react';
import { prepararVistaPrevia } from '../../../../lib/vista-previa';

export const ESPERA_MS = 400;
const ANCHO = 480;
const ALTO = 270;
const PANTALLAS = ['inicio', 'portada'] as const;

export function VistaPrevia(props: { slug: string; borrador: object; urls: Record<string, string> }) {
  const marcos = useRef<Partial<Record<(typeof PANTALLAS)[number], HTMLIFrameElement | null>>>({});
  const cargados = useRef(new Set<string>());
  // Siempre lo último que escribió la persona, para el envío al cargar cada iframe.
  const ultimo = useRef({ borrador: props.borrador, urls: props.urls });
  ultimo.current = { borrador: props.borrador, urls: props.urls };

  const enviar = useCallback((nombre?: (typeof PANTALLAS)[number]) => {
    const config = prepararVistaPrevia(ultimo.current.borrador, ultimo.current.urls);
    for (const n of nombre ? [nombre] : PANTALLAS) {
      if (cargados.current.has(n)) marcos.current[n]?.contentWindow?.postMessage({ tipo: 'pev-vista-previa', config }, location.origin);
    }
  }, []);

  // En cada cambio del formulario, con espera de 400 ms para no mandar una letra por mensaje.
  const instantanea = JSON.stringify([props.borrador, props.urls]);
  useEffect(() => {
    const t = setTimeout(() => enviar(), ESPERA_MS);
    return () => clearTimeout(t);
  }, [instantanea, enviar]);

  // Si un iframe terminó de cargar antes de que React atara onLoad (hidratación), se cuenta como cargado.
  useEffect(() => {
    for (const n of PANTALLAS) {
      const doc = marcos.current[n]?.contentDocument;
      if (doc && doc.readyState === 'complete' && doc.location.pathname.endsWith('/pantalla.html')) cargados.current.add(n);
    }
  }, []);

  return (
    <section className="vista-previa" aria-labelledby="vista-previa-titulo">
      <h2 id="vista-previa-titulo">Así se ve</h2>
      <div className="vista-previa-marcos">
        {PANTALLAS.map((n) => (
          <iframe
            key={n}
            ref={(el) => {
              marcos.current[n] = el;
            }}
            title={`Vista previa: ${n}`}
            src={`/${props.slug}/pantalla.html?tipo=${n}&vista-previa=1`}
            width={ANCHO}
            height={ALTO}
            onLoad={() => {
              cargados.current.add(n);
              enviar(n);
            }}
          />
        ))}
      </div>
    </section>
  );
}
