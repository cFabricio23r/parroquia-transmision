// Máquina del guardado automático del borrador (spec, sección 4). Pura: el `fetch` y los
// temporizadores llegan inyectados (`DepsGuardador`), así se prueba con temporizadores falsos.
// Un solo PUT en vuelo; lo escrito mientras tanto sale en el siguiente (Review Focus 2).
import { cambiosParaEnviar, fusionarPorBloque, iguales } from './fusion';
import type { Bloque } from './secciones';

export const ESPERA_GUARDADO_MS = 800;
export const MENSAJE_FALLO_GUARDADO = 'No se pudo guardar. Intenta de nuevo.';

export type EstadoGuardado =
  | 'guardado'
  | 'pendiente'
  | 'guardando'
  | 'error'
  | 'sin-conexion'
  | 'sesion-cerrada'
  | 'conflicto'
  | 'rechazado';

export interface InstantaneaGuardado {
  estado: EstadoGuardado;
  local: Record<string, unknown>;
  base: Record<string, unknown>;
  actualizadoEn: string;
  errores: string[];
  erroresForma: string[];
  conflictos: Bloque[];
  mensaje: string | null;
}

export interface RespuestaHttp {
  estado: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cuerpo: any;
}

export interface DepsGuardador {
  guardar(c: { cambios: object; actualizadoEn: string }): Promise<RespuestaHttp>;
  leer(): Promise<RespuestaHttp>;
  programar(fn: () => void, ms: number): unknown;
  cancelar(id: unknown): void;
  alCambiar(i: InstantaneaGuardado): void;
}

export interface Guardador {
  cambiar(bloque: Bloque, valor: unknown): void;
  cambiarVarios(c: Partial<Record<Bloque, unknown>>): void;
  guardarYa(): Promise<EstadoGuardado>;
  usarLoMio(): void;
  verLoSuyo(): void;
  instantanea(): InstantaneaGuardado;
  hayCambiosSinGuardar(): boolean;
}

type Remoto = { config: Record<string, unknown>; actualizadoEn: string };

