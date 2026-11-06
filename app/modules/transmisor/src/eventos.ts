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
  desconocido: 'Se cortó la transmisión. Vuelva a transmitir.',
} as const;

/** Une servidor y clave con una sola barra. Recorta las puntas de los dos (como Ajustes). */
export function armarUrl(servidor: string, clave: string): string {
  const s = servidor.trim().replace(/\/+$/, '');
  const c = clave.trim();
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
  const mensaje =
    n.motivo === 'clave'
      ? MENSAJES.clave
      : n.motivo === 'agotado'
        ? MENSAJES.agotado
        : n.motivo === 'servidor'
          ? MENSAJES.servidor
          : n.motivo === 'inicio'
            ? MENSAJES.inicio
            : MENSAJES.desconocido;
  return { conexion: 'cortado', mbps: null, mensaje };
}
