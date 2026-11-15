/**
 * Control de la sesión de la app: une el almacén, la sesión con renovación, la lista de
 * parroquias, la guardia en vivo y las limpiezas, y expone la tienda para las pantallas.
 *
 * - `cargar()` no usa la red: con sesión y parroquia guardadas entra enseguida (Review Focus 1).
 * - `revisar()` es la tarea 'acceso' del momento 'abrir'.
 * - Lo que llega en vivo queda pendiente y se aplica con `guardia.alTerminar`.
 *
 * Nada de acá escribe en `console.*` ni guarda la contraseña.
 */
import { obtenerConfig } from '../config/compilacion';
import { crearClienteSupabase, type ClienteSupabase, type ErrorSupabase } from '../supabase/cliente';
import { limpiezas as limpiezasApp, sincronizador as sincronizadorApp, type Limpiezas, type Sincronizador } from '../sincronizar/sincronizar';
import { almacenSesion, type AlmacenSesion } from './almacen';
import { guardiaEnVivo, type GuardiaEnVivo } from './guardia';
import { leerCuenta, leerParroquias } from './parroquias';
import { crearSesionApp, type SesionApp } from './sesion';
import { crearTiendaSesion, type EstadoSesion, type EventoSesion } from './tiendaSesion';
import type { ParroquiaApp } from './tipos';

export interface ControlSesion {
  tienda: { obtener(): EstadoSesion; suscribir(cb: () => void): () => void };
  sesion: SesionApp;
  cliente: ClienteSupabase;
  cargar(): Promise<void>;
  entrar(correo: string, clave: string): Promise<{ error?: ErrorSupabase }>;
  elegir(p: ParroquiaApp): Promise<void>;
  cambiarParroquia(): void;
  revisar(): Promise<void>;
  cerrarSesion(): Promise<{ error?: 'en-vivo' }>;
}

function mismaParroquia(a: ParroquiaApp | null, b: ParroquiaApp | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.id === b.id && a.slug === b.slug && a.nombre === b.nombre;
}

