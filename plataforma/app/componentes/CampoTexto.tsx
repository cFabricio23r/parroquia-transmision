import type { InputHTMLAttributes, ReactNode } from 'react';

export type PropsCampoTexto = {
  id: string;
  etiqueta: ReactNode;
  ayuda?: string;
  error?: string;
  /** Variante de 40 px para campos dentro de otros controles (alt de una imagen). */
  compacto?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>;

/** ids de ayuda y error presentes, para aria-describedby. */
export function describirCon(id: string, ayuda?: string, error?: string): string | undefined {
  return [ayuda && `${id}-ayuda`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
}

/** Campo de texto: el <label> envuelve la etiqueta, el input, la ayuda y el error. */
export function CampoTexto({ id, etiqueta, ayuda, error, compacto, className, ...resto }: PropsCampoTexto) {
  return (
    <label className={compacto ? 'pv-campo pv-campo--compacto' : 'pv-campo'}>
      <span className="pv-campo-etiqueta">{etiqueta}</span>
      <input
        id={id}
        name={id}
        className={['pv-campo-control', className].filter(Boolean).join(' ')}
        aria-describedby={describirCon(id, ayuda, error)}
        aria-invalid={error ? true : undefined}
        {...resto}
      />
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
