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
