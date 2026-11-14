// Parroquias que ve cada persona y su última versión publicada, contra el Supabase LOCAL (plan 2, tarea 15).
import { beforeAll, describe, expect, it } from 'vitest';
import { clienteServicio, crearParroquia, crearUsuario, hacerAdmin, hacerMiembro, sufijo, type UsuarioPrueba } from './ayudas';
import { idsDeMisMembresias, misParroquias } from '../../lib/mis-parroquias';

const servicio = clienteServicio();
const CLAVE = 'clave-de-prueba-123';
let A: { id: string; slug: string };
let B: { id: string; slug: string };
let coord: UsuarioPrueba;
let admin: UsuarioPrueba;

beforeAll(async () => {
  A = await crearParroquia('mis-a');
  B = await crearParroquia('mis-b');
  for (const numero of [1, 2]) {
    const { error } = await servicio.from('versiones').insert({ parroquia_id: A.id, numero, config: { nombre: 'A' } });
    if (error) throw new Error(error.message);
  }
  coord = await crearUsuario(`mis-c-${sufijo()}@prueba.test`, CLAVE);
  admin = await crearUsuario(`mis-adm-${sufijo()}@prueba.test`, CLAVE);
  await hacerMiembro(A.id, coord.id);
  await hacerAdmin(admin.id);
});

describe('misParroquias', () => {
  it('un coordinador de A ve solo A, con su última versión', async () => {
    const lista = await misParroquias(coord.cliente);
    expect(lista).toEqual([{ id: A.id, slug: A.slug, nombre: `Parroquia ${A.slug}`, version: 2, desactivada: false }]);
    expect(await idsDeMisMembresias(coord.cliente, coord.id)).toEqual([A.id]);
  });
  it('un admin ve las dos; la que no tiene versiones da null', async () => {
    const lista = await misParroquias(admin.cliente);
    const a = lista.find((p) => p.id === A.id);
    const b = lista.find((p) => p.id === B.id);
    expect(a?.version).toBe(2);
    expect(b?.version).toBeNull();
    expect(await idsDeMisMembresias(admin.cliente, admin.id)).toEqual([]);
  });
  it('un admin ve una desactivada con desactivada: true (Decisión 27 del plan 5)', async () => {
    await servicio.from('parroquias').update({ desactivada_en: new Date().toISOString() }).eq('id', B.id);
    try {
      const b = (await misParroquias(admin.cliente)).find((p) => p.id === B.id);
      expect(b?.desactivada).toBe(true);
    } finally {
      await servicio.from('parroquias').update({ desactivada_en: null }).eq('id', B.id);
    }
  });
});
