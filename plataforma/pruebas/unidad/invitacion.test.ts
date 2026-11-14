import { describe, expect, it } from 'vitest';
import { estadoInvitacion } from '../../lib/admin';

const AHORA = Date.parse('2026-11-14T12:00:00Z');
const futuro = '2026-11-20T12:00:00Z';
const pasado = '2026-11-01T12:00:00Z';

describe('estadoInvitacion', () => {
  it('sin fila no sirve', () => {
    expect(estadoInvitacion(null, AHORA)).toBe('no-sirve');
  });
  it('vigente, y vencida justo al llegar la fecha', () => {
    expect(estadoInvitacion({ usada_en: null, anulada_en: null, vence_en: futuro }, AHORA)).toBe('vigente');
    expect(estadoInvitacion({ usada_en: null, anulada_en: null, vence_en: new Date(AHORA).toISOString() }, AHORA)).toBe('vencida');
    expect(estadoInvitacion({ usada_en: null, anulada_en: null, vence_en: pasado }, AHORA)).toBe('vencida');
  });
  it('usada o anulada no sirve aunque además esté vencida', () => {
    expect(estadoInvitacion({ usada_en: pasado, anulada_en: null, vence_en: pasado }, AHORA)).toBe('no-sirve');
    expect(estadoInvitacion({ usada_en: pasado, anulada_en: null, vence_en: futuro }, AHORA)).toBe('no-sirve');
    expect(estadoInvitacion({ usada_en: null, anulada_en: pasado, vence_en: futuro }, AHORA)).toBe('no-sirve');
  });
  it('una fecha ilegible no se toma por vigente', () => {
    expect(estadoInvitacion({ usada_en: null, anulada_en: null, vence_en: 'no es fecha' }, AHORA)).toBe('vencida');
  });
});
