// Lógica pura del transmisor (sin nada nativo), probada con jest.
// La clave nunca se escribe en consola: estas funciones solo la unen o la comparan.

export type Conexion = 'conectado' | 'reconectando' | 'cortado';

export type EventoEstado = {
  conexion: Conexion;
  mbps: number | null;
  mensaje: string | null;
};

/** Lo que manda Kotlin en «onEstado». `motivo` solo se usa con 'reconectando' y 'cortado'. */
export type EventoNativo = {
  conexion: string;
  motivo: string | null;
  kbps: number | null;
};

export const MENSAJES = {
  reconectando: 'Se cortó la señal. Reconectando…',
  clave: 'Facebook no aceptó la clave. Revísela en Ajustes.',
  agotado: 'No se pudo recuperar la conexión. Revise internet y vuelva a transmitir.',
  inicio: 'No se pudo conectar con Facebook. Revise internet y, en Ajustes, el servidor y la clave.',
  servidor: 'El servidor no es válido. Revíselo en Ajustes.',
  preparar: 'No se pudo volver a preparar la cámara. Cierre la app y ábrala de nuevo.',
  sinRespuesta: 'Facebook no respondió. Revise internet y vuelva a transmitir.',
  inseguro: 'No se puede transmitir de forma segura en este celular.',
  ocupado: 'La transmisión anterior todavía se está cerrando. Espere unos segundos y vuelva a intentar.',
  noInicia: 'No se pudo iniciar la transmisión.',
  desconocido: 'Se cortó la transmisión. Vuelva a transmitir.',
} as const;

const POR_MOTIVO: Record<string, string> = {
  clave: MENSAJES.clave,
  agotado: MENSAJES.agotado,
  servidor: MENSAJES.servidor,
  inicio: MENSAJES.inicio,
  preparar: MENSAJES.preparar,
  sin_respuesta: MENSAJES.sinRespuesta,
};

/** Une servidor y clave con una sola barra. Recorta las puntas de los dos (como Ajustes). */
export function armarUrl(servidor: string, clave: string): string {
  const s = servidor.trim().replace(/\/+$/, '');
  const c = clave.trim();
  // El mensaje es fijo: nunca incluye los datos recibidos.
  if (s === '' || c === '') throw new Error('Faltan el servidor o la clave.');
  return `${s}/${c}`;
}

function aMbps(kbps: number | null): number | null {
  if (kbps === null || !Number.isFinite(kbps) || kbps < 0) return null;
  return Math.round(kbps / 100) / 10;
}

export function aEventoEstado(n: EventoNativo): EventoEstado {
  if (n.conexion === 'conectado') return { conexion: 'conectado', mbps: aMbps(n.kbps), mensaje: null };
  if (n.conexion === 'reconectando') return { conexion: 'reconectando', mbps: null, mensaje: MENSAJES.reconectando };
  const mensaje = (n.motivo !== null && POR_MOTIVO[n.motivo]) || MENSAJES.desconocido;
  return { conexion: 'cortado', mbps: null, mensaje };
}

export type CodigoError = 'inseguro' | 'ocupado' | 'preparar' | 'otro';

/** Error de iniciar() con un mensaje en español listo para mostrar. */
export class ErrorTransmisor extends Error {
  readonly codigo: CodigoError;
  constructor(codigo: CodigoError, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorTransmisor';
    this.codigo = codigo;
  }
}

const POR_CODIGO: Record<string, [CodigoError, string]> = {
  ERR_REGISTRO_INSEGURO: ['inseguro', MENSAJES.inseguro],
  ERR_OCUPADO: ['ocupado', MENSAJES.ocupado],
  ERR_SIN_PREPARAR: ['preparar', MENSAJES.preparar],
};

/** Traduce un rechazo del nativo (o cualquier error) sin copiar su texto original. */
export function traducirError(e: unknown): ErrorTransmisor {
  if (e instanceof ErrorTransmisor) return e;
  const code = typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined;
  const par = typeof code === 'string' ? POR_CODIGO[code] : undefined;
  return par ? new ErrorTransmisor(par[0], par[1]) : new ErrorTransmisor('otro', MENSAJES.noInicia);
}

/** Corte por «no se pudo volver a preparar la cámara»: la pantalla vuelve a llamar a prepararVista(). */
export function pideVolverAPreparar(e: EventoEstado): boolean {
  return e.conexion === 'cortado' && e.mensaje === MENSAJES.preparar;
}
