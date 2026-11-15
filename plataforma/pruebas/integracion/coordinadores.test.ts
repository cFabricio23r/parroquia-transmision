// Coordinadores e invitaciones de todas las parroquias (D2), contra el Supabase LOCAL.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clienteAnonimo, clienteServicio, crearParroquia, crearUsuario, hacerAdmin, hacerMiembro, sufijo, type UsuarioPrueba } from './ayudas';
import { MENSAJE_PARROQUIA_DESACTIVADA, MENSAJE_SOLO_ADMIN, invitar, quitarAcceso, type DepsAdmin } from '../../lib/admin';
import {
  MENSAJE_YA_COORDINA,
  MENSAJE_INVITACION_NO_PENDIENTE,
  anularInvitacion,
  asignar,
  listarCoordinadores,
  reenviarInvitacion,
} from '../../lib/admin-coordinadores';
import type { Mensaje } from '../../lib/correo';

const servicio = clienteServicio();
const CLAVE = 'clave-de-prueba-123';
let buzon: Mensaje[];
const enviar = async (m: Mensaje) => {
  buzon.push(m);
};
const depsDe = (u: UsuarioPrueba | null): DepsAdmin => ({
  servicio,
  sesion: u ? u.cliente : clienteAnonimo(),
  enviar,
  sitioUrl: 'http://x',
  slugsDelRepo: [],
});

let admin: UsuarioPrueba;
let m: UsuarioPrueba;
let A: { id: string; slug: string };
let B: { id: string; slug: string };
let D: { id: string; slug: string };

beforeAll(async () => {
  admin = await crearUsuario(`coo-admin-${sufijo()}@prueba.test`, CLAVE);
  await hacerAdmin(admin.id);
  A = await crearParroquia('coo-a');
  B = await crearParroquia('coo-b');
  D = await crearParroquia('coo-d');
  await servicio.from('parroquias').update({ desactivada_en: new Date().toISOString() }).eq('id', D.id);
  m = await crearUsuario(`coo-m-${sufijo()}@prueba.test`, CLAVE); // crearUsuario inicia sesión de verdad
  await servicio.from('perfiles').insert({ usuario_id: m.id, nombre: 'Marta Gómez' });
  await hacerMiembro(A.id, m.id);
}, 60_000);

beforeEach(() => {
  buzon = [];
});

const filasDe = async (usuarioId: string) => (await listarCoordinadores(servicio)).filter((f) => f.usuarioId === usuarioId);

describe('listarCoordinadores, asignar y quitar', () => {
  it('trae al miembro con su nombre y su última entrada', async () => {
    const filas = await filasDe(m.id);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ tipo: 'miembro', nombre: 'Marta Gómez', correo: m.correo, parroquiaId: A.id, parroquiaSlug: A.slug, estado: 'activo' });
    expect(filas[0].ultimaEntrada).not.toBeNull();
    // Los administradores que no son miembros no aparecen.
    expect(await filasDe(admin.id)).toEqual([]);
  });

  it('asignar a otra parroquia, repetir, a una desactivada y sin ser admin', async () => {
    expect(await asignar(depsDe(admin), m.id, B.id)).toEqual({});
    const { data: fila } = await servicio.from('miembros').select('usuario_id').eq('parroquia_id', B.id).eq('usuario_id', m.id);
    expect(fila).toHaveLength(1);
    const { data: reg } = await servicio.from('registro').select('detalle, usuario_id').eq('parroquia_id', B.id).eq('accion', 'asignar');
    expect(reg).toEqual([{ detalle: { usuario_id: m.id }, usuario_id: admin.id }]);

    expect(await asignar(depsDe(admin), m.id, B.id)).toEqual({ error: MENSAJE_YA_COORDINA });
    expect(await asignar(depsDe(admin), m.id, D.id)).toEqual({ error: MENSAJE_PARROQUIA_DESACTIVADA });
    expect(await asignar(depsDe(m), m.id, D.id)).toEqual({ error: MENSAJE_SOLO_ADMIN });
    expect((await asignar(depsDe(admin), '00000000-0000-4000-8000-000000000000', B.id)).error).toBe('Esa persona no tiene cuenta.');

    expect(await filasDe(m.id)).toHaveLength(2);
    expect(await quitarAcceso(depsDe(admin), A.id, m.id)).toEqual({});
    const quedan = await filasDe(m.id);
    expect(quedan.map((f) => f.parroquiaId)).toEqual([B.id]);
  });
});

