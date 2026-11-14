'use client';
import { useState } from 'react';
import { describirCon } from './CampoTexto';

export interface PropsCampoClave {
  id: string;
  etiqueta: string;
  autoComplete: 'current-password' | 'new-password';
  error?: string;
  /** Controlado: con `valor`, el padre guarda lo escrito (para la lista de requisitos). */
  valor?: string;
  onCambio?: (v: string) => void;
  requerido?: boolean;
}

/**
 * Contraseña con «Mostrar contraseña» (Decisión 3: el texto no cambia; el estado lo dice aria-pressed).
 * Como en el artboard, el error va debajo del botón.
 */
export function CampoClave({ id, etiqueta, autoComplete, error, valor, onCambio, requerido = true }: PropsCampoClave) {
  const [visible, setVisible] = useState(false);
  const controlado = valor !== undefined;
  return (
    <div className="pv-campo-clave">
      <label className="pv-campo">
        <span className="pv-campo-etiqueta">{etiqueta}</span>
        <input
          id={id}
          name={id}
          className="pv-campo-control"
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required={requerido}
          aria-describedby={describirCon(id, undefined, error)}
          aria-invalid={error ? true : undefined}
          {...(controlado ? { value: valor, onChange: (e) => onCambio?.(e.target.value) } : { onChange: (e) => onCambio?.(e.target.value) })}
        />
      </label>
      <button type="button" className="pv-enlace pv-enlace--12 pv-mostrar-clave" aria-pressed={visible} aria-controls={id} onClick={() => setVisible((v) => !v)}>
        Mostrar contraseña
      </button>
      {error && (
        <span id={`${id}-error`} className="pv-campo-error">
          {error}
        </span>
      )}
    </div>
  );
}
