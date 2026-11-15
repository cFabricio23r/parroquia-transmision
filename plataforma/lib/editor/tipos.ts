// Tipos de transmisión (plan 4, Tarea 7; spec, secciones 5 y 6): las filas de la tabla de F7 (con el
// grupo de la novena), los interruptores «En el panel», la clave de un propio nuevo y el formulario de
// F8 para un propio o el ajuste de un común. Conserva todo lo que el editor no edita. Sin React.
import type { TipoComun } from '../validar-nucleo.mjs';

export type { TipoComun };

type Objeto = Record<string, unknown>;
const esObjeto = (v: unknown): v is Objeto => v !== null && typeof v === 'object' && !Array.isArray(v);
const objeto = (v: unknown): Objeto => (esObjeto(v) ? v : {});
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const texto = (v: unknown): string => (typeof v === 'string' ? v : '');

export interface FilaComun {
  id: string;
  nombre: string;
  claves: string[];
  descripcion: string;
}

/**
 * Decisión 13: las filas de la tabla en su orden. Solo se agrupan claves con los mismos rótulos. Los
 * nombres de una sola clave van vacíos: los completa `filasComunes` con el nombre de vicaria.
 */
export const FILAS_COMUNES: readonly FilaComun[] = [
  { id: 'dominical', nombre: '', claves: ['dominical'], descripcion: 'Inicio y Gracias de domingo.' },
  { id: 'semana', nombre: '', claves: ['semana'], descripcion: 'Inicio y Gracias entre semana.' },
  { id: 'otros', nombre: '', claves: ['otros'], descripcion: 'Elige la imagen del santo de la galería.' },
  { id: 'horasanta', nombre: '', claves: ['horasanta'], descripcion: 'Con la imagen de la custodia.' },
  { id: 'sector', nombre: '', claves: ['sector'], descripcion: 'Con rótulo de lugar, en un sector o comunidad.' },
  { id: 'patronalsector', nombre: '', claves: ['patronalsector'], descripcion: 'La fiesta del patrono de un sector.' },
  { id: 'novena', nombre: 'Novena y fiesta patronal', claves: ['prenovena', 'novena', 'patronal'], descripcion: 'Con la cuenta regresiva y el lema.' },
  { id: 'procesion', nombre: '', claves: ['procesion'], descripcion: 'Con rótulo de lugar o estación.' },
  { id: 'evento', nombre: '', claves: ['evento'], descripcion: 'Con la portada de evento: nombre, fecha y lugar.' },
];

export const MAX_PROPIOS = 10;
export const MENSAJE_MAX_PROPIOS = 'Hasta 10 tipos propios.';
export const MENSAJE_ULTIMO_TIPO = 'Tiene que quedar al menos un tipo en el panel.';

export function filasComunes(comunes: TipoComun[]): FilaComun[] {
  return FILAS_COMUNES.map((f) => ({
    ...f,
    claves: [...f.claves],
    nombre: f.nombre || comunes.find((c) => c.clave === f.claves[0])?.nombre || f.id,
  }));
}

const apagadosDe = (tipos: unknown): unknown[] => lista(objeto(tipos).apagados);
const propiosDe = (tipos: unknown): Objeto[] => lista(objeto(tipos).propios).filter(esObjeto);

/** Encendida si alguna de sus claves no está apagada. */
export function filaEncendida(tipos: unknown, f: FilaComun): boolean {
  const apagados = apagadosDe(tipos);
  return f.claves.some((k) => !apagados.includes(k));
}

/** Sin claves, `undefined` (se quita el bloque). */
const limpiarTipos = (t: Objeto): Objeto | undefined => (Object.keys(t).length ? t : undefined);

/** `tipos` con la fila apagada o encendida: todas sus claves a la vez; el resto de `apagados` sigue igual. */
export function conFila(tipos: unknown, f: FilaComun, encendida: boolean): Objeto | undefined {
  const t: Objeto = { ...objeto(tipos) };
  const actuales = apagadosDe(tipos);
  const final = encendida
    ? actuales.filter((k) => !f.claves.includes(k as string))
    : [...actuales, ...f.claves.filter((k) => !actuales.includes(k))];
  if (final.length) t.apagados = final;
  else delete t.apagados;
  return limpiarTipos(t);
}

