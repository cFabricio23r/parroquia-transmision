// Orquesta iniciar, cancelar y terminar sobre la tienda (TypeScript puro, dependencias inyectadas).
// Antes vivía en App.tsx sin tests (review I1 y M8 de la Tarea 8).
// La clave solo pasa de leerAjustes() a iniciar(): nunca se guarda ni se muestra.
import {
  ErrorTransmisor,
  MENSAJES,
  pideVolverAPreparar,
  type Conexion,
  type EventoEstado,
} from '../../modules/transmisor/src/eventos';
import { validar, type Ajustes } from '../ajustes/ajustes';
import { crearTienda, type Tienda } from './tienda';
import type { Escena, EstadoTransmision } from './transmision';

/** Si terminar() no responde en este tiempo, se da la transmisión por terminada igual (review M7). */
export const ESPERA_TERMINAR_MS = 10_000;

export const MENSAJE_AJUSTES_ILEGIBLES = 'No se pudieron leer los Ajustes. Ábralos y vuelva a guardar.';
export const MENSAJE_TERMINAR_LENTO =
  'El celular tardó en cerrar la transmisión. Revise en Facebook que haya terminado.';

export interface DepsOrquestador {
  leerAjustes(): Promise<Ajustes>;
  cambiarEscena(escena: Escena): Promise<void>;
  iniciar(servidor: string, clave: string): Promise<void>;
  terminar(): Promise<void>;
  /** Se despachó 'iniciar': cerrar Ajustes, limpiar Mbps y pasar el panel a En vivo. */
  alArrancar(): void;
  abrirAjustes(): void;
  /** Un aviso para la pantalla (null lo borra). Siempre un texto fijo, sin datos. */
  avisar(mensaje: string | null): void;
  /** Corte de tipo «preparar»: volver a preparar la cámara (review N3 de la Tarea 6). */
  volverAPreparar(): void;
}

export interface Orquestador {
  tienda: Tienda;
  iniciar(): Promise<void>;
  /** Cancela un arranque en curso (botón Cancelar de la barra). */
  cancelar(): void;
  terminarConGracias(): void;
  terminarAhora(): void;
  seguir(): void;
  /** Un evento de la conexión nativa. */
  alEvento(e: EventoEstado): void;
}

export function crearOrquestador(d: DepsOrquestador): Orquestador {
  // Cada arranque tiene su número. Después de cada espera, un arranque que ya no es el último
  // (se canceló, o se volvió a tocar Iniciar) no sigue: ni llama al nativo ni despacha un corte.
  let intento = 0;
  let ultimaConexion: Conexion | null = null;

  // Cuando hay que cortar se llama a terminar() una sola vez. Si se estaba terminando, al
  // resolver (o a los ESPERA_TERMINAR_MS, lo que pase primero) se pasa a 'terminado'.
  function alCortar(despues: EstadoTransmision) {
    const terminando = despues.fase === 'terminando';
    let hecho = false;
    const cerrar = (lento: boolean) => {
      if (hecho) return;
      hecho = true;
      clearTimeout(espera);
      if (!terminando) return;
      if (lento) d.avisar(MENSAJE_TERMINAR_LENTO);
      tienda.despachar({ tipo: 'terminado' });
    };
    const espera = setTimeout(() => cerrar(true), ESPERA_TERMINAR_MS);
    // Dentro de una promesa: si terminar() lanzara de forma síncrona, la excepción no sale de
    // tienda.despachar antes de avisar a los oyentes (review m3 de la Tarea 8).
    Promise.resolve()
      .then(() => d.terminar())
      .catch(() => undefined)
      .then(() => cerrar(false));
  }

  const tienda = crearTienda(alCortar);

  async function iniciar(): Promise<void> {
    d.avisar(null);
    let a: Ajustes;
    try {
      a = await d.leerAjustes();
    } catch {
      d.avisar(MENSAJE_AJUSTES_ILEGIBLES);
      return;
    }
    if (!validar(a).ok) {
      d.abrirAjustes();
      return;
    }
    const antes = tienda.obtener();
    tienda.despachar({ tipo: 'iniciar' });
    // Un segundo toque mientras arranca no hace nada.
    if (tienda.obtener() === antes) return;
    const mio = ++intento;
    const vigente = () => mio === intento && tienda.obtener().fase === 'iniciando';
    ultimaConexion = null;
    d.alArrancar();
    // Primero la escena Inicio, para que lo primero que salga al aire no sea la cámara.
    await d.cambiarEscena('inicio').catch(() => undefined);
    if (!vigente()) return;
    try {
      await d.iniciar(a.servidor, a.clave);
    } catch (e) {
      if (mio !== intento) return;
      const err = e instanceof ErrorTransmisor ? e : null;
      tienda.despachar({ tipo: 'cortado', mensaje: err ? err.message : MENSAJES.noInicia });
      if (err?.codigo === 'preparar') d.volverAPreparar();
    }
  }

  return {
    tienda,
    iniciar,
    cancelar() {
      intento++;
      tienda.despachar({ tipo: 'terminar_ahora' });
    },
    terminarConGracias() {
      intento++;
      tienda.despachar({ tipo: 'terminar_con_gracias' });
    },
    terminarAhora() {
      intento++;
      tienda.despachar({ tipo: 'terminar_ahora' });
    },
    seguir() {
      tienda.despachar({ tipo: 'seguir' });
      // 'seguir' vuelve a en_vivo; si la señal sigue caída, se vuelve a reconectando (review de la Tarea 4).
      if (ultimaConexion === 'reconectando') tienda.despachar({ tipo: 'reconectando' });
    },
    alEvento(e) {
      ultimaConexion = e.conexion;
      if (e.conexion === 'conectado') tienda.despachar({ tipo: 'conectado' });
      else if (e.conexion === 'reconectando') tienda.despachar({ tipo: 'reconectando' });
      else {
        tienda.despachar({ tipo: 'cortado', mensaje: e.mensaje ?? MENSAJES.desconocido });
        if (pideVolverAPreparar(e)) d.volverAPreparar();
      }
    },
  };
}
