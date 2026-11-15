/**
 * Textos de las pantallas de acceso: los de la fila E del lienzo, palabra por palabra, y los de la
 * Decisión 13 del plan para lo que no tiene artboard. Los ejemplos del artboard («fabricio@correo.com»,
 * «San José (ejemplo)») se cambian por datos reales; las notas de diseño no se dibujan.
 */
import type { ErrorSupabase } from '../../supabase/cliente';

export const TEXTOS = {
  marca: {
    nombre: 'Parroquia en vivo',
    enVivo: 'TRANSMISIÓN EN VIVO',
    logo: 'Logo de la Pastoral de Comunicaciones',
  },
  entrar: {
    titulo: 'Inicia sesión',
    subtitulo: 'Con la cuenta que te dio la Pastoral de Comunicaciones.',
    correo: 'Correo',
    contrasena: 'Contraseña',
    mostrar: 'Mostrar contraseña',
    ocultar: 'Ocultar contraseña',
    olvide: '¿Olvidaste tu contraseña?',
    boton: 'Entrar',
    ocupado: 'Entrando…',
    unaVez: 'Se hace una sola vez. Después la app abre sola, también sin internet.',
    sinContrasena: '¿Aún no tienes contraseña?',
    invitacion: 'Abre la invitación de tu correo.',
    correoVacio: 'Escribe tu correo para recibir el enlace.',
    pie: 'Pastoral de Comunicaciones · Ciudad Arce',
  },
  olvide: {
    titulo: 'Revisa tu correo',
    nota: 'El enlace abre la página web de Parroquia en vivo. Ahí creas la contraseña y vuelves aquí para entrar.',
    volver: 'Volver a entrar',
    reenviar: 'Reenviar el enlace',
    reenviado: 'Listo. Si no llega en unos minutos, revisa el correo no deseado.',
  },
  elegir: {
    titulo: '¿Desde qué parroquia vas a transmitir?',
    subtitulo: 'Ves solo las que te asignaron. Se puede cambiar después en Ajustes.',
    grupo: 'Parroquia',
    continuar: 'Continuar',
    sinRed: 'Para elegir la parroquia la primera vez se necesita internet.',
    reintentar: 'Reintentar',
  },
  aviso: {
    etiqueta: 'SIN TRANSMITIR',
  },
  sinAcceso: {
    cuerpo: 'La Pastoral de Comunicaciones cambió tus permisos. Elige otra parroquia asignada o cierra sesión.',
    elegir: 'Elegir otra parroquia',
    cerrar: 'Cerrar sesión',
  },
  sinParroquias: {
    titulo: 'Todavía no tienes una parroquia para transmitir',
    cuerpo: 'Pídele a la Pastoral de Comunicaciones que te asigne una.',
    cerrar: 'Cerrar sesión',
  },
} as const;

/** El error de «Entrar». Los dos primeros son `MENSAJES_ACCESO` de la plataforma. */
export function mensajeEntrar(e: ErrorSupabase): string {
  switch (e.tipo) {
    case 'incorrectos':
      return 'El correo o la contraseña no coinciden. Revísalos, o crea una contraseña nueva.';
    case 'muchos-intentos':
      return 'Probaste muchas veces seguidas. Espera unos minutos y vuelve a intentar.';
    case 'sin-conexion':
      return 'Para entrar la primera vez se necesita internet.';
    default:
      return 'No se pudo entrar. Intenta de nuevo en un momento.';
  }
}

export function textoOlvide(correo: string): string {
  return `Si ${correo} tiene una cuenta, le llegó un enlace para crear una contraseña nueva.`;
}

export function textoSinAcceso(nombre: string): string {
  return `Ya no tienes acceso a ${nombre}`;
}

export function textoConfig(variable: string): string {
  return `La app está mal armada: falta ${variable}.`;
}
