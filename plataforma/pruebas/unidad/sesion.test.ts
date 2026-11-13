import { describe, expect, it, vi } from 'vitest';
import { MENSAJE_RECUPERAR, pedirRecuperacionDiferida, resolverSitioUrl, type DepsRecuperacion } from '../../lib/sesion';

describe('pedirRecuperacionDiferida', () => {
  it('responde el mensaje sin esperar el envío', () => {
    let tarea: (() => Promise<unknown>) | undefined;
    const enviar = vi.fn();
    // Cliente que falla si se toca: la tarea está programada, no corrida.
    const servicio = new Proxy({}, { get: () => { throw new Error('no debía tocarse'); } });
    const deps = { servicio, enviar, sitioUrl: 'http://x' } as unknown as DepsRecuperacion;
    const r = pedirRecuperacionDiferida(deps, 'a@b.test', (t) => { tarea = t; });
    expect(r).toEqual({ mensaje: MENSAJE_RECUPERAR });
    expect(tarea).toBeTypeOf('function');
    expect(enviar).not.toHaveBeenCalled();
  });
});

describe('resolverSitioUrl', () => {
  it('usa SITIO_URL sin barra final', () => {
    expect(resolverSitioUrl({ SITIO_URL: 'https://x.org/', NODE_ENV: 'production' })).toBe('https://x.org');
  });
  it('cae a localhost solo en desarrollo o pruebas', () => {
    expect(resolverSitioUrl({ NODE_ENV: 'development' })).toBe('http://localhost:3000');
    expect(resolverSitioUrl({ NODE_ENV: 'test' })).toBe('http://localhost:3000');
  });
  it('en producción sin SITIO_URL falla', () => {
    expect(() => resolverSitioUrl({ NODE_ENV: 'production' })).toThrow(/SITIO_URL/);
    expect(() => resolverSitioUrl({})).toThrow(/SITIO_URL/);
  });
});
