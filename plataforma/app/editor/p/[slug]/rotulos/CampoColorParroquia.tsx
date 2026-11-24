'use client';
// Color del rótulo elegido entre los de la parroquia (plan 4, Decisión 8): se ve como CampoColor
// (muestra de 24 px y el valor en monoespaciada), pero el control es un <select> nativo.
import type { OpcionColor } from '../../../../../lib/editor/rotulos';

const DEGRADADO = 'linear-gradient(135deg, #4b0f18, #8a1c2b)';

export function CampoColorParroquia({
  id,
  etiqueta,
  opciones,
  valor,
  onCambiar,
  error,
  muestraSinValor,
  deshabilitado,
  nota,
}: {
  id: string;
  etiqueta: string;
  opciones: OpcionColor[];
  valor: string;
  onCambiar: (v: string) => void;
  error?: string | null;
  /** La muestra de «Como viene»: un hex, o el degradado si no se da. */
  muestraSinValor?: string | null;
  /** El select queda deshabilitado (por ejemplo, «Fondo del rótulo» con el diseño Minimal). */
  deshabilitado?: boolean;
  /** Una línea debajo del campo que explica por qué. */
  nota?: string;
}) {
  const describe = [error ? `${id}-error` : null, nota ? `${id}-nota` : null].filter(Boolean).join(' ') || undefined;
  const elegida = opciones.find((o) => o.valor === valor);
  const fondo = elegida?.hex ?? (valor === '' && muestraSinValor ? muestraSinValor : DEGRADADO);
  return (
    <label className="pv-campo">
      <span id={`${id}-etiqueta`} className="pv-campo-etiqueta">
        {etiqueta}
      </span>
      <span className={error ? 'pv-color pv-color--error' : 'pv-color'}>
        <span className="pv-color-muestra pv-color-muestra--borde" style={{ background: fondo }} aria-hidden="true" />
        <select
          id={id}
          name={id}
          className="pv-color-select"
          value={valor}
          onChange={(e) => onCambiar(e.target.value)}
          aria-labelledby={`${id}-etiqueta`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describe}
          disabled={deshabilitado || undefined}
        >
          {opciones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.texto}
            </option>
          ))}
        </select>
      </span>
      {nota && (
        <span id={`${id}-nota`} className="pv-campo-ayuda">
          {nota}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className="pv-campo-error">
          {error}
        </span>
      )}
    </label>
  );
}
