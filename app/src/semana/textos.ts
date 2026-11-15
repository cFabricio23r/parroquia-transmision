// Los textos de «Elegir transmisión» (spec 3b y plan 3b, Decisión 12) y dos cálculos puros.
import { fechaLocal } from './sincronizar';
import type { ItemApp } from './pendientes';

export const TEXTOS_SEMANA = {
  titulo: 'Transmisiones de hoy',
  vacioHoy: 'Hoy no hay transmisiones preparadas.',
  semana: 'Esta semana',
  volver: '‹ Volver a hoy',
  usar: 'Usar esta',
  editar: 'Editar',
  verSemana: 'Ver toda la semana',
  sinPreparar: 'Transmisión sin preparar',
  pie: 'Lo que edites aquí vuelve a la web cuando hay internet. Sin internet, usa lo último que bajó.',
  pendiente: 'Pendiente de subir',
  rechazado: 'No se pudo subir este cambio. Revísalo en la web.',
  tipoNoDisponible: 'Este tipo ya no está en la parroquia. Cámbialo en la web.',
  sinCache: 'Todavía no se bajó ninguna semana.',
  botonSemana: 'Transmisiones de la semana',
  sinTransmisiones: 'Sin transmisiones',
} as const;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const dos = (n: number) => String(n).padStart(2, '0');

function minutos(hora: string): number {
  const m = /^(\d{2}):(\d{2})$/.exec(hora);
  return m ? Number(m[1]) * 60 + Number(m[2]) : Number.NaN;
}

/** La clave de la próxima de hoy: la primera no saltada cuya hora es, como mucho, 60 min anterior a ahora. */
export function proximaDeHoy(items: readonly ItemApp[], ahora: Date): string | null {
  const hoy = fechaLocal(ahora);
  const ya = ahora.getHours() * 60 + ahora.getMinutes();
  const candidatas = items
    .filter((i) => i.fecha === hoy && !i.saltada && minutos(i.hora) >= ya - 60)
    .sort((a, b) => minutos(a.hora) - minutos(b.hora));
  return candidatas.length > 0 ? candidatas[0].clave : null;
}

/** «Actualizado el 14 nov, 18:42», en la hora del celular. Sin Intl, como textoCopia. */
export function textoActualizado(iso: string, _ahora: Date): string {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return '';
  return 'Actualizado el ' + f.getDate() + ' ' + MESES[f.getMonth()] + ', ' + dos(f.getHours()) + ':' + dos(f.getMinutes());
}
