import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type VarianteBoton = 'primario' | 'secundario' | 'peligro';

export type PropsBoton = {
  variante?: VarianteBoton;
  /** 40 px visibles (botones de fila); la zona de toque sigue en 44 px. */
  compacto?: boolean;
  anchoCompleto?: boolean;
  /** Con href se dibuja un enlace (next/link) con aspecto de botón. */
  href?: string;
  /**
   * Esperando la respuesta: aria-disabled en vez de `disabled`, para que el foco no se caiga al
   * <body>. Quien lo usa ignora los envíos repetidos (useEnvio).
   */
  ocupado?: boolean;
  /** Solo con href: dónde abrir el enlace (por ejemplo `_blank` para «Entrar de nuevo» en otra pestaña). */
  target?: string;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function clasesBoton(variante: VarianteBoton = 'primario', compacto?: boolean, anchoCompleto?: boolean, extra?: string): string {
  return ['pv-boton', `pv-boton--${variante}`, compacto && 'pv-boton--compacto', anchoCompleto && 'pv-boton--ancho', extra]
    .filter(Boolean)
    .join(' ');
}

export function Boton({ variante = 'primario', compacto, anchoCompleto, href, ocupado, target, children, type, className, ...resto }: PropsBoton) {
  const clases = clasesBoton(variante, compacto, anchoCompleto, className);
  if (href) {
    const { 'aria-label': etiqueta, id, title } = resto;
    return (
      <Link
        href={href}
        className={clases}
        aria-label={etiqueta}
        id={id}
        title={title}
        target={target}
        rel={target === '_blank' ? 'noopener' : undefined}
      >
        {children}
      </Link>
    );
  }
  return (
    <button type={type ?? 'button'} className={clases} aria-disabled={ocupado || undefined} {...resto}>
      {children}
    </button>
  );
}
