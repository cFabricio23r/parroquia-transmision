'use client';
// «Ver la última versión publicada» (F1, Decisión 22): la pantalla de Inicio con el config de esa
// versión y sus imágenes públicas del bucket `publicado`, en un iframe de 448 × 252.
import { useRef } from 'react';
import { mensajeVistaPrevia, srcVistaPrevia } from '../../../../lib/vista-previa';
import { Boton } from '../../../componentes/Boton';
import { Dialogo } from '../../../componentes/Dialogo';

export function DialogoVersionPublicada({
  abierto,
  onCerrar,
  slug,
  numero,
  config,
  urls,
}: {
  abierto: boolean;
  onCerrar: () => void;
  slug: string;
  numero: number;
  config: Record<string, unknown>;
  urls: Record<string, string>;
}) {
  const marco = useRef<HTMLIFrameElement | null>(null);
  return (
    <Dialogo abierto={abierto} titulo={`Versión ${numero} publicada`} onCerrar={onCerrar} ancho={520}>
      {abierto && (
        <iframe
          ref={marco}
          className="pv-version-marco"
          title={`Versión ${numero} publicada: inicio`}
          src={srcVistaPrevia(slug, { pagina: 'pantalla', vista: 'inicio', titulo: '', conSelectorTipo: false })}
          width={448}
          height={252}
          // Solo para mirar: sin foco dentro, así Esc y el teclado siguen en el diálogo.
          inert
          onLoad={() => marco.current?.contentWindow?.postMessage(mensajeVistaPrevia(config, urls, null), location.origin)}
        />
      )}
      <div className="pv-dialogo-acciones">
        <Boton variante="secundario" onClick={onCerrar}>
          Cerrar
        </Boton>
      </div>
    </Dialogo>
  );
}
