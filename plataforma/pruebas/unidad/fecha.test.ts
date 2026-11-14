import { describe, expect, it } from 'vitest';
import { formatearDiaMes, formatearFecha } from '../../lib/fecha';

describe('formatearFecha', () => {
  it('muestra la hora de El Salvador (UTC-6) sin depender de la zona del servidor', () => {
    const s = formatearFecha('2026-01-15T03:30:00Z');
    expect(s).toContain('14/1/2026');
    expect(s).toContain('21:30');
  });
  it('solo la fecha, también en hora local (no la del día UTC)', () => {
    expect(formatearFecha('2026-01-15T03:30:00Z', false)).toBe('14/1/2026');
  });
  it('una fecha inválida no rompe la página', () => {
    expect(formatearFecha('no es fecha')).toBe('—');
  });
});

describe('formatearDiaMes', () => {
  it('día y mes en la hora de El Salvador', () => {
    expect(formatearDiaMes('2026-11-15T03:00:00Z')).toBe('14 de noviembre');
    expect(formatearDiaMes('2026-11-15T07:00:00Z')).toBe('15 de noviembre');
  });
  it('inválida: raya', () => {
    expect(formatearDiaMes('no es fecha')).toBe('—');
  });
});
