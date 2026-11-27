// Brillo bajo en vivo (plan de rendimiento, Tarea 3). TypeScript puro, con tests.
// Una pantalla a todo brillo es mucho calor y batería; al aire, sin que nadie la toque, se baja
// a BAJO a los 30 s. El primer toque la despierta y no llega a ningún botón.

export const ESPERA_MS = 30_000;
/** Brillo de ventana de Android, de 0 a 1. */
export const BAJO = 0.1;
/** Vuelve al brillo que eligió el sistema. */
export const SISTEMA = -1;

export function crearAtenuador(
  aplicar: (nivel: number) => void,
  /** Avisa cada vez que la pantalla pasa a atenuada (true) o deja de estarlo (false). */
  alCambiar: (atenuado: boolean) => void = () => undefined,
): {
  /** true al entrar al aire, false al salir (vuelve a SISTEMA). */
  activar(b: boolean): void;
  /** Devuelve true si el toque solo despertó la pantalla (estaba atenuada). */
  tocar(): boolean;
  /** Despierta sin que haya un toque (reconexión, aviso nuevo): restaura SISTEMA si estaba atenuada y rearma la espera. */
  despertar(): void;
  soltar(): void;
} {
  let activo = false;
  let atenuado = false;
  let temporizador: ReturnType<typeof setTimeout> | null = null;

  const cancelar = () => {
    if (temporizador !== null) {
      clearTimeout(temporizador);
      temporizador = null;
    }
  };
  const armar = () => {
    cancelar();
    temporizador = setTimeout(() => {
      temporizador = null;
      atenuado = true;
      aplicar(BAJO);
      alCambiar(true);
    }, ESPERA_MS);
  };

  return {
    activar(b) {
      cancelar();
      activo = b;
      if (b) {
        armar();
      } else {
        const estaba = atenuado;
        atenuado = false;
        aplicar(SISTEMA);
        if (estaba) alCambiar(false);
      }
    },
    tocar() {
      if (!activo) return false;
      if (atenuado) {
        atenuado = false;
        aplicar(SISTEMA);
        alCambiar(false);
        armar();
        return true;
      }
      armar();
      return false;
    },
    despertar() {
      if (!activo) return;
      if (atenuado) {
        atenuado = false;
        aplicar(SISTEMA);
        alCambiar(false);
      }
      armar();
    },
    soltar() {
      // No restaura el brillo: el de la ventana es por actividad y muere con ella.
      cancelar();
    },
  };
}
