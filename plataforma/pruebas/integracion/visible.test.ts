// «Visible en la app» (etapa 3a): la columna parroquias.visible y la consulta que hace la app,
// contra el Supabase LOCAL con sesiones reales.
import { beforeAll, describe, expect, it } from 'vitest';
import {
  clienteAnonimo,
  clienteServicio,
  crearParroquia,
  crearUsuario,
  hacerAdmin,
  hacerMiembro,
  sufijo,
  type UsuarioPrueba,
} from './ayudas';

const servicio = clienteServicio();
const CLAVE = 'clave-de-prueba-123';

type Parroquia = { id: string; slug: string };

const poner = async (id: string, cambios: Record<string, unknown>) => {
  const { error } = await servicio.from('parroquias').update(cambios).eq('id', id);
  expect(error).toBeNull();
};

let A: Parroquia;
let B: Parroquia;
let C: Parroquia;
let D: Parroquia;
let c: UsuarioPrueba;
let a: UsuarioPrueba;
let nueva: Parroquia;

/** La consulta de la app (Decisión 8 del plan 3a), filtrada a las parroquias de esta prueba. */
async function consultaDeLaApp(u: UsuarioPrueba): Promise<{ id: string; slug: string; nombre: string }[]> {
  const { data, error } = await u.cliente
    .from('parroquias')
    .select('id, slug, nombre')
    .eq('visible', true)
    .is('desactivada_en', null)
    .in('id', [A.id, B.id, C.id, D.id])
    .order('nombre');
  expect(error).toBeNull();
  return data ?? [];
}

beforeAll(async () => {
  nueva = await crearParroquia('vis');
  A = await crearParroquia('vis');
  B = await crearParroquia('vis');
  C = await crearParroquia('vis');
  D = await crearParroquia('vis');
  await poner(A.id, { visible: true });
  await poner(C.id, { visible: true, desactivada_en: new Date().toISOString() });
  await poner(D.id, { visible: true });
  c = await crearUsuario(`vis-c-${sufijo()}@prueba.test`, CLAVE);
  a = await crearUsuario(`vis-a-${sufijo()}@prueba.test`, CLAVE);
  for (const p of [A, B, C]) await hacerMiembro(p.id, c.id);
  await hacerAdmin(a.id);
}, 60_000);

describe('parroquias.visible', () => {
  it('una parroquia recién creada no es visible', async () => {
    const { data, error } = await servicio.from('parroquias').select('visible').eq('id', nueva.id).single();
    expect(error).toBeNull();
    expect(data?.visible).toBe(false);
  });

  it('el coordinador ve solo sus parroquias visibles y activas', async () => {
    const filas = await consultaDeLaApp(c);
    expect(filas.map((f) => f.id)).toEqual([A.id]);
  });

  it('el admin ve todas las visibles y activas, en orden de nombre', async () => {
    const filas = await consultaDeLaApp(a);
    const esperadas = [A, D].sort((x, y) => (x.slug < y.slug ? -1 : x.slug > y.slug ? 1 : 0));
    expect(filas.map((f) => f.id)).toEqual(esperadas.map((p) => p.id));
  });

  it('un coordinador no puede cambiar visible', async () => {
    await c.cliente.from('parroquias').update({ visible: true }).eq('id', B.id);
    const { data, error } = await servicio.from('parroquias').select('visible').eq('id', B.id).single();
    expect(error).toBeNull();
    expect(data?.visible).toBe(false);
  });

  it('anon no puede leer visible', async () => {
    const { error } = await clienteAnonimo().from('parroquias').select('visible');
    expect(error).not.toBeNull();
  });
});
