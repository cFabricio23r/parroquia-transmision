import { MENSAJES, aEventoEstado, armarUrl } from './eventos';

// Marca falsa: nunca una clave real en los tests.
const CLAVE = 'FB-PRUEBA-MARCA-0000';

describe('armarUrl', () => {
  it('une servidor con barra final y clave', () => {
    expect(armarUrl('rtmps://live-api-s.facebook.com:443/rtmp/', CLAVE)).toBe(
      'rtmps://live-api-s.facebook.com:443/rtmp/' + CLAVE,
    );
  });

  it('agrega la barra si el servidor no la tiene', () => {
    expect(armarUrl('rtmps://live-api-s.facebook.com:443/rtmp', CLAVE)).toBe(
      'rtmps://live-api-s.facebook.com:443/rtmp/' + CLAVE,
    );
  });

  it('recorta espacios y saltos de línea de las puntas de los dos', () => {
    expect(armarUrl('  rtmps://x.com/rtmp/ \n', '\t' + CLAVE + '\r\n')).toBe('rtmps://x.com/rtmp/' + CLAVE);
  });

  it('no duplica barras si el servidor termina en varias', () => {
    expect(armarUrl('rtmps://x.com/rtmp//', CLAVE)).toBe('rtmps://x.com/rtmp/' + CLAVE);
  });

  it('conserva la consulta que trae la clave de Facebook', () => {
    expect(armarUrl('rtmps://x.com/rtmp/', CLAVE + '?s_bl=1&a=b')).toBe('rtmps://x.com/rtmp/' + CLAVE + '?s_bl=1&a=b');
  });

  it('rechaza servidor o clave vacíos', () => {
    expect(() => armarUrl('', CLAVE)).toThrow();
    expect(() => armarUrl('rtmps://x.com/rtmp/', '   ')).toThrow();
  });
});

describe('aEventoEstado', () => {
  it('conectado con kbps → Mbps con un decimal, sin mensaje', () => {
    expect(aEventoEstado({ conexion: 'conectado', motivo: null, kbps: 2480 })).toEqual({
      conexion: 'conectado',
      mbps: 2.5,
      mensaje: null,
    });
  });

  it('conectado sin medición → mbps null', () => {
    expect(aEventoEstado({ conexion: 'conectado', motivo: null, kbps: null })).toEqual({
      conexion: 'conectado',
      mbps: null,
      mensaje: null,
    });
  });

  it('reconectando avisa que reintenta', () => {
    expect(aEventoEstado({ conexion: 'reconectando', motivo: 'red', kbps: null })).toEqual({
      conexion: 'reconectando',
      mbps: null,
      mensaje: MENSAJES.reconectando,
    });
  });

  it('cortado por clave → mensaje de clave rechazada', () => {
    const e = aEventoEstado({ conexion: 'cortado', motivo: 'clave', kbps: null });
    expect(e).toEqual({ conexion: 'cortado', mbps: null, mensaje: 'Facebook no aceptó la clave. Revísela en Ajustes.' });
  });

  it('cortado por reintentos agotados', () => {
    expect(aEventoEstado({ conexion: 'cortado', motivo: 'agotado', kbps: null }).mensaje).toBe(MENSAJES.agotado);
  });

  it('cortado por servidor mal escrito', () => {
    expect(aEventoEstado({ conexion: 'cortado', motivo: 'servidor', kbps: null }).mensaje).toBe(MENSAJES.servidor);
  });

  it('cortado al no poder conectar en el primer intento', () => {
    expect(aEventoEstado({ conexion: 'cortado', motivo: 'inicio', kbps: null }).mensaje).toBe(MENSAJES.inicio);
  });

  it('cortado con motivo desconocido o ausente → mensaje genérico, nunca null', () => {
    expect(aEventoEstado({ conexion: 'cortado', motivo: null, kbps: null }).mensaje).toBe(MENSAJES.desconocido);
    expect(aEventoEstado({ conexion: 'cortado', motivo: 'otra-cosa', kbps: null }).mensaje).toBe(MENSAJES.desconocido);
  });

  it('kbps inválido → mbps null', () => {
    expect(aEventoEstado({ conexion: 'conectado', motivo: null, kbps: -5 }).mbps).toBeNull();
    expect(aEventoEstado({ conexion: 'conectado', motivo: null, kbps: Number.NaN }).mbps).toBeNull();
  });

  it('conexion desconocida se trata como cortado (nunca deja la app colgada)', () => {
    expect(aEventoEstado({ conexion: 'raro', motivo: null, kbps: null }).conexion).toBe('cortado');
  });
});
