// Cómo se muestra a una persona en el encabezado y en Mi cuenta (Decisión 4 del plan 2).
// Puro: sin Supabase ni Next. Sin nombre guardado en `perfiles`, se usa el correo.
export const ROL_COORDINADOR = 'Coordinador';
export const ROL_ADMIN = 'Admin de vicaría';

export function etiquetaRol(esAdmin: boolean): string {
  return esAdmin ? ROL_ADMIN : ROL_COORDINADOR;
}

const limpio = (nombre: string | null) => (nombre ?? '').trim().replace(/\s+/g, ' ');

/** El nombre recortado o, si no hay, el correo. */
export function nombreVisible(nombre: string | null, correo: string): string {
  return limpio(nombre) || correo;
}

/** La primera palabra del nombre o, si no hay, el correo. */
export function primerNombre(nombre: string | null, correo: string): string {
  const n = limpio(nombre);
  return n ? n.split(' ')[0] : correo;
}

/** Primera letra (en mayúscula) del nombre o del correo, para el avatar. Respeta emoji y tildes. */
export function inicial(nombre: string | null, correo: string): string {
  const base = limpio(nombre) || correo.trim();
  const primera = Array.from(base)[0] ?? '?';
  return primera.toLocaleUpperCase('es');
}

/** «Fabricio · Coordinador»; con `completo`, el nombre entero («María López · Coordinador»). */
export function etiquetaUsuario(u: { nombre: string | null; correo: string; esAdmin: boolean }, completo = false): string {
  const quien = completo ? nombreVisible(u.nombre, u.correo) : primerNombre(u.nombre, u.correo);
  return `${quien} · ${etiquetaRol(u.esAdmin)}`;
}

/**
 * Quién publicó una versión (Decisión 24 del plan 5): «Pastoral (admin)» si hoy es administrador; si
 * no, su nombre o su correo; «—» si la cuenta ya no existe.
 */
export function autorDeVersion(p: { esAdmin: boolean; nombre: string | null; correo: string | null } | null): string {
  if (!p) return '—';
  if (p.esAdmin) return 'Pastoral (admin)';
  return limpio(p.nombre) || (p.correo ?? '').trim() || '—';
}
