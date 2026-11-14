export type Estado = 'listo' | 'revisar' | 'falta' | 'opcional';

export const TEXTO_ESTADO: Record<Estado, string> = {
  listo: 'Listo',
  revisar: 'Revisar',
  falta: 'Falta algo',
  opcional: 'Opcional',
};

/** Punto de color de 9 px con su texto para lectores de pantalla (el color solo no basta). */
export function PuntoEstado({ estado }: { estado: Estado }) {
  const texto = TEXTO_ESTADO[estado];
  return (
    <>
      <span className={`pv-punto pv-punto--${estado}`} title={texto} aria-hidden="true" />
      <span className="pv-solo-lectores">{texto}</span>
    </>
  );
}
