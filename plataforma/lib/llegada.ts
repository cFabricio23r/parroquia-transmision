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

export const AVISO_HOOK_FALLO =
  'La versión quedó publicada, pero no se pudo avisar para que las pantallas se actualicen. Avisa al administrador.';
export const AVISO_HOOK_SIN_CONFIGURAR =
  'La versión quedó publicada, pero las pantallas no se van a actualizar hasta que se configure el aviso de despliegue (deploy hook). Avisa al administrador.';

/**
 * El aviso que acompaña una publicación según lo que respondió el hook de Vercel. En desarrollo
 * (`next dev`, sin hook) no se avisa de 'sin-configurar': ahí no hay despliegue que avisar.
 */
export function avisoDeHook(hook: string | undefined, entorno: string | undefined): string | undefined {
  if (hook === 'fallo') return AVISO_HOOK_FALLO;
  if (hook === 'sin-configurar' && entorno !== 'development') return AVISO_HOOK_SIN_CONFIGURAR;
  return undefined;
}