describe('invitaciones', () => {
  it('reenviar anula la vieja y manda una nueva; anular la saca de la lista', async () => {
    const correo = `coo-nuevo-${sufijo()}@prueba.test`;
    expect(await invitar(depsDe(admin), correo, A.id)).toEqual({});
    const { data: vieja } = await servicio.from('invitaciones').select('id').eq('correo', correo).single();

    const r = await reenviarInvitacion(depsDe(admin), vieja!.id);
    expect(r).toEqual({ correo });
    expect(buzon).toHaveLength(2);
    const { data: todas } = await servicio.from('invitaciones').select('id, anulada_en, usada_en').eq('correo', correo).order('creada_en');
    expect(todas).toHaveLength(2);
    expect(todas![0].anulada_en).not.toBeNull();
    expect(todas![1].anulada_en).toBeNull();
    const idNueva = todas![1].id as string;

    const enLista = (await listarCoordinadores(servicio)).filter((f) => f.correo === correo);
    expect(enLista).toHaveLength(1);
    expect(enLista[0]).toMatchObject({ tipo: 'invitacion', invitacionId: idNueva, estado: 'invitacion-enviada', parroquiaId: A.id });

    expect(await anularInvitacion(depsDe(m), idNueva)).toEqual({ error: MENSAJE_SOLO_ADMIN });
    expect(await anularInvitacion(depsDe(admin), idNueva)).toEqual({});
    const { data: reg } = await servicio.from('registro').select('detalle').eq('parroquia_id', A.id).eq('accion', 'anular_invitacion');
    expect(reg).toEqual([{ detalle: { correo } }]);
    expect((await listarCoordinadores(servicio)).filter((f) => f.correo === correo)).toEqual([]);
    expect(await anularInvitacion(depsDe(admin), idNueva)).toEqual({ error: MENSAJE_INVITACION_NO_PENDIENTE });
    expect((await reenviarInvitacion(depsDe(admin), idNueva)).error).toBe(MENSAJE_INVITACION_NO_PENDIENTE);
  });

  it('con filtro de slug trae solo filas de esa parroquia', async () => {
    await invitar(depsDe(admin), `coo-fil-${sufijo()}@prueba.test`, B.id);
    const filas = await listarCoordinadores(servicio, A.slug);
    expect(filas.every((f) => f.parroquiaId === A.id)).toBe(true);
    const deB = await listarCoordinadores(servicio, B.slug);
    expect(deB.length).toBeGreaterThan(0);
    expect(deB.every((f) => f.parroquiaId === B.id)).toBe(true);
  });
  it('anular solo sirve con invitaciones de coordinador, como reenviar (revisión fix2)', async () => {
    const correo = `coo-adm-${sufijo()}@prueba.test`;
    const { data: inv, error } = await servicio
      .from('invitaciones')
      .insert({ correo, rol: 'administrador', parroquia_id: null, token_hash: `prueba-${sufijo()}`, vence_en: new Date(Date.now() + 86_400_000).toISOString() })
      .select('id')
      .single();
    expect(error).toBeNull();
    try {
      expect(await anularInvitacion(depsDe(admin), inv!.id)).toEqual({ error: MENSAJE_INVITACION_NO_PENDIENTE });
      const { data: fila } = await servicio.from('invitaciones').select('anulada_en').eq('id', inv!.id).single();
      expect(fila!.anulada_en).toBeNull();
    } finally {
      await servicio.from('invitaciones').delete().eq('id', inv!.id);
    }
  });

  it('las filas de una parroquia desactivada salen como «parroquia-desactivada» (revisión fix2)', async () => {
    const correo = `coo-des-${sufijo()}@prueba.test`;
    const { error } = await servicio
      .from('invitaciones')
      .insert({ correo, rol: 'coordinador', parroquia_id: D.id, token_hash: `prueba-${sufijo()}`, vence_en: new Date(Date.now() + 86_400_000).toISOString() });
    expect(error).toBeNull();
    await hacerMiembro(D.id, m.id);
    const deD = await listarCoordinadores(servicio, D.slug);
    expect(deD.map((f) => [f.tipo, f.estado]).sort()).toEqual([
      ['invitacion', 'parroquia-desactivada'],
      ['miembro', 'parroquia-desactivada'],
    ]);
    await servicio.from('invitaciones').delete().eq('correo', correo);
    await servicio.from('miembros').delete().eq('parroquia_id', D.id).eq('usuario_id', m.id);
  });
});
