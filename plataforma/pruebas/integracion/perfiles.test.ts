// Tabla perfiles y su RLS, contra el Supabase LOCAL (plan 2, tarea 9).
import { beforeAll, describe, expect, it } from 'vitest';
import { clienteAnonimo, clienteServicio, crearParroquia, crearUsuario, hacerAdmin, hacerMiembro, sufijo, type UsuarioPrueba } from './ayudas';
import { guardarNombre, leerNombre } from '../../lib/perfiles';

const servicio = clienteServicio();
const CLAVE = 'clave-de-prueba-123';

let cA1: UsuarioPrueba; // coordinador de A
let cA2: UsuarioPrueba; // otro coordinador de A
let cB: UsuarioPrueba; // coordinador de B
let admin: UsuarioPrueba;

beforeAll(async () => {
  const A = await crearParroquia('perf-a');
  const B = await crearParroquia('perf-b');
  cA1 = await crearUsuario(`pa1-${sufijo()}@prueba.test`, CLAVE);
  cA2 = await crearUsuario(`pa2-${sufijo()}@prueba.test`, CLAVE);
  cB = await crearUsuario(`pb-${sufijo()}@prueba.test`, CLAVE);
  admin = await crearUsuario(`padm-${sufijo()}@prueba.test`, CLAVE);
  await hacerMiembro(A.id, cA1.id);
  await hacerMiembro(A.id, cA2.id);
  await hacerMiembro(B.id, cB.id);
  await hacerAdmin(admin.id);
});

describe('perfiles', () => {
  it('cada uno guarda y lee su nombre; un segundo guardado actualiza', async () => {
    for (const [u, nombre] of [
      [cA1, 'Ana Uno'],
      [cA2, 'Beto Dos'],
      [cB, 'Carla Tres'],
      [admin, 'Admin Cuatro'],
    ] as const) {
      expect(await guardarNombre(u.cliente, nombre)).toEqual({});
      expect(await leerNombre(u.cliente, u.id)).toBe(nombre);
    }
    expect(await guardarNombre(cA1.cliente, '  Ana   Primera ')).toEqual({});
    expect(await leerNombre(cA1.cliente, cA1.id)).toBe('Ana Primera');
  });

  it('un coordinador lee el nombre de otro de su parroquia y no el de otra', async () => {
    expect(await leerNombre(cA1.cliente, cA2.id)).toBe('Beto Dos');
    expect(await leerNombre(cA1.cliente, cB.id)).toBeNull();
    expect(await leerNombre(cB.cliente, cA1.id)).toBeNull();
  });

  it('un admin lee todos', async () => {
    expect(await leerNombre(admin.cliente, cA1.id)).toBe('Ana Primera');
    expect(await leerNombre(admin.cliente, cB.id)).toBe('Carla Tres');
  });

  it('un coordinador no puede insertar ni actualizar la fila de otro', async () => {
    const otro = await crearUsuario(`potro-${sufijo()}@prueba.test`, CLAVE);
    const ins = await cA1.cliente.from('perfiles').insert({ usuario_id: otro.id, nombre: 'Impostor' });
    expect(ins.error).not.toBeNull();
    const upd = await cA1.cliente.from('perfiles').update({ nombre: 'Impostor' }).eq('usuario_id', cA2.id).select();
    expect(upd.data ?? []).toHaveLength(0);
    expect(await leerNombre(admin.cliente, cA2.id)).toBe('Beto Dos');
  });

  it('el anónimo no puede leer perfiles ni llamar comparte_parroquia', async () => {
    const anon = clienteAnonimo();
    expect((await anon.from('perfiles').select('nombre')).error).not.toBeNull();
    expect((await anon.rpc('comparte_parroquia', { otro: cA1.id })).error).not.toBeNull();
  });

  it('el check rechaza un nombre vacío aunque lo inserte service_role', async () => {
    const u = await crearUsuario(`pvacio-${sufijo()}@prueba.test`, CLAVE);
    const { error } = await servicio.from('perfiles').insert({ usuario_id: u.id, nombre: '' });
    expect(error).not.toBeNull();
  });
});