/** Filas comunes encendidas + propios (Decisión 16). */
export function filasActivas(tipos: unknown, _comunes?: TipoComun[]): number {
  return FILAS_COMUNES.filter((f) => filaEncendida(tipos, f)).length + propiosDe(tipos).length;
}

/** Decisión 14: no se apaga la única fila encendida si no hay propios. */
export function puedeApagar(tipos: unknown, f: FilaComun, _comunes?: TipoComun[]): boolean {
  if (propiosDe(tipos).length > 0) return true;
  return FILAS_COMUNES.some((o) => o.id !== f.id && filaEncendida(tipos, o));
}

/** Decisión 15: no se borra el único tipo disponible. */
export function puedeBorrarPropio(tipos: unknown, clave: string): boolean {
  const otros = propiosDe(tipos).filter((p) => p.clave !== clave).length;
  return otros > 0 || FILAS_COMUNES.some((f) => filaEncendida(tipos, f));
}

const CLAVES_COMUNES = FILAS_COMUNES.flatMap((f) => f.claves);

/** Decisión 17: el nombre como slug (sin tildes, con guiones, hasta 40); nunca `nuevo`, común ni repetida. */
export function nuevaClavePropio(nombre: string, existentes: string[]): string {
  let base = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  if (base.length < 2) base = 'tipo';
  const ocupada = (k: string) => k === 'nuevo' || CLAVES_COMUNES.includes(k) || existentes.includes(k);
  if (!ocupada(base)) return base;
  for (let n = 2; ; n++) {
    const sufijo = `-${n}`;
    const k = `${base.slice(0, 40 - sufijo.length).replace(/-+$/g, '')}${sufijo}`;
    if (!ocupada(k)) return k;
  }
}

export interface CasillaPropio {
  id: string;
  texto: string;
  bases: string[];
}

/** Decisión 20, en el orden del DOM (la grilla de 2 columnas se lee por filas). */
export const CASILLAS_PROPIO: CasillaPropio[] = [
  { id: 'persona', texto: 'Persona', bases: ['persona'] },
  { id: 'rosario', texto: 'Misterio del rosario', bases: ['rosario'] },
  { id: 'lectura', texto: 'Lectura', bases: ['lectura1', 'salmo', 'lectura2', 'evangelio'] },
  { id: 'oracion', texto: 'Oración', bases: ['oracion'] },
  { id: 'lugar', texto: 'Lugar o estación', bases: ['lugar'] },
  { id: 'libre', texto: 'Libre', bases: ['libre'] },
];

/** El orden en que se escriben las bases. */
const ORDEN_BASES = ['persona', 'lectura1', 'salmo', 'lectura2', 'evangelio', 'rosario', 'oracion', 'lugar', 'libre'];

export function casillasDe(rotulos: unknown): Record<string, boolean> {
  const l = lista(rotulos);
  return Object.fromEntries(CASILLAS_PROPIO.map((c) => [c.id, c.bases.some((b) => l.includes(b))]));
}

/**
 * Las bases que quedan con las casillas marcadas. Parte de `anteriores` y solo toca las casillas
 * que cambiaron (ronda 2): una que se desmarca quita sus bases; una que se marca agrega las que
 * faltan, en el orden de `ORDEN_BASES`, detrás de la última base de casilla que ya estaba (o al
 * principio). Lo demás queda como estaba, en su orden, y una base que no es de ninguna casilla
 * (`santisimo`) se conserva. Sin cambios, devuelve los rótulos de antes tal cual.
 */
export function rotulosDeCasillas(marcadas: Record<string, boolean>, anteriores: unknown): string[] {
  const antes = lista(anteriores).filter((b): b is string => typeof b === 'string');
  const previas = casillasDe(antes);
  const cambiadas = CASILLAS_PROPIO.filter((c) => Boolean(marcadas[c.id]) !== previas[c.id]);
  const quitar = new Set(cambiadas.filter((c) => !marcadas[c.id]).flatMap((c) => c.bases));
  const agregar = new Set(cambiadas.filter((c) => marcadas[c.id]).flatMap((c) => c.bases));
  const quedan = antes.filter((b, i, a) => !quitar.has(b) && a.indexOf(b) === i);
  const nuevas = ORDEN_BASES.filter((b) => agregar.has(b) && !quedan.includes(b));
  const cubiertas = new Set(CASILLAS_PROPIO.flatMap((c) => c.bases));
  let donde = 0;
  quedan.forEach((b, i) => {
    if (cubiertas.has(b)) donde = i + 1;
  });
  return [...quedan.slice(0, donde), ...nuevas, ...quedan.slice(donde)];
}

