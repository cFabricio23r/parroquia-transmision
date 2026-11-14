import { describe, expect, it } from 'vitest';
import { bloquesCambiados, cambiosParaEnviar, fusionarPorBloque, iguales } from '../../lib/editor/fusion';

describe('iguales', () => {
  it('no mira el orden de las claves pero sí el de los arreglos', () => {
    expect(iguales({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 })).toBe(true);
    expect(iguales([1, 2], [2, 1])).toBe(false);
    expect(iguales({ a: undefined }, {})).toBe(true);
    expect(iguales({ a: 1 }, { a: '1' })).toBe(false);
    expect(iguales(null, {})).toBe(false);
  });
});

describe('bloquesCambiados y cambiosParaEnviar', () => {
  it('lista solo los bloques distintos', () => {
    expect(bloquesCambiados({ nombre: 'a', galeria: [] }, { galeria: [], nombre: 'b' })).toEqual(['nombre']);
  });
  it('un bloque quitado se manda como null', () => {
    expect(cambiosParaEnviar({ redes: [1] }, {})).toEqual({ redes: null });
  });
});

describe('fusionarPorBloque', () => {
  const base = { nombre: 'N', avisos: [{ texto: 'a' }], galeria: [] as unknown[], lugar: 'L' };

  it('bloques distintos se fusionan sin conflicto', () => {
    const local = { ...base, avisos: [{ texto: 'mío' }] };
    const remoto = { ...base, galeria: [{ id: 'img-1' }] };
    const r = fusionarPorBloque(base, local, remoto);
    expect(r.conflictos).toEqual([]);
    expect(r.propios).toEqual(['avisos']);
    expect(r.fusionado.avisos).toEqual([{ texto: 'mío' }]);
    expect(r.fusionado.galeria).toEqual([{ id: 'img-1' }]);
  });

  it('el mismo bloque cambiado distinto es conflicto', () => {
    const r = fusionarPorBloque(base, { ...base, avisos: [{ texto: 'mío' }] }, { ...base, avisos: [{ texto: 'suyo' }] });
    expect(r.conflictos).toEqual(['avisos']);
    expect(r.fusionado.avisos).toEqual([{ texto: 'mío' }]);
  });

  it('el mismo cambio en los dos lados no es conflicto', () => {
    const r = fusionarPorBloque(base, { ...base, lugar: 'X' }, { ...base, lugar: 'X' });
    expect(r.conflictos).toEqual([]);
    expect(r.propios).toEqual([]);
  });

  it('el remoto con las claves en otro orden (jsonb) no da conflictos fantasma', () => {
    const local = { ...base, avisos: [{ texto: 'mío', desde: '2026-01-01' }] };
    const remoto = { lugar: 'L', galeria: [], avisos: [{ texto: 'a' }], nombre: 'N' };
    const r = fusionarPorBloque(base, local, remoto);
    expect(r.conflictos).toEqual([]);
    expect(iguales(r.fusionado, local)).toBe(true);
  });

  it('las claves que no son bloques vienen del remoto', () => {
    const r = fusionarPorBloque({ ...base, extra: 1 }, { ...base, extra: 2 }, { ...base, extra: 3 });
    expect(r.fusionado.extra).toBe(3);
  });
});
