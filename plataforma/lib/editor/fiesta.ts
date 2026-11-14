// Patrono y fiesta (plan 3, Tarea 13). Sin React: se prueba sola.

/** Días de un mes (1–12). Febrero tiene 29, como `_diasDelMes` de vicaria/parroquia.js. */
export function diasDelMes(mes: number): number {
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1] ?? 31;
}

export const OPCIONES_CUENTA: { valor: number; texto: string }[] = [
  { valor: 9, texto: 'Desde 9 días antes (la novena)' },
  { valor: 30, texto: 'Desde 30 días antes' },
  { valor: 60, texto: 'Desde 60 días antes' },
  { valor: 90, texto: 'Desde 90 días antes' },
];
export const CUENTA_POR_DEFECTO = 60;

/** Las opciones de «Cuenta regresiva»; un valor que no está (45) se agrega al final y se conserva. */
export function opcionesCuenta(actual: number | undefined): { valor: number; texto: string }[] {
  if (actual === undefined || !Number.isInteger(actual) || OPCIONES_CUENTA.some((o) => o.valor === actual)) return OPCIONES_CUENTA;
  return [...OPCIONES_CUENTA, { valor: actual, texto: `Desde ${actual} días antes` }];
}

/** Pone el mes y baja el día al último del mes si se pasa (31 de enero → abril: 30). No muta. */
export function cambiarMes<T extends object>(fiesta: T, mes: number): T & { mes: number } {
  const f = { ...fiesta, mes } as T & { mes: number; dia?: unknown };
  if (typeof f.dia === 'number' && f.dia > diasDelMes(mes)) f.dia = diasDelMes(mes);
  return f;
}