export type Portada = 'ninguna' | 'fiesta' | 'evento';

export interface FormularioTipo {
  clase: 'nuevo' | 'propio' | 'comun';
  id: string;
  claves: string[];
  nombre: string;
  nombrePanel: string;
  textoInicio: string;
  textoGracias: string;
  imagen: string | undefined;
  portada: Portada;
  casillas: Record<string, boolean>;
  base: Record<string, unknown>;
}

const portadaDe = (v: unknown): Portada => (v === 'fiesta' || v === 'evento' ? v : 'ninguna');

/** El formulario de F8 para `nuevo`, una fila común (su id) o un propio; si no existe, null. */
export function formularioDeTipo(borrador: object, id: string, comunes: TipoComun[]): FormularioTipo | null {
  const tipos = objeto(objeto(borrador).tipos);
  if (id === 'nuevo') {
    return {
      clase: 'nuevo',
      id,
      claves: [],
      nombre: '',
      nombrePanel: '',
      textoInicio: '',
      textoGracias: '',
      imagen: undefined,
      portada: 'ninguna',
      casillas: { ...Object.fromEntries(CASILLAS_PROPIO.map((c) => [c.id, false])), persona: true },
      base: {},
    };
  }
  const f = filasComunes(comunes).find((x) => x.id === id);
  if (f) {
    // Decisión 18: el ajuste del grupo se lee de la clave del id (`novena`).
    const a = objeto(objeto(tipos.ajustes)[f.id]);
    const ocultos = lista(a.ocultarRotulos);
    const rotulos = comunes.find((c) => c.clave === f.id)?.rotulos ?? [];
    return {
      clase: 'comun',
      id,
      claves: f.claves,
      nombre: f.nombre,
      nombrePanel: texto(a.nombrePanel),
      textoInicio: texto(a.textoInicio),
      textoGracias: texto(a.textoGracias),
      imagen: typeof a.imagen === 'string' ? a.imagen : undefined,
      portada: 'ninguna',
      casillas: Object.fromEntries(rotulos.map((r) => [r.id, !ocultos.includes(r.id)])),
      base: a,
    };
  }
  const p = propiosDe(tipos).find((x) => x.clave === id);
  if (!p) return null;
  return {
    clase: 'propio',
    id,
    claves: [id],
    nombre: texto(p.nombre),
    nombrePanel: texto(p.nombrePanel),
    textoInicio: texto(p.textoInicio),
    textoGracias: texto(p.textoGracias),
    imagen: typeof p.imagen === 'string' ? p.imagen : undefined,
    portada: portadaDe(p.portada),
    casillas: casillasDe(p.rotulos),
    base: p,
  };
}

export interface ErroresTipo {
  nombre?: string;
  nombrePanel?: string;
  textoInicio?: string;
  textoGracias?: string;
  general?: string;
}

const LARGO = 'Hasta 200 caracteres.';

/** Decisión 21: la validación de vicaria con los textos del editor. */
export function erroresTipo(f: FormularioTipo, tipos: unknown): ErroresTipo {
  const e: ErroresTipo = {};
  if (f.clase !== 'comun') {
    if (!f.nombre.trim()) e.nombre = 'Escribe el nombre.';
    else if (f.nombre.trim().length > 200) e.nombre = LARGO;
  }
  if (f.nombrePanel.trim().length > 40) e.nombrePanel = 'Hasta 40 caracteres.';
  if (f.textoInicio.trim().length > 200) e.textoInicio = LARGO;
  if (f.textoGracias.trim().length > 200) e.textoGracias = LARGO;
  if (f.clase === 'nuevo' && propiosDe(tipos).length >= MAX_PROPIOS) e.general = MENSAJE_MAX_PROPIOS;
  return e;
}

/** Los campos de un propio que el editor no edita pero conserva. */
const CONSERVAR = ['descripcion', 'titulo', 'ceja', 'cursiva', 'franja', 'esquina', 'esquinaTexto'];

