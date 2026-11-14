// Envío de un formulario a una Server Action (plan 2, ronda 2). Sin React, para probarlo suelto.
// - Un solo envío a la vez con un cerrojo (ref), en vez de `disabled`: un botón deshabilitado
//   pierde el foco y el teclado o el lector de pantalla vuelven al principio de la página.
// - Si la acción falla (red caída, servidor reiniciado, 5xx) se suelta el botón y se avisa.
// - Una redirección de Next llega como rechazo de la promesa (server-action-reducer.js de
//   next 16.4.5: «the action promise will be rejected with a redirect»): `relanzar` la deja pasar.

export type ResultadoEnvio<T> = { tipo: 'ok'; valor: T } | { tipo: 'fallo' } | { tipo: 'ocupado' };

export async function enviarUnaVez<T>(
  cerrojo: { current: boolean },
  marcar: (ocupado: boolean) => void,
  accion: () => Promise<T>,
  relanzar: (error: unknown) => void,
): Promise<ResultadoEnvio<T>> {
  if (cerrojo.current) return { tipo: 'ocupado' };
  cerrojo.current = true;
  marcar(true);
  try {
    return { tipo: 'ok', valor: await accion() };
  } catch (e) {
    relanzar(e); // redirect() y compañía: Next los maneja
    console.error('[enviarUnaVez]', e instanceof Error ? e.message : e);
    return { tipo: 'fallo' };
  } finally {
    cerrojo.current = false;
    marcar(false);
  }
}
