import { formatoDuracion, formatoMbps, formatoReloj } from './formato';

describe('formatoReloj', () => {
  it('da hh:mm:ss con ceros', () => {
    expect(formatoReloj(0)).toBe('00:00:00');
    expect(formatoReloj(205)).toBe('00:03:25');
    expect(formatoReloj(3725)).toBe('01:02:05');
  });
  it('pasa de 99 horas sin romperse', () => {
    expect(formatoReloj(100 * 3600)).toBe('100:00:00');
  });
  it('trata negativos y no números como 0', () => {
    expect(formatoReloj(-5)).toBe('00:00:00');
    expect(formatoReloj(Number.NaN)).toBe('00:00:00');
  });
});

describe('formatoMbps', () => {
  it('usa coma decimal y una cifra', () => {
    expect(formatoMbps(3.4)).toBe('3,4 Mbps');
    expect(formatoMbps(2.46)).toBe('2,5 Mbps');
    expect(formatoMbps(0)).toBe('0,0 Mbps');
  });
  it('sin dato da una raya', () => {
    expect(formatoMbps(null)).toBe('— Mbps');
    expect(formatoMbps(Number.NaN)).toBe('— Mbps');
  });
});

describe('formatoDuracion', () => {
  it('menos de un minuto', () => {
    expect(formatoDuracion(0)).toBe('menos de 1 min');
    expect(formatoDuracion(59)).toBe('menos de 1 min');
  });
  it('solo minutos', () => {
    expect(formatoDuracion(60)).toBe('1 min');
    expect(formatoDuracion(18 * 60 + 40)).toBe('18 min');
  });
  it('horas y minutos', () => {
    expect(formatoDuracion(3600)).toBe('1 h');
    expect(formatoDuracion(3600 + 18 * 60 + 52)).toBe('1 h 18 min');
  });
});