export function crearControlSesion(d: {
  cliente: ClienteSupabase;
  almacen: AlmacenSesion;
  guardia: GuardiaEnVivo;
  limpiezas: Limpiezas;
  sincronizador: Sincronizador;
  /** false cuando falta la configuración de compilación: `cargar()` despacha `error-almacen`. */
  configOk?: boolean;
}): ControlSesion {
  const { cliente, almacen, guardia, limpiezas } = d;
  const sesion = crearSesionApp({ cliente, almacen });

  /** Escrituras en el almacén y limpiezas que salen de un cambio de estado, en orden. */
  let trabajo: Promise<void> = Promise.resolve();
  function encolar(fn: () => Promise<unknown>) {
    trabajo = trabajo.then(fn).then(
      () => {},
      () => {},
    );
  }

  async function olvidarParroquia(p: ParroquiaApp) {
    await limpiezas.limpiar({ tipo: 'parroquia', parroquia: p });
    await almacen.borrarParroquia();
  }

  let esperandoFin = false;

  const tienda = crearTiendaSesion((antes, despues) => {
    if (despues.fase === 'sin-acceso' && despues.perdida && despues.perdida !== antes.perdida) {
      const perdida = despues.perdida;
      encolar(() => olvidarParroquia(perdida));
    }
    if (despues.parroquia && !mismaParroquia(antes.parroquia, despues.parroquia)) {
      const p = despues.parroquia;
      encolar(() => almacen.guardarParroquia(p));
    }
    if (despues.pendiente && !esperandoFin) {
      esperandoFin = true;
      guardia.alTerminar(() => {
        esperandoFin = false;
        despachar({ tipo: 'termino-transmision' });
      });
    }
  });

  function despachar(ev: EventoSesion) {
    tienda.despachar(ev);
  }

  sesion.alInvalidarse(() => despachar({ tipo: 'sesion-invalida', enVivo: guardia.enVivo() }));

  async function revisar(): Promise<void> {
    const r = await leerParroquias(sesion, cliente);
    if (!r.ok) return; // Sin red o sesión inválida (ya despachada por alInvalidarse): queda lo que hay.
    try {
      await almacen.guardarParroquias(r.valor);
    } catch {
      // La lista guardada es solo para abrir sin red; se sigue igual.
    }
    despachar({ tipo: 'lista-revisada', parroquias: r.valor, enVivo: guardia.enVivo() });
    await trabajo;
  }

  d.sincronizador.registrarTarea('acceso', ['abrir'], () => revisar());

  return {
    tienda: { obtener: tienda.obtener, suscribir: tienda.suscribir },
    sesion,
    cliente,

    async cargar() {
      if (d.configOk === false) {
        despachar({ tipo: 'error-almacen' });
        return;
      }
      let leido: Extract<EventoSesion, { tipo: 'cargada' }>;
      try {
        const s = await sesion.cargar();
        const [parroquia, parroquias, cuenta] = await Promise.all([
          almacen.leerParroquia(),
          almacen.leerParroquias(),
          almacen.leerCuenta(),
        ]);
        leido = { tipo: 'cargada', conSesion: s !== null, cuenta, parroquia, parroquias };
      } catch {
        despachar({ tipo: 'error-almacen' });
        return;
      }
      despachar(leido);
      await trabajo;
    },

    async entrar(correo, clave) {
      const r = await cliente.entrar(correo, clave);
      if (!r.ok) return { error: r.error };
      await sesion.guardar(r.valor);
      const cuenta = await leerCuenta(sesion, cliente);
      const lista = cuenta.ok ? await leerParroquias(sesion, cliente) : null;
      if (!cuenta.ok || !lista || !lista.ok) {
        // La primera vez se necesita todo: sin la lista no se deja una sesión a medias.
        try {
          await sesion.olvidar();
        } catch {
          // nada
        }
        return { error: !cuenta.ok ? cuenta.error : lista!.ok ? { tipo: 'servidor', estado: 0 } : lista!.error };
      }
      await almacen.guardarCuenta(cuenta.valor);
      await almacen.guardarParroquias(lista.valor);
      const anterior = tienda.obtener().parroquia;
      if (anterior && !lista.valor.some((p) => p.id === anterior.id)) {
        // Entró otra cuenta y la parroquia guardada no es suya: se limpia como al perder el acceso (Decisión 11).
        try {
          await olvidarParroquia(anterior);
        } catch {
          // nada
        }
      }
      despachar({ tipo: 'entro', cuenta: cuenta.valor, parroquias: lista.valor });
      await trabajo;
      return {};
    },

    async elegir(p) {
      despachar({ tipo: 'eligio', parroquia: p });
      await trabajo;
    },

    cambiarParroquia() {
      if (guardia.enVivo()) return;
      despachar({ tipo: 'cambiar' });
    },

    revisar,

    async cerrarSesion() {
      if (guardia.enVivo()) return { error: 'en-vivo' };
      await trabajo;
      try {
        await limpiezas.limpiar({ tipo: 'todo' });
      } catch {
        // `limpiar` no rechaza; por las dudas, se sigue.
      }
      try {
        await almacen.borrarTodo();
      } catch {
        // El keystore falló: igual se sale; la sesión en memoria se olvida abajo.
      }
      try {
        await sesion.olvidar();
      } catch {
        // nada
      }
      despachar({ tipo: 'salio' });
      return {};
    },
  };
}

function armarControlDeLaApp(): ControlSesion {
  const config = obtenerConfig();
  const comun = { almacen: almacenSesion, guardia: guardiaEnVivo, limpiezas: limpiezasApp, sincronizador: sincronizadorApp };
  if (config.ok) {
    return crearControlSesion({
      ...comun,
      cliente: crearClienteSupabase({ url: config.config.supabaseUrl, clavePublica: config.config.supabaseClavePublica }),
    });
  }
  const sinConexion = async () => ({ ok: false as const, error: { tipo: 'sin-conexion' as const } });
  const clienteSinConfig: ClienteSupabase = {
    entrar: sinConexion,
    renovar: sinConexion,
    seleccionar: sinConexion,
    upsert: sinConexion,
  };
  return crearControlSesion({ ...comun, cliente: clienteSinConfig, configOk: false });
}

/** La de la app, armada con la configuración de compilación. */
export const controlSesion: ControlSesion = armarControlDeLaApp();
