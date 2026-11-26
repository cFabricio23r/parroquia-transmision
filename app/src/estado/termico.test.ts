import { ESPERA_SUBIR_MS, KBPS, escalonPedido, siguienteEscalon } from './termico';

describe('escalonPedido', () => {
  it.each([
    [2, null, 1],
    [3, null, 2],
    [1, 50, 0], // manda el térmico, no la temperatura
    [null, 42, 1],
    [null, 45, 2],
    [null, 41.9, 0],
    [null, null, 0],
    [0, null, 0],
    [5, null, 2],
  ])('termico %p, temperatura %p da el escalón %p', (termico, temperatura, esperado) => {
    expect(escalonPedido({ termico, temperatura })).toBe(esperado);
  });
});

describe('siguienteEscalon', () => {
  it('de 0 a 2 sube en el acto', () => {
    expect(siguienteEscalon({ escalon: 0, desdeMs: 0 }, 2, 1000)).toEqual({ escalon: 2, desdeMs: 1000 });
  });

  it('de 1 con pedido 2, a los 5 s sube a 2', () => {
    expect(siguienteEscalon({ escalon: 1, desdeMs: 0 }, 2, 5000)).toEqual({ escalon: 2, desdeMs: 5000 });
  });

  it('de 2 con pedido 0, a los 60 s queda en 2 (no pasó la espera)', () => {
    const a = { escalon: 2 as const, desdeMs: 0 };
    expect(siguienteEscalon(a, 0, 60_000)).toBe(a);
  });

  it('a los 120 s baja a 1 y 120 s después a 0, de a un escalón', () => {
    const a = siguienteEscalon({ escalon: 2, desdeMs: 0 }, 0, ESPERA_SUBIR_MS);
    expect(a).toEqual({ escalon: 1, desdeMs: ESPERA_SUBIR_MS });
    expect(siguienteEscalon(a, 0, ESPERA_SUBIR_MS + 60_000)).toEqual(a);
    expect(siguienteEscalon(a, 0, 2 * ESPERA_SUBIR_MS)).toEqual({ escalon: 0, desdeMs: 2 * ESPERA_SUBIR_MS });
  });

  it('con el pedido igual al actual, no cambia nada (desdeMs tampoco)', () => {
    const a = { escalon: 1 as const, desdeMs: 10 };
    expect(siguienteEscalon(a, 1, 999_999)).toBe(a);
  });
});

describe('KBPS', () => {
  it('nunca baja del mínimo de Facebook (1500 en 720p, 3000 en 1080p)', () => {
    expect(Math.min(...KBPS['720p'])).toBeGreaterThanOrEqual(1500);
    expect(Math.min(...KBPS['1080p'])).toBeGreaterThanOrEqual(3000);
  });

  it('baja con el escalón', () => {
    for (const c of ['720p', '1080p'] as const) {
      expect(KBPS[c][0]).toBeGreaterThan(KBPS[c][1]);
      expect(KBPS[c][1]).toBeGreaterThan(KBPS[c][2]);
    }
  });
});
