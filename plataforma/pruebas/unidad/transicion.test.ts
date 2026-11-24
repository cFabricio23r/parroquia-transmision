// La transición que arma el editor (pantallas más opciones, Tarea 10): el nombre del archivo y si el
// navegador puede armarla. El video en sí se prueba en pruebas/navegador/transicion.mjs (Chrome real).
import { afterEach, describe, expect, it } from 'vitest';
import { nombreArchivoTransicion, puedeArmarTransicion } from '../../lib/editor/transicion';

describe('nombreArchivoTransicion', () => {
  it('Transicion_<slug>_Logo.webm y _Patrono.webm', () => {
    expect(nombreArchivoTransicion('ciudad-arce', 'logo')).toBe('Transicion_ciudad-arce_Logo.webm');
    expect(nombreArchivoTransicion('san-jose-ejemplo', 'patrono')).toBe('Transicion_san-jose-ejemplo_Patrono.webm');
  });
});

describe('puedeArmarTransicion', () => {
  const g = globalThis as Record<string, unknown>;
  const antes = g.VideoEncoder;
  afterEach(() => {
    if (antes === undefined) delete g.VideoEncoder;
    else g.VideoEncoder = antes;
  });
  it('sin VideoEncoder (Firefox, Safari viejo, página insegura) da false', async () => {
    delete g.VideoEncoder;
    expect(await puedeArmarTransicion()).toBe(false);
  });
  it('con un VideoEncoder que no sabe VP9 con transparencia, también false', async () => {
    g.VideoEncoder = class {
      static isConfigSupported() {
        return Promise.resolve({ supported: false });
      }
    };
    expect(await puedeArmarTransicion()).toBe(false);
  });
});
