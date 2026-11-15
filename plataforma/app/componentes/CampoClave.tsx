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
  /** Inválida sin texto de error propio: el motivo está en otro lado (`describidaPor`, p. ej. el mensaje A5). */
  invalida?: boolean;
  /** Id extra para aria-describedby (el mensaje que explica por qué no sirve). */
  describidaPor?: string;
}

/**
 * Contraseña con «Mostrar contraseña» (Decisión 3: el texto no cambia; el estado lo dice aria-pressed).
 * Como en el artboard, el error va debajo del botón.
 */
export function CampoClave({ id, etiqueta, autoComplete, error, valor, onCambio, requerido = true, invalida, describidaPor }: PropsCampoClave) {
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
          aria-describedby={[describirCon(id, undefined, error), describidaPor].filter(Boolean).join(' ') || undefined}
          aria-invalid={error || invalida ? true : undefined}
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
