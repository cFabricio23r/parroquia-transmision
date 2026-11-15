import type { ReactNode, SelectHTMLAttributes } from 'react';
import { describirCon } from './CampoTexto';

export type PropsCampoSelect = {
  id: string;
  etiqueta: ReactNode;
  ayuda?: string;
  error?: string;
  children: ReactNode;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'>;

export function CampoSelect({ id, etiqueta, ayuda, error, children, className, ...resto }: PropsCampoSelect) {
  return (
    <label className="pv-campo">
      <span id={`${id}-etiqueta`} className="pv-campo-etiqueta">{etiqueta}</span>
      <select
        id={id}
        name={id}
        className={['pv-campo-select', className].filter(Boolean).join(' ')}
        aria-labelledby={`${id}-etiqueta`}
        aria-describedby={describirCon(id, ayuda, error)}
        aria-invalid={error ? true : undefined}
        {...resto}
      >
        {children}
      </select>
      {ayuda && (
        <span id={`${id}-ayuda`} className="pv-campo-ayuda">
          {ayuda}
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
