// Qué decirle a quien publicó: ¿la versión ya llegó a las pantallas? Pura y sin dependencias,
// para poder usarla en el navegador (Versiones.tsx) sin arrastrar el código del servidor.

/**
 * `enPantallas` es el `version` que devuelve `/<slug>/config.json` (null si no respondió o dio 404);
 * `ultima` es el número más alto publicado (null si todavía no se publicó nada).
 */
export function estadoDeLlegada(enPantallas: number | null, ultima: number | null): string {
  if (ultima === null) return 'Todavía no publicaste';
  if (enPantallas === null) return `Publicaste la versión ${ultima}; las pantallas todavía no la tienen`;
  if (enPantallas < ultima) {
    return `Publicaste la versión ${ultima}; todavía no llegó a las pantallas (están en la ${enPantallas})`;
  }
  return `Publicado y en las pantallas (versión ${enPantallas})`;
}
