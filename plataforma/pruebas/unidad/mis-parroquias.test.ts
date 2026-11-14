import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { misParroquias } from '../../lib/mis-parroquias';

/**
 * Cliente falso que anota cada consulta. `versiones` sin filtro devolvería todas las filas, y
 * PostgREST corta en max_rows (1000 en config.toml): el chip mostraría una versión vieja.
 */
function clienteAnotador(maximos: Record<string, number | undefined>) {
  const consultas: { tabla: string; pasos: [string, ...unknown[]][] }[] = [];
  const from = vi.fn((tabla: string) => {
    const c = { tabla, pasos: [] as [string, ...unknown[]][] };
    consultas.push(c);
    const resolver = () => {
      if (tabla === 'parroquias')
        return { data: Object.keys(maximos).map((id) => ({ id, slug: id, nombre: `P ${id}` })), error: null };
      const eq = c.pasos.find((p) => p[0] === 'eq');
      const id = eq?.[2] as string;
      const n = maximos[id];
      return { data: n === undefined ? [] : [{ numero: n }], error: null };
    };
    const b: Record<string, unknown> = {};
    for (const paso of ['select', 'eq', 'order', 'limit']) {
      b[paso] = (...args: unknown[]) => {
        c.pasos.push([paso, ...args]);
        return b;
      };
    }
    b.then = (ok: (v: unknown) => unknown, mal: (e: unknown) => unknown) => Promise.resolve(resolver()).then(ok, mal);
    return b;
  });
  return { cliente: { from } as unknown as SupabaseClient, consultas };
}

describe('misParroquias', () => {
  it('pide solo la última versión de cada parroquia (orden descendente, limit 1)', async () => {
    const { cliente, consultas } = clienteAnotador({ a: 1200, b: undefined });
    expect(await misParroquias(cliente)).toEqual([
      { id: 'a', slug: 'a', nombre: 'P a', version: 1200 },
      { id: 'b', slug: 'b', nombre: 'P b', version: null },
    ]);
    const deVersiones = consultas.filter((c) => c.tabla === 'versiones');
    expect(deVersiones).toHaveLength(2);
    for (const c of deVersiones) {
      expect(c.pasos).toContainEqual(['select', 'numero']);
      expect(c.pasos.some((p) => p[0] === 'eq' && p[1] === 'parroquia_id')).toBe(true);
      expect(c.pasos).toContainEqual(['order', 'numero', { ascending: false }]);
      expect(c.pasos).toContainEqual(['limit', 1]);
    }
  });
  it('sin parroquias no consulta versiones', async () => {
    const { cliente, consultas } = clienteAnotador({});
    expect(await misParroquias(cliente)).toEqual([]);
    expect(consultas.filter((c) => c.tabla === 'versiones')).toHaveLength(0);
  });
});
