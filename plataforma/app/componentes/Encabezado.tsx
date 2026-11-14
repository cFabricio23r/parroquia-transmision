import Link from 'next/link';
import type { ReactNode } from 'react';
import { ALT_LOGO_PASTORAL, LOGO_PASTORAL } from '../../lib/marca';

export interface UsuarioEncabezado {
  etiqueta: string;
  inicial: string;
}

const SUBTITULO = 'Pastoral de Comunicaciones · Ciudad Arce';

/**
 * Franja azul de 64 px con el logo y «Parroquia en Vivo». Con `usuario`, a la derecha el nombre y el
 * avatar, que enlazan a Mi cuenta (Decisión 5). En las pantallas de acceso no hay usuario.
 */
export function Encabezado({
  subtitulo = SUBTITULO,
  usuario,
  enlaceInicio,
  variante = 'general',
  chip,
}: {
  subtitulo?: string;
  usuario?: UsuarioEncabezado;
  enlaceInicio?: boolean;
  variante?: 'general' | 'editor';
  chip?: ReactNode;
}) {
  const marca = (
    <>
      <img src={LOGO_PASTORAL} alt={ALT_LOGO_PASTORAL} className="pv-encabezado-logo" />
      <span className="pv-encabezado-titulos">
        <span className="pv-encabezado-titulo">Parroquia en Vivo</span>
        <span className="pv-encabezado-sub">{subtitulo}</span>
      </span>
    </>
  );
  return (
    <header className="pv-encabezado">
      {enlaceInicio ? (
        <Link href="/editor" className="pv-marca">
          {marca}
        </Link>
      ) : (
        <div className="pv-marca">{marca}</div>
      )}
      {usuario && (
        <div className={`pv-usuario-zona pv-usuario-zona--${variante}`}>
          {variante === 'editor' && chip}
          <Link href="/editor/cuenta" className={`pv-usuario pv-usuario--${variante}`} aria-label={`Mi cuenta: ${usuario.etiqueta}`}>
            <span className="pv-usuario-etiqueta">{usuario.etiqueta}</span>
            <span className="pv-avatar" aria-hidden="true">
              {usuario.inicial}
            </span>
          </Link>
        </div>
      )}
    </header>
  );
}
