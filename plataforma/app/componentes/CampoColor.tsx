'use client';
import { useRef } from 'react';

const RE_HEX = /^#[0-9a-fA-F]{6}$/;

/** Desde qué color abre el selector: el valor si es válido; si no, el último válido; si no, negro. */
export function valorInicialSelector(valor: string, ultimoValido: string | null): string {
  if (RE_HEX.test(valor)) return valor.toLowerCase();
  return (ultimoValido ?? '#000000').toLowerCase();
}

/**
 * Campo de color: la muestra (un botón) y el valor #rrggbb en un input de texto monoespaciado.
 * Un clic en la muestra o en el texto abre el selector del navegador (un input de color oculto);
 * con Tab se llega al texto sin abrirlo, para escribir o pegar el código.
 */
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
  const ultimoValido = useRef<string | null>(null);
  if (valido) ultimoValido.current = valor;
  const nativo = useRef<HTMLInputElement>(null);
  const nombreBoton = `Elegir ${etiqueta.toLowerCase()}`;

  const abrir = () => {
    const input = nativo.current;
    if (!input) return;
    input.value = valorInicialSelector(valor, ultimoValido.current);
    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
        return;
      }
    } catch {
      // Navegador sin showPicker o que lo rechaza: se cae al clic.
    }
    input.click();
  };

  return (
    <div className="pv-campo">
      <span id={`${id}-etiqueta`} className="pv-campo-etiqueta">
        {etiqueta}
      </span>
      <span className={error ? 'pv-color pv-color--error' : 'pv-color'}>
        <button type="button" className="pv-color-boton" aria-label={nombreBoton} onClick={abrir}>
          <span
            className={valido ? 'pv-color-muestra' : 'pv-color-muestra pv-color-muestra--vacia'}
            style={valido ? { background: valor } : undefined}
            aria-hidden="true"
          />
        </button>
        <input
          ref={nativo}
          type="color"
          className="pv-color-nativo"
          tabIndex={-1}
          aria-hidden="true"
          aria-label={nombreBoton}
          value={valorInicialSelector(valor, ultimoValido.current)}
          onChange={(e) => onCambiar(e.currentTarget.value)}
        />
        <input
          id={id}
          name={id}
          type="text"
          className="pv-color-input"
          spellCheck={false}
          autoComplete="off"
          value={valor}
          onClick={abrir}
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
    </div>
  );
}
