// Galería del borrador (plan 3; la completa la Tarea 14). Sin React: se prueba sola.

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
