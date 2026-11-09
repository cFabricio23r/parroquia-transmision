// Administración de parroquias, invitaciones y registro, contra el Supabase LOCAL.
// La lógica de lib/admin.ts recibe los clientes y el buzón inyectados.
import { beforeEach, describe, expect, it } from 'vitest';
import { clienteAnonimo, clienteServicio, crearUsuario, hacerAdmin, hacerMiembro, crearParroquia as parroquiaDePrueba, sufijo } from './ayudas';
import {
  MENSAJE_INVITACION_INVALIDA,
  MENSAJE_SOLO_ADMIN,
  aceptarInvitacion,
  crearParroquia,
  invitar,
  quitarAcceso,
  type DepsAdmin,
} from '../../lib/admin';
import { hashDe, nuevoToken } from '../../lib/tokens';
import type { Mensaje } from '../../lib/correo';

const SITIO = 'http://localhost:3000';
const servicio = clienteServicio();
let buzon: Mensaje[];
const enviar = async (m: Mensaje) => {
  buzon.push(m);
};
const deps = (sesion = clienteAnonimo()): DepsAdmin => ({ servicio, sesion, enviar, sitioUrl: SITIO, slugsDelRepo: ['ciudad-arce'] });
const CLAVE = { clave: 'clave-larga-1', repetida: 'clave-larga-1' };

beforeEach(() => {
  buzon = [];
});

async function unAdmin() {
  const u = await crearUsuario(`admin-${sufijo()}@ejemplo.test`, 'clave-buena-1');
  await hacerAdmin(u.id);
  return u;
}

/** Saca el token del enlace del último correo del buzón. */
function tokenDelBuzon(): string {
  const m = buzon[buzon.length - 1].texto.match(/\/editor\/invitacion\?token=([A-Za-z0-9_-]+)/);
  if (!m) throw new Error('el correo no trae el enlace');
  return m[1];
}

describe('crearParroquia', () => {
  it('slug reservado o repetido falla con mensaje; uno nuevo crea parroquia y borrador', async () => {
    const admin = await unAdmin();
    const d = deps(admin.cliente);

    const reservado = await crearParroquia(d, 'editor', 'X');
    expect(reservado.error).toMatch(/en uso o está reservada/);
    const delRepo = await crearParroquia(d, 'ciudad-arce', 'X');
    expect(delRepo.error).toMatch(/en uso o está reservada/);

    const slug = `nueva-${sufijo()}`;
    const ok = await crearParroquia(d, slug, 'San Pedro');
    expect(ok.error).toBeUndefined();
    expect(ok.slug).toBe(slug);

    const { data: p } = await servicio.from('parroquias').select('id, nombre, creada_por').eq('slug', slug).single();
    expect(p?.nombre).toBe('San Pedro');
    expect(p?.creada_por).toBe(admin.id);
    const { data: b } = await servicio.from('borradores').select('config').eq('parroquia_id', p!.id).single();
    expect(b?.config).toEqual({ nombre: 'San Pedro' });

    const repetido = await crearParroquia(d, slug, 'Otra');
    expect(repetido.error).toMatch(/en uso o está reservada/);
    const { count } = await servicio.from('parroquias').select('id', { count: 'exact', head: true }).eq('slug', slug);
    expect(count).toBe(1);
  });

  it('pide un nombre', async () => {
    const admin = await unAdmin();
    const r = await crearParroquia(deps(admin.cliente), `sin-nombre-${sufijo()}`, '   ');
    expect(r.error).toMatch(/nombre/i);
  });
});

