// Ajustes de la transmisión. La clave de Facebook es un secreto: se guarda solo en
// expo-secure-store (ver almacen.ts) y nunca se escribe en logs ni en el estado.

export type Calidad = '720p' | '1080p';
export type Microfono = 'celular' | 'externo';
/** Estilo de la pantalla final «Producción» (Tarea 9d): A Claro o B Azul. */
export type EstiloFinal = 'claro' | 'azul';
export interface Ajustes {
  servidor: string;
  clave: string;
  calidad: Calidad;
  microfono: Microfono;
  estiloFinal: EstiloFinal;
}

export const AJUSTES_INICIALES: Ajustes = {
  servidor: '',
  clave: '',
  calidad: '720p',
  microfono: 'celular',
  estiloFinal: 'azul',
};

/** Solo «claro» o «azul»; cualquier otra cosa (o nada, en ajustes viejos) es Azul, el de por defecto. */
export function estiloFinalValido(x: unknown): EstiloFinal {
  return x === 'claro' || x === 'azul' ? x : AJUSTES_INICIALES.estiloFinal;
}

/** Recorta espacios y saltos de línea (\r \n \t) de las puntas; el medio no se toca. */
export function limpiarClave(texto: string): string {
  return texto.trim();
}

/** Valida primero la clave y después el servidor. */
export function validar(
  a: Ajustes,
): { ok: true } | { ok: false; campo: 'servidor' | 'clave'; mensaje: string } {
  // Se evalúan los valores ya recortados, igual que como se guardan.
  const clave = limpiarClave(a.clave);
  if (clave === '') {
    return { ok: false, campo: 'clave', mensaje: 'Pegue la clave de transmisión de Facebook.' };
  }
  if (/\s/.test(clave)) {
    return { ok: false, campo: 'clave', mensaje: 'La clave no puede tener espacios.' };
  }
  if (!a.servidor.trim().startsWith('rtmps://')) {
    return { ok: false, campo: 'servidor', mensaje: 'El servidor debe empezar con rtmps://' };
  }
  return { ok: true };
}

export type EstadoCarga = 'cargando' | 'listo' | 'error';

/** Solo se guarda cuando la lectura inicial terminó bien: así nunca se pisa lo guardado. */
export function puedeGuardar(estado: EstadoCarga): boolean {
  return estado === 'listo';
}
