import { ESPERA_MAXIMA_MS, fasePortada } from './portada';

describe('fasePortada', () => {
  test('sin las fuentes queda el splash del sistema', () => {
    expect(fasePortada({ fuentesListas: false, panelCargado: false, vencida: false })).toBe('nativo');
    // Aunque el panel haya cargado: la portada de React necesita la letra.
    expect(fasePortada({ fuentesListas: false, panelCargado: true, vencida: false })).toBe('nativo');
  });

  test('con las fuentes y el panel cargando se ve la portada', () => {
    expect(fasePortada({ fuentesListas: true, panelCargado: false, vencida: false })).toBe('portada');
  });

  test('con las fuentes y el panel cargado se ve la app', () => {
    expect(fasePortada({ fuentesListas: true, panelCargado: true, vencida: false })).toBe('app');
  });

  test('pasada la espera máxima se ve la app aunque falte algo', () => {
    expect(fasePortada({ fuentesListas: false, panelCargado: false, vencida: true })).toBe('app');
    expect(fasePortada({ fuentesListas: true, panelCargado: false, vencida: true })).toBe('app');
  });

  test('la espera máxima es corta (unos segundos)', () => {
    expect(ESPERA_MAXIMA_MS).toBeGreaterThanOrEqual(2000);
    expect(ESPERA_MAXIMA_MS).toBeLessThanOrEqual(5000);
  });
});
