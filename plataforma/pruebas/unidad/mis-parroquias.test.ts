import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MENSAJES_ACCESO } from '../../lib/mensajes-acceso';
import { idsDeMisMembresias, misParroquias, parroquiasVisibles } from '../../lib/mis-parroquias';

/**
 * Cliente falso que anota cada consulta. `versiones` sin límite devolvería todas las filas, y
 * PostgREST corta en max_rows (1000 en config.toml): el chip mostraría una versión vieja. Por eso
 * la última versión va embebida en `parroquias` con limit 1 por parroquia.
 */
function clienteAnotador(maximos: Record<string, number | undefined>, fallar: string[] = []) {
  const consultas: { tabla: string; pasos: [string, ...unknown[]][] }[] = [];
  const from = vi.fn((tabla: string) => {
    const c = { tabla, pasos: [] as [string, ...unknown[]][] };
    consultas.push(c);
    const resolver = () => {
      if (fallar.includes(tabla)) return { data: null, error: { message: 'falló', code: 'PGRST000' } };
      if (tabla === 'miembros') return { data: [{ parroquia_id: 'a' }], error: null };
      if (tabla === 'parroquias') {
        const conVersiones = c.pasos.some((p) => p[0] === 'select' && String(p[1]).includes('versiones('));
        return {
          data: Object.keys(maximos).map((id) => ({
            id,
            slug: id,
            nombre: `P ${id}`,
            desactivada_en: id === 'b' ? '2026-11-01T00:00:00Z' : null,
            ...(conVersiones ? { versiones: maximos[id] === undefined ? [] : [{ numero: maximos[id] }] } : {}),
          })),
          error: null,
        };
      }
      return { data: [], error: null };
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
  it('una sola consulta: la última versión viene embebida (orden descendente, limit 1), no una por parroquia', async () => {
    // Con cientos de parroquias, una consulta de versiones por cada una hacía tardar C1 de 12 a 16 s para un admin.
    const { cliente, consultas } = clienteAnotador({ a: 1200, b: undefined });
    expect(await misParroquias(cliente)).toEqual([
      { id: 'a', slug: 'a', nombre: 'P a', version: 1200, desactivada: false },
      { id: 'b', slug: 'b', nombre: 'P b', version: null, desactivada: true },
    ]);
    expect(consultas).toHaveLength(1);
    const [c] = consultas;
    expect(c.tabla).toBe('parroquias');
    expect(c.pasos.some((p) => p[0] === 'select' && /versiones\(numero\)/.test(String(p[1])))).toBe(true);
    expect(c.pasos).toContainEqual(['order', 'numero', { referencedTable: 'versiones', ascending: false }]);
    expect(c.pasos).toContainEqual(['limit', 1, { referencedTable: 'versiones' }]);
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
