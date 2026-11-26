/**
 * La tarea 'ajustes-app': baja de la web los ajustes de la app y la clave fija de la parroquia
 * (3c), en 'abrir' y en 'antes-de-iniciar', nunca en vivo. Si sale al aire o la parroquia deja de
 * ser la elegida mientras baja, no escribe ni avisa. Los errores no llevan datos: la clave nunca
 * llega a un console.* ni a un Error.
 */
import { estiloFinalValido } from './ajustes';
import type { AlmacenAjustes } from './almacen';
import type { AjustesDeParroquia, ClaveDeParroquia } from './origen';
import type { Limpiezas, Sincronizador, TareaSincronizar } from '../sincronizar/sincronizar';

export const CONSULTA_AJUSTES = (parroquiaId: string) => ({
  select: 'servidor,calidad_defecto,estilo_final,actualizado_en',
  parroquia_id: 'eq.' + parroquiaId,
});
export const CONSULTA_CLAVE = (parroquiaId: string) => ({
  select: 'clave,guardada_en',
  parroquia_id: 'eq.' + parroquiaId,
});

const esObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

export function normalizarFilaAjustes(f: unknown): AjustesDeParroquia | null {
  if (!esObj(f)) return null;
  const { servidor, calidad_defecto: calidad, estilo_final: estilo, actualizado_en: en } = f;
  if (calidad !== '720p' && calidad !== '1080p') return null;
  if (estilo !== 'claro' && estilo !== 'azul') return null;
  if (typeof en !== 'string') return null;
  return {
    servidor: typeof servidor === 'string' && servidor.startsWith('rtmps://') ? servidor : null,
    calidad,
    estiloFinal: estiloFinalValido(estilo),
    actualizadoEn: en,
  };
}

export function normalizarFilaClave(f: unknown): ClaveDeParroquia | null {
  if (!esObj(f)) return null;
  const { clave, guardada_en: en } = f;
  if (typeof clave !== 'string' || clave === '' || /\s/.test(clave) || typeof en !== 'string') return null;
  return { clave, guardadaEn: en };
}

export interface DepsDescargaAjustes {
  almacen: AlmacenAjustes;
  avisar(slug: string): void;
}

export function crearTareaAjustes(d: DepsDescargaAjustes): TareaSincronizar {
  return async (c) => {
    if (c.enVivo()) return;
    const id = c.parroquia.id;
    const slug = c.parroquia.slug;
    const ajustes = await c.sesion.conSesion((s) => c.cliente.seleccionar<unknown>(s, 'ajustes_app', CONSULTA_AJUSTES(id)));
    if (!ajustes.ok) throw new Error('ajustes-app: lectura');
    const clave = await c.sesion.conSesion((s) => c.cliente.seleccionar<unknown>(s, 'claves_transmision', CONSULTA_CLAVE(id)));
    if (!clave.ok) throw new Error('ajustes-app: lectura');
    if (c.enVivo() || !c.sigueElegida()) return;
    const antes = await d.almacen.leer(slug);
    // Sin fila: la parroquia no puso nada (o quitó la clave). Una fila inválida deja lo de antes.
    const filaA = ajustes.valor[0];
    const filaK = clave.valor[0];
    const parroquia = filaA === undefined ? null : normalizarFilaAjustes(filaA) ?? antes.parroquia;
    const nueva = filaK === undefined ? null : normalizarFilaClave(filaK) ?? antes.clave;
    if (c.enVivo() || !c.sigueElegida()) return;
    const cambio =
      JSON.stringify({ parroquia: antes.parroquia, clave: antes.clave }) !== JSON.stringify({ parroquia, clave: nueva });
    if (!cambio) return;
    await d.almacen.guardarDeParroquia(slug, parroquia, nueva);
    d.avisar(slug);
  };
}

/** Registra la tarea 'ajustes-app' (después de 'paginas') y la limpieza 'ajustes'. */
export function registrarAjustes(s: Sincronizador, l: Limpiezas, d: DepsDescargaAjustes): void {
  s.registrarTarea('ajustes-app', ['abrir', 'antes-de-iniciar'], crearTareaAjustes(d));
  l.registrar('ajustes', (a) => (a.tipo === 'parroquia' ? d.almacen.borrarParroquia(a.parroquia.slug) : d.almacen.borrarTodo()));
}

const oyentes = new Set<(slug: string) => void>();

/** Se entera de que cambiaron los ajustes bajados de una parroquia. Devuelve cómo dejar de escuchar. */
export function alCambiarAjustes(cb: (slug: string) => void): () => void {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}

export function avisarCambioDeAjustes(slug: string): void {
  for (const cb of [...oyentes]) cb(slug);
}
