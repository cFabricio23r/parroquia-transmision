'use client';
import { CampoTexto } from './CampoTexto';

/**
 * Imagen con su miniatura (96×72), el alt obligatorio y los botones «Cambiar» y «Elegir de la galería».
 * La etiqueta nombra al grupo: dentro hay varios controles.
 */
export function CampoImagen({
  id,
  etiqueta,
  opcional,
  src,
  textoVacio,
  alt,
  onAlt,
  onCambiar,
  onElegir,
  errorAlt,
  error,
  ocupado,
}: {
  id: string;
  etiqueta: string;
  opcional?: boolean;
  src?: string | null;
  textoVacio: string;
  alt: string;
  onAlt: (v: string) => void;
  onCambiar: () => void;
  onElegir?: () => void;
  errorAlt?: string;
  /** Error de la imagen (por ejemplo, de la subida), debajo del grupo. */
  error?: string;
  /** Subiendo: «Subiendo…» en lugar de los enlaces. */
  ocupado?: boolean;
}) {
  return (
    <div className="pv-imagen" role="group" aria-labelledby={`${id}-etiqueta`}>
      <span id={`${id}-etiqueta`} className="pv-campo-etiqueta">
        {etiqueta}
        {opcional && <span className="pv-opcional"> (opcional)</span>}
      </span>
      <div className="pv-imagen-fila">
        <div className="pv-miniatura">{src ? <img alt="" src={src} /> : textoVacio}</div>
        <div className="pv-imagen-columna">
          <CampoTexto
            id={`${id}-alt`}
            etiqueta="Descripción para lectores de pantalla (alt)"
            compacto
            value={alt}
            onChange={(e) => onAlt(e.target.value)}
            error={errorAlt}
          />
          {ocupado ? (
            <span className="pv-imagen-acciones pv-imagen-subiendo" role="status">
              Subiendo…
            </span>
          ) : (
            <span className="pv-imagen-acciones">
              <button type="button" className="pv-enlace" onClick={onCambiar}>
                Cambiar
              </button>
              {onElegir && (
                <button type="button" className="pv-enlace" onClick={onElegir}>
                  Elegir de la galería
                </button>
              )}
            </span>
          )}
        </div>
      </div>
      {error && (
        <span id={`${id}-error`} className="pv-campo-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
