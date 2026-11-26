// Brillo bajo en vivo (plan de rendimiento, Tarea 3). TypeScript puro, con tests.
// Una pantalla a todo brillo es mucho calor y batería; al aire, sin que nadie la toque, se baja
// a BAJO a los 30 s. El primer toque la despierta y no llega a ningún botón.

export const ESPERA_MS = 30_000;
/** Brillo de ventana de Android, de 0 a 1. */
export const BAJO = 0.1;
/** Vuelve al brillo que eligió el sistema. */
export const SISTEMA = -1;

export function crearAtenuador(aplicar: (nivel: number) => void): {
  /** true al entrar al aire, false al salir (vuelve a SISTEMA). */
  activar(b: boolean): void;
  /** Devuelve true si el toque solo despertó la pantalla (estaba atenuada). */
  tocar(): boolean;
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
    }, ESPERA_MS);
  };

  return {
    activar(b) {
      cancelar();
      activo = b;
      if (b) {
        armar();
      } else {
        atenuado = false;
        aplicar(SISTEMA);
      }
    },
    tocar() {
      if (!activo) return false;
      if (atenuado) {
        atenuado = false;
        aplicar(SISTEMA);
        armar();
        return true;
      }
      armar();
      return false;
    },
    soltar() {
      cancelar();
    },
  };
}

/**
 * Envuelve `tocar` para que cuente una sola vez por toque. En React Native `onTouchStart` y
 * `onStartShouldSetResponderCapture` pueden llegar en cualquier orden para el mismo toque, y un
 * segundo `tocar()` devolvería false (ya despierta) y dejaría pasar el toque que había que tragar.
 * Se reconoce el toque por la marca de tiempo del evento; sin marca no se puede deduplicar y cada
 * llamada cuenta.
 */
export function unaVezPorToque(tocar: () => boolean): (marca: number | undefined) => boolean {
  let ultimaMarca: number | undefined;
  let ultimoResultado = false;
  return (marca) => {
    if (marca !== undefined && marca === ultimaMarca) return ultimoResultado;
    ultimaMarca = marca;
    ultimoResultado = tocar();
    return ultimoResultado;
  };
}