describe('solo administradores', () => {
  it('un coordinador no puede crear parroquias, invitar ni quitar acceso', async () => {
    const p = await parroquiaDePrueba('solo-admin');
    const coord = await crearUsuario(`coord-${sufijo()}@ejemplo.test`, 'clave-buena-1');
    await hacerMiembro(p.id, coord.id);
    const d = deps(coord.cliente);
    const slug = `no-${sufijo()}`;

    expect(await crearParroquia(d, slug, 'No')).toEqual({ error: 'Solo un administrador puede hacer esto' });
    expect(await invitar(d, `x-${sufijo()}@ejemplo.test`, p.id)).toEqual({ error: MENSAJE_SOLO_ADMIN });
    expect(await quitarAcceso(d, p.id, coord.id)).toEqual({ error: MENSAJE_SOLO_ADMIN });
    expect(await crearParroquia(deps(), slug, 'Sin sesión')).toEqual({ error: MENSAJE_SOLO_ADMIN });

    const { count } = await servicio.from('parroquias').select('id', { count: 'exact', head: true }).eq('slug', slug);
    expect(count).toBe(0);
    expect(buzon).toHaveLength(0);
    const { count: miembros } = await servicio.from('miembros').select('usuario_id', { count: 'exact', head: true }).eq('parroquia_id', p.id);
    expect(miembros).toBe(1);
  });
});