/**
 * Aplica el formulario: un propio se reemplaza en su lugar y uno nuevo va al final con su clave
 * nueva; un común escribe el mismo ajuste en todas sus claves (Decisión 18).
 */
export function aplicarTipo(
  tipos: unknown,
  f: FormularioTipo,
  comunes: TipoComun[],
  clavesExistentes: string[],
): { tipos: Objeto | undefined; clave: string } {
  const t: Objeto = { ...objeto(tipos) };
  const panel = f.nombrePanel.trim();
  const inicio = f.textoInicio.trim();
  const gracias = f.textoGracias.trim();

  if (f.clase === 'comun') {
    const ajustes: Objeto = { ...objeto(t.ajustes) };
    const rotulos = comunes.find((c) => c.clave === f.id)?.rotulos ?? [];
    const ocultar = rotulos.filter((r) => f.casillas[r.id] === false).map((r) => r.id);
    for (const k of f.claves) {
      const a: Objeto = {};
      const defecto = comunes.find((c) => c.clave === k)?.nombrePanel;
      if (panel && panel !== defecto) a.nombrePanel = panel;
      if (inicio) a.textoInicio = inicio;
      if (gracias) a.textoGracias = gracias;
      if (f.imagen !== undefined) a.imagen = f.imagen;
      if (ocultar.length) a.ocultarRotulos = ocultar;
      if (Object.keys(a).length) ajustes[k] = a;
      else delete ajustes[k];
    }
    if (Object.keys(ajustes).length) t.ajustes = ajustes;
    else delete t.ajustes;
    return { tipos: limpiarTipos(t), clave: f.id };
  }

  const clave = f.clase === 'nuevo' ? nuevaClavePropio(f.nombre, clavesExistentes) : f.id;
  const p: Objeto = { clave, nombre: f.nombre.trim() };
  for (const k of CONSERVAR) if (f.base[k] !== undefined) p[k] = f.base[k];
  if (panel) p.nombrePanel = panel;
  if (inicio) p.textoInicio = inicio;
  if (gracias) p.textoGracias = gracias;
  if (f.imagen !== undefined) p.imagen = f.imagen;
  if (f.portada !== 'ninguna') p.portada = f.portada;
  const rotulos = rotulosDeCasillas(f.casillas, f.base.rotulos);
  if (rotulos.length || Array.isArray(f.base.rotulos)) p.rotulos = rotulos;
  const propios = lista(t.propios);
  const i = f.clase === 'propio' ? propios.findIndex((x) => objeto(x).clave === f.id) : -1;
  t.propios = i >= 0 ? propios.map((x, j) => (j === i ? p : x)) : [...propios, p];
  return { tipos: t, clave };
}

/** Quita un propio; sin propios se quita la lista, y sin nada, el bloque. */
export function borrarPropio(tipos: unknown, clave: string): Objeto | undefined {
  const t: Objeto = { ...objeto(tipos) };
  const propios = lista(t.propios).filter((p) => objeto(p).clave !== clave);
  if (propios.length) t.propios = propios;
  else delete t.propios;
  return limpiarTipos(t);
}

/** «Volver a como venía» de un común: quita sus ajustes. */
export function quitarAjustes(tipos: unknown, claves: string[]): Objeto | undefined {
  const t: Objeto = { ...objeto(tipos) };
  const ajustes: Objeto = { ...objeto(t.ajustes) };
  for (const k of claves) delete ajustes[k];
  if (Object.keys(ajustes).length) t.ajustes = ajustes;
  else delete t.ajustes;
  return limpiarTipos(t);
}

/** El aviso de «Borrar tipo» cuando el borrado no llegó al servidor (el tipo vuelve a estar). */
export function textoNoSeBorroTipo(estado: string): string {
  if (estado === 'sin-conexion') return 'No se pudo borrar el tipo. Revisa tu conexión y vuelve a intentarlo.';
  if (estado === 'sesion-cerrada') return 'No se pudo borrar el tipo: tu sesión se cerró. Entra de nuevo y vuelve a intentarlo.';
  if (estado === 'conflicto') return 'No se pudo borrar el tipo: otra persona cambió el borrador mientras editabas. Vuelve a intentarlo.';
  return 'No se pudo borrar el tipo. Intenta de nuevo.';
}