export function crearGuardador(
  inicial: { config: object; actualizadoEn: string; errores: string[] },
  deps: DepsGuardador,
): Guardador {
  // `local` y `base` nunca se mutan: cada cambio crea un objeto nuevo. Así la foto de lo enviado es una referencia.
  let estado: EstadoGuardado = 'guardado';
  let local: Record<string, unknown> = { ...(inicial.config as Record<string, unknown>) };
  let base: Record<string, unknown> = local;
  let actualizadoEn = inicial.actualizadoEn;
  let errores = [...inicial.errores];
  let erroresForma: string[] = [];
  let conflictos: Bloque[] = [];
  let mensaje: string | null = null;
  let remoto: Remoto | null = null;
  let temporizador: unknown = null;
  let enVuelo: Promise<void> | null = null;

  const instantanea = (): InstantaneaGuardado => ({
    estado,
    local,
    base,
    actualizadoEn,
    errores,
    erroresForma,
    conflictos,
    mensaje,
  });
  const avisar = () => deps.alCambiar(instantanea());
  const poner = (e: EstadoGuardado, m: string | null = null) => {
    estado = e;
    mensaje = m;
    avisar();
  };

  function cancelarTemporizador() {
    if (temporizador !== null) deps.cancelar(temporizador);
    temporizador = null;
  }
  function programar() {
    cancelarTemporizador();
    temporizador = deps.programar(() => {
      temporizador = null;
      if (estado !== 'conflicto') void ciclo();
    }, ESPERA_GUARDADO_MS);
  }

  function fallo(r: RespuestaHttp) {
    const cuerpo = r.cuerpo ?? {};
    if (r.estado === 401) return poner('sesion-cerrada');
    if (r.estado === 503) return poner('sin-conexion');
    if (r.estado === 422) {
      erroresForma = Array.isArray(cuerpo.errores) ? cuerpo.errores.map(String) : [];
      return poner('rechazado', typeof cuerpo.error === 'string' ? cuerpo.error : null);
    }
    if (r.estado === 403) return poner('error', typeof cuerpo.error === 'string' ? cuerpo.error : MENSAJE_FALLO_GUARDADO);
    return poner('error', typeof cuerpo.error === 'string' ? cuerpo.error : MENSAJE_FALLO_GUARDADO);
  }

  async function enviarUnaVez(): Promise<void> {
    const cambios = cambiosParaEnviar(base, local);
    if (Object.keys(cambios).length === 0) return poner('guardado');
    const foto = local;
    poner('guardando');
    let r: RespuestaHttp;
    try {
      r = await deps.guardar({ cambios, actualizadoEn });
    } catch {
      return poner('sin-conexion');
    }
    if (r.estado === 200) {
      base = foto;
      actualizadoEn = String(r.cuerpo?.actualizadoEn ?? actualizadoEn);
      errores = Array.isArray(r.cuerpo?.errores) ? r.cuerpo.errores.map(String) : errores;
      erroresForma = [];
      if (!iguales(local, foto)) {
        poner('pendiente');
        programar();
      } else poner('guardado');
      return;
    }
    if (r.estado === 409) {
      let l: RespuestaHttp;
      try {
        l = await deps.leer();
      } catch {
        return poner('sin-conexion');
      }
      if (l.estado !== 200 || !l.cuerpo?.config) return fallo(l);
      const otro: Remoto = { config: l.cuerpo.config, actualizadoEn: String(l.cuerpo.actualizadoEn) };
      const fusion = fusionarPorBloque(base, local, otro.config);
      local = fusion.fusionado;
      if (fusion.conflictos.length === 0) {
        base = otro.config;
        actualizadoEn = otro.actualizadoEn;
        return enviarUnaVez();
      }
      remoto = otro;
      conflictos = fusion.conflictos;
      return poner('conflicto');
    }
    return fallo(r);
  }

  function ciclo(): Promise<void> {
    if (enVuelo) return enVuelo;
    enVuelo = enviarUnaVez().finally(() => {
      enVuelo = null;
    });
    return enVuelo;
  }

  function aplicar(c: Partial<Record<Bloque, unknown>>) {
    const nuevo = { ...local };
    for (const [b, v] of Object.entries(c)) {
      if (v === undefined) delete nuevo[b];
      else nuevo[b] = v;
    }
    local = nuevo;
    if (estado === 'conflicto') return avisar(); // la persona decide antes de que se guarde nada
    estado = 'pendiente';
    mensaje = null;
    avisar();
    programar();
  }

  function salirDelConflicto(): Remoto | null {
    const r = remoto;
    remoto = null;
    conflictos = [];
    return r;
  }

  return {
    cambiar: (bloque, valor) => aplicar({ [bloque]: valor }),
    cambiarVarios: (c) => aplicar(c),
    async guardarYa() {
      cancelarTemporizador();
      if (enVuelo) await enVuelo;
      cancelarTemporizador();
      if (estado === 'conflicto') return estado;
      if (!iguales(base, local)) await ciclo();
      else if (estado === 'pendiente') poner('guardado');
      return estado;
    },
    usarLoMio() {
      const r = salirDelConflicto();
      if (!r) return;
      base = r.config;
      actualizadoEn = r.actualizadoEn;
      cancelarTemporizador();
      void ciclo();
    },
    verLoSuyo() {
      const enConflicto = conflictos;
      const r = salirDelConflicto();
      if (!r) return;
      const nuevo = { ...local };
      for (const b of enConflicto) {
        if (r.config[b] === undefined) delete nuevo[b];
        else nuevo[b] = r.config[b];
      }
      local = nuevo;
      base = r.config;
      actualizadoEn = r.actualizadoEn;
      cancelarTemporizador();
      if (!iguales(base, local)) void ciclo();
      else poner('guardado');
    },
    instantanea,
    hayCambiosSinGuardar: () => !iguales(base, local),
  };
}
