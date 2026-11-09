// Reglas de los identificadores de parroquia (el primer segmento de la dirección).
// Misma forma que RE_SLUG de vicaria/parroquia.js: minúsculas y dígitos separados por guiones, de 2 a 40.
const RE_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Rutas del sistema que una parroquia no puede ocupar.
const RESERVADOS = ['editor', 'api', 'auth', '_next', 'fuentes', 'img', 'medios'];

/** Devuelve el mensaje de error del slug, o null si es válido. `slugsDelRepo` son las carpetas de vicaria/. */
export function revisarSlug(slug: string, slugsDelRepo: string[]): string | null {
  if (typeof slug !== 'string' || slug.length < 2 || slug.length > 40) {
    return 'La dirección debe tener entre 2 y 40 caracteres.';
  }
  if (!RE_SLUG.test(slug)) {
    return 'La dirección solo puede llevar minúsculas sin tildes, números y guiones sueltos (como san-pedro-apostol).';
  }
  if (RESERVADOS.includes(slug) || slugsDelRepo.includes(slug)) {
    return 'Esa dirección ya está en uso o está reservada. Elige otra.';
  }
  return null;
}
