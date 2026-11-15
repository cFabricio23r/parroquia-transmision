// Mensajes de acceso (artboard A5 «VicAccesoEstados»), con el texto exacto del lienzo.
// Sin dependencias de React ni de server-only: lo importa también proxy.ts (página «Sin conexión»).
export type CodigoMensajeAcceso =
  | 'incorrectos'
  | 'clave-no-sirve'
  | 'muchos-intentos'
  | 'sin-parroquia'
  | 'invitacion-vencida'
  | 'invitacion-no-sirve'
  | 'enlace-vencido'
  | 'sin-conexion'
  | 'sesion-cerrada'
  | 'no-se-pudo-cargar';

export type TonoMensaje = 'rojo' | 'ambar' | 'gris' | 'azul';

export interface MensajeAcceso {
  titulo: string;
  texto: string;
  tono: TonoMensaje;
}

export const MENSAJES_ACCESO: Record<CodigoMensajeAcceso, MensajeAcceso> = {
  incorrectos: {
    titulo: 'Correo o contraseña incorrectos',
    texto: 'El correo o la contraseña no coinciden. Revísalos, o crea una contraseña nueva.',
    tono: 'rojo',
  },
  'clave-no-sirve': {
    titulo: 'Contraseña que no sirve',
    texto: 'Revisa la contraseña: al menos 8 caracteres, y las dos iguales.',
    tono: 'rojo',
  },
  'muchos-intentos': {
    titulo: 'Muchos intentos',
    texto: 'Probaste muchas veces seguidas. Espera unos minutos y vuelve a intentar.',
    tono: 'ambar',
  },
  'sin-parroquia': {
    titulo: 'Sin parroquia asignada',
    texto: 'Tu cuenta ya no tiene una parroquia asignada. Pídele a la Pastoral de Comunicaciones que te asigne una.',
    tono: 'gris',
  },
  'invitacion-vencida': {
    titulo: 'Invitación vencida',
    texto: 'Esta invitación ya venció. Pídele a la Pastoral de Comunicaciones que te la reenvíe.',
    tono: 'ambar',
  },
  // Sin artboard (Decisión 8 del plan 2). Ronda 2: lo más común es alguien que ya creó su cuenta y
  // vuelve a abrir el correo; la página suma «Ir a entrar». Texto pendiente de visto bueno del dueño.
  'invitacion-no-sirve': {
    titulo: 'Invitación que ya no sirve',
    texto: 'Esta invitación ya no sirve. Si ya creaste tu cuenta, entra con tu correo. Si no, pide una nueva a la Pastoral de Comunicaciones.',
    tono: 'gris',
  },
  'enlace-vencido': {
    titulo: 'Enlace vencido o usado',
    texto: 'Este enlace para crear una contraseña ya venció o ya se usó.',
    tono: 'ambar',
  },
  'sin-conexion': {
    titulo: 'Sin conexión',
    texto: 'No hay internet. Revisa el wifi o los datos y vuelve a intentar.',
    tono: 'azul',
  },
  'sesion-cerrada': {
    titulo: 'Sesión cerrada',
    texto: 'Tu sesión se cerró. Vuelve a entrar para seguir; lo que guardaste no se pierde.',
    tono: 'azul',
  },
  // Sin artboard (revisión): C1 o C2 no pudieron leer las parroquias de la base.
  'no-se-pudo-cargar': {
    titulo: 'No se pudo cargar',
    texto: 'No pudimos leer tus parroquias. Espera un momento y vuelve a intentar.',
    tono: 'ambar',
  },
};

/** Los 8 del artboard A5, en su orden (sin «invitación que no sirve», que no tiene artboard). */
export const ORDEN_A5: CodigoMensajeAcceso[] = [
  'incorrectos',
  'clave-no-sirve',
  'muchos-intentos',
  'sin-parroquia',
  'invitacion-vencida',
  'enlace-vencido',
  'sin-conexion',
  'sesion-cerrada',
];

/** Color del punto de cada tono (A5 usa un ámbar más oscuro que el de los chips). */
export const COLOR_TONO: Record<TonoMensaje, string> = {
  rojo: '#a3231a',
  ambar: '#8a6500',
  gris: '#4a5568',
  azul: '#1155a4',
};

/**
 * Título de la página de la invitación (A2), el mismo texto que su h1: el de la invitación vigente
 * según el rol, o el del mensaje A5 cuando venció o ya no sirve (revisión fix2).
 */
export function tituloInvitacion(c: { estado: 'vencida' } | { estado: 'no-sirve' } | { estado: 'vigente'; rol: string }): string {
  if (c.estado === 'vencida') return MENSAJES_ACCESO['invitacion-vencida'].titulo;
  if (c.estado === 'no-sirve') return MENSAJES_ACCESO['invitacion-no-sirve'].titulo;
  return c.rol === 'administrador' ? 'Te invitaron a administrar' : 'Te invitaron a coordinar';
}
