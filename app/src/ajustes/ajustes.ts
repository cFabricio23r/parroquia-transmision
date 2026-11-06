// Ajustes de la transmisión. La clave de Facebook es un secreto: se guarda solo en
// expo-secure-store (un único JSON) y nunca se escribe en logs ni en el estado.
import * as SecureStore from 'expo-secure-store';

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

const LLAVE = 'parroquia_ajustes_v1';

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

/** Rechaza si el almacén falla al leer (para no confundirlo con "no hay nada guardado"). */
export async function leerAjustes(): Promise<Ajustes> {
  const crudo = await SecureStore.getItemAsync(LLAVE);
  try {
    if (!crudo) return { ...AJUSTES_INICIALES };
    const p = JSON.parse(crudo) as Partial<Ajustes> | null;
    if (!p || typeof p !== 'object') return { ...AJUSTES_INICIALES };
    return {
      servidor: typeof p.servidor === 'string' ? p.servidor.trim() : AJUSTES_INICIALES.servidor,
      clave: typeof p.clave === 'string' ? limpiarClave(p.clave) : AJUSTES_INICIALES.clave,
      calidad: p.calidad === '1080p' || p.calidad === '720p' ? p.calidad : AJUSTES_INICIALES.calidad,
      microfono:
        p.microfono === 'externo' || p.microfono === 'celular' ? p.microfono : AJUSTES_INICIALES.microfono,
      estiloFinal: estiloFinalValido(p.estiloFinal),
    };
  } catch {
    // Datos ilegibles: se vuelve a los iniciales (sin registrar nada del contenido).
    return { ...AJUSTES_INICIALES };
  }
}

export async function guardarAjustes(a: Ajustes): Promise<void> {
  await SecureStore.setItemAsync(
    LLAVE,
    JSON.stringify({ ...a, clave: limpiarClave(a.clave), servidor: a.servidor.trim() }),
  );
}
