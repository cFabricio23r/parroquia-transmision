// Aviso a Vercel para que reconstruya el sitio (publicar, restaurar, desactivar y reactivar).
// Sin dependencias de Next. La URL del hook es un secreto: nunca se escribe en el registro ni en la consola.
export type EstadoHook = 'ok' | 'fallo' | 'sin-configurar';

/** Avisa a Vercel que reconstruya. Un fallo no deshace lo que ya se hizo. No registra la URL (es secreta). */
export async function avisarDespliegue(url: string | undefined): Promise<EstadoHook> {
  if (!url) return 'sin-configurar';
  try {
    const r = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(10_000) });
    void r.body?.cancel();
    if (r.ok) return 'ok';
    console.error(`[despliegue] el aviso a Vercel respondió ${r.status}`);
  } catch (e) {
    // Solo el tipo de error: el mensaje de un fallo de red puede traer la dirección.
    console.error('[despliegue] no se pudo avisar a Vercel:', e instanceof Error ? e.name : 'error');
  }
  return 'fallo';
}
