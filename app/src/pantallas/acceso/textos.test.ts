import { TEXTOS, mensajeEntrar, textoOlvide, textoSinAcceso, textoConfig } from './textos';

describe('mensajeEntrar', () => {
  it('correo o contraseña mal', () => {
    expect(mensajeEntrar({ tipo: 'incorrectos' })).toBe(
      'El correo o la contraseña no coinciden. Revísalos, o crea una contraseña nueva.',
    );
  });
  it('muchos intentos', () => {
    expect(mensajeEntrar({ tipo: 'muchos-intentos' })).toBe(
      'Probaste muchas veces seguidas. Espera unos minutos y vuelve a intentar.',
    );
  });
  it('sin conexión, la primera vez', () => {
    expect(mensajeEntrar({ tipo: 'sin-conexion' })).toBe('Para entrar la primera vez se necesita internet.');
  });
  it('lo demás', () => {
    const otro = 'No se pudo entrar. Intenta de nuevo en un momento.';
    expect(mensajeEntrar({ tipo: 'servidor', estado: 500 })).toBe(otro);
    expect(mensajeEntrar({ tipo: 'permiso' })).toBe(otro);
    expect(mensajeEntrar({ tipo: 'sesion-invalida' })).toBe(otro);
  });
});

describe('TEXTOS', () => {
  it('Entrar, palabra por palabra', () => {
    const t = Object.values(TEXTOS.entrar);
    for (const s of [
      'Inicia sesión',
      'Con la cuenta que te dio la Pastoral de Comunicaciones.',
      'Correo',
      'Contraseña',
      '¿Olvidaste tu contraseña?',
      'Entrar',
      'Se hace una sola vez. Después la app abre sola, también sin internet.',
      '¿Aún no tienes contraseña?',
      'Abre la invitación de tu correo.',
      'Escribe tu correo para recibir el enlace.',
      'Pastoral de Comunicaciones · Ciudad Arce',
    ]) {
      expect(t).toContain(s);
    }
  });

  it('Revisa tu correo', () => {
    const t = Object.values(TEXTOS.olvide);
    for (const s of [
      'Revisa tu correo',
      'El enlace abre la página web de Parroquia en vivo. Ahí creas la contraseña y vuelves aquí para entrar.',
      'Volver a entrar',
      'Reenviar el enlace',
      'Listo. Si no llega en unos minutos, revisa el correo no deseado.',
    ]) {
      expect(t).toContain(s);
    }
    expect(textoOlvide('a@b.c')).toBe('Si a@b.c tiene una cuenta, le llegó un enlace para crear una contraseña nueva.');
  });

  it('Elegir', () => {
    const t = Object.values(TEXTOS.elegir);
    for (const s of [
      '¿Desde qué parroquia vas a transmitir?',
      'Ves solo las que te asignaron. Se puede cambiar después en Ajustes.',
      'Continuar',
      'Para elegir la parroquia la primera vez se necesita internet.',
      'Reintentar',
    ]) {
      expect(t).toContain(s);
    }
  });

  it('Sin acceso y sin parroquias', () => {
    expect(textoSinAcceso('San José')).toBe('Ya no tienes acceso a San José');
    expect(TEXTOS.sinAcceso.cuerpo).toBe(
      'La Pastoral de Comunicaciones cambió tus permisos. Elige otra parroquia asignada o cierra sesión.',
    );
    expect(TEXTOS.sinAcceso.elegir).toBe('Elegir otra parroquia');
    expect(TEXTOS.sinAcceso.cerrar).toBe('Cerrar sesión');
    expect(TEXTOS.aviso.etiqueta).toBe('SIN TRANSMITIR');
    expect(TEXTOS.sinParroquias.titulo).toBe('Todavía no tienes una parroquia para transmitir');
    expect(TEXTOS.sinParroquias.cuerpo).toBe('Pídele a la Pastoral de Comunicaciones que te asigne una.');
    expect(textoConfig('EXPO_PUBLIC_SUPABASE_URL')).toBe('La app está mal armada: falta EXPO_PUBLIC_SUPABASE_URL.');
  });
});
