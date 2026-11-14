// Desactivar y reactivar parroquias (plan 5 del rediseño), contra el Supabase LOCAL con sesiones reales.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  clienteAnonimo,
  clienteServicio,
  crearParroquia,
  crearUsuario,
  hacerMiembro,
  limpiarStorage,
  sufijo,
  type UsuarioPrueba,
} from './ayudas';

const servicio = clienteServicio();
const CLAVE = 'clave-de-prueba-123';

const marcar = async (id: string, desactivada: boolean) => {
  const { error } = await servicio
    .from('parroquias')
    .update({ desactivada_en: desactivada ? new Date().toISOString() : null })
    .eq('id', id);
  expect(error).toBeNull();
};

let c: UsuarioPrueba;

beforeAll(async () => {
  c = await crearUsuario(`des-c-${sufijo()}@prueba.test`, CLAVE);
}, 60_000);

afterAll(async () => {
  await limpiarStorage();
}, 60_000);

describe('migración 9', () => {
  it('una parroquia desactivada deja de ser visible para sus miembros y sale de slugs_activos', async () => {
    const p = await crearParroquia('des9');
    const otra = await crearParroquia('des9-activa');
    await hacerMiembro(p.id, c.id);
    // Una versión, para comprobar que también deja de verse.
    await servicio.from('versiones').insert({ parroquia_id: p.id, numero: 1, config: { x: 1 } });

    const leer = () => c.cliente.from('parroquias').select('id').eq('id', p.id);
    expect((await leer()).data).toHaveLength(1);
    expect((await c.cliente.from('versiones').select('numero').eq('parroquia_id', p.id)).data).toHaveLength(1);

    await marcar(p.id, true);
    expect((await leer()).data).toHaveLength(0);
    expect((await c.cliente.from('borradores').select('parroquia_id').eq('parroquia_id', p.id)).data).toHaveLength(0);
    expect((await c.cliente.from('versiones').select('numero').eq('parroquia_id', p.id)).data).toHaveLength(0);
    const subida = await c.cliente.storage
      .from('borradores')
      .upload(`${p.id}/x-0a1b2c3d.png`, new Blob(['hola'], { type: 'image/png' }));
    expect(subida.error).not.toBeNull();

    const { data: slugs, error } = await clienteAnonimo().rpc('slugs_activos');
    expect(error).toBeNull();
    expect(Array.isArray(slugs)).toBe(true);
    for (const s of slugs as unknown[]) expect(typeof s).toBe('string');
    expect(slugs).not.toContain(p.slug);
    expect(slugs).toContain(otra.slug);

    expect((await clienteAnonimo().rpc('es_miembro', { p: p.id })).error).not.toBeNull();

    await marcar(p.id, false);
    expect((await leer()).data).toHaveLength(1);
    expect(((await clienteAnonimo().rpc('slugs_activos')).data as string[])).toContain(p.slug);
  });
});
