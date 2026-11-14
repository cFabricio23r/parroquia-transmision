'use client';
import { CabezaSeccion } from './CabezaSeccion';
import { useBorrador } from './ProveedorBorrador';

/** F1 · Resumen (se completa en la Tarea 11). */
export function SeccionResumen() {
  const { borrador, datos } = useBorrador();
  const nombre = (typeof borrador.nombre === 'string' && borrador.nombre.trim()) || datos.nombreParroquia;
  return <CabezaSeccion titulo={nombre} texto="Así va la configuración. Cada parte se puede dejar como viene y cambiarla después." />;
}
