import { describe, expect, it } from 'vitest';
import { cuandoRegistro, fechaCompleta, cuandoVersion, fechaHoraCorta, formatearDiaMes, formatearFecha, MESES_CORTOS, ultimaEntrada } from '../../lib/fecha';

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

describe('fechas relativas (plan 5)', () => {
  const ahora = new Date('2026-11-14T20:00:00Z'); // 14 nov, 14:00 en El Salvador

  it('MESES_CORTOS', () => {
    expect(MESES_CORTOS).toEqual(['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']);
  });

  it('cuandoRegistro: hoy, ayer (en el cambio de día local), este año y otro año', () => {
    expect(cuandoRegistro('2026-11-15T00:42:00Z', new Date('2026-11-15T01:00:00Z'))).toBe('Hoy 18:42');
    // 23:30 del 14 local, visto a la 01:00 del 15 local: en UTC es el mismo día (15).
    expect(cuandoRegistro('2026-11-15T05:30:00Z', new Date('2026-11-15T07:00:00Z'))).toBe('Ayer 23:30');
    expect(cuandoRegistro('2026-11-05T16:12:00Z', ahora)).toBe('5 nov 10:12');
    expect(cuandoRegistro('2025-12-31T18:00:00Z', ahora)).toBe('31 dic 2025 12:00');
    expect(cuandoRegistro('nada')).toBe('—');
  });

  it('cuandoVersion', () => {
    expect(cuandoVersion('2026-11-15T00:42:00Z', new Date('2026-11-15T01:00:00Z'))).toBe('hoy 18:42');
    expect(cuandoVersion('2026-11-15T05:30:00Z', new Date('2026-11-15T07:00:00Z'))).toBe('ayer 23:30');
    expect(cuandoVersion('2026-11-05T16:12:00Z', ahora)).toBe('5 nov');
    expect(cuandoVersion('2025-12-31T18:00:00Z', ahora)).toBe('31 dic 2025');
    expect(cuandoVersion('nada', ahora)).toBe('—');
  });

  it('ultimaEntrada', () => {
    const antes = (dias: number) => new Date(ahora.getTime() - dias * 86_400_000).toISOString();
    expect(ultimaEntrada(null, ahora)).toBe('—');
    expect(ultimaEntrada(undefined, ahora)).toBe('—');
    expect(ultimaEntrada(antes(0), ahora)).toBe('hoy');
    expect(ultimaEntrada(antes(1), ahora)).toBe('ayer');
    expect(ultimaEntrada(antes(3), ahora)).toBe('hace 3 días');
    expect(ultimaEntrada(antes(6), ahora)).toBe('hace 6 días');
    expect(ultimaEntrada(antes(7), ahora)).toBe('7 nov');
    expect(ultimaEntrada('2025-12-31T18:00:00Z', ahora)).toBe('31 dic 2025');
    expect(ultimaEntrada('nada', ahora)).toBe('—');
  });
});

describe('fechaCompleta', () => {
  it('día, mes corto, año y hora de El Salvador', () => {
    expect(fechaCompleta('2026-11-15T00:42:00Z')).toBe('14 nov 2026, 18:42');
    expect(fechaCompleta('2026-01-05T16:05:00Z')).toBe('5 ene 2026, 10:05');
    expect(fechaCompleta('x')).toBe('—');
  });
});

describe('fechaHoraCorta', () => {
  it('«13 nov, 18:42» en hora de El Salvador, con el cambio de día', () => {
    expect(fechaHoraCorta('2026-11-14T00:42:00Z')).toBe('13 nov, 18:42');
    expect(fechaHoraCorta('no')).toBe('—');
  });
});
