// Las rutas de la app para el vivo de Facebook, contra el Supabase LOCAL (RLS real, índice único real).
// Graph es falso. Todo es aleatorio por corrida: slug y page_id nunca son fijos.
import { randomBytes, randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { MENSAJE_SIN_PERMISO } from '../../lib/borrador';
import { cifrar } from '../../lib/facebook/cifrado';
import type { GraphFacebook } from '../../lib/facebook/graph';
import { crearVivo, estadoVivo, leerDestinos, terminarVivo, type DepsVivos } from '../../lib/facebook/vivos';
import { clienteConToken } from '../../lib/supabase/con-token';
import { clienteServicio, crearParroquia, crearUsuario, hacerMiembro, sufijo, type UsuarioPrueba } from './ayudas';

const servicio = clienteServicio();
const CLAVE_USUARIO = 'clave-de-prueba-123';
const LLAVE = randomBytes(32);
const SERVIDOR = 'rtmps://live-api-s.facebook.com:443/rtmp/';

type Parroquia = { id: string; slug: string };
let A: Parroquia;
let B: Parroquia;
let coordA: UsuarioPrueba;
let coordB: UsuarioPrueba;
const principal = `pg-${randomUUID()}`;
const extra = `pg-${randomUUID()}`;
const principalB = `pg-${randomUUID()}`;

/** Un Graph falso con un vivo por llamada a crearVivo; cada uno con su clave. */
function graphFalso() {
  const creados: string[] = [];
  const g = {
    crearVivo: async () => {
      await new Promise((ok) => setTimeout(ok, 50)); // para que dos pedidos en paralelo se crucen
      const vivoId = `fb-${randomUUID()}`;
      creados.push(vivoId);
      return { ok: true, valor: { vivoId, url: `${SERVIDOR}clave-${vivoId}` } };
    },
    activarCrosspost: async () => ({ ok: true, valor: undefined }),
    crosspostHechos: async () => ({ ok: true, valor: [] }),
    estadoVivo: async () => ({ ok: true, valor: 'activo' }),
    urlDeVivo: async (vivoId: string) => ({ ok: true, valor: `${SERVIDOR}clave-${vivoId}` }),
    terminarVivo: async () => ({ ok: true, valor: undefined }),
  } as unknown as GraphFacebook;
  return { g, creados };
}

const deps = (usuario: UsuarioPrueba, g: GraphFacebook): DepsVivos => ({ sesion: usuario.cliente, servicio, graph: g, llave: LLAVE });

async function sembrar(parroquia: Parroquia, pagina: string, extras: string[] = []) {
  const pag = (id: string) => ({ parroquia_id: parroquia.id, page_id: id, nombre: `Nombre ${id}`, token: cifrar(`TOKEN-${id}`, LLAVE) });
  const filas = [
    servicio.from('facebook_conexion').insert({ parroquia_id: parroquia.id, nombre_facebook: 'Falso', token_usuario: cifrar('TOKEN-USUARIO', LLAVE), estado: 'conectado' }),
    servicio.from('facebook_paginas').insert([pag(pagina), ...extras.map(pag)]),
    servicio.from('facebook_parroquia').insert({ parroquia_id: parroquia.id, pagina_principal: pagina }),
  ];
  if (extras.length) {
    filas.push(servicio.from('facebook_parroquia_extra').insert(extras.map((e) => ({ parroquia_id: parroquia.id, page_id: e, por_defecto: true, crosspost: 'listo' }))));
  }
  for (const r of await Promise.all(filas)) expect(r.error).toBeNull();
}

beforeAll(async () => {
  A = await crearParroquia('fbv');
  B = await crearParroquia('fbv');
  coordA = await crearUsuario(`fbv-a-${sufijo()}@prueba.local`, CLAVE_USUARIO);
  coordB = await crearUsuario(`fbv-b-${sufijo()}@prueba.local`, CLAVE_USUARIO);
  await hacerMiembro(A.id, coordA.id);
  await hacerMiembro(B.id, coordB.id);
  await sembrar(A, principal, [extra]);
  await sembrar(B, principalB);
}, 60_000);

describe('vivo de Facebook: el celular de la misma parroquia', () => {
  it('dos crearVivo en paralelo para la misma parroquia dan el mismo id y queda un solo vivo activo', async () => {
    const { g, creados } = graphFalso();
    const [uno, dos] = await Promise.all([
      crearVivo(deps(coordA, g), A.slug, { extras: [extra], titulo: 'Misa de prueba' }),
      crearVivo(deps(coordA, g), A.slug, { extras: [extra], titulo: 'Misa de prueba' }),
    ]);
    expect([uno.estado, dos.estado]).toEqual([200, 200]);
    const a = uno.cuerpo as { id: string; clave: string; reusado: boolean };
    const b = dos.cuerpo as { id: string; clave: string; reusado: boolean };
    expect(a.id).toBe(b.id);
    expect(creados).toHaveLength(2); // los dos llegaron a crear en Facebook: la base decidió
    expect([a.reusado, b.reusado].sort()).toEqual([false, true]);

    const { data } = await servicio.from('facebook_vivos').select('id, vivo_id').eq('parroquia_id', A.id).is('terminado_en', null);
    expect(data).toHaveLength(1);
    expect(data![0].id).toBe(a.id);
    // Las dos respuestas traen la clave del vivo que quedó.
    expect(a.clave).toBe(`clave-${data![0].vivo_id}`);
    expect(b.clave).toBe(a.clave);
  });

  it('estado, terminar (dos veces) y un nuevo vivo después', async () => {
    const { g } = graphFalso();
    const d = deps(coordA, g);
    const { data } = await servicio.from('facebook_vivos').select('id').eq('parroquia_id', A.id).is('terminado_en', null);
    const id = data![0].id as string;

    const e = await estadoVivo(d, A.slug, id);
    expect(e.cuerpo).toEqual({ estado: 'activo', extras: [{ id: extra, nombre: `Nombre ${extra}`, salio: false }] });

    expect((await terminarVivo(d, A.slug, id)).estado).toBe(200);
    expect((await terminarVivo(d, A.slug, id)).estado).toBe(200);
    expect((await estadoVivo(d, A.slug, id)).cuerpo).toMatchObject({ estado: 'terminado' });

    const otro = await crearVivo(d, A.slug, { extras: [], titulo: 'Otra misa' });
    expect(otro.estado).toBe(200);
    expect((otro.cuerpo as { id: string; reusado: boolean }).id).not.toBe(id);
    expect((otro.cuerpo as { reusado: boolean }).reusado).toBe(false);
  });

  it('un id que no es uuid es 404, no 500', async () => {
    const { g } = graphFalso();
    expect((await estadoVivo(deps(coordA, g), A.slug, 'no-es-uuid')).estado).toBe(404);
    expect((await terminarVivo(deps(coordA, g), A.slug, 'no-es-uuid')).estado).toBe(404);
  });

  it('la conexión de A se ve por leerDestinos con RLS real', async () => {
    const r = await leerDestinos({ sesion: coordA.cliente, servicio }, A.slug);
    expect(r.cuerpo).toEqual({
      conectado: true,
      principal: { id: principal, nombre: `Nombre ${principal}` },
      extras: [{ id: extra, nombre: `Nombre ${extra}`, porDefecto: true }],
    });
  });
});

describe('vivo de Facebook: otra parroquia', () => {
  it('un coordinador de otra parroquia recibe 403 en las cuatro operaciones y no se crea nada', async () => {
    const { g, creados } = graphFalso();
    const d = deps(coordB, g);
    const { data } = await servicio.from('facebook_vivos').select('id').eq('parroquia_id', A.id).limit(1);
    const idDeA = data![0].id as string;
    const antes = (await servicio.from('facebook_vivos').select('id').eq('parroquia_id', A.id)).data!.length;

    const respuestas = [
      await leerDestinos({ sesion: coordB.cliente, servicio }, A.slug),
      await crearVivo(d, A.slug, { extras: [], titulo: 'Intruso' }),
      await estadoVivo(d, A.slug, idDeA),
      await terminarVivo(d, A.slug, idDeA),
    ];
    for (const r of respuestas) {
      expect(r.estado).toBe(403);
      expect(r.cuerpo).toEqual({ error: MENSAJE_SIN_PERMISO });
    }
    expect(creados).toEqual([]);
    expect((await servicio.from('facebook_vivos').select('id').eq('parroquia_id', A.id)).data).toHaveLength(antes);
  });

  it('un coordinador no puede usar de extra una página que es de otra parroquia: 422 y no se crea nada', async () => {
    const { g, creados } = graphFalso();
    const r = await crearVivo(deps(coordB, g), B.slug, { extras: [extra], titulo: 'Misa' });
    expect(r.estado).toBe(422);
    expect(creados).toEqual([]);
    expect((await servicio.from('facebook_vivos').select('id').eq('parroquia_id', B.id)).data).toEqual([]);
  });

  it('el id de un vivo de A pedido desde la parroquia B (sea suya) es 404: no se lee con otra parroquia', async () => {
    const { g } = graphFalso();
    const { data } = await servicio.from('facebook_vivos').select('id').eq('parroquia_id', A.id).limit(1);
    const id = data![0].id as string;
    expect((await estadoVivo(deps(coordB, g), B.slug, id)).estado).toBe(404);
    expect((await terminarVivo(deps(coordB, g), B.slug, id)).estado).toBe(404);
  });
});

describe('clienteConToken', () => {
  const origenAnterior = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, clave: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
    return () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = origenAnterior.url;
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = origenAnterior.clave;
    };
  });
  const pedir = (authorization: string) => new Request('http://localhost/editor/api/x/app/vivo', { headers: { authorization } });

  it('un token inventado (o mal escrito) da null: la ruta responde 401', async () => {
    expect(await clienteConToken(pedir('Bearer token-inventado'))).toBeNull();
    expect(await clienteConToken(pedir(`Bearer ${randomBytes(40).toString('base64url')}.${randomBytes(40).toString('base64url')}.firma`))).toBeNull();
    expect(await clienteConToken(pedir('Bearer'))).toBeNull();
    expect(await clienteConToken(pedir('Basic abc'))).toBeNull();
  });

  it('un token real da un cliente que ve la parroquia de su dueño (RLS) y solo esa', async () => {
    const { data } = await coordA.cliente.auth.getSession();
    const token = data.session!.access_token;
    const sesion = await clienteConToken(pedir(`Bearer ${token}`));
    expect(sesion).not.toBeNull();
    const propia = await leerDestinos({ sesion: sesion!, servicio }, A.slug);
    expect(propia.estado).toBe(200);
    const ajena = await leerDestinos({ sesion: sesion!, servicio }, B.slug);
    expect(ajena.estado).toBe(403);
  });
});
