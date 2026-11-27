// Datos comunes de las páginas públicas /privacidad, /terminos y /eliminar-datos (las URL que pide Meta
// para pasar la app «Parroquia en Vivo» a modo Live).

/**
 * Contacto público para dudas y pedidos de borrado. Provisional (2026-11-27): un mensaje a la página de
 * Facebook de la Parroquia de Ciudad Arce, hasta tener un correo de la parroquia.
 */
export const CONTACTO = {
  href: 'https://www.facebook.com/413231642046564',
  texto: 'la página de Facebook de la Parroquia de Ciudad Arce',
} as const;

/** Fecha de la última versión de los textos. */
export const ACTUALIZADO = '27 de noviembre de 2026';

export const RESPONSABLE =
  'la Pastoral de Comunicaciones de la Parroquia Inmaculada Concepción de María, Ciudad Arce, El Salvador';

export const PAGINAS_LEGALES = [
  { ruta: '/privacidad', titulo: 'Política de privacidad' },
  { ruta: '/terminos', titulo: 'Condiciones del servicio' },
  { ruta: '/eliminar-datos', titulo: 'Cómo eliminar tus datos' },
] as const;
