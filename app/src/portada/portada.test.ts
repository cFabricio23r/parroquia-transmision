import {
  DURACION_ANIMACION_MS,
  ESPERA_MAXIMA_MS,
  TRAMOS,
  animacionTerminada,
  fasePortada,
} from './portada';

describe('fasePortada', () => {
  const base = { fuentesListas: true, panelCargado: true, animacionTerminada: true, vencida: false };

  test('sin las fuentes queda el splash del sistema', () => {
    expect(fasePortada({ ...base, fuentesListas: false, panelCargado: false, animacionTerminada: false })).toBe(
      'nativo',
    );
    // Aunque el panel haya cargado: la portada de React necesita la letra.
    expect(fasePortada({ ...base, fuentesListas: false })).toBe('nativo');
  });

  test('con el panel cargando se ve la portada, aunque la animación ya haya terminado', () => {
    expect(fasePortada({ ...base, panelCargado: false })).toBe('portada');
  });

  test('con el panel cargado y la animación corriendo sigue la portada', () => {
    expect(fasePortada({ ...base, animacionTerminada: false })).toBe('portada');
  });

  test('se oculta cuando la animación terminó (o se tocó) y además la app ya cargó', () => {
    expect(fasePortada(base)).toBe('app');
  });

  test('pasada la espera máxima se ve la app aunque falte algo', () => {
    expect(
      fasePortada({ fuentesListas: false, panelCargado: false, animacionTerminada: false, vencida: true }),
    ).toBe('app');
    expect(fasePortada({ ...base, panelCargado: false, animacionTerminada: false, vencida: true })).toBe('app');
  });

  test('la espera máxima es corta (unos segundos) y deja terminar la animación', () => {
    expect(ESPERA_MAXIMA_MS).toBeGreaterThanOrEqual(2000);
    expect(ESPERA_MAXIMA_MS).toBeLessThanOrEqual(5000);
    expect(ESPERA_MAXIMA_MS).toBeGreaterThan(DURACION_ANIMACION_MS);
  });
});

describe('animacionTerminada', () => {
  const sinTocar = { tocada: false, reducirMovimiento: false };

  test('la animación dura 1600 ms', () => {
    expect(DURACION_ANIMACION_MS).toBe(1600);
    expect(animacionTerminada({ ...sinTocar, transcurridoMs: 0 })).toBe(false);
    expect(animacionTerminada({ ...sinTocar, transcurridoMs: 1599 })).toBe(false);
    expect(animacionTerminada({ ...sinTocar, transcurridoMs: 1600 })).toBe(true);
    expect(animacionTerminada({ ...sinTocar, transcurridoMs: 2500 })).toBe(true);
  });

  test('un toque la salta en cualquier momento', () => {
    expect(animacionTerminada({ tocada: true, reducirMovimiento: false, transcurridoMs: 0 })).toBe(true);
    expect(animacionTerminada({ tocada: true, reducirMovimiento: false, transcurridoMs: 700 })).toBe(true);
  });

  test('con «reducir movimiento» no hay animación: termina enseguida', () => {
    expect(animacionTerminada({ tocada: false, reducirMovimiento: true, transcurridoMs: 0 })).toBe(true);
  });
});

describe('TRAMOS (el guion del lienzo)', () => {
  test('rayo y logo de 0 a 500 ms, punto en vivo de 500 a 900, textos de 900 a 1600', () => {
    expect(TRAMOS.logo).toEqual({ desde: 0, hasta: 500 });
    expect(TRAMOS.vivo).toEqual({ desde: 500, hasta: 900 });
    expect(TRAMOS.textos).toEqual({ desde: 900, hasta: 1600 });
  });

  test('los tramos van seguidos y el último termina con la animación', () => {
    const lista = [TRAMOS.logo, TRAMOS.vivo, TRAMOS.textos];
    expect(lista[0].desde).toBe(0);
    for (let i = 1; i < lista.length; i++) expect(lista[i].desde).toBe(lista[i - 1].hasta);
    expect(lista[lista.length - 1].hasta).toBe(DURACION_ANIMACION_MS);
  });
});
