'use client';
// Miniatura de una pantalla en F4 (plan 4, Decisión 25): la pantalla real con el borrador, en un
// iframe de 16:9 que no recibe foco ni clics. Recibe el mismo mensaje que la vista previa de F5.
import { useMemo, useRef } from 'react';
import { vistaPreviaDeVista } from '../../../../../lib/editor/secciones';
import { configParaVistaPrevia, mensajeVistaPrevia, srcVistaPrevia, tiposParaVistaPrevia } from '../../../../../lib/vista-previa';
import { useBorrador } from '../ProveedorBorrador';
import { useEnvioAlMarco } from '../useEnvioAlMarco';

export function MiniaturaPantalla({ vista }: { vista: string }) {
  const { datos, borrador, urls, tipoVistaPrevia } = useBorrador();
  const vp = vistaPreviaDeVista(vista);
  const tipos = useMemo(() => tiposParaVistaPrevia(borrador, datos.tiposComunes), [borrador, datos.tiposComunes]);
  const claves = useMemo(() => datos.tiposComunes.map((t) => t.clave), [datos.tiposComunes]);
  const elegido = tipoVistaPrevia && tipos.some((t) => t.clave === tipoVistaPrevia) ? tipoVistaPrevia : null;
  const tipo = vp?.conSelectorTipo ? (elegido ?? tipos[0]?.clave ?? null) : (vp?.tipoFijo ?? tipos[0]?.clave ?? null);
  const mensaje = mensajeVistaPrevia(configParaVistaPrevia(borrador, tipo ?? undefined, claves), urls, tipo, vp?.estado);
  const marco = useRef<HTMLIFrameElement | null>(null);
  const src = vp ? srcVistaPrevia(datos.slug, vp) : '';
  const alCargar = useEnvioAlMarco(marco, mensaje, src);
  if (!vp) return null;
  return (
    <iframe
      ref={marco}
      className={vista === 'envivo' ? 'pv-pantalla-miniatura pv-pantalla-miniatura--envivo' : 'pv-pantalla-miniatura'}
      src={src}
      title={`Miniatura: ${vista}`}
      loading="lazy"
      tabIndex={-1}
      aria-hidden="true"
      onLoad={alCargar}
    />
  );
}
