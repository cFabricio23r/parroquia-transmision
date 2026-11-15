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
import { MENSAJE_SOLO_ADMIN, type DepsAdmin } from '../../lib/admin';
import { cambiarVisible, listarParroquias } from '../../lib/admin-parroquias';

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

const depsDe = (u: UsuarioPrueba): DepsAdmin => ({
  servicio,
  sesion: u.cliente,
  enviar: async () => {},
  sitioUrl: 'http://x',
  slugsDelRepo: [],
});
const visibleDe = async (id: string) => (await servicio.from('parroquias').select('visible').eq('id', id).single()).data?.visible;
const registroDe = async (id: string) =>
  ((await servicio.from('registro').select('accion, detalle, usuario_id').eq('parroquia_id', id).eq('accion', 'cambiar_visible')).data ??
    []) as { accion: string; detalle: Record<string, unknown>; usuario_id: string | null }[];

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

describe('cambiarVisible (D1)', () => {
  it('un coordinador no puede: solo admin, y la parroquia no cambia', async () => {
    expect(await cambiarVisible(depsDe(c), A.id, false)).toEqual({ error: MENSAJE_SOLO_ADMIN });
    expect(await visibleDe(A.id)).toBe(true);
    expect(await registroDe(A.id)).toHaveLength(0);
  });

  it('el admin la cambia y se registra; repetirlo no registra de nuevo', async () => {
    const P = await crearParroquia('vis-ad');
    await poner(P.id, { visible: true });
    const { data: fila } = await servicio.from('parroquias').select('slug, nombre').eq('id', P.id).single();
    expect(await cambiarVisible(depsDe(a), P.id, false)).toEqual({});
    expect(await visibleDe(P.id)).toBe(false);
    const filas = await registroDe(P.id);
    expect(filas).toHaveLength(1);
    expect(filas[0].usuario_id).toBe(a.id);
    expect(filas[0].detalle).toEqual({ slug: fila?.slug, nombre: fila?.nombre, visible: false });

    expect(await cambiarVisible(depsDe(a), P.id, false)).toEqual({});
    expect(await registroDe(P.id)).toHaveLength(1);

    expect(await cambiarVisible(depsDe(a), P.id, true)).toEqual({});
    expect(await visibleDe(P.id)).toBe(true);
    expect((await registroDe(P.id)).map((f) => f.detalle.visible)).toEqual(expect.arrayContaining([false, true]));
  });

  it('una parroquia que no existe', async () => {
    expect(await cambiarVisible(depsDe(a), '00000000-0000-4000-8000-000000000000', true)).toEqual({ error: 'Esa parroquia no existe.' });
    expect(await cambiarVisible(depsDe(a), 'no-es-uuid', true)).toEqual({ error: 'Esa parroquia no existe.' });
  });

  it('listarParroquias trae visible en cada fila', async () => {
    const filas = await listarParroquias(servicio);
    for (const f of filas) expect(typeof f.visible).toBe('boolean');
    expect(filas.find((f) => f.id === A.id)?.visible).toBe(true);
    expect(filas.find((f) => f.id === B.id)?.visible).toBe(false);
  });
});
