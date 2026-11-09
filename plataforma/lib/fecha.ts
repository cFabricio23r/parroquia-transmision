// Las fechas se muestran en la hora de la parroquia, no en la del servidor (en Vercel es UTC).
// El Salvador no tiene horario de verano: siempre UTC-6.
export const ZONA_HORARIA = 'America/El_Salvador';

/** «14/1/2026, 21:30:00» (es, hora de El Salvador). Con `conHora` en false, solo la fecha. */
export function formatearFecha(iso: string, conHora = true): string {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return '—';
  return conHora ? f.toLocaleString('es', { timeZone: ZONA_HORARIA }) : f.toLocaleDateString('es', { timeZone: ZONA_HORARIA });
}
