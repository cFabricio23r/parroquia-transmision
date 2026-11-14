'use client';

const RE_HEX = /^#[0-9a-fA-F]{6}$/;

/** Campo de color: muestra de 24 px y el valor #rrggbb en un input de texto monoespaciado. */
export function CampoColor({
  id,
  etiqueta,
  valor,
  onCambiar,
  error,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  onCambiar: (v: string) => void;
  error?: string;
}) {
  const valido = RE_HEX.test(valor);
  return (
    <label className="pv-campo">
      <span id={`${id}-etiqueta`} className="pv-campo-etiqueta">
        {etiqueta}
      </span>
      <span className={error ? 'pv-color pv-color--error' : 'pv-color'}>
        <span
          className={valido ? 'pv-color-muestra' : 'pv-color-muestra pv-color-muestra--vacia'}
          style={valido ? { background: valor } : undefined}
          aria-hidden="true"
        />
        <input
          id={id}
          name={id}
          type="text"
          className="pv-color-input"
          spellCheck={false}
          autoComplete="off"
          value={valor}
          onChange={(e) => onCambiar(e.target.value)}
          aria-labelledby={`${id}-etiqueta`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </span>
      {error && (
        <span id={`${id}-error`} className="pv-campo-error">
          {error}
        </span>
      )}
    </label>
  );
}
