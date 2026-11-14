// Horarios de misa (F10). Los horarios viejos tienen `{ dia, hora, nota }`; el editor muestra y guarda
// siempre la forma nueva `{ dia, horas: [{ hora, nota }], lugar }` (spec, sección 6).

export interface Horario {
  dia: string;
  horas: { hora: string; nota?: string }[];
  lugar?: string;
}

const esObjeto = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Un horario en la forma nueva. La forma vieja `{dia, hora, nota}` pasa a `{dia, horas: [{hora, nota}]}`. */
export function aFormaNueva(h: unknown): Horario {
  if (!esObjeto(h)) return { dia: '', horas: [] };
  if (Array.isArray(h.horas)) return h as unknown as Horario;
  const hora: { hora: string; nota?: string } = { hora: typeof h.hora === 'string' ? h.hora : '' };
  if (h.nota !== undefined) hora.nota = h.nota as string;
  const nuevo: Horario = { dia: typeof h.dia === 'string' ? h.dia : '', horas: [hora] };
  if (h.lugar !== undefined) nuevo.lugar = h.lugar as string;
  return nuevo;
}

export const MAX_HORARIOS = 12;
export const MAX_HORAS = 6;
export const MAX_TEXTO = 200;

/** «7:00 a. m. · 9:00 a. m. · 6:00 p. m.»; con nota, «6:00 p. m. · Hora Santa». */
export function textoHoras(h: Horario): string {
  return (h.horas ?? []).map((x) => (x.nota ? `${x.hora} · ${x.nota}` : x.hora)).join(' · ');
}

/** Recorta los textos y quita las notas, el lugar y las filas de hora vacías. */
export function limpiarHorario(h: Horario): Horario {
  const horas = (h.horas ?? [])
    .map((x) => {
      const hora: { hora: string; nota?: string } = { hora: (x.hora ?? '').trim() };
      const nota = (x.nota ?? '').trim();
      if (nota) hora.nota = nota;
      return hora;
    })
    .filter((x) => x.hora !== '');
  const limpio: Horario = { dia: (h.dia ?? '').trim(), horas };
  const lugar = (h.lugar ?? '').trim();
  if (lugar) limpio.lugar = lugar;
  return limpio;
}

/** Lo que falta o sobra antes de «Guardar horario». */
export function erroresHorario(h: Horario): { dia?: string; horas?: string; lugar?: string } {
  const e: { dia?: string; horas?: string; lugar?: string } = {};
  const dia = (h.dia ?? '').trim();
  if (!dia) e.dia = 'Escribe el día.';
  else if (dia.length > MAX_TEXTO) e.dia = 'Hasta 200 caracteres.';
  const horas = (h.horas ?? []).filter((x) => (x.hora ?? '').trim());
  if (!horas.length) e.horas = 'Escribe al menos una hora.';
  else if ((h.horas ?? []).some((x) => (x.hora ?? '').trim().length > MAX_TEXTO || (x.nota ?? '').trim().length > MAX_TEXTO)) {
    e.horas = 'Hasta 200 caracteres.';
  }
  if ((h.lugar ?? '').trim().length > MAX_TEXTO) e.lugar = 'Hasta 200 caracteres.';
  return e;
}
