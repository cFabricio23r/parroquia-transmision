// Patrono y fiesta (plan 3, Tarea 13).
import { describe, expect, it } from 'vitest';
import { cambiarMes, CUENTA_POR_DEFECTO, diasDelMes, OPCIONES_CUENTA, opcionesCuenta } from '../../lib/editor/fiesta';

describe('fiesta', () => {
  it('diasDelMes: febrero 29 (como vicaria), abril 30', () => {
    expect(diasDelMes(2)).toBe(29);
    expect(diasDelMes(4)).toBe(30);
    expect(diasDelMes(1)).toBe(31);
  });
  it('opcionesCuenta agrega un valor raro al final y conserva las 4', () => {
    const o = opcionesCuenta(45);
    expect(o).toHaveLength(5);
    expect(o[o.length - 1]).toEqual({ valor: 45, texto: 'Desde 45 días antes' });
    expect(opcionesCuenta(60)).toHaveLength(4);
    expect(opcionesCuenta(undefined)).toEqual(OPCIONES_CUENTA);
    expect(opcionesCuenta(4.5)).toHaveLength(4);
    expect(OPCIONES_CUENTA[0]).toEqual({ valor: 9, texto: 'Desde 9 días antes (la novena)' });
    expect(CUENTA_POR_DEFECTO).toBe(60);
  });
  it('cambiarMes baja el día si se pasa y no muta', () => {
    const f = { dia: 31, mes: 1, lema: 'x' };
    expect(cambiarMes(f, 4)).toEqual({ dia: 30, mes: 4, lema: 'x' });
    expect(f).toEqual({ dia: 31, mes: 1, lema: 'x' });
    expect(cambiarMes({ dia: 10, mes: 1 }, 2)).toEqual({ dia: 10, mes: 2 });
  });
});

describe('notaPatrono (Decisión 19)', () => {
  it('con lema y sin lema', async () => {
    const { notaPatrono } = await import('../../app/editor/p/[slug]/patrono/SeccionPatrono');
    expect(notaPatrono('José, hombre justo y fiel')).toBe('«José, hombre justo y fiel» aparece como franja abajo, con el color de acento.');
    expect(notaPatrono('')).toBe('Sin lema no aparece la franja de abajo.');
  });
});
