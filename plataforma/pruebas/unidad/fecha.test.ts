import { describe, expect, it } from 'vitest';
import { formatearFecha } from '../../lib/fecha';

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
