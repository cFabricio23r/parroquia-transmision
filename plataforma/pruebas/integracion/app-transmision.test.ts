// «App y transmisión» (etapa 3c): las tablas ajustes_app y claves_transmision, sus políticas y
// sus check, contra el Supabase LOCAL con sesiones reales. Las claves son falsas y se notan.
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

let A: Parroquia;
let B: Parroquia;
let cA: UsuarioPrueba;
let cB: UsuarioPrueba;
let admin: UsuarioPrueba;

beforeAll(async () => {
  A = await crearParroquia('apt');
  B = await crearParroquia('apt');
  cA = await crearUsuario(`apt-a-${sufijo()}@prueba.local`, CLAVE);
  cB = await crearUsuario(`apt-b-${sufijo()}@prueba.local`, CLAVE);
  admin = await crearUsuario(`apt-admin-${sufijo()}@prueba.local`, CLAVE);
  await hacerMiembro(A.id, cA.id);
  await hacerMiembro(B.id, cB.id);
  await hacerAdmin(admin.id);
}, 60_000);

describe('RLS', () => {
  beforeAll(async () => {
    for (const [p, clave] of [
      [A, 'FB-CLAVE-FALSA-1111'],
      [B, 'FB-CLAVE-FALSA-2222'],
    ] as const) {
      expect((await servicio.from('claves_transmision').insert({ parroquia_id: p.id, clave })).error).toBeNull();
      expect((await servicio.from('ajustes_app').insert({ parroquia_id: p.id, servidor: 'rtmps://x/' })).error).toBeNull();
    }
  });

  it('el coordinador lee lo de su parroquia, clave incluida', async () => {
    const k = await cA.cliente.from('claves_transmision').select('clave').eq('parroquia_id', A.id);
    expect(k.data).toEqual([{ clave: 'FB-CLAVE-FALSA-1111' }]);
    const a = await cA.cliente.from('ajustes_app').select('servidor').eq('parroquia_id', A.id);
    expect(a.data).toEqual([{ servidor: 'rtmps://x/' }]);
  });

  it('no lee ni escribe lo de otra parroquia', async () => {
    expect((await cA.cliente.from('claves_transmision').select('clave').eq('parroquia_id', B.id)).data).toEqual([]);
    expect((await cA.cliente.from('ajustes_app').select('servidor').eq('parroquia_id', B.id)).data).toEqual([]);
    expect((await cA.cliente.from('claves_transmision').insert({ parroquia_id: B.id, clave: 'X' })).error).not.toBeNull();
    await cA.cliente.from('claves_transmision').update({ clave: 'X' }).eq('parroquia_id', B.id);
    await cA.cliente.from('ajustes_app').update({ servidor: 'rtmps://otro/' }).eq('parroquia_id', B.id);
    await cA.cliente.from('claves_transmision').delete().eq('parroquia_id', B.id);
    const k = await servicio.from('claves_transmision').select('clave').eq('parroquia_id', B.id);
    expect(k.data).toEqual([{ clave: 'FB-CLAVE-FALSA-2222' }]);
    const a = await servicio.from('ajustes_app').select('servidor').eq('parroquia_id', B.id);
    expect(a.data).toEqual([{ servidor: 'rtmps://x/' }]);
  });

  it('el admin lee las dos', async () => {
    const k = await admin.cliente.from('claves_transmision').select('parroquia_id').in('parroquia_id', [A.id, B.id]);
    expect(k.data).toHaveLength(2);
    const a = await admin.cliente.from('ajustes_app').select('parroquia_id').in('parroquia_id', [A.id, B.id]);
    expect(a.data).toHaveLength(2);
  });

  it('el anónimo no tiene permiso', async () => {
    expect((await clienteAnonimo().from('claves_transmision').select('clave')).error).not.toBeNull();
    expect((await clienteAnonimo().from('ajustes_app').select('servidor')).error).not.toBeNull();
  });

  it('los check rechazan datos malos', async () => {
    const C = await crearParroquia('apt');
    for (const clave of ['con espacio', '', 'x'.repeat(201)]) {
      expect((await servicio.from('claves_transmision').insert({ parroquia_id: C.id, clave })).error).not.toBeNull();
    }
    for (const fila of [{ servidor: 'http://x' }, { calidad_defecto: '4k' }, { estilo_final: 'rojo' }]) {
      expect((await servicio.from('ajustes_app').insert({ parroquia_id: C.id, ...fila })).error).not.toBeNull();
    }
    const r = await servicio.from('ajustes_app').insert({ parroquia_id: C.id }).select('servidor, calidad_defecto, estilo_final').single();
    expect(r.data).toEqual({ servidor: null, calidad_defecto: '720p', estilo_final: 'azul' });
  });

  it('con la parroquia desactivada el coordinador ya no lee la clave', async () => {
    expect((await servicio.from('parroquias').update({ desactivada_en: new Date().toISOString() }).eq('id', A.id)).error).toBeNull();
    try {
      expect((await cA.cliente.from('claves_transmision').select('clave').eq('parroquia_id', A.id)).data).toEqual([]);
    } finally {
      await servicio.from('parroquias').update({ desactivada_en: null }).eq('id', A.id);
    }
  });
});
