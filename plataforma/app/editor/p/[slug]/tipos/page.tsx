import { CabezaSeccion, TEXTO_PROXIMA_ENTREGA } from '../CabezaSeccion';

export const metadata = { title: 'Tipos de transmisión · Parroquia en Vivo' };

/** Página provisional (Decisión 17 del plan 3): la reemplaza el plan 4. */
export default function Pagina() {
  return <CabezaSeccion titulo="Tipos de transmisión" texto={TEXTO_PROXIMA_ENTREGA} />;
}
