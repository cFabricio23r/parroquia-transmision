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

let A: { id: string; slug: string };
let B: { id: string; slug: string };
let cA: UsuarioPrueba;
let cB: UsuarioPrueba;
let admin: UsuarioPrueba;

beforeAll(async () => {
  A = await crearParroquia('rls-a');
  B = await crearParroquia('rls-b');
  cA = await crearUsuario(`ca-${sufijo()}@prueba.test`, CLAVE);
  cB = await crearUsuario(`cb-${sufijo()}@prueba.test`, CLAVE);
  admin = await crearUsuario(`admin-${sufijo()}@prueba.test`, CLAVE);
  await hacerMiembro(A.id, cA.id);
  await hacerMiembro(B.id, cB.id);
  await hacerAdmin(admin.id);
  // Una invitación por parroquia, para probar la lectura
  for (const p of [A, B]) {
    const { error } = await servicio.from('invitaciones').insert({
      correo: `inv-${sufijo()}@prueba.test`,
      rol: 'coordinador',
      parroquia_id: p.id,
      token_hash: `hash-${sufijo()}${sufijo()}`,
      vence_en: new Date(Date.now() + 3600_000).toISOString(),
    });
    expect(error).toBeNull();
  }
}, 60_000);

describe('RLS', () => {
  it('coordinador lee y guarda solo su borrador', async () => {
    const lecturaA = await cA.cliente.from('borradores').select('*').eq('parroquia_id', A.id);
    expect(lecturaA.data).toHaveLength(1);

    const guardarA = await cA.cliente
      .from('borradores')
      .update({ config: { titulo: 'nuevo', color: '#123456' } })
      .eq('parroquia_id', A.id)
      .select();
    expect(guardarA.error).toBeNull();
    expect(guardarA.data).toHaveLength(1);

    const lecturaB = await cA.cliente.from('borradores').select('*').eq('parroquia_id', B.id);
    expect(lecturaB.data).toHaveLength(0);

    const guardarB = await cA.cliente
      .from('borradores')
      .update({ config: { titulo: 'intruso' } })
      .eq('parroquia_id', B.id)
      .select();
    expect(guardarB.data ?? []).toHaveLength(0);
    const { data: intacto } = await servicio.from('borradores').select('config').eq('parroquia_id', B.id).single();
    expect(intacto?.config.titulo).toBe('inicial');
  });

  it('coordinador no escribe versiones, registro ni parroquias', async () => {
    const version = await cA.cliente.from('versiones').insert({ parroquia_id: A.id, numero: 99, config: {} });
    expect(version.error).not.toBeNull();

    const registro = await cA.cliente.from('registro').insert({ accion: 'x' });
    expect(registro.error).not.toBeNull();

    const parroquia = await cA.cliente.from('parroquias').insert({ slug: `intruso-${sufijo()}`, nombre: 'x' });
    expect(parroquia.error).not.toBeNull();

    const renombrar = await cA.cliente.from('parroquias').update({ nombre: 'hackeada' }).eq('id', A.id).select();
    expect(renombrar.data ?? []).toHaveLength(0);
  });

  it('solo el admin lee el registro y las invitaciones', async () => {
    // Una fila de registro de cada parroquia
    for (const p of [A, B]) {
      const { error } = await servicio.from('registro').insert({ parroquia_id: p.id, accion: 'prueba' });
      expect(error).toBeNull();
    }
    const regCoord = await cA.cliente.from('registro').select('*');
    expect(regCoord.data).toHaveLength(0);
    const invCoord = await cA.cliente.from('invitaciones').select('*');
    expect(invCoord.data).toHaveLength(0);

    const regAdmin = await admin.cliente.from('registro').select('parroquia_id').in('parroquia_id', [A.id, B.id]);
    expect(new Set(regAdmin.data?.map((r) => r.parroquia_id))).toEqual(new Set([A.id, B.id]));
    const invAdmin = await admin.cliente.from('invitaciones').select('parroquia_id').in('parroquia_id', [A.id, B.id]);
    expect(new Set(invAdmin.data?.map((r) => r.parroquia_id))).toEqual(new Set([A.id, B.id]));
  });

  it('guardar el borrador deja una fila en el registro con quién y qué campos', async () => {
    const { error } = await cB.cliente
      .from('borradores')
      .update({ config: { titulo: 'inicial', color: '#654321', extra: 1 } })
      .eq('parroquia_id', B.id);
    expect(error).toBeNull();
    const { data } = await servicio
      .from('registro')
      .select('*')
      .eq('parroquia_id', B.id)
      .eq('accion', 'guardar_borrador')
      .order('id', { ascending: false })
      .limit(1);
    expect(data).toHaveLength(1);
    expect(data![0].usuario_id).toBe(cB.id);
    expect([...data![0].detalle.campos].sort()).toEqual(['color', 'extra']);
  });

  it('storage: cA sube a borradores/<A>/ y no a borradores/<B>/; nadie sin service_role escribe en publicado; anon lee publicado', async () => {
    const cuerpo = new Blob(['hola'], { type: 'text/plain' });
    const propio = await cA.cliente.storage.from('borradores').upload(`${A.id}/a-${sufijo()}.txt`, cuerpo);
    expect(propio.error).toBeNull();
    const ajeno = await cA.cliente.storage.from('borradores').upload(`${B.id}/a-${sufijo()}.txt`, cuerpo);
    expect(ajeno.error).not.toBeNull();

    for (const quien of [cA.cliente, admin.cliente, clienteAnonimo()]) {
      const r = await quien.storage.from('publicado').upload(`${A.slug}/x-${sufijo()}.txt`, cuerpo);
      expect(r.error).not.toBeNull();
    }

    const ruta = `${A.slug}/leer-${sufijo()}.txt`;
    const sube = await servicio.storage.from('publicado').upload(ruta, cuerpo, { contentType: 'text/plain' });
    expect(sube.error).toBeNull();
    const lee = await clienteAnonimo().storage.from('publicado').download(ruta);
    expect(lee.error).toBeNull();
    expect(await lee.data!.text()).toBe('hola');
    const lista = await clienteAnonimo().storage.from('publicado').list(A.slug);
    expect(lista.data?.some((o) => ruta.endsWith(o.name))).toBe(true);
  });

  it('reservar_version da 1, 2, 3 aunque se llame en paralelo', async () => {
    const P = await crearParroquia('rls-ver');
    const llamadas = Array.from({ length: 10 }, async () => {
      const { data, error } = await servicio.rpc('reservar_version', { p: P.id });
      expect(error).toBeNull();
      return data as number;
    });
    const numeros = await Promise.all(llamadas);
    expect([...numeros].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    // Solo service_role puede llamarla
    const coord = await cA.cliente.rpc('reservar_version', { p: A.id });
    expect(coord.error).not.toBeNull();
    const anon = await clienteAnonimo().rpc('reservar_version', { p: A.id });
    expect(anon.error).not.toBeNull();
  });

  it('anon no lee ninguna tabla', async () => {
    const anon = clienteAnonimo();
    for (const tabla of ['parroquias', 'administradores', 'miembros', 'invitaciones', 'borradores', 'versiones', 'registro', 'envios_correo']) {
      const { data, error } = await anon.from(tabla).select('*');
      expect(error === null ? data : []).toHaveLength(0);
    }
  });
});
