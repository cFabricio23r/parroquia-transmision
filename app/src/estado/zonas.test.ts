import { mismasZonas, zonasValidas } from './zonas';

describe('mismasZonas (Tarea 9i)', () => {
  const z = { top: 24, bottom: 48, left: 0, right: 0 };

  it('iguales en los cuatro lados: true', () => {
    expect(mismasZonas(z, { ...z })).toBe(true);
  });

  it('distinto un solo lado: false', () => {
    expect(mismasZonas(z, { ...z, bottom: 16 })).toBe(false);
    expect(mismasZonas(z, { ...z, right: 48 })).toBe(false);
  });

  it('diferencias de menos de medio dp cuentan como iguales (redondeo de la densidad)', () => {
    expect(mismasZonas(z, { ...z, bottom: 48.3 })).toBe(true);
    expect(mismasZonas(z, { ...z, bottom: 48.6 })).toBe(false);
  });
});

describe('zonasValidas (Tarea 9i)', () => {
  it('cuatro números: true', () => {
    expect(zonasValidas({ top: 0, bottom: 48, left: 0, right: 0 })).toBe(true);
  });

  it('falta un lado, NaN o no es objeto: false', () => {
    expect(zonasValidas({ top: 0, bottom: 48, left: 0 })).toBe(false);
    expect(zonasValidas({ top: Number.NaN, bottom: 0, left: 0, right: 0 })).toBe(false);
    expect(zonasValidas(null)).toBe(false);
    expect(zonasValidas('x')).toBe(false);
  });
});
