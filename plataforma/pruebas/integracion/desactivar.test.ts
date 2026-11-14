// Desactivar y reactivar parroquias (plan 5 del rediseño), contra el Supabase LOCAL con sesiones reales.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  clienteAnonimo,
  clienteServicio,
  crearParroquia,
  crearUsuario,
  hacerAdmin,
  hacerMiembro,
  limpiarStorage,
  sufijo,
  type UsuarioPrueba,
} from './ayudas';
import {
  MENSAJE_INVITACION_DESACTIVADA,
  MENSAJE_PARROQUIA_DESACTIVADA,
  MENSAJE_SOLO_ADMIN,
  aceptarInvitacion,
  invitar,
  type DepsAdmin,
} from '../../lib/admin';
import {
  MENSAJE_YA_ACTIVA,
  MENSAJE_YA_DESACTIVADA,
  desactivarParroquia,
  listarParroquias,
  reactivarParroquia,
} from '../../lib/admin-parroquias';
import { guardarBorrador } from '../../lib/borrador';
import { publicar, restaurar } from '../../lib/publicar';
import { MENSAJE_DESACTIVADA_PUBLICAR } from '../../lib/editor/revision';
import type { Mensaje } from '../../lib/correo';

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
let a: UsuarioPrueba;
let buzon: Mensaje[];
let hook500: Server;
let urlHook500 = '';
const enviar = async (m: Mensaje) => {
  buzon.push(m);
};
const depsDe = (u: UsuarioPrueba | null, hookUrl?: string): DepsAdmin => ({
  servicio,
  sesion: u ? u.cliente : clienteAnonimo(),
  enviar,
  sitioUrl: 'http://x',
  slugsDelRepo: [],
  hookUrl,
});

beforeAll(async () => {
  c = await crearUsuario(`des-c-${sufijo()}@prueba.test`, CLAVE);
  a = await crearUsuario(`des-a-${sufijo()}@prueba.test`, CLAVE);
  await hacerAdmin(a.id);
  hook500 = await new Promise<Server>((ok) => {
    const srv = createServer((_q, r) => {
      r.statusCode = 500;
      r.end();
    });
    srv.listen(0, '127.0.0.1', () => ok(srv));
  });
  urlHook500 = `http://127.0.0.1:${(hook500.address() as AddressInfo).port}/hook/secreto`;
}, 60_000);

beforeEach(() => {
  buzon = [];
});

afterAll(async () => {
  await new Promise((ok) => hook500.close(ok));
  await limpiarStorage();
}, 60_000);

const registroDe = async (id: string, accion: string) =>
  ((await servicio.from('registro').select('*').eq('parroquia_id', id).eq('accion', accion)).data ?? []) as {
    detalle: Record<string, unknown>;
    usuario_id: string | null;
  }[];
const desactivadaEn = async (id: string) =>
  (await servicio.from('parroquias').select('desactivada_en').eq('id', id).single()).data?.desactivada_en ?? null;
const tokenDelBuzon = () => {
  const m = buzon[buzon.length - 1].texto.match(/\/editor\/invitacion\?token=([A-Za-z0-9_-]+)/);
  if (!m) throw new Error('el correo no trae el enlace');
  return m[1];
};

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

describe('desactivar y reactivar', () => {
  it('solo un admin; registra la acción; repetir avisa sin registrar de nuevo', async () => {
    const p = await crearParroquia('des-ad');
    await hacerMiembro(p.id, c.id);
    expect(await desactivarParroquia(depsDe(c), p.id)).toEqual({ error: MENSAJE_SOLO_ADMIN });
    expect(await desactivadaEn(p.id)).toBeNull();

    expect(await desactivarParroquia(depsDe(a), p.id)).toEqual({ hook: 'sin-configurar' });
    expect(await desactivadaEn(p.id)).not.toBeNull();
    const filas = await registroDe(p.id, 'desactivar');
    expect(filas).toHaveLength(1);
    expect(filas[0].detalle).toEqual({ slug: p.slug, nombre: `Parroquia ${p.slug}` });
    expect(filas[0].usuario_id).toBe(a.id);
    expect(await desactivarParroquia(depsDe(a), p.id)).toEqual({ error: MENSAJE_YA_DESACTIVADA });
    expect(await registroDe(p.id, 'desactivar')).toHaveLength(1);

    // Review Focus 1: el coordinador con el editor abierto.
    const { data: b } = await servicio.from('borradores').select('actualizado_en').eq('parroquia_id', p.id).single();
    const g = await guardarBorrador(c.cliente, p.slug, { cambios: { nombre: 'X' }, actualizadoEn: b!.actualizado_en });
    expect(g.estado).toBe(403);
    expect((await publicar({ sesion: c.cliente, servicio }, p.slug)).estado).toBe(403);
    const delAdmin = await publicar({ sesion: a.cliente, servicio }, p.slug);
    expect(delAdmin).toEqual({ estado: 409, cuerpo: { error: MENSAJE_DESACTIVADA_PUBLICAR } });
    expect((await restaurar({ sesion: a.cliente, servicio }, p.slug, 1)).estado).toBe(409);
    expect((await servicio.from('versiones').select('numero').eq('parroquia_id', p.id)).data).toEqual([]);

    expect(await reactivarParroquia(depsDe(c), p.id)).toEqual({ error: MENSAJE_SOLO_ADMIN });
    expect(await reactivarParroquia(depsDe(a), p.id)).toEqual({ hook: 'sin-configurar' });
    expect(await desactivadaEn(p.id)).toBeNull();
    expect(await registroDe(p.id, 'reactivar')).toHaveLength(1);
    expect((await c.cliente.from('parroquias').select('id').eq('id', p.id)).data).toHaveLength(1);
    expect(await reactivarParroquia(depsDe(a), p.id)).toEqual({ error: MENSAJE_YA_ACTIVA });
    expect(await registroDe(p.id, 'reactivar')).toHaveLength(1);
  });

  it('una parroquia que no existe o un id inválido', async () => {
    expect((await desactivarParroquia(depsDe(a), '00000000-0000-4000-8000-000000000000')).error).toBe('Esa parroquia no existe.');
    expect((await reactivarParroquia(depsDe(a), 'nada')).error).toBe('Esa parroquia no existe.');
  });

  it('invitar a una desactivada se bloquea; aceptar una invitación previa no gasta el token', async () => {
    const p = await crearParroquia('des-inv');
    expect(await invitar(depsDe(a), `previa-${sufijo()}@prueba.test`, p.id)).toEqual({});
    const token = tokenDelBuzon();
    await marcar(p.id, true);

    const correo = `x-${sufijo()}@prueba.test`;
    expect(await invitar(depsDe(a), correo, p.id)).toEqual({ error: MENSAJE_PARROQUIA_DESACTIVADA });
    expect((await servicio.from('invitaciones').select('id').eq('correo', correo)).data).toEqual([]);

    const datos = { clave: 'clave-larga-1', repetida: 'clave-larga-1', nombre: 'Nueva' };
    expect(await aceptarInvitacion(depsDe(null), token, datos)).toEqual({ error: MENSAJE_INVITACION_DESACTIVADA });
    const { data: inv } = await servicio.from('invitaciones').select('usada_en').eq('parroquia_id', p.id).single();
    expect(inv?.usada_en).toBeNull();
    expect((await servicio.from('miembros').select('usuario_id').eq('parroquia_id', p.id)).data).toEqual([]);

    // Después de reactivar, la misma invitación sirve.
    await marcar(p.id, false);
    const r2 = await aceptarInvitacion(depsDe(null), token, datos);
    expect(r2.error).toBeUndefined();
    expect((await servicio.from('miembros').select('usuario_id').eq('parroquia_id', p.id)).data).toHaveLength(1);
  });

  it('si el aviso a Vercel falla, la parroquia queda desactivada igual', async () => {
    const p = await crearParroquia('des-hook');
    const silencio = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await desactivarParroquia(depsDe(a, urlHook500), p.id)).toEqual({ hook: 'fallo' });
    silencio.mockRestore();
    expect(await desactivadaEn(p.id)).not.toBeNull();
  });
});

