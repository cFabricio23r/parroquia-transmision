import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MENSAJES_ACCESO } from '../../lib/mensajes-acceso';
import { idsDeMisMembresias, misParroquias, parroquiasVisibles } from '../../lib/mis-parroquias';

/**
 * Cliente falso que anota cada consulta. `versiones` sin filtro devolvería todas las filas, y
 * PostgREST corta en max_rows (1000 en config.toml): el chip mostraría una versión vieja.
 */
function clienteAnotador(maximos: Record<string, number | undefined>, fallar: string[] = []) {
  const consultas: { tabla: string; pasos: [string, ...unknown[]][] }[] = [];
  const from = vi.fn((tabla: string) => {
    const c = { tabla, pasos: [] as [string, ...unknown[]][] };
    consultas.push(c);
    const resolver = () => {
      if (fallar.includes(tabla)) return { data: null, error: { message: 'falló', code: 'PGRST000' } };
      if (tabla === 'miembros') return { data: [{ parroquia_id: 'a' }], error: null };
      if (tabla === 'parroquias')
        return { data: Object.keys(maximos).map((id) => ({ id, slug: id, nombre: `P ${id}`, desactivada_en: id === 'b' ? '2026-11-01T00:00:00Z' : null })), error: null };
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
      { id: 'a', slug: 'a', nombre: 'P a', version: 1200, desactivada: false },
      { id: 'b', slug: 'b', nombre: 'P b', version: null, desactivada: true },
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

describe('errores de PostgREST: C1 y C2 muestran un estado en español en vez de la página de error (revisión)', () => {
  it('si falla la lista de parroquias, misParroquias da null (no lanza)', async () => {
    const { cliente } = clienteAnotador({ a: 1 }, ['parroquias']);
    await expect(misParroquias(cliente)).resolves.toBeNull();
  });
  it('si falla una consulta de versiones, también null', async () => {
    const { cliente } = clienteAnotador({ a: 1 }, ['versiones']);
    await expect(misParroquias(cliente)).resolves.toBeNull();
  });
  it('si el cliente lanza (sin red), null', async () => {
    const cliente = { from: () => { throw new Error('fetch failed'); } } as unknown as SupabaseClient;
    await expect(misParroquias(cliente)).resolves.toBeNull();
    await expect(parroquiasVisibles(cliente)).resolves.toBeNull();
    await expect(idsDeMisMembresias(cliente, 'u')).resolves.toBeNull();
  });
  it('idsDeMisMembresias da null si falla', async () => {
    const { cliente } = clienteAnotador({}, ['miembros']);
    await expect(idsDeMisMembresias(cliente, 'u')).resolves.toBeNull();
  });
  it('Mi cuenta usa parroquiasVisibles: no consulta versiones', async () => {
    const { cliente, consultas } = clienteAnotador({ a: 3, b: undefined });
    expect(await parroquiasVisibles(cliente)).toEqual([
      { id: 'a', slug: 'a', nombre: 'P a', desactivada: false },
      { id: 'b', slug: 'b', nombre: 'P b', desactivada: true },
    ]);
    expect(consultas.filter((c) => c.tabla === 'versiones')).toHaveLength(0);
  });
  it('el mensaje del estado de error', () => {
    expect(MENSAJES_ACCESO['no-se-pudo-cargar']).toEqual({
      titulo: 'No se pudo cargar',
      texto: 'No pudimos leer tus parroquias. Espera un momento y vuelve a intentar.',
      tono: 'ambar',
    });
  });
});
