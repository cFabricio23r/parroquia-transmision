// Zoom de la cámara y medidas de la pantalla completa (Tarea 9g). TypeScript puro, con tests.

export type RangoZoom = { min: number; max: number };
export type RectCompleta = { left: number; top: number; width: number; height: number };

/** Los botones − y + van de a medio aumento. */
const PASO = 0.5;
const finito = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** El rango que da el nativo, o null si el celular no tiene zoom o el dato no sirve. */
export function rangoValido(r: { min: number; max: number } | null | undefined): RangoZoom | null {
  if (!r || !finito(r.min) || !finito(r.max) || r.max <= r.min) return null;
  return { min: r.min, max: r.max };
}

/** El zoom dentro del rango. Si no es un número, 1× (o el mínimo, si es mayor). */
export function limitarZoom(z: number, r: RangoZoom): number {
  const v = finito(z) ? z : 1;
  return Math.min(r.max, Math.max(r.min, v));
}

/** El zoom del botón − (dir -1) o + (dir 1): el siguiente múltiplo de 0,5 en esa dirección. */
export function zoomSiguiente(actual: number, r: RangoZoom, dir: 1 | -1): number {
  const base = limitarZoom(actual, r) / PASO;
  // Con un margen chico, para que 1,5 no se quede en 1,5 por un error de redondeo.
  const paso = dir === 1 ? Math.floor(base + 1e-6) + 1 : Math.ceil(base - 1e-6) - 1;
  return limitarZoom(paso * PASO, r);
}

/** Zoom al pellizcar: el de cuando se apoyaron los dos dedos, por cuánto se separaron. */
export function zoomPellizco(inicial: number, distInicial: number, distActual: number, r: RangoZoom): number {
  if (!finito(distInicial) || distInicial <= 0 || !finito(distActual)) return limitarZoom(inicial, r);
  return limitarZoom((inicial * distActual) / distInicial, r);
}

/** «1×», «1,5×», «2,3×». */
export function etiquetaZoom(z: number): string {
  const t = (Math.round(z * 10) / 10).toFixed(1).replace(/\.0$/, '').replace('.', ',');
  return `${t}×`;
}

/** La vista previa en pantalla completa: lo más grande posible en 16:9, centrada. */
export function rectCompleta(ancho: number, alto: number): RectCompleta {
  if (!(ancho > 0) || !(alto > 0)) return { left: 0, top: 0, width: 0, height: 0 };
  const w = Math.min(ancho, Math.round((alto * 16) / 9));
  const h = Math.min(alto, Math.round((w * 9) / 16));
  return { left: Math.round((ancho - w) / 2), top: Math.round((alto - h) / 2), width: w, height: h };
}
