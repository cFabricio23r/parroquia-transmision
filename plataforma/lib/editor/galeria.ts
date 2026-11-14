// Galería del borrador (plan 3; la completa la Tarea 14). Sin React: se prueba sola.
import { NOMBRES_VISTAS } from './secciones';
import { MENSAJE_ALT_VACIO } from './imagen';

export interface ImagenGaleria {
  id: string;
  src: string;
  alt: string;
  nombre?: string;
  etiquetas?: string[];
}

/** Cómo se nombra una imagen en la interfaz: su nombre, si no su alt. */
export function nombreDeImagen(im: Partial<ImagenGaleria>): string {
  if (typeof im.nombre === 'string' && im.nombre.trim()) return im.nombre.trim();
  if (typeof im.alt === 'string' && im.alt.trim()) return im.alt.trim();
  return 'Imagen sin descripción';
}

/** Las imágenes bien formadas de `config.galeria` (las demás no se muestran). */
export function imagenesDe(galeria: unknown): ImagenGaleria[] {
  if (!Array.isArray(galeria)) return [];
  return galeria.filter(
    (im): im is ImagenGaleria => !!im && typeof im === 'object' && typeof im.id === 'string' && typeof im.src === 'string',
  );
}

export const MAX_GALERIA = 30;
export const ETIQUETAS_GALERIA = [
  { valor: 'patrono', texto: 'Patrono' },
  { valor: 'santos', texto: 'Santos' },
  { valor: 'custodia', texto: 'Custodia' },
  { valor: 'fachada', texto: 'Fachada' },
  { valor: 'fondos', texto: 'Fondos' },
] as const;

function seisHex(): string {
  const b = new Uint8Array(3);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** `img-` + 6 caracteres al azar, sin repetir un id existente. */
export function nuevoIdGaleria(existentes: string[], azar: () => string = seisHex): string {
  const usados = new Set(existentes);
  for (;;) {
    const id = `img-${azar()}`;
    if (!usados.has(id)) return id;
  }
}

/** El texto de la primera etiqueta conocida de la imagen, o null. */
export function etiquetaDe(im: Partial<ImagenGaleria>): string | null {
  for (const e of Array.isArray(im.etiquetas) ? im.etiquetas : []) {
    const conocida = ETIQUETAS_GALERIA.find((x) => x.valor === e);
    if (conocida) return conocida.texto;
  }
  return null;
}

export function filtrar<T extends Partial<ImagenGaleria>>(lista: T[], valor: string | null): T[] {
  if (!valor) return lista;
  return lista.filter((im) => Array.isArray(im.etiquetas) && im.etiquetas.includes(valor));
}

type Objeto = Record<string, unknown>;
const objeto = (v: unknown): Objeto => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Objeto) : {});

/** Dónde se usa una imagen de la galería: solo las referencias `galeria:<id>` y los fondos (Decisión 4). */
export function usosDeImagen(config: object, id: string, nombresTipos: Record<string, string> = {}): string[] {
  const c = config as Objeto;
  const ref = `galeria:${id}`;
  const usos: string[] = [];
  const pantallas = objeto(c.pantallas);
  for (const [v, pa] of Object.entries(pantallas)) {
    if (objeto(pa).imagen === ref) usos.push(`Pantalla de ${NOMBRES_VISTAS[v] ?? v}`);
  }
  for (const [v, pa] of Object.entries(pantallas)) {
    if (objeto(objeto(pa).fondo).imagen === id) usos.push(`Fondo de la pantalla de ${NOMBRES_VISTAS[v] ?? v}`);
  }
  const tipos = objeto(c.tipos);
  for (const p of Array.isArray(tipos.propios) ? tipos.propios : []) {
    const o = objeto(p);
    if (o.imagen === ref) usos.push(`Tipo «${typeof o.nombre === 'string' ? o.nombre : String(o.clave)}»`);
  }
  for (const [clave, a] of Object.entries(objeto(tipos.ajustes))) {
    if (objeto(a).imagen === ref) usos.push(`Tipo «${nombresTipos[clave] ?? clave}» (ajuste)`);
  }
  return usos;
}

/**
 * Los bloques que cambian al borrar una imagen: la galería sin ella, y sin ninguna referencia que
 * quede colgando en pantallas (vuelven a la imagen automática; el fondo de imagen se quita) ni en
 * tipos (Review Focus 5).
 */
export function quitarImagen(config: object, id: string): Partial<Record<'galeria' | 'pantallas' | 'tipos', unknown>> {
  const c = config as Objeto;
  const ref = `galeria:${id}`;
  const cambios: Partial<Record<'galeria' | 'pantallas' | 'tipos', unknown>> = {
    galeria: (Array.isArray(c.galeria) ? c.galeria : []).filter((im) => objeto(im).id !== id),
  };

  const pantallas = objeto(c.pantallas);
  let pantallasCambian = false;
  const nuevasPantallas: Objeto = {};
  for (const [v, pa] of Object.entries(pantallas)) {
    const o = objeto(pa);
    if (o.imagen !== ref && objeto(o.fondo).imagen !== id) {
      nuevasPantallas[v] = pa;
      continue;
    }
    pantallasCambian = true;
    const copia: Objeto = { ...o };
    if (copia.imagen === ref) delete copia.imagen;
    if (objeto(copia.fondo).imagen === id) delete copia.fondo;
    nuevasPantallas[v] = copia;
  }
  if (pantallasCambian) cambios.pantallas = nuevasPantallas;

  const tipos = objeto(c.tipos);
  let tiposCambian = false;
  const nuevosTipos: Objeto = { ...tipos };
  if (Array.isArray(tipos.propios)) {
    nuevosTipos.propios = tipos.propios.map((p) => {
      if (objeto(p).imagen !== ref) return p;
      tiposCambian = true;
      const copia: Objeto = { ...objeto(p) };
      delete copia.imagen;
      return copia;
    });
  }
  if (Object.keys(objeto(tipos.ajustes)).length) {
    const ajustes: Objeto = {};
    for (const [clave, a] of Object.entries(objeto(tipos.ajustes))) {
      if (objeto(a).imagen !== ref) {
        ajustes[clave] = a;
        continue;
      }
      tiposCambian = true;
      const copia: Objeto = { ...objeto(a) };
      delete copia.imagen;
      ajustes[clave] = copia;
    }
    nuevosTipos.ajustes = ajustes;
  }
  if (tiposCambian) cambios.tipos = nuevosTipos;
  return cambios;
}

/** Límite de vicaria/parroquia.js (MAX_TEXTO) para la descripción y el nombre de una imagen. */
export const MAX_TEXTO_IMAGEN = 200;
export const MENSAJE_LARGO = 'Hasta 200 caracteres.';

/** Errores de la descripción y el nombre de una imagen, sobre el texto ya recortado. */
export function erroresTextosImagen({ alt, nombre }: { alt: string; nombre: string }): { alt?: string; nombre?: string } {
  const e: { alt?: string; nombre?: string } = {};
  if (!alt.trim()) e.alt = MENSAJE_ALT_VACIO;
  else if (alt.trim().length > MAX_TEXTO_IMAGEN) e.alt = MENSAJE_LARGO;
  if (nombre.trim().length > MAX_TEXTO_IMAGEN) e.nombre = MENSAJE_LARGO;
  return e;
}
