// Textos de la sección «Transmisiones de la semana» (plan 3b, Decisión 12). Puro: servidor y cliente.
import { fechaHoraCorta, MESES_CORTOS } from '../fecha';
import { SEMANA, type ItemSemana } from '../semana';

export const AVISO_TIPO_EDITOR = 'Este tipo ya no está en la parroquia. Cámbialo.';

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const;

const partes = (f: string) => ({ anio: Number(f.slice(0, 4)), mes: MESES_CORTOS[Number(f.slice(5, 7)) - 1], dia: Number(f.slice(8, 10)) });

/** «16 – 22 nov 2026», «30 nov – 6 dic 2026» o «28 dic 2026 – 3 ene 2027». */
export function rangoSemana(lunes: string): string {
  const a = partes(lunes);
  const b = partes(SEMANA.sumarDias(lunes, 6));
  if (a.anio !== b.anio) return `${a.dia} ${a.mes} ${a.anio} – ${b.dia} ${b.mes} ${b.anio}`;
  if (a.mes !== b.mes) return `${a.dia} ${a.mes} – ${b.dia} ${b.mes} ${b.anio}`;
  return `${a.dia} – ${b.dia} ${b.mes} ${b.anio}`;
}

/** «Jueves 19». */
export function encabezadoDia(fecha: string): string {
  const d = DIAS[SEMANA.diaSemana(fecha) - 1];
  return `${d[0].toUpperCase()}${d.slice(1)} ${Number(fecha.slice(8, 10))}`;
}

/** «Cambiado desde la app el 5 nov, 10:12», o null si el último cambio no vino de la app. */
export function cambiadoDesdeApp(item: ItemSemana): string | null {
  if (item.actualizadoDesde !== 'app' || !item.actualizadoEn) return null;
  return `Cambiado desde la app el ${fechaHoraCorta(item.actualizadoEn)}`;
}

/** «Jue 19 · 18:00 · Hora Santa». */
export function etiquetaFila(item: ItemSemana, nombreTipo: string): string {
  return `${SEMANA.textoDia(item.fecha)} · ${item.hora} · ${nombreTipo}`;
}

/** «Editar el jueves 19, 18:00, Hora Santa». */
export function etiquetaAccion(accion: string, item: ItemSemana, nombreTipo: string): string {
  return `${accion} el ${DIAS[SEMANA.diaSemana(item.fecha) - 1]} ${Number(item.fecha.slice(8, 10))}, ${item.hora}, ${nombreTipo}`;
}

/** Título y descripción del vivo de Facebook (spec facebook-en-vivo-directo, 2026-11-27). */
export const ETIQUETA_FB_TITULO = 'Título en Facebook (opcional)';
export const ETIQUETA_FB_DESCRIPCION = 'Descripción en Facebook (opcional)';
export const AYUDA_FB_TITULO = 'Si lo dejas vacío, sale «Tipo · Parroquia». Hasta 254 caracteres.';
export const AYUDA_FB_DESCRIPCION = 'Se usa solo si la parroquia transmite directo a Facebook. Hasta 1000 caracteres.';
