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
import type { EstadoVivo } from '../facebook/cliente';
import { crearTienda, type Tienda } from './tienda';
import type { Escena, EstadoTransmision } from './transmision';

/** Si terminar() no responde en este tiempo, se da la transmisión por terminada igual (review M7). */
export const ESPERA_TERMINAR_MS = 10_000;

export const MENSAJE_AJUSTES_ILEGIBLES = 'No se pudieron leer los Ajustes. Ábralos y vuelva a guardar.';
export const MENSAJE_TERMINAR_LENTO =
  'El celular tardó en cerrar la transmisión. Revise en Facebook que haya terminado.';

export const MENSAJE_FACEBOOK_RESPALDO = 'Facebook no respondió: se usa la clave de transmisión de la parroquia.';

/** A los cuántos ms de pasar a en_vivo se pregunta una vez a Facebook qué páginas salieron. */
export const ESPERA_REVISION_MS = 20_000;

/** Lo que devuelve pedirVivo: el vivo creado, un error (se cae a la clave fija) o null (sin Facebook directo). */
export type RespuestaVivo =
  | { servidor: string; clave: string; id: string; principal?: string; extras?: string[] }
  | { error: true }
  | null;

/** Lo que la pantalla muestra del vivo de Facebook: salio null = todavía sin revisar. */
export interface VivoVisible {
  principal: string;
  extras: { nombre: string; salio: boolean | null }[];
}

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
  /** null: la parroquia no tiene Facebook directo (se usa la clave como hoy). */
  pedirVivo?(): Promise<RespuestaVivo>;
  /** Cierra el vivo creado. Debe rechazar si no pudo, para que se reintente. */
  terminarVivo?(id: string): Promise<void>;
  /** Pregunta cómo va el vivo (null si no se pudo saber). Nunca debe rechazar. */
  estadoVivo?(id: string): Promise<EstadoVivo | null>;
  /** Lo que se muestra del vivo en curso (null: nada). */
  alFacebook?(vivo: VivoVisible | null): void;
  /** El corte se dio por perdido y Facebook ya cerró el vivo: la pantalla muestra «Facebook cerró la transmisión». */
  facebookCerro?(): void;
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
  // El vivo de Facebook del arranque en curso; se cierra una sola vez al cortar.
  let vivoId: string | null = null;
  let vivoVisible: VivoVisible | null = null;
  // Lo del vivo recién creado: se muestra cuando de verdad sale al aire.
  let pendienteVisible: VivoVisible | null = null;
  let relojRevision: ReturnType<typeof setTimeout> | null = null;

  function mostrar(v: VivoVisible | null) {
    vivoVisible = v;
    d.alFacebook?.(v);
  }

  function pararRevision() {
    if (relojRevision !== null) clearTimeout(relojRevision);
    relojRevision = null;
  }

  // Una sola vez, ESPERA_REVISION_MS después de pasar a en_vivo con un vivo de Facebook.
  function programarRevision(id: string) {
    if (relojRevision !== null || !d.estadoVivo) return;
    relojRevision = setTimeout(() => {
      void (async () => {
        let r: EstadoVivo | null = null;
        try {
          r = (await d.estadoVivo?.(id)) ?? null;
        } catch {
          r = null;
        }
        // Ya terminó, o es otro vivo: no se toca lo mostrado. Sin respuesta: queda como estaba.
        if (vivoId !== id || r === null || vivoVisible === null) return;
        mostrar({ principal: vivoVisible.principal, extras: r.extras.map((e) => ({ nombre: e.nombre, salio: e.salio })) });
      })();
    }, ESPERA_REVISION_MS);
  }

  // Se perdió la señal con el vivo al aire. Antes de cerrarlo se pregunta a Facebook: si ya lo cerró
  // él, la pantalla lo dice (el voluntario decide); si sigue activo o no se sabe, se cierra como siempre.
  async function alPerderVivo(id: string): Promise<void> {
    let r: EstadoVivo | null = null;
    try {
      r = (await d.estadoVivo?.(id)) ?? null;
    } catch {
      r = null;
    }
    if (r !== null && r.estado === 'terminado') {
      d.facebookCerro?.();
      return;
    }
    await cerrarVivo(id);
  }

  // Dos intentos como máximo; nunca bloquea ni lanza.
  async function cerrarVivo(id: string): Promise<void> {
    for (let i = 0; i < 2; i++) {
      try {
        await d.terminarVivo?.(id);
        return;
      } catch {
        // se reintenta una vez
      }
    }
  }

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
    pararRevision();
    if (vivoVisible !== null) mostrar(null);
    const id = vivoId;
    vivoId = null;
    if (id !== null && d.terminarVivo) void cerrarVivo(id);
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
    pararRevision();
    pendienteVisible = null;
    d.alArrancar();
    // Primero la escena Inicio, para que lo primero que salga al aire no sea la cámara.
    await d.cambiarEscena('inicio').catch(() => undefined);
    if (!vigente()) return;
    let servidor = a.servidor;
    let clave = a.clave;
    if (d.pedirVivo) {
      let vivo: RespuestaVivo;
      try {
        vivo = await d.pedirVivo();
      } catch {
        vivo = { error: true };
      }
      if (!vigente()) {
        // Se canceló mientras se pedía: si el vivo llegó, no queda abierto en Facebook.
        if (vivo !== null && 'id' in vivo) void cerrarVivo(vivo.id);
        return;
      }
      if (vivo !== null && 'id' in vivo) {
        servidor = vivo.servidor;
        clave = vivo.clave;
        vivoId = vivo.id;
        vivoVisible = null;
        pendienteVisible = vivo.principal !== undefined
          ? { principal: vivo.principal, extras: (vivo.extras ?? []).map((nombre) => ({ nombre, salio: null })) }
          : null;
      } else if (vivo !== null) {
        d.avisar(MENSAJE_FACEBOOK_RESPALDO);
      }
    }
    try {
      await d.iniciar(servidor, clave);
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
      if (e.conexion === 'conectado') {
        tienda.despachar({ tipo: 'conectado' });
        const id = vivoId;
        if (id !== null && tienda.obtener().fase === 'en_vivo') {
          if (vivoVisible === null && pendienteVisible !== null) mostrar(pendienteVisible);
          programarRevision(id);
        }
      } else if (e.conexion === 'reconectando') tienda.despachar({ tipo: 'reconectando' });
      else {
        // Con el vivo al aire se pregunta a Facebook antes de cerrarlo: el id se retira de aquí
        // para que el corte no lo cierre por su cuenta.
        const enAire = tienda.obtener().fase === 'en_vivo' || tienda.obtener().fase === 'reconectando';
        const perdido = enAire && d.estadoVivo && d.facebookCerro ? vivoId : null;
        if (perdido !== null) vivoId = null;
        tienda.despachar({ tipo: 'cortado', mensaje: e.mensaje ?? MENSAJES.desconocido });
        if (perdido !== null) void alPerderVivo(perdido);
        if (pideVolverAPreparar(e)) d.volverAPreparar();
      }
    },
  };
}
