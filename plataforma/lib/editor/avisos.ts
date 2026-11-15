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

/**
 * La clave de cada fila de la lista (para `key`): el título y cuántas veces apareció antes, nunca el
 * lugar. Así, al subir o bajar un aviso, React mueve la fila en vez de rehacerla y el foco no se pierde.
 */
export function clavesDeFilas(lista: Partial<AvisoFijo>[]): string[] {
  const vistos = new Map<string, number>();
  return lista.map((a) => {
    const t = a.texto ?? '';
    const n = vistos.get(t) ?? 0;
    vistos.set(t, n + 1);
    return `${n}:${t}`;
  });
}

/** Lo que se anuncia al mover un aviso con el teclado: «Retiro de jóvenes, ahora 1.º de 3». */
export function textoLugar(texto: string, i: number, total: number): string {
  return `${texto}, ahora ${i + 1}.º de ${total}`;
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

/**
 * El lugar nuevo del aviso que estaba en `e` después de llevar el de `desde` a `hasta` (`moverA`, o
 * `mover` de un lugar). Lo usa el formulario «Editar aviso» para seguir al mismo aviso aunque el
 * movido sea otro: si no, «Guardar aviso» escribiría encima del aviso equivocado.
 */
export function lugarTrasMover<T extends number | 'nuevo'>(e: T, desde: number, hasta: number): T {
  if (e === 'nuevo') return e;
  const i = e as number;
  if (i === desde) return hasta as T;
  if (desde < hasta && i > desde && i <= hasta) return (i - 1) as T;
  if (hasta < desde && i >= hasta && i < desde) return (i + 1) as T;
  return e;
}

/** Los campos del formulario «Editar aviso»: lo que identifica a un aviso (sin `orden` ni `activo`). */
export type DatosAviso = { texto: string; detalle: string; desde: string; hasta: string };

const datosDe = (a: Partial<AvisoFijo>): DatosAviso => ({ texto: a.texto ?? '', detalle: a.detalle ?? '', desde: a.desde ?? '', hasta: a.hasta ?? '' });
const mismosDatos = (x: DatosAviso, y: DatosAviso) => x.texto === y.texto && x.detalle === y.detalle && x.desde === y.desde && x.hasta === y.hasta;

/**
 * Dónde está ahora el aviso que el formulario cargó con `original` (fix2, F11). Si la lista cambia desde
 * afuera («Ver lo suyo», una fusión con otra sesión), el índice de antes puede ser otro aviso: se
 * busca por lo que tenía al cargarse, el más cercano a `antes` si hay dos iguales. `null` si ya no está.
 */
export function ubicarAviso<T extends number | 'nuevo'>(lista: Partial<AvisoFijo>[], original: DatosAviso, antes: T): T | null {
  if (antes === 'nuevo') return antes;
  const i = antes as number;
  if (lista[i] && mismosDatos(datosDe(lista[i]), original)) return antes;
  let mejor: number | null = null;
  lista.forEach((a, j) => {
    if (a && mismosDatos(datosDe(a), original) && (mejor === null || Math.abs(j - i) < Math.abs(mejor - i))) mejor = j;
  });
  return mejor as T | null;
}
