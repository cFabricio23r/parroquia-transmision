// Avisos fijos (F11). Orden como vicaria (`pantallas.js` `avisosPara`), rangos de fechas (Decisión 16)
// y reordenamiento que numera todos (Decisión 15). Sin React: se prueba sola.
import { MESES } from '../fecha';

export const MAX_AVISOS = 10;
const MAX_TEXTO = 200;

export interface AvisoFijo {
  texto: string;
  detalle?: string;
  desde?: string;
  hasta?: string;
  activo?: boolean;
  orden?: number;
}

/** Por `orden` (a igual orden, por posición); los que no tienen `orden` van al final, en su posición. */
export function ordenarAvisos<T extends Partial<AvisoFijo>>(lista: T[]): T[] {
  return lista
    .map((a, i) => ({ a, i }))
    .sort((p, q) => {
      const po = Number.isInteger(p.a.orden) ? (p.a.orden as number) : Infinity;
      const qo = Number.isInteger(q.a.orden) ? (q.a.orden as number) : Infinity;
      return po === qo ? p.i - q.i : po < qo ? -1 : 1;
    })
    .map((x) => x.a);
}

/** `orden` = posición + 1 en todos. */
export function numerar<T extends Partial<AvisoFijo>>(lista: T[]): T[] {
  return lista.map((a, i) => ({ ...a, orden: i + 1 }));
}

/** Sube (−1) o baja (+1) un aviso; en los bordes no cambia el orden. Siempre devuelve la lista numerada. */
export function mover<T extends Partial<AvisoFijo>>(lista: T[], i: number, delta: -1 | 1): T[] {
  const j = i + delta;
  const copia = [...lista];
  if (i >= 0 && i < copia.length && j >= 0 && j < copia.length) [copia[i], copia[j]] = [copia[j], copia[i]];
  return numerar(copia);
}

const partes = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number);
  return { a, m, d };
};
const diaMes = (iso: string, hoy: string) => {
  const f = partes(iso);
  const anio = f.a !== partes(hoy).a ? ` de ${f.a}` : '';
  return `${f.d} de ${MESES[f.m - 1]}${anio}`;
};

/** El rango de fechas de un aviso, como frase (Decisión 16). */
export function textoRango(a: AvisoFijo, hoy: string): string {
  if (a.hasta && a.hasta < hoy) return `Terminó el ${diaMes(a.hasta, hoy)}`;
  if (a.desde && a.desde > hoy) {
    if (!a.hasta) return `Desde el ${diaMes(a.desde, hoy)}`;
    const d = partes(a.desde);
    const h = partes(a.hasta);
    if (d.a === h.a && d.m === h.m) return `Del ${d.d} al ${diaMes(a.hasta, hoy)}`;
    return `Del ${diaMes(a.desde, hoy)} al ${diaMes(a.hasta, hoy)}`;
  }
  return a.hasta ? `Hasta el ${diaMes(a.hasta, hoy)}` : 'Sin fecha de fin';
}

export function vencido(a: AvisoFijo, hoy: string): boolean {
  return !!a.hasta && a.hasta < hoy;
}

export function erroresAviso(a: AvisoFijo): { texto?: string; detalle?: string; fechas?: string } {
  const e: { texto?: string; detalle?: string; fechas?: string } = {};
  const texto = (a.texto ?? '').trim();
  if (!texto) e.texto = 'Escribe el título.';
  else if (texto.length > MAX_TEXTO) e.texto = 'Hasta 200 caracteres.';
  if ((a.detalle ?? '').trim().length > MAX_TEXTO) e.detalle = 'Hasta 200 caracteres.';
  if (a.desde && a.hasta && a.desde > a.hasta) e.fechas = 'La fecha «Desde» no puede ser después de «Hasta».';
  return e;
}

/** Lleva el aviso de la posición `desde` a la posición `hasta` (arrastrar y soltar). Numera todos. */
export function moverA<T extends Partial<AvisoFijo>>(lista: T[], desde: number, hasta: number): T[] {
  const copia = [...lista];
  if (desde < 0 || desde >= copia.length || hasta < 0 || hasta >= copia.length) return numerar(copia);
  const [a] = copia.splice(desde, 1);
  copia.splice(hasta, 0, a);
  return numerar(copia);
}
