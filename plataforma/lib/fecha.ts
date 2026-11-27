// Las fechas se muestran en la hora de la parroquia, no en la del servidor (en Vercel es UTC).
// El Salvador no tiene horario de verano: siempre UTC-6.
export const ZONA_HORARIA = 'America/El_Salvador';

/** «14/1/2026, 21:30:00» (es, hora de El Salvador). Con `conHora` en false, solo la fecha. */
export function formatearFecha(iso: string, conHora = true): string {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return '—';
  return conHora ? f.toLocaleString('es', { timeZone: ZONA_HORARIA }) : f.toLocaleDateString('es', { timeZone: ZONA_HORARIA });
}

/** «14 de noviembre» (es, hora de El Salvador). Inválida: «—». */
export function formatearDiaMes(iso: string): string {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return '—';
  return f.toLocaleDateString('es', { day: 'numeric', month: 'long', timeZone: ZONA_HORARIA });
}

export const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

/** Hoy como 'AAAA-MM-DD' en la hora de la parroquia (El Salvador). */
export function hoyIso(fecha: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(fecha);
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
  return `${v('year')}-${v('month')}-${v('day')}`;
}

export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;

const formatoPartes = new Intl.DateTimeFormat('es', {
  timeZone: ZONA_HORARIA,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

interface PartesLocales {
  anio: number;
  mes: number; // 1-12
  dia: number;
  hora: string; // «18:42»
}

function partesLocales(f: Date): PartesLocales {
  const partes = formatoPartes.formatToParts(f);
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
  return { anio: Number(v('year')), mes: Number(v('month')), dia: Number(v('day')), hora: `${v('hour').padStart(2, '0')}:${v('minute')}` };
}

/** «14 nov 2026, 18:42», en hora de El Salvador. Inválida: «—». */
export function fechaCompleta(iso: string): string {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return '—';
  const p = partesLocales(f);
  return `${p.dia} ${MESES_CORTOS[p.mes - 1]} ${p.anio}, ${p.hora}`;
}

/** «26 nov», en hora de El Salvador. Inválida: «—». */
export function fechaDiaMesCorta(iso: string): string {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return '—';
  const p = partesLocales(f);
  return `${p.dia} ${MESES_CORTOS[p.mes - 1]}`;
}

/** «5 nov, 10:12», en hora de El Salvador. Inválida: «—». */
export function fechaHoraCorta(iso: string): string {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return '—';
  const p = partesLocales(f);
  return `${p.dia} ${MESES_CORTOS[p.mes - 1]}, ${p.hora}`;
}

/** Partes de `iso` y cuántos días de calendario local pasaron hasta `ahora`; null si `iso` no es una fecha. */
function relativo(iso: string | null | undefined, ahora: Date): { p: PartesLocales; dias: number; mismoAnio: boolean } | null {
  if (!iso) return null;
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return null;
  const p = partesLocales(f);
  const a = partesLocales(ahora);
  const dias = Math.round((Date.UTC(a.anio, a.mes - 1, a.dia) - Date.UTC(p.anio, p.mes - 1, p.dia)) / 86_400_000);
  return { p, dias, mismoAnio: p.anio === a.anio };
}

const diaMes = (r: { p: PartesLocales; mismoAnio: boolean }) =>
  `${r.p.dia} ${MESES_CORTOS[r.p.mes - 1]}${r.mismoAnio ? '' : ` ${r.p.anio}`}`;

/** Registro de cambios (D3): «Hoy 18:42», «Ayer 20:05», «5 nov 10:12», «5 nov 2025 10:12». Inválida: «—». */
export function cuandoRegistro(iso: string, ahora: Date = new Date()): string {
  const r = relativo(iso, ahora);
  if (!r) return '—';
  if (r.dias === 0) return `Hoy ${r.p.hora}`;
  if (r.dias === 1) return `Ayer ${r.p.hora}`;
  return `${diaMes(r)} ${r.p.hora}`;
}

/** Versiones publicadas (F12): «hoy 18:42», «ayer 20:05», «2 nov», «2 nov 2025». Inválida: «—». */
export function cuandoVersion(iso: string, ahora: Date = new Date()): string {
  const r = relativo(iso, ahora);
  if (!r) return '—';
  if (r.dias === 0) return `hoy ${r.p.hora}`;
  if (r.dias === 1) return `ayer ${r.p.hora}`;
  return diaMes(r);
}

/** Última entrada (D2): «hoy», «ayer», «hace N días» (2 a 6), «5 nov», «5 nov 2025». Sin dato: «—». */
export function ultimaEntrada(iso: string | null | undefined, ahora: Date = new Date()): string {
  const r = relativo(iso, ahora);
  if (!r) return '—';
  if (r.dias <= 0) return 'hoy';
  if (r.dias === 1) return 'ayer';
  if (r.dias <= 6) return `hace ${r.dias} días`;
  return diaMes(r);
}
