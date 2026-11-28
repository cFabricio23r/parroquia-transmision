// Errores de forma y de completitud del borrador (spec, sección 8; Decisión 9 del plan 3).
// Forma: tipo equivocado, valor fuera de lista, límite superado; el PUT los rechaza con 422.
// Completitud: obligatorio vacío, alt vacío, poco contraste; se guardan y solo bloquean publicar.
// Solo servidor: importa lib/validar (usa node:vm).
import { validarBorrador } from '../validar';
import { contraste, MIN_CONTRASTE } from '../contraste';
import { bloqueDeError } from './errores';
import { BLOQUES } from './secciones';

export const CLAVES_BORRADOR: readonly string[] = BLOQUES;

const RE_HEX = /^#[0-9a-fA-F]{6}$/;
const RELLENO = 'x';

const esObjeto = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const vacio = (v: unknown) => typeof v !== 'string' || v.trim() === '';
const vacioOpcional = (v: unknown) => v === undefined || (typeof v === 'string' && v.trim() === '');

/** Claves de `cambios` que no son bloques del borrador. */
export function clavesDesconocidas(cambios: object): string[] {
  return Object.keys(cambios).filter((k) => !CLAVES_BORRADOR.includes(k));
}

/** A cualquier profundidad: todo objeto con `src` de texto y sin alt recibe un alt de relleno. */
function rellenarAlts(v: unknown): void {
  if (Array.isArray(v)) v.forEach(rellenarAlts);
  else if (esObjeto(v)) {
    if (typeof v.src === 'string' && vacioOpcional(v.alt)) v.alt = RELLENO;
    Object.values(v).forEach(rellenarAlts);
  }
}

/**
 * Copia del borrador con un valor de relleno en todo lo que es de completitud (obligatorio vacío,
 * alt vacío, color válido con poco contraste). Lo que sigue fallando después es de forma. No muta.
 */
export function completarParaForma(borrador: unknown): Record<string, unknown> {
  const b: Record<string, unknown> = esObjeto(borrador) ? structuredClone(borrador) : {};
  if (vacio(b.nombre)) b.nombre = RELLENO;
  if (vacio(b.lugar)) b.lugar = RELLENO;

  if (!esObjeto(b.patrono)) b.patrono = { nombre: RELLENO, corto: RELLENO };
  const p = b.patrono as Record<string, unknown>;
  if (vacioOpcional(p.nombre)) p.nombre = RELLENO;
  if (vacioOpcional(p.corto)) p.corto = RELLENO;

  if (!esObjeto(b.colores)) b.colores = {};
  const col = b.colores as Record<string, unknown>;
  for (const k of ['principal', 'oscuro']) {
    const v = col[k];
    if (v === undefined || (typeof v === 'string' && RE_HEX.test(v) && contraste('#ffffff', v) < MIN_CONTRASTE)) col[k] = '#000000';
  }

  if (!esObjeto(b.logos)) b.logos = {};
  const logos = b.logos as Record<string, unknown>;
  if (logos.blanco === undefined) logos.blanco = { src: 'medios/x.png', alt: RELLENO };
  if (b.fachada === undefined) b.fachada = { src: 'medios/x.png', alt: RELLENO };

  if (!esObjeto(b.fiesta)) b.fiesta = { dia: 1, mes: 1 };
  const f = b.fiesta as Record<string, unknown>;
  if (f.mes === undefined) f.mes = 1;
  if (f.dia === undefined) f.dia = 1;

  rellenarAlts(b);

  if (Array.isArray(b.galeria)) b.galeria.forEach((im) => esObjeto(im) && vacioOpcional(im.alt) && (im.alt = RELLENO));
  if (Array.isArray(b.horarios)) {
    for (const h of b.horarios) {
      if (!esObjeto(h)) continue;
      if (vacioOpcional(h.dia)) h.dia = RELLENO;
      if (h.horas === undefined) {
        if (vacioOpcional(h.hora)) h.hora = RELLENO;
      } else if (Array.isArray(h.horas)) {
        if (h.horas.length === 0) h.horas = [{ hora: RELLENO }];
        for (const o of h.horas as unknown[]) if (esObjeto(o) && vacioOpcional(o.hora)) o.hora = RELLENO;
      }
    }
  }
  for (const k of ['avisos', 'redes'] as const) {
    const l = b[k];
    if (Array.isArray(l)) for (const x of l) if (esObjeto(x) && vacioOpcional(x.texto)) x.texto = RELLENO;
  }
  // Un título en cámara recién agregado y todavía vacío frena publicar, no guardar (2026-11-27).
  if (Array.isArray(b.titulosCamara)) b.titulosCamara = b.titulosCamara.map((t) => (vacioOpcional(t) ? RELLENO : t));
  return b;
}

export function clasificarErrores(borrador: unknown, slug: string): { todos: string[]; forma: string[]; completitud: string[] } {
  const todos = [...new Set(validarBorrador(borrador, slug).errores)];
  const conRelleno = new Set(validarBorrador(completarParaForma(borrador), slug).errores);
  const forma = todos.filter((e) => conRelleno.has(e));
  const completitud = todos.filter((e) => !conRelleno.has(e));
  return { todos, forma, completitud };
}

/** Los errores de forma de los bloques pedidos (Decisión 10: un bloque viejo que nadie toca no impide guardar). */
export function erroresDeFormaEn(borrador: unknown, slug: string, bloques: readonly string[]): string[] {
  return clasificarErrores(borrador, slug).forma.filter((e) => {
    const b = bloqueDeError(e);
    return b !== null && bloques.includes(b);
  });
}