describe('listarParroquias (D1)', () => {
  it('estado, lugar, coordinadores e invitación pendiente de cada parroquia', async () => {
    const publicada = await crearParroquia('lis-pub');
    await servicio.from('borradores').update({ config: { nombre: 'P1', lugar: 'L2' } }).eq('parroquia_id', publicada.id);
    await servicio.from('versiones').insert({ parroquia_id: publicada.id, numero: 3, config: { nombre: 'P1', lugar: 'L1' } });
    await servicio.from('versiones').insert({ parroquia_id: publicada.id, numero: 1, config: { nombre: 'P1', lugar: 'viejo' } });

    const borrador = await crearParroquia('lis-bor');
    await servicio.from('borradores').update({ config: { nombre: 'P2', lugar: 'L3', colores: {} } }).eq('parroquia_id', borrador.id);

    const sinConfigurar = await crearParroquia('lis-sin');
    await servicio.from('borradores').update({ config: { nombre: 'P3', lugar: 'L4' } }).eq('parroquia_id', sinConfigurar.id);
    expect(await invitar(depsDe(a), `lis-${sufijo()}@prueba.test`, sinConfigurar.id)).toEqual({});

    const apagada = await crearParroquia('lis-des');
    const ana = await crearUsuario(`lis-ana-${sufijo()}@prueba.test`, CLAVE);
    await servicio.from('perfiles').insert({ usuario_id: ana.id, nombre: 'Ana Pérez' });
    const sinPerfil = await crearUsuario(`lis-sp-${sufijo()}@prueba.test`, CLAVE);
    await hacerMiembro(apagada.id, ana.id);
    await hacerMiembro(apagada.id, sinPerfil.id);
    await marcar(apagada.id, true);

    const filas = await listarParroquias(servicio);
    const de = (id: string) => filas.find((f) => f.id === id)!;
    expect(de(publicada.id)).toMatchObject({ slug: publicada.slug, lugar: 'L1', estado: { clave: 'publicada', version: 3 }, coordinadores: [] });
    expect(de(borrador.id)).toMatchObject({ lugar: 'L3', estado: { clave: 'borrador' }, invitacionPendiente: false });
    expect(de(sinConfigurar.id)).toMatchObject({ lugar: 'L4', estado: { clave: 'sin-configurar' }, invitacionPendiente: true });
    expect(de(apagada.id).estado).toEqual({ clave: 'desactivada' });
    expect(de(apagada.id).coordinadores).toEqual(['Ana Pérez', sinPerfil.correo].sort((x, y) => x.localeCompare(y, 'es')));
    // Ordenadas por nombre.
    const nombres = filas.map((f) => f.nombre);
    expect(nombres).toEqual([...nombres].sort((x, y) => x.localeCompare(y, 'es')));
  });

  it('una invitación vencida o anulada no cuenta como pendiente', async () => {
    const p = await crearParroquia('lis-ven');
    await servicio.from('invitaciones').insert({
      correo: `ven-${sufijo()}@prueba.test`,
      rol: 'coordinador',
      parroquia_id: p.id,
      token_hash: `h-${sufijo()}`,
      vence_en: new Date(Date.now() - 1000).toISOString(),
    });
    const fila = (await listarParroquias(servicio)).find((f) => f.id === p.id)!;
    expect(fila.invitacionPendiente).toBe(false);
    expect(fila.lugar).toBeNull();
  });
});