describe('aceptarInvitacion', () => {
  it('correo nuevo: crea la cuenta con signup apagado y la vuelve coordinadora de esa parroquia', async () => {
    const admin = await unAdmin();
    const p = await parroquiaDePrueba('acepta-nueva');
    const correo = `Nuevo-${sufijo()}@Ejemplo.test`;
    expect(await invitar(deps(admin.cliente), correo, p.id)).toEqual({});
    expect(buzon).toHaveLength(1);
    expect(buzon[0].para).toBe(correo.toLowerCase());
    const token = tokenDelBuzon();

    // Sin contraseña válida no se crea nada
    const corta = await aceptarInvitacion(deps(), token, { clave: 'corta', repetida: 'corta' });
    expect(corta.error).toMatch(/al menos 8/);
    const distintas = await aceptarInvitacion(deps(), token, { clave: 'clave-larga-1', repetida: 'clave-larga-2' });
    expect(distintas.error).toMatch(/no coinciden/);

    const sesion = clienteAnonimo();
    const r = await aceptarInvitacion(deps(sesion), token, CLAVE);
    expect(r.error).toBeUndefined();
    expect(r.parroquiaSlug).toBe(p.slug);

    const { data: u } = await sesion.auth.getUser();
    expect(u.user?.email).toBe(correo.toLowerCase());
    const { data: m } = await servicio.from('miembros').select('rol').eq('parroquia_id', p.id).eq('usuario_id', u.user!.id).single();
    expect(m?.rol).toBe('coordinador');
    // Es coordinadora solo de esa parroquia, no administradora
    const { count } = await servicio.from('administradores').select('usuario_id', { count: 'exact', head: true }).eq('usuario_id', u.user!.id);
    expect(count).toBe(0);
    // El token quedó gastado
    expect(await aceptarInvitacion(deps(), token, CLAVE)).toEqual({ error: MENSAJE_INVITACION_INVALIDA });
  });

  it('invitación de administrador: crea la cuenta y la agrega a administradores', async () => {
    const correo = `adm-${sufijo()}@ejemplo.test`;
    const { token, hash } = nuevoToken();
    const { error } = await servicio.from('invitaciones').insert({
      correo,
      rol: 'administrador',
      token_hash: hash,
      vence_en: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(error).toBeNull();
    const sesion = clienteAnonimo();
    const r = await aceptarInvitacion(deps(sesion), token, CLAVE);
    expect(r.error).toBeUndefined();
    const { data: u } = await sesion.auth.getUser();
    const { count } = await servicio.from('administradores').select('usuario_id', { count: 'exact', head: true }).eq('usuario_id', u.user!.id);
    expect(count).toBe(1);
  });

  it('con cuenta y la misma sesión: asigna sin pedir contraseña', async () => {
    const admin = await unAdmin();
    const p = await parroquiaDePrueba('acepta-existente');
    const u = await crearUsuario(`exist-${sufijo()}@ejemplo.test`, 'clave-buena-1');
    await invitar(deps(admin.cliente), u.correo, p.id);
    const r = await aceptarInvitacion(deps(u.cliente), tokenDelBuzon(), {});
    expect(r.error).toBeUndefined();
    const { count } = await servicio.from('miembros').select('usuario_id', { count: 'exact', head: true }).eq('parroquia_id', p.id).eq('usuario_id', u.id);
    expect(count).toBe(1);
  });

  it('usada, vencida o anulada falla con el mensaje', async () => {
    const admin = await unAdmin();
    const p = await parroquiaDePrueba('acepta-mala');

    // inexistente
    expect(await aceptarInvitacion(deps(), 'token-que-no-existe', CLAVE)).toEqual({
      error: 'Esta invitación ya no sirve. Pide una nueva al administrador',
    });

    // usada
    await invitar(deps(admin.cliente), `usada-${sufijo()}@ejemplo.test`, p.id);
    const usada = tokenDelBuzon();
    expect((await aceptarInvitacion(deps(), usada, CLAVE)).error).toBeUndefined();
    expect((await aceptarInvitacion(deps(), usada, CLAVE)).error).toBe(MENSAJE_INVITACION_INVALIDA);

    // vencida
    const correoV = `vencida-${sufijo()}@ejemplo.test`;
    await invitar(deps(admin.cliente), correoV, p.id);
    const vencida = tokenDelBuzon();
    await servicio.from('invitaciones').update({ vence_en: new Date(Date.now() - 1000).toISOString() }).eq('token_hash', hashDe(vencida));
    expect((await aceptarInvitacion(deps(), vencida, CLAVE)).error).toBe(MENSAJE_INVITACION_INVALIDA);
    const { data: u } = await servicio.rpc('usuario_id_por_correo', { p_correo: correoV });
    expect(u).toBeNull();

    // anulada
    await invitar(deps(admin.cliente), `anulada-${sufijo()}@ejemplo.test`, p.id);
    const anulada = tokenDelBuzon();
    await servicio.from('invitaciones').update({ anulada_en: new Date().toISOString() }).eq('token_hash', hashDe(anulada));
    expect((await aceptarInvitacion(deps(), anulada, CLAVE)).error).toBe(MENSAJE_INVITACION_INVALIDA);
  });

  it('correo con cuenta y sesión de otra cuenta: no asigna nada', async () => {
    const admin = await unAdmin();
    const p = await parroquiaDePrueba('acepta-otra');
    const invitada = await crearUsuario(`invitada-${sufijo()}@ejemplo.test`, 'clave-buena-1');
    const otra = await crearUsuario(`otra-${sufijo()}@ejemplo.test`, 'clave-buena-1');
    await invitar(deps(admin.cliente), invitada.correo, p.id);
    const token = tokenDelBuzon();

    const r = await aceptarInvitacion(deps(otra.cliente), token, {});
    expect(r.error).toBe(`Esta invitación es para ${invitada.correo}. Sal de tu cuenta y entra con esa`);
    const { count } = await servicio.from('miembros').select('usuario_id', { count: 'exact', head: true }).eq('parroquia_id', p.id);
    expect(count).toBe(0);

    // Sin sesión: pide entrar con ese correo; tampoco asigna ni gasta el token
    const sinSesion = await aceptarInvitacion(deps(), token, {});
    expect(sinSesion.error).toMatch(/\/editor\/entrar/);
    expect(sinSesion.error).toContain(invitada.correo);
    const { data: inv } = await servicio.from('invitaciones').select('usada_en').eq('token_hash', hashDe(token)).single();
    expect(inv?.usada_en).toBeNull();

    // Y con la sesión correcta todavía sirve
    expect((await aceptarInvitacion(deps(invitada.cliente), token, {})).error).toBeUndefined();
  });
});

describe('invitar', () => {
  it('guarda solo el hash, vence en 7 días y volver a invitar anula la anterior', async () => {
    const admin = await unAdmin();
    const p = await parroquiaDePrueba('reinvita');
    const correo = `rei-${sufijo()}@ejemplo.test`;
    const antes = Date.now();
    await invitar(deps(admin.cliente), correo, p.id);
    const primero = tokenDelBuzon();
    await invitar(deps(admin.cliente), correo.toUpperCase(), p.id);
    const segundo = tokenDelBuzon();
    expect(segundo).not.toBe(primero);
    expect(buzon[1].texto).toContain(`${SITIO}/editor/invitacion?token=${segundo}`);

    const { data: filas } = await servicio.from('invitaciones').select('token_hash, anulada_en, vence_en, creada_por, rol').eq('parroquia_id', p.id);
    expect(filas).toHaveLength(2);
    const a = filas!.find((f) => f.token_hash === hashDe(primero))!;
    const b = filas!.find((f) => f.token_hash === hashDe(segundo))!;
    expect(a.anulada_en).not.toBeNull();
    expect(b.anulada_en).toBeNull();
    expect(b.rol).toBe('coordinador');
    expect(b.creada_por).toBe(admin.id);
    const dias = (new Date(b.vence_en).getTime() - antes) / 86_400_000;
    expect(dias).toBeGreaterThan(6.99);
    expect(dias).toBeLessThan(7.01);
    expect(filas!.some((f) => f.token_hash === primero || f.token_hash === segundo)).toBe(false);

    expect((await aceptarInvitacion(deps(), primero, CLAVE)).error).toBe(MENSAJE_INVITACION_INVALIDA);
  });

  it('rechaza un correo mal escrito y una parroquia inexistente', async () => {
    const admin = await unAdmin();
    const p = await parroquiaDePrueba('invita-mala');
    expect((await invitar(deps(admin.cliente), 'sin-arroba', p.id)).error).toMatch(/correo/i);
    expect((await invitar(deps(admin.cliente), `a-${sufijo()}@ejemplo.test`, crypto.randomUUID())).error).toMatch(/parroquia/i);
    expect(buzon).toHaveLength(0);
  });
});

describe('quitarAcceso', () => {
  it('borra la membresía y lo registra', async () => {
    const admin = await unAdmin();
    const p = await parroquiaDePrueba('quita');
    const u = await crearUsuario(`quita-${sufijo()}@ejemplo.test`, 'clave-buena-1');
    await hacerMiembro(p.id, u.id);
    expect(await quitarAcceso(deps(admin.cliente), p.id, u.id)).toEqual({});
    const { count } = await servicio.from('miembros').select('usuario_id', { count: 'exact', head: true }).eq('parroquia_id', p.id);
    expect(count).toBe(0);
    const { data } = await servicio.from('registro').select('usuario_id, detalle').eq('parroquia_id', p.id).eq('accion', 'quitar_acceso');
    expect(data).toHaveLength(1);
    expect(data![0].usuario_id).toBe(admin.id);
    expect(data![0].detalle).toEqual({ usuario_id: u.id });
  });
});

describe('registro', () => {
  it('guarda crear_parroquia, invitar (sin token) y aceptar_invitacion', async () => {
    const admin = await unAdmin();
    const slug = `reg-${sufijo()}`;
    const d = deps(admin.cliente);
    await crearParroquia(d, slug, 'Registro');
    const { data: p } = await servicio.from('parroquias').select('id').eq('slug', slug).single();
    const correo = `reg-${sufijo()}@ejemplo.test`;
    await invitar(d, correo, p!.id);
    const token = tokenDelBuzon();
    await aceptarInvitacion(deps(), token, CLAVE);

    const { data: filas } = await servicio.from('registro').select('accion, detalle, usuario_id').eq('parroquia_id', p!.id).order('id');
    expect(filas!.map((f) => f.accion)).toEqual(['crear_parroquia', 'invitar', 'aceptar_invitacion']);
    expect(filas![0].usuario_id).toBe(admin.id);
    expect(filas![0].detalle).toMatchObject({ slug });
    expect(filas![1].detalle).toMatchObject({ correo });
    expect(filas![2].detalle).toMatchObject({ correo });
    // El token jamás entra al registro
    const todo = JSON.stringify(filas);
    expect(todo).not.toContain(token);
    expect(todo).not.toContain(hashDe(token));
  });
});
