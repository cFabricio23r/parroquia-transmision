import type { ReactNode, SelectHTMLAttributes } from 'react';
import { describirCon } from './CampoTexto';

export type PropsCampoSelect = {
  id: string;
  etiqueta: ReactNode;
  ayuda?: string;
  children: ReactNode;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'>;

export function CampoSelect({ id, etiqueta, ayuda, children, className, ...resto }: PropsCampoSelect) {
  return (
    <label className="pv-campo">
      <span className="pv-campo-etiqueta">{etiqueta}</span>
      <select
        id={id}
        name={id}
        className={['pv-campo-select', className].filter(Boolean).join(' ')}
        aria-describedby={describirCon(id, ayuda)}
        {...resto}
      >
        {children}
      </select>
      {ayuda && (
        <span id={`${id}-ayuda`} className="pv-campo-ayuda">
          {ayuda}
        </span>
      )}
    </label>
  );
}
