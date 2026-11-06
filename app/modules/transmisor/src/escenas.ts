// Cola de cambios de escena: corre una transición a la vez. Si llegan pedidos mientras
// corre una, se guarda solo el último; los reemplazados resuelven cuando termina la
// transición que llega a la escena final.
import type { Escena } from '../../../src/estado/transmision';

type Espera = { resolver: () => void; rechazar: (e: unknown) => void };

export type ColaEscenas = {
  /** Resuelve al terminar la transición (o la que la reemplazó). */
  pedir(escena: Escena): Promise<void>;
  /** La escena que se ve ahora (la última transición terminada bien); null si no se sabe. */
  actual(): Escena | null;
};

export function crearColaEscenas(
  ejecutar: (escena: Escena) => Promise<void>,
  inicial: Escena | null = null,
): ColaEscenas {
  // null = no se sabe cuál se ve (p. ej. tras recargar el JS): el primer pedido va al nativo.
  let actual: Escena | null = inicial;
  let destino: Escena | null = null; // la que corre ahora
  let enCurso: Espera[] = [];
  let pendiente: Escena | null = null;
  let enEspera: Espera[] = [];

  function correr(escena: Escena, esperas: Espera[]) {
    destino = escena;
    enCurso = esperas;
    ejecutar(escena).then(
      () => {
        actual = escena;
        terminar(null);
      },
      (e: unknown) => terminar(e),
    );
  }

  function terminar(error: unknown) {
    const hechas = enCurso;
    destino = null;
    enCurso = [];
    const siguiente = pendiente;
    const susEsperas = enEspera;
    pendiente = null;
    enEspera = [];
    if (siguiente !== null && siguiente !== actual) {
      correr(siguiente, susEsperas);
    } else {
      // Nada más que hacer: los reemplazados ya están en la escena pedida al final.
      for (const w of susEsperas) w.resolver();
    }
    for (const w of hechas) {
      if (error === null) w.resolver();
      else w.rechazar(error);
    }
  }

  return {
    pedir(escena) {
      return new Promise<void>((resolver, rechazar) => {
        const espera = { resolver, rechazar };
        if (destino === null) {
          if (escena === actual) return resolver();
          return correr(escena, [espera]);
        }
        // Corre una transición: el pedido nuevo reemplaza al pendiente.
        if (escena === destino) {
          // Ya va hacia esa escena: no hace falta otra transición.
          pendiente = null;
          enCurso.push(espera, ...enEspera);
          enEspera = [];
          return;
        }
        pendiente = escena;
        enEspera.push(espera);
      });
    },
    actual: () => actual,
  };
}
