import { formatearRazon, MIN_CONTRASTE } from '../../lib/contraste';

/**
 * «Texto blanco sobre principal: 8,9:1 ✓». Bajo el mínimo: ✗ en ámbar si solo avisa, o con el estilo
 * de peligro si impide publicar (Decisión 23 del plan 2).
 */
export function PastillaContraste({
  etiqueta,
  razon,
  minimo = MIN_CONTRASTE,
  bloquea,
}: {
  etiqueta: string;
  razon: number;
  minimo?: number;
  bloquea: boolean;
}) {
  const pasa = razon >= minimo;
  const clase = pasa ? 'pv-chip pv-chip--verde' : bloquea ? 'pv-chip pv-chip--bloquea' : 'pv-chip pv-chip--ambar';
  return <span className={clase}>{`${etiqueta}: ${formatearRazon(razon)} ${pasa ? '✓' : '✗'}`}</span>;
}
