import { listoTrasCambio, orientacionPara, pantallaPara } from './orientacion';
import type { Fase } from './transmision';

const AL_AIRE: Fase[] = ['iniciando', 'en_vivo', 'reconectando', 'terminando'];
const FUERA: Fase[] = ['preparando', 'terminado'];

describe('pantallaPara', () => {
  it('al aire siempre es «aire», con o sin Listo', () => {
    for (const f of AL_AIRE) {
      expect(pantallaPara(f, false)).toBe('aire');
      expect(pantallaPara(f, true)).toBe('aire');
    }
  });

  it('fuera del aire, sin Listo, es Preparar', () => {
    for (const f of FUERA) expect(pantallaPara(f, false)).toBe('preparar');
  });

  it('fuera del aire, con Listo, es Antes de iniciar', () => {
    for (const f of FUERA) expect(pantallaPara(f, true)).toBe('antes');
  });
});

describe('orientacionPara', () => {
  it('Preparar va en vertical', () => {
    expect(orientacionPara('preparar')).toBe('vertical');
  });

  it('Antes de iniciar y al aire van en horizontal', () => {
    expect(orientacionPara('antes')).toBe('horizontal');
    expect(orientacionPara('aire')).toBe('horizontal');
  });

  it('ninguna fase al aire queda en vertical', () => {
    for (const f of AL_AIRE) for (const l of [true, false]) {
      expect(orientacionPara(pantallaPara(f, l))).toBe('horizontal');
    }
  });
});

describe('listoTrasCambio', () => {
  it('al terminar la transmisión vuelve a Preparar', () => {
    for (const antes of AL_AIRE) expect(listoTrasCambio(true, antes, 'terminado')).toBe(false);
  });

  it('salir al aire deja Listo puesto (al cancelar se vuelve a Antes de iniciar)', () => {
    expect(listoTrasCambio(false, 'preparando', 'iniciando')).toBe(true);
    expect(listoTrasCambio(false, 'terminado', 'iniciando')).toBe(true);
  });

  it('un arranque fallido o un corte quedan en Antes de iniciar, para ver el error', () => {
    expect(listoTrasCambio(true, 'iniciando', 'preparando')).toBe(true);
    expect(listoTrasCambio(true, 'en_vivo', 'preparando')).toBe(true);
    expect(listoTrasCambio(true, 'reconectando', 'preparando')).toBe(true);
  });

  it('sin cambio de fase, no cambia nada', () => {
    for (const f of [...AL_AIRE, ...FUERA]) {
      expect(listoTrasCambio(true, f, f)).toBe(true);
      expect(listoTrasCambio(false, f, f)).toBe(false);
    }
  });

  it('el recorrido entero: Preparar → Listo → aire → terminado → Preparar', () => {
    let listo = false;
    expect(orientacionPara(pantallaPara('preparando', listo))).toBe('vertical');
    listo = true; // el operador toca «Listo»
    expect(orientacionPara(pantallaPara('preparando', listo))).toBe('horizontal');
    const fases: Fase[] = ['preparando', 'iniciando', 'en_vivo', 'terminando', 'terminado'];
    for (let i = 1; i < fases.length; i++) {
      listo = listoTrasCambio(listo, fases[i - 1], fases[i]);
      const o = orientacionPara(pantallaPara(fases[i], listo));
      expect(o).toBe(fases[i] === 'terminado' ? 'vertical' : 'horizontal');
    }
  });
});
