import { etiquetaZoom, limitarZoom, rangoValido, rectCompleta, zoomPellizco, zoomSiguiente } from './zoom';

const R = { min: 1, max: 8 };

describe('rangoValido', () => {
  it('acepta un rango con max mayor que min', () => {
    expect(rangoValido({ min: 1, max: 10 })).toEqual({ min: 1, max: 10 });
    expect(rangoValido({ min: 0.6, max: 8 })).toEqual({ min: 0.6, max: 8 });
  });

  it('sin rango, rango vacío o con NaN da null (el celular no tiene zoom)', () => {
    expect(rangoValido(null)).toBeNull();
    expect(rangoValido({ min: 1, max: 1 })).toBeNull();
    expect(rangoValido({ min: Number.NaN, max: 4 })).toBeNull();
    expect(rangoValido({ min: 1, max: Number.POSITIVE_INFINITY })).toBeNull();
  });
});

describe('limitarZoom', () => {
  it('deja el zoom dentro del rango', () => {
    expect(limitarZoom(0.5, R)).toBe(1);
    expect(limitarZoom(12, R)).toBe(8);
    expect(limitarZoom(3.2, R)).toBe(3.2);
  });

  it('NaN vuelve a 1 dentro del rango', () => {
    expect(limitarZoom(Number.NaN, R)).toBe(1);
    expect(limitarZoom(Number.NaN, { min: 2, max: 8 })).toBe(2);
  });
});

describe('zoomSiguiente (botones − y +, de a 0,5×)', () => {
  it('sube y baja de a 0,5', () => {
    expect(zoomSiguiente(1, R, 1)).toBe(1.5);
    expect(zoomSiguiente(2, R, -1)).toBe(1.5);
  });

  it('desde un zoom de pellizco salta al siguiente múltiplo de 0,5', () => {
    expect(zoomSiguiente(1.7, R, 1)).toBe(2);
    expect(zoomSiguiente(1.7, R, -1)).toBe(1.5);
  });

  it('no se pasa de los límites', () => {
    expect(zoomSiguiente(8, R, 1)).toBe(8);
    expect(zoomSiguiente(1, R, -1)).toBe(1);
    expect(zoomSiguiente(7.8, R, 1)).toBe(8);
  });
});

describe('zoomPellizco', () => {
  it('escala el zoom con la distancia entre los dedos', () => {
    expect(zoomPellizco(1, 100, 200, R)).toBe(2);
    expect(zoomPellizco(4, 200, 100, R)).toBe(2);
  });

  it('respeta el rango', () => {
    expect(zoomPellizco(4, 100, 1000, R)).toBe(8);
    expect(zoomPellizco(2, 100, 10, R)).toBe(1);
  });

  it('con distancia inicial 0 o rara no cambia el zoom', () => {
    expect(zoomPellizco(2, 0, 100, R)).toBe(2);
    expect(zoomPellizco(2, Number.NaN, 100, R)).toBe(2);
  });
});

describe('etiquetaZoom', () => {
  it('con coma decimal y sin «,0»', () => {
    expect(etiquetaZoom(1)).toBe('1×');
    expect(etiquetaZoom(1.5)).toBe('1,5×');
    expect(etiquetaZoom(2.26)).toBe('2,3×');
    expect(etiquetaZoom(2.96)).toBe('3×');
  });
});

describe('rectCompleta (pantalla completa, 16:9 centrado)', () => {
  it('pantalla más ancha que 16:9: ocupa todo el alto, centrada a lo ancho', () => {
    expect(rectCompleta(800, 360)).toEqual({ left: 80, top: 0, width: 640, height: 360 });
  });

  it('pantalla más alta que 16:9: ocupa todo el ancho, centrada a lo alto', () => {
    expect(rectCompleta(640, 400)).toEqual({ left: 0, top: 20, width: 640, height: 360 });
  });

  it('tamaños en cero o negativos dan un rect vacío', () => {
    expect(rectCompleta(0, 0)).toEqual({ left: 0, top: 0, width: 0, height: 0 });
    expect(rectCompleta(-5, 100)).toEqual({ left: 0, top: 0, width: 0, height: 0 });
  });
});
